import { CardGameModel } from '../models/CardGameModel.js';
import { Card } from '../models/Card.js';
import { PeerNetwork } from '../network/PeerNetwork.js';
import { UIControlsView } from '../views/UIControlsView.js';
import { BoardView } from '../views/BoardView.js';
import { AudioView } from '../views/AudioView.js';

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
    this._nombreRival = 'Rival';
    this._colores = { 1: '#fbbf24', 2: '#38bdf8' };
    this._ganadorNotificado = null;
    this._desconectado = false;
    this.canalHost = null;

    this.vista.configurarAcciones({
      robarMazo: () => this._pedirAccion('robarMazo'),
      robarDescarte: () => this._pedirAccion('robarDescarte'),
      botar: (cartaId) => this._pedirAccion('botar', { cartaId }),
      cantar: () => this._pedirAccion('cantar'),
      seleccionarCarta: (id) => this._seleccionarCarta(id),
      sacarDeZona: (indice, id) => this._sacarDeZona(indice, id),
      reiniciar: () => this._pedirReinicio(),
    });
  }

  async crearSala(nombre) {
    this.esHost = true;
    this.miNumero = 1;
    this.miNombre = nombre || 'Jugador 1';
    this.modelo = new CardGameModel();
    this.sala = this._generarCodigo();

    this.red = new PeerNetwork({
      onMensaje: (datos) => this._procesarMensajeHost(datos),
      onConexion: () => this._hostComienzo(),
      onDesconexion: () => this._manejarDesconexion(),
      onError: (err) => this._mostrarErrorRed(err),
    });

    try {
      const id = await this.red.crearSala(this.sala);
      this.sala = id;
      this.ui.esperandoSala(this.sala, true);
    } catch (err) {
      this.ui.cerrarModales();
      this._mostrarErrorRed(err);
    }
  }

  async unirse(codigo, nombre) {
    this.esHost = false;
    this.miNumero = 2;
    this.miNombre = nombre || 'Jugador 2';
    this.sala = codigo.trim();

    this.red = new PeerNetwork({
      onMensaje: (datos) => this._procesarMensajeInvitado(datos),
      onConexion: (conn) => {
        this.canalHost = conn;
        this.red.enviar({ tipo: 'nombre', nombre: this.miNombre });
      },
      onDesconexion: () => this._manejarDesconexion(),
      onError: (err) => this._mostrarErrorRed(err),
    });

    this.ui.esperandoSala(this.sala, false);
    try {
      await this.red.unirse(this.sala);
    } catch (err) {
      this.ui.cerrarModales();
      this._mostrarErrorRed(err);
    }
  }

  _mostrarErrorRed(err) {
    this.ui.toast(err && err.message ? err.message : 'Error de red', 'error');
    if (!this.enPartida) {
      this.ui.cerrarModales();
      if (this.onSalirAlInicio) this.onSalirAlInicio();
    }
  }

  _generarCodigo() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let codigo = '';
    for (let i = 0; i < 4; i++) {
      codigo += chars[Math.floor(Math.random() * chars.length)];
    }
    return `443-${codigo}`;
  }

  _hostComienzo() {
    this.enPartida = true;
    this.ui.cerrarModales();
    this.ui.toast('¡Rival conectado! Buena suerte.', 'success');
  }

  // ===== MENSAJES ENTRANTES =====

  _procesarMensajeHost(datos) {
    if (datos.tipo === 'nombre') {
      this._nombreRival = datos.nombre;
      this._enviarBienvenida();
      return;
    }
    if (datos.tipo === 'accion') {
      this._ejecutarAccion(2, datos);
      return;
    }
    if (datos.tipo === 'reiniciar') {
      this._ejecutarReinicio();
      return;
    }
  }

  _procesarMensajeInvitado(datos) {
    if (datos.tipo === 'bienvenida') {
      this.enPartida = true;
      this.ui.cerrarModales();
      this.sala = datos.sala;
      this.miNumero = datos.jugador;
      this._colores = datos.colores;
      this._aplicarEstado(datos.estado);
      return;
    }
    if (datos.tipo === 'estado') {
      this._aplicarEstado(datos.estado);
      return;
    }
    if (datos.tipo === 'error') {
      this.ui.toast(datos.mensaje, 'error');
    }
  }

  _enviarBienvenida() {
    if (!this.red || this.red.conexiones.size === 0) return;
    const estado = this._estadoPara(2);
    this.red.enviar({
      tipo: 'bienvenida',
      sala: this.sala,
      jugador: 2,
      colores: this._colores,
      estado,
    });
    this._aplicarEstado(this._estadoPara(1));
  }

  // ===== ESTADO =====

  _estadoPara(jugador) {
    const rival = jugador === 1 ? 2 : 1;
    return {
      sala: this.sala,
      soyJugador: jugador,
      nombres: { 1: this.miNombre, 2: this._nombreRival },
      colores: this._colores,
      mazo: this.modelo.mazo.length,
      descarteTop: this.modelo.descarte.length > 0
        ? this.modelo.descarte[this.modelo.descarte.length - 1].toJSON()
        : null,
      descarteCount: this.modelo.descarte.length,
      mano: this.modelo.manos[jugador].map((c) => c.toJSON()),
      cartasRival: this.modelo.manos[rival].length,
      turno: this.modelo.turno,
      fase: this.modelo.fase,
      ganador: this.modelo.ganador,
      descripcionCanto: this.modelo.ganador != null && this.modelo.ganador > 0
        ? this._combinacionDe(this.modelo.ganador)
        : [],
      puede443:
        this.modelo.turno === jugador &&
        this.modelo.fase === 'decidir' &&
        CardGameModel.validar443(this.modelo.manos[jugador]),
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
      nombres: datos.nombres,
      colores: datos.colores,
      mazoCount: datos.mazo,
      descarteTop: datos.descarteTop ? Card.fromJSON(datos.descarteTop) : null,
      descarteCount: datos.descarteCount || 0,
      manos: {
        [datos.soyJugador]: (datos.mano || []).map((c) => Card.fromJSON(c)),
        [datos.soyJugador === 1 ? 2 : 1]: [],
      },
      cartasRival: datos.cartasRival,
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
    if (estado.ganador !== this._ganadorNotificado) {
      this._ganadorNotificado = estado.ganador;
      if (estado.ganador === 0) {
        this._confeti(false);
        setTimeout(() => {
          this.ui.notificarEmpate().then((r) => {
            if (r.isConfirmed) {
              if (this.esHost) this._ejecutarReinicio();
              else if (this.red) this.red.enviar({ tipo: 'reiniciar' });
            }
          });
        }, 700);
      } else {
        const ganador = estado.ganador;
        const nombre = estado.nombres[ganador];
        const descripcion = estado.descripcionCanto || [];
        this._confeti(true);
        setTimeout(() => {
          this.ui.notificarVictoria(nombre, ganador, estado.colores[ganador], descripcion);
        }, 600);
      }
    }
  }

  _combinacionDe(jugador) {
    if (!this.modelo || !this.modelo.manos[jugador]) return [];
    const combo = CardGameModel.encontrarCombinacion(this.modelo.manos[jugador]);
    return combo ? combo.descripcion : [];
  }

  _describirCanto(jugador) {
    return this._combinacionDe(jugador);
  }

  _confeti(ganar) {
    if (!window.confetti) return;
    const origen = { x: Math.random() * 0.8 + 0.1, y: 0.6 };
    window.confetti({
      particleCount: ganar ? 180 : 40,
      spread: 80,
      origin: origen,
      colors: ['#fbbf24', '#38bdf8', '#4ade80', '#f472b6', '#f8fafc'],
    });
    if (ganar) {
      setTimeout(() => {
        window.confetti({ particleCount: 90, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#fbbf24', '#38bdf8', '#4ade80'] });
        window.confetti({ particleCount: 90, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#fbbf24', '#38bdf8', '#4ade80'] });
      }, 350);
    }
  }

  // ===== ACCIONES =====

  _pedirAccion(accion, extras = {}) {
    if (accion === 'cantar') {
      extras.zonas = this.vista.obtenerZonasIds();
    }
    if (this.esHost) {
      this._ejecutarAccion(1, { accion, ...extras });
      return;
    }
    if (!this.red) return;
    this.red.enviar({ tipo: 'accion', accion, ...extras });
  }

  _actualizarVistaMano(jugador) {
    if (jugador === this.miNumero && this.modelo) {
      this.vista.nuevaMano(this.modelo.manos[jugador]);
    }
  }

  _ejecutarAccion(jugador, datos) {
    if (!this.modelo) return;
    if (this.modelo.turno !== jugador) {
      if (this.esHost && jugador === 2) {
        this.red.enviar({ tipo: 'error', mensaje: 'Aún no es tu turno' });
      }
      return;
    }

    const accion = datos.accion;

    if (accion === 'robarMazo') {
      const carta = this.modelo.robarDelMazo(jugador);
      if (carta) {
        this.audio.robar();
        this._actualizarVistaMano(jugador);
      } else {
        this._finSinCartas(jugador);
      }
    } else if (accion === 'robarDescarte') {
      const carta = this.modelo.robarDelDescarte(jugador);
      if (carta) {
        this.audio.robar();
        this._actualizarVistaMano(jugador);
      } else {
        if (this.esHost && jugador === 2) {
          this.red.enviar({ tipo: 'error', mensaje: 'El descarte está vacío' });
        } else {
          this.ui.toast('El descarte está vacío', 'info');
        }
      }
    } else if (accion === 'botar') {
      const carta = this.modelo.botar(jugador, datos.cartaId);
      if (carta) {
        this.audio.botar();
        this._actualizarVistaMano(jugador);
        this.audio.turno();
      } else if (this.esHost && jugador === 2) {
        this.red.enviar({ tipo: 'error', mensaje: 'Carta no válida en tu mano' });
      }
    } else if (accion === 'cantar') {
      const zonas = (datos.zonas || []).map((z) => z.map((c) => (typeof c === 'string' ? c : c.id)));
      const gano = this.modelo.cantar443(jugador, zonas);
      if (gano) {
        this._actualizarVistaMano(jugador);
        this.audio.victoria();
      } else if (this.esHost && jugador === 2) {
        this.red.enviar({ tipo: 'error', mensaje: 'Aún no formas un 4-4-3 válido' });
      } else {
        this.ui.toast('Aún no formas un 4-4-3 válido', 'warning');
      }
    }

    this._broadcast();
  }

  _finSinCartas(jugador) {
    this.modelo.fase = 'fin';
    this.modelo.ganador = 0;
  }

  _broadcast() {
    this._aplicarEstado(this._estadoPara(this.miNumero));
    if (this.esHost && this.red && this.red.conexiones.size > 0) {
      this.red.enviar({ tipo: 'estado', estado: this._estadoPara(2) });
    }
  }

  _seleccionarCarta(id) {
    this.vista.seleccionarCarta(id);
  }

  _sacarDeZona(indice, id) {
    this.vista.sacarDeZona(indice, id);
  }

  // ===== REINICIO =====

  _pedirReinicio() {
    if (this.esHost) {
      this.ui.confirmarReinicio().then((r) => {
        if (r.isConfirmed) this._ejecutarReinicio();
      });
    } else {
      if (this.red) this.red.enviar({ tipo: 'reiniciar' });
    }
  }

  _ejecutarReinicio() {
    if (!this.modelo) return;
    this.modelo.resetear();
    this._ganadorNotificado = null;
    this.vista.nuevaMano(this.modelo.manos[1]);
    this.audio.mezclar([392, 523.25, 659.25], 0.12, 0);
    this._broadcast();
  }

  // ===== DESCONEXIÓN =====

  _manejarDesconexion() {
    if (this._desconectado) return;
    this._desconectado = true;
    this.ui.cerrarModales();
    this.ui.notificarDesconexion().then(() => {
      window.location.reload();
    });
  }
}