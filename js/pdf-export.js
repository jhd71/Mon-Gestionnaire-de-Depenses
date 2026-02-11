// pdf-export.js - Export PDF professionnel v2
// Compatible avec jsPDF 2.5.1

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // ============================================
    // CONFIGURATION & COULEURS
    // ============================================
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 0;
    
    // Palette de couleurs
    const colors = {
        primary: [99, 102, 241],
        primaryDark: [67, 56, 202],
        success: [16, 185, 129],
        danger: [239, 68, 68],
        warning: [245, 158, 11],
        text: [31, 41, 55],
        textLight: [107, 114, 128],
        textMuted: [156, 163, 175],
        bgLight: [243, 244, 246],
        bgCard: [249, 250, 251],
        white: [255, 255, 255],
        line: [229, 231, 235],
        headerBg: [238, 242, 255],
    };
    
    // ============================================
    // FONCTIONS UTILITAIRES
    // ============================================
    
    function setColor(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function setFill(c) { doc.setFillColor(c[0], c[1], c[2]); }
    function setDraw(c) { doc.setDrawColor(c[0], c[1], c[2]); }
    
    function checkPageBreak(needed) {
        if (y + needed > pageHeight - 25) {
            doc.addPage();
            y = 20;
            return true;
        }
        return false;
    }
    
    function drawLine(yPos, color) {
        setDraw(color || colors.line);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
    }
    
    function fmt(amount) {
        return amount.toFixed(2).replace('.', ',') + ' \u20AC';
    }
    
    function drawRect(x, yPos, w, h, r, fillColor, borderColor) {
        if (fillColor) {
            setFill(fillColor);
            doc.roundedRect(x, yPos, w, h, r, r, 'F');
        }
        if (borderColor) {
            setDraw(borderColor);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, yPos, w, h, r, r, 'S');
        }
    }
    
    // ============================================
    // EN-TETE
    // ============================================
    
    // Bande coloree
    setFill(colors.primary);
    doc.rect(0, 0, pageWidth, 38, 'F');
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    setColor(colors.white);
    doc.text('Gestionnaire de D\u00e9penses', margin + 2, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text('Rapport g\u00e9n\u00e9r\u00e9 le ' + dateStr, margin + 2, 28);
    
    const realUsers = Object.keys(appData.users).filter(function(id) { return id !== 'commun'; });
    const userCount = realUsers.length;
    doc.text(userCount + ' participant' + (userCount > 1 ? 's' : ''), pageWidth - margin - 2, 28, { align: 'right' });
    
    y = 48;
    
    // ============================================
    // SECTION 1: BALANCE - QUI DOIT QUOI ?
    // ============================================
    
    if (userCount >= 2) {
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        setColor(colors.primaryDark);
        doc.text('Balance : Qui doit quoi ?', margin, y);
        y += 3;
        drawLine(y, colors.primary);
        y += 8;
        
        const debts = calculateDebts();
        
        if (debts.length === 0) {
            drawRect(margin, y, contentWidth, 18, 3, [236, 253, 245], [16, 185, 129]);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            setColor(colors.success);
            doc.text('Tout est equilibre ! Personne ne doit d\'argent.', margin + contentWidth / 2, y + 11, { align: 'center' });
            y += 25;
        } else {
            debts.forEach(function(debt) {
                checkPageBreak(28);
                
                var fromName = (appData.users[debt.from] || {}).name || 'Inconnu';
                var toName = (appData.users[debt.to] || {}).name || 'Inconnu';
                
                // Carte de dette
                drawRect(margin, y, contentWidth, 22, 3, colors.bgCard, colors.line);
                
                // Debiteur
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                setColor(colors.danger);
                doc.text(fromName, margin + 6, y + 9);
                
                // Fleche
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                setColor(colors.textLight);
                doc.text('doit payer a', margin + 6, y + 16);
                
                // Crediteur
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                setColor(colors.success);
                var tw = doc.getTextWidth('doit payer a ');
                doc.text(toName, margin + 6 + tw + 2, y + 16);
                
                // Montant
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                setColor(colors.danger);
                doc.text(fmt(debt.amount), pageWidth - margin - 6, y + 13, { align: 'right' });
                
                y += 27;
            });
            y += 3;
        }
    }
    
    // ============================================
    // SECTION 2: RESUME GLOBAL
    // ============================================
    
    checkPageBreak(50);
    
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    setColor(colors.primaryDark);
    doc.text('R\u00e9sum\u00e9 Global', margin, y);
    y += 3;
    drawLine(y, colors.primary);
    y += 8;
    
    var totalRevenue = 0;
    var totalPersonalExpenses = 0;
    
    Object.keys(appData.users).forEach(function(userId) {
        var user = appData.users[userId];
        if (userId !== 'commun') {
            totalRevenue += user.incomes.reduce(function(sum, item) { return sum + item.amount; }, 0);
            totalPersonalExpenses += user.expenses.reduce(function(sum, item) { return sum + item.amount; }, 0);
        }
    });
    
    var totalCommonExpenses = appData.commonExpenses.reduce(function(sum, exp) { return sum + exp.amount; }, 0);
    var totalAllExpenses = totalPersonalExpenses + totalCommonExpenses;
    var globalBalance = totalRevenue - totalAllExpenses;
    
    // 3 cartes de resume
    var cardW = (contentWidth - 8) / 3;
    var cardH = 28;
    var cardY = y;
    
    // Revenus
    drawRect(margin, cardY, cardW, cardH, 3, [236, 253, 245]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(colors.textLight);
    doc.text('Total Revenus', margin + cardW / 2, cardY + 10, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    setColor(colors.success);
    doc.text('+' + fmt(totalRevenue), margin + cardW / 2, cardY + 21, { align: 'center' });
    
    // Depenses
    var c2x = margin + cardW + 4;
    drawRect(c2x, cardY, cardW, cardH, 3, [254, 242, 242]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(colors.textLight);
    doc.text('Total D\u00e9penses', c2x + cardW / 2, cardY + 10, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    setColor(colors.danger);
    doc.text('-' + fmt(totalAllExpenses), c2x + cardW / 2, cardY + 21, { align: 'center' });
    
    // Solde
    var c3x = margin + (cardW + 4) * 2;
    var balBg = globalBalance >= 0 ? [236, 253, 245] : [254, 242, 242];
    drawRect(c3x, cardY, cardW, cardH, 3, balBg);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(colors.textLight);
    doc.text('Solde Global', c3x + cardW / 2, cardY + 10, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    setColor(globalBalance >= 0 ? colors.success : colors.danger);
    doc.text((globalBalance >= 0 ? '+' : '') + fmt(globalBalance), c3x + cardW / 2, cardY + 21, { align: 'center' });
    
    y = cardY + cardH + 12;
    
    // ============================================
    // SECTION 3: RESUME PAR PERSONNE
    // ============================================
    
    checkPageBreak(30);
    
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    setColor(colors.primaryDark);
    doc.text('D\u00e9tail par personne', margin, y);
    y += 3;
    drawLine(y, colors.primary);
    y += 6;
    
    // En-tete tableau
    var cw = [contentWidth * 0.25, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.15];
    var cx = [margin];
    for (var ci = 1; ci < cw.length; ci++) { cx.push(cx[ci - 1] + cw[ci - 1]); }
    
    drawRect(margin, y, contentWidth, 9, 2, colors.headerBg);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setColor(colors.text);
    doc.text('Personne', cx[0] + 3, y + 6);
    doc.text('Revenus', cx[1] + 3, y + 6);
    doc.text('D\u00e9p. perso', cx[2] + 3, y + 6);
    doc.text('Part commune', cx[3] + 3, y + 6);
    doc.text('Solde', cx[4] + 3, y + 6);
    y += 11;
    
    realUsers.forEach(function(userId, idx) {
        checkPageBreak(10);
        
        var user = appData.users[userId];
        var uIncome = user.incomes.reduce(function(s, i) { return s + i.amount; }, 0);
        var uExpense = user.expenses.reduce(function(s, e) { return s + e.amount; }, 0);
        
        var commonShare = 0;
        appData.commonExpenses.forEach(function(exp) {
            if (exp.participants.indexOf(userId) !== -1) {
                commonShare += exp.amount / exp.participants.length;
            }
        });
        
        var uBal = uIncome - uExpense - commonShare;
        
        if (idx % 2 === 0) {
            setFill(colors.bgCard);
            doc.rect(margin, y - 4, contentWidth, 8, 'F');
        }
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        setColor(colors.text);
        doc.text(user.name, cx[0] + 3, y + 1);
        
        doc.setFont('helvetica', 'normal');
        setColor(colors.success);
        doc.text('+' + fmt(uIncome), cx[1] + 3, y + 1);
        
        setColor(colors.danger);
        doc.text('-' + fmt(uExpense), cx[2] + 3, y + 1);
        
        setColor(colors.warning);
        doc.text('-' + fmt(commonShare), cx[3] + 3, y + 1);
        
        doc.setFont('helvetica', 'bold');
        setColor(uBal >= 0 ? colors.success : colors.danger);
        doc.text((uBal >= 0 ? '+' : '') + fmt(uBal), cx[4] + 3, y + 1);
        
        y += 8;
    });
    
    y += 8;
    
    // ============================================
    // SECTION 4: DEPENSES COMMUNES
    // ============================================
    
    if (appData.commonExpenses.length > 0) {
        checkPageBreak(35);
        
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        setColor(colors.primaryDark);
        doc.text('D\u00e9penses Communes', margin, y);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        setColor(colors.textLight);
        doc.text('Total : ' + fmt(totalCommonExpenses), pageWidth - margin, y, { align: 'right' });
        
        y += 3;
        drawLine(y, colors.primary);
        y += 6;
        
        // En-tete
        var ew = [contentWidth * 0.28, contentWidth * 0.17, contentWidth * 0.25, contentWidth * 0.15, contentWidth * 0.15];
        var ex = [margin];
        for (var ei = 1; ei < ew.length; ei++) { ex.push(ex[ei - 1] + ew[ei - 1]); }
        
        drawRect(margin, y, contentWidth, 9, 2, colors.headerBg);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        setColor(colors.text);
        doc.text('D\u00e9pense', ex[0] + 3, y + 6);
        doc.text('Pay\u00e9 par', ex[1] + 3, y + 6);
        doc.text('Participants', ex[2] + 3, y + 6);
        doc.text('Montant', ex[3] + 3, y + 6);
        doc.text('Par pers.', ex[4] + 3, y + 6);
        y += 11;
        
        appData.commonExpenses.forEach(function(expense, index) {
            checkPageBreak(10);
            
            var paidByName = (expense.paidBy && appData.users[expense.paidBy]) ? appData.users[expense.paidBy].name : 'N/D';
            var partNames = expense.participants.map(function(p) {
                return appData.users[p] ? appData.users[p].name : '?';
            }).join(', ');
            var perPerson = expense.participants.length > 0 ? expense.amount / expense.participants.length : expense.amount;
            
            if (index % 2 === 0) {
                setFill(colors.bgCard);
                doc.rect(margin, y - 4, contentWidth, 8, 'F');
            }
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            setColor(colors.text);
            
            var expName = expense.name;
            if (expName.length > 22) expName = expName.substring(0, 20) + '..';
            doc.text(expName, ex[0] + 3, y + 1);
            
            doc.setFont('helvetica', 'bold');
            setColor(colors.primary);
            doc.text(paidByName, ex[1] + 3, y + 1);
            
            doc.setFont('helvetica', 'normal');
            setColor(colors.textLight);
            var pt = partNames.length > 20 ? partNames.substring(0, 18) + '..' : partNames;
            doc.text(pt, ex[2] + 3, y + 1);
            
            doc.setFont('helvetica', 'bold');
            setColor(colors.danger);
            doc.text(fmt(expense.amount), ex[3] + 3, y + 1);
            
            doc.setFont('helvetica', 'normal');
            setColor(colors.textMuted);
            doc.text(fmt(perPerson), ex[4] + 3, y + 1);
            
            y += 8;
        });
        
        y += 8;
    }
    
    // ============================================
    // SECTION 5: DETAIL PAR UTILISATEUR
    // ============================================
    
    realUsers.forEach(function(userId) {
        var user = appData.users[userId];
        var hasIncomes = user.incomes.length > 0;
        var hasExpenses = user.expenses.length > 0;
        
        if (!hasIncomes && !hasExpenses) return;
        
        checkPageBreak(30);
        
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        setColor(colors.primaryDark);
        doc.text(user.name + ' - D\u00e9tails', margin, y);
        y += 3;
        drawLine(y, colors.primary);
        y += 6;
        
        // Revenus
        if (hasIncomes) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            setColor(colors.success);
            doc.text('Revenus', margin + 2, y);
            y += 6;
            
            user.incomes.forEach(function(income) {
                checkPageBreak(8);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                setColor(colors.text);
                doc.text('  - ' + income.name, margin + 6, y);
                doc.setFont('helvetica', 'bold');
                setColor(colors.success);
                doc.text('+' + fmt(income.amount), pageWidth - margin - 4, y, { align: 'right' });
                y += 6;
            });
            
            var totInc = user.incomes.reduce(function(s, i) { return s + i.amount; }, 0);
            drawLine(y - 2, colors.line);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            setColor(colors.success);
            doc.text('Total revenus : +' + fmt(totInc), pageWidth - margin - 4, y + 3, { align: 'right' });
            y += 10;
        }
        
        // Depenses
        if (hasExpenses) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            setColor(colors.danger);
            doc.text('D\u00e9penses personnelles', margin + 2, y);
            y += 6;
            
            user.expenses.forEach(function(expense) {
                checkPageBreak(8);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                setColor(colors.text);
                doc.text('  - ' + expense.name, margin + 6, y);
                doc.setFont('helvetica', 'bold');
                setColor(colors.danger);
                doc.text('-' + fmt(expense.amount), pageWidth - margin - 4, y, { align: 'right' });
                y += 6;
            });
            
            var totExp = user.expenses.reduce(function(s, e) { return s + e.amount; }, 0);
            drawLine(y - 2, colors.line);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            setColor(colors.danger);
            doc.text('Total d\u00e9penses : -' + fmt(totExp), pageWidth - margin - 4, y + 3, { align: 'right' });
            y += 12;
        }
    });
    
    // ============================================
    // SECTION 6: VIREMENTS
    // ============================================
    
    if (appData.transfers && appData.transfers.length > 0) {
        checkPageBreak(30);
        
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        setColor(colors.primaryDark);
        doc.text('Virements', margin, y);
        y += 3;
        drawLine(y, colors.primary);
        y += 8;
        
        appData.transfers.forEach(function(transfer, index) {
            checkPageBreak(12);
            
            var fromName = appData.users[transfer.from] ? appData.users[transfer.from].name : '?';
            var toName = appData.users[transfer.to] ? appData.users[transfer.to].name : '?';
            var isSettlement = transfer.isSettlement === true;
            
            if (index % 2 === 0) {
                setFill(colors.bgCard);
                doc.rect(margin, y - 4, contentWidth, 10, 'F');
            }
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            setColor(colors.text);
            doc.text((isSettlement ? '[Remboursement] ' : '') + transfer.description, margin + 3, y + 1);
            
            setColor(colors.textLight);
            var trText = isSettlement
                ? toName + ' a rembourse ' + fromName
                : fromName + ' -> ' + toName;
            doc.text(trText, margin + 80, y + 1);
            
            doc.setFont('helvetica', 'bold');
            setColor(isSettlement ? colors.success : colors.warning);
            doc.text(fmt(transfer.amount), pageWidth - margin - 4, y + 1, { align: 'right' });
            
            y += 10;
        });
        
        y += 5;
    }
    
    // ============================================
    // SECTION 7: REVENUS COMMUNS
    // ============================================
    
    if (appData.users.commun && appData.users.commun.incomes && appData.users.commun.incomes.length > 0) {
        checkPageBreak(25);
        
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        setColor(colors.primaryDark);
        doc.text('Revenus Communs', margin, y);
        y += 3;
        drawLine(y, colors.primary);
        y += 8;
        
        appData.users.commun.incomes.forEach(function(income) {
            checkPageBreak(8);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            setColor(colors.text);
            doc.text('  - ' + income.name, margin + 6, y);
            doc.setFont('helvetica', 'bold');
            setColor(colors.success);
            doc.text('+' + fmt(income.amount), pageWidth - margin - 4, y, { align: 'right' });
            y += 6;
        });
        
        y += 8;
    }
    
    // ============================================
    // PIEDS DE PAGE
    // ============================================
    
    var pageCount = doc.internal.getNumberOfPages();
    for (var p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        
        setDraw(colors.line);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        setColor(colors.textMuted);
        doc.text('Gestionnaire de D\u00e9penses - Rapport du ' + today.toLocaleDateString('fr-FR'), margin, pageHeight - 10);
        doc.text('Page ' + p + ' / ' + pageCount, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }
    
    // ============================================
    // SAUVEGARDE
    // ============================================
    
    var fileName = 'depenses_' + today.toISOString().split('T')[0] + '.pdf';
    doc.save(fileName);
    showSuccessMessage('PDF export\u00e9 : ' + fileName);
}