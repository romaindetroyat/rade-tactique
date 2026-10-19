---
phase: 03-ouvrir-une-regate
plan: 02
subsystem: ic
tags: [ic, pdf, relecture, vraisemblance, parseIC, node-test, linkedom, playwright, pwa]

requires:
  - phase: 03-ouvrir-une-regate
    provides: "régate courante (currentRegatta, upsertRegatta, createRegatta), forme r.ic, auteur membre(), escHTML, tools/regate-e2e.mjs"
provides:
  - "js/events.js : cleanText exporté et parseIC enrichi d'extraits `ex` (une phrase du texte nettoyé par valeur lue), champs inchangés sur les IC SNPM"
  - "js/icread.js : relecture champ par champ (valeur, extrait, champ non lu laissé vide), checksFor, canValidate, applyReview sur le geste « Valider les IC », vue HTML échappée"
  - "js/icplaus.js : contrôles de vraisemblance purs (date, dernier jour, heure, ordre des heures, VHF, position)"
  - "Onglet IC : import d'un PDF ou texte d'IC en relecture, puces ✓ / ⚠ / ✕ à côté de chaque valeur, validation refusée tant qu'une valeur impossible n'est pas corrigée ou vidée"
  - "tools/regate-e2e.mjs : scénarios ic et vraisemblance dans Chromium"
affects: [03-05, 03-06, 03-07, phase-04]

actuals:
  tokens: 16855
  tasks: 2
  commits: 3
plan_head_before: 2ac9063d1f08a417084f75c67d62c40a46a45961
plan_head_after: 07ea0666726452e4ea9bad0a94650654b8b8dd26

tech-stack:
  added: []
  patterns:
    - "Relecture = brouillon en mémoire de la page (icDraft) ; une seule écriture, applyReview sur le geste « Valider les IC »"
    - "Extrait tiré par construction du texte déjà nettoyé (cleanText), élargi de 30 caractères sans couper de mot, 260 au plus"
    - "Puces par signe ET couleur (✓ vert, ⚠ orange, ✕ rouge), mises à jour par paintReview sans reconstruire la carte (le curseur reste dans le champ)"
    - "Champs de saisie en texte : une valeur impossible venue d'un lecteur reste affichable pour être signalée"

key-files:
  created:
    - js/icread.js
    - js/icplaus.js
    - tests/icread.test.mjs
    - tests/icplaus.test.mjs
  modified:
    - js/events.js
    - js/app.js
    - tests/pdf.test.mjs
    - tools/regate-e2e.mjs
    - styles.css
    - sw.js
    - js/version.js

key-decisions:
  - "L'import ne fait que fabriquer un brouillon ; applyReview n'est appelé que par « Valider les IC » (garde statique : aucun saveReg, upsertRegatta ni applyReview dans le gestionnaire d'import)"
  - "Un champ non lu reste vide et le dit (« non lu dans le texte ») ; le dernier jour, facultatif, vide reste plausible ; le titre tiré du nom de fichier n'a pas d'extrait"
  - "Une valeur corrigée à la main perd son extrait à la validation (il ne la décrit plus) et la relecture le signale (« valeur modifiée »)"
  - "Le dernier jour de la régate courante est repris dans la relecture (le PDF ne le donne pas) pour qu'une régate de plusieurs jours ne le perde pas"
  - "Changement d'onglet : la relecture ouverte reste en mémoire (rien n'est écrit) ; Annuler ou une relance l'abandonne"
  - "Seuils de la recherche (Open Question 10) : date à plus de 400 jours ou dernier jour à plus de 6 jours = warn ; heure hors 06:00-21:00 = warn ; VHF 16 et 29-59 = warn ; impossible = bad"

patterns-established:
  - "Sortie d'un lecteur figée par un test AVANT toute modification (parseIC sur le texte réel des IC SNPM), puis extension par ajout seulement"
  - "RED d'un module absent : import rattrapé dans le test pour que l'échec porte sur la fonction manquante, remplacé par un import statique au GREEN"

requirements-completed: [REG-03]

coverage:
  - id: D1
    description: "Le PDF des IC CVAT s'importe hors réseau (parseIC) en relecture champ par champ : pour chaque valeur (épreuve, premier jour, 1er signal, limite d'arrivée, VHF, Comité, zone) la phrase du PDF qui l'a produite est affichée à côté"
    requirement: REG-03
    verification:
      - kind: unit
        ref: "tests/pdf.test.mjs#extraits : chaque valeur lue a son extrait, tiré tel quel du texte nettoyé, et qui contient la valeur sous sa forme du texte"
        status: pass
      - kind: unit
        ref: "tests/icread.test.mjs#relecture depuis parseIC d’un texte d’un autre club : une valeur, son extrait, pour chaque champ lu"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs ic"
        status: pass
    human_judgment: true
    rationale: "Sélecteur « Fichiers » d'iOS et lisibilité de la relecture sur un écran de 375 px"
  - id: D2
    description: "Un champ que la lecture n'a pas trouvé reste vide avec « non lu dans le texte » ; il n'est jamais deviné ; l'équipier peut le saisir ou le laisser vide"
    requirement: REG-03
    verification:
      - kind: unit
        ref: "tests/icread.test.mjs#champ non lu : valeur vide et extrait nul (jamais deviné) ; le dernier jour n’est pas lu par les motifs"
        status: pass
      - kind: unit
        ref: "tests/pdf.test.mjs#extraits : ni coupés au milieu d’un mot, ni pour une valeur non lue"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs ic (dernier jour : vide, « non lu dans le texte »)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rien n'entre dans la régate avant « Valider les IC » : Annuler, changement d'onglet et relance n'écrivent rien ; la validation enregistre qui a validé et quand ; règle du dernier jour (D-15)"
    requirement: REG-03
    verification:
      - kind: unit
        ref: "tests/icread.test.mjs#rien n’entre sans validation : la relecture ne touche pas la régate, applyReview rend un objet neuf"
        status: pass
      - kind: unit
        ref: "tests/icread.test.mjs#règle du dernier jour (D-15) : antérieur ou égal ignoré, postérieur gardé"
        status: pass
      - kind: unit
        ref: "tests/icread.test.mjs#garde statique : app.js valide par applyReview sur un geste, n’utilise plus l’ancien formulaire, et n’écrit rien à l’import"
        status: pass
      - kind: e2e
        ref: "tools/regate-e2e.mjs ic (index sans IC après import, changement d'onglet, Annuler et relance ; ic.validated.at posé après validation)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Une puce de vraisemblance à côté de chaque valeur (date, heure, ordre des heures, VHF) ; une valeur impossible empêche la validation jusqu'à correction ou vidage, une valeur inhabituelle n'empêche rien"
    requirement: REG-03
    verification:
      - kind: unit
        ref: "tests/icplaus.test.mjs (11 tests : dates, jour de Paris, dernier jour, heures, ordre, VHF, positions, vrai terrain, messages, module pur)"
        status: pass
      - kind: unit
        ref: "tests/icread.test.mjs#checksFor + canValidate : une valeur impossible bloque la validation jusqu’à sa correction ou son vidage ; une valeur inhabituelle ne bloque rien"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs vraisemblance"
        status: pass
    human_judgment: true
    rationale: "Lisibilité des couleurs et des messages au soleil sur iPhone"
  - id: D5
    description: "Les champs et points clés lus par parseIC sur les IC SNPM ne changent pas ; l'ouverture du PDF reste protégée (isEvalSupported: false)"
    requirement: REG-03
    verification:
      - kind: unit
        ref: "tests/pdf.test.mjs#figé : parseIC sur le texte réel des IC SNPM rend exactement les champs d’avant la phase 3"
        status: pass
      - kind: unit
        ref: "tests/pdf.test.mjs#garde statique : tout appel getDocument( de js/ passe isEvalSupported: false, et PDF_OPTIONS est gelé"
        status: pass
    human_judgment: false
  - id: D6
    description: "Un extrait ou une valeur piégés venus du PDF (balise, guillemet, apostrophe) s'affichent en texte et n'exécutent rien"
    requirement: REG-03
    verification:
      - kind: unit
        ref: "tests/icread.test.mjs#vue : un extrait ou une valeur piégés venus du PDF ne produisent ni script ni img, et se lisent en texte (T-03-06)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 02 : Relecture des IC champ par champ Summary

**Le PDF des IC CVAT s'importe hors réseau en relecture : chaque valeur lue par `parseIC` montre la phrase du PDF qui l'a produite et une puce de vraisemblance (✓ plausible, ⚠ inhabituel, ✕ impossible), un champ illisible reste vide, et rien n'entre dans la régate avant « Valider les IC » qui enregistre qui a validé et quand.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-19T20:25:20Z
- **Completed:** 2026-10-19T20:39:00Z
- **Tasks:** 2 (1 traceur, 1 TDD)
- **Files modified:** 11 (4 créés, 7 modifiés) ; 3 commits de tâche mesurés (`plan_head_before` → `plan_head_after`)

## Accomplishments

- **`parseIC` enrichi sans rien changer (D-03)** : `cleanText` est exporté, `parseIC` suit l'indice de chaque expression et ajoute `f.ex` (extrait par valeur : le segment trouvé, élargi d'au plus 30 caractères sans couper de mot, 260 au plus, tiré du texte déjà nettoyé donc vérifié par construction). Les expressions et les champs actuels ne bougent pas ; le titre tiré du nom de fichier n'a pas d'extrait ; l'extrait du Comité choisit la mention du nom la plus proche du téléphone.
- **Relecture champ par champ (`js/icread.js`)** : une seule forme de relecture pour les futurs lecteurs (plan 06), valeur + extrait + puce par champ, points clés cochables, « Valider les IC » et « Annuler ». `applyReview` rend une régate neuve (la régate d'origine n'est jamais modifiée), garde les champs que la relecture ne porte pas (pavillons, séquence), applique la règle du dernier jour (D-15) et pose `validated: { by, at }`.
- **Rien sans validation (D-02, T-03-07)** : l'import fabrique un brouillon en mémoire de la page ; une garde statique vérifie que le gestionnaire d'import n'appelle ni `saveReg`, ni `upsertRegatta`, ni `applyReview` ; le scénario `ic` constate l'index sans IC après l'import, après un changement d'onglet, après « Annuler » et après une relance. Sans régate courante, la validation crée d'abord la régate depuis les champs relus.
- **Vraisemblance (`js/icplaus.js`, D-02, T-03-09)** : date impossible (30 février) = ✕, à plus de 400 jours = ⚠ (jour de Paris) ; dernier jour impossible = ✕, antérieur ou égal = ⚠ « ignoré », à plus de 6 jours = ⚠ ; heure impossible = ✕, hors 06:00-21:00 = ⚠ ; limite d'arrivée avant le premier signal = ⚠ ; VHF 1 à 88 (la chaîne « 72 » est convertie avant le contrôle, « 7 2 » est ✕), 16 et 29-59 = ⚠ ; `checkPos` (bornes de `data/meta.json` = ✕, sur terre = ⚠) écrite et testée sur le vrai terrain pour les bouées du plan 07 (les 11 marques CVAT sont toutes plausibles).
- **Mise à jour sans reconstruire la carte** : `paintReview` change les puces, la mention « valeur modifiée » et l'état du bouton à chaque saisie ; le scénario `vraisemblance` vérifie que le focus reste dans le champ.
- **Outil de bout en bout** : scénarios `ic` (import réel du PDF SNPM par pdf.js dans Chromium, extraits « 10h55 » et « 72 », Annuler, relance, validation, rechargement) et `vraisemblance` (99 rouge et bouton désactivé, 72 réactivé, 03:30 orange, 25:00 désactivé, 7 2, 16, 30 février).

## Task Commits

1. **Task 1 : relecture des IC CVAT champ par champ, extrait d'origine, rien retenu avant validation (tracer)** - `afd3ffd` (feat)
2. **Task 2 : puces de vraisemblance, une valeur impossible bloque la validation** - RED `d24ccd5` (test), GREEN `07ea066` (feat)

**Plan metadata:** commit `docs(03-02)` suivant (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Tracer feedback gate

Mode `yolo` (« continue sans t'arrêter », pas de point d'arrêt humain) : après le commit du traceur, la vérification automatisée a été relancée de bout en bout (tests `pdf` et `icread`, `node --check`, `npm run check` 204 tests, `PW_REQUIRED=1 node tools/regate-e2e.mjs ic` : OK). ⚡ Tracer verified end-to-end — expanding.

## TDD Gate Compliance

- **Sortie de `parseIC` figée AVANT toute modification** : le test « figé : parseIC sur le texte réel des IC SNPM… » (event, date, firstWarning, lastFinishSignal, vhf, Comité, zone, 18 points clés, deux premiers points) a été écrit puis lancé sur le code d'avant : 5 tests verts (`# pass 5`, `# fail 0`) ; il l'est resté après l'ajout de `f.ex` (7 tests verts, puis 20 avec `icread`). Il est livré dans le même commit que la modification (`afd3ffd`).
- **Task 2 RED** (`d24ccd5`) : 11 tests de `tests/icplaus.test.mjs` et 7 de `checksFor` échouent (18 échecs). `gsd_run check tdd-red-evidence` : `RED_EVIDENCE_OK` (`target_test_failed`, cible « checkVhf : 72 plausible, 16 et 45 en alerte, 99 et la chaîne « 72 » impossibles »). Évaluation sémantique : la cible s'exécute (import de `js/icplaus.js` rattrapé dans le test, fonctions lues par espace de noms `P.`) et échoue parce que la fonction n'existe pas encore (`P.checkVhf is not a function`), pas par une erreur de chargement. Le fichier d'évidence temporaire a été supprimé après classement.
- **Task 2 GREEN** (`07ea066`) : `js/icplaus.js` et `checksFor` ; l'import rattrapé est remplacé par un import statique dans le même commit ; 31 tests verts (`icplaus` 11, `icread` 20).
- Pas de REFACTOR : aucun nettoyage nécessaire.
- Le commit RED laisse volontairement `npm run check` rouge à ce point de l'historique.

## Résultats de vérification

- `npm run check` : stamp à jour, **222 tests, 0 échec** (188 en début de plan : +3 dans `pdf`, +13 dans `icread` après la tâche 1 = 204 ; +11 dans `icplaus`, +7 dans `icread` après la tâche 2).
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` : sortie 0 (référence SNPM et `js/courses.js` inchangés).
- Critères d'acceptation relancés : `grep -c "applyReview(" js/app.js` = 1, `grep -c "export function cleanText" js/events.js` = 1, `grep -c "checksFor(" js/app.js` = 1 ; `icplaus.test.mjs` : 11 tests (≥ 10) ; aucune chaîne hexadécimale de 64 caractères dans les tests, l'outil ni les modules.
- Sortie de l'outil de bout en bout, tous scénarios (plans 01 et 02) :
  ```
  OK creer
  OK manche
  OK auteur
  OK ic
  OK vraisemblance
  Bilan : 5/5 scénario(s) OK
  ```
  sortie 0 ; `PW_REQUIRED=1 node tools/regate-e2e.mjs ic vraisemblance` : 2/2 OK.
- Ouverture inchangée : `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : médiane de l'interface utile **577 ms** (< 2000 ms ; 628 ms au plan 01), `tests/boot.test.mjs` vert.
- Version affichée toujours v27 : la publication v28 est au plan 07 (`npm run stamp` fait après chaque tâche).

## Files Created/Modified

- `js/icread.js` - relecture : champs, extraits, `checksFor`, `canValidate`, `applyReview`, `reviewHTML`, `chipOf`, `validatedHTML` (pur)
- `js/icplaus.js` - contrôles de vraisemblance purs (`BOUNDS`, `checkDate`, `checkDateEnd`, `checkTime`, `checkSeq`, `checkVhf`, `checkPos`)
- `tests/icread.test.mjs` - 20 tests : relecture depuis un texte SNPM-like d'un autre club, non lu, validation, D-15, vue sans injection, puces, gardes statiques
- `tests/icplaus.test.mjs` - 11 tests : seuils, jour de Paris, bornes de `meta.json`, vrai terrain et 11 marques CVAT
- `js/events.js` - `cleanText` exporté, `parseIC` avec `ex` ; `pdfText`, `PDF_OPTIONS` et l'ancien formulaire inchangés
- `js/app.js` - import → relecture, `icChecks`, `paintReview`, `validateIC`, carte « Instructions de course » avec la ligne « IC validées par … » ; l'ancien formulaire n'est plus appelé
- `tests/pdf.test.mjs` - test figé de `parseIC` et deux tests d'extraits
- `tools/regate-e2e.mjs` - scénarios `ic` et `vraisemblance`
- `styles.css` - relecture (`.icf`, `.icex`, `#icBlock`, boutons désactivés)
- `sw.js`, `js/version.js` - générés par `npm run stamp` (nouveaux modules dans la liste hors réseau)

## Decisions Made

- Le brouillon de relecture ne vit qu'en mémoire de la page : l'écriture unique est `applyReview` sur « Valider les IC » (T-03-07).
- `applyReview` ne juge pas les valeurs : la garde « impossible » est `canValidate` sur le geste de validation ; la fonction d'application reste pure et testable.
- Un champ vide est « non lu dans le texte » (⚠) quand la lecture est par motifs, « valeur vide » en saisie à la main ou en reprise ; le dernier jour vide est plausible (régate d'un jour).
- La date de début vidée ne retire pas son jour à la régate ; un nom vidé garde le nom de la régate (comme l'ancien formulaire).
- Un changement d'onglet laisse la relecture ouverte en mémoire (rien n'est écrit) : l'équipier qui va regarder un parcours ne perd pas sa relecture ; « Annuler » et une relance l'abandonnent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Le dernier jour d'une régate de plusieurs jours aurait été effacé par un import**
- **Found during:** Task 1 (écriture de `applyReview`)
- **Issue:** le PDF ne donne pas le dernier jour ; une relecture vide à cet endroit aurait effacé le dernier jour d'une régate de plusieurs jours (l'ancien formulaire le faisait aussi), ce qui fausse le verrou « journée de régate ».
- **Fix:** `reviewFromParse(p, { source, text, regatta })` reprend le dernier jour de la régate courante, sans extrait ; l'équipier le voit et peut le changer ou le vider.
- **Files modified:** `js/icread.js`, `js/app.js`
- **Verification:** `tests/icread.test.mjs#le dernier jour de la régate courante est repris`
- **Commit:** `afd3ffd`

**2. [Rule 2 - Missing critical] Un extrait ne décrit plus une valeur corrigée à la main**
- **Found during:** Task 1 (conception de la relecture)
- **Issue:** garder l'extrait d'origine à côté d'une valeur modifiée l'aurait fait passer pour une valeur lue (D-01 par analogie : rien de deviné présenté comme lu).
- **Fix:** `setValue` marque `edited` ; l'extrait n'est pas enregistré pour un champ modifié et la relecture affiche « valeur modifiée » (mise à jour en direct par `paintReview` à la tâche 2).
- **Files modified:** `js/icread.js`, `js/app.js`
- **Verification:** `tests/icread.test.mjs#applyReview n’écrit que les champs validés…` et scénario `ic` (`zone` corrigée sans extrait enregistré)
- **Commit:** `afd3ffd`, `07ea066`

**3. [Interprétation du plan] Le dernier jour vide n'est pas en alerte ; le titre tiré du nom de fichier n'a pas d'extrait**
- **Found during:** Tasks 1 et 2
- **Issue:** le plan dit « valeur vide → warn non lu dans le texte » ; pour le dernier jour, facultatif, une alerte permanente serait du bruit sur chaque régate d'un jour. Le titre de repli (nom du fichier) n'est pas lu dans le texte.
- **Fix:** dernier jour vide = plausible ; titre de repli sans extrait, signalé « Sans extrait du texte (nom du fichier, fiche ou saisie à la main) ».
- **Files modified:** `js/icread.js`
- **Verification:** `tests/icread.test.mjs#checksFor : une valeur vide…`, `tests/pdf.test.mjs#extraits : ni coupés… ni pour une valeur non lue`
- **Commit:** `afd3ffd`, `07ea066`

**4. [Rule 3 - Blocker] Un module absent aurait donné un RED invalide**
- **Found during:** Task 2 (RED)
- **Issue:** un import statique d'un `js/icplaus.js` absent est une erreur de chargement (`INVALID_RED`, `fixture_or_load_failure`).
- **Fix:** import rattrapé dans le test au RED, remplacé par un import statique au GREEN ; `checksFor` lue par espace de noms au RED.
- **Files modified:** `tests/icplaus.test.mjs`, `tests/icread.test.mjs`
- **Verification:** `RED_EVIDENCE_OK`
- **Commit:** `d24ccd5`, `07ea066`

---

**Total deviations:** 4 (2 fonctionnalités critiques ajoutées, 1 interprétation, 1 blocage de méthode)
**Impact on plan:** nécessaires à la justesse de la relecture ; aucune extension de périmètre.

## Issues Encountered

- Aucun blocage. Sur le texte réel des IC SNPM, le titre est un segment en désordre (« DE COURSE TYPE HABITABLES COUPE de la SNPM CVAT… ») : l'extrait de l'épreuve contient la valeur mais avec des espaces multiples du PDF ; la vue les réduit à un espace pour l'affichage, le test compare la valeur à l'extrait sans les doubler.
- L'ancien comportement de `parseIC` sur le Comité d'un autre club (texte sans ligne vide après le nom) donne « Marie DUPONT Téléphone ou sms » : c'est la lecture actuelle, figée par la règle « les champs ne changent pas » ; l'équipier le corrige dans la relecture et la puce l'indiquera à la prochaine amélioration du lecteur.
- Les points qui demandent un iPhone restent au vérificateur de fin de phase (voir « Contrôles humains »).

## Contrôles humains reportés à la fin de phase (`<human-check>` du plan, non bloquants)

- **Tâche 1 :** sur iPhone, dans la fiche d'une régate, importer le PDF des IC de la Coupe SNPM depuis Fichiers ; lire la relecture ; « Annuler », relancer l'app ; réimporter, corriger un champ, « Valider les IC ». Attendu : chaque valeur a son extrait lisible, un champ non lu est vide et le dit, rien n'est retenu après « Annuler » et relance, la fiche indique qui a validé et quand.
- **Tâche 2 :** sur iPhone, dans la relecture des IC SNPM, taper « 25:00 » dans le 1er signal, « 16 » dans la VHF, puis corriger. Attendu : puce rouge et bouton désactivé pour 25:00, puce orange « veille de détresse » pour 16 et bouton actif, tout redevient vert après correction ; les puces se lisent au soleil.

## Known Stubs

Aucun. (Les attributs `placeholder` des champs de la relecture sont des indications de saisie, pas des données ; `checkPos` n'est pas encore appelée par l'app : elle est écrite et testée ici pour les bouées du plan 07, ce que le plan prévoit.)

## Threat Flags

Aucun nouveau point d'entrée hors modèle de menaces. T-03-06 (extrait ou valeur piégés : `escHTML` partout, test linkedom), T-03-07 (valeur retenue sans contrôle humain : brouillon en mémoire, écriture par `applyReview` sur le geste, scénario `ic`), T-03-08 (`pdfText` et `PDF_OPTIONS` inchangés, garde `getDocument(` verte) et T-03-09 (valeur impossible validée : `checksFor` + `canValidate`, scénario `vraisemblance`) sont couverts. Aucune installation de paquet (T-03-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Prêt pour 03-03 (gel du vent) : la régate porte `ic.fields.firstWarning` validé, utilisable pour le sceau du gel.
- Prêt pour 03-06 : `reviewFromParse` / `reviewHTML` / `checksFor` accueillent la réponse de `api/ic.js` (forme de relecture unique, `read` autre que `motifs`) ; la lecture CVAT qui échoue laisse déjà les champs vides avec « non lu dans le texte » (étalement v28 / v29 de D-03, décision du plan).
- Prêt pour 03-07 : `checkPos` (bornes de la carte, sur terre) testée sur le vrai terrain.
- L'ancien code de fiches de `js/events.js` (`eventsState`, `upsertEvent`, `eventForm`, `readForm`…) n'est plus appelé ; son retrait reste au plan 05.
- Rien d'arrêtant. Version affichée toujours v27 : la publication v28 est au plan 07.

## Self-Check: PASSED

- Fichiers présents : `js/icread.js`, `js/icplaus.js`, `tests/icread.test.mjs`, `tests/icplaus.test.mjs`, `js/events.js`, `js/app.js`, `tools/regate-e2e.mjs`.
- Commits présents sur la branche `apercu-phase-03` : `afd3ffd`, `d24ccd5`, `07ea066` (3 commits mesurés par `git rev-list --count`).
- Critères d'acceptation relancés après le dernier commit : `grep -c "applyReview(" js/app.js` = 1, `grep -c "export function cleanText" js/events.js` = 1, `grep -c "checksFor(" js/app.js` = 1, `npm run check` vert (222 tests), `PW_REQUIRED=1 node tools/regate-e2e.mjs` 5/5 OK, référence SNPM et `js/courses.js` inchangés, aucun code d'accès ni empreinte dans les fichiers du plan.

---
*Phase: 03-ouvrir-une-regate*
*Completed: 2026-10-19*
