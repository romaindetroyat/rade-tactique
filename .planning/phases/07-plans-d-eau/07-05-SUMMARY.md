---
phase: 07-plans-d-eau
plan: 05
subsystem: archive-plan-d-eau
status: complete
tags: [plan-d-eau, brest, archive, fusion, v42, compatibilite, recalage, d-04, d-05, d-06, d-12]
requires:
  - "07-04 : packGo / switchVenue (téléchargement vérifié, refus en course, rechargement), carte « Plan d’eau », VENUE_KEYS, S.byVenue"
  - "07-02 : registre js/venues.js (VENUES, VENUE_IDS, inBounds, venueAt, inputBounds), js/lieu.js"
provides:
  - "js/archmerge.js : `venue` dans HEAD, fusionné comme un registre daté par `vu` ; FICHE (duel de la fiche = champs de la v42) ; VENUE_IDS (liste blanche de l’archive)"
  - "api/archive.js : `venue` en liste blanche (retiré sans 400), `vu` futur ramené ; l’auteur de la fiche ne change pas pour le seul plan d’eau"
  - "js/venues.js : venueOf(r) (champ, sinon bouées confirmées, sinon Toulon), needsVenueRepair(r)"
  - "js/regates.js : createRegatta({ venue }) (écrit hors de Toulon seulement), openAtBoot({ here, reopen })"
  - "js/regview.js : « Plan d’eau » (#rgVenue) dans le formulaire, puce « Rade de Brest » (.rgv, liste et fiche), exemple de saisie du plan d’eau de la régate"
  - "js/app.js : askVenue (#vnAsk, « Passer » / « Annuler »), bandeau « Régate du jour en rade de Brest » (#regVenue), rade.venue.reopen { rg, tr }, repairVenues, D-12 (recalage CVAT à Toulon seulement), traces d’un autre plan d’eau (#trElse, #trVenue)"
  - "tools/compat-v42.mjs (7 contrôles) ; scénario regate-brest"
affects: [07-06, 07-07, 07-09, 07-10]
tech-stack:
  added: []
  patterns:
    - "champ ajouté à l’archive qu’une ancienne version ignore : registre « dernier écrit gagne » à part, daté par son propre instant, hors du duel de la fiche (jamais effacé par une copie qui l’ignore, fusion associative)"
    - "passage explicite à travers un rechargement : clé localStorage lue une seule fois au démarrage puis effacée (rade.venue.reopen)"
key-files:
  created:
    - tools/compat-v42.mjs
    - .planning/phases/07-plans-d-eau/deferred-items.md
  modified:
    - js/archmerge.js
    - api/archive.js
    - js/venues.js
    - js/regates.js
    - js/regview.js
    - js/regmarks.js
    - js/icread.js
    - js/app.js
    - tests/archmerge.test.mjs
    - tests/apiarchive.test.mjs
    - tests/regates.test.mjs
    - tests/venues.test.mjs
    - tests/regmarks.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "`venue` est un registre à part daté par `vu` (plus récent gagne, à égalité la plus grande valeur) et non « suit le gagnant du duel sauf s’il n’en a pas » : la règle du plan n’est pas associative (contre-exemple trouvé par le test de propriétés, graine 27 ; triplet Brest u1 / copie v42 u3 / « toulon » u2)"
  - "Le duel de la fiche porte sur FICHE (champs de la v42) : une régate de Toulon se fusionne exactement comme en v42 ; le seul changement de plan d’eau ne date pas la fiche et ne change pas son auteur"
  - "Une régate de Toulon n’a pas de champ `venue` (absent = Toulon) : createRegatta ne l’écrit qu’hors de Toulon ; les fiches de Toulon restent identiques à la v42 (compat-v41 inchangé et vert)"
  - "Liste blanche du serveur écrite dans js/archmerge.js (VENUE_IDS, comparée par test à VENUES) plutôt qu’importée de js/venues.js : la fonction n’embarque que archmerge (vercel.json includeFiles, Pitfall 15)"
  - "Ouvrir une régate d’un autre plan d’eau : « Annuler » ne l’ouvre pas (jamais de bouées de Brest injectées sur la carte de Toulon) ; « Passer » = packGo puis rechargement, régate rouverte par rade.venue.reopen"
  - "Bouées confirmées : déduction par les bornes de saisie (inputBounds, emprise ± 0,1°), celles qui ont servi à les lire"
metrics:
  duration: 45min
  completed: 2026-11-19
  tasks: 3
  files: 18
estimate:
  tokens: 140000
  tasks: 3
actuals:
  tokens: 28966        # chars/4 du diff e277631..4226b1b (115 865 caractères)
  tasks: 3
  commits: 5
plan_head_before: e2776315604c9c1c6852611b9e16797fc312d2d2
plan_head_after: 4226b1b
---

# Phase 7 Plan 05 : Plan d’eau d’une régate, partagé avec les téléphones v42 Summary

Une régate porte son plan d’eau (`venue`, fusionné par l’archive comme un registre daté par `vu`, qu’une copie venue d’un téléphone v42 n’efface jamais) ; l’ouvrir sur un autre plan d’eau propose « Passer » (pack téléchargé, rechargement hors course, régate rouverte), la régate du jour d’ailleurs est signalée par un bandeau ; le recalage CVAT ne joue qu’à Toulon ; une trace de Brest ne s’analyse que sur la carte de Brest ; Toulon inchangé (gardes, vue v42, fusion identique).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | d405e9c | `venue` dans HEAD et sa fusion (registre `vu`), liste blanche serveur, `venueOf`, `createRegatta({ venue })`, `openAtBoot({ here, reopen })`, formulaire et puce, fenêtre « Passer » / « Annuler », bandeau de la régate du jour, `rade.venue.reopen` ; 7 tests de fusion nouveaux (dont 3 000 triplets) + téléphone v42 simulé dans les 2 000 scénarios, 2 tests serveur, 3 tests de création / vues / ouverture ; scénario `regate-brest` |
| 1 (correctif) | dd00734 | `venue` écrit seulement hors de Toulon (forme de la v42 gardée) ; la proposition à la création lit `venueOf` |
| 2 | 0da3733 | `tools/compat-v42.mjs` (6 contrôles), `deferred-items.md` |
| 3 (TDD) | 0b678ee (rouge), 4226b1b (vert) | déduction par les bouées et `needsVenueRepair` (3 tests, rouges : export absent), D-12, `repairVenues`, traces d’un autre plan d’eau, bornes des IC par régate (1 test), scénario `regate-brest` étendu, compat-v42 (g) |

Tracer (tâche 1) : vérification rejouée avant la tâche 2 (mode interactif, `end-of-phase`, vérification automatique seulement) : tests verts, gardes vertes, `npm run check` 749 tests (748 verts, 1 sauté), SNPM-OK, « OK regate-brest », « OK deux-telephones », « OK archive », « OK creer », « OK toulon-vue », « OK archive-bouees », « OK plan-eau ».

## Version

`v42 · 09/11 · 30bfa611a6` (`npm run stamp`, 74 fichiers dans la liste hors réseau, aucun nouveau module). Le numéro reste 42 : la v43 est publiée en 07-10.

## Compatibilité (sorties brutes)

`W=$(mktemp -d) && git archive -o "$W/v42.tar" 56f6625 js package.json && tar -xf "$W/v42.tar" -C "$W" && node tools/compat-v42.mjs "$W"` (code 0) :
```
OK (a) v43 crée deux régates de Brest (deux bouées confirmées / aucune) ; la v42 les reçoit, les liste et ouvre leur fiche sans exception : 3 régates listées, fiches v42 de 1516 caractères
OK (b) la v42 ajoute une manche à chacune et synchronise : le serveur et la v43 gardent « brest » aux deux : manche 10:30 chez les deux, plan d’eau gardé
OK (c) la v42 renomme la régate sans bouée (tête de fiche) : le serveur et la v43 la gardent à Brest ; la copie de la v42 n’a pas de plan d’eau (limite consignée) : serveur et v43 : brest ; v42 : champ ignoré
OK (d) la v43 remet explicitement « toulon » : le serveur, la v43 et la v42 la voient à Toulon : toulon partout
OK (e) mergeDoc v42 et v43 : même résultat sur les régates de Toulon (sans plan d’eau) ; sur celles de Brest, mêmes données hors plan d’eau ; ni doublon ni résurrection : 4 paires de Toulon identiques, 2 paires de Brest
OK (f) la Coupe SNPM semée reste la même fiche sur les deux téléphones et sur le serveur : fiche de 2400 caractères
OK (g) copie v42 d’une régate de Brest avec bouées confirmées : la règle de la v43 la place à Brest par ses bouées (réparation possible) ; sans bouée, Toulon : brest par les bouées X1, X2
Compatibilité v42 : 7 contrôles OK
```
`W1=$(mktemp -d) && git archive -o "$W1/v41.tar" dda755b js package.json && tar -xf "$W1/v41.tar" -C "$W1" && node tools/compat-v41.mjs "$W1"` (code 0, outil inchangé) :
```
OK départ : régate de deux manches créée en v42, lue par la v41 par le serveur v42 : 1:07 10:55 p5 «vent faible» | 2:07 13:25 p3
OK v41 lit une manche modifiée en v42 (même heure) : nouvelle version, même identifiant, fiche v41 sans erreur ni balise, ancienne version dans son historique : fiche v41 de 2539 caractères
OK v41 lit une manche déplacée en v42 (10:55 → 14:00) : une seule manche, au nouvel identifiant ; l’ancien a sa pierre tombale : 1:07 13:25 p3 | 2:07 14:00 p3 «grain <img src=x onerror=alert(1)>»
OK v41 en retard : un état d’avant le déplacement (sa saisie comprise) renvoyé par la v41 ne fait ni doublon ni résurrection : 1:07 13:25 p3 | 2:07 14:00 p3 «grain <img src=x onerror=alert(1)>» | 3:08 11:00 p3
OK v41 supprime la manche déplacée, v42 modifie l’autre : les deux gestes arrivent partout : 1:07 13:25 p3 «dernière manche» | 2:08 11:00 p3
OK v42 modifie une manche écrite par la v41 (sans changer l’heure, puis en la déplaçant) : 1:07 13:25 p3 «dernière manche» | 2:08 12:00 p3
OK mergeDoc v41 et v42 : même résultat (et commutatif) sur les documents de ce scénario, déplacement concurrent compris : 3 paires
Compatibilité v41 : 7 contrôles OK
```

## Limite (c), pour le guide (07-10)

Un téléphone resté en v42 ne connaît pas le plan d’eau : il affiche toute régate comme une régate de Toulon (sa copie locale n’a jamais le champ `venue`, et les positions de Brest s’y lisent mal : longitude Ouest). Il ne casse rien et n’efface rien : le serveur et les téléphones v43 gardent « Rade de Brest », même après qu’il a renommé la régate ou ajouté une manche. Une régate de Brest sans bouée confirmée est donc vue « à Toulon » sur ce téléphone v42 seulement ; avec des bouées confirmées, la v43 la replace à Brest par ses bouées même si le champ venait à manquer. Consigne : **mettre les trois téléphones à jour le même jour**, avant de créer une régate à Brest.

## Vérifications finales (sorties brutes)

Sur 4226b1b :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
npm run check : stamp à jour · # tests 753 · # pass 752 · # fail 0 · # skipped 1 (instantané météo de Brest absent)
SNPM-OK ; git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : inchangés
PW_REQUIRED=1 node tools/regate-e2e.mjs (tous) : OK accueil, jour-j, deux-telephones, reprise, equipage, archive, archive-bouees,
  archivehors, creer, manche, auteur, ic, depuis-ic, vraisemblance, gel, debrief-tardif, gpx, gpx-choix, ia, ia-erreurs, arbitre,
  bouees, guide, entetes, retour-port, banane, banane-manche, banane-debrief, porte-ic, modifier-manche, toulon-vue, plan-eau,
  brest-avion, regate-brest
Bilan : 34/34 scénario(s) OK
```
Tests ajoutés : tests/archmerge.test.mjs 7 (et le téléphone v42 simulé dans les 2 000 scénarios, opération « changer le plan d’eau »), tests/apiarchive.test.mjs 2, tests/regates.test.mjs 1 (et 2 tests complétés : création, règle d’ouverture), tests/venues.test.mjs 5, tests/regmarks.test.mjs 1.

Scénario `regate-brest` (deux téléphones, vraie fonction api/archive.js sur faux Blob) : formulaire « Plan d’eau » (défaut Toulon), création à Brest depuis Toulon → fenêtre, « Annuler », bandeau « Régate du jour en rade de Brest » ; synchronisation ; B voit la puce, « Ouvrir » → fenêtre → « Passer » → pack téléchargé, rechargement à Brest, régate ouverte, clé effacée, relance : ouverte au lancement ; à Brest aucun « Recaler », recalage gardé non appliqué, recalage reçu gardé sans toucher aux marques ni message ; retour à Toulon : les deux recalages appliqués, « Recaler » revenu ; trace GPX de Brest importée à Toulon → « Cette trace a été faite en rade de Brest… », aucune analyse ni débrief, « Passer » → trace analysée à Brest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Règle de fusion du plan non associative**
- **Trouvé pendant :** tâche 1 (tests de propriétés).
- **Problème :** « `venue` suit le gagnant du duel de la fiche, sauf si le gagnant n’en a pas » : la valeur héritée entre dans le contenu de la fiche fusionnée et change le duel suivant ; surtout, elle perd sa date. Contre-exemple : Brest (u = 1), copie v42 renommée (u = 3), « toulon » explicite (u = 2) donnent Brest ou Toulon selon l’ordre des échanges. Contrôle négatif : la règle du plan, branchée dans le test des 2 000 scénarios (avec téléphone v42 simulé), échoue (« ordre d’échange : état différent (graine 27) »).
- **Correction :** `venue` fusionné comme un registre à part, daté par `vu` (posé par `stamp` quand le plan d’eau change), hors du duel de la fiche (FICHE = champs de la v42). Une copie sans `venue` n’efface jamais une valeur connue (but du plan), et la fusion reste commutative, associative et idempotente (3 000 triplets, 2 000 scénarios).
- **Fichiers :** js/archmerge.js, api/archive.js (`vu` gardé, ramené s’il est dans le futur), tests/archmerge.test.mjs, tests/apiarchive.test.mjs. **Commit :** d405e9c

**2. [Précision - D-01] `venue` absent pour une régate de Toulon**
- **Plan :** `createRegatta` garde `venue` « sinon 'toulon' ».
- **Fait :** le champ n’est écrit que hors de Toulon (absent = Toulon, D-06). Écrire « toulon » partout changeait la forme des fiches de Toulon (compat-v41 voyait des données différentes) sans aucun gain : déduction et réparation ne touchent jamais une régate de Toulon. « toulon » explicite reste possible (et gagne s’il est plus récent : contrôle (d)). **Commit :** dd00734 (avec le correctif de la proposition à la création, qui lit désormais `venueOf`).

**3. [Précision - Pitfall 15] Liste blanche du serveur dans js/archmerge.js**
- **Plan :** `VENUE_IDS` « écrite dans js/venues.js, importée » par api/archive.js.
- **Fait :** `VENUE_IDS` exporté par js/archmerge.js (le seul module embarqué par la fonction, `includeFiles`), comparé par un test à `Object.keys(VENUES)` et à `VENUE_IDS` de js/venues.js. Importer js/venues.js aurait ajouté js/courses.js et js/venue-brest.js au paquet de la fonction sans `includeFiles` (risque d’erreur 500 en production).

**4. [Rule 1 - Bug] Bornes de lecture des IC d’une régate (point de 07-04)**
- `marksFromReview` (bouées lues des IC) et `moveMark` lisaient les positions avec les bornes de Toulon : à Brest, toute bouée lue des IC aurait été « position à saisir ». Elles prennent maintenant les bornes de `venueOf(régate)` (icread : celles de la régate relue, sinon du téléphone) ; l’exemple de saisie de la fiche suit le plan d’eau de la régate. Toulon : mêmes bornes et même message qu’en v42 (test).

**5. [Précision - garde existante] Règle d’ouverture au lancement**
- La garde « OPEN posé au chargement par la règle d’ouverture et changé par setOpen seulement » est gardée : le plan d’eau entre dans la règle pure `openAtBoot({ now, list, here, reopen })` (sans `here` : la règle de la v42), et l’expression attendue par la garde est mise à jour (tests/regates.test.mjs).

**6. [Rule 2] Recalage proposé par une trace**
- Les virages d’une trace proposés pour recaler une bouée « à confirmer » (`renderTraceDetail`) sont aussi limités au cahier CVAT à Toulon (`cvatKey` inclut le plan d’eau) : à Brest, une bouée approximative du catalogue ne doit pas recevoir un recalage partagé sous une clé du CVAT.

### Hors périmètre (deferred-items.md)

- Auteur de tête (`ub`) de la Coupe SNPM semée jamais modifiée, différent d’un téléphone à l’autre : déjà le cas entre deux téléphones v42 (vérifié), métadonnée seulement.

## Known Stubs

Aucun nouveau. Toujours ouverts (07-04) : `data/brest.wx-snapshot.json` absent (07-10), `VENUE_DEF.brest.courseId` banane faute de catalogue du GPEN (07-09).

## Threat Flags

Aucune nouvelle surface hors du registre du plan : aucune route ni en-tête, middleware inchangé. T-07-14 (liste blanche serveur `cleanDoc` et page `venueOf` / `bootVenue`, `__proto__` sans effet, tests), T-07-15 (registre `vu`, déduction, réparation, `tools/compat-v42.mjs`, consigne de mise à jour le même jour), T-07-16 (D-12 : recalage appliqué, proposé et reçu seulement à Toulon, scénario `regate-brest`) appliqués. Valeur reçue `rade.venue.reopen` : identifiants textuels bornés à 80 caractères, une régate n’est rouverte que si elle existe et se court sur le plan d’eau chargé. Aucun code d’accès ni empreinte écrit ou affiché ; aucun appel à l’IA.

## Points pour 07-06

- Les marques de Brest arriveront dans `BREST.MARKS` : si certaines ont des clés numériques (« 1 »…), elles ne recevront jamais de recalage du CVAT (D-12 : `cvatKey` et `applyRemoteMarks` testent le plan d’eau), mais `sharedMarks` envoie toujours les recalages gardés sur le téléphone ; préférer des clés non numériques (`b1`…) pour éviter toute confusion d’affichage.
- `venueOf(r)` déduit le plan d’eau par les `inputBounds` : ne pas les rétrécir sans relire la déduction ; l’emprise des données (`bounds`) sert à `venueAt` (traces).
- Une régate n’a pas d’interface pour changer son plan d’eau après création (hors réparation) : si l’équipage en veut une, écrire `venue` (toulon compris) explicitement, `stamp` date `vu`.
- `rade.venue.reopen` accepte `{ rg, tr }` : un autre passage (débrief, régate depuis les IC) peut s’y ajouter sans nouvelle clé.
- Le bandeau « Régate du jour en … » remplace « Entraînement libre » dans `#regBar` quand aucune régate n’est ouverte et qu’une régate d’aujourd’hui se court ailleurs (`dayElsewhere`) : à surveiller pour le 13/12 si un téléphone est resté sur Brest.

## Self-Check: PASSED
