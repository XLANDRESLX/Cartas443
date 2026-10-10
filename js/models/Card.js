const PALOS = ['espadas', 'corazones', 'diamantes', 'treboles'];

const ETIQUETAS_PALO = {
  espadas: '♠',
  corazones: '♥',
  diamantes: '♦',
  treboles: '♣',
};

const ETIQUETAS_VALOR = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Orden por palo para herramientas de ordenación (solo presentación).
const ORDEN_PALOS = { espadas: 0, corazones: 1, diamantes: 2, treboles: 3 };

// Copias de cada carta en el mazo: 52 únicas × 2 = 104 cartas totales.
export const COPIAS_POR_CARTA = 2;

export class Card {
  constructor(palo, valor, copia = 0) {
    this.palo = palo;
    this.valor = valor;
    this.copia = copia;
    this.id = `${palo}-${valor}-${copia}`;
    this.nombre = ETIQUETAS_VALOR[valor];
  }

  get simbolo() {
    return ETIQUETAS_PALO[this.palo];
  }

  get esRoja() {
    return this.palo === 'corazones' || this.palo === 'diamantes';
  }

  get ordenPalo() {
    return ORDEN_PALOS[this.palo] ?? 99;
  }

  toJSON() {
    return { palo: this.palo, valor: this.valor, copia: this.copia };
  }

  static fromJSON(datos) {
    return new Card(datos.palo, datos.valor, datos.copia || 0);
  }
}

export function crearBaraja() {
  const baraja = [];
  for (let copia = 0; copia < COPIAS_POR_CARTA; copia++) {
    for (const palo of PALOS) {
      for (let valor = 1; valor <= 13; valor++) {
        baraja.push(new Card(palo, valor, copia));
      }
    }
  }
  return baraja;
}
