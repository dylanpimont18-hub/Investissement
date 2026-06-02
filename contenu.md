# Index du projet Investisseur Pro (Architecture)

Ce fichier liste les responsabilités de chaque fichier du dépôt. Lisez ceci pour savoir quels fichiers ouvrir.

## Cœur de l'application (Frontend sans build)
* **`index.html`** : Structure UI principale (3 onglets : Saisie, Analyse, Faisabilité), modales et templates. Charge Chart.js, jsPDF et jsPDF-AutoTable depuis CDN. Contient également la section repliable "Comprendre les calculs — Méthodologie" (id `section-methodologie`) à la fin de l'onglet Analyse, documentant les 10 indicateurs clés, la logique fiscale par régime et la logique de revente.
* **`styles.css`** : Design system, variables CSS, thème clair/sombre (`prefers-color-scheme`), responsive design mobile.

## Logique Javascript (Modules ES)
* **`main.js`** : Contrôleur principal. Gère le cycle de vie, les événements, la lecture des inputs, les projets sauvegardés en localStorage, les exports PDF, et effectue la mise à jour d'une grande partie du DOM (injection des résultats textuels, génération du tableau de projection sur 25 ans, et logique de l'onglet Faisabilité — module prix cible / loyer cible).
* **`calculs.js`** : Moteur mathématique et fiscal (pure logic). Contient `calculateTMI`, `computeCF` (CF Net-Net) et `computeProjectMetrics`. Ne manipule pas le DOM.
* **`ui.js`** : Fonctions d'affichage complexes et composants UI. Met à jour les graphiques (Chart.js), les tableaux de comparaison/négociation, le score banner, les infobulles, les toasts, la validation des champs (erreurs de saisie) et gère le Mode Simplifié/Expert.
* **`pdf.js`** : Logique des exports de rapport (construction du DOM virtuel, flux d'impression navigateur, et génération d'un PDF partageable côté client pour mobile).
* **`script.js`** : Fichier historique vide (conservé pour référence).

## Configuration et Métadonnées
* **`manifest.json`** : Configuration de la PWA (nom "Investisseur Pro", short_name "InvestPro", couleurs, icônes, raccourcis d'application et lancement direct en mode web app).
* **`sw.js`** : Service Worker PWA. Stratégie Cache-First pour les assets statiques (JS, CSS, images, CDN), Network-First pour les navigations HTML. Nom de cache versionné `investpro-v2`. Enregistré depuis `main.js`.
* **`icons/`** : Icônes d'installation PWA (Android, iOS et icône maskable) utilisées par le manifeste et le head HTML.
* **`README_commercialisation_web.md`** : Documentation produit/commerciale historique. Hors runtime actuel.
* **`README_lancement_web_7_jours.md`** : Checklist commerciale historique. Hors runtime actuel.
* **`README_netlify_pas_a_pas.md`** : Tutoriel de mise en ligne statique sur Netlify.
* **`README_supabase_stripe.md`** : Documentation historique d'une piste auth/paiement retirée du runtime actuel.
* **`docs/sauvegarde-calculs-analyse-web-desktop.md`** : Audit du 8 mai 2026. Vérifie le noyau calculs/analyse, liste les fichiers à conserver pour une réécriture web desktop 1 à 2 écrans, et consigne les hypothèses métier à ne pas perdre.
* **`commercial.md`** : Note de cadrage produit et commercial historique. Hors runtime actuel.
* **`README_mobile_only_stores.txt`** : Guide détaillé pour transformer l'application en produit smartphone/tablette only, l'emballer en natif et la publier sur App Store / Play Store.
* **`CLAUDE.md`** : Instructions système et architecture pour Claude Code.
* **`WORKFLOW.md`** : Méthode de pilotage des tâches (anti-surcharge conversationnelle, checklist de suivi, et optimisation tokens via regroupement des changements par fichier).
* **`.gitignore`** : Ignore les sauvegardes locales (`backups/`) ainsi que les fichiers de pilotage interne et notes non destinés au dépôt public (`CLAUDE.md`, `WORKFLOW.md`, `commercial.md`, `README_mobile_only_stores.txt`, `.claudesignore`, `docs/images/`, `docs/superpowers/`).
* **`.claudesignore`** / **`.gitattributes`** : Règles d'exclusion et configuration Git.

## Stockage local et PWA
* **`savedProjects`** (main.js) : liste locale des projets sauvegardés, persistée dans `simuImmoProjects` via localStorage.
* **`migrateProjects()`** (main.js) : enrichit les projets localStorage existants avec `_id`, `_createdAt`, `_updatedAt`, `_syncedAt`, `_isLocal`.
* **`#install-banner`** : bannière fixe en bas d'écran déclenchée par `beforeinstallprompt`. Dismissable par session (sessionStorage). Disparaît si l'app est en mode `standalone`.
* **`#offline-banner`** : bandeau ambre affiché entre le header et les onglets quand `navigator.onLine === false`. Se cache automatiquement à la reconnexion.
* **Exports PDF** : accessibles directement depuis `main.js` et `pdf.js`, sans compte, sans gate et sans limitation artificielle.

## Éléments de confiance (Lot 5)
Intégrés directement dans `index.html` sous forme de modales et de footer :
* **Footer légal** : barre de bas de page avec liens vers les trois modales de confiance.
* **Modal `#modal-apropos`** : description du produit, fonctionnalités, avertissements et politique données.
* **Modal `#modal-mentions`** : mentions légales (éditeur, propriété intellectuelle, responsabilité, ressources tierces).
* **Modal `#modal-confidentialite`** : politique de confidentialité (pas de collecte, localStorage uniquement, CDN tiers, absence de cookies traceurs).
* **`.results-disclaimer`** : banderole de disclaimer visible dans l'onglet Analyse, après les KPIs principaux.