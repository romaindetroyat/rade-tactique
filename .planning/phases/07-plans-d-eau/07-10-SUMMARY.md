---
phase: 07-plans-d-eau
plan: 10
subsystem: livraison-v43
status: checkpoint
tags: [plan-d-eau, brest, gpen, debrief, guide, aide, release, v43, d-01, d-02, d-15]
requires:
  - "07-01 à 07-09 : plans d’eau, pack de Brest, marée, courant, vents, zones, GPEN, IA par plan d’eau"
provides:
  - "Débrief d’une trace courue sur un parcours du GPEN (91, 92, 93) : reconstruit comme une banane (courseBan, noms 1 / 2 / 3S / 3P, 3P seule, arrivée à droite du comité ou devant la chapelle)"
  - "Briefing de Brest : titre du parcours dans la ligne du temps estimé"
  - "guide.html, js/help.js, index.html, regles.html : plans d’eau, Brest hors réseau, régate à Brest et limite v42, marée et courant, vents, zones, GPEN, contrôles, sources"
  - "v43 (release.json n = 43, hachage 5b9ef2068c), porte de production verte"
affects: [07-10 tâche 2 (décision de Romain), 07-10 tâche 3 (production)]
tech-stack:
  added: []
  patterns:
    - "parcours construit par la banane passé au débrief (course) : recentrage de la zone A non refait sur une ligne déjà courue (centre: false)"
key-files:
  created:
    - tests/debriefgpen.test.mjs
  modified:
    - js/app.js
    - js/debrief.js
    - tools/regate-e2e.mjs
    - guide.html
    - js/help.js
    - index.html
    - regles.html
    - tests/guide.test.mjs
    - release.json
    - sw.js
    - js/version.js
decisions:
  - "Trace d’un parcours du GPEN : l’enregistreur garde ban (courseBan), ligne et axe comme pour la banane ; bananeOfTrace retrouve le parcours désigné (manche ou trace) dans le catalogue du plan d’eau et recule la ligne de la moitié de Dist. 1 depuis le centre de la zone A, comme runAnalysis (sauf ligne pinguée) ; le débrief garde la banane et Toulon inchangés (mêmes noms, textes et forme de trace)"
  - "3P seule au dernier tour : passage retenu sans porte → marque à bâbord dans le questionnaire (et non « porte : bouée prise »)"
  - "Briefing : « Parcours N estimé à … » à Toulon (vue toulon-vue de la v42), titre échappé ailleurs"
  - "Libellé de version donné par l’orchestrateur : « plans d’eau : rade de Brest, marée et courants, GPEN » (55 caractères) au lieu de celui du plan"
  - "Instantané météo de Brest non produit : Open-Meteo refuse (« Daily API request limit exceeded ») à deux essais ; rien d’inventé, v43 publiée sans (l’app de Brest l’accepte : « Hors ligne »)"
metrics:
  duration: 75min
  completed: 2026-11-19
  tasks: 1
  files: 12
estimate:
  tokens: 100000
  tasks: 3
actuals:
  tokens: 22400        # chars/4 du diff fa4c5ff..6e4b0e3 hors sw.js et js/version.js (89 596 caractères)
  tasks: 1             # tâche 1 (autonome) ; tâches 2 et 3 en attente de la décision de Romain
  commits: 4
plan_head_before: fa4c5ffd0e9ebec274a0d7f8a5e8c8fa5e52454f
plan_head_after: 6e4b0e3e157dd80497394dd93e009fc8c2c7e642
---

# Phase 7 Plan 10 : livraison de la v43 (partie autonome) Summary

La v43 « plans d’eau : rade de Brest, marée et courants, GPEN » est prête et vérifiée en local sur `apercu-phase-07` : débrief des parcours du GPEN, titre du parcours au briefing de Brest, guide et aide à jour, toutes les gardes et les 36 scénarios verts, release faite, porte de production verte. Rien n’a été poussé ; `main` est inchangée (56f6625, v42). Arrêt au point de décision (tâche 2).

## Ce qui a été fait

| # | Commit | Contenu |
|---|--------|---------|
| 1 | bbb304c | Débrief d’une trace courue sur un parcours du GPEN : enregistreur (ban, ligne, axe), `bananeOfTrace` (parcours désigné, ligne recentrée), `bananeLegs` / `bananeTable` / `detectBanane` avec le parcours, questionnaire, rapport et bord par bord nommés par le titre ; `tests/debriefgpen.test.mjs` (5 tests) ; scénario `gpen` étendu (trace du parcours 1 débriefée de bout en bout) |
| 2 | 3b2f1d9 | Briefing hors de Toulon : « GPEN — parcours 1 (2 tours) estimé à … » ; test de câblage et scénario `gpen` |
| 3 | 0a49b13 | guide.html (Plan d’eau, Une régate à Brest, Marée et courant à Brest, Vents de Brest, Zones interdites de Brest, Départ à Brest, En course à Brest, GPEN 2027 — J80, Brest : contrôles à faire, Sources, lignes des tableaux Régates et Sans réseau) ; js/help.js (accueil neutre, lignes « Plan d’eau » et « Brest », bulles) ; index.html (description) ; regles.html (section « À Brest : IC du GPEN », texte du CVAT inchangé) ; tests/guide.test.mjs (repères de la phase 7 dans le guide et l’aide) |
| 4 | 6e4b0e3 | v43 : `npm run release -- "plans d’eau : rade de Brest, marée et courants, GPEN"` |

Points remontés par 07-08 et 07-09, traités : (1) débrief GPEN — fait ; (2) titre au briefing — fait ; (3) instantané météo de Brest — impossible (ci-dessous) ; (4) guide et aide — faits, `tests/guide.test.mjs` vert.

## Instantané météo de Brest

`python3 -I tools/snapshot_weather.py --venue brest` (11:07 UTC) puis un essai direct (vers 11:35 UTC) : Open-Meteo répond `{"reason":"Daily API request limit exceeded. Please try again tomorrow.","error":true}`. Aucun fichier écrit, rien d’inventé. `data/brest.wx-snapshot.json` reste absent : à Brest, première ouverture hors réseau sans prévision (« Hors ligne », vent manuel). Le test de l’instantané reste sauté (le seul test sauté). À produire plus tard avec `python3 -I tools/snapshot_weather.py --venue brest`, puis `npm run stamp` et une nouvelle release (v44) — inutile avant mai 2027 : une prévision téléchargée sur place le remplace.

## Vérifications (sorties brutes, avant la release sauf mention)

- `npm run check` : `stamp à jour` ; `# tests 849 · # pass 848 · # fail 0 · # skipped 1` (instantané de Brest absent) → exit 0
- `node tools/gardes-toulon.mjs` (avant chaque commit et après la release) :
  ```
  OK SNPM (js/courses.js, tests/reference/ = f80c365)
  OK données de Toulon (data/ = 56f6625)
  OK modules du mode départ (= 56f6625)
  OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
  ```
- `git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js` et `git diff --quiet f80c365 -- js/courses.js tests/reference/` : 0
- `node tools/compat-v42.mjs <extraction 56f6625>` : `Compatibilité v42 : 8 contrôles OK` (a à h) → exit 0
- `node tools/compat-v41.mjs <extraction dda755b>` : `Compatibilité v41 : 7 contrôles OK` → exit 0
- `PW_REQUIRED=1 node tools/regate-e2e.mjs` : `Bilan : 36/36 scénario(s) OK` (dont toulon-vue, plan-eau, brest-avion, regate-brest, brest-courant, gpen ; « conseil affiché : Porte : bouée gauche conseillée — 22 s de mieux ») → exit 0
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` (Toulon, hors réseau, CPU ×4) : interface utile médiane 418 ms (max 549), mode départ 270 ms, carte prête 4217 ms, plus longue tâche 525 ms — `RÉSULTAT : OK — médiane de l’interface utile 418 ms < 2000 ms`
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 --venue brest` (pack de 10 fichiers, 4 673 496 octets) : interface utile médiane 403 ms (max 441), mode départ 312 ms, carte prête 5304 ms, plus longue tâche 1123 ms — `RÉSULTAT : OK — médiane de l’interface utile 403 ms < 2000 ms`
- `PW_REQUIRED=1 node tools/audio-clock-check.mjs` : 11 bips sur 11, écart maximal 3,4 ms (seuil 30 ms), `RÉSULTAT : OK (tentative 1/3)`
- Après la release : `RT_STRICT=1 node tools/stamp.mjs --check` → `stamp à jour`, exit 0 ; `VERCEL_ENV=production npm run gate` → 849 tests, 848 verts, 1 sauté, exit 0
- `release.json` : `{"n": 43, "date": "2026-11-19", "note": "plans d’eau : rade de Brest, marée et courants, GPEN", "critical": false, "hash": "5b9ef2068c"}` ; `js/version.js` et `sw.js` : `"n":43 … "id":"5b9ef2068c"`
- Tête de `apercu-phase-07` : `6e4b0e3e157dd80497394dd93e009fc8c2c7e642` (non poussée par l’exécutant) ; `git ls-remote origin refs/heads/main` : `56f66255cbc2e7e9c4d540b83bb24f89ad5eb16c` (v42, inchangée)

## Contrôles humains (Romain, sur l’aperçu v43 poussé par l’orchestrateur)

Sur iPhone (app installée et Safari) :
1. Toulon : briefing, parcours 3 et banane, mode départ : identiques à la v42 ; version affichée « v43 · 19/11 — plans d’eau : rade de Brest, marée et courants, GPEN ».
2. Mise à jour v42 → v43 par le bandeau, hors course, sans perte de régates, traces ni réglages ; bandeau absent pendant un chrono.
3. Régates → Plan d’eau → « Télécharger le plan d’eau » : pourcentage puis « Prêt hors réseau » ; « Passer à la rade de Brest » : rechargement, carte de la rade de Brest.
4. Mode avion, app fermée puis rouverte à Brest : elle s’ouvre hors réseau (sans prévision : instantané absent).
5. Jour du 6 mai 2027, « GPEN — parcours 1 (2 tours) » : carte 2D/3D lisible au soleil, cercle « Zone A », porte 3S / 3P, « Arrivée (à droite du comité) », calque « Courant de marée (flèches) » ; briefing « GPEN — parcours 1 (2 tours) estimé à … ».
6. Une trace enregistrée sur un parcours du GPEN (sortie d’essai ou trace d’entraînement) : bord par bord « Parcours reconstruit (GPEN — …) » et débrief aux noms 1, 2, 3S, 3P.
7. Fiche « GPEN 2027 — J80 » : une seule, la même sur les trois téléphones.
8. Un téléphone encore en v42 ouvre une régate de Brest : aucune erreur (vue « à Toulon », limite connue).
9. « Revenir à la rade de Toulon » : Toulon intact, parcours retrouvé.
10. Guide (guide.html) : cartes Plan d’eau, Brest, GPEN, Sources lisibles sur téléphone ; page des règles : section « À Brest : IC du GPEN ».

Avant mai 2027 (documents officiels et sur l’eau) :
11. « Marée à Brest » des 5 au 9 mai 2027 contre l’annuaire des marées 2027 du Shom : heures à moins de 10 min, hauteurs à moins de 20 cm.
12. Zones de l’Île Longue et de Pen ar Vir relues sur une carte marine (à élargir si besoin).
13. Conseils de vent de Brest relus par un régatier de la rade.
14. Sur l’eau à Brest : dérive mesurée et heure de la renverse contre « Courant ici » (attendu : 0,2 à 0,3 nd, 15 à 30 min d’écart).
15. IC du GPEN 2027 (fin avril 2027) : importer, relire la fiche ; position de l’arrivée Virginie Hériot.

## Calendrier et décision (tâche 2, bloquante)

Production seulement sur « publie » écrit par Romain lui-même, de préférence du 5 au 8 décembre, au plus tard le jeudi 10 décembre 2026, jamais à partir du 11 décembre ni pendant une course. Les trois iPhone sont à mettre à jour le même jour. L’orchestrateur pousse `apercu-phase-07` (PR #17 existante), attend l’aperçu « Ready » et transmet ces contrôles. Repli en cas de défaut : Instant Rollback de Vercel vers la v42, puis correctif et v44.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correction] Débrief des parcours du GPEN (point remonté par 07-09)**
- **Found during:** préparation, à la demande de l’orchestrateur
- **Issue:** une trace d’un parcours 91, 92 ou 93 était débriefée sans parcours reconnu (bananeOfTrace écartait tout parcours autre que 90, l’enregistreur ne gardait pas la géométrie)
- **Fix:** parcours construit passé au débrief (courseBan, noms, arrivée), géométrie enregistrée, ligne recentrée comme runAnalysis
- **Files modified:** js/app.js, js/debrief.js, tests/debriefgpen.test.mjs, tools/regate-e2e.mjs
- **Commit:** bbb304c

**2. [Rule 2] Titre du parcours au briefing de Brest** — js/app.js, commit 3b2f1d9.

**3. Libellé de version** donné par l’orchestrateur (« plans d’eau : rade de Brest, marée et courants, GPEN ») au lieu de celui du plan.

**4. Instantané météo de Brest** non produit (limite d’Open-Meteo), v43 publiée sans, comme prévu par le plan.

**5. Scénario `gpen`** : l’app est rouverte avant de lire ses modules dans la page (l’arbitre laisse la page des règles ouverte).

## Known Stubs

`data/brest.wx-snapshot.json` absent (déjà ouvert depuis 07-03) : pas de prévision de secours à la première ouverture hors réseau à Brest.

## Threat Flags

Aucune nouvelle surface : aucune route, aucun en-tête, aucune donnée partagée nouvelle (la trace porte `ban`, `ligne`, `axe` pour un parcours du GPEN, comme pour la banane ; compat-v42 vert). T-07-27 : point de décision bloquant conservé, rien poussé. T-07-28 : guide et aide relus par tests/guide.test.mjs (aucun code, empreinte ni nom de modèle). T-07-29 : limite v42 écrite dans le guide et l’aide (« Mettez les trois téléphones à jour le même jour »). T-07-30 : formulations imposées présentes (estimation d’après l’atlas du Shom, à confirmer sur l’eau, à compléter sur carte marine, ne remplace pas les cartes et ouvrages nautiques officiels). Aucun appel réel à l’IA.

## Self-Check: PASSED

- FOUND: tests/debriefgpen.test.mjs, guide.html, js/help.js, regles.html, release.json (n = 43)
- FOUND: bbb304c, 3b2f1d9, 0a49b13, 6e4b0e3 (ancêtres de HEAD)
