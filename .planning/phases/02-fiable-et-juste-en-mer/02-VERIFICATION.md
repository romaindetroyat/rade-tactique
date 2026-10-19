---
phase: 02-fiable-et-juste-en-mer
status: passed
verified: 2026-10-19
human_followup: true
---

# Vérification de la phase 2

| # | Critère | Preuve | Statut |
|---|---|---|---|
| 1 | Bips à la seconde même quand l'app calcule ; son coupé signalé, « Tester le son », flash plein écran | `js/beeper.js` + 18 tests ; `PW_REQUIRED=1 node tools/audio-clock-check.mjs` : 11/11 bips, écart max 9,4 ms (fil principal gelé 2 × 1,3 s) | ✓ |
| 2 | Voyant GPS / écran / son / réseau en mode départ et en course, alerte si GPS muet > 10 s | `js/status.js` + 21 tests, `js/wakelock.js` + tests, sonde réseau testée dans `tests/sw.test.mjs`, essais Chromium | ✓ |
| 3 | Ouverture < 2 s hors réseau | `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : médiane 623 ms (4 535 ms avant), CPU ×4, hors réseau | ✓ (Chromium) |
| 4 | Journal de diagnostic consultable, erreurs datées | `js/diag.js`, `js/journal.js` + 23 tests, garde « aucune erreur avalée » sur 5 fichiers | ✓ |
| 5 | Bouées douteuses signalées et recalables (trace ou saisie), source et date | `js/marks.js`, `js/markfit.js` + tests ; SNPM : 26 m / 31 m ; simulation p90 18,7 m | ✓ |

`npm run check` : 162 tests verts ; référence SNPM inchangée ; v27 publiée sur l'aperçu, `main` inchangée.

## À confirmer sur les iPhone (recette)

- Bouton silencieux + « Tester le son » (Safari puis app installée) ; verrou d'écran selon la version d'iOS (lue dans l'en-tête du journal).
- Ouverture en mode avion < 2 s ; gel éventuel du premier calcul du vent (~1 s) et de la 3D (~0,9 s).
- GPS qui revient après verrouillage ; flash lisible au soleil ; « 3 ? » lisible sur la carte.
- Recalage réel de GR1 sur la prochaine trace qui la contourne.
