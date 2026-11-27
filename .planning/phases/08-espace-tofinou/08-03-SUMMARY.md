---
phase: 08-espace-tofinou
plan: 03
subsystem: donnees
status: complete
tags: [plan-d-eau, bormes, pack, osm, emodnet, terrarium, open-meteo, tofinou]
requires:
  - "08-02 : packs refusés par espace (middleware, ESPACES.tofinou.packs = ['bormes'])"
provides:
  - "tools/venues/bormes.json : emprise, grille, sources, types urbains (sans military), bloc weather"
  - "tools/prepare_venue.py : clé facultative « urban », option --types-urbains"
  - "tools/snapshot_weather.py : --venue <id> par configuration, --urls"
  - "data/bormes.* (6 fichiers, 3 604 097 octets), entrée bormes de data/venues.json (pack b5ccb2acd6)"
  - "docs/bormes-sources.md ; tests/bormes.test.mjs (13 tests)"
affects: [08-04, 08-05, 08-09]
tech-stack:
  added: []
  patterns: ["types urbains par configuration (défaut inchangé)", "adresses de l’outil d’instantané comparées à celles de js/weather.js (fetch remplacé, sans réseau)"]
key-files:
  created:
    - tools/venues/bormes.json
    - data/bormes.meta.json
    - data/bormes.terrain.bin
    - data/bormes.cover.bin
    - data/bormes.coast.json
    - data/bormes.basemap.jpg
    - data/bormes.seamask.png
    - docs/bormes-sources.md
    - tests/bormes.test.mjs
  modified:
    - tools/prepare_venue.py
    - tools/snapshot_weather.py
    - data/venues.json
    - sw.js
    - js/version.js
    - tests/access.test.mjs
decisions:
  - "OpenStreetMap par l’API principale (154 boîtes) : les deux serveurs Overpass de Brest injoignables, aucun miroir tiers utilisé"
  - "Levant : le contrôle « aucune cellule urbaine » de l’emprise 43,02–43,05 × 6,44–6,52 est remplacé par « au plus 8 % d’urbain, rien à l’est de 6,48° E » : Héliopolis (residential) et deux petites zones industrial d’OpenStreetMap restent urbaines à juste titre"
  - "Bloc weather de la configuration : grille en { lats, lons } (produit dans l’ordre latitude puis longitude, comme js/weather.js), point marin sous la forme « latitude=…&longitude=… » de js/weather.js"
  - "tests/access.test.mjs : les packs d’un autre espace que celui du code simulé reçoivent le 404 du middleware (vérifié, pas seulement sauté)"
metrics:
  duration: 18min
  completed: 2026-11-26
estimate:
  tokens: 100000
  tasks: 2
actuals:
  tokens: 11300
  tasks: 2
  commits: 2
plan_head_before: 80f10c1d695c193bce2cd79f65f6368ca74f6d96
plan_head_after: f841ace8facdbd78ac8e8050aba80a3d89e9b9ce
---

# Phase 8 Plan 03 : pack hors réseau de Bormes – Le Lavandou Summary

Le pack `data/bormes.*` (relief et fonds 1030 × 885 à 30 m, couverture, côte, fond de carte 4096 × 3518, masque de l’eau ; 3 604 097 octets) est construit par les outils du dépôt avec `tools/venues/bormes.json`, l’île du Levant n’y est plus « urbaine » (types urbains réglés par la configuration, défaut inchangé), les valeurs de contrôle de l’étude sont tenues par `tests/bormes.test.mjs`, l’outil d’instantané lit la configuration (`--venue bormes`) et ses sources sont écrites ; Open-Meteo a refusé l’instantané (limite quotidienne), rien n’a été écrit. Naos ne voit rien : gel, gardes et scénarios verts.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | c2bf027 | clé `urban` et `--types-urbains` (tools/prepare_venue.py) ; tools/venues/bormes.json ; téléchargement, relief, fond de carte ; data/bormes.* ; `npm run stamp` ; tests/bormes.test.mjs (10 tests) ; tests/access.test.mjs (packs d’un autre espace) |
| 2 | f841ace | tools/snapshot_weather.py (`--venue <id>` par configuration, `--urls`) ; bloc `weather` ; docs/bormes-sources.md ; 3 tests d’instantané |

Tracer (tâche 1) : `<verify>` complet rejoué avant la tâche 2 : vert, expansion poursuivie.

## Construction

- Dossiers neufs hors du dépôt : entrées `…/scratchpad/bormes-entrees-20261126`, sortie `…/scratchpad/bormes-sortie-20261126` ; le pack d’essai de l’étude n’a pas été recopié.
- **Serveur OpenStreetMap : API principale `api.openstreetmap.org` par boîtes** (154 boîtes de 0,04° × 0,02°, aucune coupure, 224 819 107 octets de XML, 19:29:54 → 19:34:53 UTC). Overpass : `overpass-api.de` connexion coupée, `overpass.kumi.systems` délai dépassé. Aucun miroir tiers.
- Durées : téléchargement 383 s (6 min 23 s), relief 14 s, fond de carte 24 s.
- Extrait OSM : 94 traits de côte, 168 digues et jetées, 190 zones urbaines.
- Recoupement avec le pack d’essai de l’étude (miroir Overpass) : `coast.json` et `terrain.bin` identiques octet pour octet ; `cover.bin` ne diffère que par 9 783 cellules (urbain 37 927 au lieu de 47 710), toutes sur le Levant.
- Versions : Python 3.13.18, numpy 2.5.3, Pillow 12.3.0, Node v22.23.5 (rien d’installé).

| Fichier | Octets |
|---------|--------|
| data/bormes.meta.json | 314 |
| data/bormes.terrain.bin | 1 823 100 |
| data/bormes.cover.bin | 911 550 |
| data/bormes.coast.json | 92 212 |
| data/bormes.basemap.jpg | 639 587 |
| data/bormes.seamask.png | 137 334 |
| **Total** | **3 604 097** (pack `b5ccb2acd6` dans data/venues.json) |

Mesures (tests/bormes.test.mjs) : baie −25,6 m, devant Le Lavandou (43,132 ; 6,380) −19,3 m, coffre 1 −32,0 m, passe Bénat – Bagaud −64,1 m, passe des Grottes −18,1 m ; La Fourmigue, Gabinière, Cristau en terre ; Bénat 183,9 m dans 2,5 km du phare, Port-Cros 188,3 m, culminant 597,6 m ; part de terre 27,6 % ; vent : 206 × 177 = 36 462 cellules, 44,4 % de l’eau intérieure au-delà de 4 000 m, 260° au milieu de la baie 0,838 (est 075° : 0,917) ; Levant : 456 points urbains sur 9 021 de terre (5,1 %), 0 à l’est de 6,48° E.

## Instantané météo

**Non produit.** `python3 -I tools/snapshot_weather.py --venue bormes` : Open-Meteo a répondu « Daily API request limit exceeded. Please try again tomorrow. » ; aucun fichier écrit, rien inventé ; le test de l’instantané est sauté avec ce motif (consigné dans .planning/WINDOWS.md). 08-09 réessaie avant la release depuis une adresse non limitée, puis `npm run stamp`.

## Sorties brutes des tests

```
ok 1 - meta de Bormes : emprise 6,22–6,60° E × 42,96–43,20° N, 1030 × 885 cellules de 30 m, sources citées
ok 2 - pack de Bormes : six fichiers, 3,3 à 4,0 Mo en tout
ok 3 - terre et mer : baie, coffre 1, passe Bénat – Bagaud, passe des Grottes en mer ; La Fourmigue, Gabinière, îlot du Cristau en terre
ok 4 - fonds à 2 m près : baie −25,6 m, devant Le Lavandou −19,8 m, coffre 1 −32,0 m
ok 5 - reliefs : massif du cap Bénat ≥ 170 m dans 2,5 km du phare, Port-Cros ≥ 180 m, point culminant de l’emprise ≥ 590 m
ok 6 - part de terre de la couverture : 27 % ± 2
ok 7 - île du Levant : terre naturelle (landuse=military hors des types urbains de bormes.json), seuls Héliopolis et deux petites zones industrielles en urbain
ok 8 - champ de vent aux réglages par défaut : 36 462 cellules de 150 m, 40 à 50 % de l’eau au-delà de 4 000 m ; ouest 260° : 0,75 à 0,95 au milieu de la baie
ok 9 - pack de Bormes hors de la liste hors réseau ; entrée « bormes » de data/venues.json conforme aux fichiers (tailles, SHA-256)
ok 10 - --types-urbains : liste par défaut pour Brest (configuration sans « urban »), sans « military » pour Bormes
ok 11 - instantané : sans option (Toulon) puis --venue brest, l’outil demande exactement les adresses de l’app (js/weather.js, js/venue-brest.js)
ok 12 - instantané : --venue bormes lit tools/venues/bormes.json — 20 points, cell_selection=sea, point marin gardé ; mêmes adresses que l’app
ok 13 - instantané météo de Bormes : modèles, grille de 20 points, état de la mer # SKIP data/bormes.wx-snapshot.json absent (Open-Meteo a refusé : limite quotidienne) : l’app reçoit null
```

Vérifications finales :
```
npm run check : 899 tests, 897 verts, 2 sautés (instantanés de Brest et de Bormes absents), 0 échec
node tools/gardes-toulon.mjs : OK SNPM · OK données de Toulon · OK modules du mode départ · OK tests figés · OK gel de Naos v43 · OK pack de Brest
git diff --quiet 5e9b8a5 -- 'data/brest.*' ; git diff --quiet 56f6625 -- data/<Toulon> ; git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js ; garde SNPM f80c365 : vrais
PW_REQUIRED=1 node tools/regate-e2e.mjs naos-cles archive deux-telephones : 3/3 OK
node tools/stamp.mjs --check : à jour (avertissement non strict « contenu modifié depuis la v43 » : la release est pour 08-09)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de test] Contrôle du Levant trop strict**
- **Trouvé pendant :** tâche 1
- **Problème :** « aucune cellule urbaine entre 43,02 et 43,05° N, 6,44 et 6,52° E » échouait (456 points) : le cadre contient le village d’Héliopolis (`landuse=residential`, jusqu’à 6,442° E) et deux petites zones `landuse=industrial` d’OpenStreetMap (6,452–6,463° E et 6,468–6,474° E), urbaines à juste titre.
- **Correction :** le test vérifie que l’île est de la terre, au plus 8 % d’urbain (mesuré 5,1 %, contre toute l’île avec `military`), aucun point urbain à l’est de 6,48° E ; la différence de 9 783 cellules avec le pack d’essai est consignée dans docs/bormes-sources.md.
- **Commit :** c2bf027

**2. [Rule 3 - Blocage] tests/access.test.mjs recevait 404 pour data/bormes.***
- **Trouvé pendant :** tâche 1 (signalé par 08-02)
- **Correction :** dans « tout ce que l’app sert est transmis », les packs des autres espaces que celui du code simulé sont attendus en 404 non transmis (et non simplement sautés) ; le pack de Brest reste exigé transmis.
- **Commit :** c2bf027

**3. Interprétations**
- « Devant Le Lavandou » : point 43,132° N 6,380° E (−19,3 m), la position exacte de l’étude n’étant pas écrite.
- Passe Bénat – Bagaud : 43,042° N 6,375° E (point « entre Bénat et Port-Cros » de l’étude § 4.2).
- Facteur 260° : vitesse échantillonnée / vent de base après `compute` à un seul point (méthode de l’étude § 3.4), au point `windRef` 43,120° N 6,392° E.
- Le bloc `weather` est entré dans la configuration à la tâche 2 (fichiers de la tâche 2).

### Exigences

TOF-02 n’est pas cochée : le pack est construit (relief, côte, fond de carte, Levant non urbain, seuil par défaut), mais l’instantané météo manque (08-09) et la borne ouest de saisie 6,20° E relève du descripteur (08-04). Traçabilité de REQUIREMENTS.md mise à « Partiel ».

## Threat Flags

Aucune surface nouvelle : outils locaux (non servis), données servies seulement à l’espace Tofinou (08-02).

## Points pour 08-04

- Descripteur `js/venue-bormes.js` : `weather` = `{ center: { lat: 43.115, lon: 6.39 }, grid` = produit lats × lons de tools/venues/bormes.json (latitude d’abord) `, cellSelection: 'sea', marine: 'latitude=43.115&longitude=6.39', live: null, key: 'rade.wx.bormes.v1', snapshot: 'data/bormes.wx-snapshot.json' }` : tests/bormes.test.mjs compare déjà l’outil à `js/weather.js` avec ce bloc ; un test de parité descripteur ↔ configuration sera utile.
- `files: { base: 'data/bormes.' }`, `origin: { lat: 43.10, lon: 6.40 }`, `wind: {}` (seuil 4 000 m par défaut, validé), `windRef` 43,120 ; 6,392.
- tests/bormes.test.mjs pose l’origine à la main (`setOrigin`) : une fois le plan d’eau au registre, passer à `setVenue('bormes')` comme tests/brest.test.mjs.
- Ajouter `bormes` à `VENUE_IDS` de js/archmerge.js ne change rien pour Naos (POLITIQUE.naos.venues).
- data/bormes.wx-snapshot.json absent : l’app doit afficher « Hors ligne » sans instantané ; 08-09 le produit avant la release.

## Self-Check: PASSED

- FOUND : tools/venues/bormes.json, data/bormes.{meta.json,terrain.bin,cover.bin,coast.json,basemap.jpg,seamask.png}, docs/bormes-sources.md, tests/bormes.test.mjs
- FOUND : c2bf027, f841ace (ancêtres de HEAD)
