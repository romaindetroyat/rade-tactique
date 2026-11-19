---
phase: 07-plans-d-eau
plan: 01
subsystem: tests
status: complete
tags: [non-regression, toulon, v42, fixture, e2e, gardes]
requires: []
provides:
  - "tests/fixtures/toulon-v42.json : calculs et données de Toulon v42 figés (capturés sur 56f6625)"
  - "tests/toulon.test.mjs : non-régression Toulon dans npm test (porte de déploiement)"
  - "tools/gardes-toulon.mjs : toutes les gardes Toulon en une commande (0 / 1)"
  - "scénario toulon-vue + tests/fixtures/vue-toulon-v42.json : vues de Toulon v42 figées"
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10]
tech-stack:
  added: []
  patterns:
    - "capture sur extraction git archive d’un commit, modules passés en paramètre (comme tests/helpers/legs.mjs)"
    - "comparaison profonde à 1e-9 relatif (sameDeep) après aller-retour JSON"
    - "E2E_ROOT / E2E_CAPTURE : servir une extraction et capturer une vue"
key-files:
  created:
    - tests/helpers/toulon.mjs
    - tests/fixtures/toulon-v42.json
    - tests/toulon.test.mjs
    - tools/gardes-toulon.mjs
    - tests/fixtures/vue-toulon-v42.json
  modified:
    - tools/regate-e2e.mjs
    - tools/serveur-local.mjs
decisions:
  - "Le gel des analyses reprend aussi le départ conseillé de runAnalysis (cinq points de la ligne routés, premier bord parti du meilleur) : le premier bord affiché en dépend"
  - "Le champ de vent n’est calculé qu’une fois par vent pour les analyses, la section vent et les routes (durée du test : 28 s au lieu d’environ 35 s)"
  - "tools/serveur-local.mjs reçoit une option entetes : l’extraction est servie avec les en-têtes du dépôt (le plan l’exigeait, la signature ne le permettait pas)"
  - "vue-toulon-v42.json écrit en JSON compact, pour contenir littéralement \"from\":\"56f6625\""
metrics:
  duration: 18min
  completed: 2026-11-19
  tasks: 3
  files: 7
estimate:
  tokens: 110000
  tasks: 3
actuals:
  tokens: 393451      # chars/4 du diff complet, fixtures générées comprises (1,46 Mo + 81 ko) ; code écrit à la main seul : 7 612
  tasks: 3
  commits: 3
plan_head_before: 2d8ff1039f4e291cd2bb96fc105d1f9b634dfb68
plan_head_after: 0558f2ebb2158dcb7555676dedbc81addf873d3c
---

# Phase 7 Plan 01 : Gel de Toulon v42 Summary

Toulon v42 figé avant tout changement : 133 cas de bords, 66 analyses complètes comme runAnalysis, champ de vent, 40 routes, régimes, positions, météo et empreintes SHA-256 des huit fichiers de données capturés sur l’extraction de 56f6625 et comparés à 1e-9 à chaque `npm test` ; texte de cinq onglets dans quatre états capturé en servant 56f6625 (scénario `toulon-vue`) ; `tools/gardes-toulon.mjs` rejoue toutes les gardes en une commande.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 803e6e7 | `tests/helpers/toulon.mjs` (toulonCases, sameDeep, DATA_TOULON, capture `--capture <racine> <sortie>` avec sa cale fetch), sections `bords` et `analyses`, `tests/toulon.test.mjs` |
| 2 (TDD) | 29b4c10 | sections `vent`, `routes`, `regimes`, `positions`, `meteo`, `donnees` (tests écrits d’abord : 6 échecs constatés, puis verts) ; `tools/gardes-toulon.mjs` |
| 3 | 0558f2e | scénario `toulon-vue`, `E2E_ROOT`, `E2E_CAPTURE`, option `entetes` du serveur local, `tests/fixtures/vue-toulon-v42.json` |

### Contenu de la fixture `tests/fixtures/toulon-v42.json` (1 462 218 octets)

| Section | Cas | Taille JSON |
|---------|-----|-------------|
| bords | 133 (legCases de la v37 : 1-13 G/P, tours, deux vents, variantes de ligne, régate archivée ; + 6 bananes de BAN_CASES avec portes et ligne d’arrivée) | 376 ko |
| analyses | 66 = (1, 3G, 3P, 5, 7, 9G, 9P, 12, 13G, 13P, banane 3 tours) × six vents 315/25, 265/14, 215/10, 140/14, 85/12, 40/6 ; ligne, départ (biais, extrémité, conseils, départ conseillé), bords (legVue), conseils de marque, temps total | 927 ko |
| vent | 6 vents × (11 marques + 4 lignes + 95 cellules de mer de 1 500 m), spd/dir/gust/shelter/block | 96 ko |
| routes | 40 = 10 paires (1→2, 3→7, 9→1, 11→4, 2→3, 7→6, 6→5, 4→11, 10→8, 5→9) × 4 vents ; aucune route nulle | 11 ko |
| regimes | table (id, nom, conseils), regimeOf de 0 à 355° × {2, 6, 12, 20} nd, rankCourses G sur six vents | 10 ko |
| positions | marques et lieux (toXY, fmtLat, fmtLon), aller-retour parseLatLon des 11 marques, 5 saisies (dont Brest refusée mot pour mot), checkPos de 10 positions + 11 marques | 4 ko |
| meteo | URL de fetchAll et fetchLive, balises gardées (3 sur 6), GRID, CENTER, MODELS, consensus des 10 premières heures, gridPoints et marineAt de l’instantané | 13 ko |
| donnees | SHA-256 et taille des 8 fichiers de Toulon | 1 ko |

### Fixture des vues `tests/fixtures/vue-toulon-v42.json` (80 753 octets)

Quatre états d’entraînement libre au 05/12/2026 10 h (Paris), vent manuel : parcours 3 G 2 tours 315°/25 ; parcours 13 G 2 tours 265°/14 ; banane 3 tours réglages par défaut 215°/10 ; parcours 9 P 140°/14. Cinq sections chacun (brief, course, start, live, wind), texte `innerText` aux espaces normalisés. Aucune « Marée » ni « courant de marée ».

## Durées mesurées

- `tests/toulon.test.mjs` seul : 27,8 s (9 tests) ; capture : 27,7 s.
- `npm run check` complet : 684 tests, 0 échec, 35,3 s de bout en bout (33,0 s avant ce plan avec 675 tests) — le fichier tourne en parallèle des autres, la porte gagne environ 2 s.
- `node tools/gardes-toulon.mjs` : 29,5 s.
- Scénario `toulon-vue` : environ 23 s.

## Sorties brutes des vérifications

Capture déterministe (deux captures sur la même extraction, `cmp`) :
```
bords : 133 · analyses : 66 · vent : 6 · routes : 40 · regimes : 3 · positions : 5 · meteo : 6 · donnees : 8 → tests/fixtures/toulon-v42.json
DETERMINISTE
```
Comparaison du code courant :
```
ok 1 - fixture Toulon v42 capturée sur 56f6625
ok 2 … ok 9 (bords, analyses, vent, routes, regimes, positions, meteo, donnees identiques à la capture)
# pass 9
# fail 0
```
Gardes :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
```
Contrôle négatif des gardes (copie du dépôt dans le dossier temporaire, un octet de `data/meta.json` changé, `--racine <copie>`) : `ÉCHEC données de Toulon`, `ÉCHEC tests figés`, code 1.

Vues : capture en servant l’extraction complète de 56f6625, recapture sur l’extraction et sur l’arbre courant, toutes identiques (`cmp`) ; puis
```
OK toulon-vue
OK accueil
  conseil affiché : Porte : bouée gauche conseillée — 22 s de mieux
OK banane
Bilan : 3/3 scénario(s) OK
```
Contrôle négatif des vues (extraction copiée, une phrase du briefing changée dans `js/app.js`) :
```
ÉCHEC toulon-vue : parcours 3, G, 2 tours, 315°/25 nd, onglet brief différent de la v42 — caractère 51 : vu "… Les prévisions sont écartées pour la carte …", attendu "… Les prévisions sont ignorées pour la carte …"
```
Gardes finales : `git diff --quiet 56f6625 -- js/ data/` → 0 ; `git diff --quiet f80c365 -- js/courses.js tests/reference/` → 0 ; scénario `entetes` OK (option `entetes` du serveur sans effet par défaut).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocage] `node_modules` absent**
- **Trouvé pendant :** tâche 1 (`npm test` exige `linkedom`).
- **Correction :** `npm ci` sur le `package-lock.json` commité (aucun paquet ajouté, aucune version changée ; `node_modules/` est ignoré par git).

**2. [Rule 2 - Exigence du plan] En-têtes du dépôt pour l’extraction servie**
- **Trouvé pendant :** tâche 3. `demarreServeur({ root })` lisait `vercel.json` dans la racine servie ; le plan exige les en-têtes du dépôt.
- **Correction :** option `entetes` (par défaut `root`, donc `measure-boot.mjs` et les autres scénarios inchangés) ; `regate-e2e.mjs` passe `entetes: ROOT`.
- **Fichier hors liste :** `tools/serveur-local.mjs` (commit 0558f2e).

**3. [Précision] Départ conseillé dans les analyses**
- La boucle de `runAnalysis` route aussi cinq points de la ligne et fait partir le premier bord du meilleur : repris dans `analyse()` (sinon le premier bord figé ne serait pas celui que l’app montre). `startPoint` (f, gain, temps des cinq points) est dans la section.

**4. [Précision] Fixture des vues en JSON compact** pour contenir littéralement `"from":"56f6625"` (critère d’artefact).

**5. [Suivi] BREST-01 laissé « Pending » dans REQUIREMENTS.md** : les dix plans de la phase le portent (liste hors réseau, ouverture en moins de 2 s, D-02) ; il ne sera coché qu’à la fin de la phase. La case 07-01 de la ROADMAP est cochée.

## Known Stubs

Aucun.

## Threat Flags

Aucun : aucun code d’accès, aucune empreinte de `middleware.js` (les SHA-256 de la fixture sont ceux des fichiers `data/` de Toulon), aucun appel réseau (cales fetch qui refusent le réseau ; balises et réponses météo factices).

## Points pour 07-02

- Appeler `node tools/gardes-toulon.mjs` avant chaque commit qui touche `js/` ou `data/` ; il doit écrire quatre « OK ».
- `tests/toulon.test.mjs` importe les modules par `import * as` : un module renommé ou un export retiré (`fmtLat`, `fmtLon`, `parseLatLon`, `checkPos`, `regimeOf`, `rankCourses`, `GRID`, `CENTER`, `MODELS`, `fetchAll`, `fetchLive`, `consensus`, `gridPoints`, `marineAt`, `snapshot`) casse le gel : garder ces signatures avec Toulon par défaut.
- Les positions de Brest sont figées comme refusées en v42 (`parseLatLon` → « Position hors de la rade de Toulon… », `checkPos` → « position hors de la carte ») : avec les bornes PAR DÉFAUT (Toulon), elles doivent le rester ; Brest passera par des bornes du plan d’eau en paramètre (D-07).
- Le scénario `toulon-vue` ouvre l’app sans plan d’eau choisi : le défaut doit rester Toulon, et le texte des cinq onglets ne doit pas bouger (un sélecteur de plan d’eau ajouté dans l’onglet Vent ou Briefing changerait la vue : le placer ailleurs, par exemple dans les réglages, ou faire valider par Romain une nouvelle capture).
- Recapture des vues : `E2E_ROOT=<extraction complète de 56f6625> E2E_CAPTURE=<fichier> PW_REQUIRED=1 node tools/regate-e2e.mjs toulon-vue`, puis `cmp` avec la fixture ; jamais de capture sur le code modifié (D-01).
- Le test du registre « Toulon sans marée ni courant » reste à écrire en 07-02 (prévu par le plan).

## Self-Check: PASSED
