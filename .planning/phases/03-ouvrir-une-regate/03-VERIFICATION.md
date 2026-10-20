---
phase: 03-ouvrir-une-regate
status: passed
verified: 2026-10-20
human_followup: true
---

# Vérification de la phase 3

| # | Critère | Preuve | Statut |
|---|---|---|---|
| 1 | Créer une régate en < 1 min, plusieurs manches avec parcours, statut à venir / aujourd'hui / passée | `js/regates.js` + tests, scénarios `creer`, `manche` | ✓ |
| 2 | IC relues champ par champ avec extrait, vraisemblance, champ illisible vide, rien sans validation | `js/icread.js`, `js/icplaus.js`, `api/ic.js` (extraits vérifiés côté serveur) + tests, scénarios `ic`, `vraisemblance`, `ia`, `ia-erreurs` | ✓ (IA non essayée en réel) |
| 3 | Bouées et parcours d'un autre club « à confirmer », hors routage et mode départ avant confirmation | `js/regmarks.js` + 24 tests, scénario `bouees` | ✓ |
| 4 | Vent et stratégie du jour figés sans geste ; fiche par saison avec vent, traces, débrief, polaire, rapport, auteur | `js/gel.js`, `js/regstore.js`, `js/attach.js` + tests, scénarios `gel`, `debrief-tardif`, `auteur` | ✓ |
| 5 | GPX Open GPX Tracker rangé seul, débrief lancé, pauses non reliées | `js/attach.js`, `js/segments.js` + tests, scénarios `gpx`, `gpx-choix` ; SNPM 15,22 Nq actifs | ✓ |

`npm run check` : 333 tests verts ; 13/13 scénarios Chromium ; ouverture 544 ms ; bips ≤ 5,4 ms ; référence SNPM et `js/courses.js` inchangés. v28 puis v29 sur l'aperçu, `main` inchangée.

## À confirmer par l'équipage

- `OPENAI_API_KEY` présente pour les aperçus Vercel, puis essai réel de « Lire avec l'IA » sur les IC SNPM (valeurs, durée) ; sinon `IA_IC = false`.
- Sur iPhone : créer une régate en moins d'une minute, « par Teiva / Thibaud » avec les vrais codes, import d'un GPX d'Open GPX Tracker avec pause, lisibilité de « X1 ? » sur la carte, journée de régate (gel au signal, mode avion).
