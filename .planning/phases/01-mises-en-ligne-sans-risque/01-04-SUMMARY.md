---
phase: 01-mises-en-ligne-sans-risque
plan: 04
subsystem: infra
tags: [porte-de-mise-en-ligne, vercel, release, documentation]
requires:
  - phase: 01-mises-en-ligne-sans-risque (plans 01 à 03)
    provides: "npm test, tools/stamp.mjs, mise à jour différée"
provides:
  - "scripts npm stamp / release / check / gate (RT_GATE_BYPASS=1 pour l'urgence)"
  - "v26 « mises à jour sans risque en course » (release.json, js/version.js, sw.js)"
  - "vercel.json : installCommand npm ci, buildCommand npm run gate, outputDirectory ."
  - "README « Mettre en ligne sans risque » ; CLAUDE.md et carte du code à jour"
affects: [toutes les mises en ligne suivantes]
key-files:
  modified: [package.json, release.json, sw.js, js/version.js, vercel.json, README.md, .claude/CLAUDE.md, .planning/codebase/*.md]
---

# Plan 01-04 : porte de mise en ligne

**Une version dont un test échoue n'atteint plus la production ; la v26 est publiée.**

## Preuves

| Contrôle | Résultat |
|---|---|
| `npm ci && npm run gate` (local) | 0 — 44 tests verts |
| `RT_STRICT=1 npm run gate` | 0 (release à jour) |
| Test cassé ajouté, `npm run gate` | 1 (refusé) |
| `RT_GATE_BYPASS=1 npm run gate` | 0 + avertissement |
| Vercel, `apercu-phase-01` @ 0924efd | **success** |
| Vercel, branche jetable `essai-porte-2` (test cassé) @ edd5764 | **failure** (non publié) |

## Écart à la recherche

Avec un `buildCommand`, le préréglage Vercel « Other » échoue sans `outputDirectory` (la recherche supposait « . » par défaut). Deux déploiements d'essai l'ont montré (`outputDirectory: "."` → succès ; sans → échec). Corrigé dans `vercel.json` et noté dans 01-RESEARCH.md.

## Décision de Romain (tâche 3)

« Allez hop, continue » (19/10/2026, aucune régate dans les 48 h) : porte activée et v26 publiée par fusion de romaindetroyat/rade-tactique#1 dans `main`.

## À faire

- Branches jetables `essai-porte`, `essai-porte-2`, `essai-a`, `essai-b` : à supprimer sur GitHub (la suppression distante est refusée depuis cet environnement).
- Vérification humaine : chaque iPhone passe une seule fois de la v25 à la v26 ; l'aide affiche « v26 · 19/10 » ; l'app marche en mode avion.
