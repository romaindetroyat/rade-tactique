# Rade de Brest — provenance et licences des données

Ce document décrit d’où viennent les fichiers `data/brest.*` du plan d’eau « Rade de Brest » (phase 7, plan 07-03), comment ils ont été construits et sous quelles licences. Les entrées téléchargées ne sont pas dans le dépôt : on les retrouve aux adresses ci-dessous et on reconstruit le pack avec les commandes indiquées.

**Avertissement : ce pack ne remplace pas les cartes et ouvrages nautiques officiels.** Les fonds viennent d’un modèle à environ 115 m (EMODnet) et sont lissés près des côtes ; la côte d’OpenStreetMap est la laisse de haute mer. La marée est une prédiction calculée dans l’app (non officielle) et le courant un modèle du Shom en conditions moyennes (ni vent ni débit des rivières) : « à n’utiliser qu’en complément des cartes et ouvrages nautiques officiels ». Le pack sert à la tactique (vent, routes), jamais à la navigation de sécurité.

## Fichiers produits

| Fichier | Taille (octets) | Produit par |
|---------|-----------------|-------------|
| `data/brest.meta.json` | 318 | `tools/build_terrain.py --config`, complété par `tools/build_basemap.py --config` (taille du fond de carte) |
| `data/brest.terrain.bin` | 1 681 128 | `tools/build_terrain.py --config` (1086 × 774, Int16, décimètres) |
| `data/brest.cover.bin` | 840 564 | `tools/build_terrain.py --config` (0 mer, 1 terre, 2 urbain, 3 digue) |
| `data/brest.coast.json` | 136 609 | `tools/build_terrain.py --config` (Douglas-Peucker 6 m) |
| `data/brest.basemap.jpg` | 752 342 | `tools/build_basemap.py --config` (4096 × 2920, qualité 84) |
| `data/brest.seamask.png` | 241 429 | `tools/build_basemap.py --config` (4096 × 2920) |
| `data/brest.maree.json` | 8 075 | `tools/build_maree.py` (68 constituants harmoniques, facteurs par année 2026-2031) |
| `data/brest.courants.json` | 1 257 | `tools/build_courants.py` (en-tête de l’atlas compacté : grille, heures, coefficients, source, licence, DOI) |
| `data/brest.courants.bin` | 910 946 | `tools/build_courants.py` (masque de 17 397 points en mer, puis U et V Int8 au pas de 0,02 m/s, 13 heures × 2 coefficients) |
| `data/brest.fonds.bin` | 100 828 | `tools/build_courants.py` (fonds EMODnet aux 277 × 182 nœuds de l’atlas, Int16, décimètres, zéro des cartes) |
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

### Marée : Shom – REFMAR, marégraphe de Brest (plan 07-07)

- Adresse (un mois par requête, 31 jours au plus) : `https://services.data.shom.fr/maregraphie/observation/json/3?sources=4&dtStart=<AAAA-MM-01T00:00:00Z>&dtEnd=<dernier jour T23:00:00Z>&interval=60` ; station 3 (Brest), source 4 (hauteurs horaires validées), service sans clé.
- 93 fichiers `refmar/c_AAAA_MM.json` (janvier 2019 à septembre 2026), 5 148 745 octets, téléchargés par `tools/build_maree.py` le 19/11/2026 entre 09:06 et 09:08 UTC dans un dossier neuf hors du dépôt ; 66 953 heures (2019-01-01 00:00 → 2026-09-30 22:00 TU).
- Empreinte de la liste : SHA-256 des lignes « `refmar/c_AAAA_MM.json`, NUL, SHA-256 du fichier » triées et jointes par des sauts de ligne : `2676662fc2c3cda7ce3c4b56deaad5276d3929b83ea2b80111b82222b81a98f4`.
- Licence : **Licence Ouverte 2.0** ; mention « Shom – REFMAR (marégraphe de Brest) ». Les fixtures `tests/fixtures/brest-maree-obs.json` (576 heures de 2026) en sont un extrait, avec la même mention.
- Méthode : ajustement harmonique sur 2019-2024 (51 642 heures, 68 constituants, corrections nodales, utide), contrôle sur 2025-2026 (15 311 heures, années non utilisées pour l’ajustement). Écarts imprimés par l’outil : hauteur 14,2 cm d’écart-type (14,7 cm en quadratique, 95 % sous 31 cm, biais +3,9 cm) ; 2 465 pleines et basses mers : heure +0,7 min en moyenne, 3,7 min d’écart-type, 95 % sous 7 min ; hauteur −3,4 cm de biais, 14,4 cm d’écart-type. L’essentiel de ces écarts est la météo (pression, vent), qu’aucune prédiction de marée ne contient.
- Calcul dans l’app (`js/maree.js`) : h(t) = z0 + Σ f·A·cos(2π·fréquence·(heures depuis le 1er janvier 0 h TU) + (V0+u) − g), f et u au 2 juillet, V0 au 1er janvier de chaque année ; hors de 2026-2031 : pas de marée. Le coefficient affiché est « approché » (45 + (marnage − 2,80) × 50 / 3,10), pas le coefficient officiel.
- Les prédictions officielles du Shom (annuaire, maree.shom.fr) ne sont pas une donnée lue par l’outil : elles servent seulement de contrôle visuel.

### Niveaux : Shom – Références Altimétriques Maritimes

- Service WFS du Shom, couche `RAM_BDD_WLD_WGS84G_WFS:ram_3857`, interrogé par l’étude du plan d’eau (19/11/2026) ; Licence Ouverte 2.0 ; mention « Shom – Références Altimétriques Maritimes ».
- Valeurs utilisées : marnages de vive-eau moyenne 5,90 m et de morte-eau moyenne 2,80 m à Brest (dosage du courant, coefficient approché) ; plus basse mer astronomique (PBMA) à 0,25 m au-dessus du zéro hydrographique (fonds EMODnet ramenés au zéro des cartes, ci-dessous).

### Courant : Shom – Atlas de courants de marée 2D au format netcdf, Finistère (plan 07-07)

- Archive : `https://services.data.shom.fr/INSPIRE/telechargement/prepackageGroup/ATLASCOURANTS2D_NETCDF_FINISTERE_PACK_DL/prepackage/ATLASCOURANTS2D_NETCDF_FINISTERE/file/ATLASCOURANTS2D_NETCDF_FINISTERE.7z`, 776 319 186 octets, SHA-256 `aba79c64069acc38867392bcfe15a58f5b3ff094185c18526a8accc259d6d17a` (téléchargée le 19/11/2026 à 04:52 UTC par l’étude du plan d’eau, reprise après contrôle de la taille dans un dossier neuf ; `tools/build_courants.py` la télécharge si elle manque).
- Fichier extrait (py7zr, ce seul fichier) : `ATLASDYN-SURF_TELEMAC3D-SURF_R1111110_RADE-BREST-560-100M-5min.nc`, 233 949 555 octets, SHA-256 `db5f2d62b0bf04efb8c5e1ce1b6fb1a66d6dfb24d2068ea0816966f3200a9b07`, édition du 10/06/2026 (attribut `Release_date`) ; grille de 277 × 182 nœuds au pas de 100 m (48,2480 à 48,4110 N, 4,6258 à 4,2530 W), 17 397 en mer ; 145 échéances de 5 min de PM−6 h à PM+6 h de Brest ; coefficients 45 et 95 ; U et V de surface en m/s. Ni l’archive ni le NetCDF ne sont dans le dépôt.
- Licence : « Ce produit est diffusé sous **Licence Ouverte (version 2.0 d’avril 2017)** » ; restriction : « **A n’utiliser qu’en complément des cartes et ouvrages nautiques officiels.** » ; identifiant à citer : **doi 10.17183/ATLASCOURANTS2D_NETCDF** (`https://dx.doi.org/10.17183/ATLASCOURANTS2D_NETCDF`). Mention : « Shom – atlas de courants de marée 2D, doi 10.17183/ATLASCOURANTS2D_NETCDF ». Ces mentions sont aussi dans `data/brest.courants.json` (`source`, `licence`, `doi`, `avertissement`).
- Compactage : 13 heures pleines de marée (échéances 0, 12, …, 144), U et V sur un octet signé au pas de 0,02 m/s (écart de codage au plus 0,01 m/s ; plus forte composante de l’atlas 2,25 m/s, portée ±2,54 m/s), points en mer seulement. Interpolation linéaire entre deux heures contre l’atlas à 5 min (vive-eau, tous les points en mer) : 0,042 nd en quadratique, 99 % sous 0,16 nd, 1,42 nd au plus (très localement, aux renverses près de la Pointe des Espagnols).
- Dans l’app (`js/courant.js`) : heure de marée rattachée à la pleine mer de Brest la plus proche (js/maree.js), interpolation linéaire entre les deux champs de l’atlas selon le marnage de la marée en cours (0 à 2,80 m, 1 à 5,90 m, borné à [−0,4 ; 1,4]), bilinéaire dans l’espace sur les seuls nœuds en mer ; entre PM+6 h et la PM−6 h suivante, interpolation entre les deux heures.

### Fonds vrais pour la marge de sécurité (plan 07-07)

- Entrée : `emodnet/bathy_brest.tif` du plan 07-03 (ci-dessus, SHA-256 `f7022ec7c2c9dbc08ae007e9159f68a0358844548792537b4b8f66fe14efc3f5`), géoréférence de `tools/venues/brest.json`.
- `data/brest.fonds.bin` : fond interpolé (centres des pixels) à chaque nœud de l’atlas, en m au-dessus du zéro des cartes (négatif sous le zéro, positif : découvre). EMODnet donne les profondeurs par rapport à la plus basse mer astronomique, qui est à 0,25 m au-dessus du zéro hydrographique à Brest (RAM) : l’outil ajoute 0,25 m (fond moins profond de 25 cm, du côté de la sécurité) au lieu d’assimiler les deux niveaux. Contrôles : zone A −8,2 m (étude −8,7 m sur un autre nœud), milieu du goulet −38,7 m, zone B −4,4 m.
- EMODnet est un modèle à environ 115 m, lissé près des côtes : la marge d’au moins 1 m (D-14c) reste nécessaire ; Litto3D serait plus fin si sa couverture de la rade est confirmée.

## Reconstruction

Depuis la racine du dépôt, avec un dossier d’entrées neuf hors du dépôt (`<entrées>`) et l’environnement des outils de marée hors du dépôt (`<venv>`, ci-dessous) :

```sh
python3 -I tools/prepare_venue.py tools/venues/brest.json <entrées>
python3 -I tools/build_terrain.py <entrées> data --config tools/venues/brest.json
python3 -I tools/build_basemap.py <entrées> data --config tools/venues/brest.json
python3 -I tools/snapshot_weather.py --venue brest
<venv>/bin/python -I tools/build_maree.py <entrées>/refmar data --fixtures tests/fixtures
<venv>/bin/python -I tools/build_courants.py <entrées>/atlas <entrées>/emodnet/bathy_brest.tif data --fixtures tests/fixtures
npm run stamp
```

Durées constatées le 19/11/2026 : marée 2 min 9 s (dont le téléchargement des 93 mois), courant 9 s avec l’archive déjà présente.

Durées constatées le 19/11/2026 : téléchargement 8 min 38 s (dont 7 min 11 s pour OpenStreetMap), relief 8 s, fond de carte 12 s.

Points de contrôle (`tests/brest.test.mjs`) : zone A (fond −8,5 m), zone B (−4,7 m) et milieu du goulet (−33,2 m) en mer ; Île Longue en terre (28,9 m) ; part de terre 66 % ; Pointe des Espagnols à 76,7 m dans un rayon de 600 m ; mêmes ordres de grandeur que l’étude du plan d’eau (−8,7 ; −4,8 ; −33 ; 78 m).

Sans `--config`, `tools/build_terrain.py`, `tools/build_basemap.py` et `tools/snapshot_weather.py` gardent les valeurs de Toulon ; les fichiers de Toulon ne sont jamais régénérés (garde `node tools/gardes-toulon.mjs`).

## Outils

Python 3.13.18, numpy 2.5.3, Pillow 12.3.0 (déjà présents, rien d’installé) ; Node.js v22.23.5 pour `npm run stamp` et les tests.

Marée et courant (plan 07-07) : environnement à part, hors du dépôt (`python3 -m venv <venv>`), jamais utilisé par l’app ni déclaré dans `package.json`. Paquets vérifiés sur PyPI avant installation (auteur, dépôt de sources, nombre de versions) et acceptés par Romain le 19/11/2026 : `netCDF4==1.7.5.1.post1` (Jeff Whitaker, github.com/Unidata/netcdf4-python, licence MIT), `utide==0.4.0` (Wesley Bowman, github.com/wesleybowman/UTide, MIT), `scipy==1.18.1` (github.com/scipy/scipy), `py7zr==1.1.4` (Hiroshi Miura, github.com/miurahr/py7zr, LGPL-2.1+), avec leurs dépendances (numpy 2.5.5, cftime 1.6.6.1, pillow 13.0.0…).

Sécurité des entrées : elles sont traitées comme des données non fiables. Les outils les lisent (PNG, TIFF, XML, JSON) sans jamais les exécuter, Python est lancé avec `-I` (pas de module pris dans le dossier courant), le XML d’OpenStreetMap est lu par `xml.etree.ElementTree` (aucune entité externe résolue), et le résultat est contrôlé (terre et mer aux points connus, relief, part de terre).
