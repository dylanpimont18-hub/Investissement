export const CSG_CRDS_RATE = 0.172; // Taux CSG+CRDS sur revenus du capital (2024)

function computeParts(enfants) {
    const n = enfants || 0;
    let parts = 2;
    if (n === 1) parts += 0.5;
    else if (n >= 2) parts += 1.0 + (n - 2);
    return parts;
}

// Impôt progressif sur le revenu selon le barème 2024
function computeProgressiveImpot(revenu, parts) {
    if (revenu <= 0 || parts <= 0) return 0;
    const q = revenu / parts;
    let impotParPart = 0;
    if (q > 177106) impotParPart += (q - 177106) * 0.45;
    if (q > 82341)  impotParPart += (Math.min(q, 177106) - 82341) * 0.41;
    if (q > 28797)  impotParPart += (Math.min(q, 82341) - 28797) * 0.30;
    if (q > 11294)  impotParPart += (Math.min(q, 28797) - 11294) * 0.11;
    return impotParPart * parts;
}

// Surcoût IR marginal dû à l'investissement : IR(revenus + immo) − IR(revenus seuls)
function computeImpotMarginal(revenusBase, revenusImmo, parts) {
    const irSans = computeProgressiveImpot(Math.max(0, revenusBase), parts);
    const irAvec = computeProgressiveImpot(Math.max(0, revenusBase + revenusImmo), parts);
    return irAvec - irSans;
}

export function calculateTMI(revenus, enfants) {
    const parts = computeParts(enfants);
    const quotient = revenus / parts;
    if (quotient <= 11294) return 0;
    if (quotient <= 28797) return 11;
    if (quotient <= 82341) return 30;
    if (quotient <= 177106) return 41;
    return 45;
}

// ALGORITHME MOTEUR : Calcule le CF Net-Net pour n'importe quelle configuration
// tmi conservé en signature pour compatibilité des appelants, non utilisé en interne
export function computeCF(prixVendeur, loyerMensuel, inputs, tmi) {
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

    const revenusBase = inputs['revenus'] || 0;
    const parts = computeParts(inputs['enfants']);
    let impotsAnnee = 0;

    if (inputs['regime'] === 'micro-foncier') {
        const baseImposable = loyersEncaisses * 0.7;
        impotsAnnee = computeImpotMarginal(revenusBase, baseImposable, parts) + baseImposable * CSG_CRDS_RATE;
    } else if (inputs['regime'] === 'reel') {
        const chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + inputs['travaux'] + inputs['frais-bancaires'];
        const revenusNets = loyersEncaisses - chargesAnnuees - interetsAnnee1;
        if (revenusNets > 0) {
            impotsAnnee = computeImpotMarginal(revenusBase, revenusNets, parts) + revenusNets * CSG_CRDS_RATE;
        } else {
            // Déficit foncier : économie IR sur la part hors intérêts, plafonnée à 10 700 €
            const soldeHorsInterets = loyersEncaisses - chargesAnnuees;
            if (soldeHorsInterets < 0) {
                const deduction = Math.min(10700, Math.abs(soldeHorsInterets));
                impotsAnnee = -computeImpotMarginal(revenusBase - deduction, deduction, parts);
            }
        }
    } else if (inputs['regime'] === 'sci-is') {
        // IS sur bénéfice comptable : 15% jusqu'à 42 500 €, 25% au-delà
        // Amortissement simplifié : 80% du prix (bâti) sur 30 ans
        const amortissement = prixVendeur * 0.80 / 30;
        const chargesDeductibles = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + interetsAnnee1 + (inputs['travaux'] || 0) + (inputs['frais-bancaires'] || 0);
        const benefice = loyersEncaisses - chargesDeductibles - amortissement;
        if (benefice > 0) {
            impotsAnnee = Math.min(benefice, 42500) * 0.15 + Math.max(0, benefice - 42500) * 0.25;
        }
    }

    const cfNet = (loyersEncaisses / 12) - mensualiteTotale - (chargesExploitationAnnuelles / 12);
    return cfNet - (impotsAnnee / 12);
}

// --- MÉTRIQUES PROJET (pour comparateur) ---
export function computeProjectMetrics(projectData) {
    const inputs = projectData;
    const revenusBase = inputs['revenus'] || 0;
    const parts = computeParts(inputs['enfants'] || 0);
    const prixNet = (inputs['prix'] || 0) - (inputs['nego'] || 0);
    const fraisNotaire = prixNet * ((inputs['notaire'] || 0) / 100);
    const fraisFixes = (inputs['agence'] || 0) + (inputs['travaux'] || 0) + (inputs['meubles'] || 0) + (inputs['frais-bancaires'] || 0);
    const coutTotal = prixNet + fraisNotaire + fraisFixes;
    const montantFinance = Math.max(0, coutTotal - (inputs['apport'] || 0));
    const loyer = inputs['loyer'] || 0;
    const loyersAnnuelsTheoriques = loyer * 12;
    const loyersEncaisses = loyersAnnuelsTheoriques * (1 - ((inputs['vacance'] || 0) / 100));
    const chargesExploitationAnnuelles = ((inputs['copro'] || 0) * 12) + (inputs['fonciere'] || 0) + (inputs['pno'] || 0) + (loyersEncaisses * ((inputs['gestion'] || 0) / 100));
    const nMois = (inputs['duree'] || 0) * 12;
    const tauxMensuel = ((inputs['taux-input'] || 0) / 100) / 12;
    let mensualiteCredit = 0;
    if (tauxMensuel > 0 && nMois > 0) mensualiteCredit = (montantFinance * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -nMois));
    else if (nMois > 0) mensualiteCredit = montantFinance / nMois;
    const coutAssuranceMensuel = (montantFinance * ((inputs['assurance'] || 0) / 100)) / 12;
    const mensualiteTotale = mensualiteCredit + coutAssuranceMensuel;

    const cfNetNet = computeCF(prixNet, loyer, inputs, 0);
    const rentaBrute = coutTotal > 0 ? (loyersAnnuelsTheoriques / coutTotal) * 100 : 0;
    const rentaNette = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles) / coutTotal) * 100 : 0;

    let capitalRestant = montantFinance;
    let firstYearInterets = 0;
    for (let m = 0; m < 12; m++) {
        if (capitalRestant > 0) {
            let interetMois = capitalRestant * tauxMensuel;
            firstYearInterets += interetMois;
            capitalRestant -= (mensualiteCredit - interetMois);
        }
    }
    let firstYearImpots = 0;
    if (inputs['regime'] === 'micro-foncier') {
        const baseImposable = loyersEncaisses * 0.7;
        firstYearImpots = computeImpotMarginal(revenusBase, baseImposable, parts) + baseImposable * CSG_CRDS_RATE;
    } else if (inputs['regime'] === 'reel') {
        const chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + (inputs['travaux'] || 0) + (inputs['frais-bancaires'] || 0);
        const revenusNets = loyersEncaisses - chargesAnnuees - firstYearInterets;
        if (revenusNets > 0) {
            firstYearImpots = computeImpotMarginal(revenusBase, revenusNets, parts) + revenusNets * CSG_CRDS_RATE;
        } else {
            const soldeHorsInterets = loyersEncaisses - chargesAnnuees;
            if (soldeHorsInterets < 0) {
                const deduction = Math.min(10700, Math.abs(soldeHorsInterets));
                firstYearImpots = -computeImpotMarginal(revenusBase - deduction, deduction, parts);
            }
        }
    } else if (inputs['regime'] === 'sci-is') {
        const amortissement = prixNet * 0.80 / 30;
        const chargesDeductibles = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + firstYearInterets + (inputs['travaux'] || 0) + (inputs['frais-bancaires'] || 0);
        const benefice = loyersEncaisses - chargesDeductibles - amortissement;
        if (benefice > 0) {
            firstYearImpots = Math.min(benefice, 42500) * 0.15 + Math.max(0, benefice - 42500) * 0.25;
        }
    }
    const rentaNetNet = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles - firstYearImpots) / coutTotal) * 100 : 0;

    const apportVal = inputs['apport'] || 0;
    const coc = apportVal > 0 ? ((cfNetNet * 12) / apportVal) * 100 : Infinity;
    const grm = loyersAnnuelsTheoriques > 0 ? coutTotal / loyersAnnuelsTheoriques : Infinity;
    const dscr = (mensualiteTotale * 12) > 0 ? (loyersEncaisses - chargesExploitationAnnuelles) / (mensualiteTotale * 12) : 0;

    const cfMicro = computeCF(prixNet, loyer, Object.assign({}, inputs, { regime: 'micro-foncier' }), 0);
    const cfReel  = computeCF(prixNet, loyer, Object.assign({}, inputs, { regime: 'reel' }), 0);
    const cfSciIs = computeCF(prixNet, loyer, Object.assign({}, inputs, { regime: 'sci-is' }), 0);
    const maxCf = Math.max(cfMicro, cfReel, cfSciIs);
    const bestRegime = maxCf === cfMicro ? 'Micro-Foncier' : (maxCf === cfReel ? 'Foncier Réel' : 'SCI à l\'IS');

    let pts = 0;
    if (cfNetNet >= 300) pts += 3; else if (cfNetNet >= 100) pts += 2; else if (cfNetNet >= 0) pts += 1;
    if (rentaNette >= 7) pts += 3; else if (rentaNette >= 5) pts += 2; else if (rentaNette >= 3.5) pts += 1;
    let scoreLabel;
    if (pts >= 5) scoreLabel = '🏆 Excellent'; else if (pts >= 3) scoreLabel = '👍 Bon'; else if (pts >= 1) scoreLabel = '⚠️ Moyen'; else scoreLabel = '🚫 Risqué';

    return { prixNet, coutTotal, loyer, rentaBrute, rentaNette, rentaNetNet, cfNetNet, coc, grm, dscr, bestRegime, scoreLabel };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getResaleAbatementsYears(year) {
    const y = Math.max(1, Math.floor(year));

    let ir = 0;
    if (y <= 5) ir = 0;
    else if (y <= 21) ir = (y - 5) * 0.06;
    else if (y === 22) ir = 0.98;
    else ir = 1;

    let ps = 0;
    if (y <= 5) ps = 0;
    else if (y <= 21) ps = (y - 5) * 0.0165;
    else if (y === 22) ps = 0.28;
    else if (y <= 30) ps = 0.28 + ((y - 22) * 0.09);
    else ps = 1;

    return { ir: clamp(ir, 0, 1), ps: clamp(ps, 0, 1) };
}

function computeResaleTax(plusValueTaxable, year, regime, tauxPvInput) {
    if (plusValueTaxable <= 0) return 0;

    if (regime === 'sci-is') {
        const sciRate = clamp((tauxPvInput || 25) / 100, 0, 1);
        return plusValueTaxable * sciRate;
    }

    const abatements = getResaleAbatementsYears(year);
    const baseIR = plusValueTaxable * (1 - abatements.ir);
    const basePS = plusValueTaxable * (1 - abatements.ps);
    return (baseIR * 0.19) + (basePS * CSG_CRDS_RATE);
}

export function computeResaleTimeline(prixNet, capitalRestantSeries, cfCumuleSeries, inputs) {
    const rows = [];
    const basePrice = (inputs['prix-revente-estime'] && inputs['prix-revente-estime'] > 0) ? inputs['prix-revente-estime'] : prixNet;
    const growth = (inputs['appreciation'] || 0) / 100;
    const fraisRate = Math.max(0, (inputs['frais-revente'] || 0) / 100);
    const tauxPv = Math.max(0, inputs['taux-pv'] || 0);
    const apport = inputs['apport'] || 0;
    const regime = inputs['regime'] || 'micro-foncier';
    const fraisNotaireAchat = prixNet * ((inputs['notaire'] || 0) / 100);
    const acquisitionBase = prixNet + fraisNotaireAchat + (inputs['agence'] || 0) + (inputs['travaux'] || 0);

    let firstInterestingYear = null;
    let bestYear = 1;
    let bestGain = -Infinity;

    const amortAnnuelSciIs = prixNet * 0.80 / 30;

    const horizon = Math.min(capitalRestantSeries.length, cfCumuleSeries.length, 25);
    for (let i = 0; i < horizon; i++) {
        const year = i + 1;
        const prixVente = basePrice * Math.pow(1 + growth, i);
        const fraisVente = prixVente * fraisRate;
        const prixVenteNetFrais = prixVente - fraisVente;
        // En SCI-IS, la base fiscale est la valeur nette comptable (après amortissements cumulés)
        let plusValueTaxable;
        if (regime === 'sci-is') {
            const amortCumule = Math.min(amortAnnuelSciIs * year, prixNet * 0.80);
            const valeurComptableNette = Math.max(0, acquisitionBase - amortCumule);
            plusValueTaxable = prixVenteNetFrais - valeurComptableNette;
        } else {
            plusValueTaxable = prixVenteNetFrais - acquisitionBase;
        }
        const impotPv = computeResaleTax(plusValueTaxable, year, regime, tauxPv);
        const netVendeur = prixVente - fraisVente - impotPv;
        const crd = Math.max(0, capitalRestantSeries[i] || 0);
        const cashNetSortie = netVendeur - crd;
        const cfCumule = cfCumuleSeries[i] || 0;
        const gainGlobal = cfCumule + cashNetSortie - apport;
        const interesting = gainGlobal >= 0;

        if (interesting && firstInterestingYear === null) firstInterestingYear = year;
        if (gainGlobal > bestGain) {
            bestGain = gainGlobal;
            bestYear = year;
        }

        rows.push({
            year,
            prixVente,
            fraisVente,
            plusValueTaxable,
            impotPv,
            netVendeur,
            crd,
            cashNetSortie,
            gainGlobal,
            interesting
        });
    }

    return { rows, firstInterestingYear, bestYear, bestGain };
}
