---
phase: 08-espace-tofinou
plan: 05
subsystem: app
status: complete
tags: [tofinou, polaire, orc, bateau, routage, onglet, espaces]
requires:
  - "08-04 : js/espaces.js (ESPACE, bateau { classe, longueur }), espace fixé avant le plan d’eau, scénario tofinou-demarrage"
  - "08-03 : pack data/bormes.* (route de contrôle à Bormes)"
provides:
  - "tools/boats/tofinou95.orc.json : extrait sans nom du certificat ORC Club 2026 03510004F1O"
  - "tools/build_polar_tofinou.mjs : data/tofinou95.pol, data/tofinou95-foc.pol, js/polar-tofinou95.js ; --check"
  - "js/polar-tofinou95.js : TOF_TWS, TOF_TWA, TOF_BSP, TOF_BSP_FOC, TOF_SOURCES (généré)"
  - "js/polar.js : setDefaultPolar (cible de resetPolar)"
  - "js/bateau.js : BATEAU_KEY, voileDe, choisirVoile, variantesDe, varianteDe, appliquerPolaireEspace"
  - "ESPACES.tofinou.bateau : polaire, voiles, voileDefaut, virement_s 11, empannage_s 8, tirant { bas 2,2, haut 1,2 }, onglet « Tofinou », reglages faux"
  - "routeOpts(ctx) : tackLoss / gybeLoss du bateau quand ctx.bateau est posé (js/app.js : hors de Naos seulement)"
  - "js/j80.js : onglet du bateau d’un autre espace (renderBateau) ; onglet de Naos = v43"
  - "tests/fixtures/j80-v43.json + tests/helpers/j80v43.mjs (rendus de l’onglet de Naos capturés sur 5e9b8a5) ; scénario tofinou-bateau"
affects: [08-06, 08-07, 08-09, 08-10]
tech-stack:
  added: []
  patterns:
    - "polaire par défaut remplaçable par espace (setDefaultPolar au démarrage, polaire personnelle ensuite)"
    - "contexte de routage enrichi par spread d’un objet vide pour Naos (`...BATEAU`) : clés et options de la v43"
    - "rendu de la v43 capturé en fixture, comparé dans un processus neuf (état d’une session de Naos)"
key-files:
  created:
    - tools/boats/tofinou95.orc.json
    - tools/build_polar_tofinou.mjs
    - data/tofinou95.pol
    - data/tofinou95-foc.pol
    - js/polar-tofinou95.js
    - js/bateau.js
    - tests/tofinou.test.mjs
    - tests/helpers/j80v43.mjs
    - tests/fixtures/j80-v43.json
  modified:
    - js/polar.js
    - js/espaces.js
    - js/app.js
    - js/tactics.js
    - js/j80.js
    - tests/helpers/naos.mjs
    - tests/stamp.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "Polaire du Tofinou : certificat ORC Club 2026 du sister-ship 03510004F1O, méthode de tools/build_polar.mjs, sans extrapolation ; génois par défaut, foc estimé au choix de l’équipier ; source « ORC Club 2026 (Tofinou 9.5, sister-ship) — à recaler »"
  - "Voile d’avant gardée dans rade.bateau.v1 ({ voile }) par js/bateau.js, jamais lue ni écrite pour Naos ; la voile du bateau réel reste à confirmer avec le skipper (réglable, non tranchée)"
  - "Pertes 11 s / 8 s par routeOpts quand ctx.bateau est posé ; js/app.js ne le pose que hors de Naos ; clés des routes mémorisées de Naos inchangées"
  - "Tirant d’eau 2,20 / 1,20 m affiché « à confirmer », utilisé par aucun calcul (Bormes : ni fonds ni marée)"
  - "Module js/bateau.js ajouté (hors liste du plan) pour rendre testables le choix de voile et la polaire par espace"
metrics:
  duration: 75min
  completed: 2026-11-26
estimate:
  tokens: 110000
  tasks: 2
actuals:
  tokens: 18600
  tasks: 2
  commits: 3
plan_head_before: bdcda7e99bd3b8c626ccce81749a4552689e5d8a
plan_head_after: 1383c20
---

# Phase 8 Plan 05 : bateau Tofinou 9.5 Summary

L’espace Tofinou navigue avec sa propre polaire, tirée du certificat ORC Club 2026 d’un Tofinou 9.5 espagnol (référence 03510004F1O) par la méthode de l’outil du J80, sans extrapolation : génois du certificat par défaut, foc d’origine estimé au choix (gardé dans `rade.bateau.v1`), pertes de 11 s au virement et 8 s à l’empannage dans le routage, onglet « Tofinou » avec longueur, tirant d’eau « à confirmer », pertes « estimation », deux polaires téléchargeables et la source ; Naos garde le J80 à l’octet (polaire, pertes, clés des routes, onglet identique à la v43).

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | f0516c4 | extrait du certificat, outil `tools/build_polar_tofinou.mjs` (--check), `data/tofinou95.pol`, `js/polar-tofinou95.js`, `setDefaultPolar`, `js/bateau.js`, polaire de l’espace au démarrage avant la polaire personnelle, tests/tofinou.test.mjs |
| 2 (tdd) | e2a07df, 1383c20 | variante foc (`data/tofinou95-foc.pol`, `TOF_BSP_FOC`), choix de la voile, pertes par `routeOpts`, onglet « Tofinou », textes du bateau dans js/app.js, onglet de Naos comparé à la v43, scénario tofinou-bateau |

Tracer (tâche 1) : `<verify>` rejoué de bout en bout avant la tâche 2 (outil, tests, stamp, `npm run check`, gardes, scénarios tofinou-demarrage, naos-cles, toulon-vue) : vert, expansion poursuivie. Tâche 2 : tests écrits d’abord, rouges (`TOF_BSP_FOC` absent du module), puis verts.

## Certificat : champs retenus

`tools/boats/tofinou95.orc.json` (téléchargé le 2026-11-26 dans un dossier neuf de la session, liste d’Espagne de 1 271 certificats, 10 Mo, restée hors du dépôt ; lu par `JSON.parse` dans un script rangé à part, chemin en argument ; l’extrait est identique aux tableaux du fichier de l’étude) :

- identification : `NatAuth` ESP, `Family` ORC, `C_Type` CLUB, `Class` « TOFINOU 950 », `RefNo` 03510004F1O, `IssueDate` 2026-02-26 ;
- `Allowances` : `WindSpeeds` (4 à 24 nd), `WindAngles`, `R52`, `R60`, `R75`, `R90`, `R110`, `R120`, `R135`, `R150`, `Beat`, `BeatAngle`, `Run`, `GybeAngle`.

Relecture consignée : ni nom du bateau, ni numéro de voile, ni club, ni constructeur, ni architecte (personne), ni `BIN` / `CertNo` ; un test vérifie la liste exacte des clés. `DW165` / `DW180` non repris (définition non lue, comme le demandait l’étude) : lignes 165° et 180° par la formule de l’outil.

## Cibles calculées contre l’étude (§ 5.3)

`data/tofinou95.pol` est identique, octet pour octet, à la table du § 5.3 de l’étude (897 octets). La polaire d’essai trouvée dans le dossier de session (`bormes/polaire/tofinou95_essai.pol`) a été traitée comme non fiable : régénérée depuis le certificat téléchargé à nouveau, puis comparée (identique).

| Vent | Près : angle ; VMG | Portant : angle ; VMG | 90° | Étude |
|------|--------------------|------------------------|-----|-------|
| 4 nd | 47° ; 2,53 | 143,5° ; 2,51 | 4,27 | identique |
| 6 nd | 42° ; 3,59 | 145,5° ; 3,63 | 5,69 | identique |
| 8 nd | 40° ; 4,34 | 148,5° ; 4,58 | 6,59 | identique |
| 10 nd | 38° ; **4,74** | 150,5° ; **5,39** | **7,03** | identique |
| 12 nd | 38° ; 4,89 | 153,5° ; 5,98 | 7,38 | identique |
| 14 nd | 38° ; 4,97 | 156° ; 6,43 | 7,67 | identique |
| 16 nd | 38° ; 5,04 | 155° ; 6,83 | 7,89 | identique |
| 20 nd | 38° ; 5,10 | 150° ; 7,92 | 8,22 | identique |
| 24 nd | 38° ; 5,06 | 150° ; 10,02 | 8,45 | identique |

Variante foc (`data/tofinou95-foc.pol`, 897 octets) : lignes de 30 à 75° × 0,85 ; 0,88 ; 0,90 ; 0,93 ; 0,98 ; 1 ; 1 ; 1 ; 1, ligne 90° × 0,94 ; 0,99 ; 1…, lignes de 110 à 180° identiques (test ligne par ligne).

Route de contrôle à Bormes (pack du dépôt, 300 m à l’ouest de La Fourmigue → ligne du Lavandou, champ de vent du dépôt) : 10 nd de 270° : J80 1 055 s, Tofinou 980 s (aucune manœuvre) ; 10 nd de 330° (près) : J80 1 906 s, Tofinou 1 698 s (un virement chacun).

Scénario tofinou-bateau (banane de Bormes, 6 nd de 180°) : 110 min au génois, 120 min au foc ; le choix et le temps restent après rechargement.

## Sorties brutes

Tests nouveaux (tests/tofinou.test.mjs, 18) :
```
ok - Naos : aucune polaire d’espace, aucune lecture ni écriture de stockage ; « Polaire par défaut » revient au J80 de la v43
ok - outil de la polaire du Tofinou : --check en 0 (data/tofinou95.pol et js/polar-tofinou95.js à jour)
ok - extrait du certificat : référence 03510004F1O, type CLUB, vents 4 à 24 nd, aucun nom de bateau, de personne ni de club
ok - data/tofinou95.pol : format de data/j80.pol, moins de 1 200 octets, relu par parsePolar = table du module (génois du certificat)
ok - espace Tofinou : polaire par défaut du Tofinou (génois) ; cibles par 10 nd : VMG près 4,74, portant 5,39, travers 7,03 (± 0,02)
ok - recalage : une polaire importée garde la priorité ; « Polaire par défaut » revient au Tofinou, pas au J80
ok - voile d’avant : valeur inconnue, illisible ou absente → génois ; variante d’une voile inconnue → null
ok - outil, polaire et module du J80 intacts (= 5e9b8a5, à l’octet)
ok - route de Bormes (La Fourmigue → ligne du Lavandou) : plus rapide avec la polaire du Tofinou qu’avec celle du J80, par 10 nd d’ouest et au près par 10 nd de nord-ouest
ok - variante foc : lignes de 30 à 75° et 90° multipliées par les facteurs de l’étude, lignes de 110 à 180° identiques ; data/tofinou95-foc.pol relu = TOF_BSP_FOC
ok - voile d’avant : « foc » écrit rade.bateau.v1 = { voile: "foc" } et devient la polaire par défaut ; Naos : rien écrit, polaire J80
ok - bateau de l’espace Tofinou : 9,47 m, pertes 11 s / 8 s, tirant d’eau 2,20 / 1,20 m, onglet « Tofinou », réglages du J80 masqués ; Naos sans ces champs
ok - routeOpts : sans ctx.bateau, options de la v43 ; avec le bateau du Tofinou, 11 s au virement et 8 s à l’empannage
ok - pertes aux manœuvres : même route plus longue avec 11 s / 8 s qu’avec 9 s / 6 s (au plus 2 s par manœuvre et un pas d’isochrone de plus) ; travers sans manœuvre identique
ok - onglet de Naos identique à la v43 : HTML de renderJ80 = tests/fixtures/j80-v43.json (capturé sur 5e9b8a5) pour les mêmes états
ok - onglet du Tofinou : « Tofinou 9.5 », voile d’avant au choix, 9,47 m, tirant d’eau « à confirmer », pertes « estimation », deux polaires téléchargeables, source ; ni « J80 » ni réglages du J80
ok - onglet du Tofinou : polaire personnelle importée — source affichée et rappel que « Polaire par défaut » revient au Tofinou
ok - textes du bateau dans js/app.js : temps estimés et routage au nom de la classe et avec les pertes de l’espace ; carte « Réglages J80 » seulement si le bateau a ses réglages
```

Fixture de l’onglet de Naos (`node tests/helpers/j80v43.mjs --capture <extraction de 5e9b8a5> …`, deux captures identiques, `cmp` vrai ; quatre états : sans vent, 12 nd, 4,4 nd, polaire importée à 18 nd ; 98 074 octets, aucune suite de 64 hexadécimaux).

Vérifications finales :
```
node tools/build_polar_tofinou.mjs --check : Polaire du Tofinou à jour : data/tofinou95.pol, data/tofinou95-foc.pol, js/polar-tofinou95.js
npm run check : 933 tests, 931 verts, 2 sautés (instantanés météo de Brest et de Bormes absents), 0 échec
node tools/gardes-toulon.mjs : OK SNPM · OK données de Toulon · OK modules du mode départ · OK tests figés · OK gel de Naos v43 · OK pack de Brest
git diff --quiet f80c365 -- js/courses.js tests/reference/ : vrai ; git diff --quiet 5e9b8a5 -- data/brest.* js/startmode.js js/racelock.js js/beeper.js js/wakelock.js tools/build_polar.mjs data/j80.pol js/polar-orc.js : vrai
index.html, styles.css, js/tuning.js, js/router.js : inchangés depuis 5e9b8a5
node tools/stamp.mjs --check : à jour (avertissement non strict « contenu modifié depuis la v43 » : la release est pour 08-10)
PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-bateau tofinou-demarrage naos-cles toulon-vue : 4/4 OK
```

Tous les scénarios de l’outil (`PW_REQUIRED=1 node tools/regate-e2e.mjs`, sans nom), après 1383c20 :
```
accueil, jour-j, deux-telephones, reprise, equipage, archive, archive-bouees, archivehors, creer, manche, auteur, ic, depuis-ic, vraisemblance,
gel, debrief-tardif, gpx, gpx-choix, ia, ia-erreurs, arbitre, bouees, guide, entetes, retour-port, banane, banane-manche, banane-debrief,
porte-ic, modifier-manche, toulon-vue, plan-eau, brest-avion, regate-brest, brest-courant, gpen, naos-cles, tofinou-demarrage, espace-garde,
tofinou-bateau : OK
Bilan : 40/40 scénario(s) OK
```
Première série complète (avant 1383c20) : 39/40, tofinou-bateau en échec sur « banane en mer par vent du sud » (avertissement « à terre » lu
pendant une analyse transitoire sur machine chargée) ; trois passages isolés verts ; corrigé en lisant l’onglet une fois stable (`texteStable`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocage] Liste hors réseau comparée à la v42 (tests/stamp.test.mjs)**
- **Trouvé pendant :** tâche 1 — `data/tofinou95.pol` entre dans la liste hors réseau (le plan et l’étude le veulent, comme `data/j80.pol`) ; le test de la phase 7 n’admettait que des modules `js/` et `data/venues.json`.
- **Correction :** les fichiers de `AJOUTS_SHELL` (64 Ko au plus) sont admis aussi ; la limite de 50 Ko pour les fichiers de `data/` reste. Test non figé (hors des gardes).
- **Commit :** f0516c4

**2. [Rule 2 - Testabilité] Module js/bateau.js**
- **Raison :** le choix de voile (« jamais écrit dans l’espace Naos ») et la polaire par espace devaient être testés sans le DOM de js/app.js. Module public de 4 Ko, dans `AJOUTS_SHELL` (demandé par l’app de Naos, aucune clé lue ni écrite pour Naos : test et scénario naos-cles).
- **Commits :** f0516c4, e2a07df

**3. [Rule 3] Contrôle de l’outil du J80 sans git pendant npm test**
- **Problème :** le plan demandait `git diff --quiet 5e9b8a5 -- tools/build_polar.mjs data/j80.pol js/polar-orc.js` dans tests/tofinou.test.mjs ; 08-01 a fixé « aucun accès à git pendant npm test ».
- **Correction :** début du SHA-256 des trois fichiers de 5e9b8a5 (16 caractères), comparé à chaque `npm test` ; la commande git est jouée à part (vérifications finales).
- **Commit :** f0516c4

**4. [Rule 1 - Précision du test] « 4 s de plus pour deux virements »**
- **Problème :** le routeur par isochrones retire la perte du pas de temps ; l’écart total n’est pas exactement la somme des pertes (mesures : +2,0 à +8,1 s pour une manœuvre selon la longueur).
- **Correction :** test « même nombre de manœuvres, écart positif, au plus 2 s par manœuvre et un pas d’isochrone », et route de travers sans manœuvre identique.
- **Commit :** e2a07df

**5. [Rule 1 - Scénario] Banane par vent du sud**
- **Problème :** par 260° (vent de tofinou-demarrage), la banane construite depuis la ligne du Lavandou tombe à terre (avertissement « B, C à terre ») : temps faux, identiques au génois et au foc.
- **Correction :** scénario tofinou-bateau par 6 nd de 180° (bouées dans la baie, aucun avertissement vérifié).
- **Commit :** e2a07df

**6. [Rule 1] Rendu de l’onglet de Naos dans un processus neuf**
- **Problème :** dans tests/tofinou.test.mjs, les tests du Tofinou posent la polaire de l’espace ; le rendu « Naos » du même processus aurait comparé une session impossible.
- **Correction :** `tests/helpers/j80v43.mjs --rendu <racine>` lancé dans un processus neuf, comparé à la fixture.
- **Commit :** e2a07df

**7. [Rule 1 - Scénario] Temps lus sur une analyse stable**
- **Problème :** première série complète : l’avertissement « à terre » lu pendant une analyse transitoire (machine chargée).
- **Correction :** `texteStable(page, 'course')` avant chaque lecture des temps ; série complète suivante 40/40.
- **Commit :** 1383c20

### Interprétations
- Textes du bateau dans js/app.js rendus propres à l’espace dès ce plan, parce qu’ils dépendent du bateau ou des pertes : « … pour un J80 » du briefing, « temps J80 estimé », note du routage « polaire J80 (pénalité ~9 s / ~6 s) » ; chaînes de Naos identiques (`CLASSE` = « J80 », pertes 9 / 6). Les autres mentions « J80 » (débrief, traces, aide, onglet Traces) restent pour 08-06.
- Onglet du Tofinou : cibles de 4 à 24 nd (la table s’arrête à 24 nd) ; colonne « Spi dès » gardée avec la formule du J80, notée « repère indicatif, à vérifier sur l’eau » (approximation à écrire dans le guide de 08-09/08-10).
- Choix de voile en boutons (`btn small`, `on` / `alt`, `aria-pressed`) : aucune règle CSS nouvelle, styles.css inchangé.
- Voile d’avant et tirant d’eau non tranchés : génois par défaut (donnée du certificat), foc au choix, mention « Voile du bateau à confirmer avec le skipper » ; tirant d’eau « à confirmer ».

## Known Stubs

Aucun.

## Threat Flags

Aucune surface nouvelle hors du `<threat_model>` : T-08-18 (certificat dans un dossier neuf, `JSON.parse`, extrait relu, cibles de l’étude), T-08-19 (source « sister-ship — à recaler », variante foc, recalage), T-08-20 (extrait sans nom, test des clés). `rade.bateau.v1` : clé locale de l’espace Tofinou, valeur relue en liste fermée (voile inconnue ou illisible → génois).

## Points pour 08-06

- Mentions « J80 » restantes : js/app.js (onglet Traces « de la polaire J80 », horsFondText de Brest, commentaires), js/debrief.js (« Vitesse face à la polaire J80 », « Débrief · J80 · Rade Tactique »), js/help.js ; `CLASSE` (js/app.js) donne la classe de l’espace (« J80 » pour Naos).
- `legType` (js/tactics.js) nomme les voiles « Foc » / « Spi asymétrique » : à voir pour le Tofinou (génois) avec les textes du plan d’eau (08-07).
- La polaire courante a pour source celle de l’espace (`getPolar().source`, envoyée dans les faits du débrief, js/app.js `polar: getPolar().source`) : la consigne de débrief de Tofinou (08-09) peut la citer.
- `ESPACE.bateau` porte désormais `virement_s`, `empannage_s`, `tirant`, `onglet`, `reglages: false` pour Tofinou ; Naos garde `{ classe, longueur }`.
- Banane de Bormes par vent d’ouest (260°) depuis la ligne du Lavandou : B et C à terre avec 0,8 Nq (déjà signalé par l’app) ; à garder en tête pour les scénarios et les réglages par défaut de 08-07/08-08.
- Temps de banane par 6 nd de sud assez longs (110 min pour 3,2 Nq) : vent local faible près du Lavandou dans le champ par défaut ; à regarder avec les régimes de Bormes (08-07).

## Self-Check: PASSED
