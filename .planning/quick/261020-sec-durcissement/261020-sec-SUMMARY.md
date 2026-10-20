---
phase: quick-261020-sec
plan: 01
subsystem: securite
tags: [middleware, liste-blanche, csp, en-tetes, permissions-policy, gps, verrou-de-course, v35, apercu-vercel]

requires:
  - phase: quick-261020-aid
    provides: "v34 (guide refait, aide intégrée) : point de départ de la branche apercu-phase-05"
provides:
  - "middleware.js : cheminDeLApp (liste blanche) ; tout chemin hors de l’app répond 404 sans écho après authentification ; acces.js public"
  - "acces.js, js/regles.js, rapports/coupe-snpm-2026.js : scripts sortis des pages mot pour mot (plus aucun script en ligne)"
  - "vercel.json : en-têtes de sécurité sur tous les chemins, CSP de l’app, CSP propre aux rapports publics"
  - "tools/serveur-local.mjs : serveur commun des outils Chromium (en-têtes de vercel.json et liste blanche du middleware appliqués)"
  - "js/racelock.js gpsLeftAlone + js/app.js releaseGps : le GPS allumé d’office s’arrête avec la dernière activité de course"
  - "release v35 poussée sur apercu-phase-05 (production inchangée)"
affects: [recette de Romain sur iPhone, décision de mise en production (avant le gel du 2 novembre)]

plan_head_before: 36bbf5c131eec18affff58c340e5f639afc925f7
plan_head_after: c40d262aa38090b47d82f19ff471d140be963881

actuals:
  tokens: 148000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "liste blanche plutôt que liste noire : la même fonction cheminDeLApp décide en production et dans les essais Chromium"
    - "les outils Chromium servent le dépôt avec les en-têtes de vercel.json et échouent à la moindre violation CSP ou au moindre chemin refusé"
    - "un GPS retient son origine (manuel / auto) ; seul un geste qui termine la dernière activité peut éteindre un GPS d’office"

key-files:
  created: [acces.js, js/regles.js, rapports/coupe-snpm-2026.js, tools/serveur-local.mjs, tests/entetes.test.mjs]
  modified: [middleware.js, acces.html, regles.html, rapports/coupe-snpm-2026.html, vercel.json, js/racelock.js, js/app.js, js/startmode.js, js/help.js, guide.html, tools/regate-e2e.mjs, tools/measure-boot.mjs, tests/access.test.mjs, tests/boot.test.mjs, tests/racelock.test.mjs, tests/guide.test.mjs, sw.js, js/version.js, release.json]

key-decisions:
  - "P-01 : liste blanche cheminDeLApp (refus de %, \\, //, segment en point ; noms exacts ; un fichier sous js/ data/ vendor/ icons/ rapports/ ; /api/<nom> en minuscules)"
  - "P-02 : une clé d’en-tête n’est jamais posée par deux règles ; CSP de l’app hors /rapports/, CSP des rapports à part (Google Fonts)"
  - "P-03 : le GPS d’office s’arrête seulement à ✕, ⏹ ou Stop, si aucun chrono n’existe ; le verrou n’est pas affaibli (isActive et lockState inchangés)"

requirements-completed: [TEST-02, FIAB-01, ARCH-01]

coverage:
  - id: D1
    description: "Avec un code valide, tout fichier interne répond 404 sans écho ; l’app, ses fonctions et ses adresses restent servies ; sans code, 401 ou redirection comme avant"
    requirement: TEST-02
    verification:
      - kind: unit
        ref: "tests/access.test.mjs (cheminDeLApp, 404 sans écho, SHELL et /api servis, adresses balayées, sans code jamais 404)"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs : le serveur local applique cheminDeLApp, 22/22 sans chemin refusé"
        status: pass
    human_judgment: false
  - id: D2
    description: "En-têtes de sécurité (nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, CSP) respectés par l’app sous Chromium, en ligne et hors réseau"
    requirement: FIAB-01
    verification:
      - kind: unit
        ref: "tests/entetes.test.mjs (motifs, CSP exacte, hôtes de js/weather.js, pages sans script en ligne, permissions)"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs (scénarios entetes et gpx, aucune violation) ; node tools/measure-boot.mjs 4 5 (médiane 541 ms, hors réseau, sous CSP)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Le GPS allumé d’office s’arrête après ⏹, ✕ et Stop quand plus rien ne court ; jamais pendant un chrono, une trace, le mode départ ou un GPS manuel ; rien ne s’échange tant qu’un GPS tourne"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/racelock.test.mjs (gpsLeftAlone), tests/boot.test.mjs (gardes releaseGps, origine, raceActive, close), tests/guide.test.mjs (retour au port)"
        status: pass
      - kind: e2e
        ref: "node tools/regate-e2e.mjs retour-port (a à f, GPS simulé, contrôles négatifs réalisés)"
        status: pass
    human_judgment: false
  - id: D4
    description: "En-têtes, dictée, GPS et mise en production sur iPhone réel"
    verification: []
    human_judgment: true
    rationale: "Le comportement de Safari (Permissions-Policy, CSP, GPS, dictée) et la production Vercel ne se prouvent que sur appareil et après le « publie » de Romain"

duration: 150min
completed: 2026-10-20
status: complete
---

# Phase quick-261020-sec Plan 01: Durcissement avant le gel Summary

**Liste blanche du middleware (404 pour tout fichier interne), en-têtes de sécurité avec une CSP prouvée dans Chromium, et GPS allumé d’office éteint au geste qui termine la dernière activité de course, sans affaiblir le verrou : v35 sur apercu-phase-05.**

## Performance

- **Duration:** environ 150 min
- **Tasks:** 3/3
- **Files modified:** 24 (diff 36bbf5c..c40d262)

## Accomplishments

- **Défaut 1 (fichiers internes).** `middleware.js` exporte `cheminDeLApp`, fonction pure. Après authentification, tout chemin hors de l’app répond 404 : corps fixe (« Introuvable. » ou `{"error":"introuvable"}`), `Cache-Control: no-store`, `nosniff`, ni cookie ni écho du chemin. Les onze fichiers du défaut, tout fichier du dépôt hors de l’app et les contournements (`%2F`, `%2e%2e`, `//`, majuscules, `.js`, `_`, dossiers cachés) reçoivent 404. Sans code, rien ne change : 401 ou redirection vers acces.html, jamais 404. Le test balaye chaque entrée du SHELL, chaque fonction `/api/<nom>` et chaque adresse de même origine demandée par `js/*.js` et les pages.
- **Défaut 2 (en-têtes).** `vercel.json` ajoute trois règles : quatre en-têtes de sécurité sur tous les chemins, la CSP de l’app (hors `/rapports/`) et la CSP des rapports publics. Les trois scripts en ligne (acces.html, regles.html, rapport SNPM) sont sortis mot pour mot (`acces.js` public, `js/regles.js` dans le SHELL, `rapports/coupe-snpm-2026.js`). `tools/serveur-local.mjs` sert les outils avec ces en-têtes et la liste blanche ; `regate-e2e` et `measure-boot` échouent à la moindre violation ou au moindre chemin refusé.
- **Défaut 3 (GPS).** Le GPS retient son origine (`'manuel'` ou `'auto'`). `releaseGps`, appelée seulement par ✕ du mode départ, ⏹ de la trace et Stop du chrono, éteint le GPS si `gpsLeftAlone` est vrai (GPS d’office, mode départ fermé, aucune trace, aucun chrono même au-delà de 3 h). `isActive` et `lockState` sont identiques à la v34 (`git diff 0e88a61 -- js/racelock.js` : lignes ajoutées seulement). La raison du verrou (« en course », « journée de régate », « libre ») est écrite au journal quand elle change.

## Décisions du planificateur appliquées

- **P-01** liste blanche, pas liste noire, vérifiée contre le SHELL généré et contre les adresses de l’app ; le serveur local des outils applique la même fonction.
- **P-02** aucune clé d’en-tête posée par deux règles ; la page des Rapports garde Google Fonts sans élargir la CSP de l’app.
- **P-03** arrêt du GPS d’office seulement au geste qui termine la dernière activité ; jamais sur une horloge ; le verrou n’est jamais affaibli. Cas restant, sûr et dit dans le guide : un chrono jamais arrêté garde le GPS et le verrou jusqu’à Stop ou « Arrêter le GPS ».

## Ajustements bornés de la CSP, de la Permissions-Policy et de l’outil

Aucun ajustement de la CSP n’a été nécessaire : les valeurs du plan passent telles quelles, y compris la page « Plein écran » du rapport (blob) et son cadre sandbox, la lecture PDF (pdf.js, worker `vendor/`), la 3D, l’archive et l’ouverture hors réseau. Pas de `blob:` ajouté à `frame-src`.

1. **Permissions-Policy : `web-share=(self)` retiré.** Révélé par le premier lancement de `regate-e2e` (tous les scénarios) : Chromium répond « Unrecognized feature: 'web-share' ». Retiré de `vercel.json`, pas filtré dans l’outil (règle du plan). Le partage reste permis à la page par la valeur par défaut. `tests/entetes.test.mjs` garde « web-share » hors de la liste et vérifie les autres API utilisées (geolocation, microphone, screen-wake-lock, fullscreen, accelerometer, gyroscope, magnetometer, clipboard-write) à `(self)`.
2. **Chemin `/x` admis pour trois scénarios (hors CSP).** `archive`, `archivehors` et `equipage` affichent le rapport PIÉGÉ `RAPPORT_TEST`, dont l’image `<img src=x>` demande `/x` depuis le cadre sandbox : c’est le contenu hostile qui la demande, pas l’app, et la liste blanche le refuse en 404 comme voulu. L’outil l’admet pour ces trois scénarios seulement (`REFUS_ADMIS`), en plus de `/favicon.ico` (demande automatique du navigateur) pour tous.
3. **Contrôles négatifs.** CSP privée de l’hôte Pioupiou : les scénarios `entetes` et `creer` échouent (« Refused to connect »). `gpsLeftAlone` forcé à faux : `retour-port` échoue à l’étape (b). `gpsLeftAlone` sans le test du chrono : `retour-port` échoue à l’étape (c).

## Preuves

- `npm run check` : 567 tests, 0 échec. `RT_STRICT=1 node tools/stamp.mjs --check` puis `VERCEL_ENV=production npm run gate` : verts.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs` : **Bilan : 22/22**, aucune violation CSP, aucun chemin refusé (hors les admis ci-dessus). Scénarios : reprise, equipage, archive, archive-bouees, archivehors, creer, manche, auteur, ic, depuis-ic, vraisemblance, gel, debrief-tardif, gpx, gpx-choix, ia, ia-erreurs, arbitre, bouees, guide, entetes, retour-port.
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : médiane de l’interface utile **541 ms** (maximum 640 ms), hors réseau, CPU x4, sous CSP : RÉSULTAT OK.
- Scénario `retour-port` (jour de régate, GPS simulé) : (a) chrono : pause et verrou « en course », Stop lève la pause ; (b) mode départ puis ✕ sans chrono : GPS éteint, bande de course retirée ; (c) ✕ avec un chrono : GPS conservé, pause conservée, aucun échange ; Stop : tout s’arrête ; (d) trace : ⏹ éteint le GPS, la synchronisation repart (« À jour ») ; (e) GPS manuel : ✕ ne le coupe pas, « Arrêter le GPS » seul ; (f) « Course finie » : verrou « libre ».
- Référence SNPM intacte (`git diff --quiet f80c365 -- js/courses.js tests/reference/`). Aucune empreinte hors de middleware.js (test existant, noms de fichiers seulement).
- v35 : identifiant de contenu `153aaa87ec`, note de 73 caractères.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] web-share inconnu de Chromium** : voir ajustement 1 ci-dessus. Fichiers : vercel.json, tests/entetes.test.mjs.

**2. [Rule 3 - Blocking] Image du rapport piégé refusée par la liste blanche** : voir ajustement 2. Fichier : tools/regate-e2e.mjs.

**3. [Rule 1 - Bug de l’outil] #recStop protégé par try/finally** : le gestionnaire appelle `releaseGps` aussi quand la sauvegarde finale échoue (exigence du plan) ; l’erreur reste propagée comme avant.

### Attribution des commits

Le plan demandait un trailer `Co-Authored-By: Claude Opus 5.5` ; la session tourne sur un autre modèle (Sonnet 5.5) et le rappel de session de l’outil impose ce nom : les trois commits portent `Claude Sonnet 5.5` et la ligne `Claude-Session`. Aucun nom de modèle dans le code, la documentation ni le corps des messages.

## Constat hors périmètre (aucune correction)

L’indicateur « En pause pendant la course » (`paintSync`) n’est repeint que si le tic de course (toutes les 5 s) voit un changement d’état. Si une activité s’arrête puis reprend en moins de 5 s et qu’une sonde réseau ou une synchronisation a repeint l’indicateur entre-temps, il peut afficher « À jour » pendant quelques secondes alors que l’app est bien en course : le verrou, lui, décide à chaque échange sur `raceActive`, donc rien ne s’échange. Rencontré par le scénario (étape e, avant l’attente du tic) ; le scénario attend la transition du verrou avant de recommencer. Pas de correction ici (hors défaut), à décider avec Romain.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau point d’entrée réseau, aucun nouveau chemin d’authentification. `acces.js` est public par construction (contenu sans secret, déplacé mot pour mot). Menaces du plan T-261020-01 à 12 traitées : voir les preuves ci-dessus.

## Remaining checks (production et iPhone)

Après le « publie » de Romain : un chemin interne en 404 avec code et en 401 sans code ; les en-têtes sur `/` ; ouverture de l’app installée sur iPhone (Safari et écran d’accueil) sans violation ; dictée (microphone), GPS et maintien de l’écran sous la Permissions-Policy ; « Plein écran » d’un rapport ; page d’accès et lien personnel (`acces.js`) ; régate des 7-9 novembre : ⏹, ✕ puis « Course finie » sur un vrai GPS. Règle des 48 h respectée : régate les 7-9 novembre.

## Commits

- 51260b0 : liste blanche du middleware, 404 pour les fichiers internes, pages sans script en ligne
- bcac0ce : en-têtes de sécurité dans vercel.json, prouvés dans Chromium
- c40d262 : le GPS allumé d’office s’arrête avec la dernière activité de course (v35)
- Branche poussée : apercu-phase-05 (origin), `main` non touchée.

## Self-Check: PASSED

Fichiers créés présents (acces.js, js/regles.js, rapports/coupe-snpm-2026.js, tools/serveur-local.mjs, tests/entetes.test.mjs) ; commits 51260b0, bcac0ce et c40d262 ancêtres de HEAD ; commits mesurés : 3.
