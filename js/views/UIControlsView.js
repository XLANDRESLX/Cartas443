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

  esperandoSala(codigo, soyHost) {
    const swal = this._swal();
    if (!swal) return null;
    return swal.fire({
      title: soyHost ? 'Sala creada' : 'Conectando...',
      html: [
        '<div class="flex flex-col items-center gap-3">',
        '<div class="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>',
        `<p class="text-lg font-bold tracking-widest">${codigo}</p>`,
        `<p class="text-sm text-slate-400">${soyHost ? 'Comparte este código con tu rival para que se una.' : 'Esperando al anfitrión...'}</p>`,
        soyHost ? '<button id="btn-copiar-sala" class="mt-1 text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition">📋 Copiar código</button>' : '',
        '</div>',
      ].join(''),
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const btn = document.getElementById('btn-copiar-sala');
        if (btn) {
          btn.addEventListener('click', () => {
            try {
              navigator.clipboard.writeText(codigo);
              btn.textContent = '✓ Copiado';
            } catch (e) {
              btn.textContent = 'Copia el código manualmente';
            }
          });
        }
      },
    });
  }

  cerrarModales() {
    const swal = this._swal();
    if (swal && swal.isVisible()) {
      swal.close();
    }
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
      text: 'Tu rival se desconectó. La partida finaliza.',
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
        '<p><b>Nota:</b> En un grupo de 4 cartas tambien se acepta un trío acompañado de una carta libre.</p>',
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