---
phase: 08-espace-tofinou
plan: 09
subsystem: ia
tags: [ia, consignes, espaces, tofinou, regles, cloisonnement]
status: complete
requires: [08-02, 08-05, 08-08]
provides:
  - "CONSIGNES_TOFINOU (api/_tofinou.js) : arbitre, débrief, dictée, lecture des IC de l’espace Tofinou"
  - "IA ouverte à l’espace Tofinou (IA_ESPACES = naos, tofinou), quota par espace + prénom"
  - "Note du Tofinou 9.5 et du Challenge de la Baie sur regles.html dans l’espace Tofinou"
  - "Scénario tofinou-ia"
affects: [08-10, 08-11]
tech-stack:
  added: []
  patterns:
    - "Consigne choisie par l’en-tête du middleware (espaceDeRequete, api/_espace.js) ; Naos garde l’expression de la v43"
    - "Page statique rendue sous linkedom dans un contexte vm, import dynamique par le chargeur de Node (tests/helpers/regles.mjs)"
key-files:
  created:
    - api/_tofinou.js
    - tests/regles.test.mjs
    - tests/helpers/regles.mjs
    - tests/fixtures/regles-v43.json
  modified:
    - api/_espace.js
    - api/rules.js
    - api/debrief.js
    - api/voice.js
    - api/ic.js
    - js/regles.js
    - js/help.js
    - tests/apiia.test.mjs
    - tests/apiic.test.mjs
    - tests/espaces.test.mjs
    - tools/regate-e2e.mjs
    - sw.js
    - js/version.js
decisions:
  - "Consignes de Tofinou : une table fermée (CONSIGNES_TOFINOU) avec un bloc commun (bateau 9,47 m, zone 28,4 m, deux longueurs 18,9 m, rade de Bormes – Le Lavandou, Challenge de la Baie, RIR, un tour, VHF 72) ; texte des RIR non embarqué, l’arbitre écrit « à vérifier dans les RIR »"
  - "Lecture de l’espace dans les fonctions par espaceDeRequete(req) d’api/_espace.js : api/ic.js ne lit toujours aucun en-tête lui-même (garde de tests/apiic.test.mjs)"
  - "Page des règles de Tofinou : note par textContent, partie de Brest cachée, liens vers Brest et vers le guide de Naos retirés (liens stylés : hidden ne les cache pas)"
  - "Formulaire de manche « Classe G / P » (WINDOWS n° 15) hors de ce plan (modèle de régate et archive) : laissé à 08-11"
metrics:
  duration: "~20 min (22:46 → 23:06 UTC)"
  completed: 2026-11-26
estimate:
  tokens: 100000
  tasks: 2
actuals:
  tokens: 18700
  tasks: 2
  commits: 2
plan_head_before: f5e21f0548decb07fe3f07aca63a844520591fab
plan_head_after: 027373d47bcae63e0fd40ea28b02ee733854682f
---

# Phase 8 Plan 09 : IA de l’espace Tofinou et page des règles — Résumé

Arbitre, débrief, dictée et lecture des IC de l’espace Tofinou avec leurs propres consignes fixes (Tofinou 9.5, Challenge de la Baie, RIR, un tour, VHF 72), choisies par l’en-tête du middleware ; IA ouverte à Tofinou avec le quota par espace + prénom ; page des règles annotée pour le Tofinou ; Naos identique à la v43 octet pour octet.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 4f00e8d | `api/_tofinou.js` ; consigne par espace dans les quatre fonctions ; `IA_ESPACES = ['naos', 'tofinou']` ; `espaceDeRequete` ; tests de consignes, de citations, de quota ; scénario `tofinou-ia` |
| 2 (tdd) | 027373d | note des règles dans l’espace Tofinou (js/regles.js), rubrique IA de l’aide de Tofinou (js/help.js), page de Naos comparée à la v43, scénario complété, `npm run stamp` |

Tracer (tâche 1) : `<verify>` rejoué de bout en bout avant la tâche 2 (tests ciblés, `npm run check`, gardes, scénarios `tofinou-ia ia arbitre ia-erreurs gpen` : 5/5) ; expansion poursuivie.

Tâche 2 (tdd) : l’implémentation de js/regles.js a été écrite juste avant le test ; l’état rouge est montré en faisant tourner le même rendu sur le js/regles.js de la v43 (extraction de 5e9b8a5) à l’hôte de Tofinou : « note = null ; libellé = IC CVAT : ».

## Empreintes de Naos comparées

Section `ia` de tests/fixtures/naos-v43.json, recalculée par `tests/naos.test.mjs` et par le test « Naos : x-rt-espace naos → consignes de la v43 » (12 premiers caractères) :

| Fonction | Toulon | Brest |
|----------|--------|-------|
| rules | 45afaf3ecc44… | 23f154ed9d19… |
| debrief | 36cc8b25a610… | 1dfd5ff28b4d… |
| voice | 287871e464d0… | bbd9d43ec73d… |
| ic | 1215e1ad4375… | — |

Chez Naos, un corps `venue: 'bormes'` donne les consignes de Toulon (liste fermée de la v42 inchangée). Aucune empreinte de Tofinou n’égale une empreinte de Naos.

Page des règles de Naos : DOM avant et après une réponse de l’arbitre, et corps envoyés, identiques à la v43 dans cinq états (127.0.0.1, rade-tactique.vercel.app, aperçu, Brest, `rade.espace.v1 = tofinou` sur un hôte de Naos) ; capture déterministe (`cmp` de deux captures).

## Extraits des consignes de Tofinou relus

- Bloc commun : « Bateau : Tofinou 9.5, voilier de 9,47 m (zone = 3 longueurs = 28,4 m, deux longueurs = 18,9 m), génois ou foc, spi asymétrique sur bout-dehors. » ; « Plan d’eau : rade de Bormes – Le Lavandou (baie de Bormes, de La Londe à Cavalaire, jusqu’aux îles de Port-Cros et du Levant). » ; épreuve, groupe 4, RIR, « Pénalité : un tour », « Canal de course : VHF 72 », lignes comité – bouée orange, DNS après 4 minutes, bout-dehors, briefing 10 h / premier signal 11 h, parcours (banane, côtiers, « R » = sens inverse).
- Arbitre : « Le Challenge se court aux Règles d’introduction à la régate (RIR), une version simplifiée des règles de course dont le texte ne t’est pas fourni : réponds avec les règles de course, et quand les RIR peuvent dire autrement […] écris-le dans attention avec « à vérifier dans les RIR ». N’invente jamais le contenu des RIR. » ; mêmes règles de réponse et mêmes points d’interprétation que l’arbitre de Naos ; texte officiel des RRS en entier à la fin.
- Débrief : « La polaire est celle du Tofinou 9.5 tirée du certificat ORC d’un sister-ship (génois ou foc), encore à recaler sur l’eau […] » ; « Pas de marée dans la baie ; un faible courant général d’ouest peut porter entre les îles pendant un côtier : ne le chiffre pas ».
- Dictée : rose des vents ; « Ici, le mistral vient de l’ouest (mistral ≈ 260) ; levant ≈ 75, brise de sud-est ≈ 130, brise de sud-ouest ou labech ≈ 220, vent de terre ≈ 330 » ; comité VHF 72, pénalité, courant : pas du vent.
- IC : consigne de lecture de Naos adaptée (« fiche d’un équipage de Tofinou 9.5 qui court dans la rade de Bormes – Le Lavandou »), repères de l’équipage donnés « pour comprendre le texte seulement (jamais une valeur à recopier) ».
- Aucune des quatre ne contient Naos, CVAT, GPEN, J80, Toulon ni Brest ; apostrophe ’ partout hors du texte anglais des RRS (tests).

## Sorties brutes

```
node --test … tests/apiia.test.mjs tests/apiic.test.mjs tests/naos.test.mjs tests/espaces.test.mjs
# pass 121
# fail 0

node --test … tests/regles.test.mjs tests/guide.test.mjs tests/naos.test.mjs
# pass 26
# fail 0

npm run check
stamp à jour   (avertissement non strict « contenu modifié depuis la v43 » : la release est pour 08-10)
# tests 1009
# pass 1007
# fail 0
# skipped 2    (instantanés météo de Brest et de Bormes absents)

node tools/gardes-toulon.mjs
OK SNPM (js/courses.js, tests/reference/ = f80c365)
OK données de Toulon (data/ = 56f6625)
OK modules du mode départ (= 56f6625)
OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
OK gel de Naos v43 (tests/naos.test.mjs)
OK pack de Brest (data/brest.* = 5e9b8a5)

git diff --quiet f80c365 -- js/courses.js tests/reference/   → vrai
git diff --quiet 5e9b8a5 -- data/brest.*                     → vrai
git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js → vrai

PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-ia ia arbitre ia-erreurs gpen
OK tofinou-ia · OK ia · OK arbitre · OK ia-erreurs · OK gpen — Bilan : 5/5
PW_REQUIRED=1 node tools/regate-e2e.mjs tofinou-ia guide naos-cles
OK tofinou-ia · OK guide · OK naos-cles — Bilan : 3/3
```

Scénario `tofinou-ia` (hôte `tofinou.localhost`, vraies fonctions derrière la route, client simulé, faux Blob) : dictée « vent au 260, 16 nœuds » → « 260° · 16 nd », débrief rédigé par `narrative` de l’app (`ai: true`), question à l’arbitre → « Un tour suffit » et « IC du Challenge de la Baie : … » ; consignes vues = `CONSIGNES_TOFINOU` ; corps de la page avec `venue: 'bormes'` (ignoré par le serveur) ; un seul compteur, `tofinou/preview/quota/<jour>/frederic.json` = 3 ; note de la page des règles, aide (rubrique IA, « Spi dès »), lien des règles ouvert depuis l’aide ; Naos sur 127.0.0.1 : page des règles sans note.

## Instantanés météo

- `python3 -I tools/snapshot_weather.py --venue bormes` : refusé par Open-Meteo (« Daily API request limit exceeded. Please try again tomorrow. ») ; rien écrit, rien inventé ; test sauté avec son motif (WINDOWS n° 9 reste ouvert, n° 16 ajouté).
- `--venue brest` : même refus. Attention : si l’instantané de Brest est produit plus tard, `data/brest.wx-snapshot.json` casse la garde « pack de Brest » (`git diff --quiet 5e9b8a5 -- data/brest.*`) et la section `brest` du gel de Naos (10 fichiers) : il faudra une différence admise décidée par Romain (WINDOWS n° 17).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocage] api/ic.js ne doit lire aucun en-tête (garde de tests/apiic.test.mjs)**
- **Trouvé pendant :** tâche 1
- **Problème :** lire `req.headers['x-rt-espace']` dans api/ic.js faisait échouer le test « la fonction ne lit que req.body.text ».
- **Correction :** `espaceDeRequete(req)` dans api/_espace.js, utilisé par les quatre fonctions ; commentaire d’api/ic.js précisé (l’espace choisit la consigne, il ne part pas chez le fournisseur).
- **Commit :** 4f00e8d

**2. [Rule 1 - Test devenu faux] « espace sans IA ouverte (Tofinou) → 503 »**
- **Problème :** Tofinou est maintenant ouvert ; le test prouvait la fermeture par les vraies fonctions.
- **Correction :** la fermeture reste prouvée par `createIA({ espacesIA: ['naos'] })` (503 `ia_espace`, aucun appel ni compteur) ; `tests/espaces.test.mjs` attend `['naos', 'tofinou']`.
- **Commit :** 4f00e8d

**3. [Rule 2 - Textes de Naos sur la page de Tofinou] Partie de Brest et lien du guide de Naos**
- **Problème :** la page des règles ouverte chez Tofinou proposait « À Brest (GPEN) » et le guide de Naos (guide.html), que l’aide de Tofinou évite depuis 08-06.
- **Correction :** section `#brest` cachée, liens du sommaire et du guide retirés (les liens ont un `display` qui l’emporte sur `hidden`), présentation de l’arbitre avec les règles locales ; seulement hors de Naos.
- **Commit :** 027373d

**4. [Rule 2 - Point transmis] Aide de Tofinou**
- Rubrique IA ajoutée (quota de l’espace, « Lire avec l’IA », arbitre et RIR, sans lien vers guide.html), « Spi dès » repère indicatif, lien des règles qui cite l’arbitre. Commit 027373d.

**5. Interprétations**
- Débrief vérifié par la fonction `narrative` de l’app (même module que l’app ouverte), avec des faits d’un bord, plutôt que par tout le chemin GPX → débrief (déjà couvert par d’autres scénarios) : la consigne, le corps et la réponse sont ceux de l’app.
- Le rendu de la page des règles sous Node passe par `vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER` (fonction expérimentale de Node, un avertissement s’affiche dans `npm test`) pour l’import dynamique de js/espaces.js depuis le script classique ; regles.html n’est pas modifié.
- Aucun appel réel au fournisseur : le plan n’en demande pas (contrôle humain en 08-10).

## Known Stubs

Aucun nouveau stub. WINDOWS n° 12 (aide de Tofinou) : la rubrique IA est faite ; la note de version de la v43 et le lien du guide de l’espace restent pour 08-10 (entrée laissée ouverte).

## Threat Flags

Aucune surface hors du registre : T-08-31 (consigne choisie par l’espace, `venue` ignoré hors de Naos, tests), T-08-32 (expression de la v43 pour Naos, empreintes du gel), T-08-33 (quota par espace + prénom par les vraies fonctions, 31e appel refusé sans toucher Naos), T-08-34 (« à vérifier dans les RIR », citations vérifiées contre api/_rrs.js). Aucune installation de paquet.

## Points pour 08-10 et 08-11

- 08-10 : relever l’usage réel de l’IA par espace (quota Tofinou, budget commun) ; contrôle humain d’une vraie question à l’arbitre de Tofinou (aucun appel réel fait ici) ; guide de l’espace (rubrique IA du guide complet), note de version v44.
- 08-10 : réécriture du manifeste de Tofinou à contrôler sur la production (point de 08-06, impossible avant le déploiement de la v44).
- 08-11 : chemin complet PDF → lecture par l’IA → relecture → bouées à confirmer dans l’espace Tofinou (D-16) : la partie serveur est ouverte et testée (consigne d’IC de Tofinou, vérification mot pour mot, quota de l’espace) ; une régate lue depuis les IC n’a pas de `jours` (v43).
- 08-11 : formulaire de manche « Classe G (grand) / P (petit) » encore proposé à Bormes (WINDOWS n° 15) : modèle de régate (`cls`) et archive concernés, à masquer ou remplacer par les groupes 3 et 4, Naos identique.
- Instantanés météo de Bormes et de Brest à réessayer un autre jour (limite quotidienne) ; Brest : différence admise à décider avant de committer le fichier.
- Page des règles chez Tofinou : le corps de la page reste écrit pour le J80 et le CVAT (« 24 m en J80 », « IC CVAT ») ; la note dit de retenir ses longueurs et règles ; une page propre à l’espace pourrait venir avec le guide (08-10).

## Self-Check: PASSED

- FOUND : api/_tofinou.js, tests/regles.test.mjs, tests/helpers/regles.mjs, tests/fixtures/regles-v43.json, 08-09-SUMMARY.md
- FOUND : 4f00e8d, 027373d (ancêtres de HEAD) ; 2 commits mesurés entre plan_head_before et plan_head_after
- WINDOWS : entrées n° 16 (Bormes, réessai refusé) et n° 17 (Brest et le gel) ajoutées
