import { GameController } from './controllers/GameController.js';
import { MAX_JUGADORES } from './models/CardGameModel.js';

const CLAVE_RECIENTES = 'salas-recientes-443';
const SALAS_PUBLICAS = Array.from({ length: 15 }, (_, i) => `sala-publica-${i + 1}`);

function obtenerRecientes() {
  try {
    const raw = localStorage.getItem(CLAVE_RECIENTES);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) { return []; }
}

function guardarRecientes(lista) {
  try {
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista.slice(0, 8)));
  } catch (e) { /* sin almacenamiento */ }
}

function registrarSala(codigo, esHost) {
  if (!codigo) return;
  const lista = obtenerRecientes();
  const sinDuplicado = lista.filter((s) => s.codigo !== codigo);
  sinDuplicado.unshift({ codigo, nombre: esHost ? `Yo (${codigo})` : codigo, fecha: Date.now(), esHost });
  guardarRecientes(sinDuplicado);
}

function pantalla(id) {
  document.querySelectorAll('.pantalla').forEach((p) => p.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  const mesa = document.getElementById('mesa');
  if (mesa) mesa.classList.add('hidden');
}

function mostrarInicio() {
  pantalla('pantalla-inicio');
  const mesa = document.getElementById('mesa');
  if (mesa) mesa.classList.add('hidden');
}

function mostrarMesa() {
  document.querySelectorAll('.pantalla').forEach((p) => p.classList.add('hidden'));
  const mesa = document.getElementById('mesa');
  if (mesa) mesa.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const control = new GameController();

  const inputNombre = document.getElementById('input-nombre');
  const nombrePorDefecto = () =>
    (inputNombre && inputNombre.value.trim()) || `Jugador ${Math.floor(Math.random() * 90) + 10}`;

  control.onSalirAlInicio = () => {
    mostrarInicio();
  };

  // ===== PANTALLA DE INICIO =====
  document.getElementById('btn-jugar').addEventListener('click', () => {
    const nombre = nombrePorDefecto();
    mostrarMesa();
    control.crearSala(nombre).then((ok) => {
      if (ok && control.sala) registrarSala(control.sala, true);
    }).catch(() => {});
  });

  document.getElementById('btn-crear-privada').addEventListener('click', () => {
    const nombre = nombrePorDefecto();
    mostrarMesa();
    control.crearSala(nombre).then((ok) => {
      if (ok && control.sala) registrarSala(control.sala, true);
    }).catch(() => {});
  });

  document.getElementById('btn-unirse').addEventListener('click', () => {
    const codigo = document.getElementById('input-codigo').value.trim();
    if (!codigo || codigo.length < 5) {
      control.ui.toast('Ingresa el código completo de la sala.', 'warning');
      return;
    }
    const nombre = nombrePorDefecto();
    mostrarMesa();
    control.unirse(codigo, nombre).then((ok) => {
      if (ok) registrarSala(codigo, false);
    }).catch(() => {});
  });

  document.getElementById('btn-reglas').addEventListener('click', () => {
    control.ui.mostrarReglas();
  });

  document.getElementById('btn-ajustes').addEventListener('click', () => {
    control.ui.alerta('Ajustes', 'Por ahora puedes silenciar el sonido con el botón 🔊 de la cabecera.');
  });

  document.getElementById('btn-lobby').addEventListener('click', () => {
    rendercirLobby();
    rendercirPublicas();
    pantalla('pantalla-lobby');
  });

  // ===== PANTALLA LOBBY (recientes + código) =====
  document.getElementById('btn-lobby-volver').addEventListener('click', () => {
    pantalla('pantalla-inicio');
  });

  document.getElementById('btn-lobby-refrescar').addEventListener('click', () => {
    rendercirLobby();
    rendercirPublicas();
  });

  document.getElementById('btn-publicas-refrescar').addEventListener('click', () => {
    rendercirPublicas();
  });

  document.getElementById('btn-lobby-crear').addEventListener('click', () => {
    const nombre = nombrePorDefecto();
    mostrarMesa();
    control.crearSala(nombre).then((ok) => {
      if (ok && control.sala) registrarSala(control.sala, true);
    }).catch(() => {});
  });

  function rendercirLobby() {
    const lista = obtenerRecientes();
    const contador = document.getElementById('lobby-contador');
    const contenedor = document.getElementById('lista-salas');

    if (contador) contador.textContent = `${lista.length} sala${lista.length === 1 ? '' : 's'} guardada${lista.length === 1 ? '' : 's'} en este dispositivo`;
    if (!contenedor) return;

    contenedor.innerHTML = '';
    if (lista.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'lista-vacia';
      vacio.innerHTML = 'Aún no hay salas recientes.<br>Crea una sala o únete con un código.';
      contenedor.appendChild(vacio);
      return;
    }

    for (const sala of lista) {
      const card = document.createElement('div');
      card.className = 'sala-card estado-disponible';

      const nombre = document.createElement('div');
      nombre.className = 'sala-nombre';
      nombre.textContent = sala.nombre || sala.codigo;

      const codigo = document.createElement('div');
      codigo.className = 'sala-codigo';
      codigo.textContent = sala.codigo;

      const meta = document.createElement('div');
      meta.className = 'sala-meta';
      const jugadores = document.createElement('span');
      jugadores.className = 'sala-jugadores';
      jugadores.textContent = 'Hasta ' + MAX_JUGADORES + ' jugadores';
      const badge = document.createElement('span');
      badge.className = 'badge-estado disponible';
      badge.textContent = sala.esHost ? 'Creada' : 'Visitada';
      meta.appendChild(jugadores);
      meta.appendChild(badge);

      const acciones = document.createElement('div');
      acciones.className = 'sala-acciones';
      const btnUnir = document.createElement('button');
      btnUnir.className = 'btn btn-verde btn-mini';
      btnUnir.textContent = 'Copiar código';
      btnUnir.addEventListener('click', () => {
        try {
          navigator.clipboard.writeText(sala.codigo);
          btnUnir.textContent = '✓ Copiado';
          setTimeout(() => { btnUnir.textContent = 'Copiar código'; }, 1500);
        } catch (e) { /* sin portapapeles */ }
      });
      const btnEliminar = document.createElement('button');
      btnEliminar.className = 'btn btn-secundario btn-mini';
      btnEliminar.textContent = '✕';
      btnEliminar.title = 'Eliminar de recientes';
      btnEliminar.addEventListener('click', () => {
        guardarRecientes(obtenerRecientes().filter((s) => s.codigo !== sala.codigo));
        rendercirLobby();
      });
      acciones.appendChild(btnUnir);
      acciones.appendChild(btnEliminar);

      card.appendChild(nombre);
      card.appendChild(codigo);
      card.appendChild(meta);
      card.appendChild(acciones);
      contenedor.appendChild(card);
    }
  }

  // ===== SALAS PÚBLICAS =====

  let ocupacionPublicas = {};
  let probeandoPublicas = false;

  function estadoPublica(info) {
    if (!info) return { texto: 'Consultando ocupación…', badge: 'espera', etiqueta: '…', entrar: false, boton: 'Consultando…' };
    const max = info.maxJugadores || MAX_JUGADORES;
    if (!info.existe) return { texto: 'Vacía · sé el primero en entrar', badge: 'disponible', etiqueta: 'Libre', entrar: true, boton: 'Abrir sala' };
    if (info.enPartida) return { texto: `${info.cantidad}/${max} · partida en curso`, badge: 'juego', etiqueta: 'Jugando', entrar: false, boton: 'En partida' };
    if (info.cantidad >= max) return { texto: `${info.cantidad}/${max} · sala llena`, badge: 'llena', etiqueta: 'Llena', entrar: false, boton: 'Llena' };
    return { texto: `${info.cantidad}/${max} jugador${info.cantidad === 1 ? '' : 'es'} esperando`, badge: 'espera', etiqueta: 'Abierta', entrar: true, boton: 'Entrar' };
  }

  function crearCardPublica(codigo, info) {
    const numero = codigo.split('-').pop();
    const st = estadoPublica(info);

    const card = document.createElement('div');
    card.className = `sala-card publica estado-${st.badge}`;

    const nombre = document.createElement('div');
    nombre.className = 'sala-nombre';
    nombre.textContent = `Sala pública ${numero}`;

    const codigoEl = document.createElement('div');
    codigoEl.className = 'sala-codigo';
    codigoEl.textContent = codigo;

    const meta = document.createElement('div');
    meta.className = 'sala-meta';
    const jugadores = document.createElement('span');
    jugadores.className = 'sala-jugadores';
    jugadores.textContent = st.texto;
    const badge = document.createElement('span');
    badge.className = `badge-estado ${st.badge}`;
    badge.textContent = st.etiqueta;
    meta.appendChild(jugadores);
    meta.appendChild(badge);

    const acciones = document.createElement('div');
    acciones.className = 'sala-acciones';
    const btnEntrar = document.createElement('button');
    btnEntrar.className = 'btn btn-verde btn-mini';
    btnEntrar.textContent = st.boton;
    btnEntrar.disabled = !st.entrar;
    btnEntrar.addEventListener('click', () => entrarPublica(codigo));
    acciones.appendChild(btnEntrar);

    card.appendChild(nombre);
    card.appendChild(codigoEl);
    card.appendChild(meta);
    card.appendChild(acciones);
    return card;
  }

  function pintarPublicas(conResultados) {
    const contenedor = document.getElementById('lista-publicas');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    for (const codigo of SALAS_PUBLICAS) {
      const info = conResultados ? (ocupacionPublicas[codigo] || null) : undefined;
      contenedor.appendChild(crearCardPublica(codigo, info));
    }
  }

  async function rendercirPublicas() {
    const contador = document.getElementById('publicas-contador');
    if (probeandoPublicas) return;
    probeandoPublicas = true;
    if (contador) contador.textContent = `Consultando ocupación de ${SALAS_PUBLICAS.length} salas…`;
    pintarPublicas(false);
    try {
      const resultados = await control.prospectarSalasPublicas(SALAS_PUBLICAS);
      ocupacionPublicas = resultados || {};
      pintarPublicas(true);
      const activas = SALAS_PUBLICAS.filter((c) => ocupacionPublicas[c] && ocupacionPublicas[c].existe).length;
      if (contador) contador.textContent = `${activas} de ${SALAS_PUBLICAS.length} salas con jugadores`;
    } catch (e) {
      pintarPublicas(true);
      if (contador) contador.textContent = `${SALAS_PUBLICAS.length} salas públicas`;
    } finally {
      probeandoPublicas = false;
    }
  }

  function entrarPublica(codigo) {
    const nombre = nombrePorDefecto();
    mostrarMesa();
    control.entrarSalaPublica(codigo, nombre);
  }

  window.addEventListener('beforeunload', () => {
    if (control.red) control.red.cerrar();
  });
});