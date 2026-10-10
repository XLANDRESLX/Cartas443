import { CardGameModel, MIN_JUGADORES, MAX_JUGADORES } from '../models/CardGameModel.js';
import { Card } from '../models/Card.js';
import { PeerNetwork } from '../network/PeerNetwork.js';
import { UIControlsView } from '../views/UIControlsView.js';
import { BoardView } from '../views/BoardView.js';
import { AudioView } from '../views/AudioView.js';

const COLORES = ['#fbbf24', '#38bdf8', '#f472b6', '#a3e635'];

export class GameController {
  constructor() {
    this.vista = new BoardView();
    this.ui = new UIControlsView();
    this.audio = new AudioView();

    this.red = null;
    this.modelo = null;
    this.esHost = false;
    this.miNumero = 1;
    this.sala = '';
    this.miNombre = '';
    this.enPartida = false;
    this.onSalirAlInicio = null;

    // Host: jugadores registrados
    this.jugadores = []; // [{ clave, numero, nombre, conectado }]
    this.turnos = null;

    this._ganadorNotificado = null;
    this._desconectado = false;

    this.vista.configurarAcciones({
      robarMazo: () => this._pedirAccion('robarMazo'),
      robarDescarte: () => this._pedirAccion('robarDescarte'),
      botar: (cartaId) => this._pedirAccion('botar', { cartaId }),
      cantar: () => this._pedirAccion('cantar'),
      seleccionarCarta: (id) => this.vista.seleccionarCarta(id),
      sacarDeZona: (indice, id) => this.vista.sacarDeZona(indice, id),
      reiniciar: () => this._pedirReinicio(),
    });
  }

  get maxJugadores() {
    return MAX_JUGADORES;
  }

  _colorDe(numero) {
    return COLORES[(numero - 1) % COLORES.length];
  }

  // ===== CREAR / UNIRSE =====

  async crearSala(nombre, opciones = {}) {
    const silencioso = !!opciones.silencioso;
    this.esHost = true;
    this.miNumero = 1;
    this.miNombre = nombre || 'Jugador 1';
    this.modelo = null;
    this.sala = opciones.codigo || this._generarCodigo();
    this.jugadores = [{ clave: null, numero: 1, nombre: this.miNombre, conectado: true }];
    this._desconectado = false;

    this.red = new PeerNetwork({
      onMensaje: (datos, clave) => this._procesarMensajeHost(datos, clave),
      onConexion: () => { /* espera registro */ },
      onDesconexion: (clave) => this._hostDesconexion(clave),
      onError: (err) => { if (!silencioso) this._mostrarErrorRed(err); },
      onRechazo: () => this.ui.toast('Sala llena: máximo 4 jugadores.', 'warning'),
    });
    this.red.resolverEstadoSala = () => ({
      cantidad: this.jugadores.filter((j) => j.conectado).length,
      maxJugadores: MAX_JUGADORES,
      enPartida: this.enPartida,
    });

    try {
      const id = await this.red.crearSala(this.sala, { maxConexiones: MAX_JUGADORES - 1 });
      this.sala = id;
      this._actualizarChipConexion(true);
      this._mostrarEspera();
      return true;
    } catch (err) {
      this.ui.cerrarModales();
      try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
      if (silencioso) throw err;
      this._mostrarErrorRed(err);
      return false;
    }
  }

  async unirse(codigo, nombre, opciones = {}) {
    const silencioso = !!opciones.silencioso;
    this.esHost = false;
    this.miNumero = 0; // se asigna en la bienvenida
    this.miNombre = nombre || 'Jugador';
    this.sala = codigo.trim();
    this._desconectado = false;

    this.red = new PeerNetwork({
      onMensaje: (datos) => this._procesarMensajeInvitado(datos),
      onConexion: () => {
        this.red.enviar({ tipo: 'registro', nombre: this.miNombre });
        this._mostrarEspera();
      },
      onDesconexion: () => this._manejarDesconexion(),
      onError: (err) => { if (!silencioso) this._mostrarErrorRed(err); },
    });

    this.ui.esperandoConexion(this.sala);
    try {
      await this.red.unirse(this.sala);
      this._actualizarChipConexion(true);
      return true;
    } catch (err) {
      this.ui.cerrarModales();
      try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
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
    // Si hay anfitrión, me uno; si la sala está vacía, la abro yo.
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
    // Cierra cualquier modal abierto (carga, etc.) antes de mostrar el overlay.
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
        esHost: j.numero === 1,
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
    if (this.enPartida) {
      this._manejarDesconexion();
      return;
    }
    this.jugadores = this.jugadores.filter((j) => j.clave !== clave);
    this._recalcularNumeros();
    this._difundirSala();
    this._actualizarEspera();
  }

  _recalcularNumeros() {
    // Mantener host como 1 y renumerar invitados 2..N
    let n = 1;
    for (const j of this.jugadores) {
      if (j.numero === 1) continue;
      n += 1;
      j.numero = n;
    }
  }

  _iniciarPartida() {
    if (!this.esHost) return;
    const conectados = this.jugadores.filter((j) => j.conectado);
    if (conectados.length < MIN_JUGADORES) {
      this.ui.toast('Se necesitan al menos 2 jugadores.', 'warning');
      return;
    }
    this.modelo = new CardGameModel(conectados.length);
    this.enPartida = true;
    this._ganadorNotificado = null;

    // Mapear números a claves
    this._clavePorNumero = new Map();
    for (const j of conectados) {
      if (j.numero !== 1) this._clavePorNumero.set(j.numero, j.clave);
    }

    this.ui.cerrarModales();
    this._difundirInicio();
    this._aplicarEstado(this._estadoPara(1));
  }

  _difundirInicio() {
    for (const j of this.jugadores) {
      if (j.numero === 1 || !j.conectado) continue;
      this.red.enviarA(j.clave, {
        tipo: 'inicio',
        estado: this._estadoPara(j.numero),
      });
    }
  }

  _difundirSala() {
    const conectados = this.jugadores.filter((j) => j.conectado);
    for (const j of conectados) {
      if (j.numero === 1) continue;
      this.red.enviarA(j.clave, {
        tipo: 'sala',
        soyJugador: j.numero,
        maxJugadores: MAX_JUGADORES,
        jugadores: conectados.map((k) => ({
          numero: k.numero,
          nombre: k.nombre,
          color: this._colorDe(k.numero),
          esHost: k.numero === 1,
        })),
      });
    }
  }

  // ===== MENSAJES HOST =====

  _procesarMensajeHost(datos, clave) {
    if (!datos) return;

    if (datos.tipo === 'registro') {
      if (this.enPartida) {
        this.red.enviarA(clave, { tipo: 'rechazado', razon: 'partida' });
        setTimeout(() => { if (this.red) this.red.cerrarConexion(clave); }, 200);
        return;
      }
      const yaExiste = this.jugadores.some((j) => j.clave === clave);
      if (!yaExiste) {
        if (this.jugadores.filter((j) => j.conectado).length >= MAX_JUGADORES) {
          this.red.enviarA(clave, { tipo: 'rechazado', razon: 'llena' });
          return;
        }
        const numero = this._siguienteNumero();
        this.jugadores.push({ clave, numero, nombre: datos.nombre || `Jugador ${numero}`, conectado: true });
        this.jugadores.sort((a, b) => a.numero - b.numero);
      } else {
        const j = this.jugadores.find((x) => x.clave === clave);
        j.conectado = true;
        j.nombre = datos.nombre || j.nombre;
      }
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
  }

  _siguienteNumero() {
    const usados = new Set(this.jugadores.map((j) => j.numero));
    for (let n = 2; n <= MAX_JUGADORES; n++) {
      if (!usados.has(n)) return n;
    }
    return MAX_JUGADORES;
  }

  // ===== MENSAJES INVITADO =====

  _procesarMensajeInvitado(datos) {
    if (!datos) return;
    if (datos.tipo === 'sala') {
      this.miNumero = datos.soyJugador;
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
      this.ui.cerrarModales();
      try { if (this.red) this.red.cerrar(); } catch (e) { /* ignorar */ }
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

  _estadoPara(numero) {
    const conectados = this.jugadores.filter((j) => j.conectado);
    const jugadores = conectados.map((j) => ({
      numero: j.numero,
      nombre: j.numero === 1 ? this.miNombre : j.nombre,
      color: this._colorDe(j.numero),
      esHost: j.numero === 1,
      cartas: this.modelo.manos[j.numero] ? this.modelo.manos[j.numero].length : 0,
      esTurno: this.modelo.turno === j.numero && !this.modelo.ganador,
      esGanador: this.modelo.ganador === j.numero,
    }));

    return {
      sala: this.sala,
      soyJugador: numero,
      numJugadores: conectados.length,
      jugadores,
      mazoCount: this.modelo.mazo.length,
      descarteTop: this.modelo.descarte.length > 0
        ? this.modelo.descarte[this.modelo.descarte.length - 1].toJSON()
        : null,
      descarteCount: this.modelo.descarte.length,
      mano: (this.modelo.manos[numero] || []).map((c) => c.toJSON()),
      turno: this.modelo.turno,
      fase: this.modelo.fase,
      ganador: this.modelo.ganador,
      descripcionCanto: this.modelo.ganador != null && this.modelo.ganador > 0
        ? this._combinacionDe(this.modelo.ganador)
        : [],
      puede443:
        this.modelo.turno === numero &&
        this.modelo.fase === 'decidir' &&
        CardGameModel.validar443(this.modelo.manos[numero]),
    };
  }

  _aplicarEstado(datos) {
    const estado = this._hidratarEstado(datos);
    this.vista.render(estado);
    this._notificarTurno(estado);
    this._detectarFinPartida(estado);
  }

  _hidratarEstado(datos) {
    return {
      sala: datos.sala,
      soyJugador: datos.soyJugador,
      numJugadores: datos.numJugadores,
      jugadores: datos.jugadores || [],
      mazoCount: datos.mazoCount,
      descarteTop: datos.descarteTop ? Card.fromJSON(datos.descarteTop) : null,
      descarteCount: datos.descarteCount || 0,
      manos: { [datos.soyJugador]: (datos.mano || []).map((c) => Card.fromJSON(c)) },
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
    if (!this.modelo || !this.modelo.manos[jugador]) return [];
    const combo = CardGameModel.encontrarCombinacion(this.modelo.manos[jugador]);
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
    if (accion === 'cantar') paquete.zonas = this.vista.obtenerZonasIds();

    if (this.esHost) {
      this._ejecutarAccion(1, paquete);
      return;
    }
    if (!this.red) return;
    this.red.enviar({ tipo: 'accion', ...paquete });
  }

  _repartirNuevaMano(jugador) {
    if (jugador === this.miNumero && this.modelo) {
      this.vista.nuevaMano(this.modelo.manos[jugador]);
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
      const zonas = (datos.zonas || []).map((z) => z.map((c) => (typeof c === 'string' ? c : c.id)));
      const gano = this.modelo.cantar443(jugador, zonas);
      if (gano) {
        this._repartirNuevaMano(jugador);
        if (jugador === this.miNumero) this.audio.victoria();
      }
      else this._errorAccion(jugador, 'Aún no formas un 4-4-3 válido');
    }

    this._broadcast();
  }

  _errorAccion(jugador, mensaje) {
    // Informar al jugador que cometió el error (no a todos).
    if (this.esHost && jugador !== 1) {
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
    this._aplicarEstado(this._estadoPara(1));
    if (!this.esHost || !this.red) return;
    for (const j of this.jugadores) {
      if (j.numero === 1 || !j.conectado) continue;
      this.red.enviarA(j.clave, { tipo: 'estado', estado: this._estadoPara(j.numero) });
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
    this._ganadorNotificado = null;
    this.vista.limpiarSeleccion();
    this.vista.reiniciarMano(this.modelo.manos[1]);
    this.audio.mezclar([392, 523.25, 659.25], 0.12, 0);
    this._broadcast();
  }

  // ===== SALIR / DESCONEXIÓN =====

  _salir() {
    this.ui.cerrarModales();
    if (this.red) this.red.cerrar();
    this.red = null;
    this.enPartida = false;
    this.jugadores = [];
    this._actualizarChipConexion(false);
    if (this.onSalirAlInicio) this.onSalirAlInicio();
  }

  _manejarDesconexion() {
    if (this._desconectado) return;
    this._desconectado = true;
    this.ui.cerrarModales();
    this.enPartida = false;
    this.ui.notificarDesconexion().then(() => {
      if (this.onSalirAlInicio) this.onSalirAlInicio();
    });
  }
}
