---
phase: 05-avant-la-regate
plan: 02
subsystem: ia
tags: [openai, store-false, quota, blob, tdd, playwright, secu]

requires:
  - phase: 04-archive-partagee
    provides: "magasin Blob privé (préfixes prod/ et preview/, écriture ifMatch), prénom posé par le middleware (x-rt-membre), faux Blob de tests"
  - phase: 05-avant-la-regate
    provides: "plan 05-01 : js/app.js, tools/regate-e2e.mjs, sw.js et js/version.js dans l'état laissé par la vague 1"
provides:
  - "api/_ia.js : IA bornée commune (store:false en dernier, quota de 30 appels par équipier et par jour de Paris dans le Blob privé, compteur ouvert en panne, erreurs d'OpenAI en français)"
  - "api/rules.js, voice.js, debrief.js, ic.js en createHandler({ openai, blob, now }) sur l'aide commune"
  - "messages du serveur (quota du jour, budget du mois, IA occupée) affichés par les quatre écrans, avec leur repli sans IA"
  - "scénario Playwright arbitre ; cas 429 dans ia-erreurs ; store:false vérifié dans ia"
affects: [05-03, ia, securite]

actuals:
  tokens: 14075
  tasks: 3
  commits: 4

plan_head_before: 8db3d3af828e552491c5c113839cd5cb4df27701
plan_head_after: 4f9810cd3f88551bcb259d5658d18555893ed5a0
commits: 4

tech-stack:
  added: []
  patterns:
    - "aide serveur préfixée _ (pas une route Vercel) qui centralise l'appel au client OpenAI ; garde statique qui interdit tout appel direct ailleurs"
    - "compteur par équipier et par jour dans un blob à part, lu sans cache puis écrit sous ifMatch, une seule relecture sur conflit, chaque opération bornée à 2 s, ouvert en panne"
    - "fonctions Vercel en createHandler({ openai, blob, now }) à dépendances injectables, sur le modèle d'api/ic.js"

key-files:
  created:
    - api/_ia.js
    - tests/apiia.test.mjs
  modified:
    - api/rules.js
    - api/voice.js
    - api/debrief.js
    - api/ic.js
    - regles.html
    - js/app.js
    - js/debrief.js
    - js/icread.js
    - tests/apiic.test.mjs
    - tests/icread.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "On compte avant l'appel à OpenAI : un appel raté coûte une unité sur 30, mais une panne d'OpenAI ne permet pas de contourner le quota"
  - "Le compteur reçoit `delai` en option de createHandler (en plus de { openai, blob, now } du plan) pour tester la lecture retenue sans attendre 2 s"
  - "Le 429 d'OpenAI sans code de budget reconnu devient `ia_occupee` (rien ne casse si OpenAI ajoute un code)"
  - "Le débrief transmet le message du 429 par `iaNote` dans l'objet de repli de narrative ; la page l'affiche en toast, le rapport est écrit par la rédaction automatique"

patterns-established:
  - "Toute nouvelle fonction d'IA passe par createIA (garde, appelle, repond) : la garde statique de tests/apiia.test.mjs échoue sinon"

requirements-completed: [SECU2-01]

coverage:
  - id: D1
    description: "Les quatre fonctions d'IA (dictée, débrief, arbitre, lecture d'IC) envoient store:false à chaque appel, posé en un seul endroit après les paramètres, impossible à écraser ; aucun appel direct au client OpenAI hors d'api/_ia.js"
    requirement: SECU2-01
    verification:
      - kind: unit
        ref: "tests/apiia.test.mjs#voice / debrief / rules / ic : store:false dans l'argument du seul appel d'OpenAI ; createIA.appelle ; garde statique"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs arbitre ia (store === false vu par le client simulé)"
        status: pass
    human_judgment: false
  - id: D2
    description: "30 appels d'IA par équipier et par jour de Paris, toutes fonctions confondues, comptés sous le prénom du middleware seul ; le 31e reçoit 429 quota_equipier sans appel à OpenAI ni écriture"
    requirement: SECU2-01
    verification:
      - kind: unit
        ref: "tests/apiia.test.mjs#compte : 30 acceptés / 31e refusé ; quota commun ; prénom du corps ou de l'adresse ignoré ; jourParis ; parité prefix/membre avec api/archive.js"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs arbitre (page des règles : verdict, compteur à 1, message du quota au 31e appel)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Compteur illisible (magasin absent, en panne, plus lent que 2 s, conflit perdu deux fois, contenu corrompu) : l'appel passe et un avertissement sans prénom, clé ni texte est écrit"
    requirement: SECU2-01
    verification:
      - kind: unit
        ref: "tests/apiia.test.mjs#panne de lecture / écriture perdue deux fois / compteur illisible / lecture retenue / ni Blob ni jeton"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs arbitre (partie c : compteur en panne, l'arbitre répond)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plafond de dépense OpenAI atteint : 429 budget_ia en français ; autre 429 : ia_occupee ; 401/403 d'OpenAI : 502 ; message borné à 300 caractères"
    requirement: SECU2-01
    verification:
      - kind: unit
        ref: "tests/apiia.test.mjs#erreurIA (cinq codes de budget, 401/403, 500, borne) ; tests/apiic.test.mjs#erreurs"
        status: pass
    human_judgment: true
    rationale: "Le code réel renvoyé par OpenAI quand le plafond est atteint (project_spend_limit_exceeded) vient de la documentation, pas d'un essai ; le geste du plafond et sa vérification sont dans 05-03"
  - id: D5
    description: "Les quatre écrans montrent le message du serveur (dictée : toast puis analyse locale ; débrief : toast puis rédaction automatique ; arbitre : bulle ; IC : message sous « Lire avec l'IA » avec relecture manuelle validable)"
    requirement: SECU2-01
    verification:
      - kind: e2e
        ref: "node tools/regate-e2e.mjs ia-erreurs (quota du jour, budget du mois) ; arbitre"
        status: pass
      - kind: unit
        ref: "tests/icread.test.mjs#iaErrorMessage 429 ; narrative : 429 → iaNote"
        status: pass
    human_judgment: true
    rationale: "Le toast de la dictée (js/app.js understand) et celui du débrief (runDebrief) ne se jouent pas en Chromium sans micro ni trace réelle : à voir une fois sur l'aperçu avec un compteur à 30"

duration: 15min
completed: 2026-10-20
status: complete
---

# Phase 5 Plan 02 : IA bornée côté serveur et messages clairs Summary

**`api/_ia.js` impose `store: false` aux quatre fonctions d'IA, compte 30 appels par équipier et par jour de Paris dans le Blob privé (ouvert en panne), traduit le plafond OpenAI en « Budget d'IA du mois atteint », et les quatre écrans affichent ces messages en gardant leur repli sans IA.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-20T09:19:00Z (approximatif : l'heure de départ n'a pas été relevée, le premier commit est de 09:23:43Z)
- **Completed:** 2026-10-20T09:35:00Z
- **Tasks:** 3 (la première de type tracer, la deuxième en TDD)
- **Files modified:** 15 (dont `sw.js` et `js/version.js`, générés par `npm run stamp`)

## Accomplissements

- `api/_ia.js` : `createIA({ openai, blob, now, delai })` rend `garde` (403 sans prénom, 429 au-delà de 30), `appelle` (`store: false` en dernier) et `repond` (erreurs en français). Compteur `<prod|preview>/quota/<AAAA-MM-JJ>/<prénom>.json` : une lecture sans cache et une écriture `ifMatch`, jamais `list` ni `head`, une relecture sur conflit, chaque opération abandonnée à 2 s.
- Les quatre fonctions (`rules`, `voice`, `debrief`, `ic`) prennent la forme `createHandler({ openai, blob, now })`, avec l'ordre 405 → 503 → 400 → garde → appel → erreurs. Une garde statique interdit tout appel direct au client OpenAI hors d'`api/_ia.js` : une cinquième fonction qui l'oublierait ferait échouer les tests.
- Quota partagé : 10 dictées + 10 débriefs + 10 questions épuisent les 30 appels, la lecture d'IC suivante reçoit 429 `quota_equipier`, un autre équipier passe.
- Erreurs : cinq codes de budget → 429 `budget_ia` ; autre 429 → `ia_occupee` ; 401/403 d'OpenAI → 502 (la page lit 401 comme « rouvrez l'app avec votre code ») ; tout message borné à 300 caractères.
- Écrans : arbitre (bulle de `regles.html`), lecture d'IC (`iaMessage` → `iaErrorMessage`, relecture manuelle validable), dictée (toast puis analyse locale) et débrief (`iaNote` → toast, rédaction automatique).
- Scénario Playwright `arbitre` : page des règles → vraie fonction `api/rules.js` → faux Blob → client simulé ; trois temps (verdict + `store: false` + compteur à 1 ; 31e appel refusé avec le message exact, sans appel ni écriture ; compteur en panne, l'arbitre répond).
- La référence SNPM n'a pas bougé : `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort en 0.

## Task Commits

1. **Task 1 : l'arbitre borné de bout en bout (tracer)** : `cbc9ec8` (feat, 23 tests de `tests/apiia.test.mjs`, scénario `arbitre`)
2. **Task 2 : dictée, débrief et lecture d'IC sur la même aide (TDD)**
   - `37d64ec` (test, RED)
   - `1e37c2a` (feat, GREEN)
3. **Task 3 : écrans de la dictée, du débrief et des IC** : `4f9810c` (feat)

**Plan metadata:** commits `docs(05-02)` suivant ce fichier.

_Tracer : après la tâche 1, `<verify>` a été rejoué de bout en bout (tests aussi avec `VERCEL_ENV=production`, `npm run check`, garde SNPM, scénarios `arbitre` et `ia`) puis la tâche 2 a commencé : « Tracer verified end-to-end — expanding »._

## TDD (tâche 2)

- **RED :** `37d64ec`. `node --test --test-reporter=tap` sur `tests/apiia.test.mjs` et `tests/apiic.test.mjs` : 10 tests en échec sur 51, tous sur l'assertion prévue (`createHandler` absent de `voice.js`, `debrief.js` et `ic.js` ; appel direct du client dans `debrief.js` ; 429 d'`ic.js` sans `ia_occupee`). Cible : « garde statique : aucun fichier de api/ n'appelle le client OpenAI sans passer par api/_ia.js ». `gsd-tools check tdd-red-evidence` : `RED_EVIDENCE_OK` (`target_test_failed`). Évaluation sémantique : la cible s'exécute et échoue sur « debrief.js : appel direct du client OpenAI », sans erreur de chargement ni de syntaxe.
- **GREEN :** `1e37c2a`. 94 tests verts sur `apiia`, `apiic`, `access`, `apiarchive`, puis 532 sur la suite complète.
- **REFACTOR :** aucun.
- La tâche 1 (tracer) n'a pas eu de commit RED séparé : un test qui importe un module absent est un `INVALID_RED` (erreur de chargement), donc tests et module sont dans le même commit.

## Files Created/Modified

- `api/_ia.js` : IA bornée commune (nouveau)
- `tests/apiia.test.mjs` : 40 tests (nouveau)
- `api/rules.js`, `api/voice.js`, `api/debrief.js`, `api/ic.js` : `createHandler` sur l'aide commune, client direct supprimé
- `regles.html` : la bulle montre le message du serveur sur 429
- `js/app.js` : toast de la dictée, `iaMessage` dans `readWithAI`, toast de `nar.iaNote` dans `runDebrief`
- `js/debrief.js` : `iaNote` dans le repli de `narrative` sur 429
- `js/icread.js` : `iaErrorMessage({ status, code, message, timedOut })`
- `tests/apiic.test.mjs` : `post` pose `x-rt-membre` par défaut, le 429 attend `ia_occupee` et un message
- `tests/icread.test.mjs` : cas 429 de `iaErrorMessage` et test de `narrative`
- `tools/regate-e2e.mjs` : scénario `arbitre`, `serviaIA` avec prénom, cas 429 dans `ia-erreurs`, `store` vérifié dans `ia`
- `sw.js`, `js/version.js` : générés par `npm run stamp`

## Decisions Made

- On compte avant l'appel : un appel raté coûte une unité sur 30, mais une panne d'OpenAI ne permet pas de contourner le quota.
- `createHandler` accepte aussi `delai` (le plan listait `{ openai, blob, now }`) : sans lui, tester la lecture retenue obligerait à attendre 2 s.
- Un 429 d'OpenAI dont le code n'est pas un code de budget connu devient `ia_occupee` : si OpenAI ajoute un code, rien ne casse.
- Le débrief ne change pas de signature : `narrative` ajoute `iaNote` à son objet de repli, la page décide de l'afficher.

## Deviations from Plan

None - plan executed exactly as written.

Deux ajouts mineurs hors lettre du plan, sans effet sur le comportement attendu : l'option `delai` de `createHandler` (voir ci-dessus) et un test de `narrative` dans `tests/icread.test.mjs` (le plan ne prévoyait pas de test unitaire pour `iaNote`).

**Total deviations:** 0 auto-fixed. **Impact on plan:** aucun.

## Issues Encountered

- Les scénarios Playwright et les nouveaux tests ont passé du premier coup, ce qui ne prouve rien seul. Contrôles négatifs faits puis annulés : sans `store: false` ou avec `store: false` placé avant les paramètres, `apiia` (test 10) et `arbitre` échouent ; avec la bulle qui ignore le message du 429, `arbitre` échoue (`obtenu "L'arbitre n'a pas pu répondre…"`) ; sans la branche 429 de `iaErrorMessage`, `ia-erreurs` échoue (délai de 20 s sur le texte attendu). Les fichiers d'origine ont été rétablis.
- Le plan estimait 120 000 jetons ; le diff réel (hors fichiers générés) est de l'ordre de 14 075 jetons (56 298 caractères / 4). L'estimation était très pessimiste.

## Vérifications brutes (tâche 3)

- `npm run check` : `# tests 534`, `# pass 534`, `# fail 0`. `VERCEL_ENV=production npm test` : `# tests 534`, `# pass 534`, `# fail 0`.
- `node --test … tests/icread.test.mjs tests/apiia.test.mjs tests/diag.test.mjs` : 95 tests, 95 verts. `tests/apiia.test.mjs` compte 40 tests (23 de la tâche 1, 17 de la tâche 2).
- Garde SNPM : `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort en 0.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs ia ia-erreurs arbitre reprise gpx debrief-tardif` (sortie 0) :
  ```
  OK ia
  OK ia-erreurs
  OK arbitre
  OK reprise
  OK gpx
  OK debrief-tardif
  Bilan : 6/6 scénario(s) OK
  ```
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` (sortie 0) : médiane de l'interface utile 438 ms (maximum 513 ms), seuil 2000 ms ; « RÉSULTAT : OK — médiane de l'interface utile 438 ms < 2000 ms (hors réseau, CPU ×4) ».
- Critères d'acceptation : `createIA(` une fois dans chacun des quatre fichiers d'`api/` ; `grep -c iaMessage js/app.js` = 2 ; `grep -c iaNote js/debrief.js` = 3 ; `grep -c iaNote js/app.js` = 1.

## Contrôle humain restant

- Sur l'aperçu, avec une clé OpenAI réelle : poser une question à l'arbitre (`regles.html`) et vérifier que la réponse arrive ; la 31e du jour doit afficher « Limite d'IA du jour atteinte — reprise demain ».
- La dictée (toast puis analyse locale) et le débrief (toast puis rédaction automatique) ne se jouent pas en Chromium sans micro ni trace réelle : à voir une fois sur l'aperçu quand le compteur de l'équipier est à 30.
- Après la régate : relever l'usage du Blob (2 000 opérations avancées par mois, partagées avec l'archive) ; le compteur ajoute une écriture par appel d'IA (T-05-08). Le plafond de dépense OpenAI et sa vérification sont dans 05-03.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau point d'entrée réseau : les quatre routes existaient déjà derrière le code d'accès ; `api/_ia.js` n'est pas une route. Seule nouvelle surface : des blobs `quota/` dans le magasin privé existant, écrits sous un chemin réduit à `a-z0-9-` (T-05-10). Mitigations du plan en place : T-05-06 (garde avant tout appel, quota commun testé), T-05-07 (prénom lu dans `x-rt-membre` seul, 403 sans prénom, parité avec `api/archive.js` testée), T-05-08 (une lecture + une écriture par appel, aucune écriture au-delà du quota, jamais `list` ni `head`), T-05-09 (`store: false` testé sur les quatre, avertissement sans prénom ni clé ni texte), T-05-10 (chemin testé sans `/`, `.` ni `%`), T-05-11 (`textContent` ou `escHTML`, messages bornés à 200-300 caractères), T-05-12 (compteur ouvert : exception, plus de 2 s ou sans jeton).

## Self-Check: PASSED

Fichiers présents : `api/_ia.js`, `tests/apiia.test.mjs`. Commits retrouvés dans l'historique : `cbc9ec8`, `37d64ec`, `1e37c2a`, `4f9810c`. Garde SNPM en 0. Séquence TDD : `test(05-02)` `37d64ec` précède `feat(05-02)` `1e37c2a`.
