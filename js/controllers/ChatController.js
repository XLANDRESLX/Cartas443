import { ChatView } from '../views/ChatView.js';

export const CHAT_MAX_CARACTERES = 500;
export const CHAT_MAX_MENSAJES = 100;

const INTERVALO_MIN_MS = 450;
const VENTANA_ANTISPAM_MS = 10000;
const MAX_MENSAJES_VENTANA = 8;

// Limpia y recorta el texto manteniendo saltos de línea (Shift + Enter).
export function normalizarTextoChat(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, CHAT_MAX_CARACTERES);
}

// Valida un paquete "chat:message" recibido por la red.
export function validarMensajeChat(datos) {
  if (!datos || typeof datos !== 'object') return null;
  if (datos.tipo !== 'chat:message') return null;
  if (typeof datos.texto !== 'string') return null;

  const texto = normalizarTextoChat(datos.texto);
  if (!texto) return null;

  const de = Number(datos.de);
  if (!Number.isInteger(de) || de < 1 || de > 4) return null;

  if (typeof datos.nombre !== 'string' || !datos.nombre.trim()) return null;

  const ts = Number(datos.ts);
  if (!Number.isFinite(ts)) return null;

  if (typeof datos.msgId !== 'string' || datos.msgId.length < 1 || datos.msgId.length > 80) {
    return null;
  }

  return {
    tipo: 'chat:message',
    sala: typeof datos.sala === 'string' ? datos.sala : '',
    msgId: datos.msgId,
    de,
    nombre: datos.nombre.trim().slice(0, 40),
    color: typeof datos.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(datos.color)
      ? datos.color
      : '#e6b84d',
    texto,
    ts,
  };
}

export class ChatController {
  constructor({ enviar, ui } = {}) {
    this.enviar = enviar || (() => ({ ok: false, error: 'Chat no disponible.' }));
    this.ui = ui || null;

    this.vista = new ChatView({
      alEnviar: (texto) => this._manejarEnvio(texto),
      alAbrir: () => this._alAbrir(),
      alCerrar: () => {},
    });

    this.sala = null;
    this.miNumero = 0;
    this.mensajes = [];
    this._ids = new Set();
    this._noLeidos = 0;
    this._activo = false;
    this._jugadores = [];
    this._ultimosEnvios = [];
    this._ultimoEnvio = 0;
  }

  // Activa el chat al entrar en una partida. Si cambia la sala, reinicia el historial.
  activar({ sala, jugadores, miNumero } = {}) {
    if (!sala) return;
    const cambioSala = this.sala !== sala;
    this.sala = sala;
    this.miNumero = Number(miNumero) || this.miNumero;
    if (Array.isArray(jugadores)) this._jugadores = jugadores;
    this._activo = true;

    this.vista.mostrarWidget();
    this.vista.actualizarJugadores(this._jugadores, this.miNumero);

    if (cambioSala) {
      this._reiniciarMensajes();
      this.vista.agregarMensaje({
        sistema: true,
        texto: 'Chat de partida activo. Solo los jugadores de esta sala pueden escribir.',
        ts: Date.now(),
      });
    }
  }

  actualizarJugadores(jugadores, miNumero) {
    if (!this._activo) return;
    if (Array.isArray(jugadores)) this._jugadores = jugadores;
    if (Number(miNumero) > 0) this.miNumero = Number(miNumero);
    this.vista.actualizarJugadores(this._jugadores, this.miNumero);
  }

  desactivar({ limpiar = true } = {}) {
    this._activo = false;
    this.vista.ocultarWidget();
    if (limpiar) {
      this.sala = null;
      this._jugadores = [];
      this._reiniciarMensajes();
    }
  }

  _reiniciarMensajes() {
    this.mensajes = [];
    this._ids.clear();
    this._noLeidos = 0;
    this._ultimosEnvios = [];
    this._ultimoEnvio = 0;
    this.vista.limpiarMensajes();
    this.vista.mostrarNoLeidos(0);
  }

  // Muestra un mensaje validado. Devuelve true si era nuevo.
  recibirMensaje(datos, esPropio) {
    if (!this._activo) return false;

    const msg = validarMensajeChat(datos);
    if (!msg) return false;
    if (msg.sala && this.sala && msg.sala !== this.sala) return false;
    if (this._ids.has(msg.msgId)) return false;

    this._ids.add(msg.msgId);
    const propio = typeof esPropio === 'boolean' ? esPropio : msg.de === this.miNumero;
    const entrada = { ...msg, propio };

    this.mensajes.push(entrada);
    if (this.mensajes.length > CHAT_MAX_MENSAJES) {
      const viejo = this.mensajes.shift();
      this._ids.delete(viejo.msgId);
      this.vista.eliminarPrimerMensaje();
    }

    this.vista.agregarMensaje(entrada);

    if (!this.vista.estaAbierto()) {
      this._noLeidos += 1;
      this.vista.mostrarNoLeidos(this._noLeidos);
    }
    return true;
  }

  mostrarError(mensaje) {
    if (this.ui && typeof this.ui.toast === 'function') {
      this.ui.toast(mensaje || 'Mensaje no permitido.', 'warning');
    }
  }

  _alAbrir() {
    this._noLeidos = 0;
    this.vista.mostrarNoLeidos(0);
    this.vista.desplazarAbajo();
  }

  _manejarEnvio(texto) {
    if (!this._activo) {
      this.mostrarError('El chat no está disponible en este momento.');
      return;
    }

    const limpio = normalizarTextoChat(texto);
    if (!limpio) {
      this.mostrarError('Escribe un mensaje antes de enviar.');
      return;
    }

    if (!this._permiteEnvioLocal()) {
      this.mostrarError('Vas muy rápido. Espera unos segundos antes de enviar otro mensaje.');
      return;
    }

    let resultado = null;
    try {
      resultado = this.enviar(limpio);
    } catch (e) {
      resultado = { ok: false, error: 'No se pudo enviar el mensaje.' };
    }

    if (resultado && resultado.ok === false) {
      this.mostrarError(resultado.error || 'No se pudo enviar el mensaje.');
      return;
    }

    const ahora = Date.now();
    this._ultimoEnvio = ahora;
    this._ultimosEnvios.push(ahora);
    this.vista.limpiarEntrada();
    this.vista.desplazarAbajo();
  }

  _permiteEnvioLocal() {
    const ahora = Date.now();
    this._ultimosEnvios = this._ultimosEnvios.filter((t) => ahora - t < VENTANA_ANTISPAM_MS);
    if (this._ultimosEnvios.length >= MAX_MENSAJES_VENTANA) return false;
    if (this._ultimoEnvio && ahora - this._ultimoEnvio < INTERVALO_MIN_MS) return false;
    return true;
  }
}
