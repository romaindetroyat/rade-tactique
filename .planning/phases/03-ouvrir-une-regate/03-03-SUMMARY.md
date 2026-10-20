---
phase: 03-ouvrir-une-regate
plan: 03
subsystem: gel
tags: [gel, vent, previsions, indexeddb, stratégie, debrief, node-test, linkedom, playwright, pwa]

requires:
  - phase: 03-ouvrir-une-regate
    provides: "régate courante (todayRegatta, upsertRegatta, daysOf), manches avec heure de signal, forme r.ic, auteur membre(), escHTML, byLine, tools/regate-e2e.mjs"
  - phase: 02-fiabilite-en-mer
    provides: "ouverture en deux temps (rt:ui / rt:map), report() / note(), séquence de départ (autoHeavy), garde de tests/boot.test.mjs"
provides:
  - "js/gel.js : politique de gel pure (sceau, décision, découpe des prévisions, résumé, route conseillée compacte, source du vent d'une trace)"
  - "js/regstore.js : base IndexedDB rade-regates (putSlot / getSlot), séparée de la base des traces"
  - "Gel automatique du vent du jour (prévisions du jour + relevés + route conseillée) à l'ouverture, après chaque téléchargement, chaque analyse et chaque tic de raceTick"
  - "Fiche de régate : section « Vent du jour » (heure du gel, prévisions, modèle, relevés, vent au signal, état du sceau, route conseillée figée, auteur)"
  - "Analyse d'une trace et questionnaire du débrief sur le vent figé du jour quand les prévisions vivantes ne couvrent plus ce jour, avec le libellé de la source"
  - "tools/regate-e2e.mjs : scénarios gel et debrief-tardif dans Chromium"
affects: [03-04, 03-05, phase-04]

actuals:
  tokens: 22494
  tasks: 2
  commits: 3
plan_head_before: 66d703535e2c5f59a0895b54740e6dc2b09e64ec
plan_head_after: d6e5c3c75c5c13cb71f4ba4d2ea0402e953e483c

tech-stack:
  added: []
  patterns:
    - "Le gel copie, il ne calcule pas : une seule copie à la fois, lancée par setTimeout(0), jamais à travers autoHeavy / deferHeavy"
    - "Index léger en localStorage (résumé frozen[jour], détail des bords compris) et données lourdes en IndexedDB : la fiche s'affiche sans attendre la base"
    - "Source du vent d'une trace : vivante si son jour figure dans les prévisions, sinon figée, sinon vent manuel annoncé comme tel"
    - "Calcul des résidus de relevés extrait en fonction paramétrée (residualsFor) : même résultat pour le jour courant et pour un vent figé"

key-files:
  created:
    - js/gel.js
    - js/regstore.js
    - tests/gel.test.mjs
  modified:
    - js/regview.js
    - js/app.js
    - tools/regate-e2e.mjs
    - styles.css
    - sw.js
    - js/version.js

key-decisions:
  - "Sceau : la manche la plus tôt du jour qui a une heure, sinon l'heure des IC le premier jour, sinon la fin du dernier jour de la régate à Paris (signal « inconnu ») ; jamais de jour sans sceau"
  - "Un gel n'est décidé que pour le jour de Paris de « maintenant » : un jour passé n'est ni copié ni scellé après coup (la fiche dit « dernière copie avant le signal » ou « Pas de vent figé ce jour-là »)"
  - "La route conseillée figée est la dernière analyse déjà faite pour ce jour (aucun calcul lancé pour geler) ; elle arrive dès la fin de l'analyse sans attendre 10 minutes, et une copie tardive la reçoit une seule fois"
  - "Une écriture refusée par la base n'écrit pas de résumé (la fiche ne ment pas) et le nouvel essai attend 10 minutes ; l'app et le chrono continuent"
  - "Le vent manuel choisi dans l'onglet Vent reste prioritaire pour l'analyse d'une trace, comme avant, et le détail de la trace le dit"

patterns-established:
  - "RED d'un module enrichi : fonctions lues par espace de noms (G.), l'échec porte sur « is not a function », pas sur le chargement"
  - "Contrôle négatif dans le scénario de bout en bout : sans le gel, le même débrief retombe sur le vent manuel annoncé et ne pré-remplit rien"

requirements-completed: []

coverage:
  - id: D1
    description: "Le jour de régate, sans geste, l'app copie dans la régate les prévisions du jour (25 heures) et les relevés du jour : à l'ouverture, après chaque téléchargement, chaque analyse, au plus toutes les 10 minutes, y compris hors réseau depuis le cache ou l'instantané embarqué"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/gel.test.mjs#décision : copie, nouvelles prévisions, 10 min, sceau, scellé, première ouverture après le signal"
        status: pass
      - kind: unit
        ref: "tests/gel.test.mjs#découpe : modelPoints, scoreModels et consensus donnent les mêmes résultats que sur l’original (9 h, 11 h 30, 23 h 30)"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs gel (base rade-regates : wx de 25 heures et obs, aucun réseau)"
        status: pass
    human_judgment: true
    rationale: "Cycle réel d'une journée sur iPhone (app fermée, rouverte, hors réseau)"
  - id: D2
    description: "Sceau au premier signal du jour (manche la plus tôt, sinon IC), ensuite prévisions et route ne bougent plus ; relevés copiés jusqu'au soir ; première ouverture après le signal = « figé après le départ »"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/gel.test.mjs#sceau : une manche à 11:00 le 7/11 (heure d’hiver) scelle à 10:00Z…"
        status: pass
      - kind: unit
        ref: "tests/gel.test.mjs#relevés : copiés tant que leur nombre ou leur dernier instant change, même scellé"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs gel (sceau à 11:00 « scellé au signal de 10:55 », rien ne bouge ensuite ; ouverture à 11:30 : late et « figé après le départ »)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Régate sans heure de manche ni IC : copiée toute la journée, scellée à la fin de son dernier jour (minuit de Paris), fiche « signal inconnu »"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/gel.test.mjs#sceau, signal inconnu : fin du dernier jour de la régate à Paris (minuit), signal « inconnu »…"
        status: pass
      - kind: unit
        ref: "tests/gel.test.mjs#vue : signal inconnu, copie jusqu’à la fin de la régate puis scellé à la fin de la régate"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs gel (régate « Sortie sans heure » du 19/10 : signal inconnu, sealAt 22:00Z, « 19/10 à 24:00 »)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Route conseillée du jour figée avec ses réglages, positions en latitude / longitude, en moins de 12 Ko, détail des bords visible dans la fiche sans requête"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/gel.test.mjs#stratégie compacte : parcours 5, classe G, 2 tours, vent 315° 15 nd sur le vrai terrain"
        status: pass
      - kind: unit
        ref: "tests/gel.test.mjs#vue : la route conseillée figée (parcours, classe, tours, départ, bords, temps) et le détail des bords, sans requête"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs gel (clé strat en base, ≤ 12 000 octets, lat/lon, détail des bords dans la fiche)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Deux jours ou plus après la course, l'analyse de la trace et le questionnaire du débrief utilisent le vent figé du jour au lieu du vent manuel et le disent"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/gel.test.mjs#source du vent : prévisions vivantes si le jour y figure, sinon le gel du jour, sinon rien"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs debrief-tardif (25/10 : « vent du jour figé le 18/10 à 10:00 », #dqWind rempli d'une direction figée, « Pré-rempli avec … figé le 18/10 » ; sans gel : vent manuel annoncé, rien de pré-rempli)"
        status: pass
    human_judgment: true
    rationale: "Débrief réel d'une sortie de l'équipage, comparé à ce qui a été vécu sur l'eau"
  - id: D6
    description: "Le gel ne retarde ni l'ouverture ni le chrono : aucune attente avant l'interface utile, pas de calcul, une copie à la fois, jamais reporté pendant la séquence de départ, échec consigné sans gêner l'app"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/gel.test.mjs#garde : freezeTick copie sans calcul, une copie à la fois, ne passe jamais par autoHeavy et ne précède pas l’interface utile"
        status: pass
      - kind: unit
        ref: "tests/boot.test.mjs (aucun await avant rt:ui) et npm run check"
        status: pass
      - kind: other
        ref: "PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 : médiane de l'interface utile 586 ms (577 ms au plan 02)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Un nom, un auteur ou un modèle venus d'ailleurs s'affichent en texte dans la section « Vent du jour » et n'exécutent rien"
    requirement: ARCH-02
    verification:
      - kind: unit
        ref: "tests/gel.test.mjs#vue : l’auteur et les noms venus d’ailleurs sont échappés ; sans auteur : « — »"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 03 : Vent et route du jour figés sans geste Summary

**Le jour d'une régate, l'app copie seule dans la régate les prévisions du jour (25 heures, 38,8 Ko), les relevés de vent et la route conseillée (11,9 Ko pour 15 bords), les scelle au premier signal (ou à la fin de la régate si l'heure est inconnue), les montre dans la fiche avec leur auteur, et l'analyse ou le débrief d'une trace deux jours plus tard s'appuient sur ce vent figé au lieu du vent manuel, en le disant.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-19T20:41:39Z
- **Completed:** 2026-10-19T21:07:00Z
- **Tasks:** 2 (1 traceur, 1 TDD)
- **Files modified:** 9 (3 créés, 6 modifiés) ; 3 commits de tâche mesurés (`plan_head_before` → `plan_head_after`)

## Accomplishments

- **Politique de gel pure (`js/gel.js`)** : `sealAt` rend `{ at, signal }` avec `signal` = `manche` | `ic` | `inconnu` (testé en heure d'hiver, en heure d'été, à la veille du passage à l'heure d'hiver ; `2026-11-09T23:00:00Z` pour une régate du 7 au 9 novembre, `2026-10-19T22:00:00Z` pour le seul 19/10) ; `freezeAction` rend `rien | gel | sceau | tard` ; `sliceDays` garde l'heure 00:00 qui suit (25 valeurs) et laisse `modelPoints`, `scoreModels` et `consensus` strictement identiques à 9 h, 11 h 30 et 23 h 30.
- **Base `rade-regates` (`js/regstore.js`)** : version 1, magasin `slots` à clés explicites (`<id>|<jour>|wx | obs | strat`), connexion partagée, erreurs remontées à l'appelant.
- **Gel câblé sans rien attendre (`js/app.js`)** : `freezeTick` à l'ouverture (après `rt:map`, prévisions du cache ou embarquées donc aussi hors réseau), après un téléchargement réussi, à la fin de chaque analyse et dans `raceTick` ; copie seule, une à la fois, par `setTimeout(0)` ; échec consigné par `report('gel', …)`, nouvel essai au plus toutes les 10 minutes.
- **Fiche de régate** : section « Vent du jour », une entrée par jour de la régate : « Figé automatiquement à HH:MM », prévisions (« embarquées » pour l'instantané), modèle, nombre de relevés, vent prévu au signal, « scellé au signal de HH:MM » / « figé après le départ » / « signal inconnu : copie jusqu'à la fin de la régate (JJ/MM à 24:00) » puis « scellé à la fin de la régate (signal inconnu) », route conseillée figée avec son détail des bords dans un `<details>`, auteur. Construite depuis le seul résumé de l'index : elle s'affiche sans attendre IndexedDB.
- **Route conseillée figée** : réglages inclus (parcours, classe, tours, longueur de bord au vent, heure de départ, ligne, polaire, modèle, source de vent, manche choisie), positions en latitude / longitude, chemin décimé d'un point sur trois.
- **Débrief tardif** : `windSource(jour)` choisit prévisions vivantes, vent figé (prévisions et relevés relus de la base, résidus recalculés par le même `residualsFor` que `refreshObs`) ou vent manuel annoncé ; `showTrace` et `runDebrief` partagent la source ; le détail de la trace affiche « Vent de l'analyse : vent du jour figé le 18/10 à 10:00 » ; le questionnaire écrit « Pré-rempli avec la prévision (vent du jour figé le 18/10 à 10:00) ». `js/debrief.js` n'est pas touché.

## Mesures

- **Prévisions découpées au 18/10/2026** : **38 843 octets** (25 heures, 24 points de grille, mer) contre 87 720 pour le fichier de 3 jours ; ≈ 39 Ko par jour de régate (recherche : 38 803).
- **Route conseillée compacte** (parcours 5, classe G, 2 tours, 15 bords, vent 315° 15 nd, relief réel) : **11 921 octets** (limite 12 000) ; chemin brut 493 points, décimé en un sur trois : 3 398 octets de chemin. Le **résumé de l'index** avec le détail des bords : 4 108 octets. Si une analyse dépassait la limite, la décimation passe à 4, 6, 12 puis supprime le chemin, sans perdre de bord (testé avec 15 bords de 3 000 points et 10 conseils de 500 caractères).
- **Ouverture** : `tools/measure-boot.mjs 4 5` : médiane de l'interface utile **586 ms** (< 2 000 ms ; 577 ms au plan 02).

## Task Commits

1. **Task 1 : le vent du jour est figé seul dans la régate, scellé au premier signal, la fiche le montre (traceur)** - `07def46` (feat)
2. **Task 2 : route conseillée figée, analyse et débrief tardifs sur le vent figé** - RED `58e332a` (test), GREEN `d6e5c3c` (feat)

**Plan metadata:** commit `docs(03-03)` suivant (SUMMARY, STATE, ROADMAP).

## Tracer feedback gate

Mode `yolo` (« continue sans t'arrêter », pas de point d'arrêt humain) : après le commit du traceur, la vérification automatisée a été rejouée de bout en bout (tests `gel` et `boot`, `node --check`, `npm run check` 240 tests, `PW_REQUIRED=1 node tools/regate-e2e.mjs gel` : OK). ⚡ Tracer verified end-to-end — expanding.

## TDD Gate Compliance

- **Task 2 RED** (`58e332a`) : 8 tests de `tests/gel.test.mjs` échouent (18 passent) ; `gsd_run check tdd-red-evidence` : `RED_EVIDENCE_OK` (`target_test_failed`, cible « stratégie compacte : parcours 5, classe G, 2 tours, vent 315° 15 nd sur le vrai terrain »). Évaluation sémantique : la cible s'exécute (analyse construite sur le vrai terrain par `buildLegs` + `analyzeLeg`, comme `runAnalysis`) et échoue parce que la fonction n'existe pas encore (`G.compactStrategy is not a function`), pas par une erreur de chargement (fonctions lues par espace de noms `G.`). Le fichier d'évidence temporaire a été supprimé après classement.
- **Task 2 GREEN** (`d6e5c3c`) : 26 tests verts dans `tests/gel.test.mjs`, `npm run check` 248 tests.
- Pas de REFACTOR : aucun nettoyage nécessaire.
- Le commit RED laisse volontairement `npm run check` rouge à ce point de l'historique.
- La tâche 1 est un traceur (non TDD) : ses tests ont été écrits avec le code dans le même commit ; seul le garde statique du câblage de `js/app.js` était rouge avant le câblage.

## Résultats de vérification

- `npm run check` : stamp à jour, **248 tests, 0 échec** (222 au plan 02 : +26 dans `tests/gel.test.mjs`).
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` et `git diff --quiet f80c365 -- js/debrief.js` : sortie 0 (référence SNPM, parcours et débrief inchangés).
- Critères d'acceptation relancés : `grep -c "freezeTick(" js/app.js` = 6 (définition, ouverture, téléchargement, analyse, raceTick, reprise), `grep -c "putSlot(" js/app.js` = 3 (prévisions, route, relevés), `grep -c "compactStrategy(" js/app.js` = 1, `grep -c "windSourceKind(" js/app.js` = 1 ; `tests/gel.test.mjs` : 26 tests (≥ 18).
- Sortie de l'outil de bout en bout, tous scénarios des plans 01 à 03 :
  ```
  OK creer
  OK manche
  OK auteur
  OK ic
  OK vraisemblance
  OK gel
  OK debrief-tardif
  Bilan : 7/7 scénario(s) OK
  ```
  sortie 0 (2 min 30).
- Aucune chaîne hexadécimale de 64 caractères dans les fichiers du plan ; aucun code d'accès.
- Version affichée toujours v27 : la publication v28 est au plan 05 (`npm run stamp` fait après chaque tâche).

## Files Created/Modified

- `js/gel.js` - politique de gel pure : `sealAt`, `freezeAction`, `obsNeedsCopy`, `stratNeedsCopy`, `sliceDays`, `windAtHour`, `compactStrategy`, `strategySummary`, `freezeSummary`, `windSourceKind`, `frozenLabel`
- `js/regstore.js` - base IndexedDB `rade-regates` : `putSlot`, `getSlot`
- `tests/gel.test.mjs` - 26 tests : sceau, décisions, découpe, résumé, vues, stratégie, source du vent, gardes statiques
- `js/regview.js` - section « Vent du jour » (`windSectionHTML`) dans la fiche, route conseillée figée et détail des bords
- `js/app.js` - `freezeTick` / `freezeWrite`, `residualsFor`, `windSource`, `trackWindAt(day, src)`, `forecastIn`, `showTrace` / `runDebrief` / `renderTraceDetail` sur la source du vent
- `tools/regate-e2e.mjs` - scénarios `gel` (trois contextes : avant et au signal, ouverture tardive, signal inconnu) et `debrief-tardif` (avec contrôle négatif)
- `styles.css` - section « Vent du jour »
- `sw.js`, `js/version.js` - générés par `npm run stamp` (nouveaux modules dans la liste hors réseau)

## Decisions Made

- Le sceau retient la manche la plus tôt du jour qui a une heure, sinon l'heure des IC le premier jour (le plan : « manche la plus tôt, sinon l'heure des IC »), sinon la fin de la régate.
- `freezeAction` ne décide que pour le jour de Paris de « maintenant » : le lendemain d'une régate à signal inconnu, ou un jour passé, la réponse est toujours `rien`.
- Une copie dont l'écriture échoue n'écrit pas de résumé dans l'index : la fiche ne prétend pas avoir figé ce qui n'est pas en base.
- Le résumé de l'index porte le détail des bords (4 Ko) : la fiche l'ouvre sans requête, comme le plan l'exige.
- Les heures de `trackWindAt` et `forecastAt` suivent désormais le fuseau de Paris (`parisClock`), comme les prévisions téléchargées, et non celui du téléphone (identique pour les iPhone de l'équipage).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Le garde de `tests/boot.test.mjs` exige `fieldKey = null` dans `refreshObs`**
- **Found during:** Task 2 (extraction de `residualsFor`)
- **Issue:** le calcul des résidus, déplacé dans `residualsFor`, remettait `fieldKey` à `null` hors de `refreshObs`, et le garde « computeField mémoïsé » (plan 02 de la phase 2) lit `refreshObs` à la lettre.
- **Fix:** `refreshObs` remet aussi la clé à `null` quand des résidus existent (même condition qu'avant : seulement si un relevé a été traité), sans toucher au test ; `residualsFor` le fait lui-même pour le vent figé.
- **Files modified:** `js/app.js`
- **Verification:** `tests/boot.test.mjs` vert ; ouverture 586 ms (pas de recalcul superflu du champ)
- **Commit:** `d6e5c3c`

**2. [Rule 2 - Missing critical] La route conseillée arrivait jusqu'à 10 minutes après la première copie, et jamais pour une copie tardive**
- **Found during:** Task 2 (câblage de `runAnalysis`)
- **Issue:** à l'ouverture, la première copie précède la fin de la première analyse ; avec la seule cadence de 10 minutes, `…|strat` n'existait pas avant 10 minutes, et une ouverture après le signal (copie scellée d'emblée) ne l'aurait jamais reçue.
- **Fix:** `freezeAction` rend `gel` dès que l'analyse du jour est prête et que le résumé n'a pas encore de route ; `stratNeedsCopy` complète une copie tardive une seule fois ; une copie sans analyse garde la route déjà figée.
- **Files modified:** `js/gel.js`, `js/app.js`, `tests/gel.test.mjs`
- **Verification:** `tests/gel.test.mjs#décision : la route conseillée arrive après la première copie…`, scénario `gel`
- **Commit:** `58e332a`, `d6e5c3c`

**3. [Rule 2 - Missing critical] Un jour passé aurait pu être « scellé » ou copié après coup**
- **Found during:** Task 1 (écriture de `freezeAction`)
- **Issue:** appelée avec un jour déjà fini, la fonction aurait rendu `sceau` ou `tard` (l'instant du sceau est passé) et copié les prévisions d'aujourd'hui sous la clé d'hier.
- **Fix:** `freezeAction` rend `rien` si `day` n'est pas le jour de Paris de `now` ; la fiche dit « dernière copie avant le signal » (app fermée au signal) ou « Pas de vent figé ce jour-là ».
- **Files modified:** `js/gel.js`, `js/regview.js`
- **Verification:** `tests/gel.test.mjs#décision…` (jour passé), `…#vue : scellé au signal, figé après le départ…`
- **Commit:** `07def46`

**4. [Rule 2 - Missing critical] Écriture refusée par la base : ne pas écrire un résumé qui mentirait, ne pas réessayer toutes les 5 secondes**
- **Found during:** Task 1 (menace T-03-12)
- **Issue:** `raceTick` appelle le gel toutes les 5 s ; une base pleine ou refusée aurait relancé une copie à chaque tic, et un résumé écrit malgré l'échec aurait fait croire à un gel.
- **Fix:** le résumé n'est écrit qu'après les écritures de la base ; un échec est consigné (`report('gel', …)`) et le nouvel essai attend 10 minutes.
- **Files modified:** `js/app.js`
- **Verification:** garde statique `report('gel'` et `freezeBusy` ; revue du code
- **Commit:** `07def46`

**5. [Rule 1 - Bug] Un auteur piégé aurait été du HTML dans une balise `<b>` de la section**
- **Found during:** Task 1 (test existant des vues piégées de `tests/regates.test.mjs`)
- **Issue:** la section utilisait `<b>` pour le titre du jour ; le test existant refuse toute balise `b` (l'auteur piégé de ce test en contient une).
- **Fix:** balises neutres (`span.rgdn`, `span.rgwf`), mises en gras par `styles.css`.
- **Files modified:** `js/regview.js`, `styles.css`
- **Verification:** `npm run check` vert
- **Commit:** `07def46`

**6. [Interprétation du plan] Heures de Paris, vent manuel choisi, contrôle négatif**
- **Found during:** Task 2
- **Issue:** le plan demande « jour de la trace par `parisClock(tr.start)` » ; le fuseau du téléphone restait utilisé pour l'heure de la trace et de la prévision. Le choix « vent manuel » de l'onglet Vent devait rester prioritaire, comme dans l'ancien `trackWindAt`.
- **Fix:** `trackWindAt` et `forecastIn` lisent l'heure de Paris ; `windSource` rend le vent manuel (annoncé « réglé dans l'onglet Vent ») quand `S.src` vaut `manual`. Le scénario `debrief-tardif` ajoute un contrôle négatif (sans gel : vent manuel annoncé et champ vide).
- **Files modified:** `js/app.js`, `tools/regate-e2e.mjs`
- **Verification:** scénario `debrief-tardif`
- **Commit:** `d6e5c3c`

---

**Total deviations:** 6 (4 fonctionnalités critiques ajoutées, 1 blocage, 1 bug ; interprétation comprise)
**Impact on plan:** nécessaires à la justesse du gel et à sa sobriété sur l'eau ; aucune extension de périmètre.

## Issues Encountered

- Aucun blocage. La route conseillée du parcours 5 en 2 tours pèse 11 921 octets pour une limite de 12 000 : la marge est mince, d'où la dégradation progressive (décimation, conseils raccourcis) déjà testée ; un parcours plus long l'utiliserait.
- Le vent figé relit les relevés de la base et recalcule leurs résidus avec `F.compute` : `F` est alors repositionné sur le dernier relevé, comme le fait déjà le débrief (`fieldKey = null`) ; une analyse en cours au même instant serait recalculée au geste suivant (cas rare, déjà possible avant le plan).
- Les points qui demandent un iPhone restent au vérificateur de fin de phase (voir « Contrôles humains »).

## Contrôles humains reportés à la fin de phase (`<human-check>` du plan, non bloquants)

- **Tâche 1 :** le jour d'une régate (ou d'un entraînement créé comme régate du jour avec une manche), ouvrir l'app le matin, puis après le premier signal, puis en mode avion ; ouvrir la fiche. Attendu : « Figé automatiquement à HH:MM » le matin, « scellé au signal de HH:MM » après le signal ; en mode avion la copie se fait aussi (prévisions du cache, heure affichée) ; aucun bouton touché pour cela.
- **Tâche 2 :** deux jours après une sortie dont le vent a été figé, importer sa trace, ouvrir son détail, lancer le débrief. Attendu : « vent du jour figé le JJ/MM à HH:MM » ; vent au départ pré-rempli d'après le gel, pas 315° 15 nd ; la fiche montre la route conseillée figée du jour.

## Known Stubs

Aucun. (Les messages « Pas encore figé » et « Route conseillée : pas encore figée » sont des états réels de l'interface avant la première copie, pas des données manquantes.)

## Threat Flags

Aucun nouveau point d'entrée hors modèle de menaces. T-03-10 (gel qui gênerait le départ : copie sans calcul, une à la fois, `setTimeout(0)`, aucune attente avant `rt:ui`, jamais par `autoHeavy`, garde statique ; la mesure des bips est refaite au plan 05), T-03-11 (vent présenté sans origine : heure du gel, heure des prévisions, « embarquées », « figé après le départ », auteur et libellé de source toujours affichés), T-03-12 (base refusée : erreur consignée, pas de résumé mensonger, résumé de l'index lisible sans la base) et T-03-13 (`js/debrief.js`, `js/courses.js` et `tests/reference/` inchangés, vérifié par `git diff --quiet f80c365`) sont couverts. Aucune installation de paquet (T-03-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Prêt pour 03-04 : `regattaStatus`/`daysOf` et `windSource(jour)` sont disponibles pour rattacher un GPX à la régate du jour et lancer le débrief sur le même vent ; la fiche accueille la section « Traces » à côté de « Vent du jour » ; `tr.start` est lu en jour de Paris.
- Prêt pour 03-05 : le plan doit refaire la mesure des bips (`PW_REQUIRED=1 node tools/audio-clock-check.mjs`, T-03-10) et la mesure d'ouverture avec le gel actif ; le libellé d'onglet, le guide et l'aide (`js/help.js`, `guide.html`) doivent décrire le gel automatique.
- ARCH-02 reste « Pending » dans REQUIREMENTS.md : ce plan en livre la partie vent et stratégie ; les traces, l'analyse polaire et le rapport de la fiche sont au plan 04.
- Rien d'arrêtant. Version affichée toujours v27 : la publication v28 est au plan 05.

## Self-Check: PASSED

- Fichiers présents : `js/gel.js`, `js/regstore.js`, `tests/gel.test.mjs`, `js/regview.js`, `js/app.js`, `tools/regate-e2e.mjs`, `styles.css`, `sw.js`, `js/version.js`.
- Commits présents sur la branche `apercu-phase-03` : `07def46`, `58e332a`, `d6e5c3c` (3 commits mesurés par `git rev-list --count`).
- Critères d'acceptation relancés après le dernier commit : `npm run check` vert (248 tests), `PW_REQUIRED=1 node tools/regate-e2e.mjs` 7/7 OK, référence SNPM, `js/courses.js` et `js/debrief.js` inchangés, aucun code d'accès ni empreinte dans les fichiers du plan.

---
*Phase: 03-ouvrir-une-regate*
*Completed: 2026-10-19*
