# Phase 8 : Espace Tofinou — rade de Bormes – Le Lavandou, Tofinou 9.5, accès séparé — Recherche

**Recherche faite le :** 2026-11-26
**Domaine :** cloisonnement « par espace » (tenant) d’une PWA sans build sur Vercel : codes d’accès, en-têtes posés par le middleware, archive Blob privée, quota d’IA, stockage du navigateur, service worker ; bateau et polaire par espace
**Confiance générale :** HAUTE pour l’inventaire (chaque ligne citée a été lue dans cette session, code de la branche = v43, `git diff --quiet 5e9b8a5 HEAD -- js api data middleware.js sw.js` vrai) ; MOYENNE pour l’architecture (conception cohérente avec le code, pas encore éprouvée) ; BASSE pour les comportements d’iPhone et de Vercel non essayés (marqués [ASSUMED])

> **Périmètre (consigne de l’orchestrateur).** Les données du plan d’eau de Bormes – Le Lavandou et la polaire du Tofinou 9.5 sont préparées par une autre étude : ce document ne les traite pas. Il couvre : A (inventaire de tout ce qui suppose un seul équipage, un seul bateau), B (architecture d’espaces et sécurité), C (bateau et polaire par espace : le branchement, pas les chiffres), D (vagues, risques, questions pour Romain).
>
> **Règles de ce document :** aucune empreinte de `middleware.js`, aucun code d’accès, aucun nom de modèle d’IA. La table des membres est décrite par sa structure seulement.

<user_constraints>
## Contraintes de l’utilisateur

Il n’existe pas de `08-CONTEXT.md` (pas encore de discuss-phase). Contraintes tirées de la demande de Romain transmise par l’orchestrateur, de `.claude/CLAUDE.md` et des décisions des phases précédentes :

### Décisions verrouillées
- Créer, **dans le même projet**, un **espace dédié à un Tofinou 9.5** naviguant en rade de Bormes / Le Lavandou, **partagé avec un code** pour y accéder.
- L’espace Tofinou n’a **pas accès aux régates de J80 de Toulon et de Brest** (archive, fiches, traces, débriefs, rapports, vents figés).
- **L’équipage de Naos ne voit aucun changement** : même archive `prod/light.json`, mêmes clés locales, même Toulon de la phase 7 (gardes `tools/gardes-toulon.mjs` vertes).
- App sans build, JavaScript sans framework, PWA hors réseau, hébergement Vercel (middleware, fonctions Node, Blob privé), IA par OpenAI seulement, interface en français.
- Aucun code d’accès en clair dans le dépôt, les journaux, les tests ni les documents ; seules les empreintes SHA-256 vivent dans `middleware.js`.
- Règle d’exploitation : pas de mise en production dans les 48 h avant une régate ni pendant ; régate de Toulon le 13 décembre 2026 (07-CONTEXT.md).

### À la discrétion de Claude (à faire valider)
- Forme de l’espace, adresse (même URL, sous-chemin, autre domaine), en-têtes, préfixes de l’archive, quotas, configuration reçue par l’app, séparation du stockage local, tests de cloisonnement, découpage en vagues.

### Hors périmètre de ce document
- Relief, côte, fonds, repères, vents et météo de Bormes – Le Lavandou ; polaire du Tofinou 9.5 (autre étude).

### Point de cadrage à faire acter
- `.planning/PROJECT.md` range aujourd’hui dans « Out of Scope » : « Ouverture à d’autres équipages ou au public — l’app reste réservée à l’équipage de Naos » [VERIFIED: .planning/PROJECT.md, section Out of Scope]. La phase 8 renverse ce choix pour un second équipage : à consigner dans « Key Decisions » au moment du contexte.
</user_constraints>

<phase_requirements>
## Exigences de la phase

Aucun identifiant n’a été fourni (la feuille de route dit « Requirements: TBD » [VERIFIED: .planning/ROADMAP.md:269-277]). Exigences proposées, à faire valider :

| ID | Description proposée | Ce que la recherche apporte |
|----|----------------------|-----------------------------|
| ESP-01 | Chaque code d’accès ouvre UN espace ; le serveur (middleware) en est la seule source ; les fonctions refusent une requête sans espace | § B.3 (middleware), § B.4 (fonctions), tests T1-T4 |
| ESP-02 | Archive, traces, rapports, vents figés, recalages et quotas d’un espace sont illisibles et inaltérables depuis un autre espace | § B.4 (préfixes), tests T5-T9 |
| ESP-03 | L’app d’un espace n’affiche que ses plans d’eau et ses régates ; aucune graine SNPM / GPEN hors de Naos ; packs d’un plan d’eau non ouvert refusés | § B.5, § B.6, tests T10-T12 |
| ESP-04 | Bateau par espace : nom, classe, longueur (règles de zone), tirant d’eau, polaire par défaut, pertes au virement | § C |
| ESP-05 | Naos identique à la v43 (fixtures capturées avant toute modification, gardes Toulon inchangées) | § D vague 0 |
| ESP-06 | Espace Tofinou installable à part (nom, icône), utilisable hors réseau sur Bormes | § B.2, § B.6 |
</phase_requirements>

## Résumé

L’app est construite pour **un seul équipage** à six niveaux : la **table des membres** du middleware (un objet « empreinte → prénom », trois lignes, `middleware.js:6-10`), l’**en-tête `x-rt-membre`** qui ne porte qu’un prénom (`middleware.js:87-92`), l’**archive Blob** rangée sous un préfixe qui ne dépend que de l’environnement (`prefix = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview')`, `api/archive.js:30`, recopié dans `api/_ia.js:31`), le **quota d’IA** compté par prénom sous ce même préfixe (`api/_ia.js:43-44`), les **consignes d’IA** écrites pour « un équipage de J80 » au CVAT ou au GPEN (`api/voice.js:12`, `api/debrief.js:12`, `api/rules.js:14-24`, `api/_gpen.js:139`, `api/ic.js:20`), et le **navigateur** : une seule origine, donc une seule série de clés `rade.*`, deux bases IndexedDB (`rade-regates`, `rade-traces`), un seul service worker et un seul cookie `rt_acces`. Côté app, le bateau est un J80 partout (polaire ORC par défaut `js/polar.js:1-22`, pertes au virement `js/router.js:17`, tirant d’eau `js/courant.js:144`, onglet « J80 » `index.html:78`, textes de règles « 24 m en J80 » `regles.html:170,427`), et deux fiches sont **semées sur tout appareil neuf** : Coupe SNPM (`js/regates.js:193`) et GPEN 2027 (`js/regates.js:153-176`).

Le risque de fuite le plus sérieux n’est pas côté serveur mais **côté navigateur** : à la première synchronisation, le téléphone envoie **toutes** les régates de son index local (`buildDoc`, `js/archsync.js`) puis les traces qu’elles référencent (`heavyPlan`, `js/archheavy.js:52-95`). Si un membre ouvrait l’espace Tofinou sur un navigateur qui a déjà servi à Naos **à la même adresse**, il pousserait les régates et les traces de Naos dans l’archive Tofinou, sans qu’aucune règle du serveur ne puisse le voir. D’où la recommandation : **une adresse (origine) distincte par espace**, servie par le **même déploiement** ; le navigateur sépare alors de lui-même stockage local, IndexedDB, caches, service worker et cookie.

**Recommandation principale :** un espace = une entrée d’un registre public `js/espaces.js` (nom, bateau, plans d’eau, graines) + une table d’empreintes dans `middleware.js` ; **le code décide de l’espace** (jamais l’app), le middleware pose `x-rt-espace` en écrasant toute valeur reçue, refuse un code sur l’adresse d’un autre espace, filtre les packs de plans d’eau ; les fonctions rangent tout sous `tofinou/<prod|preview>/…` (Naos reste `prod/…` octet pour octet) et refusent une requête sans espace ; l’espace Tofinou vit sur **un second domaine du même projet Vercel** ; deux codes pour Romain (un par espace, deux icônes), pas de bascule dans l’app. Vague 0 : figer Naos v43 avant toute modification.

## Carte des responsabilités

| Capacité | Niveau principal | Niveau secondaire | Raison |
|----------|------------------|-------------------|--------|
| Qui est membre, de quel espace | Middleware Vercel (`middleware.js`) | — | Seul endroit qui voit le code ; tout le reste reçoit un en-tête posé par lui |
| Espace d’une requête d’API | Middleware (en-tête `x-rt-espace`) | Fonctions (liste blanche, refus par défaut) | Jamais une valeur du client (corps, adresse, en-tête envoyé par la page) |
| Cloisonnement de l’archive et des quotas | Fonctions Node (`api/archive.js`, `api/_ia.js`) + Blob privé | — | Préfixe calculé côté serveur à partir de l’en-tête du middleware |
| Packs de plans d’eau autorisés | Middleware (liste par espace) | Page (n’en propose pas d’autres) | Fichiers statiques : seul le middleware peut les refuser |
| Configuration de l’espace (nom, bateau, plans d’eau) | Navigateur (`js/espaces.js`, public) | `/api/membre` (confirmation) | Rien de secret ; doit être connu de façon synchrone au démarrage, hors réseau |
| Séparation du stockage local | Navigateur (origine distincte) | Garde de l’app (espace confirmé avant tout envoi) | La même origine partage localStorage, IndexedDB, caches et cookie |
| Consignes d’IA par bateau et plan d’eau | Fonctions (tables fermées) | Page (identifiant de plan d’eau, filtré) | Jamais de texte libre dans une consigne |

## A. Inventaire : tout ce qui suppose un seul équipage, un seul bateau

Chaque ligne a été lue dans cette session. « Risque » = ce qui fuit ou casse si on ajoute un espace sans y toucher.

### A.1 Middleware (`middleware.js`)

| Fichier:ligne | Ce qui est écrit (structure ou verbatim) | Hypothèse « un seul équipage » | Risque |
|---------------|------------------------------------------|--------------------------------|--------|
| `middleware.js:1-3` | « Accès réservé à l'équipage de Naos (J80) : chaque équipier a un code personnel. » | Un seul équipage | Texte |
| `middleware.js:6-10` | `const EQUIPAGE = { … }` : trois lignes « empreinte SHA-256 du code → prénom » (Romain, Teiva, Thibaud) — empreintes non recopiées | Membre = prénom, sans espace | Un code Tofinou ajouté ici ouvrirait **tout** Naos |
| `middleware.js:11-12` | `const COOKIE = 'rt_acces';` ; `const MAX_AGE = 400 * 24 * 3600;` | Un seul cookie par adresse | Même adresse = un seul espace à la fois par navigateur |
| `middleware.js:16-18` | `matcher: ['/((?!acces\\.html$|acces\\.js$|manifest\\.webmanifest$|sw\\.js$|icons/|rapports/).*)']` | Manifeste et icônes communs, publics | Un manifeste par espace demande de faire entrer `manifest.webmanifest` dans le matcher (en le gardant public) |
| `middleware.js:20-25` | `membre(code)` : `code.trim().toLowerCase()`, SHA-256, `EQUIPAGE[hex] \|\| null` | Rend un prénom seul | À étendre : `{ prenom, espace }` |
| `middleware.js:44-51` | `NOMS_PUBLICS`, `FICHIER_DE_DOSSIER = /^\/(?:js|data|vendor|icons|rapports)\/[A-Za-z0-9][A-Za-z0-9._-]*$/`, `cheminDeLApp` | Tout membre voit tout `data/` | `data/brest.*` téléchargeable par tout membre de tout espace |
| `middleware.js:73` | le cookie porte le code normalisé (`HttpOnly; Secure; SameSite=Lax`) | — | Inchangé ; le cookie est propre à chaque nom d’hôte (pas d’attribut `Domain`) |
| `middleware.js:81` | `GET /api/membre` → `Response.json({ membre: prenom }, …)` | Le prénom suffit | À compléter par `espace` (un client v43 n’en lit pas plus : `js/app.js:2168-2180` ne lit que `.membre`) |
| `middleware.js:87-92` | pour `/api/` : `h.delete('cookie'); h.set('x-rt-membre', encodeURIComponent(prenom));` | Seul en-tête de confiance : le prénom | Les fonctions ne savent pas de quel espace vient l’appel |
| `middleware.js:100` | « Accès réservé à l’équipage. » | — | Texte neutre, gardable |

Le test d’accès lit la table par une expression (`/'([0-9a-f]{64})'\s*:\s*'([^']+)'/g`) et simule l’empreinte de la **première** ligne [VERIFIED: tests/helpers/codesimule.mjs:12-15] ; `tests/access.test.mjs:146` interdit toute réécriture, route ou redirection dans `vercel.json` [VERIFIED: tests/access.test.mjs:146] : tout ce qui dépend de l’hôte doit donc vivre dans le middleware, pas dans `vercel.json`.

### A.2 Archive partagée (`api/archive.js`, Blob privé)

| Fichier:ligne | Verbatim / structure | Risque |
|---------------|----------------------|--------|
| `api/archive.js:30` | `export const prefix = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview');` | Un seul arbre par environnement |
| `api/archive.js:233` | `const P = prefix(), path = \`${P}/light.json\`;` | **Un seul document léger** pour tous les membres |
| `api/archive.js:164-173` | objets lourds : `${P}/trace/${id}.json`, `${P}/report/${id}-${q.t}.json`, `${P}/day/${q.r}/${q.d}/${by}.json` (le PUT écrit sous le prénom du middleware, le GET lit le `by` demandé) | Un membre de n’importe quel espace lirait une trace de Naos par son identifiant |
| `api/archive.js:140-143` | suppressions copiées dans `${dir}trash/${t.id}-${t.t}.json` | Corbeille commune |
| `api/archive.js:74` | `doc.marks` : recalages des bouées, clés `MARK_KEY = /^\w{1,12}$/` (`:24`) | Recalages CVAT partagés à tout membre |
| `api/archive.js:68-70` | `venue` en liste blanche `VENUE_IDS` (`js/archmerge.js:18` : `['toulon', 'brest']`) | Liste unique, sans notion d’espace |
| `api/archive.js:218-220`, `:227-228` | prénom décodé, `NAME = /^[\p{L}\p{M} '’-]{1,40}$/u` ; sans prénom : `403 membre_inconnu` | Bon modèle de « refus par défaut » à reprendre pour l’espace |
| `api/archive.js:229` | magasin : `BLOB_READ_WRITE_TOKEN` ou `BLOB_STORE_ID` | Un seul magasin |

Le SDK accepte un `token` et un `storeId` par appel [VERIFIED: node_modules/@vercel/blob/dist/create-folder-BM6BTlko.d.ts:13-21] : un magasin séparé par espace est techniquement possible sans paquet nouveau.

### A.3 IA (`api/_ia.js`, `api/_gpen.js`, consignes)

| Fichier:ligne | Verbatim / structure | Risque |
|---------------|----------------------|--------|
| `api/_ia.js:15` | `export const QUOTA = 30;` (appels par équipier et par jour de Paris) | Par prénom seulement |
| `api/_ia.js:31` | même `prefix` qu’`api/archive.js` (parité vérifiée par `tests/apiia.test.mjs`, d’après le commentaire `api/_ia.js:9-11`) | Quota d’un « Romain » de Tofinou = quota du Romain de Naos (même fichier) |
| `api/_ia.js:43-44` | `cheminQuota = (P, who, ms) => \`${P}/quota/${jourParis(ms)}/${cle(who)}.json\`` | Idem |
| `api/_ia.js:102` | client OpenAI unique (`new OpenAI()`, clé `OPENAI_API_KEY`) | **Budget commun** (plafond du projet OpenAI, `docs/ia-budget.md`) |
| `api/_gpen.js:139` | « Bateau : J80, longueur de coque 8 m (zone = 24 m, deux longueurs = 16 m). » | Bateau en dur |
| `api/_gpen.js:142` | `export const venueOf = (body) => (body?.venue === 'brest' ? 'brest' : 'toulon');` | Plan d’eau lu dans le **corps** (liste fermée) ; un membre Tofinou pourrait demander les consignes GPEN |
| `api/rules.js:14-22` | bloc `CVAT` (« Bateau : J80, longueur de coque 8 m (zone = 24 m, deux longueurs = 16 m). », l. 22) | Bateau et club en dur |
| `api/rules.js:24`, `:53`, `:80`, `:112` | « l'arbitre de poche d'un équipage de J80 qui régate au CVAT » ; `CONSIGNES = { toulon: SYSTEM, brest: SYSTEM_BREST }` ; `instructions: CONSIGNES[venueOf(req.body)]` | Idem |
| `api/debrief.js:12`, `:22`, `:42`, `:59-60` | « l'entraîneur d'un équipage de J80 qui régate dans la rade de Toulon » ; « pourcentage de la polaire J80 » ; `CONSIGNES` ; `venue` retiré des faits | Idem |
| `api/voice.js:12`, `:44`, `:81` | « sur un J80 dans la rade de Toulon » ; `CONSIGNES` | Idem |
| `api/ic.js:11`, `:20` | `MAX_TEXT = 50000` ; « la fiche d’un équipage de J80 » | Idem |
| `tests/apiia.test.mjs:451` | « fixture des consignes de Toulon : capturée sur 56f6625, trois empreintes » | **Garde** : les consignes de Naos ne doivent pas bouger d’un octet |

### A.4 App (`js/`) : bateau, textes, graines, plans d’eau

| Fichier:ligne | Verbatim / structure | Pour un autre bateau / espace |
|---------------|----------------------|-------------------------------|
| `js/polar.js:1`, `:8`, `:17-22` | « Polaire J80 : certificat ORC One Design 2023 » ; `DEFAULT_SOURCE = 'ORC One Design 2023 (J-80 OD)'` ; `setPolar(tws, twa, bsp, source)` ; `resetPolar = () => setPolar(DEFAULT_TWS, DEFAULT_TWA, DEFAULT_BSP, DEFAULT_SOURCE)` | Défaut par espace ; « Réinitialiser » doit revenir à la polaire **de l’espace** |
| `js/app.js:134` | `if (S.polar) { try { setPolar(S.polar.tws, S.polar.twa, S.polar.bsp, S.polar.source); } … }` | Polaire personnelle déjà possible (import d’un `.pol` dans l’onglet J80, `js/app.js:2074-2080`, `parsePolar` `js/polar.js:26-38`) |
| `js/polar.js:82` | `trimAdvice(tws, gust)` : réglages J80 ; carte « Réglages J80 — … » (`js/app.js:885`) ; guide `js/tuning.js:1` | Propre au J80 : à masquer sans guide du bateau |
| `js/router.js:17` | `tackLoss = 9, gybeLoss = 6` (secondes) | Pertes du bateau |
| `js/courant.js:144` | `profondeurOk(A, P, tirant = 1.5, marge = 1.0)` | Tirant d’eau du bateau (seulement là où il y a marée et fonds : Brest) |
| `js/startmode.js:11` | `const J80 = 8; // longueur de coque (m)…` — **jamais utilisée** (2 occurrences de « J80 » dans le fichier : cette ligne et un commentaire, l. 71) ; relance `0.25` m/s² (l. 73) | Rien à changer pour la longueur ; `js/startmode.js` est figé par la garde (c) de `tools/gardes-toulon.mjs` (`DEPART`, l. 15) : **ne pas y toucher** |
| `index.html:7`, `:12`, `:78` | description « … routage J80 … » ; `apple-mobile-web-app-title` « Rade Tactique » ; onglet `data-tab="j80"` « J80 » | Nom de l’app et de l’onglet par espace |
| `js/debrief.js:527-607` | « Vitesse face à la polaire J80 », en-tête du rapport « Débrief · J80 · Rade Tactique » | Classe du bateau |
| `js/help.js:12`, `:90`, `:124` | aide « en J80 : la rade de Toulon (CVAT) et la rade de Brest (GPEN) » ; « envoyez-le à Romain » | Textes par espace |
| `regles.html:170`, `:336`, `:427` | « 3 longueurs, 24 m en J80 », « deux longueurs (16 m en J80) » | Longueur du bateau |
| `js/regles.js:10-11`, `:17` | plan d’eau lu dans `rade.state` (`venue === 'brest'`) ; « IC du GPEN » / « IC CVAT » | Espace et plan d’eau |
| `js/regates.js:7`, `:19` | `import { IC as SNPM } from './courses.js'` ; `COMMON = { sequence: SNPM.sequence, classes: SNPM.classes, groups: SNPM.groups }` mêlé à **toute** fiche par `icOf` | Pavillons de classe CVAT proposés à une régate Tofinou |
| `js/regates.js:193` | `migrate` : sans index, sème `{ id: 'snpm-2026', ...SNPM, … }` | **Graine SNPM sur tout appareil neuf** |
| `js/regates.js:114-176` | `GPEN_ID = 'gpen-2027'`, `GPEN_IC`, `gpenSeed()` (`venue: 'brest'`), `seedGpen` + marqueur `rade.seed.gpen.v1` | **Graine GPEN sur tout appareil** |
| `js/app.js:81-85` | `migrate`, `seedNorm`, `seedGpen` appelés au chargement du module | Point d’entrée des graines |
| `js/venues.js:12-43` | `TOULON` (par référence à `js/courses.js`), `VENUES = { toulon, brest }`, `VENUE_IDS = ['toulon', 'brest']` | Tous les plans d’eau proposés à tout appareil |
| `js/venues.js:46` | `bootVenue = (st) => (… Object.hasOwn(VENUES, st.venue) ? st.venue : 'toulon')` | Défaut Toulon, sans espace |
| `js/lieu.js:8`, `:13`, `:17-26` | `export let VENUE = VENUES.toulon;` ; `venueBody` ; `setVenue` (un seul changement d’origine par session) | Le plan d’eau par défaut doit venir de l’espace |
| `js/app.js:62-63` | `setVenue(bootVenue(store.get('rade.state', {})));` puis `configureWeather(VENUE.weather)` | Démarrage synchrone : l’espace doit être connu **avant** cette ligne, hors réseau |
| `js/app.js:2502-2513` | `venueMissing` : « Revenir à la rade de Toulon » | Sans objet pour un espace sans Toulon |
| `js/regview.js:95-96` | formulaire : `VENUE_IDS.map(…)` (tous les plans d’eau) | Plans d’eau de l’espace seulement |
| `js/marks.js:6`, `:90` | `OV_KEY = 'rade.marks.v1'` ; `NUM_KEY = /^\d+$/` (recalage CVAT) | Toulon seulement (D-12 de la phase 7) |

Fichiers statiques et publics : `acces.html:33` « Application réservée à l’équipage de **Naos** (J80). », `:36` (exemple de format de code, non recopié ici), `:37` « demandez-le à Romain » ; `manifest.webmanifest:2-4` « Rade Tactique — Toulon », description « Rade de Toulon en 3D … parcours CVAT, routage J80 » ; `guide.html` (lien personnel « reçu de Romain », l. 136, 179 ; budget, journal, l. 520-610) ; `rapports/coupe-snpm-2026.html` est **public** (hors middleware, `middleware.js:16-18`) : le rapport de la Coupe SNPM de Naos est lisible par n’importe qui, membre Tofinou compris — état actuel, à garder ou retirer (question 14).

### A.5 Navigateur : stockage, cache, service worker (collisions sur une même adresse)

Relevé exhaustif par recherche des clés dans `js/`, `sw.js`, `index.html`, `acces.js` [VERIFIED: grep de `'rade[.-]…'` dans cette session] :

| Clé / base | Fichier:ligne | Collision si les deux espaces partagent une adresse |
|------------|---------------|-----------------------------------------------------|
| `rade.state` | `js/app.js:62`, `:129` (persist) | Plan d’eau, polaire personnelle, réglages : la polaire du Tofinou s’appliquerait à Naos et inversement |
| `rade.regates.v1` (+ `.bak`) | `js/regates.js:11`, `js/app.js:2206` | **Fuite** : envoyée en entier à la première synchronisation de l’autre espace |
| `rade.sync.v1` | `js/app.js:105` | Révision et file d’envoi d’une autre archive |
| `rade.membre.v1` | `js/regates.js:13` | Mauvais auteur hors réseau |
| `rade.marks.v1` | `js/marks.js:6` | Recalages CVAT |
| `rade.seed.gpen.v1` | `js/regates.js:117` | Marqueur de graine |
| `rade.timer.v1`, `rade.racelock` | `js/app.js:150`, `:1022` | Chrono et verrou de course d’un autre bateau |
| `rade.reprise.v1`, `rade.venue.reopen`, `rade.welcome`, `rade.diag.v1` | `js/app.js:2290`, `:89`, `js/help.js:147`, `js/diag.js:5` | Journal de diagnostic mélangé |
| `rade.wx.v1`, `rade.wx.brest.v1` | `js/venues.js:26`, `js/venue-brest.js:257` | Cache des prévisions (sans gravité) |
| `rade.events.v1` (lecture seule) | `js/regates.js:14` | Reprise d’anciennes fiches |
| IndexedDB `rade-regates` | `js/regstore.js:5` | Vents figés et stratégies |
| IndexedDB `rade-traces` | `js/track.js:7` | **Fuite** : traces envoyées si une régate de l’index les référence (`js/archheavy.js:70-78`) |
| Caches `rade-<id>`, `rade-venue-<id>-<pack>` | `sw.js:9`, `js/pack.js:7` | Packs d’un plan d’eau non ouvert déjà présents |
| Service worker | `sw.js` | Un seul par adresse |
| Cookie `rt_acces` | `middleware.js:11` | Un seul code actif par adresse et par navigateur |

`sw.js` : `SHELL` contient les fichiers de Toulon (`"data/basemap.jpg","data/coast.json","data/cover.bin",…,"data/terrain.bin",…`, `sw.js:10`) et l’installation échoue si **un seul** fichier du SHELL est refusé (`c.addAll(SHELL.map(…))`, `sw.js:14`) [VERIFIED: sw.js:10-14]. Conséquence directe : **refuser les données de Toulon à un espace oblige à lui donner un SHELL sans elles**, sinon son app ne s’installe plus hors réseau. `tools/stamp.mjs:13-14` (`ROOT_FILES`, `DIRS = ['js', 'data', 'vendor', 'icons']`) met dans le SHELL tout `data/` sauf les packs annoncés par `data/<id>.meta.json` (`:38-51`).

### A.6 Ce qui est commun et le restera (à dire franchement)

Le code de l’app (`js/*.js`) est **le même pour tous** et chargé statiquement : `js/venues.js:5-6` importe `js/courses.js` (catalogue CVAT et IC de la Coupe SNPM, figés par la garde SNPM `f80c365`) et `js/venue-brest.js` ; `js/regates.js` contient `GPEN_IC`. Tout membre connecté de **n’importe quel espace** peut donc lire ces fichiers, comme il peut lire la liste des fichiers des packs dans `data/venues.json`. Ces contenus sont tirés de documents publiés par les organisateurs (IC du CVAT, IC du GPEN sur agpen.fr) et de données ouvertes (OpenStreetMap, EMODnet, Shom) ; ils ne sont pas des données de Naos. **Ce qui est propre à Naos et doit être cloisonné, c’est l’archive** (régates, manches, IC validées, bouées confirmées, recalages, vents figés, stratégies, traces, débriefs, rapports, corbeille) **et les compteurs**. « Ne pas obtenir les graines SNPM / GPEN » se traduit donc par : jamais semées dans l’espace Tofinou, jamais acceptées dans son archive, jamais affichées — pas par un secret du code. Si Romain veut que même le code des catalogues soit inaccessible, il faut un second projet Vercel (option D ci-dessous) et retirer ces modules du chargement statique, ce qui touche à des fichiers figés : déconseillé.

## B. Architecture proposée : les espaces

### B.1 Modèle

```
Espace = {
  id          : 'naos' | 'tofinou'             (liste fermée, minuscules, ni 'prod' ni 'preview')
  nom         : nom affiché (« Naos », « <à choisir> »)
  app         : nom de l’app installée (« Rade Tactique » pour Naos, inchangé)
  bateau      : { nom, classe, longueur_m, tirant_m, polaire, virement_s, empannage_s, reglages }
  venues      : plans d’eau ouverts (Naos : ['toulon', 'brest'] ; Tofinou : ['<id de Bormes>'])
  venueDefaut : plan d’eau au premier lancement
  graines     : fiches semées (Naos : SNPM et GPEN ; Tofinou : aucune par défaut)
  recalage    : recalage partagé des bouées fixes (Naos : Toulon seulement, D-12 ; Tofinou : non)
  membres     : SEULEMENT dans middleware.js, sous forme d’empreintes (jamais dans js/)
}
```

Trois endroits, chacun avec sa part et un test de parité entre eux :
1. `middleware.js` : tables d’empreintes par espace, hôtes connus par espace, packs autorisés par espace.
2. `api/_espace.js` (nouveau, sans dépendance, nom en « _ » : pas une route) : liste blanche des identifiants, `espaceDe(entete)`, `prefixe(espace)`, politique serveur (plans d’eau acceptés dans l’archive, identifiants réservés, recalages acceptés, quota, variable de clé d’IA).
3. `js/espaces.js` (nouveau, public, dans le SHELL) : tout ce que l’app affiche (nom, bateau, plans d’eau, graines), et `bootEspace(hote, stockage)`.

### B.2 Adresse : comparaison des options

| Option | Stockage du navigateur | Installation (icône, nom) | Romain dans les deux | Coût et risque pour Naos | Verdict |
|--------|------------------------|---------------------------|----------------------|--------------------------|---------|
| **A. Même URL, espace choisi par le code** | **Partagé** (A.5) : il faut préfixer une vingtaine de clés et deux bases dans une dizaine de modules ; un oubli = fuite (régates et traces poussées dans l’autre archive) | Une seule icône, un seul nom | Bascule = changer de cookie + recharger ; données des deux espaces sur le même téléphone | Toucher `js/app.js`, `js/regates.js`, `js/track.js`, `js/regstore.js`… : risque élevé sur Naos | Déconseillé |
| **B. Sous-chemin `/tofinou/`** | **Partagé** (même origine) | Portée de service worker séparable, mais l’app sert `./`, `data/…`, `/api/…` en chemins relatifs ou racine, sans build | Comme A | Middleware à une seule profondeur (`FICHIER_DE_DOSSIER`), `index.html` à dupliquer | À écarter |
| **C. Second domaine, même projet, même déploiement** (recommandé) | **Séparé par le navigateur** (origine distincte : localStorage, IndexedDB, Cache Storage, service worker, cookie sans `Domain`) | Une icône et un nom par espace | Deux codes, deux icônes ; aucune bascule à écrire | Un déploiement, une porte, une version ; Naos garde son adresse et ses clés | **Recommandé** |
| **D. Second projet Vercel sur le même dépôt** | Séparé | Séparé | Comme C | Isolation maximale (magasin Blob, clé d’IA, journaux, variables propres) mais deux mises en production à tenir synchrones, deux aperçus, risque de versions décalées | Repli si Romain veut une séparation totale |

Le second domaine peut être un nom `….vercel.app` ajouté au projet (Settings → Domains ; « les noms .vercel.app ne se réservent pas, premier arrivé premier servi ») [CITED: vercel.com/docs/domains/working-with-domains/add-a-domain] ou un sous-domaine d’un domaine de Romain ; la disponibilité d’un nom précis n’a pas été vérifiée [ASSUMED]. L’adresse de production actuelle est `https://rade-tactique.vercel.app` [VERIFIED: .planning/phases/05-avant-la-regate/05-03-SUMMARY.md:94].

**Aperçus :** l’adresse d’un aperçu (`…-git-<branche>-….vercel.app`) n’est pas connue d’avance. Règle : **sur un hôte connu, l’espace de l’hôte doit être celui du code** ; **sur un hôte inconnu (aperçu, adresse d’un déploiement), l’espace est celui du code**. La sécurité vient toujours du code ; l’hôte ne sert qu’à séparer le stockage. Sur un aperçu partagé entre les deux espaces, la garde de l’app (B.5) empêche tout envoi croisé.

### B.3 Middleware

Structure proposée (aucune empreinte réelle, hôtes à choisir) :

```javascript
// middleware.js (esquisse) — la table de Naos garde sa forme et son nom (tests/helpers/codesimule.mjs la lit par expression)
const EQUIPAGE = { '<empreinte>': 'Prénom', /* … trois lignes inchangées … */ };    // espace naos
const TOFINOU  = { '<empreinte>': 'Prénom', /* … */ };                              // espace tofinou (vide tant que Romain n’a pas créé les codes)
const ESPACES = {
  naos:    { table: EQUIPAGE, hotes: ['rade-tactique.vercel.app'], packs: ['brest'] },
  tofinou: { table: TOFINOU,  hotes: ['<domaine Tofinou>'],        packs: ['<id de Bormes>'] },   // [ASSUMED] noms à fixer
};
// membre(code) → { prenom, espace } | null ; une empreinte présente dans deux tables est une erreur (test)
// espaceDeLHote(host) → id | null (hôte inconnu : aperçu)
```

Déroulé, dans l’ordre (ce qui change par rapport à `middleware.js:64-104`) :
1. `GET /manifest.webmanifest` (et l’icône Apple) sur un hôte d’espace autre que Naos : `rewrite()` vers `manifest-tofinou.webmanifest`, **avant** l’authentification (le manifeste reste public). `rewrite` existe dans le paquet déjà installé : `export declare function rewrite(destination: string | URL, init?: ExtraResponseInit): Response;` [VERIFIED: node_modules/@vercel/functions/middleware.d.ts:80]. Le matcher doit alors laisser passer `manifest.webmanifest` au middleware (`middleware.js:17`), avec mise à jour des tests publics (`tests/access.test.mjs:38-50`). Sur l’hôte de Naos : rien ne change.
2. `?acces=CODE` : `membre(code)` ; sur un hôte connu d’un autre espace → même refus que pour un code inconnu (`/acces.html?erreur=1…`), sans dire que le code existe ailleurs.
3. Cookie : même contrôle « espace du code = espace de l’hôte connu » ; sinon refus.
4. `GET /api/membre` → `{ membre, espace }` (`no-store`).
5. Packs : un fichier `data/<id>.*` d’un plan d’eau qui n’est pas dans `ESPACES[espace].packs` → **même 404 sans écho** que les fichiers internes (`introuvable`, `middleware.js:54-60`) : aucune différence de réponse ne dit qu’un pack existe.
6. `/api/` : `h.delete('cookie'); h.set('x-rt-membre', …); h.set('x-rt-espace', espace);` — `set` écrase toute valeur envoyée par la page ; Naos reçoit `x-rt-espace: naos`.

Pour tester sans vrai code : exporter une fabrique `creerMiddleware({ espaces })` utilisée par l’export par défaut, que les tests appellent avec des tables d’empreintes **calculées dans le test** à partir de faux codes (comme `tests/helpers/codesimule.mjs`, aucun vrai code).

### B.4 Fonctions : préfixe d’espace côté serveur uniquement

```javascript
// api/_espace.js (esquisse) — règle de Naos recopiée d’api/archive.js:30
export const ESPACE_IDS = ['naos', 'tofinou'];
const env = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview');
export const espaceDe = (h) => (typeof h === 'string' && ESPACE_IDS.includes(h) ? h : null);   // absent, inconnu, casse différente → null → 403
export const prefixe = (e) => (e === 'naos' ? env() : `${e}/${env()}`);                       // Naos : 'prod' / 'preview', octet pour octet
```

- `api/archive.js` : `const espace = espaceDe(req.headers?.['x-rt-espace']); if (!espace) return 403 'espace_inconnu'` à côté du contrôle du prénom (`:227-228`) ; `P = prefixe(espace)` partout où il y a `prefix()` (`:233`, `heavyPath`, corbeille). Les identifiants valides (`ID = /^[A-Za-z0-9._-]{1,80}$/`, `safeId` refuse `..`, `api/archive.js:24`, `:161`) ne contiennent pas de `/` : aucune requête de Tofinou ne peut construire un chemin sous `prod/`, et aucune de Naos un chemin sous `tofinou/`.
- Politique de l’archive par espace (dans `cleanDoc`, `api/archive.js:49-76`) : une régate dont le plan d’eau (`venueOf`, absent = Toulon) n’est pas ouvert à l’espace est **refusée (400)** ; les identifiants `snpm-2026` et `gpen-2027` sont refusés hors de Naos ; `doc.marks` est vidé hors de Naos. Effet : même si un téléphone tentait de pousser des régates de Naos dans l’archive Tofinou (régates de Toulon sans champ `venue`, GPEN à Brest), le serveur les refuserait.
- `api/_ia.js` : `compte({ P: prefixe(espace), … })` → quota par espace et par prénom ; `QUOTA` par espace ; clé OpenAI par espace (`OPENAI_API_KEY` pour Naos ; variable propre à Tofinou, **sans repli sur celle de Naos** : absente → 503 `no_key`, l’IA Tofinou ne consomme jamais le budget de Naos).
- Consignes : `espace === 'naos' ? CONSIGNES[venueOf(req.body)] : CONSIGNES_TOFINOU[venueTofinou(req.body)]` — le chemin de Naos reste l’expression actuelle (empreintes `tests/apiia.test.mjs:451` inchangées) ; pour Tofinou, une table fermée par plan d’eau ouvert, texte fixe (bateau, longueur, plan d’eau), jamais complété par une valeur reçue ; un `venue: 'brest'` envoyé par un membre Tofinou est ignoré.
- `api/_espace.js` est importé par `api/archive.js` et `api/_ia.js` (comme `api/_gpen.js` l’est déjà par trois fonctions) : la parité recopiée aujourd’hui (`api/_ia.js:9-11`) devient une seule source, et un test compare `ESPACE_IDS` à `middleware.js` et `js/espaces.js`.

### B.5 App : configuration de l’espace, sans build

- `js/espaces.js` (public) : registre `ESPACES` (B.1 sans les membres) et `HOTES` ; `bootEspace(hote, st)` : hôte connu → son espace ; sinon `rade.espace.v1` (écrite **seulement** pour un espace autre que Naos) ; sinon `'naos'`. Naos : aucune clé nouvelle écrite, aucune lecture réseau nouvelle au démarrage.
- `js/espace.js` (espace courant, exports vivants comme `js/lieu.js`) : `setEspace` appelé **avant** `setVenue` (`js/app.js:62`) ; `bootVenue` borné à `ESPACE.venues`, défaut `ESPACE.venueDefaut`.
- `refreshMembre` (`js/app.js:2168-2180`) lit aussi `espace` : différent de l’espace de démarrage → **aucune synchronisation** (ni léger ni lourd) tant que ce n’est pas réglé ; si l’appareil n’a aucune donnée locale, il adopte l’espace du serveur et recharge ; sinon message « Cet appareil contient les données d’un autre espace ». Sur les hôtes connus, le middleware rend ce cas impossible ; la garde couvre les aperçus.
- Graines : `migrate` (`js/regates.js:193`), `seedNorm`, `seedGpen` (`js/app.js:81-85`) ne sèment que les fiches de `ESPACE.graines` ; `COMMON` (`js/regates.js:19`) n’est mêlé qu’aux fiches de Toulon.
- Plans d’eau : carte « Plan d’eau », formulaire (`js/regview.js:95-96`), « Passer » et `venueMissing` (`js/app.js:2502-2513`, bouton « Revenir à la rade de Toulon » seulement si Toulon est ouvert) limités à `ESPACE.venues`. Le premier lancement télécharge le pack du plan d’eau par défaut (déjà fait par `venueReady`, `js/app.js:2491-2499`, quand le réseau est là — c’est toujours le cas à la première ouverture, qui demande le code).
- Textes : titre et `apple-mobile-web-app-title` posés au démarrage depuis l’espace (iPhone : le nom proposé à « Sur l’écran d’accueil » reste modifiable par l’utilisateur) [ASSUMED : lecture des balises modifiées par script à l’ajout] ; `acces.js` adapte la phrase d’accueil à l’hôte (Naos : texte actuel) ; `js/regles.js` ajoute en tête de `regles.html` une note « zone = 3 longueurs = … m » pour un bateau autre que le J80 (texte de Naos inchangé).

### B.6 Packs de plans d’eau et liste hors réseau

- **Brest et Bormes** sont des packs hors SHELL (règle `data/<id>.meta.json`, `tools/stamp.mjs:38-51`) : les refuser à un espace ne touche pas au service worker. Recommandé.
- **Toulon** est dans le SHELL (`sw.js:10`) : le refuser à Tofinou demande une liste hors réseau par espace (bloc généré par `tools/stamp.mjs`, choisie par le worker d’après le paramètre de son adresse d’inscription, par exemple `sw.js?e=tofinou`), donc une modification de `sw.js` et de `tools/stamp.mjs` — le fichier le plus risqué pour l’ouverture hors réseau des téléphones de Naos (07-RESEARCH § Risques). Défaut proposé : **ne pas refuser Toulon en v1** (données d’origine publique, environ 2,5 Mo chargés en plus par l’app Tofinou à chaque version), la liste par espace étant une vague facultative (question 6).

### B.7 Schéma

```
Lien personnel  https://<hôte de l’espace>/?acces=CODE
   │
   ▼
Middleware ── empreinte du code ─► { prénom, espace }  (inconnu → acces.html)
   │            hôte connu d’un autre espace ? → refus (même réponse qu’un code inconnu)
   │            cookie rt_acces (propre à cet hôte)
   ├─ /manifest.webmanifest → manifeste de l’espace (public)
   ├─ data/<pack>.*  pack non ouvert à l’espace → 404 sans écho
   ├─ /api/membre → { membre, espace }
   └─ /api/*  en-têtes écrasés : x-rt-membre, x-rt-espace (cookie retiré)
                 │
                 ▼
        Fonctions : espace en liste blanche (sinon 403)
                 ├─ archive : Blob  naos → prod/…   tofinou → tofinou/prod/…
                 │             politique : plans d’eau de l’espace, ids réservés, recalages
                 └─ IA : quota tofinou/prod/quota/<jour>/<prénom>.json, clé et consignes de l’espace
Navigateur (une origine par espace)
   js/espaces.js → setEspace → setVenue (plan d’eau de l’espace) → polaire et textes du bateau
   refreshMembre : espace du serveur ≠ espace de démarrage → synchronisation bloquée
```

## C. Bateau et polaire par espace

- **Polaire par défaut.** `js/polar.js` ne connaît qu’un défaut (ORC J80, l. 5-8). Ajouter une fonction qui remplace **le défaut** (et donc la cible de `resetPolar`, l. 22), appelée au démarrage seulement si l’espace a sa propre polaire ; Naos ne l’appelle jamais (routes et analyses de Naos identiques, gardées par `tests/toulon.test.mjs`). La table du Tofinou 9.5 viendra de l’autre étude, sous la même forme que `js/polar-orc.js` (`ORC_TWS`, `ORC_TWA`, `ORC_BSP`), en module JS : lu de façon synchrone, sans requête. Une polaire importée par l’équipier (`S.polar`, `js/app.js:134`) garde la priorité, comme aujourd’hui. **Dès aujourd’hui**, sans rien coder, un fichier `.pol` du Tofinou peut être importé dans l’onglet J80 (`parsePolar`, `js/polar.js:26-38`) : utile pour un essai, mais « Réinitialiser » revient au J80.
- **Longueur et règles de zone.** Aucun calcul de l’app n’utilise la longueur : `const J80 = 8` est inutilisée (`js/startmode.js:11`) ; la longueur n’apparaît que dans les textes (`regles.html:170,336,427`) et les consignes d’IA (« zone = 24 m, deux longueurs = 16 m », `api/rules.js:22`, `api/_gpen.js:139`). Pour Tofinou : longueur dans `ESPACES.tofinou.bateau`, textes calculés (zone = 3 × longueur, deux longueurs = 2 × longueur) dans les consignes Tofinou et la note de `regles.html`. Longueur de coque du Tofinou 9.5 : 9,5 m d’après le nom de la série [ASSUMED] — à confirmer par l’autre étude ou par Romain (la zone se mesure en longueurs de coque).
- **Autres réglages du bateau.** Pertes au virement et à l’empannage (`js/router.js:17`, 9 s et 6 s pour le J80) à passer par `routeOpts` (`js/tactics.js:264-268`) pour Tofinou seulement ; tirant d’eau (`js/courant.js:144`) seulement si un plan d’eau à marée lui est ouvert ; relance au départ `0.25` m/s² (`js/startmode.js:73`) gardée (module figé, approximation à noter dans le guide Tofinou).
- **Classe et textes.** Onglet « J80 » → classe de l’espace ; carte « Réglages J80 » et guide de réglage (`js/tuning.js`) masqués si `bateau.reglages` est faux ; débrief « polaire J80 » → classe ; en-tête du rapport. Consignes Tofinou : « équipage de <classe> », plan d’eau de Bormes (texte fourni avec les données du plan d’eau), IC types de la classe si Romain les donne.

## D. Livraison, risques, questions

### D.1 Vagues

Calendrier : aujourd’hui 26 novembre 2026 ; régate de Toulon le 13 décembre ; règle des 48 h → production au plus tard le jeudi 10 décembre. Les vagues 1 et 2 touchent le middleware, l’archive et le démarrage de l’app, c’est-à-dire Naos : **défaut proposé, mise en production après le 13 décembre** (aucune régate de Tofinou n’est annoncée), tout sur l’aperçu `apercu-phase-08` avant.

| Vague | Contenu | Touche Naos ? | Dépend de |
|-------|---------|---------------|-----------|
| **0 — Gel Naos v43** | Capturer sur `5e9b8a5` (v43, code identique à la branche) **avant toute modification** : réponses du middleware pour un code Naos simulé (statut, cookie, en-têtes remplacés, corps de `/api/membre`) ; chemins Blob écrits par un scénario Naos sur faux Blob (`prod/light.json`, `prod/trace/…`, `prod/report/…`, `prod/day/…`, `prod/quota/…`, `prod/trash/…`) et documents écrits ; empreintes des consignes des **quatre** fonctions d’IA (les trois de `tests/apiia.test.mjs:451` + `api/ic.js`) ; liste des clés de stockage et du SHELL ; `tests/naos.test.mjs` + garde « espace Naos » ajoutée à `tools/gardes-toulon.mjs` | non (ajouts de tests) | — |
| **1 — Serveur cloisonné, inerte pour Naos** | `api/_espace.js` ; `api/archive.js` et `api/_ia.js` lisent `x-rt-espace` (refus par défaut) ; table `TOFINOU` **vide** ; `x-rt-espace: naos` ; `/api/membre` → `{ membre, espace }` ; filtre des packs ; fabrique `creerMiddleware` ; tests T1-T9 | oui (code) ; résultats identiques (fixtures vague 0) | 0 |
| **2 — App consciente de l’espace** | `js/espaces.js`, `js/espace.js`, démarrage, plans d’eau limités, graines par espace, garde « autre espace », bateau (polaire par défaut, pertes, libellés, réglages masqués), textes (titre, `acces.js`, note de `regles.html`), `manifest-tofinou.webmanifest`, icônes, réécriture du manifeste | oui (démarrage) ; vues identiques (`vue-toulon-v42`, scénarios existants) | 1 |
| **3 — Espace Tofinou branché** | pack de Bormes et polaire (autre étude) ; consignes d’IA Tofinou ; clé d’IA et quota Tofinou ; domaine ajouté au projet (Romain) ; codes créés par un outil qui **affiche une fois** le code et le lien et n’écrit que l’empreinte (jamais de fichier avec le code) ; scénarios navigateur Tofinou | non (fichiers et entrées nouveaux) | 2 + autre étude |
| **4 — Mise en ligne** | aperçu ; preuve de cloisonnement sur l’aperçu avec un code Tofinou (archive vide, `data/brest.*` 404, pas de graines) ; installation des deux apps sur iPhone ; production sur « publie » de Romain ; liens envoyés aux membres Tofinou | — | 3 |

### D.2 Tests qui prouvent le cloisonnement

| # | Test | Où |
|---|------|----|
| T1 | Code Tofinou simulé : `x-rt-espace` vaut `tofinou` même si la requête envoie `x-rt-espace: naos` et `x-rt-membre: Usurpateur` (liste `x-middleware-override-headers` contrôlée, comme `tests/access.test.mjs:178-190`) | `tests/access.test.mjs` |
| T2 | Code Tofinou sur l’hôte de Naos (et l’inverse) : même réponse qu’un code inconnu, aucun cookie posé | idem |
| T3 | Fonctions sans `x-rt-espace`, avec un espace inconnu, `__proto__`, casse différente : 403, rien lu ni écrit | `tests/apiarchive.test.mjs`, `tests/apiia.test.mjs` |
| T4 | Empreinte présente dans deux tables : erreur ; tables et `ESPACE_IDS` identiques dans `middleware.js`, `api/_espace.js`, `js/espaces.js` | `tests/espaces.test.mjs` |
| T5 | Faux Blob rempli des objets de Naos (`prod/light.json`, traces, rapports, jours, corbeille) : en Tofinou, `GET light` rend un document vide, `GET trace|report|day` de chaque identifiant de Naos → 404 ; aucun chemin hors de `tofinou/` n’est lu ni écrit (journal des appels du faux Blob) | `tests/apiarchive.test.mjs` |
| T6 | Naos : chemins et documents écrits **identiques** à la fixture v43 | idem |
| T7 | PUT Tofinou d’une régate sans `venue` (Toulon), à Brest, `snpm-2026`, `gpen-2027`, avec `marks` : refusé ou vidé ; régate de Bormes acceptée | idem |
| T8 | Quota : un « Romain » de Tofinou et le Romain de Naos ont deux compteurs ; 31e appel Tofinou refusé sans toucher Naos ; clé Tofinou absente → 503 | `tests/apiia.test.mjs` |
| T9 | Consignes : empreintes de Naos inchangées ; consignes Tofinou sans « Naos », « CVAT », « GPEN », « J80 » ; `venue: 'brest'` d’un membre Tofinou ignoré | idem |
| T10 | `data/brest.*` (et `data/<Bormes>.*` pour Naos, si décidé) : 404 identique à un fichier interne ; tout le SHELL de l’espace reste servi (l’installation hors réseau ne casse pas) | `tests/access.test.mjs` |
| T11 | Appareil neuf, espace Tofinou : index sans `snpm-2026` ni `gpen-2027`, aucun marqueur `rade.seed.gpen.v1` ; Naos : graines comme en v43 | `tests/regates.test.mjs` |
| T12 | Garde « autre espace » : `/api/membre` rend un autre espace → aucun appel à `/api/archive` ; scénario navigateur | `tests/archsync.test.mjs`, `tools/regate-e2e.mjs` |

### D.3 Risques

- **Envoi croisé depuis le navigateur** (A.5) : origine distincte (C) + refus serveur des régates hors espace (B.4) + garde de l’app (B.5) ; T5, T7, T12.
- **Quota Blob commun** : sur le plan Hobby, 2 000 opérations avancées par mois, et au-delà « vous ne pourrez plus accéder à Vercel Blob … jusqu’à ce que 30 jours soient passés » ; « répartir les mêmes données sur plus de magasins ne change pas ces coûts » [CITED: vercel.com/docs/vercel-blob/usage-and-pricing]. Naos en consomme déjà 900 à 1 100 estimées [VERIFIED: docs/ia-budget.md, tableau « Usage du magasin Blob »]. Un second équipage peut faire dépasser le quota et **bloquer l’archive de Naos 30 jours**. Parades : plafonds par téléphone plus bas pour Tofinou (`CAPS`, `js/archsync.js:10`, `js/archheavy.js:17`), quota d’IA plus bas, relevé de l’usage, ou plan Pro (question 9). Un magasin séparé isole les données (jeton distinct), pas le quota.
- **Budget d’IA commun** : clé par espace sans repli (B.4) ; T8.
- **Régression Naos** (middleware, archive, démarrage, consignes) : vague 0, fixtures, `tools/gardes-toulon.mjs` ; production après le 13 décembre.
- **Service worker** : ne pas le modifier en v1 (B.6) ; si la liste par espace est retenue, vague à part, vérifiée sur iPhone.
- **Matcher modifié pour le manifeste** : ouvrir une voie publique par erreur ; tests publics exacts (`tests/access.test.mjs:38-50`) mis à jour avec le seul nom ajouté.
- **Codes** : jamais écrits dans un fichier ; l’outil n’imprime le code qu’une fois ; le test existant « aucune empreinte hors de `middleware.js` » (`tests/access.test.mjs:235`) reste ; ajouter une recherche des liens `?acces=` dans le dépôt.
- **iPhone** : nom et icône de l’app installée, deux apps du même projet côte à côte, hors réseau de chacune : à essayer sur appareil [ASSUMED].
- **Prénoms** : uniques **dans** un espace (auteur, `day/…/<prénom>.json`, quota) ; deux espaces peuvent avoir le même prénom.
- **Domaine** : nom `.vercel.app` souhaité peut être pris ; le choisir tôt.

### D.4 Questions pour Romain (propositions avec défaut)

1. **Nom de l’espace et de l’app installée** — *défaut :* identifiant `tofinou`, app « Tofinou Bormes » (Naos reste « Rade Tactique »).
2. **Nom du bateau** — *défaut :* à donner par Romain ; à défaut, « Tofinou 9.5 » partout.
3. **Membres Tofinou** — *défaut :* Romain donne les prénoms (uniques dans l’espace) ; un outil crée chaque code, l’affiche une seule fois avec le lien personnel, et ne laisse dans le dépôt que l’empreinte ; Romain envoie les liens.
4. **Romain dans les deux espaces** — *défaut :* deux codes personnels, deux apps installées, aucune bascule dans l’app. Alternative : un seul code valable dans les deux espaces (table « multi-espace »).
5. **Adresse** — *défaut :* second domaine du même projet Vercel (nom à choisir, ex. un `….vercel.app` libre ou un sous-domaine d’un domaine de Romain). Alternative : second projet Vercel (isolation totale, deux mises en production) ; même URL déconseillée.
6. **Plans d’eau de l’espace Tofinou** — *défaut :* Bormes – Le Lavandou seulement ; Toulon et Brest invisibles ; pack de Brest refusé ; les fichiers de Toulon restent dans l’app installée (origine publique). Alternative : liste hors réseau par espace (Toulon refusé aussi, vague facultative qui touche `sw.js`). Variante : ouvrir Toulon à Tofinou (sortie en rade de Toulon).
7. **Bormes pour Naos** — *défaut :* non, Naos inchangé.
8. **IA pour Tofinou** — *défaut :* oui, clé d’un projet OpenAI séparé avec son propre plafond mensuel (montant à fixer par Romain), 30 appels par membre et par jour ; sans cette clé, l’IA de Tofinou reste coupée (jamais sur le budget de Naos). Alternative : même clé, plafond relevé.
9. **Archive et plan Vercel** — *défaut :* archive partagée entre membres Tofinou, même magasin Blob sous `tofinou/…`, plafonds par téléphone plus bas, relevé de l’usage après deux semaines ; passer au plan Pro si l’usage dépasse 60 % du quota. Alternative : magasin séparé (jeton distinct ; ne change pas le quota).
10. **Régates à semer** — *défaut :* aucune ; Romain indique les épreuves de la saison (nom, club, dates, IC en PDF) et elles se créent par l’onglet Régates comme aujourd’hui.
11. **Règles et classe** — *défaut :* longueur de coque 9,5 m pour la zone (28,5 m ; deux longueurs 19 m) à confirmer ; pénalité de base des RRS tant qu’aucune IC type n’est donnée.
12. **Guide** — *défaut :* une page courte pour Tofinou (installer, code, Bormes, ce qui diffère du J80) ; guide de Naos inchangé.
13. **Calendrier** — *défaut :* tout sur l’aperçu ; production après la régate de Toulon du 13 décembre.
14. **Rapport public de la Coupe SNPM** (`rapports/`, lisible sans code) — *défaut :* le garder tel quel (choix de la phase 4) ; alternative : le mettre derrière le code de Naos.

## Ne pas réinventer

| Problème | Ne pas écrire | Utiliser | Pourquoi |
|----------|---------------|----------|----------|
| Séparer le stockage de deux espaces | Un préfixe maison sur chaque clé `rade.*` et chaque base | Une origine par espace (le navigateur sépare tout) | Un oubli de préfixe = fuite ; zéro changement des clés de Naos |
| Réécrire le manifeste par hôte | Une règle `rewrites` dans `vercel.json` | `rewrite()` de `@vercel/functions` dans le middleware | `tests/access.test.mjs:146` interdit les réécritures de `vercel.json` |
| Plan d’eau par espace, pack hors réseau | Un nouveau mécanisme | Registre `js/venues.js`, packs vérifiés `js/pack.js`, `venueReady` | Éprouvés en phase 7 |
| Polaire du Tofinou | Un nouveau lecteur | `setPolar` / `parsePolar`, module comme `js/polar-orc.js` | Déjà testés |
| Refus par défaut des fonctions | Un contrôle nouveau | Le motif `membre_inconnu` (`api/archive.js:227-228`, `api/_ia.js:109-110`) | Même forme, même test |
| Empreintes de codes | Un hachage maison | `crypto.subtle.digest('SHA-256', …)` (`middleware.js:22`), `node:crypto` dans l’outil | Déjà utilisé |

## Pièges courants

1. **Espace lu dans le corps ou l’adresse** : toute valeur venant de la page est contrôlable par le membre. Seul `x-rt-espace` posé par le middleware compte ; test T1.
2. **En-tête absent traité comme « Naos »** : un défaut ouvert transforme une erreur de configuration en accès à Naos. Absent = 403 ; T3.
3. **Préfixe qui change pour Naos** (`naos/prod/…`) : l’archive de Naos paraîtrait vide et les téléphones v43 repousseraient tout. Naos garde `prod` / `preview` ; T6.
4. **Graine semée à l’ouverture** : `migrate` sème la Coupe SNPM sur tout appareil neuf (`js/regates.js:193`) ; T11.
5. **Pack refusé mais présent dans la liste hors réseau** : l’installation du worker échoue en entier (`sw.js:14`) ; T10.
6. **Code Tofinou ajouté dans `EQUIPAGE`** : il ouvrirait tout Naos. Table séparée, test de disjonction ; T4.
7. **Repli de la clé d’IA sur celle de Naos** : budget de Naos consommé par Tofinou ; T8.
8. **Consignes de Naos recomposées** : même texte affiché mais octets différents, garde `tests/apiia.test.mjs:451` rouge ; garder l’expression actuelle pour Naos ; T9.

## Exemples de code

### Middleware : espace d’un code et en-têtes posés (esquisse)
```javascript
// Lignes d’origine : middleware.js:20-25 (membre) et :87-92 (en-têtes) ; aucune empreinte réelle
async function membre(code) {
  if (!code) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim().toLowerCase()));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  for (const [espace, { table }] of Object.entries(ESPACES)) if (Object.hasOwn(table, hex)) return { prenom: table[hex], espace };
  return null;
}
// … pour /api/ :
const h = new Headers(req.headers);
h.delete('cookie');
h.set('x-rt-membre', encodeURIComponent(m.prenom));
h.set('x-rt-espace', m.espace);               // écrase toute valeur envoyée par la page
return next({ request: { headers: h } });
```

### Fonction : refus par défaut et préfixe
```javascript
// api/archive.js (esquisse) — d’après :227-233
const who = membre(req.headers?.['x-rt-membre']);
if (!who) return res.status(403).json({ error: 'membre_inconnu' });
const espace = espaceDe(req.headers?.['x-rt-espace']);
if (!espace) return res.status(403).json({ error: 'espace_inconnu' });
const P = prefixe(espace), path = `${P}/light.json`;        // naos : 'prod/light.json' (inchangé)
```

### App : espace au démarrage, avant le plan d’eau
```javascript
// js/app.js (esquisse) — ligne d’origine :62 « setVenue(bootVenue(store.get('rade.state', {}))); »
setEspace(bootEspace(location.hostname, localStore()));
setVenue(bootVenue(store.get('rade.state', {}), ESPACE));     // borné à ESPACE.venues, défaut ESPACE.venueDefaut
```

## Journal des hypothèses

| # | Hypothèse | Section | Risque si faux |
|---|-----------|---------|----------------|
| A1 | Un second nom de domaine (`….vercel.app` libre ou sous-domaine de Romain) peut être ajouté au même projet | B.2 | Repli : sous-domaine d’un domaine acheté, ou option D |
| A2 | Sur iPhone, le nom proposé à l’ajout sur l’écran d’accueil suit les balises posées par script, et deux apps de deux domaines coexistent avec leur hors-réseau | B.5, D.3 | Nom à saisir à la main à l’installation (toujours possible) |
| A3 | Longueur de coque du Tofinou 9.5 : 9,5 m | C | Textes de zone faux (pas de calcul touché) |
| A4 | Les pertes au virement du Tofinou diffèrent de celles du J80 (valeurs à fournir) | C | Temps de route un peu faux, comme avec la polaire J80 |
| A5 | Identifiant du plan d’eau de Bormes donné par l’autre étude (ici « <id de Bormes> ») | B.3, B.6 | Simple renommage |
| A6 | L’usage Blob d’un second équipage est du même ordre que celui de Naos | D.3 | Dépassement du quota Hobby plus tôt |

## Disponibilité de l’environnement

| Dépendance | Requise par | Disponible | Version | Repli |
|------------|-------------|-----------|---------|-------|
| Node.js | tests, stamp, outil des codes | ✓ | v22.23.5 (le `package.json` demande 24.x pour Vercel) | — |
| `@vercel/functions` (`rewrite`, `next`) | middleware | ✓ | 3.10.1 (déjà installé) | — |
| `@vercel/blob` (`token`, `storeId` par appel) | archive, quota | ✓ | 2.8.0 (déjà installé) | — |
| Domaine du second espace, clé OpenAI Tofinou, plan Vercel | vague 3 | à décider par Romain | — | Option D ; IA coupée pour Tofinou |

Aucun paquet nouveau : **pas d’audit de légitimité nécessaire**.

## Domaine sécurité

### Catégories ASVS concernées (niveau 1)

| Catégorie | S’applique | Contrôle |
|-----------|-----------|----------|
| V2 Authentification | oui | Codes personnels, empreintes SHA-256 seulement, tables disjointes par espace, aucun code en clair |
| V3 Sessions | oui | Cookie `HttpOnly; Secure; SameSite=Lax` propre à l’hôte ; refus d’un code sur l’hôte d’un autre espace |
| V4 Contrôle d’accès | oui (cœur de la phase) | Espace posé par le middleware, refus par défaut dans les fonctions, préfixe serveur, packs filtrés, politique de l’archive par espace |
| V5 Validation des entrées | oui | `x-rt-espace` en liste blanche ; plans d’eau et identifiants de régate contrôlés par espace ; consignes en tables fermées |
| V6 Cryptographie | oui | `crypto.subtle` / `node:crypto`, jamais de hachage maison |

### Menaces

| Menace | STRIDE | Parade |
|--------|--------|--------|
| Membre Tofinou qui forge `x-rt-espace: naos` | Élévation de privilège | `h.set` dans le middleware ; T1 |
| Lecture d’une trace de Naos par son identifiant | Divulgation | Préfixe serveur, identifiants sans `/` ni `..` ; T5 |
| Téléphone qui pousse des régates d’un autre espace | Divulgation, altération | Origine distincte, politique de l’archive, garde de l’app ; T7, T12 |
| Épuisement du quota Blob ou du budget d’IA par l’autre espace | Déni de service | Plafonds par espace, clé d’IA séparée, plan Vercel ; T8 |
| Oracle « ce code existe dans l’autre espace » ou « ce pack existe » | Divulgation | Mêmes réponses que pour un code inconnu ou un fichier interne |
| Fuite de codes dans le dépôt ou les journaux | Divulgation | Outil sans écriture du code, tests existants et nouveaux |

## Sources

### Primaires (HAUTE confiance)
- Code du dépôt lu dans cette session (branche `apercu-phase-08`, code = v43 `5e9b8a5`) : `middleware.js` (structure, empreintes masquées à la lecture), `api/archive.js`, `api/_ia.js`, `api/_gpen.js`, `api/rules.js`, `api/debrief.js`, `api/voice.js`, `api/ic.js` (début), `js/venues.js`, `js/lieu.js`, `js/venue-brest.js` (descripteur), `js/regates.js`, `js/app.js` (démarrage, membre, plan d’eau), `js/polar.js`, `js/router.js`, `js/courant.js`, `js/startmode.js` (recherche), `js/archsync.js`, `js/archheavy.js`, `js/regles.js`, `sw.js`, `tools/stamp.mjs`, `tools/gardes-toulon.mjs`, `tools/serveur-local.mjs` (en-tête), `tests/helpers/codesimule.mjs`, `tests/access.test.mjs` (liste des tests), `manifest.webmanifest`, `vercel.json`, `acces.html`, `acces.js`, `index.html` (en-tête), `docs/ia-budget.md`, `node_modules/@vercel/functions/middleware.d.ts`, `node_modules/@vercel/blob/dist/create-folder-BM6BTlko.d.ts`.
- Documents de planification : `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `07-CONTEXT.md`, `07-RESEARCH.md`, résumés 07-01 à 07-10, `05-03-SUMMARY.md`.

### Secondaires (MOYENNE confiance)
- Vercel Blob, prix et limites du plan Hobby : https://vercel.com/docs/vercel-blob/usage-and-pricing (lu le 2026-11-26, page datée du 2026-09-23).
- Domaines d’un projet Vercel : https://vercel.com/docs/domains/working-with-domains/add-a-domain, https://vercel.com/kb/guide/how-do-i-add-a-custom-domain-to-my-vercel-project (résultats de recherche, procédure exacte pour un second nom `.vercel.app` non trouvée).
- Réécritures conditionnées par l’hôte dans `vercel.json` : https://vercel.com/docs/rewrites (non retenues : interdites par les tests du dépôt).

### Tertiaires (BASSE confiance)
- Comportement d’iPhone pour le nom et l’icône d’une PWA (A2) : non vérifié.

## Métadonnées

**Confiance :**
- Inventaire : HAUTE — chaque valeur lue, recherches exhaustives des clés de stockage.
- Architecture : MOYENNE — cohérente avec le code et les gardes existantes, à éprouver par les vagues 0 et 1.
- Limites Vercel : MOYENNE — documentation officielle lue, plan réel du compte inconnu.
- iPhone : BASSE — à essayer sur appareil.

**Date :** 2026-11-26 — **valable jusqu’à :** 30 jours (code), ou jusqu’au premier changement de `middleware.js`, `api/archive.js` ou `sw.js`.
