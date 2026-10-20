# Éléments différés de la phase 4

Découverts pendant l'exécution, hors du périmètre du plan qui les a vus ; non corrigés.

## 04-04 : scénario `gel`, étape 3, échec intermittent

- **Vu :** une fois sur environ six exécutions, `PW_REQUIRED=1 node tools/regate-e2e.mjs gel` (ou `archivehors gel`) échoue à l'étape 3 : « copie marquée tardive — obtenu false, attendu true » (`tools/regate-e2e.mjs`, `gel`, étape « première ouverture après le signal »). Les exécutions suivantes passent (3/3 seul, 2/2 avec `archivehors`, 16/16 en suite complète).
- **Cause probable :** l'étape appelle `attendGel(p2, '2026-10-18', () => true, …)`, qui rend la PREMIÈRE copie vue. Si un tic de gel tombe entre la création de la régate et l'ajout de la manche de 10:55, la première copie est faite avec « signal inconnu » (jamais « tardive ») ; la condition devrait être `(x) => x.signal === 'manche'`, comme à l'étape 1. Charge de la machine (les tests tournaient juste après `npm run check`) : le créneau s'élargit.
- **Pourquoi différé :** le code du gel n'a pas changé dans ce plan (seul un marqueur d'envoi `SYNC.hq` est posé après l'écriture des copies) ; la fragilité semble venir du scénario lui-même (non vérifié sur le commit d'avant le plan 04-04).
- **Piste :** changer la condition de l'étape 3 en `(x) => x.signal === 'manche'` (une ligne).
