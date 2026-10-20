---
phase: 05-avant-la-regate
verified: 2026-10-20T00:00:00Z
status: passed
score: "3/4 critères de la feuille de route vérifiés dans le code et en production ; le 3e attend le geste de Romain (plafond OpenAI)"
covered_files:
  - ".planning/phases/05-avant-la-regate/05-01-PLAN.md"
  - ".planning/phases/05-avant-la-regate/05-01-SUMMARY.md"
  - ".planning/phases/05-avant-la-regate/05-02-PLAN.md"
  - ".planning/phases/05-avant-la-regate/05-02-SUMMARY.md"
  - ".planning/phases/05-avant-la-regate/05-03-PLAN.md"
  - ".planning/phases/05-avant-la-regate/05-03-SUMMARY.md"
  - "api/_ia.js"
  - "api/debrief.js"
  - "api/ic.js"
  - "api/rules.js"
  - "api/voice.js"
  - "docs/ia-budget.md"
  - "guide.html"
  - "js/app.js"
  - "js/attach.js"
  - "js/debrief.js"
  - "js/icread.js"
  - "js/reprise.js"
  - "js/track.js"
  - "regles.html"
  - "tests/apiia.test.mjs"
  - "tests/reprise.test.mjs"
covered_digest: "v3:sha256:19c2cc1486a39a79986b47edd1c86557077a037c1d946e4946a959066b361aa1"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "Plafond de dépense OpenAI : poser 10 $ par mois avec « Enforce a hard limit » sur le projet OpenAI dont la clé est dans OPENAI_API_KEY de Vercel (geste guidé dans docs/ia-budget.md)"
    expected: "L'écran Limits du projet affiche 10 $ avec la limite stricte activée"
    why_human: "Réglage du tableau de bord OpenAI, hors de portée du code et de cet environnement ; sans la limite stricte, le plafond ne coupe rien (critère 3)"
  - test: "Quatre appels d'IA réels sur la production (une dictée, un débrief, une question à l'arbitre, une lecture d'IC d'un autre club)"
    expected: "Quatre réponses normales, aucune erreur 500 (confirme que `store: false` est accepté par OpenAI avec le schéma strict)"
    why_human: "Les tests injectent un faux client OpenAI ; seul un vrai appel prouve l'acceptation de `store: false` par l'API (critère 2)"
  - test: "Premier lancement de la v32 sur un iPhone qui a de vieilles traces, hors verrou de course"
    expected: "La trace de la Coupe SNPM apparaît une seule fois dans sa fiche, toast « N traces rangées dans l'archive », ligne `reprise` au Journal, puis la même trace chez les autres téléphones après synchronisation (critère 1)"
    why_human: "Base IndexedDB réelle d'un iPhone, WebKit, et deux téléphones réels ; les scénarios Chromium utilisent un faux magasin partagé"
  - test: "Usage du magasin Blob avant et après le week-end du 7-9 novembre (Vercel, Observability, Blob)"
    expected: "Au plus 40 % du quota Hobby (2 000 opérations avancées par mois) pour l'IA seule ; estimation 900 à 1 100 au total avec l'archive"
    why_human: "Mesure sur le tableau de bord Vercel après usage réel"
  - test: "Compteur à 30 sur la production : 31e question à l'arbitre ; mode avion sur la fiche Coupe SNPM ; trace enregistrée un jour de régate"
    expected: "« Limite d'IA du jour atteinte — reprise demain » ; fiche, trace et débrief lisibles hors réseau ; « Trace enregistrée (N points) · rangée dans <régate> »"
    why_human: "Comportement sur appareil et sur le vrai Blob de production"
  - test: "Variables Vercel : OPENAI_API_KEY et BLOB_READ_WRITE_TOKEN (ou identifiant du magasin) présentes pour Production et Preview"
    expected: "Les deux existent ; sans le jeton Blob le compteur de 30 est ouvert (l'IA passe sans être comptée)"
    why_human: "Le tableau de bord Vercel n'est pas lisible ici ; les valeurs ne doivent jamais être lues"
---

# Phase 5 : Avant la régate : archive amorcée et IA bornée — Rapport de vérification

**Objectif de la phase :** avant le gel du 2 novembre, l'archive partagée contient déjà la Coupe SNPM et ce que chaque téléphone avait gardé, et l'IA de l'app ne peut ni coûter plus que prévu ni conserver les données de l'équipage.
**Vérifié :** 2026-10-20, sur la branche `apercu-phase-05` (HEAD c2a07f4, qui contient la fusion 3a4fa38 de la v32)
**Statut :** human_needed (aucun écart dans le code ; il reste des gestes et des mesures qui ne peuvent venir que de Romain)
**Re-vérification :** non, première vérification

## Méthode

Les résumés (SUMMARY) n'ont pas été pris pour preuve : le code, les tests et la production ont été relus et rejoués.

| Contrôle | Commande | Résultat |
|----------|----------|----------|
| Porte locale | `npm run check` | 534 tests, 534 réussis, 0 échec ; « stamp à jour » |
| Porte de production | `VERCEL_ENV=production npm run gate` | sortie 0, 534 réussis (leçon de la v31 respectée) |
| Référence SNPM intacte | `git diff --quiet f80c365 -- js/courses.js tests/reference/` | sortie 0 : aucun octet changé |
| Scénarios navigateur | `PW_REQUIRED=1 node tools/regate-e2e.mjs reprise gpx archive equipage ia ia-erreurs arbitre` | 7 scénarios sur 7 OK (Chromium réel, obligatoire) |
| Production | `curl` sur `sw.js`, `/api/archive`, `/api/rules`, `/data/meta.json`, `/acces.html` | `sw.js` : `"n":32`, `"id":"855e0d07cb"` ; sans code : 401, 401, 401, et 200 pour `acces.html` |

## Critères de la feuille de route

| # | Critère | Statut | Preuve |
|---|---------|--------|--------|
| 1 | Coupe SNPM, fiches, traces et débriefs déjà présents rangés comme régates de l'archive, une seule fois même sur deux téléphones, référence SNPM intacte | VERIFIE (code, tests, Chromium) ; confirmation iPhone en attente | Voir ci-dessous |
| 2 | Les quatre fonctions d'IA envoient `store: false` ; plafond par équipier et par jour avec message clair | VERIFIE (code et tests) ; appels réels en attente | Voir ci-dessous |
| 3 | Plafond de dépense posé côté OpenAI par Romain (geste guidé) ; app utilisable sans l'IA | PARTIEL : geste guidé livré et repli sans IA vérifié ; le plafond lui-même n'est posé que par Romain | `docs/ia-budget.md`, `05-USER-SETUP.md` |
| 4 | v32 sur l'aperçu, vérifiée, puis en production sur décision de Romain avant le 2 novembre | VERIFIE | `sw.js` public v32 `855e0d07cb` ; PR n°6 fusionnée en 3a4fa38 sur « publie » de Romain, le 20/10, avant le gel |

### Critère 1 : archive amorcée

- `js/reprise.js` (45 lignes, pur, dépendances injectées) : `runReprise` s'arrête avant la liste et entre deux traces si une course est active ou le verrou de journée posé (D-03) ; ne range que si `matchRegattas` rend `unique` ou `heure` (D-01, D-02), sans jamais appeler d'invite ni créer de régate ; saute une trace déjà référencée (`refs`) ou déjà rangée par un autre téléphone (`sameTrack` sur les traces de la régate, D-10) ; une trace illisible est consignée sans arrêter les autres.
- Identifiant stable (D-10) : `canonicalTraceId` est défini une seule fois dans `js/track.js` et utilisé par `fromGPX` et par `reprise.js` ; le nouvel enregistrement est écrit avant la suppression de l'ancien, et un passage interrompu se rejoue sans perte.
- Rapport annoncé (D-11) : `setTraceReport(next, tr.id, { t, by })` quand `tr.report.t` est un nombre.
- Câblage dans `js/app.js` : drapeau `rade.reprise.v1` lu avant tout `import('./reprise.js')`, posé seulement si la boucle est allée au bout (ni reportée, ni base illisible) ; appelé à 1,5 s après le lancement, à la fin d'une course et à la levée du verrou ; ligne `reprise` au journal ; toast « N traces rangées dans l'archive ». `save` passe par `saveReg(upsertRegatta(REG, r))`, donc l'envoi suit le chemin lourd de la phase 4 sans nouveau code d'envoi.
- Trace enregistrée dans l'app (D-09) : `rangeEnregistree(tr)` appelle `rangeTrace(tr, { invite: false })` depuis `stopGps()` et `#recStop`, avec le suffixe « · rangée dans <régate> » ; une erreur ne fait jamais perdre le message d'arrêt.
- La Coupe SNPM et les fiches étaient déjà amorcées par `migrate()` / `SEED_ID` (phase 4) ; la référence de calcul n'a pas bougé (`git diff` à 0).
- Preuves d'exécution : `tests/reprise.test.mjs` (279 lignes, dans les 534 tests) et le scénario Chromium `reprise` (un téléphone, puis deux téléphones sur un faux Blob partagé : une référence, un seul envoi).

### Critère 2 : IA bornée

- `api/_ia.js` pose `store: false` après les paramètres (`{ ...params, store: false }`) : aucune fonction ne peut l'écraser. Une recherche de `responses.create` dans `api/` et `js/` ne trouve que `_ia.js` ; un test de garde statique l'exige.
- Les quatre fonctions (`voice.js`, `debrief.js`, `rules.js`, `ic.js`) passent par `createIA` : `ia.garde(req, res)` (prénom du seul en-tête `x-rt-membre`, 403 sans prénom, quota) puis `ia.appelle(...)`, et `ia.repond(res, err)` pour les erreurs.
- Quota : 30 appels par équipier et par jour de Paris, un blob par équipier et par jour (`<prod|preview>/quota/<jour>/<prénom>.json`), lecture puis écriture `ifMatch`, relecture une fois en cas de conflit, jamais de `list` ; le 31e reçoit 429 `quota_equipier` avec « Limite d'IA du jour atteinte — reprise demain », sans appel à OpenAI ni écriture de plus. Compteur en panne ou plus lent que 2 s : l'appel passe et un avertissement sans prénom est écrit (D-06). Les tests couvrent la simultanéité, le changement de jour à minuit de Paris, le préfixe prod/preview et la parité avec `api/archive.js`.
- Erreurs d'OpenAI : les cinq codes de budget donnent 429 `budget_ia` (« Budget d'IA du mois atteint — l'IA reprend le mois prochain »), les autres 429 donnent `ia_occupee`, 401/403 d'OpenAI deviennent 502 pour ne pas faire croire à un accès perdu.
- Messages à l'écran : `js/app.js` (dictée, avec repli sur l'analyse locale), `js/debrief.js` (repli sur la rédaction automatique), `js/icread.js` (relecture à la main), `regles.html` (arbitre, message du serveur affiché par `textContent`, borné). Le guide (`guide.html`) dit « OpenAI ne garde pas les réponses » et signale la surveillance des abus jusqu'à 30 jours, jamais « ne conserve rien » (précision de D-05 respectée).
- Scénarios Chromium `ia`, `ia-erreurs` et `arbitre` : OK.

### Critère 3 : plafond OpenAI

- `docs/ia-budget.md` donne le geste pas à pas (Project settings, Limits, Spend, 10 $, « Enforce a hard limit », sauvegarde, vérification, preuve de coupure facultative), ce que fait la coupure, ce que garantit `store: false` et ce qu'il ne garantit pas, le coût Blob, et le tableau « Sans l'IA ». `05-USER-SETUP.md` reprend les gestes restants.
- L'app reste utilisable sans l'IA : dictée analysée sur le téléphone, débrief rédigé automatiquement, relecture d'IC à la main, fiches de règles lisibles (code relu aux quatre écrans).
- **Non vérifiable ici :** que Romain ait effectivement posé la limite stricte. Ce n'est ni un échec ni un écart de code ; c'est la première ligne des vérifications humaines.

### Critère 4 : livraison

- La v32 est servie en production (`"n":32`, `"id":"855e0d07cb"`), la fusion 3a4fa38 est postérieure à la décision « publie » de Romain, les routes privées répondent 401 sans code d'accès, `acces.html` répond 200. La porte a été rejouée en `VERCEL_ENV=production` et passe.

## Exigences

| Exigence | Plan | Statut | Remarque |
|----------|------|--------|----------|
| ARCH2-01 | 05-01 | SATISFAITE dans le code | Confirmation sur iPhone réel en attente (vérification humaine 3) |
| SECU2-01 | 05-02, 05-03 | SATISFAITE dans le code | Plafond OpenAI et appels réels en attente (vérifications humaines 1 et 2) ; case cochée dans REQUIREMENTS.md, alors que le plafond reste à poser par Romain, comme l'indique la note de bas de page de ce fichier |

Aucune exigence orpheline : REQUIREMENTS.md n'attribue à la phase 5 que ARCH2-01 et SECU2-01, toutes deux réclamées par un plan.

## Motifs suspects (anti-patterns)

Aucun marqueur TBD, FIXME ou XXX dans les fichiers de la phase. Aucun stub : les quatre handlers appellent bien `ia.garde` avant `ia.appelle`. Le compteur est volontairement ouvert en cas de panne (décision D-06 documentée, le plafond OpenAI reste le filet) : c'est un choix, pas un défaut.

## Points d'attention (sans effet sur le statut)

- Le plafond théorique du compteur (3 équipiers x 30 appels x 30 jours) dépasserait le quota Blob Hobby ; le plan l'avait retenu comme irréaliste et prévoit de mesurer l'usage après la régate (vérification humaine 4).
- `REQUIREMENTS.md` coche SECU2-01 avant que le plafond OpenAI soit posé : à garder en tête tant que `05-USER-SETUP.md` est « Incomplet ».
- « Tester le son » sur iPhone (hors du périmètre direct de la phase) figure dans `05-USER-SETUP.md`.

## Vérifications humaines requises

1. **Plafond OpenAI 10 $ à limite stricte** : à poser par Romain, geste dans `docs/ia-budget.md`.
2. **Quatre appels d'IA réels** sur la production : confirme `store: false` avec le schéma strict, aucune erreur 500.
3. **Premier lancement de la v32 sur un iPhone avec de vieilles traces** : la Coupe SNPM rangée une seule fois, toast et ligne `reprise` au Journal, puis visible chez les autres téléphones.
4. **Usage du magasin Blob** avant et après le 7-9 novembre (au plus 40 % du quota pour l'IA seule).
5. **Compteur à 30, mode avion, trace un jour de régate** sur appareil.
6. **Variables Vercel** `OPENAI_API_KEY` et `BLOB_READ_WRITE_TOKEN` présentes en Production et Preview (sans le jeton, le compteur est ouvert).

## Synthèse

Le but de la phase est atteint dans le code et en production : le rattrapage des traces est idempotent, sans question, sans régate créée, bloqué pendant la course et le verrou, et la référence SNPM n'a pas bougé ; les quatre fonctions d'IA passent par un seul point qui impose `store: false`, le quota de 30 par équipier et par jour, et des messages français avec repli sans IA. La porte de production et sept scénarios Chromium passent. Seuls restent les gestes et mesures qui exigent Romain ou de vrais appareils, d'où le statut `human_needed`.

---

_Vérifié : 2026-10-20_
_Vérificateur : Claude (gsd-verifier)_
