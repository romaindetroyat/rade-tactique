// Rade de Bormes – Le Lavandou : descripteur léger du plan d’eau de l’espace Tofinou (D-10, D-11). Ni marée ni courant (marnage médian
// de 21 cm, étude § 4) : comme à Toulon, tout le code de marée et de courant reste inactif. Les données lourdes sont le pack `data/bormes.*`
// (08-03), téléchargé une fois puis lu hors réseau. Ici : identité, emprise, bornes de saisie, fichiers, météo, vent, cadrage 3D, lignes.
// Savoir local (08-07, D-13, D-14) : marques, lieux, zones interdites, dangers (étude 08-RESEARCH-PLAN-EAU.md § 2.3 à 2.6), puis régimes,
// vents prédéfinis et textes du lieu (§ 3.6, 3.7, 4.2) ; catalogue du Challenge de la Baie : 08-08. Rien n’est inventé : ce que l’étude ne
// donne pas est marqué à confirmer. Ne remplace pas les cartes et ouvrages nautiques officiels.

// Grille météo (tools/venues/bormes.json, bloc weather) : produit latitudes × longitudes, latitude d’abord (même ordre que js/weather.js)
const GRID = [];
for (const lat of [43.02, 43.06, 43.10, 43.14]) for (const lon of [6.30, 6.36, 6.42, 6.48, 6.54]) GRID.push({ lat, lon });

const dm = (d, m) => d + m / 60;                    // degrés et minutes décimales → degrés décimaux
const ll = ([lat, lon]) => ({ lat, lon });
const A_COMPLETER = 'à compléter sur carte marine';

// ───────── Zones interdites (étude § 2.5, D-14) : { name, note, desc, pts: [{ lat, lon }] }, évitées par le routage (zonesXY → route)
// Île du Levant, partie militaire : carte « Île du Levant » de la direction interrégionale de la mer (avril 2021), annexe de l’arrêté du préfet
// maritime 55/2021 du 29 mars 2021 ; coordonnées des zones reprises d’un projet d’arrêté de pêche de novembre 2024 qui recopie l’arrêté 55/2021.
// Zone 1 : bande de 200 m autour de l’île par l’est, du point 1 (43°01,494 N 006°26,663 E, calanque du Tablier) au point 2 (43°00,205 N
// 006°26,262 E, pointe Maupertuis). Contour extérieur : points 23 (43°03,224 N 006°30,614 E), 24 (43°03,512 N 006°30,695 E), 25 (43°03,296 N
// 006°32,338 E), 26 (43°02,499 N 006°32,218 E), 27 (43°02,520 N 006°30,880 E), 3 (43°02,682 N 006°30,760 E), 4 (43°02,116 N 006°31,174 E),
// 28 (43°02,219 N 006°31,336 E), 29 (43°01,898 N 006°32,155 E), 30 (43°01,209 N 006°31,046 E), 6 (43°01,321 N 006°30,990 E), 7 (42°59,618 N
// 006°26,262 E), puis le méridien 006°26,262 E jusqu’au point 2.
// Méthode (calcul fait une fois dans le dossier de travail de la session, résultat recopié ci-dessous ; projection de Bormes) :
// 1. bande de la côte nord : trait de côte de data/bormes.coast.json (ligne 2, de la calanque du Tablier à la pointe est), densifié tous les 5 m ;
//    pour chaque abscisse (pas de 10 m) du point 1 au point 23, limite nord de l’union des disques de 200 m centrés sur la côte ; suite simplifiée
//    (Douglas-Peucker, 10 m) puis relevée de 18 m, les sommets d’une portion nord-sud (vers 6,459° E) poussés vers le large : chaque point des
//    arêtes de la bande est à 200,8 à 233,6 m de la côte du pack ;
// 2. contour : point 1 (sur la côte), bande vers l’est, points 23, 24, 25, 26, puis 29, 30, 6, 7, point 2 (pointe Maupertuis, sur la côte), et
//    retour au point 1 en ligne droite par la terre de l’île (un seul point de ce segment en mer : le point 1, à 14 m du bord) ;
// 3. points 27, 3, 4 et 28 laissés de côté : dans l’ordre de l’étude le point 27 est à 1,8 m du segment 3 → 4 (contour qui se touche lui-même)
//    et l’échancrure 26 → 27 → 3 → 4 → 28 laisserait un couloir à l’est du Titan ; le segment 26 → 29 la ferme (tracé large) ;
// 4. zone 6 (navigation interdite du 1er septembre au 30 juin selon la carte) tenue interdite toute l’année (tracé large).
// Contrôles (tests/bormes.test.mjs) : phare du Titan dedans ; pointe de Port-Man, passe des Grottes, port de l’Ayguade et Héliopolis dehors.
const LEVANT = [
  [43.0249, 6.444383], [43.027, 6.444383], [43.027025, 6.444998], [43.027638, 6.446598], [43.027716, 6.447828], [43.028173, 6.448689],
  [43.029157, 6.44992], [43.029601, 6.45115], [43.029679, 6.452503], [43.029127, 6.45398], [43.02988, 6.454595], [43.030438, 6.455456],
  [43.03069, 6.456317], [43.030725, 6.457547], [43.031351, 6.458163], [43.032042, 6.458532], [43.03541, 6.45863], [43.036494, 6.458878],
  [43.037464, 6.459841], [43.038409, 6.460085], [43.040322, 6.461361], [43.040986, 6.462469], [43.041761, 6.463207], [43.043046, 6.465031],
  [43.044463, 6.465274], [43.046623, 6.466282], [43.047281, 6.467144], [43.047612, 6.468005], [43.047671, 6.468989], [43.047465, 6.469973],
  [43.047723, 6.470958], [43.048522, 6.471573], [43.050786, 6.474771], [43.051033, 6.475879], [43.05089, 6.476986], [43.050437, 6.477847],
  [43.049549, 6.478585], [43.049312, 6.479693], [43.049622, 6.481169], [43.049373, 6.483507], [43.050589, 6.486336], [43.050642, 6.488551],
  [43.051131, 6.490765], [43.051112, 6.492857], [43.052059, 6.494948], [43.05216, 6.495809], [43.052049, 6.496794], [43.05325, 6.498516],
  [43.053483, 6.499623], [43.053352, 6.500731], [43.053712, 6.501961], [43.054823, 6.50356], [43.055138, 6.504421], [43.055195, 6.505283],
  [43.054898, 6.50762], [43.054936, 6.508727], [43.054692, 6.509589], [43.054303, 6.510204],
  [dm(43, 3.224), dm(6, 30.614)], [dm(43, 3.512), dm(6, 30.695)], [dm(43, 3.296), dm(6, 32.338)], [dm(43, 2.499), dm(6, 32.218)],   // 23, 24, 25, 26
  [dm(43, 1.898), dm(6, 32.155)], [dm(43, 1.209), dm(6, 31.046)], [dm(43, 1.321), dm(6, 30.990)], [dm(42, 59.618), dm(6, 26.262)],  // 29, 30, 6, 7
  [dm(43, 0.205), dm(6, 26.262)],                                                                                                   // 2
].map(ll);
// Fort de Brégançon : arrêté du préfet maritime 192/2018 du 26 juillet 2018 (texte non trouvé) ; l’arrêté 110/2023 cite « la limite de la zone
// interdite » entre 43°05,341 N 006°19,392 E et 43°05,569 N 006°19,625 E, à l’est de l’îlot du fort (cap de Brégançon : 43°05,491 N 006°19,295 E,
// arrêté 110/2023). Méthode : ces deux points, puis un arc de 500 m autour du cap (relèvements 180° à 330°, tous les 30°, en mer), puis deux
// points sur la terre au nord du fort (43,0960 N 6,3260 E ; 43,0945 N 6,3280 E) qui ferment la zone par la côte. Tracé supposé hors des deux
// points connus : à compléter sur la carte marine.
const BREGANCON = [
  [dm(43, 5.569), dm(6, 19.625)], [dm(43, 5.341), dm(6, 19.392)],
  [43.086995, 6.321583], [43.087601, 6.318508], [43.089256, 6.316256], [43.091517, 6.315432], [43.093778, 6.316256], [43.095433, 6.318508],
  [43.096, 6.326], [43.0945, 6.328],
].map(ll);
const ZONES = [
  { name: 'Île du Levant — zone militaire', note: A_COMPLETER, pts: LEVANT,
    desc: 'Partie militaire de l’île du Levant : navigation, mouillage, baignade et plongée interdits toute l’année (zones 1 à 5 et 7 de l’arrêté du préfet maritime 55/2021) ; zone 6 interdite à la navigation du 1er septembre au 30 juin, tenue interdite toute l’année ici. Tracé large d’après les coordonnées reprises par le projet d’arrêté de 2024, bande de 200 m le long de la côte nord. L’ouest de l’île (Héliopolis, port de l’Ayguade) et la passe des Grottes restent libres. Lire l’arrêté en vigueur de la préfecture maritime.' },
  { name: 'Fort de Brégançon', note: A_COMPLETER, pts: BREGANCON,
    desc: 'Abords du fort de Brégançon réglementés (arrêté du préfet maritime 192/2018, texte non lu) : seule la limite citée par l’arrêté 110/2023, à l’est de l’îlot, est connue. Zone tracée large autour de l’îlot (500 m).' },
];

// ───────── Lieux nommés (étiquettes de la carte) : [nom, lat, lon, type] ; type : 1 ville, 2 cap ou pointe, 3 sommet, 4 plan d’eau
// Nœuds OpenStreetMap (ODbL) relevés par l’étude (§ 2.4, extrait du 26/11/2026). Sans nœud nommé, non placés (à relever sur le fond de carte) :
// baie de Bormes, La Favière, Saint-Clair, Aiguebelle, Pramousquier, passe de Bagaud, Héliopolis.
const PLACES = [
  ['Le Lavandou', 43.1384, 6.3701, 1], ['Bormes-les-Mimosas (village)', 43.1507, 6.3419, 1], ['La Londe-les-Maures', 43.1381, 6.2355, 1],
  ['Rayol-Canadel-sur-Mer', 43.1591, 6.4706, 1], ['Cavalaire-sur-Mer', 43.1723, 6.5319, 1],
  ['Cap Bénat', 43.0895, 6.3689, 2], ['Cap Blanc', 43.0865, 6.3645, 2], ['Pointe du Cristau', 43.0913, 6.3709, 2], ['Pointe du Pinet', 43.0988, 6.3680, 2],
  ['Pointe de l’Esquillette', 43.1025, 6.3691, 2], ['Pointe de la Ris', 43.1110, 6.3642, 2], ['Cap de Brégançon', 43.0916, 6.3216, 2],
  ['Pointe de la Galère (Brégançon)', 43.0897, 6.3318, 2], ['Pointe du Diable', 43.0978, 6.3240, 2], ['Pointe Pilon', 43.1370, 6.3780, 2],
  ['Pointe de Nard Viou', 43.1392, 6.3826, 2], ['Pointe de la Fossette', 43.1437, 6.3965, 2], ['Pointe du Layet', 43.1471, 6.4210, 2],
  ['Cap Nègre', 43.1425, 6.4391, 2], ['Pointe du Souffre', 43.1492, 6.4483, 2], ['Pointe de l’Écuelle', 43.1551, 6.4561, 2],
  ['Pointe de Malpague', 43.1545, 6.4716, 2], ['Pointe du Trésor', 43.1520, 6.4866, 2], ['Pointe de la Chappe', 43.1513, 6.4925, 2],
  ['Pointe du Dattier', 43.1562, 6.5091, 2], ['Pointe de Vergeron', 43.1857, 6.5779, 2], ['Cap des Mèdes (Porquerolles)', 43.0264, 6.2424, 2],
  ['Pointe du Titan (Levant)', 43.0414, 6.4922, 2], ['Île de Port-Cros', 43.0065, 6.3948, 2], ['Île de Bagaud', 43.0113, 6.3639, 2],
  ['Île du Levant', 43.0283, 6.4718, 2], ['Îlot de la Gabinière', 42.9882, 6.3952, 2], ['Îlot la Fourmigue', 43.1060, 6.4043, 2],
  ['Pierre d’Avenon (443 m)', 43.1586, 6.3698, 3], ['Biscarre (482 m)', 43.1743, 6.4526, 3], ['Malatra (492 m)', 43.1816, 6.5000, 3],
  ['L’Eau Blanche (527 m)', 43.1888, 6.5002, 3], ['Fortin de la Vigie, Port-Cros (199 m)', 42.9991, 6.4006, 3],
  ['Rade d’Hyères', 43.0915, 6.2303, 4], ['Baie du Gau', 43.1064, 6.3621, 4], ['Baie de l’Estagnol', 43.1082, 6.2967, 4],
  ['Anse de Cavalière', 43.1455, 6.4301, 4], ['Baie de Cavalaire', 43.1785, 6.5716, 4], ['Rade de Port-Cros', 43.0086, 6.3813, 4],
  ['Baie de Port-Man', 43.0102, 6.4133, 4], ['Passe des Grottes', 43.0091, 6.4250, 4],
];

// ───────── Marques (étude § 2.3, D-13, piège 7) : { name, lat, lon, kind, color, note, src }, comme MARKS de Toulon et de Brest
// Clés courtes NON numériques (jamais une bouée du cahier CVAT ni une clé de la banane A, B, C, D, PG, PD, S, ni X1… d’une régate).
// Fixes : La Fourmigue (arrêté 110/2023 et OpenStreetMap, identiques) et le coffre 1 (annexe des parcours du Challenge de la Baie, une seule
// source). Bouées mouillées par le comité (« bouées cylindriques orange siglées Yacht Club Lavandou ») : `src: 'approx'`, position à confirmer
// par les marques de la régate du jour (REG-04) ; le recalage partagé reste propre au cahier CVAT de Toulon.
// La Fourmigue est une cellule de terre du pack (îlot) : comme la Roche Mengam à Brest (tourelle sur la grille de 30 m), le routage l’atteint
// quand même — l’arrivée est testée avant la terre (js/router.js) — et la route s’arrête sur la marque (tests/bormes.test.mjs).
const ROUGE = '#e03131', JAUNE = '#f5c400';
const MOUILLEE = 'Bouée mouillée par le comité (bouée cylindrique orange siglée Yacht Club Lavandou) : position à confirmer (marques de la régate du jour).';
const MARKS = {
  FOU: { name: 'La Fourmigue', lat: dm(43, 6.362), lon: dm(6, 24.252), kind: 'tourelle', color: ROUGE, src: 'Arrêté 110/2023',
    note: 'Balise de danger isolé sur l’îlot de la Fourmigue, au milieu de la baie, marque de la plupart des parcours : ne pas la serrer. Feu Fl(2) 6 s (OpenStreetMap, à vérifier sur le livre des feux).' },
  COF: { name: 'Coffre 1', lat: dm(43, 5.113), lon: dm(6, 16.767), kind: 'balise', color: JAUNE, src: 'Parcours du Challenge de la Baie',
    note: 'Coffre d’amarrage en rade d’Hyères, au sud de Léoube (parcours 5 et 7). Position de l’annexe des parcours (une seule source) : à confirmer sur l’eau.' },
  DAM: { name: 'La Dame', lat: dm(43, 0.399), lon: dm(6, 25.24), kind: 'tourelle', color: JAUNE, src: 'OpenStreetMap',
    note: 'Tourelle cardinale est de la roche La Dame, à 0,44 M au sud de la pointe de Port-Man : passer à l’est. « Sa cardinale » des parcours 6 et 10 (tour de Port-Cros) : à confirmer au club.' },
  CNE: { name: 'Bouée de cap Nègre', lat: 43.137, lon: 6.447, kind: 'gonflable', color: JAUNE, src: 'approx',
    note: `Au sud du cap Nègre (parcours 1), position lue sur le croquis. ${MOUILLEE}` },
  BEN: { name: 'Bouée de Bénat', lat: 43.09, lon: 6.38, kind: 'gonflable', color: JAUNE, src: 'approx',
    note: `Devant le cap Bénat (parcours 2) : position supposée, cohérente avec la longueur annoncée du parcours (6,2 M). ${MOUILLEE}` },
  CAV: { name: 'Bouée Cavalaire', lat: 43.17, lon: 6.55, kind: 'gonflable', color: JAUNE, src: 'approx',
    note: `Baie de Cavalaire (parcours 9), position lue sur le croquis. ${MOUILLEE}` },
  ORA: { name: 'Bouée orange', lat: 43.119517, lon: 6.3926, kind: 'gonflable', color: JAUNE, src: 'approx',
    note: `Parcours 3 et 10 : aucune position publiée ; placée au milieu du segment ligne du Lavandou – La Fourmigue. ${MOUILLEE}` },
};

// ───────── Dangers (étude § 2.5, § 2.6) : { name, lat, lon, note }. Sèche de Gouron (« devant Bormes », nom lu sur l’extrait de carte du parcours 9) :
// aucune position relevée, non placée : à lire sur la carte marine.
const DANGERS = [
  { name: 'La Fourmigue', lat: dm(43, 6.362), lon: dm(6, 24.252), note: 'Îlot et roches au milieu de la baie, balise de danger isolé : c’est aussi la marque de presque tous les parcours, à ne pas serrer.' },
  { name: 'Îlot du Cristau', lat: 43.0911, lon: 6.3721, note: 'Îlot au ras de la pointe est du cap Bénat.' },
  { name: 'La Dame', lat: dm(43, 0.399), lon: dm(6, 25.24), note: 'Roche à l’est de Port-Cros, tourelle cardinale est : passer à l’est.' },
  { name: 'Rocher du Rascas', lat: 43.0144, lon: 6.3892, note: 'Îlot au nord de Port-Cros, réserve intégrale du parc national.' },
  { name: 'Îlot de la Gabinière', lat: 42.9882, lon: 6.3952, note: 'Îlot au sud de Port-Cros, réserve intégrale du parc national, plongeurs.' },
  { name: 'L’Esquillade', lat: dm(43, 3.039), lon: dm(6, 31.95), note: 'Tourelle de danger isolé à l’est du Levant, dans la zone militaire (zone 6).' },
  { name: 'Roches au sud du port de Bormes', lat: dm(43, 7.2), lon: dm(6, 21.818), note: 'Cardinale sud sans nom dans OpenStreetMap, au sud du port de Bormes : ce qu’elle garde est à lire sur la carte marine.' },
  { name: 'Batterie des Maures', lat: 43.1094, lon: 6.2845, note: 'Îlots et hauts-fonds entre Brégançon et Léoube, sur la route du coffre 1 (cardinale ouest de la Batterie des Maures).' },
  { name: 'Îlots de Léoube, de l’Estagnol et du Jardin', lat: 43.105, lon: 6.302, note: 'Îlots et hauts-fonds entre 6,299 et 6,305° E, sur la route du coffre 1.' },
  { name: 'Parc national de Port-Cros', lat: 43.0065, lon: 6.3948, note: 'Pas de zone interdite à la voile, mais vitesse limitée à 5 nd à moins de 300 m des côtes et à 12 nd dans les 600 m (cœur marin, bateaux propres), pas de débarquement à Bagaud (réserve intégrale, comme la Gabinière et le Rascas), petites zones de circulation et de mouillage interdits et zones temporaires possibles (dépliant « Réglementation marine » 2025 du parc). À compléter sur carte marine.' },
];

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
  MARKS,
  COURSES: [],
  LINE_PRESETS,
  PLACES,
  FORBIDDEN_ZONES: ZONES,
  DANGERS,
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
