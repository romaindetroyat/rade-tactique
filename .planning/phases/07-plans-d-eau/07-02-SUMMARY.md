---
phase: 07-plans-d-eau
plan: 02
subsystem: moteur
status: complete
tags: [plan-d-eau, registre, projection, positions-ouest, meteo, vent, toulon-v42]
requires:
  - "07-01 : fixture Toulon v42, scénario toulon-vue, tools/gardes-toulon.mjs"
provides:
  - "js/venues.js : registre VENUES (Toulon par référence à js/courses.js, Brest), VENUE_IDS, bootVenue, inBounds, venueAt"
  - "js/venue-brest.js : descripteur BREST (origine 48,33 / −4,45, emprise, bornes de saisie, data/brest., météo de la zone A, vent, cadrage, catalogue initial)"
  - "js/lieu.js : plan d’eau courant à exports vivants, setVenue une fois par session"
  - "js/geo.js : setOrigin ; fmtLon Ouest, fmtLat Sud"
  - "js/weather.js : configureWeather ; js/wind.js : WindField(T, { cell, openSea })"
affects: [07-03, 07-04, 07-05, 07-06, 07-07, 07-09]
tech-stack:
  added: []
  patterns:
    - "exports vivants (`export let`) réassignés une seule fois au démarrage, avant tout toXY"
    - "descripteur de plan d’eau : null = défauts de la v42 dans le module consommateur"
    - "test de plan d’eau dans son propre processus : Toulon d’abord, puis passage à Brest"
key-files:
  created:
    - js/venues.js
    - js/venue-brest.js
    - js/lieu.js
    - tests/venues.test.mjs
  modified:
    - js/geo.js
    - js/tactics.js
    - js/debrief.js
    - js/scene3d.js
    - js/app.js
    - js/marks.js
    - js/icplaus.js
    - js/icread.js
    - js/weather.js
    - js/wind.js
    - tests/access.test.mjs
    - sw.js
    - js/version.js
decisions:
  - "setVenue ne verrouille la session qu’au premier vrai changement d’origine : un setVenue('toulon') suivi de setVenue('brest') est accepté (le test du plan l’exige), un retour ensuite est refusé ; l’app n’appelle setVenue qu’une fois"
  - "S.venue est ramené à VENUE.id juste après la lecture de rade.state (valeur hostile jamais réécrite)"
  - "icread.js lit aussi les bornes du plan d’eau (parseLatLon des bouées lues dans les IC et checkPos), comme le demande l’action 4 de la tâche 2"
  - "Liens « Autres sources » : VENUE.links (Brest : bulletin côtier et Windy centré sur la zone A) ; null = liens de la v42"
  - "Onglet IC à Brest : pas de carte « Marques du cahier CVAT », pas de ligne Saint-Mandrier ; dangers de DANGERS, ou « Aucun danger enregistré pour ce plan d’eau : suivez la carte marine. »"
metrics:
  duration: 25min
  completed: 2026-11-19
  tasks: 3
  files: 17
estimate:
  tokens: 140000
  tasks: 3
actuals:
  tokens: 20113        # chars/4 du diff complet 40b8ef2..e2f70b0 (80 450 caractères), sw.js et js/version.js compris
  tasks: 3
  commits: 3
plan_head_before: 40b8ef2974d19af2f025dfd92fad11798fd65835
plan_head_after: e2f70b0a3011cd790554e2195b2690e878e85224
---

# Phase 7 Plan 02 : Plan d’eau courant dans le moteur Summary

Le moteur lit son plan d’eau dans un registre (`js/venues.js`) par des exports vivants (`js/lieu.js`) fixés une fois au démarrage avec l’origine de projection (`setOrigin`) ; Toulon y est décrit par référence aux objets de `js/courses.js` et aux fichiers `data/` actuels, Brest par un descripteur léger ; positions Ouest, bornes, météo (zone A en `cell_selection=sea`, sans marine ni Pioupiou), maille et seuil du vent, cadrage 3D et textes suivent le plan d’eau — Toulon identique au bit près (fixture v42, vues `toulon-vue`, gardes vertes).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 3519d56 | `js/venues.js`, `js/venue-brest.js`, `js/lieu.js`, `setOrigin` ; tactics, debrief, scene3d et app importent de `lieu.js` ; `setVenue(bootVenue(...))` en tête de app.js ; terrain lu dans `VENUE.files.base` ; 12 tests |
| 2 (TDD) | 5670bf1 | `fmtLon`/`fmtLat` Ouest et Sud, messages de `parseLatLon` par plan d’eau, `checkPos(…, { bounds })`, bornes du plan d’eau dans app.js et icread.js ; 17 tests (5 échecs constatés avant le code) |
| 3 (TDD) | e2f70b0 | `configureWeather`, `WindField(T, { cell, openSea })`, Scene3D `{ home, files }`, fond du rapport par plan d’eau, textes et onglet IC de app.js ; 24 tests |

### Lignes changées dans js/app.js (numéros après le plan)

| Ligne | Avant | Après |
|-------|-------|-------|
| 6-7 | import de `./courses.js` (`FORBIDDEN_ZONE`) | imports de `./lieu.js` (`VENUE`, `FORBIDDEN_ZONES`, `setVenue`) et `bootVenue` de `./venues.js` |
| 18 | import de weather.js | + `configureWeather` |
| 57-61 | — | `setVenue(bootVenue(store.get('rade.state', {})))` puis `configureWeather(VENUE.weather)`, avant `addBanane(COURSES)` |
| 71 | — | `DEF.venue = 'toulon'` |
| 74 | — | `S.venue = VENUE.id` |
| 114 | `[FORBIDDEN_ZONE.map(…)]` | `FORBIDDEN_ZONES.map((poly) => poly.map(…))` (même tableau à Toulon) |
| 180-182 | `load('data/')`, `new WindField(T)`, `new Scene3D($('#view'), T)` | `load(VENUE.files.base)`, `new WindField(T, VENUE.wind)`, `new Scene3D(…, { home: VENUE.scene?.home, files: VENUE.files })` |
| 291 | `'centre de la rade'` | `VENUE.texts?.centre ?? 'centre de la rade'` |
| 433 | `toXY(43.088, 5.962)` | `toXY(VENUE.windRef.lat, VENUE.windRef.lon)` |
| 683, 718 | « au centre de la rade », « point central rade » | `VENUE.texts?.centre` / `VENUE.texts?.point` avec les textes de la v42 par défaut |
| 729 | liens Windguru Toulon, bulletin, Windy | `VENUE.links` sinon les liens de la v42 |
| 1532-1533 | `lig.lat > 43 && lig.lat < 43.18 && lig.lon > 5.8 && lig.lon < 6.1` | `VB = VENUE.bounds`, mêmes inégalités strictes |
| 1555 | api du débrief | + `files: VENUE.files` |
| 1808, 1834 | `PRESETS` | `VENUE.presets ?? PRESETS` |
| 1825 | « accélérations aux caps (Cépet, Sicié, Cap Brun) et dans les passes » | `VENUE.texts?.relief ??` texte de la v42 |
| 1867 | placeholder « 43°05.845N 005°56.049E » | `VENUE.exemple ??` même texte |
| 1912 | `parseLatLon(ed.txt)` | `parseLatLon(ed.txt, VENUE.inputBounds)` |
| 2196, 2215, 2219-2222 | onglet IC | `toulon = VENUE.id === 'toulon'` : « habituels CVAT », carte des marques du cahier et ligne Saint-Mandrier à Toulon seulement |

## Sorties brutes des vérifications

Tâche 1 :
```
# pass 69 / # fail 0   (venues, toulon, banane, calc, debrief)
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
npm run check : stamp à jour · # tests 696 · # pass 696 · # fail 0
OK toulon-vue
OK accueil
Bilan : 2/2 scénario(s) OK
```
Tâche 2 (RED : 5 échecs sur 17 avant le code ; puis) :
```
fmtLon(-4.3605) === '004°21.630W' → sortie 0
# pass 93 / # fail 0   (venues, toulon, icplaus, marks, icread)
(quatre OK des gardes)
npm run check : # tests 701 · # pass 701 · # fail 0
OK toulon-vue
OK bouees
OK vraisemblance
Bilan : 3/3 scénario(s) OK
```
Tâche 3 (RED : les nouveaux tests joués sur l’extraction de 5670bf1 → 5 échecs sur 24 ; puis) :
```
grep "toXY(43.088, 5.962)" js/app.js | grep -v '//' → rien ; grep "^const CELL = 150" js/wind.js → rien
# pass 100 / # fail 0   (venues, toulon, meteo, boot, gel, debrief)
(quatre OK des gardes)
npm run check : # tests 708 · # pass 708 · # fail 0
OK toulon-vue
OK accueil
OK jour-j
OK gel
OK debrief-tardif
  conseil affiché : Porte : bouée gauche conseillée — 22 s de mieux
OK banane
OK bouees
OK vraisemblance
Bilan : 8/8 scénario(s) OK
```
Garde SNPM `git diff --quiet f80c365 -- js/courses.js tests/reference/` → 0 après chaque tâche ; `git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js` → 0 (garde « modules du mode départ »).

Tous les scénarios, après la tâche 3 (`PW_REQUIRED=1 node tools/regate-e2e.mjs`, sans argument) :
```
OK accueil · OK jour-j · OK deux-telephones · OK reprise · OK equipage · OK archive · OK archive-bouees · OK archivehors · OK creer · OK manche
OK auteur · OK ic · OK depuis-ic · OK vraisemblance · OK gel · OK debrief-tardif · OK gpx · OK gpx-choix · OK ia · OK ia-erreurs
OK arbitre · OK bouees · OK guide · OK entetes · OK retour-port · OK banane · OK banane-manche · OK banane-debrief · OK porte-ic · OK modifier-manche
OK toulon-vue
Bilan : 31/31 scénario(s) OK
```

Exigences : VENUE-01 et BREST-01 restent « Pending » dans REQUIREMENTS.md (portées par toute la phase, comme en 07-01) ; la case 07-02 de la ROADMAP est cochée.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Balayage des adresses de l’app (tests/access.test.mjs)**
- **Trouvé pendant :** tâche 3, `npm run check` : « le balayage doit trouver /data/wx-snapshot.json ».
- **Cause :** l’instantané est désormais lu par `fetch(W.snapshot)` ; le balayage statique ne voyait que les `fetch('…')` littéraux.
- **Correction :** le test lit aussi les chemins des descripteurs (`snapshot: '…'`, et `base: '…'` combiné aux noms de `Terrain.load`) : il couvre maintenant `data/brest.*` (tous servis par la liste blanche du middleware, noms plats). Le middleware n’est pas touché.
- **Fichier hors liste :** `tests/access.test.mjs` (commit e2f70b0).

**2. [Rule 2 - Exigence du plan] js/icread.js**
- L’action 4 de la tâche 2 demande que les appelants de `checkPos` dans js/icread.js passent `VENUE.bounds` ; le fichier n’était pas dans `files_modified`. Fait, avec `parseLatLon(…, VENUE.inputBounds)` pour les bouées lues dans les IC (sinon une position de Brest y serait refusée avant le contrôle). Toulon : mêmes nombres, mêmes messages (tests icread, icplaus et scénario vraisemblance verts).

**3. [Précision] setVenue et le verrou de session**
- Le plan demande à la fois « un second appel avec un autre plan d’eau lève une erreur » et un test où `setVenue('toulon')` précède `setVenue('brest')`. Le verrou est posé au premier vrai changement d’origine ; l’app n’appelle `setVenue` qu’une fois (en tête de js/app.js).

**4. [Précision] Ordre TDD de la tâche 3**
- Le code de la tâche 3 a été écrit avant ses tests ; l’état RED a été constaté après coup en jouant le nouveau `tests/venues.test.mjs` sur une extraction de 5670bf1 (5 échecs : configureWeather absent, maille et seuil du vent, météo de Brest).

## Known Stubs

Aucun qui empêche l’objectif du plan (Brest n’est pas encore proposé à l’équipier) ; catalogue de Brest volontairement court, complété par les plans suivants :

| Fichier | Valeur | Résolu par |
|---------|--------|-----------|
| js/venue-brest.js | `MARKS: {}`, `PLACES: []`, `FORBIDDEN_ZONES: []`, `DANGERS: []` | 07-06 |
| js/venue-brest.js | `regimes: []` → `regimeOf` retombe sur les REGIMES de Toulon (décision du plan : `VENUE.regimes?.length ? … : REGIMES`) | 07-06 |
| js/venue-brest.js | `COURSES: []` (seule la banane y sera ajoutée par addBanane) | 07-09 (GPEN) |
| js/venue-brest.js | `wind: { cell: 150, openSea: 1500 }` d’après l’étude, à confirmer par mesure | 07-03 / 07-06 |

## Threat Flags

Aucun : aucune nouvelle route réseau ni authentification ; `bootVenue` en liste blanche (`Object.hasOwn`, tests `__proto__`, `constructor`, objet) ; à Brest les requêtes marine et Pioupiou ne partent pas (tests sur cale réseau). Aucun code d’accès, aucune empreinte de `middleware.js`, aucun appel à l’IA.

## Points pour 07-03

- Fichiers lourds attendus sous les noms plats lus par le code : `data/brest.meta.json`, `brest.terrain.bin`, `brest.cover.bin`, `brest.coast.json` (Terrain.load), `brest.basemap.jpg`, `brest.seamask.png` (Scene3D, rapport du débrief), `brest.wx-snapshot.json` (instantané, `null` s’il manque). `meta` doit porter l’emprise `BREST.bounds` (−4,66 ; −4,22 ; 48,22 ; 48,43).
- Le terrain se charge APRÈS `setVenue('brest')` (Terrain.load calcule x0…y1 avec l’origine courante) ; un test de terrain de Brest doit tourner dans un processus à part (comme tests/venues.test.mjs) ou appeler `setVenue('brest')` avant `load`.
- `WindField(T, BREST.wind)` : mesurer le coût (étude : 217 × 155 cellules à 150 m) et le seuil `openSea` (1 500 m proposés ; l’emprise n’a aucune eau à plus de 3 693 m d’une terre) ; changer `BREST.wind` si la mesure le demande.
- `BREST.scene.home` (cible { 6620, −3520 } = centre de la zone A, distance 16 000 ; portrait 34 000) est à vérifier sur la vraie carte.
- `tools/stamp.mjs` met tout `data/` dans le SHELL : exclure `data/brest.*` avant d’y déposer les fichiers (07-04), sinon chaque mise à jour pèse le pack de Brest.
- `js/regmarks.js` (bouées de régate lues dans les IC, `parseLatLon` sans bornes) et le placeholder de `js/regview.js` restent aux bornes et à l’exemple de Toulon : à reprendre avec le plan d’eau d’une régate (07-05).
- `tests/toulon.test.mjs` importe toujours `../js/courses.js` ; `tests/venues.test.mjs` passe à Brest au milieu du fichier : y ajouter les tests de Toulon AVANT le bloc « Passage à Brest ».

## Self-Check: PASSED
