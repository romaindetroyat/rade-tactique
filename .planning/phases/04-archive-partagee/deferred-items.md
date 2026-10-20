# Éléments différés de la phase 4

Découverts pendant l'exécution, hors du périmètre du plan qui les a vus ; non corrigés.

## 04-04 : scénario `gel`, étape 3, échec intermittent

- **Vu :** une fois sur environ six exécutions, `PW_REQUIRED=1 node tools/regate-e2e.mjs gel` (ou `archivehors gel`) échoue à l'étape 3 : « copie marquée tardive — obtenu false, attendu true » (`tools/regate-e2e.mjs`, `gel`, étape « première ouverture après le signal »). Les exécutions suivantes passent (3/3 seul, 2/2 avec `archivehors`, 16/16 en suite complète).
- **Cause probable :** l'étape appelle `attendGel(p2, '2026-10-18', () => true, …)`, qui rend la PREMIÈRE copie vue. Si un tic de gel tombe entre la création de la régate et l'ajout de la manche de 10:55, la première copie est faite avec « signal inconnu » (jamais « tardive ») ; la condition devrait être `(x) => x.signal === 'manche'`, comme à l'étape 1. Charge de la machine (les tests tournaient juste après `npm run check`) : le créneau s'élargit.
- **Pourquoi différé :** le code du gel n'a pas changé dans ce plan (seul un marqueur d'envoi `SYNC.hq` est posé après l'écriture des copies) ; la fragilité semble venir du scénario lui-même (non vérifié sur le commit d'avant le plan 04-04).
- **Piste :** changer la condition de l'étape 3 en `(x) => x.signal === 'manche'` (une ligne).

### Résolu au plan 04-05

La piste ci-dessus (condition `x.signal === 'manche'`) ne suffisait pas : la suite complète a encore échoué une fois sur six à la même étape. Vraie cause : la régate était créée par l'interface, puis la manche ajoutée ; si un tic de gel tombait entre les deux, la première copie (« signal inconnu ») existait déjà, et l'ajout de la manche, après l'heure du signal, produisait un « sceau » (jamais « tardive »). Corrigé dans le scénario : la régate et sa manche de 10:55 sont posées dans le stockage avant l'ouverture de l'app, la première copie est donc toujours « tardive » (déterministe).

Ce correctif a révélé un vrai défaut d'affichage, ancien (phase 2) : un gel tombé alors que l'onglet Régates n'était pas affiché ne redessinait pas la fiche, qui disait « Pas encore figé » à l'ouverture de l'onglet jusqu'au prochain redessin. Corrigé dans `js/app.js` (drapeau `icStale`, redessin unique à l'ouverture de l'onglet) avec une garde dans `tests/regates.test.mjs`.

## 04-05 : observation, non corrigée

- **Un « sceau » pris après l'heure du signal** : si une manche est ajoutée à une régate déjà copiée dans la journée (signal « inconnu ») après l'heure de cette manche, la copie faite à cet instant est scellée « au signal de HH:MM » sans être marquée « tardive », alors que les données datent de maintenant. Cas rare (manche saisie après son départ) ; la sémantique du gel (phase 2) n'est pas touchée par ce plan.
- **Module d'échange chargé réseau coupé** : un téléphone qui n'a jamais synchronisé et passe hors réseau avant la première synchronisation ne peut pas charger `js/archsync.js` (échec d'`import()` gardé par Chromium jusqu'au rechargement). Sans effet en vrai : le service worker précharge ces modules (liste `SHELL`). Le scénario `equipage` fait donc synchroniser chaque téléphone une fois en ligne avant de le couper (l'outil bloque le service worker).
