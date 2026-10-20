---
phase: quick-261020-eaq
plan: 01
subsystem: guide-equipage
tags: [guide, documentation, html, tests, playwright, v33, apercu-vercel]

requires:
  - phase: 05-avant-la-regate
    provides: "v32 : fonctions décrites par le guide (régates, archive partagée, IA bornée, rattrapage des traces, verrou de mise à jour, voyants, mode départ)"
provides:
  - "guide.html refait : sommaire collant, encadré « En 1 minute », journée de régate en 7 temps, référence en 9 parties, version imprimable"
  - "tests/guide.test.mjs : garde de structure, d’autonomie, de phrases exigées ou interdites, d’exactitude des libellés, des messages et de couverture des boutons"
  - "scénario guide de tools/regate-e2e.mjs : rendu sur téléphone 390 × 844 et en paysage, ancres, aucune requête extérieure, impression"
  - "release v33 « guide de prise en main refait » poussée sur apercu-phase-05 (production inchangée)"
affects: [recette de Romain sur iPhone, décision de mise en production (avant le gel du 2 novembre), aide intégrée js/help.js]

# Mesures (#3968) : commits comptés depuis le registre posé avant le premier commit de la tâche
plan_head_before: e4536046502c3d1482bbdae674aef6c951b2f57c
plan_head_after: 77b1902bfa7ff15bc06f30f336de90bb8d430479

actuals:
  tokens: 31000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "span.k réservé aux libellés de l’app recopiés tels quels ; test qui les retrouve dans index.html, regles.html, acces.html, js/*.js et api/*.js"
    - "tableaux à quatre colonnes empilés sur téléphone (table.empile, étiquettes data-l)"

key-files:
  created: [tests/guide.test.mjs]
  modified: [guide.html, tools/regate-e2e.mjs, sw.js, js/version.js, release.json]

key-decisions:
  - "L’encadré « En 1 minute » vient avant le sommaire détaillé : sur un iPhone 390 px, il est visible à l’ouverture, la barre collante donne déjà le sommaire cliquable"
  - "Chaque écart entre l’ancien guide et le code est tranché par le code (liste plus bas) ; rien n’est décrit qui n’existe pas dans la v32"
  - "Le guide ne promet jamais que l’IA ne garde rien : « OpenAI ne garde pas les réponses » et la surveillance des abus jusqu’à 30 jours (docs/ia-budget.md)"

patterns-established:
  - "Un message de l’app cité dans le guide est listé dans MESSAGES_DE_L_APP du test : écrit dans le guide ET retrouvé dans le code"
  - "Inventaire des boutons dans BOUTONS du test : un bouton ajouté à l’app sans être dans le guide se voit à la relecture de l’inventaire"

requirements-completed: ["261020-eaq"]

coverage:
  - id: D1
    description: "Guide dans l’ordre d’une journée de régate (installer, veille, matin, départ, course, après, autres clubs) avec sommaire et « En 1 minute »"
    requirement: "261020-eaq"
    verification:
      - kind: unit
        ref: "tests/guide.test.mjs#structure : page française pour téléphone, un seul titre, 17 sections dans l’ordre, ancres toutes résolues"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs guide"
        status: pass
    human_judgment: false
  - id: D2
    description: "Référence complète : onglets et boutons, voyants, IA, archive, sans réseau, journal, iPhone, dépannage, limites"
    requirement: "261020-eaq"
    verification:
      - kind: unit
        ref: "tests/guide.test.mjs#couverture : chaque bouton de l’app figure dans le guide, en style touche"
        status: pass
      - kind: unit
        ref: "tests/guide.test.mjs#exactitude : chaque libellé en style touche (span.k) existe dans le code de l’app"
        status: pass
      - kind: unit
        ref: "tests/guide.test.mjs#messages : chaque message cité par le guide est celui de l’app"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clarté pour un équipier sur le pont : « très très clair et exhaustif »"
    verification: []
    human_judgment: true
    rationale: "Seul Romain peut dire si le guide est clair sur son iPhone (app installée et Safari) ; aucun test ne mesure la clarté d’un texte"

duration: 36min
completed: 2026-10-20
status: complete
---

# Quick 261020-eaq : guide de prise en main refait

**guide.html réécrit pour l’équipage : « En 1 minute », puis la journée de régate pas à pas, puis tous les boutons, voyants, messages et limites, chaque libellé retrouvé dans le code de la v32 (154 libellés distincts, 430 citations, aucune absente) ; v33 poussée sur apercu-phase-05, production inchangée.**

## Performance

- **Durée :** environ 36 min
- **Tâches :** 3 sur 3
- **Fichiers :** 6 modifiés ou créés (guide.html, tests/guide.test.mjs, tools/regate-e2e.mjs, sw.js, js/version.js, release.json)
- **Taille du guide :** 113 Ko, environ 11 500 mots ; 74 000 px de haut sur un téléphone de 390 px ; 36 pages A4 à l’impression

## Accomplissements

- **Sommaire et « En 1 minute » (C-01)** : barre collante de 18 liens courts, encadré de huit gestes numérotés visible dès l’ouverture, puis sommaire détaillé (une ligne d’explication par section).
- **Journée de régate (C-02 à C-08)** : installer et se connecter (lien personnel, écran d’accueil, version, bandeau « Mettre à jour », verrou du jour de régate) ; la veille (régate, manches, IC, vent, parcours, synchronisation) ; le matin (vent figé, ⟳, son, voyants, réglages, Open GPX Tracker) ; au départ (mode départ, ligne, chrono, bips, flash, deux verrous à ne pas confondre) ; en course (GPS, bouées à confirmer, relevé de vent, trace, « Ce qui ne s’échange pas pendant une course ») ; après (rentrer au port dans l’ordre, Course finie, GPX, débrief, rapport, fiche, recalage des bouées) ; autres clubs (IC lues par l’IA, bouées « X1 ? »).
- **Référence (C-09 à C-14)** : treize tableaux de boutons (barre du haut, carte, animation, sept onglets, mode départ, fenêtres), tableau des quatre voyants, quatre usages de l’IA et leur repli, indicateur de l’archive (13 états), tableau « sans réseau », journal, réglages iPhone, 16 cartes de dépannage, limites honnêtes (iPhone verrouillé, GR1 et Carqueiranne, 25 nœuds, polaire extrapolée, IA faillible).
- **Forme (C-15)** : aucun script ni ressource extérieure, dans la liste hors réseau, impression propre (fond blanc, texte noir même en mode sombre, sans barre ni boutons), tableaux à quatre colonnes empilés sur téléphone.
- **Contrôles automatiques** : 7 tests dans tests/guide.test.mjs ; scénario `guide` de l’outil de bout en bout.
- **Livraison (C-18)** : v33, contrôle strict et porte de production verts, commit poussé sur origin/apercu-phase-05.

## Commits de tâche

1. **Tâche 1 : structure, garde de test, rendu sur téléphone** — `730412c` (docs)
2. **Tâche 2 : contenu complet vérifié contre le code** — `3a83678` (docs)
3. **Tâche 3 : v33 sur l’aperçu** — `77b1902` (docs), poussé : `git ls-remote` donne 77b1902 sur refs/heads/apercu-phase-05 ; main distant inchangé (3a4fa38)

Chaque commit embarque `sw.js` et `js/version.js` régénérés (leçon de la veille) : `npm run check` est vert à chaque commit.

## Écarts entre l’ancien guide et le code, tranchés par le code

| Sujet | Ancien guide | Code v32 (ce que dit le nouveau guide) |
|-------|--------------|----------------------------------------|
| Où lire la version | « sous le titre de l’app » | Fenêtre « ? », tout en bas : « Version v32 · 20/10 — note » (la ligne sous le titre dit l’âge des prévisions) |
| Délai d’envoi après une modification | « 20 secondes » (bulle : « dans la minute ») | 20 s (`scheduleSync(20000)`), jamais deux essais à moins de 30 s : « environ 20 secondes » |
| Jours de la barre du haut | « Auj. / Demain / jour suivant » ; 🏁 = jour de régate | Troisième bouton = jour abrégé ; 🏁 marque le premier jour de la régate courante seulement (`IC.date = dateStart`) |
| Libellés du mode départ en capitales | peut-être de la mise en capitales CSS | Écrits en capitales dans le code (BOUÉE, COMITÉ, SYNCHRO, DÉPART 5’) |
| Bouton d’aide | « ⓘ » | Le bouton affiche « i » |
| Annonces vocales | « 4 min, 1 min, 30 s, puis 10 à 1 » | 4, 3, 2 et 1 minutes, 30 et 20 secondes, 10, puis 5 à 1 |
| Calculs reportés de H−6 min à H+1 min | « analyse après un ping de ligne » | Faux : le ping est un geste, calculé tout de suite. Reportés : ceux de l’ouverture de l’app et ceux qui suivent un téléchargement de prévisions sans geste |
| Classement des régates | « À venir, Aujourd’hui et Passées » | Aujourd’hui, À venir, Passée (singulier) |
| Marque à confirmer en mode départ | « Marque 3 ? » | « Marque N ? », N = numéro d’ordre de passage |
| Bord ambigu du débrief | « au près ou au portant ? » | Fenêtre « Une précision » : Au près / Au portant, puis Continuer |
| Flash en « Plein soleil » | « noir » | Sombre (classe `dark`) |
| Bouton « Bips » du mode départ | non précisé | Coupe seulement les bips « à brûler » (les bips du chrono continuent) |
| Voyant RÉSEAU orange | boutons sans « Vérifier » | Le bouton « Vérifier » existe |
| Route d’un bord | « trait plein » | Le code dit « pointillés bleus » : détail retiré, « affichée seule avec ses lay-lines » |
| « Ligne non pinguée » | « tant que le ping n’est pas fait » | Affiché seulement quand aucune ligne n’est connue ; l’état des pings est dans ⚙ (« Comité pingué ✓ ») |
| « AU-DESSUS ! » | « dans la dernière minute » | Dès que l’étrave est du côté parcours ; bip grave et voix dans la dernière minute |
| Levée du verrou de mise à jour | « 1 h d’inactivité » | Une heure après la dernière activité de la journée (après 9 h) ou 🏁 Course finie |
| Retour au port | ⏹ puis Course finie | Ajout de « Arrêter le GPS », Stop et ✕ : le GPS reste actif après ⏹ et après ✕, et l’app se croit « en course » |

## Écarts repérés dans l’aide intégrée (à traiter dans une tâche ultérieure, js/help.js non modifié)

1. **js/help.js, GUIDE, point « Régates »** : « recalages des bouées et résumés du vent du jour sont partagés » omet les traces, débriefs et rapports (partagés depuis la v31, la bulle `SYNC_TIP` les cite).
2. **js/help.js, GUIDE, point « Départ »** : rien sur ⛵ Mode départ plein écran, les boutons Top 5’ / Top 4’ / Top 1’ ni Tester le son.
3. **js/help.js, GUIDE** : rien sur 🏁 Course finie, le bandeau « Mettre à jour » et le verrou du jour de régate, les quatre voyants, la limite d’IA du jour (30 appels), Open GPX Tracker, la limite de 25 nœuds.
4. **js/help.js, `STATIC_TIPS['#daySeg']`** : « (🏁 = jour de régate) ou après-demain » : 🏁 marque le premier jour de la régate courante et le troisième bouton porte le jour abrégé.
5. **js/help.js, `SYNC_TIP`** : n’explique pas « Pas encore synchronisé », « Synchronisation à relancer », « Plafond du jour atteint · reprise demain », « Code d’accès à renouveler », « Mettez l’app à jour pour synchroniser ».
6. **js/app.js (~l. 1997), bulle « Régates »** : « puis Aujourd’hui, À venir, Passées » ; le libellé affiché est « Passée ».
7. **js/app.js (~l. 1483), bulle « Mes traces »** : « Elles restent sur cet appareil » est périmé depuis la v31 : les traces rangées sont partagées avec l’équipage.
8. Le lien « 📖 Guide complet de l’équipage » de la fenêtre d’aide pourrait pointer vers `guide.html#minute`.

## Décisions

- Le guide cite « Open GPX Tracker » (application tierce) uniquement comme le faisait l’ancien guide : enregistrer en parallèle, puis Partager, Enregistrer dans Fichiers. Aucune fonction de cette application n’est inventée.
- La construction « 1 · Définir la ligne » décrit le ping comme prenant la position de l’étrave (`bow(q)` de js/startmode.js).
- L’indicateur de l’archive est documenté dans un tableau de 13 états, tous retrouvés dans `syncStatus` (js/archsync.js).

## Déviations par rapport au plan

### Ajouts (Règle 2 : rendre la garde plus stricte, sans rien affaiblir)

**1. [Règle 2 - garde] Deux tests de plus que le plan**
- **Trouvé pendant :** tâche 2
- **Ajout :** `messages` (chaque message cité par le guide est écrit dans le guide ET retrouvé dans le code, 39 messages) et `couverture` (les 125 boutons de l’inventaire du plan figurent en span.k et existent dans le code).
- **Fichier :** tests/guide.test.mjs (`3a83678`)

**2. [Règle 2 - garde] Formules interdites étendues**
- La promesse absolue est refusée aussi pour « ne garde rien / aucune donnée » (le plan citait « ne conserve rien »), et le test refuse la forme du code personnel et tout nom de modèle d’IA (consigne de la tâche : « aucun nom de modèle »).
- **Fichier :** tests/guide.test.mjs

**3. [Règle 3 - blocage] acces.html ajouté aux sources des libellés**
- Les libellés « Entrer » et « Votre code personnel » sont écrits dans acces.html, pas dans index.html : la liste du plan (index.html, regles.html, js/*.js, api/*.js) les aurait fait écrire en gras. acces.html est une page de l’app.
- **Fichier :** tests/guide.test.mjs

### Autres

- **Attribution des commits** : la consigne de la tâche demandait `Co-Authored-By: Claude Opus 5.5`, le rappel d’attribution de l’environnement donne `Claude Sonnet 5.5` (le modèle réellement utilisé). J’ai gardé celui de l’environnement, avec la ligne `Claude-Session` demandée. Aucun nom de modèle dans le guide, ses commentaires ni les messages de commit (hors ces lignes d’attribution).
- **Capture** : `GUIDE_SHOT` écrit la capture avant les clics sur les ancres, pour que la barre collante ne soit pas déjà défilée ; `scale: 'css'` (la page fait 74 000 px de haut à 390 px).
- **Pointeur distant** : `git fetch origin apercu-phase-05` ne met pas à jour `origin/apercu-phase-05` sur ce dépôt (aucun refspec de récupération configuré) ; j’ai relu la branche avec un refspec explicite pour la vérification finale. `git ls-remote` confirme 77b1902 sur le distant.
- **STATE.md et ROADMAP.md** non modifiés (consigne : l’orchestrateur s’en charge).

## Résultats des contrôles

- `node --test … tests/guide.test.mjs` : 7 tests verts ; `npm run check` : 541 tests verts, fichiers générés à jour.
- `node tools/regate-e2e.mjs guide` : « OK guide » (390 × 844 et 844 × 390 sans défilement horizontal, ancres résolues et section visible sous la barre, « En 1 minute » visible à l’ouverture, aucune requête hors 127.0.0.1, impression sans barre collante, fond blanc, texte noir). Contrôle négatif réalisé : un élément de 900 px fait échouer le scénario.
- Relecture à l’œil de la capture `guide-390.png` (titres, encadré, tableaux, voyants empilés) et de l’impression en PDF (36 pages A4) : corrections faites (tableaux voyants et IA empilés sur téléphone, espacement des touches).
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` : référence de la Coupe SNPM et bouées inchangées.
- `RT_STRICT=1 node tools/stamp.mjs --check` et `VERCEL_ENV=production npm run gate` : verts après la release v33.
- Push : `git ls-remote origin refs/heads/apercu-phase-05` = 77b1902 ; main distant = 3a4fa38 (inchangé) ; aucune PR ouverte.

## Known Stubs

Aucun : chaque section est rédigée, aucun texte d’attente.

## Threat Flags

Aucun : page statique, aucun script, aucune requête, aucune nouvelle route ; middleware.js non modifié. Aucun code d’accès, empreinte, nom de cookie, adresse de magasin ni nom de modèle dans le guide (gardé par test).

## Reste à faire par Romain

- Ouvrir `guide.html` sur l’aperçu `apercu-phase-05` depuis son iPhone (app installée et Safari), parcourir le sommaire et l’encadré « En 1 minute », dire si c’est « très très clair ». La production attend son « publie », avant le gel du 2 novembre.

## Self-Check: PASSED

- FOUND : guide.html, tests/guide.test.mjs, tools/regate-e2e.mjs, sw.js, js/version.js, release.json
- FOUND : 730412c, 3a83678, 77b1902 (ancêtres de HEAD)
