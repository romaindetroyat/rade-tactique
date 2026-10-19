---
phase: 02-fiable-et-juste-en-mer
plan: 04
subsystem: bouees-a-confirmer
tags: [bouees, recalage, trace, virage, saisie-coordonnees, localstorage, scene3d, mode-depart, tdd, node-test]

requires:
  - phase: 02-fiable-et-juste-en-mer
    provides: "plan 03 : init() en deux temps (interface utile synchrone, puis 3D et vent), gardes pour tout ce qui peut tourner avant la carte ; plan 01 et 02 : journal (report) et voyant"
provides:
  - "js/marks.js : OV_KEY, MAX_MOVE_M, DOUBT, parseCoord, parseLatLon, loadOverrides, saveOverride, clearOverride, srcLabel, applyOverrides, restoreMark (module pur, stockage injecté)"
  - "js/markfit.js : R0, MIN_TURN_DEG, SEARCH_M, MAX_CANDS, ACCURACY_M, closestApproach, turnApex, proposeMark, candidates (module pur)"
  - "js/app.js : recalages appliqués une seule fois au démarrage (début d’init) et juste après chaque recalage validé ; puces « position à confirmer » (Parcours, En course, IC) ; « Recaler » / « Position d’origine » dans IC ; carte « Bouées à confirmer » dans le détail d’une trace"
  - "js/scene3d.js : libellé « 3 ? » et nom « · à confirmer » ; js/startmode.js : « Marque 3 ? » et « position à confirmer » en course"
  - "clé de stockage rade.marks.v1 : recalages de ce téléphone (D-04)"
  - "tests/marks.test.mjs (12 tests) et tests/markfit.test.mjs (8 tests)"
affects: [02-05 guide de l’équipage et recette (recalage par la trace à valider à la prochaine sortie autour de GR1 ou de Carqueiranne ; recalage par saisie à essayer sur iPhone, Safari et app installée)]

actuals:
  tokens: 9600
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Recalage appliqué à MARKS sur place, uniquement par js/app.js (début d’init, puis juste après un recalage validé) : les tests lisent MARKS tel que courses.js le définit, garde statique dans tests/marks.test.mjs"
    - "La trace propose, l’équipier valide : jusqu’à 3 virages candidats classés par distance à la position actuelle, jamais de repli « plus près » proposé à la validation"
    - "Tâche TDD du plan : squelette + tests (RED validé par gsd-tools check tdd-red-evidence), puis implémentation (GREEN)"

key-files:
  created:
    - js/marks.js
    - js/markfit.js
    - tests/marks.test.mjs
    - tests/markfit.test.mjs
    - .planning/phases/02-fiable-et-juste-en-mer/02-04-red-evidence.json
  modified:
    - js/app.js
    - js/scene3d.js
    - js/startmode.js
    - sw.js
    - js/version.js

key-decisions:
  - "Les virages sont repérés par la variation du cap lissé entre −45 s et +45 s (un centre par plateau de variation maximale, centres séparés d’au moins 60 s), puis chaque centre est recentré par les trois passes de turnApex ; deux centres qui convergent sur le même virage (à moins de 30 s) n’en font qu’un"
  - "Un déplacement de plus de 2 Nq (MAX_MOVE_M) saisi à la main demande une seconde touche « Confirmer : déplacement de X Nq » ; une modification du texte remet le bouton à « Valider »"
  - "Le recalage par la trace garde la date de la trace (tr.start) : « trace du 18/10 » même si on valide le 19 ; la saisie garde la date du jour"
  - "refreshMarks() relance tout ce qui dépend des positions : IC, carte (drawCourse), analyse du parcours, détail de la trace ouverte et onglet En course"

patterns-established:
  - "Un module de calcul n’importe jamais js/app.js et n’appelle jamais applyOverrides : tout test de calcul passe une copie structuredClone(MARKS)"
  - "Toute valeur venant de MARKS ou du stockage passe par esc() avant innerHTML ; les libellés 3D sont dessinés en texte"

requirements-completed: [JUST-01, JUST-02]

plan_head_before: 793e2b7106cb72148db2787899e664a75c368990
plan_head_after: 1f954016ce12383de22b1e161ac343129a754774

coverage:
  - id: D1
    description: "Les bouées de position approximative (GR1 (3) et Carqueiranne (11), src « approx ») sont signalées « position à confirmer » sur la carte (« 3 ? »), dans les parcours (puce), dans la liste « Prochaine marque » d’En course, en mode départ (« Marque 3 ? ») et dans l’onglet IC ; les autres restent normales"
    requirement: JUST-01
    verification:
      - kind: unit
        ref: "tests/marks.test.mjs#DOUBT : vrai pour GR1 (3) et Carqueiranne (11) seulement, sur le vrai MARKS ; #le signalement est câblé : carte, mode départ, parcours, liste En course"
        status: pass
      - kind: e2e
        ref: "essai Chromium de l’app réelle (hors dépôt) : parcours 1, puces « position à confirmer » sur 2 bords, option « Marque 3 — n°3 GR1 (tribord) (à confirmer) » dans la liste En course, 2 puces « à confirmer » dans le tableau des marques de l’onglet IC, aucune erreur de page"
        status: pass
    human_judgment: true
    rationale: "Lisibilité de « 3 ? » sur la carte 3D et de « Marque 3 ? » en mode départ sur l’iPhone, au soleil"
  - id: D2
    description: "Une position saisie (« 43°05.845N 005°56.049E » et formats voisins) recale la bouée ; une saisie hors de la rade, à une seule valeur ou à minutes de 60 ou plus est refusée avec un message en français ; un déplacement de plus de 2 Nq demande une confirmation"
    requirement: JUST-02
    verification:
      - kind: unit
        ref: "tests/marks.test.mjs#la marque 1 saisie redonne exactement sa position enregistrée ; #formats voisins acceptés ; #refus : hors de la rade, une seule valeur, minutes de 60 ou plus ; #le plafond de déplacement sans confirmation est de 2 Nq"
        status: pass
      - kind: e2e
        ref: "essai Chromium (hors dépôt) : saisie hors rade refusée (« Position hors de la rade de Toulon… »), saisie de Carqueiranne acceptée, déplacement de 11,9 Nq : bouton « Confirmer : déplacement de 11.9 Nq », Annuler sans effet"
        status: pass
    human_judgment: false
  - id: D3
    description: "Une bouée recalée affiche sa source et sa date (« trace du 18/10 », « saisie du 19/10 »), n’est plus signalée, garde sa position d’origine rétablissable (« Position d’origine »), et son recalage reste sur ce téléphone après relance de l’app"
    requirement: JUST-02
    verification:
      - kind: unit
        ref: "tests/marks.test.mjs#applyOverrides sur une copie : source « saisie du 19/10 », DOUBT devenu faux, position d’origine conservée ; #un second recalage garde la toute première position d’origine ; restoreMark la rétablit ; #stockage : aller-retour, stockage illisible, quota dépassé"
        status: pass
      - kind: e2e
        ref: "essai Chromium (hors dépôt) : recalage, ligne « saisie du 19/10 » sans puce, même ligne après rechargement de la page, puis « Position d’origine » : « approx » et puce de retour"
        status: pass
    human_judgment: true
    rationale: "Stockage séparé entre Safari et l’app installée sur iPhone (attendu, D-04) ; une saisie réelle sur le téléphone"
  - id: D4
    description: "Au débrief d’une trace, pour chaque bouée à confirmer contournée, l’app propose jusqu’à trois virages (sommet + 14 m vers l’intérieur, heure, angle, distance à la position actuelle, ±20 m, passage au plus près pour information) ; l’équipier valide ; sans virage net, rien n’est proposé ; aucun bouton en course"
    requirement: JUST-02
    verification:
      - kind: unit
        ref: "tests/markfit.test.mjs#SNPM, marque 7 ; #SNPM, marque 6 ; #marque 7 avec une position supposée décalée de 150 m ; #au plus 3 candidats, triés, aucun à plus de 600 m ; #chaque candidat est de méthode « sommet » ; #ligne droite passant à 30 m : « plus-pres » et aucun candidat ; #simulation : 200 arrondis, p90 < 25 m"
        status: pass
      - kind: e2e
        ref: "essai Chromium (hors dépôt) : trace SNPM translatée vers Carqueiranne, importée dans Traces : carte « Bouées à confirmer » avec un virage de 57° proposé, « Valider » → toast « Bouée 11 Carqueiranne recalée : trace du 18/10 (±20 m) », la carte disparaît, IC affiche « trace du 18/10 »"
        status: pass
    human_judgment: true
    rationale: "Aucune trace contournant GR1 ou Carqueiranne n’existe aujourd’hui : la vraie validation est la prochaine sortie (hypothèse A8 de la recherche : les erreurs simulées valident la géométrie et la tenue au bruit, pas le comportement réel des skippers)"
  - id: D5
    description: "Les recalages ne touchent jamais les tests ni la référence SNPM : js/courses.js, js/debrief.js et tests/reference/ sont inchangés depuis la fin de la phase 1 ; applyOverrides n’est appelé que par js/app.js"
    requirement: JUST-02
    verification:
      - kind: unit
        ref: "tests/marks.test.mjs#garde statique : seul js/app.js appelle applyOverrides( ; #à la fin, le vrai MARKS est identique à sa copie prise au début ; npm run check : 162 tests verts dont tests/reference.test.mjs non modifié"
        status: pass
      - kind: command
        ref: "git diff --stat 2a5c5df -- js/courses.js js/debrief.js tests/reference/ : vide"
        status: pass
    human_judgment: false

duration: 13 min
completed: 2026-10-19
status: complete
---

# Phase 2 Plan 04 : Bouées à confirmer Summary

**GR1 et Carqueiranne sont signalées « position à confirmer » partout (« 3 ? » sur la carte, puce dans Parcours, « (à confirmer) » en course, « Marque 3 ? » en mode départ), recalables par saisie dans l’onglet IC ou, au débrief, depuis la trace : l’app propose jusqu’à trois virages (sommet + 14 m vers l’intérieur, ±20 m) et l’équipier valide ; la bouée porte ensuite « trace du 18/10 » ou « saisie du 19/10 », sur ce téléphone seulement, sans que les tests ni la référence SNPM bougent.**

## Performance

- **Duration:** 13 min (horloge du bac à sable, du dernier commit du plan 03 au dernier commit de code)
- **Completed:** 2026-10-19T17:16:13Z (dernier commit de code)
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 10 (5 créés, dont la preuve RED ; 5 modifiés)

## Accomplishments

- **Signalement (D-01, JUST-01)** : `DOUBT(m)` est vrai pour `src === 'approx'`, c’est-à-dire GR1 (3) et Carqueiranne (11) seulement. `drawCourse()` passe `doubt` à `scene.setMarks` (libellé « 3 ? », nom « · à confirmer »), `renderCourse()` ajoute la puce « position à confirmer » à l’en-tête du bord, la liste « Prochaine marque » d’En course ajoute « (à confirmer) », l’api du mode départ rend `doubt` et le titre devient « Marque 3 ? » avec « position à confirmer » sous la distance.
- **Saisie (D-02, JUST-02)** : bouton discret « Recaler » par ligne du tableau des marques de l’onglet IC, champ avec l’exemple « 43°05.845N 005°56.049E », cinq formats lus (degrés-minutes avec point ou virgule, hémisphère devant ou derrière, ordre inversé, décimal pur, degrés-minutes-secondes), refus hors rade, une seule valeur ou minutes ≥ 60, confirmation au-delà de 2 Nq.
- **Source et date (D-03)** : `srcLabel` donne « trace du JJ/MM » ou « saisie du JJ/MM » (heure de Paris), affiché à la place de « approx » dans IC ; la puce disparaît ; « Position d’origine » rétablit `m.base`.
- **Sur ce téléphone (D-04)** : clé `rade.marks.v1` ; stockage illisible ou plein sans exception (`loadOverrides` rend `{}`, `saveOverride` rend `false` et le toast le dit).
- **Recalage depuis la trace (D-02 amendé)** : `candidates(P, M0)` repère les virages nets (≥ 25° entre −45 s et +45 s), garde ceux à moins de 600 m de la position actuelle, propose pour chacun le sommet + 14 m vers l’intérieur, trie par distance à la position actuelle et en garde trois ; le passage au plus près est affiché « pour information ». Sans virage net : aucun candidat, la saisie reste possible.

## Mesures (tests/markfit.test.mjs)

Sorties de `node --test … tests/markfit.test.mjs` (lecture de la trace SNPM par `fromGPX` puis `analyzeTrack`, comme `points()` de `js/debrief.js` ; positions de référence prises sur une copie de `MARKS`). `R0 = 14` n’a pas été réglé pour coller aux marques 6 et 7 (Pitfall 10).

| Cas | Résultat |
|-----|----------|
| Marque 7, position supposée = position enregistrée | premier candidat à **26,3 m** de la position enregistrée, virage de 57° à 10:11:42Z (passage de référence 10:11:51Z), passage au plus près à 33,4 m |
| Marque 6, position supposée = position enregistrée | premier candidat à **30,8 m**, virage de 63° à 10:55:39Z (passage de référence 10:55:20Z), passage au plus près à 29,8 m |
| Marque 7, position supposée décalée de 150 m (N, E, S, O) | un candidat à moins de 40 m de la position enregistrée dans les quatre cas |
| Simulation, 200 arrondis (graine 20261019, virage 40-130° en 15-45 s, 3-6 nd, bouée à 4-24 m à l’intérieur, bruit GPS 4 m, position supposée fausse de 50 m) | erreur du premier candidat : médiane **11,2 m**, **p90 18,7 m**, maximum 37,1 m, 0 arrondi sans candidat |

Ces valeurs retrouvent celles de la recherche (26 et 31 m sur la trace réelle ; médiane 10 m, p90 18-20 m en simulation). Réserve inchangée (hypothèse A8) : les erreurs simulées valident la géométrie et la tenue au bruit, pas le comportement réel des skippers ; les positions enregistrées des marques 6 et 7 viennent de cette même trace (cohérence, pas vérité). La vraie validation est l’importation d’une trace où GR1 ou Carqueiranne est contournée.

## Task Commits

1. **Tâche 1 (tracer) : bouée à confirmer signalée partout, recalable par saisie** — `ac5c18e` (feat)
2. **Tâche 2 (TDD) : recalage depuis la trace**
   - RED — `cd5df81` (test) : 8 tests, 7 en échec sur les assertions du comportement prévu contre un squelette sans comportement ; preuve `02-04-red-evidence.json` validée par `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK`, cible « SNPM, marque 7 … », échec attendu)
   - GREEN — `1f95401` (feat) : 8 tests verts dès la première exécution, aucun refactor nécessaire

Tracer : `npm run check` (la vérification automatique de la tâche) repassé après la tâche 1, 154 tests verts, avant d’entamer la tâche 2 (« Tracer verified end-to-end — expanding »).

## TDD Gate Compliance

- RED : `test(02-04)` `cd5df81`, squelette `js/markfit.js` (constantes seules, fonctions sans effet), preuve classée `RED_EVIDENCE_OK` / `target_test_failed`. Évaluation sémantique consignée dans la preuve : les 8 tests s’exécutent (fixture lue, aucun échec d’import ni de syntaxe), 7 échouent sur l’assertion prévue (aucun candidat, pas de méthode `plus-pres`, simulation sans candidat), seul le test des constantes passe dès le RED.
- GREEN : `feat(02-04)` `1f95401`, 8 tests sur 8.
- REFACTOR : aucun.

## Deviations from Plan

None - plan executed exactly as written.

Précisions de mise en œuvre sans écart de périmètre : la tâche 1 a ajouté un test de câblage statique du signalement (`tests/marks.test.mjs`, 12 tests au lieu des 10 demandés) ; `refreshMarks()` relance aussi `renderLive()` et le détail de la trace ouverte, pour que la liste « Prochaine marque » et la carte « Bouées à confirmer » suivent un recalage.

## Issues Encountered

Aucun. Le plan prévoyait une trace où GR1 ou Carqueiranne est contournée pour tester l’interface : il n’en existe pas ; l’essai de bout en bout a utilisé la trace SNPM translatée vers Carqueiranne (copie hors dépôt, coordonnées seules changées).

## Known Stubs

None. Aucune valeur vide ou factice ne remonte à l’interface ; `js/markfit.js` n’est plus un squelette depuis `1f95401`.

## Human verification (hors tests, à faire sur iPhone)

- Recette de la tâche 1 : parcours passant par GR1 (3), regarder la carte (« 3 ? »), l’onglet Parcours, la liste « Prochaine marque » d’En course et le mode départ après le signal ; dans IC, recaler Carqueiranne par saisie (« 43°04.902N 006°04.740E »), essayer une saisie hors rade, relancer l’app, puis « Position d’origine » ; comparer Safari et l’app installée (chacun garde ses recalages, D-04).
- Recette de la tâche 2 : après la prochaine sortie contournant GR1 ou Carqueiranne, importer la trace, « Analyser », lire la carte « Bouées à confirmer », choisir le virage de l’arrondi, valider. Rien à reporter dans `js/courses.js` : aucune position recalée n’est validée par Romain à ce jour (D-04).

## Threat Flags

None - la saisie de coordonnées, le stockage `rade.marks.v1` et la lecture d’une trace importée sont les surfaces déjà prévues par le registre de menaces du plan (T-02-14, T-02-15, T-02-16, T-02-19). Mitigations en place : saisie bornée à la rade et minutes < 60, confirmation au-delà de 2 Nq, positions non finies ignorées, `esc()` sur tout texte venant de `MARKS` ou du stockage, `applyOverrides` appelé seulement par `js/app.js` (garde statique), `js/courses.js`, `js/debrief.js` et `tests/reference/` inchangés.

## Self-Check: PASSED

- Fichiers : `js/marks.js`, `js/markfit.js`, `tests/marks.test.mjs`, `tests/markfit.test.mjs`, `02-04-red-evidence.json` présents.
- Commits : `ac5c18e`, `cd5df81`, `1f95401` présents sur `apercu-phase-02`.
- Critères d’acceptation : `tests/marks.test.mjs` 12 tests, `# fail 0` ; `tests/markfit.test.mjs` 8 tests, `# fail 0` ; `applyOverrides(MARKS, loadOverrides` 1, `position à confirmer` 1 dans `js/app.js`, `doubt` dans `js/scene3d.js` et `js/startmode.js`, `candidates(` 1 et `src: 'trace'` 1 dans `js/app.js` ; `git diff --stat 2a5c5df -- js/courses.js js/debrief.js tests/reference/` vide ; `npm run check` vert (162 tests).
