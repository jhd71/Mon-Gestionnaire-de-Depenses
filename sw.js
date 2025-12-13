// sw.js - Service Worker amélioré pour PWA complète
const CACHE_NAME = 'gestionnaire-depenses-v10';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/pdf-export.js',
  '/js/security.js',
  '/js/ios-fixes.js',
  '/js/ios-install.js',
  '/manifest.json',
  '/favicon.ico',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-192-maskable.png',
  '/images/icon-512-maskable.png',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installation v10');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Tous les fichiers mis en cache');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Erreur lors de l\'installation:', error);
      })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activation');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression du cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker actif et en contrôle');
      return self.clients.claim();
    })
  );
});

// Stratégie de cache améliorée
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  const requestURL = new URL(event.request.url);
  
  // Ignorer les requêtes vers d'autres domaines sauf Google Fonts
  const isGoogleFonts = requestURL.hostname === 'fonts.googleapis.com' || 
                        requestURL.hostname === 'fonts.gstatic.com';
  
  if (requestURL.origin !== self.location.origin && !isGoogleFonts) {
    return;
  }
  
  // Déterminer si c'est une requête de navigation (page HTML)
  const isNavigationRequest = event.request.mode === 'navigate' ||
                              event.request.destination === 'document' ||
                              requestURL.pathname === '/' ||
                              requestURL.pathname.endsWith('.html');
  
  // Stratégie Network First pour les pages HTML (évite le cache obsolète)
  if (isNavigationRequest) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Vérifier que la réponse est valide
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Hors ligne : utiliser le cache
          console.log('📴 Hors ligne, utilisation du cache pour:', event.request.url);
          return caches.match(event.request)
            .then(response => response || caches.match('/index.html'));
        })
    );
    return;
  }
  
  // Stratégie Cache First pour les assets (CSS, JS, images)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Mettre à jour le cache en arrière-plan (stale-while-revalidate)
          fetch(event.request)
            .then(response => {
              if (response && response.status === 200 && event.request.method === 'GET') {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, response);
                });
              }
            })
            .catch(() => {}); // Ignorer les erreurs de mise à jour
          
          return cachedResponse;
        }
        
        // Pas en cache, récupérer depuis le réseau
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || event.request.method !== 'GET') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            
            return response;
          })
          .catch(() => {
            // Ressource non disponible
            if (event.request.destination === 'image') {
              // Retourner une image placeholder pour les images manquantes
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#1e293b" width="100" height="100"/><text fill="#64748b" x="50%" y="50%" text-anchor="middle" dy=".3em">📴</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            return new Response('Ressource non disponible hors ligne', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Gestion des messages pour mise à jour forcée
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ Skip waiting demandé');
    self.skipWaiting();
  }
  
  // Nouveau : forcer le rechargement de tous les clients
  if (event.data && event.data.type === 'REFRESH_ALL') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.navigate(client.url));
    });
  }
});

// Gestion des erreurs non capturées
self.addEventListener('error', event => {
  console.error('❌ Erreur Service Worker:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('❌ Promise rejetée:', event.reason);
});