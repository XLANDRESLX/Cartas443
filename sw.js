const CACHE_NAME = 'cartas443-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/main.js',
  './js/controllers/GameController.js',
  './js/controllers/ChatController.js',
  './js/models/Card.js',
  './js/models/CardGameModel.js',
  './js/network/PeerNetwork.js',
  './js/views/BoardView.js',
  './js/views/UIControlsView.js',
  './js/views/ChatView.js',
  './js/views/AudioView.js',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cachear uno por uno: si un recurso falla, el resto sí se guarda
      for (const url of ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          // Ignorar fallos individuales para no romper la instalación
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Para recursos externos (CDNs), que el navegador los maneje normalmente
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Network-first: siempre intenta traer la versión más reciente; si falla, usa caché
  e.respondWith(
    fetch(e.request).then((network) => {
      const copia = network.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copia)).catch(() => {});
      return network;
    }).catch(() =>
      caches.match(e.request).then((resp) => resp || caches.match('./index.html'))
    )
  );
});
