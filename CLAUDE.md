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
- **Tax regimes**: `micro-foncier`, `reel` (foncier réel) — each has its own deduction logic in both `calculateAndSave()` and `computeCF()`
- **Vierzon Strategy tab**: uses binary search (40 iterations) on `computeCF()` to find max purchase price or minimum rent needed to hit a target cash-flow

## Results View Helpers

After `calculateAndSave()` computes the main figures, three helpers update the results tab:
- `updateScoreBanner(cfNetNet, rentaNette)` — color-coded investment score
- `updateRegimeComparison(prixNet, inputs, tmi)` — side-by-side table comparing the two tax regimes
- `updateNegoCalc(prixNet, prixAffiche, inputs, tmi)` — negotiation calculator showing price reduction impact

## Key Constants

- `CSG_CRDS_RATE = 0.172` — CSG+CRDS rate on capital income (2024), used across all tax regime calculations
- `triggerCalculations()` debounces recalculation by 150 ms on every input event

## Persistence

- `simuImmoDraft` — auto-saved current form state on every input
- `simuImmoProjects` — array of named saved projects; each project is the `getCurrentInputs()` snapshot plus a `_projectName` key and an optional `photos` array (base64 data URLs from file uploads)

## PWA

`manifest.json` declares this as an installable PWA. An `icon.png` (192×192) is expected at the root but not tracked in git.
