import { obtenerPreferencias, guardarPreferencias } from '../utils/storage.js';

export class PanelView {
  constructor({ audio, ui } = {}) {
    this.audio = audio;
    this.ui = ui;
    this.botonSonido = document.getElementById('btn-sonido-ajuste');
    this.checkMovimiento = document.getElementById('ajustes-movimiento');
    this.chipConexion = document.getElementById('ajustes-conexion');

    this._vincular();
    this.actualizar();
  }

  _vincular() {
    if (this.botonSonido) {
      this.botonSonido.addEventListener('click', () => {
        this.audio.alternar();
        this.actualizar();
      });
    }
    if (this.checkMovimiento) {
      this.checkMovimiento.addEventListener('change', () => {
        const preferencias = guardarPreferencias({
          movimientoReducido: !!this.checkMovimiento.checked,
        });
        this.aplicarPreferencias(preferencias);
      });
    }
  }

  aplicarPreferencias(preferencias = obtenerPreferencias()) {
    document.body.classList.toggle('modo-reducido', !!preferencias.movimientoReducido);
  }

  actualizar() {
    if (this.botonSonido) {
      const silenciado = !!this.audio.silenciado;
      this.botonSonido.textContent = silenciado ? '🔇 Silenciado' : '🔊 Activado';
      this.botonSonido.setAttribute('aria-pressed', String(!silenciado));
    }
    if (this.checkMovimiento) {
      this.checkMovimiento.checked = !!obtenerPreferencias().movimientoReducido;
    }
    this.aplicarPreferencias();
    this.actualizarConexion();
  }

  actualizarConexion(estado) {
    if (!this.chipConexion) return;
    const chip = document.getElementById('chip-conexion');
    const texto = estado || (chip && chip.querySelector('.txt') ? chip.querySelector('.txt').textContent : 'Sin conexión');
    this.chipConexion.textContent = texto;
  }
}
