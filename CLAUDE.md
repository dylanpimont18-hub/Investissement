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

## Architecture

Three files make up the entire app:

- **[index.html](index.html)** — UI structure with three tab views: `view-inputs`, `view-results`, `view-vierzon`
- **[script.js](script.js)** — All logic (no framework)
- **[styles.css](styles.css)** — CSS custom properties for theming, dark mode via `prefers-color-scheme`

External CDN dependencies (loaded in `index.html`):
- **Chart.js** — doughnut chart for cash-flow breakdown
- **html2pdf.js** — PDF export of the results view

## Core Data Flow

1. All form inputs are read by `getCurrentInputs()` into a flat object keyed by element `id`
2. `triggerCalculations()` calls both `calculateAndSave()` (tab 2) and `calculateVierzonStrategy()` (tab 3) on every input change
3. `calculateAndSave()` also persists the current form state to `localStorage` key `simuImmoDraft`
4. `computeCF(prixVendeur, loyerMensuel, inputs, tmi)` is the core engine — it is the single source of truth for net-net cash-flow calculation, shared between tabs 2 and 3

## Key Calculations

- **TMI** (tax bracket): computed by `calculateTMI(revenus, enfants)` using the French quotient familial system
- **Tax regimes**: `micro-foncier`, `micro-bic`, `reel` (foncier réel), `lmnp-reel` — each has its own deduction logic in both `calculateAndSave()` and `computeCF()`
- **LMNP Réel** depreciation: building at 85% over 30 years + furniture over 5 years + works over 15 years, with carry-forward of accounting deficits
- **Vierzon Strategy tab**: uses binary search (40 iterations) on `computeCF()` to find max purchase price or minimum rent needed to hit a target cash-flow

## Persistence

- `simuImmoDraft` — auto-saved current form state on every input
- `simuImmoProjects` — array of named saved projects; each project is the `getCurrentInputs()` snapshot plus a `_projectName` key

## PWA

`manifest.json` declares this as an installable PWA. An `icon.png` (192×192) is expected at the root but not tracked in git.
