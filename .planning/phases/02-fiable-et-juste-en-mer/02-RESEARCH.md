# Phase 2 : Fiable et juste en mer - Research

**Researched:** 2026-10-19
**Domain:** PWA iPhone en mer, JavaScript sans build : bips planifiés sur l'horloge audio, détection du son coupé, verrou d'écran, voyant d'état, ouverture < 2 s hors réseau, journal de diagnostic, bouées douteuses recalées depuis la trace
**Confidence:** HIGH sur ce qui a été exécuté ici (Chromium 1194 via Playwright 1.56.1, Node 22.22, trace SNPM réelle) ; MEDIUM sur le comportement d'iOS (sources = bugs WebKit et MDN, aucun iPhone dans le bac à sable) ; LOW sur tout ce qui concerne l'app *installée* sur iPhone (aucune source, à confirmer sur appareil)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bouées (JUST-01, JUST-02)**
- **D-01:** Seules les bouées de position approximative sont signalées « position à confirmer » : aujourd'hui GR1 (3) et Carqueiranne (11), `src: 'approx'`. Les autres (relevés GPS, coordonnées CVAT, calculées, OSM) restent normales. Signalement sur la carte, dans les parcours et en mode départ.
- **D-02:** Le recalage se fait **depuis la trace**, au débrief : l'app propose la position du passage au plus près de la bouée et l'équipier valide. Pas de bouton à toucher en course. La saisie manuelle de coordonnées reste possible (exigée par JUST-02), sans être mise en avant.
- **D-03:** Une bouée recalée affiche sa source (« trace du JJ/MM », « saisie ») et sa date ; elle n'est plus signalée.
- **D-04:** Le recalage reste sur le téléphone qui l'a fait ; partage automatique avec l'archive en phase 4. En attendant, Claude peut reporter à la main dans `js/courses.js` une position recalée validée par Romain.

**iPhone**
- **D-05:** Versions d'iOS inconnues : prévoir les deux cas. Le voyant « écran maintenu » montre si le verrou d'écran tient réellement ; s'il n'est pas disponible ou se perd, alerte + conseil (verrouillage auto « Jamais » pendant la course).

### Claude's Discretion
- Forme et place du voyant (permanent en mode départ et en course, alerte si GPS muet > 10 s, écran non maintenu, son coupé, réseau absent).
- Signal visuel des bips clés (flash plein écran), détection du son coupé et bouton « tester le son ».
- Bips planifiés sur l'horloge audio (AudioContext) plutôt que sur `setInterval`.
- Journal de diagnostic : local, consultable dans l'aide, heure de chaque erreur, copiable pour l'envoyer.
- Ouverture < 2 s hors réseau : mesurer d'abord, ne charger la 3D et les prévisions qu'après l'interface utile.

### Deferred Ideas (OUT OF SCOPE)
- Partage des recalages entre téléphones (phase 4, archive).
- Bouton « bouée ici » en course (non retenu pour l'instant).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIAB-03 | Les bips du chrono tombent à la seconde, même quand l'app calcule (planifiés sur l'horloge audio) | `js/beeper.js` : jalons purs depuis `timer.end`, fenêtre de 8 s posée sur `AudioContext.currentTime`, recalage à chaque tick ; mesuré dans Chromium : écart −4…+7 ms avec le fil principal gelé 1,3 s, contre 1,0 à 1,3 s de retard et un bip perdu avec `setInterval` |
| FIAB-04 | L'app prévient si le son est coupé, propose « tester le son » et double chaque bip clé d'un signal visuel plein écran | Santé audio = `state` + horloge qui avance (WebKit 276016) ; `navigator.audioSession.type = 'playback'` (iOS 17+, WebKit 237322) ; test du son avec confirmation de l'équipier ; flash ≤ 1 par minute (WCAG 2.3.1) |
| FIAB-05 | Un voyant permanent montre le GPS (âge du dernier point), l'écran maintenu, le son et le réseau | `js/status.js` (fonction pure, seuils), `js/wakelock.js` (un seul verrou, état honnête), sonde réseau par `HEAD /icons/favicon-32.png` (le worker ne la traite pas), placement dans la barre du mode départ et sous l'en-tête en course |
| FIAB-06 | L'app installée s'ouvre en moins de 2 s hors réseau ou avec un réseau faible | Mesure : 4,3 à 8,1 s avant l'interface utile à CPU ×4 (12 ouvertures) ; prototype « interface utile d'abord » : 0,5 à 0,7 s ; cinq changements ciblés |
| FIAB-07 | Les erreurs du mode départ et du mode course sont consignées dans un journal de diagnostic consultable dans l'app | `js/diag.js` (tampon circulaire borné, nettoyage des secrets) + `js/journal.js` (gestionnaires globaux, contexte départ / course), lecture et copie dans l'aide |
| JUST-01 | Les bouées dont la position n'est pas confirmée sont signalées sur la carte, dans les parcours et dans le mode départ | `DOUBT(m) = m.src === 'approx'` ; GR1 (3) figure dans 12 parcours sur 13 : signalement discret (pastille « ? », puce « à confirmer ») |
| JUST-02 | Un équipier peut recaler la position d'une bouée (point GPS au passage ou saisie), avec la source et la date | `js/markfit.js` (sommet du virage + 14 m vers l'intérieur : ±20 m dans 90 % des cas simulés), `js/marks.js` (saisie 43°05.845N, recalages `rade.marks.v1` appliqués au démarrage seulement, jamais dans les tests) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives lues dans `/home/user/rade-tactique/.claude/CLAUDE.md`, traitées comme des décisions verrouillées :

- JavaScript ES modules dans le navigateur, **sans framework, sans build, sans TypeScript** ; tout nouvel outillage reste hors du chargement de l'app (scripts `tools/`, tests `tests/`).
- Nouveau module navigateur : `js/<nom>.js`, **commentaire d'en-tête en français**, exports nommés, importé depuis `js/app.js` ; puis `npm run stamp` (il l'ajoute au SHELL). **Ne jamais éditer `sw.js` ni `js/version.js` à la main.**
- Interface et commentaires en français, apostrophe typographique `’` dans les chaînes d'interface, séparateurs `—` et `·`.
- `esc()` avant tout `innerHTML` ; préférer `textContent` pour un texte simple. Échec silencieux utile : `try { … } catch { … }` sans binding, **mais** FIAB-07 impose de consigner les échecs du chemin course au lieu de les avaler.
- Clés de stockage `rade.<nom>.v1` ; changer le suffixe quand la forme persistée change.
- Tests `node:test` + `linkedom`, dans `tests/*.test.mjs`, lancés par `npm test` ; `npm run check` doit rester vert.
- Aucun code d'accès, aucune empreinte de `middleware.js`, aucune clé dans le code, les journaux, la documentation ou les rapports.
- Règle d'exploitation : pas de mise en production dans les 48 h avant une régate ni pendant une course, sauf correctif critique hors course.
- Pas de formateur ni de lint configurés ; séparateurs de section `// ───────────────────────── titre` dans les longs fichiers.

## Summary

Les quatre fonctions « fiabilité » (bips, voyant, journal, ouverture rapide) tiennent dans **cinq petits modules purs et testables sous Node** (`js/beeper.js`, `js/status.js`, `js/wakelock.js`, `js/diag.js` + `js/journal.js`) plus **deux modules pour les bouées** (`js/marks.js`, `js/markfit.js`), tous branchés depuis `js/app.js`. Aucune dépendance n'est ajoutée. Les prototypes de ce document ont été exécutés ici (32 tests `node:test` verts sur les prototypes, un essai Chromium sur le vrai module des bips) ; ils ne sont **pas** dans le dépôt : le planificateur les recopie depuis la section *Code Examples*.

**Bips (FIAB-03).** Le défaut actuel est réel et mesuré : dans Chromium, avec le fil principal gelé 1,2 s puis 0,8 s, les bips du code actuel (`setInterval` 100 ms puis oscillateur immédiat) arrivent avec **1,0 à 1,3 s de retard** et deux d'entre eux se fondent en un seul ; les mêmes bips posés à l'avance sur `AudioContext.currentTime` tombent à **−4…−1 ms** de la cible, et le vrai `createBeeper` à **−3…+7 ms** (mesure par un `AudioWorklet`, donc sur le fil audio). Piège central : quand le contexte est suspendu ou interrompu (verrouillage d'écran, appel), `currentTime` s'arrête et les bips déjà posés sonnent en retard après la reprise ; le module recale donc **tout** à chaque tick de 250 ms depuis `timer.end` (Date), et annule les bips décalés de plus de 30 ms.

**Son coupé (FIAB-04).** Le bouton latéral silencieux de l'iPhone coupe Web Audio par défaut (type de session « ambient ») ; depuis iOS 17, `navigator.audioSession.type = 'playback'` y remédie d'après un ingénieur WebKit. Ce qui est détectable : `state` ≠ `running` et horloge arrêtée (WebKit 276016 montre `running` avec une horloge figée). Ce qui ne l'est pas : le bouton silencieux, le volume, le routage Bluetooth. Donc : détection honnête + **« tester le son » avec confirmation de l'équipier** + flash plein écran sur les bips des minutes et le signal de départ (au plus 1 par minute, très en dessous du seuil de 3 par seconde de WCAG 2.3.1).

**Voyant (FIAB-05) et écran (D-05).** Le verrou d'écran n'est fiable en app installée qu'à partir d'iOS 18.4 (WebKit 254545) ; avant, `request()` peut aboutir sans tenir ou être refusé : le voyant ne peut dire la vérité qu'avec `WakeLockSentinel.released` + événement `release`, et le journal garde la trace de chaque mise en veille (`visibilitychange`). La sonde réseau doit éviter le piège du worker : un `GET` sur un fichier de l'app répond **200 depuis le cache hors réseau** ; un `HEAD` sur `/icons/favicon-32.png` n'est pas traité par le worker (méthode ≠ GET, `sw.js` ligne 25) et échoue réellement hors réseau (vérifié).

**Ouverture < 2 s (FIAB-06).** Mesuré hors réseau, CPU ×4, 12 ouvertures : l'interface utile apparaît à **4,3 à 8,1 s** (critère non tenu), alors que le premier affichage est à 0,2-0,4 s. Le temps part dans `Terrain.load` + `Scene3D` (1,6-2,0 s) puis dans `updateAll()` (2,5-6 s) dominé par le champ de vent (`WindField.kit` 1,3 s et `compute` 0,4 s à CPU ×1). Un prototype « chrono et mode départ d'abord, le reste après » donne **0,5 à 0,7 s** à CPU ×4 (5 ouvertures, serveur réellement arrêté).

**Bouées (JUST-01/02).** Piège de méthode à connaître : les positions « relevé GPS du 18/10/2026 (±50 m) » des marques 6 et 7 ont été posées à la main d'après **cette même trace** (commits 758307c et d33a785, méthode non consignée) : elles ne sont pas une vérité de terrain. La validation sur la trace SNPM mesure donc une *cohérence*, pas une exactitude ; l'exactitude est mesurée par simulation (1000 tirages par scénario). Recommandation : proposer la position du **sommet du virage décalée de 14 m vers l'intérieur** (±10 m médian, ±20 m à 90 %), pas le point de passage au plus près (erreur = distance de passage + erreur de la position supposée : 40 m pour 50 m de décalage, 103 m pour 150 m).

**Primary recommendation :** écrire d'abord les six modules purs avec leurs tests (vague 1, en parallèle), puis un seul plan de câblage de `js/app.js` / `js/startmode.js` / `js/track.js` / `js/help.js` / `styles.css` / `index.html` (ces fichiers sont partagés : pas de plans parallèles dessus), restructurer `init()` pour l'ouverture rapide, publier une version (`npm run release`) avant le gel du 2 novembre pour laisser les trois iPhone se mettre à jour et passer la recette d'appareil.

## Architectural Responsibility Map

Application sans serveur applicatif : les « niveaux » sont ceux du navigateur.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Jalons du chrono, planification des bips | Module pur `js/beeper.js` (calcul) | Fil audio du navigateur (lecture) | Le calcul est pur (testable sous Node) ; seule l'horloge audio garantit la seconde quand le fil principal est occupé |
| Flash plein écran | Page (`#beepFlash`, CSS) | `js/beeper.js` (`milestones`, `KEY`) | Même source de vérité (`timer.end`) que le son, déclenché par `requestAnimationFrame` |
| Santé du son, test du son | Page (`AudioContext`, `navigator.audioSession`) | Équipier (confirmation d'écoute) | Le niveau sonore et le bouton silencieux ne sont pas lisibles : seul l'humain tranche |
| Verrou d'écran | `js/wakelock.js` (page) | Journal (mises en veille) | Un seul propriétaire, plusieurs raisons ; état = sentinel non libéré |
| Voyant d'état | `js/status.js` (calcul pur) | `js/app.js` (collecte, rendu) | Seuils testables sans DOM ; rendu et événements dans la page |
| Sonde réseau | Page (`fetch` HEAD, même origine) | Service worker (ne traite pas HEAD ni `/api/`) | `navigator.onLine` n'est qu'un indice (MDN) ; le worker ne doit pas pouvoir mentir |
| Ouverture rapide | Service worker (cache d'abord, déjà en place) | `js/app.js` (ordre d'initialisation) | Le worker répond déjà depuis le cache ; le coût est dans le fil principal |
| Journal de diagnostic | `js/diag.js` pur + `localStorage` | `js/journal.js` (gestionnaires globaux), `js/help.js` (affichage) | Local, borné, sans secret ; affichage dans l'aide |
| Position des bouées et recalages | `js/marks.js` (pur) + `localStorage` `rade.marks.v1` | `js/courses.js` (données de référence, intactes) | Les recalages sont locaux à l'appareil (D-04) et appliqués au démarrage par `app.js` seulement |
| Proposition de recalage | `js/markfit.js` (pur) | Débrief (`js/debrief.js`) pour l'interface de validation | Calcul sur la trace déjà lissée par `analyzeTrack` |

## Standard Stack

### Core

Aucune dépendance à installer. Tout repose sur des API du navigateur et sur l'outillage de test déjà présent.

| Élément | Version | Rôle | Pourquoi |
|---------|---------|------|----------|
| Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`) | navigateur | Bips planifiés sur l'horloge audio | Seule horloge insensible au fil principal [CITED: web.dev/articles/audio-scheduling] |
| `navigator.audioSession` | iOS 17+ (WebKit) | Passer outre le bouton silencieux | [CITED: bugs.webkit.org/show_bug.cgi?id=237322, commentaire de J.-Y. Avenard du 2024-09-25] ; API « expérimentale » [CITED: developer.mozilla.org/docs/Web/API/AudioSession/type] |
| Screen Wake Lock API | Safari 16.4 ; app installée depuis iOS 18.4 | Écran maintenu | [CITED: bugs.webkit.org/show_bug.cgi?id=254545] |
| Service worker existant (`sw.js`) | v26 | Ouverture hors réseau | Cache d'abord déjà livré en phase 1 |
| `node:test` + `linkedom` | Node 22.22 ici (`engines` 24.x), linkedom 0.18.13 | Tests purs et DOM minimal | [VERIFIED: package.json `"linkedom": "0.18.13"`, `"engines": { "node": "24.x" }`] |

### Supporting (hors dépôt, outil de mesure seulement)

| Outil | Version | Usage |
|-------|---------|-------|
| Playwright (global) + Chromium 1194 | 1.56.1 | Mesure d'ouverture et essai de l'horloge audio. **Ne pas** l'ajouter à `package.json` : `npm ci` sur Vercel télécharge des navigateurs ; scripts `tools/*.mjs` facultatifs, hors `npm test` |

### Alternatives Considered

| Au lieu de | Alternative | Compromis |
|------------|-------------|-----------|
| Bips sur l'horloge audio | `<audio>` + `setTimeout` | Insensible au bouton silencieux mais dépend du fil principal : à n'envisager que si l'essai iPhone montre que `audioSession` ne suffit pas |
| `audioSession.type = 'playback'` | Boucle `<audio>` silencieuse (NoSleep, « unmute ») | Documentée dans WebKit 237322 : coûte en performance et affiche des commandes sur l'écran verrouillé. Dernier recours |
| Verrou d'écran seul | Vidéo muette en boucle (NoSleep.js) | Non retenu : D-05 demande alerte + conseil ; coût batterie, démarrage par geste, comportement en mode économie non documenté |
| Journal local | Sentry | Envoie des données à un tiers ; décision reportée (research/SUMMARY.md) |

**Installation :** aucune (`npm ci` inchangé).

**Version verification :** pas de paquet. Les versions d'outillage ont été relevées dans `package.json` et `npm ls -g` (Playwright 1.56.1) [VERIFIED: commandes exécutées cette session].

## Package Legitimacy Audit

Cette phase n'installe **aucun paquet externe** (ni runtime, ni devDependency). Aucune vérification `package-legitimacy` n'est requise ; NoSleep.js, Sentry, Tone.js et `idb` ont été écartés (voir *Don't Hand-Roll*).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (aucun) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
                       ┌─────────────── geste de l'équipier (tap) ───────────────┐
                       ▼                                                          │
 timer.end (Date) ──► setter ──► beeper.arm(end)                                  │
 (Départ, mode départ,           │   tick toutes les 250 ms (setInterval = simple remplissage)
  ±1 min, arrondir, stop)        ▼
                        milestones(end) ─► fenêtre de 8 s ─► AudioContext.currentTime + (at − Date.now())
                                                  │               │ recalage si décalé > 30 ms (suspension, dérive)
                                                  │               ▼
                                                  │        oscillateurs planifiés ──► sortie audio
                                                  │                                     ▲
                                                  │                    audioSession 'playback' (iOS 17+)
                                                  ▼
                               boucle rAF (armée si chrono) ─► #beepFlash (jalons « min » et « go »)

 watchPosition ─► lastFixAt, acc ──┐
 wakelock.state() ────────────────┤
 audio {state, alive, tested} ────┼─► computeStatus(now, …) ─► 4 lampes ─► barre du mode départ / bande « en course »
 sonde HEAD /icons/favicon-32.png ┘         (1 s)                              │ rouge : message + action (relancer, toucher, réglage)
                                                                                ▼
 window.onerror / unhandledrejection / catch du chemin course ─► journal.report ─► diag (tampon 300, localStorage) ─► Aide › Journal › Copier

 démarrage : index.html ─► journal.js (1er import) ─► app.js ─► [interface utile : Départ + En course, splash retiré] ─► (rAF)
             ─► import('./scene3d.js') ─► Terrain.load ─► WindField (kit en tranches) ─► updateAll ─► analyse du parcours

 débrief : trace GPX/enregistrée ─► analyzeTrack().P ─► markfit.proposeMark(P, M0, côté, instant) ─► proposition « trace du JJ/MM » ─► validation ─► marks.saveOverride
           saisie « 43°05.845N 005°56.049E » ─► marks.parseLatLon ─► validation ─► saveOverride ─► applyOverrides(MARKS) au démarrage ─► drawCourse + scheduleAnalysis
```

### Recommended Project Structure

```text
js/
├── beeper.js        # jalons du chrono, planification sur l'horloge audio, santé du contexte (pur)
├── status.js        # computeStatus : quatre lampes à partir d'observations (pur)
├── wakelock.js      # verrou d'écran unique, plusieurs raisons, état honnête
├── diag.js          # tampon circulaire borné + nettoyage des secrets (pur, stockage injecté)
├── journal.js       # singleton diag, gestionnaires window.onerror / unhandledrejection, contexte départ/course
├── marks.js         # DOUBT, saisie de coordonnées, recalages mémorisés, applyOverrides (pur, stockage injecté)
├── markfit.js       # proposeMark : sommet du virage + décalage vers l'intérieur (pur)
├── app.js           # câblage : setter timer.end, init en deux temps, voyant, sonde réseau, interface de recalage
├── startmode.js     # barre de lampes, flash, « tester le son », marque à confirmer, wakelock partagé
├── track.js         # Recorder : wakelock partagé, erreurs d'IndexedDB consignées
└── help.js          # Aide › Journal de diagnostic (lire, copier, vider)
tests/
├── beeper.test.mjs  status.test.mjs  wakelock.test.mjs  diag.test.mjs  marks.test.mjs  markfit.test.mjs
tools/               # facultatif, hors npm test : measure-boot.mjs, audio-clock-check.mjs (Playwright global)
```

### Pattern 1 : jalons purs + ancrage rafraîchi (FIAB-03)

**What:** `milestones(endMs)` donne les instants Date de chaque bip (5-4-3-2-1 min, 50-40-30-20-10 s, 9…1 s, signal). À chaque tick (250 ms), pour tout jalon dans les 8 s à venir, `when = ctx.currentTime + (at − Date.now()) / 1000`. L'ancrage Date ↔ horloge audio est **recalculé à chaque tick** : insensible à la dérive et aux suspensions.
**When to use:** tout bip daté (compte à rebours). Les bips **immédiats** (ping 1200 Hz, OCS 300 Hz, « lance » 1400 Hz, clics du temps à brûler, synchro 1000 Hz : `startmode.js` lignes 173, 194, 198, 200, 231, 301, 305, 323, 324) restent `beepNow(f, d)` sur le même contexte.
**Cadence :** 8 s d'avance / 250 ms de tick (MDN et Chris Wilson proposent 100 ms / 25 ms pour un séquenceur musical ; ici les jalons sont connus à l'avance, une fenêtre longue est gratuite et absorbe un gel du fil principal de moins de 8 s) [CITED: developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques].
**Point de câblage minimal :** `timer.end` est assigné à neuf endroits (`js/app.js` 710-714, `js/startmode.js` 189, 194, 198, 200-202). Remplacer par un **accesseur** sur l'objet `timer` (`Object.defineProperty(timer, 'end', { get, set(v) { _end = v; v == null ? beeper.disarm() : beeper.arm(v); persist… } })`) : zéro modification des sites d'appel, et `timer.beeps` / le bloc de bips de `tickTimer` (lignes 736-743) disparaissent. L'affichage du chrono reste calculé depuis `Date` (inchangé).

### Pattern 2 : voyant = fonction pure + collecte + rendu (FIAB-05)

`computeStatus({ now, needGps, needScreen, needSound, gps, wake, audio, net })` → `{ lamps, worst }`. `need*` vient de `raceActive` (`js/app.js` ligne 633 : `isActive({ now, timerEnd, startModeOpen, recording, gpsOn })`, `js/racelock.js` ligne 17) : une lampe n'alerte que si la fonction correspondante est utilisée (écran non maintenu = rouge seulement en chrono, mode départ ou trace). Rafraîchissement toutes les secondes **seulement** quand le voyant est visible, plus sur événements (point GPS, `visibilitychange`, `statechange`, `online`/`offline`, `release`).

### Pattern 3 : ouverture en deux temps (FIAB-06)

1. Synchrone : `renderStart()` et `renderLive()` (tous deux tolèrent `analysis === null`), liaison des onglets, retrait du splash.
2. Après une frame : `import('./scene3d.js')` (three.module.min.js, 691 Ko), `Terrain.load`, `WindField`, liaison de la carte, `updateAll()`.
3. En tâche de fond : calcul du champ de vent en tranches, analyse du parcours.

### Pattern 4 : recalage = virage proposé, équipier valide (JUST-02)

Pour une bouée `DOUBT` du parcours couru : lister les virages nets (≥ 25°) de la trace entre les passages des marques voisines, classés par distance à la position supposée (≤ 600 m) ; proposer le premier avec `proposeMark` (sommet + 14 m vers l'intérieur, côté `t` ou `b` lu dans la séquence du parcours) ; afficher « à X m de la position actuelle » ; **l'équipier valide ou choisit un autre virage**. Ne pas toucher à `passages()` de `js/debrief.js` (voir Pitfall 9).

### Anti-Patterns to Avoid

- **Bips depuis `setInterval`** : c'est le défaut mesuré ; `setInterval` ne sert qu'à *remplir* la fenêtre.
- **Planifier une seule fois, au lancement du chrono** : l'horloge audio s'arrête quand le contexte est suspendu ou interrompu ; tout bip déjà posé sonne alors en retard.
- **Se fier à `ctx.state === 'running'`** : WebKit 276016 montre un état `running` avec une horloge arrêtée.
- **Sonder le réseau par un `GET` sur un fichier de l'app** : le worker le sert depuis le cache (200 hors réseau).
- **Ajuster un cercle sur le virage** pour trouver la bouée : rayons de 102 et 160 m sur la trace SNPM, centres à 71 et 126 m de la position enregistrée (rejeté).
- **Détecter le sommet par le cap pointe par pointe** : fragile au bruit GPS (erreur jusqu'à 126 m en simulation) ; utiliser le changement de cap sur toute la fenêtre.
- **Appliquer les recalages dans `courses.js` ou à l'import d'un module** : les tests de référence lisent `MARKS` directement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horloge des bips | Minuterie de scrutation précise | `AudioContext.currentTime` + `start(when)` | Les timers JS sont retardés de dizaines de ms par le rendu et le ramasse-miettes [CITED: web.dev/articles/audio-scheduling] |
| Écran éveillé | Vidéo muette (NoSleep.js) | `navigator.wakeLock` + alerte + conseil (D-05) | Hack non documenté, démarrage par geste, coût batterie |
| Seuil de flash | Calcul de luminance | Règle ≤ 3 flashs par seconde de WCAG 2.3.1 : ici ≤ 1 par minute | Passe automatiquement [CITED: w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html] |
| Détection du bouton silencieux | Astuce de lecture / lecture de volume | Aucune API documentée : test du son avec confirmation | Le volume et le bouton ne sont pas lisibles [ASSUMED: aucune API trouvée] |
| Suivi d'erreurs | Sentry / service tiers | `js/diag.js` local | Pas de donnée vers un tiers ; décision reportée |
| Ajustement de cercle sur un virage | Kåsa / moindres carrés | `markfit.proposeMark` | Mesuré inutilisable sur des virages larges |

**Key insight :** la valeur de cette phase est dans la *vérité* de ce que l'app affiche (voyant, son, écran, position des bouées), pas dans de nouvelles fonctions : chaque état affiché doit venir d'une observation réelle (horloge qui avance, sentinel non libéré, dernier point GPS reçu, réponse HTTP), jamais d'une intention.

## Runtime State Inventory

Phase d'ajout, pas de renommage : sans objet. Une seule donnée persistée **nouvelle**, à nommer sans collision : `rade.diag.v1`, `rade.marks.v1`, et (facultatif) `rade.timer.v1`, `rade.sound.v1`. Les clés existantes (`rade.state`, `rade.racelock`, `rade.events.v1`, `rade.wx.v1`, `rade.welcome`) ne changent pas [VERIFIED: grep `'rade.` dans `js/app.js` 43, 630, 632 ; `js/events.js` 5 `const KEY = 'rade.events.v1'` ; `js/weather.js` 20 `const KEY = 'rade.wx.v1'`]. Le stockage d'une app installée est séparé de celui de Safari (research/PITFALLS.md, niveau M) : **un recalage fait dans Safari n'existe pas dans l'app installée** (D-04 l'accepte).

## Common Pitfalls

### Pitfall 1 : le contexte audio suspendu retarde les bips déjà posés
**What goes wrong:** après un appel, un verrouillage ou un passage en arrière-plan, `currentTime` a pris du retard sur l'heure réelle ; les bips posés avant sonnent en retard du temps de la suspension.
**Why it happens:** l'horloge audio ne tourne pas pendant `suspended` / `interrupted` [CITED: developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state : sur iOS, changer d'onglet, réduire le navigateur ou éteindre l'écran donne `interrupted`].
**How to avoid:** ancrage rafraîchi à chaque tick, annulation (`stop(0)`) des bips décalés de plus de 30 ms, aucun rattrapage au-delà de 400 ms (un bip manqué est consigné, pas rejoué en retard). Test fourni (suspension de 3 s).
**Warning signs:** bips en retard après un retour d'application.

### Pitfall 2 : `resume()` ne se résout jamais, ou exige un geste
**What goes wrong:** `ctx.resume()` reste en attente quand le navigateur est suspendu en arrière-plan ; sans geste, Safari peut refuser.
**Why it happens:** WebKit 276016 renvoie à WebKit 281566 « AudioContext.resume() never resolves if browser is suspended to background » ; un contournement rapporté : `suspend()` après 250 ms puis `resume()` après 500 ms ; sur 17.6.1 le contexte repasse à `running` au retour de visibilité [CITED: bugs.webkit.org/show_bug.cgi?id=276016].
**How to avoid:** `Promise.race([ctx.resume(), délai de 1,5 s])` ; un seul écouteur `pointerdown` en phase de capture qui tente `resume()` quand le son n'est pas vivant (« touchez n'importe où pour réactiver ») ; lampe SON rouge tant que `state !== 'running'` ou horloge figée.

### Pitfall 3 : `running` ne prouve pas que le son sort
**What goes wrong:** l'état reste `running` pendant que `currentTime` est figé [CITED: WebKit 276016, reproduit sur iOS 17.5-17.6].
**How to avoid:** `audioAlive(prev, cur)` : sur au moins 1 s, `Δ currentTime > 0,5 × Δ horloge murale`, sinon mort.

### Pitfall 4 : le bouton silencieux coupe Web Audio
**What goes wrong:** bips muets alors que le chrono tourne.
**Why it happens:** type de session par défaut `ambient` ; `<audio>` et `<video>` ne sont pas concernés [CITED: bugs.webkit.org/show_bug.cgi?id=237322 : « By default the type is `ambient` and so audio will be muted if the phone is muted. »].
**How to avoid:** `navigator.audioSession.type = 'playback'` posé **dans le geste**, avant de créer ou reprendre le contexte, uniquement tant que le chrono est armé ou pendant le test (effet de bord : `playback` est « exclusif » et met en pause la musique d'une autre app [CITED: MDN AudioSession.type]). Efficacité sur l'app **installée** : **non documentée** [ASSUMED], à tester avec le bouton silencieux enclenché. Si le test échoue : dernier recours = boucle `<audio>` silencieuse.

### Pitfall 5 : un `GET` de sonde réseau est servi par le worker
**What goes wrong:** le voyant dit « réseau OK » en mode avion.
**Why it happens:** `sw.js` sert les fichiers de la liste hors réseau depuis le cache et se replie sur `index.html` pour les autres GET (`sw.js` ligne 25 : `if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;`).
**How to avoid:** `HEAD` (ou `/api/…`) : le worker ne répond pas, la requête part réellement. Mesuré hors réseau : `GET /icons/favicon-32.png → 200`, `HEAD /icons/favicon-32.png → TypeError`, `GET /api/_ping → TypeError` [VERIFIED: essai Chromium cette session ; Playwright `setOffline` ne coupe pas les requêtes émises par le worker lui-même, sans effet ici car le démarrage n'en émet pas].

### Pitfall 6 : le verrou d'écran peut échouer sans bruit
**What goes wrong:** l'écran se verrouille en pleine course, le GPS et le chrono s'arrêtent.
**Why it happens:** sur iOS < 18.4 en app installée, le verrou ne tient pas (WebKit 254545 : ouvert 2023-03-27, « now works in Home Screen Web Apps on iOS and iPadOS 18.4 », 2025-03-31) ; il est libéré à chaque masquage de page [CITED: MDN Screen Wake Lock API] ; refus possible en mode économie d'énergie [CITED: MDN] (lien avec le mode économie sous iOS : [ASSUMED]).
**How to avoid:** voyant fondé sur `sentinel.released`, redemande à chaque retour de visibilité **et sur geste**, journal de chaque libération, conseil « Réglages › Affichage et luminosité › Verrouillage automatique › Jamais » [ASSUMED : libellé iOS].

### Pitfall 7 : le chemin course avale ses erreurs
**What goes wrong:** aucune trace d'un échec d'écriture IndexedDB ou d'un refus de verrou.
**Where:** `js/track.js` ligne 38 `catch { this.lock = null; }`, ligne 48 `saveTrack(T).catch(() => {})` ; `js/startmode.js` ligne 99 `.catch(() => {})` sur `wakeLock.request` ; `js/app.js` ligne 722 `catch { /* audio indisponible */ }` ; ligne 765 : `gps.err = e.message` (le code d'erreur est perdu).
**How to avoid:** `report(où, erreur)` dans ces `catch` (FIAB-07) ; garder le comportement « échec silencieux pour l'utilisateur ».

### Pitfall 8 : ouverture rapide qui fige ensuite l'interface
**What goes wrong:** l'interface apparaît à 0,6 s mais ne répond plus pendant plusieurs secondes.
**Why it happens:** après le retrait du splash, `WindField.kit()` (relaxation de 420 itérations sur la grille du champ de vent, 163 × 133 cellules de 150 m [VERIFIED: exécution de `new WindField(T)`, `js/wind.js` lignes 16 `const CELL = 150; // m` et 76 `for (let it = 0; it < 420; it++) {`]) et `compute()` tournent d'un bloc : tâches longues de 2,5 à 6 s à CPU ×4 (mesuré).
**How to avoid:** `kit` en générateur (cédé toutes les ~30 itérations), échauffement par tranches de 10-16 ms ; mémoïser `computeField` quand la base est identique ; **ne pas lancer de calcul lourd pendant la séquence de départ** (de H−6 min à H+1 min).

### Pitfall 9 : élargir `passages()` casse la référence SNPM
`passages()` (`js/debrief.js` ligne 30, `if (d < 200)`) ne voit une bouée que dans les 200 m de sa position supposée ; pour GR1, la position a déjà été déplacée de ~640 m puis rétablie (commits 758307c et d33a785 : « GR1 remise à sa position d'origine (ce n'était pas une marque du parcours) »), l'incertitude est de plusieurs centaines de mètres. Mais élargir le rayon de `passages()` modifie `det.pass` et peut changer les valeurs figées de `tests/reference/coupe-snpm-2026-10-18.json` (D-12). **Faire une étape séparée** de recherche de virages pour les bouées `DOUBT`.

### Pitfall 10 : validation circulaire des marques 6 et 7
Voir Summary. Ne pas régler `R0` pour « coller » aux positions enregistrées ; l'exactitude est mesurée par simulation, la trace réelle ne sert qu'à vérifier la cohérence et l'absence de dérive.

### Pitfall 11 : un recalage dans les tests
Si `applyOverrides` mutait `MARKS` à l'import, les 44 tests existants liraient des positions locales. **Appeler `applyOverrides(MARKS, loadOverrides(localStorage))` une seule fois dans `init()` de `js/app.js`** (aucun module de calcul n'importe `app.js`) ; les tests passent une copie (`structuredClone`).

### Pitfall 12 : trop de virages candidats sur un bord de près
Sur la trace SNPM, la fenêtre entre les marques voisines de la marque 6 contient 16 virages ≥ 25° (bords de près) : le plus proche de la position supposée est le bon dans 6 à 8 cas sur 12 quand la position supposée est fausse de 150 à 500 m (12/12 pour la marque 7). D'où : afficher jusqu'à trois candidats, l'équipier choisit.

## Code Examples

Tous exécutés ici avec `node:test` (prototypes hors dépôt). Les valeurs des constantes ci-dessous sont celles qui ont été mesurées.

### Bips : jalons, ancrage, planification, santé (`js/beeper.js`)

```javascript
// Bips du chrono planifiés sur l'horloge audio : jalons calculés depuis timer.end (Date), posés à l'avance sur AudioContext.
export const LOOKAHEAD_S = 8;      // fenêtre planifiée à l'avance : un blocage du fil principal plus court ne fait manquer aucun bip
export const TICK_MS = 250;        // remplissage de la fenêtre (setInterval : sa précision n'a aucune importance)

// Jalons (instants Date en ms) d'un compte à rebours qui finit à endMs. kind : 'min' | 'dix' | 'sec' | 'go'
export function milestones(endMs, fromMs = -Infinity) {
  const out = [];
  for (let s = Math.floor((endMs - Math.max(fromMs, endMs - 3600e3)) / 1000); s >= 1; s--) {
    const kind = s % 60 === 0 ? 'min' : s <= 60 && s % 10 === 0 ? 'dix' : s <= 10 ? 'sec' : null;
    if (kind) out.push({ at: endMs - s * 1000, s, kind });
  }
  out.push({ at: endMs, s: 0, kind: 'go' });
  return out.filter((m) => m.at >= fromMs);
}
export const KEY = (m) => m.kind === 'min' || m.kind === 'go';   // jalons doublés d'un flash plein écran (≤ 1 par minute)
export const SOUND = { min: [660, 0.5], dix: [880, 0.12], sec: [880, 0.12], go: [990, 1.0] };   // Hz, secondes : valeurs de js/app.js 737 et 742
export const audioTime = (atMs, nowMs, ctxNow) => ctxNow + (atMs - nowMs) / 1000;
// WebKit 276016 : l'état peut rester « running » alors que l'horloge est arrêtée. true / false, ou null si moins d'1 s de recul
export function audioAlive(prev, cur) { const dw = (cur.wall - prev.wall) / 1000; return dw < 1 ? null : (cur.ct - prev.ct) > 0.5 * dw; }

export function createBeeper({ ctx, now = Date.now, play }) {
  let end = null, done = new Set(), live = [];
  const tone = play || ((f, d, when) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.4, when + 0.005); g.gain.exponentialRampToValueAtTime(0.001, when + d);
    o.start(when); o.stop(when + d + 0.02); return o;
  });
  function tick() {
    if (end == null || ctx.state !== 'running') return false;
    const t = now(), c = ctx.currentTime;
    live = live.filter((l) => {                                         // bips posés mais décalés (suspension, dérive) : annulés, reposés ci-dessous
      if (l.when <= c) return false;
      if (Math.abs(audioTime(l.m.at, t, c) - l.when) <= 0.03) return true;
      try { l.node?.stop(0); } catch { /* déjà arrêté */ } done.delete(l.m.at); return false;
    });
    for (const m of milestones(end, t - 400)) {                         // 400 ms de grâce : pas de bip rejoué en retard au-delà
      if (m.at > t + LOOKAHEAD_S * 1000) break;
      if (done.has(m.at)) continue; done.add(m.at);
      const when = audioTime(m.at, t, c), [f, d] = SOUND[m.kind];
      live.push({ m, node: tone(f, d, Math.max(when, c)), when });
    }
    return true;
  }
  return {
    arm(endMs) { this.disarm(); end = endMs; return tick(); },
    disarm() { for (const l of live) { try { l.node?.stop(0); } catch { /* déjà arrêté */ } } live = []; done = new Set(); end = null; },
    tick, get end() { return end; },
  };
}
```

Tests écrits et verts (7) : jalons 5-0 (`300,240,180,120,60,50…`, 9 bips « sec », dernier jalon `go`) ; un chrono de 3 min 20 ne rejoue pas 5 et 4 ; `audioTime(10500, 10000, 7) === 7.5` ; remplissage dans la fenêtre sans doublon ; **suspension de 3 s** (5 bips annulés puis reposés sur 53…59) ; contexte non `running` : rien de planifié ; `audioAlive`.

Le flash est piloté **séparément** (pas par `createBeeper`) : une boucle `requestAnimationFrame` armée tant que `timer.end` existe compare `Date.now()` aux jalons `KEY` de `milestones(timer.end)` ; un flash en retard de plus de 400 ms est marqué « retard ».

### Voyant : seuils et messages (`js/status.js`)

```javascript
export const GPS_STALE_S = 10, GPS_WARN_S = 4, GPS_ACC_WARN_M = 15, NET_STALE_MS = 10 * 60e3;
export function computeStatus({ now, needGps, needScreen, needSound, gps = {}, wake = {}, audio = {}, net = {} }) {
  const lamps = [];
  if (!needGps && !gps.on) lamps.push({ id: 'gps', level: 'off', text: 'GPS', detail: 'éteint' });
  else if (gps.err === 1) lamps.push({ id: 'gps', level: 'bad', text: 'GPS', detail: 'refusé : Réglages › Confidentialité › Service de localisation' });
  else if (gps.lastAt == null) lamps.push({ id: 'gps', level: needGps ? 'warn' : 'off', text: 'GPS', detail: 'recherche…' });
  else {
    const age = Math.round((now - gps.lastAt) / 1000);                // âge depuis la RÉCEPTION du dernier point
    const level = age > GPS_STALE_S ? 'bad' : age > GPS_WARN_S || gps.acc > GPS_ACC_WARN_M ? 'warn' : 'ok';
    lamps.push({ id: 'gps', level, text: 'GPS', detail: age > GPS_STALE_S ? `muet depuis ${age} s` : `±${Math.round(gps.acc ?? 0)} m · il y a ${age} s`, age });
  }
  if (!wake.supported) lamps.push({ id: 'screen', level: needScreen ? 'bad' : 'off', text: 'ÉCRAN', detail: 'non maintenu : réglez le verrouillage auto sur « Jamais »' });
  else if (wake.held) lamps.push({ id: 'screen', level: 'ok', text: 'ÉCRAN', detail: 'maintenu allumé' });
  else lamps.push({ id: 'screen', level: needScreen ? 'bad' : 'off', text: 'ÉCRAN', detail: wake.err ? `non maintenu (${wake.err})` : 'non maintenu : verrouillage auto « Jamais »' });
  if (!needSound && audio.state == null) lamps.push({ id: 'sound', level: 'off', text: 'SON', detail: 'pas armé' });
  else if (audio.state !== 'running' || audio.alive === false) lamps.push({ id: 'sound', level: 'bad', text: 'SON', detail: audio.state === 'interrupted' ? 'interrompu : touchez pour réactiver' : 'coupé : touchez pour réactiver' });
  else if (audio.tested === false) lamps.push({ id: 'sound', level: 'warn', text: 'SON', detail: 'non testé : « Tester le son »' });
  else lamps.push({ id: 'sound', level: 'ok', text: 'SON', detail: audio.tested === true ? 'testé' : 'actif' });
  if (net.online === false) lamps.push({ id: 'net', level: 'warn', text: 'RÉSEAU', detail: 'hors réseau (l’app continue)' });     // jamais rouge
  else if (net.lastOkAt == null) lamps.push({ id: 'net', level: 'off', text: 'RÉSEAU', detail: 'non vérifié' });
  else if (now - net.lastOkAt > NET_STALE_MS) lamps.push({ id: 'net', level: 'warn', text: 'RÉSEAU', detail: 'aucune réponse depuis ' + Math.round((now - net.lastOkAt) / 60e3) + ' min' });
  else lamps.push({ id: 'net', level: 'ok', text: 'RÉSEAU', detail: net.rtt ? `${Math.round(net.rtt)} ms` : 'ok' });
  return { lamps, worst: lamps.some((l) => l.level === 'bad') ? 'bad' : lamps.some((l) => l.level === 'warn') ? 'warn' : 'ok' };
}
```

5 tests verts : tout va bien ; GPS muet > 10 s rouge, 5 s orange, précision 20 m orange, message « muet depuis 12 s » ; écran non maintenu rouge en course, grisé hors course ; son interrompu rouge, non testé orange ; réseau absent orange jamais rouge.

Collecte : `gps.lastAt = Date.now()` dans le rappel de `watchPosition` (`js/app.js` ligne 752, **heure de réception**, pas `p.timestamp`) ; `gps.err = e.code` ajouté au rappel d'erreur (ligne 765) ; sonde :

```javascript
// Sonde réseau : HEAD sur un fichier public (middleware.js ligne 17 : `icons/` hors matcher), non traité par le worker. Toute réponse HTTP = joignable.
async function probeNet() {
  const c = new AbortController(), t0 = performance.now(), to = setTimeout(() => c.abort(), 4000);
  try { await fetch('icons/favicon-32.png?p=' + Date.now(), { method: 'HEAD', cache: 'no-store', signal: c.signal }); net.lastOkAt = Date.now(); net.rtt = performance.now() - t0; }
  catch { net.rtt = null; } finally { clearTimeout(to); }
}
```
Toutes les 30 s en course (page visible, `navigator.onLine !== false`), toutes les 5 min sinon. `navigator.onLine` n'est qu'un indice : « inherently unreliable », ne pas désactiver de fonction sur sa valeur [CITED: developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine].

### Verrou d'écran unique (`js/wakelock.js`)

```javascript
export function createWakeLock({ nav = globalThis.navigator, doc = globalThis.document, report = () => {}, now = Date.now } = {}) {
  const why = new Set(); let sentinel = null, err = null, lastLostAt = null, pending = false;
  const supported = () => !!nav?.wakeLock?.request, held = () => !!sentinel && !sentinel.released;
  async function acquire() {
    if (!supported() || !why.size || held() || pending || doc?.visibilityState === 'hidden') return held();
    pending = true;
    try {
      const s = await nav.wakeLock.request('screen'); sentinel = s; err = null;
      s.addEventListener('release', () => { if (sentinel === s) { lastLostAt = now(); report('wake', 'verrou libéré' + (why.size ? ' (encore demandé)' : '')); } });
    } catch (e) { err = e?.name || 'Error'; report('wake', 'demande refusée : ' + err); } finally { pending = false; }
    return held();
  }
  return {
    want(reason) { why.add(reason); return acquire(); },
    drop(reason) { why.delete(reason); if (!why.size && sentinel) { const s = sentinel; sentinel = null; s.release().catch(() => {}); } },
    retry: acquire,
    state: () => ({ supported: supported(), wanted: why.size > 0, held: held(), err, lastLostAt }),
  };
}
```
Raisons : `startmode` (ouvert), `recording` (trace), `timer` (chrono armé), `gps` (suivi actif). Remplace `js/startmode.js` ligne 99 (jamais redemandé) et `js/track.js` lignes 35-38 (redemandé mais erreur avalée). `retry()` est appelé : au retour de visibilité, sur geste (écouteur commun avec la reprise audio), toutes les 15 s tant que demandé et non tenu. `WakeLockSentinel.released` devient `true` après l'événement `release` [CITED: developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released]. 4 tests verts.

### Journal de diagnostic (`js/diag.js`)

```javascript
export const KEY = 'rade.diag.v1', MAX_ENTRIES = 300, MAX_MSG = 300, MAX_BYTES = 40000;
const clip = (s, n) => String(s ?? '').slice(0, n);
export const scrub = (s) => clip(s, MAX_MSG).replace(/([?&]acces=)[^&\s"']*/gi, '$1…').replace(/\b[A-Za-z0-9_-]{32,}\b/g, '…').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '…@…');
export function createDiag({ storage, now = Date.now } = {}) {
  let buf = []; try { buf = JSON.parse(storage?.getItem(KEY) || '[]'); if (!Array.isArray(buf)) buf = []; } catch { buf = []; }
  let dirty = false;
  const flush = () => { if (!dirty) return; dirty = false;
    try { let s = JSON.stringify(buf); while (s.length > MAX_BYTES && buf.length > 10) { buf.splice(0, Math.ceil(buf.length / 4)); s = JSON.stringify(buf); } storage.setItem(KEY, s); } catch { /* quota : le journal reste en mémoire */ } };
  function log(kind, where, msg, extra) {
    const e = { t: now(), k: clip(kind, 12), w: clip(where, 24), m: scrub(msg) }; if (extra != null) e.x = scrub(typeof extra === 'string' ? extra : JSON.stringify(extra));
    const last = buf[buf.length - 1];
    if (last && last.k === e.k && last.w === e.w && last.m === e.m) { last.n = (last.n || 1) + 1; last.t2 = e.t; }          // répétition : un compteur
    else { buf.push(e); while (buf.length > MAX_ENTRIES) { const i = buf.findIndex((x) => x.k === 'info'); buf.splice(i < 0 ? 0 : i, 1); } }   // plein : les « info » partent avant les erreurs
    dirty = true; if (kind === 'error') flush(); return e;
  }
  const text = (tz = 'Europe/Paris') => buf.map((e) => `${new Date(e.t).toLocaleString('fr-FR', { timeZone: tz, dateStyle: 'short', timeStyle: 'medium' })}${e.n > 1 ? ` (×${e.n})` : ''} [${e.k}] ${e.w} : ${e.m}${e.x ? ' — ' + e.x : ''}`).join('\n');
  return { log, flush, text, entries: () => buf.slice(), clear() { buf = []; dirty = true; flush(); } };
}
```
7 tests verts (plafond, persistance, info évincés avant les erreurs, compteur de répétition, secrets retirés, quota dépassé sans exception, stockage illisible, texte à l'heure de Paris).

`js/journal.js` : crée le singleton (`localStorage` gardé par `try`), installe `window.addEventListener('error', …)` et `'unhandledrejection'`, expose `report(où, err)` et `setContext(() => ({ depart: startMode.isOpen(), course: raceActive(now) }))` (chaque entrée porte `c: 'depart' | 'course' | 'app'` : critère « erreurs survenues en mode départ et en mode course »). **Premier import de `js/app.js`** (une erreur d'évaluation d'un module importé ensuite est rapportée à `window.onerror`). Y consigner aussi (niveau `info`) : `visibilitychange` masqué / visible, silence GPS commencé / terminé, verrou libéré / refusé, changements d'état audio, `online` / `offline`. **En-tête du journal copié** (aucun secret) : version `BUILD.label`, version d'iOS lue dans `navigator.userAgent`, installé (`navigator.standalone`), `'wakeLock' in navigator`, `'audioSession' in navigator`, `await navigator.storage?.persisted?.()` : c'est ce qui lève l'inconnue de D-05 (versions d'iOS).

### Saisie de coordonnées et recalages (`js/marks.js`)

```javascript
export const OV_KEY = 'rade.marks.v1';
export const DOUBT = (m) => m?.src === 'approx';                       // D-01
const NUM = '\\d+(?:[.,]\\d+)?';
const TOKEN = new RegExp(`([NSEWO])?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*(?:[°º]|\\s)\\s*(?:(${NUM})\\s*['’′]?\\s*)?(?:(${NUM})\\s*(?:"|”|″|'')?\\s*)?([NSEWO])?`, 'gi');
export function parseCoord(txt) {
  const out = [], s = String(txt ?? '').replace(/;/g, ' ').trim();
  if (!/[°º'’′"”″NSEWO]/i.test(s)) { for (const m of s.matchAll(/-?\d+(?:[.,]\d+)?/g)) out.push({ v: parseFloat(m[0].replace(',', '.')), hemi: '' }); return out; }   // décimal pur
  for (const m of s.matchAll(TOKEN)) {
    const [, h1, d, mn, sc, h2] = m, hemi = (h1 || h2 || '').toUpperCase(); if (d == null) continue;
    const deg = parseFloat(d.replace(',', '.')); if (!isFinite(deg)) continue;
    const min = mn ? parseFloat(mn.replace(',', '.')) : 0, sec = sc ? parseFloat(sc.replace(',', '.')) : 0; if (min >= 60 || sec >= 60) continue;
    let v = Math.abs(deg) + min / 60 + sec / 3600; if (deg < 0 || hemi === 'S' || hemi === 'W' || hemi === 'O') v = -v; out.push({ v, hemi });
  }
  return out;
}
// bornes = data/meta.json (west 5.8, east 6.1, south 43.0, north 43.18) avec une marge de 0,1°
export function parseLatLon(txt, bounds = { south: 42.9, north: 43.28, west: 5.7, east: 6.2 }) {
  const t = parseCoord(txt); if (t.length !== 2) return { error: 'Deux coordonnées attendues, par exemple 43°05.845N 005°56.049E' };
  let [a, b] = t; if (['E', 'W', 'O'].includes(a.hemi) || ['N', 'S'].includes(b.hemi)) [a, b] = [b, a];
  if (a.v < bounds.south || a.v > bounds.north || b.v < bounds.west || b.v > bounds.east) return { error: 'Position hors de la rade de Toulon : vérifiez les degrés et l’hémisphère' };
  return { lat: +a.v.toFixed(6), lon: +b.v.toFixed(6) };
}
export function loadOverrides(storage) { try { const o = JSON.parse(storage.getItem(OV_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
export function saveOverride(storage, k, ov) { const all = loadOverrides(storage); all[k] = ov; try { storage.setItem(OV_KEY, JSON.stringify(all)); return true; } catch { return false; } }
export function clearOverride(storage, k) { const all = loadOverrides(storage); delete all[k]; try { storage.setItem(OV_KEY, JSON.stringify(all)); return true; } catch { return false; } }
const dd = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });
export const srcLabel = (ov) => `${ov.src === 'trace' ? 'trace' : 'saisie'} du ${dd(ov.t)}`;                // D-03
export function applyOverrides(marks, overrides) {                       // SUR PLACE : tactics.js, debrief.js et app.js relisent MARKS à chaque appel ; appel unique au démarrage
  const applied = [];
  for (const [k, ov] of Object.entries(overrides || {})) {
    const m = marks[k]; if (!m || !isFinite(ov?.lat) || !isFinite(ov?.lon)) continue;
    m.base ??= { lat: m.lat, lon: m.lon, src: m.src };
    m.lat = ov.lat; m.lon = ov.lon; m.src = srcLabel(ov); m.ov = { src: ov.src, t: ov.t }; applied.push(k);
  }
  return applied;
}
```
Forme persistée : `{ [numéro]: { lat, lon, src: 'trace' | 'saisie', t: ms } }`. 6 tests verts, dont : la marque 1 saisie « 43°05.845N 005°56.049E » redonne exactement `43.097417, 5.93415` (valeur de `MARKS[1]`) ; formats `43°05,845' N, 5°56,049' E`, `N 43°05.845 E 005°56.049`, `5°56.049E 43°05.845N`, `43,0974 ; 5,9342`, `43°05'50.7"N 5°56'02.9"E` ; refus hors rade, une seule valeur, minutes ≥ 60 ; recalage appliqué sur une **copie**. Plafond de sécurité conseillé à la validation : refuser un déplacement de plus de 2 Nq sans confirmation.

### Position d'une bouée d'après un arrondi (`js/markfit.js`)

```javascript
// P : points lissés { t (ms), x, y (m), hd (cap lissé ~8 s) } = analyzeTrack(...).P
export const R0 = 14, MIN_TURN_DEG = 25, IN_WIN = [45000, 75000], MAX_FROM_M0 = 300;
const rad = Math.PI / 180, n360 = (a) => ((a % 360) + 360) % 360, n180 = (a) => n360(a + 180) - 180;
const circMean = (A) => { let s = 0, c = 0; for (const a of A) { s += Math.sin(a * rad); c += Math.cos(a * rad); } return n360(Math.atan2(s, c) / rad); };
export function closestApproach(P, M0, tp, win = 120000) { let b = null; for (const p of P) { if (Math.abs(p.t - tp) > win) continue; const d = Math.hypot(p.x - M0.x, p.y - M0.y); if (!b || d < b.d) b = { d, p }; } return b && { x: b.p.x, y: b.p.y, d: b.d, t: b.p.t }; }
// instant qui sépare au mieux le cap d'entrée (−75…−45 s) du cap de sortie (+45…+75 s) : somme des carrés des écarts avant / après
export function turnApex(P, tp) {
  const sel = (a, b) => P.filter((p) => p.t >= tp + a && p.t <= tp + b);
  const A = sel(-IN_WIN[1], -IN_WIN[0]).map((p) => p.hd), B = sel(IN_WIN[0], IN_WIN[1]).map((p) => p.hd);
  if (A.length < 5 || B.length < 5) return null;
  const h1 = circMean(A), h2 = circMean(B), D = n180(h2 - h1), W = sel(-IN_WIN[1], IN_WIN[1]);
  let pre = 0, post = W.reduce((s, p) => s + n180(p.hd - h2) ** 2, 0), best = { c: Infinity, i: 0 };
  for (let i = 0; i < W.length; i++) { if (pre + post < best.c) best = { c: pre + post, i }; pre += n180(W[i].hd - h1) ** 2; post -= n180(W[i].hd - h2) ** 2; }
  return { p: W[best.i], h1, h2, D };
}
export function proposeMark(P, M0, side, tp, r0 = R0) {                 // side : 't' (bouée laissée à tribord) | 'b' (bâbord)
  const near = closestApproach(P, M0, tp); if (!near) return null;
  let tq = tp, a = null; for (let i = 0; i < 3; i++) { a = turnApex(P, tq); if (!a) break; tq = a.p.t; }   // 3 passes : se recentre sur le virage
  if (!a || (side !== 't' && side !== 'b') || Math.abs(a.D) < MIN_TURN_DEG || Math.hypot(a.p.x - M0.x, a.p.y - M0.y) > MAX_FROM_M0)
    return { method: 'plus-pres', x: near.x, y: near.y, near, turn: a ? { D: a.D } : null };                // pas de virage net : D-02 littéral, sans correction
  const h = (a.h1 + a.D / 2 + (side === 't' ? 90 : -90)) * rad;                                                // vers l'intérieur du virage
  return { method: 'sommet', x: a.p.x + r0 * Math.sin(h), y: a.p.y + r0 * Math.cos(h), near, turn: { D: a.D, h1: a.h1, h2: a.h2, t: a.p.t } };
}
```
3 tests verts (SNPM : marques 7 et 6 proposées à moins de 40 m de la position enregistrée, méthode `sommet` ; sans virage net : repli `plus-pres`).

### Mesures reproductibles (Playwright global, hors dépôt)

```javascript
// ouverture hors réseau à CPU ×4 : serveur local arrêté pour de bon après une première visite en ligne (setOffline ne coupe pas le worker)
const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto(URL, { waitUntil: 'commit' });
await page.waitForFunction(() => document.getElementById('splash').classList.contains('gone'));   // + performance.getEntriesByType('mark')
```
et, pour l'horloge audio, un `AudioWorklet` qui poste `currentTime` au début de chaque bip, le fil principal gelé par `while (performance.now() - t < 1300);`.

## State of the Art

| Ancienne approche | Approche actuelle | Depuis | Impact |
|-------------------|-------------------|--------|--------|
| Bips depuis `setInterval` + oscillateur immédiat | Bips posés à l'avance sur `AudioContext.currentTime`, recalés sur `Date` | ce plan | Retard de 1,0-1,3 s → ±7 ms avec le fil principal gelé (Chromium) |
| Web Audio coupé par le bouton silencieux | `navigator.audioSession.type = 'playback'` | iOS 17 | Efficacité sur app installée à confirmer |
| Wake Lock inopérant en app installée | Fonctionne en app installée | iOS 18.4 (2025-03-31) | Versions d'iOS de l'équipage à relever (journal) |
| Chargement de tout avant le splash | Interface utile d'abord, 3D et champ de vent ensuite | ce plan | 4,3-8,1 s → 0,5-0,7 s (CPU ×4) |

**Deprecated/outdated :** `navigator.vibrate` n'existe pas sur iPhone ; l'appel `navigator.vibrate?.(d * 1000)` de `js/app.js` ligne 727 est un no-op silencieux (le retirer ou le laisser, sans compter dessus).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | L'app installée (écran d'accueil) suit le bouton silencieux et `audioSession` comme Safari | Pitfall 4 | Bips muets en course : recette obligatoire avec bouton silencieux |
| A2 | Aucune API documentée ne lit le bouton silencieux ni le volume | Don't Hand-Roll | Une détection automatique serait possible : à ne chercher que si le test d'écoute déçoit |
| A3 | Écran verrouillé, l'AudioContext est interrompu et aucun bip ne sonne | Summary | Si la session `playback` maintient le son, comportement plus favorable (rien à corriger) |
| A4 | Avant iOS 18.4, en app installée, `request()` réussit sans tenir ou est refusé (comportement exact inconnu) | Pitfall 6 | Voyant trompeur ; atténué par le journal des mises en veille |
| A5 | Le mode économie d'énergie d'iOS peut refuser ou libérer le verrou d'écran | Pitfall 6 | Conseil superflu ou manquant |
| A6 | Libellé iOS « Réglages › Affichage et luminosité › Verrouillage automatique › Jamais » | Pitfall 6, voyant | Texte d'aide inexact (corriger sur iPhone) |
| A7 | L'iPhone de l'équipage est au moins aussi rapide que ce bac à sable : CPU ×4 est une borne prudente | Summary FIAB-06 | Mesures à refaire sur appareil (recette) |
| A8 | Distance d'arrondi typique de 4 à 24 m (coque du J80 = 8 m [VERIFIED: js/startmode.js 9 `const J80 = 8; // longueur de coque (m)`], zone de 3 longueurs de coque de la règle 18) | Recalage | Le décalage R0 = 14 m serait à ajuster si les arrondis réels sont plus larges |
| A9 | Un `HEAD` sur un fichier statique de Vercel répond (200) | Sonde réseau | Utiliser `GET /api/_ping` (toute réponse HTTP, y compris 401 ou 404, prouve la joignabilité) |
| A10 | La latence Bluetooth décale le son par rapport au flash ; `AudioContext.outputLatency` absente de Safari | FIAB-04 | Écart perceptible avec des écouteurs sans fil : à noter dans l'aide |
| A11 | Une série GPS de l'iPhone arrive à environ 1 Hz (âge normal ≤ 2 s) | Voyant | Seuils 4 s / 10 s à ajuster après la recette |

## Open Questions (RESOLVED)

1. **Flash plein écran : toujours ou seulement si le son est coupé ?**
   - RESOLVED : **toujours** sur les bips clés (réglage « Flash visuel » activé par défaut), car la détection du muet est imparfaite et c'est la demande de Romain (« doublés d'un signal visuel »). Clés = minutes (5-4-3-2-1) et signal de départ (`KEY`). Pas de flash plein écran pour les 10 dernières secondes (pulsation du chrono seulement).
2. **Couleur et rythme du flash ?**
   - RESOLVED : 450 ms de fondu, blanc 70 % pour les minutes, vert 80 % pour le signal, **jamais de rouge saturé** (seuil de flash rouge de WCAG 2.3.1) ; 1 flash par minute au plus [CITED: w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html].
3. **Le réseau peut-il être « en alerte » ?**
   - RESOLVED : **orange au plus**, jamais rouge : l'app fonctionne hors réseau. GPS, écran et son peuvent être rouges.
4. **Alerte sonore quand une lampe passe au rouge ?**
   - RESOLVED : **visuelle seulement** en v1 (lampe rouge pulsée à 1 Hz + bandeau d'une ligne avec l'action). Un son pourrait être confondu avec un signal de départ ; à reconsidérer après la recette.
5. **Repli vidéo muette (NoSleep) pour iOS < 18.4 ?**
   - RESOLVED : **non** (D-05 : détecter, alerter, conseiller). À revoir seulement si la recette montre un iPhone < 18.4 en app installée sans verrou.
6. **Faut-il laisser `audioSession.type = 'playback'` en permanence ?**
   - RESOLVED : **non** : le poser (dans un geste) quand le chrono est armé ou pendant le test, le remettre à `'auto'` à l'arrêt, et le dire dans l'aide (musique d'une autre app mise en pause).
7. **Le recalage propose-t-il le « plus près » (D-02) ou le sommet du virage ?**
   - RESOLVED : D-02 est respecté (la proposition vient de la trace, l'équipier valide) ; la position proposée est le **sommet du virage + 14 m vers l'intérieur** ; le point au plus près est affiché à côté (« passage à 33 m ») et sert de repli quand il n'y a pas de virage net. Erreurs en section *Mark estimation results*.
8. **Où chercher le passage d'une bouée douteuse ?**
   - RESOLVED : étape séparée de recherche de virages ≥ 25° entre les marques voisines, ≤ 600 m de la position supposée, trois candidats au plus ; `passages()` de `js/debrief.js` et la référence SNPM restent intacts.
9. **Où appliquer les recalages sans toucher aux tests ?**
   - RESOLVED : `applyOverrides(MARKS, loadOverrides(localStorage))` une seule fois dans `init()` de `app.js`, mutation sur place, puis `drawCourse()` et `scheduleAnalysis()` après chaque recalage. Les tests passent une copie.
10. **Où lire le journal ?**
    - RESOLVED : bouton « Journal de diagnostic (N) » sous la ligne de version dans `openGuide()` (`js/help.js` ligne 100), joignable depuis le mode départ par « Aide » ; texte dans un `<pre>` rempli par `textContent` ; « Copier » (Clipboard, repli `execCommand`), « Partager » (`navigator.share`), « Vider ».
11. **Mesurer l'ouverture : dans `npm test` ?**
    - RESOLVED : **non** (Playwright n'est pas une dépendance) ; scripts facultatifs `tools/measure-boot.mjs` et `tools/audio-clock-check.mjs` ; `performance.mark('rt:ui')` posé dans `app.js` (inoffensif en production) pour lire le chiffre aussi dans l'inspecteur Safari ; garde statique en test : `renderStart()` appelé avant `Terrain.load`.
12. **Reprise du chrono après un relancement d'iOS ?**
    - RESOLVED : **facultatif**, hors des sept besoins. Si le plan a de la marge : persister `timer.end` dans `rade.timer.v1` (3 lignes, dans l'accesseur) et le restaurer au démarrage avec « Chrono repris ». Sinon le noter en idée différée.
13. **Comment lever l'inconnue des versions d'iOS (D-05) ?**
    - RESOLVED : l'en-tête du journal copié donne la version d'iOS, installé ou non, présence de `wakeLock` et `audioSession` ; chaque équipier envoie son journal après la première sortie.
14. **Cadence du voyant ?**
    - RESOLVED : 1 s tant qu'il est visible (mode départ ouvert, ou bande « en course »), plus sur événements ; hors course, la bande n'est pas affichée (pas de bruit).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm test`, scripts | ✓ | 22.22.0 (le dépôt demande 24.x ; la suite passe : 44 tests, ≈ 4,7 s) | — |
| Playwright + Chromium | Mesures d'ouverture et d'horloge audio | ✓ (global) | 1.56.1, Chromium 1194 (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) | Aucun besoin dans `npm test` |
| Python 3 (`http.server`) | Servir le dépôt pour la mesure | ✓ | 3.13 | `npx http-server` |
| iPhone de l'équipage | Recette (son, verrou, GPS, ouverture) | ✗ | — | **Aucun** : liste de recette humaine en fin de phase |
| Accès Overpass / SHOM (vérité de terrain des bouées) | Validation non circulaire des marques 6 et 7 | ✗ (connexion refusée par le proxy) | — | Simulation + recette sur la prochaine trace |

**Missing dependencies with no fallback:** iPhone (toute la partie iOS reste à confirmer sur appareil).
**Missing dependencies with fallback:** vérité de terrain des bouées (simulation).

## Validation Architecture

> `workflow.nyquist_validation` est `false` dans `.planning/config.json` ; la section est incluse parce que le demandeur l'exige explicitement.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `linkedom` 0.18.13 |
| Config file | aucun ; `package.json` script `test` : `node --test --import ./tests/helpers/setup.mjs "tests/**/*.test.mjs"` |
| Quick run command | `node --test --import ./tests/helpers/setup.mjs tests/<fichier>.test.mjs` |
| Full suite command | `npm run check` (vérifie `sw.js` / `js/version.js` à jour, puis `npm test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIAB-03 | Jalons 5-0, fenêtre, recalage après suspension, pas de bip tardif, contexte non `running` | unit | `node --test --import ./tests/helpers/setup.mjs tests/beeper.test.mjs` | ❌ Wave 0 |
| FIAB-03 | `timer.end` n'est plus lu pour sonner dans `tickTimer` (plus de `timer.beeps`) | garde statique | `node --test --import ./tests/helpers/setup.mjs tests/beeper.test.mjs` (lecture de `js/app.js`) | ❌ Wave 0 |
| FIAB-03 | Bips à la seconde, fil principal gelé | navigateur (Chromium) | `node tools/audio-clock-check.mjs` | ❌ facultatif |
| FIAB-04 | Santé audio (`audioAlive`), flash : jalons `KEY` ≤ 1 par minute | unit | `tests/beeper.test.mjs` | ❌ Wave 0 |
| FIAB-04 | Test du son, muet à l'iPhone, flash lisible | humain (iPhone) | liste de recette | — |
| FIAB-05 | Seuils du voyant (GPS 4 s / 10 s, écran, son, réseau jamais rouge) | unit | `tests/status.test.mjs` | ❌ Wave 0 |
| FIAB-05 | Verrou unique, libération, refus, API absente | unit | `tests/wakelock.test.mjs` | ❌ Wave 0 |
| FIAB-05 | La sonde `HEAD` n'est pas traitée par le worker | unit (`node:vm`, harnais de `tests/sw.test.mjs`) | `tests/sw.test.mjs` | ✅ à compléter |
| FIAB-06 | Interface utile avant le terrain (ordre d'appel) | garde statique | `node --test … tests/boot.test.mjs` | ❌ Wave 0 |
| FIAB-06 | < 2 s hors réseau à CPU ×4 | navigateur (Chromium) | `node tools/measure-boot.mjs 4 5 offline nogl` | ❌ facultatif |
| FIAB-06 | < 2 s sur iPhone en mode avion | humain (iPhone) | liste de recette | — |
| FIAB-07 | Tampon borné, évincement, secrets retirés, quota, stockage illisible, heure de Paris | unit | `tests/diag.test.mjs` | ❌ Wave 0 |
| FIAB-07 | `journal.js` est le premier import de `app.js` ; plus de `catch` vide dans `track.js` (verrou, écriture) et `startmode.js` (verrou) | garde statique | `tests/diag.test.mjs` | ❌ Wave 0 |
| JUST-01 | `DOUBT` vrai pour 3 et 11 seulement ; flag absent après recalage | unit | `tests/marks.test.mjs` | ❌ Wave 0 |
| JUST-02 | Saisie (formats, hors rade), recalage appliqué sur copie, `MARKS` réel intact | unit | `tests/marks.test.mjs` | ❌ Wave 0 |
| JUST-02 | Proposition sur la trace SNPM (< 40 m des marques 6 et 7), repli sans virage, simulation p90 < 25 m | unit + fixture | `tests/markfit.test.mjs` | ❌ Wave 0 |
| (non-régression) | Référence SNPM inchangée | unit | `npm test` (`tests/reference.test.mjs`) | ✅ |

### Sampling Rate
- **Par tâche :** le fichier de test du module touché (secondes).
- **Par vague :** `npm run check`.
- **Porte de phase :** `npm run check` vert + `node tools/stamp.mjs --check` sans avertissement + recette iPhone avant `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/beeper.test.mjs`, `tests/status.test.mjs`, `tests/wakelock.test.mjs`, `tests/diag.test.mjs`, `tests/marks.test.mjs`, `tests/markfit.test.mjs` : à créer depuis les prototypes ci-dessus
- [ ] `tests/boot.test.mjs` : garde statique d'ordre d'initialisation (facultatif mais peu coûteux)
- [ ] Compléter `tests/sw.test.mjs` : un `HEAD` et une requête `/api/` ne déclenchent pas `respondWith`
- [ ] Aucune installation : cadre déjà en place

### Recette humaine (iPhone, fin de phase)
1. Version d'iOS et mode (Safari / installée) relevés dans l'en-tête du journal pour les trois iPhone.
2. Bips avec bouton silencieux enclenché, **Safari puis app installée** ; « Tester le son » dans les deux réponses ; musique d'une autre app avant le chrono.
3. Chrono armé puis verrouillage de l'écran 30 s, appel entrant, Siri : lampe SON, reprise au retour, bips manqués consignés ; écouteurs Bluetooth.
4. Verrou d'écran : tenu 30 min ; retour d'arrière-plan ; mode économie d'énergie activé puis coupé ; verrouillage auto à 30 s pour voir l'alerte.
5. GPS : écran verrouillé puis rouvert, âge et alerte à 10 s, relance.
6. Ouverture < 2 s : app fermée (tuée) puis ouverte en mode avion, chronomètre ou enregistrement d'écran ; puis réseau très faible.
7. Flash en plein soleil et à l'ombre.
8. Journal : provoquer une erreur ; ouvrir, copier, partager.
9. Bouées : importer la trace SNPM, vérifier la proposition ; saisie « 43°05.845N 005°56.049E » ; source et date affichées ; persistance après relance ; l'app installée n'a pas les recalages de Safari (attendu, D-04).

## Security Domain

`security_enforcement` est actif (absent ou `true`), ASVS niveau 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | accès par code existant (`middleware.js`), inchangé |
| V3 Session Management | non | idem |
| V4 Access Control | non | aucune route nouvelle ; la sonde cible un fichier public déjà exclu du matcher (`middleware.js` ligne 17) |
| V5 Input Validation | oui | `parseLatLon` (bornes de la rade, minutes < 60), `JSON.parse` de `localStorage` sous `try`, plafond de déplacement de 2 Nq, `esc()` / `textContent` pour la source d'une bouée et le journal |
| V6 Cryptography | non | — |
| V7 Error Handling and Logging | oui | `scrub()` : `?acces=…`, jetons de 32 caractères et plus, adresses e-mail ; aucune position, aucun cookie |
| V8 Data Protection | oui | journal et recalages restent sur l'appareil ; l'envoi (copier, partager) est un geste de l'équipier |

### Known Threat Patterns for ce périmètre

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Code d'accès dans un message d'erreur ou une URL du journal copié | Information disclosure | `scrub()` à l'écriture, test « rien de secret » ; ne jamais journaliser `location.href` ni `document.cookie` |
| XSS par le nom ou la source d'une bouée, ou par une ligne du journal | Tampering | `textContent` pour le journal ; `esc()` pour le tableau des marques (`js/app.js` ligne 1070) |
| Recalage aberrant (saisie ou `localStorage` modifié) | Tampering | bornes de la rade, plafond de déplacement, source et date toujours affichées, « position d'origine » rétablissable (`m.base`) |
| Sonde réseau détournée vers un tiers | Spoofing | URL relative de même origine, aucune donnée envoyée, délai de 4 s |
| Journal qui grossit sans fin | Denial of service | 300 entrées, 40 000 octets, répétitions comptées, `info` évincés avant les erreurs |

## Mark estimation results (question 7)

**Données.** `tests/fixtures/coupe-snpm-2026-10-18.gpx` (9538 points, Open GPX Tracker) ; passages détectés par `detect()` : marque 7 à 10:11:51Z (33 m), marque 6 à 10:55:20Z (30 m), marque 5 à 11:42:56Z (2 m, arrivée) [VERIFIED: exécution cette session ; cohérent avec `tests/reference/coupe-snpm-2026-10-18.json` `"passages": [["7","10:11:51Z",33],["6","10:55:20Z",30],["5","11:42:56Z",2]]`]. Positions enregistrées : `js/courses.js` ligne 28 (marque 6) et ligne 30 (marque 7) : `src: 'relevé GPS du 18/10/2026 (±50 m)'`. **Elles viennent de cette même trace** (commits 758307c puis d33a785, méthode non consignée) : cohérence, pas vérité.

**Sur la trace réelle** (distance à la position enregistrée) :

| Méthode | Marque 7 | Marque 6 |
|---------|----------|----------|
| E1 point de la trace au plus près (D-02 littéral) | 33 m | 30 m |
| E2 sommet du virage, sans décalage | 39 m | 43 m |
| E2 sommet + 10 m vers l'intérieur | 30 m | 34 m |
| **E2 sommet + 14 m (retenu)** | **26 m** | **31 m** |
| E2 sommet + 20 m | 21 m | 26 m |
| E3 ajustement de cercle sur l'arc | 126 m (rayon 160 m) | 71 m (rayon 102 m) : rejeté |

Les virages réels sont larges (59° et 63-72° en 40 à 60 s, vitesse tombant de 5,9 à 3 nd à la marque 6) : un cercle n'a pas de sens.

**Robustesse à une position supposée fausse** (marque déplacée de 50 / 100 / 150 m dans 8 directions) : marque 7 : E2 identique à 0 m près dans les 24 cas, alors que E1 s'éloigne de 36 à 161 m ; marque 6 : E2 identique jusqu'à 50 m, puis au-delà de 100 m une direction sur huit retient un autre virage (de 31 à 143 m).

**Simulation** (1000 tirages par scénario ; virage de 40 à 130°, 15 à 45 s, 3 à 6 nd, pas de 1 Hz avec 8 % de trous, bruit GPS gaussien ; la bouée est placée à `r` m à l'intérieur du virage au sommet, avec un décalage le long de la route de σ = 8 m ; E2 = sommet + 14 m ; erreur en mètres, médiane / 90 % / maximum) :

| Scénario | E1 plus près | E2 retenu |
|----------|--------------|-----------|
| r 4-24 m, bruit 4 m, position supposée exacte | 7 / 15 / 22 | **10 / 19 / 32** |
| idem, position supposée fausse de 50 m | 40 / 54 / 68 | **10 / 18 / 36** |
| idem, fausse de 150 m | 103 / 150 / 171 | **10 / 20 / 162** (4,5 % de replis sur « plus près ») |
| bruit 8 m, un point toutes les 3 s | 9 / 16 / 25 | 15 / 29 / 106 |
| arrondi large, r 15-40 m | 16 / 27 / 36 | 19 / 30 / 59 |
| arrondi serré, r 2-10 m | 3 / 7 / 10 | 11 / 18 / 28 |

E1 n'est bon que si la position supposée est déjà juste (le cas que l'on cherche à corriger). **Précision honnête à afficher : ±20 m, ±30 m si l'arrondi est large ; jamais mieux que la distance d'arrondi réelle, inconnue** (hypothèse A8).

**Choix du virage** sur la trace SNPM (candidats ≥ 25° entre les marques voisines, le plus proche de la position supposée décalée de 150 / 300 / 500 m) : marque 7 : 12/12 aux trois distances ; marque 6 : 8/12, 7/12, 6/12 (16 virages candidats à cause des bords de près). Conséquence : trois candidats proposés, l'équipier choisit.

Réserve : les erreurs simulées reposent sur l'hypothèse A8 ; elles valident la géométrie et la tenue au bruit, pas le comportement réel des skippers. La **recette** de fin de phase (importer une vraie trace où GR1 est contournée, vérifier la proposition sur la carte) est la vraie validation.

## Boot measurement (question 5)

**Méthode.** Copie du dépôt dans le bac à sable (jamais le dépôt lui-même) avec `performance.mark` ajoutés dans `init()` ; serveur `python3 -m http.server` ; Chromium de `/opt/pw-browsers/chromium-1194` en émulation mobile 390×844 ; première visite en ligne (le worker précache 47 fichiers, `rade-0008258dea`) ; puis ouvertures successives **hors réseau**, avec `Emulation.setCPUThrottlingRate` ; le rendu WebGL logiciel (SwiftShader) est neutralisé (`renderer.render` sans effet dans la copie) car il fausse tout (splash à 5,4-6,0 s et analyse à 17-19 s à CPU ×1 uniquement à cause de lui). Trois façons de couper le réseau ont été essayées : `setOffline` (Playwright), serveur arrêté pour de bon, et requêtes externes laissées sans réponse (réseau très faible) : mêmes ordres de grandeur.

**Résultats** (hors réseau, 4 cœurs partagés, forte variance d'une exécution à l'autre) :

| Mesure | CPU ×1 | CPU ×4 |
|--------|--------|--------|
| Premier affichage (splash) | 0,09-0,12 s | 0,12-0,48 s |
| `DOMContentLoaded` (graphe de modules, three.js compris) | 0,21-0,22 s | 0,65-0,79 s |
| Terrain chargé | 0,24-0,26 s | 0,87-1,04 s |
| `Scene3D` construite | 0,46-0,51 s | 1,58-1,96 s |
| **Splash retiré = interface utile (code actuel)** | **1,9 à 3,9 s** | **4,3 à 8,1 s** (12 ouvertures) |
| Analyse du parcours terminée | 4,1-6,7 s | 10,7-22,6 s |
| **Prototype « interface utile d'abord »** | — | **0,48-0,73 s** (5 ouvertures, serveur arrêté) ; 0,76-0,81 s sans le chargement différé de `scene3d.js` |

Variance : les ouvertures avec le serveur réellement arrêté (7,3-8,1 s) sont plus lentes que celles avec `setOffline` (4,3-4,5 s) sans que la cause soit établie (bruit du bac à sable ?) ; les deux tiennent la même conclusion. Le critère de 2 s **n'est pas tenu aujourd'hui**, ni à CPU ×1 sur ce bac à sable. L'app est bien servie par le worker (`controller` actif, aucune requête réseau nécessaire au démarrage) ; le réseau faible n'y change rien (les prévisions ne bloquent pas : `refreshWeather()` n'est pas attendu).

**Où le temps part** (profil CPU ×1, 4,4 s échantillonnés) : `WindField.kit` 1316 ms (`js/wind.js` ligne 60), `compute` 378 ms (ligne 126), `route` 353 ms, `boatSpeed`/`interp` 282 ms, utilitaires de géométrie ≈ 700 ms ; `js/wind.js` = 1774 ms. Hors navigateur : une direction de `kit` ≈ 220 ms, un `compute` ≈ 257 ms. Au démarrage, `updateDisplayField()` et `runAnalysis()` calculent **deux fois la même base** (`DEF` : `hour: 11` et `startTime: 11`, `js/app.js` lignes 39-40).

**Changements minimaux (ordre de gain) :**
1. **Interface utile d'abord** : dans `init()`, avant `Terrain.load`, appeler `renderStart()` et `renderLive()`, lier les onglets (séparer `bindUI()` : onglets tôt, boutons de carte après `Scene3D`), retirer le splash, puis céder une frame. Garde-fous : `scene?.`, `F` et `T` nuls dans le rappel GPS (`js/app.js` ligne 760 `scene.setBoat`), dans `windAt` du mode départ (ligne 671-675 `F.sample`) et dans `onPick`.
2. **`import('./scene3d.js')` différé** (three.module.min.js 691 Ko) : 0,80 → 0,56 s (médiane) ; `vendor/qrcode.js` en `defer` (ligne 94 de `index.html`).
3. **Mémoïser `computeField`** sur une clé complète (jour, heure, source, vent manuel, modèle, résidus, `localFx`) : supprime un calcul de ≈ 250 ms à CPU ×1.
4. **`kit` en générateur** (cédé toutes les ~30 itérations) et échauffement par tranches d'inactivité : sinon l'interface répond avec 2,5 à 6 s de retard à CPU ×4 après son apparition (tâches longues mesurées). Suspendre les calculs lourds de H−6 min à H+1 min (prédicat pur dans `js/racelock.js`).
5. **Délai de 8-10 s sur les `fetch` météo** (`js/weather.js` ligne 27 : `await fetch(url, { cache: 'no-store' })`, sans délai) pour que « Chargement… » et la roue ne tournent pas indéfiniment avec un réseau très faible.

**Mesure à garder :** `performance.mark('rt:ui')` au retrait du splash (inoffensif en production).

## Release mechanics (question 9)

- Après tout changement de l'app : `npm run stamp` (régénère le bloc de `sw.js` et `js/version.js`) ; les nouveaux fichiers de `js/` entrent seuls dans la liste hors réseau (`tools/stamp.mjs`, `DIRS = ['js', 'data', 'vendor', 'icons']`).
- Publier : `npm run release -- "bips plus sûrs"` (v27, note de 80 caractères au plus, sans `<` ni `>`) ; `--critical` colore le bandeau mais n'est **jamais** appliqué en course (phase 1, D-06).
- `npm run check` (= `stamp --check` puis `npm test`) doit rester vert ; sur Vercel `npm ci && npm run gate` refuse une version fautive ; `RT_GATE_BYPASS=1` seulement en urgence, pour un seul redéploiement.
- Calendrier (aujourd'hui lundi 19 octobre 2026) : **gel visé lundi 2 novembre** ; régate CVAT **samedi 7 au lundi 9 novembre** ; règle des 48 h : **plus de mise en production après jeudi 5 novembre au matin**, sauf correctif critique hors course. Les trois iPhone doivent appliquer la mise à jour **hors course** (bandeau) avant la recette : publier la v27 au plus tard vers le **30 octobre**.
- Ne rien écrire des codes d'accès ni des empreintes dans la note de version, le journal ou les tests.

## Sources

### Primary (HIGH confidence)
- `/home/user/rade-tactique/js/*.js`, `sw.js`, `index.html`, `middleware.js` (matcher seulement), `data/meta.json`, `tests/` : lus cette session ; trace `tests/fixtures/coupe-snpm-2026-10-18.gpx` ; mesures Chromium 1194 / Node 22.22 exécutées cette session.

### Secondary (MEDIUM confidence)
- [WebKit 237322 : Web Audio muted by iOS ringer switch](https://bugs.webkit.org/show_bug.cgi?id=237322) : type `ambient` par défaut, `audioSession.type = "playback"` depuis iOS 17 (commentaire du 2024-09-25), contournement par `<audio>` silencieux.
- [WebKit 254545 : Wake Lock ne fonctionne pas en app Écran d'accueil](https://bugs.webkit.org/show_bug.cgi?id=254545) : RESOLVED FIXED ; corrigé avec iOS / iPadOS 18.4 (2025-03-31).
- [WebKit 276016 : Web Audio s'arrête après perte de focus (iOS 17.5.1)](https://bugs.webkit.org/show_bug.cgi?id=276016) : état `interrupted`, contournements, lien vers 281566.
- [MDN BaseAudioContext.state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state) : `interrupted`, comportement d'iOS Safari.
- [MDN AudioSession.type](https://developer.mozilla.org/docs/Web/API/AudioSession/type) : valeurs, `playback` exclusif, « Limited availability », expérimental.
- [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) et [WakeLockSentinel.released](https://developer.mozilla.org/en-US/docs/Web/API/WakeLockSentinel/released).
- [MDN Navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) : « inherently unreliable ».
- [web.dev : A Tale of Two Clocks](https://web.dev/articles/audio-scheduling) et [MDN Advanced techniques](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques) : planification en avance.
- [WCAG 2.1 SC 2.3.1](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html).

### Tertiary (LOW confidence, à valider sur appareil)
- Toute affirmation sur l'app **installée** (bouton silencieux, `audioSession`, comportement du verrou avant 18.4, mode économie d'énergie) ; libellés des réglages iOS ; latence Bluetooth.

Les outils MCP de documentation (Context7, Exa, etc.) n'étaient pas disponibles : sources web via la recherche et la récupération de pages, puis exécution locale pour tout ce qui pouvait l'être.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH, aucune dépendance, API du navigateur et outillage existants.
- Bips sur l'horloge audio : HIGH sur Chromium (mesuré, vrai module), MEDIUM sur iOS (sources WebKit).
- Voyant, verrou d'écran, son coupé : MEDIUM, dépend du comportement d'iOS ; la conception est faite pour dire la vérité même quand l'API ment.
- Ouverture rapide : HIGH sur la mesure relative (prototype contre code actuel), LOW sur la valeur absolue sur iPhone (hypothèse A7).
- Recalage des bouées : HIGH sur la tenue au bruit et la géométrie (simulation + trace réelle), MEDIUM sur la précision réelle (hypothèse A8, pas de vérité de terrain).
- Pitfalls : HIGH pour ceux reproduits ici (bips retardés, sonde menteuse, sommet fragile, cercle inutilisable), MEDIUM pour ceux tirés de WebKit.

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (gel du code) ; les comportements d'iOS peuvent changer avec une mise à jour d'iOS.
