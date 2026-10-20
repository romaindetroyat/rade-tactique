---
phase: 03-ouvrir-une-regate
plan: 07
subsystem: bouees-autre-club-et-livraison
status: complete
tags: [bouees, a-confirmer, regmarks, relecture, carte, v29, apercu, e2e-chromium]

requires:
  - phase: 03-ouvrir-une-regate
    provides: "plans 01 à 06 : js/regates.js (régate { marks, courses }), js/icread.js (relecture, reviewFromApi qui garde marks et courses), api/ic.js (extraits vérifiés), js/marks.js (parseLatLon, MAX_MOVE_M), js/icplaus.js (checkPos), tools/regate-e2e.mjs (scénario ia), v28 sur l'aperçu"
provides:
  - "js/regmarks.js (module pur) : MARK_PREFIX, COURSE_BASE, marksFromReview, coursesFromReview, confirmMark, moveMark, ignoreMark, pendingMarks, waitingFor, applyRegattaMarks (+ normName, isLineName, fmtPos, sideTxt)"
  - "Relecture : bouées lues (nom, texte de position, conversion en degrés-minutes, extrait, puce checkPos avec la terre) et parcours lus (séquence lisible), cochés au départ seulement si vérifiés, position lisible et puce non rouge ; un parcours ne se coche que si toutes ses bouées sont cochées"
  - "Fiche de régate : section Bouées (X1 Alpha ?, statut, position, source, extrait, auteur) avec Voir sur la carte, Confirmer, Corriger la position / Saisir la position, Ignorer ; parcours lus « en attente de : X2 Bravo » ou « proposé dans l'onglet Parcours »"
  - "js/app.js : applyRegattaMarks(MARKS, COURSES, régate courante) au démarrage (temps 1), au changement de régate courante et après chaque geste ; parcours choisi disparu → parcours 3 avant tout calcul ; bouées à confirmer dessinées par drawCourse via pendingMarks (jamais dans MARKS) ; « Recaler » réservé aux clés numériques"
  - "Carte : « X1 ? » et « Alpha · à confirmer » aussi pour une bouée hors parcours"
  - "guide.html : cartes « IC d'un autre club : Lire avec l'IA » et « Bouées d'un autre club » ; js/help.js : une phrase ; v29 publiée sur l'aperçu apercu-phase-03"
affects: [recette de Romain, essai réel de la lecture IA sur l'aperçu (décide de IA_IC), phase 4]

actuals:
  tokens: 19789
  tasks: 2
  commits: 3
plan_head_before: d42d822985342d58ccf8b4a87487f6bf59acf9ea
plan_head_after: 49734db26eb6a67f82fc926e2f8246070942364d
commits: 3

tech-stack:
  added: []
  patterns:
    - "Entrées injectées marquées fromRegatta : applyRegattaMarks retire d'abord tout ce qu'une régate a mis dans MARKS et COURSES, sans état caché, et rend `gone` (parcours qui ne reviennent pas à l'identique)"
    - "Ce qui est à confirmer ne va qu'à la carte, en copies { doubt: true } ; ce qui sert au calcul (MARKS) ne reçoit que du confirmé"

key-files:
  created:
    - js/regmarks.js
    - tests/regmarks.test.mjs
  modified:
    - js/icread.js
    - js/regview.js
    - js/app.js
    - js/scene3d.js
    - styles.css
    - tools/regate-e2e.mjs
    - guide.html
    - js/help.js
    - release.json
    - sw.js
    - js/version.js

key-decisions:
  - "Une bouée corrigée (« Corriger la position ») reste ou redevient « à confirmer » : seul le geste Confirmer la fait servir, la correction garde qui l'a faite et la position d'origine (moved.from)"
  - "Une bouée sans position lisible peut être retenue (« position à saisir ») mais ne se confirme qu'une fois la position saisie ; jamais devinée"
  - "Identité d'un parcours injecté = identifiant + régate (fromRegatta) : deux régates peuvent avoir chacune un parcours 101 sans que le parcours choisi passe de l'une à l'autre"
  - "Les bouées de régate n'apparaissent pas dans le tableau « Marques (cahier CVAT) » (clés numériques seulement) : leur lieu est la fiche de la régate"
  - "Hors parcours, une bouée à confirmer s'affiche aussi « X1 ? » (scene3d), pas seulement dans le parcours actif"
  - "Le toast « Régate créée » passe avant celui d'un parcours retiré, qui reste ainsi lisible"
  - "Départ, arrivée, ligne et porte d'une séquence lue ne sont pas des bouées (isLineName)"

patterns-established:
  - "Relecture : les cases de parcours suivent celles des bouées sans reconstruire la carte (paintMarksReview)"
  - "Scénario Chromium qui lit les tables réelles par import() du même module que l'app, et les étiquettes de la carte par un crochet sur fillText"

requirements-completed: [REG-04, REG-03]

coverage:
  - id: D1
    description: "Bouées et parcours lus dans les IC d'un autre club proposés dans la relecture avec position convertie, extrait vérifié et puce de vraisemblance, puis rangés « à confirmer » à la validation"
    requirement: REG-04
    verification:
      - kind: unit
        ref: "tests/regmarks.test.mjs#reviewFromApi … #applyReview … #reviewHTML (24 tests au total dans le fichier)"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs bouees (relecture : Alpha en degrés-minutes, Bravo en décimal, Charlie « position à saisir » non cochée, parcours A coché ; fiche X1/X2/X3 à confirmer)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Une bouée à confirmer ne sert jamais au routage, au mode départ ni au débrief (elle n'entre pas dans MARKS) ; un parcours lu n'est proposé que lorsque toutes ses bouées sont confirmées"
    requirement: REG-04
    verification:
      - kind: unit
        ref: "tests/regmarks.test.mjs#applyRegattaMarks (bouée à confirmer jamais injectée ; parcours seulement si toutes confirmées ; ignorée → retirée) ; garde statique : seul js/app.js appelle applyRegattaMarks("
        status: pass
      - kind: e2e
        ref: "bouees : tables réelles de la page = clés 1 à 11 avant confirmation, + X1 après Alpha, + X2 après Bravo ; « Parcours A (IC) » absent de #cSel jusqu'à la dernière confirmation ; analyse du parcours 101 sur trois bords (X1 Alpha, X2 Bravo, arrivée) sans erreur de page"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dans la fiche, chaque bouée se voit sur la carte, se confirme (auteur et date gardés), se corrige (bornée à la rade, confirmation au-delà de 2 Nq) ou s'ignore"
    requirement: REG-04
    verification:
      - kind: unit
        ref: "tests/regmarks.test.mjs#confirmMark … #moveMark … fiche : « X1 Alpha ? »"
        status: pass
      - kind: e2e
        ref: "bouees (hors rade refusé, déplacement de plus de 2 Nq confirmé en deux touches, Charlie saisie puis confirmable, Confirmer → « Confirmée par Équipier test le 19/10 », Ignorer en deux touches, Voir sur la carte replie le panneau)"
        status: pass
    human_judgment: true
    rationale: "Lisibilité de « X1 ? » sur la carte 3D d'un iPhone et premier usage réel d'IC d'un autre club : contrôle visuel de Romain (D-06)"
  - id: D4
    description: "Les bouées et parcours d'une régate ne sont injectés que par js/app.js ; changer de régate retire ceux de la précédente ; un parcours disparu ramène le parcours choisi au parcours 3 ; la référence SNPM et js/courses.js ne bougent pas"
    requirement: REG-04
    verification:
      - kind: unit
        ref: "tests/regmarks.test.mjs (tables réelles comparées à leur état du début dans after() ; changer de régate ; gone) ; tests/reference.test.mjs ; git diff --quiet f80c365 -- js/courses.js tests/reference/"
        status: pass
      - kind: e2e
        ref: "bouees (autre régate : courseId 3 dans rade.state, message « Parcours A (IC) retiré (bouées d'une autre régate ou plus confirmées) », tables revenues aux 11 marques CVAT, retour à la première régate : bouées confirmées réinjectées)"
        status: pass
    human_judgment: false
  - id: D5
    description: "La v29 (lecture IA d'un autre club, bouées à confirmer) est publiée sur l'aperçu apercu-phase-03 après des vérifications faites pour de bon ; main n'a pas bougé"
    requirement: REG-03
    verification:
      - kind: other
        ref: "release.json n = 29 sur origin/apercu-phase-03 ; origin/apercu-phase-03 non contenue dans origin/main ; SHA de main f80c365 avant et après ; statut Vercel de 49734db : success ; RT_STRICT=1 npm run gate : sortie 0"
        status: pass
    human_judgment: true
    rationale: "Essai réel de la lecture IA sur l'aperçu par Romain (appel réel d'OpenAI, variable OPENAI_API_KEY de l'environnement Aperçu) : il décide de IA_IC au plus tard le 2 novembre ; la mise en production est sa décision"
---

# Phase 3 Plan 07 : bouées d'un autre club à confirmer et v29 sur l'aperçu — Résumé

**Les bouées et parcours lus par l'IA dans les IC d'un autre club restent « X1 ? » sur la carte tant qu'un équipier ne les a pas confirmées une à une : `applyRegattaMarks` n'injecte dans les marques que le confirmé, un parcours n'apparaît qu'avec toutes ses bouées confirmées, et la v29 est sur l'aperçu `apercu-phase-03`, `main` intact.**

## Durée

- Environ 21 minutes d'exécution (22 h 47 → 23 h 08 UTC le 19/10/2026, soit le 20/10 à Paris) ; 2 tâches, 13 fichiers (2 créés, 11 modifiés dont sw.js, js/version.js et release.json régénérés) ; 3 commits de production.

## Réalisations

- **`js/regmarks.js` (pur, 24 tests dans `tests/regmarks.test.mjs`)** : `marksFromReview` convertit la position recopiée du texte par `parseLatLon` (degrés-minutes, décimal à virgule, bornes de la rade ; illisible → `lat`/`lon` nuls, « position à saisir »), nom nettoyé et borné, doublons écartés, identifiants `X1…` jamais réutilisés ; `coursesFromReview` traduit les noms en identifiants `X…` et côtés, ignore départ / arrivée / ligne / porte, marque « incomplet » un parcours qui cite une bouée inconnue ; `confirmMark`, `moveMark` (bornée à la rade, confirmation au-delà de 2 Nq), `ignoreMark` rendent un nouvel objet avec auteur et instant ; `pendingMarks` ne rend que des copies pour la carte ; `applyRegattaMarks` retire d'abord tout ce qui porte `fromRegatta` puis ajoute les seules bouées confirmées et les parcours dont toutes les bouées le sont (forme `seq.G`/`seq.P`, `text`, `custom`, titre « … (IC) »), et rend `gone`.
- **Relecture** : section « Bouées lues » (conversion, puce `checkPos` avec la terre dès que la carte est chargée, extrait, texte d'origine) et « Parcours lus » ; décocher une bouée décoche ses parcours ; `applyReview` range les cochés « à confirmer » (auteur, instant, source « IC <club> »).
- **Fiche de régate** : section Bouées, geste par geste ; chaque geste enregistre dans la régate, réinjecte, redessine la carte (`drawCourse`) et relance le calcul.
- **Garde-fous** : les tests ne touchent jamais les vraies tables (`structuredClone`, comparaison dans `after()`), garde statique « seul js/app.js appelle `applyRegattaMarks(` », `renderCourse` échappe désormais les titres de parcours (un titre venu d'un PDF), `courses.js` et `tests/reference/` identiques à f80c365.
- **Livraison** : guide (deux cartes, rappel du PDF d'un autre club à envoyer à Romain), aide, release v29, `RT_STRICT=1 npm run gate` à 0, push de `apercu-phase-03`.

## Tâches et validations

| Tâche | Nom | Commit | Fichiers principaux |
| ----- | --- | ------ | ------------------- |
| 1 (tracer) | Bouées et parcours d'un autre club « à confirmer » (D-04, REG-04) | e9988b3 | js/regmarks.js, tests/regmarks.test.mjs, js/icread.js, js/regview.js, js/app.js, js/scene3d.js, styles.css, tools/regate-e2e.mjs |
| 2 | Guide, vérifications pour de bon, v29 sur l'aperçu | a880205 (guide, aide), 49734db (v29) | guide.html, js/help.js, release.json, sw.js, js/version.js |

- Porte du tracer (mode « continue sans t'arrêter ») : `<verify>` de la tâche 1 relancé de bout en bout (13 scénarios Chromium, `npm run check`) avant la tâche 2 : « Tracer vérifié de bout en bout — extension ».
- Critères d'acceptation de la tâche 1 : 24 tests, `# fail 0` ; `grep -c "applyRegattaMarks(MARKS, COURSES" js/app.js` = 1 ; `grep -c "pendingMarks(" js/app.js` = 1 ; `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort en 0 ; `PW_REQUIRED=1 node tools/regate-e2e.mjs bouees` sort en 0 ; `npm run check` vert.

### Sorties brutes des vérifications d'avant release (PW_REQUIRED=1)

`npm run check` (sortie 0) :

```
> node tools/stamp.mjs --check && npm test
stamp à jour
# tests 333
# pass 333
# fail 0
```

`PW_REQUIRED=1 node tools/regate-e2e.mjs` (sortie 0) :

```
OK creer
OK manche
OK auteur
OK ic
OK depuis-ic
OK vraisemblance
OK gel
OK debrief-tardif
OK gpx
OK gpx-choix
OK ia
OK ia-erreurs
OK bouees
Bilan : 13/13 scénario(s) OK
```

`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` (sortie 0) :

```
Première visite en ligne : service worker actif, 63 fichiers en cache.
ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  516 |                           627 |             6153 |                                     1468
        2 |                  544 |                           501 |             6061 |                                     1489
        3 |                  576 |                           479 |             6254 |                                     1397
        4 |                  490 |                           584 |             6092 |                                     1680
        5 |                  562 |                           578 |             6489 |                                     1473
  médiane |                  544 |                           578 |             6153 |                                     1473
  maximum |                  576 |                           627 |             6489 |                                     1680
RÉSULTAT : OK — médiane de l’interface utile 544 ms < 2000 ms (hors réseau, CPU ×4)
```

`PW_REQUIRED=1 node tools/audio-clock-check.mjs` (sortie 0) :

```
Tentative 1/3 — contexte audio : running · 11 début(s) de bip relevé(s) pour 11 attendus · fil principal gelé 2 × 1,3 s
Écart maximal : 5,4 ms (seuil 30 ms) · manquants : 0 · bips en trop ou fusionnés : 0
RÉSULTAT : OK (tentative 1/3)
```

(Les onze lignes « bip … » sont toutes entre −1,7 et −5,4 ms.)

### Release et aperçu

- `npm run release -- "lecture IA des IC d'un autre club, bouées à confirmer"` : `release.json` n = 29, `critical` faux, hash `74181d88c5` (= `BUILD.id` de `js/version.js`). `RT_STRICT=1 node tools/stamp.mjs --check` : « stamp à jour », sortie 0. `RT_STRICT=1 npm run gate` : 333/333, sortie 0.
- `git ls-remote origin refs/heads/main` avant le push : `f80c365fb477cc065a6e60eed6b67a0a8ffb2917` ; après le push et le `git fetch` aux refspecs explicites : `f80c365fb477cc065a6e60eed6b67a0a8ffb2917` (inchangé). `git push origin apercu-phase-03` : `d42d822..49734db`.
- `git show origin/apercu-phase-03:release.json` : `"n": 29`. `git merge-base --is-ancestor origin/apercu-phase-03 origin/main` : faux (main ne contient pas l'aperçu). Le commit de `release.json` (49734db) est ancêtre de `origin/apercu-phase-03`.
- Statut de déploiement Vercel de 49734db : `success` (« Deployment has completed »).

## Écarts par rapport au plan

- **[Rule 1 - cohérence de l'existant] Classes de la relecture** (Tâche 1) : `tests/icread.test.mjs` compte `.icrules:not(.icraces) .icrule` et les balises `b` de la relecture ; les nouvelles sections utilisent donc `icblock` et `<span class="icmn">` (gras par CSS) plutôt que `icrules`/`<b>`. Aucun test existant modifié. Commit e9988b3.
- **[Rule 2 - sécurité] Titres de parcours échappés** (Tâche 1) : `renderCourse` et « Parcours probables » insérait `x.title` sans `esc()` ; un parcours dont le titre vient d'un PDF est un texte non fiable (T-03-32). Corrigé en même temps que l'injection. Commit e9988b3.
- **[Rule 1 - lisibilité] Étiquette hors parcours** (Tâche 1) : `scene3d.setMarks` n'ajoutait « ? » qu'aux bouées du parcours actif ; une bouée à confirmer hors parcours (le cas normal avant tout parcours) restait « X1 » grisé. Elle affiche maintenant « X1 ? » (et « · à confirmer » dans son nom, déjà prévu). Le même rendu vaut pour GR1 (3) et Carqueiranne (11) quand elles ne sont pas dans le parcours. Commit e9988b3.
- **[Précision] Ordre des messages** (Tâche 1) : « Régate créée » est affiché avant le message d'un parcours retiré pour que celui-ci reste lisible.
- **[Précision] Aide** : une phrase ajoutée à js/help.js (non listée dans `files_modified`), cohérente avec le guide.

**Total des écarts :** 3 corrections automatiques (1 cohérence, 1 sécurité, 1 lisibilité) et 2 précisions. **Impact :** aucun sur le périmètre.

## Points d'attention / risques résiduels

- **Lisibilité sur iPhone** : les libellés « X1 ? » sont vérifiés comme texte dessiné (crochet sur `fillText`), pas à l'œil : WebGL est neutralisé dans Chromium sans tête. C'est le `<human-check>` de la tâche 1.
- **Hypothèse A10** : une régate hors de la rade reste utilisable sans bouées confirmées ; les positions sont bornées à la rade (marge 0,1°), au-delà elles sont « position à saisir ».
- **Parcours lu et débrief** : un parcours confirmé (101…) entre dans la liste des parcours candidats du débrief comme les autres ; sans bouée confirmée, il n'existe pas.
- **Bouées confirmées conservées sur le téléphone** (comme la régate) ; le partage entre téléphones est la phase 4.

## Authentification

Aucune porte d'authentification rencontrée. Aucun code d'accès ni empreinte du middleware dans les fichiers, le guide ou ce résumé.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau point d'entrée : ni route, ni fonction serveur, ni schéma. Mitigations du registre appliquées : T-03-28 (seul le confirmé entre dans MARKS ; tests, garde statique, scénario), T-03-29 (retrait par `fromRegatta`, jamais de `saveOverride` pour une bouée de régate, « Recaler » réservé aux clés numériques), T-03-30 (`S.courseId` → 3 avant `scheduleAnalysis`), T-03-31 (tables réelles intactes, `git diff` f80c365 vide), T-03-32 (`escHTML` / `esc` partout, noms nettoyés des chevrons), T-03-33 (aperçu seulement, `IA_IC` en repli).

## Consignes pour Romain

**(a)** Vérifier que `OPENAI_API_KEY` existe pour l'environnement **Aperçu** de Vercel (Settings → Environment Variables) ; sinon `/api/ic` répond « Lecture IA indisponible sur ce déploiement (clé OpenAI absente) ».

**(b)** Essai réel sur l'aperçu de la v29 (l'aide doit afficher « Version v29 · 20/10 — lecture IA des IC d'un autre club, bouées à confirmer ») : onglet Régates → créer une régate → **Importer des IC (PDF)** avec les IC SNPM → **Lire avec l'IA** ; comparer chaque valeur à la lecture par motifs (**18/10/2026, 10:55, 16:00, VHF 72**), noter la **durée** (moins d'une minute attendue) et le **coût** affiché par le tableau de bord OpenAI. Puis, avec les premières vraies IC d'un autre club (envoyez-en le PDF à Romain, il deviendra un cas de test, D-06), regarder les bouées lues : « X1 ? » sur la carte, absentes du routage et du mode départ, confirmées une à une dans la fiche ; le parcours n'apparaît qu'après la dernière confirmation.

**(c)** Si l'essai n'est pas concluant au **2 novembre** : `IA_IC = false` dans `js/icread.js` (le bouton disparaît, le reste est intact), puis nouvelle version ; décision de Romain avec l'orchestrateur. La v28 ne dépend pas de la v29.

**(d)** La mise en production de la v28 puis de la v29 est décidée par Romain, **jamais après le jeudi 5 novembre au matin ni pendant une course** ; chaque iPhone applique la mise à jour par le bandeau, hors course. Cette exécution n'a ni fusionné ni poussé sur `main`.

## Prochaine étape

Dernier plan de la phase 3 terminé : prêt pour la vérification de phase et la recette de Romain (essai réel de la lecture IA, bouées d'un autre club sur iPhone).

## Self-Check: PASSED

- Fichiers créés présents : js/regmarks.js, tests/regmarks.test.mjs.
- Commits présents dans `apercu-phase-03` : e9988b3, a880205, 49734db (et dans `origin/apercu-phase-03`).
- `npm run check` et `RT_STRICT=1 npm run gate` verts (333/333) ; scénarios Chromium 13/13 ; `js/courses.js` et `tests/reference/` identiques à f80c365 ; `main` inchangé (f80c365).
