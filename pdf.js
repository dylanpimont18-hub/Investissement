export function buildPDFDOM(uploadedPhotos) {
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

    const cocVal  = document.getElementById('metric-coc').innerText;
    const grmVal  = document.getElementById('metric-grm').innerText;
    const dscrVal = document.getElementById('metric-dscr').innerText;
    const beVal   = document.getElementById('metric-breakeven').innerText;

    const chartCanvas    = document.getElementById('cashflowChart');
    const chartImg       = chartCanvas ? chartCanvas.toDataURL('image/png') : null;
    const evolutionCanvas = document.getElementById('evolutionChart');
    const evolutionImg   = evolutionCanvas ? evolutionCanvas.toDataURL('image/png') : null;

    const regimeHTML          = document.getElementById('regime-compare-grid').innerHTML;
    const fiscalBreakdownHTML = document.getElementById('fiscal-breakdown').innerHTML;
    const optimizationHTML    = document.getElementById('optimization-tips-container').innerHTML;
    const negoHTML            = document.getElementById('nego-table-container').innerHTML;
    const projHTML            = document.getElementById('projection-tbody').innerHTML;
    const reventeSection      = document.getElementById('revente-results-section');
    const reventeVisible      = reventeSection && reventeSection.style.display !== 'none';
    const reventeSummary      = document.getElementById('revente-summary');
    const reventeTableBody    = document.getElementById('revente-tbody');

    const notesEl   = document.getElementById('commentaires-display');
    const notesText = notesEl ? notesEl.innerText.trim() : '';

    const activePhotos = uploadedPhotos.filter(p => p);
    const photosHTML   = activePhotos.map(p => `<img src="${p}" class="r-photo-img">`).join('');

    let scoreBg = '#fffbeb', scoreBorder = '#f59e0b', scoreColor = '#92400e';
    if (scoreClass.includes('score-excellent')) { scoreBg = '#f0fdf4'; scoreBorder = '#22c55e'; scoreColor = '#166534'; }
    else if (scoreClass.includes('score-bon'))  { scoreBg = '#eff6ff'; scoreBorder = '#3b82f6'; scoreColor = '#1e40af'; }
    else if (scoreClass.includes('score-risque')){ scoreBg = '#fef2f2'; scoreBorder = '#ef4444'; scoreColor = '#991b1b'; }

    const css = `
#pdf-render {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    font-size: 11px;
    color: #1e293b;
    background: white;
    width: 680px;
}
#pdf-render * { box-sizing: border-box; margin: 0; padding: 0; }

/* ── EN-TÊTE ── */
#pdf-render .r-header {
    background: #1e3a5f;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    border-radius: 6px;
}
#pdf-render .r-title { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
#pdf-render .r-sub   { font-size: 10px; color: rgba(255,255,255,0.60); margin-top: 3px; }
#pdf-render .r-date  { font-size: 9px; color: rgba(255,255,255,0.55); text-align: right; }

/* ── SCORE ── */
#pdf-render .r-score {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 15px;
    border-radius: 7px;
    border: 1.5px solid ${scoreBorder};
    background: ${scoreBg};
    margin-bottom: 14px;
}
#pdf-render .r-score-l { font-size: 14px; font-weight: 800; color: ${scoreColor}; }
#pdf-render .r-score-r { font-size: 10px; font-weight: 500; color: ${scoreColor}; max-width: 380px; text-align: right; }

/* ── KPI GRID ── */
#pdf-render .r-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
}
#pdf-render .r-kpi {
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 10px 8px 9px;
    text-align: center;
    background: #fafafa;
    page-break-inside: avoid;
}
#pdf-render .r-kpi.gold { border-top: 3px solid #f59e0b; background: #fffbeb; }
#pdf-render .r-kpi.blue { border-top: 3px solid #3b82f6; background: #eff6ff; }
#pdf-render .r-kpi-lbl { font-size: 7.5px; text-transform: uppercase; letter-spacing: .6px; color: #64748b; margin-bottom: 5px; }
#pdf-render .r-kpi-val { font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1.1; }
#pdf-render .r-kpi-val.neg { color: #ef4444; }
#pdf-render .r-kpi-val.pos { color: #16a34a; }
#pdf-render .r-kpi-s { font-size: 7px; color: #94a3b8; margin-top: 3px; }

/* ── RÉSUMÉ + GRAPHIQUE ── */
#pdf-render .r-summary-row { display: flex; gap: 10px; margin-bottom: 14px; }
#pdf-render .r-summary {
    flex: 1;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 12px 14px;
    background: white;
}
#pdf-render .r-summary h3 {
    font-size: 11px; font-weight: 700; color: #1e3a5f;
    margin-bottom: 9px; padding-bottom: 7px;
    border-bottom: 1px solid #e2e8f0;
}
#pdf-render .r-summary ul { list-style: none; }
#pdf-render .r-summary li {
    display: flex; justify-content: space-between;
    padding: 4.5px 0; border-bottom: 1px solid #f1f5f9;
    font-size: 9.5px; color: #475569;
}
#pdf-render .r-summary li:last-child { border-bottom: none; }
#pdf-render .r-summary li strong { font-weight: 700; color: #1e293b; }
#pdf-render .r-summary .total li { font-weight: 700; }
#pdf-render .r-summary .total strong { color: #1e3a5f; font-size: 10px; }
#pdf-render .r-chart {
    width: 148px; flex-shrink: 0;
    border: 1px solid #e2e8f0;
    border-radius: 7px; padding: 10px;
    display: flex; align-items: center; justify-content: center;
    background: #fafafa;
}
#pdf-render .r-chart img { width: 122px; height: 122px; object-fit: contain; }

/* ── CARTES SECTIONS ── */
#pdf-render .r-card {
    border: 1px solid #e2e8f0;
    border-left: 3px solid #3b82f6;
    border-radius: 7px;
    padding: 12px 14px;
    margin-bottom: 14px;
    background: white;
}
#pdf-render .r-card h3 {
    font-size: 11.5px; font-weight: 700; color: #1e3a5f;
    margin-bottom: 4px;
}
#pdf-render .r-card-sub { font-size: 8.5px; color: #94a3b8; margin-bottom: 10px; }

/* ── SAUTS DE PAGE ── */
#pdf-render .r-page-break { page-break-before: always; height: 1px; }

/* ── RÉGIMES ── */
#pdf-render .regime-compare-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px; margin-bottom: 10px;
}
#pdf-render .regime-card {
    border: 1px solid #e2e8f0; border-radius: 7px;
    padding: 10px; text-align: center; background: #fafafa;
    page-break-inside: avoid;
}
#pdf-render .regime-best { border-color: #22c55e; background: #f0fdf4; }
#pdf-render .regime-name { font-size: 7.5px; text-transform: uppercase; color: #64748b; letter-spacing: .5px; margin-bottom: 5px; }
#pdf-render .regime-cf   { font-size: 16px; font-weight: 800; margin-bottom: 3px; }
#pdf-render .regime-badge { font-size: 8px; color: #94a3b8; }

/* ── TABLEAU NÉGOCIATION ── */
#pdf-render .nego-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
#pdf-render .nego-table thead tr { background: #f1f5f9; }
#pdf-render .nego-table th {
    padding: 6px 8px; text-align: left;
    font-size: 7.5px; text-transform: uppercase; color: #64748b;
    letter-spacing: .5px; font-weight: 700;
    border-bottom: 2px solid #e2e8f0;
}
#pdf-render .nego-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; }
#pdf-render .nego-table td:first-child { text-align: left; font-weight: 600; }
#pdf-render .nego-table tbody tr:nth-child(even) { background: #f8fafc; }
#pdf-render .nego-table tr { page-break-inside: avoid; }
#pdf-render .nego-table tr:last-child td { border-bottom: none; }
#pdf-render .nego-table .nego-row-current { background: #eff6ff !important; }
#pdf-render .nego-table .nego-row-current td:first-child::after { content: ' ◀ actuel'; font-size: 7.5px; color: #3b82f6; font-weight: 700; }

/* ── TABLEAU PROJECTION ── */
#pdf-render .r-proj-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
#pdf-render .r-proj-table thead tr { background: #f1f5f9; }
#pdf-render .r-proj-table th {
    padding: 6px 8px; text-align: left;
    font-size: 7.5px; text-transform: uppercase; color: #64748b;
    letter-spacing: .5px; font-weight: 700;
    border-bottom: 2px solid #e2e8f0;
}
#pdf-render .r-proj-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
#pdf-render .r-proj-table tbody tr:nth-child(even) { background: #f8fafc; }
#pdf-render .r-proj-table tr { page-break-inside: avoid; }
#pdf-render .r-proj-table tr:last-child td { border-bottom: none; }

/* ── CONSEILS OPTIM ── */
#pdf-render .tip-card {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 9px 11px; border: 1px solid #e2e8f0;
    border-left: 3px solid #3b82f6;
    border-radius: 7px; margin-bottom: 7px;
    page-break-inside: avoid; background: white;
}
#pdf-render .tip-card.tip-fiscal { border-left-color: #8b5cf6; }
#pdf-render .tip-card.tip-profit { border-left-color: #16a34a; }
#pdf-render .tip-icon { font-size: 13px; width: 20px; text-align: center; flex-shrink: 0; padding-top: 1px; }
#pdf-render .tip-content { flex: 1; min-width: 0; }
#pdf-render .tip-title { font-size: 9.5px; font-weight: 700; color: #1e3a5f; margin-bottom: 2px; }
#pdf-render .tip-explanation { font-size: 8.5px; color: #64748b; line-height: 1.55; }
#pdf-render .tip-gain { font-size: 9.5px; font-weight: 700; color: #16a34a; white-space: nowrap; flex-shrink: 0; padding-top: 1px; }
#pdf-render .tip-optimized { text-align: center; padding: 14px; color: #16a34a; font-weight: 700; font-size: 10px; }

/* ── FISCALITÉ ── */
#pdf-render .fiscal-breakdown-table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-top: 10px; }
#pdf-render .fiscal-breakdown-table thead tr { background: #f1f5f9; }
#pdf-render .fiscal-breakdown-table th {
    padding: 5px 6px; font-size: 7.5px; text-transform: uppercase;
    color: #64748b; letter-spacing: .3px; font-weight: 700;
    text-align: right; border-bottom: 2px solid #e2e8f0;
}
#pdf-render .fiscal-breakdown-table th:first-child { text-align: left; }
#pdf-render .fiscal-breakdown-table td { padding: 4.5px 6px; border-bottom: 1px solid #f1f5f9; text-align: right; }
#pdf-render .fiscal-breakdown-table td:first-child { text-align: left; color: #64748b; }
#pdf-render .fiscal-breakdown-table tr.fiscal-total td { font-weight: 700; border-top: 1.5px solid #e2e8f0; color: #1e3a5f; }
#pdf-render .fiscal-breakdown-table .fiscal-best { color: #16a34a; font-weight: 700; }
#pdf-render .fiscal-breakdown-table tr { page-break-inside: avoid; }

/* ── PHOTOS ── */
#pdf-render .r-photo-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
#pdf-render .r-photo-img  { width: calc(50% - 5px); height: 165px; object-fit: cover; border-radius: 6px; }

/* ── NOTES ── */
#pdf-render .r-notes { white-space: pre-wrap; font-size: 10px; line-height: 1.7; margin-top: 8px; color: #475569; }
`;

    const html = `
<div class="r-header">
  <div>
    <div class="r-title">Investisseur Pro</div>
    <div class="r-sub">${projectName}</div>
  </div>
  <div class="r-date">Rapport généré le ${today}</div>
</div>

<div class="r-score">
  <div class="r-score-l">${scoreLabel} &nbsp; ${scoreStars}</div>
  <div class="r-score-r">${scoreDetail}</div>
</div>

<div class="r-kpi-grid">
  <div class="r-kpi"><div class="r-kpi-lbl">Rentabilité Brute</div><div class="r-kpi-val">${rentaBrute}</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">Rentabilité Nette</div><div class="r-kpi-val">${rentaNette}</div></div>
  <div class="r-kpi gold"><div class="r-kpi-lbl">Renta. Nette-Nette</div><div class="r-kpi-val">${rentaNetnet}</div><div class="r-kpi-s">Après impôts</div></div>
  <div class="r-kpi blue"><div class="r-kpi-lbl">Cash-Flow Net-Net</div><div class="r-kpi-val ${cfIsNeg ? 'neg' : 'pos'}">${cfNetnet}</div><div class="r-kpi-s">Dans votre poche / mois</div></div>
</div>

<div class="r-kpi-grid">
  <div class="r-kpi"><div class="r-kpi-lbl">Cash-on-Cash</div><div class="r-kpi-val">${cocVal}</div><div class="r-kpi-s">Rendement sur apport</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">GRM</div><div class="r-kpi-val">${grmVal}</div><div class="r-kpi-s">Coût / loyers annuels</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">DSCR</div><div class="r-kpi-val">${dscrVal}</div><div class="r-kpi-s">Couverture de la dette</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">Break-even</div><div class="r-kpi-val">${beVal}</div><div class="r-kpi-s">CF cumulé positif</div></div>
</div>

<div class="r-summary-row">
  <div class="r-summary">
    <h3>Enveloppe Financière</h3>
    <ul>
      <li><span>Prix net vendeur estimé</span><strong>${outPrixNet} €</strong></li>
      <li><span>Frais fixes (Notaire, Travaux…)</span><strong>${outFraisFixes} €</strong></li>
      <li><span>Coût total de l'opération</span><strong>${outCoutTotal} €</strong></li>
      <li><span>Montant emprunté</span><strong>${outFinancement} €</strong></li>
      <li><span>Mensualité crédit + assurance</span><strong>${outMensualite} €</strong></li>
    </ul>
  </div>
  ${chartImg ? `<div class="r-chart"><img src="${chartImg}" alt="Répartition CF"></div>` : ''}
</div>

<div class="r-card">
  <h3>⚖️ Comparaison des Régimes Fiscaux</h3>
  <div class="r-card-sub">CF net-net mensuel estimé pour chaque régime avec vos paramètres actuels.</div>
  <div class="regime-compare-grid">${regimeHTML}</div>
  ${fiscalBreakdownHTML}
</div>

<div class="r-card">
  <h3>💡 Conseils d'Optimisation</h3>
  <div class="r-card-sub">Recommandations personnalisées basées sur vos chiffres.</div>
  ${optimizationHTML}
</div>

<div class="r-page-break"></div>

<div class="r-card" style="page-break-inside:auto;">
  <h3>📉 Impact de la Négociation sur le CF</h3>
  <div class="r-card-sub">CF net-net mensuel selon le niveau de négociation sur le prix affiché (0 → 25 %).</div>
  ${negoHTML}
</div>

${evolutionImg ? `
<div class="r-card">
  <h3>📈 Évolution sur 25 ans</h3>
  <div class="r-card-sub">Capital restant dû, cash-flow cumulé et enrichissement total.</div>
  <img src="${evolutionImg}" style="width:100%;max-height:210px;object-fit:contain;margin-top:8px;display:block;" alt="Évolution 25 ans">
</div>` : ''}

<div class="r-page-break"></div>

<div class="r-card" style="page-break-inside:auto;">
  <h3>📊 Projection Financière (25 ans)</h3>
  <div class="r-card-sub">Simulation année par année : capital amorti, capital restant, intérêts, impôts, cash-flow net.</div>
  <table class="r-proj-table">
    <thead>
      <tr>
        <th>Année</th>
        <th>Capital amorti</th>
        <th>Capital restant</th>
        <th>Intérêts</th>
        <th>Impôts</th>
        <th>CF net / an</th>
      </tr>
    </thead>
    <tbody>${projHTML}</tbody>
  </table>
</div>

${reventeVisible ? `
<div class="r-page-break"></div>
<div class="r-card" style="page-break-inside:auto;">
  <h3>💰 Quand Revendre ?</h3>
  <div class="r-card-sub">Simulation de sortie annuelle selon vos hypothèses de revente.</div>
  ${reventeSummary ? `<div style="font-size:9px;color:#64748b;margin-bottom:8px;">${reventeSummary.innerText}</div>` : ''}
  <table class="nego-table">
    <thead><tr><th>Année</th><th>Prix de vente</th><th>Frais</th><th>Impôt PV</th><th>Net vendeur</th><th>CRD</th><th>Cash net sortie</th><th>Gain global</th><th>Verdict</th></tr></thead>
    <tbody>${reventeTableBody ? reventeTableBody.innerHTML : ''}</tbody>
  </table>
</div>` : ''}

${notesText ? `
<div class="r-page-break"></div>
<div class="r-card">
  <h3>📝 Notes &amp; Commentaires</h3>
  <p class="r-notes">${notesText}</p>
</div>` : ''}

${activePhotos.length ? `
<div class="r-page-break"></div>
<div class="r-card">
  <h3>📷 Galerie Photos</h3>
  <div class="r-photo-grid">${photosHTML}</div>
</div>` : ''}
`;

    const styleEl = document.createElement('style');
    styleEl.id = 'pdf-temp-style';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    const container = document.createElement('div');
    container.id = 'pdf-render';
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = 'position:fixed;top:0;left:0;width:680px;background:white;z-index:99999;pointer-events:none;';
    container.innerHTML = html;
    document.body.appendChild(container);
    void container.offsetHeight;

    const projectSlug = (document.getElementById('project-name').value.trim() || 'InvestPro').replace(/\s+/g, '-');
    const filename = `Rapport-${projectSlug}.pdf`;

    return { container, styleEl, filename };
}

export function cleanupPDFDOM(container, styleEl) {
    if (container) container.remove();
    if (styleEl)   styleEl.remove();
}

export function getPDFOptions(filename) {
    return {
        margin:      10,
        filename,
        image:       { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0, logging: false, windowWidth: 680 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css', 'avoid-all'], before: '.r-page-break' }
    };
}

export function showRenderMask() {
    const mask = document.createElement('div');
    mask.id = 'pdf-render-mask';
    mask.style.cssText = 'position:fixed;inset:0;background:white;z-index:99998;pointer-events:none;';
    document.body.appendChild(mask);
    return mask;
}
