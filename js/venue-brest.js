// Rade de Brest : descripteur léger du plan d’eau (D-03) — origine, emprise, bornes de saisie, fichiers, météo, vent, cadrage 3D,
// catalogue initial. Les données lourdes (relief, fond de carte…) sont des fichiers à noms plats `data/brest.*` (07-03).
// Sources : étude du plan d’eau (07-RESEARCH-PLAN-EAU.md § 1.1, 5.1) et IC du GPEN 2026 (annexe 1, centre de la zone A).
// Lieux, marques, zones et régimes : 07-06 ; la marée et le courant arrivent en 07-07, le catalogue du GPEN en 07-09.

// Centre de la zone A du GPEN : 48°17,890 N 004°21,630 W (IC GPEN 2026, annexe 1)
const ZONE_A = { lat: 48.29817, lon: -4.3605 };

// Grille météo de la zone A (étude § 5.1) : 4 latitudes × 5 longitudes
const GRID = [];
for (const lat of [48.275, 48.295, 48.315, 48.335]) for (const lon of [-4.46, -4.42, -4.38, -4.34, -4.30]) GRID.push({ lat, lon });

const ll = ([lat, lon]) => ({ lat, lon });

// ───────── Zones interdites (étude § 2.3, D-10, D-14c) : { name, note, desc, pts: [{ lat, lon }] }, évitées par le routage
// Île Longue : « La navigation autour de l’Île longue dans la zone balisée par les marques spéciales numérotées de 0 à 10 est formellement
// interdite » (IC GPEN 2026, annexe 5). Bouées jaunes relevées dans OpenStreetMap (nœuds buoy_special_purpose) : n° 0 48°17,870 N 004°31,430 W ;
// 1 48°18,027 N 004°31,283 W ; 2 48°18,263 N 004°31,083 W ; 2 bis 48°18,417 N 004°30,949 W ; 3 48°18,575 N 004°30,815 W ;
// 3 bis 48°18,665 N 004°30,742 W ; 4 48°18,822 N 004°30,601 W ; 5 48°18,834 N 004°30,234 W ; 6 48°18,852 N 004°29,848 W ;
// 6 bis 48°18,779 N 004°29,651 W ; « D » (entrée interdite) 48°18,685 N 004°29,451 W ; 7 48°18,549 N 004°29,503 W.
// Méthode (calcul fait une fois, résultat recopié ci-dessous) : bouées dans l’ordre 0 → 6 bis, puis « D » avant 7 (dans l’ordre « 7 puis D »
// le contour se recoupe : D est au nord-est de 7), puis le rivage est de l’île sur le trait de côte de data/brest.coast.json (ligne 94,
// points 26, 24, 19, 15, 13 : bout de la jetée sud du port, puis la côte vers le sud), puis l’isthme (point 62) ; polygone élargi de 50 m vers
// l’extérieur (« tracé large », sommets en onglet, projection de Brest). Chaque bouée est à 50 m à l’intérieur du bord.
// Bouées 8 à 10 et port militaire non relevés : à compléter sur la carte marine.
const ILE_LONGUE = [
  [48.297997, -4.524477], [48.300682, -4.521964], [48.304609, -4.518636], [48.307175, -4.516402], [48.309803, -4.514174],
  [48.311308, -4.512953], [48.31414, -4.51041], [48.314351, -4.50394], [48.31466, -4.497314], [48.313367, -4.493825],
  [48.311607, -4.49008], [48.308934, -4.491102], [48.304225, -4.497244], [48.304694, -4.500164], [48.300516, -4.50761],
  [48.298685, -4.510159], [48.296902, -4.511916], [48.295039, -4.525218],
].map(ll);
// Pen ar Vir : « Dans tous les parcours, il est interdit de naviguer entre la marque cardinale Pen Ar Vir et la pointe du même nom »
// (IC GPEN 2026, annexe 5). Cardinale 48°17,754 N 004°24,883 W, pointe 48,2944 N 4,4185 W (OpenStreetMap), 325 m entre les deux.
// Méthode : couloir de 100 m de large centré sur l’axe cardinale → pointe, prolongé de 20 m au-delà de la cardinale et de 150 m
// au-delà de la pointe (dans les terres : aucun passage entre le couloir et la côte).
const PEN_AR_VIR = [[48.295603, -4.41414], [48.29332, -4.419899], [48.294098, -4.420588], [48.296381, -4.414828]].map(ll);
const A_COMPLETER = 'à compléter sur carte marine';
const ZONES = [
  { name: 'Île Longue', note: A_COMPLETER, pts: ILE_LONGUE,
    desc: 'La navigation dans la zone balisée de l’Île Longue (marques 0 à 10) est interdite (IC GPEN). Zone tracée large (50 m) autour des bouées 0 à 7 et « D » ; bouées 8 à 10 et port militaire non relevés.' },
  { name: 'Passage de Pen ar Vir', note: A_COMPLETER, pts: PEN_AR_VIR,
    desc: 'Interdit de naviguer entre la cardinale Pen ar Vir et la pointe du même nom (IC GPEN, tous les parcours).' },
];

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
  FORBIDDEN_ZONES: ZONES,
  DANGERS: [],
  regimes: [],             // rempli en 07-06 (étude § 3.6)
  presets: null,
  texts: { centre: 'centre de la zone A', point: 'centre de la zone A', relief: 'accélérations aux pointes et dans le goulet' },
  // autres sources (onglet Vent) : liens neutres, sans balise de Toulon
  links: [
    ['Bulletin côtier Météo-France', 'https://meteofrance.com/previsions-meteo-marine/bulletin/cotier'],
    ['Windy', 'https://www.windy.com/48.30/-4.36?48.30,-4.36,11'],
  ],
});
