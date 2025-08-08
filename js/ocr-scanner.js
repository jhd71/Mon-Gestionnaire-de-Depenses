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
        // Ignorer les lignes qui contiennent des mots-clés non pertinents pour les dates
        if (/RECEPTION|LIVRAISON|FACTURE|COMMANDE/i.test(line) && !/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(line)) {
            continue;
        }
        
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
    
    // 3. Détecter le montant total - AMÉLIORATION
    let totalAmount = 0;
    
    // Fonction améliorée pour parser les montants français
    function parseAmount(str) {
        if (!str) return 0;
        // Nettoyer la chaîne
        str = str.toString().trim();
        // Remplacer les espaces (séparateurs de milliers)
        str = str.replace(/\s/g, '');
        
        // Détecter le format français (virgule pour décimale)
        // Si on a des chiffres puis virgule puis exactement 1 ou 2 chiffres, c'est une décimale
        const frenchDecimalMatch = str.match(/^(\d+),(\d{1,2})$/);
        if (frenchDecimalMatch) {
            const euros = frenchDecimalMatch[1];
            let cents = frenchDecimalMatch[2];
            // Si un seul chiffre après la virgule, c'est des dizaines de centimes
            if (cents.length === 1) {
                cents = cents + '0';
            }
            return parseFloat(euros + '.' + cents);
        }
        
        // Si on a point ET virgule, le point est pour les milliers
        if (str.includes('.') && str.includes(',')) {
            str = str.replace(/\./g, '');
            str = str.replace(',', '.');
        } else if (str.includes(',')) {
            // Virgule seule = décimale en France
            str = str.replace(',', '.');
        }
        
        return parseFloat(str);
    }
    
    // Patterns améliorés pour les montants
    const totalPatterns = [
        /MONTANT\s+TOTAL\s*:?\s*([0-9]+[,.]?\d{0,2})\s*€?/i,
        /TOTAL\s+FACTURE\s*:?\s*([0-9]+[,.]?\d{0,2})\s*€?/i,
        /TOTAL\s*:?\s*([0-9]+[,.]?\d{0,2})\s*€?/i,
        /A\s+REGLER\s+[A-Z]*\s*:?\s*([0-9]+[,.]?\d{0,2})\s*€?/i,
        /NET\s+A\s+PAYER\s*:?\s*([0-9]+[,.]?\d{0,2})\s*€?/i
    ];
    
    // Chercher spécifiquement les lignes de total
    for (let line of lines) {
        if (/TOTAL|REGLER|PAYER/i.test(line) && !/SOUS[\s\-]?TOTAL/i.test(line)) {
            for (let pattern of totalPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const amount = parseAmount(match[1]);
                    if (!isNaN(amount) && amount > 0 && amount < 10000) {
                        totalAmount = amount;
                        console.log('Montant total trouvé:', amount, 'depuis:', line);
                        break;
                    }
                }
            }
            if (totalAmount > 0) break;
        }
    }
    
    // Si pas trouvé, chercher dans les lignes de règlement
    if (totalAmount === 0) {
        for (let line of lines) {
            if (/REGLEMENT|CHEQUE|ESPECES|CB|CARTE/i.test(line)) {
                const amountMatch = line.match(/([0-9]+),?(\d{0,2})\s*€?/);
                if (amountMatch) {
                    const amount = parseAmount(amountMatch[0]);
                    if (!isNaN(amount) && amount > 0 && amount < 10000) {
                        totalAmount = amount;
                        console.log('Montant règlement trouvé:', amount, 'depuis:', line);
                        break;
                    }
                }
            }
        }
    }
    
    // 4. Extraire les articles - AMÉLIORATION
    const items = [];
    
    // Mots-clés à exclure absolument (ne peuvent pas être des articles)
    const excludeKeywords = [
        /^(TOTAL|MONTANT|ESPECES|CB|RENDU|TVA|SOUS[\s\-]?TOTAL|DATE|HEURE|CAISSE|TICKET|MERCI)/i,
        /^(SIRET|TEL|FAX|FACTURE|CLIENT|ADRESSE|COMMANDE|CREE\s+PAR|LIVRER|ARTICLES)/i,
        /^(GRATUIT|RECEPTION|LIVRAISON|REGLEMENT|DONT|CODE|RCS|N°\s*TVA|POINTS|CUMUL)/i,
        /^(AVOIR|REMISE|REDUCTION|CARTE|CHEQUE|VIREMENT|PAIEMENT)/i,
        /^(EMAIL|WEB|SITE|WWW|HTTP)/i,
        /^\d{1,2}[\/\-\.]\d{1,2}/,  // Dates
        /^\d{1,2}:\d{2}/,  // Heures
        /^[A-Z]{2,}\s*:/, // Labels en majuscules suivis de :
        /^A\s+(LIVRER|REGLER)/i,  // "A LIVRER", "A REGLER"
        /^LE\s+\d{1,2}/i,  // "LE 24/03/2016"
    ];
    
    // Pattern amélioré pour détecter les articles
    // On cherche d'abord les lignes qui ressemblent à des articles avec prix
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Ignorer les lignes exclues
        let isExcluded = false;
        for (let exclude of excludeKeywords) {
            if (exclude.test(line)) {
                isExcluded = true;
                break;
            }
        }
        if (isExcluded) continue;
        
        // Ignorer les lignes trop courtes ou qui sont juste des chiffres
        if (line.length < 3 || /^\d+$/.test(line.trim())) continue;
        
        // Pattern principal: texte suivi d'un prix
        // Amélioration: on cherche aussi les lignes avec quantité
        const itemPatterns = [
            // Format: "1 Article 12.00" ou "Article 12.00"
            /^(?:\d+\s+)?(.+?)\s+(\d+)[,.](\d{2})\s*(?:€|\d)?$/,
            // Format: "Article 12,00 €"
            /^(?:\d+\s+)?(.+?)\s+(\d+),(\d{2})\s*€?$/,
            // Format: "Article 12.00"
            /^(?:\d+\s+)?(.+?)\s+(\d+)\.(\d{2})$/,
            // Format simple avec virgule: "Article 12,5"
            /^(?:\d+\s+)?(.+?)\s+(\d+),(\d{1})$/
        ];
        
        let itemFound = false;
        for (let pattern of itemPatterns) {
            const match = line.match(pattern);
            if (match) {
                let name = match[1].trim();
                let euros = match[2];
                let cents = match[3] || '00';
                
                // Si un seul chiffre après la virgule, c'est des dizaines
                if (cents.length === 1) {
                    cents = cents + '0';
                }
                
                const price = parseFloat(euros + '.' + cents);
                
                // Nettoyer le nom
                // Enlever les caractères spéciaux au début
                name = name.replace(/^[\|\-\+\*\/\.\s]+/, '');
                // Enlever les codes produits (ex: "T66-i-Veste" devient "Veste")
                name = name.replace(/^[A-Z]?\d+[\-\s]*[A-Z]?\d*[\-\s]*/, '');
                // Si le nom commence par un seul caractère puis un espace, le supprimer
                name = name.replace(/^[a-z]\s+/i, '');
                
                // Vérifications finales
                if (name.length < 2) continue;
                if (isNaN(price) || price <= 0 || price > 500) continue;
                
                // Ignorer si c'est manifestement pas un article
                if (/^(QT|REF|CODE|NUM|N°)/i.test(name)) continue;
                
                items.push({ 
                    name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(), 
                    price: price 
                });
                console.log('Article détecté:', name, price);
                itemFound = true;
                break;
            }
        }
        
        // Si pas trouvé avec les patterns stricts, essayer une détection plus souple
        // mais seulement dans la zone probable des articles (milieu du ticket)
        if (!itemFound && i > 5 && i < lines.length - 10) {
            // Vérifier si la ligne suivante contient un prix seul
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                const priceMatch = nextLine.match(/^(\d+)[,.](\d{1,2})\s*€?$/);
                if (priceMatch && line.length > 2 && /[a-zA-Z]/.test(line)) {
                    let name = line.trim();
                    let cents = priceMatch[2];
                    if (cents.length === 1) cents = cents + '0';
                    const price = parseFloat(priceMatch[1] + '.' + cents);
                    
                    if (price > 0 && price < 500 && !excludeKeywords.some(k => k.test(name))) {
                        // Nettoyer le nom
                        name = name.replace(/^[\|\-\+\*\/\.\s]+/, '');
                        name = name.replace(/^[A-Z]?\d+[\-\s]*[A-Z]?\d*[\-\s]*/, '');
                        
                        if (name.length >= 2) {
                            items.push({ 
                                name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(), 
                                price: price 
                            });
                            console.log('Article détecté (2 lignes):', name, price);
                            i++; // Sauter la ligne suivante
                        }
                    }
                }
            }
        }
    }
	}