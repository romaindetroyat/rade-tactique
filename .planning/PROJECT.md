# Rade Tactique

## What This Is

Rade Tactique est une application web installable (PWA) pour l'équipage du J80 *Naos* (Romain, Teiva Rameil, Thibaud Delaunay) qui régate dans la rade de Toulon, surtout aux épreuves du CVAT. Elle prépare la régate (vent local en 3D avec effets de relief, parcours, routage et tactique), accompagne la course (mode départ plein écran, GPS, trace) et aide à progresser après (débrief automatique depuis le GPX, analyse face à la polaire, règles de course et arbitre IA). L'accès est réservé à l'équipage.

## Core Value

Le jour de la régate, l'équipage peut ouvrir l'épreuve, s'en servir en mer sans que rien ne lâche, et retrouver ensuite le débrief : des conseils et des chiffres justes, fiables sur l'eau, et partagés par tout l'équipage.

## Requirements

### Validated

<!-- Livré avant l'adoption de GSD (versions v1 à v25, octobre 2026) et utilisé en régate le 18/10/2026 (Coupe SNPM, gagnée). -->

- ✓ Carte 3D de la rade (relief, fond de carte, bouées, zone interdite) consultable sur iPhone et ordinateur — existing
- ✓ Modèle de vent local avec effets de site (accélérations, dévents, blocage, frottement côtier, bascules) à partir des prévisions — existing
- ✓ Prévisions multi-modèles (Open-Meteo) et balises Pioupiou, recalées sur les relevés de l'équipage — existing
- ✓ Relevés de vent saisis ou dictés en langage naturel (fonction `api/voice`, OpenAI) — existing
- ✓ Parcours du cahier CVAT, route optimale bord par bord (routage isochrones sur la polaire J80), côté favorisé et effets de site expliqués par bord — existing
- ✓ Fiches de régate (IC) importées depuis le PDF des instructions de course — existing
- ✓ Mode départ plein écran : ping Comité / bouée, distance à la ligne, biais, temps jusqu'à la ligne, chrono avec bips, gros boutons — existing
- ✓ Mode en course : GPS, prochaine marque, recalcul de la suite, enregistrement de trace — existing
- ✓ Import GPX (dont Open GPX Tracker) et débrief automatique : détection du parcours et des départs, vent déduit, comparaison à la route conseillée, analyse polaire, rédaction OpenAI, rapport HTML partageable — existing
- ✓ Guide de l'équipage, page des règles de course 2025-2028 illustrée (FR/EN) et arbitre IA à la voix appuyé sur le texte officiel — existing
- ✓ Accès réservé à l'équipage par code personnel (middleware Vercel) — existing
- ✓ Fonctionnement hors réseau de l'app installée (service worker) — existing

### Active

<!-- Objectif : prêt pour la prochaine régate CVAT, dans 2 à 3 semaines. -->

- [ ] Fiabilité en mer : aucune mise à jour en course, chrono et bips sûrs, voyants d'état, ouverture rapide hors réseau ; la trace de référence vient d'Open GPX Tracker (enregistrement incassable dans l'app reporté en v2)
- [ ] Justesse : positions des bouées vérifiées, vent, routage, polaire et débrief contrôlés sur des cas connus (dont la Coupe SNPM du 18/10/2026)
- [ ] Non-régression : tests automatiques des calculs clés (géométrie, vent, routage, polaire, GPX, débrief, accès) lancés avant chaque mise en ligne
- [ ] Simplicité : un équipier ouvre la régate, lance le départ et fait le débrief en quelques gestes, sans Romain
- [ ] Ouvrir une régate à venir : n'importe quel équipier crée l'épreuve (date, IC importées du PDF, parcours possibles), y compris pour une régate occasionnelle d'un autre club en lisant ses IC
- [ ] Archive partagée : chaque régate passée garde le vent et la stratégie du jour (prévisions, relevés, route conseillée) ainsi que ses traces, son débrief, l'analyse polaire et le rapport, consultables par tout l'équipage sur n'importe quel appareil
- [ ] Préparer l'arrivée d'autres plans d'eau : les données propres à la rade (zone, relief, bouées, parcours, IC) ne sont plus écrites en dur dans le code (v2, après la régate de novembre)

### Out of Scope

- Ajouter réellement un autre plan d'eau maintenant — choix de Romain : « plus tard » ; on se limite à rendre l'ajout possible
- Application native iOS/Android — décidé : on reste en PWA
- Régates au-delà de 25 nœuds de vent — l'équipage ne régate pas au-delà ; modèles et polaires limités à cette plage
- Ouverture à d'autres équipages ou au public — l'app reste réservée à l'équipage de Naos
- Archiver la fiche IC et le parcours comme élément à part de l'archive — non retenu par Romain ; le débrief porte déjà le parcours couru

## Context

- Projet existant, développé avant l'adoption de GSD (versions v1 à v25 en octobre 2026), sans tests ni étape de build. La carte du code est dans `.planning/codebase/` ; les points faibles relevés (CONCERNS.md) sont notamment : `js/app.js` monolithique (≈1 070 lignes, état global), versions du service worker et de l'app tenues à la main, données de la rade codées en dur (`js/courses.js`, `js/weather.js`, `js/geo.js`), erreurs silencieuses (`catch {}`), aucune télémétrie, verrou d'écran et GPS qui peuvent s'arrêter en arrière-plan.
- Utilisation réelle : Coupe SNPM 18/10/2026 (parcours 4 réduit, deux faux départs, victoire) ; trace GPX et rapport de course disponibles (`rapports/coupe-snpm-2026.html`), utiles comme cas de référence.
- Les données de l'app vivent aujourd'hui dans le navigateur de chaque appareil (localStorage, IndexedDB) : rien n'est partagé entre équipiers, d'où le besoin d'une archive en ligne.
- L'équipage enregistre souvent ses traces avec Open GPX Tracker (iPhone) puis les importe.
- Fonctions IA : OpenAI (`gpt-5.5`), choix de Romain ; aucune limite d'usage aujourd'hui.

## Constraints

- **Échéance** : prochaine régate CVAT dans 2 à 3 semaines (vers le 7-9 novembre 2026) — la fiabilité en mer et l'ouverture de régate passent en premier
- **Plateforme** : PWA, aussi soignée sur iPhone (Safari et app installée) que sur ordinateur ; doit fonctionner hors réseau en mer
- **Hébergement** : Vercel (site statique, fonctions Node, middleware) — en place ; tout stockage partagé doit rester compatible
- **Technique** : JavaScript sans framework ni build, Three.js vendorisé ; introduire des outils (tests, script de vérification) sans alourdir le chargement de l'app
- **IA** : OpenAI uniquement (pas l'API Anthropic) pour les fonctions de l'app, modèle `gpt-5.5`
- **Langue** : interface et documents d'équipage en français
- **Accès** : réservé aux codes personnels de l'équipage de Naos ; toute nouvelle donnée partagée doit rester derrière ce contrôle
- **Vent** : plage utile jusqu'à 25 nœuds

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA statique sans framework, déployée sur Vercel | Rapide à faire évoluer, installable, hors-ligne | ✓ Good |
| OpenAI `gpt-5.5` pour voix, débrief et arbitre | Choix de Romain | ✓ Good |
| Accès par code personnel vérifié par middleware Vercel | Simple pour 3 personnes, protège aussi les fonctions payantes | ✓ Good |
| Pas d'app native | Choix de Romain | ✓ Good |
| Archives partagées en ligne pour tout l'équipage | Chacun doit retrouver débriefs et stratégies sur n'importe quel appareil | — Pending |
| Tout équipier peut ouvrir une régate et modifier l'archive | Ne pas dépendre de Romain | — Pending |
| Autres plans d'eau : préparer l'architecture, pas d'ajout maintenant | Priorité à la prochaine régate CVAT | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-19 after initialization*
