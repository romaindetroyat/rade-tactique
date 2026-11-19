// Rade de Brest : descripteur léger du plan d’eau (D-03) — origine, emprise, bornes de saisie, fichiers, météo, vent, cadrage 3D,
// catalogue initial. Les données lourdes (relief, fond de carte…) sont des fichiers à noms plats `data/brest.*` (07-03).
// Sources : étude du plan d’eau (07-RESEARCH-PLAN-EAU.md § 1.1, 5.1) et IC du GPEN 2026 (annexe 1, centre de la zone A).
// Lieux, marques, zones, régimes et vents prédéfinis : 07-06 ; marée et courant : 07-07 ; catalogue du GPEN : 07-09.

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
// Méthode : couloir de 100 m de large centré sur l’axe cardinale → pointe, commencé à 10 m de la cardinale (la bouée reste hors de la zone,
// on peut l’arrondir) et prolongé de 150 m au-delà de la pointe (il chevauche la terre : aucun passage entre le couloir et la côte).
const PEN_AR_VIR = [[48.295465, -4.414489], [48.29332, -4.419899], [48.294098, -4.420588], [48.296243, -4.415177]].map(ll);
const A_COMPLETER = 'à compléter sur carte marine';
const ZONES = [
  { name: 'Île Longue', note: A_COMPLETER, pts: ILE_LONGUE,
    desc: 'La navigation dans la zone balisée de l’Île Longue (marques 0 à 10) est interdite (IC GPEN). Zone tracée large (50 m) autour des bouées 0 à 7 et « D » ; bouées 8 à 10 et port militaire non relevés.' },
  { name: 'Passage de Pen ar Vir', note: A_COMPLETER, pts: PEN_AR_VIR,
    desc: 'Interdit de naviguer entre la cardinale Pen ar Vir et la pointe du même nom (IC GPEN, tous les parcours).' },
];

// ───────── Lieux nommés (étiquettes de la carte) : [nom, lat, lon, type] ; type : 1 ville, 2 cap ou pointe, 3 sommet, 4 plan d’eau
// Positions des nœuds OpenStreetMap (ODbL) relevées par l’étude (§ 2.1), puis les lieux « à relever » trouvés dans l’extrait OpenStreetMap
// de 07-03 (nœuds place et natural=bay). Absents faute de nœud dans l’emprise : École navale ; Ménez-Hom (sommet à 48,2198 N, juste au sud).
const PLACES = [
  ['Pointe du Grand Minou', 48.3381, -4.6271, 2], ['Pointe du Petit Minou', 48.3363, -4.6146, 2], ['Pointe du Toulinguet', 48.2801, -4.6269, 2],
  ['Pointe du Grand Gouin', 48.2880, -4.6011, 2], ['Pointe des Capucins', 48.3191, -4.5801, 2], ['Pointe de Cornouaille', 48.3301, -4.5700, 2],
  ['Pointe du Dellec', 48.3521, -4.5672, 2], ['Pointe du Diable', 48.3545, -4.5586, 2], ['Pointe Robert', 48.3378, -4.5542, 2],
  ['Pointe du Portzic', 48.3579, -4.5335, 2], ['Pointe des Espagnols', 48.3418, -4.5319, 2], ['Pointe de Lanvéoc', 48.2947, -4.4606, 2],
  ['Pointe de l’Armorique', 48.3270, -4.4592, 2], ['Pointe du Caro', 48.3367, -4.4502, 2], ['Pointe de Kerdéniel', 48.3254, -4.4481, 2],
  ['Pointe du Corbeau', 48.3494, -4.4447, 2], ['Pointe Marloux', 48.3599, -4.4369, 2], ['Penn ar Vir', 48.2944, -4.4185, 2],
  ['Pointe de Doubidy', 48.3244, -4.4182, 2], ['Pointe de Lomergat', 48.2861, -4.3536, 2], ['Pointe du Bindy', 48.3129, -4.3398, 2],
  ['Pointe d’Hanvec', 48.3131, -4.2820, 2], ['Île Ronde', 48.3238, -4.4622, 2],
  ['Roscanvel', 48.3153, -4.5488, 1], ['Le Fret', 48.2856, -4.5091, 1], ['Lanvéoc', 48.2867, -4.4615, 1],
  ['Baie de Camaret', 48.2847, -4.5822, 4], ['Anse de Sainte-Anne-du-Portzic', 48.3599, -4.5494, 4], ['Anse du Dellec', 48.3548, -4.5633, 4],
  ['Baie de Roscanvel', 48.3090, -4.5295, 4], ['Anse du Fret', 48.2912, -4.4961, 4], ['Anse du Caro', 48.3426, -4.4448, 4],
  ['Anse de Poulmic', 48.2816, -4.3966, 4], ['Baie de Daoulas', 48.3250, -4.3493, 4],
  // extrait OpenStreetMap de 07-03 (nœuds place=city/town/village, natural=bay)
  ['Brest', 48.3912, -4.4851, 1], ['Plougastel-Daoulas', 48.3742, -4.3697, 1], ['Le Relecq-Kerhuon', 48.4076, -4.3966, 1],
  ['Landévennec', 48.2926, -4.2680, 1], ['Camaret-sur-Mer', 48.2773, -4.5969, 1], ['Crozon', 48.2464, -4.4894, 1],
  ['Logonna-Daoulas', 48.3207, -4.2996, 1], ['Anse du Moulin Blanc', 48.3930, -4.4227, 4],
];

// ───────── Marques fixes (étude § 2.2) : { name, lat, lon, kind, color, note, src }, comme MARKS de Toulon (js/courses.js)
// Clés courtes NON numériques : jamais confondues avec une bouée du cahier CVAT (cvatKey, D-12), ni avec les clés de la banane (A, B, C, D,
// PG, PD, S) ou des bouées d’une régate (X1…). Position des IC GPEN 2026 (annexe 3.4) quand elle existe — OpenStreetMap concorde alors à
// moins de 15 m —, sinon celle d’OpenStreetMap (nœuds seamark). Kerviniou et Pénoupèle : les deux sources divergent de plus de 50 m,
// position des IC gardée et marquée « approx » (à confirmer, JUST-01). Degrés-minutes convertis en degrés décimaux à 6 chiffres
// (contrôlés par tests/brest.test.mjs). Feux lus dans OpenStreetMap seul : à vérifier sur le livre des feux.
const ROUGE = '#e03131', VERT = '#1f9d55', JAUNE = '#f5c400';
const feu = (f) => ` Feu ${f} (OpenStreetMap, à vérifier sur le livre des feux).`;
const IC = 'IC GPEN 2026', OSM = 'OpenStreetMap';
const aulne = (n, lat, lon, babord) => ({ name: `Aulne n° ${n}`, lat, lon, kind: babord ? 'lat-rouge' : 'lat-vert', color: babord ? ROUGE : VERT,
  note: `Latérale ${babord ? 'bâbord' : 'tribord'} du chenal de l’Aulne (48°${((lat - 48) * 60).toFixed(3).replace('.', ',')} N).`, src: OSM });
const MARKS = {
  FIL: { name: 'Plateau des Fillettes', lat: 48.3292, lon: -4.594233, kind: 'cardinale', color: JAUNE, src: IC,
    note: 'Cardinale ouest (bouée) du plateau des Fillettes, entre la passe nord et la passe sud du goulet : passer à l’ouest.' + feu('VQ(9) 10 s') },
  MEN: { name: 'Roche Mengam', lat: 48.338833, lon: -4.576, kind: 'tourelle', color: ROUGE, src: IC,
    note: 'Tourelle de danger isolé au milieu du goulet.' + feu('Fl(3) R 12 s') },
  KER: { name: 'Kerviniou', lat: 48.32965, lon: -4.587333, kind: 'lat-rouge', color: ROUGE, src: 'approx',
    note: 'Latérale bâbord. IC GPEN 2026 : 48°19,779 N 004°35,240 W ; OpenStreetMap : 48°19,788 N 004°35,193 W (60 m d’écart) : position des IC, à confirmer.' + feu('Fl R 2,5 s') },
  GOU: { name: 'Basse Goudron', lat: 48.333917, lon: -4.58045, kind: 'lat-rouge', color: ROUGE, src: OSM,
    note: 'Latérale bâbord du goulet.' + feu('Fl(2) R 6 s') },
  COR: { name: 'La Cormorandière', lat: 48.343483, lon: -4.529667, kind: 'balise', color: JAUNE, src: IC,
    note: 'Balise blanche devant la Pointe des Espagnols.' },
  PEN: { name: 'Pénoupèle', lat: 48.3574, lon: -4.508667, kind: 'lat-rouge', color: ROUGE, src: 'approx',
    note: 'Latérale bâbord « Basse Pennou Pell ». IC GPEN 2026 : 48°21,444 N 004°30,520 W ; OpenStreetMap : 48°21,400 N 004°30,500 W (85 m d’écart) : position des IC, à confirmer.' + feu('Fl(3) R 2,5 s') },
  REN: { name: 'Basse du Renard', lat: 48.329333, lon: -4.4845, kind: 'cardinale', color: JAUNE, src: IC,
    note: 'Cardinale ouest de la Basse du Renard : passer à l’ouest.' + feu('VQ(9) 10 s') },
  RON: { name: 'Île Ronde', lat: 48.320717, lon: -4.464617, kind: 'ilot', color: JAUNE, src: IC,
    note: 'Îlot devant la Pointe de l’Armorique (position des IC GPEN 2026).' },
  DAL: { name: 'Duc d’Albe de Lanvéoc', lat: 48.297333, lon: -4.4525, kind: 'cardinale', color: JAUNE, src: IC,
    note: 'Cardinale nord : passer au nord.' + feu('VQ') },
  PAV: { name: 'Penn ar Vir', lat: 48.2959, lon: -4.414717, kind: 'cardinale', color: JAUNE, src: OSM,
    note: 'Cardinale nord. Interdit de naviguer entre cette marque et la pointe du même nom (IC GPEN, tous les parcours).' + feu('Q') },
  LA1: { name: 'Lanvéoc 1', lat: 48.31775, lon: -4.478067, kind: 'lat-vert', color: VERT, src: OSM, note: 'Latérale tribord du chenal de Lanvéoc.' + feu('Fl G 4 s') },
  LA3: { name: 'Lanvéoc 3', lat: 48.313217, lon: -4.472683, kind: 'lat-vert', color: VERT, src: OSM, note: 'Latérale tribord du chenal de Lanvéoc.' + feu('Fl(5) G 20 s') },
  LA5: { name: 'Lanvéoc 5', lat: 48.308333, lon: -4.475833, kind: 'lat-vert', color: VERT, src: OSM, note: 'Latérale tribord du chenal de Lanvéoc.' + feu('Fl(3) G 12 s') },
  LA4: { name: 'Lanvéoc 4', lat: 48.2991, lon: -4.474933, kind: 'lat-rouge', color: ROUGE, src: OSM, note: 'Latérale bâbord du chenal de Lanvéoc.' + feu('VQ R') },
  ILE: { name: 'Île Longue Est', lat: 48.30495, lon: -4.493583, kind: 'lat-rouge', color: ROUGE, src: OSM,
    note: 'Latérale bâbord à l’est de l’Île Longue, à côté de la zone interdite.' + feu('Fl(2) R 6 s') },
  AU4: aulne(4, 48.306517, -4.369317, true), AU6: { ...aulne(6, 48.308417, -4.345317, true), src: IC },
  AU8: aulne(8, 48.311983, -4.32105, true), AU10: aulne(10, 48.311183, -4.311867, true), AU12: aulne(12, 48.30825, -4.299767, true),
  AU14: aulne(14, 48.304983, -4.29215, true), AU16: aulne(16, 48.30305, -4.2653, true),
  AU1: aulne(1, 48.30995, -4.314967, false), AU3: aulne(3, 48.307133, -4.29925, false), AU5: aulne(5, 48.304183, -4.2956, false), AU7: aulne(7, 48.301083, -4.2683, false),
  OCE: { name: 'Océanopolis', lat: 48.375333, lon: -4.4455, kind: 'lat-vert', color: VERT, src: IC, note: 'Latérale tribord devant le port du Moulin Blanc.' + feu('Iso G 4 s') },
  R1: { name: 'R1', lat: 48.363933, lon: -4.4714, kind: 'lat-vert', color: VERT, src: OSM, note: 'Latérale tribord du chenal « R » devant le port de Brest.' + feu('Fl(2) G 6 s') },
  R3: { name: 'R3', lat: 48.371683, lon: -4.457167, kind: 'lat-vert', color: VERT, src: OSM, note: 'Latérale tribord du chenal « R ».' + feu('Fl(3) G 12 s') },
  R2: { name: 'R2', lat: 48.366917, lon: -4.478983, kind: 'lat-rouge', color: ROUGE, src: OSM, note: 'Latérale bâbord du chenal « R ».' + feu('Fl(2) R 6 s') },
  R4: { name: 'R4', lat: 48.3715, lon: -4.465283, kind: 'lat-rouge', color: ROUGE, src: OSM, note: 'Latérale bâbord du chenal « R ».' + feu('Fl(3) R 12 s') },
  R6: { name: 'R6', lat: 48.375867, lon: -4.464367, kind: 'lat-rouge', color: ROUGE, src: OSM, note: 'Latérale bâbord du chenal « R ».' + feu('Fl R 4 s') },
  FO3: { name: 'Forme 3', lat: 48.374683, lon: -4.455933, kind: 'cardinale', color: JAUNE, src: OSM, note: 'Cardinale sud : passer au sud.' + feu('Q(6)+LFl 15 s') },
  PAL: { name: 'Pen a Lan', lat: 48.325333, lon: -4.36975, kind: 'tourelle', color: JAUNE, src: OSM,
    note: 'Tourelle cardinale est des roches Le Bouc et La Chèvre : passer à l’est.' },
  MNZ: { name: 'Les Ménéziou', lat: 48.33895, lon: -4.3422, kind: 'tourelle', color: ROUGE, src: OSM, note: 'Tourelle de danger isolé.' },
  EVE: { name: 'L’Évêque', lat: 48.31225, lon: -4.338967, kind: 'amer', color: JAUNE, src: OSM, note: 'Amer blanc à terre, à côté de la roche La Coët.' },
};

// ───────── Dangers (étude § 2.2) : { name, lat, lon, note }
const DANGERS = [
  { name: 'Roche Mengam', lat: 48.338833, lon: -4.576, note: 'Roche au milieu du goulet, entre la passe nord et la passe sud, balisée par une tourelle de danger isolé : ne pas la serrer.' },
  { name: 'Plateau des Fillettes', lat: 48.3292, lon: -4.594233, note: 'Haut-fond à l’ouest du goulet, balisé par une cardinale ouest : passer à l’ouest de la bouée.' },
  { name: 'Basse du Renard', lat: 48.329333, lon: -4.4845, note: 'Haut-fond au nord-est de l’Île Longue, balisé par une cardinale ouest : passer à l’ouest de la bouée.' },
  { name: 'Les Ménéziou', lat: 48.33895, lon: -4.3422, note: 'Roches au nord de la zone A, balisées par une tourelle de danger isolé : s’en tenir à distance.' },
  { name: 'Pen a Lan (Le Bouc, La Chèvre)', lat: 48.325333, lon: -4.36975, note: 'Roches Le Bouc et La Chèvre, balisées par une tourelle cardinale est : passer à l’est.' },
  { name: 'Épave du « Furieux »', lat: 48.319483, lon: -4.431867, note: 'Épave signalée non dangereuse dans OpenStreetMap : notée pour mémoire, à vérifier sur la carte marine.' },
];

// ───────── Positions de ligne : centre de la zone A du GPEN (cercle J80), zones B et C des IC 2026 (entraînement)
const LINE_PRESETS = {
  zoneA: { label: 'Zone A du GPEN (centre)', lat: ZONE_A.lat, lon: ZONE_A.lon },
  zoneB: { label: 'Zone B du GPEN (Poulmic, IC 2026)', lat: 48.284, lon: -4.410833 },          // 48°17,040 N 004°24,650 W
  zoneC: { label: 'Zone C du GPEN (Moulin Blanc, IC 2026)', lat: 48.385333, lon: -4.422333 },  // 48°23,120 N 004°25,340 W
};

// ───────── Régimes de vent (étude § 3.6, D-14) : même forme que REGIMES de js/tactics.js, mais chaque conseil est { t, o } avec son origine :
// D donnée mesurée (Météo-France, Lanvéoc et Guipavas, mois de mai 2010-2026), M modèle de relief de l’app, C courant (atlas Shom 560),
// S source citée, H hypothèse à valider sur l’eau (affichée « à confirmer sur l’eau », étude piège 10). Tests exclusifs : chaque direction et
// chaque force trouvent exactement un régime. Pas de seuil de force du type mistral : aucun vent fort dominant en rade (§ 3.4).
const vent = (s) => !(s < 4);
const REGIMES = [
  { id: 'calme', name: 'Calme / très petit temps', test: (d, s) => s < 4,
    tips: [
      { t: 'Par beau temps, après un vent du matin d’est ou de nord-est, la brise d’ouest s’installe entre 13 h et 16 h : zone sans vent puis demi-tour, le nouveau vent arrive par l’ouest.', o: 'D' },
      { t: 'Sous 5 nd, le courant décide : 0,75 nd de courant vaut un cinquième de la vitesse du bateau.', o: 'C' },
      { t: 'Mouiller, ou chercher le courant faible quand il est contraire.', o: 'H' },
    ] },
  { id: 'suroit', name: 'Suroît (sud-ouest)', test: (d, s) => vent(s) && d >= 200 && d < 250,
    tips: [
      { t: 'Régime perturbé, le plus fort en moyenne (12 nd à Lanvéoc en mai).', o: 'D' },
      { t: 'Zone A : le vent passe par-dessus les collines de Lanvéoc (75 à 90 m, à 2,4 à 3,2 km) : environ 10 % de vent en moins et des trous dans le sud du cercle.', o: 'M' },
      { t: 'Zone B (Poulmic) très abritée.', o: 'M' },
      { t: 'Mer plate près de la côte sud.', o: 'H' },
    ] },
  { id: 'ouest', name: 'Ouest', test: (d, s) => vent(s) && d >= 250 && d < 290,
    tips: [
      { t: 'Secteur le plus fréquent en mai (20 % des heures de course à Lanvéoc).', o: 'D' },
      { t: 'Zone A dégagée, 8 à 10 km d’eau au vent : vent plus régulier, clapot.', o: 'M' },
      { t: 'C’est aussi la direction de la brise de l’après-midi (le plus souvent vers 15 h, maximum à 17-18 h) ; une fois établie, elle ne tourne pas régulièrement d’un côté.', o: 'D' },
      { t: 'Vent contre courant pendant le jusant (le jusant porte à l’ouest) : clapot plus dur.', o: 'C' },
    ] },
  { id: 'noroit', name: 'Noroît (nord-ouest)', test: (d, s) => vent(s) && d >= 290 && d < 340,
    tips: [
      { t: 'Le vent vient de la presqu’île de Plougastel (45 à 130 m) : zone A peu abritée.', o: 'M' },
      { t: 'Ciel de traîne : grains et rafales.', o: 'H' },
    ] },
  { id: 'nord', name: 'Nord', test: (d, s) => vent(s) && (d >= 340 || d < 20),
    tips: [
      { t: '« Très perturbé par l’effet vent de terre » (livret « Rade de Brest », voileaviron.org).', o: 'S' },
      { t: 'Zone A à 2 à 4 km sous le vent de Logonna et de la baie de Daoulas : oscillations, risées par paquets.', o: 'H' },
    ] },
  { id: 'nordet', name: 'Nordet (nord-est)', test: (d, s) => vent(s) && d >= 20 && d < 70,
    tips: [
      { t: 'Fréquent par temps anticyclonique (14 à 18 % des heures de course en mai).', o: 'D' },
      { t: 'Un quart de vent en moins dans le sud de la rade que sur le plateau de Guipavas.', o: 'D' },
      { t: 'Vent de terre : rafales et rotations.', o: 'H' },
    ] },
  { id: 'est', name: 'Est', test: (d, s) => vent(s) && d >= 70 && d < 120,
    tips: [
      { t: 'Vent canalisé par l’estuaire de l’Aulne (livret « Rade de Brest »).', o: 'S' },
      { t: 'Vent contre courant pendant le flot (le flot porte à l’est).', o: 'C' },
      { t: 'Force moyenne faible (7 nd à Lanvéoc en mai).', o: 'D' },
    ] },
  { id: 'sud', name: 'Sud et sud-est', test: (d, s) => vent(s) && d >= 120 && d < 200,
    tips: [
      { t: 'Le plus perturbé en zone A : relief de 62 à 93 m à 1,8 à 3 km, 10 à 13 % de vent en moins.', o: 'M' },
      { t: 'Plus de pression dans le nord du cercle, plus loin de la côte sud.', o: 'H' },
      { t: '« Les vents peuvent s’accélérer vers la baie de Roscanvel » (livret « Rade de Brest »).', o: 'S' },
      { t: 'Sud-est rare (3 % des heures de course en mai).', o: 'D' },
    ] },
];
// Vents prédéfinis pour la saisie manuelle (étude § 3.6) : [nom, direction, vent moyen, rafales] ; forces tirées des moyennes mesurées, rafales supposées
const PRESETS = [
  ['Suroît', 225, 14, 20], ['Ouest', 270, 12, 17], ['Brise d’ouest', 275, 9, 12], ['Noroît', 315, 12, 18], ['Nord', 0, 9, 14],
  ['Nordet', 45, 12, 17], ['Est', 90, 8, 12], ['Sud', 180, 10, 15], ['Petit temps', 90, 4, 6],
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
  // marée calculée dans l’app (D-13) : harmoniques du marégraphe de Brest (tools/build_maree.py, js/maree.js), fichier du pack
  maree: 'data/brest.maree.json',
  // courant de l’atlas 560 du Shom et fonds vrais (D-13, D-14c) : tools/build_courants.py, js/courant.js ; utilisés par le routage en 07-08
  courant: { header: 'data/brest.courants.json', bin: 'data/brest.courants.bin', fonds: 'data/brest.fonds.bin' },
  weather: {
    center: { lat: 48.298, lon: -4.3605 },
    grid: GRID,
    cellSelection: 'sea',
    marine: null,          // houle et courant d’Open-Meteo écartés dans la rade (D-13)
    live: null,            // aucune balise ouverte dans la rade (D-14b)
    key: 'rade.wx.brest.v1',
    snapshot: 'data/brest.wx-snapshot.json',
  },
  // maille du champ de vent et seuil « mer dégagée » (étude § 3.5, piège 1) : avec 4 000 m (Toulon), seules ~90 cellules de l’Iroise servent de
  // référence et la rade paraît déventée partout ; 1 500 m garde ~3 100 cellules de la rade et un facteur médian de l’eau de 0,95 à 1,0 (tests)
  wind: { cell: 150, openSea: 1500 },
  // cadrage initial de la 3D, en mètres depuis l’origine : centre de la zone A
  scene: { home: { target: { x: 6620, y: -3520 }, dist: 16000, portrait: { target: { x: 5200, y: -5600 }, dist: 34000, tilt: 0.5 } } },
  windRef: ZONE_A,
  // catalogue initial (non gelé : applyRegattaMarks et addBanane le modifient sur place, comme à Toulon)
  MARKS,
  COURSES: [],
  LINE_PRESETS,
  PLACES,
  FORBIDDEN_ZONES: ZONES,
  DANGERS,
  regimes: REGIMES,
  presets: PRESETS,
  texts: {
    centre: 'centre de la zone A', point: 'centre de la zone A',
    relief: 'relief bas (60 à 130 m : collines de Lanvéoc et de Crozon, presqu’île de Plougastel), dévents courts ; accélérations aux pointes et dans le goulet',
    origine: 'Conseils tirés de mesures, du modèle de relief et de l’atlas ; les hypothèses sont à confirmer sur l’eau.',
  },
  // autres sources (onglet Vent) : liens neutres, sans balise de Toulon
  links: [
    ['Bulletin côtier Météo-France', 'https://meteofrance.com/previsions-meteo-marine/bulletin/cotier'],
    ['Windy', 'https://www.windy.com/48.30/-4.36?48.30,-4.36,11'],
  ],
});
