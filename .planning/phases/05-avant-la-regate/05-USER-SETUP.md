# Phase 5 : gestes humains restants

**Généré :** 2026-10-20
**Phase :** 05-avant-la-regate (Avant la régate : archive amorcée et IA bornée)
**Statut :** Incomplet

La v32 est en production depuis le 2026-10-20 (fusion 3a4fa38, `sw.js` public au hachage `855e0d07cb`). Ce qui suit demande un accès que le code n'a pas : tableau de bord OpenAI, tableau de bord Vercel, vrais iPhone. Aucune valeur secrète n'est écrite ici, seulement des noms de variables. Le pas à pas détaillé du plafond est dans `docs/ia-budget.md`.

## Variables d'environnement (noms seulement)

| Statut | Variable | Où la vérifier | Remarque |
|--------|----------|----------------|----------|
| [ ] | `OPENAI_API_KEY` | Vercel, projet rade-tactique, Settings, Environment Variables : existe pour **Production** et **Preview** | Clé du projet OpenAI qui porte le plafond. Sans elle, les quatre fonctions d'IA répondent 503. Ne jamais recopier la valeur. |
| [ ] | `BLOB_READ_WRITE_TOKEN` (ou identifiant du magasin avec l'accès OIDC de Vercel) | Même écran, **Production** et **Preview** | Sans lui, le compteur de 30 appels est ouvert : l'IA passe, rien n'est compté. |
| [ ] | `OPENAI_MODEL` | Même écran | Facultative. |

## Configuration du tableau de bord

- [ ] **Plafond de dépense OpenAI de 10 $ par mois, limite stricte** (SECU2-01, critère 3 de la phase, T-05-14)
  - Lieu : platform.openai.com, projet dont la clé est dans `OPENAI_API_KEY` de Vercel, Project settings, Limits, Spend, Edit spend limit
  - Régler : Monthly spend limit = **10** ; activer **Enforce a hard limit** (sans cet interrupteur, la limite n'envoie que des alertes) ; Save ; alerte facultative à 5 $
  - Vérifier : l'écran Limits affiche 10 $ avec la limite stricte activée
  - Facultatif, hors période de régate : preuve de coupure à 0,01 $ puis retour à 10 $ (voir `docs/ia-budget.md`)
  - Si l'écran diffère de la documentation, c'est l'écran qui fait foi
- [ ] **Usage du magasin Blob** (Vercel, Observability, Blob)
  - Relever l'usage **avant** et **après** le week-end du 7-9 novembre
  - Quota Hobby : 2 000 opérations avancées par mois, partagées avec l'archive, blocage de 30 jours au dépassement ; estimation attendue 900 à 1 100 au total
  - Au-delà de 40 % du quota pour l'IA seule, revoir le compteur

## Vérifications sur appareil

- [ ] **Quatre appels d'IA réels** sur la production : une dictée, un débrief, une question à l'arbitre, une lecture d'IC d'un autre club. Attendu : quatre réponses normales, aucune erreur 500 (confirme `store: false` avec le schéma strict).
- [ ] **Premier lancement de la v32** sur un iPhone qui a de vieilles traces, hors verrou de course : la trace de la Coupe SNPM apparaît une seule fois dans sa fiche (puis chez les autres après synchronisation), toast « N traces rangées dans l'archive », ligne `reprise` au Journal.
- [ ] **Trace enregistrée un jour de régate**, rangée à l'arrêt : « Trace enregistrée (N points) · rangée dans <régate> ».
- [ ] **Compteur à 30** : toasts de la dictée et du débrief avec repli sans IA, 31e question à l'arbitre : « Limite d'IA du jour atteinte — reprise demain ».
- [ ] **Mode avion, Coupe SNPM** : fiche, trace et débrief lisibles hors réseau, ouverture rapide.
- [ ] **« Tester le son »** sur un iPhone. Le contrôle de l'horloge audio sous Chromium est sorti une fois hors seuil (−83,2 ms), puis deux fois OK (15,5 ms) ; le chemin audio n'a pas changé depuis la v31.
- [ ] **Version affichée** : « v32 · 20/10 — rattrapage des traces, IA bornée (quota, store:false) ».

## Rappel à l'équipage

- [ ] Chaque iPhone applique la v32 par le bandeau « Mettre à jour », sur un geste, hors course, **avant le 7 novembre** (le rattrapage des traces se fait à ce premier lancement). Pas de mise en production dans les 48 h avant une régate, sauf correctif critique fait hors de l'eau.

## Repli

- Défaut constaté : Instant Rollback vers le déploiement v31 dans Vercel, puis correctif et v33.
- IA coupée par le budget : relever la limite au même endroit que sa pose.

---

**Quand tout est fait :** passer le statut en « Complet » en haut du fichier.
