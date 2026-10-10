import { CardGameModel } from '../models/CardGameModel.js';

const CAPACIDADES = [3, 4, 4];
const ETIQUETAS_ZONAS = ['C · 3', 'A · 4', 'B · 4'];
const ORDEN_PALOS = { espadas: 0, corazones: 1, diamantes: 2, treboles: 3 };

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
      `<div class="esquina ${clasePalo}"><span class="esp-valor">${carta.nombre}</span><span class="esp-palo">${carta.simbolo}</span></div>`,
      `<div class="esquina inferior ${clasePalo}"><span class="esp-valor">${carta.nombre}</span><span class="esp-palo">${carta.simbolo}</span></div>`,
      `<div class="palo-centro ${clasePalo}">${carta.simbolo}</div>`,
      '</div>',
      '<div class="muesca"></div>',
    ].join('');
  }

  div.appendChild(cuerpo);
  return div;
}

const ORDEN_LOCAL = 'orden-mano-';

export class BoardView {
  constructor() {
    this.elAsientos = document.getElementById('asientos');
    this.elBtnMazo = document.getElementById('btn-mazo');
    this.elLblMazo = document.getElementById('lbl-mazo');
    this.elBtnDescarte = document.getElementById('btn-descarte');
    this.elLblDescarte = document.getElementById('lbl-descarte');
    this.elGloboTurno = document.getElementById('globo-turno');
    this.elEstado = document.getElementById('estado-juego');
    this.elZonas = document.getElementById('zonas-443');
    this.elMano = document.getElementById('mano');
    this.elManoContador = document.getElementById('mano-contador');
    this.elMiNombre = document.getElementById('mi-nombre-mano');
    this.elHerramientas = document.getElementById('herramientas-mano');
    this.elAcciones = document.getElementById('barra-acciones');
    this.chipSala = document.getElementById('chip-sala');

    this.acciones = null;
    this.e = null;
    this.zonas = [[], [], []];
    this.seleccion = null;
    this.ordenMano = [];          // ids ordenados manualmente (privado)
    this._historialOrden = [];
    this._cartaArrastrada = null;
    this._elIndicador = null;
    this._claveOrden = '';
    this._prevGanador = null;
  }

  configurarAcciones(acciones) {
    this.acciones = acciones;
  }

  _esMiTurnoReal(e) {
    return e && e.fase === 'decidir' && e.turno === e.soyJugador && !e.ganador;
  }

  render(e) {
    const mano = this._manoActual(e);
    this._claveOrden = `sala:${e.sala || 'x'}:j:${e.soyJugador}`;

    // Si termina una partida y empieza otra, se reinicia el orden manual.
    if (this._prevGanador != null && e.ganador == null) {
      this.ordenMano = this._ordenarCartasIds(mano, 'valor');
      this._historialOrden = [];
      this._guardarOrden();
    }
    this._prevGanador = e.ganador;

    this._sincronizarOrden(mano);
    this._reconciliarZonas(mano);
    this.e = e;

    // Al no ser mi turno de decidir, los grupos locales se limpian.
    if (!this._esMiTurnoReal(e)) this._limpiarZonas();

    this._renderChipSala();
    this._renderAsientos();
    this._renderCentro();
    this._renderZonas();
    this._renderMano();
    this._renderHerramientas();
    this._renderAcciones();
  }

  nuevaMano(mano) {
    // Preserva el orden manual; sólo incorpora cartas nuevas.
    this._sincronizarOrden(mano);
    if (this.e && this.e.manos) {
      this.e.manos[this.e.soyJugador] = mano;
    }
    if (this.e) {
      this._renderMano();
      this._renderHerramientas();
    }
  }

  reiniciarMano(mano) {
    this._limpiarZonas();
    this.ordenMano = this._ordenarCartasIds(mano, 'valor');
    this._historialOrden = [];
    if (this.e && this.e.manos) {
      this.e.manos[this.e.soyJugador] = mano;
    }
    this._guardarOrden();
  }

  limpiarSeleccion() {
    this._limpiarZonas();
    this._renderZonas();
    this._renderMano();
    this._renderAcciones();
  }

  _manoActual(e) {
    return (e && e.manos && e.manos[e.soyJugador]) || [];
  }

  seleccionarCarta(id) {
    this.seleccion = this.seleccion === id ? null : id;
    if (this.e) {
      this._renderZonas();
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

  obtenerZonasIds() {
    return this.zonas.map((z) => z.map((c) => c.id));
  }

  // ===== ORDEN MANUAL DE LA MANO =====

  _sincronizarOrden(mano) {
    const ids = mano.map((c) => c.id);
    const enUso = new Set(ids);
    const previos = this._cargarOrden() || this.ordenMano;
    this.ordenMano = previos.filter((id) => enUso.has(id));
    for (const id of ids) {
      if (!this.ordenMano.includes(id)) this.ordenMano.push(id);
    }
  }

  _reconciliarZonas(mano) {
    const enMano = new Set(mano.map((c) => c.id));
    this.zonas = this.zonas.map((zona) => zona.filter((c) => enMano.has(c.id)));
  }

  _cargarOrden() {
    try {
      const datos = localStorage.getItem(ORDEN_LOCAL + this._claveOrden);
      return datos ? JSON.parse(datos) : null;
    } catch (e) { return null; }
  }

  _guardarOrden() {
    try {
      localStorage.setItem(ORDEN_LOCAL + this._claveOrden, JSON.stringify(this.ordenMano));
    } catch (e) { /* sin almacenamiento */ }
  }

  _cartasEnMano() {
    const enZonas = new Set(this.zonas.flat().map((c) => c.id));
    return (this._manoActual(this.e) || []).filter((c) => !enZonas.has(c.id));
  }

  _aplicarOrden(ids) {
    this._historialOrden.push(this.ordenMano.slice());
    if (this._historialOrden.length > 30) this._historialOrden.shift();
    this.ordenMano = ids;
    this._guardarOrden();
  }

  _ordenarCartasIds(mano, estrategia) {
    const porId = {};
    mano.forEach((c) => { porId[c.id] = c; });
    return mano.slice().sort((a, b) => {
      if (estrategia === 'valor') {
        if (a.valor !== b.valor) return a.valor - b.valor;
        return (ORDEN_PALOS[a.palo] || 9) - (ORDEN_PALOS[b.palo] || 9);
      }
      if (estrategia === 'palo') {
        const pa = ORDEN_PALOS[a.palo] || 9;
        const pb = ORDEN_PALOS[b.palo] || 9;
        if (pa !== pb) return pa - pb;
        return a.valor - b.valor;
      }
      // ambos: palo primero, luego valor
      const pa = ORDEN_PALOS[a.palo] || 9;
      const pb = ORDEN_PALOS[b.palo] || 9;
      if (pa !== pb) return pa - pb;
      return a.valor - b.valor;
    }).map((c) => c.id);
  }

  _ordenManualTipo(nombre) {
    const cartas = this._cartasEnMano();
    const enZonas = new Set(this.zonas.flat().map((c) => c.id));
    const zonasIds = this.ordenMano.filter((id) => enZonas.has(id));
    const tipos = {
      'valor': () => this._ordenarCartasIds(cartas, 'valor'),
      'palo': () => this._ordenarCartasIds(cartas, 'palo'),
      'ambos': () => this._ordenarCartasIds(cartas, 'ambos'),
    };
    const fn = tipos[nombre];
    if (fn) this._aplicarOrden([...fn(), ...zonasIds]);
    this._renderMano();
    this._renderHerramientas();
  }

  _deshacerOrden() {
    const previo = this._historialOrden.pop();
    if (previo) {
      this.ordenMano = previo.slice();
      this._guardarOrden();
      this._renderMano();
      this._renderHerramientas();
    }
  }

  _moverCartaEnMano(cartaId, indiceDestino) {
    const ids = this.ordenMano.filter((id) => id !== cartaId);
    const pos = Math.max(0, Math.min(indiceDestino, ids.length));
    ids.splice(pos, 0, cartaId);
    this._aplicarOrden(ids);
    this._renderMano();
  }

  // ===== ARRASTRE =====

  _vincularArrastre(nodo, origen) {
    nodo.dataset.arrastre = '1';
    nodo.style.touchAction = 'none';

    const alInicio = (evento) => {
      if ((this.e && this.e.ganador) || !this.acciones) return;
      if (evento.button !== undefined && evento.button !== 0 && evento.pointerType === 'mouse') return;
      this._cartaArrastrada = origen.cartaId;
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
        this._marcarObjetivos(this._cartaArrastrada);
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
      this._quitarIndicador();
      if (fueActivo) {
        const destino = this._objetivoEn(evento.clientX, evento.clientY);
        if (destino) {
          this._soltarEn(a.origen, destino, evento.clientX, evento.clientY);
        } else if (a.origen.tipo === 'zona') {
          this._soltarEn(a.origen, { tipo: 'mano' }, evento.clientX, -1);
        }
      } else {
        nodo.classList.remove('arrastrada');
        this._emularClic(a.origen);
      }
      this._cartaArrastrada = null;
    };

    nodo.addEventListener('pointerdown', alInicio);
    nodo.addEventListener('pointermove', alMover);
    nodo.addEventListener('pointerup', alFinal);
    nodo.addEventListener('pointercancel', alFinal);
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

  _marcarObjetivos(cartaId) {
    this._zonasNodo = [];
    const zonas = this._zonasDisponibles();
    for (let i = 0; i < this.elZonas.children.length && i < CAPACIDADES.length; i++) {
      const z = this.elZonas.children[i];
      const puede = (this.zonas[i] || []).length < CAPACIDADES[i];
      const ya = (this.zonas[i] || []).some((c) => c.id === cartaId);
      if (puede && !ya && (zonas.size === 0 || zonas.has(i))) {
        z.classList.add('zona-drop');
        z.querySelectorAll('.carta').forEach((c) => c.classList.add('carta-destino'));
      }
      this._zonasNodo.push(z);
    }
  }

  _resaltarObjetivo(x, y) {
    if (!this._zonasNodo) return;
    const objetivo = this._zonaEn(x, y);
    this._zonasNodo.forEach((z) => {
      z.classList.remove('zona-drop-activa');
      z.querySelectorAll('.carta').forEach((c) => c.classList.remove('carta-destino'));
    });
    if (objetivo && objetivo.zona) objetivo.zona.classList.add('zona-drop-activa');

    // Indicador de inserción en la mano si el puntero está sobre ella
    this._actualizarIndicadorMano(x, y);
  }

  _limpiarResaltes() {
    if (this._zonasNodo) {
      this._zonasNodo.forEach((z) => {
        z.classList.remove('zona-drop', 'zona-drop-activa');
        z.querySelectorAll('.carta').forEach((c) => c.classList.remove('carta-destino'));
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
        if (i >= 0) {
          const cartaNodo = objetivo.closest('.carta');
          return {
            zona: nodo,
            indice: i,
            cartaId: (cartaNodo && cartaNodo.dataset && cartaNodo.dataset.id) || null,
          };
        }
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
    if (zona) return { tipo: 'zona', indice: zona.indice, cartaId: zona.cartaId };
    if (this._esManoEn(x, y)) {
      return { tipo: 'mano', indice: this._indiceInsercionMano(x) };
    }
    return null;
  }

  // ===== REORDEN MANUAL: indicador + índice =====

  _posicionesCartasMano() {
    const celdas = [];
    for (const nodo of this.elMano.children) {
      if (nodo.classList.contains('carta') && nodo.dataset.id !== this._cartaArrastrada) {
        const rect = nodo.getBoundingClientRect();
        celdas.push({ id: nodo.dataset.id, centro: rect.left + rect.width / 2 });
      }
    }
    return celdas;
  }

  _indiceInsercionMano(x) {
    const celdas = this._posicionesCartasMano();
    for (let i = 0; i < celdas.length; i++) {
      if (x < celdas[i].centro) return i;
    }
    return celdas.length;
  }

  _actualizarIndicadorMano(x, y) {
    if (!this._esManoEn(x, y)) {
      this._quitarIndicador();
      return;
    }
    const indice = this._indiceInsercionMano(x);
    const celdas = this._posicionesCartasMano();
    if (celdas.length === 0) {
      this._quitarIndicador();
      return;
    }
    const antes = celdas[indice];
    const despues = celdas[indice - 1];
    let nodoRef = null;
    if (antes && despues) {
      // elegir el más cercano al puntero
      nodoRef = Math.abs(antes.centro - x) <= Math.abs(despues.centro - x) ? antes : despues;
    } else if (antes) nodoRef = antes;
    else if (despues) nodoRef = despues;
    if (!nodoRef) return;

    let nodo = null;
    for (const child of this.elMano.children) {
      if (child.dataset.id === nodoRef.id) { nodo = child; break; }
    }
    if (!nodo) return;

    if (!this._elIndicador) {
      this._elIndicador = document.createElement('div');
      this._elIndicador.className = 'indicador-insercion';
      this.elMano.appendChild(this._elIndicador);
    }
    this.elMano.insertBefore(this._elIndicador, x <= nodoRef.centro ? nodo : nodo.nextSibling);
  }

  _quitarIndicador() {
    if (this._elIndicador && this._elIndicador.parentNode) {
      this._elIndicador.parentNode.removeChild(this._elIndicador);
    }
    this._elIndicador = null;
  }

  _zonasDisponibles() {
    const conjunto = new Set();
    for (let i = 0; i < this.zonas.length; i++) {
      if ((this.zonas[i] || []).length < CAPACIDADES[i]) conjunto.add(i);
    }
    return conjunto;
  }

  _buscarEnMano(id) {
    return (this._manoActual(this.e) || []).find((c) => c.id === id) || null;
  }

  // ===== SOLTAR / INTERCAMBIAR =====

  _soltarEn(origen, destino, x, y) {
    if (!this.acciones) return;
    const cartaId = origen.cartaId;
    if (!cartaId) return;

    if (destino.tipo === 'zona') {
      if (destino.cartaId && destino.cartaId !== cartaId) {
        this._intercambiar(origen, destino, cartaId);
        return;
      }
      if (destino.cartaId) return;
      const cartas = this.zonas[destino.indice] || [];
      if (cartas.length >= CAPACIDADES[destino.indice]) return;
      if (cartas.some((c) => c.id === cartaId)) return;

      if (origen.tipo === 'mano') {
        const carta = this._buscarEnMano(cartaId);
        if (!carta) return;
        this.zonas[destino.indice].push(carta);
      } else if (origen.tipo === 'zona' && origen.indice !== destino.indice) {
        const idx = this.zonas[origen.indice].findIndex((c) => c.id === cartaId);
        if (idx === -1) return;
        const [carta] = this.zonas[origen.indice].splice(idx, 1);
        this.zonas[destino.indice].push(carta);
      } else {
        return;
      }
      this._renderZonas();
      this._renderMano();
      this._renderAcciones();
      return;
    }

    if (destino.tipo === 'mano') {
      if (origen.tipo === 'mano') {
        this._moverCartaEnMano(cartaId, destino.indice);
        return;
      }
      if (origen.tipo === 'zona') {
        const idx = this.zonas[origen.indice].findIndex((c) => c.id === cartaId);
        if (idx !== -1) {
          this.zonas[origen.indice].splice(idx, 1);
          this._moverCartaEnMano(cartaId, destino.indice);
          this._renderZonas();
        }
      }
    }
  }

  _intercambiar(origen, destino, cartaId) {
    const cartasDest = this.zonas[destino.indice] || [];
    const posDest = cartasDest.findIndex((c) => c.id === destino.cartaId);
    if (posDest === -1) return;
    const cartaDest = cartasDest[posDest];
    const cartaOrigen = this._buscarEnMano(cartaId);

    if (origen.tipo === 'mano') {
      if (!cartaOrigen) return;
      // La de la zona vuelve a la mano en la posición de la que salió
      const posMano = this.ordenMano.indexOf(cartaId);
      const ids = this.ordenMano.filter((id) => id !== cartaId && id !== cartaDest.id);
      ids.splice(posMano < 0 ? ids.length : posMano, 0, cartaDest.id);
      this._historialOrden.push(this.ordenMano.slice());
      if (this._historialOrden.length > 30) this._historialOrden.shift();
      this.ordenMano = ids;
      this._guardarOrden();
      cartasDest[posDest] = cartaOrigen;
    } else if (origen.tipo === 'zona' && origen.indice !== destino.indice) {
      const posOrig = this.zonas[origen.indice].findIndex((c) => c.id === cartaId);
      if (posOrig === -1) return;
      [this.zonas[destino.indice][posDest], this.zonas[origen.indice][posOrig]] =
        [this.zonas[origen.indice][posOrig], cartaDest];
    } else {
      return;
    }

    this._renderZonas();
    this._renderMano();
    this._renderAcciones();
  }

  _emularClic(origen) {
    if (origen.tipo === 'mano') {
      const carta = this._buscarEnMano(origen.cartaId);
      if (carta && this.acciones) this.acciones.seleccionarCarta(carta.id);
    } else if (origen.tipo === 'zona') {
      if (this.acciones) this.acciones.sacarDeZona(origen.indice, origen.cartaId);
    }
  }

  // ===== RENDER =====

  _renderChipSala() {
    if (this.e && this.e.sala && this.chipSala) {
      this.chipSala.textContent = `🟢 Sala ${this.e.sala}`;
      this.chipSala.classList.remove('hidden');
    }
  }

  _renderAsientos() {
    const e = this.e;
    if (!this.elAsientos) return;

    const jugadores = e.jugadores || [];
    const ordenados = jugadores.slice().sort((a, b) => a.numero - b.numero);

    this.elAsientos.innerHTML = '';

    if (ordenados.length === 0) return;

    for (const jug of ordenados) {
      const ficha = document.createElement('div');
      ficha.className = 'ficha';
      if (jug.numero === e.soyJugador) ficha.classList.add('es-yo');
      if (jug.esTurno) ficha.classList.add('es-turno');
      if (jug.esGanador) ficha.classList.add('ganador');

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.style.background = jug.color || '#fbbf24';
      avatar.textContent = String(jug.numero);
      if (jug.esHost) {
        const badge = document.createElement('span');
        badge.className = 'host-badge';
        badge.textContent = '👑';
        avatar.appendChild(badge);
      }

      const info = document.createElement('div');
      info.className = 'info';
      const nombre = document.createElement('div');
      nombre.className = 'nombre';
      nombre.textContent = (jug.esGanador ? '👑 ' : '') + (jug.nombre || 'Jugador');
      const detalle = document.createElement('div');
      detalle.className = 'detalle' + (jug.esTurno ? ' turno' : '');
      detalle.textContent = jug.esGanador
        ? 'Ganó 4-4-3'
        : jug.esTurno
          ? '⏳ Su turno…'
          : jug.numero === e.soyJugador
            ? (this._manoActual(e) || []).length + ' cartas'
            : (jug.cartas || 0) + ' cartas';
      info.appendChild(nombre);
      info.appendChild(detalle);

      const mini = document.createElement('div');
      mini.className = 'mini-cartas';
      const n = jug.numero === e.soyJugador ? (this._manoActual(e) || []).length : (jug.cartas || 0);
      for (let i = 0; i < Math.min(n, 4); i++) {
        mini.appendChild(document.createElement('span'));
      }

      ficha.appendChild(avatar);
      ficha.appendChild(info);
      ficha.appendChild(mini);
      this.elAsientos.appendChild(ficha);
    }
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

    const miTurno = e.turno === e.soyJugador && !e.ganador;
    const nombreTurno = this._nombreDe(e.turno);

    let globo = '—';
    let globoClase = 'globo';
    if (e.ganador === 0) {
      globo = 'EMPATE';
      globoClase += ' empate';
    } else if (e.ganador === e.soyJugador) {
      globo = '¡VICTORIA!';
      globoClase += ' exito';
    } else if (e.ganador) {
      globo = 'DERROTA';
      globoClase += ' fracaso';
    } else if (e.fase === 'robar' && miTurno) {
      globo = 'ROBA UNA CARTA';
      globoClase += ' acento';
    } else if (e.fase === 'decidir' && miTurno) {
      globo = 'ORGANIZA TU 4-4-3';
      globoClase += ' acento';
    } else if (e.fase === 'robar') {
      globo = `TURNO DE ${nombreTurno}`;
    } else if (e.fase === 'decidir') {
      globo = `${nombreTurno} ORGANIZA…`;
    }
    this.elGloboTurno.textContent = globo;
    this.elGloboTurno.className = globoClase;

    if (e.ganador === e.soyJugador) {
      this.elEstado.textContent = 'Has cantado 4-4-3. ¡Cobras la partida!';
    } else if (e.ganador) {
      const quien = this._jugadorDe(e.ganador);
      const nombre = (quien && quien.nombre) || 'Otro jugador';
      this.elEstado.textContent = `${nombre} cantó 4-4-3. ¡Mejor suerte en la próxima!`;
    } else if (e.ganador === 0) {
      this.elEstado.textContent = 'Empate: el mazo y el descarte se agotaron.';
    } else if (e.fase === 'robar' && miTurno) {
      this.elEstado.textContent = 'Roba una carta del mazo o del descarte para comenzar tu turno.';
    } else if (e.fase === 'decidir' && miTurno) {
      this.elEstado.textContent = e.puede443
        ? '🎉 ¡Tienes 4-4-3! Organiza las cartas en los grupos y canta victoria.'
        : 'Organiza tus 11 cartas en grupos (C:3, A:4, B:4) o bota una carta.';
    } else {
      this.elEstado.textContent = 'Esperando a los demás jugadores…';
    }
  }

  _jugadorDe(numero) {
    return (this.e && this.e.jugadores || []).find((j) => j.numero === numero);
  }

  _nombreDe(numero) {
    const j = this._jugadorDe(numero);
    return (j && j.nombre) || 'Jugador ' + numero;
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
    etiqueta.textContent = ETIQUETAS_ZONAS[indice] || 'Zona';
    zona.appendChild(etiqueta);

    if (cartas.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'vacio-zona';
      vacio.textContent = 'Arrastra aquí tus cartas';
      zona.appendChild(vacio);
    }

    cartas.forEach((carta) => {
      const nodo = crearElementoCarta(carta);
      nodo.dataset.zona = String(indice);
      if (this._zonaValida(cartas)) nodo.classList.add('c-zona-bien');
      this._vincularArrastre(nodo, { tipo: 'zona', indice, cartaId: carta.id });
      zona.appendChild(nodo);
    });

    zona.onclick = () => {
      if (this.seleccion && cartas.length < capacidad && this.acciones) {
        const carta = this._buscarEnMano(this.seleccion);
        if (carta && !new Set(this.zonas.flat().map((c) => c.id)).has(carta.id)) {
          this.zonas[indice].push(carta);
          this.seleccion = null;
          this._renderZonas();
          this._renderMano();
          this._renderAcciones();
        }
      }
    };

    if (cartas.length === capacidad && this._zonaValida(cartas)) {
      zona.classList.add('valida');
    }

    return zona;
  }

  _renderZonas() {
    const miTurnoReal = this._esMiTurnoReal(this.e);
    if (!miTurnoReal) {
      this.elZonas.classList.add('hidden');
      this.elZonas.innerHTML = '';
      return;
    }
    this.elZonas.classList.remove('hidden');
    this.elZonas.innerHTML = '';
    for (let i = 0; i < CAPACIDADES.length; i++) {
      this.elZonas.appendChild(this._buildZona(i));
    }
  }

  _renderMano() {
    const e = this.e;
    const mano = this._manoActual(e);

    if (this.elManoContador) {
      this.elManoContador.textContent = `(${mano.length})`;
    }
    if (this.elMiNombre) {
      const yo = this._jugadorDe(e.soyJugador);
      this.elMiNombre.textContent = (yo && (yo.nombre || 'Jugador')) || 'Jugador';
      if (yo && yo.color) this.elMiNombre.style.color = yo.color;
    }

    const enZonas = new Set(this.zonas.flat().map((c) => c.id));
    const porId = {};
    mano.forEach((c) => { porId[c.id] = c; });

    this.elMano.innerHTML = '';

    // Orden: usar el orden manual, pero ocultar cartas en zonas
    const idsVisibles = (this.ordenMano.length ? this.ordenMano : mano.map((c) => c.id))
      .filter((id) => enZonas.has(id) === false);

    if (idsVisibles.length === 0) {
      this.elMano.classList.add('vacio');
    } else {
      this.elMano.classList.remove('vacio');
    }

    idsVisibles.forEach((id) => {
      const carta = porId[id];
      if (!carta) return;
      const nodo = crearElementoCarta(carta);
      if (carta.id === this.seleccion) nodo.classList.add('seleccionada');
      if (e.ganador) nodo.classList.add('deshabilitada');
      this._vincularArrastre(nodo, { tipo: 'mano', cartaId: carta.id });
      this.elMano.appendChild(nodo);
    });
  }

  _renderHerramientas() {
    if (!this.elHerramientas) return;
    if (this.e && this.e.ganador != null) {
      this.elHerramientas.innerHTML = '';
      return;
    }
    const hayHistorial = this._historialOrden.length > 0;
    const defs = [
      { texto: '🔢 Valor', accion: () => this._ordenManualTipo('valor') },
      { texto: '♠️ Palo', accion: () => this._ordenManualTipo('palo') },
      { texto: '♠️🔢 Ambos', accion: () => this._ordenManualTipo('ambos') },
      { texto: '↩️ Deshacer', accion: () => this._deshacerOrden(), deshabilitado: !hayHistorial },
    ];
    this.elHerramientas.innerHTML = '';
    for (const def of defs) {
      const btn = this._boton(def.texto, def.accion, 'btn-secundario', def.deshabilitado || false);
      btn.classList.add('btn-mini');
      this.elHerramientas.appendChild(btn);
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
      espera.textContent = '⏳ Esperando el turno de otro jugador…';
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

      botones.push(this._boton('👑 Cantar 4-4-3', () => this.acciones.cantar(), 'boton-ganador', !puedeCantar));
      botones.push(this._boton('🗑 Botar carta seleccionada', () => this.acciones.botar(this.seleccion), 'boton-peligro', !seleccionEnMano));
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

  _limpiarZonas() {
    this.zonas = [[], [], []];
    this.seleccion = null;
  }
}