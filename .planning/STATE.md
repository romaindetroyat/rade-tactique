---
gsd_state_version: "1.0"
current_phase: 2
current_phase_name: Fiable et juste en mer
status: planning
stopped_at: Phase 2 context gathered
last_updated: "2026-10-19T13:32:54.962Z"
last_activity: 2026-10-19
last_activity_desc: Phase 1 complete, transitioned to Phase 2
state_head: 2a5c5dfcdbe5966963830d3b9a43d1ae4b2d1895
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** Le jour de la régate, l'équipage peut ouvrir l'épreuve, s'en servir en mer sans que rien ne lâche, et retrouver ensuite le débrief : des conseils et des chiffres justes, fiables sur l'eau, et partagés par tout l'équipage.
**Current focus:** Phase 1 — Mises en ligne sans risque

## Current Position

Phase: 2 — Fiable et juste en mer
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-19 — Phase 1 complete, transitioned to Phase 2

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

Last session: 2026-10-19T13:32:53.191Z
Stopped at: Phase 2 context gathered
Resume file: None
