---
phase: quick-261022-acc
plan: 01
quick_id: 261022-acc
type: execute
wave: 1
depends_on: []
files_modified:
  - js/regates.js
  - js/regview.js
  - js/archsync.js
  - js/app.js
  - index.html
  - styles.css
  - tests/regates.test.mjs
  - tests/archsync.test.mjs
  - tests/apiarchive.test.mjs
  - tests/boot.test.mjs
  - tools/regate-e2e.mjs
  - guide.html
  - js/help.js
  - tests/guide.test.mjs
  - sw.js
  - js/version.js
  - release.json
autonomous: true
requirements: [REG-01, ARCH-01, ARCH-02, FIAB-01, FIAB-06]

estimate:
  tokens: 450000
  raw_tokens: 450000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "D-A1, D-A4 : lancée un jour sans régate (jeudi 22/10/2026), l’app s’ouvre en « Entraînement libre », aucune régate ouverte, même si la Coupe SNPM est dans l’archive ; vent, prévisions, parcours du cahier, chrono, mode départ, GPS, trace, débrief, règles et J80 marchent ; l’onglet Régates dit « Aucune régate ouverte »"
    - "D-A1 : sans régate ouverte, ce qui n’a de sens que dans une régate (IC de l’épreuve, manches, fiche, vent figé, traces rangées) n’est pas affiché ; à la place, « Aucune régate ouverte », et le bandeau du panneau porte un bouton « Ouvrir une régate » qui mène à la liste"
    - "D-A2 : l’onglet Régates classe les régates En préparation, En cours, Terminées ; chaque régate a « Ouvrir » ; « ＋ Nouvelle régate » crée la régate et l’ouvre ; la régate ouverte a son nom en tête du panneau, sur tous les onglets, avec « Fermer la régate » qui revient à l’entraînement libre"
    - "D-A3 : lancée un jour de régate (jour de Paris), l’app ouvre cette régate sans aucun geste ; restée ouverte d’un jour sur l’autre (iPhone qui reprend l’app sans la relancer), elle ouvre la régate du nouveau jour dès qu’aucune course ni saisie n’est en cours"
    - "D-A4 : chaque lancement repart en entraînement libre, sauf D-A3 ; l’état « régate ouverte » n’est écrit ni dans rade.regates.v1 ni dans le document partagé ; ouvrir ou fermer une régate sur un téléphone ne change rien sur un autre ; un téléphone encore en v36 synchronise sans erreur"
    - "D-A5 : la Coupe SNPM du 18/10 n’est plus ouverte d’office, y compris sur les téléphones dont l’index v36 la marquait courante ; elle reste dans l’archive, rangée dans « Terminées », et se rouvre avec ses traces et son débrief ; aucune donnée supprimée ; js/courses.js et tests/reference/ inchangés depuis f80c365"
    - "Sécurité en course inchangée : le verrou « journée de régate » et le gel du vent du jour suivent la régate du jour dans la liste, ouverte ou non ; une trace se range dans la régate de son jour, ouverte ou non ; ouvrir ou fermer une régate n’échange rien et rien ne s’échange pendant une course (D-03 phase 4) ; bips, chrono et GPS ne dépendent pas de la régate ouverte"
    - "L’app installée s’ouvre toujours en moins de 2 s hors réseau (measure-boot, médiane)"
  artifacts:
    - path: js/regates.js
      provides: "openAtBoot (règle d’ouverture D-A3), openRegatta (sans repli sur la première), openOnNewDay (passage de jour), groupByStatus et libellés En préparation / En cours / Terminées ; index sans current ; lockDates sur la seule liste"
      contains: "export function openAtBoot"
    - path: js/app.js
      provides: "état local OPEN en mémoire, setOpen (seul point d’écriture), paintRegBar, dayOpenTick ; plus aucune lecture d’une régate courante dans l’index"
      contains: "function setOpen"
    - path: js/regview.js
      provides: "liste par statut avec « Ouvrir » (data-rg) et puce « Ouverte » ; carte « Aucune régate ouverte » (noRegattaHTML)"
      contains: "export function noRegattaHTML"
    - path: index.html
      provides: "bandeau #regBar du panneau (Entraînement libre / nom de la régate et « Fermer la régate »)"
      contains: "id=\"regBar\""
    - path: js/archsync.js
      provides: "applyDoc sans état « régate ouverte »"
      contains: "export function applyDoc"
    - path: tools/regate-e2e.mjs
      provides: "scénarios accueil, jour-j, deux-telephones ; helpers ouvreRegate et regateOuverte ; scénarios existants à jour sans assertion affaiblie"
      contains: "'deux-telephones'"
    - path: guide.html
      provides: "Entraînement libre, liste En préparation / En cours / Terminées, Ouvrir, Fermer la régate, ouverture le jour J, état local"
      contains: "Entraînement libre"
  key_links:
    - from: js/app.js
      to: js/regates.js
      via: "OPEN est posé au chargement du module par openAtBoot sur la liste, jamais lu dans l’index"
      pattern: "let OPEN = openAtBoot\\(\\{ now: Date\\.now\\(\\), list: REG\\.list \\}\\)"
    - from: js/app.js
      to: js/regates.js
      via: "raceLock et renderLive passent la seule liste à lockDates (verrou indépendant de la régate ouverte)"
      pattern: "lockDates\\(\\{ now(: Date\\.now\\(\\))?, list: REG\\.list \\}\\)"
    - from: js/regview.js
      to: js/app.js
      via: "le bouton « Ouvrir » porte data-rg ; renderIC le relie à openGesture → setOpen"
      pattern: "data-rg=\""
    - from: js/app.js
      to: js/archsync.js
      via: "syncDeps.setState compare et applique list et tomb seulement ; applyDoc ne pose aucun état d’ouverture"
      pattern: "canon\\(\\[st\\.list, st\\.tomb\\]\\)"
    - from: js/app.js
      to: js/regates.js
      via: "raceTick appelle dayOpenTick, qui applique openOnNewDay hors course et hors saisie"
      pattern: "openOnNewDay\\("
---

# Accueil hors régate : l’app s’ouvre en entraînement libre (v37)

Demande de Romain le 22/10 : « Archive la régate de la semaine dernière, je veux que l’app s’ouvre sur une page de non régate, sauf à aller charger une régate qui peut être en préparation, en cours ou terminée. » Décisions verrouillées D-A1 à D-A5 dans `261022-acc-CONTEXT.md`.

<objective>
L’app s’ouvre en « Entraînement libre » (D-A1). Une régate s’ouvre et se ferme d’un geste depuis l’onglet Régates, classé En préparation, En cours, Terminées (D-A2). Le jour d’une régate, l’app l’ouvre seule (D-A3). La régate ouverte est un état local du téléphone, oublié à chaque lancement et jamais partagé (D-A4). La Coupe SNPM du 18/10 n’est plus ouverte d’office et reste lisible dans « Terminées » (D-A5). Rien ne change à la sécurité en course : verrou, gel du vent, rattachement des traces, « rien ne s’échange pendant une course ».

Purpose : la régate passée ne doit plus occuper l’écran tous les jours ; le jour J, l’équipage n’a aucun geste à faire avant le chrono.
Output : v37 sur la branche d’aperçu `apercu-phase-05`, poussée. La mise en production attend le « publie » écrit par Romain (orchestrateur), avant le gel du 2 novembre.
</objective>

## Décisions du planificateur (P-01 à P-08), tirées du code

- **P-01 — Où vit l’état « régate ouverte » (question 2).** Dans une variable de module `OPEN` de js/app.js (identifiant ou null), en mémoire seulement. Raisons :
  - le champ `current` de l’index n’a jamais voyagé : `buildDoc` (js/archsync.js) n’envoie que `regattas`, `tomb` et `marks`, `toShared` retire `sel`, et `api/archive.js` reconstruit chaque document depuis `emptyDoc()`. Il n’y a donc rien à retirer du document partagé : des tests vont le garantir ;
  - mais `upsertRegatta` (`current: st.current || r.id`), `removeRegatta` (repli sur la première), `currentRegatta` (repli sur la première) et `applyDoc` (repli sur la première) rouvriraient une régate sans geste : un gel, une trace rangée ou une synchronisation ouvrirait une régate en entraînement libre. En sortant l’état de l’index, aucune opération sur les données ne peut plus ouvrir ni fermer une régate.
  Conséquences :
  - l’index `rade.regates.v1` ne porte plus `current`. `migrate` le lit et l’oublie (D-A4), et réécrit une seule fois un index v36 qui le portait : c’est ce qui « archive » la Coupe SNPM sur les trois téléphones (D-A5). `saveRegattas` ne l’écrit jamais ;
  - `upsertRegatta` et `removeRegatta` ne touchent plus qu’à la liste. `setCurrent` et `currentRegatta` disparaissent. Ils sont remplacés par `openRegatta(list, id)`, qui rend la régate ou null, sans repli ;
  - `applyDoc` ne pose plus rien d’autre que `list` et `tomb`. `syncDeps.setState` compare `list` et `tomb` seulement ;
  - compatibilité v36 : un téléphone en v36 n’envoie jamais `current` ; un document qui en porterait un au premier niveau est ignoré (le serveur repart de `emptyDoc()`, `mergeDoc` ne garde que v, regattas, tomb, marks). Des tests le prouvent. Si ce téléphone revenait en v36, `currentRegatta` y retomberait sur la première régate : sans danger ;
  - l’état est lisible dans la page par l’attribut `data-open` de `#regBar` (identifiant ou vide). C’est l’observable des scénarios Chromium, sans crochet global.
  - `setOpen(id)` est le seul endroit où `OPEN` change après le chargement. Il ne fait ni `saveReg`, ni `scheduleSync`, ni `markDirty` : ouvrir ou fermer n’échange rien (D-A4, D-03).
- **P-02 — Règle d’ouverture (questions 3 et D-A3).**
  - Au chargement du module, juste après `migrate` et `seedNorm`, `OPEN = openAtBoot({ now: Date.now(), list: REG.list })`, soit la régate d’aujourd’hui au jour de Paris (`todayRegatta`, la première de la liste si plusieurs), sinon null. Aucune mémoire d’un lancement à l’autre (D-A4).
  - Passage de jour sans relance : iOS reprend souvent l’app installée sans la relancer. Ouverte la veille au soir en entraînement, elle serait encore en entraînement le matin de la régate, ce qui contredirait « aucun geste avant le chrono ». Fonction pure `openOnNewDay({ now, list, openId, day })` :
    - même jour de Paris : rien ne change ;
    - nouveau jour avec une régate ce jour-là : elle est ouverte (celle déjà ouverte si elle en fait partie) ;
    - nouveau jour sans régate : l’état ouvert est gardé, l’écran n’est jamais retiré sous les doigts.
    Elle est appliquée par `dayOpenTick`, une ligne séparée de `raceTick` (toutes les 5 s), seulement hors course (`raceActive` faux) et hors saisie (`icBusy()` faux). Sinon le jour n’avance pas et l’essai revient au tic suivant. Une régate fermée à la main le jour J n’est pas rouverte le même jour.
- **P-03 — Verrou, gel, rattachement : indépendants de la régate ouverte (questions 3 et 4, vérifié dans le code).**
  - `lockState` ne lit que `isRaceDay(raceFrom, raceTo)`. Le repli « sinon la courante » de `lockDates` n’a donc jamais verrouillé : une régate qui n’est pas d’aujourd’hui ne fait pas un jour de régate. `lockDates({ now, list })` ne prend plus que la liste, et un test d’équivalence prouve que le verrou est identique à celui de la v36 pour toute régate courante d’alors.
  - Gel : `freezeTick` gèle `todayRegatta({ now, list: REG.list, currentId: OPEN })`. La régate ouverte ne sert qu’à départager deux régates du même jour. Sans régate ouverte, la première du jour est gelée : le gel ne dépend jamais d’une ouverture.
  - Traces : `rangeTrace` range par `matchRegattas(tr.pts, REG.list)`, au jour de la trace. `regOfTrace`, `syncRef` et js/reprise.js (`getList`) lisent la liste. Tout reste inchangé. `createFor` (régate créée pour une trace) ne l’ouvre pas.
  - « Course finie » (`renderLive`) suit `lockDates` sur la liste.
- **P-04 — Ce que montre l’entraînement libre (question 1).**
  - `IC = icOf(null)` : séquence de départ et pavillons de classe communs CVAT (valeurs `COMMON`), aucun premier signal, aucune date. Le Briefing n’a ni 🏁 ni nom d’épreuve. Le chrono de l’onglet Départ montre la séquence commune.
  - Parcours : catalogue de la rade (`COURSES`, sans bouées ni parcours de régate injectés : `applyRegattaMarks(…, null)` les retire ; un parcours de régate choisi revient au parcours 3, comme aujourd’hui).
  - Onglet Régates : la carte « Régates » (liste, « ＋ Nouvelle régate », « Vous : », synchronisation) reste en tête. À la place de la fiche et de la carte des IC vient une carte `#rgNone` « Aucune régate ouverte ». Elle explique l’entraînement libre et garde « ＋ Importer des IC (PDF) » : importées sans régate ouverte, les IC créent une nouvelle régate et l’ouvrent (chemin `validateIC` existant). La carte dit d’ouvrir d’abord la régate pour y lire ses IC.
  - Les cartes « Points clés » (et « Supprimer cette régate ») et la carte des IC n’apparaissent qu’avec une régate ouverte. Règles de course, pavillons habituels CVAT, marques et dangers restent toujours.
  - Le test de référence SNPM lit js/courses.js directement : aucun de ces fichiers n’est touché.
- **P-05 — Interface (question 5).**
  - `#regBar`, dans `#panel`, entre `#tabs` et `#content`, toujours visible, sur tous les onglets et dans les trois hauteurs du panneau :
    - sans régate ouverte : « Entraînement libre » et le bouton « Ouvrir une régate » (onglet Régates, liste à l’écran) ;
    - régate ouverte : « 🏁 » et son nom, son statut, et le bouton « Fermer la régate » (un seul toucher : le geste ne détruit rien et « Ouvrir » le défait).
    Texte posé par textContent seulement.
  - Liste : `.rggroup` avec un titre h4 (En préparation, En cours, Terminées), une ligne `.rg[data-rg-row]` par régate, le bouton « Ouvrir » `[data-rg]`, et la puce « Ouverte » sur la régate ouverte. Toasts : « Régate ouverte : <nom> », « Retour à l’entraînement libre », « Jour de régate : <nom> ouverte » (passage de jour).
- **P-06 — Classement (D-A2 remplace la liste par saison d’ARCH-02).**
  - Ordre des groupes, celui de Romain : En préparation (dates croissantes, régate sans date en dernier), En cours, Terminées (dates décroissantes). Seuls les groupes non vides s’affichent.
  - `STATUS_LABEL` devient { avenir: « En préparation », aujourdhui: « En cours », passee: « Terminée » } (puce de la fiche et du bandeau). L’année reste lisible dans chaque ligne (dates avec l’année) et le champ `season` reste dans les données partagées : rien ne change dans le format.
  - `groupBySeason` est remplacé par `groupByStatus`.
- **P-07 — Tests et scénarios (question 6).**
  - Tests Node : règle d’ouverture, absence de `current` partout (index, document envoyé, réponse appliquée), équivalence du verrou, passage de jour, vues, gardes statiques du câblage.
  - Chromium :
    - `accueil` : (a), plus les index v36 ;
    - `gpx` étendu : (b), ouvrir la SNPM dans « Terminées » avec sa trace et son débrief, puis fermer ;
    - `jour-j` : (c), avec horloge Playwright, passage de jour et gel indépendant ;
    - `deux-telephones` : (d).
  - Règle pour les scénarios existants : on n’affaiblit jamais une assertion. Un scénario qui lisait la fiche d’une régate qui n’est pas celle du jour l’ouvre d’abord explicitement (« Ouvrir »). Une lecture de l’ancien champ current de l’index devient la lecture de `#regBar[data-open]`, avec le même contenu attendu.
- **P-08 — Pas de changement des formats.** Aucune version de format, aucun champ ajouté au document partagé, aucune nouvelle clé de stockage. Hors réseau, l’ouverture reste synchrone (une seule réécriture de l’index, une fois par téléphone).

Le premier élément est la tâche traceuse : un chemin complet, de l’index jusqu’au navigateur, ouvrir et fermer une régate. Les tâches 2 et 3 en élargissent la portée.

Règles permanentes pour l’exécutant :
- Ne jamais écrire un code d’accès ni une empreinte, nulle part.
- Aucune mise en production, aucune installation de paquet.
- Après toute modification de l’app : `npm run stamp`.
- Textes visibles en français, apostrophe typographique ’, séparateurs — et ·.
- Ne pas toucher js/courses.js ni tests/reference/.
- Chromium est dans /opt/pw-browsers/chromium ; si tools/pw.mjs ne le trouve pas seul, poser `PW_CHROMIUM`.

<!-- planner-discipline-allow: régate courante -->

<context>
@.planning/quick/261022-acc-accueil-hors-regate/261022-acc-CONTEXT.md
@.planning/STATE.md
@.claude/CLAUDE.md
@js/regates.js
@js/regview.js
@js/archsync.js
@js/app.js
@index.html
@tests/regates.test.mjs
@tests/archsync.test.mjs
@tools/regate-e2e.mjs
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Tâche 1 (traceuse) : ouverture en Entraînement libre, ouvrir et fermer une régate depuis la liste — modèle, page, vue et scénario Chromium « accueil »</name>
  <files>js/regates.js, js/regview.js, js/archsync.js, js/app.js, index.html, styles.css, tests/regates.test.mjs, tests/archsync.test.mjs, tools/regate-e2e.mjs, sw.js, js/version.js</files>
  <read_first>
- js/regates.js, tout le fichier : `migrate`, `saveRegattas`, `upsertRegatta`, `removeRegatta`, `setCurrent`, `currentRegatta`, `todayRegatta`, `lockDates`, `groupBySeason`, `STATUS_LABEL`, `icOf`
- js/regview.js : `listHTML`, `statusChip`, `CHIP`, `sheetHTML` (cas null)
- js/archsync.js : `buildDoc`, `applyDoc` (l. 57-65)
- js/app.js :
  - l. 10 (import de ./regates.js) et l. 62-80 (`REG`, `seedNorm`, `IC`, `saveReg`) ;
  - l. 120-140 (temps 1 d’`init`) et l. 475 (`drawCourse`, `pendingMarks`) ;
  - l. 784 (`raceLock`), l. 1239 (`renderLive`), l. 1341-1345 (`freezeTick`) ;
  - l. 1826-1832 (`syncDeps.setState`) ;
  - l. 1966-2060 (`icBusy`, `afterRegChange`, `syncRegMarks`, `chooseRace`, `renderIC` et toutes ses liaisons) ;
  - l. 2203 (`readWithAI`) et l. 2230-2247 (`validateIC`).
- index.html (`#panel`, `#tabs`, `#content`) ; styles.css l. 57-63 et 119-140 (`#panel`, `#tabs`, `#panel.min` à 96 px)
- tests/regates.test.mjs : l. 1-60, 125-200 et 340-372 (tests de `setCurrent`, `currentRegatta`, `groupBySeason`, `STATUS_LABEL`, `listHTML`, et la garde `^let IC = …`)
- tests/archsync.test.mjs : l. 15-40 (`telephone()`, `creer`) et l. 70-112 (assertion « la courante est celle de CET appareil » et test `applyDoc`)
- tests/boot.test.mjs : l. 20-40 (ordre du temps 1, `rt:ui`) et l. 215-230 (`saveReg` : `REG = next`)
- tools/regate-e2e.mjs :
  - `INIT`, `ouvreContexte` (option `geo`), `ouvrePage`, `ouvreApp`, `sansErreur` ;
  - `lireListe`, `creeRegate`, `regateCourante`, `sème`, `noms`, `gelDuJour`, `SCENARIOS` ;
  - `retourPort`, pour les sélecteurs du chrono (`#t5`, `#tstop`), du mode départ (`#smOpen`, ✕), du GPS (`#gOn`, `#gOff`) et de la trace (`#recStart`, `#recStop`).
  </read_first>
  <behavior>
    - openAtBoot({ now, list }), avec list = [Coupe SNPM 18/10, nov du 07 au 09/11] :
      - 2026-10-22T08:30Z → null ;
      - 2026-10-18T08:00Z → 'snpm-2026' ;
      - 2026-11-08T10:00Z → 'nov' ;
      - 2026-10-24T22:30Z (00:30 le 25 à Paris, heure d’été) avec une régate du 25/10 → son id ;
      - liste vide ou absente → null ;
      - deux régates aujourd’hui → la première de la liste.
    - openRegatta(list, id) rend la régate, sinon null : pour null, undefined, un id inconnu ou une liste vide. Jamais la première par défaut.
    - migrate :
      - appareil neuf → Coupe SNPM semée, et l’état rendu comme l’index écrit n’ont aucune clé current ;
      - index v36 portant current 'snpm-2026' → rendu sans current, réécrit une fois sans current ; un second appel n’écrit plus rien (setItem compté) ;
      - reprise de rade.events.v1 qui portait current → sans current.
    - saveRegattas n’écrit jamais current, même si l’état en porte un.
    - upsertRegatta et removeRegatta, sur un état gelé, n’ajoutent ni ne changent current et ne mutent rien.
    - applyDoc rend un état sans current ; la manche choisie (sel) suit toujours sa manche.
    - groupByStatus(list, now) :
      - groupes dans l’ordre avenir, aujourdhui, passee, avec les libellés 'En préparation', 'En cours', 'Terminées' ;
      - En préparation en dates croissantes, régate sans date en dernier ; Terminées en dates décroissantes ; à date égale, par nom ;
      - groupes vides absents ; liste vide → [].
      - STATUS_LABEL vaut { avenir: 'En préparation', aujourdhui: 'En cours', passee: 'Terminée' }.
    - listHTML(groupes, { openId, now }) :
      - une ligne .rg[data-rg-row] par régate, avec un bouton « Ouvrir » (data-rg="<id>", aria-label « Ouvrir <nom> » échappé) ;
      - la régate ouverte porte la classe on et une puce « Ouverte », sans bouton « Ouvrir » ;
      - un nom, un club ou un auteur piégés ne donnent ni balise ni attribut on… ; l’apostrophe est échappée ;
      - liste vide → « Aucune régate pour l’instant » ;
      - titres h4 des groupes = libellés de groupByStatus.
    - noRegattaHTML() rend une carte #rgNone qui contient « Aucune régate ouverte », « Entraînement libre », le libellé « ＋ Importer des IC (PDF) » relié à #icFile, et #icMsg.
    - Gardes statiques sur js/app.js, avec bodyOf de tests/helpers/scan.mjs :
      - au niveau du module, hors init, la ligne `let OPEN = openAtBoot({ now: Date.now(), list: REG.list });` après migrate et seedNorm, puis `let IC = icOf(openReg());` ;
      - OPEN n’est affecté que par cette déclaration et dans le corps de setOpen ;
      - le corps de setOpen n’appelle ni saveReg, ni scheduleSync, ni markDirty ;
      - le corps de syncDeps ne cite ni OPEN ni setOpen ;
      - rangeTrace, attachTo, createFor, syncRef, freezeWrite et reprise n’appellent pas setOpen ;
      - les identifiants currentRegatta et setCurrentRegatta n’apparaissent plus dans js/app.js ;
      - paintRegBar ne touche pas innerHTML ;
      - init appelle paintRegBar() avant la marque rt:ui.
  </behavior>
  <action>
1. `js/regates.js`, selon P-01, P-02 et P-06 :
   - `migrate` : l’état rendu n’a plus de clé current. Un index lu qui en portait une est réécrit une seule fois sans elle (D-A4, D-A5 : la Coupe SNPM n’est plus ouverte d’office sur les trois téléphones). La graine et la reprise de rade.events.v1 ne posent plus de régate ouverte.
   - `saveRegattas` écrit l’état privé de current.
   - `upsertRegatta` ne met à jour que la liste ; `removeRegatta` retire de la liste et rien d’autre.
   - Supprimer `setCurrent` et `currentRegatta`.
   - Ajouter `openRegatta(list, id)` et `openAtBoot({ now, list })`, selon le `<behavior>`.
   - Remplacer `groupBySeason` par `groupByStatus` et changer `STATUS_LABEL`. Ajouter un `GROUP_LABEL` exporté pour les titres au pluriel.
   - En-tête et commentaires en français : la régate ouverte est un état de la page (js/app.js), jamais dans l’index.
   - Ne pas toucher `lockDates` dans cette tâche : ce sera la tâche 2.
2. `js/archsync.js` : `applyDoc` rend { ...st, list, tomb } et les marques. Plus de calcul de régate ouverte. Commentaire mis à jour : « sel reste celui de CET appareil ; la régate ouverte n’est pas dans l’état ».
3. `js/regview.js` :
   - `listHTML(groups, { openId, now })`, selon le `<behavior>` (lignes en div, bouton « Ouvrir », puce « Ouverte ») ;
   - nouvelle `noRegattaHTML()`, pure, selon P-04, avec ces textes :
     - « Aucune régate ouverte » en titre ;
     - « Entraînement libre : vent, parcours du cahier, chrono, mode départ, GPS, trace et débrief marchent sans régate. » ;
     - « Ouvrez une régate de la liste (« Ouvrir ») ou créez-en une. Le jour d’une régate, l’app l’ouvre toute seule. » ;
     - « Importées ici, les IC créent une nouvelle régate : pour celles d’une régate de la liste, ouvrez-la d’abord. » ;
     - le label « ＋ Importer des IC (PDF) » pour #icFile, l’input #icFile caché (mêmes accept) et #icMsg ;
   - `sheetHTML(null)` rend une chaîne vide ;
   - `statusChip` prend les nouveaux libellés ;
   - escHTML sur tout texte venu d’une régate.
4. `index.html` : dans #panel, après `<nav id="tabs">` et avant #content, `<div id="regBar" class="regbar" role="status" data-open=""></div>`.
   `styles.css` :
   - .regbar sur une ligne, flex-shrink 0, nom tronqué (ellipsis), bouton small à droite, couleurs du panneau ;
   - .rggroup et .rg (ligne avec le bouton « Ouvrir » à droite) ;
   - si le bandeau sort de #panel.min à 390 × 844, augmenter la hauteur de #panel.min de la hauteur du bandeau.
5. `js/app.js`, selon P-01 à P-05 :
   - import : retirer les deux fonctions supprimées, ajouter openRegatta, openAtBoot et groupByStatus.
   - Au chargement du module :
     - après le bloc seedNorm, `let OPEN = openAtBoot({ now: Date.now(), list: REG.list });` avec un commentaire « D-A3, D-A4 : régate du jour, sinon entraînement libre ; jamais lue dans l’index » ;
     - `const openReg = () => openRegatta(REG.list, OPEN);` ;
     - `let IC = icOf(openReg());`.
     Dans saveReg, garder `REG = next` (garde de tests/boot.test.mjs) et recalculer `IC = icOf(openReg())`.
   - `function setOpen(id)` : OPEN prend id ou null, IC est recalculé, `note('regate', id ? 'ouverte' : 'entraînement libre')` (identifiant seulement), puis paintRegBar(). Rien d’autre.
   - `function openGesture(id)`, liée aux gestes « Ouvrir » et « Fermer la régate » :
     - abandonne une lecture IA en cours (iaCtl, iaBusy, iaMsg comme le bouton Annuler), puis remet icDraft, raceDraft et markFix à null ;
     - setOpen(id), afterRegChange() ;
     - toast « Régate ouverte : <nom> » ou « Retour à l’entraînement libre » ;
     - pour une ouverture, fait défiler #rgSheet à l’écran.
   - `function paintRegBar()` :
     - construit #regBar par createElement et textContent seulement ;
     - sans régate ouverte (openReg() null) : « Entraînement libre » et le bouton #regGo « Ouvrir une régate », qui fait openTab('ic') puis fait défiler #rgList à l’écran ;
     - régate ouverte : « 🏁 », le nom, la puce de statut (STATUS_LABEL) et le bouton #regClose « Fermer la régate », qui appelle openGesture(null) ;
     - data-open = openReg()?.id ?? ''.
     Une régate ouverte supprimée par un autre téléphone affiche donc l’entraînement libre.
   - init, temps 1 : appeler paintRegBar() juste après bindShell().
   - afterRegChange appelle aussi paintRegBar().
   - syncDeps.setState : comparer canon([st.list, st.tomb]) à canon([REG.list, REG.tomb]), puis paintRegBar() avec les redessins existants. syncDeps ne touche jamais OPEN.
   - Remplacer chaque appel à l’ancienne lecture de la régate courante par openReg() : drawCourse (pendingMarks), syncRegMarks, chooseRace, renderIC, readWithAI, validateIC.
   - Créations :
     - « Créer la régate » (rgCreate) : saveReg(upsertRegatta(REG, r.regatta)) puis setOpen(r.regatta.id) ;
     - validateIC : si aucune régate n’est ouverte, la créer comme aujourd’hui, puis saveReg(upsertRegatta(REG, next)) et setOpen(next.id) ;
     - « Supprimer cette régate » : saveReg(removeRegatta(REG, cur.id)) puis setOpen(null), donc retour à l’entraînement libre, sans repli sur une autre régate.
   - raceLock et renderLive : `lockDates({ now, list: REG.list })` (renderLive avec `now: Date.now()`).
   - freezeTick : `todayRegatta({ now, list: REG.list, currentId: OPEN })`. Le commentaire dit que la régate ouverte ne sert qu’à départager deux régates du même jour (P-03).
   - renderIC, selon P-04 :
     - carte « Régates » avec id rgList, `listHTML(groupByStatus(REG.list, now), { openId: cur?.id ?? null, now })` ;
     - si cur : fiche, relecture, carte IC, puis Points clés avec « Supprimer cette régate » ;
     - sinon : noRegattaHTML(), puis la relecture si icDraft ;
     - dans les deux cas : règles, pavillons, marques, dangers ;
     - liaisons rendues facultatives quand l’élément peut manquer (#evEdit, #evDel, #rcNew…) ;
     - [data-rg] appelle openGesture(b.dataset.rg).
     Ne pas changer ici le texte de la bulle « Régates » (tâche 3).
   - Plus aucune lecture du champ current de l’index REG dans js/app.js.
6. Tests Node :
   - `tests/regates.test.mjs` :
     - remplacer les tests de setCurrent, currentRegatta, groupBySeason, STATUS_LABEL et listHTML par ceux du `<behavior>`, au moins aussi stricts (plus de repli sur la première régate) ;
     - ajouter openAtBoot, openRegatta, migrate, saveRegattas et noRegattaHTML ;
     - ajouter les gardes statiques ;
     - remplacer la garde `^let IC = …` par celles de OPEN et IC.
   - `tests/archsync.test.mjs` :
     - telephone() part de { v: 1, list: [] }, et creer n’ouvre rien ;
     - l’assertion « la courante est celle de CET appareil » devient « aucune clé current dans l’état reçu » ;
     - le test applyDoc garde ses assertions (tri, renumérotation, sel) et vérifie l’absence de current.
7. `tools/regate-e2e.mjs` :
   - helpers :
     - `ouvreRegate(page, id)` : onglet Régates, clic sur [data-rg="<id>"], attente de #regBar[data-open="<id>"] ;
     - `regateOuverte(page)` : lit #regBar data-open puis renvoie la régate de l’index (null sans régate ouverte). Elle remplace regateCourante et ses usages, dont gelDuJour ;
     - `lireListe` → [{ status: titre h4, rows: [{ id: data-rg-row, name, text, open }] }] ;
     - `noms()` suit cette forme ;
     - `sème(page, base, regates)` sans current, avec un index { v: 1, list }.
   - Nouveau scénario `accueil`, jeudi 22/10/2026 10 h 30 à Paris (heure '2026-10-22T08:30:00Z'), GPS simulé dans la rade. Chaque point est vérifié :
     (a) appareil neuf :
       - #regBar dit « Entraînement libre », data-open vide ;
       - l’index contient la Coupe SNPM et aucune clé current ;
       - onglet Régates : #rgNone contient « Aucune régate ouverte », pas de #rgSheet ; le groupe « Terminées » contient la Coupe SNPM avec « Ouvrir » ;
       - #daySeg sans 🏁 ;
       - onglet Départ : la séquence commune s’affiche ; Top 5’ fait tourner le chrono, puis Stop ;
       - « ⛵ Mode départ plein écran » s’ouvre et se ferme par ✕ ;
       - onglet En course : « ▶ Activer le GPS » affiche « précision ± » ; « ⏺ Enregistrer ma trace » lance l’enregistrement, « ⏹ Arrêter et enregistrer » l’arrête ; « Arrêter le GPS » ;
       - « Ouvrir une régate » (#regGo) affiche l’onglet Régates.
     (b) « Ouvrir » sur la Coupe SNPM :
       - #regBar data-open 'snpm-2026', avec son nom et « Fermer la régate » ;
       - #rgSheet affiche « Coupe de la SNPM » ; la carte des IC est là ;
       - « Fermer la régate » : retour à « Entraînement libre », #rgNone de nouveau là.
     (c) Le bandeau reste visible et dans la fenêtre dans les trois hauteurs du panneau. Utiliser deux touches sur #grab (moitié → grand → réduit), puis revenir à la moitié.
     (d) Rechargement : toujours « Entraînement libre ».
     (e) Nouveau contexte avec un index v36 déposé avant le premier chargement (Coupe SNPM, current 'snpm-2026', comme le font aujourd’hui les trois téléphones) :
       - « Entraînement libre » ;
       - l’index réécrit n’a plus de current ;
       - la Coupe SNPM est toujours dans « Terminées », avec les mêmes champs.
     (f) sansErreur.
   - Ajouter `accueil` à SCENARIOS.
   Les autres scénarios sont mis à jour à la tâche 2. D’ici là, ceux qui supposaient la SNPM ouverte peuvent échouer.
8. `npm run stamp`.
  </action>
  <verify>
    <automated>npm run stamp && npm run check && PW_REQUIRED=1 node tools/regate-e2e.mjs accueil</automated>
    <fails_when>code de sortie non nul, une ligne « not ok », « ÉCHEC accueil », une sortie 2 de l’outil, une clé current dans l’index ou dans un état rendu, une régate ouverte au lancement un jour sans régate, ou le bandeau hors de la fenêtre dans l’une des trois hauteurs du panneau</fails_when>
  </verify>
  <acceptance_criteria>
- js/regates.js exporte openAtBoot, openRegatta, groupByStatus et GROUP_LABEL, et n’exporte plus setCurrent, currentRegatta ni groupBySeason (tests/regates.test.mjs importe le module et le vérifie).
- npm test passe :
  - cas de openAtBoot, dont l’heure d’été et deux régates le même jour ;
  - openRegatta sans repli ;
  - migrate et saveRegattas sans current, et la réécriture unique d’un index v36 ;
  - applyDoc sans current, sel gardé ;
  - groupByStatus et listHTML (ordre, libellés, « Ouvrir », « Ouverte », injection) ;
  - noRegattaHTML ;
  - gardes statiques de OPEN, setOpen, syncDeps et paintRegBar ;
  - gardes existantes de tests/boot.test.mjs, inchangées.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs accueil` affiche « OK accueil » et « Bilan : 1/1 ».
- index.html contient #regBar dans #panel, entre #tabs et #content.
  </acceptance_criteria>
  <done>Un jour sans régate, l’app s’ouvre en entraînement libre, tout y marche, et la Coupe SNPM se rouvre et se referme d’un geste depuis « Terminées » (D-A1, D-A2, D-A4, D-A5). Le chemin index → page → liste → navigateur est prouvé. Commit atomique de la tâche.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 2 : jour J et passage de jour, verrou et gel indépendants de la régate ouverte, état jamais partagé ; tous les scénarios Chromium à jour (jour-j, deux-telephones, gpx étendu)</name>
  <files>js/regates.js, js/app.js, tests/regates.test.mjs, tests/archsync.test.mjs, tests/apiarchive.test.mjs, tests/boot.test.mjs, tools/regate-e2e.mjs, sw.js, js/version.js</files>
  <read_first>
- js/regates.js après la tâche 1 : `todayRegatta`, `lockDates`, `openAtBoot`
- js/racelock.js : `isRaceDay`, `lockState`, `parisClock` (le verrou ne lit que isRaceDay)
- js/app.js :
  - `raceTick` (l. ~788-806) : ses lignes gardées par tests/boot.test.mjs restent à l’identique ;
  - `raceLock`, `renderLive`, `freezeTick`, `icBusy`, `setOpen`, `afterRegChange` ;
  - `rangeTrace`, `attachTo`, `createFor`, `reprise`.
- js/attach.js (`matchRegattas`) et js/reprise.js (`getList`) : le rattachement lit la liste, rien à changer
- js/archsync.js `buildDoc` ; js/archmerge.js `mergeDoc`, `emptyDoc` ; api/archive.js (reconstruction du document depuis emptyDoc, l. ~50-70)
- tests/apiarchive.test.mjs : forme d’un PUT puis d’un GET avec le faux magasin ; tests/archsync.test.mjs : `monde()`, `telephone()`
- tests/boot.test.mjs : gardes de raceTick (`syncCtl?.abort()`, `scheduleSync(60000)`, `reprise()`, `freezeTick('tic')`)
- tools/regate-e2e.mjs, en entier, pour repérer chaque dépendance à l’ancienne régate courante :
  - `creer` (statuts et saisons de la liste) ;
  - `manche` (l. ~203-206) ;
  - `ic`, `vraisemblance`, `ia`, `ia-erreurs`, `bouees` (10/19 : la SNPM n’est plus ouverte) ;
  - `gel` (`gelDuJour`) ;
  - `gpx` (l. ~604-670 : #rgSheet .rgtr) ;
  - `gpx-choix` (sème avec current 'nov', l. ~701 et ~740) ;
  - `depuis-ic` (l. ~770-793) ;
  - helpers `rangee`/`rangeeH` des scénarios d’archive (clic sur la ligne .rg) ;
  - `archivehors` (l. ~1527 et ~1549 : la fiche de B) ;
  - `mondeArchive`, `telephoneArchive`, `synchronise`, `ligneSync`.
  </read_first>
  <behavior>
    - lockDates({ now, list }) ne prend que la liste : la régate d’aujourd’hui au jour de Paris, sinon { raceFrom: null, raceTo: null }.
    - Équivalence du verrou avec la v36 : l’ancienne règle (régate d’aujourd’hui en préférant la courante, sinon la courante) est réécrite dans le test comme référence. Pour chaque jour du 2026-10-15 au 2026-11-12 à 10 h de Paris et pour chaque courante d’alors (null, puis chaque id de la liste [SNPM 18/10, nov 07-09/11, déc 05/12]), isRaceDay donne le même résultat avec l’ancienne et la nouvelle règle.
    - openOnNewDay({ now, list, openId, day }) :
      - même jour de Paris → { day, openId } inchangés ;
      - nouveau jour avec régate → son id, ou l’ouverte si elle est de ce jour ;
      - nouveau jour sans régate → openId gardé ;
      - minuit de Paris en heure d’hiver et en heure d’été (le 25/10).
    - Le document partagé ne porte jamais d’état d’ouverture :
      - buildDoc d’un état auquel on a ajouté une clé current → aucune sous-chaîne « "current" » dans le JSON ;
      - applyDoc d’un document distant qui porte current au premier niveau → état sans current, régates fusionnées ;
      - api/archive.js : un PUT dont le document porte current au premier niveau (téléphone hypothétique ou ancien) répond 200, et le GET suivant rend un document sans current (compatibilité v36).
    - Gardes statiques :
      - raceLock et renderLive appellent lockDates avec la seule liste, sans currentId ;
      - freezeTick appelle todayRegatta sur REG.list ;
      - raceTick garde à l’identique ses lignes gardées et appelle dayOpenTick( sur une ligne séparée ;
      - dayOpenTick ne fait setOpen qu’après avoir vérifié la course active et icBusy() ;
      - js/attach.js et js/reprise.js ne citent aucun état d’ouverture.
  </behavior>
  <action>
1. `js/regates.js`, selon P-02 et P-03 :
   - `lockDates({ now, list })` : la régate d’aujourd’hui seulement. Commentaire : « le verrou ne dépend pas de la régate ouverte à l’écran (CONTEXT, contraintes) ; l’ancien repli sur la courante ne verrouillait jamais ».
   - Ajouter `openOnNewDay`, selon le `<behavior>`.
2. `js/app.js` :
   - `let openDay = parisClock(Date.now()).date;` à côté de OPEN.
   - `function dayOpenTick(now, active)` :
     - si active ou icBusy(), retourne sans rien changer ;
     - sinon applique openOnNewDay et met openDay à jour ;
     - si l’id change : setOpen(id), afterRegChange(), toast « Jour de régate : <nom> ouverte ».
   - Dans raceTick, une ligne séparée `dayOpenTick(now, active);`, après les lignes existantes, sans toucher les lignes gardées.
   - Vérifier, sans les changer, que rangeTrace, attachTo, createFor, syncRef, freezeWrite et reprise n’ouvrent rien. Les gardes de la tâche 1 le tiennent.
3. Tests Node : ceux du `<behavior>`.
   - tests/regates.test.mjs : lockDates, équivalence, openOnNewDay, gardes de raceLock, renderLive et freezeTick. Réécrire les assertions lockDates qui passaient currentId, à force égale.
   - tests/archsync.test.mjs : buildDoc et applyDoc.
   - tests/apiarchive.test.mjs : PUT avec current au premier niveau.
   - tests/boot.test.mjs : garde dayOpenTick dans raceTick.
4. `tools/regate-e2e.mjs`, selon P-07 :
   - Chaque scénario existant passe sans qu’aucune assertion soit retirée ni relâchée :
     - un scénario dont l’horloge n’est pas un jour de la régate dont il lit la fiche, les IC ou les manches l’ouvre d’abord par ouvreRegate (exemples : ic, vraisemblance, ia, ia-erreurs, bouees et la fiche de B dans archivehors, sur la Coupe SNPM ou la régate visée) ;
     - les lectures de l’ancien champ current de l’index passent par regateOuverte ou #regBar[data-open], avec la même valeur attendue :
       - manche : la régate ouverte est celle créée et porte sel = 2 ;
       - gpx-choix : l’import ne change pas la régate ouverte ;
       - depuis-ic : la régate créée depuis les IC devient la régate ouverte ;
       - archivehors : attente sur la régate ouverte, ouverte explicitement ;
     - les helpers rangee et rangeeH cliquent le bouton [data-rg] de la ligne ;
     - creer :
       - statuts « En cours » puis « Terminées » ;
       - la nouvelle régate est ouverte ;
       - la Coupe SNPM est dans « Terminées » ;
       - le 10/11 tout est dans « Terminées », plus de « Course finie », et l’app est en entraînement libre ;
     - index vide attendu { v: 1, list: [] }.
   - `gpx` étendu, point (b) de la demande :
     - au lancement du 19/10, « Entraînement libre » ;
     - après l’import du GPX, toujours « Entraînement libre » : la trace est rangée dans la Coupe SNPM sans l’ouvrir ;
     - « Ouvrir » sur la Coupe SNPM dans « Terminées », puis les vérifications existantes de la fiche : la ligne de trace, « Voir le débrief », le rapport ;
     - enfin « Fermer la régate » : « Entraînement libre » et #rgNone.
   - Nouveau scénario `jour-j`, point (c). Avant le premier chargement, l’index reçoit une seule régate, « Régate du lundi », le 2026-10-19, avec une manche à 14:00, déposée comme `manche1` du scénario gel, sans current et sans la Coupe SNPM. Pourquoi ce jour et cet index :
     - les prévisions embarquées couvrent du 17 au 19/10, donc le gel se fait hors réseau comme dans le scénario gel ;
     - un index présent n’est pas resemé, donc la veille (18/10) est un jour sans régate, ce qu’il faut pour le passage de jour.
     (1) le lundi 19/10 à 08 h 30 à Paris :
       - #regBar data-open = son id, sans geste ;
       - 🏁 sur « Auj. » ;
       - #rgSheet visible ;
       - le gel du jour apparaît dans la fiche (« Figé automatiquement ») ;
     (2) « Fermer la régate » :
       - « Entraînement libre » ;
       - onglet En course : « 🏁 Course finie — retour au port » toujours là, le verrou suit la liste ;
       - un relevé de vent enregistré (#obsAdd, onglet Parcours) est copié dans le gel du jour de cette régate dans les 15 s (nObs augmente, lu dans l’index par son id) : le gel ne dépend pas de la régate ouverte ;
       - au tic suivant, la régate n’est pas rouverte le même jour ;
     (3) nouveau contexte avec le même index, dimanche 18/10 à 22 h 30 à Paris :
       - « Entraînement libre » ;
       - horloge avancée sans recharger au 19/10 00 h 00 min 30 s (Paris) : dans les 15 s, la régate est ouverte et le toast « Jour de régate » s’affiche ;
     (4) même passage de jour pendant un chrono (Top 5’), dans un nouveau contexte : pas d’ouverture tant qu’il tourne ; après Stop, ouverture au tic suivant ;
     (5) sansErreur.
   - Nouveau scénario `deux-telephones`, point (d). mondeArchive au jeudi 22/10/2026 10 h 30, téléphones A et B, synchronisés une première fois :
     - A ouvre la Coupe SNPM, puis crée « Régate du club » le 2026-11-21, qui devient ouverte sur A ;
     - synchronise A puis B :
       - B est toujours en « Entraînement libre » ;
       - B voit « Régate du club » dans « En préparation » avec « Ouvrir » ;
       - aucun corps de requête PUT /api/archive vu par la route ne contient « "current" » : relever postData dans la route de telephoneArchive ;
       - l’index de A n’a pas de current ;
     - B ouvre « Régate du club » puis synchronise ; A synchronise : la régate ouverte sur A n’a pas changé ;
     - A recharge : « Entraînement libre » (D-A4) ;
     - sansErreur sur A et B.
   - Ajouter `jour-j` et `deux-telephones` à SCENARIOS.
5. `npm run stamp`.
  </action>
  <verify>
    <automated>npm run stamp && npm run check && PW_REQUIRED=1 node tools/regate-e2e.mjs</automated>
    <fails_when>
- code de sortie non nul, une ligne « not ok », un « ÉCHEC », un « Bilan » différent de N/N, ou une sortie 2 ;
- une assertion d’un scénario existant retirée ou relâchée : à contrôler dans le diff de tools/regate-e2e.mjs, où seuls sont permis les ajouts d’ouverture explicite et le changement de source de la régate ouverte ;
- le verrou ou le gel qui changent selon la régate ouverte ;
- un PUT qui transporte « "current" » ;
- une ouverture automatique pendant un chrono.
    </fails_when>
  </verify>
  <acceptance_criteria>
- npm test passe :
  - équivalence du verrou sur 29 jours et toutes les courantes d’alors ;
  - openOnNewDay aux deux changements d’heure ;
  - document partagé et réponse appliquée sans current ;
  - PUT avec current accepté et rendu sans current ;
  - gardes de raceLock, renderLive, freezeTick et dayOpenTick ;
  - gardes de raceTick existantes inchangées.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs` affiche « Bilan : N/N », avec accueil, jour-j, deux-telephones et gpx, sans violation CSP ni chemin refusé.
- Le SUMMARY liste, scénario par scénario, les ouvertures explicites ajoutées et les lectures de la régate ouverte déplacées vers #regBar.
  </acceptance_criteria>
  <done>Le jour J, la régate s’ouvre sans geste, au lancement comme au passage de minuit (D-A3). Fermer la régate ne touche ni au verrou, ni au gel, ni à « Course finie ». Ouvrir une régate sur un téléphone ne change rien sur l’autre et ne voyage pas (D-A4). Tous les scénarios sont verts, aucune assertion affaiblie. Commit atomique.</done>
</task>

<task type="auto">
  <name>Tâche 3 : guide et aide intégrée à jour (Entraînement libre, Ouvrir, Fermer la régate, En préparation / En cours / Terminées), puis livraison v37 sur apercu-phase-05</name>
  <files>guide.html, js/help.js, js/app.js, tests/guide.test.mjs, sw.js, js/version.js, release.json</files>
  <read_first>
- tests/guide.test.mjs, en entier :
  - EXIGEES, INTERDITES ;
  - MESSAGES_DE_L_APP, BOUTONS ;
  - la bulle « Régates » (BULLE_REGATES : /Passée\./ exigé, /Passées/ interdit) ;
  - la liste de l’aide qui exige « premier jour de la régate courante » ;
  - CITATIONS_LIBRES.
- js/help.js : l. 19 (bulle #daySeg), l. 40 (bulle [data-tab=ic]), l. 90-107 (GUIDE : « Régates », « Traces »), SYNC_TIP
- js/app.js : la bulle du titre « Régates » dans renderIC (texte de tip(...) lu par le test)
- guide.html, passages qui parlent de la régate courante ou de l’ancien classement :
  - l. 136 (#minute, « La veille ») ;
  - l. 183 (verrou) ;
  - l. 192 (« Créer la régate ») ;
  - l. 194 (« Relire les IC » : « Sans régate courante ») ;
  - l. 195 et 300 (🏁) ;
  - l. 212 (#matin, gel) ;
  - l. 274 (fiche) ;
  - l. 286 (« Changer de régate retire ses bouées ») ;
  - l. 422-438 (tableau de l’onglet Régates) ;
  - l. 505 (« Archive partagée ») ;
  - l. 574 (dépannage : « Passée ») ;
  - sommaire et section #onglets.
- tools/regate-e2e.mjs, scénario `guide` (aucun défilement horizontal, ancres)
  </read_first>
  <action>
1. Textes de l’app, sans inventer de libellé : chaque libellé cité doit exister dans le code des tâches 1 et 2.
   - Bulle du titre « Régates » dans renderIC (js/app.js) : garder la forme `Régates ${tip('…')}`, lue par le test. Elle dit :
     - à l’ouverture, l’app est en Entraînement libre ;
     - « Ouvrir » ouvre une régate : sa fiche, ses manches, ses IC, son vent figé et ses traces ;
     - « Fermer la régate » revient à l’entraînement ;
     - le jour d’une régate, l’app l’ouvre seule ;
     - classement En préparation, En cours, Terminées ;
     - ouvrir ou fermer ne change rien chez les autres.
   - js/help.js :
     - bulle #daySeg : « 🏁 marque le premier jour de la régate ouverte » ;
     - bulle [data-tab=ic] : la liste En préparation / En cours / Terminées, « Ouvrir », « Fermer la régate » ;
     - GUIDE : un point « Entraînement libre » (ce qui marche sans régate, ouverture automatique le jour J, « Ouvrir une régate » en tête du panneau, rien de partagé quand on ouvre ou ferme), et le point « Régates » mis à jour (ouvrir la régate avant d’importer ses IC).
2. `guide.html`, sans script ni ressource extérieure, avec span.k pour chaque libellé :
   - #minute : une étape ou une phrase qui dit qu’à l’ouverture l’app est en « Entraînement libre » et que le jour d’une régate elle s’ouvre sur elle. Dans « La veille » : ouvrir la régate (« Ouvrir ») ou « ＋ Nouvelle régate ».
   - « Créer la régate » : « La régate est ouverte » ; la liste classée En préparation, En cours, Terminées ; « Ouvrir » ; « Fermer la régate » ; « Ouvrir une régate » en tête du panneau ; 🏁 = premier jour de la régate ouverte ; le verrou et le gel suivent la régate du jour, ouverte ou non.
   - « Relire les IC » : sans régate ouverte, « Valider les IC » crée une nouvelle régate et l’ouvre ; pour une régate de la liste, l’ouvrir d’abord.
   - Les lignes 🏁 (l. 195 et 300) disent « régate ouverte ».
   - #matin : le jour de la régate, l’app s’ouvre directement sur elle, aucun geste avant le chrono ; le gel se fait même si on la ferme.
   - l. 183 : le verrou joue si la régate existe dans l’onglet Régates, ouverte ou non.
   - l. 286 : « Fermer la régate ou en ouvrir une autre retire ses bouées ».
   - Tableau de l’onglet Régates :
     - « Ouvrir » ouvre la régate : fiche, manches, IC, 🏁, manche choisie ;
     - « Fermer la régate » revient à l’Entraînement libre ;
     - « Ouvrir une régate » mène à la liste ;
     - « Supprimer cette régate » supprime la régate ouverte.
   - « Archive partagée » : la régate ouverte reste propre à chaque téléphone ; l’ouvrir ou la fermer ne change rien chez les autres.
   - Dépannage l. 574 : chercher dans « Terminées » ; classement En préparation, En cours, Terminées.
   - Plus aucune occurrence de « régate courante » dans guide.html ni dans l’aide.
3. `tests/guide.test.mjs` : on ajoute des repères, on n’en retire aucun, et chaque remplacement est au moins aussi strict.
   - EXIGEES : 'Entraînement libre', 'Aucune régate ouverte', 'En préparation', 'Terminées', 'Fermer la régate', 'ne change rien chez les autres'.
   - INTERDITES : [/régate courante/i, 'libellé retiré en v37 : régate ouverte'] et [/Aujourd’hui, À venir, Passée/, 'ancien classement de la liste'].
   - MESSAGES_DE_L_APP : 'Aucune régate ouverte', 'Entraînement libre', 'Retour à l’entraînement libre'.
   - BOUTONS : 'Ouvrir', 'Ouvrir une régate', 'Fermer la régate'.
   - Bulle « Régates » : remplacer /Passée\./ par /En préparation, En cours, Terminées/ ; garder l’interdiction de /Passées/ et ajouter celle de /Passée/.
   - Liste de l’aide : remplacer 'premier jour de la régate courante' par 'premier jour de la régate ouverte' ; ajouter 'Entraînement libre' et 'Fermer la régate'.
   - Le test « aucune formule interdite » couvre aussi le texte de l’aide.
4. `npm run stamp`, puis `npm run check` et `PW_REQUIRED=1 node tools/regate-e2e.mjs guide accueil`. Commit atomique des textes.
5. Livraison, depuis la racine, sur la branche apercu-phase-05 (main + commit du contexte), dans cet ordre, en s’arrêtant au premier échec :
   1. `git diff --quiet f80c365 -- js/courses.js tests/reference/` : la référence SNPM n’a pas bougé ;
   2. `npm run check` ;
   3. `PW_REQUIRED=1 node tools/regate-e2e.mjs` : tous les scénarios ;
   4. `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : « RÉSULTAT : OK » ;
   5. `npm run release -- "accueil en entraînement libre, régates ouvertes depuis l’onglet"` (66 caractères, sans < ni >) → v37 ;
   6. `RT_STRICT=1 node tools/stamp.mjs --check`, puis `VERCEL_ENV=production npm run gate` ;
   7. de nouveau `git diff --quiet f80c365 -- js/courses.js tests/reference/` ;
   8. commit de la version, en français, avec en fin de message les lignes d’attribution du rappel de session ;
   9. `git push origin apercu-phase-05`.
   Aucune mise en production : l’orchestrateur ouvre la PR, et Romain décide par « publie ».
  </action>
  <verify>
    <automated>npm run stamp && npm run check && PW_REQUIRED=1 node tools/regate-e2e.mjs guide accueil && git diff --quiet f80c365 -- js/courses.js tests/reference/</automated>
    <fails_when>code de sortie non nul, une ligne « not ok » (dont un span.k absent du code, « régate courante » encore présent, un bouton ou un message absent du guide), un scénario « ÉCHEC », ou un diff de la référence SNPM ; puis, à la livraison : « Bilan » différent de N/N, « RÉSULTAT : ÉCHEC » de measure-boot, échec de `RT_STRICT=1 node tools/stamp.mjs --check` ou de `VERCEL_ENV=production npm run gate`, ou push refusé</fails_when>
  </verify>
  <acceptance_criteria>
- npm test passe avec les nouveaux repères du guide et de l’aide. « régate courante » est absent de guide.html et du texte de l’aide (test INTERDITES). Les boutons « Ouvrir », « Ouvrir une régate » et « Fermer la régate » sont dans le guide en span.k et dans le code.
- release.json porte n = 37 et la note de livraison. sw.js et js/version.js sont régénérés. `RT_STRICT=1 node tools/stamp.mjs --check` et `VERCEL_ENV=production npm run gate` passent.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs` affiche « Bilan : N/N ». `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` affiche « RÉSULTAT : OK », médiane de l’interface utile sous 2000 ms.
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort 0, avant et après la version.
- La branche apercu-phase-05 est poussée. main n’est pas touchée.
  </acceptance_criteria>
  <done>Le guide et l’aide disent la nouvelle ouverture avec les libellés exacts de l’app. La v37 est prête sur l’aperçu, vérifiée de bout en bout, et poussée. La production attend le « publie » de Romain.</done>
</task>

</tasks>

## Artifacts this phase produces

| Fichier | Ce qu’il apporte | Tâche |
|---------|------------------|-------|
| js/regates.js | openAtBoot, openRegatta, openOnNewDay, groupByStatus, GROUP_LABEL, STATUS_LABEL (En préparation / En cours / Terminée), index sans current, lockDates sur la liste | 1, 2 |
| js/regview.js | listHTML par statut avec « Ouvrir » et « Ouverte », noRegattaHTML (#rgNone) | 1 |
| js/archsync.js | applyDoc sans état d’ouverture | 1 |
| js/app.js | OPEN, openReg, setOpen, openGesture, paintRegBar, dayOpenTick ; renderIC en deux modes ; bulle « Régates » | 1, 2, 3 |
| index.html, styles.css | bandeau #regBar, liste par statut | 1 |
| tests/regates.test.mjs | règle d’ouverture, migration, vues, équivalence du verrou, passage de jour, gardes statiques | 1, 2 |
| tests/archsync.test.mjs, tests/apiarchive.test.mjs | aucun current dans l’état, le document envoyé, la réponse ni le magasin | 1, 2 |
| tests/boot.test.mjs | garde dayOpenTick dans raceTick | 2 |
| tools/regate-e2e.mjs | scénarios accueil, jour-j, deux-telephones ; gpx étendu ; helpers ouvreRegate et regateOuverte ; scénarios existants à jour | 1, 2 |
| guide.html, js/help.js, tests/guide.test.mjs | textes et repères de la v37 | 3 |
| sw.js, js/version.js, release.json | v37 générée | 1, 2, 3 |

## Multi-source coverage audit

| Source | Élément | Couvert par |
|--------|---------|-------------|
| CONTEXT | D-A1 entraînement libre, « Aucune régate ouverte » avec bouton vers la liste | Tâche 1 (P-04, #rgNone, #regGo, scénario accueil) |
| CONTEXT | D-A2 liste En préparation / En cours / Terminées, « Ouvrir », « Nouvelle régate », nom en tête, « Fermer la régate » | Tâche 1 (groupByStatus, listHTML, #regBar) ; Tâche 3 (guide) |
| CONTEXT | D-A3 jour J ouvert sans geste | Tâche 1 (openAtBoot) ; Tâche 2 (openOnNewDay, scénario jour-j) |
| CONTEXT | D-A4 pas de mémoire, état local jamais partagé | Tâche 1 (OPEN, migrate) ; Tâche 2 (tests document et magasin, scénario deux-telephones) |
| CONTEXT | D-A5 SNPM plus ouverte d’office, dans « Terminées », rouvrable avec traces et débrief, rien supprimé | Tâche 1 (migrate réécrit l’index v36, accueil (e)) ; Tâche 2 (gpx étendu) |
| CONTEXT | Contraintes : verrou et « rien pendant une course » indépendants ; référence SNPM ; ouverture < 2 s ; compatibilité v36 ; guide et aide | Tâche 2 (lockDates, équivalence, jour-j (2)) ; Tâche 3 (garde SNPM, measure-boot, guide) |
| REQ | REG-01, ARCH-01, ARCH-02, FIAB-01, FIAB-06 | Tâches 1 à 3 |
| Orchestrateur | Questions 1 à 6, livraison (check, garde SNPM, tous les scénarios, measure-boot, release v37, stamp strict, gate, commit, push) | P-01 à P-07 ; Tâche 3 point 5 |

Aucun élément différé dans CONTEXT. Aucun élément non couvert.

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| téléphone → archive partagée (/api/archive) | ce qu’un téléphone envoie arrive sur les deux autres ; un état d’écran ne doit pas y passer |
| données d’un autre téléphone → page | noms de régates reçus et affichés dans le bandeau et la liste |
| app → verrou de course et gel | un état d’écran qui piloterait le verrou ou le gel pourrait les lever ou les perdre un jour de régate |
| horloge du téléphone → règle d’ouverture | jour de Paris calculé depuis l’heure du téléphone |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261022-01 | Information disclosure / Tampering | état « régate ouverte » dans le document partagé | medium | mitigate | OPEN en mémoire seulement ; index et document sans current ; tests buildDoc, applyDoc et magasin ; scénario deux-telephones qui inspecte chaque PUT (tâches 1 et 2) |
| T-261022-02 | Tampering (XSS) | nom de régate venu d’un autre téléphone, affiché dans #regBar et la liste | high | mitigate | #regBar en textContent seulement (garde statique) ; listHTML et noRegattaHTML par escHTML, test du nom piégé sans balise ni attribut on… (tâche 1) |
| T-261022-03 | Denial of service (sécurité en mer) | verrou « journée de régate » lié à la régate ouverte | critical | mitigate | lockDates sur la seule liste ; test d’équivalence avec la v36 ; jour-j (2) vérifie « Course finie » après « Fermer la régate » (tâche 2) |
| T-261022-04 | Denial of service (perte de données) | gel du vent du jour sans régate ouverte | high | mitigate | freezeTick sur la régate du jour de la liste ; jour-j (2) vérifie la copie d’un relevé après fermeture (tâche 2) |
| T-261022-05 | Tampering (intégrité de la course, D-03) | ouverture automatique ou échange pendant une course | high | mitigate | setOpen sans saveReg ni synchronisation (garde) ; dayOpenTick seulement hors course et hors saisie ; jour-j (4) vérifie qu’il n’y a pas d’ouverture pendant un chrono (tâche 2) |
| T-261022-06 | Repudiation | régate ouverte ou fermée sans trace | low | mitigate | note('regate', …) au journal de diagnostic, identifiant seulement |
| T-261022-07 | Denial of service | ouverture plus lente hors réseau | medium | mitigate | bandeau construit au temps 1 sans calcul ; une seule réécriture de l’index ; measure-boot à la livraison (tâche 3) |
| T-261022-08 | Tampering | heure du téléphone fausse, régate ouverte un autre jour | low | accept | comportement identique à la v36 (statut, verrou et gel au jour de Paris du téléphone) ; « Fermer la régate » corrige d’un geste |
| T-261022-SC | Tampering | installations npm/pip/cargo | high | mitigate | aucune installation dans ce plan ; Playwright et Chromium restent hors dépôt (tools/pw.mjs) ; toute installation passerait par le portail de légitimité des paquets |
</threat_model>

<verification>
Après la tâche 3, sur `apercu-phase-05` :
1. `git diff --quiet f80c365 -- js/courses.js tests/reference/` sort 0.
2. `npm run check` est vert.
3. `PW_REQUIRED=1 node tools/regate-e2e.mjs` affiche « Bilan : N/N », avec accueil, jour-j, deux-telephones et gpx, sans violation CSP ni chemin refusé.
4. `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` affiche « RÉSULTAT : OK ».
5. `npm run release -- "accueil en entraînement libre, régates ouvertes depuis l’onglet"` produit la v37.
6. `RT_STRICT=1 node tools/stamp.mjs --check` puis `VERCEL_ENV=production npm run gate` sont verts.
7. Commit et `git push origin apercu-phase-05`. Pour les empreintes, seul le test existant « aucune empreinte hors de middleware.js » fait foi ; ne jamais en afficher une.

Après le « publie » de Romain, l’orchestrateur vérifie en production sur iPhone :
- ouverture en « Entraînement libre » ;
- la Coupe SNPM dans « Terminées » ;
- « Ouvrir » et « Fermer la régate » ;
- un autre téléphone inchangé.

Règle des 48 h : régate des 7-9 novembre, gel le 2 novembre.
</verification>

<success_criteria>
- Un jour sans régate, l’app s’ouvre en « Entraînement libre », et tout ce qui sert en mer marche sans régate (D-A1).
- La liste est classée En préparation, En cours, Terminées, avec « Ouvrir ». La régate ouverte a son nom en tête et « Fermer la régate » (D-A2).
- Le jour J, la régate est ouverte sans geste, au lancement comme au passage de jour (D-A3).
- La régate ouverte n’est écrite ni dans l’index ni dans le document partagé, et chaque lancement repart en entraînement (D-A4).
- La Coupe SNPM n’est plus ouverte d’office, reste dans « Terminées » avec ses traces et son débrief, et rien n’est supprimé (D-A5).
- Le verrou, le gel, le rattachement des traces et « rien pendant une course » sont inchangés.
- L’ouverture reste sous 2 s hors réseau, et la référence SNPM est intacte.
- La v37 est poussée sur l’aperçu.
</success_criteria>

<output>
Créer `.planning/quick/261022-acc-accueil-hors-regate/261022-acc-SUMMARY.md`. Y consigner :
- les décisions P-01 à P-08 ;
- la liste, scénario par scénario, des ouvertures explicites ajoutées et des lectures de la régate ouverte déplacées vers #regBar ;
- le bilan Chromium et la médiane de measure-boot ;
- le numéro et le hachage de la v37, les commits et la branche poussée.
Ni code d’accès, ni empreinte.
</output>
