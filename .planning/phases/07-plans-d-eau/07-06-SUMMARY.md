---
phase: 07-plans-d-eau
plan: 06
subsystem: plan-d-eau-brest
status: complete
tags: [plan-d-eau, brest, zones-interdites, routage, marques, lieux, regimes, vent, d-10, d-12, d-14, d-14b, d-14c]
requires:
  - "07-02 : registre js/venues.js, js/lieu.js (exports vivants), regimeOf lit VENUE.regimes, VENUE.presets, VENUE.texts"
  - "07-03 : pack physique data/brest.* (terrain, couverture, trait de côte)"
  - "07-05 : cvatKey et applyRemoteMarks limités à Toulon (D-12), venueOf par inputBounds"
provides:
  - "js/venue-brest.js : FORBIDDEN_ZONES { name, note, desc, pts } (Île Longue, Pen ar Vir), PLACES (42), MARKS (36, clés non numériques), DANGERS (6), LINE_PRESETS (zoneA, zoneB, zoneC), regimes (8, conseils { t, o }), presets (9), texts.relief, texts.origine"
  - "js/venues.js : zone de Saint-Mandrier sous la forme { name, note, desc, pts } (pts = FORBIDDEN_ZONE de js/courses.js), zonesXY(zones, toXY)"
  - "js/tactics.js : ORIGINES, tipText (chaîne de Toulon telle quelle ; hypothèse « (à confirmer sur l’eau) »)"
  - "js/scene3d.js : setDangers(zones, dangers, labels) — plusieurs zones, étiquette par zone"
  - "js/app.js : zones de Brest au routage et sur la carte, Dangers de Brest (zones, source, « À compléter sur carte marine »), conseils avec leur origine et ligne d’origine"
affects: [07-07, 07-08, 07-09, 07-10]
tech-stack:
  added: []
  patterns:
    - "donnée géographique calculée une fois hors de l’app (script de travail), recopiée en dur avec la méthode en commentaire et contrôlée par test (polygone simple, bouées à 50 m du bord)"
    - "conseil d’un plan d’eau = { t, o } avec son origine ; les chaînes de Toulon restent des chaînes (affichage de la v42 inchangé)"
key-files:
  created: []
  modified:
    - js/venue-brest.js
    - js/venues.js
    - js/tactics.js
    - js/app.js
    - js/scene3d.js
    - tests/brest.test.mjs
    - tests/venues.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "Polygone de l’Île Longue : bouées 0 → 6 bis, puis « D » AVANT 7 (l’ordre « 7 puis D » du plan fait se recouper le contour), rivage est (côte OSM ligne 94, points 26, 24, 19, 15, 13) et isthme (point 62), élargi de 50 m vers l’extérieur"
  - "Couloir de Pen ar Vir : 100 m de large, commencé à 10 m de la cardinale (la bouée reste hors de la zone, on peut l’arrondir), prolongé de 150 m au-delà de la pointe (il chevauche la terre)"
  - "Seuil « mer dégagée » de Brest gardé à 1 500 m : 3 103 cellules de référence, facteur médian de l’eau 0,95 à 1,00 ; avec 4 000 m (Toulon) seules 90 cellules de l’Iroise servent de référence et la rade paraît déventée (médiane 0,78 à 150°)"
  - "Marques : 36 clés courtes non numériques (FIL, MEN, KER, GOU, COR, PEN, REN, RON, DAL, PAV, LA1-LA5, ILE, AU1-AU16, OCE, R1-R6, FO3, PAL, MNZ, EVE) ; ni A, B, C, D, PG, PD, S (banane) ni X1… (bouées d’une régate) ; phares et feux de jetée laissés aux lieux"
  - "Lieux : les 34 de l’étude et 8 trouvés dans l’extrait OpenStreetMap de 07-03 (Brest, Plougastel-Daoulas, Le Relecq-Kerhuon, Landévennec, Camaret-sur-Mer, Crozon, Logonna-Daoulas, Anse du Moulin Blanc) ; École navale (aucun nœud de lieu) et Ménez-Hom (48,2198 N, hors emprise) absents"
  - "Conseils de Brest : origine affichée en tête (« mesure », « modèle de relief », « courant », « source citée », « hypothèse ») et ligne d’origine au bas de la carte « Effets locaux » ; Toulon sans changement"
metrics:
  duration: 35min
  completed: 2026-11-19
  tasks: 3
  files: 10
estimate:
  tokens: 120000
  tasks: 3
actuals:
  tokens: 16154        # chars/4 du diff 0b97023..14a6f99 (64 614 caractères ; 62 029 hors sw.js et js/version.js)
  tasks: 3
  commits: 5
plan_head_before: 0b97023303260cec04ff5ec0660d1c8149435aeb
plan_head_after: 14a6f990a60c7d4896bbcd891d088bb48754f9ec
---

# Phase 7 Plan 06 : Connaissance locale de la rade de Brest Summary

À Brest, la carte nomme 42 lieux, montre 36 marques fixes (IC GPEN 2026 sinon OpenStreetMap, deux « à confirmer ») et 6 dangers ; les zones interdites de l’Île Longue et de Pen ar Vir sont dessinées, évitées par le routage et signalées « à compléter sur carte marine » ; huit régimes de vent aux conseils marqués selon leur origine (hypothèses « à confirmer sur l’eau »), neuf vents prédéfinis, seuil « mer dégagée » de 1 500 m validé ; Toulon inchangé.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | dc4c0e8 | Zones interdites de Brest (`{ name, note, desc, pts }`), zone de Toulon sous la même forme (mêmes points), `zonesXY`, plusieurs zones et leur étiquette sur la carte, Dangers de Brest dans l’onglet Régates ; 6 tests (dont 2 contrôles négatifs), scénario `plan-eau` étendu |
| 2 (TDD) | 2b06b6d (rouge), c198064 (vert) | `PLACES`, `MARKS`, `DANGERS`, `LINE_PRESETS` ; 6 tests (positions contrôlées contre les degrés-minutes de la source, aller-retour de saisie, en mer, hors zones) ; couloir de Pen ar Vir raccourci de 30 m côté cardinale |
| 3 (TDD) | f441b96 (rouge), 14a6f99 (vert) | `regimes`, `presets`, `texts.relief` et `texts.origine`, `ORIGINES` et `tipText`, affichage des origines ; 6 tests ; scénario `plan-eau` étendu (vents de Brest) |

Tracer (tâche 1) : vérification rejouée de bout en bout avant la tâche 2 (mode interactif `end-of-phase`, vérification automatique) : tests brest, venues et toulon verts, gardes vertes, `npm run check` 759 tests (758 verts, 1 sauté), SNPM-OK, « OK plan-eau », « OK toulon-vue ».

## Valeurs retenues et mesurées

- **Lieux** : 42 (34 de l’étude § 2.1, 8 de l’extrait OpenStreetMap) ; **marques** : 36 (8 aux positions des IC GPEN 2026, 2 « approx » : Kerviniou 60 m et Pénoupèle 85 m d’écart entre sources, 26 d’OpenStreetMap) ; **dangers** : 6 ; **positions de ligne** : 3 (zoneA, zoneB, zoneC).
- **Seuil « mer dégagée »** : 1 500 m (gardé). Mesures sur le pack (maille 150 m, 11 260 cellules d’eau intérieures) :

| Seuil | Cellules de référence | Médiane de l’eau 270° / 150° / 45° / 0° | Part de l’eau au-dessus de 1 |
|-------|-----------------------|-------------------------------------------|------------------------------|
| 1 500 m (Brest) | 3 103 | 0,995 / 0,948 / 1,004 / 0,961 | 47 / 37 / 52 / 37 % |
| 4 000 m (Toulon, contrôle négatif) | 90 | 0,950 / 0,781 / 0,908 / 0,794 | 22 / 9 / 10 / 6 % |

- **Dévent (`shel`) mesuré** sur la grille de 30 m, comparé à l’étude § 1.3 (mosaïque Terrarium) : zone A 150° **0,257** (étude 0,26), 270° **0,000** (0,00), 0° **0,000** (0,00), 45° 0,038 ; zone B 270° **0,335** (0,34), 150° 0,295 (0,30), 0° 0,117 (0,12).
- **Routage** : du nord de l’Île Longue à l’est (270°/12 nd) et de part et d’autre de Pen ar Vir, aucun point du chemin dans une zone ; un pas peut rogner un coin de zone (le routeur ne contrôle que les bouts et le milieu d’un pas) : profondeur contrôlée sous 25 m, les bouées restent à 50 m du bord. Contrôles négatifs : sans les zones, la route entre dans la zone balisée de l’Île Longue et passe entre la cardinale et la pointe de Pen ar Vir.

## Vérifications finales (sorties brutes)

Sur 14a6f99 :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
npm run check : stamp à jour · # tests 771 · # pass 770 · # fail 0 · # skipped 1 (instantané météo de Brest absent)
SNPM-OK ; git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : inchangés
PW_REQUIRED=1 node tools/regate-e2e.mjs (tous) : 34/34 scénario(s) OK (plan-eau, toulon-vue, jour-j, regate-brest, brest-avion compris)
```
Version : `v42 · 09/11 · 96960cb043` (`npm run stamp`, 74 fichiers, aucun nouveau module). Tests ajoutés : tests/brest.test.mjs 18 (zones 5, lieux et marques 6, vents 7), tests/venues.test.mjs 1.

Scénario `plan-eau` à Brest : Dangers « Zone interdite — Île Longue … (marques 0 à 10) est interdite (IC GPEN) … À compléter sur carte marine. » et Pen ar Vir, aucune zone de Toulon ; vents prédéfinis de Brest (neuf boutons), « Suroît » → « Effets locaux — Suroît (sud-ouest) », « hypothèse Mer plate près de la côte sud. (à confirmer sur l’eau) », ligne d’origine, aucun conseil de Toulon, ni « État de la mer » ni « Balises en direct ». Capture d’écran de contrôle (Chromium, hors dépôt) : lieux, dangers et étiquette « Zone interdite · à compléter sur carte marine » visibles sur la carte de Brest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ordre des bouées de l’Île Longue**
- **Trouvé pendant :** tâche 1 (calcul du polygone).
- **Problème :** l’ordre du plan « … 6 bis, 7 et « D » » fait se recouper le contour : « D » (48°18,685 N) est au nord-est de 7 (48°18,549 N), le segment D → rivage coupe 6 bis → 7.
- **Correction :** « D » placé avant 7 (contour simple, vérifié par test) ; méthode en commentaire. **Commit :** dc4c0e8

**2. [Rule 1 - Bug] Cardinale de Pen ar Vir dans sa propre zone**
- **Trouvé pendant :** tâche 2 (test « marques hors des zones interdites »).
- **Problème :** le couloir prolongé de 20 m au-delà de la cardinale contenait la bouée : le routage n’aurait jamais pu l’arrondir.
- **Correction :** couloir commencé à 10 m de la cardinale côté pointe ; test « la cardinale reste hors de la zone ». **Commit :** c198064

**3. [Précision] Test « le chemin ne coupe pas le couloir »**
- Le routeur ne contrôle que les bouts et le milieu de chaque pas (comportement de la v42, inchangé : fixture de Toulon). Un pas peut rogner un coin de zone : le test vérifie qu’aucun point du chemin n’est dans une zone, que la route ne coupe jamais l’axe cardinale → pointe, et que la profondeur de rognage reste sous 25 m (bouées à 50 m du bord). Le tracé large de 50 m absorbe ce rognage.

**4. [Précision] Contrôle « couloir à terre »**
- Le prolongement de l’axe cardinale → pointe longe l’ouest de la flèche de sable (eau) : le test vérifie plutôt que le couloir chevauche des cellules de terre à moins de 100 m de la pointe, et le routage prouve l’absence de passage.

**5. [Rule 2] Noms des vents prédéfinis échappés**
- `renderWind` insérait `p[0]` sans `esc()` ; échappé (aucun changement de texte à Toulon, vue `toulon-vue` identique).

**6. [Précision] Tests du seuil et du dévent déjà verts au commit rouge**
- `wind.openSea: 1500` avait été posé en 07-02 : les tests de la tâche 3 le valident (contrôle négatif avec 4 000 m) ; seuls les régimes, conseils et vents prédéfinis étaient rouges.

## Known Stubs

Aucun nouveau. Toujours ouverts : `data/brest.wx-snapshot.json` absent (07-10), `COURSES` de Brest vide et `VENUE_DEF.brest.courseId` banane faute de catalogue du GPEN (07-09).

## Threat Flags

Aucune nouvelle surface : aucune route, aucun en-tête, aucune donnée partagée. T-07-17 appliqué (polygone large, mention « à compléter sur carte marine » sur la carte et dans l’onglet Régates, tests de routage avec contrôles négatifs ; relecture sur carte marine à faire en 07-10). T-07-18 appliqué (origine obligatoire testée, suffixe « (à confirmer sur l’eau) », ligne d’origine au briefing). Aucun code d’accès ni empreinte écrit ou affiché ; aucun appel à l’IA.

## Points pour 07-07

- Les conseils de régime de Brest citent le courant (origine C : « le jusant porte à l’ouest », « le flot porte à l’est », 0,75 nd) : à recouper avec `js/courant.js` une fois l’atlas embarqué, et la ligne d’origine parle déjà « de l’atlas ».
- `tipText` / `ORIGINES` (js/tactics.js) servent à tout nouveau conseil de Brest (marée, courant) : garder la forme `{ t, o }` et `o: 'C'` pour l’atlas.
- `zonesXY(FORBIDDEN_ZONES, toXY)` est la seule entrée des zones au routage : l’option `current` de `route()` doit continuer de recevoir `forbidden` tel quel.
- Le routeur ne contrôle que les bouts et le milieu de chaque pas : avec le courant, des pas plus longs rogneraient davantage les zones ; garder le tracé large ou contrôler la profondeur dans les tests du courant.
- Marques de Brest à clés textuelles : `passages()` du débrief (js/debrief.js) parcourt TOUT `MARKS` ; une trace de Brest relève donc ses passages à moins de 200 m des 36 marques fixes (Aulne n° 4 et n° 6 sont au bord de la zone A), puis `matchCourse` ne retient que les marques des parcours (aucun à Brest avant 07-09). Les « zones les plus ventées » du briefing lisent aussi toutes les marques. À relire quand le catalogue du GPEN (07-09) réutilisera ces clés.

## Self-Check: PASSED
