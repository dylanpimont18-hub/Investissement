const CSG_CRDS_RATE = 0.172; // Taux CSG+CRDS sur revenus du capital (2024)

let myChart = null;
let uploadedPhotos = [];
let savedProjects = (() => { try { return JSON.parse(localStorage.getItem('simuImmoProjects')) || []; } catch(e) { return []; } })();

// --- GESTION DES ONGLETS ET BOUTON EXPORT ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
        window.scrollTo(0, 0); 
        
        const pdfBtns = document.getElementById('pdf-btns');
        if(btn.dataset.target === 'view-results') {
            pdfBtns.style.display = 'flex';
            calculateAndSave();
        } else if(btn.dataset.target === 'view-vierzon') {
            pdfBtns.style.display = 'none';
            calculateVierzonStrategy();
        } else {
            pdfBtns.style.display = 'none';
        }
    });
});

// Synchronisations
const tauxInput = document.getElementById('taux-input');
const tauxSlider = document.getElementById('taux-slider');
tauxInput.addEventListener('input', (e) => { tauxSlider.value = e.target.value; triggerCalculations(); });
tauxSlider.addEventListener('input', (e) => { tauxInput.value = e.target.value; triggerCalculations(); });


document.getElementById('type-bien').addEventListener('change', (e) => {
    document.getElementById('notaire').value = e.target.value === 'ancien' ? 8.0 : 2.5;
    triggerCalculations();
});


function calculateTMI(revenus, enfants) {
    let parts = 2; 
    if (enfants === 1) parts += 0.5;
    else if (enfants >= 2) parts += 1.0 + (enfants - 2);
    const quotient = revenus / parts;
    if (quotient <= 11294) return 0;
    if (quotient <= 28797) return 11;
    if (quotient <= 82341) return 30;
    if (quotient <= 177106) return 41;
    return 45;
}

function getCurrentInputs() {
    const data = {};
    document.querySelectorAll('input:not(#project-name):not([type="file"]), select, textarea').forEach(el => {
        if (el.id) data[el.id] = (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) || 0 : el.value;
    });
    return data;
}

let calcTimeout = null;
function triggerCalculations() {
    clearTimeout(calcTimeout);
    calcTimeout = setTimeout(() => {
        calculateAndSave();
        calculateVierzonStrategy();
    }, 150);
}

// ALGORITHME MOTEUR : Calcule le CF Net-Net pour n'importe quelle configuration
function computeCF(prixVendeur, loyerMensuel, inputs, tmi) {
    const fraisNotaire = prixVendeur * (inputs['notaire'] / 100);
    const fraisFixes = inputs['agence'] + inputs['travaux'] + inputs['meubles'] + inputs['frais-bancaires'];
    const coutTotal = prixVendeur + fraisNotaire + fraisFixes;
    const montantFinance = Math.max(0, coutTotal - inputs['apport']);

    const nMois = inputs['duree'] * 12;
    const tauxMensuel = (inputs['taux-input'] / 100) / 12;
    let mensualiteCredit = 0;
    if (tauxMensuel > 0 && nMois > 0) mensualiteCredit = (montantFinance * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -nMois));
    else if (nMois > 0) mensualiteCredit = montantFinance / nMois;

    const coutAssuranceMensuel = (montantFinance * (inputs['assurance'] / 100)) / 12;
    const mensualiteTotale = mensualiteCredit + coutAssuranceMensuel;

    const loyersAnnuelsTheoriques = loyerMensuel * 12;
    const loyersEncaisses = loyersAnnuelsTheoriques * (1 - (inputs['vacance'] / 100));
    const chargesExploitationAnnuelles = (inputs['copro'] * 12) + inputs['fonciere'] + inputs['pno'] + (loyersEncaisses * (inputs['gestion'] / 100));

    let capitalRestant = montantFinance;
    let interetsAnnee1 = 0;
    for (let m = 0; m < 12; m++) {
        if (capitalRestant > 0) {
            let interetMois = capitalRestant * tauxMensuel;
            let capMois = mensualiteCredit - interetMois;
            interetsAnnee1 += interetMois;
            capitalRestant -= capMois;
        }
    }

    const tauxGlobalImpot = (tmi / 100) + CSG_CRDS_RATE;
    let impotsAnnee = 0;

    if (inputs['regime'] === 'micro-foncier') {
        // Abattement forfaitaire 30% → base imposable = 70% des loyers encaissés
        impotsAnnee = (loyersEncaisses * 0.7) * tauxGlobalImpot;
    } else if (inputs['regime'] === 'reel') {
        let chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12);
        let revenusNets = loyersEncaisses - chargesAnnuees - interetsAnnee1;
        if (revenusNets > 0) {
            impotsAnnee = revenusNets * tauxGlobalImpot;
        } else {
            // Déficit foncier : seule la partie hors intérêts est imputable sur le revenu global (plafond 10 700 €/an)
            const soldeHorsInterets = loyersEncaisses - chargesAnnuees;
            if (soldeHorsInterets < 0) {
                impotsAnnee = -(Math.min(10700, Math.abs(soldeHorsInterets)) * (tmi / 100));
            }
            // Si soldeHorsInterets >= 0, le déficit vient uniquement des intérêts → pas d'imputation sur revenu global
        }
    }

    const cfNet = (loyersEncaisses / 12) - mensualiteTotale - (chargesExploitationAnnuelles / 12);
    return cfNet - (impotsAnnee / 12);
}

// --- STRATÉGIE VIERZON (Onglet 3) ---
function calculateVierzonStrategy() {
    const inputs = getCurrentInputs();
    const tmi = calculateTMI(inputs.revenus, inputs.enfants);
    const targetCF = parseFloat(document.getElementById('vierzon-target-cf').value) || 0;
    
    // Scénario A : Je fixe le loyer, quel prix max ?
    const loyerEstime = parseFloat(document.getElementById('vierzon-loyer-estime').value) || 0;
    let minPrice = 1; let maxPrice = 1000000; let bestPrice = 0;
    for (let i = 0; i < 40; i++) {
        let midPrice = (minPrice + maxPrice) / 2;
        let cf = computeCF(midPrice, loyerEstime, inputs, tmi);
        if (cf >= targetCF) { bestPrice = midPrice; minPrice = midPrice; } 
        else { maxPrice = midPrice; }
    }
    
    // Vérification de l'impossibilité
    if(computeCF(1, loyerEstime, inputs, tmi) < targetCF) {
        document.getElementById('vierzon-prix-max').innerText = "Impossible 🚫";
    } else {
        // Le bestPrice ici est le Net Vendeur. On ajoute l'agence pour afficher le prix FAI max.
        let prixFaiMax = bestPrice + inputs['agence'];
        document.getElementById('vierzon-prix-max').innerText = Math.round(prixFaiMax).toLocaleString('fr-FR') + ' €';
    }

    // Scénario B : Je fixe le prix, quel loyer min ?
    const prixAnnonceFai = parseFloat(document.getElementById('vierzon-prix-annonce').value) || 0;
    const prixNetVendeur = prixAnnonceFai - inputs['agence'];
    
    let minRent = 1; let maxRent = 10000; let bestRent = 10000;
    if (computeCF(prixNetVendeur, maxRent, inputs, tmi) < targetCF) {
        document.getElementById('vierzon-loyer-min').innerText = 'Impossible 🚫';
    } else {
        for (let i = 0; i < 40; i++) {
            let midRent = (minRent + maxRent) / 2;
            let cf = computeCF(prixNetVendeur, midRent, inputs, tmi);
            if (cf >= targetCF) { bestRent = midRent; maxRent = midRent; }
            else { minRent = midRent; }
        }
        document.getElementById('vierzon-loyer-min').innerText = Math.round(bestRent).toLocaleString('fr-FR') + ' €';
    }
}

// Ecouteurs spécifiques à l'onglet Vierzon
['vierzon-target-cf', 'vierzon-loyer-estime', 'vierzon-prix-annonce'].forEach(id => {
    document.getElementById(id).addEventListener('input', calculateVierzonStrategy);
});

// Bouton Simulation
document.getElementById('btn-simulate').addEventListener('click', () => {
    calculateAndSave();
    document.querySelector('[data-target="view-results"]').click();
});

// Toggle tableau de négociation
document.getElementById('toggle-pct').addEventListener('click', () => {
    negoTableMode = 'pct';
    document.getElementById('toggle-pct').classList.add('active');
    document.getElementById('toggle-amount').classList.remove('active');
    triggerCalculations();
});
document.getElementById('toggle-amount').addEventListener('click', () => {
    negoTableMode = 'regimes';
    document.getElementById('toggle-amount').classList.add('active');
    document.getElementById('toggle-pct').classList.remove('active');
    triggerCalculations();
});

// --- ANALYSE & SAUVEGARDE (Onglet 1 et 2) ---
function calculateAndSave() {
    const inputs = getCurrentInputs();
    localStorage.setItem('simuImmoDraft', JSON.stringify(inputs));

    const tmi = calculateTMI(inputs.revenus, inputs.enfants);
    document.getElementById('tmi-display').innerText = tmi + ' %';

    const commSection = document.getElementById('comments-export-section');
    if (inputs['commentaires-input'] && inputs['commentaires-input'].trim() !== '') {
        document.getElementById('commentaires-display').innerText = inputs['commentaires-input'];
        commSection.style.display = 'block';
    } else {
        commSection.style.display = 'none';
    }

    const prixNet = inputs['prix'] - inputs['nego'];
    const fraisNotaire = prixNet * (inputs['notaire'] / 100);
    const fraisFixes = inputs['agence'] + inputs['travaux'] + inputs['meubles'] + inputs['frais-bancaires'];
    const coutTotal = prixNet + fraisNotaire + fraisFixes;
    const montantFinance = Math.max(0, coutTotal - inputs['apport']);

    const nMois = inputs['duree'] * 12;
    const tauxMensuel = (inputs['taux-input'] / 100) / 12;
    let mensualiteCredit = 0;
    if (tauxMensuel > 0 && nMois > 0) mensualiteCredit = (montantFinance * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -nMois));
    else if (nMois > 0) mensualiteCredit = montantFinance / nMois;

    const coutAssuranceMensuel = (montantFinance * (inputs['assurance'] / 100)) / 12;
    const mensualiteTotale = mensualiteCredit + coutAssuranceMensuel;

    const loyersAnnuelsTheoriques = inputs['loyer'] * 12;
    const loyersEncaisses = loyersAnnuelsTheoriques * (1 - (inputs['vacance'] / 100));
    const chargesExploitationAnnuelles = (inputs['copro'] * 12) + inputs['fonciere'] + inputs['pno'] + (loyersEncaisses * (inputs['gestion'] / 100));

    // --- PROJECTION SUR 15 ANS ---
    let capitalRestant = montantFinance;
    const tauxGlobalImpot = (tmi / 100) + CSG_CRDS_RATE;

    let tbodyHTML = '';
    let firstYearImpots = 0;

    for (let annee = 1; annee <= 15; annee++) {
        let interetsAnnee = 0;
        let capitalAmortiAnnee = 0;

        for (let m = 0; m < 12; m++) {
            if (capitalRestant > 0) {
                let interetMois = capitalRestant * tauxMensuel;
                let capMois = mensualiteCredit - interetMois;
                interetsAnnee += interetMois;
                capitalAmortiAnnee += capMois;
                capitalRestant -= capMois;
            }
        }
        
        if (capitalRestant < 0) capitalRestant = 0;

        let impotsAnnee = 0;
        if (inputs['regime'] === 'micro-foncier') {
            // Abattement forfaitaire 30% → base imposable = 70% des loyers encaissés
            impotsAnnee = (loyersEncaisses * 0.7) * tauxGlobalImpot;
        } else if (inputs['regime'] === 'reel') {
            let chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12);
            if(annee === 1) chargesAnnuees += inputs['travaux'] + inputs['frais-bancaires'];

            let revenusNets = loyersEncaisses - chargesAnnuees - interetsAnnee;
            if (revenusNets > 0) {
                impotsAnnee = revenusNets * tauxGlobalImpot;
            } else {
                // Déficit foncier : seule la partie hors intérêts est imputable sur revenu global (plafond 10 700 €/an)
                const soldeHorsInterets = loyersEncaisses - chargesAnnuees;
                if (soldeHorsInterets < 0) {
                    impotsAnnee = -(Math.min(10700, Math.abs(soldeHorsInterets)) * (tmi / 100));
                }
            }
        }

        if(annee === 1) firstYearImpots = impotsAnnee;
        let cfNetNetAnnee = loyersEncaisses - (mensualiteTotale * 12) - chargesExploitationAnnuelles - impotsAnnee;

        tbodyHTML += `
            <tr>
                <td>An ${annee}</td>
                <td style="color:var(--success-color)">+ ${Math.round(capitalAmortiAnnee).toLocaleString()} €</td>
                <td>${Math.round(capitalRestant).toLocaleString()} €</td>
                <td>${Math.round(interetsAnnee).toLocaleString()} €</td>
                <td style="color:${impotsAnnee < 0 ? 'var(--success-color)' : (impotsAnnee > 0 ? 'var(--danger-color)' : 'inherit')}">
                    ${Math.round(impotsAnnee).toLocaleString()} €
                </td>
                <td style="font-weight:bold; color:${cfNetNetAnnee >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                    ${Math.round(cfNetNetAnnee).toLocaleString()} €
                </td>
            </tr>
        `;
    }
    document.getElementById('projection-tbody').innerHTML = tbodyHTML;

    const rentaBrute = coutTotal > 0 ? (loyersAnnuelsTheoriques / coutTotal) * 100 : 0;
    const rentaNette = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles) / coutTotal) * 100 : 0;
    const rentaNetNet = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles - firstYearImpots) / coutTotal) * 100 : 0;
    
    const cfNet = (loyersEncaisses / 12) - mensualiteTotale - (chargesExploitationAnnuelles / 12);
    const cfNetNet = cfNet - (firstYearImpots / 12);

    document.getElementById('renta-brute').innerText = rentaBrute.toFixed(2) + ' %';
    document.getElementById('renta-nette').innerText = rentaNette.toFixed(2) + ' %';
    document.getElementById('renta-netnet').innerText = rentaNetNet.toFixed(2) + ' %';
    
    updateColor('cf-netnet', cfNetNet); 

    document.getElementById('out-prix-net').innerText = Math.round(prixNet).toLocaleString('fr-FR');
    document.getElementById('out-frais-fixes').innerText = Math.round(fraisFixes + fraisNotaire).toLocaleString('fr-FR');
    document.getElementById('out-cout-total').innerText = Math.round(coutTotal).toLocaleString('fr-FR');
    document.getElementById('out-financement').innerText = Math.round(montantFinance).toLocaleString('fr-FR');
    document.getElementById('out-mensualite').innerText = mensualiteTotale.toFixed(2);

    updateChart(mensualiteTotale, chargesExploitationAnnuelles/12, Math.max(0, firstYearImpots/12), cfNetNet);
    updateScoreBanner(cfNetNet, rentaNette);
    updateRegimeComparison(prixNet, inputs, tmi);
    updateNegoTable(prixNet, inputs['prix'], inputs, tmi);
}

function updateScoreBanner(cfNetNet, rentaNette) {
    let pts = 0;
    if (cfNetNet >= 300) pts += 3; else if (cfNetNet >= 100) pts += 2; else if (cfNetNet >= 0) pts += 1;
    if (rentaNette >= 7) pts += 3; else if (rentaNette >= 5) pts += 2; else if (rentaNette >= 3.5) pts += 1;

    let cls, emoji, label, stars;
    if (pts >= 5)      { cls = 'score-excellent'; emoji = '🏆'; label = 'Excellent'; stars = '★★★'; }
    else if (pts >= 3) { cls = 'score-bon';       emoji = '👍'; label = 'Bon';       stars = '★★☆'; }
    else if (pts >= 1) { cls = 'score-moyen';     emoji = '⚠️'; label = 'Moyen';     stars = '★☆☆'; }
    else               { cls = 'score-risque';    emoji = '🚫'; label = 'Risqué';    stars = '☆☆☆'; }

    const banner = document.getElementById('score-banner');
    banner.className = 'score-banner ' + cls;
    document.getElementById('score-emoji').innerText = emoji;
    document.getElementById('score-label').innerText = label;
    document.getElementById('score-stars').innerText = stars;
    const sign = cfNetNet >= 0 ? '+' : '';
    document.getElementById('score-detail').innerText = `CF ${sign}${Math.round(cfNetNet)} €/mois · Renta nette ${rentaNette.toFixed(1)} %`;
}

function updateRegimeComparison(prixNet, inputs, tmi) {
    const currentRegime = inputs['regime'];
    const loyer = inputs['loyer'];

    const allRegimes = [
        { id: 'micro-foncier', label: 'Micro-Foncier' },
        { id: 'reel',          label: 'Foncier Réel'  },
    ];

    const results = allRegimes.map(r => {
        const cf = computeCF(prixNet, loyer, Object.assign({}, inputs, { regime: r.id }), tmi);
        return { ...r, cf };
    });

    const bestCF = Math.max(...results.map(r => r.cf));

    document.getElementById('regime-compare-grid').innerHTML = results.map(r => {
        const isBest = r.cf === bestCF;
        const isCurrent = r.id === currentRegime;
        const color = r.cf >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        const cfHTML = `<span style="color:${color}">${r.cf >= 0 ? '+' : ''}${Math.round(r.cf)} €</span>`;
        let badge = '';
        if (isBest) badge = `<div class="regime-badge" style="color:var(--success-color)">✅ Meilleur</div>`;
        else if (isCurrent) badge = `<div class="regime-badge" style="color:var(--primary-color)">◀ Actuel</div>`;
        else badge = `<div class="regime-badge">&nbsp;</div>`;

        const cls = ['regime-card', isBest ? 'regime-best' : ''].join(' ').trim();
        return `<div class="${cls}"><div class="regime-name">${r.label}</div><div class="regime-cf">${cfHTML}</div>${badge}</div>`;
    }).join('');
}

let negoTableMode = 'pct';

function updateNegoTable(prixNet, prixAffiche, inputs, tmi) {
    const loyer = inputs['loyer'];
    const container = document.getElementById('nego-table-container');
    if (!container) return;

    if (negoTableMode === 'regimes') {
        const regimes = [{ id: 'micro-foncier', label: 'Micro-Foncier' }, { id: 'reel', label: 'Foncier Réel' }];

        let html = `<table class="nego-table">
            <thead><tr>
                <th>Négo.</th>
                <th>Prix vendeur</th>
                ${regimes.map(r => `<th style="color:var(--primary-color)">${r.label}</th>`).join('')}
            </tr></thead><tbody>`;

        for (let pct = 0; pct <= 25; pct++) {
            const prix = prixAffiche * (1 - pct / 100);
            const isCurrent = Math.abs(prix - prixNet) < 1;
            html += `<tr class="${isCurrent ? 'nego-row-current' : ''}">
                <td>${pct} %</td>
                <td style="color:#8e8e93">${Math.round(prix).toLocaleString('fr-FR')} €</td>
                ${regimes.map(r => {
                    const cf = computeCF(prix, loyer, Object.assign({}, inputs, { regime: r.id }), tmi);
                    const color = cf >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
                    const sign = cf >= 0 ? '+' : '';
                    return `<td style="color:${color};font-weight:600">${sign}${Math.round(cf)} €</td>`;
                }).join('')}
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
        return;
    }

    let rows = [];
    for (let pct = 0; pct <= 25; pct++) {
        const prix = prixAffiche * (1 - pct / 100);
        const cf = computeCF(prix, loyer, inputs, tmi);
        rows.push({ col1: pct + ' %', col2: Math.round(prixAffiche * pct / 100).toLocaleString('fr-FR') + ' €', prix: Math.round(prix), cf });
    }

    let html = `<table class="nego-table">
        <thead><tr><th>Négociation</th><th>Montant</th><th>Prix vendeur</th><th>CF net-net / mois</th></tr></thead><tbody>`;
    rows.forEach(row => {
        const isCurrent = Math.abs(row.prix - prixNet) < 1;
        const cfColor = row.cf >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        const sign = row.cf >= 0 ? '+' : '';
        html += `<tr class="${isCurrent ? 'nego-row-current' : ''}">
            <td>${row.col1}</td>
            <td style="color:#8e8e93">${row.col2}</td>
            <td>${row.prix.toLocaleString('fr-FR')} €</td>
            <td style="color:${cfColor};font-weight:600">${sign}${Math.round(row.cf)} €</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function updateColor(id, value) {
    const el = document.getElementById(id);
    el.innerText = value.toFixed(2) + ' €';
    el.className = 'value ' + (value >= 0 ? 'positive' : 'negative');
}

function updateChart(credit, charges, impots, cf) {
    const cfDisplay = cf > 0 ? cf : 0;
    const textColor = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#f5f5f7' : '#1c1e21';

    if (myChart) {
        myChart.data.datasets[0].data = [credit, charges, impots, cfDisplay];
        myChart.options.plugins.legend.labels.color = textColor;
        myChart.update();
        return;
    }
    const ctx = document.getElementById('cashflowChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Banque', 'Charges', 'Impôts', 'Cash-Flow'],
            datasets: [{ data: [credit, charges, impots, cfDisplay], backgroundColor: ['#ff3b30', '#ff9500', '#af52de', '#34c759'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
    });
}

// --- GESTION DES PHOTOS ---
document.getElementById('photo-input').addEventListener('change', function(event) {
    const files = event.target.files;
    const previewGrid = document.getElementById('photo-gallery-preview');
    const exportGrid = document.getElementById('photo-gallery');
    const exportSection = document.getElementById('photos-export-section');

    if (files.length > 0) exportSection.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Src = e.target.result;
            uploadedPhotos.push(base64Src);
            const index = uploadedPhotos.length - 1;
            const previewHTML = `
                <div class="photo-item" id="photo-item-${index}">
                    <img src="${base64Src}">
                    <button class="btn-remove" onclick="removePhoto(${index})">✖</button>
                    <button class="btn-save-photo" onclick="savePhotoToGallery(${index})" title="Enregistrer dans la galerie">💾</button>
                </div>`;
            const exportHTML = `
                <div class="photo-item" id="photo-export-item-${index}">
                    <img src="${base64Src}">
                </div>`;
            previewGrid.insertAdjacentHTML('beforeend', previewHTML);
            exportGrid.insertAdjacentHTML('beforeend', exportHTML);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
});

window.removePhoto = function(index) {
    uploadedPhotos[index] = null;
    const previewEl = document.getElementById(`photo-item-${index}`);
    const exportEl = document.getElementById(`photo-export-item-${index}`);
    if (previewEl) previewEl.remove();
    if (exportEl) exportEl.remove();
    if (uploadedPhotos.every(p => p === null)) {
        document.getElementById('photos-export-section').style.display = 'none';
        uploadedPhotos = [];
    }
};

function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
}

window.savePhotoToGallery = async function(index) {
    const src = uploadedPhotos[index];
    if (!src) return;
    const fileName = `investpro-photo-${Date.now()}.jpg`;
    try {
        const blob = dataURLtoBlob(src);
        const file = new File([blob], fileName, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Photo – Investisseur Pro' });
            return;
        }
    } catch (e) { /* share annulé ou non supporté, on passe au téléchargement */ }
    // Fallback : téléchargement direct
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// --- GESTION DES PROJETS ---
function renderProjectsList() {
    const listEl = document.getElementById('projects-list');
    listEl.innerHTML = '';
    if(savedProjects.length === 0) return;

    savedProjects.forEach((project, index) => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.innerText = project._projectName;
        
        const btnGroup = document.createElement('div');
        btnGroup.className = 'project-btns';
        
        const btnLoad = document.createElement('button');
        btnLoad.className = 'btn-small btn-load';
        btnLoad.innerText = '📂 Charger';
        btnLoad.onclick = (e) => { e.preventDefault(); loadProject(index); };
        
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-small btn-delete';
        btnDelete.innerText = '🗑️';
        btnDelete.onclick = (e) => { e.preventDefault(); deleteProject(index); };
        
        btnGroup.appendChild(btnLoad);
        btnGroup.appendChild(btnDelete);
        li.appendChild(nameSpan);
        li.appendChild(btnGroup);
        listEl.appendChild(li);
    });
}

document.getElementById('btn-save-project').addEventListener('click', () => {
    const projectName = document.getElementById('project-name').value.trim();
    if(!projectName) return alert('Veuillez entrer un nom.');
    
    const currentData = getCurrentInputs();
    currentData._projectName = projectName; 
    savedProjects.push(currentData);
    localStorage.setItem('simuImmoProjects', JSON.stringify(savedProjects));
    
    document.getElementById('project-name').value = ''; 
    renderProjectsList();
    alert(`Projet "${projectName}" sauvegardé !`);
});

function loadProject(index) {
    if(confirm('Charger ce projet ?')) {
        const data = savedProjects[index];
        for (const id in data) {
            if (id === '_projectName') continue;
            const el = document.getElementById(id);
            if (el) {
                el.value = data[id];
                if (id === 'taux-input') document.getElementById('taux-slider').value = data[id];
            }
        }
        if (data['regime']) document.getElementById('regime').value = data['regime'];
        document.getElementById('project-name').value = data._projectName;
        triggerCalculations();
        document.querySelector('[data-target="view-results"]').click();
    }
}

function deleteProject(index) {
    if(confirm(`Supprimer ce projet ?`)) {
        savedProjects.splice(index, 1);
        localStorage.setItem('simuImmoProjects', JSON.stringify(savedProjects));
        renderProjectsList();
    }
}

function initApp() {
    renderProjectsList();
    const savedDraft = localStorage.getItem('simuImmoDraft');
    if (savedDraft) {
        try {
            const data = JSON.parse(savedDraft);
            for (const id in data) {
                const el = document.getElementById(id);
                if (el) {
                    el.value = data[id];
                    if (id === 'taux-input') document.getElementById('taux-slider').value = data[id];
                }
            }
            if (data['regime']) document.getElementById('regime').value = data['regime'];
        } catch (e) {}
    }
}

document.querySelectorAll('input, select, textarea').forEach(el => el.addEventListener('input', triggerCalculations));
window.onload = initApp;

// --- MODAL RÉGIMES FISCAUX ---
window.openRegimeModal = function() {
    document.getElementById('modal-regimes').classList.add('open');
    document.body.style.overflow = 'hidden';
};
window.closeRegimeModal = function(overlay, event) {
    if (overlay && event && event.target !== overlay) return;
    document.getElementById('modal-regimes').classList.remove('open');
    document.body.style.overflow = '';
};

window.openDeductiblesModal = function() {
    document.getElementById('modal-deductibles').classList.add('open');
    document.body.style.overflow = 'hidden';
};
window.closeDeductiblesModal = function(overlay, event) {
    if (overlay && event && event.target !== overlay) return;
    document.getElementById('modal-deductibles').classList.remove('open');
    document.body.style.overflow = '';
};

// --- Affiche le bouton Partager uniquement si le navigateur le supporte ---
(function() {
    const testFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
        document.getElementById('btn-share-pdf').style.display = 'inline-flex';
    }
})();

// --- Construit le DOM caché pour le rendu PDF ---
function buildPDFDOM() {
    const projectName = document.getElementById('project-name').value.trim() || 'Investissement';
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const scoreBanner = document.getElementById('score-banner');
    const scoreClass  = scoreBanner.className;
    const scoreLabel  = document.getElementById('score-label').innerText;
    const scoreStars  = document.getElementById('score-stars').innerText;
    const scoreDetail = document.getElementById('score-detail').innerText;

    const rentaBrute  = document.getElementById('renta-brute').innerText;
    const rentaNette  = document.getElementById('renta-nette').innerText;
    const rentaNetnet = document.getElementById('renta-netnet').innerText;
    const cfNetnetEl  = document.getElementById('cf-netnet');
    const cfNetnet    = cfNetnetEl.innerText;
    const cfIsNeg     = cfNetnetEl.classList.contains('negative');

    const outPrixNet     = document.getElementById('out-prix-net').innerText;
    const outFraisFixes  = document.getElementById('out-frais-fixes').innerText;
    const outCoutTotal   = document.getElementById('out-cout-total').innerText;
    const outFinancement = document.getElementById('out-financement').innerText;
    const outMensualite  = document.getElementById('out-mensualite').innerText;

    const chartCanvas = document.getElementById('cashflowChart');
    const chartImg = chartCanvas ? chartCanvas.toDataURL('image/png') : null;

    const regimeHTML = document.getElementById('regime-compare-grid').innerHTML;
    const negoHTML   = document.getElementById('nego-table-container').innerHTML;
    const projHTML   = document.getElementById('projection-tbody').innerHTML;

    const notesEl   = document.getElementById('commentaires-display');
    const notesText = notesEl ? notesEl.innerText.trim() : '';

    const activePhotos = (typeof uploadedPhotos !== 'undefined') ? uploadedPhotos.filter(p => p) : [];
    const photosHTML   = activePhotos.map(p => `<img src="${p}" class="r-photo-img">`).join('');

    let scoreBg = '#fff8e6', scoreBorder = '#ffc107', scoreColor = '#856404';
    if (scoreClass.includes('score-excellent')) { scoreBg = '#eafaf0'; scoreBorder = '#34c759'; scoreColor = '#1a6e28'; }
    else if (scoreClass.includes('score-bon'))  { scoreBg = '#e8f0ff'; scoreBorder = '#007aff'; scoreColor = '#004a99'; }
    else if (scoreClass.includes('score-risque')){ scoreBg = '#fde8e8'; scoreBorder = '#ff3b30'; scoreColor = '#8b0000'; }

    const css = `
#pdf-render {
    --primary-color:#007aff; --success-color:#34c759; --danger-color:#ff3b30;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    font-size:10.5px; color:#1c1e21; background:white; width:680px;
}
#pdf-render * { box-sizing:border-box; margin:0; padding:0; }
#pdf-render .r-header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #007aff; padding-bottom:9px; margin-bottom:13px; }
#pdf-render .r-title  { font-size:19px; font-weight:800; color:#007aff; }
#pdf-render .r-sub    { font-size:10px; color:#8e8e93; margin-top:2px; }
#pdf-render .r-date   { font-size:9.5px; color:#8e8e93; }
#pdf-render .r-score  { display:flex; justify-content:space-between; align-items:center; padding:9px 13px; border-radius:10px; border:1.5px solid ${scoreBorder}; background:${scoreBg}; margin-bottom:12px; }
#pdf-render .r-score-l { font-size:13px; font-weight:700; color:${scoreColor}; }
#pdf-render .r-score-r { font-size:10.5px; font-weight:600; color:${scoreColor}; }
#pdf-render .r-kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:12px; }
#pdf-render .r-kpi      { border:1px solid #e5e5ea; border-radius:10px; padding:9px 11px; text-align:center; }
#pdf-render .r-kpi.gold { border-top:3px solid #ff9500; }
#pdf-render .r-kpi.blue { border-top:3px solid #007aff; }
#pdf-render .r-kpi-lbl  { font-size:8px; text-transform:uppercase; letter-spacing:.5px; color:#8e8e93; margin-bottom:4px; }
#pdf-render .r-kpi-val  { font-size:19px; font-weight:800; }
#pdf-render .r-kpi-val.neg { color:#ff3b30; }
#pdf-render .r-kpi-val.pos { color:#34c759; }
#pdf-render .r-kpi-s    { font-size:7.5px; color:#8e8e93; margin-top:2px; }
#pdf-render .r-summary-row { display:flex; gap:12px; margin-bottom:12px; }
#pdf-render .r-summary  { flex:1; border:1px solid #e5e5ea; border-radius:10px; padding:11px 13px; }
#pdf-render .r-summary h3 { font-size:11px; font-weight:700; margin-bottom:9px; }
#pdf-render .r-summary ul { list-style:none; }
#pdf-render .r-summary li { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f2f2f7; font-size:9.5px; }
#pdf-render .r-summary li:last-child { border-bottom:none; }
#pdf-render .r-summary li strong { font-weight:700; }
#pdf-render .r-summary .total strong { color:#007aff; }
#pdf-render .r-chart    { width:150px; flex-shrink:0; border:1px solid #e5e5ea; border-radius:10px; padding:10px; display:flex; align-items:center; justify-content:center; }
#pdf-render .r-chart img { width:124px; height:124px; object-fit:contain; }
#pdf-render .r-card      { border:1px solid #e5e5ea; border-radius:10px; padding:11px 13px; margin-bottom:12px; page-break-inside:avoid; }
#pdf-render .r-card h3   { font-size:11px; font-weight:700; margin-bottom:6px; }
#pdf-render .r-card-sub  { font-size:8.5px; color:#8e8e93; margin-bottom:9px; }
#pdf-render .r-page-break { page-break-before:always; height:0; }
#pdf-render .regime-compare-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:8px; }
#pdf-render .regime-card  { border:1px solid #e5e5ea; border-radius:8px; padding:8px; text-align:center; }
#pdf-render .regime-best  { border-color:#34c759; }
#pdf-render .regime-name  { font-size:7.5px; text-transform:uppercase; color:#8e8e93; letter-spacing:.4px; margin-bottom:4px; }
#pdf-render .regime-cf    { font-size:15px; font-weight:800; margin-bottom:3px; }
#pdf-render .regime-badge { font-size:8px; color:#8e8e93; }
#pdf-render .nego-table   { width:100%; border-collapse:collapse; font-size:9.5px; }
#pdf-render .nego-table th { padding:5px 8px; text-align:left; font-size:8px; text-transform:uppercase; color:#8e8e93; letter-spacing:.4px; font-weight:600; background:#f2f2f7; }
#pdf-render .nego-table td { padding:4.5px 8px; border-bottom:1px solid #f2f2f7; text-align:right; }
#pdf-render .nego-table td:first-child { text-align:left; font-weight:600; }
#pdf-render .nego-table tr { page-break-inside:avoid; }
#pdf-render .nego-table tr:last-child td { border-bottom:none; }
#pdf-render .nego-table .nego-row-current { background:#edf5ff; }
#pdf-render .nego-table .nego-row-current td:first-child::after { content:' ◀ actuel'; font-size:8px; color:#007aff; font-weight:700; }
#pdf-render .r-proj-table  { width:100%; border-collapse:collapse; font-size:9.5px; }
#pdf-render .r-proj-table th { padding:5px 8px; text-align:left; font-size:8px; text-transform:uppercase; color:#8e8e93; letter-spacing:.4px; font-weight:600; background:#f2f2f7; }
#pdf-render .r-proj-table td { padding:4.5px 8px; border-bottom:1px solid #f2f2f7; }
#pdf-render .r-proj-table tr { page-break-inside:avoid; }
#pdf-render .r-proj-table tr:last-child td { border-bottom:none; }
#pdf-render .r-photo-grid { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
#pdf-render .r-photo-img  { width:calc(50% - 5px); height:170px; object-fit:cover; border-radius:8px; }
#pdf-render .r-notes      { white-space:pre-wrap; font-size:10px; line-height:1.65; margin-top:8px; }
`;

    const html = `
<div class="r-header">
  <div><div class="r-title">Investisseur Pro</div><div class="r-sub">${projectName}</div></div>
  <div class="r-date">Rapport généré le ${today}</div>
</div>
<div class="r-score">
  <div class="r-score-l">${scoreLabel} &nbsp; ${scoreStars}</div>
  <div class="r-score-r">${scoreDetail}</div>
</div>
<div class="r-kpi-grid">
  <div class="r-kpi"><div class="r-kpi-lbl">Rentabilité Brute</div><div class="r-kpi-val">${rentaBrute}</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">Rentabilité Nette</div><div class="r-kpi-val">${rentaNette}</div></div>
  <div class="r-kpi gold"><div class="r-kpi-lbl">Renta. Nette-Nette</div><div class="r-kpi-val">${rentaNetnet}</div><div class="r-kpi-s">Après Impôts</div></div>
  <div class="r-kpi blue"><div class="r-kpi-lbl">Cash-Flow Net-Net</div><div class="r-kpi-val ${cfIsNeg ? 'neg' : 'pos'}">${cfNetnet}</div><div class="r-kpi-s">Dans votre poche / mois</div></div>
</div>
<div class="r-summary-row">
  <div class="r-summary">
    <h3>Résumé de l'Enveloppe</h3>
    <ul>
      <li><span>Prix net vendeur estimé</span><strong>${outPrixNet} €</strong></li>
      <li><span>Frais fixes (Notaire, Travaux…)</span><strong>${outFraisFixes} €</strong></li>
      <li class="total"><span>Coût total de l'opération</span><strong>${outCoutTotal} €</strong></li>
      <li><span>Montant de l'emprunt</span><strong>${outFinancement} €</strong></li>
      <li><span>Mensualité de crédit</span><strong>${outMensualite} €</strong></li>
    </ul>
  </div>
  ${chartImg ? `<div class="r-chart"><img src="${chartImg}" alt="Répartition CF"></div>` : ''}
</div>
<div class="r-card">
  <h3>⚖️ Comparaison des Régimes Fiscaux</h3>
  <div class="r-card-sub">CF net-net mensuel estimé pour chaque régime avec vos paramètres actuels.</div>
  <div class="regime-compare-grid">${regimeHTML}</div>
</div>
<div class="r-page-break"></div>
<div class="r-card" style="page-break-inside:auto;">
  <h3>📉 Impact de la Négociation sur le CF</h3>
  <div class="r-card-sub">CF net-net mensuel selon le niveau de négociation sur le prix affiché (0 → 25 %).</div>
  ${negoHTML}
</div>
<div class="r-page-break"></div>
<div class="r-card" style="page-break-inside:auto;">
  <h3>📊 Projection Financière (15 ans)</h3>
  <table class="r-proj-table">
    <thead><tr><th>Année</th><th>Capital Amorti</th><th>Capital Restant</th><th>Intérêts</th><th>Impôts</th><th>Cash-Flow Net</th></tr></thead>
    <tbody>${projHTML}</tbody>
  </table>
</div>
${notesText ? `<div class="r-page-break"></div><div class="r-card"><h3>📝 Notes &amp; Commentaires</h3><p class="r-notes">${notesText}</p></div>` : ''}
${activePhotos.length ? `<div class="r-page-break"></div><div class="r-card"><h3>📷 Galerie Photos</h3><div class="r-photo-grid">${photosHTML}</div></div>` : ''}
`;

    const styleEl = document.createElement('style');
    styleEl.id = 'pdf-temp-style';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    const container = document.createElement('div');
    container.id = 'pdf-render';
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;background:white;z-index:-1;';
    container.innerHTML = html;
    document.body.appendChild(container);

    const projectSlug = (document.getElementById('project-name').value.trim() || 'InvestPro').replace(/\s+/g, '-');
    const filename = `Rapport-${projectSlug}.pdf`;

    return { container, styleEl, filename };
}

function cleanupPDFDOM(container, styleEl) {
    if (container) container.remove();
    if (styleEl)   styleEl.remove();
}

function getPDFOptions(filename) {
    return {
        margin:      10,
        filename,
        image:       { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, logging: false, windowWidth: 680 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css', 'avoid-all'], before: '.r-page-break' }
    };
}

// Bouton Sauvegarder PDF (téléchargement direct)
document.getElementById('btn-save-pdf').addEventListener('click', async function() {
    const btn = this;
    const textInitial = btn.innerText;
    btn.innerText = "⏳ Génération...";
    btn.disabled = true;

    const { container, styleEl, filename } = buildPDFDOM();
    try {
        await html2pdf().set(getPDFOptions(filename)).from(container).save();
    } catch(err) {
        console.error("Erreur PDF :", err);
    } finally {
        cleanupPDFDOM(container, styleEl);
        btn.innerText = textInitial;
        btn.disabled = false;
    }
});

// Bouton Partager PDF (Web Share API → fallback téléchargement)
document.getElementById('btn-share-pdf').addEventListener('click', async function() {
    const btn = this;
    const textInitial = btn.innerText;
    btn.innerText = "⏳ Génération...";
    btn.disabled = true;

    const { container, styleEl, filename } = buildPDFDOM();
    try {
        const blob = await html2pdf().set(getPDFOptions(filename)).from(container).outputPdf('blob');
        cleanupPDFDOM(container, styleEl);

        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
        } else {
            // Fallback : téléchargement
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch(err) {
        if (err.name !== 'AbortError') console.error("Erreur partage PDF :", err);
        cleanupPDFDOM(container, styleEl);
    } finally {
        btn.innerText = textInitial;
        btn.disabled = false;
    }
});

