---
schema_version: 1
open_count: 9
waived_count: 0
fixed_count: 9
total_count: 18
last_updated: 2026-11-26T23:42:11.680Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 04 | unrun-verify | middleware.js |  | 04-01 tâche 2 : contrôle humain sur l'aperçu Vercel (en-tête x-rt-membre bien reçu, jamais 403 membre_inconnu ; module js/archmerge.js embarqué, jamais 500), à faire après le plan 04-03 | fixed |  | 2026-10-20T04:25:02.394Z | 2026-10-20T08:23:50.640Z |
| 2 | 04 | unrun-verify | js/archsync.js |  | 04-02 tâche 2 : recette humaine sur deux iPhone (mode avion, ajouts simultanés, chrono lancé pendant qu'un autre modifie) à faire sur l'aperçu après le plan 04-03 | fixed |  | 2026-10-20T04:45:07.266Z | 2026-10-20T08:23:51.050Z |
| 3 | 04 | unrun-verify | tools/regate-e2e.mjs |  | 04-03 tâche 3 : recette de Romain sur l'aperçu v30 avec le vrai magasin Blob et deux téléphones (points 1 à 9 et 11 de la recette humaine, quotas Observability, 401 sans code sur /api/archive) ; mise en production décidée par Romain | fixed |  | 2026-10-20T05:07:57.591Z | 2026-10-20T08:23:51.236Z |
| 4 | 04 | unrun-verify | api/archive.js |  | 04-04 : recette humaine sur l'aperçu avec le vrai magasin Blob : head() d'un objet absent doit lever BlobNotFoundError (objets immuables trace et rapport), put sans allowOverwrite sur un objet existant doit échouer (perte de course), get en flux d'une trace de 600 Ko, 401 sans code sur ?k=trace\|report\|day | open |  | 2026-10-20T05:45:27.963Z |  |
| 5 | 04 | unrun-verify | js/archheavy.js |  | 04-04 tâche 2 : contrôle humain sur iPhone (app installée, mode avion) : fiche, vent du jour, trace, débrief et rapport d'une régate récente s'ouvrent ; espace occupé de l'ordre de 1 Mo par régate (Réglages > Safari > Données de sites) | fixed |  | 2026-10-20T05:45:28.170Z | 2026-10-20T08:23:51.398Z |
| 6 | 07 | stub | data/brest.wx-snapshot.json |  | Instantané météo de Brest absent (Open-Meteo refusé) : l’app reçoit null ; à produire en 07-10 | open |  | 2026-11-19T07:10:38.594Z |  |
| 7 | 07 | stub | js/app.js |  | VENUE_DEF.brest.courseId = banane (90) au premier passage, faute de catalogue du GPEN (07-09) | open |  | 2026-11-19T07:36:20.892Z |  |
| 8 | 07 | stub | data/brest.wx-snapshot.json |  | Instantané météo de Brest absent (limite quotidienne d’Open-Meteo) : pas de prévision de secours à la première ouverture hors réseau à Brest | open |  | 2026-11-19T11:35:15.439Z |  |
| 9 | 08 | skipped-test | tests/bormes.test.mjs |  | Instantané météo de Bormes non produit (Open-Meteo : limite quotidienne) ; test sauté, à produire avant la release (08-09) | open |  | 2026-11-26T19:45:50.981Z |  |
| 10 | 08 | stub | js/app.js | 917 | Carte « État de la mer » titrée « large de Cépet » et « faible en rade » à Bormes (point marin du descripteur) : texte de Toulon à paramétrer (08-07, D-12) | fixed |  | 2026-11-26T20:23:23.290Z | 2026-11-26T22:13:53.768Z |
| 11 | 08 | stub | js/venue-bormes.js |  | Descripteur de Bormes sans marques, lieux, zones interdites, dangers, régimes ni vents prédéfinis (formes vides, banane seule) : à remplir en 08-07 (savoir local) et 08-08 (Challenge de la Baie) | fixed |  | 2026-11-26T20:23:23.397Z | 2026-11-26T22:13:53.885Z |
| 12 | 08 | stub | js/help.js |  | Aide de Tofinou : la note de version affichée est celle de la v43 (« … GPEN ») jusqu’à la release v44 (08-10) ; lien du guide complet et rubrique IA de l’espace absents (08-10, 08-09) | open |  | 2026-11-26T21:36:35.725Z |  |
| 13 | 08 | todo | js/app.js | 989 | Message « pas un parcours du cahier CVAT » possible dans l’espace Tofinou sans régate ouverte (pickHTML) : texte du plan d’eau à rendre propre à Bormes (08-07/08-08) | fixed |  | 2026-11-26T21:36:35.832Z | 2026-11-26T22:13:54.015Z |
| 14 | 08 | stub | js/venue-bormes.js |  | Catalogue du Challenge de la Baie absent (COURSES vide, banane seule) ; libellés de classes du CVAT (« C–D–L–R1-R3 », « P1–P2 ») dans l’onglet Parcours et le texte de partage à Bormes : 08-08 | fixed |  | 2026-11-26T22:13:49.386Z | 2026-11-26T22:45:06.569Z |
| 15 | 08 | todo | js/regview.js | 139 | Formulaire de manche : « Classe G (grand) / P (petit) » du CVAT encore proposé à Bormes (onglet Régates) ; à masquer ou remplacer par les groupes du Challenge (08-09/08-10) | fixed |  | 2026-11-26T22:45:06.695Z | 2026-11-26T23:42:11.680Z |
| 16 | 08 | skipped-test | tests/bormes.test.mjs |  | 08-09 : instantané météo de Bormes réessayé, refusé par Open-Meteo (limite quotidienne) ; test toujours sauté, à produire avant la release (08-10) | open |  | 2026-11-26T23:07:25.489Z |  |
| 17 | 08 | deviation | data/brest.wx-snapshot.json |  | 08-09 : instantané de Brest refusé (limite quotidienne) ; s’il est produit, il casse la garde data/brest.* = 5e9b8a5 et la section brest du gel de Naos : différence admise à décider par Romain avant de le committer | open |  | 2026-11-26T23:07:25.597Z |  |
| 18 | 08 | deviation | js/tactics.js | 576 | 08-11 : rankCourses plante à Brest pour un parcours lu dans les IC sans ligne (préréglage « vignettes » absent), comme en v43 ; corrigé à Bormes seulement (gel de Naos) : correctif à décider pour Naos | open |  | 2026-11-26T23:42:11.562Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "middleware.js",
    "line": null,
    "description": "04-01 tâche 2 : contrôle humain sur l'aperçu Vercel (en-tête x-rt-membre bien reçu, jamais 403 membre_inconnu ; module js/archmerge.js embarqué, jamais 500), à faire après le plan 04-03",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-20T04:25:02.394Z",
    "resolved_at": "2026-10-20T08:23:50.640Z",
    "milestone": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "js/archsync.js",
    "line": null,
    "description": "04-02 tâche 2 : recette humaine sur deux iPhone (mode avion, ajouts simultanés, chrono lancé pendant qu'un autre modifie) à faire sur l'aperçu après le plan 04-03",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-20T04:45:07.266Z",
    "resolved_at": "2026-10-20T08:23:51.050Z",
    "milestone": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "tools/regate-e2e.mjs",
    "line": null,
    "description": "04-03 tâche 3 : recette de Romain sur l'aperçu v30 avec le vrai magasin Blob et deux téléphones (points 1 à 9 et 11 de la recette humaine, quotas Observability, 401 sans code sur /api/archive) ; mise en production décidée par Romain",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-20T05:07:57.591Z",
    "resolved_at": "2026-10-20T08:23:51.236Z",
    "milestone": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "api/archive.js",
    "line": null,
    "description": "04-04 : recette humaine sur l'aperçu avec le vrai magasin Blob : head() d'un objet absent doit lever BlobNotFoundError (objets immuables trace et rapport), put sans allowOverwrite sur un objet existant doit échouer (perte de course), get en flux d'une trace de 600 Ko, 401 sans code sur ?k=trace|report|day",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-20T05:45:27.963Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "js/archheavy.js",
    "line": null,
    "description": "04-04 tâche 2 : contrôle humain sur iPhone (app installée, mode avion) : fiche, vent du jour, trace, débrief et rapport d'une régate récente s'ouvrent ; espace occupé de l'ordre de 1 Mo par régate (Réglages > Safari > Données de sites)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-20T05:45:28.170Z",
    "resolved_at": "2026-10-20T08:23:51.398Z",
    "milestone": null
  },
  {
    "id": 6,
    "kind": "stub",
    "phase": "07",
    "file": "data/brest.wx-snapshot.json",
    "line": null,
    "description": "Instantané météo de Brest absent (Open-Meteo refusé) : l’app reçoit null ; à produire en 07-10",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-19T07:10:38.594Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 7,
    "kind": "stub",
    "phase": "07",
    "file": "js/app.js",
    "line": null,
    "description": "VENUE_DEF.brest.courseId = banane (90) au premier passage, faute de catalogue du GPEN (07-09)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-19T07:36:20.892Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 8,
    "kind": "stub",
    "phase": "07",
    "file": "data/brest.wx-snapshot.json",
    "line": null,
    "description": "Instantané météo de Brest absent (limite quotidienne d’Open-Meteo) : pas de prévision de secours à la première ouverture hors réseau à Brest",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-19T11:35:15.439Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 9,
    "kind": "skipped-test",
    "phase": "08",
    "file": "tests/bormes.test.mjs",
    "line": null,
    "description": "Instantané météo de Bormes non produit (Open-Meteo : limite quotidienne) ; test sauté, à produire avant la release (08-09)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-26T19:45:50.981Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 10,
    "kind": "stub",
    "phase": "08",
    "file": "js/app.js",
    "line": 917,
    "description": "Carte « État de la mer » titrée « large de Cépet » et « faible en rade » à Bormes (point marin du descripteur) : texte de Toulon à paramétrer (08-07, D-12)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-26T20:23:23.290Z",
    "resolved_at": "2026-11-26T22:13:53.768Z",
    "milestone": null
  },
  {
    "id": 11,
    "kind": "stub",
    "phase": "08",
    "file": "js/venue-bormes.js",
    "line": null,
    "description": "Descripteur de Bormes sans marques, lieux, zones interdites, dangers, régimes ni vents prédéfinis (formes vides, banane seule) : à remplir en 08-07 (savoir local) et 08-08 (Challenge de la Baie)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-26T20:23:23.397Z",
    "resolved_at": "2026-11-26T22:13:53.885Z",
    "milestone": null
  },
  {
    "id": 12,
    "kind": "stub",
    "phase": "08",
    "file": "js/help.js",
    "line": null,
    "description": "Aide de Tofinou : la note de version affichée est celle de la v43 (« … GPEN ») jusqu’à la release v44 (08-10) ; lien du guide complet et rubrique IA de l’espace absents (08-10, 08-09)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-26T21:36:35.725Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 13,
    "kind": "todo",
    "phase": "08",
    "file": "js/app.js",
    "line": 989,
    "description": "Message « pas un parcours du cahier CVAT » possible dans l’espace Tofinou sans régate ouverte (pickHTML) : texte du plan d’eau à rendre propre à Bormes (08-07/08-08)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-26T21:36:35.832Z",
    "resolved_at": "2026-11-26T22:13:54.015Z",
    "milestone": null
  },
  {
    "id": 14,
    "kind": "stub",
    "phase": "08",
    "file": "js/venue-bormes.js",
    "line": null,
    "description": "Catalogue du Challenge de la Baie absent (COURSES vide, banane seule) ; libellés de classes du CVAT (« C–D–L–R1-R3 », « P1–P2 ») dans l’onglet Parcours et le texte de partage à Bormes : 08-08",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-26T22:13:49.386Z",
    "resolved_at": "2026-11-26T22:45:06.569Z",
    "milestone": null
  },
  {
    "id": 15,
    "kind": "todo",
    "phase": "08",
    "file": "js/regview.js",
    "line": 139,
    "description": "Formulaire de manche : « Classe G (grand) / P (petit) » du CVAT encore proposé à Bormes (onglet Régates) ; à masquer ou remplacer par les groupes du Challenge (08-09/08-10)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-26T22:45:06.695Z",
    "resolved_at": "2026-11-26T23:42:11.680Z",
    "milestone": null
  },
  {
    "id": 16,
    "kind": "skipped-test",
    "phase": "08",
    "file": "tests/bormes.test.mjs",
    "line": null,
    "description": "08-09 : instantané météo de Bormes réessayé, refusé par Open-Meteo (limite quotidienne) ; test toujours sauté, à produire avant la release (08-10)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-26T23:07:25.489Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "08",
    "file": "data/brest.wx-snapshot.json",
    "line": null,
    "description": "08-09 : instantané de Brest refusé (limite quotidienne) ; s’il est produit, il casse la garde data/brest.* = 5e9b8a5 et la section brest du gel de Naos : différence admise à décider par Romain avant de le committer",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-26T23:07:25.597Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "08",
    "file": "js/tactics.js",
    "line": 576,
    "description": "08-11 : rankCourses plante à Brest pour un parcours lu dans les IC sans ligne (préréglage « vignettes » absent), comme en v43 ; corrigé à Bormes seulement (gel de Naos) : correctif à décider pour Naos",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-26T23:42:11.562Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
