---
phase: 04-archive-partagee
status: passed
verified: 2026-10-20
human_followup: true
---

# Vérification de la phase 4

| # | Critère | Preuve | Statut |
|---|---|---|---|
| 1 | Une régate créée ou complétée sur un téléphone apparaît sur les deux autres dès le retour du réseau ; saisie hors réseau envoyée sans perte ni doublon ; rien pendant un chrono ou un enregistrement | `js/archsync.js`, `api/archive.js` + tests ; scénarios `archive`, `equipage` (3 téléphones, compteur de requêtes figé pendant le chrono ; contrôle négatif) | ✓ (faux Blob) |
| 2 | Ajouts concurrents des deux côtés conservés | `js/archmerge.js` : 2 000 scénarios aléatoires convergents ; `equipage` : 3 manches de 2 auteurs | ✓ |
| 3 | Sans code, rien de l'archive n'est lisible | `tests/access.test.mjs` étendu (`/api/archive` toutes routes), auteur imposé par le middleware, rapports dans un cadre `sandbox` | ✓ |
| 4 | En mode avion, régates récentes lisibles (fiche, débrief, rapport) | `js/archheavy.js` + scénarios `archivehors`, `equipage` (C hors réseau) | ✓ (Chromium) |

`npm run check` : 472 tests ; 17/17 scénarios ; ouverture 418 ms ; référence SNPM et `js/courses.js` inchangés. v30 puis v31 sur l'aperçu ; `main` en v29.

## À confirmer avec le vrai Blob (aperçu)

- Essai à deux téléphones (création, manches hors réseau des deux côtés, chrono), puis mode avion sur la Coupe SNPM (trace réelle 613 Ko).
- Après une journée : Vercel → Storage → `rade-tactique-blob` → usage (opérations et transfert) sous les quotas Hobby.
- Repli : « Désactiver la synchronisation ».
