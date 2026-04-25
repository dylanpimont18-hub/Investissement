# Design — Lots 6 & 7 : Commercialisation d'Investisseur Pro

**Date :** 2026-04-26
**Lots concernés :** Lot 6 (Export, partage, comparaison premium) · Lot 7 (Compte et gates premium front-end)
**Statut :** Approuvé — prêt pour implémentation
**Approche retenue :** Lot par lot, fichier par fichier (un commit par tâche)

---

## 1. Contexte

Les Lots 1–5 ont transformé l'entrée, la page Analyse, l'onglet Faisabilité, la méthodologie et l'identité visuelle. Les fonctionnalités d'export (PDF, partage), de comparaison et de gestion de compte existent déjà mais sont insuffisamment mises en valeur commercialement. Les Lots 6 & 7 ont pour objectif de :

- Rendre les fonctions premium **visibles comme des bénéfices**, pas comme des outils techniques
- Poser les **gates de conversion** vers Pro+ sans bloquer l'usage gratuit
- Préparer la **surface UI du compte** pour le backend à venir

### Contraintes absolues

- `calculs.js` : aucune modification
- Tous les `id=` existants sur les inputs sont préservés (`getCurrentInputs()` les lit par ID)
- `pdf.js` lit `#score-banner`, `#score-label`, `#score-stars`, `#score-detail` : ces IDs subsistent
- `#btn-simulate` reste dans le DOM (caché) — `addEventListener` dans `main.js`
- `userAccount` dans `main.js` est l'unique point d'entrée pour les gates premium

---

## 2. Lot 6 — Valoriser export, partage et comparaison

### 2.1 Résumé exécutif PDF

**Fichier cible :** `pdf.js` · fonction `buildPDFParts()`

**Position :** section `.r-exec-summary` insérée après `.r-header` et avant le bloc score existant.

**Contenu de la section :**
- Titre : "CE BIEN EN 30 SECONDES"
- Colonne gauche : verdict (`scoreLabel`) avec couleur dynamique (même mapping couleur que le bandeau existant : excellent/bon/fragile/risque)
- 2 KPIs centraux : rentabilité nette-nette + CF net-net mensuel (valeurs lues depuis les éléments DOM existants `#renta-netnet` et `#cf-netnet`)
- Phrase d'analyse : texte de `#verdict-why`, tronqué à 120 caractères si nécessaire

**Comportement :**
- Les trois flux PDF existants (`buildPDFDOM` aperçu, `buildPrintDocument` impression, `buildSharePDFFile` mobile) appellent tous `buildPDFParts()` — la section apparaît automatiquement dans les trois sans modification supplémentaire
- Le bloc score + grille KPI existants restent intacts après cette nouvelle section

**CSS :** styles inline dans la string CSS de `buildPDFParts()` (même pattern que le reste du PDF), pas de class globale.

---

### 2.2 Comparateur visuel — cartes côte à côte

**Fichier cible :** `main.js` · listener `btn-run-compare`

**Remplacement :** le HTML actuellement injecté dans `#comparator-results` (verdict + tableau) est remplacé par deux cartes `.comparator-card` côte à côte.

**Structure d'une carte :**
```
.comparator-card [.comparator-card-winner si gagnant]
  .comparator-card-header
    .comparator-card-name   ← nom du projet
    .comparator-badge-winner "★ Recommandé"  ← uniquement sur la carte gagnante
  .comparator-card-kpis
    [N lignes : label · valeur · ✓ si meilleure valeur]
```

**Règles visuelles :**
- Carte gagnante : bordure colorée (vert `#22c55e` si CF net-net > 0, bleu `#3b82f6` sinon) + fond légèrement teinté
- Carte perdante : bordure grise neutre
- En cas d'égalité parfaite : deux cartes neutres + bandeau "Projets comparables — Choisissez selon vos critères"
- Les valeurs "higher is better" (rentabilités, CF, DSCR, CoC) affichent `✓` en vert sur la meilleure
- `computeProjectMetrics()` dans `calculs.js` n'est pas modifié

**Responsive :** `flex-direction: column` sous 500px (les deux cartes s'empilent).

**CSS :** nouvelles classes `.comparator-card`, `.comparator-card-winner`, `.comparator-badge-winner`, `.comparator-card-kpis` dans `styles.css`.

---

### 2.3 Boutons d'action verdict — polish premium

**Fichiers cibles :** `index.html` (wording) · `styles.css` (style)

**Wording mis à jour :**

| Bouton | Label | Sous-titre |
|--------|-------|------------|
| `verdict-action-pdf` | Rapport complet | Analyse détaillée · PDF prêt |
| `verdict-action-print` | Exporter PDF | Impression ou enregistrement |
| `verdict-action-compare` | Comparer les biens | Identifier la meilleure opportunité |

**Changements CSS :**
- Ajout d'une classe `.vab-icon` : caractère Unicode sobre devant le label (📄 rapport, ↓ export, ⚖ comparer)
- Légère augmentation du padding et border-radius pour un rendu "card"
- État désactivé sur `verdict-action-compare` : `opacity: 0.5` + `pointer-events: none` quand moins de 2 projets sauvegardés — piloté depuis `main.js` (même logique que `btn-compare-projects`)

---

## 3. Lot 7 — Préparer compte et gates premium (front-end uniquement)

### 3.1 Gate premium sur l'export PDF

**Fichier cible :** `main.js` + `index.html` (nouvelle modale `#modal-pdf-gate`)

**Mécanisme :**
- Compteur `pdfGenCount` persisté en `localStorage`
- Incrémenté à chaque clic sur `btn-preview-pdf` ou `btn-save-pdf`
- Seuil : > 3 générations en mode gratuit (`!userAccount.isPremium`)
- Si seuil dépassé : afficher `#modal-pdf-gate` **avant** la génération PDF

**Contenu de `#modal-pdf-gate` :**
```
Rapport Pro+ disponible
Le rapport Pro+ inclut :
  ★ Résumé exécutif enrichi
  ★ Branding personnalisé
  ★ Annexe méthodologie complète
[Rejoindre Pro+]          [Continuer quand même]
```

- "Rejoindre Pro+" → `openAccountModal()` (ferme la gate)
- "Continuer quand même" → ferme la gate, génère le PDF normalement
- **Pas de blocage dur** : le PDF reste toujours générable
- En mode premium : le compteur n'est jamais vérifié
- `pdfGenCount` se remet à 0 si `isPremium` passe à `true`

---

### 3.2 Modale compte améliorée

**Fichier cible :** `index.html` (structure `#modal-compte`) · `main.js` (`openAccountModal`) · `styles.css`

**Nouvelle structure de `#modal-compte` :**

**Zone 1 — État du compte** (dynamique, rendue par `openAccountModal()`) :
- Ligne "Projets : X / 3 sauvegardés" (lit `savedProjects.length` et `FREE_PROJECT_LIMIT`)
- Barre de progression : `width = savedProjects.length / FREE_PROJECT_LIMIT * 100` %
- Ligne "Stockage : local uniquement"
- En mode premium : "Projets : illimités · Sync cloud active"

**Zone 2 — Plans côte à côte :**

| Plan Gratuit | Plan Pro+ |
|---|---|
| Badge "Actif" | Badge "Prochainement" |
| ✓ 3 projets sauvegardés | ★ Projets illimités |
| ✓ Export et impression PDF | ★ Sauvegarde cloud — tous appareils |
| ✓ Comparaison de 2 projets | ★ Rapport PDF professionnel |
| ✓ Outil de faisabilité | ★ Comparaison avancée multi-projets |
| | ★ Historique des versions |
| | [Rejoindre la liste d'attente →] |

**Zone 3 — Notice rassurante :**
> "Vos projets restent toujours sur cet appareil. Aucun risque de perte."

**En mode premium (`isPremium = true`) :**
- Zone état : "Projets : illimités · Sync cloud active"
- Carte Pro+ : badge "Actif" à la place de "Prochainement", bouton masqué
- Aucune gate n'est vérifiée dans tout le parcours

**CSS :** nouvelles classes `.account-status-zone`, `.account-status-bar`, `.account-plan-badge-active` dans `styles.css`.

---

## 4. Ordre d'exécution (Approche 1 — Lot par lot, fichier par fichier)

### Lot 6

| # | Tâche | Fichier |
|---|-------|---------|
| 6.1 | Résumé exécutif PDF | `pdf.js` |
| 6.2 | Comparateur cartes côte à côte | `main.js` |
| 6.3 | Wording boutons verdict | `index.html` |
| 6.4 | CSS comparateur + boutons verdict | `styles.css` |

### Lot 7

| # | Tâche | Fichier |
|---|-------|---------|
| 7.1 | Modale `#modal-pdf-gate` (HTML) | `index.html` |
| 7.2 | Gate PDF + compteur `pdfGenCount` | `main.js` |
| 7.3 | Refonte `#modal-compte` (HTML) | `index.html` |
| 7.4 | `openAccountModal()` dynamique | `main.js` |
| 7.5 | CSS modale compte + gate | `styles.css` |

### Post-implémentation

- Mise à jour de `commercial.md` section 11.5 : Lot 6 → Effectue, Lot 7 → Effectue

---

## 5. Validation attendue

**Lot 6 :**
- Aperçu PDF → page 1 affiche la section résumé exécutif (verdict + 2 KPIs + phrase)
- Comparateur → deux cartes côte à côte, gagnant mis en avant avec badge "★ Recommandé"
- Boutons verdict → wording et style mis à jour, bouton Comparer désactivé si < 2 projets

**Lot 7 :**
- Mode gratuit, < 4 PDF générés : aucune gate, flux normal
- Mode gratuit, > 3 PDF générés : gate `#modal-pdf-gate` s'affiche, PDF généré si "Continuer"
- Mode gratuit, 4e projet : gate `openAccountModal()` (comportement inchangé)
- Clic "En savoir plus" cloud-sync-strip → `#modal-compte` améliorée s'ouvre
- Mode premium (`isPremium = true` en localStorage) : aucune gate, modale compte affiche état premium
