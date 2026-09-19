import { CardGameModel } from '../models/CardGameModel.js';

const CAPACIDADES = [3, 4, 4];
const ETIQUETAS_ZONAS = ['Grupo C · 3 cartas', 'Grupo A · 4 cartas', 'Grupo B · 4 cartas'];

function crearElementoCarta(carta, opciones = {}) {
  const div = document.createElement('div');
  div.className = 'carta';
  div.dataset.id = carta.id;
  if (opciones.deshabilitada) div.classList.add('deshabilitada');

  const cuerpo = document.createElement('div');
  cuerpo.className = 'cuerpo';

  if (opciones.bocaAbajo) {
    cuerpo.innerHTML = '<div class="dorso"></div>';
  } else {
    const clasePalo = carta.esRoja ? 'palo-rojo' : 'palo-negro';
    cuerpo.innerHTML = [
      '<div class="frente">',
      `<div class="esquina ${clasePalo}"><span>${carta.nombre}</span><span>${carta.simbolo}</span></div>`,
      `<div class="esquina inferior ${clasePalo}"><span>${carta.nombre}</span><span>${carta.simbolo}</span></div>`,
      `<div class="palo-centro ${clasePalo}">${carta.simbolo}</div>`,
      '</div>',
      '<div class="muesca"></div>',
    ].join('');
  }

  div.appendChild(cuerpo);
  return div;
}

export class BoardView {
  constructor() {
    this.elOponente = document.getElementById('zona-oponente');
    this.elBtnMazo = document.getElementById('btn-mazo');
    this.elLblMazo = document.getElementById('lbl-mazo');
    this.elBtnDescarte = document.getElementById('btn-descarte');
    this.elLblDescarte = document.getElementById('lbl-descarte');
    this.elGloboTurno = document.getElementById('globo-turno');
    this.elEstado = document.getElementById('estado-juego');
    this.elZonas = document.getElementById('zonas-443');
    this.elMano = document.getElementById('mano');
    this.elAcciones = document.getElementById('barra-acciones');
    this.chipSala = document.getElementById('chip-sala');

    this.acciones = null;
    this.e = null;
    this.zonas = [[], [], []];
    this.seleccion = null;
    this._ultimaManoIds = new Set();
  }

  configurarAcciones(acciones) {
    this.acciones = acciones;
  }

  render(e) {
    this.e = e;
    if (!this._enDecidir(e)) {
      this._limpiarZonas();
    }
    this._detectarNuevaMano(e);
    this._renderChipSala();
    this._renderFichas();
    this._renderCentro();
    this._renderZonas();
    this._renderMano();
    this._renderAcciones();
  }

  nuevaMano(mano) {
    this._ultimaManoIds = new Set(mano.map((c) => c.id));
    this._limpiarZonas();
    if (this.e && this.e.manos) {
      this.e.manos[this.e.soyJugador] = mano;
    }
  }

  limpiarSeleccion() {
    this._limpiarZonas();
  }

  seleccionarCarta(id) {
    this.seleccion = this.seleccion === id ? null : id;
    if (this.e) {
      if (this._enDecidir(this.e)) this._renderZonas();
      this._renderMano();
      this._renderAcciones();
    }
  }

  sacarDeZona(indice, id) {
    const zona = this.zonas[indice] || [];
    const posicion = zona.findIndex((c) => c.id === id);
    if (posicion !== -1) {
      zona.splice(posicion, 1);
      this.seleccion = id;
    }
    if (this.e) {
      this._renderZonas();
      this._renderMano();
      this._renderAcciones();
    }
  }

  _vincularArrastre(nodo, origen) {
    nodo.dataset.arrastre = '1';
    nodo.style.touchAction = 'none';

    const alInicio = (evento) => {
      if ((this.e && this.e.ganador) || !this.acciones) return;
      if (evento.button !== undefined && evento.button !== 0 && evento.pointerType === 'mouse') return;
      const cartaId = (origen.tipo === 'mano' && this.acciones)
        ? this._cartaEnMano()?.id
        : origen.cartaId;
      this.arrastre = {
        pointerId: evento.pointerId,
        origen,
        x0: evento.clientX,
        y0: evento.clientY,
        activo: false,
      };
      try { nodo.setPointerCapture(evento.pointerId); } catch (err) { /* sin captura */ }
      this.arrastre.nodo = nodo;
    };

    const alMover = (evento) => {
      if (!this.arrastre || this.arrastre.pointerId !== evento.pointerId) return;
      if (!this.arrastre.activo) {
        const dx = evento.clientX - this.arrastre.x0;
        const dy = evento.clientY - this.arrastre.y0;
        if (Math.hypot(dx, dy) < 8) return;
        this.arrastre.activo = true;
        this._crearFantasma(nodo);
        nodo.classList.add('arrastrada');
        this._marcarZonasObjetivo(cartaId);
      }
      this._moverFantasma(evento.clientX, evento.clientY);
      this._resaltarObjetivo(evento.clientX, evento.clientY);
    };

    const alFinal = (evento) => {
      if (!this.arrastre || this.arrastre.pointerId !== evento.pointerId) return;
      const fueActivo = this.arrastre.activo;
      const a = this.arrastre;
      this.arrastre = null;
      this._destruirFantasma();
      this._limpiarResaltes();
      if (fueActivo) {
        const destino = this._objetivoEn(evento.clientX, evento.clientY);
        if (destino) {
          this._soltarEn(origen, destino, evento.clientX, evento.clientY);
        } else if (origen.tipo === 'zona') {
          this._soltarEn(origen, { tipo: 'mano' }, evento.clientX, evento.clientY);
        }
      } else {
        nodo.classList.remove('arrastrada');
        this._emularClic(origen);
      }
    };

    nodo.addEventListener('pointerdown', alInicio);
    nodo.addEventListener('pointermove', alMover);
    nodo.addEventListener('pointerup', alFinal);
    nodo.addEventListener('pointercancel', alFinal);
  }

  _cartaEnMano() {
    const mano = (this.e && this.e.manos && this.e.manos[this.e.soyJugador]) || [];
    return this.seleccion ? mano.find((c) => c.id === this.seleccion) : null;
  }

  _crearFantasma(nodo) {
    if (this.fantasma) this._destruirFantasma();
    this.fantasma = nodo.cloneNode(true);
    this.fantasma.className = 'carta-fantasma';
    this.fantasma.removeAttribute('style');
    this.fantasma.style.position = 'fixed';
    this.fantasma.style.zIndex = '2000';
    this.fantasma.style.left = '0px';
    this.fantasma.style.top = '0px';
    this.fantasma.style.pointerEvents = 'none';
    this.fantasma.style.width = nodo.offsetWidth + 'px';
    this.fantasma.style.height = nodo.offsetHeight + 'px';
    document.body.appendChild(this.fantasma);
  }

  _moverFantasma(x, y) {
    if (this.fantasma) {
      this.fantasma.style.left = (x - (this.fantasma.offsetWidth || 0) / 2) + 'px';
      this.fantasma.style.top = (y - (this.fantasma.offsetHeight || 0) / 2) + 'px';
    }
  }

  _marcarZonasObjetivo(cartaId) {
    this._zonasNodo = [];
    const zonas = this._zonasDisponibles();
    for (let i = 0; i < this.elZonas.children.length && i < CAPACIDADES.length; i++) {
      const z = this.elZonas.children[i];
      const puede = (this.zonas[i] || []).length < CAPACIDADES[i];
      const ya = (this.zonas[i] || []).some((c) => c.id === cartaId);
      if (puede && !ya && (zonas.size === 0 || zonas.has(i))) {
        z.classList.add('zona-drop');
      }
      this._zonasNodo.push(z);
    }
  }

  _resaltarObjetivo(x, y) {
    if (!this._zonasNodo) return;
    const objetivo = this._zonaEn(x, y);
    this._zonasNodo.forEach((z) => z.classList.remove('zona-drop-activa'));
    if (objetivo && objetivo.zona) objetivo.zona.classList.add('zona-drop-activa');
  }

  _limpiarResaltes() {
    if (this._zonasNodo) {
      this._zonasNodo.forEach((z) => {
        z.classList.remove('zona-drop', 'zona-drop-activa');
      });
    }
    this._zonasNodo = null;
  }

  _destruirFantasma() {
    if (this.fantasma && this.fantasma.parentNode) {
      this.fantasma.parentNode.removeChild(this.fantasma);
    }
    this.fantasma = null;
  }

  _zonaEn(x, y) {
    const objetivo = document.elementFromPoint(x, y);
    if (objetivo) {
      const nodo = objetivo.closest('.zona-443');
      if (nodo) {
        const i = [].indexOf.call(this.elZonas.children, nodo);
        if (i >= 0) return { zona: nodo, indice: i };
      }
    }
    return null;
  }

  _esManoEn(x, y) {
    const objetivo = document.elementFromPoint(x, y);
    if (objetivo && objetivo.closest('#mano')) return true;
    return false;
  }

  _objetivoEn(x, y) {
    const zona = this._zonaEn(x, y);
    if (zona) return { tipo: 'zona', indice: zona.indice };
    if (this._esManoEn(x, y)) return { tipo: 'mano' };
    return null;
  }

  _soltarEn(origen, destino, x, y) {
    if (!this.acciones) return cutoff;
    if (destino.tipo === 'zona') {
      const cartaId = origen.tipo === 'mano'
        ? (this._cartaEnMano() || {}).id
        : origen.cartaId;
      if (!cartaId) return;
      const cartas = this.zonas[destino.indice] || [];
      if (cartas.length >= CAPACIDADES[destino.indice]) return;
      if (cartas.some((c) => c.id === cartaId)) return;
      this.seleccion = cartaId;
      this.acciones.seleccionarCarta(cartaId);
      this._colocarEnZona(destino.indice, cartaId);
    } else if (destino.tipo === 'mano' && origen.tipo === 'zona') {
      if (this.acciones) this.acciones.sacarDeZona(origen.indice, origen.cartaId);
    }
  }

  _emularClic(origen) {
    if (origen.tipo === 'mano') {
      const carta = this._cartaEnMano();
      if (carta && this.acciones) this.acciones.seleccionarCarta(carta.id);
    } else if (origen.tipo === 'zona') {
      if (this.acciones) this.acciones.sacarDeZona(origen.indice, origen.cartaId);
    }
  }

  obtenerZonasIds() {
    return this.zonas.map((z) => z.map((c) => c.id));
  }

  _limpiarZonas() {
    this.zonas = [[], [], []];
    this.seleccion = null;
  }

  _enDecidir(e) {
    return e && e.fase === 'decidir' && e.turno === e.soyJugador && !e.ganador;
  }

  _detectarNuevaMano(e) {
    const mano = e.manos[e.soyJugador] || [];
    const ids = new Set(mano.map((c) => c.id));
    if (ids.size !== this._ultimaManoIds.size) {
      this._ultimaManoIds = ids;
      this._limpiarZonas();
    } else {
      let cambio = false;
      for (const id of ids) {
        if (!this._ultimaManoIds.has(id)) { cambio = true; break; }
      }
      if (cambio) {
        this._ultimaManoIds = ids;
        this._limpiarZonas();
      }
    }
  }

  _renderChipSala() {
    if (this.e.sala && this.chipSala) {
      this.chipSala.textContent = `🟢 Sala ${this.e.sala}`;
      this.chipSala.classList.remove('hidden');
    }
  }

  _renderFichas() {
    const e = this.e;
    const rival = e.soyJugador === 1 ? 2 : 1;
    const yo = e.soyJugador;

    const nombreRival = e.nombres[rival] || 'Rival';
    const colorRival = e.colores[rival] || '#38bdf8';
    const colorYo = e.colores[yo] || '#fbbf24';
    const cartasRival = e.cartasRival;
    const cartasYo = (e.manos[yo] || []).length;

    const turnoRival = e.turno === rival && !e.ganador;
    const turnoYo = e.turno === yo && !e.ganador;
    const soyGanador = e.ganador === yo;
    const rivalGanador = e.ganador === rival;

    this.elOponente.innerHTML = [
      `<div class="ficha-jugador ${rivalGanador ? 'ganador' : ''} ${turnoRival ? 'es-turno' : ''}">`,
      `<div class="pelota" style="background:${colorRival}"><span>${rival}</span></div>`,
      `<div class="info"><div class="nombre">${nombreRival} ${rivalGanador ? '👑' : ''}</div>`,
      `<div class="detalle">${turnoRival ? '⏳ Su turno…' : cartasRival + ' cartas'}</div></div>`,
      '</div>',
      '<div class="flex items-center gap-1 text-2xl text-amber-400 font-black px-2">VS</div>',
      `<div class="ficha-jugador ${soyGanador ? 'ganador' : ''} ${turnoYo ? 'es-turno' : ''}">`,
      `<div class="info" style="text-align:right"><div class="nombre">${this._miNombre()} ${soyGanador ? '👑' : ''}</div>`,
      `<div class="detalle">${turnoYo ? '▶ ¡Tu turno!' : cartasYo + ' cartas'}</div></div>`,
      `<div class="pelota" style="background:${colorYo}"><span>${yo}</span></div>`,
      '</div>',
    ].join('');
  }

  _miNombre() {
    const e = this.e;
    return e && e.nombres[e.soyJugador] ? e.nombres[e.soyJugador] : 'Jugador';
  }

  _renderCentro() {
    const e = this.e;
    const puedoRobar = e.turno === e.soyJugador && e.fase === 'robar' && !e.ganador;
    const puedoMazo = puedoRobar;
    const puedoDescarte = puedoRobar && e.descarteCount > 0;

    this.elLblMazo.textContent = `Mazo · ${e.mazoCount}`;
    this.elLblDescarte.textContent = `Descarte · ${e.descarteCount}`;

    this.elBtnMazo.innerHTML = '';
    const patron = document.createElement('div');
    patron.className = 'carta boca-abajo';
    patron.style.margin = '0';
    patron.innerHTML = '<div class="cuerpo"><div class="dorso"></div></div>';
    if (!puedoMazo) patron.classList.add('deshabilitada');
    this.elBtnMazo.appendChild(patron);

    this.elBtnMazo.onclick = () => {
      if (puedoMazo && this.acciones) this.acciones.robarMazo();
    };
    this.elBtnMazo.style.pointerEvents = puedoMazo ? 'auto' : 'none';

    this._renderPilaDescarte(e.descarteTop, e.descarteCount, puedoDescarte);

    let globo = 'TURNO DEL RIVAL';
    let globoClase = 'text-center text-sm sm:text-base font-bold bg-black/40 rounded-2xl px-4 py-2 min-w-[10rem] shadow-lg';
    if (e.ganador === 0) {
      globo = 'EMPATE';
      globoClase = globoClase.replace('bg-black/40', 'bg-slate-500/90 text-slate-100');
    } else if (e.ganador === e.soyJugador) {
      globo = '¡VICTORIA!';
      globoClase = globoClase.replace('bg-black/40', 'bg-green-400/90 text-emerald-950');
    } else if (e.ganador) {
      globo = 'DERROTA';
      globoClase = globoClase.replace('bg-black/40', 'bg-red-500/90 text-red-100');
    } else if (e.fase === 'robar' && e.turno === e.soyJugador) {
      globo = 'ROBA UNA CARTA';
      globoClase = globoClase.replace('bg-black/40', 'bg-amber-400/90 text-emerald-950');
    } else if (e.fase === 'decidir' && e.turno === e.soyJugador) {
      globo = 'ORGANIZA TU 4-4-3';
      globoClase = globoClase.replace('bg-black/40', 'bg-amber-400/90 text-emerald-950');
    }
    this.elGloboTurno.textContent = globo;
    this.elGloboTurno.className = globoClase;

    if (e.ganador === e.soyJugador) {
      this.elEstado.textContent = 'Has cantado 4-4-3. ¡Cobras la partida!';
    } else if (e.ganador) {
      this.elEstado.textContent = 'El rival cantó 4-4-3. ¡Mejor suerte en la próxima!';
    } else if (e.ganador === 0) {
      this.elEstado.textContent = 'Empate: el mazo y el descarte se agotaron.';
    } else if (e.turno === e.soyJugador && e.fase === 'robar') {
      this.elEstado.textContent = 'Roba una carta del mazo o del descarte para comenzar tu turno.';
    } else if (e.turno === e.soyJugador && e.fase === 'decidir') {
      this.elEstado.textContent = e.puede443
        ? '🎉 ¡Tienes 4-4-3! Organiza las cartas en los grupos y canta victoria.'
        : 'Organiza tus 11 cartas en grupos (C:3, A:4, B:4) o bota una carta.';
    } else {
      this.elEstado.textContent = 'Esperando al oponente…';
    }
  }

  _renderPilaDescarte(tapa, cantidad, cliqueable) {
    this.elBtnDescarte.innerHTML = '';
    const pila = document.createElement('div');
    pila.id = 'pila-descarte';
    pila.className = 'relative';
    this.elBtnDescarte.appendChild(pila);

    const respaldos = document.createElement('div');
    respaldos.className = 'respaldos';
    respaldos.innerHTML = '<div></div><div></div>';
    pila.appendChild(respaldos);

    if (tapa) {
      const nodo = crearElementoCarta(tapa);
      nodo.style.margin = '0';
      pila.appendChild(nodo);
    } else {
      const vacio = document.createElement('div');
      vacio.className = 'respaldos';
      vacio.innerHTML = '<div></div>';
      pila.appendChild(vacio);
    }

    this.elBtnDescarte.onclick = () => {
      if (cliqueable && this.acciones) this.acciones.robarDescarte();
    };
    this.elBtnDescarte.style.pointerEvents = cliqueable ? 'auto' : 'none';
    this.elBtnDescarte.style.cursor = cliqueable ? 'pointer' : 'default';
  }

  _zonaValida(cartas) {
    return cartas.length > 0 && CardGameModel.validarGrupo(cartas);
  }

  _buildZona(indice) {
    const zona = document.createElement('div');
    zona.className = 'zona-443';
    const capacidad = CAPACIDADES[indice];
    const cartas = this.zonas[indice] || [];

    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta-zona';
    etiqueta.textContent = ETIQUETAS_ZONAS[indice];
    zona.appendChild(etiqueta);

    if (cartas.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'vacio-zona';
      vacio.textContent = 'Click en una carta de la mano para ubicarla aquí';
      zona.appendChild(vacio);
    }

    cartas.forEach((carta) => {
      const nodo = crearElementoCarta(carta);
      nodo.dataset.zona = String(indice);
      if (this._zonaValida(cartas)) nodo.classList.add('c-zona-bien');
      this._vincularArrastre(nodo, { tipo: 'zona', indice, cartaId: carta.id });
      nodo.onclick = (evento) => {
        evento.stopPropagation();
        if (this.acciones) this.acciones.sacarDeZona(indice, carta.id);
      };
      zona.appendChild(nodo);
    });

    zona.onclick = () => {
      if (this.seleccion && cartas.length < capacidad && this.acciones) {
        const mano = (this.e.manos || {})[this.e.soyJugador] || [];
        const carta = mano.find((c) => c.id === this.seleccion);
        if (carta && !new Set(this.zonas.flat().map((c) => c.id)).has(carta.id)) {
          this.zonas[indice].push(carta);
          this.seleccion = null;
          if (this.e) {
            this._renderZonas();
            this._renderMano();
            this._renderAcciones();
          }
        }
      }
    };

    if (cartas.length === capacidad && this._zonaValida(cartas)) {
      zona.classList.add('valida');
    }

    return zona;
  }

  _renderZonas() {
    if (!this._enDecidir(this.e)) {
      this.elZonas.classList.add('hidden');
      this.elZonas.innerHTML = '';
      return;
    }
    this.elZonas.classList.remove('hidden');
    this.elZonas.innerHTML = '';
    for (let i = 0; i < CAPACIDADES.length; i++) {
      this.elZonas.appendChild(this._buildZona(i));
    }

    const enZonas = new Set(this.zonas.flat().map((c) => c.id));
    const mano = this.e.manos[this.e.soyJugador] || [];
    const colocadas = mano.filter((c) => enZonas.has(c.id)).length;
    const pie = document.createElement('div');
    pie.className = 'zona-443 col-span-full text-center';
    pie.innerHTML = `<span class="etiqueta-zona">Progreso</span><div class="vacio-zona" style="padding:8px">${colocadas}/11 cartas organizadas</div>`;
    this.elZonas.appendChild(pie);
  }

  _renderMano() {
    const e = this.e;
    const mano = e.manos[e.soyJugador] || [];
    const enZonas = new Set(this.zonas.flat().map((c) => c.id));
    const visibles = mano.filter((c) => !enZonas.has(c.id));

    this.elMano.innerHTML = '';
    if (visibles.length === 0) {
      this.elMano.classList.add('vacio');
    } else {
      this.elMano.classList.remove('vacio');
    }

    visibles.forEach((carta) => {
      const nodo = crearElementoCarta(carta);
      if (carta.id === this.seleccion) nodo.classList.add('seleccionada');
      if (e.ganador) nodo.classList.add('deshabilitada');
      nodo.onclick = () => {
        if (e.ganador) return;
        if (this.acciones) this.acciones.seleccionarCarta(carta.id);
      };
      this._vincularArrastre(nodo, carta, { tipo: 'mano' });
      this.elMano.appendChild(nodo);
    });

    if (visibles.length > 0) {
      window.setTimeout(() => {
        const cartasNuevas = this.elMano.querySelectorAll('.carta');
        if (cartasNuevas.length > 0) {
          cartasNuevas[cartasNuevas.length - 1].classList.add('carta-entrando');
        }
      }, 20);
    }
  }

  _renderAcciones() {
    const e = this.e;
    this.elAcciones.innerHTML = '';
    if (e.ganador != null) {
      const reiniciar = this._boton('🔄 Nueva partida', () => this.acciones.reiniciar(), 'boton-accion', !this.acciones.reiniciar);
      this.elAcciones.appendChild(reiniciar);
      return;
    }

    const botones = [];

    if (e.turno !== e.soyJugador) {
      const espera = document.createElement('span');
      espera.className = 'text-sm text-emerald-100/80';
      espera.textContent = '⏳ Esperando el turno del rival…';
      botones.push(espera);
    } else if (e.fase === 'robar') {
      botones.push(this._boton('🂡 Robar del mazo', () => this.acciones.robarMazo(), 'boton-accion'));
      botones.push(this._boton('🃏 Robar del descarte', () => this.acciones.robarDescarte(), 'boton-estilo'));
    } else if (e.fase === 'decidir') {
      const totalZonas = this.zonas.reduce((acc, z) => acc + z.length, 0);
      const listasCompletas = CAPACIDADES.every((cap, i) => this.zonas[i].length === cap);
      const validas = this.zonas.every((z, i) => z.length === 0 || (z.length === CAPACIDADES[i] && CardGameModel.validarGrupo(z)));
      const puedeCantar = totalZonas === 11 && listasCompletas && validas;

      const enZona = new Set(this.zonas.flat().map((c) => c.id));
      const seleccionEnMano = this.seleccion && !enZona.has(this.seleccion);
      const cual = this.seleccion;

      botones.push(this._boton('👑 Cantar 4-4-3', () => this.acciones.cantar(), 'boton-ganador', !puedeCantar));
      botones.push(this._boton('🗑 Botar carta seleccionada', () => this.acciones.botar(cual), 'boton-peligro', !seleccionEnMano));
    }

    botones.forEach((b) => this.elAcciones.appendChild(b));
  }

  _boton(texto, alClic, estiloClase, deshabilitado = false) {
    const btn = document.createElement('button');
    btn.className = `boton-juego ${estiloClase}`;
    btn.textContent = texto;
    btn.disabled = deshabilitado;
    btn.onclick = alClic;
    return btn;
  }
}