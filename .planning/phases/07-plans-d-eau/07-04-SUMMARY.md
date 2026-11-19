---
phase: 07-plans-d-eau
plan: 04
subsystem: hors-reseau
status: complete
tags: [plan-d-eau, brest, service-worker, cache, pack, sha256, d-04, d-05, d-06, d-15]
requires:
  - "07-03 : data/brest.* hors du SHELL, manifeste data/venues.json (chemin, taille, SHA-256, pack, total) dans le SHELL"
  - "07-02 : registre js/venues.js, js/lieu.js (setVenue au démarrage), bootVenue, VENUE.files.base"
provides:
  - "js/pack.js : PACK_PREFIX, packStatus, downloadPack, prunePacks, packEntry, packCache, fmtMo"
  - "sw.js : caches rade-venue-* épargnés à l’activation, data/<id>.* hors liste servis depuis rade-venue-<id>-*, ?pack= jamais intercepté"
  - "carte « Plan d’eau » (venueCardHTML) en tête de l’onglet Régates ; switchVenue, S.byVenue, VENUE_KEYS, VENUE_DEF dans js/app.js"
  - "démarrage hors de Toulon : venueReady (état du pack avant le terrain), venueMissing (message et retour à Toulon), packUpdate (ancienne version)"
  - "scénarios plan-eau et brest-avion ; tools/measure-boot.mjs --venue brest"
affects: [07-05, 07-06, 07-07, 07-10]
tech-stack:
  added: []
  patterns:
    - "fichier lourd d’un plan d’eau : téléchargé par la page, vérifié (taille + SHA-256 crypto.subtle), écrit tout ou rien dans un cache dédié, servi par le worker du plus ancien au plus récent"
    - "réglages propres à un lieu rangés par plan d’eau (S.byVenue[id]) et restitués au retour ; communs : polaire, bateau, jour, heure"
    - "scénario de bout en bout avec service worker autorisé : contexte sans route (les autres hôtes restent coupés par --host-resolver-rules), serveur propre arrêté pour de bon"
key-files:
  created:
    - js/pack.js
    - tests/pack.test.mjs
  modified:
    - sw.js
    - js/app.js
    - js/regview.js
    - js/version.js
    - tests/sw.test.mjs
    - tests/regates.test.mjs
    - tools/regate-e2e.mjs
    - tools/measure-boot.mjs
decisions:
  - "Le téléchargement du pack (?pack=) n’est pas intercepté par le worker (même règle que /api/ et ?acces=) : la page parle directement au réseau, rien ne peut être copié ni servi d’un cache"
  - "Le worker cherche un fichier de pack dans les caches rade-venue-<id>-* de ce seul plan d’eau, du plus ancien au plus récent ; la page supprime les autres caches du plan d’eau après un succès, et au démarrage quand le pack actuel est prêt (prunePacks) : jamais de mélange de deux jeux"
  - "Ancienne version utilisable dès qu’elle a la méta, le relief, la couverture et la côte (fichiers de Terrain.load)"
  - "À Toulon, l’état du pack n’est lu qu’à l’ouverture de l’onglet Régates : init() n’appelle rien de neuf"
  - "Briefing sans prévision : « (hors ligne) » dès que le téléchargement des prévisions a échoué (wxOff), plus « téléchargement en cours… » indéfiniment"
metrics:
  duration: 50min
  completed: 2026-11-19
  tasks: 3
  files: 10
estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 20022        # chars/4 du diff ce9f295..b475802 (80 089 caractères)
  tasks: 3
  commits: 4
plan_head_before: ce9f29546ed21d2a007f25eb69a0528c3925dc3c
plan_head_after: b475802b7df57ccf875bc2218fa06da8ca9a72b6
---

# Phase 7 Plan 04 : Choix du plan d’eau et pack de Brest hors réseau Summary

En entraînement libre, la carte « Plan d’eau » de l’onglet Régates télécharge la rade de Brest (3,7 Mo), vérifie chaque fichier par taille et SHA-256 avant de l’écrire tout ou rien dans `rade-venue-brest-7aa34dd280`, puis bascule par rechargement (refusé pendant une course) ; le service worker garde ces caches à chaque mise à jour et les sert hors réseau ; Brest s’ouvre en mode avion, un téléphone sans pack le dit et revient à Toulon ; Toulon inchangé (gardes, vue v42, ouverture 374 ms).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 507e529 | `js/pack.js`, carte « Plan d’eau » (`venueCardHTML`), `switchVenue` et `S.byVenue`, démarrage à Brest (`venueReady`, `venueMissing`, `packUpdate`), briefing « hors ligne », bandeau « Entraînement libre · Brest », scénario `plan-eau`, tests du pack (9) et de la carte (2) |
| 2 (TDD) | a1e8ef3 (rouge), 6179e07 (vert) | 7 tests nouveaux du worker (6 rouges sur l’ancien sw.js), puis `sw.js` : `activate` épargne `rade-venue-*`, fichiers `data/<id>.*` hors liste servis depuis `rade-venue-<id>-*`, `?pack=` non intercepté |
| 3 | b475802 | scénario `brest-avion` (worker actif, serveur arrêté), `measure-boot --venue brest` |

Tracer (tâche 1) : vérification rejouée avant la tâche 2 : tests pack/regates/sw/boot verts, gardes vertes, `npm run check` 730 tests (729 verts, 1 sauté), SNPM-OK, « OK plan-eau », « OK toulon-vue », « OK accueil ». Seule la ligne `grep -q "rade-venue-" sw.js` de la vérification du plan était fausse à ce moment : voir écart 1.

## Version

Version de l’app après ce plan : `v42 · 09/11 · 91c6ef73d4` (`npm run stamp`, 74 fichiers dans la liste hors réseau : `js/pack.js` ajouté). Le numéro reste 42 : la v43 est publiée par `npm run release` en 07-10.

## Mesures d’ouverture (sorties brutes)

Avant ce plan (ce9f295), `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` :
```
Première visite en ligne : service worker actif, 73 fichiers en cache.
ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  375 |                           330 |             4039 |                                      655
        2 |                  439 |                           297 |             3985 |                                      462
        3 |                  403 |                           263 |             3831 |                                      498
        4 |                  394 |                           270 |             3932 |                                      592
        5 |                  455 |                           224 |             4124 |                                      510
  médiane |                  403 |                           270 |             3985 |                                      510
  maximum |                  455 |                           330 |             4124 |                                      655
RÉSULTAT : OK — médiane de l’interface utile 403 ms < 2000 ms (hors réseau, CPU ×4)
```
Après ce plan, Toulon (`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5`) :
```
Première visite en ligne : service worker actif, 74 fichiers en cache.
ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  378 |                           304 |             3664 |                                      495
        2 |                  348 |                           253 |             3632 |                                      524
        3 |                  374 |                           237 |             3808 |                                      618
        4 |                  352 |                           261 |             3584 |                                      513
        5 |                  377 |                           259 |             3838 |                                      488
  médiane |                  374 |                           259 |             3664 |                                      513
  maximum |                  378 |                           304 |             3838 |                                      618
RÉSULTAT : OK — médiane de l’interface utile 374 ms < 2000 ms (hors réseau, CPU ×4)
```
Brest (`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 --venue brest`) :
```
Première visite en ligne : service worker actif, 74 fichiers en cache.
Passage à Brest en ligne : pack de 6 fichiers (3652390 octets) dans son cache, bandeau « Entraînement libre · Brest ».
Serveur arrêté (connexion refusée sur 127.0.0.1:45033) : ouvertures hors réseau à Brest, CPU ×4, 5 ouvertures.
ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  323 |                           285 |             4456 |                                      759
        2 |                  448 |                           268 |             4652 |                                      833
        3 |                  372 |                           243 |             4641 |                                      813
        4 |                  373 |                           273 |             4628 |                                      927
        5 |                  377 |                           303 |             4637 |                                      880
  médiane |                  373 |                           273 |             4637 |                                      833
  maximum |                  448 |                           303 |             4652 |                                      927
RÉSULTAT : OK — médiane de l’interface utile 373 ms < 2000 ms (hors réseau à Brest, CPU ×4)
```
Lecture : l’interface utile de Toulon ne bouge pas (écart dans le bruit de la machine) ; à Brest elle est la même (373 ms), la carte arrive environ 1 s plus tard qu’à Toulon (4,6 s contre 3,7 s, indicatif : grille 1086 × 774 et champ de vent ≈ 1,5 × Toulon, cf. 07-03), la plus longue tâche passe de ≈ 0,5 s à ≈ 0,8 s (indicatif). Critère FIAB-06 tenu aux deux plans d’eau.

## Vérifications finales (sorties brutes)

Sur b475802 :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
npm run check : stamp à jour · # tests 737 · # pass 736 · # fail 0 · # skipped 1 (instantané météo de Brest absent)
SNPM-OK ; git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : inchangés
PW_REQUIRED=1 node tools/regate-e2e.mjs (tous) : OK accueil, jour-j, deux-telephones, reprise, equipage, archive, archive-bouees,
  archivehors, creer, manche, auteur, ic, depuis-ic, vraisemblance, gel, debrief-tardif, gpx, gpx-choix, ia, ia-erreurs, arbitre,
  bouees, guide, entetes, retour-port, banane, banane-manche, banane-debrief, porte-ic, modifier-manche, toulon-vue, plan-eau, brest-avion
Bilan : 33/33 scénario(s) OK
```
Tests ajoutés : tests/pack.test.mjs 9, tests/sw.test.mjs 7 (les 10 anciens inchangés et verts), tests/regates.test.mjs 2.

## Contrôles humains sur iPhone (D-15) — à faire sur l’aperçu avant « publie »

L’orchestrateur peut pousser `apercu-phase-07` dès maintenant : c’est la vague qui touche le service worker de tous les téléphones. Romain, avec un iPhone où l’app est **installée sur l’écran d’accueil et en v42** (production actuelle), puis le même essai dans Safari :

1. **Mise à jour sur geste, jamais en course.** Ouvrir l’aperçu : le bandeau de mise à jour apparaît. Lancer le chrono (Départ → 5 min) : le bandeau ne s’applique pas et « Passer à la rade de Brest » est grisé « Pas pendant une course ». Arrêter le chrono, toucher « Mettre à jour » : l’app passe à la nouvelle version (version affichée `91c6ef73d4` ou la suivante), les régates, traces et réglages de Toulon sont toujours là.
2. **Téléchargement.** Régates → carte « Plan d’eau » : « Rade de Brest : À télécharger (3,7 Mo) ». Toucher « Télécharger le plan d’eau » : progression en %, puis « Prêt hors réseau » (si un message « vérification impossible sur cet appareil » apparaît, `crypto.subtle` manque : le noter, hypothèse A6).
3. **Brest en mode avion.** Mode avion, fermer l’app (balayer), la rouvrir : Toulon s’ouvre comme d’habitude. Régates → « Passer à la rade de Brest » : l’app se recharge sur la rade de Brest, bandeau « Entraînement libre · Brest », carte 3D de la rade, briefing « Pas encore de prévision chargée (hors ligne) ».
4. **Retour à Toulon en mode avion.** « Revenir à la rade de Toulon » : Toulon s’ouvre aussi vite qu’avant, parcours choisi avant le passage retrouvé.
5. **Le pack survit.** Quitter le mode avion, fermer l’app, attendre une nouvelle version de l’aperçu (ou un jour), l’appliquer : Régates → « Prêt hors réseau » toujours affiché (le pack n’est pas retéléchargé).
6. **Téléphone sans pack.** Sur un deuxième iPhone (ou après Réglages → Safari → Données de sites → supprimer, puis réinstaller), en mode avion après une première ouverture en ligne de Toulon : on ne peut pas passer à Brest (« Rade de Brest non téléchargée : pas de réseau ») ; l’app ne plante pas.
7. **Stockage.** Après quelques jours sans ouvrir l’app, vérifier que « Prêt hors réseau » tient (iOS peut effacer les données d’une app peu utilisée ; `navigator.storage.persist()` est demandé après le téléchargement).

Attendu : (1) passage de version sans perte ; (2) « Prêt hors réseau » ; (3) Brest hors réseau avec la carte ; (4) Toulon aussi rapide ; (5) pack gardé par la mise à jour ; (6) message clair, aucun écran blanc ; (7) pack toujours là.

## Deviations from Plan

### Auto-fixed Issues

**1. [Précision - ordre TDD] Changement de sw.js porté par la tâche 2, pas par la tâche 1**
- **Plan :** la tâche 1 modifiait la logique de `sw.js` et la tâche 2 écrivait ses tests « en même temps ».
- **Fait :** la logique a été écrite pendant la tâche 1, mise de côté, puis appliquée en tâche 2 après des tests rouges (6 échecs constatés sur l’ancien worker, commit a1e8ef3), pour que le test prouve le changement. La tâche 1 n’a eu besoin d’aucun changement du worker (scénario `plan-eau` à worker bloqué). Seule conséquence : la ligne `grep -q "rade-venue-" sw.js` de la vérification de la tâche 1 n’était vraie qu’après la tâche 2.

**2. [Précision] `?pack=` non intercepté plutôt que `fetch(r)` dans le worker**
- Le plan disait « avec `?pack=` : `fetch(r)` sans copie ». Le worker ne répond tout simplement pas à ces requêtes (comme `/api/` et `?acces=`) : même effet (réseau, aucune copie), un chemin de moins dans le worker.

**3. [Rule 2 - Correction] Mélange de deux jeux de fichiers impossible**
- **Trouvé pendant :** tâche 1 (conception du service).
- **Problème :** un téléchargement interrompu entre l’écriture du nouveau cache et le ménage pouvait laisser deux caches du même plan d’eau.
- **Correction :** le worker lit les caches du plan d’eau du plus ancien au plus récent (un jeu complet avant un jeu en cours), un cache partiel est supprimé à l’échec d’écriture, et au démarrage à Brest `prunePacks` retire les autres caches dès que le pack actuel est complet. Tests dédiés (« écriture refusée », « prunePacks », « seuls les caches du même plan d’eau »).

**4. [Rule 1 - Bug] Briefing « téléchargement en cours… » sans fin hors réseau (point de 07-03)**
- **Correction :** `wxOff` posé quand les prévisions échouent sans copie ; le briefing dit « Pas encore de prévision chargée (hors ligne). Le mode « Manuel » reste disponible. » (`#wxNone`). Toulon n’est pas concerné tant que son instantané existe (vue v42 identique).

**5. [Précision] Contrôles en plus dans le manifeste**
- `packEntry` refuse un manifeste dont un chemin n’est pas `data/<id>.<suite>` du même plan d’eau, ou dont le pack ou une empreinte n’est pas hexadécimal : un fichier de Toulon ou un chemin `../` ne peut pas entrer dans un pack.

**6. [Précision] BREST-02 laissé « Pending »**
- BREST-03 est coché. BREST-02 couvre aussi le plan d’eau d’une régate, partagé par l’archive et lu par un téléphone en v42 : cette partie est le travail de 07-05, l’exigence reste donc ouverte dans REQUIREMENTS.md (seule la partie entraînement libre est faite ici).

## Known Stubs

| Fichier | Valeur | Résolu par |
|---------|--------|-----------|
| `data/brest.wx-snapshot.json` | toujours absent (07-03) : à Brest hors réseau, aucune prévision, vent manuel 270° 12 nd | 07-10 |
| `js/app.js` `VENUE_DEF.brest.courseId` | banane (90) au premier passage, faute de catalogue du GPEN | 07-09 |

## Threat Flags

Aucune nouvelle surface hors du registre du plan : aucune route, aucun en-tête, middleware inchangé ; les fichiers du pack restent `data/brest.*` derrière le contrôle d’accès (07-03) ; T-07-10 (taille + SHA-256 avant écriture, tout ou rien, refus sans `crypto.subtle`), T-07-11 (tests du worker, `brest-avion`, deux mesures d’ouverture, essai iPhone ci-dessus), T-07-12 (refus par `isActive`, js/racelock.js inchangé, bouton grisé) appliqués. Aucun code d’accès ni empreinte de middleware.js écrit ou affiché ; aucun appel à l’IA.

## Points pour 07-05

- Ouvrir une régate d’un autre plan d’eau : réutiliser `packGo(id)` (téléchargement si absent, refus en course, puis `switchVenue`), et rouvrir la régate après le rechargement (aujourd’hui `switchVenue` ne garde que les réglages ; `OPEN` n’est jamais persisté : il faudra un passage explicite, par exemple une clé lue une fois au démarrage).
- `VENUE_KEYS` liste les réglages rangés par plan d’eau ; un réglage nouveau propre à un lieu doit y entrer (sinon il suit le téléphone d’un plan d’eau à l’autre).
- `S.byVenue` est écrit par `persist()` (clé de `DEF`) : à surveiller si l’état est un jour partagé.
- La carte « Plan d’eau » est repeinte en place (`paintPack`, `#pkCard`) : un formulaire ouvert dans l’onglet Régates n’est pas redessiné.
- Le worker ne connaît pas le manifeste : il sert le premier cache complet du plan d’eau ; la page garantit qu’il n’y en a qu’un après le démarrage. Un nouveau plan d’eau téléchargeable n’a besoin que de `data/<id>.meta.json` (stamp l’exclut du SHELL) et de son entrée dans `data/venues.json`.
- Le scénario `brest-avion` montre comment tester avec le worker (`ouvreContexte({ worker: true })`, `attendWorker`, serveur propre).

## Self-Check: PASSED
