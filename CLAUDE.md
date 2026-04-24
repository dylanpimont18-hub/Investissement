# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Investisseur Pro** is a French-language real estate investment simulator — a pure front-end PWA (Progressive Web App) with no build system, no dependencies to install, and no server. Open `index.html` directly in a browser to run it.

## Running the App

No build step needed. Simply open `index.html` in a browser, or serve it with any static file server:

```bash
npx serve .
# or
python -m http.server
```

## Architecture (ES Modules)

The application logic is modularized. The core files are:

- **`index.html`** — UI structure with three tab views: `view-inputs`, `view-results`, `view-vierzon`. Loads Chart.js, jsPDF and jsPDF-AutoTable from CDN.
- **`styles.css`** — CSS custom properties for theming, dark mode via `prefers-color-scheme`, responsive mobile design.
- **`main.js`** — Main controller: lifecycle, events, input reading, saved projects (localStorage), and a large portion of DOM updates (textual results injection, 25-year projection table, Vierzon tab logic).
- **`calculs.js`** — Pure math and tax engine. No DOM access. Contains `calculateTMI`, `computeCF` (net-net cash-flow), and `computeProjectMetrics`.
- **`ui.js`** — Complex display components: Chart.js charts, comparison/negotiation tables, score banner, tooltips, toasts, field validation errors, and Simple/Expert mode toggle.
- **`pdf.js`** — Report export logic (virtual DOM construction, dedicated print styles, browser print document generation, and client-side PDF generation for mobile sharing).

*Note: `script.js` is kept only for historical reference and should not be used.*

External CDN dependencies (loaded in `index.html`):
- **Chart.js** — doughnut chart for cash-flow breakdown and evolution lines.
- **jsPDF** — client-side PDF generation for mobile sharing.
- **jsPDF-AutoTable** — paginated PDF tables for negotiation, projection, and resale sections.

## Core Data Flow & Key Calculations

1. **Input Reading**: All form inputs are read into a flat object keyed by element `id`.
2. **Debounced Calculations**: `triggerCalculations()` (in `main.js`) calls the main calculation pipelines on every input change.
3. **Core Engine**: `computeCF(prixVendeur, loyerMensuel, inputs, tmi)` in `calculs.js` is the single source of truth for net-net cash-flow calculation.
4. **Tax regimes**: `micro-foncier`, `reel` (foncier réel), and `sci-is` — handled directly within the calculation engine.
5. **Persistence**: `simuImmoDraft` for auto-saving current form state, and `simuImmoProjects` for named saved projects.

## WORKFLOW OBLIGATOIRE ET GESTION DES TOKENS

Tous les fichiers sont bloqués par défaut via `.claudesignore`. Pour naviguer dans le projet, tu DOIS suivre ce workflow strict :

1. **ANALYSE :** Commence TOUJOURS par lire `contenu.md`. Ce fichier contient la cartographie du projet.
2. **CIBLAGE :** Sur la base de `contenu.md`, détermine le(s) fichier(s) strictement nécessaire(s) à la tâche et utilise tes outils pour lire uniquement ces fichiers spécifiques.
3. **MODIFICATION :** Effectue les changements demandés dans le code.
4. **MISE À JOUR DE L'INDEX :** Si tu crées un fichier, supprimes un fichier, ou modifies substantiellement la responsabilité d'un fichier existant, tu DOIS impérativement mettre à jour `contenu.md` pour refléter la nouvelle architecture.
