// Rade de Brest : descripteur léger du plan d’eau (D-03) — origine, emprise, bornes de saisie, fichiers, météo, vent, cadrage 3D,
// catalogue initial. Les données lourdes (relief, fond de carte…) sont des fichiers à noms plats `data/brest.*` (07-03).
// Sources : étude du plan d’eau (07-RESEARCH-PLAN-EAU.md § 1.1, 5.1) et IC du GPEN 2026 (annexe 1, centre de la zone A).
// Lieux, marques, zones et régimes arrivent en 07-06, la marée et le courant en 07-07, le catalogue du GPEN en 07-09.

// Centre de la zone A du GPEN : 48°17,890 N 004°21,630 W (IC GPEN 2026, annexe 1)
const ZONE_A = { lat: 48.29817, lon: -4.3605 };

// Grille météo de la zone A (étude § 5.1) : 4 latitudes × 5 longitudes
const GRID = [];
for (const lat of [48.275, 48.295, 48.315, 48.335]) for (const lon of [-4.46, -4.42, -4.38, -4.34, -4.30]) GRID.push({ lat, lon });

// Emprise des données (meta) : rade, goulet, Camaret (étude § 1.1, D-14)
const BOUNDS = { west: -4.66, east: -4.22, south: 48.22, north: 48.43 };

export const BREST = Object.freeze({
  id: 'brest',
  nom: 'Rade de Brest',
  // centre de la rade (étude § 1.1 : sans effet sur la précision à cette échelle)
  origin: { lat: 48.33, lon: -4.45 },
  bounds: BOUNDS,
  // saisie des positions : emprise ± 0,1° (même règle que RADE de Toulon, js/marks.js)
  inputBounds: { south: 48.12, north: 48.53, west: -4.76, east: -4.12, nom: 'la rade de Brest', exemple: '48°17.890N 004°21.630W' },
  exemple: '48°17.890N 004°21.630W',
  files: { base: 'data/brest.' },
  weather: {
    center: { lat: 48.298, lon: -4.3605 },
    grid: GRID,
    cellSelection: 'sea',
    marine: null,          // houle et courant d’Open-Meteo écartés dans la rade (D-13)
    live: null,            // aucune balise ouverte dans la rade (D-14b)
    key: 'rade.wx.brest.v1',
    snapshot: 'data/brest.wx-snapshot.json',
  },
  // maille du champ de vent et seuil « mer dégagée » (aucune eau à plus de 4 000 m d’une terre dans l’emprise : étude § 3.5)
  wind: { cell: 150, openSea: 1500 },
  // cadrage initial de la 3D, en mètres depuis l’origine : centre de la zone A
  scene: { home: { target: { x: 6620, y: -3520 }, dist: 16000, portrait: { target: { x: 5200, y: -5600 }, dist: 34000, tilt: 0.5 } } },
  windRef: ZONE_A,
  // catalogue initial (non gelé : applyRegattaMarks et addBanane le modifient sur place, comme à Toulon)
  MARKS: {},
  COURSES: [],
  LINE_PRESETS: { zoneA: { label: 'Zone A du GPEN (centre)', lat: ZONE_A.lat, lon: ZONE_A.lon } },
  PLACES: [],
  FORBIDDEN_ZONES: [],
  DANGERS: [],
  regimes: [],             // rempli en 07-06 (étude § 3.6)
  presets: null,
  texts: { centre: 'centre de la zone A' },
});
