---
phase: 04-archive-partagee
plan: 03
subsystem: sync
tags: [archive, recalages, bouees, historique, interrupteur, guide, release-v30, apercu, chromium]

requires:
  - phase: 04-archive-partagee
    provides: "plan 01 : js/archmerge.js (mergeMarks, markDirty, MAX_HIST), api/archive.js ; plan 02 : js/archsync.js (runSync, getMarks/setMarks, syncStatus), SYNC, ligne #rgSync"
provides:
  - "js/marks.js : sharedMarks (document envoyé, remises à l'origine comprises) et remoteMarkChanges (put / del / ack à appliquer depuis la fusion), purs, RADE exporté"
  - "js/app.js : recalMark / resetMark marquent « ~marks » ; applyRemoteMarks applique la fusion hors course et dit qui a recalé la bouée ; interrupteur « Désactiver / Réactiver la synchronisation » ; bulle d'aide de l'indicateur"
  - "js/regview.js : historySectionHTML (section « Historique » repliée de la fiche)"
  - "guide.html, js/help.js : carte « Archive partagée », fin des mentions « reste sur ce téléphone » pour ce qui est partagé"
  - "release.json v30 publiée sur l'aperçu apercu-phase-04 (main intacte)"
affects: [04-04, 04-05]

actuals:
  tokens: 18600
  tasks: 3
  commits: 3
plan_head_before: 7b1c10f51842bda71fc8244991c3bf597023b059
plan_head_after: 0ec6fa70a5852cb394262251c043f1feef280d87
commits: 3

tech-stack:
  added: []
  patterns:
    - "Le document des recalages se calcule à l'envoi depuis rade.marks.v1 et SYNC.marksDel : aucune copie intermédiaire (SYNC.marksDoc disparaît)"
    - "Une remise à l'origine est une valeur datée { del, t } envoyée tant que la fusion ne l'a pas couverte (ack), jamais une absence"
    - "Défense en profondeur de l'interrupteur : syncNow, canApply et canSync (runSync) refusent chacun l'échange quand SYNC.off"

key-files:
  created: []
  modified:
    - js/marks.js
    - js/app.js
    - js/regview.js
    - js/help.js
    - guide.html
    - tests/marks.test.mjs
    - tests/archsync.test.mjs
    - tests/regates.test.mjs
    - tools/regate-e2e.mjs
    - release.json
    - sw.js
    - js/version.js

key-decisions:
  - "remoteMarkChanges borne aussi les positions à la rade (RADE, comme parseLatLon) et ramène la source à trace | saisie : une valeur venue d'un autre téléphone n'est jamais appliquée telle quelle (T-04-18)"
  - "Un recalage reçu n'est jamais renvoyé : setMarks ne marque pas « ~marks » ; seule une action de l'équipier (recalMark, resetMark) le fait"
  - "Les messages de plusieurs bouées reçues sont réunis en un seul toast (un seul élément #toast, les suivants effaceraient les précédents)"
  - "Désactivée avant tout chargement, la synchronisation ne charge même pas js/archsync.js ; l'indicateur affiche alors « Synchronisation désactivée » depuis app.js"

requirements-completed: [ARCH-01]

coverage:
  - id: D1
    description: "Une bouée recalée (saisie ou trace) ou remise à l'origine sur un téléphone l'est aussi sur les autres après synchronisation, hors course, avec le nom de l'auteur ; le plus récent gagne, l'écrasé reste dans l'historique de la bouée"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archsync.test.mjs (D-05 : tracer à trois téléphones, deux recalages concurrents dans les deux ordres, hors réseau, remise à l'origine plus ancienne, course) et tests/marks.test.mjs (4 tests purs)"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs archive-bouees (deux contextes Chromium : toast « recalée par Teiva (saisie du 07/11) », position d'origine rétablie, recalage reçu après le chrono seulement)"
        status: pass
    human_judgment: false
  - id: D2
    description: "La fiche montre, repliée, l'historique des valeurs écrasées ; rien de ce qui vient d'un autre téléphone n'est inséré sans échappement"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs (historySectionHTML : ordre, repli, injection linkedom, bornes 120 caractères / 30 lignes, entrées mal formées)"
        status: pass
      - kind: e2e
        ref: "archive-bouees : deux équipiers changent la même manche, « Historique (1) » replié chez les deux"
        status: pass
    human_judgment: false
  - id: D3
    description: "Indicateur discret complet et interrupteur « Désactiver la synchronisation » (deux touches) / « Réactiver » (un geste)"
    requirement: ARCH-01
    verification:
      - kind: e2e
        ref: "archive-bouees : une touche ne coupe rien, deux touches coupent (aucune requête même après « online »), le choix survit au rechargement de la méta, la saisie faite pendant la coupure part à la réactivation"
        status: pass
      - kind: unit
        ref: "tests/archsync.test.mjs (canSync off, syncStatus) et tests/regates.test.mjs (câblage de l'interrupteur)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Guide et aide disent ce qui est partagé, quand, jamais pendant une course, l'indicateur et l'historique"
    requirement: ARCH-01
    verification:
      - kind: other
        ref: "grep guide.html : « Archive partagée », « Historique », « Désactiver la synchronisation », « jamais pendant » ; plus aucune mention « reste sur ce téléphone » pour les régates, les bouées confirmées ni les recalages"
        status: pass
    human_judgment: true
    rationale: "Relecture des textes par Romain (formulation, ton)"
  - id: D5
    description: "v30 publiée sur l'aperçu après vérifications faites pour de bon ; main inchangée"
    verification:
      - kind: other
        ref: "npm run check (430 tests), PW_REQUIRED=1 regate-e2e 15/15, measure-boot (médiane 383 ms), audio-clock-check (4,4 ms), RT_STRICT=1 npm run gate, déploiement Vercel de 0ec6fa7 « success », git ls-remote main = 7fb6401 avant et après"
        status: pass
    human_judgment: false
  - id: D6
    description: "Recette à deux téléphones sur l'aperçu avec le vrai magasin Blob (points 1 à 9 et 11), quotas, 401 sans code"
    verification: []
    human_judgment: true
    rationale: "Vrai magasin Vercel Blob, middleware sur Vercel et réseau d'iPhone inaccessibles aux tests (consigné dans .planning/WINDOWS.md, entrée 3)"

duration: 21min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 03 : recalages partagés, historique, interrupteur et v30 — Summary

**Les recalages de bouées voyagent avec l'archive (le plus récent gagne, la remise à l'origine se propage, un message dit qui l'a fait), la fiche garde au repli l'historique des valeurs écrasées, un interrupteur coupe l'échange sur un téléphone, le guide et l'aide disent tout cela, et la v30 est en ligne sur l'aperçu `apercu-phase-04` avec `main` intacte (7fb6401).**

## Performance

- **Duration :** 21 min (04:46 à 05:08 UTC)
- **Tasks :** 3 (1 tracer, 2 auto) ; 3 commits de plan
- **Files modified :** 12 (aucun créé)
- **Tests :** 417 → 430 (`npm run check` vert) ; scénarios Chromium : 15/15 dont `archive` et le nouveau `archive-bouees`

## Accomplishments

- **Tracer (D-05)** : `sharedMarks(overrides, marksDel)` et `remoteMarkChanges(fusion, overrides, marksDel)` (purs, dans `js/marks.js`). `recalMark` et `resetMark` marquent `~marks` et planifient l'envoi à 20 s ; `applyRemoteMarks` applique la fusion après une réponse acceptée hors course (garde déjà faite par `runSync`), mémorise comme un recalage local, ne renvoie jamais ce qu'il reçoit, et affiche « Bouée 3 GR1 recalée par Teiva (saisie du 07/11) » ou « … : position d'origine rétablie par Thibaud », seulement si l'auteur n'est pas l'équipier lui-même. `SYNC.marksDoc` (provisoire du plan 02) est supprimé, y compris des méta déjà écrites.
- **Historique (D-04)** : `historySectionHTML(r)` dans la fiche : `<details>` replié « Historique (n) », de la plus récente à la plus ancienne, 30 lignes au plus, valeur bornée à 120 caractères, « (texte des IC non conservé) » pour une valeur nulle, toute entrée mal formée écartée sans lever, tout passe par `escHTML`.
- **Indicateur et interrupteur** : bouton `#rgSyncOff` sous l'indicateur ; « Désactiver la synchronisation » veut deux touches (« Toucher encore pour désactiver »), « Réactiver la synchronisation » un geste (reprise 2 s plus tard) ; « Synchroniser » est grisé tant que c'est coupé ; l'échange en cours est jeté (`canApply`). Bulle ⓘ `SYNC_TIP` (js/help.js) reprenant les textes de l'indicateur.
- **Guide et aide** : carte « Archive partagée » (ce qui est partagé, quand, jamais pendant la course, indicateur, valeur la plus récente et historique, auteur issu de la connexion, Safari et app installée réunis, interrupteur, « Archive non configurée »), cartes « Bouées d'un autre club », « La fiche de régate », « Bouées à confirmer » et question « Mes traces et mes régates sont-elles partagées ? » mises à jour, entrée de l'aide `GUIDE` et infobulle de l'onglet Régates. Les traces complètes, débriefs et rapports sont dits « pas encore partagés, version suivante ».
- **Contrôles négatifs** : `setMarks` neutralisé → `archive-bouees` échoue (toast jamais vu) ; `historySectionHTML` neutralisée, vérifiée (voir « Issues Encountered ») ; les trois gardes de l'interrupteur dans `app.js` retirés ensemble ne font pas échouer le scénario parce que `canSync` (`off`) de `runSync` refuse seul l'échange (défense en profondeur, voulue).

## Task Commits

1. **Task 1 (tracer) : recalages partagés** — `1bfd35c` (feat)
2. **Task 2 : historique, interrupteur, guide et aide** — `2fc753c` (feat)
3. **Task 3 : v30** — `0ec6fa7` (chore) ; poussée sur `origin/apercu-phase-04`

**Plan metadata :** commit `docs(04-03)` qui suit ce fichier.

_TDD : les tests de la tâche 1 ont été écrits avant le code (deux rouges constatés sur des attentes de `isFinite` et de `meta.dirty`, corrigés ensuite) ; ceux de la tâche 2 étaient rouges à l'import (fonction absente). Tests et code d'une tâche sont dans un seul commit._

## Vérifications faites pour de bon (sorties brutes)

`npm run check` : sortie 0

```
stamp à jour
# tests 430
# suites 0
# pass 430
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`PW_REQUIRED=1 node tools/regate-e2e.mjs` : sortie 0 (3 min 08)

```
OK archive
OK archive-bouees
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
Bilan : 15/15 scénario(s) OK
```

`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : sortie 0

```
Première visite en ligne : service worker actif, 65 fichiers en cache.
Serveur arrêté (connexion refusée sur 127.0.0.1:38391) : ouvertures hors réseau, CPU ×4, 5 ouvertures.

ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  422 |                           353 |             4050 |                                      972
        2 |                  346 |                           406 |             4204 |                                      987
        3 |                  406 |                           223 |             4147 |                                      959
        4 |                  383 |                           260 |             4394 |                                      892
        5 |                  370 |                           292 |             4317 |                                     1040
  médiane |                  383 |                           292 |             4204 |                                      972
  maximum |                  422 |                           406 |             4394 |                                     1040
RÉSULTAT : OK — médiane de l’interface utile 383 ms < 2000 ms (hors réseau, CPU ×4)
```

`PW_REQUIRED=1 node tools/audio-clock-check.mjs` : sortie 0

```
Tentative 1/3 — contexte audio : running · 11 début(s) de bip relevé(s) pour 11 attendus · fil principal gelé 2 × 1,3 s
bip 10 s   : −2,2 ms
bip  9 s   : −2,2 ms
bip  8 s   : −2,2 ms
bip  7 s   : −2,2 ms
bip  6 s   : −2,2 ms
bip  5 s   : −2,2 ms
bip  4 s   : −2,2 ms
bip  3 s   : −2,9 ms
bip  2 s   : −4,4 ms
bip  1 s   : −3,6 ms
bip signal : −3,6 ms
Écart maximal : 4,4 ms (seuil 30 ms) · manquants : 0 · bips en trop ou fusionnés : 0
RÉSULTAT : OK (tentative 1/3)
```

`RT_STRICT=1 node tools/stamp.mjs --check` : « stamp à jour », sortie 0 ; `RT_STRICT=1 npm run gate` : sortie 0 (430 tests, 0 échec). `git diff --quiet f80c365 -- js/courses.js tests/reference/` : sortie 0 (référence SNPM et table des marques inchangées).

## Publication de la v30 sur l'aperçu

- `release.json` : `n` 30, note « archive partagée : régates et bouées sur les trois téléphones », `critical` faux, `hash` d3b8574933 = `BUILD.id` de `js/version.js`.
- `git ls-remote origin refs/heads/main` avant le push : `7fb640100dc230f139eeb039a8315b2cead69f34` ; après : `7fb640100dc230f139eeb039a8315b2cead69f34` (identique, `main` n'a pas bougé).
- `git push origin apercu-phase-04` : `7b1c10f..0ec6fa7`, accepté (aucun refus, aucune fusion, aucune opération sur `main`).
- Déploiement d'aperçu Vercel du commit `0ec6fa7` : statut **success** (`https://vercel.com/romain-detroyat-s-projects/rade-tactique/2XpYJc7tQKVRoMrpuDmikSeJAoJh`), obtenu à la sixième interrogation (une minute environ).
- Contrôle de l'état distant après `git fetch -q origin +refs/heads/apercu-phase-04:refs/remotes/origin/apercu-phase-04 +refs/heads/main:refs/remotes/origin/main` :
  - `origin/apercu-phase-04` = `0ec6fa70a5852cb394262251c043f1feef280d87`, `origin/main` = `7fb640100dc230f139eeb039a8315b2cead69f34`
  - `git show origin/apercu-phase-04:release.json` : `"n": 30`
  - `git show origin/apercu-phase-04:package-lock.json` : `@vercel/blob` 2.8.0
  - `git log -1 --format=%H -- release.json` = `0ec6fa7`, ancêtre de `origin/apercu-phase-04` ; `git merge-base --is-ancestor origin/apercu-phase-04 origin/main` : faux (la branche n'est pas contenue dans `main`).

## Consignes pour Romain

**(a) Magasin Blob (déjà créé : « rade-tactique-blob »).** Vérifier qu'il est **Privé**, connecté au projet pour **Production et Preview**, que `BLOB_READ_WRITE_TOKEN` (ou `BLOB_STORE_ID`) existe dans les deux environnements, que l'exposition des variables système (`VERCEL_ENV`) est cochée, puis **redéployer l'aperçu** (la variable n'est lue qu'au déploiement).

**(b) Recette à deux téléphones sur l'aperçu v30** (points 1 à 9 et 11 de la *Recette humaine* de 04-RESEARCH.md) :
1. Premier essai : l'indicateur dit « À jour (essai) » ; dans le magasin, `preview/light.json` est présent et aucun `prod/…`.
2. Ni 403 ni 500 sur `/api/archive`.
3. A en mode avion crée une régate et ajoute une manche pendant que B ajoute la sienne : « Hors réseau · n modifications en attente (essai) » ; au retour du réseau tout arrive chez les deux, une seule fois.
4. Ajouts simultanés d'une manche : tous gardés.
5. Même valeur modifiée des deux côtés : la plus récente reste, l'autre est dans « Historique (n) » de la fiche.
6. Chrono lancé sur A pendant que B modifie : « En pause pendant la course », rien ne circule ; reprise dans la minute qui suit l'arrêt.
7. A recale la bouée 3 (saisie) : B reçoit le recalage avec le toast « Bouée 3 GR1 recalée par … » ; « Position d'origine » se propage aussi.
8. « Désactiver la synchronisation » (deux touches) coupe tout sur ce téléphone ; « Réactiver » le remet.
9. Sans code d'accès (navigation privée), `/api/archive` et `/api/archive?k=light` répondent **401**.
11. Safari et l'app installée d'un même iPhone se retrouvent par l'archive.

**(c) Quotas.** Relever après une heure d'essais, puis après une semaine, les opérations simples et avancées dans Observability › Blob : moins de 30 % des quotas extrapolés au mois.

**(d) Production.** La mise en production de la v30 est ta décision, **visée au plus tard le 30 octobre, jamais après le jeudi 5 novembre au matin ni pendant une course** ; chaque iPhone applique la mise à jour par le bandeau, hors course. La v31 (plans 04 et 05) n'ira en production avant la régate que si la v30 est verte sur l'aperçu le 28 octobre ; sinon elle attend la régate (D-02).

**(e) Repli.** « Désactiver la synchronisation » sur un téléphone, ou retirer la variable du magasin : l'indicateur passe à « Archive non configurée » et l'app redevient celle de la phase 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `isFinite` laisse passer une chaîne numérique**
- **Found during :** Task 1 (test T-04-18)
- **Issue :** `isFinite("43.09")` est vrai : une position envoyée comme chaîne par un autre téléphone aurait été acceptée.
- **Fix :** `Number.isFinite` dans `sharedMarks` et `remoteMarkChanges` ; test de clés et valeurs malformées.
- **Files modified :** js/marks.js — **Commit :** `1bfd35c`

**2. [Rule 2 - Missing critical] Positions reçues hors de la rade**
- **Found during :** Task 1 (T-04-18 demande de les ignorer)
- **Issue :** le plan ne listait que clés non numériques, positions non finies et clés dangereuses.
- **Fix :** `remoteMarkChanges` ignore aussi toute position hors de `RADE` (mêmes bornes que `parseLatLon`, exportées) et ramène la source à `trace | saisie`.
- **Files modified :** js/marks.js — **Commit :** `1bfd35c`

**3. [Rule 2 - Missing critical] Interrupteur : indicateur et module**
- **Found during :** Task 2
- **Issue :** `paintSync` masque la ligne tant que `js/archsync.js` n'est pas chargé ; coupée avant tout chargement, la synchronisation n'aurait rien affiché, et un échange en vol aurait été appliqué après la coupure.
- **Fix :** « Synchronisation désactivée » affiché depuis `app.js` sans charger le module ; `syncNow` sort tôt quand `SYNC.off` ; `canApply` refuse la réponse d'un échange en vol.
- **Files modified :** js/app.js — **Commit :** `2fc753c`

**4. [Rule 3 - Blocking] Scénario `archive-bouees` : ordre du chrono**
- **Found during :** Task 2 (une exécution sur une vingtaine a échoué sur « la bouée 11 de B est inchangée pendant le chrono », avec le recalage de A déjà chez B)
- **Issue :** B pouvait légitimement se synchroniser (sonde réseau, minuterie) entre l'envoi de A et le départ de son chrono : le test avait une course contre lui-même, pas l'app.
- **Fix :** le chrono de B démarre avant le recalage de A ; aucun échange légitime de B ne peut le précéder. 12 exécutions vertes avant le changement (dont 6 en parallèle, donc sans reproduire l'échec) et 6 après (dont la passe complète 15/15).
- **Files modified :** tools/regate-e2e.mjs — **Commit :** `2fc753c`

**5. [Hors plan] Textes de bulles de l'app**
- La bulle « Bouées à confirmer » (trace) disait « le recalage reste sur ce téléphone » ; mise à jour avec le texte de la carte « Marques » (même contenu que le guide).

**Total deviations :** 4 auto-corrigées (1 bug, 2 manques critiques, 1 blocage de test) + 1 écart de texte. **Impact :** renforce T-04-17, T-04-18 et T-04-20 ; aucune décision D-0x changée.

**Écart de procédure :** le plan et l'orchestrateur demandent « SUMMARY → commit → push » ; le push de la v30 a eu lieu **avant** ce fichier parce que les contrôles distants (déploiement d'aperçu, `release.json`, verrou, filiation) en sont la matière. Le SUMMARY et l'état partent dans un second push.

## Limites connues

- **Recalage par trace daté du début de la trace** (`t = tr.start`, comportement existant) : un recalage issu d'une vieille trace perd contre une saisie plus récente d'un autre équipier ; c'est « le plus récent gagne », l'écrasé est dans l'historique de la bouée.
- **Historique de la bouée** (`h`, 5 versions) : conservé dans le document et par le serveur, mais pas encore affiché dans l'application (la section « Historique » de la fiche couvre fiche, manche, bouée IC, parcours, trace d'une régate). Rien dans le plan ne l'exigeait.
- **Un recalage reçu sans `by`** (ancien document) est appliqué avec le message sans « par … ».
- **Débrief/rapports/traces complètes** : plans 04 et 05 (v31).

## Authentication Gates

Aucune. Le magasin Blob existe déjà (créé par Romain) ; aucun appel au vrai magasin n'a été tenté (consigne de l'orchestrateur).

## Contrôle humain restant

Tâche 3, `<human-check>` : recette de Romain sur l'aperçu v30 avec le vrai magasin et deux téléphones (consigne b ci-dessus), quotas (c), décision de mise en production (d). Consigné dans `.planning/WINDOWS.md` (entrée 3, `unrun-verify`) ; l'entrée 2 (recette du plan 02) est couverte par la même recette.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau périmètre hors du `<threat_model>` : T-04-17 (application hors course seulement, scénario), T-04-18 (`remoteMarkChanges` + `applyOverrides`), T-04-19 (`escHTML`, bornes, test linkedom), T-04-20 (interrupteur), T-04-21 (aperçu seulement), T-04-22 (préfixes plan 01). Aucun code d'accès ni empreinte dans les fichiers modifiés.

## Issues Encountered

- Un échec isolé de `archive-bouees` (voir Déviation 4), non reproductible ensuite, durci.
- Pendant le contrôle négatif de `historySectionHTML`, le même échec isolé s'est produit avant d'atteindre la partie « historique » ; la neutralisation de `historySectionHTML` n'a donc pas été vue échouer dans le scénario (le test unitaire de la section, lui, est rouge sans la fonction : import absent avant l'écriture). Le scénario vérifie l'historique de bout en bout dans les exécutions suivantes (toutes vertes).

## Next Phase Readiness

Prêt pour 04-04 (objets lourds : vent figé du jour, traces et rapports dans le magasin) : `GET|PUT ?k=` de `api/archive.js` accepte déjà `light` seulement, les clés `day`, `trace` et `report` arrivent avec ce plan ; la v31 est conditionnée à une v30 verte sur l'aperçu le 28 octobre.

## Self-Check: PASSED

- Fichiers présents : `js/marks.js`, `js/regview.js`, `guide.html`, `release.json`, `.planning/phases/04-archive-partagee/04-03-SUMMARY.md` ; `grep -c "remoteMarkChanges(" js/app.js` = 1, `grep -c "'~marks'" js/app.js` = 2, `grep -c "historySectionHTML(" js/regview.js` = 2.
- Commits `1bfd35c`, `2fc753c`, `0ec6fa7` : ancêtres de HEAD et de `origin/apercu-phase-04` ; `git rev-list --count 7b1c10f..0ec6fa7` = 3.
- `npm run check` : 430 tests verts ; `git diff --quiet f80c365 -- js/courses.js tests/reference/` : inchangé ; `origin/main` = `7fb6401…` avant et après.
