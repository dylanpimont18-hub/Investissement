# Index du projet Investisseur Pro (Architecture)

Ce fichier liste les responsabilités de chaque fichier du dépôt. Lisez ceci pour savoir quels fichiers ouvrir.

## Cœur de l'application (Frontend sans build)
* **`index.html`** : Structure UI principale (3 onglets : Saisie, Analyse, Faisabilité), modales et templates. Charge Chart.js, jsPDF et jsPDF-AutoTable depuis CDN. Contient également la section repliable "Comprendre les calculs — Méthodologie" (id `section-methodologie`) à la fin de l'onglet Analyse, documentant les 10 indicateurs clés, la logique fiscale par régime et la logique de revente.
* **`styles.css`** : Design system, variables CSS, thème clair/sombre (`prefers-color-scheme`), responsive design mobile.

## Logique Javascript (Modules ES)
* **`main.js`** : Contrôleur principal. Gère le cycle de vie, les événements, la lecture des inputs, les projets sauvegardés, et effectue la mise à jour d'une grande partie du DOM (injection des résultats textuels, génération du tableau de projection sur 25 ans, et logique de l'onglet Faisabilité — module prix cible / loyer cible).
* **`calculs.js`** : Moteur mathématique et fiscal (pure logic). Contient `calculateTMI`, `computeCF` (CF Net-Net) et `computeProjectMetrics`. Ne manipule pas le DOM.
* **`ui.js`** : Fonctions d'affichage complexes et composants UI. Met à jour les graphiques (Chart.js), les tableaux de comparaison/négociation, le score banner, les infobulles, les toasts, la validation des champs (erreurs de saisie) et gère le Mode Simplifié/Expert.
* **`pdf.js`** : Logique des exports de rapport (construction du DOM virtuel, flux d'impression navigateur, et génération d'un PDF partageable côté client pour mobile).
* **`script.js`** : Fichier historique vide (conservé pour référence).

## Configuration et Métadonnées
* **`manifest.json`** : Configuration de la PWA (nom "Investisseur Pro", short_name "InvestPro", couleurs, icônes, raccourcis d'application et lancement direct en mode web app).
* **`sw.js`** : Service Worker PWA. Stratégie Cache-First pour les assets statiques (JS, CSS, images, CDN), Network-First pour les navigations HTML. Nom de cache versionné `investpro-v2`. Enregistré depuis `main.js`.
* **`icons/`** : Icônes d'installation PWA (Android, iOS et icône maskable) utilisées par le manifeste et le head HTML.
* **`commercial.md`** : Note de cadrage produit et commercial. Liste les améliorations UX, design, confiance, positionnement et monétisation pour professionnaliser l'application.
* **`README_mobile_only_stores.txt`** : Guide détaillé pour transformer l'application en produit smartphone/tablette only, l'emballer en natif et la publier sur App Store / Play Store.
* **`CLAUDE.md`** : Instructions système et architecture pour Claude Code.
* **`WORKFLOW.md`** : Méthode de pilotage des tâches (anti-surcharge conversationnelle, checklist de suivi, et optimisation tokens via regroupement des changements par fichier).
* **`.gitignore`** : Ignore les sauvegardes locales (`backups/`) ainsi que les fichiers de pilotage interne et notes non destinés au dépôt public (`CLAUDE.md`, `WORKFLOW.md`, `commercial.md`, `README_mobile_only_stores.txt`, `.claudesignore`, `docs/superpowers/`).
* **`.claudesignore`** / **`.gitattributes`** : Règles d'exclusion et configuration Git.

## Compte & Premium — Surfaces UI (Lots 7+8)
Intégrés directement dans les fichiers existants. Aucun backend n'est branché à ce stade.
* **Bouton `#btn-account`** : bouton discret "Pro+" dans le header → ouvre `#modal-compte`.
* **`#modal-compte`** : modale comparant version gratuite (3 projets, local) et Pro+ (cloud, illimité — à venir). Lien liste d'attente via mailto.
* **`.projects-limit-bar` (`#projects-limit-bar`)** : barre de compteur X/3 dans la section projets, visible uniquement en version gratuite.
* **`.cloud-sync-strip`** : bandeau discret "Sync multi-appareils — Prochainement dans Pro+" sous les projets.
* **`userAccount`** (main.js) : état stub `{ isPremium: false }` en localStorage — brancher ici l'auth réelle.
* **`FREE_PROJECT_LIMIT = 3`** (main.js) : constante de limite gratuite. Gate activée sur le bouton "Sauvegarder".
* **`migrateProjects()`** (main.js) : enrichit les projets localStorage existants avec `_id`, `_createdAt`, `_updatedAt`, `_syncedAt`, `_isLocal`.
* **`#install-banner`** : bannière fixe en bas d'écran déclenchée par `beforeinstallprompt`. Dismissable par session (sessionStorage). Disparaît si l'app est en mode `standalone`.
* **`#offline-banner`** : bandeau ambre affiché entre le header et les onglets quand `navigator.onLine === false`. Se cache automatiquement à la reconnexion.
* **`#modal-pricing`** : modale de proposition de valeur Pro+ (comparaison Gratuit/Pro+, CTA liste d'attente). Ouvrable depuis le header (`#btn-pricing-header`), les gates et le bandeau cloud sync. Fonctions : `openPricingModal()` / `closePricingModal()`.
* **`.pro-badge`** : span CSS-only présent sur les boutons Sauvegarder, Comparer et Exporter PDF. Masqué globalement par `body.is-premium .pro-badge { display: none }`.
* **`#btn-pricing-header`** : bouton doré "Voir Pro+" dans le header. Masqué par `body.is-premium .btn-pricing-header { display: none }`.

### Dépendances backend/paiement non implémentées (à brancher)
1. **Auth** : Firebase Auth / Supabase / Auth0 → remplacer `userAccount` stub par un vrai token de session
2. **Base de données cloud** : Firestore / Supabase DB → implémenter sync de `savedProjects` avec `_syncedAt` / `_isLocal`
3. **Paiement** : Stripe / Lemon Squeezy → setter `userAccount.isPremium = true` après validation abonnement
4. **Politique de confidentialité** : mettre à jour `#modal-confidentialite` pour refléter la collecte d'email et la synchronisation cloud quand elles seront actives

## Éléments de confiance (Lot 5)
Intégrés directement dans `index.html` sous forme de modales et de footer :
* **Footer légal** : barre de bas de page avec liens vers les trois modales de confiance.
* **Modal `#modal-apropos`** : description du produit, fonctionnalités, avertissements et politique données.
* **Modal `#modal-mentions`** : mentions légales (éditeur, propriété intellectuelle, responsabilité, ressources tierces).
* **Modal `#modal-confidentialite`** : politique de confidentialité (pas de collecte, localStorage uniquement, CDN tiers, absence de cookies traceurs).
* **`.results-disclaimer`** : banderole de disclaimer visible dans l'onglet Analyse, après les KPIs principaux.