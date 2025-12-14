// ========== SYSTÈME DE SÉCURITÉ PIN ==========
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
    modal.style.zIndex = '100000';
    
    document.getElementById('pinTitle').textContent = 'Entrez votre code PIN';
    document.getElementById('pinError').style.display = 'none';
    
    // Bloquer toute l'interface
    document.body.style.pointerEvents = 'none';
    modal.style.pointerEvents = 'auto';
}

// Ajouter un chiffre au PIN
function addPinDigit(digit) {
    if (currentPin.length < 4) {
        currentPin += digit;
        updatePinDisplay();
        
        // Vibration tactile
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
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
    document.getElementById('pinError').style.display = 'none';
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
        appData.security = appData.security || {};
        appData.security.pin = hashPin(currentPin);
        appData.security.pinEnabled = true;
        saveData();
        
        showSuccessMessage('Code PIN défini avec succès !');
        document.body.style.pointerEvents = '';
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
            
            const errorDiv = document.getElementById('pinError');
            errorDiv.style.display = 'block';
            
            if (pinAttempts >= MAX_ATTEMPTS) {
                errorDiv.textContent = 'Trop de tentatives. Réinitialisation...';
                setTimeout(() => {
                    localStorage.clear();
                    location.reload();
                }, 2000);
            } else {
                errorDiv.textContent = `PIN incorrect. ${MAX_ATTEMPTS - pinAttempts} tentative(s) restante(s)`;
            }
        }
    }
}

// Hacher le PIN
function hashPin(pin) {
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

// Animation de secousse
function shakePin() {
    const modal = document.querySelector('#pinModal .modal-content');
    modal.style.animation = 'shake 0.5s';
    setTimeout(() => {
        modal.style.animation = '';
    }, 500);
}

// Timer d'inactivité
let inactivityTimer;

function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    
    if (!appData.security || !appData.security.pinEnabled) return;
    
    inactivityTimer = setTimeout(() => {
        showPinScreen();
    }, 5 * 60 * 1000); // 5 minutes
}

// Réinitialiser le timer sur activité
document.addEventListener('click', startInactivityTimer);
document.addEventListener('keypress', startInactivityTimer);
document.addEventListener('touchstart', startInactivityTimer);

// Activer/Désactiver le PIN
function togglePinSecurity() {
    if (appData.security && appData.security.pinEnabled) {
        // Désactiver - demander le PIN actuel
        document.getElementById('pinTitle').textContent = 'Entrez le PIN actuel pour désactiver';
        currentPin = '';
        updatePinDisplay();
        isSettingPin = false;
        
        // Modifier temporairement submitPin
        const originalSubmit = window.submitPin;
        window.submitPin = function() {
            if (currentPin.length !== 4) {
                shakePin();
                return;
            }
            
            if (verifyPin(currentPin)) {
                appData.security.pinEnabled = false;
                appData.security.pin = null;
                saveData();
                showSuccessMessage('Code PIN désactivé');
                document.body.style.pointerEvents = '';
                closeModal('pinModal');
                window.submitPin = originalSubmit;
            } else {
                shakePin();
                currentPin = '';
                updatePinDisplay();
                document.getElementById('pinError').style.display = 'block';
                document.getElementById('pinError').textContent = 'PIN incorrect';
            }
        };
        
        showPinScreen();
    } else {
        // Activer - définir nouveau PIN
        isSettingPin = true;
        currentPin = '';
        updatePinDisplay();
        document.getElementById('pinTitle').textContent = 'Définir un code PIN (4 chiffres)';
        document.getElementById('pinError').style.display = 'none';
        openModal('pinModal');
    }
}