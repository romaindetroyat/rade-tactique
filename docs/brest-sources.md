# Rade de Brest — provenance et licences des données

Ce document décrit d’où viennent les fichiers `data/brest.*` du plan d’eau « Rade de Brest » (phase 7, plan 07-03), comment ils ont été construits et sous quelles licences. Les entrées téléchargées ne sont pas dans le dépôt : on les retrouve aux adresses ci-dessous et on reconstruit le pack avec les commandes indiquées.

**Avertissement : ce pack ne remplace pas les cartes et ouvrages nautiques officiels.** Les fonds viennent d’un modèle à environ 115 m (EMODnet) et sont lissés près des côtes ; la côte d’OpenStreetMap est la laisse de haute mer. Le pack sert à la tactique (vent, routes), jamais à la navigation de sécurité.

## Fichiers produits

| Fichier | Taille (octets) | Produit par |
|---------|-----------------|-------------|
| `data/brest.meta.json` | 318 | `tools/build_terrain.py --config`, complété par `tools/build_basemap.py --config` (taille du fond de carte) |
| `data/brest.terrain.bin` | 1 681 128 | `tools/build_terrain.py --config` (1086 × 774, Int16, décimètres) |
| `data/brest.cover.bin` | 840 564 | `tools/build_terrain.py --config` (0 mer, 1 terre, 2 urbain, 3 digue) |
| `data/brest.coast.json` | 136 609 | `tools/build_terrain.py --config` (Douglas-Peucker 6 m) |
| `data/brest.basemap.jpg` | 752 342 | `tools/build_basemap.py --config` (4096 × 2920, qualité 84) |
| `data/brest.seamask.png` | 241 429 | `tools/build_basemap.py --config` (4096 × 2920) |
| `data/brest.wx-snapshot.json` | — | `tools/snapshot_weather.py --venue brest` : **non produit le 19/11/2026** (Open-Meteo injoignable puis limite quotidienne atteinte depuis l’environnement de construction) ; à produire avant la publication |

Les tailles et empreintes SHA-256 exactes des fichiers du pack sont dans `data/venues.json`, généré par `npm run stamp`.

Emprise : ouest −4,66, est −4,22, sud 48,22, nord 48,43 (rade, goulet, Camaret et un bord de la baie de Douarnenez) ; maille de 30 m (grille fine de 10 m pour le masque terre / mer).

## Entrées téléchargées (le 19 novembre 2026)

Toutes les entrées ont été téléchargées par `tools/prepare_venue.py` (bibliothèque standard de Python, `urllib`, délais de 60 s, en-tête `User-Agent` générique sans nom ni adresse), chacune dans son propre dossier hors du dépôt (`tiles/`, `emodnet/`, `osm/`). Le fichier `manifeste.json` du dossier d’entrées donne pour chacune l’adresse, la taille, le SHA-256 et l’heure (UTC). Résumé :

### Relief à terre : tuiles d’altitude Terrarium (AWS Terrain Tiles)

- Adresse : `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png`, zoom 13, x de 3989 à 3999, y de 2832 à 2840.
- 99 tuiles, 6 533 693 octets, téléchargées entre 06:50:13 et 06:50:33 UTC.
- Empreinte de la liste (SHA-256 des lignes « chemin, NUL, SHA-256 du fichier », triées) : `2e1182156e61b01bf4f2dab4a8a884341d6b84e157430e95bd4f0e3ea1f07c4a`.
- Licence : jeu de données ouvert « Terrain Tiles » (AWS Open Data), assemblé à partir de sources publiques (SRTM, GMTED2010, ETOPO1 et d’autres selon les zones) ; les mentions demandées sont celles de la page d’attribution du jeu Terrain Tiles. Mention courte retenue : « AWS Terrain Tiles (Terrarium, SRTM/GMTED) ».

### Fonds : EMODnet Bathymetry

- Adresse exacte : `https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=emodnet:mean&crs=EPSG:4326&BBOX=-4.70,48.20,-4.20,48.45&format=image/tiff&interpolation=nearest&resx=0.00104166666&resy=0.00104166666`
- Fichier `emodnet/bathy_brest.tif` : 461 184 octets, SHA-256 `f7022ec7c2c9dbc08ae007e9159f68a0358844548792537b4b8f66fe14efc3f5`, 06:50:34 UTC.
- TIFF de 480 × 240 flottants, sans balise de géoréférence dans le fichier : la géoréférence vient de la requête et est écrite dans `tools/venues/brest.json` (coin nord-ouest −4,70 ; 48,45 ; pas de 1/960°) ; l’outil vérifie la taille de l’image. Profondeurs rapportées à la plus basse mer astronomique (LAT).
- Licence : données EMODnet Bathymetry, d’usage libre avec citation de la source. Mention : « EMODnet Bathymetry DTM ».

### Côte, digues et zones urbaines : OpenStreetMap

- **Méthode utilisée : API principale d’OpenStreetMap par boîtes.** Overpass a d’abord été essayé (requête : `way["natural"="coastline"]`, `way["man_made"~"^(breakwater|pier|groyne)$"]`, `way["landuse"~"^(residential|industrial|commercial|military|harbour)$"]` et les relations `landuse` correspondantes sur la boîte `(48.20,-4.70,48.45,-4.18)`, sortie `out geom`) : `overpass-api.de` a coupé la connexion, `overpass.kumi.systems` a dépassé le délai.
- Repli : `https://api.openstreetmap.org/api/0.6/map?bbox=<ouest>,<sud>,<est>,<nord>` sur la grille −4,68 à −4,20 × 48,21 à 48,45 en boîtes de 0,04° × 0,02° (144 boîtes), une seconde de pause entre deux requêtes, boîte coupée en deux sur refus pour trop de nœuds (7 coupures), arrêt prévu sur 429 ou 509 (jamais atteint) : **151 boîtes** lues, 620 906 012 octets de XML, entre 06:51:39 et 06:58:50 UTC.
- Empreinte de la liste des boîtes (même calcul que pour les tuiles) : `7ad6b2203db80a0796f7d681f45597861a34516ba623a6ccb2dfa1bd32289aa6`.
- Extrait converti `osm/osm_extract.json` (chemins dédoublonnés par identifiant ; relations `landuse` en multipolygone assemblées en anneaux) : 181 traits de côte, 624 digues, jetées et épis, 905 zones urbaines ; 1 324 425 octets, SHA-256 `f8cddb8bbdc9466f6b31efe9e1640c79be1333c34979271228ee07c663c500bc`.
- Manifeste complet des entrées (`manifeste.json`, 251 entrées) : SHA-256 `dd85dd0aea1dca4796c52ef9550540ccaeb26bae53374f57012c499c0f316dd2`.
- Licence : **© contributeurs OpenStreetMap (ODbL)**. `data/brest.coast.json`, `data/brest.cover.bin` et le dessin des côtes du fond de carte sont des bases de données dérivées d’OpenStreetMap : elles restent sous ODbL et la mention doit accompagner leur affichage (07-04).

### Instantané météo : Open-Meteo

- Requêtes (identiques à celles de l’app à Brest, `js/weather.js` avec le descripteur de `js/venue-brest.js`) : `https://api.open-meteo.com/v1/forecast` au centre de la zone A (48,298 ; −4,3605) avec les six modèles de l’app, puis la grille de 20 points (latitudes 48,275 à 48,335, longitudes −4,46 à −4,30) en `meteofrance_arome_france_hd`, toutes deux avec `cell_selection=sea` ; aucune requête marine.
- Le 19/11/2026, `api.open-meteo.com/v1/forecast` a d’abord coupé la connexion, puis répondu 429 (limite quotidienne de l’adresse partagée de l’environnement de construction) : **aucun fichier produit, aucun fichier inventé.** Sans instantané, l’app reçoit `null` et le dit (07-04) ; le fichier est à produire en 07-10, avant la publication.
- Licence : données Open-Meteo sous CC BY 4.0, mention « Weather data by Open-Meteo.com ».

Les entrées du Shom (marée, courants) seront ajoutées par le plan 07-07.

## Reconstruction

Depuis la racine du dépôt, avec un dossier d’entrées neuf hors du dépôt (`<entrées>`) :

```sh
python3 -I tools/prepare_venue.py tools/venues/brest.json <entrées>
python3 -I tools/build_terrain.py <entrées> data --config tools/venues/brest.json
python3 -I tools/build_basemap.py <entrées> data --config tools/venues/brest.json
python3 -I tools/snapshot_weather.py --venue brest
npm run stamp
```

Durées constatées le 19/11/2026 : téléchargement 8 min 38 s (dont 7 min 11 s pour OpenStreetMap), relief 8 s, fond de carte 12 s.

Points de contrôle (`tests/brest.test.mjs`) : zone A (fond −8,5 m), zone B (−4,7 m) et milieu du goulet (−33,2 m) en mer ; Île Longue en terre (28,9 m) ; part de terre 66 % ; Pointe des Espagnols à 76,7 m dans un rayon de 600 m ; mêmes ordres de grandeur que l’étude du plan d’eau (−8,7 ; −4,8 ; −33 ; 78 m).

Sans `--config`, `tools/build_terrain.py`, `tools/build_basemap.py` et `tools/snapshot_weather.py` gardent les valeurs de Toulon ; les fichiers de Toulon ne sont jamais régénérés (garde `node tools/gardes-toulon.mjs`).

## Outils

Python 3.13.18, numpy 2.5.3, Pillow 12.3.0 (déjà présents, rien d’installé) ; Node.js v22.23.5 pour `npm run stamp` et les tests.

Sécurité des entrées : elles sont traitées comme des données non fiables. Les outils les lisent (PNG, TIFF, XML, JSON) sans jamais les exécuter, Python est lancé avec `-I` (pas de module pris dans le dossier courant), le XML d’OpenStreetMap est lu par `xml.etree.ElementTree` (aucune entité externe résolue), et le résultat est contrôlé (terre et mer aux points connus, relief, part de terre).
