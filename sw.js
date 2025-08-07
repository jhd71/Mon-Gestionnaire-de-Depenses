// sw.js - Service Worker amélioré pour PWA complète

const CACHE_NAME = 'gestionnaire-depenses-v2.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/js/pdf-export.js',
  '/favicon.ico',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-192-maskable.png',
  '/images/icon-512-maskable.png',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Erreur lors de l\'installation:', error);
      })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression du cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de cache - Network First avec fallback
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-HTTP/HTTPS (chrome-extension, etc.)
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // Ignorer les requêtes vers d'autres domaines sauf Google Fonts
  const requestURL = new URL(event.request.url);
  const isGoogleFonts = requestURL.hostname === 'fonts.googleapis.com' || 
                       requestURL.hostname === 'fonts.gstatic.com';
  
  if (requestURL.origin !== self.location.origin && !isGoogleFonts) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Vérifier que la réponse est valide
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        
        // Ne mettre en cache que les requêtes GET
        if (event.request.method !== 'GET') {
          return response;
        }
        
        // Cloner la réponse car elle ne peut être utilisée qu'une fois
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          })
          .catch(error => {
            console.warn('Erreur lors de la mise en cache:', error);
          });
        
        return response;
      })
      .catch(() => {
        // Si le réseau échoue, chercher dans le cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            
            // Si pas dans le cache et c'est une navigation, retourner index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Pour les autres ressources non trouvées, retourner une réponse d'erreur
            return new Response('Ressource non disponible hors ligne', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Gestion des messages pour mise à jour
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});