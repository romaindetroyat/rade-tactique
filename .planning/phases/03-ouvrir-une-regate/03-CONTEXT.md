# Phase 3: Ouvrir une régate - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

N'importe quel équipier, sans Romain, ouvre l'épreuve (CVAT ou autre club) avec ses manches, ses IC relues et ses marques confirmées ; le vent et la stratégie du jour sont figés automatiquement ; le GPX importé après la course se range dans la bonne régate et lance le débrief. Tout reste sur l'appareil (partage en phase 4).

Besoins : REG-01, REG-02, REG-03, REG-04, ARCH-02, ARCH-04.
</domain>

<decisions>
## Implementation Decisions

### Lecture des IC (REG-03, REG-04)
- **D-01:** Les IC d'un autre club sont lues par l'IA (OpenAI `gpt-5.5`, nouvelle fonction `api/ic.js` sur le modèle d'`api/rules.js` : schéma JSON strict, entrée bornée). Chaque valeur extraite porte l'extrait d'origine, vérifié **mot pour mot** contre le texte du PDF côté serveur (comme les citations de l'arbitre) ; une valeur dont l'extrait n'est pas retrouvé reste vide ou signalée, jamais devinée.
- **D-02:** Relecture champ par champ obligatoire : rien n'est retenu sans validation de l'équipier ; contrôles de vraisemblance (dates, heures, canal VHF, positions hors du plan d'eau) affichés à côté de chaque valeur.
- **D-03:** Les IC CVAT gardent la lecture actuelle par motifs (`parseIC`, hors réseau), présentée dans la même relecture. L'IA n'est appelée que pour un autre club ou si la lecture CVAT échoue, et seulement avec le réseau (import à faire avant la régate).
- **D-04:** Bouées et parcours lus dans les IC d'un autre club : affichés sur la carte « à confirmer », exclus du routage et du mode départ tant que l'équipier ne les a pas confirmés (réutiliser le signalement « à confirmer » de la phase 2).

### Auteur (ARCH-02)
- **D-05:** L'auteur de chaque élément vient du code d'accès : le middleware, qui connaît déjà le membre, le transmet à l'app (par exemple un cookie lisible `rt_membre` avec le prénom seul, ou une petite réponse) ; jamais le code ni son empreinte côté client.

### Tests
- **D-06:** Pas de PDF d'autres clubs pour l'instant : tester avec les IC CVAT/SNPM et des cas fabriqués ; les autres clubs seront validés à leur premier usage réel (et deviendront des cas de test).

### Claude's Discretion
- Modèle de données « régate » (date de début/fin — déjà `dateEnd` de la phase 1, club, manches avec parcours, statut à venir / aujourd'hui / passée, saison) et reprise automatique des fiches IC existantes (`rade.events.v1`) en régates.
- Moment du gel du vent et de la stratégie du jour (sans geste ; par exemple à chaque ouverture le jour J jusqu'au signal, figé au départ).
- Rattachement d'un GPX à la régate du jour (par date et heure ; choix proposé si plusieurs), pauses d'Open GPX Tracker sans ligne droite.
- Fiche de régate et liste par saison : vent du jour, traces, débrief, analyse polaire, rapport, auteur.
- Le verrou « journée de régate » de la phase 1 doit lire les dates de la régate (phase 3) au lieu de la seule fiche IC.
</decisions>

<canonical_refs>
## Canonical References
- `.planning/ROADMAP.md` — Phase 3, critères de succès
- `.planning/REQUIREMENTS.md` — REG-01..04, ARCH-02, ARCH-04
- `api/rules.js` — modèle pour `api/ic.js` (schéma strict, vérification mot pour mot)
- `js/events.js` (`parseIC`, fiches IC, `dateEnd`), `js/racelock.js`, `js/marks.js` (signalement « à confirmer »), `js/debrief.js`, `js/track.js` (`fromGPX`)
- `middleware.js` — membre connu par le code (ne jamais copier les empreintes)
- `.claude/CLAUDE.md` — conventions, `npm run stamp` / `release`, règle des 48 h
</canonical_refs>

<deferred>
## Deferred Ideas
- Partage des régates entre téléphones (phase 4).
- Tests sur de vraies IC d'autres clubs (au premier usage).
</deferred>

---
*Phase: 03-ouvrir-une-regate*
*Context gathered: 2026-10-19*
