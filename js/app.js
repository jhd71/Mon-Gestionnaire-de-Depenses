    // État global de l'application
	let currentTab = 'dashboard';
	
	// Fonction de notification
    function showNotification(message, type = 'info') {
        // Supprimer une notification existante
        const existing = document.querySelector('.app-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'app-notification';
        
        // Couleurs selon le type
        let bgColor = '#3b82f6'; // info (bleu)
        if (type === 'success') bgColor = '#10b981'; // vert
        if (type === 'error') bgColor = '#ef4444'; // rouge
        if (type === 'warning') bgColor = '#f59e0b'; // orange
        
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${bgColor};
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: slideUp 0.3s ease;
            max-width: 90%;
            text-align: center;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Disparaît après 3 secondes
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
	
    let appData = {
        users: {
            'commun': {
                name: 'Commun',
                incomes: [],
                expenses: []
            }
        },
        commonExpenses: [],
        transfers: [], // Nouveau : virements entre personnes
        currentTab: 'dashboard',
        theme: 'dark'
    };

    // Variables globales
    let currentUser = '';
    let calcExpression = '0';
    let confirmCallback = null;
    let actionCount = 0;
	
	// Liste des avatars disponibles
    const availableAvatars = [
        '👤', '👩', '👨', '👧', '👦', '🧑', 
        '👩‍🦰', '👨‍🦰', '👩‍🦱', '👨‍🦱', '👩‍🦳', '👨‍🦳',
        '🧔', '👴', '👵', '🧒', '👶', '🐱',
        '🐶', '🦊', '🐻', '🐼', '🦁', '🐸',
        '🌟', '💎', '🔥', '⚡', '🌈', '🎯'
    ];
    
    // Avatar sélectionné pour nouvel utilisateur
    let selectedAvatar = '👤';
	
    let sessionStart = Date.now();

    // Fonction d'initialisation principale
    function initializeApp() {
        console.log('🚀 Initialisation de l\'application...');
        
        // Appliquer le thème sauvegardé
        const preferredTheme = localStorage.getItem('preferredTheme') || 
                              document.body.getAttribute('data-theme') || 
                              'dark';
        
        document.body.setAttribute('data-theme', preferredTheme);
        document.documentElement.setAttribute('data-theme', preferredTheme);
        
        // Charger les données
        loadData();
        
        // Forcer la synchronisation du thème
        if (appData.theme !== preferredTheme) {
            appData.theme = preferredTheme;
        }
        
        checkUrlImport();
        initSecurity();
        syncTheme();
        initPWA();
        
        // RENDU PRINCIPAL
        renderApp();
        console.log('✅ renderApp() exécuté');
        
        initDonation();
        
        // Masquer le FAB au démarrage si on est sur le tableau de bord
        const fabButton = document.getElementById('fabButton');
        if (fabButton && appData.currentTab === 'dashboard') {
            fabButton.style.display = 'none';
        }
        
        // Vérifications anti-bug multiples
        setTimeout(checkAndFixEmptyDisplay, 300);
        setTimeout(checkAndFixEmptyDisplay, 1000);
        setTimeout(checkAndFixEmptyDisplay, 3000);
        
        // Surcharge de exportData pour le tracking
        const originalExportData = window.exportData || exportData;
        window.exportData = function() {
            originalExportData();
            trackUserAction();
            
            if (!localStorage.getItem('exportDonationSuggested')) {
                setTimeout(() => {
                    if (confirm('✅ Données exportées avec succès !\n\nCette application vous fait gagner du temps ?\nConsidérez un petit don pour nous aider à la maintenir gratuite ! 💖')) {
                        showDonationPopup();
                    }
                    localStorage.setItem('exportDonationSuggested', 'true');
                }, 500);
            }
        };
        
        // Sauvegarde automatique
        setInterval(saveData, 5000);
        
        console.log('✅ Application initialisée avec succès');
        
        // Cacher l'écran de chargement PWA
        if (typeof window.hidePwaLoader === 'function') {
            window.hidePwaLoader();
        }
    }
    
    // ============================================
    // SYSTÈME DE DÉMARRAGE ROBUSTE POUR PWA
    // ============================================
    
    // Variable pour éviter les initialisations multiples
    let appInitialized = false;
    
    // Fonction de démarrage sécurisée
    function safeInitializeApp() {
        if (appInitialized) {
            console.log('⚠️ App déjà initialisée, skip...');
            return;
        }
        
        // Vérifier que le DOM est prêt
        const dashboardContent = document.getElementById('dashboard-content');
        const tabsContainer = document.getElementById('tabs');
        
        if (!dashboardContent || !tabsContainer) {
            console.log('⏳ DOM pas encore prêt, nouvelle tentative dans 50ms...');
            setTimeout(safeInitializeApp, 50);
            return;
        }
        
        console.log('🚀 Lancement de l\'initialisation...');
        appInitialized = true;
        initializeApp();
    }
    
    // 1. DOMContentLoaded classique
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInitializeApp);
    } else {
        // DOM déjà prêt
        safeInitializeApp();
    }
    
    // 2. Sécurité supplémentaire avec window.onload
    window.addEventListener('load', () => {
        console.log('📄 window.load déclenché');
        if (!appInitialized) {
            safeInitializeApp();
        } else {
            // Vérifier si l'affichage est vide malgré l'initialisation
            setTimeout(checkAndFixEmptyDisplay, 100);
        }
    });
    
    // 3. WATCHDOG PERMANENT - Vérifie toutes les 500ms pendant 5 secondes
    let watchdogCount = 0;
    const maxWatchdogChecks = 10;
    
    const watchdogInterval = setInterval(() => {
        watchdogCount++;
        
        const dashboardContent = document.getElementById('dashboard-content');
        const tabsContainer = document.getElementById('tabs');
        const saved = localStorage.getItem('expenseTrackerData');
        
        // Vérifier si l'affichage est vide alors qu'il y a des données
        const isDashboardEmpty = !dashboardContent || dashboardContent.innerHTML.trim() === '';
        const areTabsIncomplete = !tabsContainer || tabsContainer.querySelectorAll('.tab').length < 2;
        
        if ((isDashboardEmpty || areTabsIncomplete) && saved) {
            console.warn(`🔍 Watchdog #${watchdogCount}: Affichage incomplet détecté!`);
            appInitialized = false; // Permettre une nouvelle initialisation
            safeInitializeApp();
        }
        
        // Arrêter le watchdog après le maximum de vérifications
        if (watchdogCount >= maxWatchdogChecks) {
            clearInterval(watchdogInterval);
            console.log('✅ Watchdog terminé');
        }
    }, 500);

// ========== NAVIGATION PAR SWIPE ==========
    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 80;
    const maxVerticalDistance = 100;
    
    // Obtenir la liste ordonnée des onglets
    function getTabsOrder() {
        const tabs = ['dashboard'];
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                tabs.push(userId);
            }
        }
        tabs.push('commun');
        return tabs;
    }
    
    // Naviguer vers l'onglet précédent
    function goToPreviousTab() {
        const tabs = getTabsOrder();
        const currentIndex = tabs.indexOf(currentTab);
        if (currentIndex > 0) {
            const newTab = tabs[currentIndex - 1];
            switchTab(newTab);
            showSwipeIndicator('◀', 'left');
        }
    }
    
    // Naviguer vers l'onglet suivant
    function goToNextTab() {
        const tabs = getTabsOrder();
        const currentIndex = tabs.indexOf(currentTab);
        if (currentIndex < tabs.length - 1) {
            const newTab = tabs[currentIndex + 1];
            switchTab(newTab);
            showSwipeIndicator('▶', 'right');
        }
    }
    
    // Afficher un indicateur de swipe
    function showSwipeIndicator(symbol, direction) {
        const existing = document.querySelector('.swipe-indicator');
        if (existing) existing.remove();
        
        const indicator = document.createElement('div');
        indicator.className = 'swipe-indicator';
        indicator.textContent = symbol;
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            ${direction === 'left' ? 'left: 20px' : 'right: 20px'};
            transform: translateY(-50%);
            font-size: 2rem;
            color: var(--primary);
            background: var(--bg-secondary);
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            animation: swipeFade 0.4s ease-out forwards;
            pointer-events: none;
        `;
        document.body.appendChild(indicator);
        setTimeout(() => indicator.remove(), 400);
    }
    
    // Gestionnaires tactiles
    function handleTouchStart(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
    
    function handleTouchEnd(e) {
        touchEndX = e.changedTouches[0].clientX;
        touchEndY = e.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaY) < maxVerticalDistance) {
            if (deltaX > 0) {
                goToPreviousTab();
            } else {
                goToNextTab();
            }
        }
    }
    
    // Initialiser le swipe après le chargement du DOM
    function initSwipe() {
        const contentArea = document.querySelector('.content');
        if (contentArea) {
            contentArea.addEventListener('touchstart', handleTouchStart, { passive: true });
            contentArea.addEventListener('touchend', handleTouchEnd, { passive: true });
        }
    }
    
    // Appeler l'initialisation quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSwipe);
    } else {
        initSwipe();
    }
	
    // Fonctions de gestion des données
    function loadData() {
    try {
        const saved = localStorage.getItem('expenseTrackerData');
        if (saved) {
            const parsedData = JSON.parse(saved);
            
            // Vérifier que les données sont valides
            if (parsedData && parsedData.users) {
                appData = parsedData;
                // Synchroniser currentTab avec les données chargées
                currentTab = appData.currentTab || 'dashboard';
                console.log('✅ Données chargées:', Object.keys(appData.users).length, 'utilisateurs');
            } else {
                console.warn('⚠️ Données invalides, utilisation des données par défaut');
            }
        }
        
        // S'assurer que les structures de base existent
        if (!appData.users) appData.users = { 'commun': { name: 'Commun', incomes: [], expenses: [] } };
        if (!appData.commonExpenses) appData.commonExpenses = [];
        if (!appData.transfers) appData.transfers = [];
        
    } catch (error) {
        console.error('❌ Erreur chargement données:', error);
        // En cas d'erreur, garder les données par défaut
    }
    
    // Charger le thème préféré de l'utilisateur
    const preferredTheme = localStorage.getItem('preferredTheme');
    if (preferredTheme) {
        appData.theme = preferredTheme;
        document.body.setAttribute('data-theme', preferredTheme);
    } else {
        // Si pas de préférence sauvegardée, utiliser le thème actuel du body ou dark par défaut
        const currentBodyTheme = document.body.getAttribute('data-theme') || 'dark';
        appData.theme = currentBodyTheme;
        localStorage.setItem('preferredTheme', currentBodyTheme);
    }
}

    function saveData() {
        localStorage.setItem('expenseTrackerData', JSON.stringify(appData));
    }

// Vérifier et corriger l'affichage vide
    function checkAndFixEmptyDisplay() {
        const dashboardContent = document.getElementById('dashboard-content');
        const tabsContainer = document.getElementById('tabs');
        const saved = localStorage.getItem('expenseTrackerData');
        
        // Vérifier si l'affichage est vide
        const isDashboardEmpty = !dashboardContent || dashboardContent.innerHTML.trim() === '';
        const areTabsIncomplete = !tabsContainer || tabsContainer.querySelectorAll('.tab').length < 2;
        
        if ((isDashboardEmpty || areTabsIncomplete) && saved) {
            console.warn('🔄 Affichage vide détecté !');
            console.log('Dashboard vide:', isDashboardEmpty);
            console.log('Onglets incomplets:', areTabsIncomplete);
            
            try {
                const parsedData = JSON.parse(saved);
                const userCount = Object.keys(parsedData.users || {}).length;
                
                console.log('Nombre d\'utilisateurs en mémoire:', userCount);
                
                if (userCount > 0) {
                    console.log('🔄 Rechargement automatique des données...');
                    loadData();
                    renderApp();
                    
                    // Vérifier une dernière fois après un court délai
                    setTimeout(() => {
                        const newDashboard = document.getElementById('dashboard-content');
                        const newTabs = document.getElementById('tabs');
                        
                        const stillEmpty = (!newDashboard || newDashboard.innerHTML.trim() === '') ||
                                           (!newTabs || newTabs.querySelectorAll('.tab').length < 2);
                        
                        if (stillEmpty) {
                            // Dernier recours : forcer un rechargement de la page
                            const reloadCount = parseInt(sessionStorage.getItem('reloadCount') || '0');
                            if (reloadCount < 2) {
                                console.log('🔄 Forçage du rechargement de la page...');
                                sessionStorage.setItem('reloadCount', String(reloadCount + 1));
                                window.location.reload();
                            } else {
                                console.error('❌ Problème persistant après 2 rechargements');
                                sessionStorage.removeItem('reloadCount');
                                // Afficher un message à l'utilisateur
                                alert('Une erreur est survenue. Veuillez fermer et rouvrir l\'application.');
                            }
                        } else {
                            console.log('✅ Affichage restauré avec succès !');
                            sessionStorage.removeItem('reloadCount');
                        }
                    }, 300);
                }
            } catch (e) {
                console.error('Erreur vérification:', e);
            }
        } else if (!isDashboardEmpty && !areTabsIncomplete) {
            // Tout va bien, nettoyer les flags
            sessionStorage.removeItem('reloadCount');
        }
    }
    
    // Vérifier aussi quand l'app revient au premier plan (mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('📱 App revenue au premier plan');
            setTimeout(() => {
                checkAndFixEmptyDisplay();
            }, 200);
        }
    });
    
    // Vérifier quand la fenêtre reprend le focus
    window.addEventListener('focus', () => {
        setTimeout(() => {
            checkAndFixEmptyDisplay();
        }, 200);
    });
	
	// Vérifier quand la page est restaurée depuis le cache (bouton retour, PWA)
    window.addEventListener('pageshow', (event) => {
        console.log('📱 pageshow déclenché, persisted:', event.persisted);
        if (event.persisted) {
            // La page a été restaurée depuis le cache
            console.log('🔄 Page restaurée depuis le cache, vérification...');
            setTimeout(() => {
                checkAndFixEmptyDisplay();
            }, 100);
        }
    });
    
    // Vérification au réveil après mise en veille
    let lastActiveTime = Date.now();
    setInterval(() => {
        const now = Date.now();
        // Si plus de 5 secondes se sont écoulées depuis la dernière vérification
        // (indique que l'appareil était peut-être en veille)
        if (now - lastActiveTime > 5000) {
            console.log('📱 Appareil réveillé, vérification affichage...');
            checkAndFixEmptyDisplay();
        }
        lastActiveTime = now;
    }, 1000);
	
    // Fonctions de donation
    function trackUserAction() {
        actionCount++;
        const sessionTime = Date.now() - sessionStart;
        
        // Après 10 actions ou 5 minutes d'utilisation dans la session
        if ((actionCount >= 10 || sessionTime > 300000) && !sessionStorage.getItem('donationShownThisSession')) {
            const lastPrompt = localStorage.getItem('lastDonationPrompt');
            const hoursSinceLastPrompt = lastPrompt ? 
                (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60) : 999;
            
            // Ne pas montrer si déjà montré dans les dernières 24h
            if (hoursSinceLastPrompt > 24) {
                showDonationPopup();
                sessionStorage.setItem('donationShownThisSession', 'true');
                localStorage.setItem('lastDonationPrompt', Date.now());
            }
        }
    }

    function showDonationPopup() {
        const popup = document.getElementById('donationPopup');
        if (popup) {
            popup.style.display = 'flex';
        }
    }

    function closeDonationPopup() {
        const popup = document.getElementById('donationPopup');
        if (popup) {
            popup.style.display = 'none';
        }
    }

    function initDonation() {
    const donationPopup = document.getElementById('donationPopup');
    if (donationPopup) {
        donationPopup.addEventListener('click', (e) => {
            if (e.target === donationPopup) {
                closeDonationPopup();
            }
        });
    }
    
    const firstUse = localStorage.getItem('firstUse');
    if (!firstUse) {
        localStorage.setItem('firstUse', Date.now());
        
        // Pour les nouveaux utilisateurs : popup après 10 minutes d'utilisation
        setTimeout(() => {
            if (!sessionStorage.getItem('donationShownThisSession')) {
                showDonationPopup();
                sessionStorage.setItem('donationShownThisSession', 'true');
                localStorage.setItem('lastDonationPrompt', Date.now());
            }
        }, 600000); // 10 minutes
        return;
    }
    
    // Pour les utilisateurs réguliers : système existant
    const daysSinceFirstUse = (Date.now() - parseInt(firstUse)) / (1000 * 60 * 60 * 24);
    const lastDonationPrompt = localStorage.getItem('lastDonationPrompt');
    const daysSinceLastPrompt = lastDonationPrompt ? 
        (Date.now() - parseInt(lastDonationPrompt)) / (1000 * 60 * 60 * 24) : 999;
    
    // Après 3 jours puis tous les 30 jours
    if (daysSinceFirstUse >= 3 && daysSinceLastPrompt >= 30) {
        setTimeout(() => {
            showDonationPopup();
            localStorage.setItem('lastDonationPrompt', Date.now());
        }, 60000); // 1 minute après ouverture
    }
}

    // Variable pour stocker l'onglet à restaurer
    let tabToRestoreAfterRender = null;
    
    // Fonctions de rendu
    function renderApp(forceTab = null) {
        // Sauvegarder l'onglet actif AVANT le rendu
        tabToRestoreAfterRender = forceTab || currentTab || appData.currentTab || 'dashboard';
        
        renderTabs();
        renderDashboard();
        renderUserTabs();
        renderCommonTab();
        renderBalance();
        renderTransfers();
        updatePinButtonText();
        
        // Restaurer l'onglet APRÈS le rendu
        applyActiveTab(tabToRestoreAfterRender);
    }
    
    // Fonction pour appliquer visuellement l'onglet actif
    function applyActiveTab(tabId) {
        // S'assurer que tabId est valide
        if (!tabId || (tabId !== 'dashboard' && tabId !== 'commun' && !appData.users[tabId])) {
            tabId = 'dashboard';
        }
        
        // Mettre à jour les variables globales
        currentTab = tabId;
        appData.currentTab = tabId;
        
        // Désactiver tous les boutons d'onglets
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Activer le bon bouton d'onglet
        const allTabs = document.querySelectorAll('.tab');
        allTabs.forEach(tab => {
            const tabText = tab.textContent;
            if (tabId === 'dashboard' && tabText === 'Tableau de bord') {
                tab.classList.add('active');
            } else if (tabId === 'commun' && tabText === 'Balance') {
                tab.classList.add('active');
            } else if (appData.users[tabId] && tabText === appData.users[tabId].name) {
                tab.classList.add('active');
            }
        });
        
        // Désactiver tous les contenus
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Activer le bon contenu
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
            activeContent.classList.add('active');
        }
        
        // Gérer le FAB
        const fabButton = document.getElementById('fabButton');
        if (fabButton) {
            fabButton.style.display = (tabId === 'dashboard') ? 'none' : 'flex';
        }
    }

// Faire défiler les onglets pour montrer l'onglet actif
    function scrollTabIntoView(tabId) {
        const tabsContainer = document.getElementById('tabs');
        if (!tabsContainer) return;
        
        const allTabs = tabsContainer.querySelectorAll('.tab');
        let activeTab = null;
        
        allTabs.forEach(tab => {
            const tabText = tab.textContent;
            if (tabId === 'dashboard' && tabText === 'Tableau de bord') {
                activeTab = tab;
            } else if (tabId === 'commun' && tabText === 'Balance') {
                activeTab = tab;
            } else if (appData.users[tabId] && tabText === appData.users[tabId].name) {
                activeTab = tab;
            }
        });
        
        if (activeTab) {
            const tabRect = activeTab.getBoundingClientRect();
            const containerRect = tabsContainer.getBoundingClientRect();
            const scrollLeft = activeTab.offsetLeft - (containerRect.width / 2) + (tabRect.width / 2);
            
            tabsContainer.scrollTo({
                left: Math.max(0, scrollLeft),
                behavior: 'smooth'
            });
        }
    }
	
    function renderTabs() {
        const container = document.getElementById('tabs');
        container.innerHTML = '';
        
        // Onglet Tableau de bord (toujours en premier)
        const dashboardTab = document.createElement('button');
        dashboardTab.className = 'tab';
        dashboardTab.textContent = 'Tableau de bord';
        dashboardTab.onclick = () => switchTab('dashboard');
        container.appendChild(dashboardTab);
        
        // Onglets des utilisateurs
        Object.keys(appData.users).forEach(userId => {
            if (userId === 'commun') return;
            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.textContent = appData.users[userId].name;
            tab.onclick = () => switchTab(userId);
            container.appendChild(tab);
        });
        
        // Onglet Balance (anciennement Commun)
        const communTab = document.createElement('button');
        communTab.className = 'tab';
        communTab.textContent = 'Balance';
        communTab.onclick = () => switchTab('commun');
        container.appendChild(communTab);
        
        // Bouton ajouter utilisateur
        const addBtn = document.createElement('button');
        addBtn.className = 'add-tab';
        addBtn.textContent = '+';
        addBtn.onclick = () => openModal('addTabModal');
        container.appendChild(addBtn);
    }

    function renderDashboard() {
        const container = document.getElementById('dashboard-content');
        container.innerHTML = '';
        
        // D'abord, afficher tous les utilisateurs (sauf Commun)
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                renderUserCard(userId, container);
            }
        }
        
        // Ensuite, afficher Commun en dernier
        if (appData.users.commun) {
            renderUserCard('commun', container);
        }
    }
    
    function renderUserCard(userId, container) {
        const user = appData.users[userId];
        const totalIncome = user.incomes.reduce((sum, item) => sum + item.amount, 0);
        let totalExpense = user.expenses.reduce((sum, item) => sum + item.amount, 0);
        
        // Pour la carte "Commun", utiliser le total exact des dépenses communes
        if (userId === 'commun') {
            // Calculer le total exact sans arrondi intermédiaire
            const totalCommon = appData.commonExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            totalExpense = totalCommon;
        }
        
        // Calculer la part des dépenses communes pour les utilisateurs
        let commonShare = 0;
        if (userId !== 'commun') {
            appData.commonExpenses.forEach(expense => {
                if (expense.participants.includes(userId)) {
                    commonShare += expense.amount / expense.participants.length;
                }
            });
        }
        
        const balance = totalIncome - totalExpense - commonShare;
        const isPositive = balance >= 0;
        
        // Générer l'avatar (personnalisé ou par défaut)
        const avatar = userId === 'commun' ? '👥' : (user.avatar || '👤');
        
        // Info dette : utiliser calculateBalance() pour cohérence avec la section Balance
        let transferInfo = '';
        if (userId !== 'commun') {
            const allBalances = calculateBalance();
            const userDebtBalance = allBalances[userId] || 0;
            
            // Seuil pour éviter les erreurs d'arrondi
            if (userDebtBalance > 0.01) {
                transferInfo = `<div class="transfer-info" style="color: var(--success);">💰 +${userDebtBalance.toFixed(2)}€ à récupérer</div>`;
            } else if (userDebtBalance < -0.01) {
                transferInfo = `<div class="transfer-info" style="color: var(--danger);">💸 ${userDebtBalance.toFixed(2)}€ à rembourser</div>`;
            }
        }
        
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-avatar">${avatar}</div>
                <h3>${user.name}</h3>
            </div>
            <div class="user-card-body">
                <div class="stats-grid">
                    <div class="stat-card income">
                        <div class="stat-icon">📈</div>
                        <div class="stat-label">Revenus</div>
                        <div class="stat-value">+${totalIncome.toFixed(2)}€</div>
                    </div>
                    <div class="stat-card expense">
                        <div class="stat-icon">📉</div>
                        <div class="stat-label">Dépenses</div>
                        <div class="stat-value">-${userId === 'commun' ? totalExpense.toFixed(2) : (totalExpense + commonShare).toFixed(2)}€</div>
                    </div>
                </div>
                <div class="balance-card ${isPositive ? 'positive' : 'negative'}">
                    <div class="balance-label">💰 Solde disponible</div>
                    <div class="balance-value">${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€</div>
                    ${transferInfo}
                </div>
            </div>
        `;
        container.appendChild(card);
    }

    function renderUserTabs() {
        // Créer les contenus d'onglets pour chaque utilisateur
        const content = document.querySelector('.content');
        
        // Supprimer les anciens onglets utilisateurs
        document.querySelectorAll('.user-tab-content').forEach(el => el.remove());
        
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                const tabContent = document.createElement('div');
                tabContent.id = userId;
                tabContent.className = 'tab-content user-tab-content';
                
                const userAvatar = appData.users[userId].avatar || '👤';
                
                tabContent.innerHTML = `
                    <div class="section user-profile-section">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <button class="user-avatar-btn" onclick="changeUserAvatar('${userId}')" title="Modifier l'avatar">
                                <span class="user-avatar-large">${userAvatar}</span>
                                <span class="avatar-edit-icon">✏️</span>
                            </button>
                            <div>
                                <h2 style="margin: 0; font-size: 1.25rem;">${appData.users[userId].name}</h2>
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">Cliquez sur l'avatar pour le modifier</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h2 class="section-title">Revenus</h2>
                            <button class="btn btn-small" onclick="addIncome('${userId}')">+ Ajouter</button>
                        </div>
                        <div id="${userId}-incomes" class="items-list">
                            ${renderItems(appData.users[userId].incomes, 'income', userId)}
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-header">
                            <h2 class="section-title">Dépenses</h2>
                            <button class="btn btn-small" onclick="addExpense('${userId}')">+ Ajouter</button>
                        </div>
                        <div id="${userId}-expenses" class="items-list">
                            ${renderItems(appData.users[userId].expenses, 'expense', userId)}
                        </div>
                    </div>
                    
                    <div class="section" style="margin-top: 2rem; text-align: center;">
                        <button class="btn btn-danger" onclick="deleteUser('${userId}')">
                            <span class="material-icons">delete_forever</span>
                            Supprimer cet utilisateur
                        </button>
                    </div>
                `;
                
                content.appendChild(tabContent);
            }
        }
    }

    function renderCommonTab() {
        // Rendu des revenus communs
        const commonIncomes = document.getElementById('commun-incomes');
        commonIncomes.innerHTML = renderItems(appData.users.commun.incomes, 'income', 'commun');
        
        // Rendu des dépenses communes
        const commonExpenses = document.getElementById('commun-expenses');
        if (appData.commonExpenses.length === 0) {
            commonExpenses.innerHTML = '<div class="empty-state">Aucune dépense commune ajoutée</div>';
        } else {
            commonExpenses.innerHTML = appData.commonExpenses.map((expense, index) => {
                const paidByName = expense.paidBy ? (appData.users[expense.paidBy]?.name || 'Inconnu') : 'Non défini';
                const participantNames = expense.participants.map(p => appData.users[p]?.name || 'Inconnu').join(', ');
                const perPerson = expense.participants.length > 0 
                    ? (expense.amount / expense.participants.length).toFixed(2) 
                    : expense.amount.toFixed(2);
                
                return `
                    <div class="item expense-item" onclick="editCommonExpense(${index})" style="cursor: pointer;">
                        <div class="item-icon expense">${expense.icon || '🛒'}</div>
                        <div class="item-info">
                            <div class="item-name">${expense.name}</div>
                            <div class="item-meta">
                                💳 Payé par <strong>${paidByName}</strong> • ${perPerson}€/pers
                            </div>
                            <div class="item-meta" style="font-size: 0.7rem; opacity: 0.7;">
                                👥 ${participantNames}
                            </div>
                        </div>
                        <div class="item-actions">
                            <span class="item-amount expense">${expense.amount.toFixed(2)}€</span>
                            <button class="btn-edit" onclick="event.stopPropagation(); editCommonExpense(${index})" title="Modifier">✏️</button>
                            <button class="btn-delete" onclick="event.stopPropagation(); deleteCommonExpense(${index})" title="Supprimer">×</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    function renderItems(items, type, userId) {
        if (items.length === 0) {
            const icon = type === 'income' ? '📈' : '📉';
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">${icon}</div>
                    <div class="empty-state-text">Aucun élément ajouté</div>
                </div>
            `;
        }
        
        const icon = type === 'income' ? '💵' : '🛒';
        const itemClass = type === 'income' ? 'income-item' : 'expense-item';
        
        return items.map((item, index) => `
            <div class="item ${itemClass}">
                <div class="item-icon ${type}">${icon}</div>
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-meta">${new Date(item.date).toLocaleDateString('fr-FR')}</div>
                </div>
                <div class="item-actions">
                    <span class="item-amount ${type}">${type === 'income' ? '+' : '-'}${item.amount.toFixed(2)}€</span>
                    <button class="btn-delete" onclick="deleteItem('${userId}', '${type}s', ${index})">×</button>
                </div>
            </div>
        `).join('');
    }

    // Gestion des onglets
    function switchTab(tabId) {
        applyActiveTab(tabId);
        saveData();
        scrollTabIntoView(tabId);
    }

    function addNewTab() {
        document.getElementById('newTabName').value = '';
        selectedAvatar = '👤';
        
        // Mettre à jour la prévisualisation
        document.getElementById('avatarPreviewEmoji').textContent = '👤';
        
        // Réinitialiser la sélection visuelle
        document.querySelectorAll('#avatarGrid .avatar-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.textContent.trim() === '👤') {
                btn.classList.add('selected');
            }
        });
        
        openModal('addTabModal');
    }
    
    function selectAvatar(avatar) {
        selectedAvatar = avatar;
        
        // Mettre à jour la prévisualisation
        document.getElementById('avatarPreviewEmoji').textContent = avatar;
        
        // Mettre à jour la sélection visuelle
        document.querySelectorAll('#avatarGrid .avatar-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.textContent.trim() === avatar) {
                btn.classList.add('selected');
            }
        });
    }

// ========== MODIFICATION D'AVATAR UTILISATEUR ==========
    
    let avatarToChange = '👤';
    let userIdToChangeAvatar = null;
    
    function changeUserAvatar(userId) {
        userIdToChangeAvatar = userId;
        avatarToChange = appData.users[userId].avatar || '👤';
        
        // Générer la grille d'avatars
        const grid = document.getElementById('changeAvatarGrid');
        grid.innerHTML = availableAvatars.map(avatar => `
            <button type="button" class="avatar-option ${avatar === avatarToChange ? 'selected' : ''}" 
                    onclick="selectAvatarToChange('${avatar}')">${avatar}</button>
        `).join('');
        
        // Mettre à jour la prévisualisation
        document.getElementById('changeAvatarPreview').innerHTML = `<span style="font-size: 3rem;">${avatarToChange}</span>`;
        
        openModal('changeAvatarModal');
    }
    
    function selectAvatarToChange(avatar) {
        avatarToChange = avatar;
        
        // Mettre à jour la prévisualisation
        document.getElementById('changeAvatarPreview').innerHTML = `<span style="font-size: 3rem;">${avatar}</span>`;
        
        // Mettre à jour les classes de sélection
        document.querySelectorAll('#changeAvatarGrid .avatar-option').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.textContent === avatar) {
                btn.classList.add('selected');
            }
        });
    }
    
    function confirmChangeAvatar() {
        if (userIdToChangeAvatar && appData.users[userIdToChangeAvatar]) {
            appData.users[userIdToChangeAvatar].avatar = avatarToChange;
            saveData();
            closeModal('changeAvatarModal');
            renderApp(userIdToChangeAvatar);
            showNotification('✅ Avatar modifié !', 'success');
        }
    }
	
    function confirmAddTab() {
        const name = document.getElementById('newTabName').value.trim();
        if (name) {
            const userId = 'user_' + Date.now();
            appData.users[userId] = {
                name: name,
                avatar: selectedAvatar, // Sauvegarder l'avatar choisi
                incomes: [],
                expenses: []
            };
            saveData();
            closeModal('addTabModal');
            renderApp(userId);
        }
    }

    // Gestion des revenus
    function addIncome(userId) {
        currentUser = userId;
        document.getElementById('incomeName').value = '';
        document.getElementById('incomeAmount').value = '';
        openModal('addIncomeModal');
    }

    function confirmAddIncome() {
        const name = document.getElementById('incomeName').value.trim();
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        
        if (name && amount > 0) {
            const savedTab = currentTab; // Sauvegarder l'onglet actuel
            appData.users[currentUser].incomes.push({
                name: name,
                amount: amount,
                date: new Date().toISOString()
            });
            saveData();
            closeModal('addIncomeModal');
            renderApp(savedTab); // Passer l'onglet à restaurer
            trackUserAction();
        }
    }

    // Gestion des dépenses
    function addExpense(userId) {
        currentUser = userId;
        document.getElementById('expenseName').value = '';
        document.getElementById('expenseAmount').value = '';
        openModal('addExpenseModal');
    }

    function confirmAddExpense() {
        const name = document.getElementById('expenseName').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        
        if (name && amount > 0) {
            const savedTab = currentTab;
            appData.users[currentUser].expenses.push({
                name: name,
                amount: amount,
                date: new Date().toISOString()
            });
            saveData();
            closeModal('addExpenseModal');
            renderApp(savedTab);
            trackUserAction();
        }
    }

    // Gestion des dépenses communes
    function addCommonExpense() {
        document.getElementById('commonExpenseName').value = '';
        document.getElementById('commonExpenseAmount').value = '';
        
        // Réinitialiser l'icône par défaut
        document.getElementById('commonExpenseIcon').value = '🛒';
        document.getElementById('selectedIconDisplay').textContent = '🛒';
        document.getElementById('iconPickerContainer').style.display = 'none';
        iconPickerVisible = false;
        
        // Générer la liste "Payé par"
        const paidBySelect = document.getElementById('commonExpensePaidBy');
        paidBySelect.innerHTML = '';
        
        // Générer la liste des participants
        const participantsList = document.getElementById('participantsList');
        participantsList.innerHTML = '';
        
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                const userName = appData.users[userId].name;
                
                // Option pour "Payé par"
                const option = document.createElement('option');
                option.value = userId;
                option.textContent = userName;
                paidBySelect.appendChild(option);
                
                // Checkbox pour participants (cochés par défaut)
                const checkbox = document.createElement('div');
                checkbox.className = 'participant-checkbox';
                checkbox.innerHTML = `
                    <input type="checkbox" id="participant_${userId}" value="${userId}" checked>
                    <label for="participant_${userId}">${userName}</label>
                `;
                participantsList.appendChild(checkbox);
            }
        }
        
        openModal('addCommonExpenseModal');
    }

    function confirmAddCommonExpense() {
        const name = document.getElementById('commonExpenseName').value.trim();
        const amount = parseFloat(document.getElementById('commonExpenseAmount').value);
        const paidBy = document.getElementById('commonExpensePaidBy').value;
        
        if (!name || isNaN(amount) || amount <= 0) {
            alert('Veuillez remplir tous les champs correctement');
            return;
        }
        
        if (!paidBy) {
            alert('Veuillez sélectionner qui a payé');
            return;
        }
        
        const participants = [];
        document.querySelectorAll('#participantsList input[type="checkbox"]:checked').forEach(checkbox => {
            participants.push(checkbox.value);
        });
        
        if (participants.length === 0) {
            alert('Veuillez sélectionner au moins un participant');
            return;
        }
        
        const savedTab = currentTab;
        const icon = document.getElementById('commonExpenseIcon').value || '🛒';
        
        appData.commonExpenses.push({
            name: name,
            amount: amount,
            paidBy: paidBy,
            participants: participants,
            icon: icon,
            date: new Date().toISOString()
        });
        
        saveData();
        closeModal('addCommonExpenseModal');
        renderApp(savedTab);
        trackUserAction();
        
        const paidByName = appData.users[paidBy]?.name || 'Inconnu';
        const perPerson = (amount / participants.length).toFixed(2);
        showSuccessMessage(`${paidByName} a payé ${amount.toFixed(2)}€ (${perPerson}€/pers)`);
    }

    // Suppression d'un utilisateur
    function deleteUser(userId) {
        const userName = appData.users[userId].name;
        confirmCallback = () => {
            // Vérifier si l'utilisateur participe à des dépenses communes
            const participatesInCommon = appData.commonExpenses.some(expense => 
                expense.participants.includes(userId)
            );
            
            if (participatesInCommon) {
                alert(`Impossible de supprimer ${userName} car il/elle participe à des dépenses communes. Retirez d'abord sa participation aux dépenses communes.`);
                return;
            }
            
            // Supprimer l'utilisateur
            delete appData.users[userId];
            
            // Si on était sur cet onglet, retourner au tableau de bord
            if (appData.currentTab === userId) {
                appData.currentTab = 'dashboard';
            }
            
            saveData();
            renderApp();
        };
        showConfirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${userName}" et toutes ses données ?`);
    }

    // Suppression d'éléments
    function deleteItem(userId, type, index) {
        confirmCallback = () => {
            appData.users[userId][type].splice(index, 1);
            saveData();
            renderApp();
        };
        showConfirm('Êtes-vous sûr de vouloir supprimer cet élément ?');
    }

// ========== GESTION DES VIREMENTS ==========
    
    // Ouvrir le modal d'ajout de virement
    function addTransfer() {
        document.getElementById('transferDescription').value = '';
        document.getElementById('transferAmount').value = '';
        
        // Générer les listes déroulantes
        const transferFrom = document.getElementById('transferFrom');
        const transferTo = document.getElementById('transferTo');
        transferFrom.innerHTML = '';
        transferTo.innerHTML = '';
        
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                const option1 = document.createElement('option');
                option1.value = userId;
                option1.textContent = appData.users[userId].name;
                transferFrom.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = userId;
                option2.textContent = appData.users[userId].name;
                transferTo.appendChild(option2);
            }
        }
        
        openModal('addTransferModal');
    }
    
    // Confirmer l'ajout d'un virement
    function confirmAddTransfer() {
        const description = document.getElementById('transferDescription').value.trim();
        const amount = parseFloat(document.getElementById('transferAmount').value);
        const fromUser = document.getElementById('transferFrom').value;
        const toUser = document.getElementById('transferTo').value;
        
        if (!description) {
            alert('Veuillez entrer une description');
            return;
        }
        if (!amount || amount <= 0) {
            alert('Veuillez entrer un montant valide');
            return;
        }
        if (fromUser === toUser) {
            alert('La personne source et destination doivent être différentes');
            return;
        }
        
        const savedTab = currentTab;
        
        if (!appData.transfers) {
            appData.transfers = [];
        }
        
        appData.transfers.push({
            description: description,
            amount: amount,
            from: fromUser,
            to: toUser,
            date: new Date().toISOString()
        });
        
        saveData();
        closeModal('addTransferModal');
        renderApp(savedTab);
        trackUserAction();
        showSuccessMessage('Virement ajouté !');
    }
    
    // Supprimer un virement
    function deleteTransfer(index) {
        confirmCallback = () => {
            appData.transfers.splice(index, 1);
            saveData();
            renderApp();
        };
        showConfirm('Êtes-vous sûr de vouloir supprimer ce virement ?');
    }
    
    // Calculer la balance entre tous les utilisateurs
    function calculateBalance() {
        const balances = {}; // { "userId": montant } positif = doit recevoir, négatif = doit payer
        
        // Initialiser les balances à 0 pour chaque utilisateur
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                balances[userId] = 0;
            }
        }
        
        // 1. Prendre en compte les virements
        if (appData.transfers) {
            appData.transfers.forEach(transfer => {
                balances[transfer.from] -= transfer.amount;
                balances[transfer.to] += transfer.amount;
            });
        }
        
        // 2. Prendre en compte les dépenses communes (avec "Payé par")
        appData.commonExpenses.forEach(expense => {
            const paidBy = expense.paidBy;
            const participants = expense.participants || [];
            const amount = expense.amount;
            
            if (participants.length === 0) return;
            
            const sharePerPerson = amount / participants.length;
            
            // Le payeur a avancé tout le montant (il doit recevoir)
            if (paidBy && balances[paidBy] !== undefined) {
                balances[paidBy] += amount;
            }
            
            // Chaque participant doit sa part (il doit payer)
            participants.forEach(participantId => {
                if (balances[participantId] !== undefined) {
                    balances[participantId] -= sharePerPerson;
                }
            });
        });
        
        return balances;
    }
    
    // Calculer "qui doit combien à qui" à partir des balances
    function calculateDebts() {
        const balances = calculateBalance();
        const debts = []; // { from: userId, to: userId, amount: number }
        
        // Séparer les débiteurs et créditeurs
        const debtors = []; // Ceux qui doivent de l'argent (balance négative)
        const creditors = []; // Ceux qui doivent recevoir de l'argent (balance positive)
        
        for (const userId in balances) {
            const balance = balances[userId];
            if (balance < -0.01) { // Seuil pour éviter les erreurs d'arrondi
                debtors.push({ userId, amount: Math.abs(balance) });
            } else if (balance > 0.01) {
                creditors.push({ userId, amount: balance });
            }
        }
        
        // Algorithme simple pour minimiser les transactions
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);
        
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            
            const amount = Math.min(debtor.amount, creditor.amount);
            
            if (amount > 0.01) {
                debts.push({
                    from: debtor.userId,
                    to: creditor.userId,
                    amount: amount
                });
            }
            
            debtor.amount -= amount;
            creditor.amount -= amount;
            
            if (debtor.amount < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }
        
        return debts;
    }
    
    // Afficher la section Balance
    function renderBalance() {
        const container = document.getElementById('balance-content');
        if (!container) return;
        
        const userCount = Object.keys(appData.users).filter(id => id !== 'commun').length;
        
        if (userCount < 2) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">👥</div>
                    <div style="font-weight: 600; color: var(--text-primary);">Ajoutez des participants</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">Il faut au moins 2 personnes pour calculer la balance</div>
                </div>
            `;
            return;
        }
        
        const debts = calculateDebts();
        
        if (debts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                    <div style="font-weight: 600; color: var(--success); font-size: 1.125rem;">Tout est équilibré !</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">Personne ne doit d'argent à personne</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = debts.map(debt => {
            const fromName = appData.users[debt.from]?.name || 'Inconnu';
            const toName = appData.users[debt.to]?.name || 'Inconnu';
            const fromAvatar = appData.users[debt.from]?.avatar || fromName.charAt(0).toUpperCase();
            
            return `
                <div class="debt-card">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div class="debt-avatar">${fromAvatar}</div>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <span style="font-weight: 700; color: var(--danger);">${fromName}</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">doit payer à</span>
                            <span style="font-weight: 700; color: var(--success);">${toName}</span>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <div class="debt-amount">${debt.amount.toFixed(2)}€</div>
                        <button class="btn-paid" onclick="markAsPaid('${debt.from}', '${debt.to}', ${debt.amount.toFixed(2)})">
                            ✅ C'est payé !
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
	// Marquer une dette comme payée
    function markAsPaid(fromUserId, toUserId, amount) {
        const fromName = appData.users[fromUserId]?.name || 'Inconnu';
        const toName = appData.users[toUserId]?.name || 'Inconnu';
        
        const confirmed = confirm(
            `✅ Confirmer le remboursement ?\n\n` +
            `${fromName} a payé ${amount.toFixed(2)}€ à ${toName}\n\n` +
            `Un virement sera créé pour équilibrer les comptes.`
        );
        
        if (!confirmed) return;
        
        // Initialiser le tableau des virements s'il n'existe pas
        if (!appData.transfers) {
            appData.transfers = [];
        }
        
        // Créer un virement de remboursement
        const today = new Date();
        const dateStr = today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        appData.transfers.push({
            description: `Remboursement du ${dateStr}`,
            amount: amount,
            from: toUserId,  // Inversé : celui qui reçoit l'argent le "détient"
            to: fromUserId,   // Celui qui a payé récupère son dû
            date: today.toISOString(),
            isSettlement: true  // Marquer comme remboursement
        });
        
        saveData();
        renderApp();
        showNotification(`✅ ${fromName} a remboursé ${amount.toFixed(2)}€ à ${toName}`, 'success');
    }
    
    // Annuler un remboursement (réactiver la dette)
    function cancelSettlement(index) {
        const transfer = appData.transfers[index];
        if (!transfer) return;
        
        const confirmed = confirm(
            `🔄 Annuler ce remboursement ?\n\n` +
            `"${transfer.description}" - ${transfer.amount.toFixed(2)}€\n\n` +
            `La dette sera réactivée.`
        );
        
        if (!confirmed) return;
        
        appData.transfers.splice(index, 1);
        saveData();
        renderApp();
        showNotification('🔄 Remboursement annulé, dette réactivée', 'info');
    }
	
    // Afficher la liste des virements
    function renderTransfers() {
        const container = document.getElementById('transfers-list');
        if (!container) return;
        
        if (!appData.transfers || appData.transfers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💸</div>
                    <div class="empty-state-text">Aucun virement ajouté</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = appData.transfers.map((transfer, index) => {
            const fromName = appData.users[transfer.from]?.name || 'Inconnu';
            const toName = appData.users[transfer.to]?.name || 'Inconnu';
            const isSettlement = transfer.isSettlement === true;
            
            // Icône et style différent pour les remboursements
            const icon = isSettlement ? '✅' : '💸';
            const itemClass = isSettlement ? 'item settlement-item' : 'item transfer-item';
            const metaText = isSettlement 
                ? `${toName} a remboursé ${fromName}`
                : `${fromName} détient l'argent de ${toName}`;
            
            return `
                <div class="${itemClass}">
                    <div class="item-icon ${isSettlement ? 'settlement' : 'transfer'}">${icon}</div>
                    <div class="item-info">
                        <div class="item-name">${transfer.description}</div>
                        <div class="item-meta">${metaText}</div>
                        ${isSettlement ? `<div class="item-meta" style="font-size: 0.7rem; color: var(--success);">Cliquez sur 🔄 pour annuler</div>` : ''}
                    </div>
                    <div class="item-actions">
                        <span class="item-amount ${isSettlement ? 'settlement' : 'transfer'}">${transfer.amount.toFixed(2)}€</span>
                        ${isSettlement 
                            ? `<button class="btn-undo" onclick="cancelSettlement(${index})" title="Annuler le remboursement">🔄</button>`
                            : `<button class="btn-delete" onclick="deleteTransfer(${index})">×</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }
	
	// ========== SYSTÈME DE PARTAGE ==========
    
    // Générer ou récupérer l'ID du groupe
    function getGroupId() {
        if (!appData.groupId) {
            appData.groupId = generateGroupCode();
            saveData();
        }
        return appData.groupId;
    }
    
    // Générer un code de groupe unique (5 caractères)
    function generateGroupCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    // Ouvrir le modal de partage
    function openShareModal() {
        const code = getGroupId();
        document.getElementById('shareCode').textContent = code;
        document.getElementById('joinCode').value = '';
        openModal('shareModal');
    }
    
    // Copier le code de partage
    function copyShareCode() {
        const code = document.getElementById('shareCode').textContent;
        copyToClipboard(code, 'Code copié ! 📋');
    }
    
    // Compresser une chaîne (algorithme LZ simple)
    function compressData(data) {
        try {
            const jsonString = JSON.stringify(data);
            // Encodage simple avec compression basique
            const compressed = btoa(unescape(encodeURIComponent(jsonString)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            return compressed;
        } catch (e) {
            console.error('Erreur compression:', e);
            return null;
        }
    }
    
    // Décompresser une chaîne
    function decompressData(compressed) {
        try {
            // Restaurer les caractères base64
            let base64 = compressed
                .replace(/-/g, '+')
                .replace(/_/g, '/');
            // Ajouter le padding si nécessaire
            while (base64.length % 4) {
                base64 += '=';
            }
            const jsonString = decodeURIComponent(escape(atob(base64)));
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('Erreur décompression:', e);
            return null;
        }
    }
    
    // Copier le lien de partage
    async function copyShareLink() {
        try {
            // Créer une structure de données minimale
            const minimalData = {
                g: appData.groupId,
                u: {},
                c: [],
                t: []
            };
            
            // Utilisateurs (avec clés courtes)
            for (const userId in appData.users) {
                const user = appData.users[userId];
                const shortId = userId === 'commun' ? 'c' : userId.replace('user_', 'u');
                minimalData.u[shortId] = {
                    n: user.name,
                    i: user.incomes || [],
                    e: user.expenses || []
                };
            }
            
            // Dépenses communes (avec clés courtes)
            appData.commonExpenses.forEach(exp => {
                minimalData.c.push({
                    n: exp.name,
                    a: exp.amount,
                    p: exp.paidBy ? exp.paidBy.replace('user_', 'u') : '',
                    ps: exp.participants.map(p => p.replace('user_', 'u')),
                    ic: exp.icon || '🛒'
                });
            });
            
            // Transferts (avec clés courtes)
            appData.transfers.forEach(t => {
                minimalData.t.push({
                    d: t.description,
                    a: t.amount,
                    f: t.from.replace('user_', 'u'),
                    o: t.to.replace('user_', 'u')
                });
            });
            
            // Compresser en base64
            const jsonStr = JSON.stringify(minimalData);
            const compressed = btoa(unescape(encodeURIComponent(jsonStr)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            
            const longUrl = `${window.location.origin}${window.location.pathname}?i=${compressed}`;
            
            // Essayer de raccourcir avec is.gd
            showNotification('⏳ Création du lien court...', 'info');
            
            try {
                const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
                const data = await response.json();
                
                if (data.shorturl) {
                    await navigator.clipboard.writeText(data.shorturl);
                    showNotification('✅ Lien court copié ! ' + data.shorturl, 'success');
                    return;
                }
            } catch (e) {
                console.log('Raccourcissement échoué, utilisation du lien long');
            }
            
            // Si le raccourcissement échoue, utiliser le lien long
            if (longUrl.length > 2000) {
                showNotification('⚠️ Lien trop long. Essayez de réduire les données.', 'error');
                return;
            }
            
            await navigator.clipboard.writeText(longUrl);
            showNotification(`✅ Lien copié (${longUrl.length} car.)`, 'success');
            
        } catch (error) {
            console.error('Erreur partage:', error);
            showNotification('❌ Erreur lors de la création du lien', 'error');
        }
    }
    
    // Fonction utilitaire pour copier dans le presse-papier
    function copyToClipboard(text, successMessage) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showSuccessMessage(successMessage);
            }).catch(() => {
                fallbackCopy(text, successMessage);
            });
        } else {
            fallbackCopy(text, successMessage);
        }
    }
    
    // Fallback pour copier sur les anciens navigateurs
    function fallbackCopy(text, successMessage) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showSuccessMessage(successMessage);
        } catch (err) {
            alert('Erreur lors de la copie. Copiez manuellement : ' + text);
        }
        document.body.removeChild(textArea);
    }
    
    // Exporter les données dans un fichier
    function exportToFile() {
        const dataToExport = {
            groupId: getGroupId(),
            users: appData.users,
            commonExpenses: appData.commonExpenses,
            transfers: appData.transfers || [],
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
        
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depenses_${getGroupId()}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccessMessage('Fichier téléchargé ! 📥');
    }
    
    // Importer les données depuis un fichier
    function importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    // Vérifier que c'est un fichier valide
                    if (!importedData.users || !importedData.groupId) {
                        alert('❌ Fichier invalide.\n\nCe fichier ne contient pas de données de dépenses valides.');
                        return;
                    }
                    
                    const userCount = Object.keys(importedData.users).filter(id => id !== 'commun').length;
                    const expenseCount = (importedData.commonExpenses || []).length;
                    const transferCount = (importedData.transfers || []).length;
                    
                    if (confirm(`📦 Importer les données du groupe "${importedData.groupId}" ?\n\n` +
                               `• ${userCount} utilisateur(s)\n` +
                               `• ${expenseCount} dépense(s) commune(s)\n` +
                               `• ${transferCount} virement(s)\n\n` +
                               `⚠️ Cela remplacera vos données actuelles.`)) {
                        mergeImportedData(importedData);
                        showSuccessMessage('Données importées ! ✅');
                        closeModal('shareModal');
                    }
                } catch (error) {
                    alert('❌ Erreur lors de l\'import.\n\nLe fichier est corrompu ou invalide.');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    // Rejoindre un groupe avec un code
    function joinGroup() {
        const code = document.getElementById('joinCode').value.trim().toUpperCase();
        
        if (!code || code.length < 5) {
            alert('⚠️ Code invalide\n\nEntrez un code de 5 caractères.');
            return;
        }
        
        // Vérifier si c'est le même groupe
        if (code === getGroupId()) {
            showSuccessMessage('Vous êtes déjà dans ce groupe ! 👍');
            return;
        }
        
        // Informer l'utilisateur comment synchroniser
        alert(`📲 Pour rejoindre le groupe "${code}" :\n\n` +
              `1. Demandez au propriétaire du groupe de vous envoyer :\n` +
              `   • Le lien de partage (bouton "Copier le lien")\n` +
              `   • Ou le fichier de sauvegarde (bouton "Télécharger")\n\n` +
              `2. Ouvrez le lien reçu\n` +
              `   Ou importez le fichier (bouton "Importer")\n\n` +
              `💡 Le propriétaire du groupe a le code "${getGroupId()}"`);
    }
    
    // Fusionner les données importées
    function mergeImportedData(importedData) {
        appData.groupId = importedData.groupId;
        appData.users = importedData.users;
        appData.commonExpenses = importedData.commonExpenses || [];
        appData.transfers = importedData.transfers || [];
        
        saveData();
        renderApp();
    }
    
    // Vérifier s'il y a des données à importer dans l'URL
    function checkUrlImport() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Nouveau format compressé (paramètre 'i')
        const compressedData = urlParams.get('i');
        // Ancien format (paramètre 'import')
        const legacyData = urlParams.get('import');
        
        let importedData = null;
        
        if (compressedData) {
            // Nouveau format compressé
            const minData = decompressData(compressedData);
            if (minData) {
                // Reconstruire les données complètes
                importedData = {
                    groupId: minData.g,
                    users: {},
                    commonExpenses: [],
                    transfers: []
                };
                
                // Reconstruire les utilisateurs
                for (const shortId in minData.u) {
                    const userData = minData.u[shortId];
                    const fullId = shortId === 'c' ? 'commun' : shortId.replace('u', 'user_');
                    importedData.users[fullId] = {
                        name: userData.n,
                        incomes: (userData.i || []).map(i => ({ 
                            name: i.n, 
                            amount: i.a, 
                            date: new Date().toISOString() 
                        })),
                        expenses: (userData.e || []).map(e => ({ 
                            name: e.n, 
                            amount: e.a, 
                            date: new Date().toISOString() 
                        }))
                    };
                }
                
                // Reconstruire les dépenses communes
                importedData.commonExpenses = (minData.c || []).map(exp => ({
                    name: exp.n,
                    amount: exp.a,
                    paidBy: exp.p ? exp.p.replace('u', 'user_') : null,
                    participants: exp.ps.map(p => p === 'c' ? 'commun' : p.replace('u', 'user_')),
                    icon: exp.ic || '🛒',
                    date: new Date().toISOString()
                }));
                
                // Reconstruire les virements
                importedData.transfers = (minData.t || []).map(t => ({
                    description: t.d,
                    amount: t.a,
                    from: t.f.replace('u', 'user_'),
                    to: t.o.replace('u', 'user_'),
                    date: new Date().toISOString()
                }));
            }
        } else if (legacyData) {
            // Ancien format base64 standard
            try {
                const jsonString = decodeURIComponent(escape(atob(legacyData)));
                importedData = JSON.parse(jsonString);
            } catch (e) {
                console.error('Erreur parsing ancien format:', e);
            }
        }
        
        if (importedData) {
            try {
                const userCount = Object.keys(importedData.users).filter(id => id !== 'commun').length;
                const expenseCount = (importedData.commonExpenses || []).length;
                
                if (confirm(`📦 Importer les données du groupe "${importedData.groupId}" ?\n\n` +
                           `• ${userCount} utilisateur(s)\n` +
                           `• ${expenseCount} dépense(s) commune(s)\n\n` +
                           `⚠️ Cela remplacera vos données actuelles.`)) {
                    mergeImportedData(importedData);
                    showSuccessMessage('Données importées depuis le lien ! ✅');
                }
                
                // Nettoyer l'URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (error) {
                console.error('Erreur import URL:', error);
            }
        }
    }
	
	// ========== MODIFICATION DES DÉPENSES ==========
    
    let editIconPickerVisible = false;
    
    // Ouvrir le modal de modification d'une dépense commune
    function editCommonExpense(index) {
        const expense = appData.commonExpenses[index];
        if (!expense) return;
        
        // Stocker l'index
        document.getElementById('editExpenseIndex').value = index;
        
        // Remplir les champs
        document.getElementById('editCommonExpenseName').value = expense.name;
        document.getElementById('editCommonExpenseAmount').value = expense.amount;
        document.getElementById('editCommonExpenseIcon').value = expense.icon || '🛒';
        document.getElementById('editSelectedIconDisplay').textContent = expense.icon || '🛒';
        
        // Masquer le sélecteur d'icônes
        document.getElementById('editIconPickerContainer').style.display = 'none';
        editIconPickerVisible = false;
        
        // Générer la liste "Payé par"
        const paidBySelect = document.getElementById('editCommonExpensePaidBy');
        paidBySelect.innerHTML = '';
        
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                const option = document.createElement('option');
                option.value = userId;
                option.textContent = appData.users[userId].name;
                if (userId === expense.paidBy) {
                    option.selected = true;
                }
                paidBySelect.appendChild(option);
            }
        }
        
        // Générer la liste des participants
        const participantsList = document.getElementById('editParticipantsList');
        participantsList.innerHTML = '';
        
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                const userName = appData.users[userId].name;
                const isParticipant = expense.participants.includes(userId);
                
                const checkbox = document.createElement('div');
                checkbox.className = 'participant-checkbox';
                checkbox.innerHTML = `
                    <input type="checkbox" id="edit_participant_${userId}" value="${userId}" ${isParticipant ? 'checked' : ''}>
                    <label for="edit_participant_${userId}">${userName}</label>
                `;
                participantsList.appendChild(checkbox);
            }
        }
        
        openModal('editCommonExpenseModal');
    }
    
    // Toggle du sélecteur d'icônes pour modification
    function toggleEditIconPicker() {
        const container = document.getElementById('editIconPickerContainer');
        editIconPickerVisible = !editIconPickerVisible;
        
        if (editIconPickerVisible) {
            const grid = document.getElementById('editIconPickerGrid');
            const currentIcon = document.getElementById('editCommonExpenseIcon').value;
            
            grid.innerHTML = availableIcons.map(item => `
                <button type="button" 
                        class="icon-picker-item ${item.icon === currentIcon ? 'selected' : ''}" 
                        onclick="selectEditIcon('${item.icon}')"
                        title="${item.label}">
                    ${item.icon}
                </button>
            `).join('');
            
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }
    
    // Sélectionner une icône pour modification
    function selectEditIcon(icon) {
        document.getElementById('editCommonExpenseIcon').value = icon;
        document.getElementById('editSelectedIconDisplay').textContent = icon;
        
        document.querySelectorAll('#editIconPickerGrid .icon-picker-item').forEach(item => {
            item.classList.remove('selected');
            if (item.textContent.trim() === icon) {
                item.classList.add('selected');
            }
        });
        
        toggleEditIconPicker();
    }
    
    // Confirmer la modification d'une dépense commune
    function confirmEditCommonExpense() {
        const index = parseInt(document.getElementById('editExpenseIndex').value);
        const name = document.getElementById('editCommonExpenseName').value.trim();
        const amount = parseFloat(document.getElementById('editCommonExpenseAmount').value);
        const paidBy = document.getElementById('editCommonExpensePaidBy').value;
        const icon = document.getElementById('editCommonExpenseIcon').value || '🛒';
        
        if (!name || isNaN(amount) || amount <= 0) {
            alert('Veuillez remplir tous les champs correctement');
            return;
        }
        
        if (!paidBy) {
            alert('Veuillez sélectionner qui a payé');
            return;
        }
        
        const participants = [];
        document.querySelectorAll('#editParticipantsList input[type="checkbox"]:checked').forEach(checkbox => {
            participants.push(checkbox.value);
        });
        
        if (participants.length === 0) {
            alert('Veuillez sélectionner au moins un participant');
            return;
        }
        
        const savedTab = currentTab;
        
        appData.commonExpenses[index] = {
            ...appData.commonExpenses[index],
            name: name,
            amount: amount,
            paidBy: paidBy,
            participants: participants,
            icon: icon,
            modifiedDate: new Date().toISOString()
        };
        
        saveData();
        closeModal('editCommonExpenseModal');
        renderApp(savedTab);
        showNotification('✅ Dépense modifiée !', 'success');
    }
	
    function deleteCommonExpense(index) {
        confirmCallback = () => {
            appData.commonExpenses.splice(index, 1);
            saveData();
            renderApp();
        };
        showConfirm('Êtes-vous sûr de vouloir supprimer cette dépense commune ?');
    }

    // Menu FAB
    let fabMenuOpen = false;
    
    function toggleFabMenu() {
        fabMenuOpen = !fabMenuOpen;
        const fabMenu = document.getElementById('fabMenu');
        const fabButton = document.getElementById('fabButton');
        
        if (fabMenuOpen) {
            fabMenu.classList.add('active');
            fabButton.classList.add('active');
        } else {
            fabMenu.classList.remove('active');
            fabButton.classList.remove('active');
        }
    }
    
    function closeFabMenu() {
        fabMenuOpen = false;
        document.getElementById('fabMenu').classList.remove('active');
        document.getElementById('fabButton').classList.remove('active');
    }

    // Ajout rapide de revenu
    function quickAddIncome() {
        closeFabMenu();
        if (appData.currentTab === 'dashboard' || appData.currentTab === 'commun') {
            // Si on est sur le tableau de bord ou commun, utiliser le premier utilisateur
            const firstUser = Object.keys(appData.users).find(id => id !== 'commun');
            if (firstUser) {
                addIncome(firstUser);
            }
        } else {
            addIncome(appData.currentTab);
        }
    }

    // Ajout rapide de dépense
    function quickAddExpense() {
        closeFabMenu();
        if (appData.currentTab === 'commun') {
            addCommonExpense();
        } else if (appData.currentTab === 'dashboard') {
            // Si on est sur le tableau de bord, utiliser le premier utilisateur
            const firstUser = Object.keys(appData.users).find(id => id !== 'commun');
            if (firstUser) {
                addExpense(firstUser);
            }
        } else {
            addExpense(appData.currentTab);
        }
    }

    // Fermer le menu FAB en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (fabMenuOpen && !e.target.closest('.fab') && !e.target.closest('.fab-menu')) {
            closeFabMenu();
        }
    });

    // Calculatrice
    function toggleCalculator() {
        closeFabMenu();
        openModal('calculatorModal');
    }

    function appendToCalc(value) {
        if (calcExpression === '0' && value !== '.') {
            calcExpression = value;
        } else {
            calcExpression += value;
        }
        updateCalcDisplay();
    }

    function clearCalc() {
        calcExpression = '0';
        updateCalcDisplay();
    }

    function deleteLastCalc() {
        if (calcExpression.length > 1) {
            calcExpression = calcExpression.slice(0, -1);
        } else {
            calcExpression = '0';
        }
        updateCalcDisplay();
    }

    function calculateResult() {
        try {
            const result = eval(calcExpression);
            calcExpression = result.toString();
            updateCalcDisplay();
        } catch (e) {
            document.getElementById('calcDisplay').textContent = 'Erreur';
            calcExpression = '0';
        }
    }

    function updateCalcDisplay() {
        const display = document.getElementById('calcDisplay');
        display.textContent = calcExpression;
        
        // Ajuster la taille du texte si nécessaire
        if (calcExpression.length > 15) {
            display.style.fontSize = '1rem';
        } else if (calcExpression.length > 10) {
            display.style.fontSize = '1.25rem';
        } else {
            display.style.fontSize = '1.5rem';
        }
    }

    // Gestion du clavier pour la calculatrice
    function handleCalculatorKeyboard(e) {
        const modal = document.getElementById('calculatorModal');
        if (!modal.classList.contains('active')) return;
        
        e.preventDefault();
        
        // Chiffres
        if (e.key >= '0' && e.key <= '9') {
            appendToCalc(e.key);
        }
        // Opérateurs
        else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
            appendToCalc(e.key);
        }
        // Point décimal
        else if (e.key === '.' || e.key === ',') {
            appendToCalc('.');
        }
        // Égal
        else if (e.key === 'Enter' || e.key === '=') {
            calculateResult();
        }
        // Effacer
        else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
            clearCalc();
        }
        // Supprimer dernier caractère
        else if (e.key === 'Backspace') {
            deleteLastCalc();
        }
    }

    // Ajouter l'écouteur d'événements au chargement
    document.addEventListener('keydown', handleCalculatorKeyboard);

    // Thème
function toggleTheme() {
    // Obtenir le thème actuel du body (source de vérité)
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    console.log('Toggle theme:', currentTheme, '->', newTheme); // Debug
    
    // Appliquer le nouveau thème
    document.body.setAttribute('data-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    appData.theme = newTheme;
    
    // Sauvegarder le choix du thème
    localStorage.setItem('preferredTheme', newTheme);
    saveData();
}

// Fonction pour synchroniser le thème
function syncTheme() {
    const bodyTheme = document.body.getAttribute('data-theme');
    const savedTheme = localStorage.getItem('preferredTheme');
    const appTheme = appData.theme;
    
    // Si tous ne sont pas synchronisés, utiliser la préférence sauvegardée
    if (savedTheme && (bodyTheme !== savedTheme || appTheme !== savedTheme)) {
        document.body.setAttribute('data-theme', savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
        appData.theme = savedTheme;
        console.log('Theme synchronized to:', savedTheme);
    }
}

    // Paramètres
	// Afficher la page À propos
    function showAbout() {
        // Fermer le modal paramètres sans utiliser history.back()
        document.getElementById('settingsModal').classList.remove('active');
        document.body.style.overflow = '';
        
        // Ouvrir le modal À propos après un court délai
        setTimeout(() => {
            openModal('aboutModal');
        }, 100);
    }
	
    function openSettings() {
		updatePinButtonText();
        openModal('settingsModal');
    }

    function exportData() {
        const dataStr = JSON.stringify(appData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `depenses_export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        closeModal('settingsModal');
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
    try {
        const data = JSON.parse(event.target.result);
        appData = data;
        
        // Conserver le thème préféré de l'utilisateur
        const preferredTheme = localStorage.getItem('preferredTheme') || 'dark';
        appData.theme = preferredTheme;
        document.body.setAttribute('data-theme', preferredTheme);
        
        saveData();
        renderApp();
        closeModal('settingsModal');
        alert('Données importées avec succès !');
    } catch (error) {
        alert('Erreur lors de l\'importation des données');
    }
};
                reader.readAsText(file);
            }
        };
        input.click();
    }

// Vider le cache et recharger l'application
    async function clearCacheAndReload() {
        const confirmed = confirm(
            '🔄 Vider le cache de l\'application ?\n\n' +
            '• Cela forcera le téléchargement de la dernière version\n' +
            '• Vos données (dépenses, utilisateurs) seront CONSERVÉES\n' +
            '• L\'application va se recharger\n\n' +
            'Continuer ?'
        );
        
        if (!confirmed) return;
        
        try {
            // 1. Désinscrire tous les Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                    console.log('Service Worker désinscrit');
                }
            }
            
            // 2. Vider tous les caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                    console.log('Cache supprimé:', cacheName);
                }
            }
            
            // 3. Message de succès
            showSuccessMessage('Cache vidé ! Rechargement...');
            
            // 4. Recharger la page après un court délai
            setTimeout(() => {
                window.location.reload(true);
            }, 1000);
            
        } catch (error) {
            console.error('Erreur lors du vidage du cache:', error);
            alert('❌ Erreur lors du vidage du cache.\n\nEssayez de vider manuellement le cache de votre navigateur.');
        }
    }
    
    // Réinitialisation complète (supprime aussi les données)
    async function fullReset() {
        const confirmed = confirm(
            '⚠️ ATTENTION : Réinitialisation complète !\n\n' +
            'Cela va supprimer :\n' +
            '• Toutes vos données (dépenses, utilisateurs)\n' +
            '• Le cache de l\'application\n' +
            '• Tous les paramètres\n\n' +
            'Cette action est IRRÉVERSIBLE !\n\n' +
            'Êtes-vous vraiment sûr ?'
        );
        
        if (!confirmed) return;
        
        // Double confirmation
        const doubleConfirm = confirm('🚨 Dernière chance !\n\nTout sera définitivement effacé.\n\nConfirmer la suppression ?');
        if (!doubleConfirm) return;
        
        try {
            // 1. Réinitialiser appData en mémoire
            appData = {
                users: {
                    'commun': {
                        name: 'Commun',
                        incomes: [],
                        expenses: []
                    }
                },
                commonExpenses: [],
                transfers: [],
                currentTab: 'dashboard',
                theme: 'dark'
            };
            
            // 2. Supprimer TOUTES les clés du localStorage
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                keysToRemove.push(localStorage.key(i));
            }
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('Supprimé localStorage:', key);
            });
            
            // 3. Vider sessionStorage
            sessionStorage.clear();
            console.log('sessionStorage vidé');
            
            // 4. Désinscrire les Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                    console.log('Service Worker désinscrit');
                }
            }
            
            // 5. Vider tous les caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                    console.log('Cache supprimé:', cacheName);
                }
            }
            
            // 6. Vider IndexedDB si utilisé
            if ('indexedDB' in window) {
                const databases = await indexedDB.databases?.() || [];
                for (const db of databases) {
                    if (db.name) {
                        indexedDB.deleteDatabase(db.name);
                        console.log('IndexedDB supprimé:', db.name);
                    }
                }
            }
            
            console.log('✅ Réinitialisation complète effectuée');
            
            // 7. Message et rechargement forcé
            alert('✅ Toutes les données ont été supprimées !\n\nL\'application va se recharger.');
            
            // Forcer le rechargement sans cache
            window.location.href = window.location.pathname + '?reset=' + Date.now();
            
        } catch (error) {
            console.error('Erreur lors de la réinitialisation:', error);
            
            // Plan B : forcer quand même
            localStorage.clear();
            sessionStorage.clear();
            alert('Réinitialisation effectuée. L\'application va se recharger.');
            window.location.reload(true);
        }
    }
	
    function confirmReset() {
        fullReset();
    }

    // Gestion des modals avec historique
    function openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        // Empêcher le scroll du body
        document.body.style.overflow = 'hidden';
        // Ajouter un état à l'historique pour gérer le bouton retour
        history.pushState({ modal: modalId }, '');
    }

    function closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        // Réactiver le scroll du body
        document.body.style.overflow = '';
        // Si on ferme manuellement, on recule dans l'historique
        if (history.state && history.state.modal === modalId) {
            history.back();
        }
    }

    function showConfirm(message) {
        const confirmMessageElement = document.getElementById('confirmMessage');
        if (confirmMessageElement) {
            confirmMessageElement.textContent = message;
            document.getElementById('confirmButton').onclick = () => {
                if (confirmCallback) confirmCallback();
                closeModal('confirmModal');
            };
            openModal('confirmModal');
        } else {
            // Fallback si l'élément n'existe pas
            if (confirm(message) && confirmCallback) {
                confirmCallback();
            }
        }
    }

    // Gestion du bouton retour sur Android
    window.addEventListener('popstate', (e) => {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // ========== STATISTIQUES AVANCÉES ==========
    
    let statsCurrentDate = new Date();
    let statsCurrentPeriod = 'month'; // 'month', 'year', 'all'
    
    // Couleurs pour le graphique
    const chartColors = [
        '#f59e0b', // Orange
        '#ef4444', // Rouge
        '#ec4899', // Rose
        '#8b5cf6', // Violet
        '#3b82f6', // Bleu
        '#10b981', // Vert
        '#14b8a6', // Teal
        '#6366f1', // Indigo
        '#f97316', // Orange foncé
        '#84cc16', // Lime
        '#06b6d4', // Cyan
        '#a855f7', // Purple
    ];
    
	// Liste des icônes disponibles pour le sélecteur
    const availableIcons = [
        { icon: '🛒', label: 'Courses' },
        { icon: '🏠', label: 'Logement' },
        { icon: '💧', label: 'Eau' },
        { icon: '⚡', label: 'Électricité' },
        { icon: '🔥', label: 'Gaz' },
        { icon: '📶', label: 'Internet' },
        { icon: '📱', label: 'Téléphone' },
        { icon: '🛡️', label: 'Assurance' },
        { icon: '🏥', label: 'Santé' },
        { icon: '💊', label: 'Pharmacie' },
        { icon: '👨‍⚕️', label: 'Médecin' },
        { icon: '🚗', label: 'Voiture' },
        { icon: '⛽', label: 'Essence' },
        { icon: '🅿️', label: 'Parking' },
        { icon: '🚌', label: 'Transport' },
        { icon: '🚆', label: 'Train' },
        { icon: '✈️', label: 'Voyage' },
        { icon: '🏨', label: 'Hôtel' },
        { icon: '🍽️', label: 'Restaurant' },
        { icon: '🍕', label: 'Pizza' },
        { icon: '🍔', label: 'Fast-food' },
        { icon: '☕', label: 'Café' },
        { icon: '🎬', label: 'Cinéma' },
        { icon: '🎵', label: 'Musique' },
        { icon: '🎮', label: 'Jeux' },
        { icon: '📺', label: 'TV' },
        { icon: '💳', label: 'Crédit' },
        { icon: '🏦', label: 'Banque' },
        { icon: '📋', label: 'Impôts' },
        { icon: '👕', label: 'Vêtements' },
        { icon: '🛍️', label: 'Shopping' },
        { icon: '🎁', label: 'Cadeau' },
        { icon: '📦', label: 'Colis' },
        { icon: '🐕', label: 'Animaux' },
        { icon: '🐙', label: 'Octopus' },
        { icon: '💰', label: 'Autre' }
    ];
    
    let iconPickerVisible = false;
    
    // Afficher/masquer le sélecteur d'icônes
    function toggleIconPicker() {
        const container = document.getElementById('iconPickerContainer');
        iconPickerVisible = !iconPickerVisible;
        
        if (iconPickerVisible) {
            // Générer la grille d'icônes
            const grid = document.getElementById('iconPickerGrid');
            const currentIcon = document.getElementById('commonExpenseIcon').value;
            
            grid.innerHTML = availableIcons.map(item => `
                <button type="button" 
                        class="icon-picker-item ${item.icon === currentIcon ? 'selected' : ''}" 
                        onclick="selectIcon('${item.icon}')"
                        title="${item.label}">
                    ${item.icon}
                </button>
            `).join('');
            
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }
    
    // Sélectionner une icône
    function selectIcon(icon) {
        document.getElementById('commonExpenseIcon').value = icon;
        document.getElementById('selectedIconDisplay').textContent = icon;
        
        // Mettre à jour la sélection visuelle
        document.querySelectorAll('.icon-picker-item').forEach(item => {
            item.classList.remove('selected');
            if (item.textContent.trim() === icon) {
                item.classList.add('selected');
            }
        });
        
        // Fermer le sélecteur
        toggleIconPicker();
    }
	
    // Icônes par mot-clé dans le nom de la dépense
    const categoryIcons = {
        'loyer': '🏠',
        'charge': '🏠',
        'électricité': '⚡',
        'edf': '⚡',
        'gaz': '🔥',
        'eau': '💧',
        'internet': '📶',
        'freebox': '📶',
        'box': '📶',
        'téléphone': '📱',
        'mobile': '📱',
        'sfr': '📱',
        'orange': '📱',
        'bouygues': '📱',
        'assurance': '🛡️',
        'mutuelle': '🏥',
        'santé': '🏥',
        'médecin': '👨‍⚕️',
        'pharmacie': '💊',
        'courses': '🛒',
        'supermarché': '🛒',
        'leclerc': '🛒',
        'carrefour': '🛒',
        'auchan': '🛒',
        'lidl': '🛒',
        'restaurant': '🍽️',
        'resto': '🍽️',
        'pizza': '🍕',
        'mcdo': '🍔',
        'essence': '⛽',
        'carburant': '⛽',
        'voiture': '🚗',
        'auto': '🚗',
        'parking': '🅿️',
        'transport': '🚌',
        'train': '🚆',
        'sncf': '🚆',
        'avion': '✈️',
        'voyage': '✈️',
        'hôtel': '🏨',
        'netflix': '🎬',
        'spotify': '🎵',
        'amazon': '📦',
        'abonnement': '📋',
        'crédit': '💳',
        'banque': '🏦',
        'impôt': '📋',
        'taxe': '📋',
        'vêtement': '👕',
        'shopping': '🛍️',
        'cadeau': '🎁',
        'octopus': '🐙',
        'default': '💰'
    };
    
    function getIconForExpense(name) {
        const lowerName = name.toLowerCase();
        for (const [keyword, icon] of Object.entries(categoryIcons)) {
            if (lowerName.includes(keyword)) {
                return icon;
            }
        }
        return categoryIcons.default;
    }
    
    function showStats() {
        // Remplir le filtre utilisateur
        const userFilter = document.getElementById('statsUserFilter');
        userFilter.innerHTML = '<option value="all">Pour le groupe</option>';
        
        for (const userId in appData.users) {
            if (userId !== 'commun') {
                const option = document.createElement('option');
                option.value = userId;
                option.textContent = appData.users[userId].name;
                userFilter.appendChild(option);
            }
        }
        
        // Réinitialiser la date à aujourd'hui
        statsCurrentDate = new Date();
        statsCurrentPeriod = 'month';
        
        // Mettre à jour les boutons de période
        document.querySelectorAll('.stats-period-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('periodMonth').classList.add('active');
        
        updateStats();
        openModal('statsModal');
    }
    
    function setStatsPeriod(period) {
        statsCurrentPeriod = period;
        
        // Mettre à jour les boutons
        document.querySelectorAll('.stats-period-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('period' + period.charAt(0).toUpperCase() + period.slice(1)).classList.add('active');
        
        // Afficher/masquer la navigation
        const nav = document.getElementById('statsNavigation');
        if (period === 'all') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }
        
        updateStats();
    }
    
    function navigateStats(direction) {
        if (statsCurrentPeriod === 'month') {
            statsCurrentDate.setMonth(statsCurrentDate.getMonth() + direction);
        } else if (statsCurrentPeriod === 'year') {
            statsCurrentDate.setFullYear(statsCurrentDate.getFullYear() + direction);
        }
        updateStats();
    }
    
    function updateStats() {
        const userFilter = document.getElementById('statsUserFilter').value;
        
        // Mettre à jour le label de période
        const periodLabel = document.getElementById('statsPeriodLabel');
        if (statsCurrentPeriod === 'month') {
            periodLabel.textContent = statsCurrentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        } else if (statsCurrentPeriod === 'year') {
            periodLabel.textContent = statsCurrentDate.getFullYear().toString();
        } else {
            periodLabel.textContent = 'Toutes les dépenses';
        }
        
        // Filtrer les dépenses
        const expenses = getFilteredExpenses(userFilter);
        
        // Grouper par nom (catégorie)
        const categories = {};
        let total = 0;
        
        expenses.forEach(exp => {
            const name = exp.name;
            if (!categories[name]) {
                categories[name] = {
                    name: name,
                    amount: 0,
                    icon: exp.icon || getIconForExpense(name)
                };
            }
            categories[name].amount += exp.amount;
            total += exp.amount;
        });
        
        // Convertir en tableau et trier par montant décroissant
        const sortedCategories = Object.values(categories).sort((a, b) => b.amount - a.amount);
        
        // Mettre à jour le total
        document.getElementById('statsTotal').innerHTML = `<span style="text-decoration: underline;">Total: ${total.toFixed(0)} €</span>`;
        
        // Générer le graphique camembert
        generatePieChart(sortedCategories, total);
        
        // Générer la légende
        generateLegend(sortedCategories, total);
        
        // Générer la liste des catégories
        generateCategoryList(sortedCategories);
    }
    
    function getFilteredExpenses(userFilter) {
    let expenses = [];
    
    // Collecter les dépenses communes (charges fixes = pas de filtre de période)
    appData.commonExpenses.forEach(exp => {
        // Vérifier le filtre utilisateur
        if (userFilter !== 'all' && !exp.participants.includes(userFilter)) {
            return;
        }
            
            // Si filtre utilisateur, ne prendre que sa part
            let amount = exp.amount;
            if (userFilter !== 'all') {
                amount = exp.amount / exp.participants.length;
            }
            
            expenses.push({
                name: exp.name,
                amount: amount,
                date: exp.date,
                icon: exp.icon
            });
        });
        
        // Collecter les dépenses personnelles
        for (const userId in appData.users) {
            if (userId === 'commun') continue;
            
            // Si filtre utilisateur actif, ne prendre que ses dépenses
            if (userFilter !== 'all' && userFilter !== userId) continue;
            
            const user = appData.users[userId];
            user.expenses.forEach(exp => {
                if (!isInPeriod(exp.date)) return;
                
                expenses.push({
                    name: exp.name,
                    amount: exp.amount,
                    date: exp.date
                });
            });
        }
        
        return expenses;
    }
    
    function isInPeriod(dateStr) {
        if (statsCurrentPeriod === 'all') return true;
        if (!dateStr) return false;
        
        const date = new Date(dateStr);
        
        if (statsCurrentPeriod === 'month') {
            return date.getMonth() === statsCurrentDate.getMonth() &&
                   date.getFullYear() === statsCurrentDate.getFullYear();
        } else if (statsCurrentPeriod === 'year') {
            return date.getFullYear() === statsCurrentDate.getFullYear();
        }
        
        return true;
    }
    
    function generatePieChart(categories, total) {
        const svg = document.getElementById('pieChart');
        
        if (categories.length === 0 || total === 0) {
            svg.innerHTML = `
                <circle cx="50" cy="50" r="45" fill="var(--bg-tertiary)" />
                <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" fill="var(--text-secondary)" font-size="8" transform="rotate(90 50 50)">Aucune donnée</text>
            `;
            return;
        }
        
        let html = '';
        let currentAngle = 0;
        
        categories.forEach((cat, index) => {
            const percentage = cat.amount / total;
            const angle = percentage * 360;
            const color = chartColors[index % chartColors.length];
            
            // Créer un arc de cercle
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            
            const x1 = 50 + 45 * Math.cos((startAngle * Math.PI) / 180);
            const y1 = 50 + 45 * Math.sin((startAngle * Math.PI) / 180);
            const x2 = 50 + 45 * Math.cos((endAngle * Math.PI) / 180);
            const y2 = 50 + 45 * Math.sin((endAngle * Math.PI) / 180);
            
            const largeArc = angle > 180 ? 1 : 0;
            
            if (categories.length === 1) {
                // Si une seule catégorie, dessiner un cercle complet
                html += `<circle cx="50" cy="50" r="45" fill="${color}" />`;
            } else {
                html += `<path d="M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" />`;
            }
            
            currentAngle = endAngle;
        });
        
        svg.innerHTML = html;
    }
    
    function generateLegend(categories, total) {
        const legend = document.getElementById('statsLegend');
        
        if (categories.length === 0) {
            legend.innerHTML = '<div style="color: var(--text-secondary);">Aucune dépense</div>';
            return;
        }
        
        // Limiter à 5 catégories dans la légende
        const displayCategories = categories.slice(0, 5);
        
        legend.innerHTML = displayCategories.map((cat, index) => {
            const color = chartColors[index % chartColors.length];
            return `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.name}</span>
                </div>
            `;
        }).join('');
        
        if (categories.length > 5) {
            legend.innerHTML += `<div style="color: var(--text-secondary); font-size: 0.75rem;">+ ${categories.length - 5} autres</div>`;
        }
    }
    
    function generateCategoryList(categories) {
        const list = document.getElementById('statsCategoryList');
        
        if (categories.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">📊</div>
                    <div>Aucune dépense pour cette période</div>
                </div>
            `;
            return;
        }
        
        list.innerHTML = categories.map((cat, index) => {
            const color = chartColors[index % chartColors.length];
            return `
                <div class="stats-category-item">
                    <div class="stats-category-icon" style="background: ${color}20; color: ${color};">
                        ${cat.icon}
                    </div>
                    <div class="stats-category-info">
                        <div class="stats-category-name">${cat.name}</div>
                    </div>
                    <div class="stats-category-amount" style="color: var(--text-primary);">
                        ${cat.amount.toFixed(2).replace('.', ',')} €
                    </div>
                </div>
            `;
        }).join('');
    }

// Mettre à jour le texte du bouton PIN dans les paramètres
    function updatePinButtonText() {
        const btn = document.getElementById('pinButtonText');
        if (btn) {
            // Assurez-vous que appData.security existe avant d'essayer d'y accéder
            btn.textContent = (appData.security && appData.security.pinEnabled) ? 
                'Désactiver le code PIN' : 'Activer le code PIN';
        }
    }
	
// PWA et installation améliorée
function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker enregistré avec succès:', registration);
                
                // Vérifier les mises à jour
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Nouveau service worker disponible
                            if (confirm('Une nouvelle version est disponible ! Voulez-vous mettre à jour ?')) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Erreur Service Worker:', error);
            });
    }
    
    // Détection de l'installation PWA
    let deferredPrompt;
    const installBtn = document.getElementById('installAppBtn');
    
    // Vérifier si l'app n'est pas déjà installée
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone || 
                       document.referrer.includes('android-app://');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('Installation disponible');
        
        // Afficher le bouton d'installation dans les paramètres
        if (installBtn) {
            installBtn.style.display = 'flex';
        }
        
        // Ajouter un bouton d'installation dans le header
        addInstallButtonToHeader();
        
        // Vérifier si l'utilisateur a déjà refusé récemment
        const lastDeclined = localStorage.getItem('installDeclined');
        const hoursSinceDeclined = lastDeclined ? 
            (Date.now() - parseInt(lastDeclined)) / (1000 * 60 * 60) : 999;
        
        // Montrer la bannière immédiatement si :
        // - L'utilisateur n'a jamais refusé
        // - Ou il a refusé il y a plus de 24 heures
        if (!lastDeclined || hoursSinceDeclined > 24) {
            // Attendre 2 secondes pour que la page soit bien chargée
            setTimeout(() => {
                if (deferredPrompt) {
                    showInstallBanner();
                }
            }, 2000);
        }
    });
    
    // Gestionnaire d'installation
    window.installApp = async () => {
        if (!deferredPrompt) {
            // Si pas de prompt, essayer de montrer des instructions personnalisées
            showManualInstallInstructions();
            return;
        }
        
        hideInstallBanner();
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('Installation acceptée');
            removeInstallButton();
            if (installBtn) {
                installBtn.style.display = 'none';
            }
            // Montrer un message de succès
            showSuccessMessage('Application installée avec succès ! 🎉');
            // Marquer comme installée
            localStorage.setItem('pwaInstalled', 'true');
        } else {
            // Enregistrer le refus avec timestamp
            localStorage.setItem('installDeclined', Date.now());
        }
        
        deferredPrompt = null;
    };
    
    // Détecter si l'app est installée
    window.addEventListener('appinstalled', () => {
        console.log('PWA installée avec succès');
        hideInstallBanner();
        removeInstallButton();
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        localStorage.setItem('pwaInstalled', 'true');
    });
    
    // Vérifier si on est en mode standalone
    if (isInstalled) {
        console.log('App lancée en mode standalone');
        localStorage.setItem('pwaInstalled', 'true');
    }
}

// Ajouter un bouton d'installation dans le header
function addInstallButtonToHeader() {
    // Vérifier si le bouton existe déjà
    if (document.getElementById('headerInstallBtn')) return;
    
    const headerButtons = document.querySelector('.header-buttons');
    if (!headerButtons) return;
    
    const installButton = document.createElement('button');
    installButton.id = 'headerInstallBtn';
    installButton.className = 'btn-icon install-pulse';
    installButton.onclick = installApp;
    installButton.title = 'Installer l\'application';
    installButton.innerHTML = '<span class="material-icons">install_mobile</span>';
    
    // Ajouter le bouton au début des boutons du header
    headerButtons.insertBefore(installButton, headerButtons.firstChild);
}

// Retirer le bouton d'installation
function removeInstallButton() {
    const btn = document.getElementById('headerInstallBtn');
    if (btn) btn.remove();
}

// Bannière d'installation améliorée
function showInstallBanner() {
    const existingBanner = document.getElementById('installBanner');
    if (existingBanner) return;
    
    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.innerHTML = `
        <div style="
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(139, 92, 246, 0.4);
            display: flex;
            align-items: center;
            gap: 1.25rem;
            z-index: 1000;
            animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: min(calc(100vw - 2rem), 500px);
            width: 100%;
        ">
            <div style="
                background: rgba(255, 255, 255, 0.2);
                border-radius: 16px;
                padding: 1rem;
                backdrop-filter: blur(10px);
                border: 2px solid rgba(255, 255, 255, 0.3);
            ">
                <span class="material-icons" style="font-size: 2.5rem; display: block;">install_mobile</span>
            </div>
            <div style="flex: 1;">
                <strong style="display: block; margin-bottom: 0.375rem; font-size: 1.25rem;">Installer l'application</strong>
                <span style="font-size: 0.9375rem; opacity: 0.95; line-height: 1.4;">Ajoutez l'app à votre écran d'accueil pour un accès rapide et hors ligne ⚡</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch; min-width: 100px;">
                <button onclick="installApp()" style="
                    background: white;
					color: #8b5cf6;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    white-space: nowrap;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.15)'" 
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'">Installer</button>
                <button onclick="dismissInstallBanner()" style="
                    background: transparent;
                    color: rgba(255,255,255,0.9);
                    border: none;
                    padding: 0.5rem;
                    cursor: pointer;
                    font-size: 0.875rem;
                    transition: opacity 0.2s;
                    text-decoration: underline;
                " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Non merci</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(banner);
}

// Fonction pour masquer la bannière avec possibilité de la réafficher plus tard
function dismissInstallBanner() {
    hideInstallBanner();
    // Enregistrer un refus "léger" (24h avant de re-proposer)
    localStorage.setItem('installDeclined', Date.now());
}

function hideInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) {
        banner.style.animation = 'bounceOut 0.4s ease-in';
        setTimeout(() => banner.remove(), 400);
    }
}

// Instructions manuelles pour les navigateurs non supportés
function showManualInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS) {
        instructions = `
            <h3>📱 Installation sur iOS</h3>
            <ol style="text-align: left; margin: 1rem 0;">
                <li>Appuyez sur le bouton <strong>Partager</strong> <span style="font-size: 1.2rem;">⬆️</span></li>
                <li>Faites défiler et appuyez sur <strong>"Sur l'écran d'accueil"</strong></li>
                <li>Appuyez sur <strong>"Ajouter"</strong></li>
            </ol>
        `;
    } else if (isAndroid) {
        instructions = `
            <h3>📱 Installation sur Android</h3>
            <p>Essayez d'utiliser Chrome ou Edge pour installer cette application.</p>
            <ol style="text-align: left; margin: 1rem 0;">
                <li>Ouvrez le menu du navigateur (3 points)</li>
                <li>Appuyez sur <strong>"Installer l'application"</strong></li>
            </ol>
        `;
    } else {
        instructions = `
            <h3>💻 Installation sur ordinateur</h3>
            <p>Cette application peut être installée depuis Chrome, Edge ou Brave.</p>
            <p>Cherchez l'icône d'installation dans la barre d'adresse.</p>
        `;
    }
    
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
        " onclick="if(event.target === this) this.remove()">
            <div style="
                background: var(--bg-secondary);
                color: var(--text-primary);
                padding: 2rem;
                border-radius: 20px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
                ${instructions}
                <button onclick="this.closest('div').parentElement.remove()" style="
                    margin-top: 1rem;
                    background: var(--primary);
                    color: white;
                    border: none;
                    padding: 0.75rem 2rem;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                ">Compris</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Message de succès
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 1rem 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);
        z-index: 10000;
        animation: slideInDown 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        font-weight: 600;
        font-size: 1.125rem;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutUp 0.4s ease-in';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
