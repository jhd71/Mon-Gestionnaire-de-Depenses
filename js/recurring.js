// recurring.js - Gestion des dépenses et revenus récurrents

// Ajouter une dépense récurrente
window.addRecurringItem = function() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'recurringModal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <span class="material-icons" style="margin-right: 0.5rem;">repeat</span>
                Ajouter une transaction récurrente
            </div>
            <div class="modal-body">
                <div style="display: grid; gap: 1rem;">
                    <!-- Type -->
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Type</label>
                        <select id="recurringType" class="input" onchange="window.updateRecurringForm()">
                            <option value="expense">Dépense</option>
                            <option value="income">Revenu</option>
                        </select>
                    </div>
                    
                    <!-- Utilisateur -->
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Pour</label>
                        <select id="recurringUser" class="input">
                            ${window.appData && window.appData.users ? 
                                Object.entries(window.appData.users).map(([id, user]) => 
                                    `<option value="${id}">${user.name}</option>`
                                ).join('') : 
                                '<option value="">Aucun utilisateur</option>'
                            }
                        </select>
                    </div>
                    
                    <!-- Description -->
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Description</label>
                        <input type="text" id="recurringName" class="input" placeholder="Ex: Loyer, Salaire...">
                    </div>
                    
                    <!-- Montant -->
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Montant</label>
                        <input type="number" id="recurringAmount" class="input" step="0.01" placeholder="0.00">
                    </div>
                    
                    <!-- Catégorie (pour les dépenses) -->
                    <div id="categoryDiv">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Catégorie</label>
                        <select id="recurringCategory" class="input">
                            ${window.appData && window.appData.categories ? 
                                window.appData.categories.map(cat => 
                                    `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
                                ).join('') :
                                '<option value="autre">📦 Autre</option>'
                            }
                        </select>
                    </div>
                    
                    <!-- Fréquence -->
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Fréquence</label>
                        <select id="recurringFrequency" class="input">
                            <option value="daily">Quotidien</option>
                            <option value="weekly">Hebdomadaire</option>
                            <option value="monthly" selected>Mensuel</option>
                            <option value="quarterly">Trimestriel</option>
                            <option value="yearly">Annuel</option>
                        </select>
                    </div>
                    
                    <!-- Date de début -->
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Première échéance</label>
                        <input type="date" id="recurringStartDate" class="input" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    
                    <!-- Auto-ajout -->
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="recurringAutoAdd" checked>
                        <label for="recurringAutoAdd">Ajouter automatiquement à chaque échéance</label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="window.closeModal('recurringModal')">Annuler</button>
                <button class="btn" onclick="window.confirmAddRecurring()">
                    <span class="material-icons">add</span>
                    Créer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// Mettre à jour le formulaire selon le type
window.updateRecurringForm = function() {
    const type = document.getElementById('recurringType').value;
    const categoryDiv = document.getElementById('categoryDiv');
    
    if (type === 'income') {
        categoryDiv.style.display = 'none';
    } else {
        categoryDiv.style.display = 'block';
    }
}

// Confirmer l'ajout d'une transaction récurrente
window.confirmAddRecurring = function() {
    const recurring = {
        id: 'recurring_' + Date.now(),
        type: document.getElementById('recurringType').value,
        userId: document.getElementById('recurringUser').value,
        name: document.getElementById('recurringName').value,
        amount: parseFloat(document.getElementById('recurringAmount').value),
        category: document.getElementById('recurringCategory')?.value,
        frequency: document.getElementById('recurringFrequency').value,
        startDate: document.getElementById('recurringStartDate').value,
        autoAdd: document.getElementById('recurringAutoAdd').checked,
        lastAdded: null,
        active: true
    };
    
    console.log('Données récurrentes:', recurring); // Debug
    
    if (!recurring.name || isNaN(recurring.amount) || recurring.amount <= 0) {
        alert('Veuillez remplir tous les champs requis (nom et montant valide)');
        return;
    }
    
    // S'assurer que les catégories existent
    if (!window.appData.categories || window.appData.categories.length === 0) {
        window.appData.categories = [
            { id: 'alimentation', name: 'Alimentation', icon: '🛒', color: '#10b981' },
            { id: 'transport', name: 'Transport', icon: '🚗', color: '#3b82f6' },
            { id: 'logement', name: 'Logement', icon: '🏠', color: '#8b5cf6' },
            { id: 'sante', name: 'Santé', icon: '💊', color: '#ef4444' },
            { id: 'loisirs', name: 'Loisirs', icon: '🎮', color: '#f59e0b' },
            { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#ec4899' },
            { id: 'factures', name: 'Factures', icon: '📄', color: '#6366f1' },
            { id: 'education', name: 'Éducation', icon: '📚', color: '#14b8a6' },
            { id: 'restaurant', name: 'Restaurant', icon: '🍽️', color: '#f97316' },
            { id: 'autre', name: 'Autre', icon: '📦', color: '#6b7280' }
        ];
    }
    
    // Ajouter à la liste des récurrences
    if (!window.appData.recurringItems) {
        window.appData.recurringItems = [];
    }
    window.appData.recurringItems.push(recurring);
    
    window.saveData();
    window.closeModal('recurringModal');
    
    // Vérifier si on doit ajouter immédiatement
    window.checkAndAddRecurringItems();
    
    window.showSuccessMessage('Transaction récurrente créée !');
    
    // Afficher la liste mise à jour
    window.showRecurringListModal();
}

// Vérifier et ajouter les transactions récurrentes échues
window.checkAndAddRecurringItems = function() {
    if (!window.appData.recurringItems) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    window.appData.recurringItems.forEach(recurring => {
        if (!recurring.active || !recurring.autoAdd) return;
        
        const nextDate = window.calculateNextDate(recurring);
        
        if (nextDate <= today) {
            // Ajouter la transaction
            if (recurring.type === 'expense') {
                window.appData.users[recurring.userId].expenses.push({
                    name: `${recurring.name} (automatique)`,
                    amount: recurring.amount,
                    category: recurring.category,
                    date: new Date().toISOString(),
                    recurring: true,
                    recurringId: recurring.id
                });
            } else {
                window.appData.users[recurring.userId].incomes.push({
                    name: `${recurring.name} (automatique)`,
                    amount: recurring.amount,
                    date: new Date().toISOString(),
                    recurring: true,
                    recurringId: recurring.id
                });
            }
            
            // Mettre à jour la date de dernier ajout
            recurring.lastAdded = new Date().toISOString();
            
            console.log(`Transaction récurrente ajoutée: ${recurring.name}`);
        }
    });
    
    window.saveData();
    window.renderApp();
}

// Calculer la prochaine date d'échéance
window.calculateNextDate = function(recurring) {
    const startDate = new Date(recurring.startDate);
    const lastAdded = recurring.lastAdded ? new Date(recurring.lastAdded) : null;
    const baseDate = lastAdded || startDate;
    
    const nextDate = new Date(baseDate);
    
    switch (recurring.frequency) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
        case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
    }
    
    return nextDate;
}

// Afficher la liste des transactions récurrentes
window.showRecurringListModal = function() {
    // Fermer le modal existant s'il existe
    const existingModal = document.getElementById('recurringListModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'recurringListModal';
    
    const recurringItems = window.appData.recurringItems || [];
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <span class="material-icons" style="margin-right: 0.5rem;">repeat</span>
                Transactions récurrentes
            </div>
            <div class="modal-body">
                <button class="btn" onclick="window.addRecurringItem()" style="margin-bottom: 1rem;">
                    <span class="material-icons">add</span>
                    Nouvelle transaction récurrente
                </button>
                
                ${recurringItems.length === 0 ? 
                    '<div class="empty-state">Aucune transaction récurrente</div>' :
                    `<div class="items-list">
                        ${recurringItems.map(item => {
                            const user = window.appData.users[item.userId];
                            if (!user) return ''; // Si l'utilisateur n'existe plus
                            
                            const nextDate = window.calculateNextDate(item);
                            const category = window.appData.categories ? 
                                window.appData.categories.find(c => c.id === item.category) : null;
                            
                            return `
                                <div class="item" style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 0.5rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: start;">
                                        <div>
                                            <div style="font-weight: 600; margin-bottom: 0.25rem;">
                                                ${item.name}
                                                ${item.type === 'expense' && category ? `<span style="font-size: 0.875rem;">${category.icon}</span>` : ''}
                                            </div>
                                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                                ${user.name} • ${item.frequency === 'daily' ? 'Quotidien' :
                                                               item.frequency === 'weekly' ? 'Hebdomadaire' :
                                                               item.frequency === 'monthly' ? 'Mensuel' :
                                                               item.frequency === 'quarterly' ? 'Trimestriel' : 'Annuel'}
                                            </div>
                                            <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                                Prochaine: ${nextDate.toLocaleDateString('fr-FR')}
                                                ${item.autoAdd ? ' • ✅ Auto' : ' • ⏸️ Manuel'}
                                            </div>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <span class="item-amount ${item.type}" style="font-size: 1.125rem;">
                                                ${item.type === 'income' ? '+' : '-'}${item.amount.toFixed(2)}€
                                            </span>
                                            <button class="btn btn-small btn-danger" onclick="window.deleteRecurring('${item.id}')">×</button>
                                        </div>
                                    </div>
                                    <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                                        <button class="btn btn-small" onclick="window.toggleRecurringActive('${item.id}')">
                                            ${item.active ? 'Désactiver' : 'Activer'}
                                        </button>
                                        ${!item.autoAdd ? 
                                            `<button class="btn btn-small" onclick="window.addRecurringNow('${item.id}')">
                                                Ajouter maintenant
                                            </button>` : ''
                                        }
                                    </div>
                                </div>
                            `;
                        }).filter(html => html !== '').join('')}
                    </div>`
                }
            </div>
            <div class="modal-footer">
                <button class="btn" onclick="window.closeModal('recurringListModal')">Fermer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// Supprimer une transaction récurrente
window.deleteRecurring = function(id) {
    if (confirm('Supprimer cette transaction récurrente ?')) {
        window.appData.recurringItems = window.appData.recurringItems.filter(item => item.id !== id);
        window.saveData();
        window.closeModal('recurringListModal');
        window.showRecurringListModal();
    }
}

// Activer/Désactiver une transaction récurrente
window.toggleRecurringActive = function(id) {
    const item = window.appData.recurringItems.find(r => r.id === id);
    if (item) {
        item.active = !item.active;
        window.saveData();
        window.closeModal('recurringListModal');
        window.showRecurringListModal();
    }
}

// Ajouter manuellement une transaction récurrente
window.addRecurringNow = function(id) {
    const recurring = window.appData.recurringItems.find(r => r.id === id);
    if (!recurring) return;
    
    if (recurring.type === 'expense') {
        window.appData.users[recurring.userId].expenses.push({
            name: recurring.name,
            amount: recurring.amount,
            category: recurring.category,
            date: new Date().toISOString(),
            recurring: true,
            recurringId: recurring.id
        });
    } else {
        window.appData.users[recurring.userId].incomes.push({
            name: recurring.name,
            amount: recurring.amount,
            date: new Date().toISOString(),
            recurring: true,
            recurringId: recurring.id
        });
    }
    
    recurring.lastAdded = new Date().toISOString();
    window.saveData();
    window.renderApp();
    
    window.closeModal('recurringListModal');
    window.showSuccessMessage('Transaction ajoutée !');
}

// Vérifier les récurrences au démarrage
document.addEventListener('DOMContentLoaded', () => {
    // Attendre 2 secondes puis vérifier
    setTimeout(() => {
        if (typeof window.checkAndAddRecurringItems === 'function') {
            window.checkAndAddRecurringItems();
        }
    }, 2000);
    
    // Vérifier toutes les heures
    setInterval(() => {
        if (typeof window.checkAndAddRecurringItems === 'function') {
            window.checkAndAddRecurringItems();
        }
    }, 60 * 60 * 1000);
});