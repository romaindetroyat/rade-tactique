---
phase: 05-avant-la-regate
plan: 01
subsystem: archive
tags: [reprise, traces, indexeddb, archive-partagee, tdd, playwright]

requires:
  - phase: 03-regates
    provides: "js/attach.js (matchRegattas, sameTrack, attachTrace, setTraceReport), rangeTrace, références de traces dans la régate"
  - phase: 04-archive-partagee
    provides: "chemin lourd runHeavy/heavyPlan (envoi des traces référencées), verrou de course, fusion mergeRegatta"
provides:
  - "js/reprise.js : rattrapage pur (dépendances injectées) des traces locales d'avant l'archive, une fois par téléphone"
  - "canonicalTraceId dans js/track.js : identifiant stable d'un import GPX, seule définition"
  - "rangement à l'arrêt d'une trace enregistrée dans l'app (rangeEnregistree, D-09)"
  - "scénario Playwright reprise (un téléphone, puis deux téléphones sur un faux Blob partagé)"
affects: [05-02, 05-03, archive, traces]

actuals:
  tokens: 9050
  tasks: 3
  commits: 5

plan_head_before: 841860c2a50952255ca6c2c28fa2158015cf9fb0
plan_head_after: da60f3d75d50eb0af2426e0dd12d3d597d81f7b6
commits: 5

tech-stack:
  added: []
  patterns:
    - "boucle pure à dépendances injectées sur le modèle de runHeavy (js/archheavy.js), chargée par import() seulement"
    - "renommage écrire-puis-effacer, rejouable si interrompu entre les deux"
    - "drapeau de passage unique en localStorage (rade.reprise.v1), posé seulement quand la boucle va au bout"

key-files:
  created:
    - js/reprise.js
    - tests/reprise.test.mjs
  modified:
    - js/track.js
    - js/app.js
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "Le renommage d'un ancien import se fait avant le contrôle « déjà référencé / même début et même nombre de points » : la copie locale prend l'identifiant que les autres téléphones référencent, elle n'est donc pas retéléchargée en double"
  - "Un ancien identifiant déjà référencé n'est jamais lu ni renommé (comptée « déjà ») : le rattrapage ne touche pas ce qu'un téléphone v31 avait déjà rangé"
  - "raceTick garde sa ligne `if (wasRaceActive && !active) scheduleSync(60000);` à l'identique (garde de tests/boot.test.mjs) ; l'appel reprise() est une ligne séparée juste dessous"

patterns-established:
  - "Un rattrapage de données locales vers l'archive passe par save → saveReg (état marqué = file d'envoi), jamais par un nouveau code d'envoi"

requirements-completed: [ARCH2-01]

coverage:
  - id: D1
    description: "Au premier lancement de la v32, les traces locales jamais rangées entrent sans question dans la régate de leur jour (unique ou heure) ; les autres restent dans Traces, sans fiche créée"
    requirement: ARCH2-01
    verification:
      - kind: unit
        ref: "tests/reprise.test.mjs#unique / heure / choix / proche / aucune"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs reprise (partie un téléphone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Le rattrapage ne tourne ni pendant une course ni pendant la journée verrouillée, se rejoue aux transitions de raceTick, et ne tourne plus jamais une fois allé au bout (drapeau rade.reprise.v1)"
    requirement: ARCH2-01
    verification:
      - kind: unit
        ref: "tests/reprise.test.mjs#course en cours / journée verrouillée / une course commence après la première trace / seconde exécution"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs reprise (relance sans effet, même drapeau)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deux téléphones qui avaient le même GPX sous deux identifiants aléatoires donnent une seule référence et un seul envoi de la trace et du rapport au magasin ; le rapport local est annoncé sur la référence"
    requirement: ARCH2-01
    verification:
      - kind: unit
        ref: "tests/reprise.test.mjs#le même GPX sous deux identifiants aléatoires sur deux téléphones / rapport local de l'ancienne trace"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs reprise (partie deux téléphones, faux Blob partagé) + contrôle négatif"
        status: pass
    human_judgment: false
  - id: D4
    description: "Une trace enregistrée dans l'app est rangée à l'arrêt sans question, le message d'arrêt dit dans quelle régate"
    requirement: ARCH2-01
    verification:
      - kind: other
        ref: "grep rangeEnregistree( js/app.js = 3 ; npm run check (garde aucune erreur avalée)"
        status: pass
    human_judgment: true
    rationale: "Le GPS réel ne se simule pas dans les scénarios Chromium : l'arrêt d'un enregistrement réel se contrôle sur l'aperçu, sur un téléphone"

duration: 20min
completed: 2026-10-20
status: complete
---

# Phase 5 Plan 01 : Rattrapage des traces d'avant l'archive Summary

**Rattrapage unique, sans question et hors course, des traces locales dans la régate de leur jour, avec identifiant stable `'tr' + start + '-' + n` pour les anciens imports GPX (une seule référence et un seul envoi entre deux téléphones), rapport de débrief annoncé, et rangement à l'arrêt d'une trace enregistrée dans l'app.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-20T09:00:00Z (approximatif : l'heure de départ n'a pas été relevée au lancement, le premier commit est de 09:06:34Z)
- **Completed:** 2026-10-20T09:20:00Z
- **Tasks:** 3 (la première de type tracer)
- **Files modified:** 7 (dont `sw.js` et `js/version.js`, générés par `npm run stamp`)

## Accomplishments

- `js/reprise.js` (`runReprise`) : module pur au modèle de `runHeavy`. Pour chaque trace locale : déjà référencée → comptée sans lecture ; ancien import à identifiant aléatoire → écriture sous l'identifiant stable puis effacement de l'ancien ; `matchRegattas` rend `unique` ou `heure` → référence posée (`attachTrace`, plus `setTraceReport` si un rapport local existe) ; `choix`, `proche`, `aucune` → laissée dans « Traces ». Aucune invite, aucune régate créée. Contrôle de la course et du verrou avant la liste et entre deux traces.
- `js/app.js` : `reprise()` chargée par `import('./reprise.js')` seulement (une occurrence, aucun import statique), lancée 1,5 s après la carte, rejouée à la fin de course et à la levée du verrou dans `raceTick`. Drapeau `rade.reprise.v1` `{ done, at, rangees, laissees }` posé seulement quand la boucle est allée au bout. Une ligne `reprise` au journal à chaque passage, un toast « 1 trace rangée dans l’archive » ou « N traces rangées dans l’archive ». L'envoi suit le chemin lourd de la phase 4, inchangé.
- `js/track.js` : `canonicalTraceId(tr)`, seule définition de l'identifiant stable, utilisée par `fromGPX` et par le rattrapage.
- `rangeEnregistree(tr)` : `rangeTrace(tr, { invite: false })` aux deux arrêts d'enregistrement (`stopGps` et `#recStop`), message « Trace enregistrée (N points) · rangée dans <régate> ».
- `tests/reprise.test.mjs` : 24 tests (rangée, laissée, verrou, course en cours de passage, idempotence, renommage, interruption entre écriture et effacement dans les deux ordres, doublon entre téléphones et fusion, rapport annoncé, gardes statiques). Scénario Playwright `reprise` : un téléphone puis deux téléphones sur un faux Blob partagé.
- La référence SNPM n'a pas bougé : `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort en 0.

## Task Commits

1. **Task 1 : rattrapage de bout en bout, un téléphone (tracer, D-01 à D-03)**
   - `6bb2e5e` (test, RED : module absent)
   - `b4de10f` (feat, GREEN)
2. **Task 2 : identifiant stable, doublon entre téléphones, rapport annoncé (D-10, D-11)**
   - `c65819b` (test, RED : `canonicalTraceId` absent)
   - `e0c8423` (feat, GREEN)
3. **Task 3 : trace enregistrée rangée à l'arrêt (D-09) et vérification complète** - `da60f3d` (feat)

**Plan metadata:** commit `docs(05-01)` suivant ce fichier.

_Tracer : après la tâche 1, `<verify>` a été rejoué de bout en bout (tests, `npm run check`, garde SNPM, scénarios `reprise` et `gpx`) puis les tâches suivantes ont commencé : « Tracer verified end-to-end — expanding »._

## Files Created/Modified

- `js/reprise.js` : rattrapage pur, dépendances injectées (nouveau)
- `tests/reprise.test.mjs` : 24 tests (nouveau)
- `js/track.js` : `canonicalTraceId`, utilisée par `fromGPX`
- `js/app.js` : `reprise()`, `REPRISE_KEY`, appels dans `init()` et `raceTick()`, `rangeEnregistree()` aux deux arrêts
- `tools/regate-e2e.mjs` : scénario `reprise` (un puis deux téléphones), aides `poseTrace`, `poseOrpheline`, `reprisePosee`
- `sw.js`, `js/version.js` : générés par `npm run stamp` (`js/reprise.js` entre dans la liste hors réseau)

## Decisions Made

- Le renommage vient avant le contrôle « déjà référencé » et avant la garde `sameTrack` : la copie locale prend l'identifiant que les autres téléphones référencent, elle ne sera donc pas retéléchargée en double par `heavyPlan`.
- Un ancien identifiant déjà référencé (téléphone v31 qui l'avait rangé) est compté « déjà » avant toute lecture : ni lu, ni renommé, ni rattaché de nouveau.
- Le renommage interrompu est compté `renommees` aussi quand seule l'ancienne copie est effacée (les deux identifiants présents).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocage] La garde de `tests/boot.test.mjs` exige la ligne `wasRaceActive && !active) scheduleSync(60000)` à l'identique**
- **Found during:** Task 1 (`npm run check`)
- **Issue:** ma première forme `if (wasRaceActive && !active) { scheduleSync(60000); reprise(); }` cassait le test « archive : raceTick abandonne l'échange en cours… ».
- **Fix:** la ligne d'origine est restée telle quelle ; `reprise()` est appelée par une seconde ligne `if (wasRaceActive && !active) reprise();` juste dessous (`wasRaceActive` n'est mis à jour qu'après).
- **Files modified:** `js/app.js`
- **Verification:** `npm run check` : 486 puis 496 tests verts.
- **Committed in:** `b4de10f`

**2. [Rule 3 - Blocage] `sw.js` et `js/version.js` périmés après chaque modification de l'app**
- **Found during:** Tasks 2 et 3
- **Issue:** `npm run stamp` doit être rejoué après chaque changement de `js/` ; le commit de la tâche 2 avait oublié les deux fichiers générés.
- **Fix:** `git commit --amend` du seul commit local de la tâche 2 (rien n'était poussé), puis stamp rejoué avant le commit de la tâche 3.
- **Files modified:** `sw.js`, `js/version.js`
- **Committed in:** `e0c8423`, `da60f3d`

---

**Total deviations:** 2 auto-fixed (2 Rule 3)
**Impact on plan:** aucune. Le comportement livré est celui du plan ; la version affichée reste v31 (la publication de la v32 est l'affaire du plan 05-03).

## Issues Encountered

- Les scénarios Playwright ont passé du premier coup, ce qui ne prouve rien seul. Un contrôle négatif a été fait : avec le renommage désactivé, le scénario `reprise` échoue (`obtenu ["tr1792303463000417"], attendu ["tr1792303463000-9538"]`), puis le fichier d'origine a été rétabli.
- Le plan estimait 110 000 jetons ; le diff réel (hors fichiers générés) est de l'ordre de 9 050 jetons (36 210 caractères / 4). L'estimation était très pessimiste.

## Vérifications brutes (tâche 3)

- `npm run check` : `# tests 496`, `# pass 496`, `# fail 0` ; `node --test … tests/reprise.test.mjs tests/attach.test.mjs tests/archheavy.test.mjs` : 76 tests, 76 verts ; `tests/reprise.test.mjs` compte 24 tests.
- Garde SNPM : `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort en 0.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs reprise gpx gpx-choix archive archivehors equipage` (sortie 0) :
  ```
  OK reprise
  OK gpx
  OK gpx-choix
  OK archive
    mesure archivehors : trace 612648 octets, rapport 366 octets
    mesure archivehors : vent du jour 50593 octets (prévisions 38803, route 11490, relevés 48)
  OK archivehors
  OK equipage
  Bilan : 6/6 scénario(s) OK
  ```
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` (sortie 0) : médiane de l'interface utile 388 ms (maximum 501 ms), seuil 2000 ms ; « RÉSULTAT : OK — médiane de l’interface utile 388 ms < 2000 ms (hors réseau, CPU ×4) ». Le rattrapage n'a donc pas ralenti l'ouverture (FIAB-06).
- Critères d'acceptation : `grep -c "import('./reprise.js')" js/app.js` = 1 ; `grep -c "rade.reprise.v1" js/app.js` = 1 ; `grep -c 'rangeEnregistree(' js/app.js` = 3 ; `canonicalTraceId` défini une fois dans `js/track.js` et appelé par `fromGPX`.

## Contrôle humain restant

- Sur l'aperçu, un jour où une régate existe : En course, Enregistrer ma trace, marcher une minute, Arrêter. Attendu : « Trace enregistrée (N points) · rangée dans <régate> — onglet Traces », la trace visible dans la fiche, aucune question posée. Le GPS réel ne se simule pas dans Chromium.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau point d'entrée réseau, aucun nouveau chemin d'authentification : le rattrapage n'ajoute que des références dans l'index local des régates, l'envoi passe par le chemin de la phase 4 derrière le code d'accès. Mitigations du plan en place : T-05-01 (une seule passe, `unique`/`heure` seulement, journal, toast, « Détacher » disponible), T-05-02 (contrôle avant la liste et entre deux traces, drapeau non posé si reporté), T-05-03 (identifiant unique, écrire puis effacer, garde `sameTrack`), T-05-04 (trace sans régate laissée sur le téléphone), T-05-05 (import dynamique après rt:map + 1,5 s, une trace à la fois).

## Self-Check: PASSED

Fichiers présents : `js/reprise.js`, `tests/reprise.test.mjs`, `js/track.js`, `js/app.js`, `tools/regate-e2e.mjs`. Commits retrouvés dans l'historique : `6bb2e5e`, `b4de10f`, `c65819b`, `e0c8423`, `da60f3d`. Garde SNPM en 0.
