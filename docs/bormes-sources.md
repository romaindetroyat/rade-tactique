# Rade de Bormes – Le Lavandou — provenance et licences des données

Ce document décrit d’où viennent les fichiers `data/bormes.*` du plan d’eau « Rade de Bormes – Le Lavandou » (phase 8, plan 08-03, espace Tofinou), comment ils ont été construits et sous quelles licences. Les entrées téléchargées ne sont pas dans le dépôt : on les retrouve aux adresses ci-dessous et on reconstruit le pack avec les commandes indiquées.

**Avertissement : ce pack ne remplace pas les cartes et ouvrages nautiques officiels.** Les fonds viennent d’un modèle à environ 115 m (EMODnet) et sont lissés près des côtes ; la côte d’OpenStreetMap est la laisse de haute mer ; les zones réglementées (Levant, Port-Cros, Brégançon) ne sont pas dans ce pack : elles sont dans le descripteur `js/venue-bormes.js` (section « Savoir local » ci-dessous), tracées large et marquées « à compléter sur carte marine ». Le pack sert à la tactique (vent, routes), jamais à la navigation de sécurité.

## Fichiers produits

| Fichier | Taille (octets) | Produit par |
|---------|-----------------|-------------|
| `data/bormes.meta.json` | 314 | `tools/build_terrain.py --config`, complété par `tools/build_basemap.py --config` (taille du fond de carte) |
| `data/bormes.terrain.bin` | 1 823 100 | `tools/build_terrain.py --config` (1030 × 885, Int16, décimètres ; de −1 811,8 m à +597,6 m) |
| `data/bormes.cover.bin` | 911 550 | `tools/build_terrain.py --config` (0 mer, 1 terre, 2 urbain, 3 digue : 660 144, 213 214, 37 927, 265 cellules) |
| `data/bormes.coast.json` | 92 212 | `tools/build_terrain.py --config` (Douglas-Peucker 6 m) |
| `data/bormes.basemap.jpg` | 639 587 | `tools/build_basemap.py --config` (4096 × 3518, qualité 84) |
| `data/bormes.seamask.png` | 137 334 | `tools/build_basemap.py --config` (4096 × 3518) |
| **Total** | **3 604 097** | |
| `data/bormes.wx-snapshot.json` | — | `tools/snapshot_weather.py --venue bormes` : **non produit le 26/11/2026** (Open-Meteo : « Daily API request limit exceeded », limite quotidienne de l’adresse partagée de l’environnement de construction) ; à produire avant la publication |

Les tailles et empreintes SHA-256 exactes des fichiers du pack sont dans `data/venues.json`, généré par `npm run stamp`. Le pack est téléchargé à la demande (comme celui de Brest), jamais mis dans la liste hors réseau, et n’est servi qu’à l’espace Tofinou (middleware, depuis 08-02).

Emprise : ouest 6,22, est 6,60, sud 42,96, nord 43,20 (de La Londe à Cavalaire, Port-Cros, l’ouest du Levant ; coffre 1 et baie de Cavalaire compris) ; maille de 30 m (grille fine de 10 m pour le masque terre / mer). Configuration : `tools/venues/bormes.json`.

### Île du Levant : terre naturelle, pas « urbain »

OpenStreetMap décrit presque toute l’île du Levant en `landuse=military`. La liste par défaut des types urbains de `tools/prepare_venue.py` contient `military` (Toulon, Brest) : le pack d’essai de l’étude avait ainsi toute l’île en « urbain » (beige sur le fond de carte, vent freiné de 25 %). La configuration de Bormes donne sa propre liste (`"urban": ["residential", "industrial", "commercial", "harbour"]`) ; `python3 -I tools/prepare_venue.py --types-urbains tools/venues/bormes.json` l’affiche sans réseau. Résultat : 9 783 cellules urbaines de moins que le pack d’essai (37 927 au lieu de 47 710), toutes sur le Levant. Restent urbains, à juste titre, le village d’Héliopolis (`residential`) et deux petites zones `industrial` à l’ouest de 6,475° E ; rien à l’est de 6,48° E. Sans clé `urban`, la liste par défaut est inchangée : Brest se reconstruirait à l’identique.

## Entrées téléchargées (le 26 novembre 2026)

Toutes les entrées ont été téléchargées par `tools/prepare_venue.py` (bibliothèque standard de Python, `urllib`, délais de 60 s, en-tête `User-Agent` générique sans nom ni adresse) dans un dossier neuf hors du dépôt, chacune dans son propre sous-dossier (`tiles/`, `emodnet/`, `osm/`). Le fichier `manifeste.json` du dossier d’entrées donne pour chacune l’adresse, la taille, le SHA-256 et l’heure (UTC). Résumé :

### Relief à terre : tuiles d’altitude Terrarium (AWS Terrain Tiles)

- Adresse : `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png`, zoom 13, x de 4237 à 4246, y de 3003 à 3011.
- 90 tuiles, 3 457 830 octets, téléchargées entre 19:28:30 et 19:28:47 UTC.
- Empreinte de la liste (SHA-256 des lignes « chemin, NUL, SHA-256 du fichier », triées et jointes par des sauts de ligne) : `aff884ccac3ae2f1361c857c2f04ba7f336be10922d44190066a6e4a5bb5eec4`.
- Licence : jeu de données ouvert « Terrain Tiles » (AWS Open Data), assemblé à partir de sources publiques (SRTM, GMTED2010, ETOPO1 et d’autres selon les zones) ; les mentions demandées sont celles de la page d’attribution du jeu Terrain Tiles. Mention courte retenue : « AWS Terrain Tiles (Terrarium, SRTM/GMTED) ».

### Fonds : EMODnet Bathymetry

- Adresse exacte : `https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=emodnet:mean&crs=EPSG:4326&BBOX=6.15,42.90,6.65,43.25&format=image/tiff&interpolation=nearest&resx=0.00104166666&resy=0.00104166666`
- Fichier `emodnet/bathy_bormes.tif` : 645 504 octets, SHA-256 `c67b2edd55212119a0c684cdb252dd7f1a859af24696c239410eac99c3bb4f28`, 19:28:48 UTC.
- TIFF de 480 × 336 flottants, sans balise de géoréférence dans le fichier : la géoréférence vient de la requête et est écrite dans `tools/venues/bormes.json` (coin nord-ouest 6,15 ; 43,25 ; pas de 1/960°) ; l’outil vérifie la taille de l’image. Profondeurs rapportées à la plus basse mer astronomique (LAT) ; marnage d’une vingtaine de centimètres dans la baie, sans effet sur l’usage tactique.
- Licence : données EMODnet Bathymetry, d’usage libre avec citation de la source. Mention : « EMODnet Bathymetry DTM ».

### Côte, digues et zones urbaines : OpenStreetMap

- **Méthode utilisée : API principale d’OpenStreetMap par boîtes** (`api.openstreetmap.org`). Overpass a d’abord été essayé sur les deux serveurs de la configuration de Brest (requête : `way["natural"="coastline"]`, `way["man_made"~"^(breakwater|pier|groyne)$"]`, `way["landuse"~"^(residential|industrial|commercial|harbour)$"]` et les relations `landuse` correspondantes sur la boîte `(42.94,6.18,43.22,6.64)`, sortie `out geom`) : `overpass-api.de` a coupé la connexion, `overpass.kumi.systems` a dépassé le délai. Aucun miroir tiers n’a été utilisé.
- Repli : `https://api.openstreetmap.org/api/0.6/map?bbox=<ouest>,<sud>,<est>,<nord>` sur la grille 6,20 à 6,64 × 42,94 à 43,22 en boîtes de 0,04° × 0,02° (154 boîtes), une seconde de pause entre deux requêtes, aucune coupure pour trop de nœuds, arrêt prévu sur 429 ou 509 (jamais atteint) : **154 boîtes** lues, 224 819 107 octets de XML, entre 19:29:54 et 19:34:53 UTC.
- Empreinte de la liste des boîtes (même calcul que pour les tuiles) : `bbd6ba13100e028563432145d36131859053b56e6f9d5563c646b3910647562f`.
- Extrait converti `osm/osm_extract.json` (chemins dédoublonnés par identifiant ; relations `landuse` en multipolygone assemblées en anneaux) : 94 traits de côte, 168 digues, jetées et épis, 190 zones urbaines ; 471 262 octets, SHA-256 `f4b3172c7e753960c20d2f2ab526cb2a3db1b351d40958d78c0ee7efd94de927`.
- Manifeste complet des entrées (`manifeste.json`, 245 entrées) : SHA-256 `b73c4efbfd60993bb3298daccd834eb396797a1f4a7a05a4f00acfe0b9381f20`.
- Recoupement avec le pack d’essai de l’étude (construit le même jour à partir d’un miroir Overpass, jamais recopié) : `bormes.coast.json` et `bormes.terrain.bin` identiques octet pour octet ; `bormes.cover.bin` ne diffère que par les 9 783 cellules du Levant (ci-dessus).
- Licence : **© contributeurs OpenStreetMap (ODbL)**. `data/bormes.coast.json`, `data/bormes.cover.bin` et le dessin des côtes du fond de carte sont des bases de données dérivées d’OpenStreetMap : elles restent sous ODbL et la mention doit accompagner leur affichage.

### Instantané météo : Open-Meteo

- Configuration : bloc `weather` de `tools/venues/bormes.json` (mêmes valeurs que le descripteur du plan d’eau, 08-04) ; `python3 -I tools/snapshot_weather.py --venue bormes --urls` affiche les adresses sans réseau.
- Requêtes : `https://api.open-meteo.com/v1/forecast` au milieu de la baie (43,115 ; 6,39) avec les six modèles de l’app, puis la grille de 20 points (latitudes 43,02, 43,06, 43,10, 43,14 × longitudes 6,30, 6,36, 6,42, 6,48, 6,54) en `meteofrance_arome_france_hd`, toutes deux avec `cell_selection=sea` ; état de la mer `https://marine-api.open-meteo.com/v1/marine?latitude=43.115&longitude=6.39&…` (vagues, courant, température de l’eau). Ce sont exactement les adresses que construit `js/weather.js` avec ce bloc (`tests/bormes.test.mjs`).
- Le 26/11/2026, `api.open-meteo.com/v1/forecast` a répondu « Daily API request limit exceeded. Please try again tomorrow. » (limite quotidienne de l’adresse partagée de l’environnement de construction) : **aucun fichier produit, aucun fichier inventé.** Sans instantané, l’app reçoit `null` et le dit (« Hors ligne ») ; le fichier est à produire avant la publication, depuis une adresse non limitée.
- Licence : données Open-Meteo sous CC BY 4.0, mention « Weather data by Open-Meteo.com ».

## Reconstruction

Depuis la racine du dépôt, avec un dossier d’entrées neuf hors du dépôt (`<entrées>`) et un dossier de sortie neuf (`<sortie>`) :

```sh
python3 -I tools/prepare_venue.py tools/venues/bormes.json <entrées>
python3 -I tools/build_terrain.py <entrées> <sortie> --config tools/venues/bormes.json
python3 -I tools/build_basemap.py <entrées> <sortie> --config tools/venues/bormes.json
cp <sortie>/bormes.* data/
python3 -I tools/snapshot_weather.py --venue bormes
npm run stamp
```

Durées constatées le 26/11/2026 : téléchargement 6 min 23 s (dont 5 min environ pour OpenStreetMap), relief 14 s, fond de carte 24 s.

Points de contrôle (`tests/bormes.test.mjs`) : milieu de la baie (fond −25,6 m), devant Le Lavandou (−19,3 m), coffre 1 (−32,0 m), passe Bénat – Bagaud (−64,1 m) et passe des Grottes (−18,1 m) en mer ; La Fourmigue, îlot de la Gabinière et îlot du Cristau en terre ; massif du cap Bénat 183,9 m dans 2,5 km du phare, Port-Cros 188,3 m, point culminant 597,6 m ; part de terre 27,6 % ; champ de vent aux réglages par défaut de 206 × 177 = 36 462 cellules, dont 44 % de l’eau à plus de 4 000 m de la terre ; par ouest 260°, 0,84 du vent de base au milieu de la baie. Mêmes valeurs que l’étude du plan d’eau (08-RESEARCH-PLAN-EAU.md § 1.3, § 3.4, § 6.5).

Sans `--config`, `tools/build_terrain.py`, `tools/build_basemap.py` et `tools/snapshot_weather.py` gardent les valeurs de Toulon ; sans clé `urban`, `tools/prepare_venue.py` garde sa liste par défaut ; les fichiers de Toulon et de Brest ne sont jamais régénérés (garde `node tools/gardes-toulon.mjs`).

## Outils

Python 3.13.18, numpy 2.5.3, Pillow 12.3.0 (déjà présents, rien d’installé) ; Node.js v22.23.5 pour `npm run stamp` et les tests.

Sécurité des entrées : elles sont traitées comme des données non fiables. Les outils les lisent (PNG, TIFF, XML, JSON) sans jamais les exécuter, Python est lancé avec `-I` (pas de module pris dans le dossier courant), les scripts du dépôt sont lancés depuis le dépôt avec les chemins des données en arguments, le XML d’OpenStreetMap est lu par `xml.etree.ElementTree` (aucune entité externe résolue), et le résultat est contrôlé (terre et mer aux points connus, fonds, relief, part de terre, Levant).

## Savoir local : zones, marques, lieux, dangers (08-07)

Le descripteur `js/venue-bormes.js` porte les zones interdites, les marques, les lieux nommés et les dangers de la rade, repris de l’étude du plan d’eau (08-RESEARCH-PLAN-EAU.md § 2.3 à 2.6). **Aucune de ces sources n’a été contrôlée dans sa version en vigueur : tout est « à compléter sur carte marine » et ne remplace pas les cartes et ouvrages nautiques officiels.** Contrôle humain avant toute course autour des îles (08-09) : lire les arrêtés à jour de la préfecture maritime de la Méditerranée et tracer les zones sur la carte marine.

### Zones interdites (évitées par le routage)

| Zone | Sources | Tracé |
|------|---------|-------|
| Île du Levant — zone militaire | Arrêté du préfet maritime n° 55/2021 du 29 mars 2021 et sa carte « Île du Levant » (direction interrégionale de la mer Méditerranée, avril 2021) ; coordonnées des zones reprises d’un projet d’arrêté de pêche de novembre 2024 qui recopie l’arrêté 55/2021 (lu par l’étude, cité) | Points 1 (calanque du Tablier), 23, 24, 25, 26, 29, 30, 6, 7 et 2 (pointe Maupertuis) de l’arrêté ; côté nord, bande de 200 m tracée une fois sur `data/bormes.coast.json` (limite nord de l’union des disques de 200 m centrés sur la côte, simplifiée puis relevée : 200,8 à 233,6 m de la côte du pack) ; retour du point 2 au point 1 par la terre de l’île. Points 27, 3, 4 et 28 laissés de côté (contour qui se touchait lui-même dans l’ordre de l’étude ; l’échancrure à l’est du Titan est fermée). Zone 6 (navigation interdite du 1er septembre au 30 juin selon la carte) tenue interdite toute l’année. Ouest de l’île (Héliopolis, port de l’Ayguade) et passe des Grottes libres. |
| Fort de Brégançon | Arrêté du préfet maritime n° 192/2018 du 26 juillet 2018 (texte non trouvé) ; limite de la zone citée par l’arrêté n° 110/2023 du 11 mai 2023 entre 43°05,341′ N 006°19,392′ E et 43°05,569′ N 006°19,625′ E | Ces deux points, un arc de 500 m autour du cap de Brégançon (position de l’arrêté 110/2023) et deux points sur la terre au nord du fort : tracé supposé hors des deux points connus. |

Parc national de Port-Cros : pas de zone interdite à la voile, donc pas de polygone ; l’information est donnée à l’équipage dans les dangers (5 nd à moins de 300 m des côtes, 12 nd dans les 600 m du cœur marin, bateaux propres, pas de débarquement à Bagaud ni sur les réserves intégrales de la Gabinière et du Rascas, zones temporaires possibles) d’après le dépliant « Réglementation marine » 2025 du parc.

### Marques

| Clé | Marque | Position | Source |
|-----|--------|----------|--------|
| FOU | La Fourmigue (balise de danger isolé, îlot) | 43°06,362′ N 006°24,252′ E | Arrêté 110/2023 et OpenStreetMap, identiques ; marque fixe |
| COF | Coffre 1 | 43°05,113′ N 006°16,767′ E | Annexe « Parcours » du Challenge de la Baie (une seule source) ; à confirmer sur l’eau |
| DAM | La Dame (cardinale est, tourelle) | 43°00,399′ N 006°25,240′ E | OpenStreetMap ; « sa cardinale » des parcours 6 et 10 : déduction, à confirmer au club |
| CNE | Bouée de cap Nègre | vers 43,137° N 6,447° E | Croquis de l’annexe ; bouée mouillée, position à confirmer |
| BEN | Bouée de Bénat | 43,09° N 6,38° E | Supposée devant le cap Bénat, cohérente avec la longueur annoncée du parcours 2 (6,2 M ; 5,9 M depuis la ligne du Lavandou, 6,4 M depuis le feu) ; position à confirmer |
| CAV | Bouée Cavalaire | vers 43,17° N 6,55° E | Croquis sur carte ; position à confirmer |
| ORA | Bouée orange (parcours 3 et 10) | milieu du segment ligne du Lavandou – La Fourmigue | Aucune position publiée ; position à confirmer |

Les bouées mouillées portent `src: 'approx'` : l’équipage les confirme le jour de course par les marques de la régate. La Fourmigue est une cellule de terre du pack (îlot) ; le routage l’atteint comme la Roche Mengam à Brest (l’arrivée est testée avant la terre).

### Lieux et dangers

- Lieux : les 46 nœuds OpenStreetMap (ODbL) du tableau de l’étude (extrait du 26/11/2026). Baie de Bormes, La Favière, Saint-Clair, Aiguebelle, Pramousquier, passe de Bagaud et Héliopolis n’ont pas de nœud nommé : non placés.
- Dangers : La Fourmigue, îlot du Cristau, La Dame, rocher du Rascas, îlot de la Gabinière, L’Esquillade, roches au sud du port de Bormes, Batterie des Maures, îlots de Léoube, de l’Estagnol et du Jardin (OpenStreetMap, arrêté 110/2023), et l’information du parc de Port-Cros. La sèche de Gouron (nom lu sur l’extrait de carte du parcours 9) n’a pas de position relevée : à lire sur la carte marine.
- Feux cités dans les notes : OpenStreetMap, à vérifier sur le livre des feux.
