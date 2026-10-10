import { CardGameModel, MIN_JUGADORES, MAX_JUGADORES } from '../models/CardGameModel.js';
import { Card } from '../models/Card.js';
import { PeerNetwork } from '../network/PeerNetwork.js';
import { UIControlsView } from '../views/UIControlsView.js';
import { BoardView } from '../views/BoardView.js';
import { AudioView } from '../views/AudioView.js';

const COLORES = ['#fbbf24', '#38bdf8', '#f472b6', '#a3e635'];

const ESPERA_RECONEXION = 15000;       // ms de espera antes de dar por perdido a un jugador
const INTERVALO_RECONEXION = 2500;     // ms entre intentos de reconexión del invitado
const VENTANA_SESION = 5 * 60 * 1000;  // ms de validez para reanudar una sesión guardada
const KEY_SESION = 'sesion-443';
const KEY_JUGADOR = 'jugador-id-443';
const KEY_SNAPSHOT = 'estado-443';

export class GameController {
  constructor() {
    this.vista = new BoardView();
    this.ui = new UIControlsView();
    this.audio = new AudioView();

    this.red = null;
    this.modelo = null;
    this.snapshot = null;       // copia completa del modelo (reconexión / migración)
    this.esHost = false;
    this.miNumero = 1;
    this.hostNumero = 1;
    this.sala = '';
    this.miNombre = '';
    this.jugadorId = this._obtenerJugadorId();
    this.enPartida = false;
    this.onSalirAlInicio = null;

    this.jugadores = [];        // [{ clave, numero, nombre, conectado, jugadorId }]
    this._clavePorNumero = new Map();

    this._ganadorNotificado = null;
    this._desconectado = false;

    this._desconectados = new Map();       // numero -> { timer, nombre }
    this._modalDesconectadoAbierto = false;
    this._reconectando = null;             // { desde, migrando, timer }

    this.vista.configurarAcciones({
      robarMazo: () => this._pedirAccion('robarMazo'),
      robarDescarte: () => this._pedirAccion('robarDescarte'),
      botar: (cartaId) => this._pedirAccion('botar', { cartaId }),
      cantar: () => this._pedirAccion('cantar'),
      seleccionarCarta: (id) => this.vista.seleccionarCarta(id),
      reiniciar: () => this._pedirReinicio(),
    });
  }

  get maxJugadores() {
    return MAX_JUGADORES;
  }

  _colorDe(numero) {
    return COLORES[(numero - 1) % COLORES.length];
  }

  // ===== IDENTIDAD / SESIÓN =====

  _obtenerJugadorId() {
    try {
      let id = localStorage.getItem(KEY_JUGADOR);
      if (!id) {
        id = this._nuevoJugadorId();
        localStorage.setItem(KEY_JUGADOR, id);
      }
      return id;
    } catch (e) {
      return this._nuevoJugadorId();
    }
  }

  _nuevoJugadorId() {
    return 'j-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  _guardarSesion(rol) {
    if (!this.sala) return;
    try {
      localStorage.setItem(KEY_SESION, JSON.stringify({
        sala: this.sala,
        jugadorId: this.jugadorId,
        nombre: this.miNombre,
        rol,
        fecha: Date.now(),
      }));
    } catch (e) { /* sin almacenamiento */ }
  }

  leerSesion() {
    try {
      const raw = localStorage.getItem(KEY_SESION);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.sala) return null;
      if (Date.now() - (s.fecha || 0) > VENTANA_SESION) {
        this._borrarSesion();
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  _borrarSesion() {
    try { localStorage.removeItem(KEY_SESION); } catch (e) { /* ignorar */ }
  }

  _claveSnapshot(sala = this.sala) {
    return `${KEY_SNAPSHOT}-${sala}`;
  }

  _persistir() {
    if (!this.sala) return;
    try {
      const modelo = this.modelo
        ? this.modelo.toJSON()
        : (this.snapshot ? this.snapshot.toJSON() : null);
      localStorage.setItem(this._claveSnapshot(), JSON.stringify({
        modelo,
        jugadores: this.jugadores,
        hostNumero: this.hostNumero,
        soyJugador: this.miNumero,
        enPartida: this.enPartida,
        fecha: Date.now(),
      }));
    } catch (e) { /* sin almacenamiento */ }
  }

  _leerPersistido(sala) {
    try {
      const raw = localStorage.getItem(this._claveSnapshot(sala));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===== FÁBRICAS DE RED =====

  _nuevaRedHost(silencioso) {
    const red = new PeerNetwork({
      onMensaje: (datos, clave) => this._procesarMensajeHost(datos, clave),
      onConexion: () => { /* el invitado se identifica con "registro" */ },
      onDesconexion: (clave) => this._hostDesconexion(clave),
      onError: (err) => { if (!silencioso) this._mostrarErrorRed(err); },
      onRechazo: () => this.ui.toast('Sala llena: máximo 4 jugadores.', 'warning'),
    });
    red.resolverEstadoSala = () => ({
      cantidad: this.jugadores.filter((j) => j.conectado).length,
      maxJugadores: MAX_JUGADORES,
      enPartida: this.enPartida,
    });
    return red;
  }

  _nuevaRedInvitado() {
    let red;
    red = new PeerNetwork({
      onMensaje: (datos) => this._procesarMensajeInvitado(datos),
      onConexion: () => {
        red.enviar({ tipo: 'registro', nombre: this.miNombre, jugadorId: this.jugadorId });
        if (!this.enPartida && !this._reconectando) this._mostrarEspera();
      },
      onDesconexion: () => this._manejarDesconexion(),
      onError: (err) => {
        if (!this._reconectando && !this._desconectado) this._mostrarErrorRed(err);
      },
    });
    return red;
  }

  // ===== CREAR / UNIRSE =====

  async crearSala(nombre, opciones = {}) {
    const silencioso = !!opciones.silencioso;
    this.esHost = true;
    this.miNumero = 1;
    this.hostNumero = 1;
    this.miNombre = nombre || 'Jugador 1';
    this.modelo = null;
    this.snapshot = null;
    this.sala = opciones.codigo || this._generarCodigo();
    this.jugadores = [{ clave: null, numero: 1, nombre: this.miNombre, conectado: true, jugadorId: this.jugadorId }];
    this._clavePorNumero = new Map();
    this._desconectado = false;
    this._limpiarReconexion();
    this._cancelarTodasDesconexiones();

    this.red = this._nuevaRedHost(silencioso);
    try {
      const id = await this.red.crearSala(this.sala, { maxConexiones: MAX_JUGADORES - 1 });
      this.sala = id;
      this._actualizarChipConexion(true);
      this._guardarSesion('host');
      this._persistir();
      this._mostrarEspera();
      return true;
    } catch (err) {
      this.ui.cerrarModales();
      try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
      this.red = null;
      if (silencioso) throw err;
      this._mostrarErrorRed(err);
      return false;
    }
  }

  async unirse(codigo, nombre, opciones = {}) {
    const silencioso = !!opciones.silencioso;
    this.esHost = false;
    this.miNumero = 0;
    this.hostNumero = 1;
    this.miNombre = nombre || 'Jugador';
    this.sala = codigo.trim();
    this.modelo = null;
    this.snapshot = null;
    this.enPartida = false;
    this.jugadores = [];
    this._desconectado = false;
    this._limpiarReconexion();
    this._cancelarTodasDesconexiones();

    this.red = this._nuevaRedInvitado();
    this.ui.esperandoConexion(this.sala, 'Buscando la sala…');
    try {
      await this.red.unirse(this.sala);
      this._actualizarChipConexion(true);
      this._guardarSesion('invitado');
      return true;
    } catch (err) {
      this.ui.cerrarModales();
      try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
      this.red = null;
      if (silencioso) throw err;
      this._mostrarErrorRed(err);
      return false;
    }
  }

  // ===== SALAS PÚBLICAS =====

  prospectarSalasPublicas(codigos) {
    const sonda = new PeerNetwork();
    return sonda.prospectarSalas(codigos, 8000);
  }

  async entrarSalaPublica(codigo, nombre) {
    try {
      await this.unirse(codigo, nombre, { silencioso: true });
      return true;
    } catch (err) { /* sala inexistente: me convierto en anfitrión */ }

    try {
      await this.crearSala(nombre, { codigo, silencioso: true });
      return true;
    } catch (err) {
      this._mostrarErrorRed(err);
      if (this.onSalirAlInicio) this.onSalirAlInicio();
      return false;
    }
  }

  _generarCodigo() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let codigo = '';
    for (let i = 0; i < 4; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
    return `443-${codigo}`;
  }

  _mostrarErrorRed(err) {
    this._actualizarChipConexion(false);
    this.ui.toast(err && err.message ? err.message : 'Error de red', 'error');
    if (!this.enPartida) {
      this.ui.cerrarModales();
      if (this.onSalirAlInicio) this.onSalirAlInicio();
    }
  }

  _actualizarChipConexion(online) {
    const chip = document.getElementById('chip-conexion');
    if (!chip) return;
    chip.classList.remove('online', 'offline');
    chip.classList.add(online ? 'online' : 'offline');
    const txt = chip.querySelector('.txt');
    if (txt) txt.textContent = online ? 'Conectado' : 'Sin conexión';
  }

  // ===== SALA DE ESPERA (HOST) =====

  _mostrarEspera() {
    this.ui.cerrarModales();
    this.ui.mostrarEspera({
      codigo: this.sala,
      esHost: this.esHost,
      puedeIniciar: this.esHost && this.jugadores.filter((j) => j.conectado).length >= MIN_JUGADORES,
      maxJugadores: MAX_JUGADORES,
      alIniciar: () => this._iniciarPartida(),
      alSalir: () => this._salir(),
    });
    this._actualizarEspera();
  }

  _actualizarEspera() {
    const lista = this.jugadores
      .filter((j) => j.conectado)
      .map((j) => ({
        numero: j.numero,
        nombre: j.nombre,
        color: this._colorDe(j.numero),
        esHost: j.numero === this.hostNumero,
      }));
    this.ui.actualizarEspera({
      codigo: this.sala,
      jugadores: lista,
      esHost: this.esHost,
      puedeIniciar: this.esHost && lista.length >= MIN_JUGADORES,
      maxJugadores: MAX_JUGADORES,
    });
  }

  _hostDesconexion(clave) {
    const j = this.jugadores.find((x) => x.clave === clave);
    if (!j) return;
    j.conectado = false;
    this._clavePorNumero.delete(j.numero);

    if (this.enPartida && this.modelo) {
      this._iniciarDesconexion(j.numero, j.nombre);
      this._broadcast();
    } else {
      this.jugadores = this.jugadores.filter((x) => x.clave !== clave);
      this._recalcularNumeros();
      this._difundirSala();
      this._actualizarEspera();
    }
  }

  _recalcularNumeros() {
    let n = 1;
    const ocupados = new Set([this.hostNumero]);
    for (const j of this.jugadores) {
      if (j.numero === this.hostNumero) continue;
      while (ocupados.has(n)) n += 1;
      ocupados.add(n);
      j.numero = n;
    }
  }

  // Reasigna números contiguos 1..K a los jugadores activos, actualizando modelo y turnos.
  _compactarNumeros() {
    const ordenados = this.jugadores.slice().sort((a, b) => a.numero - b.numero);
    const mapa = new Map();
    let n = 1;
    for (const j of ordenados) { mapa.set(j.numero, n); n += 1; }

    const manos = {};
    for (const [viejo, mano] of Object.entries(this.modelo.manos)) {
      const nuevo = mapa.get(Number(viejo));
      if (nuevo != null) manos[nuevo] = mano;
    }
    this.modelo.manos = manos;
    this.modelo.numJugadores = ordenados.length;
    this.modelo.turno = mapa.get(this.modelo.turno) || 1;
    if (this.modelo.ganador != null && this.modelo.ganador > 0) {
      this.modelo.ganador = mapa.get(this.modelo.ganador) || this.modelo.ganador;
    }
    if (this.modelo.ultimoEvento && this.modelo.ultimoEvento.jugador) {
      const ev = mapa.get(this.modelo.ultimoEvento.jugador);
      if (ev) this.modelo.ultimoEvento.jugador = ev;
    }

    const nuevasClaves = new Map();
    for (const j of ordenados) {
      const nuevo = mapa.get(j.numero);
      const clave = this._clavePorNumero.get(j.numero);
      j.numero = nuevo;
      if (clave != null) nuevasClaves.set(nuevo, clave);
    }
    this._clavePorNumero = nuevasClaves;
    this.miNumero = mapa.get(this.miNumero) || this.miNumero;
    this.hostNumero = this.miNumero;
    this.jugadores = ordenados;
  }

  _iniciarPartida() {
    if (!this.esHost) return;
    const conectados = this.jugadores.filter((j) => j.conectado);
    if (conectados.length < MIN_JUGADORES) {
      this.ui.toast('Se necesitan al menos 2 jugadores.', 'warning');
      return;
    }
    this.modelo = new CardGameModel(conectados.length);
    this.snapshot = CardGameModel.fromJSON(this.modelo.toJSON());
    this.enPartida = true;
    this._ganadorNotificado = null;
    this.hostNumero = this.miNumero;

    this._clavePorNumero = new Map();
    for (const j of conectados) {
      if (j.numero !== this.miNumero) this._clavePorNumero.set(j.numero, j.clave);
    }

    this.ui.cerrarModales();
    this._difundirInicio();
    this._broadcast();
  }

  _difundirInicio() {
    const completo = this.modelo ? this.modelo.toJSON() : null;
    for (const j of this.jugadores) {
      if (j.numero === this.miNumero || !j.conectado || !j.clave) continue;
      this.red.enviarA(j.clave, { tipo: 'inicio', estado: this._estadoPara(j.numero, completo) });
    }
  }

  _difundirSala() {
    const conectados = this.jugadores.filter((j) => j.conectado);
    for (const j of conectados) {
      if (j.numero === this.miNumero || !j.clave) continue;
      this.red.enviarA(j.clave, {
        tipo: 'sala',
        soyJugador: j.numero,
        hostNumero: this.hostNumero,
        maxJugadores: MAX_JUGADORES,
        jugadores: conectados.map((k) => ({
          numero: k.numero,
          nombre: k.nombre,
          color: this._colorDe(k.numero),
          esHost: k.numero === this.hostNumero,
        })),
      });
    }
  }

  // ===== MENSAJES (HOST) =====

  _procesarMensajeHost(datos, clave) {
    if (!datos) return;

    if (datos.tipo === 'registro') {
      const jid = datos.jugadorId || null;
      const existente = jid ? this.jugadores.find((j) => j.jugadorId === jid) : null;

      if (existente) {
        const estabaDesconectado = existente.conectado === false;
        existente.clave = clave;
        existente.conectado = true;
        if (datos.nombre) existente.nombre = datos.nombre;
        this._clavePorNumero.set(existente.numero, clave);
        this._cancelarDesconexion(existente.numero);
        if (estabaDesconectado) this.ui.toast(`${existente.nombre} se reconectó.`, 'success');
        if (this.enPartida && this.modelo) {
          this.red.enviarA(clave, {
            tipo: 'estado',
            estado: this._estadoPara(existente.numero, this.modelo.toJSON()),
          });
          this._broadcast();
        } else {
          this._difundirSala();
          this._actualizarEspera();
        }
        return;
      }

      if (this.enPartida) {
        this.red.enviarA(clave, { tipo: 'rechazado', razon: 'partida' });
        setTimeout(() => { if (this.red) this.red.cerrarConexion(clave); }, 200);
        return;
      }
      if (this.jugadores.filter((j) => j.conectado).length >= MAX_JUGADORES) {
        this.red.enviarA(clave, { tipo: 'rechazado', razon: 'llena' });
        return;
      }
      const numero = this._siguienteNumero();
      this.jugadores.push({
        clave,
        numero,
        nombre: datos.nombre || `Jugador ${numero}`,
        conectado: true,
        jugadorId: jid || this._nuevoJugadorId(),
      });
      this.jugadores.sort((a, b) => a.numero - b.numero);
      this._difundirSala();
      this._actualizarEspera();
      return;
    }

    const jugador = this.jugadores.find((j) => j.clave === clave);
    if (!jugador) return;

    if (datos.tipo === 'accion') {
      this._ejecutarAccion(jugador.numero, datos);
      return;
    }
    if (datos.tipo === 'reiniciar') {
      this._ejecutarReinicio();
      return;
    }
    if (datos.tipo === 'abandonar') {
      this._hostDesconexion(clave);
      this._expirarDesconexion(jugador.numero);
      return;
    }
  }

  _siguienteNumero() {
    const usados = new Set(this.jugadores.map((j) => j.numero));
    for (let n = 1; n <= MAX_JUGADORES; n++) {
      if (!usados.has(n)) return n;
    }
    return MAX_JUGADORES;
  }

  // ===== MENSAJES (INVITADO) =====

  _procesarMensajeInvitado(datos) {
    if (!datos) return;
    if (datos.tipo === 'sala') {
      this.miNumero = datos.soyJugador;
      if (datos.hostNumero) this.hostNumero = datos.hostNumero;
      this._limpiarReconexion();
      this.ui.cerrarModales();
      this.ui.actualizarEspera({
        codigo: this.sala,
        jugadores: datos.jugadores || [],
        esHost: false,
        puedeIniciar: false,
        maxJugadores: datos.maxJugadores || MAX_JUGADORES,
      });
      return;
    }
    if (datos.tipo === 'inicio') {
      this.enPartida = true;
      this.ui.cerrarModales();
      this._aplicarEstado(datos.estado);
      return;
    }
    if (datos.tipo === 'estado') {
      this._aplicarEstado(datos.estado);
      return;
    }
    if (datos.tipo === 'rechazado') {
      this._desconectado = true;
      this._borrarSesion();
      this.ui.cerrarModales();
      try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
      this.red = null;
      if (datos.razon === 'partida') {
        this.ui.alerta('Partida en curso', 'Esa sala ya tiene una partida en curso. Intenta con otra.');
      } else {
        this.ui.alerta('Sala llena', 'Esta sala ya tiene 4 jugadores. Intenta con otro código.');
      }
      if (this.onSalirAlInicio) this.onSalirAlInicio();
      return;
    }
    if (datos.tipo === 'error') {
      this.ui.toast(datos.mensaje, 'error');
    }
  }

  // ===== ESTADO =====

  _estadoPara(numero, completo) {
    const m = this.modelo || this.snapshot;
    const activos = m ? Object.keys(m.manos).map(Number) : [];
    const jugadores = (this.jugadores || [])
      .slice()
      .sort((a, b) => a.numero - b.numero)
      .map((j) => ({
        numero: j.numero,
        nombre: j.nombre,
        color: this._colorDe(j.numero),
        esHost: j.numero === this.hostNumero,
        conectado: j.conectado !== false,
        jugadorId: j.jugadorId || null,
        cartas: m && m.manos[j.numero] ? m.manos[j.numero].length : 0,
        esTurno: m ? m.turno === j.numero && !m.ganador : false,
        esGanador: m ? m.ganador === j.numero : false,
      }));

    const completoJson = completo !== undefined ? completo : (m ? m.toJSON() : null);

    return {
      sala: this.sala,
      soyJugador: numero,
      hostNumero: this.hostNumero,
      numJugadores: activos.length,
      jugadores,
      mazoCount: m ? m.mazo.length : 0,
      descarteTop: m && m.descarte.length > 0 ? m.descarte[m.descarte.length - 1].toJSON() : null,
      descarteCount: m ? m.descarte.length : 0,
      mano: (m && m.manos[numero] ? m.manos[numero] : []).map((c) => c.toJSON()),
      turno: m ? m.turno : 1,
      fase: m ? m.fase : 'robar',
      ganador: m ? m.ganador : null,
      descripcionCanto: m && m.ganador != null && m.ganador > 0 ? this._combinacionDe(m.ganador) : [],
      puede443: m
        ? (m.turno === numero && m.fase === 'decidir' && CardGameModel.validar443(m.manos[numero]))
        : false,
      completo: completoJson,
    };
  }

  _aplicarEstado(datos) {
    const estado = this._hidratarEstado(datos);
    this._limpiarReconexion();
    this.vista.render(estado);
    this._detectarDesconectados(estado);
    this._notificarTurno(estado);
    this._detectarFinPartida(estado);
  }

  _hidratarEstado(datos) {
    if (datos.completo) this.snapshot = CardGameModel.fromJSON(datos.completo);
    if (datos.hostNumero) this.hostNumero = datos.hostNumero;

    if (!this.esHost) {
      if (typeof datos.soyJugador === 'number' && datos.soyJugador > 0) this.miNumero = datos.soyJugador;
      if (Array.isArray(datos.jugadores)) this.jugadores = datos.jugadores;
      this.enPartida = true;
      this._persistir();
    }

    const soy = datos.soyJugador;
    const m = this.modelo || this.snapshot;
    const miMano = m && m.manos[soy]
      ? m.manos[soy]
      : (datos.mano || []).map((c) => Card.fromJSON(c));

    return {
      sala: datos.sala,
      soyJugador: soy,
      hostNumero: this.hostNumero,
      numJugadores: datos.numJugadores,
      jugadores: datos.jugadores || [],
      mazoCount: datos.mazoCount,
      descarteTop: datos.descarteTop ? Card.fromJSON(datos.descarteTop) : null,
      descarteCount: datos.descarteCount || 0,
      manos: { [soy]: miMano },
      turno: datos.turno,
      fase: datos.fase,
      ganador: datos.ganador,
      descripcionCanto: datos.descripcionCanto || [],
      puede443: !!datos.puede443,
      esHost: this.esHost,
    };
  }

  _notificarTurno(estado) {
    if (estado.ganador != null) return;
    if (estado.turno === estado.soyJugador && estado.fase === 'robar') {
      this.audio.turno();
    }
  }

  _detectarDesconectados(estado) {
    if (!this.enPartida || estado.ganador != null) {
      this._cerrarModalDesconectado();
      return;
    }
    const desco = (estado.jugadores || []).find(
      (j) => j.conectado === false && j.numero !== estado.soyJugador
    );
    if (desco) this._mostrarModalDesconectado(desco.nombre);
    else this._cerrarModalDesconectado();
  }

  _detectarFinPartida(estado) {
    if (estado.ganador == null) {
      this._ganadorNotificado = null;
      return;
    }
    if (estado.ganador === this._ganadorNotificado) return;
    this._ganadorNotificado = estado.ganador;

    if (estado.ganador === 0) {
      this._confeti(false);
      this.audio.empate();
      setTimeout(() => {
        const continuar = () => {
          if (this.esHost) this._ejecutarReinicio();
          else if (this.red) this.red.enviar({ tipo: 'reiniciar' });
        };
        this.ui.notificarEmpate().then((r) => { if (r.isConfirmed) continuar(); });
      }, 600);
    } else {
      const ganador = estado.jugadores.find((j) => j.numero === estado.ganador);
      const nombre = ganador ? ganador.nombre : 'Jugador';
      const color = ganador ? ganador.color : '#fbbf24';
      const descripcion = estado.descripcionCanto || [];
      this._confeti(true);
      if (estado.ganador === estado.soyJugador) this.audio.victoria();
      setTimeout(() => {
        this.ui.notificarVictoria(nombre, estado.ganador, color, descripcion).then(() => {
          this.ui.cerrarModales();
        });
      }, 500);
    }
  }

  _combinacionDe(jugador) {
    const m = this.modelo || this.snapshot;
    if (!m || !m.manos[jugador]) return [];
    const combo = CardGameModel.encontrarCombinacion(m.manos[jugador]);
    return combo ? combo.descripcion : [];
  }

  _confeti(ganar) {
    if (!window.confetti) return;
    const origen = { x: Math.random() * 0.6 + 0.2, y: 0.6 };
    window.confetti({
      particleCount: ganar ? 170 : 40,
      spread: 80,
      origin: origen,
      colors: ['#e6b84d', '#38bdf8', '#4ade80', '#f472b6', '#f8fafc'],
    });
    if (ganar) {
      setTimeout(() => {
        window.confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#e6b84d', '#4ade80', '#38bdf8'] });
        window.confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#e6b84d', '#4ade80', '#38bdf8'] });
      }, 350);
    }
  }

  // ===== ACCIONES =====

  _pedirAccion(accion, extras = {}) {
    const paquete = { accion, ...extras };

    if (this.esHost) {
      this._ejecutarAccion(this.miNumero, paquete);
      return;
    }
    if (!this.red) return;
    this.red.enviar({ tipo: 'accion', ...paquete });
  }

  _repartirNuevaMano(jugador) {
    if (jugador === this.miNumero && (this.modelo || this.snapshot)) {
      const m = this.modelo || this.snapshot;
      this.vista.nuevaMano(m.manos[jugador]);
    }
  }

  _ejecutarAccion(jugador, datos) {
    if (!this.modelo || this.modelo.ganador != null) return;
    if (this.modelo.turno !== jugador) {
      this._errorAccion(jugador, 'Aún no es tu turno');
      return;
    }

    const accion = datos.accion;

    if (accion === 'robarMazo') {
      const carta = this.modelo.robarDelMazo(jugador);
      if (carta) { this.audio.robar(); this._repartirNuevaMano(jugador); }
      else this._finSinCartas();
    } else if (accion === 'robarDescarte') {
      const carta = this.modelo.robarDelDescarte(jugador);
      if (carta) { this.audio.robar(); this._repartirNuevaMano(jugador); }
      else this._errorAccion(jugador, 'El descarte está vacío');
    } else if (accion === 'botar') {
      const carta = this.modelo.botar(jugador, datos.cartaId);
      if (carta) { this.audio.botar(); this._repartirNuevaMano(jugador); }
      else this._errorAccion(jugador, 'Carta no válida en tu mano');
    } else if (accion === 'cantar') {
      const gano = this.modelo.cantar443(jugador);
      if (gano) {
        this._repartirNuevaMano(jugador);
        if (jugador === this.miNumero) this.audio.victoria();
      } else {
        this._errorAccion(jugador, 'Aún no formas un 4-4-3 válido');
      }
    }

    this._broadcast();
  }

  _errorAccion(jugador, mensaje) {
    if (this.esHost && jugador !== this.miNumero) {
      const clave = this._clavePorNumero && this._clavePorNumero.get(jugador);
      if (clave) this.red.enviarA(clave, { tipo: 'error', mensaje });
    }
    if (jugador === this.miNumero) {
      this.ui.toast(mensaje, 'error');
    }
  }

  _finSinCartas() {
    this.modelo.fase = 'fin';
    this.modelo.ganador = 0;
  }

  _broadcast() {
    const completo = this.modelo ? this.modelo.toJSON() : null;
    this._aplicarEstado(this._estadoPara(this.miNumero, completo));
    this._persistir();
    if (!this.esHost || !this.red) return;
    for (const j of this.jugadores) {
      if (j.numero === this.miNumero || !j.conectado || !j.clave) continue;
      this.red.enviarA(j.clave, { tipo: 'estado', estado: this._estadoPara(j.numero, completo) });
    }
  }

  // ===== REINICIO =====

  _pedirReinicio() {
    if (this.esHost) {
      this.ui.confirmarReinicio().then((r) => { if (r.isConfirmed) this._ejecutarReinicio(); });
    } else if (this.red) {
      this.red.enviar({ tipo: 'reiniciar' });
    }
  }

  _ejecutarReinicio() {
    if (!this.modelo) return;
    this.modelo.resetear();
    this.snapshot = CardGameModel.fromJSON(this.modelo.toJSON());
    this._ganadorNotificado = null;
    this.vista.limpiarSeleccion();
    this.vista.reiniciarMano(this.modelo.manos[this.miNumero]);
    this.audio.mezclar([392, 523.25, 659.25], 0.12, 0);
    this._broadcast();
  }

  // ===== DESCONEXIÓN DE JUGADORES (HOST) =====

  _iniciarDesconexion(numero, nombre) {
    this._cancelarDesconexion(numero);
    const timer = setTimeout(() => {
      this._desconectados.delete(numero);
      this._expirarDesconexion(numero);
    }, ESPERA_RECONEXION);
    this._desconectados.set(numero, { timer, nombre });
  }

  _cancelarDesconexion(numero) {
    const d = this._desconectados.get(numero);
    if (d) {
      clearTimeout(d.timer);
      this._desconectados.delete(numero);
    }
  }

  _cancelarTodasDesconexiones() {
    for (const numero of Array.from(this._desconectados.keys())) {
      this._cancelarDesconexion(numero);
    }
  }

  _expirarDesconexion(numero) {
    this._cancelarDesconexion(numero);
    if (!this.esHost || !this.modelo) return;
    const j = this.jugadores.find((x) => x.numero === numero);
    if (!j || j.conectado) return;

    this.modelo.quitarJugador(numero);

    if (Object.keys(this.modelo.manos).length < MIN_JUGADORES) {
      this.modelo.fase = 'fin';
      this.modelo.ganador = 0;
      this.jugadores = this.jugadores.filter((x) => x.numero !== numero);
      this._broadcast();
      this.ui.toast(`${j.nombre} no volvió. La partida termina.`, 'warning');
      return;
    }

    this.jugadores = this.jugadores.filter((x) => x.numero !== numero);
    this._compactarNumeros();
    this._broadcast();
    this.ui.toast(`${j.nombre} no volvió y salió de la partida.`, 'warning');
  }

  _mostrarModalDesconectado(nombre) {
    if (this._modalDesconectadoAbierto === nombre) return;
    this._modalDesconectadoAbierto = nombre;
    this.ui.mostrarJugadorDesconectado({
      nombre,
      segundos: this.esHost ? Math.round(ESPERA_RECONEXION / 1000) : null,
      alSalir: () => this._salir(),
    });
  }

  _cerrarModalDesconectado() {
    if (!this._modalDesconectadoAbierto) return;
    this._modalDesconectadoAbierto = false;
    this.ui.cerrarModalDesconectado();
  }

  // ===== RECONEXIÓN / MIGRACIÓN (INVITADO) =====

  _manejarDesconexion() {
    if (this._desconectado) return;
    if (this._reconectando) return;
    this._hostPerdido();
  }

  _hostPerdido() {
    if (this._reconectando) return;
    try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
    this.red = null;
    this._reconectando = { desde: Date.now(), migrando: false, timer: null };
    this.ui.mostrarReconexion(
      this.enPartida
        ? 'Se perdió la conexión con la sala. Reintentando…'
        : 'Se perdió la conexión con el anfitrión. Reintentando…'
    );
    this._programarReintento();
  }

  _abandonarPorFalla() {
    this._limpiarReconexion();
    this._desconectado = true;
    this._borrarSesion();
    this.ui.cerrarModales();
    this.ui.notificarDesconexion().then(() => {
      if (this.onSalirAlInicio) this.onSalirAlInicio();
    });
  }

  _programarReintento() {
    const ctx = this._reconectando;
    if (!ctx) return;
    ctx.timer = setTimeout(async () => {
      if (this._reconectando !== ctx) return;
      const transcurrido = Date.now() - ctx.desde;

      const volvio = await this._reintentarComoInvitado(ctx);
      if (this._reconectando !== ctx) return;
      if (volvio) {
        this._reconectarExito();
        return;
      }

      if (transcurrido >= ESPERA_RECONEXION && !ctx.migrando && this._puedoMigrar()) {
        ctx.migrando = true;
        const asumio = await this._intentarMigrar();
        if (this._reconectando !== ctx) return;
        if (asumio) {
          this._migrarExito();
          return;
        }
        ctx.migrando = false;
      }

      if (transcurrido >= ESPERA_RECONEXION && !this.enPartida) {
        this._abandonarPorFalla();
        return;
      }

      this._programarReintento();
    }, INTERVALO_RECONEXION);
  }

  async _reintentarComoInvitado(ctx) {
    if (this._reconectando !== ctx || ctx.migrando) return false;
    const red = this._nuevaRedInvitado();
    this.red = red;
    try {
      await red.unirse(this.sala);
    } catch (err) {
      try { red.cerrar(); } catch (e) { /* ignorar */ }
      if (this.red === red) this.red = null;
      return false;
    }
    if (this._reconectando !== ctx) {
      try { red.cerrar(); } catch (e) { /* ignorar */ }
      if (this.red === red) this.red = null;
      return false;
    }
    return true;
  }

  _puedoMigrar() {
    if (!this.snapshot) return false;
    const candidatos = (this.jugadores || [])
      .filter((j) => j.conectado !== false && j.numero !== this.hostNumero && j.numero > 0)
      .map((j) => j.numero)
      .sort((a, b) => a - b);
    return candidatos.length > 0 && candidatos[0] === this.miNumero;
  }

  async _intentarMigrar() {
    const sala = this.sala;
    const red = this._nuevaRedHost(true);
    try {
      await red.crearSala(sala, { maxConexiones: MAX_JUGADORES - 1 });
    } catch (err) {
      try { red.cerrar(); } catch (e) { /* ignorar */ }
      return false;
    }

    this.red = red;
    this.esHost = true;
    this.hostNumero = this.miNumero;
    this.modelo = this.snapshot ? CardGameModel.fromJSON(this.snapshot.toJSON()) : null;
    if (!this.modelo) {
      try { red.cerrar(); } catch (e) { /* ignorar */ }
      this.red = null;
      this.esHost = false;
      return false;
    }
    this.enPartida = true;
    this._clavePorNumero = new Map();
    for (const j of this.jugadores) {
      if (j.numero === this.miNumero) {
        j.clave = null;
        j.conectado = true;
      } else {
        j.clave = null;
        j.conectado = false;
      }
    }
    this._guardarSesion('host');
    this._persistir();
    return true;
  }

  _migrarExito() {
    this._limpiarReconexion();
    this.ui.cerrarModales();
    this.ui.toast('Eres el nuevo anfitrión de la sala.', 'success');
    this._broadcast();
    for (const j of this.jugadores) {
      if (j.numero !== this.miNumero) this._iniciarDesconexion(j.numero, j.nombre);
    }
  }

  _reconectarExito() {
    this._limpiarReconexion();
    this.ui.toast('Reconectado.', 'success');
  }

  _limpiarReconexion() {
    if (this._reconectando) {
      if (this._reconectando.timer) clearTimeout(this._reconectando.timer);
      this._reconectando = null;
    }
    this.ui.cerrarModalReconexion();
  }

  // ===== REANUDAR SESIÓN AL CARGAR =====

  async reanudarSesion(sesion) {
    if (!sesion || !sesion.sala) return false;
    if (sesion.jugadorId) this.jugadorId = sesion.jugadorId;
    if (sesion.nombre) this.miNombre = sesion.nombre;
    this.sala = sesion.sala;
    if (sesion.rol === 'host') return this._reanudarComoHost(sesion.sala);
    return this._reanudarComoInvitado(sesion.sala);
  }

  async _reanudarComoHost(sala) {
    const guardado = this._leerPersistido(sala);
    if (!guardado || !guardado.modelo) {
      this._borrarSesion();
      return false;
    }

    this.esHost = true;
    this.miNumero = guardado.soyJugador || 1;
    this.hostNumero = this.miNumero;
    this.sala = sala;
    this.jugadores = (guardado.jugadores || []).map((j) => ({
      ...j,
      clave: j.numero === this.miNumero ? null : (j.clave || null),
    }));
    if (!this.jugadores.some((j) => j.numero === this.miNumero)) {
      this.jugadores.unshift({
        clave: null,
        numero: this.miNumero,
        nombre: this.miNombre,
        conectado: true,
        jugadorId: this.jugadorId,
      });
    }
    for (const j of this.jugadores) {
      j.conectado = j.numero === this.miNumero;
      if (j.numero === this.miNumero && !j.jugadorId) j.jugadorId = this.jugadorId;
    }
    this.modelo = CardGameModel.fromJSON(guardado.modelo);
    this.snapshot = CardGameModel.fromJSON(guardado.modelo);
    this.enPartida = !!guardado.enPartida;
    this._ganadorNotificado = this.modelo ? this.modelo.ganador : null;
    this._clavePorNumero = new Map();
    this._desconectado = false;
    this._limpiarReconexion();

    this.ui.esperandoConexion(sala, 'Restaurando tu sala…');
    let ultimoErr = null;
    for (let intento = 0; intento < 4; intento++) {
      const red = this._nuevaRedHost(true);
      try {
        await red.crearSala(sala, { maxConexiones: MAX_JUGADORES - 1 });
        this.red = red;
        ultimoErr = null;
        break;
      } catch (err) {
        ultimoErr = err;
        try { red.cerrar(); } catch (e) { /* ignorar */ }
        await this._esperar(700 + intento * 700);
      }
    }

    if (ultimoErr) {
      // No pude reclamar el código: probablemente otro asumió como anfitrión.
      return this._reanudarComoInvitado(sala);
    }

    this._actualizarChipConexion(true);
    this._guardarSesion('host');
    this._persistir();

    if (this.enPartida && this.modelo) {
      this.ui.cerrarModales();
      this._broadcast();
      for (const j of this.jugadores) {
        if (j.numero !== this.miNumero) this._iniciarDesconexion(j.numero, j.nombre);
      }
    } else {
      this._mostrarEspera();
    }
    return true;
  }

  async _reanudarComoInvitado(sala) {
    const guardado = this._leerPersistido(sala);
    this.esHost = false;
    this.sala = sala;
    if (guardado) {
      this.miNumero = guardado.soyJugador || 0;
      this.hostNumero = guardado.hostNumero || 1;
      this.jugadores = guardado.jugadores || [];
      this.snapshot = guardado.modelo ? CardGameModel.fromJSON(guardado.modelo) : null;
      this.enPartida = !!guardado.enPartida && !!this.snapshot;
    }
    this._ganadorNotificado = this.snapshot ? this.snapshot.ganador : null;
    this._desconectado = false;
    this._limpiarReconexion();

    if (this.enPartida && this.snapshot) {
      const datos = this._estadoPara(this.miNumero, this.snapshot.toJSON());
      this.vista.render(this._hidratarEstado(datos));
    }

    this.red = this._nuevaRedInvitado();
    this.ui.esperandoConexion(sala, 'Reconectando con la sala…');
    try {
      await this.red.unirse(sala);
      this._actualizarChipConexion(true);
      this._guardarSesion('invitado');
      return true;
    } catch (err) {
      try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
      this.red = null;
      this._reconectando = { desde: Date.now(), migrando: false, timer: null };
      this.ui.esperandoConexion(sala, 'Buscando al anfitrión…');
      this._programarReintento();
      return true;
    }
  }

  // ===== SALIR =====

  async salir() {
    const r = await this.ui.confirmarSalir();
    if (r && !r.isConfirmed) return;
    this._salir();
  }

  _salir() {
    this._limpiarReconexion();
    this._cancelarTodasDesconexiones();
    if (!this.esHost && this.red) {
      try { this.red.enviar({ tipo: 'abandonar' }); } catch (e) { /* ignorar */ }
    }
    this.ui.cerrarModales();
    if (this.red) this.red.cerrar();
    this.red = null;
    this.enPartida = false;
    this.jugadores = [];
    this.modelo = null;
    this.snapshot = null;
    this._borrarSesion();
    this._actualizarChipConexion(false);
    if (this.onSalirAlInicio) this.onSalirAlInicio();
  }
}
