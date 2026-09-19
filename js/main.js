import { GameController } from './controllers/GameController.js';

document.addEventListener('DOMContentLoaded', () => {
  const control = new GameController();
  control.onSalirAlInicio = () => {
    overlay.classList.remove('hidden');
  };

  const inputNombre = document.getElementById('input-nombre');
  const btnCrear = document.getElementById('btn-crear');
  const btnUnirse = document.getElementById('btn-unirse');
  const btnReglas = document.getElementById('btn-reglas');
  const overlay = document.getElementById('overlay-inicio');

  const nombrePorDefecto = () => {
    const valor = (inputNombre && inputNombre.value.trim()) || `Jugador ${Math.floor(Math.random() * 90) + 10}`;
    return valor;
  };

  btnCrear.addEventListener('click', () => {
    const nombre = nombrePorDefecto();
    overlay.classList.add('hidden');
    control.crearSala(nombre);
  });

  btnUnirse.addEventListener('click', async () => {
    const nombre = nombrePorDefecto();
    try {
      const { value: codigo } = await window.Swal.fire({
        title: 'Unirse a una sala',
        input: 'text',
        inputPlaceholder: 'Código de sala (ej: 443-XXXX)',
        inputValidator: (valor) => {
          if (!valor || valor.trim().length < 5) return 'Ingresa el código completo de la sala.';
          return null;
        },
        showCancelButton: true,
        confirmButtonText: 'Conectar',
        cancelButtonText: 'Cancelar',
        allowOutsideClick: false,
      });
      if (!codigo) return;
      overlay.classList.add('hidden');
      control.unirse(codigo, nombre);
    } catch (err) {
      /* cancelado */
    }
  });

  btnReglas.addEventListener('click', () => {
    control.ui.mostrarReglas();
  });

  window.addEventListener('beforeunload', () => {
    if (control.red) control.red.cerrar();
  });
});