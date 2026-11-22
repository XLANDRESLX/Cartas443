/* Service worker ligero: mantiene disponible la interfaz sin conexión.
   La señalización WebRTC y PeerJS siguen necesitando red; no se interceptan. */

const VERSION = '443-shell-v3';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/home.css',
  './css/lobby.css',
  './css/game.css',
  './css/responsive.css',
  './css/game-table.css',
  './js/main.js',
  './js/router.js',
  './js/controllers/GameController.js',
  './js/controllers/ChatController.js',
  './js/models/Card.js',
  './js/models/CardGameModel.js',
  './js/network/PeerNetwork.js',
  './js/views/BoardView.js',
  './js/views/UIControlsView.js',
  './js/views/ChatView.js',
  './js/views/AudioView.js',
  './js/views/LobbyView.js',
  './js/views/ProfileView.js',
  './js/views/PanelView.js',
  './js/utils/storage.js',
  './js/utils/dom.js',
  './assets/backgrounds/bosque-atardecer.svg',
  './assets/img/icono-443.svg',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((clave) => clave.startsWith('443-shell-') && clave !== VERSION)
          .map((clave) => caches.delete(clave))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const solicitud = evento.request;
  if (solicitud.method !== 'GET') return;

  const url = new URL(solicitud.url);
  if (url.origin !== self.location.origin) return;

  if (solicitud.mode === 'navigate') {
    evento.respondWith(
      fetch(solicitud)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put('./index.html', copia));
          return respuesta;
        })
        .catch(() => caches.match('./index.html').then((r) => r || Response.error()))
    );
    return;
  }

  evento.respondWith(
    caches.match(solicitud).then((enCache) => {
      if (enCache) return enCache;
      return fetch(solicitud).then((respuesta) => {
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(solicitud, copia));
        }
        return respuesta;
      });
    })
  );
});
