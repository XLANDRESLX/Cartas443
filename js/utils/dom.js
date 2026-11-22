/* Utilidades DOM ligeras, sin dependencias. */

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function crearElemento(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = texto;
  return nodo;
}

export async function copiarTexto(texto) {
  const valor = String(texto || '');
  if (!valor) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch (e) { /* continuar con el método alternativo */ }

  try {
    const temporal = document.createElement('textarea');
    temporal.value = valor;
    temporal.setAttribute('readonly', '');
    temporal.style.position = 'fixed';
    temporal.style.opacity = '0';
    document.body.appendChild(temporal);
    temporal.select();
    const copiado = document.execCommand('copy');
    document.body.removeChild(temporal);
    return copiado;
  } catch (e) {
    return false;
  }
}
