---
phase: 01-mises-en-ligne-sans-risque
status: passed
verified: 2026-10-19
human_followup: true
---

# Vérification de la phase 1

| # | Critère | Preuve | Statut |
|---|---|---|---|
| 1 | `npm run check` teste les calculs et rejoue la Coupe SNPM ; une version dont un test échoue n'arrive pas en production | 44 tests verts ; Vercel : bonne version `success` (0924efd), test cassé `failure` (edd5764) | ✓ |
| 2 | Sans code, rien de privé n'est servi | `tests/access.test.mjs` (vrai middleware, empreinte simulée) ; faille des noms voisins (`/sw.js.map`, `/acces.html.bak`) corrigée | ✓ |
| 3 | Pas de rechargement en course ni le jour de régate ; bandeau hors course ; version dans l'aide | `tests/sw.test.mjs`, `tests/racelock.test.mjs` (dont changement d'heure du 25/10) ; essai navigateur du bandeau | ✓ |
| 4 | Version et liste hors réseau générées ; la porte refuse un oubli | `tools/stamp.mjs`, `tests/stamp.test.mjs`, `stamp --check` dans `npm run gate` | ✓ |
| 5 | PDF d'IC piégé sans effet ; IC CVAT toujours lues | `PDF_OPTIONS.isEvalSupported=false` + garde statique ; `tests/pdf.test.mjs` sur les IC SNPM | ✓ |

## À confirmer par l'équipage (sans bloquer)

- Valeurs de référence SNPM (D-12) : présentées à Romain le 19/10 ; à signaler si un chiffre paraît faux.
- Sur les trois iPhone : passage unique v25 → v26, aide « v26 · 19/10 », mode avion après une ouverture en ligne, bandeau masqué pendant un chrono.
