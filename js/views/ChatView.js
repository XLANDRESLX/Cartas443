const MAX_CARACTERES = 500;

export class ChatView {
  constructor({ alEnviar, alAbrir, alCerrar } = {}) {
    this.alEnviar = alEnviar || (() => {});
    this.alAbrir = alAbrir || (() => {});
    this.alCerrar = alCerrar || (() => {});

    this.widget = document.getElementById('chat-widget');
    this.btn = document.getElementById('btn-chat');
    this.badge = document.getElementById('chat-badge');
    this.panel = document.getElementById('chat-panel');
    this.btnCerrar = document.getElementById('chat-cerrar');
    this.elConectados = document.getElementById('chat-conectados-txt');
    this.elParticipantes = document.getElementById('chat-participantes');
    this.elMensajes = document.getElementById('chat-mensajes');
    this.form = document.getElementById('chat-form');
    this.input = document.getElementById('chat-input');
    this.btnEnviar = document.getElementById('chat-enviar');
    this.elContador = document.getElementById('chat-contador');

    this._abierto = false;
    this._filas = [];
    this._viewportRaf = null;

    this._enlazarEventos();
    this._actualizarContador();
    this._actualizarViewport();
  }

  _enlazarEventos() {
    if (this.btn) {
      this.btn.addEventListener('click', () => this.toggle());
    }
    if (this.btnCerrar) {
      this.btnCerrar.addEventListener('click', () => this.cerrar());
    }
    if (this.form) {
      this.form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        this._enviarFormulario();
      });
    }
    if (this.input) {
      this.input.addEventListener('input', () => {
        if (this.input.value.length > MAX_CARACTERES) {
          this.input.value = this.input.value.slice(0, MAX_CARACTERES);
        }
        this._actualizarContador();
        this._autoAlto();
      });
      this.input.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) {
          evento.preventDefault();
          this._enviarFormulario();
        }
      });
      this.input.addEventListener('focus', () => {
        this._actualizarViewport();
        this._asegurarVisible();
      });
    }
    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && this.estaAbierto()) this.cerrar();
    });

    if (window.visualViewport) {
      const actualizar = () => {
        if (this._viewportRaf) return;
        this._viewportRaf = requestAnimationFrame(() => {
          this._viewportRaf = null;
          this._actualizarViewport();
          if (this.input && document.activeElement === this.input) this._asegurarVisible();
        });
      };
      window.visualViewport.addEventListener('resize', actualizar, { passive: true });
      window.visualViewport.addEventListener('scroll', actualizar, { passive: true });
    }
  }

  _esTactil() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  _enviarFormulario() {
    if (!this.input) return;
    const texto = this.input.value;
    if (!texto || !texto.trim()) {
      this.input.focus({ preventScroll: true });
      return;
    }
    this.alEnviar(texto);
  }

  _actualizarContador() {
    if (!this.input || !this.elContador) return;
    const total = this.input.value.length;
    this.elContador.textContent = `${total}/${MAX_CARACTERES}`;
    this.elContador.classList.toggle('limite', total >= MAX_CARACTERES);
    if (this.btnEnviar) {
      this.btnEnviar.disabled = this.input.value.trim().length === 0;
    }
  }

  _autoAlto() {
    if (!this.input) return;
    this.input.style.height = 'auto';
    const alto = Math.min(this.input.scrollHeight || 38, 92);
    this.input.style.height = `${alto}px`;
  }

  _actualizarViewport() {
    const vv = window.visualViewport;
    if (!vv || !this.panel) return;
    const oculto = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--chat-top', `${Math.round(vv.offsetTop)}px`);
    document.documentElement.style.setProperty('--chat-vh', `${Math.round(vv.height)}px`);
    document.documentElement.style.setProperty('--chat-keyboard', `${Math.round(oculto)}px`);
    this.panel.classList.toggle('chat-teclado', oculto > 120);
  }

  _asegurarVisible() {
    if (!this.estaAbierto()) return;
    const vv = window.visualViewport;
    if (!vv) {
      this.panel.scrollIntoView({ block: 'nearest' });
      return;
    }
    const rect = this.panel.getBoundingClientRect();
    if (rect.bottom > vv.offsetTop + vv.height - 6) {
      this.panel.classList.add('chat-teclado');
    }
  }

  mostrarWidget() {
    if (!this.widget) return;
    this.widget.classList.remove('hidden');
  }

  ocultarWidget() {
    if (this.widget) this.widget.classList.add('hidden');
    this.cerrar({ silencioso: true });
    this.mostrarNoLeidos(0);
  }

  abrir() {
    if (!this.panel || !this.widget || this.widget.classList.contains('hidden')) return;
    this.panel.classList.remove('hidden');
    this._abierto = true;
    if (this.btn) this.btn.setAttribute('aria-expanded', 'true');
    this._actualizarViewport();
    this.desplazarAbajo();
    if (!this._esTactil()) {
      setTimeout(() => {
        if (this._abierto && this.input) this.input.focus({ preventScroll: true });
      }, 60);
    }
    this.alAbrir();
  }

  cerrar({ silencioso = false } = {}) {
    if (!this.panel) return;
    this.panel.classList.add('hidden');
    this.panel.classList.remove('chat-teclado');
    this._abierto = false;
    if (this.btn) this.btn.setAttribute('aria-expanded', 'false');
    if (this.input) this.input.blur();
    if (!silencioso) this.alCerrar();
  }

  toggle() {
    if (this.estaAbierto()) this.cerrar();
    else this.abrir();
  }

  estaAbierto() {
    return this._abierto && !!this.panel && !this.panel.classList.contains('hidden');
  }

  actualizarJugadores(jugadores, miNumero) {
    const lista = (jugadores || []).filter((j) => j && j.conectado !== false);
    if (this.elConectados) {
      this.elConectados.textContent = `${lista.length} conectado${lista.length === 1 ? '' : 's'}`;
    }
    if (!this.elParticipantes) return;
    this.elParticipantes.innerHTML = '';

    for (const jugador of lista) {
      const chip = document.createElement('span');
      chip.className = 'chat-participante';
      const color = typeof jugador.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(jugador.color)
        ? jugador.color
        : '#e6b84d';
      chip.style.setProperty('--color-jugador', color);

      const punto = document.createElement('span');
      punto.className = 'chat-punto';

      const nombre = document.createElement('span');
      nombre.className = 'chat-participante-nombre';
      const esYo = jugador.numero === miNumero;
      nombre.textContent = `${jugador.esHost ? '👑 ' : ''}${jugador.nombre || `Jugador ${jugador.numero}`}${esYo ? ' (tú)' : ''}`;

      chip.appendChild(punto);
      chip.appendChild(nombre);
      this.elParticipantes.appendChild(chip);
    }
  }

  agregarMensaje(msg) {
    if (!this.elMensajes) return;

    const vacio = this.elMensajes.querySelector('.chat-vacio');
    if (vacio) vacio.remove();

    const fila = document.createElement('div');

    if (msg.sistema) {
      fila.className = 'chat-sistema';
      fila.textContent = msg.texto;
    } else {
      const propio = !!msg.propio;
      fila.className = `chat-fila ${propio ? 'propio' : 'ajeno'}`;
      fila.style.setProperty('--color-chat', msg.color || '#e6b84d');

      const meta = document.createElement('div');
      meta.className = 'chat-meta';

      const autor = document.createElement('span');
      autor.className = 'chat-autor';
      const nombre = msg.nombre || 'Jugador';
      autor.textContent = propio ? `${nombre} · tú` : nombre;

      const hora = document.createElement('span');
      hora.className = 'chat-hora';
      hora.textContent = this._hora(msg.ts);

      const burbuja = document.createElement('div');
      burbuja.className = 'chat-burbuja';
      burbuja.textContent = msg.texto;

      meta.appendChild(autor);
      meta.appendChild(hora);
      fila.appendChild(meta);
      fila.appendChild(burbuja);
    }

    const cercaDelFondo = this._cercaDelFondo();
    this.elMensajes.appendChild(fila);
    this._filas.push(fila);

    // Auto-scroll al recibir mensajes mientras el panel está abierto.
    if (msg.propio || msg.sistema || this.estaAbierto() || cercaDelFondo) this.desplazarAbajo();
  }

  _hora(ts) {
    const fecha = new Date(Number(ts));
    if (Number.isNaN(fecha.getTime())) return '';
    try {
      return fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  _cercaDelFondo() {
    if (!this.elMensajes) return true;
    const el = this.elMensajes;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }

  desplazarAbajo() {
    if (!this.elMensajes) return;
    this.elMensajes.scrollTop = this.elMensajes.scrollHeight;
  }

  eliminarPrimerMensaje() {
    // El aviso de sistema no cuenta para el historial de 100 mensajes.
    const indice = this._filas.findIndex((fila) => !fila.classList.contains('chat-sistema'));
    if (indice === -1) return;
    const [fila] = this._filas.splice(indice, 1);
    if (fila && fila.parentNode) fila.parentNode.removeChild(fila);
  }

  limpiarMensajes() {
    if (!this.elMensajes) return;
    this.elMensajes.innerHTML = '';
    this._filas = [];
    const vacio = document.createElement('p');
    vacio.className = 'chat-vacio';
    vacio.textContent = 'Aún no hay mensajes. ¡Saluda a la mesa!';
    this.elMensajes.appendChild(vacio);
  }

  mostrarNoLeidos(cantidad) {
    const n = Math.max(0, Number(cantidad) || 0);
    if (this.badge) {
      if (n > 0 && !this.estaAbierto()) {
        this.badge.textContent = n > 99 ? '99+' : String(n);
        this.badge.classList.remove('hidden');
      } else {
        this.badge.classList.add('hidden');
      }
    }
    if (this.btn) {
      this.btn.classList.toggle('tiene-no-leidos', n > 0 && !this.estaAbierto());
    }
  }

  limpiarEntrada() {
    if (!this.input) return;
    this.input.value = '';
    this.input.style.height = '';
    this._actualizarContador();
    if (this._abierto) this.input.focus({ preventScroll: true });
  }
}
