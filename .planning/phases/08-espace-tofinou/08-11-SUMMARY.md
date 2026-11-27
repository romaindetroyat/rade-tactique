---
phase: 08-espace-tofinou
plan: 11
subsystem: regates-ic-et-parcours
status: complete
tags: [tofinou, bormes, ic, ia, editeur-de-parcours, bouees, archive, compat-v43, d-16, d-17]
requires:
  - "08-02 : archive et quota par espace (préfixe tofinou/)"
  - "08-04 : registre des espaces, descripteur de Bormes, hôte tofinou.localhost"
  - "08-08 : catalogue du Challenge de la Baie, `sansClasses`, `lineDefaut`, notice de la fiche semée du Challenge"
  - "08-09 : CONSIGNES_TOFINOU.ic (api/_tofinou.js), espaceDeRequete"
provides:
  - "js/regedit.js : addHandMark, courseDraft, checkCourseDraft, saveCourseDraft, removeCourse, HAND, LAP_MAX"
  - "js/regmarks.js : clean exporté, injection des parcours saisis (« (saisi) », tours imposés, lapLine), allowedCourses catalogue + saisis"
  - "js/tactics.js : condition lapLine entre deux tours ; rankCourses avec la ligne par défaut du plan d’eau (Bormes)"
  - "js/regview.js : editorSectionHTML (par marksSectionHTML { editeur }), markAddHTML, courseFormHTML ; sheetHTML { semee, sansClasses, editeur }"
  - "js/icread.js : reviewHTML { libelles }"
  - "js/espaces.js : ESPACES.*.editeurParcours, ESPACES.tofinou.textesIC (Naos : null)"
  - "tests/helpers/pdfmini.mjs (pdfMinimal, IC_ESSAI), tests/tofinouic.test.mjs, tests/regedit.test.mjs, tools/compat-v43.mjs"
  - "tools/regate-e2e.mjs : scénarios tofinou-ic et tofinou-parcours ; E2E_PILE=1 (pile des erreurs de page)"
affects: [08-10]
tech-stack:
  added: []
  patterns:
    - "Option de vue posée hors de Naos seulement (editeur, libelles, semee, sansClasses) : sans elle, HTML de la v43 octet pour octet (tools/compat-v43.mjs (e))"
    - "Identifiants d’éléments tirés au hasard parmi les libres (X1000–X9999, 1000–9999) pour la fusion par identifiant entre téléphones hors réseau"
    - "PDF d’essai fabriqué par le test (aucun document réel dans le dépôt)"
key-files:
  created:
    - js/regedit.js
    - tests/helpers/pdfmini.mjs
    - tests/tofinouic.test.mjs
    - tests/regedit.test.mjs
    - tools/compat-v43.mjs
  modified:
    - js/icread.js
    - js/regview.js
    - js/regmarks.js
    - js/tactics.js
    - js/espaces.js
    - js/venue-bormes.js
    - js/app.js
    - tests/venues.test.mjs
    - tests/helpers/naos.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "Libellés des IC de l’espace Tofinou dans ESPACES.tofinou.textesIC (pas de structure de textes par espace avant ce plan) : motifs « par motifs (hors réseau) », semee « semée par l’app d’après les documents du club : à vérifier avec ceux en vigueur », notice « Fiche semée par l’app d’après les documents du club — à vérifier avec ceux en vigueur. » ; la fiche du Challenge (BAIE_SOURCE) garde sa notice de 08-08"
  - "Exemple de saisie de Bormes : La Fourmigue 43°06.362N 006°24.252E (au lieu du point devant Le Lavandou), dans inputBounds.exemple et exemple"
  - "Classes du CVAT (WINDOWS n° 15) : masquées à Bormes (formulaire et lignes de manche, route figée, historique) par `sansClasses` du plan d’eau de la régate ; la valeur `cls` est gardée telle quelle (archive et v43), pas de groupes 3/4 inventés"
  - "Éditeur rangé dans la fiche de la régate ouverte (section « Bouées et parcours de la régate ») ; ouvert par ESPACE.editeurParcours (Tofinou vrai, Naos faux)"
  - "En course (racing()), dans l’espace Tofinou : éditeur inactif ET gestes Confirmer / Corriger / Ignorer des bouées refusés (D-17 : aucune bouée ne se modifie) ; Naos garde les gestes de la v43"
  - "Parcours saisi : seq de la forme v43, laps (2 à 4) et lapLine: false facultatifs, origine 'saisie' ; injecté « (saisi) » avec laps: true et fixedLaps ; la v43 le voit d’un tour titré « (IC) »"
  - "rankCourses : repli sur VENUE.lineDefaut seulement quand le plan d’eau n’a pas « vignettes » (Bormes) ; Brest laissé tel quel (gel), noté (WINDOWS n° 18)"
metrics:
  duration: 35min
  completed: 2026-11-26
estimate:
  tokens: 130000
  tasks: 3
actuals:
  tokens: 35800
  tasks: 3
  commits: 3
plan_head_before: 37f9f6e362aa69afc1418f7deb88dec0446eabe1
plan_head_after: 5f884f6857c996b695c941454a27fd739df280d4
---

# Phase 8 Plan 11 : IC et parcours de l’équipage Tofinou — Résumé

Frédéric charge les IC de son club dans l’espace Tofinou de bout en bout (PDF lu par pdf.js → « Lire avec l’IA » sur geste → vraie fonction api/ic.js avec `CONSIGNES_TOFINOU.ic` → compteur sous `tofinou/preview/quota/` → relecture bornée à la rade de Bormes – Le Lavandou → bouées « à confirmer » → parcours proposé et routé → archive Tofinou relue par un second téléphone), et l’espace Tofinou, lui seul, a un éditeur de parcours à la main (bouées par position saisie ou touchée sur la carte, toujours à confirmer ; parcours avec côtés, porte, arrivée, 1 à 4 tours, avec ou sans passage par la ligne) partagé élément par élément par l’archive de l’espace, refusé pendant une course. Naos : vues, textes et clés de la v43 (compat-v43 (e), naos-cles, toulon-vue, gel et gardes verts).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 27532d7 | PDF d’essai (pdfmini), tests tofinouic (a)–(d), exemple de Bormes, libellés et notice de l’espace, classes masquées à Bormes, correctif rankCourses à Bormes, scénario tofinou-ic |
| 2 (tdd) | 989b3a5 | js/regedit.js, injection des parcours saisis, allowedCourses, condition lapLine, tests regedit (modèle, fusion, archive), tools/compat-v43.mjs, AJOUTS_SHELL |
| 3 (tdd) | 5f884f6 | vues de l’éditeur, drapeau editeurParcours, gestes de l’app (refus en course, « Bouée de régate ici… », entrée « Tours »), tests de vues, scénario tofinou-parcours |

Porte du tracer (tâche 1) : `<verify>` rejoué en entier avant la tâche 2 (tests ciblés, stamp, `npm run check`, gardes, scénarios `tofinou-ic tofinou-ia ic ia bouees porte-ic naos-cles` + `baie modifier-manche toulon-vue` : 10/10) ; expansion poursuivie.

TDD : tests/regedit.test.mjs écrit avant js/regedit.js (le module n’existait pas : import en échec), puis les vues testées dans le même fichier avant leur câblage dans js/app.js.

## Libellés retenus (et où)

| Texte | Espace Tofinou | Naos (v43) | Emplacement |
|-------|----------------|-----------|-------------|
| Lecture par motifs | « par motifs (hors réseau) » | « par motifs (CVAT, hors réseau) » | `ESPACES.tofinou.textesIC.motifs`, `reviewHTML(…, { libelles })` |
| Lecture semée | « semée par l’app d’après les documents du club : à vérifier avec ceux en vigueur » | « … d’après les IC 2026 : à vérifier avec les IC 2027 » | `textesIC.semee` |
| Notice de fiche semée | « Fiche semée par l’app d’après les documents du club — à vérifier avec ceux en vigueur. » | « Fiche semée par l’app (IC 2026) — à vérifier avec les IC 2027. » | `textesIC.notice`, `sheetHTML(…, { semee })` ; fiche du Challenge : notice de 08-08 gardée |
| Message de borne | « Position hors de la rade de Bormes – Le Lavandou : vérifiez les degrés et l’hémisphère » | Toulon inchangé | `BORMES.inputBounds.nom` (déjà posé par 08-04) |
| Exemple de saisie | « 43°06.362N 006°24.252E » (La Fourmigue) | « 43°05.845N 005°56.049E » | js/venue-bormes.js |
| Refus en course | « Course en cours : parcours et bouées modifiables après la course » | — | js/app.js `EDIT_LOCK_MSG`, mention `#rgEditLock` |

## Identifiants tirés

- Bouée saisie : `X1000`–`X9999`, tirée au hasard puis libre suivante (en boucle) parmi les identifiants de la régate ; les bouées lues dans les IC continuent à `max + 1` (v43) — une bouée saisie X4xxx fait donc partir les suivantes lues à X4xxx+1, sans collision possible dans la régate.
- Parcours saisi : entier 1000–9999, hors des parcours de la régate et de `taken` (identifiants de la table COURSES). Les parcours lus continuent à `max + 1`.

## Diff de js/tactics.js (depuis 37f9f6e, début du plan)

```diff
-      if (k < laps - 1 && !course.built) seq.push({ ...gate, mark: 'GATE', side: null, lap: k + 1 });
+      if (k < laps - 1 && !course.built && course.lapLine !== false) seq.push({ ...gate, mark: 'GATE', side: null, lap: k + 1 });   // lapLine : parcours saisi (08-11)
…
-    const ctr = toXY(LINE_PRESETS[c.line || 'vignettes'].lat, LINE_PRESETS[c.line || 'vignettes'].lon);
+    const lp = LINE_PRESETS[c.line || 'vignettes'] ?? (VENUE.lineDefaut ? LINE_PRESETS[VENUE.lineDefaut] : undefined);
+    const ctr = toXY(lp.lat, lp.lon);
```

La seconde modification n’était pas prévue par le plan (écart n° 1 ci-dessous) ; à Toulon et Brest, le calcul est celui d’avant (gels de Toulon et banane verts).

## Faux client, faux Blob (scénario tofinou-ic)

- Consigne reçue par le faux client (200 premiers caractères) : « Tu lis les Instructions de Course (IC) d’une régate de voile légère ou de croisière, extraites d’un PDF, pour préremplir la fiche d’un équipage de Tofinou 9.5 qui court dans la rade de Bormes – Le Lav » — égale à `CONSIGNES_TOFINOU.ic`.
- Chemins du faux Blob (IA et archive partagent le même) : `tofinou/preview/quota/2026-12-06/frederic.json`, `tofinou/preview/light.json`. Aucun chemin hors de `tofinou/`.
- Un seul appel à /api/ic, après le geste ; corps `{ text }` seulement ; second téléphone : aucun appel.

## Sorties brutes

```
node --test … tests/tofinouic.test.mjs : 6 pass (a, b, c, c en mer, d libellés, d classes)
node --test … tests/regedit.test.mjs : 13 pass
node --test … regedit regmarks archmerge apiarchive toulon banane naos : 170 pass, 0 fail

W=$(mktemp -d) && git archive … 5e9b8a5 js package.json && … node tools/compat-v43.mjs "$W"
OK (a) mergeDoc v43 = mergeDoc v44 dans les deux ordres (bouées et parcours saisis, Toulon et Bormes, modifications concurrentes) : 10 fusions comparées, égales octet pour octet
OK (b) stampState v43 = stampState v44, ne marque que ce qui a changé : un seul parcours marqué
OK (c) applyRegattaMarks v43 sur une régate de Toulon à parcours saisi : sans exception, un tour, bouées et côtés justes : Parcours b saisi /b (IC) · [["X1001","t"],["X1002",null,"X1003"]]
OK (d) sheetHTML v43 sur les régates à bouées et parcours saisis : sans exception, noms hostiles échappés : 4 fiches
OK (e) vues de Naos : sheetHTML, marksSectionHTML et reviewHTML de la v44 sans option = sorties de la v43 : 84 vues comparées, identiques octet pour octet
Bilan : 5/5 contrôle(s) OK
node tools/compat-v43.mjs .  → « la racine donnée connaît déjà l’éditeur de parcours (HAND) », code 2

npm run check : 1028 tests, 1026 verts, 2 sautés (instantanés météo de Brest et de Bormes absents), 0 échec ; stamp à jour (v43 · 19/11 · c92bb779a4 · 84 fichiers ; avertissement non strict « contenu modifié depuis la v43 » : la release est pour 08-10)
node tools/gardes-toulon.mjs : OK SNPM · OK données de Toulon · OK modules du mode départ · OK tests figés · OK gel de Naos v43 · OK pack de Brest
git diff --quiet f80c365 -- js/courses.js tests/reference/ : vrai
git diff --quiet 5e9b8a5 -- data/brest.* : vrai
git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : vrai

PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-ic tofinou-ia ic ia bouees porte-ic naos-cles baie modifier-manche toulon-vue : 10/10 OK (tâche 1)
PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-parcours tofinou-ic baie bouees porte-ic archive-bouees modifier-manche jour-j toulon-vue naos-cles : 10/10 OK (tâche 3)

Série complète, Chromium (`PW_REQUIRED=1 node tools/regate-e2e.mjs`, tous les scénarios, après la tâche 3) :
OK baie accueil jour-j deux-telephones reprise equipage archive archive-bouees archivehors creer manche auteur ic depuis-ic vraisemblance gel debrief-tardif gpx gpx-choix ia ia-erreurs arbitre bouees guide entetes retour-port banane banane-manche banane-debrief porte-ic modifier-manche toulon-vue plan-eau brest-avion regate-brest brest-courant gpen naos-cles tofinou-demarrage espace-garde tofinou-bateau tofinou-identite bormes-local tofinou-ia tofinou-ic tofinou-parcours
Bilan : 46/46 scénario(s) OK (code 0)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Carte « Parcours probables » plantait à Bormes pour un parcours lu dans les IC**
- **Trouvé pendant :** tâche 1 (scénario tofinou-ic, erreur de page `Cannot read properties of undefined (reading 'lat')` dans `rankCourses`)
- **Problème :** `LINE_PRESETS[c.line || 'vignettes']` : Bormes n’a pas de préréglage « vignettes », un parcours lu (sans `line`) faisait planter le briefing.
- **Correction :** repli sur `VENUE.lineDefaut` quand « vignettes » manque (Bormes) ; Toulon identique ; Brest laissé tel quel (gel de Naos : même plantage possible qu’en v43, consigné dans deferred-items.md et WINDOWS n° 18).
- **Fichier :** js/tactics.js · **Commit :** 27532d7

**2. [Rule 2 - WINDOWS n° 15] Classes du CVAT dans le formulaire de manche à Bormes**
- Classe G / P masquée dans le formulaire, les lignes de manche, la route figée et l’historique quand le plan d’eau de la régate a `sansClasses` (Bormes) ; `cls` gardé (archive et v43) ; Toulon et Brest : HTML de la v43 (compat-v43 (e)). js/app.js lit `#rcCls` s’il existe. Commit 27532d7. WINDOWS n° 15 marqué corrigé.

**3. [Rule 2 - D-17] Gestes Confirmer / Corriger / Ignorer refusés en course dans l’espace Tofinou**
- D-17 : « aucune bouée ne se crée, ne se modifie ni ne se supprime » pendant une course ; ces trois boutons sont inactifs et le geste est refusé avec le message (Tofinou seulement ; Naos : v43). Commit 5f884f6.

**4. [Rule 2 - D-17] Éditeur redessiné quand une course commence ou finit**
- `raceTick` redessine l’onglet Régates à chaque changement d’état de course, dans l’espace Tofinou seulement et si aucun autre formulaire n’est ouvert, pour que les boutons soient inactifs tout de suite. Commit 5f884f6.

**5. [Rule 1 - Test] tests/venues.test.mjs** attendait l’ancien exemple de Bormes (devant Le Lavandou) : il attend La Fourmigue. Commit 27532d7.

**6. [Rule 3 - Scénario] Horloge figée des téléphones**
- Dans tofinou-parcours, une copie envoyée par la synchronisation automatique portait la même date que la confirmation qui suivait (horloge de Playwright figée) : le départage par contenu gardait la bouée « à confirmer ». Le scénario avance l’horloge entre deux gestes, comme sur l’eau (sans effet réel : deux gestes n’ont jamais la même milliseconde). L’historique peut contenir plus d’une ligne « Parcours » (versions croisées pendant le scénario) : le scénario exige la version écrasée de Frédéric (2 tours) dans l’historique des deux téléphones.

### Interprétations
- `addHandMark` rend aussi la régate (`{ ok, id, regatta }`), comme `moveMark`.
- Brouillon de parcours : `{ id, name, steps: [{ kind: 'mark', mark, side } | { kind: 'gate', mark, gate }], finish: { kind: 'ligne' | 'comite' | 'pres', mark }, laps, lapLine }` ; erreurs par clé `name`, `steps`, `step.<rang>`, `finish`, `laps`, `lapLine`, `course`.
- Texte d’un parcours saisi injecté : « Ligne de départ, Alpha tribord, porte Bravo / Charlie (2 tours, sans repasser la ligne entre deux tours), arrivée entre le Comité et Delta. Parcours saisi dans l’app, bouées confirmées sur la carte : le Comité fait foi. »
- Un parcours saisi sans parcours lu s’ajoute APRÈS le catalogue dans l’onglet Parcours ; il n’est pas présélectionné (le parcours choisi reste proposé).
- Scénario tofinou-parcours : le point touché au centre de la zone visible de la carte après « Voir sur la carte » tombe à moins de 300 m d’Alpha (Bravo y est donc posée, puis Charlie et Delta saisies).
- (D) de tofinou-parcours : la régate de Naos du jour est ouverte au démarrage ; le scénario ne touche « Ouvrir » que si besoin.

## Known Stubs

Aucun stub. Les positions des bouées d’essai sont fabriquées (aucune IC réelle) ; le contrôle humain sur de vraies IC de Frédéric reste à faire (human-check du plan, 08-10).

## Threat Flags

Aucune surface hors du registre : T-08-40 (clean + escHTML, tests `<img src=x onerror=alert(1)>` sur bouées, parcours, porte, arrivée, formulaires), T-08-41 (checkCourseDraft : bouées confirmées avec position seulement ; injection seulement si toutes confirmées), T-08-42 (racing() : boutons inactifs, gestes refusés, pas de « Bouée de régate ici… », scénario C : rien enregistré ni envoyé), T-08-43 (fusion par éléments, historique, identifiants tirés, scénario B), T-08-44 (drapeau, compat-v43 (e), scénario D, naos-cles, toulon-vue), T-08-45 (consigne et compteur de Tofinou, scénario tofinou-ic), T-08-46 (aucune requête avant le geste, corps `{ text }`), T-08-47 (compat-v43 (a)–(d)). Aucune installation de paquet.

## Points pour 08-10 (livraison)

- Rejouer tofinou-ic et tofinou-parcours avec la série complète ; contrôle humain du plan : vraies IC d’une régate de Frédéric (PDF réel, « Lire avec l’IA »), parcours d’entraînement créé à la main vu sur le téléphone de Romain, refus en course, Naos sans éditeur.
- WINDOWS n° 18 : plantage latent de `rankCourses` à Brest pour un parcours lu dans les IC (v43) ; décider s’il faut le corriger chez Naos (une ligne : repli sur le premier préréglage).
- Le guide de l’espace Tofinou (08-10) peut présenter l’éditeur : « Bouées et parcours de la régate », « Bouée de régate ici… », bouées toujours à confirmer, rien pendant une course.
- Ouvrir l’éditeur à Naos plus tard = passer `ESPACES.naos.editeurParcours` à vrai, après décision : compat-v43 (e) et les scénarios de Naos changeraient alors volontairement.
- Release v44 (`npm run release`) : réservée à 08-10 (avertissement non strict du stamp).

## Self-Check: PASSED

- FOUND : js/regedit.js, tests/helpers/pdfmini.mjs, tests/tofinouic.test.mjs, tests/regedit.test.mjs, tools/compat-v43.mjs, 08-11-SUMMARY.md
- FOUND : 27532d7, 989b3a5, 5f884f6 (ancêtres de HEAD) ; 3 commits mesurés entre plan_head_before et plan_head_after
- middleware.js non touché ; aucun code, empreinte ni clé écrit ; aucun appel réel au fournisseur d’IA (faux client)
- WINDOWS : n° 15 corrigé, n° 18 ajouté (rankCourses à Brest, gel de Naos)
