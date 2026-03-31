# Index du projet Investisseur Pro (Architecture)

Ce fichier liste les responsabilités de chaque fichier du dépôt. Lisez ceci pour savoir quels fichiers ouvrir.

## Cœur de l'application (Frontend sans build)
* **`index.html`** : Structure UI principale (3 onglets : Saisie, Analyse, Vierzon), modales et templates. Charge Chart.js et html2pdf.
* **`styles.css`** : Design system, variables CSS, thème clair/sombre (`prefers-color-scheme`), responsive design mobile.

## Logique Javascript (Modules ES)
* **`main.js`** : Contrôleur principal. Gère le cycle de vie, les événements, la lecture des inputs, les projets sauvegardés, et effectue la mise à jour d'une grande partie du DOM (injection des résultats textuels, génération du tableau de projection sur 25 ans, et logique de l'onglet Vierzon).
* **`calculs.js`** : Moteur mathématique et fiscal (pure logic). Contient `calculateTMI`, `computeCF` (CF Net-Net) et `computeProjectMetrics`. Ne manipule pas le DOM.
* **`ui.js`** : Fonctions d'affichage complexes et composants UI. Met à jour les graphiques (Chart.js), les tableaux de comparaison/négociation, le score banner, les infobulles, les toasts, la validation des champs (erreurs de saisie) et gère le Mode Simplifié/Expert.
* **`pdf.js`** : Logique de génération des exports PDF (construction du DOM virtuel et configuration html2pdf).
* **`script.js`** : Fichier historique vide (conservé pour référence).

## Configuration et Métadonnées
* **`manifest.json`** : Configuration de la PWA (nom, couleurs, icône).
* **`CLAUDE.md`** : Instructions système et architecture pour Claude Code.
* **`.claudesignore`** / **`.gitattributes`** : Règles d'exclusion et configuration Git.