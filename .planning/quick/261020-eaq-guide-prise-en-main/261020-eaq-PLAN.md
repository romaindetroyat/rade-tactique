---
phase: quick-261020-eaq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - guide.html
  - tests/guide.test.mjs
  - tools/regate-e2e.mjs
  - sw.js
  - js/version.js
  - release.json
autonomous: true
requirements: ["261020-eaq"]

estimate:
  tokens: 150000
  raw_tokens: 150000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Ouvert sur un téléphone de 390 px de large, guide.html montre en tête un sommaire cliquable et l’encadré « En 1 minute », sans défilement horizontal, et chaque lien du sommaire mène à sa section (C-01, C-15)"
    - "Le guide suit l’ordre d’une journée de régate : installer et se connecter → la veille → le matin → au départ → en course → après la course → hors saison et autres clubs, puis la partie référence (C-02 à C-08)"
    - "La partie référence couvre chaque onglet et chaque bouton, les voyants et quoi faire au rouge, l’IA (dictée, débrief, arbitre, lecture d’IC, 30 appels par jour, repli sans IA), l’archive et la synchronisation, l’usage sans réseau, le journal de diagnostic, le dépannage et les limites (C-09 à C-14)"
    - "Chaque libellé de bouton écrit en style touche (span.k) dans le guide existe dans le code v32 (index.html, regles.html, js/*.js, api/*.js) : rien n’est inventé (C-16)"
    - "Le guide ne charge rien d’extérieur, n’a aucun script, s’ouvre hors réseau (il est dans le SHELL de sw.js) et s’imprime proprement (C-15)"
    - "Les phrases exigées par tests/regates.test.mjs restent présentes et aucune formule interdite, aucun code d’accès, empreinte, nom de cookie ou adresse de magasin n’apparaît (C-17)"
    - "La v33 « guide de prise en main refait » est poussée sur la branche apercu-phase-05 ; la production reste inchangée jusqu’au « publie » de Romain (C-18)"
  artifacts:
    - path: "guide.html"
      provides: "Guide de prise en main refait : sommaire, En 1 minute, journée de régate pas à pas, référence complète"
      contains: "En 1 minute"
    - path: "tests/guide.test.mjs"
      provides: "Garde de structure et d’exactitude du guide (ancres, phrases exigées et interdites, libellés présents dans le code, aucune ressource extérieure)"
    - path: "tools/regate-e2e.mjs"
      provides: "Scénario « guide » : rendu sur téléphone 390 × 844, ancres, aucune requête extérieure, impression"
      contains: "guide"
    - path: "release.json"
      provides: "Version 33, note « guide de prise en main refait »"
      contains: "\"n\": 33"
  key_links:
    - from: "guide.html"
      to: "js/*.js, index.html, regles.html, api/*.js"
      via: "tests/guide.test.mjs : chaque span.k du guide est retrouvé dans les sources"
      pattern: "span class=\"k\""
    - from: "sw.js"
      to: "guide.html"
      via: "SHELL généré par tools/stamp.mjs (ROOT_FILES)"
      pattern: "guide.html"
    - from: "js/help.js"
      to: "guide.html"
      via: "lien « 📖 Guide complet de l’équipage » de la fenêtre d’aide"
      pattern: "href=\"guide.html\""
---

<objective>
Refaire `guide.html`, la page de prise en main de l’équipage de Rade Tactique, pour qu’elle soit très claire et exhaustive : toutes les fonctions de la v32, pas à pas, dans l’ordre d’une journée de régate, en français, puis une partie référence complète. Demande de Romain : « Je veux que tu refasses la page de prise en main de l’app pour être très très clair et exhaustif ».

Purpose: le jour de la régate CVAT (7-9 novembre), Romain, Teiva et Thibaud doivent trouver en quelques secondes quoi toucher, quand, et quoi faire si un voyant passe au rouge. Le guide actuel est juste mais rangé par fonction et incomplet (rien sur « Course finie », le verrou de mise à jour, le plein écran du rapport, les onglets Vent et J80, le dépannage, les limites).

Output: `guide.html` réécrit, `tests/guide.test.mjs` (garde), scénario `guide` dans `tools/regate-e2e.mjs`, v33 publiée sur la branche d’aperçu `apercu-phase-05` (commit + push ; la PR brouillon est ouverte par l’orchestrateur).

Exigences du contexte (identifiants de traçabilité utilisés dans les tâches) :
- C-01 Sommaire cliquable en tête et encadré « En 1 minute ».
- C-02 Installer l’app et se connecter : lien personnel, écran d’accueil, bandeau « Mettre à jour », jamais en course.
- C-03 La veille : ouvrir la régate, IC relues, manches, vent et routage, télécharger pour le hors réseau.
- C-04 Le matin : vent du jour figé, voyants, « Tester le son », Open GPX Tracker en parallèle.
- C-05 Au départ : mode départ, chrono, bips, ping de ligne, verrou de course.
- C-06 En course : GPS, trace, bouées, ce qui ne s’échange pas pendant une course.
- C-07 Après : « Course finie », GPX, débrief, rapport, recalage des bouées, synchronisation, archive.
- C-08 Hors saison et autres clubs : IC d’un autre club lues par l’IA, bouées à confirmer.
- C-09 Référence : chaque onglet et chaque bouton, avec ce qu’il fait.
- C-10 Les voyants et quoi faire quand l’un est rouge.
- C-11 L’IA : dictée, débrief, arbitre, lecture d’IC ; 30 appels par jour et son message ; repli hors IA ; « OpenAI ne garde pas les réponses ».
- C-12 Archive et synchronisation (ce qui est partagé, quand, interrupteur, Historique, lecture hors réseau) ; usage hors réseau ; journal de diagnostic.
- C-13 Dépannage : pas de son, GPS absent, app ancienne version, synchronisation en attente, limite d’IA atteinte, régate absente, trace non rangée.
- C-14 Limites honnêtes : iPhone verrouillé → Open GPX Tracker ; GR1 et Carqueiranne « à confirmer » ; vent jusqu’à 25 nœuds.
- C-15 Forme : mobile d’abord, imprimable, aucune ressource extérieure, sans JavaScript, hors réseau (SHELL), style actuel conservé, HTML sémantique simple.
- C-16 Exactitude : chaque libellé et comportement vérifié contre index.html et js/*.js de la v32 ; aucune fonction inventée.
- C-17 Phrases exigées et interdites par les tests ; aucun secret.
- C-18 Livraison : stamp, check, rendu téléphone, référence inchangée, release v33, contrôle strict, porte de production, commit et push sur apercu-phase-05, pas de production.
</objective>

<execution_context>
@/home/user/toc/.claude/gsd-core/workflows/execute-plan.md
@/home/user/toc/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@guide.html
@index.html
@js/help.js
@README.md
@docs/ia-budget.md
@acces.html

Sources à consulter pendant la rédaction (lecture ciblée par grep puis offset/limit, jamais en entier sans besoin) :
- `js/app.js` (2 236 lignes : onglets, rendus renderBrief, renderCourse, renderStart, renderLive, Traces, Régates, bandeau de mise à jour ligne ~812, carte « Course finie » ligne ~1227, rapport « Plein écran » ligne ~1468, import GPX ligne ~1486)
- `js/startmode.js`, `js/status.js` (voyants), `js/racelock.js` (verrou du jour de régate : 9 h Paris, « Course finie », 1 h d’inactivité, H−6 min à H+1 min), `js/swupdate.js`, `js/archsync.js` (textes de l’indicateur), `js/archheavy.js`, `js/regview.js` (fiche de régate), `js/regmarks.js`, `js/marks.js`, `js/icread.js`, `js/voice.js`, `js/debrief.js`, `js/j80.js`, `js/reprise.js`, `js/journal.js`, `js/diag.js`, `js/polar.js` (polaire ORC 6–20 nœuds, 4 et 25 nœuds extrapolés)
- `api/_ia.js` (messages exacts de limite et de budget), `regles.html` (arbitre : « Demander », questions proposées, 🔊)
- Résumés des phases : `.planning/phases/0[1-5]-*/*-SUMMARY.md` (24 fichiers ; lire l’en-tête et la section des réalisations de chacun pour ne rien oublier de v26 à v32)

<interfaces>
Inventaire de départ des libellés de boutons statiques (extrait des `<button>` de js/*.js le 2026-10-20 ; les libellés construits avec `${…}` n’y sont pas : les relever à part) :
+1 min · −1 min · +5° · −5° · +10° · −10° · 1 min · 4 min · 5 min · Ajouter la manche · Analyser · Annuler · Arrondir · Arrondir à la minute · Arrêter le GPS · Arrêter le chrono · Bips · Bouée ici · Chiffres · Choisir cette manche · Comité ici · Confirmer · Continuer · Copier · Créer la régate · Détacher · Enregistrer le relevé · Exporter GPX · Fermer · GPX · Ignorer · Ligne · Ligne théorique · Marque passée ▶ · ◀ Marque précédente · Masquer · Modifier · OK · Partager · Partager le rapport · Partager… (WhatsApp, Messages) · Plein soleil · Plein écran · Polaire par défaut · Position d’origine · Ranger… · Recaler · Relevé de vent ici… · Relevés · Revenir au plan initial · Règles du départ (P, I, U, Z, noir) · Stop · Supprimer cette régate · Synchroniser · Top 1’ · Top 4’ · Top 5’ (avertissement) · Télécharger pour le hors réseau · Valider · Valider les IC · Vider · Voir · Voir la trace · Voir sur la carte · Voix · ↻ Recalculer · ↻ Recalculer la suite depuis ma position · ⏹ Arrêter et enregistrer · ⏺ Enregistrer ma trace · ▶ Activer le GPS · ▶ Animer le parcours · ▶ Rejouer la trace · ⚙ · ⚡ Flash visuel · ⤓ Importer un fichier GPX · ＋ Ajouter une manche · ＋ Nouvelle régate · 🎤 · 🏁 Course finie — retour au port · 📄 Voir le débrief · 📍 Ping Bouée (GPS) · 📍 Ping Comité (GPS) · 🔊 Tester le son · 🔓

Barre du haut et carte (index.html) : jours `#daySeg`, curseur d’heure, « Prévision » / « Manuel », ⟳ (Mettre à jour la météo), ⤴ (Partager), ? (Aide) ; boutons de carte 2D, 3D, ⌖, ◎, ☰ et calques (Carte du vent (couleurs), Filets de vent animés, Routes optimales, Noms des lieux, Relief (exagération)) ; lecture d’animation ⏸, ×½ ×1 ×2 ×4, ◎, ✕. Onglets : Briefing, Parcours, Départ, En course, Traces, Vent, J80, Régates.

Bandeau de mise à jour : « Nouvelle version vN · note » + bouton « Mettre à jour » (js/app.js ~812). Indicateur d’archive (js/archsync.js) : « À jour », « En attente d’envoi », « Hors réseau · n modification(s) en attente », « En pause pendant la course », « Archive non configurée », suffixe « (essai) ». Messages d’IA (api/_ia.js) : « Limite d’IA du jour atteinte — reprise demain », « Budget d’IA du mois atteint — l’IA reprend le mois prochain ».

Écarts déjà repérés entre l’ancien guide et le code, à trancher par le code : délai d’envoi après une modification (guide « 20 secondes » ; `scheduleSync(20000)` dans js/app.js, bulle SYNC_TIP « dans la minute ») ; jours affichés (guide « Auj. / Demain / jour suivant », bulle « aujourd’hui, demain, après-demain ») ; libellés du mode départ écrits en capitales dans l’ancien guide (BOUÉE, COMITÉ, SYNCHRO, DÉPART 5’) qui peuvent venir d’une mise en capitales CSS ; « ⓘ » de l’ancien guide alors que le bouton d’aide affiche « i ».
</interfaces>
</context>

<tasks>

<task type="tracer">
  <name>Task 1 : structure définitive du guide, garde de test et rendu sur téléphone (chemin complet de bout en bout)</name>
  <files>guide.html, tests/guide.test.mjs, tools/regate-e2e.mjs</files>
  <read_first>guide.html (en entier), tests/regates.test.mjs lignes 560-581 (phrases exigées et interdites, fonction rendu), tools/regate-e2e.mjs lignes 1-75 et 1029-1060 puis 1856-1911 (ouvreContexte, ouvrePage, sansErreur, scénario arbitre qui ouvre une page autre que l’app, registre SCENARIOS), tools/stamp.mjs ligne 13 (ROOT_FILES), tests/helpers/setup.mjs (import de linkedom)</read_first>
  <action>
But : poser d’un coup la forme finale de la page et ses deux contrôles automatiques, avec tout le contenu actuel encore vrai déjà rangé à sa nouvelle place, pour que la tâche 2 n’ait plus qu’à compléter et vérifier le fond.

1. guide.html — nouvelle structure (C-01, C-15). Garder le `<head>` (lang fr, viewport, icônes locales), le bloc `<style>` et ses variables, le bandeau `header.hero` (boutons « Ouvrir l’app » et « Règles de course ») et le pied de page. Mettre à jour le commentaire de tête du CSS (« mode d’emploi dans l’ordre d’une journée de régate, puis référence »). Ajouter au CSS : un style pour l’encadré `.minute` (fond `--tip`, bord `--accent`, liste numérotée grosse et aérée), un style `.sommaire` (deux listes : « La journée de régate » et « Référence », liens larges faciles à toucher), et un bloc `@media print` qui cache `nav.toc` et les boutons `.open`, force fond blanc et texte noir même en mode sombre, empêche la coupure des `.card`, `.tip`, `tr` (`break-inside: avoid`) et réduit les marges. Aucune police, image ou feuille extérieure ; aucun `<script>`.
   Sections, dans cet ordre, avec ces identifiants exacts (le test les exige) : `minute` « En 1 minute » ; partie « La journée de régate, pas à pas » : `installer` (1 · Installer l’app et se connecter), `veille` (2 · La veille), `matin` (3 · Le matin, avant de partir), `depart` (4 · Au départ), `course` (5 · En course), `apres` (6 · Après la course), `ailleurs` (7 · Hors saison et autres clubs) ; partie « Référence » : `onglets` (Tous les onglets et tous les boutons), `voyants` (Les voyants), `ia` (L’IA de l’app), `archive` (Archive partagée et synchronisation, avec une carte dont le titre est « Lire une régate hors réseau »), `horsreseau` (Sans réseau), `journal` (Journal de diagnostic), `reglages` (Réglages iPhone), `depannage` (Dépannage), `limites` (Limites à connaître). La barre collante `nav.toc` garde des libellés courts (1 min, Installer, Veille, Matin, Départ, Course, Après, Autres clubs, Onglets, Voyants, IA, Archive, Sans réseau, Journal, iPhone, Dépannage, Limites, Règles ↗). En tête de `main`, un `nav.sommaire` (aria-label « Sommaire détaillé ») liste toutes les sections avec une ligne d’explication chacune.
   Ranger dans ces sections toutes les cartes actuelles encore vraies (installer → installer ; régates, manches, IC, Lire avec l’IA → veille ou ailleurs ; vent figé → matin ; cartes du mode départ → depart ; cartes En course → course ; traces, débrief, rapport, fiche, recalage → apres ; IA → ia ; Archive partagée et Lire une régate hors réseau → archive ; Journal → journal ; Réglages iPhone → reglages ; Questions → depannage). L’encadré « En 1 minute » reçoit 7 à 8 étapes numérotées (installer par le lien personnel et l’écran d’accueil ; la veille : régate courante, IC validées, Synchroniser jusqu’à « À jour » ; le matin : ouvrir l’app avant le départ, ⟳, 🔊 Tester le son, verrouillage automatique sur Jamais, lancer Open GPX Tracker ; au départ : ⛵ mode départ, pings, Top 5’ ; en course : GPS et ⏺ Enregistrer ma trace ; après : 🏁 Course finie — retour au port, trace, débrief ; un souci : ? puis Journal de diagnostic envoyé à Romain), libellés vérifiés dans le code avant d’être écrits.
   Convention de balisage (C-16) : `span.k` est réservé aux libellés de l’app recopiés tels qu’ils sont dans le code (emoji compris) ; les libellés d’iOS ou d’Android (Réglages, Sur l’écran d’accueil, Jamais…) et les messages cités vont en `<b>` ou entre « ». Apostrophe typographique ’ partout dans le texte visible.

2. tests/guide.test.mjs — nouvelle garde (node:test, `parseHTML` de linkedom comme tests/regates.test.mjs, en-tête de module en français). Tests :
   (a) structure : `html[lang=fr]`, un seul `h1`, meta viewport ; chacun des 17 identifiants de section ci-dessus existe, dans cet ordre dans le document ; `#minute` contient une liste ordonnée d’au moins 5 étapes ; chaque section `section[id]` est liée depuis `nav.sommaire` et depuis `nav.toc` ; chaque lien `href="#…"` de la page mène à un élément existant.
   (b) autonomie : aucun `script`, `iframe`, `object`, `link[rel=stylesheet]` ; aucun attribut `src` ou `href` qui commence par http:, https: ou // ; aucun `@import` ni `url(` vers l’extérieur dans le style ; `sw.js` cite `guide.html` (page dans le SHELL hors réseau).
   (c) phrases : reprendre telles quelles les phrases exigées de tests/regates.test.mjs ligne 577 et ajouter « Archive partagée », « Historique », « Désactiver la synchronisation », « OpenAI ne garde pas les réponses », « Limite d’IA du jour atteinte — reprise demain », « En 1 minute », « Open GPX Tracker », « Course finie » ; reprendre les formules interdites de tests/regates.test.mjs lignes 578 et 580 (même expression régulière) et y ajouter la promesse absolue que l’IA ne garde aucune donnée (formule exacte donnée dans le contexte de la tâche rapide : le verbe « conserve » précédé de « ne » et suivi de « rien »), interdite par docs/ia-budget.md ; aucune suite de 64 caractères hexadécimaux.
   (d) exactitude des libellés : pour chaque `span.k` du guide, son texte normalisé (espaces repliés, U+FE0F retiré, apostrophes ASCII et typographiques confondues, comparaison sans tenir compte de la casse pour les libellés mis en capitales par CSS) se retrouve dans la concaténation de index.html, regles.html, js/*.js et api/*.js. Une liste d’exceptions commentée, de cinq entrées au plus, est permise pour un signe dessiné par CSS ; chaque entrée dit d’où vient le signe.
   (e) texte visible : `body.textContent` ne contient aucune apostrophe ASCII entre deux lettres.

3. tools/regate-e2e.mjs — scénario `guide` ajouté au registre SCENARIOS (C-15) : contexte `ouvreContexte(browser, { heure: '2026-11-07T07:30:00Z' })`, `ouvrePage`, relève de chaque requête de la page (toute requête vers un autre hôte que 127.0.0.1 fait échouer), `page.goto(base + 'guide.html')`. Vérifie : pas de défilement horizontal (largeur de défilement du document au plus égale à la largeur de la fenêtre), chaque image chargée, chaque lien `#…` résolu, `#minute` visible sans défiler sous le bandeau, aucune erreur de page (`sansErreur`) ; puis la même page en paysage 844 × 390 sans défilement horizontal ; puis `page.emulateMedia({ media: 'print' })` et `nav.toc` non affichée. Si la variable d’environnement `GUIDE_SHOT` donne un dossier, y écrire une seule capture PNG de la page entière en 390 px, nommée `guide-390.png` (rien d’autre). En-tête du fichier : ajouter le scénario à la liste documentée s’il y en a une. Ne rien changer aux autres scénarios.

Ne pas modifier js/help.js, index.html, middleware.js ni les fichiers générés à la main (sw.js, js/version.js).
  </action>
  <verify>
    <automated>node --test --import ./tests/helpers/setup.mjs tests/guide.test.mjs tests/regates.test.mjs && node tools/regate-e2e.mjs guide</automated>
  </verify>
  <done>guide.html a sa structure définitive (17 sections dans l’ordre, sommaire, En 1 minute, style d’impression) avec tout le contenu actuel encore vrai rangé ; tests/guide.test.mjs et tests/regates.test.mjs passent ; `node tools/regate-e2e.mjs guide` affiche « OK guide » et sort en 0.</done>
</task>

<task type="auto">
  <name>Task 2 : rédiger tout le contenu, vérifié contre le code de la v32 (journée de régate et référence)</name>
  <files>guide.html, tests/guide.test.mjs</files>
  <read_first>guide.html (état laissé par la tâche 1), puis pour chaque section les sources nommées dans le contexte du plan, par grep du libellé puis lecture des lignes autour ; les 24 résumés de phase (en-tête et réalisations) ; docs/ia-budget.md ; acces.html (texte visible seulement) ; regles.html (zone de l’arbitre)</read_first>
  <action>
Méthode (C-16) : avant d’écrire une phrase qui cite un bouton, un message ou un comportement, le retrouver dans le code (grep du libellé exact dans js/, index.html, regles.html, api/) et lire la fonction qui l’utilise. Tenir dans le carnet de travail de l’exécutant (hors dépôt) l’inventaire : libellé → fichier:ligne → ce qu’il fait. Partir de l’inventaire de `<interfaces>` et y ajouter les libellés construits avec `${…}` (fiche de régate, relecture des IC, bouées, trace, débrief, voyants). Une fonction absente du code n’est pas décrite ; un écart entre l’ancien guide et le code se tranche par le code et se note pour le résumé. Les écarts listés dans `<interfaces>` sont à trancher en premier.

Style (très clair) : phrases courtes à l’impératif (« Touchez », « Maintenez »), étapes numérotées, chaque carte commence par où l’on est (pastille `.where` : onglet ou écran), puis quoi toucher, puis ce que l’on voit ; une ligne « Pourquoi » quand le geste n’est pas évident ; une ligne « Si ça ne marche pas » qui renvoie à `#depannage`. Pas de jargon de développeur (aucun nom de fichier, de variable, de stockage ou de service). Apostrophe ’, séparateurs — et ·, comme le reste de l’app.

Contenu à écrire, section par section :
- `installer` (C-02) : ouvrir le lien personnel reçu de Romain (l’app reconnaît l’équipier un an sur cet appareil) ; sur iPhone, Safari puis Partager → Sur l’écran d’accueil, et si l’app est installée, entrer une fois le code personnel dans l’app elle-même (champ « Votre code personnel », bouton « Entrer » d’acces.html) ; Android et ordinateur ; où lire la version et vérifier que les trois téléphones ont la même ; bandeau « Nouvelle version vN · … » et bouton « Mettre à jour » appliqué seulement sur geste ; verrou de mise à jour du jour de régate (fermé de 9 h, heure de Paris, jusqu’à « 🏁 Course finie — retour au port » ou une heure sans activité, selon js/racelock.js et js/swupdate.js) ; ne jamais décrire le code ni la forme du lien.
- `veille` (C-03) : régate courante (＋ Nouvelle régate, Créer la régate, ＋ Ajouter une manche, Choisir cette manche), import et relecture des IC (puces, Valider les IC, Modifier), Briefing, Parcours (choix du parcours, classe, tours, bords, ▶ Animer le parcours), vent et routage, onglet Vent pour un scénario « Manuel », Synchroniser jusqu’à « À jour », Télécharger pour le hors réseau pour une régate ancienne, Partager ⤴ (lien, QR code), vérifier la version des trois téléphones.
- `matin` (C-04) : ouvrir l’app avant le départ pour figer le vent du jour (scellé au premier signal, possible en mode avion, « figé après le départ » si trop tard) ; ⟳ ; les quatre voyants et leur bande ; 🔊 Tester le son et ce que veut dire « pas entendu » ; réglages iPhone du jour (verrouillage automatique Jamais, mode silencieux, batterie) ; lancer Open GPX Tracker en parallèle de ⏺ Enregistrer ma trace, et pourquoi (écran verrouillé).
- `depart` (C-05) : onglet Départ (pings 📍 Ping Comité (GPS) et 📍 Ping Bouée (GPS), ligne théorique, Top 5’ (avertissement), Top 4’, Top 1’, Arrondir à la minute, Arrêter le chrono, Bips, Voix, Règles du départ) ; ⛵ mode départ plein écran (appui maintenu pour les pings, annulation, vent sur la ligne, chrono, synchro, bips et annonces, flash, À brûler, mode course 15 s après) ; distinguer clairement le verrou de l’écran 🔒 / 🔓 du mode départ et le verrou de mise à jour du jour de régate ; calculs longs reportés de H−6 min à H+1 min ; libellés tels qu’à l’écran.
- `course` (C-06) : ▶ Activer le GPS, prochaine marque, Marque passée ▶ et ◀ Marque précédente, ↻ Recalculer la suite depuis ma position, relevé de vent (🎤, Enregistrer le relevé), trace (⏺ Enregistrer ma trace, ⏹ Arrêter et enregistrer, rangement automatique), marques « 3 ? » et « 11 ? » à confirmer ; encadré « Ce qui ne s’échange pas pendant une course » : synchronisation en pause (« En pause pendant la course »), aucun téléchargement lourd la journée de régate jusqu’au retour au port, aucune mise à jour proposée, rattrapage reporté, recalculs automatiques reportés pendant la séquence.
- `apres` (C-07) : 🏁 Course finie — retour au port (où il apparaît, ce qu’il fait, ce qu’il n’arrête pas) ; arrêter la trace ; importer le GPX d’Open GPX Tracker (Fichiers, ⤓ Importer un fichier GPX, rangement, choix, Laisser sans régate, « Déjà importée ») ; pauses ; Débrief de course ; rapport (Partager le rapport, Plein écran, 📄 Voir le débrief) ; fiche de régate (Voir la trace, Détacher, Ranger…, Historique) ; Bouées à confirmer et Recaler / Position d’origine ; synchronisation qui repart ; journal de diagnostic à envoyer.
- `ailleurs` (C-08) : IC d’un autre club (Lire avec l’IA, réseau nécessaire, rien sans geste, relecture puis Valider les IC), bouées « X1 ? » à confirmer (Voir sur la carte, Confirmer, Corriger la position, Ignorer), parcours lus « (IC) » ; hors saison : rejouer une trace, Télécharger pour le hors réseau, onglet J80 (polaire, réglages, Polaire par défaut, import d’une polaire perso), page des règles et arbitre.
- `onglets` (C-09) : un tableau par zone — barre du haut, carte et calques, lecture d’animation, puis un tableau par onglet (Briefing, Parcours, Départ, En course, Traces, Vent, J80, Régates) — colonnes « Bouton », « Ce qu’il fait », « Quand » ; chaque bouton de l’inventaire y figure une fois, en `span.k`.
- `voyants` (C-10) : tableau GPS / ÉCRAN / SON / RÉSEAU × vert / orange / rouge, texte affiché et bouton de réparation (selon js/status.js) ; RÉSEAU jamais rouge ; indicateur de l’archive et ses états.
- `ia` (C-11) : les quatre usages et le geste qui les déclenche, ce qui part chez OpenAI, « OpenAI ne garde pas les réponses » et les 30 jours possibles de la surveillance des abus (formulation de docs/ia-budget.md, sans promesse absolue), 30 appels par équipier et par jour de Paris toutes fonctions confondues, message « Limite d’IA du jour atteinte — reprise demain », budget du mois et son message, tableau « Sans l’IA » (dictée analysée sur le téléphone, débrief automatique, relecture des IC à la main, fiches des règles).
- `archive` (C-12) : ce qui est partagé, quand (valeurs de délai lues dans js/app.js), indicateur, conflits et Historique, Désactiver / Réactiver la synchronisation, anciennes traces rangées une seule fois, et la carte « Lire une régate hors réseau » (six derniers mois et à venir, mode avion, Télécharger pour le hors réseau, 1 Mo par régate, « sur ce téléphone » / « en ligne seulement », écran d’accueil).
- `horsreseau` (C-12) : tableau « Marche sans réseau » / « Demande le réseau ».
- `journal` (C-12) : ouvrir (? → Journal de diagnostic), Copier, Partager, Vider (deux touches), ce qu’il contient et ne contient pas, quand l’envoyer.
- `reglages` : reprendre et compléter les cartes iPhone (verrouillage, iOS 18.4, son, Accès guidé, batterie).
- `depannage` (C-13) : une carte par problème, chacune « Ce que vous voyez » → « Ce qu’il faut faire » : pas de son ; GPS absent ou « muet depuis … s » ; app dans une ancienne version (bandeau, verrou du jour, version des trois téléphones) ; synchronisation en attente ; limite d’IA atteinte ; régate absente de la liste ; trace non rangée (« Sans régate », Ranger…) ; plus les questions de l’ancien guide encore justes.
- `limites` (C-14) : iPhone écran verrouillé → plus de GPS dans l’app, d’où Open GPX Tracker ; GR1 (3) et Carqueiranne (11) à position approximative, « à confirmer », le Comité fait foi ; vent : modèle de tendances, polaire ORC de 6 à 20 nœuds, extrapolée jusqu’à 25 nœuds, au-delà de 25 nœuds les chiffres ne sont pas faits pour ; l’IA peut se tromper, toute valeur se relit.

Finir en ajoutant à tests/guide.test.mjs les phrases devenues obligatoires : « 25 nœuds », « Ce qui ne s’échange pas pendant une course », « Budget d’IA du mois atteint — l’IA reprend le mois prochain », et toute autre phrase dont la rédaction a fait un repère, sans affaiblir aucune vérification de la tâche 1. Ne pas modifier js/help.js : noter dans le résumé tout écart trouvé dans la fenêtre d’aide (GUIDE) pour une tâche ultérieure.
  </action>
  <verify>
    <automated>npm test && node tools/regate-e2e.mjs guide</automated>
  </verify>
  <done>Chaque section contient le contenu listé ; chaque libellé en `span.k` est retrouvé dans le code (test d), toutes les sections et ancres sont en place, `npm test` passe en entier, le scénario `guide` est OK ; l’exécutant a un inventaire libellé → fichier:ligne et la liste des écarts tranchés, repris dans le résumé.</done>
</task>

<task type="auto">
  <name>Task 3 : livrer la v33 sur la branche d’aperçu (stamp, contrôles, release, commit, push)</name>
  <files>sw.js, js/version.js, release.json</files>
  <read_first>README.md section « Mettre en ligne sans risque », tools/stamp.mjs lignes 1-20 et 100-140 (contrôle strict en production ou avec RT_STRICT=1, note de 80 caractères au plus)</read_first>
  <action>
Dans cet ordre, depuis la racine du dépôt, sur la branche `apercu-phase-05` (C-18) :
1. `npm run stamp` (régénère le bloc de sw.js et js/version.js ; ne jamais les modifier à la main), puis `npm run check` : tout vert.
2. `GUIDE_SHOT=<carnet de l’exécutant> node tools/regate-e2e.mjs guide` : « OK guide », puis regarder la capture `guide-390.png` (lisibilité sur téléphone : titres, encadré En 1 minute, tableaux qui défilent dans leur cadre) et corriger si besoin (et refaire l’étape 1).
3. `git diff --quiet f80c365 -- js/courses.js tests/reference/` : la référence de la Coupe SNPM et les bouées n’ont pas bougé.
4. `npm run release -- "guide de prise en main refait"` → release.json passe à n = 33 (note de 32 caractères, sous la limite de 80).
5. `RT_STRICT=1 node tools/stamp.mjs --check` puis `VERCEL_ENV=production npm run gate` : tous deux verts. Ordre voulu : la porte de production refuse par conception un contenu modifié sans release (tools/stamp.mjs, mode strict), elle se lance donc après l’étape 4 et non avant comme dans la liste reçue.
6. Commit en français sur la branche courante avec seulement les fichiers de ce plan (guide.html, tests/guide.test.mjs, tools/regate-e2e.mjs, sw.js, js/version.js, release.json), message du type « docs(guide): guide de prise en main refait — v33 », terminé par les lignes d’attribution de la session ; puis `git push origin apercu-phase-05`.
Interdits : aucune mise en production, aucune fusion dans main, aucun changement de vercel.json ou des variables Vercel ; la production ne se fait que sur le « publie » écrit par Romain, avant le gel du 2 novembre.
  </action>
  <verify>
    <automated>npm run check && node tools/regate-e2e.mjs guide && git diff --quiet f80c365 -- js/courses.js tests/reference/ && RT_STRICT=1 node tools/stamp.mjs --check && VERCEL_ENV=production npm run gate && node -e "const r=JSON.parse(require('fs').readFileSync('release.json','utf8'));if(r.n!==33||r.note!=='guide de prise en main refait')process.exit(1)" && test -z "$(git status --porcelain -- guide.html tests/guide.test.mjs tools/regate-e2e.mjs sw.js js/version.js release.json)" && git fetch -q origin apercu-phase-05 && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/apercu-phase-05)"</automated>
    <human-check>Romain ouvre guide.html sur l’aperçu apercu-phase-05 depuis son iPhone (app installée et Safari), parcourt le sommaire et l’encadré En 1 minute, et dit si c’est « très très clair » ; la production attend son « publie ».</human-check>
  </verify>
  <done>release.json en v33 « guide de prise en main refait » ; check, scénario guide, référence inchangée, contrôle strict et porte de production verts ; commit poussé sur origin/apercu-phase-05 ; main et la production inchangées.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| guide.html → navigateur de l’équipier | page statique servie derrière le middleware d’accès, précachée par le service worker, lue en mer |
| texte du guide → décisions en course | une consigne fausse (bouton inexistant, comportement inventé) peut faire perdre une trace ou rater un départ |
| branche d’aperçu → production | une mise en ligne au mauvais moment change l’app des trois téléphones |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-eaq-01 | Information disclosure | guide.html | high | mitigate | Le guide décrit l’accès seulement comme « lien personnel reçu de Romain » et « code personnel » ; tests/guide.test.mjs (c) et tests/regates.test.mjs ligne 580 refusent paramètre d’accès, nom de cookie, adresse ou jeton du magasin et toute empreinte de 64 caractères hexadécimaux |
| T-eaq-02 | Tampering | contenu du guide | medium | mitigate | Test (d) : chaque `span.k` est retrouvé dans index.html, regles.html, js/*.js, api/*.js ; inventaire libellé → fichier:ligne tenu par l’exécutant (tâche 2) ; section `limites` honnête (écran verrouillé, bouées à confirmer, 25 nœuds) |
| T-eaq-03 | Information disclosure | ressources de la page | low | mitigate | Test (b) : aucun script, aucune ressource extérieure ; scénario `guide` : toute requête vers un autre hôte que 127.0.0.1 fait échouer |
| T-eaq-04 | Denial of service | mise en ligne de la v33 | medium | mitigate | Push sur apercu-phase-05 seulement ; production seulement au « publie » de Romain avant le gel du 2 novembre ; une nouvelle version ne s’applique que par « Mettre à jour » hors course (verrou existant de js/racelock.js) |
| T-eaq-05 | Elevation of privilege | middleware.js | low | accept | middleware.js n’est pas modifié : guide.html reste derrière le contrôle d’accès comme aujourd’hui |
| T-eaq-SC | Tampering | npm/pip/cargo installs | high | accept | Aucune installation de paquet dans ce plan (Playwright est déjà installé hors dépôt et chargé par tools/pw.mjs) |
</threat_model>

<verification>
- `npm run check` vert (stamp à jour, tous les tests dont tests/guide.test.mjs et tests/regates.test.mjs).
- `node tools/regate-e2e.mjs guide` : « OK guide » (téléphone 390 × 844 et paysage sans défilement horizontal, ancres résolues, aucune requête extérieure, impression sans barre collante).
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` : référence et bouées inchangées.
- `RT_STRICT=1 node tools/stamp.mjs --check` et `VERCEL_ENV=production npm run gate` verts après la release v33.
- Commit présent sur origin/apercu-phase-05.

Couverture des sources (audit) :

| Source | Élément | Couvert par |
|--------|---------|-------------|
| GOAL | Guide très clair et exhaustif, toutes les fonctions v32, ordre d’une journée de régate, français | Tâches 1 et 2 |
| CONTEXT | C-01 sommaire et En 1 minute | Tâche 1 (structure, test a, scénario) |
| CONTEXT | C-02 à C-08 journée de régate | Tâche 2 (sections installer à ailleurs), sections posées en tâche 1 |
| CONTEXT | C-09 à C-14 référence, voyants, IA, archive, hors réseau, journal, dépannage, limites | Tâche 2 |
| CONTEXT | C-15 forme, impression, hors réseau, sans JS ni ressource extérieure | Tâche 1 (CSS, test b, scénario) |
| CONTEXT | C-16 exactitude contre le code | Tâche 1 (test d) et tâche 2 (inventaire) |
| CONTEXT | C-17 phrases exigées et interdites, aucun secret | Tâche 1 (test c), tests/regates.test.mjs |
| CONTEXT | C-18 livraison v33 sur l’aperçu | Tâche 3 |
| REQ | aucune exigence de REQUIREMENTS.md (tâche rapide) | — |
| RESEARCH | aucune recherche (tâche rapide) | — |
</verification>

<success_criteria>
- guide.html suit l’ordre installer → veille → matin → départ → course → après → autres clubs, puis la référence complète, avec sommaire et « En 1 minute » en tête.
- Aucune fonction inventée : tous les libellés en style touche existent dans le code v32, tous les comportements décrits ont été vérifiés.
- La page se lit sur iPhone sans défilement horizontal, s’imprime, s’ouvre hors réseau et ne charge rien d’extérieur.
- Tous les tests passent ; v33 « guide de prise en main refait » poussée sur apercu-phase-05 ; production inchangée.
</success_criteria>

<output>
Créer `.planning/quick/261020-eaq-guide-prise-en-main/261020-eaq-SUMMARY.md` à la fin : sections du guide, nombre de libellés vérifiés, écarts entre l’ancien guide et le code et comment ils ont été tranchés, écarts repérés dans la fenêtre d’aide de js/help.js (à traiter plus tard), résultats des contrôles, hash du commit poussé.
</output>
