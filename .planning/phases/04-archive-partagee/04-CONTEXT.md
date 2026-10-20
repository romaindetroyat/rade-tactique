# Phase 4: Archive partagée - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Les régates (fiche, manches, IC validées, bouées confirmées, vent et route figés, traces rattachées, débriefs, rapports, auteurs) sont partagées entre les trois téléphones de l'équipage via un stockage privé en ligne, avec synchronisation dès que le réseau revient, sans perte ni doublon de ce qui a été saisi hors réseau, et rien pendant une course. Les régates récentes restent lisibles hors réseau.

Besoins : ARCH-01, ARCH-03.
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Stockage : Vercel Blob **privé**, créé par Romain dans le projet (Production + Preview), jeton `BLOB_READ_WRITE_TOKEN` fourni par Vercel ; jamais lu côté client. Tout passe par des fonctions `api/` derrière le middleware (le contrôle d'accès existant), jamais d'URL Blob publique ni de lien signé exposé durablement.
- **D-02:** Calendrier : faite maintenant, livraison visée vers le 30 octobre ; si elle n'est pas prête au gel du 2 novembre, elle attend l'après-CVAT (les v28/v29 suffisent pour la régate). La phase peut donc être coupée : livrer d'abord le partage des régates et de leurs données légères, puis traces et rapports.
- **D-03:** Rien n'est envoyé ni reçu pendant un chrono, une trace, le mode départ ou le mode course (réutiliser `js/racelock.js`).
- **D-04:** Fusion simple, pensée pour trois personnes : chaque élément (régate, manche, trace, débrief, relevé, recalage de bouée) a un identifiant et un auteur ; les ajouts des deux côtés sont tous conservés ; pour une même valeur modifiée des deux côtés, la plus récente gagne et l'autre est gardée dans l'historique de la fiche. Pas d'édition collaborative en temps réel (hors périmètre).
- **D-05:** Les recalages de bouées de la phase 2 (gardés sur le téléphone jusqu'ici) sont partagés avec l'archive.

### Claude's Discretion
- Format des données en ligne (un objet par régate + objets lourds séparés), versionnement, file d'envoi hors réseau dans IndexedDB, déclencheurs de synchronisation (ouverture, retour du réseau, fin de course), indicateur discret « à jour / en attente ».
- Ce qui reste lisible hors réseau (« régates récentes » : par exemple la saison en cours) et budget de stockage local.
- Extension du test d'accès aux nouvelles adresses `api/`.
</decisions>

<canonical_refs>
## Canonical References
- `.planning/ROADMAP.md` — Phase 4, 4 critères de succès
- `.planning/REQUIREMENTS.md` — ARCH-01, ARCH-03 ; v2 : ARCH2-01 (reprise de l'existant), SECU2-02 (jeton de session)
- `.planning/phases/03-ouvrir-une-regate/03-0*-SUMMARY.md` — modèle de régate (`rade.regates.v1`, IndexedDB `rade-regates`), gel, rattachement, auteur `/api/membre`
- `.planning/phases/02-fiable-et-juste-en-mer/02-04-SUMMARY.md` — recalages de bouées
- `middleware.js`, `tests/access.test.mjs`, `js/racelock.js`, `js/journal.js`
- `.claude/CLAUDE.md` — conventions, release, règle des 48 h
</canonical_refs>

<deferred>
## Deferred Ideas
- Voir la version des autres équipiers (phase 1, D-09) — possible plus tard via l'archive.
- Jeton de session révocable (SECU2-02), export JSON/GPX (ARCH2-02).
</deferred>

---
*Phase: 04-archive-partagee*
*Context gathered: 2026-10-20*
