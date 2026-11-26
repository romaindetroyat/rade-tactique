// Rade de Bormes – Le Lavandou : descripteur léger du plan d’eau de l’espace Tofinou (D-10, D-11). Ni marée ni courant (marnage médian
// de 21 cm, étude § 4) : comme à Toulon, tout le code de marée et de courant reste inactif. Les données lourdes sont le pack `data/bormes.*`
// (08-03), téléchargé une fois puis lu hors réseau. Ici : identité, emprise, bornes de saisie, fichiers, météo, vent, cadrage 3D, lignes.
// Savoir local (marques, lieux, zones interdites, dangers, régimes, vents prédéfinis, textes) : 08-07 ; catalogue du Challenge de la Baie : 08-08.

// Grille météo (tools/venues/bormes.json, bloc weather) : produit latitudes × longitudes, latitude d’abord (même ordre que js/weather.js)
const GRID = [];
for (const lat of [43.02, 43.06, 43.10, 43.14]) for (const lon of [6.30, 6.36, 6.42, 6.48, 6.54]) GRID.push({ lat, lon });

// Lignes de départ : positions à confirmer sur l’eau (aucune n’est tirée d’une IC)
const LINE_PRESETS = {
  lavandou: { label: 'Devant Le Lavandou (position à confirmer)', lat: 43.133, lon: 6.381 },
  faviere: { label: 'Devant Bormes – La Favière (position à confirmer)', lat: 43.123, lon: 6.376 },
};

// Emprise des données (data/bormes.meta.json)
const BOUNDS = { west: 6.22, east: 6.60, south: 42.96, north: 43.20 };

export const BORMES = Object.freeze({
  id: 'bormes',
  nom: 'Rade de Bormes – Le Lavandou',
  origin: { lat: 43.10, lon: 6.40 },
  bounds: BOUNDS,
  // saisie des positions : emprise ± 0,1°, sauf à l’ouest, bornée à 6,20° E pour ne jamais recouvrir les bornes de Toulon (piège 6)
  inputBounds: { south: 42.86, north: 43.30, west: 6.20, east: 6.70, nom: 'la rade de Bormes – Le Lavandou', exemple: '43°07.980N 006°22.860E' },
  exemple: '43°07.980N 006°22.860E',
  files: { base: 'data/bormes.' },
  weather: {
    center: { lat: 43.115, lon: 6.39 },
    grid: GRID,
    cellSelection: 'sea',
    marine: 'latitude=43.115&longitude=6.39',
    live: null,            // aucune balise ouverte retenue (étude § 3.7)
    key: 'rade.wx.bormes.v1',
    snapshot: 'data/bormes.wx-snapshot.json',
  },
  wind: {},                // maille et seuil « mer dégagée » par défaut (4 000 m, validé par tests/bormes.test.mjs)
  // cadrage initial de la 3D, en mètres depuis l’origine : milieu de la baie
  scene: { home: { target: { x: -650, y: 2200 }, dist: 16000, portrait: { target: { x: -650, y: 0 }, dist: 30000, tilt: 0.5 } } },
  windRef: { lat: 43.120, lon: 6.392 },
  // catalogue (non gelé : applyRegattaMarks et addBanane le modifient sur place) : la banane seule jusqu’au Challenge de la Baie (08-08)
  MARKS: {},
  COURSES: [],
  LINE_PRESETS,
  PLACES: [],
  FORBIDDEN_ZONES: [],
  DANGERS: [],
  regimes: [],             // aucun régime tant que ceux de Bormes ne sont pas écrits (08-07) : jamais les conseils de Toulon
  presets: [],
  texts: {
    centre: 'milieu de la baie', point: 'milieu de la baie',
    relief: 'accélérations aux caps et dans les passes entre les îles',
  },
  // autres sources (onglet Vent) : liens neutres, sans balise de Toulon
  links: [
    ['Bulletin côtier Météo-France', 'https://meteofrance.com/previsions-meteo-marine/bulletin/cotier'],
    ['Windy', 'https://www.windy.com/43.12/6.39?43.12,6.39,11'],
  ],
});
