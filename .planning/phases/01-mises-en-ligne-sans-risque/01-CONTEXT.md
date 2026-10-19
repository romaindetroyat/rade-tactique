# Phase 1: Mises en ligne sans risque - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Une mise en ligne ne peut plus casser l'app ni interrompre une course :
- une version fautive est refusée avant d'arriver sur les téléphones (tests automatiques des calculs et de l'accès, porte de mise en ligne) ;
- une nouvelle version n'est jamais appliquée en course ni pendant une journée de régate, et ne recharge jamais l'app sans geste de l'équipier ;
- la version et la liste des fichiers hors réseau sont générées automatiquement ;
- l'équipier peut savoir quelle version il a ;
- l'import d'un PDF d'IC ne peut pas exécuter de code.

Besoins : TEST-01, TEST-02, TEST-03, TEST-04, SECU-01, FIAB-01, FIAB-02 (FIAB-02 modifié, voir D-08).

</domain>

<decisions>
## Implementation Decisions

### Mise à jour en course
- **D-01:** Verrou « en course » : dès qu'un chrono tourne, que le mode départ est ouvert, qu'une trace s'enregistre ou que le mode en course (GPS) est actif, quel que soit le jour (entraînement compris), aucune nouvelle version n'est appliquée.
- **D-02:** Verrou « jour de régate » : le jour de la régate enregistrée (date de la fiche de régate / IC choisie, `IC.date` aujourd'hui ; la régate de la phase 3 ensuite), aucune version n'est appliquée du matin jusqu'au retour au port. Le retour au port = l'équipier touche « course finie », ou chrono, trace et mode en course sont tous arrêtés depuis 1 h.
- **D-03:** Exception du matin : le jour de régate, le bandeau de mise à jour peut encore apparaître avant 9 h (heure de Paris), pour mettre à jour avant de partir au port. Après 9 h, verrou jusqu'au retour au port.
- **D-04:** Hors verrou, la nouvelle version s'annonce par un bandeau discret « Nouvelle version disponible » avec un bouton « Mettre à jour ». Aucun rechargement sans geste (fin du rechargement automatique sur `controllerchange` et du `skipWaiting` automatique).
- **D-05:** Pendant un verrou (course ou journée de régate après 9 h), le bandeau est masqué.
- **D-06:** Aucune version n'est forcée en course, même critique. Hors verrou, une version marquée critique affiche le bandeau en couleur d'alerte.
- **D-07:** Le bandeau indique en une ligne ce qui change (« Nouvelle version v27 · bips plus sûrs »).

### Version affichée
- **D-08:** La version se consulte uniquement dans l'aide (fenêtre d'aide / guide), au format « numéro + date » (ex. « v26 · 19/10 »), avec la ligne de nouveauté. Elle n'apparaît ni à l'écran de départ ni dans la ligne d'état (retirer `APP_VERSION` de la ligne d'état). **Ceci modifie FIAB-02** : « L'équipier peut consulter la version de l'app dans l'aide » — REQUIREMENTS.md et le critère 3 de la phase dans ROADMAP.md doivent être mis à jour en conséquence.
- **D-09:** Pas de visibilité de la version des autres équipiers pour l'instant.

### Trace et cas de référence
- **D-10:** La trace GPX réelle de la Coupe SNPM du 18/10/2026 est versionnée telle quelle dans le dépôt comme fixture de test (elle est déjà visible dans le rapport public).
- **D-11:** Le cas de référence vérifie : parcours 4 reconnu et passages aux bouées 7 et houlographe, arrivée réduite ; deux faux départs puis le bon départ à la bonne heure ; vent déduit cohérent (grosse bascule gauche au départ, vent par bord) ; pourcentages de polaire par bord stables à quelques % près.
- **D-12:** Si une amélioration du modèle change ces résultats, le test échoue ; Claude présente l'avant/après et la nouvelle référence est validée avec Romain avant d'être enregistrée. Pas de tolérances larges qui masqueraient une dérive.
- **D-13:** Les prochaines régates deviendront de nouveaux cas de référence, une fois leurs résultats validés avec Romain.
- **D-14:** Départ de référence de la Coupe SNPM = la valeur détectée sur la trace (09:43:42Z, soit 11:43:42 heure de Paris), pas l'heure du signal du rapport.

### Régate sur plusieurs jours
- **D-15:** Le verrou « journée de régate » (D-02/D-03) s'applique à chaque jour couru d'une épreuve de plusieurs jours (ex. 7-9 novembre) : la fiche de régate porte une date de début et une date de fin.

### Claude's Discretion
- Comportement quand un test bloque une mise en ligne (notification, issue de secours pour un correctif urgent), dans le respect de la règle d'exploitation : aucune mise en ligne de production dans les 48 h avant une régate sauf correctif critique hors course.
- Cas fabriqués complémentaires pour les calculs de base (géométrie, polaire, routage) si utiles.
- Mécanique technique : génération de la version et de la liste hors réseau, structure des tests, correctif pdf.js.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre et besoins
- `.planning/ROADMAP.md` — Phase 1 : objectif, besoins, critères de succès (critère 3 à ajuster selon D-08)
- `.planning/REQUIREMENTS.md` — TEST-01..04, SECU-01, FIAB-01, FIAB-02 (à modifier selon D-08)
- `.planning/PROJECT.md` — contraintes (échéance, pas de build, OpenAI, accès équipage)

### Recherche
- `.planning/research/SUMMARY.md` — Phase 1 « Filet de sécurité » et mise à jour différée
- `.planning/research/STACK.md` — `node:test`, `linkedom`, `buildCommand` dans `vercel.json`, `engines.node`
- `.planning/research/PITFALLS.md` — rechargement SW en course, CVE pdf.js (`isEvalSupported:false`), `TZ=Europe/Paris` (changement d'heure du 25/10/2026)
- `.planning/research/ARCHITECTURE.md` — `tools/verify.mjs`, `tools/stamp.mjs`, `RaceSession`, mise à jour différée

### Code existant
- `.planning/codebase/CONCERNS.md` — versions tenues à la main, `esc` dupliqué, absence de tests
- `.planning/codebase/TESTING.md` — candidats prioritaires aux tests
- `.planning/codebase/CONVENTIONS.md` — conventions de code à respecter

### Cas de référence
- `rapports/coupe-snpm-2026.html` — rapport de la Coupe SNPM (résultats attendus : parcours, départs, vent, polaire)
- Trace GPX source : uploads de session (`/root/.claude/uploads/.../9aa32494-18-oct.-2026-0813.gpx`) — à copier dans `tests/fixtures/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/geo.js`, `js/polar.js`, `js/router.js`, `js/tactics.js`, `js/wind.js`, `js/debrief.js`, `js/track.js` (`fromGPX`, `analyzeTrack`) : modules de calcul importables sous Node (shims nécessaires : `DOMParser` pour `fromGPX`, `fetch` vers `data/` pour `Terrain.load`).
- `middleware.js` : contrôle d'accès à tester (cookie, `?acces=`, chemins publics, 401 pour `/api`).
- `js/help.js` (`GUIDE`, `openGuide`) : emplacement naturel pour afficher la version (D-08).
- `js/events.js` (`currentEvent()`, `IC.date`) : date de la régate enregistrée pour le verrou jour de régate (D-02).

### Established Patterns
- Pas de build : modules ES servis tels quels ; tout nouvel outillage reste hors du chargement de l'app (scripts `tools/`, tests `tests/`).
- `sw.js` : `VERSION` + `SHELL` tenus à la main aujourd'hui, `skipWaiting()` à l'installation et `clients.claim()` à l'activation.
- `js/app.js` l.84-92 : rechargement automatique sur `controllerchange` et `reg.update()` au retour de visibilité — à remplacer par le bandeau.
- États « en course » existants : `timer` (`js/app.js` l.633, `startTimer`), mode départ (`js/startmode.js`), `Recorder` (`js/track.js`), GPS (`startGps`, `js/app.js` l.716).

### Integration Points
- `vercel.json` (`buildCommand`), `package.json` (scripts, `engines`, lockfile).
- `js/events.js` l.40 : `pdfjsLib.getDocument(...)` — ajout de `isEvalSupported: false` (SECU-01).
- `js/app.js` l.21 et l.116 : `APP_VERSION` et ligne d'état (retirer la version de la ligne d'état, D-08).

</code_context>

<specifics>
## Specific Ideas

- Format de version : « v26 · 19/10 ».
- Bandeau : « Nouvelle version v27 · bips plus sûrs » + bouton « Mettre à jour ».
- Bouton « course finie » pour lever le verrou du jour de régate.

</specifics>

<deferred>
## Deferred Ideas

- Voir la version des autres équipiers (à reconsidérer avec l'archive partagée, phase 4).
- Ajouter chaque prochaine régate comme cas de référence (D-13) — au fil des régates.

</deferred>

---

*Phase: 01-mises-en-ligne-sans-risque*
*Context gathered: 2026-10-19*
