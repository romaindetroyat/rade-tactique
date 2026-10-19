---
phase: 02-fiable-et-juste-en-mer
plan: 05
subsystem: publication-v27
tags: [guide, release, v27, apercu-vercel, mesures-chromium, pwa]

requires:
  - phase: 02-fiable-et-juste-en-mer
    provides: "plans 01 à 04 : chrono sur l’horloge audio, Tester le son, flash, verrou d’écran, voyant à quatre lampes, journal de diagnostic, ouverture rapide, report des recalculs, bouées à confirmer et recalage ; tools/audio-clock-check.mjs et tools/measure-boot.mjs"
provides:
  - "guide.html : le guide de l’équipage décrit toute la phase 2 (chrono et horloge audio, Tester le son, flash, quatre lampes, report des recalculs de H−6 min à H+1 min, bande du voyant en course, marques à confirmer, Bouées à confirmer au débrief et saisie dans IC, Journal de diagnostic, Verrouillage automatique : Jamais, iOS 18.4)"
  - "release.json v27 (non critique) ; sw.js et js/version.js régénérés (id 9c494412a4, 54 fichiers)"
  - "branche apercu-phase-02 poussée sur origin, aperçu Vercel « success » ; main distant inchangé"
affects: [recette de la phase par Romain sur les trois iPhone, décision de mise en production]

actuals:
  tokens: 1931
  tasks: 1
  commits: 1

key-files:
  created: []
  modified:
    - guide.html
    - release.json
    - sw.js
    - js/version.js

key-decisions:
  - "Le guide corrige aussi deux phrases devenues fausses depuis la phase 1 (« se met à jour toute seule », « se recharge seule au lancement suivant ») : une nouvelle version ne s’applique que par le bandeau « Mettre à jour », jamais en course"
  - "Chemin des réglages iPhone écrit comme dans le plan : Réglages → Affichage et luminosité → Verrouillage automatique (l’ancienne formulation « Luminosité et affichage » est remplacée)"
  - "URL d’aperçu : l’API GitHub n’expose que le statut Vercel et son lien de tableau de bord (pas de déploiement GitHub listé) ; l’adresse publique de l’aperçu se lit dans ce tableau de bord, sans la deviner ici"

requirements-completed: [FIAB-03, FIAB-04, FIAB-05, FIAB-06, FIAB-07, JUST-01, JUST-02]

plan_head_before: 9a7c1dba2779a7966fe7966a00c946c955581564
plan_head_after: 58116d52129df2c2675544737051165da75353ec

coverage:
  - id: D1
    description: "Le guide de l’équipage explique le chrono et « Tester le son », le flash, les quatre lampes, le report des recalculs pendant la séquence, le journal de diagnostic, les bouées « à confirmer » et leur recalage (sommet du virage, D-02 amendé) et « Verrouillage automatique : Jamais » (D-05)"
    requirement: FIAB-04
    verification:
      - kind: command
        ref: "grep -c « Journal de diagnostic » guide.html = 1 ; grep -c « Verrouillage automatique » guide.html = 1 ; npm run check : 162 tests verts (dont la garde du SHELL et du hachage qui couvre guide.html)"
        status: pass
    human_judgment: true
    rationale: "Clarté du texte pour l’équipage, à relire par Romain ; aucun code d’accès, empreinte ni clé dans le guide"
  - id: D2
    description: "Les deux mesures Chromium sont faites pour de bon (PW_REQUIRED=1, aucune sautée) : bips à 30 ms près, ouverture hors réseau en moins de 2 s"
    requirement: FIAB-03
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/audio-clock-check.mjs : sortie 0, écart maximal 9,4 ms (seuil 30 ms), 0 manquant, 0 en trop"
        status: pass
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 : sortie 0, médiane de l’interface utile 623 ms < 2000 ms (hors réseau, CPU ×4)"
        status: pass
    human_judgment: true
    rationale: "Chromium n’est pas l’iPhone : horloge audio, suspension et temps d’ouverture réels à relever sur les trois iPhone pendant la recette"
  - id: D3
    description: "La v27 est publiée sur la branche d’aperçu apercu-phase-02 avec le guide à jour ; main (production) n’a pas bougé"
    requirement: FIAB-06
    verification:
      - kind: command
        ref: "RT_STRICT=1 node tools/stamp.mjs --check : « stamp à jour », sortie 0 ; RT_STRICT=1 npm run gate : 162 tests, 0 échec, sortie 0 ; git ls-remote origin refs/heads/main = 2a5c5dfcdbe5966963830d3b9a43d1ae4b2d1895 avant et après le push"
        status: pass
      - kind: command
        ref: "gh api repos/romaindetroyat/rade-tactique/commits/58116d5…/status : état « success » (« Deployment has completed »)"
        status: pass
    human_judgment: true
    rationale: "Recette sur les trois iPhone (Safari sur l’aperçu, puis app installée après la mise en production) et décision de mise en production réservées à Romain"

duration: 25 min
completed: 2026-10-19
status: complete
---

# Phase 2 Plan 05 : Guide et publication de la v27 Summary

**La v27 (« bips à la seconde, voyant, journal, ouverture rapide, bouées à confirmer ») est publiée sur l’aperçu `apercu-phase-02` avec le guide de l’équipage à jour, après deux mesures Chromium réellement exécutées (bips à 9,4 ms, ouverture hors réseau à 623 ms) ; `main` n’a pas bougé.**

## Performance

- **Durée :** 25 min
- **Tâche :** 1 (type tracer, exécutée comme une tâche normale)
- **Fichiers modifiés :** 4 (`guide.html`, `release.json`, `sw.js`, `js/version.js`)

## Accomplissements

- **Guide de l’équipage** (`guide.html`, français, style des sections existantes, aucune image) :
  - Section 2 « Le départ » : bips posés sur l’horloge audio et chrono repris après un rechargement ; carte « Tester le son, avant la procédure » (bouton silencieux, volume, Bluetooth, musique d’une autre app mise en pause avec le chrono armé) ; carte « Flash plein écran » (blanc aux minutes, vert au signal, réglage « Flash visuel », noir en « Plein soleil ») ; carte « Le voyant : quatre lampes » (GPS, ÉCRAN, SON, RÉSEAU, sens du rouge, actions) ; carte « Pendant la séquence, l’app ne recalcule pas toute seule » (de H−6 min à H+1 min, reprise une minute après le signal, relevés et gestes pris en compte tout de suite).
  - Section 3 « En course » : bande du voyant, GPS « muet depuis … s », réseau jamais bloquant ; marques « à confirmer » (« 3 ? »).
  - Section 4 « Après la course » : « Bouées à confirmer » (choix du virage, position au sommet du virage décalée de 14 m vers l’intérieur, ±20 m, passage au plus près pour information, D-02 amendé, saisie dans IC, recalage gardé sur ce téléphone, Safari et app installée séparés) ; « Journal de diagnostic » à envoyer à Romain après chaque sortie (Copier ou Partager).
  - Section 6 « Réglages iPhone » : « Verrouillage automatique : Jamais » pendant la course (D-05), maintien de l’écran fiable dans l’app installée à partir d’iOS 18.4, version d’iOS à noter (elle figure aussi en tête du journal) ; rappel de « Tester le son » dans la carte du bouton silencieux.
- **Mesures Chromium** exécutées avec `PW_REQUIRED=1`, sorties 0, collées ci-dessous.
- **Release v27** non critique : `release.json` n = 27, hachage `9c494412a4` égal à l’identifiant de `js/version.js`.
- **Aperçu** : `apercu-phase-02` poussée (`9a7c1db..58116d5`), statut Vercel « success ».

## Mesures Chromium (sorties brutes)

### `PW_REQUIRED=1 node tools/audio-clock-check.mjs` : sortie 0

```
Tentative 1/3 — contexte audio : running · 11 début(s) de bip relevé(s) pour 11 attendus · fil principal gelé 2 × 1,3 s
bip 10 s   : −7,0 ms
bip  9 s   : −7,0 ms
bip  8 s   : −7,0 ms
bip  7 s   : −7,0 ms
bip  6 s   : −7,0 ms
bip  5 s   : −7,0 ms
bip  4 s   : −7,0 ms
bip  3 s   : +0,1 ms
bip  2 s   : −1,4 ms
bip  1 s   : −9,4 ms
bip signal : −9,4 ms
Écart maximal : 9,4 ms (seuil 30 ms) · manquants : 0 · bips en trop ou fusionnés : 0
RÉSULTAT : OK (tentative 1/3)
```

### `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : sortie 0

```
Première visite en ligne : service worker actif, 54 fichiers en cache.
Serveur arrêté (connexion refusée sur 127.0.0.1:35711) : ouvertures hors réseau, CPU ×4, 5 ouvertures.

ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  624 |                           555 |             7005 |                                     1724
        2 |                  623 |                           471 |             6784 |                                     1645
        3 |                  575 |                           427 |             6741 |                                     1590
        4 |                  663 |                           527 |             7218 |                                     1861
        5 |                  499 |                           507 |             6684 |                                     1958
  médiane |                  623 |                           507 |             6784 |                                     1724
  maximum |                  663 |                           555 |             7218 |                                     1958
RÉSULTAT : OK — médiane de l’interface utile 623 ms < 2000 ms (hors réseau, CPU ×4)
```

Lecture : l’interface utile (onglets, Départ avec chrono, mode départ, En course) est prête en 623 ms (médiane) hors réseau à CPU ×4 ; la carte 3D arrive après (6,8 s dans cette mesure à CPU ralenti, rendu logiciel neutralisé, voir plan 03). La plus longue tâche après l’interface (1,7 s médiane à CPU ×4) est un reste d’ouverture connu et hors plan (premier calcul du champ de vent et construction de la 3D), déjà noté au plan 03.

## Contrôles avant publication (sorties)

```
npm run release -- "bips à la seconde, voyant, journal, ouverture rapide, bouées à confirmer"
stamp écrit : v27 · 19/10 · 9c494412a4 · 54 fichiers

release.json : { "n": 27, "date": "2026-10-19", "note": "bips à la seconde, voyant, journal, ouverture rapide, bouées à confirmer", "critical": false, "hash": "9c494412a4" }

RT_STRICT=1 node tools/stamp.mjs --check  → « stamp à jour », sortie 0
RT_STRICT=1 npm run gate                  → 162 tests, 162 pass, 0 fail, sortie 0
```

## Publication de l’aperçu

- Commit publié : `58116d5` (`feat(02-05): guide de l'équipage de la phase 2 et version v27 …`).
- Push : `git push -u origin apercu-phase-02` → `9a7c1db..58116d5 apercu-phase-02 -> apercu-phase-02` (aucun push sur `main`, aucune fusion).
- **SHA de `main` distant avant le push : `2a5c5dfcdbe5966963830d3b9a43d1ae4b2d1895` ; après le push : `2a5c5dfcdbe5966963830d3b9a43d1ae4b2d1895` (identique).**
- Statut de l’aperçu (`gh api …/commits/58116d52129df2c2675544737051165da75353ec/status`) : `state: success`, contexte « Vercel », « Deployment has completed ».
- Lien du déploiement (tableau de bord Vercel) : https://vercel.com/romain-detroyat-s-projects/rade-tactique/GcuXXFHaCFazQ5kg2PG6Td1vPXk2 — l’adresse publique de l’aperçu s’y lit (« Visit »). L’API GitHub ne liste pas de déploiement pour ce commit, je n’ai donc pas pu relever l’adresse publique ni ouvrir l’aperçu, qui demande le code d’accès de l’équipage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deux phrases du guide devenues fausses depuis la phase 1**
- **Found during:** Tâche 1, relecture de `guide.html`
- **Issue :** la section « Installer l’app » disait que l’app « se met à jour toute seule » et « se recharge seule au lancement suivant » ; depuis la phase 1 une nouvelle version ne s’applique que par le bandeau « Mettre à jour », jamais en course.
- **Fix :** phrases réécrites (bandeau « Mettre à jour », vérifier que les trois téléphones ont la même version).
- **Files modified :** `guide.html`
- **Commit :** `58116d5`

Sinon : le plan a été exécuté tel qu’écrit. Les deux mesures sont sorties en 0 du premier coup (tentative 1/3 pour les bips), aucune n’a été sautée.

## Auth gates

Aucune.

## Known Stubs

Aucun stub créé ou touché par ce plan (guide, version générée).

## Threat Flags

Aucune nouvelle surface : pas de point d’entrée réseau, de chemin d’authentification ni de schéma ajouté. T-02-17 : le plan s’arrête à l’aperçu, aucune mesure n’a été sautée ; T-02-18 : note validée par `validateNote`, aucun code d’accès, empreinte ni clé dans le guide, la note ou ce rapport.

## Calendrier pour Romain

La mise en production (fusion de `apercu-phase-02` dans `main`) est **à décider par Romain, hors de ce plan**.

- Idéalement **au plus tard le 30 octobre**, pour que les trois iPhone appliquent la v27 hors course avant le **gel du 2 novembre**.
- **Jamais après le 5 novembre au matin** (règle des 48 h avant la régate CVAT des 7-9 novembre), ni pendant une course.
- Chaque iPhone applique ensuite la v27 par le bandeau « Mettre à jour », hors course ; l’aide doit afficher « Version v27 · 19/10 — bips à la seconde, voyant, journal, ouverture rapide, bouées à confirmer ».

## Vérification humaine restante (recette de la phase, avant le gel du 2 novembre)

Sur l’aperçu (avec son code), sur les trois iPhone en Safari, puis dans l’app installée après la mise en production : ouvrir l’aide et contrôler la version v27, puis dérouler les recettes des plans 01 à 04 (bips écran verrouillé et rechargement en dernière minute, « Tester le son », flash au soleil, lampes avec écran verrouillé 20 s et mode avion, ouverture en mode avion app installée, bouées « 3 ? » et recalage par saisie, recalage par la trace à la prochaine sortie autour de GR1 ou de Carqueiranne). Chaque équipier envoie son journal de diagnostic (version d’iOS connue).

## Self-Check: PASSED

- `guide.html`, `release.json`, `sw.js`, `js/version.js` présents ; commit `58116d5` ancêtre de HEAD ; `git ls-remote origin refs/heads/apercu-phase-02` = `58116d52129df2c2675544737051165da75353ec`.
