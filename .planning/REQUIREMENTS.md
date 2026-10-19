# Requirements: Rade Tactique

**Defined:** 2026-10-19
**Core Value:** Le jour de la régate, l'équipage peut ouvrir l'épreuve, s'en servir en mer sans que rien ne lâche, et retrouver ensuite le débrief : des conseils et des chiffres justes, fiables sur l'eau, et partagés par tout l'équipage.

## v1 Requirements

Version visée : prête pour la régate CVAT des 7-9 novembre 2026 (gel du code visé le 2 novembre). Chaque besoin est relié à une phase de la feuille de route.

### En mer (FIAB)

- [ ] **FIAB-01**: Une mise à jour publiée pendant un chrono ou un enregistrement ne recharge jamais l'app ; un bandeau la propose et elle s'applique hors course
- [ ] **FIAB-02**: L'équipier voit la version de l'app à l'écran de départ
- [ ] **FIAB-03**: Les bips du chrono tombent à la seconde, même quand l'app calcule (planifiés sur l'horloge audio)
- [ ] **FIAB-04**: L'app prévient si le son est coupé, propose « tester le son » et double chaque bip clé d'un signal visuel plein écran
- [ ] **FIAB-05**: Un voyant permanent montre le GPS (âge du dernier point), l'écran maintenu, le son et le réseau
- [ ] **FIAB-06**: L'app installée s'ouvre en moins de 2 s hors réseau ou avec un réseau faible
- [ ] **FIAB-07**: Les erreurs du mode départ et du mode course sont consignées dans un journal de diagnostic consultable dans l'app

### Non-régression (TEST)

- [ ] **TEST-01**: Des tests automatiques couvrent les calculs (géométrie, polaire, routage, vent, lecture GPX, débrief), avec la Coupe SNPM du 18/10/2026 comme cas de référence
- [ ] **TEST-02**: Un test vérifie que, sans code d'accès, aucune page, aucun fichier ni aucune fonction privée n'est servi
- [ ] **TEST-03**: Une mise en ligne est bloquée si un test échoue
- [ ] **TEST-04**: La version de l'app et la liste des fichiers hors réseau sont générées automatiquement, sans oubli possible

### Justesse (JUST)

- [ ] **JUST-01**: Les bouées dont la position n'est pas confirmée sont signalées sur la carte, dans les parcours et dans le mode départ
- [ ] **JUST-02**: Un équipier peut recaler la position d'une bouée (point GPS au passage ou saisie), avec la source et la date

### Sécurité (SECU)

- [ ] **SECU-01**: L'import d'un PDF d'IC ne peut pas exécuter de code (faille de la lecture PDF corrigée)

### Ouvrir une régate (REG)

- [ ] **REG-01**: N'importe quel équipier crée une régate (nom, date, club) en moins d'une minute, avec un statut à venir / aujourd'hui / passée
- [ ] **REG-02**: Une journée peut compter plusieurs manches, chacune avec son parcours
- [ ] **REG-03**: Le PDF des IC (CVAT ou autre club) s'importe avec une relecture champ par champ (extrait d'origine affiché) et des contrôles de vraisemblance ; rien n'est retenu sans validation
- [ ] **REG-04**: Pour une régate hors cahier CVAT, les bouées et parcours lus dans les IC sont confirmés sur la carte avant usage

### Archive partagée (ARCH)

- [ ] **ARCH-01**: Les régates sont stockées en ligne, en privé, et partagées par l'équipage ; chaque téléphone se synchronise dès que le réseau revient, sans rien perdre hors réseau
- [ ] **ARCH-02**: Liste des régates par saison et fiche de régate : vent et stratégie du jour figés automatiquement (prévisions, relevés, route conseillée), traces, débrief, analyse polaire, rapport, auteur de chaque élément
- [ ] **ARCH-03**: Les régates récentes restent lisibles hors réseau
- [ ] **ARCH-04**: Un GPX importé (Open GPX Tracker, pauses comprises) se rattache tout seul à la régate du jour et lance le débrief

## v2 Requirements

Reportés après cette version. Suivis mais hors de la feuille de route actuelle.

### En mer

- **FIAB2-01**: Enregistrement de trace incassable dans l'app (par blocs, reprise après arrêt brutal, trous signalés, écran maintenu fiable) — Open GPX Tracker reste la référence en attendant
- **FIAB2-02**: Écran « Aujourd'hui » avec un seul bouton principal selon le moment (préparer, partir, débriefer)

### Archive

- **ARCH2-01**: Reprise de la Coupe SNPM et des données déjà présentes sur les téléphones comme premières régates de l'archive
- **ARCH2-02**: Export d'une régate (JSON et GPX)
- **ARCH2-03**: Notes d'équipage rapides (cote 1-5, une amélioration, dictée)
- **ARCH2-04**: Comparaison prévu / réel et ligne de départ mémorisée par manche

### Sécurité et coûts

- **SECU2-01**: Plafond de dépense OpenAI, quota par équipier et non-conservation des données (`store:false`)
- **SECU2-02**: Jeton de session révocable à la place du code dans le cookie

### Plans d'eau et code

- **VENUE-01**: Les données propres à la rade (zone, relief, bouées, parcours, IC par défaut) ne sont plus écrites dans le code mais dans un « pack » de plan d'eau
- **CODE-01**: `js/app.js` découpé en modules testables, panneau par panneau

## Out of Scope

| Feature | Reason |
|---------|--------|
| Ajouter réellement un second plan d'eau | Choix de Romain : plus tard ; on prépare seulement l'architecture (v2) |
| Application native iOS/Android | Décidé : PWA uniquement |
| Suivi en direct, traces publiques, classements | App privée d'équipage, pas un outil de flotte |
| Comptes et rôles fins | Trois équipiers, tous égaux (choix de Romain) |
| Édition collaborative en temps réel | Incompatible avec le hors-ligne ; une fusion simple suffit à trois |
| Inscriptions, scoring et résultats officiels | Rôle des organisateurs |
| Capteurs NMEA / Bluetooth | Hors du besoin et du matériel du J80 |
| Notifications push et chat | WhatsApp sert déjà à l'équipage |
| Archivage séparé de la fiche IC | Non retenu par Romain ; le débrief porte déjà le parcours |
| Régates au-delà de 25 nœuds | L'équipage ne régate pas au-delà |
| GPS écran verrouillé dans l'app | Impossible pour une app web sur iPhone ; Open GPX Tracker enregistre |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIAB-01 | Phase 1 | Pending |
| FIAB-02 | Phase 1 | Pending |
| FIAB-03 | Phase 2 | Pending |
| FIAB-04 | Phase 2 | Pending |
| FIAB-05 | Phase 2 | Pending |
| FIAB-06 | Phase 2 | Pending |
| FIAB-07 | Phase 2 | Pending |
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 1 | Pending |
| TEST-04 | Phase 1 | Pending |
| JUST-01 | Phase 2 | Pending |
| JUST-02 | Phase 2 | Pending |
| SECU-01 | Phase 1 | Pending |
| REG-01 | Phase 3 | Pending |
| REG-02 | Phase 3 | Pending |
| REG-03 | Phase 3 | Pending |
| REG-04 | Phase 3 | Pending |
| ARCH-01 | Phase 4 | Pending |
| ARCH-02 | Phase 3 | Pending |
| ARCH-03 | Phase 4 | Pending |
| ARCH-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-19*
*Last updated: 2026-10-19 after roadmap creation (traceabilité remplie ; total corrigé de 23 à 22 besoins v1)*
