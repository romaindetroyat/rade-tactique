---
phase: 08-espace-tofinou
plan: 04
subsystem: app
status: complete
tags: [espaces, cloisonnement, bormes, graines, garde, synchronisation, plafonds, tofinou]
requires:
  - "08-02 : middleware et fonctions cloisonnés par espace (ESPACES, api/_espace.js, POLITIQUE)"
  - "08-03 : pack data/bormes.* et tools/venues/bormes.json"
provides:
  - "js/espaces.js : ESPACES (aucun membre), ESPACE_IDS, HOTES, ESPACE_KEY, espaceDeLHote, bootEspace, ESPACE (vivant), setEspace, espaceSur, appareilVierge"
  - "js/venue-bormes.js : BORMES (identité, emprise, inputBounds ouest 6,20° E, fichiers, météo, cadrage, windRef, lignes « lavandou » et « faviere »)"
  - "js/venues.js : registre à trois plans d’eau ; bootVenue(st, espace), venueAt(lat, lon, ids), venueOf(r, ids), needsVenueRepair(r, ids) bornés à l’espace"
  - "js/regates.js : migrate/seedNorm/seedGpen({ graines }), setCommuns(oui)"
  - "js/archsync.js / js/archheavy.js : plafonds passés par deps.caps (Naos : CAPS inchangés)"
  - "scénarios tofinou-demarrage et espace-garde ; hôtes d’essai tofinou.localhost et apercu.localhost dans tools/regate-e2e.mjs"
  - "tests/fixtures/graines-v43.json + tests/helpers/graines.mjs (semis, IC et fusion de Naos capturés sur 5e9b8a5)"
affects: [08-05, 08-06, 08-07, 08-08, 08-09, 08-10]
tech-stack:
  added: []
  patterns:
    - "espace fixé une fois par session avant le plan d’eau (export vivant, comme js/lieu.js)"
    - "listes de plans d’eau passées en paramètre, défaut = espace courant (Naos tant qu’il n’est pas fixé)"
    - "référence v43 capturée en fixture (aucun appel à git pendant npm test)"
key-files:
  created:
    - js/espaces.js
    - js/venue-bormes.js
    - tests/helpers/graines.mjs
    - tests/fixtures/graines-v43.json
  modified:
    - js/app.js
    - js/venues.js
    - js/regates.js
    - js/regview.js
    - js/archmerge.js
    - js/archsync.js
    - js/archheavy.js
    - js/tactics.js
    - tools/regate-e2e.mjs
    - tests/espaces.test.mjs
    - tests/venues.test.mjs
    - tests/regates.test.mjs
    - tests/archsync.test.mjs
    - tests/archheavy.test.mjs
    - tests/archmerge.test.mjs
    - tests/bormes.test.mjs
    - tests/helpers/naos.mjs
    - sw.js
    - js/version.js
decisions:
  - "COMMON (valeurs communes du CVAT) : réglage de module `setCommuns(ESPACE.id === 'naos')` posé par js/app.js avant le premier migrate ; hors de Naos, icOf rend sequence, classes et groups vides (sauf ce que les IC disent)"
  - "Graines : paramètre `graines` de migrate, seedNorm et seedGpen (défaut : celles de Naos) ; hors de Naos, migrate ne reprend pas non plus rade.events.v1 (fiches CVAT d’avant)"
  - "Plans d’eau : venueAt, venueOf, needsVenueRepair prennent la liste de l’espace (défaut : espace courant) ; une régate sans plan d’eau d’un espace sans Toulon va à son premier plan d’eau (Bormes), jamais à Toulon"
  - "Adoption d’un appareil vierge : rade.espace.v1 écrite (retirée pour Naos), rade.regates.v1, rade.seed.gpen.v1 ET rade.state retirés, puis rechargement (rade.state retiré pour que les défauts de Bormes s’appliquent)"
  - "Garde : hôte connu = comportement de la v43 (aucune attente) ; hôte inconnu = aucun échange avec /api/archive (syncNow, runHeavyNow, telecharger, et syncFetch en dernier rempart) avant la confirmation ; espace annoncé inconnu jamais adopté (bloqué)"
  - "Référence de la v43 pour T11 : fixture capturée sur l’extraction de 5e9b8a5 (et non extraction git pendant le test : un déploiement Vercel peut ne pas avoir l’historique)"
  - "regimeOf : une liste de régimes vide (Bormes avant 08-07) ne donne aucun régime au lieu des régimes de Toulon ; Toulon (null) et Brest inchangés"
metrics:
  duration: 41min
  completed: 2026-11-26
estimate:
  tokens: 140000
  tasks: 3
actuals:
  tokens: 26900
  tasks: 3
  commits: 3
plan_head_before: 5a2077f747f010d7d5207b401d86d3cf3a8ef8b4
plan_head_after: 8f3a7de10eb11c66fed3ed2adce4b6084b4d7e07
---

# Phase 8 Plan 04 : app consciente de son espace Summary

Le même code ouvre Naos à Toulon et Tofinou à Bormes selon l’adresse : `js/espaces.js` (registre public sans membre, mêmes identifiants et hôtes que le middleware et les fonctions, test de parité) fixe l’espace au démarrage, hors réseau et avant le plan d’eau ; l’espace Tofinou télécharge une fois le pack `bormes`, ne voit que Bormes et ne sème ni la Coupe SNPM ni le GPEN ; sur un aperçu, rien ne part vers l’archive avant que `/api/membre` ait confirmé l’espace (adoption d’un appareil vierge, sinon synchronisation arrêtée) ; les plafonds d’archive de Tofinou sont la moitié de ceux de Naos. Naos : aucune clé, requête ou vue nouvelle (naos-cles, toulon-vue, gel v43, gardes verts).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 56c196f | js/espaces.js, js/venue-bormes.js, Bormes au registre, bootVenue borné, `setEspace(bootEspace(…))` avant `setVenue`, `PACK_ID = ESPACE.pack`, défauts de Bormes au premier démarrage ; formulaire et liste blanche de l’archive à trois plans d’eau ; scénario tofinou-demarrage |
| 2 (tdd) | f1597e4 | graines par espace, COMMON réglé par l’espace, carte « Plan d’eau » et bascule bornées, `venueMissing` sans Toulon hors de Naos, attribution d’une trace bornée, T11 contre la fixture de la v43 |
| 3 (tdd) | 8f3a7de | espaceSur / appareilVierge, garde dans js/app.js, plafonds par deps.caps, T12, scénario espace-garde |

Tracer (tâche 1) : `<verify>` complet joué avant la tâche 2 (tests, stamp, `npm run check`, gardes, 5 scénarios, mesure d’ouverture) : vert, expansion poursuivie. Tâches 2 et 3 : tests écrits d’abord, rouges (import manquant `setCommuns` ; `espaceSur` absent ; carte « Plan d’eau » avec bascule ; plafond lourd de Tofinou), puis verts.

## Mesure d’ouverture de Naos (hors réseau, CPU ×4, 5 ouvertures)

`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5`, médiane de l’interface utile (critère < 2 000 ms) :

| Mesure | Médiane | Maximum |
|--------|---------|---------|
| v44 en cours, après la tâche 1 (machine chargée) | 511 ms | 541 ms |
| v44 en cours, après la tâche 3 (seule) | **405 ms** | 487 ms |
| v43 (extraction de 5e9b8a5) sur la même machine, juste après | 457 ms | 480 ms |
| v43 de référence (FIAB-06) | 418 ms | — |

Aucun écart mesurable : les deux modules ajoutés (js/espaces.js 5 Ko, js/venue-bormes.js 3 Ko) sont lus par le cache du worker ; la différence entre deux séries vient de la machine.

## Sorties brutes

Tests nouveaux (extraits) :
```
ok - parité app ↔ middleware ↔ fonctions : mêmes identifiants, mêmes hôtes, même pack par espace, plans d’eau et graines réservées de la politique serveur
ok - js/espaces.js public : aucune empreinte (64 hexadécimaux) ni prénom de membre
ok - bootEspace : hôte connu → son espace (la clé est ignorée) ; hôte inconnu → rade.espace.v1 si elle nomme un espace autre que Naos ; sinon Naos ; aucune écriture
ok - setEspace : Naos par défaut (export vivant), une seule fois par session, valeur inconnue → Naos
ok - registre : Toulon, Brest et Bormes, identifiants en liste
ok - bootVenue borné par l’espace : Naos comme la v43 pour toute entrée (Bormes donne Toulon) ; Tofinou toujours Bormes
ok - bornes de saisie de Bormes et de Toulon disjointes en longitude (ouest de Bormes ≥ est de Toulon, piège 6) ; Brest à part
ok - plans d’eau d’une régate et d’une trace bornés par l’espace : Bormes invisible pour Naos (comme en v43), Toulon et Brest pour Tofinou
ok - descripteur ↔ configuration : météo (centre, grille latitude d’abord, cellules de mer, point marin), emprise, origine, fichiers et point de référence de js/venue-bormes.js = tools/venues/bormes.json et data/bormes.meta.json
ok - T11 : graines par espace — Naos sème exactement comme la v43 (index, clés, IC, fusion : tests/fixtures/graines-v43.json, capturé sur 5e9b8a5) ; Tofinou ne sème rien et ne pose aucun marqueur
ok - IC d’une fiche de l’espace Tofinou : ni signaux, ni pavillons de classe, ni groupes du CVAT ; Naos inchangé après le retour du réglage
ok - formulaire de régate : plans d’eau de l’espace seulement (Naos : Toulon et Brest, comme en v43 ; Tofinou : Bormes, par défaut)
ok - carte « Plan d’eau » : Naos identique avec ou sans la liste de l’espace ; Tofinou sans « Revenir à la rade de Toulon » ni autre plan d’eau, sources de Bormes
ok - T12 : garde d’espace — hôte connu : comme la v43, aucune attente ; hôte inconnu : attendre /api/membre, réponse sans espace = Naos, autre espace → adopter (appareil vierge, espace connu) sinon bloquer
ok - appareilVierge : ni rev, ni première synchronisation, ni marque « sale », index de graines de l’espace de démarrage seulement, aucune trace
ok - plafonds propres à l’espace : Naos garde 40 envois et 150 lectures ; Tofinou la moitié (20 et 75), par le paramètre de runSync
ok - plafonds des objets lourds propres à l’espace : Naos 20 / 40 (défaut), Tofinou 10 / 20 par deps.caps
```

Fixture de la v43 (`node tests/helpers/graines.mjs --capture <extraction de 5e9b8a5> …`, deux captures identiques, `cmp` vrai, aucune suite de 64 hexadécimaux) : 5 cas de semis (neuf, rade.events.v1, graine à ramener, pierre tombale du GPEN, marqueur posé), 6 fiches IC, 3 fusions ; 26 684 octets.

Vérifications finales :
```
npm run check : 915 tests, 913 verts, 2 sautés (instantanés météo de Brest et de Bormes absents), 0 échec
node tools/gardes-toulon.mjs : OK SNPM · OK données de Toulon · OK modules du mode départ · OK tests figés · OK gel de Naos v43 · OK pack de Brest
git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : vrai ; garde SNPM (f80c365) : vraie ; data/brest.* = 5e9b8a5 : vrai
node -e "import('./js/archsync.js')…CAPS.w===40&&CAPS.r===150" : 0
node tools/stamp.mjs --check : à jour (avertissement non strict « contenu modifié depuis la v43 » : la release est pour 08-10)
PW_REQUIRED=1 node tools/regate-e2e.mjs espace-garde tofinou-demarrage deux-telephones archive archivehors naos-cles toulon-vue plan-eau brest-avion regate-brest gpen creer :
OK espace-garde · OK tofinou-demarrage · OK deux-telephones · OK archive · OK archivehors · OK naos-cles · OK toulon-vue · OK plan-eau · OK brest-avion · OK regate-brest · OK gpen · OK creer
Bilan : 12/12 scénario(s) OK
```

Tous les scénarios de l’outil (`PW_REQUIRED=1 node tools/regate-e2e.mjs`, sans nom) :
```
accueil, jour-j, deux-telephones, reprise, equipage, archive, archive-bouees, archivehors, creer, manche, auteur, ic, depuis-ic, vraisemblance,
gel, debrief-tardif, gpx, gpx-choix, ia, ia-erreurs, arbitre, bouees, guide, entetes, retour-port, banane, banane-manche, banane-debrief,
porte-ic, modifier-manche, toulon-vue, plan-eau, brest-avion, regate-brest, brest-courant, gpen, naos-cles, tofinou-demarrage, espace-garde : OK
Bilan : 39/39 scénario(s) OK
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocage] Formulaire de régate et liste blanche de l’archive passés en tâche 1**
- **Trouvé pendant :** tâche 1 — avec Bormes au registre, deux tests existants (formulaire « Plan d’eau », parité archmerge ↔ registre) cassaient `npm run check`, exigé vert à chaque commit.
- **Correction :** `newRegattaFormHTML(…, { ids, defaut })` (défaut : espace courant) et `VENUE_IDS` d’archmerge à trois plans d’eau dès la tâche 1 ; le reste de la tâche 2 inchangé.
- **Commit :** 56c196f

**2. [Rule 1 - Bug] Conseils de Toulon à Bormes**
- **Problème :** `regimeOf` retombait sur les régimes de Toulon pour une liste vide ; `presets: null`, `texts: null` et `links: null` auraient affiché les vents prédéfinis, les textes de relief (Cépet, Sicié) et les liens Windguru de Toulon à Bormes.
- **Correction :** `regimeOf` : liste vide = aucun régime (Toulon `null` et Brest inchangés) ; descripteur de Bormes avec `regimes: []`, `presets: []`, textes neutres (« milieu de la baie », relief générique) et liens neutres (bulletin côtier, Windy). js/tactics.js modifié (hors de la liste du plan).
- **Commit :** 56c196f

**3. [Rule 2 - Robustesse] Ligne de départ absente**
- **Problème :** `LINE_PRESETS[…] || LINE_PRESETS.vignettes` vaut `undefined` hors de Toulon si `S.linePreset` n’existe pas au plan d’eau (réglages de Naos restés dans rade.state).
- **Correction :** `|| Object.values(LINE_PRESETS)[0]` en dernier recours (Naos : `vignettes` existe toujours, chemin identique).
- **Commit :** 56c196f

**4. [Rule 2] Plan d’eau d’une régate créée borné à l’espace**
- **Correction :** js/app.js passe à `createRegatta` un plan d’eau de `ESPACE.venues`, sinon son défaut (une valeur du DOM modifiée ne peut pas créer une régate « bormes » dans Naos) ; `packGo` et `switchVenue` refusent un plan d’eau hors de l’espace.
- **Commit :** 56c196f, f1597e4

**5. [Rule 3] T11 sans git pendant npm test**
- **Problème :** le plan demandait une extraction `git archive 5e9b8a5` dans le test ; un déploiement (porte de Vercel) peut ne pas avoir l’historique, et 08-01 a fixé « aucun accès à git pendant npm test ».
- **Correction :** référence capturée une fois (tests/helpers/graines.mjs `--capture`, tests/fixtures/graines-v43.json), comparée à chaque `npm test` ; mêmes appels que js/app.js de la v43.
- **Commit :** f1597e4

**6. [Rule 1 - Bug de test] Assertion sur un nœud du DOM**
- **Problème :** un `assert.equal(element, null)` en échec faisait sérialiser un nœud linkedom (graphe cyclique) : processus tué faute de mémoire.
- **Correction :** assertions sur des booléens.
- **Commit :** f1597e4

**7. Interprétations**
- Adoption : `rade.state` est aussi retiré (appareil vierge : rien à perdre ; sans cela, les réglages de Toulon empêchaient les défauts de Bormes).
- `refreshMembre` sur un hôte inconnu : l’espace est vérifié avant le prénom ; autre espace → ni prénom écrit ni auteur complété (aucune donnée modifiée) ; nouvel essai de `/api/membre` au retour du réseau et à chaque synchronisation tentée tant que l’espace n’est pas confirmé.
- Espace annoncé inconnu (ni `naos` ni `tofinou`) : jamais adopté (sinon boucle de rechargements), synchronisation arrêtée.
- Carte « Pavillons de classe » omise hors de Naos quand la fiche n’en a pas (Naos : toujours affichée, comme en v43).
- `bootEspace` compare l’hôte en minuscules ; `rade.espace.v1` est une chaîne brute (`tofinou`), non du JSON.
- tests/bormes.test.mjs passe à `setVenue('bormes')` et compare le descripteur à la configuration (point transmis par 08-03).
- Scénario tofinou-demarrage avec son propre serveur et le service worker autorisé (mode avion réel) ; la route de `/api/membre` est bien interceptée avec le worker actif.

## Known Stubs

| Fichier | Stub | Raison | Plan |
|---------|------|--------|------|
| js/venue-bormes.js | `MARKS: {}`, `COURSES: []` (banane seule), `PLACES`, `FORBIDDEN_ZONES`, `DANGERS`, `regimes`, `presets` vides | savoir local et catalogue prévus plus tard | 08-07, 08-08 |
| js/app.js (carte « État de la mer ») | titre « large de Cépet » et « faible en rade » affichés à Bormes (point marin du descripteur) | texte de Toulon en dur (piège 2, D-12) | 08-07 |

Les deux sont inscrits dans .planning/WINDOWS.md.

## Threat Flags

Aucune surface nouvelle hors du `<threat_model>` : `rade.espace.v1` (T-08-15, accepté : ne choisit que l’affichage sur un hôte inconnu), garde T-08-14 et plafonds T-08-16 en place.

## Points pour 08-05

- Bateau : `ESPACE.bateau` porte `{ classe, longueur }` (Naos `J80`, 8 ; Tofinou `Tofinou 9.5`, 9,47) ; la polaire par défaut de l’espace se branche là où js/app.js applique `S.polar` (après `setEspace`) ; `rade.state` est séparé par l’adresse, donc une polaire personnelle de Naos ne passe jamais chez Tofinou.
- Pertes de virement / empannage (11 s / 8 s) : le routage garde les défauts du J80 de js/router.js (`tackLoss = 9`, `gybeLoss = 6`, options construites par `routeOpts` de js/tactics.js) ; l’onglet J80 (`renderJ80`) et le texte « … pour un J80 » du briefing (js/app.js) sont encore ceux de Naos.
- Ajouter tout nouveau module public (`js/polar-tofinou95.js`, `data/tofinou95.pol` s’il est dans la liste hors réseau) à `AJOUTS_SHELL` de tests/helpers/naos.mjs, puis `npm run stamp` ; Naos le demandera s’il est importé statiquement (scénario naos-cles).
- Scénario tofinou-demarrage : base pour vérifier la polaire à Bormes (hôte `tofinou.localhost`, `membreEspace`, `tofinouSansNaos`).
- Sur un hôte inconnu, l’app démarre en Naos tant que `rade.espace.v1` n’est pas posée : un code de Romain (double) y reste Naos (premier espace du code, 08-02) ; pour essayer Tofinou en local, `tofinou.localhost`.

## Self-Check: PASSED

- FOUND : js/espaces.js, js/venue-bormes.js, tests/helpers/graines.mjs, tests/fixtures/graines-v43.json
- FOUND : 56c196f, f1597e4, 8f3a7de (ancêtres de HEAD) ; 3 commits mesurés entre plan_head_before et plan_head_after
