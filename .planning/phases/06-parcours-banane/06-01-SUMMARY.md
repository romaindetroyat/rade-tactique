---
phase: 06-parcours-banane
plan: 01
subsystem: moteur-parcours
tags: [banane, porte, arrivee-decalee, buildLegs, routage, non-regression, v37]

requires:
  - phase: 05-avant-la-regate
    provides: "v37 (6e7af98) : buildLegs, analyzeLeg, route, applyRegattaMarks, référence SNPM f80c365"
provides:
  - "tests/fixtures/legs-v37.json : 127 cas de bords v37 figés (parcours 1 à 13, G et P, tours, deux vents, variantes axe / cap saisi / pinguée, parcours 13 à 0,8 et 1,5 Nq, régate archivée v37), capturés sur 6e7af98, 361 413 octets"
  - "tests/helpers/legs.mjs : REGATE_V37, serialLegs, legCases, sameLegs, capture --capture <racine> <sortie>"
  - "js/banane.js : BANANE_ID (90), BANANE (built 'BAN'), BAN_DEF, FINS, cleanBan, banOf, addBanane, bananeCourse, orientGate, courseMarkUse"
  - "js/tactics.js : buildLegs (banane, porte [bouée, côté, autre bouée], course.finish, finishLine), adviseGate, prepareLeg, gateText, GATE_EQUAL_S, markAdvice avec le conseil de porte"
affects: [06-02-interface, 06-03-autre-club, 06-04-livraison]

actuals:
  tokens: 103600
  tasks: 3
  commits: 4

plan_head_before: ccecfe532c24f88916ca4898f6096c217bd7f26f
plan_head_after: 82a02d000ac597bba6b79ea44725752544788905
commits: 4

tech-stack:
  added: []
  patterns:
    - "fixture de non-régression capturée sur le code extrait de la version de référence (git archive), commitée avant toute modification de js/, comparée à 1e-9 près en relatif à chaque npm test"
    - "chaîne des bords partagée (chain) : opérations d’un élément ordinaire inchangées, une porte est un seul bord vers une bouée choisie"
    - "routage injectable par ctx.routeFn pour les seuls tests"

key-files:
  created:
    - js/banane.js
    - tests/helpers/legs.mjs
    - tests/fixtures/legs-v37.json
    - tests/banane.test.mjs
  modified:
    - js/tactics.js
    - sw.js
    - js/version.js

key-decisions:
  - "06-01 : la fixture v37 sérialise un côté ou un tour absent en null (comme JSON) : une clé `lap` absente des bords v37 hors tours ne passe pas pour un écart"
  - "06-01 : le conseil de porte n’est « conseil » que si l’écart est d’au moins 10 s ou si une bascule est annoncée ; une porte pas encore conseillée (gain nul) s’écrit « bouée gauche retenue pour le calcul » et n’est jamais marquée conseillée sur la carte"
  - "06-01 : repli du conseil de porte sur la distance à 4 nd quand le routage rend null OU un temps non fini (jamais de NaN)"

patterns-established:
  - "Une porte, de banane ou de régate, est une marque PORTE qui porte ses deux bouées (gauche à bâbord, droite à tribord, vues par les bateaux qui arrivent) ; prepareLeg fait partir le bord suivant de la bouée retenue"

requirements-completed: []
requirements-advanced: [PARC-01, PARC-02, PARC-03]   # moteur seulement : cochés dans REQUIREMENTS.md quand l’interface (06-02) les rend utilisables

coverage:
  - id: D1
    description: "Les bords des parcours 1 à 13 et d’un parcours de régate archivé sont ceux de la v37 (D-10, D-09)"
    requirement: PARC-03
    verification:
      - kind: unit
        ref: "tests/banane.test.mjs#non-régression v37 (127 cas, sameLegs) + capture sur 6e7af98 identique (cmp) + commit de la fixture sans modification de js/"
        status: pass
    human_judgment: false
  - id: D2
    description: "Banane construite depuis le centre de la ligne réellement utilisée : B, dégagement C, porte à deux bouées ou bouée S, tours, trois arrivées (D-01, D-02, D-03)"
    requirement: PARC-01
    verification:
      - kind: unit
        ref: "tests/banane.test.mjs#banane par défaut / sans dégagement / B à tribord / sans porte / sous le vent / au vent / 1 tour / ligne pinguée / rankCourses / cleanBan"
        status: pass
    human_judgment: false
  - id: D3
    description: "Porte conseillée par routage (bord vers la bouée plus bord suivant), bouées équivalentes sous 10 s, bascule annoncée, bord suivant parti de la bouée retenue (D-05)"
    requirement: PARC-02
    verification:
      - kind: unit
        ref: "tests/banane.test.mjs#adviseGate (champ uniforme, temps imposés, porte en dernier, repli) / prepareLeg / gateText / markAdvice / banane réelle / courseMarkUse"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-23
status: complete
---

# Phase 6 Plan 01 : Moteur du parcours banane Summary

**Banane construite (B, dégagement, porte à deux bouées ou bouée sous le vent, arrivées sur la ligne ou décalées) et porte / arrivée d’un parcours de régate dans `buildLegs`, conseil de porte par routage (`adviseGate`, `prepareLeg`, `gateText`), sous la garde d’une fixture des bords v37 capturée sur 6e7af98 avant toute modification de `js/`.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-23T17:55:23Z
- **Completed:** 2026-10-23T18:02:18Z
- **Tasks:** 3 (la première de type tracer)
- **Files modified:** 7 (dont `sw.js` et `js/version.js`, générés par `npm run stamp`)

## Accomplishments

- Fixture `tests/fixtures/legs-v37.json` : 127 cas (84 de base : 13 parcours × G/P × tours 1-3 ou 2 × vents 315° et 135° ; 39 variantes axe / cap 200° / ligne pinguée à 1,5 Nq ; 4 cas de la régate archivée v37), 361 413 octets, capturée sur l’extraction `git archive 6e7af98 js package.json`, identique octet pour octet à une capture sur l’arbre courant non modifié ; commit `aaca687` sans aucune modification de `js/` (`git diff --quiet 6e7af98 aaca687 -- js/` en 0). Contrôles négatifs de `sameLegs` faits (écart de 1e-7 relatif, côté changé, bord en moins : tous détectés).
- `js/banane.js` : module pur (n’importe que `js/geo.js`), `BANANE_ID = 90`, réglages bornés par `cleanBan` (cinq clés propres, `Object.hasOwn`, `__proto__` et héritage ignorés), géométrie D-02 / D-03 complète, `orientGate`, `courseMarkUse`.
- `js/tactics.js` : branche `built: 'BAN'` posée APRÈS la ligne pinguée, depuis son centre ; chaîne des bords `chain` partagée (mêmes opérations qu’en v37 pour un élément ordinaire) ; porte de régate `[m, côté, g]` orientée au moment du chaînage ; arrivée `course.finish` (Comité – bouée, près d’une bouée ; bouée inconnue → arrivée habituelle) ; `adviseGate`, `prepareLeg`, `gateText`, `GATE_EQUAL_S`, `markAdvice` qui commence par le conseil de porte.
- `tests/banane.test.mjs` : 29 tests (non-régression, géométrie de toutes les options, ligne pinguée, exclusion de `rankCourses`, `cleanBan`, `addBanane`, `orientGate`, porte et arrivée de régate, conseil de porte sur champ uniforme et temps imposés, seuil strict de 10 s, bascule, repli, `prepareLeg`, textes, `markAdvice` v37, banane sur relief et vent réels, `courseMarkUse`).
- `npm test` : 609 tests, 0 échec ; `npm run check` vert ; garde SNPM `git diff --quiet f80c365 -- js/courses.js tests/reference/` en 0 à chaque commit.

## Task Commits

1. **Task 0 (tâche 1, étapes 1-3) : bords v37 figés** - `aaca687` (test)
2. **Task 1 : banane par défaut dans buildLegs (tracer)** - `849ef65` (feat)
3. **Task 2 : toutes les options de la banane, porte et arrivée de régate** - `4a5948e` (feat)
4. **Task 3 : conseil de porte par routage, texte et bouées de la carte** - `82a02d0` (feat)

**Plan metadata:** commits `docs(06-01)` suivant ce fichier.

_Tracer : après la tâche 1, `<verify>` a été rejoué de bout en bout (capture v37 + cmp, commit de la fixture antérieur à toute modification de js/, tests ciblés 67/67, `npm run check` 591/591, garde SNPM) : « Tracer verified end-to-end — expanding »._

## Files Created/Modified

- `js/banane.js` (nouveau) : parcours banane, réglages, géométrie, orientation de porte, usage des bouées pour la carte
- `js/tactics.js` : `buildLegs` étendu, conseil de porte
- `tests/helpers/legs.mjs` (nouveau) : matrice des cas, sérialisation, comparaison, capture
- `tests/fixtures/legs-v37.json` (nouveau) : bords v37 figés
- `tests/banane.test.mjs` (nouveau) : 29 tests
- `sw.js`, `js/version.js` : `npm run stamp` (js/banane.js dans la liste hors réseau ; version toujours 37, seul le hachage change)

## Decisions Made

- Sérialisation : côté et tour absents → `null` (sinon la clé `lap` absente des bords v37 hors tours faisait échouer la comparaison de structure).
- Une porte encore sans conseil (gain nul, avant `adviseGate`) n’est jamais présentée comme conseillée ; `gateText` dit alors « bouée gauche retenue pour le calcul ».
- Repli à 4 nd aussi pour un temps de routage non fini, pas seulement `null`.
- `BANANE` n’est pas gelé (`Object.freeze`) : les entrées de `COURSES` ne le sont pas et l’app pourra y poser ses champs comme sur les autres parcours.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commande de vérification de la tâche 1 : `git rev-list --diff-filter=A` refusé**
- **Found during:** Task 1 (vérification)
- **Issue:** `git rev-list` n’accepte pas `--diff-filter` (sortie « usage », code 129), la commande `<verify>` du plan ne pouvait pas aboutir.
- **Fix:** même contrôle avec `git log -n 1 --format=%H --diff-filter=A HEAD -- tests/fixtures/legs-v37.json` (rend `aaca687`), puis `git diff --quiet 6e7af98 aaca687 -- js/` en 0.
- **Files modified:** aucun (commande seulement)

**2. [Rule 1 - Bug] Sérialisation des bords : clé `lap` absente**
- **Found during:** Task 1 (première exécution du test de non-régression, avant le commit de la fixture)
- **Issue:** `serialLegs` gardait `lap: undefined`, que JSON supprime : la fixture et le calcul courant n’avaient pas les mêmes clés.
- **Fix:** `side ?? null`, `lap ?? null` ; fixture recapturée sur 6e7af98 (toujours identique à une capture sur l’arbre courant), avant tout commit.
- **Files modified:** tests/helpers/legs.mjs
- **Commit:** aaca687

**3. Commits par tâche plutôt que RED / GREEN séparés**
- Les tâches 2 et 3 (`tdd="true"`) ont bien eu leur phase RED (tests écrits d’abord : échec à l’import, `orientGate` puis `GATE_EQUAL_S` absents), mais chaque tâche est commitée en un seul commit, à la demande de l’orchestrateur (« commits atomiques par tâche »). La fixture a son propre commit, comme l’exige le plan.

---

**Total deviations:** 2 auto-fixed (1 blocage de commande, 1 bug de sérialisation), 1 écart de forme des commits.
**Impact on plan:** aucun sur le périmètre ; la fixture reste capturée sur le code de 6e7af98.

## Issues Encountered

Aucun autre.

## User Setup Required

Aucun.

## Next Phase Readiness

- 06-02 peut câbler : `addBanane(COURSES)` au chargement, réglages `S.banNm/banOff/banSide/banGate/banFin` lus par `banOf(S)`, `buildLegs(..., { ban: banOf(S) })`, `prepareLeg` sur chaque bord brut avant `analyzeLeg` (dans l’ordre, avec le bord précédent préparé), `gateText` au briefing et en course, `courseMarkUse` dans `drawCourse`, `finishLine` à dessiner.
- Attention pour 06-02 : `BANANE.seq` contient `['PORTE', null]`, qui n’est pas une clé de `MARKS` ; tout code de l’app qui parcourt `course.seq` pour lire `MARKS[m]` (en dehors de `buildLegs`, `rankCourses` et du débrief, qui excluent `built`) doit le prévoir. La numérotation de `runAnalysis` donne un numéro aux bords `PORTE` (seuls `GATE` et `FINISH` sont exclus), ce que `courseMarkUse` attend.
- 06-03 : `applyRegattaMarks` ne produit encore que des éléments à deux valeurs ; `buildLegs` sait déjà lire `[bouée, côté, autre bouée]` et `course.finish = { kind: 'comite' | 'pres', mark }`.

## Self-Check: PASSED

- FOUND: js/banane.js, js/tactics.js, tests/helpers/legs.mjs, tests/fixtures/legs-v37.json, tests/banane.test.mjs
- FOUND: aaca687, 849ef65, 4a5948e, 82a02d0 (ancêtres de HEAD)
