# Spec — Lots 8 & 9 : Monétisation UI & PWA Offline

**Date :** 2026-04-26  
**Projet :** Investisseur Pro  
**Lots :** 8 (Monétisation freemium UI) + 9 (PWA & expérience offline)  
**Statut :** Approuvé

---

## Contexte

Les Lots 1–7 sont effectués. Le projet dispose déjà de :
- `userAccount { isPremium: false }` en localStorage (`main.js`)
- `FREE_PROJECT_LIMIT = 3` et gate projet sur "Sauvegarder"
- `pdfGenCount` et `PDF_GEN_LIMIT = 3` avec gate modale `#modal-pdf-gate`
- `#modal-compte` avec plans côte à côte (Lot 7)
- `manifest.json` PWA (name, icons, theme_color)
- Pas de Service Worker existant

---

## Lot 8 — Monétisation UI (freemium)

### Objectif

Rendre visible la distinction gratuit/Pro+ dans toute l'interface, sans être agressif, et donner un point d'entrée clair à la proposition de valeur Pro+.

### 8.1 Nouvelle modale `#modal-pricing`

**Déclencheurs :**
- Lien "Pro+" dans le header (à côté de `#btn-account`)
- Bouton "En savoir plus sur Pro+" dans `#modal-pdf-gate`
- Bouton "En savoir plus sur Pro+" dans la gate projet (dans `openAccountModal`)

**Structure HTML (dans `index.html`, après `#modal-compte`) :**

```html
<div id="modal-pricing" class="modal-overlay" style="display:none;" ...>
  <div class="modal-box">
    <button onclick="window.closePricingModal()">✕</button>
    <h2>Investisseur Pro+</h2>
    <p class="modal-subtitle">Passez au niveau supérieur</p>

    <!-- deux colonnes : Gratuit | Pro+ -->
    <div class="plans-grid">
      <div class="plan-card plan-free"> ... </div>
      <div class="plan-card plan-pro featured"> ... </div>
    </div>

    <a href="mailto:gegertauren@gmail.com?subject=Liste d'attente Pro+" class="btn-primary">Rejoindre la liste d'attente →</a>
    <button onclick="window.closePricingModal()" class="btn-ghost">
      Continuer en version gratuite
    </button>
  </div>
</div>
```

**Contenu des plans :**

| Gratuit | Pro+ |
|---|---|
| 3 projets sauvegardés | Projets illimités |
| 3 exports PDF | Exports PDF illimités |
| Calcul & analyse complète | Calcul & analyse complète |
| Stockage local | Sync cloud multi-appareils |
| — | Comparateur avancé |
| — | Mode Expert complet |

**État premium :** `userAccount.isPremium = true` → le lien header affiche "✓ Pro+" (texte statique, pas de lien vers `#modal-pricing`).

**API JS exposée :**
- `window.openPricingModal()`
- `window.closePricingModal()`
- Fermeture sur clic overlay et touche Escape

---

### 8.2 Micro-badges `Pro+`

**CSS uniquement** — un `<span class="pro-badge">Pro+</span>` pill (doré ou bleu accentué, petit, inline).

**Règle de masquage global :**
```css
body.is-premium .pro-badge { display: none; }
```

La classe `.is-premium` est ajoutée sur `<body>` au chargement si `userAccount.isPremium === true` (dans `main.js`, au DOMContentLoaded).

**Emplacements des badges :**

| Élément DOM | Note |
|---|---|
| Bouton "Exporter PDF" | Badge toujours visible en gratuit |
| Bouton "Sauvegarder" | Badge toujours visible en gratuit |
| Bouton "Comparer" dans l'onglet Analyse | Badge toujours visible en gratuit |
| `.cloud-sync-strip` | Enrichi avec lien `openPricingModal()` |

Les badges sont des éléments HTML **statiques** dans `index.html` — toujours présents pour les utilisateurs gratuits. La logique de masquage est purement CSS via `body.is-premium .pro-badge { display: none }`. Pas de logique JS de visibilité conditionnelle par badge.

---

### 8.3 Enrichissement des gates existantes

**`#modal-pdf-gate` :** Ajout d'un bouton secondaire `"En savoir plus sur Pro+"` qui appelle `window.openPricingModal()`.

**Gate projet (`openAccountModal` dans `main.js`) :** Lorsque la gate est atteinte (4e projet bloqué), la modale compte affiche un message contextuel + lien vers `#modal-pricing`.

**Contrainte absolue :** Ne pas modifier la logique des gates — enrichir le wording et ajouter le lien uniquement.

---

### 8.4 Contraintes techniques Lot 8

- Ne pas créer de doublon avec `#modal-compte` — la modale compte reste pour la gestion du compte (état, projets, sync)
- `userAccount` dans `main.js` est le seul point d'entrée pour l'état premium
- `pdfGenCount` et `FREE_PROJECT_LIMIT` sont réutilisés tels quels
- `#score-banner`, `#score-label`, `#score-stars`, `#score-detail` : IDs inchangés
- `#btn-simulate` reste dans le DOM (caché si besoin)
- Ne pas modifier `calculs.js`

---

## Lot 9 — PWA & Expérience Offline

### Objectif

L'app fonctionne sans connexion après le premier chargement. L'installation est encouragée discrètement.

### 9.1 Service Worker (`sw.js`)

**Fichier :** `sw.js` à la racine du projet.

**Nom de cache :** `investpro-v1` (incrémenter à chaque mise à jour des assets).

**Stratégie Cache-First (assets statiques) — mis en cache à l'installation (`install`) :**
```
index.html
main.js
calculs.js
ui.js
pdf.js
styles.css
manifest.json
icon.png
https://cdn.jsdelivr.net/npm/chart.js  (ou URL exacte utilisée)
https://cdnjs.cloudflare.com/ajax/libs/jspdf/...
https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/...
```

**Stratégie Network-First (`index.html`) :** Tente le réseau, fallback sur cache si offline. Évite de servir un `index.html` obsolète.

**Activation immédiate :** `skipWaiting()` + `clients.claim()` dans le SW pour que la mise à jour soit prise en compte au prochain chargement sans intervention utilisateur.

**Enregistrement (dans `main.js`, fin de DOMContentLoaded) :**
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
```

**Mise à jour de `contenu.md` :** Ajouter `sw.js` à la liste des fichiers racine.

---

### 9.2 Bannière d'installation `#install-banner`

**HTML (dans `index.html`, juste après `<body>`) :**
```html
<div id="install-banner" style="display:none;" role="banner">
  <span>📲 Installer Investisseur Pro</span>
  <button id="btn-install">Installer</button>
  <button id="btn-install-dismiss" aria-label="Fermer">✕</button>
</div>
```

**Comportement :**
- Écoute `beforeinstallprompt` → stocke le `deferredPrompt`, affiche la bannière
- Bouton "Installer" → `deferredPrompt.prompt()` → cache la bannière
- Bouton "✕" → `sessionStorage.setItem('installBannerDismissed', '1')` → cache la bannière
- Au chargement : si `sessionStorage.getItem('installBannerDismissed')` → ne pas afficher
- Si l'app est déjà en mode `standalone` (`window.matchMedia('(display-mode: standalone)').matches`) → ne pas afficher

**CSS :** Barre fixe en bas d'écran (`position: fixed; bottom: 0`), hauteur compacte (~48px), fond semi-opaque, `z-index` élevé. Cohérent avec le design system existant (variables CSS).

**Logique :** Dans `main.js` (pas de fichier séparé).

---

### 9.3 Bandeau offline `#offline-banner`

**HTML (dans `index.html`, juste après le header) :**
```html
<div id="offline-banner" style="display:none;" role="status" aria-live="polite">
  ⚠️ Mode hors-ligne — Les données locales restent disponibles
</div>
```

**Comportement :**
- Au chargement : `if (!navigator.onLine)` → afficher
- Événement `offline` → afficher
- Événement `online` → masquer automatiquement
- Non-dismissable (informatif, pas bloquant)

**CSS :** Bandeau pleine largeur, fond ambre (`#F59E0B`), texte sombre, sobre. S'insère entre le header et les onglets.

**Logique :** Dans `main.js`.

---

### 9.4 Contraintes techniques Lot 9

- Le SW doit lister les URLs CDN exactes utilisées dans `index.html` (à vérifier au moment de l'implémentation)
- Les assets CDN peuvent échouer à se mettre en cache (CORS) — le SW doit utiliser `{ mode: 'no-cors' }` pour les ressources cross-origin ou les ignorer silencieusement en cas d'erreur
- `manifest.json` est déjà valide — pas de modification nécessaire sauf si des icônes supplémentaires sont ajoutées
- Tester offline via DevTools → Network → Offline après premier chargement

---

## Fichiers impactés

| Fichier | Lot | Nature des changements |
|---|---|---|
| `index.html` | 8 | Nouvelle modale `#modal-pricing`, micro-badges, lien header, `#install-banner`, `#offline-banner` |
| `styles.css` | 8+9 | `.pro-badge`, `body.is-premium .pro-badge`, `.plan-card`, `#install-banner`, `#offline-banner` |
| `main.js` | 8+9 | `openPricingModal()`, `closePricingModal()`, `.is-premium` sur body, SW registration, `beforeinstallprompt`, offline/online events |
| `sw.js` | 9 | Nouveau fichier — Service Worker |
| `contenu.md` | 9 | Ajouter `sw.js` |
| `commercial.md` | 8+9 | Mettre à jour 11.5 après implémentation |

---

## Définition de terminé

### Lot 8
- [ ] Un utilisateur gratuit voit les badges Pro+ sur les fonctionnalités premium
- [ ] La modale `#modal-pricing` s'ouvre depuis le header et depuis les gates
- [ ] `isPremium = true` dans localStorage → tous les badges disparaissent, lien header devient "✓ Pro+"
- [ ] Les gates existantes ont un lien "En savoir plus sur Pro+"

### Lot 9
- [ ] Sur Chrome/Edge : bannière d'installation apparaît (discrète, dismissable par session)
- [ ] DevTools → Network → Offline → l'app charge depuis le cache
- [ ] Connexion coupée → bandeau ambre apparaît ; reconnexion → bandeau disparaît
- [ ] Console → aucune erreur Service Worker
