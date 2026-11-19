const CACHE_NAME = 'cartas443-v1';
const ASSETS = [
  './',
  './index.html',
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
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((resp) => resp || fetch(e.request))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
