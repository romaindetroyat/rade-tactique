---
phase: 03-ouvrir-une-regate
plan: 04
subsystem: traces
tags: [gpx, rattachement, pauses, trkseg, debrief, fiche-de-regate, indexeddb, node-test, linkedom, playwright, pwa]

requires:
  - phase: 03-ouvrir-une-regate
    provides: "régates (index rade.regates.v1, upsertRegatta, createRegatta, membre), fiche et escHTML / byLine (js/regview.js), windSource(jour) et showTrace / runDebrief au vent figé (plan 03), tools/regate-e2e.mjs"
  - phase: 02-fiabilite-en-mer
    provides: "ouverture en deux temps (rt:ui / rt:map), report() / note(), garde « aucune erreur avalée » de tests/diag.test.mjs"
provides:
  - "js/attach.js : jour de Paris du plus long segment d'une trace, rattachement (unique, heure, choix, proche, aucune), doublons, références, résumés et rapport dans la régate"
  - "js/segments.js : coupures d'une trace (pauses, perte du GPS), statistiques actives, index de segments pour le dessin"
  - "Un GPX importé se range seul dans la régate de son jour (sans question quand il n'y a aucun doute), ouvre le détail de la trace et le questionnaire du débrief pré-rempli (épreuve, parcours de la manche, vent au départ) ; le même fichier réimporté dit « Déjà importée »"
  - "Pauses jamais reliées : tr.brk dans les données, distance et durée actives, vitesse moyenne active, carte 3D en segments indexés, GPX exporté en un <trkseg> par segment"
  - "Invite de choix (plusieurs régates, régate proche, aucune) avec création de « Régate du JJ/MM » ou « Laisser sans régate » ; Ranger… et Détacher depuis le détail de la trace"
  - "Section « Traces » de la fiche de régate : auteur, résumé (Nq, durée active, nd, % de la polaire), débrief et rapport avec leur auteur, Voir la trace / Débrief / Voir le débrief / Détacher"
  - "tools/regate-e2e.mjs : scénarios gpx et gpx-choix dans Chromium (9 scénarios au total)"
affects: [03-05, phase-04]

actuals:
  tokens: 16084
  tasks: 3
  commits: 5
plan_head_before: 69aab1dbf3ba061bfd6e1d5bb49994ec13d5f4a2
plan_head_after: 277f2322a2fee1f125e4f7041a7da294762b120f

tech-stack:
  added: []
  patterns:
    - "Les pauses sont des coupures dans les données (tr.brk, P[i].brk), pas un correctif de dessin : la carte, la distance, la durée, le lissage, le rejeu et le débrief les lisent toutes du même endroit (breaksOf)"
    - "La fiche de régate ne lit que r.traces (références et résumés) : jamais la liste complète des traces (≈ 600 Ko chacune)"
    - "Un rattachement sans doute est silencieux (unique, heure), tout doute ouvre une invite : l'app ne devine jamais entre deux régates"
    - "RED d'un module enrichi lu par espace de noms (SEG., ATT.) : l'échec porte sur « is not a function », pas sur le chargement"

key-files:
  created:
    - js/attach.js
    - js/segments.js
    - tests/attach.test.mjs
    - tests/segments.test.mjs
  modified:
    - js/track.js
    - js/scene3d.js
    - js/debrief.js
    - js/regview.js
    - js/app.js
    - tools/regate-e2e.mjs
    - styles.css
    - sw.js
    - js/version.js

key-decisions:
  - "Jour d'une trace = jour de Paris du milieu de son plus long segment (le quai ne décide pas) ; l'heure du signal des manches se convertit avec parisInstant (vrai fuseau de Paris), pas avec des décalages supposés"
  - "unique et heure rangent sans question ; choix, proche et aucune ouvrent une invite ; deux manches plausibles dans la trace = choix (jamais une devinette)"
  - "Coupure : trou de plus de 120 s, ou nouveau <trkseg> après plus de 5 s ; les traces déjà enregistrées (sans brk) sont coupées par la règle du trou seule"
  - "Réimporter un fichier déjà connu mais pas encore rangé le range (c'est la voie des anciennes traces, ARCH2-01 restant reporté) ; réimporter une trace déjà rangée ne rouvre pas le questionnaire"
  - "Le résumé de la trace et son rapport sont posés sur la référence de la régate à l'ouverture de la trace et à la fin du débrief : la fiche s'affiche sans toucher à la base des traces"

patterns-established:
  - "Contrôle négatif de l'import : le même fichier deux fois donne une trace en base, une référence, un seul questionnaire"
  - "Index de régates semé avant le premier chargement (page de même origine sans l'app) pour fabriquer des jours ambigus dans les scénarios de bout en bout"

requirements-completed: []

coverage:
  - id: D1
    description: "Un GPX importé après la course se range tout seul dans la régate de son jour (jour de Paris du plus long segment ; l'heure des manches départage ; jamais l'heure du téléphone) et ouvre le questionnaire du débrief pré-rempli, validé par un geste"
    requirement: ARCH-04
    verification:
      - kind: unit
        ref: "tests/attach.test.mjs#jour de la trace SNPM, #minuit de Paris, #unique / heure / choix / proche / aucune, #manche de la trace"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs gpx (toast « Trace rangée dans Coupe de la SNPM — CVAT », #dqEvent = la régate, #dqWind rempli, référence avec auteur)"
        status: pass
    human_judgment: true
    rationale: "Export réel d'Open GPX Tracker et sélecteur Fichiers d'iOS (hypothèse A6)"
  - id: D2
    description: "Les pauses d'enregistrement ne sont jamais reliées : ni sur la carte, ni dans la distance, ni dans la durée ; SNPM 15,25 Nq en 3,55 h actives (test) au lieu de 16,38 Nq en 6,00 h"
    requirement: ARCH-04
    verification:
      - kind: unit
        ref: "tests/segments.test.mjs#chiffres SNPM recalculés par le test, #analyzeTrack sur la trace SNPM, #index de dessin, #GPX aller-retour"
        status: pass
      - kind: unit
        ref: "tests/reference.test.mjs (référence SNPM inchangée, sans réenregistrement)"
        status: pass
    human_judgment: true
    rationale: "Rendu 3D réel sur iPhone et exports réels d'Open GPX Tracker (hypothèse A6)"
  - id: D3
    description: "Le même fichier importé deux fois ne crée ni deux traces ni deux rattachements (« Déjà importée »)"
    requirement: ARCH-04
    verification:
      - kind: unit
        ref: "tests/attach.test.mjs#doublon, #rattachement : une référence … une seule même posée deux fois"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs gpx (réimport : une trace en base rade-traces, une référence, pas de second questionnaire)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Un jour ambigu est tranché par l'équipier : invite (plusieurs régates, régate proche, aucune), création de « Régate du JJ/MM », « Laisser sans régate », Ranger… et Détacher"
    requirement: ARCH-04
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs gpx-choix (deux régates le 18/10 ; seule une régate de novembre ; laisser sans régate ; Ranger… depuis le détail ; Détacher à deux touches)"
        status: pass
    human_judgment: true
    rationale: "Lisibilité de l'invite sur 375 px"
  - id: D5
    description: "La fiche de régate liste ses traces avec auteur, distance et durée actives, vitesse moyenne, % de la polaire, débrief et rapport (par qui, quand) ; une trace se détache depuis la fiche ou son détail"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/attach.test.mjs#fiche de régate, section « Traces » (linkedom), #nom de trace piégé, #lit seulement r.traces"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs gpx (« Nq · … actives · … nd · … % de la polaire », « Débrief par … », « Voir le débrief ») et gpx-choix (Détacher)"
        status: pass
    human_judgment: true
    rationale: "Lisibilité de la fiche complète sur iPhone"
  - id: D6
    description: "La référence Coupe SNPM (tests/reference) et js/courses.js ne bougent pas ; l'ouverture reste rapide"
    requirement: ARCH-04
    verification:
      - kind: other
        ref: "git diff --quiet f80c365 -- js/courses.js tests/reference/ (sortie 0) et npm run check (280 tests)"
        status: pass
      - kind: other
        ref: "PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 : médiane de l'interface utile 627 ms (586 ms au plan 03)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 04 : GPX rangé seul, pauses non reliées, fiche avec traces Summary

**Un GPX d'Open GPX Tracker importé après la course se range seul dans la régate de son jour (jour de Paris du plus long segment, heure des manches pour départager, invite au moindre doute), ouvre le débrief pré-rempli, ne relie plus ses pauses par une ligne droite (SNPM : 15,25 Nq en 3,55 h actives au lieu de 16,38 Nq en 6,00 h) et apparaît dans la fiche de la régate avec son analyse, son débrief et ses auteurs.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-19T21:05:00Z
- **Completed:** 2026-10-19T21:27:00Z
- **Tasks:** 3 (1 traceur, 2 TDD)
- **Files modified:** 13 (4 créés, 9 modifiés) ; 5 commits mesurés (`plan_head_before` → `plan_head_after`)

## Accomplishments

- **Rattachement (`js/attach.js`)** : `trackDay` (jour de Paris du milieu du plus long segment ; trace de 23 h 30 à 00 h 30 = jour de minuit passé ; nuit du changement d'heure), `matchRegattas` (`unique`, `heure`, `choix`, `proche`, `aucune`), `raceOfTrack` (manche dont le signal de Paris tombe dans la trace, une heure de marge avant), `sameTrack` (même début et même nombre de points), `attachTrace` idempotent par identifiant, `detachTrace`, `traceSummary`, `setTraceSummary`, `setTraceReport` ; aucune entrée n'est jamais modifiée.
- **Import (`js/app.js`)** : fichier par fichier, `fromGPX` → `sameTrack` → `saveTrack` → rattachement ; toasts « Trace rangée dans … » et « Déjà importée : … » ; la dernière trace s'ouvre puis, si elle est rangée, `runDebrief` ouvre le questionnaire sur la régate (nom de l'épreuve), le parcours de sa manche quand la trace ne révèle rien (`courseHint`) et le vent au départ du jour (source du plan 03). La promesse `mapReady` fait attendre la carte sans geler l'interface.
- **Pauses (`js/segments.js`, `js/track.js`)** : `fromGPX` pose `tr.brk` (début de chaque `<trkseg>` après plus de 5 s, ou trou de plus de 2 min) ; `analyzeTrack` marque `P[i].brk`, ne lisse ni vitesse ni cap à travers une coupure, somme distance et durée par segment (`activeStats`), efface l'amure en cours à une pause ; `toGPX` écrit un `<trkseg>` par segment et la trace relue redonne les mêmes coupures ; `js/scene3d.js` dessine des `LineSegments` indexés par `lineIndex` (aucun pont) ; `legStats` ne somme pas la distance à travers une pause.
- **Invite de choix** : modale du type de `busy`, textes échappés, une invite à la fois ; « Régate du JJ/MM » créée à la date de la trace sur demande ; « Laisser sans régate » ouvre seulement le détail ; « Ranger… » et « Détacher » (deux touches) dans le détail de la trace, « Détacher » aussi dans la fiche.
- **Fiche de régate** : section « Traces » construite sur `r.traces` seulement : nom (échappé), « JJ/MM HH:MM », auteur du rangement, « 15,2 Nq · 3 h 33 actives · 4,3 nd · 87 % de la polaire », « Débrief par … le … » ou « pas encore débriefée », boutons Voir la trace / Débrief ou Voir le débrief / Détacher ; le libellé du détail de la trace devient « durée active ».

## Chiffres SNPM avant / après (trace `tests/fixtures/coupe-snpm-2026-10-18.gpx`)

Calculés par les tests, jamais recopiés de la recherche.

| Mesure | Avant (tous les points) | Après (segments actifs) | Tolérance du test |
|--------|-------------------------|-------------------------|-------------------|
| Somme orthodromique des paires, écrite dans le test (rayon 6 371 008,8 m) | 16,383 Nq en 6,003 h | 15,254 Nq en 3,551 h | ± 0,05 Nq, ± 0,02 h (16,38 / 6,00 et 15,25 / 3,55) |
| `analyzeTrack` (distance plane de js/geo.js) | 16,341 Nq en 6,003 h, 2,72 nd | **15,218 Nq en 3,551 h, 4,29 nd** | à ± 0,05 Nq et ± 0,02 h de la somme du test ; vitesse moyenne = distance active ÷ durée active à ± 0,05 nd |

Coupure unique à l'indice 293 (saut de 8 828 s entre le quai de 06:13Z et la course de 08:40:43Z), trouvée par les deux voies (`<trkseg>` et règle du trou) ; une trace stockée sans `brk` donne exactement le même résultat. La référence SNPM (`tests/reference/`, départ 09:43:42Z, passages 7, 6, 5) est restée verte sans réenregistrement : le pont est avant la course, hors de toute fenêtre de bord.

## Task Commits

1. **Task 1 : un GPX importé se range seul dans la régate de son jour et ouvre le débrief pré-rempli (traceur)** - `345dc97` (feat)
2. **Task 2 : pauses d'enregistrement jamais reliées** - RED `1910bcf` (test), GREEN `32b01eb` (feat)
3. **Task 3 : invite de choix, fiche de régate avec traces, analyse polaire, débrief, rapport et auteur** - RED `64793f3` (test), GREEN `277f232` (feat)

**Plan metadata:** commit `docs(03-04)` suivant (SUMMARY, STATE, ROADMAP).

## Tracer feedback gate

Mode `yolo` (« continue sans t'arrêter », pas de point d'arrêt humain) : après le commit du traceur, la vérification automatisée a été rejouée de bout en bout (`tests/attach.test.mjs`, `tests/reference.test.mjs`, `node --check`, `git diff --quiet f80c365 -- js/courses.js tests/reference/`, `npm run check` 262 tests, `PW_REQUIRED=1 node tools/regate-e2e.mjs gpx debrief-tardif` : OK). ⚡ Tracer verified end-to-end — expanding.

## TDD Gate Compliance

- **Task 2 RED** (`1910bcf`) : 7 tests de `tests/segments.test.mjs` échouent (3 passent déjà : constantes, règle du trou existante, calcul propre du test) ; `gsd_run check tdd-red-evidence` : `RED_EVIDENCE_OK` (`target_test_failed`, cible « index de dessin : paires (i, i + 1) sauf celle qui franchit une coupure »). Évaluation sémantique : la cible s'exécute et échoue sur la fonction attendue (`SEG.lineIndex is not a function`, module lu par espace de noms), pas sur une erreur de chargement. Le fichier d'évidence temporaire a été supprimé après classement.
- **Task 2 GREEN** (`32b01eb`) : 10 tests verts dans `tests/segments.test.mjs`, `npm run check` 272 tests.
- **Task 3 RED** (`64793f3`) : 8 tests de `tests/attach.test.mjs` échouent (14 passent) ; `RED_EVIDENCE_OK` (cible « résumé d'une analyse : distance (m), durée active (s), vitesse moyenne (nd) et pourcentage de la polaire, arrondis », `ATT.traceSummary is not a function`). Même évaluation sémantique, même nettoyage.
- **Task 3 GREEN** (`277f232`) : 22 tests verts dans `tests/attach.test.mjs`, `npm run check` 280 tests.
- Pas de REFACTOR : aucun nettoyage nécessaire.
- Les commits RED laissent volontairement `npm run check` rouge à ce point de l'historique.
- La tâche 1 est un traceur (non TDD) : ses tests ont été écrits avant le code et un seul (garde statique du câblage de `js/app.js`) était rouge après `js/attach.js`.

## Résultats de vérification

- `npm run check` : stamp à jour, **280 tests, 0 échec** (248 au plan 03 : +22 dans `tests/attach.test.mjs`, +10 dans `tests/segments.test.mjs`).
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` : sortie 0 (référence SNPM et parcours inchangés).
- Critères d'acceptation relancés : `grep -c "matchRegattas(" js/app.js` = 1, `grep -c courseHint js/debrief.js` = 2, `grep -c "lineIndex(" js/scene3d.js` = 1, `grep -c "breaksOf(" js/track.js` = 2, `grep -c "setTraceReport(" js/app.js` = 2, `grep -c "traceSummary(" js/app.js` = 1.
- Ouverture : `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : médiane de l'interface utile **627 ms** (< 2 000 ms ; 586 ms au plan 03).
- Sortie de l'outil de bout en bout, tous scénarios des plans 01 à 04 :
  ```
  OK creer
  OK manche
  OK auteur
  OK ic
  OK vraisemblance
  OK gel
  OK debrief-tardif
  OK gpx
  OK gpx-choix
  Bilan : 9/9 scénario(s) OK
  ```
  sortie 0.
- Aucune chaîne hexadécimale de 64 caractères dans les fichiers du plan ; aucun code d'accès.
- Version affichée toujours v27 : la publication v28 est au plan 05 (`npm run stamp` fait après chaque tâche).

## Files Created/Modified

- `js/attach.js` - rattachement : `trackDay`, `matchRegattas`, `raceOfTrack`, `sameTrack`, `attachTrace`, `detachTrace`, `traceSummary`, `setTraceSummary`, `setTraceReport`
- `js/segments.js` - pauses : `PAUSE_GAP_S`, `SEG_GAP_S`, `segmentBreaks`, `segStartsFromDoc`, `breaksFromInstants`, `breaksOf`, `activeStats`, `lineIndex`
- `tests/attach.test.mjs` - 22 tests : jour, minuit de Paris, cinq cas de rattachement, manche, doublon, idempotence, résumés, fiche (linkedom), nom piégé, gardes statiques
- `tests/segments.test.mjs` - 10 tests : coupure [293], trous courts, chiffres SNPM recalculés, `analyzeTrack`, `activeStats`, `lineIndex`, GPX aller-retour, gardes statiques
- `js/track.js` - `tr.brk`, `analyzeTrack` par segments, `toGPX` un `<trkseg>` par segment
- `js/scene3d.js` - `setTrace` en `LineSegments` indexés, sillage du rejeu sans pont
- `js/debrief.js` - `legStats` sans pont, `courseHint` pré-sélectionne `#dqCourse` quand la trace ne révèle aucun parcours
- `js/regview.js`, `styles.css` - section « Traces » de la fiche
- `js/app.js` - import, `mapReady`, invite, `rangeTrace`, `syncRef`, détail de la trace, fiche
- `tools/regate-e2e.mjs` - scénarios `gpx` et `gpx-choix`, `debrief-tardif` adapté (le questionnaire s'ouvre seul)
- `sw.js`, `js/version.js` - générés par `npm run stamp` (nouveaux modules dans la liste hors réseau)

## Decisions Made

- La conversion de l'heure d'une manche en instant utilise `parisInstant` (heure d'été et d'hiver exactes) plutôt que les trois décalages d'une, deux ou zéro heure du bloc de la recherche : pas de faux positif au changement d'heure.
- `proche` = la veille d'un premier jour ou le lendemain d'un dernier jour (intervalle complet de la régate), pas seulement la proximité du premier et du dernier jour.
- L'invite d'un « Ranger… » explicite propose la liste des régates du jour (ou les plus proches), la création et « Laisser sans régate », même quand un rattachement automatique aurait été possible.
- Le résumé suit la source de vent de l'analyse (prévisions vivantes, vent figé ou vent manuel annoncé) : il est donc posé à l'ouverture de la trace et se met à jour si le pourcentage de la polaire change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Une trace effacée laissait une référence dans la fiche**
- **Found during:** Task 3 (liste « Mes traces », bouton ✕)
- **Issue:** supprimer une trace de l'appareil laissait sa référence dans la régate : la fiche aurait proposé « Voir la trace » pour un fichier disparu.
- **Fix:** la suppression détache aussi la référence ; « Voir la trace » et « Débrief » d'une trace absente disent « Trace introuvable sur cet appareil ».
- **Files modified:** `js/app.js`
- **Verification:** revue du code, scénario `gpx-choix` (Détacher) ; pas de test dédié de la suppression
- **Commit:** `277f232`

**2. [Rule 2 - Missing critical] Le rejeu reliait aussi la pause**
- **Found during:** Task 2 (relecture de `scene3d.js` pour `setTrace`)
- **Issue:** « Rejouer la trace » dessinait le sillage en ligne droite à travers la pause, et la pause SNPM (2 h 27) occupait 40 % des 45 secondes de rejeu avec un bateau immobile.
- **Fix:** le sillage repart du début du segment courant et une pause dure une seconde de rejeu (`t` compressé, `abs` conservé pour l'heure affichée).
- **Files modified:** `js/scene3d.js`, `js/app.js`
- **Verification:** `node --check`, `npm run check` ; le rendu 3D réel reste au contrôle humain (WebGL neutralisé dans les scénarios)
- **Commit:** `32b01eb`

**3. [Interprétation du plan] `setTraceSummary` ajouté aux exports de `js/attach.js`**
- **Found during:** Task 3
- **Issue:** le plan liste `traceSummary` et `setTraceReport` ; « remplace `sum` s'il a changé » demande une fonction pure testable.
- **Fix:** `setTraceSummary(r, trId, sum)` rend la même régate (même objet) quand rien ne change, ce qui évite une écriture inutile de l'index.
- **Files modified:** `js/attach.js`, `tests/attach.test.mjs`
- **Verification:** `tests/attach.test.mjs#résumé posé sur la référence`
- **Commit:** `64793f3`, `277f232`

**4. [Interprétation du plan] Réimport d'une trace déjà connue**
- **Found during:** Task 1
- **Issue:** le plan dit « la trace existante est reprise ». Une trace connue mais restée sans régate (importée avant ce plan) doit pouvoir se ranger en la réimportant, et une trace déjà rangée ne doit pas rouvrir le questionnaire à chaque réimport.
- **Fix:** la trace existante passe par le même rattachement ; le questionnaire ne s'ouvre que si la trace vient d'être rangée.
- **Files modified:** `js/app.js`
- **Verification:** scénario `gpx` (réimport : « Déjà importée », une trace, une référence, aucun second questionnaire)
- **Commit:** `345dc97`

---

**Total deviations:** 4 (2 fonctionnalités critiques ajoutées, 2 interprétations)
**Impact on plan:** nécessaires à la justesse de la fiche et des pauses ; aucune extension de périmètre.

## Issues Encountered

- Le premier essai du scénario `gpx` a échoué sur « pas de second questionnaire » : le questionnaire fermé par « Annuler » reste dans le DOM (`hidden`), le test comptait donc ses champs. Corrigé dans l'outil (visibilité du champ au lieu de sa présence), pas dans l'app.
- Les traces déjà présentes sur les téléphones (base `rade-traces`, sans `brk`) ne sont pas rattachées d'office (reste d'ARCH2-01, hors feuille de route) : elles sont coupées par la règle du trou à l'analyse, et un réimport les range.
- Le garde « aucune erreur avalée » de `tests/diag.test.mjs` sur `js/track.js` est resté vert : aucun `catch` ajouté.

## Contrôles humains reportés à la fin de phase (`<human-check>` du plan, non bloquants)

- **Tâche 1 :** après une sortie enregistrée avec Open GPX Tracker (avec au moins une pause) et une régate du jour créée, sur iPhone : Partager → Enregistrer dans Fichiers, puis Traces → « Importer un fichier GPX ». Attendu : toast « Trace rangée dans … », questionnaire pré-rempli (épreuve, parcours de la manche, vent au départ) ; réimporter le même fichier dit « Déjà importée ».
- **Tâche 2 :** importer une trace d'Open GPX Tracker avec une pause (arrêt puis reprise plus loin) ; regarder la carte et le détail de la trace. Attendu : aucune ligne droite entre la fin d'un segment et le début du suivant, durée active, distance sans le saut, rejeu sans temps mort.
- **Tâche 3 :** sur iPhone, importer une trace d'un jour sans régate, puis d'un jour avec deux régates ; ouvrir la fiche d'une régate débriefée. Attendu : l'invite propose les bons choix ; la fiche réunit vent du jour, route conseillée, traces, débrief, rapport et auteurs, lisibles sur 375 px.

## Known Stubs

Aucun. (« analyse pas encore faite : ouvrez la trace » est l'état réel d'une trace rangée mais pas encore ouverte, pas une donnée manquante ; il disparaît à l'ouverture de la trace.)

## Threat Flags

Aucun nouveau point d'entrée hors modèle de menaces. T-03-14 (nom de trace injecté : `escHTML` / `esc` partout, test linkedom d'un nom, d'un auteur et d'un identifiant piégés), T-03-15 (mauvais rattachement : jour de Paris du plus long segment, heure des manches, invite au moindre doute, Détacher depuis la fiche et le détail, tests des cinq cas et de minuit), T-03-16 (doublons : `sameTrack` avant `saveTrack`, rattachement idempotent, scénario `gpx`) et T-03-17 (référence SNPM : `tests/reference/` et `js/courses.js` inchangés, vérifié par `git diff --quiet f80c365`, `legStats` sans pont) sont couverts. Aucune installation de paquet (T-03-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Prêt pour 03-05 : la fiche de régate montre déjà vent du jour, route figée, manches et traces ; le plan 05 doit publier la v28 (`npm run release`), refaire la mesure des bips (`PW_REQUIRED=1 node tools/audio-clock-check.mjs`, T-03-10), décrire dans le guide et l'aide le rattachement automatique, les pauses et le gel, puis fermer ARCH-02 et ARCH-04 dans REQUIREMENTS.md (ils restent « Pending » ici : les cinq exigences de la phase sont cochées par le plan 05 qui les liste toutes).
- Rien d'arrêtant. Version affichée toujours v27.

## Self-Check: PASSED

- Fichiers présents : `js/attach.js`, `js/segments.js`, `tests/attach.test.mjs`, `tests/segments.test.mjs`, `js/track.js`, `js/scene3d.js`, `js/debrief.js`, `js/regview.js`, `js/app.js`, `tools/regate-e2e.mjs`, `styles.css`, `sw.js`, `js/version.js`.
- Commits présents sur la branche `apercu-phase-03` : `345dc97`, `1910bcf`, `32b01eb`, `64793f3`, `277f232` (5 commits mesurés par `git rev-list --count`).
- Critères d'acceptation relancés après le dernier commit : `npm run check` vert (280 tests), `PW_REQUIRED=1 node tools/regate-e2e.mjs` 9/9 OK, référence SNPM et `js/courses.js` inchangés, aucun code d'accès ni empreinte dans les fichiers du plan.

---
*Phase: 03-ouvrir-une-regate*
*Completed: 2026-10-19*
