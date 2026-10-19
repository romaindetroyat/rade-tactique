# Phase 3 : Ouvrir une régate - Research

**Researched:** 2026-10-19
**Domain:** PWA sans build (JavaScript ES modules) : modèle « régate » local, lecture des IC (motifs CVAT hors réseau, IA pour un autre club avec extraits vérifiés mot pour mot), bouées d'IC à confirmer, gel automatique du vent et de la stratégie, auteur de chaque élément, GPX d'Open GPX Tracker avec pauses rattaché à la régate du jour
**Confidence:** HIGH sur ce qui a été exécuté ici (Node 22.22, trace SNPM réelle, IC SNPM réelles extraites par le pdf.js vendorisé, 20 tests de prototypes verts) ; MEDIUM sur le comportement réel du modèle `gpt-5.5` (aucun réseau ni clé dans le bac à sable : tout est testé avec un client simulé) ; LOW sur la qualité de lecture d'IC d'autres clubs (aucun PDF disponible, D-06)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lecture des IC (REG-03, REG-04)**
- **D-01:** Les IC d'un autre club sont lues par l'IA (OpenAI `gpt-5.5`, nouvelle fonction `api/ic.js` sur le modèle d'`api/rules.js` : schéma JSON strict, entrée bornée). Chaque valeur extraite porte l'extrait d'origine, vérifié **mot pour mot** contre le texte du PDF côté serveur (comme les citations de l'arbitre) ; une valeur dont l'extrait n'est pas retrouvé reste vide ou signalée, jamais devinée.
- **D-02:** Relecture champ par champ obligatoire : rien n'est retenu sans validation de l'équipier ; contrôles de vraisemblance (dates, heures, canal VHF, positions hors du plan d'eau) affichés à côté de chaque valeur.
- **D-03:** Les IC CVAT gardent la lecture actuelle par motifs (`parseIC`, hors réseau), présentée dans la même relecture. L'IA n'est appelée que pour un autre club ou si la lecture CVAT échoue, et seulement avec le réseau (import à faire avant la régate).
- **D-04:** Bouées et parcours lus dans les IC d'un autre club : affichés sur la carte « à confirmer », exclus du routage et du mode départ tant que l'équipier ne les a pas confirmés (réutiliser le signalement « à confirmer » de la phase 2).

**Auteur (ARCH-02)**
- **D-05:** L'auteur de chaque élément vient du code d'accès : le middleware, qui connaît déjà le membre, le transmet à l'app (par exemple un cookie lisible `rt_membre` avec le prénom seul, ou une petite réponse) ; jamais le code ni son empreinte côté client.

**Tests**
- **D-06:** Pas de PDF d'autres clubs pour l'instant : tester avec les IC CVAT/SNPM et des cas fabriqués ; les autres clubs seront validés à leur premier usage réel (et deviendront des cas de test).

### Claude's Discretion
- Modèle de données « régate » (date de début/fin — déjà `dateEnd` de la phase 1, club, manches avec parcours, statut à venir / aujourd'hui / passée, saison) et reprise automatique des fiches IC existantes (`rade.events.v1`) en régates.
- Moment du gel du vent et de la stratégie du jour (sans geste ; par exemple à chaque ouverture le jour J jusqu'au signal, figé au départ).
- Rattachement d'un GPX à la régate du jour (par date et heure ; choix proposé si plusieurs), pauses d'Open GPX Tracker sans ligne droite.
- Fiche de régate et liste par saison : vent du jour, traces, débrief, analyse polaire, rapport, auteur.
- Le verrou « journée de régate » de la phase 1 doit lire les dates de la régate (phase 3) au lieu de la seule fiche IC.

### Deferred Ideas (OUT OF SCOPE)
- Partage des régates entre téléphones (phase 4).
- Tests sur de vraies IC d'autres clubs (au premier usage).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-01 | N'importe quel équipier crée une régate (nom, date, club) en moins d'une minute, avec un statut à venir / aujourd'hui / passée | `js/regates.js` : modèle, `regattaStatus` en heure de Paris (testé aux minuits et au passage à l'heure d'hiver), création en 3 champs, reprise de `rade.events.v1` ; formulaire minimal dans l'onglet « Régates » |
| REG-02 | Une journée peut compter plusieurs manches, chacune avec son parcours | `races[{ n, date, time, courseId, cls, laps }]` dans la régate ; une manche règle `S.courseId / cls / laps / startTime` comme « Caler le départ » ; clé du gel de stratégie |
| REG-03 | Le PDF des IC (CVAT ou autre club) s'importe avec une relecture champ par champ (extrait d'origine affiché) et des contrôles de vraisemblance ; rien n'est retenu sans validation | `parseIC` enrichi d'extraits (ajout, sans changer les champs actuels), `api/ic.js` + `api/_icverify.js` (extrait retrouvé dans le texte ET valeur retrouvée dans l'extrait), `js/icplaus.js` (date, HH:MM, VHF, position), une seule interface de relecture pour les deux lecteurs |
| REG-04 | Pour une régate hors cahier CVAT, les bouées et parcours lus dans les IC sont confirmés sur la carte avant usage | `js/regmarks.js` : bouées `X1…` à confirmer affichées sur la carte (même signalement « ? » que `DOUBT`), jamais dans `MARKS` ni `COURSES` tant qu'elles ne sont pas confirmées ; injection par `app.js` seulement, jamais à l'import (la référence SNPM ne bouge pas) |
| ARCH-02 | Liste des régates par saison et fiche de régate : vent et stratégie du jour figés automatiquement (prévisions, relevés, route conseillée), traces, débrief, analyse polaire, rapport, auteur de chaque élément | `js/gel.js` (politique de gel pure, découpe des prévisions au jour : 38,8 Ko), IndexedDB `rade-regates`, `/api/membre` du middleware pour l'auteur, `js/regview.js` (liste + fiche) |
| ARCH-04 | Un GPX importé (Open GPX Tracker, pauses comprises) se rattache tout seul à la régate du jour et lance le débrief | `js/segments.js` (coupures : `<trkseg>` + trou > 2 min), `analyzeTrack` et `setTrace` sans relier les pauses, `js/attach.js` (jour de Paris du segment le plus long, départage par l'heure des manches, choix si ambigu), lancement de `runDebrief` pré-rempli |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives lues dans `/home/user/rade-tactique/.claude/CLAUDE.md`, traitées comme des décisions verrouillées :

- **JavaScript ES modules dans le navigateur, sans framework, sans build, sans TypeScript** ; tout outillage nouveau reste hors du chargement de l'app (`tools/`, `tests/`). Aucune dépendance nouvelle ici (`openai` est déjà là).
- Nouveau module navigateur : `js/<nom>.js`, **commentaire d'en-tête en français**, exports nommés, importé depuis `js/app.js` ; puis `npm run stamp` (il ajoute le fichier au SHELL). **Ne jamais éditer `sw.js` ni `js/version.js` à la main.**
- Nouvelle fonction API : `api/<nom>.js`, `POST` seulement, `process.env.OPENAI_MODEL || 'gpt-5.5'`, **schéma JSON strict** avec `additionalProperties: false`, entrée bornée, `maxDuration` dans `vercel.json` ; client OpenAI créé paresseusement ; assistant interne préfixé `_` dans `api/`.
- Interface et commentaires en français ; apostrophe typographique `’` et séparateurs `—` / `·` dans les chaînes d'interface ; `esc()` avant tout `innerHTML` (préférer `textContent`).
- Clés de stockage `rade.<nom>.v<n>` ; changer le suffixe quand la forme persistée change.
- Tests `node:test` + `linkedom` dans `tests/*.test.mjs` ; `npm run check` doit rester vert (162 tests, 6,5 s aujourd'hui).
- **Aucun code d'accès, aucune empreinte de `middleware.js`, aucune clé** dans le code, les tests, les journaux, la documentation ou les rapports.
- Règle d'exploitation : pas de mise en production dans les 48 h avant une régate ni pendant une course, sauf correctif critique hors course ; la référence Coupe SNPM ne change qu'avec l'accord de Romain (D-12).
- Fail soft : `try { … } catch { … }` pour les E/S optionnelles, mais **le chemin course consigne ses erreurs** (`report()` de `js/journal.js`, phase 2).

## Summary

La phase tient en **neuf petits modules** (huit purs : régates, segments, rattachement, gel, bouées de régate, vraisemblance, lecture d'IC enrichie, vues HTML ; plus le magasin IndexedDB `regstore.js`), **une fonction serveur** (`api/ic.js` + son assistant `api/_icverify.js`), **une réponse du middleware** (`GET /api/membre`) et **un seul plan de câblage** de `js/app.js` / `index.html` / `styles.css` / `js/help.js` / `guide.html`. Tout ce qui est calculable l'est sans réseau ni DOM. Les prototypes de ce document ont été exécutés ici (20 tests `node:test` verts sur les prototypes : 3 régates, 4 extraits et vraisemblance, 2 segments, 3 rattachement, 3 gel, 4 `api/ic.js` avec un client OpenAI simulé, 1 middleware) ; ils ne sont **pas** dans le dépôt, le planificateur les recopie depuis *Code Examples*.

**Trois défauts actuels que la phase doit corriger, mesurés ici.** (1) *Le débrief d'une trace ancienne utilise un vent faux sans le dire* : les prévisions sont téléchargées avec `forecast_days=3` (`js/weather.js:42`) et le cache est écrasé à chaque téléchargement (`save(KEY, data)`, ligne 53), `S.obs` est purgé au démarrage (`S.obs = (S.obs || []).filter((o) => o.day >= addDays(today(), -1));`, `js/app.js:61`) et `applyResiduals` rend les prévisions brutes pour un jour autre que `S.day` (`if (day !== S.day || !resid.length) return pts;`, ligne 203). Deux jours après la régate, `trackWindAt` retombe sur le vent manuel (`|| [{ x: 0, y: 0, ...S.manual }]`) : l'analyse polaire est calculée avec un vent qui n'est pas celui du jour. Le gel d'ARCH-02 n'est donc pas décoratif : il rend le débrief tardif exact. (2) *Une pause d'enregistrement devient une ligne droite* : la trace SNPM réelle a **2 `<trkseg>`** (quai 06:04-06:13Z, puis course 08:40-12:04Z, trou de 8 828 s, saut de 2 080 m) ; `fromGPX` aplatit tous les `trkpt` et `analyzeTrack` somme la distance sur le saut : **16,34 Nq en 6,00 h (2,72 nd moyens)** au lieu de **15,22 Nq en 3,55 h d'enregistrement actif (4,29 nd)**. (3) *Le verrou « journée de régate » ne lit que la fiche courante* (`raceFrom: IC?.date`, `js/app.js:725`) : avec plusieurs régates, c'est la régate d'aujourd'hui qui doit le commander.

**Données.** Régates : index léger dans `localStorage` (`rade.regates.v1`, lecture synchrone au démarrage, ≈ 10 Ko par régate) ; lourd dans une nouvelle base IndexedDB `rade-regates` (prévisions d'un jour : **38 803 octets mesurés** pour 24 points de grille × 6 modèles + mer, soit 25 heures ; stratégie de 15 bords : **9 423 octets** avec chemin décimé). Les traces et leurs rapports restent dans `rade-traces` (une trace SNPM = 613 Ko) ; la régate n'en garde que des références et un résumé. **Auteur** : le middleware répond `GET /api/membre` → `{ "membre": "<prénom>" }` ; pas de cookie `rt_membre` (le `Set-Cookie` d'un `next()` n'est pas documenté par Vercel, voir Open Questions).

**Lecture des IC.** Le texte du PDF extrait par le pdf.js vendorisé (11 476 caractères pour les IC SNPM) part au serveur ; le modèle ne renvoie que `{ value, excerpt }` ; le serveur garde une valeur seulement si l'extrait est **dans le texte reçu** (comparaison sans blancs, NFKC, apostrophes unifiées : tolère « S ociété N autique ») **et** si la valeur est **dans l'extrait** (« 10:55 » ↔ « 10h55 »). Les positions de bouées restent du **texte** côté modèle : le code les convertit avec `parseLatLon` (`js/marks.js`), le modèle ne calcule aucune coordonnée.

**Primary recommendation :** écrire d'abord les modules purs et `api/ic.js` avec leurs tests (vague 1, quatre plans parallèles sur des fichiers disjoints), puis **un seul plan de câblage** (vague 2, fichiers partagés), puis publier la **v28** (régates, gel, auteur, GPX, relecture CVAT) sur l'aperçu avant le **30 octobre**, et la **v29** (IA pour un autre club et bouées à confirmer) avant le gel du **2 novembre** ; rien ne part en production après le **jeudi 5 novembre au matin**.

## Architectural Responsibility Map

Application sans serveur applicatif métier : « niveaux » = page, modules purs, stockage de l'appareil, middleware, fonction Vercel, OpenAI.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Modèle de régate, statut, saison, reprise de `rade.events.v1`, dates du verrou | Module pur `js/regates.js` | `localStorage` (index, synchrone) | `let IC = currentEvent();` s'exécute à l'import de `app.js` (ligne 50) : l'index doit être lisible sans attente |
| Données lourdes (prévisions du jour, relevés, stratégie) | IndexedDB `rade-regates` | `js/gel.js` (décisions pures) | 38,8 Ko par jour de prévisions : trop pour `localStorage` sur des saisons ; asynchrone sans importance (jamais lu au démarrage) |
| Politique de gel (quand copier, quand sceller) | `js/gel.js` pur | `app.js` (collecte, déclenchement dans `raceTick`/après `runAnalysis`) | Testable sans horloge ni DOM ; sans geste de l'équipage |
| Lecture CVAT des IC | `parseIC` (motifs, hors réseau) + extraits | pdf.js vendorisé (`pdfText`) | D-03 : hors réseau |
| Lecture IA d'un autre club | Fonction Vercel `api/ic.js` | OpenAI `gpt-5.5` | La clé ne quitte jamais le serveur ; le texte seul voyage ; vérification mot pour mot **côté serveur** (D-01) |
| Vérification des extraits | `api/_icverify.js` pur | tests | La valeur n'atteint la page qu'après vérification |
| Vraisemblance (date, heure, VHF, position) | `js/icplaus.js` pur (page) | `Terrain.isLand` / extension de `data/meta.json` | Affichée à côté de chaque valeur, hors réseau |
| Bouées et parcours d'un autre club | `js/regmarks.js` pur | `app.js` (injection dans `MARKS`/`COURSES`, redessin) | Même polarité que `applyOverrides` : mutation au démarrage et sur geste, jamais à l'import |
| Auteur | Middleware (`GET /api/membre`) | `localStorage` `rade.membre.v1` (copie hors réseau) | Seul le middleware connaît le membre ; le client ne voit jamais code ni empreinte |
| Pauses de trace | `js/segments.js` pur | `track.js` (`analyzeTrack`), `scene3d.js` (`setTrace`) | Données dans le modèle (`tr.brk`), pas un correctif de dessin |
| Rattachement d'une trace | `js/attach.js` pur | `app.js` (invite de choix, lancement du débrief) | Jour de Paris, départage par heure, jamais l'heure locale du téléphone |
| Écrans (liste, fiche, relecture, choix) | `js/regview.js` (chaînes HTML échappées) | `app.js` (événements) | `app.js` fait 1 542 lignes : les vues se testent avec `linkedom` |

## Standard Stack

### Core

Aucune dépendance à installer.

| Élément | Version | Rôle | Pourquoi |
|---------|---------|------|----------|
| `openai` (déjà installé) | 7.39.0 [VERIFIED: `node_modules/openai/package.json` `"version": "7.39.0"`] ; plage `^7.36.0` | `client.responses.create(...)` avec `json_schema` strict | Déjà utilisé par `api/rules.js` (lignes 74-80) |
| pdf.js vendorisé (3.11.174, `isEvalSupported: false`) | `vendor/pdf.min.js` | Texte du PDF d'IC | Déjà sûr (phase 1) ; **ne pas** appeler `getDocument` ailleurs que par `pdfText` (garde de `tests/pdf.test.mjs`) |
| `node:test` + `linkedom` 0.18.13 | Node 22.22 ici, `engines` 24.x | Tests purs, vues HTML, API avec client simulé | Déjà en place [VERIFIED: `package.json`] |
| `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })` | navigateur / Node | Jour de Paris | Déjà dans `js/racelock.js` (`parisClock`), à réutiliser partout |
| IndexedDB | navigateur | Base `rade-regates` | Même mécanisme que `rade-traces` (`js/track.js`) ; base séparée : pas de montée de version de `rade-traces` (ouverture bloquée par un autre onglet) |

### Supporting (hors dépôt, mesure facultative)

| Outil | Version | Usage |
|-------|---------|-------|
| Playwright global + Chromium 1194 | 1.56.1 [VERIFIED: `npm ls -g`] | Scénario de bout en bout facultatif (`tools/…`, jamais dans `package.json`) |

### Alternatives Considered

| Au lieu de | Alternative | Compromis |
|------------|-------------|-----------|
| Index `localStorage` + IndexedDB lourd | Tout en IndexedDB | Lecture asynchrone : casserait le `let IC = currentEvent();` synchrone et la garde `tests/boot.test.mjs` (« aucune attente avant l'interface utile ») |
| Tout en `localStorage` | — | 38,8 Ko par jour de prévisions + 9,4 Ko de stratégie : ≈ 1 Mo par saison, partagé avec `rade.wx.v1` (≈ 88 Ko) et le journal (40 Ko) ; quota iOS d'environ 5 Mo [ASSUMED] |
| `GET /api/membre` du middleware | Cookie lisible `rt_membre` posé par `next({ headers })` | `next({ headers })` pour des **en-têtes de réponse** est documenté [CITED: vercel.com/kb/guide/add-response-header], pas `Set-Cookie` ; non testable hors Vercel. Le cookie serait aussi renvoyé à chaque requête |
| Extraction par modèle des positions en degrés décimaux | Positions **recopiées en texte** par le modèle, converties par `parseLatLon` | Le modèle ne fait aucun calcul de coordonnées : une conversion hallucinée est impossible |
| `parseIC` seul pour tous les clubs | IA pour les autres clubs (D-01) | Les motifs sont écrits pour le vocabulaire du CVAT ; décidé par Romain |

**Installation :** aucune (`npm ci` inchangé).

**Version verification :** pas de nouveau paquet ; `openai` relevé dans `node_modules`, Node 22.22.0 et Playwright 1.56.1 par commandes exécutées cette session.

## Package Legitimacy Audit

Cette phase n'installe **aucun paquet externe** (ni runtime, ni devDependency). `openai` est déjà dans `package.json` et `package-lock.json`. Aucune vérification `package-legitimacy` n'est requise.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (aucun nouveau) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
 IMPORT DES IC (avant la régate)
  PDF ─► pdfText (pdf.js, isEvalSupported:false) ─► cleanText (lettres espacées, blancs) ─► < 200 car./page ? « PDF sans texte : saisie à la main »
        │
        ├─ CVAT reconnu (icLooksCvat) et lecture complète (cvatReadOk) ─► parseIC + extraits ─────────────┐ (hors réseau)
        └─ autre club, ou lecture CVAT incomplète, et réseau ─► POST /api/ic { text ≤ 50 000 }            │
              middleware (code d'accès) ─► api/ic.js ─► OpenAI gpt-5.5 (schéma strict, effort low)         │
                    ◄─ { value, excerpt } ─► api/_icverify : extrait ∈ texte ? valeur ∈ extrait ? ─────────┤
                         (non : valeur vidée + « extrait introuvable »)                                    ▼
                                                                          RELECTURE champ par champ : valeur · extrait · puce de vraisemblance
                                                                          (icplaus : date, HH:MM, VHF, position) ─► l'équipier VALIDE ─► ic.validated {by, at}
                                                                                                                        │
   bouées lues (texte de position) ─► parseLatLon ─► regatta.marks[X1…] « à confirmer » ─► carte « X1 ? » ─► Confirmer ─► applyRegattaMarks ─► MARKS / COURSES
        (jamais dans MARKS avant confirmation : routage, mode départ et débrief ne les voient pas)

 JOUR DE RÉGATE (sans geste)
  ouverture de l'app / raceTick (5 s) / fin de runAnalysis / téléchargement de prévisions
        └─► freezeAction({ now, regatta, day, slot, dataFetched, hasAnalysis }) ─► 'rien' | 'gel' | 'sceau' | 'tard'
              gel/sceau ─► sliceDays(data, [jour]) + S.obs du jour + stratégie compacte ─► IndexedDB rade-regates (heavy) + résumé dans l'index
              sceau = premier signal d'avertissement du jour (Paris) ; relevés continuent d'être copiés jusqu'au soir

 APRÈS LA COURSE
  GPX ─► fromGPX ─► tr.brk (instants des <trkseg> + trous > 2 min) ─► saveTrack
      ─► matchRegattas(tr.pts, régates) : unique | heure | choix | proche | aucune ─► rattachement (auteur, date) ─► regatta.traces[]
      ─► showTrace (ligne coupée aux pauses) ─► runDebrief(tr) pré-rempli (régate, manche, vent GELÉ si le jour n'est plus dans les prévisions vivantes)
      ─► tr.report ─► résumé (dist, durée active, % polaire) dans regatta.traces[i].sum ─► fiche de régate

 AUTEUR : chaque écriture ─► membre() ─► localStorage rade.membre.v1 ◄─ fetch('/api/membre') au démarrage (après rt:ui, jamais attendu)
```

### Recommended Project Structure

```text
js/
├── regates.js       # modèle, statut Paris, saison, création, reprise de rade.events.v1, dates du verrou, signature d'auteur (pur, stockage injecté)
├── regstore.js      # base IndexedDB rade-regates (put/get/list des données lourdes), erreurs consignées par report()
├── gel.js           # freezeAction, sealAt, sliceDays, compactStrategy (pur)
├── regmarks.js      # bouées et parcours d'une régate : à confirmer / confirmés, applyRegattaMarks(marks, courses, régate) (pur)
├── icread.js        # icLooksCvat, cvatReadOk, cleanText, normalisation de la réponse de /api/ic vers la fiche de relecture (pur)
├── icplaus.js       # checkDate, checkTime, checkVhf, checkPos, checkSeq (pur)
├── segments.js      # segmentBreaks, segStartsFromDoc, activeStats (pur)
├── attach.js        # trackDay, matchRegattas (pur)
├── regview.js       # liste par saison, fiche, relecture, choix de régate : chaînes HTML échappées (pur)
├── events.js        # parseIC + extraits (ajout), pdfText inchangé ; les fonctions de fiches deviennent un adaptateur sur js/regates.js
├── track.js         # fromGPX : tr.brk ; analyzeTrack : brk, dist et durée actives
├── scene3d.js       # setTrace : segments sans pont
├── debrief.js       # legStats : ignorer les ponts ; ask : pré-sélection du parcours de la manche
└── app.js           # câblage seulement
api/
├── ic.js            # POST { text } → champs vérifiés (createHandler exporté pour les tests)
└── _icverify.js     # squash, inText, valueInExcerpt, checkField (pur)
middleware.js        # + GET /api/membre
vercel.json          # + "api/ic.js": { "maxDuration": 60 }
tests/               # regates, gel, regmarks, icverify, icplaus, icread, segments, attach, regview, apiic, membre (access.test.mjs complété)
```

### Pattern 1 : régate = index synchrone + données lourdes asynchrones

**What:** un objet par régate dans `rade.regates.v1`, sans donnée volumineuse ; les prévisions, relevés et stratégies d'un jour sont dans IndexedDB sous la clé `${id}|${jour}|${nature}`. L'index porte un **résumé** de chaque gel (heure, scellé, vent au départ, nombre de relevés), de quoi afficher la fiche sans attendre IndexedDB.

```javascript
// forme persistée (v1) : une seule clé localStorage, { v:1, current, list:[…] }
{
  id, name, club, dateStart: 'AAAA-MM-JJ', dateEnd: '' | 'AAAA-MM-JJ', season: '2026',
  by: 'Teiva' | null, at: ms,                                                          // auteur et instant de création
  races: [{ n: 1, date: 'AAAA-MM-JJ', time: 'HH:MM' | '', courseId: 5 | 'X101' | null, cls: 'G', laps: 2, note: '', by, at }],
  ic: { fields: { firstWarning, lastFinishSignal, vhf, committee, zone, keyRules: [], sequence, classes, groups }, excerpts: { firstWarning: '…' },
        text: '≤ 20 000 car.', source: 'fichier.pdf', read: 'motifs' | 'ia' | 'saisie' | 'reprise', validated: { by, at } | null },
  marks: [{ id: 'X1', name, lat, lon, src: 'IC <club>', excerpt, status: 'a_confirmer' | 'confirmee', by, at }],
  courses: [{ id: 101, title, seq: [['X1','t'], …], excerpt, by, at }],
  frozen: { 'AAAA-MM-JJ': { at, sealed, late, fetched, by, auto: true, windStart: { dir, spd }, model, nObs, strategy: { courseId, cls, laps, startTime, legs: 15 } } },
  traces: [{ id, name, start, n, by, at, sum: { dist, dur, perf, vmean }, report: { t, by } | null }],
}
```

**When to use:** toute lecture synchrone (statut, verrou, bandeau « jour de régate », liste). **Limites mesurées :** 38 803 o (un jour de prévisions, 25 heures) + 9 423 o (stratégie) ≈ 50 Ko par jour de régate dans IndexedDB ; l'index tient ≈ 10 Ko par régate (IC : 18 points clés × 260 car. au plus, `ic.text` plafonné à 20 000 caractères — les IC SNPM en font 11 476).

### Pattern 2 : statut et verrou en heure de Paris, une seule fonction

`regattaStatus(r, now)` compare le **jour de Paris** (`parisClock(now).date`, `js/racelock.js`) au premier et au dernier jour ; `lockDates({ now, list, currentId })` choisit la régate d'aujourd'hui (la courante en priorité) et renvoie `{ raceFrom, raceTo }` pour `lockState` et `isRaceDay` (remplace les deux lectures `IC?.date` / `IC?.dateEnd`, `js/app.js:725` et `:1157`). `currentEvent()` reste, pour les consommateurs existants, un **adaptateur** qui rend la forme d'avant (`event`, `date`, `dateEnd`, `firstWarning`, `classes`, `keyRules`, `text`, `id`…) : `IC.id === 'snpm-2026'` (ligne 1495) et `COMMON` (`js/events.js:10`) continuent de marcher.

### Pattern 3 : relecture champ par champ à deux lecteurs, une seule interface

Chaque champ de relecture est `{ key, label, value, excerpt, check: { level: 'ok'|'warn'|'bad', msg }, flag }`. Les deux lecteurs produisent cette forme : `parseIC` (motifs, extrait = la phrase qui a produit la valeur, ajout `f.ex` sans toucher aux champs existants que `tests/pdf.test.mjs` contrôle) et `api/ic.js`. L'équipier **modifie ou vide** chaque valeur puis touche « Valider les IC » : `ic.validated = { by, at }` ; sans validation rien n'entre dans la régate (le brouillon reste en mémoire de la page). Un champ dont la vérification a échoué est **vide** avec la puce « extrait introuvable » (D-01) ; la valeur proposée par le modèle n'est **pas** montrée (une valeur non vérifiée affichée serait « devinée »).

### Pattern 4 : bouées d'un autre club, injection sur place par `app.js` seulement

`regatta.marks` porte toutes les bouées lues (état `a_confirmer` ou `confirmee`). `applyRegattaMarks(marks, courses, régate)` retire d'abord toute entrée injectée avant (clé `X…`, parcours `custom: true`), puis ajoute **seulement les bouées confirmées** dans `marks` et les parcours dont **toutes** les bouées sont confirmées dans `courses`. Les bouées `a_confirmer` sont passées à `scene.setMarks` à part, avec `doubt: true` (même « X1 ? » et « · à confirmer » que la phase 2, `js/scene3d.js:324` et `:330`), donc **jamais** dans `MARKS` : `buildLegs` (`js/tactics.js:78`), `passages()` du débrief, le mode départ (`firstMark`) et le routage ne les voient pas. Appel unique dans `init()` après la lecture de l'index, puis à chaque changement de régate courante ou de confirmation ; les tests passent des copies (`structuredClone`).

### Pattern 5 : gel automatique par politique pure

`freezeAction` renvoie `'rien' | 'gel' | 'sceau' | 'tard'` : `gel` = copie à jour (première, nouvelles prévisions téléchargées, ou ≥ 10 min depuis la dernière) ; `sceau` = dernière copie au premier signal d'avertissement du jour (manche la plus tôt, sinon l'heure des IC), puis plus rien ; `tard` = première copie après le signal (app ouverte trop tard), marquée `late`. Les **relevés** de vent continuent d'être copiés jusqu'au soir (ce sont des observations, pas un plan). Le gel ne **calcule** rien : il copie `data` découpé, `S.obs` du jour et un résumé de `analysis` ; il passe donc la règle de la phase 2 (pas de calcul lourd de H−6 min à H+1 min) et s'exécute par `setTimeout(0)` / écriture IndexedDB asynchrone.

### Pattern 6 : trace coupée aux pauses, dans les données

`tr.brk = [indices]` (début de chaque segment après le premier) calculé par `breaksFromInstants(pts, instantsDesTrkseg)` : une coupure si le trou dépasse **120 s** (perte du GPS) ou si un nouveau `<trkseg>` suit un trou de plus de **5 s**. Les traces déjà stockées n'ont pas `brk` : `breaksOf(tr) = tr.brk ?? segmentBreaks(tr.pts)` (la règle du trou suffit : le saut SNPM est de 8 828 s). `analyzeTrack` marque `P[i].brk = true`, ne somme pas la distance sur un pont et calcule `dur` comme la **somme des durées de segments** ; `scene3d.setTrace` dessine `THREE.LineSegments` avec un index de paires sauf aux ponts (`geo.setIndex`). Le format des points `[t, lat, lon, sog, cog, acc]` ne change pas.

### Pattern 7 : rattachement puis débrief

`trackDay(pts)` = jour de Paris du **milieu du segment le plus long** (le segment du quai ne décide pas) ; `matchRegattas` rend `unique` (une régate contient ce jour : rattachement sans question, avec « Annuler » dans le toast), `heure` (plusieurs régates ce jour, une seule a une manche dont l'heure tombe dans la fenêtre de la trace), `choix` (invite avec la liste), `proche` (± 1 jour : proposer), `aucune` (proposer de créer une régate à la date de la trace, ou de laisser sans régate). Après rattachement : `showTrace(id)` puis `runDebrief(tr)` ; `api.eventName` = nom de la régate ; le parcours de la manche pré-sélectionne `#dqCourse` quand `mc` ne trouve rien ; `windGuess` et `trackWindAt` lisent les prévisions **gelées** quand le jour de la trace n'est plus dans `series` vivante (voir Pitfall 1).

### Anti-Patterns to Avoid

- **Stocker les IC, prévisions et stratégies d'une saison dans `localStorage`** : quota partagé avec le cache météo et le journal ; les gros objets vont en IndexedDB.
- **Afficher la valeur proposée par le modèle quand l'extrait n'est pas retrouvé** : c'est une valeur devinée (D-01).
- **Demander au modèle de convertir des coordonnées** : il recopie le texte, `parseLatLon` convertit.
- **Mettre des bouées d'IC dans `MARKS` « en attendant » leur confirmation** : routage, mode départ et passages du débrief les prendraient pour vraies (D-04).
- **Injecter des bouées ou des parcours à l'import d'un module** : les tests de référence lisent `MARKS` et `COURSES` tels que `js/courses.js` les définit.
- **Lire l'heure ou le jour avec `Date.getDate()` / `toLocaleDateString()` sans fuseau** : toujours `parisClock` (le téléphone peut être réglé ailleurs ; le jour d'une trace de nuit change à minuit de Paris, pas d'UTC).
- **Faire un `await` dans `init()` avant la marque `rt:ui`** : `tests/boot.test.mjs` le refuse (`assert.ok(!/\bawait\b/.test(init.slice(0, ui)), …)`). L'appel `fetch('/api/membre')`, la base IndexedDB et le gel viennent après.
- **Ouvrir la liste des traces pour la fiche** : `listTracks()` fait `getAll()` de toutes les traces complètes (≈ 600 Ko chacune) ; la fiche lit `regatta.traces` (résumés).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jour et heure de Paris | `getHours()`, décalages à la main | `parisClock` de `js/racelock.js` | Heure d'été, minuit, téléphone en autre fuseau (testé ici autour du 25/10 et du 7-9/11) |
| Lecture de coordonnées d'IC | Nouvelle regex | `parseCoord` / `parseLatLon` de `js/marks.js` (décimal, deg-min, deg-min-s, hémisphères, ordre libre) | Déjà testé (phase 2) ; refuse minutes ≥ 60 |
| Position sur terre / hors carte | Polygone à la main | `Terrain.isLand` / `Terrain.inside` (`js/geo.js`) et `data/meta.json` | `cover.bin` : aucune des 11 marques CVAT n'est classée « terre » [VERIFIED: exécution cette session] |
| Texte d'un PDF | Lecteur maison | `pdfText` (pdf.js vendorisé) | Déjà sandboxé (`isEvalSupported:false`) |
| Validation de la réponse du modèle | Analyse tolérante de texte libre | `text.format: { type: 'json_schema', strict: true }` + garde de test sur le sous-ensemble strict | [CITED: developers.openai.com/api/docs/guides/structured-outputs] |
| Comparaison d'extraits | Distance de Levenshtein, « à peu près » | Égalité de sous-chaîne après `squash` (pas de flou : un extrait approximatif n'est pas une preuve) | D-01 : « mot pour mot » |
| Pauses d'un enregistrement | Lissage qui « bouche » les trous | `tr.brk` + coupure explicite | Une pause reliée donne une vitesse et un cap faux |
| Échappement HTML | Concaténation brute | `esc()` (et `textContent`) dans chaque vue ; guillemets doubles pour les attributs | Les extraits et noms viennent d'un PDF ou du modèle : non fiables |
| Identifiants | UUID maison | `'rg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)` (pas de dépendance, pas d'API récente) | Suffisant pour trois appareils ; phase 4 pourra imposer des UUID |

**Key insight :** la valeur de la phase est dans la **preuve** de ce qui est affiché (extrait retrouvé, valeur retrouvée dans l'extrait, bouée confirmée par un équipier, vent réellement figé avant le départ, auteur donné par le serveur), pas dans de nouvelles fonctions de calcul : chaque donnée de la fiche doit venir d'une observation traçable.

## Runtime State Inventory

La phase **migre** des fiches existantes (`rade.events.v1` → régates) et change l'origine du verrou de régate : inventaire explicite.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `rade.events.v1` : `const KEY = 'rade.events.v1';` (`js/events.js:5`), forme `{ current, list:[{ id, event, date, dateEnd, firstWarning, … , text }] }` ; fiche semée `snpm-2026` si absente (`eventsState`, lignes 12-16) ; `rade.state` (`day`, `courseId`, `cls`, `laps`, `startTime`) ; `rade.racelock` ; `S.obs` purgé au démarrage (`js/app.js:61`) ; traces `rade-traces` (IndexedDB) | **Migration de données** : `migrate()` crée `rade.regates.v1` une fois (idempotente), **sans modifier ni effacer** `rade.events.v1` (retour arrière possible) ; **code** : `app.js` lit l'adaptateur `currentEvent()` ; les traces existantes ne sont pas rattachées d'office (ARCH2-01 est reporté), une invite « Traces sans régate : N » est facultative |
| Live service config | Aucun service externe configuré hors dépôt pour cette phase. À contrôler : `OPENAI_API_KEY` doit exister pour l'environnement **Aperçu** de Vercel, sinon `/api/ic` répond 503 `no_key` sur l'aperçu `apercu-phase-03` | **Point de contrôle humain** sur l'aperçu (Open Question 14) |
| OS-registered state | Aucun | Aucune |
| Secrets/env vars | `OPENAI_API_KEY`, `OPENAI_MODEL` (inchangés) ; table `EQUIPAGE` de `middleware.js` : lue pour le prénom, **jamais copiée** ; aucun nouveau secret | Aucune ; vérifier qu'aucune empreinte ni aucun code n'entre dans les tests (le test `/api/membre` lit la première ligne de la table à l'exécution, sans l'afficher) |
| Build artifacts | `sw.js` (bloc `stamp`) et `js/version.js` : le SHELL doit contenir les neuf nouveaux modules ; cache du service worker nommé d'après le hachage | `npm run stamp` après chaque lot, `npm run release -- "…"` pour v28 / v29 ; `npm run check` refuse un SHELL périmé |

**Nothing found in category « OS-registered state » :** aucune tâche planifiée, aucun processus enregistré (application web).

**La question canonique :** après mise à jour de tous les fichiers, quelles données de l'appareil portent encore l'ancienne forme ? → `rade.events.v1` (volontairement gardée, ignorée ensuite), et `S.courseId` qui pourrait désigner un parcours d'une régate qui n'est plus la courante (garde : retour au parcours 3 si introuvable, Pitfall 7).

## Common Pitfalls

### Pitfall 1 : un débrief tardif calculé avec le vent manuel par défaut
**What goes wrong:** deux jours après la course, l'analyse polaire et le vent « au départ » proposés sont ceux du vent manuel (315° 15 nd), sans message.
**Why it happens:** `forecast_days=3` (`js/weather.js:42`), cache écrasé (`save(KEY, data)`), `S.obs` purgé au-delà d'hier (`js/app.js:61`), `applyResiduals` rend les prévisions brutes hors `S.day` (ligne 203), `trackWindAt` retombe sur `S.manual`.
**How to avoid:** quand `showTrace` / `runDebrief` traitent un jour absent de `series`, charger les prévisions gelées de la régate (`rade-regates`), les passer comme `data` à `modelPoints` / `scoreModels` / `consensus` (testé : sur les prévisions découpées, ces trois fonctions donnent **exactement** les mêmes résultats, y compris à 23 h 30), appliquer les relevés gelés comme `resid`, et le dire dans le rapport (« vent du jour figé le … à … »).
**Warning signs:** un débrief du lendemain dont le vent proposé au départ est vide ou égal à `S.manual`.

### Pitfall 2 : la découpe des prévisions perd la dernière demi-heure du dernier jour
**What goes wrong:** à 23 h 30 les prévisions découpées diffèrent de l'original.
**Why it happens:** `modelAt` interpole entre l'heure `i` et `i+1` (`const i1 = Math.min(h.time.length - 1, i0 + 1);`, `js/obs.js:23`) ; sans l'heure suivante, l'interpolation lit la dernière valeur.
**How to avoid:** `sliceDays` garde **l'heure 00:00 qui suit** le dernier jour demandé (25 valeurs au lieu de 24) ; test d'égalité à 9 h, 11 h 30 et 23 h 30 [VERIFIED: prototype, échec constaté puis corrigé].
**Warning signs:** vent figé différent du vent vécu autour de minuit.

### Pitfall 3 : le PDF de l'autre club n'a pas de texte, ou le texte est en désordre
**What goes wrong:** un PDF scanné donne un texte vide, deux colonnes donnent un ordre mélangé ; le modèle « répare » et cite un extrait absent.
**Why it happens:** pdf.js lit la couche texte uniquement ; l'extraction SNPM contient déjà des lettres espacées (« S ociété N autique »).
**How to avoid:** refuser avant l'appel (moins de 200 caractères par page en moyenne : « PDF sans texte, saisissez la fiche à la main ») ; envoyer `cleanText` (même nettoyage que `parseIC`) ; comparer **sans blancs** (`squash`) côté serveur ; un extrait absent du texte vide la valeur.
**Warning signs:** beaucoup de champs « extrait introuvable » sur un PDF lisible à l'œil.

### Pitfall 4 : un extrait exact mais une valeur fausse
**What goes wrong:** le modèle cite correctement « canal 72 » mais renvoie `vhf: 73`.
**Why it happens:** la vérification de l'extrait seule ne prouve pas la valeur.
**How to avoid:** `valueInExcerpt` : pour une heure, « 10:55 » doit se lire dans l'extrait comme `10h55`, `10:55`, `10.55` ou `10 h 55` ; pour une date, jour + mois (nom ou chiffres) + année ; pour un entier, nombre **entier** (pas `72` dans `720`) ; pour un texte, la valeur est une copie de l'extrait. Valeur fausse ⇒ vidée, extrait gardé, puce « la valeur ne figure pas dans l'extrait » [VERIFIED: prototype, 4 tests].
**Warning signs:** puces « valeur absente de l'extrait » récurrentes (prompt à revoir).

### Pitfall 5 : le texte du PDF est une donnée non fiable (injection de consignes)
**What goes wrong:** une phrase du PDF demande au modèle de « renvoyer le canal 16 ».
**Why it happens:** le texte d'un PDF est hostile par construction.
**How to avoid:** texte encadré par `<ic>…</ic>` et déclaré **donnée** dans les instructions ; sortie à schéma strict, aucune action ; mais **une phrase injectée présente dans le texte passe la vérification mot pour mot** : l'extrait est affiché à côté de la valeur, la vraisemblance signale le canal 16 (« veille de détresse »), et rien n'est retenu sans validation humaine (D-02). Risque résiduel accepté et écrit.
**Warning signs:** un extrait qui ressemble à une consigne.

### Pitfall 6 : XSS par un extrait, un nom de bouée ou un nom de régate
**What goes wrong:** une balise dans un extrait s'exécute dans la fiche.
**Why it happens:** `innerHTML` + texte venu d'un PDF ou du modèle ; `esc()` d'`app.js` n'échappe pas l'apostrophe [VERIFIED: `js/app.js:35`, `/[&<>"]/`].
**How to avoid:** `js/regview.js` échappe `& < > " '` et n'utilise que des attributs entre guillemets doubles ; test `linkedom` : une régate nommée `<img src=x onerror=alert(1)>` ne produit aucun élément `img` ; les extraits s'affichent par `textContent` ou échappés.
**Warning signs:** une balise visible dans la fiche.

### Pitfall 7 : un parcours d'une autre régate encore sélectionné
**What goes wrong:** `runAnalysis` plante (`course.seq` sur `undefined`) après un changement de régate courante ou la suppression d'une bouée confirmée.
**Why it happens:** `S.courseId` (persisté dans `rade.state`) désigne un parcours injecté qui n'existe plus ; `COURSES.find(...)` rend `undefined` (`js/app.js:362`).
**How to avoid:** `applyRegattaMarks` renvoie la liste des parcours retirés ; `app.js` remet `S.courseId = 3` (valeur de `DEF`) si le sien a disparu, **avant** `scheduleAnalysis()`. Identifiants de parcours injectés **numériques ≥ 100** (les comparaisons sont strictes, `x.id === S.courseId`, et `+m[1]` dans le lien partagé).
**Warning signs:** carte vide et erreur dans le journal juste après un changement de régate.

### Pitfall 8 : recalage d'une bouée d'IC dans `rade.marks.v1`
**What goes wrong:** deux régates ont toutes deux une bouée « X1 » ; un recalage mémorisé par clé les mélange.
**Why it happens:** `saveOverride(storage, k, ov)` est indexé par numéro de bouée (`js/marks.js`).
**How to avoid:** les bouées d'une régate ne passent **jamais** par `saveOverride` : leur position se corrige dans la régate (`regatta.marks[i]`) ; la ligne du tableau des marques (`marksRow`) n'offre « Recaler » que pour les bouées CVAT (clés numériques).
**Warning signs:** une bouée X1 qui change de place après avoir ouvert une autre régate.

### Pitfall 9 : double import du même GPX
**What goes wrong:** deux traces identiques, deux rattachements, deux débriefs.
**Why it happens:** `id: 'tr' + pts[0][0] + Math.round(Math.random() * 1000)` (`js/track.js:126`).
**How to avoid:** avant `saveTrack`, comparer `(start, n)` aux traces listées (`listTracks` expose `start` et `n`) : « Déjà importée » et réutilisation de la trace existante ; le rattachement est idempotent (même `id` de trace = une seule référence dans la régate).
**Warning signs:** deux lignes identiques dans « Mes traces ».

### Pitfall 10 : la réponse du modèle est tronquée ou refusée
**What goes wrong:** `JSON.parse` échoue.
**Why it happens:** `status: 'incomplete'` avec `incomplete_details.reason: 'max_output_tokens'`, ou refus [CITED: developers.openai.com/api/docs/guides/structured-outputs].
**How to avoid:** `max_output_tokens: 8000` (les jetons de raisonnement comptent dedans : effort `low`) ; `incomplete` → 502 « réponse tronquée : réessayez » ; `try/catch` autour de `JSON.parse` ; messages d'erreur en français, bornés à 300 caractères comme `api/rules.js:86`.
**Warning signs:** 502 fréquents sur de longues IC.

### Pitfall 11 : le « sceau » avant le départ n'a jamais lieu
**What goes wrong:** l'app est fermée avant le signal ; le gel du jour est vide ou périmé.
**Why it happens:** le gel est déclenché par l'ouverture de l'app, pas par un serveur.
**How to avoid:** copie à **chaque ouverture** le jour de régate, y compris hors réseau (depuis le cache `rade.wx.v1`, avec `fetched` consigné) ; copie `tard` marquée `late` quand la première ouverture suit le signal ; la fiche l'écrit (« figé après le départ »). L'heure de la copie et celle des prévisions sont toujours affichées.
**Warning signs:** une fiche sans vent figé pour un jour où l'app a pourtant servi.

### Pitfall 12 : l'auteur absent la première fois hors réseau
**What goes wrong:** un élément créé juste après la mise à jour, hors réseau, n'a pas d'auteur.
**Why it happens:** `/api/membre` n'a jamais répondu sur cet appareil.
**How to avoid:** `membre()` lit `rade.membre.v1` (copie du dernier succès) ; sinon `by: null` affiché « — » ; au premier succès de `/api/membre`, les éléments `by: null` créés sur cet appareil sont complétés (même appareil, même personne). L'auteur est une **étiquette** : le code côté client reste modifiable ; l'autorité serveur n'existe qu'en phase 4.
**Warning signs:** « — » dans la fiche d'un équipier qui a pourtant un code.

### Pitfall 13 : changer `analyzeTrack` déplace la référence SNPM
**What goes wrong:** `tests/reference.test.mjs` échoue après la prise en compte des pauses.
**Why it happens:** `dist` et `dur` changent (c'est voulu), et une fenêtre de calcul pourrait traverser un pont.
**How to avoid:** la référence ne lit ni `dist` ni `dur` de `analyzeTrack` (elle passe par `detect` / `analyze`) ; le pont SNPM (indice 293) est **avant** la course (quai) et en dehors de toute fenêtre de bord ; `legStats` (`js/debrief.js:122`) ignore les ponts. `npm test` complet doit rester vert **sans** toucher `tests/reference/*.json` (D-12) ; si une valeur bouge, présenter l'avant/après à Romain.
**Warning signs:** échec de `reference.test.mjs`.

### Pitfall 14 : `await` ou calcul dans `init()` avant l'interface utile
**What goes wrong:** l'ouverture repasse au-dessus de 2 s (phase 2, mesure : 623 ms médiane).
**Why it happens:** lecture IndexedDB ou `fetch('/api/membre')` placés avant `performance.mark('rt:ui')`.
**How to avoid:** seule la lecture **synchrone** de l'index (`localStorage`) et `applyRegattaMarks` précèdent la marque ; tout le reste après `await nextFrame()` ; la mesure `tools/measure-boot.mjs` (PW_REQUIRED=1) est refaite à la fin de la phase.
**Warning signs:** `tests/boot.test.mjs` rouge, ou médiane de l'interface utile > 1 s.

## Code Examples

Tous exécutés ici avec `node:test` (prototypes hors dépôt, 20 tests verts). Les constantes sont celles qui ont été mesurées.

### Régates : statut, saison, dates du verrou, reprise (`js/regates.js`)

```javascript
// Régates : modèle, statut (heure de Paris), saison, reprise des fiches de rade.events.v1, dates du verrou. Module pur : stockage injecté.
import { parisClock } from './racelock.js';
export const KEY = 'rade.regates.v1', VERSION = 1;

// 'avenir' | 'aujourdhui' | 'passee' (jour de Paris, jamais l'heure) ; sans date : 'avenir' (brouillon)
export function regattaStatus(r, now) {
  if (!r?.dateStart) return 'avenir';
  const d = parisClock(now).date, end = r.dateEnd || r.dateStart;
  return d < r.dateStart ? 'avenir' : d > end ? 'passee' : 'aujourdhui';
}
export const seasonOf = (dateStart) => (dateStart ? dateStart.slice(0, 4) : '—');       // saison = année civile du premier jour (A1)

// Verrou « journée de régate » : la régate d'aujourd'hui (la courante en priorité), sinon la courante
export function lockDates({ now, list, currentId }) {
  const today = list.filter((r) => regattaStatus(r, now) === 'aujourdhui');
  const r = today.find((x) => x.id === currentId) || today[0] || list.find((x) => x.id === currentId) || null;
  return { raceFrom: r?.dateStart || null, raceTo: r?.dateEnd || r?.dateStart || null };
}

// Fiche de rade.events.v1 → régate (la clé d'origine n'est jamais modifiée ni effacée)
export function fromEvent(ev, now, by = null) {
  const club = /CVAT/i.test(`${ev.event || ''} ${ev.source || ''} ${ev.id || ''}`) || ev.id === 'snpm-2026' ? 'CVAT' : '';
  const { id, event, date, dateEnd, source, text, ...ic } = ev;
  return { id: String(id), name: event || 'Régate', club, dateStart: date || '', dateEnd: dateEnd && dateEnd > date ? dateEnd : '', season: seasonOf(date),
    races: [], ic: { fields: ic, text: (text || '').slice(0, 20000), source: source || '', read: 'reprise', excerpts: {}, validated: { by, at: now } },
    marks: [], courses: [], frozen: {}, traces: [], by, at: now };
}
export function migrate({ storage, now = Date.now(), by = null }) {
  const cur = storage.getItem(KEY);
  if (cur) { try { const o = JSON.parse(cur); if (o?.v === VERSION && Array.isArray(o.list)) return o; } catch { /* illisible : on repart des fiches */ } }
  let ev = null; try { ev = JSON.parse(storage.getItem('rade.events.v1')); } catch { /* absent */ }
  const list = (ev?.list || []).map((e) => fromEvent(e, now, by));
  const st = { v: VERSION, current: list.find((r) => r.id === ev?.current)?.id || list[0]?.id || null, list };
  try { storage.setItem(KEY, JSON.stringify(st)); } catch { /* quota : en mémoire */ }
  return st;
}
```

Tests verts (3) : minuit de Paris (`2026-11-06T22:59:59Z` → à venir, `…23:00:00Z` → aujourd'hui, `2026-11-09T23:00:00Z` → passée) ; jour du passage à l'heure d'hiver (`2026-10-25`) ; le verrou choisit la régate du 7-9 novembre un jour de course même si la courante est la Coupe SNPM ; la reprise est idempotente (deuxième appel identique) et `rade.events.v1` reste en place.

### Extraits : l'extrait est dans le texte, la valeur est dans l'extrait (`api/_icverify.js`)

```javascript
// Vérification (côté serveur) : jamais de valeur sans extrait retrouvé, jamais d'extrait qui ne contient pas la valeur.
export const MIN_EXCERPT = 8;
// NFKC, apostrophes et guillemets unifiés, tous les blancs retirés (la mise en page du PDF coupe les mots : « S ociété N autique »)
export const squash = (s) => String(s ?? '').normalize('NFKC').replace(/[’‘`´′]/g, "'").replace(/[“”«»″]/g, '"').replace(/[‐‑–—−]/g, '-').replace(/[\s ]+/g, '').toLowerCase();
export const inText = (excerpt, corpusSquashed) => { const n = squash(excerpt).replace(/^["']+|["']+$/g, ''); return n.length >= MIN_EXCERPT && corpusSquashed.includes(n); };
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function valueInExcerpt(kind, value, excerpt) {                    // kind : 'time' | 'date' | 'int' | 'text'
  const x = squash(excerpt);
  if (value == null) return true;
  if (kind === 'time') { const [h, m] = String(value).split(':').map(Number); return new RegExp(`(?:^|[^0-9])0?${h}(?:h|:|\\.)0?${m}(?![0-9])`, 'i').test(x) || (m === 0 && new RegExp(`(?:^|[^0-9])0?${h}h(?![0-9])`).test(x)); }
  if (kind === 'date') { const [y, mo, d] = String(value).split('-').map(Number); return new RegExp(`(?:^|[^0-9])0?${d}(?:er)?${squash(MONTHS[mo - 1])}${y}`).test(x) || new RegExp(`(?:^|[^0-9])0?${d}[/.-]0?${mo}[/.-](?:${y}|${String(y).slice(2)})(?![0-9])`).test(x); }
  if (kind === 'int') return new RegExp(`(?:^|[^0-9])${Number(value)}(?![0-9])`).test(x);
  return squash(value).length > 0 && x.includes(squash(value));
}
export function checkField(f, kind, corpusSquashed) {                      // { value, excerpt } → { value, excerpt, flag? }
  if (f?.value == null) return { value: null, excerpt: null };
  if (!f.excerpt || !inText(f.excerpt, corpusSquashed)) return { value: null, excerpt: null, flag: 'extrait introuvable dans le texte' };
  if (!valueInExcerpt(kind, f.value, f.excerpt)) return { value: null, excerpt: f.excerpt, flag: 'la valeur ne figure pas dans l’extrait' };
  return { value: f.value, excerpt: f.excerpt };
}
```

Résultats sur le **vrai** texte des IC SNPM (11 476 caractères, extrait par `pdfText`) : « Heure du premier signal d’avertissement : 10h55 » retrouvé avec apostrophe droite et espaces multiples ; « Coupe de la Société Nautique de la Petite Mer » retrouvé alors que le PDF contient « S ociété N autique » ; un extrait inventé, un extrait de moins de 8 caractères, `11:55` pour « 10h55 », `2026-10-19` pour « 18 octobre 2026 » et `72` dans `720` sont refusés.

### `api/ic.js` : schéma strict, client simulable, jamais de cookie vers OpenAI

```javascript
// Lecture des IC d'un autre club (Vercel, fonction Node) : le texte extrait du PDF côté client est lu par OpenAI ; chaque valeur porte l'extrait
// d'origine, vérifié mot pour mot dans le texte reçu avant d'être renvoyé. Une valeur sans extrait retrouvé est vidée et signalée (D-01).
import OpenAI from 'openai';
import { squash, checkField } from './_icverify.js';

export const MAX_TEXT = 50000;                      // caractères ; les IC CVAT en font ~11 500
export const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
const S = { type: ['string', 'null'] };
const field = () => ({ type: 'object', additionalProperties: false, required: ['value', 'excerpt'], properties: { value: S, excerpt: S } });
const list = (props) => ({ type: 'array', items: { type: 'object', additionalProperties: false, required: Object.keys(props), properties: props } });
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['event', 'club', 'dateStart', 'dateEnd', 'firstWarning', 'lastFinish', 'vhf', 'committee', 'zone', 'startLine', 'finishLine', 'penalty', 'races', 'marks', 'courses', 'specialRules'],
  properties: {
    event: field(), club: field(), dateStart: field(), dateEnd: field(), firstWarning: field(), lastFinish: field(), vhf: field(), committee: field(), zone: field(), startLine: field(), finishLine: field(), penalty: field(),
    races: list({ date: S, warning: S, label: S, excerpt: S }),
    marks: list({ name: S, position: S, excerpt: S }),                       // position : TEXTE recopié, converti ensuite par parseLatLon (le modèle ne calcule rien)
    courses: list({ name: S, sequence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['mark', 'side'], properties: { mark: { type: 'string' }, side: { type: ['string', 'null'], enum: ['b', 't', null] } } } }, excerpt: S }),
    specialRules: list({ value: S, excerpt: S }),
  },
};
const KIND = { dateStart: 'date', dateEnd: 'date', firstWarning: 'time', lastFinish: 'time', vhf: 'int' };
export function verify(out, text) {
  const C = squash(text), res = { flags: 0 };
  for (const k of Object.keys(SCHEMA.properties)) { const v = out[k]; if (Array.isArray(v)) continue; res[k] = checkField(v, KIND[k] || 'text', C); if (res[k].flag) res.flags++; }
  const keep = (arr) => (arr || []).map((it) => (it.excerpt && checkField({ value: it.excerpt, excerpt: it.excerpt }, 'text', C).excerpt ? { ...it, verified: true } : { ...it, excerpt: null, verified: false }));
  res.races = keep(out.races); res.marks = keep(out.marks); res.courses = keep(out.courses); res.specialRules = keep(out.specialRules);
  res.flags += [...res.races, ...res.marks, ...res.courses, ...res.specialRules].filter((x) => !x.verified).length;
  return res;
}
let client = null;                                  // créé à la première requête : sans clé, le constructeur lèverait une erreur au chargement (comme api/rules.js)
export function createHandler({ openai = () => (client ??= new OpenAI()), instructions = SYSTEM } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'no_key' });
    const text = String(req.body?.text || '');
    if (text.trim().length < 200) return res.status(400).json({ error: 'texte des IC manquant ou trop court' });
    const sent = text.slice(0, MAX_TEXT);                                    // la vérification se fait contre ce qui est ENVOYÉ
    try {
      const r = await openai().responses.create({
        model: MODEL, instructions, input: `<ic>\n${sent}\n</ic>`, reasoning: { effort: 'low' }, max_output_tokens: 8000,
        text: { format: { type: 'json_schema', name: 'ic', schema: SCHEMA, strict: true } },
      });
      if (r.status === 'incomplete') return res.status(502).json({ error: 'réponse tronquée : réessayez' });
      return res.status(200).json({ ...verify(JSON.parse(r.output_text), sent), truncated: text.length > MAX_TEXT, model: MODEL });
    } catch (err) {
      const status = err instanceof OpenAI.APIError ? err.status || 502 : 500;
      return res.status(status).json({ error: String(err.message || err).slice(0, 300) });
    }
  };
}
export default createHandler();
```

`SYSTEM` (à écrire par le plan, en français) doit : déclarer le contenu de `<ic>` comme **donnée** jamais comme consigne ; demander `excerpt` **copié mot pour mot** (une phrase ou un segment, ≤ 300 caractères) ; demander `null` plutôt qu'une supposition ; dates en `AAAA-MM-JJ`, heures en `HH:MM`, `vhf` entier ; les positions de bouées **telles qu'écrites** ; `side` = `b` (bâbord) ou `t` (tribord) ; ne rien déduire d'un schéma image. Dans le test, `process.env.OPENAI_API_KEY = 'cle-de-test'` et un faux client `{ responses: { create } }` ; on vérifie les arguments (`text.format.strict === true`, `reasoning.effort === 'low'`, `max_output_tokens > 0`, **aucune** trace d'un cookie), 405, 503 (clé absente), 400, texte tronqué à 50 000, 502 sur `status: 'incomplete'`, extrait inventé → `verified: false`, valeur fausse → vidée. Garde : **sous-ensemble strict** (tout objet a `additionalProperties: false` et `required` = ses clés) ; limites de l'API : 5 000 propriétés, 10 niveaux [CITED: developers.openai.com/api/docs/guides/structured-outputs] (ce schéma : une trentaine de propriétés, 4 niveaux). `vercel.json` : ajouter `"api/ic.js": { "maxDuration": 60 }`.

### Vraisemblance côté client (`js/icplaus.js`)

```javascript
// { level: 'ok' | 'warn' | 'bad', msg } ; les bornes de la carte sont celles de data/meta.json (west 5.8, east 6.1, south 43.0, north 43.18)
export const BOUNDS = { south: 43.0, north: 43.18, west: 5.8, east: 6.1 };
export function checkVhf(n) {                                  // table internationale : canaux 1–28 et 60–88 (A2)
  if (!Number.isInteger(n) || n < 1 || n > 88) return { level: 'bad', msg: 'canal VHF impossible (1 à 88)' };
  if (n === 16) return { level: 'warn', msg: 'canal 16 : veille de détresse, rarement un canal de course' };
  return n > 28 && n < 60 ? { level: 'warn', msg: 'canal hors de la table internationale (1–28, 60–88)' } : { level: 'ok', msg: '' };
}
export function checkTime(hhmm, { min = '06:00', max = '21:00' } = {}) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || ''); if (!m || +m[1] > 23 || +m[2] > 59) return { level: 'bad', msg: 'heure impossible (HH:MM)' };
  return hhmm < min || hhmm > max ? { level: 'warn', msg: `heure inhabituelle pour un départ (${min}–${max})` } : { level: 'ok', msg: '' };
}
// checkDate (date impossible = bad ; à plus de 400 jours d'aujourd'hui, ou à plus de 6 jours du premier jour pour le dernier jour = warn),
// checkPos (hors carte = bad ; sur terre selon Terrain.isLand = warn), checkSeq (limite d'arrivée avant le premier signal = warn) : même forme
```

Tests verts : `2026-02-30` impossible ; `2027-12-01` à plus d'un an ; `25:00` impossible, `03:30` inhabituelle ; VHF 72 ok, 16 et 45 en alerte, 99 et `'72'` (chaîne) impossibles ; `43.097417, 5.93415` (Grande Jetée) dans la carte, `43.5, 5.9` et `43.0, 7.2` hors carte.

### Pauses de trace (`js/segments.js`)

```javascript
// Une <trkseg> d'Open GPX Tracker = un « Reprendre » ; un trou de plus de 2 min = perte du GPS.
export const PAUSE_GAP_S = 120;     // trou qui coupe toujours la ligne
export const SEG_GAP_S = 5;         // nouvelle <trkseg> : coupe si le trou dépasse 5 s
export function segmentBreaks(pts, segStarts = []) {
  const set = new Set(segStarts.filter((i) => i > 0 && i < pts.length)), out = [];
  for (let i = 1; i < pts.length; i++) { const g = (pts[i][0] - pts[i - 1][0]) / 1000; if (g > PAUSE_GAP_S || (set.has(i) && g > SEG_GAP_S)) out.push(i); }
  return out;
}
export function segStartsFromDoc(doc) {                       // instants (ms) du 1er point de chaque <trkseg> : robuste au tri et au dédoublonnage de fromGPX
  const starts = [];
  for (const seg of doc.getElementsByTagName('trkseg')) { const t = Date.parse(seg.getElementsByTagName('trkpt')[0]?.getElementsByTagName('time')[0]?.textContent?.trim() || ''); if (!isNaN(t)) starts.push(t); }
  return starts;
}
export const breaksFromInstants = (pts, instants) => segmentBreaks(pts, instants.map((t) => pts.findIndex((p) => p[0] >= t)).filter((i) => i > 0));
export function activeStats(P, distXY) {                      // P : points lissés avec .brk
  let dist = 0, dur = 0, start = 0;
  for (let i = 1; i <= P.length; i++) if (i === P.length || P[i].brk) { dur += (P[i - 1].t - P[start].t) / 1000; start = i; } else dist += distXY(P[i - 1], P[i]);
  return { dist, dur };
}
```

Sur la trace SNPM réelle (`tests/fixtures/coupe-snpm-2026-10-18.gpx`, 9 538 points, 2 `<trkseg>`) : `breaksFromInstants` → `[293]` ; sans `<trkseg>` (règle du trou) → `[293]` aussi ; **avant** : 16,34 Nq, 6,00 h, 2,72 nd ; **après** : 15,22 Nq, 3,55 h d'enregistrement actif, 4,29 nd. Un trou de 40 s en course ne coupe pas ; un nouveau segment après 3 s non plus ; après 40 s oui.

### Rattachement d'une trace (`js/attach.js`)

```javascript
import { parisClock } from './racelock.js';
import { segmentBreaks } from './segments.js';
export function trackDay(pts, breaks = segmentBreaks(pts)) {          // jour de Paris du milieu du segment le plus long
  const cuts = [0, ...breaks, pts.length]; let best = null;
  for (let k = 0; k < cuts.length - 1; k++) { const a = pts[cuts[k]][0], b = pts[cuts[k + 1] - 1][0]; if (!best || b - a > best.to - best.from) best = { from: a, to: b }; }
  return { day: parisClock(best.from + (best.to - best.from) / 2).date, ...best };
}
// → { how: 'unique' | 'heure' | 'choix' | 'proche' | 'aucune', candidates, day }
export function matchRegattas(pts, regattas) {
  const t = trackDay(pts), inDays = (r) => r.dateStart && t.day >= r.dateStart && t.day <= (r.dateEnd || r.dateStart);
  const c = regattas.filter(inDays);
  if (c.length === 1) return { how: 'unique', candidates: c, day: t.day };
  if (c.length > 1) {
    const hit = c.filter((r) => (r.races || []).some((m) => { if (!m.time || (m.date || r.dateStart) !== t.day) return false; const [h, mi] = m.time.split(':').map(Number);
      const s = Date.parse(`${t.day}T00:00:00Z`); return [0, 1, 2].map((o) => s + (h * 60 + mi) * 60000 - o * 3600e3).some((x) => x >= t.from - 3600e3 && x <= t.to); }));
    return hit.length === 1 ? { how: 'heure', candidates: hit, day: t.day } : { how: 'choix', candidates: c, day: t.day };
  }
  const near = regattas.filter((r) => (r.dateStart && Math.abs(Date.parse(t.day) - Date.parse(r.dateStart)) <= 864e5) || (r.dateEnd && Math.abs(Date.parse(t.day) - Date.parse(r.dateEnd)) <= 864e5));
  return near.length ? { how: 'proche', candidates: near, day: t.day } : { how: 'aucune', candidates: [], day: t.day };
}
```

SNPM : jour `2026-10-18`, début du segment retenu `2026-10-18T08:40:43.000Z` (10 h 40 à Paris) ; une régate → `unique` ; deux régates le même jour dont une seule a une manche à 10:55 → `heure` ; deux sans manche → `choix` ; régate du lendemain → `proche` ; régate du 7-9 novembre → `aucune` ; une trace de 23 h 30 à 00 h 30 (Paris) est du jour de **minuit passé**.

### Gel automatique (`js/gel.js`)

```javascript
import { parisClock } from './racelock.js';
export const THROTTLE_MS = 10 * 60e3;
// Instant du premier signal d'avertissement du jour (manche la plus tôt, sinon l'heure des IC) ; null si inconnu
export function sealAt(regatta, day) {
  const hh = [...(regatta.races || []).filter((m) => (m.date || regatta.dateStart) === day).map((m) => m.time), day === regatta.dateStart ? regatta.ic?.fields?.firstWarning : null].filter(Boolean).sort()[0];
  if (!hh) return null; const [h, m] = hh.split(':').map(Number);
  for (const off of [1, 2]) { const t = Date.parse(`${day}T00:00:00Z`) + (h * 60 + m) * 60000 - off * 3600e3; if (parisClock(t).date === day && parisClock(t).hour === h) return t; }
  return null;
}
// slot : { at, fetched, sealed } du dernier gel de ce jour, ou null → 'rien' | 'gel' | 'sceau' | 'tard'
export function freezeAction({ now, regatta, day, slot, dataFetched, hasAnalysis }) {
  if (!regatta || regatta.dateStart > day || (regatta.dateEnd || regatta.dateStart) < day) return 'rien';
  if (!dataFetched && !hasAnalysis) return 'rien';
  const seal = sealAt(regatta, day) ?? Infinity;
  if (slot?.sealed) return 'rien';
  if (now >= seal) return slot ? 'sceau' : 'tard';
  if (!slot) return 'gel';
  if (dataFetched && dataFetched !== slot.fetched) return 'gel';
  return now - slot.at >= THROTTLE_MS ? 'gel' : 'rien';
}
// Prévisions : mêmes tableaux horaires que le cache, réduits aux jours demandés + l'heure qui suit (modelAt interpole entre i et i+1)
export function sliceDays(data, days) {
  const cut = (loc) => { if (!loc?.hourly?.time) return loc;
    const inDay = loc.hourly.time.map((t) => days.includes(t.slice(0, 10))), idx = inDay.map((b, i) => (b || inDay[i - 1] ? i : -1)).filter((i) => i >= 0);
    return { ...loc, hourly: Object.fromEntries(Object.entries(loc.hourly).map(([k, v]) => [k, Array.isArray(v) ? idx.map((i) => v[i]) : v])) }; };
  return { fetched: data.fetched, snapshot: data.snapshot, multi: cut(data.multi), grid: Array.isArray(data.grid) ? data.grid.map(cut) : cut(data.grid), marine: cut(data.marine) };
}
```

Tests verts : `sealAt` = 10:00Z pour une manche à 11:00 Paris le 7/11 (heure d'hiver), `null` un jour sans manche ni IC ; première copie `gel` ; moins de 10 min `rien` ; nouvelles prévisions `gel` ; ≥ 10 min `gel` ; au signal `sceau` ; scellé `rien` ; première ouverture après le signal `tard` ; hors régate ou sans rien à copier `rien`. `sliceDays(wx-snapshot.json, ['2026-10-18'])` = **25 heures, 24 points de grille, 38 803 octets** (le fichier entier de 3 jours : 87 680) ; `modelPoints`, `scoreModels` et `consensus` donnent les mêmes résultats que sur l'original.

**Stratégie compacte** (mesurée sur le parcours 5, 2 tours, 15 bords, vent 315° 15 nd, via `buildLegs` + `analyzeLeg`) : `{ n, mark, side, to, brg, dist, time, type, wind: { dir, spd, gust }, advice: [...], path: [[lat, lon]…] }` avec le chemin décimé de 1 point sur 3 (493 points bruts → ≈ 170) = **9 423 octets** (5 923 sans chemin). Positions en **lat/lon** (jamais en x/y : `ORIGIN` de `js/geo.js` pourrait changer), entrées de `S` incluses (course, classe, tours, longueur de bord au vent, heure de départ, ligne, polaire, modèle) pour pouvoir **recalculer** plus tard (PITFALLS 10 : garder les entrées autant que le résultat).

### Auteur : `GET /api/membre` dans le middleware

```javascript
  // D-05 : le prénom de l'équipier connecté (jamais le code ni l'empreinte), pour signer ce qu'il crée ; réponse minuscule, jamais mise en cache
  const prenom = await membre(lireCookie(req));
  if (prenom && url.pathname === '/api/membre') return Response.json({ membre: prenom }, { headers: { 'Cache-Control': 'no-store' } });
  if (prenom) return next();
```

(remplace la ligne `if (await membre(lireCookie(req))) return next();`, `middleware.js:48`). Test vert, ajouté à `tests/access.test.mjs` : `/api/membre` est interceptée par le matcher ; sans code → 401 ; avec le faux code (digest simulé comme dans le test existant) → 200, `{"membre":"<prénom de la 1re ligne de la table, lu à l'exécution>"}`, `cache-control: no-store`, pas de `x-middleware-next`, **ni le code ni l'empreinte dans le corps** ; `/index.html` passe toujours ; simulacre retiré → 401. Côté page : `membre()` lit `rade.membre.v1`, `fetch('/api/membre')` après `rt:ui` (délai de 4 s, `AbortController`), copie le succès ; le service worker ne traite pas `/api/` (`sw.js:25` : `if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;`).

### Garde de schéma strict (test)

```javascript
function strict(s, path = '$') {            // sous-ensemble du mode strict : tout requis, additionalProperties false
  if (s.type === 'object' || s.properties) { assert.equal(s.additionalProperties, false, path); assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), path); for (const [k, v] of Object.entries(s.properties)) strict(v, path + '.' + k); }
  if (s.type === 'array') strict(s.items, path + '[]');
}
```

## State of the Art

| Ancienne approche | Approche actuelle | Depuis | Impact |
|-------------------|-------------------|--------|--------|
| Une fiche IC unique « courante » (`rade.events.v1`) | Régates (statut, manches, IC relues, bouées, gel, traces) | cette phase | Le verrou, le briefing et le débrief lisent la régate |
| Prévisions seulement vivantes | Prévisions du jour gelées avant le départ | cette phase | Débrief tardif exact (voir Pitfall 1) |
| Trace aplatie | Trace en segments (`tr.brk`) | cette phase | Distance et durée justes, pas de ligne droite sur les pauses |
| `parseIC` seul, valeur sans preuve | Valeur + extrait vérifié + vraisemblance | cette phase | Une valeur plausible mais fausse devient visible (PITFALLS 12) |

**Deprecated/outdated :**
- `eventsState` / `upsertEvent` / `removeEvent` : deviennent des adaptateurs sur `js/regates.js` (même signatures tant que `app.js` les appelle).
- Le libellé d'onglet « IC » (`index.html:79`, `<button data-tab="ic">IC</button>`) : renommé « Régates » (le `data-tab="ic"` et la `section` ne changent pas : aucune règle CSS ni test à toucher) ; `guide.html` (lignes 132, 146, 163) et `js/help.js` (lignes 34 et 96) à mettre à jour.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La saison est l'année civile du premier jour de la régate (champ `season` stocké, modifiable) | Pattern 1, Code Examples | Une saison Sept-Août mettrait octobre et janvier dans la même liste : changer `seasonOf` (le champ est déjà persisté) |
| A2 | Canaux VHF marine de la table internationale : 1–28 et 60–88 | `icplaus.js` | Un canal national 29–59 serait signalé en orange à tort (alerte, pas blocage) |
| A3 | Une lecture d'IC coûte quelques centimes au plus (≈ 3 000 jetons d'entrée pour 11 500 caractères, plafond 50 000 caractères ≈ 15 000 jetons ; sortie ≤ 8 000 jetons) | `api/ic.js` | Tarif de `gpt-5.5` non vérifié ici : relever le coût réel sur le tableau de bord OpenAI après le premier essai ; SECU2-01 (plafond de dépense) est reporté |
| A4 | Latence d'une lecture : 15 à 40 s (effort `low`), sous `maxDuration: 60` | `api/ic.js` | Dépassement : message « réessayez » ; passer le délai client à 70 s et ajouter un indicateur d'attente |
| A5 | `gpt-5.5` accepte ensemble `reasoning.effort: 'low'`, `json_schema` strict et `max_output_tokens` | `api/ic.js` | Les deux premiers sont déjà utilisés par `api/rules.js` (lignes 78-79) [VERIFIED] ; `max_output_tokens` est documenté [CITED] ; à confirmer par le premier appel réel sur l'aperçu |
| A6 | Open GPX Tracker crée un `<trkseg>` par pause (confirmé par la trace SNPM : 2 segments, trou de 8 828 s) | Pattern 6 | La règle du trou (> 120 s) suffit même sans `<trkseg>` ; seul un trou court en pause serait relié |
| A7 | Le quota `localStorage` d'iOS est d'environ 5 Mo par origine | Alternatives | Index trop gros : ≈ 10 Ko par régate, 20 régates = 200 Ko, marge large dans tous les cas |
| A8 | L'environnement Aperçu de Vercel a `OPENAI_API_KEY` | Runtime State | `api/ic.js` répond 503 sur l'aperçu : le point de contrôle humain le détecte avant la recette |
| A9 | Les IC d'un autre club sont en français et en texte (pas scannées) | Pitfall 3 | PDF scanné : message « saisie à la main » ; pas d'OCR (hors périmètre) |
| A10 | Une IC d'un autre club concerne la rade de Toulon | Pattern 4 | Autre plan d'eau : toutes les positions sont « hors carte » (mauvais) : la régate reste utilisable sans bouées confirmées ; plan d'eau = VENUE-01 (v2) |
| A11 | `Intl.DateTimeFormat` avec `timeZone: 'Europe/Paris'` est correct sur les iPhone de l'équipage | Don't Hand-Roll | Déjà utilisé en production par `js/racelock.js` depuis la phase 1 |
| A12 | Au plus ≈ 20 régates par saison, 1 à 3 jours chacune | Pattern 1 | Au-delà, ≈ 50 Ko par jour dans IndexedDB : sans problème de quota avant des centaines de jours |

## Open Questions (RESOLVED)

1. **Où stocker les régates : `localStorage` ou IndexedDB ?**
   - RESOLVED : **les deux**. Index synchrone `rade.regates.v1` (≈ 10 Ko par régate, forme versionnée `v:1`) pour le statut, le verrou et la liste ; données lourdes (prévisions 38,8 Ko par jour, stratégie 9,4 Ko, relevés) dans IndexedDB `rade-regates` (base séparée de `rade-traces`, pas de montée de version). Traces et rapports restent dans `rade-traces` ; la régate garde des références et un résumé (`traces[i].sum`).
2. **Qu'est-ce qu'une « saison » ?**
   - RESOLVED : l'année civile du premier jour (A1), **stockée** dans `season` (modifiable plus tard sans migration de code). La liste groupe par saison (la plus récente d'abord), puis « Aujourd'hui », « À venir », « Passées ».
3. **Cookie `rt_membre` ou petite réponse ?**
   - RESOLVED : **réponse** `GET /api/membre` du middleware (D-05 autorise les deux). Raisons : `next({ headers })` est documenté pour des en-têtes de réponse [CITED: vercel.com/kb/guide/add-response-header] mais rien n'y dit que `Set-Cookie` soit traité ; impossible à tester hors Vercel ; le cookie serait renvoyé à chaque requête et les installations existantes ne repasseraient pas par `?acces=`. La réponse est testable avec le vrai `middleware.js` (prototype vert). Hors réseau : copie `rade.membre.v1`.
4. **Quand figer le vent et la stratégie, sans geste ?**
   - RESOLVED : `freezeAction` (Pattern 5) : à chaque ouverture le jour de régate, à chaque téléchargement de prévisions et à chaque fin d'analyse, au plus toutes les 10 min ; **scellé au premier signal d'avertissement du jour** (manche la plus tôt, sinon heure des IC) ; première ouverture après le signal = copie `tard` marquée ; les relevés du jour sont copiés jusqu'au soir. Une clé par jour (une régate de 3 jours = 3 gels) ; la stratégie mémorise la manche choisie.
5. **Que faire si plusieurs régates ont lieu aujourd'hui ?**
   - RESOLVED : la courante si elle est d'aujourd'hui, sinon la première d'aujourd'hui (`lockDates`) ; le verrou de la phase 1 en découle.
6. **Le chemin CVAT passe-t-il par la même relecture ?**
   - RESOLVED : oui (D-03). `parseIC` gagne un champ `ex` (extrait = segment qui a produit la valeur, élargi d'au plus 30 caractères sans couper de mot) ; l'extrait est tiré du texte déjà normalisé, donc vérifié par construction. L'IA n'est proposée que si `!icLooksCvat(text)` ou `!cvatReadOk(fields)` (date valide + premier avertissement + VHF), avec réseau, après un geste (« Lire avec l'IA : le texte part chez OpenAI »).
7. **Que montrer quand l'extrait d'une valeur n'est pas retrouvé ?**
   - RESOLVED : champ **vide** + puce « extrait introuvable » ; la valeur proposée par le modèle est abandonnée (pas affichée). Valeur fausse dans un bon extrait : vide + extrait affiché + puce « la valeur ne figure pas dans l'extrait ». Les éléments de liste (manches, bouées, parcours, règles) sont marqués `verified: false`, extrait vidé, affichés grisés et **non cochés**.
8. **Quel effort de raisonnement, quelle durée, quel plafond de coût ?**
   - RESOLVED : `effort: 'low'` (comme `rules.js` et `voice.js` ; `medium` est réservé au débrief), `max_output_tokens: 8000`, entrée ≤ 50 000 caractères (tronquée, `truncated: true` affiché), `maxDuration: 60`, délai client 70 s avec `AbortController`, un seul appel par import (pas de relance automatique). Plafond de dépense et quota par équipier : SECU2-01, reporté (REQUIREMENTS). `store: false` : non ajouté (hors décision, v2).
9. **Hors réseau, que fait le bouton « Lire avec l'IA » ?**
   - RESOLVED : désactivé avec le message « Lecture IA indisponible hors réseau : importez les IC avant la régate » quand `navigator.onLine === false` ; sinon l'appel est tenté et une erreur réseau garde la relecture manuelle (saisie à la main des champs, jamais bloquante). `navigator.onLine` n'est qu'un indice (phase 2) : l'échec réel prime.
10. **Quelles vraisemblances, avec quels seuils ?**
    - RESOLVED : `js/icplaus.js` (voir Code Examples). Date : impossible = bad, > 400 jours d'aujourd'hui = warn, dernier jour > 6 jours après le premier = warn. Heure : `HH:MM` valide = ok, hors 06:00-21:00 = warn, limite d'arrivée avant le premier signal = warn. VHF : entier 1-88 ; 16 = warn ; 29-59 = warn (A2). Position : hors des bornes de `data/meta.json` = bad ; sur terre selon `Terrain.isLand` = warn (aucune des 11 marques CVAT n'est sur terre). Le niveau `bad` empêche de **valider** le champ tant qu'il n'est pas corrigé ou vidé ; `warn` n'empêche rien.
11. **Comment intégrer bouées et parcours d'une régate sans muter les constantes des tests ?**
    - RESOLVED : Pattern 4. Identifiants `X1…` pour les bouées (jamais en collision avec les clés numériques de `MARKS`), parcours numériques ≥ 100 ; `applyRegattaMarks(marks, courses, régate)` appelé par `app.js` seulement (init, changement de régate, confirmation), qui **retire** ce qui avait été injecté avant ; un parcours n'est injecté que si **toutes** ses bouées sont confirmées (sinon listé « bouées à confirmer »). Les bouées à confirmer vont à la carte avec `doubt: true` hors de `MARKS`. Tests sur copies ; `tests/reference.test.mjs` inchangé.
12. **Comment confirmer une bouée lue dans une IC ?**
    - RESOLVED : fiche de régate › Bouées : pour chaque bouée, position lue (texte d'origine, extrait, conversion par `parseLatLon`, puce de vraisemblance), « Voir sur la carte » (centre la 3D sur la bouée), « Confirmer » (`status: 'confirmee'`, `by`, `at`), « Corriger la position » (même champ de saisie que « Recaler », mêmes formats, plafond de déplacement `MAX_MOVE_M` de 2 Nq), « Ignorer ». Une bouée sans position reste « position à saisir » (jamais devinée).
13. **Les pauses : stockées ou recalculées ?**
    - RESOLVED : `fromGPX` stocke `tr.brk` (instants des `<trkseg>` + trous) ; les traces déjà enregistrées (sans `brk`) sont coupées par la règle du trou seule ; `analyzeTrack` expose `P[i].brk`, une distance et une durée **actives** (`durée` du tableau de bord = enregistrement actif) ; `setTrace` ne relie pas les ponts ; `legStats` ignore les ponts. La trace originale n'est pas conservée en GPX brut (phase 4).
14. **`/api/ic` fonctionne-t-elle sur l'aperçu Vercel ?**
    - RESOLVED : inconnu dans le bac à sable (aucun accès à Vercel). **Point de contrôle humain** à la fin du plan de publication : sur l'aperçu `apercu-phase-03`, Romain ouvre « Lire avec l'IA » sur les IC SNPM (les mêmes que `tests/fixtures/ic-coupe-snpm-2026-10-18.pdf`) ; 503 `no_key` ⇒ ajouter `OPENAI_API_KEY` à l'environnement Aperçu. Ce même essai sert de **validation réelle sans PDF d'un autre club** (D-06) : les valeurs de l'IA sont comparées à celles de `parseIC` (date 2026-10-18, 10:55, 16:00, VHF 72).
15. **Que fait le débrief automatique après un rattachement ?**
    - RESOLVED : `showTrace(id)` puis `runDebrief(tr)` : le questionnaire existant s'ouvre **pré-rempli** (nom de l'épreuve = régate, parcours de la manche, vent au départ = relevé gelé le plus proche sinon prévision gelée, étiquette « vent figé le … à … »). L'équipier le valide comme aujourd'hui (le questionnaire reste une validation humaine : `ask()` n'est pas supprimé). Si la carte n'est pas prête (temps 2 d'`init`), l'appel attend la promesse de prêt, sans geler l'interface.
16. **Plusieurs régates le même jour et trace ambiguë ?**
    - RESOLVED : départage par l'heure des manches (`heure`), sinon invite de choix avec les régates candidates et « Aucune » ; une trace sans régate ce jour propose « Créer une régate le JJ/MM » (nom prérempli par la date), « Choisir une régate proche » ou « Laisser sans régate » ; un rattachement s'annule depuis le toast et depuis la fiche.
17. **Les traces et fiches existantes sont-elles rattachées d'office ?**
    - RESOLVED : les **fiches** IC sont reprises (migration automatique) ; les **traces** existantes ne le sont pas (ARCH2-01 est reporté) ; la fiche de régate offre, si le jour correspond, « Rattacher les traces de cette date » (même `matchRegattas`, un geste), facultatif.
18. **Garde-t-on le PDF d'origine ?**
    - RESOLVED : non en phase 3 (texte seulement, ≤ 20 000 caractères dans l'index, relu depuis « Texte complet des IC » comme aujourd'hui) ; un PDF de 1 Mo ne se range pas dans `localStorage` ; la conservation du fichier est une affaire de la phase 4 (archive en ligne).
19. **Comment partager l'extraction entre `app.js` et les tests ?**
    - RESOLVED : `createHandler({ openai })` exporté par `api/ic.js` (client injecté ; le défaut crée `new OpenAI()` paresseusement) ; `api/_icverify.js` pur ; `js/icread.js` et `js/icplaus.js` purs côté page ; les tests n'ont besoin d'aucun réseau (le `fetch` des tests refuse déjà `http(s):`, `tests/helpers/setup.mjs`).
20. **Que livrer avant la régate ?**
    - RESOLVED : voir *Release mechanics* (v28 avant le 30 octobre : tout sauf l'IA et les bouées d'autres clubs ; v29 avant le gel du 2 novembre : IA et bouées à confirmer ; sinon après la régate, sans retarder v28).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm test`, prototypes | ✓ | 22.22.0 (le dépôt demande 24.x ; la suite passe : 162 tests, 6,5 s) | — |
| `openai` (SDK) | `api/ic.js`, test avec client simulé | ✓ | 7.39.0 (dans `node_modules`) | — |
| Playwright + Chromium | Scénario de bout en bout facultatif | ✓ (global) | 1.56.1, Chromium 1194 (`/opt/pw-browsers/chromium-1194`) | Aucun besoin dans `npm test` |
| Clé OpenAI et réseau | Appel réel de `api/ic.js` | ✗ (proxy ; aucune clé dans le bac à sable) | — | Client simulé dans les tests ; **appel réel = contrôle humain sur l'aperçu** (Open Question 14) |
| PDF d'IC d'un autre club | Validation réelle de l'IA | ✗ | — | D-06 : cas fabriqués (IC SNPM modifiées : club et libellés changés, heures en autre format) ; premier usage réel = nouveau cas de test |
| iPhone de l'équipage | Sélecteur de fichiers « Fichiers », saisie, lisibilité de la relecture | ✗ | — | **Aucun** : liste de recette humaine |
| Variables d'environnement Vercel (Aperçu) | `/api/ic` sur l'aperçu | ? inconnu | — | Ajouter `OPENAI_API_KEY` à l'environnement Aperçu |

**Missing dependencies with no fallback:** iPhone (parcours de fichiers, ergonomie) ; clé OpenAI réelle (validée par Romain sur l'aperçu).
**Missing dependencies with fallback:** PDF d'autres clubs (cas fabriqués).

## Validation Architecture

> `workflow.nyquist_validation` est `false` dans `.planning/config.json` ; la section est incluse parce que le demandeur l'exige explicitement.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `linkedom` 0.18.13 |
| Config file | aucun ; script `test` : `node --test --import ./tests/helpers/setup.mjs "tests/**/*.test.mjs"` (fuseau Paris, `DOMParser`, `fetch` local, réseau interdit) |
| Quick run command | `node --test --import ./tests/helpers/setup.mjs tests/<fichier>.test.mjs` |
| Full suite command | `npm run check` (`stamp --check` puis `npm test`) ; base de départ : 162 tests verts |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-01 | Statut à venir / aujourd'hui / passée en heure de Paris (minuit, passage à l'heure d'hiver, sans date) | unit | `tests/regates.test.mjs` | ❌ Wave 0 |
| REG-01 | Création en 3 champs, id unique, auteur ; reprise idempotente de `rade.events.v1` (clé d'origine intacte, SNPM → CVAT, `ic.fields.vhf` = 72) | unit | `tests/regates.test.mjs` | ❌ Wave 0 |
| REG-01 | Verrou : `lockDates` (régate d'aujourd'hui prioritaire) ; `app.js` n'utilise plus `IC?.date` pour `lockState`/`isRaceDay` | unit + garde statique | `tests/regates.test.mjs`, `tests/racelock.test.mjs` (✅ à compléter) | ❌ / ✅ |
| REG-02 | Manches (n, date, heure, parcours) : validation, tri, `sealAt` par jour | unit | `tests/regates.test.mjs`, `tests/gel.test.mjs` | ❌ Wave 0 |
| REG-03 | `parseIC` : champs actuels inchangés, extraits `ex` présents et retrouvés dans le texte (IC SNPM réelles) | unit + fixture | `tests/pdf.test.mjs` (✅ à compléter) | ✅ |
| REG-03 | `squash` / `inText` / `valueInExcerpt` / `checkField` (apostrophes, blancs, lettres espacées, 720 ≠ 72, 11:55 ≠ 10h55) | unit | `tests/icverify.test.mjs` | ❌ Wave 0 |
| REG-03 | `api/ic.js` : schéma strict, 405/503/400, troncature, 502 sur `incomplete`, extrait inventé et valeur fausse vidés, aucun cookie vers OpenAI, client simulé | unit | `tests/apiic.test.mjs` | ❌ Wave 0 |
| REG-03 | Vraisemblance : date, heure, VHF, position (Terrain réel), limite avant premier signal | unit | `tests/icplaus.test.mjs` | ❌ Wave 0 |
| REG-03 | `icLooksCvat` / `cvatReadOk` sur IC SNPM et sur une version fabriquée d'un autre club | unit | `tests/icread.test.mjs` | ❌ Wave 0 |
| REG-03 | Vues : une régate nommée `<img onerror>` ou un extrait `<script>` ne produisent aucun élément (linkedom) ; rien n'est retenu sans « Valider » | unit (linkedom) | `tests/regview.test.mjs` | ❌ Wave 0 |
| REG-04 | `applyRegattaMarks` : seules les bouées confirmées entrent dans `MARKS` ; parcours injecté seulement si toutes ses bouées sont confirmées ; retrait au changement ; `MARKS` réel intact | unit (copies) | `tests/regmarks.test.mjs` | ❌ Wave 0 |
| REG-04 | `buildLegs` sur copie : une bouée à confirmer n'apparaît ni dans les bords ni dans `passages` | unit | `tests/regmarks.test.mjs` | ❌ Wave 0 |
| ARCH-02 | `freezeAction`, `sealAt`, `sliceDays` (25 h, égalité de `modelPoints` / `scoreModels` / `consensus` à 9 h, 11 h 30, 23 h 30) | unit | `tests/gel.test.mjs` | ❌ Wave 0 |
| ARCH-02 | Stratégie compacte ≤ 12 Ko pour 15 bords ; positions en lat/lon ; entrées de `S` présentes | unit | `tests/gel.test.mjs` | ❌ Wave 0 |
| ARCH-02 | `/api/membre` : 401 sans code, prénom seul avec le code simulé, ni code ni empreinte, `no-store`, reste passant | unit (vrai middleware) | `tests/access.test.mjs` (✅ à compléter) | ✅ |
| ARCH-02 | `/api/ic` couverte par le test d'accès (énumération de `api/`) : 401 sans code | unit | `tests/access.test.mjs` (déjà énumérée) | ✅ |
| ARCH-02 | Garde statique : `init()` sans `await` avant `rt:ui` après l'ajout de la régate ; `fetch('/api/membre')` après la marque | garde statique | `tests/boot.test.mjs` (✅ à compléter) | ✅ |
| ARCH-04 | `segmentBreaks` / `breaksFromInstants` sur la trace SNPM : `[293]` ; trou de 40 s ne coupe pas ; `activeStats` (15,22 Nq, 3,55 h) | unit + fixture | `tests/segments.test.mjs` | ❌ Wave 0 |
| ARCH-04 | `trackDay` / `matchRegattas` : unique, heure, choix, proche, aucune, minuit de Paris | unit + fixture | `tests/attach.test.mjs` | ❌ Wave 0 |
| ARCH-04 | Non-régression : référence SNPM inchangée après les pauses ; `setTrace` ne relie pas les ponts (index de paires) | unit | `npm test` (`tests/reference.test.mjs` ✅) | ✅ |
| ARCH-04 | Import du même fichier deux fois : une seule trace (signature `start`, `n`) | unit | `tests/attach.test.mjs` | ❌ Wave 0 |
| ARCH-04 | Scénario bout en bout : importer la trace SNPM → rattachement → questionnaire du débrief pré-rempli | navigateur (Chromium) | script facultatif hors `npm test` | ❌ facultatif |
| ARCH-02 / REG-03 | Sélecteur de fichiers iPhone, lisibilité de la relecture, IA réelle | humain (iPhone, aperçu) | liste de recette | — |

### Sampling Rate
- **Par tâche :** le fichier de test du module touché (secondes).
- **Par vague :** `npm run check`.
- **Porte de phase :** `npm run check` vert + `node tools/stamp.mjs --check` sans avertissement + `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` (ouverture < 2 s conservée) + recette humaine sur l'aperçu avant `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/regates.test.mjs`, `tests/gel.test.mjs`, `tests/regmarks.test.mjs`, `tests/icverify.test.mjs`, `tests/icplaus.test.mjs`, `tests/icread.test.mjs`, `tests/segments.test.mjs`, `tests/attach.test.mjs`, `tests/regview.test.mjs`, `tests/apiic.test.mjs` : à créer depuis les prototypes
- [ ] Compléter `tests/access.test.mjs` (`/api/membre`), `tests/boot.test.mjs` (ordre d'`init`), `tests/pdf.test.mjs` (extraits de `parseIC`), `tests/racelock.test.mjs` (dates du verrou par régate)
- [ ] Fixtures fabriquées d'« autres clubs » : dériver du texte SNPM (`pdfText`, sous Node) des variantes dans le test (club renommé, `10h55` → `10:55`, `canal 72` → `VHF 69`, coordonnées de bouées en deg-min et en décimal) ; **ne pas** ajouter de PDF
- [ ] Aucune installation : cadre en place

### Recette humaine (iPhone et aperçu, fin de phase)
1. Créer une régate (nom, date, club) en moins d'une minute, avec le compte d'un autre équipier que Romain ; la voir « à venir » puis « aujourd'hui » (changer la date du téléphone ou créer la régate du jour).
2. Ajouter deux manches (heure + parcours) ; choisir une manche et vérifier que le parcours, la classe et l'heure de départ se calent.
3. Importer les IC SNPM (Fichiers) : relecture champ par champ, extraits visibles, puces de vraisemblance, rien retenu avant « Valider les IC » ; modifier une heure en `25:00` et constater l'alerte.
4. **IA réelle (aperçu)** : « Lire avec l'IA » sur les mêmes IC ; comparer à `parseIC` ; hors réseau (mode avion) : bouton désactivé avec le message.
5. Jour de régate : ouvrir l'app avant le départ puis après ; fiche : « vent figé à HH:MM », « scellé au signal » ; mode avion : le gel se fait quand même depuis le cache.
6. Importer la trace SNPM (ou une trace Open GPX Tracker avec une pause) : rattachement automatique, pas de ligne droite sur la pause, distance et durée actives, questionnaire du débrief pré-rempli, débrief tardif avec le vent figé.
7. Fiche : auteur de chaque élément (régate, manche, IC, bouées, gel, trace, débrief) ; premier lancement hors réseau : « — » puis complété.
8. Bouées d'un autre club (cas fabriqué) : « X1 ? » sur la carte, absentes du routage et du mode départ, présentes après « Confirmer ».
9. Version affichée dans l'aide, mise à jour différée, ouverture < 2 s en mode avion.

## Security Domain

`security_enforcement` est actif (absent ou `true`), ASVS niveau 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | accès par code existant (`middleware.js`), inchangé |
| V3 Session Management | non | cookie `rt_acces` inchangé |
| V4 Access Control | oui | `/api/ic` et `/api/membre` derrière le middleware (la première est couverte par l'énumération de `api/` dans `tests/access.test.mjs`, la seconde par un test ajouté) ; le prénom est une étiquette, **pas** une autorité (phase 4 : identité serveur) |
| V5 Input Validation | oui | serveur : méthode, taille (≤ 50 000 caractères), schéma strict, extrait et valeur vérifiés ; page : `esc()` / `textContent` pour tout texte venu du PDF, du modèle ou d'un nom de fichier ; `parseLatLon` pour les positions ; `JSON.parse` de `localStorage` sous `try` |
| V6 Cryptography | non | — |
| V7 Error Handling and Logging | oui | erreurs d'API bornées à 300 caractères ; `report()` pour les échecs de gel et d'import ; `scrub()` du journal déjà en place ; ne jamais journaliser le texte des IC ni un cookie |
| V8 Data Protection | oui | le texte d'IC part chez OpenAI (document public d'un club) sur **geste explicite** ; aucun cookie, aucun code, aucune position de l'équipage envoyés ; données de régate locales (partage = phase 4) |

### Known Threat Patterns for ce périmètre

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Injection de consignes dans le PDF | Tampering | texte déclaré donnée, sortie à schéma strict, aucune action ; extrait affiché ; vraisemblance ; validation humaine (risque résiduel écrit, Pitfall 5) |
| XSS via extrait, nom de bouée, nom de régate ou nom de fichier | Tampering | `esc()` (guillemets, apostrophe) et `textContent` ; test `linkedom` |
| Valeur plausible mais fausse présentée comme lue | Tampering | double vérification (extrait ∈ texte, valeur ∈ extrait) ; champ vidé sinon |
| Bouée d'IC utilisée avant confirmation | Tampering | jamais dans `MARKS` avant `Confirmer` ; test que `buildLegs` ne la voit pas |
| Fuite du code d'accès vers OpenAI ou dans `/api/membre` | Information disclosure | le corps envoyé est `{ text }` seulement ; test : aucun cookie dans les arguments du client simulé ; test : ni code ni empreinte dans la réponse de `/api/membre` |
| Dépense OpenAI abusive | Denial of service | accès réservé à trois équipiers, entrée ≤ 50 000 caractères, un appel par import, sortie ≤ 8 000 jetons ; plafond et quota = SECU2-01 (reporté) |
| Étiquette d'auteur falsifiée côté client | Spoofing | acceptée en phase 3 (trois équipiers de confiance, données locales) ; l'identité sera lue côté serveur en phase 4 (`api/_auth.js`, PITFALLS) |
| Stockage plein ou corrompu | Denial of service | `try/catch` autour de `localStorage` et d'IndexedDB, index borné (IC ≤ 20 000 caractères), échec consigné, l'app reste utilisable |

## Sources

### Primary (HIGH confidence)
- `/home/user/rade-tactique/js/*.js`, `api/*.js`, `middleware.js`, `vercel.json`, `index.html`, `tests/`, `tests/fixtures/` (IC SNPM, cahier de parcours, GPX SNPM), `data/meta.json`, `data/wx-snapshot.json` : lus et exécutés cette session (extraction du texte des deux PDF par le pdf.js vendorisé, mesures de la trace, des prévisions, de la stratégie sur le parcours 5).
- `.planning/phases/01-*/`, `02-*/` (résumés, `02-RESEARCH.md`), `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `.planning/research/PITFALLS.md` (pitfalls 10, 11, 12).
- 20 tests de prototypes exécutés (Node 22.22.0) : `regates` (3), `icverify` (4), `segments` (2), `attach` (3), `gel` (3), `api/ic` avec client simulé (4), `middleware /api/membre` (1) ; échec constaté puis corrigé sur la découpe des prévisions à 23 h 30.

### Secondary (MEDIUM confidence)
- [OpenAI : Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) : sous-ensemble de schémas (« up to 5000 object properties total, with up to 10 levels of nesting »), `strict: true`, `additionalProperties: false`, types union avec `null`, `status: "incomplete"` / `incomplete_details.reason: "max_output_tokens"`, refus.
- [Vercel : Adding a response header](https://vercel.com/kb/guide/add-response-header) : `next({ headers: { … } })` de `@vercel/functions` pour des en-têtes de réponse (rien sur `Set-Cookie`).
- `node_modules/@vercel/functions/middleware.js` : `next()` / `rewrite()` et `request.headers` ; pas de gestion spécifique des cookies.

### Tertiary (LOW confidence, à valider)
- Qualité de lecture de `gpt-5.5` sur des IC d'autres clubs, tarif et latence de `gpt-5.5` (A3, A4, A5) ; comportement d'Open GPX Tracker au-delà de la trace SNPM (A6) ; quota `localStorage` d'iOS (A7).

Les outils MCP de documentation (Context7, Exa, etc.) n'étaient pas disponibles : sources web via la recherche et la récupération de pages, puis exécution locale pour tout ce qui pouvait l'être.

## Release mechanics

- Après tout changement de l'app : `npm run stamp` (régénère le bloc de `sw.js` et `js/version.js`) ; les nouveaux fichiers de `js/` entrent seuls dans la liste hors réseau (`tools/stamp.mjs`, `DIRS = ['js', 'data', 'vendor', 'icons']`). `api/` n'est pas dans le SHELL.
- Publier : `npm run release -- "régates, vent figé, GPX rattaché"` (v28, note ≤ 80 caractères, sans `<` ni `>`) ; une seconde publication pour v29. `npm run check` (= `stamp --check` puis `npm test`) doit rester vert ; sur Vercel `npm ci && npm run gate` refuse une version fautive ; `RT_GATE_BYPASS=1` seulement en urgence.
- Aperçu : branche `apercu-phase-03` poussée **par Romain ou à sa demande** (cette recherche ne pousse rien) ; Romain relit sur l'aperçu, puis décide de la production à un moment calme ; l'adresse de l'aperçu se lit dans le tableau de bord Vercel.
- **Calendrier** (aujourd'hui lundi 19 octobre 2026) : gel visé **lundi 2 novembre** ; régate CVAT **samedi 7 au lundi 9 novembre** ; règle des 48 h : **plus de mise en production après jeudi 5 novembre au matin**, sauf correctif critique hors course. Les trois iPhone doivent appliquer la mise à jour **hors course** (bandeau) avant la recette.
- **Découpage proposé (MVP) :**
  - **v28, publiée au plus tard le 30 octobre** (aperçu vers le 28) : régates (création, statut, manches, liste par saison, fiche, reprise des fiches), verrou lisant les dates de la régate, relecture CVAT avec extraits et vraisemblance, auteur (`/api/membre`), gel automatique du vent, des relevés et de la stratégie, pauses de trace, rattachement du GPX et débrief pré-rempli avec le vent figé. C'est tout ce dont la régate CVAT du 7-9 novembre a besoin.
  - **v29, publiée au plus tard le 2 novembre (gel), dernier recours le 4 novembre** : `api/ic.js` (lecture IA d'un autre club) et bouées / parcours à confirmer. Additive : un nouveau point d'entrée et un bouton ; validée par l'essai réel de Romain sur l'aperçu (IC SNPM, Open Question 14). Si l'essai n'est pas concluant au gel : le code reste, le bouton « Lire avec l'IA » est masqué (une constante), et l'IA part après la régate sans retarder v28.
  - **Après la régate** : validation sur de vraies IC d'autres clubs (nouveaux cas de test, D-06), éventuel rattachement des anciennes traces, partage (phase 4).
- Guide de l'équipage (`guide.html`) et aide (`js/help.js`) à mettre à jour avec le renommage de l'onglet et les nouvelles fonctions (plan de publication, comme `02-05`).
- Ne rien écrire des codes d'accès ni des empreintes dans la note de version, les tests, le journal ou ce document.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH, aucune dépendance nouvelle, API du navigateur et outillage existants.
- Modèle de données, statut, verrou, gel, découpe des prévisions : HIGH (prototypes exécutés sur les vraies données du dépôt).
- Pauses de trace et rattachement : HIGH sur la trace SNPM (mesure : 2 segments, saut de 2 080 m, 16,34 → 15,22 Nq, 6,00 → 3,55 h), MEDIUM pour d'autres exports d'Open GPX Tracker (A6).
- Vérification des extraits : HIGH (mécanique testée sur le vrai texte SNPM, y compris les lettres espacées).
- Lecture IA d'un autre club : MEDIUM sur la conception (schéma, garde-fous, tests avec client simulé), **LOW** sur la qualité réelle du modèle et son coût (aucun appel réel possible ici, D-06).
- Auteur par `/api/membre` : HIGH sur le code et son test (vrai `middleware.js`), à confirmer sur l'aperçu pour l'intégration Vercel.
- Pitfalls : HIGH pour ceux reproduits ici (vent tardif, pauses, découpe de minuit, schéma strict), MEDIUM pour ceux tirés de documentation.

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (gel du code) ; le comportement de l'API OpenAI et de Vercel peut changer sans préavis.
