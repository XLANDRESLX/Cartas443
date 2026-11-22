import { MAX_JUGADORES } from '../models/CardGameModel.js';
import { crearElemento, copiarTexto } from '../utils/dom.js';
import {
  obtenerRecientes,
  guardarRecientes,
  eliminarSalaReciente,
} from '../utils/storage.js';

const SALAS_PUBLICAS = Array.from({ length: 15 }, (_, i) => `sala-publica-${i + 1}`);

export class LobbyView {
  constructor({ control, alCrear, alEntrar, alEntrarPublica } = {}) {
    this.control = control;
    this.alCrear = alCrear || (() => {});
    this.alEntrar = alEntrar || ((codigo) => this.alEntrarPublica(codigo));
    this.alEntrarPublica = alEntrarPublica || this.alEntrar;
    this.ocupacion = {};
    this.probeando = false;

    this.lista = document.getElementById('lista-salas');
    this.listaPublicas = document.getElementById('lista-publicas');
    this.contador = document.getElementById('lobby-contador');
    this.contadorPublicas = document.getElementById('publicas-contador');

    this._vincular();
  }

  _vincular() {
    const refrescar = document.getElementById('btn-lobby-refrescar');
    if (refrescar) refrescar.addEventListener('click', () => this.actualizar());

    const refrescarPublicas = document.getElementById('btn-publicas-refrescar');
    if (refrescarPublicas) refrescarPublicas.addEventListener('click', () => this.actualizarPublicas());
  }

  actualizar() {
    this.renderRecientes();
    this.actualizarPublicas();
  }

  renderRecientes() {
    if (!this.lista) return;
    const salas = obtenerRecientes();
    if (this.contador) {
      this.contador.textContent = `${salas.length} sala${salas.length === 1 ? '' : 's'} guardada${salas.length === 1 ? '' : 's'} en este dispositivo`;
    }

    this.lista.innerHTML = '';
    if (salas.length === 0) {
      const vacio = crearElemento('div', 'lista-vacia');
      vacio.innerHTML = 'Aún no hay salas recientes.<br>Crea una o entra con un código.';
      this.lista.appendChild(vacio);
      return;
    }

    for (const sala of salas) {
      const tarjeta = crearElemento('div', 'sala-card estado-disponible');

      tarjeta.appendChild(crearElemento('div', 'sala-nombre', sala.nombre || sala.codigo));
      tarjeta.appendChild(crearElemento('div', 'sala-codigo', sala.codigo));

      const meta = crearElemento('div', 'sala-meta');
      meta.appendChild(crearElemento('span', 'sala-jugadores', `Hasta ${MAX_JUGADORES} jugadores`));
      const badge = crearElemento('span', `badge-estado ${sala.esHost ? 'disponible' : 'espera'}`, sala.esHost ? 'Creada' : 'Visitada');
      meta.appendChild(badge);
      tarjeta.appendChild(meta);

      const acciones = crearElemento('div', 'sala-acciones');

      const btnCopiar = crearElemento('button', 'btn btn-secundario btn-mini', 'Copiar código');
      btnCopiar.type = 'button';
      btnCopiar.addEventListener('click', async () => {
        const ok = await copiarTexto(sala.codigo);
        btnCopiar.textContent = ok ? '✓ Copiado' : 'No se pudo copiar';
        if (ok) setTimeout(() => { btnCopiar.textContent = 'Copiar código'; }, 1500);
        if (!ok && this.control.ui) this.control.ui.toast('No se pudo acceder al portapapeles.', 'warning');
      });

      const btnEntrar = crearElemento('button', 'btn btn-verde btn-mini', 'Entrar');
      btnEntrar.type = 'button';
      btnEntrar.addEventListener('click', () => this.alEntrar(sala.codigo));

      const btnBorrar = crearElemento('button', 'btn btn-secundario btn-mini', '✕');
      btnBorrar.type = 'button';
      btnBorrar.title = 'Eliminar de recientes';
      btnBorrar.setAttribute('aria-label', `Eliminar sala ${sala.codigo}`);
      btnBorrar.addEventListener('click', () => {
        eliminarSalaReciente(sala.codigo);
        this.renderRecientes();
      });

      acciones.append(btnCopiar, btnEntrar, btnBorrar);
      tarjeta.appendChild(acciones);
      this.lista.appendChild(tarjeta);
    }
  }

  async actualizarPublicas() {
    if (this.probeando) return;
    this.probeando = true;
    if (this.contadorPublicas) this.contadorPublicas.textContent = `Consultando ${SALAS_PUBLICAS.length} salas…`;
    this._pintarPublicas(false);

    try {
      const resultados = await this.control.prospectarSalasPublicas(SALAS_PUBLICAS);
      this.ocupacion = resultados || {};
      this._pintarPublicas(true);
      const activas = SALAS_PUBLICAS.filter((c) => this.ocupacion[c] && this.ocupacion[c].existe).length;
      if (this.contadorPublicas) {
        this.contadorPublicas.textContent = `${activas} de ${SALAS_PUBLICAS.length} salas con jugadores`;
      }
    } catch (e) {
      this._pintarPublicas(true);
      if (this.contadorPublicas) this.contadorPublicas.textContent = `${SALAS_PUBLICAS.length} salas públicas`;
    } finally {
      this.probeando = false;
    }
  }

  _estadoPublica(info) {
    if (!info) {
      return { texto: 'Consultando ocupación…', badge: 'espera', etiqueta: '…', entrar: false, boton: 'Consultando…' };
    }
    const max = info.maxJugadores || MAX_JUGADORES;
    if (!info.existe) {
      return { texto: 'Vacía · sé el primero en entrar', badge: 'disponible', etiqueta: 'Libre', entrar: true, boton: 'Abrir sala' };
    }
    if (info.enPartida) {
      return { texto: `${info.cantidad}/${max} · partida en curso`, badge: 'juego', etiqueta: 'Jugando', entrar: false, boton: 'En partida' };
    }
    if (info.cantidad >= max) {
      return { texto: `${info.cantidad}/${max} · sala llena`, badge: 'llena', etiqueta: 'Llena', entrar: false, boton: 'Llena' };
    }
    return {
      texto: `${info.cantidad}/${max} jugador${info.cantidad === 1 ? '' : 'es'} esperando`,
      badge: 'espera',
      etiqueta: 'Abierta',
      entrar: true,
      boton: 'Entrar',
    };
  }

  _pintarPublicas(conResultados) {
    if (!this.listaPublicas) return;
    this.listaPublicas.innerHTML = '';

    for (const codigo of SALAS_PUBLICAS) {
      const info = conResultados ? (this.ocupacion[codigo] || null) : undefined;
      const estado = this._estadoPublica(info);
      const numero = codigo.split('-').pop();

      const tarjeta = crearElemento('div', `sala-card publica estado-${estado.badge}`);
      tarjeta.appendChild(crearElemento('div', 'sala-nombre', `Sala pública ${numero}`));
      tarjeta.appendChild(crearElemento('div', 'sala-codigo', codigo));

      const meta = crearElemento('div', 'sala-meta');
      meta.appendChild(crearElemento('span', 'sala-jugadores', estado.texto));
      meta.appendChild(crearElemento('span', `badge-estado ${estado.badge}`, estado.etiqueta));
      tarjeta.appendChild(meta);

      const acciones = crearElemento('div', 'sala-acciones');
      const btn = crearElemento('button', 'btn btn-verde btn-mini', estado.boton);
      btn.type = 'button';
      btn.disabled = !estado.entrar;
      btn.addEventListener('click', () => this.alEntrarPublica(codigo));
      acciones.appendChild(btn);
      tarjeta.appendChild(acciones);

      this.listaPublicas.appendChild(tarjeta);
    }
  }
}
