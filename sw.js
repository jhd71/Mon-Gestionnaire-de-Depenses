/**
 * sw.js - Service Worker v11 - Simplifié et robuste
 * 
 * Stratégie : Network First STRICT pour HTML, Cache First pour assets
 * Résout les problèmes d'écran vide au démarrage PWA
 */

const CACHE_NAME = 'gestionnaire-depenses-v19';
console.log('📋 SW v19 chargé');

// Fichiers à mettre en cache
const STATIC_ASSETS = [
    '/css/styles.css',
    '/js/security.js',
    '/js/app.js',
    '/js/pdf-export.js',
    '/js/ios-fixes.js',
    '/js/ios-install.js',
    '/manifest.json',
    '/favicon.ico',
    '/images/icon-192.png',
    '/images/icon-512.png',
    '/images/icon-192-maskable.png',
    '/images/icon-512-maskable.png'
];

// ============================================
// INSTALLATION
// ============================================
self.addEventListener('install', event => {
    console.log('🔧 SW v11: Installation');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Mise en cache des assets statiques');
                // Utiliser addAll avec gestion d'erreur individuelle
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => 
                        cache.add(url).catch(err => {
                            console.warn(`⚠️ Impossible de cacher ${url}:`, err.message);
                        })
                    )
                );
            })
            .then(() => {
                console.log('✅ Installation terminée');
                return self.skipWaiting();
            })
    );
});

// ============================================
// ACTIVATION
// ============================================
self.addEventListener('activate', event => {
    console.log('🚀 SW v11: Activation');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('🗑️ Suppression ancien cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('✅ Activation terminée, prise de contrôle');
                return self.clients.claim();
            })
    );
});

// ============================================
// FETCH - Stratégies de cache
// ============================================
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-HTTP
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Ignorer les requêtes POST, etc.
    if (request.method !== 'GET') {
        return;
    }
    
    // ============================================
    // RÈGLE 1: Navigation (HTML) → NETWORK FIRST STRICT
    // ============================================
    if (isNavigationRequest(request, url)) {
        event.respondWith(networkFirstStrict(request));
        return;
    }
    
    // ============================================
    // RÈGLE 2: Google Fonts → Cache First
    // ============================================
    if (isGoogleFonts(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // ============================================
    // RÈGLE 3: Assets du même domaine → Stale While Revalidate
    // ============================================
    if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
    
    // Autres requêtes : passer directement au réseau
});

// ============================================
// HELPERS
// ============================================

function isNavigationRequest(request, url) {
    return request.mode === 'navigate' ||
           request.destination === 'document' ||
           url.pathname === '/' ||
           url.pathname === '/index.html' ||
           url.pathname.endsWith('.html');
}

function isGoogleFonts(url) {
    return url.hostname === 'fonts.googleapis.com' || 
           url.hostname === 'fonts.gstatic.com';
}

// ============================================
// STRATÉGIES DE CACHE
// ============================================

/**
 * Network First STRICT pour HTML
 * Toujours chercher sur le réseau, cache uniquement en fallback
 */
async function networkFirstStrict(request) {
    console.log('🌐 Network First Strict:', request.url);
    
    try {
        // Toujours essayer le réseau en premier
        const networkResponse = await fetch(request, {
            cache: 'no-store' // Forcer bypass du cache HTTP
        });
        
        // Mettre en cache la réponse pour offline
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            console.log('✅ Page mise en cache depuis réseau');
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('🔴 Réseau indisponible, utilisation du cache');
        
        // Fallback vers le cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('📦 Page servie depuis cache (offline)');
            return cachedResponse;
        }
        
        // Dernier recours : servir index.html depuis le cache
        const indexCached = await caches.match('/index.html');
        if (indexCached) {
            console.log('📦 Fallback vers index.html en cache');
            return indexCached;
        }
        
        // Vraiment rien en cache
        return new Response('Application hors ligne', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

/**
 * Cache First pour ressources stables (fonts)
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        return new Response('', { status: 503 });
    }
}

/**
 * Stale While Revalidate pour assets
 */
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    // Lancer la mise à jour en arrière-plan
    const fetchPromise = fetch(request)
        .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                // IMPORTANT: Cloner AVANT toute utilisation
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
            }
            return networkResponse;
        })
        .catch(() => null);
    
    // Retourner le cache immédiatement s'il existe
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Sinon attendre le réseau
    const networkResponse = await fetchPromise;
    return networkResponse || new Response('Ressource non disponible', { status: 503 });
}

// ============================================
// MESSAGES
// ============================================
self.addEventListener('message', event => {
    console.log('📨 SW Message reçu:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('⏭️ Skip waiting demandé');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('🗑️ Nettoyage du cache demandé');
        caches.delete(CACHE_NAME).then(() => {
            console.log('✅ Cache nettoyé');
        });
    }
    
    if (event.data && event.data.type === 'REFRESH_ALL') {
        console.log('🔄 Refresh de tous les clients');
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.navigate(client.url));
        });
    }
});

// ============================================
// GESTION DES ERREURS
// ============================================
self.addEventListener('error', event => {
    console.error('❌ Erreur SW:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('❌ Promise rejetée:', event.reason);
});
