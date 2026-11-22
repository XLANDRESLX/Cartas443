/* Navegador SPA por hash: permite cambiar de apartado sin recargar,
   conservando la conexión WebRTC y el estado del GameController. */

export const RUTAS = Object.freeze({
  inicio: 'pantalla-inicio',
  salas: 'pantalla-salas',
  'crear-sala': 'pantalla-crear-sala',
  unirse: 'pantalla-unirse',
  sala: 'overlay-espera',
  partida: 'pantalla-partida',
  perfil: 'pantalla-perfil',
  reglas: 'pantalla-reglas',
  ajustes: 'pantalla-ajustes',
});

export class Router {
  constructor({ alCambiar } = {}) {
    this.alCambiar = typeof alCambiar === 'function' ? alCambiar : () => {};
    this.actual = null;
    this.anterior = null;
    this.guardarSalida = null;
    this._enrutando = false;
  }

  iniciar() {
    if (!location.hash || !this._desdeHash()) {
      history.replaceState(null, '', '#/inicio');
    }
    window.addEventListener('hashchange', () => this._aplicar());
    this._aplicar();
  }

  setGuard(funcion) {
    this.guardarSalida = typeof funcion === 'function' ? funcion : null;
  }

  ir(ruta, { reemplazar = false } = {}) {
    const destino = this._normalizar(ruta);
    if (reemplazar) {
      history.replaceState(null, '', `#/${destino}`);
      this._aplicar();
      return;
    }
    if (destino === this.actual) return;
    location.hash = `#/${destino}`;
  }

  _normalizar(ruta) {
    const limpia = String(ruta || '').replace(/^#\/?/, '').trim();
    return Object.prototype.hasOwnProperty.call(RUTAS, limpia) ? limpia : 'inicio';
  }

  _desdeHash() {
    const limpia = String(location.hash || '').replace(/^#\/?/, '').trim();
    if (!limpia) return 'inicio';
    return Object.prototype.hasOwnProperty.call(RUTAS, limpia) ? limpia : 'inicio';
  }

  _aplicar() {
    if (this._enrutando) return;

    const destino = this._desdeHash();
    if (
      this.actual &&
      destino !== this.actual &&
      this.guardarSalida &&
      !this.guardarSalida(this.actual, destino)
    ) {
      this._revertir();
      return;
    }

    this._enrutando = true;
    try {
      this.anterior = this.actual;
      this.actual = destino;
      this._mostrarPantalla(destino);
      this.alCambiar(destino, this.anterior);
    } finally {
      this._enrutando = false;
    }
  }

  _revertir() {
    // replaceState no dispara hashchange: basta con restaurar la URL.
    history.replaceState(null, '', `#/${this.actual || 'inicio'}`);
  }

  _mostrarPantalla(ruta) {
    const id = RUTAS[ruta];
    document.querySelectorAll('.pantalla').forEach((seccion) => {
      seccion.classList.toggle('hidden', seccion.id !== id);
    });
  }
}
