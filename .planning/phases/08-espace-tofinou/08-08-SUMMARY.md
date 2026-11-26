---
phase: 08-espace-tofinou
plan: 08
subsystem: regates-et-plan-d-eau
status: complete
tags: [tofinou, bormes, challenge-de-la-baie, jours-de-course, graine, archive, catalogue, banane, port-cros]
requires:
  - "08-04 : graines par espace (seedGpen({ graines })), js/espaces.js, archive par espace"
  - "08-07 : marques FOU, COF, DAM, CNE, BEN, CAV, ORA ; zones du Levant et de Brégançon ; lignes « lavandou » et « faviere »"
provides:
  - "js/regates.js : joursOf, MAX_JOURS, BAIE_ID, BAIE_AT, BAIE_SEED_KEY, BAIE_SOURCE, BAIE_JOURS, BAIE_IC, baieSeed, seedBaie ; regattaStatus, lockDates, daysOf lisent `jours`"
  - "js/archmerge.js : `jours` dans HEAD et FICHE (duel de la fiche) ; api/archive.js : contrôle de `jours` dans cleanDoc (1 à 30 dates réelles)"
  - "js/gel.js, js/attach.js : sceau du vent du jour et rattachement des traces par jour de course"
  - "js/venue-bormes.js : COURSES du Challenge de la Baie (19 parcours), points de passage PCS et BAG, ligne « baie », lineDefaut, sansClasses"
  - "tests/helpers/jours.mjs + tests/fixtures/jours-v43.json (statut, verrou, ouverture, jours, sceau, rattachement capturés sur 5e9b8a5)"
  - "tools/regate-e2e.mjs : scénario baie"
affects: [08-09, 08-10, 08-11]
tech-stack:
  added: []
  patterns:
    - "champ facultatif d’une régate (`jours`) : absent = code de la v43 exécuté tel quel, prouvé par une référence capturée sur l’extraction de 5e9b8a5"
    - "réglage de descripteur de plan d’eau (`lineDefaut`, `sansClasses`) lu avec repli sur la valeur de Toulon (`?? 'vignettes'`, absent)"
key-files:
  created:
    - tests/helpers/jours.mjs
    - tests/fixtures/jours-v43.json
  modified:
    - js/regates.js
    - js/archmerge.js
    - api/archive.js
    - js/espaces.js
    - js/app.js
    - js/gel.js
    - js/attach.js
    - js/regview.js
    - js/icread.js
    - js/venue-bormes.js
    - tests/regates.test.mjs
    - tests/apiarchive.test.mjs
    - tests/archmerge.test.mjs
    - tests/espaces.test.mjs
    - tests/bormes.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "Fiche baie-2026-2027 : huit jours de course pour sept manches (finale les 10 et 11/04/2027), une manche par jour sans heure (identifiant fixe m + jour), premier signal 11:00 dans les IC (firstWarning), instant commun BAIE_AT = 26/11/2026 00 h UTC, sans auteur"
  - "Régate à `jours` : « En cours » ces jours seulement, « En préparation » avant le dernier, « Terminée » après ; verrou sur ce seul jour ; sceau du vent au premier signal des IC CHAQUE jour (sinon fin de ce jour) ; trace rattachée à un jour de course seulement, proposée la veille ou le lendemain"
  - "Archive de Naos : aucune réserve ajoutée (politique de la v43 gardée à l’octet) ; la fiche n’y arrive jamais car le serveur décide de l’espace (testé : rien sous prod/ ni preview/)"
  - "Catalogue : identifiants = numéro officiel ; sens inverse = numéro + 50 ; parcours 5 du groupe croisière = 25 (sens inverse 75) ; banane n° 4 = 4 ; tous < 90"
  - "Tour de Port-Cros et de Bagaud (6, 10) : deux points de passage de l’app (PCS au sud de la Gabinière 42,975 N 6,400 E ; BAG à l’ouest de Bagaud 43,012 N 6,335 E), kind « passage », jamais des bouées ni « position à confirmer » ; île et La Dame à tribord = sens des aiguilles d’une montre"
  - "Banane n° 4 : ligne « Milieu de la baie (banane n° 4, position à confirmer) » 43,120 N 6,392 E (point de référence du vent), sans recentrage ; à 1,12 M au moins de toute terre du pack dans toutes les directions ; réglages imposés : sans dégagement, une bouée sous le vent, deux tours, arrivée sur la ligne, bâbord (l’annexe ne donne pas le côté)"
  - "Ligne par défaut du plan d’eau (`lineDefaut: 'lavandou'`) gardée → chaque parcours part de sa ligne (`line`) ; Toulon et Brest : `?? 'vignettes'`, règle de la v42"
  - "Parcours par défaut de Bormes : la banane n° 4 (et non plus la banane de l’app, 90, que le mistral met à terre depuis la ligne du Lavandou)"
  - "Classes du CVAT masquées à Bormes (onglet Parcours, texte de partage) : tous les parcours du Challenge sont les mêmes pour tous les groupes"
metrics:
  duration: 24min
  completed: 2026-11-26
estimate:
  tokens: 120000
  tasks: 2
actuals:
  tokens: 17700
  tasks: 2
  commits: 2
plan_head_before: 46c42cc36ea6e24b29aa882cc4e20fe802bef995
plan_head_after: a6b26279b5742d8d117d9bc85ab835e472c4b311
---

# Phase 8 Plan 08 : Challenge de la Baie 2026-2027 Summary

L’espace Tofinou sème une fois la fiche « Challenge de la Baie 2026-2027 » (sept manches sur huit dimanches et samedi de finale, manche 1 le dimanche 11/10, VHF 72, RIR, un tour, briefing 10 h, premier signal 11 h, DNS après 4 minutes, bout-dehors pour le spi), « En cours » et verrouillée les seuls jours de course grâce au champ `jours` que l’archive Tofinou garde et contrôle ; Bormes propose le catalogue de l’annexe (côtiers 1, 2, 3, 5 régate et croisière, 6, 7, 9, 10, leurs sens inverses « R », banane n° 4 au milieu de la baie), sans aucune classe du CVAT. Naos : aucune fiche, clé, requête, texte ni vue nouvelle (gel v43, naos-cles, toulon-vue, gardes verts).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 127f577 | `jours` (statut, verrou, ouverture, manches, sceau, rattachement), fiche et graine du Challenge, `jours` dans la fusion et l’archive, graine de l’espace Tofinou, marqueur retiré à l’adoption, scénario baie |
| 2 (tdd) | a6b2627 | 19 parcours de Bormes, points de passage du tour de Port-Cros, ligne « baie », ligne propre au parcours, classes masquées, longueur annoncée, scénario baie complété |

Porte du tracer (tâche 1) : `<verify>` complet rejoué avant la tâche 2 (tests, stamp, `npm run check`, gardes, Chromium) : vert, expansion poursuivie.

## Identifiants retenus

| Id | Parcours | Id R | Sens inverse |
|----|----------|------|--------------|
| 1 | Parcours 1 — cap Nègre, La Fourmigue : CNE t, FOU t | 51 | FOU b, CNE b |
| 2 | Parcours 2 — Bénat, La Fourmigue : BEN b, FOU b | 52 | FOU t, BEN t |
| 3 | Parcours 3 — La Fourmigue, bouée orange : FOU t, ORA t, FOU t | 53 | FOU b, ORA b, FOU b |
| 4 | Parcours 4 — banane (construite) : 1, bouée sous le vent, 1, arrivée | — | — |
| 5 | Parcours 5 — coffre 1 (groupe régate) : FOU t, COF b, FOU b | 55 | FOU t, COF t, FOU b |
| 25 | Parcours 5 — coffre 1 (groupe croisière) : COF b | 75 | COF t |
| 6 | Parcours 6 — tour de Port-Cros : FOU t, DAM t, PCS t, BAG t | 56 | BAG b, PCS b, DAM b, FOU b |
| 7 | Parcours 7 — La Fourmigue, coffre 1 : FOU t, COF t, FOU b | 57 | FOU t, COF b, FOU b |
| 9 | Parcours 9 — Cavalaire, La Fourmigue : CAV t, FOU t | 59 | FOU b, CAV b |
| 10 | Parcours 10 — Port-Cros, bouée orange, La Fourmigue : DAM t, PCS t, BAG t, ORA t, FOU t | 60 | FOU b, ORA b, BAG b, PCS b, DAM b |

Pas de parcours 8 (absent de l’annexe). Le 7 R a la même suite que le 5 du groupe régate : c’est ce que donnent l’ordre inverse et les côtés échangés. La banane de l’app (90) reste proposée après le catalogue.

## Longueurs calculées (route directe depuis « Devant Le Lavandou ») contre l’annexe

| Parcours | Calculé | Annoncé | Note |
|----------|---------|---------|------|
| 1 / 51 | 7,45 M | 7,8 M | bouée de cap Nègre placée sur le croquis |
| 2 / 52 | 5,90 M | 6,2 M | bouée de Bénat supposée (08-07) |
| 3 / 53 | 5,72 M | 4 à 8 M | bouée orange au milieu ligne – La Fourmigue |
| 5, 7 / 55, 57 | 15,04 M | 16,5 M (7) | la ligne droite La Fourmigue → coffre 1 coupe le massif de Bénat : la route réelle est plus longue |
| 25 / 75 | 10,58 M | — | aller-retour au coffre 1 |
| 6 / 56 | 21,09 M | 20 M | avec les deux points de passage ; 21,1 Nq aussi dans l’onglet Parcours (scénario baie) |
| 9 / 59 | 17,10 M | environ 20 M | bouée Cavalaire placée sur le croquis |
| 10 / 60 | 23,20 M | — | |

Bornes du plan testées : 1 entre 7 et 9 M, 2 entre 5,5 et 7 M, 6 entre 18 et 22 M, 7 entre 15 et 18 M (et leurs R) ; 3 entre 4 et 8 M.

## Banane n° 4 et ligne du milieu de la baie

Distance à la terre du pack depuis 43,120 N 6,392 E, tous les 10° : au moins 1,12 M (280°, vers Bormes), 1,24 M (270°), 1,46 M (260°), 1,48 M (0°), plus de 3 M vers l’est et le sud. À la distance par défaut (Dist. 1 = 0,8 M), la bouée 1, la bouée sous le vent et la ligne restent en mer et hors des zones par les 36 directions (test). Par 280° avec Dist. 1 = 1,5 M, `banHorsEau` nomme « 1 » : l’alerte « tombe à terre » de l’onglet Parcours reste affichée. Deux autres points essayés : 43,122 N 6,386 E (0,84 M au plus près) et 43,118 N 6,395 E (0,82 M, vers La Fourmigue), écartés.

## Sorties brutes

Tâche 1 (extraits) :
```
ok - jours : sans jours, statut, régate du jour, verrou, ouverture, jours, sceau et rattachement d’une trace identiques à la v43 (tests/fixtures/jours-v43.json, capturé sur 5e9b8a5)
ok - jours : « En cours » les jours de course seulement, « En préparation » entre deux, « Terminée » après le dernier ; minuit de Paris
ok - jours : verrou « journée de régate » et ouverture au démarrage le jour d’une manche seulement
ok - jours : sceau du vent du jour au premier signal des IC CHAQUE jour de course, sinon à la fin du jour ; trace rangée dans la régate de son jour seulement
ok - seedBaie : fiche baie-2026-2027 semée une seule fois dans l’espace Tofinou (marqueur rade.seed.baie.v1), jamais ressemée après suppression ; sans effet chez Naos
ok - fiche du Challenge de la Baie : sept manches (huit jours), manche 1 le dimanche 11/10, Bormes, règles de l’avis et des fiches de course, aucun nom de personne
ok - cleanDoc : jours de course gardés (1 à 30 dates AAAA-MM-JJ réelles), sinon retirés sans refuser la régate ; Naos sans jours inchangé
ok - fiche du Challenge de la Baie : acceptée par l’archive Tofinou (rangée sous tofinou/, jours relus par un second téléphone), jamais vue par l’archive de Naos
node --test … regates racelock apiarchive archmerge naos : 174 pass, 0 fail
PW_REQUIRED=1 node tools/regate-e2e.mjs baie gpen retour-port jour-j naos-cles tofinou-demarrage espace-garde tofinou-identite tofinou-bateau : 9/9 OK
```
Tâche 2 : rouge d’abord (nouveau tests/bormes.test.mjs joué sur l’extraction de 127f577 : 16 échecs, catalogue absent), puis vert :
```
node --test … bormes banane naos : 93 pass, 0 fail (1 sauté : instantané météo de Bormes absent, WINDOWS n° 9)
```
Vérifications finales :
```
npm run check : 987 tests, 985 verts, 2 sautés (instantanés météo de Brest et de Bormes absents), 0 échec
node tools/stamp.mjs --check : stamp à jour (v43 · 19/11 · c4964842e8 · 83 fichiers ; aucun module public nouveau)
node tools/gardes-toulon.mjs : OK SNPM · OK données de Toulon · OK modules du mode départ · OK tests figés · OK gel de Naos v43 · OK pack de Brest
git diff --quiet f80c365 -- js/courses.js tests/reference/ : vrai ; git diff --quiet 5e9b8a5 -- data/brest.* : vrai
git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : vrai
PW_REQUIRED=1 node tools/regate-e2e.mjs baie bormes-local banane naos-cles toulon-vue tofinou-demarrage tofinou-bateau tofinou-identite gpen jour-j retour-port espace-garde plan-eau regate-brest :
Bilan : 14/14 scénario(s) OK
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correction] Sceau du vent du jour et rattachement des traces d’une régate en saison** — js/gel.js, js/attach.js (hors de la liste du plan). Sans cela, le vent d’un jour de course n’était scellé qu’au 12/04/2027 (« fin du dernier jour ») et une trace de n’importe quel jour d’octobre à avril était rangée dans le Challenge. Avec `jours` : sceau au premier signal des IC chaque jour (sinon fin de ce jour), trace rattachée aux jours de course seulement. Sans `jours` : sortie identique à la v43 (fixture). Commit 127f577.

**2. [Rule 1 - Texte faux] Mention de la fiche semée** — js/regview.js et js/icread.js disaient « Fiche semée par l’app (IC 2026) — à vérifier avec les IC 2027 » (texte du GPEN) : pour le Challenge, « Fiche semée par l’app (avis de course et fiches de course 2026-2027) — à vérifier sur la fiche de course de chaque manche. » ; dates affichées « 8 jours de course, du … au … ». GPEN et Naos inchangés. Commit 127f577.

**3. [Rule 2 - Marqueur orphelin] Adoption d’un autre espace** — `rade.seed.baie.v1` retiré avec l’index et le marqueur du GPEN : sinon un appareil revenu à Tofinou n’aurait plus jamais semé la fiche. Rien d’écrit chez Naos. Commit 127f577.

**4. [Rule 1 - Scénarios] tofinou-demarrage (via tofinouSansNaos), espace-garde** attendaient un index vide et une archive Tofinou à une seule régate : ils attendent maintenant la seule graine de Tofinou et son marqueur. Commit 127f577.

**5. [Rule 3 - Modélisation] Points de passage PCS et BAG** — le routage ne sait que rejoindre des points : pour « Port-Cros et sa cardinale à tribord » (tour de Port-Cros et de Bagaud), deux points au large de la Gabinière et de Bagaud, dits « ce n’est pas une bouée ». Sans eux, la route reviendrait par la passe des Grottes et le 6 ferait 16 M au lieu de 20. Commit a6b2627.

**6. [Décision du plan] Banane n° 4 et parcours par défaut** — ligne « Milieu de la baie », parcours par défaut de Bormes = 4 ; tofinou-demarrage attend la banane n° 4, tofinou-bateau choisit la banane de l’app (90) pour garder sa mesure génois / foc. Commit a6b2627.

**7. [Rule 2 - WINDOWS n° 14] Classes du CVAT** — masquées à Bormes dans l’onglet Parcours et le texte de partage (`sansClasses`) ; Toulon et Brest identiques. Fermé ; reste le formulaire de manche (WINDOWS n° 15).

### Interprétations
- `firstWarning: '11:00'` d’après « premier signal 11 h » (fiche de course) ; aucune heure de manche inventée.
- Club de la fiche tel que demandé par le plan (87 caractères ; le formulaire de création borne à 40, la fiche semée n’y passe pas).
- Côté des bouées de la banane n° 4 : bâbord dans l’app, dit « à vérifier sur la fiche de course » (l’annexe ne le donne pas).
- L’archive de Naos ne réserve pas `baie-2026-2027` : la politique de Naos reste celle de la v43 ; le serveur range la fiche sous `tofinou/` (test).
- Tâche 1 : la référence v43 (fixture) a été capturée avant toute modification ; les tests de comportement ont été écrits avec le code, puis joués avant la commit.

## Known Stubs

Aucun stub qui empêche l’objectif. Positions « à confirmer » assumées : bouées mouillées (CNE, BEN, CAV, ORA), lignes (lavandou, faviere, baie), La Dame comme « sa cardinale », côté de la banane n° 4.

## Threat Flags

Aucune surface nouvelle hors du registre : T-08-27 (`jours`, tests de jours), T-08-28 (`cleanDoc` : 1 à 30 dates réelles, sinon retiré), T-08-29 (tests par parcours d’après l’annexe ; relecture humaine en 08-10), T-08-30 (aucun nom de personne dans la fiche ni le catalogue, test `CVAT|Toulon|J80|Naos` et relecture). Aucune installation de paquet.

## Points pour 08-09

- Formulaire de manche (onglet Régates) : « Classe G (grand) / P (petit) » encore proposé à Bormes (WINDOWS n° 15) ; à masquer, ou à remplacer par les groupes 3 et 4.
- Consignes d’IA de Tofinou : la fiche porte RIR, VHF 72, un tour, groupe 4 ; les parcours ont un texte complet (marques, côtés, longueurs annoncées) utilisable par l’arbitre.
- Lecture des IC de Frédéric (D-16) : une régate lue par l’IA n’a pas de `jours` ; seule la fiche semée en a. Si l’équipage crée une régate par manche, elle reste « du jour » sur sa date (règles de la v43).
- Relecture humaine (08-10) : bouées mouillées, ligne du milieu de la baie, points de passage du tour de Port-Cros, côté de la banane n° 4, identification de La Dame.
- Vent faible par 6 nd de sud près du Lavandou : doute du modèle (piège 8), non réglé.

## Self-Check: PASSED

- FOUND : js/regates.js (`rade.seed.baie.v1` une fois), js/venue-bormes.js (« Challenge de la Baie »), tests/helpers/jours.mjs, tests/fixtures/jours-v43.json, tests/regates.test.mjs, tests/bormes.test.mjs
- FOUND : 127f577, a6b2627 (ancêtres de HEAD) ; 2 commits mesurés entre plan_head_before et plan_head_after
