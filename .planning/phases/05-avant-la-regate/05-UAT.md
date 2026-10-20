---
status: testing
phase: 05-avant-la-regate
source: [05-VERIFICATION.md]
started: 2026-10-20T10:05:00Z
updated: 2026-10-20T10:05:00Z
---

## Current Test

number: 1
name: Plafond OpenAI de 10 $ par mois avec « Enforce a hard limit »
expected: |
  L'écran Limits du projet OpenAI qui porte la clé de Vercel affiche 10 $ par mois avec la limite stricte cochée.
awaiting: user response

## Tests

### 1. Plafond OpenAI de 10 $ par mois avec « Enforce a hard limit »
expected: L'écran Limits du projet affiche 10 $ par mois, limite stricte cochée (geste dans docs/ia-budget.md).
result: [pending]

### 2. Quatre appels d'IA réels en production
expected: Une dictée, un débrief, une question à l'arbitre et une lecture d'IC d'un autre club répondent normalement, sans erreur 500.
result: [pending]

### 3. Premier lancement de la v32 sur un iPhone qui a de vieilles traces
expected: Hors course, la Coupe SNPM n'apparaît qu'une fois dans sa fiche, avec le message de rangement et la ligne `reprise` au Journal, puis chez les autres téléphones après synchronisation.
result: [pending]

### 4. Variables Vercel
expected: `OPENAI_API_KEY` et le jeton Blob existent en Production et en Preview (noms seulement).
result: [pending]

### 5. Essais sur appareil
expected: La 31e question à l'arbitre affiche « Limite d’IA du jour atteinte — reprise demain » ; la Coupe SNPM est lisible en mode avion ; une trace enregistrée un jour de régate se range à l'arrêt.
result: [pending]

### 6. Usage Blob avant et après le 7-9 novembre
expected: L'usage reste nettement sous le quota Hobby ; l'IA seule reste sous 40 %.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
