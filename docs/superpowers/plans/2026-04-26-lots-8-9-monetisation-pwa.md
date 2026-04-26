# Lots 8 & 9 — Monétisation UI & PWA Offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page pricing Pro+, des micro-badges freemium et une expérience PWA offline complète (Service Worker + bannière installation + bandeau offline).

**Architecture:** Lot 8 — nouvelle modale `#modal-pricing` + `<span class="pro-badge">` CSS-only masqués par `body.is-premium` + enrichissement des gates existantes. Lot 9 — `sw.js` (Cache-First local / Network-First index.html) enregistré depuis `main.js` + `#install-banner` sessionStorage + `#offline-banner` événements réseau.

**Tech Stack:** HTML/CSS/JS vanilla ES Modules, Service Worker API, Web App Install API (`beforeinstallprompt`). Pas de framework, pas de build step.

---

> **Note TDD :** ce projet n'a pas de framework de test automatisé. Chaque tâche inclut des étapes de vérification manuelle dans le navigateur à la place des tests unitaires.

---

## Fichiers modifiés

| Fichier | Lot | Nature |
|---|---|---|
| `styles.css` | 8+9 | Ajouts CSS : `.pro-badge`, `body.is-premium .pro-badge`, `#modal-pricing` styles, `#install-banner`, `#offline-banner` |
| `index.html` | 8+9 | `#modal-pricing`, micro-badges sur 3 boutons, lien pricing header, `#install-banner`, `#offline-banner` |
| `main.js` | 8+9 | `openPricingModal()`, `closePricingModal()`, `.is-premium` sur body, Escape handler, lien pricing dans gates, SW registration, `beforeinstallprompt`, offline/online |
| `sw.js` | 9 | Nouveau — Service Worker |
| `contenu.md` | 9 | Ajouter `sw.js` |
| `commercial.md` | 8+9 | Mettre à jour section 11.5 |

---

## Task 1 : CSS — `.pro-badge` et styles `#modal-pricing` (Lot 8)

**Files:**
- Modify: `styles.css`

- [ ] **Étape 1 : Ajouter les styles du badge Pro+ et de la modale pricing**

Ouvrir `styles.css`. Trouver le bloc des styles `.account-plan-card` (environ ligne 938). Après ce bloc, ajouter :

```css
/* === LOT 8 — Pro Badge & Pricing Modal === */
.pro-badge {
    display: inline-block;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #fff;
    background: var(--gold-color, #C9A84C);
    border-radius: 8px;
    padding: 1px 6px;
    margin-left: 5px;
    vertical-align: middle;
    line-height: 1.6;
    pointer-events: none;
    user-select: none;
}
body.is-premium .pro-badge { display: none; }

#modal-pricing .modal-content {
    max-width: 640px;
}
#modal-pricing .pricing-subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    text-align: center;
    margin: 0 0 20px;
}
#modal-pricing .pricing-plans-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 20px;
}
#modal-pricing .pricing-plan-card {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px 18px;
    position: relative;
}
#modal-pricing .pricing-plan-card.featured {
    border-color: var(--gold-color, #C9A84C);
    background: linear-gradient(135deg, var(--card-bg) 0%, rgba(201,168,76,0.06) 100%);
}
#modal-pricing .pricing-plan-label {
    position: absolute;
    top: -10px;
    right: 14px;
    background: var(--gold-color, #C9A84C);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 9px;
    border-radius: 9px;
    letter-spacing: 0.05em;
}
#modal-pricing .pricing-plan-title {
    font-size: 1rem;
    font-weight: 700;
    font-family: var(--font-display);
    margin-bottom: 12px;
}
#modal-pricing .pricing-plan-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    padding: 0;
}
#modal-pricing .pricing-plan-features li {
    font-size: 0.85rem;
    color: var(--text-secondary);
}
#modal-pricing .pricing-plan-card.featured .pricing-plan-features li {
    color: var(--text-color);
}
#modal-pricing .pricing-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    margin-top: 4px;
}
#modal-pricing .pricing-actions .btn-primary {
    width: 100%;
    text-align: center;
    text-decoration: none;
}
.btn-ghost {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: color 0.2s;
}
.btn-ghost:hover { color: var(--text-color); }

@media (max-width: 500px) {
    #modal-pricing .pricing-plans-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Étape 2 : Vérification visuelle**

Ouvrir `index.html` dans un navigateur. Dans la console DevTools, taper :
```js
document.body.classList.add('is-premium');
```
Aucun élément `.pro-badge` ne doit être visible (ils n'existent pas encore, mais la règle CSS doit être parsée sans erreur). Vérifier dans l'onglet "Styles" que `.pro-badge` et `body.is-premium .pro-badge` sont bien listés.

- [ ] **Étape 3 : Commit**

```bash
git add styles.css
git commit -m "feat: add pro-badge and pricing modal CSS (lot 8)"
```

---

## Task 2 : HTML — `#modal-pricing` + micro-badges + lien header (Lot 8)

**Files:**
- Modify: `index.html`

- [ ] **Étape 1 : Ajouter les micro-badges sur les boutons**

Dans `index.html`, localiser le bouton `#btn-save-project` (ligne ~231). Remplacer :
```html
<button type="button" id="btn-save-project" class="btn-primary" style="padding: 10px; white-space: nowrap;">Sauvegarder</button>
```
Par :
```html
<button type="button" id="btn-save-project" class="btn-primary" style="padding: 10px; white-space: nowrap;">Sauvegarder<span class="pro-badge">Pro+</span></button>
```

Localiser le bouton `#btn-compare-projects` (ligne ~238). Remplacer :
```html
<button type="button" id="btn-compare-projects" class="btn-secondary" style="width: 100%; margin-top: 10px; display: none;">Comparer les projets</button>
```
Par :
```html
<button type="button" id="btn-compare-projects" class="btn-secondary" style="width: 100%; margin-top: 10px; display: none;">Comparer les projets<span class="pro-badge">Pro+</span></button>
```

Localiser le bouton `#btn-save-pdf` (dans `#pdf-action-bar`, ligne ~895). Remplacer :
```html
<button id="btn-save-pdf" class="btn-pdf-action btn-pdf-save">🖨️ Imprimer / PDF</button>
```
Par :
```html
<button id="btn-save-pdf" class="btn-pdf-action btn-pdf-save">🖨️ Imprimer / PDF<span class="pro-badge">Pro+</span></button>
```

Localiser `.cloud-sync-strip` (ligne ~239). Remplacer le bouton `cloud-sync-cta` :
```html
<button type="button" class="cloud-sync-cta" onclick="window.openAccountModal()">En savoir plus</button>
```
Par :
```html
<button type="button" class="cloud-sync-cta" onclick="window.openPricingModal()">En savoir plus →</button>
```

- [ ] **Étape 2 : Ajouter le lien pricing dans le header**

Localiser la `<div class="header-actions">` (ligne ~26). Ajouter le lien pricing **avant** `#btn-account` :
```html
<div class="header-actions">
    <button class="btn-accueil" id="btn-accueil" title="Accueil" style="display:none;">⌂</button>
    <button class="btn-theme-toggle" id="btn-theme-toggle" title="Basculer thème clair/sombre">☀️</button>
    <button class="btn-pricing-header" id="btn-pricing-header" onclick="window.openPricingModal()" title="Découvrir Pro+">Voir Pro+</button>
    <button class="account-btn" id="btn-account" onclick="window.openAccountModal()" title="Mon espace Pro+">
        <span class="account-btn-label" id="account-btn-label">Pro+</span>
    </button>
</div>
```

- [ ] **Étape 3 : Ajouter le style pour `#btn-pricing-header`**

Dans `styles.css`, après `.account-btn:hover { ... }` (ligne ~922), ajouter :
```css
.btn-pricing-header {
    background: linear-gradient(135deg, var(--gold-color, #C9A84C), #b8960f);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 5px 12px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: opacity 0.2s;
    flex-shrink: 0;
}
.btn-pricing-header:hover { opacity: 0.85; }
body.is-premium .btn-pricing-header { display: none; }
```

- [ ] **Étape 4 : Ajouter la modale `#modal-pricing`**

Dans `index.html`, localiser `<!-- Modal Compte & Pro+ -->` (ligne ~1008). Juste **avant** cette ligne, insérer :

```html
<!-- Modal Pricing Pro+ -->
<div id="modal-pricing" class="modal-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="modal-pricing-title" onclick="if(event.target===this)window.closePricingModal()">
    <div class="modal-content">
        <div class="modal-header">
            <h2 id="modal-pricing-title">Passez à Pro+</h2>
            <button type="button" class="modal-close" onclick="window.closePricingModal()" title="Fermer">✕</button>
        </div>
        <div class="modal-body">
            <p class="pricing-subtitle">Choisissez la formule adaptée à votre usage</p>
            <div class="pricing-plans-grid">
                <div class="pricing-plan-card">
                    <div class="pricing-plan-title">Gratuit</div>
                    <ul class="pricing-plan-features">
                        <li>✓ Simulation complète et analyse</li>
                        <li>✓ 3 projets sauvegardés</li>
                        <li>✓ 3 exports PDF</li>
                        <li>✓ Outil de faisabilité</li>
                        <li>✓ Comparaison de 2 projets</li>
                        <li style="color:var(--text-secondary);opacity:0.5;">✗ Sync cloud</li>
                        <li style="color:var(--text-secondary);opacity:0.5;">✗ Projets illimités</li>
                        <li style="color:var(--text-secondary);opacity:0.5;">✗ PDF illimités</li>
                    </ul>
                </div>
                <div class="pricing-plan-card featured">
                    <div class="pricing-plan-label">Bientôt</div>
                    <div class="pricing-plan-title">Pro+</div>
                    <ul class="pricing-plan-features">
                        <li>✓ Simulation complète et analyse</li>
                        <li>★ Projets illimités</li>
                        <li>★ Exports PDF illimités</li>
                        <li>★ Outil de faisabilité avancé</li>
                        <li>★ Comparaison multi-projets</li>
                        <li>★ Sauvegarde cloud multi-appareils</li>
                        <li>★ Rapport PDF professionnel</li>
                        <li>★ Historique des analyses</li>
                    </ul>
                </div>
            </div>
            <div class="pricing-actions">
                <a href="mailto:gegertauren@gmail.com?subject=Investisseur%20Pro%2B%20%E2%80%94%20Liste%20d%27attente&body=Bonjour%2C%0A%0AJe%20suis%20int%C3%A9ress%C3%A9(e)%20par%20la%20version%20Pro%2B%20d%27Investisseur%20Pro.%0A%0AMon%20profil%20%3A%20" class="btn-primary">Rejoindre la liste d'attente →</a>
                <button type="button" class="btn-ghost" onclick="window.closePricingModal()">Continuer en version gratuite</button>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Étape 5 : Enrichir `#modal-pdf-gate` avec lien pricing**

Localiser `#modal-pdf-gate` (ligne ~871). Dans `.pdf-gate-actions`, après le bouton `#btn-pdf-gate-continue`, ajouter :
```html
<button type="button" class="btn-ghost" onclick="window.closePdfGateModal(); window.openPricingModal();">En savoir plus sur Pro+</button>
```

Le bloc `.pdf-gate-actions` devient :
```html
<div class="pdf-gate-actions">
    <button type="button" class="btn-primary" onclick="window.closePdfGateModal(); window.openAccountModal();">Rejoindre Pro+</button>
    <button type="button" class="btn-secondary" id="btn-pdf-gate-continue">Continuer quand même</button>
    <button type="button" class="btn-ghost" onclick="window.closePdfGateModal(); window.openPricingModal();">En savoir plus sur Pro+</button>
</div>
```

- [ ] **Étape 6 : Vérification manuelle**

1. Ouvrir `index.html` dans Chrome
2. Vérifier que les badges "Pro+" apparaissent sur "Sauvegarder", "Comparer les projets", et "🖨️ Imprimer / PDF"
3. Vérifier que le bouton "Voir Pro+" est visible dans le header
4. Cliquer sur "Voir Pro+" → la modale s'ouvre avec les deux colonnes
5. Cliquer en dehors de la modale → elle se ferme
6. Dans la console : `localStorage.setItem('userAccount', JSON.stringify({isPremium:true})); location.reload()` → "Voir Pro+" doit disparaître (`.is-premium` sera ajouté en Task 3)

- [ ] **Étape 7 : Commit**

```bash
git add index.html styles.css
git commit -m "feat: add pricing modal, pro badges and header link (lot 8)"
```

---

## Task 3 : JS — `openPricingModal`, `.is-premium` sur body, Escape handler (Lot 8)

**Files:**
- Modify: `main.js`

- [ ] **Étape 1 : Ajouter `openPricingModal` et `closePricingModal`**

Dans `main.js`, localiser le bloc `// --- COMPTE & PRO+ ---` (environ ligne 674). Après la fonction `window.openWaitlistForm`, ajouter :

```js
window.openPricingModal = function() {
    document.getElementById('modal-pricing').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};
window.closePricingModal = function() {
    document.getElementById('modal-pricing').style.display = 'none';
    document.body.style.overflow = '';
};
```

- [ ] **Étape 2 : Appliquer `.is-premium` sur `<body>` au chargement**

Dans `main.js`, localiser la ligne `let userAccount = ...` (ligne ~25). Juste après le bloc de déclaration de `pdfGenCount` (ligne ~26), ajouter :

```js
// Applique la classe CSS qui masque tous les .pro-badge pour les utilisateurs premium
if (userAccount.isPremium) document.body.classList.add('is-premium');
```

- [ ] **Étape 3 : Ajouter `#modal-pricing` au handler Escape**

Localiser le handler Escape (ligne ~940) :
```js
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal-regimes').classList.contains('open'))     window.closeRegimeModal(null, null);
    if (document.getElementById('modal-deductibles').classList.contains('open')) window.closeDeductiblesModal(null, null);
    if (document.getElementById('modal-comparator').classList.contains('open'))  window.closeComparatorModal(null, null);
    if (document.getElementById('modal-compte').style.display === 'flex')        window.closeAccountModal();
});
```

Remplacer par :
```js
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal-regimes').classList.contains('open'))     window.closeRegimeModal(null, null);
    if (document.getElementById('modal-deductibles').classList.contains('open')) window.closeDeductiblesModal(null, null);
    if (document.getElementById('modal-comparator').classList.contains('open'))  window.closeComparatorModal(null, null);
    if (document.getElementById('modal-compte').style.display === 'flex')        window.closeAccountModal();
    if (document.getElementById('modal-pricing').style.display === 'flex')       window.closePricingModal();
});
```

- [ ] **Étape 4 : Ajouter lien pricing dans la gate projet**

Localiser le listener `#btn-save-project` (ligne ~833) :
```js
if (!userAccount.isPremium && savedProjects.length >= FREE_PROJECT_LIMIT) {
    window.openAccountModal();
    return;
}
```

Remplacer par :
```js
if (!userAccount.isPremium && savedProjects.length >= FREE_PROJECT_LIMIT) {
    window.openAccountModal();
    // Ajouter un lien contextuel vers le pricing dans la zone status
    const zone = document.getElementById('account-status-zone');
    if (zone && !zone.querySelector('.pricing-nudge')) {
        const nudge = document.createElement('div');
        nudge.className = 'pricing-nudge';
        nudge.style.cssText = 'margin-top:10px;text-align:center;font-size:0.82rem;';
        nudge.innerHTML = `<a href="#" onclick="window.closeAccountModal();window.openPricingModal();return false;" style="color:var(--gold-color,#C9A84C);font-weight:600;">Voir les avantages Pro+ →</a>`;
        zone.appendChild(nudge);
    }
    return;
}
```

- [ ] **Étape 5 : Vérification manuelle**

1. Ouvrir `index.html` dans Chrome (localStorage vide)
2. Vérifier que les badges "Pro+" sont visibles sur les 3 boutons
3. Cliquer sur "Voir Pro+" dans le header → modale s'ouvre ; touche Escape → se ferme
4. Dans console : `localStorage.setItem('userAccount', JSON.stringify({isPremium:true})); location.reload()` → les badges "Pro+" et le bouton "Voir Pro+" disparaissent
5. Créer 3 projets factices et tenter d'en sauvegarder un 4e → `#modal-compte` s'ouvre avec un lien "Voir les avantages Pro+ →"
6. Cliquer ce lien → `#modal-compte` se ferme, `#modal-pricing` s'ouvre

- [ ] **Étape 6 : Commit**

```bash
git add main.js
git commit -m "feat: wire openPricingModal, is-premium body class and gate nudge (lot 8)"
```

---

## Task 4 : CSS + HTML — `#install-banner` et `#offline-banner` (Lot 9)

**Files:**
- Modify: `styles.css`, `index.html`

- [ ] **Étape 1 : Ajouter les styles dans `styles.css`**

À la fin de `styles.css`, ajouter :

```css
/* === LOT 9 — Install Banner & Offline Banner === */
#install-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--card-bg);
    border-top: 1px solid var(--border-color);
    box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    font-size: 0.88rem;
    color: var(--text-color);
    flex-wrap: wrap;
}
#install-banner span { flex: 1; min-width: 160px; }
#btn-install {
    background: var(--primary-color);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 7px 16px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
}
#btn-install:hover { opacity: 0.85; }
#btn-install-dismiss {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
    flex-shrink: 0;
}
#btn-install-dismiss:hover { color: var(--text-color); }

#offline-banner {
    display: none;
    width: 100%;
    background: #F59E0B;
    color: #1a1a1a;
    font-size: 0.83rem;
    font-weight: 600;
    text-align: center;
    padding: 7px 16px;
    position: sticky;
    top: 0;
    z-index: 400;
    box-sizing: border-box;
}
```

- [ ] **Étape 2 : Ajouter `#install-banner` dans `index.html`**

Dans `index.html`, localiser `<body>` (ligne ~19). Juste après la balise ouvrante `<body>`, insérer :

```html
<!-- Bannière installation PWA -->
<div id="install-banner" style="display:none;" role="banner" aria-label="Installer l'application">
    <span>📲 Installer Investisseur Pro sur votre appareil</span>
    <button id="btn-install" type="button">Installer</button>
    <button id="btn-install-dismiss" type="button" aria-label="Fermer la bannière">✕</button>
</div>
```

- [ ] **Étape 3 : Ajouter `#offline-banner` dans `index.html`**

Localiser `<nav class="tabs-nav">` (ligne ~35). Juste **avant** cette ligne, insérer :

```html
<!-- Bandeau mode hors-ligne -->
<div id="offline-banner" role="status" aria-live="polite">
    ⚠️ Mode hors-ligne — Les données locales restent disponibles
</div>
```

- [ ] **Étape 4 : Vérification visuelle**

1. Ouvrir `index.html` dans le navigateur
2. Dans la console : `document.getElementById('install-banner').style.display = 'flex'` → la bannière apparaît en bas, compacte, avec le bouton "Installer" et "✕"
3. `document.getElementById('offline-banner').style.display = 'block'` → le bandeau ambre apparaît entre le header et les onglets

- [ ] **Étape 5 : Commit**

```bash
git add styles.css index.html
git commit -m "feat: add install-banner and offline-banner HTML/CSS (lot 9)"
```

---

## Task 5 : Créer `sw.js` — Service Worker (Lot 9)

**Files:**
- Create: `sw.js` (racine du projet)

- [ ] **Étape 1 : Créer `sw.js`**

Créer le fichier `sw.js` à la racine avec ce contenu :

```js
const CACHE_NAME = 'investpro-v1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './main.js',
    './calculs.js',
    './ui.js',
    './pdf.js',
    './styles.css',
    './manifest.json',
    './icon.png',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
];

// Installation : mise en cache des assets locaux
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Assets locaux (même origine) : requête normale
            const localAssets = STATIC_ASSETS.filter(url => !url.startsWith('http'));
            // Assets CDN (cross-origin) : mode no-cors pour les réponses opaques
            const cdnAssets = STATIC_ASSETS.filter(url => url.startsWith('http'));

            return Promise.all([
                cache.addAll(localAssets),
                ...cdnAssets.map(url =>
                    fetch(new Request(url, { mode: 'no-cors' }))
                        .then(response => cache.put(url, response))
                        .catch(() => { /* CDN indisponible au premier chargement, ignoré */ })
                ),
            ]);
        })
    );
    self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch : Network-First pour index.html, Cache-First pour tout le reste
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ne pas intercepter les requêtes non-GET
    if (event.request.method !== 'GET') return;

    // Network-First pour index.html (évite de servir un HTML obsolète)
    if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Cache-First pour tous les autres assets (JS, CSS, images, CDN)
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);
        })
    );
});
```

- [ ] **Étape 2 : Vérification dans DevTools**

1. Servir l'app avec `npx serve .` ou `python -m http.server` (le SW requiert HTTP, pas `file://`)
2. Ouvrir Chrome → F12 → onglet **Application** → **Service Workers**
3. Vérifier que `sw.js` est listé avec le statut "activated and is running"
4. Onglet **Cache Storage** → vérifier que `investpro-v1` contient les assets locaux
5. Onglet **Network** → cocher **Offline** → rafraîchir la page → l'app doit se charger depuis le cache

- [ ] **Étape 3 : Commit**

```bash
git add sw.js
git commit -m "feat: add service worker with cache-first strategy (lot 9)"
```

---

## Task 6 : JS — Enregistrement SW + bannière installation + bandeau offline (Lot 9)

**Files:**
- Modify: `main.js`

- [ ] **Étape 1 : Enregistrer le Service Worker**

Dans `main.js`, localiser la toute fin du fichier (après le dernier listener). Ajouter :

```js
// --- LOT 9 : PWA ---

// Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('Service Worker registration failed:', err);
    });
}
```

- [ ] **Étape 2 : Bannière d'installation (`beforeinstallprompt`)**

Juste après le bloc d'enregistrement SW, ajouter :

```js
// Bannière d'installation PWA
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;

    // Ne pas afficher si déjà dismissée dans cette session
    if (sessionStorage.getItem('installBannerDismissed')) return;
    // Ne pas afficher si déjà installée (mode standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    document.getElementById('install-banner').style.display = 'flex';
});

document.getElementById('btn-install')?.addEventListener('click', () => {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    _deferredInstallPrompt.userChoice.then(() => {
        _deferredInstallPrompt = null;
        document.getElementById('install-banner').style.display = 'none';
    });
});

document.getElementById('btn-install-dismiss')?.addEventListener('click', () => {
    sessionStorage.setItem('installBannerDismissed', '1');
    document.getElementById('install-banner').style.display = 'none';
});

// Cacher la bannière si l'app est lancée en mode standalone (déjà installée)
if (window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('install-banner').style.display = 'none';
}
```

- [ ] **Étape 3 : Bandeau offline**

Juste après le bloc de la bannière d'installation, ajouter :

```js
// Bandeau mode offline
function setOfflineBanner(isOffline) {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    banner.style.display = isOffline ? 'block' : 'none';
}

// Initialisation au chargement
setOfflineBanner(!navigator.onLine);

window.addEventListener('offline', () => setOfflineBanner(true));
window.addEventListener('online',  () => setOfflineBanner(false));
```

- [ ] **Étape 4 : Vérification manuelle**

1. Servir avec `npx serve .` sur HTTP
2. Chrome → F12 → **Application → Service Workers** → statut "activated"
3. **Network → Offline** → rafraîchir → le bandeau ambre "Mode hors-ligne" apparaît en haut de page
4. Décocher **Offline** → le bandeau disparaît automatiquement
5. Sur Chrome mobile (ou DevTools → Device toolbar) : l'événement `beforeinstallprompt` peut se déclencher si le site est servi en HTTPS ou via localhost. Vérifier dans la console que l'event est bien capturé (log : `beforeinstallprompt` intercepté)
6. Pour forcer la bannière : dans la console → `document.getElementById('install-banner').style.display='flex'` → bouton "✕" → `sessionStorage.getItem('installBannerDismissed')` doit valoir `'1'` ; rafraîchir → bannière n'apparaît plus dans la même session ; nouvelle session (onglet privé) → reviendrait si `beforeinstallprompt` se déclenche

- [ ] **Étape 5 : Commit**

```bash
git add main.js
git commit -m "feat: register SW, add install banner and offline banner logic (lot 9)"
```

---

## Task 7 : Mise à jour `contenu.md` et `commercial.md`

**Files:**
- Modify: `contenu.md`, `commercial.md`

- [ ] **Étape 1 : Mettre à jour `contenu.md`**

Dans `contenu.md`, localiser la section `## Configuration et Métadonnées`. Après la ligne `manifest.json`, ajouter :

```markdown
* **`sw.js`** : Service Worker PWA. Stratégie Cache-First pour les assets statiques (JS, CSS, images, CDN), Network-First pour `index.html`. Nom de cache versionné `investpro-v1`. Enregistré depuis `main.js`.
```

Et dans la section `## Compte & Premium — Surfaces UI (Lots 7+8)`, ajouter à la fin :

```markdown
* **`#install-banner`** : bannière fixe en bas d'écran déclenchée par `beforeinstallprompt`. Dismissable par session (sessionStorage). Disparaît si l'app est en mode `standalone`.
* **`#offline-banner`** : bandeau ambre affiché entre le header et les onglets quand `navigator.onLine === false`. Se cache automatiquement à la reconnexion.
* **`#modal-pricing`** : modale de proposition de valeur Pro+ (comparaison Gratuit/Pro+, CTA liste d'attente). Ouvrable depuis le header, les gates et le bandeau cloud sync.
* **`.pro-badge`** : span CSS-only présent sur les boutons Sauvegarder, Comparer et Exporter PDF. Masqué globalement par `body.is-premium .pro-badge { display: none }`.
```

- [ ] **Étape 2 : Mettre à jour `commercial.md` section 11.5**

Dans `commercial.md`, localiser le tableau section 11.5. Remplacer la ligne du Lot 8 :
```
| 8 | A faire plus tard | Freemium et monetisation |
```
Par :
```
| 8 | Effectue | Modale #modal-pricing (comparaison Gratuit/Pro+, CTA liste d'attente). Micro-badges .pro-badge sur Sauvegarder, Comparer, Exporter PDF. Bouton "Voir Pro+" dans le header. Lien "En savoir plus sur Pro+" dans les gates existantes. body.is-premium masque tous les badges. |
```

Et ajouter une ligne pour le Lot 9 après le Lot 8 :
```
| 9 | Effectue | Service Worker sw.js (Cache-First assets, Network-First index.html). Bannière #install-banner (beforeinstallprompt, dismiss sessionStorage). Bandeau #offline-banner (ambre, auto-hide à la reconnexion). |
```

- [ ] **Étape 3 : Commit**

```bash
git add contenu.md commercial.md
git commit -m "docs: update contenu.md and commercial.md for lots 8 & 9"
```

---

## Checklist de validation finale

### Lot 8
- [ ] Badges "Pro+" visibles sur Sauvegarder, Comparer, Imprimer/PDF en version gratuite
- [ ] `localStorage.setItem('userAccount', JSON.stringify({isPremium:true})); location.reload()` → tous les badges et le bouton "Voir Pro+" disparaissent
- [ ] Bouton "Voir Pro+" dans le header ouvre `#modal-pricing`
- [ ] Modale pricing : deux colonnes lisibles sur desktop et mobile (une colonne sur < 500px)
- [ ] Gate PDF → bouton "En savoir plus sur Pro+" présent, ouvre `#modal-pricing`
- [ ] Gate projet (4e sauvegarde) → `#modal-compte` + lien "Voir les avantages Pro+ →" qui ouvre `#modal-pricing`
- [ ] Touche Escape ferme `#modal-pricing`
- [ ] `.cloud-sync-strip` "En savoir plus →" ouvre `#modal-pricing`

### Lot 9
- [ ] Aucune erreur dans la console liée au Service Worker
- [ ] DevTools → Application → Service Workers → SW actif
- [ ] DevTools → Cache Storage → `investpro-v1` contient les assets locaux
- [ ] DevTools → Network → Offline → l'app charge depuis le cache
- [ ] Bandeau ambre visible en mode offline, disparaît à la reconnexion
- [ ] Bannière installation : bouton "✕" la ferme et ne la réaffiche pas dans la session
- [ ] `contenu.md` et `commercial.md` mis à jour
