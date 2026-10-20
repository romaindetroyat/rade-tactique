---
gsd_state_version: "1.0"
current_phase: 05
current_phase_name: avant-la-regate
status: completed
stopped_at: Phase 4 complete — all phases complete
last_updated: "2026-10-20T09:03:53.570Z"
last_activity: 2026-10-20
last_activity_desc: Phase 4 complete
state_head: ab80b664aa27402e8c0665c6f96ee15550442fc9
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 24
  completed_plans: 21
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** Le jour de la régate, l'équipage peut ouvrir l'épreuve, s'en servir en mer sans que rien ne lâche, et retrouver ensuite le débrief : des conseils et des chiffres justes, fiables sur l'eau, et partagés par tout l'équipage.
**Current focus:** Phase 4 — Archive partagée

## Current Position

Phase: 05 (avant-la-regate) — READY TO EXECUTE
Plan: Not started
Status: All phases complete
Last activity: 2026-10-20 — Phase 4 complete

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 21
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |
| 2 | 5 | - | - |
| 3 | 7 | - | - |
| 4 | 5 | - | - |

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
| Phase 02 P04 | 13 min | 2 tasks | 10 files |
| Phase 02 P05 | 25 min | 1 tasks | 4 files |
| Phase 03 P01 | 20 min | 3 tasks | 10 files |
| Phase 03 P02 | 14 min | 2 tasks | 11 files |
| Phase 03 P03 | 25 min | 2 tasks | 9 files |
| Phase 03 P04 | 22 min | 3 tasks | 13 files |
| Phase 03 P05 | 58 min | 2 tasks | 12 files |
| Phase 03 P06 | 30 min | 2 tasks | 10 files |
| Phase 03 P07 | 21 min | 2 tasks | 13 files |
| Phase 04 P01 | 19 min | 3 tasks | 13 files |
| Phase 04 P02 | 19 min | 3 tasks | 11 files |
| Phase 04 P03 | 21min | 3 tasks | 12 files |
| Phase 04 P04 | 36min | 3 tasks | 12 files |
| Phase 04 P05 | 85 min | 2 tasks | 10 files |

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
- [Phase 02]: Bouées : recalage par la trace = sommet du virage + 14 m vers l’intérieur, jusqu’à 3 candidats, ±20 m, passage au plus près pour information, aucun candidat sans virage net (D-02 amendé) ; mesures SNPM 26,3 m (marque 7) et 30,8 m (marque 6), simulation p90 18,7 m
- [Phase 02]: 02-04 : recalages de bouées dans localStorage rade.marks.v1 (ce téléphone seulement, D-04), appliqués à MARKS seulement par js/app.js (début d’init et juste après un recalage validé), jamais dans les tests ; saisie bornée à la rade, confirmation au-delà de 2 Nq
- [Phase 02]: 02-05 : v27 publiée sur l’aperçu apercu-phase-02 ; main inchangé (2a5c5df), mise en production laissée à Romain (avant le gel du 2 novembre, jamais après le 5 novembre au matin)
- [Phase 03]: 03-01 : statut, verrou et saison calculés au jour de Paris ; rade.events.v1 jamais écrite (index rade.regates.v1, reprise idempotente, Coupe SNPM semée sur appareil neuf)
- [Phase 03]: 03-01 : auteur = réponse GET /api/membre du middleware (prénom seul, no-store), copie rade.membre.v1 hors réseau, by: null complété au premier succès ; l'étiquette n'est pas une autorité (phase 4)
- [Phase 03]: 03-01 : l'horloge de Playwright vide performance.mark ; l'outil de bout en bout relève les marques par window.__marks ; codes de sortie stricts décidés par verdict()
- [Phase 03]: Relecture des IC : brouillon en mémoire, écriture unique par applyReview sur « Valider les IC » ; extraits tirés du texte nettoyé ; puces ✓ ⚠ ✕, une valeur impossible bloque la validation — D-02, D-03 : rien de deviné ni de retenu sans contrôle humain
- [Phase 03]: 03-03 : sceau au premier signal (manche la plus tôt, sinon IC, sinon fin de la régate à Paris, signal inconnu) ; le gel copie sans calcul, une copie à la fois, jamais reporté pendant la séquence de départ — ARCH-02
- [Phase 03]: 03-03 : analyse et débrief d'une trace sur les prévisions vivantes si leur jour y figure, sinon le vent figé du jour, sinon le vent manuel annoncé (libellé « vent du jour figé le JJ/MM à HH:MM ») — Pitfall 1
- [Phase 03]: 03-03 : une écriture refusée par la base rade-regates n'écrit pas de résumé (la fiche ne ment pas) et le nouvel essai attend 10 minutes ; la route conseillée figée (11,9 Ko pour 15 bords) arrive dès la fin de l'analyse
- [Phase 03]: [03-04] Jour d’une trace = jour de Paris du milieu de son plus long segment ; unique et heure rangent sans question, tout doute (choix, proche, aucune) ouvre une invite : l’app ne devine jamais entre deux régates
- [Phase 03]: [03-04] Pauses = coupures dans les données (tr.brk, P[i].brk) : trou de plus de 120 s ou nouveau <trkseg> après plus de 5 s ; SNPM 15,25 Nq en 3,55 h actives (test) au lieu de 16,38 Nq en 6,00 h, référence inchangée
- [Phase 03]: [03-04] La fiche de régate ne lit que r.traces (références et résumés), jamais la liste complète des traces ; résumé et rapport posés sur la référence à l’ouverture de la trace et à la fin du débrief
- [Phase 03]: [03-05] Le gel du vent est refait sans attendre 10 min quand l'heure du signal change (manche ajoutée ou heure corrigée)
- [Phase 03]: [03-05] js/events.js ne garde que la lecture du PDF et des IC ; l'ancien formulaire et rade.events.v1 en écriture ont disparu (scénario depuis-ic)
- [Phase 03]: 03-06 : une règle particulière lue par l'IA est montrée avec le texte de son extrait (celui du PDF), pas avec la reformulation du modèle ; seule une valeur prouvée est affichée
- [Phase 03]: 03-06 : un 401/403 d'OpenAI (clé refusée) est renvoyé en 502 par api/ic.js, car la page lit 401 comme un refus d'accès à l'app
- [Phase 03]: 03-06 : IA_IC (js/icread.js) masque « Lire avec l'IA » sans toucher au reste ; décision après l'essai réel sur l'aperçu v29 (plan 07)
- [Phase 03]: Plan 03-07 : une bouée corrigée reste « à confirmer » ; seul le geste Confirmer la fait servir (auteur et date gardés, position d’origine conservée)
- [Phase 03]: Plan 03-07 : bouées X1… et parcours 101… d’une régate injectés dans MARKS et COURSES par le seul js/app.js (marque fromRegatta, retirés avant chaque injection) ; parcours choisi disparu → parcours 3
- [Phase 04]: 04-01 : le cookie du code d'accès n'est pas transmis aux fonctions /api/ ; x-rt-membre (prénom encodé) remplace celui du navigateur pour toute écriture de /api/ (majuscules, %61pi)
- [Phase 04]: 04-01 : la copie trash/ est écrite avant que la régate quitte le document ; une ancienne version déjà connue renvoyée par un téléphone en retard garde son auteur et ne change rien au document
- [Phase 04]: 04-01 : l'état visible de l'archive converge exactement (2 000 scénarios) ; l'historique (hist, h) est un journal au mieux qui converge après quelques échanges
- [Phase 04]: 04-02 : l'état marqué est la file d'envoi ; denied et outdated en mémoire seulement ; graine SNPM à instant fixe SEED_AT ; legacyStamp avant le premier envoi ; copie rade.regates.v1.bak
- [Phase 04]: [04-03] remoteMarkChanges borne les positions reçues à la rade et ramène la source à trace | saisie (T-04-18)
- [Phase 04]: [04-03] Un recalage reçu n'est jamais renvoyé : seule une action de l'équipier marque ~marks
- [Phase 04]: 04-04 : « Plein écran » du rapport = page à nous sous script-src 'none' qui enferme le rapport dans un cadre sandbox (une balise insérée dans le HTML d'un autre téléphone peut être devancée par un script placé avant <head>)
- [Phase 04]: 04-04 : un jour figé local est envoyé avant tout remplacement ; un jour à envoyer n'est jamais téléchargé dans le même passage ; objet annoncé mais absent (404) redemandé après 30 min
- [Phase 04]: 04-04 : les envois lourds ne sont pas limités à l'horizon de 180 jours (sauvegarde des traces anciennes), seuls les téléchargements le sont
- [Phase 04]: 04-05 : le défaut intermittent du scénario gel venait d'un tic de gel entre la création de la régate et l'ajout de sa manche ; scénario déterministe, et fiche des régates redessinée à l'ouverture de l'onglet après un gel tombé fiche fermée (icStale)
- [Phase 04]: 04-05 : v31 publiée sur l'aperçu apercu-phase-04 seulement ; main inchangée (7fb6401) ; production décidée par Romain (D-02)

### Pending Todos

- Relever la version d'iOS et les réglages (mode économie, verrouillage auto, dictée) des trois iPhone avant la phase 2 ; sans iOS 18.4 ou plus, le maintien de l'écran n'est pas fiable dans l'app installée.
- Réunir quelques PDF d'IC d'autres clubs avant de concevoir l'import de la phase 3.

### Blockers/Concerns

- Échéance : gel visé le 2 novembre 2026, régate CVAT les 7-9 novembre, aucune mise en production à partir du 5 novembre sauf correctif critique hors course.
- Phase 1 : activer la porte de déploiement (`buildCommand`) seulement après vérification sur un déploiement d'aperçu (accueil, `/sw.js`, `/data/` inchangés), avec un contournement documenté.
- Phase 2 : le comportement réel des iPhone (écran verrouillé, GPS, bouton silencieux, dictée en app installée) ne se tranche qu'en essai sur appareil.
- Phase 4 : plan Vercel (Hobby ou Pro) et consommation Blob à confirmer ; le store Blob privé est à créer par Romain ; vérifier le contrôle d'accès de toutes les nouvelles routes, aperçus compris.
- Secrets (clé OpenAI, jeton du store Blob, codes d'accès) : jamais dans le dépôt, les journaux ni les tests.

### Roadmap Evolution

- Phase 5 added: Avant la régate : archive amorcée et IA bornée (ARCH2-01, SECU2-01), choix de Romain le 2026-10-20

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-10-20T07:13:38.319Z
Stopped at: Phase 4 complete — all phases complete
Resume file: None
