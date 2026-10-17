# Rade Tactique — Toulon

Application web installable (PWA) pour préparer et courir les régates du CVAT en rade de Toulon sur J80 :
modèle 3D de la rade (relief + fonds), vent local animé, parcours du Cahier de Parcours CVAT (V2, nov. 2025),
routage J80 par isochrones, analyse de la ligne de départ, conseils bord par bord, chrono de départ, mode « en course » GPS.

Aucune étape de build : ce dossier est un site statique. Pour tester : `python3 -m http.server` dans ce dossier.
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
