# Phase 4 : Archive partagée - Research

**Researched:** 2026-10-20
**Domain:** PWA sans build (JavaScript ES modules) + fonctions Vercel : stockage **Vercel Blob privé** partagé par trois équipiers, fusion par éléments (D-04) de régates modifiées hors réseau, synchronisation interdite pendant une course (D-03), lecture hors réseau des régates récentes (ARCH-03), recalages de bouées partagés (D-05)
**Confidence:** HIGH sur la fusion, le protocole et l’API serveur (29 tests de prototypes exécutés ici, dont 4 000 scénarios de convergence aléatoires à trois téléphones, un faux Blob avec `etag` / `ifMatch`, le vrai `middleware.js`) et sur l’API du SDK `@vercel/blob` (documentation officielle lue et fichiers de types du paquet 2.8.0 lus) ; MEDIUM sur le comportement réel de la plateforme Vercel (transmission de l’en-tête du middleware à la fonction, traçage des fichiers importés de `js/`, plan Hobby de Romain, décompte des opérations) : aucun accès à Vercel ni à un magasin Blob dans le bac à sable, donc **contrôle humain sur l’aperçu** listé en fin de document ; LOW sur la taille réelle d’un rapport de débrief (mesuré seulement sur le rapport SNPM écrit à la main)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Stockage : Vercel Blob **privé**, créé par Romain dans le projet (Production + Preview), jeton `BLOB_READ_WRITE_TOKEN` fourni par Vercel ; jamais lu côté client. Tout passe par des fonctions `api/` derrière le middleware (le contrôle d'accès existant), jamais d'URL Blob publique ni de lien signé exposé durablement.
- **D-02:** Calendrier : faite maintenant, livraison visée vers le 30 octobre ; si elle n'est pas prête au gel du 2 novembre, elle attend l'après-CVAT (les v28/v29 suffisent pour la régate). La phase peut donc être coupée : livrer d'abord le partage des régates et de leurs données légères, puis traces et rapports.
- **D-03:** Rien n'est envoyé ni reçu pendant un chrono, une trace, le mode départ ou le mode course (réutiliser `js/racelock.js`).
- **D-04:** Fusion simple, pensée pour trois personnes : chaque élément (régate, manche, trace, débrief, relevé, recalage de bouée) a un identifiant et un auteur ; les ajouts des deux côtés sont tous conservés ; pour une même valeur modifiée des deux côtés, la plus récente gagne et l'autre est gardée dans l'historique de la fiche. Pas d'édition collaborative en temps réel (hors périmètre).
- **D-05:** Les recalages de bouées de la phase 2 (gardés sur le téléphone jusqu'ici) sont partagés avec l'archive.

### Claude's Discretion
- Format des données en ligne (un objet par régate + objets lourds séparés), versionnement, file d'envoi hors réseau dans IndexedDB, déclencheurs de synchronisation (ouverture, retour du réseau, fin de course), indicateur discret « à jour / en attente ».
- Ce qui reste lisible hors réseau (« régates récentes » : par exemple la saison en cours) et budget de stockage local.
- Extension du test d'accès aux nouvelles adresses `api/`.

### Deferred Ideas (OUT OF SCOPE)
- Voir la version des autres équipiers (phase 1, D-09) — possible plus tard via l'archive.
- Jeton de session révocable (SECU2-02), export JSON/GPX (ARCH2-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | Les régates sont stockées en ligne, en privé, et partagées par l’équipage ; chaque téléphone se synchronise dès que le réseau revient, sans rien perdre hors réseau | Magasin Blob **privé** derrière `api/archive.js` ; un document léger `light.json` fusionné **côté serveur** (lire → fusionner → écrire avec `ifMatch`, 4 essais) ; marquage des modifications au point d’entrée unique `saveReg` ; état local = file d’attente (compteurs « sale »), fusion idempotente : aucun doublon, aucune perte ; recalages de bouées (D-05) dans le même document ; auteur posé par le serveur depuis l’en-tête `x-rt-membre` du middleware |
| ARCH-03 | Les régates récentes restent lisibles hors réseau | Les données légères de **toutes** les régates sont toujours locales (≈ 15-35 Ko chacune) ; objets lourds (vent figé, traces, rapports) téléchargés dans les magasins locaux **existants** (`rade-regates`, `rade-traces`) pour les régates des 180 derniers jours et à venir ; la lecture est locale, donc identique en mode avion ; budget et garde `navigator.storage.estimate()` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives lues dans `/home/user/rade-tactique/.claude/CLAUDE.md`, traitées comme des décisions verrouillées :

- **JavaScript ES modules dans le navigateur, sans framework, sans build, sans TypeScript** ; tout outillage nouveau reste hors du chargement de l’app (`tools/`, `tests/`). Une seule dépendance nouvelle est admise ici et seulement côté fonction (`@vercel/blob`).
- Nouveau module navigateur : `js/<nom>.js`, **commentaire d’en-tête en français**, exports nommés, importé depuis `js/app.js` ; puis `npm run stamp` (il l’ajoute au SHELL hors réseau) ; **ne jamais éditer `sw.js` ni `js/version.js` à la main**. Nouvelle publication : `npm run release -- "…"`.
- Nouvelle route : `api/<nom>.js`, `export default async function handler(req, res)`, entrée bornée, **`maxDuration` dans `vercel.json`** (`functions`), assistant interne préfixé `_` ; le client externe est créé paresseusement (ici `import('@vercel/blob')` dans le gestionnaire).
- Interface, commentaires et messages en français ; apostrophe typographique `’` et séparateurs `—` / `·` dans les chaînes d’interface ; `esc()` (ou `textContent`) avant tout `innerHTML` ; les extraits, noms de régates ou noms d’équipiers venus de l’archive sont des **données non fiables**.
- Clés de stockage `rade.<nom>.v<n>` (changer le suffixe si la forme persistée change). Tests `node:test` + `linkedom` dans `tests/*.test.mjs` ; `npm run check` doit rester vert (**333 tests, 6,0 s** aujourd’hui [VERIFIED: `npm test` exécuté ici, `# tests 333`, `# pass 333`, `# duration_ms 6000`]).
- **Aucun code d’accès, aucune empreinte de `middleware.js`, aucune clé** dans le code, les tests, les journaux, la documentation ou les rapports (ce document n’en contient aucun ; le test d’accès lit l’empreinte à l’exécution sans l’afficher).
- Règle d’exploitation : pas de mise en production dans les 48 h avant une régate ni pendant une course (sauf correctif critique hors course) ; la référence Coupe SNPM ne change qu’avec l’accord de Romain.
- Accès : « toute nouvelle donnée partagée doit rester derrière ce contrôle » ; Hébergement : « tout stockage partagé doit rester compatible » avec Vercel.
- Fail soft : `try { … } catch { … }` pour les E/S optionnelles, mais **le chemin course consigne ses erreurs** (`report()` de `js/journal.js`) ; ici toute erreur de synchronisation est consignée, jamais affichée en rouge ni bloquante.

## Summary

La phase tient en **quatre modules** (`js/archmerge.js` et `js/archsync.js`, purs ; `api/archive.js`, une seule fonction Vercel à injection du client Blob ; un petit module de gestion des objets lourds en version B), **une ligne utile dans le middleware** (l’en-tête `x-rt-membre`), **un seul point de câblage** dans `js/app.js` (`saveReg`, déjà l’entrée unique de toute écriture des régates) et une dépendance, `@vercel/blob`. Les prototypes de ce document ont été exécutés ici : 29 tests `node:test` verts (fusion 10, API 10, client 8, middleware 1), dont **4 000 scénarios aléatoires à trois téléphones** qui convergent vers le même état, sans doublon de manche, avec ajouts, suppressions, régates supprimées, recalages de bouées et auteurs absents ou différents. Ils ne sont **pas** dans le dépôt : le planificateur les recopie depuis *Code Examples*.

**Le choix qui simplifie tout : un seul document léger partagé, fusionné par le serveur.** Au lieu d’une file d’opérations (« outbox ») rejouée dans IndexedDB, le téléphone envoie l’état de ses régates modifiées ; le serveur lit `light.json`, le **fusionne** (ensemble d’éléments à « dernier écrit gagne », pierres tombales pour les suppressions, historique des valeurs écrasées), puis écrit avec `ifMatch` = l’`etag` lu (`BlobPreconditionFailedError` si quelqu’un a écrit entre-temps → on relit, on refusionne, quatre essais). La fusion est **commutative, associative et idempotente** : renvoyer deux fois, dans le désordre, après une coupure, ne duplique rien. L’état local est lui-même la file d’attente (un compteur « sale » par régate dans `rade.sync.v1`) ; aucune table d’opérations ne peut se désynchroniser de l’état. Une écriture = une opération « avancée » Vercel (2 000 par mois sur Hobby), une lecture = une opération « simple » (10 000) : **on n’utilise jamais `list()`** et on lit en conditionnel (`rev` à jour → réponse minuscule).

**Quatre risques à porter par le plan.** (1) *Plan Hobby* : au-delà des quotas Blob, « vous ne pourrez plus accéder à Vercel Blob » pendant 30 jours [CITED: vercel.com/docs/vercel-blob/usage-and-pricing] : écart minimal de 30 s entre essais, recul exponentiel, plafonds quotidiens et interrupteur de secours sont obligatoires. (2) *Aperçu qui écrit dans la production* : un même magasin est branché aux deux environnements (D-01) : tous les chemins sont préfixés `prod/` ou `preview/` d’après `VERCEL_ENV`. (3) *Auteur* : il vient du middleware (`next({ request: { headers } })` remplace l’en-tête du client) et la fonction **refuse** toute requête sans prénom ; le `by` du client est ignoré. (4) *Calendrier* : coupée comme D-02 l’autorise, **release A = données légères + recalages de bouées (v30, aperçu vers le 27, production avant le 30 octobre)** ; **release B = objets lourds** (vent figé du jour, traces, rapports : v31, seulement si A est verte au 28 octobre, sinon après la régate). A seule couvre les critères 1 à 3 du ROADMAP ; le critère 4 (« fiche, débrief et rapport » hors réseau) exige B.

**Primary recommendation :** `api/archive.js` à client Blob injectable + `js/archmerge.js` pur (LWW par élément, `u`/`ub` posés par `saveReg`) + `js/archsync.js` pur (déclencheurs, D-03, recul, compteurs « sale », application de la réponse) ; middleware : `x-rt-membre` pour `/api/` seulement ; étendre `tests/access.test.mjs` ; `@vercel/blob` épinglé **2.8.0** avec `checkpoint:human-verify` avant installation ; publier A sur l’aperçu, faire la recette à deux téléphones avec le vrai magasin, puis la production.

## Architectural Responsibility Map

Application sans serveur applicatif métier : « niveaux » = page, modules purs, stockage de l’appareil, middleware, fonction Vercel, Vercel Blob.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Marquage des modifications (`u`, `ub`, pierres tombales, ids de manches), compteurs « sale » | Page : `js/archmerge.js` (`stamp`) + `js/archsync.js` (`stampState`, `markDirty`) appelés par `saveReg` | `localStorage` `rade.sync.v1` | Toute écriture de régate passe déjà par `saveReg` (`js/app.js:65`) : un seul point à câbler, aucune édition dispersée |
| Fusion des deux états (D-04) | Module pur `js/archmerge.js`, **importé aussi par `api/archive.js`** | — | Une seule implémentation côté page et côté serveur : mêmes règles, mêmes tests |
| Autorité sur l’auteur | Middleware (`x-rt-membre`) puis `api/archive.js` | — | Seul le middleware connaît le membre ; le corps envoyé par le téléphone n’est pas une preuve |
| Stockage durable partagé | Vercel Blob **privé** (via `api/archive.js`) | — | D-01 ; jamais d’URL Blob côté page |
| Concurrence entre deux écritures | `api/archive.js` : lire → fusionner → `put(..., { ifMatch })` | SDK `@vercel/blob` (`BlobPreconditionFailedError`) | Contrôle optimiste fourni par le magasin [CITED: vercel.com/docs/vercel-blob#conditional-writes] |
| Déclenchement et interdiction en course (D-03) | Page : `canSync` pur, `raceActive` de `js/app.js` | `js/racelock.js` (`isActive`, `lockState`) | Le verrou existe déjà ; on ne le réécrit pas |
| Lecture hors réseau (ARCH-03) | IndexedDB locale : `rade-regates` (vent figé), `rade-traces` (traces et rapports), `localStorage` (index) | `js/regview.js` (inchangé) | Les lecteurs existants lisent déjà ces magasins : la synchronisation ne fait que les remplir |
| Indicateur « à jour / en attente / hors réseau » | Page : `syncStatus` pur | `js/journal.js` (`note`, `report`) | Discret, jamais rouge, jamais pendant une course |
| Recalages de bouées partagés (D-05) | Page : `rade.marks.v1` (`js/marks.js`) ↔ `marks` du document | `applyOverrides`, `restoreMark` | Même fusion LWW que le reste, clé = numéro de bouée |

## Standard Stack

### Core

| Élément | Version | Rôle | Pourquoi |
|---------|---------|------|----------|
| `@vercel/blob` | **2.8.0** (à épingler exactement) [VERIFIED: npm registry, `npm pack @vercel/blob@2.8.0` et `dist/index.d.ts` lus] | `get`, `put`, `head` du magasin **privé** depuis `api/archive.js` | SDK officiel Vercel ; stockage privé disponible « starting with `@vercel/blob` JS SDK >= 2.3 » [CITED: vercel.com/docs/vercel-blob/private-storage] ; `ifMatch`, `useCache`, `ifNoneMatch`, `BlobPreconditionFailedError` présents dans les types de 2.8.0 |
| `@vercel/functions` (déjà installé) | 3.10.1 [VERIFIED: `node_modules/@vercel/functions/package.json`] | `next({ request: { headers } })` du middleware | `ModifiedRequest.headers` : « If set, overwrites the incoming headers to the origin request. This is useful when you want to pass data between a Middleware and a Serverless or Edge Function. » [VERIFIED: `node_modules/@vercel/functions/middleware.d.ts`] ; exemple officiel pour « other » frameworks [CITED: vercel.com/docs/routing-middleware/api] |
| `node:test` + `linkedom` 0.18.13 (déjà là) | Node 22.22 ici, `engines` 24.x | Tests purs, API avec faux Blob, vues | Cadre en place, réseau interdit par `tests/helpers/setup.mjs` |
| IndexedDB `rade-regates` / `rade-traces` | — | Objets lourds locaux (versions B) | Réutilisés tels quels : `putSlot` / `getSlot` (`js/regstore.js`), `saveTrack` / `getTrack` (`js/track.js`) |
| Playwright 1.56.1 global + Chromium 1194 | [VERIFIED: `npm ls -g`, `/opt/pw-browsers`] | Scénario à deux contextes dans `tools/regate-e2e.mjs` (facultatif, hors `npm test`) | Déjà l’outil de phase 3 |

### Alternatives Considered

| Au lieu de | Alternative | Compromis |
|------------|-------------|-----------|
| SDK `@vercel/blob` | API REST de Blob par `fetch` (aucune dépendance) | Les en-têtes `x-if-match`, `x-allow-overwrite`, `x-api-version` sont des détails internes du SDK [VERIFIED: lus dans `dist/index.js` et `chunk-YYMLUMXS.js` du paquet 2.8.0], non documentés comme interface publique : **à éviter** ; le SDK est le chemin supporté, sa taille (≈ 0,9 Mo décompressé) ne pèse que sur la fonction |
| Un seul `light.json` | Un objet par régate + un index (`list()`) | `list()` est une opération avancée (2 000/mois sur Hobby) et sa cohérence après `put` n’est **pas documentée** (la page de cohérence de lecture ne parle que de `get`) ; un index à tenir à jour double les écritures et ajoute un point de contention. Seuil de bascule : `light.json` > 1,5 Mo → découper par saison (v2) |
| Fusion d’états (LWW par élément) | Journal d’opérations (outbox) rejoué sur le serveur | Un journal doit être ordonné, dédoublonné, purgé, et peut diverger de l’état ; l’état fusionné idempotent n’a rien de tout cela. Coût : 1 dépense de conception sur les éléments (ids stables) |
| `light.json` unique par environnement | Partition par saison | Inutile à l’échelle d’une équipe de trois (≈ 12 régates par an, ≈ 300 Ko par an) |
| Middleware qui transmet `x-rt-membre` | La fonction recalcule le membre depuis le cookie | Dupliquerait la table des empreintes (interdit : jamais copiées) ou la déplacerait dans un module partagé, c’est-à-dire toucher au cœur de la sécurité à une semaine d’une régate |

**Installation (exécution, avec le point de contrôle ci-dessous) :**

```bash
npm install --save-exact @vercel/blob@2.8.0
```

**Version verification :** `npm view @vercel/blob dist-tags` → `latest: '2.8.2'` (publiée le 2026-10-14, soit 6 jours avant cette recherche) ; `2.8.1` le 2026-10-06 ; `2.8.0` le 2026-08-10 [VERIFIED: `npm view @vercel/blob time`]. Les fonctions et options utilisées ici sont documentées pour la ligne 2.x [CITED: vercel.com/docs/vercel-blob/using-blob-sdk, dernière mise à jour 2026-08-26] et présentes dans les types de 2.8.0 [VERIFIED: `dist/index.d.ts` : `get`, `head`, `put`, `BlobPreconditionFailedError`, `useCache`, `ifNoneMatch`, `ifMatch`]. **Épingler 2.8.0** (plus de deux mois d’ancienneté, mêmes API) plutôt que `latest` ; la ligne `^` n’est pas utilisée.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@vercel/blob` | npm | 3 ans 6 mois (créé le 2023-04-18) | 5 110 953 / semaine | github.com/vercel/storage (`packages/blob`) | **SUS** (raison unique du seam : `too-new`, parce que le tag `latest` 2.8.2 date du 2026-10-14) | Approuvé en pratique (paquet officiel Vercel, publication avec provenance npm activée dans son `package.json`, licence Apache-2.0, **aucun `postinstall`** [VERIFIED: `npm view @vercel/blob@2.8.0 scripts.postinstall` vide], dépendances `undici`, `is-buffer`, `throttleit`, `async-retry`, `@vercel/oidc`, `is-node-process`) ; **le planificateur insère un `checkpoint:human-verify` avant l’installation** (comparer `package-lock.json` après `npm install --save-exact @vercel/blob@2.8.0` : une seule entrée `@vercel/blob` et ses six dépendances, intégrité renseignée) |

**Note sur le seam :** `gsd-tools query package-legitimacy check --ecosystem npm @vercel/blob@2.8.0` répond `SLOP / does-not-exist` parce que le suffixe `@2.8.0` n’est pas pris en charge comme version ; **c’est un faux positif de forme d’entrée** : `npm pack @vercel/blob@2.8.0` et `npm view @vercel/blob@2.8.0` réussissent (tarball de 913 630 octets décompressés). La vérification fait foi avec le nom seul (verdict SUS, `weeklyDownloads: 5110953`, `repoUrl: git+https://github.com/vercel/storage.git`).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@vercel/blob` (voir ci-dessus) — checkpoint avant installation.

*Aucun autre paquet n’est ajouté : `partysocket`, `idb`, `zod` ou une bibliothèque de CRDT ne sont **pas** nécessaires (la validation du corps est faite à la main, cinquante lignes).*

## Architecture Patterns

### System Architecture Diagram

```text
 TÉLÉPHONE (Romain, Teiva, Thibaud)                                   VERCEL
 ───────────────────────────────────                                  ──────
  action de l’équipier (créer, manche, valider IC, bouée, rattacher…)
        │
        ▼
  saveReg(next) ──► stampState(prev, next) : u/ub sur ce qui a changé, pierres tombales, ids de manches
        │              └► markDirty(rade.sync.v1, [ids, '~tomb', '~marks'])  ──► localStorage rade.regates.v1 (inchangé)
        ▼
  déclencheurs : ouverture (après rt:map +3 s) · retour du réseau · +20 s après une modif · fin de course · bouton « Synchroniser »
        │   canSync(): course ? réseau ? ≥ 30 s ? recul ? plafond du jour ?   (D-03 : raceActive() interdit tout)
        ▼
  runSync ──PUT /api/archive?k=light { doc : régates sales + pierres tombales + recalages }──►  middleware : code d’accès valide ?
        │                                                                                        non → 401 (rien n’est lu)
        │                                                                                        oui → x-rt-membre := prénom (remplace celui du client)
        │                                                                                              │
        │                                                                                              ▼
        │                                                                                    api/archive.js (client Blob injectable)
        │                                                                                    cleanDoc(): ids, tailles, clés refusées, dates futures
        │                                                                                    attribute(): by/ub := prénom pour ce qui est nouveau ou différent
        │                                                                                    mutateLight(): get(useCache:false) → mergeDoc → put(ifMatch)
        │                                                                                         412 ? relire et refusionner (4 essais)   │
        │                                                                                    ┌────────────────────────────────────────────┘
        │                                                                                    ▼
        │                                                                          Vercel Blob PRIVÉ  prod/light.json  ·  prod/trash/…
        │                                                                                         prod/day/<régate>/<jour>/<équipier>.json   (B)
        │                                                                                         prod/trace/<id>.json · prod/report/<id>-<t>.json (B)
        ◄── { rev, doc fusionné } ──────────────────────────────────────────────────────────────────┘
        ▼
  applyDoc(): refusionne avec l’état d’AUJOURD’HUI (pas celui d’avant l’échange), renumérote les manches,
              garde sel/current locaux, pose les recalages (applyOverrides), efface les compteurs « sale » inchangés
        ▼
  [B] files lourdes : envoyer ce qui manque en ligne (jour figé, trace, rapport) · télécharger ce qui manque ici (horizon 180 j)
        ▼
  lecture : fiche, débrief, rapport = IndexedDB locale  →  identique en mode avion (ARCH-03)
```

### Recommended Project Structure

```text
js/
├── archmerge.js     # fusion LWW par éléments, stamp, toShared / fromShared (pur ; importé AUSSI par api/archive.js)
├── archsync.js      # canSync, syncStatus, stampState, buildDoc, applyDoc, markDirty, runSync (pur, tout injecté)
├── archheavy.js     # [B] files lourdes : quoi envoyer, quoi télécharger (horizon, budget), objets jour / trace / rapport
├── app.js           # câblage seulement : saveReg, déclencheurs, indicateur, recalages, application de la réponse
├── regview.js       # indicateur dans l’onglet Régates, historique de la fiche (lecture seule)
├── track.js         # fromGPX : id déterministe ; listTracks : curseur au lieu de getAll
└── regates.js       # graine SNPM à dates fixes (deux lignes)
api/
├── archive.js       # GET|PUT /api/archive?k=light|trace|report|day ; createHandler({ blob, now }) exporté pour les tests
└── (aucun autre fichier : la logique de fusion est dans js/archmerge.js)
middleware.js        # + en-tête x-rt-membre pour /api/ seulement
vercel.json          # + "api/archive.js": { "maxDuration": 30 } (+ includeFiles de js/archmerge.js par précaution)
tests/               # archmerge, apiarchive, archsync, [archheavy] ; access.test.mjs complété ; boot.test.mjs complété
tools/regate-e2e.mjs # + scénarios « archive » (deux contextes) et [B] « archivehors » (mode avion)
```

### Pattern 1 : un document léger partagé, des objets lourds immuables

**Mise en page du magasin** (tous les chemins commencent par `prod/` ou `preview/` selon `VERCEL_ENV`, jamais par une valeur du client) :

| Chemin | Contenu | Écrit par | Mutable ? | Taille mesurée / estimée |
|--------|---------|-----------|-----------|--------------------------|
| `<env>/light.json` | `{ v:1, regattas:{ id: R }, tomb:{ 'regatta:id': {t,by} }, marks:{ 'numéro': {lat,lon,src,t,by,h?} } }` | `api/archive.js` seulement (fusion) | oui, `ifMatch` | régate de la Coupe SNPM semée : **2 478 octets** [VERIFIED: `migrate()` exécuté ici] ; avec le texte des IC (**11 476** caractères pour les IC SNPM [CITED: 03-RESEARCH.md]) ≈ 14 Ko ; 3 jours de gel (résumé + route : ≈ 5 Ko par jour) ≈ 30 Ko au plus. **12 régates par an ≈ 300 Ko** |
| `<env>/trash/<id>-<t>-<suffixe>.json` | la régate supprimée, telle qu’elle était | `api/archive.js` à la suppression | non | quelques Ko, rarissime |
| `<env>/day/<régate>/<AAAA-MM-JJ>/<équipier>.json` [B] | `{ wx, strat, obs }` du jour (copie des trois entrées `slotKey`) | l’équipier (une seule main par clé) | oui (réécrit à chaque gel) | prévisions d’un jour **38 803 o** + route 9-12 Ko + relevés [CITED: 03-RESEARCH.md, mesures] ≈ 55 Ko |
| `<env>/trace/<id>.json` [B] | `{ …trace sans report }` | l’équipier propriétaire | non (immuable) | **612 629 o** pour la trace SNPM réelle (9 538 points, flottants complets de l’import) ; gzip 172 671 o ; en deltas entiers + gzip 23 123 o [VERIFIED: mesuré ici] |
| `<env>/report/<id>-<t>.json` [B] | `{ html, t, name }` | l’équipier | non (une version par `t`) | rapport SNPM écrit à la main : **250 285 o** (`rapports/coupe-snpm-2026.html`, un JPEG en base64 + 3 `<svg>`) ; le rapport généré embarque lui aussi un fond de carte (`map.url`, `js/debrief.js:381`) : même ordre de grandeur [ASSUMED] |

**Pourquoi un seul document léger.** Une lecture = 1 opération simple, une synchronisation avec modification = 1 écriture avancée, quel que soit le nombre de régates. L’index par `list()` coûterait une opération avancée par ouverture de l’app. Les objets lourds sont **immuables ou à écrivain unique**, donc sans conflit ; leur chemin ne contient que des identifiants validés (`/^[A-Za-z0-9._-]{1,80}$/`, jour `AAAA-MM-JJ`, `t` entier).

**Forme d’une régate partagée** = la régate de la phase 3 (`js/regates.js`) moins l’état propre à l’appareil (`sel`) et moins le rang des manches (`n`, déduit de l’ordre), plus des **métadonnées par élément** : `u` (instant de la dernière modification, ms), `ub` (qui l’a modifié) ; `by` (créateur) existe déjà ; au niveau de la régate : `tomb` (suppressions d’éléments), `hist` (valeurs écrasées, 30 au plus).

### Pattern 2 : fusion par éléments « dernier écrit gagne » (D-04)

| Élément | Identifiant | Règle de fusion | Écrasé → historique |
|---------|-------------|-----------------|---------------------|
| Fiche (`name`, `club`, `dateStart`, `dateEnd`, `season`, `ic`) | id de la régate | un seul bloc, `u` le plus récent gagne (la validation des IC modifie tout le bloc : `applyReview`, `js/icread.js:159-175`) | oui (le texte des IC > 4 000 octets n’est pas recopié) |
| Manche | `m<AAAAMMJJ><HHMM>` (jour + heure), sinon aléatoire | union par id ; immuable après création ; suppression = pierre tombale | — |
| Bouée d’autre club, parcours | id existant (`X1`…, numérique ≥ 100) | union par id, `u` le plus récent gagne (confirmer, corriger) | oui |
| Gel d’un jour (`frozen[jour]`) | le jour | une copie **tardive** (`late`) ne remplace jamais une copie prise avant le signal ; ensuite `u` le plus récent | non (les objets lourds restent un par équipier) |
| Référence de trace | id de la trace | union par id ; `report` : le plus grand `t` gagne quel que soit `u` | oui |
| Régate supprimée | id | pierre tombale **définitive** sur tous les téléphones ; copie dans `trash/` | — |
| Recalage de bouée (D-05) | numéro de bouée | `t` le plus récent gagne, suppression comprise (« Position d’origine » = `{ del:true, t }`), 5 versions gardées | oui (`h`) |

Une suppression l’emporte sur un élément dont le dernier changement lui est antérieur ou égal ; un élément recréé ou modifié **après** la suppression revient. Les égalités sont départagées de façon déterministe (contenu, puis auteur présent, puis auteur) : **la fusion est commutative** [VERIFIED: test de 4 000 scénarios].

### Pattern 3 : marquage au point d’entrée unique `saveReg`

`js/app.js:65` : `function saveReg(next) {` est le seul chemin d’écriture de `REG` (création, manche, validation des IC, bouée, gel, rattachement, rapport, suppression, auteur complété). Le plan remplace son début par : `stampState(REG, next, { now: Date.now(), by: who() })` (qui ne compare que les régates dont l’objet a changé : `upsertRegatta` conserve l’identité des autres), puis `markDirty(syncMeta, changed)`, puis la planification d’une synchronisation (+20 s). Un appel `saveReg(next, { fromSync: true })` (application de la réponse du serveur) saute le marquage. Aucun site d’appel ne change. `sel` (manche choisie) et `current` restent locaux : `toShared` retire `sel`, `fromShared` le remet en suivant la manche par son id.

### Pattern 4 : écriture serveur « lire → fusionner → écrire avec `ifMatch` »

`mutateLight` (voir *Code Examples*) : `get(path, { access:'private', useCache:false })` → `etag` ; fusion ; si rien ne change, **aucune écriture** ; sinon `put(path, texte, { access:'private', allowOverwrite:true, ifMatch:etag })`. Une création utilise `put` **sans** `allowOverwrite` (échoue si un autre l’a créé entre-temps) puis relit. `BlobPreconditionFailedError` → on recommence (quatre essais), puis 409. `useCache:false` est indispensable : sans lui une lecture peut renvoyer l’ancienne version « for up to 60 seconds » [CITED: vercel.com/docs/vercel-blob/private-storage#consistent-reads]. Test : deux écritures simultanées (porte qui retient les deux premières lectures) gardent **les deux** ajouts [VERIFIED: prototype].

### Pattern 5 : l’auteur vient du middleware

Après vérification du code, pour les chemins `/api/` seulement : `const h = new Headers(req.headers); h.set('x-rt-membre', prenom); return next({ request: { headers: h } });`. Les en-têtes fournis par le navigateur sont **remplacés** (le jeu d’en-têtes passé écrase celui de la requête [VERIFIED: `node_modules/@vercel/functions/middleware.js`, `handleMiddlewareField` pose `x-middleware-override-headers` = toutes les clés]). `api/archive.js` répond **403 `membre_inconnu`** sans prénom valide (`/^[\p{L}\p{M} '’-]{1,40}$/u`) : fermé par défaut. Le serveur pose `by` / `ub` sur tout ce qui est **nouveau ou différent** de ce qui est stocké ; le `by` du client est ignoré. Limite honnête : c’est une étiquette de confiance entre trois équipiers, pas une signature cryptographique (SECU2-02 reste différé).

### Pattern 6 : politique de synchronisation (D-03, quotas)

- **Interdit** si `raceActive(now)` (chrono, mode départ, trace, GPS de course : `js/app.js:757`) — littéralement D-03 ; vérifié **avant** l’envoi et **après** la réponse (réponse jetée si une course a commencé pendant l’échange ; l’état « sale » reste). Les objets lourds ajoutent `lockState().locked` (journée de régate entre 9 h et le retour au port) : lourd = après la course.
- **Déclencheurs** : (1) ouverture, `rt:map` + 3 s (jamais avant `rt:ui`, `tests/boot.test.mjs` refuse tout `await` avant la marque) ; (2) événement `online` (`js/app.js:131`) et passage de `net.online` à vrai dans `probeNet` (`js/app.js:1049`) ; (3) 20 s après une modification locale ; (4) `raceTick` (5 s) constate que le verrou de course vient de tomber → +60 s ; (5) retour de l’onglet au premier plan (≥ 5 min depuis le dernier succès) ; (6) bouton « Synchroniser » (geste).
- **Freins** : 30 s au moins entre deux essais ; après échec, recul 30 s · 2 min · 10 min · 30 min [VERIFIED: `canSync` du prototype] ; plafonds quotidiens côté page (écritures ≤ 40, lectures ≤ 150 : **à écrire, non prototypés**) ; réponse 401 (cookie périmé) : aucune nouvelle tentative, texte « Code d’accès à renouveler » (même lecture que celle de `api/ic.js` côté page) ; 429 de la fonction (limite Blob) → recul maximal ; interrupteur `meta.off` (réglage « Désactiver la synchronisation ») ; `meta.absent` quand la fonction répond `503 no_blob` (archive non configurée : l’app reste comme en phase 3).
- **Lecture conditionnelle** : sans modification locale, `GET ?k=light&rev=<etag>` ; réponse `{ unchanged: true }` sans corps de document.

### Pattern 7 : recalages de bouées partagés (D-05)

`rade.marks.v1` (`OV_KEY`, `js/marks.js:6`) contient `{ [numéro]: { lat, lon, src, t } }`. Le document partagé porte la même forme plus `by` (posé par le serveur) et `h` (versions écrasées). `recalMark` (`js/app.js:1682`) et `resetMark` (`js/app.js:1689`) appellent `markDirty(meta, ['~marks'])` ; `resetMark` ajoute `meta.marksDel[k] = Date.now()` (envoyé comme `{ del:true, t }` tant qu’il n’est pas acquitté). À la réception : pour chaque clé fusionnée différente du local, `saveOverride` + `applyOverrides(MARKS, …)` (ou `clearOverride` + `restoreMark` pour une suppression), puis `refreshMarks()` ; **un toast « Bouée 3 recalée par Teiva (saisie du 21/10) »** prévient l’équipier (le routage change). Hors course seulement (garde `isActive` après l’échange).

### Pattern 8 : objets lourds, horizon et budget (version B)

- **Envoi** (à écrivain unique) : pour chaque `frozen[jour]` dont `by` est moi et dont le `u` a changé depuis le dernier envoi (`meta.up['day:<régate>|<jour>']`) → `PUT k=day` ; pour chaque référence de trace rattachée dont la trace est locale et non envoyée → `PUT k=trace` (le serveur fait `head` d’abord : déjà présente = aucune écriture) ; pour chaque `report.t` local non envoyé → `PUT k=report`. Au plus 6 objets par passage, entre deux objets on revérifie `isActive()`.
- **Réception** : pour les régates dont `dateStart` ≥ aujourd’hui − 180 jours (et toutes celles à venir) : jour figé dont le gagnant n’est pas moi et dont `by@u` diffère de `meta.down[…]` → `GET k=day&by=<équipier>` puis `putSlot` des trois entrées **aux clés existantes** `slotKey(...)` ; trace absente de `rade-traces` → `GET k=trace` puis `saveTrack` ; rapport dont le `t` local diffère → `GET k=report` puis ajout à la trace locale. Les lecteurs de phase 3 (`getSlot`, `getTrack`) lisent alors sans changement.
- **Budget** : régate typique ≈ 1 Mo (une trace 0,6-1,5 Mo, un rapport 0,25 Mo, 55 Ko par jour) ; saison de 6 mois ≈ 30-40 Mo ; garde `navigator.storage.estimate()` (arrêt des téléchargements au-delà de 60 % du quota) ; `navigator.storage.persist()` demandé une fois après la première synchronisation. Quota d’iOS : depuis Safari 17 il dépend de l’espace disque ; une app installée sur l’écran d’accueil échappe au plafond de 7 jours d’ITP [CITED: webkit.org/tracking-prevention ; webkit.org/blog/14445].
- Les régates plus anciennes restent **lisibles en version légère** (fiche, résumés) ; bouton « Télécharger pour le hors réseau » sur leur fiche (geste).

### Pattern 9 : indicateur d’état

`syncStatus` (pur) : « Pas encore synchronisé » · « À jour » · « Synchronisation… » · « En attente d’envoi » · « Hors réseau · 2 modifications en attente » · « Synchronisation à relancer » (après échec) · « En pause pendant la course » · « Synchronisation désactivée » · « Archive non configurée ». Placé en une ligne discrète en tête de l’onglet Régates (`textContent`), niveau `ok` / `warn` / `off`, **jamais rouge**. Sur l’aperçu, le texte ajoute « (essai) » (le serveur renvoie `env`). Journal : `note('archive', …)` aux transitions (première réussite, nombre d’éléments fusionnés, conflits résolus), `report('archive', err)` pour les échecs ; jamais le contenu des régates ni le prénom dans un message d’erreur.

### Anti-Patterns to Avoid

- **Une file d’opérations séparée de l’état** : elle diverge (opération rejouée deux fois, opération perdue, purge). L’état marqué + fusion idempotente suffit.
- **`list()` pour trouver les régates** : opération avancée comptée, cohérence non documentée. Un document unique, lu par chemin connu.
- **Faire confiance au `by` du corps** ou à un en-tête lu sans que le middleware l’ait posé : la fonction est fermée par défaut.
- **Appliquer la réponse du serveur pendant une course ou pendant une saisie** (IC en relecture, fenêtre ouverte) : réponse jetée / reportée, elle reviendra.
- **Écrire dans le magasin sans préfixe d’environnement** : l’aperçu pollue la production (même magasin).
- **Un `access: 'public'`, une URL `*.blob.vercel-storage.com` ou un jeton dans le code de la page** : gardes statiques dans les tests.
- **Stocker le rang `n` d’une manche comme contenu** : chaque ajout « modifierait » toutes les manches suivantes (conflits et historique parasites). Le rang est déduit de l’ordre (`fromShared`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contrôle de concurrence sur le document partagé | Verrou maison, compteur de version, fichier « lock » | `put(..., { allowOverwrite:true, ifMatch })` + `BlobPreconditionFailedError` | Fourni par le magasin ; testé par le faux Blob avec le même contrat |
| Lecture fraîche après écriture | Attente de 60 s, rustines de cache | `get(..., { useCache:false })` | Garanti par la documentation |
| Lecture conditionnelle | Hachage du document, comparaison de dates | `ifNoneMatch` du SDK (code 304) exposé en `{ unchanged:true, rev }` | Économise la bande passante et reste une seule opération simple |
| Identité de l’équipier | Cookie lisible, jeton maison, table dupliquée | `next({ request: { headers } })` du middleware existant | Le middleware connaît déjà le membre |
| Jour et heure de Paris | `getHours()` | `parisClock` de `js/racelock.js` (déjà utilisé par `gel.js`) | Heure d’été, téléphone dans un autre fuseau |
| Détection « réseau » | `navigator.onLine` seul | `net.online` et `probeNet` de `js/app.js:1044-1049` (HEAD réel) | `onLine` n’est qu’un indice |
| Écriture des objets lourds locaux | Nouveau magasin | `putSlot` / `getSlot` (`js/regstore.js`), `saveTrack` / `getTrack` (`js/track.js`) | Les lecteurs existants les lisent déjà |
| Validation de forme | Bibliothèque de schémas | `cleanDoc` (cinquante lignes) : ids par expression régulière, tailles, listes, clés refusées | Aucune dépendance, tests directs |
| Fusion de textes (IC, notes) | Algorithme de fusion de texte | Élément entier, le plus récent gagne, l’autre dans `hist` | D-04 ; pas d’édition collaborative |

**Key insight :** la valeur de la phase est dans la **preuve de non-perte** (union des ajouts, pierres tombales, historique des écrasements, idempotence testée sur des milliers de scénarios) et dans la **sobriété d’usage du quota Blob**, pas dans un nouvel algorithme.

## Runtime State Inventory

La phase **ajoute** des champs aux régates déjà stockées (`u`, `ub`, `id` de manche, `tomb`, `hist`) et partage pour la première fois des données qui n’existaient que sur un téléphone : inventaire explicite.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `rade.regates.v1` (`export const KEY = 'rade.regates.v1';`, `js/regates.js:8`) : index des régates, forme `{ v:1, current, list }` ; `rade.marks.v1` (`export const OV_KEY = 'rade.marks.v1';`, `js/marks.js:6`) ; IndexedDB `rade-regates` (`const DB = 'rade-regates', ST = 'slots';`, `js/regstore.js:5`) ; IndexedDB `rade-traces` (`const DB = 'rade-traces', ST = 'tracks';`, `js/track.js:7`) ; `rade.events.v1` (ancienne clé, jamais modifiée) | **Migration de données douce** : `stampState` ajoute `u`/`ub` à la première modification, `ensureIds` pose les ids de manches à la première sauvegarde ; **première synchronisation = tout l’index envoyé** (`meta.first` absent) ; copie de secours `rade.regates.v1.bak` écrite **une fois** avant la première fusion appliquée ; **code** : graine SNPM à dates fixes (voir Pitfall 7), `fromGPX` à id déterministe |
| Live service config | **Magasin Blob privé à créer par Romain** (le mode d’accès ne peut pas être changé après création [CITED: vercel.com/docs/vercel-blob]), branché au projet pour **Production et Aperçu** ; vérifier la présence de `BLOB_READ_WRITE_TOKEN` (et `BLOB_STORE_ID` + OIDC, que le SDK préfère s’ils sont présents) dans les deux environnements ; case « Enable access to System Environment Variables » pour `VERCEL_ENV` [CITED: vercel.com/docs/environment-variables/system-environment-variables] ; région du magasin (choix de Romain, aucune incidence fonctionnelle) | **Point de contrôle humain** avant l’aperçu |
| OS-registered state | Aucun (application web ; service worker : `/api/` n’est pas intercepté, `sw.js:25` : `if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;`) | Aucune |
| Secrets/env vars | `BLOB_READ_WRITE_TOKEN` (secret Vercel, jamais lu par la page) ; `OPENAI_API_KEY` inchangée ; table `EQUIPAGE` de `middleware.js` : lue seulement pour le prénom, **jamais copiée** | Aucune copie ; le test lit l’empreinte à l’exécution sans l’afficher |
| Build artifacts | `sw.js` (bloc `stamp`) et `js/version.js` : le SHELL doit contenir `js/archmerge.js`, `js/archsync.js` (et `js/archheavy.js`) ; `package.json` / `package-lock.json` (nouvelle dépendance) | `npm run stamp` après chaque lot ; `npm run release -- "…"` pour v30 (puis v31) |

**La question canonique :** après mise à jour du code, que contiennent encore les téléphones ? → des régates **sans** `u`/`ub` (acceptées : `u` manquant vaut 0, toute modification réelle gagne), un `rade.events.v1` ignoré, et le magasin en ligne **vide** (créé par la première synchronisation d’un téléphone).

## Common Pitfalls

### Pitfall 1 : épuiser les quotas Blob du plan Hobby
**What goes wrong:** après une boucle de synchronisation ou un trop grand nombre d’opérations, Blob devient inaccessible 30 jours : l’archive tombe après la régate.
**Why it happens:** Hobby = 1 Go de stockage, **10 000 opérations simples**, **2 000 opérations avancées** (écriture, copie, `list`), 10 Go de transfert par mois ; « you will not be able to access Vercel Blob if limits are exceeded … wait until 30 days have passed » ; limites de débit 20 simples/s et 15 avancées/s ; **parcourir le magasin dans le tableau de bord compte aussi** [CITED: vercel.com/docs/vercel-blob/usage-and-pricing ; vercel.com/docs/vercel-blob].
**How to avoid:** pas de `list()` ; une écriture seulement si le document change ; 30 s minimum entre essais, recul exponentiel, plafonds quotidiens, interrupteur ; lecture conditionnelle ; `head` avant l’écriture d’un objet immuable. Estimation d’un mois très actif : ≈ 450 écritures légères + ≈ 200 écritures lourdes (≪ 2 000) et ≈ 900 lectures + ≈ 300 lectures lourdes (≪ 10 000) [ASSUMED : trois équipiers, 10 synchronisations par jour].
**Warning signs:** 429 de la fonction, compteur d’opérations (tableau de bord › Observability › Blob) au-delà de 30 % du quota en une semaine.

### Pitfall 2 : l’aperçu écrit dans le magasin de la production
**What goes wrong:** les essais de Romain sur l’aperçu apparaissent chez les trois équipiers (ou l’inverse).
**Why it happens:** D-01 branche **un** magasin à Production **et** Aperçu.
**How to avoid:** préfixe `prod/` si `VERCEL_ENV === 'production'`, sinon `preview/` ; la réponse de la fonction contient `env` ; l’indicateur affiche « (essai) » hors production ; contrôle humain : `preview/light.json` apparaît dans le magasin après le premier essai, `prod/light.json` seulement après la production. Si `VERCEL_ENV` n’est pas défini (case des variables système décochée), tout va dans `preview/` : **cohérent** entre les téléphones mais sans isolation → le contrôle humain le détecte.

### Pitfall 3 : lecture périmée après une écriture d’un autre téléphone
**What goes wrong:** Teiva écrit, Thibaud relit et ne voit rien pendant une minute ; la fusion de Thibaud repart d’une version périmée.
**Why it happens:** les lectures passent par le cache CDN : jusqu’à 60 s de retard pour un blob écrasé.
**How to avoid:** `get(..., { useCache:false })` pour le document léger et les jours figés ; le cache reste actif pour les objets immuables (trace, rapport).

### Pitfall 4 : deux écritures simultanées
**What goes wrong:** la seconde écrase la première (ajout perdu).
**Why it happens:** lire-modifier-écrire sans précondition.
**How to avoid:** `ifMatch` + relecture + refusion (4 essais) ; création sans `allowOverwrite`. Testé avec un faux Blob qui implémente le contrat (`etag`, `ifMatch`, existence).

### Pitfall 5 : un `by` falsifié
**What goes wrong:** un téléphone (ou un bogue) écrit « Romain » à la place de « Teiva ».
**Why it happens:** l’auteur était une étiquette posée par la page (phase 3).
**How to avoid:** le serveur ignore le `by` du corps (`attribute`) ; l’en-tête vient du middleware et remplace celui du client (test avec un en-tête usurpé) ; fonction fermée par défaut (403).

### Pitfall 6 : le rang des manches et `sel`
**What goes wrong:** ajouter une manche en tête « modifie » toutes les suivantes (leur `n` change) ; `sel` pointe sur une autre manche après une fusion.
**Why it happens:** `n` est positionnel (`addRace` renumérote, `js/regates.js`), `sel` est un rang.
**How to avoid:** `n` exclu du contenu comparé et de l’envoi (`toShared`), recalculé par `fromShared` (même ordre que `raceOrder`), `sel` suit sa manche par id [VERIFIED: test du prototype]. Identifiant d’une manche = jour + heure (`applyReview` ignore déjà une manche de même jour et même heure, `js/icread.js:176-181` : deux téléphones qui ajoutent la même manche la fusionnent au lieu de la dupliquer).

### Pitfall 7 : la graine « Coupe SNPM » diffère d’un téléphone à l’autre
**What goes wrong:** la première synchronisation de trois téléphones écrit une ligne d’historique pour `snpm-2026` (les contenus diffèrent par des dates).
**Why it happens:** `migrate()` sème `[{ id: 'snpm-2026', ...SNPM, source: 'IC fournies (PDF)' }]` (`js/regates.js:74`) et `fromEvent(e, now, by)` pose `at: now` et `validated: { by, at: now }` : l’instant de l’installation de chaque téléphone.
**How to avoid:** pour `id === 'snpm-2026'`, utiliser des dates fixes (`at: 0`, `validated.at: 0`) dans `fromEvent` (deux lignes + un test) ; l’identifiant est déjà déterministe. Les autres fiches reprises de `rade.events.v1` gardent leur id local (`ev.id`) : des régates importées séparément sur deux téléphones restent **deux** régates (ARCH2-01 reporté) ; la suppression d’un doublon se propage par pierre tombale.

### Pitfall 8 : le même GPX importé sur deux téléphones donne deux traces
**What goes wrong:** deux références, deux téléphones, deux fois 600 Ko.
**Why it happens:** `return { id: 'tr' + pts[0][0] + Math.round(Math.random() * 1000), …` (`js/track.js:137`).
**How to avoid:** id déterministe `'tr' + pts[0][0] + '-' + pts.length` pour les **nouveaux** imports (même contenu = même id = même élément) ; les traces existantes gardent leur id (les enregistrements de l’app, `'tr' + now`, sont propres à un téléphone). Un doublon résiduel est visible dans la fiche et se détache à la main.

### Pitfall 9 : `listTracks()` charge toutes les traces en mémoire
**What goes wrong:** avec des traces partagées de trois téléphones, ouvrir « Mes traces » charge des dizaines de Mo.
**Why it happens:** `const all = await tx('readonly', (s) => s.getAll());` (`js/track.js:23`) désérialise chaque trace entière pour n’en lire que quatre champs.
**How to avoid:** liste par curseur (un enregistrement à la fois, résumé conservé) — modification de 10 lignes de `track.js` (version B, avant le premier téléchargement de trace).

### Pitfall 10 : appliquer une réponse au mauvais moment
**What goes wrong:** un recalage de bouée change le routage au milieu d’un départ ; une relecture d’IC en cours disparaît.
**Why it happens:** la réponse arrive après le début d’une course, ou pendant `icDraft`.
**How to avoid:** `isActive()` revérifié après l’échange (réponse jetée, compteurs conservés) ; application différée si `icBusy()` ou une fenêtre est ouverte ; `applyDoc` est synchrone (aucun `await` entre `getState` et `setState`) et part de l’état d’aujourd’hui.

### Pitfall 11 : horloges des téléphones et dates futures
**What goes wrong:** un téléphone réglé dans le futur gagne tous les conflits.
**Why it happens:** `u` vient de `Date.now()`.
**How to avoid:** le serveur ramène tout `u` > maintenant + 5 min à l’heure du serveur ; le décalage normal entre iPhone (secondes) est sans effet sur un conflit entre humains.

### Pitfall 12 : clés dynamiques et pollution de prototype
**What goes wrong:** une clé `__proto__` dans `frozen`, `tomb`, `marks` ou `regattas` modifie `Object.prototype`.
**Why it happens:** fusion d’objets à clés issues de JSON.
**How to avoid:** liste de refus (`__proto__`, `constructor`, `prototype`) dans `cleanDoc` et dans chaque boucle de fusion, ids par expression régulière, `Object.create(null)` pour les tables de pierres tombales [VERIFIED: test du prototype, `{}.polluted === undefined`].

### Pitfall 13 : corps trop gros
**What goes wrong:** 413 `FUNCTION_PAYLOAD_TOO_LARGE`.
**Why it happens:** « The maximum payload size for the request body or the response body of a Vercel Function is 4.5 MB » [CITED: vercel.com/docs/functions/limitations].
**How to avoid:** bornes explicites et messages français (`light` 3,5 Mo, trace 4 Mo, rapport 3 Mo, jour 0,6 Mo, régate 150 Ko) ; la trace SNPM (613 Ko) tient largement ; au-delà de 3 Mo, compresser avec `CompressionStream('gzip')` (À faire seulement si le cas se présente : 173 Ko pour la trace SNPM) ; `light.json` > 1,5 Mo → découpage par saison (v2).

### Pitfall 14 : le magasin local est plein ou purgé
**What goes wrong:** téléchargement lourd refusé (quota) ; données locales effacées par iOS (Safari non installé, 7 jours).
**Why it happens:** quota et politique ITP.
**How to avoid:** `try/catch` autour de chaque écriture, arrêt des téléchargements au premier échec (`report('archive', e)`), garde `estimate()` ; les trois équipiers ont l’app installée (exemptée d’ITP [CITED: webkit.org/tracking-prevention]) ; **le serveur garde tout** : une purge locale se répare à la synchronisation suivante.

### Pitfall 15 : la fonction n’embarque pas `js/archmerge.js`
**What goes wrong:** `ERR_MODULE_NOT_FOUND` en production.
**Why it happens:** `api/archive.js` importe `../js/archmerge.js`, hors du dossier `api/` ; le traçage des fichiers de Vercel doit suivre l’import statique.
**How to avoid:** les tests importent le même chemin ; par précaution `functions["api/archive.js"].includeFiles = "js/archmerge.js"` dans `vercel.json` [CITED: vercel.com/docs/functions/limitations : « You can use `includeFiles` and `excludeFiles` to specify items which may affect the function size »] ; **contrôle humain sur l’aperçu** (première requête = 200, pas 500).

### Pitfall 16 : `await` ou import lourd dans `init()` avant `rt:ui`
**What goes wrong:** l’ouverture repasse au-dessus de 2 s.
**Why it happens:** import statique de `archsync.js` ou premier `fetch` placé avant la marque.
**How to avoid:** `archmerge.js` (petit, nécessaire à `saveReg`) en import statique ; `archsync.js` en `import()` dynamique après `rt:map` + 3 s ; `tests/boot.test.mjs` complété (aucun `await` avant `performance.mark('rt:ui')`, aucune requête `/api/archive` avant `rt:map`) ; mesure `tools/measure-boot.mjs` refaite en fin de phase.

### Pitfall 17 : version de format plus récente que l’app
**What goes wrong:** un téléphone non mis à jour fusionne un document d’une version plus récente et le dégrade.
**Why it happens:** les mises à jour sont différées sur geste (phase 1).
**How to avoid:** `doc.v` ; si `doc.v > 1` la page arrête de synchroniser (« Mettez l’app à jour ») et ne touche à rien ; le serveur refuse un corps `v` inconnu (400).

### Pitfall 18 : supprimer une régate par erreur
**What goes wrong:** la suppression est définitive pour tous.
**Why it happens:** pierre tombale de régate sans retour.
**How to avoid:** deux confirmations déjà présentes (`js/app.js:1856`) ; le serveur écrit la régate dans `<env>/trash/` avant de la retirer (restauration manuelle par Romain depuis le tableau de bord ; interface de restauration = hors périmètre).

## Code Examples

Les trois fichiers suivants sont **ceux des prototypes exécutés ici** (29 tests verts). `js/archmerge.js` est importé par la page **et** par `api/archive.js`.

### `js/archmerge.js` (fusion, marquage ; pur)

```javascript
// Archive partagée : fusion des régates entre téléphones (ARCH-01, D-04). Module pur : aucun DOM, aucun stockage, aucune horloge (now injecté).
// Principe : ensemble d’éléments à « dernier écrit gagne » (LWW). Chaque élément a un id et une date de dernière modification `u` (ms) ;
// les ajouts des deux côtés sont tous gardés, une suppression est une pierre tombale `tomb`, et pour une même valeur modifiée des deux côtés
// la plus récente gagne : l’autre va dans `hist` (historique de la fiche). La fusion est commutative, associative et idempotente.

export const MAX_HIST = 30, MAX_HIST_BYTES = 4000;
export const HEAD = ['name', 'club', 'dateStart', 'dateEnd', 'season', 'ic'];      // « fiche » : modifiée d’un bloc par la validation des IC
export const LISTS = { race: 'races', mark: 'marks', course: 'courses', trace: 'traces' };
export const LOCAL_ONLY = ['sel'];                                                 // état d’affichage de CET appareil : jamais partagé
const DANGER = new Set(['__proto__', 'constructor', 'prototype']);                // clés refusées partout (pollution de prototype)

const sorted = (o) => (Array.isArray(o) ? o.map(sorted) : o && typeof o === 'object'
  ? Object.fromEntries(Object.keys(o).filter((k) => !DANGER.has(k)).sort().map((k) => [k, sorted(o[k])])) : o);
export const canon = (o) => JSON.stringify(sorted(o));
const body = (e) => { const { u, ub, by, ...rest } = e || {}; return rest; };       // contenu d’un élément sans ses métadonnées (date, modifié par, créé par : posées par le serveur)
export const sameBody = (a, b) => canon(body(a)) === canon(body(b));
// > 0 si `a` gagne : la plus récente, à égalité le contenu le plus grand (arbitraire mais identique sur tous les appareils)
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
export const wins = (a, b) => ((a?.u || 0) - (b?.u || 0)) || cmp(canon(body(a)), canon(body(b)))
  || ((a?.by != null) - (b?.by != null)) || cmp(String(a?.by), String(b?.by)) || cmp(String(a?.ub), String(b?.ub));   // à contenu égal : celui qui a un auteur (posé par le serveur)

const hist = (kind, id, e) => {
  let v = body(e); if (canon(v).length > MAX_HIST_BYTES) v = null;                  // gros contenu (texte des IC) : seule la trace de l’écrasement reste
  return { kind, id: String(id), t: e.u || 0, by: e.ub ?? null, v };
};
const mergeTomb = (a = {}, b = {}) => {
  const out = Object.create(null);
  for (const src of [a, b]) for (const [k, v] of Object.entries(src)) if (!DANGER.has(k) && (!out[k] || (v.t || 0) > out[k].t)) out[k] = { t: v.t || 0, by: v.by ?? null };
  return { ...out };
};
const headOf = (r) => ({ ...Object.fromEntries(HEAD.filter((k) => k in r).map((k) => [k, r[k]])), u: r.u, ub: r.ub });
// rang d’un gel de jour : une copie « tardive » (app ouverte après le signal) ne remplace jamais une copie prise avant ; ensuite la plus récente
const frozenWins = (a, b) => ((a.late ? 0 : 1) - (b.late ? 0 : 1)) || wins(a, b);

export function mergeRegatta(a, b) {
  const h = [...(a.hist || []), ...(b.hist || [])];
  const ha = headOf(a), hb = headOf(b), hw = wins(ha, hb) >= 0 ? ha : hb, hl = hw === ha ? hb : ha;
  if (!sameBody(ha, hb)) h.push(hist('head', a.id, hl));
  const tomb = mergeTomb(a.tomb, b.tomb);
  const ord = cmp(a.at ?? Infinity, b.at ?? Infinity) || ((b.by != null) - (a.by != null)) || cmp(String(a.by), String(b.by));
  const first = ord <= 0 ? a : b;                                                  // le créateur : le plus ancien, à égalité celui qui a un auteur
  const out = { id: a.id, ...hw, by: first.by ?? null, at: Math.min(a.at ?? Infinity, b.at ?? Infinity) };
  if (!Number.isFinite(out.at)) out.at = 0;
  for (const [kind, key] of Object.entries(LISTS)) {
    const A = new Map((a[key] || []).map((e) => [String(e.id), e])), B = new Map((b[key] || []).map((e) => [String(e.id), e])), res = [];
    for (const id of new Set([...A.keys(), ...B.keys()])) {
      const ea = A.get(id), eb = B.get(id);
      let pick = ea && eb ? (wins(ea, eb) >= 0 ? ea : eb) : ea || eb;
      if (ea && eb && !sameBody(ea, eb)) h.push(hist(kind, id, pick === ea ? eb : ea));
      if (kind === 'trace' && ea && eb) {                                           // rapport : le plus récent (t) gagne quel que soit u
        const rp = [ea.report, eb.report].filter(Boolean).sort((x, y) => (y.t || 0) - (x.t || 0))[0];
        pick = rp ? { ...pick, report: rp } : pick;
      }
      const t = tomb[`${kind}:${id}`]?.t;
      if (t != null && t >= (pick.u || 0)) continue;                                // supprimé (et pas recréé depuis)
      res.push(pick);
    }
    out[key] = res.sort((x, y) => String(x.id) < String(y.id) ? -1 : 1);
  }
  const frozen = {}, days = new Set([...Object.keys(a.frozen || {}), ...Object.keys(b.frozen || {})]);
  for (const d of days) {
    if (DANGER.has(d)) continue;
    const fa = a.frozen?.[d], fb = b.frozen?.[d];
    frozen[d] = fa && fb ? (frozenWins(fa, fb) >= 0 ? fa : fb) : fa || fb;
  }
  out.frozen = frozen; out.tomb = tomb;
  const seen = new Set();
  out.hist = h.filter((x) => { const k = `${x.kind}|${x.id}|${x.t}|${canon(x.v)}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => (y.t - x.t) || (canon(x) < canon(y) ? -1 : 1)).slice(0, MAX_HIST);
  return out;
}

// Recalages de bouées (D-05) : { [numéro]: { lat, lon, src, t, by } | { del: true, t, by } } — le plus récent (t) gagne, 5 versions gardées
export function mergeMarks(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (DANGER.has(k)) continue;
    const ea = a[k], eb = b[k];
    if (!ea || !eb) { out[k] = ea || eb; continue; }
    const w = ((ea.t || 0) - (eb.t || 0)) || (canon(ea) < canon(eb) ? -1 : 1), win = w >= 0 ? ea : eb, lose = win === ea ? eb : ea;
    const h = [...(ea.h || []), ...(eb.h || [])];
    if (canon({ ...ea, h: 0 }) !== canon({ ...eb, h: 0 })) h.push({ lat: lose.lat ?? null, lon: lose.lon ?? null, src: lose.src ?? null, t: lose.t || 0, by: lose.by ?? null, del: !!lose.del });
    const seen = new Set(), keep = h.filter((x) => { const s = canon(x); if (seen.has(s)) return false; seen.add(s); return true; }).sort((x, y) => y.t - x.t).slice(0, 5);
    const { h: _h, ...res } = win;
    out[k] = keep.length ? { ...res, h: keep } : res;                               // jamais de `h: []` : la forme doit rester la même après chaque fusion
  }
  return out;
}

// Document partagé : { v:1, regattas: { id: R }, tomb: { 'regatta:id': {t,by} }, marks }
export const emptyDoc = () => ({ v: 1, regattas: {}, tomb: {}, marks: {} });
export function mergeDoc(a = emptyDoc(), b = emptyDoc()) {
  const tomb = mergeTomb(a.tomb, b.tomb), regattas = {};
  for (const id of new Set([...Object.keys(a.regattas || {}), ...Object.keys(b.regattas || {})])) {
    if (DANGER.has(id) || tomb[`regatta:${id}`]) continue;                          // régate supprimée : définitif sur tous les téléphones
    const ra = a.regattas?.[id], rb = b.regattas?.[id];
    regattas[id] = mergeRegatta(ra || rb, rb || ra);                                  // seule d’un côté : fusionnée avec elle-même, ce qui normalise sa forme
  }
  return { v: 1, regattas, tomb, marks: mergeMarks(a.marks, b.marks) };
}
export const docEquals = (a, b) => canon(a) === canon(b);

// ───────────────────────── marquage des modifications locales (appelé par saveReg)

// Identifiant stable d’une manche : jour + heure (une manche par jour et par heure) ; sans heure, aléatoire
export const raceId = (m, rnd = Math.random) => (m.time ? `m${String(m.date).replace(/-/g, '')}${String(m.time).replace(':', '')}` : 'm' + rnd().toString(36).slice(2, 8));
const ensureIds = (r, rnd) => (r.races || []).some((m) => !m.id) ? { ...r, races: r.races.map((m) => (m.id ? m : { ...m, id: raceId({ ...m, date: m.date || r.dateStart }, rnd) })) } : r;

// prev, next : une régate locale avant / après une modification ; rend `next` marqué (u = now sur ce qui a changé, pierres tombales pour ce qui a disparu)
export function stamp(prev, next, { now, by = null, rnd } = {}) {
  const n = ensureIds(next, rnd), out = { ...n };
  const hp = prev && headOf(prev);
  const hn = headOf(n);
  if (!prev || !sameBody(hp, hn)) { out.u = now; out.ub = by; } else { out.u = prev.u; out.ub = prev.ub; }
  const tomb = { ...(prev?.tomb || {}), ...(n.tomb || {}) };
  for (const [kind, key] of Object.entries(LISTS)) {
    const P = new Map((prev?.[key] || []).map((e) => [String(e.id), e]));
    const cmpBody = kind === 'race' ? (x, y) => sameBody(noN(x), noN(y)) : sameBody;       // `n` (rang d’une manche) est déduit de l’ordre : renuméroter ne modifie aucune manche
    out[key] = (n[key] || []).map((e) => {
      const p = P.get(String(e.id));
      if (p && cmpBody(p, e)) return { ...e, u: p.u, ub: p.ub };
      return { ...e, u: now, ub: by };
    });
    for (const id of P.keys()) if (!(n[key] || []).some((e) => String(e.id) === id)) tomb[`${kind}:${id}`] = { t: now, by };
  }
  const frozen = {};
  for (const [d, f] of Object.entries(n.frozen || {})) {
    const p = prev?.frozen?.[d];
    frozen[d] = p && sameBody(p, f) ? { ...f, u: p.u, ub: p.ub } : { ...f, u: now, ub: by };
  }
  out.frozen = frozen; out.tomb = tomb;
  return out;
}
const noN = ({ n, ...r }) => r;
// Même ordre que raceOrder de js/regates.js : jour, puis heure (une manche sans heure après celles du même jour qui en ont une)
const raceOrder = (a, b) => cmp(String(a.date), String(b.date)) || ((a.time ? 0 : 1) - (b.time ? 0 : 1)) || cmp(String(a.time), String(b.time)) || cmp(String(a.id), String(b.id));
// Régate sans l’état propre à l’appareil et sans le rang des manches (avant envoi)
export const toShared = (r) => { const o = { ...r, races: (r.races || []).map(noN) }; for (const k of LOCAL_ONLY) delete o[k]; return o; };
// Fusion dans l’état local : les manches sont triées et renumérotées, `sel` (manche choisie, affichage de CET appareil) suit sa manche
export const fromShared = (shared, local) => {
  const o = { ...shared, races: [...(shared.races || [])].sort(raceOrder).map((m, i) => ({ ...m, n: i + 1 })) };
  if (local && local.sel != null) { const id = (local.races || []).find((m) => m.n === local.sel)?.id; const i = o.races.findIndex((m) => m.id === id); if (i >= 0) o.sel = i + 1; }
  return o;
};
```

### `js/archsync.js` (politique, état local, une synchronisation ; pur, tout injecté)

```javascript
// Archive partagée, côté téléphone : quand synchroniser, quoi envoyer, comment appliquer la réponse (ARCH-01, D-03, D-04).
// Tout est injecté (horloge, réseau, stockage, état des régates, verrou de course) : aucun DOM. La fusion est dans js/archmerge.js.
import { mergeDoc, emptyDoc, stamp, toShared, fromShared, canon } from './archmerge.js';

export const MIN_GAP_MS = 30e3;                    // jamais deux essais à moins de 30 s
export const DEBOUNCE_MS = 20e3;                   // après une modification locale
export const BACKOFF_MS = [30e3, 120e3, 600e3, 1800e3];

// D-03 : rien n’est envoyé ni reçu tant qu’un chrono, une trace, le mode départ ou le GPS de course est actif (raceActive de js/app.js)
export function canSync({ now, active, online, off = false, lastTry = 0, fails = 0 }) {
  if (off) return { ok: false, why: 'desactivee' };
  if (active) return { ok: false, why: 'course' };
  if (online === false) return { ok: false, why: 'hors_reseau' };
  const wait = Math.max(MIN_GAP_MS, fails ? BACKOFF_MS[Math.min(fails, BACKOFF_MS.length) - 1] : 0);
  if (now - lastTry < wait) return { ok: false, why: 'trop_tot', in: wait - (now - lastTry) };
  return { ok: true, why: null };
}

// Indicateur discret : { level: 'ok' | 'warn' | 'off', text }
export function syncStatus({ off, active, online, busy, dirty = 0, lastOkAt = null, fails = 0, absent = false }) {
  if (absent) return { level: 'off', text: 'Archive non configurée' };
  if (off) return { level: 'off', text: 'Synchronisation désactivée' };
  if (active) return { level: 'off', text: 'En pause pendant la course' };
  if (busy) return { level: 'ok', text: 'Synchronisation…' };
  if (online === false) return { level: 'warn', text: dirty ? `Hors réseau · ${dirty} modification${dirty > 1 ? 's' : ''} en attente` : 'Hors réseau' };
  if (fails) return { level: 'warn', text: 'Synchronisation à relancer' };
  if (dirty) return { level: 'warn', text: 'En attente d’envoi' };
  return { level: 'ok', text: lastOkAt ? 'À jour' : 'Pas encore synchronisé' };
}

// ───────────────────────── état local : marquage des modifications (appelé par saveReg) et document à envoyer

// prev, next : états { list, tomb, current } avant / après ; rend { st, changed: [ids] } avec les éléments modifiés marqués
export function stampState(prev, next, { now, by = null }) {
  const old = new Map(prev.list.map((r) => [r.id, r]));
  const list = next.list.map((r) => (old.get(r.id) === r ? r : stamp(old.get(r.id), r, { now, by })));   // même objet qu’avant : rien à comparer
  const tomb = { ...(prev.tomb || {}), ...(next.tomb || {}) };
  for (const id of old.keys()) if (!list.some((r) => r.id === id)) tomb[id] = { t: now, by };
  const changed = list.filter((r) => old.get(r.id) !== r && (!old.has(r.id) || canon(toShared(r)) !== canon(toShared(old.get(r.id))))).map((r) => r.id);   // objet inchangé : rien à comparer
  if ([...old.keys()].some((id) => !list.some((r) => r.id === id))) changed.push('~tomb');
  return { st: { ...next, list, tomb }, changed };
}
// Document local à envoyer : les régates sales (toutes à la première synchronisation), les suppressions, les recalages de bouées
export function buildDoc(st, { ids, marks = {} }) {
  const doc = emptyDoc();
  for (const r of st.list) if (!ids || ids.includes(r.id)) doc.regattas[r.id] = toShared(r);
  for (const [id, t] of Object.entries(st.tomb || {})) doc.tomb[`regatta:${id}`] = { t: t.t, by: t.by ?? null };
  doc.marks = marks;
  return doc;
}
// Réponse du serveur appliquée à l’état local : `sel` et `current` restent ceux de CET appareil
export function applyDoc(st, remote) {
  const local = { ...emptyDoc(), regattas: Object.fromEntries(st.list.map((r) => [r.id, toShared(r)])), tomb: Object.fromEntries(Object.entries(st.tomb || {}).map(([id, t]) => [`regatta:${id}`, t])) };
  const m = mergeDoc(local, remote), byId = new Map(st.list.map((r) => [r.id, r]));
  const list = Object.values(m.regattas).map((r) => fromShared(r, byId.get(r.id))).sort((a, b) => String(a.dateStart).localeCompare(String(b.dateStart)) || String(a.id).localeCompare(String(b.id)));
  const tomb = Object.fromEntries(Object.entries(m.tomb).map(([k, t]) => [k.replace(/^regatta:/, ''), t]));
  const current = list.some((r) => r.id === st.current) ? st.current : list[0]?.id ?? null;
  return { st: { ...st, list, tomb, current }, marks: m.marks };
}

// Modifications à envoyer : un compteur par clé (id de régate, « ~tomb » suppressions, « ~marks » recalages) ; on n’efface une clé que si
// personne ne l’a re-modifiée pendant l’échange (le compteur n’a pas bougé)
export function markDirty(meta, keys) { meta.seq = (meta.seq || 0) + 1; meta.dirty ||= {}; for (const k of keys) meta.dirty[k] = meta.seq; }

// ───────────────────────── une synchronisation
// deps : { now, fetchJson(method, query, body) → { status, body }, getState(), setState(st), getMarks(), setMarks(marks), meta (objet persisté), saveMeta(), isActive(), isOnline() }
export async function runSync(d, reason = 'auto') {
  const t = d.now(), meta = d.meta;
  const gate = canSync({ now: t, active: d.isActive(), online: d.isOnline(), off: meta.off, lastTry: meta.lastTry || 0, fails: meta.fails || 0 });
  if (!gate.ok && !(reason === 'manuel' && gate.why === 'trop_tot')) return { skipped: gate.why };
  meta.lastTry = t;
  const first = !meta.first, snapshot = { ...(meta.dirty || {}) }, keys = Object.keys(snapshot);
  const ids = first ? undefined : keys.filter((k) => !k.startsWith('~'));
  const st = d.getState();
  let res;
  try {
    res = first || keys.length
      ? await d.fetchJson('PUT', { k: 'light' }, { doc: buildDoc(st, { ids, marks: first || snapshot['~marks'] ? d.getMarks() : {} }) })
      : await d.fetchJson('GET', { k: 'light', ...(meta.rev ? { rev: meta.rev } : {}) });
  } catch (e) { meta.fails = (meta.fails || 0) + 1; d.saveMeta(); return { error: String(e.message || e).slice(0, 120) }; }
  if (res.status === 503 && res.body?.error === 'no_blob') { meta.absent = true; d.saveMeta(); return { error: 'no_blob' }; }
  if (res.status !== 200) { meta.fails = (meta.fails || 0) + 1; d.saveMeta(); return { error: res.body?.error || String(res.status) }; }
  if (d.isActive()) return { skipped: 'course' };                     // la course a commencé pendant l’échange : réponse jetée, elle reviendra
  meta.absent = false; meta.fails = 0; meta.lastOkAt = d.now();
  if (res.body.unchanged) { d.saveMeta(); return { unchanged: true }; }
  const out = applyDoc(d.getState(), res.body.doc);                   // la fusion repart de l’état d’AUJOURD’HUI, pas de celui d’avant l’échange
  d.setState(out.st); d.setMarks(out.marks);
  for (const k of keys) if (meta.dirty[k] === snapshot[k]) delete meta.dirty[k];
  meta.first = true; meta.rev = res.body.rev;
  d.saveMeta();
  return { merged: true, rev: res.body.rev };
}
```

### `api/archive.js` (fonction Vercel, client Blob injectable)

```javascript
// Archive partagée de l’équipage (Vercel, fonction Node) : lit et écrit le stockage Vercel Blob PRIVÉ pour le compte des trois équipiers.
// Le middleware a déjà vérifié le code d’accès et pose l’en-tête `x-rt-membre` (prénom) : c’est la seule source de l’auteur, jamais le corps.
// Variables d’environnement : BLOB_READ_WRITE_TOKEN (ou BLOB_STORE_ID + OIDC), VERCEL_ENV. Aucune URL Blob n’est jamais renvoyée au client.
// Routes (toutes sur /api/archive, paramètre k) :
//   GET  ?k=light[&rev=…]         document léger partagé (304 logique { unchanged } si rev à jour)
//   PUT  ?k=light                 { rev, doc } : fusion côté serveur (lire → fusionner → écrire avec ifMatch, 4 essais) → { rev, doc, changed }
//   PUT|GET ?k=trace&id=…         trace GPS (immuable)       PUT|GET ?k=report&id=…&t=…   rapport (immuable)
//   PUT|GET ?k=day&r=…&d=AAAA-MM-JJ[&by=…]   vent figé d’un jour, un objet par équipier (une seule main écrit chaque clé)
// `createHandler({ blob })` accepte un faux Blob (tests, aucun réseau) : { get, put, head, BlobPreconditionFailedError, BlobNotFoundError, BlobServiceRateLimited }.

import { Readable } from 'node:stream';
import { mergeDoc, emptyDoc, docEquals, canon, sameBody, LOCAL_ONLY, HEAD, LISTS } from '../js/archmerge.js';

export const MAX_LIGHT = 3_500_000, MAX_REGATTA = 150_000, MAX_REGATTAS = 200;
export const MAX_HEAVY = { trace: 4_000_000, report: 3_000_000, day: 600_000 };
const TRIES = 4, FUTURE_MS = 5 * 60e3;
const ID = /^[A-Za-z0-9._-]{1,80}$/, DAY = /^\d{4}-\d{2}-\d{2}$/, NAME = /^[\p{L}\p{M} '’-]{1,40}$/u;
const DANGER = new Set(['__proto__', 'constructor', 'prototype']);
export const slug = (n) => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// Les données d’un aperçu ne se mélangent jamais à celles de la production (le même magasin est branché aux deux environnements)
export const prefix = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview');
const bornee = (e) => String(e?.message || e).slice(0, 300);

// ───────────────────────── validation et attribution

const clampU = (e, now) => (e && typeof e === 'object' && e.u > now + FUTURE_MS ? { ...e, u: now } : e);
// Document reçu → document propre : limites, clés refusées, `sel` retiré, dates futures ramenées à maintenant
export function cleanDoc(doc, now) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw Object.assign(new Error('document illisible'), { status: 400 });
  if (doc.v != null && doc.v !== 1) throw Object.assign(new Error('version de format inconnue : mettez l’app à jour'), { status: 400 });
  const out = emptyDoc(), ids = Object.keys(doc.regattas || {}).filter((k) => !DANGER.has(k));
  if (ids.length > MAX_REGATTAS) throw Object.assign(new Error('trop de régates'), { status: 413 });
  for (const id of ids) {
    const r = doc.regattas[id];
    if (!ID.test(id) || !r || typeof r !== 'object' || String(r.id) !== id) throw Object.assign(new Error(`régate invalide : ${id.slice(0, 20)}`), { status: 400 });
    if (JSON.stringify(r).length > MAX_REGATTA) throw Object.assign(new Error('régate trop volumineuse'), { status: 413 });
    const c = { ...r }; for (const k of LOCAL_ONLY) delete c[k];
    for (const key of Object.values(LISTS)) {
      if (c[key] != null && !Array.isArray(c[key])) throw Object.assign(new Error(`${key} invalide`), { status: 400 });
      c[key] = (c[key] || []).map((e) => { if (!e || typeof e !== 'object' || !ID.test(String(e.id))) throw Object.assign(new Error(`élément invalide dans ${key}`), { status: 400 }); return clampU(e, now); });
    }
    c.frozen = Object.fromEntries(Object.entries(c.frozen || {}).filter(([d]) => DAY.test(d)).map(([d, f]) => [d, clampU(f, now)]));
    out.regattas[id] = clampU(c, now);
  }
  for (const [k, v] of Object.entries(doc.tomb || {})) if (!DANGER.has(k) && /^[\w:.|-]{1,120}$/.test(k) && Number.isFinite(v?.t)) out.tomb[k] = { t: Math.min(v.t, now + FUTURE_MS), by: null };
  for (const [k, v] of Object.entries(doc.marks || {})) if (!DANGER.has(k) && /^\w{1,12}$/.test(k) && Number.isFinite(v?.t)) out.marks[k] = { ...v, t: Math.min(v.t, now + FUTURE_MS) };
  return out;
}
// Auteur : tout ce qui est nouveau ou différent de ce qui est stocké est signé par l’équipier connecté (le `by` du client est ignoré)
export function attribute(incoming, stored, who) {
  const out = emptyDoc();
  for (const [id, r] of Object.entries(incoming.regattas)) {
    const s = stored.regattas?.[id], o = { ...r };
    const head = (x) => canon(Object.fromEntries(HEAD.map((k) => [k, x?.[k]])));
    if (!s) { o.by = who; o.ub = who; } else { o.by = s.by ?? who; o.ub = head(s) === head(r) ? s.ub ?? null : who; }
    for (const key of Object.values(LISTS)) {
      const S = new Map((s?.[key] || []).map((e) => [String(e.id), e]));
      o[key] = o[key].map((e) => { const p = S.get(String(e.id)); return !p ? { ...e, by: who, ub: who } : sameBody(p, e) ? { ...e, by: p.by ?? null, ub: p.ub ?? null } : { ...e, by: p.by ?? who, ub: who }; });
    }
    o.frozen = Object.fromEntries(Object.entries(o.frozen).map(([d, f]) => { const p = s?.frozen?.[d]; return [d, p && sameBody(p, f) ? { ...f, by: p.by, ub: p.ub } : { ...f, by: who, ub: who }]; }));
    o.tomb = Object.fromEntries(Object.entries(o.tomb || {}).map(([k, v]) => [k, { t: v.t, by: s?.tomb?.[k]?.by ?? who }]));
    out.regattas[id] = o;
  }
  out.tomb = Object.fromEntries(Object.entries(incoming.tomb).map(([k, v]) => [k, { t: v.t, by: stored.tomb?.[k]?.by ?? who }]));
  out.marks = Object.fromEntries(Object.entries(incoming.marks).map(([k, v]) => [k, stored.marks?.[k] && canon({ ...stored.marks[k], h: 0 }) === canon({ ...v, by: stored.marks[k].by, h: 0 }) ? stored.marks[k] : { ...v, by: who }]));
  return out;
}

// ───────────────────────── lecture / écriture du document léger avec ifMatch

async function readText(stream) { return new Response(stream).text(); }
async function readLight(B, path) {
  const r = await B.get(path, { access: 'private', useCache: false });          // useCache:false : relire la dernière version, pas la copie du CDN (jusqu’à 60 s de retard)
  if (!r || r.statusCode !== 200) return { doc: emptyDoc(), etag: null };
  try { return { doc: { ...emptyDoc(), ...JSON.parse(await readText(r.stream)) }, etag: r.blob.etag }; } catch { throw Object.assign(new Error('document stocké illisible'), { status: 502 }); }
}
export async function mutateLight(B, path, fn, { tries = TRIES } = {}) {
  for (let i = 0; i < tries; i++) {
    const { doc: stored, etag } = await readLight(B, path);
    const { doc, trash = [] } = fn(stored);
    if (docEquals(doc, stored) && etag) return { doc, rev: etag, changed: false };
    const text = JSON.stringify(doc);
    if (text.length > MAX_LIGHT) throw Object.assign(new Error('archive trop volumineuse : à découper'), { status: 413 });
    try {
      const opts = { access: 'private', contentType: 'application/json', cacheControlMaxAge: 60 };
      const r = etag ? await B.put(path, text, { ...opts, allowOverwrite: true, ifMatch: etag }) : await B.put(path, text, opts);   // création : échoue si un autre l’a créé entre-temps
      for (const t of trash) await B.put(`${path.replace(/light\.json$/, '')}trash/${t.id}-${t.t}.json`, JSON.stringify(t.value), { access: 'private', contentType: 'application/json', addRandomSuffix: true }).catch(() => {});
      return { doc, rev: r.etag, changed: true };
    } catch (e) {
      if (e instanceof B.BlobPreconditionFailedError || (!etag && e instanceof B.BlobError)) continue;   // quelqu’un a écrit entre-temps : on relit, on refusionne
      throw e;
    }
  }
  throw Object.assign(new Error('écritures simultanées : réessayez'), { status: 409 });
}

// ───────────────────────── fonction

export function createHandler({ blob, now = Date.now } = {}) {
  const getBlob = async () => blob || (blob = await import('@vercel/blob'));
  return async function handler(req, res) {
    res.setHeader?.('Cache-Control', 'no-store');
    const who = String(req.headers?.['x-rt-membre'] || '').trim();
    if (!NAME.test(who)) return res.status(403).json({ error: 'membre_inconnu' });         // fermé par défaut : sans prénom du middleware, rien
    if (!blob && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return res.status(503).json({ error: 'no_blob' });
    const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams), k = q.k, P = prefix();
    try {
      const B = await getBlob();
      if (k === 'light') {
        const path = `${P}/light.json`;
        if (req.method === 'GET') {
          const r = await B.get(path, { access: 'private', useCache: false, ...(q.rev ? { ifNoneMatch: String(q.rev) } : {}) });
          if (!r) return res.status(200).json({ rev: null, doc: emptyDoc() });
          if (r.statusCode === 304) return res.status(200).json({ unchanged: true, rev: r.blob.etag });
          return res.status(200).json({ rev: r.blob.etag, doc: JSON.parse(await readText(r.stream)) });
        }
        if (req.method === 'PUT') {
          const t = now(), incoming = cleanDoc(req.body?.doc, t);
          const out = await mutateLight(B, path, (stored) => {
            const merged = mergeDoc(stored, attribute(incoming, stored, who));
            const trash = Object.keys(stored.regattas || {}).filter((id) => !merged.regattas[id]).map((id) => ({ id, t, value: stored.regattas[id] }));
            return { doc: merged, trash };
          });
          return res.status(200).json(out);
        }
        return res.status(405).json({ error: 'GET ou PUT' });
      }
      if (k === 'trace' || k === 'report' || k === 'day') {
        let path;
        if (k === 'trace' && ID.test(q.id || '')) path = `${P}/trace/${q.id}.json`;
        else if (k === 'report' && ID.test(q.id || '') && /^\d{1,15}$/.test(q.t || '')) path = `${P}/report/${q.id}-${q.t}.json`;
        else if (k === 'day' && ID.test(q.r || '') && DAY.test(q.d || '')) path = `${P}/day/${q.r}/${q.d}/${req.method === 'PUT' ? slug(who) : /^[a-z0-9-]{1,40}$/.test(q.by || '') ? q.by : '_'}.json`;
        else return res.status(400).json({ error: 'paramètres invalides' });
        if (req.method === 'PUT') {
          const text = JSON.stringify(req.body ?? null);
          if (text.length < 3) return res.status(400).json({ error: 'corps vide' });
          if (text.length > MAX_HEAVY[k]) return res.status(413).json({ error: `objet trop volumineux (${MAX_HEAVY[k]} octets au plus)` });
          if (k !== 'day') {                                                                // immuable : déjà là = rien à faire (économise une écriture)
            try { await B.head(path); return res.status(200).json({ exists: true }); } catch (e) { if (!(e instanceof B.BlobNotFoundError)) throw e; }
          }
          await B.put(path, text, { access: 'private', contentType: 'application/json', allowOverwrite: true, ...(k === 'day' ? { cacheControlMaxAge: 60 } : {}) });
          return res.status(200).json({ ok: true });
        }
        if (req.method === 'GET') {
          const r = await B.get(path, { access: 'private', useCache: k !== 'day' ? true : false });
          if (!r || r.statusCode !== 200) return res.status(404).json({ error: 'absent' });
          res.setHeader?.('Content-Type', 'application/json'); res.setHeader?.('X-Content-Type-Options', 'nosniff');
          return Readable.fromWeb(r.stream).pipe(res);
        }
        return res.status(405).json({ error: 'GET ou PUT' });
      }
      return res.status(400).json({ error: 'k inconnu' });
    } catch (err) {
      if (blob && err instanceof blob.BlobServiceRateLimited) { res.setHeader?.('Retry-After', String(err.retryAfter || 60)); return res.status(429).json({ error: 'limite du stockage atteinte, réessayez plus tard' }); }
      return res.status(err.status || 502).json({ error: bornee(err) });
    }
  };
}

export default createHandler();
```

### `middleware.js` : l’auteur transmis aux fonctions (remplace `return next();` de la ligne 52, pour `/api/` seulement)

```javascript
    if (req.method === 'GET' && url.pathname === '/api/membre') return Response.json({ membre: prenom }, { headers: { 'Cache-Control': 'no-store' } });
    // ARCH-01 : les fonctions /api/ apprennent QUI écrit par cet en-tête, posé ici après vérification du code (celui du client est remplacé) ; le reste du site passe tel quel
    if (url.pathname.startsWith('/api/')) {
      const h = new Headers(req.headers);
      h.set('x-rt-membre', prenom);
      return next({ request: { headers: h } });
    }
    return next();
```

Test vert (vrai `middleware.js`, empreinte lue à l’exécution) : pour `/api/archive?k=light` avec un faux code valide et un en-tête `x-rt-membre: Usurpateur`, la réponse porte `x-middleware-next: 1`, `x-middleware-request-x-rt-membre` = le prénom de la table, `x-middleware-override-headers` contenant `x-rt-membre`, ni code ni empreinte dans les en-têtes ; pour `/index.html` aucune modification de requête (`x-middleware-override-headers` absent) ; sans code : 401 et pas de `x-middleware-next`.

### Câblage de `js/app.js` (seul fichier partagé du plan de câblage)

```javascript
// saveReg (js/app.js:65) : marquage avant tout le reste, sauf pour la réponse d’une synchronisation
function saveReg(next, { fromSync = false } = {}) {
  if (!fromSync) {
    const r = stampState(REG, next, { now: Date.now(), by: who() });   // js/archsync.js (import statique de archmerge.js seulement ; archsync.js est chargé après rt:map)
    next = r.st; markDirty(SYNC, r.changed); saveSync(); scheduleSync(20000);
  }
  REG = next; IC = icOf(currentRegatta(REG));
  /* …suite inchangée : saveRegattas, note, toast… */
}
// raceTick (js/app.js:764) : le verrou de course vient de tomber → synchroniser dans une minute
//   if (wasRaceActive && !raceActive(now)) scheduleSync(60000);
// recalMark (1682) / resetMark (1689) : markDirty(SYNC, ['~marks']) (+ SYNC.marksDel[k] = Date.now() pour resetMark)
// addEventListener('online', …) (131) et probeNet (1049) : scheduleSync(2000) au passage hors réseau → réseau
// deps de runSync : { now: Date.now, fetchJson, getState: () => REG, setState: (s) => saveReg(s, { fromSync: true }), getMarks: loadOverrides…,
//   setMarks: (m) => applyRemoteMarks(m), meta: SYNC, saveMeta: saveSync, isActive: () => raceActive(Date.now()), isOnline: () => net.online }
```

### Faux Blob et serveur en mémoire pour les tests et l’e2e

Un faux Blob de 25 lignes (copié des prototypes) implémente `get` (avec `ifNoneMatch`), `put` (existence sans `allowOverwrite`, `ifMatch` → `BlobPreconditionFailedError`, refus de tout `access` autre que `'private'`), `head` (`BlobNotFoundError`) et **une `list()` qui lève** : un test échoue si le code l’appelle. Les trois « téléphones » des tests appellent le **vrai** `createHandler({ blob })` avec leur prénom dans `x-rt-membre`. Pour Playwright, le même gestionnaire est branché par `ctx.route('**/api/archive*', …)` sur le modèle de `serviaIA` (`tools/regate-e2e.mjs`, `await ctx.route('**/api/ic', …)`), avec un faux Blob **partagé** entre les deux contextes et le prénom injecté par contexte (comme `simuleMembre` pour `/api/membre`).

## State of the Art

| Ancienne approche | Approche actuelle | Depuis | Impact |
|-------------------|-------------------|--------|--------|
| Régates sur le seul téléphone (index `localStorage` + IndexedDB) | Régates partagées : un document fusionné + objets lourds | cette phase | Les trois équipiers voient les mêmes régates ; hors réseau rien ne change pour la lecture |
| Auteur = étiquette posée par la page (`GET /api/membre`) | Auteur posé par le serveur depuis l’en-tête du middleware | cette phase | Un `by` falsifié par un téléphone est ignoré |
| Recalages de bouées propres à un téléphone | Recalages partagés (LWW par bouée, historique) | cette phase | Une bouée recalée en mer par un équipier profite aux deux autres |
| Stockage Blob « public par URL » | Blob **privé** : lecture authentifiée, livraison par la fonction | `@vercel/blob` ≥ 2.3 [CITED: vercel.com/docs/vercel-blob/private-storage] | Aucune URL publique ; `get(…, { access:'private' })` renvoie un flux que la fonction retransmet |
| Authentification du SDK par jeton seul | OIDC par défaut sur Vercel (`BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`), `BLOB_READ_WRITE_TOKEN` en repli | récent [CITED: vercel.com/docs/vercel-blob/using-blob-sdk#authentication] | Les deux marchent ; D-01 prévoit le jeton, le SDK choisit l’OIDC si les variables sont présentes |

**Deprecated/outdated :**
- La pratique « tout est immuable, ajouter un suffixe aléatoire » recommandée par la documentation pour les blobs ordinaires convient aux objets lourds (chemins uniques) ; elle ne convient **pas** au document partagé, qui est volontairement écrasé avec `ifMatch` et lu avec `useCache:false`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Le projet de Romain est sur le plan **Hobby** (quotas 2 000 / 10 000 opérations, 1 Go) | Pitfall 1, Pattern 6 | Pro : quotas facturés à l’usage, les freins restent utiles ; confirmer sur le tableau de bord |
| A2 | `get(..., { useCache:false })` d’un blob privé compte comme **une opération simple** | Pitfall 1 | Si avancée : 2 000/mois pourraient être atteints ; revoir la fréquence (lecture conditionnelle déjà prévue) |
| A3 | L’en-tête posé par `next({ request: { headers } })` arrive bien dans `req.headers` d’une fonction `api/*.js` de ce projet (hors Next.js) | Pattern 5 | Sans lui la fonction répond 403 (fermée par défaut) : détecté dès le premier essai de l’aperçu ; repli = recalculer le membre dans la fonction depuis le cookie avec une table partagée |
| A4 | Le traçage de fichiers de Vercel suit `import … from '../js/archmerge.js'` depuis `api/archive.js` | Pitfall 15 | 500 en production ; repli = `includeFiles` (déjà prévu), ou copier le module dans `api/_archmerge.js` |
| A5 | Un rapport de débrief généré pèse ≈ 250 Ko (proxy : rapport SNPM écrit à la main) | Pattern 1 | Si 2-3 Mo : limite de 3 Mo à relever ou rapport compressé |
| A6 | `head()` sur un blob absent lève `BlobNotFoundError` (utilisé pour « déjà là ? » des objets immuables) | Pattern 8, API | Si `null` : le test du faux Blob et le code doivent traiter les deux cas ; contrôle sur l’aperçu |
| A7 | `put` sans `allowOverwrite` échoue (`BlobError`) quand le blob existe ; l’erreur n’a pas de classe dédiée | `mutateLight` | La création concurrente peut écraser ; mitigation : les deux créateurs refusionnent à la lecture suivante, aucun ajout n’est perdu car le client renvoie son état tant qu’il est « sale » |
| A8 | `VERCEL_ENV` est disponible dans les fonctions de ce projet (case des variables système cochée) | Pitfall 2 | Tout dans `preview/` ; données de test mêlées aux vraies ; contrôle humain avant l’aperçu final |
| A9 | Trois équipiers ≈ 10 synchronisations par jour chacun, ≈ 12 régates par an | Pitfall 1, budgets | Quotas revus ; freins inchangés |
| A10 | Les trois iPhone ont l’app **installée** (hors plafond ITP de 7 jours) | Pitfall 14 | Données locales purgées après 7 jours d’inactivité : réparées par la synchronisation |
| A11 | La région du magasin (Washington par défaut, comme les fonctions `iad1`) n’a pas d’incidence mesurable sur une synchronisation de fond | Open Question 14 | Quelques centaines de ms par requête ; créer le magasin à Paris (`cdg1`) si Romain le souhaite |
| A12 | Les anciens téléphones (sans le nouveau code) lisent sans erreur des régates portant les champs `u`, `ub`, `tomb`, `hist` | Pitfall 17 | Les vues de phase 3 ignorent les champs inconnus (lecture de `r.races`, `r.traces`… par nom) ; non testé sur une version antérieure |

## Open Questions (RESOLVED)

1. **Format des données en ligne : un objet par régate ou un document ?**
   - RESOLVED : **un document léger unique par environnement** (`<env>/light.json`, ≈ 300 Ko par an) + objets lourds séparés immuables ou à écrivain unique. Raisons : 1 lecture / 1 écriture par synchronisation, pas de `list()`, un seul point de contention (traité par `ifMatch`). Seuil de découpage par saison : 1,5 Mo.
2. **File d’envoi hors réseau dans IndexedDB ?**
   - RESOLVED : **pas de journal d’opérations**. L’état local marqué (`u`, pierres tombales) est la file d’attente ; `rade.sync.v1` (localStorage, < 2 Ko) ne porte que des compteurs « sale » par clé, `rev`, `lastOkAt`, `fails`, les envois lourds faits (`up`) / reçus (`down`). Une fusion idempotente rend tout rejeu sans danger (testé).
3. **Comment le serveur connaît-il l’auteur ?**
   - RESOLVED : en-tête `x-rt-membre` posé par le middleware pour `/api/` (remplace celui du client), fonction fermée sans lui, `by` / `ub` posés par le serveur sur tout ce qui est nouveau ou différent.
4. **D-03 : que bloque exactement le verrou ?**
   - RESOLVED : tout échange et toute application de réponse tant que `raceActive(now)` (chrono, mode départ, trace, GPS de course). Les **objets lourds** attendent en plus la fin du verrou « journée » (`lockState().locked` faux). Une fin de course (`raceActive` passe à faux) déclenche une synchronisation à +60 s.
5. **Conflit entre deux écritures simultanées d’un même document ?**
   - RESOLVED : `get(useCache:false)` → fusion → `put(ifMatch)` ; `BlobPreconditionFailedError` → relire et refusionner (4 essais, puis 409 « réessayez »). Création : `put` sans `allowOverwrite`.
6. **Les recalages de bouées (D-05) : où, comment fusionner ?**
   - RESOLVED : dans le même document (`marks`), clé = numéro de bouée, le plus récent (`t`) gagne, suppression par `{ del:true, t }`, historique `h` de 5 versions, toast à la réception, jamais pendant une course.
7. **Qu’est-ce qui est lisible hors réseau (ARCH-03) et quel budget ?**
   - RESOLVED : **toutes** les données légères (fiche, manches, IC, bouées, résumés de gel, références) sont toujours locales ; les objets lourds de toute régate dont `dateStart` ≥ aujourd’hui − 180 jours (et à venir) ; plus ancien = fiche légère + bouton de téléchargement. Budget : ≈ 1 Mo par régate, 30-40 Mo pour six mois, arrêt à 60 % du quota estimé, `persist()` demandé.
8. **Première synchronisation de l’existant (régates de phase 3, graine SNPM) sans doublon ?**
   - RESOLVED : première synchronisation = tout envoyer ; `snpm-2026` a un id déterministe et, avec des dates fixes (deux lignes dans `fromEvent`), des contenus identiques → fusion sans historique ; manches existantes : id = jour + heure (collision voulue pour la même manche) ; traces : id déterministe pour les nouveaux imports ; copie `rade.regates.v1.bak` avant la première fusion appliquée. Des régates distinctes pour une même épreuve réelle restent distinctes (ARCH2-01 reporté).
9. **Quel conflit pour le gel du vent (deux téléphones ouverts le jour J) ?**
   - RESOLVED : une copie tardive ne remplace jamais une copie d’avant le signal, sinon la plus récente gagne ; les objets lourds sont **un par équipier** (`day/<régate>/<jour>/<équipier>.json`), donc aucune perte : les relevés des autres équipiers restent stockés (fusion des relevés de plusieurs équipiers dans la fiche = amélioration reportée, notée dans *Deferred* de la fiche, non demandée par D-04 au-delà de « conservés »).
10. **Quelle protection contre l’épuisement des quotas Hobby ?**
    - RESOLVED : voir Pattern 6 (30 s, recul exponentiel, plafonds quotidiens 40 écritures / 150 lectures, interrupteur, 429 géré, lecture conditionnelle, aucun `list`, `head` avant écriture) ; contrôle humain de l’onglet Observability après la première semaine.
11. **Aperçu et production partagent le magasin : comment éviter la pollution ?**
    - RESOLVED : préfixe `prod/` / `preview/` d’après `VERCEL_ENV` ; `env` renvoyé par la fonction ; « (essai) » dans l’indicateur ; contrôle humain des deux chemins.
12. **Dépendance ou API REST ?**
    - RESOLVED : **SDK `@vercel/blob` 2.8.0 épinglé exactement**, point de contrôle humain avant installation (verdict SUS du seam pour « trop récent » sur le tag `latest`, paquet officiel). L’API REST sans le SDK repose sur des en-têtes internes : écartée.
13. **Tests : comment éviter tout réseau ?**
    - RESOLVED : `createHandler({ blob, now })` (comme `createHandler({ openai })` d’`api/ic.js`) ; faux Blob avec `etag` / `ifMatch` ; trois « téléphones » purs appelant le vrai gestionnaire ; e2e Playwright à deux contextes avec `ctx.route` ; ce qui exige le **vrai** Blob est dans la recette humaine (voir *Validation Architecture*).
14. **Région du magasin et des fonctions ?**
    - RESOLVED : sans conséquence fonctionnelle ; recommandation : laisser les fonctions à `iad1` (défaut) et créer le magasin dans la **même** région que les fonctions (« Select a region close to your customers and functions » [CITED: vercel.com/docs/vercel-blob]) ; choix de Romain, non bloquant.
15. **Où placer la logique de fusion partagée entre la page et le serveur ?**
    - RESOLVED : `js/archmerge.js` (pur), importé par `api/archive.js` via `../js/archmerge.js` ; `includeFiles` dans `vercel.json` par précaution ; repli = copie dans `api/_archmerge.js` si l’aperçu montre un 500.
16. **Et si le magasin n’est pas encore créé ou si la fonction est indisponible ?**
    - RESOLVED : `503 no_blob` → `meta.absent`, indicateur « Archive non configurée », aucune erreur rouge, l’app reste exactement celle de la phase 3 ; interrupteur de secours dans la fiche d’aide.
17. **Découpage pour le calendrier ?**
    - RESOLVED : voir *Release mechanics* : A (v30) = données légères + recalages, B (v31) = objets lourds ; B n’entre dans v30 que si A est verte à l’aperçu le 28 octobre.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm test`, prototypes | ✓ | 22.22.0 (le dépôt demande 24.x ; 333 tests verts) | — |
| npm (registre public) | installer `@vercel/blob`, `npm view` | ✓ | accès au registre confirmé (`npm view`, `npm pack`) | — |
| `@vercel/blob` installé dans le dépôt | `api/archive.js` en production | ✗ (non installé : cette recherche ne touche pas `package.json`) | 2.8.0 à installer | Les tests importent `api/archive.js` sans le SDK (import dynamique, faux Blob injecté) |
| Playwright + Chromium | scénario e2e à deux contextes | ✓ (global) | 1.56.1, Chromium 1194 | Aucun besoin dans `npm test` |
| Magasin Blob privé réel, jeton, Vercel (aperçu) | essai de bout en bout, `ifMatch` réel, en-tête du middleware | ✗ (aucun accès à Vercel depuis le bac à sable) | — | Faux Blob dans les tests ; **recette humaine sur l’aperçu** |
| CLI `vercel` | `vercel dev` local | ✗ | — | Aucun besoin : tests et e2e n’en dépendent pas |
| iPhone de l’équipage | installation, mode avion, relance iOS | ✗ | — | Liste de recette humaine |

**Missing dependencies with no fallback:** magasin Blob réel et aperçu Vercel (validés par Romain) ; iPhone.
**Missing dependencies with fallback:** `@vercel/blob` (installé par le plan, import dynamique) ; CLI `vercel`.

## Validation Architecture

> `workflow.nyquist_validation` est `false` dans `.planning/config.json` ; la section est incluse parce que le demandeur l’exige explicitement.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `linkedom` 0.18.13 ; Playwright 1.56.1 pour l’e2e facultatif |
| Config file | aucun ; script `test` : `node --test --import ./tests/helpers/setup.mjs "tests/**/*.test.mjs"` (fuseau Paris, `DOMParser`, `fetch` local, réseau interdit) |
| Quick run command | `node --test --import ./tests/helpers/setup.mjs tests/<fichier>.test.mjs` |
| Full suite command | `npm run check` (`stamp --check` puis `npm test`) ; base de départ : **333 tests verts en 6,0 s** |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Fusion : ajouts des deux côtés gardés, valeur modifiée des deux côtés → la plus récente gagne et l’autre va dans `hist`, suppression par pierre tombale, régate supprimée définitive, gel tardif ne remplace pas un gel d’avant le signal, rapport le plus récent | unit | `tests/archmerge.test.mjs` | ❌ Wave 0 |
| ARCH-01 | Convergence : milliers de scénarios aléatoires à trois téléphones (ajouts, suppressions, bouées, régates supprimées, `by` absents), commutative / associative / idempotente, aucun doublon de manche | unit (propriété) | `tests/archmerge.test.mjs` | ❌ Wave 0 |
| ARCH-01 | `stamp` : `u` conservé si le contenu est identique, ids de manches posés, rang `n` et `sel` sans effet, `toShared` / `fromShared` | unit | `tests/archmerge.test.mjs` | ❌ Wave 0 |
| ARCH-01 | Clés dangereuses (`__proto__`…) sans pollution | unit | `tests/archmerge.test.mjs`, `tests/apiarchive.test.mjs` | ❌ Wave 0 |
| ARCH-01 | API : 403 sans prénom, 503 sans magasin, 405, `by` du client ignoré, chemin préfixé par l’environnement, accès toujours `private`, **jamais `list()`**, idempotence (aucune écriture si rien ne change), `rev` à jour → `unchanged`, dates futures ramenées, 413, ids invalides 400 | unit (faux Blob) | `tests/apiarchive.test.mjs` | ❌ Wave 0 |
| ARCH-01 | API : deux écritures simultanées → `ifMatch` refusé → relecture → les deux ajouts gardés | unit (faux Blob à porte) | `tests/apiarchive.test.mjs` | ❌ Wave 0 |
| ARCH-01 | API : régate supprimée → `trash/` écrit, un téléphone en retard ne la ressuscite pas ; 429 avec `Retry-After` | unit | `tests/apiarchive.test.mjs` | ❌ Wave 0 |
| ARCH-01 (critère 1) | Créée hors réseau, apparue sur les deux autres au retour du réseau, sans doublon après resynchronisations | unit (trois téléphones + vrai gestionnaire) | `tests/archsync.test.mjs` | ❌ Wave 0 |
| ARCH-01 (critère 2) | Deux équipiers complètent la même régate hors réseau : les deux ajouts conservés, états identiques | unit | `tests/archsync.test.mjs` | ❌ Wave 0 |
| ARCH-01 (critère 1, D-03) | Rien envoyé ni reçu pendant une course ; réponse jetée si la course commence pendant l’échange ; compteurs « sale » conservés | unit | `tests/archsync.test.mjs` | ❌ Wave 0 |
| ARCH-01 | `canSync` (30 s, recul, désactivation), `syncStatus` (tous les textes), première synchronisation de l’existant (graine SNPM semée sur trois téléphones : aucun doublon ni historique), suppression propagée, recalages de bouées partagés (D-05), lecture conditionnelle sans modification | unit | `tests/archsync.test.mjs` | ❌ Wave 0 |
| ARCH-01 (critère 3) | Sans code d’accès : `/api/archive` (et `?k=light`, `?k=trace&id=x`…) refusé 401 ; avec un faux code : `x-rt-membre` posé, celui du client remplacé, ni code ni empreinte ; `/index.html` sans modification de requête ; `/api/membre` inchangée | unit (vrai middleware) | `tests/access.test.mjs` (✅ à compléter ; l’énumération de `api/` couvre déjà `/api/archive` dès sa création) | ✅ |
| ARCH-01 | Gardes statiques : aucun `access: 'public'`, aucun `list(` dans `api/archive.js`, aucune URL `blob.vercel-storage.com` ni `BLOB_READ_WRITE_TOKEN` dans `js/`, `maxDuration` de `api/archive.js` dans `vercel.json`, `x-rt-membre` seulement pour `/api/` | garde statique | `tests/apiarchive.test.mjs`, `tests/access.test.mjs` | ❌ Wave 0 |
| ARCH-01 | `init()` sans `await` avant `rt:ui` ; `archsync.js` importé dynamiquement après `rt:map` ; aucune requête `/api/archive` avant `rt:map` | garde statique | `tests/boot.test.mjs` (✅ à compléter) | ✅ |
| ARCH-01 | Graine SNPM à dates fixes ; id de trace déterministe pour un nouvel import ; `listTracks` par curseur rend les mêmes champs | unit | `tests/regates.test.mjs`, `tests/attach.test.mjs`, `tests/pdf.test.mjs` (✅ à compléter) | ✅ |
| ARCH-01 (critères 1-2) | Scénario à deux contextes Chromium : A crée hors ligne (« En attente »), retour du réseau, B voit la régate ; ajouts simultanés hors ligne conservés ; chrono lancé sur A : **aucune requête** vers `/api/archive` observée | navigateur | `node tools/regate-e2e.mjs archive` | ❌ Wave 0 (e2e facultatif, hors `npm test`) |
| ARCH-03 (critère 4) [B] | Quoi envoyer / quoi télécharger (horizon 180 jours, ordre, budget, garde de stockage, aucun téléchargement pendant le verrou « journée ») ; jour / trace / rapport restent lisibles avec `fetch` coupé | unit | `tests/archheavy.test.mjs` | ❌ Wave 0 (B) |
| ARCH-03 (critère 4) [B] | Mode avion : B ouvre fiche, débrief et rapport d’une régate synchronisée, réseau coupé | navigateur | `node tools/regate-e2e.mjs archivehors` | ❌ Wave 0 (B) |
| ARCH-01 / ARCH-03 | Magasin réel, en-tête du middleware sur Vercel, `ifMatch` réel, quotas, iPhone en mode avion | humain (aperçu) | liste de recette ci-dessous | — |

### Sampling Rate
- **Par tâche :** le fichier de test du module touché (secondes).
- **Par vague :** `npm run check`.
- **Porte de phase :** `npm run check` vert + `node tools/stamp.mjs --check` + `node tools/regate-e2e.mjs archive` (et `archivehors` pour B) + `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` (ouverture < 2 s conservée) + recette humaine sur l’aperçu avant `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/archmerge.test.mjs`, `tests/apiarchive.test.mjs`, `tests/archsync.test.mjs` à créer depuis les prototypes (29 tests verts) ; `tests/archheavy.test.mjs` pour B
- [ ] Compléter `tests/access.test.mjs` (`x-rt-membre`, `/api/archive?k=…`), `tests/boot.test.mjs` (ordre d’`init`, import différé), `tests/regates.test.mjs` (graine à dates fixes), `tests/attach.test.mjs` (id de trace déterministe), `tests/stamp.test.mjs` (SHELL : couvert par le test existant « tout fichier chargé par l’app est dans le SHELL »)
- [ ] Faux Blob partagé entre `tests/` et `tools/regate-e2e.mjs` : le mettre dans `tests/helpers/fakeblob.mjs` (importé par les deux)
- [ ] Framework install : aucune ; dépendance de production : `npm install --save-exact @vercel/blob@2.8.0` (après le point de contrôle)

### Recette humaine (aperçu Vercel + deux téléphones, fin de chaque version)
1. **Magasin** : créé en mode **Privé**, branché à Production **et** Aperçu ; `BLOB_READ_WRITE_TOKEN` présente dans les deux ; case des variables système cochée (`VERCEL_ENV`).
2. **Premier essai** : sur l’aperçu, « Synchroniser » → l’indicateur passe à « À jour (essai) » ; `preview/light.json` apparaît dans le magasin et **aucun** `prod/…` ; la requête n’est pas un 403 (en-tête du middleware bien reçu) ni un 500 (module de `js/` bien embarqué).
3. **Deux téléphones, deux comptes** : A crée une régate hors réseau (mode avion), l’indicateur dit « Hors réseau · 1 modification en attente » ; retour du réseau, B voit la régate avec **l’auteur de A** (posé par le serveur).
4. **Ajouts simultanés** : A et B ajoutent chacun une manche, hors réseau ; après synchronisation les deux manches sont chez les deux, une seule fois.
5. **Même valeur modifiée des deux côtés** (une bouée « à confirmer » corrigée par A puis par B) : la plus récente reste, l’autre apparaît dans l’historique de la fiche.
6. **Course** : lancer le chrono sur A pendant que B modifie : A n’envoie ni ne reçoit rien (indicateur « En pause pendant la course »), la synchronisation reprend dans la minute qui suit « Course finie » / l’arrêt du chrono.
7. **Recalage de bouée** (D-05) : A recale la bouée 3 ; B reçoit le toast « Bouée 3 recalée par … » et la carte change.
8. **Accès** : un navigateur sans code reçoit 401 sur `/api/archive` et sur `/api/archive?k=light` ; le code n’apparaît dans aucune réponse.
9. **Quotas** : après une heure d’essais, relever dans Observability › Blob le nombre d’opérations simples / avancées ; extrapoler au mois (doit rester < 30 % des quotas).
10. **[B] Mode avion** : après synchronisation, B coupe le réseau et ouvre fiche, débrief et rapport d’une régate récente ; vent figé et trace présents.
11. **Ouverture** < 2 s conservée, mise à jour différée toujours effective.

## Security Domain

`security_enforcement` est actif, ASVS niveau 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | accès par code existant (`middleware.js`), inchangé |
| V3 Session Management | non | cookie `rt_acces` inchangé ; SECU2-02 (jeton révocable) reste différé |
| V4 Access Control | **oui** | `/api/archive` derrière le middleware (couverte par l’énumération de `api/` de `tests/access.test.mjs` et par des cas explicites) ; la fonction est **fermée par défaut** (403 sans `x-rt-membre`) ; l’en-tête du client est remplacé par celui du middleware (test usurpation) ; chemins du magasin construits côté serveur à partir d’identifiants validés |
| V5 Input Validation | **oui** | `cleanDoc` : objet, ids par expression régulière, tailles (régate 150 Ko, document 3,5 Mo, objets lourds bornés), listes typées, clés refusées, `sel` retiré, dates futures ramenées ; `JSON.parse` sous `try` ; page : `esc()` / `textContent` pour tout texte venu de l’archive (noms de régates, extraits, historique) |
| V6 Cryptography | non | pas de cryptographie ajoutée (le jeton Blob est géré par Vercel) |
| V7 Error Handling and Logging | **oui** | messages d’erreur bornés à 300 caractères ; `report('archive', e)` ; jamais le contenu des régates, le code d’accès ni le prénom dans le journal (`scrub()` de `js/diag.js` déjà en place) |
| V8 Data Protection | **oui** | magasin **privé** ; aucune URL Blob ni lien signé renvoyé ; `Cache-Control: no-store` sur toutes les réponses JSON ; copie locale seulement dans les magasins de l’appareil ; gardes statiques contre `access: 'public'` et toute URL de magasin dans `js/` |

### Known Threat Patterns for ce périmètre

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auteur usurpé (`by` falsifié, `x-rt-membre` envoyé par le navigateur) | Spoofing | en-tête remplacé par le middleware, 403 sans lui, `by` du corps ignoré |
| Accès à l’archive sans code | Information disclosure | middleware (matcher resserré en phase 1) ; test sur toutes les formes d’adresse de la fonction |
| Magasin ou objet rendu public par erreur | Information disclosure | magasin créé **Privé** (irréversible), garde statique `access: 'public'` absent, aucune URL de magasin dans la page |
| Pollution de prototype par des clés JSON | Tampering | liste de refus à l’entrée et dans chaque fusion, `Object.create(null)`, test |
| XSS par un nom de régate, un extrait ou une entrée d’historique venus d’un autre téléphone | Tampering | `regview.js` échappe `& < > " '` ; tests `linkedom` complétés pour `hist` ; texte jamais injecté en HTML brut |
| Horloge d’un téléphone qui gagne tous les conflits | Tampering | dates futures ramenées par le serveur |
| Écrasement concurrent ou régate effacée par erreur | Tampering / DoS | `ifMatch`, fusion, `trash/` à la suppression |
| Épuisement du quota Blob (fonction bavarde ou boucle) | Denial of service | freins côté page (30 s, recul, plafonds), pas de `list`, écritures seulement si changement, interrupteur ; 429 géré |
| Aperçu qui détruit ou mélange la production | Tampering | préfixes `prod/` / `preview/` |
| Charge utile énorme | Denial of service | bornes par route, 413 avec message, limite de la plateforme 4,5 Mo |

## Sources

### Primary (HIGH confidence)
- `/home/user/rade-tactique/js/*.js`, `api/ic.js`, `middleware.js`, `vercel.json`, `package.json`, `sw.js`, `tests/access.test.mjs`, `tests/helpers/setup.mjs`, `tools/regate-e2e.mjs`, `tests/fixtures/coupe-snpm-2026-10-18.gpx`, `data/wx-snapshot.json`, `rapports/coupe-snpm-2026.html` : lus et exécutés cette session (mesures de la trace, des prévisions, de la régate semée ; `npm test` : 333 tests).
- `.planning/phases/03-ouvrir-une-regate/03-RESEARCH.md` et `03-0*-SUMMARY.md`, `.planning/phases/02-fiable-et-juste-en-mer/02-04-SUMMARY.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `04-CONTEXT.md`.
- Paquet `@vercel/blob@2.8.0` (`npm pack`, `dist/index.d.ts`, `dist/index.js`, `package.json`) et `node_modules/@vercel/functions` 3.10.1 (`middleware.js`, `middleware.d.ts`) : lus.
- 29 tests de prototypes exécutés (Node 22.22.0) : fusion (10, dont 4 000 scénarios de convergence), API avec faux Blob (10), client à trois téléphones (8), middleware réel (1) ; échecs constatés puis corrigés : forme de `h: []` non idempotente, `hist` absent d’une régate vue d’un seul côté, `by` non commutatif à contenu égal, plusieurs ternaires mal parenthésés, rang des manches comptant comme contenu.

### Secondary (MEDIUM confidence — documentation officielle lue cette session)
- [Vercel Blob — Private storage](https://vercel.com/docs/vercel-blob/private-storage) (livraison par fonction, `get`, `useCache:false`, `ifNoneMatch`, jeton / OIDC)
- [Vercel Blob — SDK JS](https://vercel.com/docs/vercel-blob/using-blob-sdk) (`put` : `access`, `addRandomSuffix`, `allowOverwrite`, `ifMatch`, `contentType`, `cacheControlMaxAge` ; `get` ; `head` ; `list` ; ordre de résolution des identifiants)
- [Vercel Blob — vue d’ensemble](https://vercel.com/docs/vercel-blob) (écrasement, écritures conditionnelles, mise en cache, opérations simples / avancées, régions)
- [Vercel Blob — tarifs et limites](https://vercel.com/docs/vercel-blob/usage-and-pricing) (quotas Hobby, limites de débit, blocage de 30 jours)
- [Changelog : lectures cohérentes sur le stockage privé](https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage)
- [Vercel Functions — limites](https://vercel.com/docs/functions/limitations) (4,5 Mo, durée maximale 300 s sur Hobby avec Fluid compute, `includeFiles`)
- [Routing Middleware API](https://vercel.com/docs/routing-middleware/api) (`next({ request: { headers } })`)
- [Variables système](https://vercel.com/docs/environment-variables/system-environment-variables) (`VERCEL_ENV`)
- [WebKit — Tracking Prevention](https://webkit.org/tracking-prevention/) (plafond de 7 jours, exemption des web apps de l’écran d’accueil) ; [WebKit — Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/) (quota selon l’espace disque)

### Tertiary (LOW confidence, à valider)
- Taille d’un rapport généré (A5), comptage exact d’une lecture `useCache:false` (A2), transmission réelle de l’en-tête du middleware sur la plateforme (A3), traçage de `../js/…` (A4), `head()` sur absent (A6), disponibilité de `VERCEL_ENV` (A8).

Les outils MCP de documentation (Context7, Exa, etc.) n’étaient pas disponibles : sources web par récupération de pages, puis lecture du paquet et exécution locale pour tout ce qui pouvait l’être.

## Release mechanics

- Après tout changement de l’app : `npm run stamp` (SHELL et version régénérés) ; publication : `npm run release -- "archive partagée : régates sur les trois téléphones"` (note ≤ 80 caractères, sans `<` ni `>`). `api/` n’est pas dans le SHELL. `npm run check` doit rester vert ; sur Vercel `npm ci && npm run gate` refuse une version fautive.
- **Prérequis dans l’ordre** : v28 et v29 (phase 3) sont en production avant v30 ; la branche `apercu-phase-04` part de v29 (build n° 29 [VERIFIED: `release.json`]). Romain crée le magasin **Privé** et le branche à Production + Aperçu **avant** la recette de l’aperçu ; il pousse la branche (cette recherche ne pousse rien).
- **Calendrier** (aujourd’hui mardi 20 octobre 2026) : gel du code **lundi 2 novembre** ; régate CVAT **samedi 7 au lundi 9 novembre** ; plus de mise en production après **jeudi 5 novembre au matin** (règle des 48 h). Les trois iPhone appliquent la mise à jour **hors course** avant la recette.
- **Découpage proposé :**
  - **Release A — v30, aperçu vers le mardi 27 octobre, production au plus tard le vendredi 30 octobre** : middleware (`x-rt-membre`), `api/archive.js` (route `light` seulement, `trace` / `report` / `day` répondent 501 jusqu’à B), `js/archmerge.js`, `js/archsync.js`, câblage (`saveReg`, déclencheurs, indicateur, historique de fiche en lecture seule, recalages de bouées partagés), graine SNPM à dates fixes, interrupteur de secours, aide et guide. Couvre les critères 1 à 3 et la partie « fiche » du critère 4 (la fiche lit les résumés en index).
  - **Release B — v31, seulement si A est verte à l’aperçu le mercredi 28 octobre ; sinon après la régate** : `js/archheavy.js`, routes `day` / `trace` / `report`, id de trace déterministe, `listTracks` par curseur, horizon et budget, `persist()`, bouton de téléchargement des anciennes régates. Couvre le critère 4 en entier. B ne doit **pas** entrer en production après le 2 novembre.
  - **Si A n’est pas prête au gel du 2 novembre** : elle attend l’après-CVAT (D-02) ; v28/v29 suffisent pour la régate ; le code reste hors production, aucun changement de comportement pour l’équipage.
- **Découpage en plans suggéré (à affiner par le planificateur) :** vague 1, deux plans sur des fichiers disjoints : (1) `js/archmerge.js` + `tests/archmerge.test.mjs` ; (2) `middleware.js` + `api/archive.js` + `vercel.json` + `package.json` (point de contrôle de l’installation) + `tests/apiarchive.test.mjs` + complément de `tests/access.test.mjs` + faux Blob partagé. Vague 2 : (3) `js/archsync.js` + `tests/archsync.test.mjs` (dépend de 1 et 2) ; puis (4) **un seul plan de câblage** (`js/app.js`, `js/regview.js`, `js/regates.js`, `index.html` / `styles.css` pour l’indicateur, `js/help.js`, `guide.html`, `tests/boot.test.mjs`, scénario e2e `archive`). Vague 3 : (5) publication v30 sur l’aperçu + recette humaine ; puis, si le calendrier le permet, (6) B (`archheavy`, routes lourdes, `track.js`) et (7) publication v31.
- Ne rien écrire des codes d’accès ni des empreintes dans la note de version, les tests, le journal ou ce document. La recette humaine ne demande jamais de copier un code.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH pour l’API du SDK (documentation + types lus) ; MEDIUM pour le comportement de la plateforme (en-tête du middleware, bundling, décompte des opérations), à confirmer sur l’aperçu.
- Fusion, protocole, API serveur : HIGH (prototypes exécutés, convergence testée sur 4 000 scénarios, faux Blob au contrat du SDK).
- Calendrier et découpage : HIGH sur la faisabilité de A, MEDIUM sur B (stockage local, `listTracks`, recette sur iPhone).
- Quotas Hobby : MEDIUM (documentation officielle ; estimations d’usage supposées).
- Pitfalls : HIGH pour ceux reproduits ici (idempotence de `h`, `by`, rang des manches, pollution de prototype, simultanéité), MEDIUM pour ceux tirés de la documentation.

**Research date:** 2026-10-20
**Valid until:** 2026-11-02 (gel du code) ; les quotas, l’API du SDK (ligne 2.x, versions de pré-sortie 2.9 déjà publiées) et le comportement de Vercel peuvent changer sans préavis.
