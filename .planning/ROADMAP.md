# Roadmap: Rade Tactique

## Overview

Rade Tactique existe déjà et a gagné la Coupe SNPM le 18/10/2026. Ce jalon la rend prête pour la régate CVAT des 7-9 novembre 2026 sans ajouter de tactique : d'abord un filet de sécurité qui empêche une mise en ligne de casser l'app ou de la recharger en course, puis la fiabilité et la justesse en mer (bips, voyants, ouverture hors réseau, bouées), ensuite l'ouverture d'une régate par n'importe quel équipier avec le vent du jour figé et le débrief rattaché, enfin l'archive partagée en ligne pour tout l'équipage. Chaque phase livre à l'équipage une tranche utilisable de bout en bout.

Échéance et règle de coupe :
- Gel du code visé le 2 novembre 2026 ; ensuite corrections seulement, essai en mer sur les iPhone de l'équipage (version affichée, `npm run check` vert, diagnostic sans erreur).
- Aucune mise en production dans les 48 h qui précèdent la régate (à partir du 5 novembre), sauf correctif critique appliqué hors course.
- Les phases 1 à 3 sont indispensables pour la régate. La phase 4 est coupable : si elle n'est pas prête au gel, la régate se court avec l'archive locale de la phase 3 et l'archive partagée est livrée après la régate.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): travail prévu du jalon
- Decimal phases (2.1, 2.2): insertions urgentes (marquées INSERTED)

Les phases décimales s'intercalent entre les phases entières qui les entourent, dans l'ordre numérique.

- [x] **Phase 1: Mises en ligne sans risque** - Tests des calculs et de l'accès, porte de déploiement, version et fichiers hors réseau générés, mise à jour jamais appliquée en course, import PDF sûr (completed 2026-10-19)
- [x] **Phase 2: Fiable et juste en mer** - Bips à la seconde, alerte son coupé, voyant d'état, ouverture rapide hors réseau, journal de diagnostic, bouées douteuses signalées et recalables (completed 2026-10-19)
- [ ] **Phase 3: Ouvrir une régate** - Tout équipier crée l'épreuve, ses manches et ses IC relues ; vent du jour figé, fiche de régate, GPX rattaché et débrief lancé
- [ ] **Phase 4: Archive partagée** - Régates en ligne, privées, synchronisées entre les appareils de l'équipage et lisibles hors réseau (phase coupable)

## Phase Details

### Phase 1: Mises en ligne sans risque

**Goal**: Une mise en ligne ne peut plus casser l'app ni interrompre une course : une version fautive est refusée avant d'arriver sur les téléphones, une mise à jour attend la fin du chrono ou de l'enregistrement, et l'équipier sait quelle version il a en main.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, SECU-01, FIAB-01, FIAB-02
**Success Criteria** (what must be TRUE):
  1. Une seule commande (`npm run check`) teste les calculs (géométrie, polaire, routage, vent, lecture GPX, débrief) et retrouve les résultats de référence de la Coupe SNPM du 18/10/2026 ; une mise en ligne dont un test échoue n'arrive pas en production.
  2. Sans code d'accès, toute page, tout fichier et toute fonction privée (chemins anciens comme nouveaux) est refusé ou renvoie vers la page d'accès, et un test le vérifie avant chaque mise en ligne.
  3. Une version publiée pendant un chrono de départ, un enregistrement de trace ou une journée de régate (jusqu'au retour au port, sauf avant 9 h) ne recharge pas l'app : un bandeau la propose hors course avec un bouton « Mettre à jour » ; la version en service (numéro et date) se consulte dans l'aide.
  4. Chaque mise en ligne porte un numéro de version et une liste de fichiers hors réseau générés automatiquement : une seule commande (`npm run release`) régénère version et liste, et la porte refuse toute mise en ligne qui l'a oubliée : aucun fichier n'est à ajouter à la main.
  5. Un PDF d'IC piégé importé dans l'app n'exécute aucun code, et les IC CVAT habituelles s'importent toujours.

**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Filet de tests : `npm test` rejoue la Coupe SNPM, calculs de base, contrôle d'accès prouvé (matcher resserré), import PDF sûr (vague 1)
- [x] 01-02-PLAN.md — Version et liste hors réseau générées par `tools/stamp.mjs`, version dans l'aide (vague 1, en parallèle)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-03-PLAN.md — Mise à jour différée : worker en attente, bandeau, verrou « en course » et « journée de régate », « Course finie », régate sur plusieurs jours (vague 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-04-PLAN.md — Porte de mise en ligne (`npm run gate`), v26, règle d'exploitation, aperçu vérifié par Romain puis activation et mise en production à un moment calme (vague 3)

**UI hint**: yes

### Phase 2: Fiable et juste en mer

**Goal**: En mer, l'équipier se fie à ce que l'app montre et fait entendre : le chrono bipe à la seconde ou prévient qu'il est muet, un voyant dit ce qui fonctionne, l'app s'ouvre vite sans réseau, les erreurs sont consignées, et une bouée dont la position est douteuse est signalée puis recalable.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: FIAB-03, FIAB-04, FIAB-05, FIAB-06, FIAB-07, JUST-01, JUST-02
**Success Criteria** (what must be TRUE):
  1. Pendant un compte à rebours, les bips tombent à la seconde même quand l'app calcule (routage, carte) ; si le son est coupé, l'app le signale, propose « tester le son » et double chaque bip clé d'un signal visuel plein écran.
  2. En mode départ et en course, un voyant permanent montre l'âge du dernier point GPS, l'écran maintenu, le son et le réseau, et passe en alerte dès que l'un d'eux lâche (par exemple un GPS muet depuis plus de 10 s).
  3. Sur les iPhone de l'équipage, l'app installée s'ouvre en moins de 2 s en mode avion ou avec un réseau très faible, et le mode départ, le GPS, le chrono et la carte fonctionnent sans attendre le réseau.
  4. Après une sortie, un équipier ouvre le journal de diagnostic dans l'app et y lit les erreurs survenues en mode départ et en mode course, avec leur heure.
  5. Une bouée dont la position n'est pas confirmée est signalée sur la carte, dans les parcours et en mode départ ; un équipier la recale par un point GPS au passage ou par saisie, et la bouée affiche ensuite la source et la date de sa position.

**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Chrono fiable : bips posés sur l'horloge audio, son vérifié (« Tester le son »), flash plein écran, verrou d'écran unique et honnête (vague 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Journal de diagnostic (Aide › Journal) et voyant GPS / écran / son / réseau en mode départ et en course (vague 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Ouverture < 2 s hors réseau : interface utile d'abord, 3D différée, vent par tranches, recalculs automatiques reportés pendant la séquence (gestes et relevés immédiats), mesure Chromium (vague 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — Bouées à confirmer signalées et recalées (sommet du virage au débrief, D-02 amendé, ou saisie), source et date affichées (vague 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-05-PLAN.md — Guide de l'équipage à jour, mesures Chromium obligatoires, v27 sur l'aperçu `apercu-phase-02` (vague 5)

**UI hint**: yes

### Phase 3: Ouvrir une régate

**Goal**: N'importe quel équipier, sans Romain, ouvre l'épreuve (CVAT ou autre club) avec ses manches, ses IC relues et ses marques confirmées ; le vent et la stratégie du jour sont figés automatiquement, et le GPX importé après la course se range dans la bonne régate et lance le débrief. Tout est conservé sur l'appareil ; le partage vient en phase 4.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: REG-01, REG-02, REG-03, REG-04, ARCH-02, ARCH-04
**Success Criteria** (what must be TRUE):
  1. Un équipier autre que Romain crée une régate (nom, date, club) en moins d'une minute, lui ajoute plusieurs manches ayant chacune son parcours, et la voit classée à venir, aujourd'hui ou passée.
  2. Le PDF des IC (CVAT ou autre club) s'importe en relecture champ par champ : chaque valeur montre l'extrait d'origine, une valeur invraisemblable (date, heure, canal VHF, position hors du plan d'eau) est signalée, un champ illisible reste vide plutôt que deviné, et rien n'est retenu sans validation.
  3. Pour une régate hors cahier CVAT, les bouées et parcours lus dans les IC apparaissent sur la carte à confirmer et ne servent ni au routage ni au mode départ tant qu'ils ne sont pas confirmés.
  4. Le vent et la stratégie du jour (prévisions, relevés, route conseillée) sont figés dans la régate sans geste de l'équipage ; la liste des régates par saison mène à une fiche qui réunit ce vent du jour, les traces, le débrief, l'analyse polaire, le rapport et l'auteur de chaque élément.
  5. Un GPX d'Open GPX Tracker importé après la course, pauses comprises, se rattache tout seul à la régate du jour et lance le débrief, sans relier les pauses par une ligne droite.

**Plans:** 3/7 plans executed (v28 : plans 01 à 05 ; v29 : plans 06 et 07)

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Régates : création en trois champs, statut et liste par saison, reprise des fiches, verrou lu dans la régate du jour, manches, auteur par `GET /api/membre` (vague 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — IC CVAT relues champ par champ : extraits de `parseIC`, puces de vraisemblance, rien sans « Valider les IC » (vague 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — Vent et route du jour figés sans geste (sceau au premier signal), fiche « Vent du jour », débrief tardif sur le vent figé (vague 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 03-04-PLAN.md — GPX rangé tout seul dans la régate de son jour et débrief lancé, pauses non reliées, fiche avec traces, polaire, débrief, rapport (vague 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 03-05-PLAN.md — Onglet « Régates », guide et aide, nettoyage de js/events.js, vérifications `PW_REQUIRED=1`, v28 sur l'aperçu `apercu-phase-03` (vague 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 03-06-PLAN.md — IC d'un autre club lues par l'IA (`api/ic.js`, extraits vérifiés mot pour mot), même relecture, hors réseau et erreurs, constante `IA_IC` (vague 6)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 03-07-PLAN.md — Bouées et parcours d'un autre club à confirmer sur la carte avant usage, guide, v29 sur l'aperçu et essai réel de la lecture IA (vague 7)

**UI hint**: yes

### Phase 4: Archive partagée

**Goal**: Tout l'équipage retrouve chaque régate (vent du jour, traces, débrief, rapport) sur n'importe quel appareil, en privé, même sans réseau, sans jamais perdre ce qui a été saisi hors réseau ni rien changer pendant une course.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ARCH-01, ARCH-03
**Success Criteria** (what must be TRUE):
  1. Une régate créée ou complétée sur le téléphone d'un équipier apparaît sur les appareils des deux autres dès que le réseau revient ; ce qui a été saisi hors réseau part ensuite sans perte ni doublon, et rien n'est envoyé ni reçu pendant un chrono ou un enregistrement.
  2. Si deux équipiers complètent la même régate chacun de leur côté, hors réseau, les deux ajouts sont conservés après synchronisation.
  3. Sans code d'accès, aucune régate, trace, fiche ni aucun rapport de l'archive n'est lisible, quelle que soit l'adresse essayée, et le test d'accès de la phase 1 couvre ces nouvelles adresses.
  4. En mode avion, un équipier ouvre les régates récentes déjà synchronisées sur son appareil : fiche, débrief et rapport.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Mises en ligne sans risque | 4/4 | Complete    | 2026-10-19 |
| 2. Fiable et juste en mer | 5/5 | Complete    | 2026-10-19 |
| 3. Ouvrir une régate | 3/7 | In Progress | - |
| 4. Archive partagée | 0/TBD | Not started | - |
