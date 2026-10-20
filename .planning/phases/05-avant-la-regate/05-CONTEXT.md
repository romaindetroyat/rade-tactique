# Phase 5 : Avant la régate : archive amorcée et IA bornée — Contexte

**Recueilli :** 2026-10-20, avec Romain
**Statut :** prêt pour la recherche et la planification
**Échéance :** v32 en production avant le gel du 2 novembre 2026 (décision de Romain, comme toujours)

<domain>
## Périmètre

Deux exigences v2 avancées avant la régate CVAT du 7-9 novembre :

- **ARCH2-01** : ce que les téléphones avaient avant l'archive entre dans l'archive. Une bonne part est déjà faite (constat du code) :
  - `js/regates.js` `migrate()` reprend les fiches de `rade.events.v1` et sème la Coupe SNPM (`SEED_ID = 'snpm-2026'`) avec un instant commun, donc une seule fiche sur les trois téléphones ;
  - la phase 4 (04-02) envoie l'existant à la première synchronisation.
  - **Reste à faire :** les traces de l'IndexedDB `rade-traces` enregistrées ou importées avant la phase 3 ne sont rattachées à aucune régate, donc jamais partagées (cas probable : la trace de la Coupe SNPM du 18/10).
- **SECU2-01** : l'IA de l'app (`api/voice.js`, `api/debrief.js`, `api/rules.js`, `api/ic.js`) ne conserve rien chez OpenAI, ne peut pas dépasser un quota par équipier, et la dépense mensuelle est plafonnée côté OpenAI.

Hors périmètre : export JSON/GPX (ARCH2-02), notes d'équipage (ARCH2-03), jeton de session (SECU2-02), écran « Aujourd'hui », plans d'eau.
</domain>

<decisions>
## Décisions

### Anciennes traces
- **D-01 :** au premier lancement de la v32, rattrapage automatique, une seule fois par téléphone. Chaque trace locale est rangée dans la régate de son jour avec les règles existantes de `js/attach.js` (`matchRegattas`, `attachTrace`, `sameTrack` : jamais deux fois la même trace). Elle est ensuite partagée par le chemin normal de la phase 4 (objets lourds, `js/archheavy.js`, plafonds et règle « rien pendant une course » inchangés).
- **D-02 :** une trace sans régate ce jour-là reste dans « Traces », sur le téléphone seulement. Aucune fiche « entraînement » n'est créée.
- **D-03 :** le rattrapage ne tourne jamais pendant la journée de régate verrouillée ni pendant une course (`js/racelock.js`). Il est rejoué au lancement suivant s'il a été interrompu. Il est idempotent et consigné dans le journal (`js/journal.js`).
- **D-04 :** la référence SNPM (`js/courses.js`, `tests/reference/`) ne bouge pas. Le garde `git diff --quiet f80c365 -- js/courses.js tests/reference/` reste vert.

### IA bornée
- **D-05 :** `store: false` sur chaque appel `responses.create` des quatre fonctions, avec un test qui l'exige.
- **D-06 :** quota de **30 appels d'IA par équipier et par jour de Paris**, toutes fonctions confondues.
  - Il est compté côté serveur, par prénom posé par le middleware (`x-rt-membre`), jamais par une valeur du client.
  - Stockage : le magasin Blob privé déjà en place (préfixes `prod/` et `preview/`, écriture avec `ifMatch`).
  - Une écriture par appel. Le volume reste très inférieur au quota Hobby, de l'ordre de 2 000 opérations avancées par mois, mais le chercheur doit confirmer le coût par appel.
  - Au-delà du quota : HTTP 429 avec un message clair en français (« Limite d'IA du jour atteinte — reprise demain »), et l'app reste utilisable sans l'IA.
  - Si le compteur est illisible (Blob en panne) : on laisse passer, on consigne, et le plafond OpenAI reste le filet. L'IA ne doit pas tomber à cause du compteur.
- **D-07 :** plafond de dépense du projet OpenAI à **10 $ par mois**, posé par Romain dans le tableau de bord OpenAI. Le plan fournit un geste guidé pas à pas (à vérifier : limite de budget du projet, bloquante ou seulement une alerte). Quand le budget est atteint, OpenAI refuse les appels : les fonctions renvoient déjà une erreur bornée, à vérifier pour le message affiché.

### Ajouts après la recherche (2026-10-20)
- **D-09 :** une trace enregistrée dans l'app est désormais rangée à l'arrêt comme un import GPX, par `rangeTrace(tr, { invite: false })`, sans question. C'est la suite logique de « Rattacher au jour » ; Romain en est informé.
- **D-10 :** une trace importée avant la v31 avait un identifiant aléatoire. Le rattrapage lui donne l'identifiant stable `'tr' + start + '-' + n` (écriture du nouvel enregistrement, puis suppression de l'ancien, idempotent). Il ne rattache jamais une trace si la régate a déjà une référence de même `start` et même `n`. Deux téléphones qui avaient le même fichier ne font ainsi qu'une seule référence et un seul envoi (critère 1).
- **D-11 :** le rapport de débrief d'une ancienne trace (`tr.report`) est annoncé sur sa référence (`setTraceReport`), pour que les autres téléphones le téléchargent.
- **Précision de D-05 :** `store: false` empêche la conservation des réponses, mais pas les journaux de surveillance des abus d'OpenAI, gardés jusqu'à 30 jours. Les textes de l'app et du guide disent « OpenAI ne garde pas les réponses », jamais « ne conserve rien ».
- **Précision de D-06 :** le volume estimé est de 100 à 400 opérations par mois pour l'IA, et de 900 à 1 100 au total avec l'archive, sur un quota Hobby de 2 000. Le plafond théorique (3 × 30 × 30) le dépasserait, mais il n'est pas réaliste. L'usage Blob sera regardé après la régate.
- **Précision de D-07 :** la limite n'est bloquante que si « Enforce a hard limit » est coché (Project settings → Limits → Spend). L'erreur est un 429 `project_spend_limit_exceeded`, traduite en français par le serveur.

### Livraison
- **D-08 :** v32 sur l'aperçu `apercu-phase-05` avec une draft PR, puis production sur « publie » de Romain, avant le 2 novembre. La porte doit passer avec `VERCEL_ENV=production` (leçon de la v31 : `tests/helpers/setup.mjs` neutralise les variables Vercel).
</decisions>

<canonical_refs>
## Références

- `js/attach.js`, `js/track.js` (`listTracks`, `getTrack`), `js/archheavy.js`, `js/archsync.js`, `js/racelock.js`, `js/journal.js`, `js/regates.js` (`migrate`, `SEED_ID`)
- `api/archive.js` (accès au Blob, `prefix()`, `ifMatch`, `x-rt-membre`), `middleware.js`
- `api/voice.js`, `api/debrief.js`, `api/rules.js`, `api/ic.js`
- `.planning/phases/04-archive-partagee/` (CONTEXT, RESEARCH : quota Blob, règle D-03 « rien pendant une course »)
</canonical_refs>

<deferred>
## Idées reportées

- Fiches « entraînement » pour les traces sans régate (non retenu, D-02)
- Quota d'IA réglable dans l'app
</deferred>
</content>
</invoke>
