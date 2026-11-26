# Requirements: Rade Tactique

**Defined:** 2026-10-19
**Core Value:** Le jour de la régate, l'équipage peut ouvrir l'épreuve, s'en servir en mer sans que rien ne lâche, et retrouver ensuite le débrief : des conseils et des chiffres justes, fiables sur l'eau, et partagés par tout l'équipage.

## v1 Requirements

Version visée : prête pour la régate CVAT des 7-9 novembre 2026 (gel du code visé le 2 novembre). Chaque besoin est relié à une phase de la feuille de route.

### En mer (FIAB)

- [x] **FIAB-01**: Une mise à jour publiée pendant un chrono ou un enregistrement ne recharge jamais l'app ; un bandeau la propose et elle s'applique hors course
- [x] **FIAB-02**: L'équipier peut consulter la version de l'app (numéro et date) dans l'aide
- [x] **FIAB-03**: Les bips du chrono tombent à la seconde, même quand l'app calcule (planifiés sur l'horloge audio)
- [x] **FIAB-04**: L'app prévient si le son est coupé, propose « tester le son » et double chaque bip clé d'un signal visuel plein écran
- [x] **FIAB-05**: Un voyant permanent montre le GPS (âge du dernier point), l'écran maintenu, le son et le réseau
- [x] **FIAB-06**: L'app installée s'ouvre en moins de 2 s hors réseau ou avec un réseau faible
- [x] **FIAB-07**: Les erreurs du mode départ et du mode course sont consignées dans un journal de diagnostic consultable dans l'app

### Non-régression (TEST)

- [x] **TEST-01**: Des tests automatiques couvrent les calculs (géométrie, polaire, routage, vent, lecture GPX, débrief), avec la Coupe SNPM du 18/10/2026 comme cas de référence
- [x] **TEST-02**: Un test vérifie que, sans code d'accès, aucune page, aucun fichier ni aucune fonction privée n'est servi
- [x] **TEST-03**: Une mise en ligne est bloquée si un test échoue
- [x] **TEST-04**: La version de l'app et la liste des fichiers hors réseau sont générées automatiquement, sans oubli possible

### Justesse (JUST)

- [x] **JUST-01**: Les bouées dont la position n'est pas confirmée sont signalées sur la carte, dans les parcours et dans le mode départ
- [x] **JUST-02**: Un équipier peut recaler la position d'une bouée (point GPS au passage ou saisie), avec la source et la date

### Sécurité (SECU)

- [x] **SECU-01**: L'import d'un PDF d'IC ne peut pas exécuter de code (faille de la lecture PDF corrigée)

### Ouvrir une régate (REG)

- [x] **REG-01**: N'importe quel équipier crée une régate (nom, date, club) en moins d'une minute, avec un statut à venir / aujourd'hui / passée
- [x] **REG-02**: Une journée peut compter plusieurs manches, chacune avec son parcours
- [x] **REG-03**: Le PDF des IC (CVAT ou autre club) s'importe avec une relecture champ par champ (extrait d'origine affiché) et des contrôles de vraisemblance ; rien n'est retenu sans validation
- [x] **REG-04**: Pour une régate hors cahier CVAT, les bouées et parcours lus dans les IC sont confirmés sur la carte avant usage

### Archive partagée (ARCH)

- [x] **ARCH-01**: Les régates sont stockées en ligne, en privé, et partagées par l'équipage ; chaque téléphone se synchronise dès que le réseau revient, sans rien perdre hors réseau
- [x] **ARCH-02**: Liste des régates par saison et fiche de régate : vent et stratégie du jour figés automatiquement (prévisions, relevés, route conseillée), traces, débrief, analyse polaire, rapport, auteur de chaque élément
- [x] **ARCH-03**: Les régates récentes restent lisibles hors réseau
- [x] **ARCH-04**: Un GPX importé (Open GPX Tracker, pauses comprises) se rattache tout seul à la régate du jour et lance le débrief

### Parcours (PARC)

- [x] **PARC-01**: Parcours banane construit au vent (bouée au vent, dégagement facultatif, nombre de tours) depuis la ligne choisie
- [x] **PARC-02**: Porte sous le vent à deux bouées, avec la bouée conseillée à chaque passage d'après le routage
- [x] **PARC-03**: Arrivée décalée (au vent ou sous le vent), distincte de la ligne de départ
- [x] **PARC-04**: Porte et arrivée décalée dans les parcours d'un autre club (IC lues par l'IA ou saisies)

## v2 Requirements

Reportés après cette version. Suivis mais hors de la feuille de route actuelle.

### En mer

- **FIAB2-01**: Enregistrement de trace incassable dans l'app (par blocs, reprise après arrêt brutal, trous signalés, écran maintenu fiable) — Open GPX Tracker reste la référence en attendant
- **FIAB2-02**: Écran « Aujourd'hui » avec un seul bouton principal selon le moment (préparer, partir, débriefer)

### Archive

- [x] **ARCH2-01**: Reprise de la Coupe SNPM et des données déjà présentes sur les téléphones comme premières régates de l'archive
- **ARCH2-02**: Export d'une régate (JSON et GPX)
- **ARCH2-03**: Notes d'équipage rapides (cote 1-5, une amélioration, dictée)
- **ARCH2-04**: Comparaison prévu / réel et ligne de départ mémorisée par manche

### Sécurité et coûts

- [x] **SECU2-01**: Plafond de dépense OpenAI, quota par équipier et non-conservation des données (`store:false`)
- **SECU2-02**: Jeton de session révocable à la place du code dans le cookie

### Plans d'eau et code

- **VENUE-01**: Les données propres à la rade (zone, relief, bouées, parcours, IC par défaut) ne sont plus écrites dans le code mais dans un « pack » de plan d'eau (repris en phase 7)
- **CODE-01**: `js/app.js` découpé en modules testables, panneau par panneau

### Rade de Brest (BREST) — phase 7

Ajoutés le 2026-11-19 à la demande de Romain (« permets le changement de plan d'eau en intégrant la rade de Brest et surtout la zone de course habituelle du GPEN »), livrés en v43 avant la régate de Toulon du 13/12/2026.

- [x] **BREST-01**: Toulon reste identique à la v42 : bords, conseils, champ de vent, routes, positions, météo, vues, données et liste hors réseau gardés par des tests capturés sur la v42 avant toute modification ; garde SNPM intacte ; ouverture hors réseau en moins de 2 s
- [x] **BREST-02**: L'équipier choisit son plan d'eau (Toulon ou rade de Brest) en entraînement libre et pour une régate ; une régate porte son plan d'eau, partagé par l'archive et lu sans erreur par un téléphone resté en v42 ; changer de plan d'eau recharge l'app, jamais pendant une course
- [x] **BREST-03**: La rade de Brest se télécharge une fois à la demande, vérifiée par empreinte, reste disponible après les mises à jour de l'app et s'ouvre hors réseau ; sans téléchargement, un message clair
- [x] **BREST-04**: Carte et relief de la rade de Brest (rade, goulet, Camaret), lieux, marques, dangers et zones interdites (Île Longue, Pen ar Vir) évitées par le routage, positions en longitude Ouest justes, sources et licences citées
- [x] **BREST-05**: Vents de Brest : régimes et vents prédéfinis propres, réglage « mer dégagée » du champ de vent, conseils marqués selon leur origine et présentés comme à confirmer sur l'eau
- [x] **BREST-06**: Heure et hauteur de la marée de Brest (pleines et basses mers, marnage, coefficient approché) calculées hors réseau et contrôlées contre les observations
- [x] **BREST-07**: Courant de l'atlas du Shom par heure de marée utilisé par le routage (vitesse fond, marge sur les fonds), les conseils (renverses, côté favorable) et l'affichage (briefing, carte, Départ, En course), absent à Toulon
- [x] **BREST-08**: GPEN 2027 J80 : fiche semée, zone A sur la carte, parcours 1 et 2 construits au vent avec arrivée à droite du comité, variante Virginie Hériot, IC du GPEN pour l'arbitre, le débrief et la dictée à Brest

### Espace Tofinou — rade de Bormes (ESPACE, TOF) — phase 8

Ajoutés le 2026-11-26 à la demande de Romain (« créer la même chose pour un Tofinou dans la rade de Bormes / Le Lavandou, à partager avec un code… sans accès aux régates de J80 de Toulon et Brest »), livrés en v44 dès qu'elle est prête et vérifiée, au plus tard le 10/12/2026 (sinon après la régate de Toulon du 13/12) (08-CONTEXT, D-01 à D-15).

- [x] **ESPACE-01**: Le code d'accès décide de l'espace, jamais l'app : le middleware est la seule source (`x-rt-espace` posé en écrasant toute valeur du client, `/api/membre` rend `{ membre, espace }`), un code d'un espace est refusé sur l'adresse d'un autre comme un code inconnu, les fonctions refusent une requête sans espace valide (403)
- [ ] **ESPACE-02**: Archive (régates, traces, rapports, vents figés, corbeille), quotas et IA cloisonnés par espace côté serveur : préfixes `tofinou/…` (Naos `prod/…` à l'octet près), régates d'un autre plan d'eau, graines SNPM/GPEN et recalages CVAT refusés à l'archive Tofinou, quota de 30 appels par jour compté par espace + prénom, consignes d'IA propres à chaque espace
- [ ] **ESPACE-03**: Une adresse par espace (stockage, caches, service worker et cookie séparés par le navigateur), même projet et même déploiement ; Romain dans les deux espaces avec « Changer d'espace », Frédéric dans l'espace Tofinou seulement ; garde de synchronisation (aucun envoi tant que l'espace n'est pas confirmé, ni vers un autre espace)
- [ ] **ESPACE-04**: Plans d'eau et graines par espace : l'espace Tofinou ne voit que Bormes (pack de Brest refusé), Naos ne voit pas Bormes (pack refusé) ; aucune graine SNPM ni GPEN dans l'espace Tofinou ; l'installation hors réseau de chaque espace reste complète
- [ ] **ESPACE-05**: Naos identique à la v43 : gel capturé sur 5e9b8a5 avant toute modification (réponses du middleware, chemins Blob, consignes d'IA, clés de stockage, liste hors réseau, pack de Brest), gardes Toulon et garde SNPM vertes, même URL, même archive, mêmes clés locales
- [ ] **ESPACE-06**: Nom, textes et manifeste par espace (« Tofinou — Bormes », app « Tofinou Bormes ») : page d'accès, titre, aide, débrief, manifeste réécrit par le middleware sur l'adresse de Tofinou ; installable à part
- [x] **ESPACE-07**: Outil de création des codes : affiche le code une seule fois avec le lien personnel et n'écrit que l'empreinte ; aucun code d'accès dans le dépôt, les tests, les journaux ni la PR ; le code de Frédéric, créé par l'orchestrateur, n'y entre que par son empreinte
- [ ] **TOF-01**: Bateau Tofinou 9.5 : polaire tirée du certificat ORC Club 2026 du sister-ship (génois par défaut, variante foc estimée), polaire par défaut de l'espace recalable (performance, polaire personnelle), longueur 9,47 m, pertes 11 s / 8 s, tirant d'eau 2,20 / 1,20 m à confirmer, confiance affichée comme estimation
- [ ] **TOF-02**: Pack « Bormes » hors réseau (relief, côte, fond de carte, instantané météo) construit par les outils du dépôt : emprise 6,22–6,60° E, 42,96–43,20° N, maille 30 m, Levant militaire non urbain, borne ouest de saisie 6,20° E, seuil « mer dégagée » par défaut
- [ ] **TOF-03**: Savoir local de Bormes : lieux, marques fixes (La Fourmigue, coffre 1) et bouées « position à confirmer », dangers, zones interdites (Levant militaire, Brégançon) évitées par le routage et règles de Port-Cros, « à compléter sur carte marine » ; régimes de vent propres (mistral d'ouest) et vents prédéfinis marqués selon leur origine ; ni marée ni modèle de courant (courant d'ouest en information) ; plus aucun texte de Toulon à Bormes
- [ ] **TOF-04**: Challenge de la Baie 2026-2027 : catalogue (neuf parcours dont la banane n° 4, sens inverse), fiche semée dans l'espace Tofinou (sept manches, manche 1 le dimanche 11/10, VHF 72, un tour, RIR), arbitre, débrief, dictée et lecture des IC avec les consignes du Tofinou
- [ ] **TOF-05**: Livraison v44 : guide Tofinou court, vérification complète (gardes, compatibilités, tous les scénarios, mesures), aperçu `apercu-phase-08` vérifié, production sur « publie » de Romain au plus tard le 10/12/2026 (sinon après le 13/12), gel de Naos et gardes Toulon verts comme condition absolue, domaine `tofinou-bormes.vercel.app` ajouté par Romain, code de Frédéric remis à Romain dans la conversation
- [ ] **TOF-06**: IC et parcours de l'équipage Tofinou (D-16, D-17) : Frédéric charge ses propres IC dans l'espace Tofinou de bout en bout (PDF → IA avec les consignes d'IC du Tofinou → relecture → bouées « à confirmer » bornées à Bormes → parcours), avec l'archive et le quota de l'espace ; éditeur de parcours à la main dans l'espace Tofinou seulement (« Créer un parcours » / « Modifier le parcours » : nom, bouées confirmées avec côté, porte de deux bouées, arrivée sur la ligne de départ ou distincte, tours ; bouées ajoutées par position saisie ou touchée sur la carte, à confirmer), partagé par l'archive Tofinou (fusion par éléments comme les manches, forme lisible par la v43), refusé pendant une course, absent de l'espace Naos

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plans d'eau autres que Toulon, Brest et Bormes | Hors périmètre ; la rade de Brest est ajoutée en phase 7 (2026-11-19), la rade de Bormes – Le Lavandou en phase 8 pour l'espace Tofinou seulement (2026-11-26) ; Trophée des Îles (Porquerolles), Saint-Tropez et modèle de courant à Bormes hors périmètre (08-CONTEXT) |
| Application native iOS/Android | Décidé : PWA uniquement |
| Suivi en direct, traces publiques, classements | App privée d'équipage, pas un outil de flotte |
| Comptes et rôles fins | Équipiers tous égaux dans leur espace (choix de Romain) ; deux espaces cloisonnés depuis la phase 8, sans rôles |
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
| FIAB-01 | Phase 1 | Complete |
| FIAB-02 | Phase 1 | Complete |
| FIAB-03 | Phase 2 | Complete |
| FIAB-04 | Phase 2 | Complete |
| FIAB-05 | Phase 2 | Complete |
| FIAB-06 | Phase 2 | Complete |
| FIAB-07 | Phase 2 | Complete |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |
| TEST-04 | Phase 1 | Complete |
| JUST-01 | Phase 2 | Complete |
| JUST-02 | Phase 2 | Complete |
| SECU-01 | Phase 1 | Complete |
| REG-01 | Phase 3 | Complete |
| REG-02 | Phase 3 | Complete |
| REG-03 | Phase 3 | Complete |
| REG-04 | Phase 3 | Complete |
| ARCH-01 | Phase 4 | Complete |
| ARCH-02 | Phase 3 | Complete |
| ARCH-03 | Phase 4 | Complete |
| ARCH-04 | Phase 3 | Complete |
| ARCH2-01 | Phase 5 | Complete |
| SECU2-01 | Phase 5 | Complete |
| PARC-01 | Phase 6 | Complete |
| PARC-02 | Phase 6 | Complete |
| PARC-03 | Phase 6 | Complete |
| PARC-04 | Phase 6 | Complete |
| VENUE-01 | Phase 7 | Complete |
| BREST-01 | Phase 7 | Complete |
| BREST-02 | Phase 7 | Complete |
| BREST-03 | Phase 7 | Complete |
| BREST-04 | Phase 7 | Complete |
| BREST-05 | Phase 7 | Complete |
| BREST-06 | Phase 7 | Complete |
| BREST-07 | Phase 7 | Complete (données et calcul en 07-07 ; routage, conseils et affichage en 07-08) |
| BREST-08 | Phase 7 | Complete |
| ESPACE-01 | Phase 8 | Complete (08-02) |
| ESPACE-02 | Phase 8 | Pending (serveur fait en 08-02 ; consignes Tofinou 08-09) |
| ESPACE-03 | Phase 8 | Pending (08-04, 08-06, 08-10) |
| ESPACE-04 | Phase 8 | Pending (packs et graines refusés par le serveur en 08-02 ; app 08-04) |
| ESPACE-05 | Phase 8 | Pending (08-01, preuve finale 08-10) |
| ESPACE-06 | Phase 8 | Pending (08-06) |
| ESPACE-07 | Phase 8 | Complete (08-02) |
| TOF-01 | Phase 8 | Pending (08-05) |
| TOF-02 | Phase 8 | Partiel : pack construit (08-03) ; borne ouest de saisie (08-04) et instantané météo (08-09) à faire |
| TOF-03 | Phase 8 | Pending (08-07) |
| TOF-04 | Phase 8 | Pending (08-08, 08-09) |
| TOF-05 | Phase 8 | Pending (08-10) |
| TOF-06 | Phase 8 | Pending (08-11) |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-19*
*Last updated: 2026-10-19 after roadmap creation (traceabilité remplie ; total corrigé de 23 à 22 besoins v1)*
*Mise à jour 2026-10-20 : ARCH2-01 et SECU2-01 (reportés en v2, repris en phase 5) cochés après le plan 05-03 ; le plafond OpenAI reste à poser par Romain (05-USER-SETUP.md)*
*Mise à jour 2026-10-23 : PARC-01 à PARC-04 ajoutés (phase 6, parcours banane, avant le gel à la demande de Romain)*
*Mise à jour 2026-11-19 : PARC-01 à PARC-04 cochés (phase 6 en production en v38, complétée jusqu'à la v42)*
*Mise à jour 2026-11-19 : VENUE-01 repris et BREST-01 à BREST-08 ajoutés (phase 7, plans d'eau : Toulon et rade de Brest, GPEN)*
*Mise à jour 2026-11-26 : ESPACE-01 à ESPACE-07 et TOF-01 à TOF-05 ajoutés (phase 8, espace Tofinou — rade de Bormes – Le Lavandou, Tofinou 9.5, Challenge de la Baie)*
*Mise à jour 2026-11-26 : TOF-06 ajouté (phase 8, D-16 et D-17 : IC et parcours de l'équipage Tofinou, plan 08-11)*
