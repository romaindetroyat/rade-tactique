# Phase 7 : Plans d'eau — Toulon et rade de Brest (GPEN) — Contexte

**Recueilli :** 2026-11-19, avec Romain (« prépare l'application pour conserver le même fonctionnement… mais permets le changement de plan d'eau en intégrant la rade de Brest et surtout la zone de course habituelle du GPEN » ; « nous avons le temps de tout développer maintenant avant la régate du 13 »)
**Statut :** décisions A et B fixées ; décisions complètes
**Échéance :** production avant le 10 décembre 2026 (règle des 48 h avant la régate de Toulon du 13/12), sur « publie » de Romain. GPEN 2027 : 5 au 9 mai 2027.

<domain>
## Périmètre

VENUE-01 (pack de plan d'eau) + pack « Rade de Brest » avec la zone A du GPEN (J80). Références : 07-RESEARCH.md (code, GPEN, vagues), 07-RESEARCH-PLAN-EAU.md (relief, repères, vents, marée, courants, météo).

Hors périmètre : autres plans d'eau que Toulon et Brest ; découpage de js/app.js (CODE-01) ; changement de nom de l'app.
</domain>

<decisions>
## Décisions (prises avec les défauts recommandés ; Romain peut en changer)

### A. Toulon ne change pas d'un bord
- **D-01 :** `js/courses.js` et `data/*` de Toulon restent en place ; garde SNPM `git diff --quiet f80c365 -- js/courses.js tests/reference/` inchangée. Fixture v42 capturée sur 56f6625 AVANT toute modification (bords, conseils, champ de vent, routage sur plusieurs vents/parcours) + empreintes des fichiers `data/` de Toulon : tout écart casse `npm test`.
- **D-02 :** la v43 n'est publiée que si toutes les gardes Toulon sont vertes ; sinon la vague concernée attend après le 13/12.

### B. Pack de plan d'eau
- **D-03 :** registre `js/venues.js` ; Toulon décrit par référence aux fichiers actuels ; Brest dans un module léger (`js/venue-brest.js`) plus des données lourdes à noms plats `data/brest.*`.
- **D-04 :** Brest est téléchargé à la demande (geste « Télécharger le plan d'eau » + automatique quand on ouvre une régate à Brest avec du réseau), vérifié par empreinte, rangé dans un cache dédié que les mises à jour ne suppriment pas ; Toulon reste dans le cache de l'app comme aujourd'hui. Utilisable hors réseau une fois téléchargé ; un message clair sinon.
- **D-05 :** changer de plan d'eau recharge l'app (origine de la carte, terrain, vent) — jamais pendant une course.
- **D-06 :** une régate porte son plan d'eau (`venue`, ajouté aux champs fusionnés de l'archive) ; absent = Toulon (régates existantes). Ouvrir une régate d'un autre plan d'eau propose de basculer. Entraînement libre : choix du plan d'eau dans les réglages. Compatibilité v42 ↔ v43 vérifiée par un outil (un téléphone en v42 ignore `venue` sans casser).
- **D-07 :** corriger les verrous Toulon : longitudes Ouest (`fmtLon`), lecture des positions (`parseLatLon`/RADE), bornes de plausibilité des IC (`icplaus` BOUNDS), contrôles en dur de js/app.js — par plan d'eau.

### C. GPEN
- **D-08 :** fiche « GPEN 2027 — J80 » semée (5–9 mai 2027, VHF 14, zone A École Navale cercle 1,2 NM centré 48°17,890 N 004°21,630 W, pénalité un tour, temps limites, 3 courses validantes, retrait dès 4).
- **D-09 :** catalogue limité à la zone A J80 : parcours 1 (2 tours) et 2 (3 tours), construits au vent (départ – 1 – 2 dégagement – porte 3S/3P – … – arrivée), réutilisant la banane de la phase 6 avec une nouvelle forme d'arrivée « à droite du comité » ; variante Virginie Hériot (arrivée décalée devant la chapelle) si la position est trouvable, sinon notée « à confirmer ».
- **D-10 :** zones interdites de Brest (Île Longue, passage de Pen ar Vir…) et dangers dans le pack, utilisés par le routage.
- **D-11 :** arbitre (api/rules.js), débrief et dictée (api/debrief.js, api/voice.js) reçoivent le plan d'eau et ses règles propres (IC GPEN : un tour, jugement semi-direct) au lieu du bloc CVAT quand on est à Brest.
- **D-12 :** recalage partagé des bouées CVAT réservé à Toulon ; à Brest les bouées viennent des IC / de la banane construite.

### D. Marée, courant, vent (d'après 07-RESEARCH-PLAN-EAU.md)
- **D-13 :** marée par harmoniques embarquées (`data/brest.maree.json`, `js/maree.js`, écart-type visé ≈ 4 min / 15 cm, contrôlé contre l'annuaire) ; courant par l'atlas Shom 560 ré-échantillonné sur 13 heures de marée et dosé par le marnage (`data/brest.courants.bin`, `js/courant.js`) ; Open-Meteo marine écarté dans la rade. Le routage reçoit une option `current` (vitesse fond = surface + courant) **absente à Toulon** : le chemin de calcul de Toulon est inchangé (gardé par la fixture v42). Conseils : heure de marée, renverses, côté du plan d'eau où le courant aide ; affichage de la marée et du courant sur la carte et au briefing. Mention de la source Shom (Licence Ouverte 2.0, DOI) « en complément des cartes et ouvrages nautiques officiels ».
- **D-14 :** régimes de vent de Brest (huit, selon l'étude) et seuil « mer dégagée » du champ de vent (`js/wind.js:107`) en paramètre du plan d'eau ; conseils marqués selon leur origine et présentés comme à confirmer sur l'eau. Emprise 4,66–4,22° W, 48,22–48,43° N, maille 30 m (ou plus grossière si l'ouverture ou le calcul du vent dépassent ceux de Toulon).
- **D-14b :** pas de vent en direct à Brest dans cette phase (aucune balise ouverte) ; METAR / Holfuy reportés.
- **D-14c :** fonds : marge de sécurité d'au moins 1 m sur EMODnet ; zones interdites incomplètes (Île Longue 8-10, port militaire) marquées « à compléter sur carte marine » dans le guide.

### Livraison
- **D-15 :** branche `apercu-phase-07`, PR brouillon, aperçu vérifié ; production (v43) sur « publie » de Romain avant le 10/12 ; la vague qui touche le service worker est vérifiée en priorité (mise à jour sur iPhone).
</decisions>

<canonical_refs>
## Références
- 07-RESEARCH.md (inventaire du code fichier:ligne, architecture, GPEN avec URL des IC 2022-2026, vagues)
- 07-RESEARCH-PLAN-EAU.md (étude du plan d'eau)
- Phase 6 : js/banane.js, tests/fixtures/legs-v37.json (modèle de fixture de non-régression)
</canonical_refs>
