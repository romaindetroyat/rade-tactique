---
phase: 04-archive-partagee
plan: 05
subsystem: sync
tags: [archive, e2e, trois-telephones, guide, hors-reseau, release, apercu, chromium]

requires:
  - phase: 04-archive-partagee
    provides: "plans 01 à 04 : api/archive.js (routes light, trace, report, day), js/archsync.js, js/archheavy.js, faux Blob, scénarios archive, archive-bouees et archivehors, v30 sur l'aperçu"
provides:
  - "tools/regate-e2e.mjs : scénario equipage (trois contextes Chromium, un faux Blob partagé, le vrai createHandler) : critères 1, 2 et 4 et D-03 réunis"
  - "guide.html : carte « Lire une régate hors réseau », fiche, rapport, archive partagée et questions à jour (traces, débriefs et rapports partagés)"
  - "js/help.js : DL_TIP, bulle de « Télécharger pour le hors réseau » (branchée par js/regview.js et js/app.js) ; SYNC_TIP à jour"
  - "scénario gel déterministe et fiche des régates redessinée après un gel tombé onglet fermé (icStale)"
  - "release.json n = 31 (non critique) publiée sur origin/apercu-phase-04, déploiement d'aperçu « success », main intacte"
affects: [recette-romain, production]

actuals:
  tokens: 13163
  tasks: 2
  commits: 4
plan_head_before: 9a0e98961b3603dee91f25a8eb346fef62b0fa8d
plan_head_after: 257a06d9e026f0cc596af4d704921d7ee7a056fe
commits: 4

tech-stack:
  added: []
  patterns:
    - "Scénario de synthèse à N contextes : chaque téléphone synchronise une fois en ligne avant d'être coupé (l'outil bloque le service worker, un module demandé réseau coupé échouerait pour de bon)"
    - "Un état voulu par un scénario est posé dans le stockage avant l'ouverture de l'app quand un tic de l'app peut tomber entre deux gestes de l'interface"
    - "Fiche redessinée à l'ouverture de l'onglet seulement si un changement est tombé pendant qu'elle n'était pas affichée (icStale), jamais à chaque changement d'onglet"

key-files:
  created: []
  modified:
    - tools/regate-e2e.mjs
    - guide.html
    - js/help.js
    - js/regview.js
    - js/app.js
    - tests/regates.test.mjs
    - release.json
    - sw.js
    - js/version.js
    - .planning/phases/04-archive-partagee/deferred-items.md

key-decisions:
  - "Le défaut intermittent du scénario gel (étape 3) n'était pas seulement une condition d'attente trop large : la régate était créée par l'interface puis sa manche ajoutée, et un tic de gel entre les deux donnait un « sceau » au lieu d'une copie « tardive ». Le scénario pose maintenant la régate et sa manche avant l'ouverture : déterministe"
  - "Le correctif du scénario a révélé un vrai défaut d'affichage ancien (phase 2) : un gel tombé onglet Régates fermé laissait la fiche dire « Pas encore figé ». Corrigé en une ligne de drapeau (icStale), avec une garde statique, parce que l'équipage le verrait le jour de la régate"
  - "Le test « identifiants distincts » de createRegatta (200 tirages de même instant, Math.random, 4 caractères) échouait environ une fois sur 80 : tirages rendus déterministes, newId inchangé"
  - "Aucune production : la v31 est sur l'aperçu seulement ; la mise en production reste la décision de Romain (D-02)"

requirements-completed: [ARCH-01, ARCH-03]

coverage:
  - id: D1
    description: "Trois téléphones (A, B, C) : A crée hors réseau, B et A complètent chacun hors réseau, tout part au retour du réseau sans perte ni doublon (trois manches, chacune une fois, avec son auteur), C les reçoit ; pendant le chrono de A aucun appel à /api/archive, la modification arrive chez C après « Stop »"
    requirement: ARCH-01
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs equipage (trois contextes Chromium, faux Blob partagé, vrai createHandler) ; contrôle négatif : verrou de course neutralisé -> « aucun appel à /api/archive pendant le chrono de A — obtenu 7, attendu 5 »"
        status: pass
    human_judgment: false
  - id: D2
    description: "C lit, réseau coupé, la fiche, la trace (carte et analyse), le débrief et le rapport faits par A, sans aucune requête ni écriture en ligne ; rapport enfermé dans un cadre sandbox ; une seule trace chez C"
    requirement: ARCH-03
    verification:
      - kind: e2e
        ref: "equipage partie 5 et archivehors (trace de 9 538 points, rapport marqueur piégé, sandbox sans permission, window.__xss et localStorage intacts)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Le guide et l'aide disent ce qui se lit hors réseau (six derniers mois et à venir, fiche, vent du jour, traces, débrief, rapport), « Télécharger pour le hors réseau », rien de lourd le jour de régate ni en course, environ 1 Mo par régate, app installée ; plus aucune mention d'un partage à venir ; ni code ni adresse du magasin"
    requirement: ARCH-03
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#aide et guide (carte, motifs, absence des anciennes phrases, absence de code et d'adresse du magasin, bulle DL_TIP) et #garde icStale"
        status: pass
    human_judgment: false
  - id: D4
    description: "La suite complète des scénarios est déterministe (le scénario gel ne tombe plus une fois sur six) et la v31 est publiée sur l'aperçu après des vérifications faites pour de bon"
    requirement: ARCH-01
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs : 6 passages consécutifs 17/17 après le correctif, 3 passages seuls du scénario gel, puis un passage complet 17/17 avant la release ; npm run check 472/472 ; RT_STRICT=1 npm run gate sortie 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Recette humaine de la v31 sur l'aperçu avec le vrai magasin Blob : deux iPhone (app installée), mode avion sur le second, Coupe SNPM avec sa vraie trace de 613 Ko et une régate récente ; relevé des opérations Blob ; décision de mise en production"
    verification: []
    human_judgment: true
    rationale: "Vrai magasin, iPhone en mode avion, quota d'iOS, décision de mise en production réservée à Romain (D-02)"

duration: 85min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 05: trois téléphones, guide hors réseau et v31 sur l'aperçu Summary

**Scénario `equipage` à trois contextes Chromium qui rejoue la phase entière (saisie hors réseau, ajouts simultanés sans perte, chrono muet, trace et rapport lus réseau coupé), guide et aide qui expliquent la lecture hors réseau, et v31 publiée sur `apercu-phase-04` après des vérifications faites pour de bon ; `main` n'a pas bougé.**

## Accomplissements

- **Scénario `equipage`** (`tools/regate-e2e.mjs`) : A (Teiva), B (Thibaud) et C (Romain). Chaque téléphone synchronise une fois en ligne, puis A et B passent hors réseau. A crée « Régate de l’équipage » avec une manche à 10:55 ; au retour du réseau l'envoi part seul ; B la reçoit, repasse hors réseau et ajoute 13:30 pendant que A, hors réseau, ajoute 15:00. Au retour du réseau, A, B et C affichent une seule régate avec trois manches (10:55 Teiva, 13:30 Thibaud, 15:00 Teiva), chacune une fois, et C les montre avec leurs auteurs. Pendant le chrono de A (`#t5`), A ajoute une quatrième manche (16:20) et touche « Synchroniser » : le compteur d'appels de A et du serveur est inchangé, l'indicateur dit « En pause pendant la course (essai) » et C ne voit rien ; après « Stop » la modification arrive chez C puis chez B. A range la trace de la Coupe SNPM (régate non courante), pose le rapport marqueur, synchronise ; C reçoit, coupe le réseau et lit la fiche (« sur ce téléphone »), la trace (carte et analyse), le débrief (« Débrief par Teiva ») et le rapport (cadre sandbox, aucune requête, aucune écriture en ligne de plus, une seule trace, aucune erreur de page sur les trois contextes).
- **Contrôle négatif** : verrou de course neutralisé dans `js/app.js` (copie jetée, `git checkout`) -> `ÉCHEC equipage : aucun appel à /api/archive pendant le chrono de A — obtenu 7, attendu 5`. Le scénario discrimine.
- **Guide et aide** : nouvelle carte « Lire une régate hors réseau » (section 4), fiche de régate, rapport, archive partagée et questions fréquentes mises à jour ; bulle `DL_TIP` sur « Télécharger pour le hors réseau » et `SYNC_TIP` à jour. Plus aucune phrase « restent sur le téléphone qui les a » ni « viendra avec la version suivante » (gardé par un test). Ni code ni adresse du magasin (T-04-31, gardé par un test).
- **Gel déterministe** : voir Déviations.
- **v31** : `release.json` n = 31, « archive partagée : traces, rapports et vent du jour hors réseau », non critique, hash `dab1bc9396` = identifiant de `js/version.js`.

## Sorties brutes des vérifications avant la release

`npm run check` : sortie 0, `# tests 472`, `# pass 472`, `# fail 0` (« stamp à jour » ; l'avertissement « contenu modifié depuis la v30 » disparaît avec la release).

`PW_REQUIRED=1 node tools/regate-e2e.mjs` (tous les scénarios, sortie 0) :

```
OK equipage / OK archive / OK archive-bouees
  mesure archivehors : trace 612648 octets, rapport 366 octets
  mesure archivehors : vent du jour 50593 octets (prévisions 38803, route 11490, relevés 48)
OK archivehors / OK creer / OK manche / OK auteur / OK ic / OK depuis-ic / OK vraisemblance
OK gel / OK debrief-tardif / OK gpx / OK gpx-choix / OK ia / OK ia-erreurs / OK bouees
Bilan : 17/17 scénario(s) OK
```

`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` (sortie 0) :

```
ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l'interface (ms)
        1 |                  348 |                           395 |             4415 |                                      931
        2 |                  487 |                           252 |             4272 |                                      749
        3 |                  416 |                           361 |             4392 |                                     1001
        4 |                  418 |                           331 |             4048 |                                      933
        5 |                  519 |                           423 |             4374 |                                      969
  médiane |                  418 |                           361 |             4374 |                                      933
  maximum |                  519 |                           423 |             4415 |                                     1001
RÉSULTAT : OK — médiane de l'interface utile 418 ms < 2000 ms (hors réseau, CPU ×4)
```

`PW_REQUIRED=1 node tools/audio-clock-check.mjs` : **le premier passage a échoué (sortie 1)** : les trois tentatives ont montré un décalage UNIFORME de tous les bips (−42 à −104 ms selon la tentative, aucun bip manquant, fusionné ou en trop), c'est-à-dire la dérive de l'horloge audio de la machine de mesure que l'outil documente, pas un défaut de `js/beeper.js` (non touché par ce plan). Trois relances ensuite : sorties 0, 0 et 0 (tentative 2/3 pour deux d'entre elles, 1/3 pour la dernière) ; sortie brute de la dernière :

```
Tentative 1/3 — contexte audio : running · 11 début(s) de bip relevé(s) pour 11 attendus · fil principal gelé 2 × 1,3 s
bip 10 s à 4 s : −7,7 ms · bip 3 s : −14,1 ms · bip 2 s : −19,7 ms · bip 1 s : −10,1 ms · bip signal : −10,1 ms
Écart maximal : 19,7 ms (seuil 30 ms) · manquants : 0 · bips en trop ou fusionnés : 0
RÉSULTAT : OK (tentative 1/3)
```

Après la release : `RT_STRICT=1 node tools/stamp.mjs --check` sortie 0 (« stamp à jour »), `RT_STRICT=1 npm run gate` sortie 0 (472/472), puis `equipage`, `gel` et `archivehors` relancés : 3/3 OK. `git diff --quiet f80c365 -- js/courses.js tests/reference/` sortie 0 (référence de la Coupe SNPM et `js/courses.js` inchangés).

## Reproductibilité du scénario gel (≥ 5 passages)

| Série | Résultat |
| ----- | -------- |
| Avant le correctif (condition `x.signal === 'manche'` seule, piste de deferred-items) | 6 passages complets : 4 × 17/17, 1 × 16/17 (`gel` : « copie marquée tardive — obtenu false, attendu true »), 1 passage mêlé à l'édition du fichier (16/17) : la piste ne suffisait pas |
| Après le correctif (régate et manche posées avant l'ouverture, `icStale`) | 3 passages de `gel` seul : OK, OK, OK ; **6 passages complets consécutifs : 17/17, 17/17, 17/17, 17/17, 17/17, 17/17**, toutes sorties 0 ; puis un passage complet 17/17 avant la release |
| `npm test` seul | 8 passages consécutifs : 472/472 à chaque fois (après le correctif du test d'identifiants) |

## Contrôle de l'état distant

```
main avant le push : 7fb640100dc230f139eeb039a8315b2cead69f34   refs/heads/main
main après le push : 7fb640100dc230f139eeb039a8315b2cead69f34   refs/heads/main   (identique)
git push origin apercu-phase-04 : 9a0e989..257a06d  apercu-phase-04 -> apercu-phase-04
déploiement d'aperçu (statut du commit 257a06d) : Vercel « success »
  https://vercel.com/romain-detroyat-s-projects/rade-tactique/5D1Fcv5sD8wHejUVPpKTYXdrUvpQ
git fetch -q origin +refs/heads/apercu-phase-04:refs/remotes/origin/apercu-phase-04 +refs/heads/main:refs/remotes/origin/main
git show origin/apercu-phase-04:release.json -> "n": 31, "critical": false, "hash": "dab1bc9396"
git show origin/main:release.json -> "n": 29    (main est restée avant la v30)
commit de la v31 (257a06d) ancêtre de origin/apercu-phase-04 : oui
origin/apercu-phase-04 contenue dans origin/main : non
```

Le SUMMARY lui-même est poussé dans un second push de la même branche (`apercu-phase-04` seulement).

## Déviations par rapport au plan

### Corrections automatiques

**1. [Rule 1 - Bug] Scénario `gel`, étape 3 : l'échec intermittent n'était pas qu'une condition trop large**
- **Trouvé pendant :** demande de l'orchestrateur (deferred-items.md) ; reproduit une fois sur six même avec la condition `x.signal === 'manche'` de la piste.
- **Cause réelle :** la régate « Ouverte trop tard » était créée par l'interface, puis sa manche ajoutée ; si un tic de gel tombait entre les deux, une copie « signal inconnu » existait déjà, et la copie faite après l'ajout de la manche (heure du signal déjà passée) était un « sceau », jamais « tardive ».
- **Correctif :** le scénario pose la régate et sa manche de 10:55 dans le stockage avant l'ouverture de l'app (`sème`), donc la première copie voit le signal et est toujours « tardive ». Le code du gel n'est pas modifié.
- **Fichiers :** `tools/regate-e2e.mjs`. **Commits :** d1cd783 (condition), 020b1ce (pose avant l'ouverture).

**2. [Rule 1 - Bug] Fiche des régates périmée après un gel tombé onglet fermé (ancien, phase 2)**
- **Trouvé pendant :** correctif 1 : avec la régate posée avant l'ouverture, le gel tombait onglet Régates fermé et la fiche, ouverte ensuite, disait « Pas encore figé » (3 échecs sur 3, déterministes).
- **Correctif :** `icStale` dans `js/app.js` (marqué par `freezeWrite` quand la fiche n'est pas affichée ou occupée, redessin unique à l'ouverture de l'onglet) ; garde statique dans `tests/regates.test.mjs`.
- **Fichiers :** `js/app.js`, `tests/regates.test.mjs`. **Commit :** 020b1ce.

**3. [Rule 3 - Blocage] Test « identifiants distincts » de `createRegatta` intermittent**
- **Trouvé pendant :** `npm run check` avant la release (199 !== 200). 200 identifiants de même instant avec `Math.random` sur 4 caractères en base 36 : environ 1 chance sur 80 d'une collision (paradoxe des anniversaires). `newId` lui-même est correct en pratique (l'instant en millisecondes est dans l'identifiant).
- **Correctif :** tirages déterministes dans le test. **Fichier :** `tests/regates.test.mjs`. **Commit :** b0878ba. Vérifié : 8 passages de `npm test` à 472/472.

**4. [Rule 3 - Blocage] Chaque téléphone du scénario `equipage` synchronise une fois en ligne avant d'être coupé**
- Un téléphone qui n'a jamais synchronisé et passe hors réseau ne peut pas charger `js/archsync.js` (échec d'`import()` conservé par Chromium jusqu'au rechargement ; l'outil bloque le service worker qui, en vrai, précharge ces modules). Consigné dans deferred-items.md ; aucun effet pour l'équipage.

**Total des déviations :** 4 corrections automatiques (2 défauts, 2 blocages). **Impact :** le défaut 2 modifie `js/app.js` (une variable, une ligne dans `freezeWrite`, une ligne dans le gestionnaire d'onglets) : la v31 corrige donc aussi la fiche périmée du jour de régate. Aucun autre comportement de l'app n'a changé.

### Écarts mineurs au plan

- La « modification de la régate » pendant le chrono est l'ajout d'une quatrième manche (16:20) : la fiche n'a pas d'autre champ modifiable. Le scénario vérifie d'abord les trois manches attendues, puis la quatrième après « Stop ».
- Le premier passage d'`audio-clock-check` a échoué par dérive d'horloge de la machine (voir plus haut) ; la release n'a été faite qu'après une sortie 0 de la mesure, sans toucher au code audio.

## Éléments connus à surveiller

- `.planning/deferred-items.md` (phase) : un « sceau » pris après l'heure du signal d'une manche ajoutée tardivement n'est pas marqué « tardive » (cas rare, sémantique du gel de la phase 2 non touchée).
- Aucun stub ni TODO ajouté. Les entrées 4 et 5 de `.planning/WINDOWS.md` (quota et purge d'iOS, vrai magasin Blob) restent ouvertes : c'est la recette humaine ci-dessous.

## Consignes pour Romain

**(a) Recette sur l'aperçu v31 avec le vrai magasin.** Deux iPhone avec l'app installée, ouverte sur l'adresse de l'aperçu `apercu-phase-04` : vérifier « Version v31 · 20/10 — archive partagée : traces, rapports et vent du jour hors réseau ». Sur le premier, toucher **Synchroniser** (« À jour (essai) »), importer une trace ou ouvrir la Coupe SNPM avec sa vraie trace de 613 Ko (carte et analyse, puis « Voir le débrief »). Sur le second, **Synchroniser**, attendre quelques secondes, puis **mode avion** et ouvrir : la fiche de la Coupe SNPM, sa trace (carte et analyse), le débrief, le rapport et le vent du jour d'une régate récente (point 10 de la recherche). L'ouverture de l'app doit rester aussi rapide qu'avant.

**(b) Observability › Blob après une journée** : relever les opérations avancées et le transfert (les objets lourds comptent) ; attendu : de l'ordre de quelques dizaines d'opérations par téléphone et par jour, un envoi par trace, rapport et jour de vent.

**(c) Production de la v31** : seulement si la v30 est verte sur l'aperçu le **28 octobre**, au plus tard le **2 novembre** ; sinon après la régate ; **jamais après le jeudi 5 novembre au matin ni pendant une course**. Chaque iPhone applique la mise à jour par le bandeau, hors course. La fusion dans `main` reste une décision de Romain avec l'orchestrateur ; ce plan n'y a pas touché.

**(d) Repli** : **Désactiver la synchronisation** (deux touches, sous la liste des régates) sur un téléphone, ou retrait de la variable du magasin côté Vercel (l'app dit alors « Archive non configurée » et marche comme avant).

## Self-Check: PASSED

- Fichiers : `tools/regate-e2e.mjs`, `guide.html`, `js/help.js`, `js/regview.js`, `js/app.js`, `tests/regates.test.mjs`, `release.json`, `sw.js`, `js/version.js` présents.
- Commits dans l'historique de la branche : d1cd783, 020b1ce, b0878ba, 257a06d.
- Critères : `PW_REQUIRED=1 node tools/regate-e2e.mjs equipage archive archive-bouees archivehors` sortie 0 ; `guide.html` contient « Lire une régate hors réseau » et « Télécharger pour le hors réseau » ; `npm run check` et `RT_STRICT=1 npm run gate` sortie 0 ; `origin/apercu-phase-04` porte n = 31 et n'est pas dans `origin/main` ; SHA de `main` identique avant et après.
