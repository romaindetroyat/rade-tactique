---
phase: 07-plans-d-eau
plan: 03
subsystem: donnees
status: complete
tags: [plan-d-eau, brest, relief, osm, emodnet, terrarium, stamp, manifeste, d-03, d-04, d-14]
requires:
  - "07-02 : registre des plans d’eau, js/venue-brest.js (files.base 'data/brest.', bounds, wind), WindField(T, { cell, openSea })"
provides:
  - "data/brest.{meta.json,terrain.bin,cover.bin,coast.json,basemap.jpg,seamask.png} : pack physique de la rade de Brest (3 652 390 octets, empreinte 7aa34dd280)"
  - "data/venues.json : manifeste généré par stamp (par plan d’eau : chemin, taille, SHA-256, pack, total)"
  - "tools/stamp.mjs : venueIds, venuesManifest ; data/<id>.* hors du SHELL ; contrôle « data/venues.json est périmé »"
  - "tools/prepare_venue.py, tools/venues/brest.json ; --config pour build_terrain.py et build_basemap.py ; --venue brest pour snapshot_weather.py"
  - "docs/brest-sources.md : provenance, empreintes des entrées, licences, reconstruction"
affects: [07-04, 07-06, 07-07, 07-10]
tech-stack:
  added: []
  patterns:
    - "plan d’eau téléchargeable annoncé par data/<id>.meta.json : ses fichiers data/<id>.* restent hors de la liste hors réseau"
    - "fichier généré dans le SHELL et dans le hachage : contentHash lit le contenu calculé (pas celui du disque)"
    - "graines de remplissage de la mer tirées de la bathymétrie (fond < −3 m sur tout le voisinage, loin des traits de côte)"
key-files:
  created:
    - tools/prepare_venue.py
    - tools/venues/brest.json
    - data/brest.meta.json
    - data/brest.terrain.bin
    - data/brest.cover.bin
    - data/brest.coast.json
    - data/brest.basemap.jpg
    - data/brest.seamask.png
    - data/venues.json
    - docs/brest-sources.md
    - tests/brest.test.mjs
  modified:
    - tools/build_terrain.py
    - tools/build_basemap.py
    - tools/snapshot_weather.py
    - tools/stamp.mjs
    - tests/stamp.test.mjs
    - tests/access.test.mjs
    - .gitignore
    - sw.js
    - js/version.js
decisions:
  - "OpenStreetMap par l’API principale en 151 boîtes (Overpass injoignable : connexion coupée, délai dépassé)"
  - "Maille du vent de Brest gardée à 150 m : coût mesuré ≈ 1,5 × Toulon (seuil 1,7)"
  - "Seuil openSea de Brest gardé à 1 500 m (3 237 cellules de référence ; facteur de la zone A ≈ 1 par vent d’ouest)"
  - "BREST.scene.home gardé : la vue 3D de départ est centrée sur la zone A sur la vraie carte"
  - "data/venues.json toujours généré (même sans plan d’eau) et compté dans la version de l’app"
  - "Instantané météo de Brest non produit (Open-Meteo : connexion coupée puis 429) : aucun fichier inventé, à produire en 07-10"
metrics:
  duration: 21min
  completed: 2026-11-19
  tasks: 3
  files: 20
estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 52929        # chars/4 du diff complet 37ad861..eb7886b (211 714 caractères, dont brest.coast.json) ; 17 173 hors data/, sw.js et js/version.js
  tasks: 3
  commits: 3
plan_head_before: 37ad861807408b3ff7501293d76e7fb9447e5abd
plan_head_after: eb7886b5029f89e3e3cdf80ff71c3bbd55b731c4
---

# Phase 7 Plan 03 : Pack physique de la rade de Brest Summary

Relief, couverture, côte, fond de carte et masque de l’eau de la rade de Brest construits par les outils du dépôt paramétrés (`--config tools/venues/brest.json`, emprise −4,66 ; −4,22 ; 48,22 ; 48,43, grille 1086 × 774), sur des entrées téléchargées hors du dépôt (tuiles Terrarium, EMODnet, OpenStreetMap par l’API principale en 151 boîtes) ; `npm run stamp` laisse `data/brest.*` hors de la liste hors réseau et écrit le manifeste `data/venues.json` ; Toulon inchangé (gardes vertes).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 922ad8c | `tools/prepare_venue.py`, `tools/venues/brest.json`, `build_terrain.py --config`, `data/brest.{meta,terrain,cover,coast}`, exclusion et manifeste dans `tools/stamp.mjs`, tests brest et stamp |
| 2 | 30cbdb1 | `build_basemap.py --config`, `snapshot_weather.py --venue brest`, `data/brest.basemap.jpg` et `.seamask.png`, tests du fond de carte et du coût du vent |
| 3 | eb7886b | `tests/access.test.mjs` (pack derrière le contrôle d’accès), comparaison de la liste hors réseau à 56f6625, `docs/brest-sources.md` |

Tracer (tâche 1) : la vérification a été rejouée de bout en bout avant la tâche 2 (tests brest, stamp et venues, gardes, `npm run check` 714/714, garde SNPM) : verte.

## Mesures

**Entrées (19/11/2026, `/tmp/…/scratchpad/brest-src/`, hors dépôt)** : 99 tuiles Terrarium z13 (6,5 Mo), TIFF EMODnet 480 × 240 (461 184 octets, sans balise de géoréférence : géoréférence de la requête dans la configuration, taille contrôlée), 151 boîtes OSM (621 Mo de XML, 7 coupures pour trop de nœuds) → `osm_extract.json` : 181 traits de côte, 624 digues et jetées, 905 zones urbaines. Téléchargement 8 min 38 s (OSM 7 min 11 s).

**Construction** : relief 8 s (24 038 graines de mer tirées des fonds), fond de carte 12 s.

| Fichier | Octets | Attendu (étude § 6.1) |
|---------|--------|-----------------------|
| `brest.terrain.bin` | 1 681 128 (= 1086 × 774 × 2) | 1,68 Mo |
| `brest.cover.bin` | 840 564 | 0,84 Mo |
| `brest.coast.json` | 136 609 | 150-250 ko |
| `brest.basemap.jpg` | 752 342 (4096 × 2920, qualité 84) | 0,6-0,8 Mo |
| `brest.seamask.png` | 241 429 | 150-250 ko |
| `brest.meta.json` | 318 | < 1 ko |
| **Pack** | **3 652 390**, empreinte `7aa34dd280` | — |

**Points de contrôle** : zone A −8,5 m, zone B −4,7 m, milieu du goulet −33,2 m (étude : −8,7 ; −4,8 ; −33) ; Île Longue en terre à 28,9 m (point intérieur 48,3060 / −4,5070, le point du plan 48,304 / −4,515 tombe dans l’eau à l’ouest de l’île) ; part de terre 66,0 % ; Pointe des Espagnols 76,7 m dans 600 m (étude : 78 m).

**Champ de vent (D-14)** : construction + `kit(270)` + `kit(150)`, meilleur de trois passes alternées :

| Plan d’eau | Cellules | Temps |
|------------|----------|-------|
| Toulon (150 m, `data/`) | 163 × 133 = 21 679 | 261-271 ms |
| Brest (150 m, `BREST.wind`) | 217 × 155 = 33 635 | 396-409 ms |
| Rapport | 1,55 | ≈ 1,5 (≤ 1,7) → **maille 150 m gardée** |

**Seuil openSea** (cellules de mer à plus de N m d’une terre ; facteur d’accélération au centre de la zone A par 270° / 150°) : 1 000 m → 5 538 cellules, 0,99 / 0,86 ; **1 500 m → 3 237 cellules, 0,99 / 0,83** ; 2 000 m → 1 970, 0,98 / 0,73 ; 4 000 m → 126 cellules (Iroise seulement), 0,94 / 0,69. Au-delà de 1 500 m, la référence se cale sur l’Iroise et la rade paraît déventée par tous les vents de sud : 1 500 m gardé.

**Vue 3D (BREST.scene.home)** : capture Chromium (WebGL logiciel) au démarrage avec `rade.state = { venue: 'brest' }` : le relief de Brest se charge sans erreur de page ni chemin refusé ; en paysage la vue est centrée sur la zone A (rade sud, Plougastel, Lanvéoc) ; en portrait, la zone A et ses abords. Cadrage gardé.

## Sorties brutes des vérifications

Tâche 1 : `# pass 36 / # fail 0` (brest, stamp, venues) ; quatre OK des gardes ; `npm run check` : stamp à jour · 714 tests · 714 pass ; SNPM-OK.
Tâche 2 : `# pass 14 / # fail 0` (brest, stamp) ; pack 7aa34dd280, 3 652 390 octets, 6 fichiers ; quatre OK des gardes ; `npm run check` : 717 tests · 716 pass · 0 fail · 1 sauté (instantané absent) ; SNPM-OK.
Tâche 3 et fin de plan :
```
# pass 35 / # fail 0 / # skipped 1   (access, stamp, brest)
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
stamp à jour · # tests 719 · # pass 718 · # fail 0 · # skipped 1
SNPM-OK
OK toulon-vue
OK entetes
Bilan : 2/2 scénario(s) OK
```
`sw.js` : aucun `"data/brest.`, `"data/venues.json"` présent ; la liste hors réseau gagne seulement `data/venues.json` et les modules js/ de 07-02 par rapport à 56f6625.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloquant] `__pycache__/` ignoré par git**
- **Trouvé pendant :** tâche 1 (`python3 -I -m py_compile` de la vérification écrit `tools/__pycache__/`).
- **Correction :** `__pycache__/` ajouté à `.gitignore` (commit 922ad8c).

**2. [Rule 1 - Bug] Réponse d’erreur d’Open-Meteo écrite comme instantané**
- **Trouvé pendant :** tâche 2 : `curl` sans `-f` rend 0 sur un refus, et `get()` acceptait `{"error": true, …}` comme réponse valide.
- **Correction :** `get()` réessaie puis abandonne sans écrire si la réponse porte `error` ; requêtes de Toulon inchangées. L’import inutilisé `sys.path.insert` est retiré (lecture avec `-I`).
- **Fichier :** `tools/snapshot_weather.py` (commit 30cbdb1).

**3. [Précision] Point de l’Île Longue**
- Le point du plan (48,304 N ; 4,515 W) tombe dans l’eau à l’ouest de l’île ; le test prend un point intérieur relevé sur la couverture construite (48,3060 ; −4,5070, 28,9 m).

**4. [Précision] Test « check » existant**
- `data/venues.json` étant généré à chaque `stamp`, le test « check » de tests/stamp.test.mjs écrit aussi `b.venuesJson` avant de demander zéro erreur (sinon « data/venues.json est périmé »).

**5. [Précision] `build()` n’écrit pas sur le disque**
- Le plan dit « build() écrit aussi data/venues.json » ; `build()` reste sans effet (check() l’appelle) : il calcule `venuesJson`, le hachage utilise ce contenu calculé, et c’est `main()` (npm run stamp) qui l’écrit. Même résultat, check() sans écriture.

### Instantané météo de Brest
Open-Meteo a coupé la connexion à chaque essai, puis a répondu 429 (limite quotidienne de l’adresse partagée) : `data/brest.wx-snapshot.json` n’existe pas ; aucun fichier inventé. Le test de l’instantané est sauté avec la raison ; `data/venues.json` liste 6 fichiers (7 avec l’instantané).

## Known Stubs

| Fichier | Valeur | Résolu par |
|---------|--------|-----------|
| `data/brest.wx-snapshot.json` | absent (Open-Meteo injoignable) : l’app reçoit `null` | 07-10 (avant la release) |

Les stubs de `js/venue-brest.js` listés en 07-02 (MARKS, PLACES, zones, régimes, catalogue) restent pour 07-06 / 07-09 ; à Brest le briefing montre encore les régimes et effets de Toulon (vu sur la capture).

## Threat Flags

Aucun : aucune nouvelle route ; `data/brest.*` sont des noms plats servis derrière le middleware (inchangé), couverts par tests/access.test.mjs ; entrées lues par `python3 -I` et `xml.etree` (aucune entité externe), jamais exécutées ; aucun code d’accès ni empreinte de middleware.js écrit ou affiché ; aucun appel à l’IA.

## Points pour 07-04

- Le pack à télécharger est décrit par `data/venues.json` (`venues.brest.files[].path/bytes/sha256`, `pack` = 10 hex, `bytes` total 3 652 390) ; le manifeste est dans le SHELL et dans le hachage de version : toute modification d’un fichier de Brest change la version de l’app.
- `data/brest.*` n’est plus dans le précache ; aujourd’hui le service worker les traite comme toute requête de même origine (réseau d’abord, copie en cache) : le cache dédié et la vérification d’empreinte sont à faire en 07-04.
- Sans instantané et sans réseau, Brest reste longtemps sur « Pas encore de prévision chargée — téléchargement en cours… » (capture à 9 s ; Toulon bascule sur son instantané) : prévoir le message « Hors ligne » de 07-04.
- Mentions à afficher avec la carte de Brest : « © contributeurs OpenStreetMap (ODbL) », « EMODnet Bathymetry », « AWS Terrain Tiles » (dans `data/brest.meta.json` `sources`) et « ne remplace pas les cartes et ouvrages nautiques officiels ».
- `npm run stamp` après tout changement de `data/brest.*` ; `tools/stamp.mjs` exclut tout `data/<id>.*` dès qu’un `data/<id>.meta.json` existe (fichiers de marée et de courants de 07-07 compris).
- Pour régénérer : commandes dans `docs/brest-sources.md` (entrées hors dépôt, `python3 -I`).

## Self-Check: PASSED
