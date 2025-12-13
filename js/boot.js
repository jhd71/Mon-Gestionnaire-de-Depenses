// boot.js - Système de démarrage robuste pour PWA v3
// Ce fichier DOIT être chargé EN PREMIER dans la page

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        MAX_BOOT_ATTEMPTS: 5,
        INIT_CHECK_INTERVAL: 100,  // Vérifier toutes les 100ms
        INIT_TIMEOUT: 5000,        // Timeout après 5 secondes
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
        }[type] || '📌';
        
        console.log(`${prefix} [BOOT] ${message}`);
    }
    
    // ============================================
    // VÉRIFICATION DU DOM
    // ============================================
    function isDOMReady() {
        const dashboard = document.getElementById('dashboard-content');
        const tabs = document.getElementById('tabs');
        return !!(dashboard && tabs);
    }
    
    function isDisplayEmpty() {
        const dashboard = document.getElementById('dashboard-content');
        if (!dashboard) return true;
        
        const content = dashboard.innerHTML.trim();
        // Vide ou seulement l'empty-state alors qu'il y a des données
        const hasData = localStorage.getItem('expenseTrackerData');
        const isEmpty = content === '' || 
                       (content.includes('empty-state') && hasData && 
                        JSON.parse(hasData).users && 
                        Object.keys(JSON.parse(hasData).users).length > 1);
        
        return isEmpty;
    }
    
    // ============================================
    // ATTENDRE QUE initializeApp SOIT DISPONIBLE
    // ============================================
    function waitForInitFunction() {
        return new Promise((resolve, reject) => {
            let elapsed = 0;
            
            const check = () => {
                // Vérifier si la fonction est disponible
                if (typeof window.initializeApp === 'function') {
                    log('initializeApp trouvée !', 'success');
                    resolve();
                    return;
                }
                
                elapsed += CONFIG.INIT_CHECK_INTERVAL;
                
                if (elapsed >= CONFIG.INIT_TIMEOUT) {
                    reject(new Error('initializeApp non trouvée après timeout'));
                    return;
                }
                
                setTimeout(check, CONFIG.INIT_CHECK_INTERVAL);
            };
            
            check();
        });
    }
    
    // ============================================
    // FONCTION DE BOOT PRINCIPALE
    // ============================================
    async function boot() {
        // Éviter les boots multiples
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
        
        try {
            // Attendre que le DOM soit prêt
            if (!isDOMReady()) {
                log('Attente du DOM...');
                await new Promise(resolve => {
                    const checkDOM = setInterval(() => {
                        if (isDOMReady()) {
                            clearInterval(checkDOM);
                            resolve();
                        }
                    }, 50);
                    
                    // Timeout après 3 secondes
                    setTimeout(() => {
                        clearInterval(checkDOM);
                        resolve();
                    }, 3000);
                });
            }
            
            log('DOM prêt', 'success');
            
            // Attendre que initializeApp soit disponible
            await waitForInitFunction();
            
            // Appeler initializeApp
            log('Appel de initializeApp...');
            window.initializeApp();
            
            // Vérifier que le rendu a fonctionné
            setTimeout(() => {
                if (isDisplayEmpty()) {
                    log('Affichage vide détecté, re-rendu...', 'warning');
                    if (typeof window.loadData === 'function') {
                        window.loadData();
                    }
                    if (typeof window.renderApp === 'function') {
                        window.renderApp();
                    }
                }
            }, 500);
            
            window.__BOOT__.completed = true;
            log('Boot terminé avec succès !', 'success');
            sessionStorage.removeItem('reloadCount');
            
        } catch (error) {
            window.__BOOT__.errors.push(error);
            log(`Erreur: ${error.message}`, 'error');
            window.__BOOT__.started = false;
            
            // Réessayer après un délai
            setTimeout(() => {
                if (!window.__BOOT__.completed) {
                    boot();
                }
            }, 500);
        }
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
    // RÉCUPÉRATION APRÈS MISE EN ARRIÈRE-PLAN
    // ============================================
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            log('App redevenue visible');
            
            setTimeout(() => {
                if (isDisplayEmpty() && window.__BOOT__.completed) {
                    log('Affichage vide après réveil, re-rendu...', 'warning');
                    
                    try {
                        if (typeof window.loadData === 'function') {
                            window.loadData();
                        }
                        if (typeof window.renderApp === 'function') {
                            window.renderApp();
                            log('Re-rendu effectué', 'success');
                        }
                    } catch (e) {
                        log('Erreur re-rendu: ' + e.message, 'error');
                        // En cas d'échec critique, relancer le boot
                        window.__BOOT__.started = false;
                        window.__BOOT__.completed = false;
                        window.__BOOT__.attempts = 0;
                        boot();
                    }
                }
            }, 200);
        }
    }
    
    function handlePageShow(event) {
        log(`Pageshow déclenché, persisted: ${event.persisted}`);
        
        if (event.persisted) {
            // Page restaurée depuis le bfcache
            log('Page restaurée depuis le cache', 'warning');
            
            setTimeout(() => {
                if (isDisplayEmpty()) {
                    log('Affichage vide après restauration, re-rendu...', 'warning');
                    
                    try {
                        if (typeof window.loadData === 'function') {
                            window.loadData();
                        }
                        if (typeof window.renderApp === 'function') {
                            window.renderApp();
                        }
                    } catch (e) {
                        // Forcer un reload si ça ne marche pas
                        window.__BOOT__.started = false;
                        window.__BOOT__.completed = false;
                        window.__BOOT__.attempts = 0;
                        boot();
                    }
                }
            }, 100);
        } else if (!window.__BOOT__.completed) {
            // Nouveau chargement, lancer le boot
            setTimeout(boot, 50);
        }
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
        log('DOM déjà prêt au chargement de boot.js');
        setTimeout(boot, 10);
    }
    
    // Window load (backup)
    window.addEventListener('load', () => {
        log('Window load déclenché');
        if (!window.__BOOT__.completed) {
            setTimeout(boot, 100);
        }
    });
    
    // Pageshow (restauration depuis cache PWA - CRUCIAL)
    window.addEventListener('pageshow', handlePageShow);
    
    // Visibilitychange (réveil de l'app)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Focus (backup)
    window.addEventListener('focus', () => {
        if (window.__BOOT__.completed && isDisplayEmpty()) {
            log('Focus avec affichage vide, re-rendu...', 'warning');
            try {
                if (typeof window.loadData === 'function') {
                    window.loadData();
                }
                if (typeof window.renderApp === 'function') {
                    window.renderApp();
                }
            } catch (e) {
                log('Erreur re-rendu sur focus: ' + e.message, 'error');
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
    
    log('Système de boot v3 initialisé');
    
})();