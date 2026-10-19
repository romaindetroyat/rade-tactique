---
phase: 01-mises-en-ligne-sans-risque
plan: 01
subsystem: testing
tags: [node-test, linkedom, pdfjs, middleware, regression, securite]

requires: []
provides:
  - "npm test : harnais node:test sans build (19 tests, environ 3,5 s, sans réseau)"
  - "Référence mesurée de la Coupe SNPM du 18/10/2026 (tests/reference/coupe-snpm-2026-10-18.json) avec note measuredWith"
  - "Calculs de base figés (géométrie, polaire, vent, routage, bords)"
  - "Test d'accès sur le vrai middleware : énumération du dépôt, noms voisins, code simulé"
  - "PDF_OPTIONS (isEvalSupported: false) exporté par js/events.js et garde statique sur getDocument("
  - "package-lock.json (npm ci reproductible), engines node 24.x"
affects: [01-04 porte de mise en ligne (npm run check), phase 2 JUST-02 (recalage des bouées), phase 3 REG-03 (import d'IC)]

actuals:
  tokens: 6600
  tasks: 3
  commits: 5

tech-stack:
  added: ["linkedom 0.18.13 (devDependency, version exacte)"]
  patterns:
    - "mesurer(cas) : une seule chaîne de mesure partagée entre le test et la mesure initiale des valeurs consignées"
    - "Un fichier JSON de référence par cas, valeurs arrondies à la précision d'affichage, jamais réécrit par un test"
    - "Test d'accès : matcher émulé comme Vercel + vrai middleware + crypto.subtle.digest simulé, aucune empreinte ni code dans les sources de test"

key-files:
  created:
    - package-lock.json
    - tests/helpers/setup.mjs
    - tests/helpers/reference.mjs
    - tests/reference/coupe-snpm-2026-10-18.json
    - tests/reference.test.mjs
    - tests/calc.test.mjs
    - tests/access.test.mjs
    - tests/pdf.test.mjs
  modified:
    - package.json
    - middleware.js
    - js/events.js

key-decisions:
  - "Référence SNPM mesurée avec tStart = départ détecté 09:43:42Z (D-14) et non 09:45:00Z : les valeurs de 01-RESEARCH.md ne sont qu'indicatives, aucune n'a été recopiée"
  - "Matcher d'accès : acces.html, manifest.webmanifest et sw.js ancrés par $ ; icons/ et rapports/ restent des préfixes"
  - "Borne basse MIN_CARACTERES = 10000 pour l'extraction des PDF (jamais une longueur exacte)"

requirements-completed: [TEST-01, TEST-02, SECU-01]

plan_head_before: 6a8976f6f3838e5aa4678b56b2035853c43372c9
plan_head_after: 5e5103b108710579c43f65c3ca80e9591afc50ff

coverage:
  - id: D1
    description: "npm test rejoue la trace GPX réelle de la Coupe SNPM (fromGPX, detect, analyze) et compare exactement à la référence mesurée"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "tests/reference.test.mjs (5 tests) ; mutations contrôlées départ 09:45:00Z et polaire +1 : npm test échoue"
        status: pass
    human_judgment: true
    rationale: "D-12 : les valeurs de référence ne sont retenues qu'après validation de Romain en fin de phase (measuredWith.validation)"
  - id: D2
    description: "Calculs de base figés par des cas fabriqués : géométrie, polaire, champ de vent, routage, bords"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "tests/calc.test.mjs (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sans code d'accès, tout fichier non public, toute fonction /api et tout chemin inconnu est refusé ; noms voisins des fichiers publics désormais privés"
    requirement: TEST-02
    verification:
      - kind: unit
        ref: "tests/access.test.mjs (5 tests) ; mutation |data/ dans le matcher : le test échoue"
        status: pass
    human_judgment: false
  - id: D4
    description: "L'import d'un PDF d'IC ouvre pdf.js avec isEvalSupported: false ; les IC SNPM et le cahier de parcours s'importent toujours"
    requirement: SECU-01
    verification:
      - kind: unit
        ref: "tests/pdf.test.mjs (4 tests, pdf.js vendorisé exécuté sous Node)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-19
status: complete
---

# Phase 1 Plan 01 : Filet de tests automatiques — Summary

**`npm test` (node:test + linkedom, sans build ni réseau) rejoue la trace réelle de la Coupe SNPM contre une référence mesurée, fige les calculs de base, prouve le contrôle d'accès sur le vrai middleware (matcher resserré aux noms exacts) et vérifie que l'import d'IC ouvre pdf.js avec `isEvalSupported: false`.**

## Performance

- **Duration:** 5 min (horloge de la machine)
- **Started:** 2026-10-19T11:05:00Z
- **Completed:** 2026-10-19T11:10:00Z
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 11 (dont `package-lock.json`)

## Accomplishments

- Le tracer (tâche 1) tourne de bout en bout : trace GPX réelle de 9 538 points, `fromGPX`, `detect`, `analyze`, comparaison exacte au JSON de référence. Passage de la porte du tracer : `npm test` relancé, vert, « Tracer verified end-to-end — expanding ».
- Les quatre ancres verrouillées (D-11, D-14) ont été contrôlées avant de consigner la référence, et sont aussi écrites dans le test lui-même : parcours 4 réduit, bouées 7 puis 6 en tête, deux faux départs, départ 09:43:42Z, bascule du vent à gauche du bord 1 au bord 2. Aucune ancre ne manquait.
- Le matcher d'accès laissait publics `/sw.js.map`, `/sw.jsx`, `/acces.html.bak`, `/manifest.webmanifest.old` : corrigé, prouvé rouge puis vert.
- Faille CVE-2024-4367 fermée au seul point d'appel de pdf.js, avec une garde qui refuse tout futur `getDocument(` sans l'option.

## Référence SNPM mesurée (à valider par Romain en fin de phase, D-12)

Valeurs produites par `mesurer(cas)` (tests/helpers/reference.mjs), consignées telles quelles dans `tests/reference/coupe-snpm-2026-10-18.json`. Heures en UTC (Paris = UTC+2, donc 09:43:42Z = 11:43:42).

**Note `measuredWith`** : configuration « tStart = départ détecté (`det.tStart`, D-14) ; startWind 60 ; prévision 60°/7 nd ; 3 relevés de `entrees` ; localFx 1 ; perf 1 ; forbidden [] ; TZ Europe/Paris » ; date 2026-10-19 ; commit `6a8976f` ; node v22.22.0 ; validation « à valider par Romain en fin de phase 1 (D-12) ».
Relevés d'entrée figés : 09:58Z 60°/7,6 nd ; 10:33Z 30°/7,1 nd ; 11:19Z 15°/5,9 nd.

| Élément | Valeur mesurée |
|---------|----------------|
| Trace | 9 538 points, premier point 06:04:23Z |
| Parcours | 4, classe P, 1 tour, arrivée réduite |
| Passages (bouée, heure, distance) | 7 à 10:11:51Z (33 m) ; 6 Houlographe à 10:55:20Z (30 m) ; 5 à 11:42:56Z (2 m) |
| Faux départs | 09:31:02Z à 09:35:24Z ; 09:41:22Z à 09:42:46Z (11:31 à 11:35 et 11:41 à 11:43 à Paris) |
| Départ détecté | 09:43:42Z (11:43:42 à Paris) |

| Bord | Vent (source, direction, force) | % de polaire par allure | Stats (virements, % du temps sous 2 nd, % à droite de la route directe) |
|------|---------------------------------|-------------------------|-----------------------------------------------------------------------|
| 1 | vent au départ, 60°, 6,5 nd | travers 86 ; près 93 | 3 ; 0 ; 22 |
| 2 | vos changements d'amure, 32°, 7 nd | portant 102 | 3 ; 0 ; 0 |
| 3 | vos changements d'amure, 30°, 4,5 nd | travers 58 ; près 80 | 11 ; 14 ; 73 |

Points à regarder avec Romain :
- Le bord 1 reprend simplement le vent saisi (60°) : un seul bord ne permet pas de mesurer le vent. La bascule « 60° vers 32° » (28° à gauche) vient donc de la comparaison entre cette entrée et la mesure du bord 2.
- Écart avec le tableau indicatif de 01-RESEARCH.md (mesuré avec tStart 09:45:00Z) : bord 2 à 32° au lieu de 31,29°, bord 3 travers 58 % au lieu de 60 %. C'est l'effet attendu du passage à tStart = départ détecté (D-14), pas une anomalie.
- Le rapport publié donne 97 / 104 / 74 % avec le modèle horaire AROME ; la référence figée utilise des relevés fixes et le modèle de vent a évolué (frein côtier) : c'est un test de non-régression, pas une preuve de justesse physique.
- Les passages aux bouées 7 et 6 (33 et 30 m) viennent des positions relevées sur cette même trace : le recalage des bouées (JUST-02, phase 2) fera légitimement bouger ces nombres.

Reproductibilité : la commande de mesure a été relancée après consignation et redonne exactement les clés `trace`, `parcours`, `passages`, `fauxDeparts`, `depart`, `bords` du fichier (le test `reference.test.mjs` fait cette comparaison à chaque `npm test`).

## Longueurs de texte extraites des PDF (tâche 3)

Mesurées sous Node 22.22.0 avec le pdf.js vendorisé 3.11.174 (borne basse `MIN_CARACTERES` = 10 000, aucune égalité exacte assertée) :

| PDF | Node 22.22 (19/10/2026) | Chromium (01-RESEARCH.md) |
|-----|-------------------------|---------------------------|
| IC Coupe SNPM | 11 476 | 11 302 |
| Cahier de parcours CVAT | 11 257 | 11 036 |

`parseIC` sur les IC SNPM : `event` « COUPE de la SNPM CVAT », `date` 2026-10-18, `firstWarning` 10:55, `lastFinishSignal` 16:00, `vhf` 72, `keyRules` non vide.

## Task Commits

1. **Tâche 1 (tracer) : npm test rejoue la Coupe SNPM de bout en bout** - `2f87740` (test)
2. **Tâche 2 (TDD) : calculs de base et accès**
   - RED : `f67f98f` (test) — 8 tests verts, 2 rouges
   - GREEN : `9ea9e48` (fix) — matcher resserré
3. **Tâche 3 (TDD) : import PDF d'IC**
   - RED : `7c8f9da` (test) — 2 tests rouges, 2 verts
   - GREEN : `5e5103b` (fix) — `PDF_OPTIONS`

**Plan metadata:** commit docs de ce SUMMARY (voir `git log`).

## TDD Gate Compliance

**Tâche 2 — RED (constaté)** : `node --test --import ./tests/helpers/setup.mjs tests/calc.test.mjs tests/access.test.mjs` : 8 réussis, 2 échecs. Cibles en échec : « noms voisins des fichiers publics : interceptés » et « sans code : tout fichier non public… », sur l'assertion prévue `'/sw.js.map devrait passer par le middleware'` (le chemin voisin n'était pas intercepté, donc public). Évaluation sémantique : les deux cibles se sont exécutées et ont échoué sur le comportement visé, pas sur une erreur d'import ou de fixture. Les cinq tests de `calc.test.mjs` sont des tests de caractérisation des calculs existants (verts dès le départ, voulu : ils figent l'existant). GREEN : `middleware.js` ligne du matcher seule ; 10 tests verts ; mutation `|data/` ajoutée au matcher : le test d'accès échoue.

**Tâche 3 — RED (constaté)** : `node --test … tests/pdf.test.mjs` : 2 réussis, 2 échecs. Cibles en échec : « pdfText ouvre le PDF avec isEvalSupported: false » (option `undefined`) et « garde statique… » (`'js/events.js : getDocument( sans isEvalSupported: false'`). Évaluation sémantique : la vraie bibliothèque a été exécutée (espion sur `getDocument`), l'échec porte sur l'option attendue. GREEN : `PDF_OPTIONS` gelé et `getDocument({ ...PDF_OPTIONS, data })` ; 4 tests verts, `npm test` : 19 réussis. Pas de REFACTOR (rien à nettoyer). Le classifieur `check tdd-red-evidence` n'a pas été lancé : `workflow.tdd_mode` n'est pas activé dans `config.json` et les plans sont `type: execute`.

## Files Created/Modified

- `package.json`, `package-lock.json` — script `test` (glob entre guillemets), `engines.node` 24.x, devDependency `linkedom` 0.18.13 ; l'ordre alphabétique des dépendances a été normalisé par npm
- `tests/helpers/setup.mjs` — fuseau Europe/Paris, DOMParser (linkedom), fetch local sans réseau, `ROOT`, `fixture()`
- `tests/helpers/reference.mjs` — `mesurer(cas)`, chaîne fromGPX, detect, analyze (aucune écriture disque)
- `tests/reference/coupe-snpm-2026-10-18.json` — entrées figées, valeurs mesurées, `measuredWith`
- `tests/reference.test.mjs`, `tests/calc.test.mjs`, `tests/access.test.mjs`, `tests/pdf.test.mjs` — les quatre fichiers de test
- `middleware.js` — `config.matcher` et son commentaire seulement
- `js/events.js` — `PDF_OPTIONS` exporté, utilisé par `pdfText`

## Decisions Made

- Référence mesurée avec le départ détecté (D-14) : voir le tableau ci-dessus.
- Test d'accès : liste publique écrite en dur (`/acces.html`, `/manifest.webmanifest`, `/sw.js`, préfixes `/icons/` et `/rapports/`) ; un fichier ajouté sous `icons/` ou `rapports/` reste public par construction, tout autre fichier doit passer par le middleware.
- Aucune empreinte ni code dans les sources de test, ni dans la sortie des tests (vérifié : `grep -cE '[0-9a-f]{64}'` sur la sortie du test d'accès = 0 et sur `tests/`, `package-lock.json` = aucun fichier). Les hachages de `middleware.js` n'ont été copiés nulle part.

## Deviations from Plan

None - plan executed exactly as written.

Détails mineurs sans effet sur le fond : le plan fusionnait `setup.mjs` et `env.mjs` en un seul fichier (fait). La mesure initiale a été consignée par un script ponctuel hors dépôt (aucune écriture de référence dans `tests/`, la garde `grep writeFile|appendFile` ne trouve rien). La valeur du bord 2 consignée (32°) diffère du tableau indicatif de la recherche (31,29°) à cause de tStart, comme prévu par le plan.

**Total deviations:** 0
**Impact on plan:** aucun.

## Issues Encountered

None. `npm ci` sur un clone propre de la branche réussit (46 paquets, 0 vulnérabilité) et `npm test` y passe (19 tests, environ 4 s).

## Vérifications du plan

| Vérification | Résultat |
|--------------|----------|
| `npm test` | 19 réussis, 0 échec, environ 3,5 s |
| `npm ls linkedom`, `engines`, script `test` | 0.18.13 exact, 24.x, `--import ./tests/helpers/setup.mjs` présent |
| Référence : départ, measuredWith, 3 bords | conforme |
| Mutations contrôlées de la référence (départ 09:45:00Z ; polaire +1) | chacune fait échouer `npm test`, fichier restauré identique |
| Aucun accès réseau | le fetch de test lève pour toute URL http/https |
| `grep -rlE 'writeFile\|appendFile' tests/*.mjs tests/helpers/` | rien |
| `grep -cF 'sw\\.js$' middleware.js` | 1 ; diff limité au matcher et à son commentaire |
| `grep -c 'isEvalSupported: false' js/events.js` / `grep -c PDF_OPTIONS js/events.js` | 2 / 2 |
| `git diff package.json` pendant la tâche 3 | vide |

## User Setup Required

None - no external service configuration required.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouvel élément de surface au-delà de `<threat_model>` du plan (T-01-01 à T-01-04 et T-01-SC traités : matcher ancré, empreintes jamais affichées, option pdf.js, référence non réécrite, linkedom en version exacte avec lockfile).

## Pour la vérification de fin de phase (à présenter à Romain)

- Valider les valeurs de référence du tableau ci-dessus (D-11, D-12, D-14) ; à son accord, renseigner la date dans `measuredWith.validation` de `tests/reference/coupe-snpm-2026-10-18.json`.
- Dernier déploiement « à l'ancienne » (Pitfall 2 de la recherche) : le mécanisme de mise à jour du plan 02 ne s'appliquera pas aux téléphones qui ont encore le service worker v25 ; à livrer à un moment calme, hors des 48 h avant une régate.
- La vérification du matcher sur l'aperçu Vercel (`GET /sw.jsx` sans cookie : 302 ou 401) est prévue au plan 04.

## Next Phase Readiness

Prêt pour les plans suivants : `npm test` est la commande que `npm run check` et la porte de mise en ligne (plan 04) exécuteront. Aucun blocage.

## Self-Check: PASSED

Fichiers créés présents (package-lock.json, tests/helpers/setup.mjs, tests/helpers/reference.mjs, tests/reference/coupe-snpm-2026-10-18.json, tests/reference.test.mjs, tests/calc.test.mjs, tests/access.test.mjs, tests/pdf.test.mjs) ; commits `2f87740`, `f67f98f`, `9ea9e48`, `7c8f9da`, `5e5103b` présents dans l'historique de `apercu-phase-01` ; `commits: 5` mesuré par `git rev-list --count` depuis `plan_head_before` ; `npm test` vert.

---
*Phase: 01-mises-en-ligne-sans-risque*
*Completed: 2026-10-19*
