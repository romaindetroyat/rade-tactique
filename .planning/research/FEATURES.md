# Feature Research

**Domain:** application de tactique de régate pour un équipage privé de 3 (J80 Naos, rade de Toulon) — jalon « archive partagée + ouverture de régate + fiabilité + simplicité + multi-plans d'eau »
**Researched:** 2026-10-19
**Confidence:** MEDIUM (voir « Niveau de confiance » en fin de document)

Contexte : l'app existante couvre déjà la préparation (vent 3D, routage, polaire), le mode départ, la trace GPS, l'import GPX, le débrief IA, les règles. Cette recherche ne re-liste pas ces fonctions. Elle porte sur ce qui manque pour le jalon : **mémoire partagée de l'équipage (archive)**, **création d'une régate à venir**, **fiabilité en mer**, **autonomie de tout équipier**, **ouverture à d'autres plans d'eau (en coulisses)**.

## Constat sur le paysage concurrent

Les outils se répartissent en deux familles qui ne se rejoignent presque jamais :

| Famille | Exemples | Unité de base | Ce qu'ils font bien | Ce qu'ils ne font pas |
|---|---|---|---|---|
| Instruments / capteurs de bord | Vakaros Atlas 2 + Connect, Velocitek ProStart / Control Center, SailFreeGPS, tack X, Regatta Starter | La **session** (une sortie enregistrée) | Départ (distance à la ligne, temps à la ligne, OCS), enregistrement, export | Pas de notion d'épreuve, de vent du jour ni d'archive d'équipage ; l'analyse est déléguée (Vantage, SailSync, Expedition) |
| Replay / suivi de flotte | RaceQs, TracTrac, eStela, SailTrace, Sail Tactician, Pathfinder, SailRacerPro, SailSync AI | La **course** (et sa flotte) | Rejouer, comparer des bateaux, détecter les manœuvres, créer une « régate » à partir de balises | Pensés pour la flotte et le public (traces publiques, classements) ; rien sur la préparation, les IC ni la stratégie du jour |
| Outils d'organisateur | Manage2Sail, Sailwave, kSail, RRS.org (tableau d'affichage officiel) | L'**épreuve** (avis de course, IC, inscriptions, résultats) | Documents officiels, inscriptions, résultats | Côté comité, pas côté équipage ; aucune aide tactique |

**Le créneau de Rade Tactique** : l'objet « épreuve » des outils d'organisateur, relié au vent/stratégie de la préparation et aux traces/débrief des outils de replay, pour un seul équipage. Aucun outil trouvé ne combine « IC importées → épreuve → vent du jour figé → traces → débrief » dans un carnet privé. Le jalon doit donc être pensé comme **un carnet de saison d'équipage**, pas comme un clone de RaceQs/TracTrac.

## Feature Landscape

### Table Stakes (l'équipage s'y attend ; leur absence fait abandonner l'app)

Complexité : LOW = < 1 jour, MEDIUM = 1 à 3 jours, HIGH = > 3 jours ou risque technique.

#### A. Archive partagée (carnet de saison)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Liste des régates passées, la plus récente en haut, regroupées par saison, avec date, nom, club et résultat/commentaire court | Tous les outils de replay ont une liste d'événements passés (TracTrac : « tous les événements passés, présents et futurs ») ; c'est le point d'entrée d'un carnet | LOW | Une seule « Régates » à venir / en cours / passées, pas trois écrans |
| Fiche d'une régate : vent du jour, route conseillée, traces, débrief, analyse polaire, rapport, au même endroit | C'est la définition du besoin (PROJECT.md : « Archive partagée ») | MEDIUM | Dépend du modèle de données épreuve → manches → traces (voir dépendances) |
| Instantané figé des prévisions et des relevés du jour | Les prévisions Open-Meteo changent ; sans instantané, le « vent de la veille » affiché plus tard est faux. Comparer « prévu vs réel » est le cœur du retour d'expérience | MEDIUM | Stocker les sorties du modèle utilisées (par modèle, par heure) et les relevés, pas seulement le résultat. Le fichier `data/wx-snapshot.json` montre déjà le principe |
| Plusieurs manches par journée (parcours différents, faux départs) | Une régate CVAT = plusieurs manches ; Coupe SNPM 18/10 : parcours 4 réduit, deux faux départs. Les outils de flotte modélisent « course » comme sous-élément de l'événement | MEDIUM | Le débrief détecte déjà départs et parcours : proposer le découpage, laisser corriger |
| Import GPX rattaché à une régate, pas flottant | Open GPX Tracker est le flux réel ; un GPX orphelin dans un coin n'est pas une archive | LOW | Proposer automatiquement la régate dont la date correspond |
| Consultation sur tout appareil (iPhone, ordinateur) | Contrainte du jalon : aujourd'hui tout est local à l'appareil | MEDIUM (dépend du stockage partagé) | Lecture hors-ligne des régates récentes (cache) : au ponton sans réseau, on veut relire le débrief |
| Qui a ajouté / modifié quoi, et quand | À 3 sur la même archive, « qui a mis cette trace ? » se pose tout de suite | LOW | Un champ auteur + date par élément ; les codes personnels fournissent déjà l'identité |
| Modification possible par tout équipier, sans perte silencieuse | Décision actée (« tout équipier peut ouvrir une régate et modifier l'archive ») | MEDIUM | Voir anti-fonctions : pas d'édition collaborative temps réel ; dernier-écrit-gagne par champ + historique/annulation + suppression « douce » |
| Rapport partageable (HTML) conservé | Déjà livré (`rapports/`), les équipiers l'envoient à des proches | LOW | Le rapport vit désormais dans l'archive, derrière l'accès équipage ; lien public optionnel et non devinable, plutôt que le dossier public actuel (voir CONCERNS : `rapports/` contourne l'accès) |
| Sauvegarde / export de l'archive | Un carnet qu'on ne peut pas exporter inspire peu confiance ; l'équipage ne doit pas dépendre d'un seul hébergeur | LOW | Export JSON + GPX d'une régate ou de toute la saison |

#### B. Ouvrir une régate à venir

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Créer une épreuve en moins d'une minute : nom, date (heure de 1er signal), club/lieu | Les outils d'organisateur demandent le minimum : titre, dates, lieu. C'est aussi ce que l'avis de course liste (titre, dates, classes, lieu) | LOW | Tout le reste doit pouvoir être complété plus tard |
| Import du PDF des IC avec **étape de relecture** avant enregistrement | L'extraction automatique de texte PDF est faillible (mise en page, scans, autres clubs). Rien trouvé dans les outils existants : aucun n'extrait parcours/ligne des IC, donc on ne peut pas s'appuyer sur un standard ; les IC suivent toutefois l'Annexe L de World Sailing, ce qui donne une trame commune | MEDIUM-HIGH | L'extraction est déjà livrée (`js/events.js`, PDF.js) ; le travail du jalon est surtout la relecture, la correction et la gestion des IC d'un autre club. Le texte extrait doit toujours rester vérifiable face au PDF |
| Parcours : choisir parmi les parcours connus, ou en définir un (liste de marques + ordre + laisser à bâbord/tribord) | Les IC d'un club occasionnel ne sont pas dans le cahier CVAT. RaceQs fait créer la « régate » par waypoints ; c'est le modèle attendu | MEDIUM | Marques saisies par coordonnées, ou posées sur la carte, ou « à tant de degrés et de milles de la marque X ». Marque approximative signalée comme telle (déjà fait avec `src: 'approx'`) |
| Marques et ligne de départ propres à l'épreuve (pas globales) | Un autre club = d'autres bouées ; le comité change les marques d'un jour à l'autre | MEDIUM | C'est la même brique que le multi-plans d'eau : les marques appartiennent à la régate, avec un modèle de « plan d'eau » qui fournit les valeurs par défaut |
| Statut de l'épreuve : à venir → aujourd'hui → passée | Toute l'app doit savoir quoi proposer (préparer / courir / débriefer) | LOW | Dérivé de la date, avec bascule manuelle |
| Dupliquer une régate (même série d'une année sur l'autre, même club) | Le CVAT se répète ; ressaisir n'a pas de sens | LOW | Copie nom, club, parcours, marques ; vide traces et vent |
| Modifier / compléter une épreuve après création (avenant aux IC, changement de parcours) | Les avenants et changements de dernière minute sont la norme | LOW | Même éditeur que la création |

#### C. Fiabilité en mer

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Enregistrement de trace qui survit à l'écran verrouillé / app en arrière-plan, **ou qui le dit clairement** | Un ProStart ou un Atlas ne s'arrêtent pas ; un téléphone si. La confiance se perd au premier trou dans une trace. Limite de la plateforme PWA sous iOS : pas de vraie exécution en arrière-plan | HIGH | À traiter par détection et alerte plutôt que par promesse impossible : réacquérir le verrou d'écran à `visibilitychange`, indicateur visible « enregistrement actif, dernier point il y a N s », alerte sonore/vibrante si arrêt, marquage des trous dans la trace |
| Écriture continue de la trace en stockage local (par blocs) | Si l'app plante ou iOS tue l'onglet, la trace déjà enregistrée doit survivre | MEDIUM | IndexedDB, flush régulier ; reprise proposée au redémarrage |
| Mode départ : lisible en plein soleil, gros boutons, aucun écran de confirmation bloquant, bips fiables | Cœur de Velocitek, Vakaros, Regatta Starter, tack X : c'est la fonction la plus utilisée en course | LOW (déjà livré) | Reste à valider sur cas réels et à ajouter la reprise après interruption (appel, notification) |
| Fonctionnement hors réseau complet, y compris la création/édition d'une régate | La rade a des zones sans couverture ; l'équipier doit pouvoir noter au ponton | MEDIUM | File d'écritures locales (« à synchroniser ») + synchronisation au retour du réseau + indicateur visible de l'état de synchro |
| Indicateur d'état unique : GPS ok / trace en cours / réseau / synchro / batterie | Tous les instruments affichent leur état ; ici l'erreur silencieuse (`catch {}` ~25 fois) est le risque | LOW-MEDIUM | Remplacer les erreurs avalées par un état visible |
| Mise à jour qui ne casse pas une course en cours | Risque identifié (`skipWaiting` immédiat) | LOW-MEDIUM | Pas de remplacement à chaud pendant un enregistrement ou un chrono ; invite « nouvelle version » après |
| Tests de non-régression des calculs clés | Un conseil faux en mer est pire qu'aucun conseil | MEDIUM | Déjà au périmètre du jalon ; ne pas confondre avec une fonction visible |

#### D. Simplicité : n'importe quel équipier, sans le skipper

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Écran d'accueil « Aujourd'hui » centré sur la régate du jour, avec **un bouton principal** selon l'étape (Préparer → Départ → En course → Débrief) | Les apps de départ n'ouvrent que sur le chrono ; une app multi-fonctions doit guider | MEDIUM | Si une régate est « aujourd'hui » elle s'ouvre seule ; sinon la prochaine à venir |
| Débrief en un geste : importer la trace → débrief prêt, sans réglage | SailSync AI et SailRacerPro promettent « charge le GPX, lis le rapport » ; c'est le niveau de simplicité attendu | LOW-MEDIUM (existant) | Détection du parcours/départs déjà faite ; supprimer les questions préalables |
| Valeurs par défaut sûres partout (polaire J80, plan d'eau Toulon, bateau Naos) | Un équipier qui n'a pas construit l'app ne doit rien paramétrer | LOW | |
| Cibles tactiles larges, gants/soleil/mouillé, usage à une main | Contrainte d'usage en mer commune à tous les instruments de départ | LOW | |
| Aide contextuelle courte (« comment lancer le départ ») dans l'écran concerné | Le guide existe (`guide.html`) mais loin de l'action | LOW | |

#### E. Plans d'eau multiples (préparation, invisible pour l'équipage)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Données du plan d'eau (zone, relief, fond de carte, bouées, parcours, IC types) chargées depuis des fichiers de données, pas du code | Exigence du jalon ; condition pour une régate occasionnelle hors rade | HIGH | `js/courses.js`, `js/weather.js`, `js/geo.js`, `api/_rrs.js` à découpler ; schéma versionné |
| Chaque régate référence son plan d'eau | Sinon l'archive d'une régate hors rade s'affiche sur la rade de Toulon | MEDIUM | La régate occasionnelle d'un autre club reste « sans relief 3D » (mode dégradé : carte + marques + routage simple) tant qu'aucun plan d'eau n'est ajouté |

### Differentiators (avantage propre, aligné sur la valeur centrale)

La valeur centrale est : *retrouver après la régate des conseils et des chiffres justes, partagés par tout l'équipage*. Les différenciateurs doivent donc nourrir la **mémoire de l'équipage** plutôt que concurrencer les outils de flotte.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| « Vent et stratégie du jour » figés avec comparaison **prévu / réel** (prévision de la veille, relevés, vent déduit de la trace) | Aucun outil de replay trouvé n'archive la préparation ; c'est ce qui transforme une trace en retour d'expérience (« on a trop cru le modèle X par NO 12 nœuds ») | MEDIUM | Réutilise `scoreModels` et le vent déduit du débrief. Alimente aussi le scoring des modèles par plan d'eau dans le temps |
| **Jours semblables** : en préparant une régate, l'app propose les régates archivées au vent comparable (direction ±20°, force ±3 nœuds) avec ce qui a marché | Cœur du « carnet de saison » ; reproduit la pratique recommandée de noter les particularités du plan d'eau par direction de vent (Sailing World) mais sans effort de saisie | MEDIUM | Appariement simple sur 2 à 3 critères, pas d'apprentissage. Utile seulement après quelques régates archivées |
| Notes d'équipage rapides après la course : note 1 à 5 + « une chose à améliorer » par équipier, dictée à la voix | Pratique standard de débrief d'équipage (cote 1-5 et une amélioration, partage entre équipiers) ; la dictée existe déjà (`api/voice`) | LOW-MEDIUM | Trois mini-notes valent mieux qu'un journal libre. Tous les équipiers voient celles des autres |
| Trace de secours : les trois téléphones peuvent enregistrer ; l'app garde la meilleure trace (ou fusionne les trous) | Réponse concrète à « fiabilité en mer » sans matériel : redondance entre équipiers, dont un instrument unique n'est pas capable | MEDIUM-HIGH | Alignement par temps GPS, choix par taux de couverture/précision. À planifier après l'archive, pas avant |
| Ligne de départ pointée mémorisée dans la régate | La ligne pointée (comité/bouée) est une donnée précieuse : comparer le biais prévu et réel, et la reprendre le lendemain | LOW-MEDIUM | Donnée déjà produite par le mode départ ; la rattacher à la manche |
| Qualité des départs sur la saison (heure d'arrivée à la ligne, OCS, vitesse à la ligne) | Vakaros / SailSync font ça sur une session ; le faire sur la saison, pour *cet* équipage, est un vrai retour d'expérience | MEDIUM | Nécessite plusieurs manches archivées et la ligne mémorisée |
| Progrès sur la saison : % de polaire, pertes en virement/empannage, évolution de régate en régate | SailRacerPro / Expedition l'affichent pour une session, rarement sur une série ; l'archive rend la série possible | MEDIUM | Tableau de bord léger à la fin ; ne pas le construire avant d'avoir des données |
| Fiche d'avant-régate : « les 3 points des derniers débriefs » affichés au moment de préparer | Boucle apprendre-appliquer : le débrief alimente la prochaine préparation | LOW-MEDIUM | S'appuie sur les notes d'équipage et sur les jours semblables |
| Lecture des IC d'un autre club avec champs signalés « à vérifier » (parcours, horaires, ligne, zones interdites) | L'extraction assistée par IA des IC n'existe dans aucun outil trouvé ; utile à chaque régate hors CVAT | HIGH | Sortie structurée strictement validée, toujours relue par un humain ; le texte source reste consultable |
| Rejouer sa propre course (trace animée) sur la carte 3D avec la route conseillée en fantôme | RaceQs, SailTrace, Pathfinder proposent le replay ; le fantôme de la route optimale est propre à l'app | MEDIUM-HIGH | À reporter : forte valeur pédagogique mais non indispensable au jalon |

### Anti-Features (demandées souvent, problématiques ici)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Suivi en direct / traces publiques / classement de flotte (RaceQs, TracTrac, eStela, SailRacerPro « Live ») | Les concurrents le mettent en avant ; on voudrait voir les autres bateaux | Hors périmètre : équipage privé de 3, pas de données des autres bateaux, la trace des concurrents n'est pas disponible ; coût (temps réel, batterie) sans valeur pour l'équipage | Archive privée ; partage ponctuel d'un rapport par lien non devinable |
| Comptes, rôles et permissions fins (skipper, équipier, invité) | Réflexe de toute app partagée | Décision actée : tout équipier peut tout faire ; les rôles ajoutent des écrans et bloquent « sans le skipper » | Codes personnels existants + auteur/date sur chaque élément + historique et suppression douce |
| Édition collaborative en temps réel (curseurs, fusion de champs) | « Comme un Google Doc » | Complexe et inutile pour 3 personnes qui n'éditent pas en même temps ; souvent hors-ligne en mer | Dernier-écrit-gagne par champ, historique des versions, indicateur « modifié par X » |
| Gestion complète de régate côté organisateur : inscriptions, classements, scoring, avis officiels (Manage2Sail, Sailwave, kSail) | Le mot « régate » évoque tout cela | C'est le métier du comité, pas de l'équipage ; Sailwave/Manage2Sail le font déjà | Saisir seulement le résultat de l'équipage (place, nombre de bateaux) ; lien vers la page officielle |
| Archiver la fiche IC / le parcours comme élément séparé | Semble complet | Décision de Romain : non retenu, le débrief porte déjà le parcours couru | Le PDF reste une source d'import ; le parcours couru figure dans le débrief |
| Intégration capteurs (NMEA, Vakaros, Velocitek, B&G) | « Données de meilleure qualité » | Hors périmètre PWA (pas d'accès Bluetooth/NMEA fiable sous iOS Safari) ; le GPX via Open GPX Tracker suffit | Import de fichiers GPX/FIT d'instruments si l'équipage en achète un |
| Notifications push, chat et fil de commentaires dans l'app | Suite logique d'un espace partagé | Charge de maintenance, iOS PWA limité ; les trois équipiers ont déjà un canal de discussion | Champ « note d'équipage » par manche ; hors app pour la discussion |
| Synchronisation vidéo / photos embarquées | Les caméras embarquées sont courantes | Poids de stockage et de traitement ; hors valeur centrale (conseils et chiffres) | Lien externe optionnel dans les notes |
| Remplir tous les champs d'une régate avant de pouvoir l'ouvrir | Données propres | Tue l'objectif « simple » ; la régate occasionnelle doit s'ouvrir en une minute | Un nom et une date suffisent ; le reste se complète et se signale « à compléter » |
| Édition libre et illimitée de la polaire, du bateau, de la classe depuis l'interface | « Personnalisation » | Une valeur changée silencieusement fausse tous les verdicts (déjà signalé comme fragile) | Réglages en lecture seule ou derrière une action volontaire avec historique ; polaire régénérée par l'outil |
| Ajouter réellement un autre plan d'eau maintenant | Séduisant | Décision de Romain : « plus tard » | Rendre l'ajout possible (données externalisées), sans en livrer un |
| Application native / support au-delà de 25 nœuds / ouverture à d'autres équipages | Étendre l'audience | Hors périmètre déjà acté | — |

## Feature Dependencies

```
Stockage partagé de l'équipage (identité par code personnel conservée)
    └──requires──> Modèle de données Épreuve → Manches → Traces/Débriefs
                       ├──requires──> Archive : liste + fiche d'une régate
                       │                  └──requires──> Instantané figé du vent et des relevés
                       │                                     └──enhances──> Comparaison prévu / réel
                       │                                                       └──enhances──> Jours semblables
                       ├──requires──> Création d'une régate (nom, date, club)
                       │                  ├──enhances──> Import des IC avec relecture
                       │                  └──requires──> Parcours et marques propres à l'épreuve
                       │                                     └──requires──> Plan d'eau en données (hors du code)
                       └──enhances──> Import GPX rattaché à une manche

File d'écritures hors-ligne + indicateur de synchro
    └──requires──> Stockage local fiable (IndexedDB)
                       └──enhances──> Enregistrement de trace par blocs
                                          └──enhances──> Trace de secours (3 téléphones)

Notes d'équipage (dictées) ──enhances──> Fiche d'avant-régate ──enhances──> Jours semblables
Ligne de départ mémorisée ──enhances──> Qualité des départs sur la saison
Écran « Aujourd'hui » (un bouton principal) ──requires──> Statut d'épreuve (à venir / aujourd'hui / passée)

Édition collaborative temps réel ──conflicts──> Fonctionnement hors-ligne (fusion complexe) 
Rôles/permissions fins ──conflicts──> « Sans le skipper »
```

### Dependency Notes

- **Tout repose sur le modèle Épreuve → Manches → Traces :** la liste, la fiche, l'import GPX, le débrief, l'instantané de vent et la ligne de départ s'y rattachent. À figer avant toute interface, sinon migration douloureuse des archives.
- **L'instantané de vent est un prérequis, pas un bonus :** une prévision non figée à la date de la régate est irrécupérable plus tard. À mettre en place dès l'ouverture d'une régate (pas seulement à l'archivage), sinon la comparaison prévu/réel et les jours semblables sont impossibles pour les régates déjà courues.
- **Création d'une régate requiert des marques propres à l'épreuve :** sinon une régate d'un autre club doit modifier le code, ce qui contredit l'exigence. C'est la même brique que le multi-plans d'eau, donc la faire une seule fois.
- **Hors-ligne et stockage partagé s'imposent mutuellement :** la file d'écritures locales est ce qui rend le stockage partagé utilisable en mer ; ne pas livrer l'un sans l'autre.
- **Trace de secours dépend de l'enregistrement par blocs et de l'archive :** inutile avant que chaque trace soit rattachée à une manche.
- **Édition temps réel est en conflit avec le hors-ligne :** raison supplémentaire d'écarter cette fonction.

## MVP Definition

Échéance : régate CVAT vers le 7-9 novembre 2026 (environ 2 à 3 semaines). L'ordre de PROJECT.md est « fiabilité en mer et ouverture de régate d'abord ».

### Launch With (ce jalon, avant la prochaine régate CVAT)

- [ ] Fiabilité de la trace et du mode départ : alerte d'arrêt, réacquisition du verrou d'écran, écriture par blocs, indicateur d'état unique — la confiance en mer conditionne tout le reste
- [ ] Modèle Épreuve → Manches → Traces et stockage partagé protégé par l'accès équipage — prérequis de l'archive et de la création
- [ ] Créer une régate (nom, date, club) + choisir un parcours connu ou définir des marques ; statut à venir / aujourd'hui / passée — « ouvrir une régate sans Romain »
- [ ] Import des IC par PDF avec relecture avant enregistrement — régate occasionnelle d'un autre club
- [ ] Instantané figé des prévisions et des relevés dès l'ouverture de la régate — irrécupérable plus tard
- [ ] Archive : liste par saison + fiche (vent du jour, route conseillée, traces, débrief, polaire, rapport) lisible sur tout appareil et hors-ligne pour les régates récentes
- [ ] Import GPX rattaché à une régate (proposition par date) et débrief en un geste
- [ ] Écran « Aujourd'hui » avec bouton principal selon l'étape
- [ ] Données de la rade sorties du code (schéma de plan d'eau), sans ajouter de plan d'eau
- [ ] Tests de non-régression des calculs clés (géométrie, vent, routage, polaire, GPX, débrief, accès)

### Add After Validation (v1.x, après la première régate utilisée en conditions réelles)

- [ ] Notes d'équipage rapides (cote 1-5, une amélioration, dictée) — dès que le débrief automatique est jugé fiable
- [ ] Comparaison prévu / réel par régate — dès que 2 à 3 régates ont un instantané
- [ ] Ligne de départ mémorisée dans la manche
- [ ] Export de l'archive (JSON + GPX) et dupliquer une régate
- [ ] Historique des modifications et annulation — dès qu'une perte de données est signalée ou crainte

### Future Consideration (v2+)

- [ ] Jours semblables et fiche d'avant-régate — nécessite au moins 5 à 8 régates archivées pour être utile
- [ ] Tableaux de bord de saison (départs, % de polaire, pertes en manœuvre) — idem
- [ ] Trace de secours entre les trois téléphones — complexe, à justifier par des trous constatés
- [ ] Rejeu animé avec route conseillée en fantôme
- [ ] Ajout effectif d'un second plan d'eau — décision de Romain : plus tard

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Fiabilité trace / départ / état visible | HIGH | HIGH | P1 |
| Modèle Épreuve → Manches → Traces + stockage partagé | HIGH | MEDIUM-HIGH | P1 |
| Créer une régate + parcours/marques propres | HIGH | MEDIUM | P1 |
| Import des IC avec relecture | HIGH | MEDIUM-HIGH | P1 |
| Instantané figé du vent | HIGH | MEDIUM | P1 |
| Archive : liste + fiche + hors-ligne | HIGH | MEDIUM | P1 |
| Import GPX rattaché + débrief en un geste | HIGH | LOW-MEDIUM | P1 |
| Écran « Aujourd'hui » | HIGH | MEDIUM | P1 |
| Données du plan d'eau hors du code | MEDIUM (aujourd'hui), HIGH (plus tard) | HIGH | P1 |
| Tests de non-régression | HIGH | MEDIUM | P1 |
| Notes d'équipage rapides | MEDIUM | LOW-MEDIUM | P2 |
| Comparaison prévu / réel | HIGH | MEDIUM | P2 |
| Ligne de départ mémorisée | MEDIUM | LOW-MEDIUM | P2 |
| Export / dupliquer / historique | MEDIUM | LOW | P2 |
| Jours semblables + fiche d'avant-régate | HIGH (à terme) | MEDIUM | P3 |
| Tableaux de bord de saison | MEDIUM | MEDIUM | P3 |
| Trace de secours multi-téléphones | MEDIUM | MEDIUM-HIGH | P3 |
| Rejeu animé avec fantôme | MEDIUM | MEDIUM-HIGH | P3 |

**Priority key:**
- P1 : indispensable pour ce jalon
- P2 : à ajouter dès que possible
- P3 : à envisager plus tard

## Competitor Feature Analysis

| Feature | Vakaros Atlas 2 / Connect | Velocitek ProStart / Control Center | SailRacerPro / SailSync AI / Pathfinder | RaceQs / TracTrac / eStela | Organisateurs (Manage2Sail, Sailwave, kSail, RRS.org) | Notre approche |
|---------|---|---|---|---|---|---|
| Départ : distance et temps à la ligne | Oui ; OCS automatique en RaceSense ; décalage d'étrave configurable | Oui, minuteur et ligne ; journal des 30 dernières heures | Partiel (SailSync : compte à rebours partagé) | Non | Non | Déjà livré ; ajouter ligne mémorisée par manche |
| Enregistrement de trace | Oui, matériel dédié ; téléchargement via Connect | Oui, matériel dédié | Oui (téléphone ; Pathfinder) ou import GPX/FIT | Oui (téléphone, temps réel ou différé) | Non | Téléphone, fiabilité renforcée par alertes et écriture par blocs |
| Rejeu / revue après course | Via visionneuse propre ou Vantage ; peu détaillé dans Connect | Rejeu d'une seule trace dans Control Center | Rejeu, pertes en virement, vent déduit, polaires, rapport IA partageable | Rejeu 3D / carte, comparaison de bateaux, classement | Non | Débrief automatique existant ; rejeu animé reporté |
| Archive des événements | Non (sessions) | Non (sessions) | Sessions ; courses partagées (Sail Tactician) | Liste d'événements passés (TracTrac) ; régates créées (RaceQs) | Archive des résultats officiels | **Carnet de saison d'équipage** : épreuve → manches → vent, traces, débrief |
| Préparation (vent, parcours, routage) | Non | Non | Non (Pathfinder : en partie) | Non | Documents NOR/IC seulement | Déjà livré : base de l'archive du « vent du jour » |
| Création d'événement | Non | Non | Course « Live » avec zone et parcours (SailRacerPro) | Création de régate par waypoints (RaceQs) | Complète (documents, inscriptions, résultats) | Légère : nom, date, IC importées, marques |
| Partage | Suivi en direct via visionneuse | Export | Rapport partageable, courses publiques ou privées | Traces souvent publiques, amis | Public | Privé équipage ; lien non devinable optionnel |
| Hors-ligne | Appareil autonome | Appareil autonome | Variable | Dépose différée possible | Non applicable | Impératif ; file d'écritures et indicateur de synchro |

## Niveau de confiance

| Zone | Confiance | Raison |
|---|---|---|
| Besoins et décisions du projet | HIGH | Lus dans `PROJECT.md` et `CONCERNS.md` |
| Fonctions des instruments de départ (Vakaros, Velocitek) | MEDIUM | Pages de revue et fiches de magasin ; pas la documentation constructeur actuelle |
| Fonctions des applis de replay (RaceQs, TracTrac, SailTrace, SailRacerPro, Pathfinder, SailSync) | MEDIUM-LOW | Fiches de magasin, forum du développeur ; non vérifié en usage ; RaceQs : sources de 2014 à 2021, état actuel non confirmé |
| Outils d'organisateur (Manage2Sail) | LOW | Aucune page produit trouvée ; connaissances générales. Sailwave, kSail, RRS.org : MEDIUM |
| Pratiques de débrief d'équipage | MEDIUM | Sailing World, Quantum Sails, Sail1Design |
| Classement table stakes / différenciateurs / anti-fonctions | MEDIUM | Jugement de recherche rapporté au contexte (équipage de 3, valeur centrale, échéance) ; à confirmer avec Romain |

Points à valider avec Romain avant le découpage en exigences :
- Faut-il garder l'original GPX en plus de la trace allégée (coût de stockage vs retraitement futur) ?
- Le lien public non devinable est-il souhaité pour le rapport, ou tout doit-il rester derrière l'accès équipage ?
- Les téléphones des trois équipiers enregistrent-ils déjà tous la même course (intérêt de la trace de secours) ?

Contraintes techniques non traitées ici (voir recherche STACK / pitfalls) : choix du stockage partagé compatible Vercel, comportement de la PWA iOS en arrière-plan, taille des traces.

## Sources

- [Vakaros Atlas 2 — Practical Sailor](https://www.practical-sailor.com/marine-electronics/vakaros-atlas-2-sailing-instrument-profile/) — distance/temps à la ligne, décalage d'étrave (MEDIUM)
- [Atlas 2 User Manual](https://images.bucher-walt.ch/pdf_tech/fr/Atlas_2_User_Manual_6.pdf), [VX CRW RaceSense Intro](https://yachtscoring.com/event_documents/16304/VX_CRW_RaceSense_Intro.pdf) — RaceSense, OCS automatique (MEDIUM, document de 2022)
- [Getting the most out of your Vakaros Atlas — British Dragons](https://www.britishdragons.org/getting-the-most-out-of-your-vakaros-atlas/) (MEDIUM)
- [Velocitek ProStart — Landfall](https://www.landfallnavigation.com/velocitek-prostart.html), [Velocitek Control Center](https://www.waerfa.com/velocitek-control-center?jump=1) — journal de 30 h, rejeu d'une trace (MEDIUM-LOW)
- [SailRacerPro — forum Seabreeze](https://www.seabreeze.com.au/forums/Windsurfing/General/Sailracerpro-web-applicaiton-Finally--Maybe) — mode Debrief, mode Live, partage privé/public (LOW-MEDIUM, descriptions du développeur)
- [SailSync AI](https://apps.apple.com/app/id6745572113), [SailTrace](https://apps.apple.com/us/app/sailtrace/id6743357767), [Sail Tactician](https://mwm.ai/apps/sail-tactician/6741540409), [Pathfinder Sailing](https://apps.apple.com/app/id6474322420) — fiches de magasin (LOW-MEDIUM)
- [RaceQs — Cesium](https://cesium.com/blog/2015/08/19/raceqs), [RaceQs — forum SFBay](https://forum.sfbaysss.org/threads/race-against-yourself-use-raceqs.1711) (LOW-MEDIUM, ancien)
- [TracTrac](https://mwm.ai/apps/tractrac/1500017723), [eStela](https://apps.apple.com/app/id722427893) — liste d'événements passés, rejeu, tableau par bord (MEDIUM-LOW)
- [Expedition](https://expeditionmarine.com/), [Expedition Advanced Module](https://northu.com/expedition-advanced-module/) — journalisation, rejeu, polaires (MEDIUM)
- [SailFreeGPS](https://apps.apple.com/app/id1552752200), [tack X](https://apps.apple.com/app/id1041587444), [Regatta Starter](https://apps.apple.com/app/regatta-starter/id6753988674) — fonctions de départ simples (LOW-MEDIUM)
- [kSail Events Portal](https://help.ksail.co.uk/portal/en/kb/articles/ksail-events-portal-features-and-packages), [RRS.org best practices](https://rrs.sh/pages/help/best_practices), [Sailwave import](https://rrs.sh/help/sailwave_import) — outils d'organisateur (MEDIUM)
- [World Sailing Appendix J / Appendix L](https://www.racingrulesofsailing.org/rules?part_id=62) — contenu type des avis de course et des IC (HIGH)
- [Post-Race Debrief — Sailing World](https://www.sailingworld.com/how-to/post-race-debrief/), [Quantum Sails — communiquer](https://www.quantumsails.com/en/resources-and-expertise/videos/system-sailing-2-4-communicate), [Sail1Design — objectifs de régate](https://sail1design.com/regatta-goals/) — pratiques de débrief (MEDIUM)
- `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md` — contexte et contraintes du projet (HIGH)

---
*Feature research for: carnet de régate d'un équipage privé (J80 Naos)*
*Researched: 2026-10-19*
