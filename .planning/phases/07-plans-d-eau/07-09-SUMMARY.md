---
phase: 07-plans-d-eau
plan: 09
subsystem: plan-d-eau-brest
status: complete
tags: [plan-d-eau, brest, gpen, banane, zone-a, fiche-semee, ia, d-08, d-09, d-11, d-01]
requires:
  - "07-08 : route() avec courant et hauteur d’eau, conseils { t, o: 'C' }, renverses dans le cercle de 0,6 Nq de la position de ligne zone*"
  - "07-06 : LINE_PRESETS zoneA/zoneB/zoneC, zones interdites, marques de Brest à clés non numériques"
  - "07-05 : venue d’une régate, puce « Rade de Brest », proposition de bascule à l’ouverture"
  - "phase 6 : js/banane.js (banane construite, porte, conseil de porte)"
provides:
  - "js/banane.js : fin 'comite' (arrivée à droite du comité), 3P seule au dernier tour, noms par parcours (names), arrivée propre (finishAt), courseBan, courseLaps, banHorsZone ; banHorsEau ignore un bout de ligne à terre voulu (shore)"
  - "js/tactics.js : parcours centré sur la position de ligne (course.centre), arrivée bouée – mât (course.arrivee), gateText « Porte 3S / 3P : bouée … » quand les bouées ont des noms courts"
  - "js/venue-brest.js : zoneA, inZoneA, COURSES 91 (2 tours), 92 (3 tours), 93 Virginie Hériot"
  - "js/regates.js : GPEN_ID, GPEN_AT, GPEN_SEED_KEY, GPEN_IC, gpenSeed, seedGpen"
  - "api/_gpen.js : GPEN (bloc des IC), venueOf (liste fermée) ; consignes de Brest dans api/rules.js, api/debrief.js, api/voice.js"
  - "js/lieu.js : venueBody() ; clients de l’arbitre, du débrief et de la dictée"
  - "tests/gpen.test.mjs, tests/fixtures/ia-toulon-v42.json, scénario gpen, contrôle (h) de tools/compat-v42.mjs"
affects: [07-10]
tech-stack:
  added: []
  patterns:
    - "parcours construit qui impose ses réglages : { built: 'BAN', ban, fixedLaps, names } fusionnés par courseBan / courseLaps ; la banane et Toulon gardent banOf(S) et S.laps"
    - "graine partagée sans modification : identifiant, instant et dates de modification fixes (u, ub, vu), sans auteur, jamais marquée à envoyer ; pierre tombale et marqueur local empêchent tout nouveau semis"
    - "consigne d’IA choisie dans une table fermée { toulon, brest } ; la constante de Toulon reste écrite telle quelle et son empreinte est figée par une fixture capturée sur 56f6625"
key-files:
  created:
    - tests/gpen.test.mjs
    - tests/fixtures/ia-toulon-v42.json
    - api/_gpen.js
  modified:
    - js/banane.js
    - js/tactics.js
    - js/venue-brest.js
    - js/app.js
    - js/scene3d.js
    - js/regates.js
    - js/regview.js
    - js/icread.js
    - js/lieu.js
    - js/regles.js
    - js/debrief.js
    - api/rules.js
    - api/debrief.js
    - api/voice.js
    - tests/regates.test.mjs
    - tests/apiia.test.mjs
    - tests/regmarks.test.mjs
    - tools/regate-e2e.mjs
    - tools/compat-v42.mjs
    - sw.js
    - js/version.js
decisions:
  - "Parcours du GPEN centrés dans la zone A : sans ligne pinguée, la ligne recule sous le vent de la moitié de Dist. 1 depuis la position de ligne (centre de la zone au milieu du bord de près) ; avec la ligne au centre, la marque 1 à 0,8 Nq sortait toujours du cercle de 0,6 NM de rayon"
  - "Chapelle de l’École navale trouvée dans l’extrait OpenStreetMap de 07-03 : bâtiment « Chapelle maritime » (chemin 579236187, site de l’École navale), 48,283165 N 4,415900 W ; mât supposé au point du trait de côte le plus proche (48,283084 N 4,416146 W), bouée supposée à 0,1 Nq vers le large au 064° (48,283818 N 4,413897 W) ; parcours 93 « GPEN — Virginie Hériot », arrivée « position à confirmer », le routage vise la bouée (navigable à la basse mer du 6 mai 2027)"
  - "Bouées du GPEN gardées sous les clés de la banane (B, C, PG, PD) avec des noms « 1 », « 2 (dégagement) », « 3S », « 3P » : aucune collision avec les 36 marques fixes de Brest, débrief, carte et passage automatique inchangés"
  - "Avertissement des bouées construites sur des fonds trop faibles à l’heure du départ (Brest) : par vent de 045° à la basse mer du 6 mai 2027, la porte du parcours 1 tombe sur des fonds de moins de 2,5 m"
  - "Fiche gpen-2027 semée en local sur chaque téléphone (comme la Coupe SNPM), jamais marquée à envoyer ; u = vu = at = GPEN_AT, ub = by = null, hist [] : même canon partout, legacyStamp n’y touche pas"
  - "venueOf commun aux trois fonctions dans api/_gpen.js (une seule liste fermée) ; le débrief retire `venue` des faits"
  - "js/startmode.js, js/racelock.js, js/beeper.js, js/wakelock.js inchangés"
metrics:
  duration: 55min
  completed: 2026-11-19
  tasks: 3
  files: 24
estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 31600        # chars/4 du diff ffb2a48..508e9b8 hors sw.js et js/version.js (126 515 caractères)
  tasks: 3
  commits: 5
plan_head_before: ffb2a484dc3bd76240f0f25fea225236a8c49b01
plan_head_after: 508e9b8a394eba0ce2ae570be0d216dabe74e9e6
---

# Phase 7 Plan 09 : GPEN 2027 en rade de Brest Summary

À Brest, l’équipage prépare les parcours J80 du GPEN (parcours 1 en 2 tours, parcours 2 en 3 tours, Virginie Hériot) construits au vent dans la zone A avec la porte 3S / 3P, 3P seule au dernier tour et l’arrivée à droite du comité, analysés avec le courant ; la zone A est sur la carte ; la fiche « GPEN 2027 — J80 » est semée une fois, identique sur les téléphones ; l’arbitre, le débrief et la dictée parlent du GPEN à Brest et disent à Toulon exactement ce qu’ils disaient en v42.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | a485158 | Fin `comite`, 3P seule, noms par parcours, arrivée propre ; catalogue 91, 92, 93 ; zone A (`zoneA`, `inZoneA`, cercle rose « Zone A » sur la carte) ; parcours 91 par défaut à Brest ; seule Dist. 1 se règle ; avertissements hors zone A et fonds trop faibles ; 13 tests ; scénario `gpen` |
| 2 (TDD) | 370dc8a (rouge), c4ce941 (vert) | `seedGpen`, `GPEN_IC`, mention de la fiche semée, lecture « semée par l’app » ; contrôle (h) de compat-v42 ; scénarios d’avant le GPEN ajustés ; 6 tests (regates) + 1 (gpen) |
| 3 (TDD) | 235b690 (rouge), 508e9b8 (vert) | Empreintes v42 des consignes, consignes de Brest (api/_gpen.js), `venueBody`, arbitre simulé dans le scénario `gpen` ; 13 tests |

Tracer (tâche 1) : vérification rejouée de bout en bout avant la tâche 2 (mode `end-of-phase`, vérification automatique) : 70 tests (gpen, banane, routememo, toulon, debriefbanane), gardes vertes, `npm run check` 824 tests (823 verts, 1 sauté), SNPM-OK, 7/7 scénarios (gpen, banane, banane-manche, banane-debrief, toulon-vue, plan-eau, brest-courant).

## Parcours du GPEN (vent 270°, ligne à la position « zoneA », Dist. 1 = 0,8 Nq)

- Parcours 1 : `1 | 2 (dégagement) | 3P ou 3S (porte 3S / 3P) | 1 | 2 (dégagement) | 3P | Arrivée (à droite du comité)` ; 2 tours quel que soit `S.laps` (pas de champ « Tours »).
- Parcours 2 : trois tours, porte aux tours 1 et 2, 3P seule au tour 3.
- Virginie Hériot : `1 | 2 | porte | 1 | 2 | porte | Arrivée devant la chapelle (position à confirmer)` ; dernier bord de plus de 1,5 Nq vers l’anse de Poulmic.
- Marque 2 à 0,07 Nq de la 1 au relèvement W − 90 ; 3P = bouée gauche en regardant sous le vent (à bâbord) ; arrivée : ligne de 0,06 Nq depuis le comité au relèvement W + 90.
- Centrage : centre de la zone au milieu du bord de près (ligne à 0,4 Nq sous le vent du centre) : aucune marque hors du cercle par 270°, 225°, 0° et 90° ; Dist. 1 = 1,5 Nq → « Marques 1, 2 (dégagement), 3P, 3S, Arrivée hors de la zone A (cercle de 1,2 NM) ».
- Avec le courant (270° / 10 nd, 6 mai 2027 à 14 h) : 7 bords à temps fini, route trouvée pour chacun, conseil « Porte 3S / 3P : … », conseils de courant (« estimation d’après l’atlas du Shom »).
- Fonds (marge 1 m, tirant d’eau 1,5 m) : aux basses mers du 5 au 8 mai 2027, des bouées tombent sur des fonds trop faibles par vents de 045°, 067,5°, 225° et 247,5° (0,8 et 1 Nq) — signalé « Avec la marée de l’heure du départ, … tombe sur des fonds trop faibles pour le J80 ». Aucune à 14 h par 270°.

## Fiche « GPEN 2027 — J80 »

`gpen-2027`, 5 au 9 mai 2027, club « AGPEN — École navale », `venue: 'brest'`, instant fixe 19/11/2026 00 h 00 UTC, sans auteur, lecture « semée par l’app » ; VHF 14, zone A, pavillon « Sigle J80 », signaux de la règle 26 et pavillon orange ; 15 points clés (IC 2026) dont la ligne « D’après les IC 2026 : à mettre à jour avec les IC 2027 (fin avril 2027). » Premier avertissement et heure limite vides (programme 2027 non paru). Le 5 décembre 2026 à Toulon : « En préparation », puce « Rade de Brest », l’ouvrir propose « Passer » ; le 6 mai 2027 à Brest, elle s’ouvre au lancement (régate du jour).

## Empreintes des consignes de Toulon (SHA-256, capturées sur 56f6625, client simulé)

| Fonction | Empreinte (v42 = v43 à Toulon) |
|----------|-------------------------------|
| api/rules.js | 45afaf3ecc44b3b5e3649a5cfb44fab1c5cd60c8c182711ea4eda8ee87102784 |
| api/debrief.js | 36cc8b25a6106146d4124c2070beb1b873d5ce005ed7f7a4bc8b4b61519aa545 |
| api/voice.js | 287871e464d04c5e4b9f22dcc1cc7dbbb53c0d9b2f886d8cc978a9a192e1e520 |

Capture : `git archive 56f6625 api js package.json`, lien vers `node_modules`, script de travail hors dépôt (deux captures identiques, puis la même sur le dépôt avant et après les changements). Corps sans plan d’eau, « toulon », « lorient », `{}`, « <script>… », `['brest']`, « Brest », « ␠brest », `null`, `42` : mêmes octets.

## Vérifications finales (sorties brutes)

Sur 508e9b8 :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
npm run check : stamp à jour · # tests 844 · # pass 843 · # fail 0 · # skipped 1 (instantané météo de Brest absent)
git diff --quiet f80c365 -- js/courses.js tests/reference/ : SNPM-OK
git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : inchangés
node tools/compat-v42.mjs <extraction 56f6625> : Compatibilité v42 : 8 contrôles OK (dont (h) fiche du GPEN : 901 caractères de fiche v42, pierre tombale respectée)
PW_REQUIRED=1 node tools/regate-e2e.mjs (tous) : Bilan : 36/36 scénario(s) OK
```
Version : `v42 · 09/11 · 817f2ca203` (`npm run stamp`, 76 fichiers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ligne au centre de la zone A : marque 1 toujours hors du cercle**
- **Trouvé pendant :** tâche 1. **Problème :** avec la ligne au centre et Dist. 1 = 0,8 Nq (défaut du plan), la marque 1 est à 0,8 Nq du centre d’un cercle de 0,6 NM de rayon : avertissement permanent. **Correction :** `course.centre` — la ligne recule de Dist. 1 / 2 sous le vent ; une ligne pinguée fait foi. **Commit :** a485158

**2. [Rule 2 - Correction] Bouées sur des fonds trop faibles à l’heure du départ**
- Sans signe, le routage n’atteint pas une bouée posée sur un haut-fond à basse mer et retombe sur une estimation directe. Avertissement `#banFond` (Brest seulement, `cur.depth`). **Commit :** a485158

**3. [Précision] Bords de porte**
- Le titre du bord de porte est la bouée retenue (« n°3P » ou « n°3S »), comme « Porte gauche / droite » de la banane ; le conseil dit « Porte 3S / 3P : bouée 3S conseillée — … ». Texte de Toulon inchangé (pas de noms courts).

**4. [Précision] Libellé du sélecteur hors de Toulon**
- « Parcours (Rade de Brest) » au lieu de « Parcours (cahier CVAT) » à Brest ; garde de tests/regmarks.test.mjs mise à jour (Toulon identique).

**5. [Précision] Garde de la banane**
- `horsZone` / `horsFond` posés après l’objet `analysis` pour garder le motif figé `finishLine: B.finishLine ?? null, horsEau }` (tests/banane.test.mjs, garde Toulon).

**6. [Précision] Fiche semée non envoyée**
- Comme la Coupe SNPM, la graine n’est pas une modification : chaque téléphone v43 la sème, aucune n’est envoyée. Le contrôle (h) force l’envoi : le serveur signe alors l’auteur (règle de api/archive.js), la v42 garde cette signature, la v43 sa graine sans auteur ; données identiques hors auteur (limite consignée).

**7. [Précision] Scénarios d’avant le GPEN**
- accueil, reprise, creer : la fiche semée est attendue ; `sème()` pose le marqueur (index du scénario tel quel) ; plan-eau attend le parcours 91.

**8. [Précision] Consignes de Brest**
- Bloc `GPEN` et `venueOf` communs dans api/_gpen.js (fichier à « _ », pas une route) ; débrief : rappel que la vitesse GPS contient le courant ; dictée : noms locaux (suroît, noroît, nordet), « le courant n’est pas du vent ». L’arbitre (regles.html, script classique) lit le plan d’eau dans `rade.state` ; « IC du GPEN : » dans sa réponse à Brest.

**9. [Précision] js/icread.js** (hors liste du plan) : libellés de lecture « semée par l’app ».

## Known Stubs

Aucun nouveau. Toujours ouvert : `data/brest.wx-snapshot.json` absent (07-10). Positions « à confirmer » voulues : mât et bouée de l’arrivée Virginie Hériot.

## Threat Flags

Aucune nouvelle surface réseau : `venue` est lu dans une liste fermée (T-07-24 appliqué : valeurs hostiles testées, empreintes de Toulon figées) ; fiche semée à instant et identifiant fixes, pierre tombale et marqueur respectés, compat-v42 (T-07-25) ; « D’après les IC 2026 », « le comité fait foi », « position à confirmer » (T-07-26). Aucun code d’accès ni empreinte de middleware écrit ou affiché ; aucun appel réel à OpenAI (clients simulés) ; aucun nom de modèle ajouté.

## Points pour 07-10

- Débrief d’une trace d’un parcours du GPEN : le recorder note `id: 91|92|93` et `laps` imposés, mais ni `ban` ni la géométrie (réservés à 90) ; `matchCourse` ignore les parcours construits et la détection de banane (`js/app.js` ~l. 1705) écarte un parcours désigné autre que 90 : la trace sera débriefée sans parcours reconnu. À traiter comme une banane avec `courseBan` / `names`.
- Guide : parcours du GPEN (ligne recentrée, Dist. 1 annoncée par le comité, 3P seule, arrivée à droite du comité), cercle de la zone A, Virginie Hériot à confirmer (mât et bouée supposés), fiche semée d’après les IC 2026, avertissement des fonds à basse mer ; regles.html reste rédigée pour le CVAT (fiches statiques).
- Briefing : « Parcours 91 estimé à … » cite le numéro ; le titre serait plus clair à Brest.
- `passages()` du débrief : les clés du GPEN (B, C, PG, PD) ne sont pas dans les 36 marques de Brest ; rien à changer pour les passages près des marques fixes.
- Contrôle visuel du cercle « Zone A » sur la carte à faire avec l’aperçu (scénarios sans erreur de page, pas de capture d’écran dans ce plan).

## Self-Check: PASSED
