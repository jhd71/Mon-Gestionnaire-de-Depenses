// sw.js - Le Service Worker pour le Gestionnaire de Dépenses (version corrigée)

const CACHE_NAME = 'gestionnaire-depenses-cache-v3';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './favicon.ico',
  './images/icon-192.png',
  './images/icon-512.png'
];

// ÉVÉNEMENT 1 : L'installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Coffre-fort ouvert, mise en cache des fichiers locaux.');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// ÉVÉNEMENT 2 : La récupération (Fetch)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si trouvé dans le cache, on renvoie la version du cache.
        if (response) {
          return response;
        }
        // Sinon, on cherche sur internet.
        return fetch(event.request);
      })
  );
});

// ÉVÉNEMENT 3 : L'activation
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Suppression de l\'ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});