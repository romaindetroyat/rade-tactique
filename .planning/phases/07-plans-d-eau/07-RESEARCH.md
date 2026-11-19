# Phase 7 : Plans d'eau — Toulon et rade de Brest (GPEN) — Recherche

**Recherche faite le :** 2026-11-19
**Domaine :** architecture « pack de plan d'eau » dans une PWA sans build ; catalogue de parcours du Grand Prix de l'École Navale (GPEN) ; livraison sans toucher à Toulon
**Confiance générale :** HAUTE pour l'inventaire du code et les documents GPEN (lus dans cette session) ; MOYENNE pour l'architecture proposée (conception, pas encore éprouvée) ; renvoi pour le plan d'eau lui-même (voir ci-dessous)

> **Périmètre (décision de Romain, 2026-11-19).** L'étude du plan d'eau de Brest — relief, côte, fonds, repères, zones interdites, lieux (partie C) et vents, effets de site, courants et marées, sources de données (partie D) — est confiée à une étude dédiée : **`.planning/phases/07-plans-d-eau/07-RESEARCH-PLAN-EAU.md`**. Ce document-ci ne couvre que A (code et architecture du pack), B (GPEN : documents, zones, parcours) et E (plan de livraison). Quelques pistes déjà trouvées sont transmises en fin de document (« Pistes transmises »), sans plus.
>
> **Échéance (précision de Romain) :** on a le temps de TOUT livrer avant la régate de Toulon du **13 décembre 2026**, à condition que **Toulon ne change pas d'un bord**.

<user_constraints>
## Contraintes de l'utilisateur

Il n'existe pas de `07-CONTEXT.md` (pas encore de discuss-phase). Contraintes tirées de la demande de Romain, transmises par l'orchestrateur, et de `.claude/CLAUDE.md` :

### Décisions verrouillées
- Garder le fonctionnement actuel, mais permettre le **changement de plan d'eau** ; intégrer la **rade de Brest** et surtout la **zone de course habituelle du GPEN** (catalogue de parcours tiré des IC des années précédentes).
- **Toulon ne doit rien perdre** : la garde de la référence SNPM `git diff --quiet f80c365 -- js/courses.js tests/reference/` doit rester vraie, ou être remplacée par une garde équivalente si les données de Toulon déménagent (à discuter ; la recommandation ci-dessous est de **ne pas les déménager**).
- Tout peut partir avant le 13 décembre 2026 si Toulon ne change pas d'un bord.
- App sans build, JavaScript sans framework, PWA hors réseau, hébergement Vercel, accès réservé par le middleware, IA via OpenAI uniquement, interface en français.

### À la discrétion de Claude
- Forme du pack de plan d'eau, chargement à la demande, hors réseau, choix du plan d'eau par régate et en entraînement libre.

### Hors périmètre de ce document
- Données physiques de la rade de Brest (C) et météo-océanographie (D) : `07-RESEARCH-PLAN-EAU.md`.
</user_constraints>

<phase_requirements>
## Exigences de la phase

| ID | Description (REQUIREMENTS.md) | Ce que la recherche apporte |
|----|-------------------------------|-----------------------------|
| VENUE-01 | « Les données propres à la rade (zone, relief, bouées, parcours, IC par défaut) ne sont plus écrites dans le code mais dans un « pack » de plan d'eau » [VERIFIED: .planning/REQUIREMENTS.md:80] | Inventaire fichier:ligne de tout ce qui est propre à Toulon (§ A), architecture de pack sans build (§ Architecture), gardes Toulon (§ Gardes), catalogue GPEN (§ B) |

Exigences nouvelles proposées (à faire valider) : **VENUE-02** choisir le plan d'eau (régate et entraînement libre) et l'avoir hors réseau ; **VENUE-03** catalogue GPEN zone A J80 (parcours 1, 2, Virginie Hériot) ; **VENUE-04** Toulon identique à la v42 (gardes automatiques).
</phase_requirements>

## Résumé

Toulon est câblé à **huit endroits indépendants** : la projection (`ORIGIN` dans `js/geo.js`), les bornes de saisie (`RADE` dans `js/marks.js`, `BOUNDS` dans `js/icplaus.js`, un test de bornes en dur dans `js/app.js:1524`), la météo (`CENTER`, `GRID`, point marin et cadre des balises dans `js/weather.js`), le catalogue (`js/courses.js`), la connaissance locale (`REGIMES` de `js/tactics.js`, `PRESETS` de vent et textes de `js/app.js`), les fichiers `data/*`, la vue 3D (`home()` en dur dans `js/scene3d.js`) et les consignes des fonctions IA (`api/voice.js`, `api/debrief.js`, `api/rules.js`). Deux pièges bloquants ont été vérifiés en exécutant le code : **`fmtLon` produit `0-5°38.370E` pour une longitude Ouest** (Brest est à 4° W), et **`parseLatLon` refuse toute position à Brest** (« Position hors de la rade de Toulon »). Un troisième piège est structurel : **la fusion de l'archive (`js/archmerge.js`, aussi utilisée par `api/archive.js`) jette tout champ de régate qui n'est pas dans `HEAD`** — un champ `venue` ajouté naïvement disparaîtrait à la première synchronisation.

Pour le GPEN, les instructions de course 2022 à 2026 ont été trouvées et lues. Les J80 courent **toujours en zone A « École Navale – Rose »**, cercle de **1,2 NM** centré sur **48°17,890 N 004°21,630 W** (identique 2023, 2024, 2025, 2026), VHF **14**, sur un **parcours construit au vent** très proche de la « banane » livrée en phase 6 : départ – 1 – 2 (dégagement) – porte 3S/3P – … – 3P – arrivée, en **2 tours (flamme 1)** ou **3 tours (flamme 2)**, plus une variante « Virginie Hériot » à arrivée décalée devant la chapelle de l'École navale. Pénalité **un tour**, DNS si départ plus de 4 min après le signal, temps limite 90 min / 20 min. Aucun parcours côtier pour les J80. **GPEN 2027 : du 5 au 9 mai 2027** (agpen.fr).

**Recommandation principale :** ne pas déménager Toulon. `js/courses.js` et `data/*` restent intacts et deviennent, par simple référence, le pack « toulon » ; un registre `js/venues.js` décrit chaque plan d'eau ; le pack Brest garde ses descripteurs légers dans le SHELL mais ses gros fichiers (relief, fond de carte…) **hors SHELL**, téléchargés à la demande dans un cache dédié qui survit aux mises à jour ; le changement de plan d'eau **recharge la page** (aucune coordonnée XY périmée). Toulon est figé par une fixture v42 capturée **avant** toute modification, sur le modèle de `tests/fixtures/legs-v37.json`.

## Carte des responsabilités

| Capacité | Niveau principal | Niveau secondaire | Raison |
|----------|------------------|-------------------|--------|
| Choix du plan d'eau (entraînement libre) | Navigateur (`S.venue`, localStorage) | — | État d'affichage de cet appareil, comme `S.linePreset` |
| Plan d'eau d'une régate | Archive partagée (`api/archive.js` + `js/archmerge.js`) | Navigateur (déduction par les bouées) | Doit être le même sur les trois téléphones |
| Projection, bornes, catalogue | Navigateur (`js/venues.js`, `js/lieu.js`) | — | Calcul tout côté client (principe de l'app) |
| Fichiers lourds hors réseau | Service worker + Cache API | Vercel (fichiers statiques derrière le middleware) | Hors réseau en mer ; pas de re-téléchargement à chaque version |
| Prévisions par plan d'eau | Navigateur → Open-Meteo | — | Déjà le cas pour Toulon |
| Consignes IA par plan d'eau | Fonctions Vercel (`api/*.js`) | Navigateur (envoie un identifiant de plan d'eau) | Le serveur choisit le texte dans une liste blanche |

## A. Inventaire du code propre à Toulon

Chaque ligne a été lue dans cette session. « Garde » = ce qui casse Toulon si on y touche mal.

### A.1 Projection et emprise

| Fichier:ligne | Valeur (verbatim) | Rôle | Pour Brest |
|---------------|-------------------|------|-----------|
| `js/geo.js:3-4` | `export const ORIGIN = { lat: 43.09, lon: 5.95 };` / `const KX = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320;` | Origine de **tous** les `toXY`/`toLL` | Origine par plan d'eau (`setOrigin`) ; Toulon garde 43.09 / 5.95 au bit près [VERIFIED: js/geo.js:3-10] |
| `js/geo.js:22-23` | `fmtLat` … `N`, `fmtLon` … `E` codés en dur | Affichage des positions | **Faux à l'Ouest** : vérifié, `fmtLon(-4.3605)` rend `0-5°38.370E` [VERIFIED: exécution node dans cette session] |
| `js/geo.js:29` | `async load(base = 'data/')` | Chargement du relief | Base par plan d'eau |
| `data/meta.json` | `"west": 5.8, "east": 6.1, "south": 43.0, "north": 43.18, "nx": 814, "ny": 667` | Emprise et grille | Fichier par plan d'eau [VERIFIED: data/meta.json] |
| `js/icplaus.js:11-12` | `export const BOUNDS = Object.freeze({ south: 43.0, north: 43.18, west: 5.8, east: 6.1 });` | Vraisemblance des positions lues dans les IC | Bornes du plan d'eau ; `tests/icplaus.test.mjs:86-88` exige l'égalité avec `data/meta.json` [VERIFIED] |
| `js/marks.js:34-42` | `export const RADE = { south: 42.9, north: 43.28, west: 5.7, east: 6.2 };` et le message `'Position hors de la rade de Toulon : vérifiez les degrés et l’hémisphère'` | Saisie « 43°05.845N 005°56.049E » (recalage, IC, corrections) | Bornes et message par plan d'eau ; vérifié : `parseLatLon('48°17,890 N 004°21,630 W')` est refusé, accepté avec des bornes de Brest [VERIFIED: exécution node] |
| `js/marks.js:91` | `const inRade = …RADE…` | Filtre des recalages partagés | Idem |
| `js/app.js:1524` | `lig.lat > 43 && lig.lat < 43.18 && lig.lon > 5.8 && lig.lon < 6.1` | Ligne enregistrée avec une trace (banane) | Bornes du plan d'eau |
| `js/app.js:106` | `const forbidden = [FORBIDDEN_ZONE.map((p) => toXY(p.lat, p.lon))];` | **Seul calcul XY fait au chargement du module** | Doit venir après le choix de l'origine [VERIFIED: grep des `toXY` de premier niveau : seule occurrence] |
| `js/app.js:172` | `T = await new Terrain().load('data/');` | Carte | Base du plan d'eau |
| `js/app.js:425` | `F.sample(toXY(43.088, 5.962)…)` | Badge « vent au centre de la rade » | Point de référence du plan d'eau |
| `js/scene3d.js:72`, `:85` | `this.home({ x: 900, y: -5200 }, 30000, 0.5)` ; `home(target = { x: 300, y: 600 }, dist = 13500, …)` | Cadrage initial (en mètres autour de `ORIGIN`) | Cadrage par plan d'eau |
| `js/scene3d.js:162`, `:195` | `'data/basemap.jpg'`, `'data/seamask.png'` | Textures | Base du plan d'eau |
| `js/debrief.js:500-503` | `img.src = 'data/basemap.jpg'` + `meta.west/east/north/south` | Carte du rapport HTML | Fond et emprise du plan d'eau de la trace |
| `js/wind.js:16-22` | `const CELL = 150; // m` ; grille = emprise / 150 m | Champ de vent | Le coût croît avec l'emprise (Toulon : environ 163 × 133 cellules) — à chiffrer dans l'étude plan d'eau |

### A.2 Catalogue CVAT (`js/courses.js`, figé par la garde SNPM)

[VERIFIED: js/courses.js:1-147] `PLACES` (20 lieux, l. 8-14), `MARKS` (11 bouées, l. 16-39), `DEFAULT_LINE` et `LINE_PRESETS` (`vignettes`, `mourillon`, `capbrun`, `grandrade`, l. 43-49), `FORBIDDEN_ZONE` (presqu'île de Saint-Mandrier, l. 53-57), `DANGERS` (l. 59-62), `COURSES` (parcours 1 à 13, l. 68-108), `IC` (Coupe SNPM, l. 110-147). Consommateurs : `js/app.js:6`, `js/tactics.js:3`, `js/debrief.js:9`, `js/scene3d.js:7`, `js/regates.js:7` (`IC as SNPM`, sert aussi de `COMMON` aux régates CVAT, l. 18-19) et une dizaine de tests (`calc`, `banane`, `debrief`, `gel`, `marks`, `regmarks`, `routememo`, `icplaus`, `markfit`, `regates`). La garde `git diff --quiet f80c365 -- js/courses.js tests/reference/` est vraie aujourd'hui [VERIFIED: exécutée dans cette session : `REF_OK`].

Autres valeurs Toulon hors de `courses.js` :
- `js/tactics.js:12-60` : `REGIMES` (calme, `mistral`, `ouest` « Labech », `thermique`, `marin`, `est` « Levant », `nord`) avec des conseils citant Cépet, Saint-Mandrier, Mourillon, Faron, Coudon, le CVAT [VERIFIED].
- `js/tactics.js:127` : `if (course.finishNear1) finish = { ...toXY(43.0955, 5.9325), …` (arrivée du parcours 9) [VERIFIED].
- `js/banane.js:35` : la banane part du preset `line: 'grandrade'` [VERIFIED].
- `js/app.js:1791-1793` : `PRESETS` de vent manuel `['Mistral fort', 315, 25, 34]`, `['Levant E', 85, 12, 17]`, etc. [VERIFIED].
- `js/app.js:1816` (texte « Cépet, Sicié, Cap Brun »), `:714` (« large de Cépet »), `:675`, `:702`, `:704`, `:710` (« centre de la rade », « connaissance de la rade »), `:763-783` (« cahier CVAT »), `:1850-1858` (`cvatKey`, exemple `43°05.845N 005°56.049E`), `:2201-2211` (onglet IC : « Pavillons de classe habituels CVAT », « Marques cahier de parcours CVAT », zone interdite de Saint-Mandrier) [VERIFIED].
- `js/marks.js:6`, `:89` : recalages `rade.marks.v1` limités aux clés numériques du cahier CVAT (`NUM_KEY = /^\d+$/`) ; partagés par l'archive (`api/archive.js:24` `MARK_KEY = /^\w{1,12}$/`, l. 70) [VERIFIED]. **Collision** : une bouée « 1 » de Brest et la bouée 1 du CVAT auraient la même clé.
- `js/icread.js:227-238` : lecture « par motifs » des IC CVAT (`icLooksCvat`), sinon offre de lecture IA [VERIFIED].

### A.3 Météo (`js/weather.js`)

[VERIFIED: js/weather.js:6-19, 59-73, 145-154]
- `MODELS` : `meteofrance_arome_france_hd`, `meteofrance_arome_france`, `meteofrance_arpege_europe`, `ecmwf_ifs025`, `icon_eu`, `gfs_seamless` (rien de propre à Toulon).
- `GRID` : `for (const lat of [43.045, 43.065, 43.085, 43.100]) for (const lon of [5.885, 5.920, 5.955, 5.990, 6.030, 6.075])` (24 points AROME HD).
- `CENTER = { lat: 43.085, lon: 5.958 }` ; cache `KEY = 'rade.wx.v1'`.
- Point marin en dur : `latitude=43.06&longitude=5.96` (vagues, **`ocean_current_velocity`, `ocean_current_direction`** déjà demandés, l. 67 ; lus par `marineAt`, l. 140).
- Balises Pioupiou filtrées par `l.latitude > 42.98 && l.latitude < 43.22 && l.longitude > 5.7 && l.longitude < 6.25`.
- `snapshot()` lit `data/wx-snapshot.json` (l. 78-80) ; `tools/snapshot_weather.py:5-6,19` recopie les mêmes `CENTER`, `GRID` et point marin.

### A.4 Outils de construction des données (hors déploiement)

[VERIFIED: tools/build_terrain.py:1-20, 34, 97, 161-166 ; tools/build_basemap.py:1-31]
- `build_terrain.py` : entrées `osm_extract.json` (OSM), `bathy.tif` (EMODnet), tuiles Terrarium `13_x_y.png` ; **emprise en dur** `W0, E0, S0, N0 = 5.80, 6.10, 43.00, 43.18`, `NX, NY = 814, 667`, **graines de remplissage de la mer en dur** `(5.95, 43.005), …`, **géoréférence du GeoTIFF EMODnet en dur** `BL0, BT0, BD = 5.7604166666666785, 43.21041666666666, …`, projection de simplification de côte centrée `5.95 / 43.1`.
- `build_basemap.py` : lit l'emprise dans `meta.json` (bien) mais **mêmes graines en dur** (l. 31).
- Aucun script ne télécharge `osm_extract.json`, `bathy.tif` ni les tuiles : la préparation des entrées n'est pas dans le dépôt. Paramétrer ces outils (`--venue brest`) est un travail de la vague données (voir l'étude plan d'eau pour les sources).

### A.5 Fonctions IA et textes

[VERIFIED: grep + lecture]
- `api/voice.js:11` : « … sur un J80 dans la rade de Toulon … ».
- `api/debrief.js:11` : « … qui régate dans la rade de Toulon … ».
- `api/rules.js:2`, `:13` (constante `CVAT` = IC habituelles du CVAT), `:23`, `:25`, `:31`, `:46` : arbitre « au CVAT, dans la rade de Toulon ».
- `api/ic.js:11` : `MAX_TEXT = 50000` (« les IC CVAT en font ~11 500 ») — **les IC GPEN 2026 font environ 56 500 caractères en texte brut** (mesuré sur l'extraction `pdftotext -layout`, mise en page comprise) : une lecture IA serait tronquée.
- `js/help.js:26`, `:34`, `:90` (« Préparer et courir les régates du CVAT en J80 dans la rade de Toulon »), `:172` ; `guide.html` (13 mentions Toulon/CVAT), `regles.html` (7), `index.html:7` (description « Rade de Toulon en 3D … parcours CVAT »).

### A.6 Service worker, middleware, fusion de l'archive (les trois points durs)

1. **SHELL généré par `tools/stamp.mjs`** : `DIRS = ['js', 'data', 'vendor', 'icons']`, parcours **récursif** (`walk`, l. 21-33) [VERIFIED: tools/stamp.mjs:13-48]. Tout fichier ajouté sous `data/` entre dans le précache. Le SHELL actuel compte 69 entrées pour **6,85 Mo**, dont **2,56 Mo de `data/`** [VERIFIED: calcul node sur le bloc de `sw.js` dans cette session]. À chaque nouvelle version, l'installation recharge **tout** le SHELL (`c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))`, `sw.js:10-12`) : mettre Brest dans le SHELL ferait passer chaque mise à jour d'environ 7 Mo à environ 10 Mo pour tous, même à Toulon.
2. **`sw.js` efface tout cache qui n'est pas celui de la version** : `ks.filter((k) => k !== VERSION)` dans `activate` [VERIFIED: sw.js:13-15]. Un cache de plan d'eau séparé serait détruit à chaque mise à jour si on ne change pas ce filtre. Les fichiers hors SHELL suivent « réseau d'abord, cache si hors ligne » (l. 26-30), sans délai : lent en mer avec un réseau faible.
3. **Middleware en liste blanche à un seul niveau** : `const FICHIER_DE_DOSSIER = /^\/(?:js|data|vendor|icons|rapports)\/[A-Za-z0-9][A-Za-z0-9._-]*$/;` [VERIFIED: middleware.js:45]. `data/venues/brest/terrain.bin` répondrait **404**. Des noms plats (`data/brest.terrain.bin`) passent sans toucher au middleware ; un sous-dossier exige de modifier la regex et ses tests (`tests/access.test.mjs:270-280`).
4. **Fusion de l'archive** : `export const HEAD = ['name', 'club', 'dateStart', 'dateEnd', 'season', 'ic'];` et `mergeRegatta` reconstruit la régate avec `{ id, ...hw, by, at }` + listes + `frozen`, `tomb`, `hist` [VERIFIED: js/archmerge.js:8, 62, 68-100]. **Tout autre champ de premier niveau est perdu à la fusion**, côté téléphone comme côté serveur (`api/archive.js` importe le même module). De plus, une v42 qui fusionne une fiche sans `venue` avec le même `u` peut l'emporter par comparaison de contenu (`winsC`, l. 33-35).
5. **Gel de la stratégie** : déjà en latitude / longitude, « jamais en x / y » [VERIFIED: js/gel.js:91-96]. Les régates archivées ne dépendent donc pas de l'origine de projection. Les traces (`rade-traces`) sont aussi en lat/lon.

## B. GPEN — documents, zone J80, parcours

### B.1 Documents trouvés (URL exactes, copies locales)

Copies téléchargées (données non fiables, rien n'a été exécuté dedans ; chaque fichier dans son dossier) sous `/tmp/claude-0/-home-user/926bb538-7b85-59d9-9d1a-dfdf8d036029/scratchpad/gpen/` ; textes extraits dans `…/gpen/txt/`, pages rendues dans `…/gpen/img/`.

| Édition | Document | URL | Copie locale |
|---------|----------|-----|--------------|
| 2026 (13-17 mai) | IC avec avenants 1, 2 et 3 (version la plus complète) | https://agpen.fr/wp-content/uploads/2026/05/GPEN-2026-Instructions-de-course-Incluant-les-avenants-1-2-et-3.pdf | `ic2026v3/ic-2026-av123.pdf` |
| 2026 | IC avec avenant 1 | https://cfcl.ffvoile.fr/media/hqmfb4lx/gpen-2026-instructions-de-course-incluant-lavenant1.pdf | `ic2026/ic-2026.pdf` |
| 2026 | Avis de course | https://agpen.fr/wp-content/uploads/2026/03/2026-AC-GPEN-CFMH-VF1.pdf | `ac2026/ac-2026.pdf` |
| 2026 | Note n°2 de la direction de course (programme du samedi) | https://agpen.fr/wp-content/uploads/2026/05/GPEN-2026-Note2-Programme-samedi-16-mai-PRO-1.pdf | `note2026prog/note-programme-samedi.pdf` |
| 2025 (28 mai-1er juin) | IC | https://agpen.fr/wp-content/uploads/2025/05/GPEN-2025-Instructions-de-course-VF-20-mai.pdf | `ic2025/ic-2025.pdf` |
| 2025 | IC avenant 1 / avenant 2 | https://agpen.fr/wp-content/uploads/2025/05/GPEN-2025-IC-Avenant-N°1-29-mai.pdf ; https://agpen.fr/wp-content/uploads/2025/05/GPEN-2025-IC-Avenant-N°2-30-mai.pdf | `ic2025av1/`, `ic2025av2/` |
| 2025 | Avis de course (avenant 1) | https://agpen.fr/wp-content/uploads/2025/05/AC-2025-GPEN-CFMH_VF2-Avenant-N1.pdf | `ac2025/ac-2025.pdf` |
| 2024 (8-12 mai) | IC avec avenant 1 | https://handivalide.ffvoile.fr/media/lxdmejok/gpen-2024-instructions-de-course-incluant-lavenant1-07-mai-2024.pdf | `ic2024/ic-2024.pdf` |
| 2024 | Avis de course | https://handivalide.ffvoile.fr/media/z5rnoncm/avis-de-course-gpen-2024.pdf | `ac2024/ac-2024.pdf` |
| 2023 | IC du 16 mai | https://www.agpen.fr/wp-content/uploads/2023/05/GPEN-2023-Instructions-de-course-16-Mai-2023.pdf | `ic2023/ic-2023.pdf` |
| 2023 | Avis de course | https://www.agpen.fr/wp-content/uploads/2023/05/20230302_AC-GPEN-CFMH_VF.pdf | `ac2023/ac-2023.pdf` |
| 2022 (25-29 mai) | IC | https://www.cncm.fr/wp-content/uploads/2022/05/20220521_gpen-2022_instructions-de-course.pdf | `ic2022/ic-2022.pdf` |
| 2016 | Résultats J80 (pas des IC, malgré le nom) : 46 inscrits, 8 courses | https://www.classej80france.com/wp-content/uploads/2016/05/GPEN-2016-Définitif.pdf | `ic2016/ic-2016.pdf` |

Tableaux officiels : https://agpen.fr/gpen-2026/tableau-officiel-2026/, https://agpen.fr/gpen-2025/tableau-officiel-2025/, https://agpen.fr/gpen-2023/tableau-officiel-2023/ (la page 2024 répond 404). **GPEN 2027 : « 2027 du 5 au 9 mai ! »** [VERIFIED: page d'accueil https://agpen.fr/ lue le 2026-11-19]. Les résultats J80 2026 vont jusqu'à « résultat après course 9 » (https://agpen.fr/resultats-2026/) [VERIFIED: liens de la page].

### B.2 Zone de course J80

| Élément | Valeur | Années | Source |
|---------|--------|--------|--------|
| Zone | « Zone A - Ecole Navale - Rose » | 2024, 2025, 2026 (2022 : « Zone A Jaune - Ecole navale (J80,) » ; 2023 : « Zone A-Ecole Navale ») | [CITED: IC 2022 §3.1 ; IC 2023 annexe 1 ; IC 2024, 2025, 2026 annexe 1] |
| Centre | **48°17,890 N 004°21,630 W** | identique 2023, 2024, 2025, 2026 | [CITED: IC 2026 annexe 1 l. « Zone A - Ecole Navale - Rose 1,2 NM 48°17,890 N 004°21,630 W »] |
| Diamètre | **1,2 NM** | 2024-2026 | idem |
| VHF | **14** (« Zone A VHF 14 : Ecole Navale sur le bâtiment « Albatros » ») | 2022-2026 | [CITED: IC 2026 §5.1.1] |
| Pavillon de classe | « Sigle J80 » | 2022-2026 | [CITED: IC 2026 §7] |
| Accueil / jury | École navale Lanvéoc-Poulmic, bâtiment Ailée | 2023-2026 | [CITED: IC 2026 §17.2 ; AC 2026 annexe 2] |
| Zones voisines (autres séries, pas pour nous) | B École Navale 48°17,040 N 004°24,650 W (2026 ; 004°24,090 W en 2024-2025), C Brest 48°23,120 N 004°25,340 W, Camaret 48°17,880 N 004°35,460 W, E Crozon-Morgat 48°13,310 N 004°28,470 W, F Roscanvel 48°19,095 N 004°31,650 W | | [CITED: IC 2026 annexe 1] |
| Zones interdites | « Ile Longue : La navigation autour de l'Ile longue dans la zone balisée par les marques spéciales numérotées de 0 à 10 est formellement interdite. » ; « Pen Ar Vir : … interdit de naviguer entre la marque cardinale Pen Ar Vir et la pointe du même nom » | 2022-2026 | [CITED: IC 2026 annexe 5] — positions des marques 0 à 10 **non données en texte** (carte image) : à relever pour le pack (étude plan d'eau) |

### B.3 Parcours J80 (annexe 3.1 « Parcours zone A »)

Schéma (IC 2026 p. 11, rendu dans `…/gpen/img/ic2026-p11-11.png`) : bouée 1 au vent, bouée 2 de dégagement à sa gauche (en regardant au vent), porte 3S/3P sous le vent un peu au vent de la ligne, ligne de départ entre le bateau comité (tribord) et une bouée blanche ou un viseur (bâbord), **ligne d'arrivée à droite du comité** (bouée « Arrivée »).

| Parcours | Signal | Séquence (verbatim IC 2026) | Années |
|----------|--------|------------------------------|--------|
| Parcours 1 (2 tours) | Flamme numérique n°1 | « Départ – 1 – 2 - 3S/3P – 1 – 2 - 3P - Arrivée » | 2024-2026 (2022 : « Parcours technique 2 Tours (Pavillon Jaune) », porte nommée 3A/3B) |
| Parcours 2 (3 tours) | Flamme numérique n°2 | « Départ – 1 – 2 - 3S/3P – 1 – 2 - 3S/3P – 1 – 2 - 3P - Arrivée » | 2024-2026 (2022 : pavillon jaune + flamme 3) |
| Virginie Hériot | Pavillon jaune (+ flamme 3 pour 3 tours en 2024) + pavillon GPEN | « Départ - 1 – 2 - 3S/3P – 1 - 2, 3S/3P - Arrivée » ; arrivée **décalée** « entre une bouée blanche à laisser à bâbord et un mât à terre arborant un pavillon Bleu devant la chapelle de l'Ecole Navale » | 2022-2026 |

Règles de parcours utiles au moteur [CITED: IC 2026] :
- Marques 1 et 2 à bâbord ; 3 = porte 3S/3P ou bouée 3P seule à bâbord ; « En cas d'absence d'une des marques d'une porte, la marque restante devra être contournée à bâbord » (§10.3).
- Couleurs zone A : départ blanche (ou viseur), parcours **orange** (« pourront être robotiques »), changement de parcours **verte**, arrivée **blanche** (§10.1, annexe 3.1).
- §9.2 : « le comité de course indiquera si nécessaire le parcours à effectuer, le cap et la longueur approximatifs du premier bord ».
- §13.2 (2026) : une marque peut être déplacée de ±10° et jusqu'à environ 200 m sans signal de changement.
- §13.3 : changement signalé à la porte 3 → seule la marque 1 est remouillée (la 2 est supprimée) ; changement signalé à la marque 1 ou 2 → la porte 3 devient une seule marque 3P.

### B.4 Règles qui changent les réflexes (pour l'onglet IC et l'arbitre)

[CITED: IC 2026 sauf mention]
- **Pénalité un tour** pour toutes les classes (RCV 44.1 modifiée, §15.1) ; jugement semi-direct possible en zone A (§15.2, annexe 2 : pavillon rouge et « Protest » ; juge : vert et blanc = pas de pénalité, rouge = pénalité).
- **DNS** si départ plus de 4 minutes après son signal (§12.4).
- Pavillon **orange** au moins 2 minutes avant l'avertissement (§6.1) ; aperçu à terre : pas d'avertissement moins d'une heure après l'amené pour la zone A (§5.2).
- Temps limite J80 : **90 min** pour le premier, **20 min** après le premier (§16).
- Classement : 3 courses pour valider ; une course retirée dès 4 courses (§18.1-18.2).
- Bout-dehors sorti seulement pour le spi (§19.3) ; gilet (EIF) obligatoire de la sortie au retour (§19.2).
- Réclamations : 60 min après la dernière arrivée du jour (§17.1).
- Programme 2026 (AC annexe 3) : jeudi 14 mai 1er signal 14 h 30, vendredi 10 h 45, samedi 10 h 30 ; note n°2 : samedi 4 courses programmées pour les J80, pas d'avertissement après 16 h 00. Soit environ **3 courses par jour**, 9 courses au total en 2026 ; 8 en 2016.
- Aucun parcours côtier pour les J80 (les côtiers 2025-2026 sont ceux de la zone Camaret, autres séries).

### B.5 Ce qu'il faut pour un « catalogue GPEN » dans l'app

Le GPEN J80 n'a **pas de bouées fixes** : c'est un parcours construit au vent dans un cercle connu. Ce n'est donc pas un « cahier » comme celui du CVAT, mais :
1. une **zone** (cercle centre 48°17,890 N 004°21,630 W, rayon 0,6 NM) affichée sur la carte, et un preset de ligne par défaut dans la zone (à pinger sur l'eau, fonction existante) ;
2. un **parcours construit** dérivé de la banane de phase 6 (`js/banane.js`) : B = marque 1, C = marque 2 (dégagement à bâbord), porte = 3S/3P, tours = 2 (flamme 1) ou 3 (flamme 2), dernier passage par 3P seule puis arrivée ; **une forme d'arrivée nouvelle** « à droite du comité » (la banane connaît `FINS = ['depart', 'sousvent', 'auvent']` [VERIFIED: js/banane.js:9]) et la variante Virginie Hériot (arrivée à terre devant la chapelle : position à relever, [ASSUMED] pas de coordonnées dans les IC) ;
3. une **fiche IC type « GPEN J80 »** (VHF 14, pavillons, pénalité un tour, temps limites, DNS 4 min, zones interdites) semée comme la Coupe SNPM l'est aujourd'hui (`js/regates.js:79` `SEED_ID = 'snpm-2026'`) ;
4. les **marques fixes** du plan d'eau utiles en entraînement (cardinales, latérales, Île Longue 0-10) : relevé dans l'étude plan d'eau.

Valeurs de longueur du bord de près : non données par les IC (annoncées par le comité, §9.2) ; la banane accepte `nm` entre 0,3 et 2 Nq [VERIFIED: js/banane.js:21] ; une zone de 1,2 NM de diamètre suggère un près d'environ 0,6 à 1 Nq [ASSUMED].

## Architecture proposée : le pack de plan d'eau

### Schéma

```
Démarrage (index.html → js/app.js)
   │
   ├─ lit S.venue (localStorage 'rade.state', défaut 'toulon')
   │     └─ régate ouverte ? → venueOf(régate) l'emporte (champ venue, sinon déduit de ses bouées, sinon 'toulon')
   │
   ├─ js/venues.js : REGISTRE synchrone (petit, dans le SHELL)
   │     toulon → références directes à js/courses.js, js/weather.js, data/*  (rien ne bouge)
   │     brest  → descripteur js/venue-brest.js (origine, bornes, lieux, zone GPEN, presets, régimes, IC type)
   │
   ├─ setOrigin(venue.origin)  ── AVANT tout toXY (js/app.js:106 devient un calcul de démarrage)
   ├─ js/lieu.js : exports vivants MARKS, COURSES, LINE_PRESETS, PLACES, DANGERS, FORBIDDEN_ZONE, REGIMES…
   │     (Toulon : MÊMES objets que courses.js → injection des bouées de régate inchangée)
   │
   ├─ Fichiers lourds : venue.files → 'data/meta.json'… (Toulon, SHELL)
   │                                 'data/brest.meta.json'… (Brest, hors SHELL)
   │        └─ Brest absent du cache ? → « Télécharger le plan d'eau (x Mo) » (geste, réseau)
   │              → page : fetch + contrôle SHA-256 (manifeste) → cache 'rade-venue-brest-<hash>'
   │              → sw.js : cache-first pour tout 'rade-venue-*', jamais effacé par activate
   │
   └─ Terrain, WindField, Scene3D, météo (CENTER/GRID/marine/balises du plan d'eau) → l'app habituelle

Changer de plan d'eau = persister S.venue puis recharger la page (jamais en course : racelock)
```

### Structure de fichiers recommandée (noms plats : middleware inchangé)

```
js/venues.js           # registre { toulon, brest } + venueOf(regatta), boundsOf, inVenue(lat, lon)
js/venue-brest.js      # descripteur Brest (petit, JSON-like) — dans le SHELL
js/lieu.js             # plan d'eau courant : exports vivants, setVenue() appelé une fois au démarrage
js/courses.js          # INCHANGÉ (descripteur Toulon de fait)
data/meta.json …       # INCHANGÉS (pack Toulon, dans le SHELL)
data/brest.meta.json   # pack Brest : meta, terrain.bin, cover.bin, coast.json, basemap.jpg, seamask.png, wx-snapshot.json
data/brest.terrain.bin #   → exclus du SHELL par tools/stamp.mjs (règle : data/<venue>.* où venue ≠ toulon)
data/venues.json       # manifeste généré par stamp : par plan d'eau, liste des fichiers, tailles, SHA-256 (10 hex) — dans le SHELL
```

### Motif 1 : origine de projection réglable, Toulon au bit près

**Quoi :** `ORIGIN`/`KX` deviennent des liaisons vivantes réglées une fois au démarrage. Pour Toulon, les valeurs et l'ordre des opérations sont identiques, donc les flottants aussi.
```javascript
// js/geo.js (esquisse) — valeurs Toulon recopiées de js/geo.js:3-4
export let ORIGIN = { lat: 43.09, lon: 5.95 };
let KX = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320;
export function setOrigin(o) {              // appelé UNE fois, avant tout toXY ; jamais en cours de session
  ORIGIN = { lat: o.lat, lon: o.lon };
  KX = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320;
}
```
**Pourquoi recharger plutôt que basculer à chaud :** `T`, `F` (et ses `kits` par direction), `scene`, `forbidden`, les routes mémorisées (`F.gen`) et l'analyse sont en XY ; un rechargement garantit qu'aucun objet ne survit d'une origine à l'autre.

### Motif 2 : plan d'eau d'une régate qui survit à la fusion

- Ajouter `'venue'` à `HEAD` (`js/archmerge.js:8`) ; accepter et borner la valeur dans `api/archive.js` (liste blanche des identifiants).
- `venueOf(r) = r.venue ?? déduit(r.marks) ?? 'toulon'` : une fiche venue d'une v42 (sans champ) reste à Toulon ; une fiche dont les bouées confirmées sont à Brest est à Brest même si le champ a été perdu.
- Outil de compatibilité `tools/compat-v42.mjs` sur le modèle de `tools/compat-v41.mjs` (fiches v42 ↔ v43 dans les deux sens, fusion côté serveur).

### Motif 3 : pack lourd hors SHELL, intègre et durable

- `tools/stamp.mjs` : exclut `data/<venue>.*` (venue ≠ toulon) du SHELL **et** écrit `data/venues.json` (tailles + empreintes) ; le hachage de version doit inclure ce manifeste.
- `sw.js` : `activate` garde les caches `rade-venue-*` ; `fetch` sert d'abord ces caches pour les chemins du manifeste.
- La page télécharge, vérifie l'empreinte avec `crypto.subtle.digest('SHA-256', …)`, puis écrit dans `rade-venue-<id>-<hash>` ; supprime l'ancien cache du même plan d'eau seulement après succès.
- Une régate à Brest ouverte avec réseau propose le téléchargement ; l'onglet « Plan d'eau » montre « prêt hors réseau » / « à télécharger (x Mo) ».

### Anti-motifs à éviter
- **Déménager `js/courses.js` ou `data/*` de Toulon dans un sous-dossier** : casse la garde SNPM, change les URL du SHELL (re-téléchargement), touche au middleware, sans aucun gain.
- **Mettre Brest dans le SHELL** : +2,5 à 3,5 Mo à chaque mise à jour pour tout l'équipage, ouverture hors réseau plus lourde.
- **Basculer de plan d'eau sans recharger** : objets XY périmés (zone interdite, routes, kits de vent).
- **Ajouter un champ de premier niveau à la régate sans l'ajouter à `HEAD`** : perdu à la première synchronisation.
- **Clé de recalage numérique partagée entre plans d'eau** : la bouée « 1 » de Brest recalerait la bouée 1 du CVAT. Garder le recalage pour Toulon seul (clés numériques) ; au besoin préfixer les autres (`b1`, compatible `MARK_KEY = /^\w{1,12}$/`).

## Ne pas réinventer

| Problème | Ne pas écrire | Utiliser | Pourquoi |
|----------|---------------|----------|----------|
| Parcours construit GPEN | Un nouveau moteur de parcours | `bananeCourse` / `buildLegs` (`js/banane.js`, `js/tactics.js`) + une forme d'arrivée en plus | Porte, dégagement, conseil de porte (`adviseGate`), débrief déjà testés en phase 6 |
| Bouées d'une régate d'un autre club | Un format à part | `js/regmarks.js` (bouées `X1…`, parcours 101+, confirmation) | Déjà partagé par l'archive et confirmé à la main |
| Gel Toulon | Comparaisons « à l'œil » | Fixture capturée avant modification, comme `tests/fixtures/legs-v37.json` | Méthode éprouvée en phase 6 (« bords v37 figés ») |
| Empreintes de fichiers | Un hachage maison | `crypto.subtle.digest` (page) et `node:crypto` (stamp, déjà utilisé) | Standard, sans dépendance |
| Lecture des coordonnées Ouest | Un nouveau lecteur | `parseCoord` (gère déjà `W`/`O`, vérifié) avec des bornes par plan d'eau | Seules les bornes et le message sont propres à Toulon |

## Gardes « Toulon ne change pas d'un bord »

1. **Garde SNPM littérale conservée** : `git diff --quiet f80c365 -- js/courses.js tests/reference/` (aucun déménagement → pas besoin de garde de remplacement).
2. **Données Toulon figées** : `git diff --quiet 56f6625 -- data/meta.json data/terrain.bin data/cover.bin data/coast.json data/basemap.jpg data/seamask.png data/j80.pol data/wx-snapshot.json` (56f6625 = v42 actuelle).
3. **Fixture Toulon v42** capturée sur 56f6625 **avant toute modification** (vague 0) : bords et routes des parcours 1-13 (G et P, plusieurs vents), banane (réglages par défaut et variantes), échantillons `F.sample` sur une grille, `fmtLat`/`fmtLon`/`parseLatLon` sur les bouées du cahier, détection du parcours sur la trace SNPM, emprise de la carte du rapport. Test `deepEqual` ; règle D-12 : jamais réécrite sans l'accord de Romain.
4. **SHELL** : seules entrées nouvelles autorisées = modules `js/` et `data/venues.json` ; aucun fichier Brest lourd (test sur `listShell`).
5. **Compatibilité archive** v42 ↔ v43 (motif 2).
6. **Scénarios navigateur** existants (`tools/regate-e2e.mjs`) et `tools/measure-boot.mjs` (interface utile < 2 000 ms) inchangés pour Toulon.

## Pièges courants

### Piège 1 : longitudes Ouest mal écrites
**Ce qui casse :** positions affichées `0-5°38.370E`, fiches de bouées illisibles, aller-retour affichage → saisie faux. **Cause :** `fmtLon` suppose l'Est (`js/geo.js:23`). **Parade :** branche `lon < 0` → `004°21.630W`, sortie Est inchangée (fixture). **Signe :** un « - » dans une position affichée.

### Piège 2 : positions de Brest refusées partout
**Cause :** `RADE`, `BOUNDS`, `js/app.js:1524` et le message « hors de la rade de Toulon ». **Parade :** bornes du plan d'eau courant (ou de la régate) ; `tests/icplaus.test.mjs:86-88` à étendre (bornes = meta du pack).

### Piège 3 : champ `venue` effacé par la synchronisation
**Cause :** `HEAD` / `mergeRegatta`. **Parade :** motif 2 + outil de compatibilité.

### Piège 4 : pack effacé à chaque mise à jour, ou re-téléchargé
**Cause :** `activate` efface tout sauf `VERSION` ; `stamp` met tout `data/` dans le SHELL. **Parade :** motif 3.

### Piège 5 : 404 sur les fichiers du pack
**Cause :** liste blanche à un niveau du middleware. **Parade :** noms plats `data/brest.*` (aucun changement du middleware, sujet sensible).

### Piège 6 : coût du champ de vent sur une grande emprise
**Cause :** `WindField` = emprise / 150 m, 420 itérations par direction (`js/wind.js:16, 88`). Une emprise rade + goulet + Camaret serait plus grande que Toulon. **Parade :** emprise à décider dans l'étude plan d'eau ; mesurer avec `tools/measure-boot.mjs`.

### Piège 7 : lecture IA des IC GPEN tronquée
**Cause :** `MAX_TEXT = 50000` (`api/ic.js:11`) ; les IC GPEN 2026 font environ 56 500 caractères extraits. **Parade :** semer la fiche GPEN dans le pack (pas besoin de lecture IA) ; si lecture IA voulue, n'envoyer que les pages utiles (zone A, annexes 1, 3.1, 5).

### Piège 8 : consignes IA qui disent « Toulon » à Brest
**Cause :** textes fixes dans `api/voice.js`, `api/debrief.js`, `api/rules.js`. **Parade :** le client envoie un identifiant de plan d'eau ; le serveur choisit le texte dans une liste blanche (jamais de texte libre injecté dans la consigne).

### Piège 9 : collision des recalages de bouées
**Cause :** clés numériques partagées (`rade.marks.v1`, `doc.marks`). **Parade :** recalage limité à Toulon, ou clés préfixées pour les autres plans d'eau.

## Exemples de code

### Déduire le plan d'eau d'une régate (esquisse)
```javascript
// js/venues.js (esquisse) — 'toulon' et ses bornes : js/marks.js:35 « RADE = { south: 42.9, north: 43.28, west: 5.7, east: 6.2 } »
export const VENUES = { toulon: { id: 'toulon', bounds: { south: 42.9, north: 43.28, west: 5.7, east: 6.2 } /* … */ }, brest: BREST };
const dans = (b, m) => Number.isFinite(m?.lat) && m.lat >= b.south && m.lat <= b.north && m.lon >= b.west && m.lon <= b.east;
export function venueOf(r) {
  if (r?.venue && Object.hasOwn(VENUES, r.venue)) return r.venue;
  const conf = (r?.marks || []).filter((m) => Number.isFinite(m?.lat));
  const hit = Object.values(VENUES).find((v) => conf.length && conf.every((m) => dans(v.bounds, m)));
  return hit?.id ?? 'toulon';
}
```
Les bornes de Brest (`BREST.bounds`) sont à fixer dans l'étude plan d'eau [ASSUMED].

## État de l'art (dans ce dépôt)

| Ancienne façon | Façon actuelle | Quand | Conséquence |
|----------------|----------------|-------|-------------|
| SHELL tenu à la main | `tools/stamp.mjs` génère SHELL et version | phase 1 | Tout fichier de `data/` est précaché : règle d'exclusion à ajouter |
| Stratégie en XY | Stratégie gelée en lat/lon (`js/gel.js:91`) | phase 4-5 | Archive indépendante de l'origine |
| Parcours 1-13 seulement | Banane construite + porte + arrivée décalée | phase 6 | Base directe du parcours GPEN |

## Journal des hypothèses

| # | Hypothèse | Section | Risque si faux |
|---|-----------|---------|----------------|
| A1 | Près GPEN d'environ 0,6 à 1 Nq dans un cercle de 1,2 NM | B.5 | Réglage par défaut de la longueur ; le comité l'annonce de toute façon |
| A2 | La forme et le règlement du parcours J80 de 2027 seront ceux de 2024-2026 | B.3 | Catalogue à corriger à la publication des IC 2027 (fin avril 2027) |
| A3 | Pas de coordonnées de la chapelle de l'École navale dans les IC : arrivée Virginie Hériot à relever | B.3 | Arrivée VH approximative tant que non relevée |
| A4 | Jours de course 2027 jeudi 6 à samedi 8 mai (2026 : jeudi après-midi, vendredi, samedi) dans la fenêtre « du 5 au 9 mai » | B.1 | Dates de la fiche semée à corriger |
| A5 | Taille d'un pack Brest comparable à Toulon (2,5 à 3,5 Mo) | A.6 | Dépend de l'emprise (étude plan d'eau) |
| A6 | `crypto.subtle` disponible dans la page (contexte sécurisé HTTPS) sur iPhone | Motif 3 | Repli : vérification de taille seule |
| A7 | Le recalage partagé des bouées n'est utile qu'à Toulon (GPEN : bouées mobiles) | Pièges | Si l'équipage veut recaler des marques fixes à Brest, il faut des clés préfixées |

## Questions ouvertes pour Romain (propositions avec défaut recommandé)

1. **Toulon reste où il est** (`js/courses.js`, `data/*` inchangés, garde SNPM littérale) — *défaut : oui*. Alternative : déménager dans un pack et remplacer la garde (déconseillé).
2. **Brest hors réseau** : téléchargé à la demande (bouton « Télécharger le plan d'eau », proposé automatiquement quand une régate à Brest est ouverte avec du réseau) — *défaut : oui*. Alternative : Brest dans l'app pour tous (+3 Mo à chaque mise à jour).
3. **Changer de plan d'eau recharge l'app** (quelques secondes, jamais en course) — *défaut : oui*.
4. **Fiche « GPEN 2027 — J80 » semée** dans l'archive, dates 5 au 9 mai 2027, VHF 14, règles des IC 2026, à mettre à jour avec les IC 2027 — *défaut : oui*.
5. **Catalogue GPEN** : zone A J80 seule (parcours 1, 2, Virginie Hériot) — *défaut : oui* ; les côtiers de Camaret et les autres zones restent hors périmètre.
6. **Arrivée GPEN** : nouvelle forme « ligne à droite du comité » ajoutée à la banane, sans changer les trois formes existantes — *défaut : oui*.
7. **Recalage des bouées** réservé à Toulon — *défaut : oui*.
8. **Consignes de l'arbitre IA et du débrief** adaptées au plan d'eau (IC GPEN : pénalité un tour, DNS 4 min…) — *défaut : oui*.
9. **Nom de l'app** « Rade Tactique » inchangé ; description et aide rendues neutres (Toulon et Brest) — *défaut : oui*.

## Disponibilité de l'environnement

| Dépendance | Requise par | Disponible | Version | Repli |
|------------|-------------|-----------|---------|-------|
| Node.js | tests, stamp | ✓ | v22.23.5 (le `package.json` demande 24.x pour Vercel) | — |
| Python 3 + numpy + Pillow | construction du pack Brest | ✓ | numpy 2.5.3, Pillow 12.3.0 | — |
| `pdftotext` / `pdftoppm` | lecture des IC (recherche seulement) | ✓ | poppler | — |
| Entrées OSM / EMODnet / Terrarium pour Brest | vague données | non préparées | — | voir `07-RESEARCH-PLAN-EAU.md` |

Aucun paquet externe à installer : **pas d'audit de légitimité nécessaire** (aucun paquet nouveau).

## Domaine sécurité

### Catégories ASVS concernées

| Catégorie ASVS | S'applique | Contrôle standard |
|----------------|-----------|-------------------|
| V2 Authentification | non (inchangée) | middleware existant |
| V3 Sessions | non | — |
| V4 Contrôle d'accès | oui | Les fichiers du pack restent sous `data/` derrière le middleware (noms plats, liste blanche inchangée) ; aucune nouvelle route publique |
| V5 Validation des entrées | oui | `venue` validé par liste blanche côté serveur (`api/archive.js`) et côté page ; identifiant de plan d'eau envoyé aux fonctions IA choisi dans une liste fermée |
| V6 Cryptographie | oui (intégrité) | SHA-256 via `crypto.subtle` / `node:crypto`, jamais de hachage maison |

### Menaces connues

| Menace | STRIDE | Parade |
|--------|--------|--------|
| Fichier de pack altéré ou tronqué mis en cache (réseau faible, proxy) | Altération | Empreinte du manifeste vérifiée avant écriture dans le cache ; ancien cache gardé jusqu'au succès |
| Injection de consigne via un nom de plan d'eau libre | Altération | Identifiant en liste blanche ; textes de consigne côté serveur |
| Pollution de prototype via `venue` | Altération | `DANGER` déjà filtré dans `archmerge`/`archive` ; `Object.hasOwn(VENUES, id)` |
| Fuite des codes d'accès dans les documents | Divulgation | Aucun code ni empreinte dans les plans et commits (règle du projet) |

## C et D — renvoi et pistes transmises

**Renvoi :** relief, côte, fonds, repères, zones interdites, lieux, vents, effets de site, courants et marées : **`07-RESEARCH-PLAN-EAU.md`** (étude dédiée). Pistes déjà notées ici, non vérifiées au-delà de ce qui est indiqué :
- Zone J80 à couvrir au minimum : cercle de 1,2 NM autour de 48°17,890 N 004°21,630 W [CITED: IC 2026] ; zones interdites à cartographier : Île Longue (marques spéciales 0 à 10) et passage de Pen ar Vir [CITED: IC 2026 annexe 5].
- Le code demande déjà `ocean_current_velocity` / `ocean_current_direction` à Open-Meteo marine pour un point (`js/weather.js:67`) [VERIFIED] ; la résolution et la prise en compte de la marée de cette source dans la rade sont à vérifier [ASSUMED].
- Les outils `build_terrain.py` / `build_basemap.py` ont l'emprise, les graines de remplissage de la mer et la géoréférence EMODnet en dur (A.4) : à paramétrer.
- Le champ de vent coûte proportionnellement à l'emprise (Piège 6).
- Noms de vent et conseils locaux : `REGIMES` (tactics) et `PRESETS` (app) sont à fournir par le pack Brest.

## Plan de livraison recommandé (E)

Calendrier : aujourd'hui 19 novembre 2026 ; régate de Toulon le 13 décembre ; **pas de mise en production dans les 48 h avant** (règle du projet) → production au plus tard le **jeudi 10 décembre**, cible **samedi 5 décembre** pour laisser une semaine de marge et une sortie d'entraînement. Chaque vague garde toutes les gardes vertes ; si une garde Toulon casse et qu'on ne sait pas pourquoi, **on ne livre rien de cette vague avant le 13**.

| Vague | Contenu | Touche Toulon ? | Dépend de |
|-------|---------|-----------------|-----------|
| **0 — Gel** | Fixture Toulon v42 capturée sur 56f6625 avant tout ; test « Toulon figé » ; garde des fichiers `data/` | non (ajouts de tests) | — |
| **1 — Plomberie neutre** | `js/venues.js` (Toulon par référence), `js/lieu.js`, `setOrigin`, `forbidden` au démarrage, météo paramétrée (Toulon garde `rade.wx.v1`, mêmes URL), bornes par plan d'eau, `fmtLon` Ouest, `S.venue` (défaut `'toulon'`), `venue` dans `HEAD` + déduction + `tools/compat-v42.mjs`, recalage limité à Toulon | code oui, résultats non (fixture identique) | 0 |
| **2 — Pack et hors réseau** | `stamp.mjs` (exclusion + manifeste), `sw.js` (caches `rade-venue-*`), téléchargement vérifié, choix du plan d'eau (entraînement libre, fiche de régate), verrou en course, aide | `sw.js` oui (mise à jour pour tous) | 1 |
| **3 — Données Brest** | Outils paramétrés, fichiers `data/brest.*`, lieux, dangers, zone interdite, régimes et presets de vent, instantané météo | non (fichiers nouveaux hors SHELL) | 2 + `07-RESEARCH-PLAN-EAU.md` |
| **4 — GPEN** | Zone A sur la carte, parcours GPEN (banane + arrivée « à droite du comité », 2/3 tours, Virginie Hériot), fiche « GPEN 2027 — J80 » semée, onglet IC, consignes IA par plan d'eau, guide | banane : ajout d'une forme, fixture identique | 3 |
| **5 — Mise en ligne** | Scénarios navigateur Toulon + Brest, mesure d'ouverture, compatibilité, aperçu, production sur « publie » de Romain | — | 4 |

Les vagues 3 et 4 n'ont aucun effet sur Toulon par construction (fichiers hors SHELL, forme d'arrivée ajoutée) ; les vagues 1 et 2 sont les seules à risque et partent en premier, pour avoir le plus de temps d'usage réel avant le 13.

### Risques
- **Vague 2 (service worker)** : une erreur bloque l'ouverture hors réseau de tous les téléphones → tests `tests/sw.test.mjs` étendus, mesure hors réseau `tools/measure-boot.mjs`, installation vérifiée sur iPhone avant « publie ».
- **Archive** : mélange v42/v43 pendant la transition → déduction du plan d'eau par les bouées + outil de compatibilité ; mettre à jour les trois téléphones le même jour.
- **Données Brest** dépendantes de l'étude plan d'eau : si elles ne sont pas prêtes, livrer 0-2 et 4 sans carte de Brest ? Non recommandé (le parcours a besoin de la carte) : décaler 3-4 après le 13 décembre reste sans conséquence (GPEN en mai 2027).
- **IC 2027** publiées fin avril 2027 : prévoir une petite mise à jour du catalogue à ce moment-là.

## Sources

### Primaires (HAUTE confiance)
- Code du dépôt lu dans cette session : `js/geo.js`, `js/courses.js`, `js/weather.js`, `js/wind.js`, `js/tactics.js`, `js/banane.js`, `js/marks.js`, `js/icplaus.js`, `js/archmerge.js`, `js/gel.js`, `js/debrief.js`, `js/scene3d.js`, `js/regates.js`, `js/app.js` (extraits), `api/archive.js`, `api/*.js` (consignes), `middleware.js` (liste blanche seulement), `sw.js`, `tools/stamp.mjs`, `tools/build_terrain.py`, `tools/build_basemap.py`, `tests/reference.test.mjs`.
- Exécutions dans cette session : garde SNPM (`REF_OK`), `fmtLon` / `parseLatLon` sur des positions de Brest, taille du SHELL.
- IC et AC GPEN 2022-2026 (URL au § B.1), lus en texte et en image ; page d'accueil https://agpen.fr/ (dates 2027).

### Secondaires (MOYENNE confiance)
- Recherche web : présentation des zones et des sites du GPEN (mer.gouv.fr, figaronautisme) — recoupée avec les IC.

### Tertiaires (BASSE confiance)
- Aucune affirmation retenue sur la seule foi d'une recherche web.

## Métadonnées

**Confiance :**
- Inventaire du code : HAUTE — chaque valeur lue, pièges vérifiés par exécution.
- GPEN : HAUTE pour 2022-2026 (documents officiels) ; BASSE pour 2027 au-delà des dates.
- Architecture : MOYENNE — cohérente avec le code, à éprouver par la vague 0-1.

**Date :** 2026-11-19 — **valable jusqu'à :** publication des IC GPEN 2027 (vers fin avril 2027) pour la partie B ; 30 jours pour la partie A.
