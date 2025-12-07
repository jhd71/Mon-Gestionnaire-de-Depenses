// ios-fixes.js - Corrections d'affichage iOS pour Gestionnaire de Dépenses
(function() {
    'use strict';

    // Détection iOS
    function isiOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    // Détection iPad sur iOS 13+
    function isIPadOS() {
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    }

    // Application des fixes iOS au chargement du DOM
    document.addEventListener('DOMContentLoaded', function() {
        if (isiOS() || isIPadOS()) {
            // Ajouter une classe au body pour cibler iOS
            document.body.classList.add('ios-device');
            
            console.log('📱 iOS détecté - Application des corrections pour Gestionnaire de Dépenses...');
            
            // Créer et ajouter les styles CSS pour iOS
            const style = document.createElement('style');
            style.id = 'ios-fixes-styles';
            style.textContent = `
                /* ========================================
                   GESTIONNAIRE DE DÉPENSES - iOS FIXES
                   ======================================== */
                
                /* Variables pour les espacements iOS */
                :root {
                    --ios-safe-area-top: env(safe-area-inset-top, 20px);
                    --ios-safe-area-bottom: env(safe-area-inset-bottom, 34px);
                    --ios-safe-area-left: env(safe-area-inset-left, 0px);
                    --ios-safe-area-right: env(safe-area-inset-right, 0px);
                }
                
                /* ========== HEADER ========== */
                .ios-device .header {
                    padding-top: calc(1rem + var(--ios-safe-area-top)) !important;
                    position: sticky !important;
                    top: 0 !important;
                    z-index: 100 !important;
                }
                
                /* ========== ONGLETS ========== */
                .ios-device .tabs {
                    position: sticky !important;
                    top: calc(70px + var(--ios-safe-area-top)) !important;
                    z-index: 90 !important;
                    -webkit-overflow-scrolling: touch !important;
                }
                
                /* ========== CONTENU PRINCIPAL ========== */
                .ios-device .content {
                    padding-bottom: calc(100px + var(--ios-safe-area-bottom)) !important;
                    -webkit-overflow-scrolling: touch !important;
                }
                
                /* ========== FAB (Bouton flottant) ========== */
                .ios-device .fab {
                    bottom: calc(2rem + var(--ios-safe-area-bottom)) !important;
                    z-index: 1000 !important;
                }
                
                .ios-device .fab-menu {
                    bottom: calc(6rem + var(--ios-safe-area-bottom)) !important;
                }
                
                /* ========== MODALS ========== */
                .ios-device .modal-content {
                    max-height: calc(100vh - var(--ios-safe-area-top) - var(--ios-safe-area-bottom) - 40px) !important;
                    margin-top: var(--ios-safe-area-top) !important;
                    margin-bottom: var(--ios-safe-area-bottom) !important;
                }
                
                .ios-device .modal-body {
                    -webkit-overflow-scrolling: touch !important;
                    overscroll-behavior: contain !important;
                }
                
                /* ========== INPUTS (éviter zoom automatique) ========== */
                .ios-device input[type="text"],
                .ios-device input[type="number"],
                .ios-device input[type="email"],
                .ios-device input[type="tel"],
                .ios-device select,
                .ios-device textarea {
                    font-size: 16px !important;
                    -webkit-text-size-adjust: 100% !important;
                }
                
                /* ========== SECTIONS ========== */
                .ios-device .section {
                    -webkit-overflow-scrolling: touch !important;
                }
                
                /* ========== CARTES UTILISATEURS ========== */
                .ios-device .user-card {
                    -webkit-tap-highlight-color: transparent !important;
                    touch-action: manipulation !important;
                }
                
                /* ========== BOUTONS ========== */
                .ios-device .btn,
                .ios-device .btn-icon,
                .ios-device .tab,
                .ios-device .add-tab,
                .ios-device button {
                    -webkit-tap-highlight-color: transparent !important;
                    touch-action: manipulation !important;
                }
                
                /* ========== ITEMS (revenus/dépenses) ========== */
                .ios-device .item {
                    -webkit-tap-highlight-color: transparent !important;
                }
                
                /* ========== TOAST NOTIFICATIONS ========== */
                .ios-device .toast,
                .ios-device [style*="position: fixed"][style*="top: 20px"] {
                    top: calc(20px + var(--ios-safe-area-top)) !important;
                }
                
                /* ========== PIN MODAL ========== */
                .ios-device #pinModal .modal-content {
                    padding-top: calc(1.5rem + var(--ios-safe-area-top)) !important;
                }
                
                .ios-device .pin-btn {
                    -webkit-tap-highlight-color: transparent !important;
                }
                
                /* ========== SCROLL AMÉLIORÉ ========== */
                .ios-device .tabs,
                .ios-device .dashboard,
                .ios-device .items-list,
                .ios-device .modal-body {
                    -webkit-overflow-scrolling: touch !important;
                    overscroll-behavior-y: contain !important;
                }
                
                /* ========== MODE PAYSAGE ========== */
                @media (orientation: landscape) {
                    .ios-device .header {
                        padding-left: calc(1.5rem + var(--ios-safe-area-left)) !important;
                        padding-right: calc(1.5rem + var(--ios-safe-area-right)) !important;
                    }
                    
                    .ios-device .content {
                        padding-left: calc(1.5rem + var(--ios-safe-area-left)) !important;
                        padding-right: calc(1.5rem + var(--ios-safe-area-right)) !important;
                    }
                    
                    .ios-device .fab {
                        right: calc(2rem + var(--ios-safe-area-right)) !important;
                    }
                }
                
                /* ========== PETITS ÉCRANS (iPhone SE, etc.) ========== */
                @media (max-width: 375px) {
                    .ios-device .header h1 {
                        font-size: 1rem !important;
                    }
                    
                    .ios-device .btn-icon {
                        width: 36px !important;
                        height: 36px !important;
                    }
                    
                    .ios-device .tab {
                        padding: 0.5rem 1rem !important;
                        font-size: 0.875rem !important;
                    }
                    
                    .ios-device .user-card {
                        padding: 1rem !important;
                    }
                    
                    .ios-device .stat-value {
                        font-size: 1.25rem !important;
                    }
                }
                
                /* ========== GRANDS ÉCRANS (iPad) ========== */
                @media (min-width: 768px) {
                    .ios-device .modal-content {
                        max-width: 500px !important;
                        border-radius: var(--radius-xl) !important;
                    }
                }
                
                /* ========== CLAVIER VIRTUEL OUVERT ========== */
                .ios-device.keyboard-visible .fab {
                    display: none !important;
                }
                
                .ios-device.keyboard-visible .modal-content {
                    max-height: 60vh !important;
                }
                
                /* ========== POPUP DONATION ========== */
                .ios-device .donation-popup {
                    max-height: calc(100vh - var(--ios-safe-area-top) - var(--ios-safe-area-bottom) - 40px) !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                }
                
                /* ========== CALCULATRICE ========== */
                .ios-device .calculator {
                    -webkit-tap-highlight-color: transparent !important;
                }
                
                .ios-device .calc-btn {
                    -webkit-tap-highlight-color: transparent !important;
                    touch-action: manipulation !important;
                }
                
                /* ========== BALANCE SECTION ========== */
                .ios-device #balance-content .item {
                    -webkit-tap-highlight-color: transparent !important;
                }
                
                /* ========== VIREMENTS ========== */
                .ios-device #transfers-list .item {
                    -webkit-tap-highlight-color: transparent !important;
                }
            `;
            document.head.appendChild(style);
            
            console.log('✅ iOS fixes CSS appliqués pour Gestionnaire de Dépenses');
            
            // ========== DÉTECTION DU CLAVIER VIRTUEL ==========
            let initialHeight = window.innerHeight;
            
            window.addEventListener('resize', function() {
                const currentHeight = window.innerHeight;
                
                if (currentHeight < initialHeight * 0.75) {
                    document.body.classList.add('keyboard-visible');
                    console.log('⌨️ Clavier virtuel détecté');
                } else {
                    document.body.classList.remove('keyboard-visible');
                }
            });
            
            // ========== FIX POUR LE SCROLL ÉLASTIQUE ==========
            let startY = 0;
            
            document.addEventListener('touchstart', function(e) {
                startY = e.touches[0].pageY;
            }, { passive: true });
            
            document.addEventListener('touchmove', function(e) {
                const scrollableElement = e.target.closest('.modal-body, .items-list, .dashboard, .content');
                
                if (!scrollableElement) {
                    // Si on n'est pas dans un élément scrollable, empêcher le bounce
                    if (document.body.scrollTop === 0 && e.touches[0].pageY > startY) {
                        // Tentative de scroll vers le haut quand on est déjà en haut
                        // Ne rien faire, laisser le comportement par défaut
                    }
                }
            }, { passive: true });
            
            // ========== FIX DOUBLE-TAP ZOOM ==========
            let lastTouchEnd = 0;
            document.addEventListener('touchend', function(e) {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, { passive: false });
            
            console.log('📱 iOS fixes complets appliqués pour Gestionnaire de Dépenses');
        }
    });
    
    // Exposer pour debug
    window.checkiOSDepenses = function() {
        console.log('iOS:', isiOS());
        console.log('iPadOS:', isIPadOS());
        console.log('User Agent:', navigator.userAgent);
        console.log('Platform:', navigator.platform);
        console.log('Max Touch Points:', navigator.maxTouchPoints);
        console.log('Classes body:', document.body.className);
    };
    
})();