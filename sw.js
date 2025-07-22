// sw.js - Version améliorée pour Firefox/Opera

const CACHE_NAME = 'gestionnaire-depenses-cache-v1.3';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './favicon.ico',
  './images/paypal-icon.png',
  './images/icon-192.png',
  './images/icon-512.png'
];

// Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache ouvert');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Suppression ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch avec stratégie Cache First
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // Ne pas mettre en cache les requêtes non-GET
          if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
            return response;
          }
          
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
      .catch(() => {
        // Page offline si nécessaire
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});