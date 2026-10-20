---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-10-20T04:25:02.394Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 04 | unrun-verify | middleware.js |  | 04-01 tâche 2 : contrôle humain sur l'aperçu Vercel (en-tête x-rt-membre bien reçu, jamais 403 membre_inconnu ; module js/archmerge.js embarqué, jamais 500), à faire après le plan 04-03 | open |  | 2026-10-20T04:25:02.394Z |  |

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
  }
]
````
