---
phase: 06-parcours-banane
plan: 02
subsystem: interface-parcours
tags: [banane, porte, arrivee-decalee, runAnalysis, prepareLeg, carte, en-course, manche, scenarios]

requires:
  - phase: 06-parcours-banane
    provides: "06-01 : js/banane.js (BANANE_ID, banOf, cleanBan, addBanane, courseMarkUse), js/tactics.js (buildLegs avec ban, prepareLeg, gateText, finishLine)"
provides:
  - "js/app.js : banane dans la liste (addBanane(COURSES) avant la lecture de S), réglages banNm/banOff/banSide/banGate/banFin dans DEF, panneau #cBan*, analyse chaînée par prepareLeg, carte (courseMarkUse, PG/PD/S, finishLine), briefing « Tour n · Porte : … », navigation en course (conseil, autre bouée, legReached), planRest qui reconseille la porte, ban dans stratSettings, la manche et chooseRace"
  - "js/scene3d.js : anneau orange et « · conseillée » de la bouée conseillée ; setLine(L, extra, finish) trace la ligne d’arrivée décalée en bleu, nommée « Arrivée »"
  - "js/banane.js : legReached(p, leg, r = 40), banToState(b)"
  - "js/regates.js : addRace garde ban (cleanBan) seulement s’il est fourni ; raceSettings le rend"
  - "tools/regate-e2e.mjs : scénarios banane (réglages, porte, arrivées, conseil, carte, relance, en course) et banane-manche (deux téléphones)"
affects: [06-03-autre-club, 06-04-livraison]

actuals:
  tokens: 12300
  tasks: 3
  commits: 3

plan_head_before: ea77948188cc31566c7009a3e1b4346a89ff5777
plan_head_after: f9207abf1bfcb85406d8776d0f8062ad5d122073
commits: 3

tech-stack:
  added: []
  patterns:
    - "prepareLeg(leg, bord précédent analysé, bord brut suivant, F, ctx) juste avant analyzeLeg, après le computeField de l’heure du bord (runAnalysis et planRest)"
    - "réglages facultatifs d’une manche : clé ajoutée seulement quand elle existe (forme v37 sinon), toujours bornée par cleanBan à l’écriture et à la lecture"

key-files:
  created: []
  modified:
    - js/app.js
    - js/scene3d.js
    - js/banane.js
    - js/regates.js
    - tests/banane.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "06-02 : la distance B saisie est bornée dès la saisie (banOf sur la valeur lue, virgule acceptée) : rade.state ne garde jamais une valeur hors de 0,3-2 Nq"
  - "06-02 : en course, le conseil de porte vient de l’analyse (toujours affiché) ; le recalcul depuis le bateau (planRest) le refait et l’affiche dans « Suite du parcours » ; l’option de #nSel d’une porte se lit « Porte gauche (porte) »"
  - "06-02 : « Autre bouée : relèvement · distance » affiché seulement avec une position GPS"

patterns-established:
  - "Une porte est passée (autoAdvance) à moins de 40 m de l’une OU l’autre bouée : legReached"

requirements-completed: [PARC-01, PARC-02, PARC-03]

coverage:
  - id: D1
    description: "Banane choisie dans l’onglet Parcours, réglages visibles seulement pour elle, gardés dans rade.state et après relance (D-01, D-04)"
    requirement: PARC-01
    verification:
      - kind: e2e
        ref: "tools/regate-e2e.mjs#banane"
        status: pass
    human_judgment: false
  - id: D2
    description: "Porte conseillée par routage à chaque passage, bord suivant depuis la bouée retenue, conseil dans la liste des bords, au briefing et sur la carte (D-05, D-06)"
    requirement: PARC-02
    verification:
      - kind: e2e
        ref: "tools/regate-e2e.mjs#banane (bord porte, briefing « Tour 1 · Porte : », étiquettes « Porte gauche · bâbord », « Porte droite · tribord », « · conseillée », « Arrivée »)"
        status: pass
      - kind: unit
        ref: "tests/banane.test.mjs#gardes en course (prepareLeg avant analyzeLeg dans planRest, gateText)"
        status: pass
    human_judgment: true
  - id: D3
    description: "En course : conseil, autre bouée, recalcul depuis le bateau, passage près de l’une ou l’autre bouée ; mode départ inchangé (D-06, D-07)"
    requirement: PARC-02
    verification:
      - kind: unit
        ref: "tests/banane.test.mjs#legReached"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs#banane (partie en course), retour-port, jour-j"
        status: pass
    human_judgment: false
  - id: D4
    description: "Réglages de la banane gardés avec la manche et la route figée, rendus sur un autre téléphone ; manche sans banane à la forme v37 (D-04, D-09)"
    requirement: PARC-03
    verification:
      - kind: unit
        ref: "tests/banane.test.mjs#manche ban / raceSettings / banToState / gardes stratSettings, chooseRace, #rcAdd"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs#banane-manche, manche, deux-telephones, archive"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-23
status: complete
---

# Phase 6 Plan 02 : Banane dans l’app Summary

**Banane construite choisie dans l’onglet Parcours avec ses cinq réglages, porte conseillée par routage à chaque passage (bords, briefing, carte 2D/3D avec anneau orange et ligne d’arrivée bleue), conseil et autre bouée en course avec passage près de l’une ou l’autre bouée, et réglages gardés avec la manche pour les trois téléphones.**

## Performance

- **Duration :** 13 min
- **Started :** 2026-10-23T18:04:32Z
- **Completed :** 2026-10-23T18:17Z
- **Tasks :** 3 (la première de type tracer)
- **Files modified :** 8 (dont `sw.js` et `js/version.js`, générés par `npm run stamp`)

## Accomplishments

- `js/app.js` : `addBanane(COURSES)` ligne 59, avant `const S` (ligne 67) ; cinq clés `ban*` dans `DEF` ; panneau `banPanel()` (Dist. B, Dégagement, B laissée à, Porte sous le vent, Arrivée) affiché seulement pour `built === 'BAN'` ; `runAnalysis` passe `ban: banOf(S)` et appelle `prepareLeg` avant `analyzeLeg` sur chaque bord, après le `computeField` de son heure ; `finishLine` dans l’analyse ; `drawCourse` par `courseMarkUse`, points `PG`, `PD`, `S` ; briefing « Tour n · Porte : … ».
- `js/scene3d.js` : bouée conseillée cerclée de `#ff9f1c` avec « · conseillée » ; ligne d’arrivée décalée en pointillé bleu `#1c7ed6` et étiquette « Arrivée ». Sans porte ni arrivée décalée, rien ne change.
- En course : `legReached` dans `autoAdvance` ; `#nSel` montre « (porte) » ; conseil de porte toujours affiché, « Autre bouée : relèvement · distance » avec le GPS ; `planRest` reconstruit la porte (`gate: { g, d }`) et la reconseille depuis le bateau ; `renderPlan` dit le conseil.
- Manches : `addRace` garde `ban` nettoyé seulement s’il est fourni (forme v37 sinon), `raceSettings` le rend borné, `chooseRace` l’applique par `banToState` ; `stratSettings` porte `ban` pour la banane.
- Exemple de conseil affiché (scénario `banane`, vent manuel 315° 14 nd, samedi 24/10) : « Porte : bouée gauche conseillée — 22 s de mieux ».

## Task Commits

1. **Task 1 : banane dans l’onglet Parcours, porte conseillée dans les bords, au briefing et sur la carte (tracer)** - `0873046` (feat)
2. **Task 2 : en course, conseil, autre bouée, recalcul depuis le bateau, legReached** - `bb8a163` (feat)
3. **Task 3 : réglages de la banane avec la manche et la route figée, deux téléphones** - `f9207ab` (feat)

_Tracer : après la tâche 1, `<verify>` rejoué de bout en bout (node --check, greps, `npm run check` 609/609, garde SNPM, garde D-07, `banane manche bouees` 3/3 OK) : « Tracer verified end-to-end — expanding »._

## Vérifications (sorties brutes)

```
npm run check            → # pass 614 / # fail 0
git diff --quiet f80c365 -- js/courses.js tests/reference/                       → 0 (SNPM-OK)
git diff --quiet 6e7af98 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js → 0 (D07-OK)
node --test … banane boot diag             → # pass 82 / # fail 0
node --test … banane regates gel archmerge → # pass 129 / # fail 0
PW_REQUIRED=1 node tools/regate-e2e.mjs banane banane-manche manche bouees retour-port jour-j deux-telephones archive
  conseil affiché : Porte : bouée gauche conseillée — 22 s de mieux
  OK banane / OK banane-manche / OK manche / OK bouees / OK retour-port / OK jour-j / OK deux-telephones / OK archive
  Bilan : 8/8 scénario(s) OK
```

## Files Created/Modified

- `js/app.js` : câblage complet (liste, réglages, analyse, carte, briefing, course, manche, route figée)
- `js/scene3d.js` : `setMarks` (advised, note), `setLine(L, extra, finish)`
- `js/banane.js` : `legReached`, `banToState`
- `js/regates.js` : `ban` facultatif dans `addRace` et `raceSettings` (import de `cleanBan`)
- `tests/banane.test.mjs` : 5 tests de plus (34 en tout)
- `tools/regate-e2e.mjs` : scénarios `banane`, `banane-manche` et leurs outils (`attendBords`, `suite`, `releveEtiquettes`, `ventManuel`, `reglagesBanane`, `etatPage`)
- `sw.js`, `js/version.js` : `npm run stamp` (version toujours 37, hachage seulement)

## Decisions Made

- Distance B bornée dès la saisie (pas seulement au calcul) pour que `rade.state` reste propre.
- « Autre bouée » seulement avec GPS ; le conseil de porte, lui, toujours.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scénario `banane` : la liste `#cSel` n’est pas encore dessinée juste après `ouvreApp`**
- **Found during :** Task 1 (premier essai du scénario)
- **Issue :** l’onglet Parcours n’était pas encore rendu (options vides) au moment de la lecture.
- **Fix :** attendre les 13 bords du parcours 3 avant les premières vérifications.
- **Files modified :** tools/regate-e2e.mjs
- **Commit :** 0873046

**2. Commits par tâche plutôt que RED / GREEN séparés**
- Les tâches 2 et 3 (`tdd="true"`) ont eu leur phase RED (tests écrits d’abord, 2 puis 3 échecs constatés), mais chaque tâche est commitée en un seul commit, à la demande de l’orchestrateur (« commits atomiques par tâche »).

---

**Total deviations :** 1 auto-fixed (outil de test), 1 écart de forme des commits.
**Impact on plan :** aucun sur le périmètre.

## Issues Encountered

- `RT_STRICT=1 npm run check` refuse (« contenu modifié depuis la v37 : lancez npm run release ») : attendu, la publication de la v38 est le travail de 06-04 ; `npm run check` (non strict) est vert.

## Notes pour 06-03

- `js/debrief.js` l.283 lit la suite d’un parcours choisi sans MARKS : `['PORTE', null]` de la banane n’y gêne pas, et le choix du débrief garde `COURSES.filter((c) => !c.built)`, donc la banane n’y est pas proposée (D-01 le permet tant que le débrief ne sait pas la construire).
- `tools/regate-e2e.mjs` contient maintenant `attendBords`, `suite`, `releveEtiquettes`, `etatPage` réutilisables pour `porte-ic`.
- `legReached` et `courseMarkUse` traitent déjà toute porte `{ g, d }` (banane ou régate) ; une porte de régate (`[bouée, côté, autre bouée]`) passera par le même câblage sans changement de `js/app.js`, sauf `drawCourse` qui ne dessine que les points construits `A B C D PG PD S` (les bouées X… de régate sont déjà dans MARKS).
- La porte de la banane se lit « Porte gauche · bâbord » / « Porte droite · tribord » sur la carte ; une porte de régate gardera le nom de ses bouées.

## User Setup Required

Aucun. Vérification humaine prévue (human-check de la tâche 1) : carte 2D/3D sur iPhone, ligne d’arrivée bleue au vent, mode départ « Marque 1 » vers B.

## Self-Check: PASSED

- FOUND : js/app.js, js/scene3d.js, js/banane.js, js/regates.js, tests/banane.test.mjs, tools/regate-e2e.mjs
- FOUND : 0873046, bb8a163, f9207ab (ancêtres de HEAD)
