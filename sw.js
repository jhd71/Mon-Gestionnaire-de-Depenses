// sw.js - Service Worker v11 - Network First TOUJOURS
const CACHE_VERSION = 'v11';
const CACHE_NAME = `gestionnaire-depenses-${CACHE_VERSION}`;

// Fichiers à mettre en cache
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/pdf-export.js',
    '/js/security.js',
    '/js/ios-fixes.js',
    '/js/ios-install.js',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png'
];

// Installation
self.addEventListener('install', event => {
    console.log('[SW v11] Installation...');
    // Skip waiting immédiatement pour prendre le contrôle
    self.skipWaiting();
});

// Activation - Nettoyage des anciens caches
self.addEventListener('activate', event => {
    console.log('[SW v11] Activation...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW v11] Suppression cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW v11] Prise de contrôle');
                return self.clients.claim();
            })
    );
});

// Fetch - TOUJOURS Network First pour TOUT
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') return;
    
    // Ignorer les requêtes vers d'autres domaines
    if (url.origin !== self.location.origin) {
        return;
    }
    
    // STRATÉGIE : TOUJOURS réseau d'abord, cache en fallback uniquement
    event.respondWith(
        fetch(request)
            .then(response => {
                // Succès réseau : mettre en cache et retourner
                if (response && response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Échec réseau (hors ligne) : utiliser le cache
                console.log('[SW v11] Hors ligne, cache pour:', url.pathname);
                return caches.match(request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Dernier recours pour navigation
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('', { status: 404 });
                    });
            })
    );
});

// Messages
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
