---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-10-20T05:07:57.591Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 04 | unrun-verify | middleware.js |  | 04-01 tâche 2 : contrôle humain sur l'aperçu Vercel (en-tête x-rt-membre bien reçu, jamais 403 membre_inconnu ; module js/archmerge.js embarqué, jamais 500), à faire après le plan 04-03 | open |  | 2026-10-20T04:25:02.394Z |  |
| 2 | 04 | unrun-verify | js/archsync.js |  | 04-02 tâche 2 : recette humaine sur deux iPhone (mode avion, ajouts simultanés, chrono lancé pendant qu'un autre modifie) à faire sur l'aperçu après le plan 04-03 | open |  | 2026-10-20T04:45:07.266Z |  |
| 3 | 04 | unrun-verify | tools/regate-e2e.mjs |  | 04-03 tâche 3 : recette de Romain sur l'aperçu v30 avec le vrai magasin Blob et deux téléphones (points 1 à 9 et 11 de la recette humaine, quotas Observability, 401 sans code sur /api/archive) ; mise en production décidée par Romain | open |  | 2026-10-20T05:07:57.591Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "middleware.js",
    "line": null,
    "description": "04-01 tâche 2 : contrôle humain sur l'aperçu Vercel (en-tête x-rt-membre bien reçu, jamais 403 membre_inconnu ; module js/archmerge.js embarqué, jamais 500), à faire après le plan 04-03",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-20T04:25:02.394Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "js/archsync.js",
    "line": null,
    "description": "04-02 tâche 2 : recette humaine sur deux iPhone (mode avion, ajouts simultanés, chrono lancé pendant qu'un autre modifie) à faire sur l'aperçu après le plan 04-03",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-20T04:45:07.266Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "tools/regate-e2e.mjs",
    "line": null,
    "description": "04-03 tâche 3 : recette de Romain sur l'aperçu v30 avec le vrai magasin Blob et deux téléphones (points 1 à 9 et 11 de la recette humaine, quotas Observability, 401 sans code sur /api/archive) ; mise en production décidée par Romain",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-20T05:07:57.591Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
