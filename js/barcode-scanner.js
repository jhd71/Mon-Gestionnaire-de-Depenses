// barcode-scanner.js - Module de scan de codes-barres pour produits
// Utilise QuaggaJS pour la lecture de codes-barres et OpenFoodFacts pour les infos produits

// Charger QuaggaJS dynamiquement
(function() {
    if (!window.Quagga) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.2/dist/quagga.min.js';
        script.onload = () => {
            console.log('QuaggaJS chargé avec succès');
        };
        script.onerror = () => {
            console.error('Erreur lors du chargement de QuaggaJS');
        };
        document.head.appendChild(script);
    }
})();

// Variable globale pour stocker les données du produit scanné
window.scannedProductData = null;
window.isScannerActive = false;

// Fonction principale de scan de code-barres
window.scanBarcode = function() {
    // Créer le modal de scan
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'barcodeModal';
    modal.style.zIndex = '10000';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header" style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10; padding: 1rem; border-bottom: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center;">
                        <span class="material-icons" style="margin-right: 0.5rem;">qr_code_scanner</span>
                        Scanner un code-barres
                    </div>
                    <button onclick="window.closeBarcodeModal()" style="background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            </div>
            <div class="modal-body" style="padding-bottom: 80px;">
                <!-- Zone de scan vidéo -->
                <div id="scannerContainer" style="position: relative; width: 100%; margin-bottom: 1rem;">
                    <div id="scanner" style="width: 100%; height: 300px; background: #000; border-radius: 8px; overflow: hidden; position: relative;">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; text-align: center; z-index: 1;">
                            <div class="spinner" style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                            <p>Initialisation de la caméra...</p>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <span class="material-icons" style="vertical-align: middle;">info</span>
                        Placez le code-barres dans le cadre de la caméra
                    </div>
                </div>
                
                <!-- Saisie manuelle -->
                <div style="text-align: center; margin: 2rem 0; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                    <p style="margin-bottom: 1rem; font-weight: 600;">Ou entrez le code manuellement :</p>
                    <div style="display: flex; gap: 0.5rem; max-width: 400px; margin: 0 auto;">
                        <input type="text" id="manualBarcode" class="input" placeholder="Ex: 3017620422003" style="flex: 1;">
                        <button class="btn" onclick="window.searchManualBarcode()">
                            <span class="material-icons">search</span>
                            Rechercher
                        </button>
                    </div>
                </div>
                
                <!-- Résultats du scan -->
                <div id="scanResult" style="display: none;">
                    <h3 style="margin-bottom: 1rem;">Produit trouvé !</h3>
                    
                    <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <div style="display: flex; gap: 1rem;">
                            <img id="productImage" src="" style="width: 100px; height: 100px; object-fit: contain; border-radius: 8px; background: white;">
                            <div style="flex: 1;">
                                <h4 id="productName" style="margin-bottom: 0.5rem;"></h4>
                                <p id="productBrand" style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;"></p>
                                <p id="productBarcode" style="font-family: monospace; font-size: 0.875rem; color: var(--text-secondary);"></p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Informations nutritionnelles (si disponibles) -->
                    <div id="nutritionInfo" style="display: none; background: var(--bg-tertiary); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <h4 style="margin-bottom: 0.5rem;">Informations nutritionnelles</h4>
                        <div id="nutritionDetails" style="font-size: 0.875rem; color: var(--text-secondary);"></div>
                    </div>
                    
                    <!-- Prix et ajout à la dépense -->
                    <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;">
                        <h4 style="margin-bottom: 1rem;">Ajouter aux dépenses</h4>
                        <div style="display: grid; gap: 1rem;">
                            <div>
                                <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Prix :</label>
                                <input type="number" id="productPrice" class="input" step="0.01" placeholder="0.00 €">
                            </div>
                            
                            <div>
                                <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Quantité :</label>
                                <input type="number" id="productQuantity" class="input" value="1" min="1">
                            </div>
                            
                            <div>
                                <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Attribuer à :</label>
                                <select id="assignProductTo" class="input">
                                    <!-- Options ajoutées dynamiquement -->
                                </select>
                            </div>
                            
                            <!-- Si dépense commune, sélection des participants -->
                            <div id="productCommonParticipants" style="display: none;">
                                <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Participants :</label>
                                <div id="productParticipantsCheckboxes" style="background: var(--bg-tertiary); border-radius: 8px; padding: 0.75rem;">
                                    <!-- Les participants seront ajoutés dynamiquement -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Message d'erreur -->
                <div id="scanError" style="display: none; text-align: center; padding: 2rem; background: var(--bg-tertiary); border-radius: 8px;">
                    <span class="material-icons" style="font-size: 48px; color: var(--danger); margin-bottom: 1rem; display: block;">error_outline</span>
                    <h4 style="margin-bottom: 0.5rem;">Produit non trouvé</h4>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">Le code-barres <span id="errorBarcode" style="font-family: monospace;"></span> n'a pas été trouvé dans la base de données.</p>
                    <button class="btn" onclick="window.resetScanner()" style="margin-top: 1rem;">
                        <span class="material-icons">refresh</span>
                        Réessayer
                    </button>
                </div>
            </div>
            <div class="modal-footer" style="position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-secondary); border-top: 1px solid var(--border); padding: 1rem; display: flex; justify-content: flex-end; gap: 1rem; z-index: 10;">
                <button class="btn btn-danger" onclick="window.closeBarcodeModal()">Annuler</button>
                <button id="addScannedProduct" class="btn" style="display: none;" onclick="window.addScannedProduct()">
                    <span class="material-icons">add</span>
                    Ajouter la dépense
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Remplir le select des utilisateurs
    const assignSelect = document.getElementById('assignProductTo');
    let optionsHTML = '<option value="">Choisir...</option>';
    optionsHTML += '<option value="commun">🏠 Dépense commune</option>';
    
    // Ajouter les utilisateurs (sauf commun)
    const users = Object.entries(window.appData.users || {}).filter(([id]) => id !== 'commun');
    users.forEach(([id, user]) => {
        optionsHTML += `<option value="${id}">👤 ${user.name}</option>`;
    });
    
    assignSelect.innerHTML = optionsHTML;
    
    // Gérer le changement d'attribution
    assignSelect.addEventListener('change', function() {
        const commonParticipants = document.getElementById('productCommonParticipants');
        const participantsCheckboxes = document.getElementById('productParticipantsCheckboxes');
        
        if (this.value === 'commun') {
            // Afficher et remplir les participants
            commonParticipants.style.display = 'block';
            
            // Générer les checkboxes des participants
            const users = Object.entries(window.appData.users || {})
                .filter(([id]) => id !== 'commun');
            
            if (users.length > 0) {
                participantsCheckboxes.innerHTML = users.map(([id, user]) => `
                    <div style="margin-bottom: 0.5rem;">
                        <input type="checkbox" id="participant_product_${id}" value="${id}" checked>
                        <label for="participant_product_${id}">${user.name}</label>
                    </div>
                `).join('');
            } else {
                participantsCheckboxes.innerHTML = '<div style="color: var(--text-secondary);">Aucun utilisateur disponible. Créez d\'abord des utilisateurs.</div>';
            }
        } else {
            commonParticipants.style.display = 'none';
        }
    });
    
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
    
    // Démarrer le scanner
    setTimeout(() => {
        window.startBarcodeScanner();
    }, 500);
};

// Démarrer le scanner de code-barres
window.startBarcodeScanner = function() {
    // Vérifier que Quagga est chargé
    if (!window.Quagga) {
        setTimeout(window.startBarcodeScanner, 500);
        return;
    }
    
    window.isScannerActive = true;
    
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment" // Caméra arrière sur mobile
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
            readers: [
                "ean_reader",        // EAN-13 (codes-barres européens)
                "ean_8_reader",      // EAN-8
                "code_128_reader",   // Code 128
                "code_39_reader",    // Code 39
                "upc_reader",        // UPC (codes-barres américains)
                "upc_e_reader"       // UPC-E
            ]
        },
        locate: true
    }, function(err) {
        if (err) {
            console.error('Erreur Quagga:', err);
            // Afficher un message d'erreur
            document.querySelector('#scanner').innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-primary);">
                    <span class="material-icons" style="font-size: 48px; color: var(--danger); margin-bottom: 1rem; display: block;">videocam_off</span>
                    <h4>Impossible d'accéder à la caméra</h4>
                    <p style="margin-top: 1rem; color: var(--text-secondary);">
                        Veuillez autoriser l'accès à la caméra ou utilisez la saisie manuelle.
                    </p>
                </div>
            `;
            return;
        }
        
        console.log("Scanner initialisé avec succès");
        Quagga.start();
        
        // Ajouter un cadre de visée
        const scanner = document.querySelector('#scanner');
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            height: 100px;
            border: 2px solid rgba(46, 204, 113, 0.8);
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
            border-radius: 8px;
            pointer-events: none;
            z-index: 10;
        `;
        overlay.innerHTML = `
            <div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: rgba(46, 204, 113, 0.9); color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.875rem;">
                Alignez le code-barres ici
            </div>
        `;
        scanner.appendChild(overlay);
    });
    
    // Écouter les détections
    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        console.log('Code-barres détecté:', code);
        
        // Vibrer si disponible
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
        
        // Arrêter le scanner
        Quagga.stop();
        window.isScannerActive = false;
        
        // Rechercher le produit
        window.searchProduct(code);
    });
};

// Recherche manuelle de code-barres
window.searchManualBarcode = function() {
    const code = document.getElementById('manualBarcode').value.trim();
    if (code) {
        window.searchProduct(code);
    }
};

// Rechercher le produit dans la base de données
window.searchProduct = async function(barcode) {
    console.log('Recherche du produit:', barcode);
    
    // Masquer le scanner et afficher un loader
    document.getElementById('scannerContainer').style.display = 'none';
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('scanError').style.display = 'none';
    
    // Afficher un loader
    const loader = document.createElement('div');
    loader.id = 'productLoader';
    loader.style.cssText = 'text-align: center; padding: 2rem;';
    loader.innerHTML = `
        <div class="spinner" style="width: 48px; height: 48px; border: 4px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
        <p>Recherche du produit...</p>
    `;
    document.querySelector('#barcodeModal .modal-body').insertBefore(loader, document.getElementById('scanResult'));
    
    try {
        // Utiliser l'API OpenFoodFacts (gratuite et sans clé API)
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        const data = await response.json();
        
        loader.remove();
        
        if (data.status === 1 && data.product) {
            // Produit trouvé
            window.displayProduct(data.product, barcode);
        } else {
            // Produit non trouvé - essayer avec une autre API ou afficher erreur
            window.displayProductNotFound(barcode);
        }
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        loader.remove();
        window.displayProductNotFound(barcode);
    }
};

// Afficher les informations du produit
window.displayProduct = function(product, barcode) {
    console.log('Produit trouvé:', product);
    
    // Extraire les informations
    const name = product.product_name || product.product_name_fr || 'Produit sans nom';
    const brand = product.brands || '';
    const image = product.image_url || product.image_front_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMEYwIi8+CjxwYXRoIGQ9Ik00MCA0MEg2MFY2MEg0MFY0MFoiIGZpbGw9IiNDQ0NDQ0MiLz4KPC9zdmc+';
    
    // Afficher les résultats
    document.getElementById('productImage').src = image;
    document.getElementById('productName').textContent = name;
    document.getElementById('productBrand').textContent = brand;
    document.getElementById('productBarcode').textContent = `Code: ${barcode}`;
    
    // Informations nutritionnelles
    if (product.nutriments) {
        const nutrition = product.nutriments;
        let nutritionHTML = '<div style="display: grid; grid-template-columns: 1fr auto; gap: 0.5rem;">';
        
        if (nutrition['energy-kcal_100g']) {
            nutritionHTML += `<span>Calories (100g):</span><span>${Math.round(nutrition['energy-kcal_100g'])} kcal</span>`;
        }
        if (nutrition.proteins_100g !== undefined) {
            nutritionHTML += `<span>Protéines:</span><span>${nutrition.proteins_100g.toFixed(1)}g</span>`;
        }
        if (nutrition.carbohydrates_100g !== undefined) {
            nutritionHTML += `<span>Glucides:</span><span>${nutrition.carbohydrates_100g.toFixed(1)}g</span>`;
        }
        if (nutrition.fat_100g !== undefined) {
            nutritionHTML += `<span>Lipides:</span><span>${nutrition.fat_100g.toFixed(1)}g</span>`;
        }
        
        nutritionHTML += '</div>';
        
        if (nutrition['energy-kcal_100g'] || nutrition.proteins_100g !== undefined) {
            document.getElementById('nutritionDetails').innerHTML = nutritionHTML;
            document.getElementById('nutritionInfo').style.display = 'block';
        }
    }
    
    // Afficher la zone de résultat
    document.getElementById('scanResult').style.display = 'block';
    document.getElementById('addScannedProduct').style.display = 'inline-flex';
    
    // Stocker les données du produit
    window.scannedProductData = {
        barcode: barcode,
        name: name,
        brand: brand,
        image: image,
        product: product
    };
    
    // Focus sur le champ prix
    document.getElementById('productPrice').focus();
};

// Afficher l'erreur si produit non trouvé
window.displayProductNotFound = function(barcode) {
    document.getElementById('errorBarcode').textContent = barcode;
    document.getElementById('scanError').style.display = 'block';
};

// Réinitialiser le scanner
window.resetScanner = function() {
    document.getElementById('scannerContainer').style.display = 'block';
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('scanError').style.display = 'none';
    document.getElementById('manualBarcode').value = '';
    
    // Redémarrer le scanner
    window.startBarcodeScanner();
};

// Ajouter le produit scanné aux dépenses
window.addScannedProduct = function() {
    const price = parseFloat(document.getElementById('productPrice').value);
    const quantity = parseInt(document.getElementById('productQuantity').value) || 1;
    const assignTo = document.getElementById('assignProductTo').value;
    
    if (!price || price <= 0) {
        alert('Veuillez entrer un prix valide');
        return;
    }
    
    if (!assignTo) {
        alert('Veuillez choisir à qui attribuer cette dépense');
        return;
    }
    
    // Calculer le montant total
    const totalAmount = price * quantity;
    
    // Créer la description de la dépense
    const description = quantity > 1 
        ? `${window.scannedProductData.name} x${quantity}`
        : window.scannedProductData.name;
    
    // Récupérer appData
    let data = window.appData;
    if (!data) {
        alert('Erreur: Les données de l\'application ne sont pas accessibles. Rechargez la page.');
        return;
    }
    
    if (assignTo === 'commun') {
        // Dépense commune
        const participants = [];
        document.querySelectorAll('#productCommonParticipants input[type="checkbox"]:checked').forEach(checkbox => {
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
            amount: totalAmount,
            participants: participants,
            date: new Date().toISOString(),
            barcode: window.scannedProductData.barcode,
            product: {
                name: window.scannedProductData.name,
                brand: window.scannedProductData.brand,
                image: window.scannedProductData.image
            }
        });
        
        console.log('Dépense commune ajoutée:', data.commonExpenses);
    } else {
        // Dépense individuelle
        if (!data.users || !data.users[assignTo]) {
            alert('Erreur: Utilisateur non trouvé');
            return;
        }
        
        if (!data.users[assignTo].expenses) {
            data.users[assignTo].expenses = [];
        }
        
        const newExpense = {
            name: description,
            amount: totalAmount,
            date: new Date().toISOString(),
            barcode: window.scannedProductData.barcode,
            product: {
                name: window.scannedProductData.name,
                brand: window.scannedProductData.brand,
                image: window.scannedProductData.image,
                quantity: quantity,
                unitPrice: price
            }
        };
        
        data.users[assignTo].expenses.push(newExpense);
        console.log('Dépense ajoutée à', data.users[assignTo].name, ':', newExpense);
    }
    
    // Sauvegarder
    window.appData = data;
    
    // Essayer plusieurs méthodes de sauvegarde
    if (typeof window.saveData === 'function') {
        window.saveData();
    } else {
        localStorage.setItem('expenseTrackerData', JSON.stringify(data));
    }
    
    // Rafraîchir l'affichage
    if (typeof window.renderApp === 'function') {
        window.renderApp();
    }
    
    // Fermer le modal
    window.closeBarcodeModal();
    
    // Message de succès
    const message = `Produit ajouté : ${totalAmount.toFixed(2)}€ ${assignTo === 'commun' ? 'aux dépenses communes' : 'à ' + data.users[assignTo].name}`;
    
    // Créer un message de succès
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
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    toast.innerHTML = `
        <span class="material-icons">check_circle</span>
        ${message}
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// Fermer le modal
window.closeBarcodeModal = function() {
    // Arrêter le scanner si actif
    if (window.isScannerActive && window.Quagga) {
        Quagga.stop();
        window.isScannerActive = false;
    }
    
    const modal = document.getElementById('barcodeModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    
    window.scannedProductData = null;
};

// Exposer la fonction principale
window.scanProduct = window.scanBarcode;

console.log('Module Scanner de codes-barres chargé avec succès');