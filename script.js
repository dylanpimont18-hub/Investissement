let myChart = null;
let savedProjects = JSON.parse(localStorage.getItem('simuImmoProjects')) || [];

// --- GESTION DES ONGLETS ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
        
        // S'assurer que les calculs et graphiques sont à jour
        if(btn.dataset.target === 'view-results') calculateAndSave();
    });
});

// Synchronisations de base
const tauxInput = document.getElementById('taux-input');
const tauxSlider = document.getElementById('taux-slider');
tauxInput.addEventListener('input', (e) => { tauxSlider.value = e.target.value; calculateAndSave(); });
tauxSlider.addEventListener('input', (e) => { tauxInput.value = e.target.value; calculateAndSave(); });

document.getElementById('type-bien').addEventListener('change', (e) => {
    document.getElementById('notaire').value = e.target.value === 'ancien' ? 8.0 : 2.5;
    calculateAndSave();
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
    calculateAndSave();
});

// Calcul de la TMI
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
    document.querySelectorAll('#calc-form input:not(#project-name), #calc-form select').forEach(el => {
        if (el.id) data[el.id] = (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) || 0 : el.value;
    });
    return data;
}

// Outil de Négociation
function calculateNegotiation(inputs, loyersEncaisses, chargesExploitation) {
    const targetRenta = parseFloat(document.getElementById('target-renta').value) || 0;
    if(targetRenta <= 0) return;

    // Formule : Cout Total Cible = Revenus Nets / RentaCible
    const revenusNets Annuels = loyersEncaisses - chargesExploitation;
    const coutTotalMax = (revenusNets Annuels / (targetRenta / 100));

    // Frais fixes = Travaux + Meubles + Banque + Agence
    const fraisFixes = inputs['travaux'] + inputs['meubles'] + inputs['frais-bancaires'] + inputs['agence'];
    const notaireMult = 1 + (inputs['notaire'] / 100);

    // Prix Net Vendeur Cible = (CoutTotalMax - FraisFixes) / Multiplicateur Notaire
    const prixNetVendeurMax = (coutTotalMax - fraisFixes) / notaireMult;
    
    // Le prix affiché demandé pour atteindre ce net vendeur (sachant qu'on a déjà l'input prix de base)
    const prixAfficheActuel = inputs['prix'];
    const negoRequise = prixAfficheActuel - prixNetVendeurMax;

    const elPrixMax = document.getElementById('nego-prix-max');
    const elNego = document.getElementById('nego-montant');

    if(prixNetVendeurMax <= 0) {
        elPrixMax.innerText = "Impossible";
        elNego.innerText = "-- €";
    } else {
        elPrixMax.innerText = Math.round(prixNetVendeurMax).toLocaleString('fr-FR') + ' €';
        if(negoRequise <= 0) {
            elNego.innerText = "Objectif déjà atteint ! ✅";
            elNego.style.color = "var(--success-color)";
        } else {
            elNego.innerText = "- " + Math.round(negoRequise).toLocaleString('fr-FR') + ' €';
            elNego.style.color = "var(--danger-color)";
        }
    }
}

function calculateAndSave() {
    const inputs = getCurrentInputs();
    localStorage.setItem('simuImmoDraft', JSON.stringify(inputs));

    const tmi = calculateTMI(inputs.revenus, inputs.enfants);
    document.getElementById('tmi-display').innerText = tmi + ' %';

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

    // Négociateur
    calculateNegotiation(inputs, loyersEncaisses, chargesExploitationAnnuelles);

    // --- PROJECTION SUR 15 ANS ---
    let capitalRestant = montantFinance;
    const tauxGlobalImpot = (tmi / 100) + 0.172; 
    let baseAmortImmo = prixNet * 0.85; // Pour le LMNP
    let amortissementImmoAnnuel = baseAmortImmo / 30;
    let amortissementMeubles = inputs['meubles'] / 5;
    let amortissementTravaux = inputs['travaux'] / 15;
    let lmnpDeficitReportable = 0;

    let tbodyHTML = '';
    let firstYearImpots = 0;
    let firstYearInterets = 0;

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
        if(annee === 1) firstYearInterets = interetsAnnee;

        // Calcul Impôts pour cette année
        let impotsAnnee = 0;
        if (inputs['regime'] === 'micro-foncier') {
            impotsAnnee = (loyersEncaisses * 0.7) * tauxGlobalImpot;
        } else if (inputs['regime'] === 'micro-bic') {
            impotsAnnee = (loyersEncaisses * 0.5) * tauxGlobalImpot;
        } else if (inputs['regime'] === 'reel') {
            let chargesAnnuees = chargesExploitationAnnuelles + (coutAssuranceMensuel * 12);
            // Travaux et frais bancaires déduits uniquement l'année 1
            if(annee === 1) chargesAnnuees += inputs['travaux'] + inputs['frais-bancaires'];
            
            let revenusNets = loyersEncaisses - chargesAnnuees - interetsAnnee;
            if (revenusNets > 0) {
                impotsAnnee = revenusNets * tauxGlobalImpot;
            } else if (annee === 1) { // Simplification: deficit créé l'an 1
                let deficitImputable = Math.min(10700, Math.abs(loyersEncaisses - chargesAnnuees));
                impotsAnnee = -(deficitImputable * (tmi / 100)); 
            }
        } else if (inputs['regime'] === 'lmnp-reel') {
            let chargesAnnuees = chargesExploitationAnnuelles + interetsAnnee + (coutAssuranceMensuel * 12);
            if(annee === 1) chargesAnnuees += (fraisNotaire + inputs['agence'] + inputs['frais-bancaires']); // Frais d'acquisition
            
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

    // Mise à jour des KPIs Année 1
    const rentaBrute = coutTotal > 0 ? (loyersAnnuelsTheoriques / coutTotal) * 100 : 0;
    const rentaNette = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles) / coutTotal) * 100 : 0;
    
    const cfBrut = inputs['loyer'] - mensualiteTotale;
    const cfNet = (loyersEncaisses / 12) - mensualiteTotale - (chargesExploitationAnnuelles / 12);
    const cfNetNet = cfNet - (firstYearImpots / 12);

    document.getElementById('renta-brute').innerText = rentaBrute.toFixed(2) + ' %';
    document.getElementById('renta-nette').innerText = rentaNette.toFixed(2) + ' %';
    updateColor('cf-netnet', cfNetNet); 

    document.getElementById('out-prix-net').innerText = Math.round(prixNet).toLocaleString('fr-FR');
    document.getElementById('out-frais-fixes').innerText = Math.round(fraisFixes + fraisNotaire).toLocaleString('fr-FR');
    document.getElementById('out-cout-total').innerText = Math.round(coutTotal).toLocaleString('fr-FR');
    document.getElementById('out-financement').innerText = Math.round(montantFinance).toLocaleString('fr-FR');
    document.getElementById('out-mensualite').innerText = mensualiteTotale.toFixed(2);

    updateChart(mensualiteTotale, chargesExploitationAnnuelles/12, Math.max(0, firstYearImpots/12), cfNetNet);
}

document.getElementById('target-renta').addEventListener('input', calculateAndSave);

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
            labels: ['Banque (Mensualité)', 'Charges', 'Impôts', 'Cash-Flow'],
            datasets: [{ data: [credit, charges, impots, cfDisplay], backgroundColor: ['#ff3b30', '#ff9500', '#af52de', '#34c759'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
    });
}

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
        calculateAndSave();
        document.querySelector('[data-target="view-results"]').click(); // Bascule sur l'onglet analyse
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

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', calculateAndSave));
window.onload = initApp;
