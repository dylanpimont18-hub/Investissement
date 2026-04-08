# Workflow de Pilotage (Copilot)

Objectif: eviter la surcharge conversationnelle, limiter la consommation de tokens, et ne rien oublier entre les iterations.

## 1) Sequence obligatoire au debut de chaque tache

1. Lire `contenu.md` pour identifier les fichiers cibles.
2. Lire ce fichier `WORKFLOW.md` pour appliquer la methode.
3. Reformuler la demande en 1-2 phrases.
4. Definir un mini-plan avec statuts: `TODO`, `EN COURS`, `FAIT`, `BLOQUE`.
5. Lire uniquement les fichiers strictement necessaires.

## 2) Regle anti-perte de contexte

Toujours repondre avec ces 3 blocs:

- Fait
- Reste a faire
- Prochaine action

Chaque bloc doit etre court et actionnable.

## 3) Optimisation tokens: regrouper les taches par fichier

Principe: traiter toutes les modifications d'un meme fichier dans un seul lot avant de passer au suivant.

Ordre recommande:

1. `index.html` (structure UI)
2. `styles.css` (styles associes a la meme feature)
3. `calculs.js` (logique/metriques pures)
4. `ui.js` (rendu dynamique)
5. `main.js` (orchestration et branchements)
6. `pdf.js` (export final)

Regles:

- Eviter les aller-retours frequents entre fichiers.
- Quand une feature touche plusieurs fichiers, finir un fichier completement avant le suivant.
- Faire une verification rapide apres chaque fichier modifie.

## 4) Template de lot (a reutiliser)

### Lot N - Nom

- Objectif:
- Fichiers autorises:
- Hors perimetre:

Checklist:

- [ ] Etape 1
- [ ] Etape 2
- [ ] Etape 3

Sortie obligatoire:

- Fait:
- Reste a faire:
- Prochaine action:

## 5) Gestion des priorites

Ordre de priorite:

1. Correctness calculatoire
2. Non-regression
3. Lisibilite code
4. UX
5. Export PDF

Si conflit entre rapidite et precision: privilegier precision sur le moteur de calcul.

## 6) Definition de "termine"

Une tache est terminee seulement si:

1. Le code est implemente.
2. Les cas limites evidents sont couverts.
3. L'impact sur UI/stockage/PDF a ete verifie si concerne.
4. Le statut est mis a jour dans la checklist.

## 7) Regle d'evolution de l'index

Si un fichier est ajoute/supprime ou change fortement de responsabilite:

1. Mettre a jour `contenu.md` immediatement.
2. Ajouter une ligne sur le role du nouveau fichier.

## 8) Kanban minimal (a maintenir dans ce fichier)

Mode d'emploi:

1. Une carte = une action concrete (verbe + fichier).
2. Maximum 1 carte `EN COURS`.
3. Quand une carte passe en `FAIT`, ajouter la date et un resultat court.
4. Si une carte est bloquee, la laisser en `BACKLOG` et ajouter `(BLOQUE: raison)`.

### BACKLOG

- [ ] (aucune carte en attente)

### EN COURS

- [ ] (aucune carte active)

### FAIT

- [x] 2026-04-08 - Creer `WORKFLOW.md` avec methode anti-surcharge et optimisation tokens
- [x] 2026-04-08 - Referencer `WORKFLOW.md` dans `contenu.md`
- [x] 2026-04-08 - Revente: ajouter champs de saisie dans `index.html`
- [x] 2026-04-08 - Revente: styles du tableau dans `styles.css`
- [x] 2026-04-08 - Revente: calcul sortie nette dans `calculs.js`
- [x] 2026-04-08 - Revente: rendu tableau timing dans `main.js`
- [x] 2026-04-08 - Revente: export section sortie dans `pdf.js`

## 9) Orchestration a 3 sous-agents

Objectif: repartir les taches efficacement sans melanger exploration, calcul et integration UI.

Note: dans cet environnement, le sous-agent disponible est `Explore`.
La repartition ci-dessous utilise donc 3 invocations distinctes de `Explore`, chacune avec un role specialise.

### Sous-agent 1 - Cadrage & Fichiers cibles

Mission:

1. Lire rapidement `contenu.md` puis identifier les fichiers minimaux a toucher.
2. Lister les impacts potentiels (UI, calcul, stockage, PDF).
3. Sortir un plan court par fichier.

Sortie attendue (obligatoire):

- Perimetre retenu
- Fichiers a modifier
- Risques de regression

Prompt type:

"Analyse la demande, determine les fichiers strictement necessaires, propose un plan par fichier, et liste les risques de regression."

### Sous-agent 2 - Moteur de calcul

Mission:

1. Verifier la coherence metrique/fiscale dans `calculs.js` et la projection dans `main.js`.
2. Proposer les regles de calcul minimales et leurs cas limites.
3. Fournir une spec pseudo-code concise avant implementation.

Sortie attendue (obligatoire):

- Formules retenues
- Cas limites
- Points a tester

Prompt type:

"Fais une revue orientee calculs, propose les formules minimales robustes, les cas limites, et une checklist de tests."

### Sous-agent 3 - Integration UI/PDF

Mission:

1. Mapper les changements dans `index.html`, `styles.css`, `ui.js`, `pdf.js`.
2. Verifier la lisibilite mobile et la coherence des textes affiches.
3. Lister les validations manuelles finales.

Sortie attendue (obligatoire):

- Plan d'integration par fichier
- Impacts UX/mobile
- Checklist de verification finale

Prompt type:

"Prepare l'integration UI/PDF: structure, styles, rendu dynamique, export, et checklist de verification manuelle."

## 10) Ordre d'execution des sous-agents

1. Lancer Sous-agent 1 (cadrage).
2. Lancer Sous-agent 2 (calculs) avec les fichiers du perimetre valide.
3. Lancer Sous-agent 3 (integration) avec les decisions de calcul validees.
4. Implementer ensuite fichier par fichier, sans melanger les perimetres.

Regle: tant qu'une sortie obligatoire manque, ne pas passer au sous-agent suivant.
