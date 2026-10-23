---
phase: 06-parcours-banane
plan: 04
subsystem: livraison
tags: [guide, aide, release, v38, porte-production, compatibilite-v37]
status: partial

requires:
  - phase: 06-parcours-banane
    provides: "06-01 : banane, porte conseillée, arrivées décalées dans buildLegs ; 06-02 : interface, carte, en course, manches ; 06-03 : porte et arrivée d’un autre club, débrief, tools/compat-v37.mjs"
provides:
  - "guide.html : cartes « Parcours banane (construite) », « Porte sous le vent : quelle bouée ? », « Porte : en course », « Porte et arrivée d’un autre club » ; manches banane, porte au débrief, ligne de l’onglet Parcours"
  - "js/help.js : aide intégrée (ligne Parcours, ligne Régates, bulle de l’onglet Parcours) avec la banane, la porte conseillée, l’arrivée décalée et la porte / arrivée d’un autre club"
  - "tests/guide.test.mjs : 9 repères exigés de la phase 6 dans le guide, 4 dans l’aide"
  - "release.json v38 (hash bc914d22fb), sw.js et js/version.js régénérés"
affects: [06-04-tache-2-decision-production]

actuals:
  tokens: 4200
  tasks: 1
  commits: 2

plan_head_before: c07ff75759a66ed985bcebbb90eeec6a8e923476
plan_head_after: db7df7ff99dd765448df8f40106d60864b6c928c
commits: 2

tech-stack:
  added: []
  patterns:
    - "release en dernier, après toutes les vérifications PW_REQUIRED=1 ; contrôle complet rejoué après la release (tracer)"

key-files:
  created: []
  modified:
    - guide.html
    - js/help.js
    - tests/guide.test.mjs
    - release.json
    - sw.js
    - js/version.js

key-decisions:
  - "06-04 : l’aide intégrée ne cite entre « » que des libellés écrits tels quels dans le code ; les textes construits (« Porte : bouée … conseillée — N s de mieux », « Arrivée : entre le Comité et F ») y sont en gras, pas entre guillemets"
  - "06-04 : le guide dit « Passez les trois téléphones en v38 avant la régate CVAT » (repère exigé par tests/guide.test.mjs) ; l’aide dit « à la même version », pour ne pas vieillir"

requirements-completed: []

duration: 19 min
completed: 2026-10-23
---

# Phase 6 Plan 04 : Livraison de la v38 (partie autonome) Summary

**Guide et aide intégrée expliquent la banane, la porte conseillée, l’arrivée décalée et la porte / arrivée d’un autre club ; v38 publiée en local (`release.json` n = 38, hash `bc914d22fb`) après 638 tests, 28 scénarios Chromium, compatibilité v37, ouverture hors réseau et horloge audio, porte verte avec `VERCEL_ENV=production` ; rien n’a été poussé.**

## Performance

- **Duration :** 19 min
- **Started :** 2026-10-23T18:38:14Z
- **Completed :** 2026-10-23T18:57Z
- **Tasks :** 1 sur 3 (tâche 1 faite ; tâche 2 = point de décision, à l’orchestrateur et à Romain ; tâche 3 = conditionnelle à « publie »)
- **Files modified :** 6

## Accomplishments

- `guide.html` (D-11) :
  - section `veille` : carte « Parcours banane (construite) » (choix **Banane (construite)**, réglages Dist. B (Nq), Dégagement (C), B laissée à, Porte sous le vent, Arrivée, Tours ; distances depuis le centre de la ligne de départ, pinguée comprise ; un tour = B, C, porte ; trois arrivées Ligne de départ, Sous le vent, décalée, Au vent, décalée ; ligne bleue « Arrivée » ; positions théoriques, le Comité fait foi) ;
  - carte « Porte sous le vent : quelle bouée ? » (gauche / droite en regardant sous le vent ; exemple « Porte : bouée droite conseillée — 25 s de mieux » ; briefing, bords, carte 2D/3D, même numéro, anneau orange « · conseillée » ; « bouées équivalentes » sous 10 s, bouée du côté de la bascule annoncée sinon la gauche, sans conseil ni anneau ; recalcul avec le vent) ;
  - carte « Ajouter les manches » : une manche banane garde ses réglages, **Choisir cette manche** les rend sur chaque téléphone ;
  - section `course` : carte « Porte : en course » (« (porte) » dans la liste, conseil, « Autre bouée » avec le GPS, **↻ Recalculer la suite depuis ma position** depuis le bateau, passage près de l’une ou l’autre bouée à 40 m ; mode départ et chrono inchangés) ;
  - section `apres` : une porte compte la bouée réellement contournée, « (porte : bouée prise) », au débrief et dans l’analyse d’une trace ;
  - section `ailleurs` : carte « Porte et arrivée d’un autre club » (relecture « porte 4s / 4p » et « Arrivée : entre le Comité et F » avec l’extrait ; porte ou arrivée non prouvée écartée ; parcours proposé seulement quand toutes ses bouées sont confirmées, porte et arrivée comprises ; **Corriger la position** puis **Confirmer**, pas de saisie de parcours ; un téléphone en v37 voit la porte comme une simple bouée et l’arrivée sur la ligne de départ ; « Passez les trois téléphones en v38 avant la régate CVAT ») ;
  - section `onglets` : ligne des réglages de la banane.
- `js/help.js` : ligne « Parcours » (banane, réglages, porte conseillée, bouées équivalentes, en course), ligne « Régates » (porte et arrivée lues, confirmation de toutes les bouées, « porte : bouée prise », même version sur les trois téléphones), bulle `[data-tab=course]`.
- `tests/guide.test.mjs` : `EXIGEES` + « Banane (construite) », « Porte sous le vent », « bouées équivalentes », « Au vent, décalée », « Sous le vent, décalée », « porte : bouée prise », « Arrivée : entre le Comité et », « celles de la porte et de l’arrivée comprises », « Passez les trois téléphones en v38 avant la régate CVAT » ; repères de l’aide + « Banane (construite) », « Porte sous le vent », « bouées équivalentes », « porte : bouée prise ». 10/10 verts.
- v38 : `npm run release -- "parcours banane : dégagement, porte conseillée, arrivée décalée"` (68 caractères, non critique) → `release.json` `{"n":38,"date":"2026-10-23","critical":false,"hash":"bc914d22fb"}`, `BUILD` de `sw.js` et `js/version.js` au même `id` ; libellé affiché « v38 · 23/10 ».

## Task Commits

1. **Task 1 (étapes 1-3) : guide, aide, repères** - `d45032b` (docs ; avec `npm run stamp`)
2. **Task 1 (étape 5) : release v38** - `db7df7f` (chore)

_Tracer : après la release, `<verify>` de la tâche 1 rejoué en entier, d’un seul tenant (greps, release.json, stamp strict, `npm run check`, porte en production, gardes SNPM et D-07, compatibilité v37, 28 scénarios, mesure d’ouverture, horloge audio, arbre propre) : sortie 0. « Tracer verified end-to-end ».

## Vérifications (sorties brutes)

### Avant la release (contenu final, version encore v37)

```
npm run check                      → stamp à jour ; # tests 638 · # pass 638 · # fail 0 ; EXIT=0
git diff --quiet f80c365 -- js/courses.js tests/reference/                         → SNPM_OK
git diff --quiet 6e7af98 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js → D07_OK

W=$(mktemp -d) && git archive -o "$W/v37.tar" 6e7af98 js package.json && tar -xf "$W/v37.tar" -C "$W" && node tools/compat-v37.mjs "$W"
OK v37 lit v38 : applyRegattaMarks injecte le parcours 101 sans erreur, porte réduite à sa première bouée : suite [["X1","b"],["X2",null],["X1","b"]]
OK v37 lit v38 : buildLegs du parcours 101, un bord par élément plus l’arrivée, aucun NaN, arrivée au centre de la ligne de départ : X1→X2→X1→Arrivée
OK v37 lit v38 : raceSettings de la manche banane sans erreur (réglages ban ignorés, parcours 90 inconnu laissé à l’app) : {"courseId":90,"cls":"G","laps":2,"day":"2026-11-07","startTime":11}
OK v37 lit v38 : sheetHTML et marksSectionHTML de la régate sans erreur ni balise non échappée : 4597 caractères
OK v37 écrit : mergeRegatta v37 entre la régate v38 et une copie modifiée à la v37 garde seq[1].gate, finish et races[0].ban : dans les deux ordres
OK v38 relit la fusion v37 : applyRegattaMarks réinjecte la porte (élément à trois valeurs) et l’arrivée ; bords avec porte et arrivée sur F : X1 Alpha → X3 4p → X1 Alpha → Arrivée (Comité – X4 F)
OK v38 lit v37 : la régate archivée v37 donne en v38 les mêmes bords qu’en v37 (sameLegs) : 4 cas identiques
Compatibilité v37 : 7 contrôles OK
EXIT=0

PW_REQUIRED=1 node tools/regate-e2e.mjs   (tous les scénarios ; OPENAI_API_KEY retirée de l’environnement, client simulé)
OK accueil OK jour-j OK deux-telephones OK reprise OK equipage OK archive OK archive-bouees OK archivehors OK creer OK manche
OK auteur OK ic OK depuis-ic OK vraisemblance OK gel OK debrief-tardif OK gpx OK gpx-choix OK ia OK ia-erreurs OK arbitre
OK bouees OK guide OK entetes OK retour-port OK banane OK banane-manche OK porte-ic
Bilan : 28/28 scénario(s) OK
EXIT=0

PW_REQUIRED=1 node tools/measure-boot.mjs 4 5
Première visite en ligne : service worker actif, 69 fichiers en cache.
ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  435 |                           405 |             4818 |                                      943
        2 |                  439 |                           214 |             4158 |                                     1091
        3 |                  448 |                           223 |             4839 |                                     1053
        4 |                  506 |                           397 |             4498 |                                     1088
        5 |                  480 |                           358 |             4975 |                                     1138
  médiane |                  448 |                           358 |             4818 |                                     1088
RÉSULTAT : OK — médiane de l’interface utile 448 ms < 2000 ms (hors réseau, CPU ×4)
EXIT=0

PW_REQUIRED=1 node tools/audio-clock-check.mjs
Tentative 1/3 — contexte audio : running · 11 début(s) de bip relevé(s) pour 11 attendus · fil principal gelé 2 × 1,3 s
Écart maximal : 11,3 ms (seuil 30 ms) · manquants : 0 · bips en trop ou fusionnés : 0
RÉSULTAT : OK (tentative 1/3)
EXIT=0
```

### Après la release (v38)

```
npm run release -- "parcours banane : dégagement, porte conseillée, arrivée décalée"
stamp écrit : v38 · 23/10 · bc914d22fb · 69 fichiers                    EXIT=0
RT_STRICT=1 node tools/stamp.mjs --check   → stamp à jour                 EXIT=0
VERCEL_ENV=production npm run gate         → stamp à jour ; # tests 638 · # pass 638 · # fail 0   EXIT=0

<verify> complet rejoué sur db7df7f : EXIT=0
  npm run check 638/638 ; porte VERCEL_ENV=production 638/638 ; Compatibilité v37 : 7 contrôles OK ;
  Bilan : 28/28 scénario(s) OK ; measure-boot médiane 414 ms (< 2000 ms) ; audio écart maximal 3,1 ms (seuil 30 ms) ;
  git diff --quiet HEAD -- release.json js/version.js sw.js guide.html js/help.js → propre
```

### Dépôt (lecture seule, rien poussé)

```
git rev-parse HEAD                         → db7df7ff99dd765448df8f40106d60864b6c928c (apercu-phase-06, avant le commit de ce résumé)
git ls-remote origin refs/heads/main       → 6e7af988c310a8cd3964df38425ef9f8aa42358d (v37, inchangée)
git ls-remote origin refs/heads/apercu-phase-06 → (absente : pas encore poussée)
```

## Decisions Made

- Dans l’aide intégrée, les textes construits par le code (conseil de porte, « Arrivée : entre le Comité et F ») sont en gras et non entre « » : le test exige que chaque citation entre guillemets existe telle quelle dans le code.
- Les libellés des réglages de la banane sont en `span.k` dans les cartes du guide (le test d’exactitude les retrouve dans `js/app.js` et `js/banane.js`), en gras dans le tableau de l’onglet Parcours comme les autres réglages.

## Deviations from Plan

None - plan executed exactly as written (partie autonome). Les tâches 2 et 3 ne sont pas faites par l’exécutant, comme prévu.

## Issues Encountered

- Premier essai de l’aide : deux citations entre « » construites par le code (« Porte : bouée droite conseillée — 25 s de mieux », « Arrivée : entre le Comité et ») refusées par le test « chaque libellé entre guillemets existe dans l’app » ; passées en gras avant le commit.

## Point de décision (tâche 2) — à l’orchestrateur

- Pousser `apercu-phase-06` (tête après le commit de ce résumé), ouvrir la PR brouillon vers `main`, attendre l’aperçu « Ready », puis poser la question « publie » / « attendre » à Romain (avant le 2 novembre ; jamais après le 5 novembre au matin, ni pendant une course, ni dans les 48 h avant une régate).
- Numéro de PR, adresse de l’aperçu, décision de Romain et son heure : à consigner ici par l’orchestrateur.

## Contrôles humains à faire sur l’aperçu (iPhone)

1. Onglet Parcours, « Banane (construite) », 2 tours, vent du jour : carte 2D et 3D — B, C, deux bouées de porte au même numéro, la conseillée cerclée d’orange « · conseillée » (sauf « bouées équivalentes »), lisible au soleil.
2. Briefing : « Porte : bouée … conseillée — N s de mieux » ou « bouées équivalentes ».
3. Réglages : sans porte (une seule bouée sous le vent), puis « Au vent, décalée » (ligne bleue « Arrivée » près de B).
4. En course avec le GPS : prochaine marque = la porte, conseil et « Autre bouée » (relèvement, distance).
5. Manche banane ajoutée sur un téléphone, synchronisée, « Choisir cette manche » sur un autre : même banane.
6. IC d’un autre club avec porte (si disponibles) : « Lire avec l’IA », relecture « porte … / … » et « Arrivée : entre le Comité et … », parcours proposé après confirmation de toutes les bouées.
7. Un téléphone resté en v37 ouvre la même régate sans erreur (porte vue comme une bouée).
8. Mode avion : la banane se calcule ; version affichée « v38 · 23/10 — parcours banane : dégagement, porte conseillée, arrivée décalée ».
9. Relire le guide (`guide.html`) sur téléphone : nouvelles cartes de la banane et de la porte.

## Consignes pour Romain (si « publie »)

(a) chaque iPhone applique la mise à jour par le bandeau, hors course, avant le 7 novembre ; (b) avant la régate, choisir la manche (ou la banane) sur un téléphone, synchroniser, vérifier que les deux autres voient la même ; (c) repli en cas de défaut : Instant Rollback vers le déploiement v37 dans Vercel, puis correctif et v39 (jamais pendant une course ni dans les 48 h avant une régate, sauf correctif critique hors de l’eau) ; (d) positions de la banane théoriques : le Comité fait foi.

## Known Stubs

Aucun.

## Next Phase Readiness

- v38 prête et vérifiée en local sur `apercu-phase-06` ; production seulement sur « publie » de Romain (tâche 3, vérification `origin/main:release.json` n = 38 et `sw.js` de production au hachage `bc914d22fb`).

## Self-Check: PASSED

- FOUND : guide.html, js/help.js, tests/guide.test.mjs, release.json, sw.js, js/version.js
- FOUND : d45032b, db7df7f (ancêtres de HEAD)
