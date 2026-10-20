---
quick_id: 261020-aid
type: execute
wave: 1
autonomous: true
files_modified: [js/help.js, js/app.js, tests/guide.test.mjs, release.json, sw.js, js/version.js]
---

# Aide intégrée mise à jour (v34)

<objective>
Mettre l'aide intégrée de l'app (fenêtre d'aide « i », bulles d'aide, `GUIDE`, `STATIC_TIPS`, `SYNC_TIP` de `js/help.js`, et les deux bulles de `js/app.js`) en accord avec la v32 et avec le nouveau `guide.html` (v33). Texte seulement : aucun changement de comportement.
</objective>

<tasks>
<task type="auto">
  <name>Tâche 1 : textes d'aide corrigés et complétés, garde de test</name>
  <read_first>js/help.js, js/app.js (bulles vers ~l. 1483 « Mes traces » et ~l. 1997 « Régates »), guide.html (source de vérité des formulations), tests/guide.test.mjs, tests/regates.test.mjs (motifs exigés ou interdits sur DL_TIP / SYNC_TIP), .planning/quick/261020-eaq-guide-prise-en-main/261020-eaq-SUMMARY.md (liste des 8 lacunes)</read_first>
  <action>
1. `js/help.js` `GUIDE`, point Régates : traces, débriefs, rapports, vent du jour et recalages de bouées sont partagés par l'archive (depuis la v31).
2. `GUIDE`, point Départ : ⛵ Mode départ plein écran, Top 5’ / Top 4’ / Top 1’, « Tester le son » avant chaque départ.
3. `GUIDE` : 🏁 Course finie, bandeau « Mettre à jour » (jamais en course ni pendant la journée de régate verrouillée), les 4 voyants (GPS, ÉCRAN, SON, RÉSEAU), limite d'IA de 30 appels par jour (« Limite d’IA du jour atteinte — reprise demain »), Open GPX Tracker en parallèle (iPhone verrouillé), vent utile jusqu'à 25 nœuds, « Arrêter le GPS » en rentrant au port (sinon l'app se croit en course).
4. `STATIC_TIPS['#daySeg']` : 🏁 marque le premier jour de la régate courante ; le 3e bouton porte le jour abrégé (comme le guide).
5. `SYNC_TIP` : expliquer les états « Pas encore synchronisé », « Synchronisation à relancer », « Plafond du jour atteint · reprise demain », « Code d’accès à renouveler », « Mettez l’app à jour pour synchroniser » (libellés exacts du code).
6. `js/app.js` bulle Régates : « Passée » (libellé affiché) au lieu de « Passées ».
7. `js/app.js` bulle « Mes traces » : remplacer « Elles restent sur cet appareil » par le partage par l'archive (formulation du guide).
8. Lien « 📖 Guide complet de l’équipage » de la fenêtre d'aide → `guide.html#minute`.
Texte court, français simple, apostrophe typographique ’, libellés exacts du code ; ne rien inventer ; aucun code d'accès, cookie, adresse de magasin ni nom de modèle. Étendre `tests/guide.test.mjs` (ou un test voisin) : l'aide ne contient plus « Elles restent sur cet appareil », « Passées » dans la bulle Régates, ni « résumés du vent du jour » seul ; elle cite « Tester le son », « Course finie », « Mettre à jour », « reprise demain » ; chaque libellé entre guillemets de l'aide existe dans index.html / js / api. Puis `npm run stamp`.
  </action>
  <verify>
    <automated>npm run check && git diff --quiet f80c365 -- js/courses.js tests/reference/ && PW_REQUIRED=1 node tools/regate-e2e.mjs guide ia-erreurs archive</automated>
    <fails_when>code de sortie non nul, une ligne « not ok », un scénario en échec ou impossible (sortie 2), ou la référence SNPM modifiée</fails_when>
  </verify>
  <acceptance_criteria>js/help.js ne contient plus « résumés du vent du jour » comme seule liste partagée ; js/app.js ne contient plus « Elles restent sur cet appareil » ; l'aide contient « Tester le son », « Course finie », « Mettre à jour », « reprise demain » et `guide.html#minute` ; npm run check vert.</acceptance_criteria>
  <done>Aide intégrée cohérente avec la v32 et le guide, tests verts, commit.</done>
</task>

<task type="auto">
  <name>Tâche 2 : v34 sur l'aperçu</name>
  <read_first>release.json, tools/stamp.mjs</read_first>
  <action>`npm run release -- "aide intégrée mise à jour"` (v34), `RT_STRICT=1 node tools/stamp.mjs --check`, `VERCEL_ENV=production npm run gate`, commit, `git push -u origin apercu-phase-05`. Pas de PR, pas de production.</action>
  <verify>
    <automated>node -e "const r=JSON.parse(require('fs').readFileSync('release.json','utf8'));if(r.n!==34||r.critical)process.exit(1)" && RT_STRICT=1 node tools/stamp.mjs --check && VERCEL_ENV=production npm run gate</automated>
    <fails_when>code de sortie non nul ou release différente de 34</fails_when>
  </verify>
  <acceptance_criteria>release.json n = 34 ; porte verte en VERCEL_ENV=production ; branche poussée.</acceptance_criteria>
  <done>v34 sur l'aperçu.</done>
</task>
</tasks>

## Artifacts this phase produces
- Textes de `js/help.js` (`GUIDE`, `STATIC_TIPS['#daySeg']`, `SYNC_TIP`) et deux bulles de `js/app.js` ; assertions ajoutées dans `tests/guide.test.mjs` ; release v34.
