// sw.js - Service Worker v7 - Version simplifiée et robuste
const CACHE_VERSION = 'v7';
const CACHE_NAME = `gestionnaire-depenses-${CACHE_VERSION}`;

// Fichiers à mettre en cache
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/pdf-export.js',
    '/js/security.js',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png'
];

// Installation - Mise en cache des fichiers essentiels
self.addEventListener('install', event => {
    console.log('[SW v7] Installation...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW v7] Mise en cache des fichiers');
                // On ne bloque pas si certains fichiers échouent
                return Promise.allSettled(
                    FILES_TO_CACHE.map(url => 
                        cache.add(url).catch(err => {
                            console.warn('[SW v7] Échec cache:', url, err);
                        })
                    )
                );
            })
            .then(() => {
                console.log('[SW v7] Skip waiting');
                return self.skipWaiting();
            })
    );
});

// Activation - Nettoyage des anciens caches
self.addEventListener('activate', event => {
    console.log('[SW v7] Activation...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW v7] Suppression ancien cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW v7] Prise de contrôle des clients');
                return self.clients.claim();
            })
    );
});

// Fetch - Stratégie Network First pour HTML, Cache First pour assets
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') return;
    
    // Ignorer les requêtes vers d'autres domaines (sauf Google Fonts)
    const isGoogleFonts = url.hostname.includes('googleapis.com') || 
                          url.hostname.includes('gstatic.com');
    
    if (url.origin !== self.location.origin && !isGoogleFonts) {
        return;
    }
    
    // Pour les pages HTML : TOUJOURS Network First
    if (request.mode === 'navigate' || 
        request.destination === 'document' ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/' ||
        url.pathname === '') {
        
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Mettre à jour le cache avec la nouvelle version
                    if (response && response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Hors ligne : utiliser le cache
                    console.log('[SW v7] Hors ligne, utilisation du cache pour:', url.pathname);
                    return caches.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Fallback sur index.html
                            return caches.match('/index.html');
                        });
                })
        );
        return;
    }
    
    // Pour les assets (CSS, JS, images) : Cache First
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Mise à jour en arrière-plan
                    fetch(request)
                        .then(response => {
                            if (response && response.ok) {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(request, response);
                                });
                            }
                        })
                        .catch(() => {});
                    
                    return cachedResponse;
                }
                
                // Pas en cache : télécharger
                return fetch(request)
                    .then(response => {
                        if (response && response.ok) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Asset manquant : retourner une réponse vide
                        return new Response('', { 
                            status: 404, 
                            statusText: 'Not Found' 
                        });
                    });
            })
    );
});

// Gestion des messages
self.addEventListener('message', event => {
    const { type } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            console.log('[SW v7] Skip waiting demandé');
            self.skipWaiting();
            break;
            
        case 'CLEAR_CACHE':
            console.log('[SW v7] Nettoyage du cache demandé');
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
            break;
            
        case 'GET_VERSION':
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ version: CACHE_VERSION });
            }
            break;
            
        case 'FORCE_REFRESH':
            console.log('[SW v7] Force refresh demandé');
            // Notifier tous les clients de se recharger
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'REFRESH_PAGE' });
                });
            });
            break;
    }
});

// Gestion des erreurs
self.addEventListener('error', event => {
    console.error('[SW v7] Erreur:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('[SW v7] Promise rejetée:', event.reason);
});