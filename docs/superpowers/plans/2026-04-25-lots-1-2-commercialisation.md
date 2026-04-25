# Lots 1 & 2 Commercialisation — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un écran d'accueil + wizard 4 étapes (Lot 1) et restructurer la page Analyse autour d'un bloc verdict (Lot 2).

**Architecture:** Option C hybride — écran d'accueil avant les tabs, tab Saisie transformé en wizard 4 étapes, tab Analyse restructuré autour du verdict. `calculs.js` et `pdf.js` ne sont pas modifiés.

**Tech Stack:** Vanilla JS ES Modules, HTML/CSS pur, aucune dépendance nouvelle.

---

## Contexte codebase

- `index.html` : structure des 3 vues (view-inputs, view-results, view-vierzon) dans `.container`, nav tabs en bas
- `main.js` : `initApp()` au load, `triggerCalculations()` debounce, `calculateAndSave()`, tab switching via `.tab-btn[data-target]` click, `window.onload = initApp`
- `ui.js` : IIFE de gestion mode Simplifié/Expert (lines 540-618) — référence `#mode-toggle`, `#simplified-inputs`, `.grid-2-cols`. Ces éléments seront supprimés; l'IIFE bailera proprement sur `if (!toggle || !simpDiv) return;`.
- `pdf.js` : lit `#score-banner`, `#score-label`, `#score-stars`, `#score-detail` — ces IDs doivent subsister.
- `#btn-simulate` (line 699 main.js) a un `addEventListener` — garder l'élément hidden pour éviter une erreur null.

## Fichiers modifiés

| Fichier | Rôle dans ce plan |
|---|---|
| `index.html` | Ajout `#view-accueil`, refactoring form → wizard, redesign score-banner, bouton header |
| `styles.css` | Styles accueil, wizard, verdict-hero 4 variantes, mobile collapse |
| `main.js` | Fonctions `showAccueil/hideAccueil/startWizard`, `initWizard/goToStep/setWizardMode`, update `initApp` |
| `ui.js` | `updateScoreBanner` : nouveaux labels + nouvelle phrase d'action |
| `contenu.md` | Mise à jour statut lots 1 et 2 |

---

## Task 1 — HTML : Écran d'accueil + bouton header

**Fichiers :**
- Modifier : `index.html`

- [ ] **Step 1 : Ajouter le bouton Accueil dans le header**

Dans `index.html`, localiser `<div class="header-actions">` (~line 26) et y insérer le bouton AVANT `#btn-theme-toggle` :

```html
<div class="header-actions">
    <button class="btn-accueil" id="btn-accueil" title="Accueil" style="display:none;">⌂</button>
    <button class="btn-theme-toggle" id="btn-theme-toggle" title="Basculer thème clair/sombre">☀️</button>
    <button class="account-btn" id="btn-account" onclick="window.openAccountModal()" title="Mon espace Pro+">
        <span class="account-btn-label" id="account-btn-label">Pro+</span>
    </button>
</div>
```

- [ ] **Step 2 : Ajouter `#view-accueil` dans `.container`**

Dans `index.html`, localiser `<div class="container">` (~line 40). Insérer **immédiatement après** la balise ouvrante `<div class="container">`, AVANT `<div id="view-inputs" ...>` :

```html
<div id="view-accueil" class="view-accueil">
    <div class="accueil-hero">
        <div class="accueil-logo-mark">IP</div>
        <h2 class="accueil-title">Analysez un bien immobilier en 2 minutes.</h2>
        <p class="accueil-subtitle">Décidez en confiance.</p>
    </div>
    <div class="accueil-ctas">
        <button type="button" id="btn-start-rapide" class="accueil-cta accueil-cta-primary">
            <span class="accueil-cta-title">Estimation rapide</span>
            <span class="accueil-cta-desc">Les essentiels · résultat en 1 minute</span>
        </button>
        <button type="button" id="btn-start-complet" class="accueil-cta accueil-cta-secondary">
            <span class="accueil-cta-title">Analyse complète</span>
            <span class="accueil-cta-desc">Tous les paramètres · analyse experte</span>
        </button>
        <button type="button" id="btn-reprendre" class="accueil-cta accueil-cta-ghost" style="display:none;">
            <span class="accueil-cta-title">Reprendre ma saisie</span>
            <span class="accueil-cta-desc">Continuer là où vous vous êtes arrêté</span>
        </button>
    </div>
    <p class="accueil-disclaimer">Simulation indicative · outil d'aide à la décision</p>
</div>
```

- [ ] **Step 3 : Vérifier dans le navigateur**

Ouvrir `index.html`. L'écran d'accueil doit être visible (pas encore de logique JS — il apparaît toujours). Les 3 boutons CTA doivent être présents (btn-reprendre caché par défaut via style).

- [ ] **Step 4 : Commit**

```bash
git add index.html
git commit -m "feat: add accueil screen and header home button"
```

---

## Task 2 — CSS : Styles de l'écran d'accueil

**Fichiers :**
- Modifier : `styles.css`

- [ ] **Step 1 : Ajouter les styles accueil à la fin de `styles.css`**

```css
/* === ÉCRAN D'ACCUEIL === */
.view-accueil {
    min-height: 70vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    gap: 32px;
    text-align: center;
}
.accueil-hero { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.accueil-logo-mark {
    width: 56px; height: 56px;
    border-radius: 14px;
    background: var(--primary-color);
    color: #fff;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
}
.accueil-title {
    font-family: var(--font-display);
    font-size: clamp(1.4rem, 5vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.2;
    max-width: 480px;
}
.accueil-subtitle { font-size: 1.05rem; color: var(--text-secondary); }
.accueil-ctas { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 400px; }
.accueil-cta {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 18px 20px;
    border-radius: var(--border-radius);
    border: 1.5px solid var(--border-color);
    background: var(--card-bg);
    cursor: pointer;
    text-align: left;
    transition: transform 0.15s, box-shadow 0.15s;
    width: 100%;
}
.accueil-cta:hover { transform: translateY(-2px); box-shadow: var(--shadow-hover); }
.accueil-cta-primary { border-color: var(--primary-color); background: var(--primary-color); color: #fff; }
.accueil-cta-primary .accueil-cta-desc { color: rgba(255,255,255,0.75); }
.accueil-cta-secondary { border-color: var(--primary-color); }
.accueil-cta-ghost { border-style: dashed; }
.accueil-cta-title { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; }
.accueil-cta-desc { font-size: 0.82rem; color: var(--text-secondary); margin-top: 3px; }
.accueil-cta-primary .accueil-cta-title { color: #fff; }
.accueil-disclaimer { font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; }
.btn-accueil {
    background: var(--bg-color);
    border: 1.5px solid var(--border-color);
    border-radius: 50%;
    width: 36px; height: 36px;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: var(--text-color);
    transition: background 0.2s;
}
.btn-accueil:hover { background: var(--border-color); }
```

- [ ] **Step 2 : Vérifier le rendu**

Ouvrir `index.html`. L'écran d'accueil doit avoir un logo-mark bleu "IP", un titre centré, 3 boutons CTA bien stylés. Vérifier en dark mode (forcer `html.theme-dark` dans DevTools).

- [ ] **Step 3 : Commit**

```bash
git add styles.css
git commit -m "feat: add accueil screen CSS"
```

---

## Task 3 — JS : Logique d'affichage de l'écran d'accueil

**Fichiers :**
- Modifier : `main.js`

- [ ] **Step 1 : Ajouter les fonctions accueil dans `main.js`**

Localiser la fonction `initApp` (~line 1110) et insérer les fonctions suivantes AVANT elle :

```javascript
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
```

- [ ] **Step 2 : Ajouter les event listeners accueil dans `main.js`**

Juste après les fonctions ci-dessus, ajouter :

```javascript
document.getElementById('btn-start-rapide').addEventListener('click', () => startWizard('rapide'));
document.getElementById('btn-start-complet').addEventListener('click', () => startWizard('complet'));
document.getElementById('btn-reprendre').addEventListener('click', () => {
    const savedMode = sessionStorage.getItem('simuImmoWizardMode') || 'complet';
    setWizardMode(savedMode);
    goToStep(1);
    hideAccueil();
});
document.getElementById('btn-accueil').addEventListener('click', showAccueil);
```

- [ ] **Step 3 : Modifier `initApp` pour démarrer sur l'accueil**

Remplacer la fonction `initApp` existante par :

```javascript
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
            // Affiche le bouton "Reprendre" si brouillon existant
            const btnReprendre = document.getElementById('btn-reprendre');
            if (btnReprendre) btnReprendre.style.display = '';
        } catch (e) {}
    }
    updateFormProgress();
    showAccueil();
}
```

- [ ] **Step 4 : Vérifier dans le navigateur**

1. Ouvrir `index.html` (localStorage vide) → l'écran accueil s'affiche, les tabs sont cachés.
2. Cliquer "Estimation rapide" → accueil se cache, tabs apparaissent, tab Saisie est actif.
3. Cliquer "⌂" dans le header → retour à l'accueil.
4. Mettre un brouillon dans localStorage (`localStorage.setItem('simuImmoDraft', '{}')`) et recharger → bouton "Reprendre" visible.

Note : `setWizardMode` et `goToStep` ne sont pas encore définis — des erreurs console sont attendues à ce stade.

- [ ] **Step 5 : Commit**

```bash
git add main.js
git commit -m "feat: accueil screen show/hide logic and initApp update"
```

---

## Task 4 — HTML : Transformer le formulaire en wizard 4 étapes

**Fichiers :**
- Modifier : `index.html`

**Objectif :** Remplacer le contenu actuel de `#view-inputs > form` par un wizard 4 étapes. Tous les `id` d'inputs sont conservés identiques pour que `getCurrentInputs()` et `calculateAndSave()` continuent de fonctionner sans modification.

- [ ] **Step 1 : Remplacer le contenu du formulaire**

Dans `index.html`, localiser `<form id="calc-form">` et remplacer TOUT son contenu interne (de la balise ouvrante `<form>` jusqu'à `</form>`, non incluses) par le bloc suivant.

**Important :** `#btn-simulate` est gardé hidden pour éviter une erreur null dans l'event listener de `main.js` line 699.

```html
<!-- Bouton simulate caché (conservé pour compat event listener main.js) -->
<button type="button" id="btn-simulate" style="display:none;">Analyser</button>

<!-- Wizard : indicateur d'étapes -->
<div class="wizard-step-indicator">
    <div class="wizard-step-dot current" data-step="1">
        <span class="wsd-num">1</span>
        <span class="wsd-label">Le Bien</span>
    </div>
    <div class="wizard-step-connector"></div>
    <div class="wizard-step-dot" data-step="2">
        <span class="wsd-num">2</span>
        <span class="wsd-label">Financement</span>
    </div>
    <div class="wizard-step-connector"></div>
    <div class="wizard-step-dot" data-step="3">
        <span class="wsd-num">3</span>
        <span class="wsd-label">Exploitation</span>
    </div>
    <div class="wizard-step-connector"></div>
    <div class="wizard-step-dot" data-step="4">
        <span class="wsd-num">4</span>
        <span class="wsd-label">Fiscalité</span>
    </div>
</div>

<div id="form-warnings"></div>

<!-- Étape 1 : Le Bien -->
<div class="wizard-step" id="wizard-step-1">
    <div class="wizard-step-card">
        <h3 class="wizard-step-title">Le Bien</h3>

        <label><span>Prix affiché (€) <span class="help-tip" data-tip="Le prix de vente annoncé par le vendeur ou l'agence, avant toute négociation de votre part.">?</span></span>
            <input type="number" inputmode="numeric" id="prix" value="107000"></label>
        <label><span>Loyer mensuel HC (€) <span class="help-tip" data-tip="Loyer Hors Charges : le montant que le locataire vous verse chaque mois, sans compter les charges récupérables.">?</span></span>
            <input type="number" inputmode="numeric" id="loyer" value="700"></label>

        <label class="wizard-expert-only"><span>Négociation obtenue (€) <span class="help-tip" data-tip="La réduction que vous avez négociée sur le prix affiché. Prix réellement payé = prix affiché − négociation.">?</span></span>
            <input type="number" inputmode="numeric" id="nego" value="0"></label>
        <label class="wizard-expert-only"><span>Type de bien <span class="help-tip" data-tip="Ancien = bien de plus de 5 ans (~8% de frais de notaire). Neuf = moins de 5 ans (~2.5% de frais de notaire).">?</span></span>
            <select id="type-bien">
                <option value="ancien">Ancien (~8%)</option>
                <option value="neuf">Neuf (~2.5%)</option>
            </select>
        </label>
        <label class="wizard-expert-only"><span>Frais notaire (%) <span class="help-tip" data-tip="Frais obligatoires payés au notaire lors de l'achat. ~8% dans l'ancien, ~2.5% dans le neuf.">?</span></span>
            <input type="number" inputmode="decimal" step="0.1" id="notaire" value="8"></label>
        <label class="wizard-expert-only"><span>Travaux estim. (€) <span class="help-tip" data-tip="Budget prévu pour les rénovations. Déductible des impôts en régime Foncier Réel.">?</span></span>
            <input type="number" inputmode="numeric" id="travaux" value="5000"></label>
        <label class="wizard-expert-only"><span>Mobilier (€) <span class="help-tip" data-tip="Coût de l'ameublement si vous louez en meublé.">?</span></span>
            <input type="number" inputmode="numeric" id="meubles" value="4000"></label>
    </div>
    <div class="wizard-nav">
        <div></div>
        <button type="button" class="wizard-btn-next btn-primary" data-next="2">Suivant →</button>
    </div>
</div>

<!-- Étape 2 : Financement -->
<div class="wizard-step" id="wizard-step-2" style="display:none;">
    <div class="wizard-step-card">
        <h3 class="wizard-step-title">Financement</h3>

        <label><span>Apport personnel (€) <span class="help-tip" data-tip="L'argent que vous investissez de votre poche, sans emprunter.">?</span></span>
            <input type="number" inputmode="numeric" id="apport" value="0"></label>
        <div class="complex-input" style="margin-top:15px;">
            <label><span>Taux d'intérêt annuel (%) <span class="help-tip" data-tip="Le pourcentage annuel que la banque vous facture pour vous prêter l'argent.">?</span></span>
                <input type="number" inputmode="decimal" step="0.01" id="taux-input" value="3.17"></label>
            <input type="range" id="taux-slider" class="styled-slider" min="0.5" max="6" step="0.05" value="3.17">
        </div>
        <label><span>Durée du prêt (Années) <span class="help-tip" data-tip="Nombre d'années de remboursement.">?</span></span>
            <input type="number" inputmode="numeric" id="duree" value="20"></label>

        <label class="wizard-expert-only"><span>Taux assurance (%) <span class="help-tip" data-tip="Coût de l'assurance emprunteur (décès, invalidité), en % du capital emprunté par an.">?</span></span>
            <input type="number" inputmode="decimal" step="0.01" id="assurance" value="0.30"></label>
        <label class="wizard-expert-only"><span>Frais d'agence (€) <span class="help-tip" data-tip="La commission payée à l'agence immobilière.">?</span></span>
            <input type="number" inputmode="numeric" id="agence" value="0"></label>
        <label class="wizard-expert-only"><span>Frais bancaires (€) <span class="help-tip" data-tip="Frais de dossier et de garantie facturés par la banque.">?</span></span>
            <input type="number" inputmode="numeric" id="frais-bancaires" value="1500"></label>
    </div>
    <div class="wizard-nav">
        <button type="button" class="wizard-btn-prev btn-secondary" data-prev="1">← Retour</button>
        <button type="button" class="wizard-btn-next btn-primary" data-next="3">Suivant →</button>
    </div>
</div>

<!-- Étape 3 : Exploitation -->
<div class="wizard-step" id="wizard-step-3" style="display:none;">
    <div class="wizard-step-card">
        <h3 class="wizard-step-title">Exploitation</h3>

        <label><span>Vacance locative (%) <span class="help-tip" data-tip="Le % du temps où le logement est vide entre deux locataires. 5% ≈ 18 jours/an.">?</span></span>
            <input type="number" inputmode="decimal" step="0.1" id="vacance" value="5"></label>

        <label class="wizard-expert-only"><span>Charges copropriété/mois (€) <span class="help-tip" data-tip="Votre part mensuelle des frais de l'immeuble.">?</span></span>
            <input type="number" inputmode="numeric" id="copro" value="40"></label>
        <label class="wizard-expert-only"><span>Taxe foncière/an (€) <span class="help-tip" data-tip="Impôt annuel payé par le propriétaire. Non récupérable sur le locataire.">?</span></span>
            <input type="number" inputmode="numeric" id="fonciere" value="1500"></label>
        <label class="wizard-expert-only"><span>Assurance propriétaire/an (€) <span class="help-tip" data-tip="Assurance PNO (Propriétaire Non Occupant). Obligatoire quand on loue un bien.">?</span></span>
            <input type="number" inputmode="numeric" id="pno" value="150"></label>
        <label class="wizard-expert-only"><span>Frais de gestion (%) <span class="help-tip" data-tip="Commission versée à une agence pour gérer la location. Si vous gérez seul, mettez 0%.">?</span></span>
            <input type="number" inputmode="decimal" step="0.1" id="gestion" value="7"></label>
    </div>
    <div class="wizard-nav">
        <button type="button" class="wizard-btn-prev btn-secondary" data-prev="2">← Retour</button>
        <button type="button" class="wizard-btn-next btn-primary" data-next="4">Suivant →</button>
    </div>
</div>

<!-- Étape 4 : Fiscalité -->
<div class="wizard-step" id="wizard-step-4" style="display:none;">
    <div class="wizard-step-card">
        <h3 class="wizard-step-title">Fiscalité</h3>

        <label><span>Revenus du foyer (€) <span class="help-tip" data-tip="Total des revenus annuels de votre foyer. Sert à calculer votre tranche d'imposition (TMI). Foyer : 2 adultes + 2 enfants.">?</span></span>
            <input type="number" inputmode="numeric" id="revenus" value="60000"></label>
        <div class="tmi-box">Votre TMI <span class="help-tip" data-tip="Taux Marginal d'Imposition : la tranche la plus haute de votre barème d'impôt sur le revenu.">?</span> : <strong id="tmi-display">-- %</strong></div>
        <label><span>Régime fiscal <span class="help-tip" data-tip="Le mode de calcul de l'impôt sur vos loyers. Micro-Foncier : abattement 30%. Foncier Réel : déduction charges réelles. SCI à l'IS : impôt société.">?</span></span>
            <div style="display:flex; align-items:center; gap:6px;">
                <select id="regime">
                    <option value="micro-foncier">Micro-Foncier (-30%)</option>
                    <option value="reel">Foncier Réel</option>
                    <option value="sci-is">SCI à l'IS</option>
                </select>
                <button type="button" class="btn-info-regime" onclick="openRegimeModal()" title="Détails des régimes fiscaux">i</button>
                <button type="button" class="btn-info-deductibles" onclick="openDeductiblesModal()" title="Que peut-on déduire des impôts ?">Que déduire ?</button>
            </div>
        </label>

        <label class="wizard-expert-only"><span>Inflation annuelle (%) <span class="help-tip" data-tip="Taux d'augmentation annuelle des loyers et des charges.">?</span></span>
            <div class="complex-input">
                <input type="number" inputmode="decimal" step="0.5" id="inflation" value="0" min="0" max="5">
                <input type="range" id="inflation-slider" class="styled-slider" min="0" max="5" step="0.5" value="0">
            </div>
        </label>
        <label class="wizard-expert-only"><span>Prix de revente estimé (€) <span class="help-tip" data-tip="Prix de vente cible que vous estimez pouvoir obtenir. Sert de base au scénario de revente.">?</span></span>
            <input type="number" inputmode="numeric" id="prix-revente-estime" value="120000"></label>
        <label class="wizard-expert-only"><span>Evolution prix revente/an (%) <span class="help-tip" data-tip="Hypothèse d'évolution annuelle du prix de revente.">?</span></span>
            <div class="complex-input">
                <input type="number" inputmode="decimal" step="0.5" id="appreciation" value="0" min="-5" max="10">
                <input type="range" id="appreciation-slider" class="styled-slider" min="-5" max="10" step="0.5" value="0" aria-label="Evolution annuelle du prix de revente">
            </div>
        </label>
        <label class="wizard-expert-only"><span>Frais de revente (%) <span class="help-tip" data-tip="Frais globaux estimés à la revente (agence, frais administratifs, etc.).">?</span></span>
            <input type="number" inputmode="decimal" step="0.1" id="frais-revente" value="7"></label>
        <label class="wizard-expert-only"><span>Taux fiscal sortie SCI-IS (%) <span class="help-tip" data-tip="Utilisé en SCI à l'IS pour estimer l'impôt de sortie.">?</span></span>
            <input type="number" inputmode="decimal" step="0.1" id="taux-pv" value="25"></label>

        <!-- Notes (expert) -->
        <div class="wizard-expert-only" style="margin-top:15px;">
            <label style="display:block; margin-bottom:6px; font-size:0.95rem; font-weight:500;">Notes de visite</label>
            <textarea id="commentaires-input" rows="3" placeholder="Notes sur la visite, l'état du bien..."></textarea>
        </div>
    </div>

    <!-- Projets sauvegardés (accessible depuis étape 4) -->
    <details class="projects-details" id="projects-section" style="margin-top:16px;">
        <summary class="projects-summary">Mes projets sauvegardés <span class="projects-count-badge" id="projects-count-badge"></span></summary>
        <div class="projects-body">
            <p class="photo-help" style="margin-bottom: 10px; text-align: left;">Sauvegardez vos visites pour les comparer plus tard.</p>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="project-name" placeholder="Nom du projet (ex: T2 Centre)" style="flex: 1; text-align: left;">
                <button type="button" id="btn-save-project" class="btn-primary" style="padding: 10px; white-space: nowrap;">Sauvegarder</button>
            </div>
            <ul id="projects-list" class="projects-list"></ul>
            <div class="projects-limit-bar" id="projects-limit-bar" style="display:none;">
                <span>Sauvegardés : <span class="limit-count" id="projects-limit-count">0 / 3</span></span>
                <button type="button" class="limit-upgrade" onclick="window.openAccountModal()">Illimité avec Pro+ →</button>
            </div>
            <button type="button" id="btn-compare-projects" class="btn-secondary" style="width: 100%; margin-top: 10px; display: none;">Comparer les projets</button>
            <div class="cloud-sync-strip">
                <span class="cloud-sync-icon">☁</span>
                <span class="cloud-sync-text">Sync multi-appareils — <em>Prochainement dans Pro+</em></span>
                <button type="button" class="cloud-sync-cta" onclick="window.openAccountModal()">En savoir plus</button>
            </div>
        </div>
    </details>

    <div class="wizard-nav" style="margin-top:16px;">
        <button type="button" class="wizard-btn-prev btn-secondary" data-prev="3">← Retour</button>
        <button type="button" id="btn-wizard-analyser" class="btn-primary">Analyser ce bien →</button>
    </div>
</div>
```

- [ ] **Step 2 : Vérifier que les inputs critiques existent**

Ouvrir la console du navigateur et taper :
```javascript
['prix','loyer','nego','notaire','travaux','meubles','apport','taux-input','taux-slider',
 'duree','assurance','agence','frais-bancaires','vacance','copro','fonciere','pno','gestion',
 'revenus','regime','inflation','inflation-slider','appreciation','appreciation-slider',
 'prix-revente-estime','frais-revente','taux-pv'].every(id => !!document.getElementById(id))
```
Résultat attendu : `true`

- [ ] **Step 3 : Commit**

```bash
git add index.html
git commit -m "feat: replace accordion form with 4-step wizard HTML"
```

---

## Task 5 — CSS : Styles du wizard

**Fichiers :**
- Modifier : `styles.css`

- [ ] **Step 1 : Ajouter les styles wizard à la fin de `styles.css`**

```css
/* === WIZARD === */
.wizard-step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 20px 10px 24px;
}
.wizard-step-dot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}
.wsd-num {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--border-color);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, color 0.2s;
}
.wizard-step-dot.active .wsd-num,
.wizard-step-dot.current .wsd-num {
    background: var(--primary-color);
    color: #fff;
}
.wsd-label {
    font-size: 0.68rem;
    color: var(--text-secondary);
    white-space: nowrap;
}
.wizard-step-dot.current .wsd-label { color: var(--primary-color); font-weight: 600; }
.wizard-step-connector {
    flex: 1;
    height: 2px;
    background: var(--border-color);
    margin: 0 6px;
    margin-bottom: 16px;
    max-width: 60px;
    transition: background 0.2s;
}

.wizard-step-card {
    background: var(--card-bg);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-light);
    padding: 20px 18px;
}
.wizard-step-title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    margin-bottom: 16px;
    color: var(--primary-color);
}
.wizard-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    gap: 12px;
}
.wizard-nav > div { flex: 1; }
.wizard-btn-next, .wizard-btn-prev { min-width: 120px; }
```

- [ ] **Step 2 : Vérifier le rendu**

Ouvrir `index.html`. Après avoir cliqué "Estimation rapide" depuis l'accueil (si la logique est déjà en place) ou en forçant l'affichage du tab Saisie via DevTools : l'indicateur d'étapes s'affiche en haut, la carte Étape 1 est visible, les boutons de navigation sont en bas.

- [ ] **Step 3 : Commit**

```bash
git add styles.css
git commit -m "feat: add wizard step indicator and navigation CSS"
```

---

## Task 6 — JS : Navigation wizard dans main.js

**Fichiers :**
- Modifier : `main.js`

- [ ] **Step 1 : Ajouter les variables et fonctions wizard**

Localiser le bloc `// --- ÉTAT GLOBAL ---` (~line 11) et ajouter après les déclarations existantes :

```javascript
// --- WIZARD ---
let currentWizardStep = 1;
let wizardMode = 'rapide';
```

- [ ] **Step 2 : Ajouter `setWizardMode` et `goToStep`**

Juste avant la fonction `showAccueil` (ajoutée en Task 3), insérer :

```javascript
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
```

- [ ] **Step 3 : Ajouter `initWizard` et l'appeler depuis `initApp`**

Ajouter la fonction `initWizard` juste avant `initApp` :

```javascript
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
```

Dans `initApp`, ajouter `initWizard();` après `updateFormProgress()` et avant `showAccueil()` :

```javascript
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
    showAccueil();
}
```

- [ ] **Step 4 : Vérifier le flux complet**

1. Ouvrir `index.html` → accueil.
2. Cliquer "Estimation rapide" → wizard étape 1. Les champs `.wizard-expert-only` sont cachés.
3. Cliquer "Suivant →" → étape 2. L'indicateur en haut montre l'étape 2 courante.
4. Naviguer jusqu'à étape 4. Bouton "Analyser ce bien →" présent.
5. Cliquer "Analyser ce bien →" → calcul et basculement sur tab Analyse.
6. Vérifier en console : `getCurrentInputs()` retourne bien un objet avec toutes les clés.

- [ ] **Step 5 : Vérifier le mode Analyse complète**

1. Retour à l'accueil via "⌂".
2. Cliquer "Analyse complète" → wizard étape 1. Les champs `.wizard-expert-only` sont visibles (nego, notaire, travaux, mobilier).
3. Naviguer entre les étapes — les champs expert restent visibles.

- [ ] **Step 6 : Commit**

```bash
git add main.js
git commit -m "feat: wizard navigation logic (goToStep, setWizardMode, initWizard)"
```

---

## Task 7 — HTML : Redesign du bloc verdict (score-banner)

**Fichiers :**
- Modifier : `index.html`

**Contexte :** `pdf.js` lit `#score-banner`, `#score-label`, `#score-stars`, `#score-detail`. Ces IDs sont conservés. La structure interne change pour afficher le verdict en grand, avec une phrase d'action.

- [ ] **Step 1 : Remplacer le contenu de `#score-banner`**

Localiser dans `index.html` le bloc :
```html
<div id="score-banner" class="score-banner">
    ...
</div>
```

Et remplacer par :

```html
<div id="score-banner" class="score-banner">
    <div class="verdict-level">
        <span id="score-label" class="verdict-label">--</span>
    </div>
    <p id="verdict-phrase" class="verdict-phrase"></p>
    <div class="verdict-secondary">
        <span id="score-detail" class="verdict-detail">Lancez un calcul pour voir l'analyse</span>
    </div>
    <!-- Éléments conservés pour compatibilité pdf.js (non affichés) -->
    <span id="score-emoji" style="display:none;"></span>
    <span id="score-stars" style="display:none;"></span>
</div>
```

- [ ] **Step 2 : Commit**

```bash
git add index.html
git commit -m "feat: redesign score-banner as verdict hero block"
```

---

## Task 8 — CSS : Verdict hero 4 variantes

**Fichiers :**
- Modifier : `styles.css`

- [ ] **Step 1 : Ajouter les styles verdict hero à la fin de `styles.css`**

Remplacer ou compléter les styles existants du `.score-banner`. Les anciens styles `.score-excellent`, `.score-bon` etc. peuvent être gardés pour éviter de casser le PDF, mais les nouveaux styles les surchargent :

```css
/* === VERDICT HERO (remplace score-banner) === */
.score-banner {
    border-radius: var(--border-radius);
    padding: 28px 24px;
    margin-bottom: 20px;
    text-align: center;
    border: 1px solid var(--border-color);
    transition: background 0.3s, border-color 0.3s;
}
.verdict--rentable  { background: rgba(63,185,80,0.10);  border-color: #3FB950; }
.verdict--correct   { background: rgba(201,168,76,0.10); border-color: #C9A84C; }
.verdict--fragile   { background: rgba(255,149,0,0.10);  border-color: #ff9500; }
.verdict--eviter    { background: rgba(248,81,73,0.10);  border-color: #F85149; }

.verdict-label {
    display: block;
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 5vw, 2.2rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
}
.verdict--rentable .verdict-label { color: #3FB950; }
.verdict--correct  .verdict-label { color: #C9A84C; }
.verdict--fragile  .verdict-label { color: #ff9500; }
.verdict--eviter   .verdict-label { color: #F85149; }

.verdict-phrase {
    font-size: 0.92rem;
    color: var(--text-secondary);
    margin: 10px auto 0;
    max-width: 480px;
    line-height: 1.5;
}
.verdict-secondary { margin-top: 12px; }
.verdict-detail { font-size: 0.78rem; color: var(--text-secondary); opacity: 0.75; }
```

- [ ] **Step 2 : Vérifier le rendu**

Lancer un calcul (Analyser un bien depuis le wizard). Le bloc verdict doit afficher un grand label coloré, une phrase d'action, et les chiffres CF/renta en petit en dessous.

- [ ] **Step 3 : Commit**

```bash
git add styles.css
git commit -m "feat: verdict hero CSS with 4 color variants"
```

---

## Task 9 — JS : Mise à jour de `updateScoreBanner` dans ui.js

**Fichiers :**
- Modifier : `ui.js`

- [ ] **Step 1 : Remplacer `updateScoreBanner` dans `ui.js`**

Localiser la fonction `export function updateScoreBanner(cfNetNet, rentaNette, tips)` (~line 83) et la remplacer intégralement par :

```javascript
export function updateScoreBanner(cfNetNet, rentaNette, tips) {
    let pts = 0;
    if (cfNetNet >= 300) pts += 3; else if (cfNetNet >= 100) pts += 2; else if (cfNetNet >= 0) pts += 1;
    if (rentaNette >= 7) pts += 3; else if (rentaNette >= 5) pts += 2; else if (rentaNette >= 3.5) pts += 1;

    let cls, label, phrase, stars;
    if (pts >= 5) {
        cls    = 'verdict--rentable';
        label  = 'Rentable';
        stars  = '★★★';
        phrase = 'Ce bien présente un profil solide. Vous pouvez avancer sereinement.';
    } else if (pts >= 3) {
        cls    = 'verdict--correct';
        label  = 'Correct — à négocier';
        stars  = '★★☆';
        phrase = 'Ce bien est viable, mais une négociation du prix améliorerait sensiblement la rentabilité.';
    } else if (pts >= 1) {
        cls    = 'verdict--fragile';
        label  = 'Fragile';
        stars  = '★☆☆';
        phrase = 'Ce bien reste équilibré dans le meilleur des cas. Examinez les leviers avant de vous engager.';
    } else {
        cls    = 'verdict--eviter';
        label  = 'À éviter';
        stars  = '☆☆☆';
        phrase = 'Ce bien génère un cash-flow négatif significatif. Il est déconseillé sans renégociation majeure.';
    }

    const banner = document.getElementById('score-banner');
    banner.className = 'score-banner ' + cls;
    document.getElementById('score-label').innerText = label;
    document.getElementById('score-stars').innerText = stars;

    const sign = cfNetNet >= 0 ? '+' : '';
    document.getElementById('score-detail').innerText =
        `CF ${sign}${Math.round(cfNetNet)} €/mois · Renta nette ${rentaNette.toFixed(1)} %`;

    const phraseEl = document.getElementById('verdict-phrase');
    if (phraseEl) phraseEl.innerText = phrase;

    const emojiEl = document.getElementById('score-emoji');
    if (emojiEl) emojiEl.innerText = '';

    _updateVerdictWhy(cfNetNet, rentaNette, tips, pts);
}
```

- [ ] **Step 2 : Vérifier les 4 niveaux de verdict**

Dans la console, après avoir lancé des calculs avec différentes valeurs :
- Prix 200 000€, loyer 500€ → verdict "À éviter" (rouge)
- Prix 100 000€, loyer 700€ → verdict "Correct" ou "Rentable" (ambre/vert)
- Vérifier que le label, la phrase et la couleur de fond changent correctement à chaque recalcul.

- [ ] **Step 3 : Commit**

```bash
git add ui.js
git commit -m "feat: updateScoreBanner → 4 verdict levels (Rentable/Correct/Fragile/À éviter)"
```

---

## Task 10 — HTML + CSS + JS : Collapse mobile des sections expertes

**Fichiers :**
- Modifier : `index.html`, `styles.css`, `main.js`

**Contexte :** Sur mobile (< 768px), les sections expertes de la page Analyse (Détails de l'opération, Scénarios & Sensibilité, Projections 25 ans) doivent être repliées par défaut. Un bouton "Voir l'analyse complète" les déplie toutes.

- [ ] **Step 1 : Ajouter le bouton "Voir l'analyse complète" dans index.html**

Dans `index.html`, après le bloc `<!-- BLOC 4 : Leviers d'optimisation -->` et avant `<!-- BLOC 5 : Fiscalité comparée -->`, insérer :

```html
<!-- Bouton expand expert sections (mobile) -->
<button type="button" id="btn-expand-expert" class="btn-expand-expert" style="display:none;">
    Voir l'analyse complète ↓
</button>
```

- [ ] **Step 2 : Ajouter le CSS du bouton et du collapse mobile dans styles.css**

```css
/* === MOBILE EXPERT COLLAPSE === */
.btn-expand-expert {
    display: block;
    width: 100%;
    padding: 12px;
    margin: 16px 0;
    background: var(--card-bg);
    border: 1.5px dashed var(--border-color);
    border-radius: var(--border-radius);
    color: var(--primary-color);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: background 0.2s;
}
.btn-expand-expert:hover { background: var(--border-color); }

@media (max-width: 768px) {
    .expert-collapsible { display: none; }
    .expert-collapsible.expanded { display: block; }
}
```

- [ ] **Step 3 : Ajouter la classe `expert-collapsible` aux sections expertes dans index.html**

Localiser les 3 `<details>` sections expertes dans `#view-results` et leur ajouter la classe :
- `id="section-details-op"` → ajouter classe `expert-collapsible`
- `id="section-details-analyse"` → ajouter classe `expert-collapsible`
- `id="section-details-projections"` → ajouter classe `expert-collapsible`

Exemple :
```html
<details class="section-collapsible expert-collapsible" id="section-details-op">
```

- [ ] **Step 4 : Ajouter la logique JS dans main.js**

Après la fonction `initWizard`, ajouter :

```javascript
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
```

Dans `initApp`, ajouter `initExpertCollapse();` après `initWizard();`.

- [ ] **Step 5 : Vérifier sur mobile**

Simuler mobile dans DevTools (375px). Lancer un calcul. Les sections Détails, Scénarios et Projections doivent être masquées. Le bouton "Voir l'analyse complète ↓" est visible. Cliquer dessus → les sections s'ouvrent.

Sur desktop : toutes les sections sont visibles, le bouton est absent.

- [ ] **Step 6 : Commit**

```bash
git add index.html styles.css main.js
git commit -m "feat: mobile collapse for expert analysis sections"
```

---

## Task 11 — HTML : Réordonner les blocs de la page Analyse

**Fichiers :**
- Modifier : `index.html`

**Contexte :** L'ordre actuel dans `#view-results` est : verdict → verdict-why → actions → KPIs → disclaimer → leviers → détails. L'ordre cible est : verdict → actions → KPIs → verdict-why → leviers → détails experts.

- [ ] **Step 1 : Réordonner les blocs dans `#view-results`**

Dans `index.html`, localiser le `<div id="export-area">` dans `#view-results`. Réorganiser les blocs dans l'ordre suivant (déplacer les divs existantes — ne pas les réécrire, juste changer leur position) :

```
1. #score-banner          (verdict hero — déjà en premier)
2. .verdict-actions       (actions PDF/Partage — à remonter juste après verdict)
3. .metrics-grid          (KPIs — déjà à cet endroit)
4. #verdict-why           (à déplacer APRÈS les KPIs)
5. .results-disclaimer    (disclaimer)
6. #optimization-card     (leviers — inchangé)
7. .card (fiscalité)      (régimes fiscaux — inchangé)
8. #section-details-op    (expert-collapsible)
9. #section-details-analyse
10. #section-details-projections
11. #section-methodologie
```

L'opération concrète : couper le bloc `<div class="verdict-actions">` (lignes ~246-259) et le coller immédiatement après `</div>` du `#score-banner` (ligne ~241). Puis couper `<div id="verdict-why" ...>` et le coller après `</div>` de `.metrics-grid`.

- [ ] **Step 2 : Vérifier l'ordre visuel**

Lancer un calcul. Vérifier que l'ordre affiché est bien : verdict → boutons PDF/Partage/Comparer → KPIs → "Pourquoi ce verdict" → Leviers → sections expertes.

- [ ] **Step 3 : Commit**

```bash
git add index.html
git commit -m "feat: reorder analyse page blocks (verdict-first layout)"
```

---

## Task 12 — Mise à jour de commercial.md

**Fichiers :**
- Modifier : `commercial.md`

- [ ] **Step 1 : Mettre à jour le statut des lots dans commercial.md**

Dans `commercial.md` section 11.5 (tableau de suivi), mettre à jour les lignes des lots 1 et 2 :

```
| 1 | Effectue | Écran d'accueil + wizard 4 étapes (Estimation rapide / Analyse complète). Navigation Suivant/Retour. Bouton ⌂ header. SessionStorage pour le mode. |
| 2 | Effectue | Score banner remplacé par bloc verdict hero 4 niveaux (Rentable/Correct — à négocier/Fragile/À éviter). Page Analyse réordonnée (verdict → actions → KPIs → pourquoi → leviers → détails). Sections expertes repliées sur mobile. |
```

- [ ] **Step 2 : Commit final**

```bash
git add commercial.md
git commit -m "docs: update lots 1 & 2 status to Effectue"
```

---

## Récapitulatif des commits

| Commit | Tâche |
|---|---|
| `feat: add accueil screen and header home button` | Task 1 |
| `feat: add accueil screen CSS` | Task 2 |
| `feat: accueil screen show/hide logic and initApp update` | Task 3 |
| `feat: replace accordion form with 4-step wizard HTML` | Task 4 |
| `feat: add wizard step indicator and navigation CSS` | Task 5 |
| `feat: wizard navigation logic (goToStep, setWizardMode, initWizard)` | Task 6 |
| `feat: redesign score-banner as verdict hero block` | Task 7 |
| `feat: verdict hero CSS with 4 color variants` | Task 8 |
| `feat: updateScoreBanner → 4 verdict levels` | Task 9 |
| `feat: mobile collapse for expert analysis sections` | Task 10 |
| `feat: reorder analyse page blocks (verdict-first layout)` | Task 11 |
| `docs: update lots 1 & 2 status` | Task 12 |
