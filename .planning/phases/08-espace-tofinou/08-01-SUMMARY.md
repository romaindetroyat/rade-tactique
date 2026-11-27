---
phase: 08-espace-tofinou
plan: 01
subsystem: tests
status: complete
tags: [gel, naos, v43, non-regression, middleware, archive, ia, shell, e2e]
requires: []
provides:
  - "tests/fixtures/naos-v43.json : serveur, IA, liste hors réseau et pack de Brest de la v43 figés (from 5e9b8a5)"
  - "tests/helpers/naos.mjs : naosCases, modulesNaos, fichiersDepot, shellDe, AJOUTS_SHELL, TAILLE_AJOUT_MAX, differencesAdmises, canon, capture --capture <racine> <sortie>"
  - "tests/naos.test.mjs dans npm test (11 tests)"
  - "scénario naos-cles et tests/fixtures/naos-cles-v43.json"
  - "tools/gardes-toulon.mjs : six gardes (e : gel de Naos, f : pack de Brest)"
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-09, 08-10, 08-11]
tech-stack:
  added: []
  patterns: ["capture sur extraction git archive + cmp", "différences admises jamais exigées"]
key-files:
  created:
    - tests/helpers/naos.mjs
    - tests/naos.test.mjs
    - tests/fixtures/naos-v43.json
    - tests/fixtures/naos-cles-v43.json
  modified:
    - tests/helpers/codesimule.mjs
    - tools/gardes-toulon.mjs
    - tools/regate-e2e.mjs
decisions:
  - "Gel de Naos : les sections ia et brest gardent des SHA-256 en hexadécimal (contenus des consignes et des fichiers) ; le contrôle « aucune suite de 64 hexadécimaux » porte sur les autres sections, et aucune empreinte de la table du middleware n’apparaît nulle part dans la fixture"
  - "Gel de Naos : la liste `publics` est calculée sur l’arbre de 5e9b8a5 (git ls-tree) à la capture et sur les fichiers du dépôt au test ; « servi sans code » = non intercepté, ou transmis, réécrit ou 200 pour un visiteur sans code (prépare 08-06)"
  - "Gel de Naos : une différence admise (espace/espaces de /api/membre, x-rt-espace: naos) n’est jamais exigée ; elle n’est acceptée que si le code courant rend exactement « naos »"
  - "Gel de Naos : en v43, un x-rt-espace forgé par le navigateur (« tofinou ») est transmis tel quel aux fonctions /api/ ; c’est la capture, la v44 doit le remplacer par « naos » (08-02)"
metrics:
  duration: 13min
  completed: 2026-11-26
estimate:
  tokens: 110000
  tasks: 3
actuals:
  tokens: 59600
  tasks: 3
  commits: 4
plan_head_before: 698a171a1b7f97cdd06c4428ab9de5fd8bda7d8e
plan_head_after: 9c03a591cd2a8f93d2535eed83a56a5c5fac2b7e
---

# Phase 8 Plan 01 : gel de Naos v43 Summary

Naos v43 figé sur l’extraction de 5e9b8a5 avant toute modification : 480 réponses du middleware (faux code `code-de-test`), 12 fichiers publics, archive et compteur d’IA sur faux Blob (chemins, journal des opérations, documents), empreintes des consignes des quatre fonctions d’IA, SHELL (76 fichiers), pack de Brest (10 fichiers), et clés, bases, caches et 65 adresses de l’app (scénario `naos-cles`). Tout écart casse `npm test` ; `tools/gardes-toulon.mjs` rejoue six gardes.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | f2d388e | `tests/helpers/naos.mjs` (sections middleware, publics, archive, quota ; `differencesAdmises` ; capture), `tests/naos.test.mjs`, fixture, `codesimule.mjs` paramétrable par chemin (défaut inchangé) |
| 2 (tdd) | d99c524 | sections `ia`, `shell`, `brest` (tests rouges d’abord : 4 échecs, puis verts) ; gardes (e) et (f) |
| 3 | 9c03a59 | scénario `naos-cles` dans `tools/regate-e2e.mjs`, `tests/fixtures/naos-cles-v43.json` ; `codesimule.mjs` chargé à la demande dans `naos.mjs` |

Le décompte mesuré (4 commits entre `plan_head_before` et `plan_head_after`) comprend 4ebd154, commit de documentation de l’orchestrateur (plan 08-11) arrivé pendant l’exécution ; les commits de ce plan sont les trois ci-dessus.

## Nombre de cas par section (tests/fixtures/naos-v43.json, 200 548 octets, une ligne)

| Section | Cas |
|---------|-----|
| middleware | 480 = 2 hôtes × 5 états (sans code, lien faux code, lien inconnu, cookie faux code, cookie inconnu) × 12 requêtes × 4 variantes (simple, navigation, en-têtes forgés, les deux) |
| publics | 12 fichiers (acces.html, acces.js, 6 icônes, manifest.webmanifest, 2 rapports, sw.js) |
| archive | 2 environnements (sans, production) × 25 étapes ; 19 opérations Blob ; 5 objets (`light`, `trace`, `report`, `day/…/romain`, `trash/…`) |
| quota | 2 environnements × 32 gardes (31 Romain, le 31e en 429, 1 Teiva) + un appel sans prénom ; `<env>/quota/2026-12-05/{romain,teiva}.json` |
| ia | rules, debrief, voice (Toulon et Brest) + ic ; Toulon = empreintes de `ia-toulon-v42.json` |
| shell | 76 fichiers |
| brest | 10 fichiers `data/brest.*` + entrée `brest` de `data/venues.json` |

`tests/fixtures/naos-cles-v43.json` (1 346 octets) : 8 clés, 1 base (`rade-traces`), 1 cache (`rade-<id>`), 65 adresses.

Durée de `tests/naos.test.mjs` : 375 ms (11 tests).

## Sorties brutes

Capture et déterminisme du gel serveur (commande de la tâche 2, extraction `middleware.js api js data sw.js tools package.json`) :
```
DETERMINISTE
-rw-r--r-- 1 root root 200548 Nov 26 18:55 tests/fixtures/naos-v43.json
76 10 [ 'rules', 'debrief', 'voice', 'ic' ]
NAOS-CMP-OK        (recapture finale après la tâche 3, cmp identique)
```

`node --test … tests/naos.test.mjs` :
```
ok 1 - fixture de Naos : capturée sur 5e9b8a5 (v43)
ok 2 - Naos v43 : middleware identique à la capture (différences admises seulement)
ok 3 - Naos v43 : publics identique à la capture (différences admises seulement)
ok 4 - Naos v43 : archive identique à la capture (différences admises seulement)
ok 5 - Naos v43 : quota identique à la capture (différences admises seulement)
ok 6 - Naos v43 : ia identique à la capture
ok 7 - Naos v43 : brest identique à la capture
ok 8 - Naos v43 : consignes de Toulon de la v43 = empreintes de la v42 (tests/fixtures/ia-toulon-v42.json)
ok 9 - Naos v43 : liste hors réseau — tout le SHELL de la v43 reste, ajouts limités à AJOUTS_SHELL (64 Ko au plus chacun), aucun pack
ok 10 - Naos v43 : les différences admises ne masquent rien (un écart ailleurs reste visible)
ok 11 - la fixture ne contient ni empreinte de la table ni code autre que le faux code
# pass 11
# fail 0
```

Contrôle négatif du gel (copie temporaire de l’extraction, préfixe d’archive changé en `naos/prod`) :
```
middleware null
publics null
archive archive.production.etapes[0].body.env : "naos/prod" ≠ "prod"
quota null
```

Gardes (`node tools/gardes-toulon.mjs`) :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
OK gel de Naos v43 (tests/naos.test.mjs)
OK pack de Brest (data/brest.* = 5e9b8a5)
```
Contrôle négatif dans une copie (`--racine`, un octet ajouté à `data/brest.meta.json`, préfixe d’archive changé) : « ÉCHEC gel de Naos v43 » (archive, brest) et « ÉCHEC pack de Brest », code 1.

Scénario `naos-cles`, capture en servant l’extraction complète de 5e9b8a5 puis comparaisons :
```
  capture écrite : tests/fixtures/naos-cles-v43.json (8 clés, 1 bases, 1 caches, 65 adresses)
OK naos-cles
FIXTURE-OK         (cmp avec une capture antérieure ; 4 captures identiques, dont une sur l’arbre courant, md5 bf7390f9…)
CMP-OK             (commande de vérification de la tâche 3)
OK naos-cles
OK toulon-vue
OK archive
OK accueil
Bilan : 4/4 scénario(s) OK
```
Contrôle négatif (extraction servie avec une clé `rade.nouveau.v1` de plus) : « ÉCHEC naos-cles : cles différentes de la v43 ».

`npm run check` : 860 tests, 859 verts, 1 sauté (instantané météo de Brest absent, comme en v43), 0 échec. `git diff --quiet 5e9b8a5 -- js api data middleware.js sw.js` vrai ; garde SNPM vraie.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de plan] Contrôle « aucune suite de 64 hexadécimaux » incompatible avec les sections `ia` et `brest`**
- **Trouvé pendant :** tâche 2
- **Problème :** la tâche 1 exige qu’aucune suite de 64 hexadécimaux n’apparaisse dans la fixture ; la tâche 2 y met des SHA-256 en hexadécimal (consignes, fichiers de Brest, entrée de `venues.json`).
- **Correction :** le test vérifie qu’aucune empreinte de la table du middleware (lue à l’exécution) n’apparaît dans toute la fixture, et qu’aucune suite de 64 hexadécimaux n’apparaît hors des sections `ia` et `brest`. La commande `! grep -Eq '[0-9a-f]{64}' tests/fixtures/naos-v43.json` de la vérification de la tâche 1 n’est vraie que pour la fixture de la tâche 1.
- **Fichiers :** tests/naos.test.mjs · **Commit :** d99c524

**2. [Rule 3 - Blocage] `publics` calculé sans l’extraction complète**
- **Trouvé pendant :** tâche 1
- **Problème :** l’extraction de la capture ne contient pas `acces.html`, `icons/`, `rapports/` ; une liste calculée sur elle serait vide, et une liste calculée sur le dépôt courant changerait à chaque fichier public ajouté.
- **Correction :** à la capture, liste des fichiers de l’arbre de 5e9b8a5 (`git ls-tree`) ; au test, fichiers du dépôt (même parcours que tests/access.test.mjs). Aucun accès à git pendant `npm test`.
- **Commit :** f2d388e

**3. [Rule 1 - Déterminisme] Clé `rade.reprise.v1` écrite 1,5 s après la carte**
- **Trouvé pendant :** tâche 3 (deux captures différaient par `/js/reprise.js`)
- **Correction :** le scénario attend `rade.reprise.v1` (écrite par tout appareil neuf en v43), puis `networkidle` avant les relevés ; quatre captures identiques ensuite.
- **Commit :** 9c03a59

**4. [Rule 3] `tests/helpers/naos.mjs` importait `setup.mjs` (via codesimule) au chargement**
- **Problème :** `tools/regate-e2e.mjs` doit importer `AJOUTS_SHELL` ; setup.mjs remplace `fetch` et `DOMParser`, ce qui fausserait d’autres scénarios (brest-avion).
- **Correction :** `codesimule.mjs` est importé à la demande dans `casMiddleware` ; fixture inchangée (cmp).
- **Commit :** 9c03a59

**5. Choix d’interprétation**
- Variante « navigation » = `sec-fetch-mode: navigate` + `accept: text/html` ; les en-têtes forgés sont une variante, combinée aussi avec la navigation.
- L’archive et le compteur enregistrent aussi le journal complet des opérations du faux Blob (lectures et écritures), pas seulement les chemins écrits : une opération de plus pour Naos (quota Blob commun, D.3 de la recherche) se voit.
- Le nom du modèle d’IA n’est pas relevé dans la section `ia` (seules les consignes sont hachées).
- Caches relevés dans un second contexte avec service worker autorisé (sans route) : avec le worker bloqué, `caches.keys()` est vide.

### Exigence

ESPACE-05 n’est pas cochée dans REQUIREMENTS.md : la traçabilité la donne « Pending (08-01, preuve finale 08-10) » ; ce plan en pose le gel, la preuve finale (même URL, même archive en production) reste à 08-10.

## Points pour 08-02

- En v43, le middleware transmet tel quel un `x-rt-espace` forgé par le navigateur (« tofinou ») aux fonctions /api/ (cas `… | forges` de la section middleware) : 08-02 doit l’écraser par « naos » ; `differencesAdmises` l’accepte seulement si la valeur courante est exactement « naos ».
- `/api/membre` : `espace` et `espaces` admis seulement si `espace === 'naos'` et `espaces` est une liste de chaînes qui contient « naos » ; l’ordre des clés est indifférent (comparaison canonique).
- Les requêtes d’archive et d’IA du gel portent déjà `x-rt-espace: naos` ; une requête sans cet en-tête (« GET léger sans x-rt-membre » porte `x-rt-espace` seul ; « sans aucun en-tête ») est figée en 403 `membre_inconnu` : si 08-02 rend `espace_inconnu` pour l’appel sans aucun en-tête, c’est un écart à admettre explicitement dans `differencesAdmises` (avec l’accord de la phase), pas à recapturer.
- `tableEquipage()` lit toutes les lignes `'<64 hex>': '<prénom>'` du fichier : si la table Tofinou de 08-02 a la même forme, la première ligne doit rester celle de Naos (Romain) pour que le faux code reste un code Naos.
- 08-06 : `publics` passe déjà par le middleware pour les chemins interceptés (transmis, réécrits ou 200 sans code comptent comme publics) ; un nouveau fichier public sur l’hôte de Naos (manifeste Tofinou, icônes) sera un écart à traiter dans `differencesAdmises`.
- Recapture : `node tests/helpers/naos.mjs --capture "$W" …` exige maintenant `data` et `sw.js` dans l’extraction (commande de la tâche 2).

## Self-Check: PASSED

- FOUND : tests/helpers/naos.mjs, tests/naos.test.mjs, tests/fixtures/naos-v43.json, tests/fixtures/naos-cles-v43.json, tools/gardes-toulon.mjs, tools/regate-e2e.mjs, tests/helpers/codesimule.mjs
- FOUND : f2d388e, d99c524, 9c03a59 (ancêtres de HEAD)
