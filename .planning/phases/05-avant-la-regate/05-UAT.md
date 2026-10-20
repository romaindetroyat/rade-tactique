---
status: complete
phase: 05-avant-la-regate
source: [05-VERIFICATION.md]
started: 2026-10-20T10:05:00Z
updated: 2026-10-20T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Plafond OpenAI de 10 $ par mois avec « Enforce a hard limit »
expected: L'écran Limits du projet affiche 10 $ par mois, limite stricte cochée (geste dans docs/ia-budget.md).
result: pass — confirmé par Romain le 2026-10-20 (« tout est bon »)

### 2. Quatre appels d'IA réels en production
expected: Une dictée, un débrief, une question à l'arbitre et une lecture d'IC d'un autre club répondent normalement, sans erreur 500.
result: pass — confirmé par Romain le 2026-10-20 (« tout est bon ») — arbitre vérifié le 2026-10-20 par un appel réel en production (HTTP 200 en 10 s, règles 10 et 16.1 citées et vérifiées mot pour mot) : `store: false` est accepté avec le schéma strict et `api/_ia.js` est bien embarqué. Dictée, débrief et lecture d'IC confirmés ensuite par Romain.

### 3. Premier lancement de la v32 sur un iPhone qui a de vieilles traces
expected: Hors course, la Coupe SNPM n'apparaît qu'une fois dans sa fiche, avec le message de rangement et la ligne `reprise` au Journal, puis chez les autres téléphones après synchronisation.
result: pass — confirmé par Romain le 2026-10-20 (« tout est bon »)

### 4. Variables Vercel
expected: `OPENAI_API_KEY` et le jeton Blob existent en Production et en Preview (noms seulement).
result: pass — confirmé par Romain le 2026-10-20 (« tout est bon »)

### 5. Essais sur appareil
expected: La 31e question à l'arbitre affiche « Limite d’IA du jour atteinte — reprise demain » ; la Coupe SNPM est lisible en mode avion ; une trace enregistrée un jour de régate se range à l'arrêt.
result: pass — confirmé par Romain le 2026-10-20 (« tout est bon »)

### 6. Usage Blob avant et après le 7-9 novembre
expected: L'usage reste nettement sous le quota Hobby ; l'IA seule reste sous 40 %.
result: skipped — à relever après la régate du 7-9 novembre (aucune donnée avant)

## Summary

total: 6
passed: 5
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
