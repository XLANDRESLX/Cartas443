import { GameController } from './controllers/GameController.js';
import { Router } from './router.js';
import { LobbyView } from './views/LobbyView.js';
import { ProfileView, actualizarChipPerfil } from './views/ProfileView.js';
import { PanelView } from './views/PanelView.js';
import { qs, qsa } from './utils/dom.js';
import {
  obtenerAvatar,
  obtenerNombre,
  obtenerPreferencias,
  guardarPreferencias,
  registrarSalaReciente,
} from './utils/storage.js';

function iniciar() {
  const control = new GameController();
  let salidaEnCurso = false;

  const nombrePorDefecto = () =>
    obtenerNombre() || `Jugador ${Math.floor(Math.random() * 90) + 10}`;

  const sincronizarPerfil = () => {
    actualizarChipPerfil({ nombre: obtenerNombre(), avatar: obtenerAvatar() });
    if (perfil) perfil.actualizar();
  };

  // Si hay una sesión reciente, entramos directamente en su pantalla para
  // evitar un destello del menú antes de restaurar la conexión P2P.
  const sesion = control.leerSesion();
  if (sesion) {
    const guardado = control._leerPersistido(sesion.sala);
    const destino = guardado && guardado.enPartida ? 'partida' : 'sala';
    history.replaceState(null, '', `#/${destino}`);
  }

  // ===== ENRUTADOR SPA (mantiene viva la conexión WebRTC) =====

  const router = new Router({
    alCambiar: (ruta, anterior) => {
      qsa('.menu-opcion').forEach((boton) => {
        const activo = ruta === 'inicio'
          ? boton.id === 'btn-jugar'
          : boton.dataset.ruta === ruta;
        boton.classList.toggle('activo', activo);
      });

      if (ruta === 'salas' && lobby) lobby.actualizar();
      if (ruta === 'perfil' && perfil) perfil.actualizar();
      if (ruta === 'ajustes' && panel) panel.actualizar();
      if (ruta === 'crear-sala') {
        const previa = qs('#codigo-previa');
        if (previa) previa.textContent = control._generarCodigo();
      }

      // El chat flotante pertenece a la mesa: se oculta en los demás paneles.
      if (ruta === 'partida' && control.enPartida) control.chat.vista.mostrarWidget();
      else control.chat.vista.ocultarWidget();

      const volver = qs('#btn-volver-sala');
      const enFlujo = ['inicio', 'sala', 'partida'].includes(ruta);
      if (volver) volver.classList.toggle('hidden', !control.red || enFlujo);

      if (anterior === 'partida' && ruta !== 'partida') {
        // No cerramos la red: el jugador puede volver con el botón flotante.
      }
    },
  });

  router.setGuard((desde, destino) => {
    if (salidaEnCurso) return true;
    const enJuego = desde === 'partida' || desde === 'sala';
    if (!enJuego) return true;
    if (['perfil', 'reglas', 'ajustes', 'sala', 'partida'].includes(destino)) return true;
    // Navegación hacia el menú: confirmar y cerrar la sala de verdad.
    control.salir();
    return false;
  });

  const forzarInicio = () => {
    salidaEnCurso = true;
    control.vista.reiniciarVisibilidadPartida();
    const chip = qs('#chip-sala');
    if (chip) chip.classList.add('hidden');
    router.ir('inicio', { reemplazar: true });
    salidaEnCurso = false;
  };

  // ===== HOOKS DE VISTA → NAVEGACIÓN =====

  control.ui.onMostrarEspera = () => router.ir('sala');
  control.vista.onMostrarPartida = () => router.ir('partida');
  control.onSalirAlInicio = () => {
    salidaEnCurso = true;
    control.vista.reiniciarVisibilidadPartida();
    const chip = qs('#chip-sala');
    if (chip) chip.classList.add('hidden');
    router.ir('inicio', { reemplazar: true });
    salidaEnCurso = false;
    sincronizarPerfil();
  };

  // ===== VISTAS DE PANEL =====

  let lobby = null;
  let perfil = null;
  let panel = null;

  lobby = new LobbyView({
    control,
    alEntrar: (codigo) => entrar(codigo),
    alEntrarPublica: (codigo) => entrarPublica(codigo),
  });

  perfil = new ProfileView({
    ui: control.ui,
    alGuardar: () => sincronizarPerfil(),
  });

  panel = new PanelView({ audio: control.audio, ui: control.ui });

  const preferencias = obtenerPreferencias();
  control.audio.setSilenciado(!!preferencias.silenciado);
  control.audio.onCambio = (silenciado) => {
    guardarPreferencias({ silenciado });
    panel.actualizar();
  };
  panel.actualizar();
  sincronizarPerfil();

  // ===== ACCIONES DE SALA =====

  function crear(codigoPublico, nombreSala) {
    const opciones = codigoPublico ? { codigo: codigoPublico } : {};
    return control.crearSala(nombrePorDefecto(), opciones)
      .then((ok) => {
        if (ok && control.sala) {
          registrarSalaReciente(control.sala, true, nombreSala || undefined);
        }
        return ok;
      })
      .catch(() => false);
  }

  function entrar(codigo) {
    const limpio = String(codigo || '').trim();
    if (limpio.length < 5) {
      control.ui.toast('Ingresa el código completo de la sala.', 'warning');
      return Promise.resolve(false);
    }
    return control.unirse(limpio, nombrePorDefecto())
      .then((ok) => {
        if (ok) registrarSalaReciente(limpio, false);
        return ok;
      })
      .catch(() => false);
  }

  function entrarPublica(codigo) {
    return control.entrarSalaPublica(codigo, nombrePorDefecto())
      .then((ok) => {
        if (ok) registrarSalaReciente(codigo, false);
        return ok;
      })
      .catch(() => false);
  }

  // ===== EVENTOS GLOBALES =====

  qsa('[data-ruta]').forEach((elemento) => {
    elemento.addEventListener('click', (evento) => {
      evento.preventDefault();
      router.ir(elemento.dataset.ruta);
    });
  });

  const btnJugar = qs('#btn-jugar');
  if (btnJugar) btnJugar.addEventListener('click', () => crear());

  const formCrear = qs('#form-crear-sala');
  if (formCrear) {
    formCrear.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const campo = qs('#nombre-sala');
      crear(null, campo && campo.value.trim());
    });
  }

  const formUnirse = qs('#form-unirse');
  if (formUnirse) {
    formUnirse.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const campo = qs('#input-codigo');
      entrar(campo && campo.value);
    });
  }

  const btnSalirPartida = qs('#btn-salir-partida');
  if (btnSalirPartida) btnSalirPartida.addEventListener('click', () => control.salir());

  const btnVolver = qs('#btn-volver-sala');
  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      router.ir(control.enPartida ? 'partida' : 'sala');
    });
  }

  window.addEventListener('beforeunload', () => {
    if (control.red) control.red.cerrar();
  });

  // ===== ARRANQUE =====

  router.iniciar();

  if (sesion) {
    control.reanudarSesion(sesion).then((ok) => {
      if (!ok) forzarInicio();
    }).catch(() => forzarInicio());
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* modo sin conexión no crítico */ });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
  iniciar();
}
