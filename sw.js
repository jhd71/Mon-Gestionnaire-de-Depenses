// sw.js - Service Worker v6 - Réécriture propre
const CACHE_NAME = 'gestionnaire-depenses-v6';
const STATIC_CACHE = 'static-v6';
const DYNAMIC_CACHE = 'dynamic-v6';

// Fichiers essentiels à mettre en cache immédiatement
const CORE_ASSETS = [
    '/',
    '/index.html'
];

// Fichiers secondaires (peuvent échouer sans bloquer)
const SECONDARY_ASSETS = [
    '/css/styles.css',
    '/js/pdf-export.js',
    '/js/security.js',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png'
];

// Installation - Cache uniquement les fichiers essentiels
self.addEventListener('install', event => {
    console.log('[SW] Installation v6');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Mise en cache des fichiers essentiels');
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => {
                // Mettre en cache les fichiers secondaires sans bloquer
                caches.open(STATIC_CACHE).then(cache => {
                    SECONDARY_ASSETS.forEach(url => {
                        cache.add(url).catch(err => {
                            console.warn('[SW] Échec cache secondaire:', url);
                        });
                    });
                });
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Erreur installation:', error);
            })
    );
});

// Activation - Nettoyer les anciens caches
self.addEventListener('activate', event => {
    console.log('[SW] Activation');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map(name => {
                            console.log('[SW] Suppression ancien cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Prise de contrôle des clients');
                return self.clients.claim();
            })
    );
});

// Fetch - Stratégie intelligente
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') return;
    
    // Ignorer les requêtes vers d'autres origines (sauf Google Fonts)
    const isGoogleFonts = url.hostname.includes('googleapis.com') || 
                          url.hostname.includes('gstatic.com');
    
    if (url.origin !== self.location.origin && !isGoogleFonts) {
        return;
    }
    
    // Pour les pages HTML : Network First avec fallback cache
    if (request.mode === 'navigate' || 
        request.destination === 'document' ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/') {
        
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // Pour les assets : Cache First avec mise à jour en arrière-plan
    event.respondWith(cacheFirstStrategy(request));
});

// Stratégie Network First (pour HTML)
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Réseau indisponible, utilisation du cache');
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback sur index.html
        return caches.match('/index.html');
    }
}

// Stratégie Cache First (pour assets)
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Mise à jour en arrière-plan (stale-while-revalidate)
        updateCache(request);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Retourner une réponse vide pour les assets manquants
        return new Response('', { status: 404 });
    }
}

// Mise à jour du cache en arrière-plan
async function updateCache(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse);
        }
    } catch (error) {
        // Ignorer silencieusement
    }
}

// Gestion des messages
self.addEventListener('message', event => {
    const { type } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            console.log('[SW] Skip waiting');
            self.skipWaiting();
            break;
            
        case 'CLEAR_CACHE':
            console.log('[SW] Nettoyage du cache');
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({ version: 'v6' });
            break;
    }
});

// Gestion des erreurs
self.addEventListener('error', event => {
    console.error('[SW] Erreur:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('[SW] Promise rejetée:', event.reason);
});