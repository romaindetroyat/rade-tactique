---
phase: quick-261022-acc
plan: 01
subsystem: regates
tags: [pwa, regates, entrainement-libre, archive-partagee, guide]
requires: [ARCH-01, ARCH-02, REG-01, FIAB-01, FIAB-06]
provides: [regate-ouverte-etat-local, ouverture-jour-j, liste-par-statut, bandeau-regBar]
affects: [js/regates.js, js/regview.js, js/archsync.js, js/app.js, index.html, styles.css, guide.html, js/help.js]
key-files:
  created: []
  modified: [js/regates.js, js/regview.js, js/archsync.js, js/app.js, index.html, styles.css, guide.html, js/help.js, tests/regates.test.mjs, tests/archsync.test.mjs, tests/apiarchive.test.mjs, tests/boot.test.mjs, tests/guide.test.mjs, tools/regate-e2e.mjs, sw.js, js/version.js, release.json]
decisions:
  - "La régate ouverte est une variable de module OPEN dans js/app.js, jamais écrite (ni index, ni document partagé), changée par setOpen seulement"
  - "Index d’avant (v36) réécrit une fois sans current : la Coupe SNPM reste dans Terminées"
  - "lockDates ne lit que la liste ; le gel suit la régate du jour de la liste, l’ouverte ne départage que deux régates du même jour"
status: complete
metrics:
  tasks: 3
  commits: 4
  plan_head_before: 97b290ae0e4ce4c7cb3d416e52dc7b43036bc180
  plan_head_after: b072a509ec976b356a6015169a01c94047c823ed
actuals:
  tokens: 54000
  tasks: 3
  commits: 4
completed: 2026-10-22
---

# Quick 261022-acc : accueil hors régate (v37)

L’app s’ouvre en « Entraînement libre » ; une régate s’ouvre et se ferme d’un geste depuis l’onglet Régates (En préparation, En cours, Terminées) ; le jour J elle s’ouvre seule ; l’état « régate ouverte » reste local à la page et ne voyage jamais. v37 poussée sur `apercu-phase-05`.

## Décisions P-01 à P-08 (appliquées comme planifiées)

- **P-01** : `OPEN` (js/app.js) en mémoire seulement ; `setOpen` est le seul point d’écriture (ni `saveReg`, ni synchronisation) ; `migrate` oublie `current` et réécrit un index v36 une seule fois ; `upsertRegatta`/`removeRegatta` ne touchent plus qu’à la liste ; `setCurrent`/`currentRegatta` supprimés au profit de `openRegatta(list, id)` sans repli ; `applyDoc` ne pose que `list` et `tomb` ; `#regBar[data-open]` est l’observable des scénarios.
- **P-02** : `openAtBoot` au chargement du module ; `openOnNewDay` appliquée par `dayOpenTick` (ligne séparée de `raceTick`) hors course et hors saisie.
- **P-03** : `lockDates({ now, list })` (liste seule, équivalence avec la v36 prouvée sur 29 jours × toutes les courantes) ; `freezeTick` sur `todayRegatta(… currentId: OPEN)` ; rattachement des traces inchangé (liste).
- **P-04** : `icOf(null)` en entraînement libre ; carte `#rgNone` à la place de la fiche et de la carte IC ; Points clés et « Supprimer cette régate » seulement avec une régate ouverte.
- **P-05** : bandeau `#regBar` (textContent seulement), boutons `#regGo` « Ouvrir une régate » et `#regClose` « Fermer la régate » ; toasts « Régate ouverte : … », « Retour à l’entraînement libre », « Jour de régate : … ouverte ».
- **P-06** : `groupByStatus`, `GROUP_LABEL`, `STATUS_LABEL` = En préparation / En cours / Terminée.
- **P-07**, **P-08** : tests Node + scénarios Chromium ; aucun changement de format, aucune nouvelle clé de stockage.

## Commits

| Tâche | Hash | Contenu |
|-------|------|---------|
| 1 (traceuse) | 68639bd | modèle, page, vue, bandeau, scénario `accueil`, tests Node |
| 2 | a793e99 | scénarios `jour-j`, `deux-telephones`, scénarios existants à jour, garde `dayOpenTick` |
| 3 | 7534d9a | guide.html, aide intégrée, tests/guide.test.mjs |
| livraison | b072a50 | version 37 (release.json, sw.js, js/version.js) |

Branche `apercu-phase-05` poussée (97b290a..b072a50). `main` non touchée. Version : v37, hachage de contenu `488f1a8a0b`.

## Vérifications

- `npm run check` : 580 tests, 0 échec. `RT_STRICT=1 node tools/stamp.mjs --check` et `VERCEL_ENV=production npm run gate` verts.
- `PW_REQUIRED=1 node tools/regate-e2e.mjs` : **Bilan 25/25** (accueil, jour-j, deux-telephones et gpx compris), sans violation CSP ni chemin refusé.
- `PW_REQUIRED=1 node tools/measure-boot.mjs 4 5` : RÉSULTAT OK, médiane de l’interface utile **663 ms** (maximum 755 ms), hors réseau, CPU ×4.
- `git diff --quiet f80c365 -- js/courses.js tests/reference/` : 0 avant et après la version.
- Scénario `accueil` : bandeau visible et dans la fenêtre aux trois hauteurs du panneau, régate ouverte ou non.

## Scénarios Chromium : ouvertures explicites ajoutées

- **ic** : après le rechargement final, la régate (ramenée au 18/10 par ses IC) est passée, donc l’app repart en entraînement libre ; ajout d’une assertion « entraînement libre » puis `ouvreRegate` avant de relire les IC.
- **gpx** : « Entraînement libre » au lancement et après l’import (la trace est rangée dans la Coupe SNPM sans l’ouvrir) ; `ouvreRegate('snpm-2026')` avant la fiche, la ligne de trace, le débrief ; « Fermer la régate » à la fin (`#rgNone`).
- **gpx-choix** (partie 2) : `ouvreRegate('nov')` avant l’import, puis contrôle que la régate ouverte reste `nov` (remplace la lecture de `current`).
- **archive** : `ouvreLigne` (bouton « Ouvrir » de la ligne) pour A et B avant d’ajouter une manche à la régate partagée.
- **archive-bouees** : `ouvreLigne` de la régate historique chez B.
- **archivehors** : `ouvreRegate('snpm-2026')` chez A (avant de lire la trace rangée), chez B (réseau coupé) et chez C ; `ouvreLigne` de « Coupe du gel » chez B2 ; attente sur la régate ouverte lue par `#regBar[data-open]`.
- **equipage** : `ouvreLigne` chez B, A, C avant d’ajouter ou de lire les manches ; `ouvreLigne` de la Coupe SNPM chez C.
- **bouees** : après la relance, l’app est en entraînement libre (parcours 3, aucune bouée de régate) ; `ouvreRegate(idPremiere)` retrouve les bouées confirmées et le parcours 101, qu’on rechoisit. Voir Écarts.
- **depuis-ic** : l’index vide devient `{ v: 1, list: [] }` ; après relance, entraînement libre (régate terminée).
- **creer** : statuts En cours puis Terminées, nouvelle régate ouverte, reprise ouverte seule le jour J, le 10/11 tout en Terminées et entraînement libre.

Lectures de la régate ouverte déplacées vers `#regBar` (`regateOuverte`, `idOuverte`) : **manche** (régate créée, `sel = 2`), **auteur**, **ic**, **vraisemblance**, **gel**, **debrief-tardif**, **ia**, **ia-erreurs**, **bouees**, **archivehors** (condition d’attente sur `traces[0]`), **creer**, **gpx-choix** et **depuis-ic**. Le helper `lireListe` lit maintenant `.rggroup` ; `noms()` suit cette forme ; `sème()` n’écrit plus `current`.

Aucune assertion n’a été retirée ou relâchée. Remplacements assumés : « une seule saison » devient « l’année reste lisible dans la ligne » (le classement par saison disparaît, D-A2) ; « la régate courante ne change pas » devient « la régate ouverte ne change pas » après ouverture explicite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloquant] Hauteur du panneau réduit**
- **Trouvé pendant :** tâche 1 (scénario accueil, trois hauteurs)
- **Problème :** à 390 × 844 le bandeau sortait de la fenêtre dans `#panel.min` (96 px)
- **Correction :** `#panel.min` à 136 px (+ zone de sécurité) ; `#legend` et `#replayHud` repliés remontés de 104 à 144 px, comme le prévoyait le plan (action 4)
- **Fichiers :** styles.css · **Commit :** 68639bd

**2. [Rule 1 - Bug] Ordre des messages à l’ouverture d’une régate**
- **Trouvé pendant :** tâche 2 (relecture de `create` / `bouees`)
- **Problème :** « Régate ouverte : … » aurait écrasé le message plus important « parcours … retiré » émis par `afterRegChange`
- **Correction :** le message d’ouverture (et « Jour de régate ») précède `afterRegChange`, comme le faisait déjà la création
- **Fichiers :** js/app.js · **Commit :** a793e99

### Écarts de forme par rapport au plan

- **Découpage des tâches 1 et 2.** `lockDates` sur la liste, `openOnNewDay`, `dayOpenTick` et le câblage de `freezeTick`/`raceLock` ont été écrits avec la tâche 1 (même fichiers, même raisonnement) ; la tâche 2 porte les scénarios, les tests de document et de magasin et la garde de `boot.test.mjs`. Les tests de `lockDates` et de passage de jour sont dans la tâche 1.
- **Scénario `bouees`** : l’assertion « le parcours choisi survit à la relance » (101) ne peut plus tenir, par décision D-A1/D-A4 (P-04 : un parcours de régate choisi revient au parcours 3 quand la régate n’est pas ouverte). Elle est remplacée par : retour au 3 sans régate, puis bouées confirmées et parcours 101 retrouvés à « Ouvrir », parcours rechoisi, et analyse sur X1/X2.
- **`scénario deux-telephones`** : le corps des PUT est relevé dans `telephoneArchive` (`m.puts`), sans changer les scénarios existants.

## Auth gates

Aucune.

## Known Stubs

Aucun.

## Threat Flags

Aucun. Les menaces T-261022-01 à -07 sont couvertes (tests de document et de magasin, PUT portant `current` accepté puis rendu sans, `#regBar` en textContent, équivalence du verrou, `jour-j` (2) et (4), journal `note('regate', …)` sans nom, measure-boot).

## Contrôles restants sur iPhone (après « publie »)

1. Ouverture hors réseau en « Entraînement libre », avec la Coupe SNPM dans « Terminées ».
2. « Ouvrir » puis « Fermer la régate » : nom en tête du panneau sur tous les onglets, bandeau lisible dans les trois hauteurs (zone de sécurité du bas comprise).
3. Un autre téléphone reste inchangé quand on ouvre ou ferme une régate.
4. Téléphone encore en v36 qui se synchronise avec un téléphone en v37, sans erreur.
5. Le jour J (7 au 9 novembre) : la régate s’ouvre au lancement sans geste ; app laissée ouverte la veille au soir : elle s’ouvre à minuit, jamais pendant un chrono.
6. « Course finie » et mise à jour différée inchangés après « Fermer la régate » un jour de régate.
7. Règle des 48 h : régate des 7-9 novembre, gel de la production le 2 novembre.

## Self-Check: PASSED

- Commits 68639bd, a793e99, 7534d9a, b072a50 présents dans l’historique de `apercu-phase-05` et poussés.
- js/regates.js, js/regview.js, js/archsync.js, js/app.js, index.html, styles.css, guide.html, js/help.js, tools/regate-e2e.mjs, release.json présents ; `#regBar` dans index.html entre `#tabs` et `#content`.
- Référence SNPM (`js/courses.js`, `tests/reference/`) inchangée depuis f80c365.
