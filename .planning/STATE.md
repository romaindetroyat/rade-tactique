---
gsd_state_version: "1.0"
current_phase: 2
current_phase_name: Fiable et juste en mer
status: executing
stopped_at: Completed 02-03-PLAN.md
last_updated: "2026-10-19T17:03:53.857Z"
last_activity: 2026-10-19
last_activity_desc: Phase 2 execution started
state_head: 2d60af012caa0c7718deca1a6dd710e71f978e2f
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 9
  completed_plans: 7
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** Le jour de la régate, l'équipage peut ouvrir l'épreuve, s'en servir en mer sans que rien ne lâche, et retrouver ensuite le débrief : des conseils et des chiffres justes, fiables sur l'eau, et partagés par tout l'équipage.
**Current focus:** Phase 2 — Fiable et juste en mer

## Current Position

Phase: 2 (Fiable et juste en mer) — EXECUTING
Plan: 4 of 5
Status: Ready to execute
Last activity: 2026-10-19 — Phase 2 execution started

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 5 min | 3 tasks | 11 files |
| Phase 01 P02 | 3 min | 2 tasks | 7 files |
| Phase 01 P03 | 13 min | 2 tasks | 9 files |
| Phase 02 P01 | 69 min | 3 tasks | 13 files |
| Phase 02 P02 | 20 min | 2 tasks | 14 files |
| Phase 02 P03 | 40 min | 2 tasks | 13 files |

## Accumulated Context

### Decisions

Les décisions sont consignées dans le tableau Key Decisions de PROJECT.md.
Décisions récentes qui orientent le travail en cours :

- [Feuille de route] : 4 phases (granularité coarse), dans l'ordre filet de sécurité → fiabilité en mer → ouverture de régate → archive partagée.
- [Feuille de route] : FIAB-01 et FIAB-02 (pas de rechargement en course, version affichée) sont avancés en phase 1 avec TEST-04 : le correctif est petit et décisif, et il s'appuie sur la version générée automatiquement.
- [Feuille de route] : JUST-01 et JUST-02 (bouées) vont en phase 2 pour la régate CVAT ; REG-04 (marques lues dans les IC à confirmer) réutilise ensuite l'état « confirmée / non confirmée ».
- [Feuille de route] : ARCH-02 (vent et stratégie du jour figés, liste et fiche) et ARCH-04 (GPX rattaché, débrief lancé) vont en phase 3, en local : une prévision non figée avant la régate est perdue. La phase 4 ne porte que le partage en ligne (ARCH-01, ARCH-03).
- [Feuille de route] : la phase 4 est coupable ; si elle n'est pas prête au gel du 2 novembre, la régate se court avec l'archive locale et le partage est livré après.
- [Phase 01]: Référence SNPM mesurée avec tStart = départ détecté 09:43:42Z (D-14), validation par Romain en fin de phase
- [Phase 01]: Matcher d'accès : acces.html, manifest.webmanifest et sw.js ancrés par $ (noms voisins désormais privés)
- [Phase 01]: pdf.js : PDF_OPTIONS gelé isEvalSupported false + garde statique sur getDocument(
- [Phase 01]: 01-02 : pdf.js précaché (import d'IC hors réseau) ; stamp --check strict seulement en production ou RT_STRICT=1 ; le hachage de version exclut release.json et js/version.js
- [Phase 01]: Bandeau de mise à jour placé sous la barre du haut (ne masque ni ⟳ ni ?), texte posé par textContent
- [Phase 01]: Verrou : « course finie » et inactivité ne comptent que le même jour de Paris (régate de plusieurs jours, D-15) ; état dans localStorage rade.racelock
- [Phase 02]: 02-01 : tolérance de recalage des bips resserrée à 12 ms (l’horloge audio de Chromium dérive d’environ 1,5 ms/s ; avec 30 ms et 8 s d’avance des bips sonnaient à 31-34 ms)
- [Phase 02]: 02-01 : mesure Chromium des bips rejouée jusqu’à 3 fois (glissements de l’horloge audio de la machine de mesure) ; un vrai défaut échoue à chaque tentative (contrôle négatif réalisé)
- [Phase 02]: 02-01 : chrono repris après un rechargement (rade.timer.v1, borné à H+10 min) ; réactivation du son et redemande du verrou d’écran sur pointerdown et pointerup
- [Phase 02]: 02-02 : la lampe réseau suit le résultat de la sonde HEAD (jamais navigator.onLine seul) et n’est jamais rouge — Un GET serait servi par le cache du worker et dirait « réseau ok » en mode avion ; une sonde sans réponse passe la lampe à l’orange tout de suite
- [Phase 02]: 02-02 : garde de test « aucune erreur avalée » sur app, track, startmode, wakelock et beeper : tout gestionnaire consigne (report / note) ou explique son repli par un commentaire — FIAB-07 : plus aucun échec du chemin départ / course sans trace
- [Phase 02]: 02-02 : mode départ, quatre lampes sur une seconde ligne de la barre du haut ; ligne d’action = lampe touchée, sinon première lampe rouge, sinon alerte du chrono — Quatre lampes ne tiennent pas sur la ligne des boutons à 375 px
- [Phase 02]: L’interface utile s’affiche avant la 3D et le vent : import différé de scene3d.js, gardes, marques rt:ui / rt:map (FIAB-06)
- [Phase 02]: Le champ de vent est préparé dans prepareField par tranches de 12 ms (kitSteps / warm) derrière autoHeavy ; computeField est mémoïsé, fieldKey remis à null par refreshObs et le débrief
- [Phase 02]: Seuls les recalculs automatiques (ouverture, prévisions sans geste) sont reportés de H−6 min à H+1 min ; gestes et relevés calculent tout de suite (garde statique W4)
- [Phase 02]: L’outil de mesure neutralise le dessin et le téléversement WebGL : le rendu logiciel de Chromium sans tête fausse les mesures

### Pending Todos

- Relever la version d'iOS et les réglages (mode économie, verrouillage auto, dictée) des trois iPhone avant la phase 2 ; sans iOS 18.4 ou plus, le maintien de l'écran n'est pas fiable dans l'app installée.
- Réunir quelques PDF d'IC d'autres clubs avant de concevoir l'import de la phase 3.

### Blockers/Concerns

- Échéance : gel visé le 2 novembre 2026, régate CVAT les 7-9 novembre, aucune mise en production à partir du 5 novembre sauf correctif critique hors course.
- Phase 1 : activer la porte de déploiement (`buildCommand`) seulement après vérification sur un déploiement d'aperçu (accueil, `/sw.js`, `/data/` inchangés), avec un contournement documenté.
- Phase 2 : le comportement réel des iPhone (écran verrouillé, GPS, bouton silencieux, dictée en app installée) ne se tranche qu'en essai sur appareil.
- Phase 4 : plan Vercel (Hobby ou Pro) et consommation Blob à confirmer ; le store Blob privé est à créer par Romain ; vérifier le contrôle d'accès de toutes les nouvelles routes, aperçus compris.
- Secrets (clé OpenAI, jeton du store Blob, codes d'accès) : jamais dans le dépôt, les journaux ni les tests.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-10-19T17:03:53.727Z
Stopped at: Completed 02-03-PLAN.md
Resume file: None
