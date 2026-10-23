# Phase 6 : Parcours banane — Contexte

**Recueilli :** 2026-10-23, avec Romain (« Avant le gel »)
**Statut :** prêt pour la planification
**Échéance :** v38 sur l'aperçu vers le 28 octobre, production sur « publie » de Romain avant le gel du 2 novembre 2026

<domain>
## Périmètre

Demande de Romain : « gérer les parcours banane, upwind downwind avec offset mark et peut-être porte sous le vent (deux bouées possibles en bas), et peut-être une arrivée décalée ».

Constat du code (v37) :
- `buildLegs()` (`js/tactics.js`) sait déjà construire deux parcours au vent : `built: 'D'` (parcours 10) et `built: 'WL'` (parcours 13 : B au vent à `S.wlNm`, C dog-leg à 0,08 Nq à gauche de B, arrivée Comité–A). Ces deux parcours sont dans `js/courses.js` : **on n'y touche pas**.
- La seule « porte » connue est `GATE`, la porte « ligne Départ/Arrivée » entre deux tours : un point, pas deux bouées au choix.
- L'arrivée est la ligne de départ, ou « près de 1 » (parcours 9), ou Comité–A pour les parcours construits.
- Les parcours d'un autre club (`js/regmarks.js`, `api/ic.js`) sont une suite `{ mark, side }` : pas de porte, pas d'arrivée propre.

Hors périmètre : parcours triangle/trapèze olympiques, changement de parcours en course (bouée déplacée par le comité pendant la manche), positions officielles de la CVAT (Romain n'a pas envoyé les IC 2026 : les réglages par défaut servent, il ajuste).
</domain>

<decisions>
## Décisions (prises pour Romain, qui a demandé de ne pas s'arrêter ; il peut en changer à la relecture)

### Parcours banane construit
- **D-01 :** un nouveau parcours « Banane (construite) » s'ajoute à la liste, défini **hors de `js/courses.js`** (nouveau module, p. ex. `js/banane.js`), avec un identifiant libre qui ne heurte ni les parcours SNPM (1-13) ni les parcours de régate (101+). Il est exclu du classement automatique des parcours (`rankCourses`, comme les autres `built`) et du choix de parcours du débrief seulement si ce choix ne sait pas le construire.
- **D-02 :** géométrie, toutes les distances mesurées depuis le centre de la ligne de départ choisie, axe = vent de la ligne (comme le parcours 13) :
  - bouée au vent **B** à la distance réglée (0,3 à 2 Nq, défaut 0,8) ;
  - **dégagement C** facultatif (activé par défaut), à 0,07 Nq de B perpendiculairement au vent, du côté où l'on tourne : à gauche en regardant au vent pour B laissée à bâbord (défaut), à droite si B est laissée à tribord ; C se laisse du même côté que B ;
  - **porte sous le vent** à deux bouées (activée par défaut), centrée sur l'axe à 0,05 Nq au vent du centre de la ligne, largeur 0,05 Nq (≈ 90 m, une dizaine de longueurs de J80), perpendiculaire au vent. Bouée gauche et bouée droite s'entendent **en regardant sous le vent** (comme les bateaux qui arrivent) : la gauche se laisse à bâbord, la droite à tribord. Porte désactivée → une seule bouée sous le vent laissée du côté de B ;
  - nombre de tours : le réglage « Tours » existant (1 à 5).
- **D-03 :** un tour = B, C (si dégagement), porte. Arrivée au choix (défaut : **ligne de départ**) :
  - « Ligne de départ » : au dernier tour, après B et C, arrivée sur la ligne de départ (pas de porte) ;
  - « Sous le vent, décalée » : au dernier tour, après B et C, arrivée sur une ligne de 0,06 Nq perpendiculaire au vent, centrée 0,1 Nq sous le vent du centre de la porte ;
  - « Au vent, décalée » : tous les tours finissent par la porte, puis un dernier près vers une ligne de 0,06 Nq perpendiculaire au vent, centrée 0,05 Nq sous le vent de B et décalée de 0,1 Nq du côté opposé au dégagement (pour ne pas gêner ceux qui contournent).
- **D-04 :** les réglages (distance, dégagement oui/non, côté de B, porte oui/non, arrivée) vivent dans l'état `S` (clés ajoutées à `DEF`, donc persistées), s'affichent sous le choix du parcours seulement quand la banane est choisie, et sont gardés avec le plan de manche et la fiche de régate comme `wlNm` aujourd'hui (`js/app.js` vers la ligne 1395), pour que les trois téléphones voient le même parcours.

### Porte sous le vent conseillée
- **D-05 :** chaque passage de porte devient un bord vers une marque `PORTE` qui porte les deux bouées et le choix conseillé. Le conseil compare, pour chaque bouée, le temps routé (`route()` de `js/router.js`, même champ de vent et mêmes pertes que l'analyse) du bord qui y mène **plus** le bord suivant (vers B ou l'arrivée), et retient le plus court. Le bord garde la bouée conseillée comme destination (distances, temps, compte de bords). Écart de moins de 10 s : « bouées équivalentes », avec la bouée du côté de la prochaine bascule annoncée si l'analyse en a une, sinon la gauche par défaut sans le présenter comme un conseil.
- **D-06 :** le conseil s'affiche au briefing (« Porte : bouée droite conseillée — 25 s de mieux ») et dans la navigation en course quand le bord suivant est une porte ; il se recalcule avec le vent comme le reste de l'analyse. Sur la carte 2D et la vue 3D, les deux bouées de la porte apparaissent, la conseillée marquée.
- **D-07 :** le mode départ, le chrono et la règle « rien pendant une course » ne changent pas. Les passages de bouées du débrief comptent un passage de porte quand la trace passe près de l'une ou l'autre bouée, et disent laquelle a été prise.

### Parcours d'un autre club
- **D-08 :** un parcours de régate peut contenir une **porte** (deux bouées de la régate, au choix) et une **arrivée** distincte du départ (ligne entre le comité et une bouée de la régate, ou près d'une bouée nommée). La lecture des IC (`api/ic.js`, schéma strict) les rend quand le texte les décrit (« porte 4s/4p », « arrivée entre le bateau comité et la bouée F »), avec l'extrait vérifié mot pour mot comme le reste ; la relecture les montre et un équipier les confirme comme les autres bouées (aucune bouée non confirmée ne sert). Si l'écran de relecture permet déjà de corriger un parcours à la main, la porte et l'arrivée s'y corrigent aussi ; sinon, pas de nouvel éditeur dans cette phase.
- **D-09 :** les régates déjà archivées (parcours sans porte ni arrivée) se lisent exactement comme avant : les nouveaux champs sont facultatifs, l'ancien format reste valable dans les deux sens de la synchronisation (un téléphone en v37 ne doit pas casser sur une fiche écrite en v38 : il ignore la porte ou l'affiche comme une bouée simple, à vérifier).

### Non-régression et livraison
- **D-10 :** la référence SNPM (`js/courses.js`, `tests/reference/`) ne bouge pas : garde `git diff --quiet f80c365 -- js/courses.js tests/reference/`. Un test vérifie que les bords des parcours 1 à 13 (G et P, avec et sans tours) et d'un parcours de régate archivé sont identiques à ceux de la v37.
- **D-11 :** guide (`guide.html`) et aide intégrée (`js/help.js`) expliquent la banane, la porte et l'arrivée décalée ; `tests/guide.test.mjs` reste vert. Un scénario navigateur choisit la banane, change la porte et l'arrivée, et voit le conseil de porte.
- **D-12 :** v38 sur l'aperçu `apercu-phase-06` avec une PR brouillon ; production seulement sur « publie » de Romain, avant le 2 novembre ; porte (`npm run gate`) verte aussi avec `VERCEL_ENV=production`.
</decisions>

<canonical_refs>
## Références

- `js/tactics.js` (`lineGeometry`, `buildLegs`, `analyzeLeg`, conseils par bord vers la ligne 279, `rankCourses`), `js/router.js` (`route`)
- `js/app.js` (`DEF`, panneau parcours vers 741-770, `runAnalysis`, ordre des bouées ligne 460, plan de manche vers 1395, navigation en course), `js/scene3d.js`, carte 2D
- `js/regmarks.js` (`coursesFromReview`, `applyRegattaMarks`), `js/regview.js`, `api/ic.js` (schéma strict, extraits vérifiés)
- `js/debrief.js` (passages de bouées), `js/startmode.js`
- `js/courses.js` et `tests/reference/` : lecture seule
- `guide.html`, `js/help.js`, `tests/guide.test.mjs`, `tools/regate-e2e.mjs`
</canonical_refs>

<deferred>
## Idées reportées

- Déplacer à la main les bouées d'une banane construite sur la carte (aujourd'hui : réglages seulement)
- Triangle / trapèze olympiques
- Changement de parcours annoncé par le comité en cours de manche
</deferred>
