const PALOS = ['espadas', 'corazones', 'diamantes', 'treboles'];

const ETIQUETAS_PALO = {
  espadas: '♠',
  corazones: '♥',
  diamantes: '♦',
  treboles: '♣',
};

const ETIQUETAS_VALOR = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export class Card {
  constructor(palo, valor) {
    this.palo = palo;
    this.valor = valor;
    this.id = `${palo}-${valor}`;
    this.nombre = ETIQUETAS_VALOR[valor];
  }

  get simbolo() {
    return ETIQUETAS_PALO[this.palo];
  }

  get esRoja() {
    return this.palo === 'corazones' || this.palo === 'diamantes';
  }

  toJSON() {
    return { palo: this.palo, valor: this.valor };
  }

  static fromJSON(datos) {
    return new Card(datos.palo, datos.valor);
  }
}

export function crearBaraja() {
  const baraja = [];
  for (const palo of PALOS) {
    for (let valor = 1; valor <= 13; valor++) {
      baraja.push(new Card(palo, valor));
    }
  }
  return baraja;
}