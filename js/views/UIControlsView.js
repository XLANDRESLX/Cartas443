import { AVATARES } from '../utils/storage.js';

let SwalGlobalado = null;

function obtenerSwal() {
  if (!SwalGlobalado && window.Swal) {
    SwalGlobalado = window.Swal;
  }
  return SwalGlobalado;
}

const COLORES_JUGADOR = ['#fbbf24', '#38bdf8', '#f472b6', '#a3e635'];
let indiceColor = 0;

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function siguienteColor() {
  const color = COLORES_JUGADOR[indiceColor % COLORES_JUGADOR.length];
  indiceColor++;
  return color;
}

export function reiniciarColores() {
  indiceColor = 0;
}

export class UIControlsView {
  constructor() {
    this.coloresPorConexion = new Map();
    this._callbacks = {};
    this.onMostrarEspera = null;
    this.onCerrarEspera = null;
    this.maxJugadores = 4;
  }

  _swal() {
    return obtenerSwal();
  }

  colorDe(conexion) {
    if (!this.coloresPorConexion.has(conexion)) {
      this.coloresPorConexion.set(conexion, siguienteColor());
    }
    return this.coloresPorConexion.get(conexion);
  }

  colorJugador(numero) {
    return COLORES_JUGADOR[numero - 1] || '#fbbf24';
  }

  // ===== SALA DE ESPERA (pantalla independiente dentro de la SPA) =====

  mostrarEspera({ codigo, esHost, puedeIniciar, maxJugadores, alIniciar, alSalir } = {}) {
    const overlay = document.getElementById('overlay-espera');
    const elCodigo = document.getElementById('espera-codigo');
    const elIniciar = document.getElementById('btn-espera-iniciar');
    const elSalir = document.getElementById('btn-espera-salir');
    const elNota = document.getElementById('espera-nota');
    const elCopiar = document.getElementById('btn-copiar-codigo');

    this.maxJugadores = maxJugadores || 4;

    if (elCodigo) elCodigo.textContent = codigo;
    if (elNota) {
      elNota.textContent = esHost
        ? 'Esperando a que se unan jugadores…'
        : 'Esperando al anfitrión…';
    }
    if (elIniciar) {
      elIniciar.classList.toggle('hidden', !esHost);
      elIniciar.disabled = esHost ? !puedeIniciar : true;
      elIniciar.onclick = esHost && alIniciar ? () => alIniciar() : null;
    }
    if (elSalir) {
      elSalir.onclick = () => { if (alSalir) alSalir(); };
    }
    if (elCopiar) {
      elCopiar.onclick = async () => {
        const ok = await this._copiarCodigo(codigo);
        elCopiar.textContent = ok ? '✓ Código copiado' : 'No se pudo copiar';
        if (ok) setTimeout(() => { elCopiar.textContent = '📋 Copiar / invitar'; }, 1600);
      };
    }

    this._actualizarListaEspera([], this.maxJugadores);

    if (overlay) overlay.classList.remove('hidden');
    if (typeof this.onMostrarEspera === 'function') this.onMostrarEspera();
  }

  actualizarEspera({ codigo, jugadores, esHost, puedeIniciar, maxJugadores } = {}) {
    const overlay = document.getElementById('overlay-espera');
    const elCodigo = document.getElementById('espera-codigo');
    const elIniciar = document.getElementById('btn-espera-iniciar');
    const elNota = document.getElementById('espera-nota');

    this.maxJugadores = maxJugadores || this.maxJugadores || 4;

    if (elCodigo && codigo) elCodigo.textContent = codigo;
    if (elNota) {
      const conectados = (jugadores || []).length;
      const max = this.maxJugadores;
      elNota.textContent = conectados >= max
        ? 'Sala llena: máxima capacidad alcanzada.'
        : esHost
          ? `Esperando jugadores… ${conectados}/${max}`
          : 'Esperando al anfitrión…';
    }
    if (elIniciar) {
      elIniciar.disabled = !(esHost && puedeIniciar);
    }
    this._actualizarListaEspera(jugadores || [], this.maxJugadores);

    if (overlay) overlay.classList.remove('hidden');
    if (typeof this.onMostrarEspera === 'function') this.onMostrarEspera();
  }

  async _copiarCodigo(codigo) {
    const valor = String(codigo || '');
    if (!valor) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(valor);
        return true;
      }
    } catch (e) { /* método alternativo */ }
    try {
      const temporal = document.createElement('textarea');
      temporal.value = valor;
      temporal.style.position = 'fixed';
      temporal.style.opacity = '0';
      document.body.appendChild(temporal);
      temporal.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(temporal);
      return ok;
    } catch (e) {
      return false;
    }
  }

  _actualizarListaEspera(jugadores, maxJugadores = 4) {
    const lista = document.getElementById('espera-jugadores');
    if (!lista) return;
    lista.innerHTML = '';

    const conectados = Array.isArray(jugadores) ? jugadores.slice(0, maxJugadores) : [];
    for (const jugador of conectados) {
      const li = document.createElement('li');
      li.className = 'fila-espera' + (jugador.esHost ? ' host' : '');

      const avatar = document.createElement('span');
      avatar.className = 'avatar-espera';
      avatar.style.background = jugador.color || '#e0b64f';
      const numero = Number(jugador.numero) || 1;
      avatar.textContent = jugador.avatar || AVATARES[(numero - 1) % AVATARES.length];
      if (jugador.esHost) {
        const corona = document.createElement('span');
        corona.className = 'corona';
        corona.textContent = '👑';
        avatar.appendChild(corona);
      }

      const nombre = document.createElement('span');
      nombre.className = 'nombre-espera';
      nombre.textContent = jugador.nombre || 'Jugador';

      const estado = document.createElement('span');
      estado.className = 'estado-espera' + (jugador.conectado === false ? ' desconectado' : '');
      estado.textContent = jugador.conectado === false
        ? 'Desconectado'
        : jugador.esHost ? 'Anfitrión' : 'Conectado';

      li.append(avatar, nombre, estado);
      lista.appendChild(li);
    }

    const espacios = Math.max(0, maxJugadores - conectados.length);
    for (let i = 0; i < espacios; i++) {
      const li = document.createElement('li');
      li.className = 'slot-vacio';
      const circulo = document.createElement('span');
      circulo.className = 'circulo-vacio';
      circulo.textContent = '+';
      li.append(circulo, document.createTextNode('Espacio libre'));
      lista.appendChild(li);
    }
  }

  cerrarEspera() {
    const overlay = document.getElementById('overlay-espera');
    if (overlay) overlay.classList.add('hidden');
    if (typeof this.onCerrarEspera === 'function') this.onCerrarEspera();
  }

  cerrarModales() {
    this.cerrarEspera();
    this._reconexionAbierta = false;
    const swal = this._swal();
    // Llamar a close() sin comprobar isVisible(): si la conexión se abre
    // mientras SweetAlert todavía está montando el modal, isVisible() es
    // false y el aviso "Conectando…" quedaría tapando la partida.
    if (swal) swal.close();
  }

  esperandoConexion(codigo, mensaje) {
    const swal = this._swal();
    if (!swal) return null;
    this._reconexionAbierta = true;
    return swal.fire({
      title: 'Conectando…',
      text: mensaje || `Buscando la sala ${codigo}`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => { swal.showLoading(); },
    });
  }

  mostrarReconexion(mensaje) {
    const swal = this._swal();
    if (!swal) return;
    this._reconexionAbierta = true;
    swal.fire({
      title: 'Conexión inestable',
      text: mensaje || 'Reintentando conectar con la sala…',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => { swal.showLoading(); },
    });
  }

  cerrarModalReconexion() {
    const swal = this._swal();
    const estaba = this._reconexionAbierta;
    this._reconexionAbierta = false;
    if (!swal || !estaba || !swal.isVisible()) return;
    const titulo = swal.getTitle && swal.getTitle();
    const texto = (titulo && titulo.textContent) || '';
    if (/Conexión inestable|Conectando/.test(texto)) swal.close();
  }

  mostrarJugadorDesconectado({ nombre, segundos, alSalir } = {}) {
    const swal = this._swal();
    if (!swal) return;
    this._desconectadoAbierto = true;
    const texto = segundos
      ? `Se esperará a que vuelva. Si no responde en ${segundos} s, saldrá de la partida.`
      : 'Esperando a que vuelva a conectarse…';
    swal.fire({
      icon: 'warning',
      title: `${nombre} se desconectó`,
      text: texto,
      showCancelButton: true,
      showConfirmButton: false,
      cancelButtonText: 'Salir de la sala',
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then((r) => {
      if (r && r.dismiss === swal.DismissReason.cancel) {
        if (alSalir) alSalir();
      }
    });
  }

  cerrarModalDesconectado() {
    const swal = this._swal();
    const estaba = this._desconectadoAbierto;
    this._desconectadoAbierto = false;
    if (!swal || !estaba || !swal.isVisible()) return;
    const titulo = swal.getTitle && swal.getTitle();
    const texto = (titulo && titulo.textContent) || '';
    if (/se desconectó/.test(texto)) swal.close();
  }

  alerta(titulo, texto) {
    const swal = this._swal();
    if (!swal) return;
    return swal.fire({ icon: 'info', title: titulo, text: texto, confirmButtonText: 'Aceptar' });
  }

  toast(mensaje, icono = 'info') {
    const swal = this._swal();
    if (!swal) return;
    const Toast = swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
    Toast.fire({ icon: icono, title: mensaje });
  }

  notificarVictoria(nombreJugador, numero, color, descripcion) {
    const swal = this._swal();
    if (!swal) return;
    const nombreSeguro = escaparHtml(nombreJugador || 'Jugador');
    const colorSeguro = /^#[0-9a-fA-F]{3,8}$/.test(String(color || '')) ? color : '#e0b64f';
    const porTipo = (d) => escaparHtml(d === undefined ? '' : d);
    return swal.fire({
      icon: 'success',
      title: `${nombreJugador} cantó 4-4-3`,
      html: [
        '<div class="swal-panel">',
        `<div class="swal-avatar" style="background:${colorSeguro}">${escaparHtml(numero)}</div>`,
        `<p>🎉 ¡Felicidades, ${nombreSeguro}! Organizaste tus 11 cartas en:</p>`,
        '<div class="swal-grupos">',
        ...(descripcion || []).map((d) => `<div class="swal-grupo">${porTipo(d)}</div>`),
        '</div>',
        '</div>',
      ].join(''),
      showConfirmButton: true,
      confirmButtonText: 'Continuar',
      allowOutsideClick: false,
    });
  }

  notificarEmpate() {
    const swal = this._swal();
    if (!swal) return;
    return swal.fire({
      icon: 'info',
      title: 'Empate',
      text: 'El mazo y el descarte se agotaron. Ningún jugador logró cantar 4-4-3. Se reparte una nueva mano.',
      confirmButtonText: 'Reiniciar partida',
      allowOutsideClick: false,
    });
  }

  notificarDesconexion() {
    const swal = this._swal();
    if (!swal) return;
    return swal.fire({
      icon: 'warning',
      title: 'Conexión perdida',
      text: 'Un jugador se desconectó. La partida finaliza.',
      confirmButtonText: 'Volver al inicio',
      allowOutsideClick: false,
    });
  }

  mostrarReglas() {
    const swal = this._swal();
    if (!swal) return;
    return swal.fire({
      title: '📖 ¿Cómo jugar 4-4-3?',
      html: [
        '<div class="swal-reglas">',
        '<p><b>1.</b> Cada jugador recibe <b>10 cartas</b>. El resto forma el mazo y se voltea una carta al descarte.</p>',
        '<p><b>2.</b> En tu turno debes <b>robar 1 carta</b> (del mazo o del pozo de descarte), quedando con 11 cartas.</p>',
        '<p><b>3.</b> Ganas si tus 11 cartas forman un <b>4-4-3</b>: tres grupos de 4, 4 y 3 cartas <b>del mismo número</b> (en cualquier orden: 4-4-3, 4-3-4 o 3-4-4).</p>',
        '<ul>',
        '<li><b>Grupo de 4:</b> cuatro cartas del mismo número.</li>',
        '<li><b>Grupo de 3:</b> tres cartas del mismo número.</li>',
        '<li>El <b>palo</b> (♠ ♥ ♦ ♣) no importa.</li>',
        '</ul>',
        '<p><b>4.</b> El sistema revisa tu mano sola: si forma el 4-4-3 se habilita <b>👑 Cantar 4-4-3</b>. Púlsalo y ganas.</p>',
        '<p><b>5.</b> Si no la armas, debes <b>botar 1 carta</b> al descarte y ceder el turno.</p>',
        '</div>',
      ].join(''),
      confirmButtonText: '¡A jugar!',
      allowOutsideClick: true,
    });
  }

  confirmarReinicio() {
    const swal = this._swal();
    if (!swal) return null;
    return swal.fire({
      title: '¿Nueva partida?',
      text: 'Se reparten 10 cartas a cada jugador y se inicia un nuevo turno.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, repartir',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
    });
  }

  confirmarSalir() {
    const swal = this._swal();
    if (!swal) return null;
    return swal.fire({
      title: '¿Salir de la partida?',
      text: 'Volverás a la pantalla de inicio y abandonarás la sala.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
    });
  }
}
