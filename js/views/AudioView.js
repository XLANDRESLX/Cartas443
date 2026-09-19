export class AudioView {
  constructor() {
    this.contexto = null;
    this.silenciado = false;
    this.boton = document.getElementById('btn-sonido');
    if (this.boton) {
      this.boton.addEventListener('click', () => this.alternar());
    }
  }

  _ctx() {
    if (!this.contexto) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.contexto = new AC();
    }
    if (this.contexto.state === 'suspended') {
      this.contexto.resume();
    }
    return this.contexto;
  }

  alternar() {
    this.silenciado = !this.silenciado;
    if (this.boton) {
      this.boton.textContent = this.silenciado ? '🔇' : '🔊';
    }
    return this.silenciado;
  }

  mezclar(frecuencias = [523.25, 659.25, 783.99, 1046.5], duracion = 0.12, retraso = 0) {
    const ctx = this._ctx();
    if (!ctx || this.silenciado) return;
    frecuencias.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = ctx.currentTime + retraso + i * 0.09;
      gan.gain.setValueAtTime(0.0001, t);
      gan.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
      osc.connect(gan).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duracion + 0.02);
    });
  }

  robar() {
    const ctx = this._ctx();
    if (!ctx || this.silenciado) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gan).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  botar() {
    const ctx = this._ctx();
    if (!ctx || this.silenciado) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.1);
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gan).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  turno() {
    this.mezclar([392, 523.25], 0.1, 0);
  }

  error() {
    this.mezclar([220, 220], 0.15, 0);
  }

  empate() {
    this.mezclar([440, 392, 330], 0.12, 0);
  }

  victoria(combinacion) {
    const notas = combinacion || [523.25, 659.25, 783.99, 1046.5];
    this.mezclar(notas, 0.16, 0);
    this.mezclar(notas.concat([1318.5]), 0.2, 0.6);
  }
}