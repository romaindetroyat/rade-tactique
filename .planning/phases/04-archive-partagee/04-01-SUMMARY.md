---
phase: 04-archive-partagee
plan: 01
subsystem: api
tags: [vercel-blob, fusion, lww, middleware, durable-sync, privacy]

requires:
  - phase: 03-ouvrir-une-regate
    provides: modèle de régate (races, marks, courses, traces, frozen), auteur par GET /api/membre, tests/access.test.mjs
provides:
  - js/archmerge.js : fusion par éléments « dernier écrit gagne » (pierres tombales, historique), marquage des modifications locales (stamp, stampState, markDirty), forme partagée d'une régate
  - api/archive.js : GET|PUT /api/archive?k=light sur Vercel Blob privé, auteur posé par le serveur, écriture conditionnelle avec 4 essais
  - middleware.js : en-tête x-rt-membre (prénom encodé) pour les seules adresses /api/
  - tests/helpers/fakeblob.mjs et tests/helpers/codesimule.mjs : faux Blob au contrat du SDK 2.8.0 et faux code d'accès, partagés par les tests et par l'outil de bout en bout
  - "@vercel/blob 2.8.0 épinglé"
affects: [04-02, 04-03, 04-04, 04-05]

actuals:
  tokens: 27100
  tasks: 3
  commits: 3
plan_head_before: 18fc7618609f123b3bf05c534c15f5bcb1787e2c
plan_head_after: 82ac1caa281d670a8ba6bb2de04bf3256559f487
commits: 3

tech-stack:
  added: ["@vercel/blob 2.8.0 (fonction seulement, import dynamique)"]
  patterns:
    - "Un document léger partagé par environnement, fusionné par le serveur : lire sans cache, fusionner, écrire avec ifMatch, 4 essais"
    - "Module pur partagé page et serveur (js/archmerge.js), client Blob injectable (createHandler({ blob, now })) comme createHandler({ openai }) d'api/ic.js"
    - "Auteur : en-tête posé par le middleware après vérification du code, fonction fermée par défaut (403)"

key-files:
  created:
    - js/archmerge.js
    - api/archive.js
    - tests/helpers/fakeblob.mjs
    - tests/helpers/codesimule.mjs
    - tests/archmerge.test.mjs
    - tests/apiarchive.test.mjs
  modified:
    - middleware.js
    - vercel.json
    - tests/access.test.mjs
    - package.json
    - package-lock.json
    - sw.js
    - js/version.js

key-decisions:
  - "Le cookie du code d'accès n'est pas transmis aux fonctions /api/ : next({ request: { headers } }) remplace tous les en-têtes, et le copier aurait mis le code dans x-middleware-request-cookie"
  - "Une adresse /api/ est reconnue après décodage et passage en minuscules (/API/archive, /%61pi/archive) : l'en-tête du navigateur ne peut jamais arriver à une fonction par une écriture inhabituelle"
  - "La corbeille (trash/) est écrite AVANT que la régate quitte le document ; si la copie échoue, la suppression n'a pas lieu"
  - "Une ancienne version déjà connue (présente dans hist ou dans l'historique d'un recalage) renvoyée par un téléphone en retard garde son auteur d'origine et ne modifie pas le document"
  - "L'historique (hist, h) est un journal au mieux : l'état visible est une réunion exacte, l'historique peut manquer une version qui reprend le contenu d'une plus ancienne"

patterns-established:
  - "Tests d'algèbre de fusion : scénarios à graine, trois téléphones, serveur, renvois d'états anciens, jugés contre un oracle d'horloge"
  - "Gardes statiques sur source sans commentaires (accès privé seul, aucune énumération, aucun nom de jeton dans js/)"

requirements-completed: [ARCH-01]

coverage:
  - id: D1
    description: "Fusion par éléments de js/archmerge.js : ajouts des deux côtés gardés, plus récent gagnant avec l'autre dans l'historique, suppressions définitives, gel tardif, rapport le plus récent, recalages de bouées"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archmerge.test.mjs#convergence : 2 000 scénarios aléatoires à trois téléphones"
        status: pass
      - kind: unit
        ref: "tests/archmerge.test.mjs (19 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fonction api/archive.js sur Blob privé : auteur du serveur, écriture conditionnelle, aucune écriture inutile, bornes, corbeille, 429"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/apiarchive.test.mjs (24 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "L'archive est fermée sans code sous toutes ses adresses et méthodes ; avec un code, x-rt-membre vient du middleware"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/access.test.mjs (6 nouveaux tests) et tests/apiarchive.test.mjs#bout à bout serveur"
        status: pass
    human_judgment: false
  - id: D4
    description: "@vercel/blob 2.8.0 épinglé : une entrée, intégrité attendue, aucun script d'installation"
    verification:
      - kind: other
        ref: "node -e (package-lock.json) de la tâche 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sur l'aperçu Vercel réel : l'en-tête du middleware arrive bien à la fonction (jamais 403 membre_inconnu) et js/archmerge.js est embarqué (jamais 500)"
    verification: []
    human_judgment: true
    rationale: "Transmission réelle de l'en-tête et empaquetage de la fonction par Vercel, inaccessibles aux tests (hypothèses A3 et A4 de la recherche)"

duration: 19min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 01 : socle serveur de l'archive partagée — Summary

**Fonction `api/archive.js` sur Vercel Blob privé qui fusionne sans perte les régates de trois équipiers (dernier écrit gagne, pierres tombales, historique), auteur posé par le middleware et jamais par le navigateur, prouvée par 2 000 scénarios aléatoires à trois téléphones et par un test d'accès qui couvre toutes les adresses de l'archive.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-20T04:06:12Z
- **Completed:** 2026-10-20T04:25:00Z
- **Tasks:** 3 (1 tracer, 2 auto/tdd)
- **Files modified:** 13 (6 créés, 7 modifiés)

## Accomplishments

- Le tracer passe de bout en bout : Teiva envoie une régate à la vraie fonction (faux Blob au contrat du SDK 2.8.0), Thibaud la relit signée « Teiva », un `rev` à jour ne renvoie rien, Romain et Thibaud qui ajoutent chacun une manche gardent les deux, renvoyer le même document n'écrit rien.
- Critère 3 de la phase : sans code, `/api/archive` sous toutes ses formes (`?k=…`, barre finale, `.js`, majuscules, `%61pi`, `..`, quatre méthodes) répond 401 et rien n'est transmis ; avec un code, `x-rt-membre` est le prénom de la table et remplace celui du navigateur, sans code ni empreinte dans les en-têtes ; aucune empreinte de la table n'existe hors de `middleware.js` (test sur tout le dépôt, noms de fichiers seulement).
- Critère 2 côté serveur : les règles de D-04 sont prouvées une à une (19 tests) et par 2 000 scénarios à graine contre un oracle d'horloge (ajouts, modifications, suppressions de manches et de régates, gels, recalages, traces et rapports, renvois d'états anciens). Contrôle négatif : 5 mutations du code de fusion (suppression ignorée, gel tardif, union remplacée par « le plus récent seulement », rapport inversé, arbitrage des pierres tombales) font toutes échouer la suite, ainsi que 5 mutations de la fonction (sans `ifMatch`, `by` du corps, accès public, cache, préfixe fixe).
- `@vercel/blob` 2.8.0 épinglé. Contrôle de verrou : `package-lock.json` ne contient qu'une entrée `node_modules/@vercel/blob`, version 2.8.0, intégrité `sha512-Nu+HWKpk…tqylCQ==` conforme, pas de `hasInstallScript`, aucun paquet du lot (8 ajoutés) ne porte de script d'installation, `npm install` : 0 vulnérabilité ; le SDK expose `get`, `put`, `head`, `BlobError`, `BlobPreconditionFailedError`, `BlobNotFoundError`, `BlobServiceRateLimited`.
- Tests : 333 → 382 (`npm run check` vert, 7,1 s). Nouveaux : `archmerge` 19, `apiarchive` 24, `access` +6. Convergence des 2 000 scénarios : environ 3,2 s (limite 5 s).

## Task Commits

1. **Task 1 (tracer) : fonction api/archive.js, fusion js/archmerge.js, faux Blob privé** — `aaa9cbc` (feat)
2. **Task 2 : archive fermée sans code, auteur transmis par le middleware** — `a060cdd` (feat)
3. **Task 3 : fusion prouvée (2 000 scénarios) et contrat complet de la fonction** — `82ac1ca` (test)

**Plan metadata:** commit `docs(04-01)` qui suit ce fichier.

_Tâche 2 (TDD) : le rouge a été constaté (3 tests en échec sur 12) avant d'écrire le middleware et vercel.json, mais tests et code sont dans un seul commit, comme le plan l'indique pour une tâche._

## Files Created/Modified

- `js/archmerge.js` — fusion LWW par éléments, pierres tombales, historique, recalages, marquage (`stamp`, `stampState`, `markDirty`), `slug`, `toShared`/`fromShared` ; module pur importé par la page et par la fonction.
- `api/archive.js` — GET|PUT `?k=light`, `cleanDoc`, `attribute`, `mutateLight`, `createHandler({ blob, now })`.
- `middleware.js` — `x-rt-membre` pour `/api/` ; `vercel.json` — `api/archive.js` (30 s, `includeFiles` de `js/archmerge.js`).
- `tests/helpers/fakeblob.mjs` — faux Blob (accès privé exigé, énumération refusée, `ifMatch`, `ifNoneMatch`, compteurs, porte de concurrence, pannes programmées) et `invoke` ; `tests/helpers/codesimule.mjs` — faux code d'accès (empreinte lue à l'exécution, jamais écrite).
- `tests/archmerge.test.mjs`, `tests/apiarchive.test.mjs`, `tests/access.test.mjs` — voir ci-dessus.
- `package.json`, `package-lock.json`, `sw.js` (bloc généré), `js/version.js` (généré) — dépendance et SHELL (`js/archmerge.js` précaché).

## Decisions Made

Voir `key-decisions`. À noter : `GET ?k=light` rend `env` (`prod` ou `preview`) ; une création sans document stocké n'écrit rien tant que le document envoyé est vide ; `slug` est exporté par `js/archmerge.js` mais n'est pas encore importé par `api/archive.js` (les routes de jour arrivent au plan 04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pierres tombales à égalité de date : fusion non commutative**
- **Found during:** Task 3 (scénario 268 de la convergence)
- **Issue:** `mergeTomb` ne départageait pas deux suppressions de même date par des auteurs différents ; le résultat dépendait de l'ordre de la fusion (le prototype de la recherche avait ce défaut).
- **Fix:** à égalité de date, celle qui a un auteur, puis l'auteur le plus grand.
- **Files modified:** `js/archmerge.js` — **Commit:** `82ac1ca`

**2. [Rule 1 - Bug] Un identifiant absent devenait la chaîne « undefined »**
- **Found during:** Task 3 (test des entrées invalides)
- **Issue:** `ID.test(String(e.id))` acceptait une manche sans identifiant (« undefined » passe l'expression régulière).
- **Fix:** `validId` exige une chaîne ou un nombre fini ; l'identifiant d'une régate doit être égal à sa clé.
- **Files modified:** `api/archive.js` — **Commit:** `82ac1ca`

**3. [Rule 2 - Missing critical] Validation des champs que le prototype laissait passer**
- **Found during:** Task 3
- **Issue:** `tomb` de régate, `hist`, entrées de gel et recalages de bouées n'étaient pas nettoyés (une valeur `null` dans `tomb` donnait un 502 au lieu d'un 400/200 propre ; des champs inconnus ou volumineux étaient stockés ; un rapport de trace daté du futur gagnait pour toujours).
- **Fix:** `cleanDoc` filtre ces champs ; seuls `lat`, `lon`, `src`, `t`, `del`, `h` sont gardés pour un recalage ; `t` d'une pierre tombale, d'un recalage et d'un rapport au-delà de maintenant + 5 min est ramené à l'heure du serveur (le prototype le bornait à maintenant + 5 min).
- **Files modified:** `api/archive.js` — **Commit:** `82ac1ca`

**4. [Rule 2 - Missing critical] Perte possible de la régate supprimée**
- **Found during:** Task 3
- **Issue:** le prototype écrivait la copie `trash/` après le document et ignorait son échec (régate supprimée sans copie). La création concurrente prenait aussi un 429 pour une course perdue.
- **Fix:** copie écrite avant le document, échec propagé (la suppression n'a pas lieu) ; un 429 n'est jamais rejoué comme une course perdue ; après 4 essais, une erreur du magasin autre qu'une précondition ressort telle quelle au lieu d'un 409 trompeur.
- **Files modified:** `api/archive.js` — **Commit:** `82ac1ca`

**5. [Rule 1 - Bug] Un état périmé renvoyé par un autre équipier réécrivait l'auteur d'une ancienne version**
- **Found during:** Task 3 (test à trois équipiers)
- **Issue:** `attribute` signait de l'envoyeur toute version différente de celle stockée, même une ancienne version déjà connue ; le document changeait à chaque renvoi (écriture inutile) et l'historique perdait ses vrais auteurs (aussi pour l'historique des recalages).
- **Fix:** une version présente dans `hist` (ou dans `h` du recalage) garde son auteur d'origine.
- **Files modified:** `api/archive.js` — **Commit:** `82ac1ca`

**6. [Rule 2 - Missing critical] Le cookie du code d'accès ne doit pas suivre vers les fonctions**
- **Found during:** Task 2
- **Issue:** copier tous les en-têtes dans `next({ request: { headers } })` met le cookie `rt_acces` (donc le code) dans `x-middleware-request-cookie`, ce qui contredit « aucun en-tête de la réponse ne contient le code ». Aucune fonction ne lit le cookie (le middleware répond seul à `/api/membre`).
- **Fix:** le cookie est retiré des en-têtes transmis ; les autres en-têtes (type du corps, etc.) sont conservés.
- **Files modified:** `middleware.js` — **Commit:** `a060cdd`

**7. [Rule 2 - Missing critical] Reconnaissance de /api/ plus large que `startsWith('/api/')`**
- **Found during:** Task 2
- **Issue:** `/API/archive` ou `/%61pi/archive` n'étaient pas reconnus comme `/api/` et auraient pu transmettre l'en-tête `x-rt-membre` du navigateur à une fonction (usurpation de l'auteur).
- **Fix:** `versApi` décode, passe en minuscules et traite toute erreur de décodage comme `/api/` ; `/api-docs.html` reste inchangé (test).
- **Files modified:** `middleware.js` — **Commit:** `a060cdd`

**8. [Rule 1 - Performance] Forme canonique trop coûteuse pour la convergence**
- **Found during:** Task 3
- **Issue:** `canon` (objets intermédiaires) et le tri de l'historique par `canon` à chaque comparaison faisaient dépasser 5 s aux 2 000 scénarios (8,8 s).
- **Fix:** `canon` écrite directement en texte, historique dédoublonné sur une clé calculée une fois, un seul calcul de contenu canonique par comparaison d'éléments. Conséquence : pour des objets à clés entières (recalages `1`, `2`, `10`), l'ordre canonique est celui des chaînes et non l'ordre numérique ; `canon` ne sert qu'à comparer en mémoire et n'est jamais stockée.
- **Files modified:** `js/archmerge.js` — **Commit:** `82ac1ca`

**9. [Hors plan] Fichier d'aide ajouté**
- `tests/helpers/codesimule.mjs` (faux code d'accès partagé par `access` et `apiarchive`) n'était pas dans `files_modified`. Aucune empreinte ni aucun code n'y est écrit.
- `slug` n'est pas importé par `api/archive.js` (le plan le listait dans l'import) : aucune route de ce plan ne s'en sert, un import inutilisé aurait été du bruit.

**Total deviations:** 8 auto-corrigées (4 bugs, 4 manques critiques) + 1 écart de périmètre trivial. **Impact :** aucune règle de D-04 changée ; renforcement de la sécurité (T-04-02, T-04-04, T-04-06) et de la non-perte (T-04-05, Pitfall 18).

## Limites connues

- **Historique au mieux.** `hist` et `h` ne sont pas une réunion exacte : une version écrasée n'y entre que si elle a été comparée à la gagnante. Un contenu qui revient à celui d'une version plus ancienne (P, puis Q, puis P) peut laisser une entrée de moins selon l'ordre des échanges. L'état visible (fiche, éléments, pierres tombales, gels, recalages) converge exactement (2 000 scénarios) ; l'historique converge après quelques échanges (trois tours maximum en test) et reste commutatif et idempotent.
- **Auteur = étiquette de confiance** entre trois équipiers, pas une signature (SECU2-02 reste différé).

## Authentication Gates

Aucune.

## Contrôle humain restant (hors de portée des tests)

Tâche 2, `<human-check>` : sur l'aperçu Vercel (après le plan 04-03), ouvrir `/api/archive?k=light` sans code (attendu : 401 `{"error":"acces"}`) puis depuis l'app avec un code (attendu : ni 403 `membre_inconnu`, ni 500). Consigné dans `.planning/WINDOWS.md` (entrée 1, `unrun-verify`). Le magasin Blob privé « rade-tactique-blob » existe déjà sur Vercel ; rien n'a été poussé ni déployé.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau périmètre hors du `<threat_model>` du plan : `/api/archive` (T-04-01 à T-04-09) y figure. Le retrait du cookie des en-têtes transmis aux fonctions réduit l'exposition du code d'accès.

## Issues Encountered

Aucun blocage. Le prototype de la recherche avait trois défauts que le plan ne prévoyait pas (pierres tombales non commutatives, identifiant absent accepté, copie `trash/` après coup), tous corrigés ci-dessus.

## Next Phase Readiness

Prêt pour 04-02 (`js/archsync.js` et câblage de la page) : `stampState`, `markDirty`, `toShared`/`fromShared` et `slug` sont exportés par `js/archmerge.js`, `createFakeBlob`/`invoke` servent aussi à `tools/regate-e2e.mjs`, `GET|PUT ?k=light` rend `{ rev, doc, changed, env }` ou `{ unchanged, rev, env }`, `503 no_blob` sans magasin configuré.

## Self-Check: PASSED

- Fichiers : `js/archmerge.js`, `api/archive.js`, `tests/helpers/fakeblob.mjs`, `tests/helpers/codesimule.mjs`, `tests/archmerge.test.mjs`, `tests/apiarchive.test.mjs` présents ; `middleware.js` contient `x-rt-membre` (2 occurrences) ; `vercel.json` déclare `api/archive.js`.
- Commits `aaa9cbc`, `a060cdd`, `82ac1ca` : ancêtres de HEAD.
- `npm run check` : 382 tests verts, SHELL à jour ; `git diff --quiet f80c365 -- js/courses.js tests/reference/` : inchangé.
