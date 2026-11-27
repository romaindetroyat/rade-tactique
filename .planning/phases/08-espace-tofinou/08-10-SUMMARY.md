---
phase: 08-espace-tofinou
plan: 10
subsystem: livraison
status: complete
tags: [tofinou, bormes, guide, release, v44, gardes, gel-de-naos, d-15, d-16, d-17, d-18]
requires:
  - "08-01 à 08-09 et 08-11 : gel de Naos v43, serveur cloisonné, pack de Bormes, espace dans l’app, bateau, identité, savoir local, Challenge de la Baie, IA de l’espace, IC et éditeur de parcours"
provides:
  - "guide-tofinou.html : guide court de l’espace Tofinou, ouvert par GUIDE_TOFINOU (js/help.js)"
  - "tools/measure-boot.mjs --espace tofinou : ouverture hors réseau de l’espace Tofinou à Bormes"
  - "release.json v44 (hachage dc6eb67f26), sw.js et js/version.js régénérés"
affects: []
tech-stack:
  added: []
  patterns:
    - "Guide d’un espace : même charte que guide.html, libellés (span.k) et citations « » retrouvés dans le code par le test, titres des parcours lus dans le descripteur du plan d’eau"
key-files:
  created:
    - guide-tofinou.html
  modified:
    - js/help.js
    - middleware.js
    - tools/stamp.mjs
    - tools/measure-boot.mjs
    - tools/regate-e2e.mjs
    - tests/guide.test.mjs
    - tests/identite.test.mjs
    - tests/access.test.mjs
    - tests/entetes.test.mjs
    - tests/helpers/naos.mjs
    - docs/ia-budget.md
    - .planning/PROJECT.md
    - release.json
    - sw.js
    - js/version.js
decisions:
  - "Guide Tofinou : l’import du GPX est décrit avec le vrai libellé de l’app, onglet Traces, « ⤓ Importer un fichier GPX » (aucun bouton « Importer un GPX » dans l’onglet Régates) ; la trace rangée se lit ensuite dans la fiche de la régate (onglet Régates, partie Traces)"
  - "Guide Tofinou : « Spi dès » et la relance du mode départ présentés comme repris du J80 (approximations) ; aucun autre texte de l’autre espace (test : ni CVAT, GPEN, Naos, Toulon, Brest)"
  - "Mesure d’ouverture de l’espace Tofinou : option --espace tofinou de tools/measure-boot.mjs (hôte d’essai tofinou.localhost, pack de Bormes exigé complet dans son cache, bandeau et carte de Bormes exigés à chaque ouverture hors réseau)"
  - "Instantané météo de Bormes : réessayé une fois, refusé (limite quotidienne d’Open-Meteo) ; v44 préparée sans ; celui de Brest non produit (WINDOWS n° 17, décision de Romain)"
metrics:
  duration: "~45 min (23:53 → 00:40 UTC)"
  completed: 2026-11-27
estimate:
  tokens: 110000
  tasks: 3
actuals:
  tokens: 14300
  tasks: 1
  commits: 5
plan_head_before: 508bd9ae2ad37b255cfe5e3f95ca8a80a32391ba
plan_head_after: 8078eba7c022832143a7f600f0c02b0ed3eda985
---

# Phase 8 Plan 10 : livraison v44 de l’espace Tofinou — Résumé (v44 puis v45 en production le 27/11)

La v44 est prête et vérifiée en local sur `apercu-phase-08` : guide court de l’espace Tofinou (entrer, rade de Bormes hors réseau, Challenge de la Baie 2026-2027, IC et éditeur de parcours, bateau à recaler, trace GPX par une app dédiée, vents, zones, IA, « Changer d’espace », sources), ouvert par l’aide de l’espace Tofinou ; toutes les gardes, les trois compatibilités, les 46 scénarios, les trois mesures d’ouverture et l’horloge audio en 0, puis `npm run release`, `RT_STRICT=1 stamp --check` et la porte de production en 0. Naos : guide, aide et vues de la v43 (gel et gardes verts). Rien n’est poussé : la poussée, la PR brouillon, l’aperçu et la décision « publie » (tâches 2 et 3) restent à l’orchestrateur et à Romain.

## Ce qui a été fait

| Tâche | Commit | Contenu |
|-------|--------|---------|
| 1 (tracer) | 2ee1066 | guide-tofinou.html, lien dans GUIDE_TOFINOU, liste blanche du middleware (`NOMS_PUBLICS`, une ligne), `ROOT_FILES`, `AJOUTS_SHELL`, tests du guide Tofinou, identité, accès et en-têtes |
| 1 | 8ac677d | `tools/measure-boot.mjs --espace tofinou` |
| 1 | 5e827bb | docs/ia-budget.md (second équipage contre le quota Blob), .planning/PROJECT.md (second équipage, décision clé, hors périmètre précisé) |
| 1 | a4dad1f | scénario tofinou-ic : horloge avancée entre deux confirmations (échec intermittent, écart n° 1) |
| 1 | 8078eba | release v44 : `release.json` n = 44, `critical` faux, hachage `dc6eb67f26` = identifiant de `js/version.js` |
| 2 (checkpoint:decision) | — | en attente : poussée, PR brouillon, aperçu, « publie » ou « attendre » de Romain |
| 3 (auto, conditionnelle) | — | en attente de « publie » |

Porte du tracer : `<verify>` du plan rejoué en entier après la release (script avec `pipefail`, plus compat-v43 et la mesure de Bormes) : `VERIFY code=0`.

Têtes relevées (lecture seule) : `apercu-phase-08` locale = `8078eba7c022832143a7f600f0c02b0ed3eda985` (avant le commit de ce résumé) ; `origin/apercu-phase-08` = `508bd9a` (non poussée) ; `origin/main` = `1acf882f3e81c3169849b444d67f1fc306dad741` (inchangée).

## Sorties brutes

```
npm run check : stamp à jour ; 1031 tests, 1029 verts, 2 sautés (instantanés météo de Bormes et de Brest absents), 0 échec
node tools/gardes-toulon.mjs : code 0
  OK SNPM (js/courses.js, tests/reference/ = f80c365)
  OK données de Toulon (data/ = 56f6625)
  OK modules du mode départ (= 56f6625)
  OK tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)
  OK gel de Naos v43 (tests/naos.test.mjs)
  OK pack de Brest (data/brest.* = 5e9b8a5)
git diff --quiet f80c365 -- js/courses.js tests/reference/ : 0
git diff --quiet 5e9b8a5 -- data/brest.* : 0
git diff --quiet 5e9b8a5 -- js/startmode.js js/racelock.js js/beeper.js js/wakelock.js : 0
compat-v42 (extraction 56f6625) : Compatibilité v42 : 8 contrôles OK
compat-v41 (extraction dda755b) : Compatibilité v41 : 7 contrôles OK
compat-v43 (extraction 5e9b8a5) : Bilan : 5/5 contrôle(s) OK ((e) 84 vues de Naos identiques octet pour octet)
PW_REQUIRED=1 node tools/regate-e2e.mjs (tous les scénarios, Chromium) :
  OK baie accueil jour-j deux-telephones reprise equipage archive archive-bouees archivehors creer manche auteur ic depuis-ic vraisemblance gel
  debrief-tardif gpx gpx-choix ia ia-erreurs arbitre bouees guide entetes retour-port banane banane-manche banane-debrief porte-ic modifier-manche
  toulon-vue plan-eau brest-avion regate-brest brest-courant gpen naos-cles tofinou-demarrage espace-garde tofinou-bateau tofinou-identite
  bormes-local tofinou-ia tofinou-ic tofinou-parcours
  Bilan : 46/46 scénario(s) OK  (premier passage : 45/46, tofinou-ic intermittent, voir écart n° 1)

Mesures d’ouverture hors réseau, CPU ×4, 5 ouvertures (avant la release ; rejouées après : 442 / 495 / 420 ms)
                      interface utile médiane / max   mode départ après   carte prête médiane   plus longue tâche
  Toulon              485 / 517 ms                    261 ms              3951 ms               490 ms
  Brest (pack 10 f.)  457 / 544 ms                    303 ms              5095 ms               1077 ms
  Bormes, Tofinou     424 / 573 ms                    307 ms              5839 ms               984 ms
  (Bormes : pack de 6 fichiers, 3 604 097 octets, bandeau « Entraînement libre · Bormes – Le Lavandou »)
PW_REQUIRED=1 node tools/audio-clock-check.mjs : écart maximal 5,4 ms (seuil 30 ms), manquants 0, en trop 0 — OK (tentative 1/3)

npm run release -- "espace Tofinou : rade de Bormes, Tofinou 9.5, Challenge de la Baie" : stamp écrit : v44 · 27/11 · dc6eb67f26 · 85 fichiers
npm run stamp : stamp écrit : v44 · 27/11 · dc6eb67f26 · 85 fichiers
RT_STRICT=1 node tools/stamp.mjs --check : stamp à jour (0)
VERCEL_ENV=production npm run gate : 0 (1031 tests, 1029 verts, 2 sautés, 0 échec)
Table TOFINOU de middleware.js : deux lignes (compte seul, rien affiché)
Aucune suite de 64 hexadécimaux dans les fichiers modifiés hors de middleware.js
python3 -I tools/snapshot_weather.py --venue bormes : « Daily API request limit exceeded » (refus, rien écrit)
```

## Accès (D-03, D-08)

Table TOFINOU vérifiée par un script qui n’imprime qu’un compte : deux lignes (Frédéric, copie de Romain). Le diff de `middleware.js` de ce plan est une seule ligne (`NOMS_PUBLICS` reçoit `/guide-tofinou.html`). Aucun code, empreinte ni clé dans le guide, l’aide, les tests, les commits ni ce résumé.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Scénario] tofinou-ic intermittent (horloge figée)**
- **Trouvé pendant :** série complète (45/46 au premier passage) : bouées X3 et X4 encore « à confirmer » dans le faux Blob.
- **Cause :** horloge des téléphones figée ; une copie envoyée par la synchronisation automatique entre deux confirmations portait la même date que la confirmation suivante, et le départage par contenu gardait l’ancienne valeur (même mécanisme que tofinou-parcours en 08-11). Sur un vrai téléphone, deux gestes n’ont jamais la même milliseconde.
- **Correction :** le scénario avance l’horloge d’une seconde avant chaque confirmation ; 4/4 isolé puis 46/46 deux fois. App inchangée. **Commit :** a4dad1f.

**2. [Rule 3 - Outil] Mesure d’ouverture de l’espace Tofinou absente**
- Option `--espace tofinou` ajoutée à `tools/measure-boot.mjs` comme le plan le prévoyait si elle manquait ; Toulon et Brest inchangés. **Commit :** 8ac677d.

**3. [Rule 2 - Exactitude] Libellé d’import du GPX**
- La consigne demandait « Importer un GPX » dans l’onglet Régates ; l’app n’a que « ⤓ Importer un fichier GPX » dans l’onglet Traces (la trace rangée apparaît ensuite dans la fiche de la régate). Le guide cite le vrai libellé (test : tout libellé en style touche existe dans le code).

**4. Tests d’accompagnement (hors liste du plan)** : tests/identite.test.mjs (l’aide de Tofinou ouvre guide-tofinou.html, pas guide.html ; l’aide de Naos n’en parle pas), tests/access.test.mjs et tests/entetes.test.mjs (page balayée, adresse servie par la liste blanche, ni script en ligne ni on…=).

### Interprétations
- Statut `awaiting-checkpoint` : la tâche 1 est faite et commitée ; ce résumé sera complété après la décision de Romain (tâche 2) et, sur « publie », la mise en production (tâche 3). Le compteur de plans de STATE.md n’est pas avancé et les exigences ne sont pas cochées (ESPACE-03, ESPACE-05, TOF-05 demandent l’aperçu et la production).

## Known Stubs

- `data/bormes.wx-snapshot.json` absent (Open-Meteo : limite quotidienne) : à la première ouverture hors réseau à Bormes sans prévision reçue, l’app affiche « Hors ligne » sans prévision de secours (WINDOWS n° 9, 16, 19). La v44 part sans, comme prévu par le plan.

## Restes connus (WINDOWS)

- n° 12 (aide de Tofinou : lien du guide et note de version) : corrigé par ce plan et la release.
- n° 17 (instantané de Brest) : non produit, décision de Romain (casserait la garde `data/brest.*`).
- n° 18 (« Parcours probables » plante à Brest pour un parcours lu dans les IC sans ligne, présent depuis la v43) : non corrigé (gel de Naos), décision de Romain.

## Ce qui reste (tâches 2 et 3)

1. Orchestrateur : (a) table TOFINOU à deux lignes, code de Frédéric dans aucun fichier ; (b) `npm run check` et `node tools/gardes-toulon.mjs` sur la tête ; (c) `git push origin apercu-phase-08` puis PR brouillon vers `main` (titre, corps sans code, lignes de fin) ; (d) Romain rattache `tofinou-bormes.vercel.app` à la branche, aperçu « Ready », contrôles distants (release n = 44 sur `origin/apercu-phase-08`, `main` inchangée, manifeste « Tofinou — Bormes »).
2. Contrôles humains de Romain sur l’aperçu (12 points de la tâche 1 du plan : Naos identique, installation et hors réseau de Tofinou, cloisonnement, Challenge, bateau réel, zones, bouées, vents, IA, « Changer d’espace », certificat ORC, régates d’essai supprimées).
3. Décision « publie » ou « attendre » (Romain lui-même) : production au plus tard le jeudi 10/12/2026, jamais du 11 au 13/12, sinon à partir du 14/12 ; puis tâche 3 (fusion par la PR, `sw.js` des deux adresses au hachage `dc6eb67f26`, domaine de Tofinou en Production, consignes (a) à (e)).

## Self-Check: PASSED

- FOUND : guide-tofinou.html, release.json (n = 44), 08-10-SUMMARY.md
- FOUND : 2ee1066, 8ac677d, 5e827bb, a4dad1f, 8078eba (ancêtres de HEAD) ; 5 commits mesurés entre plan_head_before et plan_head_after
- `git diff --quiet HEAD -- release.json js/version.js sw.js guide-tofinou.html js/help.js` : rien d’ouvert
- Rien poussé ; `origin/main` inchangée

## Tâches 2 et 3 : publication (orchestrateur, 27/11/2026)

- **Décision :** Romain a demandé la production (« Oui, et mets en production », puis « Publie tout et fais les modifications de Brest »).
- **v44 :** PR romaindetroyat/rade-tactique#18 fusionnée (0142dd1). Avant la fusion : `npm run check` 1029 verts / 2 sautés, gardes vertes, table TOFINOU à deux lignes (compte seul). En production : `sw.js` porte `dc6eb67f26` sur rade-tactique.vercel.app et tofinou-bormes.vercel.app ; manifestes « Rade Tactique — Toulon » et « Tofinou — Bormes » ; sans code 401 ; Frédéric : 200 sur Tofinou, 401 sur Naos, pack de Brest 404, pack de Bormes 200 ; Romain : `espaces` naos + tofinou sur les deux adresses.
- **v45 :** PR romaindetroyat/rade-tactique#19 fusionnée (5ce8222). Instantanés météo de Bormes et de Brest (Open-Meteo a répondu le 27/11) ; celui de Brest admis dans le gel de Naos comme seul ajout au pack de Brest (`differencesAdmises('brest')`, garde git avec `:!data/brest.wx-snapshot.json`) ; `rankCourses` : repli sur la première ligne du plan d’eau (WINDOWS n° 18). `npm run check` 1032/1032, gardes vertes, 10 scénarios Chromium, porte de production verte. En production : `ca298965e8` sur les deux adresses, instantanés servis aux bons espaces.
- **Contrôles humains restants :** voile d’avant et quille, positions des bouées et ligne du milieu de la baie, PCS/BAG, côté de la banane n° 4, conseils de vent de Bormes, contour du Levant et Brégançon contre les arrêtés, accord sur le certificat ORC ; vraies IC de Frédéric et vraie question à l’arbitre de Tofinou.

