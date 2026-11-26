---
phase: 08-espace-tofinou
plan: 06
subsystem: app
status: complete
tags: [espaces, identite, manifeste, middleware, aide, debrief, acces, tofinou]
requires:
  - "08-02 : middleware par espace (ESPACES, creerMiddleware, NOMS_PUBLICS, /api/membre { membre, espace, espaces })"
  - "08-04 : js/espaces.js (ESPACE, ESPACES, HOTES, espaceDeLHote), hôte d’essai tofinou.localhost, membreEspace"
  - "08-05 : ESPACE.bateau.classe (CLASSE), onglet du bateau"
provides:
  - "manifest-tofinou.webmanifest (« Tofinou — Bormes », « Tofinou Bormes »)"
  - "middleware.js : manifestePour(hote, espaces), enveloppe de creerMiddleware (manifeste traité en premier, GET/HEAD, sans code), matcher sans le manifeste"
  - "tools/serveur-local.mjs : émulation de la réécriture du manifeste (même règle manifestePour)"
  - "js/help.js : GUIDE_TOFINOU, guideDe, tipsDe, setEspacesMembre, autreEspace, lienChangerEspace ; partage et journal au nom de l’espace"
  - "js/debrief.js : classe et nom de l’app de l’espace dans le rapport"
  - "acces.js : page d’accès au nom de l’espace sur les hôtes de Tofinou"
  - "tests/identite.test.mjs, tests/helpers/debriefv43.mjs + tests/fixtures/debrief-v43.json, scénario tofinou-identite"
affects: [08-07, 08-08, 08-09, 08-10]
tech-stack:
  added: []
  patterns:
    - "enveloppe du déroulé du middleware (creerMiddleware → deroule) : le manifeste est traité avant le lien ?acces= et le cookie, sans toucher au déroulé de 08-02"
    - "une seule règle hôte → manifeste (manifestePour) pour la production et le serveur local"
    - "rapport de la v43 capturé en empreinte SHA-256 du HTML (processus neuf, aucun git pendant npm test)"
key-files:
  created:
    - manifest-tofinou.webmanifest
    - tests/identite.test.mjs
    - tests/helpers/debriefv43.mjs
    - tests/fixtures/debrief-v43.json
  modified:
    - middleware.js
    - tools/stamp.mjs
    - tools/serveur-local.mjs
    - tests/access.test.mjs
    - tests/espaces.test.mjs
    - tests/helpers/naos.mjs
    - acces.js
    - js/app.js
    - js/help.js
    - js/debrief.js
    - tests/debrief.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "Manifeste de Tofinou NON exclu du matcher (écart au plan) : servi sans code seulement sur un hôte de Tofinou (couvre une réécriture réévaluée), code exigé ailleurs comme toute adresse de l’app ; l’ensemble des fichiers publics de l’hôte de Naos reste celui de la v43 sans nouvelle différence admise dans le gel"
  - "Matcher : trois noms exacts (acces.html, acces.js, sw.js) et deux dossiers (icons/, rapports/) ; /manifest.webmanifest passe par le middleware et n’est jamais refusé (GET/HEAD) ; autres méthodes : déroulé ordinaire"
  - "« Changer d’espace » : espaces du membre gardés en mémoire seulement (aucune clé locale), lien vers le premier hôte de l’autre espace du registre public, target _blank + rel noopener, caché sur un hôte inconnu"
  - "Aide de Tofinou sans lien vers guide.html (guide de Naos) ni rubrique IA (IA fermée hors de Naos jusqu’à 08-09) ; guide de l’espace en 08-10"
  - "Titre, nom d’installation iPhone (apple-mobile-web-app-title), description, en-tête et écran de chargement posés par js/app.js hors de Naos ; index.html inchangé"
metrics:
  duration: 25min
  completed: 2026-11-26
estimate:
  tokens: 110000
  tasks: 2
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 76d19971a0de970a4acb683711768166f2a0a1c8
plan_head_after: c8cbedcb325c719579d0a3420ce753b24bb15c9d
---

# Phase 8 Plan 06 : identité de chaque espace Summary

Sur l’adresse de Tofinou, l’app s’appelle « Tofinou Bormes » partout où l’équipier le lit : manifeste réécrit par le middleware (`/manifest.webmanifest` → `manifest-tofinou.webmanifest`, public, avant toute authentification), titre et nom proposé à l’installation, page d’accès, aide et accueil sans aucun texte de Naos, débrief « Débrief · Tofinou 9.5 · Tofinou Bormes » ; Romain, membre des deux espaces, trouve « Changer d’espace » dans l’aide. Pour l’équipage de Naos, rien ne change : manifeste, page d’accès, index.html, aide (empreintes de la v43) et rapport de débrief (HTML identique à l’octet à la v43 sur la trace de la Coupe SNPM) ; Teiva et Thibaud ne voient aucun bouton nouveau.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 737d09f | `manifest-tofinou.webmanifest`, `manifestePour` et enveloppe du middleware, matcher, `NOMS_PUBLICS`, `ROOT_FILES`, `AJOUTS_SHELL`, émulation locale, tests d’accès et de l’espace, `npm run stamp` |
| 2 (tdd) | c8cbedc | acces.js, titres et noms hors de Naos, `GUIDE_TOFINOU` et bulles de l’espace, « Changer d’espace », partage et journal, débrief par espace, fixture du rapport de la v43, tests/identite.test.mjs, scénario tofinou-identite |

Tracer (tâche 1) : `<verify>` complet rejoué avant la tâche 2 (tests, recapture du gel sur l’extraction de 5e9b8a5 identique à la fixture par `cmp`, `stamp --check`, `npm run check`, gardes, scénarios naos-cles, tofinou-demarrage, toulon-vue, accueil) : vert, expansion poursuivie. Tâche 2 : test du rapport de Tofinou écrit d’abord, rouge (« J80 » et « Rade Tactique » dans le rapport), puis vert.

## Middleware (modifié sans être affiché)

Le fichier contient les empreintes des codes : il n’a été ni affiché ni lu en clair. La structure a été relevée par les exports à l’exécution (`config`, `ESPACES` sans tables, `cheminDeLApp`), par des numéros de ligne (`awk`, sans contenu) et par les tests ; la modification est faite par un script Node qui exige chaque ancre exactement une fois, compare la suite des empreintes avant / après (identique, sans affichage) et n’écrit rien sinon. Contrôles : `git diff -U0` sans ligne d’empreinte ajoutée ou retirée (0), `node --check`, tests.

Changements : import de `rewrite` ; `manifest\\.webmanifest$` retiré des exclusions du matcher ; commentaire du matcher réécrit ; `'/manifest-tofinou.webmanifest'` ajouté à `NOMS_PUBLICS` (liste blanche) ; le déroulé de 08-02 renommé `deroule` et enveloppé par le nouvel `creerMiddleware` (même signature) ; `manifestePour(hote, espaces = ESPACES)` exporté.

Comportement vérifié (tests/access.test.mjs, tests/espaces.test.mjs) :

| Requête | Hôte de Naos, aperçu, inconnu | Hôte de Tofinou |
|---------|-------------------------------|-----------------|
| GET/HEAD `/manifest.webmanifest`, avec ou sans code, code inconnu, navigation | `next` (fichier de Naos tel quel), ni cookie, ni redirection | `x-middleware-rewrite` → `/manifest-tofinou.webmanifest` (même hôte) |
| GET `/manifest-tofinou.webmanifest` | sans code : 401 (comme un fichier inconnu de la v43) ; avec le code : transmis (liste hors réseau) | `next` sans code |
| noms voisins (`/Manifest.webmanifest`, `.old`, `x`, `/js/manifest.webmanifest`…) ; POST/PUT/DELETE | refusés sans code (déroulé ordinaire) | refusés sans code |

`vercel.json` inchangé (aucune réécriture : tests/access.test.mjs l. 146 vrai).

**À contrôler sur la production (08-09)** : comportement réel de `rewrite()` de Vercel vers un fichier statique sur l’adresse `tofinou-bormes.vercel.app` (non essayé ; le manifeste de Tofinou reste servi même si la plateforme réévaluait le middleware sur l’adresse réécrite), type de contenu reçu, et nom proposé à l’installation sur iPhone et Android.

## Service worker et installation

- `manifest-tofinou.webmanifest` entre dans `ROOT_FILES` (liste hors réseau et hachage de version) et dans `AJOUTS_SHELL` (seul ajout admis dans la liste de Naos, 400 octets). Sur l’hôte de Naos, le worker le met en cache avec le cookie (transmis par la liste blanche), comme tout fichier de l’app.
- Sur l’adresse de Tofinou, le worker met en cache `/manifest.webmanifest` tel que servi par la réécriture : c’est celui de Tofinou (vérifié dans le scénario par `caches.match`). Une modification du manifeste de Tofinou change le hachage, donc la version.
- iPhone : le nom de l’icône vient de `apple-mobile-web-app-title`, posé à « Tofinou Bormes » par js/app.js au démarrage hors de Naos ; Naos garde la balise d’index.html.
- Mise à jour : aucun changement du mécanisme (bandeau « Mettre à jour », jamais en course) ; `sw.js` et `js/version.js` seulement par `npm run stamp`.

## Textes rendus propres à l’espace

| Endroit | Naos (identique à la v43) | Tofinou |
|---------|---------------------------|---------|
| Page d’accès (acces.js) | acces.html tel quel | titre « Tofinou — Bormes · Accès », h1 « Tofinou — Bormes », « Application réservée à l’équipage du Tofinou — Bormes. », exemple « votre code personnel » |
| `<title>`, `apple-mobile-web-app-title`, description, en-tête, écran de chargement | balises d’index.html | « Tofinou Bormes » ; description du manifeste de Tofinou |
| Aide et accueil (openGuide, maybeWelcome) | `GUIDE` inchangé (empreinte de la v43) | `GUIDE_TOFINOU` : « Préparer et courir le Challenge de la Baie en Tofinou 9.5 dans la rade de Bormes – Le Lavandou », installation « Tofinou Bormes », plan d’eau de Bormes, onglet du bateau ; sans J80, CVAT, GPEN, Naos, Toulon, Brest |
| Bulles fixes | `STATIC_TIPS` inchangées | Briefing, Parcours, onglet du bateau, Régates réécrites ; les autres identiques |
| Partage, journal | « Rade Tactique », « en J80 » | `ESPACE.app`, `ESPACE.bateau.classe` |
| Rapport de débrief | HTML identique à la v43 | « Débrief · Tofinou 9.5 · Tofinou Bormes », « Vitesse face à la polaire Tofinou 9.5 », « polaire ORC du Tofinou 9.5 », « Rapport généré par Tofinou Bormes » |
| Traces (bulle de % de la polaire) | « polaire J80 » | « polaire Tofinou 9.5 » (`CLASSE`) |
| « Changer d’espace » | Teiva, Thibaud : rien ; Romain : lien vers `https://tofinou-bormes.vercel.app/` | Frédéric : rien ; Romain : lien vers `https://rade-tactique.vercel.app/` |

Textes de Naos comparés : `GUIDE`, `STATIC_TIPS`, `SYNC_TIP`, `DL_TIP` (empreintes relevées sur l’extraction de 5e9b8a5, égales au code courant), fenêtre d’aide d’un membre d’un seul espace = fenêtre sans le seul paragraphe `#changerEspace` de Romain, page d’accès (innerHTML de `main` identique sur les hôtes de Naos et un aperçu), rapport de débrief (deux états, SHA-256 du HTML) ; `git diff --quiet 5e9b8a5 -- manifest.webmanifest acces.html index.html` vrai.

## Sorties brutes

Tests nouveaux (extraits) :
```
ok - seuls acces.html, acces.js, sw.js, icons/ et rapports/ échappent au middleware ; les manifestes passent par lui
ok - manifeste : intercepté mais jamais refusé, sur tout hôte, avec ou sans code, GET et HEAD ; noms voisins et autres méthodes privés
ok - manifeste par hôte : Naos (avec, sans code, code inconnu) → transmis tel quel ; Tofinou → réécrit vers son manifeste ; hôte inconnu → Naos ; rien d’autre réécrit
ok - manifestePour : hôtes de Tofinou seulement (casse ignorée), sinon null ; le manifeste de Tofinou existe et nomme l’espace
ok - rapport de Naos identique à la v43 : HTML de buildReport octet pour octet sur la trace de référence de la Coupe SNPM (tests/fixtures/debrief-v43.json, capturé sur 5e9b8a5)
ok - rapport de l’espace Tofinou : « Débrief · Tofinou 9.5 · Tofinou Bormes », polaire du Tofinou 9.5, nom de l’app, aucun « J80 » ni « Rade Tactique »
ok - aide de Naos identique à la v43 : guide, bulles fixes, bulles de synchronisation et de téléchargement ; guideDe et tipsDe rendent ceux de Naos
ok - aide et accueil de Tofinou : « Préparer et courir le Challenge de la Baie en Tofinou 9.5 dans la rade de Bormes – Le Lavandou », sans J80, CVAT, GPEN, Naos, Toulon ni Brest
ok - aide de Tofinou : chaque libellé entre guillemets existe dans l’app (ou est un menu système, un nom d’espace)
ok - autreEspace : membre des deux espaces sur un hôte connu → adresse principale de l’autre espace ; un seul espace, hôte inconnu ou valeurs hostiles → rien
ok - lien « Changer d’espace » : construit par le DOM (aucun HTML), rel="noopener", mention du code demandé la première fois
ok - openGuide de Naos : même fenêtre pour un membre d’un seul espace qu’avant ; Romain y trouve en plus le seul paragraphe « Changer d’espace »
ok - page d’accès : hôtes de Tofinou recopiés de js/espaces.js (parité) ; Naos et aperçu : textes de acces.html inchangés ; Tofinou : nom de l’espace, exemple de code neutre
```

Fixture du rapport (`node tests/helpers/debriefv43.mjs --capture <extraction de 5e9b8a5> …`, deux captures identiques par `cmp`, 2 038 octets : empreinte, taille et textes lisibles de deux états, relevés de la référence et prévision seule ; rapports de 235 122 et 233 925 octets).

Vérifications finales :
```
recapture du gel de Naos sur l’extraction de 5e9b8a5 : cmp avec tests/fixtures/naos-v43.json vrai
node tools/stamp.mjs --check : stamp à jour (avertissement non strict « contenu modifié depuis la v43 » : la release est pour 08-10)
npm run check : 945 tests, 943 verts, 2 sautés (instantanés météo de Brest et de Bormes absents), 0 échec
node tools/gardes-toulon.mjs : code 0 (OK SNPM · données de Toulon · modules du mode départ · tests figés · gel de Naos v43 · pack de Brest)
git diff --quiet f80c365 -- js/courses.js tests/reference/ : vrai ; data/brest.* = 5e9b8a5 : vrai ; js/startmode.js js/racelock.js js/beeper.js js/wakelock.js = 5e9b8a5 : vrai
git diff --quiet 5e9b8a5 -- manifest.webmanifest acces.html index.html : vrai ; vercel.json inchangé
PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-identite tofinou-demarrage tofinou-bateau naos-cles toulon-vue guide accueil :
OK tofinou-identite · OK tofinou-demarrage · OK tofinou-bateau · OK naos-cles · OK toulon-vue · OK guide · OK accueil
Bilan : 7/7 scénario(s) OK
```

Tous les scénarios de l’outil (`PW_REQUIRED=1 node tools/regate-e2e.mjs`, sans nom) :
```
accueil, jour-j, deux-telephones, reprise, equipage, archive, archive-bouees, archivehors, creer, manche, auteur, ic, depuis-ic, vraisemblance,
gel, debrief-tardif, gpx, gpx-choix, ia, ia-erreurs, arbitre, bouees, guide, entetes, retour-port, banane, banane-manche, banane-debrief,
porte-ic, modifier-manche, toulon-vue, brest-avion, regate-brest, brest-courant, gpen, naos-cles, tofinou-demarrage, espace-garde,
tofinou-bateau, tofinou-identite : OK
ÉCHEC plan-eau : chrono lancé : #pkGo désactivé (tools/regate-e2e.mjs l. 3156)
Bilan : 40/41 scénario(s) OK
PW_REQUIRED=1 node tools/regate-e2e.mjs plan-eau (rejoué deux fois) : OK plan-eau · OK plan-eau
```
`plan-eau` : course de rendu sous la charge de la série complète (l’état du bouton est lu une fois, juste après `cartePlanEau`) ; aucun fichier du plan d’eau, du verrou de course ni de la carte « Plan d’eau » n’est touché par ce plan ; consigné dans deferred-items.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Gel de Naos] Manifeste de Tofinou non exclu du matcher**
- **Trouvé pendant :** tâche 1 — le plan rendait `manifest-tofinou.webmanifest` public sur tous les hôtes (hors du matcher). La section `publics` du gel compare « servi sans code sur l’hôte de Naos » : un nouveau fichier public sur l’adresse de Naos aurait demandé une nouvelle différence admise dans tests/helpers/naos.mjs, contraire à la règle « Naos ne gagne aucune vue ».
- **Correction :** le fichier passe par le middleware : servi sans code sur un hôte de Tofinou (ce qui couvre une réécriture réévaluée par la plateforme, raison donnée par le plan), code exigé ailleurs comme toute adresse de l’app (liste blanche `NOMS_PUBLICS`, nécessaire au worker de Naos qui le met en cache avec le cookie). Section `publics` identique à la fixture, sans changement de `differencesAdmises` ; le calcul de `publics` de tests/helpers/naos.mjs couvrait déjà « intercepté et transmis ou réécrit ».
- **Conséquence :** `grep -c manifest-tofinou middleware.js` vaut 2 (liste blanche et réécriture), pas « réécriture et matcher » ; exclusions du matcher : acces.html, acces.js, sw.js, icons/, rapports/.
- **Commit :** 737d09f

**2. [Rule 3] Middleware modifié sans affichage**
- **Problème :** le plan demandait de lire middleware.js masqué ; la consigne de l’orchestrateur interdit tout affichage du fichier (lecture masquée refusée dans cette session).
- **Correction :** enveloppe du déroulé existant (renommé `deroule`) plutôt qu’une insertion au milieu d’un code non lu ; ancres vérifiées par script, empreintes comparées sans affichage, comportement prouvé par les tests (voir « Middleware »). Le commentaire de deux lignes au-dessus du matcher a été remplacé par un commentaire de trois lignes (texte d’origine non lu).
- **Commit :** 737d09f

**3. [Rule 2] Espaces du membre gardés en mémoire**
- **Problème :** contrairement au point transmis, js/app.js ne gardait pas `espaces` de /api/membre.
- **Correction :** `setEspacesMembre(j?.espaces)` dans `refreshMembre` (mémoire seulement, filtré au registre ; aucune clé locale).
- **Commit :** c8cbedc

**4. [Rule 3] Test d’aide hors note de version**
- **Problème :** la note de la v43 affichée dans l’aide (« … GPEN ») faisait échouer « aide sans mots de Naos ».
- **Correction :** le scénario lit l’aide sans `#appVersion` ; la note de la v44 sera écrite par la release (08-10).
- **Commit :** c8cbedc

**5. Interprétations**
- Aide de Tofinou : pas de lien vers guide.html (guide de Naos) ni de rubrique IA (fermée hors de Naos jusqu’à 08-09) ; lien « Règles de course expliquées » gardé, sans la mention de l’arbitre.
- « Changer d’espace » : placé dans la fenêtre d’aide, avant la version ; `target="_blank"` en plus de `rel="noopener"` ; adresse = premier hôte de l’autre espace (sur `tofinou.localhost`, l’adresse de production de Naos).
- Hors de Naos, js/app.js pose aussi la description, l’en-tête (`.brand b`) et l’écran de chargement (« Tofinou Bormes »).
- Comparaison du rapport : empreinte SHA-256 du HTML (2 états) plutôt que le HTML entier (235 Ko par état) ; date du jour remplacée par `<date>` avant l’empreinte.
- Nouveau fichier de tests tests/identite.test.mjs (hors de la liste du plan) : processus resté en Naos pour comparer l’aide et la fenêtre d’aide.

## Known Stubs

| Fichier | Stub | Raison | Plan |
|---------|------|--------|------|
| js/help.js (aide) | note de version de la v43 (« … GPEN ») affichée dans l’aide de Tofinou ; ni lien du guide complet ni rubrique IA | release v44 et guide de l’espace ; IA de l’espace | 08-10, 08-09 |
| js/app.js l. 989 (pickHTML) | « pas un parcours du cahier CVAT » possible à Bormes sans régate ouverte | texte du plan d’eau | 08-07 / 08-08 |

Les deux sont inscrits dans .planning/WINDOWS.md.

## Threat Flags

Aucune surface hors du `<threat_model>` : T-08-21 (exclusions exactes testées, seul `/manifest.webmanifest` traité sans code, réécriture limitée à ce chemin et aux hôtes de Tofinou), T-08-22 (manifeste de Tofinou : nom et description seulement ; plus restreint que prévu, public sur ses hôtes seulement), T-08-23 (adresse lue dans le registre public, `rel="noopener"`, construit par `textContent`).

## Points pour 08-07

- Textes de Toulon encore possibles à Bormes : « pas un parcours du cahier CVAT » (`pickHTML`, js/app.js), libellé de classe du partage `P1–P2` / `C–R3` (`openShare`, js/app.js l. ~708), carte « État de la mer » (« large de Cépet », point transmis par 08-04), `legType` « Foc » / « Spi asymétrique » (08-05).
- Les bulles et le guide de Tofinou vivent dans js/help.js (`TIPS_TOFINOU`, `GUIDE_TOFINOU`, `guideDe`, `tipsDe`) : y ajouter les conseils de vent de Bormes si l’aide doit les citer ; test : tests/identite.test.mjs (mots interdits, libellés cités présents dans le code).
- Scénario `tofinou-identite` : base pour vérifier les textes de Bormes (aide lue sans `#appVersion`, `MOTS_DE_NAOS`).
- 08-09 : réécriture du manifeste à contrôler sur la production (`curl -sI` puis corps de `https://tofinou-bormes.vercel.app/manifest.webmanifest` sans code : nom « Tofinou — Bormes » ; même adresse sur l’hôte de Naos : « Rade Tactique — Toulon ») et installation sur iPhone (« Tofinou Bormes ») ; rubrique IA de `GUIDE_TOFINOU` quand l’IA de l’espace s’ouvre.
- 08-10 : lien du guide de l’espace dans `GUIDE_TOFINOU` (guide-tofinou.html) ; la note de release remplace celle de la v43 dans l’aide ; `guide-tofinou.html` dans `NOMS_PUBLICS` comme prévu (les manifestes passent déjà par la liste blanche).
- `/manifest.webmanifest` est maintenant intercepté : tout nouveau fichier public doit suivre la même règle (liste blanche + exclusion exacte ou traitement en tête de `creerMiddleware`).

## Self-Check: PASSED

- FOUND : manifest-tofinou.webmanifest, tests/identite.test.mjs, tests/helpers/debriefv43.mjs, tests/fixtures/debrief-v43.json
- FOUND : 737d09f, c8cbedc (ancêtres de HEAD) ; 2 commits mesurés entre plan_head_before et plan_head_after
