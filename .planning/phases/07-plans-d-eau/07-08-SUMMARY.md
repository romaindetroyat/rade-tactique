---
phase: 07-plans-d-eau
plan: 08
subsystem: plan-d-eau-brest
status: complete
tags: [plan-d-eau, brest, courant, maree, routage, conseils, carte, d-13, d-14c, d-01]
requires:
  - "07-07 : js/maree.js (hauteur, extremes, mareeEn), js/courant.js (chargeAtlas, courantEn, fondEn), data/brest.{maree.json,courants.json,courants.bin,fonds.bin}"
  - "07-06 : zones interdites de Brest, positions de ligne zoneA/zoneB/zoneC, conseils { t, o }"
provides:
  - "route(from, to, field, { current, t0, depth }) : branche avec courant à côté du pas de la v42 (vent sur l’eau, vitesse fond, dérive pendant les manœuvres, arrivée sur la route fond, hauteur d’eau)"
  - "js/tactics.js : routeOpts(ctx, t0), routeOf (clé + heure arrondie à 5 min avec courant), currentAdvice(leg, ctx) → [{ t, o: 'C' }], renverses(ctx, t0, t1, zone), renverseText(ms)"
  - "js/courant.js : mareeMemo(P), courantXY(A, P) → (x, y, ms) → { u, v } | null, profondeurOk(A, P, 1.5, 1.0) → (x, y, ms) → booléen"
  - "js/scene3d.js : setCurrent(at) — flèches de courant (grille de 500 m autour de la vue), groupe créé au premier appel"
  - "js/app.js (Brest seulement) : courant dans runAnalysis et planRest, cartes « Courant à l’heure du départ » et « Courant à la ligne », « Courant ici » et caps au près avec route fond en course, calque « Courant de marée »"
  - "scénario brest-courant (tools/regate-e2e.mjs)"
affects: [07-09, 07-10]
tech-stack:
  added: []
  patterns:
    - "option jamais passée à Toulon : la branche avec courant est écrite à côté du pas de la v42 ; Toulon prouvé par la fixture v42 (routes, analyses), banane-v38 et toulon-vue"
    - "marée mémorisée entre deux pleines mers : avant, apres et entre ne changent pas, seul t change (courantEn n’a besoin que de ces champs) ; mareeEn (≈ 2 ms) appelé une fois par cycle"
    - "conseils de courant { t, o: 'C' } ; analyzeLeg pousse tipText(c) dans advice (chaînes, comme tous les consommateurs : gel, débrief, vues)"
key-files:
  created:
    - tests/courantroute.test.mjs
  modified:
    - js/router.js
    - js/tactics.js
    - js/courant.js
    - js/app.js
    - js/scene3d.js
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "Temps de l’étude (12,1 ; 14,9 ; 10,2 min) contrôlés à vent sur l’eau constant de 8 nd (vent au sol 8,75 nd contre, 7,25 nd avec), valeurs attendues recalculées par la formule de l’étude sur la polaire (12,12 ; 14,95 ; 10,19) : l’étude ne tient pas compte de la baisse du vent sur l’eau ; un test à part vérifie cet effet (8 nd au sol contre 0,75 nd : 16,6 min)"
  - "Élagage des isochrones propre à la branche avec courant : dans chaque secteur, le plus proche de l’arrivée dans 5 s à sa vitesse fond d’approche (rem − vm × 5 s) ; sans cela, un virement de trop (15,63 min au lieu de 15,24 contre le courant)"
  - "Cap qui compense la dérive vers l’arrivée ajouté aux caps testés (trois itérations), pour que la route fond puisse viser la marque"
  - "Hauteur d’eau : hauteur(P, ms) − fondEn ≥ 1,5 + 1,0 m ; hors de la grille des fonds ou marée inconnue : navigable (règle de la terre seule) ; nœuds à terre de l’atlas comptés dans l’interpolation des fonds (côté sécurité près des côtes)"
  - "Zone des renverses : cercle de 0,6 Nq autour de la position de ligne quand c’est une zone du GPEN (zoneA, zoneB, zoneC), sinon autour du centre des marques du parcours"
  - "Réserve « (estimation d’après l’atlas du Shom) » une fois par bord, à la fin du dernier conseil de courant ; renverse dans l’heure avant le départ ajoutée aux conseils de la ligne"
  - "Briefing : la prochaine renverse est dans la carte « Courant à l’heure du départ » ; la carte « Stratégie du jour » reprend les conseils de courant du premier bord"
  - "En course, caps au près pris sur le vent de l’eau, lay-line jugée sur la route fond de chaque amure (cap × vitesse + courant)"
  - "js/startmode.js inchangé (décision de Romain) ; pas de correction du débrief par le courant dans cette phase"
metrics:
  duration: 38min
  completed: 2026-11-19
  tasks: 3
  files: 8
estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 20400        # chars/4 du diff 3127a5c..8540d09 hors sw.js et js/version.js (81 587 caractères)
  tasks: 3
  commits: 4
plan_head_before: 3127a5cdbbb2dd1850634fe027f36377e51a8f0e
plan_head_after: 8540d09eb06fa89778821af9121e1f7f401a63e2
---

# Phase 7 Plan 08 : Le courant de marée dans le routage, les conseils et l’affichage de Brest Summary

À Brest, le routage tient compte du courant de l’atlas du Shom à l’heure de chaque bord (vent sur l’eau, vitesse fond, dérive pendant les manœuvres) et évite les fonds trop hauts à l’heure dite (tirant d’eau 1,5 m + 1 m de marge) ; chaque bord dit ce que le courant change, où il aide et quand il tourne, toujours comme une estimation ; le briefing, la carte, l’onglet Départ et l’écran En course montrent le courant ; Toulon ne passe jamais l’option et ne change pas d’un bord.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 9904327 | `route()` avec `current`, `t0`, `depth` ; `routeOpts`, clé de mémoire ; `courantXY`, `profondeurOk` ; courant dans `runAnalysis` et `planRest` à Brest ; « Temps de parcours avec le courant de marée (atlas du Shom). » au briefing ; 8 tests |
| 2 (TDD) | adb0aac (rouge), b6fa6d0 (vert) | `currentAdvice`, `renverses`, `renverseText` ; temps du bord sans courant ; renverses de la journée ; renverse avant le départ ; 9 tests de plus |
| 3 | 8540d09 | Cartes du briefing et de l’onglet Départ, flèches de courant et calque, « Courant ici » et lay-lines corrigées en course, départ découpé, scénario `brest-courant` |

Tracer (tâche 1) : vérification rejouée de bout en bout avant la tâche 2 (mode `end-of-phase`, vérification automatique) : tests verts (63), gardes vertes, `npm run check` 802 tests (801 verts, 1 sauté), SNPM-OK, « OK toulon-vue », « OK banane », « OK plan-eau ».

## Routage avec courant uniforme (étude § 4.4 et § 6.4)

Bord de près de 0,8 Nq, vent du 000°, pertes de virement de 9 s :

| Cas | Routage | Étude (formule sur la polaire) | Écart |
|-----|---------|--------------------------------|-------|
| Sans courant, 8 nd | 12,31 min (1 virement) | 12,12 (12,1) | +0,19 |
| Courant 0,75 nd contre, 8 nd sur l’eau | 15,24 min (2 virements) | 14,95 (14,9) | +0,29 |
| Courant 0,75 nd avec, 8 nd sur l’eau | 10,37 min (1 virement) | 10,19 (10,2) | +0,18 |
| Courant 0,75 nd contre, 8 nd au sol (7,25 nd sur l’eau) | 16,63 min | — | effet du vent sur l’eau |
| Courant de travers 0,6 nd vers l’est | 12,17 min, arrivée à la marque, premier cap 322° (318° sans courant) | — | — |
| Courant toujours nul | 12,31 min, identique à sans courant | — | 0 s |

Sans perte de virement, le routage donne 11,99 / 14,81 / 10,12 min : l’écart restant vient du pas de temps des virements (déjà +0,19 min sans courant en v42). Contre le courant, la marge est mince (0,29 min pour 0,3) : un changement du routeur devra rejouer ce test.

## Brest : banane de la zone A, 270°/10 nd, 6 mai 2027 à 14 h (2 tours)

- Temps : 41,7 min sans courant, **44,1 min avec** (+5,8 %) ; bords au vent 11,3 → 13,7 et 10,6 → 13,0 min (flot de 0,6 nd vers l’est contre le bord), portants 9,0 → 7,9 et 9,6 → 8,5 min.
- Calcul (Node, même machine) : 300 ms sans courant, 470 ms avec le routage seul ; avec les conseils (route sans courant de chaque bord, renverses de la journée 26 ms) : départ 273 → 549 ms (cinq routes de la ligne), premier bord 45 ms, bord de porte 105 ms.
- Conseil du premier bord dans l’app : « Courant 0,6 nd vers 109° : contre vous sur ce bord (≈ +2 min 20 s) · Courant plus favorable à gauche du bord (0,4 nd de mieux) (estimation d’après l’atlas du Shom) » — le côté sud de la zone, au courant plus faible (étude § 4.3).
- Onglet Départ : « 0,4 nd → 101° », « vous en éloigne de 13 m/min ». Briefing : ligne 0,4 nd → 101°, bouée au vent 0,9 nd → 101°.
- Routes avec courant hors des zones interdites : un pas rogne une zone de moins de 25 m (route de 07-06 au nord de l’Île Longue, à 9 h et 15 h).
- Hauteur d’eau : haut-fond de +0,1 m (48,28672 N ; 4,35428 W, 1,4 km au sud-est du centre de la zone A) obstacle à la basse mer de 11 h 54 (1,34 m), navigable à la pleine mer de 17 h 52 ; des fonds de −0,9 m à 800 m au sud-ouest du centre sont aussi des obstacles à la basse mer de midi.

## Renverses trouvées (zone A, cercle de 0,6 Nq, heure de Paris)

| Jour | Renverses |
|------|-----------|
| 5 mai 2027 | 05:05, 11:30, 17:25, 23:55 |
| **6 mai 2027** | **05:45, 12:10** (basse mer 11:54 ; étude : étale vers 12 h 10), **18:00** (pleine mer 17:52) |
| 7 mai 2027 | 00:35, 06:25, 12:50, 18:40 |
| 8 mai 2027 | 01:15, 07:05, 13:35, 19:25 |
| 13 décembre 2026 | 01:25, 07:20, 13:40, 19:35 |

Coût : 7 à 33 ms par journée (Node).

## Mesures d’ouverture (sorties brutes, CPU ×4, 5 ouvertures hors réseau)

Brest, sur 8540d09 (`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5 --venue brest`) :
```
ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)
        1 |                  426 |                           304 |             4973 |                                     1230
        2 |                  459 |                           229 |             5210 |                                     1185
        3 |                  461 |                           218 |             5279 |                                     1131
        4 |                  465 |                           313 |             5171 |                                     1077
        5 |                  387 |                           344 |             5259 |                                     1134
  médiane |                  459 |                           304 |             5210 |                                     1134
  maximum |                  465 |                           344 |             5279 |                                     1230
RÉSULTAT : OK — médiane de l’interface utile 459 ms < 2000 ms (hors réseau à Brest, CPU ×4)
```
Toulon, même code (`PW_REQUIRED=1 node tools/measure-boot.mjs 4 5`) :
```
  médiane |                  403 |                           261 |             3885 |                                      519
  maximum |                  428 |                           360 |             3994 |                                      547
RÉSULTAT : OK — médiane de l’interface utile 403 ms < 2000 ms (hors réseau, CPU ×4)
```
Brest avant ce plan (3127a5c, copie de travail temporaire) : interface 397 ms, carte prête 4 912 ms, plus longue tâche 880 ms. Sans découpage des cinq routes de la ligne, la plus longue tâche montait à 1 708 ms ; découpée (Brest seulement), 1 134 ms. Colonne indicative (seule l’interface utile fait critère).

## Vérifications finales (sorties brutes)

Sur 8540d09 :
```
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
npm run check : stamp à jour · # tests 811 · # pass 810 · # fail 0 · # skipped 1 (instantané météo de Brest absent)
tests/courantroute.test.mjs : 17 tests verts
git diff --quiet 56f6625 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : inchangés
PW_REQUIRED=1 node tools/regate-e2e.mjs brest-courant plan-eau toulon-vue jour-j retour-port banane : 6/6 scénario(s) OK
```
Version : `v42 · 09/11 · 76bb6f4df4` (`npm run stamp`, 76 fichiers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Virements en trop avec courant (élagage des isochrones)**
- **Trouvé pendant :** tâche 1 (courant uniforme contre).
- **Problème :** deux chemins arrivés au même point (un virement chacun) étaient départagés par l’arrondi des calculs ; celui qui devait encore virer l’emportait : 3 virements, 15,63 min au lieu d’environ 15,2.
- **Correction :** élagage propre à la branche avec courant (`rem − vm × 5 s`, vitesse fond d’approche) ; l’élagage de la v42 est intact dans l’autre branche. **Commit :** 9904327

**2. [Précision] Temps de l’étude à vent sur l’eau constant**
- Les temps de l’étude (14,9 et 10,2 min) supposent 8 nd de vent sur l’eau ; avec 8 nd au sol, le vent sur l’eau (vent − courant) tombe à 7,25 nd contre le courant et le temps à 16,6 min. Le test garde la physique du plan (vent sur l’eau pour la polaire) et compare à vent sur l’eau de 8 nd ; valeurs de l’étude recalculées sur la polaire (14,95 au lieu de 14,9 arrondi). Un test à part contrôle la baisse du vent sur l’eau.

**3. [Ajout] Cap qui compense la dérive**
- Ajouté aux caps testés à chaque nœud pour que la route fond puisse viser l’arrivée (le test d’arrivée se fait sur la route fond).

**4. [Rule 1 - Bug] Exemple de test faux (tâche 2)**
- « −1 min 50 s » attendu pour 10,19 min contre 12,12 : c’est −1 min 56 s, arrondi à « −2 min 00 s ». Exemple ramené à 10,3 min dans le commit vert (b6fa6d0).

**5. [Rule 2 - Performance] Départ découpé à Brest**
- Les cinq routes de la ligne avec courant tenaient dans une seule tâche (1,7 s à CPU ×4) : un `setTimeout(0)` entre elles quand il y a du courant (jamais à Toulon). **Commit :** 8540d09

**6. [Précision] Forme des conseils**
- `currentAdvice` rend des conseils `{ t, o: 'C' }` (origine « courant ») ; `analyzeLeg` les range dans `courant.advice` et pousse leur texte (`tipText`) dans `advice`, qui reste une liste de chaînes pour le gel, le débrief et les vues.

**7. [Précision] Briefing**
- La prochaine renverse est dans la carte « Courant à l’heure du départ » (tâche 3) plutôt que dans « Stratégie du jour », qui reprend les conseils de courant du premier bord ; une renverse dans l’heure avant le départ est ajoutée aux conseils de la ligne (« Renverse vers HH h MM, avant le départ… »).

## Known Stubs

Aucun nouveau. Toujours ouverts : `data/brest.wx-snapshot.json` absent (07-10), `COURSES` de Brest vide (07-09).

## Contrôle humain à faire (fin de phase)

Romain (ou un équipier) à Brest, sur l’eau ou au ponton : comparer la dérive mesurée (bateau arrêté ou bouée de casier) et l’heure de la renverse à « Courant ici » (En course). Attendu : ordre de grandeur et sens justes ; écart de 0,2 à 0,3 nd et de 15 à 30 min sur les renverses (étude § 4.6).

## Questions pour Romain

- Débrief corrigé du courant (vitesse fond contre polaire faussée de ±0,75 nd à Brest) : hors de cette phase, à décider.

## Threat Flags

Aucune nouvelle surface : pas de point d’accès réseau ni de donnée partagée ; l’atlas et les fonds sont les fichiers du pack déjà vérifiés par empreinte. T-07-21 appliqué (branche dédiée, fixture v42, banane-v38, toulon-vue à chaque tâche), T-07-22 appliqué (obstacle de hauteur d’eau, conseils dits estimations, avertissement du Shom), T-07-23 appliqué (marée mémorisée, routes mémorisées par tranche de 5 min, départ découpé, ouverture de Brest 459 ms). Aucun code d’accès ni empreinte de middleware écrit ou affiché ; aucun appel à l’IA.

## Points pour 07-09

- Catalogue du GPEN : la zone des renverses prend la position de ligne si sa clé commence par `zone` (cercle de 0,6 Nq) ; si les zones B et C ont un autre rayon, le donner dans le pack (`ctx.zone` dans `runAnalysis`).
- Les parcours du catalogue passent par `runAnalysis` : courant, hauteur d’eau et conseils s’appliquent sans rien de plus ; vérifier que les marques ne tombent pas sur des fonds signalés comme obstacles à basse mer (fonds de −0,9 m à 800 m au sud-ouest du centre de la zone A).
- Guide (07-10) : dire que le mode départ plein écran ne compte pas le courant (sa vitesse fond du GPS le contient), que l’onglet Départ donne la dérive, et que Toulon n’a ni marée ni courant.

## Self-Check: PASSED
