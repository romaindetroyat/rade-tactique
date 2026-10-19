# Phase 1: Mises en ligne sans risque - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 01-mises-en-ligne-sans-risque
**Areas discussed:** Mise à jour en course, Version affichée, Trace de référence

---

## Mise à jour en course

| Option | Description | Selected |
|--------|-------------|----------|
| Chrono, mode départ ou trace | Verrou dès qu'un chrono, le mode départ, une trace ou le mode en course est actif | |
| Toute la journée de régate | Aucune mise à jour le jour d'une régate enregistrée | ✓ |
| Je décide | Claude choisit | |

| Option | Description | Selected |
|--------|-------------|----------|
| Bandeau + bouton | Bandeau discret avec « Mettre à jour » | ✓ |
| Au prochain lancement | Rien à l'écran | |
| Automatique hors course | Rechargement auto après la course | |

| Option | Description | Selected |
|--------|-------------|----------|
| Masqué en course | Rien ne distrait | ✓ |
| Discret | Rappel sans bouton | |

| Option | Description | Selected |
|--------|-------------|----------|
| Jamais en course | Même critique, attend ; bandeau d'alerte hors course | ✓ |
| Sur confirmation | Rechargement accepté en course | |

Relances :

| Question | Choix |
|----------|-------|
| Journée de régate : de quand à quand ? | Jusqu'au retour au port (bouton « course finie » ou chrono/trace arrêtés depuis 1 h) |
| Un chrono ou une trace un jour sans régate bloque-t-il ? | Oui |
| Comment l'app sait que c'est un jour de régate ? | Date de la régate enregistrée |
| Nouvelle version arrivée le jour J ? | Proposer le matin avant 9 h |

**User's choice:** verrou combiné (activité de course quel que soit le jour + journée de régate jusqu'au retour au port, sauf avant 9 h), bandeau + bouton, masqué en course, jamais forcé.

---

## Version affichée

| Option | Description | Selected |
|--------|-------------|----------|
| Numéro + date | « v26 · 19/10 » | ✓ |
| Numéro + nouveauté | « v26 · mises en ligne sûres » | |
| Numéro seul | « v26 » | |

| Emplacement | Selected |
|-------------|----------|
| Écran de départ | |
| Ligne d'état | |
| Aide / guide | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Le bandeau dit ce qui change (une ligne) | | ✓ |
| Non | | |

| Option | Selected |
|--------|----------|
| Version des autres équipiers : non, pas maintenant | ✓ |
| Oui, plus tard | |

Relance (conflit avec FIAB-02 « à l'écran de départ ») : options « Aide + petit rappel au départ », « Aide seulement », « Aide + ligne d'état » → **Aide seulement** (FIAB-02 modifié).

---

## Trace de référence

| Option | Description | Selected |
|--------|-------------|----------|
| Oui | Trace réelle versionnée | ✓ |
| Oui, allégée | Sous-échantillonnée | |
| Non | Trace fabriquée | |

| Ce qui doit rester vrai | Selected |
|-------------------------|----------|
| Parcours et bouées | ✓ |
| Départs | ✓ |
| Vent déduit | ✓ |
| Polaire | ✓ |

| Option | Selected |
|--------|----------|
| Revue puis mise à jour | ✓ |
| Tolérances larges | |

Autres cas : réponse libre — « On va apprendre dans le futur, avec les prochaines régates ».

---

## Claude's Discretion

- Blocage d'une mise en ligne (notification, issue de secours), non discuté — dans le respect de la règle des 48 h.
- Cas fabriqués complémentaires pour les calculs de base.

## Deferred Ideas

- Version des autres équipiers (phase 4).
- Nouvelles régates comme cas de référence au fil de l'eau.
