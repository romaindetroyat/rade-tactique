---
phase: 02-fiable-et-juste-en-mer
plan: 02
subsystem: diagnostic-voyant
tags: [journal, diagnostic, voyant, gps, wake-lock, web-audio, sonde-reseau, service-worker, node-test, playwright]

requires:
  - phase: 02-fiable-et-juste-en-mer
    provides: "plan 01 : wake.state(), soundState(), chronoAlert(), fixAlert(act), onMiss du beeper, report du Recorder (formes verrouillées)"
provides:
  - "js/diag.js : tampon circulaire borné (300 entrées, 300 caractères, 40 000 octets), répétitions comptées, informations évincées avant les erreurs, secrets retirés, texte à l’heure de Paris"
  - "js/journal.js : journal unique, premier import de js/app.js, gestionnaires error / unhandledrejection, contexte départ / course / app, en-tête de diagnostic (version, iOS, installée, API d’écran et d’audio, stockage persistant)"
  - "Aide › Journal de diagnostic (N) : lire, copier, partager, vider ; texte posé par textContent"
  - "Garde de test « aucune erreur avalée » sur js/app.js, js/track.js, js/startmode.js, js/wakelock.js et js/beeper.js (blocs catch et rappels .catch)"
  - "js/status.js : computeStatus (GPS, écran, son, réseau), libellés courts et actions partagés"
  - "Voyant : quatre lampes dans la barre du haut du mode départ, bande #raceBar en course, sonde réseau HEAD que le worker ne sert pas"
affects: [02-05 guide et recette (version d’iOS relevée par l’en-tête du journal, lecture du voyant), 02-03 ouverture rapide (ne touche pas au voyant)]

actuals:
  tokens: 14998
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Journal local à stockage injecté : une erreur est écrite tout de suite, une information au prochain flush, aucune exception ne sort du journal"
    - "Garde statique par appariement d’accolades et de parenthèses (chaînes, gabarits et commentaires sautés) : tout gestionnaire d’erreur consigne ou explique son repli"
    - "Lampe = fonction pure de ce qui a été observé (point GPS reçu, verrou tenu, horloge audio, réponse HTTP), jamais de l’intention"
    - "Sonde de joignabilité par HEAD de même origine : le worker ne traite que les GET, donc la requête part vraiment sur le réseau"

key-files:
  created:
    - js/diag.js
    - js/journal.js
    - js/status.js
    - tests/diag.test.mjs
    - tests/status.test.mjs
    - .planning/phases/02-fiable-et-juste-en-mer/02-02-red-evidence.json
  modified:
    - js/app.js
    - js/help.js
    - js/startmode.js
    - js/wakelock.js
    - styles.css
    - tests/sw.test.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "Le réseau est orange au plus : net.online suit le résultat de la sonde (HEAD), pas navigator.onLine ; une sonde sans réponse passe la lampe à l’orange tout de suite au lieu d’attendre 10 minutes"
  - "Le conseil de la lampe ÉCRAN tient en une ligne (« non maintenu, verrouillage auto sur « Jamais » ») ; le nom exact de l’erreur du navigateur va au journal, pas à l’écran"
  - "Mode départ : les quatre lampes occupent une seconde ligne de la barre du haut (la colonne « auto » de la pastille GPS disparaît) ; la ligne d’alerte est compactée pour garder la place des tuiles sur 375 px"
  - "Ligne d’action : lampe touchée (6 s), sinon première lampe rouge, sinon alerte du chrono du plan 01 ; la même logique sert la bande #raceBar"
  - "GPS : l’action d’une lampe rouge relance le suivi à neuf (clearWatch puis watchPosition) ; si le suivi tourne sans être rouge, la lampe touchée n’affiche que son détail"

patterns-established:
  - "Toute nouvelle erreur du chemin départ / course passe par report(où, erreur) ; un repli volontaire porte un commentaire d’au moins 8 caractères, sinon la garde échoue avec fichier:ligne"
  - "Tâche TDD du plan : squelette + tests (RED validé par gsd-tools check tdd-red-evidence), puis implémentation (GREEN), puis câblage"

requirements-completed: [FIAB-05, FIAB-07]

plan_head_before: 6460882cd60810bc23df339d160f8abd86710e60
plan_head_after: 0768bbc026b710230f99ed367f82e5b1dc88fe17

coverage:
  - id: D1
    description: "Toute erreur du mode départ et du mode course (page, promesse, GPS, son, écran, trace, IndexedDB, compas, débrief) est consignée avec l’heure de Paris et son contexte (départ, course ou app) ; plus aucun gestionnaire d’erreur vide ou sans trace dans les cinq fichiers du chemin"
    requirement: FIAB-07
    verification:
      - kind: unit
        ref: "tests/diag.test.mjs (23 tests : plafond, persistance, évincement, répétitions, quota, stockage illisible, heure de Paris, contexte, import sous Node, gardes « aucune erreur avalée » par fichier et test de l’outil de garde)"
        status: pass
      - kind: e2e
        ref: "essai Chromium sur l’app réelle (hors dépôt) : erreur de page et promesse rejetée consignées avec ?acces=… nettoyé, lues dans Aide › Journal"
        status: pass
    human_judgment: true
    rationale: "Erreurs réelles d’iOS (localisation refusée, mode avion, écran verrouillé 30 s) et presse-papiers / partage de l’iPhone : non simulables ici"
  - id: D2
    description: "Après une sortie, l’équipier ouvre Aide › Journal de diagnostic, lit l’en-tête (version de l’app, iOS, installée ou non, API de verrou d’écran et de session audio) et les entrées, les copie, les partage ou les vide ; aucun code d’accès, cookie, adresse e-mail ni position n’y figure"
    requirement: FIAB-07
    verification:
      - kind: unit
        ref: "tests/diag.test.mjs#en-tête ; #garde : journal.js ne lit ni les cookies ni l’adresse de la page ; #garde : le journal est lu en texte, jamais posé en HTML ; #secrets"
        status: pass
      - kind: e2e
        ref: "essai Chromium : bouton « Journal de diagnostic », en-tête et deux entrées horodatées, stockage rade.diag.v1 écrit"
        status: pass
    human_judgment: true
    rationale: "Copier et Partager sur un vrai iPhone ; version d’iOS réelle de l’équipage (D-05, Open Question 13)"
  - id: D3
    description: "Le journal reste borné (300 entrées, 40 000 octets), compte les répétitions, garde les erreurs plus longtemps que les informations et survit à un rechargement"
    requirement: FIAB-07
    verification:
      - kind: unit
        ref: "tests/diag.test.mjs#plafond ; #octets ; #plein : les informations partent avant les erreurs ; #répétition ; #persistance ; #quota dépassé"
        status: pass
    human_judgment: false
  - id: D4
    description: "En mode départ et en course, quatre lampes permanentes (GPS avec l’âge du dernier point, écran maintenu, son, réseau) passent au rouge dès qu’un élément lâche (GPS muet plus de 10 s, écran non tenu en course, son coupé ou pas entendu) avec une ligne d’action ; le réseau n’est jamais rouge ; hors course, rien n’est affiché"
    requirement: FIAB-05
    verification:
      - kind: unit
        ref: "tests/status.test.mjs (21 tests : seuils 4 s / 10 s / 15 m, écran, son, réseau jamais rouge, worst, actions, libellés)"
        status: pass
      - kind: e2e
        ref: "essai Chromium 375 px : lampes du mode départ (GPS 2 s vert puis « muet depuis 17 s » rouge, ÉCRAN rouge avec le conseil, SON orange, RÉSEAU vert), toucher d’une lampe, relance du GPS par l’alerte (retour à « GPS 2 s »), bande #raceBar après fermeture du mode départ, masquée une fois le GPS arrêté"
        status: pass
    human_judgment: true
    rationale: "GPS, verrou d’écran et mise en veille réels de l’iPhone ; cadence du GPS (hypothèse A11) et lisibilité des lampes en plein soleil à juger par un équipier"
  - id: D5
    description: "La lampe réseau ne peut pas mentir : la sonde est un HEAD de même origine que le service worker ne sert pas (le GET du même fichier serait servi par le cache et dirait « réseau ok » en mode avion)"
    requirement: FIAB-05
    verification:
      - kind: unit
        ref: "tests/sw.test.mjs#sonde réseau : HEAD /icons/favicon-32.png n’est pas intercepté (contre-épreuve : le GET est servi par le cache) ; #GET /api/_ping ; #garde : la sonde de js/app.js"
        status: pass
      - kind: e2e
        ref: "essai Chromium : réseau coupé puis rétabli, RÉSEAU orange (jamais rouge) puis vert"
        status: pass
    human_judgment: true
    rationale: "Mode avion réel d’un iPhone en app installée (le simulateur de réseau de Chromium ne coupe pas les requêtes émises par le worker lui-même)"

duration: 20 min
completed: 2026-10-19
status: complete
---

# Phase 2 Plan 02 : Journal de diagnostic et voyant Summary

**Journal local borné et sans secret (300 entrées, 40 000 octets, heure de Paris, contexte départ / course) lisible et copiable dans Aide, avec une garde de test qui interdit tout gestionnaire d’erreur muet dans les cinq fichiers du chemin, et voyant à quatre lampes GPS / écran / son / réseau en mode départ et en course dont la lampe réseau passe par une sonde HEAD que le worker ne sert pas.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-19T16:00:00Z (approximatif : le registre des commits est posé à 16:01:39Z)
- **Completed:** 2026-10-19T16:20:00Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 14 (6 créés, dont la preuve RED ; 8 modifiés)

## Accomplishments

- **FIAB-07** : `js/diag.js` (pur, stockage injecté) et `js/journal.js` (singleton, premier import de `js/app.js`). Une erreur est écrite à l’instant, une information au prochain flush (toutes les 10 s, page masquée, `pagehide`) ; plein, les informations partent avant les erreurs ; une répétition identique incrémente un compteur ; quota dépassé ou stockage illisible : aucune exception. `scrub()` retire `?acces=…`, tout jeton de 32 caractères et plus, et les adresses e-mail ; le module ne lit ni cookies ni adresse de la page ni position (gardes de test).
- Erreurs consignées sans rien changer pour l’équipier : son (`audioInit`, `resume`), GPS (le code d’erreur est désormais conservé : `gps.err = e.code`, `gps.errMsg`), ping Comité / bouée, compas, traces (IndexedDB, via `Recorder.report`), débrief, import GPX, lecture des IC, polaire personnelle, démarrage ; en information : page masquée / visible, état du contexte audio, bips manqués (`onMiss`), verrou d’écran libéré ou refusé, réseau, silence du GPS, passages d’une lampe au rouge.
- **Aide › Journal de diagnostic (N)** : fenêtre avec l’en-tête (version de l’app, iOS, installée oui / non, API de verrou d’écran et de session audio, stockage persistant, date de la copie à l’heure de Paris), les entrées, et Copier (Clipboard, repli sélection + `execCommand`), Partager (si `navigator.share`), Vider (deux touchers). Texte posé par `textContent` ; le `<pre>` est créé vide.
- **Garde « aucune erreur avalée »** : un repérage par appariement d’accolades et de parenthèses (chaînes, gabarits et commentaires sautés) trouve chaque `catch` et chaque `.catch(` des cinq fichiers ; conforme = `report(` / `note(` ou un commentaire de 8 caractères et plus. Premier passage : 9 manquements dans `js/app.js`, 2 dans `js/startmode.js`, 1 dans `js/wakelock.js`, tous traités. Un test vérifie l’outil de garde lui-même (gestionnaire vide, `return null`, simple toast refusés).
- **FIAB-05** : `js/status.js` `computeStatus` (GPS : orange au-delà de 4 s ou de ±15 m, rouge au-delà de 10 s depuis la RÉCEPTION du dernier point, rouge « refusé » avec le chemin des Réglages pour le code 1 ; écran : verrou réellement tenu, rouge seulement quand le chrono, le mode départ, la trace ou le GPS en dépendent ; son : rouge si le contexte n’est pas actif, si l’horloge est figée ou si le test n’a pas été entendu, orange si non testé ; réseau : orange au plus).
- **Rendu** : mode départ, quatre lampes sur une seconde ligne de la barre du haut (« GPS 2 s », « ÉCRAN », « SON », « RÉSEAU ») ; toucher une lampe affiche son détail dans `#smAlert` ; en course, bande `#raceBar` au même endroit que `#updbar`, rafraîchie chaque seconde et sur événement, masquée hors course ; rouge pulsé à 1 Hz (désactivé en `prefers-reduced-motion`), aucun son.
- **Sonde réseau** : `HEAD icons/favicon-32.png?p=<t>` (`cache: 'no-store'`, abandon à 4 s), toutes les 30 s tant que le voyant est visible, au retour de visibilité et sur `online` ; `tests/sw.test.mjs` prouve que le worker ne l’intercepte pas, avec la contre-épreuve du GET servi par le cache.

## Task Commits

1. **Task 1 (tracer) : journal de diagnostic de bout en bout** - `c4bf917` (feat) ; tracer vérifié (⚡ `npm run check` vert, 94 tests, essai Chromium) avant d’étendre
2. **Task 2 (TDD) : voyant permanent** - RED `c25816b` (test, preuve `RED_EVIDENCE_OK`), GREEN `abb17ab` (feat `computeStatus`), câblage `0768bbc` (feat : collecte, sonde, lampes, bande, styles, tests du worker)

**Plan metadata :** commit `docs(02-02)` suivant ce fichier.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Statut |
|------|-----|-------|----------|--------|
| 02-02 task 2 | `c25816b` `test(02-02)` | `abb17ab` `feat(02-02)` | sans objet (le câblage `0768bbc` ajoute `lampLabel` / `actionLabel` et leurs tests) | conforme |

RED : `tests/status.test.mjs` (20 tests) contre un squelette de `computeStatus` sans comportement ; cible « GPS : dernier point reçu il y a 12 s → rouge », échec d’assertion (la lampe n’existe pas). Preuve `.planning/phases/02-fiable-et-juste-en-mer/02-02-red-evidence.json`, `gsd-tools check tdd-red-evidence` : `RED_EVIDENCE_OK` (TAP, 20 tests, 18 échecs d’assertion, aucun échec d’import ni de syntaxe). Deux tests passaient dès le RED (constantes ; « le réseau n’est jamais rouge » : une liste de lampes vide ne le contredit pas) ; les 18 autres échouaient pour la même cause, le calcul n’existait pas.

## Files Created/Modified

- `js/diag.js`, `js/journal.js` : journal (module pur et singleton)
- `js/status.js` : `computeStatus`, seuils, `lampLabel`, `actionLabel`
- `js/app.js` : import du journal en première ligne, contexte, consignations, collecte du voyant (`statusNow`, `statusView`, `probeNet`, `fixLamp`, `gpsSilence`, `renderRaceBar`, `lampTick`)
- `js/help.js` : `openJournal`
- `js/startmode.js` : lampes `.sm-lamps`, ligne d’action unifiée, `report('compas')`
- `js/wakelock.js` : commentaire de repli sur la libération déjà faite
- `styles.css` : `.lamp`, `#raceBar`, `.rb-alert`, `.sm-lamps`, `#modal.journal`
- `tests/diag.test.mjs` (23 tests), `tests/status.test.mjs` (21), `tests/sw.test.mjs` (+3)
- `sw.js`, `js/version.js` : générés par `npm run stamp` (`js/diag.js`, `js/journal.js`, `js/status.js` entrent dans la liste hors réseau) ; version affichée inchangée (v26), aucune publication

## Decisions Made

Voir `key-decisions` : lampe réseau suivie par la sonde, conseil d’écran en une ligne, lampes sur une seconde ligne du mode départ, ligne d’action à trois niveaux de priorité, relance du GPS à neuf.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] La lampe réseau suit le résultat de la sonde, pas seulement `navigator.onLine`**
- **Found during:** Task 2
- **Issue :** avec le calcul de la recherche, une sonde sans réponse alors que `navigator.onLine` reste vrai (réseau captif, Wi-Fi sans sortie) laissait la lampe verte jusqu’à 10 minutes : exactement le mensonge que la sonde doit éviter.
- **Fix :** `net.online` prend la valeur du résultat de la sonde (vrai sur toute réponse HTTP, faux sur échec ou abandon à 4 s) ; la lampe passe à l’orange tout de suite (jamais au rouge) ; un changement d’état est consigné.
- **Files modified :** `js/app.js`
- **Commit :** `0768bbc`

**2. [Rule 2 - Missing critical] Lampe GPS rouge « éteint : touchez pour l’activer » quand le GPS est nécessaire mais arrêté**
- **Found during:** Task 2 (écriture des tests)
- **Issue :** dans le calcul de la recherche, un GPS requis (mode départ, trace) mais arrêté tombait sur « recherche… » en orange, sans action.
- **Fix :** rouge avec l’action `gps` (relance). Test ajouté.
- **Files modified :** `js/status.js`, `tests/status.test.mjs`
- **Commit :** `abb17ab`

**3. [Rule 1 - Bug] `gps.err` jamais effacé après une erreur passagère**
- **Found during :** Task 1 (passage du code d’erreur au journal)
- **Issue :** une erreur de délai (code 3) restait affichée (« Erreur : … ») dans l’onglet En course après le retour des points, et aurait faussé la lampe.
- **Fix :** `gps.err` et `gps.errMsg` remis à `null` à chaque point reçu.
- **Files modified :** `js/app.js`
- **Commit :** `c4bf917`

**4. [Rule 2 - Missing critical] Consignations en plus de celles listées au plan**
- **Found during :** Task 1 (la garde a relevé 12 gestionnaires)
- **Issue :** outre ceux du plan, la garde a signalé la lecture de `localStorage` (`store.get`), la polaire personnelle, le repli météo hors réseau, la dictée vocale, le `resume()` du contexte audio, le ping GPS du mode départ, la lecture des IC, l’import GPX et la libération du verrou d’écran.
- **Fix :** `report` pour les vraies erreurs (polaire, son, ping GPS, import, IC, traces, débrief, démarrage), `note` pour les replis attendus (météo hors réseau, dictée indisponible), commentaire de repli pour `store.get` et `wakelock.js`.
- **Files modified :** `js/app.js`, `js/startmode.js`, `js/wakelock.js`
- **Commit :** `c4bf917`

**5. [Rule 3 - Blocking layout] Place des lampes sur 375 px**
- **Found during :** Task 2 (essai Chromium à 375 px)
- **Issue :** quatre lampes ne tiennent pas sur la ligne de la barre du haut avec ✕, Chiffres / Ligne, 🔒 et ⚙ ; une alerte de trois lignes écrasait la tuile « Ligne ».
- **Fix :** lampes sur une seconde ligne de `.sm-top` (colonne `auto` de l’ancienne pastille retirée), alerte compactée (15 px, 44 px), conseil d’écran en une ligne ; bande `#raceBar` portée à `calc(100vw - 12px)` pour que les quatre lampes restent sur une ligne.
- **Files modified :** `styles.css`, `js/status.js`, `tests/status.test.mjs`
- **Commit :** `0768bbc`

**6. [Rule 3 - Process] Les cas de la sonde dans `tests/sw.test.mjs` arrivent avec le câblage**
- Le plan les range sous la tâche 2 sans les distinguer du RED ; ils passaient d’emblée (le worker ignore déjà les requêtes non GET et `/api/`) et le troisième (garde sur `js/app.js`) dépend du câblage : ils sont dans le commit `0768bbc`, pas dans le RED.

**Total deviations :** 6 (1 bug, 3 fonctions critiques manquantes, 2 de processus ou de mise en page). **Impact :** aucun changement de périmètre ; la lampe réseau est plus stricte que dans la recherche, la lampe GPS gagne un cas.

## Authentication Gates

Aucune.

## Known Stubs

Aucun. Les rappels `report` du `Recorder` et `onMiss` du beeper, laissés sans destinataire par le plan 01, sont maintenant branchés sur le journal.

## Issues Encountered

- Open-Meteo répond HTTP 429 depuis le réseau de mesure : le journal de l’essai Chromium a consigné « prévisions indisponibles » (information `meteo`), c’est le repli hors réseau qui fonctionne.
- Chromium sans interface refuse le verrou d’écran (`NotAllowedError`) : la lampe ÉCRAN est donc rouge pendant tous les essais, ce qui a servi à vérifier le conseil et l’action « Réessayer ».
- `git status` propre à la fin, rien de poussé.

## Verification (plan)

- `npm run check` : vert, 118 tests (71 avant ce plan, +23 diag, +21 status, +3 sw ; la référence SNPM, 5 tests, est inchangée), `stamp à jour`.
- `tests/diag.test.mjs` 23 / 23, `tests/status.test.mjs` 21 / 21, `tests/sw.test.mjs` 10 / 10.
- Critères d’acceptation rejoués : `report('compas'` 1, `from './journal.js'` dans `js/startmode.js` 1, premier import de `js/app.js` = journal, `report(` 12 dans `js/app.js`, `openJournal` 3, `diagText` 2, `computeStatus(` 1, `method: 'HEAD'` 1, `raceBar` 3, `sm-lamps` 1.
- `js/journal.js` est le premier import de `js/app.js` ; aucun gestionnaire d’erreur muet dans les cinq fichiers (garde) ; voyant affiché en mode départ et en course seulement ; réseau jamais rouge ; sonde non servie par le worker (test et contre-épreuve).
- Essais Chromium de l’app réelle (hors dépôt, 375 × 700) : journal (erreurs de page et de promesse avec `?acces=` nettoyé, en-tête), lampes du mode départ et de la bande en course, silence du GPS (« muet depuis 17 s » puis retour après relance), réseau coupé et rétabli (orange puis vert), bande masquée GPS arrêté.

## Restes pour le vérificateur de fin de phase (`<human-check>` non exécutés ici)

1. **Tâche 1** : iPhone (Safari puis app installée) : mode départ, refuser puis réautoriser la localisation, mode avion, écran verrouillé 30 s pendant un compte à rebours ; Aide › Journal de diagnostic : lire, Copier (coller dans Messages), Partager ; relancer l’app et rouvrir le journal. Relever dans l’en-tête la version d’iOS et « app installée » des trois iPhone (D-05).
2. **Tâche 2** : iPhone, app installée : GPS actif dans le mode départ, verrouiller l’écran 20 s (GPS rouge puis vert), mode avion (RÉSEAU orange, jamais rouge), bouton silencieux + « Tester le son » → « Non » (SON rouge), verrouillage auto à 30 s (ÉCRAN rouge avec le conseil), lisibilité en « Plein soleil », fermer le mode départ avec GPS et trace actifs (bande en course), tout arrêter (bande masquée). Seuils 4 s / 10 s à ajuster après la recette (hypothèse A11).

## Threat Flags

Aucun : la sonde est un HEAD de même origine sur un fichier public (déjà couverte par T-02-08), le journal n’envoie rien et reste sur l’appareil (T-02-09, acceptée), `rade.diag.v1` est la seule donnée locale nouvelle. Aucun secret lu ni écrit ; les hachages du middleware n’ont été copiés nulle part.

## Next Phase Readiness

Prêt pour les plans suivants de la phase 2 : le journal reçoit déjà les erreurs de tout module qui appelle `report` ; le guide (plan 05) peut renvoyer l’équipage vers Aide › Journal de diagnostic et décrire les quatre lampes. Les identifiants FIAB-05 et FIAB-07 restent déclarés par le plan 05 : leur case ne se coche qu’à la fin du dernier plan qui les déclare.

## Self-Check: PASSED

- Fichiers créés présents : `js/diag.js`, `js/journal.js`, `js/status.js`, `tests/diag.test.mjs`, `tests/status.test.mjs`, registre RED.
- Commits présents : `c4bf917`, `c25816b`, `abb17ab`, `0768bbc` (4 commits, mesurés par `git rev-list --count` depuis le registre posé avant le premier commit).
- Critères d’acceptation des deux tâches rejoués : tous verts ; `npm run check` vert.
