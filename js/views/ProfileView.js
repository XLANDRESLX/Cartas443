import { crearElemento } from '../utils/dom.js';
import {
  AVATARES,
  obtenerAvatar,
  obtenerNombre,
  guardarAvatar,
  guardarNombre,
} from '../utils/storage.js';

export class ProfileView {
  constructor({ ui, alGuardar } = {}) {
    this.ui = ui;
    this.alGuardar = alGuardar || (() => {});
    this.avatar = obtenerAvatar();

    this.inputNombre = document.getElementById('input-nombre');
    this.opciones = document.getElementById('opciones-avatar');
    this.avatarActual = document.getElementById('perfil-avataractual');
    this.nombreActual = document.getElementById('perfil-nombreactual');
    this.aviso = document.getElementById('aviso-perfil');
    this.formulario = document.getElementById('form-perfil');

    this._renderOpciones();
    this._vincular();
    this.actualizar();
  }

  _renderOpciones() {
    if (!this.opciones) return;
    this.opciones.innerHTML = '';
    AVATARES.forEach((avatar) => {
      const boton = crearElemento('button', 'opcion-avatar', avatar);
      boton.type = 'button';
      boton.dataset.avatar = avatar;
      boton.setAttribute('aria-label', `Avatar ${avatar}`);
      boton.addEventListener('click', () => {
        this.avatar = avatar;
        this._marcarOpcion();
        if (this.avatarActual) this.avatarActual.textContent = avatar;
      });
      this.opciones.appendChild(boton);
    });
    this._marcarOpcion();
  }

  _marcarOpcion() {
    if (!this.opciones) return;
    Array.from(this.opciones.children).forEach((boton) => {
      boton.classList.toggle('activo', boton.dataset.avatar === this.avatar);
      boton.setAttribute('aria-pressed', String(boton.dataset.avatar === this.avatar));
    });
  }

  _vincular() {
    if (!this.formulario) return;
    this.formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const nombre = guardarNombre(this.inputNombre ? this.inputNombre.value : '');
      if (!nombre) {
        if (this.ui) this.ui.toast('Escribe un nombre de jugador.', 'warning');
        return;
      }
      this.avatar = guardarAvatar(this.avatar);
      this.actualizar();
      this.alGuardar({ nombre, avatar: this.avatar });
      if (this.ui) this.ui.toast('Perfil guardado.', 'success');
    });
  }

  actualizar() {
    const nombre = obtenerNombre();
    const avatar = obtenerAvatar();
    this.avatar = avatar;

    if (this.inputNombre && nombre) this.inputNombre.value = nombre;
    if (this.avatarActual) this.avatarActual.textContent = avatar;
    if (this.nombreActual) this.nombreActual.textContent = nombre || 'Jugador';
    if (this.aviso) {
      this.aviso.textContent = nombre
        ? `Nombre guardado como «${nombre}». Se usará al crear o unirse a una sala.`
        : 'Aún no has guardado tu nombre.';
    }
    this._marcarOpcion();
  }
}

export function actualizarChipPerfil({ nombre, avatar }) {
  const chipAvatar = document.getElementById('perfil-avatar-chip');
  const chipNombre = document.getElementById('perfil-nombre-chip');
  const nombreFinal = nombre || obtenerNombre() || 'Jugador';
  const avatarFinal = avatar || obtenerAvatar();
  if (chipAvatar) chipAvatar.textContent = avatarFinal;
  if (chipNombre) chipNombre.textContent = nombreFinal;
}
