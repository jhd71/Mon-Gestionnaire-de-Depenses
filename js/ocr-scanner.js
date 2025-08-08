// ocr-scanner.js - Module de scan OCR pour tickets de caisse
// Version améliorée avec prétraitement de l'image et logique d'analyse robuste

// ... (Le code de chargement de Tesseract.js reste le même) ...

// --- NOUVELLE FONCTION ---
// Prétraitement de l'image pour améliorer la qualité de l'OCR
function preprocessImage(image) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = image.width;
    canvas.height = image.height;

    // 1. Dessiner l'image sur le canvas
    ctx.drawImage(image, 0, 0);

    // 2. Passer en niveaux de gris et augmenter le contraste
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Binarisation simple (seuil à 128)
        const color = avg > 128 ? 255 : 0;
        data[i] = color;     // Rouge
        data[i + 1] = color; // Vert
        data[i + 2] = color; // Bleu
    }
    ctx.putImageData(imageData, 0, 0);

    // Retourner l'URL de l'image prétraitée
    return canvas.toDataURL('image/png');
}


// Traiter l'image sélectionnée (MODIFIÉE)
window.processReceiptImage = async function(input) {
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
            // Afficher l'aperçu de l'image originale
            document.getElementById('scanUploadArea').style.display = 'none';
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('previewImg').src = img.src;

            // --- AMÉLIORATION ---
            // Prétraiter l'image avant l'OCR
            const preprocessedImage = preprocessImage(img);
            // Optionnel: afficher l'image prétraitée pour le débogage
            // document.getElementById('previewImg').src = preprocessedImage;

            document.getElementById('scanProgress').style.display = 'block';
            document.getElementById('scanResults').style.display = 'none';

            try {
                console.log('Début de la reconnaissance OCR sur l\'image prétraitée...');

                // Paramètres optimisés pour les tickets de caisse
                const params = {
                    // Désactiver les dictionnaires pour mieux reconnaître les suites de caractères non conventionnelles
                    load_system_dawg: '0',
                    load_freq_dawg: '0',
                };

                const { data: { text } } = await Tesseract.recognize(
                    preprocessedImage,
                    'fra',
                    {
                        logger: m => {
                            console.log('OCR Progress:', m);
                            if (m.status === 'recognizing text' && m.progress) {
                                document.getElementById('scanStatus').textContent = 'Analyse du texte...';
                                document.getElementById('progressBar').style.width = `${m.progress * 100}%`;
                            }
                        },
                        // Appliquer les paramètres
                        // tessedit_char_whitelist: '0123456789.,€ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/-: ',
                        // user_defined_dawg_file: false,
                    }
                );

                console.log('Texte reconnu:', text);
                window.analyzeReceiptText(text);

            } catch (error) {
                console.error('Erreur OCR:', error);
                alert("Erreur lors de l'analyse. Essayez avec une image plus nette.");
                // Réinitialiser l'interface
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};


// Analyser le texte du ticket (LOGIQUE ENTIÈREMENT REVUE)
window.analyzeReceiptText = function(text) {
    console.log('Analyse du texte extrait:', text);
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('scanResults').style.display = 'block';
    document.getElementById('addScannedExpense').style.display = 'inline-flex';
    document.getElementById('extractedText').value = text;

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);

    // 1. Détecter le nom du magasin (plus robuste)
    // On suppose que la première ligne non vide est le nom du magasin.
    let storeName = lines.length > 0 ? lines[0] : 'Inconnu';
     if (storeName.length > 30 || storeName.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/)) {
        storeName = lines.length > 1 ? lines[1] : 'Inconnu';
    }


    // 2. Détecter la date (légèrement amélioré)
    let detectedDate = '';
    const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
    for (const line of lines) {
        const match = line.match(dateRegex);
        if (match) {
            let [day, month, year] = match[1].replace(/[\.\-]/g, '/').split('/');
            if (year.length === 2) {
                year = `20${year}`;
            }
            if (day.length === 1) day = `0${day}`;
            if (month.length === 1) month = `0${month}`;

            // S'assurer que la date est valide avant de l'assigner
            const d = new Date(`${year}-${month}-${day}`);
            if (!isNaN(d.getTime())) {
                detectedDate = `${year}-${month}-${day}`;
                break;
            }
        }
    }
    if (!detectedDate) {
        detectedDate = new Date().toISOString().split('T')[0];
    }


    // 3. Détecter le montant total (LOGIQUE FIABILISÉE)
    let totalAmount = 0;
    // Regex pour les montants, gérant les virgules et points comme séparateurs décimaux.
    const amountRegex = /([\-—]?[0-9]+[,\.]\d{1,2})/;

    const totalKeywords = ['Total Facture', 'TOTAL', 'MONTANT A REGLER', 'NET A PAYER', 'A PAYER', 'PAIEMENT'];
    let bestMatchAmount = 0;

    for (const keyword of totalKeywords) {
        for (const line of lines) {
            if (line.toUpperCase().includes(keyword)) {
                const match = line.match(amountRegex);
                if (match) {
                    const amountStr = match[1].replace(',', '.').replace('—', '-');
                    const amount = parseFloat(amountStr);
                    if (!isNaN(amount) && amount > bestMatchAmount) {
                         bestMatchAmount = amount;
                    }
                }
            }
        }
        // Si on a trouvé un montant avec un mot-clé, on l'utilise et on arrête.
        if (bestMatchAmount > 0) {
            break;
        }
    }

    totalAmount = bestMatchAmount;

    // Si aucune correspondance de mot-clé, chercher le montant le plus élevé sur le ticket.
    if (totalAmount === 0) {
        let allAmounts = [];
        for (const line of lines) {
             const match = line.match(amountRegex);
             if(match) {
                const amount = parseFloat(match[1].replace(',', '.').replace('—', '-'));
                if (!isNaN(amount)) {
                    allAmounts.push(amount);
                }
             }
        }
        if (allAmounts.length > 0) {
            totalAmount = Math.max(...allAmounts);
        }
    }


    // 4. Extraire les articles (légèrement amélioré)
    const items = [];
    const itemRegex = /^(.+?)\s+([\-—]?[0-9]+[,\.]\d{2})$/;
    const ignoredKeywords = /TOTAL|MONTANT|REGLER|PAYER|RENDU|TVA|MERCI|SIRET|FACTURE|DATE|CLIENT|AVOIR/i;

    for (const line of lines) {
        if (ignoredKeywords.test(line)) continue;

        const match = line.match(itemRegex);
        if (match) {
            const name = match[1].trim();
            const price = parseFloat(match[2].replace(',', '.').replace('—', '-'));

            if (name.length > 1 && !isNaN(price)) {
                items.push({ name, price });
            }
        }
    }

    // Remplir les champs de l'interface
    document.getElementById('detectedStore').value = storeName;
    document.getElementById('detectedDate').value = detectedDate;
    document.getElementById('detectedAmount').value = totalAmount > 0 ? totalAmount.toFixed(2) : '';

    // Afficher les articles
    const itemsContainer = document.getElementById('detectedItems');
    if (items.length > 0) {
        itemsContainer.innerHTML = items.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                <span>${item.name}</span>
                <span style="font-weight: 600;">${item.price.toFixed(2)}€</span>
            </div>
        `).join('');
        
        // Calculer et afficher le sous-total des articles
        const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
        itemsContainer.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0; margin-top: 0.5rem; border-top: 2px solid var(--primary); font-weight: 600;">
                <span>Sous-total articles:</span>
                <span>${itemsTotal.toFixed(2)}€</span>
            </div>
        `;
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
            scanned: true
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