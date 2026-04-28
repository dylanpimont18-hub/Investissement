# CLAUDE.md — Investisseur Pro

Instructions système et référence d'architecture pour Claude Code.

---

## Vue d'ensemble

**Investisseur Pro** est une application web française d'analyse d'investissement immobilier. C'est une Progressive Web App (PWA) en vanilla JavaScript — **aucun build step, aucun bundler, aucun framework**. L'application tourne entièrement côté client et se déploie en hébergeant les fichiers statiques tels quels.

- Langue de l'interface : **français**
- Déploiement : fichiers statiques servis directement (GitHub Pages, Netlify, serveur HTTP simple)
- Modules : ES Modules natifs (`import`/`export`), pas de CommonJS
- Dépendances externes : Chart.js, jsPDF, jsPDF-AutoTable — toutes chargées depuis CDN dans `index.html`

---

## Architecture des fichiers

> Pour la description complète et à jour de chaque fichier, voir **`contenu.md`** (source de vérité de l'architecture).

### Fichiers principaux

| Fichier | Rôle |
|---|---|
| `index.html` | Structure UI complète (3 onglets, modales, wizard, footer légal). Ne contient pas de logique JS inline significative. |
| `styles.css` | Design system, variables CSS, thèmes clair/sombre, responsive mobile. |
| `main.js` | Contrôleur principal. Imports tous les autres modules. Gère cycle de vie, événements, lecture des inputs, projets sauvegardés, DOM résultats, tableau de projection 25 ans, module Faisabilité. |
| `calculs.js` | Moteur de calcul **pur** (zéro DOM). Exporte `calculateTMI`, `computeCF`, `computeProjectMetrics`, `computeResaleTimeline`. |
| `ui.js` | Composants UI complexes : graphiques Chart.js, tableaux de comparaison/négociation, score banner, toasts, validation des champs, mode Simplifié/Expert. |
| `pdf.js` | Export PDF/impression côté client. Construit un DOM virtuel, utilise jsPDF pour mobile et `window.print()` pour desktop. |
| `billing.js` | Couche d'abstraction abonnement. Centralise l'état Pro+, prépare le branchement Stripe + Supabase. |
| `billing.config.js` | Configuration publique sans secret (URLs Stripe Checkout, portail, clés Supabase publiques). Chargé **avant** `main.js`. |
| `sw.js` | Service Worker PWA. Cache-First pour assets statiques, Network-First pour navigations HTML. Cache versionné `investpro-v3`. |
| `manifest.json` | Configuration PWA (nom, icônes, couleurs, raccourcis d'application). |
| `script.js` | Fichier historique vide — ne pas modifier, ne pas supprimer. |
| `contenu.md` | Index d'architecture du projet. Mettre à jour après chaque changement structurel. |

### Icônes PWA (`icons/`)
- `icon-192.png` — Android / manifest
- `icon-512.png` — Android splash
- `icon-maskable-512.png` — Icône adaptative Android (fond plein, sujet centré à 60%)
- `apple-touch-icon.png` — iOS (180×180)

---

## Conventions de code

### JavaScript
- **Modules ES natifs** : chaque fichier utilise `export`/`import`. Pas de `require()`.
- **Pas de TypeScript** : tout est en JS pur, pas de types statiques.
- **Pas de classes** : architecture fonctionnelle (fonctions exportées, closures).
- **Variables globales autorisées** : `window.openPricingModal`, `window.openAccountModal`, etc. — nécessaires pour les `onclick` inline dans `index.html`.
- **DOM direct** : `document.getElementById()`, `querySelector()` — pas de virtual DOM.
- **Graphiques Chart.js** : singletons module-level (`myChart`, `evolutionChart` dans `ui.js`). Mettre à jour avec `.update()` au lieu de recréer.
- **Commentaires** : en français, concis. Documenter le POURQUOI non-évident, pas le QUOI.

### CSS
- **Variables CSS** : toutes les couleurs et espacements clés sont des custom properties dans `:root`.
- **Thème sombre** : classe `theme-dark` sur `<html>`. Classe `theme-light` pour forcer le clair. Sans classe → suit `prefers-color-scheme`.
- **Responsive** : mobile-first, breakpoints dans `styles.css`.
- **Classe `body.is-premium`** : masque `.pro-badge` et `#btn-pricing-header` quand l'utilisateur est abonné.

### HTML
- **Langue** : `<html lang="fr">`.
- **IDs stables** : les IDs DOM sont référencés depuis JS — ne pas renommer sans mettre à jour toutes les références JS.
- **Wizard** : classes `wizard-expert-only` sur les labels masqués en mode Rapide.

---

## Flux de données

```
index.html (inputs)
    ↓  lecture des valeurs
main.js
    ↓  appels purs
calculs.js  →  retourne métriques
    ↓  résultats
main.js  →  met à jour DOM texte
ui.js    →  met à jour graphiques, tableaux, score
pdf.js   →  export PDF/impression (déclenché manuellement)
```

`calculs.js` ne touche **jamais** le DOM. `main.js` est le seul orchestrateur.

---

## Logique métier clé

### Régimes fiscaux supportés
| Valeur `inputs['regime']` | Nom | Logique |
|---|---|---|
| `micro-foncier` | Micro-foncier | Abattement 30% → revenu imposable × (TMI + CSG/CRDS 17,2%) |
| `reel` | Foncier Réel | Charges + intérêts déductibles, déduction des 10 700 € de déficit foncier |
| `sci-is` | SCI à l'IS | IS 15% jusqu'à 42 500 €, 25% au-delà. Amortissement 80% du prix sur 30 ans. |

### Barème TMI 2024 (`calculateTMI` dans `calculs.js`)
- Calcule le quotient familial (parts = 2 + 0.5/enfant pour le 1er, +1 pour le 2e, +1 par enfant supplémentaire)
- Tranches : 0%, 11%, 30%, 41%, 45%
- `CSG_CRDS_RATE = 0.172` (constante exportée)

### Wizard de saisie
- **Mode Rapide** (`wizardMode = 'rapide'`) : étapes 1 + 4 uniquement, champs `wizard-expert-only` masqués
- **Mode Complet** (`wizardMode = 'complet'`) : 4 étapes (Le Bien → Financement → Exploitation → Fiscalité)
- État `currentWizardStep` géré dans `main.js`

---

## Système Premium (Freemium)

### Limites version gratuite
- `FREE_PROJECT_LIMIT = 3` projets sauvegardés (constante dans `main.js`)
- `PDF_GEN_LIMIT = 3` exports PDF (compteur `pdfGenCount` en localStorage)

### État premium
- Géré par `billing.js` via `localStorage` (clé `simuImmoBillingState`)
- Clé legacy `userAccount` maintenue pour compatibilité
- `applyPremiumClass(userAccount)` → ajoute/retire `body.is-premium`
- `body.is-premium` contrôle la visibilité de tous les éléments premium via CSS

### Configuration billing
- `billing.config.js` : URLs Stripe Checkout/Portal + clés Supabase publiques
- `billing.config.enabled = false` par défaut → mode liste d'attente par email
- Brancher Stripe : renseigner `checkoutUrl`, `portalUrl` et passer `enabled: true`
- Auth à brancher : remplacer le stub `userAccount` par un vrai token de session

### Backend non implémenté (à brancher)
1. **Auth** : Firebase Auth / Supabase / Auth0
2. **DB cloud** : Firestore / Supabase DB → sync `savedProjects` avec `_syncedAt` / `_isLocal`
3. **Paiement** : Stripe → setter `isPremium = true` après validation webhook

---

## PWA & Service Worker

### Stratégie de cache (`sw.js`)
- **Cache-First** : JS, CSS, images, CDN (performance offline)
- **Network-First** : navigations HTML (contenu toujours frais)
- Cache name versionné : `investpro-v3`

### Règle impérative : bump de version
**Chaque fois que le Service Worker change ou que les assets mis en cache changent**, incrémenter `CACHE_NAME` dans `sw.js` (ex : `investpro-v3` → `investpro-v4`). Sinon les anciens caches ne sont pas invalidés.

### Assets CDN cachés avec `mode: 'no-cors'`
Les réponses CDN sont stockées comme "opaque responses" (status 0). C'est attendu et nécessaire pour le mode hors-ligne cross-origin.

### Bannières UI
- `#install-banner` : affiché sur `beforeinstallprompt`, masqué en mode `standalone`, dismissable par session
- `#offline-banner` : affiché quand `navigator.onLine === false`, masqué automatiquement à la reconnexion

---

## localStorage — clés utilisées

| Clé | Contenu |
|---|---|
| `simuImmoProjects` | Array des projets sauvegardés (JSON) |
| `simuImmoBillingState` | État abonnement premium |
| `userAccount` | Clé legacy (alias de billing state) |
| `pdfGenCount` | Compteur d'exports PDF (gate freemium) |

---

## Thèmes clair / sombre

- Toggle via `#btn-theme-toggle` dans le header
- Classe `theme-dark` / `theme-light` sur `document.documentElement`
- Détection automatique via `window.matchMedia('(prefers-color-scheme: dark)')`
- Les graphiques Chart.js lisent `getThemeTextColor()` dans `ui.js` à chaque mise à jour

---

## Développement

### Lancer l'application
Aucun build requis. Servir les fichiers avec n'importe quel serveur HTTP statique :
```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# VS Code
# Extension "Live Server" → clic droit sur index.html → "Open with Live Server"
```

### Tester les changements
Pas de test suite automatisée. Vérification manuelle :
1. Ouvrir dans le navigateur (localhost ou HTTPS)
2. Tester les 3 onglets (Saisie, Analyse, Faisabilité)
3. Vérifier les deux modes wizard (Rapide / Complet)
4. Tester thème clair et sombre
5. Vérifier l'export PDF
6. Tester le mode hors-ligne (DevTools → Network → Offline)

### Modifier les calculs
- Toute logique financière/fiscale → **uniquement dans `calculs.js`**
- `calculs.js` doit rester **pur** (pas d'import DOM, pas de `document.*`)
- Les barèmes fiscaux (TMI, CSG/CRDS) sont des constantes en tête de fichier

### Modifier l'UI
- Composants réutilisables (graphiques, tableaux, toasts) → `ui.js`
- Mise à jour du DOM résultats + orchestration → `main.js`
- Styles → `styles.css` (variables CSS en tête de fichier)

### Ajouter une modale
1. Ajouter le HTML dans `index.html`
2. Ajouter les styles dans `styles.css`
3. Exposer les fonctions `open/close` sur `window` si appelées depuis `onclick` HTML
4. Documenter dans `contenu.md`

---

## Conventions de commit

Format : `type: description courte en français`

Types utilisés dans ce projet :
- `feat:` — nouvelle fonctionnalité
- `fix:` — correction de bug
- `docs:` — mise à jour documentation
- `refactor:` — refactoring sans changement de comportement
- `style:` — corrections CSS/UI sans logique

Exemples tirés de l'historique :
```
feat: preparer l'abonnement web pro
fix: remove missing icon.png, fix install-banner offset
docs: update contenu.md and commercial.md for lots 8 & 9
```

---

## Points d'attention pour les AI assistants

1. **Pas de build** — ne jamais introduire npm, webpack, TypeScript, ou tout autre outillage de build sans accord explicite.
2. **Pas de framework** — pas de React, Vue, Angular. Le projet est intentionnellement vanilla.
3. **Séparation des responsabilités** — ne jamais mettre de logique DOM dans `calculs.js`, ni de logique de calcul directement dans `index.html`.
4. **`contenu.md` est la source de vérité** — le mettre à jour après chaque changement structurel (nouveau fichier, nouvelle fonctionnalité majeure, nouveaux éléments DOM importants).
5. **Service Worker versioning** — toujours bumper `CACHE_NAME` dans `sw.js` si on modifie les assets ou le SW lui-même.
6. **IDs DOM stables** — `pdf.js` lit directement des dizaines d'IDs DOM par nom. Renommer un ID requiert une mise à jour dans `pdf.js` et partout ailleurs.
7. **Freemium gates** — les gates `FREE_PROJECT_LIMIT` et `PDF_GEN_LIMIT` sont intentionnelles ; ne pas les supprimer sans discussion.
8. **Langue** — l'interface, les commentaires significatifs et les messages utilisateur sont en français.
9. **CDN externe** — Chart.js, jsPDF et jsPDF-AutoTable sont chargés depuis jsDelivr. Mettre à jour les versions requiert de bumper aussi les URLs dans `sw.js` (`STATIC_ASSETS`).
10. **Déploiement statique** — l'architecture "zero-backend" est un choix architectural fort. `billing.config.js` est chargé avant `main.js` précisément pour conserver cette propriété.
