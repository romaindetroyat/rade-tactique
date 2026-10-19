---
phase: 01-mises-en-ligne-sans-risque
plan: 02
subsystem: infra
tags: [service-worker, version, precache, node-test, stamp, pwa]

requires: []
provides:
  - "tools/stamp.mjs : listShell, contentHash, build, check, validateNote ; modes écriture, --release, --check"
  - "release.json : source humaine de la version (v25, hash vide tant qu'aucune release n'est faite)"
  - "js/version.js : export const BUILD (généré), forme { n, date, label, note, critical, id }"
  - "sw.js : bloc généré BUILD / VERSION / SHELL entre marqueurs ; nom du cache = 'rade-' + BUILD.id"
  - "Version consultable dans l'aide (Version v25 · 19/10 — accès équipage), retirée de la ligne d'état"
affects: [01-03 mise à jour différée (réutilise BUILD et relance stamp), 01-04 porte de mise en ligne (npm run stamp / release / check)]

actuals:
  tokens: 4500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Fichier généré entre marqueurs dans sw.js, réécrit de façon idempotente par un script Node pur"
    - "Identifiant de version = SHA-256 (10 hex) du contenu de l'app et de la logique du worker hors bloc généré : pas de fausse version, pas de version oubliée"
    - "Contrôle de fraîcheur séparé des tests : stamp --check (strict en production ou RT_STRICT=1), npm test ne l'exécute pas"

key-files:
  created:
    - tools/stamp.mjs
    - release.json
    - js/version.js
    - tests/stamp.test.mjs
  modified:
    - sw.js
    - js/help.js
    - js/app.js

key-decisions:
  - "pdf.js (1,5 Mo) est précaché pour importer des IC hors réseau au ponton (Open Question 4)"
  - "stamp --check : le contenu non releasé est une erreur seulement si VERCEL_ENV=production ou RT_STRICT=1, un avertissement ailleurs (Open Question 5, A3)"
  - "validateNote est appelée aussi par build() : une note invalide ne peut jamais atteindre sw.js ni js/version.js"
  - "Le hachage exclut release.json et js/version.js : un changement de numéro ou de note seul ne crée pas de nouvel identifiant"

requirements-completed: [TEST-04, FIAB-02]

plan_head_before: aec66850e73390e46f48380154250f975cad6d58
plan_head_after: fe64646f3482b26c1cd473326c6cbfca21a11ff2

coverage:
  - id: D1
    description: "Une seule commande, node tools/stamp.mjs, produit la version et la liste hors réseau (45 fichiers) à partir de release.json ; plus rien n'est tenu à la main dans sw.js ni dans js/app.js"
    requirement: TEST-04
    verification:
      - kind: unit
        ref: "tests/stamp.test.mjs (6 tests : listShell, build déterministe, check, validateNote, SHELL complet, plus de version écrite à la main)"
        status: pass
      - kind: other
        ref: "node tools/stamp.mjs deux fois de suite : sw.js identique (cmp) ; node tools/stamp.mjs --check : code 0 ; RT_STRICT=1 : code 1 sans release"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tout fichier chargé par l'app (imports, index.html, icônes du manifeste, pdf.js) figure dans la liste hors réseau ; un fichier ajouté entre sans retouche"
    requirement: TEST-04
    verification:
      - kind: unit
        ref: "tests/stamp.test.mjs#tout fichier chargé par l’app est dans le SHELL ; mutation vendor/ retiré de DIRS : le test échoue"
        status: pass
    human_judgment: false
  - id: D3
    description: "L'équipier lit la version dans l'aide, la ligne d'état n'affiche plus de version (D-08) et rien n'est envoyé au serveur (D-09)"
    requirement: FIAB-02
    verification:
      - kind: other
        ref: "grep : from './version.js' et esc(BUILD.note) dans js/help.js, APP_VERSION absent de js/app.js"
        status: pass
    human_judgment: true
    rationale: "Rendu dans l'app installée sur iPhone (Safari standalone) : à regarder après la mise en production du plan 04 (human-check de la tâche 2)"

duration: 3min
completed: 2026-10-19
status: complete
---

# Phase 1 Plan 02 : Version et liste hors réseau générées — Summary

**`node tools/stamp.mjs` écrit à partir de `release.json` un bloc généré dans `sw.js` (version, nom du cache dérivé du contenu, liste de 45 fichiers hors réseau) et `js/version.js` ; la version « v25 · 19/10 — accès équipage » s'affiche dans l'aide et a disparu de la ligne d'état.**

## Performance

- **Duration:** 3 min (horloge de la machine)
- **Started:** 2026-10-19T11:12:19Z
- **Completed:** 2026-10-19T11:15:00Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 7

## Accomplishments

- Tracer (tâche 1) de bout en bout : `release.json` puis `stamp` puis `sw.js` et `js/version.js` puis ligne de version dans le guide. Porte du tracer : les deux vérifications automatiques relancées, vertes, « Tracer verified end-to-end — expanding ».
- Liste hors réseau : **45 fichiers**. Les trois fichiers qui manquaient à la liste écrite à la main (et donc indisponibles hors réseau) y sont désormais : `icons/icon-maskable-512.png` (déclaré dans le manifeste), `vendor/pdf.min.js` et `vendor/pdf.worker.min.js`. S'y ajoute `js/version.js` (nouveau fichier généré) : 41 fichiers à la main avant, 45 maintenant.
- Idempotence : deux écritures successives donnent des octets identiques ; `--check` sort en 0 en local (avertissement « contenu modifié depuis la v25 » accepté, aucune release n'est faite dans ce plan) et en 1 avec `RT_STRICT=1`.
- `--release` avec une note contenant un chevron est refusé (code 1) sans rien écrire (vérifié, `git status` inchangé).
- Six tests dans `tests/stamp.test.mjs`, dont « tout fichier chargé par l'app est dans le SHELL » qui lit les imports de `js/*.js`, `index.html`, les icônes du manifeste, `loadScript(` et `workerSrc`. Mutation contrôlée : retirer `vendor/` des dossiers de `listShell` fait échouer ce test (et le test 1) ; fichier restauré, vert. `npm test` : 25 réussis (19 du plan 01 et 6 nouveaux).

## Task Commits

1. **Tâche 1 (tracer) : version et liste générées, version dans l'aide** - `6735995` (feat)
2. **Tâche 2 (TDD) : liste sans oubli possible, version retirée de la ligne d'état**
   - RED : `79d7431` (test) — 5 tests verts, 1 rouge
   - GREEN : `fe64646` (feat) — `APP_VERSION` supprimée de `js/app.js`, `sw.js` et `js/version.js` régénérés

**Plan metadata:** commit docs de ce SUMMARY (voir `git log`).

## TDD Gate Compliance

**Tâche 2 — RED (constaté)** : `node --test --import ./tests/helpers/setup.mjs tests/stamp.test.mjs` : 5 réussis, 1 échec. Cible en échec : « la version n’est plus tenue à la main dans sw.js ni dans js/app.js », sur l'assertion prévue `'APP_VERSION doit disparaître de js/app.js (D-08)'`. Évaluation sémantique : le test a bien exécuté son contrôle et échoue sur le comportement visé, pas sur une erreur d'import ou de fixture. Les cinq autres tests portent sur `tools/stamp.mjs`, écrit à la tâche 1 (tracer) : ils sont verts dès le départ, voulu (le comportement existait déjà, ils le figent). Un premier lancement avait montré deux erreurs de mon propre test (chemin `js/../vendor/…` non normalisé, `data-src` pris pour `src`) : corrigées avant le commit RED. GREEN : `js/app.js` seul (plus régénération), 6 tests verts. Pas de REFACTOR. Le classifieur `check tdd-red-evidence` n'a pas été lancé : `workflow.tdd_mode` n'est pas activé et le plan est `type: execute`.

## Files Created/Modified

- `tools/stamp.mjs` — exports `listShell`, `contentHash`, `build`, `check`, `validateNote` ; CLI gardée par la comparaison `process.argv[1]` / `import.meta.url` (rien n'est écrit à l'import)
- `release.json` — `{ n: 25, date: 2026-10-19, note: « accès équipage », critical: false, hash: "" }`
- `js/version.js` — généré, `export const BUILD`
- `sw.js` — lignes de nom de cache et de tableau écrites à la main remplacées par le bloc généré ; install, activate et fetch inchangés (plan 03)
- `js/help.js` — `import { BUILD }`, paragraphe `#appVersion` ajouté à l'ouverture du guide (note échappée avec `esc()`)
- `js/app.js` — `APP_VERSION` et son préfixe dans la ligne d'état retirés
- `tests/stamp.test.mjs` — les six tests

## Decisions Made

Voir `key-decisions`. À noter pour la suite : le numéro v25 est celui en service ; la première release du plan 04 (`--release`) donnera v26.

## Deviations from Plan

None - plan executed exactly as written.

Détails mineurs sans effet sur le fond : le plan désignait les lignes 3-9 de `sw.js` pour la liste écrite à la main ; elle occupait en réalité les lignes 3-10 (le tableau se terminait ligne 10). Le remplacement a porté sur le bon bloc (nom du cache et tableau entier). La recherche annonçait 46 fichiers pour la liste ; le calcul sur le dépôt actuel en donne 45 (aucun fichier attendu ne manque : `js/*.js`, `js/version.js`, pdf.js et l'icône maskable y sont tous).

**Total deviations:** 0
**Impact on plan:** aucun.

## Issues Encountered

None.

## Vérifications du plan

| Vérification | Résultat |
|--------------|----------|
| `node --test tests/stamp.test.mjs` | 6 réussis, 0 échec |
| `npm test` | 25 réussis, 0 échec (environ 3,5 s) |
| `node tools/stamp.mjs --check` | code 0, avertissement « contenu modifié depuis la v25 » |
| `RT_STRICT=1 node tools/stamp.mjs --check` | code 1 (hash vide) |
| Deux `node tools/stamp.mjs` successifs | `sw.js` identique (`cmp`) |
| `grep -c 'stamp:begin' sw.js` / `grep -c 'BUILD.id' sw.js` / `grep -c 'rade-v25' sw.js` | 1 / 1 / 0 |
| SHELL : aucun chemin `tools/ tests/ api/ rapports/`, aucun `LICENSE` ; tous les `js/*.js`, `js/version.js`, pdf.js, icône maskable présents | conforme |
| `grep -c "from './version.js'" js/help.js` / `grep -c 'esc(BUILD.note)' js/help.js` | 1 / 1 |
| `grep -c APP_VERSION js/app.js` ; la ligne d'état « prévisions … » existe toujours | 0 ; oui |

## User Setup Required

None - no external service configuration required.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouvel élément de surface au-delà de `<threat_model>` du plan : T-01-06 accepté (le bloc public de `sw.js` ne contient que noms de fichiers, numéro, date et note), T-01-07 traité (`validateNote` refuse `<`, `>` et plus de 80 caractères, y compris dans `build()` ; `esc()` dans l'aide), T-01-08 traité (SHELL calculé, test « tout fichier chargé est dans le SHELL », `stamp --check` à brancher dans la porte au plan 04). Aucun paquet installé.

## Pour la suite

- `sw.js` et `js/version.js` sont à jour pour l'état courant du dépôt. Après la fusion avec les changements d'autres plans (le plan 01 a déjà modifié `js/events.js`, avant ce plan ici), relancer `node tools/stamp.mjs` (plan 03).
- `.claude/CLAUDE.md` décrit encore `APP_VERSION`, `VERSION` et `SHELL` tenus à la main : à mettre à jour (hors fichiers de ce plan).
- Le human-check de la tâche 2 (aide et ligne d'état sur iPhone) est repris par la vérification de fin de phase.

## Next Phase Readiness

Prêt pour le plan 03 : `BUILD` (`js/version.js`, `sw.js`) et `node tools/stamp.mjs` sont en place. Aucun blocage.

## Self-Check: PASSED

Fichiers créés présents (tools/stamp.mjs, release.json, js/version.js, tests/stamp.test.mjs) ; commits `6735995`, `79d7431`, `fe64646` présents dans l'historique de `apercu-phase-01` ; `commits: 3` mesuré par `git rev-list --count` depuis `plan_head_before` ; `npm test` vert.

---
*Phase: 01-mises-en-ligne-sans-risque*
*Completed: 2026-10-19*
