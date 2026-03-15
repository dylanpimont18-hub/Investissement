let myChart = null;
let uploadedPhotos = []; // Stockage des photos en mémoire

// Synchronisation Slider et Input Taux
const tauxInput = document.getElementById('taux-input');
const tauxSlider = document.getElementById('taux-slider');

tauxInput.addEventListener('input', (e) => { tauxSlider.value = e.target.value; calculateAndSave(); });
tauxSlider.addEventListener('input', (e) => { tauxInput.value = e.target.value; calculateAndSave(); });

document.getElementById('type-bien').addEventListener('change', (e) => {
    const notaireInput = document.getElementById('notaire');
    if (e.target.value === 'ancien') notaireInput.value = 8.0;
    if (e.target.value === 'neuf') notaireInput.value = 2.5;
    calculateAndSave();
});

// Synchronisation Type de Location -> Régimes fiscaux
document.getElementById('type-location').addEventListener('change', (e) => {
    const regimeSelect = document.getElementById('regime');
    regimeSelect.innerHTML = ''; // Reset
    if (e.target.value === 'nue') {
        regimeSelect.add(new Option('Micro-foncier (-30%)', 'micro-foncier'));
        regimeSelect.add(new Option('Foncier Réel', 'reel'));
    } else {
        regimeSelect.add(new Option('Micro-BIC (-50%)', 'micro-bic'));
        regimeSelect.add(new Option('LMNP Réel (Amortissement)', 'lmnp-reel'));
    }
    calculateAndSave();
});

// --- Calcul de la TMI ---
function calculateTMI(revenus, enfants) {
    let parts = 2; 
    if (enfants === 1) parts += 0.5;
    else if (enfants === 2) parts += 1.0;
    else if (enfants > 2) parts += 1.0 + (enfants - 2);

    const quotientFamilial = revenus / parts;
    if (quotientFamilial <= 11294) return 0;
    if (quotientFamilial <= 28797) return 11;
    if (quotientFamilial <= 82341) return 30;
    if (quotientFamilial <= 177106) return 41;
    return 45;
}

function calculateAndSave() {
    const inputs = {
        prix: parseFloat(document.getElementById('prix').value) || 0,
        nego: parseFloat(document.getElementById('nego').value) || 0,
        agence: parseFloat(document.getElementById('agence').value) || 0,
        notairePct: parseFloat(document.getElementById('notaire').value) || 0,
        travaux: parseFloat(document.getElementById('travaux').value) || 0,
        meubles: parseFloat(document.getElementById('meubles').value) || 0,
        fraisBancaires: parseFloat(document.getElementById('frais-bancaires').value) || 0,
        apport: parseFloat(document.getElementById('apport').value) || 0,
        taux: parseFloat(tauxInput.value) || 0,
        duree: parseFloat(document.getElementById('duree').value) || 0,
        assurancePct: parseFloat(document.getElementById('assurance').value) || 0,
        loyer: parseFloat(document.getElementById('loyer').value) || 0,
        copro: parseFloat(document.getElementById('copro').value) || 0,
        fonciere: parseFloat(document.getElementById('fonciere').value) || 0,
        pno: parseFloat(document.getElementById('pno').value) || 0,
        vacancePct: parseFloat(document.getElementById('vacance').value) || 0,
        gestionPct: parseFloat(document.getElementById('gestion').value) || 0,
        revenus: parseFloat(document.getElementById('revenus').value) || 60000,
        enfants: parseInt(document.getElementById('enfants').value) || 2,
        typeLocation: document.getElementById('type-location').value,
        regime: document.getElementById('regime').value
    };

    // On ne sauvegarde pas les photos dans le localStorage pour éviter de dépasser le quota
    localStorage.setItem('simuImmoData', JSON.stringify(inputs));

    const tmi = calculateTMI(inputs.revenus, inputs.enfants);
    document.getElementById('tmi-display').innerText = tmi + ' %';

    // 1. Coûts et Financement
    const prixNet = inputs.prix - inputs.nego;
    const fraisNotaire = prixNet * (inputs.notairePct / 100);
    const coutTotal = prixNet + inputs.agence + fraisNotaire + inputs.travaux + inputs.meubles + inputs.fraisBancaires;
    const montantFinance = Math.max(0, coutTotal - inputs.apport);

    const nMois = inputs.duree * 12;
    const tauxMensuel = (inputs.taux / 100) / 12;
    let mensualiteCredit = 0;
    if (tauxMensuel > 0 && nMois > 0) {
        mensualiteCredit = (montantFinance * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -nMois));
    } else if (nMois > 0) {
        mensualiteCredit = montantFinance / nMois;
    }

    const coutAssuranceMensuel = (montantFinance * (inputs.assurancePct / 100)) / 12;
    const mensualiteTotale = mensualiteCredit + coutAssuranceMensuel;

    // 2. Amortissement du prêt (Année 1 - utile pour la déduction d'impôts au réel)
    let capitalRestant = montantFinance;
    let interetsAnnee1 = 0;
    
    for (let m = 0; m < 12; m++) {
        if (capitalRestant <= 0) break;
        let interetMois = capitalRestant * tauxMensuel;
        let capitalMois = mensualiteCredit - interetMois;
        interetsAnnee1 += interetMois;
        capitalRestant -= capitalMois;
    }

    // 3. Exploitation
    const loyersAnnuelsTheoriques = inputs.loyer * 12;
    const loyersEncaisses = loyersAnnuelsTheoriques * (1 - (inputs.vacancePct / 100));
    const fraisGestion = loyersEncaisses * (inputs.gestionPct / 100);
    const chargesExploitationAnnuelles = (inputs.copro * 12) + inputs.fonciere + inputs.pno + fraisGestion;

    // 4. Fiscalité Année 1
    const tauxGlobalImpot = (tmi / 100) + 0.172; // TMI + Prélèvements Sociaux
    let baseImposable = 0;

    if (inputs.regime === 'micro-foncier') {
        baseImposable = loyersEncaisses * 0.7; // Abattement 30%
    } else if (inputs.regime === 'micro-bic') {
        baseImposable = loyersEncaisses * 0.5; // Abattement 50%
    } else if (inputs.regime === 'reel') {
        baseImposable = Math.max(0, loyersEncaisses - chargesExploitationAnnuelles - interetsAnnee1 - (coutAssuranceMensuel * 12));
    } else if (inputs.regime === 'lmnp-reel') {
        // Amortissement simplifié : Immobilier sur 30 ans (hors terrain 15%), Meubles sur 5 ans, Travaux sur 15 ans
        const baseAmortImmo = prixNet * 0.85; 
        const amortissementAnnuel = (baseAmortImmo / 30) + (inputs.meubles / 5) + (inputs.travaux / 15);
        baseImposable = Math.max(0, loyersEncaisses - chargesExploitationAnnuelles - interetsAnnee1 - (coutAssuranceMensuel * 12) - amortissementAnnuel);
    }

    const impotsAnnuels = baseImposable * tauxGlobalImpot;
    const impotsMensuels = impotsAnnuels / 12;

    // 5. Indicateurs de rentabilité standard
    const rentaBrute = coutTotal > 0 ? (loyersAnnuelsTheoriques / coutTotal) * 100 : 0;
    const rentaNette = coutTotal > 0 ? ((loyersEncaisses - chargesExploitationAnnuelles) / coutTotal) * 100 : 0;
    const cfBrut = inputs.loyer - mensualiteTotale;
    const cfNet = (loyersEncaisses / 12) - mensualiteTotale - (chargesExploitationAnnuelles / 12);
    const cfNetNet = cfNet - impotsMensuels;

    // 6. Mise à jour de l'UI
    document.getElementById('renta-brute').innerText = rentaBrute.toFixed(2) + ' %';
    document.getElementById('renta-nette').innerText = rentaNette.toFixed(2) + ' %';
    
    updateColor('cf-brut', cfBrut); 
    updateColor('cf-net', cfNet);
    updateColor('cf-netnet', cfNetNet); 

    document.getElementById('out-cout-total').innerText = Math.round(coutTotal).toLocaleString('fr-FR');
    document.getElementById('out-financement').innerText = Math.round(montantFinance).toLocaleString('fr-FR');
    document.getElementById('out-mensualite').innerText = mensualiteTotale.toFixed(2);
    document.getElementById('out-impot').innerText = impotsAnnuels.toFixed(0);

    updateChart(loyersEncaisses/12, mensualiteTotale, (chargesExploitationAnnuelles/12), impotsMensuels, cfNetNet);
}

function updateColor(id, value) {
    const el = document.getElementById(id);
    el.innerText = value.toFixed(2) + ' €';
    el.className = 'value ' + (value >= 0 ? 'positive' : 'negative');
}

function updateChart(loyer, credit, charges, impots, cf) {
    const ctx = document.getElementById('cashflowChart').getContext('2d');
    const cfDisplay = cf > 0 ? cf : 0; 
    const textColor = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#f5f5f7' : '#1c1e21';

    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Mensualité', 'Charges', 'Impôts', 'Cash-Flow'],
            datasets: [{ data: [credit, charges, impots, cfDisplay], backgroundColor: ['#ff3b30', '#ff9500', '#af52de', '#34c759'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
    });
}

// --- GESTION DES PHOTOS ---
document.getElementById('photo-input').addEventListener('change', function(event) {
    const files = event.target.files;
    const gallery = document.getElementById('photo-gallery');
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
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.id = `photo-item-${index}`;
            
            photoItem.innerHTML = `
                <img src="${base64Src}" alt="Photo du bien">
                <button class="btn-remove" onclick="removePhoto(${index})" title="Supprimer">✖</button>
            `;
            gallery.appendChild(photoItem);
        };
        reader.readAsDataURL(file);
    }
    // Reset de l'input pour permettre de rajouter la même photo si effacée
    event.target.value = '';
});

window.removePhoto = function(index) {
    uploadedPhotos[index] = null; // On "supprime" sans décaler les index
    const item = document.getElementById(`photo-item-${index}`);
    if (item) item.remove();
    
    // Si toutes les photos sont null, on cache la section
    if (uploadedPhotos.every(p => p === null)) {
        document.getElementById('photos-export-section').style.display = 'none';
        uploadedPhotos = []; // Reset complet
    }
};

// Initialisation au lancement
function loadSavedData() {
    const saved = localStorage.getItem('simuImmoData');
    if (saved) {
        const data = JSON.parse(saved);
        
        // Initialiser Type de location d'abord pour créer les options du régime
        if (data.typeLocation) {
            document.getElementById('type-location').value = data.typeLocation;
            document.getElementById('type-location').dispatchEvent(new Event('change'));
        }

        for (const key in data) {
            let el = document.getElementById(key === 'typeBien' ? 'type-bien' : key);
            if(key === 'taux') {
                document.getElementById('taux-input').value = data[key];
                document.getElementById('taux-slider').value = data[key];
            } else if (el) { el.value = data[key]; }
        }
    } else {
        // Déclenchement manuel pour générer les régimes par défaut
        document.getElementById('type-location').dispatchEvent(new Event('change'));
    }
    calculateAndSave();
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', calculateAndSave));

// Export PDF incluant les photos
document.getElementById('btn-export').addEventListener('click', () => {
    // Masquer temporairement les boutons "Supprimer" des photos pour le PDF
    const removeBtns = document.querySelectorAll('.btn-remove');
    removeBtns.forEach(btn => btn.style.display = 'none');

    const element = document.getElementById('export-area');
    
    const opt = {
        margin:       10,
        filename:     'Rapport-Rentabilite-Premium.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true }, // useCORS pour bien gérer les images
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        // Remettre les boutons "Supprimer" une fois l'export terminé
        removeBtns.forEach(btn => btn.style.display = 'flex');
    });
});

window.onload = loadSavedData;