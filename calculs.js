export const CSG_CRDS_RATE = 0.172; // Taux CSG+CRDS sur revenus du capital (2024)

export function calculateTMI(revenus, enfants) {
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

// ALGORITHME MOTEUR : Calcule le CF Net-Net pour n'importe quelle configuration
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

    const tauxGlobalImpot = (tmi / 100) + CSG_CRDS_RATE;
    let impotsAnnee = 0;

    if (inputs['regime'] === 'micro-foncier') {
        impotsAnnee = (loyersEncaisses * 0.7) * tauxGlobalImpot;
    } else if (inputs['regime'] === 'reel') {
        let chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + inputs['travaux'] + inputs['frais-bancaires'];
        let revenusNets = loyersEncaisses - chargesAnnuees - interetsAnnee1;
        if (revenusNets > 0) {
            impotsAnnee = revenusNets * tauxGlobalImpot;
        } else {
            const soldeHorsInterets = loyersEncaisses - chargesAnnuees;
            if (soldeHorsInterets < 0) {
                impotsAnnee = -(Math.min(10700, Math.abs(soldeHorsInterets)) * (tmi / 100));
            }
        }
    } else if (inputs['regime'] === 'sci-is') {
        // IS sur bénéfice comptable : 15% jusqu'à 42 500 €, 25% au-delà
        // Amortissement simplifié : 80% du prix (bâti) sur 30 ans
        const amortissement = prixVendeur * 0.80 / 30;
        const chargesDeductibles = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + interetsAnnee1;
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
    const tmi = calculateTMI(inputs.revenus || 0, inputs.enfants || 0);
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

    const cfNetNet = computeCF(prixNet, loyer, inputs, tmi);
    const rentaBrute = coutTotal > 0 ? (loyersAnnuelsTheoriques / coutTotal) * 100 : 0;
    const rentaNette = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles) / coutTotal) * 100 : 0;

    const tauxGlobalImpot = (tmi / 100) + CSG_CRDS_RATE;
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
        firstYearImpots = (loyersEncaisses * 0.7) * tauxGlobalImpot;
    } else if (inputs['regime'] === 'reel') {
        let chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + (inputs['travaux'] || 0) + (inputs['frais-bancaires'] || 0);
        let revenusNets = loyersEncaisses - chargesAnnuees - firstYearInterets;
        if (revenusNets > 0) firstYearImpots = revenusNets * tauxGlobalImpot;
        else {
            const soldeHorsInterets = loyersEncaisses - chargesAnnuees;
            if (soldeHorsInterets < 0) firstYearImpots = -(Math.min(10700, Math.abs(soldeHorsInterets)) * (tmi / 100));
        }
    } else if (inputs['regime'] === 'sci-is') {
        const amortissement = prixNet * 0.80 / 30;
        const chargesDeductibles = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12) + firstYearInterets;
        const benefice = loyersEncaisses - chargesDeductibles - amortissement;
        if (benefice > 0) {
            firstYearImpots = Math.min(benefice, 42500) * 0.15 + Math.max(0, benefice - 42500) * 0.25;
        }
    }
    const rentaNetNet = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles - firstYearImpots) / coutTotal) * 100 : 0;

    const apportVal = inputs['apport'] || 0;
    const coc = apportVal > 0 ? ((cfNetNet * 12) / apportVal) * 100 : Infinity;
    const grm = loyersAnnuelsTheoriques > 0 ? coutTotal / loyersAnnuelsTheoriques : Infinity;
    const dscr = (mensualiteTotale * 12) > 0 ? loyersEncaisses / (mensualiteTotale * 12) : 0;

    const cfMicro = computeCF(prixNet, loyer, Object.assign({}, inputs, { regime: 'micro-foncier' }), tmi);
    const cfReel  = computeCF(prixNet, loyer, Object.assign({}, inputs, { regime: 'reel' }), tmi);
    const cfSciIs = computeCF(prixNet, loyer, Object.assign({}, inputs, { regime: 'sci-is' }), tmi);
    const maxCf = Math.max(cfMicro, cfReel, cfSciIs);
    const bestRegime = maxCf === cfMicro ? 'Micro-Foncier' : (maxCf === cfReel ? 'Foncier Réel' : 'SCI à l\'IS');

    let pts = 0;
    if (cfNetNet >= 300) pts += 3; else if (cfNetNet >= 100) pts += 2; else if (cfNetNet >= 0) pts += 1;
    if (rentaNette >= 7) pts += 3; else if (rentaNette >= 5) pts += 2; else if (rentaNette >= 3.5) pts += 1;
    let scoreLabel;
    if (pts >= 5) scoreLabel = '🏆 Excellent'; else if (pts >= 3) scoreLabel = '👍 Bon'; else if (pts >= 1) scoreLabel = '⚠️ Moyen'; else scoreLabel = '🚫 Risqué';

    return { prixNet, coutTotal, loyer, rentaBrute, rentaNette, rentaNetNet, cfNetNet, coc, grm, dscr, bestRegime, scoreLabel };
}
