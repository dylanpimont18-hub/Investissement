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

    const regimeHTML       = document.getElementById('regime-compare-grid').innerHTML;
    const fiscalBreakdownHTML = document.getElementById('fiscal-breakdown').innerHTML;
    const optimizationHTML = document.getElementById('optimization-tips-container').innerHTML;
    const negoHTML         = document.getElementById('nego-table-container').innerHTML;
    const projHTML         = document.getElementById('projection-tbody').innerHTML;

    const notesEl   = document.getElementById('commentaires-display');
    const notesText = notesEl ? notesEl.innerText.trim() : '';

    const activePhotos = uploadedPhotos.filter(p => p);
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
#pdf-render .tip-card { display:flex; align-items:flex-start; gap:8px; padding:8px 10px; border:1px solid #e5e5ea; border-radius:8px; margin-bottom:6px; border-left:3px solid #007aff; page-break-inside:avoid; }
#pdf-render .tip-card.tip-fiscal { border-left-color:#af52de; }
#pdf-render .tip-card.tip-profit { border-left-color:#34c759; }
#pdf-render .tip-icon { font-size:12px; width:20px; text-align:center; flex-shrink:0; }
#pdf-render .tip-content { flex:1; }
#pdf-render .tip-title { font-size:9.5px; font-weight:700; margin-bottom:2px; }
#pdf-render .tip-explanation { font-size:8.5px; color:#8e8e93; line-height:1.5; }
#pdf-render .tip-gain { font-size:9.5px; font-weight:700; color:#34c759; white-space:nowrap; flex-shrink:0; }
#pdf-render .tip-optimized { text-align:center; padding:12px; color:#34c759; font-weight:600; font-size:9.5px; }
#pdf-render .fiscal-breakdown-table { width:100%; border-collapse:collapse; font-size:8.5px; margin-top:10px; }
#pdf-render .fiscal-breakdown-table th { padding:4px 6px; font-size:7.5px; text-transform:uppercase; color:#8e8e93; letter-spacing:.3px; font-weight:600; background:#f2f2f7; text-align:right; }
#pdf-render .fiscal-breakdown-table th:first-child { text-align:left; }
#pdf-render .fiscal-breakdown-table td { padding:4px 6px; border-bottom:1px solid #f2f2f7; text-align:right; }
#pdf-render .fiscal-breakdown-table td:first-child { text-align:left; color:#8e8e93; }
#pdf-render .fiscal-breakdown-table tr.fiscal-total td { font-weight:700; border-top:1.5px solid #e5e5ea; }
#pdf-render .fiscal-breakdown-table .fiscal-best { color:#34c759; font-weight:600; }
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
<div class="r-kpi-grid" style="margin-bottom:12px;">
  <div class="r-kpi"><div class="r-kpi-lbl">Cash-on-Cash</div><div class="r-kpi-val">${cocVal}</div><div class="r-kpi-s">Rendement sur apport</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">GRM</div><div class="r-kpi-val">${grmVal}</div><div class="r-kpi-s">Coût / Loyers</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">DSCR</div><div class="r-kpi-val">${dscrVal}</div><div class="r-kpi-s">Couverture dette</div></div>
  <div class="r-kpi"><div class="r-kpi-lbl">Break-even</div><div class="r-kpi-val">${beVal}</div><div class="r-kpi-s">CF cumulé positif</div></div>
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
${evolutionImg ? `<div class="r-card"><h3>📈 Évolution sur 15 ans</h3><img src="${evolutionImg}" style="width:100%;max-height:200px;object-fit:contain;margin-top:8px;" alt="Évolution 15 ans"></div>` : ''}
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
    container.style.cssText = 'position:fixed;top:0;left:0;width:680px;background:white;z-index:99999;pointer-events:none;';
    container.innerHTML = html;
    document.body.appendChild(container);
    void container.offsetHeight; // force reflow

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
