/**
 * boot.js - Système de démarrage ultra-robuste pour PWA
 * Version 3.0 - Détecte quand le JS inline n'est pas exécuté
 * 
 * Ce fichier DOIT être chargé en premier dans le <head> avec defer
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        MAX_INIT_ATTEMPTS: 30,        // Nombre max de tentatives d'init
        INIT_RETRY_DELAY: 100,        // Délai entre tentatives (ms)
        WATCHDOG_INTERVAL: 500,       // Intervalle du watchdog (ms)
        WATCHDOG_DURATION: 15000,     // Durée totale du watchdog (ms)
        JS_CHECK_TIMEOUT: 3000,       // Temps max pour attendre le JS (ms)
        RENDER_CHECK_DELAY: 300,      // Délai avant vérification du rendu
        STORAGE_KEY: 'expenseTrackerData',
        DEBUG: true                   // Activer les logs de debug
    };
    
    // Fonctions critiques qui DOIVENT exister pour que l'app fonctionne
    const CRITICAL_FUNCTIONS = [
        'initializeApp',
        'loadData',
        'renderApp',
        'switchTab',
        'saveData'
    ];
    
    // ============================================
    // ÉTAT DU SYSTÈME DE DÉMARRAGE
    // ============================================
    const bootState = {
        initialized: false,
        initAttempts: 0,
        domReady: false,
        jsLoaded: false,
        dataLoaded: false,
        renderComplete: false,
        watchdogActive: false,
        startTime: Date.now(),
        reloadTriggered: false
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
    // VÉRIFICATION DU JAVASCRIPT CHARGÉ
    // ============================================
    function isJavaScriptLoaded() {
        // Vérifier que toutes les fonctions critiques existent
        for (const funcName of CRITICAL_FUNCTIONS) {
            if (typeof window[funcName] !== 'function') {
                return false;
            }
        }
        return true;
    }
    
    function getMissingFunctions() {
        const missing = [];
        for (const funcName of CRITICAL_FUNCTIONS) {
            if (typeof window[funcName] !== 'function') {
                missing.push(funcName);
            }
        }
        return missing;
    }
    
    // ============================================
    // VÉRIFICATION DU DOM
    // ============================================
    function isDOMReady() {
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
        
        if (!hasData) {
            return true;
        }
        
        try {
            const data = JSON.parse(hasData);
            const userCount = Object.keys(data.users || {}).length;
            
            const dashboardHasContent = dashboardContent && 
                                        dashboardContent.innerHTML.trim() !== '' &&
                                        dashboardContent.children.length > 0;
            
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
    // FORCER LE RECHARGEMENT DE LA PAGE
    // ============================================
    function forcePageReload(reason) {
        if (bootState.reloadTriggered) {
            log('Reload déjà déclenché, ignoré');
            return;
        }
        
        const reloadCount = parseInt(sessionStorage.getItem('bootReloadCount') || '0');
        
        if (reloadCount >= 2) {
            error('Trop de reloads, abandon. Raison:', reason);
            sessionStorage.removeItem('bootReloadCount');
            showCriticalError();
            return;
        }
        
        warn(`🔄 Reload forcé (#${reloadCount + 1}). Raison: ${reason}`);
        bootState.reloadTriggered = true;
        sessionStorage.setItem('bootReloadCount', String(reloadCount + 1));
        
        // Utiliser location.reload(true) pour bypass le cache
        window.location.reload(true);
    }
    
    // ============================================
    // AFFICHER ERREUR CRITIQUE
    // ============================================
    function showCriticalError() {
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
                background: #1f2937;
                color: white;
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
                <h2 style="margin-bottom: 1rem;">Problème de chargement</h2>
                <p style="color: #9ca3af; margin-bottom: 1.5rem; max-width: 300px;">
                    L'application n'a pas pu démarrer correctement.
                    Essayez de vider le cache de l'application.
                </p>
                <button onclick="
                    sessionStorage.clear();
                    caches.keys().then(names => names.forEach(name => caches.delete(name)));
                    setTimeout(() => location.reload(true), 500);
                " style="
                    background: #8b5cf6;
                    color: white;
                    border: none;
                    padding: 14px 28px;
                    border-radius: 10px;
                    font-size: 1rem;
                    cursor: pointer;
                    margin-bottom: 1rem;
                ">
                    🔄 Vider le cache et recharger
                </button>
                <button onclick="location.reload(true)" style="
                    background: transparent;
                    color: #9ca3af;
                    border: 1px solid #4b5563;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    cursor: pointer;
                ">
                    Recharger simplement
                </button>
            </div>
        `;
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
            forcePageReload('Max tentatives atteint - JS probablement non chargé');
            return;
        }
        
        // Vérifier si le DOM est prêt
        if (!isDOMReady()) {
            log('DOM pas prêt, nouvelle tentative...');
            setTimeout(attemptInitialization, CONFIG.INIT_RETRY_DELAY);
            return;
        }
        
        bootState.domReady = true;
        
        // Vérifier si le JavaScript est chargé
        if (!isJavaScriptLoaded()) {
            const missing = getMissingFunctions();
            log('JS pas encore chargé. Fonctions manquantes:', missing.join(', '));
            
            // Vérifier si on a attendu trop longtemps
            const elapsed = Date.now() - bootState.startTime;
            if (elapsed > CONFIG.JS_CHECK_TIMEOUT) {
                warn(`⚠️ JavaScript non chargé après ${elapsed}ms !`);
                forcePageReload('JavaScript inline non exécuté après timeout');
                return;
            }
            
            setTimeout(attemptInitialization, CONFIG.INIT_RETRY_DELAY);
            return;
        }
        
        bootState.jsLoaded = true;
        log('✅ DOM prêt et JavaScript chargé !');
        
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
            
            // Nettoyer le compteur de reload en cas de succès
            sessionStorage.removeItem('bootReloadCount');
            
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
                sessionStorage.removeItem('bootReloadCount');
                stopWatchdog();
            }
        }, CONFIG.RENDER_CHECK_DELAY);
    }
    
    // ============================================
    // FORCER LE RE-RENDU
    // ============================================
    function forceRerender() {
        log('🔄 Forçage du re-rendu...');
        
        // D'abord vérifier que le JS est toujours chargé
        if (!isJavaScriptLoaded()) {
            warn('JS non disponible pour re-render !');
            forcePageReload('JS disparu lors du re-render');
            return;
        }
        
        try {
            if (typeof window.loadData === 'function') {
                window.loadData();
                log('Données rechargées');
            }
            
            if (typeof window.renderApp === 'function') {
                window.renderApp();
                log('renderApp() forcé');
            }
            
            setTimeout(() => {
                if (!isRenderComplete()) {
                    warn('Rendu toujours incomplet après re-rendu forcé');
                    forcePageReload('Re-render échoué');
                } else {
                    log('✅ Re-rendu réussi !');
                    bootState.renderComplete = true;
                    sessionStorage.removeItem('bootReloadCount');
                }
            }, CONFIG.RENDER_CHECK_DELAY);
            
        } catch (e) {
            error('Erreur lors du re-rendu forcé:', e);
            forcePageReload('Exception lors du re-render');
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
            
            if (elapsed > CONFIG.WATCHDOG_DURATION) {
                log('Watchdog terminé (durée max atteinte)');
                stopWatchdog();
                return;
            }
            
            if (bootState.renderComplete) {
                log('Watchdog terminé (rendu complet)');
                stopWatchdog();
                return;
            }
            
            // Vérifier si le JS est toujours chargé
            if (!isJavaScriptLoaded() && elapsed > CONFIG.JS_CHECK_TIMEOUT) {
                warn(`Watchdog: JS non chargé à +${elapsed}ms`);
                forcePageReload('Watchdog: JS non détecté');
                stopWatchdog();
                return;
            }
            
            // Vérifier l'état du rendu
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
    // GESTION DU CYCLE DE VIE PWA
    // ============================================
    
    window.addEventListener('pageshow', function(event) {
        log('📄 pageshow déclenché, persisted:', event.persisted);
        
        if (event.persisted) {
            log('Page restaurée depuis bfcache');
            
            // Vérifier immédiatement si le JS est chargé
            if (!isJavaScriptLoaded()) {
                warn('JS non disponible après restauration bfcache !');
                forcePageReload('bfcache: JS non disponible');
                return;
            }
            
            setTimeout(() => {
                if (!isRenderComplete()) {
                    forceRerender();
                }
            }, 100);
        }
    });
    
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            log('📱 Application revenue au premier plan');
            
            // Vérifier si le JS est toujours là
            if (!isJavaScriptLoaded()) {
                warn('JS non disponible au retour au premier plan !');
                forcePageReload('visibilitychange: JS non disponible');
                return;
            }
            
            setTimeout(() => {
                if (bootState.initialized && !isRenderComplete()) {
                    warn('Affichage vide détecté au retour');
                    forceRerender();
                }
            }, 200);
        }
    });
    
    window.addEventListener('focus', function() {
        log('🎯 Focus reçu');
        
        if (!isJavaScriptLoaded()) {
            warn('JS non disponible au focus !');
            forcePageReload('focus: JS non disponible');
            return;
        }
        
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
        log('🏁 Démarrage du système de boot v3.0');
        
        // Vérifier si on a déjà essayé trop de fois
        const reloadCount = parseInt(sessionStorage.getItem('bootReloadCount') || '0');
        if (reloadCount > 0) {
            log(`⚠️ Tentative de boot #${reloadCount + 1} après reload`);
        }
        
        startWatchdog();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attemptInitialization);
        } else {
            attemptInitialization();
        }
        
        window.addEventListener('load', function() {
            log('📄 window.load déclenché');
            
            if (!bootState.initialized) {
                attemptInitialization();
            } else if (!bootState.renderComplete) {
                verifyRenderAfterDelay();
            }
        });
    }
    
    // Exposer pour debug
    window.bootSystem = {
        state: bootState,
        config: CONFIG,
        forceRerender: forceRerender,
        forceReload: () => forcePageReload('Manuel'),
        checkRender: isRenderComplete,
        checkJS: isJavaScriptLoaded,
        getMissing: getMissingFunctions
    };
    
    // Démarrer !
    startBoot();
    
})();