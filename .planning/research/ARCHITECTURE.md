# Architecture Research

**Domain:** PWA de tactique de régate (J80 Naos, rade de Toulon), jalon « prêt pour la prochaine régate CVAT » sur une application existante (JS sans build, Vercel)
**Researched:** 2026-10-19
**Confidence:** MEDIUM-HIGH (code lu directement et API Vercel Blob vérifiée dans la doc officielle ; comportements iOS en arrière-plan et cohérence de `list()` Blob à confirmer sur appareil / en essai)

> Lecture rapide : la contrainte structurante n'est pas la technique, c'est le calendrier (≈ 19 jours, régate vers le 7-9 novembre). L'architecture proposée est donc « local d'abord, serveur ensuite, refactoring par couture » : chaque étape laisse l'app déployable, et si le serveur n'est pas prêt avant la course, **rien n'est perdu** (tout est capté localement et synchronisé après).

---

## Constats sur le code existant qui changent le plan

Ces points ont été vérifiés dans le code (pas seulement dans CONCERNS.md) :

1. **La mise à jour du service worker recharge la page toute seule en pleine course.** `js/app.js` l.84-92 : `controllerchange` → `location.reload()`, `sw.js` : `skipWaiting()` + `clients.claim()`, et `reg.update()` est appelé à **chaque retour au premier plan** (`visibilitychange`). CONCERNS.md dit « aucun prompt » ; c'est plus grave : un déploiement pendant la régate recharge l'app au prochain déverrouillage du téléphone. Le `Recorder` (`recorder.track` en mémoire), le chrono (`timer`) et le GPS (`gps`) sont des variables de module : **un rechargement les perd**. Seule la dernière sauvegarde IndexedDB (toutes les 20 s) survit, et rien ne la reprend.
2. **Le `Recorder` réécrit toute la trace à chaque sauvegarde** (`saveTrack(T)` = `put` de l'objet entier) et `listTracks()` charge **tous les points de toutes les traces** juste pour afficher la liste (`getAll`). Avec ~9 500 points pour la Coupe SNPM (GPX de 1,4 Mo), c'est déjà lourd ; sur 3 h + plusieurs traces importées, ça devient un risque de mémoire sur iPhone.
3. **Aucune reprise** : pas d'indicateur « trace ouverte », pas de marqueur de trou. Un écran verrouillé fait un trou dans la trace que `analyzeTrack` (lissage sur 8 s) comble par un segment droit → de fausses vitesses et de faux virements dans le débrief.
4. **Le verrou d'écran n'est ré-acquis que par `Recorder`** (`visibilitychange`), pas par `startmode.js` (l.99 : un seul `request`, jamais renouvelé). Le mode départ peut donc perdre son verrou sans le dire.
5. **Données de la rade codées en dur au-delà de `courses.js`** (inventaire complet pour le venue pack) : `geo.js` `ORIGIN` ; `weather.js` `GRID`, `CENTER`, coordonnées marines (l.40), filtre de balises `lat 42.98-43.22 / lon 5.7-6.25` (l.122) ; `tactics.js` l.101 (arrivée « près de 1 » = `43.0955, 5.9325`) ; `app.js` l.170 (`CENTER`) et l.282 (point du badge de vent `43.088, 5.962`) ; `tactics.js` `REGIMES` (savoir local en texte, avec noms de lieux) ; `api/rules.js` constante `CVAT` ; `data/*` (terrain, couverture, côte, fond de carte, masque, snapshot météo).
6. **Les modules de calcul sont déjà importables sous Node** : `geo`, `polar`, `wind`, `router`, `tactics`, `courses`, `track` (`analyzeTrack`), `debrief` (`detect`/`analyze`), `obs` n'ont pas d'accès DOM à l'import (le DOM n'est touché que dans des fonctions d'affichage). `Terrain.load()` utilise `fetch` : un helper de test le remplace par une lecture de fichier. C'est ce qui rend le harnais de non-régression bon marché (zéro dépendance, `node --test`, Node 22 disponible).
7. **Le middleware protège déjà `/api/*`** (401 JSON sans cookie) mais **ne transmet pas l'identité** du membre. Toute nouvelle fonction doit recalculer le membre à partir du cookie (même table de hachage) pour attribuer les modifications.
8. **`S.day` est forcé à « aujourd'hui »** (`if (S.day < today()) S.day = today()`) : l'app ne sait pas aujourd'hui ouvrir un jour passé. Une régate archivée ne peut pas réutiliser `S` tel quel.

---

## Standard Architecture

### System Overview (cible, en trois couches de dépendance)

Règle de dépendance unique : **cœur pur ← adaptateurs plateforme ← interface**. Un module n'importe jamais « vers le haut ».

```
┌───────────────────────────────────────────────────────────────────────────┐
│ INTERFACE (DOM)                                                           │
│  index.html · js/app.js (composition seule, rétrécit au fil des jalons)   │
│  js/regatta/ui.js (liste, ouvrir, archive)   js/startmode.js   js/help.js │
│  js/scene3d.js   js/debrief.js (parties DOM)   js/obs.js (renderObsCard)  │
├───────────────────────────────────────────────────────────────────────────┤
│ ADAPTATEURS PLATEFORME (effets de bord : navigateur, stockage, réseau)    │
│  platform/racesession.js ── verrou « en course » + reprise après crash    │
│  platform/gps.js ── watch + chien de garde        platform/wakelock.js    │
│  platform/swupdate.js ── mise à jour différée     platform/diag.js        │
│  platform/idb.js ── IndexedDB (traces par blocs, régates, outbox)         │
│  regatta/store.js ── régates local-d'abord        regatta/sync.js ─────┐  │
│  venue/loader.js ── charge le pack, injecte l'origine                  │  │
├───────────────────────────────────────────────────────────────────────┼──┤
│ CŒUR PUR (aucun DOM, aucun stockage, importable sous Node)            │  │
│  geo · polar · wind · router · tactics · track.analyzeTrack · debrief.analyze│
│  regatta/model.js (états, fusion) · regatta/snapshot.js (projection)  │  │
│  venue/schema.js (validation) · platform/racesession-state.js (machine)│  │
└───────────────────────────────────────────────────────────────────────┼──┘
                                                                         │ fetch (cookie de l'équipage)
┌────────────────────────────────────────────────────────────────────────▼──┐
│ SERVEUR (Vercel)                                                          │
│  middleware.js (inchangé, garde /api/*)                                   │
│  api/_crew.js (membre depuis le cookie) · api/_store.js (Blob)            │
│  api/regattas.js (liste, création)  api/regatta.js (manifeste, fusion)    │
│  api/blob.js (objets immuables : snapshots, traces, débriefs, rapports)   │
│  api/voice.js · api/debrief.js · api/rules.js (inchangés)                 │
│            │                                                              │
│            ▼  Vercel Blob (privé), écritures conditionnelles `ifMatch`    │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Composant | Responsabilité | Implémentation recommandée |
|-----------|----------------|----------------------------|
| `regatta/model.js` (pur) | Forme du manifeste, transitions `upcoming → raced → archived`, **fusion déterministe** de deux manifestes, identifiants | Fonctions pures + tests ; importé tel quel par le navigateur **et** par `api/regatta.js` |
| `regatta/snapshot.js` (pur) | Projection **explicite et bornée** des objets vivants (`data`, `series`, `S.obs`, `analysis`) en JSON d'archive | `toSnapshot({data, series, obs, analysis, marksUsed})` ; jamais `JSON.stringify(analysis)` (objets liés au terrain/champ) |
| `regatta/store.js` | Copie locale des régates + file d'envoi (outbox) ; source de vérité de l'écran | IndexedDB (`regattas`, `blobs`, `outbox`) ; lecture/écriture hors ligne |
| `regatta/sync.js` | Pousse l'outbox, tire les nouveautés, applique les fusions ; **s'arrête pendant le verrou course** | `fetch` vers `/api/*`, relance sur `online` / démarrage / `visibilitychange` visible |
| `api/regatta.js` | Reçoit un manifeste, fusionne avec l'existant, réécrit avec `ifMatch` | Lire (sans cache) → `merge()` → `put(..., {ifMatch})` → 3 essais si 412 |
| `api/blob.js` | Dépose / sert les objets immuables, authentifié | `put` sans écrasement (erreur = déjà présent = succès idempotent) ; `get` en flux ; plafond de taille |
| `venue/loader.js` | Charge `data/venues/<id>/venue.json`, valide, **injecte** origine / grille météo / marques dans les modules | Appelé dans `init()` avant `Terrain.load` ; remplace les constantes importées à l'import |
| `platform/racesession.js` | Un seul endroit qui sait « on est en course » ; persiste le verrou ; bloque mises à jour et synchro entrante | Machine d'états pure + persistance `localStorage` (`rade.racelock`) |
| `platform/gps.js` | `watchPosition` + chien de garde (silence > 10 s → relance + bandeau) | Extrait de `startGps()` ; émet des événements `fix` / `silence` / `error` |
| `platform/wakelock.js` | Verrou d'écran unique, compté, ré-acquis sur `visibilitychange` et sur l'événement `release` | Remplace les deux implémentations de `track.js` et `startmode.js` |
| `platform/swupdate.js` | Détecte un worker en attente, affiche un bandeau, applique **hors course** | Écoute `reg.waiting` / `updatefound` ; `postMessage({type:'SKIP_WAITING'})` |
| `platform/diag.js` | Journal circulaire (≈ 200 événements) des arrêts GPS / verrou / visibilité / SW / stockage | Remplace les `catch {}` **sur le chemin course uniquement** ; exportable avec la trace |
| `tools/verify.mjs` | Garde avant déploiement : syntaxe, couverture de `SHELL`, version unique, validité du pack | Node pur, sans dépendance |

---

## Recommended Project Structure

Principe : **on n'en déplace aucun fichier existant avant la course.** Les nouveaux modules vivent dans des sous-dossiers neufs ; les imports de `js/*.js` existants ne changent pas.

```
js/
├── app.js                  # existant : perd des lignes, ne gagne que des appels
├── geo.js wind.js polar.js router.js tactics.js track.js debrief.js ...   # existants, inchangés d'emplacement
├── util.js                 # NOUVEAU (jalon 1) : esc, store, today/addDays/dayName (remplace 7 copies de esc)
├── platform/               # NOUVEAU : adaptateurs navigateur (jalon 2)
│   ├── racesession.js  gps.js  wakelock.js  swupdate.js  diag.js  idb.js
├── regatta/                # NOUVEAU : entité partagée (jalons 3-4)
│   ├── model.js  snapshot.js          # purs
│   ├── store.js  sync.js  ui.js       # IndexedDB, réseau, DOM
└── venue/                  # NOUVEAU : pack de plan d'eau (jalon 5)
    ├── schema.js  loader.js           # schema = pur
api/
├── _crew.js                # NOUVEAU : table des membres partagée avec middleware.js (une seule source)
├── _store.js               # NOUVEAU : enveloppe @vercel/blob (get sans cache, put conditionnel)
├── regattas.js regatta.js blob.js     # NOUVEAU : à plat, comme l'existant (pas de routes dynamiques)
tests/                      # NOUVEAU : node --test ; ajouter `tests/` à .vercelignore
├── fixtures/               # GPX Coupe SNPM, texte des IC, snapshot météo, vent figé
├── golden/                 # sorties de référence (JSON) avec tolérances
└── *.test.js
tools/
├── verify.mjs  stamp.mjs   # NOUVEAU : contrôle + génération SHELL/VERSION
└── build_venue.mjs         # NOUVEAU (jalon 5) : courses.js -> venue.json, une fois
data/venues/toulon/         # NOUVEAU (jalon 5) : venue.json + terrain/ + fond de carte
```

### Structure Rationale

- **Sous-dossiers neufs, fichiers existants figés :** un déplacement de fichier touche `sw.js`, `index.html`, tous les imports et la mémoire de cache des téléphones. Le gain est nul pour la régate, le risque non. Les déplacements (`data/` vers `data/venues/toulon/`) viennent après la course, une fois `stamp.mjs` générant `SHELL`.
- **`api/` à plat :** même style que `voice.js`/`debrief.js`, et pas de dépendance à des routes dynamiques Vercel pour un livrable à 19 jours. L'identifiant passe en paramètre de requête.
- **`_crew.js` partagé :** la table des empreintes existe aujourd'hui seulement dans `middleware.js`. Une seule copie importée par le middleware et par les fonctions évite deux listes à tenir à jour. (À vérifier : l'import d'un module de `api/` depuis le middleware Edge ; repli = dupliquer la table et ajouter un test qui compare les deux.)

---

## Architectural Patterns

### Pattern 1 : Local d'abord, serveur = réplique (outbox)

**What:** L'écran lit et écrit toujours le stockage local (`regatta/store.js`). Chaque écriture ajoute une opération idempotente à l'outbox. `sync.js` la vide quand le réseau et l'état le permettent.
**When to use:** Toujours ici : l'app est utilisée en mer, hors réseau, et la course ne doit jamais attendre un `fetch`.
**Trade-offs:** (+) aucune panne serveur ne bloque la régate ; (+) permet de livrer le modèle local avant le serveur ; (-) il faut un état de synchro visible (« 2 éléments en attente »).

```js
// regatta/store.js (esquisse)
export async function commit(regattaId, op) {          // op = {type:'field'|'item', key, value, t, by}
  const next = applyOp(await load(regattaId), op);      // regatta/model.js, pur
  await tx(['regattas', 'outbox'], (s) => { s.regattas.put(next); s.outbox.put({ regattaId, ...op }); });
  scheduleSync();                                       // no-op si verrou course
  return next;
}
```

### Pattern 2 : Manifeste fusionnable + objets immuables (conflits à 3 éditeurs)

**What:** Une régate = **un petit manifeste** modifiable + **des objets immuables** référencés par lui.

```
regattas/<id>/manifest.json         # petit, fusionnable
regattas/<id>/snap/<kind>-<t>-<by>.json     # prévisions, relevés, analyse (immuable)
regattas/<id>/trace/<traceId>.json          # points (immuable une fois la course terminée)
regattas/<id>/debrief/<traceId>/<t>-<by>.json   # faits + réponses + récit IA (immuable, versions)
regattas/<id>/report/<t>-<by>.html          # rapport HTML (immuable)
```

Le manifeste porte des **champs à horodatage** (`fields.name = {v, t, by}`) et des **éléments** (`items[key] = {kind, ref, t, by, del?}`). La fusion est : par champ, le plus grand `(t, by)` gagne ; par élément, idem, la suppression étant une pierre tombale. Propriétés : commutative, associative, idempotente → l'outbox peut rejouer sans risque, l'ordre d'arrivée des 3 éditeurs n'a pas d'importance, et l'**historique des débriefs vient gratuitement** (versions immuables, le manifeste pointe la plus récente).

**When to use:** 3 éditeurs, modifications rares et presque toujours sur des champs différents, aucun besoin de collaboration temps réel.
**Trade-offs:** (+) ~60 lignes testables, pas de bibliothèque CRDT, pas de WebSocket ; (-) « le dernier gagne » par champ peut écraser une correction proche (mitigation : champ `ic.text`/`keyRules` traité comme un seul champ, et notification « modifié par Teiva à 14:02 » à l'ouverture).

```js
// regatta/model.js (pur) — signature de la fusion
export function mergeManifest(a, b) {
  const pick = (x, y) => (!x ? y : !y ? x : (x.t - y.t || (x.by > y.by ? 1 : -1)) >= 0 ? x : y);
  const fields = {}; for (const k of new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])) fields[k] = pick(a.fields[k], b.fields[k]);
  const items = {};  for (const k of new Set([...Object.keys(a.items),  ...Object.keys(b.items)]))  items[k]  = pick(a.items[k],  b.items[k]);
  return { ...a, fields, items, rev: Math.max(a.rev, b.rev) + 1 };
}
```

Le statut suit une règle simple : champ ordinaire, mais l'interface n'offre que les transitions avant (`upcoming → raced → archived`).

### Pattern 3 : Fusion côté serveur avec écriture conditionnelle (Vercel Blob)

**What:** Le client envoie **son manifeste complet**, le serveur le fusionne avec l'existant et réécrit avec `ifMatch: etag` ; sur `BlobPreconditionFailedError` (412) il relit et refusionne (3 essais). La réponse renvoie le manifeste fusionné, que le client adopte.
**Why Blob :** stockage Vercel de première partie, accès **privé** (`access: 'private'`), `put/get/del` avec `ifMatch` (vérifié dans la doc SDK), `allowOverwrite` désactivé par défaut (donne gratuitement un « créer si absent »), lecture `get(..., { useCache: false })` pour une lecture cohérente. Aucun nouveau fournisseur, aucune base à provisionner, compatible avec la contrainte « stockage partagé compatible Vercel ».
**Trade-offs:** pas de requêtes ; la liste des régates passe par `list({prefix:'regattas/'})` puis lecture des manifestes (quelques dizaines par an : acceptable). Repli si cela se révèle pénible : Postgres Neon via le Marketplace Vercel, `UPDATE ... WHERE rev = $n` ; le modèle (manifeste + objets) se transpose tel quel.

```js
// api/regatta.js (esquisse)
for (let i = 0; i < 3; i++) {
  const cur = await getJson(`regattas/${id}/manifest.json`, { useCache: false });   // {data, etag}
  const merged = cur ? mergeManifest(cur.data, incoming) : incoming;
  try { await put(path, JSON.stringify(merged), { access: 'private', allowOverwrite: true, ifMatch: cur?.etag, contentType: 'application/json' }); return json(merged); }
  catch (e) { if (!(e instanceof BlobPreconditionFailedError)) throw e; }
}
```

**Création :** identifiant **déterministe** `AAAA-MM-JJ-<club>` (+ suffixe si plusieurs courses le même jour), `put` sans écrasement. Si Teiva et Thibaud créent la même épreuve, le second reçoit « existe déjà » et ouvre l'existante (fusion des champs) au lieu de créer un doublon. Avant création, l'interface liste les régates du même jour.

### Pattern 4 : Instantané automatique « au moment où ça compte »

**What:** Les prévisions d'un jour passé changent (Open-Meteo) : si on ne fige pas le vent attendu **avant le départ**, l'archive perd « le vent et la stratégie du jour ». Le déclencheur est donc automatique : premier `recorder.start`, ouverture du mode départ, ou bouton « Figer la stratégie ». Contenu : `consensus(series)` borné au jour ± quelques heures, points du modèle retenu, `S.obs`, classement des modèles, **la route conseillée projetée** (bords, chemins, ETA), **les marques réellement utilisées** (positions), `venueId` + `venueRev`.
**Why les marques :** les positions « approx » seront corrigées plus tard ; l'archive ne doit pas être réécrite par une correction de code.
**Trade-offs:** un instantané de ~100-300 Ko ; plusieurs instantanés par régate possibles (« avant », « départ », « après »), tous immuables.

### Pattern 5 : Session de course = un verrou unique (anti-surprise)

**What:** `RaceSession.active` est vrai si l'enregistrement tourne, le mode départ est ouvert, le chrono court, ou le GPS est actif. Persisté (`rade.racelock` = `{since, reason}`) pour survivre à un rechargement ou à un relancement après arrêt par iOS (valide ~6 h). Tant qu'il est actif :
- le worker en attente **n'est pas appliqué** (bandeau discret « mise à jour prête, appliquée après la course ») ;
- la synchro **entrante** est suspendue (jamais de plan modifié par un équipier sous les pieds de celui qui navigue ; « mise à jour de Teiva disponible » à la place) ;
- la synchro sortante est différée (les traces partent à l'arrêt de l'enregistrement).
Au démarrage à froid avec un verrou récent : proposer « reprendre la trace ouverte / terminer ».

### Pattern 6 : Enregistrement résilient (blocs, reprise, trous)

**What:** `tracks` (métadonnées : `open`, `gaps`, `regattaId`, `device`) + `trackpts` (blocs `{id, seq, pts[≈30]}` ajoutés, jamais réécrits). Vidage immédiat sur `pagehide` et `visibilitychange → hidden`. `navigator.storage.persist()` demandé au premier enregistrement. Un trou (> 10-15 s sans fix, écran verrouillé, GPS refusé) est **consigné** (`gaps:[{from,to,reason}]`) et `analyzeTrack` **coupe** les segments à cet endroit au lieu d'interpoler. `getTrack` sait lire l'ancien format (points dans l'objet) : migration sans conversion.
**Honnêteté plateforme :** sur iPhone, une page PWA n'obtient plus de position écran verrouillé ; le verrou d'écran (Wake Lock) évite le verrouillage tant que la page est visible (corrigé pour les apps écran d'accueil à partir d'iOS 18.4 ; avant, il pouvait être indisponible en mode standalone). L'architecture ne prétend donc pas « enregistrer en arrière-plan » : elle **détecte, signale et répare**. L'import d'un GPX Open GPX Tracker (pratique actuelle de l'équipage) reste le chemin de secours de premier rang et doit rester aussi simple que l'enregistrement interne.

---

## Data Flow

### Flux A : ouvrir une régate à venir (n'importe quel équipier, sans Romain)

```
[Équipier : « Nouvelle régate »]
   → liste du jour / de la date (local + /api/regattas si réseau) ── existe ? ── oui → ouvrir
   → [PDF des IC] → events.pdfText → parseIC → formulaire (events.eventForm) → vérification humaine
   → regatta/store.commit(createRegatta{id, venueId:'toulon-rade', club, date, ic, plan})
   → écran Régate (plan : parcours possibles, ligne, classes) ; S.* du plan dérivés de la régate ouverte
   → outbox → api/regattas (put-si-absent) → api/regatta (fusion) → Blob manifest.json
   ← manifeste fusionné → store local (les autres équipiers le voient au prochain démarrage / retour réseau)
```
`events.js` (`rade.events.v1`) est **absorbé** : au premier lancement, la liste locale existante est migrée en régates `upcoming`/`raced` locales (la Coupe SNPM devient la première entrée d'archive). Régate d'un autre club : mêmes étapes, sans catalogue de parcours CVAT ; le plan propose les parcours du pack ou un parcours « construit » (barrière + marque au vent).

### Flux B : jour de course (aucun appel serveur critique)

```
[Ouvrir la régate] ─→ prévisions (cache/snapshot) ─→ champ de vent ─→ analyse ─→ écran Brief/Parcours
[Départ/GPS] ─→ racesession.begin() ─→ wakelock.acquire() ─→ gps.watch() ─→ recorder.add() ─→ trackpts (blocs)
                    │                                             └─ silence>10 s / hidden → diag.log + gap + bandeau + bip
                    └─ snapshot automatique « départ » (regatta/snapshot.toSnapshot) → store local (outbox différée)
[Arrêt] ─→ recorder.stop() (clôt `open`) ─→ racesession.end() ─→ outbox : trace + snapshot ─→ sync
```
Aucune écriture réseau pendant `RaceSession.active`. Le service worker n'intercepte pas `/api/*` (inchangé).

### Flux C : après la course → archive partagée

```
[Trace locale | GPX importé] ─→ lier à la régate (proposition : date de la trace ±1 jour)
   → debrief.detect/analyze (pur) ─→ /api/debrief (récit) ─→ buildReport (HTML)
   → objets immuables : debrief/<traceId>/<t>-<by>.json, report/<t>-<by>.html
   → manifeste : items.debrief:<traceId> → ref ; fields.status = 'raced' puis 'archived'
   → autre équipier / autre appareil : liste des régates → ouvrir → manifeste → objets à la demande
        (mis en cache IndexedDB ; lisible hors ligne après première ouverture)
```
Les rapports archivés sont servis par `api/blob.js` (authentifié), **pas** sous `rapports/` (qui contourne le middleware). Un bouton « publier » (copie publique) reste un geste explicite, hors périmètre.

### Flux D : synchronisation et conflits

```
sync.run():  si RaceSession.active → sortir
  1. pousser outbox (par régate) : api/regatta ← manifeste local  → réponse = manifeste fusionné → écrire local, vider outbox
  2. pousser objets immuables manquants : api/blob (PUT sans écrasement ; 409/déjà présent = succès)
  3. tirer : api/regattas (liste) → pour chaque manifeste plus récent : fusionner localement (même mergeManifest)
  4. notifier si un champ affiché a changé ailleurs (« modifié par Teiva »)
```

### Flux E : mise à jour de l'app

```
déploiement → nouveau sw.js (VERSION changée par stamp.mjs) → install (précache) → état « waiting »
   → swupdate : bandeau « Nouvelle version prête »
        ├─ RaceSession.active → ne rien faire (bandeau discret)
        └─ sinon : au prochain démarrage à froid (ou bouton) → SKIP_WAITING → controllerchange → reload UNE fois
```

### State Management

```
S (localStorage 'rade.state', clés de DEF)  ← reste le magasin de l'écran, MAIS
   les champs de plan (courseId, cls, laps, startTime, linePreset, lineLen, lineMode, lineBrg, lineOverride, day)
   deviennent « valeurs affichées de la régate ouverte » :
      ouvrir régate → S.plan ← régate.fields.plan ;  modifier plan → commit(champ) + persist()
   le jour affiché (S.day) n'est plus forcé à aujourd'hui quand une régate passée est ouverte en lecture
```

### Key Data Flows

1. **Prévision → décision :** inchangé (`fetchAll → consensus → modelPoints → WindField → analyzeLeg`). Le seul ajout est la **capture** du résultat en instantané.
2. **Capture → archive :** instantané automatique + trace + débrief, tous immuables, référencés par le manifeste.
3. **Pack de plan d'eau → modules :** `venue/loader` charge une fois, puis les modules lisent le pack par accesseurs au moment de l'appel (pas par constantes figées à l'import).

---

## Venue pack (données propres à un plan d'eau)

### Ce qui est donnée, ce qui reste code

| Donnée (dans le pack) | Reste du code |
|---|---|
| Origine de projection, centre, point du badge de vent, filtre géographique des balises | `toXY/toLL` (reçoivent l'origine), `WindField` (physique), `route()`, `analyzeLeg` |
| Terrain, couverture, côte, fond de carte, masque, snapshot météo | `Terrain.load(base)` (reçoit le dossier du pack) |
| Grille météo, point marin | `fetchAll()` (lit la grille du pack) |
| Lieux nommés (`PLACES`), dangers, zones interdites | Calcul d'effets de site (`placeNear`) |
| Savoir local : `REGIMES` en **données** (`{id, name, dirMin, dirMax, minSpd, tips[]}`) | Sélection du régime (`regimeOf`) |
| `clubs.<id>` : marques numérotées, cahier de parcours, lignes prédéfinies, valeurs par défaut des IC (séquence, pavillons, groupes), position d'arrivée spéciale (`finishNear1`) | Construction des bords (`buildLegs`) |

Polaire (`data/j80.pol`) = donnée du **bateau**, pas du plan d'eau : hors pack.

### Forme (schéma 1)

```
data/venues/toulon/venue.json
{ "schema": 1, "id": "toulon-rade", "name": "Rade de Toulon", "rev": 1,
  "origin": {lat,lon}, "center": {lat,lon}, "probe": {lat,lon},
  "wx": { "grid": [{lat,lon}...], "marine": {lat,lon}, "liveBbox": [lat0,lon0,lat1,lon1] },
  "terrain": { "base": "data/venues/toulon/" },
  "places": [...], "dangers": [...], "forbiddenZones": [[{lat,lon}...]],
  "localKnowledge": { "regimes": [...] },
  "clubs": { "cvat": { "name": "CVAT", "courseBook": {"rev":"V2-2025-11", "marks": {...}, "courses": [...]},
                       "linePresets": {...}, "defaultLine": {...}, "icDefaults": {...} } } }
```

### Chemin de migration à risque minimal (chaque marche est déployable seule)

| Marche | Contenu | Garde-fou |
|---|---|---|
| V0 **Façade** | `js/venue/index.js` ré-exporte l'existant (`courses.js`) ; les 4 modules qui importent `courses.js` passent par la façade | Test : valeurs de la façade `deepEqual` aux constantes d'origine |
| V1 **Injection** | `geo.setOrigin()`, `weather` lit sa grille / son centre / sa bbox via la façade ; les 6 coordonnées en dur de l'inventaire ci-dessus sortent du code | Tests dorés (vent, route, ETA) inchangés à la tolérance près |
| V2 **JSON** | `tools/build_venue.mjs` **génère** `venue.json` depuis les exports de `courses.js` (aucune retranscription à la main) ; `loader` le charge dans `init()` | Test : `venue.json` chargé `deepEqual` à l'ancien export, puis suppression de `courses.js` |
| V3 **Déplacement** | `data/*` vers `data/venues/toulon/` ; `SHELL` généré par `stamp.mjs` | `verify.mjs` : tout fichier référencé existe et est précaché ; essai hors ligne sur appareil |
| V4 **Validation** | `venue/schema.js` : marques dans l'emprise, parcours qui ne citent que des marques existantes, polygones fermés, ligne de départ en mer (`!isLand`) | Exécuté par `verify.mjs` : comble l'écart « données de parcours non testées » de CONCERNS.md |

**Hors périmètre maintenant :** outils Python de génération de terrain paramétrés par pack, second plan d'eau réel, `api/rules.js` (la constante `CVAT` y suit le pack du club plus tard). Seules l'ouverture et la forme du pack sont livrées, conformément à la décision de Romain.

---

## Carving : extraire des modules testables sans tout casser

### Règle de couture (« strangler »)

Une extraction = **une fonction ou un panneau**, jamais un redécoupage global. Pour chaque extraction : (1) écrire d'abord le test de caractérisation de la sortie actuelle ; (2) déplacer le code vers un module qui reçoit un état **explicite** (pas `S` global) ; (3) `app.js` appelle le module ; (4) le test reste vert. Ordre d'extraction, du moins risqué au plus utile :

1. `util.js` : `esc` (7 copies), `store`, `today/addDays/dayName` : mécanique, vérifiable par `grep`.
2. `platform/wakelock.js`, `platform/gps.js`, `platform/racesession.js` : déjà nécessaires à la fiabilité (jalon 2), ce sont les extractions « gratuites » depuis `startGps`/`Recorder`/`startmode`.
3. `regatta/*` et `venue/*` : nouveaux modules, pas d'extraction.
4. **Seulement après la course :** panneaux `renderBrief`, `renderCourse`, `renderLive`, `runAnalysis` vers des modules à état explicite.

**À ne pas toucher avant la course :** `wind.js`, `router.js`, `tactics.js`, `polar.js` (aucun refactoring, uniquement des tests dorés) ; le coût d'une dérive silencieuse est un mauvais conseil en mer.

### Harnais de non-régression (zéro dépendance)

| Couche | Outil | Contenu |
|---|---|---|
| Syntaxe / intégrité | `tools/verify.mjs` | `node --check` sur `js/**` et `api/**` ; `SHELL` ⊇ tous les fichiers `js/**`, `data/**`, `vendor/**` utiles ; `VERSION` de `sw.js` = version affichée = `stamp` ; pack valide |
| Frontière du cœur | test d'import | Importer chaque module « cœur » sous Node **sans** `document`/`window`/`localStorage` : un accès DOM à l'import fait échouer le test |
| Tests dorés | `node --test` + `node:assert/strict` | Géométrie (`toXY/toLL`, aller-retour), polaire (vitesses connues, VMG), `route()` sur le champ figé (temps ± tolérance), `analyzeLeg/analyzeStart` (texte structuré clé), `WindField` sur vent figé (échantillons en quelques points), `analyzeTrack` + `detect/analyze` sur le **GPX de la Coupe SNPM** (départs, faux départs, parcours 4 réduit, % polaire) |
| Données | tests de pack | Marques (dont les 2 `approx`), parcours, lignes, zone interdite |
| Fusion | tests de propriétés simples | `mergeManifest` commutative / idempotente sur jeux aléatoires courts ; migration `rade.events.v1` |
| Accès | test du middleware | Importer `middleware.js` avec `Request` simulées : cookie valide, code invalide, `?acces=`, chemins publics (`acces.html`, `sw.js`, `rapports/`, `icons/`), `/api/*` sans cookie = 401 |
| Navigateur | Playwright (déjà utilisé hors dépôt) | Fumée seulement : chargement, SW installé, hors ligne ; **pas** de tests GPS/iOS (voir essai en mer) |

**Fixtures à rapatrier dans `tests/fixtures/`** (elles existent aujourd'hui seulement dans les dépôts de session, pas dans le projet) : le GPX de la Coupe SNPM (≈ 1,4 Mo, ≈ 9 500 points), le texte extrait du PDF des IC (pour `parseIC`), `data/wx-snapshot.json`. Les sorties de référence (« dorées ») sont générées **une fois** à partir du comportement actuel puis relues par Romain : elles caractérisent, elles ne prouvent pas que le modèle est juste. La justesse physique (balises, vent) reste une vérification humaine séparée (exigence « Justesse »).

**Déploiement :** `npm run verify` avant chaque mise en ligne. Intégration à Vercel via `buildCommand` recommandée une fois la suite stable (un échec bloque la mise en ligne, voulu) ; avant cela, l'exécuter à la main. Ajouter un `.vercelignore` (`tests/`, `srv.log`, `docs/`).

---

## Fiabilité en mer : composants et règles

| Risque | Composant | Règle d'architecture |
|---|---|---|
| Mise à jour en course | `platform/swupdate.js`, `sw.js`, `stamp.mjs` | Pas de `skipWaiting()` à l'installation ; message `SKIP_WAITING` seulement hors course ; `controllerchange` ne recharge **que** si l'utilisateur l'a demandé ou au démarrage à froid sans verrou ; `reg.update()` au retour au premier plan reste (il ne fait que préparer). Cible : `SHELL` en cache d'abord depuis le cache versionné (ensemble cohérent), **uniquement** quand `stamp.mjs` génère `VERSION` à partir des empreintes (sinon un oubli de version gèle l'app) |
| Trace perdue | `platform/idb.js`, `track.js` | Blocs ajoutés, `open:true`, vidage sur `pagehide`/`hidden`, reprise au démarrage, `persist()` |
| GPS muet | `platform/gps.js` | Chien de garde (silence > 10 s) : relancer `watchPosition`, bandeau rouge et bip, trou consigné |
| Écran qui se verrouille | `platform/wakelock.js` | Un seul verrou compté ; ré-acquis sur `visibilitychange` visible et sur `release` ; état visible dans l'UI du mode départ et de la course |
| Arrêt silencieux | `platform/diag.js` | Journal circulaire, affiché dans un écran « Diagnostic » et joint aux métadonnées de la trace ; `window.onerror` / `unhandledrejection` y écrivent |
| Plan modifié sous les pieds | `RaceSession` + `sync.js` | Synchro entrante suspendue pendant le verrou |
| Cache hors ligne incomplet | `verify.mjs` | `vendor/pdf.min.js` et `pdf.worker.min.js` ajoutés à `SHELL` (ou lecture du PDF documentée comme « en ligne ») |

**Essai en mer comme porte de livraison :** 60 minutes téléphone verrouillé / déverrouillé, appel entrant, bascule d'application, mode avion, batterie faible, **déploiement volontaire pendant l'essai** (le bandeau doit apparaître sans rechargement). Cet essai se fait sur l'iPhone de l'équipage en app installée (comportement différent de Safari).

---

## Suggested Build Order (dépendances et coupes)

Calendrier indicatif : aujourd'hui J0 = 19/10 ; régate J+19 à J+21 (7-9/11). **Gel du code à J+14 (2/11)**, ensuite seulement des corrections. Les marches V0-V1 du venue pack sont optionnelles avant la course ; V2 et suivantes viennent après.

```
J0   ┌ 1. Filet de sécurité ─────────────┐
J3   │ verify.mjs · stamp.mjs · util.js  │
     │ tests dorés (geo/polar/route/trace)│
J3   ├ 2. Fiabilité en mer ──────────────┤  ← prioritaire (exigence #1), dépend de 1
J10  │ swupdate · racesession · wakelock │
     │ gps · diag · enregistrement blocs │
J8   ├ 3. Régate local-d'abord ──────────┤  ← dépend de 1 (tests) ; parallélisable avec la fin de 2
J14  │ model · store · ui · migration    │
     │ instantané automatique            │
J12  ├ 4. Synchro serveur + archive ─────┤  ← dépend de 3 ; coupe possible
J17  │ _crew · _store · API · sync       │
     │ archive lisible hors ligne        │
J14  ├── GEL + essai en mer + correctifs ┤
J21  ╞═══ RÉGATE ═══════════════════════╡
J21+ └ 5. Venue pack (V0→V4) + découpage des panneaux d'app.js
```

| # | Jalon | Livre | Dépend de | Sans lui |
|---|-------|-------|-----------|----------|
| 1 | Filet de sécurité | `verify`, `stamp` (SHELL + version uniques), `util.js`, tests dorés sur la Coupe SNPM, test d'accès, `.vercelignore` | rien | on refactorise à l'aveugle |
| 2 | Fiabilité en mer | mise à jour différée, session de course, GPS surveillé, verrou d'écran unique, enregistrement par blocs avec reprise et trous, journal de diagnostic, trous gérés dans `analyzeTrack` | 1 (tests et `stamp`) | risque de perdre la trace d'une course |
| 3 | Régate local-d'abord | entité (`upcoming→raced→archived`), « ouvrir une régate » depuis les IC, migration de `rade.events.v1`, lien trace↔régate, instantané automatique, écran Archive **locale** | 1 ; réutilise `racesession` de 2 | rien à synchroniser |
| 4 | Synchro serveur + archive partagée | `_crew`, `_store`, `api/regattas|regatta|blob`, `sync.js`, fusion testée, archive consultable sur un autre appareil, hors ligne après première ouverture | 3 ; **action de Romain : créer le magasin Blob privé** et exposer le jeton au projet | l'archive reste par appareil (les données sont tout de même sauvegardées localement et rattrapées plus tard) |
| 5 | Venue pack + extraction | V0 à V4, puis panneaux de `app.js` un par un | 1 (tests dorés), 3 (champ `venueId` déjà présent) | ajout d'un plan d'eau = édition de code |

**Pourquoi cet ordre :**
- 1 avant tout : sans tests dorés et sans `stamp`, les jalons 2 (qui modifient `sw.js` et l'enregistrement) et 5 (qui déplace des données) sont à haut risque.
- 2 avant 3-4 : l'exigence n°1 du jalon est la fiabilité ; et le correctif du service worker (le plus grave défaut constaté) est une journée de travail pour un risque énorme.
- 3 avant 4 : le modèle local est livrable seul, donne de la valeur le jour J (instantané automatique), et réduit à presque zéro le risque de calendrier du serveur.
- `venueId` et `venueRev` sont **écrits dès le jalon 3** dans chaque régate et instantané (coût nul) : les archives de la saison seront compatibles avec le pack futur sans migration.
- 5 après la course : valeur future, risque présent (touche ~10 fichiers et le cache hors ligne).

**Coupes en cas de retard (de la moins coûteuse à la plus coûteuse) :** reporter la fusion côté serveur (envoyer uniquement des objets immuables + manifeste sans fusion, un seul éditeur à la fois) ; reporter l'écran Archive partagé (garder l'archive locale + l'export existant) ; reporter le chien de garde GPS. **Ne jamais couper :** mise à jour différée, reprise de trace, tests dorés.

---

## Scaling Considerations

L'échelle est 3 utilisateurs ; « grandir » signifie ajouter des plans d'eau et des saisons, pas des utilisateurs.

| Échelle | Ajustement |
|---------|------------|
| Équipage (3), ~20 régates/an | Blob + manifeste par régate ; liste par `list()` ; aucun index |
| 10 membres / 100 régates | Index `regattas/index.json` reconstructible, mis à jour par l'API en best-effort ; liste paginée côté client |
| Autres équipages (hors périmètre) | Passer à une base (Neon) avec comptes ; table des membres sortie du code (déjà identifié dans CONCERNS.md) |

**Premier goulot :** taille des traces. ~9 500 points = ~0,5 Mo en JSON compact ; la limite de corps des fonctions Vercel (≈ 4,5 Mo) laisse de la marge ; compresser (`CompressionStream`, Safari 16.4+) seulement si nécessaire. **Deuxième :** instantanés météo complets : borner le contenu (voir Pattern 4).

---

## Anti-Patterns

### Anti-Pattern 1 : synchroniser par « dernier document complet gagne »
**What people do:** envoyer toute la régate (traces comprises) à chaque modification ; le dernier PUT écrase.
**Why it's wrong:** trois équipiers qui éditent à la même heure (veille de régate) perdent des modifications sans le savoir ; les traces lourdes alourdissent chaque écriture.
**Do this instead:** manifeste fusionnable + objets immuables (Pattern 2), écritures conditionnelles côté serveur (Pattern 3).

### Anti-Pattern 2 : sérialiser les objets vivants (`analysis`, `F`, `T`)
**What people do:** `JSON.stringify(analysis)` pour l'archive.
**Why it's wrong:** références au terrain/champ, tailles imprévisibles, format qui change avec le code ; l'archive devient illisible après un refactoring.
**Do this instead:** projection explicite versionnée (`snapshot.js`, champ `schema`), testée.

### Anti-Pattern 3 : appliquer la synchro ou la mise à jour sans regarder si on est en course
**What people do:** rafraîchir la liste, ou activer le nouveau worker, dès que le réseau revient.
**Why it's wrong:** au retour du réseau en rade (couverture intermittente), le plan s'actualise sous le barreur ; un rechargement perd chrono et trace.
**Do this instead:** `RaceSession` comme unique arbitre (Pattern 5).

### Anti-Pattern 4 : constantes de lieu figées à l'import
**What people do:** `import { MARKS } from './courses.js'` et `const GRID = []` calculé au chargement.
**Why it's wrong:** un pack chargé dynamiquement n'existe pas encore à l'import ; on garderait deux sources de vérité.
**Do this instead:** accesseurs lus à l'appel après `loadVenue()` ; `geo.setOrigin()` appelé avant tout calcul.

### Anti-Pattern 5 : introduire un outil de build ou un framework « pour y voir plus clair »
**Why it's wrong:** contredit la contrainte (JS sans build, chargement léger), double la surface de risque avant la course, et le gain (tests) s'obtient avec Node natif.
**Do this instead:** `node --test`, scripts `tools/*.mjs`, rien dans le chemin de chargement de l'app.

### Anti-Pattern 6 : toucher à la physique pour « nettoyer » pendant le découpage
**Do this instead:** tests dorés d'abord ; le renommage des variables cryptiques de `wind.js` (déjà noté dans CONCERNS.md) se fait après la course, avec comparaison avant/après.

---

## Integration Points

### External Services

| Service | Pattern d'intégration | Notes |
|---------|----------------------|-------|
| Vercel Blob (privé) | `@vercel/blob` dans `api/_store.js` ; jeton fourni par l'intégration au projet | `ifMatch` + `useCache:false` vérifiés dans la doc SDK (HIGH) ; cohérence de `list()` non vérifiée (LOW) : ne jamais en dépendre pour l'unicité (l'unicité vient du `put` sans écrasement) |
| Alternative : Postgres (Neon via Marketplace Vercel) | `UPDATE ... WHERE rev = $n` | À n'envisager que si Blob gêne ; mêmes objets logiques |
| OpenAI (`/api/debrief`) | Inchangé | Le payload du débrief devrait être borné (CONCERNS.md) : à faire quand on touche `debrief.js` |
| Open-Meteo / Pioupiou | Inchangé, via `weather.js` | Les coordonnées viennent du pack (jalon 5) ; l'instantané fige les prévisions du jour |
| Service worker | `/api/*` non intercepté (inchangé) | Le cache hors ligne des régates est en IndexedDB, pas dans le cache du SW |

### Internal Boundaries

| Frontière | Communication | Notes |
|----------|---------------|-------|
| `app.js` ↔ `regatta/store` | Appels de fonctions + abonnement (`onChange`) | `app.js` ne connaît ni IndexedDB ni `fetch` |
| `regatta/model` ↔ `api/regatta.js` | Import direct du même fichier ES | Module pur ; si l'import hors de `api/` pose problème au déploiement, copie générée par `stamp.mjs` |
| `racesession` ↔ `swupdate` / `sync` | Lecture d'un drapeau + événement `end` | Seul arbitre ; aucun autre module ne devine « on est en course » |
| `track.js` ↔ `regatta/store` | `regattaId` ajouté aux métadonnées de trace (IndexedDB v1→v2, sans conversion) | `getTrack` lit les deux formats |
| `middleware.js` ↔ `api/*` | Même table de membres (`api/_crew.js`) | Les fonctions recalculent le membre pour `by` |
| `venue/loader` ↔ `geo`, `weather`, `tactics`, `scene3d`, `app` | Injection au démarrage | Un seul pack actif à la fois |

---

## Pitfalls spécifiques à cette intégration (à traiter dans les plans)

1. **Faux départs / trous dans la trace** : la fusion « réparer le trou » est tentante (interpoler). Ne pas le faire : couper les segments, sinon vitesses et virements du débrief sont faux.
2. **Création en double d'une régate** par deux équipiers : identifiant déterministe + création sans écrasement.
3. **`S.day` forcé à aujourd'hui** : empêche d'ouvrir une régate passée ; découpler « jour affiché » et « jour de la régate ».
4. **Cache-first prématuré** : basculer le SW en « cache d'abord » avant que `stamp.mjs` ne génère `VERSION` = app gelée sur l'ancienne version. Ordre imposé : `stamp` d'abord.
5. **Rapport sous `rapports/`** : public par construction. Les archives passent par `api/blob.js`.
6. **Vercel Blob « 60 s de propagation » sur lecture en cache** : lectures de manifeste en `useCache:false` ; l'écrivain reçoit le manifeste fusionné dans la réponse (pas de relecture).
7. **Fixtures qui n'existent pas dans le dépôt** : le GPX et le PDF des IC sont dans le dossier de session ; les copier avant toute autre chose, sinon le jalon 1 est bloqué.
8. **Fuite de code d'accès** : le cookie contient le code brut (CONCERNS.md). Les nouvelles API restent derrière le même contrôle ; ne pas aggraver (aucun code dans les URL, aucune identité renvoyée au-delà du prénom).

---

## Sources

- Code lu directement : `js/app.js` (init, SW, GPS, enregistrement), `sw.js`, `middleware.js`, `js/track.js`, `js/events.js`, `js/geo.js`, `js/weather.js`, `js/courses.js`, `js/tactics.js`, `js/wind.js`, `vercel.json`, `package.json`, `.planning/codebase/*` — HIGH
- Vercel Blob, référence du SDK JS (`ifMatch`, `allowOverwrite`, `access: 'private'`, `get` avec `useCache`) : https://vercel.com/docs/vercel-blob/using-blob-sdk (mise à jour 2026-08-26) — HIGH
- Stockage Marketplace Vercel (Postgres via Neon / Supabase / Aurora, Redis via Upstash) : https://vercel.com/docs/marketplace-storage (mise à jour 2026-09-17) — HIGH
- Wake Lock dans les apps écran d'accueil iOS (WebKit 254545, corrigé iOS 18.4) : https://bugs.webkit.org/show_bug.cgi?id=254545 — MEDIUM (résumé de recherche, à confirmer sur l'iPhone de l'équipage)
- Position/GPS en arrière-plan sous iOS PWA : non confirmé par source (LOW) ; supposé indisponible écran verrouillé, comme l'indique déjà l'aide de l'app (`renderLive`) — à vérifier lors de l'essai en mer
- Cohérence de `list()` sur Vercel Blob, limite exacte de corps des fonctions : non vérifiées (LOW) ; à lire dans la doc au moment du jalon 4

---
*Architecture research for: PWA de tactique de régate (jalon « prêt pour la prochaine régate CVAT »)*
*Researched: 2026-10-19*
