import { Card, crearBaraja } from './Card.js';

export const CARTAS_POR_JUGADOR = 10;
export const MIN_JUGADORES = 2;
export const MAX_JUGADORES = 4;
export const CARTAS_PARA_CANTAR = 11;

export function mezclar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export class CardGameModel {
  constructor(numJugadores = MIN_JUGADORES) {
    this.numJugadores = Math.min(Math.max(numJugadores, MIN_JUGADORES), MAX_JUGADORES);
    this.mazo = [];
    this.descarte = [];
    this.manos = {};
    this.turno = 1;
    this.fase = 'robar'; // 'robar' | 'decidir' | 'fin'
    this.ganador = null;
    this.ultimoEvento = null;
    this.nuevasCartas = [];
    this.iniciarPartida();
  }

  resetear() {
    this.iniciarPartida();
  }

  _crearManosVacias() {
    const manos = {};
    for (let j = 1; j <= this.numJugadores; j++) manos[j] = [];
    return manos;
  }

  iniciarPartida() {
    this.mazo = mezclar(crearBaraja());
    this.descarte = [];
    this.manos = this._crearManosVacias();
    this.ganador = null;
    this.ultimoEvento = null;
    this.nuevasCartas = [];

    for (let i = 0; i < CARTAS_POR_JUGADOR; i++) {
      for (let jugador = 1; jugador <= this.numJugadores; jugador++) {
        this.manos[jugador].push(this.mazo.pop());
      }
    }

    const primera = this.mazo.pop();
    this.descarte.push(primera);
    this.nuevasCartas.push(primera);

    this.turno = Math.floor(Math.random() * this.numJugadores) + 1;
    this.fase = 'robar';
  }

  _siguienteTurno(jugador) {
    // Cicla solo entre los números que aún están en la partida (manos activas).
    const activos = Object.keys(this.manos).map(Number).sort((a, b) => a - b);
    if (activos.length === 0) return jugador;
    const mayor = activos.find((n) => n > jugador);
    return mayor !== undefined ? mayor : activos[0];
  }

  quitarJugador(numero) {
    // Un jugador abandonó: se retira su mano y, si era su turno, pasa al siguiente activo.
    if (!this.manos[numero]) return;
    const eraSuTurno = this.turno === numero;
    delete this.manos[numero];
    if (eraSuTurno) this.turno = this._siguienteTurno(numero);
  }

  toJSON() {
    return {
      numJugadores: this.numJugadores,
      mazo: this.mazo.map((c) => c.toJSON()),
      descarte: this.descarte.map((c) => c.toJSON()),
      manos: Object.fromEntries(
        Object.entries(this.manos).map(([k, v]) => [k, v.map((c) => c.toJSON())])
      ),
      turno: this.turno,
      fase: this.fase,
      ganador: this.ganador,
      ultimoEvento: this.ultimoEvento,
      nuevasCartas: this.nuevasCartas.map((c) => c.toJSON()),
    };
  }

  static fromJSON(datos) {
    if (!datos) return null;
    const modelo = Object.create(CardGameModel.prototype);
    modelo.numJugadores = datos.numJugadores || MIN_JUGADORES;
    modelo.mazo = (datos.mazo || []).map((c) => Card.fromJSON(c));
    modelo.descarte = (datos.descarte || []).map((c) => Card.fromJSON(c));
    modelo.manos = {};
    for (const [k, v] of Object.entries(datos.manos || {})) {
      modelo.manos[k] = (v || []).map((c) => Card.fromJSON(c));
    }
    modelo.turno = datos.turno || 1;
    modelo.fase = datos.fase || 'robar';
    modelo.ganador = datos.ganador != null ? datos.ganador : null;
    modelo.ultimoEvento = datos.ultimoEvento || null;
    modelo.nuevasCartas = (datos.nuevasCartas || []).map((c) => Card.fromJSON(c));
    return modelo;
  }

  _manoAtope(jugador) {
    return this.manos[jugador] && this.manos[jugador].length >= CARTAS_PARA_CANTAR;
  }

  robarDelMazo(jugador) {
    if (this.fase !== 'robar') return null;
    if (!this.manos[jugador]) return null;
    if (this._manoAtope(jugador)) return null;

    this.recomponerMazo();
    if (this.mazo.length === 0) {
      return this.robarDelDescarte(jugador);
    }

    const carta = this.mazo.pop();
    this.manos[jugador].push(carta);
    this.nuevasCartas = [carta];
    this.fase = 'decidir';
    this.ultimoEvento = { tipo: 'robar', fuente: 'mazo', jugador };
    return carta;
  }

  robarDelDescarte(jugador) {
    if (this.fase !== 'robar') return null;
    if (!this.manos[jugador]) return null;
    if (this.descarte.length === 0) return null;
    if (this._manoAtope(jugador)) return null;

    const carta = this.descarte.pop();
    this.manos[jugador].push(carta);
    this.nuevasCartas = [carta];
    this.fase = 'decidir';
    this.ultimoEvento = { tipo: 'robar', fuente: 'descarte', jugador };
    return carta;
  }

  recomponerMazo() {
    if (this.mazo.length > 0) return;
    if (this.descarte.length <= 1) return;
    const tapa = this.descarte.pop();
    this.mazo = mezclar(this.descarte);
    this.descarte = [tapa];
  }

  botar(jugador, cartaId) {
    if (this.fase !== 'decidir') return null;
    const mano = this.manos[jugador];
    if (!mano) return null;
    const indice = mano.findIndex((c) => c.id === cartaId);
    if (indice === -1) return null;

    const [carta] = mano.splice(indice, 1);
    this.descarte.push(carta);
    this.nuevasCartas = [];
    this.ultimoEvento = { tipo: 'botar', jugador, carta };
    this.fase = 'robar';
    this.turno = this._siguienteTurno(jugador);
    return carta;
  }

  cantar443(jugador) {
    if (this.fase !== 'decidir') return false;
    const puede = CardGameModel.validar443(this.manos[jugador]);
    if (puede) {
      this.ganador = jugador;
      this.fase = 'fin';
      this.ultimoEvento = { tipo: 'canto', jugador };
    }
    return puede;
  }

  getFaseActual() {
    return this.fase;
  }

  static validarGrupo(cartas) {
    if (!Array.isArray(cartas)) return false;
    if (cartas.length === 0) return false;
    // Solo se mira el número: todas las cartas deben compartir el mismo valor.
    // El palo (símbolo) no importa.
    return cartas.every((c) => c.valor === cartas[0].valor);
  }

  static combinaciones(indices, k) {
    const resultados = [];
    const visitados = new Set();
    const yaVisto = new Set();

    function generar(inicio, actual) {
      if (actual.length === k) {
        const clave = actual.join(',');
        if (yaVisto.has(clave)) return;
        yaVisto.add(clave);
        resultados.push([...actual]);
        return;
      }
      for (let i = inicio; i < indices.length; i++) {
        const id = indices[i];
        if (visitados.has(id)) continue;
        visitados.add(id);
        generar(i + 1, [...actual, id]);
        visitados.delete(id);
      }
    }

    generar(0, []);
    return resultados;
  }

  static validar443(mano) {
    if (!Array.isArray(mano) || mano.length !== CARTAS_PARA_CANTAR) return false;

    const indices = mano.map((_, i) => i);

    for (const comboA of CardGameModel.combinaciones(indices, 4)) {
      const grupoA = comboA.map((i) => mano[i]);
      if (!CardGameModel.validarGrupo(grupoA)) continue;

      const restantesB = indices.filter((i) => !comboA.includes(i));
      for (const comboB of CardGameModel.combinaciones(restantesB, 4)) {
        const grupoB = comboB.map((i) => mano[i]);
        if (!CardGameModel.validarGrupo(grupoB)) continue;

        const restantesC = restantesB.filter((i) => !comboB.includes(i));
        const grupoC = restantesC.map((i) => mano[i]);
        if (CardGameModel.validarGrupo(grupoC)) {
          return true;
        }
      }
    }
    return false;
  }

  static encontrarCombinacion(mano) {
    if (!Array.isArray(mano) || mano.length !== CARTAS_PARA_CANTAR) return null;

    const indices = mano.map((_, i) => i);

    for (const comboA of CardGameModel.combinaciones(indices, 4)) {
      const grupoA = comboA.map((i) => mano[i]);
      if (!CardGameModel.validarGrupo(grupoA)) continue;

      const restantesB = indices.filter((i) => !comboA.includes(i));
      for (const comboB of CardGameModel.combinaciones(restantesB, 4)) {
        const grupoB = comboB.map((i) => mano[i]);
        if (!CardGameModel.validarGrupo(grupoB)) continue;

        const restantesC = restantesB.filter((i) => !comboB.includes(i));
        const grupoC = restantesC.map((i) => mano[i]);
        if (CardGameModel.validarGrupo(grupoC)) {
          return {
            grupos: [grupoA, grupoB, grupoC],
            descripcion: [
              CardGameModel.describirGrupo(grupoA),
              CardGameModel.describirGrupo(grupoB),
              CardGameModel.describirGrupo(grupoC),
            ],
          };
        }
      }
    }
    return null;
  }

  static describirGrupo(grupo) {
    if (!Array.isArray(grupo) || grupo.length === 0) return '';
    const etiqueta = grupo.length === 4 ? 'Cuarteto' : grupo.length === 3 ? 'Trío' : 'Grupo';
    return `${etiqueta} de ${grupo[0].nombre}`;
  }
}
