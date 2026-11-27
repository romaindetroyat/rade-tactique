---
phase: 08-espace-tofinou
plan: 02
subsystem: serveur
status: complete
tags: [espaces, cloisonnement, middleware, archive, ia, quota, codes, packs, securite]
requires:
  - "08-01 : gel de Naos v43 (tests/naos.test.mjs, differencesAdmises)"
provides:
  - "api/_espace.js : ESPACE_IDS, env, espaceDe, prefixe, POLITIQUE, IA_ESPACES"
  - "middleware.js : TOFINOU (Frédéric, Romain), ESPACES (hôtes, packs), creerMiddleware, x-rt-espace, /api/membre { membre, espace, espaces }, packs par espace"
  - "api/archive.js : 403 espace_inconnu, prefixe(espace), cleanDoc(doc, now, espace) (plan_d_eau_refuse, regate_reservee, recalages vidés)"
  - "api/_ia.js : 403 espace_inconnu, 503 ia_espace hors IA_ESPACES, quota sous prefixe(espace), option espacesIA (tests)"
  - "tools/codes-acces.mjs : création (empreinte seule), --copier, --retirer, --empreinte-de"
  - "tests/espaces.test.mjs (T1, T2, T3, T5, T10, parité, tables réelles), tests/codes.test.mjs"
affects: [08-03, 08-04, 08-06, 08-08, 08-10, 08-11]
tech-stack:
  added: []
  patterns: ["fabrique creerMiddleware({ espaces }) testée avec des tables de faux codes", "espace en liste blanche, refus par défaut (jamais Naos par défaut)", "outil de codes testé sur une copie d’un faux middleware (empreintes réelles remplacées en mémoire)"]
key-files:
  created:
    - api/_espace.js
    - tools/codes-acces.mjs
    - tests/espaces.test.mjs
    - tests/codes.test.mjs
  modified:
    - middleware.js
    - api/archive.js
    - api/_ia.js
    - tests/access.test.mjs
    - tests/apiarchive.test.mjs
    - tests/apiia.test.mjs
    - tests/apiic.test.mjs
    - tests/archheavy.test.mjs
    - tests/archsync.test.mjs
    - tests/modifmanche.test.mjs
    - tools/compat-v41.mjs
    - tools/compat-v42.mjs
    - tools/regate-e2e.mjs
decisions:
  - "Espace d’une requête : hôte connu → son espace s’il est ouvert au code, sinon la réponse exacte d’un code inconnu (lien et cookie) ; hôte inconnu (aperçu) → premier espace du code dans l’ordre de ESPACES (naos d’abord) ; seuls le code et l’hôte décident"
  - "Archive et IA : le contrôle du prénom reste le premier (membre_inconnu), l’espace vient ensuite (espace_inconnu) : les appels sans aucun en-tête du gel restent en 403 membre_inconnu, aucune différence admise ajoutée"
  - "IA : option createIA({ espacesIA = IA_ESPACES }) pour tester le quota par espace + prénom (T8) alors que Tofinou n’a pas d’IA dans ce plan ; les fonctions ne la passent pas, la règle permanente reste IA_ESPACES"
  - "Outil des codes : le code n’apparaît qu’une fois dans la sortie, à la fin du lien personnel (« le code est la fin du lien, après acces= ») ; un prénom avec apostrophe droite est refusé (elle fermerait la chaîne de la table), l’apostrophe ’ est admise"
  - "Archive hors de Naos : seul le registre des recalages partagés (`doc.marks`) est vidé ; les bouées d’une régate (`regatta.marks`, IC) restent, nécessaires à D-16"
metrics:
  duration: 17min
  completed: 2026-11-26
estimate:
  tokens: 130000
  tasks: 3
actuals:
  tokens: 22500
  tasks: 3
  commits: 3
plan_head_before: fe34527fce14a37a35d1019b5157ce0de57985cf
plan_head_after: c5f02b2fb329930085949869f0459c2486d4c2c9
---

# Phase 8 Plan 02 : serveur cloisonné par espace Summary

Le code décide de l’espace : le middleware le pose dans `x-rt-espace` (en écrasant la valeur de la page), l’archive et le compteur d’IA rangent tout sous `prefixe(espace)` (Naos `prod/…` et `preview/…` à l’octet près, Tofinou `tofinou/prod/…` et `tofinou/preview/…`) et refusent en 403 toute requête sans espace valide ; l’archive Tofinou refuse les régates d’un autre plan d’eau et les graines de Naos ; l’IA est fermée (503 `ia_espace`) hors de Naos ; les packs d’un autre espace sont un 404 sans écho ; un outil crée les codes sans jamais les écrire. La table TOFINOU porte Frédéric et Romain. Gel de Naos vert.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 29cb1fb | `api/_espace.js` ; `middleware.js` (TOFINOU vide, ESPACES, `creerMiddleware`, `x-rt-espace`, /api/membre, packs) ; `api/archive.js` (403 `espace_inconnu`, `prefixe`) ; `'x-rt-espace': 'naos'` dans 9 fichiers d’appel ; `tests/espaces.test.mjs` |
| 2 (tdd) | deede29 | politique de l’archive par espace, IA par espace (403, 503 `ia_espace`, quota par espace) ; T7, T8 (7 tests rouges d’abord, puis verts) |
| 3 (tdd) | c5f02b2 | `tools/codes-acces.mjs`, `tests/codes.test.mjs`, T10, deux lignes posées dans TOFINOU, test des accès Tofinou sans affichage |

Tracer (tâche 1) : `<verify>` complet rejoué avant l’extension (tests, `npm run check`, gardes, compat-v42, scénarios `archive`, `deux-telephones`, `naos-cles`) : tout vert, expansion poursuivie.

## Appels complétés par `'x-rt-espace': 'naos'`

tests/apiarchive.test.mjs (5 sites ; le test bout à bout passe l’en-tête transmis par le vrai middleware), tests/apiia.test.mjs (`entete()` et la parité avec l’archive), tests/apiic.test.mjs, tests/archheavy.test.mjs, tests/archsync.test.mjs (2), tests/modifmanche.test.mjs, tools/compat-v41.mjs, tools/compat-v42.mjs (2), tools/regate-e2e.mjs (5 : route de l’IA, arbitre hors réseau, téléphones de l’archive, arbitre de Brest, contrôle du plan d’eau). Les tests qui vérifient `membre_inconnu` (sans prénom) restent sans espace : le prénom est contrôlé d’abord. tests/access.test.mjs : corps de /api/membre `{ membre, espace, espaces }` (espaces calculés depuis ESPACES), `x-rt-espace` dans la liste des en-têtes remplacés et transmis `naos`.

## Sorties brutes des tests de cloisonnement

```
ok 7 - T1 : code Tofinou → x-rt-espace « tofinou » et prénom de la table, même si la page envoie x-rt-espace: naos et x-rt-membre: Usurpateur
ok 8 - T2 : code d’un espace sur l’hôte d’un autre espace → exactement la réponse d’un code inconnu, aucun cookie posé
ok 9 - membre de deux espaces : espace de l’hôte connu, premier espace sur un hôte inconnu, /api/membre donne les deux
ok 10 - le reste du site ne reçoit aucun en-tête posé, quel que soit l’espace
ok 11 - T3 : archive sans x-rt-espace valide (absent, inconnu, __proto__, autre casse, liste) → 403 espace_inconnu, rien lu ni écrit
ok 12 - T5 : un magasin rempli par Naos est invisible pour Tofinou (léger vide, trace, rapport, jour → 404), aucun chemin hors de tofinou/ touché
ok 13 - bout à bout : l’en-tête x-rt-espace du vrai déroulé du middleware range l’écriture de Tofinou sous tofinou/ et celle de Naos sous preview/
ok 14 - parité : ESPACE_IDS = espaces du middleware ; préfixes de Naos inchangés ; politique et IA par espace
ok 15 - tables réelles : EQUIPAGE en premier, prénoms uniques par table, une empreinte commune porte le même prénom (aucune empreinte affichée)
ok 16 - T10 : pack d’un autre espace → même 404 sans écho qu’un fichier interne ; toute la liste hors réseau (Toulon compris) reste servie à chaque espace
ok 17 - accès de l’espace Tofinou : exactement Frédéric et Romain ; Romain avec la même empreinte que dans Naos ; Frédéric dans aucune autre table (rien affiché)
ok 1 - T7 : archive Tofinou — régate sans plan d’eau (Toulon), d’un autre plan d’eau ou de Brest → 400 plan_d_eau_refuse, rien d’écrit
ok 2 - T7 : archive Tofinou — graines de Naos (snpm-2026, gpen-2027) → 400 regate_reservee, même au plan d’eau de Bormes ; rien d’écrit
ok 3 - T7 : archive Tofinou — régate de Bormes acceptée, rangée sous tofinou/, recalages de bouées vidés, bouées de la régate gardées
ok 4 - T7 : archive Naos — politique de la v43 : « bormes » retiré comme un plan d’eau inconnu, recalages gardés, graines acceptées
ok 5 - IA : sans x-rt-espace valide (absent, inconnu, __proto__, autre casse) → 403 espace_inconnu, sans compteur ni appel, pour les quatre fonctions
ok 6 - IA : espace sans IA ouverte (Tofinou) → 503 ia_espace avec message, sans appel au fournisseur ni écriture de compteur — jamais les consignes de Naos
ok 7 - T8 : quota par espace + prénom — « Romain » de Tofinou et Romain de Naos ont deux compteurs ; le 31e appel Tofinou est refusé sans toucher Naos
ok 8 - IA de Naos : consignes = section ia du gel de la v43 (tests/fixtures/naos-v43.json)
```
Outil des codes (tests/codes.test.mjs) : 6/6 (forme du faux middleware, création, refus, `--copier`, `--retirer`, `--empreinte-de`).

Vérifications finales :
```
npm run check : 886 tests, 885 verts, 1 sauté (instantané météo de Brest absent, comme en v43), 0 échec
node tools/gardes-toulon.mjs : OK SNPM · OK données de Toulon · OK modules du mode départ · OK tests figés · OK gel de Naos v43 · OK pack de Brest
compat-v42 : 8 contrôles OK ; compat-v41 : 7 contrôles OK
PW_REQUIRED=1 regate-e2e archive deux-telephones naos-cles ia ia-erreurs arbitre : 6/6 OK
git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : vrai ; garde SNPM (f80c365) : vraie
js/, data/, sw.js, js/version.js : inchangés par ce plan (aucun stamp nécessaire)
```

## Accès de l’espace Tofinou

Table TOFINOU du vrai middleware.js : **2 lignes** (Frédéric, Romain), vérifiées sans affichage (commande de vérification de la tâche 3 en 0, test 17 ci-dessus). L’empreinte de Frédéric a été posée par `--empreinte-de` depuis le fichier fourni hors du dépôt (« ligne ajoutée ») ; contrôle par script sans affichage : identique à l’empreinte fournie, absente de la table de Naos, une seule occurrence dans le fichier, aucune occurrence ailleurs dans le dépôt (`git grep -f`). La ligne de Romain a été recopiée par `--copier Romain --de naos --espace tofinou` (« ligne copiée »). Relecture du diff masqué : deux lignes ajoutées à TOFINOU, EQUIPAGE intacte (aucune ligne d’empreinte modifiée par la tâche 1, comparaison du bloc vraie). Teiva et Thibaud restent Naos seulement. Aucun code n’a été créé ni lu par l’exécutant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocage] T8 impossible par les fonctions tant que Tofinou n’a pas d’IA**
- **Trouvé pendant :** tâche 2
- **Problème :** `IA_ESPACES = ['naos']` renvoie 503 à Tofinou avant tout compteur : « le 31e appel Tofinou refusé (429) » ne peut pas passer par une fonction d’IA dans ce plan.
- **Correction :** `createIA({ espacesIA = IA_ESPACES })` ; T8 ouvre les deux espaces sur une instance de test de `garde`. Les quatre fonctions ne passent pas l’option.
- **Fichiers :** api/_ia.js, tests/apiia.test.mjs · **Commit :** deede29

**2. [Rule 1 - Bug de test] tests/codes.test.mjs dépendait de l’état réel de TOFINOU**
- **Trouvé pendant :** tâche 3, après la pose des deux lignes (5 tests rouges)
- **Correction :** le faux middleware vide la table TOFINOU (état de départ fixe) ; empreintes réelles toujours remplacées en mémoire.
- **Commit :** c5f02b2

**3. Ordre et interprétations**
- Le filtre des packs est entré dans le middleware à la tâche 1 (étape 2 de son action) ; T10 (tâche 3) est donc vert dès son écriture, sans phase rouge. L’outil des codes a été écrit avant ses tests (les deux dans la même tâche, tests verts au premier passage).
- « Affiche le code et le lien » : le code n’apparaît qu’une fois, à la fin du lien personnel, pour que le test « une seule occurrence dans la sortie » soit tenu.
- Prénom avec apostrophe droite refusé par l’outil (l’apostrophe ’ est admise), alors que `NAME` d’api/archive.js l’accepte.
- `/data/BREST.meta.json` (casse différente) reçoit aussi le 404 du middleware pour Tofinou (comparaison en minuscules).
- Hôtes comparés sans le port (`url.hostname`).

### Exigences

ESPACE-01, ESPACE-02, ESPACE-04 (packs, graines refusées par le serveur), ESPACE-07 : posées côté serveur par ce plan ; les parts de l’app (js/espaces.js, garde « autre espace », graines locales, 08-04 et suivants) restent à faire.

## Threat Flags

Aucune surface hors du `<threat_model>` : l’outil des codes est un script local (non servi : `tools/` est hors de la liste blanche du middleware).

## Points pour 08-03 et la suite

- `js/espaces.js` (08-04) doit reprendre exactement les hôtes de `ESPACES` : Naos `rade-tactique.vercel.app`, `127.0.0.1`, `localhost` ; Tofinou `tofinou-bormes.vercel.app`, `tofinou.localhost` ; le test de parité de tests/espaces.test.mjs devra comparer aussi js/espaces.js.
- Quand `bormes` entrera dans data/venues.json (08-04/08-05), tests/access.test.mjs « tout ce que l’app sert est transmis » (code simulé = Romain, espace Naos sur l’hôte d’essai) recevra 404 pour `data/bormes.*` : y retirer les packs des autres espaces, comme T10 le fait déjà. Ajouter `bormes` à `VENUE_IDS` de js/archmerge.js ne change pas l’archive de Naos (elle lit `POLITIQUE.naos.venues`).
- L’IA de Tofinou s’ouvre en ajoutant `tofinou` à `IA_ESPACES` (08-08) avec ses consignes propres ; tant qu’elle est fermée, l’app Tofinou recevra 503 `ia_espace` (message « L’IA n’est pas ouverte dans cet espace. » à afficher).
- Le premier espace d’un code double est `naos` sur un hôte inconnu (aperçu) : un aperçu ouvert par Romain est donc Naos ; pour essayer Tofinou sur un aperçu, utiliser `tofinou.localhost` en local ou l’adresse Tofinou.
- Matcher inchangé : le manifeste Tofinou (08-06) demandera de le modifier, avec mise à jour de `publics` dans `differencesAdmises` si l’hôte de Naos est touché.
- Recréer un code : `node tools/codes-acces.mjs --retirer <Prénom> --espace <espace>` puis `--espace <espace> --prenom <Prénom>` (le lien s’affiche une fois).

## Self-Check: PASSED

- FOUND : api/_espace.js, tools/codes-acces.mjs, tests/espaces.test.mjs, tests/codes.test.mjs, middleware.js, api/archive.js, api/_ia.js
- FOUND : 29cb1fb, deede29, c5f02b2 (ancêtres de HEAD)
