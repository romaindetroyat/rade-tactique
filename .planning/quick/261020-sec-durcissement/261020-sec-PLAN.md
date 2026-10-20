---
phase: quick-261020-sec
plan: 01
quick_id: 261020-sec
type: execute
wave: 1
depends_on: []
files_modified:
  - middleware.js
  - acces.html
  - acces.js
  - regles.html
  - js/regles.js
  - rapports/coupe-snpm-2026.html
  - rapports/coupe-snpm-2026.js
  - tests/access.test.mjs
  - vercel.json
  - tools/serveur-local.mjs
  - tools/regate-e2e.mjs
  - tools/measure-boot.mjs
  - tests/entetes.test.mjs
  - js/racelock.js
  - tests/racelock.test.mjs
  - js/app.js
  - js/startmode.js
  - tests/boot.test.mjs
  - guide.html
  - js/help.js
  - tests/guide.test.mjs
  - sw.js
  - js/version.js
  - release.json
autonomous: true
requirements: [TEST-02, FIAB-01, ARCH-01]

estimate:
  tokens: 300000
  raw_tokens: 300000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Avec un code valide, /.planning/STATE.md, /.claude/CLAUDE.md, /middleware.js, /api/_ia.js, /api/rules.js, /tests/…, /tools/…, /docs/…, /README.md, /vercel.json, /release.json et /package.json répondent 404, sans jamais renvoyer le code ni une empreinte"
    - "Sans code, ces mêmes chemins restent refusés comme aujourd’hui : 401, ou redirection vers acces.html pour une navigation"
    - "Avec un code valide, chaque fichier de la liste hors réseau (SHELL), chaque fonction /api/<nom> et chaque adresse de même origine que l’app demande restent servis"
    - "Toute réponse du site porte nosniff, Referrer-Policy same-origin, une Permissions-Policy limitée à ce que l’app utilise, X-Frame-Options DENY et une CSP sans script en ligne ni eval"
    - "Tous les scénarios Chromium et la mesure d’ouverture hors réseau passent avec les en-têtes lus dans vercel.json et la liste blanche du middleware, et échouent à la moindre violation CSP ou au moindre chemin refusé"
    - "Après ⏹ Arrêter et enregistrer et ✕ du mode départ, sans chrono en cours, le GPS allumé d’office par le mode départ ou la trace s’arrête : l’app ne se croit plus en course et la synchronisation reprend"
    - "Le GPS n’est jamais coupé tant qu’un chrono existe, que le mode départ est ouvert, qu’une trace s’enregistre ou que l’équipier l’a allumé lui-même ; tant qu’un GPS tourne, rien ne s’échange (D-01 phase 1, D-03 phase 4)"
    - "Le jour de régate, le verrou de mise à jour tient jusqu’à « 🏁 Course finie — retour au port »"
  artifacts:
    - path: middleware.js
      provides: "cheminDeLApp(chemin) exportée (liste blanche) et réponse 404 après authentification ; acces.js public"
      contains: "export function cheminDeLApp"
    - path: acces.js
      provides: "script de la page d’accès, sorti d’acces.html sans changement"
    - path: js/regles.js
      provides: "script de l’arbitre de poche, sorti de regles.html sans changement"
    - path: rapports/coupe-snpm-2026.js
      provides: "script du rapport public, sorti de la page sans changement"
    - path: vercel.json
      provides: "en-têtes de sécurité (tous chemins), CSP de l’app, CSP des rapports"
      contains: "Content-Security-Policy"
    - path: tools/serveur-local.mjs
      provides: "serveur local commun aux outils : en-têtes de vercel.json appliqués, liste blanche du middleware appliquée"
      contains: "cheminDeLApp"
    - path: tests/entetes.test.mjs
      provides: "gardes des en-têtes : émulation des motifs, contenu de la CSP, pages sans script en ligne, hôtes réseau, permissions"
    - path: js/racelock.js
      provides: "gpsLeftAlone(...) : GPS d’office laissé seul, prédicat pur"
      contains: "export function gpsLeftAlone"
    - path: js/app.js
      provides: "origine du GPS (manuel / auto), releaseGps appelée par ✕, ⏹ et Stop, note « verrou » au journal"
      contains: "function releaseGps"
    - path: tools/regate-e2e.mjs
      provides: "scénarios entetes et retour-port ; échec sur violation CSP ou chemin refusé"
      contains: "'retour-port'"
  key_links:
    - from: middleware.js
      to: tools/serveur-local.mjs
      via: "la même fonction cheminDeLApp décide en production et dans les essais Chromium"
      pattern: "cheminDeLApp"
    - from: vercel.json
      to: tools/serveur-local.mjs
      via: "lireEntetes / entetesPour servent les en-têtes de vercel.json au navigateur des essais"
      pattern: "vercel\\.json"
    - from: js/startmode.js
      to: js/app.js
      via: "close() appelle api.closed?.() ; app.js y branche releaseGps"
      pattern: "api\\.closed\\?\\.\\(\\)"
    - from: js/app.js
      to: js/racelock.js
      via: "releaseGps décide par gpsLeftAlone ; raceActive garde gpsOn (D-01)"
      pattern: "gpsLeftAlone\\("
---

# Durcissement avant le gel : fichiers internes, en-têtes de sécurité, GPS après la course (v35)

Demande de Romain le 20/10 : « Corrige maintenant ce qui doit l’être ». Trois défauts vus en production sur la v34 par la batterie de tests du 20/10.

<objective>
Corriger les trois défauts, chacun prouvé par des tests Node et par des scénarios Chromium :
1. Avec un code valide, les fichiers internes du dépôt (planification, sources des fonctions, tests, outils, documents, middleware.js qui contient les empreintes) sont lisibles. Ils doivent répondre 404.
2. Il manque les en-têtes de sécurité. Il faut les ajouter dans vercel.json, avec une CSP que l’app respecte vraiment, prouvée dans le navigateur.
3. Le GPS reste allumé après ⏹ et après ✕ du mode départ, et l’app se croit alors « en course » : synchronisation en pause, bandeau de mise à jour retenu.

Purpose : fermer une fuite (empreintes des codes, prompts, plans) et durcir l’app avant le gel du 2 novembre, sans rien casser en mer.
Output : v35 sur la branche d’aperçu apercu-phase-05, poussée. La mise en production attend le « publie » de Romain (orchestrateur).
</objective>

## Décisions du planificateur (P-01 à P-03)

- **P-01 — liste blanche, pas liste noire.** `middleware.js` exporte `cheminDeLApp(chemin)`, une fonction pure. Après authentification, tout chemin hors de l’app répond 404. Une liste noire laisserait passer le prochain dossier interne (`.vercel/`, `node_modules/` déployé par `npm ci`, un nouveau fichier de notes). La liste blanche se vérifie contre le SHELL généré et contre chaque adresse que l’app demande. Le serveur local des outils l’applique aussi, ce qui fait échouer tout scénario Chromium si l’app demande un chemin refusé.
  Règle, sur le chemin brut tel que le middleware le reçoit (`url.pathname`, encodé) :
  - refus si le chemin contient `%`, `\`, `//` ou un segment qui commence par un point ;
  - accepte les noms exacts `/`, `/index.html`, `/guide.html`, `/regles.html`, `/styles.css`, `/manifest.webmanifest`, `/sw.js`, `/acces.html`, `/acces.js` ;
  - accepte un seul segment de fichier (lettres, chiffres, `.`, `_`, `-`, commençant par une lettre ou un chiffre) sous `js/`, `data/`, `vendor/`, `icons/` et `rapports/` ;
  - accepte `/api/<nom>` avec un nom en minuscules seulement, sans `.js` et sans `_` ;
  - refuse tout le reste.
  Sans code, rien ne change : 401, ou redirection vers acces.html.
- **P-02 — en-têtes dans vercel.json, aucune règle qui se chevauche pour une même clé.** Une règle `/(.*)` porte `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` et `X-Frame-Options`. Une règle `/((?!rapports/).*)` porte la CSP de l’app. Une règle `/rapports/(.*)` porte la CSP des rapports publics : la page de la Coupe SNPM charge Google Fonts, et on n’élargit pas la CSP de l’app pour elle. Aucune page ne garde de script en ligne. Les trois scripts en ligne (acces.html, regles.html, rapport SNPM) partent tels quels dans des fichiers. Le script de la page d’accès devient `/acces.js`, public : la page de connexion doit marcher sans code. Il est ancré par `$` dans le matcher, comme les trois noms publics déjà là.
- **P-03 — GPS : arrêter le GPS « d’office » au geste qui termine la dernière activité, et ne rien changer au verrou.** Le GPS retient son origine :
  - `'manuel'` pour « ▶ Activer le GPS » et pour le suivi du bateau ◎ quand le GPS était éteint ;
  - `'auto'` quand le mode départ ou « ⏺ Enregistrer ma trace » l’allume.
  L’origine ne change plus ensuite. Une relance par la lampe garde l’origine.
  Juste après ✕ du mode départ, ⏹ Arrêter et enregistrer ou Stop du chrono (onglet Départ), le GPS s’arrête si le prédicat pur `gpsLeftAlone` est vrai : GPS allumé, origine `'auto'`, mode départ fermé, aucune trace, et `timerEnd == null`, c’est-à-dire aucun chrono, même au-delà de ses 3 h de grâce.
  Pourquoi pas « exclure le GPS seul du verrou » : D-01 (phase 1) compte le GPS comme activité de course, et D-03 (phase 4) interdit tout échange pendant la course. Sur une course côtière de plus de 3 h, menée sans trace dans l’app (Open GPX Tracker), mode départ fermé et GPS en navigation, l’exclusion laisserait partir une synchronisation en pleine course. Avec P-03, le verrou ne s’affaiblit jamais : tout GPS allumé compte toujours.
  Le GPS n’est jamais coupé par une horloge, jamais tant qu’un chrono existe, et jamais s’il a été allumé à la main. Les bips ne dépendent que du chrono, qui n’est pas touché.
  Cas restant, sûr : un chrono jamais arrêté garde le GPS et le verrou jusqu’à Stop ou « Arrêter le GPS ». Le guide le dit.

Le premier élément n’est pas une tâche traceuse : ce sont trois défauts indépendants, imposés par l’orchestrateur à raison d’une tâche par défaut. Chaque tâche est une tranche complète avec sa propre preuve, en Node et dans Chromium.

Règles permanentes pour l’exécutant :
- Ne jamais écrire un code d’accès ni une empreinte, nulle part : code, tests, journaux, SUMMARY. Les tests lisent une empreinte à l’exécution par `tests/helpers/codesimule.mjs`, avec le faux code `code-de-test`.
- Aucune mise en production. Pas d’installation de paquet.
- Après toute modification d’un fichier de l’app : `npm run stamp`.
- Textes visibles en français, avec l’apostrophe typographique ’.

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@middleware.js
@vercel.json
@tests/access.test.mjs
@tests/helpers/codesimule.mjs
@sw.js
@tools/stamp.mjs
@js/racelock.js
@tests/racelock.test.mjs
@tools/regate-e2e.mjs
@tools/measure-boot.mjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1 : liste blanche du middleware (404 pour tout ce qui n’est pas l’app) et pages sans script en ligne</name>
  <files>middleware.js, acces.html, acces.js, regles.html, js/regles.js, rapports/coupe-snpm-2026.html, rapports/coupe-snpm-2026.js, tests/access.test.mjs, sw.js, js/version.js</files>
  <read_first>
- middleware.js (tout le fichier : matcher, membre, versApi, ordre ?acces= → cookie → /api/membre → /api/ → next(), branche sans code)
- tests/access.test.mjs et tests/helpers/codesimule.mjs : `fichiers()`, `avecCodeSimule`, `FAUX_CODE`, `tableEquipage`, le test « archive : le reste du site n’est pas modifié », dont la liste contient `/api-docs.html`
- tools/stamp.mjs (`listShell`) et le bloc SHELL de sw.js
- tests/stamp.test.mjs, test « tout fichier chargé par l’app est dans le SHELL » : c’est le modèle du balayage des adresses de l’app
- Adresses de même origine demandées par l’app :
  - js/app.js : `fetch('api/voice'` vers la l. 308, `icons/favicon-32.png` vers la l. 1085, `/api/membre` vers la l. 1795, `/api/archive?` vers la l. 1813, `/api/ic` vers la l. 2180, `import('./…')` ;
  - js/debrief.js (`api/debrief`), js/events.js (`loadScript('vendor/pdf.min.js')`, `workerSrc`), js/geo.js (`data/` + nom), js/weather.js (`data/wx-snapshot.json`) ;
  - js/startmode.js (`regles.html#depart`), js/help.js (`guide.html#minute`, `regles.html`) ;
  - le script en ligne de regles.html (`api/rules`).
- acces.html (script en ligne en fin de page), regles.html (script en ligne vers la l. 688), rapports/coupe-snpm-2026.html (script en ligne vers la l. 190)
  </read_first>
  <behavior>
    - cheminDeLApp est vrai pour : chaque entrée de listShell(ROOT), avec './' → '/' ; '/acces.html', '/acces.js', '/manifest.webmanifest', '/sw.js', '/icons/logo.png', '/rapports/coupe-snpm-2026.html', '/rapports/coupe-snpm-2026.js', '/vendor/pdf.worker.min.js' ; '/api/membre' ; '/api/<nom>' pour chaque api/*.js qui ne commence pas par « _ ».
    - cheminDeLApp est faux pour : chaque fichier du dépôt hors de cette liste, dont '/.planning/STATE.md', '/.claude/CLAUDE.md', '/middleware.js', '/api/_ia.js', '/api/rules.js', '/api/_ia', '/tests/access.test.mjs', '/tools/stamp.mjs', '/docs/ia-budget.md', '/README.md', '/vercel.json', '/release.json', '/package.json', '/package-lock.json', '/srv.log', '/.gitignore' ; et pour '/.git/config', '/node_modules/openai/package.json', '/js/..%2F.planning/STATE.md', '/js/%2e%2e%2fmiddleware.js', '/JS/app.js', '/js/', '/vendor/sous/x.js', '/api/archive/', '/api/archive.js', '/API/archive', '/%61pi/archive', '/api//archive', '/api-docs.html', '/favicon.ico'.
    - Avec le code simulé, un chemin interne reçoit 404 : pas de x-middleware-next, pas de x-middleware-override-headers, pas de set-cookie, Cache-Control no-store, X-Content-Type-Options nosniff. Ni le corps ni aucun en-tête ne contient FAUX_CODE ou une empreinte de la table.
    - Avec le code simulé, chaque chemin de l’app reçoit x-middleware-next 1 (GET /api/membre reçoit 200 du middleware). Une fonction /api/<nom> reçoit x-rt-membre comme aujourd’hui.
    - Sans code, tout chemin intercepté, interne ou non, reste refusé en 401 ou redirigé vers /acces.html : jamais 404, ce qui ne dit pas qu’un fichier existe.
    - Chaque adresse de même origine trouvée en balayant js/*.js et les pages HTML vérifie cheminDeLApp.
  </behavior>
  <action>
1. `middleware.js`, selon P-01 :
   - exporter la fonction pure `cheminDeLApp(chemin)`, avec la règle de P-01, précédée d’un commentaire français qui dit pourquoi c’est une liste blanche ;
   - dans le gestionnaire, une fois le prénom connu : le GET /api/membre reste traité en premier ; puis, si `cheminDeLApp(url.pathname)` est faux, répondre 404 :
     - corps fixe « Introuvable. » en text/plain, ou `{"error":"introuvable"}` en JSON si le chemin commence par /api ;
     - en-têtes `Cache-Control: no-store` et `X-Content-Type-Options: nosniff` ;
     - jamais le chemin demandé dans le corps (on ne renvoie pas une entrée), jamais de cookie ;
   - garder ensuite, sans les changer, la réécriture des en-têtes /api/ (x-rt-membre, cookie retiré) et `next()` ;
   - ne toucher ni à la branche `?acces=` ni à la branche sans code ;
   - matcher : ajouter `acces\\.js$`, ancré comme les autres noms publics, et mettre à jour son commentaire ;
   - ne recopier aucune empreinte ailleurs.
2. Sortir les trois scripts en ligne, mot pour mot (P-02) :
   - acces.html → `acces.js` à la racine, chargé par une balise script à la même place en fin de page. Garder la protection `suite` (`^\/(?!\/)`) telle quelle ;
   - regles.html → `js/regles.js`, script classique et non module, chargé à la même place en fin de page ;
   - rapports/coupe-snpm-2026.html → `rapports/coupe-snpm-2026.js`, chargé à la même place par le chemin relatif `coupe-snpm-2026.js`.
   Chaque nouveau fichier commence par une ligne de commentaire en français qui dit d’où il vient. Aucun autre changement de ces pages : le rapport garde son contenu et son rendu. La référence SNPM (js/courses.js, tests/reference/) n’est pas touchée.
3. `tests/access.test.mjs` :
   - ajouter '/acces.js' à `PUBLIC_EXACT` ;
   - ajouter les tests de `<behavior>` ;
   - la liste des chemins internes se calcule : `fichiers()` moins `cheminDeLApp`, plus les chemins explicites de `<behavior>`. Le test vérifie que cette liste contient bien les onze chemins du défaut (/.planning/STATE.md, /.claude/CLAUDE.md, /middleware.js, /api/_ia.js, /api/rules.js, /tests/access.test.mjs, /tools/stamp.mjs, /docs/ia-budget.md, /README.md, /vercel.json, /release.json) ;
   - balayage des adresses de l’app sur le modèle de tests/stamp.test.mjs. Sources : les chaînes littérales de `fetch(`, `import(`, `loadScript(`, `workerSrc =`, `window.open(` dans js/*.js, et `src=` / `href=` de index.html, guide.html, regles.html, acces.html. On ignore http(s), `#…`, `tel:`, `mailto:`, `data:`, `blob:` et les gabarits `${`. On résout par rapport à '/', on retire la requête et l’ancre, puis chaque adresse doit vérifier `cheminDeLApp` ;
   - dans « archive : le reste du site n’est pas modifié », sortir '/api-docs.html' de la boucle « passe » et l’attendre en 404, toujours sans x-rt-membre ;
   - toute empreinte est lue à l’exécution, jamais écrite ni affichée.
4. `npm run stamp` : js/regles.js entre dans le SHELL, sw.js et js/version.js sont régénérés.
  </action>
  <verify>
    <automated>npm run stamp && npm run check && node --check middleware.js && node --check acces.js && node --check js/regles.js && node --check rapports/coupe-snpm-2026.js && PW_REQUIRED=1 node tools/regate-e2e.mjs arbitre guide</automated>
    <fails_when>code de sortie non nul, une ligne « not ok », un scénario « ÉCHEC » ou une sortie 2 de l’outil, une empreinte ou le faux code présents dans une réponse 404, ou un chemin du SHELL ou une adresse de l’app refusés par cheminDeLApp</fails_when>
  </verify>
  <acceptance_criteria>
- `middleware.js` exporte `cheminDeLApp`, et le matcher rend publics exactement acces.html, acces.js, manifest.webmanifest, sw.js, icons/ et rapports/. Le premier test d’accès le vérifie.
- `npm test` couvre les points suivants :
  - avec le code simulé, 404 pour chacun des onze chemins du défaut et pour tout fichier du dépôt hors de l’app ;
  - tous les chemins du SHELL, toutes les fonctions /api/<nom> et toutes les adresses balayées passent ;
  - sans code, 401 ou redirection, inchangés ;
  - aucun corps ni en-tête de 404 ne contient le faux code ni une empreinte.
- acces.html, regles.html et rapports/coupe-snpm-2026.html n’ont plus de script en ligne : chaque balise script a un `src`.
- js/regles.js figure dans le SHELL de sw.js.
- Le scénario `arbitre`, qui exerce js/regles.js, est OK.
  </acceptance_criteria>
  <done>Un équipier connecté reçoit 404 sur tout fichier interne. L’app, la page d’accès, les règles et le rapport public marchent comme avant. Tests verts, commit atomique de la tâche.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 2 : en-têtes de sécurité dans vercel.json, prouvés dans Chromium (serveur local commun, échec sur toute violation CSP)</name>
  <files>vercel.json, tools/serveur-local.mjs, tools/regate-e2e.mjs, tools/measure-boot.mjs, tests/entetes.test.mjs</files>
  <read_first>
- vercel.json : les six règles Cache-Control et `functions` restent intactes
- tests/access.test.mjs, test « vercel.json : aucune réécriture… » : il faut rester sans rewrites, routes ni redirects
- tools/regate-e2e.mjs :
  - INIT, `ouvreContexte`, `ouvrePage` (liste BRUIT), `ouvreApp`, `telephoneArchive` ;
  - scénario `gpx` (l. 590-650 : `#rpFrame`, `#rpClose`) ;
  - `main()` et son serveur, `SCENARIOS`.
- tools/measure-boot.mjs : serveur, INIT, `premiereVisite`, `ouverture`, codes de sortie
- middleware.js : `cheminDeLApp`, livrée par la tâche 1
- Ce que l’app utilise vraiment :
  - js/weather.js : hôtes fetchés api.open-meteo.com, marine-api.open-meteo.com, api.pioupiou.fr ;
  - js/app.js `showReport` (l. ~1461-1478) : cadre `sandbox` en srcdoc, « Plein écran » en blob: avec sa propre CSP en meta ;
  - js/events.js : pdf.js chargé par balise script, worker `vendor/pdf.worker.min.js`, `isEvalSupported: false` ;
  - js/startmode.js : `requestFullscreen`, `DeviceOrientationEvent`, `navigator.geolocation` ;
  - js/wakelock.js (`wakeLock`), js/help.js (`navigator.clipboard`, `navigator.share`, QR en SVG en ligne), js/voice.js et js/regles.js (`SpeechRecognition`), js/track.js et js/debrief.js (`navigator.share`, liens blob: de téléchargement).
- rapports/coupe-snpm-2026.html : fonts.googleapis.com en feuille de style, image `data:` dans le SVG
  </read_first>
  <behavior>
    - motifSource compile '/', '/index.html', '/js/:path*', '/(.*)', '/((?!rapports/).*)' et '/rapports/(.*)' comme Vercel. '/js/:path*' accepte '/js' et '/js/a.js'. '/((?!rapports/).*)' accepte '/' et '/index.html', refuse '/rapports/x.html'. Une syntaxe inconnue (':id' sans '*', '+', '?') lève une erreur.
    - entetesPour fusionne dans l’ordre de vercel.json. Pour '/', '/index.html', '/guide.html', '/regles.html', '/acces.html', '/acces.js', '/sw.js', '/js/app.js', '/data/meta.json', '/vendor/pdf.worker.min.js', '/icons/logo.png', '/api/archive' : les quatre en-têtes de sécurité et la CSP de l’app. Pour '/rapports/coupe-snpm-2026.html' : la CSP des rapports. Pour chacun de ces chemins, une même clé n’est jamais posée par deux règles.
    - CSP de l’app :
      - script-src vaut exactement 'self' ;
      - object-src 'none', base-uri 'none', frame-ancestors 'none', form-action 'self', default-src 'self' ;
      - connect-src = 'self' + exactement les hôtes https de js/weather.js ;
      - aucune source ne vaut '*', 'https:' ni 'unsafe-eval'.
    - CSP des rapports : script-src 'self' ; Google Fonts permis seulement dans style-src et font-src.
    - index.html, guide.html, regles.html, acces.html et rapports/*.html : aucun script sans src, aucun attribut on…=, aucune URL javascript:. Aucun gabarit HTML de js/*.js ne contient d’attribut on…=.
    - Aucun fichier de js/ n’appelle fetch avec une URL absolue, sauf js/weather.js.
    - Permissions-Policy : geolocation=(self) et microphone=(self) présents. Chaque API utilisée par le code (geolocation, SpeechRecognition, wakeLock, requestFullscreen, DeviceOrientationEvent ou deviceorientation, navigator.share, navigator.clipboard) a sa permission à (self), jamais à ().
  </behavior>
  <action>
1. `vercel.json`, selon P-02. Garder les règles et `functions` existantes, puis ajouter trois règles avec ces valeurs exactes :
   - source `/(.*)` :
     - `X-Content-Type-Options: nosniff` ;
     - `Referrer-Policy: same-origin` ;
     - `X-Frame-Options: DENY` ;
     - `Permissions-Policy: geolocation=(self), microphone=(self), screen-wake-lock=(self), fullscreen=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self), web-share=(self), clipboard-write=(self), camera=(), payment=(), usb=(), midi=(), display-capture=()`.
   - source `/((?!rapports/).*)`, `Content-Security-Policy:` `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.open-meteo.com https://marine-api.open-meteo.com https://api.pioupiou.fr; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.
     `style-src 'unsafe-inline'` est nécessaire : l’app pose des attributs style dans ses gabarits innerHTML, et guide.html, regles.html et acces.html ont des blocs style.
   - source `/rapports/(.*)`, `Content-Security-Policy:` `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
2. `tools/serveur-local.mjs`, nouveau fichier avec un en-tête de commentaire en français. Il exporte :
   - `lireEntetes(root)` : les règles headers de vercel.json ;
   - `motifSource(source)` : un RegExp ancré. Littéraux échappés, `/:nom*` traduit en segment facultatif, groupes `( … )` gardés comme expression brute. Toute autre syntaxe lève une erreur, pour qu’un nouveau motif de vercel.json fasse échouer les tests au lieu d’être mal émulé ;
   - `entetesPour(chemin, regles)` ;
   - `demarreServeur({ root })` : serveur statique sur 127.0.0.1, port 0. Il garde la table MIME, le 404 et la garde « hors dépôt » des deux outils actuels. Pour chaque requête, sur le chemin brut :
     - si `cheminDeLApp` (importée de `../middleware.js`) refuse, répondre 404 et noter le chemin dans le tableau `refuses` renvoyé ;
     - sinon servir le fichier avec `entetesPour(chemin brut)` en plus du content-type.
     Il renvoie `{ serveur, base, refuses }`. Rien ne démarre à l’import du module.
3. `tools/regate-e2e.mjs` :
   - remplacer son serveur par `demarreServeur` ;
   - INIT ajoute un écouteur `securitypolicyviolation`, qui écrit `console.error('CSP : ' + directive + ' ' + URI bloquée)` ;
   - `ouvreContexte` attache à chaque page du contexte (`ctx.on('page')`, fenêtres « Plein écran » comprises) un écouteur console. Il range dans une liste du module tout message qui correspond à /Content.Security.Policy|^CSP :/, avant le filtre BRUIT. Le BRUIT ne doit jamais masquer une violation ;
   - `main()` : pour chaque scénario, une nouvelle violation ou un nouveau chemin refusé (sauf `/favicon.ico`, demande automatique du navigateur) donne « ÉCHEC <nom> : violation CSP … » ou « … chemin refusé par la liste blanche … » ;
   - `ouvreApp` vérifie que la réponse du document porte la CSP de vercel.json pour '/'. Cela prouve que l’émulation est active.
   - Nouveau scénario `entetes` :
     (a) en-têtes du document de l’app, et `nosniff` sur /js/app.js lu par `page.request` ;
     (b) `acces.html?erreur=1&suite=%2Fguide.html` : `#err` visible. Saisir « ␣Code-De-Test␣ » puis valider : l’adresse devient `/guide.html?acces=code-de-test`. Avec `suite=%2F%2Fexemple.test`, l’adresse visée est `/?acces=code-de-test`, interceptée par `page.route` et remplie d’un 200 texte pour ne pas ouvrir l’app. Le motif est une expression régulière : dans un motif glob de Playwright, « ? » est un joker. Jamais de vrai code ;
     (c) fenêtre de partage (`#shareBtn`) : le SVG `.qr` est présent ;
     (d) `rapports/coupe-snpm-2026.html` : `#map` et `#windChart` ont des enfants, donc le script du rapport tourne sous sa CSP ;
     (e) aucune violation.
   - Étendre `gpx` : après l’ouverture du rapport, toucher `#rpOpen`, attraper la nouvelle page du contexte, vérifier qu’elle contient un `iframe[sandbox]` dont le srcdoc dépasse 500 caractères, puis la fermer. Le scénario échoue sur toute violation, y compris dans cette fenêtre.
   - Ajouter `entetes` à `SCENARIOS`.
   - Les scénarios existants exercent déjà la 3D (`rt:map`), la lecture PDF (`ic`, `depuis-ic`, `vraisemblance`), l’archive, le guide et l’arbitre.
4. `tools/measure-boot.mjs` :
   - utiliser `demarreServeur` ;
   - INIT et un écouteur console relèvent les violations, première visite comprise ;
   - en fin de mesure, une violation ou un chemin refusé donne « RÉSULTAT : ÉCHEC — … » et la sortie 1. La sortie 2 reste réservée à une mesure impossible ;
   - les ouvertures hors réseau passent par le service worker, dont les réponses en cache gardent leurs en-têtes : la CSP y est donc exercée.
5. `tests/entetes.test.mjs` : les tests de `<behavior>`, avec des messages en français.
6. Bornes pour ajuster la CSP si un scénario révèle un besoin réel de l’app : ajouter seulement la source la plus étroite (par exemple `blob:` dans frame-src) et l’écrire dans tests/entetes.test.mjs et dans le SUMMARY.
   - Jamais 'unsafe-inline' ni 'unsafe-eval' dans script-src, jamais '*', 'https:' ou 'data:' dans script-src ou connect-src.
   - Une fonction du navigateur que Chromium ne reconnaît pas dans Permissions-Policy (message « Unrecognized feature ») est retirée de la liste, pas filtrée dans l’outil.
   - pdf.js garde `isEvalSupported: false` : aucune tentative d’eval n’est attendue.
  </action>
  <verify>
    <automated>npm run check && PW_REQUIRED=1 node tools/regate-e2e.mjs && PW_REQUIRED=1 node tools/measure-boot.mjs 4 5</automated>
    <fails_when>code de sortie non nul, une ligne « not ok », « ÉCHEC » d’un scénario (dont une violation CSP ou un chemin refusé), « Bilan » différent de N/N, « RÉSULTAT : ÉCHEC » de la mesure, ou une sortie 2 (Chromium introuvable)</fails_when>
  </verify>
  <acceptance_criteria>
- vercel.json contient les trois nouvelles règles avec les valeurs de l’action, ou leurs ajustements bornés et documentés, et toujours ni rewrites, ni routes, ni redirects, ni cleanUrls.
- `npm test` contient tests/entetes.test.mjs et le passe. Toute CSP qui gagnerait 'unsafe-eval', un script en ligne ou un hôte réseau non fetché le ferait échouer.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs` affiche « Bilan : N/N », scénarios `entetes` et `gpx` compris, sans violation CSP ni chemin refusé.
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` affiche « RÉSULTAT : OK » : médiane de l’interface utile sous 2000 ms, hors réseau, sous CSP.
  </acceptance_criteria>
  <done>Le site envoie les en-têtes de sécurité. L’app, la page d’accès, les règles, le guide, le rapport public, la lecture PDF, la 3D, l’archive, le rapport en cadre isolé, sa page « Plein écran » et l’ouverture hors réseau marchent sous ces en-têtes, prouvé dans Chromium. Commit atomique.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 3 : le GPS allumé d’office s’arrête avec la dernière activité de course ; verrou inchangé pendant la course</name>
  <files>js/racelock.js, tests/racelock.test.mjs, js/app.js, js/startmode.js, tests/boot.test.mjs, tools/regate-e2e.mjs, guide.html, js/help.js, tests/guide.test.mjs, sw.js, js/version.js</files>
  <read_first>
- js/racelock.js et tests/racelock.test.mjs : `isActive` et `lockState` restent inchangés (D-01, D-02, D-03, D-15)
- js/app.js :
  - l. 776-803 (`raceActive`, `raceLock`, `raceTick`) ;
  - l. 879-893 (`createStartMode` et son objet api) ;
  - l. 925-935 (`#tstop`) ;
  - l. 1092-1130 (`statusNow`, `relaunchGps`, `fixLamp`) ;
  - l. 1187-1252 (`startGps`, `stopGps`, `renderLive`, `renderLiveNav` avec `#gOn`, `#gOff`, `#recStart`, `#recStop`) ;
  - l. 512 (suivi du bateau ◎).
- js/startmode.js : l. 96-111 (`open` et `close`), l. 16 (liste de l’api), l. 198 (✕), l. 211 (Stop du mode départ)
- tests/boot.test.mjs : gardes existantes. Ne pas les casser : `stopGps` garde `scene?.setBoat(null)`, et `raceTick` garde `syncCtl?.abort()`, `wasRaceActive && !active) scheduleSync(60000)` et `freezeTick(`
- tests/helpers/scan.mjs (`bodyOf`)
- guide.html : l. 140 (« Après la course »), 254 (GPS et prochaine marque), 260 (« Ce qui ne s’échange pas »), 268 (« Rentrer au port : dans cet ordre »), 269, 381 (tableau des boutons)
- js/help.js, l. 100 (« Au retour au port »)
- tests/guide.test.mjs : libellés span.k présents dans le code, « Arrêter le GPS » exigé dans l’aide
- tools/regate-e2e.mjs : `mondeArchive`, `telephoneArchive`, `synchronise`, `ligneSync`, `creeRegate`, le scénario `archive` (chrono → « En pause pendant la course » → `#tstop`)
  </read_first>
  <behavior>
    - gpsLeftAlone({ gpsOn, gpsAuto, startModeOpen, recording, timerEnd }) est vrai seulement si gpsOn et gpsAuto sont vrais, que startModeOpen et recording sont faux et que timerEnd vaut null ou undefined.
    - gpsLeftAlone est faux dans chacun de ces cas : GPS éteint ; GPS manuel ; mode départ ouvert ; trace en cours ; chrono avant H ; chrono 2 h après H ; chrono 4 h après H, au-delà de la grâce de 3 h : un chrono jamais arrêté garde le GPS.
    - Le prédicat est pur : aucune lecture d’horloge ni de stockage.
    - isActive reste inchangé : gpsOn seul vaut toujours activité (D-01). Les tests existants passent tels quels.
    - Gardes statiques sur js/app.js :
      - releaseGps n’est appelée que depuis l’objet api du mode départ (closed), le gestionnaire #recStop et le gestionnaire #tstop. Jamais depuis raceTick, lampTick, statusNow, tickTimer, renderRaceBar, ni depuis un rappel de setInterval ou de setTimeout ;
      - le corps de releaseGps appelle gpsLeftAlone( puis stopGps(), et ne touche ni timer.end, ni le beeper, ni l’audio ;
      - chaque appel de startGps( porte une origine littérale 'manuel' ou 'auto', sauf relaunchGps qui passe l’origine gardée ; aucun startGps n’est passé nu comme gestionnaire d’événement ;
      - raceActive passe toujours gpsOn: gps?.watch != null ;
      - js/startmode.js close() appelle api.closed?.().
    - Scénario Chromium retour-port, jour de régate, GPS simulé : voir l’action, point 6.
  </behavior>
  <action>
1. `js/racelock.js` : ajouter le prédicat pur exporté `gpsLeftAlone`, selon P-03 et le `<behavior>`. Commentaire français : « GPS allumé d’office par le mode départ ou la trace, laissé seul : à éteindre au geste qui termine la dernière activité ; jamais sur une horloge ; un chrono, même au-delà de ses 3 h, le garde ». Ne pas toucher `isActive`, `lockState` ni les constantes.
2. `js/app.js` :
   - `startGps(origine)` range `gps.origin` ('manuel' ou 'auto'). Si un GPS tourne déjà, l’origine ne change pas.
   - Points d’appel :
     - « ▶ Activer le GPS » (#gOn) et le suivi du bateau ◎ appellent `startGps('manuel')`. Pour #gOn, passer par une fonction fléchée, sinon l’événement de clic serait pris pour l’origine ;
     - l’api du mode départ appelle `startGps('auto')` ;
     - « ⏺ Enregistrer ma trace » (#recStart) appelle `startGps('auto')` quand aucun GPS ne tourne ;
     - `relaunchGps` relance avec l’origine gardée, ou 'auto' s’il n’y avait pas de GPS : la lampe ne s’affiche que pendant une activité de course.
   - Nouvelle fonction `releaseGps(cause)`. Si `gpsLeftAlone({ gpsOn: gps?.watch != null, gpsAuto: gps?.origin === 'auto', startModeOpen: startMode.isOpen(), recording: recorder.active, timerEnd: timer.end })` est vrai : `note('gps', 'arrêté : ' + cause)` puis `stopGps()`. stopGps ne touche pas la trace, puisqu’aucune n’est en cours.
   - Appels de releaseGps :
     - dans l’objet api de `createStartMode` : `closed: () => releaseGps('mode départ fermé')` ;
     - dans le gestionnaire #recStop, après l’arrêt de l’enregistrement, y compris quand la sauvegarde finale échoue ;
     - dans le gestionnaire #tstop, après `timer.end = null`.
     Nulle part ailleurs.
   - `raceTick` :
     - garder à l’identique les lignes gardées par tests/boot.test.mjs : `syncCtl?.abort()`, la ligne `scheduleSync(60000)` de fin de course, `reprise()` et `freezeTick('tic')` ;
     - lire la raison du verrou dans le résultat de `raceLock(now)`, déjà calculé dans raceTick, puis, quand elle change, écrire au journal `note('verrou', …)` : « en course », « journée de régate » ou « libre ». C’est un diagnostic utile à Romain (« pourquoi pas de mise à jour ? ») et l’observable du scénario ;
     - aucun secret, aucune position.
3. `js/startmode.js` : à la fin de `close()`, appeler `api.closed?.()`. Ajouter `closed` à la liste de l’api, l. 16. Rien d’autre ne change : le Stop du mode départ, la vue, les bips.
4. Tests :
   - `tests/racelock.test.mjs` : cas de `gpsLeftAlone`.
   - `tests/boot.test.mjs` : gardes statiques du `<behavior>`, avec `bodyOf` et des expressions sur le texte de js/app.js et js/startmode.js.
   - `tests/guide.test.mjs` : le guide (#apres et la carte « Rentrer au port ») et le `GUIDE` de js/help.js disent tous deux que le GPS allumé par le mode départ ou la trace « s’arrête de lui-même ». « Arrêter le GPS » reste cité dans l’aide.
5. Textes, sans inventer de libellé. Chaque span.k doit exister dans le code. Apostrophe ’.
   - `guide.html` l. 140 (#apres) : ⏹ Arrêter et enregistrer, Stop si le chrono tourne encore, ✕ du mode départ. Le GPS qu’ils avaient allumé s’arrête de lui-même. Si vous aviez allumé le GPS vous-même (▶ Activer le GPS ou ◎), touchez Arrêter le GPS. Puis 🏁 Course finie — retour au port.
   - l. 254 et l. 381 : la même règle, en une phrase.
   - l. 268, « Rentrer au port : dans cet ordre » : mêmes étapes. La raison reste : tant qu’un chrono, une trace, le mode départ ou un GPS tournent, l’app se croit en course.
   - l. 260 : « le GPS allumé ».
   - `js/help.js` l. 100 : même procédure. Garder « Arrêter le GPS » et « (sinon l’app se croit encore en course) » pour le GPS allumé à la main.
6. `tools/regate-e2e.mjs` :
   - `ouvreContexte` et `telephoneArchive` acceptent une option `geo` : position dans la rade, par exemple 43.09 N, 5.93 E. Elle passe `geolocation` et `permissions: ['geolocation']` au contexte.
   - Nouveau scénario `retour-port`. Un téléphone de `mondeArchive` le samedi 07/11/2026 à 10:30, heure de Paris. Créer la régate du jour (CVAT, début 2026-11-07), puis `synchronise`.
     L’état du verrou se lit à la dernière entrée « verrou » de localStorage `rade.diag.v1`, vidé toutes les 10 s : attente jusqu’à 25 s. La synchronisation se lit à `ligneSync`. L’état du GPS se lit dans l’onglet En course : `#gOn` ou `#gOff`, et `#raceBar` caché ou non.
     Étapes, chacune vérifiée :
     (a) Top 5’ dans l’onglet Départ : « En pause pendant la course » et verrou « en course ». Puis Stop : la pause disparaît, verrou « journée de régate » (verrou du jour de régate).
     (b) ⛵ Mode départ ouvert, donc GPS d’office : en pause. ✕ sans chrono : `#gOn` visible, `#raceBar` caché, la pause disparaît dans les 6 s, verrou « journée de régate ».
     (c) Mode départ, DÉPART 5’ (`[data-a=go]`), puis ✕ : le chrono tourne, `#gOff` toujours visible, toujours en pause. Le GPS n’est pas coupé pendant un chrono. Puis Stop dans l’onglet Départ : `#gOn`, la pause disparaît.
     (d) ⏺ Enregistrer ma trace : en pause. ⏹ Arrêter et enregistrer : `#gOn`, la pause disparaît, puis `synchronise` réussit (« À jour »).
     (e) ▶ Activer le GPS : en pause. Ouvrir le mode départ puis ✕ : `#gOff` toujours là, toujours en pause, car le GPS manuel est gardé. Arrêter le GPS : la pause disparaît.
     (f) 🏁 Course finie — retour au port : « Course finie notée », verrou « libre ».
     (g) `sansErreur`, aucune violation CSP, aucun chemin refusé.
   - Ajouter `retour-port` à `SCENARIOS`.
7. `npm run stamp`.
  </action>
  <verify>
    <automated>npm run stamp && npm run check && PW_REQUIRED=1 node tools/regate-e2e.mjs retour-port archive creer guide entetes</automated>
    <fails_when>code de sortie non nul, une ligne « not ok », un scénario « ÉCHEC » ou une sortie 2. En particulier : GPS encore actif après ⏹ et ✕ sans chrono ; GPS coupé alors qu’un chrono, une trace, le mode départ ou un GPS manuel tournent ; synchronisation non en pause tant qu’un GPS tourne ; verrou « libre » avant « Course finie » le jour de régate</fails_when>
  </verify>
  <acceptance_criteria>
- js/racelock.js exporte `gpsLeftAlone`. `isActive` et `lockState` sont identiques à la v34 : `git diff 0e88a61 -- js/racelock.js` (0e88a61 = v34, point de départ de la branche) ne montre que des lignes ajoutées, le prédicat et son commentaire.
- `npm test` passe, avec :
  - les cas de gpsLeftAlone, dont « chrono 4 h après H → faux » ;
  - les gardes « releaseGps seulement sur ✕, ⏹ et Stop », « startGps avec une origine », « raceActive garde gpsOn », « close() appelle api.closed?.() » ;
  - les gardes existantes de stopGps et raceTick, inchangées ;
  - le guide et l’aide qui disent « s’arrête de lui-même ».
- Le scénario `retour-port` est OK, ainsi que `archive`, `creer`, `guide` et `entetes`.
- guide.html et js/help.js décrivent le nouveau retour au port. Tous les span.k existent dans le code.
  </acceptance_criteria>
  <done>Après la course, ⏹ puis ✕ (et Stop si le chrono tourne) éteignent le GPS allumé d’office : l’app ne se croit plus en course, la synchronisation repart et le bandeau de mise à jour n’attend plus que « Course finie » le jour de régate. Pendant une course, rien n’est coupé et rien ne s’échange. Commit atomique.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigateur → middleware (Vercel) | toute adresse demandée, connu ou non, encodée ou non ; le code d’accès vient d’un cookie ou de ?acces= |
| middleware → fichiers statiques du dépôt | outputDirectory « . » : tout le dépôt est publié, sources des fonctions et dossiers internes compris |
| données d’un autre téléphone → page | rapports et noms de régate venus de l’archive partagée, affichés dans l’app |
| page → services tiers | Open-Meteo, Pioupiou (lecture) ; aucun autre hôte |
| app → verrou de course | un état mal compté (GPS laissé seul) bloque la synchronisation ; un état sous-compté l’autoriserait pendant une course |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261020-01 | Information disclosure | middleware.js (fichiers internes avec code valide : empreintes, prompts, plans, sources) | high | mitigate | liste blanche `cheminDeLApp` ; 404 sans écho après authentification ; tests sur tout fichier du dépôt hors de l’app (tâche 1) |
| T-261020-02 | Information disclosure | middleware.js (contournements : %2F, %2e%2e, //, casse, .js, _) | high | mitigate | refus de `%`, `\`, `//` et des segments en point avant toute autre règle ; noms de fichiers stricts ; /api/<nom> en minuscules seulement ; cas testés un par un (tâche 1) |
| T-261020-03 | Information disclosure | réponses 404, tests, SUMMARY | high | mitigate | corps fixe sans le chemin ni le code ; les tests vérifient l’absence du faux code et des empreintes dans le corps et les en-têtes ; empreintes lues à l’exécution seulement ; garde existante « aucune empreinte hors de middleware.js » (le plan n’en contient aucune) |
| T-261020-04 | Spoofing | acces.js rendu public | low | mitigate | contenu sans secret, déplacé mot pour mot ; la règle `suite` même-site est conservée et testée dans Chromium (exemple.test → « / ») |
| T-261020-05 | Tampering (XSS) | page de l’app, rapports et noms venus de l’archive | high | mitigate | CSP script-src 'self' sans script en ligne ni eval ; cadre sandbox conservé ; gardes « aucune page avec script en ligne ni on…= » (tâche 2) |
| T-261020-06 | Tampering (clickjacking) | toutes les pages | medium | mitigate | X-Frame-Options DENY et frame-ancestors 'none' |
| T-261020-07 | Information disclosure | Referer vers Open-Meteo et Pioupiou | low | mitigate | Referrer-Policy same-origin |
| T-261020-08 | Elevation of privilege | fonctions du navigateur (caméra, paiement, USB, MIDI, capture d’écran) | low | mitigate | Permissions-Policy : ces fonctions coupées, seules les fonctions utilisées par le code restent permises (garde « API utilisée ↔ permission ») |
| T-261020-09 | Denial of service (auto-infligé en mer) | CSP ou liste blanche qui casse l’app | critical | mitigate | serveur local commun qui applique vercel.json et cheminDeLApp ; échec de scénario sur toute violation ou tout chemin refusé ; mesure hors réseau sous en-têtes (le service worker garde les en-têtes en cache) ; ajustements de CSP bornés |
| T-261020-10 | Denial of service | GPS coupé pendant une course | critical | mitigate | arrêt seulement sur ✕, ⏹ ou Stop, quand gpsLeftAlone (aucun chrono, même au-delà de 3 h ; GPS d’office seulement) ; jamais sur une horloge ; gardes statiques ; scénario retour-port (c) et (e) |
| T-261020-11 | Tampering (intégrité de la course, D-03) | synchronisation pendant une course | high | mitigate | isActive inchangé : tout GPS allumé compte toujours ; le scénario vérifie la pause tant qu’un GPS, un chrono, une trace ou le mode départ tournent |
| T-261020-12 | Repudiation | arrêt automatique du GPS | low | mitigate | note au journal de diagnostic (« gps : arrêté : … », « verrou : … ») |
| T-261020-SC | Tampering | installations npm/pip/cargo | high | mitigate | aucune installation dans ce plan ; Playwright et Chromium restent hors dépôt (tools/pw.mjs) ; toute installation est interdite sans le portail de légitimité des paquets |
</threat_model>

<verification>
Après la tâche 3, une seule fois, depuis la racine du dépôt, sur la branche `apercu-phase-05` :

1. `npm run check` : vert.
2. `git diff --quiet f80c365 -- js/courses.js tests/reference/` : la référence SNPM n’a pas bougé.
3. `PW_REQUIRED=1 node tools/regate-e2e.mjs` : tous les scénarios, « Bilan : N/N », sans violation CSP ni chemin refusé.
4. `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : « RÉSULTAT : OK ».
5. `npm run release -- "sécurité : fichiers internes fermés, en-têtes, GPS arrêté après la course"` : v35. La note fait 73 caractères, sans < ni >.
6. `RT_STRICT=1 node tools/stamp.mjs --check`, puis `VERCEL_ENV=production npm run gate` : verts.
7. `git diff --quiet f80c365 -- js/courses.js tests/reference/` de nouveau. Pour les empreintes, le test « archive : aucune empreinte de la table n’apparaît ailleurs que dans middleware.js », lancé aux étapes 1 et 6, fait foi. Il ne rapporte que des noms de fichiers : ne jamais afficher une empreinte pour vérifier.
8. Commit sur `apercu-phase-05`, avec en fin de message les lignes d’attribution du rappel de session, puis `git push origin apercu-phase-05`.

Aucune mise en production ici. L’orchestrateur ouvre la PR en brouillon. Après le « publie » écrit par Romain, il vérifie en production :
- un chemin interne en 404 avec code, en 401 sans code ;
- les en-têtes sur `/` ;
- l’app, la dictée et le GPS sur iPhone.
Règle des 48 h respectée : régate les 7-9 novembre.
</verification>

<success_criteria>
- Défaut 1 : avec un code valide, aucun fichier interne n’est servi (404 sans écho) ; sans code, 401 ou redirection comme avant ; tout ce que l’app charge passe (Node et Chromium).
- Défaut 2 : nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options et CSP sur tous les chemins. L’app les respecte dans Chromium, en ligne et hors réseau, sans aucune violation.
- Défaut 3 : après ⏹ et ✕ sans chrono, le GPS d’office s’arrête et l’app ne se croit plus en course. Le chrono, la trace, le mode départ et le GPS manuel gardent le verrou ; le verrou du jour de régate tient jusqu’à « Course finie ».
- v35 publiée sur l’aperçu `apercu-phase-05`, `VERCEL_ENV=production npm run gate` vert, référence SNPM intacte, aucun code ni empreinte écrit.
</success_criteria>

<output>
Créer `.planning/quick/261020-sec-durcissement/261020-sec-SUMMARY.md`. Y consigner : les décisions P-01 à P-03, les éventuels ajustements bornés de la CSP et de Permissions-Policy avec le scénario qui les a révélés, la liste des scénarios et le bilan Chromium, la médiane de measure-boot, le numéro de version et le hachage de la v35, le commit et la branche poussée. Ni code, ni empreinte.
</output>
