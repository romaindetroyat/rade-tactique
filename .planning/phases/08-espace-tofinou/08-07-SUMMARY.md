---
phase: 08-espace-tofinou
plan: 07
subsystem: plan-d-eau
status: complete
tags: [bormes, tofinou, zones-interdites, levant, bregancon, marques, regimes, vent, etat-de-la-mer, textes-du-lieu]
requires:
  - "08-03 : pack data/bormes.* (côte, couverture, relief) et tools/venues/bormes.json"
  - "08-04 : js/venue-bormes.js (identité, lignes), regimeOf avec liste vide, espace Tofinou"
  - "08-05 : bateau de l’espace (voile d’avant, js/bateau.js)"
  - "08-06 : textes par espace, scénarios tofinou-*"
provides:
  - "js/venue-bormes.js : FORBIDDEN_ZONES (Levant militaire, Brégançon), MARKS (FOU, COF, DAM, CNE, BEN, CAV, ORA), PLACES (46), DANGERS (10, dont le parc de Port-Cros), regimes (8), presets (8), texts (centre, point, relief, origine, mer, courant)"
  - "js/venues.js : merTexte(venue) — lieu et note de la carte « État de la mer » (Toulon : textes de la v43)"
  - "js/tactics.js : legType nomme la voile d’avant de ctx.voileAvant (Tofinou : « Génois » ou « Foc ») ; Naos : « Foc »"
  - "tools/regate-e2e.mjs : scénario bormes-local ; plan-eau attend l’état de #pkGo"
affects: [08-08, 08-09, 08-10]
tech-stack:
  added: []
  patterns:
    - "zone interdite fermée par une bande côtière calculée une fois (enveloppe des disques de 200 m sur le trait de côte du pack), recopiée avec sa méthode"
    - "texte du lieu par descripteur, repli sur la chaîne de la v43 pour Toulon (merTexte)"
key-files:
  created: []
  modified:
    - js/venue-bormes.js
    - js/venues.js
    - js/app.js
    - js/tactics.js
    - tests/bormes.test.mjs
    - tools/regate-e2e.mjs
    - docs/bormes-sources.md
    - sw.js
    - js/version.js
decisions:
  - "Levant : points 27, 3, 4 et 28 de l’étude laissés de côté (dans l’ordre donné, le point 27 est à 1,8 m du segment 3 → 4 : contour qui se touche) ; le segment 26 → 29 ferme l’échancrure à l’est du Titan (tracé large) ; zone 6 tenue interdite toute l’année"
  - "Levant : retour du point 2 (pointe Maupertuis) au point 1 (Tablier) en ligne droite par la terre de l’île ; l’ouest (Héliopolis, Ayguade) et la passe des Grottes restent libres"
  - "Brégançon : les deux points de l’arrêté 110/2023, un arc de 500 m autour du cap, fermeture par la terre au nord ; tracé supposé, « à compléter sur carte marine »"
  - "Bouée de Bénat : aucune position dans l’étude hors « devant le cap Bénat » ; placée à 43,09 N 6,38 E, cohérente avec la longueur du parcours 2 (5,9 M depuis la ligne, 6,4 M depuis le feu, 6,2 M annoncés), `src: 'approx'`"
  - "Conseils à origine double de l’étude : « (D, M) » → D (mesure de Camarat) ; « (M ; mesuré à Hyères, D) » → deux conseils ; « (M, à confirmer) » → origine M avec « à confirmer sur l’eau » dans le texte"
  - "texts.origine sans « atlas » (Bormes n’a pas d’atlas de courant ; l’étude disait « identique à Brest »)"
  - "Classes du CVAT dans l’onglet Parcours et le texte de partage laissées à 08-08 (catalogue et groupes du Challenge de la Baie)"
metrics:
  duration: 25min
  completed: 2026-11-26
estimate:
  tokens: 115000
  tasks: 2
actuals:
  tokens: 19400
  tasks: 2
  commits: 2
plan_head_before: bfb68c20375c2aa2296c9eb2813df475f5c69ce6
plan_head_after: 0cac3e4a0bc472108bc65e1d6ac10792f210a364
---

# Phase 8 Plan 07 : savoir local de la rade de Bormes Summary

La rade de Bormes a son savoir local : la zone militaire du Levant (fermée au nord par une bande de 200 m tracée sur la côte du pack) et les abords de Brégançon sont évités par le routage et marqués « à compléter sur carte marine », La Fourmigue et le coffre 1 sont des marques fixes, les bouées du comité « position à confirmer », 46 lieux, dix dangers dont la réglementation du parc de Port-Cros ; huit régimes de vent exclusifs (le mistral y vient de l’ouest, 260°), chaque conseil marqué selon son origine, huit vents prédéfinis, et une carte « État de la mer » qui nomme la baie et le courant général d’ouest entre les îles en simple information. Aucun de « Cépet », « Saint-Mandrier », « rade de Toulon », « CVAT », « J80 », « Naos » dans les cinq vues de Bormes (restent les libellés de classes du CVAT de l’onglet Parcours, pour 08-08) ; Toulon et Brest identiques (toulon-vue, plan-eau, brest-courant, naos-cles, gel v43, gardes).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 10277f1 | Zones, marques, lieux, dangers ; 10 tests (zones, bande de 200 m, Brégançon, lieux, marques, dangers, distances, deux routages) ; docs/bormes-sources.md |
| 2 (tdd) | 0cac3e4 | Régimes, vents prédéfinis, textes, `merTexte`, carte « État de la mer », `pickHTML` hors de Naos, voile d’avant dans le type de bord ; 8 tests ; scénario bormes-local ; plan-eau rendu robuste |

Tracer (tâche 1) : `<verify>` complet rejoué avant la tâche 2 (tests, stamp, `npm run check`, gardes) plus tofinou-demarrage, tofinou-bateau, tofinou-identite et naos-cles : vert, expansion poursuivie. Tâche 2 : tests écrits d’abord, rouges (`merTexte` absent de js/venues.js : le fichier de test ne se chargeait pas), puis verts.

## Bande de 200 m du Levant (méthode)

Script du dossier de travail de la session (hors dépôt), lancé une fois sur `data/bormes.coast.json` dans la projection de Bormes :

1. Côte du Levant : ligne 2 du trait de côte (531 sommets, du sud de l’île par la pointe est jusqu’à la calanque du Tablier, à 14 m du point 1 de l’arrêté) ; le reste de l’île est fait de 14 petites lignes (ouest, Héliopolis), recollées pour les contrôles de distance.
2. Côte nord, du sommet au droit du point 23 (indice 365) au Tablier, densifiée tous les 5 m ; pour chaque abscisse (pas de 10 m) du point 1 au point 23 : limite nord de l’union des disques de 200 m centrés sur la côte. Un premier essai par décalage des sommets le long de la normale faisait des boucles (côte découpée) : abandonné.
3. Simplification Douglas-Peucker (10 m), sommets relevés de 18 m, puis ceux d’une portion nord-sud de la côte (vers 6,459° E) poussés vers le large par pas de 2 m : chaque point des arêtes de la bande (contrôlé tous les 5 m) est à **200,8 à 233,6 m** de tout le trait de côte du pack. 57 sommets.
4. Contour : point 1, bande, points 23, 24, 25, 26, 29, 30, 6, 7, point 2, retour au point 1 par la terre (un seul point de ce segment en mer sur 101 : le point 1). 67 sommets, polygone simple.
5. Contrôles du script, repris par les tests : phare du Titan et L’Esquillade dedans ; pointe de Port-Man, passe des Grottes, bouée de l’Ayguade, Héliopolis (centre des 670 points « urbain » de l’ouest de l’île dans le pack : 43,0188 N 6,4374 E ; aucun dans la zone) et le point 42,99 N 6,48 E dehors.

Brégançon : deux points de l’arrêté 110/2023 (à 306 et 470 m du cap), arc de 500 m (relèvements 180° à 330°, tous en mer), deux points sur la terre au nord ; le cap (43,0916 N 6,3216 E) dedans, la Galère, la pointe du Diable et le coffre 1 dehors.

## La Fourmigue sur la terre

La Fourmigue est une cellule de terre du pack (test de 08-03). Comme la Roche Mengam à Brest, rien de particulier : js/router.js teste l’arrivée sur la marque avant la terre et la zone, donc le routage l’atteint et la route s’arrête exactement sur la marque (tests : depuis la ligne du Lavandou et depuis 43,09 N 6,42 E par 270°/10 nd, dernier point à moins de 30 m — en fait sur la marque). Kind `tourelle` (repère admis à terre par le test des marques, comme à Brest) ; La Dame aussi en `tourelle` (l’étude : « cardinale est (tourelle) »).

## Conseils marqués H (à faire relire par un régatier de la baie, contrôle humain de 08-09)

| Régime | Conseil (affiché suivi de « (à confirmer sur l’eau) ») |
|--------|------------------|
| Calme / très petit temps | Le nouveau vent arrive par le large : rester au large de la baie plutôt qu’au pied des Maures. |
| Mistral (ouest) | Rafales qui tombent du relief, mer plate sous Bénat. |
| Ouest modéré | Vent irrégulier près de la côte de Bormes. |
| Nord-ouest à nord | Rafales et rotations. |
| Est | La mer entre dans la baie. |

Conseils du modèle signalés douteux dans leur texte (origine M, « à confirmer sur l’eau ») : sud-est (« 20 % de vent en moins dans la baie et 20° de rotation à gauche : valeur incertaine pour une brise de mer ») et sud (« jusqu’à la moitié du vent au fond de la baie : probablement trop », piège 8). Tout le tableau du § 3.6 est à relire (l’étude n’a aucune mesure dans la baie elle-même).

## Sorties brutes

Tests nouveaux (tests/bormes.test.mjs, extraits) :
```
ok 15 - zones interdites de Bormes : Levant militaire et Brégançon, « à compléter sur carte marine », polygones simples dans l’emprise
ok 16 - zone du Levant : Titan dedans ; Port-Man et passe des Grottes dehors, ouest de l’île (Ayguade, Héliopolis) libre
ok 17 - zone du Levant fermée au nord par la bande de 200 m : chaque arête de la bande à 200 à 240 m de la côte du pack
ok 18 - zone de Brégançon : contient l’îlot du fort, passe par les deux points de l’arrêté 110/2023, laisse libres la Galère et la pointe du Diable
ok 19 - lieux de Bormes : les 46 nœuds du tableau de l’étude § 2.4, dans l’emprise, forme [nom, lat, lon, type], aucun lieu sans nœud inventé
ok 20 - marques de Bormes : La Fourmigue et coffre 1 fixes aux positions de l’étude, bouées mouillées « position à confirmer », clés courtes non numériques
ok 21 - marques de Bormes en mer (sauf tourelles et balises), hors des zones interdites ; dangers de l’étude et information du parc de Port-Cros
ok 22 - distances de contrôle (étude § 2.2) : feu du Lavandou → La Fourmigue 2,24 M ; La Fourmigue → pointe de Port-Man 5,55 M (± 0,05)
ok 23 - routage à Bormes (270°/10 nd) : La Fourmigue → sud du Levant (42,99° N 6,48° E) ne coupe aucune zone ; sans zone, la route traverse le Levant militaire
ok 24 - routage à Bormes : une route de la ligne du Lavandou vers La Fourmigue (îlot, cellule de terre) arrive à 30 m de la marque
ok 25 - régimes de Bormes : huit, exclusifs — chaque direction (0 à 359°) et chaque force (0 à 30 nd) dans exactement un régime
ok 26 - régimes de Bormes : le mistral vient de l’ouest (piège 1) — 260° 20 nd « Mistral (ouest) », 260° 10 nd ouest, 75° 14 nd est, 130° 7 nd sud-est, 330° 8 nd nord, 3 nd calme
ok 27 - conseils de Bormes : chacun porte son origine (D, M, S, H) ; une hypothèse s’affiche « à confirmer sur l’eau » ; doutes du modèle par sud signalés (piège 8)
ok 28 - vents prédéfinis de Bormes : les huit de l’étude § 3.6 ; chacun dans le régime attendu
ok 29 - textes du lieu de Bormes : milieu de la baie, relief des Maures et de Bénat, liens neutres, point marin gardé ; aucun texte de Toulon
ok 30 - carte « État de la mer » : Toulon garde les textes de la v43 à l’octet ; Bormes nomme sa baie et le courant général d’ouest entre les îles (information) ; Brest sans point marin
ok 31 - js/app.js : la carte « État de la mer » prend lieu et note dans merTexte(VENUE) ; plus de « large de Cépet » en dur ; parcours hors du cahier CVAT seulement pour Naos
ok 32 - type de bord : voile d’avant du bateau (« Génois » au Tofinou) ; sans voile passée (Naos), « Foc » de la v43
```
Distances mesurées : feu du Lavandou → La Fourmigue 2,243 M ; La Fourmigue → pointe de Port-Man 5,548 M.

Vérifications finales :
```
npm run check : 963 tests, 961 verts, 2 sautés (instantanés météo de Brest et de Bormes absents), 0 échec
node tools/gardes-toulon.mjs : OK SNPM · OK données de Toulon · OK modules du mode départ · OK tests figés · OK gel de Naos v43 · OK pack de Brest
git diff --quiet f80c365 -- js/courses.js tests/reference/ : vrai ; git diff --quiet 5e9b8a5 -- data/brest.* : vrai
git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : vrai
node tools/stamp.mjs --check : à jour (stamp v43 · 19/11 · a80aa95032 · 83 fichiers ; aucun module nouveau)
PW_REQUIRED=1 node tools/regate-e2e.mjs bormes-local tofinou-demarrage toulon-vue plan-eau brest-courant naos-cles tofinou-bateau tofinou-identite :
OK bormes-local · OK tofinou-demarrage · OK toulon-vue · OK plan-eau · OK brest-courant · OK naos-cles · OK tofinou-bateau · OK tofinou-identite
Bilan : 8/8 scénario(s) OK
```
Après la tâche 1 seule : `PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-demarrage tofinou-bateau tofinou-identite naos-cles` : 4/4 OK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Contour dégénéré] Points 27, 3, 4 et 28 du Levant**
- **Trouvé pendant :** tâche 1 — dans l’ordre de l’étude (… 26, 27, 3, 4, 28, 29 …), le point 27 est à 1,8 m du segment 3 → 4 : le contour se touche lui-même et laisse un couloir ouvert à l’est du Titan jusqu’à la bande côtière.
- **Correction :** segment 26 → 29 (tracé large, plus de zone interdite, jamais moins) ; méthode et points écartés écrits dans le descripteur et docs/bormes-sources.md. À vérifier sur l’arrêté (08-09).
- **Commit :** 10277f1

**2. [Rule 2 - Voile d’avant du Tofinou] « Foc » affiché pour le génois**
- **Problème :** point transmis par 08-05/08-06 — `legType` nommait toujours la voile d’avant « Foc » ; le Tofinou court au génois par défaut.
- **Correction :** `legType(twa, tws, avant = 'Foc')`, `ctx.voileAvant` posé par js/app.js hors de Naos (« Génois » ou « Foc » selon `rade.bateau.v1`, mis à jour au changement de voile). Naos ne passe rien : « Foc » de la v43. js/tactics.js hors de la liste du plan. « Spi asymétrique » gardé (le certificat du sister-ship a un spi asymétrique de 70 m²).
- **Commit :** 0cac3e4

**3. [Rule 1 - Texte de Toulon] « pas un parcours du cahier CVAT » à Bormes**
- **Correction :** hors de Naos, « pas un parcours du plan d’eau » ; Naos (Toulon et Brest) inchangé à l’octet (WINDOWS n° 13 fermé).
- **Commit :** 0cac3e4

**4. [Rule 3 - Scénario] Briefing lu sur la prévision de l’heure de départ**
- **Problème :** pour montrer la carte « État de la mer », bormes-local met des prévisions dans le cache de l’espace (instantané de Toulon décalé au 5/12) ; le briefing prend alors la prévision de l’heure de départ, même en vent manuel (comportement existant, Naos compris, non modifié) : régime « Calme ».
- **Correction :** dans la copie de l’instantané, vent de chaque modèle et de la grille remplacé par le vent manuel du scénario.
- **Commit :** 0cac3e4

**5. [Rule 1 - Scénario instable] plan-eau**
- **Problème :** « #pkGo désactivé » lu avant que la carte soit repeinte (échec sous charge relevé en 08-06).
- **Correction :** attente de l’état du bouton (`disabled` vrai puis faux, 10 s au plus) avant les mêmes assertions ; intention inchangée.
- **Commit :** 0cac3e4

### Interprétations
- 46 lieux et non 44 : le tableau du § 2.4 en compte 46, tous dans l’emprise ; aucun lieu sans nœud n’est placé (baie de Bormes, La Favière, Héliopolis…).
- Bouée de Bénat placée à 43,09 N 6,38 E (seule indication : « devant le cap Bénat »), cohérente avec la longueur du parcours 2 ; `src: 'approx'`. Bouée orange au milieu du segment ligne du Lavandou – La Fourmigue (plan).
- Sèche de Gouron : aucune position relevée, non placée (notée dans docs/bormes-sources.md).
- Information du parc de Port-Cros rangée dans `DANGERS` (point de l’île), avec « À compléter sur carte marine » : affichée dans l’onglet Régates.
- `merTexte` dans js/venues.js (hors de la liste du plan) pour tester le texte de la carte sans le DOM ; js/app.js n’a plus « large de Cépet » en dur, la chaîne de la v43 vit dans js/venues.js (HTML de Toulon identique : aucune chaîne échappée par `esc`).
- Note du courant : « modèle de surface (maille de 8 km) » sans nom de produit (l’étude le nomme « MeteoFrance SMOC » via Open-Meteo, Toulon écrit « Copernicus »).
- Étiquette des zones sur la carte : celle du moteur, « Zone interdite · à compléter sur carte marine » (sans le nom de la zone, comme à Brest) ; le nom est dans l’onglet Régates.

## Known Stubs

| Fichier | Stub | Raison | Plan |
|---------|------|--------|------|
| js/venue-bormes.js | `COURSES: []` (banane seule) ; classes du CVAT (« C–D–L–R1-R3 », « P1–P2 ») dans l’onglet Parcours et le texte de partage à Bormes | catalogue et groupes du Challenge de la Baie | 08-08 |

Inscrit dans .planning/WINDOWS.md (n° 14) ; n° 10 (carte « État de la mer »), 11 (savoir local vide) et 13 (« cahier CVAT ») fermés.

## Threat Flags

Aucune surface nouvelle : T-08-24 (tracé large, zone 6 toute l’année, « à compléter sur carte marine », lecture de l’arrêté en vigueur demandée dans la description), T-08-25 (`src: 'approx'`, « position à confirmer »), T-08-26 (origine de chaque conseil, hypothèses affichées comme telles, liste H ci-dessus pour 08-09). Aucune installation de paquet.

## Points pour 08-08

- Banane par vent d’ouest : de la ligne du Lavandou (43,133 N 6,381 E), B et C restent en mer jusqu’à environ 0,7 Nq de Dist. B par 260° ; de La Favière (43,123 N 6,376 E) environ 0,4 Nq ; du milieu de la baie (43,120 N 6,392 E, `windRef`) environ 1,4 Nq (calcul approché de cette session). La banane par défaut (0,8 Nq) depuis la ligne du Lavandou met donc B et C à terre par mistral (vu dans bormes-local : « B (au vent), C (dégagement) tombent à terre »). Les lignes sont « inchangées » dans ce plan : à trancher avec le catalogue (ligne au large par vent d’ouest, Dist. B par défaut plus courte, ou parcours côtiers).
- Champ par 6 nd de sud faible près du Lavandou : c’est le doute du modèle signalé par le conseil « sud » (piège 8) ; ne pas régler le modèle avant une mesure sur l’eau.
- Marques déjà prêtes pour le catalogue : FOU, COF (fixes), DAM (« sa cardinale »), CNE, BEN, CAV, ORA (mouillées, `approx`) ; clés non numériques, hors des clés de la banane et des X1… d’une régate ; La Fourmigue atteinte par le routage malgré l’îlot.
- Parcours 6 et 10 (tour de Port-Cros) : la zone du Levant laisse libre la passe des Grottes (méridien 006°26,262 E au sud de Maupertuis) ; vérifier qu’un tour de Port-Cros « La Dame à tribord » se route entre Port-Cros et le Levant.
- Classes (« C–D–L–R1-R3 », « P1–P2 ») de l’onglet Parcours et `S.cls` du texte de partage (`openShare`, js/app.js) : propres au CVAT ; à remplacer à Bormes par les groupes du Challenge (groupe 3 / groupe 4) ou à masquer, Naos inchangé.
- La prévision de l’heure de départ prime sur le vent manuel au briefing quand des prévisions sont chargées (comportement de la v43) : à garder en tête pour les scénarios à vent fixé.

## Self-Check: PASSED

- FOUND : js/venue-bormes.js, js/venues.js, tests/bormes.test.mjs, docs/bormes-sources.md, tools/regate-e2e.mjs
- FOUND : 10277f1, 0cac3e4 (ancêtres de HEAD) ; 2 commits mesurés entre plan_head_before et plan_head_after
