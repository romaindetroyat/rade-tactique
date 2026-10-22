# Accueil hors régate — décisions de Romain (2026-10-22)

Demande : « Archive la régate de la semaine dernière, je veux que l'app s'ouvre sur une page de non régate, sauf à aller charger une régate qui peut être en préparation, en cours ou terminée. »

## Décisions (verrouillées)
- **D-A1 Ouverture = entraînement libre.** À l'ouverture, aucune régate n'est ouverte : l'app entière fonctionne en mode entraînement (vent du jour et 3D, prévisions, parcours libre choisi dans le catalogue de la rade, chrono, mode départ, GPS, trace, débrief, règles, J80). Ce qui n'a de sens que dans une régate (IC de l'épreuve, manches, fiche, vent figé, rattachement des traces) dit clairement « Aucune régate ouverte » avec un bouton vers la liste.
- **D-A2 Liste des régates dans un onglet,** classée **En préparation** (à venir), **En cours** (aujourd'hui), **Terminées** (passées), avec « Ouvrir » sur chaque régate et « Nouvelle régate ». Une régate ouverte s'affiche clairement (nom en tête) avec un geste « Fermer la régate » qui revient à l'entraînement libre.
- **D-A3 Jour J :** si une régate a lieu aujourd'hui, l'app l'ouvre directement au lancement (aucun geste avant le chrono en mer). Les autres jours, ouverture en entraînement libre.
- **D-A4 Pas de mémoire :** chaque lancement repart en entraînement libre (sauf D-A3). La régate ouverte est un état local du téléphone, jamais partagé par l'archive (un équipier qui ouvre une régate ne change rien chez les autres).
- **D-A5 « Archiver » la Coupe SNPM du 18/10 :** elle n'est plus ouverte d'office ; elle reste dans l'archive partagée, rangée dans « Terminées », lisible et rouvrable avec ses traces et débriefs. Aucune donnée supprimée.

## Contraintes à respecter
- Sécurité en course inchangée : le verrou « journée de régate » (lockDates / todayRegatta) et « rien ne s'échange pendant une course » (D-03 phase 4) ne dépendent pas de la régate ouverte à l'écran.
- La référence Coupe SNPM (`js/courses.js`, `tests/reference/`) ne bouge pas : garde `git diff --quiet f80c365 -- js/courses.js tests/reference/`.
- Ouverture < 2 s hors réseau conservée (measure-boot).
- Synchronisation : l'état « régate ouverte » ne doit plus voyager dans le document partagé, sans casser la fusion ni les téléphones encore en v36 (compatibilité).
- Guide (`guide.html`) et aide (`js/help.js`) mis à jour ; libellés vérifiés par `tests/guide.test.mjs`.
- Production seulement sur « publie » de Romain, avant le gel du 2 novembre.
