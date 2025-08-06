// ocr-scanner.js - Scanner de tickets de caisse avec OCR

// Fonction principale pour scanner un ticket
window.scanReceiptOCR = async function() {
    // Créer un input file temporaire
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Utiliser la caméra arrière sur mobile
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Afficher un loader
        showScanLoader();
        
        try {
            // Convertir l'image en base64
            const base64 = await fileToBase64(file);
            
            // Utiliser l'API OCR (Tesseract.js ou API externe)
            const extractedData = await processReceiptOCR(base64);
            
            // Afficher le modal de confirmation
            showReceiptConfirmation(extractedData);
            
        } catch (error) {
            console.error('Erreur OCR:', error);
            alert('Impossible de lire le ticket. Veuillez réessayer ou saisir manuellement.');
        } finally {
            hideScanLoader();
        }
    };
    
    input.click();
}

// Convertir fichier en base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function processReceiptOCR(base64Image) {
    const result = await Tesseract.recognize(
        base64Image,
        'fra',
        {
            logger: m => console.log(m)
        }
    );

    const text = result.data.text;
    console.log('Texte OCR détecté :', text);
    return parseReceiptText(text);
}


// Parser le texte du ticket
function parseReceiptText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const items = [];
    let total = 0;
    let shopName = '';
    
    // Patterns pour détecter les éléments
    const pricePattern = /(\d+[.,]\d{2})\s*(€|EUR)?$/;
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
    const totalPattern = /TOTAL|MONTANT|A PAYER/i;
    
    lines.forEach((line, index) => {
        // Détecter le nom du magasin (première ligne)
        if (index === 0 && !pricePattern.test(line)) {
            shopName = line.trim();
        }
        
        // Détecter les articles
        const priceMatch = line.match(pricePattern);
        if (priceMatch && !totalPattern.test(line)) {
            const price = parseFloat(priceMatch[1].replace(',', '.'));
            const itemName = line.replace(priceMatch[0], '').trim();
            
            if (itemName && price > 0) {
                items.push({
                    name: itemName,
                    price: price
                });
            }
        }
        
        // Détecter le total
        if (totalPattern.test(line) && priceMatch) {
            total = parseFloat(priceMatch[1].replace(',', '.'));
        }
    });
    
    // Si pas de total trouvé, calculer depuis les items
    if (!total && items.length > 0) {
        total = items.reduce((sum, item) => sum + item.price, 0);
    }
    
    // Déterminer la catégorie automatiquement
    const category = guessCategory(shopName, items);
    
    return {
        shopName: shopName || 'Ticket scanné',
        items: items,
        total: total,
        category: category,
        date: new Date().toISOString()
    };
}

// Deviner la catégorie selon le magasin et les articles
function guessCategory(shopName, items) {
    const shop = shopName.toLowerCase();
    
    // Patterns de magasins
    if (shop.includes('carrefour') || shop.includes('auchan') || shop.includes('leclerc') || 
        shop.includes('lidl') || shop.includes('aldi') || shop.includes('casino')) {
        return 'alimentation';
    }
    if (shop.includes('restaurant') || shop.includes('mcdo') || shop.includes('burger')) {
        return 'restaurant';
    }
    if (shop.includes('pharmacie') || shop.includes('médical')) {
        return 'sante';
    }
    if (shop.includes('fnac') || shop.includes('darty') || shop.includes('amazon')) {
        return 'shopping';
    }
    
    // Sinon, analyser les articles
    const itemsText = items.map(i => i.name.toLowerCase()).join(' ');
    if (itemsText.includes('pain') || itemsText.includes('lait') || itemsText.includes('fruit')) {
        return 'alimentation';
    }
    
    return 'autre';
}

// Afficher le loader pendant le scan
function showScanLoader() {
    const loader = document.createElement('div');
    loader.id = 'scanLoader';
    loader.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div class="material-icons spinning" style="font-size: 48px; color: white; margin-bottom: 1rem;">
                document_scanner
            </div>
            <div style="color: white; font-size: 1.125rem;">Analyse du ticket en cours...</div>
        </div>
    `;
    document.body.appendChild(loader);
}

function hideScanLoader() {
    const loader = document.getElementById('scanLoader');
    if (loader) loader.remove();
}

// Modal de confirmation après scan
function showReceiptConfirmation(data) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'receiptConfirmModal';
    
    // Créer les options d'utilisateurs
    const userOptions = window.appData && window.appData.users ? 
        Object.keys(window.appData.users).map(userId => 
            `<option value="${userId}">${window.appData.users[userId].name}</option>`
        ).join('') : '<option value="">Aucun utilisateur</option>';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <span class="material-icons" style="margin-right: 0.5rem;">receipt_long</span>
                Ticket scanné avec succès
            </div>
            <div class="modal-body">
                <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <h4 style="margin-bottom: 0.5rem;">${data.shopName}</h4>
                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        ${data.items.length} article(s) détecté(s)
                    </div>
                    
                    ${data.items.length > 0 ? `
                        <div style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">
                            ${data.items.map(item => `
                                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                                    <span>${item.name}</span>
                                    <span style="font-weight: 600;">${item.price.toFixed(2)}€</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="border-top: 2px solid var(--border); padding-top: 0.5rem; display: flex; justify-content: space-between; font-size: 1.125rem; font-weight: 700;">
                        <span>TOTAL</span>
                        <span style="color: var(--primary);">${data.total.toFixed(2)}€</span>
                    </div>
                </div>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Attribuer à :
                        </label>
                        <select id="receiptUser" class="input">
                            ${userOptions}
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Catégorie :
                        </label>
                        <select id="receiptCategory" class="input">
                            ${window.appData && window.appData.categories ? 
                                window.appData.categories.map(cat => 
                                    `<option value="${cat.id}" ${cat.id === data.category ? 'selected' : ''}>
                                        ${cat.icon} ${cat.name}
                                    </option>`
                                ).join('') : '<option value="autre">Autre</option>'
                            }
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Description (optionnel) :
                        </label>
                        <input type="text" id="receiptDescription" class="input" 
                               value="${data.shopName}" placeholder="Description de la dépense">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="closeReceiptModal()">Annuler</button>
                <button class="btn" onclick="confirmReceiptScan()">
                    <span class="material-icons">check</span>
                    Enregistrer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Stocker les données pour la confirmation
    window.scannedReceiptData = data;
}

// Confirmer l'ajout du ticket scanné
window.confirmReceiptScan = function() {
    const userId = document.getElementById('receiptUser').value;
    const category = document.getElementById('receiptCategory').value;
    const description = document.getElementById('receiptDescription').value || window.scannedReceiptData.shopName;
    
    // Ajouter la dépense
    if (userId === 'commun') {
        // Pour les dépenses communes, ouvrir le modal de sélection des participants
        currentUser = 'commun';
        document.getElementById('commonExpenseName').value = description;
        document.getElementById('commonExpenseAmount').value = window.scannedReceiptData.total.toFixed(2);
        closeReceiptModal();
        openModal('addCommonExpenseModal');
    } else {
        // Ajouter comme dépense personnelle
        window.appData.users[userId].expenses.push({
            name: description,
            amount: window.scannedReceiptData.total,
            category: category,
            date: new Date().toISOString(),
            scanned: true,
            items: window.scannedReceiptData.items
        });
        
        saveData();
        renderApp();
        closeReceiptModal();
        
        // Message de succès
        showSuccessMessage(`Ticket de ${window.scannedReceiptData.total.toFixed(2)}€ ajouté pour ${window.appData.users[userId].name}`);
    }
}

window.closeReceiptModal = function() {
    const modal = document.getElementById('receiptConfirmModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    window.scannedReceiptData = null;
}

// Ajouter le style pour l'animation
if (!document.getElementById('ocr-scanner-styles')) {
    const style = document.createElement('style');
    style.id = 'ocr-scanner-styles';
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .spinning {
            animation: spin 1s linear infinite;
        }
    `;
    document.head.appendChild(style);
}