import { calculateTMI, computeCF, computeProjectMetrics, computeResaleTimeline } from './calculs.js';
import {
    setNegoTableMode,
    updateColor, updateChart, updateEvolutionChart,
    updateScoreBanner, updateRegimeComparison,
    generateOptimizationTips, renderOptimizationSection,
    updateNegoTable, showToast, validateInputs
} from './ui.js';
import { buildPDFDOM, buildPrintDocument, buildSharePDFFile, cleanupPDFDOM } from './pdf.js';

// --- ÉTAT GLOBAL ---
let uploadedPhotos = [];
let savedProjects = (() => { try { return JSON.parse(localStorage.getItem('simuImmoProjects')) || []; } catch(e) { return []; } })();
let calcTimeout = null;
let projectionData = [];

// --- WIZARD ---
let currentWizardStep = 1;
let wizardMode = 'rapide';

// --- COMPTE & PREMIUM (Lots 7+8) ---
// Stub local — brancher ici Firebase Auth / Supabase pour la version cloud réelle
const FREE_PROJECT_LIMIT = 3;
const PDF_GEN_LIMIT = 3;
let userAccount = (() => { try { return JSON.parse(localStorage.getItem('userAccount')) || { isPremium: false }; } catch(e) { return { isPremium: false }; } })();
let pdfGenCount = (() => { try { return parseInt(localStorage.getItem('pdfGenCount') || '0', 10); } catch(e) { return 0; } })();
if (userAccount.isPremium) document.body.classList.add('is-premium');

function incrementPdfGenCount() {
    if (userAccount.isPremium) return;
    pdfGenCount++;
    localStorage.setItem('pdfGenCount', pdfGenCount);
}

function shouldShowPdfGate() {
    return !userAccount.isPremium && pdfGenCount > PDF_GEN_LIMIT;
}

let _pendingPdfAction = null;

window.closePdfGateModal = function() {
    document.getElementById('modal-pdf-gate').style.display = 'none';
    document.body.style.overflow = '';
    _pendingPdfAction = null;
};

function showPdfGateOrProceed(action) {
    incrementPdfGenCount();
    if (shouldShowPdfGate()) {
        _pendingPdfAction = action;
        document.getElementById('modal-pdf-gate').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        action();
    }
}

function migrateProjects() {
    let changed = false;
    savedProjects = savedProjects.map(p => {
        if (!p._id) {
            p._id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
            p._createdAt = new Date().toISOString();
            p._updatedAt = new Date().toISOString();
            p._syncedAt = null;  // null = non synchronisé avec le cloud
            p._isLocal = true;
            changed = true;
        }
        return p;
    });
    if (changed) localStorage.setItem('simuImmoProjects', JSON.stringify(savedProjects));
}

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

    const tmi = calculateTMI(inputs.revenus, 2);
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
    const deficitMap = new Map(); // yearCreated -> amount (cap 10 ans)
    projectionData = [];

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
        const tmiCetteAnnee = calculateTMI((inputs['revenus'] || 0) + revenuLocatifImposable, 2);
        const tauxGlobalImpot = (tmiCetteAnnee / 100) + 0.172;

        let impotsAnnee = 0;
        if (inputs['regime'] === 'micro-foncier') {
            impotsAnnee = (loyersEncaissesCetteAnnee * 0.7) * tauxGlobalImpot;
        } else if (inputs['regime'] === 'reel') {
            let chargesAnnuees = chargesExploitationCetteAnnee + assuranceAnnee;
            if (annee === 1) chargesAnnuees += inputs['travaux'] + inputs['frais-bancaires'];

            let revenusNets = loyersEncaissesCetteAnnee - chargesAnnuees - interetsAnnee;

            // Expirer les déficits de plus de 10 ans
            for (const yr of [...deficitMap.keys()]) {
                if (annee - yr > 10) deficitMap.delete(yr);
            }
            const deficitReportable = [...deficitMap.values()].reduce((s, v) => s + v, 0);

            if (revenusNets > 0) {
                if (deficitReportable > 0) {
                    let remaining = Math.min(deficitReportable, revenusNets);
                    revenusNets -= remaining;
                    for (const [yr, amt] of deficitMap) {
                        if (remaining <= 0) break;
                        const used = Math.min(amt, remaining);
                        remaining -= used;
                        if (used >= amt) deficitMap.delete(yr);
                        else deficitMap.set(yr, amt - used);
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
                    const newDeficit = resteCharges + interetsAnnee;
                    if (newDeficit > 0) deficitMap.set(annee, (deficitMap.get(annee) || 0) + newDeficit);
                } else {
                    const newDeficit = Math.abs(revenusNets);
                    if (newDeficit > 0) deficitMap.set(annee, (deficitMap.get(annee) || 0) + newDeficit);
                    impotsAnnee = 0;
                }
            }
        } else if (inputs['regime'] === 'sci-is') {
            const amortissement = prixNet * 0.80 / 30;
            const chargesDeductibles = chargesExploitationCetteAnnee + assuranceAnnee + interetsAnnee + (annee === 1 ? inputs['travaux'] + inputs['frais-bancaires'] : 0);
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
        projectionData.push({ annee, capitalAmortiAnnee, capitalRestant, interetsAnnee, impotsAnnee, cfNetNetAnnee });
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

    animateValue(document.getElementById('renta-brute'), rentaBrute, ' %', 600);
    animateValue(document.getElementById('renta-nette'), rentaNette, ' %', 600);
    animateValue(document.getElementById('renta-netnet'), rentaNetNet, ' %', 600);

    updateColor('cf-netnet', cfNetNet);
    animateValue(document.getElementById('cf-netnet'), cfNetNet, ' €', 600);

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

    const dscr   = (mensualiteTotale * 12) > 0 ? (loyersEncaisses - chargesExploitationAnnuelles) / (mensualiteTotale * 12) : 0;
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

    // --- ÉQUITÉ AN 1 ---
    const equityAn1 = (inputs['apport'] || 0) + (montantFinance - (dataCapitalRestant[0] || 0));
    const equityEl = document.getElementById('metric-equity');
    if (equityEl) {
        equityEl.innerText = Math.round(equityAn1).toLocaleString('fr-FR') + ' €';
        equityEl.className = 'value ' + (equityAn1 > 0 ? 'positive' : 'negative');
    }

    // --- ALERTE MICRO-FONCIER ---
    const alertMicro = document.getElementById('micro-foncier-alert');
    if (alertMicro) alertMicro.style.display = (inputs['regime'] === 'micro-foncier' && loyersEncaisses > 15000) ? 'block' : 'none';

    // --- ANALYSE DE SENSIBILITÉ ---
    const sensitivityScenarios = [
        { label: 'Scénario de base', loyer: inputs['loyer'], overrides: {} },
        { label: 'Taux + 0,5 %',    loyer: inputs['loyer'], overrides: { 'taux-input': (inputs['taux-input'] || 0) + 0.5 } },
        { label: 'Taux + 1 %',      loyer: inputs['loyer'], overrides: { 'taux-input': (inputs['taux-input'] || 0) + 1.0 } },
        { label: 'Vacance 10 %',    loyer: inputs['loyer'], overrides: { 'vacance': 10 } },
        { label: 'Loyer − 5 %',     loyer: (inputs['loyer'] || 0) * 0.95, overrides: { 'loyer': (inputs['loyer'] || 0) * 0.95 } },
        { label: 'Loyer − 10 %',    loyer: (inputs['loyer'] || 0) * 0.90, overrides: { 'loyer': (inputs['loyer'] || 0) * 0.90 } },
    ];
    const sensitivityTbody = document.getElementById('sensitivity-tbody');
    if (sensitivityTbody) {
        sensitivityTbody.innerHTML = sensitivityScenarios.map((sc, i) => {
            const scInputs = Object.assign({}, inputs, sc.overrides);
            const cf = computeCF(prixNet, sc.loyer, scInputs, tmi);
            const delta = cf - cfNetNet;
            const cfColor = cf >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            const deltaColor = delta >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            const deltaStr = i === 0 ? '—' : `<span style="color:${deltaColor}">${delta >= 0 ? '+' : ''}${Math.round(delta)} €</span>`;
            return `<tr>
                <td>${sc.label}</td>
                <td style="font-weight:700;color:${cfColor}">${cf.toFixed(0)} €/mois</td>
                <td>${deltaStr}</td>
            </tr>`;
        }).join('');
    }

    // --- PROJECTION POST-CRÉDIT ---
    const duree = inputs['duree'] || 20;
    const postCreditSection = document.getElementById('post-credit-section');
    const postCreditContent = document.getElementById('post-credit-content');
    if (postCreditSection && postCreditContent && duree > 0) {
        const facteurPost = Math.pow(1 + inflationRate, duree - 1);
        const loyersPost = loyersEncaisses * facteurPost;
        const chargesPost = chargesExploitationAnnuelles * facteurPost;
        // TMI recalculé en incluant le revenu locatif net imposable post-crédit
        let revLocatifImposablePost = 0;
        if (inputs['regime'] === 'micro-foncier') {
            revLocatifImposablePost = loyersPost * 0.7;
        } else if (inputs['regime'] === 'reel') {
            revLocatifImposablePost = Math.max(0, loyersPost - chargesPost);
        }
        const tmiPost = calculateTMI((inputs['revenus'] || 0) + revLocatifImposablePost, 2);
        const tauxGlobalPost = (tmiPost / 100) + 0.172;
        let impotsPost = 0;
        if (inputs['regime'] === 'micro-foncier') {
            impotsPost = (loyersPost * 0.7) * tauxGlobalPost;
        } else if (inputs['regime'] === 'reel') {
            const revNets = loyersPost - chargesPost;
            if (revNets > 0) impotsPost = revNets * tauxGlobalPost;
        } else if (inputs['regime'] === 'sci-is') {
            const amort = duree < 30 ? prixNet * 0.80 / 30 : 0;
            const benefice = loyersPost - chargesPost - amort;
            if (benefice > 0) impotsPost = Math.min(benefice, 42500) * 0.15 + Math.max(0, benefice - 42500) * 0.25;
        }
        const cfPost = (loyersPost - chargesPost - impotsPost) / 12;
        const gainPost = cfPost - cfNetNet;
        const cfPostColor = cfPost >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        const gainPostColor = gainPost >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        postCreditSection.style.display = 'block';
        postCreditContent.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
                <div style="background:var(--bg-color);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:0.78rem;color:#8e8e93;margin-bottom:4px;">CF mensuel post-crédit</div>
                    <div style="font-size:1.4rem;font-weight:700;color:${cfPostColor}">${Math.round(cfPost).toLocaleString('fr-FR')} €</div>
                </div>
                <div style="background:var(--bg-color);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:0.78rem;color:#8e8e93;margin-bottom:4px;">Gain vs maintenant</div>
                    <div style="font-size:1.4rem;font-weight:700;color:${gainPostColor}">${gainPost >= 0 ? '+' : ''}${Math.round(gainPost).toLocaleString('fr-FR')} €/mois</div>
                </div>
                <div style="background:var(--bg-color);border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:0.78rem;color:#8e8e93;margin-bottom:4px;">Revenus nets / an</div>
                    <div style="font-size:1.4rem;font-weight:700;">${Math.round(loyersPost - chargesPost - impotsPost).toLocaleString('fr-FR')} €</div>
                </div>
            </div>
            <p style="font-size:0.78rem;color:#8e8e93;margin-top:10px;">* Estimation à l'an ${duree} avec ${((inputs['inflation'] || 0)).toFixed(1)} % d'inflation/an sur loyers et charges. Crédit et assurance emprunteur soldés.</p>
        `;
    }
}

// --- STRATÉGIE VIERZON (Onglet 3) ---
function calculateVierzonStrategy() {
    const inputs  = getCurrentInputs();
    const tmi     = calculateTMI(inputs.revenus, 2);
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

    const verdictCompareBtn = document.getElementById('verdict-action-compare-btn');
    if (verdictCompareBtn) {
        const canCompare = savedProjects.length >= 2;
        verdictCompareBtn.style.opacity = canCompare ? '' : '0.5';
        verdictCompareBtn.style.pointerEvents = canCompare ? '' : 'none';
        verdictCompareBtn.title = canCompare ? '' : 'Sauvegardez au moins 2 projets pour comparer';
    }

    const badge = document.getElementById('projects-count-badge');
    if (badge) {
        if (savedProjects.length > 0) {
            badge.textContent = savedProjects.length;
            badge.classList.add('visible');
        } else {
            badge.classList.remove('visible');
        }
    }

    const limitBar = document.getElementById('projects-limit-bar');
    const limitCount = document.getElementById('projects-limit-count');
    if (limitBar && limitCount && !userAccount.isPremium) {
        limitBar.style.display = savedProjects.length > 0 ? 'flex' : 'none';
        const isAtLimit = savedProjects.length >= FREE_PROJECT_LIMIT;
        limitCount.textContent = savedProjects.length + ' / ' + FREE_PROJECT_LIMIT;
        limitCount.classList.toggle('limit-full', isAtLimit);
    }

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
    const noProjects = document.getElementById('comparator-no-projects');
    const selectorsWrap = document.getElementById('comparator-selectors-wrap');

    if (savedProjects.length < 2) {
        if (noProjects) noProjects.style.display = 'block';
        if (selectorsWrap) selectorsWrap.style.display = 'none';
    } else {
        if (noProjects) noProjects.style.display = 'none';
        if (selectorsWrap) selectorsWrap.style.display = 'block';
        const options = savedProjects.map((p, i) => `<option value="${i}">${p._projectName}</option>`).join('');
        selA.innerHTML = options;
        selB.innerHTML = options;
        if (savedProjects.length > 1) selB.selectedIndex = 1;
    }
    document.getElementById('comparator-results').innerHTML = '';
    document.getElementById('modal-comparator').classList.add('open');
    document.body.style.overflow = 'hidden';
};
window.closeComparatorModal = function(overlay, event) {
    if (overlay && event && event.target !== overlay) return;
    document.getElementById('modal-comparator').classList.remove('open');
    document.body.style.overflow = '';
};

// --- COMPTE & PRO+ ---
window.openAccountModal = function() {
    const zone = document.getElementById('account-status-zone');
    if (zone) {
        if (userAccount.isPremium) {
            zone.innerHTML = `
                <div class="account-status-row"><span class="account-status-icon">&#128196;</span><span>Projets : <strong>illimités</strong></span></div>
                <div class="account-status-row"><span class="account-status-icon">&#9729;</span><span>Sync cloud : <strong>active</strong></span></div>`;
            zone.className = 'account-status-zone account-status-zone-premium';
            const badge = document.getElementById('account-plan-premium-badge');
            if (badge) { badge.textContent = 'Actif'; badge.classList.add('account-plan-badge-active'); }
            const waitlistBtn = document.getElementById('account-waitlist-btn');
            if (waitlistBtn) waitlistBtn.style.display = 'none';
        } else {
            const count = savedProjects.length;
            const pct = Math.min(count / FREE_PROJECT_LIMIT * 100, 100);
            const atLimit = count >= FREE_PROJECT_LIMIT;
            zone.innerHTML = `
                <div class="account-status-row"><span class="account-status-icon">&#128194;</span><span>Projets : <strong>${count} / ${FREE_PROJECT_LIMIT} sauvegardés</strong></span></div>
                <div class="account-status-bar-wrap"><div class="account-status-bar ${atLimit ? 'account-status-bar-full' : ''}" style="width:${pct}%"></div></div>
                <div class="account-status-row"><span class="account-status-icon">&#128190;</span><span>Stockage : <strong>local uniquement</strong></span></div>`;
            zone.className = 'account-status-zone';
        }
    }
    document.getElementById('modal-compte').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};
window.closeAccountModal = function() {
    document.getElementById('modal-compte').style.display = 'none';
    document.body.style.overflow = '';
};
// Ouvre la boîte mail pré-remplie — aucun backend nécessaire
window.openWaitlistForm = function() {
    window.location.href = 'mailto:gegertauren@gmail.com?subject=Investisseur%20Pro%2B%20%E2%80%94%20Liste%20d%27attente&body=Bonjour%2C%0A%0AJe%20suis%20int%C3%A9ress%C3%A9(e)%20par%20la%20version%20Pro%2B%20d%27Investisseur%20Pro.%0A%0AMon%20profil%20%3A%20';
};
window.openPricingModal = function() {
    document.getElementById('modal-pricing').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};
window.closePricingModal = function() {
    document.getElementById('modal-pricing').style.display = 'none';
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

        const pdfBar = document.getElementById('pdf-action-bar');
        if (btn.dataset.target === 'view-results') {
            pdfBar.style.display = 'flex';
            calculateAndSave();
        } else if (btn.dataset.target === 'view-vierzon') {
            pdfBar.style.display = 'none';
            calculateVierzonStrategy();
        } else {
            pdfBar.style.display = 'none';
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

// Bouton Simulation rapide (mode Estimation)
document.getElementById('btn-simulate-quick')?.addEventListener('click', () => {
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

// Photo input — handler partagé galerie + caméra
function handlePhotoFiles(event) {
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
}

document.getElementById('photo-input')?.addEventListener('change', handlePhotoFiles);
document.getElementById('photo-input-camera')?.addEventListener('change', handlePhotoFiles);

// Sauvegarde de projet
document.getElementById('btn-save-project').addEventListener('click', () => {
    const projectName = document.getElementById('project-name').value.trim();
    if (!projectName) return alert('Veuillez entrer un nom.');
    if (!userAccount.isPremium && savedProjects.length >= FREE_PROJECT_LIMIT) {
        window.openAccountModal();
        const zone = document.getElementById('account-status-zone');
        if (zone && !zone.querySelector('.pricing-nudge')) {
            const nudge = document.createElement('div');
            nudge.className = 'pricing-nudge';
            nudge.style.cssText = 'margin-top:10px;text-align:center;font-size:0.82rem;';
            nudge.innerHTML = `<a href="#" onclick="window.closeAccountModal();window.openPricingModal();return false;" style="color:var(--gold-color,#C9A84C);font-weight:600;">Voir les avantages Pro+ →</a>`;
            zone.appendChild(nudge);
        }
        return;
    }
    const currentData = getCurrentInputs();
    currentData._projectName = projectName;
    currentData._id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    currentData._createdAt = new Date().toISOString();
    currentData._updatedAt = new Date().toISOString();
    currentData._syncedAt = null;
    currentData._isLocal = true;
    savedProjects.push(currentData);
    localStorage.setItem('simuImmoProjects', JSON.stringify(savedProjects));
    document.getElementById('project-name').value = '';
    renderProjectsList();
    showToast(`Projet "${projectName}" sauvegardé.`, 'success');
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

    // Compter les critères gagnants pour chaque projet
    let winsA = 0, winsB = 0;
    const comparableRows = rows.filter(r => r.hib !== null && r.rawA !== null && r.rawB !== null && r.rawA !== r.rawB);
    comparableRows.forEach(r => {
        if (r.hib ? r.rawA > r.rawB : r.rawA < r.rawB) winsA++;
        else winsB++;
    });
    const total = comparableRows.length;

    const isTie = winsA === winsB;
    const winnerIsA = winsA > winsB;
    const winnerCfPositive = winnerIsA ? mA.cfNetNet >= 0 : mB.cfNetNet >= 0;
    const winnerColor = winnerCfPositive ? '#22c55e' : '#3b82f6';

    function buildCard(name, metrics, isWinner, isTie, rows, winnerColor) {
        const badge = isWinner ? `<div class="comparator-badge-winner">&#9733; Recommandé</div>` : '';
        const cardClass = isTie ? 'comparator-card' : (isWinner ? 'comparator-card comparator-card-winner' : 'comparator-card comparator-card-loser');
        const borderStyle = isWinner && !isTie ? `style="border-color:${winnerColor};background:${winnerColor === '#22c55e' ? '#f0fdf4' : '#eff6ff'}"` : '';

        const kpiLines = rows.map(r => {
            const val  = metrics === 'A' ? r.valA : r.valB;
            const rawMe = metrics === 'A' ? r.rawA : r.rawB;
            const rawOther = metrics === 'A' ? r.rawB : r.rawA;
            let check = '';
            if (r.hib !== null && rawMe !== null && rawOther !== null && rawMe !== rawOther) {
                const iWin = r.hib ? rawMe > rawOther : rawMe < rawOther;
                check = iWin ? ' <span class="comparator-check">✓</span>' : '';
            }
            return `<div class="comparator-card-row"><span class="comparator-card-lbl">${r.label}</span><span class="comparator-card-val">${val}${check}</span></div>`;
        }).join('');

        return `<div class="${cardClass}" ${borderStyle}>
            <div class="comparator-card-header">
                <div class="comparator-card-name">${name}</div>
                ${badge}
            </div>
            <div class="comparator-card-kpis">${kpiLines}</div>
        </div>`;
    }

    const cardA = buildCard(nameA, 'A', !isTie && winnerIsA,  isTie, rows, winnerColor);
    const cardB = buildCard(nameB, 'B', !isTie && !winnerIsA, isTie, rows, winnerColor);

    let tieNote = '';
    if (isTie) {
        tieNote = `<div class="comparator-tie-note">Projets comparables — Choisissez selon vos critères personnels</div>`;
    }

    document.getElementById('comparator-results').innerHTML = `${tieNote}<div class="comparator-cards">${cardA}${cardB}</div>`;
});

// Fermeture modales par touche Echap
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal-regimes').classList.contains('open'))     window.closeRegimeModal(null, null);
    if (document.getElementById('modal-deductibles').classList.contains('open')) window.closeDeductiblesModal(null, null);
    if (document.getElementById('modal-comparator').classList.contains('open'))  window.closeComparatorModal(null, null);
    if (document.getElementById('modal-compte').style.display === 'flex')        window.closeAccountModal();
    if (document.getElementById('modal-pricing').style.display === 'flex')       window.closePricingModal();
});

// Tous les inputs du formulaire déclenchent triggerCalculations
document.querySelectorAll('input:not(#project-name):not(#photo-input), select, textarea:not(#commentaires-input)').forEach(el => {
    el.addEventListener('input', triggerCalculations);
});

// --- PRÉVISUALISATION PDF ---
let _previewStyleEl = null;

function openPdfPreview() {
    const { mount, container, styleEl } = buildPDFDOM(uploadedPhotos);

    // Cloner le style pour le garder actif dans la modale
    if (_previewStyleEl) _previewStyleEl.remove();
    _previewStyleEl = styleEl.cloneNode(true);
    _previewStyleEl.id = 'pdf-preview-temp-style';
    document.head.appendChild(_previewStyleEl);

    // Déplacer le container dans la zone de scroll de la modale
    container.style.cssText = 'width:680px;max-width:100%;background:white;';
    const scrollEl = document.getElementById('pdf-preview-scroll');
    scrollEl.innerHTML = '';
    scrollEl.appendChild(container);
    mount.remove();

    // Nettoyer uniquement le styleEl original (container est réutilisé dans la modale)
    styleEl.remove();

    document.getElementById('modal-pdf-preview').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePdfPreview() {
    document.getElementById('modal-pdf-preview').style.display = 'none';
    document.getElementById('pdf-preview-scroll').innerHTML = '';
    if (_previewStyleEl) { _previewStyleEl.remove(); _previewStyleEl = null; }
    document.body.style.overflow = '';
}

function openPrintFlow() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Le navigateur a bloqué la fenêtre d\'impression. Autorisez les pop-ups puis réessayez.', 'error');
        return;
    }

    try {
        const { documentHTML } = buildPrintDocument(uploadedPhotos);
        printWindow.document.open();
        printWindow.document.write(documentHTML);
        printWindow.document.close();
        showToast('La fenêtre d\'impression a été ouverte.', 'success');
    } catch (err) {
        printWindow.close();
        console.error('Erreur impression :', err);
        showToast('L\'ouverture de la fenêtre d\'impression a échoué.', 'error');
    }
}

function supportsNativePdfShare() {
    if (!(navigator.share && navigator.canShare)) return false;
    if (!(window.jspdf && window.jspdf.jsPDF)) return false;
    try {
        const testFile = new File(['test'], 'investisseur-pro.pdf', { type: 'application/pdf' });
        return navigator.canShare({ files: [testFile] });
    } catch (err) {
        return false;
    }
}

async function sharePdfFromMobile() {
    if (!supportsNativePdfShare()) {
        showToast('Le partage direct du PDF n\'est pas pris en charge sur cet appareil.', 'error');
        return;
    }

    try {
        const file = await buildSharePDFFile(uploadedPhotos);
        await navigator.share({
            files: [file],
            title: file.name.replace(/\.pdf$/i, ''),
            text: 'Rapport Investisseur Pro'
        });
    } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('Erreur partage PDF :', err);
        showToast('Le partage du PDF a échoué.', 'error');
    }
}

document.getElementById('btn-preview-pdf').addEventListener('click', () => showPdfGateOrProceed(openPdfPreview));
document.getElementById('btn-preview-close').addEventListener('click', closePdfPreview);

document.getElementById('btn-preview-dl').addEventListener('click', async function() {
    closePdfPreview();
    const btn = this;
    btn.disabled = true;
    openPrintFlow();
    btn.disabled = false;
});

document.getElementById('btn-preview-share').addEventListener('click', async function() {
    closePdfPreview();
    const btn = this;
    btn.disabled = true;
    await sharePdfFromMobile();
    btn.disabled = false;
});

// Fermeture modale preview via Échap
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('modal-pdf-preview').style.display !== 'none') {
        closePdfPreview();
    }
});

// --- BOUTONS PDF (barre d'action flottante) ---
document.getElementById('btn-save-pdf').addEventListener('click', function() {
    showPdfGateOrProceed(openPrintFlow);
});

document.getElementById('btn-share-pdf').addEventListener('click', async function() {
    this.disabled = true;
    await sharePdfFromMobile();
    this.disabled = false;
});

(function initPdfShareButtons() {
    if (!supportsNativePdfShare()) return;
    document.getElementById('btn-share-pdf').style.display = 'inline-flex';
    document.getElementById('btn-preview-share').style.display = 'inline-flex';
})();

// Bouton "Continuer quand même" de la gate PDF
document.getElementById('btn-pdf-gate-continue').addEventListener('click', function() {
    const action = _pendingPdfAction;
    window.closePdfGateModal();
    if (action) action();
});

// Fermeture gate PDF via Échap
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('modal-pdf-gate').style.display !== 'none') {
        window.closePdfGateModal();
    }
});

// --- EXPORT CSV ---
document.getElementById('btn-export-csv').addEventListener('click', function() {
    if (!projectionData.length) { showToast('Lancez d\'abord une simulation.', 'error'); return; }
    const bom = '\ufeff';
    const header = ['Année', 'Capital Amorti (€)', 'Capital Restant (€)', 'Intérêts (€)', 'Impôts (€)', 'Cash-Flow Net (€)'].join(';');
    const rows = projectionData.map(r => [
        `An ${r.annee}`,
        Math.round(r.capitalAmortiAnnee),
        Math.round(r.capitalRestant),
        Math.round(r.interetsAnnee),
        Math.round(r.impotsAnnee),
        Math.round(r.cfNetNetAnnee)
    ].join(';'));
    const csv = bom + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'projection-investissement.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exporté avec succès.', 'success');
});

// --- THÈME DARK/LIGHT ---
function initTheme() {
    const saved = localStorage.getItem('simuImmoTheme');
    const btn = document.getElementById('btn-theme-toggle');
    if (saved === 'dark') {
        document.documentElement.classList.add('theme-dark');
        if (btn) btn.textContent = '☀️';
    } else if (saved === 'light') {
        document.documentElement.classList.add('theme-light');
        if (btn) btn.textContent = '🌙';
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (btn) btn.textContent = prefersDark ? '☀️' : '🌙';
    }
}

document.getElementById('btn-theme-toggle').addEventListener('click', function() {
    const html = document.documentElement;
    const isDark = html.classList.contains('theme-dark') ||
        (!html.classList.contains('theme-light') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        html.classList.remove('theme-dark');
        html.classList.add('theme-light');
        localStorage.setItem('simuImmoTheme', 'light');
        this.textContent = '🌙';
    } else {
        html.classList.remove('theme-light');
        html.classList.add('theme-dark');
        localStorage.setItem('simuImmoTheme', 'dark');
        this.textContent = '☀️';
    }
});

// --- BARRE DE PROGRESSION FORMULAIRE ---
function updateFormProgress() {
    const sections = [
        ['prix'],
        ['apport', 'taux-input', 'duree'],
        ['loyer', 'copro'],
        ['revenus', 'regime'],
    ];
    let filled = 0;
    sections.forEach(ids => {
        const ok = ids.some(id => {
            const el = document.getElementById(id);
            return el && parseFloat(el.value) > 0;
        });
        if (ok) filled++;
    });
    const pct = Math.round((filled / sections.length) * 100);
    const fill = document.getElementById('form-progress-fill');
    const label = document.getElementById('form-progress-label');
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = filled + ' / ' + sections.length + ' sections remplies';
}

// --- ANIMATION KPI ---
function animateValue(el, target, suffix, duration) {
    if (!el) return;
    const start = performance.now();
    const from = parseFloat(el.dataset.animated) || 0;
    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = from + (target - from) * ease;
        el.textContent = (target % 1 === 0 ? Math.round(current) : current.toFixed(2)) + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.dataset.animated = target;
    }
    requestAnimationFrame(step);
}

function setWizardMode(mode) {
    wizardMode = mode;
    sessionStorage.setItem('simuImmoWizardMode', mode);
    document.querySelectorAll('.wizard-expert-only').forEach(el => {
        el.style.display = mode === 'complet' ? '' : 'none';
    });
}

function goToStep(n) {
    currentWizardStep = n;
    document.querySelectorAll('.wizard-step').forEach((el, i) => {
        el.style.display = (i + 1 === n) ? '' : 'none';
    });
    document.querySelectorAll('.wizard-step-dot').forEach((el, i) => {
        el.classList.toggle('active', i + 1 < n);
        el.classList.toggle('current', i + 1 === n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- ACCUEIL ---
function showAccueil() {
    document.getElementById('view-accueil').style.display = '';
    document.querySelector('.tabs-nav').style.display = 'none';
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const btnAccueil = document.getElementById('btn-accueil');
    if (btnAccueil) btnAccueil.style.display = 'none';
}

function hideAccueil() {
    document.getElementById('view-accueil').style.display = 'none';
    document.querySelector('.tabs-nav').style.display = '';
    const btnAccueil = document.getElementById('btn-accueil');
    if (btnAccueil) btnAccueil.style.display = '';
    document.querySelector('[data-target="view-inputs"]').click();
}

function startWizard(mode) {
    setWizardMode(mode);
    goToStep(1);
    hideAccueil();
}

document.getElementById('btn-start-rapide').addEventListener('click', () => startWizard('rapide'));
document.getElementById('btn-start-complet').addEventListener('click', () => startWizard('complet'));
document.getElementById('btn-reprendre').addEventListener('click', () => {
    const savedMode = sessionStorage.getItem('simuImmoWizardMode') || 'complet';
    setWizardMode(savedMode);
    goToStep(1);
    hideAccueil();
});
document.getElementById('btn-accueil').addEventListener('click', showAccueil);

function initExpertCollapse() {
    const btn = document.getElementById('btn-expand-expert');
    if (!btn) return;

    function updateCollapseVisibility() {
        const isMobile = window.innerWidth <= 768;
        btn.style.display = isMobile ? '' : 'none';
        if (!isMobile) {
            document.querySelectorAll('.expert-collapsible').forEach(el => {
                el.classList.add('expanded');
            });
        }
    }

    btn.addEventListener('click', () => {
        document.querySelectorAll('.expert-collapsible').forEach(el => {
            el.classList.add('expanded');
            if (el.tagName === 'DETAILS') el.open = true;
        });
        btn.style.display = 'none';
    });

    window.addEventListener('resize', updateCollapseVisibility);
    updateCollapseVisibility();
}

function initWizard() {
    document.querySelectorAll('.wizard-btn-next').forEach(btn => {
        btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.next)));
    });
    document.querySelectorAll('.wizard-btn-prev').forEach(btn => {
        btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.prev)));
    });
    const btnAnalyser = document.getElementById('btn-wizard-analyser');
    if (btnAnalyser) {
        btnAnalyser.addEventListener('click', () => {
            calculateAndSave();
            document.querySelector('[data-target="view-results"]').click();
        });
    }
    const savedMode = sessionStorage.getItem('simuImmoWizardMode') || 'rapide';
    setWizardMode(savedMode);
    goToStep(1);
}

// --- INITIALISATION ---
function initApp() {
    migrateProjects();
    renderProjectsList();
    initTheme();
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
            const btnReprendre = document.getElementById('btn-reprendre');
            if (btnReprendre) btnReprendre.style.display = '';
        } catch (e) {}
    }
    updateFormProgress();
    initWizard();
    initExpertCollapse();
    showAccueil();
}

// Déclencher la barre de progression à chaque saisie
document.querySelectorAll('#calc-form input, #calc-form select').forEach(el => {
    el.addEventListener('change', updateFormProgress);
});

window.onload = initApp;
