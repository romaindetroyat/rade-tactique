---
phase: 01-mises-en-ligne-sans-risque
plan: 03
subsystem: infra
tags: [service-worker, mise-a-jour-differee, verrou-course, pwa, node-test, heure-de-paris]
requires:
  - phase: 01-mises-en-ligne-sans-risque (plan 01)
    provides: "npm test, tests/helpers/setup.mjs (TZ Europe/Paris, linkedom)"
  - phase: 01-mises-en-ligne-sans-risque (plan 02)
    provides: "js/version.js (BUILD), bloc généré de sw.js, node tools/stamp.mjs"
provides:
  - "sw.js : installation sans activation automatique, messages GET_BUILD / BUILD / SKIP_WAITING, cache d'abord pour la liste hors réseau, ?acces= et /api/ toujours au réseau"
  - "js/racelock.js : règles pures du verrou (PARIS, MORNING_END_H, IDLE_MS, TIMER_GRACE_MS, parisClock, isActive, isRaceDay, lockState)"
  - "js/swupdate.js : initUpdates() -> { apply, refresh, check } ; seul endroit qui enregistre le worker et recharge la page"
  - "js/app.js : tick du verrou (5 s), persistance rade.racelock, bandeau #updbar, bouton « Course finie »"
  - "js/events.js : champ « Dernier jour » (dateEnd) de la fiche de régate (D-15)"
affects: [01-04 porte de mise en ligne (stamp --check, première release v26), phase 3 REG-03 (lecture de dateEnd dans le PDF des IC)]

actuals:
  tokens: 7000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Worker sans skipWaiting : la version attend, la page décide sur geste (postMessage SKIP_WAITING), un seul rechargement gardé par un drapeau wantReload"
    - "Cache d'abord pour la liste hors réseau (la page reste cohérente avec son worker), réseau d'abord pour le reste"
    - "Verrou = fonction pure de (now, activité, plage de jours, dernière activité, « course finie ») ; heure de Paris par Intl.DateTimeFormat, jamais l'heure de l'appareil"
    - "sw.js exécuté dans node:vm avec faux self, faux caches et faux réseau"

key-files:
  created:
    - js/racelock.js
    - js/swupdate.js
    - tests/sw.test.mjs
    - tests/racelock.test.mjs
  modified:
    - sw.js
    - js/app.js
    - js/events.js
    - styles.css
    - js/version.js

key-decisions:
  - "Le bandeau #updbar est placé sous la barre du haut (top = --topH + --safeT + 6 px) et non à --safeT + 6 px : à cet endroit il aurait recouvert ⟳ et ? (critère « ne masque ni ? ni ⟳ »)"
  - "Les pages hors liste hors réseau (rapports, accès) gardent la copie en cache après un passage réseau (comportement existant conservé), en plus du repli sur index.html"
  - "L'état du verrou (lastActiveAt, finishedAt) vit dans localStorage rade.racelock, écrit au plus toutes les 30 s et sur pagehide / page cachée"
  - "Un « course finie » ou une inactivité ne comptent que le même jour de Paris : chaque jour d'une régate de plusieurs jours recommence (D-15)"
  - "Les onglets Régate (changement ou suppression de fiche) rafraîchissent « En course » pour que le bouton « Course finie » suive la fiche choisie"

requirements-completed: [FIAB-01]

plan_head_before: 821459e4541425aa2e3b1019079206f22ffd5fdb
plan_head_after: 4f9f1930ed6861307116b5d8f94f7fcc0bb92cd0

coverage:
  - id: D1
    description: "Une nouvelle version téléchargée attend : le worker ne s'active jamais seul, les fichiers de l'app sont servis depuis le cache de la version installée, et seul le message SKIP_WAITING (geste) l'active"
    requirement: FIAB-01
    verification:
      - kind: unit
        ref: "tests/sw.test.mjs (7 tests : 0 skipWaiting à l'installation, 1 sur SKIP_WAITING, GET_BUILD, activate, /api/ et ?acces= non interceptés, cache d'abord, hors ligne, rapports au réseau) ; mutation « skipWaiting remis à l'installation » : le test échoue"
        status: pass
      - kind: e2e
        ref: "Chromium (Playwright, copie du site servie en local) : bandeau « Nouvelle version v26 · essai du bandeau » ; rechargement manuel : version A gardée et bandeau de retour ; geste : 1 navigation, version B, un seul cache"
        status: pass
    human_judgment: false
  - id: D2
    description: "Verrou en course et journée de régate : chrono (3 h de grâce), mode départ, trace, GPS ; régate de plusieurs jours ; 9 h Paris ; retour au port ; heure d'été du 25/10/2026"
    requirement: FIAB-01
    verification:
      - kind: unit
        ref: "tests/racelock.test.mjs (12 tests : parisClock, D-01, sans régate, D-03, 25/10/2026, D-02 x2, D-15, isRaceDay, isActive, fiche dateEnd x2)"
        status: pass
      - kind: e2e
        ref: "Chromium : bandeau masqué pendant le chrono, de retour à l'arrêt ; un jour de régate après 9 h le bandeau reste masqué jusqu'au toucher de « Course finie », puis revient (rouge si critique) et se remasque quand le chrono repart"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bandeau lisible et bouton « Course finie » dans l'app installée sur iPhone (Safari standalone), cycle de vie du worker sous iOS"
    requirement: FIAB-01
    verification: []
    human_judgment: true
    rationale: "Rendu et cycle de vie du service worker dans l'app installée sur iPhone : non simulables en Node ni en Chromium de bureau (human-check de la tâche 2, repris par la vérification de fin de phase)"

duration: 13min
completed: 2026-10-19
status: complete
---

# Phase 1 Plan 03 : Mise à jour différée et verrou de course — Summary

**Le service worker n'active plus jamais une version tout seul : elle attend en cache, un bandeau « Nouvelle version v26 · <note> » ne s'affiche que hors course et le geste « Mettre à jour » provoque un seul rechargement ; le verrou (chrono, mode départ, trace, GPS, journée de régate après 9 h Paris, chaque jour d'une régate de plusieurs jours, levé par « Course finie ») est une fonction pure testée, heure d'été du 25/10/2026 comprise.**

## Performance

- **Duration:** 13 min (horloge de la machine)
- **Started:** 2026-10-19T11:17:04Z
- **Completed:** 2026-10-19T11:30:01Z (code), SUMMARY ensuite
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 9

## Accomplishments

- **Tracer de bout en bout (tâche 1)** : worker, page, bandeau, geste, rechargement. Porte du tracer : les deux vérifications automatiques relancées, vertes — « Tracer verified end-to-end — expanding ». En plus, le protocole a été rejoué dans Chromium sur une copie du site : version A en service, publication d'une version B (`--release`), bandeau « Nouvelle version v26 · essai du bandeau » ; **rechargement manuel : l'ancienne version reste en service** (cache d'abord) et le bandeau revient ; chrono lancé : bandeau masqué, arrêté : bandeau de retour ; geste : **1 seule navigation**, version B, un seul cache (`rade-<id>`).
- **Verrou** : `js/racelock.js` (41 lignes, pur : ni DOM, ni horloge, ni stockage). 12 tests dont D-01 (tous les jours), D-02 (retour au port : « course finie » ou arrêt depuis 1 h ; activité de 8 h sans effet l'après-midi), D-03 (8 h 59 libre, 9 h 00 verrouillé, aussi le jour du changement d'heure), D-15 (7 au 9 novembre : le 8 verrouillé, le 9 à 8 h 30 libre, le 10 libre, « course finie » du 7 sans effet le 8) et `parisClock` à 02 h deux fois (00:59:59Z et 01:00:00Z le 25/10/2026).
- **Régate sur plusieurs jours (D-15)** : champ « Dernier jour » dans la fiche, lu seulement s'il est postérieur à la date ; « du lundi 19 octobre au mardi 20 octobre » dans l'onglet Régate. La lecture automatique dans le PDF des IC reste à la phase 3 (REG-03).
- **« Course finie — retour au port »** : carte en tête de l'onglet « En course », uniquement les jours de régate ; n'arrête ni chrono, ni trace, ni GPS.
- **Ancien rechargement automatique supprimé** : `serviceWorker` n'apparaît plus dans `js/app.js` ; tout passe par `js/swupdate.js` (`register('sw.js'` une seule fois).
- `npm test` : **44 réussis** (25 avant ce plan, 7 sw, 12 racelock), 0 échec. `node tools/stamp.mjs --check` : à jour (avertissement « contenu modifié depuis la v25 » attendu, la release v26 est faite au plan 04).

## Task Commits

1. **Tâche 1 (tracer) : une nouvelle version attend le geste de l'équipier, jamais en course** — `512a2df` (feat)
2. **Tâche 2 (TDD) : journée de régate, « Course finie », plusieurs jours, bandeau**
   - RED : `de3af59` (test) — 10 tests verts, 2 rouges
   - GREEN : `4f9f193` (feat)

**Plan metadata :** commit docs de ce SUMMARY (voir `git log`).

## TDD Gate Compliance

**Tâche 2 — RED (constaté)** : `node --test --import ./tests/helpers/setup.mjs tests/racelock.test.mjs` : 10 réussis, 2 échecs. Cibles en échec, sur les assertions prévues : « D-15 : la fiche garde le dernier jour saisi… » (`le formulaire doit contenir le champ #evDateEnd`) et « D-15 : un dernier jour absent, égal ou antérieur… » (attendu `''`, obtenu `undefined`, car `readForm` ne lisait pas `dateEnd`). Évaluation sémantique : les tests ont bien exécuté leur contrôle et échouent sur le comportement visé, pas sur une erreur d'import ou de fixture (une première version du test échouait par `TypeError` sur un champ absent ; remplacée avant le commit RED par une assertion explicite). Les dix autres tests portent sur `js/racelock.js`, écrit à la tâche 1 (tracer) comme le plan le prévoit : verts dès le départ, voulu (ils figent les règles D-01 à D-03 et D-15). GREEN : `js/events.js` (champ et lecture), `js/app.js`, `styles.css`, 12 tests verts. Pas de REFACTOR. Le classifieur `check tdd-red-evidence` n'a pas été lancé : `workflow.tdd_mode` n'est pas activé et le plan est `type: execute`.

## Files Created/Modified

- `sw.js` — logique sous le bloc généré : install sans `skipWaiting`, activate (purge des autres caches, `clients.claim()`), message `SKIP_WAITING` / `GET_BUILD`, fetch cache d'abord pour la liste hors réseau, `?acces=` et `/api/` ignorés
- `js/racelock.js` — règles pures du verrou
- `js/swupdate.js` — `initUpdates({ isLocked, onAvailable, onHidden, onApplied })` → `{ apply, refresh, check }`
- `js/app.js` — imports, `raceLock()`, `raceTick()` (5 s), `saveRaceActivity()`, `showUpdateBar()` / `hideUpdateBar()` (texte par `textContent`), carte `#raceDone`, « du … au … »
- `js/events.js` — `#evDateEnd` et `dateEnd` (gardé seulement si postérieur à la date)
- `styles.css` — `#updbar`, `#updbar.crit`, `#updbar[hidden]`
- `js/version.js`, `sw.js` (bloc) — régénérés par `node tools/stamp.mjs` (47 fichiers dans la liste hors réseau, dont `js/racelock.js` et `js/swupdate.js`)
- `tests/sw.test.mjs` (7 tests), `tests/racelock.test.mjs` (12 tests)

## Decisions Made

Voir `key-decisions`. En particulier : position du bandeau sous la barre du haut pour ne masquer ni ⟳ ni ? (écart de forme avec le plan, voir ci-dessous) ; conservation de la copie en cache des pages hors liste après un passage réseau.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Position du bandeau : sous la barre du haut, pas à `--safeT + 6 px`**
- **Found during:** Task 2 (styles)
- **Issue :** `top: calc(var(--safeT) + 6px)` place le bandeau sur la barre du haut, où se trouvent ⟳, ⤴ et ? ; le human-check exige qu'il ne masque ni ? ni ⟳.
- **Fix :** `top: calc(var(--topH) + var(--safeT) + 6px)` et `width: max-content` (sans quoi le texte se replie sur deux lignes à 390 px). Vérifié par capture Chromium en 390 × 780 : bandeau sous la barre, boutons visibles.
- **Files modified :** `styles.css`
- **Committed in :** `4f9f193`

**2. [Rule 2 - Missing critical] Rafraîchir « En course » quand la fiche choisie change**
- **Found during:** Task 2
- **Issue :** `renderLive()` n'était pas rappelé par le changement ou la suppression de fiche : le bouton « Course finie » aurait pu rester visible (ou absent) pour la mauvaise régate.
- **Fix :** `renderLive()` ajouté aux gestionnaires `#evSel` et `#evDel`.
- **Files modified :** `js/app.js`
- **Committed in :** `4f9f193`

**3. [Rule 1 - Bug, forme] Pages hors liste hors réseau**
- **Found during:** Task 1
- **Issue :** l'exemple de la recherche ne met plus en cache les pages hors liste (rapports, accès) ; l'ancien worker en gardait une copie, utile hors réseau.
- **Fix :** copie `cache.put` conservée après un passage réseau réussi (comportement existant), repli `caches.match` puis `index.html` comme prévu.
- **Files modified :** `sw.js`
- **Committed in :** `512a2df`

---

**Total deviations :** 3 auto-fixed (2 bug, 1 missing critical). **Impact sur le plan :** aucun changement de périmètre ; les trois points servent le critère visé (lisibilité du bandeau, cohérence du bouton, hors réseau inchangé).

## Issues Encountered

- Le premier essai de test navigateur du chrono a échoué : la fenêtre d'accueil (première visite) interceptait les clics. Réglé dans le script d'essai (`rade.welcome` posé avant le chargement) ; sans effet sur l'app.
- Aucun autre incident.

## Authentication Gates

None.

## Known Stubs

Aucun.

## Threat Flags

Aucun nouvel élément de surface au-delà de `<threat_model>`. T-01-09 traité (pas d'activation à l'installation, cache d'abord, `apply()` refusé sous verrou, rechargement seulement si `wantReload`, tests vm et tests du verrou), T-01-13 traité (texte du bandeau posé par `textContent`, pas d'`innerHTML` ; la note passe déjà par `validateNote` au plan 02). T-01-10, T-01-11, T-01-12 acceptés comme prévu. Aucun paquet installé.

## User Setup Required

None - no external service configuration required.

## Points d'attention pour la suite

- **Dernière mise en ligne « à l'ancienne » (Pitfall 2)** : les téléphones qui ont encore le worker v25 (`skipWaiting` + rechargement sur `controllerchange`) appliqueront la première release contenant ce plan automatiquement, en rechargeant la page. La livrer à un moment calme, hors des 48 h avant une régate (plan 04).
- Résiduel accepté (A6, Pitfall 3) : si iOS tue puis relance l'app pendant une course, une version déjà téléchargée peut s'activer sans geste. Parade : règle des 48 h (plan 04).
- Le human-check de la tâche 2 (aperçu Vercel dans l'app installée sur iPhone : bandeau, rouge si critique, masquage en course, « Course finie ») est repris par la vérification de fin de phase.
- `.claude/CLAUDE.md` décrit encore `APP_VERSION`, `VERSION` et `SHELL` tenus à la main (déjà signalé au plan 02).
- Après toute modification de fichier de l'app : `node tools/stamp.mjs` (le test « tout fichier chargé est dans le SHELL » reste vert).

## Next Phase Readiness

Prêt pour le plan 04 (porte de mise en ligne : `npm run stamp / release / check`, première release v26, `buildCommand`). Aucun blocage.

## Self-Check: PASSED

Fichiers créés présents (`js/racelock.js`, `js/swupdate.js`, `tests/sw.test.mjs`, `tests/racelock.test.mjs`) ; commits `512a2df`, `de3af59`, `4f9f193` présents dans l'historique de `apercu-phase-01` ; `commits: 3` mesuré par `git rev-list --count` depuis `plan_head_before` ; `npm test` : 44 réussis ; critères d'acceptation rejoués (`serviceWorker` 0 dans `js/app.js`, `register('sw.js'` 1 dans `js/swupdate.js`, `Date.now|document.|localStorage` 0 dans `js/racelock.js`, `evDateEnd` 2, `dateEnd` 3, `raceDone` 2, `Course finie` 3, `#updbar.crit` 1).

---
*Phase: 01-mises-en-ligne-sans-risque*
*Completed: 2026-10-19*
