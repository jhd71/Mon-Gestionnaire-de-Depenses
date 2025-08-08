// ocr-scanner.js - Module de scan OCR pour tickets de caisse
// Utilise Tesseract.js pour la reconnaissance de texte

// Charger Tesseract.js dynamiquement
(function() {
    // Vérifier si Tesseract n'est pas déjà chargé
    if (!window.Tesseract) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => {
            console.log('Tesseract.js chargé avec succès');
        };
        script.onerror = () => {
            console.error('Erreur lors du chargement de Tesseract.js');
        };
        document.head.appendChild(script);
    }
})();

// Variable globale pour stocker les données extraites
window.scannedReceiptData = null;

// Fonction principale de scan OCR
window.scanReceiptOCR = function() {
    // Créer le modal de scan
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'scanModal';
    modal.style.zIndex = '10000';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header" style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10; padding: 1rem; border-bottom: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center;">
                        <span class="material-icons" style="margin-right: 0.5rem;">document_scanner</span>
                        Scanner un ticket de caisse
                    </div>
                    <button onclick="window.closeScanModal()" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            </div>
            <div class="modal-body" style="padding-bottom: 80px;">
                <!-- Zone de sélection de fichier -->
                <div id="scanUploadArea" style="
                    border: 2px dashed var(--primary);
                    border-radius: 12px;
                    padding: 2rem;
                    text-align: center;
                    background: var(--bg-tertiary);
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-bottom: 1rem;
                " onclick="document.getElementById('receiptImageInput').click()">
                    <span class="material-icons" style="font-size: 48px; color: var(--primary); display: block; margin-bottom: 1rem;">add_photo_alternate</span>
                    <p style="margin: 0.5rem 0; font-weight: 600;">Cliquez pour choisir une photo</p>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">ou prenez une photo avec votre appareil</p>
                    <input type="file" id="receiptImageInput" accept="image/*" capture="environment" style="display: none;" onchange="window.processReceiptImage(this)">
                </div>
                
                <!-- Aperçu de l'image -->
                <div id="imagePreview" style="display: none; margin-bottom: 1rem;">
                    <img id="previewImg" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                </div>
                
                <!-- Zone de progression -->
                <div id="scanProgress" style="display: none;">
                    <div style="margin-bottom: 1rem;">
                        <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div class="spinner" style="width: 24px; height: 24px; border: 3px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                <div>
                                    <div id="scanStatus" style="font-weight: 600;">Analyse en cours...</div>
                                    <div id="scanProgressText" style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">Initialisation...</div>
                                </div>
                            </div>
                            <div style="margin-top: 1rem; background: var(--bg-secondary); border-radius: 4px; height: 8px; overflow: hidden;">
                                <div id="progressBar" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Résultats de l'analyse -->
                <div id="scanResults" style="display: none;">
                    <h3 style="margin-bottom: 1rem;">Résultats de l'analyse</h3>
                    
                    <!-- Texte brut extrait (debug) -->
                    <details style="margin-bottom: 1rem;">
                        <summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Texte extrait (debug)</summary>
                        <textarea id="extractedText" readonly style="width: 100%; min-height: 100px; padding: 0.75rem; border-radius: 8px; background: var(--bg-tertiary); border: 1px solid var(--border); font-family: monospace; font-size: 0.875rem; margin-top: 0.5rem;"></textarea>
                    </details>
                    
                    <!-- Données extraites -->
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Magasin détecté :</label>
                            <input type="text" id="detectedStore" class="input" placeholder="Nom du magasin">
                        </div>
                        
                        <div>
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Date :</label>
                            <input type="date" id="detectedDate" class="input">
                        </div>
                        
                        <div>
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
                                Montant total :
                                <button onclick="window.recalculateTotal()" style="
                                    background: var(--primary);
                                    color: white;
                                    border: none;
                                    padding: 2px 8px;
                                    border-radius: 4px;
                                    font-size: 0.75rem;
                                    margin-left: 8px;
                                    cursor: pointer;
                                ">Recalculer depuis articles</button>
                            </label>
                            <input type="number" id="detectedAmount" class="input" step="0.01" placeholder="0.00">
                        </div>
                        
                        <div>
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
                                Articles détectés :
                                <span style="font-size: 0.875rem; color: var(--text-secondary); margin-left: 8px;">
                                    (Cliquez sur un article pour le modifier ou supprimer)
                                </span>
                            </label>
                            <div id="detectedItems" style="max-height: 300px; overflow-y: auto; background: var(--bg-tertiary); border-radius: 8px; padding: 0.75rem;">
                                <div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article détecté</div>
                            </div>
                            <button onclick="window.addManualItem()" style="
                                margin-top: 8px;
                                background: var(--success);
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 0.875rem;
                                display: flex;
                                align-items: center;
                                gap: 4px;
                            ">
                                <span class="material-icons" style="font-size: 16px;">add</span>
                                Ajouter un article manuellement
                            </button>
                        </div>
                        
                        <div>
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Attribuer à :</label>
                            <select id="assignToUser" class="input">
                                <!-- Options ajoutées dynamiquement -->
                            </select>
                        </div>
                        
                        <!-- Si dépense commune, sélection des participants -->
                        <div id="commonParticipants" style="display: none;">
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Participants :</label>
                            <div id="participantsCheckboxes" style="background: var(--bg-tertiary); border-radius: 8px; padding: 0.75rem;">
                                <!-- Les participants seront ajoutés dynamiquement -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-secondary); border-top: 1px solid var(--border); padding: 1rem; display: flex; justify-content: flex-end; gap: 1rem; z-index: 10;">
                <button class="btn btn-danger" onclick="window.closeScanModal()">Annuler</button>
                <button id="addScannedExpense" class="btn" style="display: none;" onclick="window.addScannedExpense()">
                    <span class="material-icons">add</span>
                    Ajouter la dépense
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Remplir le select des utilisateurs
    const assignSelect = document.getElementById('assignToUser');
    let optionsHTML = '<option value="">Choisir...</option>';
    optionsHTML += '<option value="commun">🏠 Dépense commune</option>';
    
    // Ajouter les utilisateurs (sauf commun)
    const users = Object.entries(window.appData.users || {}).filter(([id]) => id !== 'commun');
    users.forEach(([id, user]) => {
        optionsHTML += `<option value="${id}">👤 ${user.name}</option>`;
    });
    
    assignSelect.innerHTML = optionsHTML;
    
    // Ajouter l'animation CSS pour le spinner si elle n'existe pas
    if (!document.getElementById('spinnerStyle')) {
        const style = document.createElement('style');
        style.id = 'spinnerStyle';
        style.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Gérer le changement d'attribution
    assignSelect.addEventListener('change', function() {
        const commonParticipants = document.getElementById('commonParticipants');
        const participantsCheckboxes = document.getElementById('participantsCheckboxes');
        
        if (this.value === 'commun') {
            // Afficher et remplir les participants
            commonParticipants.style.display = 'block';
            
            // Générer les checkboxes des participants
            const users = Object.entries(window.appData.users || {})
                .filter(([id]) => id !== 'commun');
            
            if (users.length > 0) {
                participantsCheckboxes.innerHTML = users.map(([id, user]) => `
                    <div style="margin-bottom: 0.5rem;">
                        <input type="checkbox" id="participant_scan_${id}" value="${id}" checked>
                        <label for="participant_scan_${id}">${user.name}</label>
                    </div>
                `).join('');
            } else {
                participantsCheckboxes.innerHTML = '<div style="color: var(--text-secondary);">Aucun utilisateur disponible. Créez d\'abord des utilisateurs.</div>';
            }
        } else {
            commonParticipants.style.display = 'none';
        }
    });
};

// Traiter l'image sélectionnée
window.processReceiptImage = async function(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // Vérifier que Tesseract est chargé
    if (!window.Tesseract) {
        alert('Le module OCR est encore en cours de chargement. Veuillez réessayer dans quelques secondes.');
        return;
    }
    
    // Afficher l'aperçu
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('scanUploadArea').style.display = 'none';
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('previewImg').src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    // Afficher la progression
    document.getElementById('scanProgress').style.display = 'block';
    document.getElementById('scanResults').style.display = 'none';
    
    try {
        // Utiliser Tesseract directement sans worker pour éviter les problèmes
        console.log('Début de la reconnaissance OCR...');
        
        await Tesseract.recognize(
            file,
            'fra', // Langue française
            {
                logger: m => {
                    console.log('OCR Progress:', m);
                    // Mise à jour de la progression
                    if (m.status) {
                        document.getElementById('scanProgressText').textContent = 
                            m.status === 'initializing api' ? 'Initialisation de l\'OCR...' :
                            m.status === 'initializing tesseract' ? 'Chargement de Tesseract...' :
                            m.status === 'loading language traineddata' ? 'Chargement du modèle français...' :
                            m.status === 'recognizing text' ? 'Analyse du texte en cours...' :
                            m.status === 'initialized tesseract' ? 'Tesseract initialisé...' :
                            m.status;
                    }
                    if (typeof m.progress === 'number') {
                        const percent = Math.round(m.progress * 100);
                        document.getElementById('progressBar').style.width = percent + '%';
                    }
                }
            }
        ).then(({ data: { text } }) => {
            console.log('Texte reconnu:', text);
            // Analyser le texte extrait
            window.analyzeReceiptText(text);
        }).catch(error => {
            console.error('Erreur Tesseract:', error);
            throw error;
        });
        
    } catch (error) {
        console.error('Erreur OCR:', error);
        alert('Erreur lors de l\'analyse de l\'image. Veuillez réessayer avec une image plus claire.');
        document.getElementById('scanProgress').style.display = 'none';
        document.getElementById('scanUploadArea').style.display = 'block';
        document.getElementById('imagePreview').style.display = 'none';
    }
};

// Analyser le texte du ticket
window.analyzeReceiptText = function(text) {
    console.log('Analyse du texte extrait:', text);
    
    // Cacher la progression et afficher les résultats
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('scanResults').style.display = 'block';
    document.getElementById('addScannedExpense').style.display = 'inline-flex';
    
    // Afficher le texte brut pour debug
    document.getElementById('extractedText').value = text;
    
    // Nettoyer et préparer les lignes
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // 1. Détecter le nom du magasin
    let storeName = '';
    const storePatterns = [
        /CARREFOUR|LECLERC|AUCHAN|LIDL|ALDI|INTERMARCHE|SUPER U|MONOPRIX|FRANPRIX|CASINO|CORA|MATCH/i,
        /BOULANGERIE|PHARMACIE|TABAC|RESTAURANT|CAFE|BRASSERIE|PIZZERIA|KEBAB/i,
        /DECATHLON|FNAC|DARTY|IKEA|LEROY MERLIN|CASTORAMA|BRICO/i,
        /TOTAL|SHELL|ESSO|BP|STATION/i,
        /NESTOR|PIZZA|BURGER|SUSHI|RESTO/i
    ];
    
    // Chercher dans les 10 premières lignes
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        
        // Ignorer les lignes avec des mots-clés administratifs
        if (/TEL|SIRET|RCS|TVA|ADRESSE|EMAIL|WEB|FAX/i.test(line)) continue;
        
        // Vérifier les patterns connus
        let found = false;
        for (let pattern of storePatterns) {
            const match = line.match(pattern);
            if (match) {
                storeName = match[0].toUpperCase();
                found = true;
                break;
            }
        }
        if (found) break;
        
        // Si c'est la première ligne non vide et qu'elle ne contient pas de chiffres
        if (i === 0 && line.length > 2 && line.length < 50 && !/\d{2,}/.test(line) && /^[A-Z]/.test(line)) {
            storeName = line.split(/\s{2,}/)[0]; // Prendre la première partie si espaces multiples
            break;
        }
    }
    
    // Si toujours pas trouvé, chercher après "FACTURE" ou utiliser "Magasin"
    if (!storeName) {
        const factureIndex = lines.findIndex(l => /FACTURE/i.test(l));
        if (factureIndex > 0 && factureIndex < lines.length - 1) {
            const nextLine = lines[factureIndex + 1].trim();
            if (nextLine && !/^\d+$/.test(nextLine)) {
                storeName = nextLine;
            }
        }
    }
    
    // Valeur par défaut
    if (!storeName) {
        storeName = 'Magasin';
    }
    
    // 2. Détecter la date
    let detectedDate = '';
    const datePatterns = [
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,  // DD/MM/YYYY ou DD-MM-YY
        /(\d{2,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,  // YYYY/MM/DD
        /(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{2,4})/i,
        /(\d{1,2})\s+(jan|fév|fev|mar|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)\s+(\d{2,4})/i
    ];
    
    const monthMap = {
        'janvier': '01', 'jan': '01',
        'février': '02', 'fevrier': '02', 'fév': '02', 'fev': '02',
        'mars': '03', 'mar': '03',
        'avril': '04', 'avr': '04',
        'mai': '05',
        'juin': '06',
        'juillet': '07', 'juil': '07',
        'août': '08', 'aout': '08',
        'septembre': '09', 'sept': '09',
        'octobre': '10', 'oct': '10',
        'novembre': '11', 'nov': '11',
        'décembre': '12', 'decembre': '12', 'déc': '12', 'dec': '12'
    };
    
    for (let line of lines) {
        for (let i = 0; i < datePatterns.length; i++) {
            const match = line.match(datePatterns[i]);
            if (match) {
                if (i < 2) {
                    // Formats numériques
                    let day, month, year;
                    if (match[3] && match[3].length === 4) {
                        // Format DD/MM/YYYY
                        day = match[1].padStart(2, '0');
                        month = match[2].padStart(2, '0');
                        year = match[3];
                    } else if (match[1] && match[1].length === 4) {
                        // Format YYYY/MM/DD
                        year = match[1];
                        month = match[2].padStart(2, '0');
                        day = match[3].padStart(2, '0');
                    } else {
                        // Format DD/MM/YY
                        day = match[1].padStart(2, '0');
                        month = match[2].padStart(2, '0');
                        year = parseInt(match[3]) > 50 ? '19' + match[3] : '20' + match[3];
                    }
                    
                    // Vérifier la validité de la date
                    const monthNum = parseInt(month);
                    const dayNum = parseInt(day);
                    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
                        detectedDate = `${year}-${month}-${day}`;
                    }
                } else {
                    // Formats avec mois en lettres
                    const day = match[1].padStart(2, '0');
                    const monthText = match[2].toLowerCase();
                    const month = monthMap[monthText];
                    const year = match[3].length === 2 ? '20' + match[3] : match[3];
                    
                    if (month) {
                        detectedDate = `${year}-${month}-${day}`;
                    }
                }
                
                if (detectedDate) break;
            }
        }
        if (detectedDate) break;
    }
    
    // Si pas de date trouvée, utiliser aujourd'hui
    if (!detectedDate) {
        detectedDate = new Date().toISOString().split('T')[0];
    }
    
    // 3. Détecter le montant total
    let totalAmount = 0;
    
    // Fonction pour parser les montants français (virgule = décimale, espace/point = milliers)
    function parseAmount(str) {
        if (!str) return 0;
        // Nettoyer la chaîne
        str = str.toString().trim();
        // Remplacer les espaces (séparateurs de milliers)
        str = str.replace(/\s/g, '');
        // Si on a un point ET une virgule, le point est pour les milliers
        if (str.includes('.') && str.includes(',')) {
            str = str.replace('.', '');
            str = str.replace(',', '.');
        } else if (str.includes(',')) {
            // Virgule seule = décimale en France
            str = str.replace(',', '.');
        }
        return parseFloat(str);
    }
    
    const amountPatterns = [
        /TOTAL[\s:]*FACTURE[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /TOTAL[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /MONTANT[\s:]*TOTAL[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /A\s+REGLER[\s:]*TTC[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /A\s+REGLER[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /A\s+PAYER[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /NET\s+A\s+PAYER[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /REGLEMENT[\s:]*.*?([0-9]+[,.]?[0-9]*)/i,
        /ESPECES[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /CB[\s:]*€?\s*([0-9]+[,.]?[0-9]*)/i,
        /€\s*([0-9]+[,.]?[0-9]*)/,
        /([0-9]+[,.]?[0-9]*)\s*€/
    ];
    
    // Collecter tous les montants trouvés
    let amounts = [];
    let reglementAmount = 0;
    
    for (let line of lines) {
        // Chercher spécifiquement la ligne de règlement avec le montant réel payé
        if (/REGLEMENT|CHEQUE|ESPECES|CB|CARTE/i.test(line)) {
            // Pattern pour "Règlement Chèque 31,8"
            const reglementMatch = line.match(/([0-9]+),([0-9]{1,2})(?:\s|$)/);
            if (reglementMatch) {
                const euros = reglementMatch[1];
                let cents = reglementMatch[2];
                // Si un seul chiffre après la virgule, c'est des dizaines de centimes
                if (cents.length === 1) {
                    cents = cents + '0';
                }
                reglementAmount = parseFloat(euros + '.' + cents);
                console.log('Montant règlement trouvé:', reglementAmount, 'depuis:', line);
                amounts.push(reglementAmount);
            }
        }
        
        // Chercher les totaux
        if (/TOTAL|MONTANT|PAYER|REGLER(?!MENT)/i.test(line)) {
            // Pattern pour les montants standards (58.10 ou 58,10)
            const standardMatch = line.match(/([0-9]+)[,.]([0-9]{2})\s*€?/);
            if (standardMatch) {
                const amount = parseFloat(standardMatch[1] + '.' + standardMatch[2]);
                if (!isNaN(amount) && amount > 0 && amount < 1000) {
                    amounts.push(amount);
                    console.log('Montant trouvé dans ligne de total:', amount, 'depuis:', line);
                }
            } else {
                // Essayer les autres patterns
                for (let pattern of amountPatterns) {
                    const match = line.match(pattern);
                    if (match) {
                        const amount = parseAmount(match[1]);
                        if (!isNaN(amount) && amount > 0 && amount < 1000) {
                            amounts.push(amount);
                            console.log('Montant trouvé dans ligne de total:', amount, 'depuis:', line);
                        }
                    }
                }
            }
        }
    }
    
    // Si on a trouvé un montant de règlement, l'utiliser en priorité
    if (reglementAmount > 0 && reglementAmount < 1000) {
        totalAmount = reglementAmount;
        console.log('Utilisation du montant de règlement comme total:', totalAmount);
    } else if (amounts.length > 0) {
        // Prendre le montant le plus fréquent ou le plus petit raisonnable
        const reasonableAmounts = amounts.filter(a => a > 5 && a < 500);
        if (reasonableAmounts.length > 0) {
            // Compter les occurrences
            const counts = {};
            reasonableAmounts.forEach(a => {
                const key = a.toFixed(2);
                counts[key] = (counts[key] || 0) + 1;
            });
            // Prendre le plus fréquent
            const mostFrequent = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            totalAmount = parseFloat(mostFrequent);
        } else if (amounts.length > 0) {
            totalAmount = Math.min(...amounts);
        }
        console.log('Montant total détecté:', totalAmount);
    }
    
    // Si pas de montant trouvé dans les lignes de total, chercher tous les montants
    if (amounts.length === 0) {
        for (let line of lines) {
            const matches = line.matchAll(/([0-9]+[,.]?[0-9]*)\s*€?/g);
            for (let match of matches) {
                const amount = parseAmount(match[1]);
                if (!isNaN(amount) && amount > 0 && amount < 1000) {
                    amounts.push(amount);
                }
            }
        }
    }
    
    // Prendre le montant le plus élevé comme total (mais raisonnable)
    if (amounts.length > 0) {
        // Filtrer les montants aberrants (> 1000€ pour un ticket standard)
        const reasonableAmounts = amounts.filter(a => a < 1000);
        if (reasonableAmounts.length > 0) {
            totalAmount = Math.max(...reasonableAmounts);
        } else {
            totalAmount = Math.min(...amounts); // Si tous > 1000, prendre le plus petit
        }
        console.log('Montant total détecté:', totalAmount);
    }
    
    // 4. Extraire les articles
    const items = [];
    
    // Patterns pour détecter les articles avec prix
    const itemPatterns = [
        // Format: Article prix,décimal €
        /^(.+?)\s+(\d+)[,.](\d{2})\s*[€\s]*\d*$/,
        // Format: Article prix €
        /^(.+?)\s+(\d+)\s*€/,
        // Format avec quantité au début: 1 Article prix
        /^\d+\s+(.+?)\s+(\d+[,.]?\d*)/,
        // Format simple: texte nombre
        /^([^\d]+)\s+(\d+[,.]?\d+)$/
    ];
    
    for (let line of lines) {
        // Ignorer les lignes d'en-tête, de pied et les codes
        if (/TOTAL|MONTANT|ESPECES|CB|RENDU|TVA|SOUS[\s\-]?TOTAL|DATE|HEURE|CAISSE|TICKET|MERCI|SIRET|TEL|FACTURE|CLIENT|ADRESSE|COMMANDE|CREE PAR|LIVRER|ARTICLES|GRATUIT|RECEPTION|LIVRAISON|REGLEMENT|DONT|CODE|RCS|N°\s*TVA|POINTS|CUMUL/i.test(line)) {
            continue;
        }
        
        // Ignorer les lignes trop courtes ou qui sont juste des chiffres
        if (line.length < 3 || /^\d+$/.test(line.trim())) continue;
        
        // Ignorer les lignes qui ressemblent à des numéros (RCS, tel, etc)
        if (/^\d{3}\s*\d{3}\s*\d{3}/.test(line)) continue;
        if (/^[0-9\s\-\.]+$/.test(line)) continue;
        
        // Essayer de détecter un article avec prix
        for (let pattern of itemPatterns) {
            const match = line.match(pattern);
            if (match) {
                let name, price;
                
                if (match.length === 4) {
                    // Format avec virgule/point et décimales séparées
                    name = match[1].trim();
                    price = parseFloat(match[2] + '.' + match[3]);
                } else if (match.length === 3) {
                    name = match[1].trim();
                    const priceStr = match[2].replace(',', '.');
                    price = parseFloat(priceStr);
                } else {
                    continue;
                }
                
                // Nettoyer le nom (enlever les caractères spéciaux au début)
                name = name.replace(/^[\|\+\-\*\/\s]+/, '').trim();
                
                // Ignorer si le nom est trop court ou ressemble à un code
                if (name.length < 2) continue;
                if (/^[A-Z0-9\-]+$/.test(name) && !name.includes(' ')) continue;
                
                // Ignorer les prix aberrants ou nuls
                if (isNaN(price) || price <= 0 || price > 200) continue;
                
                // Nettoyer les codes produits au début
                name = name.replace(/^[A-Z]?\d+[-\s]*[A-Z]?\d*[-\s]*/, '');
                
                items.push({ name, price });
                console.log('Article détecté:', name, price);
                break;
            }
        }
    }
    
    // Remplir les champs
    document.getElementById('detectedStore').value = storeName;
    document.getElementById('detectedDate').value = detectedDate;
    document.getElementById('detectedAmount').value = totalAmount > 0 ? totalAmount.toFixed(2) : '';
    
    // Afficher les articles détectés
    const itemsContainer = document.getElementById('detectedItems');
    if (items.length > 0) {
        // Stocker les articles dans window pour pouvoir les éditer
        window.scannedItems = items;
        
        itemsContainer.innerHTML = items.map((item, index) => `
            <div id="item-${index}" style="display: flex; justify-content: space-between; padding: 0.5rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;" 
                 onmouseover="this.style.background='var(--bg-secondary)'" 
                 onmouseout="this.style.background='transparent'"
                 onclick="window.editScannedItem(${index})">
                <span>${item.name}</span>
                <span style="font-weight: 600;">${item.price.toFixed(2)}€</span>
            </div>
        `).join('');
        
        // Calculer et afficher le sous-total des articles
        const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
        itemsContainer.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0; margin-top: 0.5rem; border-top: 2px solid var(--primary); font-weight: 600;">
                <span>Sous-total articles:</span>
                <span id="itemsSubtotal">${itemsTotal.toFixed(2)}€</span>
            </div>
        `;
    } else {
        window.scannedItems = [];
        itemsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article détecté - Vous pouvez en ajouter manuellement</div>';
    }
    
    // Stocker les données extraites
    window.scannedReceiptData = {
        store: storeName,
        date: detectedDate,
        total: totalAmount,
        items: items,
        rawText: text
    };
};

// Fonction pour éditer un article scanné
window.editScannedItem = function(index) {
    const item = window.scannedItems[index];
    if (!item) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'editItemModal';
    modal.style.zIndex = '10001';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <span class="material-icons" style="margin-right: 0.5rem;">edit</span>
                Modifier l'article
            </div>
            <div class="modal-body">
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Nom de l'article :</label>
                        <input type="text" id="editItemName" class="input" value="${item.name}">
                    </div>
                    <div>
                        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Prix :</label>
                        <input type="number" id="editItemPrice" class="input" step="0.01" value="${item.price.toFixed(2)}">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="window.deleteScannedItem(${index})">
                    <span class="material-icons">delete</span>
                    Supprimer
                </button>
                <button class="btn" onclick="window.closeEditItemModal()">Annuler</button>
                <button class="btn" style="background: var(--success);" onclick="window.saveEditedItem(${index})">
                    <span class="material-icons">save</span>
                    Enregistrer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

// Sauvegarder l'article édité
window.saveEditedItem = function(index) {
    const name = document.getElementById('editItemName').value.trim();
    const price = parseFloat(document.getElementById('editItemPrice').value);
    
    if (name && !isNaN(price) && price >= 0) {
        window.scannedItems[index] = { name, price };
        window.updateItemsDisplay();
        window.closeEditItemModal();
    } else {
        alert('Veuillez entrer un nom et un prix valide');
    }
};

// Supprimer un article
window.deleteScannedItem = function(index) {
    window.scannedItems.splice(index, 1);
    window.updateItemsDisplay();
    window.closeEditItemModal();
};

// Fermer le modal d'édition
window.closeEditItemModal = function() {
    const modal = document.getElementById('editItemModal');
    if (modal) {
        modal.remove();
    }
};

// Ajouter un article manuellement
window.addManualItem = function() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'addItemModal';
    modal.style.zIndex = '10001';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <span class="material-icons" style="margin-right: 0.5rem;">add_shopping_cart</span>
                Ajouter un article
            </div>
            <div class="modal-body">
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Nom de l'article :</label>
                        <input type="text" id="newItemName" class="input" placeholder="Ex: Pain, Café...">
                    </div>
                    <div>
                        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Prix :</label>
                        <input type="number" id="newItemPrice" class="input" step="0.01" placeholder="0.00">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="window.closeAddItemModal()">Annuler</button>
                <button class="btn" style="background: var(--success);" onclick="window.confirmAddItem()">
                    <span class="material-icons">add</span>
                    Ajouter
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('newItemName').focus();
};

// Confirmer l'ajout d'un article
window.confirmAddItem = function() {
    const name = document.getElementById('newItemName').value.trim();
    const price = parseFloat(document.getElementById('newItemPrice').value);
    
    if (name && !isNaN(price) && price > 0) {
        if (!window.scannedItems) {
            window.scannedItems = [];
        }
        window.scannedItems.push({ name, price });
        window.updateItemsDisplay();
        window.closeAddItemModal();
    } else {
        alert('Veuillez entrer un nom et un prix valide');
    }
};

// Fermer le modal d'ajout
window.closeAddItemModal = function() {
    const modal = document.getElementById('addItemModal');
    if (modal) {
        modal.remove();
    }
};

// Mettre à jour l'affichage des articles
window.updateItemsDisplay = function() {
    const itemsContainer = document.getElementById('detectedItems');
    const items = window.scannedItems || [];
    
    if (items.length > 0) {
        itemsContainer.innerHTML = items.map((item, index) => `
            <div id="item-${index}" style="display: flex; justify-content: space-between; padding: 0.5rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;" 
                 onmouseover="this.style.background='var(--bg-secondary)'" 
                 onmouseout="this.style.background='transparent'"
                 onclick="window.editScannedItem(${index})">
                <span>${item.name}</span>
                <span style="font-weight: 600;">${item.price.toFixed(2)}€</span>
            </div>
        `).join('');
        
        // Calculer et afficher le sous-total
        const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
        itemsContainer.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0; margin-top: 0.5rem; border-top: 2px solid var(--primary); font-weight: 600;">
                <span>Sous-total articles:</span>
                <span id="itemsSubtotal">${itemsTotal.toFixed(2)}€</span>
            </div>
        `;
    } else {
        itemsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article - Vous pouvez en ajouter manuellement</div>';
    }
    
    // Mettre à jour les données scannées
    if (window.scannedReceiptData) {
        window.scannedReceiptData.items = items;
    }
};

// Recalculer le total depuis les articles
window.recalculateTotal = function() {
    const items = window.scannedItems || [];
    if (items.length > 0) {
        const total = items.reduce((sum, item) => sum + item.price, 0);
        document.getElementById('detectedAmount').value = total.toFixed(2);
    } else {
        alert('Aucun article pour calculer le total');
    }
};

// Ajouter la dépense scannée
window.addScannedExpense = function() {
    const store = document.getElementById('detectedStore').value.trim();
    const date = document.getElementById('detectedDate').value;
    const amount = parseFloat(document.getElementById('detectedAmount').value);
    const assignTo = document.getElementById('assignToUser').value;
    
    console.log('Ajout dépense - Store:', store, 'Amount:', amount, 'AssignTo:', assignTo);
    
    if (!store) {
        alert('Veuillez entrer le nom du magasin');
        return;
    }
    
    if (!amount || amount <= 0) {
        alert('Veuillez entrer un montant valide');
        return;
    }
    
    if (!assignTo) {
        alert('Veuillez choisir à qui attribuer cette dépense');
        return;
    }
    
    // Créer la description de la dépense
    const description = `${store} - Ticket scanné`;
    
    // Récupérer appData depuis le scope global ou parent
    let data = window.appData;
    if (!data && window.parent && window.parent.appData) {
        data = window.parent.appData;
    }
    if (!data && typeof appData !== 'undefined') {
        data = appData;
        window.appData = appData; // Exposer globalement
    }
    
    if (!data) {
        alert('Erreur: Les données de l\'application ne sont pas accessibles. Rechargez la page.');
        console.error('appData non trouvé');
        return;
    }
    
    console.log('appData trouvé:', data);
    
    if (assignTo === 'commun') {
        // Dépense commune
        const participants = [];
        document.querySelectorAll('#commonParticipants input[type="checkbox"]:checked').forEach(checkbox => {
            participants.push(checkbox.value);
        });
        
        if (participants.length === 0) {
            alert('Veuillez sélectionner au moins un participant');
            return;
        }
        
        if (!data.commonExpenses) {
            data.commonExpenses = [];
        }
        
        data.commonExpenses.push({
            name: description,
            amount: amount,
            participants: participants,
            date: date || new Date().toISOString(),
            scanned: true
        });
        
        console.log('Dépense commune ajoutée:', data.commonExpenses);
    } else {
        // Dépense individuelle
        if (!data.users || !data.users[assignTo]) {
            alert('Erreur: Utilisateur non trouvé');
            console.error('Utilisateur non trouvé:', assignTo, 'dans', data.users);
            return;
        }
        
        if (!data.users[assignTo].expenses) {
            data.users[assignTo].expenses = [];
        }
        
        const newExpense = {
            name: description,
            amount: amount,
            date: date || new Date().toISOString(),
            scanned: true,
            items: window.scannedItems || [] // Utiliser les articles édités
        };
        
        data.users[assignTo].expenses.push(newExpense);
        console.log('Dépense ajoutée à', data.users[assignTo].name, ':', newExpense);
        console.log('Total des dépenses de', data.users[assignTo].name, ':', data.users[assignTo].expenses);
    }
    
    // Sauvegarder
    window.appData = data; // S'assurer que c'est global
    
    // Essayer plusieurs méthodes de sauvegarde
    let saved = false;
    
    // Méthode 1: saveData global
    if (typeof window.saveData === 'function') {
        window.saveData();
        saved = true;
        console.log('Sauvegarde via window.saveData()');
    } 
    // Méthode 2: saveData dans le parent
    else if (window.parent && typeof window.parent.saveData === 'function') {
        window.parent.saveData();
        saved = true;
        console.log('Sauvegarde via window.parent.saveData()');
    }
    // Méthode 3: Direct localStorage
    else {
        try {
            localStorage.setItem('expenseTrackerData', JSON.stringify(data));
            saved = true;
            console.log('Sauvegarde directe dans localStorage');
        } catch (e) {
            console.error('Erreur de sauvegarde:', e);
        }
    }
    
    if (!saved) {
        alert('Erreur lors de la sauvegarde. Vérifiez la console.');
        return;
    }
    
    // Rafraîchir l'affichage
    if (typeof window.renderApp === 'function') {
        window.renderApp();
    } else if (window.parent && typeof window.parent.renderApp === 'function') {
        window.parent.renderApp();
    }
    
    // Fermer le modal
    window.closeScanModal();
    
    // Message de succès
    const message = `Ticket de ${amount.toFixed(2)}€ ajouté ${assignTo === 'commun' ? 'aux dépenses communes' : 'à ' + data.users[assignTo].name} !`;
    
    if (typeof window.showSuccessMessage === 'function') {
        window.showSuccessMessage(message);
    } else {
        // Créer un message de succès simple
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// Fermer le modal de scan
window.closeScanModal = function() {
    const modal = document.getElementById('scanModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    window.scannedReceiptData = null;
};

// Exposer la fonction principale
window.scanReceipt = window.scanReceiptOCR;

console.log('Module OCR Scanner chargé avec succès');