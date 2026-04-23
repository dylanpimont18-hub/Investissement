# Design Spec — Raffinement Esthétique & UX
**Date :** 2026-04-23
**Périmètre :** Option 1 — Raffinement ciblé (CSS + UX, sans refonte architecture)
**Priorités :** A) Identité visuelle premium B) Ergonomie mobile

---

## 1. Contexte & Objectifs

L'application Investisseur Pro est utilisée **principalement sur mobile**. Les deux irritants principaux identifiés :
1. Trop de champs visibles simultanément → sensation d'écrasement
2. Résultats difficiles à lire → chiffres clés noyés dans le texte

**Objectif :** Appliquer un thème finance premium sombre (Bloomberg/Revolut), améliorer la lisibilité mobile, et ajouter un toggle dark/light manuel.

---

## 2. Design System — Palette & Typographie

### Couleurs (mode sombre, défaut)
| Token | Valeur | Usage |
|---|---|---|
| `--bg-primary` | `#0D1117` | Fond principal |
| `--bg-card` | `#161B22` | Fond cartes/sections |
| `--border` | `#30363D` | Bordures subtiles |
| `--accent-gold` | `#C9A84C` | Titres, KPI positifs, CTA principal |
| `--accent-blue` | `#3B82F6` | Liens, CTA secondaire, graphiques |
| `--text-primary` | `#E6EDF3` | Texte principal |
| `--text-secondary` | `#8B949E` | Labels, texte secondaire |
| `--success` | `#3FB950` | Cashflow positif, rendement bon |
| `--danger` | `#F85149` | Cashflow négatif, alertes |

### Couleurs (mode clair)
| Token | Valeur |
|---|---|
| `--bg-primary` | `#F6F8FA` |
| `--bg-card` | `#FFFFFF` |
| `--border` | `#D0D7DE` |
| `--text-primary` | `#1C2128` |
| `--text-secondary` | `#57606A` |
Les accents doré et bleu sont conservés identiques.

### Typographie
- **Titres & KPI :** `Space Grotesk` (Google Fonts) — bold, caractère financier affirmé
- **Corps & labels :** `Inter` (Google Fonts) — optimisé lisibilité mobile
- Chargement via `<link>` Google Fonts dans `index.html`

### Toggle Dark/Light
- Bouton icône (☀ / ☾) dans le header, persisté en `localStorage` sous la clé `simuImmoTheme`
- Priorité : préférence manuelle > `prefers-color-scheme`
- Implémentation : classe `.theme-light` / `.theme-dark` sur `<html>`, variables CSS redéfinies

---

## 3. Formulaire — Onglet Saisie

### Problème
Tous les champs s'affichent en une seule colonne continue → écrasant sur mobile.

### Solution : Accordéon en 4 sections

| # | Section | État par défaut | Visibilité |
|---|---|---|---|
| 1 | Acquisition (prix, notaire, travaux) | Ouvert | Toujours |
| 2 | Financement (apport, durée, taux, assurance) | Fermé | Toujours |
| 3 | Exploitation (loyer, charges, vacance, fiscalité) | Fermé | Toujours |
| 4 | Hypothèses avancées (revente, SCI-IS, revalorisation) | Fermé | Mode Expert uniquement |

**Comportement :** cliquer sur un header de section l'ouvre et ferme les autres (accordéon exclusif).

### Améliorations des champs
- Labels flottants au-dessus du champ (toujours visibles, non placeholder)
- Unités (`€`, `%`, `ans`) en suffixe intégré dans le champ (via `::after` ou `<span>` positionné)
- Erreurs de validation en rouge sous le champ concerné (harmonisation du système existant)
- Barre de progression discrète en haut de formulaire : "X/4 sections complètes"

### CTA Principal
- Bouton `Calculer` sticky en bas d'écran (position fixe, full-width mobile)
- Fond `--accent-gold`, texte sombre, ombre portée subtile

---

## 4. Résultats — Onglet Analyse

### Problème
Les chiffres clés sont mélangés au texte descriptif, pas de hiérarchie visuelle forte.

### Solution : Cartes KPI + Hiérarchie par blocs

**Bloc 1 — Cartes KPI (grille 2×2)**

| KPI | Couleur valeur |
|---|---|
| Cash-flow net mensuel | `--success` ou `--danger` |
| Rendement brut | `--accent-gold` |
| DSCR | dynamique selon seuil |
| Effort d'épargne mensuel | `--text-primary` |

Chaque carte : fond `--bg-card`, valeur en `Space Grotesk` 28px, label en `--text-secondary` 12px.

**Bloc 2 — Graphique doughnut** (existant, restyler aux nouvelles couleurs)

**Bloc 3 — Détail fiscal & comparaison régimes** (tableau compact existant, harmoniser)

**Bloc 4 — Projection 25 ans** (tableau dépliable, masqué par défaut sur mobile)

### Score Banner
- Repositionné en sticky sous les KPI cards
- Fond dynamique : vert/orange/rouge selon score
- Texte synthétique : ex. "Investissement rentable — CF +127 €/mois"

### Micro-interactions
- Animation comptage sur les KPI au recalcul (0 → valeur en ~600ms, `requestAnimationFrame`)
- Toast de confirmation lors de la sauvegarde (système existant à conserver)

---

## 5. Fichiers Impactés

| Fichier | Nature des changements |
|---|---|
| `styles.css` | Palette complète, typographie, accordéon, cartes KPI, sticky CTA/banner |
| `index.html` | Ajout Google Fonts, restructuration HTML accordéon, bouton toggle |
| `main.js` | Logique toggle dark/light, barre de progression formulaire, animation KPI |
| `ui.js` | Restyling des graphiques Chart.js aux nouvelles couleurs |

---

## 6. Hors Périmètre (cette itération)

- Refonte de l'onglet Vierzon
- Nouvelles fonctionnalités de calcul
- Refonte de la génération PDF
- Animations de transition entre onglets

---

## 7. Critères de Succès

- [ ] Thème sombre appliqué, toggle fonctionnel, préférence persistée
- [ ] Formulaire en accordéon, CTA sticky visible sans scroll
- [ ] 4 cartes KPI affichées en haut des résultats
- [ ] Score banner sticky sous les KPI
- [ ] Aucune régression sur les calculs (les valeurs affichées ne changent pas)
- [ ] Rendu correct sur mobile (iPhone SE → iPhone 15 Pro Max)
