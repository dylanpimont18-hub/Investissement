let myChart = null;
let uploadedPhotos = [];
let savedProjects = JSON.parse(localStorage.getItem('simuImmoProjects')) || [];

// --- GESTION DES ONGLETS ET BOUTON EXPORT ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
        window.scrollTo(0, 0); 
        
        const btnExport = document.getElementById('btn-export');
        if(btn.dataset.target === 'view-results') {
            btnExport.style.display = 'block';
            calculateAndSave();
        } else if(btn.dataset.target === 'view-vierzon') {
            btnExport.style.display = 'none';
            calculateVierzonStrategy();
        } else {
            btnExport.style.display = 'none';
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

document.getElementById('type-location').addEventListener('change', (e) => {
    const regimeSelect = document.getElementById('regime');
    regimeSelect.innerHTML = ''; 
    if (e.target.value === 'nue') {
        regimeSelect.add(new Option('Micro-foncier (-30%)', 'micro-foncier'));
        regimeSelect.add(new Option('Foncier Réel', 'reel'));
    } else {
        regimeSelect.add(new Option('Micro-BIC (-50%)', 'micro-bic'));
        regimeSelect.add(new Option('LMNP Réel', 'lmnp-reel'));
    }
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

function triggerCalculations() {
    calculateAndSave();
    calculateVierzonStrategy();
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

    const tauxGlobalImpot = (tmi / 100) + 0.172; 
    let impotsAnnee = 0;

    if (inputs['regime'] === 'micro-foncier') {
        impotsAnnee = (loyersEncaisses * 0.7) * tauxGlobalImpot;
    } else if (inputs['regime'] === 'micro-bic') {
        impotsAnnee = (loyersEncaisses * 0.5) * tauxGlobalImpot;
    } else if (inputs['regime'] === 'reel') {
        let chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + inputs['travaux'] + inputs['frais-bancaires'];
        let revenusNets = loyersEncaisses - chargesAnnuees - interetsAnnee1;
        if (revenusNets > 0) impotsAnnee = revenusNets * tauxGlobalImpot;
        else impotsAnnee = -(Math.min(10700, Math.abs(loyersEncaisses - chargesAnnuees)) * (tmi / 100)); 
    } else if (inputs['regime'] === 'lmnp-reel') {
        let chargesAnnuees = chargesExploitationAnnuelles + interetsAnnee1 + (coutAssuranceMensuel * 12) + (fraisNotaire + inputs['agence'] + inputs['frais-bancaires']); 
        let amortissementTotal = (prixVendeur * 0.85 / 30) + (inputs['meubles'] / 5) + (inputs['travaux'] / 15);
        let resultatComptable = loyersEncaisses - chargesAnnuees - amortissementTotal;
        if(resultatComptable > 0) impotsAnnee = resultatComptable * tauxGlobalImpot;
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
    for (let i = 0; i < 40; i++) {
        let midRent = (minRent + maxRent) / 2;
        let cf = computeCF(prixNetVendeur, midRent, inputs, tmi);
        if (cf >= targetCF) { bestRent = midRent; maxRent = midRent; } 
        else { minRent = midRent; }
    }
    document.getElementById('vierzon-loyer-min').innerText = Math.round(bestRent).toLocaleString('fr-FR') + ' €';
}

// Ecouteurs spécifiques à l'onglet Vierzon
['vierzon-target-cf', 'vierzon-loyer-estime', 'vierzon-prix-annonce'].forEach(id => {
    document.getElementById(id).addEventListener('input', calculateVierzonStrategy);
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
    const tauxGlobalImpot = (tmi / 100) + 0.172; 
    let amortissementImmoAnnuel = (prixNet * 0.85) / 30;
    let amortissementMeubles = inputs['meubles'] / 5;
    let amortissementTravaux = inputs['travaux'] / 15;
    let lmnpDeficitReportable = 0;

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
            impotsAnnee = (loyersEncaisses * 0.7) * tauxGlobalImpot;
        } else if (inputs['regime'] === 'micro-bic') {
            impotsAnnee = (loyersEncaisses * 0.5) * tauxGlobalImpot;
        } else if (inputs['regime'] === 'reel') {
            let chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12);
            if(annee === 1) chargesAnnuees += inputs['travaux'] + inputs['frais-bancaires'];
            
            let revenusNets = loyersEncaisses - chargesAnnuees - interetsAnnee;
            if (revenusNets > 0) {
                impotsAnnee = revenusNets * tauxGlobalImpot;
            } else if (annee === 1) { 
                let deficitImputable = Math.min(10700, Math.abs(loyersEncaisses - chargesAnnuees));
                impotsAnnee = -(deficitImputable * (tmi / 100)); 
            }
        } else if (inputs['regime'] === 'lmnp-reel') {
            let chargesAnnuees = chargesExploitationAnnuelles + interetsAnnee + (coutAssuranceMensuel * 12);
            if(annee === 1) chargesAnnuees += (fraisNotaire + inputs['agence'] + inputs['frais-bancaires']); 
            
            let amortissementTotal = amortissementImmoAnnuel;
            if(annee <= 5) amortissementTotal += amortissementMeubles;
            if(annee <= 15) amortissementTotal += amortissementTravaux;

            let resultatComptable = loyersEncaisses - chargesAnnuees - amortissementTotal;
            if(resultatComptable < 0) {
                lmnpDeficitReportable += Math.abs(resultatComptable);
                impotsAnnee = 0;
            } else {
                if(lmnpDeficitReportable > 0) {
                    if(resultatComptable <= lmnpDeficitReportable) {
                        lmnpDeficitReportable -= resultatComptable;
                        impotsAnnee = 0;
                    } else {
                        let baseImposable = resultatComptable - lmnpDeficitReportable;
                        lmnpDeficitReportable = 0;
                        impotsAnnee = baseImposable * tauxGlobalImpot;
                    }
                } else {
                    impotsAnnee = resultatComptable * tauxGlobalImpot;
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
}

function updateColor(id, value) {
    const el = document.getElementById(id);
    el.innerText = value.toFixed(2) + ' €';
    el.className = 'value ' + (value >= 0 ? 'positive' : 'negative');
}

function updateChart(credit, charges, impots, cf) {
    const ctx = document.getElementById('cashflowChart').getContext('2d');
    const cfDisplay = cf > 0 ? cf : 0; 
    const textColor = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#f5f5f7' : '#1c1e21';

    if (myChart) myChart.destroy();
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
            const photoHTML = `
                <div class="photo-item" id="photo-item-${index}">
                    <img src="${base64Src}">
                    <button class="btn-remove" onclick="removePhoto(${index})">✖</button>
                </div>`;
            previewGrid.insertAdjacentHTML('beforeend', photoHTML);
            exportGrid.insertAdjacentHTML('beforeend', photoHTML);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
});

window.removePhoto = function(index) {
    uploadedPhotos[index] = null; 
    document.querySelectorAll(`#photo-item-${index}`).forEach(el => el.remove());
    if (uploadedPhotos.every(p => p === null)) {
        document.getElementById('photos-export-section').style.display = 'none';
        uploadedPhotos = []; 
    }
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
        if (data['type-location']) {
            document.getElementById('type-location').value = data['type-location'];
            document.getElementById('type-location').dispatchEvent(new Event('change'));
        }
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
        } catch (e) {}
    }
    document.getElementById('type-location').dispatchEvent(new Event('change'));
}

document.querySelectorAll('input, select, textarea').forEach(el => el.addEventListener('input', triggerCalculations));
window.onload = initApp;

// Export PDF
document.getElementById('btn-export').addEventListener('click', function() {
    const btn = this;
    const textInitial = btn.innerText;
    btn.innerText = "⏳ Génération...";
    btn.disabled = true;

    window.scrollTo(0, 0);
    const removeBtns = document.querySelectorAll('.btn-remove');
    removeBtns.forEach(btn => btn.style.display = 'none');

    const element = document.getElementById('export-area');
    const currentName = document.getElementById('project-name').value.trim();
    const pdfFilename = currentName ? `Rapport-${currentName.replace(/\s+/g, '-')}.pdf` : 'Rapport-InvestPro.pdf';

    const opt = {
        margin:       10,
        filename:     pdfFilename,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        removeBtns.forEach(btn => btn.style.display = 'flex');
        btn.innerText = textInitial;
        btn.disabled = false;
    }).catch(err => {
        console.error("Erreur PDF :", err);
        removeBtns.forEach(btn => btn.style.display = 'flex');
        btn.innerText = textInitial;
        btn.disabled = false;
    });
});