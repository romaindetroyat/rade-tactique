---
phase: 02-fiable-et-juste-en-mer
plan: 03
subsystem: ouverture-rapide
tags: [ouverture, interface-utile, import-differe, scene3d, wind-field, generateur, memoisation, pause-de-depart, abort-controller, playwright, node-test]

requires:
  - phase: 02-fiable-et-juste-en-mer
    provides: "plans 01 et 02 : reprise du chrono, écouteurs de toucher, voyant et ses minuteries, journal (report / note) ; tools/pw.mjs (launchChromium, PW_REQUIRED)"
provides:
  - "js/app.js : init() en deux temps (interface utile synchrone, puis 3D / terrain / vent), marques performance rt:ui et rt:map, bindShell / bindMap, gardes pour tout ce qui peut tourner avant la 3D ou le champ de vent"
  - "js/wind.js : kitSteps (générateur), warm / warmKeys (préparation par tranches) ; kit() inchangé"
  - "js/racelock.js : heavyPaused, HEAVY_BEFORE_MS, HEAVY_AFTER_MS (séquence de départ H−6 min à H+1 min)"
  - "js/app.js : computeField mémoïsé (fieldKey), prepareField, autoHeavy / deferHeavy / runHeavy sur la liste fermée des recalculs automatiques"
  - "js/weather.js : délai de 10 s sur tout téléchargement (AbortController)"
  - "tools/measure-boot.mjs : ouverture hors réseau à CPU ralenti, serveur réellement arrêté (hors npm test)"
  - "tests/boot.test.mjs (17 tests) et 7 cas heavyPaused dans tests/racelock.test.mjs ; tests/helpers/scan.mjs (lecture statique des sources)"
affects: [02-05 guide et recette (temps d’ouverture à mesurer sur les trois iPhone, mention du report des calculs pendant la séquence)]

actuals:
  tokens: 10599
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Ouverture en deux temps : tout ce que l’équipier touche en mer (onglets, Départ, chrono, mode départ, En course, GPS) est prêt avant le moindre calcul ; la carte et le vent arrivent après, derrière des gardes"
    - "Calcul lourd en générateur : le même code mené à terme d’un coup (kit) ou par tranches de 12 ms (warm), preuve par comparaison nombre à nombre"
    - "Liste fermée des recalculs automatiques (autoHeavy), vérifiée par une garde statique ; tout geste et tout relevé calculent tout de suite"
    - "Tâche TDD du plan : squelettes + tests (RED validé par gsd-tools check tdd-red-evidence), puis implémentation (GREEN)"

key-files:
  created:
    - tools/measure-boot.mjs
    - tests/boot.test.mjs
    - tests/helpers/scan.mjs
    - .planning/phases/02-fiable-et-juste-en-mer/02-03-red-evidence.json
  modified:
    - js/app.js
    - js/wind.js
    - js/racelock.js
    - js/weather.js
    - index.html
    - tests/racelock.test.mjs
    - tests/diag.test.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "Le champ de vent est préparé dans prepareField (clés de 5° des relevés, puis refreshObs, puis clés de l’affichage et du départ, puis updateAll) lancé par autoHeavy : à l’ouverture pendant la séquence, la préparation entière attend H+1 min, pas seulement l’affichage"
  - "fieldOn : F existe avant d’être calculé (3D créée, calcul reporté) ; F.sample() renverrait des zéros : windAt du mode départ rend null (« Vent à relever »), onPick et renderLiveNav ne lisent pas F tant que fieldOn est faux"
  - "Les onglets sans carte (Prévisions, Vent, J80, IC) se dessinent au début du temps 2 (renderStatic, avec les prévisions en cache), avant l’import de la 3D : ils ne dépendent pas du report"
  - "Le report n’a qu’un site d’entrée par ouverture : prepareField (init et refreshWeather(true)) ; le ⟳ appelle runHeavy(prepareField), immédiat"
  - "L’outil de mesure neutralise le dessin et le téléversement WebGL : le rendu logiciel de Chromium sans tête (400 ms par image, 2,7 s pour le fond de carte) masquerait le travail JavaScript qu’on veut mesurer"

patterns-established:
  - "Toute écriture dans F en dehors de computeField (refreshObs, débrief) remet fieldKey à null : sinon la mémoïsation rendrait un champ périmé"
  - "Un ping de ligne reçu avant l’analyse est gardé (pendingEnds) puis appliqué : une interface affichée tôt ne doit jamais avaler un geste"

requirements-completed: [FIAB-06]

plan_head_before: bc18fb7948434ee828ba0a06650db4a0f0ba5768
plan_head_after: 2d60af012caa0c7718deca1a6dd710e71f978e2f

coverage:
  - id: D1
    description: "Hors réseau, l’app installée montre une interface utile (onglets, Départ avec chrono et « Mode départ », En course avec le GPS) en moins de 2 s : médiane de 4 535 ms avant à 544 ms après, sur 5 ouvertures à CPU ×4 dans Chromium, serveur arrêté pour de bon"
    requirement: FIAB-06
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 (sortie 0, médiane 544 ms, maximum 657 ms)"
        status: pass
      - kind: unit
        ref: "tests/boot.test.mjs#init() : onglets, Départ, En course et marque rt:ui avant le terrain et la 3D, sans rien attendre avant ; #js/app.js n’importe plus la 3D à l’évaluation ; #index.html : le script du QR code est différé"
        status: pass
    human_judgment: true
    rationale: "Temps réel d’ouverture de l’app installée sur les iPhone de l’équipage, en mode avion et avec un réseau très faible (hypothèse A7 : CPU ×4 est une borne prudente)"
  - id: D2
    description: "Le mode départ, le chrono et le GPS fonctionnent sans attendre ni le réseau, ni la 3D, ni le champ de vent ; la carte et l’analyse du parcours arrivent ensuite d’elles-mêmes ; un ping de ligne reçu trop tôt n’est pas perdu"
    requirement: FIAB-06
    verification:
      - kind: unit
        ref: "tests/boot.test.mjs#bindUI est coupée en bindShell et bindMap ; #gardes : rien ne suppose la 3D ou le champ de vent avant leur création"
        status: pass
      - kind: e2e
        ref: "essais Chromium de l’app réelle (hors dépôt, CPU ×1) : mode départ ouvert sans F (« Ligne non pinguée », aucune erreur de page), carte puis analyse arrivées seules, ping Comité avant l’analyse appliqué ensuite (ligne enregistrée)"
        status: pass
    human_judgment: true
    rationale: "GPS réel, chrono et mode départ de l’iPhone juste après l’ouverture"
  - id: D3
    description: "Après l’ouverture, le champ de vent est préparé par tranches courtes : la plus longue tâche après l’interface utile passe de 3 074 ms à 1 641 ms (CPU ×4), les tranches de préparation durent 50 à 80 ms"
    requirement: FIAB-06
    verification:
      - kind: unit
        ref: "tests/boot.test.mjs#kitSteps : générateur qui cède la main plus de 10 fois ; #warm : un seul point de vent à 312° ; #warm : une base à deux points (350° et 10°) ; #warm : une direction pile sur un multiple de 5°"
        status: pass
      - kind: e2e
        ref: "tools/measure-boot.mjs, colonne « plus longue tâche après l’interface » (avant tâche 2 / après tâche 2)"
        status: pass
    human_judgment: true
    rationale: "Réactivité perçue au doigt sur l’iPhone pendant la préparation du vent"
  - id: D4
    description: "De H−6 min à H+1 min, seuls les recalculs automatiques (calcul de l’ouverture, prévisions téléchargées sans geste) sont reportés puis faits tout seuls après le départ ; les gestes (curseur d’heure, bord, « Recalculer la suite », parcours, réglages, ping de ligne, ⟳) et les relevés calculent tout de suite"
    requirement: FIAB-06
    verification:
      - kind: unit
        ref: "tests/racelock.test.mjs#heavyPaused (7 cas) ; tests/boot.test.mjs#W4 : aucun geste, aucun relevé ne passe par la pause ; #W4 : autoHeavy( figure dans init et refreshWeather, nulle part ailleurs ; #W4 : refreshWeather(true) au démarrage seulement ; #W4 : deferHeavy"
        status: pass
      - kind: e2e
        ref: "essais Chromium (hors dépôt, CPU ×1) : chrono à H−3 min : rien de calculé et geste du curseur d’heure calculée en 0,5 s ; chrono à H−6 s : calcul fait seul 72 s après le chargement ; Stop pendant la séquence : calcul parti en 2 s"
        status: pass
    human_judgment: true
    rationale: "Déroulé réel d’une procédure de départ sur iPhone (dictée d’un relevé, pings, bips à l’heure, retour 1 min après le signal)"
  - id: D5
    description: "Avec un réseau très faible, le téléchargement des prévisions abandonne au bout de 10 s avec « délai dépassé (10 s) » : « Chargement… » et la roue ne tournent pas indéfiniment ; le repli habituel (cache, instantané embarqué) prend le relais"
    requirement: FIAB-06
    verification:
      - kind: unit
        ref: "tests/boot.test.mjs#prévisions : un réseau muet est abandonné à 10 s avec un message en français (minuteries simulées : rien à 9,999 s, abandon à 10 s) ; #js/weather.js : getJSON utilise un AbortController"
        status: pass
    human_judgment: false
  - id: D6
    description: "Les résultats de calcul (vent, routage, débrief, référence SNPM) sont strictement identiques à ceux d’avant : le kit découpé donne les mêmes tableaux nombre à nombre, la mémoïsation ne rend jamais un champ périmé"
    requirement: FIAB-06
    verification:
      - kind: unit
        ref: "npm run check : 142 tests verts dont tests/calc.test.mjs et tests/reference.test.mjs (5 tests SNPM) non modifiés ; tests/boot.test.mjs#kitSteps ≡ kit et #warm ≡ kit (fac, dev, shel, blk, puis spd et dir après compute) ; #computeField mémoïsé : la clé couvre jour, heure, source, vent manuel, modèle, relevés, intensité du relief et prévisions"
        status: pass
    human_judgment: false

duration: 40 min
completed: 2026-10-19
status: complete
---

# Phase 2 Plan 03 : Ouverture rapide hors réseau Summary

**L’app s’ouvre sur l’interface utile (onglets, Départ, chrono, « Mode départ », En course, GPS) en 544 ms de médiane hors réseau à CPU ×4, contre 4 535 ms avant : la 3D est importée après coup, le champ de vent est préparé par tranches de 12 ms sans changer un nombre, `computeField` est mémoïsé, et de H−6 min à H+1 min seuls les recalculs automatiques attendent le départ, les gestes et les relevés de l’équipier calculant tout de suite.**

## Performance

- **Duration:** 40 min (approximatif : l’heure de début n’a pas été relevée, le premier fichier de la tâche 1 date de 16:22Z)
- **Completed:** 2026-10-19T17:02:00Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 13 (4 créés, dont la preuve RED ; 9 modifiés)

## Mesures d’ouverture (FIAB-06)

Sorties brutes de `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : Chromium 1194, émulation mobile 390 × 844, première visite en ligne puis serveur arrêté pour de bon (connexion refusée vérifiée), 5 ouvertures dans le même contexte à CPU ×4, service worker de l’app seul. Les deux sorties « Avant » et « Après » viennent de la **même version de l’outil** : l’une sur le code d’avant le plan (`git archive` de `bc18fb7`), l’autre sur le code final. Seule la première colonne fait critère ; les trois autres sont indicatives. Les 5 ouvertures de chaque sortie sont consécutives, la variance du bac à sable est forte (maximum à 657 ms contre une médiane de 544 ms).

### Avant (code de `bc18fb7`, sortie 1)

```
Première visite en ligne : service worker actif, 52 fichiers en cache.
Serveur arrêté (connexion refusée sur 127.0.0.1:40445) : ouvertures hors réseau, CPU ×4, 5 ouvertures.

ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                 4731 |                          7709 |                — |                                     2429
        2 |                 4535 |                          6410 |                — |                                     1698
        3 |                 4278 |                          6793 |                — |                                     1905
        4 |                 5631 |                          6711 |                — |                                     1682
        5 |                 4345 |                          6774 |                — |                                     1687
  médiane |                 4535 |                          6774 |                — |                                     1698
  maximum |                 5631 |                          7709 |                — |                                     2429
RÉSULTAT : ÉCHEC — médiane de l’interface utile 4535 ms ≥ 2000 ms
```

Avant, le bouton « Mode départ » n’existe qu’après l’analyse du parcours (colonne 2 : 6,8 s après l’interface) et la marque `rt:map` n’existe pas ; l’« interface utile » est alors l’instant du retrait du splash (classe `gone`). La plus longue tâche après l’interface n’est pas comparable à celle d’après : avant, tout le calcul lourd a lieu avant le retrait du splash.

### Après la tâche 1 (commit `5209247`, sortie 0) : interface utile d’abord, calcul du vent encore d’un bloc

```
Première visite en ligne : service worker actif, 52 fichiers en cache.
Serveur arrêté (connexion refusée sur 127.0.0.1:33047) : ouvertures hors réseau, CPU ×4, 5 ouvertures.

ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  480 |                           634 |             5303 |                                     3823
        2 |                  619 |                           445 |             4473 |                                     3175
        3 |                  631 |                           479 |             4430 |                                     3074
        4 |                  535 |                           428 |             4159 |                                     2993
        5 |                  556 |                           436 |             4008 |                                     2747
  médiane |                  556 |                           445 |             4430 |                                     3074
  maximum |                  631 |                           634 |             5303 |                                     3823
RÉSULTAT : OK — médiane de l’interface utile 556 ms < 2000 ms (hors réseau, CPU ×4)
```

### Après (code final, commit `2d60af0`, sortie 0)

```
Première visite en ligne : service worker actif, 52 fichiers en cache.
Serveur arrêté (connexion refusée sur 127.0.0.1:37909) : ouvertures hors réseau, CPU ×4, 5 ouvertures.

ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  617 |                           680 |             6985 |                                     1641
        2 |                  657 |                           440 |             7017 |                                     1612
        3 |                  509 |                           356 |             6171 |                                     1526
        4 |                  536 |                           579 |             7538 |                                     1995
        5 |                  544 |                           623 |             7552 |                                     1652
  médiane |                  544 |                           579 |             7017 |                                     1641
  maximum |                  657 |                           680 |             7552 |                                     1995
RÉSULTAT : OK — médiane de l’interface utile 544 ms < 2000 ms (hors réseau, CPU ×4)
```

Lecture :

- **Interface utile** : 4 535 ms → 544 ms (médiane), maximum 657 ms ; le critère de 2 s est tenu avec une marge de ×3,7 sur ce bac à sable, borne prudente selon l’hypothèse A7 (à confirmer sur les iPhone).
- **Plus longue tâche après l’interface** : 3 074 ms après la tâche 1 (kits et `compute` d’un bloc) → 1 641 ms après la tâche 2 : les tranches de préparation du vent durent 50 à 80 ms.
- **Carte prête (`rt:map`)** : 4,4 s après la tâche 1, 7,0 s après la tâche 2. C’est le prix voulu du découpage : la préparation par tranches rend la main aux gestes entre deux tranches et arrive plus tard, mais l’interface répond pendant ce temps. Sur un iPhone (aucun CPU ×4 ni rendu logiciel), l’écart sera bien plus faible.
- Ce qui reste de la plus longue tâche (≈ 1,6 s à CPU ×4) est le premier `updateAll` (un `F.compute` d’un bloc, ≈ 1 s, plus le dessin des onglets) ; la construction de la 3D et du vent (≈ 0,9 s) est une autre tâche d’un bloc. Ni l’une ni l’autre n’est découpée (voir « Restes »).

## Accomplishments

- **Ouverture en deux temps** : `init()` lie les onglets (`bindShell`), dessine Départ et En course, retire le splash et pose `performance.mark('rt:ui')` sans rien attendre (garde de test : aucun `await` avant la marque) ; puis, après une image, il charge les prévisions en cache ou embarquées, dessine les onglets sans carte (`renderStatic`), importe `scene3d.js` (691 Ko de three.js) à la demande, charge le terrain, crée le vent et la 3D, lie la carte (`bindMap`) et prépare le champ. Le script `vendor/qrcode.js` est différé.
- **Gardes** : rappel GPS, `stopGps`, `refreshLive`, `setSheet`, `onPick`, `windAt` du mode départ (null sans vent calculé : « Vent à relever »), `renderLiveNav`, `refreshObs`, `updateAll`, `updateDisplayField`, `runAnalysis`. Une erreur du temps 2 laisse l’interface utile en place et écrit « Carte indisponible : … » dans la ligne d’état.
- **`kitSteps` / `warm`** : le calcul de `kit()` est un générateur qui cède la main toutes les 30 itérations de relaxation et toutes les 10 lignes du dévent ; `kit()` le mène à terme d’un coup. `warm` couvre les clés de 5° de la base (arc le plus court entre les directions, passage par le Nord compris, clé du dessous quand la direction tombe pile sur un multiple de 5°) par tranches de 12 ms. Preuve : les tableaux `fac`, `dev`, `shel`, `blk`, puis `spd` et `dir` après `compute`, sont identiques nombre à nombre à ceux d’un `WindField` qui n’a connu que `kit()`.
- **`computeField` mémoïsé** : clé = jour, heure, `S.day`, source, vent manuel, modèle retenu, `S.nowcast`, relevés (`resid`), intensité du relief, date des prévisions. Au démarrage, l’affichage et l’analyse demandaient deux fois le même champ (≈ 250 ms à CPU ×1 économisés).
- **Pause de départ** : `heavyPaused({ now, timerEnd })` pur (H−6 min à H+1 min inclus) ; `autoHeavy` / `deferHeavy` / `armHeavy` / `flushHeavy` : file sans doublon, une seule minuterie à H+1 min + 1 s, réarmée si le chrono bouge (± 1 min, Stop), une seule note `reporté après le départ` par séquence. Liste fermée des recalculs automatiques : `prepareField` de l’ouverture et celle du téléchargement de prévisions sans geste (`refreshWeather(true)`). La garde statique W4 vérifie qu’aucune des seize fonctions de geste ou de relevé (dont `updateAll`, `runAnalysis`, `planRest`, `setLineEnd`, `renderObs`, `voiceObs`) ni l’entrée `reanalyse` du mode départ n’appelle la pause.
- **Délai de 10 s** sur `getJSON` (`AbortController`, minuterie levée dans tous les cas) : « délai dépassé (10 s) » ; le repli sur le cache puis l’instantané embarqué est celui d’avant.
- **`tools/measure-boot.mjs`** : serveur Node sur 127.0.0.1 arrêté pour de bon (connexion refusée vérifiée), Chromium en émulation mobile, ouvertures à CPU ralenti, tableau, médiane, maximum, sortie 0 / 1 / 2.

## Task Commits

1. **Task 1 (tracer) : interface utile d’abord** - `5209247` (feat) ; tracer vérifié (⚡ `npm run check` vert, 125 tests, mesure 0,66 s contre 10,9 s avec la première version de l’outil) avant d’étendre
2. **Task 2 (TDD) : vent par tranches, calcul mémoïsé, report des calculs automatiques** - RED `ef8a5b3` (test, preuve `RED_EVIDENCE_OK`), GREEN `2d60af0` (feat)

**Plan metadata :** commit `docs(02-03)` suivant ce fichier.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Statut |
|------|-----|-------|----------|--------|
| 02-03 task 2 | `ef8a5b3` `test(02-03)` | `2d60af0` `feat(02-03)` | sans objet | conforme |

RED : 36 tests (`tests/racelock.test.mjs` et `tests/boot.test.mjs`) contre des squelettes sans comportement (`heavyPaused` rend toujours faux, `kitSteps` / `warm` / `warmKeys` vides, `autoHeavy` / `deferHeavy` / `prepareField` / `fieldKey` absents d’`app.js`) ; cible « heavyPaused : bornes de la séquence… », échec d’assertion (faux au lieu de vrai à H−6 min). Preuve `.planning/phases/02-fiable-et-juste-en-mer/02-03-red-evidence.json`, `gsd-tools check tdd-red-evidence` : `RED_EVIDENCE_OK` (TAP, 36 tests, 13 échecs d’assertion, aucun échec d’import ni de syntaxe). Vingt-trois tests passaient dès le RED : les 12 tests existants de `tests/racelock.test.mjs`, les 7 gardes de la tâche 1, les constantes, « sans chrono » et « chrono oublié » (le squelette rend faux), et la garde négative « aucun geste ne passe par la pause » (aucune pause n’existait encore).

## Files Created/Modified

- `js/app.js` : `init()` en deux temps, `bindShell` / `bindMap`, `renderStatic`, `fieldOn`, `computeField` mémoïsé, `prepareField`, `autoHeavy` / `deferHeavy`, `refreshWeather(auto)`, `applyPendingEnds`, gardes
- `js/wind.js` : `kit` / `kitSteps`, `warmKeys`, `warm`
- `js/racelock.js` : `heavyPaused`, `HEAVY_BEFORE_MS`, `HEAVY_AFTER_MS`
- `js/weather.js` : `FETCH_TIMEOUT_MS`, délai de `getJSON`
- `index.html` : `defer` sur `vendor/qrcode.js`
- `tools/measure-boot.mjs`, `tests/boot.test.mjs`, `tests/helpers/scan.mjs`, cas `heavyPaused` de `tests/racelock.test.mjs`
- `tests/diag.test.mjs` : `scan` importé de `tests/helpers/scan.mjs` (déplacé, 23 tests inchangés et verts)
- `sw.js`, `js/version.js` : générés par `npm run stamp` (version affichée inchangée, v26, aucune publication)

## Decisions Made

Voir `key-decisions` : préparation du champ entière derrière `autoHeavy`, drapeau `fieldOn`, onglets sans carte dessinés avant la 3D, un seul site de report, outil de mesure sans dessin WebGL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `F.sample()` ne vaut rien tant que F n’est pas calculé**
- **Found during :** Task 1 (lecture des sites qui touchent à F avant le premier `updateAll`) et Task 2 (le report laisse F créé mais jamais calculé)
- **Issue :** avec le report de l’ouverture, F existe sans vent calculé ; `windAt` du mode départ, `onPick` et `renderLiveNav` auraient lu des zéros (vent de 0 nd, cap 0°) au lieu de « Vent à relever ».
- **Fix :** drapeau `fieldOn`, posé par `computeField` ; `windAt` rend `null`, `onPick` ne fait rien, `renderLiveNav` ne lit pas F tant qu’il est faux (garde de test).
- **Files modified :** `js/app.js`
- **Commit :** `5209247`

**2. [Rule 2 - Missing critical] Ping de ligne reçu avant que la ligne soit calculée**
- **Found during :** Task 1
- **Issue :** le bouton « Ping Comité (GPS) » et le mode départ existent maintenant dès l’interface utile ; `setLineEnd` sortait sans rien faire tant qu’il n’y avait ni analyse ni ligne enregistrée, alors que le mode départ affiche « Comité pingué » : un geste perdu en silence.
- **Fix :** le ping est gardé (`pendingEnds`, avec un message « Ping noté : la ligne se calcule… ») puis appliqué à la fin de la première analyse. Essai Chromium : ligne enregistrée après l’analyse.
- **Files modified :** `js/app.js`
- **Commit :** `5209247`

**3. [Rule 1 - Bug] La mémoïsation de `computeField` rendrait un champ périmé après le débrief**
- **Found during :** Task 2
- **Issue :** `dbAnalyze` (js/debrief.js ligne 182) écrit dans F une base par bord puis appelle `restoreField` ; avec la clé mémoïsée, `updateDisplayField` aurait trouvé « même clé » et laissé le dernier champ du débrief à l’écran. Même chose pour `refreshObs`, qui écrit dans F un champ par relevé.
- **Fix :** `fieldKey = null` dans `refreshObs`, au début de `runDebrief` et dans `restoreField` (garde de test).
- **Files modified :** `js/app.js`
- **Commit :** `2d60af0`

**4. [Rule 2 - Missing critical] Onglets sans carte vides pendant le report ; erreur du temps 2 invisible**
- **Found during :** Task 1 et Task 2
- **Issue :** l’ouverture pendant la séquence reporte `updateAll` : les onglets Prévisions, Vent, J80 et IC seraient restés vides jusqu’à H+1 min ; et une erreur du temps 2 (WebGL absent, terrain illisible) aurait écrit son message dans un splash déjà retiré.
- **Fix :** `renderStatic()` (prévisions en cache ou embarquées, onglets sans carte) en début de temps 2 ; message « Carte indisponible : … » dans la ligne d’état quand le splash est déjà parti ; texte de `renderLiveNav` sans analyse : « Analyse du parcours en cours de calcul… » (l’ancien « Choisissez un parcours » serait faux à l’ouverture).
- **Files modified :** `js/app.js`
- **Commit :** `5209247`

**5. [Rule 3 - Process] `prepareField` rassemble `warm`, `refreshObs` et `updateAll` derrière un seul `autoHeavy`**
- Le plan écrit `await F.warm(...)` dans le temps 2 puis `refreshObs()` / `updateAll()` derrière `autoHeavy`. L’ordre réel compte : les relevés fixent le modèle retenu et l’écart appliqué aux bases de l’affichage et du départ, donc leurs clés de 5° se préparent d’abord, puis `refreshObs`, puis les bases. Mettre le tout dans `prepareField` lancé par `autoHeavy(prepareField)` garde l’ordre, évite de lancer la préparation pendant la séquence et donne une seule fonction à dédoubler (le ⟳ appelle `runHeavy(prepareField)`, immédiat). La garde statique du plan (`autoHeavy(` dans `init` et `refreshWeather`) reste vraie.

**6. [Rule 3 - Blocking] Outil de mesure : trois corrections de l’outil lui-même**
- Un prédicat asynchrone passé à `waitForFunction` n’est pas attendu : la première visite se terminait avant que le worker contrôle la page (avec le code de la tâche 1, qui enregistre le worker dès le début de l’ouverture, la deuxième ouverture hors réseau tombait en `ERR_CONNECTION_REFUSED`). La condition (worker actif ET liste hors réseau entièrement en cache) est maintenant sondée depuis Node.
- Avant le plan, le bouton « Mode départ » n’existe qu’après l’analyse : l’outil retouche l’onglet Départ jusqu’à ce que le bouton existe, ce qui mesure le vrai délai d’ouverture.
- Le rendu WebGL logiciel de Chromium sans tête fausse tout ce qui suit l’interface utile : 400 ms par image et 2,7 s pour téléverser le fond de carte sur le fil principal (diagnostic : cette tâche disparaît quand `texImage2D` est neutralisé). Les appels de dessin et de téléversement WebGL sont neutralisés par défaut (`BOOT_GPU=1` garde le rendu réel) ; tout le JavaScript de la 3D et du vent reste mesuré.

**7. [Rule 3 - Process] `tests/helpers/scan.mjs`**
- L’appariement d’accolades de `tests/diag.test.mjs` sert aussi aux gardes de `tests/boot.test.mjs` : déplacé dans `tests/helpers/scan.mjs` (avec `bodyOf`) plutôt que dupliqué ; les 23 tests de `tests/diag.test.mjs` sont inchangés et verts.

**Total deviations :** 7 (2 bugs, 2 fonctions critiques manquantes, 3 de processus ou d’outil). **Impact :** aucun changement de périmètre ; aucune valeur de calcul ne change.

## Authentication Gates

Aucune.

## Known Stubs

Aucun.

## Issues Encountered

- **Première mesure « Avant »** : 10 711 ms de médiane avec la première version de l’outil (rendu WebGL réel, déclencheur de la première visite fragile). Elle n’est pas reprise ci-dessus : l’outil a été corrigé (point 6), puis « Avant » et « Après » ont été remesurés avec la même version sur les deux états du code. Les ordres de grandeur concordent avec la recherche (4,3 à 8,1 s).
- **Variance** : `rt:ui` varie de 457 à 657 ms d’une ouverture à l’autre ; les maxima sont donnés dans les sorties.
- `git status` propre à la fin, rien de poussé ; branche `apercu-phase-02`.

## Verification (plan)

- `npm run check` : vert, 142 tests (118 avant le plan, +17 `tests/boot.test.mjs`, +7 `heavyPaused` ; `tests/calc.test.mjs` et `tests/reference.test.mjs` non touchés et verts), `stamp à jour`.
- `node --check` sur `js/app.js`, `js/wind.js`, `js/racelock.js`, `js/weather.js`, `tools/measure-boot.mjs` ; critères d’acceptation rejoués : `kitSteps` 4 (≥ 2), `F.warm(` 3 (≥ 2), `heavyPaused(` 2 (≥ 2), `autoHeavy(` 4 (≥ 3), `performance.mark('rt:ui')` 1, `import('./scene3d.js')` 1.
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : sortie 0 sur le code final (médiane 544 ms), jamais sautée.
- Essais Chromium de l’app réelle (hors dépôt, CPU ×1, aucune erreur de page) : ouverture normale (interface à `rt:ui`, carte puis analyse seules, mode départ), ouverture pendant la séquence (rien calculé, mode départ sans vent, geste du curseur d’heure calculé en 0,5 s), report fait seul 72 s après le chargement avec un chrono à H−6 s, Stop pendant la séquence (calcul reparti en 2 s), ping Comité avant l’analyse appliqué ensuite.

## Restes pour le vérificateur de fin de phase (`<human-check>` non exécutés ici)

1. **Tâche 1** : iPhone, app installée et à jour : la fermer (balayer), mode avion, l’ouvrir en filmant ; Départ → « Top 5’ » puis « Mode départ » aussitôt ; GPS dans En course ; refaire avec un réseau très faible. Attendu : onglets, Départ et chrono utilisables en moins de 2 s, la carte 3D ensuite, pas de blocage sur « Chargement… ». À reporter dans la recette du plan 05 avec le temps relevé sur chacun des trois iPhone.
2. **Tâche 2** : iPhone, app installée : ouvrir puis toucher aussitôt Départ → « Mode départ » et les boutons ; « Top 5’ » puis, après H−6 min, dicter un relevé, déplacer le curseur d’heure, choisir un bord, « Recalculer la suite » (GPS actif), pinguer Comité puis bouée, ⟳ ; revenir 1 min après le signal. Attendu : tout est pris en compte tout de suite, les bips restent à l’heure, aucun gel.
3. **Restes d’ouverture (non découpés, hors plan)** : le premier `F.compute` (≈ 1 s à CPU ×4) et la construction de la 3D (≈ 0,9 s) restent des tâches d’un bloc ; si la recette sur iPhone montre un gel perceptible après l’interface utile, `compute()` est le prochain candidat au découpage (même méthode que `kitSteps`, preuve par comparaison nombre à nombre).
4. **Requirements** : FIAB-06 reste déclaré par le plan 05 (recette) : sa case ne se coche qu’à la fin du dernier plan qui le déclare, comme pour FIAB-05 et FIAB-07.

## Threat Flags

Aucun : le serveur de l’outil de mesure écoute sur 127.0.0.1 seulement, le temps de la mesure (T-02-13, acceptée) ; aucun nouveau point d’entrée réseau, aucune donnée nouvelle stockée. Les hachages du middleware et les codes d’accès n’ont été lus ni copiés nulle part.

## Next Phase Readiness

Prêt pour les plans suivants de la phase 2 : l’ouverture fait moins de 2 s hors réseau sur le banc de mesure, `tools/measure-boot.mjs` rejoue la preuve à tout moment, et le guide (plan 05) peut expliquer que l’app affiche d’abord Départ et En course, puis la carte, et que les calculs automatiques attendent la fin de la séquence de départ.

## Self-Check: PASSED

- Fichiers créés présents : `tools/measure-boot.mjs`, `tests/boot.test.mjs`, `tests/helpers/scan.mjs`, registre RED.
- Commits présents : `5209247`, `ef8a5b3`, `2d60af0` (3 commits, mesurés par `git rev-list --count` depuis le registre posé avant le premier commit).
- Critères d’acceptation des deux tâches rejoués : tous verts ; `npm run check` vert (142 tests) ; `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` sort en 0.
