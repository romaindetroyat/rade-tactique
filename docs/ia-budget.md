# L’IA de l’app : plafond de dépense, limite du jour et données

Ce document est pour Romain. Il dit comment poser le plafond de dépense du projet OpenAI de l’app, ce que l’IA garde ou ne garde pas chez OpenAI, ce que fait la limite de 30 appels par jour et par équipier, et ce que cela coûte au magasin Blob. Aucune clé, aucun jeton, aucun code d’accès n’est écrit ici : seuls les noms des variables apparaissent.

## Plafond de dépense OpenAI (10 $ par mois)

Le plafond se pose sur le tableau de bord d’OpenAI, pas dans l’app. Il est **le dernier filet** : le premier est la limite de 30 appels par jour et par équipier (voir plus bas). Les libellés ci-dessous viennent de la documentation officielle de 2026 ; **si l’écran diffère, c’est l’écran qui fait foi**.

1. Ouvrir **platform.openai.com** et se connecter. En haut à gauche, choisir **le projet dont la clé est dans Vercel** (variable `OPENAI_API_KEY` du projet Vercel). En cas de doute : *API keys*, puis repérer la colonne « Project » de la clé utilisée (une ancienne clé « utilisateur » dépend du projet par défaut). Noter le nom du projet.
2. Ouvrir **Project settings**, puis **Limits**.
3. Dans **Spend**, toucher **Edit spend limit**.
4. **Monthly spend limit** : saisir **10** (dollars).
5. Activer **Enforce a hard limit**. Sans cet interrupteur, la limite n’envoie que des alertes et ne coupe rien.
6. Toucher **Save**. Facultatif : régler aussi une alerte à 5 $ pour être prévenu avant la coupure.
7. Vérifier que l’écran *Limits* affiche bien 10 $ avec la limite stricte activée.
8. *(Facultatif, preuve de coupure, hors période de régate seulement.)* Avec une dépense du mois déjà supérieure à 0,01 $, mettre la limite stricte à 0,01 $, faire une dictée sur l’aperçu (attendre une ou deux minutes si rien ne se passe), constater le message de budget, puis **remettre 10 $**.

### À la coupure

- OpenAI refuse alors les appels avec une erreur HTTP 429 de code `project_spend_limit_exceeded`.
- L’app affiche : « Budget d’IA du mois atteint — l’IA reprend le mois prochain ». Tout le reste de l’app continue de marcher (voir « Sans l’IA » plus bas).
- La coupure **n’est pas instantanée** : la dépense enregistrée peut dépasser légèrement 10 $.
- Pour reprendre l’IA avant le mois suivant : relever ou retirer la limite **au même endroit** (Project settings, Limits, Spend).
- Une limite existe aussi au niveau de l’organisation ; l’une ou l’autre peut déclencher le refus.

## Ce que garantit `store: false`

Chaque appel d’IA de l’app (dictée, débrief, arbitre, lecture d’IC) envoie `store: false`, posé en un seul endroit du code (`api/_ia.js`) et exigé par un test.

- **OpenAI ne garde pas les réponses** : aucune réponse n’est relisible par l’API après coup.
- **Ce que cela ne promet pas** : la surveillance des abus d’OpenAI peut garder les requêtes **jusqu’à 30 jours**, sauf contrat de non-rétention que l’app n’a pas. Il ne faut donc jamais présenter l’IA comme une garantie que rien n’est gardé nulle part.
- **Ce qui part chez OpenAI** : seulement, et sur geste de l’équipier, la phrase dictée, les faits calculés du débrief, la question posée à l’arbitre ou le texte des IC. **Aucun cookie, aucun code d’accès** ne part.

## Limite du jour par équipier

- **30 appels d’IA par équipier et par jour de Paris, toutes fonctions confondues** (dictée, débrief, arbitre, lecture d’IC se partagent les 30).
- Le compte est tenu **côté serveur**, sous le prénom que pose la connexion de chacun, jamais sous une valeur envoyée par le téléphone.
- Au 31e appel, l’app affiche : « Limite d’IA du jour atteinte — reprise demain ». Le compteur repart à zéro à minuit, heure de Paris.
- Un appel refusé parce que la saisie était invalide n’est pas compté ; un appel qui part et qui échoue chez OpenAI l’est (une unité sur 30).
- **Compteur en panne** : si le magasin ne répond pas (ou plus de 2 secondes), l’IA passe quand même et un avertissement est écrit dans les journaux de la fonction, sans prénom ni texte. Le plafond OpenAI reste alors le filet.
- Les compteurs sont des petits fichiers du magasin Blob privé : `prod/quota/<jour>/<prénom>.json` en production, `preview/quota/<jour>/<prénom>.json` sur l’aperçu. Chaque appel d’IA fait **une lecture et une écriture**. Rien n’est écrit une fois la limite atteinte.

### Sans l’IA

| Fonction | Ce qui marche quand l’IA est coupée ou limitée |
|----------|-----------------------------------------------|
| Relever le vent en parlant | La phrase est analysée sur le téléphone (analyse locale) |
| Débrief de course | La rédaction automatique écrit les leçons à partir des chiffres |
| Lecture d’IC d’un autre club | La relecture à la main reste ouverte et se valide comme d’habitude |
| Arbitre | Les fiches des règles de la page restent lisibles |

Le chrono, le briefing, la carte et l’archive partagée ne dépendent jamais de l’IA.

## Usage du magasin Blob

Le compteur et l’archive partagée utilisent le même magasin Blob. Le plan Hobby offre **2 000 opérations avancées (écritures) et 10 000 opérations simples par mois**, et un dépassement bloque **tout le magasin pendant 30 jours** (l’archive comme le compteur). Le plan réel de Vercel est à confirmer (Pro paie à l’usage, sans blocage).

| Source | Opérations avancées par mois (estimation) |
|--------|--------------------------------------------|
| Archive partagée | environ 650 |
| Rattrapage des traces (une fois) | 45 au plus |
| IA | 100 à 400 |
| **Total attendu** | **900 à 1 100, soit environ la moitié du quota** |

Le plafond théorique de l’IA (3 équipiers, 30 appels, 30 jours) serait de 2 700 : il dépasserait le quota si tout le monde épuisait sa limite tous les jours, ce qui n’est pas l’usage réel.

**À faire :** relever l’usage dans Vercel (projet rade-tactique, **Observability**, puis **Blob**) **avant et après le week-end du 7-9 novembre**. Au-delà de **40 % du quota** pour l’IA seule, revoir le compteur (par exemple réserver les appels par lots).

## Variables d’environnement concernées (noms seulement)

- `OPENAI_API_KEY` : clé du projet OpenAI qui porte le plafond. Sans elle, les quatre fonctions répondent 503.
- `OPENAI_MODEL` : facultative.
- Le jeton du magasin Blob (variable `BLOB_READ_WRITE_TOKEN`, ou l’identifiant de magasin avec l’accès OIDC de Vercel) : sans lui, le compteur est ouvert (l’IA passe, rien n’est compté).

À vérifier sur l’aperçu `apercu-phase-05` (Vercel, Settings, Environment Variables) : que ces variables existent pour l’environnement Preview. Ne jamais recopier leurs valeurs.
