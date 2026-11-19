---
phase: 07-plans-d-eau
plan: 07
subsystem: plan-d-eau-brest
status: complete
tags: [plan-d-eau, brest, maree, courant, fonds, shom, refmar, atlas-560, d-13, d-14c]
requires:
  - "07-03 : pack physique data/brest.*, entrée EMODnet bathy_brest.tif et sa géoréférence (tools/venues/brest.json)"
  - "07-04 : manifeste data/venues.json généré par npm run stamp, téléchargement du pack (js/pack.js)"
  - "07-06 : conseils { t, o } d’origine « courant » (C) à recouper avec l’atlas"
provides:
  - "data/brest.maree.json (8 075 octets) : 68 constituants, f et V0+u par année 2026-2031, source Shom – REFMAR"
  - "js/maree.js : hauteur(P, ms), extremes(P, t0, t1), mareeEn(P, ms) → { t, pm, bm, marnage, hm, avant, apres, entre }, coefApproche(marnage)"
  - "carte « Marée à Brest » au briefing (Brest seulement), « Marée indisponible » si le fichier manque"
  - "data/brest.courants.{json,bin} (1 257 + 910 946 octets) : atlas 560 du Shom, 13 heures × 2 coefficients, points en mer"
  - "data/brest.fonds.bin (100 828 octets) : fonds EMODnet aux nœuds de l’atlas, zéro des cartes, décimètres"
  - "js/courant.js : chargeAtlas(header, buffer, fonds?), courantEn(A, M, lat, lon) → { u, v } m/s ou null, fondEn(A, lat, lon) → m ou null"
  - "js/venue-brest.js : maree et courant { header, bin, fonds } ; Toulon sans ces champs"
affects: [07-08, 07-09, 07-10]
tech-stack:
  added: []
  patterns:
    - "outil Python hors du dépôt (environnement à part, -I) qui calcule et contrôle ; l’app ne fait que des cosinus et des interpolations (motif 3)"
    - "marée de synthèse { t, avant, apres, entre } dans les tests du courant : heure de marée et marnage maîtrisés sans dépendre de la date"
key-files:
  created:
    - tools/build_maree.py
    - tools/build_courants.py
    - data/brest.maree.json
    - data/brest.courants.json
    - data/brest.courants.bin
    - data/brest.fonds.bin
    - js/maree.js
    - js/courant.js
    - tests/maree.test.mjs
    - tests/courant.test.mjs
    - tests/fixtures/brest-maree-obs.json
    - tests/fixtures/brest-maree-outil.json
    - tests/fixtures/brest-courant-atlas.json
  modified:
    - js/venue-brest.js
    - js/app.js
    - docs/brest-sources.md
    - tools/regate-e2e.mjs
    - data/venues.json
    - sw.js
    - js/version.js
decisions:
  - "Paquets des outils : netCDF4 1.7.5.1.post1, utide 0.4.0, scipy 1.18.1, py7zr 1.1.4 (+ pillow 13.0.0) vérifiés sur PyPI et acceptés par Romain le 19/11/2026 ; environnement à part hors du dépôt, jamais dans l’app ni dans package.json"
  - "Les 68 constituants sont gardés (SA et SSA compris) : 8 075 octets, sous les 10 ko"
  - "Marnage de la marée en cours = pleine mer la plus proche moins la basse mer qui sépare les deux pleines mers encadrant l’instant ; à l’affichage, marnage d’une pleine mer = PM moins la moyenne des deux basses mers voisines (méthode du tableau du GPEN de l’étude)"
  - "Valeurs de contrôle du courant relues au nœud de l’atlas le plus proche (méthode de lecture de l’étude) ; à la position exacte, l’interpolation bilinéaire donne 3,76 nd au milieu du goulet au lieu de 3,59 (fort gradient)"
  - "Fonds EMODnet ramenés au zéro des cartes en ajoutant 0,25 m (PBMA de Brest au-dessus du zéro hydrographique, RAM) au lieu d’assimiler les deux niveaux : fond moins profond de 25 cm, du côté de la sécurité"
  - "Voisins à terre : poids bilinéaires renormalisés sur les nœuds en mer ; null si aucun des quatre nœuds n’est en mer"
metrics:
  duration: 20min
  completed: 2026-11-19
  tasks: 3
  files: 20
estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 33835        # chars/4 du diff 58567de..7975f7a hors data/*.bin, sw.js et js/version.js (135 339 caractères)
  tasks: 3
  commits: 3
plan_head_before: 58567de23b1b3ef055b3c0191a38f38e0b05153c
plan_head_after: 7975f7a9601b502cfadd1b68ef000e1a6a0a9ab5
---

# Phase 7 Plan 07 : Marée et courant de la rade de Brest Summary

À Brest, l’app calcule hors réseau la marée (68 harmoniques ajustées sur le marégraphe du Shom, contrôlées à 14 cm et 3,7 min sur 2025-2026) et l’affiche au briefing ; le courant de l’atlas 560 du Shom (100 m, 13 heures × coefficients 45 et 95, 0,91 Mo) et les fonds vrais sont dans le pack, avec un module qui rend le courant en un point et à un instant, dosé par le marnage ; toutes les valeurs de contrôle de l’étude passent ; Toulon n’a ni marée ni courant.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (porte des paquets) | — | Fiche de contrôle faite (ci-dessous) ; accord de Romain du 19/11/2026 transmis par l’orchestrateur ; environnement neuf hors du dépôt |
| 2 (tracer) | 89714c2 | `tools/build_maree.py`, `data/brest.maree.json`, `js/maree.js`, carte « Marée à Brest », 10 tests, fixtures de 2026, scénario `plan-eau` étendu |
| 3 (TDD) | 917ac7e (rouge), 7975f7a (vert) | `tools/build_courants.py`, `data/brest.courants.{json,bin}`, `data/brest.fonds.bin`, `js/courant.js`, 13 tests, fixture de l’atlas, `docs/brest-sources.md` |

Tracer (tâche 2) : vérification rejouée de bout en bout avant la tâche 3 (mode `end-of-phase`, vérification automatique) : tests maree et venues verts (40), gardes vertes, `npm run check` 781 tests (780 verts, 1 sauté), SNPM-OK, « OK plan-eau », « OK toulon-vue ».

## Fiche des paquets (tâche 1) et décision

| Paquet | Version installée | PyPI (lu le 19/11/2026) | Dépôt de sources | Versions publiées | Licence |
|--------|-------------------|-------------------------|------------------|-------------------|---------|
| netCDF4 | 1.7.5.1.post1 (23/10/2026) | Jeff Whitaker | github.com/Unidata/netcdf4-python | 91 | MIT |
| utide | 0.4.0 (03/09/2026) | Wesley Bowman | github.com/wesleybowman/UTide | 11 | MIT |
| scipy | 1.18.1 (21/08/2026) | projet SciPy | github.com/scipy/scipy | 108 | BSD |
| py7zr | 1.1.4 (12/10/2026) | Hiroshi Miura | github.com/miurahr/py7zr | 166 | LGPL-2.1+ |

Dépôts conformes à ceux attendus par le plan. Décision : **paquets acceptés** par Romain le 19/11/2026 (accord explicite relayé par l’orchestrateur). Installation : `python3 -m venv …/scratchpad/venv-maree` puis `pip install netCDF4==1.7.5.1.post1 utide==0.4.0 scipy==1.18.1 py7zr==1.1.4 pillow` (dépendances : numpy 2.5.5, cftime 1.6.6.1, pillow 13.0.0, pybcj, pyppmd, inflate64, brotli, pycryptodomex…). Rien dans `package.json`, rien dans l’app.

## Marée : écarts mesurés

Sortie de `tools/build_maree.py` (ajustement 2019-2024 sur 51 642 heures, contrôle sur 2025-2026, 15 311 heures non utilisées) :

| Mesure | Obtenu | Étude § 4.2 | Exigence |
|--------|--------|-------------|----------|
| Hauteur, écart-type (quadratique) | 14,2 cm (14,7 cm), 95 % < 31 cm, biais +3,9 cm | 14,7 cm, 95 % < 31 cm, biais +3,9 cm | < 16 cm |
| Heures des PM/BM (2 465) | +0,7 min en moyenne, écart-type 3,7 min, 95 % < 7 min | +0,2 min, 3,5 min, 7 min | < 5 min |
| Hauteurs des PM/BM | biais −3,4 cm, écart-type 14,4 cm, 95 % < 31 cm | −3,4 cm, 14,4 cm | — |
| Principaux constituants | M2 2,051/108,5 ; S2 0,752/148,5 ; N2 0,417/90,2 ; K2 0,215/146,2 | identiques | — |

`js/maree.js` sur les fixtures (576 heures de 2026, fenêtres de 32 h fixées d’avance le 8 et le 22 de chaque mois, 87 extrêmes) : contre l’outil, 1,0 cm en quadratique, **4,1 cm au plus** (< 5 cm) ; contre les observations, écart-type 14,0 cm (biais −3,2 cm) ; extrêmes : heure +1,0 min, **écart-type 3,9 min**, hauteur écart-type 12,4 cm. GPEN 2027 : les 19 extrêmes du 5 au 9 mai sont à 0 à 3 min et 0 à 1 cm du tableau de l’étude. 2032 et 2025 → `null`. L’écart de 3,7 min (contre 3,5 dans l’étude) vient du calcul des extrêmes prédits sur la courbe au pas de 5 min au lieu de la série horaire.

Carte au briefing (samedi 5 décembre 2026, scénario) : « Pleine mer 02:03 · 6,07 m · marnage 3,6 m · coefficient approché 58 / Basse mer 08:18 · 2,43 m / Pleine mer 14:27 · 6,16 m · marnage 3,8 m · coefficient approché 61 / Basse mer 20:48 · 2,30 m », « Hauteurs au-dessus du zéro des cartes. » et la ligne de source.

## Courant : valeurs de contrôle (étude § 6.4)

Vive-eau (marnage 5,90 m), nœud de l’atlas le plus proche de la position de l’étude ; atlas à 5 min (imprimé par l’outil) / `courantEn` sur le fichier compacté :

| Point, heure | Atlas 5 min | `courantEn` | Étude | Tolérance |
|--------------|-------------|-------------|-------|-----------|
| Goulet, milieu Espagnols-Portzic (48,34885 ; −4,53937), PM−3 h | 3,593 nd vers 076,8° | 3,593 nd vers 076,9° | 3,6 nd vers 077° | passe |
| Goulet, PM+4 h | 3,524 nd vers 271,7° | 3,540 nd vers 271,9° | 3,5 nd vers 272° | passe |
| Zone A, centre (48,29843 ; −4,36103), PM−4 h | 0,483 nd vers 107,1° | 0,492 nd vers 108,4° | 0,5 nd vers 107° | passe |
| Zone A, PM+4 h | 0,584 nd vers 274,3° | 0,584 nd vers 273,8° | 0,6 nd vers 274° | passe |
| Zone F, baie de Roscanvel (48,31824 ; −4,52721), PM | 0,684 nd vers 304,1° | 0,701 nd vers 303,7° | 0,7 nd vers 304° | passe |

- Morte-eau (2,80 m) aux mêmes points : goulet 1,43 nd vers 078° et 1,60 nd vers 274° ; zone A 0,20 et 0,23 nd ; zone F 0,22 nd. Le flot porte à l’est dans le goulet à PM−3 h pour 2,80, 4,35 et 5,90 m ; avec la vraie marée du 6 mai 2027 à 14 h 50 (PM−3 h), plus de 3 nd vers l’est.
- Dosage : 5,90 m redonne l’atlas de vive-eau, 2,80 m celui de morte-eau (à 0,01 m/s, pas de codage), 4,35 m leur moyenne (1e-9) ; la morte-eau est plus faible que la règle de trois (piège 6).
- Interpolation entre deux heures contre l’atlas à 5 min (tous les points en mer, vive-eau) : 0,042 nd en quadratique, 99 % < 0,16 nd, 1,42 nd au plus (renverses près des Espagnols) ; sur la fixture (51 nœuds, PM±2 h 30), sous 0,08 nd. Codage : 0,0100 m/s au plus.
- Liaison entre PM+6 h et la PM−6 h suivante : bords égaux aux heures de l’atlas, milieu = moyenne, plus grand écart d’une minute à l’autre sous 0,05 nd (goulet et zone A).
- **Recoupement des conseils de 07-06 (origine C)** : moyenne vectorielle des 389 nœuds de la zone A en vive-eau, 0,749 nd vers 092° à PM−4 h (flot vers l’est) et 0,761 nd vers 270° à PM+4 h (jusant vers l’ouest) : « 0,75 nd », « le flot porte à l’est », « le jusant porte à l’ouest » sont confirmés (test).
- Fonds : zone A −8,2 m (étude −8,7 ± 1,5), milieu du goulet −38,7 m, zone B −4,4 m (zéro des cartes, +0,25 m appliqué).

## Tailles du pack de Brest

| Fichier | Octets |
|---------|--------|
| data/brest.maree.json | 8 075 |
| data/brest.courants.json | 1 257 |
| data/brest.courants.bin | 910 946 (masque 6 302 + 904 644 valeurs) |
| data/brest.fonds.bin | 100 828 |
| **Pack de Brest (10 fichiers, data/venues.json)** | **4 673 496** (3 652 390 avant ce plan ; sous 8 Mo) |

Entrées : 93 mois REFMAR (5 148 745 octets, téléchargés le 19/11/2026 dans un dossier neuf) ; archive de l’atlas 776 319 186 octets (copie de l’étude reprise après contrôle de taille, liée dans un dossier neuf), NetCDF de la rade 233 949 555 octets extrait par l’outil ; empreintes dans `docs/brest-sources.md`. Rien de ces entrées dans le dépôt.

## Vérifications finales (sorties brutes)

Sur 7975f7a :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
npm run check : stamp à jour · # tests 794 · # pass 793 · # fail 0 · # skipped 1 (instantané météo de Brest absent)
tests/courant.test.mjs + tests/maree.test.mjs : # pass 23 · # fail 0
SNPM-OK ; git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : inchangés
PW_REQUIRED=1 node tools/regate-e2e.mjs plan-eau toulon-vue brest-avion regate-brest : 4/4 scénario(s) OK
```
Version : `v42 · 09/11 · e76325c20b` (`npm run stamp`, 76 fichiers dont js/maree.js et js/courant.js).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type d’extrême faux sur deux heures égales (outil)**
- **Trouvé pendant :** tâche 2 (test des extrêmes observés).
- **Problème :** deux hauteurs horaires égales (5,526 m à 19 h et 20 h TU le 8/04/2026) : la parabole retenait l’extrême mais le classait « BM » (`b > a` faux).
- **Correction :** type décidé par la condition de maximum (`b >= a and b > c`) dans les deux recherches d’extrêmes de l’outil ; fixtures et contrôle régénérés (2 465 extrêmes au lieu de 2 462). **Commit :** 89714c2

**2. [Rule 1 - Bug] Nœuds du bord sud refusés par `courantEn`**
- **Trouvé pendant :** tâche 3 (fixture de l’atlas).
- **Problème :** `lat0` arrondi dans l’en-tête (48,248 au lieu de 48,2479999999999) : les nœuds de la première ligne tombaient à −1e-10 maille, hors de la grille.
- **Correction :** tolérance d’un millionième de maille puis coordonnées bornées. **Commit :** 7975f7a

**3. [Rule 2 - Sécurité] Fonds ramenés au zéro des cartes (+0,25 m)**
- Le plan disait d’assimiler la plus basse mer astronomique (référence d’EMODnet) au zéro des cartes « à quelques centimètres près » ; à Brest l’écart est de 25 cm (PBMA 0,25 m, RAM). L’outil ajoute 0,25 m (fond moins profond, côté sécurité) et `docs/brest-sources.md` l’écrit.

**4. [Précision] Lecture des valeurs de contrôle au nœud le plus proche**
- L’étude a lu l’atlas au nœud le plus proche de chaque position ; les tests font de même (`noeud()`), sinon le goulet donne 3,76 nd au lieu de 3,6 (gradient fort : 0,17 nd d’un nœud à la position exacte). La zone A et la zone F passent aussi à la position exacte.

**5. [Ajout] Fixture de l’atlas et test de recoupement**
- `tests/fixtures/brest-courant-atlas.json` (15,7 ko, 51 nœuds, valeurs brutes de l’atlas) vérifie l’ordre de décodage et l’interpolation entre deux heures ; un test recoupe les conseils « courant » de 07-06 avec l’atlas. Hors de la liste de fichiers du plan, dans son esprit (contrôle « le fichier compacté redonne l’atlas »).

**6. [Précision] Forme de `mareeEn` et de `chargeAtlas`**
- `mareeEn` rend en plus `t`, `avant`, `apres`, `entre` (pleines mers qui encadrent l’instant et basse mer entre les deux) : `courantEn(A, M, lat, lon)` en a besoin pour la liaison entre cycles et pour doser chaque côté par son marnage. `chargeAtlas` prend un troisième argument facultatif, les fonds.

**7. [Précision] Accord de la porte des paquets**
- Point de contrôle `blocking-human` de la tâche 1 : l’accord explicite de Romain (19/11/2026) a été transmis par l’orchestrateur au lancement ; la fiche de contrôle a quand même été faite avant l’installation (ci-dessus).

## Exigences

- **BREST-06** : faite (marée calculée hors réseau, contrôlée contre les observations, affichée au briefing).
- **BREST-07** : laissée « en cours » dans REQUIREMENTS.md : ce plan livre les données et le calcul ; l’usage par le routage, les conseils et l’affichage (texte de l’exigence) vient en 07-08. L’outil de mise à jour l’avait cochée d’office ; corrigé à la main.

## Known Stubs

Aucun nouveau. `js/courant.js` n’est appelé par aucune vue ni par le routage : c’est voulu, le routage avec courant, les conseils et les flèches arrivent en 07-08. Toujours ouverts : `data/brest.wx-snapshot.json` absent (07-10), `COURSES` de Brest vide (07-09).

## Contrôle humain à faire (fin de phase)

Romain compare la carte « Marée à Brest » des 5 au 9 mai 2027 (jour réglé dans l’app) à l’annuaire des marées 2027 du Shom ou à maree.shom.fr pour Brest : attendu, heures à moins de 10 min et hauteurs à moins de 20 cm.

## Threat Flags

Aucune nouvelle surface : un fichier de données de plus lu depuis le pack (même origine, derrière le middleware, vérifié par empreinte au téléchargement), contrôlé à la lecture (forme et tailles ; `chargeAtlas` refuse un fichier tronqué ou un en-tête incohérent). T-07-SC appliqué (fiche PyPI, versions épinglées, environnement hors du dépôt), T-07-19 appliqué (dossiers neufs, lecture seule, Python -I, contrôles indépendants, empreintes), T-07-20 appliqué (null hors des années, source et avertissement affichés). Aucun code d’accès ni empreinte de middleware écrit ou affiché ; aucun appel à l’IA.

## Points pour 07-08

- `courantEn(A, mareeEn(P, ms), lat, lon)` : `mareeEn` balaie 28 h au pas de 6 min (~2 ms) ; dans le routage, calculer la marée une fois par pas de temps (ou mettre en cache par tranche de 10 min) et n’appeler `courantEn` (bilinéaire, quelques µs) qu’en chaque point.
- Charger l’atlas avec le pack : `fetch(VENUE.courant.header|bin|fonds)` puis `chargeAtlas(header, buffer, fonds)` ; fichier absent → courant nul et message clair (motif 1 : Toulon ne passe jamais `current`).
- Au milieu du goulet, la valeur entre deux nœuds peut s’écarter de 0,2 nd du nœud voisin (fort gradient) : présenter le courant comme une estimation, arrondi à 0,1 nd.
- `fondEn` rend le fond au-dessus du zéro des cartes (déjà corrigé de +0,25 m) ; hauteur d’eau = `hauteur(P, ms) − fondEn(…)` ; garder la marge d’au moins 1 m (D-14c) et ne pas utiliser `terrain.bin` (fonds écrasés) pour la navigation.
- Rognage des zones interdites : avec le courant, les pas du routeur s’allongent ; garder `zonesXY(FORBIDDEN_ZONES, toXY)` tel quel et contrôler la profondeur de rognage dans les tests (07-06).
- Hors de 2026-2031, `mareeEn` rend null : le routage doit retomber sans courant, avec un message.

## Self-Check: PASSED
