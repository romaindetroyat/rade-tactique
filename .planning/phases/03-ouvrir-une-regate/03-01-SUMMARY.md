---
phase: 03-ouvrir-une-regate
plan: 01
subsystem: regates
tags: [regates, localstorage, middleware, vercel, playwright, node-test, linkedom, pwa]

requires:
  - phase: 01-filet-de-securite
    provides: "racelock.js (parisClock, isRaceDay, lockState), middleware d'accès, garde « aucune erreur avalée »"
  - phase: 02-fiabilite-en-mer
    provides: "ouverture en deux temps (rt:ui / rt:map), tools/pw.mjs et tools/measure-boot.mjs, journal report()/note()"
provides:
  - "js/regates.js : modèle de régate pur (statut au jour de Paris, saison, reprise idempotente de rade.events.v1, création validée, manches, dates du verrou, auteur)"
  - "js/regview.js : vues HTML échappées (liste par saison, formulaire de création, fiche avec manches)"
  - "Onglet IC = carte « Régates » : création en trois champs, liste par saison puis par statut, manches avec parcours, « Choisir cette manche »"
  - "Verrou « journée de régate » lu dans la régate d'aujourd'hui (lockDates)"
  - "GET /api/membre (middleware) : prénom de l'équipier, no-store ; copie rade.membre.v1 hors réseau ; complément des by: null"
  - "tools/regate-e2e.mjs : scénarios creer, manche, auteur dans Chromium, codes de sortie stricts (fonction pure verdict)"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, phase-04]

actuals:
  tokens: 23221
  tasks: 3
  commits: 5
plan_head_before: cbde87de1703d8dd6ee88cdd3d873f3c119e9fc4
plan_head_after: 3a4858d3f17f0045e89a61805396bfe4facf3036

tech-stack:
  added: []
  patterns:
    - "Index synchrone localStorage rade.regates.v1 { v, current, list } lu au chargement du module ; IC = icOf(régate courante) garde la forme de l'ancien IC"
    - "Mises à jour d'état sans mutation (état gelé dans les tests) ; modules purs à stockage injecté"
    - "Brouillon de formulaire gardé en mémoire (rgDraft, raceDraft) et redessin automatique suspendu tant qu'un formulaire est ouvert (icBusy)"
    - "Outil de bout en bout : verdict() pur testé, import dynamique de pw.mjs après PW_REQUIRED=1, nom inconnu contrôlé avant tout lancement"

key-files:
  created:
    - js/regates.js
    - js/regview.js
    - tests/regates.test.mjs
    - tools/regate-e2e.mjs
  modified:
    - js/app.js
    - middleware.js
    - tests/access.test.mjs
    - styles.css
    - sw.js
    - js/version.js

key-decisions:
  - "Statut, verrou et saison calculés au jour de Paris (parisClock) ; saison = année civile du premier jour, stockée dans season"
  - "rade.events.v1 n'est jamais écrite ni effacée ; migrate() crée l'index une fois, sème la Coupe SNPM sur un appareil neuf"
  - "Auteur = réponse GET /api/membre du middleware, jamais le code ni l'empreinte ; copie rade.membre.v1 ; by: null complété au premier succès"
  - "La manche choisie est gardée dans la régate (sel) et suit sa place quand les manches sont renumérotées"
  - "Une régate peut être supprimée même si c'est la dernière (icOf(null) rend les valeurs communes) ; l'ancien garde-fou « plus d'une fiche » est retiré"

patterns-established:
  - "Porte de tâche par outil Chromium strict : 1 inconnu / aucun scénario / échec, 2 Chromium impossible, 0 seulement si chaque « OK <nom> » est affiché"
  - "Les marques performance sont relevées par une enveloppe posée après le script d'horloge de Playwright (window.__marks)"

requirements-completed: [REG-01, REG-02, ARCH-02]

coverage:
  - id: D1
    description: "Création d'une régate en trois champs (nom, premier jour, club ; dernier jour facultatif), validée, listée par saison puis Aujourd'hui / À venir / Passées au jour de Paris"
    requirement: REG-01
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#statut : minuit de Paris (heure d’hiver), régate du 7 au 9 novembre"
        status: pass
      - kind: unit
        ref: "tests/regates.test.mjs#création : champs manquants, date impossible, dernier jour antérieur ignoré, longueurs, identifiants distincts"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs creer"
        status: pass
    human_judgment: true
    rationale: "Durée réelle de saisie (moins d'une minute) et clavier de date sur iPhone : seul un équipier chronomètre en main peut la juger"
  - id: D2
    description: "Reprise automatique des fiches IC de rade.events.v1 en régates (clé d'origine intacte, idempotente) et semis de la Coupe SNPM sur un appareil neuf"
    requirement: REG-01
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#reprise : une fiche rade.events.v1 devient une régate (CVAT, VHF 72), sans toucher la clé d’origine, deuxième appel identique"
        status: pass
      - kind: unit
        ref: "tests/regates.test.mjs#semis : sur un appareil neuf, la Coupe SNPM est semée comme le faisait events.js (club CVAT, passée depuis le 19/10)"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs creer (fiche déposée avant le premier chargement)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Le verrou « journée de régate » (mise à jour différée, carte « Course finie ») lit les dates de la régate d'aujourd'hui, la courante en priorité"
    requirement: REG-01
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#verrou : la régate d’aujourd’hui commande, même si la courante est la Coupe SNPM ; sinon la courante"
        status: pass
      - kind: unit
        ref: "tests/regates.test.mjs#garde : le verrou lit les dates de la régate (raceLock et renderLive appellent lockDates), plus la seule fiche courante"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs creer : #raceDone présent le 07/11 et à 23 h 30 le 09/11, absent le 10/11"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plusieurs manches par journée, chacune avec heure de signal et parcours ; « Choisir cette manche » cale parcours, classe, tours, jour et départ (signal + 5 min)"
    requirement: REG-02
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#manche : raceSettings cale parcours, classe, tours, jour et départ = avertissement + 5 min ; sans heure, pas d’heure de départ"
        status: pass
      - kind: unit
        ref: "tests/regates.test.mjs#manche : numérotation par jour puis heure, deux manches le même jour, sans heure en dernier ; removeRace renumérote ; la manche choisie suit"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs manche"
        status: pass
    human_judgment: true
    rationale: "Lisibilité de la fiche et des sélecteurs à 375 px sur un iPhone réel"
  - id: D5
    description: "Auteur de chaque régate, manche et IC enregistrée : prénom donné par GET /api/membre, gardé hors réseau, complété au premier succès, jamais le code ni l'empreinte"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/access.test.mjs#GET /api/membre : 401 sans code ; avec un code valide simulé, le prénom seul (no-store), jamais le code ni l’empreinte ; le reste passe toujours"
        status: pass
      - kind: unit
        ref: "tests/regates.test.mjs#auteur : backfillAuthor complète les by: null (régates, manches, IC validées), compte, et ne remplace jamais un auteur posé"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs auteur"
        status: pass
    human_judgment: true
    rationale: "Le middleware réel de Vercel et les codes réels de l'équipage ne sont jamais utilisés dans les tests (middleware exécuté avec un code simulé)"
  - id: D6
    description: "Un nom, un club ou une note piégés (balise, guillemets, apostrophe) s'affichent en texte et n'exécutent rien"
    requirement: REG-01
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#vues : un nom ou un club piégé ne produit ni img ni script (liste, fiche, formulaire) ; l’apostrophe est échappée"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs creer (nom avec <img onerror>, window.__xss reste indéfini)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Outil de bout en bout aux codes de sortie stricts (1 inconnu / aucun scénario / échec, 2 Chromium impossible, 0 seulement si tous « OK »)"
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#verdict : nom inconnu → 1 (même sans Chromium) ; Chromium impossible → 2 ; aucun scénario → 1 ; 0 seulement si chaque scénario demandé est OK"
        status: pass
      - kind: other
        ref: "node tools/regate-e2e.mjs inconnu (1) ; creer inconnu (1) ; PW_CHROMIUM=/inexistant node tools/regate-e2e.mjs creer (2, « mesure impossible »)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 01 : Régates, manches et auteur Summary

**Une régate se crée en trois champs dans l'onglet IC, se range par saison puis par statut au jour de Paris, reçoit plusieurs manches (heure de signal et parcours) dont le choix cale le départ, commande le verrou de mise à jour, et chaque élément porte le prénom donné par `GET /api/membre` du middleware ; les fiches `rade.events.v1` deviennent des régates sans geste.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-19T20:03:00Z (estimé : l'heure de début n'a pas été relevée au lancement)
- **Completed:** 2026-10-19T20:23:00Z
- **Tasks:** 3 (1 traceur, 2 TDD)
- **Files modified:** 10 (4 créés, 6 modifiés) ; 5 commits de tâche mesurés (`plan_head_before` → `plan_head_after`)

## Accomplishments

- **Modèle de régate pur (`js/regates.js`)** : `regattaStatus` en jour de Paris (testé aux minuits de Paris, au changement d'heure du 25/10 et sans date), `lockDates`, `migrate` idempotente qui ne touche jamais `rade.events.v1` (octet pour octet) et sème la Coupe SNPM comme `eventsState()` le faisait, `createRegatta` validée, `icOf` qui garde la forme de l'ancien `IC` : le briefing, le jour 🏁, le chrono et le débrief ne changent pas.
- **Onglet IC = carte « Régates »** : « ＋ Nouvelle régate » (premier jour prérempli au jour de Paris), liste par saison puis Aujourd'hui / À venir / Passées, fiche de la régate courante, import et « Modifier » des IC qui écrivent dans la régate courante (la régate est créée depuis les IC s'il n'y en a pas). Un formulaire ouvert n'est plus redessiné par les mises à jour automatiques.
- **Manches (REG-02)** : ajout (validation par champ, parcours à préciser accepté), numérotation par jour puis heure, suppression en deux touches, « Choisir cette manche » qui cale parcours, classe, tours, jour et heure de départ = signal + 5 min ; la manche choisie (`sel`) est gardée avec la régate.
- **Auteur (D-05)** : `GET /api/membre` répond `{ membre }` en `no-store` (test sur le vrai middleware, code simulé, ni code ni empreinte dans le corps), `refreshMembre()` lancée après l'interface utile et jamais attendue, copie hors réseau `rade.membre.v1`, `backfillAuthor` complète les `by: null` sans jamais écraser un auteur posé, « Vous : prénom » dans la carte.
- **`tools/regate-e2e.mjs`** : trois scénarios réels dans Chromium (creer, manche, auteur) ; le verrou est vérifié sur le vrai écran (carte « Course finie » le 07/11 et à 23 h 30 le 09/11, absente le 10/11).

## Task Commits

1. **Task 1 : créer une régate, liste par saison et statut, verrou (tracer)** - `6e917e2` (feat)
2. **Task 2 : manches et « Choisir cette manche »** - RED `f0e0c17` (test), GREEN `4dbaa02` (feat)
3. **Task 3 : auteur par `/api/membre`** - RED `131a56b` (test), GREEN `3a4858d` (feat)

**Plan metadata:** commit `docs(03-01)` suivant (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## TDD Gate Compliance

- **Task 2 RED** (`f0e0c17`) : 4 tests échouent sur `R.addRace is not a function` / `R.raceSettings is not a function` (la fonction n'existe pas encore). `gsd_run check tdd-red-evidence` : `RED_EVIDENCE_OK` (`target_test_failed`, cible « manche : raceSettings cale parcours, classe, tours… »). Évaluation sémantique : le test cible s'exécute et échoue pour la raison prévue (fonction absente), pas par erreur de chargement (les fonctions sont lues par espace de noms `R.` pour que le fichier se charge).
- **Task 2 GREEN** (`4dbaa02`) : 20 tests verts dans `tests/regates.test.mjs`.
- **Task 3 RED** (`131a56b`) : 5 tests échouent (middleware qui transmet `/api/membre` au lieu de répondre, `R.membre / saveMembre / backfillAuthor` absentes, `refreshMembre` absente, `by: null` en dur). `RED_EVIDENCE_OK` sur « GET /api/membre : 401 sans code… » (assertion sur l'en-tête `content-type` : le middleware renvoyait un corps vide). Les fichiers d'évidence temporaires ont été supprimés après classement.
- **Task 3 GREEN** (`3a4858d`) : `tests/access.test.mjs`, `tests/regates.test.mjs`, `tests/boot.test.mjs` : 48 tests verts.
- Pas de REFACTOR : aucun nettoyage nécessaire.
- Les deux commits RED laissent volontairement `npm run check` rouge à ces deux points de l'historique.

## Résultats de vérification

- `npm run check` : stamp à jour, **188 tests, 0 échec** (base de départ 162 ; plan : 25 tests dans `tests/regates.test.mjs`, 1 nouveau test `/api/membre` + 1 chemin ajouté dans `tests/access.test.mjs`).
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` : sortie 0 (référence SNPM et `js/courses.js` inchangés).
- Sorties de l'outil de bout en bout :
  - `node tools/regate-e2e.mjs inconnu` : sortie 1, « scénario inconnu : inconnu (connus : creer, manche, auteur) » ; `creer inconnu` : sortie 1 sans lancer Chromium.
  - `PW_CHROMIUM=/inexistant node tools/regate-e2e.mjs creer` : sortie 2, « Playwright requis (PW_REQUIRED=1) : mesure impossible… » (jamais « mesure sautée »).
  - `PW_REQUIRED=1 node tools/regate-e2e.mjs creer manche auteur` :
    ```
    OK creer
    OK manche
    OK auteur
    Bilan : 3/3 scénario(s) OK
    ```
    sortie 0 (environ 20 s).
- **API d'horloge Playwright utilisée** (1.56.1) : `browserContext.clock.setFixedTime(date)` (sans `install` : les minuteries continuent de tourner), rappelée avant chaque rechargement pour passer du 07/11 09:30 au 09/11 23:30 puis au 10/11 08:30 (Paris).
- Ouverture inchangée : `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : médiane de l'interface utile **628 ms** (< 2000 ms ; 623 ms en fin de phase 2), `tests/boot.test.mjs` vert (aucun `await` avant `rt:ui`).

## Files Created/Modified

- `js/regates.js` - modèle pur : statut, saison, verrou, reprise, création, manches, auteur
- `js/regview.js` - liste par saison, formulaire, fiche avec manches (tout texte par `escHTML`, attributs entre guillemets doubles)
- `tests/regates.test.mjs` - 25 tests : statuts, reprise, création, manches, auteur, vues (linkedom), gardes statiques, `verdict`
- `tools/regate-e2e.mjs` - scénarios creer / manche / auteur, `verdict` pur exporté
- `js/app.js` - index lu au chargement, `saveReg`, `who`, `refreshMembre`, `chooseRace`, carte « Régates », verrou par `lockDates`
- `middleware.js` - `GET /api/membre` (prénom seul, `no-store`)
- `tests/access.test.mjs` - test `/api/membre` (code simulé, empreinte lue à l'exécution et jamais affichée) et chemin ajouté au test « sans code »
- `styles.css` - liste des régates, fiche, manches, champ date
- `sw.js`, `js/version.js` - générés par `npm run stamp` (nouveaux modules dans la liste hors réseau)

## Decisions Made

- La saison est l'année civile du premier jour (hypothèse A1), stockée dans `season`.
- `rade.events.v1` reste en place, jamais écrite : retour arrière possible.
- La régate peut être supprimée même si c'est la dernière ; `icOf(null)` rend les valeurs communes CVAT et la fiche invite à en créer une.
- Quand le formulaire d'IC enregistré a une date vide, la régate garde son premier jour (une date vidée ne retire pas son jour à la régate).
- Le premier jour de « Nouvelle régate » est prérempli au jour de Paris : un équipier qui crée la régate du jour n'a que le nom (et le club) à saisir.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] L'horloge de Playwright vide `performance.mark`**
- **Found during:** Task 1 (outil de bout en bout)
- **Issue:** sous `clock.setFixedTime`, `performance.mark` devient une fonction vide : la marque `rt:map`, seul signal « l'app est prête », n'existait plus et le scénario expirait à 90 s.
- **Fix:** l'horloge est posée avant le script d'initialisation de l'outil, qui enveloppe `performance.mark` et range les noms dans `window.__marks` ; la préparation attend `rt:map` dans cette liste. Le seed de `rade.events.v1` avant le premier chargement se fait sur `data/meta.json` (une page 404 fait échouer `goto`).
- **Files modified:** `tools/regate-e2e.mjs`
- **Verification:** `PW_REQUIRED=1 node tools/regate-e2e.mjs creer` : OK
- **Committed in:** `6e917e2`

**2. [Rule 2 - Missing critical] Un formulaire ouvert était redessiné sous les doigts de l'équipier**
- **Found during:** Task 1 (écriture du formulaire « Nouvelle régate »)
- **Issue:** `updateAll()` rappelle `renderIC()` quand les prévisions arrivent : la saisie en cours (et le clavier) aurait été perdue, au détriment de « moins d'une minute ».
- **Fix:** brouillons gardés en mémoire (`rgDraft`, `raceDraft`, synchronisés sur `input` et `change`) et `updateAll()` ne redessine plus l'onglet tant qu'un formulaire est ouvert (`icBusy`). Vaut aussi pour le formulaire d'IC existant.
- **Files modified:** `js/app.js`
- **Verification:** scénarios `creer` et `manche` (saisie pendant le chargement des prévisions)
- **Committed in:** `6e917e2`, `4dbaa02`

**3. [Rule 1 - Bug] « 1er avertissement undefined » dans le briefing**
- **Found during:** Task 1 (régate sans IC)
- **Issue:** le jour 🏁 d'une régate créée en trois champs (sans IC) aurait affiché « 1er avertissement undefined · arrivée limite undefined · VHF undefined ».
- **Fix:** `icOf` donne des valeurs vides par défaut et le briefing n'affiche que les éléments connus (échappés).
- **Files modified:** `js/regates.js`, `js/app.js`
- **Verification:** test `icOf` (régate sans IC) ; revue du gabarit
- **Committed in:** `6e917e2`

---

**Total deviations:** 3 auto-fixed (1 blocage d'outil, 1 fonctionnalité critique manquante, 1 bug)
**Impact on plan:** nécessaires à la correction et à l'objectif « moins d'une minute » ; aucune extension de périmètre.

## Issues Encountered

- Les fonctions de mise à jour ne couvrent pas encore le gel, les traces ni les bouées : le plan ne les demandait pas (plans 03 à 06).
- Les points qui demandent un iPhone ou le middleware réel de Vercel restent au vérificateur de fin de phase (voir « Contrôles humains »).

## Contrôles humains reportés à la fin de phase (`<human-check>` du plan, non bloquants)

- **Tâche 1 :** sur l'iPhone d'un équipier autre que Romain, créer une régate (nom, date du jour, « CVAT ») chronomètre en main (moins d'une minute attendue) puis une régate du mois prochain ; la régate du jour sous « Aujourd'hui », l'autre sous « À venir », la Coupe SNPM sous « Passées » dans « Saison 2026 » ; relancer l'app ; après 9 h le jour de régate, la carte « Course finie » est dans En course.
- **Tâche 2 :** ajouter deux manches, choisir la seconde, ouvrir Parcours puis Départ : parcours, classe, tours et heure calés ; fiche lisible à 375 px.
- **Tâche 3 :** sur l'aperçu avec les codes de Teiva puis de Thibaud : « par Teiva » / « par Thibaud » ; hors réseau la première fois « — », complété au retour du réseau ; aucun code ni empreinte visibles nulle part.

## Known Stubs

Aucun. (Les attributs `placeholder` du formulaire sont des indications de saisie, pas des données.)

## Threat Flags

Aucun nouveau point d'entrée hors modèle de menaces : `GET /api/membre` est T-03-03 (réponse limitée au prénom, `no-store`, seulement après un code valide, testée sur le vrai middleware). Rappel T-03-02 : l'auteur reste une étiquette côté client (identité serveur en phase 4).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Prêt pour 03-02 : la régate porte `ic` (`fields`, `text`, `source`, `read`, `excerpts`, `validated`) et `icOf` ; l'import actuel (`parseIC`) écrit déjà dans la régate courante avec `by: who()`.
- `sel` (manche choisie) et `races[].time` sont disponibles pour le sceau du gel (plan 03) et le départage des traces (plan 04).
- L'ancien code de fiches de `js/events.js` (`eventsState`, `upsertEvent`…) n'est plus appelé ; son retrait et celui de l'ancien formulaire restent au plan 05.
- Rien d'arrêtant. Version affichée toujours v27 : la publication v28 est au plan 07.

## Self-Check: PASSED

- Fichiers présents : `js/regates.js`, `js/regview.js`, `tests/regates.test.mjs`, `tools/regate-e2e.mjs`, `middleware.js`, `tests/access.test.mjs`, `js/app.js`, `sw.js`, `js/version.js`.
- Commits présents sur la branche `apercu-phase-03` : `6e917e2`, `f0e0c17`, `4dbaa02`, `131a56b`, `3a4858d`.
- Critères d'acceptation relancés après le dernier commit : `grep -c "lockDates("` = 2, `grep -c "migrate({"` = 1, `grep -c "escHTML("` = 22, `grep -c "raceSettings("` = 1, `/api/membre` dans `middleware.js` = 1, `fetch('/api/membre'` dans `js/app.js` = 1, aucune chaîne hexadécimale de 64 caractères dans les tests ni l'outil, `npm run check` vert, référence SNPM inchangée.

---
*Phase: 03-ouvrir-une-regate*
*Completed: 2026-10-19*
