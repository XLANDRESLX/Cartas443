import { crearBaraja } from './Card.js';

const CARTAS_POR_JUGADOR = 10;
const NUM_JUGADORES = 2;

export function mezclar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export class CardGameModel {
  constructor() {
    this.mazo = [];
    this.descarte = [];
    this.manos = { 1: [], 2: [] };
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

  iniciarPartida() {
    this.mazo = mezclar(crearBaraja());
    this.descarte = [];
    this.manos = { 1: [], 2: [] };
    this.ganador = null;
    this.ultimoEvento = null;
    this.nuevasCartas = [];

    for (let i = 0; i < CARTAS_POR_JUGADOR; i++) {
      for (let jugador = 1; jugador <= NUM_JUGADORES; jugador++) {
        this.manos[jugador].push(this.mazo.pop());
      }
    }

    const primera = this.mazo.pop();
    this.descarte.push(primera);
    this.nuevasCartas.push(primera);

    this.turno = Math.random() < 0.5 ? 1 : 2;
    this.fase = 'robar';
  }

  robarDelMazo(jugador) {
    if (this.fase !== 'robar') return null;
    if (this.manos[this.turno].length >= 11) return null;

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
    if (this.descarte.length === 0) return null;
    if (this.manos[this.turno].length >= 11) return null;

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
    const indice = mano.findIndex((c) => c.id === cartaId);
    if (indice === -1) return null;

    const [carta] = mano.splice(indice, 1);
    this.descarte.push(carta);
    this.nuevasCartas = [];
    this.ultimoEvento = { tipo: 'botar', jugador, carta };
    this.fase = 'robar';
    this.turno = jugador === 1 ? 2 : 1;
    return carta;
  }

  cantar443(jugador, zonas) {
    if (this.fase !== 'decidir') return false;
    const puede = CardGameModel.validarZonas(this.manos[jugador], zonas);
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
    const n = cartas.length;
    if (n === 0) return false;

    const valores = cartas.map((c) => c.valor);
    const paloUnico = cartas.every((c) => c.palo === cartas[0].palo);

    const conjuntoValido = valores.every((v) => v === valores[0]);
    const conteo = {};
    valores.forEach((v) => { conteo[v] = (conteo[v] || 0) + 1; });
    const maxRepetidos = Math.max(...Object.values(conteo));

    const escaleraValida = paloUnico && (() => {
      const orden = [...valores].sort((a, b) => a - b);
      for (let i = 1; i < orden.length; i++) {
        if (orden[i] !== orden[i - 1] + 1) return false;
      }
      return true;
    })();

    if (conjuntoValido || escaleraValida) return true;

    if (n === 4 && maxRepetidos >= 3 && !escaleraValida) return true;

    return false;
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

  static validarZonas(mano, zonas) {
    if (!Array.isArray(zonas) || zonas.length !== 3) return false;
    const tamaños = zonas.map((z) => z.length);
    if (JSON.stringify(tamaños) !== '[3,4,4]') return false;

    const enMano = new Set(mano.map((c) => c.id));
    const usadas = new Set();
    for (const zona of zonas) {
      const cartas = [];
      for (const carta of zona) {
        const tmp = typeof carta === 'string' ? { id: carta } : carta;
        if (!enMano.has(tmp.id)) return false;
        if (usadas.has(tmp.id)) return false;
        usadas.add(tmp.id);
        cartas.push(typeof carta === 'string' ? mano.find((c) => c.id === carta) : carta);
      }
      if (!CardGameModel.validarGrupo(cartas)) return false;
    }

    return usadas.size === mano.length;
  }

  static validar443(mano) {
    if (!Array.isArray(mano) || mano.length !== 11) return false;

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
    if (!Array.isArray(mano) || mano.length !== 11) return null;

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
    const valoresConsecutivos = [...grupo]
      .map((c) => c.valor)
      .sort((a, b) => a - b)
      .every((v, i, arr) => i === 0 || v === arr[i - 1] + 1);
    const paloUnico = grupo.every((c) => c.palo === grupo[0].palo);
    const mismoValor = grupo.every((c) => c.valor === grupo[0].valor);

    if (valoresConsecutivos && paloUnico && (grupo.length === 3 || grupo.length === 4)) {
      const etiquetas = [...grupo]
        .sort((a, b) => a.valor - b.valor)
        .map((c) => `${c.nombre}${c.simbolo}`)
        .join(' · ');
      return `Escalera: ${etiquetas}`;
    }

    if (mismoValor && (grupo.length === 3 || grupo.length === 4)) {
      return `${grupo.length === 3 ? 'Trío' : 'Cuarteto'} de ${grupo[0].nombre} (${grupo[0].simbolo})`;
    }

    const conteo = {};
    grupo.forEach((c) => { conteo[c.valor] = (conteo[c.valor] || 0) + 1; });
    const [valor, cantidad] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
    const cartaRef = grupo.find((c) => c.valor === Number(valor)) || grupo[0];
    return `${cantidad} cartas de ${cartaRef.nombre} (${cartaRef.simbolo})`;
  }
}