# Phase 5 : Avant la régate : archive amorcée et IA bornée - Research

**Researched:** 2026-10-20
**Domain:** PWA sans build (JavaScript ES modules, IndexedDB `rade-traces`, localStorage) + fonctions Vercel (Node) qui appellent l'API Responses d'OpenAI, compteur quotidien dans le Blob privé déjà en place
**Confidence:** HIGH sur le code lu (chaque fichier cité a été ouvert dans cette session, 472 tests verts avant tout changement, garde de référence SNPM verte) et sur les types du SDK `openai` 7.39.0 et `@vercel/blob` 2.8.0 ; MEDIUM sur le comportement réel de la limite de dépense OpenAI (documentation officielle datée de septembre 2026 qui la dit bloquante, mais des messages de la communauté la disaient « notification seulement » en 2025-2026) et sur la consommation réelle du quota Blob Hobby (estimation) ; aucun accès à Vercel, à OpenAI ni au magasin Blob depuis le bac à sable, donc **contrôles humains listés en fin de document**.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Anciennes traces
- **D-01 :** au premier lancement de la v32, rattrapage automatique, une seule fois par téléphone. Chaque trace locale est rangée dans la régate de son jour avec les règles existantes de `js/attach.js` (`matchRegattas`, `attachTrace`, `sameTrack` : jamais deux fois la même trace). Elle est ensuite partagée par le chemin normal de la phase 4 (objets lourds, `js/archheavy.js`, plafonds et règle « rien pendant une course » inchangés).
- **D-02 :** une trace sans régate ce jour-là reste dans « Traces », sur le téléphone seulement. Aucune fiche « entraînement » n'est créée.
- **D-03 :** le rattrapage ne tourne jamais pendant la journée de régate verrouillée ni pendant une course (`js/racelock.js`). Il est rejoué au lancement suivant s'il a été interrompu. Il est idempotent et consigné dans le journal (`js/journal.js`).
- **D-04 :** la référence SNPM (`js/courses.js`, `tests/reference/`) ne bouge pas. Le garde `git diff --quiet f80c365 -- js/courses.js tests/reference/` reste vert.

#### IA bornée
- **D-05 :** `store: false` sur chaque appel `responses.create` des quatre fonctions, avec un test qui l'exige.
- **D-06 :** quota de **30 appels d'IA par équipier et par jour de Paris**, toutes fonctions confondues.
  - Il est compté côté serveur, par prénom posé par le middleware (`x-rt-membre`), jamais par une valeur du client.
  - Stockage : le magasin Blob privé déjà en place (préfixes `prod/` et `preview/`, écriture avec `ifMatch`).
  - Une écriture par appel. Le volume reste très inférieur au quota Hobby, de l'ordre de 2 000 opérations avancées par mois, mais le chercheur doit confirmer le coût par appel.
  - Au-delà du quota : HTTP 429 avec un message clair en français (« Limite d'IA du jour atteinte — reprise demain »), et l'app reste utilisable sans l'IA.
  - Si le compteur est illisible (Blob en panne) : on laisse passer, on consigne, et le plafond OpenAI reste le filet. L'IA ne doit pas tomber à cause du compteur.
- **D-07 :** plafond de dépense du projet OpenAI à **10 $ par mois**, posé par Romain dans le tableau de bord OpenAI. Le plan fournit un geste guidé pas à pas (à vérifier : limite de budget du projet, bloquante ou seulement une alerte). Quand le budget est atteint, OpenAI refuse les appels : les fonctions renvoient déjà une erreur bornée, à vérifier pour le message affiché.

#### Livraison
- **D-08 :** v32 sur l'aperçu `apercu-phase-05` avec une draft PR, puis production sur « publie » de Romain, avant le 2 novembre. La porte doit passer avec `VERCEL_ENV=production` (leçon de la v31 : `tests/helpers/setup.mjs` neutralise les variables Vercel).

### Claude's Discretion
Aucune section « Claude's Discretion » dans CONTEXT.md. Restent libres, car non décidés : la forme du module de rattrapage, le nom de la clé de stockage du drapeau, le chemin exact des compteurs dans le Blob, le découpage en plans, les textes français des messages d'erreur autres que celui du quota du jour.

### Deferred Ideas (OUT OF SCOPE)
- Fiches « entraînement » pour les traces sans régate (non retenu, D-02)
- Quota d'IA réglable dans l'app
- Hors périmètre de la phase : export JSON/GPX (ARCH2-02), notes d'équipage (ARCH2-03), jeton de session (SECU2-02), écran « Aujourd'hui », plans d'eau.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH2-01 | Reprise de la Coupe SNPM et des données déjà présentes sur les téléphones comme premières régates de l'archive | La Coupe SNPM est déjà une fiche commune (`SEED_ID`/`SEED_AT`, rien à ajouter). Reste le rattrapage des traces orphelines : `rangeTrace(tr, { invite: false })` existe déjà et ne pose jamais de question ; il manque (1) un module pur qui boucle sur les traces avec le verrou de course, (2) l'identifiant canonique des anciens imports GPX (sinon doublons entre téléphones), (3) la référence de rapport posée sur la référence de trace. Le partage passe ensuite par `js/archheavy.js` sans nouveau code. |
| SECU2-01 | Plafond de dépense OpenAI, quota par équipier et non-conservation des données (`store:false`) | Aide commune `api/_ia.js` (nom préfixé `_` = pas une route) : impose `store:false` en un seul endroit, compte 30 appels/équipier/jour de Paris dans le Blob (un `get` simple + un `put` avancé par appel), traduit les erreurs OpenAI en messages français. Le plafond mensuel 10 $ se pose côté OpenAI (« Enforce a hard limit ») : geste guidé fourni plus bas. |
</phase_requirements>

## Summary

**ARCH2-01.** Presque tout est déjà là. La Coupe SNPM est *déjà* une seule fiche sur les trois téléphones : `migrate()` la sème avec l'identifiant `snpm-2026` et un instant commun (`SEED_AT`), `seedNorm()` ramène à cet instant les graines déjà installées, et la phase 4 envoie l'existant à la première synchronisation. Il ne reste que les **traces** de l'IndexedDB `rade-traces` qui n'ont jamais été rangées dans une régate : toutes les traces enregistrées dans l'app (le bouton « Enregistrer ma trace » ne range **jamais** la trace à l'arrêt, seulement un message) et les imports GPX d'avant la v28, plus ceux que l'équipier a laissés « sans régate » ou détachés. Le code de rattachement sans question existe déjà (`rangeTrace(tr, { invite: false })` : rattache seulement si `matchRegattas` rend `unique` ou `heure`, sinon rend `{ reg: null }`). Une fois la référence posée par `saveReg`, la phase 4 envoie la trace toute seule (le plan de `heavyPlan` envoie toute trace locale référencée sans condition d'horizon), **sans nouveau code**. **Piège principal découvert :** avant la v31, un GPX importé recevait un identifiant *aléatoire* (`'tr' + début + Math.round(Math.random()*1000)`) ; si deux téléphones ont importé le même fichier de la Coupe SNPM, le rattrapage poserait deux références et enverrait deux fois 613 Ko, ce qui contredit le critère 1 (« une seule fois »). Il faut donc ramener ces anciens imports à l'identifiant déterministe actuel (`'tr' + début + '-' + nombre de points`) avant de les ranger.

**SECU2-01.** Le SDK `openai` installé (7.39.0) accepte `store?: boolean | null` et documente « Defaults to true when omitted » : aujourd'hui les quatre fonctions *stockent* chaque réponse 30 jours chez OpenAI. Aucune des quatre n'utilise `previous_response_id`, le mode `background` ni la réutilisation d'éléments de raisonnement, donc `store:false` ne casse rien. Attention à la formulation : `store:false` retire le stockage d'état d'application, mais les journaux de surveillance des abus d'OpenAI peuvent garder les requêtes jusqu'à 30 jours (sauf contrat « zéro rétention »). Le quota de 30 appels/jour se fait avec un compteur par équipier et par jour de Paris dans le Blob privé : **1 lecture (opération simple) + 1 écriture `ifMatch` (opération avancée) par appel d'IA**, soit une centaine à quelques centaines d'opérations avancées par mois, mais le Blob Hobby n'a que **2 000 opérations avancées par mois, partagées avec l'archive**, et son dépassement bloque *tout* le Blob pendant 30 jours : le compteur doit donc être ouvert en cas de panne (D-06) et son coût surveillé. Le plafond de dépense OpenAI est bloquant si l'on active l'interrupteur **« Enforce a hard limit »** (documentation officielle ; erreur HTTP 429 de code `project_spend_limit_exceeded`) ; sans cet interrupteur ce n'est qu'une alerte.

**Primary recommendation:** deux modules neufs et testés sans réseau, `js/reprise.js` (rattrapage des traces, pur, dépendances injectées) et `api/_ia.js` (store:false + quota + erreurs, Blob injecté), câblés en quelques lignes dans `js/app.js` et dans les quatre fonctions `api/` (qui passent toutes à la forme `createHandler({ openai, blob, now })` de `api/ic.js`) ; 3 plans : rattrapage, IA bornée, livraison v32 avec le geste guidé de Romain.

## Project Constraints (from CLAUDE.md)

Source : `/home/user/rade-tactique/.claude/CLAUDE.md` (lu). Les points qui touchent cette phase :

- Interface, messages, commentaires et documents d'équipage **en français**, apostrophe typographique `’` dans les chaînes (le message du CONTEXT s'écrit donc `Limite d’IA du jour atteinte — reprise demain`), séparateurs `—` et `·`.
- **JavaScript sans framework ni build** ; outils de test/vérification sans alourdir le chargement de l'app (les nouveaux modules `js/` sont importés dynamiquement ou très légers ; `npm run stamp` les ajoute à `SHELL`).
- Nouveau module navigateur : `js/<nom>.js`, **en-tête de commentaire en français**, exports nommés, importé depuis `js/app.js`, puis `npm run stamp` ; **ne jamais éditer `sw.js` ni `js/version.js` à la main**.
- Nouvelle route `api/` : `export default async function handler(req, res)`, POST seulement, `process.env.OPENAI_MODEL || 'gpt-5.5'`, **JSON Schema strict**, `maxDuration` dans `vercel.json` (déjà fait pour debrief, ic, rules).
- Entrées bornées avant envoi au modèle (`.slice(...)`), client OpenAI créé paresseusement (`client ??= new OpenAI()`), erreurs du SDK transformées en statut HTTP + message borné (300 caractères).
- Échec en douceur : `try { … } catch { … }` avec commentaire ou repli ; `catch {` sans paramètre par défaut ; **aucune erreur avalée sans consigne ou commentaire** dans les modules de départ/course (garde de test FIAB-07 sur app, track, startmode, wakelock, beeper).
- Clés de stockage `rade.<nom>.v<n>` ; incrémenter le suffixe si la forme persistée change.
- **Jamais** de secret, de code d'accès, d'empreinte dans le dépôt, les journaux, les tests, la documentation ni les rapports.
- Règle d'exploitation : aucune mise en production dans les 48 h avant une régate ni pendant une course, sauf correctif critique hors de l'eau ; `npm run release -- "note"` pour une version, `npm run stamp` après tout changement de l'app.
- Travail via un point d'entrée GSD (`/gsd-execute-phase`), pas d'édition directe hors flux.
- Ne pas pousser, ne pas toucher `main` (consigne de l'orchestrateur pour cette session) ; branche de travail `apercu-phase-05`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rattrapage des anciennes traces (choix de la régate, référence, nouvel identifiant) | Navigateur / client (`js/reprise.js` + `js/app.js`) | — | Les traces ne vivent que dans l'IndexedDB du téléphone ; le serveur ne peut ni les lister ni savoir ce que chaque téléphone a gardé. |
| Partage des traces rattachées | Navigateur (`js/archheavy.js`, existant) | API `api/archive.js` + Blob | Inchangé : le téléphone envoie, le serveur écrit un objet immuable. |
| Verrou « rien pendant une course » | Navigateur (`js/racelock.js` via `raceActive`/`raceLock` de `js/app.js`) | — | Le serveur ignore l'état de course ; la règle est appliquée côté téléphone avant tout travail. |
| `store:false` | API / fonction Vercel (`api/_ia.js`) | — | Paramètre de l'appel serveur vers OpenAI ; le navigateur n'appelle jamais OpenAI. |
| Quota de 30 appels par équipier et par jour | API / fonction Vercel | Blob privé (stockage du compteur) | Identité fiable seulement côté serveur (`x-rt-membre` posé par le middleware) ; le client ne doit pas pouvoir tricher. |
| Plafond de dépense mensuel | OpenAI (tableau de bord du projet) | — | Seul endroit qui connaît la dépense réelle ; geste de Romain. |
| Messages « limite atteinte » | API (texte et code) → navigateur (affichage) | — | Le serveur est la seule source du texte ; les quatre clients l'affichent sans le réécrire. |
| Repli sans IA | Navigateur (`parseWind` local, rédaction automatique du débrief, relecture d'IC manuelle) | — | Déjà en place : un refus de l'API ne bloque aucune autre fonction. |

## Standard Stack

### Core
Aucun nouveau paquet. Tout se fait avec l'existant :

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | installée **7.39.0** (`package.json` : `^7.36.0`) | `client.responses.create(…, store:false)` ; `OpenAI.APIError` porte `status`, `code`, `type` | Déjà utilisée par les quatre fonctions. [VERIFIED: `node_modules/openai/package.json` ligne `"version": "7.39.0"`] |
| `@vercel/blob` | **2.8.0** (exact) | `get`/`put` privés avec `ifMatch`, `useCache:false`, `abortSignal` | Déjà utilisée par `api/archive.js`. [VERIFIED: `node_modules/@vercel/blob/package.json` `"version": "2.8.0"`] |
| `node:test` + `node:assert` | Node 22 local / 24.x Vercel | Tests unitaires | Déjà la porte du dépôt (`npm test`, 472 tests verts). |
| `tests/helpers/fakeblob.mjs` | dépôt | Faux Blob au contrat du SDK, `ops` compte les appels, `failNext` programme les pannes | À réutiliser tel quel pour le compteur. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tools/regate-e2e.mjs` + Playwright 1.56.1 | module trouvé dans `/opt/node-tools/node_modules/playwright` ; **Chromium présent dans /opt/pw-browsers (trouvé par tools/pw.mjs ; `PW_REQUIRED=1 node tools/regate-e2e.mjs gel` vert le 2026-10-20)** | Scénarios de bout en bout (nouveau scénario `reprise`, extension de `ia-erreurs`) | Mesure exigée par `PW_REQUIRED=1` ; si Chromium manque dans l'environnement d'exécution, c'est un échec de sortie 2, pas une mesure sautée. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Compteur dans le Blob (D-06, verrouillé) | KV/Edge Config/base du Marketplace Vercel | Plus adapté à un compteur, mais hors décision de Romain et nouvelle dépendance ; non retenu. |
| Un blob par équipier et par jour | Un blob par jour pour les trois | Un seul fichier = trois équipiers qui se disputent le même `ifMatch` ; un fichier par équipier supprime la contention entre équipiers. |

**Installation :** aucune (`npm ci` inchangé).

**Version verification :** `openai` et `@vercel/blob` lues dans `node_modules` cette session (ci-dessus). Pas de nouvelle dépendance à vérifier.

## Package Legitimacy Audit

Aucun paquet externe n'est ajouté par cette phase : `openai` 7.39.0 et `@vercel/blob` 2.8.0 sont déjà dans `package.json`/`package-lock.json` et utilisés en production depuis les phases 3 et 4. Audit sans objet.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 A. RATTRAPAGE DES TRACES (téléphone, une seule fois)

 lancement v32 ──► carte prête (rt:map) ──► drapeau rade.reprise.v1 ?
                                              │ déjà « fait » ─► fin
                                              ▼ absent
                 raceActive() ou raceLock().locked ? ──oui──► fin, drapeau NON posé (rejoué au lancement suivant)
                                              │ non
                                              ▼
              listTracks()  ──► pour chaque trace (une à la fois, 600 Ko) :
                 │   déjà dans une régate (regOfTrace) ─────────────► « déjà rangée »
                 │   GPX d'ancien identifiant aléatoire ──► nouvel id canonique (put + delete)
                 │   matchRegattas(pts, REG.list, breaksOf(tr))
                 │      unique | heure ─► attachTrace + setTraceReport ─► saveReg ─► « rangée »
                 │      choix | proche | aucune ───────────────────────► « laissée » (journal, jamais de question)
                 │   verrou/course apparu ? ─► arrêt, drapeau non posé
                 ▼
          drapeau posé { done, at, n… } + note('reprise', résumé) + toast court
                 │
 saveReg (non fromSync) ─► markDirty ─► scheduleSync(20 s) ─► archsync.runSync (léger) ─► runHeavyNow
                                                               └─► heavyPlan : trace locale référencée,
                                                                   pas encore « up » ─► PUT ?k=trace (+ report)

 B. IA BORNÉE (fonction Vercel)

 navigateur ──POST /api/{voice|debrief|rules|ic}──► middleware (code d'accès → x-rt-membre, cookie retiré)
                                                       │
                                  validation d'entrée (400 sans compter)
                                                       │
                                  api/_ia.js  garde :  membre valide ? sinon 403
                                     lire  quota/<jour de Paris>/<prénom>.json  (Blob, get simple)
                                       n ≥ 30 ──► 429 { error:'quota_equipier', message } (aucune écriture)
                                       sinon écrire n+1 avec ifMatch (put avancé) ; conflit → 1 relecture
                                       Blob illisible / sans jeton / délai 2 s ──► LAISSER PASSER + console.warn
                                                       │
                                  api/_ia.js  appelle :  client.responses.create({ …params, store:false })
                                                       │
                                  erreur OpenAI ──► erreurIA(err) :
                                     429 + code de dépense/quota ─► 429 { error:'budget_ia', message }
                                     autre 429 ─► 429 { error:'ia_occupee', message }
                                     401/403 ─► 502 ; autre ─► statut borné + message ≤ 300 car.
                                                       │
 navigateur : 200 → usage normal ; 429/… → repli local (dictée : analyse locale ; débrief : rédaction automatique ;
              IC : relecture à la main ; arbitre : message dans la bulle) + message du serveur affiché
```

### Recommended Project Structure
```
js/
├── reprise.js            # NOUVEAU : rattrapage des traces (pur, dépendances injectées), en-tête français
├── attach.js             # + canonicalTraceId(tr) (pur) à côté de sameTrack
└── app.js                # câblage : appel après la carte, reprise au retour du verrou, toast 429 de la dictée
api/
├── _ia.js                # NOUVEAU (préfixe _ = pas une route) : store:false, quota, erreurs ; ni js/ ni archive.js importés
├── voice.js debrief.js rules.js   # passent à createHandler({ openai, blob, now }) + garde + appelle + erreurIA
└── ic.js                 # idem (déjà createHandler)
regles.html               # message de l'arbitre : affiche le message du serveur sur 429
js/debrief.js js/icread.js # note de repli / iaErrorMessage : cas 429
tests/
├── reprise.test.mjs      # NOUVEAU
├── apiia.test.mjs        # NOUVEAU (store:false ×4, quota, erreurs, pannes, jour de Paris)
└── (apiic, icread, attach) # compléments
tools/regate-e2e.mjs      # + scénario `reprise`, + cas 429 dans `ia-erreurs`
docs/ia-budget.md         # NOUVEAU : geste guidé de Romain (plafond OpenAI), et ce que `store:false` garantit
```

### Pattern 1 : rattrapage = boucle pure avec dépendances injectées
**What:** `runReprise(d)` ne connaît ni le DOM ni IndexedDB : tout est dans `d` (comme `runHeavy(d)` de `js/archheavy.js`). `js/app.js` fournit `listTracks, getTrack, saveTrack, deleteTrack, rangeTrace, getList, isActive, isLocked, now, note, report`.
**When to use:** toujours ; `js/app.js` (1 900+ lignes) n'est pas testable, `js/archheavy.js` l'est précisément pour cette raison.
**Example :**
```js
// Source: modèle js/archheavy.js (runHeavy) et js/app.js:1533-1542 (rangeTrace) lus dans cette session
export async function runReprise(d) {
  const halt = () => (d.isActive() ? 'course' : d.isLocked() ? 'journee' : null);
  let why = halt(); if (why) return { skipped: why };
  const out = { rangees: 0, deja: 0, laissees: [], renommees: 0 };
  let liste; try { liste = await d.listTracks(); } catch (e) { d.report('reprise', e); return { error: 'base_traces' }; }
  for (const t of liste) {
    if ((why = halt())) return { ...out, skipped: why };              // entre deux traces : jamais de travail pendant une course
    try {
      let tr = await d.getTrack(t.id); if (!tr || !(tr.pts?.length > 1)) continue;
      if (d.regOfTrace(tr.id)) { out.deja++; continue; }
      const m = d.match(tr);                                           // matchRegattas(tr.pts, list, breaksOf(tr))
      if (m.how !== 'unique' && m.how !== 'heure') { out.laissees.push(m.how); continue; }   // jamais d'invite, jamais « proche »
      tr = await d.canonical(tr);                                      // ancien identifiant aléatoire → identifiant canonique
      d.attach(m.candidates[0], tr);                                   // attachTrace + setTraceReport + saveReg
      out.rangees++;
    } catch (e) { d.report('reprise', e); out.error = 'trace'; }       // une trace illisible n'arrête pas les autres
  }
  return out;
}
```

### Pattern 2 : aide serveur commune qui rend `store:false` impossible à oublier
**What:** les quatre fonctions n'appellent plus `client.responses.create` directement mais `appelle(client, params)`, qui pose `store:false` en dernier (non écrasable). Un test statique interdit `responses.create(` partout sauf dans `api/_ia.js`.
**Example :**
```js
// api/_ia.js — Source: types du SDK node_modules/openai/resources/responses/responses.d.ts:9537 (store?: boolean | null)
export const appelle = (client, params) => client.responses.create({ ...params, store: false });
```

### Pattern 3 : compteur = un blob par équipier et par jour de Paris, lecture puis écriture `ifMatch`
Prototype exécuté dans cette session sur `tests/helpers/fakeblob.mjs` : 31 appels d'un équipier → 31 `get`, **30 `put`**, 0 `head`, 0 `list` ; le 31e est refusé sans écriture ; deux appels simultanés du même équipier → l'un perd la course `ifMatch`, relit, et le compteur finit à 2 (pas de perte).
```js
// api/_ia.js — Source: api/archive.js (readLight/mutateLight, lignes lues) ; abortSignal : @vercel/blob dist/index.d.ts lignes 224, 409
const jour = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(ms);   // « 2026-11-07 », DST géré
export async function compte({ B, P, who, now, max = 30 }) {
  const path = `${P}/quota/${jour(now())}/${slug(who)}.json`;
  for (let essai = 0; essai < 2; essai++) {
    const r = await B.get(path, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(2000) });
    const n = r && r.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()).n : 0, etag = r?.blob?.etag ?? null;
    if (n >= max) return { ok: false, n };
    try {
      const o = { access: 'private', contentType: 'application/json', abortSignal: AbortSignal.timeout(2000) };
      await B.put(path, JSON.stringify({ n: n + 1 }), etag ? { ...o, allowOverwrite: true, ifMatch: etag } : o);
      return { ok: true, n: n + 1 };
    } catch (e) { if (essai === 1) throw e; }                          // perdu contre un appel simultané : on relit une fois
  }
}
```
(`garde()` enveloppe ce code dans un `try/catch` global : toute exception, y compris un délai, devient « laisser passer + `console.warn`».)

### Anti-Patterns to Avoid
- **Demander au client « combien en as-tu fait » ou lire le prénom ailleurs que dans `x-rt-membre`.** Le middleware remplace l'en-tête du navigateur pour tout `/api/` [VERIFIED: `middleware.js:63-66`]. Un test doit prouver qu'un corps `{ membre: 'Romain' }` ou un en-tête usurpé ne change pas le compteur utilisé.
- **Ouvrir une invite au lancement.** Le rattrapage n'appelle jamais `askPlace`.
- **Importer `js/` depuis `api/_ia.js`** (ou `api/archive.js`) : ferait réapparaître le piège 15 de la phase 4 (`includeFiles`) sur quatre fonctions de plus.
- **Compter après l'appel OpenAI.** Une panne d'OpenAI après coup ne doit pas permettre de contourner le quota ; on réserve avant (le coût d'un appel raté est une unité sur 30).
- **Rejouer le rattrapage à chaque lancement.** Il rattacherait de nouveau une trace que l'équipier a volontairement détachée.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Choisir la régate d'une trace | Une nouvelle règle de date | `matchRegattas`, `rangeTrace(tr, { invite: false })` | Mêmes règles que l'import GPX (jour de Paris du plus long segment, heure du signal) ; déjà testées (`tests/attach.test.mjs`). |
| Éviter les doublons locaux | Comparaison maison | `sameTrack(list, tr)` (début + nombre de points) | Règle déjà utilisée par l'import. |
| Envoyer les traces rattachées | Une file d'envoi propre au rattrapage | `heavyPlan`/`runHeavy` existants | Plafonds (20/jour), verrou, reprise après panne, `meta.up` : tout est déjà là. |
| Verrou de course | Une nouvelle horloge | `raceActive(now)` / `raceLock().locked` de `js/app.js` | C'est la règle D-03 de la phase 4. |
| Optimisme concurrent sur le compteur | Verrou maison | `ifMatch` + une relecture (modèle `mutateLight`) | Contrat du SDK, prouvé par le faux Blob. |
| Jour de Paris côté serveur | Calcul de fuseau à la main | `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })` | Gère l'heure d'été (vérifié : 25/10 22:30Z → 25/10, 23:30Z → 26/10 ; 31/10 21:59Z et 22:30Z → 31/10). |
| Faux client OpenAI | Mock complexe | `{ responses: { create } }` mémorisant ses arguments (déjà dans `tests/apiic.test.mjs`) | Suffit pour exiger `store:false`. |

**Key insight :** tout le coût de cette phase est dans les cas limites (anciens identifiants, verrou, pannes du compteur), pas dans la mécanique : ne rien inventer là où une fonction pure existe.

## Runtime State Inventory

Phase de reprise de données (migration d'état local vers l'archive). Chaque catégorie est répondue explicitement.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | IndexedDB `rade-traces` / magasin `tracks` (`keyPath: 'id'`) : enregistrements `{ id, name, start, course, pts, brk?, imported?, report? }` ; localStorage `rade.regates.v1` (index des régates, `traces: []` par régate) ; `rade.sync.v1` (méta de synchronisation, `up`/`down`/`hq`/`dirty`) ; IndexedDB `rade-regates` (jours figés, déjà gérés par la phase 4) ; Blob `prod/…` et `preview/…` (jamais énumérés) | **Migration de données** : poser les références dans `rade.regates.v1` (via `saveReg`, qui marque « sale ») ; renommer l'identifiant des anciens imports GPX dans `rade-traces` (put nouvel id + delete ancien). Aucun changement de forme de `rade.regates.v1` (donc pas de nouvelle version de clé). |
| Live service config | Aucune configuration d'interface hors dépôt pour le rattrapage. Pour l'IA : le **plafond de dépense du projet OpenAI** vit dans le tableau de bord OpenAI (pas dans git) ; la variable `OPENAI_API_KEY` de Vercel est liée à *un* projet OpenAI (à confirmer, voir Open Questions) | Geste de Romain (plan 05-03) ; aucun changement de variables Vercel. |
| OS-registered state | None — vérifié : rien n'est enregistré dans le système (pas de tâche planifiée, pas de service) ; le service worker `sw.js` met en cache `SHELL` (régénéré par `npm run stamp`) | Aucune ; lancer `npm run stamp`/`release` pour que `js/reprise.js` entre dans `SHELL`. |
| Secrets/env vars | `OPENAI_API_KEY`, `OPENAI_MODEL`, `BLOB_READ_WRITE_TOKEN` (ou `BLOB_STORE_ID` + OIDC), `VERCEL_ENV` : noms inchangés ; `tests/helpers/setup.mjs` les supprime pour les tests | Aucun renommage. Aucun nouveau secret. Ne jamais les écrire dans les tests ni la doc. |
| Build artifacts / installed packages | `sw.js` (bloc `stamp`) et `js/version.js` générés ; `package-lock.json` inchangé | `npm run release -- "note"` en dernier (le hachage couvre `js/`, `index.html`, `styles.css`, `regles.html`, `guide.html`, etc. ; **pas `api/`**) ; `VERCEL_ENV=production npm run gate` pour prouver la porte. |

**Nothing found in category :** « OS-registered state » : aucun, voir ci-dessus.

## Common Pitfalls

### Pitfall 1 : doublons de traces entre téléphones (anciens identifiants aléatoires)
**What goes wrong:** deux téléphones ont importé le même GPX avant la v31 ; ils ont des identifiants différents (`'tr' + début + Math.round(Math.random() * 1000)`), le rattrapage pose deux références dans la Coupe SNPM et envoie deux fois 613 Ko ; la fiche montre deux traces.
**Why it happens:** l'identifiant déterministe n'existe que depuis la v31 (commit `d79fbbf`). [VERIFIED: `git show f2f8994:js/track.js` ligne 137 (v28) et les v29/v30 : `id: 'tr' + pts[0][0] + Math.round(Math.random() * 1000)` ; `js/track.js:151` actuel : `id: 'tr' + pts[0][0] + '-' + pts.length`.] Les traces enregistrées dans l'app (`'tr' + now`, `js/track.js:48`) sont uniques par téléphone et n'ont pas ce problème.
**How to avoid:** pour une trace `imported: true` dont l'identifiant n'est pas `'tr' + start + '-' + n`, créer l'enregistrement sous l'identifiant canonique (`saveTrack({ ...tr, id: canon })`, sauf s'il existe déjà : alors supprimer seulement l'ancien), *puis* supprimer l'ancien (`deleteTrack`). Idempotent si interrompu entre les deux : au tour suivant, l'ancien est supprimé parce que le canonique existe. En plus, **ne pas rattacher** si la régate cible a déjà une référence de même `start` et même `n` (cas d'un téléphone v31 qui avait déjà rangé et envoyé la sienne sous un identifiant aléatoire).
**Warning signs:** deux lignes « Coupe SNPM … » avec la même heure dans la fiche ; deux objets `trace/` de même taille dans le Blob.
**Limite connue :** l'égalité des identifiants suppose que deux téléphones relisent le même fichier avec le même nombre de points ([ASSUMED] : le filtre de points de `fromGPX` n'a pas changé entre les versions).

### Pitfall 2 : le rapport du débrief reste invisible pour les autres
**What goes wrong:** une trace ancienne a un rapport local (`tr.report`, `{ html, t, name }`), mais sa référence dans la régate n'a pas `report: { t, by }` ; les autres téléphones ne téléchargent un rapport que si `ref.report.t` est fini (`heavyPlan`, lignes `const t = ref.report?.t`) et la fiche écrit « pas encore débriefée ».
**Why it happens:** la phase 3 pose le rapport sur la référence « à l'ouverture de la trace et à la fin du débrief » ; un rattrapage ne passe par aucun des deux.
**How to avoid:** après `attachTrace`, appeler `setTraceReport(r, tr.id, { t: tr.report.t, by: who() })` quand `tr.report?.t` existe (le débrief a été fait sur ce téléphone). Le résumé (`sum`) n'est **pas** nécessaire : la fiche affiche « analyse pas encore faite : ouvrez la trace » jusqu'à la première ouverture [VERIFIED: `js/regview.js:136-141`]. L'envoyer demanderait l'analyse complète (vent, polaire) : à ne pas faire au lancement.

### Pitfall 3 : ranger ce que l'équipier avait écarté
**What goes wrong:** une trace laissée « sans régate » par choix, ou détachée depuis la fiche, est rattachée de force puis partagée.
**Why it happens:** aucun marqueur ne distingue « jamais rangée » de « écartée volontairement » (le détachement supprime simplement la référence).
**How to avoid:** accepter le risque (D-01 le décide : « chaque trace locale ») mais le rendre visible et réversible : une ligne de journal par trace rangée, un toast unique « N traces rangées dans l'archive », et « Détacher » reste disponible depuis la fiche. Ne **jamais** rejouer le rattrapage une fois le drapeau posé.

### Pitfall 4 : le rattrapage interrompu ou lancé au mauvais moment
**What goes wrong:** premier lancement de la v32 un jour de régate après 9 h (verrou `journee`), ou une course démarre pendant la boucle.
**How to avoid:** même garde que `runHeavy` (`isActive` puis `isLocked`, contrôlé avant et entre deux traces) ; drapeau non posé en cas d'arrêt ; **en plus** rappeler la fonction à la transition `wasLocked && !locked` de `raceTick` (`js/app.js:794`, une ligne) pour ne pas attendre un prochain lancement si l'équipier ne ferme jamais l'app. Un téléphone neuf (aucune trace) pose le drapeau tout de suite sans rien lire d'autre que `listTracks()` (ouverture < 2 s préservée, FIAB-06).
**Piège voisin :** les mises à jour de l'app ne s'appliquent que sur geste de l'équipier hors course (`js/swupdate.js`) : le « premier lancement de la v32 » arrive à des dates différentes selon les trois téléphones. Publier tôt (vers le 30 octobre au plus tard) laisse le temps.

### Pitfall 5 : le compteur épuise le Blob Hobby de l'archive
**What goes wrong:** chaque appel d'IA coûte une opération *avancée* (écriture). Le Hobby n'en offre que **2 000 par mois pour tout le magasin** ; au-delà, « you will not be able to access Vercel Blob … wait until 30 days have passed » [CITED: vercel.com/docs/vercel-blob/usage-and-pricing, mise à jour du 2026-09-23] : l'archive entière s'arrête, pas seulement le compteur.
**Why it happens:** la phase 4 a estimé l'archive à ≈ 650 écritures avancées par mois [ASSUMED dans 04-RESEARCH]. Le plafond de 30 appels/jour borne à 90 écritures/jour pour trois équipiers, soit 2 700 par mois *si* chacun épuisait son quota tous les jours.
**How to avoid:** (1) le compteur est **ouvert** en cas de panne (D-06) : un Blob bloqué ne bloque ni l'IA ni l'app (qui est locale d'abord) ; (2) aucune écriture quand le quota est atteint ni quand le compteur est déjà à jour ; (3) un blob par équipier et par jour (pas de réécritures de conflit entre équipiers) ; (4) relever *Observability › Blob* après le week-end du 7-9 novembre (voir contrôles humains) ; (5) si le plan de Romain est Pro, le risque disparaît (paiement à l'usage) — à confirmer.
**Estimation (voir tableau plus bas) :** usage réaliste ≈ 100 à 400 écritures avancées par mois pour l'IA ; ≈ 1 000 au total avec l'archive et le rattrapage : sous les 2 000, mais la marge n'est pas énorme.

### Pitfall 6 : `store:false` n'est pas « OpenAI ne garde rien »
**What goes wrong:** le texte de l'app ou de la doc promet « aucune donnée conservée ».
**Why it happens:** la documentation officielle dit : les journaux de surveillance des abus sont « retained for up to 30 days, unless longer retention is required by law », et seul un contrat « Zero Data Retention » (ou « Modified Abuse Monitoring ») les exclut [CITED: developers.openai.com/api/docs/guides/your-data]. `store:false` supprime le *stockage d'état d'application* (réponse relisible par l'API pendant 30 jours), pas la surveillance des abus.
**How to avoid:** formuler « les réponses ne sont pas stockées chez OpenAI (`store: false`) ; OpenAI peut garder les requêtes jusqu'à 30 jours pour la surveillance des abus ». Dans `docs/ia-budget.md` et, si on l'écrit, dans le guide de l'équipage. Ne pas cocher « ne conserve rien » comme vérifié.

### Pitfall 7 : les erreurs OpenAI passent telles quelles et en anglais
**What goes wrong:** aujourd'hui `voice`/`rules`/`debrief` renvoient `err.status` (429, 401…) avec le message anglais d'OpenAI (≤ 200/300 caractères) [VERIFIED: lecture des trois fichiers] ; `api/ic.js` ramène 401/403 à 502 mais laisse passer 429. `voice` et `debrief` n'affichent rien, `regles.html` écrit « L’arbitre n’a pas pu répondre. Réessayez dans un instant. » pour tout, `iaErrorMessage` (js/icread.js) répond « La lecture par l’IA a échoué (code 429) ».
**How to avoid:** `erreurIA(err)` unique côté serveur ; 429 distingués par `err.code` ; 401/403 → 502 pour toutes (le client lit 401 comme « rouvrez l'app avec votre code »).

### Pitfall 8 : tests dépendants de l'environnement
**What goes wrong:** `tests/helpers/setup.mjs` supprime `VERCEL_ENV`, `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `VERCEL_OIDC_TOKEN`, `OPENAI_API_KEY`, `OPENAI_MODEL` [VERIFIED: `tests/helpers/setup.mjs` ligne 8]. Un test du quota qui compterait sur ces variables échouerait à la porte de production (leçon v31).
**How to avoid:** injecter `{ blob, now, openai }` dans `createHandler` ; poser/retirer `OPENAI_API_KEY` et `VERCEL_ENV` *dans* le test avec restauration (modèle `avecEnv` de `tests/apiarchive.test.mjs`). Sans blob injecté **et** sans jeton Blob, `garde` laisse passer sans rien importer ni appeler (pas de réseau, pas de bruit) : les tests existants d'`api/ic.js` restent verts sans changement.

### Pitfall 9 : `api/_ia.js` et le traçage des fichiers par Vercel
**What goes wrong:** un fichier de `api/` importé par une fonction doit être embarqué avec elle. Les noms commençant par `_` ne deviennent pas des fonctions [CITED: vercel.com/docs/functions/configuring-functions/advanced-configuration : « Files that start with an underscore »]. Précédent dans le dépôt : `api/rules.js` importe `./_rrs.js` sans `includeFiles` dans `vercel.json` [VERIFIED: `vercel.json` ne contient `includeFiles` que pour `api/archive.js`]. Que `_rrs.js` fonctionne en production est [ASSUMED] (non vérifié ici).
**How to avoid:** garder `api/_ia.js` autonome (aucun import de `js/` ni de `api/archive.js`) ; import dynamique `await import('@vercel/blob')` seulement quand un compteur est nécessaire ; vérifier sur l'aperçu qu'une dictée répond 200 (pas 500). Aucune modification de `vercel.json` n'est nécessaire.

### Pitfall 10 : dupliquer `prefix()` et `membre()` sans filet
`api/archive.js` exporte `prefix` mais importer ce fichier tire `js/archmerge.js`. On **duplique** deux petites fonctions (`prefix`, décodage du prénom) dans `api/_ia.js` et on ajoute un test qui compare les deux implémentations sur un tableau d'entrées (production/aperçu/absent ; prénoms valides, accents, `%61pi`, chaîne vide, 41 caractères).

## Code Examples

### Câblage du rattrapage dans `js/app.js` (forme proposée)
```js
// Source: structure de js/app.js lue aux lignes 163-175 (init), 776-795 (raceActive/raceLock/raceTick), 1533-1542 (rangeTrace)
const REPRISE_KEY = 'rade.reprise.v1';           // { done: true, at, rangees, laissees } — posé seulement quand toute la boucle est allée au bout
let repriseBusy = false;
async function reprise() {
  if (repriseBusy || store.get(REPRISE_KEY, null)?.done) return;
  repriseBusy = true;
  try {
    const mod = await import('./reprise.js');
    const res = await mod.runReprise({ listTracks, getTrack, saveTrack, deleteTrack, /* … voir Pattern 1 */ isActive: () => raceActive(Date.now()), isLocked: () => raceLock().locked, now: Date.now, note, report });
    note('reprise', res.skipped ? 'reportée : ' + res.skipped : `${res.rangees} rangée(s), ${res.laissees.length} laissée(s)`);
    if (!res.skipped && !res.error) store.set(REPRISE_KEY, { done: true, at: Date.now(), rangees: res.rangees, laissees: res.laissees.length });
    if (res.rangees) toast(`${res.rangees} trace${res.rangees > 1 ? 's' : ''} rangée${res.rangees > 1 ? 's' : ''} dans l’archive`);
  } catch (e) { report('reprise', e); } finally { repriseBusy = false; }
}
// à la fin de init(), après mapOk() : setTimeout(reprise, 1500)  (avant la synchronisation d'ouverture à +3 s)
// dans raceTick : if (wasLocked && !locked) { …; reprise(); }
```

### Ce que chaque client affiche (message unique venu du serveur)
```js
// Source: js/app.js:303-333 (understand), regles.html:707-712, js/icread.js:235-243 — lus ; modifications proposées
// dictée : if (r.status === 429) { const j = await r.json().catch(() => null); if (j?.message) toast(j.message); }  // puis repli parseWind inchangé
// arbitre : if (!r.ok) throw new Error(r.status === 429 && a.message ? a.message : /* texte actuel */ …)
// IC      : iaErrorMessage({ status, code, message }) → if (status === 429 && message) return message
// débrief : narrative() garde j.message du 429 dans { ai:false, iaNote } ; runDebrief le montre par toast()
```

### Textes français proposés (source unique : `api/_ia.js`)
| Code `error` | HTTP | Message |
|---|---|---|
| `quota_equipier` | 429 | `Limite d’IA du jour atteinte — reprise demain` |
| `budget_ia` | 429 | `Budget d’IA du mois atteint — l’IA reprend le mois prochain` |
| `ia_occupee` | 429 | `L’IA est très sollicitée — réessayez dans un instant` |
| `membre_inconnu` | 403 | (comme `api/archive.js` : `{ error: 'membre_inconnu' }`) |

## OpenAI : plafond de dépense (réponses aux questions B1-B2)

**`store`.** [VERIFIED: `node_modules/openai/resources/responses/responses.d.ts:9529-9537`] : « Whether to store the generated model response for later retrieval via API. Defaults to true when omitted. If set to true, response data will be stored for at least 30 days… » `store?: boolean | null;`. Les quatre fonctions ne l'envoient pas aujourd'hui : **elles stockent**. Aucune n'utilise `previous_response_id`, `background`, ni `include: ['reasoning.encrypted_content']` [VERIFIED: lecture complète de `api/voice.js`, `api/debrief.js`, `api/rules.js` ; `api/ic.js` lignes 125-150] ; l'historique de l'arbitre est renvoyé comme messages ordinaires (`input: [...history, …]`). Que `store:false` fonctionne avec `reasoning: { effort }` + `json_schema` strict sur `gpt-5.5` est [ASSUMED] (la doc ne traite pas les éléments de raisonnement) : **un appel réel par fonction sur l'aperçu** est au programme de vérification.

**Plafond.** [CITED: developers.openai.com/api/docs/guides/spend-limits] « To set a project cap: Project settings → Limits → Spend → Edit spend limit → Monthly spend limit → turn on **Enforce a hard limit** → Save. » « Reaching a project hard limit returns a `429` error with the `project_spend_limit_exceeded` code. » « Enforcement is not instantaneous, so recorded spend can slightly exceed the configured amount. » « Spend alerts do not enforce a cap. » Sans l'interrupteur : alertes seulement, trafic non coupé. Une limite d'organisation existe aussi (même parcours depuis « Organization limits ») et chacune des deux peut déclencher le 429. [CITED: fil communautaire community.openai.com/t/project-limits-not-being-respected/1300634] : en juin 2025 un utilisateur rapportait que le support avait dit « notification only » ; un message de **OpenAI_Support daté du 7 septembre 2026** dit que les limites strictes de projet sont de nouveau prises en charge (« can allow a small overage while updates propagate »). Conclusion : **bloquante si l'interrupteur est activé** (confiance MEDIUM : l'historique est contradictoire, d'où un contrôle humain facultatif ci-dessous).

**Erreur renvoyée.** `OpenAI.APIError` expose `status`, `code`, `type` [VERIFIED: `node_modules/openai/core/error.d.ts`, lignes `readonly status`, `readonly code: string | null | undefined`, `readonly type`]. Plafond projet atteint : `status 429`, `code 'project_spend_limit_exceeded'` [CITED, ci-dessus]. Crédit épuisé : `code 'insufficient_quota'` [ASSUMED : code historique de l'API, non relu cette session] ; limite d'organisation : `organization_spend_limit_exceeded` [CITED indirectement : présent dans les types du SDK `resources/beta/agents/agents.d.ts:4020`, qui listent aussi `credit_balance_exhausted`, mais comme codes d'erreur de session d'agent, pas comme code HTTP de `responses.create`]. Règle recommandée : `status === 429` et `code` dans `{ project_spend_limit_exceeded, organization_spend_limit_exceeded, insufficient_quota, credit_balance_exhausted, billing_not_active }` → `budget_ia` ; tout autre 429 → `ia_occupee`.

**L'app reste utilisable sans l'IA** [VERIFIED par lecture] : la dictée retombe sur `parseWind` (n'importe quelle réponse non `ok` passe au `for … parseWind` de `understand`) ; la rédaction du débrief retombe sur le texte automatique (`narrative`, branche « repli ») ; l'arbitre affiche une bulle d'erreur sans bloquer la page ; « Lire avec l’IA » laisse la relecture à la main intacte et validable (scénario `ia-erreurs`). Ni le chrono, ni le briefing, ni l'archive ne dépendent de l'IA.

## Geste guidé pour Romain : plafond de 10 $ par mois (D-07)

Texte à reprendre tel quel dans `docs/ia-budget.md` (et à lire à Romain pendant le contrôle humain). Libellés relevés dans la documentation officielle du 2026 ; si l'écran diffère, c'est l'écran qui fait foi.
1. Ouvrir **platform.openai.com** et se connecter. En haut à gauche, choisir **le projet dont la clé est dans Vercel** (variable `OPENAI_API_KEY` du projet Vercel). Si le doute existe : *API keys* → repérer la colonne « Project » de la clé utilisée (une ancienne clé « utilisateur » dépend du projet par défaut).
2. **Project settings → Limits**.
3. Dans **Spend**, cliquer **Edit spend limit**.
4. **Monthly spend limit : 10** (dollars).
5. Activer **Enforce a hard limit** (sans cet interrupteur, la limite n'envoie que des alertes et ne coupe rien).
6. **Save**. Facultatif : régler aussi une alerte à 5 $ pour être prévenu avant la coupure.
7. Vérifier que l'écran *Limits* affiche bien 10 $ avec la limite stricte activée. Prévenir Romain que l'application peut dépasser un peu (non instantané) et que, à la coupure, l'app affiche « Budget d’IA du mois atteint » : pour reprendre avant le mois suivant, relever ou retirer la limite au même endroit.
8. *(Facultatif, preuve de coupure)* : avec la dépense du mois déjà supérieure à 0,01 $, mettre la limite stricte à 0,01 $, faire une dictée sur l'aperçu (attendre 1-2 minutes si rien ne se passe), constater le message de budget, puis **remettre 10 $**. À ne faire que hors période de régate.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Limite de budget OpenAI = alerte seulement (retours de juin 2025) | « Enforce a hard limit » renvoie 429 `project_spend_limit_exceeded` | Message officiel du 7 septembre 2026 | Le plafond de D-07 est réalisable côté OpenAI ; poser aussi une alerte. |
| Appels Responses stockés 30 jours par défaut | `store:false` | Paramètre disponible dans le SDK 7.39.0 | À exiger par test ; ne remplace pas la surveillance des abus de 30 jours. |
| Vercel Blob : copie CDN lue par défaut | `get(…, { useCache:false })` relit l'origine | SDK 2.8.0 | Le compteur doit relire sans cache (sinon deux appels voient la même valeur). |

**Deprecated/outdated:** aucun usage obsolète dans le périmètre ; ne pas utiliser `list()` (jamais, opération avancée).

## Opérations Blob (réponses à B3) et estimation

[CITED: vercel.com/docs/vercel-blob/usage-and-pricing, 2026-09-23] :
- **Opérations simples** : « when a blob is accessed by its URL and it's a cache MISS, or when you retrieve blob metadata without downloading the blob » (donc `get` avec `useCache:false` = origine = MISS, et `head`).
- **Opérations avancées** : « when you upload, copy, or list blobs, and when you create a Blob store » ; la suppression est gratuite ; consulter le magasin dans le tableau de bord compte aussi comme avancée.
- Hobby : **10 000 simples, 2 000 avancées** par mois ; blocage de 30 jours au dépassement ; débit 20 simples/s, 15 avancées/s (sans importance ici).
- Si le plan de Romain est Pro : paiement à l'usage ([ASSUMED] : Hobby jusqu'à confirmation).

| Source | Hypothèse (3 équipiers) | Avancées/mois | Simples/mois |
|--------|-------------------------|---------------|--------------|
| Archive phase 4 (légère + lourde) | estimation de 04-RESEARCH Pitfall 1 [ASSUMED] | ≈ 650 | ≈ 1 200 |
| Rattrapage v32 (une fois) | ≤ 15 traces par téléphone × 3 : `head` + `put` | ≤ 45 | ≤ 45 |
| IA : réaliste | 3 × 8 appels × 10 jours actifs = 240 appels | ≈ 240 | ≈ 240 |
| IA : week-end de régate | 3 × 15 dictées/questions × 3 jours = 135 appels | (inclus ci-dessus) | |
| **Total attendu** | | **≈ 900 à 1 100 (≈ 50 %)** | ≈ 1 500 (≈ 15 %) |
| IA : plafond théorique | 3 × 30 × 30 jours | 2 700 (!) | 2 700 |

Le chiffre « de l'ordre de 2 000 opérations avancées par mois » de D-06 est **le quota Hobby, pas le volume attendu** ; le volume attendu de l'IA est de 100 à 400. Rien n'est infaisable, mais le plafond théorique dépasse le quota : voir le contrôle humain « usage Blob » et l'ouverture du compteur en cas de panne. **Option de réduction, non recommandée par défaut** (complexité) : réserver les appels par lots de 5 dans la mémoire de l'instance (divise les écritures par ≈ 5 au prix d'un compte inexact si l'instance meurt) ; à n'envisager que si l'usage mesuré dépasse 40 % du quota.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Le projet Vercel de Romain est sur le plan Hobby (2 000 avancées, blocage 30 jours) | Pitfall 5, estimation | Pro : le blocage n'existe pas, le risque baisse ; le contrôle d'usage reste utile. |
| A2 | `get(…, { useCache:false })` d'un blob privé compte comme une opération *simple* | Estimation | Si avancée : le compteur coûterait 2 avancées/appel ; refaire le calcul (reste < 60 %). |
| A3 | L'estimation d'archive de 650 écritures/mois de la phase 4 est correcte | Estimation | Le total pourrait approcher 2 000 ; surveiller l'usage réel. |
| A4 | `api/rules.js` importe `./_rrs.js` en production sans `includeFiles`, donc `api/_ia.js` sera embarqué de même | Pitfall 9 | 500 sur les quatre fonctions IA : à voir à la première dictée sur l'aperçu ; repli = `includeFiles: "api/_ia.js"` dans `vercel.json`. |
| A5 | `store:false` combiné à `reasoning` + `json_schema` strict fonctionne avec `gpt-5.5` | Section OpenAI | Une des fonctions échouerait en 400 : vérifié sur l'aperçu par un appel réel de chacune. |
| A6 | Code d'erreur `insufficient_quota` pour un crédit épuisé | Section OpenAI | Cas non reconnu → classé `ia_occupee` ; message moins précis, rien ne casse. |
| A7 | Deux téléphones qui ont importé le même GPX obtiennent le même nombre de points (donc le même identifiant canonique) | Pitfall 1 | Doublon de trace restant, détachable à la main. |
| A8 | « Enforce a hard limit » coupe réellement l'API malgré les retours de la communauté de 2025-2026 | Plafond | Le plafond de 10 $ ne protège pas : le quota de 30 appels/jour reste le seul frein ; contrôle de coupure facultatif au geste 8. |
| A9 | Les 3 téléphones lancent la v32 avant le 7 novembre et hors verrou | Pitfall 4 | Rattrapage reporté ; les traces anciennes ne sont partagées qu'après (pas de perte). |

## Open Questions (RESOLVED)

1. **Les traces enregistrées dans l'app après le rattrapage resteront-elles sans régate ?**
   - What we know : l'arrêt de l'enregistrement ne fait que `toast` + `renderTracks()` (`js/app.js:1205`, `:1246`) ; seul le geste « Ranger… » (`#trPlace`) ou un import GPX les range.
   - What's unclear : si Romain veut que les futures traces enregistrées dans l'app se rangent aussi toutes seules (règle `unique`/`heure`, jamais de question). Open GPX Tracker reste la référence (FIAB2-01), donc peu urgent.
   - Recommendation : hors D-01 à D-08 ; ne pas le faire sans décision. Si oui, c'est une ligne : `rangeTrace(tr, { invite: false })` après `recorder.stop()`.
   - **RESOLVED :** oui, décision D-09 (05-CONTEXT.md), plan 05-01 tâche 3.
2. **Quel projet OpenAI porte la clé de Vercel ?** À lire dans *API keys* avant de poser la limite (le plafond ne vaut que pour ce projet). **RESOLVED :** geste guidé de `docs/ia-budget.md` et contrôle humain de 05-03, fait par Romain.
3. **Plan Vercel réel (Hobby ou Pro) et usage Blob actuel ?** Conditionne la marge de A1-A3 ; à relever dans *Vercel → Storage → rade-tactique-blob → usage* avant et après le week-end du 7-9 novembre. **RESOLVED :** contrôle humain de 05-03 (relevé par Romain) ; le compteur reste ouvert en panne.
4. **L'aperçu `apercu-phase-05` a-t-il `OPENAI_API_KEY` et le jeton Blob ?** Sans clé, les quatre fonctions répondent 503 `no_key` et les vérifications réelles de `store:false` sont impossibles ; sans jeton Blob, le compteur est ouvert (aucun test du vrai compteur). **RESOLVED :** contrôle humain de 05-03 sur l'aperçu, avant « publie ».
5. **Texte « ne conserve rien » dans le guide de l'équipage ?** Voir Pitfall 6 : à reformuler. **RESOLVED :** formule imposée « OpenAI ne garde pas les réponses » (D-05 précisée, 05-03 tâche 1).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, `stamp`, `release` | ✓ | 22.22.0 local (Vercel : 24.x via `engines`) | — |
| npm test (472 tests) | porte | ✓ | verte avant tout changement (8 s) | — |
| `VERCEL_ENV=production npm run gate` | D-08 | ✓ | verte avant tout changement | — |
| Garde SNPM `git diff --quiet f80c365 -- js/courses.js tests/reference/` | D-04 | ✓ | sortie 0 relevée cette session | — |
| Playwright (module) | scénarios e2e | ✓ | 1.56.1 dans `/opt/node-tools/node_modules/playwright` | — |
| Chromium pour Playwright | scénarios e2e | ✓ | /opt/pw-browsers/chromium (trouvé par `tools/pw.mjs`, scénario `gel` vert avec `PW_REQUIRED=1` le 2026-10-20) | — |
| OpenAI (clé) / Vercel / Blob réel | vérifications réelles | ✗ | non joignables depuis le bac à sable | Contrôles humains sur l'aperçu |
| `gh` | draft PR | non testé ici | — | Création manuelle par Romain |

**Missing dependencies with no fallback:** aucune pour le code ; Chromium et les services réels sont nécessaires pour les contrôles de bout en bout et de plateforme.
**Missing dependencies with fallback:** voir tableau.

## Validation Architecture

`workflow.nyquist_validation` est **false** dans `.planning/config.json` : section de validation formelle omise. Plan de tests utile aux plans :

| Req | Comportement | Type | Commande | Fichier |
|-----|--------------|------|----------|---------|
| ARCH2-01 | unique/heure → rangée ; choix/proche/aucune → laissée sans question ; déjà rangée → inchangée | unitaire | `node --test --import ./tests/helpers/setup.mjs tests/reprise.test.mjs` | ❌ à créer |
| ARCH2-01 | ancien identifiant aléatoire → canonique ; même trace sur deux « téléphones » → une seule référence | unitaire | idem | ❌ |
| ARCH2-01 | verrou/course avant et entre deux traces → arrêt, drapeau non posé ; relance → idempotente (aucune seconde référence) | unitaire | idem | ❌ |
| ARCH2-01 | rapport local → `report` posé sur la référence | unitaire | idem | ❌ |
| ARCH2-01 | de bout en bout : IndexedDB pré-remplie (GPX SNPM d'ancien identifiant) + index sans trace → après lancement, la Coupe SNPM porte la trace, journal « reprise » écrit, drapeau posé, un second lancement ne fait rien ; trace d'un jour sans régate reste dans « Traces » | e2e | `PW_REQUIRED=1 node tools/regate-e2e.mjs reprise` | ❌ scénario à ajouter |
| ARCH2-01 | un deuxième téléphone qui a la même trace ne la duplique pas dans le faux Blob (`ops.log` : un seul `put` de `trace/…`) | e2e | scénario `reprise` avec `mondeArchive` | ❌ |
| SECU2-01 | `store === false` sur l'argument de `responses.create` pour voice, debrief, rules, ic | unitaire | `node --test --import ./tests/helpers/setup.mjs tests/apiia.test.mjs` | ❌ |
| SECU2-01 | garde statique : aucune occurrence de `responses.create(` dans `api/*.js` hors `_ia.js` | unitaire | idem | ❌ |
| SECU2-01 | 30 appels passent, le 31e → 429 `quota_equipier` + message exact, sans appel OpenAI ni écriture Blob | unitaire (faux Blob) | idem | ❌ |
| SECU2-01 | compteurs indépendants par équipier ; prénom pris dans `x-rt-membre` (corps/requête ignorés) ; changement de jour de Paris (22:59Z/23:00Z, passage à l'heure d'hiver) ; préfixe `preview/` vs `prod/` | unitaire | idem | ❌ |
| SECU2-01 | Blob en panne (`failNext` sur get, sur put, délai) → l'appel OpenAI a lieu, `console.warn` émis (sans prénom ni clé) ; `ifMatch` perdu → une relecture ; jamais `list` | unitaire | idem | ❌ |
| SECU2-01 | erreurs OpenAI : `APIError` 429 `project_spend_limit_exceeded` → `budget_ia` ; 429 autre → `ia_occupee` ; 401/403 → 502 ; autre → statut ≥ 500 → 502, message ≤ 300 | unitaire | idem | ❌ |
| SECU2-01 | clients : `iaErrorMessage` 429 ; `regles.html` affiche le message du serveur ; la dictée et le débrief gardent leur repli | unitaire + e2e | `tests/icread.test.mjs`, scénario `ia-erreurs` étendu | ✅ fichiers / cas ❌ |
| D-04 | référence SNPM inchangée | garde | `git diff --quiet f80c365 -- js/courses.js tests/reference/` et `npm test` | ✅ |

**Sampling :** par tâche `node --test --import ./tests/helpers/setup.mjs tests/<fichier>.test.mjs` ; par vague `npm test` ; avant `release` : `VERCEL_ENV=production npm run gate` (`release` en dernier, car le hachage de `stamp --check` strict couvre `js/` et les pages, pas `api/`).

## Security Domain

`security_enforcement` est actif (niveau ASVS 1, blocage « high »).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentification | non (inchangé) | Middleware existant : code d'accès → prénom |
| V3 Gestion de session | non | Cookie du code (SECU2-02 reporté) |
| V4 Contrôle d'accès | **oui** | Identité du quota = `x-rt-membre` posé par le middleware (cookie retiré, en-tête du client écrasé) ; `_ia.js` refuse (403) sans prénom valide ; `api/_ia.js` n'est pas une route (préfixe `_`, et `tests/access.test.mjs:52` exclut déjà les fichiers `_*` de la liste testée) |
| V5 Validation des entrées | **oui** | Entrées déjà bornées (300/1 500/60 000/50 000 caractères) ; le quota se vérifie *après* la validation (400 non compté) ; chemin du compteur construit seulement avec la date de Paris et un prénom passé par `slug()`/`NAME` |
| V6 Cryptographie | non | Aucune |
| V7/V8 Journalisation et données | **oui** | `console.warn` du compteur sans prénom ni clé ni texte de l'utilisateur ; `store:false` ; pas de contenu des IC ni de la dictée dans le journal du téléphone (déjà respecté) |
| V13 API | **oui** | 429 distincts, messages bornés, `Cache-Control: no-store` conservé |

### Known Threat Patterns for ce stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Un équipier (ou un script avec son cookie) vide le budget d'IA | Denial of Service / dépense | Quota 30/jour/équipier côté serveur + plafond OpenAI 10 $/mois (deux filets) |
| Usurpation du prénom pour contourner le quota (corps, en-tête, requête) | Spoofing | Seul `x-rt-membre` du middleware ; test avec en-tête, corps et paramètre usurpés |
| Épuisement du Blob par le compteur (déni de service de l'archive) | Denial of Service | Compteur ouvert en panne, aucune écriture au-delà du quota, un fichier par équipier/jour, contrôle d'usage |
| Fuite de données chez OpenAI | Information disclosure | `store:false` ; formulation honnête (surveillance des abus 30 jours) ; entrée toujours bornée ; aucun cookie ni en-tête transmis (test existant d'`api/ic.js`) |
| Injection par un texte d'IC (invite détournée) | Tampering | Déjà traitée en phase 3 (`<ic>` = donnée, vérification mot pour mot) ; inchangé |
| Rapport ou trace d'un autre téléphone rejoué comme code | Tampering | Déjà traité en phase 4 (cadre `sandbox`, nettoyage `cleanTrace`) ; le rattrapage ne reçoit rien, il ne fait que référencer des traces locales |
| Clé OpenAI ou jeton Blob dans un test ou une doc | Information disclosure | `setup.mjs` les supprime ; tests injectent client et Blob ; la doc de Romain ne contient aucun secret |

## Livraison v32 (réponses à C)

- **Version :** `npm run release -- "note"` (`release` = `node tools/stamp.mjs --release`) incrémente `n` (31 → 32), prend la date de Paris, réécrit `sw.js` (bloc `stamp`) et `js/version.js`, enregistre le hachage dans `release.json`. La note fait **80 caractères au plus, sans `<` ni `>`** (`validateNote`), p. ex. `rattrapage des traces, IA bornée (quota, store:false)` (56 car.). `stamp --check` strict (en production ou `RT_STRICT=1`) échoue si le contenu hors `api/` a changé sans `release`. **Faire `release` en dernier**, après tous les changements de `js/`, `regles.html`, `guide.html`, `index.html`.
- **Porte :** `VERCEL_ENV=production npm run gate` (vert à l'état actuel : 472 tests). `RT_GATE_BYPASS=1` seulement en urgence (jamais pour cette phase).
- **Outils :** `PW_REQUIRED=1 node tools/regate-e2e.mjs reprise ia-erreurs` puis la suite complète (17 scénarios verts avant la phase) ; si Chromium manque, sortie 2 : le dire, ne pas sauter.
- **Branche :** travail sur `apercu-phase-05` (actuelle) ; draft PR vers `main` **sans fusion** (consigne de l'orchestrateur) ; Vercel crée l'aperçu ; la fusion/production n'a lieu que sur « publie » de Romain.
- **Calendrier :** aujourd'hui 20/10 ; v32 sur l'aperçu vers le 23-24/10 ; vérification par Romain ; production **avant le 30/10 si possible, au plus tard le 2/11** (gel) ; aucune mise en production après le 5/11 au matin ; régate CVAT 7-9/11. Les téléphones appliquent la v32 sur geste de l'équipier hors course : prévoir un rappel pour que les trois l'aient avant le 7/11 (Pitfall 4).
- **Cohérence avec `main` :** `main` est déjà en v31 (`release.json` sur `main`, fusion `78d4a1d`) ; les aperçus des phases 3-4 existent aussi ; l'aperçu de la phase 5 écrit dans `preview/` du Blob (préfixe), jamais dans `prod/`.

## Plan suggéré (granularité coarse : 3 plans)

1. **05-01 Rattrapage des traces (ARCH2-01).** `js/attach.js` (+ `canonicalTraceId`), `js/reprise.js`, câblage dans `js/app.js` (appel après la carte à +1,5 s, reprise à la levée du verrou), `tests/reprise.test.mjs`, scénario `reprise` dans `tools/regate-e2e.mjs`. Dépend de rien. Vérifier D-04.
2. **05-02 IA bornée (SECU2-01, côté code).** `api/_ia.js`, refonte des quatre fonctions en `createHandler({ openai, blob, now })`, `tests/apiia.test.mjs` (+ complément `apiic`), messages des quatre clients (dictée, débrief, `regles.html`, `iaErrorMessage`), cas 429 dans `ia-erreurs`. Touche aussi `js/app.js` (une zone différente de 05-01 : exécuter 05-01 puis 05-02, ou fusionner sans conflit logique).
3. **05-03 Livraison et geste (D-07, D-08).** `docs/ia-budget.md` (geste guidé + garanties exactes de `store:false`), éventuelle ligne du guide, `release` v32, porte en `VERCEL_ENV=production`, 17+ scénarios, draft PR, point de contrôle humain (plafond OpenAI posé par Romain, essai réel de chaque fonction sur l'aperçu, usage Blob) puis « publie ».

**Éléments de CONTEXT.md à signaler (aucun n'est infaisable) :**
- D-06 : la phrase « de l'ordre de 2 000 opérations avancées par mois » décrit le quota, pas le volume ; le volume attendu de l'IA est 100-400 par mois (voir estimation) et le plafond théorique de 2 700 dépasserait le quota Hobby : d'où le compteur ouvert en panne et le contrôle d'usage.
- D-07 : la limite est bloquante **uniquement avec « Enforce a hard limit »** ; le geste guidé l'impose.
- D-05 / SECU2-01 : « ne conserve rien » n'est pas garanti par `store:false` (surveillance des abus 30 jours).
- D-01 : « une seule fois même si deux téléphones les avaient » exige l'identifiant canonique des anciens imports (Pitfall 1), non prévu dans le CONTEXT.

## Contrôles humains (aperçu et OpenAI)

1. Romain pose la limite de 10 $ avec l'interrupteur strict (geste ci-dessus), et note le projet concerné ; facultatif : preuve de coupure (geste 8).
2. Sur l'aperçu `apercu-phase-05` avec clé : une dictée, un débrief, une question à l'arbitre, une lecture d'IC (autre club) → 200 pour chacune (confirme `store:false` + `json_schema` strict, A5, et l'embarquement de `api/_ia.js`, A4).
3. Dans *Observability › Blob* : après quelques appels, relever +1 simple +1 avancée par appel d'IA ; après le week-end du 7-9 novembre, extrapoler au mois (doit rester sous 50 % des 2 000).
4. Un téléphone qui a de vieilles traces : première ouverture de la v32 hors verrou → la trace de la Coupe SNPM du 18/10 apparaît dans la fiche « Coupe SNPM » (et chez les deux autres après leur synchronisation), une seule fois, `Journal` contient la ligne `reprise`.
5. Mode avion sur la Coupe SNPM (trace réelle de 613 Ko) : fiche, trace et débrief lisibles (acquis de la phase 4, à ne pas régresser).

## Sources

### Primary (HIGH confidence)
- Code lu cette session : `js/track.js`, `js/attach.js`, `js/racelock.js`, `js/regates.js`, `js/regstore.js`, `js/journal.js`, `js/archheavy.js`, `js/archsync.js`, `js/regview.js` (extraits), `js/app.js` (zones init, stockage, raceLock, traces, import GPX, archive, `understand`, `readWithAI`), `js/icread.js` (`iaErrorMessage`), `js/debrief.js` (`narrative`), `api/voice.js`, `api/debrief.js`, `api/rules.js`, `api/ic.js`, `api/archive.js`, `middleware.js`, `vercel.json`, `package.json`, `release.json`, `tools/stamp.mjs`, `tools/regate-e2e.mjs` (scénarios), `tools/pw.mjs`, `tests/helpers/setup.mjs`, `tests/helpers/fakeblob.mjs`, `tests/apiic.test.mjs`, `tests/access.test.mjs` (extraits), `regles.html` (script de l'arbitre).
- Types installés : `node_modules/openai/resources/responses/responses.d.ts` (`store`, `previous_response_id`, `background`), `node_modules/openai/core/error.d.ts` (`APIError.status/code/type`), `node_modules/@vercel/blob/dist/index.d.ts` (`ifMatch`, `useCache`, `abortSignal`, classes d'erreur).
- Exécutions : `npm test` (472 verts), `VERCEL_ENV=production npm run gate` (vert), `git diff --quiet f80c365 -- js/courses.js tests/reference/` (sortie 0), prototype du compteur sur le faux Blob (31 appels : 31 `get`, 30 `put` ; concurrence sans perte) et du jour de Paris (heure d'été/hiver).

### Secondary (MEDIUM confidence)
- [OpenAI — Spend limits](https://developers.openai.com/api/docs/guides/spend-limits.md) (chemin du tableau de bord, interrupteur, 429 `project_spend_limit_exceeded`, non instantané)
- [OpenAI — Your data](https://developers.openai.com/api/docs/guides/your-data) (30 jours par défaut, surveillance des abus 30 jours, ZDR, mode background)
- [Vercel Blob — tarifs et limites](https://vercel.com/docs/vercel-blob/usage-and-pricing) (opérations simples/avancées, quotas Hobby, blocage de 30 jours)
- [Vercel — Advanced configuration](https://vercel.com/docs/functions/configuring-functions/advanced-configuration) (fichiers `_` de `api/` ignorés)
- [Fil communautaire OpenAI sur les limites de projet](https://community.openai.com/t/project-limits-not-being-respected/1300634) (retours 2025-2026 et message du support du 7/9/2026)

### Tertiary (LOW confidence)
- Aucun code d'erreur `insufficient_quota` relu cette session (A6) ; estimation d'usage mensuel (A1-A3).

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — aucun ajout, versions lues dans `node_modules`.
- Architecture (rattrapage) : HIGH — chaque appel (`rangeTrace`, `saveReg`, `heavyPlan`) lu ; piège des identifiants vérifié dans l'historique git.
- Architecture (IA/quota) : MEDIUM-HIGH — mécanique prouvée sur le faux Blob ; comportement réel du Blob, des quotas et de l'embarquement des fichiers `api/` à confirmer sur l'aperçu.
- Plafond OpenAI : MEDIUM — documentation officielle claire, historique communautaire contradictoire.
- Pitfalls : HIGH pour ceux issus du code, MEDIUM pour ceux issus de la plateforme.

**Research date:** 2026-10-20
**Valid until:** 2026-11-02 (gel) ; les tableaux de bord OpenAI/Vercel évoluent vite : relire les libellés d'écran au moment du geste.
