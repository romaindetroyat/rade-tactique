---
phase: 04-archive-partagee
plan: 02
subsystem: sync
tags: [archive, synchronisation, hors-reseau, racelock, pwa, lww, chromium]

requires:
  - phase: 04-archive-partagee
    provides: "plan 01 : js/archmerge.js (stampState, markDirty, fusion), api/archive.js (GET|PUT ?k=light), x-rt-membre, faux Blob"
provides:
  - "js/archsync.js : canSync, syncStatus, capped, buildDoc, applyDoc, runSync (pur, tout injecté), chargé par import() après la carte"
  - "js/app.js : saveReg marque les modifications (stampState, markDirty), déclencheurs, garde de course, ligne #rgSync et bouton « Synchroniser »"
  - "js/regates.js : SEED_AT, seedNorm ; js/archmerge.js : legacyStamp ; copie rade.regates.v1.bak"
  - "tools/regate-e2e.mjs : scénario archive à deux contextes Chromium sur un faux Blob servi par la vraie fonction"
affects: [04-03, 04-04, 04-05]

actuals:
  tokens: 17400
  tasks: 3
  commits: 4
plan_head_before: 6412bd685a822d9d0085a93c626b443b3b8dab6c
plan_head_after: 6efc28bc02ea3ee00389d219d1bd980bb8bc5f2a
commits: 4

tech-stack:
  added: []
  patterns:
    - "L'état local marqué (u, ub, pierres tombales) EST la file d'envoi : rade.sync.v1 ne porte que des compteurs « sale » par clé, rev, essais, plafonds du jour"
    - "Réponse du serveur appliquée par saveReg(st, { fromSync: true }) : un seul point de câblage, aucun site d'appel changé"
    - "D-03 en trois verrous : refus avant l'envoi, échange abandonné par raceTick, réponse jetée après l'échange"

key-files:
  created:
    - js/archsync.js
    - tests/archsync.test.mjs
  modified:
    - js/app.js
    - js/archmerge.js
    - js/regates.js
    - tools/regate-e2e.mjs
    - tests/boot.test.mjs
    - tests/archmerge.test.mjs
    - tests/regates.test.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "denied (401) et outdated (document plus récent) restent en mémoire seulement : saveSync les retire, le chargement les efface ; ils retombent à la prochaine ouverture"
  - "La graine SNPM prend un instant fixe (SEED_AT = 18/10/2026 00:00 Paris) et sa validation n'a pas d'auteur ; seuls at, ic.validated.at et ic.validated.by changent (assertion de test), js/courses.js et tests/reference/ sont intacts"
  - "legacyStamp est appliqué par syncNow avant le premier envoi (pas dans runSync) ; le banc d'essai des téléphones purs refait le même geste"
  - "Le suffixe « (essai) » s'ajoute à tous les états quand le serveur répond env = preview, pas seulement à « À jour »"

requirements-completed: [ARCH-01]

coverage:
  - id: D1
    description: "La régate créée sur un téléphone apparaît sur l'autre au geste « Synchroniser », signée par le serveur"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archsync.test.mjs#tracer : la régate créée sur A apparaît sur B"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs archive (deux contextes Chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Saisie hors réseau gardée en attente, envoyée au retour du réseau sans perte ni doublon ; ajouts simultanés de manches tous gardés"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archsync.test.mjs (critère 1, critère 2 dans les deux ordres, suppression sans résurrection)"
        status: pass
      - kind: e2e
        ref: "scénario archive : mode avion sur les deux, retour du réseau sans geste, états identiques"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rien n'est envoyé ni reçu pendant un chrono, une trace, le mode départ ou le GPS de course (D-03)"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archsync.test.mjs#D-03 (course active, course commencée pendant l'échange, AbortError, saisie en cours)"
        status: pass
      - kind: e2e
        ref: "scénario archive : compteur de requêtes de A inchangé pendant #t5, un seul PUT après #tstop (mutation vérifiée : garde retirée, le scénario échoue)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ouverture inchangée, usage sobre du quota : import dynamique après rt:map, 30 s, recul, plafonds du jour de Paris, 401 / 429 / 503 / format plus récent"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/boot.test.mjs (5 gardes archive) et tests/archsync.test.mjs (canSync, plafonds, réponses)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Première synchronisation de téléphones déjà remplis : une seule Coupe SNPM sans historique, fiche revalidée gagnante, copie de secours"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archsync.test.mjs#graine SNPM sur trois téléphones (6 ordres) et #fiche revalidée l'emporte (6 ordres)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Recette sur deux iPhone réels : mode avion, retour du réseau, app en arrière-plan, vrai magasin Blob"
    verification: []
    human_judgment: true
    rationale: "Réseau réel d'iPhone et vrai magasin Vercel Blob, inaccessibles aux tests (consigné dans .planning/WINDOWS.md, entrée 2)"

duration: 19min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 02 : synchronisation des régates côté téléphone — Summary

**Les régates se partagent entre téléphones par `/api/archive` : l'état marqué est la file d'envoi (aucun journal d'opérations), la saisie hors réseau part au retour du réseau sans perte ni doublon, les ajouts simultanés sont tous gardés, et rien ne circule pendant un chrono, une trace, le mode départ ou le GPS (compteur de requêtes Chromium inchangé pendant `Top 5'`).**

## Performance

- **Duration:** 19 min (début approximatif 04:26, fin 04:46 UTC)
- **Tasks:** 3 (1 tracer, 2 auto/tdd) + 1 commit demandé par l'orchestrateur
- **Files modified:** 11 (2 créés, 9 modifiés)
- **Tests:** 382 → 417 (`npm run check` vert) ; scénarios Chromium : 14/14 OK, dont `archive`, `auteur`, `creer`

## Accomplishments

- **Tracer (critère 1)** : `js/archsync.js` (politique, indicateur, document à envoyer, réponse appliquée, une synchronisation) et câblage de `js/app.js` : `saveReg(next, { fromSync })` marque par `stampState` / `markDirty` ; ligne `#rgSync` et bouton « Synchroniser » dans la carte Régates ; déclencheurs (ouverture +3 s après `rt:map`, 20 s après une modification, `online`, sonde réseau, retour au premier plan après 5 min, fin de course +60 s). Régate de A chez B, auteur posé par le serveur, `current` et `sel` de l'appareil conservés, manches renumérotées.
- **Critères 1 et 2, D-03** : `canSync` (désactivée, 401, format plus récent, course, hors réseau, plafonds 40 envois / 150 lectures par jour de Paris, 30 s minimum, recul 30 s · 2 min · 10 min · 30 min), 401 / 429 / 503 `no_blob` / document `v > 1` traités sans toucher à l'état, réponse jetée si une course commence pendant l'échange ou si une saisie est ouverte (`canApply`), échange abandonné par `raceTick`. Preuves : 20 tests de trois téléphones purs contre le vrai gestionnaire (hors réseau, deux coupures, deux ordres d'ajouts simultanés avec états identiques, suppression qui ne revient pas, plafonds) et le scénario `archive` (deux contextes Chromium, mode avion, retour du réseau sans geste, aucune requête vue par la page hors réseau ni pendant le chrono, exactement un PUT après Stop).
- **Première synchronisation de l'existant (Pitfall 7)** : `SEED_AT` (18/10/2026 00:00 Paris), `seedNorm` au chargement, `backfillAuthor` qui ne signe pas la validation de la graine, `legacyStamp` avant le premier envoi, copie `rade.regates.v1.bak` écrite une fois avant la première fusion appliquée. Trois téléphones semés à des instants et par des équipiers différents, dans les six ordres : une seule `snpm-2026`, `hist` vide ; si l'un a relu les IC (validation du 21/10), sa fiche l'emporte avec une seule ligne d'historique.
- **Contrôle W1 (orchestrateur)** : un test prouve que seuls `at`, `ic.validated.at` et `ic.validated.by` changent pour la graine ; `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort en 0 et `tests/reference.test.mjs` n'est pas modifié.
- **Contrôles négatifs** : garde de course retirée dans l'application → le scénario `archive` échoue (« aucun appel à /api/archive pendant un chrono — obtenu 5, attendu 3 ») ; `legacyStamp` neutralisé → « fiche revalidée l'emporte » échoue ; graine à instant d'installation → les deux tests de graine échouent.

## Task Commits

0. **Commit demandé par l'orchestrateur : borne de durée de la convergence** — `4af48c0` (test) : la borne de 5 s de `tests/archmerge.test.mjs` devient un garde-fou de 30 s, la durée est consignée, toutes les autres assertions sont conservées (le build Vercel de 6412bd6 échouait probablement sur ce chronométrage).
1. **Task 1 (tracer) : « Synchroniser », la régate de A apparaît sur B** — `18a9710` (feat)
2. **Task 2 : hors réseau, ajouts simultanés, rien pendant une course** — `b46fcf6` (feat)
3. **Task 3 : première synchronisation de l'existant, graine SNPM, copie de secours** — `6efc28b` (feat)

**Plan metadata:** commit `docs(04-02)` qui suit ce fichier.

_TDD : tâche 2, 7 tests rouges constatés avant l'implémentation des plafonds, du 401 et des textes ; les 5 gardes de `tests/boot.test.mjs` étaient déjà verts car le câblage venait du tracer. Tâche 3, tous les tests rouges constatés (exports absents), puis verts. Tests et code d'une tâche sont dans un seul commit._

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan : « Hors réseau · 1 modification en attente » sans suffixe**
- **Found during:** Task 2 (scénario `archive`)
- **Issue :** le suffixe « (essai) » s'applique à tout état quand `env = preview` (texte de la tâche 1), donc l'indicateur lit « Hors réseau · 1 modification en attente (essai) » ; les attentes du plan étaient littérales.
- **Fix :** attentes du scénario écrites avec le suffixe ; la fonction pure `syncStatus` reste sans suffixe.
- **Files modified:** tools/regate-e2e.mjs — **Commit:** `b46fcf6`

**2. [Rule 3 - Blocking] Gel du vent le jour de régate : état « En attente d'envoi » inattendu**
- **Found during:** Task 2 (scénario `archive`)
- **Issue :** avec une régate d'aujourd'hui (7/11 à l'heure fixée), `freezeTick` copie le vent dans la régate, donc marque une modification légitime après la dernière synchronisation ; « À jour » n'était plus stable.
- **Fix :** le scénario crée ses régates à venir (14/11/2026), sans gel. Le comportement de l'app est correct (la modification part à la synchronisation suivante).
- **Files modified:** tools/regate-e2e.mjs — **Commit:** `b46fcf6`

**3. [Rule 2 - Missing critical] `denied` / `outdated` ne doivent pas survivre à la mise à jour**
- **Found during:** Task 2
- **Issue :** `meta` est persisté tel quel ; un 401 ou un format plus récent y resterait indéfiniment et bloquerait la synchronisation après le renouvellement du code ou la mise à jour.
- **Fix :** `saveSync` retire ces deux drapeaux et le chargement les efface (mémoire seulement, comme le plan l'indiquait pour `denied`, étendu à `outdated`).
- **Files modified:** js/app.js — **Commit:** `b46fcf6`

**4. [Rule 2 - Missing critical] Un échange abandonné par la course n'est pas un échec**
- **Found during:** Task 1/2
- **Issue :** l'`AbortError` de `raceTick` aurait compté un échec et déclenché un recul.
- **Fix :** `runSync` rend `{ skipped: 'course' }` sans toucher à `fails` quand une course est active.
- **Files modified:** js/archsync.js — **Commit:** `18a9710`, `b46fcf6`

**5. [Hors plan] Test existant mis à jour**
- `tests/regates.test.mjs` (reprise d'une fiche `snpm-2026`) attendait `validated: { by: 'Teiva', at: 1000 }` ; c'est précisément ce que la tâche 3 change (`{ by: null, at: SEED_AT }`). Ajout d'attentes pour une autre fiche, qui garde l'instant de reprise.
- Le commit `4af48c0` n'est pas une tâche du plan : il vient de la demande de l'orchestrateur.

**Total deviations:** 4 auto-corrigées (1 bug d'attente, 1 blocage de scénario, 2 manques critiques) + 1 écart de périmètre. **Impact :** aucune règle de D-03 / D-04 changée ; les écarts renforcent T-04-10 à T-04-12.

## Limites connues

- **`getMarks` / `setMarks`** ne transportent que l'objet `marks` du document (`SYNC.marksDoc`) sans toucher à `rade.marks.v1` : le branchement des recalages de bouées (D-05) est le plan 03.
- **Archive vide côté serveur** : tant qu'aucune régate n'est stockée, le serveur n'écrit rien (plan 01) et `rev` reste nul ; la lecture suivante n'est donc pas conditionnelle. Sans conséquence (un document vide).
- **Gel du vent** : le jour de régate, chaque copie du vent marque la régate « à envoyer » ; l'envoi suit la règle des 20 s, mais jamais pendant la course.
- **Ouverture** : aucune mesure de `tools/measure-boot.mjs` dans ce plan (prévue au plan 03) ; l'import est après `rt:map`, gardé par 5 tests.
- **Objets lourds** (traces, rapports, vent figé) : plan 04.

## Authentication Gates

Aucune.

## Contrôle humain restant

Tâche 2, `<human-check>` : deux iPhone sur l'aperçu (recette du plan 03) : A en mode avion crée une régate et ajoute une manche à une régate commune pendant que B ajoute la sienne ; retour du réseau ; puis chrono lancé sur A pendant que B modifie. Attendu : « Hors réseau · 2 modifications en attente » sur A, puis tout chez les deux, une seule fois ; « En pause pendant la course » pendant le chrono ; reprise dans la minute qui suit l'arrêt. Consigné dans `.planning/WINDOWS.md` (entrée 2, `unrun-verify`).

## Known Stubs

Aucun. (`SYNC.marksDoc` est un transport sans effet sur les bouées locales jusqu'au plan 03, documenté ci-dessus.)

## Threat Flags

Aucun nouveau périmètre hors du `<threat_model>` : le seul échange réseau ajouté est `/api/archive` (T-04-10 à T-04-16). Le journal ne reçoit que des nombres et des codes courts (`note('archive', …)`), jamais de contenu de régate ni de prénom ; aucun code d'accès ni empreinte dans les fichiers modifiés.

## Issues Encountered

Aucun blocage. Le seul imprévu : la contrainte de l'horloge fixée de Playwright (le serveur simulé doit suivre l'heure des téléphones, sinon il ramène leurs dates « futures » à la sienne) ; résolue par `avanceHeure` qui règle ensemble le serveur et les contextes.

## Next Phase Readiness

Prêt pour 04-03 (recalages de bouées partagés, aperçu Vercel réel, mesure d'ouverture) : `getMarks` / `setMarks` / `~marks` sont déjà dans `runSync`, `markDirty(SYNC, ['~marks'])` reste à brancher dans `recalMark` / `resetMark`.

## Self-Check: PASSED

- Fichiers présents : `js/archsync.js`, `tests/archsync.test.mjs`, `.planning/phases/04-archive-partagee/04-02-SUMMARY.md` ; `grep -c "stampState(REG" js/app.js` = 1, `import('./archsync.js')` = 1, `SEED_AT` dans `js/regates.js` = 6, `legacyStamp` dans `js/app.js` = 2, `rade.regates.v1.bak` = 1.
- Commits `4af48c0`, `18a9710`, `b46fcf6`, `6efc28b` : ancêtres de HEAD ; `git rev-list --count 6412bd6..HEAD` = 4.
- `npm run check` : 417 tests verts, SHELL à jour ; `git diff --quiet f80c365 -- js/courses.js tests/reference/` : inchangé ; `PW_REQUIRED=1 node tools/regate-e2e.mjs` : 14/14 OK.
