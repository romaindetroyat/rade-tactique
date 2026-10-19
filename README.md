# Rade Tactique — Toulon

Application web installable (PWA) pour préparer et courir les régates du CVAT en rade de Toulon sur J80 :
modèle 3D de la rade (relief + fonds), vent local animé, parcours du Cahier de Parcours CVAT (V2, nov. 2025),
routage J80 par isochrones, analyse de la ligne de départ, conseils bord par bord, chrono de départ, mode « en course » GPS.

Pas d’étape de build pour l’app : ce dossier est un site statique, et une vérification (fichiers générés à jour, puis tests) tourne avant chaque mise en ligne (voir « Mettre en ligne sans risque »). Pour tester : `python3 -m http.server` dans ce dossier.
Pour l’iPhone : héberger le dossier en HTTPS (Vercel, Netlify, Cloudflare Pages, GitHub Pages…), ouvrir l’URL dans Safari,
puis Partager → « Sur l’écran d’accueil ».

## Données
- Prévisions : Open-Meteo (AROME HD 1,3 km de Météo-France sur 24 points, + AROME 2,5 km, ARPEGE, ECMWF, ICON-EU, GFS), état de la mer Open-Meteo Marine. Copie locale pour l’usage hors réseau.
- Balises en direct : Pioupiou / OpenWindMap.
- Relief : AWS Terrain Tiles ; bathymétrie : EMODnet ; côte, digues et bouées : © contributeurs OpenStreetMap (ODbL).
- Polaire J80 : certificat ORC One Design 2023 (`tools/build_polar.mjs` → `data/j80.pol`, `js/polar-orc.js`). Polaire personnelle importable dans l’onglet J80.
- Guides de réglage : North Sails (2 versions), Ullman, Quantum, J/Boats — synthèse dans `js/tuning.js` et `docs/J80-polaires-reglages.md`.

## Modèle de vent (`js/wind.js`)
Vent prévu interpolé, puis corrections locales heuristiques : contournement du relief (écoulement 2D « poreux »),
déventement sous le vent des reliefs, frottement côtier. Outil d’aide tactique, pas une simulation CFD : recaler sur le vent observé.

## Régénérer le relief
`tools/build_terrain.py <dossier-données> data` (voir l’en-tête du script pour les sources à télécharger).

## Mettre en ligne sans risque
Commandes (Node 24, `npm ci` une fois pour installer) :
- `npm test` : lance les tests automatiques.
- `npm run check` : vérifie que la version et la liste hors réseau générées (`sw.js`, `js/version.js`) sont à jour, puis lance les tests.
- `npm run stamp` : à lancer après toute modification de l’app (nouveau fichier, changement de code) ; régénère la version et la liste hors réseau. Ne jamais modifier à la main le bloc généré de `sw.js` ni `js/version.js`.
- `npm run release -- "ce qui change"` (ajouter `--critical` pour un correctif à appliquer sans attendre) : nouvelle version ; numéro, date et ligne de nouveauté, affichés dans le bandeau « Mettre à jour » et dans l’aide.

La porte Vercel : Vercel lance `npm ci` puis `npm run gate`. Un déploiement dont un test échoue, dont les fichiers générés sont périmés, ou (en production) dont le contenu a changé sans `npm run release`, n’est pas mis en production : l’ancienne version continue d’être servie. L’alerte est le statut d’échec sur le commit GitHub et dans le tableau de bord Vercel (Vercel envoie aussi un e-mail par défaut).

Contournement d’urgence : définir `RT_GATE_BYPASS=1` dans les variables du projet Vercel pour un seul redéploiement. Les tests sont alors sautés (un avertissement apparaît dans le journal de build), pas la vérification de version. Retirer la variable juste après.

Retour arrière : dans le tableau de bord Vercel, « Instant Rollback » vers un déploiement précédent réussi (ou « Promote to Production » sur celui-ci).

Règle d’exploitation :
- Aucune mise en production dans les 48 h avant une régate ni pendant une course, sauf correctif critique appliqué hors course.
- Une nouvelle version n’est jamais appliquée en course : l’équipier la prend avec le bandeau « Mettre à jour », hors course. Le jour de régate, la mise à jour est verrouillée de 9 h (heure de Paris) jusqu’à « Course finie », ou jusqu’à 1 h sans activité.
- La référence de la Coupe SNPM (`tests/reference`) ne se change qu’après accord de Romain.
