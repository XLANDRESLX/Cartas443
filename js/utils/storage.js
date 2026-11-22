/* Almacenamiento local de preferencias e identidad del jugador. */

export const CLAVES = Object.freeze({
  nombre: 'nombre-jugador-443',
  avatar: 'avatar-jugador-443',
  preferencias: 'preferencias-443',
  recientes: 'salas-recientes-443',
});

export const AVATARES = Object.freeze(['♠', '♥', '♦', '♣', '🦊', '🐺', '🦅', '🐂', '🌿', '🔥', '🌙', '⚡']);

const PREFERENCIAS_PREDETERMINADAS = Object.freeze({
  movimientoReducido: false,
  silenciado: false,
});

function leer(clave, alternativa = null) {
  try {
    const valor = localStorage.getItem(clave);
    return valor === null ? alternativa : JSON.parse(valor);
  } catch (e) {
    return alternativa;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (e) {
    return false;
  }
}

export function obtenerNombre() {
  const nombre = leer(CLAVES.nombre, '');
  return typeof nombre === 'string' ? nombre.trim() : '';
}

export function guardarNombre(nombre) {
  const limpio = String(nombre || '').trim().slice(0, 16);
  if (!limpio) return '';
  escribir(CLAVES.nombre, limpio);
  return limpio;
}

export function obtenerAvatar() {
  const avatar = leer(CLAVES.avatar, AVATARES[0]);
  return AVATARES.includes(avatar) ? avatar : AVATARES[0];
}

export function guardarAvatar(avatar) {
  const limpio = AVATARES.includes(avatar) ? avatar : AVATARES[0];
  escribir(CLAVES.avatar, limpio);
  return limpio;
}

export function obtenerPreferencias() {
  const datos = leer(CLAVES.preferencias, {});
  return { ...PREFERENCIAS_PREDETERMINADAS, ...(datos && typeof datos === 'object' ? datos : {}) };
}

export function guardarPreferencias(parcial = {}) {
  const actuales = obtenerPreferencias();
  const nuevas = { ...actuales, ...parcial };
  escribir(CLAVES.preferencias, nuevas);
  return nuevas;
}

export function obtenerRecientes() {
  const datos = leer(CLAVES.recientes, []);
  return Array.isArray(datos) ? datos : [];
}

export function guardarRecientes(lista) {
  escribir(CLAVES.recientes, (Array.isArray(lista) ? lista : []).slice(0, 8));
}

export function registrarSalaReciente(codigo, esHost, nombre) {
  if (!codigo) return;
  const lista = obtenerRecientes().filter((s) => s && s.codigo !== codigo);
  lista.unshift({
    codigo,
    nombre: nombre || (esHost ? `Yo (${codigo})` : codigo),
    fecha: Date.now(),
    esHost: !!esHost,
  });
  guardarRecientes(lista);
}

export function eliminarSalaReciente(codigo) {
  guardarRecientes(obtenerRecientes().filter((s) => s && s.codigo !== codigo));
}
