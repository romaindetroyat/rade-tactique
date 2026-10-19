# Technology Stack — jalon « archive partagée, fiabilité en mer, tests »

**Projet :** Rade Tactique (PWA J80 *Naos*, rade de Toulon)
**Recherché le :** 2026-10-19
**Périmètre :** ce qu'il faut AJOUTER à l'existant (JS ES modules sans build, Three.js vendorisé, `sw.js`, Vercel statique + fonctions Node `api/*.js` + `middleware.js`). L'existant n'est pas ré-étudié (voir `.planning/codebase/STACK.md`).
**Hypothèse à confirmer :** le projet Vercel est sur le plan **Hobby** (gratuit). Tous les plafonds ci-dessous sont ceux de Hobby ; le passage à Pro lève la plupart d'entre eux.
**Confiance globale :** HAUTE sur Vercel Blob / limites / Node / tests ; MOYENNE sur le comportement iOS en conditions réelles (à valider sur iPhone) et sur l'extrapolation du budget d'opérations Blob.

---

## Décisions en une page

| Besoin | Choix | Confiance |
|--------|-------|-----------|
| Stockage partagé (GPX, JSON, rapports HTML) | **Vercel Blob, store PRIVÉ**, SDK `@vercel/blob` 2.8.2, accès uniquement via nos fonctions `api/` | HAUTE (docs), MOYENNE (budget d'opérations) |
| Index / métadonnées | Un `index.json` + un `meta.json` par régate dans le même store, écriture concurrente protégée par `ifMatch` (ETag) | HAUTE |
| Edge Config (renommé **Global Config**) | NON : 1 Mo max, 100 écritures/mois, propagation jusqu'à 10 s | HAUTE |
| KV / Redis Marketplace (Upstash) | NON pour l'archive. Réservé plus tard aux quotas OpenAI par équipier (hors jalon) | HAUTE |
| Postgres (Neon / Supabase) | NON maintenant. Plan B si le plafond d'opérations Blob gêne ou si l'on veut des statistiques inter-régates | MOYENNE |
| File d'attente hors-ligne + synchro | **IndexedDB (`idb` 8.0.4 vendorisé) + « outbox » vidée par la page** ; **PAS de Background Sync** (absent de Safari/iOS) | HAUTE |
| Tests | **`node:test` natif** (Node 24), `linkedom` 0.18.13 (DOMParser pour le GPX), `fake-indexeddb` 6.2.6 ; **pas Vitest** | HAUTE |
| E2E | Playwright 1.64.1, **Chromium uniquement**, plus tard, hors porte de déploiement | MOYENNE |
| Porte avant déploiement | `buildCommand` dans `vercel.json` = `npm run check` (échec de build = pas de déploiement) ; GitHub Actions seulement si l'on ajoute Playwright | HAUTE |
| Remontée d'erreurs | **Sentry plan gratuit** (navigateur : bundle CDN **vendorisé** `bundle.min.js` 11.8.0) + tampon d'erreurs local en IndexedDB renvoyé quand le réseau revient | MOYENNE |
| Node | `engines.node: "24.x"` (défaut Vercel actuel) ; Node 20 déprécié chez Vercel le 1er octobre 2026 | HAUTE |

---

## 1. Stockage partagé sur Vercel

### Ce que dit la documentation officielle (vérifié le 2026-10-19)

**Vercel Blob** — page *Usage & pricing* (màj 2026-09-23), *Private storage* (màj 2026-09-15), *JS SDK* (màj 2026-08-26) :

| Élément | Valeur Hobby | Conséquence pour nous |
|---------|--------------|-----------------------|
| Stockage | 1 Go | ~100 GPX de 2 Mo + rapports = quelques centaines de Mo. Large, surtout avec GPX compressés (voir plus bas). |
| Opérations simples (lecture d'un blob **hors cache CDN**, `head`) | 10 000 / mois | **Le plafond qui compte.** Voir « Budget d'opérations ». |
| Opérations avancées (`put`, `copy`, **`list`**, création de store) | 2 000 / mois | `list()` coûte une opération avancée : ne pas lister à chaque ouverture. Les suppressions sont gratuites. |
| Transfert de données Blob | 10 Go / mois | Sans problème à 3 utilisateurs. |
| Débit | 20 simples/s, 15 avancées/s | Sans problème. |
| Taille max d'un blob | 5 To ; 512 Mo en cache CDN | Sans objet. |
| Corps de requête d'une fonction Vercel | **4,5 Mo** (`FUNCTION_PAYLOAD_TOO_LARGE`) | GPX ≤ 2 Mo passent par `api/` ; compresser côté client pour garder de la marge. |
| Dépassement sur Hobby | Pas de facture, **mais Blob inaccessible jusqu'à 30 jours** | Prévoir une alerte (e-mails de seuil Vercel) et un affichage dégradé « archive indisponible, vos données restent sur l'appareil ». |
| Stores | Nombre illimité (changelog « Unlimited Vercel Blob stores ») | Un store privé unique suffit. |

**Stockage privé** (GA, SDK `@vercel/blob` ≥ 2.3, CLI `vc` ≥ 50.20) : les URL `https://<store-id>.private.blob.vercel-storage.com/<chemin>` ne sont lisibles qu'avec authentification. On sert le contenu via une fonction qui vérifie l'accès puis fait `get(pathname, { access: 'private' })` et renvoie `result.stream`. Authentification SDK par **OIDC** quand le store est connecté au projet (variables `BLOB_STORE_ID` et jeton OIDC ajoutés automatiquement) ; en local `vercel env pull` apporte `BLOB_READ_WRITE_TOKEN`.

Points d'API utiles (tous confirmés dans la référence SDK) :
- `put(path, body, { access: 'private', allowOverwrite: true, ifMatch: etag, contentType })` : `ifMatch` lève `BlobPreconditionFailedError` si l'ETag a changé = **écriture optimiste sans conflit silencieux**.
- `get(path, { access: 'private', useCache: false, ifNoneMatch })` : `useCache:false` garantit la dernière version (lecture plus lente, coûte une opération + Fast Origin Transfer) ; `ifNoneMatch` renvoie `304`.
- Un écrasement au même chemin peut mettre **jusqu'à 60 s** à se propager dans le cache CDN, d'où `useCache:false` pour relire juste après une écriture, ou des chemins uniques (UUID) pour tout ce qui est immuable.
- Recommandation officielle : répondre avec `Cache-Control: private, no-cache` + `X-Content-Type-Options: nosniff`, et **vérifier l'accès dans le handler lui-même**, pas seulement dans le middleware (« a middleware bug or misconfiguration could expose cached private content »).

**Edge Config → renommé Global Config** (changelog ; page *Limits* màj 2026-07-29) : 1 Mo par store, 1 store sur Hobby, **100 écritures offertes**, 100 000 lectures offertes, propagation d'écriture jusqu'à 10 s. Fait pour des drapeaux/redirections, pas pour une archive. Piège : lire un Global Config dans le middleware à chaque requête consommerait les 100 000 lectures offertes en quelques jours de navigation (chaque page = des dizaines de requêtes d'assets passant par le middleware).

**Marketplace** (page *Storage overview*, màj 2026-09-03) : Vercel KV et Vercel Postgres n'existent plus comme produits propres ; on provisionne `vercel install neon | upstash | supabase`. Plafonds gratuits (pages tarifs des fournisseurs, lues le 2026-10-19) :

| Fournisseur | Gratuit | Point d'attention |
|-------------|---------|-------------------|
| Neon Postgres | 1 Go/projet, 100 CU-h, mise en veille après 5 min, 5 Go de sortie | Démarrage à froid après veille ; permanent, sans carte. |
| Upstash Redis | 250 Mo, 500 000 commandes/mois, 10 Go de bande passante | Pas fait pour des fichiers de 2 Mo (requête max 10 Mo mais mémoire 250 Mo). |
| Supabase | 500 Mo base + 1 Go fichiers, **projet mis en pause après 7 jours d'inactivité** | La pause hebdomadaire est incompatible avec « j'ouvre l'archive le jour de la régate ». |

### Recommandation : Vercel Blob privé, rien d'autre

**Pourquoi :** les données sont des documents et des fichiers (GPX, JSON de stratégie, débrief, rapport HTML), lus par identifiant de régate ; la seule « requête » est la liste des régates. Blob évite d'introduire schéma, migrations et pilote de base de données dans un projet volontairement sans build. Un seul produit, une seule variable d'environnement, authentification par OIDC.

**Modèle de données (chemins, tous dans le store privé) :**

```
index.json                                   résumés de toutes les régates (id, date, nom, état, nb traces) — petit, relu souvent
regattas/<regattaId>/meta.json               date, IC (texte extrait), parcours possibles, stratégie du jour, débrief JSON, analyse polaire (< ~150 Ko)
regattas/<regattaId>/snapshot-<ts>.json      instantané vent/stratégie (immuable, chemin unique)
regattas/<regattaId>/tracks/<trackId>.gpx.gz trace compressée côté client (CompressionStream), immuable
regattas/<regattaId>/reports/<reportId>.html rapport HTML (~250 Ko), immuable
```

**Règles :**
1. Identifiants générés **côté client** (`crypto.randomUUID()`), chemins déterministes, `allowOverwrite: true` pour que le rejeu d'une file hors-ligne soit idempotent.
2. Seuls `index.json` et `meta.json` sont modifiables : mise à jour par « lire ETag, fusionner, `put` avec `ifMatch`, réessayer 3 fois » (même motif pour l'index). Tout le reste est immuable, donc sans conflit.
3. Ne **jamais** appeler `list()` pour construire l'écran principal (opération avancée, plafond 2 000/mois) : l'index sert de liste. `list()` n'est utilisé que par un outil de réparation.
4. Les routes `api/archive*` valident le chemin par liste blanche (regex stricte, pas de `..`), la taille (≤ ~4 Mo) et le type, **ré-vérifient le cookie** via un module partagé `api/_acces.js` (voir §5) et répondent `Cache-Control: private, no-cache`, `X-Content-Type-Options: nosniff`.
5. **Rapports HTML = contenu stocké servi sur notre origine** : un rapport malveillant ou corrompu s'exécuterait avec le cookie de l'équipage. Servir avec `Content-Security-Policy: sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:` (ou dans un `<iframe sandbox>`), et échapper côté génération.
6. Compression : `CompressionStream('gzip')` côté client (Safari ≥ 16.4) ramène un GPX XML de 2 Mo à ~200-300 Ko : moins de stockage, de transfert et de risque de dépasser 4,5 Mo. Décompression par `DecompressionStream`. Confiance MOYENNE sur le ratio exact (à mesurer sur la trace de la Coupe SNPM).

### Budget d'opérations (à surveiller, c'est le vrai risque)

Estimation prudente pour 3 équipiers : 20 ouvertures de l'archive par jour × 3 lectures non cachées ≈ 180 opérations simples/jour ≈ **5 400/mois sur 10 000**. Trop proche du plafond pour être tranquille. Parades, dans l'ordre :
- cache local IndexedDB de l'index et des `meta.json` récemment ouverts ; rafraîchir au lancement de l'app ou sur « tirer pour actualiser », pas à chaque navigation ;
- garder le `Cache-Control` par défaut des blobs immuables (les hits CDN ne comptent **pas** comme opérations simples) ;
- `ifNoneMatch` (un 304 évite le transfert mais compte probablement comme opération : MOYENNE, à mesurer) ;
- **seuil de décision :** si l'onglet Observabilité > Blob dépasse ~60 % des 10 000 après deux week-ends de régate, soit passer Pro (plafonds levés, ~20 $/mois), soit déplacer `index.json`/`meta.json` vers Neon et garder Blob pour les fichiers.

**Rejeté :** Supabase (pause à 7 jours d'inactivité), Upstash comme archive (250 Mo, pas conçu pour des fichiers), Edge/Global Config (1 Mo), Vercel Blob **public** (URL non devinable mais non authentifiée : viole la contrainte « toute donnée partagée reste derrière le contrôle d'accès »).

### Installation (stockage)

```bash
npm i @vercel/blob@^2.8.2
vercel blob create-store rade-archive --access private --yes   # CLI vc >= 50.20
vercel env pull .env.local                                      # développement local uniquement ; ne jamais committer
```

---

## 2. File d'attente hors-ligne et synchronisation (PWA sans build)

### Faits vérifiés

- **Background Sync (`SyncManager`) : absent de Safari iOS**, toutes versions listées sur caniuse (jusqu'à 27.x) ; spec non officielle (WICG). Chromium seulement. Periodic Background Sync encore plus restreint. => ne pas construire la synchro dessus.
- **Screen Wake Lock** : Safari iOS ≥ 16.4, mais **ne fonctionnait pas dans les apps installées (écran d'accueil) avant iOS 18.4** (bug WebKit 254545 corrigé en 18.4 ; sources secondaires, MOYENNE). Le verrou est libéré dès que la page est masquée ; il faut le re-demander à `visibilitychange` (déjà identifié dans CONCERNS.md).
- **Stockage iOS** : plafond de 7 jours sur tout stockage inscriptible par script (IndexedDB, Cache, enregistrement SW) pour un site utilisé dans Safari sans interaction ; **les apps installées sur l'écran d'accueil en sont exemptées** (WebKit blog, web.dev). Une app installée a un **conteneur de stockage séparé** de Safari : ce qui est importé dans un onglet Safari n'existe pas dans l'app installée. C'est un argument fort pour l'archive en ligne, et il faut dire à l'équipage d'installer l'app.
- Quota Safari ≈ 1 Go environ (non documenté officiellement).

### Recommandation

| Brique | Choix | Pourquoi |
|--------|-------|----------|
| API IndexedDB | **`idb` 8.0.4**, copié dans `vendor/idb.js` (ESM, ~quelques Ko) | Promesses au-dessus d'IndexedDB sans build ; cohérent avec la pratique « vendoriser » du projet ; `js/track.js` utilise déjà IndexedDB brut, à migrer progressivement. Alternative `idb-keyval` 6.3.0 trop pauvre (un seul magasin clé-valeur, pas d'index sur l'état). |
| Motif | **Outbox** : magasin `outbox` `{id, type, regattaId, path, payload|blobRef, baseEtag, createdAt, tentatives, erreur}` | Chaque écriture d'archive est d'abord enregistrée localement (donc sûre en mer), puis envoyée. |
| Déclencheurs de vidage | lancement de l'app, `online`, `visibilitychange` → visible, après chaque enregistrement, et **minuteur de reprise avec backoff (30 s → 5 min) tant que la file n'est pas vide et que la page est visible** | L'événement `online` est peu fiable sur mobile ; ne jamais compter dessus seul. |
| Exclusion mutuelle | `navigator.locks.request('outbox-flush', …)` (Web Locks, Safari ≥ 15.4) | Évite un double envoi si deux fenêtres sont ouvertes. MOYENNE sur la disponibilité exacte. |
| Idempotence | identifiants client + `allowOverwrite:true` + chemins déterministes (§1) | Rejeu sûr après coupure en plein envoi. |
| Conflits | `409` renvoyé par l'API quand `ifMatch` échoue, avec le document courant ; le client fusionne par champ (dernier `updatedAt` gagne champ par champ, notes concaténées) puis renvoie | Suffisant pour 3 personnes ; pas de CRDT. |
| Lecture hors-ligne | copie IndexedDB de l'index et des `meta.json` consultés, affichée immédiatement puis rafraîchie | Plus simple et plus sûr que de faire cacher des réponses privées par le service worker (qui ne gère de toute façon pas `/api/`). |
| Persistance | appeler `navigator.storage.persist()` une fois ; afficher en permanence « N éléments en attente d'envoi » | Évite l'éviction silencieuse et rend l'attente visible. |
| Synchro en arrière-plan | **Aucune** (ne pas enregistrer `sync`). Éventuel enrichissement Chromium plus tard, jamais requis. | iPhone d'abord. |

**Ne pas utiliser :** Workbox Background Sync / `workbox-background-sync` (même limitation iOS), `localStorage` pour la file (5 Mo, synchrone, pas de blobs), PouchDB/RxDB/CouchDB (trop lourds pour 3 utilisateurs), `dexie` (correct mais redondant avec `idb` ici).

### Fiabilité en mer (GPS, verrou d'écran) — ce qu'une PWA ne sait pas faire

- Une PWA iOS **ne peut pas** suivre le GPS écran verrouillé ou en arrière-plan : `watchPosition` est suspendu. Aucune bibliothèque ne change cela. Les mesures possibles : wake lock actif et ré-acquis (iOS ≥ 18.4 en app installée), **détection des trous** (horodatage du dernier point, alerte visible et sonore au retour de visibilité, marqueur de trou dans la trace), et conserver **Open GPX Tracker comme enregistreur de référence** (l'équipage l'utilise déjà) avec l'import GPX comme chemin normal. À valider sur un vrai iPhone (CONFIANCE MOYENNE).
- Ne pas ajouter NoSleep.js (astuce vidéo) : inutile dès que l'équipage est en iOS ≥ 18.4, et fragile ; à reconsidérer seulement si un iPhone plus ancien est dans l'équipage.

---

## 3. Tests sans étape de build

### Faits vérifiés

- Vercel : Node **24.x par défaut**, 22.x disponible ; Node 20 déprécié le 1er octobre 2026 (changelog). Version fixable par `engines.node` dans `package.json`. Le bac à sable de recherche tourne en Node 22.22 : les tests doivent passer sur 22 et 24.
- `node:test` : stable depuis Node 20 ; tests instantanés (*snapshot*) stables depuis 23.4/22.3 ; `mock.fn/method/timers` disponibles ; couverture `--experimental-test-coverage` **encore expérimentale** ; `mock.module` à éviter (non confirmé stable) ; globalSetup en développement précoce.
- Les modules purs du projet (`geo`, `wind`, `router`, `polar`, `polar-orc`, `tactics`, `courses`, `debrief`, `track`) sont des ES modules **importables tels quels dans Node** : leurs accès à `document`/`indexedDB`/`localStorage` sont à l'intérieur de fonctions. Deux obstacles réels, vérifiés dans le code :
  1. `fromGPX()` (`js/track.js`) utilise `new DOMParser()` ;
  2. `loadTerrain` (`js/geo.js`) utilise `fetch(base + 'meta.json')` (chemins relatifs, pas de `file:`).
- Vérifié par exécution (Node 22.22) : `linkedom` 0.18.13 fournit un `DOMParser` qui lit `getElementsByTagName('trkpt')`, `querySelector('trk > name')` et signale `parsererror` ; `fake-indexeddb` 6.2.6 ouvre une base ; `next()` de `@vercel/functions` 3.10.1 s'exécute hors Vercel et renvoie `x-middleware-next: 1`.

### Recommandation : `node:test`, pas Vitest

| Pourquoi `node:test` | Détail |
|----------------------|--------|
| Zéro dépendance lourde | Vitest 5.0.5 (dernière) tire Vite et son arbre ; le projet n'a ni Vite ni build et doit « ne pas alourdir ». |
| Fidélité au runtime | Le middleware et les fonctions tournent sur Node chez Vercel ; les tester sur Node natif évite les écarts de transformation. |
| Suffisant | assertions `node:assert/strict`, `describe/it`, `mock.fn`, `mock.timers`, sous-tests, instantanés stables, filtres `--test-name-pattern`. |

Vitest ne vaut le coup que si l'on veut un mode watch confortable ou du test de composants DOM : non demandé.

### Pile de test

| Outil | Version | Rôle | Quand |
|-------|---------|------|-------|
| `node --test` | Node 24 (22 OK) | Exécuteur, `npm test` | Toujours |
| `linkedom` | 0.18.13 (devDependency) | `globalThis.DOMParser` pour `fromGPX` | Tests GPX et débrief |
| `fake-indexeddb` | 6.2.6 (devDependency) | `import 'fake-indexeddb/auto'` : tester l'outbox et `track.js` | Tests de synchro |
| `ajv` | 8.20.0 (devDependency, **tests seulement**) | Valider `data/venues/*/venue.json` contre un JSON Schema (2020-12 : `ajv/dist/2020`) | Exigence « autres plans d'eau » ; le schéma sert aussi de documentation pour ajouter un site. Pas d'Ajv dans l'app navigateur. |
| `fast-check` | 4.10.2 (devDependency, optionnel) | Propriétés : le routeur ne traverse jamais la zone interdite, `norm180(norm360(x))` borné, vitesse polaire monotone en TWS | Seulement si le temps le permet ; pas indispensable |
| Playwright | 1.64.1 (`@playwright/test`) | Smoke e2e : ouvrir une régate, saisir, couper le réseau, retrouver la file | **Plus tard**, voir ci-dessous |

### Organisation

```
test/
  helpers/fetch-fichiers.js     # globalThis.fetch -> lit data/*.json|bin sur disque (terrain pour WindField)
  helpers/dom.js                # installe DOMParser (linkedom)
  fixtures/coupe-snpm-2026.gpx  # trace de référence du 18/10/2026
  fixtures/cas-connus.json      # entrées/sorties attendues (valeurs avec tolérance)
  geo.test.js  polar.test.js  router.test.js  wind.test.js  gpx.test.js  debrief.test.js
  middleware.test.js  archive-api.test.js  outbox.test.js  venue-schema.test.js  sw-shell.test.js
```

Règles de conception qui rendent les tests possibles sans toucher à l'architecture « sans build » :
- **Tolérances, pas égalité exacte** sur le modèle de vent et le routeur (`Math.abs(a-b) < tol`) ; consigner la valeur de référence et sa source (Coupe SNPM) dans le fixture. Les constantes du vent ont été réglées à la main (CONCERNS.md) : le test sert de filet, pas de vérité absolue.
- **Middleware** : extraire `EQUIPAGE` + `membre()` dans `api/_acces.js` (le préfixe `_` empêche Vercel d'en faire une route, comme déjà `api/_rrs.js`), avec une fabrique `creerAcces(table)` pour injecter un code de test. Tester : cookie valide → `x-middleware-next`, code inconnu → redirection ou 401, `?acces=` → `Set-Cookie` + redirection sans le paramètre, chemins publics (`acces.html`, `sw.js`, `rapports/`, `icons/`) via `config.matcher` (tester la regex directement sur une liste de chemins). Aucun code ni empreinte réels dans les fichiers de test.
- **Handlers `api/`** : injection de dépendance (`creerHandler({ store })`) plutôt que `mock.module`. Les tests passent un faux store en mémoire ; le vrai appelle `@vercel/blob`. Même motif pour OpenAI (faux client).
- **Contrôle du service worker** (`sw-shell.test.js`) : chaque `js/*.js` est dans `SHELL`, `VERSION` du SW et `APP_VERSION` d'`app.js` coïncident, `vendor/pdf*.js` listés ou exclus explicitement. Règle les deux points de dette de CONCERNS.md sans ajouter de build (le SW reste écrit à la main, validé par test).

### Playwright : utile mais pas sur le chemin critique

- La doc officielle Playwright indique que **les service workers ne sont pris en charge que sur Chromium** : un test e2e « hors-ligne » ne vaut que sur le projet Chromium ; le projet WebKit de Playwright ne reproduit **pas** le comportement d'un iPhone installé (wake lock, arrière-plan, stockage). Il ne remplace pas un test sur un vrai iPhone avant chaque régate (checklist manuelle).
- Les 5 exigences de ce jalon sont couvertes par `node:test`. Ajouter Playwright quand l'archive et l'outbox existent, avec un serveur statique + `vercel dev`/fausse API, en tant que smoke test **non bloquant** au début.

### Installation (tests)

```bash
npm i -D linkedom@0.18.13 fake-indexeddb@6.2.6 ajv@8
# optionnel plus tard
npm i -D fast-check@4 @playwright/test@1.64
```

`package.json` (extraits) :

```json
{
  "engines": { "node": "24.x" },
  "scripts": {
    "check:syntaxe": "node tools/check-syntaxe.mjs",
    "test": "node --test \"test/**/*.test.js\"",
    "check": "npm run check:syntaxe && npm test"
  }
}
```

`tools/check-syntaxe.mjs` : parcourt `js/`, `api/`, `middleware.js`, `sw.js` et lance `node --check` (module) sur chacun ; attrape un import cassé avant le navigateur. Commiter `package-lock.json` (absent aujourd'hui, signalé dans CONCERNS.md) et utiliser `npm ci`.

---

## 4. Contrôles avant mise en ligne (CI)

### Faits vérifiés

- Vercel Hobby : **100 déploiements par jour et 100 builds par heure**, 45 min de build maximum, 1 déploiement concurrent. Largement suffisant.
- Un `buildCommand` dans `vercel.json` (ou le réglage projet) remplace la commande de build ; un projet « Other » sans build la laisse vide. Si la commande échoue, **le déploiement échoue** et la production précédente reste en ligne.
- **Deployment Checks** (màj 2026-08-11) : Vercel peut retenir une production tant que des checks GitHub Actions ne sont pas verts. La page ne précise pas la disponibilité sur Hobby : **non vérifié**, ne pas en dépendre.
- Playwright recommande `actions/checkout@v6`, `actions/setup-node@v6`, `npx playwright install --with-deps` pour GitHub Actions.
- Le dépôt GitHub existe (`romaindetroyat/rade-tactique`) ; il n'y a pas de `.github/`.

### Recommandation

1. **Porte principale, zéro infrastructure :** dans `vercel.json`, ajouter `"buildCommand": "npm run check"`. Chaque déploiement (aperçu ou production, depuis Git) exécute syntaxe + tests ; un échec bloque la mise en ligne. C'est la réponse directe à l'exigence « lancés avant chaque mise en ligne, sans ajouter de build à l'app » : on ne produit rien, on **vérifie** seulement. Le répertoire de sortie reste la racine (« Other »).
2. **Avant le premier merge, vérifier sur un déploiement d'aperçu** que la sortie ne change pas (page d'accueil, `/sw.js`, `/data/…`) et que `node_modules/` et `test/` ne sont pas servis sans cookie (le middleware les protège de toute façon).
3. **Ajouter GitHub Actions seulement avec Playwright** : un `.github/workflows/ci.yml` qui lance `npm ci && npm run check` sur chaque PR donne un retour plus rapide que le build Vercel, mais le doublonne tant qu'il n'y a pas d'e2e.
4. **Avant chaque régate** : un script `npm run check` en local + la checklist iPhone (installation, wake lock, enregistrement 30 min écran verrouillé, mode avion puis retour réseau). Aucun outil ne remplace cette dernière.
5. Hook local optionnel : `git config core.hooksPath .githooks` avec un `pre-push` qui lance `npm run check` (pas de husky : une dépendance de plus pour trois lignes).

**Ne pas utiliser :** `ignoreCommand` pour exécuter des tests (il sert à *sauter* un build), Turborepo/Nx (aucun monorepo), Husky/lint-staged.

---

## 5. Contrôle d'accès à étendre aux nouvelles routes

Constat vérifié dans `middleware.js` : le middleware appelle `next()` sans transmettre l'identité ; les fonctions `api/` ne savent donc pas **qui** écrit (nécessaire pour « modifié par Teiva »).

- Confirmé : `next({ request: { headers } })` de `@vercel/functions` transmet des en-têtes de requête modifiés (vérifié par exécution : `x-middleware-override-headers`, `x-middleware-request-<nom>`), et le runtime du Routing Middleware est **Node.js par défaut**.
- Recommandation : le middleware **supprime d'abord tout `x-membre` fourni par le client** puis pose `x-membre: <prénom>`, mais les routes d'archive **ré-vérifient quand même le cookie** avec le module partagé `api/_acces.js` (défense en profondeur recommandée par la doc Blob privé). L'en-tête sert à l'attribution, pas à l'autorisation.
- Les nouvelles routes (`/api/archive`, `/api/archive/...`) sont déjà sous le `matcher` actuel (seuls `acces.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `rapports/` en sont exclus) : ne pas ajouter de dossier public sans test du matcher.
- Piège de plateforme : sur iOS, l'app installée a son propre conteneur (cookies compris) : chaque équipier doit se connecter **dans l'app installée** avec son lien personnel. À dire dans le guide.

---

## 6. Remontée d'erreurs pour une toute petite app privée

### Faits vérifiés

- **Journaux d'exécution Vercel sur Hobby : 1 heure de rétention**. Une erreur de fonction vue le lendemain n'existe plus : `console.error` seul ne suffit pas.
- **Sentry, plan Developer (gratuit)** : 5 000 erreurs/mois, 5 M de spans, 50 replays, **1 utilisateur**, 30 jours d'historique, projets illimités. Le SDK navigateur 11.8.0 existe en bundle CDN `browser.sentry-cdn.com/11.8.0/bundle.min.js` : **mesuré 93,9 Ko, ~31,8 Ko gzip** (erreurs seules).
- Le transport hors-ligne `makeBrowserOfflineTransport` existe dans le SDK npm mais **n'apparaît pas dans le bundle CDN** (recherche dans le fichier téléchargé) : par défaut, un événement envoyé sans réseau est perdu.

### Recommandation

| Couche | Choix | Pourquoi |
|--------|-------|----------|
| Navigateur | **Sentry** bundle CDN `bundle.min.js` 11.8.0, **copié dans `vendor/`** (avec empreinte SRI notée dans `vendor/README`), chargé `defer`, DSN public dans le code, `sendDefaultPii:false` | Gratuit, groupement des erreurs, versions. Vendoriser le fichier le met dans le cache du SW (il se charge hors-ligne, pas de script tiers à l'exécution) et correspond à la pratique du dépôt. |
| Tampon local | Petit module `js/report.js` (~60 lignes) : `window.onerror`, `unhandledrejection`, et `report(erreur, contexte)` appelé **à la place des `catch {}` silencieux** ; écrit dans un magasin IndexedDB `erreurs` (anneau de 100) ; envoie à Sentry si en ligne, sinon rejoue au retour du réseau (même déclencheurs que l'outbox) | Compense l'absence de transport hors-ligne dans le bundle CDN ; garde une trace des arrêts GPS/wake lock/trace survenus en mer ; alimente un écran « Diagnostic » exportable après la course. |
| Serveur | `@sentry/node` 11.8.0 dans un petit enrobage `api/_erreurs.js` (`try/catch` autour des handlers, `await Sentry.flush(2000)` avant de répondre) | Seul moyen d'avoir l'historique de plus d'une heure sur Hobby. Optionnel dans ce jalon si le poids de la dépendance gêne : l'alternative minimale est de renvoyer les erreurs serveur au client qui les passe à `report()`. |
| Confidentialité | `beforeSend` qui **supprime les URL contenant `acces=`**, le cookie, les positions/traces GPS et les coordonnées ; région de données UE à choisir à la création de l'organisation | Le code d'accès voyage dans `?acces=` à la première requête ; il ne doit jamais atteindre un tiers. |
| Alertes | Un e-mail Sentry « nouveau problème » pour l'unique utilisateur | Suffisant pour 3 personnes. |

**Rejeté :** Vercel Observability/Log Drains (rétention 1 h sur Hobby, drains hors périmètre gratuit), journaliser dans Blob (chaque événement serait une opération avancée sur 2 000/mois), GlitchTip (auto-hébergement à tenir pour trois utilisateurs), analytics/télémétrie d'usage (non demandé).

**Alternative sans tiers si Sentry est refusé :** `report()` + écran « Diagnostic » + bouton « envoyer le rapport à Romain » qui dépose un seul `diagnostics/<date>-<membre>.json` dans Blob (une opération avancée par envoi manuel). Moins d'automatisme, zéro service externe.

---

## 7. Fichiers de définition de sites (exigence « plusieurs plans d'eau »)

Pas de bibliothèque. Convention : `data/venues/<site>/venue.json` (zone, origine, bouées, parcours, lignes types, zones interdites, dangers, IC par défaut, références vers `terrain.bin`/`cover.bin`/`coast.json`/`basemap.jpg`), un **JSON Schema** `data/venues/venue.schema.json`, validé par `ajv` dans `venue-schema.test.js` ; `js/courses.js`, `js/weather.js` (`GRID`, `CENTER`) et `js/geo.js` (`ORIGIN`) lisent ce fichier au démarrage au lieu de constantes. Le SW ajoute les fichiers du site actif à `SHELL` (contrôlé par `sw-shell.test.js`). Un test de cohérence géométrique par site (bouées dans la zone, zone interdite polygonale fermée, les deux positions `src: 'approx'` signalées). Confiance : HAUTE sur l'approche, la forme exacte du schéma relève de la phase de conception.

---

## Alternatives considérées

| Catégorie | Recommandé | Alternative | Pourquoi pas |
|-----------|------------|-------------|--------------|
| Archive | Blob privé | Neon Postgres | Schéma + migrations + pilote dans un projet sans build ; gardé comme plan B si le plafond d'opérations Blob gêne ou pour des statistiques inter-régates |
| Archive | Blob privé | Supabase | Pause après 7 jours d'inactivité |
| Archive | Blob privé | Blob public | Pas d'authentification sur la lecture |
| Config / droits | tableau constant | Global Config (ex-Edge Config) | 100 écritures/mois, 100 000 lectures offertes consommées par un middleware sur chaque requête |
| Synchro | outbox pilotée par la page | Background Sync / Workbox | Absent de Safari iOS |
| IndexedDB | `idb` vendorisé | Dexie, PouchDB | Plus lourds, aucun bénéfice à 3 utilisateurs |
| Tests | `node:test` | Vitest 5.0.5 | Vite et arbre de dépendances sans bénéfice ici |
| Porte de déploiement | `buildCommand` | GitHub Actions + Deployment Checks | Disponibilité sur Hobby non vérifiée ; doublonne sans e2e |
| Erreurs | Sentry gratuit + tampon local | Logs Vercel | 1 h de rétention sur Hobby |

## À ne pas utiliser

| Éviter | Pourquoi | À la place |
|--------|----------|------------|
| Vercel Blob `access: 'public'` | Lecture sans authentification | Store privé + route `api/` authentifiée |
| `list()` pour afficher l'archive | Opération avancée, 2 000/mois | `index.json` |
| Écraser un blob puis le relire immédiatement avec le cache | Jusqu'à 60 s de version périmée | `useCache:false` ou chemins uniques |
| Servir un rapport HTML stocké sans bac à sable | Exécution de script avec le cookie de l'équipage | CSP `sandbox` / `<iframe sandbox>` |
| `skipWaiting` + `clients.claim` pendant une course | Mélange de modules de deux versions (CONCERNS.md) | Invite « nouvelle version disponible » ; hors périmètre de cette recherche mais à ne pas aggraver avec l'outbox |
| `mock.module` de `node:test` | Fonction expérimentale | Injection de dépendances |
| Fiabiliser le GPS arrière-plan par bibliothèque | Impossible en PWA iOS | Wake lock + détection de trous + Open GPX Tracker |
| Sentry avec replay / tracing | Capterait écrans, URL, positions ; consomme le quota | Erreurs seules |

## Questions ouvertes à traiter en spike (avant ou au début de la phase concernée)

1. **Confirmer le plan Vercel (Hobby ou Pro)** et relever la consommation Blob actuelle dans Observabilité > Blob.
2. **Mesurer** sur la trace de la Coupe SNPM : taille gzip du GPX, taille du `meta.json` complet, nombre d'opérations simples d'une session d'ouverture d'archive (un 304 compte-t-il ?).
3. Vérifier qu'ajouter `buildCommand` ne change pas le contenu servi (aperçu de déploiement).
4. Test réel sur iPhone installé : wake lock 30 min, trou GPS écran verrouillé, mode avion → retour réseau avec vidage de l'outbox, installation de l'app et reconnexion par lien personnel.
5. `Deployment Checks` sur Hobby : à vérifier dans les réglages si l'on veut une vraie promotion conditionnelle.
6. Sentry : version exacte à vendoriser et SRI à noter ; confirmer que `beforeSend` retire bien `acces=` des URL de page et de requête.

## Sources

- Vercel Blob — Usage & pricing, màj 2026-09-23 : https://vercel.com/docs/vercel-blob/usage-and-pricing (HAUTE)
- Vercel Blob — Private storage, màj 2026-09-15 : https://vercel.com/docs/vercel-blob/private-storage (HAUTE)
- Vercel Blob — JS SDK reference, màj 2026-08-26 : https://vercel.com/docs/vercel-blob/using-blob-sdk (HAUTE)
- Vercel Global Config (ex-Edge Config) limits, màj 2026-07-29 : https://vercel.com/docs/global-config/global-config-limits (HAUTE)
- Vercel Storage overview, màj 2026-09-03 : https://vercel.com/docs/storage (HAUTE)
- Vercel Functions limits, màj 2026-08-24 : https://vercel.com/docs/functions/limitations (HAUTE)
- Vercel Limits (Hobby), màj 2026-09-16 : https://vercel.com/docs/limits (HAUTE)
- Vercel Node.js versions, màj 2026-02-27 : https://vercel.com/docs/functions/runtimes/node-js/node-js-versions (HAUTE)
- Vercel Configuring a build, màj 2026-08-28 : https://vercel.com/docs/builds/configure-a-build (HAUTE)
- Vercel Deployment Checks, màj 2026-08-11 : https://vercel.com/docs/deployment-checks (HAUTE pour le contenu, disponibilité Hobby non vérifiée)
- Vercel Routing Middleware API, màj 2026-08-20 : https://vercel.com/docs/routing-middleware/api (HAUTE)
- Vercel Runtime logs, màj 2026-08-28 : https://vercel.com/docs/logs/runtime (HAUTE)
- Neon pricing : https://neon.com/pricing ; Upstash Redis pricing : https://upstash.com/pricing/redis ; Supabase pricing : https://supabase.com/pricing (MOYENNE : pages commerciales, lues par extraction)
- Node.js `node:test` : https://nodejs.org/api/test.html (HAUTE, lecture partielle de la page) ; versions : https://nodejs.org/en/about/previous-releases (les dates de fin de vie extraites de cette page semblent incohérentes : non utilisées)
- caniuse Background Sync (non pris en charge sur Safari iOS) : https://caniuse.com/background-sync (HAUTE) ; MDN Background Synchronization API : https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- caniuse Wake Lock : https://caniuse.com/wake-lock ; correctif d'iOS 18.4 pour les apps installées : recherche web, sources secondaires dont https://bugs.webkit.org/show_bug.cgi?id=254545 (MOYENNE)
- WebKit — plafond de 7 jours et exemption des apps de l'écran d'accueil : https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ ; web.dev Storage for the web : https://web.dev/articles/storage-for-the-web (HAUTE / MOYENNE)
- Playwright — service workers (Chromium seulement) : https://playwright.dev/docs/service-workers ; CI : https://playwright.dev/docs/ci-intro (HAUTE)
- Sentry — tarifs : https://sentry.io/pricing/ ; installation CDN : https://docs.sentry.io/platforms/javascript/install/cdn/ ; transports : https://docs.sentry.io/platforms/javascript/configuration/transports/ (HAUTE / MOYENNE)
- Registre npm, 2026-10-19 (`npm view`) : @vercel/blob 2.8.2, @vercel/functions 3.10.1, openai 7.39.0, vitest 5.0.5, @playwright/test 1.64.1, idb 8.0.4, idb-keyval 6.3.0, @sentry/browser et @sentry/node 11.8.0, fake-indexeddb 6.2.6, linkedom 0.18.13, fast-check 4.10.2, ajv 8.20.0 (HAUTE)
- Vérifications par exécution dans un répertoire temporaire (Node 22.22) : `next({request:{headers}})`, `linkedom` DOMParser sur un GPX, `fake-indexeddb`, mesure du bundle Sentry CDN (HAUTE)
- Non disponible dans cette session : Context7 / Exa / Firecrawl ; recherche faite par lecture directe de la documentation officielle et du registre npm.
