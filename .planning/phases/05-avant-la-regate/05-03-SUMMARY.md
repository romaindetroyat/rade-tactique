---
phase: 05-avant-la-regate
plan: 03
subsystem: livraison
tags: [v32, release, production, openai, plafond, guide, vercel]

requires:
  - phase: 05-avant-la-regate
    provides: "plan 05-01 : rattrapage des anciennes traces et rangement à l'arrêt ; plan 05-02 : api/_ia.js (store:false, quota de 30 appels par équipier et par jour, messages en français)"
  - phase: 04-archive-partagee
    provides: "magasin Blob privé, middleware d'accès, PR et aperçu par branche"
provides:
  - "docs/ia-budget.md : geste guidé du plafond OpenAI de 10 $ par mois (Enforce a hard limit), garanties exactes de store:false, limite du jour, usage Blob"
  - "guide.html : carte « L'IA de l'app : limite du jour » et cartes Archive partagée, Enregistrer la trace, dictée et IC à jour"
  - "v32 (release.json n = 32, hachage 855e0d07cb) vérifiée sur l'aperçu puis en production sur « publie » de Romain"
  - "05-USER-SETUP.md : gestes humains restants, sans aucun secret"
affects: [production, equipage, ia, archive]

actuals:
  tokens: 5250
  tasks: 3
  commits: 2

plan_head_before: f42dd0fbbf392ae24866c6beb694c11c0bdb8641
plan_head_after: 3a4fa38780635450d739138b8669b9cd7ddaf43d
commits: 2

tech-stack:
  added: []
  patterns:
    - "livraison par branche d'aperçu et PR brouillon, passage en prête et fusion seulement après le « publie » écrit par Romain lui-même"
    - "porte rejouée avec VERCEL_ENV=production après la release (les tests neutralisent les variables Vercel)"

key-files:
  created:
    - docs/ia-budget.md
    - .planning/phases/05-avant-la-regate/05-USER-SETUP.md
  modified:
    - guide.html
    - release.json
    - sw.js
    - js/version.js

key-decisions:
  - "Romain a publié la v32 le 2026-10-20 (réponse « publie » écrite par lui-même) : production avant le gel du 2 novembre, 18 jours avant la régate du 7-9 novembre"
  - "La production est passée par la PR #6 (méthode merge, tête attendue verrouillée sur 29001e3) ; aucune poussée locale vers main"
  - "Formulation retenue pour store:false : « OpenAI ne garde pas les réponses » ; la surveillance des abus d'OpenAI peut garder les requêtes jusqu'à 30 jours"

patterns-established:
  - "Un point de décision bloquant précède toute mise en production ; seul un message de Romain vaut décision"

requirements-completed: [SECU2-01, ARCH2-01]

coverage:
  - id: D1
    description: "Romain dispose d'un geste guidé du plafond OpenAI de 10 $ par mois avec « Enforce a hard limit », de ce que l'app affiche à la coupure et de la façon de relever la limite"
    requirement: SECU2-01
    verification:
      - kind: unit
        ref: "docs/ia-budget.md contient « Enforce a hard limit », « project_spend_limit_exceeded » et aucun secret (grep de la tâche 1)"
        status: pass
    human_judgment: true
    rationale: "Le plafond n'existe que si Romain l'active sur le tableau de bord OpenAI ; l'écran Limits fait foi. Voir 05-USER-SETUP.md"
  - id: D2
    description: "La documentation et le guide disent exactement ce que garantit store:false (« OpenAI ne garde pas les réponses », requêtes gardables jusqu'à 30 jours par la surveillance des abus), jamais une promesse de non-conservation totale"
    requirement: SECU2-01
    verification:
      - kind: unit
        ref: "grep positif de « OpenAI ne garde pas les réponses » dans docs/ia-budget.md et guide.html ; grep négatif de « ne conserve rien »"
        status: pass
    human_judgment: false
  - id: D3
    description: "Le guide explique la limite de 30 appels par jour, son message, la vie sans l'IA, le rangement unique des anciennes traces et le rangement d'une trace enregistrée à l'arrêt"
    requirement: SECU2-01
    verification:
      - kind: unit
        ref: "grep de « Limite d'IA du jour atteinte — reprise demain » dans guide.html ; tests de guide dans npm run check (534 verts)"
        status: pass
    human_judgment: true
    rationale: "Le texte du guide se relit sur un vrai téléphone ; les libellés sont copiés de l'interface"
  - id: D4
    description: "La v32 est vérifiée pour de bon (PW_REQUIRED=1, tous les scénarios), la porte passe avec VERCEL_ENV=production, la référence SNPM est intacte, l'aperçu est Ready"
    requirement: ARCH2-01
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs (19/19 OK) ; measure-boot 4 5 ; audio-clock-check ; VERCEL_ENV=production npm run gate (534 pass, 0 fail) ; garde SNPM"
        status: pass
    human_judgment: false
  - id: D5
    description: "La v32 est en production sur décision de Romain, avant le gel du 2 novembre, sans poussée locale vers main"
    requirement: ARCH2-01
    verification:
      - kind: manual
        ref: "https://rade-tactique.vercel.app/sw.js porte \"n\":32 et \"id\":\"855e0d07cb\" ; statut Vercel success sur 3a4fa38 ; contrôles d'accès sans code : / 401, /api/archive 401, /api/rules 401, /data/meta.json 401, /acces.html 200"
        status: pass
    human_judgment: false

duration: ~15min (tâche 1) puis décision et production par l'orchestrateur
completed: 2026-10-20
status: complete
---

# Phase 5 Plan 03 : v32 en production, plafond OpenAI guidé Summary

**La v32 (rattrapage des traces, IA bornée par `store: false` et 30 appels par équipier et par jour) est en production depuis la fusion de la PR #6 sur « publie » de Romain, avec `docs/ia-budget.md` pour poser le plafond OpenAI de 10 $ par mois en limite stricte et un guide de l'équipage à jour.**

## Performance

- **Duration:** tâche 1 en une quinzaine de minutes (début non relevé, approximatif 09:30Z) ; décision de Romain puis fusion par l'orchestrateur
- **Completed:** 2026-10-20T09:49:00Z (fusion de production à 09:46Z, soit 11:46 à Paris)
- **Tasks:** 3 (tracer, décision bloquante, production)
- **Files modified:** 5 dans le commit de la tâche 1 (`docs/ia-budget.md`, `guide.html`, `release.json`, `sw.js`, `js/version.js`)

## Accomplissements

- `docs/ia-budget.md` (75 lignes, aucun secret, seuls les noms de variables) : les huit gestes du plafond de 10 $ par mois avec **Enforce a hard limit**, la coupure (429 `project_spend_limit_exceeded`, message « Budget d'IA du mois atteint — l'IA reprend le mois prochain », dépassement léger possible), ce que garantit `store: false`, la limite du jour par équipier, la vie sans l'IA, l'usage du magasin Blob et les noms des variables concernées.
- `guide.html` : nouvelle carte « L'IA de l'app : limite du jour » ; cartes « Archive partagée », « Enregistrer la trace », dictée et lecture d'IC mises à jour ; formulation « OpenAI ne garde pas les réponses », jamais une promesse de non-conservation totale.
- v32 publiée par `npm run release` (hachage `855e0d07cb`, 67 fichiers) ; `release.json` et `js/version.js` d'accord.
- Aperçu `apercu-phase-05` : déploiement Vercel de 29001e3 Ready (commentaire vercel[bot] à 09:44 UTC).
- Production : PR [#6](https://github.com/romaindetroyat/rade-tactique/pull/6) passée en « prête » puis fusionnée (méthode merge, `expectedHeadSha` 29001e3) en 3a4fa38 ; `sw.js` public porte `"n":32` et `"id":"855e0d07cb"`.

## Task Commits

1. **Task 1 (tracer) : v32 sur l'aperçu** : `29001e3` (chore, geste guidé, guide, release v32, porte verte avec `VERCEL_ENV=production`)
2. **Task 2 (checkpoint:decision, blocking) :** Romain a répondu lui-même « publie » le 2026-10-20. L'heure indiquée par l'orchestrateur est « vers 10 h, heure de Paris » ; les horodatages de Git (tâche 1 à 11:43 Paris, fusion à 11:46 Paris) sont postérieurs, donc l'heure exacte est à prendre avec prudence. Aucun commit.
3. **Task 3 : production** : fusion `3a4fa38` de la PR #6 par l'orchestrateur avec les outils GitHub de la session (aucune poussée locale vers `main`).

**Plan metadata:** commit `docs(05-03)` suivant ce fichier.

_Tracer : après la tâche 1, `<verify>` a été rejoué de bout en bout (voir ci-dessous) avant d'ouvrir le point de décision : « Tracer verified end-to-end — expanding »._

## Vérifications brutes (tâche 1, avant la release)

- `npm run check` : `# tests 534`, `# pass 534`, `# fail 0`.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs` (tous les scénarios) : 19/19 OK.
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : médiane de l'interface utile 394 ms (maximum 435 ms), seuil 2000 ms.
- `PW_REQUIRED=1 node tools/audio-clock-check.mjs` : premier passage hors seuil (−83,2 ms), puis deux passages OK (15,6 ms et 15,5 ms). Voir la déviation ci-dessous.
- `npm run release -- "rattrapage des traces, IA bornée (quota, store:false)"` : « stamp écrit : v32 · 20/10 · 855e0d07cb · 67 fichiers ».
- `RT_STRICT=1 node tools/stamp.mjs --check` : « stamp à jour ».
- `VERCEL_ENV=production npm run gate` : 0.

## Vérifications de la production (tâche 3, par l'orchestrateur)

- Avant fusion : tête `origin/apercu-phase-05` = 29001e3ca59a2174fc455e9c80342f6b404fbd40 (inchangée depuis la tâche 1) ; `main` = 78d4a1d883f65dd259f3279484cef504797597a5.
- Porte rejouée par l'orchestrateur : `VERCEL_ENV=production npm run gate` → `# pass 534`, `# fail 0`. Garde SNPM `git diff --quiet f80c365 -- js/courses.js tests/reference/` → 0.
- Fusion : 3a4fa38780635450d739138b8669b9cd7ddaf43d sur `main` ; statut Vercel `success`.
- Sans code d'accès : `/` 401 (sans en-tête de navigation), `/api/archive` 401, `/api/rules` 401, `/data/meta.json` 401, `/acces.html` 200.
- SHA de `main` : 78d4a1d avant, 3a4fa38 après (fusion de la PR, aucune poussée locale).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mesure de l'horloge audio hors seuil au premier passage**
- **Found during:** Task 1 (`audio-clock-check`, `PW_REQUIRED=1`)
- **Issue:** un premier passage a sorti −83,2 ms, hors seuil ; deux passages suivants OK (15,6 ms et 15,5 ms). Le chemin audio n'a pas changé depuis la v31 : on retrouve le glissement connu de l'horloge audio de Chromium sur la machine de mesure (voir la décision 02-01 de STATE.md), pas un défaut de la v32.
- **Fix:** aucun code audio modifié ; mesure rejouée, les trois sorties consignées ici.
- **Files modified:** aucun
- **Commit:** n/a

**Total deviations:** 1 (mesure rejouée, aucun changement de code). **Impact on plan:** aucun, mais « Tester le son » sur un vrai iPhone reste à faire (voir USER-SETUP).

## Issues Encountered

- L'heure de la décision de Romain donnée par l'orchestrateur (vers 10 h, Paris) précède les horodatages de la tâche 1 et de la fusion ; elle est consignée telle que reçue, avec cette réserve.

## Consignes pour Romain (plan, tâche 3, points a à d)

- **(a) Mise à jour des téléphones :** chaque iPhone applique la v32 par le bandeau « Mettre à jour », sur un geste, hors course, **avant le 7 novembre**. Au premier lancement, le rattrapage range les anciennes traces dans l'archive (toast « N traces rangées dans l'archive », ligne `reprise` du Journal).
- **(b) Usage Blob :** relever Vercel, Observability, Blob, avant et après le week-end du 7-9 novembre ; au-delà de 40 % du quota pour l'IA seule, revoir le compteur.
- **(c) Repli en cas de défaut :** Instant Rollback vers le déploiement v31 dans Vercel, puis correctif et v33 ; jamais pendant une course ni dans les 48 h avant une régate, sauf correctif critique fait hors de l'eau.
- **(d) IA coupée par le budget :** relever la limite au même endroit que sa pose (`docs/ia-budget.md`).

## Contrôles humains encore ouverts

Détail et cases à cocher dans `05-USER-SETUP.md` (aucun secret).

1. Plafond OpenAI de 10 $ par mois avec « Enforce a hard limit » (T-05-14).
2. Variables du projet Vercel présentes pour Preview (noms seulement).
3. Quatre appels d'IA réels (dictée, débrief, arbitre, lecture d'IC) sans erreur 500.
4. Usage Blob avant et après le 7-9 novembre.
5. Premier lancement de la v32 sur un iPhone qui a de vieilles traces : Coupe SNPM une seule fois dans sa fiche, ligne `reprise` au Journal.
6. Une trace enregistrée un jour de régate, rangée à l'arrêt.
7. Compteur à 30 : toasts de la dictée et du débrief, 31e question à l'arbitre.
8. Mode avion : fiche, trace et débrief de la Coupe SNPM lisibles.
9. « Tester le son » sur iPhone.
10. Rappel à l'équipage de mettre à jour avant le 7 novembre.

## Known Stubs

Aucun.

## Threat Flags

Aucune nouvelle surface : ce plan ne change que de la documentation, le guide et la version générée. Mitigations du plan en place : T-05-13 (point de décision bloquant, production le 20 octobre, bien avant le gel), T-05-15 (noms de variables seulement, aucun secret dans les documents), T-05-16 (formulation exacte sur `store: false`, vérifiée par grep positif et négatif). T-05-14 reste ouvert tant que Romain n'a pas posé le plafond de dépense (contrôle humain 1) ; le quota de 30 appels par équipier est le premier filet.

## Self-Check: PASSED

Fichiers présents : `docs/ia-budget.md`, `guide.html`, `release.json`. Commits retrouvés dans l'historique : `29001e3`, `3a4fa38` (ancêtres de HEAD). `release.json` : n = 32, hachage `855e0d07cb`.
