# Project Research Summary

**Projet :** Rade Tactique (PWA de régate du J80 Naos, rade de Toulon)
**Domaine :** jalon « prêt pour la prochaine régate CVAT » sur une app existante (JS sans build, Vercel)
**Recherche :** 2026-10-19
**Confiance globale :** MOYENNE (HAUTE sur Vercel Blob, Node, tests ; MOYENNE à BASSE sur le comportement iOS réel, à valider sur les iPhone de l'équipage)

## Executive Summary

Rade Tactique est déjà un outil complet pour un équipage de trois (vent 3D, routage, polaire, mode départ, GPX, débrief IA). Le jalon ne doit pas ajouter de tactique : il doit garantir la **fiabilité en mer**, une **mémoire partagée** (archive des régates pour tout l'équipage) et l'**autonomie** (n'importe quel équipier ouvre une régate et fait le débrief sans Romain). Le créneau est un carnet de saison d'équipage qui relie IC importées, vent figé du jour, traces et débrief ; aucun outil trouvé ne combine ces éléments pour un équipage privé.

Trois principes. **Local d'abord** : chaque écriture va dans IndexedDB puis dans une outbox envoyée au serveur, donc aucune panne réseau ne bloque la course. **Serveur minimal et sûr** : Vercel Blob en store PRIVÉ, accès seulement par des routes `api/` qui revalident le cookie, deux documents modifiables (`index.json`, `meta.json`) avec `ifMatch`, le reste en objets immuables. **Rien de risqué pendant la course** : pas de rechargement automatique du service worker, pas de synchro entrante pendant un verrou « en course », tests de non-régression avant chaque mise en ligne.

Risques principaux : une PWA iPhone ne peut pas enregistrer le GPS écran verrouillé (détecter et signaler les trous, garder Open GPX Tracker comme secours) ; le SW actuel recharge la page en course (`skipWaiting` + `controllerchange` → reload) ; chrono et bips dépendent d'un `setInterval` et peuvent se taire ; l'archive partagée expose des données si une route ou un rapport HTML est mal protégé.

## Échéance et priorités

- Régate CVAT : 7-9 novembre 2026 (J+19 à J+21 depuis le 19/10).
- Gel du code visé le 2 novembre (J+14), pour un essai en mer et des correctifs. Aucun déploiement de production dans les 48 h qui précèdent la régate, sauf correctif critique hors course.
- Priorités, dans l'ordre : 1) fiabilité en mer (pas de rechargement SW en course, enregistrement résilient, verrou d'écran, bips planifiés sur l'horloge audio, shell en cache d'abord) ; 2) non-régression (`node:test`, porte de vérification via `buildCommand`) ; 3) ouverture de régate par un équipier avec instantané du vent ; 4) archive partagée privée derrière le contrôle d'accès ; 5) plans d'eau : extraction des données de la rade après la régate.
- Si le temps manque : tenir 1 et 2 pour la régate, livrer 3 et 4 sans écriture partagée avant le test d'accès.

## Key Findings

### Stack
Socle inchangé (JS ES modules sans build, Three.js vendorisé, `sw.js` écrit à la main, Vercel statique + fonctions Node `api/*.js` + middleware). Ajouts :
- **Vercel Blob store PRIVÉ** (`@vercel/blob` 2.8.2) : régates, traces, instantanés, rapports, accès seulement via `api/`. Plafonds Hobby : 2 000 opérations avancées/mois (dont `list`), 10 000 simples/mois.
- **`index.json`** (liste, évite `list()`) + **`meta.json`** par régate ; écriture avec `ifMatch` (ETag), 3 essais.
- **`idb` 8.0.4 vendorisé** : outbox, cache local de l'archive, blocs de trace. Pas de Background Sync (absent de Safari iOS) : envoi à l'ouverture, au retour de visibilité, sur `online` (non fiable seul), relance avec backoff.
- **Tests : `node:test`** (Node 24, compatible 22), `linkedom` 0.18.13 (DOMParser GPX), `fake-indexeddb` 6.2.6, `ajv` 8.20.0 (schéma des plans d'eau, tests seulement). Pas de Vitest.
- **Porte de déploiement** : `"buildCommand": "npm run check"` dans `vercel.json` (syntaxe + tests). Échec = pas de mise en ligne.
- `engines.node` `"24.x"` ; tests verts aussi sur 22.
- Erreurs : tampon local `report()` en IndexedDB remplaçant les `catch {}` du chemin course + écran Diagnostic. Sentry = option à décider avec Romain.
- Playwright : plus tard, non bloquant, Chromium seulement.

### Features
**Table stakes :** liste des régates par saison ; fiche complète (vent du jour, route conseillée, traces, débrief, polaire, rapport) ; plusieurs manches par jour ; création en moins d'une minute ; import IC PDF avec relecture obligatoire ; parcours connus ou marques propres à l'épreuve ; statut à venir / aujourd'hui / passée ; fonctionnement hors réseau complet avec indicateur « N éléments en attente » ; trace qui survit ou signale son trou ; écran Aujourd'hui avec un bouton principal ; import GPX rattaché par date ; débrief en un geste.

**Différenciateurs (plus tard) :** vent et stratégie figés avec comparaison prévu/réel ; notes d'équipage (cote 1-5, une amélioration, dictée) ; ligne de départ mémorisée ; jours semblables et fiche d'avant-régate (après 5-8 régates) ; trace de secours entre les 3 téléphones.

**Anti-fonctions :** suivi direct et classements ; comptes et rôles fins ; édition collaborative temps réel ; gestion d'inscriptions et résultats officiels ; capteurs NMEA/Bluetooth ; push et chat ; archivage séparé de la fiche IC (décision de Romain) ; second plan d'eau maintenant (décision de Romain : plus tard).

### Architecture
Règle : cœur pur ← adaptateurs plateforme ← interface. Le cœur (geo, wind, router, polar, tactics, debrief, fusion de manifestes, projection d'instantanés) s'importe sous Node. `RaceSession` est l'unique arbitre « en course » : pas de mise à jour appliquée, pas de synchro entrante, pas d'écriture réseau.

Composants :
1. `RaceSession`, verrou persistant.
2. `platform/gps.js` (chien de garde : silence > 10 s = relance, bandeau, bip, trou consigné) et `wakelock.js` (un seul verrou, réacquis sur `visibilitychange` et `release`).
3. `regatta/model.js` pur (upcoming → raced → archived, fusion par champ, identifiants `AAAA-MM-JJ-club`).
4. `regatta/snapshot.js` (projection versionnée, jamais `JSON.stringify` d'objets vivants).
5. `regatta/store.js` + `sync.js` (outbox idempotente).
6. `api/_acces.js` (table des membres partagée avec le middleware, auteur depuis le cookie) + `api/regattas.js`, `regatta.js`, `blob.js`.
7. `tools/verify.mjs` + `tools/stamp.mjs` (syntaxe, SHELL, VERSION uniques).
8. `venue/loader` plus tard (`data/venues/toulon/venue.json`).

Patterns : manifeste fusionnable + objets immuables ; instantané automatique au premier moment utile ; enregistrement par blocs (`open:true`, vidage à `pagehide`/hidden, trous coupés et non interpolés) ; mise à jour différée (`SKIP_WAITING` seulement hors course) ; cache d'abord pour le shell, seulement après `stamp.mjs`. `venueId` et `venueRev` écrits dès la phase 3 dans chaque régate et instantané.

### Pitfalls critiques
1. **GPS, trace et chrono qui s'arrêtent écran verrouillé.** Détecter, signaler, réparer : voyant « dernier point il y a N s », trou marqué, alerte au retour ; réacquérir le verrou dans tous les modules (`startmode.js` ne le fait pas) ; enregistrer à chaque lot et à `pagehide` ; reprise après arrêt brutal ; Open GPX Tracker comme secours ; inventaire des iPhone (version iOS, mode économie).
2. **SW qui recharge l'app en course.** Retirer `skipWaiting` automatique et le reload sur `controllerchange` ; bannière passive ; application hors course ; version affichée à l'écran de départ ; `stamp.mjs` génère VERSION et SHELL.
3. **Bips et chrono qui se taisent.** Planifier les bips sur `AudioContext.currentTime` ; suspendre les calculs lourds en mode départ ; badge « SON COUPÉ » et bouton « tester le son » ; `audioSession.type = 'playback'` avec détection ; signal visuel plein écran ; tester bouton silencieux et après appel.
4. **Réseau d'abord sans délai.** Cache d'abord pour le shell ; délai de 3 s pour les autres appels ; le trajet critique (départ, GPS, chrono, carte) sans appel réseau bloquant ; tester réseau très lent.
5. **Accès et archive qui fuient.** Store privé uniquement ; routes `api/` qui revalident le cookie (`Cache-Control: private, no-cache` ; `nosniff`) ; auteur tiré du cookie, jamais du corps ; rapports servis avec CSP sandbox ; test : chemins anciens et nouveaux sans cookie → 401 ou redirection, sauf liste blanche exacte.

Autres : synchro bricolée (conflits, suppressions ressuscitées, doublons de traces) ; `catch {}` qui masquent les échecs de stockage ; IC d'un autre club (date ou heure plausibles mais fausses) ; tests qui figent des erreurs (constantes du vent réglées sur une observation) ; reconnaissance vocale absente en app installée (repli saisie et dictée du clavier) ; OpenAI sans plafond ni `store:false` ; cookie qui contient le code lui-même ; pdf.js vendorisé dans la plage de CVE-2024-4367 (`isEvalSupported:false`).

## Implications for Roadmap

Calendrier indicatif : J0 = 19/10 ; gel visé J+14 (2/11) ; régate J+19 à J+21.

### Phase 1 : Filet de sécurité (J0 à J3)
**Rationale :** sans tests ni génération de VERSION/SHELL, les phases suivantes sont à l'aveugle.
**Livre :** `tools/verify.mjs` (`node --check`, couverture SHELL, version unique) ; `tools/stamp.mjs` ; `js/util.js` (un seul `esc` qui échappe aussi l'apostrophe, dates en heure de Paris) ; `node --test` avec tests dorés sur la Coupe SNPM 18/10 (geo, polaire, routage, GPX, débrief, tolérances) ; test du middleware (cookie valide, code inconnu, `?acces=`, chemins publics, `/api` sans cookie = 401) ; `.vercelignore` ; fixtures copiées dans le dépôt (GPX SNPM, texte IC, `wx-snapshot.json`) ; `package-lock.json` ; correctif sécurité pdf.js (`isEvalSupported:false`) ; `TZ=Europe/Paris` avec un cas qui traverse le 25/10/2026.
**Porte :** `buildCommand` `"npm run check"` une fois la suite verte et vérifiée sur un déploiement d'aperçu (sortie inchangée : accueil, `/sw.js`, `/data/`) ; contournement documenté.

### Phase 2 : Fiabilité en mer (J3 à J10), prioritaire
**Rationale :** exigence n° 1 ; le rechargement en course et la perte de trace sont les risques qui peuvent faire perdre une régate.
**Livre :** mise à jour différée (bannière passive, hors course seulement, version à l'écran de départ) ; `RaceSession` persistant, suspension de la synchro entrante et des mises à jour, reprise de trace ouverte ; `gps.js` (chien de garde) ; `wakelock.js` unique, réacquis, utilisé aussi par le mode départ ; voyant d'état (GPS, trace, écran maintenu, son, réseau, en attente) ; enregistrement par blocs, vidage à `pagehide`/hidden, `navigator.storage.persist()` ; `analyzeTrack` coupé aux trous ; import GPX avec segments (pauses Open GPX Tracker) ; bips planifiés sur l'horloge audio, badge SON COUPÉ, test du son ; dictée : détection, repli champ texte et dictée du clavier ; cache d'abord pour le shell (après stamp) ; délai de 3 s ; journal diag remplaçant les `catch` du chemin course ; parcours d'installation par iPhone.
**Recette :** 60 min sur iPhone (écran verrouillé/déverrouillé, appel, bascule d'app, mode avion, batterie faible, déploiement volontaire pendant l'essai : la bannière apparaît sans rechargement).

### Phase 3 : Régate locale d'abord et ouverture (J8 à J14)
**Rationale :** prérequis de tout le reste ; livrable sans serveur ; l'instantané doit être automatique maintenant, une prévision non figée est irrécupérable.
**Livre :** modèle de régate (upcoming, raced, archived), `venueId` et `venueRev`, identifiants déterministes ; « Nouvelle régate » par tout équipier (nom, date, club) avec liste du jour pour éviter les doublons ; import IC avec relecture champ par champ (extrait source, page, voyant), contrôles de vraisemblance (date dans les 60 jours, heures plausibles, VHF 6 à 88, coordonnées dans la boîte du plan d'eau), champ vide plutôt que deviné, PDF sans texte signalé ; parcours connus ou marques ; marques approx ou ic-pdf signalées ; instantané automatique (consensus borné au jour, modèle retenu, relevés, route conseillée, marques utilisées) à la création et au premier départ ; trace rattachée par date ; migration de `rade.events.v1` (la Coupe SNPM devient la première régate) ; écran Aujourd'hui ; archive locale.

### Phase 4 : Archive partagée en ligne (J12 à J17, coupable)
**Rationale :** mémoire de l'équipage ; dépend des phases 1 et 3. Si le calendrier glisse, l'archive reste locale et l'outbox rattrape plus tard.
**Livre :** `api/_acces.js` (table partagée, `requireMember(req)`, auteur depuis le cookie) ; store Blob privé créé par Romain ; `api/regattas.js` (`index.json`), `api/regatta.js` (`meta.json`, fusion, `ifMatch`, 3 essais), `api/blob.js` (objets immuables, put sans écrasement, `private, no-cache`, `nosniff`, plafond ~4 Mo) ; traces gzip (`CompressionStream`) ; rapports en CSP sandbox ; `sync.js` (outbox idempotente, jamais pendant une course, 401 ne vide pas la file) ; lecture hors ligne de l'archive récente ; export JSON et GPX ; test d'accès sans cookie sur tous les chemins, y compris l'aperçu.
**Budget Blob :** environ 5 400 opérations simples/mois estimées pour 3 équipiers sur 10 000. Cache IndexedDB, rafraîchissement au lancement, seuil d'alerte à 60 %.

### Gel, essai en mer, règle d'exploitation (J14 à J19)
Gel visé le 2 novembre ; ensuite corrections seulement. Essai en mer sur les iPhone (version iOS notée) : wake lock 30 min, trou GPS écran verrouillé, mode avion puis retour réseau avec vidage de l'outbox, bips avec bouton silencieux, dictée, réinstallation par lien personnel. Checklist : `npm run check` vert, version affichée, Diagnostic sans erreur. Aucun déploiement de production dans les 48 h avant la régate, sauf correctif critique hors course.

### Phase 5 : Après la régate, plans d'eau et découpage (J21 et suivants)
**Livre :** pack de plan d'eau (`courses.js`, `weather.js`, `geo.js`, `api/rules.js` deviennent des données dans `data/venues/toulon/venue.json`, généré une fois puis validé par `ajv` ; SHELL généré) ; extraction des panneaux de `app.js` un par un avec tests dorés ; Playwright en smoke non bloquant ; corpus de 3 à 5 vrais PDF d'IC d'autres clubs ; notes d'équipage, prévu/réel, ligne de départ ; décision Sentry ; renommage des variables de `wind.js` seulement avec comparaison avant/après. Décision de Romain respectée : préparer l'architecture, pas ajouter de second plan d'eau maintenant.

### Ordre et raisons
Filet avant tout ; fiabilité avant archive (le correctif du rechargement est petit et décisif, l'archive peut être coupée sans perdre de trace) ; local avant serveur ; accès avant toute écriture partagée ; plans d'eau en dernier.

### Research Flags
- **Phase 2 :** comportement réel sur iPhone (verrou, GPS écran verrouillé, bouton silencieux, dictée en app installée). À mesurer en essai, pas à rechercher.
- **Phase 4 :** budget d'opérations Blob, effet de `ifMatch` suivi d'un écrasement (60 s), `useCache:false`, poids d'une régate compressée (mesure sur la trace SNPM).
- **Phase 3 (IC) :** extraction sur un corpus réel de plusieurs clubs avant de concevoir.
- **Phase 5 :** schéma exact et valeurs par défaut des IC d'un club hors CVAT.
- **Standard, pas de recherche :** phase 1 (`node:test`, `linkedom`, `fake-indexeddb`, `buildCommand` vérifiés), phase 3 (fonctions pures), phase 4 (API Blob documentée ; seule la vérification d'accès demande une relecture).

## Confidence Assessment

| Domaine | Confiance | Notes |
|---|---|---|
| Stack | HAUTE | Blob privé, `ifMatch`, quotas Hobby, Node 24, `node:test`, `buildCommand` vérifiés (doc officielle et exécution) ; budget opérations MOYEN |
| Fonctionnalités | MOYENNE | Besoins issus de PROJECT.md (HAUTE) ; concurrents via fiches et forums (MOYENNE à BASSE) |
| Architecture | MOYENNE à HAUTE | Code lu directement ; comportement de `list()` Blob non vérifié (contourné par `index.json`) |
| Pièges | MOYENNE | WebKit, Vercel, OpenAI vérifiés ; comportement iPhone écran verrouillé, bouton silencieux et dictée : sources secondaires |

**Confiance globale : MOYENNE.** Décisions techniques solides et réversibles ; le risque principal est le comportement réel des iPhone, tranchable seulement par une recette sur appareil.

### Gaps à traiter
- iOS des trois iPhone et réglages (mode économie, verrouillage auto, dictée) : à relever avant la phase 2 ; sans iOS 18.4+ le verrou n'est pas fiable en app installée.
- Plan Vercel (Hobby ou Pro) et consommation Blob actuelle : les seuils supposent Hobby.
- Deployment Checks sur Hobby : non vérifié ; porte retenue = `buildCommand`.
- Mesures sur la trace SNPM : taille gzip, taille de `meta.json`, nombre d'opérations par ouverture d'archive (un 304 compte-t-il ?).
- Sentry ou journal local seulement : Sentry envoie des données à un tiers. Recommandation : journal local d'abord, décision Sentry en phase 5, `beforeSend` retirant `acces=`, positions et traces.
- Nom du module d'accès : retenu `api/_acces.js`, source unique partagée par le middleware et les routes. Jeton de session révocable (HMAC) à traiter en phase 4 ou plus tard, avec double format pendant la transition.
- Listing des régates : retenu `index.json` ; `list()` réservé à un outil de réparation.
- `buildCommand` : activé après vérification sur aperçu, avec contournement documenté.
- Comportements iOS non vérifiés : arrêt de `watchPosition` écran verrouillé, redemande de localisation en app installée, bouton silencieux avec `audioSession`, absence de Web Share Target (import par le sélecteur de fichiers). À confirmer en essai.
- Secrets : clé OpenAI, secret du store Blob et codes d'accès ne doivent jamais figurer dans le dépôt, les journaux ou les tests ; prévisualisations avec store et clé distincts ; plafond de dépense OpenAI à poser maintenant.

## Sources

- **Primaires (HAUTE) :** Vercel Blob (usage-and-pricing, private-storage, using-blob-sdk) ; Vercel (configure-a-build, routing-middleware API, runtime logs, node versions, limits) ; WebKit (tracking-prevention, storage policy) ; WebKit bug 254545 ; OpenAI your-data ; Node.js `node:test` ; code du dépôt lu directement.
- **Secondaires (MOYENNE) :** caniuse Background Sync ; WebKit bugs 225298, 264473, 201866, 255363 ; firt.dev PWA iOS ; GHSA-wgrm-67xf-hhpq (pdf.js) ; code source Open GPX Tracker ; Sentry pricing et install CDN ; fiches des concurrents ; Sailing World, Quantum Sails, Sail1Design.
- **Tertiaires (BASSE, à valider sur appareil) :** témoignages forums (GPS écran verrouillé, permissions, dictée installée, bouton silencieux) ; Web Share Target absent sous iOS ; extrapolation du budget Blob.

---
*Research completed: 2026-10-19*
*Ready for roadmap: yes*
