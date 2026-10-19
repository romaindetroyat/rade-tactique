# Phase 2: Fiable et juste en mer - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

En mer, l'équipier se fie à ce que l'app montre et fait entendre : bips du chrono à la seconde (ou alerte si muet, doublés d'un signal visuel), voyant permanent GPS / écran / son / réseau, ouverture rapide hors réseau, journal des erreurs, bouées douteuses signalées puis recalables.

Besoins : FIAB-03, FIAB-04, FIAB-05, FIAB-06, FIAB-07, JUST-01, JUST-02.
</domain>

<decisions>
## Implementation Decisions

### Bouées (JUST-01, JUST-02)
- **D-01:** Seules les bouées de position approximative sont signalées « position à confirmer » : aujourd'hui GR1 (3) et Carqueiranne (11), `src: 'approx'`. Les autres (relevés GPS, coordonnées CVAT, calculées, OSM) restent normales. Signalement sur la carte, dans les parcours et en mode départ.
- **D-02:** Le recalage se fait **depuis la trace**, au débrief : l'app propose la position du passage au plus près de la bouée et l'équipier valide. Pas de bouton à toucher en course. La saisie manuelle de coordonnées reste possible (exigée par JUST-02), sans être mise en avant.
- **D-03:** Une bouée recalée affiche sa source (« trace du JJ/MM », « saisie ») et sa date ; elle n'est plus signalée.
- **D-04:** Le recalage reste sur le téléphone qui l'a fait ; partage automatique avec l'archive en phase 4. En attendant, Claude peut reporter à la main dans `js/courses.js` une position recalée validée par Romain.

### iPhone
- **D-05:** Versions d'iOS inconnues : prévoir les deux cas. Le voyant « écran maintenu » montre si le verrou d'écran tient réellement ; s'il n'est pas disponible ou se perd, alerte + conseil (verrouillage auto « Jamais » pendant la course).

### Claude's Discretion
- Forme et place du voyant (permanent en mode départ et en course, alerte si GPS muet > 10 s, écran non maintenu, son coupé, réseau absent).
- Signal visuel des bips clés (flash plein écran), détection du son coupé et bouton « tester le son ».
- Bips planifiés sur l'horloge audio (AudioContext) plutôt que sur `setInterval`.
- Journal de diagnostic : local, consultable dans l'aide, heure de chaque erreur, copiable pour l'envoyer.
- Ouverture < 2 s hors réseau : mesurer d'abord, ne charger la 3D et les prévisions qu'après l'interface utile.
</decisions>

<canonical_refs>
## Canonical References
- `.planning/ROADMAP.md` — Phase 2, critères de succès
- `.planning/REQUIREMENTS.md` — FIAB-03..07, JUST-01..02
- `.planning/phases/01-mises-en-ligne-sans-risque/01-CONTEXT.md` — verrou course / journée de régate (ne pas casser)
- `.planning/research/PITFALLS.md` — audio iOS, verrou d'écran iOS 18.4, GPS en arrière-plan
- `.claude/CLAUDE.md` — conventions, `npm run stamp` / `npm run release`, règle des 48 h
</canonical_refs>

<code_context>
## Existing Code Insights
- `js/app.js` ~l.665-745 : `timer`, `audioInit`, `beep` (oscillateur immédiat, déclenché par `setInterval`) → à replanifier sur l'horloge audio.
- `js/startmode.js` : mode départ, `wakeLock` l.99, bips de ligne/OCS ; `js/track.js` : `Recorder` et son `wakeLock`.
- `js/courses.js` : `MARKS` avec `src` (« approx », « CVAT », « OSM », « relevé GPS… ») — base du signalement.
- `js/debrief.js` : détection des passages aux bouées (distance au plus près) — base du recalage depuis la trace.
- `js/racelock.js` : états « en course » réutilisables pour savoir quand afficher le voyant.
- Tests : `npm test` (node:test + linkedom), cas de référence SNPM à ne pas faire bouger sans accord (D-12 phase 1).
</code_context>

<deferred>
## Deferred Ideas
- Partage des recalages entre téléphones (phase 4, archive).
- Bouton « bouée ici » en course (non retenu pour l'instant).
</deferred>

---
*Phase: 02-fiable-et-juste-en-mer*
*Context gathered: 2026-10-19*
