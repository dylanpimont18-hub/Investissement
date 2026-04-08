import { calculateTMI, computeCF, computeProjectMetrics, computeResaleTimeline } from './calculs.js';
import {
    setNegoTableMode,
    updateColor, updateChart, updateEvolutionChart,
    updateScoreBanner, updateRegimeComparison,
    generateOptimizationTips, renderOptimizationSection,
    updateNegoTable, showToast, validateInputs
} from './ui.js';
import { buildPDFDOM, cleanupPDFDOM, getPDFOptions, showRenderMask } from './pdf.js';

// --- ÉTAT GLOBAL ---
let uploadedPhotos = [];
let savedProjects = (() => { try { return JSON.parse(localStorage.getItem('simuImmoProjects')) || []; } catch(e) { return []; } })();
let calcTimeout = null;

// --- LECTURE DES INPUTS ---
function getCurrentInputs() {
    const data = {};
    document.querySelectorAll('input:not(#project-name):not([type="file"]), select, textarea').forEach(el => {
        if (el.id) data[el.id] = (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) || 0 : el.value;
    });
    return data;
}

// --- DÉCLENCHEUR DE CALCUL (debounce 300 ms) ---
function triggerCalculations() {
    clearTimeout(calcTimeout);
    calcTimeout = setTimeout(() => {
        calculateAndSave();
        calculateVierzonStrategy();
    }, 300);
}

// --- ANALYSE & SAUVEGARDE (Onglet 1 et 2) ---
function calculateAndSave() {
    const inputs = getCurrentInputs();
    localStorage.setItem('simuImmoDraft', JSON.stringify(inputs));

    const tmi = calculateTMI(inputs.revenus, inputs.enfants);
    document.getElementById('tmi-display').innerText = tmi + ' %';

    const tmiBadge = document.getElementById('tmi-accordion-badge');
    if (tmiBadge) {
        tmiBadge.textContent = 'TMI ' + tmi + ' %';
        tmiBadge.style.display = '';
    }

    validateInputs(inputs);

    const commSection = document.getElementById('comments-export-section');
    if (inputs['commentaires-input'] && inputs['commentaires-input'].trim() !== '') {
        document.getElementById('commentaires-display').innerText = inputs['commentaires-input'];
        commSection.style.display = 'block';
    } else {
        commSection.style.display = 'none';
    }

    const prixNet   = inputs['prix'] - inputs['nego'];
    const fraisNotaire = prixNet * (inputs['notaire'] / 100);
    const fraisFixes   = inputs['agence'] + inputs['travaux'] + inputs['meubles'] + inputs['frais-bancaires'];
    const coutTotal    = prixNet + fraisNotaire + fraisFixes;
    const montantFinance = Math.max(0, coutTotal - inputs['apport']);

    const nMois = inputs['duree'] * 12;
    const tauxMensuel = (inputs['taux-input'] / 100) / 12;
    let mensualiteCredit = 0;
    if (tauxMensuel > 0 && nMois > 0) mensualiteCredit = (montantFinance * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -nMois));
    else if (nMois > 0) mensualiteCredit = montantFinance / nMois;

    const coutAssuranceMensuel = (montantFinance * (inputs['assurance'] / 100)) / 12;
    const mensualiteTotale     = mensualiteCredit + coutAssuranceMensuel;

    const loyersAnnuelsTheoriques = inputs['loyer'] * 12;
    const loyersEncaisses = loyersAnnuelsTheoriques * (1 - (inputs['vacance'] / 100));
    const chargesExploitationAnnuelles = (inputs['copro'] * 12) + inputs['fonciere'] + inputs['pno'] + (loyersEncaisses * (inputs['gestion'] / 100));

    // --- PROJECTION SUR 25 ANS ---
    let capitalRestant = montantFinance;
    const inflationRate = (inputs['inflation'] || 0) / 100;

    let tbodyHTML = '';
    let firstYearImpots  = 0;
    let firstYearInterets = 0;
    let cfCumule = 0;
    let breakEvenYear = null;
    let capitalAmortiCumule = 0;
    const chartLabels       = [];
    const dataCapitalRestant = [];
    const dataCFCumule      = [];
    const dataEnrichissement = [];
    let deficitReportable = 0;

    for (let annee = 1; annee <= 25; annee++) {
        let interetsAnnee = 0;
        let capitalAmortiAnnee = 0;

        let assuranceAnnee = 0;
        for (let m = 0; m < 12; m++) {
            if (capitalRestant > 0.01) {
                let interetMois = capitalRestant * tauxMensuel;
                let capMois     = mensualiteCredit - interetMois;
                if (capitalRestant - capMois < 0) capMois = capitalRestant;
                interetsAnnee      += interetMois;
                capitalAmortiAnnee += capMois;
                assuranceAnnee     += coutAssuranceMensuel;
                capitalRestant     -= capMois;
            }
        }
        if (capitalRestant < 0) capitalRestant = 0;
        const totalFinancementAnnee = capitalAmortiAnnee + interetsAnnee + assuranceAnnee;

        // Inflation : loyers et charges augmentent chaque année
        const facteurInflation = Math.pow(1 + inflationRate, annee - 1);
        const loyersEncaissesCetteAnnee = loyersEncaisses * facteurInflation;
        const chargesExploitationCetteAnnee = chargesExploitationAnnuelles * facteurInflation;

        // TMI recalculé chaque année en incluant le revenu locatif net imposable
        let revenuLocatifImposable = 0;
        if (inputs['regime'] === 'micro-foncier') {
            revenuLocatifImposable = loyersEncaissesCetteAnnee * 0.7;
        } else if (inputs['regime'] === 'reel') {
            const chargesAnnueesTmp = chargesExploitationCetteAnnee + assuranceAnnee + (annee === 1 ? inputs['travaux'] + inputs['frais-bancaires'] : 0);
            revenuLocatifImposable = Math.max(0, loyersEncaissesCetteAnnee - chargesAnnueesTmp - interetsAnnee);
        }
        const tmiCetteAnnee = calculateTMI((inputs['revenus'] || 0) + revenuLocatifImposable, inputs['enfants'] || 0);
        const tauxGlobalImpot = (tmiCetteAnnee / 100) + 0.172;

        let impotsAnnee = 0;
        if (inputs['regime'] === 'micro-foncier') {
            impotsAnnee = (loyersEncaissesCetteAnnee * 0.7) * tauxGlobalImpot;
        } else if (inputs['regime'] === 'reel') {
            let chargesAnnuees = chargesExploitationCetteAnnee + assuranceAnnee;
            if (annee === 1) chargesAnnuees += inputs['travaux'] + inputs['frais-bancaires'];

            let revenusNets = loyersEncaissesCetteAnnee - chargesAnnuees - interetsAnnee;

            if (revenusNets > 0) {
                if (deficitReportable > 0) {
                    if (deficitReportable >= revenusNets) {
                        deficitReportable -= revenusNets;
                        revenusNets = 0;
                    } else {
                        revenusNets -= deficitReportable;
                        deficitReportable = 0;
                    }
                }
                impotsAnnee = revenusNets * tauxGlobalImpot;
            } else {
                const soldeHorsInterets = loyersEncaissesCetteAnnee - chargesAnnuees;
                if (soldeHorsInterets < 0) {
                    const deficitCharges  = Math.abs(soldeHorsInterets);
                    const imputableGlobal = Math.min(10700, deficitCharges);
                    impotsAnnee = -(imputableGlobal * (tmiCetteAnnee / 100));
                    const resteCharges = deficitCharges - imputableGlobal;
                    deficitReportable += (resteCharges + interetsAnnee);
                } else {
                    deficitReportable += Math.abs(revenusNets);
                    impotsAnnee = 0;
                }
            }
        } else if (inputs['regime'] === 'sci-is') {
            const amortissement = prixNet * 0.80 / 30;
            const chargesDeductibles = chargesExploitationCetteAnnee + assuranceAnnee + interetsAnnee;
            const benefice = loyersEncaissesCetteAnnee - chargesDeductibles - amortissement;
            if (benefice > 0) {
                impotsAnnee = Math.min(benefice, 42500) * 0.15 + Math.max(0, benefice - 42500) * 0.25;
            }
        }

        if (annee === 1) { firstYearImpots = impotsAnnee; firstYearInterets = interetsAnnee; }
        let cfNetNetAnnee = loyersEncaissesCetteAnnee - totalFinancementAnnee - chargesExploitationCetteAnnee - impotsAnnee;

        cfCumule += cfNetNetAnnee;
        capitalAmortiCumule += capitalAmortiAnnee;
        if (breakEvenYear === null && cfCumule >= 0) breakEvenYear = annee;
        chartLabels.push('An ' + annee);
        dataCapitalRestant.push(Math.round(capitalRestant));
        dataCFCumule.push(Math.round(cfCumule));
        dataEnrichissement.push(Math.round(capitalAmortiCumule + cfCumule));

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

    const reventeSection = document.getElementById('revente-results-section');
    const reventeTbody = document.getElementById('revente-tbody');
    const reventeSummary = document.getElementById('revente-summary');
    const resaleTimeline = computeResaleTimeline(prixNet, dataCapitalRestant, dataCFCumule, inputs);
    if (reventeSection && reventeTbody && reventeSummary && resaleTimeline.rows.length > 0) {
        reventeSection.style.display = 'block';
        reventeTbody.innerHTML = resaleTimeline.rows.map(row => {
            const gainColor = row.gainGlobal >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            const verdict = row.interesting ? 'Interessant' : 'Attendre';
            return `
                <tr>
                    <td>An ${row.year}</td>
                    <td>${Math.round(row.prixVente).toLocaleString('fr-FR')} €</td>
                    <td>${Math.round(row.fraisVente).toLocaleString('fr-FR')} €</td>
                    <td>${Math.round(row.impotPv).toLocaleString('fr-FR')} €</td>
                    <td>${Math.round(row.netVendeur).toLocaleString('fr-FR')} €</td>
                    <td>${Math.round(row.crd).toLocaleString('fr-FR')} €</td>
                    <td>${Math.round(row.cashNetSortie).toLocaleString('fr-FR')} €</td>
                    <td style="color:${gainColor}; font-weight:700;">${Math.round(row.gainGlobal).toLocaleString('fr-FR')} €</td>
                    <td style="color:${row.interesting ? 'var(--success-color)' : '#ff9500'}; font-weight:700;">${verdict}</td>
                </tr>
            `;
        }).join('');

        if (resaleTimeline.firstInterestingYear !== null) {
            reventeSummary.innerText = `Premiere annee interessante: An ${resaleTimeline.firstInterestingYear} - Meilleur gain estime: ${Math.round(resaleTimeline.bestGain).toLocaleString('fr-FR')} € (An ${resaleTimeline.bestYear})`;
        } else {
            reventeSummary.innerText = `Aucune annee positive sur 25 ans avec vos hypotheses actuelles. Meilleur scenario: ${Math.round(resaleTimeline.bestGain).toLocaleString('fr-FR')} € (An ${resaleTimeline.bestYear}).`;
        }
    } else if (reventeSection) {
        reventeSection.style.display = 'none';
    }

    const rentaBrute = coutTotal > 0 ? (loyersAnnuelsTheoriques / coutTotal) * 100 : 0;
    const rentaNette = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles) / coutTotal) * 100 : 0;
    const rentaNetNet = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles - firstYearImpots) / coutTotal) * 100 : 0;

    const cfNet    = (loyersEncaisses / 12) - mensualiteTotale - (chargesExploitationAnnuelles / 12);
    const cfNetNet = cfNet - (firstYearImpots / 12);

    document.getElementById('renta-brute').innerText  = rentaBrute.toFixed(2)  + ' %';
    document.getElementById('renta-nette').innerText  = rentaNette.toFixed(2)  + ' %';
    document.getElementById('renta-netnet').innerText = rentaNetNet.toFixed(2) + ' %';

    updateColor('cf-netnet', cfNetNet);

    // --- NOUVELLES MÉTRIQUES ---
    const apport = inputs['apport'];
    const cfAnnuelNetNet = cfNetNet * 12;
    const cocEl = document.getElementById('metric-coc');
    if (apport <= 0) {
        cocEl.innerText  = '∞';
        cocEl.className  = 'value positive';
    } else {
        const coc = (cfAnnuelNetNet / apport) * 100;
        cocEl.innerText = coc.toFixed(1) + ' %';
        cocEl.className = 'value ' + (coc >= 10 ? 'positive' : (coc >= 0 ? '' : 'negative'));
    }

    const grm   = loyersAnnuelsTheoriques > 0 ? coutTotal / loyersAnnuelsTheoriques : 0;
    const grmEl = document.getElementById('metric-grm');
    grmEl.innerText = grm.toFixed(1);
    grmEl.className = 'value ' + (grm > 0 && grm <= 14 ? 'positive' : (grm <= 20 ? 'metric-warning' : 'negative'));

    const dscr   = (mensualiteTotale * 12) > 0 ? loyersEncaisses / (mensualiteTotale * 12) : 0;
    const dscrEl = document.getElementById('metric-dscr');
    dscrEl.innerText = dscr.toFixed(2);
    dscrEl.className = 'value ' + (dscr >= 1.3 ? 'positive' : (dscr >= 1.0 ? 'metric-warning' : 'negative'));

    const beEl = document.getElementById('metric-breakeven');
    if (breakEvenYear !== null) {
        beEl.innerText = 'An ' + breakEvenYear;
        beEl.className = 'value ' + (breakEvenYear <= 5 ? 'positive' : (breakEvenYear <= 10 ? 'metric-warning' : 'negative'));
    } else {
        beEl.innerText = 'Jamais';
        beEl.className = 'value negative';
    }

    document.getElementById('out-prix-net').innerText     = Math.round(prixNet).toLocaleString('fr-FR');
    document.getElementById('out-frais-fixes').innerText  = Math.round(fraisFixes + fraisNotaire).toLocaleString('fr-FR');
    document.getElementById('out-cout-total').innerText   = Math.round(coutTotal).toLocaleString('fr-FR');
    document.getElementById('out-financement').innerText  = Math.round(montantFinance).toLocaleString('fr-FR');
    document.getElementById('out-mensualite').innerText   = mensualiteTotale.toFixed(2);

    updateChart(mensualiteTotale, chargesExploitationAnnuelles / 12, Math.max(0, firstYearImpots / 12), cfNetNet);
    updateEvolutionChart(chartLabels, dataCapitalRestant, dataCFCumule, dataEnrichissement);
    updateRegimeComparison(prixNet, inputs, tmi, loyersEncaisses, chargesExploitationAnnuelles, coutAssuranceMensuel, firstYearInterets);

    const computedData = { prixNet, cfNetNet, firstYearImpots, firstYearInterets, loyersEncaisses, chargesExploitationAnnuelles, coutAssuranceMensuel, montantFinance };
    const tips = generateOptimizationTips(inputs, tmi, computedData);
    renderOptimizationSection(tips);
    updateScoreBanner(cfNetNet, rentaNette, tips);
    updateNegoTable(prixNet, inputs['prix'], inputs, tmi);
}

// --- STRATÉGIE VIERZON (Onglet 3) ---
function calculateVierzonStrategy() {
    const inputs  = getCurrentInputs();
    const tmi     = calculateTMI(inputs.revenus, inputs.enfants);
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

    if (computeCF(1, loyerEstime, inputs, tmi) < targetCF) {
        document.getElementById('vierzon-prix-max').innerText = "Impossible 🚫";
    } else {
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

// --- GESTION DES PROJETS ---
function renderProjectsList() {
    const listEl = document.getElementById('projects-list');
    listEl.innerHTML = '';
    const compareBtn = document.getElementById('btn-compare-projects');
    if (compareBtn) compareBtn.style.display = savedProjects.length >= 2 ? 'block' : 'none';

    if (savedProjects.length === 0) return;

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

function loadProject(index) {
    if (confirm('Charger ce projet ?')) {
        const data = savedProjects[index];
        for (const id in data) {
            if (id === '_projectName') continue;
            const el = document.getElementById(id);
            if (el) {
                el.value = data[id];
                if (id === 'taux-input') document.getElementById('taux-slider').value = data[id];
                if (id === 'appreciation') document.getElementById('appreciation-slider').value = data[id];
            }
        }
        if (data['regime']) document.getElementById('regime').value = data['regime'];
        document.getElementById('project-name').value = data._projectName;
        triggerCalculations();
        document.querySelector('[data-target="view-results"]').click();
    }
}

function deleteProject(index) {
    if (confirm('Supprimer ce projet ?')) {
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
                    if (id === 'appreciation') document.getElementById('appreciation-slider').value = data[id];
                }
            }
            if (data['regime']) document.getElementById('regime').value = data['regime'];
        } catch (e) {}
    }
}

// --- GESTION DES PHOTOS ---
function dataURLtoBlob(dataURL) {
    const arr  = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
}

window.removePhoto = function(index) {
    uploadedPhotos[index] = null;
    const previewEl = document.getElementById(`photo-item-${index}`);
    const exportEl  = document.getElementById(`photo-export-item-${index}`);
    if (previewEl) previewEl.remove();
    if (exportEl)  exportEl.remove();
    if (uploadedPhotos.every(p => p === null)) {
        document.getElementById('photos-export-section').style.display = 'none';
        uploadedPhotos = [];
    }
};

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
    } catch (e) { /* share annulé ou non supporté */ }
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// --- MODALES ---
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

window.openComparatorModal = function() {
    const selA = document.getElementById('compare-project-a');
    const selB = document.getElementById('compare-project-b');
    const options = savedProjects.map((p, i) => `<option value="${i}">${p._projectName}</option>`).join('');
    selA.innerHTML = options;
    selB.innerHTML = options;
    if (savedProjects.length > 1) selB.selectedIndex = 1;
    document.getElementById('comparator-results').innerHTML = '';
    document.getElementById('modal-comparator').classList.add('open');
    document.body.style.overflow = 'hidden';
};
window.closeComparatorModal = function(overlay, event) {
    if (overlay && event && event.target !== overlay) return;
    document.getElementById('modal-comparator').classList.remove('open');
    document.body.style.overflow = '';
};

// --- EVENT LISTENERS ---

// Onglets
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
        window.scrollTo(0, 0);

        const pdfBtns = document.getElementById('pdf-btns');
        if (btn.dataset.target === 'view-results') {
            pdfBtns.style.display = 'flex';
            calculateAndSave();
        } else if (btn.dataset.target === 'view-vierzon') {
            pdfBtns.style.display = 'none';
            calculateVierzonStrategy();
        } else {
            pdfBtns.style.display = 'none';
        }
    });
});

// Synchronisation taux slider ↔ input
const tauxInput  = document.getElementById('taux-input');
const tauxSlider = document.getElementById('taux-slider');
tauxInput.addEventListener('input',  (e) => { tauxSlider.value = e.target.value; triggerCalculations(); });
tauxSlider.addEventListener('input', (e) => { tauxInput.value  = e.target.value; triggerCalculations(); });

// Synchronisation inflation slider ↔ input
const inflationInput  = document.getElementById('inflation');
const inflationSlider = document.getElementById('inflation-slider');
if (inflationInput && inflationSlider) {
    inflationInput.addEventListener('input',  (e) => { inflationSlider.value = e.target.value; triggerCalculations(); });
    inflationSlider.addEventListener('input', (e) => { inflationInput.value  = e.target.value; triggerCalculations(); });
}

// Synchronisation appreciation slider ↔ input
const appreciationInput  = document.getElementById('appreciation');
const appreciationSlider = document.getElementById('appreciation-slider');
if (appreciationInput && appreciationSlider) {
    appreciationInput.addEventListener('input',  (e) => { appreciationSlider.value = e.target.value; triggerCalculations(); });
    appreciationSlider.addEventListener('input', (e) => { appreciationInput.value  = e.target.value; triggerCalculations(); });
}

// Type de bien → frais notaire
document.getElementById('type-bien').addEventListener('change', (e) => {
    document.getElementById('notaire').value = e.target.value === 'ancien' ? 8.0 : 2.5;
    triggerCalculations();
});

// Bouton Simulation
document.getElementById('btn-simulate').addEventListener('click', () => {
    calculateAndSave();
    document.querySelector('[data-target="view-results"]').click();
});

// Toggle tableau de négociation
document.getElementById('toggle-pct').addEventListener('click', () => {
    setNegoTableMode('pct');
    document.getElementById('toggle-pct').classList.add('active');
    document.getElementById('toggle-amount').classList.remove('active');
    triggerCalculations();
});
document.getElementById('toggle-amount').addEventListener('click', () => {
    setNegoTableMode('regimes');
    document.getElementById('toggle-amount').classList.add('active');
    document.getElementById('toggle-pct').classList.remove('active');
    triggerCalculations();
});

// Inputs onglet Vierzon
['vierzon-target-cf', 'vierzon-loyer-estime', 'vierzon-prix-annonce'].forEach(id => {
    document.getElementById(id).addEventListener('input', calculateVierzonStrategy);
});

// Photo input
document.getElementById('photo-input').addEventListener('change', function(event) {
    const files       = event.target.files;
    const previewGrid = document.getElementById('photo-gallery-preview');
    const exportGrid  = document.getElementById('photo-gallery');
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

// Sauvegarde de projet
document.getElementById('btn-save-project').addEventListener('click', () => {
    const projectName = document.getElementById('project-name').value.trim();
    if (!projectName) return alert('Veuillez entrer un nom.');
    const currentData = getCurrentInputs();
    currentData._projectName = projectName;
    savedProjects.push(currentData);
    localStorage.setItem('simuImmoProjects', JSON.stringify(savedProjects));
    document.getElementById('project-name').value = '';
    renderProjectsList();
    alert(`Projet "${projectName}" sauvegardé !`);
});

// Comparateur
document.getElementById('btn-compare-projects').addEventListener('click', (e) => {
    e.preventDefault();
    window.openComparatorModal();
});

document.getElementById('btn-run-compare').addEventListener('click', function() {
    const idxA = parseInt(document.getElementById('compare-project-a').value);
    const idxB = parseInt(document.getElementById('compare-project-b').value);
    if (idxA === idxB) { showToast('Sélectionnez deux projets différents.', 'error'); return; }

    const mA  = computeProjectMetrics(savedProjects[idxA]);
    const mB  = computeProjectMetrics(savedProjects[idxB]);
    const fmt = n => Math.round(n).toLocaleString('fr-FR');
    const fmtPct = n => n.toFixed(2) + ' %';

    const rows = [
        { label: 'Prix net vendeur',   valA: fmt(mA.prixNet) + ' €',   valB: fmt(mB.prixNet) + ' €',   rawA: mA.prixNet,    rawB: mB.prixNet,    hib: false },
        { label: 'Coût total',         valA: fmt(mA.coutTotal) + ' €', valB: fmt(mB.coutTotal) + ' €', rawA: mA.coutTotal,  rawB: mB.coutTotal,  hib: false },
        { label: 'Loyer mensuel',      valA: fmt(mA.loyer) + ' €',     valB: fmt(mB.loyer) + ' €',     rawA: mA.loyer,      rawB: mB.loyer,      hib: true  },
        { label: 'Rentabilité brute',  valA: fmtPct(mA.rentaBrute),    valB: fmtPct(mB.rentaBrute),    rawA: mA.rentaBrute, rawB: mB.rentaBrute, hib: true  },
        { label: 'Rentabilité nette',  valA: fmtPct(mA.rentaNette),    valB: fmtPct(mB.rentaNette),    rawA: mA.rentaNette, rawB: mB.rentaNette, hib: true  },
        { label: 'Renta. nette-nette', valA: fmtPct(mA.rentaNetNet),   valB: fmtPct(mB.rentaNetNet),   rawA: mA.rentaNetNet, rawB: mB.rentaNetNet, hib: true },
        { label: 'Cash-Flow net-net',  valA: mA.cfNetNet.toFixed(2) + ' €', valB: mB.cfNetNet.toFixed(2) + ' €', rawA: mA.cfNetNet, rawB: mB.cfNetNet, hib: true },
        { label: 'Cash-on-Cash',       valA: mA.coc === Infinity ? '∞' : mA.coc.toFixed(1) + ' %', valB: mB.coc === Infinity ? '∞' : mB.coc.toFixed(1) + ' %', rawA: mA.coc, rawB: mB.coc, hib: true },
        { label: 'GRM',                valA: mA.grm === Infinity ? 'N/A' : mA.grm.toFixed(1), valB: mB.grm === Infinity ? 'N/A' : mB.grm.toFixed(1), rawA: mA.grm, rawB: mB.grm, hib: false },
        { label: 'DSCR',               valA: mA.dscr.toFixed(2), valB: mB.dscr.toFixed(2), rawA: mA.dscr, rawB: mB.dscr, hib: true },
        { label: 'Régime optimal',     valA: mA.bestRegime, valB: mB.bestRegime, rawA: null, rawB: null, hib: null },
        { label: 'Score',              valA: mA.scoreLabel, valB: mB.scoreLabel, rawA: null, rawB: null, hib: null },
    ];

    const nameA = savedProjects[idxA]._projectName;
    const nameB = savedProjects[idxB]._projectName;
    let html = `<table class="comparator-table"><thead><tr><th>Métrique</th><th>${nameA}</th><th>${nameB}</th></tr></thead><tbody>`;
    rows.forEach(r => {
        let cA = '', cB = '';
        if (r.hib !== null && r.rawA !== null && r.rawB !== null && r.rawA !== r.rawB) {
            const aWins = r.hib ? r.rawA > r.rawB : r.rawA < r.rawB;
            cA = aWins ? 'comparator-winner' : 'comparator-loser';
            cB = aWins ? 'comparator-loser'  : 'comparator-winner';
        } else if (r.rawA !== null && r.rawA === r.rawB) {
            cA = 'comparator-equal'; cB = 'comparator-equal';
        }
        html += `<tr><td>${r.label}</td><td class="${cA}">${r.valA}</td><td class="${cB}">${r.valB}</td></tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('comparator-results').innerHTML = html;
});

// Fermeture modales par touche Echap
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal-regimes').classList.contains('open'))     window.closeRegimeModal(null, null);
    if (document.getElementById('modal-deductibles').classList.contains('open')) window.closeDeductiblesModal(null, null);
    if (document.getElementById('modal-comparator').classList.contains('open'))  window.closeComparatorModal(null, null);
});

// Tous les inputs du formulaire déclenchent triggerCalculations
document.querySelectorAll('input:not(#project-name):not(#photo-input), select, textarea:not(#commentaires-input)').forEach(el => {
    el.addEventListener('input', triggerCalculations);
});

// --- BOUTONS PDF ---
document.getElementById('btn-save-pdf').addEventListener('click', async function() {
    const btn = this;
    const textInitial = btn.innerText;
    btn.innerText  = "⏳ Génération...";
    btn.disabled   = true;

    const mask = showRenderMask();
    const { container, styleEl, filename } = buildPDFDOM(uploadedPhotos);
    try {
        await html2pdf().set(getPDFOptions(filename)).from(container).save();
        showToast('PDF sauvegardé avec succès.', 'success');
    } catch(err) {
        console.error("Erreur PDF :", err);
        showToast('La génération du PDF a échoué. Réessayez.', 'error');
    } finally {
        cleanupPDFDOM(container, styleEl);
        mask.remove();
        btn.innerText = textInitial;
        btn.disabled  = false;
    }
});

document.getElementById('btn-share-pdf').addEventListener('click', async function() {
    const btn = this;
    const textInitial = btn.innerText;
    btn.innerText = "⏳ Génération...";
    btn.disabled  = true;

    const mask = showRenderMask();
    const { container, styleEl, filename } = buildPDFDOM(uploadedPhotos);
    try {
        const blob = await html2pdf().set(getPDFOptions(filename)).from(container).outputPdf('blob');
        cleanupPDFDOM(container, styleEl);
        mask.remove();

        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
        } else {
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch(err) {
        if (err.name !== 'AbortError') {
            console.error("Erreur partage PDF :", err);
            showToast('Le partage a échoué. Le fichier va être téléchargé.', 'error');
        }
        cleanupPDFDOM(container, styleEl);
        mask.remove();
    } finally {
        btn.innerText = textInitial;
        btn.disabled  = false;
    }
});

// Affiche le bouton Partager uniquement si le navigateur le supporte
(function() {
    const testFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
        document.getElementById('btn-share-pdf').style.display = 'inline-flex';
    }
})();

// --- INITIALISATION ---
window.onload = initApp;
