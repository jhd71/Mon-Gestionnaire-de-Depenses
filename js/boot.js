/**
 * boot.js - Système de démarrage ultra-robuste pour PWA
 * Version 2.0 - Résout le problème d'écran vide au démarrage
 * 
 * Ce fichier DOIT être chargé en premier dans le <head> avec defer
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        MAX_INIT_ATTEMPTS: 20,        // Nombre max de tentatives d'init
        INIT_RETRY_DELAY: 100,        // Délai entre tentatives (ms)
        WATCHDOG_INTERVAL: 500,       // Intervalle du watchdog (ms)
        WATCHDOG_DURATION: 10000,     // Durée totale du watchdog (ms)
        RENDER_CHECK_DELAY: 300,      // Délai avant vérification du rendu
        STORAGE_KEY: 'expenseTrackerData',
        DEBUG: true                   // Activer les logs de debug
    };
    
    // ============================================
    // ÉTAT DU SYSTÈME DE DÉMARRAGE
    // ============================================
    const bootState = {
        initialized: false,
        initAttempts: 0,
        domReady: false,
        dataLoaded: false,
        renderComplete: false,
        watchdogActive: false,
        startTime: Date.now()
    };
    
    // ============================================
    // UTILITAIRES
    // ============================================
    function log(...args) {
        if (CONFIG.DEBUG) {
            const elapsed = Date.now() - bootState.startTime;
            console.log(`[BOOT +${elapsed}ms]`, ...args);
        }
    }
    
    function warn(...args) {
        const elapsed = Date.now() - bootState.startTime;
        console.warn(`[BOOT +${elapsed}ms]`, ...args);
    }
    
    function error(...args) {
        const elapsed = Date.now() - bootState.startTime;
        console.error(`[BOOT +${elapsed}ms]`, ...args);
    }
    
    // ============================================
    // VÉRIFICATION DU DOM
    // ============================================
    function isDOMReady() {
        // Vérifier que les éléments critiques existent
        const criticalElements = [
            'dashboard-content',
            'tabs',
            'dashboard'
        ];
        
        for (const id of criticalElements) {
            if (!document.getElementById(id)) {
                return false;
            }
        }
        
        return true;
    }
    
    // ============================================
    // VÉRIFICATION DU RENDU
    // ============================================
    function isRenderComplete() {
        const dashboardContent = document.getElementById('dashboard-content');
        const tabsContainer = document.getElementById('tabs');
        const hasData = localStorage.getItem(CONFIG.STORAGE_KEY);
        
        // S'il n'y a pas de données, le rendu est "complet" par défaut
        if (!hasData) {
            return true;
        }
        
        try {
            const data = JSON.parse(hasData);
            const userCount = Object.keys(data.users || {}).length;
            
            // Vérifier que le dashboard a du contenu
            const dashboardHasContent = dashboardContent && 
                                        dashboardContent.innerHTML.trim() !== '' &&
                                        dashboardContent.children.length > 0;
            
            // Vérifier que les onglets sont présents (au minimum 2 : Dashboard + Balance)
            const tabsCount = tabsContainer ? tabsContainer.querySelectorAll('.tab').length : 0;
            const tabsAreComplete = tabsCount >= 2;
            
            log('Vérification rendu:', {
                dashboardHasContent,
                tabsCount,
                tabsAreComplete,
                userCount
            });
            
            return dashboardHasContent && tabsAreComplete;
        } catch (e) {
            error('Erreur vérification rendu:', e);
            return false;
        }
    }
    
    // ============================================
    // FONCTION D'INITIALISATION PRINCIPALE
    // ============================================
    function attemptInitialization() {
        bootState.initAttempts++;
        log(`Tentative d'initialisation #${bootState.initAttempts}`);
        
        // Vérifier le nombre max de tentatives
        if (bootState.initAttempts > CONFIG.MAX_INIT_ATTEMPTS) {
            error('Nombre max de tentatives atteint !');
            handleInitializationFailure();
            return;
        }
        
        // Vérifier si le DOM est prêt
        if (!isDOMReady()) {
            log('DOM pas prêt, nouvelle tentative...');
            setTimeout(attemptInitialization, CONFIG.INIT_RETRY_DELAY);
            return;
        }
        
        bootState.domReady = true;
        log('DOM prêt !');
        
        // Vérifier si la fonction initializeApp existe
        if (typeof window.initializeApp !== 'function') {
            log('initializeApp pas encore disponible, nouvelle tentative...');
            setTimeout(attemptInitialization, CONFIG.INIT_RETRY_DELAY);
            return;
        }
        
        // Éviter les initialisations multiples
        if (bootState.initialized) {
            log('Déjà initialisé, vérification du rendu...');
            verifyRenderAfterDelay();
            return;
        }
        
        // Lancer l'initialisation
        try {
            log('🚀 Lancement de initializeApp()...');
            bootState.initialized = true;
            window.initializeApp();
            log('✅ initializeApp() terminé');
            
            // Vérifier le rendu après un délai
            verifyRenderAfterDelay();
            
        } catch (e) {
            error('Erreur lors de initializeApp():', e);
            bootState.initialized = false;
            setTimeout(attemptInitialization, CONFIG.INIT_RETRY_DELAY * 2);
        }
    }
    
    // ============================================
    // VÉRIFICATION POST-RENDU
    // ============================================
    function verifyRenderAfterDelay() {
        setTimeout(() => {
            if (!isRenderComplete()) {
                warn('Rendu incomplet détecté !');
                forceRerender();
            } else {
                log('✅ Rendu vérifié et complet !');
                bootState.renderComplete = true;
                stopWatchdog();
            }
        }, CONFIG.RENDER_CHECK_DELAY);
    }
    
    // ============================================
    // FORCER LE RE-RENDU
    // ============================================
    function forceRerender() {
        log('🔄 Forçage du re-rendu...');
        
        try {
            // Recharger les données
            if (typeof window.loadData === 'function') {
                window.loadData();
                log('Données rechargées');
            }
            
            // Forcer le rendu
            if (typeof window.renderApp === 'function') {
                window.renderApp();
                log('renderApp() forcé');
            }
            
            // Vérifier à nouveau
            setTimeout(() => {
                if (!isRenderComplete()) {
                    warn('Rendu toujours incomplet après re-rendu forcé');
                    
                    // Dernier recours : rechargement de la page
                    const reloadCount = parseInt(sessionStorage.getItem('bootReloadCount') || '0');
                    if (reloadCount < 1) {
                        log('Rechargement de la page...');
                        sessionStorage.setItem('bootReloadCount', String(reloadCount + 1));
                        window.location.reload();
                    } else {
                        error('Échec après rechargement - affichage du message d\'erreur');
                        sessionStorage.removeItem('bootReloadCount');
                        showErrorMessage();
                    }
                } else {
                    log('✅ Re-rendu réussi !');
                    bootState.renderComplete = true;
                    sessionStorage.removeItem('bootReloadCount');
                }
            }, CONFIG.RENDER_CHECK_DELAY);
            
        } catch (e) {
            error('Erreur lors du re-rendu forcé:', e);
        }
    }
    
    // ============================================
    // WATCHDOG PERMANENT
    // ============================================
    let watchdogInterval = null;
    
    function startWatchdog() {
        if (bootState.watchdogActive) return;
        
        bootState.watchdogActive = true;
        const watchdogStart = Date.now();
        
        log('🐕 Démarrage du watchdog');
        
        watchdogInterval = setInterval(() => {
            const elapsed = Date.now() - watchdogStart;
            
            // Arrêter après la durée max
            if (elapsed > CONFIG.WATCHDOG_DURATION) {
                log('Watchdog terminé (durée max atteinte)');
                stopWatchdog();
                return;
            }
            
            // Arrêter si tout est OK
            if (bootState.renderComplete) {
                log('Watchdog terminé (rendu complet)');
                stopWatchdog();
                return;
            }
            
            // Vérifier l'état
            if (bootState.initialized && !isRenderComplete()) {
                warn(`Watchdog: rendu incomplet détecté à +${elapsed}ms`);
                forceRerender();
            }
            
        }, CONFIG.WATCHDOG_INTERVAL);
    }
    
    function stopWatchdog() {
        if (watchdogInterval) {
            clearInterval(watchdogInterval);
            watchdogInterval = null;
        }
        bootState.watchdogActive = false;
    }
    
    // ============================================
    // GESTION DES ERREURS
    // ============================================
    function handleInitializationFailure() {
        error('Échec de l\'initialisation après toutes les tentatives');
        showErrorMessage();
    }
    
    function showErrorMessage() {
        const container = document.getElementById('dashboard-content');
        if (container) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-secondary, #888);
                ">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="margin-bottom: 1rem; color: var(--text, #fff);">
                        Problème de chargement
                    </h3>
                    <p style="margin-bottom: 1.5rem;">
                        L'application n'a pas pu se charger correctement.
                    </p>
                    <button onclick="location.reload()" style="
                        background: var(--primary, #8b5cf6);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 1rem;
                        cursor: pointer;
                    ">
                        🔄 Recharger l'application
                    </button>
                </div>
            `;
        }
    }
    
    // ============================================
    // GESTION DU CYCLE DE VIE PWA
    // ============================================
    
    // Gestion du pageshow (retour depuis bfcache)
    window.addEventListener('pageshow', function(event) {
        log('📄 pageshow déclenché, persisted:', event.persisted);
        
        if (event.persisted) {
            // La page vient du bfcache - forcer une vérification
            log('Page restaurée depuis bfcache');
            setTimeout(() => {
                if (!isRenderComplete()) {
                    forceRerender();
                }
            }, 100);
        }
    });
    
    // Gestion du visibilitychange (retour au premier plan)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            log('📱 Application revenue au premier plan');
            
            // Petit délai pour laisser le temps au système
            setTimeout(() => {
                if (bootState.initialized && !isRenderComplete()) {
                    warn('Affichage vide détecté au retour');
                    forceRerender();
                }
            }, 200);
        }
    });
    
    // Gestion du focus
    window.addEventListener('focus', function() {
        log('🎯 Focus reçu');
        
        if (bootState.initialized && !bootState.renderComplete) {
            setTimeout(() => {
                if (!isRenderComplete()) {
                    forceRerender();
                }
            }, 100);
        }
    });
    
    // ============================================
    // DÉMARRAGE DU SYSTÈME
    // ============================================
    function startBoot() {
        log('🏁 Démarrage du système de boot v2.0');
        
        // Démarrer le watchdog
        startWatchdog();
        
        // Lancer l'initialisation
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attemptInitialization);
        } else {
            // DOM déjà prêt
            attemptInitialization();
        }
        
        // Sécurité supplémentaire avec window.onload
        window.addEventListener('load', function() {
            log('📄 window.load déclenché');
            
            if (!bootState.initialized) {
                attemptInitialization();
            } else if (!bootState.renderComplete) {
                verifyRenderAfterDelay();
            }
        });
    }
    
    // Exposer certaines fonctions pour debug
    window.bootSystem = {
        state: bootState,
        config: CONFIG,
        forceRerender: forceRerender,
        checkRender: isRenderComplete
    };
    
    // Démarrer !
    startBoot();
    
})();