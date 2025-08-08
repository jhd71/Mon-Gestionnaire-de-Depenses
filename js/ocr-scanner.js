// ocr-scanner.js - Module de scan OCR pour tickets de caisse
// Version complète, corrigée et améliorée avec prétraitement de l'image et logique d'analyse robuste.

// Charger Tesseract.js dynamiquement
(function() {
    if (!window.Tesseract) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => console.log('Tesseract.js chargé avec succès');
        script.onerror = () => console.error('Erreur lors du chargement de Tesseract.js');
        document.head.appendChild(script);
    }
})();

// Variable globale pour stocker les données extraites
window.scannedReceiptData = null;

// --- FONCTION DE PRÉTROITEMENT DE L'IMAGE ---
// Améliore la qualité de l'image avant l'OCR pour de meilleurs résultats
function preprocessImage(image) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // On peut redimensionner pour de meilleures performances si les images sont très grandes
    const MAX_WIDTH = 1000;
    const scale = image.width > MAX_WIDTH ? MAX_WIDTH / image.width : 1;
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    // 1. Dessiner l'image sur le canvas
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // 2. Passer en niveaux de gris et appliquer une binarisation (noir & blanc pur)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Formule simple pour le niveau de gris
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Seuil de binarisation (ajustable si nécessaire)
        const color = avg > 128 ? 255 : 0;
        data[i] = color;     // Rouge
        data[i + 1] = color; // Vert
        data[i + 2] = color; // Bleu
    }
    ctx.putImageData(imageData, 0, 0);

    // Retourner l'URL de l'image prétraitée
    return canvas.toDataURL('image/png');
}


// --- FONCTION PRINCIPALE DE SCAN ---
// FIX : La fonction est maintenant nommée directement "scanReceipt" pour correspondre à l'appel HTML onclick="scanReceipt()"
window.scanReceipt = function() {
    // Créer le modal de scan
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'scanModal';
    modal.style.zIndex = '10000';
    
    // Le contenu HTML du modal (inchangé)
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: inherit;">
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
                <div id="scanUploadArea" style="border: 2px dashed var(--primary); border-radius: 12px; padding: 2rem; text-align: center; background: var(--bg-tertiary); cursor: pointer; transition: all 0.3s; margin-bottom: 1rem;" onclick="document.getElementById('receiptImageInput').click()">
                    <span class="material-icons" style="font-size: 48px; color: var(--primary); display: block; margin-bottom: 1rem;">add_photo_alternate</span>
                    <p style="margin: 0.5rem 0; font-weight: 600;">Cliquez pour choisir une photo</p>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">ou prenez une photo avec votre appareil</p>
                    <input type="file" id="receiptImageInput" accept="image/*" capture="environment" style="display: none;" onchange="window.processReceiptImage(this)">
                </div>
                <div id="imagePreview" style="display: none; margin-bottom: 1rem; text-align: center;"><img id="previewImg" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
                <div id="scanProgress" style="display: none;">
                    <div style="margin-bottom: 1rem;"><div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;"><div style="display: flex; align-items: center; gap: 1rem;"><div class="spinner" style="width: 24px; height: 24px; border: 3px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div><div><div id="scanStatus" style="font-weight: 600;">Analyse en cours...</div><div id="scanProgressText" style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">Initialisation...</div></div></div><div style="margin-top: 1rem; background: var(--bg-secondary); border-radius: 4px; height: 8px; overflow: hidden;"><div id="progressBar" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div></div></div></div>
                </div>
                <div id="scanResults" style="display: none;">
                    <h3 style="margin-bottom: 1rem;">Résultats de l'analyse</h3>
                    <details style="margin-bottom: 1rem;"><summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Texte extrait (debug)</summary><textarea id="extractedText" readonly style="width: 100%; min-height: 100px; padding: 0.75rem; border-radius: 8px; background: var(--bg-tertiary); border: 1px solid var(--border); font-family: monospace; font-size: 0.875rem; margin-top: 0.5rem;"></textarea></details>
                    <div style="display: grid; gap: 1rem;">
                        <div><label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Magasin détecté :</label><input type="text" id="detectedStore" class="input" placeholder="Nom du magasin"></div>
                        <div><label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Date :</label><input type="date" id="detectedDate" class="input"></div>
                        <div><label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Montant total :</label><input type="number" id="detectedAmount" class="input" step="0.01" placeholder="0.00"></div>
                        <div><label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Articles détectés :</label><div id="detectedItems" style="max-height: 200px; overflow-y: auto; background: var(--bg-tertiary); border-radius: 8px; padding: 0.75rem;"><div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article détecté</div></div></div>
                        <div><label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Attribuer à :</label><select id="assignToUser" class="input"></select></div>
                        <div id="commonParticipants" style="display: none;"><label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Participants :</label><div id="participantsCheckboxes" style="background: var(--bg-tertiary); border-radius: 8px; padding: 0.75rem;"></div></div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-secondary); border-top: 1px solid var(--border); padding: inherit; display: flex; justify-content: flex-end; gap: 1rem; z-index: 10;">
                <button class="btn btn-danger" onclick="window.closeScanModal()">Annuler</button>
                <button id="addScannedExpense" class="btn" style="display: none;" onclick="window.addScannedExpense()"><span class="material-icons">add</span>Ajouter la dépense</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Remplir le select des utilisateurs (inchangé)
    const assignSelect = document.getElementById('assignToUser');
    let optionsHTML = '<option value="">Choisir...</option>';
    optionsHTML += '<option value="commun">🏠 Dépense commune</option>';
    const users = Object.entries(window.appData.users || {}).filter(([id]) => id !== 'commun');
    users.forEach(([id, user]) => {
        optionsHTML += `<option value="${id}">👤 ${user.name}</option>`;
    });
    assignSelect.innerHTML = optionsHTML;
    
    // Gérer le changement d'attribution (inchangé)
    assignSelect.addEventListener('change', function() {
        const commonParticipants = document.getElementById('commonParticipants');
        const participantsCheckboxes = document.getElementById('participantsCheckboxes');
        if (this.value === 'commun') {
            commonParticipants.style.display = 'block';
            const users = Object.entries(window.appData.users || {}).filter(([id]) => id !== 'commun');
            if (users.length > 0) {
                participantsCheckboxes.innerHTML = users.map(([id, user]) => `<div style="margin-bottom: 0.5rem;"><input type="checkbox" id="participant_scan_${id}" value="${id}" checked><label for="participant_scan_${id}">${user.name}</label></div>`).join('');
            } else {
                participantsCheckboxes.innerHTML = '<div style="color: var(--text-secondary);">Aucun utilisateur disponible.</div>';
            }
        } else {
            commonParticipants.style.display = 'none';
        }
    });

    // Ajouter l'animation CSS pour le spinner (inchangé)
    if (!document.getElementById('spinnerStyle')) {
        const style = document.createElement('style');
        style.id = 'spinnerStyle';
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }
};

// Traiter l'image sélectionnée (MODIFIÉE POUR UTILISER LE PRÉTROITEMENT)
window.processReceiptImage = function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    if (!window.Tesseract) {
        alert("Le module OCR est encore en cours de chargement. Veuillez réessayer.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            document.getElementById('scanUploadArea').style.display = 'none';
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('previewImg').src = img.src;
            
            // Appliquer le prétraitement à l'image
            const preprocessedImage = preprocessImage(img);

            document.getElementById('scanProgress').style.display = 'block';
            document.getElementById('scanResults').style.display = 'none';
            document.getElementById('scanStatus').textContent = 'Initialisation...';
            document.getElementById('progressBar').style.width = '0%';

            try {
                console.log('Début de la reconnaissance OCR sur l\'image prétraitée...');
                
                const { data: { text } } = await Tesseract.recognize(
                    preprocessedImage, // Utiliser l'image traitée
                    'fra',
                    {
                        logger: m => {
                            if (m.status === 'recognizing text' && m.progress) {
                                document.getElementById('scanStatus').textContent = 'Analyse du texte en cours...';
                                document.getElementById('progressBar').style.width = `${m.progress * 100}%`;
                            }
                        }
                    }
                );

                console.log('Texte reconnu:', text);
                window.analyzeReceiptText(text);

            } catch (error) {
                console.error('Erreur OCR:', error);
                alert("Erreur lors de l'analyse de l'image. Veuillez réessayer avec une image plus claire.");
                // Réinitialiser l'interface
                document.getElementById('scanProgress').style.display = 'none';
                document.getElementById('scanUploadArea').style.display = 'block';
                document.getElementById('imagePreview').style.display = 'none';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};


// Analyser le texte du ticket (LOGIQUE D'ANALYSE AMÉLIORÉE)
window.analyzeReceiptText = function(text) {
    console.log('Analyse du texte extrait:', text);
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('scanResults').style.display = 'block';
    document.getElementById('addScannedExpense').style.display = 'inline-flex';
    document.getElementById('extractedText').value = text;

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);

    // 1. Détecter le nom du magasin
    let storeName = lines.length > 0 ? lines[0] : '';
    if (storeName.length > 30 || storeName.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/) || storeName.toUpperCase().includes("FACTURE")) {
        storeName = lines.length > 1 ? lines[1] : 'Inconnu';
    }

    // 2. Détecter la date
    let detectedDate = '';
    const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
    for (const line of lines) {
        const match = line.match(dateRegex);
        if (match) {
            let [day, month, year] = match[1].replace(/[\.\-]/g, '/').split('/');
            if (year && year.length === 2) year = `20${year}`;
            if (day && month && year) {
                if (day.length === 1) day = `0${day}`;
                if (month.length === 1) month = `0${month}`;
                const d = new Date(`${year}-${month}-${day}`);
                if (d && !isNaN(d.getTime())) {
                    detectedDate = `${year}-${month}-${day}`;
                    break;
                }
            }
        }
    }
    if (!detectedDate) detectedDate = new Date().toISOString().split('T')[0];

    // 3. Détecter le montant total (Logique fiabilisée)
    let totalAmount = 0;
    const amountRegex = /([\-—]?\s*[0-9]+[,\.]\d{2})/;
    const totalKeywords = ['TOTAL FACTURE', 'TOTAL TTC', 'TOTAL', 'MONTANT A REGLER', 'NET A PAYER', 'A PAYER', 'PAIEMENT', 'Règlement Chèque'];
    let potentialAmounts = [];

    for (const line of lines.slice().reverse()) { // Commencer par la fin du ticket
        for (const keyword of totalKeywords) {
            if (line.toUpperCase().includes(keyword)) {
                const match = line.match(amountRegex);
                if (match) {
                    const amount = parseFloat(match[1].replace(/\s/g, '').replace(',', '.').replace('—', '-'));
                    if (!isNaN(amount) && amount > 0) {
                        potentialAmounts.push(amount);
                    }
                }
            }
        }
    }

    if (potentialAmounts.length > 0) {
        totalAmount = Math.max(...potentialAmounts); // Prendre le plus grand des totaux trouvés
    } else {
        // Plan B: si aucun mot-clé ne correspond, chercher le plus grand montant numérique vers la fin du ticket
        let allAmounts = [];
        for (const line of lines) {
             const match = line.match(amountRegex);
             if(match) {
                const amount = parseFloat(match[1].replace(/\s/g, '').replace(',', '.').replace('—', '-'));
                if (!isNaN(amount) && amount > 0) {
                    allAmounts.push(amount);
                }
             }
        }
        if (allAmounts.length > 0) {
            totalAmount = Math.max(...allAmounts.filter(a => a < 1000)); // Filtre pour éviter les montants irréalistes
        }
    }

    // 4. Extraire les articles
    const items = [];
    const itemRegex = /^(.+?)\s+([0-9]+[,\.]\d{2})$/;
    const ignoredKeywords = /TOTAL|MONTANT|REGLER|PAYER|RENDU|TVA|MERCI|SIRET|FACTURE|DATE|CLIENT|AVOIR|REMISE|DONT/i;

    for (const line of lines) {
        if (ignoredKeywords.test(line)) continue;
        const match = line.match(itemRegex);
        if (match) {
            const name = match[1].trim().replace(/^[*\d\-\s]+/, ''); // Nettoyer les codes au début
            const price = parseFloat(match[2].replace(',', '.'));
            if (name.length > 1 && !isNaN(price) && price > 0) {
                items.push({ name, price });
            }
        }
    }

    // Remplir les champs de l'interface
    document.getElementById('detectedStore').value = storeName;
    document.getElementById('detectedDate').value = detectedDate;
    document.getElementById('detectedAmount').value = totalAmount > 0 ? totalAmount.toFixed(2) : '';

    const itemsContainer = document.getElementById('detectedItems');
    if (items.length > 0) {
        itemsContainer.innerHTML = items.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                <span>${item.name}</span>
                <span style="font-weight: 600;">${item.price.toFixed(2)}€</span>
            </div>
        `).join('');
        const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
        itemsContainer.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0; margin-top: 0.5rem; border-top: 2px solid var(--primary); font-weight: 600;">
                <span>Sous-total articles:</span>
                <span>${itemsTotal.toFixed(2)}€</span>
            </div>
        `;
    } else {
        itemsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article détaillé détecté.</div>';
    }
    
    window.scannedReceiptData = {
        store: storeName, date: detectedDate, total: totalAmount, items: items, rawText: text
    };
};


// Ajouter la dépense scannée (inchangé)
window.addScannedExpense = function() {
    const store = document.getElementById('detectedStore').value.trim();
    const date = document.getElementById('detectedDate').value;
    const amount = parseFloat(document.getElementById('detectedAmount').value);
    const assignTo = document.getElementById('assignToUser').value;

    if (!store) { alert('Veuillez entrer le nom du magasin'); return; }
    if (!amount || amount <= 0) { alert('Veuillez entrer un montant valide'); return; }
    if (!assignTo) { alert('Veuillez choisir à qui attribuer cette dépense'); return; }

    const description = `${store} - Ticket scanné`;
    const data = window.appData;

    if (!data) {
        alert('Erreur: Les données de l\'application ne sont pas accessibles.');
        console.error('appData non trouvé');
        return;
    }

    if (assignTo === 'commun') {
        const participants = Array.from(document.querySelectorAll('#commonParticipants input[type="checkbox"]:checked')).map(cb => cb.value);
        if (participants.length === 0) { alert('Veuillez sélectionner au moins un participant'); return; }
        if (!data.commonExpenses) data.commonExpenses = [];
        data.commonExpenses.push({ name: description, amount, participants, date: date || new Date().toISOString(), scanned: true });
    } else {
        if (!data.users || !data.users[assignTo]) { alert('Erreur: Utilisateur non trouvé'); return; }
        if (!data.users[assignTo].expenses) data.users[assignTo].expenses = [];
        data.users[assignTo].expenses.push({ name: description, amount, date: date || new Date().toISOString(), scanned: true });
    }

    if (typeof window.saveData === 'function') window.saveData();
    if (typeof window.renderApp === 'function') window.renderApp();
    window.closeScanModal();

    if (typeof window.showSuccessMessage === 'function') {
        const userName = assignTo === 'commun' ? 'aux dépenses communes' : `à ${data.users[assignTo].name}`;
        window.showSuccessMessage(`Ticket de ${amount.toFixed(2)}€ ajouté ${userName} !`);
    }
};

// Fermer le modal de scan (inchangé)
window.closeScanModal = function() {
    const modal = document.getElementById('scanModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    window.scannedReceiptData = null;
};

console.log('Module OCR Scanner chargé avec succès');