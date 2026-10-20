---
phase: quick-261020-aid
plan: 01
subsystem: aide-integree
tags: [aide, help, bulles, guide, tests, v34, apercu-vercel]

requires:
  - phase: quick-261020-eaq
    provides: "guide.html refait (v33) et la liste des 8 écarts de l’aide intégrée"
provides:
  - "js/help.js : GUIDE, STATIC_TIPS['#daySeg'] et SYNC_TIP en accord avec la v32 et le guide"
  - "js/app.js : bulles « Régates » (Passée) et « Mes traces » (partagées) corrigées"
  - "tests/guide.test.mjs : 2 tests de plus sur l’aide intégrée (formules périmées, libellés retrouvés dans le code)"
  - "release v34 « aide intégrée mise à jour » poussée sur apercu-phase-05 (production inchangée)"
affects: [recette de Romain sur iPhone, décision de mise en production (avant le gel du 2 novembre)]

plan_head_before: 8d0f29343c70c8f124ff06a8bde5c034fa64286b
plan_head_after: fe1abb55c2ec4254f79648835940340894ba69e0

actuals:
  tokens: 9000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "chaque libellé entre « » de l’aide est retrouvé dans le code ; les exemples dictés et les menus d’iOS/Android sont listés à part dans CITATIONS_LIBRES"

key-files:
  created: []
  modified: [js/help.js, js/app.js, tests/guide.test.mjs, release.json, sw.js, js/version.js]

key-decisions:
  - "Texte seulement : aucun changement de comportement ; seules les chaînes et l’ancre du lien du guide changent"
  - "Le délai d’envoi de SYNC_TIP passe de « dans la minute » à « dans une vingtaine de secondes » (scheduleSync(20000), comme le guide)"

requirements-completed: ["261020-aid"]

coverage:
  - id: D1
    description: "L’aide intégrée ne contredit plus la v32 ni le guide (8 écarts de la liste traités)"
    requirement: "261020-aid"
    verification:
      - kind: unit
        ref: "tests/guide.test.mjs#aide intégrée : plus de formule périmée, repères de la v32 présents"
        status: pass
      - kind: unit
        ref: "tests/guide.test.mjs#aide intégrée : chaque libellé entre guillemets existe dans l’app"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs guide ia-erreurs archive"
        status: pass
    human_judgment: false
  - id: D2
    description: "Textes courts et clairs pour des marins"
    verification: []
    human_judgment: true
    rationale: "Seul Romain peut dire si la fenêtre d’aide est claire sur son iPhone"

duration: 15min
completed: 2026-10-20
status: complete
---

# Quick 261020-aid : aide intégrée mise à jour

**Fenêtre d’aide « i », bulles et indicateur de synchronisation remis d’accord avec la v32 et le guide v33 ; chaque libellé cité est vérifié par test contre le code ; v34 poussée sur apercu-phase-05, production inchangée.**

## Accomplissements

Les 8 écarts relevés par la tâche 261020-eaq sont traités :

1. `GUIDE`, Régates : « vent du jour figé, traces, débriefs et rapports sont partagés » (plus « résumés du vent du jour »).
2. `GUIDE`, Départ : Top 5’ (avertissement) / Top 4’ / Top 1’, ⛵ Mode départ plein écran avec DÉPART 5’, 🔊 Tester le son avant chaque départ.
3. `GUIDE`, nouveaux points : les quatre voyants (GPS, ÉCRAN, SON, RÉSEAU) ; retour au port (⏹ Arrêter et enregistrer, Arrêter le GPS, 🏁 Course finie — retour au port) ; bandeau Mettre à jour et son verrou du jour de régate ; limite d’IA de 30 appels par jour (« Limite d’IA du jour atteinte — reprise demain ») ; Open GPX Tracker en parallèle ; vent utile jusqu’à 25 nœuds.
4. `STATIC_TIPS['#daySeg']` : Auj., Demain, puis le jour abrégé ; 🏁 marque le premier jour de la régate courante.
5. `SYNC_TIP` : « Pas encore synchronisé », « Synchronisation à relancer », « Plafond du jour atteint · reprise demain », « Code d’accès à renouveler », « Mettez l’app à jour pour synchroniser » expliqués.
6. Bulle Régates (js/app.js) : « Passée ».
7. Bulle Mes traces (js/app.js) : les traces rangées dans une régate sont partagées avec l’équipage ; une trace d’un jour sans régate reste sur ce téléphone seulement.
8. Lien « 📖 Guide complet de l’équipage » → `guide.html#minute`.

## Commits de tâche

1. **Tâche 1 : textes d’aide et garde de test** — `8237c43` (docs), avec `sw.js` et `js/version.js` régénérés
2. **Tâche 2 : v34 sur l’aperçu** — `fe1abb5` (docs), poussé : `git ls-remote` donne fe1abb5 sur refs/heads/apercu-phase-05 ; main distant inchangé (3a4fa38)

Release : **v34** (`release.json` n = 34, critical = false).

## Déviations par rapport au plan

### Ajouts

**1. [Règle 2 - garde] Délai d’envoi de SYNC_TIP corrigé**
- **Trouvé pendant :** tâche 1 (relecture contre le guide)
- **Problème :** la bulle disait « dans la minute » ; le code envoie après 20 secondes (`scheduleSync(20000)`), le guide dit « environ 20 secondes ».
- **Fix :** « dans une vingtaine de secondes ». Fichier : js/help.js (`8237c43`).

**2. Attribution des commits** : trailer `Claude Opus 5.5` demandé par la consigne, utilisé tel quel avec la ligne `Claude-Session`.

Sinon : plan exécuté tel qu’écrit. `STATE.md`, `ROADMAP.md`, PLAN et ce SUMMARY non commités (consigne : l’orchestrateur s’en charge).

## Résultats des contrôles

- `npm run check` : 543 tests verts (2 de plus), fichiers générés à jour.
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` : référence SNPM inchangée.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs guide ia-erreurs archive` : 3/3 OK.
- `RT_STRICT=1 node tools/stamp.mjs --check` et `VERCEL_ENV=production npm run gate` : verts après la release v34.
- Aucun code d’accès, nom de cookie, adresse de magasin, clé ni nom de modèle dans l’aide (gardé par test).

## Known Stubs

Aucun.

## Threat Flags

Aucun : texte seulement, aucune nouvelle route ni entrée.

## Self-Check: PASSED

- FOUND : js/help.js, js/app.js, tests/guide.test.mjs, release.json
- FOUND : 8237c43, fe1abb5 (ancêtres de HEAD)
