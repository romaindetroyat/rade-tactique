# Phase 7 : Plans d'eau — Étude du plan d'eau de Brest (rade, goulet, zone du GPEN)

**Recherche faite le :** 2026-11-19
**Domaine :** relief et côte, repères et zones, vents, marées et courants, météo de la rade de Brest ; ce qu'il faut produire pour un pack « Brest » du même niveau que Toulon
**Confiance générale :** HAUTE pour les chiffres mesurés dans cette session sur des données ouvertes (relief, atlas de courants du Shom, marégraphe de Brest, observations Météo-France, positions des marques) ; MOYENNE pour les fonds (EMODnet est grossier) et les zones réglementées ; BASSE pour les conseils tactiques rédigés (à valider sur l'eau ou auprès de régatiers locaux)

Ce document complète `07-RESEARCH.md` (inventaire du code, GPEN, vagues de livraison), qui n'est pas modifié. Il répond aux décisions D-10, D-13 et D-14 de `07-CONTEXT.md`.

Balises de provenance : `[VERIFIED: …]` = constaté dans cette session par un outil sur une source qui fait autorité pour ce point ; `[CITED: …]` = lu dans un document cité ; `[ASSUMED]` = connaissance générale non vérifiée ici, à confirmer.

<user_constraints>
## Contraintes de l'utilisateur (reprises de 07-CONTEXT.md)

### Décisions verrouillées

Copie mot pour mot de la section « Décisions » de `07-CONTEXT.md` :

> ### A. Toulon ne change pas d'un bord
> - **D-01 :** `js/courses.js` et `data/*` de Toulon restent en place ; garde SNPM `git diff --quiet f80c365 -- js/courses.js tests/reference/` inchangée. Fixture v42 capturée sur 56f6625 AVANT toute modification (bords, conseils, champ de vent, routage sur plusieurs vents/parcours) + empreintes des fichiers `data/` de Toulon : tout écart casse `npm test`.
> - **D-02 :** la v43 n'est publiée que si toutes les gardes Toulon sont vertes ; sinon la vague concernée attend après le 13/12.
>
> ### B. Pack de plan d'eau
> - **D-03 :** registre `js/venues.js` ; Toulon décrit par référence aux fichiers actuels ; Brest dans un module léger (`js/venue-brest.js`) plus des données lourdes à noms plats `data/brest.*`.
> - **D-04 :** Brest est téléchargé à la demande (geste « Télécharger le plan d'eau » + automatique quand on ouvre une régate à Brest avec du réseau), vérifié par empreinte, rangé dans un cache dédié que les mises à jour ne suppriment pas ; Toulon reste dans le cache de l'app comme aujourd'hui. Utilisable hors réseau une fois téléchargé ; un message clair sinon.
> - **D-05 :** changer de plan d'eau recharge l'app (origine de la carte, terrain, vent) — jamais pendant une course.
> - **D-06 :** une régate porte son plan d'eau (`venue`, ajouté aux champs fusionnés de l'archive) ; absent = Toulon (régates existantes). Ouvrir une régate d'un autre plan d'eau propose de basculer. Entraînement libre : choix du plan d'eau dans les réglages. Compatibilité v42 ↔ v43 vérifiée par un outil (un téléphone en v42 ignore `venue` sans casser).
> - **D-07 :** corriger les verrous Toulon : longitudes Ouest (`fmtLon`), lecture des positions (`parseLatLon`/RADE), bornes de plausibilité des IC (`icplaus` BOUNDS), contrôles en dur de js/app.js — par plan d'eau.
>
> ### C. GPEN
> - **D-08 :** fiche « GPEN 2027 — J80 » semée (5–9 mai 2027, VHF 14, zone A École Navale cercle 1,2 NM centré 48°17,890 N 004°21,630 W, pénalité un tour, temps limites, 3 courses validantes, retrait dès 4).
> - **D-09 :** catalogue limité à la zone A J80 : parcours 1 (2 tours) et 2 (3 tours), construits au vent (départ – 1 – 2 dégagement – porte 3S/3P – … – arrivée), réutilisant la banane de la phase 6 avec une nouvelle forme d'arrivée « à droite du comité » ; variante Virginie Hériot (arrivée décalée devant la chapelle) si la position est trouvable, sinon notée « à confirmer ».
> - **D-10 :** zones interdites de Brest (Île Longue, passage de Pen ar Vir…) et dangers dans le pack, utilisés par le routage.
> - **D-11 :** arbitre (api/rules.js), débrief et dictée (api/debrief.js, api/voice.js) reçoivent le plan d'eau et ses règles propres (IC GPEN : un tour, jugement semi-direct) au lieu du bloc CVAT quand on est à Brest.
> - **D-12 :** recalage partagé des bouées CVAT réservé à Toulon ; à Brest les bouées viennent des IC / de la banane construite.
>
> ### D. Marée, courant, vent (à compléter après 07-RESEARCH-PLAN-EAU.md)
> - **D-13 :** Brest a marée et courants forts : l'app doit au minimum donner l'heure et la hauteur de marée et un courant par zone et par heure de marée, utilisés par le routage (vitesse fond) et les conseils, hors réseau. Solution précise et sources : selon l'étude.
> - **D-14 :** régimes de vent et effets de relief propres à Brest (noms, conseils) au lieu de ceux de Toulon quand on est à Brest.
>
> ### Livraison
> - **D-15 :** branche `apercu-phase-07`, PR brouillon, aperçu vérifié ; production (v43) sur « publie » de Romain avant le 10/12 ; la vague qui touche le service worker est vérifiée en priorité (mise à jour sur iPhone).

### Laissé à l'appréciation de l'étude

`07-CONTEXT.md` n'a pas de section dédiée. Deux points y sont renvoyés à cette étude : la solution précise et les sources pour la marée et le courant (D-13), les régimes de vent et effets de relief de Brest (D-14).

### Hors périmètre

Copie de `07-CONTEXT.md` : « Hors périmètre : autres plans d'eau que Toulon et Brest ; découpage de js/app.js (CODE-01) ; changement de nom de l'app. »
</user_constraints>

<phase_requirements>
## Exigences de la phase

| ID | Description | Ce que cette étude apporte |
|----|-------------|----------------------------|
| VENUE-01 | Données propres à la rade dans un « pack » de plan d'eau (repris de `07-RESEARCH.md`) | Emprise, fichiers et tailles du pack Brest (§ 1, § 6), lieux, marques, dangers, zones (§ 2), météo (§ 5) |
| D-10 | Zones interdites et dangers de Brest utilisés par le routage | Positions des marques de l'Île Longue et de Pen ar Vir, liste des dangers (§ 2) ; fonds et hauteur d'eau (§ 4.6) |
| D-13 | Heure et hauteur de marée, courant par zone et par heure de marée, routage et conseils, hors réseau | Solution recommandée, sources, licences, précision mesurée, prototype (§ 4) |
| D-14 | Régimes de vent et effets de relief propres à Brest | Climatologie de mai mesurée, effets de site calculés avec le modèle de l'app, proposition de `REGIMES` (§ 3) |
</phase_requirements>

## Résumé

La rade de Brest se modélise avec les mêmes outils et les mêmes sources que Toulon : les tuiles d'altitude, la bathymétrie EMODnet et OpenStreetMap répondent sur toute la zone (échantillons téléchargés et lus dans cette session). L'emprise conseillée, 4°39,6' W à 4°13,2' W et 48°13,2' N à 48°25,8' N, couvre la rade, le goulet, Camaret et la zone A du GPEN ; à 30 m elle donne 1,68 Mo de relief et 0,84 Mo de couverture, soit un pack d'environ 5 Mo avec le fond de carte, les courants et la marée (Toulon : 2,5 Mo). Le relief est bas (60 à 100 m autour de la rade, contre 584 et 702 m au nord de Toulon) et aucun point de l'eau n'est à plus de 3,7 km d'une terre : les effets de site existent partout mais sur de courtes distances, et un réglage du modèle de vent (`js/wind.js`, référence « au large » à plus de 4 km d'une terre) ne trouve plus de cellule à Brest, ou une poignée seulement.

La différence majeure avec Toulon est la marée. À Brest le marnage est de 5,90 m en vive-eau moyenne et 2,80 m en morte-eau moyenne. L'atlas de courants du Shom pour la rade (grille de 100 m, pas de 5 min, coefficients 45 et 95, Licence Ouverte 2.0) a été téléchargé et lu : 4,6 nd au maximum devant la Pointe des Espagnols, 3,6 nd au milieu du goulet, et dans la zone A du GPEN de 0,3 à 1,15 nd selon l'endroit en vive-eau (0,3 nd en morte-eau), avec une renverse à la pleine mer de Brest et une autre un quart d'heure environ après la basse mer. Le GPEN 2027 (5 au 9 mai) tombe en vive-eau : marnage de 5,4 à 6,0 m, basse mer entre 11 h 15 et 14 h 05, donc une renverse au milieu de chaque journée de course. Ignorer le courant fausserait les temps de bord de 15 à 25 %, les laylines de 6 à 10°, l'approche de la ligne de départ de 23 m par minute, et l'analyse de vitesse du débrief de plus ou moins 0,75 nd.

La solution minimale fiable tient en deux petits fichiers et deux modules. La marée se calcule dans l'app par 35 à 68 constituants harmoniques ajustés sur les observations ouvertes du marégraphe de Brest, avec des facteurs nodaux pré-calculés par année : fichier de 4 à 8 ko, prototype écrit et vérifié ici (écart de 3,5 min sur l'heure des pleines et basses mers de 2025-2026, 14 cm sur la hauteur, la météo comprise). Le courant vient de l'atlas du Shom ré-échantillonné à l'heure et codé sur un octet : 0,9 Mo, interpolation dans le temps à 0,04 nd près. Les données marines d'Open-Meteo ne conviennent pas dans la rade : le jour de l'essai, courant quatre fois trop faible dans le goulet (0,4 nd pour 1,6 nd dans l'atlas) et marée en avance de 40 à 50 min.

**Recommandation principale :** construire le pack Brest avec les outils actuels paramétrés, y ajouter `brest.maree.json` (harmoniques tirées du marégraphe) et `brest.courants.bin` (atlas 560 du Shom, 100 m, 13 heures de marée, 2 coefficients), et brancher le courant dans `route()` par une option absente à Toulon, pour que Toulon reste identique au bit près.

## Contraintes du projet (fichier d'instructions du projet)

- JavaScript sans framework ni étape de build ; modules ES chargés tels quels ; pas de TypeScript ; identifiants et commentaires comme l'existant, textes en français avec l'apostrophe typographique.
- PWA qui doit fonctionner hors réseau en mer ; tout ce qui sert en course doit être dans un cache.
- `sw.js` (bloc généré) et `js/version.js` ne se modifient jamais à la main : `npm run stamp` après tout changement de l'app.
- Hébergement Vercel (site statique, fonctions Node dans `api/`, middleware d'accès) ; tout nouveau fichier de données reste derrière le contrôle d'accès ; aucun secret dans le code ni les documents.
- Fonctions d'IA : fournisseur unique imposé par le projet ; sans objet pour cette étude (aucun calcul de marée, de courant ou de vent ne passe par l'IA : « l'app calcule tous les chiffres »).
- Outils de données en Python (numpy, Pillow), hors déploiement ; les introduire sans alourdir le chargement de l'app.
- Vent : plage utile jusqu'à 25 nœuds.
- Pas de mise en production dans les 48 h avant une régate ni pendant une course.

## Carte des responsabilités

| Capacité | Où | Secours | Pourquoi |
|----------|----|---------|----------|
| Relief, côte, fond de carte de Brest | Fichiers statiques `data/brest.*` produits par `tools/` (hors déploiement) | — | Même chaîne que Toulon |
| Hauteur et heures de marée | Navigateur (`js/maree.js`, calcul local) à partir de `data/brest.maree.json` | — | Doit marcher sans réseau en mer ; 1 µs par calcul |
| Courant en un point et à une heure | Navigateur (`js/courant.js`) à partir de `data/brest.courants.bin` | Courant nul si le fichier manque (message clair) | Hors réseau ; le routage l'appelle des milliers de fois |
| Routage et conseils avec courant | Navigateur (`js/router.js`, `js/tactics.js`) | Sans option `current`, chemin de calcul actuel | Toulon inchangé (D-01) |
| Prévisions de vent | Open-Meteo depuis le navigateur, comme aujourd'hui | Cache local, puis instantané embarqué | Existant |
| Vent mesuré en direct à Brest | Fonction `api/` (relais avec jeton côté serveur) | Aucune balise : l'app s'en passe déjà | Les sources de Brest demandent un jeton ou n'envoient pas d'en-tête d'accès inter-domaines |
| Niveau d'eau observé (surcote) | Service du Shom depuis le navigateur | Marée calculée seule | Service ouvert, en-tête inter-domaines présent |

## Référence : comment Toulon est modélisé

Lu dans cette session, pour proposer le même niveau à Brest.

| Élément | Valeur | Source |
|---------|--------|--------|
| Emprise et grille | `W0, E0, S0, N0 = 5.80, 6.10, 43.00, 43.18` ; `NX, NY = 814, 667            # grille finale (~30 m)` ; `FX, FY = 2442, 2001          # grille fine pour le masque terre/mer (~10 m)` | [VERIFIED: tools/build_terrain.py:18-20] |
| Entrées | `osm_extract.json` (clés lues : `coast`, `breakwater` avec `c`, `t`, `area`, `urban` avec `c`, `t`), `bathy.tif` « bathymétrie EMODnet (mean), grille 1/960° », `tiles/13_x_y.png` « tuiles d'altitude Terrarium » | [VERIFIED: tools/build_terrain.py:3-6, 30, 48-51, 57-60 ; tools/build_basemap.py:46, 122] |
| Graines de remplissage de la mer | `seeds = [(5.95, 43.005), (6.09, 43.005), (5.85, 43.005), (5.95, 43.05)]` | [VERIFIED: tools/build_terrain.py:34] |
| Géoréférence du GeoTIFF | `BL0, BT0, BD = 5.7604166666666785, 43.21041666666666, 0.0010416666666666667` | [VERIFIED: tools/build_terrain.py:97] |
| Fonds | `d = min(d, -0.8)` puis pente imposée près du bord : `dmax = -(1.5 + dist[j, i] * cell * 0.09)   # pente ~9 % près du bord` | [VERIFIED: tools/build_terrain.py:117, 139] |
| Sorties | `terrain.bin   Int16 LE, altitude en décimètres, ligne 0 = nord` ; `cover.bin     Uint8  : 0 mer, 1 terre, 2 urbain, 3 digue` ; `coast.json` (Douglas-Peucker 6 m) ; `meta.json` | [VERIFIED: tools/build_terrain.py:8-11, 165] |
| Fond de carte | `WIDTH = 4096` ; `basemap.jpg` qualité 84 ; `seamask.png` | [VERIFIED: tools/build_basemap.py:17, 56, 138] |
| Tailles | `terrain.bin` 1 085 876 octets, `cover.bin` 542 938, `basemap.jpg` 647 183 (4096 × 3343), `seamask.png` 130 880, `coast.json` 60 001 (130 lignes, 2 874 points, 131 km de côte), `wx-snapshot.json` 89 352 ; total du dossier 2,46 Mo | [VERIFIED: `ls -la data/` et lecture de `data/meta.json`, `data/coast.json`] |
| Projection | `export const ORIGIN = { lat: 43.09, lon: 5.95 };` | [VERIFIED: js/geo.js:3] |
| Champ de vent | `const CELL = 150; // m` ; perméabilité `Math.max(0.04, Math.exp(-h / 110)) * (c === 2 ? 0.75 : 1)` ; 420 itérations par direction ; dévent sur 5 000 m `h / (h + 0.1 * d)` ; blocage sur 3 000 m `h / (h + 0.12 * d)` ; perte `f *= 1 - 0.5 * sh * strength` ; frottement `Math.exp(-dl / 1200)` ; recul côtier `-7 * (1 - dl / 1500)` | [VERIFIED: js/wind.js:16, 33, 88, 121-123, 128-130, 212, 217-219] |
| Référence « au large » | `if (!this.land[id] && this.distLand[id] > 4000) speeds.push(sp);` puis `const ref = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 1;` | [VERIFIED: js/wind.js:107, 110] |
| Routage | Aucun courant : `const bsp = boatSpeed(tws, twa) * perf;` puis déplacement `sh * dist`, `ch * dist` ; obstacle = terre ou zone : `const blocked = (x, y) => (terrain && terrain.isLand(x, y)) || inZone(x, y);` (aucun contrôle de profondeur) | [VERIFIED: js/router.js:21, 44, 49-50] |
| Régimes | Sept entrées : `calme` (`s < 4`), `mistral` (`d >= 285 && d <= 345 && s >= 12`), `ouest` (`d >= 235 && d < 285`), `thermique` (`d >= 185 && d < 235`), `marin` (`d >= 120 && d < 185`), `est` (`d >= 55 && d < 120`), `nord` (`() => true`) | [VERIFIED: js/tactics.js:12-61] |
| Météo | Six modèles (`meteofrance_arome_france_hd`, `meteofrance_arome_france`, `meteofrance_arpege_europe`, `ecmwf_ifs025`, `icon_eu`, `gfs_seamless`) ; grille de 24 points ; `CENTER = { lat: 43.085, lon: 5.958 }` ; point marin `latitude=43.06&longitude=5.96` avec `ocean_current_velocity,ocean_current_direction` ; balises Pioupiou filtrées par boîte | [VERIFIED: js/weather.js:6-19, 67, 146-149] |
| Lieux, zones | `PLACES` : `[nom, lat, lon, type]`, « type : 1 ville, 2 cap ou pointe, 3 sommet, 4 plan d'eau » ; `FORBIDDEN_ZONE` (7 sommets) ; `DANGERS` (`name`, `lat`, `lon`, `note`) ; `LINE_PRESETS` (`vignettes`, `mourillon`, `capbrun`, `grandrade`) | [VERIFIED: js/courses.js:6-14, 44-62] |
| Vents prédéfinis | `['Mistral fort', 315, 25, 34], ['Mistral modéré', 310, 16, 23], ['Ouest', 265, 14, 19], ['Brise SO', 215, 10, 13], ['Marin SE', 140, 14, 19], ['Levant E', 85, 12, 17], ['NE de terre', 40, 6, 10], ['Petit temps', 180, 4, 6]` | [VERIFIED: js/app.js:1790-1793] |

Aucun script du dépôt ne télécharge les entrées (constaté aussi dans `07-RESEARCH.md` § A.4) : à écrire pour Brest.

## 1. Relief et côte

### 1.1 Emprise conseillée

Points à couvrir : centre de la zone A du GPEN 48°17,890' N 004°21,630' W, soit 48,29817 N, 4,36050 W [CITED: IC GPEN 2026, annexe 1, lue dans cette session] ; goulet de la Pointe du Petit Minou (48,3363 N, 4,6146 W) à la Pointe du Portzic (48,3579 N, 4,5335 W) [VERIFIED: nœuds OpenStreetMap téléchargés dans cette session] ; emprise de l'atlas de courants du Shom pour la rade, 48,2480 à 48,4110 N et 4,6258 à 4,2530 W [VERIFIED: attributs du fichier NetCDF].

| Emprise | Ouest, Est, Sud, Nord | Taille | Grille 30 m | `terrain.bin` | `cover.bin` | Champ de vent à 150 m | Fond 4096 px |
|---------|----------------------|--------|-------------|---------------|-------------|------------------------|--------------|
| **Conseillée : rade, goulet, Camaret** | −4,66 ; −4,22 ; 48,22 ; 48,43 | 32,6 × 23,2 km | 1086 × 774 = 840 564 | 1,68 Mo | 0,84 Mo | 217 × 155 = 33 635 cellules | 4096 × 2920 (8,0 m par pixel) |
| Étendue jusqu'à Morgat (zone E du GPEN) | −4,66 ; −4,22 ; 48,16 ; 48,43 | 32,6 × 29,9 km | 1086 × 995 = 1 080 570 | 2,16 Mo | 1,08 Mo | 217 × 199 = 43 183 | 4096 × 3753 |
| Toulon (rappel) | 5,80 ; 6,10 ; 43,00 ; 43,18 | 24,4 × 19,9 km | 814 × 667 | 1,09 Mo | 0,54 Mo | 163 × 133 = 21 679 | 4096 × 3343 (6,0 m par pixel) |

[VERIFIED: calcul de cette session ; les tailles de `terrain.bin` et `cover.bin` sont exactes (2 octets et 1 octet par cellule)]

- L'emprise conseillée garde au moins 5 km de relief au vent de la zone A dans toutes les directions (portée du dévent dans `js/wind.js`) et de l'eau libre à l'ouest du goulet. Le Menez-Hom (323 m lus sur les tuiles, à 10,5 km au sud-est de la zone A) est juste au coin sud-est : étendre à −4,20 et 48,20 l'inclut entièrement (+14 % de cellules) ; utilité incertaine [ASSUMED].
- Origine de projection conseillée pour Brest : le centre de la zone A (48,298 N, 4,3605 W) ou le centre de la rade (48,33 N, 4,45 W) ; sans effet sur la précision à cette échelle [ASSUMED].
- Coût du champ de vent : 1,55 fois celui de Toulon par direction (33 635 cellules contre 21 679). Si la mesure d'ouverture (`tools/measure-boot.mjs`) le juge trop lent sur téléphone, passer la maille à 180 m pour Brest donne 181 × 129 = 23 349 cellules, le coût de Toulon ; la maille doit alors devenir un paramètre du plan d'eau, valeur 150 conservée à Toulon.
- Autres fichiers, estimés par règle de trois sur Toulon : `coast.json` 150 à 250 ko (la côte de la rade est deux à trois fois plus longue : 206 km relevés sur un échantillon incomplet), `basemap.jpg` 0,6 à 0,8 Mo, `seamask.png` 150 à 250 ko [ASSUMED]. Total du pack avec marée et courants (§ 6) : environ 5 Mo, au-dessus de l'hypothèse A5 de `07-RESEARCH.md` (2,5 à 3,5 Mo).

### 1.2 Disponibilité des sources (échantillons téléchargés)

| Source | Résultat | Détail |
|--------|----------|--------|
| Tuiles d'altitude Terrarium, zoom 13 | Disponible | 121 tuiles (x 3989 à 3999, y 2832 à 2842) téléchargées depuis `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png`, 6,9 Mo, toutes lisibles ; 12,7 m par pixel à cette latitude ; l'emprise conseillée demande x 3989 à 3999 et y 2832 à 2840, soit 99 tuiles [VERIFIED: téléchargement et décodage de cette session] |
| Bathymétrie EMODnet (couche `emodnet:mean`) | Disponible | `https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=emodnet:mean&crs=EPSG:4326&BBOX=-4.70,48.20,-4.20,48.45&format=image/tiff&interpolation=nearest&resx=0.00104166666&resy=0.00104166666` rend un TIFF 480 × 240 en flottants, sans valeur manquante ; pour ce fichier `BL0, BT0, BD = -4.70, 48.45, 1/960` [VERIFIED: téléchargement de cette session]. Profondeurs rapportées à la plus basse mer astronomique [CITED: fiches EMODnet DTM sur sextant.ifremer.fr, « depths referring to the Lowest Astronomical Tide Datum - LAT », maille « ca 115 * 115 meters »] |
| OpenStreetMap par Overpass | Injoignable depuis cet environnement | Quatre miroirs essayés (connexion coupée, délai dépassé, 504, 403) : aucune observation sur le contenu ; à lancer depuis une machine qui y a accès [VERIFIED: sortie des commandes de cette session] |
| OpenStreetMap par l'API principale | Disponible, par petites boîtes | 34 boîtes de 0,04° × 0,02° sur l'eau : 80 Mo, 155 299 nœuds, 158 marques et amers, 81 tronçons de côte (206 km) [VERIFIED]. Limitée à de petites zones : ne remplace pas Overpass pour toute l'emprise |

Fonds lus dans l'échantillon EMODnet (m sous le zéro des cartes) : goulet au droit du Portzic −33, rade au centre −12, nord de l'Île Longue −23, baie de Roscanvel −10, zone A −8,7, zone B −4,8, Moulin Blanc −4,8 [VERIFIED: lecture du TIFF]. 14 % de la surface en eau de l'emprise a moins de 2 m sous le zéro des cartes, 30 % moins de 5 m [VERIFIED: calcul sur le TIFF]. EMODnet reste grossier près des côtes (le script de Toulon le dit déjà en commentaire) : voir § 4.6.

Requête Overpass à utiliser (non exécutée ici) : `way["natural"="coastline"]`, `way["man_made"~"breakwater|pier|groyne"]`, `way["landuse"~"residential|industrial|commercial|military|harbour"]` sur la boîte `(48.20,-4.70,48.45,-4.18)`, sortie `out geom`, puis conversion vers la forme attendue par les outils [ASSUMED pour les valeurs d'étiquettes ; la forme du fichier est vérifiée ci-dessus].

### 1.3 Reliefs qui comptent pour le vent

Altitude maximale lue sur les tuiles dans un rayon de 500 m à 2,5 km autour d'une position approchée de chaque relief [VERIFIED: mosaïque Terrarium de cette session ; positions entre parenthèses d'après OpenStreetMap] :

| Relief | Altitude max | Rôle |
|--------|--------------|------|
| Pointe des Espagnols (48,3418 N, 4,5319 W) | 78 m dans 600 m | Rive sud du goulet, sortie vers la rade |
| Presqu'île de Roscanvel, crête | 74 m | Abrite la baie de Roscanvel et la zone F des vents d'ouest |
| Pointe du Portzic (48,3579 N, 4,5335 W) et plateau de Sainte-Anne | 63 m, 93 m sur le plateau | Rive nord du goulet |
| Pointes du Petit Minou et du Grand Minou | 60 m, 70 m | Entrée nord du goulet |
| Pointe des Capucins (48,3191 N, 4,5801 W) | 65 m | Entrée sud du goulet |
| Île Longue | 35 m | Basse ; peu d'effet sur le vent |
| Lanvéoc : pointe, bourg, base aéronavale | 42 m, 84 m, 89 m | Falaise et plateau au sud de la zone B |
| École navale (Poulmic) et crête au sud | 79 m, 89 m | Dévent de la zone B par vents de sud à ouest |
| Forêt de Landévennec | 117 m | Sud-est de la zone A |
| Collines d'Argol | 178 m | Sud-est, à 6 km |
| Menez-Hom | 323 m | Seul vrai sommet, à 10,5 km au sud-est de la zone A |
| Presqu'île de Plougastel : Pointe de l'Armorique, plateau, bourg | 45 m, 99 m, 130 m | Sépare la rade nord de la rade sud |
| Logonna-Daoulas, Pointe du Bindy | 54 m, 30 m | Nord-est de la zone A |
| Brest : château, plateau, aéroport de Guipavas | 51 m, 104 m, 99 m | Côte nord |

Indice de dévent de l'app (formule de `js/wind.js`, relief cherché sur 5 km au vent, un seul rayon par direction) calculé au centre des zones, pour comparaison avec Toulon [VERIFIED: calcul de cette session sur la mosaïque Terrarium et sur `data/terrain.bin`] :

| Vent venant du | Zone A (J80) | Zone B (Poulmic) | Goulet (Mengam) | Toulon, ligne des Vignettes |
|----------------|--------------|------------------|-----------------|------------------------------|
| 000° | 0,00 | 0,12 | 0,27 | 0,49 (487 m à 5 km) |
| 030° | 0,00 | 0,00 | 0,18 | 0,33 |
| 060° | 0,05 | 0,00 | 0,00 | 0,40 |
| 090° | 0,00 | 0,12 | 0,22 | 0,07 |
| 120° | 0,24 (93 m à 3,0 km) | 0,23 | 0,30 | 0,00 |
| 150° | 0,26 (62 m à 1,8 km) | 0,30 | 0,34 | 0,00 |
| 180° | 0,24 (75 m à 2,4 km) | 0,32 | 0,25 | 0,00 |
| 210° | 0,19 (76 m à 3,2 km) | 0,30 | 0,00 | 0,18 |
| 240° | 0,04 | 0,31 | 0,00 | 0,00 |
| 270° | 0,00 | 0,34 (43 m à 0,8 km) | 0,14 | 0,03 |
| 300° | 0,00 | 0,31 | 0,30 | 0,12 |
| 330° | 0,06 | 0,00 | 0,23 | 0,26 |

La perte de vent appliquée par l'app vaut la moitié de l'indice. Lecture : la zone A est dégagée de l'ouest au nord-est et déventée de 10 à 13 % par vent de sud-est à sud-sud-ouest (collines de Lanvéoc à Landévennec, à 1,8 à 3,2 km) ; la zone B est déventée de 15 à 17 % par tous les vents de sud à nord-ouest.

## 2. Repères et zones

### 2.1 Lieux nommés (pour `PLACES` du pack)

Positions des nœuds OpenStreetMap téléchargés dans cette session [VERIFIED: API OpenStreetMap, ODbL], type selon la convention de `js/courses.js`.

| Nom | Lat N | Lon (négatif = Ouest) | Type |
|-----|-------|------------------------|------|
| Pointe du Grand Minou | 48,3381 | −4,6271 | 2 |
| Pointe du Petit Minou (phare) | 48,3363 | −4,6146 | 2 |
| Pointe du Toulinguet (phare, 49 m) | 48,2801 | −4,6269 | 2 |
| Pointe du Grand Gouin | 48,2880 | −4,6011 | 2 |
| Pointe des Capucins | 48,3191 | −4,5801 | 2 |
| Pointe de Cornouaille | 48,3301 | −4,5700 | 2 |
| Pointe du Dellec | 48,3521 | −4,5672 | 2 |
| Pointe du Diable | 48,3545 | −4,5586 | 2 |
| Pointe Robert | 48,3378 | −4,5542 | 2 |
| Pointe du Portzic (phare) | 48,3579 | −4,5335 | 2 |
| Pointe des Espagnols | 48,3418 | −4,5319 | 2 |
| Pointe de Lanvéoc | 48,2947 | −4,4606 | 2 |
| Pointe de l'Armorique | 48,3270 | −4,4592 | 2 |
| Pointe du Caro | 48,3367 | −4,4502 | 2 |
| Pointe de Kerdéniel | 48,3254 | −4,4481 | 2 |
| Pointe du Corbeau | 48,3494 | −4,4447 | 2 |
| Pointe Marloux | 48,3599 | −4,4369 | 2 |
| Penn ar Vir | 48,2944 | −4,4185 | 2 |
| Pointe de Doubidy | 48,3244 | −4,4182 | 2 |
| Pointe de Lomergat | 48,2861 | −4,3536 | 2 |
| Pointe de Bendy (du Bindy) | 48,3129 | −4,3398 | 2 |
| Pointe d'Hanvec | 48,3131 | −4,2820 | 2 |
| Île Ronde | 48,3238 | −4,4622 | 2 |
| Roscanvel | 48,3153 | −4,5488 | 1 |
| Le Fret | 48,2856 | −4,5091 | 1 |
| Lanvéoc | 48,2867 | −4,4615 | 1 |
| Baie de Camaret | 48,2847 | −4,5822 | 4 |
| Anse de Sainte-Anne-du-Portzic | 48,3599 | −4,5494 | 4 |
| Anse du Dellec | 48,3548 | −4,5633 | 4 |
| Baie de Roscanvel | 48,3090 | −4,5295 | 4 |
| Anse du Fret | 48,2912 | −4,4961 | 4 |
| Anse du Caro | 48,3426 | −4,4448 | 4 |
| Anse de Poulmic | 48,2816 | −4,3966 | 4 |
| Baie de Daoulas | 48,3250 | −4,3493 | 4 |

À relever lors de l'extraction complète, hors des boîtes téléchargées : Brest, Plougastel-Daoulas, Le Relecq-Kerhuon, Landévennec, Camaret-sur-Mer, Crozon, Logonna-Daoulas, Menez-Hom (sommet, environ 48,220 N, 4,234 W [ASSUMED]), École navale, Moulin Blanc. La terre la plus proche du centre de la zone A est la Pointe de Lomergat, à 1 430 m dans le 152° [VERIFIED: masque de l'atlas du Shom].

### 2.2 Marques, feux et dangers

Deux sources indépendantes relues ici : les IC du GPEN 2026 (annexe 3.4, positions officielles de l'organisation) et OpenStreetMap. Elles concordent à mieux que 15 m, sauf mention.

| Marque | Type | Position IC GPEN 2026 | Position OpenStreetMap | Feu (OSM) |
|--------|------|-----------------------|-------------------------|-----------|
| Plateau des Fillettes | Cardinale ouest (bouée) | 48°19,752 N 004°35,654 W | 48°19,758 N 004°35,653 W | VQ(9) 10 s |
| Roche Mengam | Danger isolé (tourelle) | 48°20,330 N 004°34,560 W | 48°20,325 N 004°34,552 W | Fl(3) R 12 s |
| Kerviniou | Latérale bâbord | 48°19,779 N 004°35,240 W | 48°19,788 N 004°35,193 W (écart 60 m) | Fl R 2,5 s |
| Basse Goudron | Latérale bâbord | — | 48°20,035 N 004°34,827 W | Fl(2) R 6 s |
| La Cormorandière | Balise blanche devant la Pointe des Espagnols | 48°20,609 N 004°31,780 W | 48°20,612 N 004°31,775 W | — |
| Pénoupèle (« Basse Pennou Pell ») | Latérale bâbord | 48°21,444 N 004°30,520 W | 48°21,400 N 004°30,500 W (écart 85 m) | Fl(3) R 2,5 s |
| Basse du Renard | Cardinale ouest | 48°19,760 N 004°29,070 W | 48°19,755 N 004°29,078 W | VQ(9) 10 s |
| Île Ronde | Îlot | 48°19,243 N 004°27,877 W | 48,3238 N, 4,4622 W (nœud de lieu) | — |
| Duc d'Albe de Lanvéoc | Cardinale nord | 48°17,840 N 004°27,150 W | 48°17,838 N 004°27,145 W | VQ |
| Penn ar Vir | Cardinale nord | — | 48°17,754 N 004°24,883 W | Q |
| Lanvéoc 1, 3, 5 | Latérales tribord | — | 48°19,065 N 004°28,684 W ; 48°18,793 N 004°28,361 W ; 48°18,500 N 004°28,550 W | Fl G 4 s ; Fl(5) G 20 s ; Fl(3) G 12 s |
| Lanvéoc 4 | Latérale bâbord | — | 48°17,946 N 004°28,496 W | VQ R |
| Île Longue Est | Latérale bâbord | — | 48°18,297 N 004°29,615 W | Fl(2) R 6 s |
| Aulne n° 4 | Latérale bâbord | — | 48°18,391 N 004°22,159 W | — |
| Aulne n° 6 | Latérale bâbord | 48°18,505 N 004°20,719 W | 48°18,506 N 004°20,725 W | — |
| Aulne n° 8, 10, 12, 14, 16 | Latérales bâbord | — | 48°18,719 N 004°19,263 W ; 48°18,671 N 004°18,712 W ; 48°18,495 N 004°17,986 W ; 48°18,299 N 004°17,529 W ; 48°18,183 N 004°15,918 W | — |
| Aulne n° 1, 3, 5, 7 | Latérales tribord | — | 48°18,597 N 004°18,898 W ; 48°18,428 N 004°17,955 W ; 48°18,251 N 004°17,736 W ; 48°18,065 N 004°16,098 W | — |
| Océanopolis | Latérale tribord | 48°22,520 N 004°26,730 W | 48°22,519 N 004°26,731 W | Iso G 4 s |
| R1, R3 | Latérales tribord (chenal « R », devant le port de Brest) | — | 48°21,836 N 004°28,284 W ; 48°22,301 N 004°27,430 W | Fl(2) G 6 s ; Fl(3) G 12 s |
| R2, R4, R6 | Latérales bâbord | — | 48°22,015 N 004°28,739 W ; 48°22,290 N 004°27,917 W ; 48°22,552 N 004°27,862 W | Fl(2) R 6 s ; Fl(3) R 12 s ; Fl R 4 s |
| Forme 3 | Cardinale sud | — | 48°22,481 N 004°27,356 W | Q(6)+LFl 15 s |
| Pen a Lan (roches Le Bouc, La Chèvre) | Cardinale est (tourelle) | — | 48°19,520 N 004°22,185 W | — |
| Les Ménéziou | Danger isolé (tourelle) | — | 48°20,337 N 004°20,532 W | — |
| L'Évêque, La Coët | Amer blanc, roche | — | 48°18,735 N 004°20,338 W ; 48°18,737 N 004°20,481 W | — |
| Phare du Portzic | Feu principal | — | 48°21,497 N 004°32,040 W | Oc(2) R 12 s |
| Phare du Petit Minou | Feu principal directionnel | — | 48°20,199 N 004°36,853 W | Fl(2) R 6 s |
| Phare du Toulinguet | Feu principal | — | 48°16,811 N 004°37,714 W | Oc(3) 12 s |
| Passe Sud du port militaire | Feu | — | 48°22,106 N 004°29,442 W | Q R |
| Épave « Furieux » | Épave non dangereuse | — | 48°19,169 N 004°25,912 W | — |

[VERIFIED: positions IC lues dans le PDF des IC 2026 ; positions et feux lus dans les nœuds `seamark:*` d'OpenStreetMap]. Les caractères de feux viennent d'OpenStreetMap seul : à contrôler sur le livre des feux ou la carte avant affichage [ASSUMED pour leur exactitude]. Autour de la zone A, la bouée n° 4 du chenal de l'Aulne est à 0,6 mille au nord-nord-ouest du centre, sur le bord du cercle, et la n° 6 à 0,9 mille au nord-est : le chenal longe le nord de la zone.

Marques extérieures utiles seulement si l'app couvre un jour les côtiers de Camaret (hors périmètre D-09) : Pelen, La Louve, Mendufa, Charles Martel, Trépied, La Parquette, Le Goëmant, La Fourmi, Vandrée, Le Bouc, Coq Iroise : positions dans les IC 2026 annexe 3.4 [CITED].

### 2.3 Zones interdites et réglementées

| Zone | Ce que disent les sources | Positions |
|------|---------------------------|-----------|
| Île Longue | « La navigation autour de l'Ile longue dans la zone balisée par les marques spéciales numérotées de 0 à 10 est formellement interdite. » [CITED: IC GPEN 2026, annexe 5] | Bouées jaunes relevées dans OpenStreetMap [VERIFIED: nœuds `buoy_special_purpose`] : n° 0 48°17,870 N 004°31,430 W ; n° 1 48°18,027 N 004°31,283 W ; n° 2 48°18,263 N 004°31,083 W ; n° 2 bis 48°18,417 N 004°30,949 W ; n° 3 48°18,575 N 004°30,815 W ; n° 3 bis 48°18,665 N 004°30,742 W ; n° 4 48°18,822 N 004°30,601 W ; n° 5 48°18,834 N 004°30,234 W ; n° 6 48°18,852 N 004°29,848 W ; n° 6 bis 48°18,779 N 004°29,651 W ; n° 7 48°18,549 N 004°29,503 W ; bouée « D » (entrée interdite, Fl Y 4 s) 48°18,685 N 004°29,451 W. Les n° 8 à 10 ne sont pas dans l'échantillon : à relever sur la carte |
| Passage de Pen ar Vir | « Dans tous les parcours, il est interdit de naviguer entre la marque cardinale Pen Ar Vir et la pointe du même nom. » [CITED: IC GPEN 2026, annexe 5] | Cardinale 48°17,754 N 004°24,883 W ; pointe 48,2944 N, 4,4185 W ; 330 m entre les deux [VERIFIED: OpenStreetMap] : couloir à tracer en polygone étroit |
| Port militaire de Brest, École navale, abords de l'Île Longue | « les principales zones où la navigation est strictement interdite » [CITED: bateaux.com, F.-X. Ricardou, 27/09/2022] | Limites exactes non trouvées : arrêtés de la préfecture maritime de l'Atlantique non retrouvés en ligne dans cette session (aucune observation) |
| Cimetière de navires de Landévennec | Amarrage interdit aux coques de la Marine, bouées jaunes [CITED: même article] | Hors de la zone A, dans le méandre de l'Aulne |

Pour le routage (D-10) : le polygone de l'Île Longue se ferme en reliant les bouées dans l'ordre et en s'appuyant sur le rivage de part et d'autre ; il faut le dessiner sur une carte marine avant de le figer, car le côté est (vers Le Fret) n'est pas renseigné ici. La zone de l'Île Longue est à une dizaine de kilomètres à l'ouest de la zone A : sans effet sur les parcours J80, utile pour l'entraînement libre et les convoyages.

Chenaux : passe nord et passe sud du goulet de part et d'autre du plateau des Fillettes et de la roche Mengam ; chenal « R » devant le port de Brest (R1 à R6) ; chenal de Lanvéoc (L1 à L5) vers la base ; chenal de l'Aulne (n° 1 à 16) [VERIFIED pour l'existence et la position des marques ; ASSUMED pour les règles de priorité propres au trafic militaire et de commerce, à lire dans les instructions nautiques].

## 3. Vents

### 3.1 Climatologie de mai (mesurée)

Calcul de cette session sur les « Données climatologiques de base - horaires » de Météo-France pour le Finistère (Licence Ouverte 2.0), 17 mois de mai de 2010 à 2026, heures de course de 11 h à 18 h locales (09 à 16 UTC), vent moyen sur 10 min à 10 m [VERIFIED: fichiers `H_29_2010-2019`, `H_29_previous-2020-2024`, `H_29_latest-2025-2026` de data.gouv.fr]. Stations : Lanvéoc `29120001` (48,2793 N, 4,4393 W, 81 m), Brest-Guipavas `29075001` (48,4538 N, 4,3912 W, 92 m), Plougonvelin `29190001` (Pointe Saint-Mathieu, 22 m), Camaret `29022001` (données de vent jusqu'en 2019).

| | Lanvéoc (4 209 heures) | Brest-Guipavas (4 213 heures) | Plougonvelin (3 469 heures) |
|---|---|---|---|
| Vent moyen, médiane | 9,9 nd ; 9,7 nd | 10,6 nd ; 10,3 nd | 12,9 nd ; 12,4 nd |
| Quartiles ; 90e centile ; maximum | 6,8 à 12,2 ; 15,2 ; 27 nd | 7,6 à 13,2 ; 16,3 ; 31 nd | 7,8 à 16,9 ; 21,8 ; 36 nd |
| Moins de 4 nd | 5 % | 5 % | 6 % |
| 4 à 7 nd | 22 % | 17 % | 16 % |
| 7 à 11 nd | 36 % | 36 % | 20 % |
| 11 à 17 nd | 31 % | 34 % | 34 % |
| 17 à 22 nd | 4 % | 7 % | 15 % |
| 22 nd et plus | 1 % | 1 % | 9 % |

Répartition par secteur d'où vient le vent (fréquence, force moyenne) :

| Secteur | Lanvéoc | Brest-Guipavas |
|---------|---------|----------------|
| Nord | 15 % (9 nd) | 18 % (9 nd) |
| Nord-est | 14 % (10 nd) | 18 % (12 nd) |
| Est | 9 % (7 nd) | 6 % (9 nd) |
| Sud-est | 3 % (9 nd) | 4 % (8 nd) |
| Sud | 12 % (10 nd) | 12 % (11 nd) |
| Sud-ouest | 13 % (12 nd) | 14 % (13 nd) |
| Ouest | 20 % (11 nd) | 15 % (11 nd) |
| Nord-ouest | 15 % (9 nd) | 13 % (9 nd) |

Lecture : pas de vent dominant net en mai. Trois familles se partagent le mois : ouest à nord (50 % à Lanvéoc), sud à sud-ouest (25 %), nord-est à est (23 %). La force est modérée : sept heures de course sur dix entre 7 et 17 nd, une sur vingt au-dessus de 17 nd, une sur quatre sous 7 nd. La plage de 25 nd de l'app suffit (maximum relevé à Lanvéoc : 27 nd). Les stations sont sur les plateaux, à 81 et 92 m : le vent au ras de l'eau en rade est en général plus faible et plus irrégulier [ASSUMED pour l'écart].

Cycle de la journée à Lanvéoc (moyenne de tous les jours de mai) : 6,9 nd à 08 h locales, 9,8 nd à 14 h, 10,6 nd à 16 h, 9,4 nd à 20 h, 7,1 nd à minuit [VERIFIED: même calcul]. Rafales : le rapport entre la rafale maximale de l'heure et le vent moyen a une médiane de 1,69 à Lanvéoc (90e centile 2,03) ; ce rapport n'est pas comparable au facteur de rafale des modèles (rafale maximale d'une heure entière).

Lanvéoc comparé à Guipavas aux mêmes heures (vent d'au moins 8 nd à Guipavas) [VERIFIED: même calcul] :

| Vent à Guipavas | Heures | Direction à Lanvéoc | Force à Lanvéoc |
|-----------------|--------|---------------------|------------------|
| Nord | 465 | 10° plus à gauche | × 0,94 |
| Nord-est | 613 | identique | × 0,73 |
| Est | 139 | 10° plus à gauche | × 0,73 |
| Sud-est | 89 | identique | × 0,93 |
| Sud | 336 | 10° plus à gauche | × 0,85 |
| Sud-ouest | 475 | identique | × 0,89 |
| Ouest | 459 | identique | × 1,13 |
| Nord-ouest | 360 | 10° plus à gauche | × 1,04 |

Le sud de la rade reçoit un quart de vent en moins que le plateau nord par vent de nord-est et d'est, et un peu plus par vent d'ouest. Les directions sont arrondies à 10° dans les fichiers : un écart de 10° est à la limite de ce que la mesure distingue.

### 3.2 Brise thermique (mesurée)

Journées « de brise » : moins de 6 nd en moyenne de 08 à 10 h locales, au moins 3 nd de plus de 15 à 18 h, moins de 16 nd. À Lanvéoc, 142 journées sur 523 journées de mai complètes, soit 27 % [VERIFIED: même jeu de données ; le critère ne regarde pas l'ensoleillement, c'est une approximation].

| Heure locale | Force moyenne | Secteurs les plus fréquents |
|--------------|---------------|------------------------------|
| 08 h | 3,5 nd | Est 25 %, nord-est 18 %, nord 17 % |
| 10 h | 4,4 nd | Est 21 %, nord 20 % |
| 12 h | 5,8 nd | Nord-ouest 23 %, nord 17 %, sud 17 % |
| 14 h | 7,2 nd | Nord-ouest 23 %, nord 19 %, ouest 17 % |
| 16 h | 9,3 nd | Ouest 35 %, nord 15 %, nord-ouest 14 %, sud-ouest 14 % |
| 18 h | 9,7 nd | Ouest 38 %, nord-ouest 18 % |
| 20 h | 8,3 nd | Ouest 25 %, nord 23 %, nord-ouest 19 % |

- La brise s'installe tard : première heure à 7 nd ou plus répartie de 10 h à 17 h locales, surtout de 11 h à 16 h, le plus souvent à 15 h (21 % des cas) ; maximum de 17 à 18 h, 9 à 10 nd. Cela recoupe « la brise thermique qui de 16 à 17 heures les jours de grand soleil et de pétole » [CITED: bateaux.com, F.-X. Ricardou, 27/09/2022].
- Direction : ouest à Lanvéoc (brise d'Iroise qui entre par le goulet et par-dessus la presqu'île) ; à Guipavas les mêmes jours le vent de l'après-midi est de nord (25 %), nord-ouest (23 %) ou nord-est (19 %), venu de la Manche. La rade est entre deux brises.
- Selon le vent du matin : matin d'est (23 journées), après-midi d'ouest dans 48 % des cas : bascule d'un demi-tour avec une zone sans vent ; matin de nord-ouest (20 journées), après-midi de nord-ouest (50 %) ou d'ouest (35 %) : simple renforcement ; matin de nord-est (25 journées), le nord-est tient dans 28 % des cas.
- Pas de rotation régulière une fois la brise établie : entre 14 h et 18 h locales, rotation médiane de 0°, à droite de plus de 10° dans 32 % des cas, à gauche dans 28 %. À Toulon le conseil actuel dit que la brise « tourne en général progressivement vers la droite » : ce conseil ne se transpose pas à Brest.

### 3.3 Noms et comportements, effets de site

- Noms usuels en Bretagne pour les secteurs : suroît (sud-ouest), noroît (nord-ouest), nordet (nord-est), suet (sud-est) ; en breton gwalarn (nord-ouest), mervent (sud-ouest), kornog (ouest), reter (est), biz (nord-est) [ASSUMED]. Aucun vent régional nommé comme le mistral ne commande le plan d'eau.
- « La rade de Brest est une vraie rade enclavée, entourée de reliefs qui, bien que pas vraiment « montagnards », sont suffisants pour être déterminants dans le régime des vents. » ; influence des vents d'ouest et « effets « de couloir » des deux estuaires principaux : l'Elorn et l'Aulne » ; « régimes de vents assez différents en rade sud et rade nord (séparées par la presqu'île de Plougastel) » ; « les effets thermiques sont également très présents » [CITED: livret « Rade de Brest », voileaviron.org, 2019].
- Par secteur, même source : nord, « très perturbé par l'effet « vent de terre » » ; nord-est à est, « moins perturbés, mais accélérés par effet de « couloir » », avec « vent contre courant dans les estuaires » ; sud-est à sud-ouest, « perturbés par les reliefs de Crozon, les vents peuvent s'accélérer vers la baie de Roscanvel » [CITED: même livret]. Goulet : régime « encore plus complexe que dans la rade, avec de possibles changements significatifs entre l'entrée et la sortie » [CITED: même livret].
- « Les vents dans la rade sont très instables tant en force qu'en direction. » [CITED: bateaux.com, 27/09/2022].
- L'axe du goulet est est-nord-est à ouest-sud-ouest (le courant y porte au 077° au flot et au 272° au jusant, § 4.3) : un vent de sud-ouest ou d'ouest y est canalisé vers Brest et l'Elorn [VERIFIED pour l'axe ; ASSUMED pour l'ampleur de la canalisation du vent].
- L'article de référence « La rade de Brest (2) : vents et brises » de Voiles et Voiliers, cité par le livret, n'a pas pu être lu (accès refusé) : aucune observation sur son contenu. À lire avant de figer les conseils.

### 3.4 Ce qui diffère de Toulon

| Sujet | Toulon | Brest | Conséquence |
|-------|--------|-------|-------------|
| Hauteur du relief | Faron 584 m, Coudon 702 m [VERIFIED: js/courses.js:11] | 60 à 130 m autour de la rade, 323 m au Menez-Hom à 10 km [VERIFIED: tuiles] | Dévents plus courts et moins profonds ; perméabilité `exp(-h/110)` de 0,4 à 0,6 pour presque toutes les terres au lieu de 0,04 pour le Faron |
| Distance à la terre | Large ouvert au sud | Aucune cellule d'eau à plus de 3,7 km d'une terre dans l'emprise ; 2,8 km au plus dans la rade ; zone A à 1,4 km [VERIFIED: calcul sur EMODnet, terre = au-dessus du zéro des cartes] | La référence « au large » à plus de 4 000 m de `js/wind.js:107` ne trouve aucune cellule (ou quelques-unes à l'ouest du goulet avec le trait de côte d'OpenStreetMap, ce qui ne vaut pas mieux) : voir piège 1 |
| Part de terre | — | 70 % de l'emprise conseillée [VERIFIED: même calcul] | L'écoulement du modèle se concentre dans l'eau : accélération générale à corriger par la référence |
| Vent fort dominant | Mistral, ouest | Aucun ; 5 % des heures de course de mai au-dessus de 17 nd [VERIFIED] | Régimes à redéfinir par secteur, sans seuil de force du type mistral |
| Brise | Sud-ouest, tourne à droite | Ouest, tardive, sans rotation régulière ; bascule d'un demi-tour après un matin d'est [VERIFIED] | Conseils de bascule différents |
| Mer | Houle du large qui entre | Plan d'eau fermé : clapot levé par le vent sur 2 à 10 km, durci par le courant contraire [ASSUMED pour la houle] | La carte « État de la mer » d'Open-Meteo renvoie la houle du large (2,8 à 3,1 m au point de la zone A le 19/11/2026 [VERIFIED: réponse de l'API relue]) : à masquer ou à étiqueter « Iroise » |
| Courant | Faible, ignoré | Voir § 4 | Tout le § 4 |

### 3.5 Adaptations de `js/wind.js`

1. **Référence de normalisation** (nécessaire) : rendre le seuil de 4 000 m paramétrable par plan d'eau (valeur conservée à Toulon), par exemple 1 500 m pour Brest, ou la médiane de toute l'eau. Sans cela `ref` vaut 1 et le facteur d'accélération est gonflé partout.
2. **Maille** (selon mesure) : `CELL` paramétrable, 150 m à Toulon, 150 ou 180 m à Brest.
3. **Formules de dévent, blocage, frottement** : utilisables telles quelles ; elles donnent à Brest des valeurs plausibles (tableau du § 1.3). Le commentaire du blocage cite une observation à Saint-Mandrier : à Brest il n'est pas validé [ASSUMED].
4. **Vent sur l'eau** (souhaitable, lié au courant) : le bateau navigue dans le vent relatif à l'eau, vent au sol moins courant. Avec 0,75 nd de courant et 8 nd de vent, cela change la force de 0,75 nd (9 %) quand ils sont alignés et la direction de 5° quand ils sont en travers. À calculer dans le routage, pas dans `WindField`.
5. **Oscillations** (`shiftAmplitude`) : inchangé faute de mesure locale [ASSUMED].

### 3.6 Proposition de `REGIMES` pour Brest (`js/tactics.js`, D-14)

Même forme que l'existant (`id`, `name`, `test`, `tips`). Origine de chaque conseil : (D) donnée mesurée ici, (M) calcul avec le modèle de relief de l'app, (C) courant de l'atlas, (S) source citée, (H) hypothèse à valider sur l'eau. Les conseils (H) ne doivent pas être présentés à l'équipage comme établis.

| `id` | Nom | Test (direction d'où vient le vent, force) | Conseils proposés |
|------|-----|--------------------------------------------|-------------------|
| `calme` | Calme / très petit temps | `s < 4` | Par beau temps et vent du matin d'est ou de nord-est, la brise d'ouest s'installe entre 13 h et 16 h : zone sans vent puis demi-tour, le nouveau vent arrive par l'ouest (D). Sous 5 nd le courant décide : 0,75 nd de courant vaut un cinquième de la vitesse (C). Mouiller ou rester dans le courant faible quand il est contraire (H). |
| `suroit` | Suroît (sud-ouest) | `d >= 200 && d < 250` | Régime perturbé, le plus fort en moyenne (12 nd) (D). Zone A : le vent passe par-dessus les collines de Lanvéoc (75 à 90 m à 2,4 à 3,2 km), 10 % de vent en moins et des trous dans le sud du cercle (M). Zone B très abritée (M). Mer plate près de la côte sud (H). |
| `ouest` | Ouest | `d >= 250 && d < 290` | Secteur le plus fréquent (20 %) (D). Zone A dégagée, 8 à 10 km d'eau au vent : vent plus régulier, clapot (M). C'est aussi la direction de la brise de l'après-midi (D). Vent contre courant pendant le jusant (le jusant porte à l'ouest) : clapot plus dur (C). |
| `noroit` | Noroît (nord-ouest) | `d >= 290 && d < 340` | Le vent vient de la presqu'île de Plougastel (45 à 130 m) : zone A peu abritée (indice 0 à 0,06) (M). Ciel de traîne : grains et rafales (H). |
| `nord` | Nord | `d >= 340 \|\| d < 20` | « Très perturbé par l'effet vent de terre » (S). Zone A à 2 à 4 km sous le vent de Logonna et de la baie de Daoulas : oscillations, risées par paquets (H). |
| `nordet` | Nordet (nord-est) | `d >= 20 && d < 70` | Fréquent par temps anticyclonique (14 à 18 %) (D). Un quart de vent en moins dans le sud de la rade que sur le plateau de Guipavas (D). Vent de terre, rafales et rotations (H). |
| `est` | Est | `d >= 70 && d < 120` | Vent canalisé par l'estuaire de l'Aulne (S). Vent contre courant pendant le flot (le flot porte à l'est) (C). Force moyenne faible (7 nd à Lanvéoc) (D). |
| `sud` | Sud et sud-est | `() => true` (reste : 120 à 200) | Le plus perturbé en zone A : relief de 62 à 93 m à 1,8 à 3 km, indice de dévent 0,24 à 0,26 (M). Plus de pression dans le nord du cercle, plus loin de la côte sud (M, H). « Les vents peuvent s'accélérer vers la baie de Roscanvel » (S). Sud-est rare (3 %) (D). |

Vents prédéfinis proposés pour la saisie manuelle (forme de `PRESETS`, `js/app.js:1790`) : `['Suroît', 225, 14, 20]`, `['Ouest', 270, 12, 17]`, `['Brise d’ouest', 275, 9, 12]`, `['Noroît', 315, 12, 18]`, `['Nord', 0, 9, 14]`, `['Nordet', 45, 12, 17]`, `['Est', 90, 8, 12]`, `['Sud', 180, 10, 15]`, `['Petit temps', 90, 4, 6]` : forces prises sur les moyennes mesurées, rafales [ASSUMED].

## 4. Marées et courants

### 4.1 Niveaux et marnage (Références Altimétriques Maritimes du Shom)

Hauteurs en mètres au-dessus du zéro hydrographique [VERIFIED: service WFS du Shom, couche `RAM_BDD_WLD_WGS84G_WFS:ram_3857`, Licence Ouverte 2.0, interrogé dans cette session] :

| Port | PHMA | PMVE | PMME | NM | BMME | BMVE | PBMA | Marnage vive-eau | Marnage morte-eau |
|------|------|------|------|----|------|------|------|-------------------|--------------------|
| **Brest** (port de référence) | 7,93 | 7,05 | 5,50 | 4,14 | 2,70 | 1,15 | 0,25 | **5,90** | **2,80** |
| Le Dellec (goulet) | 7,76 | 6,85 | 5,35 | 3,99 | 2,65 | 1,15 | 0,30 | 5,70 | 2,70 |
| Camaret-sur-Mer | 7,45 | 6,60 | 5,15 | 3,83 | 2,45 | 1,00 | 0,07 | 5,60 | 2,70 |
| Moulin Blanc | 8,03 | 7,15 | 5,60 | 4,21 | 2,75 | 1,20 | 0,29 | 5,95 | 2,85 |
| Tinduff (le plus proche de la zone A) | 8,15 | 7,30 | 5,70 | 4,27 | 2,85 | 1,20 | 0,25 | 6,10 | 2,85 |
| Pont de Térénez (Aulne) | 8,39 | 7,45 | 5,85 | 4,43 | 2,90 | 1,30 | 0,32 | 6,15 | 2,95 |
| Morgat | 7,50 | 6,65 | 5,20 | 3,88 | 2,55 | 1,05 | 0,26 | 5,60 | 2,65 |

La marée s'amplifie vers le fond de la rade : la pleine mer de vive-eau est 0,25 m plus haute à Tinduff qu'à Brest. Niveau moyen observé à Brest de 2019 à 2024 : 4,25 m [VERIFIED: moyenne des hauteurs horaires validées], soit 11 cm au-dessus du niveau moyen de référence.

### 4.2 Heures et hauteurs : calcul par harmoniques, vérifié

Méthode essayée dans cette session [VERIFIED: calculs et sorties de cette session] :

1. Téléchargement des hauteurs horaires validées du marégraphe de Brest (station 3, source 4) de janvier 2019 à septembre 2026 : 66 953 heures, par l'adresse `https://services.data.shom.fr/maregraphie/observation/json/3?sources=4&dtStart=…&dtEnd=…&interval=60` (31 jours au plus par requête). Licence Ouverte 2.0, source à citer « Shom – REFMAR » [CITED: fiche du catalogue du Shom « Réseaux de référence des observations marégraphiques (REFMAR) - Marégraphes RONIM »].
2. Ajustement harmonique sur 2019-2024 (51 642 heures) avec corrections nodales : 68 constituants. Principaux, amplitude en m et situation en degrés (temps universel) : M2 2,051 / 108,5 ; S2 0,752 / 148,5 ; N2 0,417 / 90,2 ; K2 0,215 / 146,2 ; MU2 0,088 ; NU2 0,078 ; K1 0,065 ; O1 0,065 ; SA 0,063 ; 2N2 0,062 ; L2 0,061 ; M4 0,058.
3. Contrôle sur 2025-2026, années non utilisées pour l'ajustement (15 311 heures, 2 462 pleines et basses mers) :

| Mesure | Résultat |
|--------|----------|
| Écart-type hauteur prédite contre observée | 14,7 cm ; 95 % des écarts sous 31 cm ; biais +3,9 cm |
| Heure des pleines et basses mers | écart moyen +0,2 min ; écart-type 3,5 min ; 95 % sous 7 min |
| Hauteur des pleines et basses mers | biais −3,4 cm ; écart-type 14,4 cm ; 95 % sous 31 cm |
| Avec les 20 premiers constituants seulement | 15,2 cm (au lieu de 14,7) |

L'essentiel des 14 cm est la météo (pression, vent), que nulle prédiction de marée ne contient : la nuit du 18 au 19 novembre 2026, par tempête, le marégraphe était 0,34 à 0,48 m au-dessus de la marée calculée [VERIFIED: observations temps réel du Shom relues].

4. Prototype du calcul embarqué, sans dépendance : hauteur = niveau moyen + somme de `f × A × cos(2π × fréquence × heures depuis le 1er janvier + (V0+u) − g)`, avec `f` et `V0+u` pré-calculés par année par l'outil. Fichier de 35 constituants et 6 années (2026 à 2031) : 4 147 octets. Comparé à la bibliothèque de référence sur toute l'année 2027 au pas de 10 min : écart quadratique 1,0 cm, maximum 4,4 cm ; 0,9 microseconde par calcul. Garder les 68 constituants (dont SA et SSA, le cycle saisonnier) coûte environ 8 ko et évite 5 cm d'écart.
5. Solution plus simple écartée : table des pleines et basses mers avec interpolation en demi-cosinus : écart quadratique 7,8 cm, 34 cm au pire, pour un fichier dix fois plus gros.

Marée calculée pour le GPEN 2027, heures légales (prévision de cette étude, non officielle, à contrôler contre l'annuaire des marées 2027) [VERIFIED: sortie du calcul ; ASSUMED tant que non comparée à l'annuaire] :

| Jour | Extrêmes à Brest | Marnage de l'après-midi | Coefficient approché |
|------|------------------|--------------------------|----------------------|
| Mercredi 5 mai | PM 04:55 6,78 m ; BM 11:15 1,55 m ; PM 17:15 6,89 m ; BM 23:35 1,49 m | 5,4 m | 87 |
| Jeudi 6 mai | PM 05:35 7,03 m ; BM 11:55 1,34 m ; PM 17:50 7,11 m | 5,8 m | 93 |
| Vendredi 7 mai | BM 00:15 1,29 m ; PM 06:15 7,15 m ; BM 12:35 1,27 m ; PM 18:30 7,21 m | 6,0 m | 97 |
| Samedi 8 mai | BM 01:00 1,21 m ; PM 06:55 7,13 m ; BM 13:20 1,33 m ; PM 19:15 7,17 m | 5,9 m | 95 |
| Dimanche 9 mai | BM 01:45 1,28 m ; PM 07:40 6,97 m ; BM 14:05 1,52 m ; PM 20:00 7,00 m | 5,5 m | 89 |

Le GPEN 2027 est en vive-eau. Chaque jour de course a sa basse mer entre 11 h 15 et 14 h 05 : fin de jusant le matin, renverse vers midi, flot l'après-midi avec un maximum trois à quatre heures avant la pleine mer du soir, soit entre 13 h 15 et 17 h selon le jour (13 h 50 à 14 h 50 le jeudi 6, 14 h 30 à 15 h 30 le vendredi 7, 15 h 15 à 16 h 15 le samedi 8).

Coefficient : l'app n'a pas besoin du coefficient officiel. Le marnage de la marée en cours suffit pour doser le courant (§ 4.4). Pour l'affichage, coefficient approché = 45 + (marnage − 2,80) × 50 / 3,10, calé sur les marnages de morte-eau et de vive-eau moyennes du tableau 4.1 ; écart de quelques points avec l'annuaire [ASSUMED].

### 4.3 Courants : atlas 560 du Shom, lu dans cette session

Produit : « Atlas de courants de marée 2D au format netcdf - Finistère », Shom, édition de juin 2026, quatre grilles dont « Rade de Brest » à 100 m [VERIFIED: archive de 776 Mo téléchargée et ouverte, `https://services.data.shom.fr/INSPIRE/telechargement/prepackageGroup/ATLASCOURANTS2D_NETCDF_FINISTERE_PACK_DL/prepackage/ATLASCOURANTS2D_NETCDF_FINISTERE/file/ATLASCOURANTS2D_NETCDF_FINISTERE.7z`].

- Fichier `ATLASDYN-SURF_TELEMAC3D-SURF_R1111110_RADE-BREST-560-100M-5min.nc`, 234 Mo : 277 × 182 points au pas de 100 m, 17 397 en mer ; 145 échéances de 5 min, de 6 h avant à 6 h après la pleine mer de Brest ; 2 coefficients (45 et 95) ; composantes U (vers l'est) et V (vers le nord) en m/s, couche de surface ; emprise 48,2480 à 48,4110 N, 4,6258 à 4,2530 W [VERIFIED: dimensions et attributs lus].
- Licence : « Ce produit est diffusé sous Licence Ouverte (version 2.0 d'avril 2017) » ; restriction : « A n'utiliser qu'en complément des cartes et ouvrages nautiques officiels. » ; identifiant à citer `https://dx.doi.org/10.17183/ATLASCOURANTS2D_NETCDF` [VERIFIED: descriptif joint à l'archive, § 4.1 et 4.2 ; licence `lov2` sur data.gouv.fr].
- Le descriptif donne la direction par `atan2(U, V) + 180` ; les valeurs lues montrent que `atan2(U, V)` seul donne bien la direction vers laquelle porte le courant (le flot entre dans la rade vers l'est) [VERIFIED: sens du flot dans le goulet].

Vitesse maximale et heure, en nœuds, direction vers laquelle porte le courant [VERIFIED: lecture du fichier] :

| Lieu | Vive-eau (coef. 95) | Morte-eau (coef. 45) | Renverses (par rapport à la pleine mer de Brest) |
|------|---------------------|----------------------|---------------------------------------------------|
| Maximum de toute la rade : devant la Pointe des Espagnols (48,3425 N, 4,5313 W) | 4,6 | 1,9 | — |
| Goulet, milieu entre Espagnols et Portzic | flot 3,6 vers 077° à PM−3 h ; jusant 3,7 vers 272° à PM+3 h 35 | 1,4 ; 1,6 | PM−5 h 35 et PM+0 h 10 |
| Goulet, passe sud (sud de Mengam) | 2,5 vers 062° ; 2,7 vers 249° | 1,0 ; 1,1 | PM−5 h 40 et PM+0 h 05 |
| Goulet, passe nord | 2,1 vers 075° ; 1,7 vers 256° | 0,9 ; 0,8 | PM+0 h 00 |
| Goulet, rive nord à 300 m du bord (Le Dellec) | 0,8 au flot ; 1,3 au jusant | 0,5 | jusant dès PM−1 h 15 : contre-courant de fin de flot |
| Goulet, rive sud à 300 m du bord (Cornouaille) | 0,6 | 0,3 | jusant dès PM−0 h 50 |
| Entrée du goulet (Minou – Capucins) | 1,7 vers 071° ; 2,5 vers 247° | 0,7 ; 0,9 | PM−5 h 15 et PM+0 h 10 |
| 300 m au nord de la Pointe des Espagnols | flot 3,1 vers 082° ; jusant 1,4 seulement, dévié vers 300° | 1,4 ; 0,5 | remous au jusant |
| Centre de la rade, nord de l'Île Longue | flot 1,8 vers 178° ; jusant 1,4 vers 327° | 0,4 ; 0,5 | PM−5 h 10 |
| Basse du Renard | flot 2,1 vers 176° ; jusant 1,7 vers 324° | 0,4 ; 0,7 | PM−5 h 30 |
| Devant la baie de Roscanvel (zone F) | 0,7 vers 304° de PM−2 h à PM+1 h : courant de retour pendant le flot | 0,2 | PM+3 h |
| Fond de la baie de Roscanvel | 0,2 | 0,05 | zone morte |
| Île Ronde – Pointe de l'Armorique | 1,3 vers 273° à PM+0 h 45 | 0,55 | PM−2 h |
| Chenal de Lanvéoc (bouée 3) | flot 1,5 vers 170° ; jusant 1,1 vers 307° | 0,4 | PM−5 h 25 |
| Cardinale de Penn ar Vir | flot 1,1 vers 119° ; jusant 0,8 vers 323° | 0,5 ; 0,3 | PM−0 h 55 |
| Zone B du GPEN (Poulmic) | 0,5 en moyenne, de 0 à 1,2 dans la zone ; porte au nord-ouest de la pleine mer à PM+6 h | 0,25 | tourbillon |
| **Zone A du GPEN, centre** | flot 0,5 vers 107° à PM−4 h ; jusant 0,6 vers 274° à PM+3 h 40 | 0,25 | PM−5 h 40 et PM+0 h 05 |
| Chenal de l'Aulne, bouée 6 | 0,95 vers 078° ; 0,8 vers 256° | 0,35 | PM−5 h 35 et PM+0 h 25 |
| Aulne devant Landévennec | 1,1 vers 098° ; 1,0 vers 281° | 0,4 | PM+0 h 15 |
| Entrée de la baie de Daoulas | 1,1 vers 048° ; 0,9 vers 222° | 0,4 | PM+0 h 15 |
| Moulin Blanc (zone C) | 0,6 vers 043° | 0,2 | PM+0 h 30 |
| Camaret (zone D) | 0,6 | 0,2 | — |

Part de la surface de la rade où le courant maximal dépasse un seuil [VERIFIED] : 1 nd : 43 % en vive-eau, 6 % en morte-eau ; 2 nd : 11 % et 0 % ; 3 nd : 4 % et 0 %. Le rapport des courants de vive-eau et de morte-eau a une médiane de 2,6, plus que le rapport des marnages (2,1) : le courant ne suit pas le marnage en simple proportion.

Recoupement avec les guides : « les courants ne dépassent dans la rade que rarement, et localement, les 2 nœuds » ; dans le goulet ils « peuvent facilement atteindre les 4 nœuds » ; au flot « un vaste tourbillon qui crée un courant en retour devant la baie de Roscanvel » ; contre-courants du goulet « suffisamment difficiles à utiliser » ; tourbillons à La Cormorandière [CITED: livret voileaviron.org]. Un autre guide parle de « 4 à 5 nœuds » dans le goulet [CITED: bateaux.com, 27/09/2022]. L'atlas confirme ces ordres de grandeur.

**Zone A (J80), cercle de 0,6 mille, 389 points de l'atlas** [VERIFIED] :

| Heure de marée | Courant moyen, vive-eau | Du plus faible au plus fort dans la zone |
|----------------|--------------------------|--------------------------------------------|
| PM−6 h | 0,19 nd vers 277° | 0,04 à 0,43 |
| PM−5 h | 0,39 nd vers 091° | 0,16 à 0,85 |
| PM−4 h | 0,75 nd vers 092° | 0,29 à 1,16 |
| PM−3 h | 0,74 nd vers 092° | 0,29 à 1,14 |
| PM−2 h | 0,64 nd vers 095° | 0,32 à 0,99 |
| PM−1 h | 0,38 nd vers 100° | 0,15 à 0,63 |
| PM | 0,08 nd | 0,04 à 0,21 |
| PM+1 h | 0,24 nd vers 259° | 0,08 à 0,42 |
| PM+2 h | 0,39 nd vers 267° | 0,25 à 0,56 |
| PM+3 h | 0,64 nd vers 269° | 0,46 à 0,90 |
| PM+4 h | 0,76 nd vers 270° | 0,48 à 1,07 |
| PM+5 h | 0,58 nd vers 272° | 0,31 à 0,93 |
| PM+6 h | 0,31 nd vers 275° | 0,14 à 0,60 |

- Axe est-ouest : le flot porte à l'est (vers l'Aulne), le jusant à l'ouest. Étale à la pleine mer de Brest et vers PM−5 h 40, soit un quart d'heure environ après la basse mer en vive-eau (le 6 mai 2027 : basse mer à 11 h 55, étale vers 12 h 10).
- Fort au nord et à l'ouest du cercle (1,0 à 1,1 nd dans le chenal de l'Aulne, profond de 15 à 28 m, à 800 m au nord du centre), faible au centre et au sud (0,3 à 0,6 nd sur des fonds de 1 à 9 m sous le zéro des cartes d'après EMODnet) : jusqu'à 0,85 nd d'écart d'un bord à l'autre de la zone au maximum du flot.
- En morte-eau moyenne : 0,31 nd en médiane, 0,45 nd au plus.

### 4.4 Effet sur un J80 et ce qui serait faux si on l'ignore

Vitesses de la polaire de l'app [VERIFIED: `optimalAngles` et `boatSpeed` de `js/polar.js` exécutés] : gain au vent 3,96 nd par 8 nd de vent, 4,37 nd par 10 nd, 4,59 nd par 14 nd ; gain sous le vent 4,61 ; 5,29 ; 6,16 nd.

| Point | Ordre de grandeur en zone A par vive-eau | Dans l'app aujourd'hui |
|-------|-------------------------------------------|------------------------|
| Temps d'un bord de près de 0,8 mille par 8 nd, vent dans l'axe du courant | 12,1 min sans courant ; 14,9 min contre 0,75 nd ; 10,2 min avec | Temps de bord, temps de parcours, choix du nombre de tours faux de 15 à 25 % |
| Écart entre deux bateaux séparés par 0,4 nd de courant | 130 à 150 m sur un seul bord de près | Le conseil de côté ne regarde que le vent (`sideSample`, `js/tactics.js:254`) : il manque le facteur qui décide souvent |
| Laylines, vent en travers du courant | Dérive de 6° à 0,6 nd, 10° à 1 nd | Laylines et cap conseillé faux (`js/app.js:1341-1350`) |
| Vent ressenti sur l'eau | ±0,75 nd et jusqu'à 5° | Angles et vitesses cibles légèrement faux |
| Dernière minute avant le départ | 0,75 nd pendant 60 s = 23 m, trois longueurs de J80 | Temps à la ligne calculé sur la vitesse sur l'eau (`js/startmode.js:68`) : départ volé ou en retard |
| Débrief | Vitesse fond contre polaire à ±0,75 nd, angle au vent tiré de la route fond faux de 8° | Pourcentages de polaire et vent déduit de la trace faux (`js/debrief.js:233, 277, 325`) |
| Carte « État de la mer » | — | Texte en dur « large de Cépet » et « Courant de surface modélisé (Copernicus) : faible en rade » (`js/app.js:714`) : faux à Brest |
| Hauteur d'eau | 1,3 m d'eau au-dessus du zéro à la basse mer de midi ; fonds de 1 à 4 m sous le zéro entre 400 m et 1,2 km à l'ouest et au sud-ouest du centre (EMODnet) | Le routage ne connaît que la terre (`js/router.js:21`) |
| Morte-eau | 0,3 nd, 2 à 4° | Négligeable en zone A |

### 4.5 Sources ouvertes et licences

| Source | Contenu | Résolution, validité en rade | Licence, accès | Verdict |
|--------|---------|-------------------------------|----------------|---------|
| Shom, atlas de courants 2D NetCDF Finistère | Courant de surface par heure de marée, coefficients 45 et 95 | 100 m dans la rade, 30 m dans le port, 5 min ; fait pour la rade | Licence Ouverte 2.0 ; téléchargement libre ; « en complément des cartes et ouvrages nautiques officiels » [VERIFIED] | **Retenu** |
| Shom, REFMAR, marégraphe de Brest | Hauteurs observées (horaires validées, temps réel 10 min) | Mesure au port de référence | Licence Ouverte 2.0 ; service sans clé ; en-tête d'accès inter-domaines `*` présent [VERIFIED: en-têtes de la réponse] | **Retenu** (ajustement des harmoniques ; surcote en direct) |
| Shom, Références Altimétriques Maritimes | Niveaux caractéristiques par port | 11 ports autour de la rade | Licence Ouverte 2.0 [VERIFIED] | Retenu (constantes) |
| Shom, prédictions officielles et constantes harmoniques | Annuaire, service de prédiction | — | Conditions propres, non lues dans cette session (aucune observation) | Non utilisé comme donnée ; sert seulement de contrôle visuel |
| Open-Meteo marine (`ocean_current_*`, `sea_level_height_msl`) | Modèle « MeteoFrance SMOC Currents, Tides », « 0.08° (~8 km) », horaire | « Accuracy at coastal areas is limited. » « This is not suitable for coastal navigation and does not replace your nautical almanac. » [CITED: open-meteo.com/en/docs/marine-weather-api]. Essai : le point de la zone A est ramené à 48,2917 N, 4,3750 W, courant maximal 0,7 km/h soit 0,4 nd ; le point du goulet est ramené à 48,2917 N, 4,5417 W, à 5 km au sud du goulet, 0,8 km/h soit 0,4 nd quand l'atlas donne 1,6 nd au milieu du goulet en morte-eau moyenne ; la marée y est en avance de 40 à 50 min sur le calcul vérifié (pleine mer à 22 h 00 TU au lieu de 22 h 50, basse mer à 04 h 15 au lieu de 05 h 05), marnage juste à 0,15 m près [VERIFIED: réponses de l'API du 19/11/2026, relues par un outil de lecture ; un seul jour d'essai] | **Écarté** dans la rade |
| Ifremer, MARC, modèle MARS3D de la rade de Brest | Rejeu hydrodynamique à 50 m | Accès par service de données ; licence non confirmée [CITED: fiches sextant.ifremer.fr et seanoe.org trouvées, non ouvertes] | Non nécessaire ; piste si l'atlas ne suffit pas |
| Shom, courants 3D « rade de Brest – Iroise » | Fiche de catalogue trouvée, non ouverte | — | Non vérifié | Non nécessaire |
| EMODnet bathymétrie | Fonds à 115 m, rapportés à la plus basse mer astronomique | Grossier près des côtes | Libre avec mention [ASSUMED pour les termes exacts] | Retenu faute de mieux |
| Litto3D (Shom – IGN) | Relief terre-mer continu à 1 m et 5 m | Produit publié en données ouvertes sous Licence Ouverte ; couverture de la rade de Brest non confirmée [CITED: présentation Shom-IGN 2024, descriptif Litto3D 2025] | À vérifier | Souhaitable pour les fonds |

### 4.6 Solution minimale fiable (D-13)

**Nécessaire**

1. `data/brest.maree.json` : niveau moyen, 68 constituants (nom, fréquence, amplitude, situation), et par année de 2026 à 2031 les facteurs `f` et les arguments `V0+u`. Produit par un outil du dossier `tools/` à partir des observations du marégraphe. Environ 8 ko.
2. `js/maree.js` : `hauteur(t)`, extrêmes d'une journée (pleines et basses mers, heure et hauteur), marée en cours (heure de la pleine mer la plus proche, marnage). Une trentaine de lignes, sans dépendance, fonctions pures.
3. `data/brest.courants.bin` : atlas de la rade à 100 m ré-échantillonné sur 13 heures de marée (PM−6 h à PM+6 h) et 2 coefficients, U et V sur un octet signé au pas de 0,02 m/s (portée ±4,9 nd, maximum de l'atlas 4,6 nd). Mesuré : 2,6 Mo pour la grille entière (359 ko une fois compressée par gzip), 0,9 Mo en ne gardant que les 17 397 points en mer. L'interpolation linéaire entre deux heures s'écarte de l'atlas à 5 min de 0,04 nd en écart quadratique, de moins de 0,16 nd dans 99 % des cas, et jusqu'à 1,4 nd très localement au moment des renverses près de la Pointe des Espagnols. Variante à 200 m : 653 ko, 121 ko compressés.
4. `js/courant.js` : `courantEn(x, y, t)` rend `{ u, v }` en m/s. Heure de marée = écart à la pleine mer de Brest la plus proche ; dosage par le marnage de la marée en cours : `v = v45 + (v95 − v45) × (marnage − 2,80) / 3,10`, facteur borné ; interpolation bilinéaire dans l'espace, linéaire dans le temps.
5. Routage : `route(from, to, field, opts)` reçoit `opts.current` et l'heure de départ. Sans cette option, le chemin de calcul reste celui d'aujourd'hui, opération pour opération (D-01).
6. Affichage de base : heure et hauteur des pleines et basses mers du jour, marnage et coefficient approché, courant à la bouée au vent et au départ, heure de la prochaine renverse dans la zone.

**Souhaitable**

7. Conseils par bord : dérive et temps gagné ou perdu, côté du plan d'eau où le courant est plus favorable (comparer le courant à gauche et à droite de la route, comme `sideSample` le fait pour le vent), « renverse à HH h MM », vent contre courant et clapot.
8. Mode départ et laylines sur la route fond ; débrief qui retranche le courant avant de comparer à la polaire.
9. Fonds : `data/brest.fonds.bin`, hauteur du fond par rapport au zéro des cartes sur la grille de 100 m (50 ko). Un point est navigable si `hauteur(t) − fond ≥ tirant d'eau + marge` (J80 : 1,5 m ; marge d'au moins 1 m tant que la source est EMODnet). Indispensable dès que l'app conseille d'aller chercher le courant faible près du bord. L'outil actuel écrase les fonds (`d = min(d, -0.8)`) : garder ce traitement pour l'image et le vent, et lire les fonds vrais dans le fichier dédié.
10. Flèches de courant sur la carte, curseur d'heure commun au vent et au courant.
11. Surcote en direct : hauteur observée au marégraphe moins hauteur calculée, quand il y a du réseau.

**Précision attendue**

| Grandeur | Précision | Fondement |
|----------|-----------|-----------|
| Heure des pleines et basses mers à Brest | 3,5 min d'écart-type, 7 min dans 95 % des cas | [VERIFIED: contrôle 2025-2026] |
| Hauteur d'eau | 15 cm d'écart-type, 31 cm dans 95 % des cas, jusqu'à 0,5 m par tempête | [VERIFIED: contrôle 2025-2026 et nuit du 19/11/2026] |
| Hauteur en zone A | Ajouter jusqu'à 0,25 m à la pleine mer de vive-eau (amplification vers Tinduff) | [VERIFIED: tableau 4.1] ; correction non modélisée |
| Courant, fidélité à l'atlas | 0,04 nd | [VERIFIED: mesure de l'interpolation] |
| Courant, fidélité au réel | Non mesurée ici ; l'atlas est un modèle en conditions moyennes, sans vent ni débit des rivières ; ordre de grandeur attendu 0,2 à 0,3 nd et 15 à 30 min sur les renverses | [ASSUMED] |
| Coefficients autres que 45 et 95 | Interpolation linéaire, extrapolation au-delà de 95 | [ASSUMED : méthode usuelle des atlas, non relue dans un document du Shom] |

## 5. Météo

### 5.1 Modèles sur Open-Meteo

Essai à 48,298 N, 4,3605 W avec onze modèles : tous rendent des valeurs, dont les six de l'app [VERIFIED: réponse de `api.open-meteo.com/v1/forecast` relue par un outil de lecture le 19/11/2026 ; point ramené à 48,30 N, 4,36 W, altitude 0].

| Modèle | Maille, échéance, mise à jour | Remarque |
|--------|-------------------------------|----------|
| `meteofrance_arome_france_hd` | « 0.01° (~1.5 km) », horaire, 2 jours, toutes les 3 h | Modèle principal, comme à Toulon |
| `meteofrance_arome_france` | « 0.025° (~2.5 km) », 2 jours, toutes les 3 h | |
| `meteofrance_arpege_europe` | « 0.1° (~11 km) », 4 jours, toutes les 6 h | |
| `ecmwf_ifs025`, `icon_eu`, `gfs_seamless` | — | Déjà dans l'app |
| `ukmo_uk_deterministic_2km` | Répond à Brest | Deuxième modèle fin, absent à Toulon : candidat pour le consensus à Brest |
| `knmi_harmonie_arome_europe`, `dmi_harmonie_arome_europe`, `ukmo_global_deterministic_10km` | Répondent | Facultatifs |

[CITED: open-meteo.com/en/docs/meteofrance-api pour les mailles et échéances]

- Paramètre `cell_selection` : par défaut `land`, « finds a suitable grid-cell on land with similar elevation to the requested coordinates » ; valeurs `sea` et `nearest` possibles [CITED: même page]. Dans une rade étroite, demander `cell_selection=sea` pour les points sur l'eau ; l'app ne le fait pas à Toulon et ne doit pas y changer (D-01).
- Grille conseillée pour la zone A (forme de `GRID`, 20 points) : latitudes 48,275 ; 48,295 ; 48,315 ; 48,335 et longitudes −4,46 ; −4,42 ; −4,38 ; −4,34 ; −4,30. Centre : 48,298 N, 4,3605 W. Pour l'entraînement libre dans toute la rade, une seconde grille plus large (48,28 à 48,37 N, −4,58 à −4,30) [ASSUMED pour le choix des points].
- Point marin : ne pas reprendre les vagues et le courant d'Open-Meteo dans la rade (§ 3.4 et 4.5).
- Le jour de l'essai, la limite quotidienne de l'API a été atteinte depuis l'adresse partagée de cet environnement (« Daily API request limit exceeded ») : sans rapport avec l'usage de l'équipage, mais l'outil d'instantané peut échouer sur une adresse partagée.

### 5.2 Mesures en direct

| Source | Lieu | Accès | Constat |
|--------|------|-------|---------|
| Pioupiou / OpenWindMap (source actuelle de l'app) | — | `https://api.pioupiou.fr/v1/live/all`, sans clé | **Aucune balise dans la rade** : 762 balises au total, 2 dans tout le Finistère nord et ouest (47,97 N et 48,67 N), aucune entre 48,2 et 48,45 N [VERIFIED: réponse du 19/11/2026] |
| Holfuy, station 1642 « Duc d'Albe - rade de Brest » | Sur l'eau, rade sud, 8 m | Page publique ; API avec clé à demander au gestionnaire (centre nautique de Brest métropole) ; « Les données de la station sont sous "licence ouverte" » ; mention de remises en service, donc des pannes [CITED: holfuy.com/fr/weather/1642] | La seule mesure au ras de l'eau dans la rade sud |
| METAR de Lanvéoc-Poulmic `LFRL` et de Brest-Guipavas `LFRB` | 48,279 N, 4,439 W ; 48,444 N, 4,412 W | `https://aviationweather.gov/api/data/metar?ids=LFRB,LFRL&format=json`, sans clé, toutes les 30 min ; pas d'en-tête d'accès inter-domaines dans la réponse [VERIFIED: réponse et en-têtes du 19/11/2026] | Utilisable par une fonction relais |
| Météo-France, observations à 6 min | Lanvéoc `29120001`, Brest-Guipavas `29075001`, Plougonvelin `29190001`, Camaret `29022001`, Ouessant-Stiff `29155005` | Portail d'API, jeton à passer en en-tête, 24 h de profondeur [CITED: documentation « API Ciblée Données d'Observation » de Météo-France] ; numéros de stations [VERIFIED: fichiers horaires] | Par une fonction relais (jeton côté serveur) |
| Marégraphe de Brest (Shom) | Port de Brest | Sans clé, en-tête inter-domaines présent | Niveau d'eau en direct |
| Bouées de houle (Candhis), phares | — | Non étudié | Pas de vent ; sans intérêt pour la rade fermée [ASSUMED] |

Les stations de Lanvéoc et de Guipavas sont sur les plateaux (81 et 92 m). Pour le calage des modèles par les relevés dictés, l'app garde sa méthode actuelle (relevés de l'équipage).

## 6. Synthèse : ce qu'il faut produire

### 6.1 Fichiers du pack Brest (noms plats, D-03)

| Fichier | Contenu | Taille | Produit par |
|---------|---------|--------|-------------|
| `data/brest.meta.json` | Emprise, dimensions, sources | < 1 ko | `tools/build_terrain.py` paramétré |
| `data/brest.terrain.bin` | Relief et fonds, 1086 × 774, Int16 | 1,68 Mo | idem |
| `data/brest.cover.bin` | Mer, terre, urbain, digue | 0,84 Mo | idem |
| `data/brest.coast.json` | Trait de côte simplifié | 150 à 250 ko (estimé) | idem |
| `data/brest.basemap.jpg` | Fond de carte 4096 × 2920 | 0,6 à 0,8 Mo (estimé) | `tools/build_basemap.py` paramétré |
| `data/brest.seamask.png` | Masque de l'eau | 150 à 250 ko (estimé) | idem |
| `data/brest.maree.json` | Harmoniques de Brest, facteurs par année | 8 ko | nouvel outil |
| `data/brest.courants.bin` | Atlas 560, 100 m, 13 heures, 2 coefficients | 0,9 Mo | nouvel outil |
| `data/brest.fonds.bin` (souhaitable) | Fonds vrais par rapport au zéro des cartes, 100 m | 50 ko | nouvel outil |
| `data/brest.wx-snapshot.json` | Instantané météo de secours | 90 ko | `tools/snapshot_weather.py` paramétré |
| **Total** | | **environ 5 Mo** | |

### 6.2 Tables et constantes du module `js/venue-brest.js`

Origine de projection ; `PLACES` (§ 2.1) ; marques fixes et `DANGERS` (§ 2.2) ; polygones interdits de l'Île Longue et de Pen ar Vir (§ 2.3) ; zone A (centre et rayon) et position de ligne par défaut au centre de la zone ; `REGIMES` et vents prédéfinis (§ 3.6) ; `GRID`, `CENTER`, liste de modèles, option `cell_selection`, boîte et sources des mesures en direct (§ 5) ; paramètres du champ de vent (seuil de référence, maille) ; port de référence de la marée ; mentions de sources à afficher.

Mentions obligatoires : « © contributeurs OpenStreetMap (ODbL) », « EMODnet Bathymetry », « Shom – atlas de courants de marée 2D, doi 10.17183/ATLASCOURANTS2D_NETCDF », « Shom – REFMAR (marégraphe de Brest) », « Shom – Références Altimétriques Maritimes », et l'avertissement « ne remplace pas les cartes et ouvrages nautiques officiels ».

### 6.3 Travail, par lot

| Lot | Contenu | Poids | Risque pour Toulon |
|-----|---------|-------|--------------------|
| 1. Entrées et outils | Script de téléchargement (Overpass, EMODnet, tuiles) ; emprise, graines de mer et géoréférence en paramètres ; graines tirées de la bathymétrie plutôt qu'écrites à la main (la baie de Douarnenez et l'Iroise sont deux bassins distincts dans l'emprise) | 1 plan | Aucun si les valeurs de Toulon restent les valeurs par défaut ; vérifier que les fichiers de Toulon régénérés sont identiques ou ne pas les régénérer |
| 2. Marée | Outil d'ajustement, `brest.maree.json`, `js/maree.js`, tests | 1 plan court | Aucun |
| 3. Courants | Outil de conversion du NetCDF, `brest.courants.bin`, `js/courant.js`, tests | 1 plan | Aucun |
| 4. Routage et conseils | Option `current` de `route()`, vent sur l'eau, conseils par bord, départ, laylines, débrief | 1 à 2 plans | **Le plus sensible** : la fixture v42 doit rester identique |
| 5. Données de lieu | `js/venue-brest.js` : lieux, marques, zones, régimes, météo, mesures en direct | 1 plan | Aucun |
| 6. Vent | Seuil de référence et maille par plan d'eau | Quelques lignes | Fixture v42 |
| 7. Affichage | Carte de marée, courant sur la carte, textes propres au lieu (carte « État de la mer ») | 1 plan | Textes de Toulon inchangés |
| 8. Validation locale | Conseils relus par un régatier de la rade ; polygone de l'Île Longue relu sur la carte ; marée comparée à l'annuaire | Hors code | — |

Soit 6 à 8 plans. Les lots 2, 3 et 5 n'ont aucun effet sur Toulon et peuvent partir avant le 13 décembre ; le lot 4 peut attendre après, le GPEN étant en mai 2027.

### 6.4 Vérifications possibles

| Vérification | Comment | Valeurs de référence |
|--------------|---------|----------------------|
| Marée contre une table connue | Comparer `hauteur(t)` aux observations du marégraphe sur une période passée (fixture de quelques centaines d'heures) et aux pleines et basses mers de l'annuaire 2027 pour le 5 au 9 mai | Écart-type attendu sous 16 cm et 5 min ; tableau du § 4.2 |
| Calcul embarqué contre l'outil | Fixture de hauteurs produite par l'outil ; le module doit la reproduire | Écart sous 5 cm |
| Courant contre l'atlas aux heures clés | Le fichier compacté doit redonner l'atlas | Goulet milieu, vive-eau : 3,6 nd vers 077° à PM−3 h, 3,5 nd vers 272° à PM+4 h ; zone A centre : 0,5 nd vers 107° à PM−4 h, 0,6 nd vers 274° à PM+4 h ; zone F : 0,7 nd vers 304° à PM ; tolérance 0,05 nd et 5° |
| Dosage par le marnage | Marnage 5,90 m rend l'atlas de vive-eau, 2,80 m celui de morte-eau | Égalité |
| Routage sans courant | `route()` sans option : sortie identique à la v42 | Fixture v42 (D-01) |
| Routage avec courant | Courant uniforme connu : temps = distance / (gain au vent ± courant) | 0,8 mille par 8 nd : 12,1 ; 14,9 ; 10,2 min |
| Relief | Altitudes aux points connus après construction | Tableau du § 1.3 |
| Champ de vent | Indice de dévent aux centres de zone | Tableau du § 1.3 |
| Terre et mer | La zone A, la zone B, le goulet sont en mer ; l'Île Longue et l'Île Ronde sont en terre | Positions du § 2 |
| Sur l'eau | Dérive mesurée bateau arrêté ou bouée de casier, à comparer à l'atlas ; écart de la trace GPS à la route surface | À faire à la première sortie |

### 6.5 Risques

| Risque | Gravité | Parade |
|--------|---------|--------|
| Conseils de vent rédigés sans expérience locale | Moyenne : conseil faux en course | Marquer l'origine de chaque conseil ; faire relire ; commencer par les conseils tirés de mesures |
| Atlas en conditions moyennes (ni vent ni crue) | Moyenne | Afficher le courant comme une estimation ; vérifier sur l'eau |
| Fonds EMODnet grossiers | Forte pour la sécurité si l'app envoie vers le bord | Marge d'au moins 1 m ; chercher Litto3D ; avertissement à l'écran |
| Zones interdites incomplètes | Forte (zone militaire) | Tracer sur carte marine, lire l'arrêté en vigueur ; en attendant, zone large |
| Régression à Toulon par le courant dans le routage | Forte avant le 13 décembre | Option absente = chemin actuel ; fixture v42 ; livrer ce lot après le 13 si doute |
| Normalisation du vent faussée | Moyenne | Seuil par plan d'eau, test sur l'indice |
| Pack plus lourd que prévu (5 Mo) | Faible | Téléchargement à la demande (D-04) ; variante à 200 m pour les courants |
| Pas de vent mesuré sur l'eau | Faible | Relevés dictés ; clé Holfuy à demander |
| Marée fausse après 2031 | Faible | Fichier daté ; message et régénération par l'outil |
| IC 2027 différentes (zone déplacée) | Faible | L'emprise couvre toutes les zones 2026 de la rade |

## Pile standard

Aucune dépendance nouvelle dans l'app. Outils hors déploiement :

| Outil | Version constatée ici | Rôle | Statut |
|-------|------------------------|------|--------|
| Python 3, numpy, Pillow | numpy 2.5.3, Pillow 12.3.0 | Outils de données existants | Déjà utilisés par le projet |
| `netCDF4` | 1.7.5.1 | Lire l'atlas du Shom | [ASSUMED] à valider avant installation |
| `utide` (avec `scipy`) | 0.4.0 (scipy 1.18.1) | Ajustement harmonique et arguments astronomiques | [ASSUMED] à valider avant installation |
| `py7zr` | 1.1.4 | Ouvrir l'archive `.7z` du Shom | [ASSUMED] ; remplaçable par un utilitaire 7-Zip du système |

Installation, dans un environnement à part, jamais dans le déploiement : `python3 -m venv .venv-outils && .venv-outils/bin/pip install netCDF4 utide py7zr`.

| Au lieu de | On pourrait | Quand |
|------------|-------------|-------|
| `utide` | Moindres carrés écrits à la main avec numpy | Si l'on refuse toute dépendance ; il faut alors écrire les corrections nodales, source d'erreurs |
| Atlas embarqué | Requêtes à un modèle en ligne | Jamais en course : pas de réseau |
| Harmoniques maison | Annuaire recopié | Conditions de réutilisation à vérifier ; fichier plus gros, moins précis entre les extrêmes |

## Audit de légitimité des paquets

Contrôle automatique lancé dans cette session (`package-legitimacy check --ecosystem pypi`) : il rend « suspect » pour tous les paquets, y compris numpy, faute de statistiques de téléchargement disponibles dans cet environnement ; il ne distingue donc rien. Les trois paquets ont été installés et utilisés ici sans incident, ce qui ne prouve pas leur légitimité.

| Paquet | Registre | Dépôt de sources | Verdict de l'outil | Décision |
|--------|----------|-------------------|--------------------|----------|
| `netCDF4` | PyPI | non renvoyé par l'outil | suspect (récent, téléchargements inconnus, pas de dépôt) | Signalé : contrôle humain avant installation |
| `utide` | PyPI | non renvoyé par l'outil | suspect (téléchargements inconnus, pas de dépôt) | Signalé : contrôle humain avant installation |
| `py7zr` | PyPI | github.com/miurahr/py7zr | suspect (téléchargements inconnus) | Signalé : contrôle humain, ou utilitaire système |

**Paquets retirés :** aucun. **Paquets signalés :** les trois ; le planificateur place un point de contrôle humain avant leur installation. Ils ne servent qu'aux outils de données, jamais à l'app déployée.

## Motifs d'architecture

### Schéma

```text
 Sources ouvertes (une fois, hors déploiement)
 ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐ ┌─────────────────┐
 │ OpenStreetMap│ │ EMODnet fonds│ │ Tuiles relief │ │ Shom atlas 560   │ │ Shom marégraphe │
 └──────┬───────┘ └──────┬───────┘ └──────┬────────┘ └────────┬─────────┘ └────────┬────────┘
        └────────────────┴────────┬───────┘                   │                    │
                          tools/build_terrain.py       outil courants        outil marée
                          tools/build_basemap.py              │                    │
                                  │                           │                    │
                                  ▼                           ▼                    ▼
                    brest.terrain / cover / coast     brest.courants.bin    brest.maree.json
                    brest.basemap / seamask           (brest.fonds.bin)
                                  └───────────────┬───────────┴────────────────────┘
                                                  ▼
                                  Pack Brest : téléchargé à la demande,
                                  empreinte vérifiée, cache dédié (D-04)
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────────┐
                    ▼                             ▼                                 ▼
             Terrain, WindField            js/maree.js                       js/courant.js
             (vent au sol local)     hauteur(t), extrêmes,            courantEn(x, y, t) :
                    │                 marée en cours ───────────────▶ heure de marée, marnage
                    │                             │                                 │
                    └──────────────┬──────────────┴─────────────────────────────────┘
                                   ▼
                     route(from, to, field, { current, t0, depth })
                     vent sur l'eau = vent au sol − courant
                     vitesse fond  = vitesse sur l'eau + courant
                     obstacle = terre, zone interdite, fond insuffisant
                                   │
              ┌────────────────────┼─────────────────────┬──────────────────┐
              ▼                    ▼                     ▼                  ▼
        conseils par bord     mode départ           carte et curseur     débrief
        (côté, renverse)      (temps à la ligne)    (flèches de courant) (vitesse sur l'eau)

 Option « current » absente (Toulon) ──▶ chemin de calcul actuel, inchangé
```

### Motif 1 : le courant est une option, jamais un défaut

`route()` ne lit le courant que si `opts.current` existe. Le code de Toulon n'en passe pas : mêmes opérations, mêmes nombres. Le test de non-régression est la fixture v42.

### Motif 2 : la marée est une fonction pure de l'heure

`js/maree.js` ne lit ni l'horloge ni le réseau : il reçoit une heure et les constantes. Testable sans navigateur avec `node:test`.

### Motif 3 : l'outil calcule, l'app relit

Tout ce qui est délicat (arguments astronomiques, corrections nodales, lecture du NetCDF) reste dans les outils hors ligne. L'app ne fait que des cosinus et des interpolations.

### À éviter

- **Courant ajouté après coup au temps de bord** : la route optimale change avec le courant ; il doit entrer dans le pas de l'isochrone.
- **Coefficient lu sur un site** : dépendance au réseau et à des conditions de réutilisation ; le marnage calculé suffit.
- **Fonds écrasés utilisés pour la navigation** : `terrain.bin` impose 0,8 m d'eau partout en mer.
- **Données marines d'Open-Meteo dans la rade** : voir § 4.5.

## Ne pas réinventer

| Problème | Ne pas écrire | Utiliser | Pourquoi |
|----------|---------------|----------|----------|
| Champ de courant de la rade | Courant « par zone » dessiné à la main | Atlas 560 du Shom | Tourbillons et contre-courants impossibles à deviner (zone B, baie de Roscanvel) |
| Arguments astronomiques et facteurs nodaux | Formules recopiées en JavaScript | Tables annuelles sorties de l'outil | Erreurs silencieuses de quelques dizaines de minutes |
| Ajustement harmonique | Moindres carrés maison | Bibliothèque d'analyse de marée | Choix des constituants, séparation, corrections |
| Lecture NetCDF | Analyseur maison | Bibliothèque NetCDF | Format HDF5 |
| Vérification d'empreinte du pack | Hachage maison | `crypto.subtle` du navigateur | Déjà prévu par D-04 |

**Idée clé :** le calcul embarqué est court parce que la difficulté est déplacée dans des fichiers produits et vérifiés hors ligne.

## Pièges courants

### Piège 1 : référence du vent introuvable
**Ce qui casse :** vent sur l'eau surestimé partout à Brest. **Cause :** `js/wind.js:107` ne retient que les cellules à plus de 4 000 m d'une terre ; le calcul sur EMODnet n'en trouve aucune dans l'emprise (maximum 3 693 m) : `ref` vaut alors 1, ou se cale sur quelques cellules isolées à l'ouest du goulet. **Parade :** seuil par plan d'eau, 4 000 conservé à Toulon. **Signe :** facteur d'accélération au-dessus de 1 dans toute la rade.

### Piège 2 : mer coupée en bassins
**Ce qui casse :** un bassin entier classé en terre, ou l'inverse. **Cause :** graines de remplissage écrites pour Toulon ; l'emprise de Brest contient l'Iroise, la rade et un bord de la baie de Douarnenez. **Parade :** graines tirées de la bathymétrie (tout point de plus de 3 m de fond) ; contrôle de la part de terre (environ 70 %).

### Piège 3 : géoréférence du TIFF en dur
**Ce qui casse :** fonds décalés. **Cause :** `BL0, BT0, BD` de Toulon. **Parade :** les passer en paramètres ; pour la requête du § 1.2 : −4,70 ; 48,45 ; 1/960.

### Piège 4 : estran pris pour de la mer
**Ce qui casse :** route conseillée sur un banc qui découvre. **Cause :** la côte d'OpenStreetMap est la laisse de haute mer ; 6 m de marnage ; fonds forcés à −0,8 m. **Parade :** fichier de fonds vrais et hauteur d'eau à l'heure dite (§ 4.6, point 9).

### Piège 5 : heure de marée mal rattachée
**Ce qui casse :** courant décalé d'une heure. **Cause :** confusion entre temps universel et heure légale, ou pleine mer du mauvais cycle ; deux pleines mers sont séparées de 12 h 25 en moyenne alors que l'atlas couvre 12 h. **Parade :** tout calculer en millisecondes de temps universel ; prendre la pleine mer la plus proche ; entre PM+6 h d'un cycle et PM−6 h du suivant, interpoler.

### Piège 6 : courant proportionnel au marnage
**Ce qui casse :** courant de morte-eau surestimé d'un quart. **Cause :** règle de trois. **Parade :** interpolation entre les deux champs de l'atlas.

### Piège 7 : sens de la direction du courant
**Ce qui casse :** flot et jusant inversés. **Cause :** la formule du descriptif ajoute 180°. **Parade :** stocker U et V, ne jamais stocker de direction ; test « le flot porte à l'est dans le goulet à PM−3 h ».

### Piège 8 : longitudes ouest
**Ce qui casse :** indices de grille négatifs ou inversés. **Cause :** tout le code a été écrit à l'est de Greenwich. **Parade :** déjà prévu par D-07 ; ajouter un test du courant et du relief à une position de Brest.

### Piège 9 : houle du large affichée dans la rade
**Ce qui casse :** « 2,8 m de houle » annoncés sur un plan d'eau fermé. **Cause :** le point marin d'Open-Meteo est une maille de 8 km. **Parade :** masquer ou étiqueter « Iroise » à Brest.

### Piège 10 : conseils non validés présentés comme sûrs
**Ce qui casse :** la confiance de l'équipage. **Parade :** origine de chaque conseil conservée dans le pack ; relecture locale avant mai 2027.

## Exemples de code

Esquisses dans le style du dépôt, à adapter ; seule la première a été exécutée ici.

### Hauteur de marée (prototype vérifié contre la bibliothèque de référence)

```js
// Hauteur d’eau à Brest (m au-dessus du zéro hydrographique) à l’instant ms (temps universel).
// P : contenu de data/brest.maree.json — z0, c : [[nom, fréquence (cycles/h), amplitude (m), situation (°)]], years : { AAAA: { f: […], vu: […] } }
export function hauteur(P, ms) {
  const Y = new Date(ms).getUTCFullYear(), y = P.years[Y];
  if (!y) return null;                                   // année hors du fichier : pas de marée plutôt qu’une marée fausse
  const h = (ms - Date.UTC(Y, 0, 1)) / 3600000;
  let z = P.z0;
  for (let i = 0; i < P.c.length; i++) {
    const [, frq, A, g] = P.c[i];
    z += y.f[i] * A * Math.cos(2 * Math.PI * frq * h + (y.vu[i] - g) * Math.PI / 180);
  }
  return z;
}
```

### Courant en un point

```js
// Courant (m/s, vers l’est et vers le nord) au point (lat, lon) et à l’instant ms. C : atlas décodé ; M : marée en cours { pm (ms), marnage (m) }.
export function courantEn(C, M, lat, lon, ms) {
  const hm = Math.max(-6, Math.min(6, (ms - M.pm) / 3600000)) + 6;        // 0 à 12 : heure de marée
  const k = Math.max(-0.4, Math.min(1.4, (M.marnage - 2.80) / 3.10));     // 0 = morte-eau moyenne, 1 = vive-eau moyenne
  const a = Math.min(11, Math.floor(hm)), t = hm - a;
  const v = (champ) => interp(C, champ, a, lat, lon) * (1 - t) + interp(C, champ, a + 1, lat, lon) * t;
  const u45 = v('u45'), u95 = v('u95'), v45 = v('v45'), v95 = v('v95');
  return { u: u45 + (u95 - u45) * k, v: v45 + (v95 - v45) * k };
}
```

### Un pas d'isochrone avec courant (principe)

```js
// cur : opts.current ; absent à Toulon → les lignes actuelles de js/router.js, inchangées
const c = cur ? cur(p.x, p.y, t0 + p.t * 1000) : null;
// vent sur l’eau = vent au sol − courant (vecteurs « vers », m/s)
const wu = w.u * KN - (c ? c.u : 0), wv = w.v * KN - (c ? c.v : 0);
const twsEau = Math.hypot(wu, wv) / KN, dirEau = norm360(deg(Math.atan2(-wu, -wv)));
const twa = norm180(hd - dirEau), bsp = boatSpeed(twsEau, twa) * perf;
// route fond = vitesse sur l’eau selon le cap + courant
const gx = sh * bsp * KN + (c ? c.u : 0), gy = ch * bsp * KN + (c ? c.v : 0);
const nx = p.x + gx * Math.max(0, dt - lost), ny = p.y + gy * Math.max(0, dt - lost);
// le test d’arrivée se fait sur la direction fond (gx, gy), pas sur le cap
```

## État de l'art

| Avant | Maintenant | Depuis | Effet |
|-------|-----------|--------|-------|
| Atlas de courants du Shom sur papier (ouvrage 560), 13 cartes horaires | Atlas numérique NetCDF en données ouvertes, 100 m et 5 min sur la rade | Édition de juin 2026 du descriptif [VERIFIED] | Courant embarquable sans ressaisie |
| Observations marégraphiques sur demande | Service ouvert sans clé, Licence Ouverte 2.0 | — [VERIFIED pour l'accès] | Harmoniques calculables par chacun |
| Données d'observation Météo-France payantes | Données publiques gratuites depuis le 1er janvier 2024 [CITED: annonce du ministère chargé de l'écologie] | 2024 | Climatologie et mesures en direct accessibles |

**Dépassé :** courant et hauteur d'eau d'un modèle océanique mondial pour une rade fermée (voir § 4.5).

## Journal des hypothèses

| # | Hypothèse | Section | Risque si faux |
|---|-----------|---------|----------------|
| H1 | Tailles de `coast.json`, `basemap.jpg`, `seamask.png` estimées par règle de trois | 1.1, 6.1 | Pack un peu plus lourd |
| H2 | Inclure ou non le Menez-Hom ne change pas le vent en zone A | 1.1 | Effet de sud-est mal rendu |
| H3 | Valeurs d'étiquettes de la requête Overpass | 1.2 | Extraction à ajuster |
| H4 | Caractères des feux d'OpenStreetMap exacts | 2.2 | Affichage faux ; contrôler sur le livre des feux |
| H5 | Limites du port militaire, de l'École navale, bouées 8 à 10 de l'Île Longue, règles des chenaux | 2.3 | Zone interdite incomplète |
| H6 | Vent au ras de l'eau plus faible que sur les plateaux | 3.1 | Conseils de force décalés |
| H7 | Noms des vents (suroît, noroît, nordet, noms bretons) | 3.3 | Libellés à corriger |
| H8 | Conseils marqués (H) dans les régimes | 3.6 | Conseil faux en course |
| H9 | Rafales des vents prédéfinis | 3.6 | Réglage de confort |
| H10 | Formule du coefficient approché | 4.2 | Écart d'affichage de quelques points |
| H11 | Marée de mai 2027 non comparée à l'annuaire | 4.2 | Écart au-delà de la précision annoncée, peu probable au vu du contrôle |
| H12 | Fidélité de l'atlas au courant réel (0,2 à 0,3 nd, 15 à 30 min) | 4.6 | Conseils de côté trop affirmés |
| H13 | Interpolation linéaire entre coefficients, extrapolation au-delà de 95 | 4.6 | Courant de grande marée mal dosé |
| H14 | Termes de licence d'EMODnet ; couverture de la rade par Litto3D | 4.5 | Mention à corriger ; pas de meilleurs fonds |
| H15 | Choix des points de grille météo | 5.1 | Variabilité spatiale mal captée |
| H16 | Paquets Python des outils légitimes | Pile | Voir audit |
| H17 | Dates des journées de course du GPEN 2027 dans la fenêtre du 5 au 9 mai (repris de `07-CONTEXT.md`) | 4.2 | Tableau de marée à décaler |

## Questions ouvertes

1. **Limites exactes des zones interdites.** On sait : texte des IC, bouées 0 à 7 et « D ». On ignore : bouées 8 à 10, port militaire, École navale, arrêtés en vigueur. Recommandation : tracer sur la carte marine de la rade et lire les arrêtés de la préfecture maritime ; en attendant, zone large.
2. **Fonds fiables.** On sait : EMODnet à 115 m. On ignore : si Litto3D couvre la rade. Recommandation : commencer avec EMODnet et une marge, chercher Litto3D pour le lot 4.
3. **Vent sur l'eau en direct.** On sait : une station Holfuy existe. On ignore : si une clé sera accordée. Recommandation : la demander ; sinon METAR de Lanvéoc par relais.
4. **Conseils de vent.** On sait : statistiques et calculs de relief. On ignore : l'expérience locale. Recommandation : faire relire le tableau du § 3.6 par un régatier de la rade ou l'encadrement de l'École navale.
5. **Atlas contre réalité.** Recommandation : mesurer la dérive à la première sortie à Brest et noter l'heure des renverses.
6. **Emprise si la zone J80 change.** Les IC 2027 paraîtront vers fin avril 2027 ; l'emprise conseillée couvre toutes les zones de la rade de 2026, pas Morgat.

## Disponibilité de l'environnement

| Dépendance | Requise par | Disponible | Version | Repli |
|------------|-------------|-----------|---------|-------|
| Python 3, numpy, Pillow | Outils de relief | oui | numpy 2.5.3, Pillow 12.3.0 | — |
| `netCDF4`, `utide`, `py7zr` | Outils marée et courants | non installés dans le système ; installés dans un environnement temporaire pour cette étude | 1.7.5.1, 0.4.0, 1.1.4 | Environnement virtuel dédié après contrôle humain |
| Node.js | Tests, prototype | oui | v22.23.5 | — |
| Tuiles de relief, EMODnet, services du Shom, data.gouv.fr | Téléchargement des entrées | oui | — | — |
| Overpass (OpenStreetMap) | Côte, digues, zones urbaines | **non** depuis cet environnement | — | Lancer depuis une autre machine, ou extrait régional d'OpenStreetMap |
| Open-Meteo (prévisions) | Instantané météo | limite quotidienne atteinte sur l'adresse partagée | — | Relancer depuis une autre adresse |

**Bloquant sans repli :** rien. **Avec repli :** l'extraction OpenStreetMap complète.

Les échantillons de cette étude sont dans un dossier temporaire qui peut être effacé ; tout est retéléchargeable avec les adresses citées. Aucun fichier du dépôt n'a été modifié hors de ce document.

## Domaine sécurité

| Catégorie ASVS | Concernée | Contrôle |
|----------------|-----------|----------|
| V2 Authentification, V3 Session | non (inchangé : accès par le middleware) | — |
| V4 Contrôle d'accès | oui | Les fichiers `data/brest.*` restent derrière le middleware, noms plats (D-03) |
| V5 Validation des entrées | oui | Taille et structure des fichiers du pack vérifiées avant usage ; bornes sur les réponses des services externes (hauteur de 0 à 9 m, vent de 0 à 80 nd) ; année hors table = pas de marée |
| V6 Cryptographie | oui | Empreinte du pack par `crypto.subtle` (D-04), rien d'écrit à la main |
| V14 Configuration | oui | Jeton d'un service de mesures seulement en variable d'environnement de la fonction relais, jamais dans le code ni les documents |

| Menace | STRIDE | Parade |
|--------|--------|--------|
| Pack altéré ou tronqué qui fausse courant ou marée | Altération | Empreinte, tailles attendues, valeurs de contrôle aux heures clés |
| Réponse inattendue d'un service externe injectée dans la page | Altération | Lecture par champs numériques, `textContent` ou `esc()` |
| Fuite d'un jeton d'API | Divulgation | Relais côté serveur, liste blanche des stations, cache court |
| Relais utilisé comme passerelle ouverte | Élévation | Adresses en dur côté serveur, aucun paramètre libre |
| Conseil dangereux pris pour une donnée officielle | — (sûreté) | Mention « ne remplace pas les cartes et ouvrages nautiques officiels », marge sur les fonds, courant présenté comme estimation |

## Sources

### Primaires (confiance haute)
- Shom, « Atlas de courants de marée 2D au format netcdf - Finistère », édition juin 2026, Licence Ouverte 2.0, doi 10.17183/ATLASCOURANTS2D_NETCDF : archive téléchargée, fichier de la rade lu, descriptif lu (data.gouv.fr/datasets/atlas-de-courants-de-maree-2d-au-format-netcdf-finistere).
- Shom, REFMAR, marégraphe de Brest : hauteurs horaires validées 2019-2026 et temps réel (services.data.shom.fr/maregraphie).
- Shom, Références Altimétriques Maritimes, service WFS (data.gouv.fr/datasets/references-altimetriques-maritimes).
- Météo-France, « Données climatologiques de base - horaires », Finistère, Licence Ouverte 2.0 (data.gouv.fr).
- Instructions de course du GPEN 2026, version du 13 mai 2026 (cfcl.ffvoile.fr/media/hqmfb4lx/gpen-2026-instructions-de-course-incluant-lavenant1.pdf) : annexes 1, 3.1, 3.4, 5.
- OpenStreetMap, API principale, extraits du 19/11/2026 (ODbL).
- Tuiles d'altitude Terrarium (s3.amazonaws.com/elevation-tiles-prod) ; EMODnet Bathymetry, service WCS.
- Code du dépôt : `tools/build_terrain.py`, `tools/build_basemap.py`, `tools/snapshot_weather.py`, `js/geo.js`, `js/wind.js`, `js/router.js`, `js/tactics.js`, `js/weather.js`, `js/courses.js`, `js/polar.js`, `js/debrief.js`, `js/startmode.js`, `js/app.js`.

### Secondaires (confiance moyenne)
- Open-Meteo, documentation des API marine et Météo-France ; réponses des API relues par un outil de lecture.
- Livret « Rade de Brest », voileaviron.org (2019) : courants et vents de la rade.
- Bateaux.com, F.-X. Ricardou, « Les plaisirs de la navigation dans la rade de Brest et ses rivières », 27/09/2022.
- Holfuy, page de la station 1642 ; aviationweather.gov, API METAR ; api.pioupiou.fr.
- Fiches EMODnet DTM sur sextant.ifremer.fr ; présentation et descriptif Litto3D (Shom – IGN).
- Documentation Météo-France de l'API d'observation.

### Tertiaires (confiance basse)
- Résumés de recherche sur le modèle MARS3D de la rade (Ifremer), sur les arrêtés de la préfecture maritime, sur les éditions anciennes du GPEN.
- Non lu : Voiles et Voiliers, « La rade de Brest (2) : vents et brises » (accès refusé).

## Métadonnées

**Confiance par domaine :**
- Relief et emprise : HAUTE (sources téléchargées, tailles calculées) ; MOYENNE pour les fichiers d'image estimés.
- Repères : HAUTE pour les positions recoupées par deux sources ; MOYENNE pour les feux ; BASSE pour les zones réglementées.
- Vents : HAUTE pour la climatologie mesurée ; MOYENNE pour les effets de site calculés par le modèle de l'app ; BASSE pour les conseils rédigés.
- Marée : HAUTE (méthode contrôlée sur deux années indépendantes, prototype comparé).
- Courants : HAUTE pour le contenu de l'atlas ; MOYENNE pour sa fidélité au réel.
- Météo : HAUTE pour les constats d'accès ; MOYENNE pour les choix de grille.

**Date :** 2026-11-19 — **valable jusqu'à :** 30 jours pour les accès aux services ; fin avril 2027 (IC du GPEN 2027) pour la zone de course ; fin 2031 pour le fichier de marée proposé.
