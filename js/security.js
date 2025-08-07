// security.js - Système de sécurité avec code PIN

let currentPin = '';
let isSettingPin = false;
let pinAttempts = 0;
const MAX_ATTEMPTS = 3;

// Initialiser la sécurité au démarrage
function initSecurity() {
    if (appData.security && appData.security.pinEnabled && appData.security.pin) {
        // Bloquer l'accès jusqu'à la saisie du PIN
        showPinScreen();
    }
}

// Afficher l'écran de PIN
function showPinScreen() {
    currentPin = '';
    updatePinDisplay();
    
    const modal = document.getElementById('pinModal');
    modal.classList.add('active');
    modal.style.zIndex = '100000'; // Au-dessus de tout
    
    // Empêcher la fermeture du modal
    modal.onclick = (e) => {
        e.stopPropagation();
    };
    
    // Bloquer toute l'interface
    document.body.style.pointerEvents = 'none';
    modal.style.pointerEvents = 'auto';
}

// Ajouter un chiffre au PIN
function addPinDigit(digit) {
    if (currentPin.length < 4) {
        currentPin += digit;
        updatePinDisplay();
        
        // Vérification automatique à 4 chiffres
        if (currentPin.length === 4) {
            setTimeout(submitPin, 200);
        }
    }
}

// Effacer le PIN
function clearPin() {
    currentPin = '';
    updatePinDisplay();
}

// Mettre à jour l'affichage du PIN
function updatePinDisplay() {
    const display = document.getElementById('pinDisplay');
    let displayText = '';
    
    for (let i = 0; i < 4; i++) {
        if (i < currentPin.length) {
            displayText += '●';
        } else {
            displayText += '○';
        }
    }
    
    display.textContent = displayText;
}

// Soumettre le PIN
function submitPin() {
    if (currentPin.length !== 4) {
        shakePin();
        return;
    }
    
    if (isSettingPin) {
        // Définir un nouveau PIN
        appData.security.pin = hashPin(currentPin);
        appData.security.pinEnabled = true;
        saveData();
        
        showSuccessMessage('Code PIN défini avec succès !');
        closeModal('pinModal');
        isSettingPin = false;
    } else {
        // Vérifier le PIN
        if (verifyPin(currentPin)) {
            // PIN correct
            document.body.style.pointerEvents = '';
            closeModal('pinModal');
            pinAttempts = 0;
            
            // Démarrer le timer d'inactivité
            startInactivityTimer();
        } else {
            // PIN incorrect
            pinAttempts++;
            shakePin();
            currentPin = '';
            updatePinDisplay();
            
            if (pinAttempts >= MAX_ATTEMPTS) {
                // Trop de tentatives - réinitialiser l'app
                alert('Trop de tentatives échouées. L\'application va se réinitialiser.');
                localStorage.clear();
                location.reload();
            } else {
                showErrorMessage(`PIN incorrect. ${MAX_ATTEMPTS - pinAttempts} tentative(s) restante(s)`);
            }
        }
    }
}

// Hacher le PIN (simple pour la démo)
function hashPin(pin) {
    // Dans une vraie app, utilisez un vrai algorithme de hachage
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        const char = pin.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString();
}

// Vérifier le PIN
function verifyPin(pin) {
    return hashPin(pin) === appData.security.pin;
}

// Animation de secousse pour PIN incorrect
function shakePin() {
    const modal = document.querySelector('#pinModal .modal-content');
    modal.style.animation = 'shake 0.5s';
    setTimeout(() => {
        modal.style.animation = '';
    }, 500);
}

// Timer d'inactivité (verrouiller après 5 minutes)
let inactivityTimer;

function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    
    if (!appData.security.pinEnabled) return;
    
    inactivityTimer = setTimeout(() => {
        showPinScreen();
    }, 5 * 60 * 1000); // 5 minutes
}

// Réinitialiser le timer sur activité
document.addEventListener('click', startInactivityTimer);
document.addEventListener('keypress', startInactivityTimer);
document.addEventListener('touchstart', startInactivityTimer);

// Activer/Désactiver le PIN depuis les paramètres
function togglePinSecurity() {
    if (appData.security.pinEnabled) {
        // Désactiver - demander le PIN actuel d'abord
        currentPin = '';
        updatePinDisplay();
        
        const modal = document.getElementById('pinModal');
        modal.classList.add('active');
        
        // Attendre la vérification puis désactiver
        window.pinVerificationCallback = () => {
            appData.security.pinEnabled = false;
            appData.security.pin = null;
            saveData();
            showSuccessMessage('Code PIN désactivé');
        };
    } else {
        // Activer - définir un nouveau PIN
        isSettingPin = true;
        currentPin = '';
        updatePinDisplay();
        
        const header = document.querySelector('#pinModal .modal-header');
        header.innerHTML = '<span class="material-icons" style="margin-right: 0.5rem;">lock</span>Définir un code PIN';
        
        openModal('pinModal');
    }

}

// Ajouter le style pour l'animation shake
const pinStyle = document.createElement('style');
pinStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
    
    .pin-btn {
        background: var(--bg-tertiary);
        border: none;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        font-size: 1.25rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        color: var(--text-primary);
    }
    
    .pin-btn:hover {
        background: var(--primary);
        color: white;
        transform: scale(1.1);
    }
    
    .pin-btn:active {
        transform: scale(0.95);
    }
`;
document.head.appendChild(pinStyle);