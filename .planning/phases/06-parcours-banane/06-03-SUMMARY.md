---
phase: 06-parcours-banane
plan: 03
subsystem: parcours-autre-club
tags: [porte, arrivee, ic, ia, relecture, debrief, track, compatibilite-v37]

requires:
  - phase: 06-parcours-banane
    provides: "06-01 : buildLegs lit [bouée, côté, autre bouée] et course.finish ; 06-02 : ban des manches, scénarios et outils de regate-e2e"
provides:
  - "api/ic.js : SCHEMA avec gate (élément de la suite) et finish { kind, mark, excerpt } (parcours), consignes, checkCourse (porte prouvée par ses deux noms dans l’extrait du parcours, arrivée par son propre extrait mot pour mot)"
  - "js/icread.js : reviewFromApi (gate, finish vérifié, finishFlag), courseReady avec bouées de porte et d’arrivée, reviewHTML « porte 4s / 4p » et « Arrivée : entre le Comité et F »"
  - "js/regmarks.js : coursesFromReview (gate, finish aux identifiants X…), courseMarkIds, waitingFor, legTxt, finishTxt, applyRegattaMarks (élément à trois valeurs, finish { kind, mark })"
  - "js/regview.js : courseRowHTML avec la porte et l’arrivée"
  - "js/debrief.js : passages, expectedSeq, matchCourse exportés (tables en paramètre), porte = bouée la plus approchée dans les 180 s, « (porte : bouée prise) »"
  - "js/track.js : analyzeTrack, bord porte au plus près de l’une ou l’autre bouée, took 'g' | 'd'"
  - "tools/compat-v37.mjs : 7 contrôles v37 ↔ v38"
  - "tools/regate-e2e.mjs : scénario porte-ic"
affects: [06-04-livraison]

actuals:
  tokens: 23000
  tasks: 3
  commits: 3

plan_head_before: 2326d0f7e06d2a412b0eeafddbd7551b05ab0e97
plan_head_after: 8aba72e0c0c29d218f71ea89a8e7723f2639f026
commits: 3

tech-stack:
  added: []
  patterns:
    - "valeur lue par l’IA dans une liste : normalisée après keep(), jamais d’exception, preuve manquante → valeur vidée + raison + signalement"
    - "outil de compatibilité hors npm test qui importe côte à côte le code courant et le code extrait de la version précédente (git archive)"

key-files:
  created:
    - tests/debrief.test.mjs
    - tools/compat-v37.mjs
  modified:
    - api/ic.js
    - js/icread.js
    - js/regmarks.js
    - js/regview.js
    - js/debrief.js
    - js/track.js
    - js/app.js
    - tests/apiic.test.mjs
    - tests/icread.test.mjs
    - tests/regmarks.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "06-03 : une porte n’est gardée que si ses deux noms figurent dans l’extrait du parcours vérifié ; pour un parcours non vérifié, gate est vidée sans second signalement (le parcours l’est déjà)"
  - "06-03 : un parcours de régate dont l’arrivée a un type illisible n’est pas injecté (jamais d’arrivée devinée sur la ligne de départ)"
  - "06-03 : au débrief, la bouée de porte retenue est la plus approchée parmi les passages de l’une ou l’autre bouée dans les 180 s qui suivent le premier ; l’autre n’est pas comptée"

requirements-completed: [PARC-04, PARC-02]

coverage:
  - id: D1
    description: "Porte et arrivée lues par l’IA, prouvées par le texte, sinon vidées et signalées (D-08, critère 3)"
    requirement: PARC-04
    verification:
      - kind: unit
        ref: "tests/apiic.test.mjs (7 tests porte / arrivée)"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs#porte-ic"
        status: pass
    human_judgment: false
  - id: D2
    description: "Relecture, confirmation de toutes les bouées (porte et arrivée comprises), correction de position, parcours couru avec porte conseillée et arrivée sur F (D-08)"
    requirement: PARC-04
    verification:
      - kind: unit
        ref: "tests/icread.test.mjs (4 tests), tests/regmarks.test.mjs (6 tests)"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs#porte-ic, bouees, ia, ia-erreurs, depuis-ic"
        status: pass
    human_judgment: false
  - id: D3
    description: "Passages de porte au débrief et dans l’analyse d’une trace, bouée prise dite (D-07, critère 2)"
    requirement: PARC-02
    verification:
      - kind: unit
        ref: "tests/debrief.test.mjs (7 tests)"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs#gpx, debrief-tardif"
        status: pass
    human_judgment: false
  - id: D4
    description: "Régates archivées et téléphones v37 sans casse dans les deux sens (D-09, critère 4)"
    requirement: PARC-04
    verification:
      - kind: tool
        ref: "node tools/compat-v37.mjs <extraction 6e7af98> (7 contrôles OK)"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs#archive-bouees"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-23
status: complete
---

# Phase 6 Plan 03 : Porte et arrivée d’un autre club Summary

**Porte (« porte 4s/4p ») et arrivée (« entre le bateau comité et la bouée F ») lues par l’IA sous schéma strict, prouvées mot pour mot ou vidées et signalées, relues, confirmées bouée par bouée puis courues avec le conseil de porte ; passages de porte au débrief et dans l’analyse d’une trace (bouée prise dite) ; compatibilité v37 ↔ v38 prouvée par `tools/compat-v37.mjs`.**

## Performance

- **Duration :** 15 min
- **Started :** 2026-10-23T18:19:03Z
- **Completed :** 2026-10-23T18:34Z
- **Tasks :** 3 (la première de type tracer)
- **Files modified :** 15 (dont `sw.js` et `js/version.js`, générés par `npm run stamp`)

## Accomplishments

- `api/ic.js` : `gate` requis dans chaque élément de suite, `finish` requis dans chaque parcours (objet strict, `kind` ∈ comite / pres / null) ; deux phrases de consigne ; `checkCourse` après `keep` : porte gardée seulement si ses deux noms sont dans l’extrait vérifié du parcours (sinon `gate: null`, `gateFlag`, +1 signalement), arrivée `{ kind, mark, excerpt, verified: true }` seulement si son extrait est dans le texte et contient le nom de sa bouée (sinon vidée avec `flag` « extrait introuvable dans le texte » / « la bouée ne figure pas dans l’extrait »). Ancien format ou champs inattendus : aucune exception. La ligne `MODEL` n’est pas touchée.
- Relecture (`js/icread.js`) : « porte 4s / 4p », « Arrivée : entre le Comité et F · Extrait : « … » », ou « (arrivée non prouvée : … ; arrivée sur la ligne de départ) » ; un parcours n’est retenable qu’avec toutes ses bouées, porte et arrivée comprises. Pas de nouvel éditeur (D-08) : les positions se corrigent par « Corriger la position » et se confirment.
- Régate (`js/regmarks.js`, `js/regview.js`) : élément `{ mark, side: null, gate }` (sans porte : exactement l’élément v37), `finish` au niveau du parcours (clé absente sinon) ; injection seulement quand toutes les bouées sont confirmées ; `seq` `[['X1','b'], ['X2', null, 'X3'], ['X1','b']]`, `finish: { kind, mark }` ; fiche avec « en attente de : X3 4p, X4 F ».
- Débrief (`js/debrief.js`) : une porte compte un seul passage (la bouée approchée de plus près dans les 180 s, marquée `gate: [X2, X3]`), la case du passage dit « (porte X2/X3) », le bord s’appelle « … → X3 4p (porte : bouée prise) » ; `!c.built` gardé dans le choix du parcours.
- Analyse d’une trace (`js/track.js`) : bord porte au plus près de `g` ou `d`, `took` ; le tableau bord par bord de `js/app.js` dit « 4p (porte : bouée prise) ».

## Ce que voit un téléphone resté en v37

- Une fiche v38 se lit sans erreur : la porte est vue comme sa première bouée (`['X2', null]`), l’arrivée est sur la ligne de départ (centre de la ligne), la fiche montre la suite sans « porte » ni « Arrivée : ». Comme la v37 ne regarde que les bouées de la suite, elle peut proposer le parcours dès X1 et X2 confirmées (sans attendre X3 et X4).
- Une manche banane (parcours 90, `ban`) : `raceSettings` rend `courseId: 90` sans `ban` ; la v37 n’a pas de parcours 90, `chooseRace` garde donc le parcours courant (seuls la classe, les tours et l’heure changent).
- Une fusion faite par la v37 (nom changé, manche ajoutée) garde `seq[1].gate`, `finish` et `races[].ban`, dans les deux ordres ; la v38 réinjecte ensuite la porte et l’arrivée.

## Sortie brute de tools/compat-v37.mjs

```
OK v37 lit v38 : applyRegattaMarks injecte le parcours 101 sans erreur, porte réduite à sa première bouée : suite [["X1","b"],["X2",null],["X1","b"]]
OK v37 lit v38 : buildLegs du parcours 101, un bord par élément plus l’arrivée, aucun NaN, arrivée au centre de la ligne de départ : X1→X2→X1→Arrivée
OK v37 lit v38 : raceSettings de la manche banane sans erreur (réglages ban ignorés, parcours 90 inconnu laissé à l’app) : {"courseId":90,"cls":"G","laps":2,"day":"2026-11-07","startTime":11}
OK v37 lit v38 : sheetHTML et marksSectionHTML de la régate sans erreur ni balise non échappée : 4597 caractères
OK v37 écrit : mergeRegatta v37 entre la régate v38 et une copie modifiée à la v37 garde seq[1].gate, finish et races[0].ban : dans les deux ordres
OK v38 relit la fusion v37 : applyRegattaMarks réinjecte la porte (élément à trois valeurs) et l’arrivée ; bords avec porte et arrivée sur F : X1 Alpha → X3 4p → X1 Alpha → Arrivée (Comité – X4 F)
OK v38 lit v37 : la régate archivée v37 donne en v38 les mêmes bords qu’en v37 (sameLegs) : 4 cas identiques
Compatibilité v37 : 7 contrôles OK
```

Racine absente : code de sortie 2 (vérifié).

## Vérifications

```
npm run check                                   → # tests 638 / # pass 638 / # fail 0 (614 avant le plan)
tests/apiic + icread + regmarks                 → 75 tests avant, 92 après (+17)
tests/debrief.test.mjs (nouveau)                → 7 tests
git diff --quiet f80c365 -- js/courses.js tests/reference/   → 0 à chaque commit
PW_REQUIRED=1 node tools/regate-e2e.mjs porte-ic bouees ia ia-erreurs depuis-ic gpx debrief-tardif archive-bouees banane banane-manche
  → 10/10 OK
```

## Task Commits

1. **Task 1 : porte et arrivée lues, relues, confirmées et courues (tracer)** - `316cf0c` (feat)
2. **Task 2 : cas limites et fiche** - `4369616` (test)
3. **Task 3 : passages de porte au débrief et dans la trace, compatibilité v37** - `8aba72e` (feat)

_Tracer : après la tâche 1, `<verify>` rejoué de bout en bout (node --check, tests ciblés, `npm run check` 614/614, garde SNPM, `porte-ic bouees ia ia-erreurs depuis-ic` 5/5 OK) : « Tracer verified end-to-end — expanding »._

## Decisions Made

- Porte d’un parcours non vérifié : `gate` vidée sans second signalement.
- Arrivée de type illisible dans une régate stockée : parcours non injecté plutôt qu’arrivée devinée.
- Type d’arrivée hors comite / pres (impossible sous le schéma strict) : vidé avec la raison « type d’arrivée inconnu ».

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Fonction manquante] Tableau bord par bord de l’analyse d’une trace**
- **Found during :** Task 3
- **Issue :** `took` était calculé par `analyzeTrack` mais le tableau (`js/app.js`) ne disait pas quelle bouée de porte avait été prise (vérité du plan : « l’analyse d’une trace fait de même »).
- **Fix :** la ligne d’un bord porte affiche « <bouée prise> (porte : bouée prise) ».
- **Files modified :** js/app.js
- **Commit :** 8aba72e

**2. Ordre TDD de la tâche 3**
- Le code de `js/debrief.js` et `js/track.js` a été écrit avant `tests/debrief.test.mjs` ; la phase RED a été vérifiée après coup en lançant le nouveau fichier de tests sur une extraction du commit de la tâche 2 (échec à l’import : `expectedSeq` non exporté). Chaque tâche est commitée en un seul commit, à la demande de l’orchestrateur.

---

**Total deviations :** 1 auto-fixed (affichage), 1 écart de forme TDD.
**Impact on plan :** aucun sur le périmètre.

## Issues Encountered

- `RT_STRICT=1 npm run check` refuse toujours tant que la v38 n’est pas publiée (travail de 06-04) ; `npm run check` est vert.

## Notes pour 06-04

- `tools/compat-v37.mjs` est à relancer avant la publication : `W=$(mktemp -d) && git archive -o "$W/v37.tar" 6e7af98 js package.json && tar -xf "$W/v37.tar" -C "$W" && node tools/compat-v37.mjs "$W"`.
- Guide et aide (D-11) : expliquer la porte et l’arrivée lues dans les IC d’un autre club (relecture « porte 4s / 4p », confirmation de toutes les bouées, y compris celles de la porte et de l’arrivée) et la mention « (porte : bouée prise) » du débrief.
- À dire à l’équipage : tant qu’un téléphone reste en v37, il voit la porte comme sa première bouée et l’arrivée sur la ligne de départ ; mettre les trois téléphones en v38 avant la CVAT.

## User Setup Required

Aucun.

## Self-Check: PASSED

- FOUND : api/ic.js, js/icread.js, js/regmarks.js, js/regview.js, js/debrief.js, js/track.js, tests/debrief.test.mjs, tools/compat-v37.mjs
- FOUND : 316cf0c, 4369616, 8aba72e (ancêtres de HEAD)
