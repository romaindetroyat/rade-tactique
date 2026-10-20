---
phase: 04-archive-partagee
plan: 04
subsystem: sync
tags: [archive, objets-lourds, traces, rapports, vent-fige, hors-reseau, sandbox, chromium]

requires:
  - phase: 04-archive-partagee
    provides: "plans 01 à 03 : api/archive.js (route light, prénom du middleware), js/archsync.js (runSync, SYNC), js/archmerge.js (slug, stampState), faux Blob, scénarios archive et archive-bouees"
provides:
  - "api/archive.js : routes ?k=trace, ?k=report (immuables) et ?k=day (écrivain unique), relayées en flux, privées, nosniff, bornes 4 / 3 / 0,6 Mo"
  - "js/archheavy.js : heavyPlan, runHeavy, storageOk, dayObject, inHorizon (horizon 180 jours, 6 objets par passage, plafonds du jour 20 / 40, arrêt à 60 % du stockage)"
  - "js/app.js : runHeavyNow après une synchronisation légère réussie, file des jours figés SYNC.hq, geste « Télécharger pour le hors réseau », rapport en cadre sandbox"
  - "js/track.js : identifiant déterministe des imports GPX, listTracks par curseur avec rt"
  - "js/regview.js : « sur ce téléphone » / « en ligne seulement », bouton de téléchargement"
  - "tools/regate-e2e.mjs : scénario archivehors (A -> B réseau coupé, vent du jour, régate de plus de 180 jours)"
affects: [04-05]

actuals:
  tokens: 31700
  tasks: 3
  commits: 3
plan_head_before: 5a5f7d9afa5a6d18d154b27ac634122c532e3ce8
plan_head_after: d79fbbf8281d2810ca08e57ce29963a14939596b
commits: 3

tech-stack:
  added: []
  patterns:
    - "Objets lourds à écrivain unique ou immuables : jamais fusionnés, jamais réécrits ; le serveur choisit le chemin du jour d'après le prénom du middleware"
    - "File d'envoi des jours figés posée au gel (SYNC.hq), pas déduite du résumé fusionné : un jour en file n'est jamais remplacé par un téléchargement"
    - "Un passage lourd = plan pur (heavyPlan) + exécution contrôlée (runHeavy) : course et verrou du jour revérifiés avant chaque objet, arrêt au premier échec"
    - "Un rapport venu d'un autre téléphone est une donnée : cadre sandbox sans permission, « Plein écran » enfermé dans un cadre sandbox sous script-src 'none'"

key-files:
  created:
    - js/archheavy.js
    - tests/archheavy.test.mjs
    - .planning/phases/04-archive-partagee/deferred-items.md
  modified:
    - api/archive.js
    - js/app.js
    - js/track.js
    - js/regview.js
    - tools/regate-e2e.mjs
    - tests/apiarchive.test.mjs
    - tests/attach.test.mjs
    - tests/regates.test.mjs
    - sw.js
    - js/version.js

key-decisions:
  - "Le « Plein écran » du rapport ouvre une page à nous (politique script-src 'none' en tête) qui enferme le rapport dans un cadre sandbox, au lieu d'insérer la balise de politique dans le HTML du rapport : un script placé avant <head> dans un rapport piégé s'exécuterait avant la balise insérée"
  - "Un jour figé jamais envoyé ni reçu mais présent en local (figé avec la v28/v30) est envoyé une fois avant d'être éventuellement remplacé par celui du gagnant, et un jour à envoyer n'est jamais téléchargé dans le même passage (plafond d'envois atteint, panne)"
  - "Un objet annoncé par la fiche mais pas encore en ligne (404) est noté et ne se redemande qu'après 30 minutes (le geste « Télécharger » le redemande tout de suite) : pas de boucle ni de plafond gaspillé"
  - "Les envois ne sont pas limités à l'horizon de 180 jours (une trace ancienne jamais envoyée est sauvegardée en ligne) ; seuls les téléchargements le sont"
  - "listTracks par curseur avec rt est livré dès la tâche 1 (le tracer en a besoin pour envoyer les rapports), les tests d'identifiant déterministe et la garde statique sont dans la tâche 3"

requirements-completed: [ARCH-03, ARCH-01]

coverage:
  - id: D1
    description: "Un équipier ouvre en mode avion, sur son téléphone, la fiche d'une régate récente avec la trace rangée (carte et analyse), le débrief et le rapport saisis sur le téléphone d'un autre équipier, et le vent du jour figé"
    requirement: ARCH-03
    verification:
      - kind: e2e
        ref: "PW_REQUIRED=1 node tools/regate-e2e.mjs archivehors (deux contextes Chromium : trace de 9 538 points et rapport de A chez B, setOffline(true), « Voir la trace » puis « Voir le débrief », aucune requête vers /api/archive pendant la lecture ; vent du jour figé de A chez B, copies wx/strat/obs dans rade-regates)"
        status: pass
      - kind: unit
        ref: "tests/archheavy.test.mjs (tracer à trois téléphones contre le vrai gestionnaire : A envoie, B et C reçoivent dans les bases locales ; rien ne repart)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rien de lourd ne part ni n'arrive pendant une course ni pendant la journée de régate ; 6 objets par passage ; plafonds par jour ; arrêt à 60 % du stockage ; persist() demandé une fois"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archheavy.test.mjs (course et verrou avant tout appel, course commencée entre deux objets, requête interrompue = arrêt sans erreur, budget 60 %, estimation en échec, plafonds 20 / 40 et remise à zéro le lendemain de Paris)"
        status: pass
      - kind: e2e
        ref: "archivehors partie 5 : jour figé le jour de la Coupe, aucun appel lourd compté pendant le verrou, envoi le lendemain à 08:00 ; contrôle négatif : verrou neutralisé -> « aucun appel lourd pendant la journée de régate — obtenu [PUT day, PUT day] »"
        status: pass
    human_judgment: false
  - id: D3
    description: "Aucune perte : un jour figé local n'est jamais remplacé avant son envoi ; chaque équipier écrit son propre objet de jour ; une trace ou un rapport déjà en ligne n'est pas réécrit ; une trace téléchargée n'est pas renvoyée"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/archheavy.test.mjs (A avant le signal et B en retard : deux objets en ligne, B envoie le sien avant de recevoir celui de A, C reçoit celui de A ; gel pendant l'envoi ; gel pendant le téléchargement ; jour d'avant l'archive ; plafond d'envois atteint) et tests/apiarchive.test.mjs (exists sans écriture, perte de course = exists, PUT du jour sous le prénom du serveur malgré ?by=)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Un même GPX importé sur deux téléphones donne la même trace ; « Mes traces » ne désérialise plus toutes les traces pour les lister ; la fiche dit ce qui est lisible hors réseau et propose « Télécharger pour le hors réseau » pour les régates de plus de 180 jours"
    requirement: ARCH-03
    verification:
      - kind: unit
        ref: "tests/attach.test.mjs (identifiant déterministe, garde statique de listTracks), tests/regates.test.mjs (états, bouton, échappement)"
        status: pass
      - kind: e2e
        ref: "archivehors : « Mes traces » de B (nom, date, 9538 points), seconde importation « Déjà importée », téléphone C 184 jours après la Coupe : « en ligne seulement » puis téléchargement d'un geste (GET trace, GET report)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Adresses ?k=trace, ?k=report, ?k=day : 401 sans code, 403 sans prénom, 400 paramètres invalides, 413 au-delà des bornes, privées, jamais d'adresse du magasin ; un rapport d'un autre téléphone ne peut rien exécuter"
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: "tests/apiarchive.test.mjs (7 tests lourds), tests/access.test.mjs (formes d'adresse déjà couvertes), garde statique de showReport (sandbox sans allow-scripts ni allow-same-origin, script-src 'none' avant createObjectURL)"
        status: pass
      - kind: e2e
        ref: "archivehors : rapport piégé (script, img onerror) affiché chez B, window.__xss et localStorage intacts, attribut sandbox vide ; contrôle négatif : sandbox retiré -> le scénario échoue"
        status: pass
    human_judgment: false
  - id: D6
    description: "Recette humaine : iPhone installé en mode avion (quota et purge réels d'iOS, environ 1 Mo par régate) et vrai magasin Blob (head() d'un absent, put sans écrasement, flux d'une trace de 600 Ko)"
    verification: []
    human_judgment: true
    rationale: "Quota et purge d'iOS, comportement réel du SDK @vercel/blob sur un magasin privé : inaccessibles aux tests (consignés dans .planning/WINDOWS.md, entrées 4 et 5)"

duration: 36min
completed: 2026-10-20
status: complete
---

# Phase 4 Plan 04 : objets lourds partagés et lisibles hors réseau — Summary

**La trace, le rapport et le vent figé d'un jour partent une seule fois de chez l'équipier qui les a, arrivent dans les bases locales existantes des deux autres (régates des 180 derniers jours et à venir, les plus anciennes d'un geste), s'ouvrent en mode avion, ne circulent jamais pendant une course ni la journée de régate, et un rapport d'un autre téléphone s'affiche dans un cadre qui ne peut rien exécuter.**

## Performance

- **Duration :** 36 min (05:10 à 05:46 UTC)
- **Tasks :** 3 (1 tracer, 2 auto TDD) ; 3 commits de plan
- **Files modified :** 12 (3 créés avec ce résumé et les éléments différés)
- **Tests :** 430 -> 470 (`npm run check` vert) : `tests/archheavy.test.mjs` 28 tests, `tests/apiarchive.test.mjs` 24 -> 31, +2 `attach`, +3 `regates`
- **Scénarios Chromium :** 16/16 (`PW_REQUIRED=1 node tools/regate-e2e.mjs`, suite complète), dont le nouveau `archivehors`
- **Démarrage :** `tools/measure-boot.mjs` médiane 385 ms (383 ms avant le plan), seuil 2000 ms

## Accomplishments

- **Fonction (`api/archive.js`)** : `?k=trace` et `?k=report` sont immuables (`head` avant écriture ; une écriture perdue contre un autre téléphone répond `exists` au lieu de réécrire), `?k=day` est à écrivain unique : le PUT écrit TOUJOURS sous le `slug` du prénom du middleware, le `by` du client est ignoré ; le GET d'un jour demande `by`. Le rapport ne voyage pas avec la trace. Flux relayé en JSON avec `nosniff`, `Cache-Control: no-store`, jamais d'adresse du magasin, paramètres validés (400), bornes 4 / 3 / 0,6 Mo (413), `..` refusé dans les identifiants.
- **Plan et passage (`js/archheavy.js`)** : `heavyPlan` (pur) ordonne envois puis téléchargements, 6 objets au plus ; `runHeavy` revérifie la course et le verrou du jour avant chaque objet, s'arrête au premier échec, traite 404 / 401 / 413 / 429 sans boucle et note ce qui est envoyé (`meta.up`) ou reçu (`meta.down`) pour ne jamais le renvoyer.
- **Aucune perte du vent figé** : `freezeWrite` met le jour en file (`SYNC.hq`) après l'écriture des trois copies ; le jour est lu avec un marqueur, retiré seulement si le marqueur n'a pas bougé pendant l'envoi ; un jour en file ou à envoyer n'est jamais téléchargé ; un téléchargement qui voit un gel arriver n'écrit rien.
- **Fiche** : chaque trace est « sur ce téléphone » ou « en ligne seulement », un bouton « Télécharger pour le hors réseau » apparaît quand une trace ou un jour figé d'un autre équipier manque ; le geste ignore l'horizon de 180 jours, respecte la course et le verrou du jour (toasts du plan).
- **Rapport** : cadre `sandbox` vide dans la fiche, « Plein écran » ouvre une page à nous sous `script-src 'none'` qui enferme le rapport dans un cadre sandbox.
- **Traces** : identifiant `'tr' + premier instant + '-' + nombre de points` pour les nouveaux imports ; `listTracks` par curseur avec `rt`.

## Task Commits

1. **Task 1 (tracer) : la trace et le rapport de A s'ouvrent sur B, réseau coupé** - `8bf195f` (feat)
2. **Task 2 : vent du jour figé sans perte, horizon, budget, plafonds** - `09ef213` (feat)
3. **Task 3 : identifiant déterministe, état hors réseau de la fiche, téléchargement d'un geste** - `d79fbbf` (feat)

**Plan metadata :** commit `docs(04-04)` qui suit ce fichier.

_TDD : tests écrits avant le code pour les routes (rouges constatés sur `k inconnu` : le test 13 d'avant attendait 400 pour les trois nouvelles routes, mis à jour) et pour le passage ; tests et code d'une tâche sont dans un seul commit. Tracer : la vérification de bout en bout (`archivehors`, `archive`, `npm run check`) a été relancée avant d'élargir, aucun échec._

## Mesures des objets envoyés (Coupe de la SNPM, scénario `archivehors`)

| Objet | Octets |
|-------|--------|
| Trace (9 538 points, sans rapport) | 612 648 |
| Rapport marqueur du scénario | 366 (un rapport réel : environ 250 Ko, mesure du plan 03) |
| Vent figé d'un jour | 50 593 (prévisions 38 803, route conseillée 11 490, relevés 48) |

Une régate typique reste de l'ordre de 1 Mo, comme estimé (Pattern 8).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Sécurité] « Plein écran » : page enveloppe plutôt que balise insérée dans le HTML du rapport**
- **Found during:** Task 1
- **Issue:** le plan demande d'ajouter en tête du HTML une balise `meta` de politique de contenu. Un rapport piégé peut placer un `<script>` avant `<head>` (ou une fausse balise `<head>` en commentaire) : il s'exécuterait avant la balise insérée, avec l'origine de l'app (T-04-25).
- **Fix:** `showReport` ouvre en « Plein écran » une page à nous, avec la politique `script-src 'none'` en tête, qui contient le rapport dans un `<iframe sandbox srcdoc>` (HTML du rapport échappé). Même résultat visible, aucune dépendance à la forme du HTML d'un autre téléphone. La garde statique du plan (cadre `sandbox`, pas d'`allow-scripts` ni `allow-same-origin`, `script-src 'none'` avant `createObjectURL`) est vérifiée telle quelle.
- **Files modified:** js/app.js, tests/archheavy.test.mjs
- **Commit:** 8bf195f

**2. [Rule 3 - Bloquant] `listTracks` par curseur avec `rt` livré en tâche 1 au lieu de la tâche 3**
- **Found during:** Task 1
- **Issue:** le tracer envoie les rapports d'après `rt` (instant du rapport local) que `listTracks` ne rendait pas.
- **Fix:** curseur et `rt` dans la tâche 1 ; la tâche 3 ajoute l'identifiant déterministe et la garde statique (dans `tests/attach.test.mjs`).
- **Files modified:** js/track.js
- **Commit:** 8bf195f

**3. [Rule 1 - Bug] Un jour à envoyer pouvait être téléchargé dans le même passage**
- **Found during:** Task 2 (test « jour d'avant l'archive »)
- **Issue:** le plan calculé une fois contenait l'envoi puis le téléchargement du même jour ; si l'envoi sautait (plafond atteint), les copies locales étaient remplacées sans avoir été envoyées (T-04-27).
- **Fix:** `heavyPlan` exclut des téléchargements tout jour présent dans les envois ; test « plafond d'envois atteint » ajouté.
- **Files modified:** js/archheavy.js, tests/archheavy.test.mjs
- **Commit:** 09ef213

**4. [Rule 2 - Fonctionnalité critique] Jours figés d'avant l'archive et objets annoncés mais absents**
- **Found during:** Task 2
- **Issue:** les jours figés avant ce plan (v28 à v30) n'ont pas de marqueur `hq` : sans traitement, leurs copies n'auraient jamais été envoyées, puis remplacées par celles du gagnant. Une fiche qui annonce un objet pas encore en ligne (404) ferait redemander l'objet à chaque passage.
- **Fix:** `localDays` (copies locales sans marqueur) -> envoyés une fois ; `meta.miss` (30 minutes) ; `meta.up` / `meta.down` posent les marqueurs de ce qui est passé.
- **Files modified:** js/archheavy.js
- **Commit:** 09ef213

**5. [Rule 3 - Bloquant] Bruits attendus du cadre sandbox dans l'outil de scénarios**
- **Found during:** Task 3 (`gpx` échouait : erreurs de page dans le cadre du rapport)
- **Issue:** l'init de l'outil (horloge Playwright, service worker bloqué) est refusée par le navigateur dans un cadre sandboxé : « Failed to read the 'serviceWorker' … sandboxed » et « Blocked script execution in 'about:srcdoc' ». Ce n'est pas l'app (les rapports réels n'ont aucun script).
- **Fix:** ces deux messages sont écartés dans `ouvrePage` ; la preuve du bac à sable est l'attribut vide, `window.__xss` et `localStorage` intacts.
- **Files modified:** tools/regate-e2e.mjs
- **Commit:** d79fbbf

**Total deviations :** 5 (tous documentés ci-dessus) ; aucune décision d'architecture (Rule 4).

## Issues Encountered

- `gel` (étape 3) a échoué une fois sur six exécutions ; non lié à ce plan (voir `deferred-items.md`), suite complète 16/16.
- Contrôles négatifs faits pour de bon : sandbox retiré -> `archivehors` échoue (« cadre du rapport en sandbox sans permission ») ; verrou du jour neutralisé -> `archivehors` échoue (« aucun appel lourd pendant la journée de régate »).

## Known Stubs

Aucun.

## Threat Flags

Aucune surface hors du registre du plan : les trois adresses (`k=trace|report|day`), l'affichage d'un rapport d'un autre téléphone et l'échange pendant une course sont les T-04-23 à T-04-28 ; chacun est mitigé et testé (401 / 403 / 400 / 413, chemin du jour posé par le serveur, sandbox, file `SYNC.hq`, `isActive` et `isLocked`). Rien de nouveau n'est lisible sans code ; aucun code d'accès ni empreinte écrits.

## À reprendre au plan 04-05

- `guide.html` et `js/help.js` disent encore « les traces complètes, les débriefs et les rapports ne sont pas encore partagés » (cartes « Archive partagée », « La fiche de régate », « Mes traces et mes régates sont-elles partagées ? ») : à mettre à jour avec « Lire une régate hors réseau » (plan 05).
- La publication v31 (`release.json`) n'est pas faite ici : `npm run stamp` seulement (v30 reste la version publiée sur l'aperçu).
- Recette humaine : `.planning/WINDOWS.md` entrées 4 (vrai magasin Blob) et 5 (iPhone en mode avion, espace occupé).

## Self-Check: PASSED

- Fichiers : `js/archheavy.js`, `tests/archheavy.test.mjs`, `api/archive.js`, `js/track.js`, `js/regview.js`, `js/app.js`, `tools/regate-e2e.mjs`, `deferred-items.md` : présents.
- Commits : `8bf195f`, `09ef213`, `d79fbbf` : ancêtres de HEAD.
- `npm run check` : 470 tests, 0 échec ; `git diff f80c365 -- js/courses.js tests/reference/` : vide ; suite complète des scénarios : 16/16.
