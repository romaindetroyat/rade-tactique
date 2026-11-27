# Phase 8 : Espace Tofinou — Étude du plan d'eau de Bormes – Le Lavandou et polaire du Tofinou 9.5

**Recherche faite le :** 2026-11-26
**Domaine :** relief et côte, régates et repères, zones réglementées, vents, marée et courants de la rade de Bormes – Le Lavandou (baie de Bormes, est de la rade d'Hyères, Port-Cros, Levant, cap Bénat, cap Nègre, Cavalière, Cavalaire) ; polaire du Tofinou 9.5 ; ce qu'il faut produire pour un pack « Bormes » du niveau de Brest et de Toulon
**Confiance générale :** HAUTE pour ce qui a été mesuré ou construit dans cette session (pack d'essai construit avec les outils du dépôt, tailles exactes, climatologie Météo-France 2010-2026, marée du marégraphe de Toulon, certificat ORC d'un Tofinou 9.5, fiche OSIRIS, documents de course 2026-2027) ; MOYENNE pour les zones réglementées (textes de 2021 à 2024 lus, version en vigueur non contrôlée) et pour le courant (un seul modèle, maille de 8 km) ; BASSE pour les conseils de vent rédigés et pour l'écart entre le bateau réel et le sister-ship du certificat

Ce document complète `08-RESEARCH.md` (cloisonnement par espace, bateau et polaire par espace : le branchement), qui n'est pas modifié. Il lui fournit ce qu'il attend d'une « autre étude » : l'identifiant du plan d'eau (`bormes`), le pack, la table de la polaire, la longueur et le tirant d'eau du bateau, les pertes au virement, le texte du plan d'eau pour les consignes.

Balises de provenance : `[VERIFIED: …]` = constaté dans cette session par un outil sur une source qui fait autorité pour ce point ; `[CITED: …]` = lu dans un document cité ; `[ASSUMED]` = connaissance générale ou estimation non vérifiée ici, à confirmer.

Règles de ce document : aucune empreinte de `middleware.js`, aucun code d'accès, aucun nom de modèle d'IA, aucun nom d'équipier, d'arbitre ni de propriétaire (les classements et documents de course lus en contiennent ; ils ne sont pas repris).

<user_constraints>
## Contraintes de l'utilisateur

Il n'existe pas de `08-CONTEXT.md`. Contraintes tirées de la demande de Romain transmise par l'orchestrateur et du fichier d'instructions du projet :

### Décisions verrouillées

- Créer un espace dédié à un **Tofinou 9.5** (chantier Latitude 46) régatant en **rade de Bormes-les-Mimosas / Le Lavandou** : baie de Bormes, est de la rade d'Hyères, îles d'Or (Levant, Port-Cros), cap Bénat, cap Nègre, baie de Cavalière.
- Le plan d'eau doit avoir **ses reliefs, ses vents et la polaire du bateau**, au même niveau que l'étude de Brest (`07-RESEARCH-PLAN-EAU.md`).
- Même système de « pack » que Brest (`js/venues.js`, module léger, fichiers plats `data/<id>.*`, `tools/prepare_venue.py`, `tools/venues/<id>.json`, `build_terrain.py` et `build_basemap.py` avec `--config`, `snapshot_weather.py --venue`).
- Polaire au format de `data/j80.pol`, relue par `parsePolar` ; l'équipage doit pouvoir la recaler (polaire personnelle, `setPolar`).
- Toulon et Brest ne changent pas (gardes de la phase 7).
- App sans build, JavaScript sans framework, hors réseau en mer, Vercel, interface en français.

### Laissé à l'appréciation de l'étude

- Emprise, résolution, origine de projection, grille météo.
- Catalogue de parcours et de marques à semer.
- Régimes de vent et conseils (marqués selon leur origine, comme à Brest), paramètre « mer dégagée ».
- Courant : modèle embarqué ou non.
- Source et méthode de la polaire.

### Hors périmètre de ce document

- Cloisonnement des espaces, codes d'accès, archive, quotas, consignes d'IA, stockage local, service worker : `08-RESEARCH.md`.
- Golfe de Saint-Tropez (Voiles de Saint-Tropez) : cité pour comparaison seulement, hors de l'emprise.
</user_constraints>

<phase_requirements>
## Exigences de la phase

La feuille de route dit « Requirements: TBD ». `08-RESEARCH.md` propose ESP-01 à ESP-06 ; cette étude sert celles-ci et propose quatre exigences de plan d'eau, à faire valider :

| ID | Description | Ce que cette étude apporte |
|----|-------------|----------------------------|
| ESP-04 | Bateau par espace : classe, longueur, tirant d'eau, polaire par défaut, pertes au virement | § 5 (polaire, caractéristiques, pertes) |
| ESP-06 | Espace Tofinou utilisable hors réseau sur Bormes | § 1 et § 6 (pack de 3,6 Mo, mêmes outils) |
| BOR-01 (proposée) | Pack « Bormes » : relief, côte, fond de carte, instantané météo | § 1 (pack d'essai construit, tailles exactes), § 6.1 |
| BOR-02 (proposée) | Catalogue de la baie : marques fixes, lignes, parcours du Challenge de la Baie, zones interdites, dangers, lieux | § 2 |
| BOR-03 (proposée) | Régimes de vent et météo propres à la baie | § 3 |
| BOR-04 (proposée) | Courant : information seulement, pas de modèle embarqué | § 4 |
</phase_requirements>

## Résumé

Le pack « Bormes » se construit **aujourd'hui, sans rien changer aux outils** : un fichier de configuration d'essai (`bormes.json`, hors du dépôt) passé à `tools/prepare_venue.py`, `tools/build_terrain.py` et `tools/build_basemap.py` a produit dans cette session un pack complet de **3,60 Mo** en une minute (29 s de téléchargement, 12 s de relief, 21 s de fond de carte). L'emprise conseillée, **6,22° E à 6,60° E et 42,96° N à 43,20° N** (30,9 × 26,5 km), couvre La Londe, la baie de Bormes, Le Lavandou, le cap Bénat, Brégançon, Cavalière, le cap Nègre, la baie de Cavalaire, Port-Cros, Bagaud et le Levant, c'est-à-dire toute la zone de course écrite dans l'avis de course du Challenge de la Baie 2026-2027 (« de la Londe à Cavalaire pouvant être prolongé jusqu'aux îles de Port Cros et du Levant »). Le champ de vent de l'app tourne dessus tel quel : 45 % de l'eau est à plus de 4 km d'une terre, donc le seuil « mer dégagée » de Toulon (4 000 m) convient et le réglage spécial de Brest (1 500 m) n'est pas nécessaire.

Le plan d'eau ressemble à Toulon (Méditerranée, relief haut au nord, mer ouverte au sud) mais avec trois différences qui comptent. **Le vent fort vient de l'ouest, pas du nord-ouest** : à l'île du Levant, aux heures de course, les vents de 17 nd et plus viennent du 250° au 270° (médiane 260°) ; le test « mistral » de Toulon (285° à 345°) ne le reconnaîtrait pas. **L'est est le second régime** (31 % des heures de course de mai à septembre, 35 % d'octobre à avril). **La brise tourne à droite** l'après-midi (sud-est vers midi, sud-ouest vers 16 h), comme à Toulon et à l'inverse de Brest. La marée est négligeable (marnage médian de 21 cm mesuré à Toulon, mêmes constituants à Port-Cros) : pas de module de marée. Le courant est faible dans la baie (0,2 nd en médiane dans le modèle) mais le courant liguro-provençal porte à l'ouest à 0,6 à 0,9 nd en médiane au sud et entre les îles dans le seul modèle disponible : à afficher comme une information, sans modèle embarqué.

Pour la polaire, **une seule source chiffrée existe** : le certificat ORC Club 2026 d'un Tofinou 9.5 espagnol (seul Tofinou 9.5 parmi 8 307 certificats de 38 pays relus dans cette session). Il donne directement les vitesses de 4 à 24 nd de vent. Converti avec la méthode de `tools/build_polar.mjs`, il donne un fichier de 897 octets que `parsePolar` relit et dont les VMG retombent sur ceux du certificat à 0,04 nd près. Réserve principale : ce sister-ship porte un **génois de 26,4 m²**, alors que la fiche OSIRIS de la série décrit un foc de 16 m² ; au près par petit temps l'écart attendu est de 7 à 15 %. Le bateau réel doit être décrit (voile d'avant, quille) avant de figer la polaire par défaut, puis recalé sur ses traces.

**Recommandation principale :** produire le pack `data/bormes.*` avec la configuration ci-dessous (emprise A, maille de 30 m, seuils du vent par défaut), semer le catalogue du Challenge de la Baie (La Fourmigue, coffre 1, parcours 1 à 10), définir des régimes propres (« mistral » = ouest), ne pas embarquer de courant, et livrer la polaire du certificat ORC en deux variantes (génois du certificat, foc d'origine estimé), présentée comme « à recaler ».

## Contraintes du projet (fichier d'instructions du projet)

- JavaScript sans framework ni étape de build ; modules ES chargés tels quels ; pas de TypeScript ; identifiants et commentaires comme l'existant ; textes en français.
- PWA qui doit fonctionner hors réseau en mer ; tout ce qui sert en course doit être dans un cache.
- `sw.js` (bloc généré) et `js/version.js` ne se modifient jamais à la main : `npm run stamp` après tout changement.
- Hébergement Vercel ; tout nouveau fichier de données reste derrière le contrôle d'accès ; aucun secret dans le code ni les documents.
- Outils de données en Python (numpy, Pillow), hors déploiement.
- Vent : plage utile jusqu'à 25 nœuds.
- Pas de mise en production dans les 48 h avant une régate ni pendant une course.
- Toute modification passe par une commande du flux de travail du projet ; cette étude ne modifie aucun fichier de code.

## Carte des responsabilités

| Capacité | Où | Secours | Pourquoi |
|----------|----|---------|----------|
| Relief, côte, fond de carte de Bormes | Fichiers statiques `data/bormes.*` produits par `tools/` (hors déploiement) | — | Même chaîne que Brest |
| Catalogue (marques, parcours, zones, lieux, régimes) | Module léger `js/venue-bormes.js` | — | Même forme que `js/venue-brest.js` |
| Champ de vent local | Navigateur (`js/wind.js`, réglages par défaut) | — | Aucun réglage propre nécessaire |
| Prévisions | Open-Meteo depuis le navigateur | Cache local, puis instantané du pack | Existant |
| Vent mesuré en direct | Aucune balise ouverte dans la baie ; fonction relais si l'on veut les stations Météo-France | L'app s'en passe déjà (Brest) | Jeton côté serveur |
| Marée | Aucune | — | 21 cm de marnage médian |
| Courant | Affichage du courant modélisé (point marin d'Open-Meteo, texte propre au lieu) | Rien | Pas d'atlas ; maille de 8 km |
| Polaire du Tofinou 9.5 | Module `js/polar-tofinou95.js` (synchrone, hors réseau) et `data/tofinou95.pol` (téléchargement) | Polaire personnelle importée | Même forme que `js/polar-orc.js` |

## Référence : ce qui existe

| Élément | Valeur | Source |
|---------|--------|--------|
| Registre des plans d'eau | `export const VENUES = Object.freeze({ toulon: TOULON, brest: BREST });` et `export const VENUE_IDS = ['toulon', 'brest'];` | [VERIFIED: js/venues.js:42-43] |
| Bornes de saisie de Toulon | `inputBounds: { south: 42.9, north: 43.28, west: 5.7, east: 6.2 },` | [VERIFIED: js/venues.js:17] |
| Descripteur de Brest (modèle à suivre) | `origin: { lat: 48.33, lon: -4.45 },` ; `files: { base: 'data/brest.' },` ; `cellSelection: 'sea',` ; `marine: null,` ; `live: null,` ; `wind: { cell: 150, openSea: 1500 },` | [VERIFIED: js/venue-brest.js:241, 246, 254-256, 262] |
| Seuils du champ de vent | `constructor(terrain, { cell = 150, openSea = 4000 } = {}) {` ; référence : `if (!this.land[id] && this.distLand[id] > this.openSea) speeds.push(sp);` | [VERIFIED: js/wind.js:19, 108] |
| Terre urbaine dans le vent | `this.k[id] = this.land[id] ? Math.max(0.04, Math.exp(-h / 110)) * (c === 2 ? 0.75 : 1) : 1;` | [VERIFIED: js/wind.js:34] |
| Effet de contournement atténué avec plusieurs points de prévision | `const wFac = pts.length > 1 ? 0.6 : 1;` | [VERIFIED: js/wind.js:211] |
| Mistral de Toulon | `{ id: 'mistral', name: 'Mistral (NO)', test: (d, s) => d >= 285 && d <= 345 && s >= 12,` | [VERIFIED: js/tactics.js:21] |
| Outil de préparation : classes urbaines | `URBAN = {'residential': 'residential', 'industrial': 'industrial', 'commercial': 'commercial',` puis `'military': 'military', 'harbour': 'port'}` | [VERIFIED: tools/prepare_venue.py:22-23] |
| Instantané météo : plans d'eau acceptés | `if v != 'brest':` puis `raise SystemExit('plan d’eau inconnu : ' + v)` | [VERIFIED: tools/snapshot_weather.py:18-19] |
| Annonce d'un pack | `const VENUE_META = /^data\/([a-z][a-z0-9-]*)\.meta\.json$/;` | [VERIFIED: tools/stamp.mjs:38] |
| Polaire J80 : outil | `const TWS = [6, 8, 10, 12, 14, 16, 20];` ; `const ROWS = [30, 34, 36, 38, 40, 42, 44, 47, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];` ; sorties `'../data/j80.pol'` et `'../js/polar-orc.js'` | [VERIFIED: tools/build_polar.mjs:4, 20, 43, 45] |
| Polaire : lecture et remplacement | `export function setPolar(tws, twa, bsp, source) {` ; `export function parsePolar(text) {` | [VERIFIED: js/polar.js:17, 26] |
| Pertes aux manœuvres (J80) | `const { terrain, forbidden = [], tackLoss = 9, gybeLoss = 6, perf = 1, current = null, t0 = 0, depth = null } = opts;` | [VERIFIED: js/router.js:17] |
| Tailles des packs | Toulon 2 557 377 octets dans `data/` (instantané météo de 89 352 octets compris) ; Brest `"bytes": 4673496` (sans instantané) | [VERIFIED: `ls -l data/` ; data/venues.json] |

## 1. Emprise et données

### 1.1 Emprise conseillée

Points à couvrir [VERIFIED sauf mention : documents de course 2026-2027, arrêté préfectoral 110/2023, nœuds OpenStreetMap, tous lus dans cette session] :

- La Fourmigue 43°06,362' N 006°24,252' E (même position dans l'arrêté et dans OpenStreetMap), marque de sept parcours sur neuf.
- « Coffre 1 » 43°05,113' N 006°16,767' E (annexe des parcours), marque la plus à l'ouest.
- Baie de Cavalaire (bouée mouillée, vers 43,17° N 6,55° E d'après le croquis [ASSUMED pour la position]), marque la plus à l'est.
- Port-Cros « et sa cardinale », Bagaud, îlot de la Gabinière (42,9882° N) : tour de l'île, 20 milles.
- Zones interdites du Levant jusqu'à 6°32,34' E et 42°59,62' N (§ 2.6).
- Cinq kilomètres de relief au vent de la baie dans toutes les directions (portée du dévent de `js/wind.js`) : crêtes des Maures à 3 ou 4 km au nord de la côte.

| Emprise | Ouest, Est, Sud, Nord | Taille | Grille 30 m | `terrain.bin` | `cover.bin` | Vent à 150 m | Fond 4096 px |
|---------|----------------------|--------|-------------|---------------|-------------|--------------|--------------|
| **A — conseillée : La Londe à Cavalaire, Port-Cros, Levant** | 6,22 ; 6,60 ; 42,96 ; 43,20 | 30,9 × 26,5 km | 1030 × 885 = 911 550 | 1,82 Mo | 0,91 Mo | 206 × 177 = 36 462 | 4096 × 3518 (7,5 m par pixel) |
| B — resserrée : baie de Bormes, Port-Cros, ouest du Levant (ni coffre 1 ni Cavalaire) | 6,28 ; 6,54 ; 42,97 ; 43,19 | 21,1 × 24,3 km | 705 × 811 = 571 755 | 1,14 Mo | 0,57 Mo | 141 × 162 = 22 842 | 4096 × 4713 |
| C — étendue à Porquerolles (Trophée des Îles) | 6,12 ; 6,60 ; 42,95 ; 43,20 | 39,0 × 27,6 km | 1301 × 921 = 1 198 221 | 2,40 Mo | 1,20 Mo | 260 × 184 = 47 840 | 4096 × 2901 (9,5 m par pixel) |
| Brest (rappel) | −4,66 ; −4,22 ; 48,22 ; 48,43 | 32,6 × 23,2 km | 1086 × 774 = 840 564 | 1,68 Mo | 0,84 Mo | 217 × 155 = 33 635 | 4096 × 2920 |
| Toulon (rappel) | 5,80 ; 6,10 ; 43,00 ; 43,18 | 24,4 × 19,9 km | 814 × 667 | 1,09 Mo | 0,54 Mo | 163 × 133 = 21 679 | 4096 × 3343 |

[VERIFIED: calcul de cette session avec les constantes de `js/geo.js` (110 574 m par degré de latitude, 111 320 × cos(latitude) par degré de longitude) ; l'emprise A a été construite, les autres sont calculées]

- L'emprise A est la seule qui contient tout le catalogue du Challenge de la Baie. La B perd le coffre 1 (parcours 5 et 7) et Cavalaire (parcours 9). La C n'est utile que si l'équipage court le Trophée des Îles (autour de Porquerolles, § 2.1) : +31 % de cellules, champ de vent 2,2 fois celui de Toulon ; elle demanderait une maille de vent de 180 ou 200 m.
- L'emprise de Toulon s'arrête à 6,10° E et celle de Bormes commence à 6,22° E : aucun recouvrement des emprises. Les **bornes de saisie** se recouvriraient si l'on appliquait la règle « emprise ± 0,1° » (ouest à 6,12° E, alors que celles de Toulon vont jusqu'à 6,2° E) : voir le piège 6.
- Origine de projection conseillée : 43,10° N, 6,40° E (entre le milieu de la baie et La Fourmigue) [ASSUMED pour le choix ; sans effet sur la précision à cette échelle].
- Golfe de Saint-Tropez : hors de toutes ces emprises (43,27° N, 6,64° E) ; un autre pack si l'équipage va aux Voiles.

### 1.2 Disponibilité des sources (téléchargées dans cette session)

| Source | Résultat | Détail |
|--------|----------|--------|
| Tuiles d'altitude Terrarium, zoom 13 | Disponible | 90 tuiles (x 4237 à 4246, y 3003 à 3011), 3 457 830 octets, depuis `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png` [VERIFIED: manifeste écrit par `tools/prepare_venue.py`] |
| Bathymétrie EMODnet (`emodnet:mean`) | Disponible | `https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=emodnet:mean&crs=EPSG:4326&BBOX=6.15,42.90,6.65,43.25&format=image/tiff&interpolation=nearest&resx=0.00104166666&resy=0.00104166666` rend un TIFF 480 × 336 de 645 504 octets ; géoréférence `left 6.15, top 43.25, step 1/960` ; l'outil contrôle la taille [VERIFIED] |
| OpenStreetMap par Overpass, serveurs de la configuration de Brest | **Injoignables** | `overpass-api.de` : connexion coupée ; `overpass.kumi.systems` et `overpass.private.coffee` : aucune réponse. Aucune observation sur leur contenu [VERIFIED: sorties de cette session] |
| OpenStreetMap par un miroir Overpass | Disponible | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` : réponse complète en quelques secondes (1 442 703 octets pour la requête de l'outil, données à jour à 17 h 38 TU le jour même). 97 traits de côte (203 km), 177 digues, jetées et épis, 215 zones urbaines [VERIFIED]. Miroir tenu par un tiers : à faire accepter (§ 6.6) |
| OpenStreetMap par l'API principale | Disponible | Une boîte d'essai de 0,04° × 0,02° autour du cap Bénat : 2,4 Mo, réponse normale. C'est le repli déjà écrit dans l'outil (User-Agent générique, sans adresse) [VERIFIED] |

Requêtes complémentaires faites par le miroir pour cette étude (marques `seamark:*`, lieux nommés, zones protégées et militaires) : 163 marques, 379 lieux nommés (dont les caps et îlots du § 2.4), 47 zones [VERIFIED].

### 1.3 Pack d'essai construit avec les outils du dépôt

Commandes lancées, configuration et sorties dans un dossier temporaire, aucun fichier du dépôt modifié (`git status` vide après coup) [VERIFIED: sorties de cette session] :

```sh
python3 -I tools/prepare_venue.py <config>/bormes.json <entrées>
python3 -I tools/build_terrain.py <entrées> <sortie> --config <config>/bormes.json
python3 -I tools/build_basemap.py <entrées> <sortie> --config <config>/bormes.json
```

| Fichier | Taille exacte (octets) | Remarque |
|---------|------------------------|----------|
| `bormes.meta.json` | 314 | emprise, 1030 × 885, fond 4096 × 3518 |
| `bormes.terrain.bin` | 1 823 100 | Int16, décimètres ; de −1 811,8 m à +597,6 m (tient dans un Int16) |
| `bormes.cover.bin` | 911 550 | 660 144 mer, 203 431 terre, 47 710 urbain, 265 digue |
| `bormes.coast.json` | 92 212 | 96 lignes, 4 427 points, 171 km de côte |
| `bormes.basemap.jpg` | 638 905 | 4096 × 3518, qualité 84 |
| `bormes.seamask.png` | 137 334 | |
| **Total** | **3 603 415** | Brest : 4 673 496 ; Toulon : 2 557 377 avec son instantané |

Durées : téléchargement 29 s, relief 12 s, fond de carte 21 s. Part de terre : 27,4 % (Brest 66 %). Il manque `bormes.wx-snapshot.json` (environ 90 ko à Toulon) : Open-Meteo a répondu 429 depuis l'adresse partagée de cet environnement en fin de session, et l'outil n'accepte que `brest` (§ Référence).

Contrôles sur le pack d'essai [VERIFIED: lecture de `terrain.bin` et `cover.bin`, et `Terrain` de `js/geo.js` chargé sous Node] : baie de Bormes (43,122° N, 6,386° E) en mer, fond −25,6 m ; devant Le Lavandou −19,8 m ; coffre 1 −32,0 m ; passe entre Bénat et Bagaud −61,9 m ; sud de Port-Cros −119 m ; passe des Grottes −18,1 m ; La Fourmigue : **une cellule de terre** (altitude 1 m) entourée d'eau ; îlot de la Gabinière, îlot du Cristau et rocher du Rascas en terre ; point culminant de l'emprise 597,6 m (43,1996° N, 6,3242° E, au bord nord).

Défaut constaté : **toute l'île du Levant est classée « urbain »** (couleur beige sur le fond de carte, perméabilité au vent × 0,75), parce qu'OpenStreetMap la décrit en `landuse=military` et que l'outil range ce type parmi les zones urbaines. Sans gravité pour le routage ; à corriger par une option de configuration (liste des types urbains) si l'on veut une île verte et un vent non freiné.

### 1.4 Reliefs qui comptent pour le vent

Altitude maximale lue sur le pack d'essai dans le rayon indiqué [VERIFIED: `bormes.terrain.bin`] :

| Relief | Altitude | Rôle |
|--------|----------|------|
| Massif du cap Bénat | 184 m dans 2,5 km (43,1031° N, 6,3489° E) ; 160 m à 400 m du phare | Ferme la baie au sud-ouest : dévent par ouest et sud-ouest |
| Crête au nord de Bormes | 441 m (43,1689° N, 6,3560° E) | Premier rang des Maures, à 4 km de la côte |
| Pierre d'Avenon | 461 m | Au-dessus du Lavandou |
| Crête au nord de Saint-Clair et d'Aiguebelle | 479 m | À 3 km de la côte |
| Crête au nord de Cavalière ; Biscarre | 460 m ; 471 m | À 2,5 à 3 km de la côte |
| Malatra et L'Eau Blanche (Pradels) | 520 m | Au nord du Rayol |
| Hauteurs de Cavalaire | 408 m | |
| Cap Nègre | 76 m | Pointe basse entre Cavalière et Pramousquier |
| Collines de Léoube | 163 m | Entre Brégançon et La Londe |
| Collines au nord de La Londe | 402 m, 598 m au bord nord | |
| Port-Cros | 189 m (194 et 199 m d'après les sommets d'OpenStreetMap) | Barre le sud de la passe |
| Bagaud | 52 m | |
| Levant | 128 m à l'ouest, 126 m au centre | Longue crête basse de 8 km |
| Porquerolles, cap des Mèdes | 124 m | Au bord ouest de l'emprise |
| Fort de Brégançon | 11 m | Îlot bas |

Comparaison : Faron 584 m et Coudon 702 m à Toulon, 60 à 130 m à Brest. Bormes est du type de Toulon : un mur de 450 à 520 m à 3 ou 4 km de la côte sur toute la largeur de l'emprise.

### 1.5 Fonds

70 % de l'eau de l'emprise a plus de 50 m de fond, 33 % plus de 200 m ; 1,6 % a moins de 2 m, 2,4 % moins de 5 m [VERIFIED: `terrain.bin` du pack d'essai ; l'outil impose au moins 0,8 m d'eau et lisse les fonds près du bord, donc ces chiffres ne servent pas à la navigation]. Avec 21 cm de marnage et des fonds francs, un fichier de fonds vrais comme `brest.fonds.bin` n'est pas nécessaire. Le tirant d'eau du Tofinou 9.5 (1,20 m quille relevée, 2,20 m quille basse, § 5.2) ne joue qu'au ras des côtes et sur les roches du § 2.7, que l'app ne connaît que comme des points.

## 2. Régates et repères

### 2.1 Clubs et épreuves

| Épreuve | Organisateur | Quand | Zone et parcours | Jauge | Confiance |
|---------|--------------|-------|------------------|-------|-----------|
| **Challenge de la Baie 2026-2027** (grade 5C) | Yacht Club du Lavandou, École de voile municipale du Lavandou, Club de voile de Bormes | 7 dates : 11 octobre et 8 novembre 2026 (Le Lavandou), 13 décembre, 17 janvier et 14 février 2027 (Bormes), 14 mars (Le Lavandou), finale 10 et 11 avril 2027 (Le Lavandou) ; briefing 10 h, premier signal 11 h | « une zone allant de la Londe à Cavalaire pouvant être prolongé jusqu'aux iles de Port Cros et du Levant » ; « parcours […] de types construits (banane : aller/retour) ou côtier » | Table OSIRIS ; groupe 3 : rating ≤ 22, groupe 4 : rating > 22 ; temps sur temps | HAUTE [VERIFIED: avis de course et fiches de course lus] |
| 6 Heures de Bormes | Club de voile de Bormes | Chaque été depuis 1977 ; 18 juillet 2026, juillet 2027 à venir | « La rade de Bormes, pour les petites unités » ; « Un parcours côtier, pour les voiliers habitables » | « Rating (temps compensé) » sur le bulletin | MOYENNE [VERIFIED: page et bulletin du club ; pas d'instructions de course en ligne] |
| Trophée des Îles 2027 | Yacht Club du Lavandou, École de voile municipale, International Yacht Club de Hyères | 5 et 6 juin 2027 | Départs alternés de Hyères et du Lavandou ; rade d'Hyères, autour de Port-Cros et de Porquerolles ; « parcours banane ou côtiers de plus de 20 milles nautiques » ; voiliers de plus de 8 m | Certificat OSIRIS | MOYENNE [VERIFIED: page de l'office de tourisme et page du club ; les trois PDF du club (avis, instructions, avenant) sont des pages vides de 8 ko : aucune observation sur leur contenu] |
| Voiles de Saint-Tropez (comparaison) | Société nautique de Saint-Tropez | Fin septembre, début octobre | Golfe de Saint-Tropez, hors emprise | « Trophée du meilleur Tofinou 9.5 et 9.7 » en 2024 ; liste des inscrits 2025 au 19 août : six Tofinou 9.5 (construits de 2006 à 2018) et deux Tofinou 9.7 | HAUTE pour ces faits [VERIFIED: communiqué 2024 et liste 2025 lus] |

- L'avis de course écrit « Dimanche 10 Octobre 2026 » pour la manche 1 ; la fiche de course, le site de la ville et le classement disent le 11 octobre, qui est bien le dimanche [VERIFIED].
- **Aucune épreuve de classe Tofinou n'a été trouvée à Bormes ni au Lavandou**, ni circuit Tofinou en Méditerranée hors des Voiles de Saint-Tropez. Les seuls rendez-vous de classe trouvés sont en Atlantique (Tofinou Atlantic Cup 2026 à Ars-en-Ré, pour les Tofinou 7) [CITED: résultats de recherche ; calendriers 2014 seulement pour le 9.5]. Un « Tofinou Trophy » n'a pas été retrouvé : aucune observation.
- Dans le Challenge de la Baie, un Tofinou 9.5 (rating OSIRIS 26,5, § 5.2) court dans le **groupe 4**. Le classement de la manche 1 (11 octobre 2026) montre 8 inscrits dans ce groupe, des croiseurs de 9 à 12 m (Sun Fast 3200, RM 890, First Class 10, Hanse 375, Dufour 382, Dehler 39…), un classement établi « après course 3 » le soir même, pas de Tofinou [VERIFIED: classement lu].
- Règles locales utiles aux consignes de l'espace : « Règles d'introduction à la régate » (RIR) et non les règles de course complètes ; pénalité d'un tour ; canal VHF 72 ; « La sortie du bout dehors est autorisée uniquement pour établir et porter le spinnaker » ; ancre rangée dans la baille au départ ; un bateau qui ne part pas dans les 4 minutes est classé DNS [VERIFIED: fiche de course et avis de course].

Documents téléchargés (dossier temporaire de cette étude, 15 PDF) : avis de course 2026-2027 (5 pages, du 5 octobre 2026, identique sur `yclavandou.com` et `le-lavandou.fr`), fiches de course des manches 1 et 2, annexe « Parcours 1 à 10 » (6 pages), RIR 2024-2028, classement de la manche 1, bulletin des 6 Heures 2026, trois PDF vides du Trophée des Îles, liste des inscrits 2025 et communiqué 2024 des Voiles de Saint-Tropez. Adresses dans les sources.

### 2.2 Catalogue de parcours du Challenge de la Baie

Annexe « Parcours » (document du 28 septembre 2024, toujours en ligne pour 2026-2027). Le comité affiche le numéro au signal d'avertissement ; suivi de « R », le parcours se court en sens inverse ; pavillon D : bouée de dégagement ; pavillon vert : dégagement à laisser à tribord [VERIFIED: annexe et fiche de course lues, croquis regardés].

| N° | Tracé | Longueur annoncée | Marques |
|----|-------|-------------------|---------|
| 1 | Départ – bouée de cap Nègre à tribord – La Fourmigue à tribord – arrivée | 7,8 M | 1 mouillée, 1 fixe |
| 2 | Départ – bouée de Bénat à bâbord – La Fourmigue à bâbord – arrivée | 6,2 M | 1 mouillée, 1 fixe |
| 3 | Départ – La Fourmigue à tribord – bouée orange à tribord – La Fourmigue à tribord – arrivée | 4 à 8 M | Aller et retour sur la Fourmigue |
| 4 | Banane : départ – bouée n° 1 (au vent) – bouée n° 2 – bouée n° 1 – arrivée | selon le vent | Construit au vent ; se fait avec la banane de la phase 6 |
| 5 | Vers le coffre 1 ; groupe « croisière » : coffre à bâbord, retour direct ; groupe « régate » : La Fourmigue à tribord à l'aller, coffre à bâbord, La Fourmigue à bâbord au retour | — | Coffre 1 : « N 43°05.113' E 006°16767' » (sic) |
| 6 | Départ – La Fourmigue à tribord – « Port-Cros (et sa cardinale) à tribord » – arrivée | 20 M | Tour de Port-Cros et de Bagaud |
| 7 | Départ – La Fourmigue à tribord – coffre 1 à tribord – La Fourmigue à bâbord – arrivée | 16,5 M | |
| 8 | Absent de l'annexe | — | — |
| 9 | Départ – « bouée Cavalaire » à tribord – La Fourmigue à tribord – arrivée | environ 20 M | Sur fond de carte marine |
| 10 | Départ – Port-Cros (et sa cardinale) à tribord – bouée orange à tribord – La Fourmigue à tribord – arrivée | — | |

Toutes les lignes : « entre bateau comité et bouée cylindrique orange » ; arrivée identique au départ. Recoupement des longueurs avec les positions relevées [VERIFIED: calcul] : feu du port du Lavandou → La Fourmigue 2,24 M au 142° ; feu du port de Bormes → La Fourmigue 2,01 M au 125° ; La Fourmigue → cap Nègre 2,66 M au 035° ; La Fourmigue → feu de Cavalaire 7,13 M au 056° ; Le Lavandou → Cavalaire 7,62 M ; cap Bénat → coffre 1 3,67 M au 267° ; La Fourmigue → pointe de Port-Man 5,55 M au 172°. Le parcours 9 fait 17 M par les feux des ports, « environ 20 M » annoncés : cohérent avec une bouée mouillée au fond de la baie de Cavalaire.

### 2.3 Marques fixes, marques mouillées, lignes

| Marque | Position | Type | Source et confiance |
|--------|----------|------|---------------------|
| **La Fourmigue** | 43°06,362' N 006°24,252' E | Balise de danger isolé sur un îlot ; feu Fl(2) 6 s (OpenStreetMap ; « Fl(2) 6s 8m 8M » lisible sur l'extrait de carte du parcours 9) | Arrêté 110/2023 et OpenStreetMap, identiques : HAUTE [VERIFIED] |
| **Coffre 1** | 43°05,113' N 006°16,767' E | Coffre d'amarrage en rade d'Hyères, au sud de Léoube | Annexe des parcours 5 et 7 : MOYENNE (une seule source, virgule oubliée dans le texte) |
| Bouée de cap Nègre | au sud du cap (43,1425° N, 6,4391° E), vers 43,137° N 6,447° E | Bouée mouillée par le comité | Croquis seulement : BASSE [ASSUMED] |
| Bouée de Bénat | devant le cap Bénat (phare 43,0885° N, 6,3629° E) | Bouée mouillée | Croquis : BASSE [ASSUMED] |
| Bouée Cavalaire | baie de Cavalaire, vers 43,17° N 6,55° E | Bouée mouillée | Croquis sur carte : BASSE [ASSUMED] |
| « Cardinale » de Port-Cros | La Dame, cardinale est (tourelle) 43°00,399' N 006°25,240' E, à 0,44 M au sud de la pointe de Port-Man | Seule cardinale relevée autour de Port-Cros | OpenStreetMap ; l'identification avec « sa cardinale » est une déduction : à confirmer au club [ASSUMED] |
| Marques de parcours et de ligne | — | « Bouées cylindriques orange siglées Yacht Club Lavandou » ; dégagement et changement de parcours : « Bouée cylindrique rouge siglée Le Lavandou » | Fiche de course [VERIFIED] |

Lignes : aucune position écrite. Deux positions de ligne à proposer dans le pack, à pinguer sur l'eau : « Devant Le Lavandou » (manches 1, 2, 6 et finale) vers 43,133° N 6,381° E et « Devant Bormes – La Favière » (manches 3 à 5) vers 43,123° N 6,376° E [ASSUMED : lues sur les croquis ; à 700 m à l'est du feu de chaque port].

Autres marques et feux relevés dans OpenStreetMap, utiles comme repères [VERIFIED pour la position ; ASSUMED pour l'exactitude des feux, à contrôler sur le livre des feux] : phare du cap Bénat 43°05,312' N 006°21,772' E (Fl R 5 s) ; feu du Lavandou 43°08,136' N 006°22,361' E ; feu de Bormes 43°07,526' N 006°22,012' E (Fl(2) R 6 s) ; cardinale ouest du Lavandou 43°08,146' N 006°22,232' E ; cardinale sud au sud du port de Bormes 43°07,200' N 006°21,818' E ; feu de Cavalaire 43°10,401' N 006°32,316' E (Fl(2) R 6 s) et cardinale nord 43°10,397' N 006°32,246' E ; phare du Titan (Levant) 43°02,793' N 006°30,614' E (Fl 5 s) ; tourelle de l'Esquillade 43°03,039' N 006°31,950' E ; bouée latérale de l'Ayguade (Levant) 43°00,914' N 006°25,948' E ; cardinale ouest de la Batterie des Maures 43°06,563' N 006°17,066' E. Positions officielles données par l'arrêté 110/2023 : cap de Brégançon 43°05,491' N 006°19,295' E ; pointe de Port-Man 43°00,835' N 006°25,251' E ; jetée extérieure du port de Bormes 43°07,376' N 006°22,011' E [VERIFIED: arrêté lu].

### 2.4 Lieux nommés (pour `PLACES` du pack)

Nœuds OpenStreetMap relevés dans l'emprise A [VERIFIED: extrait du 26/11/2026, ODbL] ; type selon la convention de `js/courses.js` (1 ville, 2 cap ou pointe, 3 sommet, 4 plan d'eau).

| Nom | Lat N | Lon E | Type |
|-----|-------|-------|------|
| Le Lavandou | 43,1384 | 6,3701 | 1 |
| Bormes-les-Mimosas (village) | 43,1507 | 6,3419 | 1 |
| La Londe-les-Maures | 43,1381 | 6,2355 | 1 |
| Rayol-Canadel-sur-Mer | 43,1591 | 6,4706 | 1 |
| Cavalaire-sur-Mer | 43,1723 | 6,5319 | 1 |
| Cap Bénat | 43,0895 | 6,3689 | 2 |
| Cap Blanc | 43,0865 | 6,3645 | 2 |
| Pointe du Cristau | 43,0913 | 6,3709 | 2 |
| Pointe du Pinet | 43,0988 | 6,3680 | 2 |
| Pointe de l'Esquillette | 43,1025 | 6,3691 | 2 |
| Pointe de la Ris | 43,1110 | 6,3642 | 2 |
| Cap de Brégançon | 43,0916 | 6,3216 | 2 |
| Pointe de la Galère (Brégançon) | 43,0897 | 6,3318 | 2 |
| Pointe du Diable | 43,0978 | 6,3240 | 2 |
| Pointe Pilon | 43,1370 | 6,3780 | 2 |
| Pointe de Nard Viou | 43,1392 | 6,3826 | 2 |
| Pointe de la Fossette | 43,1437 | 6,3965 | 2 |
| Pointe du Layet | 43,1471 | 6,4210 | 2 |
| Cap Nègre | 43,1425 | 6,4391 | 2 |
| Pointe du Souffre | 43,1492 | 6,4483 | 2 |
| Pointe de l'Écuelle | 43,1551 | 6,4561 | 2 |
| Pointe de Malpague | 43,1545 | 6,4716 | 2 |
| Pointe du Trésor | 43,1520 | 6,4866 | 2 |
| Pointe de la Chappe | 43,1513 | 6,4925 | 2 |
| Pointe du Dattier | 43,1562 | 6,5091 | 2 |
| Pointe de Vergeron | 43,1857 | 6,5779 | 2 |
| Cap des Mèdes (Porquerolles) | 43,0264 | 6,2424 | 2 |
| Pointe du Titan (Levant) | 43,0414 | 6,4922 | 2 |
| Île de Port-Cros | 43,0065 | 6,3948 | 2 |
| Île de Bagaud | 43,0113 | 6,3639 | 2 |
| Île du Levant | 43,0283 | 6,4718 | 2 |
| Îlot de la Gabinière | 42,9882 | 6,3952 | 2 |
| Îlot la Fourmigue | 43,1060 | 6,4043 | 2 |
| Pierre d'Avenon (443 m) | 43,1586 | 6,3698 | 3 |
| Biscarre (482 m) | 43,1743 | 6,4526 | 3 |
| Malatra (492 m) | 43,1816 | 6,5000 | 3 |
| L'Eau Blanche (527 m) | 43,1888 | 6,5002 | 3 |
| Fortin de la Vigie, Port-Cros (199 m) | 42,9991 | 6,4006 | 3 |
| Rade d'Hyères | 43,0915 | 6,2303 | 4 |
| Baie du Gau | 43,1064 | 6,3621 | 4 |
| Baie de l'Estagnol | 43,1082 | 6,2967 | 4 |
| Anse de Cavalière | 43,1455 | 6,4301 | 4 |
| Baie de Cavalaire | 43,1785 | 6,5716 | 4 |
| Rade de Port-Cros | 43,0086 | 6,3813 | 4 |
| Baie de Port-Man | 43,0102 | 6,4133 | 4 |
| Passe des Grottes | 43,0091 | 6,4250 | 4 |

Sans nœud nommé dans l'extrait : baie de Bormes, La Favière, Saint-Clair, Aiguebelle, Pramousquier, passe de Bagaud, Héliopolis ; à placer à la main à partir du fond de carte [ASSUMED]. « Sèche de Gouron », « Pointe de la Ris », « Anse du Gau », « Îlot du Cristau » se lisent sur l'extrait de carte marine du parcours 9 [CITED].

### 2.5 Zones interdites et réglementées

| Zone | Ce que disent les sources | Positions | Pour le routage |
|------|---------------------------|-----------|-----------------|
| **Île du Levant, partie militaire** | Zones 1, 2, 3, 4, 5 et 7 : « TOUTE L'ANNEE NAVIGATION INTERDITE MOUILLAGE INTERDIT BAIGNADE INTERDIT PLONGEE INTERDIT ». Zone 6 : « DU 1er SEPT au 30 JUIN NAVIGATION INTERDITE » et mouillage interdit toute l'année. Zones 8 (au nord, jusqu'à 43°07,7' N) et 9 (au sud) : mouillage interdit seulement. Répartition lue sur les flèches de la carte, à contrôler sur le texte de l'arrêté [CITED: carte « Île du Levant » de la direction interrégionale de la mer, avril 2021, annexe de l'arrêté du préfet maritime n° 55/2021 du 29 mars 2021] | Coordonnées reprises d'un projet d'arrêté de pêche de novembre 2024 qui recopie les zones de l'arrêté 55/2021 [CITED] : zone 1 = bande de 200 m autour de l'île par l'est, du point 1 (43°01,494' N 006°26,663' E, calanque du Tablier) au point 2 (43°00,205' N 006°26,262' E, pointe Maupertuis). Contour extérieur de l'ensemble : points 23 (43°03,224' N 006°30,614' E), 24 (43°03,512' ; 30,695'), 25 (43°03,296' ; 32,338'), 26 (43°02,499' ; 32,218'), 27 (43°02,520' ; 30,880'), 3 (43°02,682' ; 30,760'), 4 (43°02,116' ; 31,174'), 28 (43°02,219' ; 31,336'), 29 (43°01,898' ; 32,155'), 30 (43°01,209' ; 31,046'), 6 (43°01,321' ; 30,990'), 7 (42°59,618' ; 26,262'), puis le méridien 006°26,262' E jusqu'au point 2 | **À mettre dans `FORBIDDEN_ZONES`** : un polygone fermé par la bande de 200 m de la côte nord (à tracer sur `bormes.coast.json`, comme l'Île Longue à Brest). La zone 6 peut être gardée interdite toute l'année (tracé large). L'ouest de l'île (Héliopolis, port de l'Ayguade) et la passe des Grottes restent libres : la pointe de Port-Man est à 0,97 M de la pointe Maupertuis et à 1,22 M du point 1 |
| Fort de Brégançon | Arrêté du préfet maritime n° 192/2018 du 26 juillet 2018 « réglementant la navigation, le mouillage, la baignade et la plongée sous-marine aux abords du fort de Brégançon » ; l'arrêté 110/2023 cite « la limite de la zone interdite » entre 43°05,341' N 006°19,392' E et 43°05,569' N 006°19,625' E [CITED: arrêté 110/2023] | Texte de l'arrêté 192/2018 non trouvé : seuls ces deux points sont connus (aucune observation sur le reste) | **À compléter avant de publier** : zone à tracer sur la carte marine ; en attendant, zone large autour de l'îlot, notée « à compléter sur carte marine » |
| Parc national de Port-Cros, cœur marin (600 m autour de Port-Cros et de Bagaud) | « Coeur marin et limite des 600 m / Zone réservée aux bateaux propres / Vitesse limitée à 12 noeuds / Mouillage interdit aux navires de plus de 24 m » ; « Limite des 300 mètres / Vitesse limitée à 5 noeuds » ; « Réserve intégrale terrestre (interdiction de débarquer) » ; une légende « Circulation et mouillage interdits » pour de petites zones non localisées dans le texte extrait [CITED: dépliant « Réglementation marine » 2025 du parc] | Réserves intégrales dans OpenStreetMap : Bagaud, îlot de la Gabinière, rocher du Rascas [VERIFIED: relations et chemins lus] | La navigation à la voile n'est pas interdite : pas de polygone. À dire à l'équipage : 5 nd à moins de 300 m des côtes, pas de débarquement à Bagaud ; « bateaux propres » à faire préciser (un Tofinou 9.5 a-t-il une cuve ?). Zones temporaires possibles (un article d'avril 2026 annonce des zones interdites jusqu'au 1er juin 2026, dont une à l'est de la Gabinière ; article non ouvert) |
| Rade d'Hyères et abords du cap Bénat | Arrêté 110/2023 du 11 mai 2023 : mouillage des navires de plus de 12 m, dragage et chalutage interdits (câbles) dans une zone qui va de Brégançon à La Fourmigue, au Levant et à Port-Cros [VERIFIED: arrêté lu] | — | Sans effet sur un voilier en route |
| Bande des 300 m | Vitesse limitée à 5 nd, zones de baignade balisées l'été [CITED: arrêté 19/2018 visé par l'arrêté 110/2023 ; texte non lu] | — | À rappeler pour les départs près des plages |

Aucune de ces sources n'est la version en vigueur contrôlée au jour de l'étude : avant de publier, lire les arrêtés à jour de la préfecture maritime de la Méditerranée et tracer les polygones sur la carte marine (§ 6.6).

### 2.6 Dangers (pour `DANGERS`)

| Danger | Position | Note | Source |
|--------|----------|------|--------|
| La Fourmigue | 43°06,362' N 006°24,252' E | Îlot et roches au milieu de la baie, balise de danger isolé : c'est aussi la marque de presque tous les parcours, à ne pas serrer | [VERIFIED: arrêté 110/2023, OpenStreetMap] |
| Îlot du Cristau | 43,0911° N 6,3721° E | Îlot au ras de la pointe est du cap Bénat | [VERIFIED: OpenStreetMap] |
| La Dame | 43°00,399' N 006°25,240' E | Roche à l'est de Port-Cros, tourelle cardinale est : passer à l'est | [VERIFIED: OpenStreetMap] |
| Rocher du Rascas | 43,0144° N 6,3892° E | Îlot au nord de Port-Cros, réserve intégrale | [VERIFIED: OpenStreetMap] |
| Îlot de la Gabinière | 42,9882° N 6,3952° E | Îlot au sud de Port-Cros, réserve intégrale, plongeurs | [VERIFIED: OpenStreetMap] |
| L'Esquillade | 43°03,039' N 006°31,950' E | Tourelle de danger isolé à l'est du Levant, dans la zone 6 | [VERIFIED: OpenStreetMap] |
| Roches au sud du port de Bormes | 43°07,200' N 006°21,818' E | Cardinale sud sans nom dans OpenStreetMap | [VERIFIED pour la marque ; ASSUMED pour ce qu'elle garde] |
| Batterie des Maures, îlots de Léoube, de l'Estagnol et du Jardin | 43,1094° N 6,2845° E ; 43,105° N 6,299 à 6,305° E | Îlots et hauts-fonds entre Brégançon et Léoube, sur la route du coffre 1 | [VERIFIED: OpenStreetMap] |
| Sèche de Gouron | devant Bormes | Nom lu sur l'extrait de carte ; profondeur non relevée | [CITED: annexe du parcours 9] ; à lire sur la carte marine |

Hors emprise A, cités dans la demande : Le Grand Ribaud (feu à 43°00,990' N 006°08,643' E) et les Fourmigues de Giens, à l'ouest de Porquerolles ; ils ne concernent que l'emprise C étendue vers Giens.

## 3. Vents

### 3.1 Climatologie mesurée aux heures de course

Calcul de cette session sur les « Données climatologiques de base – horaires » de Météo-France pour le Var (Licence Ouverte 2.0), du 1er janvier 2010 au 26 novembre 2026, vent moyen sur 10 min à 10 m, heures de course de 11 h à 18 h locales (09 à 16 TU de mai à septembre, 10 à 17 TU d'octobre à avril) [VERIFIED: fichiers `H_83_2010-2019`, `H_83_previous-2020-2024`, `H_83_latest-2025-2026`]. Stations : Île du Levant `83069003` (43,0325° N, 6,4693° E, 118 m), Porquerolles `83069002` (43,0002° N, 6,2272° E, 143 m), Hyères `83069001` (43,1005° N, 6,1470° E, 2 m), Cap Camarat `83101001` (43,2005° N, 6,6745° E, 107 m). La station « Bormes-les-Mimosas » `83019002` (43,1952° N, 6,3793° E, 88 m) est dans une vallée des Maures (5 nd de moyenne, jamais plus de 20 nd) : elle ne dit rien de la baie et n'est pas utilisée. **Aucune station ouverte au bord de la baie.**

| | Levant, mai à septembre | Levant, octobre à avril | Porquerolles, mai à septembre | Hyères, mai à septembre | Cap Camarat, mai à septembre |
|---|---|---|---|---|---|
| Heures | 20 525 | 28 413 | 20 721 | 20 806 | 19 534 |
| Moyenne ; médiane | 11,1 ; 9,3 nd | 13,6 ; 11,1 nd | 12,1 ; 9,9 nd | 10,1 ; 9,1 nd | 10,2 ; 8,9 nd |
| Quartiles ; 90e centile ; maximum | 6,2 à 14,4 ; 21,2 ; 43 nd | 6,4 à 19,0 ; 27,0 ; 54 nd | 6,8 à 15,9 ; 23,1 ; 45 nd | 7,0 à 12,4 ; 16,3 ; 28 nd | 6,2 à 13,2 ; 17,3 ; 41 nd |
| Moins de 4 nd | 8 % | 10 % | 5 % | 3 % | 5 % |
| 4 à 7 nd | 24 % | 19 % | 22 % | 22 % | 28 % |
| 7 à 11 nd | 27 % | 21 % | 29 % | 40 % | 29 % |
| 11 à 17 nd | 22 % | 21 % | 21 % | 27 % | 27 % |
| 17 à 22 nd | 9 % | 11 % | 10 % | 7 % | 9 % |
| 22 à 28 nd | 6 % | 10 % | 8 % | 1 % | 2 % |
| 28 nd et plus | 3 % | 9 % | 4 % | 0 % | 0 % |
| Vent moyen de 25 nd et plus | 5,4 % | 13,3 % | 7,5 % | 0,1 % | 1,0 % |

Par secteur d'où vient le vent (fréquence, force moyenne), mai à septembre :

| Secteur | Levant | Porquerolles | Hyères | Cap Camarat |
|---------|--------|--------------|--------|-------------|
| Nord | 0 % (7 nd) | 1 % (8 nd) | 2 % (7 nd) | 3 % (8 nd) |
| Nord-est | 3 % (12 nd) | 9 % (15 nd) | 1 % (7 nd) | 15 % (9 nd) |
| Est | **31 %** (11 nd) | 16 % (11 nd) | 16 % (11 nd) | 16 % (10 nd) |
| Sud-est | 12 % (6 nd) | 13 % (7 nd) | 20 % (7 nd) | 12 % (6 nd) |
| Sud | 5 % (6 nd) | 8 % (7 nd) | 10 % (7 nd) | 18 % (8 nd) |
| Sud-ouest | 11 % (10 nd) | 25 % (10 nd) | **35 %** (11 nd) | **26 %** (14 nd) |
| Ouest | **35 %** (15 nd) | **27 %** (18 nd) | 12 % (15 nd) | 6 % (12 nd) |
| Nord-ouest | 2 % (12 nd) | 1 % (12 nd) | 5 % (12 nd) | 3 % (10 nd) |

D'octobre à avril au Levant : est 35 % (15 nd, un tiers à 17 nd et plus), ouest 33 % (17 nd, 45 % à 17 nd et plus), nord-est 7 %, sud-ouest 10 %, nord-ouest 5 %.

Lecture [VERIFIED: mêmes calculs] :

- **Deux régimes se partagent le plan d'eau : l'ouest et l'est.** Le nord et le nord-ouest sont rares sur l'eau (2 à 6 % au Levant).
- **Le vent fort vient de l'ouest.** Au Levant, les heures de course à 17 nd et plus viennent à 69 % du 240° au 280° de mai à septembre (21 % du 250°, 24 % du 260°, 12 % du 270°), direction médiane 260° ; à Porquerolles 250° et 260° font 55 %. C'est le mistral, tourné à l'ouest le long de la côte varoise. Ouest fort (17 nd et plus) : 14 % des heures de course de mai à septembre, 17 % d'octobre à avril.
- **L'est fort est une affaire d'hiver** : 4 % des heures de course de mai à septembre, 12 % d'octobre à avril, du 070° au 080° au Levant, du 060° à Porquerolles.
- Par mois au Levant, part des heures de course à 17 nd et plus : janvier 32 %, février 27 %, mars 34 %, avril 26 %, mai 21 %, juin 17 %, juillet 17 %, août 14 %, septembre 21 %, octobre 26 %, novembre 33 %, décembre 32 %. Part à moins de 7 nd : de 23 % (mars) à 38 % (août). Le Challenge de la Baie se court donc dans la saison ventée : une heure de course sur cinq à 22 nd et plus de novembre à mars.
- La plage de 25 nd de l'app est dépassée en vent moyen 5 % du temps l'été et 13 % l'hiver au Levant ; la rafale de l'heure atteint 34 nd dans 9 % des heures de course l'été et 19 % l'hiver. Les stations sont à 118 et 143 m sur des îles : le vent au ras de l'eau dans la baie est plus faible [ASSUMED pour l'écart].
- Rafales : rapport de la rafale de l'heure au vent moyen (vent de plus de 6 nd), médiane 1,52 au Levant, 1,55 à Porquerolles, 1,67 à Hyères, 1,57 à Camarat ; 90e centile 1,9 à 2,4.

### 3.2 Brise thermique (mesurée, mai à septembre)

Journées « de brise » : moins de 6 nd en moyenne de 08 à 10 h locales, au moins 3 nd de plus de 15 à 18 h, jamais 16 nd [VERIFIED: même jeu de données ; le critère ne regarde pas l'ensoleillement].

| | Hyères (2 m) | Levant (118 m) | Cap Camarat (107 m) | Porquerolles (143 m) |
|---|---|---|---|---|
| Journées de brise | 1 372 sur 2 596 (**53 %**) | 374 sur 2 540 (15 %) | 420 sur 2 399 (18 %) | 489 sur 2 585 (19 %) |
| 10 h locales | 4,3 nd ; est 28 %, sud-est 24 % | 3,7 nd ; est 32 %, ouest 32 % | 4,2 nd ; nord-est 39 % | 3,5 nd |
| 12 h | 8,0 nd ; sud-est 38 %, sud-ouest 26 % | 5,3 nd ; ouest 28 %, sud-est 26 % | 6,2 nd ; sud-est 28 %, sud 25 % | 6,2 nd ; sud-est 27 %, sud-ouest 27 % |
| 14 h | 9,2 nd ; sud-ouest 42 %, sud-est 25 % | 7,2 nd ; ouest 25 %, sud-ouest 22 %, sud 21 % | 8,4 nd ; sud 47 % | 8,1 nd ; sud-ouest 46 % |
| 16 h | 9,6 nd ; sud-ouest 53 % | 9,0 nd ; ouest 40 %, sud-ouest 36 % | 10,5 nd ; sud-ouest 43 %, sud 42 % | 9,4 nd ; sud-ouest 63 % |
| 18 h | 8,7 nd ; sud-ouest 55 % | 9,5 nd ; ouest 56 % | 10,6 nd ; sud-ouest 60 % | 9,3 nd ; sud-ouest 59 % |
| Rotation de 14 h à 18 h | médiane +10° ; à droite de plus de 10° : 43 %, à gauche : 10 % | +25° ; 57 % ; 16 % | +20° ; 58 % ; 11 % | +20° ; 60 % ; 8 % |

- La brise s'installe vers midi par le sud-est, passe au sud puis au sud-ouest (à l'ouest au Levant) et culmine entre 16 h et 18 h à 9 à 11 nd. **Elle tourne à droite** : le conseil de Toulon (« tourne en général progressivement vers la droite ») se transpose, celui de Brest non.
- Le matin, vent de terre faible de nord à nord-ouest à Hyères et à Camarat (2,8 et 3,9 nd à 8 h).
- Cycle moyen de tous les jours de mai à septembre à Hyères : 4,1 nd à 8 h, 9,3 nd à midi, 11,0 nd à 16 h, 7,6 nd à 20 h ; au Levant le cycle est plat (9,1 nd à 8 h, 11,5 nd à 16 h) : la station d'altitude sent moins la brise.
- Dans la baie elle-même, aucune mesure : la côte regarde l'est et le sud-est, la brise y entre probablement par le sud-est avant de tourner [ASSUMED].

### 3.3 Les stations entre elles

Aux mêmes heures de course, quand le Levant a au moins 8 nd [VERIFIED: même calcul ; directions arrondies à 10° dans les fichiers] :

| Vent au Levant | Porquerolles (mai à sept.) | Hyères (mai à sept. ; oct. à avril) | Cap Camarat (mai à sept. ; oct. à avril) |
|----------------|-----------------------------|--------------------------------------|-------------------------------------------|
| Ouest (5 336 h l'été) | × 1,06 ; 10° à gauche | × 0,82 ; × 0,62 | **× 0,73, 30° à gauche ; × 0,58** |
| Est (4 150 h) | × 0,99 ; 10° à gauche | × 0,76, 30° à droite ; × 0,62 | × 0,72 ; × 0,89 |
| Sud-ouest (1 420 h) | × 1,03 | × 0,97 ; × 0,80 | × 1,32 ; × 1,12 |
| Nord-est (373 h) | × 1,02 | × 0,64 ; × 0,50 | × 0,96 ; × 1,03 |

- Le vent d'ouest s'affaiblit vers l'est le long des Maures : Camarat ne reçoit que 58 à 73 % du vent du Levant, tourné au sud-ouest. Le vent fort à Camarat l'été vient du 210° au 240°. La côte de Cavalière à Cavalaire est donc sous le vent du massif par mistral.
- La rade d'Hyères (station au ras de l'eau) reçoit 62 à 82 % du vent d'ouest ou d'est mesuré sur les îles.

### 3.4 Le modèle de vent de l'app sur le pack d'essai

`WindField` de `js/wind.js`, lu tel quel et exécuté sous Node sur le pack d'essai, vent de base uniforme (un seul point, donc effet de contournement entier) [VERIFIED: sorties de cette session]. Force au point, rapportée au vent de base :

| Vent de base | Anse du Gau (sous Bénat) | Devant Bormes | Devant Le Lavandou | Milieu de la baie | La Fourmigue | 2 M à l'est de la Fourmigue | Cavalière | Baie de Cavalaire | Sud-est du cap Bénat | Coffre 1 | Passe Bénat – Bagaud |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ouest 260°, 18 nd | 0,60 | 0,77 | 0,85 | 0,84 | 0,86 | 1,02 | 0,90 | 0,59 | 1,05 | 0,93 | 1,05 |
| Ouest 280°, 18 nd | 0,66 | 0,80 | 0,95 | 0,88 | 0,88 | 0,96 | 0,75 | 0,46 | 1,02 | 1,07 | 1,06 |
| Nord-ouest 310°, 15 nd | 0,68 | 0,74 | 0,68 | 0,75 | 0,81 | 0,78 | 0,48 | 0,57 | 0,72 | 1,18 | 1,00 |
| Est 075°, 14 nd | 0,69 | 0,82 | 0,90 | 0,92 | 0,94 | 1,02 | 0,88 | 0,71 | 1,05 | 0,85 | 1,04 |
| Nord-est 050°, 14 nd | 0,62 | 0,61 | 0,66 | 0,80 | 0,88 | 0,97 | 0,67 | 0,94 | 0,96 | 0,69 | 0,94 |
| Sud-est 130°, 8 nd | 0,72 | 0,81 | 0,77 | 0,80 | 0,81 | 0,77 | 0,56 | 0,67 | 0,78 | 1,18 | 0,99 |
| Sud 180°, 8 nd | 0,58 | 0,44 | 0,43 | 0,51 | 0,61 | 0,68 | 0,45 | 1,16 | 0,67 | 0,90 | 0,80 |
| Sud-ouest 225°, 10 nd | 0,54 | 0,55 | 0,62 | 0,69 | 0,85 | 0,95 | 0,74 | 1,04 | 0,94 | 0,72 | 0,93 |

Indice de dévent (la perte appliquée vaut la moitié) au milieu de la baie : 0,25 par ouest 260° (massif de Bénat), 0,24 par sud-ouest, 0,18 par nord-ouest, 0 par est et sud-est ; 0,50 par nord franc à un point voisin (43,122° N, 6,386° E). Déviation au milieu de la baie : nulle par ouest 260°, 11° à gauche par 280°, 22° à gauche par nord-ouest et par sud-est, 15° à droite par sud-ouest.

Ce que le modèle dit de plausible, recoupé par les mesures : par ouest la baie est abritée par le massif de Bénat (15 à 25 % de vent en moins, 40 % dans l'anse du Gau), le vent plein se retrouve au sud du cap et à 2 milles à l'est de La Fourmigue ; la baie de Cavalaire est très abritée (0,46 à 0,59 ; mesuré à Camarat : 0,58 à 0,73) ; par est la baie est ouverte (0,92 à 0,94), la rade d'Hyères à l'ouest de Bénat est abritée (0,81 à 0,85 ; mesuré à Hyères : 0,62 à 0,76).

Ce qui est douteux, à ne pas présenter comme établi :

- **Vents de sud à sud-est** : le modèle retire 20 à 55 % dans la baie parce que l'écoulement « bute » sur le mur des Maures, qui barre tout le nord de l'emprise sans passage bas (contournement 0,55, plus le blocage). Pour une brise de mer qui entre dans la baie, c'est probablement trop [ASSUMED]. Avec des prévisions en plusieurs points l'effet de contournement est multiplié par 0,6 (§ Référence), ce qui l'atténue sans le supprimer.
- **Passes étroites** : passe de Bagaud 0,62 à 0,67 et passe des Grottes 0,47 à 0,54 par ouest ou par est. À 150 m de maille, le modèle voit ces passes comme des obstacles ; une canalisation est aussi vraisemblable qu'un dévent [ASSUMED].
- **Nord franc** : 0,40 dans la baie. Sans conséquence pratique : 0 à 1 % des heures de course.

### 3.5 Adaptations de `js/wind.js` et réglages du pack

1. **Seuil « mer dégagée »** : garder la valeur par défaut. Sur le pack d'essai, 26 422 cellules en mer sur 36 462 (72 %), dont 11 861 à plus de 4 000 m d'une terre (45 % de l'eau), distance maximale 16,65 km ; à 1 500 m ce serait 79 % de l'eau, sans intérêt. Médiane de l'eau du facteur de vent : 0,91 à 0,98 selon la direction [VERIFIED]. `wind: {}` suffit, comme à Toulon.
2. **Maille** : 150 m par défaut, 36 462 cellules. Coût mesuré sous Node sur la même machine : 184 ms par direction, contre 129 ms à Toulon et 154 ms à Brest (× 1,43 Toulon) [VERIFIED]. À confirmer sur téléphone avec `tools/measure-boot.mjs` ; repli : `cell: 180` (172 × 147 = 25 284 cellules).
3. **Formules** : inchangées. Les deux doutes du § 3.4 se traitent par des conseils marqués « à confirmer », pas par un réglage inventé.
4. **Origine** `{ lat: 43.10, lon: 6.40 }` ; `windRef` au milieu de la baie (43,120° N, 6,392° E) ; cadrage 3D sur la baie.

### 3.6 Proposition de `REGIMES` pour Bormes

Même forme qu'à Brest : `{ id, name, test, tips: [{ t, o }] }`, origine de chaque conseil : (D) mesure Météo-France 2010-2026, (M) modèle de relief de l'app sur le pack d'essai, (S) source citée, (H) hypothèse à confirmer sur l'eau. Les conseils (H) s'affichent « à confirmer sur l'eau » (mécanisme existant, `tipText` de `js/tactics.js`). Tests exclusifs.

| `id` | Nom | Test (direction d'où vient le vent, force) | Conseils proposés |
|------|-----|--------------------------------------------|-------------------|
| `calme` | Calme / très petit temps | `s < 4` | Une journée sur deux de mai à septembre est une journée de brise en rade d'Hyères : elle s'installe vers midi par le sud-est et culmine à 9 à 11 nd entre 16 h et 18 h (D). Elle tourne à droite, vers le sud-ouest : 10 à 25° en médiane entre 14 h et 18 h selon la station (D). Le matin, vent de terre faible de nord à nord-ouest (D). Le nouveau vent arrive par le large : rester au large de la baie plutôt qu'au pied des Maures (H). |
| `mistral` | Mistral (ouest) | `d >= 235 && d < 300 && s >= 14` | Ici le mistral vient de l'ouest, 260° en médiane, pas du nord-ouest (D). 14 % des heures de course l'été, 17 % l'hiver à 17 nd et plus ; rafales à 1,5 fois le vent moyen, souvent 34 nd l'hiver (D). Le massif du cap Bénat abrite la baie : 15 à 25 % de vent en moins devant Bormes et au milieu, 40 % dans l'anse du Gau ; vent plein au sud du cap et à 2 milles à l'est de La Fourmigue (M). Il mollit vers l'est : Cavalaire reçoit environ 60 à 70 % du vent des îles, tourné au sud-ouest (D, M). Rafales qui tombent du relief, mer plate sous Bénat (H). |
| `ouest` | Ouest modéré | `d >= 235 && d < 300` (reste : moins de 14 nd) | Même abri du cap Bénat : plus de pression au large de la baie et vers La Fourmigue (M). C'est aussi la direction de la brise de fin d'après-midi au Levant (D). Vent irrégulier près de la côte de Bormes (H). |
| `nord` | Nord-ouest à nord (vent de terre) | `d >= 300 \|\| d < 30` | Rare sur l'eau : 2 à 6 % des heures de course (D). Les crêtes des Maures (450 à 520 m à 3 km) déventent toute la côte de Saint-Clair au Rayol : la moitié du vent en moins au ras de la côte, plus de vent au large (M). Vent du petit matin avant la brise (D). Rafales et rotations (H). |
| `est` | Est | `d >= 30 && d < 110` | Second régime du plan d'eau : 31 % des heures de course l'été, 35 % l'hiver, 070° à 080° quand il est fort (D). La baie lui est ouverte : vent presque plein au milieu et à La Fourmigue, 18 % de moins devant Bormes, 30 % dans l'anse du Gau (M). L'ouest du cap Bénat (Brégançon, coffre 1) est abrité : 15 à 20 % de moins (M ; mesuré à Hyères : 24 à 38 % de moins, D). Fort surtout d'octobre à avril (un tiers des heures d'est à 17 nd et plus) (D). La mer entre dans la baie (H). |
| `sudest` | Sud-est (brise de midi) | `d >= 110 && d < 160` | Direction de la brise à son arrivée, vers midi ; faible : 6 à 7 nd en moyenne (D). Elle tourne à droite dans l'après-midi (D). Le modèle annonce 20 % de vent en moins dans la baie et 20° de rotation à gauche : valeur incertaine pour une brise de mer (M, à confirmer). |
| `sud` | Sud | `d >= 160 && d < 200` | Passage entre la brise de sud-est et celle de sud-ouest ; fréquent l'après-midi à Camarat (18 %), rare au Levant (5 %) (D). Le modèle retire jusqu'à la moitié du vent au fond de la baie : probablement trop (M, à confirmer). |
| `suroit` | Sud-ouest (brise de l'après-midi) | `() => true` (reste : 200 à 235) | Brise établie de l'après-midi : 35 % des heures de course l'été à Hyères, 9 à 11 nd vers 16 h (D). La baie est sous le vent du massif de Bénat : 30 à 45 % de vent en moins devant Bormes et Le Lavandou, 15 % à La Fourmigue, vent normal 2 milles plus à l'est : aller chercher la pression au large (M). À l'est du cap Nègre le sud-ouest est plus fort (Camarat : 14 nd en moyenne, un quart des heures à 17 nd et plus) (D). |

Vents prédéfinis proposés (forme de `PRESETS`) : `['Mistral fort', 260, 24, 34]`, `['Mistral modéré', 265, 16, 23]`, `['Est', 75, 12, 17]`, `['Est fort', 70, 22, 30]`, `['Brise de sud-est', 130, 7, 9]`, `['Brise de sud-ouest', 220, 10, 13]`, `['Vent de terre', 330, 5, 8]`, `['Petit temps', 110, 4, 6]` — directions et forces tirées des mesures, rafales [ASSUMED].

Textes du lieu (forme de `texts`) : `centre` « milieu de la baie de Bormes » ; `relief` « mur des Maures (450 à 520 m) à 3 km au nord, massif du cap Bénat (184 m) au sud-ouest, Port-Cros (190 m) et le Levant au sud » ; `origine` identique à Brest.

### 3.7 Météo : modèles et mesures en direct

- **Modèles** : au point 43,115° N 6,39° E avec `cell_selection=sea` (rendu 43,12° N 6,39° E, altitude 0), neuf modèles répondent sur 48 h, dont les six de l'app (`meteofrance_arome_france_hd`, `meteofrance_arome_france`, `meteofrance_arpege_europe`, `ecmwf_ifs025`, `icon_eu`, `gfs_seamless`) et `italia_meteo_arpae_icon_2i`, `knmi_harmonie_arome_europe`, `ukmo_global_deterministic_10km` ; `icon_d2` ne rend rien [VERIFIED: réponse d'Open-Meteo du 26/11/2026]. Le jour de l'essai (mistral), à 14 h : 15 à 16 nd du 284° pour AROME, 24 nd du 281° pour le modèle européen, 20 nd du 298° pour le modèle américain. Le modèle italien à 2 km est un candidat pour le consensus, absent de la liste de Toulon.
- **Grille** : 20 points, latitudes 43,02 ; 43,06 ; 43,10 ; 43,14 et longitudes 6,30 ; 6,36 ; 6,42 ; 6,48 ; 6,54 ; centre 43,115° N 6,39° E ; `cellSelection: 'sea'` (plusieurs points tombent à terre, la côte est haute) [ASSUMED pour le choix : la comparaison terre / mer n'a pas pu être faite, Open-Meteo ayant répondu 429 en fin de session].
- **Balises ouvertes** : aucune dans la baie. Sur 749 balises Pioupiou, deux dans les environs : La Capte, à Hyères (43,0652° N, 6,1498° E), et une balise à terre à 43,255° N 6,577° E [VERIFIED: réponse du 26/11/2026]. `live: null`, comme à Brest. Le club de Bormes renvoie à un service de balises sur abonnement [CITED: page « Webcam et météo » du club].
- **Stations Météo-France** (jeton, donc fonction relais) : Île du Levant, Porquerolles, Hyères, Cap Camarat ; le Levant est la plus proche (5 milles au sud-est de La Fourmigue), en altitude. **METAR** de Hyères `LFTH` (43,094° N, 6,146° E) : répond sans clé, sans en-tête d'accès inter-domaines, donc par relais aussi [VERIFIED].
- **Point marin** : le point 43,115° N 6,39° E est ramené à 43,125° N 6,375° E et rend vagues, courant et niveau [VERIFIED]. À garder (contrairement à Brest), avec un texte propre : la carte « État de la mer » écrit aujourd'hui en dur « large de Cépet » et « faible en rade » (`js/app.js:894`).
- Liens neutres : bulletin côtier de Météo-France, Windy centré sur la baie.

## 4. Courants et niveau

### 4.1 Marée : négligeable, vérifié

Hauteurs horaires validées du marégraphe de Toulon (Shom – REFMAR, station 68), neuf mois de 2023 à 2025 (janvier, juillet, octobre ; les fichiers d'avril sont vides), 6 696 heures [VERIFIED: service `services.data.shom.fr/maregraphie`, ajustement par moindres carrés de cette session] :

| Mesure | Toulon | Port-Cros (station 5154, données brutes, 784 heures de mai et juillet 2025) |
|--------|--------|--------|
| Constituants (amplitude) | M2 6,7 cm ; S2 2,7 ; K1 3,8 ; O1 2,1 ; N2 1,4 | M2 6,8 cm ; S2 2,8 ; K1 3,7 ; O1 1,8 |
| Marnage observé par jour | médiane **21 cm**, 90e centile 28 cm, maximum 37 cm | — |
| Marée seule | de −15 à +16 cm | de −14 à +15 cm |
| Niveau moyen mensuel | de 0,45 à 0,61 m selon le mois | — |

La marée de Port-Cros est celle de Toulon. La météo (pression, vent) déplace le niveau autant que la marée : 16 cm d'un mois à l'autre. Références Altimétriques Maritimes du Shom [VERIFIED: service WFS, couche `RAM_BDD_WLD_WGS84G_WFS:ram_3857`] : fort de Brégançon, plus haute mer astronomique 0,69 m, niveau moyen 0,44 m, plus basse mer astronomique 0,19 m ; port de l'Avis (Levant) 0,64 ; 0,43 ; 0,18 ; Cavalaire 0,55 ; 0,32 ; 0,09 ; Toulon 0,64 ; 0,42 ; 0,17. Soit 0,46 à 0,50 m entre les extrêmes astronomiques, et aucun niveau de vive-eau ou de morte-eau défini. Brest : 5,90 m en vive-eau moyenne. **Ni module de marée, ni fichier de fonds, ni courant de marée.**

### 4.2 Courant général : faible dans la baie, sensible entre les îles

Seule source chiffrée accessible : le modèle de courant de surface servi par Open-Meteo (« MeteoFrance SMOC », maille de 8 km d'après sa documentation, déjà lue pour Brest), 2 280 heures du 26 août au 28 novembre 2026 [VERIFIED: réponse de l'API ; les points demandés sont ramenés au centre des mailles] :

| Point rendu | Médiane | 90e centile | Maximum | Plus de 0,5 nd | Porte vers |
|-------------|---------|-------------|---------|----------------|------------|
| Baie de Bormes (43,125° N, 6,375° E) | **0,22 nd** | 0,32 | 0,65 | 1 % | sud-ouest, ouest |
| Large de Cavalière (43,125° N, 6,458° E) | 0,22 nd | 0,38 | 0,76 | 4 % | sud-ouest, ouest |
| Entre Bénat et Port-Cros (43,042° N, 6,375° E) | **0,59 nd** | 0,97 | 1,73 | 63 % | ouest 59 % |
| Entre Port-Cros et Porquerolles (43,042° N, 6,292° E) | 0,54 nd | 0,97 | 1,78 | 51 % | ouest 65 % |
| Nord du Levant (43,042° N, 6,458° E) | 0,76 nd | 1,03 | 1,84 | 76 % | ouest, sud-ouest |
| Sud de Port-Cros (42,958° N, 6,375° E) | **0,86 nd** | 1,24 | 2,00 | 90 % | ouest 61 % |
| Sud du Levant (42,875° N, 6,458° E) | 0,70 nd | 1,08 | 1,67 | 79 % | ouest, sud-ouest |

- C'est le courant liguro-provençal (« Courant Nord »), qui « suit les côtes de Nord Est en Sud Ouest depuis le Golfe Ligure » [CITED: résumé d'une étude du parc national de Port-Cros, Taupier-Letage et al., 2013 ; l'étude elle-même n'a pas pu être ouverte, deux serveurs ayant refusé : aucune observation sur ses chiffres].
- À 8 km de maille, les passes (Bagaud, Grottes, entre Bénat et les îles) ne sont pas résolues : le chiffre est celui d'une maille large, pas d'une passe. Fidélité au réel non mesurée [ASSUMED]. La période couvre la fin de l'été et l'automne seulement.
- Aucun atlas de courant du Shom n'existe ici (ce sont des atlas de marée).

### 4.3 Faut-il un modèle ? Non

| Usage | Courant attendu | Effet sur un Tofinou 9.5 (5,5 à 6,5 nd) | Décision |
|-------|-----------------|------------------------------------------|----------|
| Bananes et parcours 1 à 4 dans la baie (l'essentiel) | 0,2 nd, 0,65 nd au pire | 3 à 4 % sur un bord dans l'axe, 2° de dérive : sous l'incertitude de la polaire | **Ignorer, comme à Toulon** |
| Côtiers vers le coffre 1 et Cavalaire (parcours 5, 7, 9) | 0,2 à 0,6 nd vers l'ouest | Jusqu'à 10 % sur les bords est-ouest | Information à l'écran |
| Tour de Port-Cros (parcours 6 et 10, 20 M) | 0,6 à 0,9 nd vers l'ouest au sud de l'île | Un bord de 6 milles à 6 nd : 60 min sans courant, 68 min contre 0,7 nd, 54 min avec | Information à l'écran ; conseil « le courant porte en général à l'ouest au sud des îles » marqué à confirmer |

Justification : pas de donnée fine à embarquer (contrairement à l'atlas à 100 m de Brest), un courant qui dépend du vent des jours précédents et non de l'heure, et un seul type de parcours vraiment concerné. Embarquer la maille de 8 km donnerait une fausse précision. **`maree` et `courant` absents du descripteur**, donc `route()` garde son chemin sans courant (motif 1 de l'étude de Brest).

Souhaitable, plus tard et seulement si l'équipage court les côtiers : passer à `route()` un courant uniforme tiré du point marin de la prévision (l'option `current` existe depuis la phase 7 : `opts.current(x, y, ms) → { u, v }`), avec l'heure de validité affichée. À ne faire qu'après une mesure de dérive sur l'eau.

## 5. Polaire du Tofinou 9.5

### 5.1 Ce qui existe

| Source | Contenu | Accès, licence | Verdict |
|--------|---------|----------------|---------|
| **Certificat ORC Club 2026, « TOFINOU 950 »** : numéro de voile ESP-881_C, référence `03510004F1O`, émis le 26 février 2026, constructeur « LATITUDE 46 », architecte « JOUBERT Michel », année 2004 | Vitesses prévues (temps au mille) pour 4, 6, 8, 10, 12, 14, 16, 20 et 24 nd de vent : près et portant optimaux (angle et VMG), allures à 52, 60, 75, 90, 110, 120, 135 et 150° | Liste publique des certificats (`data.orc.org/public/WPub.dll?action=DownRMS&CountryId=ESP&ext=json`), sans clé. Aucune licence ouverte ni condition de réutilisation trouvée sur les pages lues : document public d'une autorité de jauge, pas une donnée ouverte [ASSUMED pour le droit de réutilisation ; même situation que la polaire du J80 déjà dans l'app, tirée d'un certificat ORC] | **Retenu** : seule polaire chiffrée du bateau [VERIFIED: fichier téléchargé et lu] |
| Autres certificats ORC | 38 listes nationales, 8 307 certificats en cours relus : **un seul Tofinou 9.5** ; un Tofinou 9.7 français (FRA-45815, ORC Club 2026), trois Tofinou 12 | idem | Le 9.7 sert de point de comparaison (§ 5.3) [VERIFIED] |
| Fiche OSIRIS de la FFVoile, « TOFINOU 9,5 M » | Table 109, révision 131, groupe R3, **rating brut 26,5**, coefficient de vent léger 2,4, dimensions standard de la série | Table publique de la fédération (formulaire en ligne) | Retenu pour les caractéristiques ; ne donne pas de polaire [VERIFIED: fiche lue] |
| Chantier | Le site du constructeur ne présente plus le 9.5 (modèles affichés : 7, 8, 7.9, 9.7, 12, 16) ; aucune polaire ni VPP publié trouvé | — | Rien d'exploitable [VERIFIED pour l'absence sur les pages lues] |
| Catalogue et bases de modèles | Longueur 9,50 m, bau 2,45 m, lest plomb 800 kg, tirant d'eau 1,20 / 2,20 m, grand-voile 26,5 m², foc 14,5 m² ; déplacement 4 850 lb (2 200 kg) | Sites de tiers ; deux pages ont refusé l'accès | Recoupement seulement [CITED: résumés de recherche et une base de modèles lue] |

### 5.2 Le bateau : série et sister-ship du certificat

| | Fiche OSIRIS (série) | Certificat ORC (ESP-881) | Tofinou 9.7 (certificat FRA-45815, comparaison) |
|---|---|---|---|
| Longueur hors tout | 9,47 m | 9,5 m | 9,143 m |
| Flottaison | 8,62 m | 8,614 m (longueur de jauge) | 8,578 m |
| Bau | 2,45 m | 2,454 m | 3,004 m |
| Tirant d'eau | 1,20 / 2,20 m | 2,229 m | 2,006 m |
| Déplacement | 2 350 kg lège ; lest en plomb | 2 623 kg en mesure, 3 114 kg en navigation, équipage 320 kg | 2 500 kg ; 3 212 kg ; 527 kg |
| Gréement | 9/10, un étage de barres de flèche, pas de bastaques ; P 11,40 m, E 3,80 m, IG 10,40 m, J 3,49 m | — | — |
| Grand-voile | 27,4 m² (calcul sur les largeurs de la fiche) | 26,94 m² | 27,04 m² |
| Voile d'avant | guindant 10,40 m, perpendiculaire 3,08 m : **16,0 m²** (foc qui ne recouvre pas : 88 % de J) | **26,38 m²** (génois, environ 145 % de J) | 18 m² |
| Spi asymétrique | guindant 12,75 m, chute 10,42 m, bordure 7,10 m, mi-hauteur 7,30 m : 70 m² | 69,43 m² | 75,93 m² |
| Remarque de la fiche | « Bome alu/mat carb/gennaker 1115/1030/350/670 inclus » | — | — |

[VERIFIED: fiche OSIRIS et certificats lus ; surfaces de la fiche calculées avec les formules de jauge usuelles]

Pour `08-RESEARCH.md` (ESP-04) : **longueur de coque 9,47 m** (trois longueurs = 28,4 m, deux longueurs = 18,9 m ; les six Tofinou 9.5 inscrits aux Voiles de Saint-Tropez 2025 sont donnés entre 9,47 et 9,50 m) ; **tirant d'eau 2,20 m quille basse, 1,20 m quille relevée** ; rating OSIRIS 26,5 contre 21,5 pour le J80 [VERIFIED: table OSIRIS].

### 5.3 La polaire tirée du certificat

Méthode : celle de `tools/build_polar.mjs`, appliquée aux temps au mille du certificat (vitesse = 3600 / temps) ; mêmes angles de table ; **aucune extrapolation**, le certificat couvre déjà 4 et 24 nd. Essai fait dans un dossier temporaire [VERIFIED: fichier produit, relu par `parsePolar` et `setPolar`, cibles calculées par `optimalAngles`] :

```text
TWA\TWS	4	6	8	10	12	14	16	20	24
30	1.08	1.45	2.02	2.93	3.36	3.53	3.57	3.62	3.16
34	1.08	2.35	3.49	4.49	4.96	5.15	5.22	5.28	4.83
36	1.45	2.97	4.22	5.27	5.76	5.97	6.04	6.12	5.66
38	1.92	3.6	4.96	6.02	6.21	6.31	6.39	6.47	6.42
40	2.39	4.23	5.66	6.12	6.3	6.4	6.48	6.56	6.52
42	2.86	4.83	5.77	6.22	6.39	6.49	6.57	6.65	6.62
44	3.33	4.94	5.88	6.32	6.49	6.59	6.66	6.74	6.71
47	3.71	5.11	6.04	6.46	6.63	6.72	6.8	6.87	6.86
52	3.96	5.39	6.31	6.71	6.86	6.95	7.02	7.1	7.1
60	4.23	5.64	6.5	6.87	7.05	7.15	7.23	7.33	7.36
75	4.41	5.81	6.61	7.02	7.28	7.44	7.57	7.76	7.85
90	4.27	5.69	6.59	7.03	7.38	7.67	7.89	8.22	8.45
110	4.07	5.71	6.75	7.31	7.76	8.06	8.34	8.89	9.42
120	3.94	5.55	6.65	7.26	7.79	8.31	8.79	9.59	10.4
135	3.46	4.96	6.14	6.91	7.46	8.04	8.69	10.5	12.31
150	2.86	4.17	5.28	6.22	6.89	7.36	7.84	9.14	11.57
165	2.23	3.37	4.43	5.31	6.02	6.55	6.93	7.48	9.43
180	1.66	2.61	3.57	4.39	5.11	5.72	5.99	5.88	7.37
```

897 octets (J80 : 885). Cibles relues par le code de l'app, comparées au certificat et au J80 de l'app :

| Vent | Près : angle (certificat) | VMG près (certificat) | Portant : angle (certificat) | VMG portant (certificat) | Travers 90° | J80 : VMG près ; portant ; 90° |
|------|---------------------------|------------------------|-------------------------------|---------------------------|-------------|--------------------------------|
| 4 nd | 47° (45,2°) | 2,53 (2,55) | 143,5° (139,4°) | 2,51 (2,47) | 4,27 | 2,04 ; 2,28 ; 3,40 |
| 6 nd | 42° (41,9°) | 3,59 (3,59) | 145,5° (142,8°) | 3,63 (3,61) | 5,69 | 3,29 ; 3,68 ; 5,48 |
| 8 nd | 40° (39,9°) | 4,34 (4,34) | 148,5° (146,9°) | 4,58 (4,58) | 6,59 | 3,96 ; 4,61 ; 6,23 |
| 10 nd | 38° (37,9°) | 4,74 (4,75) | 150,5° (149,5°) | 5,39 (5,39) | 7,03 | 4,37 ; 5,29 ; 6,52 |
| 12 nd | 38° (37,0°) | 4,89 (4,92) | 153,5° (152,8°) | 5,98 (5,99) | 7,38 | 4,53 ; 5,77 ; 6,88 |
| 14 nd | 38° (36,7°) | 4,97 (5,01) | 156° (156,6°) | 6,43 (6,42) | 7,67 | 4,59 ; 6,16 ; 7,18 |
| 16 nd | 38° (36,7°) | 5,04 (5,08) | 155° (155,4°) | 6,83 (6,82) | 7,89 | 4,62 ; 6,64 ; 7,43 |
| 20 nd | 38° (36,7°) | 5,10 (5,14) | 150° (144,1°) | 7,92 (7,92) | 8,22 | 4,54 ; 8,81 ; 7,76 |
| 24 nd | 38° (37,8°) | 5,06 (5,07) | 150° (143,6°) | 10,02 (10,02) | 8,45 | 4,54 ; 9,37 ; 7,76 |

- Les VMG de l'app retombent sur ceux du certificat à 0,04 nd près. Les angles de près de 36,7 à 37° s'arrondissent à 38° parce que la table a des lignes à 36 et 38° : ajouter une ligne à 37° les rendrait exacts.
- Sur le papier, ce Tofinou gagne 8 à 12 % de VMG au près sur le J80 de l'app de 6 à 24 nd (24 % à 4 nd, où la colonne du J80 est extrapolée), fait jeu égal au portant jusqu'à 10 nd, gagne 3 à 4 % de 12 à 16 nd, et perd au-delà (le J80 plane).
- Lignes 165° et 180° : produites par la formule de l'outil ; le certificat contient des champs `DW165` et `DW180` qui donnent des valeurs proches (5,08 et 4,56 nd à 10 nd de vent, contre 5,31 et 4,39 produits) ; leur définition exacte n'a pas été trouvée dans la documentation [ASSUMED] : ne pas les utiliser sans la lire.

### 5.4 Incertitude

| Cause | Sens et ordre de grandeur | Fondement |
|-------|----------------------------|-----------|
| **Voile d'avant** : génois de 26,4 m² sur le certificat, foc de 16 m² sur la fiche de série | Avec le foc : au près et au bon plein, environ −15 % à 4 nd, −12 % à 6 nd, −10 % à 8 nd, −7 % à 10 nd, −2 % à 12 nd, rien à partir de 14 nd ; rien au portant sous spi | Rapport mesuré entre le certificat du 9.7 (foc de 18 m²) et celui du 9.5 (génois) : près 0,853 ; 0,877 ; 0,895 ; 0,931 ; 0,976 ; 0,994 ; 0,998 de 4 à 16 nd, et 1,00 à 1,01 de 110° à 180° [VERIFIED pour ce rapport] ; le transposer au 9.5 avec foc est une estimation [ASSUMED] : les carènes diffèrent (bau 3,00 m contre 2,45 m) |
| Certificat « Club » | Données en partie déclarées, pas toutes mesurées | Type de certificat `CLUB` [VERIFIED] ; ampleur [ASSUMED] |
| Quille relevable, poids, hélice, âge des voiles | Quelques pour cent, surtout au près | [ASSUMED] |
| Équipage et mer | Une polaire de jauge suppose un bateau mené à 100 % sur eau plate : 90 à 95 % est réaliste | Texte de l'onglet du bateau : « 90–95 % est réaliste en flotte » [VERIFIED: js/j80.js:39] |
| Portant au-dessus de 16 nd | 10 à 12 nd annoncés à 135° par 20 à 24 nd : théoriques pour un bateau de 3 tonnes à l'équipage réduit | [ASSUMED] |
| 25 nd | La table s'arrête à 24 nd : l'app garde les valeurs de 24 nd au-delà | Interpolation de `boatSpeed` qui se cale sur la dernière colonne [VERIFIED: js/polar.js:45] |

Confiance : MOYENNE de 10 à 16 nd au près et au travers, et au portant jusqu'à 16 nd (± 5 %) ; BASSE par petit temps au près tant que la voile d'avant du bateau réel n'est pas connue (± 10 à 15 %) et au portant par vent fort.

### 5.5 Comment produire `data/tofinou95.pol` et la table par défaut

1. **Entrée** : un fichier `tools/boats/tofinou95.orc.json` (nouveau, hors déploiement) qui ne garde du certificat que l'identification (classe, référence, date, type) et les tableaux `WindSpeeds`, `Beat`, `BeatAngle`, `R52` à `R150`, `Run`, `GybeAngle`. Pas de nom de propriétaire (le fichier public n'en contient pas).
2. **Outil** : `tools/build_polar.mjs` est écrit pour le J80 (table en dur, sorties `data/j80.pol` et `js/polar-orc.js`). Deux voies : un second outil `tools/build_polar_tofinou.mjs` qui lit le JSON (le plus sûr : l'outil du J80 n'est pas touché, la garde de Toulon non plus), ou un paramètre de bateau dans l'outil existant avec contrôle que la sortie J80 est identique à l'octet près.
3. **Sorties** : `data/tofinou95.pol` (même format que `data/j80.pol`, 897 octets, lien « Télécharger la polaire ») et `js/polar-tofinou95.js` (mêmes exports que `js/polar-orc.js` : vents, angles avec la ligne 0, vitesses), lu de façon synchrone au démarrage comme le prévoit `08-RESEARCH.md` § C. Le nom `data/tofinou95.pol` n'est pas celui d'un pack (pas de `data/tofinou95.meta.json`) : `npm run stamp` le range dans la liste hors réseau, comme `data/j80.pol`.
4. **Deux variantes** à proposer à Romain : « génois (certificat) » et « foc d'origine (estimée) » obtenue en multipliant les lignes de 30° à 75° par 0,85 ; 0,88 ; 0,90 ; 0,93 ; 0,98 ; 1 ; 1 ; 1 ; 1 (colonnes de 4 à 24 nd), la ligne 90° par 0,94 ; 0,99 puis 1, les lignes de 110° à 180° inchangées [ASSUMED, § 5.4]. La variante par défaut dépend de la garde-robe du bateau réel.
5. **Source affichée** : « ORC Club 2026 (Tofinou 9.5, sister-ship) — à recaler ».
6. **Pertes aux manœuvres** : 11 s par virement et 8 s par empannage, contre 9 s et 6 s pour le J80 [ASSUMED : bateau trois fois plus lourd ; à mesurer sur les traces].
7. Limite basse du spi (`spiMinTwa`), conseils de réglage (`trimAdvice`) et guide (`js/tuning.js`) sont écrits pour le J80 : à masquer pour le Tofinou (déjà prévu par `08-RESEARCH.md`).

Si le certificat ne pouvait pas être utilisé (refus sur la réutilisation), la méthode de repli serait un calcul simplifié à partir des caractéristiques de la fiche OSIRIS (longueur à la flottaison 8,62 m, déplacement, surfaces de voile), calé sur le rapport des ratings OSIRIS avec le J80 : incertitude de 10 à 20 % partout, nettement moins bonne. Elle n'est pas recommandée tant que le certificat existe.

### 5.6 Comment l'équipage la recale

L'app a déjà les trois moyens [VERIFIED: js/j80.js:38-44 ; js/polar.js:17-38 ; js/app.js:134] :

1. **Le curseur « Performance de l'équipage par rapport à la polaire »** (75 à 105 %) : premier réglage, après deux ou trois sorties, en lisant dans le débrief le pourcentage de polaire tenu par vent établi.
2. **Le débrief** : vitesse de chaque bord face à la polaire. Si l'écart dépend de la force du vent (par exemple 85 % sous 8 nd et 97 % à 14 nd), c'est la signature du foc : passer à la variante « foc d'origine ».
3. **La polaire personnelle** : télécharger le `.pol`, corriger les colonnes dans un tableur, l'importer dans l'onglet du bateau (`parsePolar`, puis `setPolar`, gardée sur le téléphone). Ordre conseillé : d'abord les colonnes de 8 à 14 nd au près et au travers, où les mesures sont les plus nombreuses.

Mesures à demander à l'équipage à la première sortie : vitesse et angle au près par vent établi (deux bords de cinq minutes sur chaque amure), temps perdu sur un virement et un empannage, voile d'avant portée, position de la quille.

## 6. Synthèse : ce qu'il faut produire

### 6.1 Fichiers

| Fichier | Contenu | Taille | Produit par |
|---------|---------|--------|-------------|
| `tools/venues/bormes.json` | Configuration (voir exemples) | 1,5 ko | à écrire (essayée dans cette session) |
| `data/bormes.meta.json` | Emprise, dimensions, sources | 314 o | `tools/build_terrain.py --config` |
| `data/bormes.terrain.bin` | Relief et fonds, 1030 × 885 | 1 823 100 o | idem |
| `data/bormes.cover.bin` | Mer, terre, urbain, digue | 911 550 o | idem |
| `data/bormes.coast.json` | Trait de côte | 92 212 o | idem |
| `data/bormes.basemap.jpg` | Fond 4096 × 3518 | 638 905 o | `tools/build_basemap.py --config` |
| `data/bormes.seamask.png` | Masque de l'eau | 137 334 o | idem |
| `data/bormes.wx-snapshot.json` | Instantané météo | environ 90 ko (non produit) | `tools/snapshot_weather.py --venue bormes` (à étendre) |
| **Pack** | | **environ 3,7 Mo** | Téléchargé à la demande, comme Brest |
| `js/venue-bormes.js` | Descripteur léger | 15 à 25 ko | à écrire |
| `data/tofinou95.pol`, `js/polar-tofinou95.js` | Polaire | 0,9 ko, 1,7 ko | outil de polaire |
| `docs/bormes-sources.md` | Provenance et licences, sur le modèle de `docs/brest-sources.md` | — | à écrire |

Les tailles exactes changeront de quelques octets à la reconstruction (OpenStreetMap évolue) ; les empreintes du pack d'essai ne sont donc pas à figer.

### 6.2 Constantes du descripteur `js/venue-bormes.js`

`id: 'bormes'` ; `nom: 'Rade de Bormes – Le Lavandou'` ; `origin: { lat: 43.10, lon: 6.40 }` ; `bounds` de l'emprise A ; `inputBounds` (piège 6) ; `files: { base: 'data/bormes.' }` ; pas de `maree` ni de `courant` ; `weather` (centre, grille de 20 points, `cellSelection: 'sea'`, point marin, `live: null`, clé `rade.wx.bormes.v1`, instantané du pack) ; `wind: {}` ; cadrage 3D ; `windRef` au milieu de la baie ; `MARKS` (La Fourmigue, coffre 1, repères fixes ; bouées mouillées notées « approx ») ; `COURSES` (parcours 1 à 10 du Challenge de la Baie, le 4 par la banane) ; `LINE_PRESETS` (Le Lavandou, Bormes) ; `PLACES` (§ 2.4) ; `FORBIDDEN_ZONES` (Levant ; Brégançon « à compléter ») ; `DANGERS` (§ 2.6) ; `regimes` et `presets` (§ 3.6) ; `texts` ; `links`. Inscription dans `js/venues.js` (`VENUES`, `VENUE_IDS`), dont la visibilité par espace relève de `08-RESEARCH.md`.

Mentions à afficher : « © contributeurs OpenStreetMap (ODbL) », « EMODnet Bathymetry DTM », « AWS Terrain Tiles (Terrarium, SRTM/GMTED) », « Weather data by Open-Meteo.com », et « ne remplace pas les cartes et ouvrages nautiques officiels ».

### 6.3 Travail, par lot

| Lot | Contenu | Poids | Risque pour Toulon et Brest |
|-----|---------|-------|------------------------------|
| 1. Pack | `tools/venues/bormes.json`, construction, `docs/bormes-sources.md`, `--venue bormes` dans l'outil d'instantané, option pour ne pas classer le Levant en urbain | 1 plan court | Aucun si les valeurs par défaut des outils ne changent pas (gardes existantes) |
| 2. Descripteur | `js/venue-bormes.js` : lieux, marques, lignes, zones, dangers, régimes, météo ; inscription au registre | 1 plan | Aucun |
| 3. Catalogue | Parcours 1 à 10 (côtiers à marques fixes et mouillées, sens inverse « R », banane) | 1 plan | Aucun |
| 4. Polaire | Outil, table, `.pol`, variante foc, pertes aux manœuvres | 1 plan court | Aucun si l'outil du J80 n'est pas touché |
| 5. Textes du lieu | Carte « État de la mer », guide, consignes (plan d'eau, RIR, VHF 72, groupe 4) | avec `08-RESEARCH.md` | Textes de Toulon inchangés |
| 6. Contrôles humains | § 6.6 | Hors code | — |

### 6.4 Ce qui diffère de Brest et de Toulon

| Sujet | Toulon | Brest | Bormes |
|-------|--------|-------|--------|
| Outils du pack | Fichiers d'origine | Outils paramétrés, Overpass injoignable, API par boîtes (8 min 38 s) | Mêmes outils sans changement ; miroir Overpass (29 s) |
| Taille | 2,56 Mo avec l'instantané | 4,67 Mo sans instantané | 3,60 Mo (3,7 avec l'instantané) |
| Part de terre | — | 66 % | 27 % |
| Relief | 584 et 702 m | 60 à 130 m | 450 à 520 m au nord, 184 m à Bénat, 190 m à Port-Cros |
| Seuil « mer dégagée » | 4 000 m | 1 500 m (aucune eau à 4 km) | 4 000 m (45 % de l'eau au-delà) |
| Vent fort | Mistral de nord-ouest (285 à 345°) | Aucun dominant | **Mistral d'ouest (260°)** ; est fort l'hiver |
| Brise | Sud-ouest, tourne à droite | Ouest, sans rotation régulière | Sud-est puis sud-ouest, tourne à droite |
| Marée | Ignorée | 5,90 m, module complet | 21 cm, ignorée |
| Courant | Ignoré | Atlas à 100 m dans le routage | Ignoré dans la baie ; information pour les côtiers |
| Fonds | Sans objet | Fichier de fonds et marge | Sans objet |
| Zones interdites | Saint-Mandrier | Île Longue, Pen ar Vir | Levant (zones 1 à 7), Brégançon à compléter |
| Parcours | Cahier du club, bouées fixes numérotées | Banane en zone A | Côtiers autour de La Fourmigue, bananes, tour de Port-Cros |
| Marques | Bouées fixes recalées en commun | Banane construite | Deux marques fixes, le reste mouillé par le comité |
| Balises en direct | Pioupiou | Aucune | Aucune |
| Bateau | J80, polaire ORC de la série | J80 | Tofinou 9.5, certificat d'un sister-ship |
| Règles | Règles de course, instructions du club | Instructions du GPEN | Règles d'introduction à la régate, un tour de pénalité |

### 6.5 Vérifications possibles (valeurs de contrôle pour les tests)

| Vérification | Valeur de référence |
|--------------|---------------------|
| Terre et mer | Baie (43,122° N, 6,386° E), coffre 1, passe Bénat – Bagaud, passe des Grottes en mer ; La Fourmigue, Gabinière, îlot du Cristau en terre |
| Fonds | Baie −25,6 m ; devant Le Lavandou −19,8 m ; coffre 1 −32,0 m ; tolérance 2 m |
| Relief | Massif de Bénat 184 m dans 2,5 km ; Port-Cros 189 m ; crête au nord de Saint-Clair 479 m ; point culminant 598 m |
| Part de terre | 27 % ± 2 |
| Champ de vent | 36 462 cellules ; 45 % de l'eau au-delà de 4 000 m ; ouest 260° : 0,84 au milieu de la baie, 1,02 à 2 M à l'est de La Fourmigue ; est 075° : 0,92 au milieu de la baie |
| Régimes | Chaque direction et chaque force trouvent exactement un régime ; 260° et 20 nd donnent `mistral` |
| Marques | La Fourmigue 43,10603° N 6,40420° E ; coffre 1 43,08522° N 6,27945° E |
| Distances | Le Lavandou → La Fourmigue 2,24 M ; La Fourmigue → Port-Man 5,55 M |
| Zone du Levant | La pointe de Port-Man et la passe des Grottes sont hors zone ; le phare du Titan est dedans |
| Polaire | 897 octets ; VMG près 4,74 nd à 10 nd ; VMG portant 5,39 nd à 10 nd ; 7,03 nd à 90° par 10 nd |
| Toulon et Brest | Gardes existantes vertes, aucun fichier `data/` existant modifié |

### 6.6 Contrôles humains

1. **Le bateau réel** : voile d'avant (foc d'origine ou génois), quille (relevable ou fixe), spi, cuve ; cela choisit la variante de polaire par défaut.
2. **Les régates courues** : Challenge de la Baie seulement, ou aussi Trophée des Îles (emprise C) et Voiles de Saint-Tropez (autre pack) ?
3. **Zones interdites** : arrêtés en vigueur de la préfecture maritime (Levant 55/2021 et ses suites, Brégançon 192/2018), tracé sur la carte marine.
4. **Marques mouillées et « cardinale » de Port-Cros** : demander au club les positions habituelles des bouées de cap Nègre, de Bénat et de Cavalaire, et confirmer La Dame.
5. **Conseils de vent** : faire relire le tableau du § 3.6 par un régatier de la baie.
6. **Miroir Overpass** : accepter le miroir tiers, ou reconstruire par l'API principale (repli déjà écrit).
7. **Réutilisation des chiffres du certificat ORC** dans l'app : même question que pour le J80 ; app à accès réservé.
8. **Instantané météo** : à produire depuis une adresse non limitée avant la publication.

### 6.7 Risques

| Risque | Gravité | Parade |
|--------|---------|--------|
| Polaire d'un sister-ship mieux toilé | Moyenne : temps et angles faux par petit temps | Deux variantes, source affichée « à recaler », procédure du § 5.6 |
| Zone militaire du Levant mal tracée ou périmée | Forte | Tracé large, zone 6 interdite toute l'année, contrôle 3 avant de publier |
| Brégançon incomplet | Moyenne | Zone large « à compléter », hors des parcours sauf 5 et 7 |
| Conseils de vent sans expérience locale | Moyenne | Origine de chaque conseil, hypothèses affichées comme telles |
| Modèle de vent trop pessimiste par sud et dans les passes | Moyenne | Conseils marqués, comparaison à la première sortie |
| Courant ignoré sur le tour de Port-Cros | Faible à moyenne | Information à l'écran, mesure de dérive |
| Vent au-delà de 25 nd (13 % des heures de course l'hiver au Levant) | Faible | Table jusqu'à 24 nd, message existant |
| Bouées mouillées saisies comme fixes | Faible | Statut « approx », pinguer |
| Miroir Overpass indisponible ou refusé | Faible | API principale par boîtes |
| Recouvrement des bornes de saisie avec Toulon | Faible | Piège 6 |

## Pile standard

Aucune dépendance nouvelle, ni dans l'app ni dans les outils : Python 3 avec numpy et Pillow (déjà utilisés), bibliothèque standard pour les téléchargements, Node pour l'outil de polaire. Contrairement à Brest, ni lecture NetCDF ni analyse de marée : l'environnement d'outils de marée n'est pas requis.

| Au lieu de | On pourrait | Quand |
|------------|-------------|-------|
| Certificat ORC | Calcul simplifié depuis les caractéristiques | Seulement si le certificat ne peut pas être réutilisé |
| Pas de courant | Courant uniforme de la prévision dans `route()` | Si les côtiers autour de Port-Cros deviennent l'usage principal |
| Maille de vent de 150 m | 180 m | Si la mesure d'ouverture sur téléphone est trop lente |

## Audit de légitimité des paquets

Sans objet : cette phase n'installe aucun paquet. L'outil de contrôle des paquets du flux de travail n'est pas installé dans ce dépôt (aucun dossier d'outils trouvé) : il n'a pas été lancé.

## Motifs d'architecture

### Schéma

```text
 Sources ouvertes (une fois, hors déploiement)
 ┌──────────────┐ ┌──────────────┐ ┌───────────────┐      ┌──────────────────────┐
 │ OpenStreetMap│ │ EMODnet fonds│ │ Tuiles relief │      │ Certificat ORC 9.5   │
 └──────┬───────┘ └──────┬───────┘ └──────┬────────┘      └──────────┬───────────┘
        └────────────────┴───────┬────────┘                          │
                  tools/prepare_venue.py                    outil de polaire
                  tools/build_terrain.py                             │
                  tools/build_basemap.py                             ▼
                                 │                     data/tofinou95.pol
                                 ▼                     js/polar-tofinou95.js
               data/bormes.* (pack, 3,7 Mo)                          │
               téléchargé à la demande, empreinte vérifiée           │
                                 │                                   │
      js/venue-bormes.js ────────┤                                   │
      (marques, parcours,        ▼                                   ▼
       zones, régimes)   Terrain, WindField (réglages par défaut)  polaire par défaut
                                 │                                de l'espace Tofinou
                                 ▼                                   │
                 route(from, to, field, { forbidden })  ◀────────────┘
                 sans option current : chemin de Toulon
                                 │
          ┌──────────────────────┼─────────────────────┐
          ▼                      ▼                     ▼
   conseils par bord        mode départ            débrief
   (régimes de Bormes)                             (vitesse face à la polaire → recalage)

 Courant : point marin de la prévision ──▶ carte « État de la mer » (information seulement)
```

### Motif 1 : un plan d'eau « comme Toulon », décrit « comme Brest »

Le descripteur a la forme de celui de Brest, mais sans les clés `maree` et `courant` : tout le code de marée et de courant reste inactif, comme à Toulon.

### Motif 2 : la polaire est une donnée du bateau, pas du plan d'eau

Elle ne va pas dans le pack : fichiers `tofinou95.*`, branchés par l'espace (`08-RESEARCH.md` § C).

### Motif 3 : marques fixes et marques mouillées

Seules La Fourmigue et le coffre 1 ont une position sûre. Les autres portent un statut « approx » et se pinguent, comme les bouées d'une régate.

### À éviter

- **Reprendre le test « mistral » de Toulon** : il ne reconnaît pas l'ouest à 260°.
- **Embarquer un courant à 8 km de maille** : fausse précision.
- **Figer les empreintes du pack d'essai** : il se reconstruit.
- **Présenter la polaire du certificat comme celle du bateau.**

## Ne pas réinventer

| Problème | Ne pas écrire | Utiliser | Pourquoi |
|----------|---------------|----------|----------|
| Téléchargement et construction du pack | Un nouveau script | `tools/prepare_venue.py`, `build_terrain.py`, `build_basemap.py` avec `--config` | Ils fonctionnent sans changement (essai de cette session) |
| Lecture d'une polaire | Un nouveau lecteur | `parsePolar` et `setPolar` | Le fichier d'essai est relu tel quel |
| Conversion d'un certificat en table | Une nouvelle méthode | Celle de `tools/build_polar.mjs` | VMG retrouvés à 0,04 nd près |
| Banane | Un parcours 4 en dur | La banane de la phase 6 | Construit au vent |
| Zone interdite | Un nouveau mécanisme | `FORBIDDEN_ZONES` du descripteur | Déjà évitées par le routage |
| Conseils à confirmer | Un nouvel affichage | `{ t, o }` et `tipText` | Déjà en place pour Brest |

**Idée clé :** tout ce que Bormes demande existe déjà dans le système de pack ; le travail est dans les données et dans leur contrôle, pas dans le code.

## Pièges courants

### Piège 1 : le mistral cherché au nord-ouest
**Ce qui casse :** un vent d'ouest de 25 nd classé « Vent d'Ouest / Labech » avec les conseils de Toulon. **Cause :** `d >= 285 && d <= 345` (`js/tactics.js:21`). **Parade :** `regimes` propres au descripteur. **Signe :** aucun jour de « mistral » en baie de Bormes.

### Piège 2 : « large de Cépet » affiché à Bormes
**Ce qui casse :** la carte « État de la mer » nomme un lieu de Toulon et dit « faible en rade ». **Cause :** texte en dur (`js/app.js:894`), invisible à Brest où le point marin est absent. **Parade :** texte du lieu, ou point marin absent tant que le texte n'est pas paramétré.

### Piège 3 : l'outil d'instantané refuse `bormes`
**Ce qui casse :** `--venue bormes` s'arrête. **Cause :** `if v != 'brest':` (`tools/snapshot_weather.py:18`). **Parade :** lire centre et grille dans la configuration du plan d'eau.

### Piège 4 : le Levant en « urbain »
**Ce qui casse :** île beige, vent freiné de 25 % au-dessus de l'île. **Cause :** `landuse=military` rangé dans les zones urbaines (`tools/prepare_venue.py:22-23`). **Parade :** liste des types urbains dans la configuration.

### Piège 5 : polygone du Levant fermé par la mer
**Ce qui casse :** route qui passe entre le polygone et la côte, ou passe des Grottes interdite à tort. **Cause :** la zone 1 est une bande de 200 m qui suit la côte et s'arrête à la calanque du Tablier et à la pointe Maupertuis. **Parade :** fermer sur le trait de côte du pack ; tests « Port-Man dehors, Titan dedans ».

### Piège 6 : bornes de saisie qui se recouvrent
**Ce qui casse :** une régate de Bormes dont les bouées confirmées sont à l'ouest de 6,2° E est attribuée à Toulon. **Cause :** `inputBounds` de Toulon va jusqu'à `east: 6.2` (`js/venues.js:17`) et la règle « emprise ± 0,1° » donnerait 6,12° E à Bormes ; la recherche prend le premier plan d'eau qui convient. **Parade :** borne ouest de saisie de Bormes à 6,20° E (le coffre 1 est à 6,279° E).

### Piège 7 : bouées mouillées prises pour des marques fixes
**Ce qui casse :** route calculée vers une bouée qui n'est pas là. **Parade :** statut « approx », pinguer ; seules La Fourmigue et le coffre 1 sont fixes.

### Piège 8 : conseils de sud pris au pied de la lettre
**Ce qui casse :** l'app annonce la moitié du vent dans la baie par brise de mer. **Cause :** écoulement du modèle bloqué par le mur des Maures. **Parade :** conseils marqués, contrôle sur l'eau avant tout réglage.

### Piège 9 : polaire trop flatteuse par petit temps
**Ce qui casse :** temps de parcours optimistes, équipage « à 80 % » sans raison. **Cause :** génois du sister-ship. **Parade :** variante foc, question 1 du § 6.6.

### Piège 10 : date de l'avis de course
**Ce qui casse :** fiche semée au samedi 10 octobre. **Cause :** coquille de l'avis. **Parade :** dates de la fiche de course (dimanches).

## Exemples de code

### Configuration du pack (essayée telle quelle dans cette session, miroir Overpass compris)

```json
{
  "id": "bormes",
  "nom": "Rade de Bormes – Le Lavandou",
  "prefix": "bormes.",
  "bounds": { "west": 6.22, "east": 6.60, "south": 42.96, "north": 43.20 },
  "grid": { "nx": 1030, "ny": 885 },
  "fine": { "nx": 3090, "ny": 2655 },
  "cell": 30.0,
  "coastCenter": { "lon": 6.40, "lat": 43.09 },
  "tiles": { "zoom": 13, "url": "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png" },
  "bathy": {
    "file": "emodnet/bathy_bormes.tif",
    "url": "https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=emodnet:mean&crs=EPSG:4326&BBOX=6.15,42.90,6.65,43.25&format=image/tiff&interpolation=nearest&resx=0.00104166666&resy=0.00104166666",
    "left": 6.15, "top": 43.25, "step": 0.0010416666666666667, "width": 480, "height": 336
  },
  "seeds": { "depthBelow": -3.0, "coastClear": 4, "stride": 8 },
  "osm": {
    "overpass": ["https://maps.mail.ru/osm/tools/overpass/api/interpreter"],
    "bbox": { "south": 42.94, "west": 6.18, "north": 43.22, "east": 6.64 },
    "api": "https://api.openstreetmap.org/api/0.6/map",
    "boxes": { "west": 6.20, "east": 6.64, "south": 42.94, "north": 43.22, "dlon": 0.04, "dlat": 0.02 }
  },
  "sources": [
    "© contributeurs OpenStreetMap (ODbL)",
    "EMODnet Bathymetry DTM (couche emodnet:mean)",
    "AWS Terrain Tiles (Terrarium, SRTM/GMTED)"
  ]
}
```

Pour la version du dépôt, mettre les deux serveurs Overpass de `tools/venues/brest.json` avant le miroir : l'outil les essaie dans l'ordre.

### Descripteur (esquisse, forme de `js/venue-brest.js`)

```js
// Rade de Bormes – Le Lavandou : descripteur léger du plan d’eau. Ni marée ni courant (marnage médian 21 cm).
const BAIE = { lat: 43.115, lon: 6.39 };
const GRID = [];
for (const lat of [43.02, 43.06, 43.10, 43.14]) for (const lon of [6.30, 6.36, 6.42, 6.48, 6.54]) GRID.push({ lat, lon });

export const BORMES = Object.freeze({
  id: 'bormes',
  nom: 'Rade de Bormes – Le Lavandou',
  origin: { lat: 43.10, lon: 6.40 },
  bounds: { west: 6.22, east: 6.60, south: 42.96, north: 43.20 },
  // ouest à 6,20 et non 6,12 : les bornes de saisie de Toulon vont jusqu’à 6,2 (piège 6)
  inputBounds: { south: 42.86, north: 43.30, west: 6.20, east: 6.70, nom: 'la rade de Bormes', exemple: '43°06.362N 006°24.252E' },
  exemple: '43°06.362N 006°24.252E',
  files: { base: 'data/bormes.' },
  weather: { center: BAIE, grid: GRID, cellSelection: 'sea', marine: 'latitude=43.115&longitude=6.39', live: null,
    key: 'rade.wx.bormes.v1', snapshot: 'data/bormes.wx-snapshot.json' },
  wind: {},                                   // 150 m et 4 000 m : 45 % de l’eau est à plus de 4 km d’une terre
  windRef: { lat: 43.120, lon: 6.392 },
  // MARKS, COURSES, LINE_PRESETS, PLACES, FORBIDDEN_ZONES, DANGERS, regimes, presets, texts, links : § 2 et § 3.6
});
```

### Marques fixes (positions vérifiées)

```js
// La Fourmigue : 43°06,362 N 006°24,252 E (arrêté 110/2023 et OpenStreetMap) ; coffre 1 : 43°05,113 N 006°16,767 E (annexe des parcours)
const MARKS = {
  FOU: { name: 'La Fourmigue', lat: 43.106033, lon: 6.4042, kind: 'tourelle', color: '#e03131', src: 'Arrêté 110/2023',
    note: 'Balise de danger isolé sur l’îlot de la Fourmigue, marque de la plupart des parcours : ne pas la serrer.' },
  COF: { name: 'Coffre 1', lat: 43.085217, lon: 6.27945, kind: 'balise', color: '#f5c400', src: 'Parcours du Challenge de la Baie',
    note: 'Coffre d’amarrage en rade d’Hyères (parcours 5 et 7). Position de l’annexe des parcours, à confirmer sur l’eau.' },
};
```

Types et couleurs repris de `js/venue-brest.js` (`kind: 'tourelle'`, `kind: 'balise'`, `ROUGE = '#e03131'`, `JAUNE = '#f5c400'`) [VERIFIED: js/venue-brest.js:73, 81, 87]. D'autres types existent dans `js/courses.js` (`'speciale'`, `'gonflable'`, relevés par une recherche, non relus) : à préférer pour le coffre et pour les bouées mouillées si leur sens convient [ASSUMED].

### Régime « mistral » de Bormes (forme de Brest)

```js
const vent = (s) => !(s < 4);
// Ici le mistral vient de l’ouest : médiane 260° au Levant pour 17 nd et plus (Météo-France, heures de course 2010-2026)
{ id: 'mistral', name: 'Mistral (ouest)', test: (d, s) => vent(s) && d >= 235 && d < 300 && s >= 14,
  tips: [
    { t: 'Ici le mistral vient de l’ouest (260° en médiane), pas du nord-ouest.', o: 'D' },
    { t: 'Le massif du cap Bénat abrite la baie : 15 à 25 % de vent en moins devant Bormes et au milieu, vent plein à 2 milles à l’est de La Fourmigue.', o: 'M' },
    { t: 'Rafales qui tombent du relief, mer plate sous Bénat.', o: 'H' },
  ] },
```

### Table de la polaire (même forme que `js/polar-orc.js`)

```js
// Généré par l’outil de polaire — certificat ORC Club 2026 d’un Tofinou 9.5 (sister-ship, génois) : à recaler.
export const TOF_TWS = [4, 6, 8, 10, 12, 14, 16, 20, 24];
export const TOF_TWA = [0, 30, 34, 36, 38, 40, 42, 44, 47, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
// TOF_BSP : une ligne de zéros puis les 18 lignes du tableau du § 5.3
```

## État de l'art

| Avant | Maintenant | Depuis | Effet |
|-------|-----------|--------|-------|
| Polaires des séries sur demande au chantier | Certificats ORC publics avec les vitesses prévues, en JSON, sans clé | — [VERIFIED pour l'accès] | Une polaire de sister-ship en quelques minutes |
| Entrées du pack par l'API principale d'OpenStreetMap, boîte par boîte | Miroir Overpass qui répond en quelques secondes | constaté le 26/11/2026 | Pack reconstruit en une minute |
| Tofinou 9.5 au catalogue | Remplacé par le 9.7 sur le site du constructeur | — [VERIFIED: modèles affichés] | Plus de données du chantier sur le 9.5 |

## Journal des hypothèses

| # | Hypothèse | Section | Risque si faux |
|---|-----------|---------|----------------|
| H1 | Positions des bouées mouillées (cap Nègre, Bénat, Cavalaire) et des deux lignes, lues sur des croquis | 2.3 | Routes d'essai décalées ; se corrige en pinguant |
| H2 | « Sa cardinale » de Port-Cros est La Dame | 2.3 | Tour de l'île mal décrit |
| H3 | Zones du Levant inchangées depuis l'arrêté 55/2021 | 2.5 | Zone interdite fausse |
| H4 | Limites de la zone de Brégançon | 2.5 | Zone incomplète |
| H5 | Caractères des feux d'OpenStreetMap | 2.3 | Affichage faux |
| H6 | Vent au ras de l'eau plus faible qu'aux stations d'altitude ; brise qui entre par le sud-est dans la baie | 3.1, 3.2 | Conseils de force décalés |
| H7 | Conseils marqués (H) et doutes sur le modèle par sud et dans les passes | 3.4, 3.6 | Conseil faux en course |
| H8 | Rafales des vents prédéfinis ; choix de la grille météo et de `cell_selection` | 3.6, 3.7 | Réglage de confort |
| H9 | Fidélité du courant modélisé à 8 km | 4.2 | Information trompeuse sur les côtiers |
| H10 | Droit de réutiliser les chiffres du certificat ORC dans une app à accès réservé | 5.1 | Polaire à refaire par le calcul simplifié |
| H11 | Correction « foc d'origine » tirée du rapport entre deux séries différentes | 5.4, 5.5 | Petit temps mal estimé de quelques pour cent |
| H12 | Pertes de 11 s au virement et de 8 s à l'empannage | 5.5 | Temps de route un peu faux |
| H13 | Vitesses au portant au-dessus de 16 nd théoriques | 5.4 | Temps optimistes par vent fort |
| H14 | Signification des champs `DW165` et `DW180` du certificat | 5.3 | Aucun s'ils ne sont pas utilisés |
| H15 | Origine de projection et points de référence | 1.1, 3.5 | Aucun sur les calculs |
| H16 | Un Tofinou 9.5 peut traverser le cœur marin de Port-Cros (« bateaux propres ») | 2.5 | Parcours 6 et 10 à revoir |

## Questions ouvertes

1. **Quel bateau exactement ?** On sait : la série (fiche OSIRIS) et un sister-ship à génois. On ignore : la voile d'avant, la quille, l'année. Recommandation : question 1 du § 6.6 avant de choisir la variante par défaut.
2. **Quelles régates ?** On sait : le Challenge de la Baie est la seule série locale documentée, aucune épreuve de classe Tofinou sur place. On ignore : ce que court l'équipage. Recommandation : emprise A par défaut.
3. **Zones réglementées à jour.** Recommandation : lecture des arrêtés et tracé sur carte avant publication ; en attendant, tracé large.
4. **Vent dans la baie.** On sait : statistiques des îles, calculs du modèle. On ignore : le vent au ras de l'eau devant Bormes. Recommandation : relevés dictés de l'équipage (fonction existante) et relecture locale.
5. **Courant.** Recommandation : mesurer la dérive au sud de Port-Cros au premier côtier.

## Disponibilité de l'environnement

| Dépendance | Requise par | Disponible | Version | Repli |
|------------|-------------|-----------|---------|-------|
| Python 3, numpy, Pillow | Outils du pack | oui | 3.13.18, numpy 2.5.3, Pillow 12.3.0 | — |
| Node.js | Outil de polaire, tests | oui | v22.23.5 | — |
| Tuiles de relief, EMODnet | Entrées | oui | — | — |
| Overpass (serveurs de la configuration de Brest) | Côte | **non** | — | Miroir (oui) ou API principale (oui) |
| Open-Meteo, prévisions | Instantané | oui en début de session, 429 ensuite | — | Autre adresse |
| Open-Meteo, marine | Courant | oui | — | — |
| Météo-France, fichiers horaires | Climatologie | oui par le serveur de stockage (`meteofrance.s3.sbg.io.cloud.ovh.net`) ; connexion coupée sur `object.files.data.gouv.fr` | — | — |
| Shom (marégraphes, références altimétriques) | Marée | oui | — | — |
| Liste des certificats ORC | Polaire | oui | — | — |
| Outils du flux de travail (plan de recherche, contrôle des paquets, graphe) | Méthode | non installés dans ce dépôt | — | Recherche faite à la main |

**Bloquant sans repli :** rien. Les échantillons et le pack d'essai sont dans un dossier temporaire qui peut être effacé ; tout se reconstruit avec les adresses citées. Aucun fichier du dépôt n'a été modifié hors de ce document.

## Domaine sécurité

| Catégorie ASVS | Concernée | Contrôle |
|----------------|-----------|----------|
| V2 Authentification, V3 Session | non (voir `08-RESEARCH.md`) | — |
| V4 Contrôle d'accès | oui | `data/bormes.*` derrière le middleware, visibles du seul espace qui y a droit (`08-RESEARCH.md`) |
| V5 Validation des entrées | oui | Entrées téléchargées traitées comme non fiables (lues, jamais exécutées, Python lancé avec `-I`) ; polaire importée lue par `parsePolar` (nombres seulement) ; bornes sur les réponses de la prévision |
| V6 Cryptographie | oui | Empreinte du pack par `crypto.subtle`, existant |
| V14 Configuration | oui | Jeton d'un éventuel relais de mesures en variable d'environnement seulement |

| Menace | STRIDE | Parade |
|--------|--------|--------|
| Pack altéré | Altération | Empreintes de `data/venues.json`, valeurs de contrôle du § 6.5 |
| Données d'un miroir tiers falsifiées | Altération | Contrôles terre / mer et relief ; comparaison possible avec l'API principale |
| Fichier `.pol` hostile importé | Altération | Lecture par champs numériques, affichage échappé (existant) |
| Zone interdite absente prise pour une autorisation | — (sûreté) | Mention « ne remplace pas les cartes et ouvrages nautiques officiels », zones notées « à compléter » |
| Noms de personnes repris de classements publics | Divulgation | Aucun nom dans le pack ni dans les documents |

## Sources

### Primaires (confiance haute)
- Code du dépôt lu dans cette session : `js/venues.js`, `js/venue-brest.js`, `js/wind.js`, `js/geo.js`, `js/polar.js`, `js/polar-orc.js`, `js/j80.js`, `js/tactics.js`, `js/router.js`, `js/pack.js`, `js/app.js` (extraits), `tools/prepare_venue.py`, `tools/build_terrain.py`, `tools/build_basemap.py`, `tools/snapshot_weather.py`, `tools/build_polar.mjs`, `tools/stamp.mjs`, `tools/venues/brest.json`, `data/j80.pol`, `data/venues.json`, `docs/brest-sources.md`.
- Pack d'essai construit avec ces outils (tuiles Terrarium, EMODnet, OpenStreetMap du 26/11/2026).
- Météo-France, « Données climatologiques de base – horaires », Var, 2010-2026, Licence Ouverte 2.0 (`https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_83_…csv.gz`, fiche data.gouv.fr).
- Shom – REFMAR, marégraphes de Toulon (68) et de Port-Cros (5154) ; Shom – Références Altimétriques Maritimes (service WFS) ; Licence Ouverte 2.0.
- ORC, liste publique des certificats en cours (`https://data.orc.org/public/WPub.dll?action=DownRMS&CountryId=<pays>&ext=json`), 38 pays, le 26/11/2026 ; certificats `03510004F1O` (Tofinou 950) et `04330004CBL` (Tofinou 9.7).
- FFVoile, table OSIRIS (`https://www.ffvoile.fr/ffv/web/pratique/habitable/OSIRIS/table.aspx`), fiches « TOFINOU 9,5 M » et « J 80 ».
- Challenge de la Baie 2026-2027 : avis de course (`https://le-lavandou.fr/wp-content/uploads/2026/09/Avis-de-course-Challenge-de-baie-26-27.pdf`, identique sur `yclavandou.com`), fiches de course des manches 1 et 2, annexe des parcours (`https://le-lavandou.fr/wp-content/uploads/2026/09/Parcours-1-a-10-202-2_compressed.pdf`), classement de la manche 1 ; page `https://le-lavandou.fr/challenge-de-la-baie-2026/`.
- Préfecture maritime de la Méditerranée, arrêté n° 110/2023 du 11 mai 2023 (copie sur le site du parc national de Port-Cros).

### Secondaires (confiance moyenne)
- Direction interrégionale de la mer Méditerranée : carte « Île du Levant » (avril 2021, `zones_ile_du_levant.pdf`) et projet d'arrêté de pêche de novembre 2024 reprenant les zones de l'arrêté 55/2021 (`projet_modif_ap_ile_du_levant_.pdf`).
- Parc national de Port-Cros, dépliant « Réglementation marine » 2025.
- Club de voile de Bormes (`cvbormes.com` : 6 Heures de Bormes, Challenge de la Baie, webcam et météo) ; International Yacht Club de Hyères (`iych.fr`, Trophée des Îles 2027) ; office de tourisme du Lavandou.
- Voiles de Saint-Tropez : liste des inscrits au 19 août 2025, communiqué d'octobre 2024.
- Open-Meteo : prévisions (réponse du 26/11/2026) et API marine (26/08 au 28/11/2026).
- Pioupiou (`api.pioupiou.fr/v1/live/all`) ; `aviationweather.gov` (METAR de Hyères).
- Guide OSIRIS 2026 de la FFVoile.

### Tertiaires (confiance basse)
- Résumés de recherche : catalogue du Tofinou 9.5, base de modèles, calendriers Tofinou de 2014, Tofinou Atlantic Cup 2026.
- Non lus (accès refusé ou serveur en panne) : étude de la circulation autour des îles d'Hyères (Taupier-Letage et al., 2013) ; arrêtés 55/2021 et 192/2018 eux-mêmes ; article d'avril 2026 sur les zones temporaires de Port-Cros ; catalogue du chantier.

## Métadonnées

**Confiance par domaine :**
- Emprise et pack : HAUTE (construit et mesuré).
- Régates et parcours : HAUTE pour le Challenge de la Baie ; MOYENNE pour les autres épreuves ; BASSE pour les marques mouillées.
- Zones réglementées : MOYENNE (textes lus, version en vigueur non contrôlée) ; BASSE pour Brégançon.
- Vents : HAUTE pour la climatologie ; MOYENNE pour le modèle de relief ; BASSE pour les conseils rédigés.
- Marée : HAUTE. Courant : MOYENNE pour l'ordre de grandeur, BASSE pour le détail.
- Polaire : HAUTE pour le contenu du certificat et la conversion ; MOYENNE pour sa valeur sur le bateau réel de 10 à 16 nd ; BASSE par petit temps et par vent fort au portant.

**Date :** 2026-11-26 — **valable jusqu'à :** 30 jours pour les accès aux services ; la saison 2026-2027 pour les documents du Challenge de la Baie (avis suivant vers octobre 2027) ; la validité du certificat ORC (année 2026) pour la polaire ; jusqu'au prochain arrêté pour les zones.
