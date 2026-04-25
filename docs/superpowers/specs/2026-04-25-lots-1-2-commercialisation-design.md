# Design — Lots 1 & 2 : Commercialisation d'Investisseur Pro

**Date :** 2026-04-25
**Lots concernés :** Lot 1 (Onboarding + Wizard), Lot 2 (Analyse recentrée sur le verdict)
**Statut :** Approuvé — prêt pour implémentation

---

## 1. Contexte

Investisseur Pro dispose d'un moteur de calcul solide et de fonctionnalités riches (comparateur, export PDF, projections 25 ans, multi-régimes fiscaux). Les freins à la commercialisation sont :

- Absence d'onboarding : l'utilisateur atterrit sur un long formulaire sans guidage
- Page Analyse trop dense : le verdict est noyé dans les détails techniques
- Friction d'entrée trop élevée sur mobile

Les Lots 1 et 2 traitent ces deux freins majeurs.

---

## 2. Architecture globale retenue

**Option C — Hybride : écran d'accueil + wizard dans le tab Saisie**

```
[Écran d'accueil]  →  [Tab: Saisie (Wizard 4 étapes)]  →  [Tab: Analyse (restructuré)]
                                                          [Tab: Faisabilité (inchangé)]
```

- L'écran d'accueil (`#view-accueil`) est affiché au premier lancement ou via le header
- Le tab Saisie (`#view-inputs`) est remplacé par un wizard multi-étapes
- Le tab Analyse (`#view-results`) est restructuré autour d'un bloc verdict
- `calculs.js` et `pdf.js` ne sont pas modifiés
- **Fichiers touchés :** `index.html`, `styles.css`, `main.js`, `ui.js`

---

## 3. Lot 1 — Écran d'accueil + Wizard

### 3.1 Écran d'accueil (`#view-accueil`)

**Contenu :**
- Promesse produit : *"Analysez un bien immobilier en 2 minutes. Décidez en confiance."*
- Deux CTA principaux :
  - **Estimation rapide** → lance le wizard en mode simplifié
  - **Analyse complète** → lance le wizard en mode expert
- Section "Mes projets" repliable (accès aux projets `localStorage` existants)

**Déclenchement :**
- Affiché au premier lancement (absence de brouillon `simuImmoDraft`)
- Si un brouillon existe, un troisième CTA s'affiche : **Reprendre ma saisie** → charge le brouillon et ouvre le wizard à l'étape 1
- Accessible via un lien "Accueil" discret dans le header à tout moment

**Ce qui ne change pas :** la logique de sauvegarde/chargement de projets existante (`simuImmoDraft`, `simuImmoProjects`) est conservée telle quelle.

### 3.2 Wizard — 4 étapes

La barre de progression existante est enrichie pour indiquer l'étape courante (1/4, 2/4…).

Navigation : boutons **Suivant** / **Retour** visibles à chaque étape. Le bouton **Analyser** remplace "Suivant" à l'étape 4 et déclenche `triggerCalculations()` puis bascule sur le tab Analyse.

| Étape | Titre | Champs mode rapide | Champs supplémentaires mode complet |
|---|---|---|---|
| 1 | Le Bien | Prix vendeur, Surface, Loyer mensuel | Frais notaire, Travaux, Charges copro, Taxe foncière |
| 2 | Financement | Apport, Taux d'intérêt, Durée | Assurance emprunteur, Type de prêt |
| 3 | Exploitation | Vacance locative | Frais gestion, Entretien annuel |
| 4 | Fiscalité | TMI, Régime fiscal | Revenus fonciers existants, options SCI |

**Comportement des champs masqués :**
Les champs non affichés en mode rapide conservent leurs valeurs par défaut déjà définies dans le code. Ils ne sont pas supprimés du DOM — juste cachés via CSS.

**Persistance du mode :**
Le mode (rapide/complet) est mémorisé en `sessionStorage` (clé `simuImmoWizardMode`). Il n'est pas persisté entre sessions.

---

## 4. Lot 2 — Page Analyse restructurée

### 4.1 Bloc Verdict (remplace le score banner)

Le verdict est calculé depuis le score existant (déjà produit par `computeProjectMetrics`) :

| Score | Label | Couleur | Classe CSS |
|---|---|---|---|
| ≥ 75 | Rentable | Vert | `verdict--rentable` |
| 50–74 | Correct — à négocier | Ambre | `verdict--correct` |
| 25–49 | Fragile | Orange | `verdict--fragile` |
| < 25 | À éviter | Rouge | `verdict--eviter` |

**Contenu du bloc :**
- Label verdict en grand (typographie dominante)
- Phrase d'action fixe selon le niveau :
  - Rentable : *"Ce bien présente un profil solide. Vous pouvez avancer sereinement."*
  - Correct : *"Ce bien est viable, mais une négociation du prix améliorerait sensiblement la rentabilité."*
  - Fragile : *"Ce bien reste équilibré dans le meilleur des cas. Examinez les leviers avant de vous engager."*
  - À éviter : *"Ce bien génère un cash-flow négatif significatif. Il est déconseillé sans renégociation majeure."*
- Score numérique en secondaire (discret, style `opacity: 0.5`)

**Actions PDF / Partage** placées juste sous le bloc verdict (remontées depuis le bas de page actuel).

### 4.2 Ordre des blocs dans la page Analyse

1. **Verdict** — bloc hero, toujours visible
2. **KPIs essentiels** — 4 à 6 cartes réordonnées : CF net-net, Rendement net-net, DSCR, Effort mensuel en priorité
3. **Pourquoi ce verdict** — bloc affichant les 2 premiers items de la liste de conseils existante (`#conseils-list`), reformulés en points forts ou points de vigilance selon le verdict
4. **Leviers d'amélioration** — section conseils renommée
5. **Détails experts** — fiscalité comparée, graphiques, projection 25 ans — repliés par défaut sur mobile (`details/summary` ou classe CSS toggle), dépliables via bouton "Voir l'analyse complète"

### 4.3 Comportement mobile

Les blocs "Détails experts" (tableaux longs, graphiques de projection) sont repliés par défaut sur écran < 768px. Un bouton "Voir l'analyse complète" les déplie. Sur desktop, tout est visible par défaut.

---

## 5. Fichiers et responsabilités

| Fichier | Modifications |
|---|---|
| `index.html` | Ajout `#view-accueil`, refactoring du tab Saisie en wizard (4 sections d'étapes), restructuration du tab Analyse (ordre des blocs, bloc verdict) |
| `styles.css` | Styles wizard (étapes, navigation, progress), styles bloc verdict (4 variantes couleur), ajustements responsive mobile pour les détails experts repliés |
| `main.js` | Logique wizard (navigation entre étapes, mode rapide/complet, sessionStorage), logique écran d'accueil (affichage conditionnel), mise à jour de l'injection du verdict dans le DOM |
| `ui.js` | Fonction `renderVerdict()` (remplace `renderScoreBanner()`), gestion du toggle "Voir l'analyse complète" sur mobile |

**Non modifiés :** `calculs.js`, `pdf.js`, `manifest.json`

---

## 6. Ce qui est hors scope

- Lots 3, 4, 5 (déjà effectués)
- Lot 6 (export/partage/comparaison)
- Lots 7 et 8 (cloud, monétisation)
- Aucune modification du moteur de calcul
- Aucun nouveau backend ou dépendance externe

---

## 7. Critères de succès

**Lot 1 :**
- L'utilisateur comprend en moins de 5 secondes par où commencer
- Un premier résultat est atteignable avec peu de scroll sur mobile
- La saisie minimale est clairement différenciée de l'analyse experte

**Lot 2 :**
- Un utilisateur comprend la conclusion sans lire toute la page
- Le verdict est lisible en moins de 3 secondes
- L'analyse détaillée reste accessible sans polluer la lecture principale
