let SwalGlobalado = null;

function obtenerSwal() {
  if (!SwalGlobalado && window.Swal) {
    SwalGlobalado = window.Swal;
  }
  return SwalGlobalado;
}

const COLORES_JUGADOR = ['#fbbf24', '#38bdf8', '#f472b6', '#a3e635'];
let indiceColor = 0;

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

  // ===== SALA DE ESPERA (overlay propio) =====

  mostrarEspera({ codigo, esHost, puedeIniciar, maxJugadores, alIniciar, alSalir } = {}) {
    const overlay = document.getElementById('overlay-espera');
    const elCodigo = document.getElementById('espera-codigo');
    const elIniciar = document.getElementById('btn-espera-iniciar');
    const elSalir = document.getElementById('btn-espera-salir');
    const elNota = document.getElementById('espera-nota');
    const elCopiar = document.getElementById('btn-copiar-codigo');

    if (elCodigo) elCodigo.textContent = codigo;
    if (elNota) {
      elNota.textContent = esHost
        ? 'Esperando a que se unan jugadores…'
        : 'Esperando al anfitrión…';
    }
    if (elIniciar) {
      elIniciar.classList.toggle('hidden', !esHost);
      elIniciar.disabled = esHost ? !puedeIniciar : true;
      if (esHost) {
        elIniciar.onclick = () => {
          if (alIniciar) alIniciar();
        };
      } else {
        elIniciar.onclick = null;
      }
    }
    if (elSalir) {
      elSalir.onclick = () => {
        if (alSalir) alSalir();
      };
    }
    if (elCopiar) {
      elCopiar.onclick = () => {
        try {
          navigator.clipboard.writeText(codigo || '');
          elCopiar.textContent = '✓ Copiado';
          setTimeout(() => { elCopiar.textContent = '📋 Copiar'; }, 1500);
        } catch (e) { /* sin portapapeles */ }
      };
    }

    this._actualizarListaEspera(jugadoresDeEspera());

    if (overlay) overlay.classList.remove('hidden');
  }

  actualizarEspera({ codigo, jugadores, esHost, puedeIniciar, maxJugadores } = {}) {
    const overlay = document.getElementById('overlay-espera');
    const elCodigo = document.getElementById('espera-codigo');
    const elIniciar = document.getElementById('btn-espera-iniciar');
    const elNota = document.getElementById('espera-nota');

    if (elCodigo && codigo) elCodigo.textContent = codigo;
    if (elNota) {
      const conectados = (jugadores || []).length;
      const max = maxJugadores || 4;
      elNota.textContent = conectados >= max
        ? 'Sala llena: máxima capacidad alcanzada.'
        : esHost
          ? `Esperando jugadores… ${conectados}/${max}`
          : 'Esperando al anfitrión…';
    }
    if (elIniciar) {
      elIniciar.disabled = !(esHost && puedeIniciar);
    }
    this._actualizarListaEspera(jugadores || []);

    if (overlay) overlay.classList.remove('hidden');
  }

  _actualizarListaEspera(jugadores) {
    const lista = document.getElementById('espera-jugadores');
    if (!lista) return;
    lista.innerHTML = '';
    if (!jugadores || jugadores.length === 0) {
      const vacio = document.createElement('li');
      vacio.className = 'lista-vacia';
      vacio.textContent = 'Aún no hay jugadores en esta sala.';
      lista.appendChild(vacio);
      return;
    }
    for (const jugador of jugadores) {
      const li = document.createElement('li');
      li.className = 'fila-espera';
      const avatar = document.createElement('span');
      avatar.className = 'avatar-espera';
      avatar.style.background = jugador.color || '#fbbf24';
      avatar.textContent = jugador.numero || '?';
      const nombre = document.createElement('span');
      nombre.className = 'nombre-espera';
      nombre.textContent = (jugador.esHost ? '👑 ' : '') + (jugador.nombre || 'Jugador');
      li.appendChild(avatar);
      li.appendChild(nombre);
      lista.appendChild(li);
    }
  }

  cerrarEspera() {
    const overlay = document.getElementById('overlay-espera');
    if (overlay) overlay.classList.add('hidden');
  }

  cerrarModales() {
    this.cerrarEspera();
    const swal = this._swal();
    if (swal && swal.isVisible()) {
      swal.close();
    }
  }

  esperandoConexion(codigo) {
    const swal = this._swal();
    if (!swal) return null;
    return swal.fire({
      title: 'Conectando…',
      text: `Buscando la sala ${codigo}`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => { swal.showLoading(); },
    });
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
    const porTipo = (d) => d === undefined ? '' : d;
    return swal.fire({
      icon: 'success',
      title: `${nombreJugador} cantó 4-4-3`,
      html: [
        `<div class="flex flex-col items-center gap-2">`,
        `<div class="w-14 h-14 rounded-full grid place-items-center text-2xl font-black text-emerald-950" style="background:${color}">${numero}</div>`,
        `<p class="text-slate-200">🎉 ¡Felicidades, ${nombreJugador}! Organizaste tus 11 cartas en:</p>`,
        `<div class="text-left text-sm space-y-1 w-full max-w-xs">`,
        ...(descripcion || []).map((d) => `<div class="bg-slate-800 rounded-lg px-3 py-2 text-emerald-300">${porTipo(d)}</div>`),
        `</div>`,
        `</div>`,
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
        '<div class="text-left text-sm space-y-2 max-h-72 overflow-y-auto pr-2">',
        '<p><b>1.</b> Cada jugador recibe <b>10 cartas</b>. El resto forma el mazo y se voltea una carta al descarte.</p>',
        '<p><b>2.</b> En tu turno debes <b>robar 1 carta</b> (del mazo o del pozo de descarte), quedando con 11 cartas.</p>',
        '<p><b>3.</b> Intenta <b>organizar tus 11 cartas</b> en las 3 combinaciones exigidas:</p>',
        '<ul class="list-disc pl-5">',
        '<li><b>Grupo A (4 cartas):</b> trío o cuarteto del mismo número, o escalera de 4 del mismo palo.</li>',
        '<li><b>Grupo B (4 cartas):</b> igual que el Grupo A.</li>',
        '<li><b>Grupo C (3 cartas):</b> trío del mismo número o escalera de 3 del mismo palo.</li>',
        '</ul>',
        '<p><b>4.</b> Si logras armar las 3 combinaciones, presiona <b>👑 Cantar 4-4-3</b> y ganas.</p>',
        '<p><b>5.</b> Si no la armas, debes <b>botar 1 carta</b> al descarte y ceder el turno.</p>',
        '<p><b>Nota:</b> En un grupo de 4 cartas también se acepta un trío acompañado de una carta libre.</p>',
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
}

export function jugadoresDeEspera() {
  return [];
}