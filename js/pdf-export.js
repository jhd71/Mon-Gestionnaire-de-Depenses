// pdf-export.js - Export des données en PDF

// Fonction principale d'export PDF
function exportToPDF() {
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configuration
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;
    
    // En-tête
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Bleu primary
    doc.text('Gestionnaire de Dépenses', 20, y);
    
    // Date du rapport
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`, 20, y);
    
    // Ligne de séparation
    y += 5;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    
    // Résumé global
    y += 15;
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Résumé Global', 20, y);
    
    // Calculer les totaux
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    Object.values(appData.users).forEach(user => {
        totalRevenue += user.incomes.reduce((sum, item) => sum + item.amount, 0);
        totalExpenses += user.expenses.reduce((sum, item) => sum + item.amount, 0);
    });
    
    const totalCommonExpenses = appData.commonExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Afficher les totaux
    y += 10;
    doc.setFontSize(12);
    doc.text(`Total des revenus: ${totalRevenue.toFixed(2)}€`, 30, y);
    y += 7;
    doc.text(`Total des dépenses: ${(totalExpenses + totalCommonExpenses).toFixed(2)}€`, 30, y);
    y += 7;
    doc.setTextColor(totalRevenue - totalExpenses - totalCommonExpenses >= 0 ? 0 : 255, 
                     totalRevenue - totalExpenses - totalCommonExpenses >= 0 ? 150 : 0, 0);
    doc.text(`Solde global: ${(totalRevenue - totalExpenses - totalCommonExpenses).toFixed(2)}€`, 30, y);
    
    // Détails par utilisateur
    y += 20;
    
    Object.entries(appData.users).forEach(([userId, user]) => {
        // Vérifier si on doit changer de page
        if (y > pageHeight - 50) {
            doc.addPage();
            y = 20;
        }
        
        // Nom de l'utilisateur
        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.text(user.name, 20, y);
        y += 10;
        
        // Revenus
        if (user.incomes.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(0, 150, 0);
            doc.text('Revenus:', 30, y);
            y += 7;
            
            doc.setFontSize(10);
            doc.setTextColor(0);
            user.incomes.forEach(income => {
                doc.text(`• ${income.name}: +${income.amount.toFixed(2)}€`, 35, y);
                y += 5;
            });
            y += 5;
        }
        
        // Dépenses
        if (user.expenses.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(255, 0, 0);
            doc.text('Dépenses:', 30, y);
            y += 7;
            
            doc.setFontSize(10);
            doc.setTextColor(0);
            
            // Grouper par catégorie
            const expensesByCategory = {};
            user.expenses.forEach(expense => {
                const cat = expense.category || 'autre';
                if (!expensesByCategory[cat]) {
                    expensesByCategory[cat] = [];
                }
                expensesByCategory[cat].push(expense);
            });
            
            Object.entries(expensesByCategory).forEach(([catId, expenses]) => {
                const category = appData.categories.find(c => c.id === catId) || { name: 'Autre', icon: '📦' };
                const catTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
                
                doc.text(`${category.icon} ${category.name}: -${catTotal.toFixed(2)}€`, 35, y);
                y += 5;
                
                expenses.forEach(expense => {
                    doc.setFontSize(9);
                    doc.text(`  - ${expense.name}: ${expense.amount.toFixed(2)}€`, 40, y);
                    y += 4;
                });
                y += 3;
                doc.setFontSize(10);
            });
        }
        
        // Solde de l'utilisateur
        const userIncome = user.incomes.reduce((sum, item) => sum + item.amount, 0);
        const userExpense = user.expenses.reduce((sum, item) => sum + item.amount, 0);
        let userCommonShare = 0;
        
        if (userId !== 'commun') {
            appData.commonExpenses.forEach(expense => {
                if (expense.participants.includes(userId)) {
                    userCommonShare += expense.amount / expense.participants.length;
                }
            });
        }
        
        const userBalance = userIncome - userExpense - userCommonShare;
        
        doc.setFontSize(11);
        doc.setTextColor(userBalance >= 0 ? 0 : 255, userBalance >= 0 ? 150 : 0, 0);
        doc.text(`Solde ${user.name}: ${userBalance.toFixed(2)}€`, 30, y);
        y += 15;
    });
    
    // Dépenses communes
    if (appData.commonExpenses.length > 0) {
        if (y > pageHeight - 50) {
            doc.addPage();
            y = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.text('Dépenses Communes', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0);
        
        appData.commonExpenses.forEach(expense => {
            const participants = expense.participants.map(p => appData.users[p].name).join(', ');
            const sharePerPerson = expense.amount / expense.participants.length;
            
            doc.text(`• ${expense.name}: ${expense.amount.toFixed(2)}€`, 30, y);
            y += 5;
            doc.setFontSize(9);
            doc.text(`  Partagé entre: ${participants} (${sharePerPerson.toFixed(2)}€/pers)`, 35, y);
            y += 7;
            doc.setFontSize(10);
        });
    }
    
    // Pied de page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} / ${pageCount}`, 105, 290, { align: 'center' });
        doc.text('Généré par Gestionnaire de Dépenses', 105, 285, { align: 'center' });
    }
    
    // Sauvegarder le PDF
    const fileName = `depenses_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    // Message de succès
    showSuccessMessage(`PDF exporté: ${fileName}`);
}

// Export détaillé avec graphiques (nécessite Chart.js)
async function exportDetailedPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Générer des graphiques en canvas
    const chartCanvas = await generateCategoryChart();
    
    // Ajouter le graphique au PDF
    if (chartCanvas) {
        const imgData = chartCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 20, 50, 170, 100);
    }
    
    // ... reste du PDF avec graphiques
    
    doc.save(`rapport_detaille_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Générer un graphique des catégories
async function generateCategoryChart() {
    // Créer un canvas temporaire
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    // Obtenir les données par catégorie
    const categoryData = getExpensesByCategory('all');
    const labels = [];
    const data = [];
    const colors = [];
    
    appData.categories.forEach(cat => {
        if (categoryData[cat.id] > 0) {
            labels.push(`${cat.icon} ${cat.name}`);
            data.push(categoryData[cat.id]);
            colors.push(cat.color);
        }
    });
    
    // Si Chart.js est disponible
    if (window.Chart) {
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
        
        // Attendre que le graphique soit rendu
        await new Promise(resolve => setTimeout(resolve, 100));
        return canvas;
    }
    
    return null;
}