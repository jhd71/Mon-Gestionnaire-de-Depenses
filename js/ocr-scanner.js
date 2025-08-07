// ocr-scanner.js - Module de scan OCR pour tickets de caisse
// Utilise Tesseract.js pour la reconnaissance de texte

// Charger Tesseract.js dynamiquement
(function() {
    // Vérifier si Tesseract n'est pas déjà chargé
    if (!window.Tesseract) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
        script.onload = () => {
            console.log('Tesseract.js chargé avec succès');
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
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <span class="material-icons" style="margin-right: 0.5rem;">document_scanner</span>
                Scanner un ticket de caisse
            </div>
            <div class="modal-body">
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
                    <input type="file" id="receiptImageInput" accept="image/*" capture="camera" style="display: none;" onchange="window.processReceiptImage(this)">
                </div>
                
                <!-- Aperçu de l'image -->
                <div id="imagePreview" style="display: none; margin-bottom: 1rem;">
                    <img id="previewImg" style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
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
                    
                    <!-- Texte brut extrait -->
                    <div style="margin-bottom: 1rem; display: none;">
                        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Texte extrait :</label>
                        <textarea id="extractedText" readonly style="width: 100%; min-height: 100px; padding: 0.75rem; border-radius: 8px; background: var(--bg-tertiary); border: 1px solid var(--border); font-family: monospace; font-size: 0.875rem;"></textarea>
                    </div>
                    
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
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Montant total :</label>
                            <input type="number" id="detectedAmount" class="input" step="0.01" placeholder="0.00">
                        </div>
                        
                        <div>
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Articles détectés :</label>
                            <div id="detectedItems" style="max-height: 200px; overflow-y: auto; background: var(--bg-tertiary); border-radius: 8px; padding: 0.75rem;">
                                <div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article détecté</div>
                            </div>
                        </div>
                        
                        <div>
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Attribuer à :</label>
                            <select id="assignToUser" class="input">
                                <option value="">Choisir...</option>
                                <option value="commun">🏠 Dépense commune</option>
                                ${Object.entries(window.appData.users || {})
                                    .filter(([id]) => id !== 'commun')
                                    .map(([id, user]) => `<option value="${id}">👤 ${user.name}</option>`)
                                    .join('')}
                            </select>
                        </div>
                        
                        <!-- Si dépense commune, sélection des participants -->
                        <div id="commonParticipants" style="display: none;">
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Participants :</label>
                            <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 0.75rem;">
                                ${Object.entries(window.appData.users || {})
                                    .filter(([id]) => id !== 'commun')
                                    .map(([id, user]) => `
                                        <div style="margin-bottom: 0.5rem;">
                                            <input type="checkbox" id="participant_scan_${id}" value="${id}" checked>
                                            <label for="participant_scan_${id}">${user.name}</label>
                                        </div>
                                    `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
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
    const assignSelect = document.getElementById('assignToUser');
    assignSelect.addEventListener('change', function() {
        const commonParticipants = document.getElementById('commonParticipants');
        if (this.value === 'commun') {
            commonParticipants.style.display = 'block';
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
        // Créer un worker Tesseract
        const worker = await Tesseract.createWorker('fra', 1, {
            logger: m => {
                // Mise à jour de la progression
                if (m.status) {
                    document.getElementById('scanProgressText').textContent = 
                        m.status === 'initializing api' ? 'Initialisation...' :
                        m.status === 'loading language traineddata' ? 'Chargement du modèle français...' :
                        m.status === 'recognizing text' ? 'Analyse du texte...' :
                        m.status;
                }
                if (m.progress) {
                    const percent = Math.round(m.progress * 100);
                    document.getElementById('progressBar').style.width = percent + '%';
                }
            }
        });
        
        // Reconnaissance du texte
        const { data: { text } } = await worker.recognize(file);
        
        // Terminer le worker
        await worker.terminate();
        
        // Analyser le texte extrait
        window.analyzeReceiptText(text);
        
    } catch (error) {
        console.error('Erreur OCR:', error);
        alert('Erreur lors de l\'analyse de l\'image. Veuillez réessayer.');
        document.getElementById('scanProgress').style.display = 'none';
    }
};

// Analyser le texte du ticket
window.analyzeReceiptText = function(text) {
    console.log('Texte extrait:', text);
    
    // Cacher la progression et afficher les résultats
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('scanResults').style.display = 'block';
    document.getElementById('addScannedExpense').style.display = 'inline-flex';
    
    // Afficher le texte brut (pour debug, caché par défaut)
    document.getElementById('extractedText').value = text;
    
    // Extraire les informations
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // 1. Détecter le nom du magasin (généralement dans les premières lignes)
    let storeName = '';
    const storePatterns = [
        /CARREFOUR|LECLERC|AUCHAN|LIDL|ALDI|INTERMARCHE|SUPER U|MONOPRIX|FRANPRIX|CASINO/i,
        /BOULANGERIE|PHARMACIE|TABAC|RESTAURANT|CAFE|BRASSERIE/i
    ];
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        for (let pattern of storePatterns) {
            if (pattern.test(lines[i])) {
                storeName = lines[i];
                break;
            }
        }
        if (storeName) break;
        // Si pas de pattern, prendre la première ligne non vide comme nom
        if (i === 0 && lines[i].length > 2 && lines[i].length < 50) {
            storeName = lines[i];
        }
    }
    
    // 2. Détecter la date
    let detectedDate = '';
    const datePatterns = [
        /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,  // DD/MM/YYYY ou DD-MM-YYYY
        /(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,  // YYYY/MM/DD
    ];
    
    for (let line of lines) {
        for (let pattern of datePatterns) {
            const match = line.match(pattern);
            if (match) {
                // Convertir en format YYYY-MM-DD pour l'input date
                let day, month, year;
                if (match[3].length === 4) {
                    // Format DD/MM/YYYY
                    day = match[1].padStart(2, '0');
                    month = match[2].padStart(2, '0');
                    year = match[3];
                } else if (match[1].length === 4) {
                    // Format YYYY/MM/DD
                    year = match[1];
                    month = match[2].padStart(2, '0');
                    day = match[3].padStart(2, '0');
                } else {
                    // Format DD/MM/YY
                    day = match[1].padStart(2, '0');
                    month = match[2].padStart(2, '0');
                    year = '20' + match[3];
                }
                detectedDate = `${year}-${month}-${day}`;
                break;
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
    const amountPatterns = [
        /TOTAL[\s:]*([0-9]+[,.]?[0-9]*)/i,
        /MONTANT[\s:]*([0-9]+[,.]?[0-9]*)/i,
        /A PAYER[\s:]*([0-9]+[,.]?[0-9]*)/i,
        /ESPECES[\s:]*([0-9]+[,.]?[0-9]*)/i,
        /CB[\s:]*([0-9]+[,.]?[0-9]*)/i,
        /€[\s]*([0-9]+[,.]?[0-9]*)/,
        /([0-9]+[,.]?[0-9]*)[\s]*€/,
        /([0-9]+[,.]?[0-9]*)[\s]*EUR/i
    ];
    
    // Chercher le montant le plus élevé (probablement le total)
    let amounts = [];
    for (let line of lines) {
        for (let pattern of amountPatterns) {
            const matches = line.matchAll(new RegExp(pattern, 'g'));
            for (let match of matches) {
                const amountStr = match[1].replace(',', '.');
                const amount = parseFloat(amountStr);
                if (!isNaN(amount) && amount > 0) {
                    amounts.push(amount);
                }
            }
        }
    }
    
    // Prendre le montant le plus élevé comme total
    if (amounts.length > 0) {
        totalAmount = Math.max(...amounts);
    }
    
    // 4. Extraire les articles (lignes avec des prix)
    const items = [];
    const itemPattern = /^(.+?)\s+([0-9]+[,.]?[0-9]*)\s*€?$/;
    const simpleItemPattern = /([0-9]+[,.]?[0-9]*)\s*€/;
    
    for (let line of lines) {
        // Ignorer les lignes de total
        if (/TOTAL|MONTANT|ESPECES|CB|RENDU|TVA|SOUS.TOTAL/i.test(line)) continue;
        
        const match = line.match(itemPattern);
        if (match) {
            const name = match[1].trim();
            const price = parseFloat(match[2].replace(',', '.'));
            if (name && !isNaN(price) && price > 0 && price < totalAmount) {
                items.push({ name, price });
            }
        } else if (simpleItemPattern.test(line)) {
            // Ligne avec juste un prix
            const priceMatch = line.match(simpleItemPattern);
            if (priceMatch) {
                const price = parseFloat(priceMatch[1].replace(',', '.'));
                const name = line.replace(simpleItemPattern, '').trim();
                if (name && !isNaN(price) && price > 0 && price < totalAmount) {
                    items.push({ name, price });
                }
            }
        }
    }
    
    // Remplir les champs
    document.getElementById('detectedStore').value = storeName;
    document.getElementById('detectedDate').value = detectedDate;
    document.getElementById('detectedAmount').value = totalAmount.toFixed(2);
    
    // Afficher les articles détectés
    const itemsContainer = document.getElementById('detectedItems');
    if (items.length > 0) {
        itemsContainer.innerHTML = items.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                <span>${item.name}</span>
                <span style="font-weight: 600;">${item.price.toFixed(2)}€</span>
            </div>
        `).join('');
    } else {
        itemsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article détecté - Entrez le montant total manuellement</div>';
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

// Ajouter la dépense scannée
window.addScannedExpense = function() {
    const store = document.getElementById('detectedStore').value.trim();
    const date = document.getElementById('detectedDate').value;
    const amount = parseFloat(document.getElementById('detectedAmount').value);
    const assignTo = document.getElementById('assignToUser').value;
    
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
        
        window.appData.commonExpenses.push({
            name: description,
            amount: amount,
            participants: participants,
            date: date || new Date().toISOString()
        });
    } else {
        // Dépense individuelle
        window.appData.users[assignTo].expenses.push({
            name: description,
            amount: amount,
            date: date || new Date().toISOString(),
            scanned: true
        });
    }
    
    // Sauvegarder et rafraîchir
    window.saveData();
    window.renderApp();
    
    // Fermer le modal
    window.closeScanModal();
    
    // Message de succès
    if (typeof window.showSuccessMessage === 'function') {
        window.showSuccessMessage('Ticket ajouté avec succès !');
    } else {
        alert('Ticket ajouté avec succès !');
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