---
phase: 03-ouvrir-une-regate
plan: 05
subsystem: publication-v28
tags: [guide, aide, onglet-regates, nettoyage, release, v28, apercu-vercel, mesures-chromium, pwa]

requires:
  - phase: 03-ouvrir-une-regate
    provides: "plans 01 à 04 : régates et manches (js/regates.js), relecture des IC (js/icread.js), auteur, gel du vent du jour (js/gel.js), rattachement du GPX, pauses, fiche avec traces (js/attach.js, js/segments.js), tools/regate-e2e.mjs"
  - phase: 02-fiable-et-juste-en-mer
    provides: "tools/measure-boot.mjs, tools/audio-clock-check.mjs, déroulé de la publication v27 (aperçu, SHA de main)"
provides:
  - "L'onglet s'appelle « Régates » (index.html, data-tab inchangé) ; l'aide (js/help.js) et le guide de l'équipage (guide.html) décrivent la phase : créer une régate en trois champs, manches et « Choisir cette manche », relecture des IC et « Valider les IC », vent et route figés tout seuls, GPX rangé tout seul, pauses, fiche de régate, auteur, tout reste sur ce téléphone"
  - "js/events.js réduit à la lecture du PDF et des IC (exports exacts : PDF_OPTIONS, cleanText, parseIC, pdfText) : fiches, stockage rade.events.v1 et ancien formulaire retirés"
  - "tools/regate-e2e.mjs : scénario depuis-ic (10 scénarios au total), diagnostic d'échec avec obtenu / attendu / ligne"
  - "js/gel.js : la copie du vent du jour est refaite sans attendre 10 min quand l'heure du signal change (correctif d'un échec intermittent du scénario gel)"
  - "release.json v28 (non critique, id 4c27d9cd22, 62 fichiers) ; sw.js et js/version.js régénérés"
  - "branche apercu-phase-03 poussée sur origin (789538f..f2f8994) ; main distant inchangé (f80c365)"
affects: [03-06, 03-07, recette de la phase par Romain sur les trois iPhone, décision de mise en production]

actuals:
  tokens: 10800
  tasks: 2
  commits: 4
plan_head_before: 789538fc41527d446e82beafe1c774527d858f17
plan_head_after: f2f8994368120600236492753d4ffe9a4fe6f853

key-files:
  created: []
  modified:
    - index.html
    - js/help.js
    - guide.html
    - js/events.js
    - js/gel.js
    - tests/racelock.test.mjs
    - tests/regates.test.mjs
    - tests/gel.test.mjs
    - tools/regate-e2e.mjs
    - release.json
    - sw.js
    - js/version.js

key-decisions:
  - "Le test « semis » de tests/regates.test.mjs ne compare plus à js/events.js (retiré) mais aux constantes de js/courses.js, qui en étaient la source : même forme d'IC pour tout ce que lit app.js"
  - "D-15 reste couvert sans l'ancien formulaire : tests/regates.test.mjs (création : dernier jour antérieur ou impossible ignoré, reprise des fiches) et tests/icread.test.mjs (règle du dernier jour sur applyReview) ; deux tests de tests/racelock.test.mjs retirés, un garde sur les exports de js/events.js ajouté"
  - "La mention de la v28 reste celle du plan : « régates, IC relues, vent figé, GPX rangé et débrief » ; la date affichée est celle de la commande de publication (20/10, passé minuit à Paris)"
  - "REG-03 n'est pas coché : la lecture IA d'un autre club est aux plans 06 et 07 (v29)"

patterns-established:
  - "Une release se refait en entier si le contenu change après `npm run release` : retour des trois fichiers générés (`git checkout -- release.json js/version.js sw.js`), correctif commité, puis nouvelle release (le hachage de release.json suit le contenu)"

requirements-completed: [REG-01, REG-02, ARCH-02, ARCH-04]

coverage:
  - id: D1
    description: "L'onglet s'appelle « Régates » ; l'aide et le guide expliquent la phase 3 de bout en bout avec les libellés réels de l'interface, sans code d'accès ni empreinte"
    requirement: REG-01
    verification:
      - kind: other
        ref: "grep : data-tab=\"ic\">Régates< (index.html), « Valider les IC », « Choisir cette manche », « figé », « onglet Régates » (guide.html) ; aucune chaîne hexadécimale de 64 caractères dans les fichiers du plan"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs depuis-ic (le texte du bouton d'onglet est exactement « Régates »)"
        status: pass
    human_judgment: true
    rationale: "Clarté du guide et de l'aide pour un équipier qui n'a jamais vu ces écrans (relecture par Romain sur iPhone)"
  - id: D2
    description: "L'ancien formulaire de fiche IC a disparu de l'app : importer un PDF d'IC sans aucune régate ouvre la relecture champ par champ, « Valider les IC » crée la régate depuis les IC, aucune ancienne fiche ne réapparaît après relance ; js/events.js n'exporte plus que la lecture du PDF et des IC"
    requirement: REG-03
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs depuis-ic (ni #evSave, ni #evSel, ni #evForm à aucun moment ; régate du 18/10/2026 créée et courante, ic.validated, vhf 72, sous « Saison 2026 » / « Passée » ; après relance une seule régate, rade.events.v1 absente)"
        status: pass
      - kind: unit
        ref: "tests/regates.test.mjs#garde : js/events.js ne garde que la lecture du PDF et des IC ; node -e import('./js/events.js') : PDF_OPTIONS,cleanText,parseIC,pdfText"
        status: pass
    human_judgment: false
  - id: D3
    description: "La règle D-15 (un dernier jour antérieur ou égal au premier est ignoré) reste testée après le retrait de l'ancien formulaire"
    requirement: REG-01
    verification:
      - kind: unit
        ref: "tests/regates.test.mjs#création : … dernier jour antérieur ignoré ; tests/icread.test.mjs#règle du dernier jour (D-15) : antérieur ou égal ignoré, postérieur gardé"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toutes les vérifications sont faites pour de bon avant la publication (PW_REQUIRED=1) : scénarios de bout en bout, ouverture hors réseau sous 2 s, bips à 30 ms près avec le gel du fil principal"
    requirement: ARCH-02
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs : 10/10 OK, sortie 0"
        status: pass
      - kind: other
        ref: "PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 : médiane de l'interface utile 603 ms < 2 000 ms, sortie 0"
        status: pass
      - kind: other
        ref: "PW_REQUIRED=1 node tools/audio-clock-check.mjs : écart maximal 12,0 ms (seuil 30 ms), fil principal gelé 2 × 1,3 s, sortie 0"
        status: pass
    human_judgment: true
    rationale: "Ouverture en mode avion et bips sur les trois iPhone réels (recette de Romain)"
  - id: D5
    description: "La v28 est publiée sur l'aperçu apercu-phase-03 ; main (production) n'a pas bougé ; la mise en production reste la décision de Romain"
    requirement: ARCH-04
    verification:
      - kind: other
        ref: "git show origin/apercu-phase-03:release.json : n = 28 ; git merge-base --is-ancestor origin/apercu-phase-03 origin/main : faux ; git ls-remote origin refs/heads/main : f80c365 avant et après le push"
        status: pass
      - kind: other
        ref: "RT_STRICT=1 node tools/stamp.mjs --check et RT_STRICT=1 npm run gate : sortie 0 (280 tests)"
        status: pass
    human_judgment: true
    rationale: "Recette sur l'aperçu avec les trois iPhone et décision de mise en production réservées à Romain ; statut Vercel de l'aperçu à lire dans le tableau de bord (voir « Publication de l'aperçu »)"

duration: 58min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 05 : Onglet « Régates », guide, nettoyage et publication de la v28 Summary

**L'onglet IC devient « Régates », l'aide et le guide de l'équipage décrivent toute la phase (régate en trois champs, manches, IC relues et validées, vent figé tout seul, GPX rangé avec ses pauses, fiche et auteurs), l'ancien code des fiches IC disparaît de js/events.js (scénario `depuis-ic` à l'appui), et la v28 est publiée sur `apercu-phase-03` après des mesures Chromium réellement exécutées ; `main` n'a pas bougé.**

## Performance

- **Duration:** 58 min
- **Started:** 2026-10-19T21:30:00Z
- **Completed:** 2026-10-19T22:30:00Z
- **Tasks:** 2 (1 traceur, 1 automatique)
- **Files modified:** 12 ; 4 commits mesurés (`plan_head_before` → `plan_head_after`) ; plus le commit `docs(03-05)` qui suit

## Accomplishments

- **Onglet et aide** : bouton « Régates » (le `data-tab="ic"`, la `section` et tous les sélecteurs sont inchangés), astuce de l'onglet et mention « (aussi dans l'onglet Régates) » réécrites, deux lignes du guide de démarrage (Régates, Traces).
- **Guide de l'équipage** (`guide.html`, libellés copiés de `js/regview.js`, `js/icread.js` et `js/app.js`) : cartes « Créer la régate, ses manches », « Relire les IC », « Le vent du jour se fige tout seul » (avant la régate) ; import du GPX rangé tout seul avec choix si le jour est ambigu et « Déjà importée », « Pauses d'enregistrement », débrief pré-rempli et tardif, « La fiche de régate » avec auteurs et « Détacher » (après la course) ; « onglet Régates » dans les cartes des bouées à confirmer et dans le tableau des onglets ; FAQ : tout reste sur ce téléphone, le gel marche en mode avion.
- **Nettoyage** : `js/events.js` passe de 153 à 97 lignes ; il ne garde que `PDF_OPTIONS`, `pdfText`, `cleanText`, `parseIC` (inchangés). Le test « semis » compare désormais aux constantes de `js/courses.js` ; deux tests de l'ancien formulaire retirés de `tests/racelock.test.mjs`, un garde sur les exports ajouté (279 tests au lieu de 280, puis 280 avec le test du gel).
- **Scénario `depuis-ic`** (vérité 2) : index vide déposé avant le premier chargement, onglet nommé « Régates », ni `#evSave` ni `#evSel` ni `#evForm` à aucun moment, PDF SNPM déposé sans régate → relecture avec l'extrait de « 10h55 », rien d'écrit avant « Valider les IC », puis régate du 18/10/2026 créée et courante, `ic.validated`, VHF 72, « Saison 2026 » / « Passée », une seule régate après relance, `rade.events.v1` toujours absente.
- **Publication** : v28 non critique, `RT_STRICT=1` vert, branche d'aperçu poussée, `main` intact.

## Résultats de vérification (sorties brutes, dernière série avant la release)

Dans l'ordre exigé, avec `PW_REQUIRED=1` pour les trois outils Chromium, sur le contenu publié (id `4c27d9cd22`).

`npm run check` (extrait de fin) :

```
1..280
# tests 280
# suites 0
# pass 280
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7210.421678
exit 0
```

`PW_REQUIRED=1 node tools/regate-e2e.mjs` :

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
Bilan : 10/10 scénario(s) OK
exit 0
```

`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` :

```
Première visite en ligne : service worker actif, 62 fichiers en cache.
Serveur arrêté (connexion refusée sur 127.0.0.1:39713) : ouvertures hors réseau, CPU ×4, 5 ouvertures.

ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  603 |                           412 |             6864 |                                     1582
        2 |                  508 |                           516 |             6478 |                                     1587
        3 |                  611 |                           594 |             6913 |                                     1318
        4 |                  609 |                           484 |             6552 |                                     1487
        5 |                  599 |                           637 |             7032 |                                     1633
  médiane |                  603 |                           516 |             6864 |                                     1582
  maximum |                  611 |                           637 |             7032 |                                     1633
RÉSULTAT : OK — médiane de l’interface utile 603 ms < 2000 ms (hors réseau, CPU ×4)
exit 0
```

`PW_REQUIRED=1 node tools/audio-clock-check.mjs` (gel du fil principal actif : 2 × 1,3 s) :

```
Tentative 1/3 — contexte audio : running · 11 début(s) de bip relevé(s) pour 11 attendus · fil principal gelé 2 × 1,3 s
bip 10 s   : −10,6 ms
bip  9 s   : −10,6 ms
bip  8 s   : −10,6 ms
bip  7 s   : −10,6 ms
bip  6 s   : −10,6 ms
bip  5 s   : −10,6 ms
bip  4 s   : −10,6 ms
bip  3 s   : −2,5 ms
bip  2 s   : −4,1 ms
bip  1 s   : −12,0 ms
bip signal : −12,0 ms
Écart maximal : 12,0 ms (seuil 30 ms) · manquants : 0 · bips en trop ou fusionnés : 0
RÉSULTAT : OK (tentative 1/3)
exit 0
```

Après la release : `RT_STRICT=1 node tools/stamp.mjs --check` → « stamp à jour » (sortie 0) ; `RT_STRICT=1 npm run gate` → sortie 0, 280 tests, 0 échec ; contrôle de `release.json` (n = 28, non critique, hachage de 10 hexadécimaux égal à l'id de `js/version.js`) : OK.

Mesures de la première série (avant le correctif du gel, même code hormis `js/gel.js`) : audio 10,7 ms de décalage maximal, ouverture 525 ms de médiane.

## Task Commits

1. **Task 1 : onglet « Régates », aide et guide, js/events.js réduit, scénario `depuis-ic` (traceur)** - `33aef34` (feat)
2. **Outillage : l'outil de bout en bout dit obtenu, attendu et la ligne de l'assertion en échec** - `f07d8ae` (test)
3. **Correctif (Rule 1) : le gel est refait sans attendre 10 min quand l'heure du signal change** - `3f2a7c3` (fix)
4. **Task 2 : v28** - `f2f8994` (chore) ; `release.json` n = 28, hachage `4c27d9cd22`

**Plan metadata:** commit `docs(03-05)` suivant (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Tracer feedback gate

Mode « continue sans t'arrêter » : après le commit du traceur, la vérification automatisée a été rejouée de bout en bout (`node -e import('./js/events.js')`, greps du guide et de l'onglet, `npm run check` 279 tests, `PW_REQUIRED=1 node tools/regate-e2e.mjs` 10/10 sortie 0). ⚡ Tracer verified end-to-end — expanding.

## Publication de l'aperçu

- **Avant le push** : `git ls-remote --heads origin apercu-phase-03` répondait (`789538f`) ; SHA de production relevé : `main` = `f80c365fb477cc065a6e60eed6b67a0a8ffb2917`.
- **Push** : `git push origin apercu-phase-03` → `789538f..f2f8994`. Jamais `main`, aucune fusion.
- **Après le push** (`git fetch` avec refspecs explicites `+refs/heads/apercu-phase-03:refs/remotes/origin/apercu-phase-03 +refs/heads/main:refs/remotes/origin/main`, le dépôt n'ayant pas de `remote.origin.fetch`) :
  - `git show origin/apercu-phase-03:release.json` : `n` = 28, note « régates, IC relues, vent figé, GPX rangé et débrief », `critical` faux, `hash` `4c27d9cd22`, date 2026-10-20.
  - `git merge-base --is-ancestor origin/apercu-phase-03 origin/main` : **faux** (« main ne contient pas l'aperçu »).
  - Le commit de la v28 (`f2f8994`) est ancêtre de `origin/apercu-phase-03`.
  - `git ls-remote origin refs/heads/main` : `f80c365fb477cc065a6e60eed6b67a0a8ffb2917`, **identique à celui d'avant le push**.
- **Statut Vercel de l'aperçu** : voir « Issues Encountered » — au moment de l'écriture, l'API des statuts GitHub du commit `f2f8994` répondait `pending` sans aucun contexte (aucun statut « Vercel » publié). Ce point n'est donc **pas** vérifié par ce plan ; l'adresse publique de l'aperçu se lit dans le tableau de bord Vercel (projet rade-tactique, déploiement de la branche `apercu-phase-03`), sans la deviner ici.

## Rappel pour Romain (calendrier et recette)

- **Recette sur l'aperçu** (avec son code d'accès, sur les trois iPhone en Safari), liste « Recette humaine » de `03-RESEARCH.md`, points **1, 2, 3, 5, 6, 7 et 9** pour la v28 (les points 4 et 8 — lecture IA d'un autre club, bouées d'un autre club — viennent avec la v29, plans 06 et 07). Ouvrir d'abord l'aide : elle doit afficher « Version v28 · 20/10 — régates, IC relues, vent figé, GPX rangé et débrief ». Relire aussi le guide (cartes « Créer la régate, ses manches », « Relire les IC », « Le vent du jour se fige tout seul », « Après la course », « La fiche de régate ») : les libellés doivent être ceux de l'app.
- **Mise en production** : décision de Romain avec l'orchestrateur, hors de ce plan. Visée au plus tard le **30 octobre**, **jamais après le jeudi 5 novembre au matin** (règle des 48 h avant la régate CVAT des 7-9 novembre), ni pendant une course.
- Chaque iPhone applique ensuite la v28 par le bandeau **« Mettre à jour »**, hors course. La v29 (lecture IA et bouées d'un autre club) suit sans retarder la v28.
- Ouvrir l'app **le matin de la régate**, avant le départ : le vent du jour ne se fige qu'à l'ouverture (« figé après le départ » sinon).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Une copie du vent faite avant l'ajout de la manche gardait « signal inconnu » jusqu'à 10 min**
- **Found during:** Task 2 (série de mesures avant publication : le scénario `gel` a échoué dans 2 des 8 séries complètes lancées, dont une avec l'outil de diagnostic qui a donné la cause)
- **Issue:** `freezeAction` (js/gel.js) ne refaisait la copie qu'à de nouvelles prévisions, à une nouvelle route ou après 10 min. Si une copie était prise juste après la création de la régate et avant l'ajout de la manche (cas réel : régate créée le matin même), le résumé gardait `signal: 'inconnu'` et un sceau à minuit jusqu'à 10 min, et la fiche affichait « signal inconnu : copie jusqu'à la fin de la régate ». Le scénario `gel` prenait la première copie quelle qu'elle soit et attendait donc `signal === 'manche'` à tort (obtenu « inconnu », attendu « manche »). Le sceau lui-même restait juste (il relit la régate au signal).
- **Fix:** `freezeAction` rend `'gel'` dès que le `sealAt` du résumé diffère du sceau courant (manche ajoutée, heure corrigée, IC validées) ; le scénario attend la copie portant le signal de la manche. Pas de boucle : après la copie, `sealAt` est égal. Les résumés de test sans `sealAt` ne sont pas touchés.
- **Files modified:** `js/gel.js`, `tests/gel.test.mjs` (test de décision, rouge avant le correctif), `tools/regate-e2e.mjs`
- **Verification:** `node --test tests/gel.test.mjs` (27 tests, le nouveau était rouge avant le correctif) ; 6 exécutions isolées du scénario `gel` OK ; série complète 10/10
- **Commit:** `3f2a7c3`

**2. [Rule 3 - Blocking] Release à refaire après un correctif de contenu**
- **Found during:** Task 2
- **Issue:** `npm run release` avait déjà été lancé (hachage `693b39adb2`) quand le correctif du gel a changé le contenu ; la porte `RT_STRICT=1` aurait refusé « contenu modifié sans release ».
- **Fix:** retour des trois fichiers générés non commités (`git checkout -- release.json js/version.js sw.js`), correctif commité, toutes les vérifications refaites, puis nouvelle release (v28, hachage `4c27d9cd22`). Aucun numéro de version n'a été publié ni sauté (n = 28 une seule fois).
- **Files modified:** `release.json`, `sw.js`, `js/version.js`
- **Commit:** `f2f8994`

**3. [Interprétation du plan] Le test « semis » comparait à js/events.js**
- **Found during:** Task 1
- **Issue:** `tests/regates.test.mjs` importait `currentEvent` de js/events.js pour comparer la forme de l'IC semée ; l'exigence « retirer les fonctions d'état » le casse.
- **Fix:** comparaison aux constantes de `js/courses.js` (sources de l'ancienne fiche) ; l'ancienne fiche se contentait de les recopier.
- **Files modified:** `tests/regates.test.mjs`
- **Commit:** `33aef34`

**4. [Rule 2 - Missing critical] Diagnostic des échecs de l'outil de bout en bout**
- **Found during:** Task 2 (l'échec intermittent n'indiquait que « Expected values to be strictly equal »)
- **Fix:** la ligne `ÉCHEC` ajoute obtenu, attendu et la ligne de `tools/regate-e2e.mjs`. C'est ce qui a permis de trouver la cause du point 1.
- **Files modified:** `tools/regate-e2e.mjs`
- **Commit:** `f07d8ae`

---

**Total deviations:** 4 (1 bug corrigé, 1 blocage de procédure, 1 interprétation, 1 outil de diagnostic)
**Impact on plan:** aucune extension de périmètre ; le correctif du gel est petit, testé, et rend la fiche juste dans le cas réel « régate créée le matin même ».

## Issues Encountered

- **Échec intermittent du scénario `gel`** : 2 des 8 séries complètes ont échoué (même scénario, même assertion `signal`, obtenu « inconnu », attendu « manche »). Avant le diagnostic, il n'était pas reproductible en exécution isolée (4/4) ni en parallèle (9/9) ; la deuxième occurrence, avec l'outil de diagnostic, a donné la cause, corrigée (déviation 1). Après le correctif : 6/6 exécutions isolées et série complète finale 10/10. Les séries qui ont échoué n'ont pas servi de feu vert : toutes les sorties collées ci-dessus viennent de la série faite après le correctif.
- **Statut Vercel de l'aperçu non confirmé** : après plus de 13 minutes, `gh api repos/romaindetroyat/rade-tactique/commits/f2f8994368120600236492753d4ffe9a4fe6f853/status` répond `state: pending` avec zéro statut et zéro check-run (pour comparaison, le commit `789538f`, poussé plus tôt, montre « Vercel : success »). Ce plan n'a ni accès au tableau de bord Vercel ni moyen de forcer un déploiement ; il ne contourne rien. À vérifier par Romain ou l'orchestrateur dans le tableau de bord Vercel (le build de la branche passe par `npm ci` puis `npm run gate`, que `RT_STRICT=1 npm run gate` a réussi en local) ; si le déploiement est en échec, c'est un blocage de la recette, pas de la production.
- La clé `rade.events.v1` n'est plus lue que par la reprise de `js/regates.js` (jamais écrite ni effacée), ce que le scénario `creer` continue de vérifier.

## Contrôles humains reportés (non bloquants pour l'exécution, bloquants pour la mise en production)

- **Tâche 1** : Romain relit sur iPhone le guide (Régates, Relire les IC, Vent du jour, Après la course) et l'aide de l'onglet. Attendu : texte clair pour un équipier qui n'a jamais vu ces écrans ; libellés identiques à ceux de l'app ; aucun code d'accès ni empreinte.
- **Tâche 2** : recette de la phase sur l'aperçu (voir « Rappel pour Romain »), puis décision de mise en production.

## Known Stubs

Aucun.

## Threat Flags

Aucune nouvelle surface : pas de point d'entrée réseau, de chemin d'authentification ni de schéma ajouté. T-03-18 : le plan s'arrête à l'aperçu, `main` inchangé (`f80c365`), aucune vérification sautée ni publiée en échec ; T-03-19 : note validée par `validateNote`, aucune chaîne hexadécimale de 64 caractères ni code d'accès dans le guide, l'aide, l'outil ou ce rapport ; T-03-20 : exports de js/events.js contrôlés exactement, `npm run check` et dix scénarios de bout en bout verts avant la release ; T-03-SC : aucune installation de paquet.

## User Setup Required

Aucun service externe à configurer.

## Next Phase Readiness

- Prêt pour 03-06 et 03-07 (v29 : lecture IA d'un autre club, bouées à confirmer). REG-03 et REG-04 restent à fermer par ces plans ; ARCH-01 et ARCH-03 sont de la phase 4.
- Rien d'arrêtant côté code. À suivre : statut de l'aperçu Vercel de la v28 (voir « Issues Encountered »).

## Self-Check: PASSED

- Fichiers présents : `index.html`, `js/help.js`, `guide.html`, `js/events.js`, `js/gel.js`, `tests/racelock.test.mjs`, `tests/regates.test.mjs`, `tests/gel.test.mjs`, `tools/regate-e2e.mjs`, `release.json`, `sw.js`, `js/version.js`.
- Commits présents sur `apercu-phase-03` : `33aef34`, `f07d8ae`, `3f2a7c3`, `f2f8994` (4 commits mesurés par `git rev-list --count 789538f..HEAD`) ; `f2f8994` est ancêtre de `origin/apercu-phase-03`.
- `main` distant : `f80c365` avant et après le push ; `origin/apercu-phase-03` n'est pas contenue dans `origin/main`.

---
*Phase: 03-ouvrir-une-regate*
*Completed: 2026-10-19*
