---
phase: 08-espace-tofinou
verified: 2026-11-27T12:00:00Z
status: human_needed
score: 8/8 critères de la feuille de route vérifiés (code, tests, production) ; contrôles sur l'eau et sur de vrais documents à faire par l'équipage
covered_files:
  - ".planning/phases/08-espace-tofinou/08-01-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-01-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-02-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-02-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-03-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-03-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-04-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-04-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-05-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-05-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-06-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-06-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-07-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-07-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-08-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-08-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-09-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-09-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-10-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-10-SUMMARY.md"
  - ".planning/phases/08-espace-tofinou/08-11-PLAN.md"
  - ".planning/phases/08-espace-tofinou/08-11-SUMMARY.md"
  - "api/_espace.js"
  - "api/_ia.js"
  - "api/_tofinou.js"
  - "api/archive.js"
  - "api/debrief.js"
  - "api/ic.js"
  - "api/rules.js"
  - "api/voice.js"
  - "data/tofinou95.pol"
  - "data/venues.json"
  - "guide-tofinou.html"
  - "js/app.js"
  - "js/bateau.js"
  - "js/espaces.js"
  - "js/help.js"
  - "js/polar-tofinou95.js"
  - "js/regates.js"
  - "js/regedit.js"
  - "js/tactics.js"
  - "js/venue-bormes.js"
  - "js/venues.js"
  - "js/version.js"
  - "manifest-tofinou.webmanifest"
  - "middleware.js"
  - "release.json"
  - "sw.js"
  - "tests/apiia.test.mjs"
  - "tests/bormes.test.mjs"
  - "tests/espaces.test.mjs"
  - "tests/helpers/naos.mjs"
  - "tests/naos.test.mjs"
  - "tests/regedit.test.mjs"
  - "tests/tofinou.test.mjs"
  - "tests/tofinouic.test.mjs"
  - "tools/codes-acces.mjs"
  - "tools/compat-v43.mjs"
  - "tools/gardes-toulon.mjs"
covered_digest: "v3:sha256:266b7f895f37d9e991b20d9d2d20228b6dc30ae4002d42fb47e787aff4371713"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Bateau réel de Frédéric : voile d'avant (génois ou foc) et quille (tirant d'eau 2,20 m ou 1,20 m) ; accord sur l'emprunt du certificat ORC du sister-ship"
    expected: "Voile par défaut et tirant d'eau affichés dans l'onglet « Tofinou » conformes au bateau ; la mention « estimation » reste tant que la polaire n'est pas recalée sur l'eau"
    why_human: "Donnée du bateau connue du skipper seulement ; le code affiche des valeurs « à confirmer »"
  - test: "Positions des bouées mouillées du Challenge (bouées « position à confirmer »), ligne du milieu de la baie, PCS/BAG, côté de la banane n° 4"
    expected: "Positions et côtés conformes à ce que pose le comité le jour de la manche"
    why_human: "Positions lues sur des croquis ; seule l'observation sur l'eau tranche"
  - test: "Relire les conseils de vent de Bormes (huit régimes, mistral d'ouest, brise) et les vents prédéfinis"
    expected: "Conseils jugés justes par l'équipage ; les hypothèses restent marquées « à confirmer sur l'eau »"
    why_human: "Savoir local et sens marin ; aucun test ne peut juger la pertinence tactique"
  - test: "Comparer le contour de la zone militaire du Levant et de Brégançon aux arrêtés en vigueur et à la carte marine"
    expected: "Zones de l'app au moins aussi larges que les zones réglementaires ; mention « à compléter sur carte marine » visible"
    why_human: "Texte réglementaire et carte marine hors du dépôt"
  - test: "Frédéric charge les vraies IC d'une manche (PDF) dans l'espace Tofinou : lecture par l'IA, relecture, bouées « à confirmer », parcours"
    expected: "Chemin complet sans texte de Naos, bouées dans les bornes de Bormes, appel compté dans le quota de l'espace Tofinou"
    why_human: "Le scénario tofinou-ic utilise un PDF d'essai ; un vrai document et une vraie réponse d'OpenAI restent à voir"
  - test: "Poser une vraie question à l'arbitre de l'espace Tofinou (règle RIR, pénalité d'un tour)"
    expected: "Réponse fondée sur les consignes du Tofinou (RIR, un tour, VHF 72), citations vérifiées, rien de Naos ni du CVAT"
    why_human: "Qualité d'une réponse réelle du modèle ; les tests utilisent un faux client"
  - test: "Sur iPhone : installer « Tofinou Bormes » depuis tofinou-bormes.vercel.app, couper le réseau, rouvrir ; puis « Changer d'espace » avec le code de Romain"
    expected: "Nom d'installation « Tofinou Bormes », ouverture hors réseau sur Bormes avec la prévision de secours, bascule vers Rade Tactique et retour"
    why_human: "Installation PWA et hors réseau sur Safari iOS réel ; Chromium émulé ne remplace pas l'appareil"
---

# Phase 8 : Espace Tofinou — rade de Bormes – Le Lavandou — Rapport de vérification

**Objectif de la phase :** Un second espace « Tofinou — Bormes », cloisonné de Naos (adresse distincte, archive séparée côté serveur, quota d'IA par espace et prénom, consignes d'IA propres), pour le Tofinou 9.5 de Frédéric (et Romain) dans la rade de Bormes – Le Lavandou : polaire du Tofinou 9.5, plan d'eau de Bormes hors réseau avec ses vents et ses zones, catalogue et fiche du Challenge de la Baie 2026-2027 ; rien ne change pour Naos ; v44 en production sur « publie » de Romain, au plus tard le 10/12/2026.
**Vérifié le :** 2026-11-27
**Statut :** human_needed
**Re-vérification :** non (première vérification)
**Tête vérifiée :** branche locale `suivi-gsd-08` = `main` = `origin/main` = `5ce8222` (v45, hachage `ca298965e8`), plus `08-10-SUMMARY.md` modifié non commité.

## Atteinte de l'objectif

### Vérités observables (critères de succès de la feuille de route)

| # | Critère | Statut | Preuve |
|---|---------|--------|--------|
| 1 | Naos identique à la v43 : gel capturé sur 5e9b8a5 avant toute modification, gardes Toulon et SNPM vertes, même URL, même archive `prod/light.json`, mêmes clés | ✓ VERIFIED | Le gel (`f2d388e`, `d99c524`, `9c03a59`) précède toute modification de l'app : entre 5e9b8a5 et ces commits, seuls `.planning/` et les tests du gel changent. `tests/naos.test.mjs` compare middleware, fichiers publics, archive, quota, consignes d'IA, liste hors réseau et pack de Brest à `tests/fixtures/naos-v43.json` ; `differencesAdmises` ne tolère que l'en-tête `x-rt-espace: naos`, les champs `espace`/`espaces` de `/api/membre` et, depuis la v45, le seul `data/brest.wx-snapshot.json` (un test vérifie que ces tolérances ne masquent pas un autre écart). Rejoué : `npm run check` 1032/1032, `node tools/gardes-toulon.mjs` code 0 (six gardes OK), `compat-v43` 5/5 dont 84 vues de Naos identiques octet pour octet. Préfixe de Naos inchangé : `prefixe('naos') = prod|preview` (`api/_espace.js`). |
| 2 | Le code décide de l'espace ; aucun accès croisé, même avec `x-rt-espace` forgé ou absent ; code refusé sur l'adresse de l'autre espace ; packs refusés à l'autre espace ; aucune graine SNPM/GPEN chez Tofinou ; garde de synchronisation | ✓ VERIFIED | `tests/espaces.test.mjs` : T1 (en-tête du client écrasé), T2 (code d'un espace sur l'hôte de l'autre = code inconnu, aucun cookie), T3 (archive sans espace valide, `__proto__`, autre casse : 403), T5 (archive, traces, rapports, vents du jour invisibles d'un espace à l'autre, aucun chemin hors `tofinou/` touché), T10 (pack d'un autre espace : 404 sans écho). Corbeille sous le même préfixe (`api/archive.js:162`). `tests/apiarchive.test.mjs` T7 : graines `snpm-2026`/`gpen-2027` refusées (400) chez Tofinou, recalages vidés. Quota : T8 dans `tests/apiia.test.mjs`. Garde de synchronisation : `espaceSur` (`js/espaces.js`) et `espaceOk()` avant tout appel à `/api/archive` (`js/app.js:2277`) ; scénario `espace-garde` rejoué : OK. |
| 3 | Adresse propre `tofinou-bormes.vercel.app`, nom d'installation « Tofinou Bormes », hors réseau sur Bormes ; « Changer d'espace » ; Frédéric n'a que Tofinou ; code par empreinte seule ; outil de création de codes | ✓ VERIFIED | Production interrogée : `tofinou-bormes.vercel.app/manifest.webmanifest` rend « Tofinou — Bormes » / « Tofinou Bormes », `rade-tactique.vercel.app` rend « Rade Tactique — Toulon » ; `sw.js` des deux adresses = `ca298965e8` = `js/version.js` local ; sans code : 401 sur `/api/membre` et sur le pack. Test « accès de l'espace Tofinou : exactement Frédéric et Romain ; Frédéric dans aucune autre table » vert (rien affiché). `tools/codes-acces.mjs` + `tests/codes.test.mjs` (code montré une fois, empreinte seule écrite). « Changer d'espace » : `js/help.js:154-173`. Scénario `tofinou-demarrage` rejoué : OK. Installation et hors réseau sur iPhone : vérification humaine. |
| 4 | Bormes : pack, lieux, marques fixes et bouées « à confirmer », dangers, zones interdites évitées par le routage, Port-Cros « à compléter », régimes de vent propres marqués selon leur origine, courant d'ouest en information, ni marée ni courant, aucun texte de Toulon | ✓ VERIFIED | `data/bormes.*` : six fichiers du pack plus l'instantané météo (v45). `tests/bormes.test.mjs` (tous exécutés, aucun sauté) : emprise et maille, Levant non urbain, zones du Levant et de Brégançon, routage qui contourne le Levant militaire (et le traverse sans zone), 46 lieux, marques, huit régimes exclusifs avec mistral d'ouest, origine de chaque conseil, carte « État de la mer » avec courant d'ouest en information, plus de « large de Cépet ». `js/venue-bormes.js` : ni marée ni courant dans le routage, borne ouest de saisie 6,20° E. |
| 5 | Tofinou 9.5 avec la polaire du certificat ORC du sister-ship (génois par défaut, foc), recalable, 9,47 m, pertes, tirant d'eau, présenté comme une estimation | ✓ VERIFIED | `data/tofinou95.pol`, `data/tofinou95-foc.pol`, `js/polar-tofinou95.js`, `js/bateau.js` ; `js/espaces.js` : 9,47 m, 11 s / 8 s, tirant 2,20 / 1,20 m. `tests/tofinou.test.mjs` : certificat référencé, cibles VMG, recalage (polaire importée prioritaire, « Polaire par défaut » revient au Tofinou), pertes appliquées au routage, onglet « à confirmer » / « estimation », onglet de Naos = capture v43. |
| 6 | Fiche du Challenge de la Baie semée chez Tofinou (sept manches, manche 1 le 11/10, ouverte les jours de course seulement), catalogue (neuf parcours, sens inverse, banane n° 4) ; arbitre, débrief, dictée avec les consignes du Tofinou ; Naos inchangé ; quota 30 par espace + prénom | ✓ VERIFIED | `js/regates.js:200-260` : `baieSeed` (sept manches, finale sur deux jours, `jours`, VHF 72, RIR, un tour), semée seulement si l'espace porte la graine. Catalogue testé dans `tests/bormes.test.mjs` (parcours 1 à 10 sans 8, banane n° 4, sens inverse « R »). `api/_tofinou.js` ; `tests/apiia.test.mjs` : consignes de Tofinou pour les quatre fonctions, sans Naos/CVAT/J80 ; Naos garde les consignes de la v43 (empreintes du gel) ; `QUOTA = 30` compté sous `prefixe(espace)`, le 31e appel de Frédéric refusé sans toucher Naos. |
| 7 | v44 sur l'aperçu, vérifiée, puis en production sur « publie » de Romain au plus tard le 10/12, jamais dans les 48 h avant une régate ; domaine de Tofinou ajouté | ✓ VERIFIED | API GitHub : PR #18 (`apercu-phase-08`) fusionnée le 27/11 à 00:55 UTC (`0142dd1`, `release.json` n = 44) ; PR #19 fusionnée à 05:04 UTC (`5ce8222`, v45). Production sur les deux adresses = `ca298965e8`. 27/11 : avant le 10/12, hors des 48 h avant la manche 3 du Challenge et la régate de Toulon du 13/12. « Publie » de Romain consigné dans `08-10-SUMMARY.md`. Partie iPhone : vérification humaine. |
| 8 | Frédéric charge ses IC de bout en bout dans l'espace Tofinou ; éditeur de parcours à la main partagé par l'archive Tofinou, refusé en course, absent chez Naos | ✓ VERIFIED | `tests/tofinouic.test.mjs` (PDF d'essai lu par le vrai pdf.js, bouées de Bormes bornées, libellés sans texte de Naos) ; `tests/apiic.test.mjs` (consigne d'IC de Tofinou) ; `tests/regedit.test.mjs` (bouées saisies ou touchées, porte, arrivée, tours, partage par éléments, archive `tofinou/`). Éditeur conditionné par `ESPACE.editeurParcours` (faux pour Naos) et `racing()` (`js/app.js:798, 2714, 2918`). `compat-v43` (a) à (d) : téléphone resté en v43 compatible. Scénario `tofinou-parcours` rejoué : OK. Vraies IC : vérification humaine. |

**Score :** 8/8 vérités vérifiées (0 présente sans preuve de comportement).

### Artefacts requis (frontmatter des plans)

`gsd-tools verify.artifacts` et `verify.key-links` sur les onze plans : 08-01 à 08-09 et 08-11 tout vert (40/40 artefacts, 23/23 liens). 08-10 : 2/3 artefacts et 1/2 lien, l'écart venant du motif `"n": 44` dans `release.json` et `js/version.js` : la v45 a remplacé la v44 (`n = 45`). La v44 est prouvée par `git show 0142dd1:release.json` (n = 44). Ce n'est pas un manque (voir Info).

### Vérification des liens clés

| De | Vers | Par | Statut |
|----|------|-----|--------|
| middleware (en-tête `x-rt-espace`) | `api/archive.js`, `api/_ia.js` | `espaceDe` / `prefixe` (`api/_espace.js`) | ✓ WIRED (tests bout à bout d'`espaces.test.mjs`) |
| `js/espaces.js` | `js/app.js` | `bootEspace`/`setEspace` avant le plan d'eau, `espaceOk()` avant l'archive | ✓ WIRED |
| `api/_tofinou.js` | `rules`, `debrief`, `voice`, `ic` | choix de la consigne par l'espace de la requête | ✓ WIRED (tests des quatre fonctions) |
| `js/regedit.js` | `js/app.js` | `ESPACE.editeurParcours`, `bindEditor` | ✓ WIRED |
| `manifest-tofinou.webmanifest` | production | réécriture du manifeste par le middleware | ✓ WIRED (curl sur les deux adresses) |

### Contrôles de comportement rejoués

| Comportement | Commande | Résultat | Statut |
|--------------|----------|----------|--------|
| Tests et fichiers générés à jour | `npm run check` | stamp à jour ; 1032 tests, 1032 verts, 0 sauté, 0 échec | ✓ PASS |
| Gardes Toulon, SNPM, gel de Naos, pack de Brest | `node tools/gardes-toulon.mjs` | code 0, six OK | ✓ PASS |
| Compatibilité v43 et vues de Naos | `node tools/compat-v43.mjs <extraction 5e9b8a5>` (dans le scratchpad) | 5/5, 84 vues identiques | ✓ PASS |
| Démarrage de Tofinou, garde d'espace, éditeur | `PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-demarrage espace-garde tofinou-parcours` | 3/3 OK | ✓ PASS |
| Manifestes et version en production | `curl` des deux adresses | noms par espace, `sw.js` = `ca298965e8`, 401 sans code | ✓ PASS |
| Couverture des décisions D-01 à D-18 | `check.decision-coverage-verify` | 18/18 honorées | ✓ PASS |

La série Chromium complète (46/46 en v44, 10 scénarios en v45) n'a pas été relancée, comme demandé. Aucune sonde `scripts/*/tests/probe-*.sh` dans le dépôt (Probe Execution : sans objet). Aucun fichier de l'app modifié par cette vérification (`git status` : seul `08-10-SUMMARY.md`).

### Couverture des exigences

| Exigence | Description (abrégée) | Statut | Preuve |
|----------|-----------------------|--------|--------|
| ESPACE-01 | serveur cloisonné, `x-rt-espace` | ✓ SATISFIED | critère 2 |
| ESPACE-02 | IA par espace, quota espace + prénom | ✓ SATISFIED | critère 6 |
| ESPACE-03 | espace par l'adresse, garde, « Changer d'espace » | ✓ SATISFIED | critères 2 et 3 (preuve en production faite) |
| ESPACE-04 | plans d'eau et graines par espace | ✓ SATISFIED | critère 2 |
| ESPACE-05 | gel de Naos | ✓ SATISFIED | critère 1 |
| ESPACE-06 | manifeste et identité par espace | ✓ SATISFIED | critère 3 (réécriture vue en production) |
| ESPACE-07 | outil de codes, empreinte seule | ✓ SATISFIED | critère 3 |
| TOF-01 | bateau Tofinou 9.5 | ✓ SATISFIED | critère 5 |
| TOF-02 | pack de Bormes | ✓ SATISFIED | critère 4 ; l'instantané météo manquant en v44 est livré en v45 (test non sauté) |
| TOF-03 | savoir local de Bormes | ✓ SATISFIED | critère 4 |
| TOF-04 | Challenge de la Baie, consignes du Tofinou | ✓ SATISFIED | critère 6 |
| TOF-05 | livraison v44 | ✓ SATISFIED | critère 7 |
| TOF-06 | IC et éditeur de parcours | ✓ SATISFIED | critère 8 |

Aucune exigence orpheline.

### Audit de la qualité des tests

| Fichier | Exigences | Sautés | Circulaire | Niveau d'assertion | Verdict |
|---------|-----------|--------|------------|--------------------|---------|
| `tests/naos.test.mjs` | ESPACE-05 | 0 | non (fixture capturée sur l'extraction de 5e9b8a5, jamais recapturée sur le code modifié) | valeur, octet pour octet | OK |
| `tests/espaces.test.mjs` | ESPACE-01/03/04/06/07 | 0 | non | comportement (middleware réel puis fonction) | OK |
| `tests/apiarchive.test.mjs`, `tests/apiia.test.mjs` | ESPACE-01/02, TOF-04 | 0 | non | comportement | OK |
| `tests/bormes.test.mjs` | TOF-02/03/04 | 0 à l'exécution (les sauts conditionnels n'ont pas joué) | non (valeurs de l'étude) | valeur | OK |
| `tests/tofinou.test.mjs` | TOF-01 | 0 | partiel (cibles VMG tirées de la table du certificat) | valeur | OK |
| `tests/regedit.test.mjs`, `tests/tofinouic.test.mjs` | TOF-06 | 0 | non | comportement | OK |

Tests désactivés sur une exigence : 0. Motifs circulaires bloquants : 0.

### Anti-motifs

| Fichier | Motif | Gravité | Effet |
|---------|-------|---------|-------|
| 83 fichiers modifiés depuis 5e9b8a5 (hors `.planning`, `data`, `vendor`) | `TBD` / `FIXME` / `XXX` | aucun trouvé | — |
| mêmes fichiers | `TODO` / `HACK` / « not yet implemented » | aucun trouvé | — |
| `js/venue-bormes.js`, `js/regates.js` | « à confirmer », « à compléter sur carte marine » | ℹ️ Info | voulu : mentions destinées à l'équipage (D-12, D-13, D-14) |

### Info (sans effet sur le statut)

1. **v45 après la v44 :** la v45 (accord de Romain consigné dans `08-10-SUMMARY.md`) ajoute `data/brest.wx-snapshot.json` au pack de Brest et un repli de `rankCourses` sur la première ligne du plan d'eau (WINDOWS n° 18, `js/tactics.js:577`). Toulon n'est pas touché (la ligne « vignettes » existe) ; le gel n'admet que l'instantané, et `gardes-toulon.mjs` exclut ce seul fichier. Le critère 1 reste vrai pour la v44 publiée ; en lettre stricte, Naos à Brest n'est plus « identique à la v43 » depuis la v45. Il serait bon de le noter dans la feuille de route.
2. **Suivi GSD en retard :** `ROADMAP.md` marque 08-10 non fait (« 10/11 plans executed ») ; `REQUIREMENTS.md` laisse TOF-02, TOF-03, TOF-05 non cochés et ESPACE-03/05 « Partiel/Pending » ; `STATE.md` s'arrête au point de décision de 08-10. C'est à mettre à jour par l'orchestrateur (non modifié ici).
3. **Plan 08-10 :** le statut du frontmatter de `08-10-SUMMARY.md` est `complete`, mais son titre dit encore « tâche 1 faite, points de contrôle en attente ». La section ajoutée à la fin consigne bien les tâches 2 et 3.

### Couverture des décisions

Toutes les décisions de CONTEXT.md suivies sont honorées par les artefacts livrés : 18/18. (D-18 : le guide cite le vrai libellé de l'app, « ⤓ Importer un fichier GPX » de l'onglet Traces, au lieu de « Importer un GPX » de l'onglet Régates ; l'écart est documenté dans 08-10.)

## Vérification humaine requise

### 1. Bateau réel
**Test :** voile d'avant (génois ou foc), quille (2,20 m ou 1,20 m), accord sur l'emprunt du certificat ORC du sister-ship.
**Attendu :** valeurs de l'onglet « Tofinou » conformes ; mention « estimation » tant que la polaire n'est pas recalée.
**Pourquoi humain :** donnée connue du skipper seulement.

### 2. Bouées et parcours du Challenge
**Test :** positions des bouées « à confirmer », ligne du milieu de la baie, PCS/BAG, côté de la banane n° 4.
**Attendu :** conformes au comité le jour de la manche.
**Pourquoi humain :** positions lues sur des croquis.

### 3. Conseils de vent de Bormes
**Test :** relire les huit régimes et les vents prédéfinis.
**Attendu :** conseils justes ; hypothèses marquées « à confirmer sur l'eau ».
**Pourquoi humain :** savoir local.

### 4. Zones du Levant et de Brégançon
**Test :** comparer aux arrêtés et à la carte marine.
**Attendu :** zones de l'app au moins aussi larges que les zones réglementaires.
**Pourquoi humain :** textes réglementaires hors du dépôt.

### 5. Vraies IC de Frédéric
**Test :** charger le PDF des IC d'une manche dans l'espace Tofinou jusqu'au parcours.
**Attendu :** chemin complet, bornes de Bormes, quota de l'espace Tofinou, aucun texte de Naos.
**Pourquoi humain :** le scénario utilise un PDF d'essai et un faux client d'IA.

### 6. Vraie question à l'arbitre de Tofinou
**Test :** poser une question sur les RIR ou la pénalité d'un tour.
**Attendu :** réponse fondée sur les consignes du Tofinou, citations vérifiées.
**Pourquoi humain :** qualité d'une vraie réponse du modèle.

### 7. iPhone
**Test :** installer « Tofinou Bormes », rouvrir hors réseau, « Changer d'espace » avec le code de Romain.
**Attendu :** nom d'installation juste, Bormes hors réseau avec la prévision de secours, bascule dans les deux sens.
**Pourquoi humain :** PWA sur Safari iOS réel.

## Bilan des écarts

Aucun écart bloquant. Les huit critères sont vérifiés dans le code, par les tests rejoués (1032/1032, gardes vertes, compat-v43 5/5, trois scénarios Chromium) et en production (v45 `ca298965e8` servie aux deux adresses avec leur manifeste propre). Restent les contrôles humains sur l'eau, sur de vrais documents et sur iPhone. Il faut aussi mettre à jour le suivi GSD (feuille de route, exigences, état). Aucun code d'accès ni empreinte de code dans ce rapport.

---

_Vérifié : 2026-11-27_
_Vérificateur : Claude (gsd-verifier)_
