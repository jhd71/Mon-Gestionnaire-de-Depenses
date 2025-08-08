// ocr-scanner.js - Module de scan OCR pour tickets de caisse
// Version 3 : Suppression du prétraitement pour tester avec l'image originale,
// et amélioration de la logique d'extraction.

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

// La fonction de prétraitement est conservée ici au cas où on voudrait la réactiver plus tard,
// mais elle n'est plus appelée pour le moment.
function preprocessImage(image) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = image.width > 1000 ? 1000 / image.width : 1;
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const color = avg > 128 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = color;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
}


// --- FONCTION PRINCIPALE DE SCAN ---
window.scanReceipt = function() {
    // Création du modal (code identique)
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'scanModal';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: inherit;">
            <div class="modal-header" style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10; padding: 1rem; border-bottom: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; align-items: center;"><span class="material-icons" style="margin-right: 0.5rem;">document_scanner</span>Scanner un ticket de caisse</div><button onclick="window.closeScanModal()" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><span class="material-icons">close</span></button></div>
            </div>
            <div class="modal-body" style="padding-bottom: 80px;">
                <div id="scanUploadArea" style="border: 2px dashed var(--primary); border-radius: 12px; padding: 2rem; text-align: center; background: var(--bg-tertiary); cursor: pointer; transition: all 0.3s; margin-bottom: 1rem;" onclick="document.getElementById('receiptImageInput').click()"><span class="material-icons" style="font-size: 48px; color: var(--primary); display: block; margin-bottom: 1rem;">add_photo_alternate</span><p style="margin: 0.5rem 0; font-weight: 600;">Cliquez pour choisir une photo</p><p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">ou prenez une photo avec votre appareil</p><input type="file" id="receiptImageInput" accept="image/*" capture="environment" style="display: none;" onchange="window.processReceiptImage(this)"></div>
                <div id="imagePreview" style="display: none; margin-bottom: 1rem; text-align: center;"><img id="previewImg" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
                <div id="scanProgress" style="display: none;"><div style="margin-bottom: 1rem;"><div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;"><div style="display: flex; align-items: center; gap: 1rem;"><div class="spinner" style="width: 24px; height: 24px; border: 3px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div><div><div id="scanStatus" style="font-weight: 600;">Analyse en cours...</div><div id="scanProgressText" style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">Initialisation...</div></div></div><div style="margin-top: 1rem; background: var(--bg-secondary); border-radius: 4px; height: 8px; overflow: hidden;"><div id="progressBar" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div></div></div></div></div>
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
    
    // Remplissage du select des utilisateurs (code identique)
    const assignSelect = document.getElementById('assignToUser');
    let optionsHTML = '<option value="">Choisir...</option><option value="commun">🏠 Dépense commune</option>';
    const users = Object.entries(window.appData.users || {}).filter(([id]) => id !== 'commun');
    users.forEach(([id, user]) => { optionsHTML += `<option value="${id}">👤 ${user.name}</option>`; });
    assignSelect.innerHTML = optionsHTML;
    assignSelect.addEventListener('change', function() {
        const commonParticipants = document.getElementById('commonParticipants');
        if (this.value === 'commun') {
            commonParticipants.style.display = 'block';
            const participantsCheckboxes = document.getElementById('participantsCheckboxes');
            const users = Object.entries(window.appData.users || {}).filter(([id]) => id !== 'commun');
            participantsCheckboxes.innerHTML = users.length > 0 ? users.map(([id, user]) => `<div style="margin-bottom: 0.5rem;"><input type="checkbox" id="participant_scan_${id}" value="${id}" checked><label for="participant_scan_${id}">${user.name}</label></div>`).join('') : '<div style="color: var(--text-secondary);">Aucun utilisateur disponible.</div>';
        } else {
            commonParticipants.style.display = 'none';
        }
    });

    if (!document.getElementById('spinnerStyle')) {
        const style = document.createElement('style');
        style.id = 'spinnerStyle';
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }
};

// Traiter l'image sélectionnée (MODIFIÉE POUR NE PLUS UTILISER LE PRÉTROITEMENT)
window.processReceiptImage = async function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    if (!window.Tesseract) {
        alert("Le module OCR est encore en cours de chargement. Veuillez réessayer.");
        return;
    }

    // Afficher l'aperçu et lancer l'OCR
    const reader = new FileReader();
    reader.onload = async function(e) {
        document.getElementById('scanUploadArea').style.display = 'none';
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('previewImg').src = e.target.result;

        document.getElementById('scanProgress').style.display = 'block';
        document.getElementById('scanResults').style.display = 'none';
        document.getElementById('scanStatus').textContent = 'Initialisation...';
        document.getElementById('progressBar').style.width = '0%';

        try {
            console.log("Lancement de l'OCR sur l'image ORIGINALE...");
            
            // On utilise directement le fichier de l'input `file` ou l'url `e.target.result`
            // Le prétraitement est désactivé pour ce test.
            const { data: { text } } = await Tesseract.recognize(
                file, 
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
            document.getElementById('scanProgress').style.display = 'none';
            document.getElementById('scanUploadArea').style.display = 'block';
            document.getElementById('imagePreview').style.display = 'none';
        }
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

    const lines = text.split('\n').map(line => line.trim().replace(/€|E\b/g, ''));

    // 1. Détecter le nom du magasin
    let storeName = lines.find(line => line.length > 2 && !line.match(/\d/)) || lines[0] || 'Inconnu';

    // 2. Détecter la date
    let detectedDate = '';
    const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
    for (const line of lines) {
        const match = line.match(dateRegex);
        if (match) {
            let [, day, month, year] = match;
            if (year.length === 2) year = `20${year}`;
            if (day.length === 1) day = `0${day}`;
            if (month.length === 1) month = `0${month}`;
            const d = new Date(`${year}-${month}-${day}`);
            if (!isNaN(d.getTime())) {
                detectedDate = `${year}-${month}-${day}`;
                break;
            }
        }
    }
    if (!detectedDate) detectedDate = new Date().toISOString().split('T')[0];

    // 3. Détecter le montant total (Logique plus robuste)
    let totalAmount = 0;
    // Regex pour un montant: peut commencer par un mot, puis des espaces, puis les chiffres. Ex: "Total 31.80"
    const amountRegex = /([\-—]?\d+[,.]\d{1,2})/;
    const totalKeywords = ['TOTAL FACTURE', 'REGLEMENT CHEQUE', 'TOTAL', 'NET A PAYER', 'MONTANT', 'A PAYER'];
    let potentialAmounts = [];

    // On parcourt les lignes de la fin vers le début, là où se trouvent les totaux
    for (const line of lines.slice().reverse()) {
        const upperLine = line.toUpperCase();
        for (const keyword of totalKeywords) {
            if (upperLine.includes(keyword)) {
                const match = line.match(amountRegex);
                if (match) {
                    const amount = parseFloat(match[1].replace(',', '.').replace('—', '-'));
                    if (!isNaN(amount) && amount > 0) {
                        potentialAmounts.push(amount);
                    }
                }
            }
        }
    }
    
    // S'il y a des montants associés à des mots-clés, on prend le plus élevé.
    if (potentialAmounts.length > 0) {
        totalAmount = Math.max(...potentialAmounts);
    } else {
        // Plan B: Trouver tous les montants et prendre le plus élevé.
        const allAmounts = lines.map(line => line.match(amountRegex))
                                .filter(Boolean)
                                .map(match => parseFloat(match[1].replace(',', '.')));
        if (allAmounts.length > 0) {
            totalAmount = Math.max(...allAmounts.filter(a => a && a < 1000));
        }
    }

    // 4. Extraire les articles
    const items = [];
    // Regex : (Texte) (espace) (chiffres)(.|,)(2 chiffres)
    const itemRegex = /^(.*?)\s+(\d+[,.]\d{2})$/;
    const ignoredKeywords = /TOTAL|MONTANT|REGLER|PAYER|RENDU|TVA|MERCI|SIRET|FACTURE|DATE|CLIENT|AVOIR|REMISE|DONT|COMMANDE|LIVRAISON/i;

    for (const line of lines) {
        if (ignoredKeywords.test(line) || line.length < 4) continue;
        const match = line.match(itemRegex);
        if (match) {
            const name = match[1].trim().replace(/^[\d\s\W]+/, ''); // Nettoyer les codes articles
            const price = parseFloat(match[2].replace(',', '.'));
            if (name && name.length > 2 && !isNaN(price) && price > 0) {
                items.push({ name, price });
            }
        }
    }

    // Remplissage de l'interface
    document.getElementById('detectedStore').value = storeName;
    document.getElementById('detectedDate').value = detectedDate;
    document.getElementById('detectedAmount').value = totalAmount > 0 ? totalAmount.toFixed(2) : '';

    const itemsContainer = document.getElementById('detectedItems');
    if (items.length > 0) {
        itemsContainer.innerHTML = items.map(item => `<div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);"><span>${item.name}</span><span style="font-weight: 600;">${item.price.toFixed(2)}</span></div>`).join('');
        const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
        itemsContainer.innerHTML += `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0; margin-top: 0.5rem; border-top: 2px solid var(--primary); font-weight: 600;"><span>Sous-total articles:</span><span>${itemsTotal.toFixed(2)}</span></div>`;
    } else {
        itemsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.875rem;">Aucun article détaillé détecté.</div>';
    }
    
    window.scannedReceiptData = { store: storeName, date: detectedDate, total: totalAmount, items, rawText: text };
};

// Fonctions pour ajouter la dépense et fermer le modal (identiques)
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
    if (!data) { alert('Erreur: Les données de l\'application ne sont pas accessibles.'); return; }

    if (assignTo === 'commun') {
        const participants = Array.from(document.querySelectorAll('#commonParticipants input:checked')).map(cb => cb.value);
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

window.closeScanModal = function() {
    const modal = document.getElementById('scanModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    window.scannedReceiptData = null;
};

console.log('Module OCR Scanner chargé avec succès (v3 - sans prétraitement)');