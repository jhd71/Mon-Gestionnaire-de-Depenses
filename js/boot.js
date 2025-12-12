// boot.js - Système de démarrage robuste pour PWA v2
// Ce fichier DOIT être chargé EN PREMIER dans la page

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        MAX_BOOT_ATTEMPTS: 5,
        BOOT_CHECK_INTERVAL: 500,
        BOOT_TIMEOUT: 10000,
        DOM_CHECK_INTERVAL: 50,
        DEBUG: true
    };
    
    // ============================================
    // ÉTAT DU BOOT
    // ============================================
    window.__BOOT__ = {
        started: false,
        completed: false,
        attempts: 0,
        startTime: Date.now(),
        errors: []
    };
    
    // ============================================
    // LOGGING
    // ============================================
    function log(message, type = 'info') {
        if (!CONFIG.DEBUG) return;
        
        const prefix = {
            'info': '🔵',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'boot': '🚀'
        }[type] || '📝';
        
        console.log(`${prefix} [BOOT] ${message}`);
    }
    
    // ============================================
    // VÉRIFICATION DU DOM
    // ============================================
    function isDOMReady() {
        const dashboard = document.getElementById('dashboard-content');
        const tabs = document.getElementById('tabs');
        return dashboard && tabs;
    }
    
    function isDisplayEmpty() {
        const dashboard = document.getElementById('dashboard-content');
        return !dashboard || dashboard.innerHTML.trim() === '' || 
               dashboard.innerHTML.includes('empty-state') && 
               localStorage.getItem('expenseTrackerData');
    }
    
    // ============================================
    // FONCTION DE BOOT PRINCIPALE
    // ============================================
    function boot() {
        // Éviter les boots multiples simultanés
        if (window.__BOOT__.started && !window.__BOOT__.completed) {
            log('Boot déjà en cours...', 'warning');
            return;
        }
        
        // Limiter les tentatives
        if (window.__BOOT__.attempts >= CONFIG.MAX_BOOT_ATTEMPTS) {
            log(`Maximum de tentatives atteint (${CONFIG.MAX_BOOT_ATTEMPTS})`, 'error');
            showErrorMessage();
            return;
        }
        
        window.__BOOT__.started = true;
        window.__BOOT__.attempts++;
        
        log(`Tentative de boot #${window.__BOOT__.attempts}...`, 'boot');
        
        // Attendre que le DOM soit prêt
        waitForDOM()
            .then(() => {
                log('DOM prêt', 'success');
                return initializeApplication();
            })
            .then(() => {
                window.__BOOT__.completed = true;
                log('Boot terminé avec succès !', 'success');
                sessionStorage.removeItem('reloadCount');
            })
            .catch(error => {
                window.__BOOT__.errors.push(error);
                log(`Erreur: ${error.message}`, 'error');
                window.__BOOT__.started = false;
                
                // Réessayer après un délai
                setTimeout(() => {
                    if (!window.__BOOT__.completed) {
                        boot();
                    }
                }, 500);
            });
    }
    
    // ============================================
    // ATTENTE DU DOM
    // ============================================
    function waitForDOM() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 5 secondes max
            
            function check() {
                attempts++;
                
                if (isDOMReady()) {
                    resolve();
                    return;
                }
                
                if (attempts >= maxAttempts) {
                    reject(new Error('DOM non disponible après timeout'));
                    return;
                }
                
                setTimeout(check, CONFIG.DOM_CHECK_INTERVAL);
            }
            
            check();
        });
    }
    
    // ============================================
    // INITIALISATION DE L'APPLICATION
    // ============================================
    function initializeApplication() {
        return new Promise((resolve, reject) => {
            try {
                // Vérifier que initializeApp existe
                if (typeof window.initializeApp !== 'function') {
                    // La fonction n'existe pas encore, attendre
                    let waitCount = 0;
                    const waitForInit = setInterval(() => {
                        waitCount++;
                        if (typeof window.initializeApp === 'function') {
                            clearInterval(waitForInit);
                            window.initializeApp();
                            resolve();
                        } else if (waitCount > 50) { // 2.5 secondes max
                            clearInterval(waitForInit);
                            reject(new Error('initializeApp non trouvée'));
                        }
                    }, 50);
                } else {
                    window.initializeApp();
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // ============================================
    // MESSAGE D'ERREUR UTILISATEUR
    // ============================================
    function showErrorMessage() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary, #888);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">😕</div>
                    <h3 style="margin-bottom: 1rem; color: var(--text-primary, #fff);">
                        Erreur de chargement
                    </h3>
                    <p style="margin-bottom: 1.5rem;">
                        L'application n'a pas pu démarrer correctement.
                    </p>
                    <button onclick="location.reload()" style="
                        background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        🔄 Actualiser la page
                    </button>
                </div>
            `;
        }
    }
    
    // ============================================
    // SURVEILLANCE CONTINUE
    // ============================================
    function startMonitoring() {
        // Vérification périodique pendant les premières secondes
        const checkInterval = setInterval(() => {
            const elapsed = Date.now() - window.__BOOT__.startTime;
            
            // Arrêter après le timeout
            if (elapsed > CONFIG.BOOT_TIMEOUT) {
                clearInterval(checkInterval);
                return;
            }
            
            // Vérifier si l'affichage est vide alors que le boot est "terminé"
            if (window.__BOOT__.completed && isDisplayEmpty()) {
                log('Affichage vide détecté après boot, re-rendu...', 'warning');
                
                // Tenter un re-rendu sans re-boot complet
                if (typeof window.renderApp === 'function') {
                    try {
                        if (typeof window.loadData === 'function') {
                            window.loadData();
                        }
                        window.renderApp();
                        log('Re-rendu effectué', 'success');
                    } catch (e) {
                        log('Erreur re-rendu: ' + e.message, 'error');
                    }
                }
            }
        }, CONFIG.BOOT_CHECK_INTERVAL);
    }
    
    // ============================================
    // ÉCOUTEURS D'ÉVÉNEMENTS
    // ============================================
    
    // DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            log('DOMContentLoaded déclenché');
            setTimeout(boot, 10);
        });
    } else {
        // DOM déjà prêt
        log('DOM déjà prêt');
        setTimeout(boot, 10);
    }
    
    // Window load (backup)
    window.addEventListener('load', () => {
        log('Window load déclenché');
        if (!window.__BOOT__.completed) {
            setTimeout(boot, 100);
        }
        startMonitoring();
    });
    
    // Pageshow (restauration depuis cache PWA - CRUCIAL)
    window.addEventListener('pageshow', (event) => {
        log(`Pageshow déclenché, persisted: ${event.persisted}`);
        
        if (event.persisted) {
            // Page restaurée depuis le bfcache
            log('Page restaurée depuis le cache, vérification...', 'warning');
            
            // Reset le boot si nécessaire
            if (isDisplayEmpty()) {
                window.__BOOT__.started = false;
                window.__BOOT__.completed = false;
                window.__BOOT__.attempts = 0;
                setTimeout(boot, 50);
            }
        } else if (!window.__BOOT__.completed) {
            // Nouveau chargement, s'assurer que le boot est lancé
            setTimeout(boot, 50);
        }
    });
    
    // Visibilitychange (réveil de l'app)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            log('App redevenue visible');
            
            // Vérifier l'affichage après un court délai
            setTimeout(() => {
                if (isDisplayEmpty() && window.__BOOT__.completed) {
                    log('Affichage vide après réveil, re-rendu...', 'warning');
                    
                    if (typeof window.renderApp === 'function') {
                        try {
                            if (typeof window.loadData === 'function') {
                                window.loadData();
                            }
                            window.renderApp();
                        } catch (e) {
                            // En cas d'échec, relancer le boot
                            window.__BOOT__.started = false;
                            window.__BOOT__.completed = false;
                            boot();
                        }
                    }
                }
            }, 200);
        }
    });
    
    // Focus (backup)
    window.addEventListener('focus', () => {
        if (window.__BOOT__.completed && isDisplayEmpty()) {
            log('Focus avec affichage vide, re-rendu...', 'warning');
            if (typeof window.renderApp === 'function') {
                try {
                    window.renderApp();
                } catch (e) {}
            }
        }
    });
    
    // Message du Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'REFRESH_PAGE') {
                log('Service Worker demande un refresh');
                location.reload();
            }
        });
    }
    
    log('Système de boot initialisé');
    
})();