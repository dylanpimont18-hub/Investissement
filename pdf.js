function buildPDFParts(uploadedPhotos) {
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
    color-scheme: light;
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

    const projectSlug = (document.getElementById('project-name').value.trim() || 'InvestPro').replace(/\s+/g, '-');
    const filename = `Rapport-${projectSlug}.pdf`;

    return { css, html, filename };

}

export function buildPDFDOM(uploadedPhotos) {
    const { css, html, filename } = buildPDFParts(uploadedPhotos);

    const styleEl = document.createElement('style');
    styleEl.id = 'pdf-temp-style';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    const mount = document.createElement('div');
    mount.id = 'pdf-render-mount';
    mount.setAttribute('aria-hidden', 'true');
    mount.style.cssText = 'position:fixed;top:0;left:-10000px;width:680px;background:white;pointer-events:none;';

    const container = document.createElement('div');
    container.id = 'pdf-render';
    container.style.cssText = 'width:680px;background:white;color-scheme:light;';
    container.innerHTML = html;

    mount.appendChild(container);
    document.body.appendChild(mount);
    void container.offsetHeight;

    return { mount, container, styleEl, filename };
}

export function cleanupPDFDOM(mount, styleEl) {
    if (mount)    mount.remove();
    if (styleEl)   styleEl.remove();
}

export function buildPrintDocument(uploadedPhotos) {
    const { css, html, filename } = buildPDFParts(uploadedPhotos);
    const title = filename.replace(/\.pdf$/i, '');
    const printBootstrap = `
  (function () {
    function waitForImages() {
      return Promise.all(Array.from(document.images).map(function(img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function(resolve) {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      }));
    }

    async function launchPrint() {
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (err) {}
      }
      await waitForImages();
      window.focus();
      window.setTimeout(function() {
        window.print();
      }, 60);
    }

    window.addEventListener('load', function() {
      launchPrint();
    }, { once: true });

    window.addEventListener('afterprint', function() {
      window.close();
    });
  })();`;

    const documentHTML = `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
  ${css}

  html, body {
    margin: 0;
    padding: 0;
    background: #e2e8f0;
  }

  body {
    padding: 24px;
  }

  #pdf-render {
    margin: 0 auto;
  }

  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  @media print {
    html, body {
      background: white;
    }

    body {
      padding: 0;
    }

    #pdf-render {
      margin: 0;
    }
  }
    </style>
  </head>
  <body>
    <div id="pdf-render">${html}</div>
    <script>${printBootstrap}<\/script>
  </body>
  </html>`;

    return { documentHTML, filename };
}

function normalizePDFText(value) {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function getElementText(id) {
  const el = document.getElementById(id);
  return el ? normalizePDFText(el.innerText || el.textContent || '') : '';
}

function getCanvasImage(id, quality = 0.88) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    return null;
  }
}

function extractTableDataFromElement(table) {
  if (!table) return null;
  const head = Array.from(table.querySelectorAll('thead tr')).map((row) =>
    Array.from(row.querySelectorAll('th, td')).map((cell) => normalizePDFText(cell.innerText || cell.textContent || ''))
  ).filter((row) => row.length);
  const body = Array.from(table.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('th, td')).map((cell) => normalizePDFText(cell.innerText || cell.textContent || ''))
  ).filter((row) => row.length);

  if (!head.length && !body.length) return null;
  return { head, body };
}

function extractTableData(selector) {
  return extractTableDataFromElement(document.querySelector(selector));
}

function extractRegimeComparisonRows() {
  return Array.from(document.querySelectorAll('#regime-compare-grid .regime-card')).map((card) => [
    normalizePDFText(card.querySelector('.regime-name')?.innerText || ''),
    normalizePDFText(card.querySelector('.regime-cf')?.innerText || ''),
    normalizePDFText(card.querySelector('.regime-badge')?.innerText || '')
  ]).filter((row) => row[0]);
}

function extractOptimizationTips() {
  const optimized = document.querySelector('#optimization-tips-container .tip-optimized');
  if (optimized) {
    return [{
      title: 'Investissement optimise',
      explanation: normalizePDFText(optimized.innerText || ''),
      gain: ''
    }];
  }

  return Array.from(document.querySelectorAll('#optimization-tips-container .tip-card')).map((card) => ({
    title: normalizePDFText(card.querySelector('.tip-title')?.innerText || ''),
    explanation: normalizePDFText(card.querySelector('.tip-explanation')?.innerText || ''),
    gain: normalizePDFText(card.querySelector('.tip-gain')?.innerText || '')
  })).filter((tip) => tip.title || tip.explanation);
}

function collectSharePDFSnapshot() {
  return {
    projectName: document.getElementById('project-name').value.trim() || 'Investissement',
    generatedOn: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    scoreLabel: getElementText('score-label'),
    scoreStars: getElementText('score-stars'),
    scoreDetail: getElementText('score-detail'),
    primaryMetrics: [
      ['Rentabilite brute', getElementText('renta-brute')],
      ['Rentabilite nette', getElementText('renta-nette')],
      ['Renta nette-nette', getElementText('renta-netnet')],
      ['Cash-flow net-net', getElementText('cf-netnet')]
    ],
    secondaryMetrics: [
      ['Cash-on-Cash', getElementText('metric-coc')],
      ['GRM', getElementText('metric-grm')],
      ['DSCR', getElementText('metric-dscr')],
      ['Break-even', getElementText('metric-breakeven')],
      ['Equite an 1', getElementText('metric-equity')]
    ],
    financingSummary: [
      ['Prix net vendeur estime', `${getElementText('out-prix-net')} €`],
      ['Frais fixes', `${getElementText('out-frais-fixes')} €`],
      ['Cout total de l operation', `${getElementText('out-cout-total')} €`],
      ['Montant emprunte', `${getElementText('out-financement')} €`],
      ['Mensualite credit + assurance', `${getElementText('out-mensualite')} €`]
    ],
    cashflowChart: getCanvasImage('cashflowChart'),
    evolutionChart: getCanvasImage('evolutionChart'),
    regimeComparison: extractRegimeComparisonRows(),
    fiscalBreakdown: extractTableData('#fiscal-breakdown table'),
    optimizationTips: extractOptimizationTips(),
    negotiationTable: extractTableData('#nego-table-container table'),
    projectionTable: extractTableDataFromElement(document.getElementById('projection-tbody')?.closest('table')),
    resaleSummary: getElementText('revente-summary'),
    resaleTable: extractTableDataFromElement(document.getElementById('revente-tbody')?.closest('table')),
    notes: getElementText('commentaires-display')
  };
}

function ensurePdfDependencies() {
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) {
    throw new Error('jsPDF indisponible');
  }
  if (!jsPDF.API || !jsPDF.API.autoTable) {
    throw new Error('jsPDF AutoTable indisponible');
  }
  return jsPDF;
}

function addTable(doc, config) {
  doc.autoTable({
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.1 },
    ...config
  });
  return doc.lastAutoTable.finalY;
}

function addSectionTitle(doc, text, y) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, y, pageWidth - 28, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(11);
  doc.text(text, 18, y + 5.3);
  return y + 12;
}

function addWrappedText(doc, text, y, options = {}) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const fontSize = options.fontSize || 9;
  const lineHeight = options.lineHeight || 4.6;
  const x = options.x || 16;
  const maxWidth = options.maxWidth || (doc.internal.pageSize.getWidth() - 32);
  const lines = doc.splitTextToSize(text, maxWidth);
  if (y + (lines.length * lineHeight) > pageHeight - 16) {
    doc.addPage();
    y = 16;
  }
  doc.setFont('helvetica', options.fontStyle || 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(51, 65, 85);
  doc.text(lines, x, y);
  return y + (lines.length * lineHeight);
}

export async function buildSharePDFFile(uploadedPhotos) {
  const jsPDF = ensurePdfDependencies();
  const { filename } = buildPDFParts(uploadedPhotos);
  const snapshot = collectSharePDFSnapshot();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 28;
  let cursorY = 14;

  const ensureSpace = (neededHeight) => {
    if (cursorY + neededHeight <= pageHeight - 16) return;
    doc.addPage();
    cursorY = 16;
  };

  doc.setFillColor(30, 58, 95);
  doc.roundedRect(14, cursorY, contentWidth, 20, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Investisseur Pro', 20, cursorY + 7.5);
  doc.setFontSize(11);
  doc.text(snapshot.projectName, 20, cursorY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Rapport mobile partage le ${snapshot.generatedOn}`, pageWidth - 20, cursorY + 8, { align: 'right' });
  cursorY += 26;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cursorY, contentWidth, 14, 2, 2, 'FD');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${snapshot.scoreLabel} ${snapshot.scoreStars}`.trim(), 18, cursorY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  const scoreLines = doc.splitTextToSize(snapshot.scoreDetail || 'Simulation en cours', contentWidth - 8);
  doc.text(scoreLines, 18, cursorY + 10.2);
  cursorY += 20;

  cursorY = addSectionTitle(doc, 'Indicateurs cles', cursorY);
  cursorY = addTable(doc, {
    startY: cursorY,
    head: [['Metrique', 'Valeur', 'Metrique', 'Valeur']],
    body: [
      [snapshot.primaryMetrics[0][0], snapshot.primaryMetrics[0][1], snapshot.primaryMetrics[1][0], snapshot.primaryMetrics[1][1]],
      [snapshot.primaryMetrics[2][0], snapshot.primaryMetrics[2][1], snapshot.primaryMetrics[3][0], snapshot.primaryMetrics[3][1]],
      [snapshot.secondaryMetrics[0][0], snapshot.secondaryMetrics[0][1], snapshot.secondaryMetrics[1][0], snapshot.secondaryMetrics[1][1]],
      [snapshot.secondaryMetrics[2][0], snapshot.secondaryMetrics[2][1], snapshot.secondaryMetrics[3][0], snapshot.secondaryMetrics[3][1]],
      [snapshot.secondaryMetrics[4][0], snapshot.secondaryMetrics[4][1], '', '']
    ]
  }) + 6;

  cursorY = addSectionTitle(doc, 'Enveloppe financiere', cursorY);
  cursorY = addTable(doc, {
    startY: cursorY,
    head: [['Poste', 'Valeur']],
    body: snapshot.financingSummary
  }) + 6;

  if (snapshot.cashflowChart || snapshot.evolutionChart) {
    cursorY = addSectionTitle(doc, 'Graphiques', cursorY);
    if (snapshot.cashflowChart && snapshot.evolutionChart) {
      ensureSpace(68);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text('Repartition du cash-flow', 16, cursorY);
      doc.text('Evolution sur 25 ans', 88, cursorY);
      doc.addImage(snapshot.cashflowChart, 'JPEG', 16, cursorY + 4, 58, 58);
      doc.addImage(snapshot.evolutionChart, 'JPEG', 88, cursorY + 4, 106, 58);
      cursorY += 68;
    } else if (snapshot.evolutionChart) {
      ensureSpace(66);
      doc.addImage(snapshot.evolutionChart, 'JPEG', 16, cursorY, contentWidth, 58);
      cursorY += 64;
    } else if (snapshot.cashflowChart) {
      ensureSpace(66);
      doc.addImage(snapshot.cashflowChart, 'JPEG', 16, cursorY, 70, 70);
      cursorY += 76;
    }
  }

  if (snapshot.regimeComparison.length) {
    cursorY = addSectionTitle(doc, 'Comparaison des regimes fiscaux', cursorY);
    cursorY = addTable(doc, {
      startY: cursorY,
      head: [['Regime', 'CF / mois', 'Repere']],
      body: snapshot.regimeComparison
    }) + 6;
  }

  if (snapshot.fiscalBreakdown) {
    cursorY = addSectionTitle(doc, 'Detail fiscal', cursorY);
    cursorY = addTable(doc, {
      startY: cursorY,
      head: snapshot.fiscalBreakdown.head,
      body: snapshot.fiscalBreakdown.body,
      bodyStyles: { fontSize: 7.4, textColor: [30, 41, 59], cellPadding: 1.8 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7.8 }
    }) + 6;
  }

  if (snapshot.optimizationTips.length) {
    cursorY = addSectionTitle(doc, 'Conseils d optimisation', cursorY);
    snapshot.optimizationTips.slice(0, 6).forEach((tip) => {
      const explanationLines = doc.splitTextToSize(tip.explanation, contentWidth - 10);
      const blockHeight = 10 + (explanationLines.length * 4.2) + (tip.gain ? 4.5 : 0);
      ensureSpace(blockHeight + 2);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, cursorY, contentWidth, blockHeight, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 95);
      doc.text(tip.title || 'Conseil', 18, cursorY + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.7);
      doc.setTextColor(51, 65, 85);
      doc.text(explanationLines, 18, cursorY + 10.5);
      if (tip.gain) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(tip.gain, 18, cursorY + blockHeight - 2.5);
      }
      cursorY += blockHeight + 4;
    });
  }

  if (snapshot.negotiationTable) {
    cursorY = addSectionTitle(doc, 'Impact de la negociation', cursorY);
    cursorY = addTable(doc, {
      startY: cursorY,
      head: snapshot.negotiationTable.head,
      body: snapshot.negotiationTable.body,
      bodyStyles: { fontSize: 7.4, textColor: [30, 41, 59], cellPadding: 1.8 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7.8 }
    }) + 6;
  }

  if (snapshot.projectionTable) {
    cursorY = addSectionTitle(doc, 'Projection financiere sur 25 ans', cursorY);
    cursorY = addTable(doc, {
      startY: cursorY,
      head: snapshot.projectionTable.head,
      body: snapshot.projectionTable.body,
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 1.6 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7.3 }
    }) + 6;
  }

  if (snapshot.resaleSummary || snapshot.resaleTable) {
    cursorY = addSectionTitle(doc, 'Quand revendre', cursorY);
    if (snapshot.resaleSummary) {
      cursorY = addWrappedText(doc, snapshot.resaleSummary, cursorY, { fontSize: 8.8, lineHeight: 4.3, x: 16, maxWidth: contentWidth });
      cursorY += 4;
    }
    if (snapshot.resaleTable) {
      cursorY = addTable(doc, {
        startY: cursorY,
        head: snapshot.resaleTable.head,
        body: snapshot.resaleTable.body,
        bodyStyles: { fontSize: 6.4, textColor: [30, 41, 59], cellPadding: 1.4 },
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 6.8 },
        styles: { overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.1, cellWidth: 'wrap' }
      }) + 6;
    }
  }

  if (snapshot.notes) {
    cursorY = addSectionTitle(doc, 'Notes', cursorY);
    cursorY = addWrappedText(doc, snapshot.notes, cursorY, { fontSize: 9, lineHeight: 4.5, x: 16, maxWidth: contentWidth });
    cursorY += 4;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${page} / ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  const blob = doc.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}
