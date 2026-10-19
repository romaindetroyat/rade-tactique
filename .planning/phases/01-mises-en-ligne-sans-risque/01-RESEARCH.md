# Phase 1: Mises en ligne sans risque - Research

**Researched:** 2026-10-19
**Domain:** PWA statique sur Vercel sans build : service worker à mise à jour différée, verrou « en course », tests `node:test` des calculs et de l'accès, version et liste hors réseau générées, porte de déploiement, durcissement pdf.js
**Confidence:** HIGH (comportements essentiels exécutés dans le bac à sable : Node 22.22, Chromium 1194 via Playwright 1.56.1) ; MEDIUM sur ce qui dépend de Vercel en ligne et d'iOS (non testable ici)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mise à jour en course**
- **D-01:** Verrou « en course » : dès qu'un chrono tourne, que le mode départ est ouvert, qu'une trace s'enregistre ou que le mode en course (GPS) est actif, quel que soit le jour (entraînement compris), aucune nouvelle version n'est appliquée.
- **D-02:** Verrou « jour de régate » : le jour de la régate enregistrée (date de la fiche de régate / IC choisie, `IC.date` aujourd'hui ; la régate de la phase 3 ensuite), aucune version n'est appliquée du matin jusqu'au retour au port. Le retour au port = l'équipier touche « course finie », ou chrono, trace et mode en course sont tous arrêtés depuis 1 h.
- **D-03:** Exception du matin : le jour de régate, le bandeau de mise à jour peut encore apparaître avant 9 h (heure de Paris), pour mettre à jour avant de partir au port. Après 9 h, verrou jusqu'au retour au port.
- **D-04:** Hors verrou, la nouvelle version s'annonce par un bandeau discret « Nouvelle version disponible » avec un bouton « Mettre à jour ». Aucun rechargement sans geste (fin du rechargement automatique sur `controllerchange` et du `skipWaiting` automatique).
- **D-05:** Pendant un verrou (course ou journée de régate après 9 h), le bandeau est masqué.
- **D-06:** Aucune version n'est forcée en course, même critique. Hors verrou, une version marquée critique affiche le bandeau en couleur d'alerte.
- **D-07:** Le bandeau indique en une ligne ce qui change (« Nouvelle version v27 · bips plus sûrs »).

**Version affichée**
- **D-08:** La version se consulte uniquement dans l'aide (fenêtre d'aide / guide), au format « numéro + date » (ex. « v26 · 19/10 »), avec la ligne de nouveauté. Elle n'apparaît ni à l'écran de départ ni dans la ligne d'état (retirer `APP_VERSION` de la ligne d'état). **Ceci modifie FIAB-02** : « L'équipier peut consulter la version de l'app dans l'aide » — REQUIREMENTS.md et le critère 3 de la phase dans ROADMAP.md doivent être mis à jour en conséquence.
- **D-09:** Pas de visibilité de la version des autres équipiers pour l'instant.

**Trace et cas de référence**
- **D-10:** La trace GPX réelle de la Coupe SNPM du 18/10/2026 est versionnée telle quelle dans le dépôt comme fixture de test (elle est déjà visible dans le rapport public).
- **D-11:** Le cas de référence vérifie : parcours 4 reconnu et passages aux bouées 7 et houlographe, arrivée réduite ; deux faux départs puis le bon départ à la bonne heure ; vent déduit cohérent (grosse bascule gauche au départ, vent par bord) ; pourcentages de polaire par bord stables à quelques % près.
- **D-12:** Si une amélioration du modèle change ces résultats, le test échoue ; Claude présente l'avant/après et la nouvelle référence est validée avec Romain avant d'être enregistrée. Pas de tolérances larges qui masqueraient une dérive.
- **D-13:** Les prochaines régates deviendront de nouveaux cas de référence, une fois leurs résultats validés avec Romain.

### Claude's Discretion
- Comportement quand un test bloque une mise en ligne (notification, issue de secours pour un correctif urgent), dans le respect de la règle d'exploitation : aucune mise en ligne de production dans les 48 h avant une régate sauf correctif critique hors course.
- Cas fabriqués complémentaires pour les calculs de base (géométrie, polaire, routage) si utiles.
- Mécanique technique : génération de la version et de la liste hors réseau, structure des tests, correctif pdf.js.

### Deferred Ideas (OUT OF SCOPE)
- Voir la version des autres équipiers (à reconsidérer avec l'archive partagée, phase 4).
- Ajouter chaque prochaine régate comme cas de référence (D-13) — au fil des régates.

*Note : REQUIREMENTS.md (FIAB-02) et le critère 3 de ROADMAP.md disent déjà « dans l'aide » : l'ajustement demandé par D-08 est fait (vérifié par lecture des deux fichiers).*
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Tests automatiques des calculs (géométrie, polaire, routage, vent, GPX, débrief) avec la Coupe SNPM comme référence | Tous les modules de calcul s'importent sous Node (sauf `js/app.js`) ; valeurs de référence extraites ci-dessous ; harnais `tests/helpers/env.mjs` |
| TEST-02 | Sans code d'accès, rien de privé n'est servi | Test du `middleware.js` réel : énumération des fichiers du dépôt + émulation du `matcher` + simulation d'empreinte (aucun vrai code) |
| TEST-03 | Une mise en ligne est bloquée si un test échoue | `vercel.json` `buildCommand: "npm run check"` ; un échec de build n'est pas promu en production [CITED] |
| TEST-04 | Version et liste hors réseau générées, sans oubli possible | `tools/stamp.mjs` (+ `release.json`) : SHELL calculé, identifiant de build = hachage du contenu, vérification dans `npm run check` |
| SECU-01 | L'import d'un PDF d'IC n'exécute aucun code | pdf.js réellement vendorisé = **3.11.174** (pas 3.32.2), vulnérable à CVE-2024-4367 ; `isEvalSupported: false` ferme les deux puits `new Function` du code vendorisé (mesuré) |
| FIAB-01 | Une mise à jour ne recharge jamais l'app en course ; bandeau hors course | SW sans `skipWaiting` + **cache d'abord** pour les fichiers de l'app + `js/racelock.js` pur + `js/swupdate.js` (protocole éprouvé dans Chromium) |
| FIAB-02 | Version (numéro + date) consultable dans l'aide | `js/version.js` généré ; ligne ajoutée dans `openGuide()` ; retrait de `APP_VERSION` de la ligne d'état |
</phase_requirements>

## Summary

Le point qui change tout : **retirer `skipWaiting()` ne diffère rien**. Le `fetch` du SW actuel est « réseau d'abord » pour tout le site (sw.js:19-22), donc le moindre rechargement ou relancement de la page charge le nouveau JavaScript même si l'ancien worker contrôle encore la page. Je l'ai mesuré : avec un SW sans `skipWaiting` mais en réseau d'abord, un rechargement manuel passe de v31 à v32. Il faut donc passer les fichiers de l'app en **cache d'abord** (cache nommé par version), pour que la page reste cohérente avec le worker qui la contrôle jusqu'au geste « Mettre à jour ». Le protocole complet (worker en attente, `GET_BUILD`, bandeau, verrou, `SKIP_WAITING`, un seul rechargement sur geste) a été exécuté de bout en bout dans Chromium avec le vrai `sw.js` généré : le rechargement manuel garde l'ancienne version, le verrou masque le bandeau et refuse l'application, le geste provoque exactement une navigation et supprime l'ancien cache.

La version et le SHELL sont mieux **commités et vérifiés** que générés au déploiement : `release.json` (n, date, note, critique, hachage) est écrit par `npm run release -- "bips plus sûrs"` ; `tools/stamp.mjs` en déduit le SHELL (liste triée des fichiers), un identifiant de build = hachage du contenu (SHA-256 des fichiers du SHELL + logique de `sw.js`), le bloc généré de `sw.js` et `js/version.js`. `npm run check` (= `stamp --check` puis `node --test`) échoue si un fichier généré est périmé ou si le contenu a changé depuis la dernière « release ». Ainsi ce qui est servi est exactement ce qui est dans Git (aucune dépendance au comportement de Vercel sur des fichiers générés au build, non vérifiable ici), un commit qui ne touche que `.planning/` ne change pas `sw.js` (donc aucun faux bandeau), et un fichier ajouté au code entre dans le SHELL sans retouche manuelle de liste.

Les autres constats : le pdf.js vendorisé est la **3.11.174** (« 3.32.2 » est la version de core-js embarquée) ; sans l'option, 252 puis 76 constructions `Function(...)` à partir de données de police ont été observées au rendu des deux PDF réels, 0 avec `isEvalSupported:false`, et l'extraction de texte (ce que fait l'app) est identique (11 302 et 11 036 caractères). Sous Node 22.22, `node --test tests/` (dossier) **échoue** : il faut un glob ou aucun argument. Les trois reconnaissances demandées par D-11 sont reproduites sous Node en ~2,5 s.

**Primary recommendation :** passer le SW en cache d'abord + worker en attente, ajouter `js/racelock.js` (fonction pure) et `js/swupdate.js`, générer version/SHELL par `tools/stamp.mjs` + `release.json` (commités, vérifiés), écrire les tests `node:test` (calculs, référence SNPM, accès, SW, stamp, pdf), puis seulement activer `buildCommand: "npm run check"` après un essai sur déploiement d'aperçu.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Détection / application d'une nouvelle version | Service worker (`sw.js`) | Page (`js/swupdate.js`) | Seul le worker connaît son propre état `waiting` et ses fichiers ; la page décide quand envoyer `SKIP_WAITING` |
| Verrou « en course » / « jour de régate » | Page (`js/racelock.js` + glue `js/app.js`) | localStorage (`rade.racelock`) | Les signaux (chrono, mode départ, Recorder, GPS) n'existent que dans la page ; le SW ne lit pas localStorage |
| Version affichée | Fichier généré `js/version.js` (page) | `sw.js` (bloc généré, public) | Même objet `BUILD` écrit dans les deux, par le même script |
| Liste hors réseau (SHELL) | Script Node `tools/stamp.mjs` (hors app) | `sw.js` (bloc généré) | Aucune étape de build : le script tourne à la main / dans `npm run check`, la sortie est commitée |
| Contrôle d'accès | Edge : `middleware.js` + `config.matcher` | — | Inchangé ; le test l'importe tel quel |
| Porte de déploiement | Build Vercel (`buildCommand`) | `npm run check` local | Un échec de build empêche la promotion en production |
| Import PDF d'IC | Navigateur (pdf.js vendorisé) | — | `isEvalSupported:false` au seul point d'appel `getDocument` (js/events.js:40) |
| Tests des calculs | Node (`node:test`) | linkedom (DOMParser) | Modules purs importables sans navigateur |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` + `node:assert/strict` | intégré à Node 22.22 (essai) / 24.x (Vercel) | Exécuteur de tests, zéro dépendance | Stable ; essayé ici ; pas de Vitest (arbre Vite inutile) [VERIFIED: exécuté ce jour] |
| `linkedom` | 0.18.13 (devDependency) | `globalThis.DOMParser` pour `fromGPX` | README documente `DOMParser` ; `fromGPX` lit la vraie trace de 9 538 points avec [VERIFIED: README GitHub WebReflection/linkedom + exécution ce jour ; npm view 0.18.13] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vercel/functions` | 3.10.1 (déjà dépendance) | `next()` du middleware, utilisé tel quel par le test | S'exécute hors Vercel et renvoie `x-middleware-next: 1` [VERIFIED: exécuté ce jour] |
| `path-to-regexp` | 6.3.0 (**optionnel**, devDependency) | Compiler le `matcher` exactement comme Next/Vercel | Seulement si l'on veut la fidélité maximale ; l'émulation `new RegExp('^' + matcher + '[/#?]?$', 'i')` donne le même résultat sur 32 chemins essayés [VERIFIED: exécuté ce jour] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fichiers générés commités + `--check` | Génération pendant le build Vercel | Le build générerait sans friction, mais que Vercel serve des fichiers générés à la racine (`outputDirectory` = `.`) n'a pas pu être vérifié ici ; commit + vérification supprime cette inconnue |
| Cache d'abord | Réseau d'abord + `skipWaiting` retiré | Ne diffère rien (mesuré) |
| `fake-indexeddb` | — | Inutile en phase 1 (le verrou lit `recorder.active`, pas IndexedDB) ; flagué « trop récent » par le contrôle |
| Workbox | SW écrit à la main (~25 lignes) | Workbox ajouterait une dépendance et un outil de build ; le besoin ici est minimal |

**Installation :**
```bash
npm install --save-dev linkedom@0.18.13
npm install            # crée package-lock.json (absent aujourd'hui) ; à commiter
```
`package.json` : ajouter `"engines": { "node": "24.x" }` (Vercel : 24.x par défaut, 22.x disponible ; les essais ci-dessus sont sous 22.22 — à confirmer sous 24 sur le premier aperçu), `"scripts"` voir « Patterns ». Utiliser `installCommand: "npm ci"` une fois le lockfile commité.

**Version verification :** `npm view linkedom version` → 0.18.13 ; `@vercel/functions` 3.10.1 ; `openai` 7.39.0 (2026-10-19). [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| linkedom | npm | dernière publication 2026-07-07 | 3,2 M/sem | github.com/WebReflection/linkedom | OK | Approuvé |
| path-to-regexp | npm | dernière publication 2026-04-01 | 139 M/sem | github.com/pillarjs/path-to-regexp | OK | Approuvé (optionnel) |
| @vercel/functions | npm | version 3.10.1 publiée 2026-10-13 | 5,8 M/sem | github.com/vercel/vercel | SUS (`too-new`) | Déjà dépendance du projet : le signal vient de la fraîcheur de la dernière version. Le lockfile fige 3.10.1 ; aucun checkpoint d'installation nécessaire |
| fake-indexeddb | npm | version publiée 2026-10-16 | 4,7 M/sem | github.com/dumbmatter/fakeIndexedDB | SUS (`too-new`) | **Non retenu** (inutile en phase 1) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@vercel/functions` (existant, figé par lockfile), `fake-indexeddb` (non utilisé) — aucun ajout SUS à installer dans cette phase. Aucun `postinstall` détecté (`linkedom` : null).

## Architecture Patterns

### System Architecture Diagram

```
 npm run release -- "note" [--critical]           (geste du développeur, 1 commande)
        │ écrit release.json {n,date,note,critical,hash}
        ▼
 tools/stamp.mjs ── liste SHELL (js/ data/ vendor/ icons/ + racine) ── hachage(contenu + logique sw.js)
        │ écrit :  sw.js (bloc généré BUILD/VERSION/SHELL)   js/version.js (BUILD)
        ▼
 git push main ──► Vercel : npm ci ─► buildCommand = npm run check
                                         ├─ stamp --check   (périmé ou « pas releasé » ? ► ÉCHEC = pas de production)
                                         └─ node --test    (calculs, référence SNPM, accès, SW, pdf, stamp)
                                  ─► succès : fichiers du dépôt servis tels quels (outputDirectory = « . » par défaut)

 ── Sur le téléphone ───────────────────────────────────────────────────────────────────────
 Page (index.html → js/app.js)                           Service worker (sw.js, version A active)
   js/swupdate.js ── register('sw.js') ───────────────►  fichiers de l'app servis du cache « rade-<idA> » (cache d'abord)
   reg.update() (hors verrou : retour visible, /15 min)         ▲ hors réseau, reste cohérent
        │ nouveau sw.js détecté (octets différents)             │
        ▼                                                       │
   Worker B s'installe, précache le SHELL dans « rade-<idB> » ; reste « waiting » (pas de skipWaiting)
        │  page → B : {type:'GET_BUILD'}   ◄── B → page : {type:'BUILD', build:{n,label,note,critical,id}}
        ▼
   racelock.lockState({now, active, raceDay, lastActiveAt, finishedAt})   ← tick toutes les 5 s (app.js)
        ├─ locked → bandeau masqué (D-05), apply() refusé
        └─ libre  → bandeau « Nouvelle version v27 · bips plus sûrs » [Mettre à jour] (alerte si critical)
                         │ geste
                         ▼  B.postMessage({type:'SKIP_WAITING'}) → B active + clients.claim()
                      controllerchange ── wantReload ? location.reload() (UNE fois) : ne rien faire
```

### Recommended Project Structure
```
js/
├── racelock.js        # NOUVEAU : verrou pur (Paris, 9 h, 1 h)           — SHELL automatique
├── swupdate.js        # NOUVEAU : enregistrement SW, worker en attente, bandeau, application sur geste
└── version.js         # GÉNÉRÉ  : export const BUILD = {...}
sw.js                  # bloc /* stamp:begin */…/* stamp:end */ généré ; logique : install / activate / message / fetch
release.json           # SOURCE  : { n, date, note, critical, hash }
tools/
└── stamp.mjs          # NOUVEAU : --release | (écriture) | --check ; Node pur, sans dépendance
tests/
├── helpers/setup.mjs  # process.env.TZ = 'Europe/Paris'  (chargé par --import)
├── helpers/env.mjs    # DOMParser (linkedom) + fetch vers data/ (Terrain.load)
├── fixtures/          # 9aa32494-18-oct.-2026-0813.gpx (1,4 Mo) ; ic-coupe-snpm-2026.txt (texte extrait des IC)
└── *.test.mjs         # geo, polar, router/wind/tactics, reference (SNPM), access, racelock, sw, stamp, pdf
package.json           # scripts : check, release, stamp ; engines ; devDependencies ; package-lock.json
vercel.json            # + installCommand "npm ci", buildCommand "npm run check"
```
`package.json` scripts (testé : `node --test` accepte un glob entre guillemets, pas un dossier) :
```json
"scripts": {
  "stamp": "node tools/stamp.mjs",
  "release": "node tools/stamp.mjs --release",
  "check": "node tools/stamp.mjs --check && node --test --import ./tests/helpers/setup.mjs \"tests/**/*.test.mjs\""
}
```

### Pattern 1 : Mise à jour différée (FIAB-01, D-04 à D-07)

**What :** worker sans `skipWaiting` à l'installation ; fichiers de l'app en cache d'abord ; la page détecte le worker en attente, lui demande son `BUILD`, affiche le bandeau hors verrou, envoie `SKIP_WAITING` sur geste, recharge une seule fois sur `controllerchange` demandé.

État actuel à remplacer [VERIFIED: js/app.js:84-92 et sw.js:11-23 lus ce jour] :
- sw.js:11 `…c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())` ; sw.js:13 `.then(() => self.clients.claim())`.
- sw.js:18-22 réseau d'abord (`fetch(e.request, { cache: 'no-cache' })`, `cache.put`, repli `caches.match`).
- js/app.js:85 `// mise à jour sans intervention : nouvelle version détectée → rechargement unique` ; :88 `navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });` ; :90 `reg.update().catch(() => {});` ; :91 `document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });`.

**Quand l'utiliser :** toujours (c'est le seul chemin de mise à jour).

**Exemple (testé : Node 22.22 pour le SW via `vm`, Chromium pour le protocole) — corps de `sw.js` après le bloc généré :**
```js
// Aucune activation automatique : la nouvelle version attend (état « waiting ») que la page envoie SKIP_WAITING (geste de l’équipier, hors course).
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  const t = e.data && e.data.type;
  if (t === 'SKIP_WAITING') self.skipWaiting();
  else if (t === 'GET_BUILD' && e.source) e.source.postMessage({ type: 'BUILD', build: BUILD });
});
const inShell = (u) => SHELL.includes(u.pathname === '/' ? './' : u.pathname.slice(1));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  // fichiers de l’app : toujours ceux de la version installée (cache d’abord) — la page reste cohérente jusqu’à la mise à jour acceptée
  if (inShell(u)) { e.respondWith(caches.open(VERSION).then((c) => c.match(r, { ignoreSearch: true })).then((hit) => hit || fetch(r))); return; }
  // le reste (rapports, page d’accès…) : réseau d’abord, cache si hors ligne
  e.respondWith(fetch(r, { cache: 'no-cache' }).catch(() => caches.match(r, { ignoreSearch: true }).then((x) => x || caches.match('index.html'))));
});
```
Côté page : `js/swupdate.js` (voir Code Examples). Le bandeau est un élément du DOM + CSS à ajouter à `index.html` / `styles.css` (placement et style : décision de conception ; prévoir `env(safe-area-inset-bottom)` sur iPhone et une variante « critique » en couleur d'alerte ; texte via `textContent`/`esc()`, jamais `innerHTML` brut).

### Pattern 2 : Verrou pur `js/racelock.js` (D-01 à D-03, D-05)

**Signaux existants (à interroger, ne pas dupliquer l'état) :**
- chrono : `let timer = { end: null, running: false, iv: null, beeps: new Set() };` [VERIFIED: js/app.js:633] ; `timer.end` non nul tant que « Stop » n'a pas été touché ; `tstop` met `timer.end = null` ; le chrono **continue de compter après H** (« +m:ss ») et ne s'arrête jamais seul.
- mode départ : `return { open, close, isOpen: () => !!root && !root.hidden, render };` [VERIFIED: js/startmode.js:393] → `startMode.isOpen()`.
- trace : `get active() { return !!this.track; }` [VERIFIED: js/track.js:30] → `recorder.active`.
- GPS : `gps?.watch != null` (js/app.js:738 ; `startGps` aussi lancé par le bouton « suivre » `follow`, js/app.js:376 → compte, D-01 dit « mode en course (GPS) actif »).
- date de régate : `IC = currentEvent()` (js/app.js:43, relu aux lignes 1015, 1038, 1058) ; `IC.date` au format `YYYY-MM-DD` [VERIFIED: js/courses.js:112 `date: '2026-10-18',`] ; peut être vide (`''`) → pas de verrou « jour ».

**Règles implémentées (testées, 6 tests verts, dont le changement d'heure du 25/10/2026) :**
1. `active` ⇒ verrouillé (`'course'`), tous les jours.
2. Jour de régate (date Paris de `now` = `raceDay`) **et** heure Paris ≥ 9 : verrouillé (`'journee'`) sauf si « course finie » touchée **après** la dernière activité, ou si la dernière activité (elle-même ≥ 9 h ce jour-là) remonte à ≥ 1 h. Une nouvelle activité après « course finie » rétablit le verrou (manches multiples).
3. Avant 9 h Paris, ou un autre jour, ou sans `raceDay` : libre.
La partie « activité avant 9 h ne compte pas » évite qu'un entraînement de 8 h 30 libère le verrou à 10 h 30, avant la course.

**Persistance** (survie au rechargement / relance iOS) : `localStorage['rade.racelock'] = { lastActiveAt, finishedAt }` ; `lastActiveAt` mis à jour par le tick de 5 s quand `active`, écrit au plus toutes les ~30 s et au `pagehide`/`visibilitychange` caché. Le tick (setInterval 5 s) calcule `active` = `(timer.end != null && now < timer.end + GRACE) || startMode.isOpen() || recorder.active || gps?.watch != null` ; `GRACE` ≈ 3 h [ASSUMED] pour qu'un chrono oublié ne verrouille pas pour toujours.

« Course finie » : bouton à placer dans l'onglet « En course » (visible quand `IC.date` = aujourd'hui) ; il écrit `finishedAt = Date.now()` ; il n'arrête rien (le verrou `'course'` tient tant qu'un chrono/une trace/le GPS tourne). Au passage verrouillé → libre, relancer `reg.update()` (le téléchargement était suspendu).

### Pattern 3 : Version + SHELL générés, commités, vérifiés (TEST-04)

**Source de vérité humaine :** `release.json` = `{ "n": 26, "date": "2026-10-19", "note": "…", "critical": false, "hash": "…" }` (initialiser `n` à 25 pour que la première release donne v26, d'après `APP_VERSION = 'v25 · accès équipage'` [VERIFIED: js/app.js:21]). `npm run release -- "bips plus sûrs" [--critical]` incrémente `n`, met la date du jour (Paris), écrit la note, puis régénère.

**Ce que `stamp.mjs` déduit (déterministe, sans horloge, sans git) :**
- SHELL = `'./'` + `index.html styles.css manifest.webmanifest guide.html regles.html` + tout `js/ data/ vendor/ icons/` sauf `*.txt *.md *.py`, fichiers cachés, `LICENSE*` ; `js/version.js` y figure toujours (sinon la liste change à sa première génération : bug rencontré). Résultat actuel : 46 fichiers, dont les trois qui manquent aujourd'hui : `icons/icon-maskable-512.png` (déclaré dans le manifest), `vendor/pdf.min.js`, `vendor/pdf.worker.min.js` (+1,5 Mo au précache).
- `BUILD.id` = 10 premiers hex de SHA-256(`sw.js` hors bloc généré + chaque fichier du SHELL hors `js/version.js`). Le nom du cache est `'rade-' + BUILD.id`.
- Format affiché : `label = 'v' + n + ' · ' + JJ/MM` (ex. « v26 · 19/10 »).

**`--check` échoue (code 1) si :** `sw.js` ou `js/version.js` ne sont pas ce que l'écriture produirait ; ou `release.json.hash` ≠ hachage courant (« contenu modifié depuis la v26 : lancez npm run release -- "ce qui change" »). Recommandé : la seconde condition est bloquante seulement sur Vercel en production (`VERCEL_ENV === 'production'`), un avertissement ailleurs (aperçus, local) — [ASSUMED : variable système Vercel connue, non relue ce jour].

**Effets voulus :** (a) un commit qui ne modifie que `.planning/`, `tests/`, `tools/`, `api/` ou `middleware.js` ne change ni le hachage ni `sw.js` → aucun faux bandeau ; (b) toute modification de fichier de l'app exige une release donc un numéro et une note (D-07) ; (c) la détection par le navigateur repose sur les octets de `sw.js` : une release oubliée mais bloquée par la porte ne passe pas.

### Pattern 4 : Harnais de tests `node:test` sans build (TEST-01)

**Modules importables sous Node :** tous les `js/*.js` **sauf `js/app.js`** (`location is not defined`) [VERIFIED: import de chaque module, exécuté ce jour]. `obs.js` (importe `voice.js`), `scene3d.js`, `help.js`, `events.js`, `startmode.js`, `weather.js` s'importent sans erreur (accès DOM seulement à l'appel).

**Cales nécessaires (`tests/helpers/env.mjs`) :** `globalThis.DOMParser = parseHTML('<html></html>').DOMParser` (linkedom) ; `globalThis.fetch` lisant `ROOT + chemin` pour `Terrain.load('data/')` (meta.json, terrain.bin, cover.bin, coast.json). `process.env.TZ = 'Europe/Paris'` dans `tests/helpers/setup.mjs`, chargé par `--import` (hérité par les sous-processus de test : vérifié).

**`detect(tr)` est pur** (pas de DOM) ; `analyze(det, ans, api)` demande `api = { F, ctx:{terrain, forbidden, perf}, localFx, forecastAt, restoreField, obs }` (voir js/app.js:853-862). Les résultats ne dépendent pas du fuseau (même empreinte sous UTC, Paris, New York) ; seuls les formats d'heure du texte du rapport en dépendent.

**Entrées figées pour la référence :** ne pas utiliser `data/wx-snapshot.json` (prévision du 17/10, régénérable par `tools/snapshot_weather.py`) ni une prévision réseau. Passer 3 relevés (`api.obs`) aux heures des bords : ils donnent la force de vent « de référence » de chaque bord, indépendamment des fichiers de données météo.

**Valeurs de référence actuelles (extraites ce jour, à faire valider par Romain, D-12) :**

| Élément | Valeur actuelle |
|---------|-----------------|
| Trace | 9 538 points, `fromGPX` : début 2026-10-18T06:04:23Z ; 2 `trkseg` |
| Parcours | `det.mc` : parcours **4**, classe `'P'`, 1 tour, `reduced: true` |
| Passages (`det.pass`) | 7 → 10:11:51Z (33 m) ; 6 (Houlographe) → 10:55:20Z (30 m) ; 5 (GR2) → 11:42:56Z (2 m) ; puis 4 → 11:50:19Z (146 m, retour après l'arrivée : la détection le prend pour la fin, l'équipier le décoche) |
| Faux départs (`det.launches`) | 2 : 09:31:02Z–09:35:24Z et 09:41:22Z–09:42:46Z (= 11:31→11:35 et 11:41→11:43 à Paris, comme le rapport) |
| Départ détecté (`det.tStart`) | 09:43:42Z (11:43:42 Paris). Le rapport publié donne « bon départ 11:44:20 » et départ saisi 11:45:00 : écart de 38 à 78 s à trancher avec Romain |
| Entrées d'`analyze` | marques 7, 6, 5 ; `startWind` 60 ; `tStart` 09:45:00Z ; relevés (09:58Z 60°/7,6 nd ; 10:33Z 30°/7,1 ; 11:19Z 15°/5,9) |
| Vent par bord (`legs[i].wind`) | bord 1 : 60°, 6,5 nd (« vent au départ ») ; bord 2 : 31,29°, 7 nd (« vos changements d'amure ») ; bord 3 : 31,21°, 4,5 nd |
| % polaire par bord | bord 1 : travers 86 (92/82), près 93 (101/89) ; bord 2 : portant 102 (115/93) ; bord 3 : travers 60 (73/55), près 80 (98/73) |
| Bord 3 (`st`) | 11 virements ; 14 % du temps sous 2 nd ; 73 % à droite de la route directe ; verdict « À travailler » |
| Distances (`st`) | parcourue / directe : 4 262,8 / 4 157,7 m ; 6 581,8 / 5 447,1 m ; 4 233,0 / 2 728,9 m (total 8,14 Nq / 6,66 Nq ; rapport : 8,2 / 6,8) |
| Angles | bord 2 empannage mesuré 72° / polaire 60° ; bord 3 virement 108° / 88° |
| Durée du test | ≈ 2,6 s |

Ces valeurs diffèrent un peu du rapport publié (97 / 104 / 74 %, vent du modèle AROME horaire) parce que la référence figée utilise des relevés fixes et le modèle de vent a évolué depuis (frein côtier ajouté après la course) : c'est un test de **non-régression**, pas une preuve de justesse physique. Les positions des marques 7 et 6 viennent d'ailleurs de cette même trace (« relevé GPS du 18/10/2026 (±50 m) », js/courses.js), d'où des passages à 33 et 30 m : la future recalée de bouées (JUST-02) fera légitimement bouger ces nombres.

**Cas fabriqués de base (valeurs exécutées ce jour)** : `toXY(43.1, 5.95)` = `{ x: 0, y: 1105.74 }` (aller-retour `toLL` exact) ; `bearingXY` N=0°, E=90° ; `norm180(190)` = −170 ; `boatSpeed(10, 90)` = 6,52 ; `boatSpeed(6, 45)` ≈ 4,6267 ; `optimalAngles(10)` = `up{twa 38, vmg 4,3656, bsp 5,54}`, `down{twa 150,5, vmg 5,2921, bsp 6,0803}` ; `spiMinTwa(10)` = 100 ; `WindField` base 60°/8 nd rafale 11, `localEffects: 1` : en (43,09 N ; 5,96 E) 5,92 nd / 73,67°, en (43,07 N ; 5,93 E) 4,48 nd / 59,61° ; `route(7 → 6)` : 2 357,7 s, 1 manœuvre, 42 points ; `buildLegs` parcours 4 `'P'` 1 tour vent 60° : 8 bords, 1er bord 3 637 m cap 113° ; `parseIC` sur le texte des IC SNPM : `event` « COUPE de la SNPM CVAT », `date` 2026-10-18, `firstWarning` 10:55, `lastFinishSignal` 16:00, `vhf` 72. Arrondir les flottants à la précision d'affichage (D-12 interdit les larges tolérances, pas l'arrondi).

### Pattern 5 : Test d'accès sans code réel (TEST-02)

- `middleware.js` : table `EQUIPAGE` constante d'empreintes SHA-256 [VERIFIED: lecture ce jour, valeurs masquées], `COOKIE = 'rt_acces'`, `config.matcher = ['/((?!acces\\.html|manifest\\.webmanifest|sw\\.js|icons/|rapports/).*)']` ; sans accès : navigation (`sec-fetch-mode: navigate` ou `accept` contenant `text/html`) → 302 vers `/acces.html?suite=…`, sinon 401 (JSON `{"error":"acces"}` pour `/api/`), jamais `next()`.
- **Mécanisme sans code dans le dépôt :** pour les cas « refusés », aucun code n'est nécessaire. Pour le cas « accepté », `mock.method(crypto.subtle, 'digest', …)` : quand l'entrée est `'code-de-test'`, renvoyer l'empreinte (lue **à l'exécution** dans `middleware.js` par regex) d'une ligne de la table. Aucune modification de `middleware.js`, aucun vrai code ni empreinte recopiés ; le faux code cesse de marcher après `restore()` (le test le vérifie). Testé : cookie → `x-middleware-next: 1`, `?acces=` → 302 + cookie `HttpOnly; Secure; SameSite=Lax`.
- **Énumération :** parcourir tout le dépôt (hors `node_modules`, `.git`, `.vercel`) ; liste publique **écrite dans le test** (`/acces.html`, `/manifest.webmanifest`, `/sw.js`, préfixes `/icons/`, `/rapports/`) ; assertion : exactement les fichiers publics sont hors matcher, tous les autres passent par le middleware et reçoivent 302/401 avec n'importe quel cookie faux. Ajouter les fonctions `/api/<nom>` (fichiers `api/*.js` sans `_`), `/api/inconnu`, `/.planning/…`, `/srv.log`, `/package.json`, `/middleware.js`, `/vercel.json`, `/tests/…`. Mutation vérifiée : ajouter `|data/` au matcher fait échouer le test.
- `vercel.json` : assertion « pas de `rewrites`, `routes`, `redirects`, `cleanUrls` » (aucun aujourd'hui) pour qu'un contournement futur force une relecture.
- **Constat à corriger (voir Pitfall 6)** : le matcher exclut par **préfixe** et sans casse (`/sw.jsx`, `/sw.js.map`, `/acces.html.bak`, `/manifest.webmanifest.old` sont publics). Version resserrée testée : `(?!acces\\.html$|manifest\\.webmanifest$|sw\\.js$|icons/|rapports/)`.

### Pattern 6 : Porte de déploiement (TEST-03)

`vercel.json` actuel : seulement `headers` (`Cache-Control: no-cache` sur `/`, `/index.html`, `/sw.js`, `/styles.css`, `/js/:path*`, `/data/:path*`) et `functions` (`maxDuration` 60 pour `api/debrief.js` et `api/rules.js`) [VERIFIED: lecture ce jour]. Ajouter :
```json
"installCommand": "npm ci",
"buildCommand": "npm run check"
```
Ne **pas** fixer `outputDirectory` ni créer de dossier `public` : le préréglage « Other » sert `public` s'il existe, sinon `.` [CITED: vercel.com/docs/builds/configure-a-build#output-directory]. `buildCommand` du `vercel.json` remplace celui du tableau de bord [CITED: vercel.com/docs/project-configuration/vercel-json#buildcommand] ; l'installation inclut les `devDependencies` [CITED: configure-a-build, Install Command]. Quand un déploiement de production **réussit**, Vercel pointe les domaines de production vers lui [CITED: vercel.com/docs/deployments/environments, Production Environment] : un build en échec ne remplace donc pas la production.

**Issue de secours (discrétion) :** `package.json` `check` délègue à un garde qui, si `RT_GATE_BYPASS=1` est défini dans les variables d'environnement du projet pour **un** redéploiement, affiche un avertissement et ne lance que la vérification de syntaxe. Traçable (changement de variable dans le tableau de bord), jamais par défaut. Sinon : « Promote » d'un déploiement précédent réussi depuis le tableau de bord. Notification : l'échec de build apparaît sur le commit GitHub et dans le tableau de bord ; l'envoi d'un e-mail est un comportement par défaut de Vercel [ASSUMED, à confirmer avec Romain].

Séquence imposée (STATE.md l'exige) : plans 1 à 4 d'abord (outils, tests, SW, verrou), activer `buildCommand` **en dernier**, après un déploiement d'aperçu où l'on vérifie : accueil, `/sw.js` (public : doit contenir le bloc généré), `/data/meta.json` (derrière l'accès), pas de changement de contenu servi ; puis un push volontairement cassé sur une branche d'essai (statut Error attendu).

### Anti-Patterns to Avoid
- **Retirer `skipWaiting` en laissant le réseau d'abord :** ne diffère rien (mesuré).
- **Un nom de cache qui ne change pas quand `sw.js` change :** le worker en attente écrirait dans le cache que l'ancien worker sert encore (mélange). Le hachage inclut donc la logique de `sw.js`.
- **Recharger sur `controllerchange` sans drapeau de geste :** garde `wantReload` obligatoire (le premier `claim()` d'une installation neuve déclenche aussi l'événement).
- **`node --test tests/` :** échoue sous Node 22.22 (le dossier est traité comme un module).
- **Utiliser l'heure de l'appareil pour la règle des 9 h :** utiliser `Intl.DateTimeFormat` avec `timeZone: 'Europe/Paris'` et `hourCycle: 'h23'`.
- **Mettre `tests/` dans `.vercelignore` :** la porte de build en a besoin ; `middleware.js` protège déjà tout (le test le prouve).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exécuteur de tests | Un script maison | `node:test` + `node:assert/strict` | Intégré, stable, `--import` pour les cales |
| DOMParser pour le GPX | Un parseur XML | `linkedom` | Déjà exercé sur la vraie trace |
| Fuseau Paris et heure d'été | Calcul d'offset à la main | `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', hourCycle: 'h23', … }).formatToParts` | Gère le passage du 25/10/2026 (vérifié : 02 h deux fois) |
| Hachage de contenu | Somme maison | `node:crypto` SHA-256 | Standard |
| Correction du puits d'évaluation pdf.js | Patcher `vendor/pdf.min.js` | Option `isEvalSupported: false` de `getDocument` | Officielle, couvre les deux puits du code vendorisé |
| Analyse du matcher Vercel | Expression ad hoc divergente | `new RegExp('^' + matcher + '[/#?]?$', 'i')` (ou `path-to-regexp@6`) | Même résultat sur 32 chemins |
| Mise à jour de SW | Logique de version à la main dans la page | `waiting` + `postMessage` (web.dev) | Le cycle de vie est normalisé [CITED: web.dev/articles/service-worker-lifecycle] |

**Key insight :** tout ce qui doit « ne pas être oublié » (version, SHELL, accès, point d'appel pdf.js) devient une vérification automatique dans `npm run check`, pas une consigne.

## Common Pitfalls

### Pitfall 1 : Croire que `skipWaiting` retiré suffit
**What goes wrong :** une mise en ligne pendant la course est quand même appliquée au premier rechargement ou relancement de la page.
**Why :** fetch « réseau d'abord » (sw.js:18-22) ; un rechargement ne libère pas un worker en attente [CITED: web.dev] mais la page charge déjà le nouveau code par le réseau.
**How to avoid :** cache d'abord pour tout ce qui est dans le SHELL (Pattern 1).
**Warning signs :** après un déploiement, une page rechargée affiche la nouvelle version alors que `reg.waiting` existe.

### Pitfall 2 : Dernier déploiement « à l'ancienne » (transition)
**What goes wrong :** les téléphones qui ont encore le worker v25 (`skipWaiting` + rechargement sur `controllerchange`) appliqueront **cette** mise en ligne automatiquement, en rechargeant la page.
**How to avoid :** livrer ce correctif à un moment calme (règle d'exploitation : pas dans les 48 h avant une régate ni en course). Après cela, le nouveau mécanisme prend le relais. À inscrire dans le plan.

### Pitfall 3 : Relance à froid pendant une course
**What goes wrong :** si iOS tue la page puis la relance, un worker en attente est activé quand il n'y a plus de client (cycle de vie normalisé [CITED: web.dev]) : la nouvelle version s'applique sans geste. Le verrou persistant n'y peut rien (le SW ne lit pas localStorage). Comportement exact sur iOS en app installée : [ASSUMED].
**How to avoid :** règle d'exploitation (aucune mise en production dans les 48 h avant une régate sauf correctif critique hors course) ; ne pas appeler `reg.update()` pendant le verrou (évite de télécharger le précache en mer). Parade optionnelle plus tard : écrire le verrou dans Cache Storage pour que le worker garde l'ancien cache — hors périmètre de cette phase.

### Pitfall 4 : Le nom du cache doit changer avec la logique du SW
Voir Anti-Patterns. Le hachage inclut `sw.js` hors bloc généré.

### Pitfall 5 : `node --test` sous Node 22
Le dossier en argument échoue ; un glob entre guillemets ou aucun argument fonctionne [VERIFIED: exécuté ce jour]. `engines` ≥ 22 ; Node 20 ne gère pas les globs.

### Pitfall 6 : Matcher d'accès par préfixe et insensible à la casse
**What goes wrong :** tout futur fichier nommé `sw.js…`, `acces.html…`, `manifest.webmanifest…` ou placé sous `icons/` / `rapports/` est public sans que personne ne l'ait voulu (`/sw.js.map`, par exemple). `/icons/../data/meta.json` correspond aussi tel quel (normalisation du chemin avant routage : [ASSUMED]).
**How to avoid :** ancrer par `$` les trois noms exacts (testé) ; le test énumère les fichiers sous `icons/` et `rapports/` et compare à une liste attendue. Vérifier sur l'aperçu : `GET /sw.jsx` sans cookie → 302/401. `sw.js` reste public : il contiendra la liste des noms de fichiers et la note de version (info faible, acceptée).

### Pitfall 7 : pdf.js : mauvaise version annoncée
`CLAUDE.md` et la recherche de pile disent « 3.32.2 » : c'est la version de **core-js** embarquée. La version pdf.js vendorisée est **3.11.174** [VERIFIED: vendor/pdf.worker.min.js contient `w="3.11.174";if(y!==w)throw new Error(\`The API version "${y}" does not…` ; vendor/pdf.min.js contient `version:"3.32.2",mode:i?"pure":"global",copyright:"© 2014-2023 Denis Pushkarev (zloirock.ru)"`]. CVE-2024-4367 : versions affectées ≤ 4.1.392, corrigé en 4.2.67, contournement officiel `isEvalSupported: false` [CITED: github.com/advisories/GHSA-wgrm-67xf-hhpq]. Mettre à jour `CLAUDE.md` (Technology Stack).

### Pitfall 8 : Fichier généré qui s'inclut lui-même
`js/version.js` doit être dans le SHELL dès la première génération et **exclu du hachage** ; sinon la liste change au deuxième passage (rencontré et corrigé dans le prototype).

### Pitfall 9 : Révocation d'un accès sous cache d'abord
Avant : un équipier retiré de la table était renvoyé vers `acces.html` à la prochaine ouverture en ligne. Après : l'app installée continue de s'ouvrir depuis le cache, et la nouvelle installation du SW (qui précache avec les cookies) échouera ; les API restent refusées côté serveur (401). Effet à connaître et à accepter ou compenser plus tard (SECU2-02). [ASSUMED sur l'échec de `addAll` avec réponses non OK : comportement standard de `Cache.addAll`.]

### Pitfall 10 : Données de référence et marques
Les références changeront légitimement (JUST-02 recale des bouées, évolutions du vent) : prévoir dans le plan le geste « présenter l'avant/après à Romain puis réenregistrer » (D-12) ; garder les attendus dans un seul fichier de données par cas pour que le diff soit lisible.

### Pitfall 11 : Chrono qui ne s'arrête jamais
`timer.end` reste non nul après H (il compte « +m:ss »). Sans plafond, un chrono oublié verrouille indéfiniment ; avec `GRACE` il rend la main.

### Pitfall 12 : `.vercelignore` et `srv.log`
Ne pas exclure `tests/`. `srv.log` (11 Ko, journal d'un serveur local, suivi par Git) est servi derrière l'accès mais inutile : le retirer du dépôt et ajouter `*.log` à `.gitignore` (hygiène, optionnel).

## Code Examples

### `js/racelock.js` (testé)
```js
// Verrou « en course » (D-01 à D-03) : fonction pure, sans DOM ni horloge. Les mises à jour de l’app n’y sont jamais appliquées.
export const PARIS = 'Europe/Paris';
export const MORNING_END_H = 9;       // D-03
export const IDLE_MS = 3600e3;        // D-02 : retour au port = tout arrêté depuis 1 h
const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
export function parisClock(ms) {
  const p = Object.fromEntries(FMT.formatToParts(ms).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute };
}
export function lockState({ now, active, raceDay = null, lastActiveAt = null, finishedAt = null }) {
  if (active) return { locked: true, reason: 'course' };
  if (!raceDay) return { locked: false, reason: null };
  const n = parisClock(now);
  if (n.date !== raceDay || n.hour < MORNING_END_H) return { locked: false, reason: null };
  const inLock = (t) => { if (t == null) return false; const c = parisClock(t); return c.date === raceDay && c.hour >= MORNING_END_H; };
  const finished = finishedAt != null && parisClock(finishedAt).date === raceDay && finishedAt >= (lastActiveAt ?? 0);
  const idle = inLock(lastActiveAt) && now - lastActiveAt >= IDLE_MS;
  return finished || idle ? { locked: false, reason: null } : { locked: true, reason: 'journee' };
}
```
Tests écrits (extrait) : `parisClock(Date.parse('2026-11-07T08:00:00Z'))` → `{date:'2026-11-07', hour:9, minute:0}` (CET) ; `'2026-10-18T10:00:00Z'` → heure 12 (CEST) ; 08:59 CET libre, 09:00 CET verrouillé ; activité à 08 h Paris ne libère pas ; reprise après « finie » reverrouille. Heure d'été : le test peut aussi fixer `2026-10-25T00:59:59Z` et `01:00:00Z` (02 h deux fois).

### `js/swupdate.js` (protocole éprouvé dans Chromium)
```js
// Mise à jour différée : la nouvelle version attend (« waiting ») ; elle n’est appliquée que sur un geste, jamais en course (D-04 à D-07).
import { BUILD } from './version.js';
export function initUpdates({ isLocked, onAvailable, onHidden, onApplied = () => location.reload() }) {
  if (!('serviceWorker' in navigator)) return null;
  let pending = null, wantReload = false;
  const sw = navigator.serviceWorker;
  const announce = (worker) => { if (!worker || worker === pending?.worker) return; pending = { worker, build: null }; worker.postMessage({ type: 'GET_BUILD' }); };
  sw.addEventListener('message', (e) => {
    if (e.data?.type !== 'BUILD' || !pending) return;
    pending.build = e.data.build;
    if (pending.build.id === BUILD.id) { pending = null; return; }
    refresh();
  });
  function refresh() { if (!pending?.build) return; if (isLocked()) onHidden(); else onAvailable(pending.build); }   // appelé par le tick de 5 s d’app.js
  function apply() {                                    // bouton « Mettre à jour » : le verrou peut s’être refermé entre l’affichage et le geste
    if (!pending || isLocked()) return false;
    wantReload = true; pending.worker.postMessage({ type: 'SKIP_WAITING' }); return true;
  }
  sw.addEventListener('controllerchange', () => { if (wantReload) onApplied(); });     // sans geste : on ne touche à rien
  sw.register('sw.js', { updateViaCache: 'none' }).then((r) => {
    if (r.waiting && sw.controller) announce(r.waiting);
    r.addEventListener('updatefound', () => { const w = r.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) announce(w); }); });
    const check = () => { if (!isLocked()) r.update().catch(() => {}); };           // pas de téléchargement de version en course
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 15 * 60e3); check();
  }).catch(() => {});
  return { apply, refresh };
}
```
Branchement dans `js/app.js` : remplacer les lignes 84-93 (bloc `if ('serviceWorker' in navigator) {…}`) par `const updates = initUpdates({ isLocked: () => lockState(lockInput()).locked, onAvailable: showUpdateBar, onHidden: hideUpdateBar });` + le tick de 5 s (`updates.refresh()`), le bouton appelle `updates.apply()` (si `false` : `toast('Course en cours : mise à jour reportée')`).
Mesuré dans Chromium : bandeau « Nouvelle version v30 · 19/10 · bips plus sûrs (critique) » ; page toujours v29 après rechargement manuel (bandeau de nouveau présent) ; verrou → bandeau masqué et `apply()` = `false` ; geste → 1 navigation, page v30, caches `['rade-f2e50054ce']`.

### `tools/stamp.mjs` (prototype exécuté, idempotent : 2 passages = même `sw.js`)
Points clés (reprendre le prototype ; ~70 lignes, Node pur) :
```js
const ROOT_FILES = ['index.html', 'styles.css', 'manifest.webmanifest', 'guide.html', 'regles.html'];
const DIRS = ['js', 'data', 'vendor', 'icons'];
const SKIP = /\.(txt|md|py)$|(^|\/)\.|LICENSE/;
const GENERATED = new Set(['js/version.js']);                 // dans le SHELL, hors hachage
export function listShell(root) { /* './' + racine + DIRS parcourus triés, SKIP exclu, + GENERATED, tri déterministe */ }
export function contentHash(shell, swTemplate, root) {        // sha256(sw.js sans bloc généré + chemin\0contenu de chaque fichier) → 10 hex
}
// bloc écrit dans sw.js entre « /* stamp:begin … */ » et « /* stamp:end */ » :
//   const BUILD = {"n":26,"date":"2026-10-19","label":"v26 · 19/10","note":"…","critical":false,"id":"<hash>"};
//   const VERSION = 'rade-' + BUILD.id;   const SHELL = ["./", "data/basemap.jpg", …];
// js/version.js : export const BUILD = {…};  (même objet)
// modes : (aucun) écrit  |  --release "note" [--critical]  incrémente release.json puis écrit  |  --check  code 1 si périmé ou hash ≠ release.hash
```
Le test unitaire de TEST-04 appelle `listShell(dossierTemporaire)` avec un `js/nouveau.js` ajouté et vérifie qu'il apparaît ; un autre exécute `build()` deux fois (même sortie) et modifie un octet de `js/geo.js` (le `id` change) ; un troisième vérifie que chaque `import` relatif de `js/*.js`, chaque `src`/`href` local de `index.html`, chaque icône du manifest et chaque `loadScript('…')` correspond à une entrée du SHELL (aujourd'hui manquent : `icons/icon-maskable-512.png`, `vendor/pdf.min.js`, `vendor/pdf.worker.min.js`).

### Version dans l'aide, ligne d'état (FIAB-02, D-08)
- `js/help.js:97` `export function openGuide() { modal(GUIDE, 'guide'); }` → `modal(GUIDE + `<p class="small muted">Version ${esc(BUILD.label)} — ${esc(BUILD.note)}</p>`, 'guide')` avec `import { BUILD } from './version.js'` (`GUIDE` est une chaîne statique : ajouter la ligne à l'ouverture, pas dans la constante).
- `js/app.js:21` supprimer `export const APP_VERSION = 'v25 · accès équipage';` (aucun autre module ne l'importe) ; `js/app.js:116` devient `el.textContent = `${S.src === 'manual' ? 'vent manuel' : `prévisions ${data.snapshot ? 'embarquées' : 'màj'} ${when}`}`;`. Mettre à jour `CLAUDE.md` (lignes sur `APP_VERSION`, `VERSION`, `SHELL`).

### pdf.js (SECU-01)
- `js/events.js:40` aujourd'hui : `const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;` → ajouter `isEvalSupported: false` (idéalement une constante exportée `PDF_OPTIONS`).
- **Mesure (Chromium, pdf.js vendorisé, polices en chemins `disableFontFace: true`, `Function` instrumenté) :** IC SNPM : 252 constructions avec l'option par défaut, **0** avec `false` ; Cahier de parcours : 76 contre **0** ; extraction de texte identique (11 302 et 11 036 caractères) ; en extraction de texte seule (ce que fait l'app) aucune construction dans les deux modes. [VERIFIED: exécuté ce jour]
- **Code vendorisé lu (puits uniques) :** main thread `if(this.isEvalSupported&&i.FeatureTest.isEvalSupported){const t=[];for(const e of n){…}return this.compiledGlyphs[e]=new Function("c","size",t.join(""))}` ; worker `if(a&&n.FeatureTest.isEvalSupported){const e=(new PostScriptCompiler).compile(h,o,c);if(e)return new Function("src","srcOffset","dest","destOffset",e)}` ; le drapeau vient de `_=!1!==t.isEvalSupported` dans `getDocument` et est transmis au `FontFaceObject` et à `evaluatorOptions`. Les autres `Function(`/`eval(` du code sont des constantes (core-js `Function("return this")`, `eval("require")` réservé à Node).
- **Tests automatisables sans navigateur :** (a) `pdfText(file)` avec `globalThis.window = { pdfjsLib: { GlobalWorkerOptions: {}, getDocument: spy } }` et un `File` : assertion `options.isEvalSupported === false` ; (b) garde statique dans `npm run check` : tout appel `getDocument(` de `js/**` doit contenir `isEvalSupported: false` (protège REG-03, qui ajoutera l'import) ; (c) `parseIC` sur `tests/fixtures/ic-coupe-snpm-2026.txt` (« les IC CVAT habituelles s'importent toujours ») ; (d) optionnel, hors porte : script Playwright local reprenant la mesure ci-dessus (Playwright n'est pas une dépendance du dépôt).
- **Fixture texte des IC :** régénérable à l'identique (octet pour octet avec le navigateur, 11 476 caractères) hors dépôt : `npm i --no-save pdfjs-dist@3.11.174` dans un dossier temporaire, puis la boucle de `pdfText` (js/events.js:37-52) sur `pdfjs-dist/legacy/build/pdf.js` avec `getDocument({ data, isEvalSupported:false, useWorkerFetch:false, disableFontFace:true })`. Le PDF source est `/root/.claude/uploads/926bb538-7b85-59d9-9d1a-dfdf8d036029/f0799e5e-IC_Coupe_Snpm_2026-10-18.pdf` (à copier avant la fin de la session). Le texte contient le téléphone du comité, déjà présent dans `js/courses.js`.
- **Défense en profondeur (non retenue pour la phase) :** un en-tête `Content-Security-Policy` sans `unsafe-eval` bloquerait aussi ces puits ; il demande de lister styles en ligne et appels réseau de l'app : risque pour la régate, à reporter.

### Harnais (`tests/helpers/env.mjs`, testé)
```js
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
export const ROOT = new URL('../../', import.meta.url).pathname;
globalThis.DOMParser = parseHTML('<html></html>').DOMParser;
globalThis.fetch = async (u) => {
  const b = readFileSync(ROOT + String(u).replace(/^\.?\//, ''));
  return { ok: true, json: async () => JSON.parse(b.toString('utf8')), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
};
export const fixture = (n) => readFileSync(ROOT + 'tests/fixtures/' + n, 'utf8');
```
Test de référence (extrait, passe) : `const tr = fromGPX(fixture('9aa32494-18-oct.-2026-0813.gpx'), 'coupe-snpm.gpx'); const det = detect(tr);` puis `assert.deepEqual(det.pass.slice(0, 3).map((p) => [p.k, iso(p.t), Math.round(p.d)]), [['7','10:11:51Z',33], ['6','10:55:20Z',30], ['5','11:42:56Z',2]])`, `assert.deepEqual(det.launches.map((l) => [iso(l.t0), iso(l.t1)]), [['09:31:02Z','09:35:24Z'], ['09:41:22Z','09:42:46Z']])`, et pour `analyze` : `ans = { course: det.mc.c, cls: 'P', marks: det.mc.hit.slice(0, 3).map((h, i) => ({ k: h.k, t: h.t, side: det.mc.exp[i].side })), startWind: 60, tStart: Date.parse('2026-10-18T09:45:00Z'), falseStarts: 2, reduced: true }` avec `api = { F: new WindField(T), ctx: { terrain: T, forbidden: [], perf: 1 }, localFx: 1, forecastAt: () => ({ dir: 60, spd: 7 }), restoreField() {}, obs }`.

### Test du SW sans navigateur (testé, 3 tests)
`vm.runInNewContext(sw.js, { self, location, caches, Request, Response, URL, fetch })` avec un `Request` qui résout les URL relatives (`new Request('./')` échoue sous Node). Assertions : `install` précache > 30 fichiers sans appeler `skipWaiting` ; `message {type:'GET_BUILD'}` répond `{type:'BUILD', build}` avec `label` `^v\d+ · \d\d/\d\d$` ; `message {type:'SKIP_WAITING'}` appelle `skipWaiting` une fois ; `fetch` d'un fichier du SHELL est servi depuis le cache, `/api/…` n'est pas intercepté.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `skipWaiting` + rechargement auto | Worker en attente + message sur geste | Pratique courante | Aucune bascule en course |
| Réseau d'abord pour tout le site | Cache d'abord versionné pour le SHELL, réseau pour le reste | Idem | Page cohérente avec son worker, hors réseau fiable |
| `VERSION`/`SHELL` à la main | Générés par script, vérifiés par la porte | Cette phase | Plus d'oubli |
| Vitest/Jest | `node:test` natif | Node ≥ 20 stable | Zéro dépendance |
| pdf.js ≤ 4.1.392 avec `eval` par défaut | `isEvalSupported: false` ou ≥ 4.2.67 | 2024-05 (CVE-2024-4367) | Option ici ; mise à jour de pdf.js hors périmètre |
| Middleware Edge | Runtime `nodejs` par défaut de Routing Middleware | doc Vercel 2026-08 | `crypto.subtle` global disponible ; code inchangé |

**Deprecated/outdated :** Node 20 sur Vercel (déprécié le 1er octobre 2026 [CITED: vercel.com/changelog/node-js-20-is-being-deprecated]) ; la mention « pdf.js 3.32.2 » de `CLAUDE.md`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GRACE` du chrono ≈ 3 h après `timer.end` avant de ne plus compter comme « actif » | Pattern 2 | Chrono oublié verrouille trop longtemps / pas assez ; à faire valider par Romain |
| A2 | Pour la journée de régate on lit la seule fiche **choisie** (`IC.date`) ; une régate de plusieurs jours (7-9 nov) ne verrouille que la date de la fiche | Pattern 2 / Open Questions | Pas de verrou les jours 2 et 3 ; prévoir `raceDays` (liste) dans `lockState` si la fiche couvre plusieurs jours |
| A3 | `VERCEL_ENV` vaut `production` pendant le build de production et le contrôle « pas releasé » peut y être bloquant | Pattern 3 | Si absente, le contrôle strict s'applique partout ou nulle part |
| A4 | Vercel envoie un e-mail / statut GitHub d'échec de build | Pattern 6 | Pas de notification : Romain n'est prévenu qu'en regardant le tableau de bord |
| A5 | Node 24 (défaut Vercel) exécute la suite comme Node 22.22 (essayée ici) | Standard Stack | Échec du premier build ; premier aperçu obligatoire |
| A6 | Sur iOS en app installée, la relance à froid active le worker en attente sans geste | Pitfall 3 | Résiduel plus faible que décrit ; la règle d'exploitation reste la parade |
| A7 | Vercel normalise les chemins (`/icons/../…`) avant le routage du middleware et compile le matcher comme `path-to-regexp` | Pitfall 6 | Écart entre test et production ; vérifier `/sw.jsx` sur l'aperçu |
| A8 | `Cache.addAll` échoue si une réponse n'est pas OK (révocation d'un accès : le nouveau SW ne s'installe pas) | Pitfall 9 | Comportement différent selon navigateur |
| A9 | `postMessage` d'un client vers un worker en attente et réponse via `event.source` fonctionnent aussi sous Safari iOS | Pattern 1 | Bandeau sans note ; à tester sur iPhone |
| A10 | Inclure `vendor/pdf*.js` (+1,5 Mo) au précache est acceptable | Pattern 3 | Mise à jour plus lourde sur réseau faible ; option : retirer de `SKIP`/`ROOT` |

## Open Questions

1. **Départ de référence : valeur du code ou valeur humaine ?**
   - Known : `detect` donne 11:43:42 Paris ; le rapport publié dit « bon départ 11:44:20 » et l'équipier a saisi 11:45:00 ; la détection de fin retient la marque 4 (11:50:19Z) au lieu de GR2.
   - Unclear : D-11 dit « le bon départ à la bonne heure ».
   - Recommendation : enregistrer la sortie actuelle exacte comme référence et la présenter à Romain (D-12) ; ne pas élargir la tolérance.
2. **Régate sur plusieurs jours (7-9 novembre).** `IC.date` est unique. Recommandation : `lockState` accepte `raceDays: string[]`, alimenté par la phase 3 ; en attendant, Romain peut créer une fiche par jour.
3. **Emplacement du bouton « course finie ».** Recommandation : onglet « En course », visible quand `IC.date` = aujourd'hui ; décision d'interface (UI-SPEC éventuel).
4. **Précache de pdf.js.** Inclure (recommandé, import d'IC hors réseau au ponton) ou laisser en ligne.
5. **Contrôle « release obligatoire » strict ou souple.** Recommandation : strict seulement en production (A3), avertissement ailleurs.
6. **Règle d'exploitation à inscrire** (guide / README / `CLAUDE.md`) : pas de mise en production dans les 48 h avant une régate ni en course, sauf correctif critique hors course ; la mise en ligne de ce correctif (Pitfall 2) est la dernière à recharger les téléphones toute seule.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, `stamp` | ✓ | 22.22.0 (Vercel : 24.x par défaut) | — |
| npm | installation, lockfile | ✓ | 10.9.4 | — |
| linkedom | TEST-01 (GPX) | ✓ (installé en bac à sable) | 0.18.13 | — |
| Chromium + Playwright | essais du protocole SW / mesure pdf.js (hors dépôt) | ✓ | Chromium 1194, Playwright 1.56.1 | Essai sur iPhone |
| Node 24 | parité avec Vercel | ✗ | — | Premier déploiement d'aperçu |
| Appareil iOS | comportement standalone, relance à froid | ✗ | — | Essai en mer / au ponton avant le gel du 2 novembre |
| Accès Vercel (tableau de bord, aperçu) | activation de `buildCommand`, essai d'aperçu | ✗ (non testable ici) | — | Étape manuelle de Romain (`checkpoint:human-verify`) |

**Missing dependencies with no fallback :** aucun bloquant pour l'écriture du code.
**Missing dependencies with fallback :** Node 24, iOS, Vercel : étapes de vérification humaines listées dans les plans.

## Validation Architecture

> `workflow.nyquist_validation` est `false` dans `.planning/config.json` : section réduite à la carte des tests, utile ici car la phase est elle-même un harnais.

| Req | Comportement | Type | Commande | Fichier |
|-----|--------------|------|----------|---------|
| TEST-01 | calculs de base + référence SNPM | unitaire / intégration | `node --test --import ./tests/helpers/setup.mjs tests/reference.test.mjs` | ❌ à créer |
| TEST-02 | accès | unitaire (middleware réel) | `… tests/access.test.mjs` | ❌ |
| TEST-03 | porte | manuel (aperçu) | push cassé sur branche → statut Error | — |
| TEST-04 | SHELL, version, release | unitaire | `… tests/stamp.test.mjs` + `node tools/stamp.mjs --check` | ❌ |
| SECU-01 | option pdf.js, garde statique, `parseIC` | unitaire | `… tests/pdf.test.mjs` | ❌ |
| FIAB-01 | SW sans `skipWaiting`, verrou | unitaire | `… tests/sw.test.mjs`, `tests/racelock.test.mjs` | ❌ |
| FIAB-02 | version dans l'aide, absente de la ligne d'état | unitaire (chaîne) + manuel | assertion sur `help.js`/`app.js` ou essai visuel | ❌ |

Commande complète : `npm run check` (< 15 s en bac à sable : 13 tests de prototype en ~3 s).
Wave 0 : `tests/helpers/*`, `tests/fixtures/*` (GPX, texte des IC), `package-lock.json`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | oui (déjà en place) | Codes personnels hachés SHA-256 dans `middleware.js` ; le test n'utilise aucun vrai code |
| V3 Session Management | partiel | Cookie `rt_acces` (HttpOnly, Secure, SameSite=Lax, 400 j) ; contient le code brut (CONCERNS ; SECU2-02 différé) |
| V4 Access Control | oui | `config.matcher` : liste blanche d'exclusions ; test d'énumération |
| V5 Input Validation | oui | PDF d'IC non fiable : `isEvalSupported:false` ; note de version affichée via `esc()` ; `release.json` validé (longueur, pas de `<>`) |
| V6 Cryptography | non | Rien de nouveau (SHA-256 de `node:crypto` pour le hachage de contenu, non sensible) |
| V14 Configuration | oui | Pas de secrets dans le dépôt ni dans les tests ; `package-lock.json` ; `npm ci` |

### Known Threat Patterns for ce stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exécution de code par PDF piégé (CVE-2024-4367) | Elevation of Privilege | `isEvalSupported: false` + garde statique sur tout `getDocument(` |
| Fichier privé servi par exclusion de matcher trop large | Information Disclosure | Matcher ancré, liste blanche écrite dans le test, énumération du dépôt |
| Version fautive publiée | Tampering / DoS | Porte `buildCommand` + règle des 48 h |
| Mise à jour imposée en course | DoS (de l'usage) | Worker en attente, verrou, geste obligatoire |
| Information dans `sw.js` public | Information Disclosure | Seuls noms de fichiers et note de version (acceptés) ; jamais de secret dans le bloc généré |
| Cookie contenant le code | Spoofing | Hors périmètre (SECU2-02) |

## Project Constraints (from CLAUDE.md)

- Pas de framework ni de build pour l'app ; outils hors du chargement (scripts `tools/`, tests `tests/`) : respecté (Node pur).
- Hébergement Vercel (statique + fonctions + middleware) ; tout nouveau fichier reste derrière le contrôle d'accès.
- Langue : interface et documents en français ; apostrophe typographique `’` et séparateurs `—`/`·` dans les chaînes ; échapper avec `esc()` avant `innerHTML` (note de version, bandeau).
- Nouveau module navigateur : `js/<nom>.js`, en-tête de commentaire en français, exports nommés, importé depuis `js/app.js` ; **désormais le SHELL est généré** (mettre à jour la consigne « ajouter au SHELL à la main »).
- Ne jamais committer de secrets ; ne pas coller codes, empreintes ni clés dans le code, les commentaires, les docs ou les rapports : le test d'accès lit l'empreinte à l'exécution et ne la recopie pas.
- Contrôle de syntaxe : `node --check` ; `package.json` est déjà `"type": "module"`.
- Mettre à jour `CLAUDE.md` : `APP_VERSION`/`VERSION`/`SHELL` générés, pdf.js 3.11.174, nouvelles commandes `npm run check|release|stamp`, règle d'exploitation.
- Workflow GSD : toute modification de fichiers passe par une commande GSD (ce document est un livrable de recherche).

## Sources

### Primary (HIGH confidence)
- Exécution dans le bac à sable ce jour : imports de tous les modules `js/`, `fromGPX` + `detect` + `analyze` sur la trace réelle, `WindField`, `route`, middleware avec `Request` simulées, SW via `vm`, protocole SW complet dans Chromium 1194 (Playwright 1.56.1), mesure pdf.js sur les deux PDF réels, `node --test` (dossier / glob / `--import`).
- Lecture du code : `sw.js`, `js/app.js` (l.21, 43, 57, 76-93, 116, 633, 697-760, 835-885), `js/events.js`, `js/help.js`, `js/track.js`, `js/startmode.js` (l.393), `js/courses.js`, `js/debrief.js`, `middleware.js` (valeurs masquées), `vercel.json`, `package.json`, `vendor/pdf.min.js`, `vendor/pdf.worker.min.js`.
- Vercel : https://vercel.com/docs/builds/configure-a-build (sortie `public` ou `.`, installation des devDependencies, clone `--depth=10`) ; https://vercel.com/docs/project-configuration/vercel-json (buildCommand, installCommand, outputDirectory) ; https://vercel.com/docs/routing-middleware/api (matcher, regex, `next()`, runtime `nodejs`) ; https://vercel.com/docs/deployments/environments (promotion de production après succès) ; https://vercel.com/docs/functions/runtimes/node-js/node-js-versions (24.x par défaut, 22.x, `engines.node`).
- https://github.com/advisories/GHSA-wgrm-67xf-hhpq (CVE-2024-4367 : ≤ 4.1.392, corrigé 4.2.67, contournement `isEvalSupported: false`).
- https://web.dev/articles/service-worker-lifecycle (waiting, rechargement qui ne compte pas, skipWaiting, claim, controllerchange).
- https://github.com/WebReflection/linkedom (README : DOMParser).
- Registre npm (`npm view`, 2026-10-19) et contrôle de légitimité (`package-legitimacy check`).

### Secondary (MEDIUM confidence)
- Recherche de projet : `.planning/research/PITFALLS.md` (pitfall 3), `ARCHITECTURE.md` (Pattern 5, flux E), `STACK.md` (node:test, linkedom, buildCommand).

### Tertiary (LOW confidence)
- Comportement iOS en app installée (relance à froid, `postMessage` vers worker en attente), e-mails d'échec Vercel, `VERCEL_ENV` : marqués `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — `node:test` et linkedom exécutés sur la trace réelle.
- Architecture (SW différé, verrou, stamp) : HIGH sur le protocole (Chromium) ; MEDIUM sur iOS.
- Pitfalls : HIGH pour ceux mesurés (1, 4, 5, 7, 8) ; MEDIUM pour 3, 6, 9.
- Porte de déploiement : MEDIUM — documentée, non essayée sur le projet Vercel réel.

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (gel du code visé) ; les chiffres de référence sont valables tant que `js/courses.js`, `data/` et le modèle de vent ne changent pas.
