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

// Points de passage de l’app (08-08) : PAS des bouées. Les parcours 6 et 10 font le tour de Port-Cros et de Bagaud en laissant l’île et sa
// cardinale (La Dame) à tribord ; le routage ne connaît que des points à rejoindre : sans eux, il reviendrait par la passe des Grottes.
// Placés au large de la Gabinière (sud) et de Bagaud (ouest), en mer, hors des zones interdites : l’équipage passe où il veut au large de l’île.
const PASSAGE = 'Point de passage placé par l’app pour faire le tour de Port-Cros et de Bagaud en laissant l’île à tribord (parcours 6 et 10) : ce n’est pas une bouée, l’île se contourne au large selon la mer et le vent.';
MARKS.PCS = { name: 'Sud de la Gabinière (passage)', lat: 42.975, lon: 6.400, kind: 'passage', color: '#9aa5b1', src: 'Point de passage de l’app', note: PASSAGE };
MARKS.BAG = { name: 'Ouest de Bagaud (passage)', lat: 43.012, lon: 6.335, kind: 'passage', color: '#9aa5b1', src: 'Point de passage de l’app', note: PASSAGE };

// ───────── Catalogue du Challenge de la Baie 2026-2027 (08-08, D-13) : annexe « Parcours 1 à 10 » (28 septembre 2024, en ligne pour 2026-2027),
// étude § 2.2. Le comité affiche le numéro au signal d’avertissement ; suivi de « R », le parcours se court en sens inverse (marques dans
// l’ordre inverse, côtés échangés). Pas de parcours 8 (absent de l’annexe). Identifiants : numéro officiel ; sens inverse = numéro + 50 ;
// parcours 5 du groupe croisière = 25 (sens inverse 75) ; tous entiers, inférieurs à 90 (banane de l’app) et uniques à Bormes.
// Séquences : [marque, côté] comme le cahier de Toulon (assistant `s()` de js/courses.js, recopié ici : ce fichier-là est figé).
const s = (str) => str.split(',').map((x) => x.trim()).map((x) => [x.slice(0, -1), x.slice(-1)]);
const inverse = (seq) => [...seq].reverse().map(([m, c]) => [m, c === 'b' ? 't' : 'b']);
const DEPART = 'Départ entre le bateau comité et la bouée cylindrique orange';
const ARRIVEE = 'arrivée sur la ligne de départ (entre bateau comité et bouée cylindrique orange)';
const PAVILLONS = 'Pavillon D : bouée de dégagement ; pavillon vert : dégagement à laisser à tribord. Bouées mouillées : positions à confirmer.';
const COTE = { b: 'bâbord', t: 'tribord' };
const decrit = (seq) => seq.map(([m, c]) => `${MARKS[m].name} à ${COTE[c]}`).join(', ');
const COTIERS = [
  { n: 1, titre: 'cap Nègre, La Fourmigue', seq: s('CNEt,FOUt'), annonce: '7,8 M' },
  { n: 2, titre: 'Bénat, La Fourmigue', seq: s('BENb,FOUb'), annonce: '6,2 M' },
  { n: 3, titre: 'La Fourmigue, bouée orange', seq: s('FOUt,ORAt,FOUt'), annonce: '4 à 8 M' },
  { n: 5, id: 5, titre: 'coffre 1 (groupe régate)', seq: s('FOUt,COFb,FOUb'), groupe: 'régate' },
  { n: 5, id: 25, titre: 'coffre 1 (groupe croisière)', seq: s('COFb'), groupe: 'croisière' },
  { n: 6, titre: 'tour de Port-Cros', seq: s('FOUt,DAMt,PCSt,BAGt'), annonce: '20 M', note: 'Port-Cros et sa cardinale (La Dame) à tribord : tour de Port-Cros et de Bagaud.' },
  { n: 7, titre: 'La Fourmigue, coffre 1', seq: s('FOUt,COFt,FOUb'), annonce: '16,5 M' },
  { n: 9, titre: 'Cavalaire, La Fourmigue', seq: s('CAVt,FOUt'), annonce: 'environ 20 M' },
  { n: 10, titre: 'Port-Cros, bouée orange, La Fourmigue', seq: s('DAMt,PCSt,BAGt,ORAt,FOUt'), note: 'Port-Cros et sa cardinale (La Dame) à tribord : tour de Port-Cros et de Bagaud.' },
];
const cotier = ({ n, id = n, titre, seq, annonce, groupe, note }, sens) => {
  const R = sens === 'R', q = R ? inverse(seq) : seq;
  return {
    id: R ? id + 50 : id, title: R ? `Parcours ${n} R (sens inverse${groupe ? `, groupe ${groupe}` : ''})` : `Parcours ${n} — ${titre}`,
    both: true, line: 'lavandou', ...(annonce ? { annonce } : {}), seq: { G: q, P: q },
    text: `${R ? `Sens inverse du parcours ${n}${groupe ? ` du groupe « ${groupe} »` : ''} (« ${n} R » affiché par le comité). ` : groupe ? `Parcours ${n} du groupe « ${groupe} »${groupe === 'croisière' ? ' (retour direct)' : ''}. ` : ''}${DEPART}, ${decrit(q)}, ${ARRIVEE}.`
      + `${note ? ' ' + note + ' Sud de la Gabinière et ouest de Bagaud : points de passage de l’app, pas des bouées.' : ''}${annonce ? ` Longueur annoncée : ${annonce}.` : ''} ${PAVILLONS}`,
  };
};
// Parcours 4 : banane construite au vent (départ – bouée 1 au vent – bouée 2 – bouée 1 – arrivée), par le mécanisme de Brest (`built: 'BAN'`) :
// bouée 1 à la distance réglée (Dist. 1), sans dégagement, une seule bouée sous le vent (la bouée 2), deux tours, arrivée sur la ligne de départ.
// Côté des bouées : bâbord dans l’app (l’annexe ne le dit pas). Ligne : milieu de la baie (voir LINE_PRESETS).
const BANANE_4 = {
  id: 4, title: 'Parcours 4 — banane (construite)', laps: false, fixedLaps: 2, both: true, built: 'BAN', line: 'baie',
  ban: { off: false, side: 'b', gate: false, fin: 'depart' }, names: { B: '1', finish: 'Arrivée (ligne de départ)' },
  seq: { G: [['B', 'b'], ['S', 'b']], P: [['B', 'b'], ['S', 'b']] },
  text: `Construit au vent : ${DEPART}, bouée 1 au vent, bouée 2 sous le vent (« Bouée sous le vent »), bouée 1, ${ARRIVEE}. Dist. 1 : distance annoncée par le comité. Côté des bouées : bâbord dans l’app, à vérifier sur la fiche de course. Ligne au milieu de la baie (position à confirmer) tant que la ligne par défaut est gardée dans l’onglet Départ. ${PAVILLONS}`,
};
const COURSES = [
  ...COTIERS.slice(0, 3).map((c) => cotier(c)), BANANE_4, ...COTIERS.slice(3).map((c) => cotier(c)),
  ...COTIERS.map((c) => cotier(c, 'R')),
];

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

// ───────── Régimes de vent (étude § 3.6, D-12) : même forme qu’à Brest, chaque conseil { t, o } avec son origine : D mesure Météo-France
// (heures de course 2010-2026 au Levant, à Porquerolles, Hyères et Cap Camarat), M modèle de relief de l’app sur le pack, S source citée,
// H hypothèse à confirmer sur l’eau (affichée comme telle par tipText). Tests exclusifs, dans l’ordre de l’étude : chaque direction et chaque
// force trouvent exactement un régime. Le mistral vient ici de l’ouest (260° en médiane) : le test de Toulon (285 à 345°) ne le voit pas (piège 1).
// Par vent de sud à sud-est, le modèle retire probablement trop de vent dans la baie (piège 8) : signalé dans le conseil.
// À faire relire par un régatier de la baie (contrôle humain, 08-09).
const vent = (s) => !(s < 4);
const REGIMES = [
  { id: 'calme', name: 'Calme / très petit temps', test: (d, s) => s < 4,
    tips: [
      { t: 'Une journée sur deux de mai à septembre est une journée de brise en rade d’Hyères : elle s’installe vers midi par le sud-est et culmine à 9 à 11 nd entre 16 h et 18 h.', o: 'D' },
      { t: 'Elle tourne à droite, vers le sud-ouest : 10 à 25° en médiane entre 14 h et 18 h selon la station.', o: 'D' },
      { t: 'Le matin, vent de terre faible de nord à nord-ouest.', o: 'D' },
      { t: 'Le nouveau vent arrive par le large : rester au large de la baie plutôt qu’au pied des Maures.', o: 'H' },
    ] },
  { id: 'mistral', name: 'Mistral (ouest)', test: (d, s) => vent(s) && d >= 235 && d < 300 && s >= 14,
    tips: [
      { t: 'Ici le mistral vient de l’ouest, 260° en médiane, pas du nord-ouest.', o: 'D' },
      { t: '14 % des heures de course l’été, 17 % l’hiver à 17 nd et plus ; rafales à 1,5 fois le vent moyen, souvent 34 nd l’hiver.', o: 'D' },
      { t: 'Le massif du cap Bénat abrite la baie : 15 à 25 % de vent en moins devant Bormes et au milieu, 40 % dans l’anse du Gau ; vent plein au sud du cap et à 2 milles à l’est de La Fourmigue.', o: 'M' },
      { t: 'Il mollit vers l’est : Cavalaire reçoit environ 60 à 70 % du vent des îles, tourné au sud-ouest.', o: 'D' },
      { t: 'Rafales qui tombent du relief, mer plate sous Bénat.', o: 'H' },
    ] },
  { id: 'ouest', name: 'Ouest modéré', test: (d, s) => vent(s) && d >= 235 && d < 300 && s < 14,
    tips: [
      { t: 'Même abri du cap Bénat : plus de pression au large de la baie et vers La Fourmigue.', o: 'M' },
      { t: 'C’est aussi la direction de la brise de fin d’après-midi au Levant.', o: 'D' },
      { t: 'Vent irrégulier près de la côte de Bormes.', o: 'H' },
    ] },
  { id: 'nord', name: 'Nord-ouest à nord (vent de terre)', test: (d, s) => vent(s) && (d >= 300 || d < 30),
    tips: [
      { t: 'Rare sur l’eau : 2 à 6 % des heures de course.', o: 'D' },
      { t: 'Les crêtes des Maures (450 à 520 m à 3 km) déventent toute la côte de Saint-Clair au Rayol : la moitié du vent en moins au ras de la côte, plus de vent au large.', o: 'M' },
      { t: 'Vent du petit matin avant la brise.', o: 'D' },
      { t: 'Rafales et rotations.', o: 'H' },
    ] },
  { id: 'est', name: 'Est', test: (d, s) => vent(s) && d >= 30 && d < 110,
    tips: [
      { t: 'Second régime du plan d’eau : 31 % des heures de course l’été, 35 % l’hiver, 070° à 080° quand il est fort.', o: 'D' },
      { t: 'La baie lui est ouverte : vent presque plein au milieu et à La Fourmigue, 18 % de moins devant Bormes, 30 % dans l’anse du Gau.', o: 'M' },
      { t: 'L’ouest du cap Bénat (Brégançon, coffre 1) est abrité : 15 à 20 % de moins.', o: 'M' },
      { t: 'Mesuré à Hyères : 24 à 38 % de vent en moins qu’au Levant.', o: 'D' },
      { t: 'Fort surtout d’octobre à avril (un tiers des heures d’est à 17 nd et plus).', o: 'D' },
      { t: 'La mer entre dans la baie.', o: 'H' },
    ] },
  { id: 'sudest', name: 'Sud-est (brise de midi)', test: (d, s) => vent(s) && d >= 110 && d < 160,
    tips: [
      { t: 'Direction de la brise à son arrivée, vers midi ; faible : 6 à 7 nd en moyenne.', o: 'D' },
      { t: 'Elle tourne à droite dans l’après-midi.', o: 'D' },
      { t: 'Le modèle annonce 20 % de vent en moins dans la baie et 20° de rotation à gauche : valeur incertaine pour une brise de mer, à confirmer sur l’eau.', o: 'M' },
    ] },
  { id: 'sud', name: 'Sud', test: (d, s) => vent(s) && d >= 160 && d < 200,
    tips: [
      { t: 'Passage entre la brise de sud-est et celle de sud-ouest ; fréquent l’après-midi à Camarat (18 %), rare au Levant (5 %).', o: 'D' },
      { t: 'Le modèle retire jusqu’à la moitié du vent au fond de la baie : probablement trop, à confirmer sur l’eau.', o: 'M' },
    ] },
  { id: 'suroit', name: 'Sud-ouest (brise de l’après-midi)', test: (d, s) => vent(s) && d >= 200 && d < 235,
    tips: [
      { t: 'Brise établie de l’après-midi : 35 % des heures de course l’été à Hyères, 9 à 11 nd vers 16 h.', o: 'D' },
      { t: 'La baie est sous le vent du massif de Bénat : 30 à 45 % de vent en moins devant Bormes et Le Lavandou, 15 % à La Fourmigue, vent normal 2 milles plus à l’est : aller chercher la pression au large.', o: 'M' },
      { t: 'À l’est du cap Nègre le sud-ouest est plus fort (Camarat : 14 nd en moyenne, un quart des heures à 17 nd et plus).', o: 'D' },
    ] },
];
// Vents prédéfinis pour la saisie manuelle (étude § 3.6) : [nom, direction, vent moyen, rafales] ; directions et forces tirées des mesures,
// rafales supposées
const PRESETS = [
  ['Mistral fort', 260, 24, 34], ['Mistral modéré', 265, 16, 23], ['Est', 75, 12, 17], ['Est fort', 70, 22, 30],
  ['Brise de sud-est', 130, 7, 9], ['Brise de sud-ouest', 220, 10, 13], ['Vent de terre', 330, 5, 8], ['Petit temps', 110, 4, 6],
];

// Lignes de départ : positions à confirmer sur l’eau (aucune n’est tirée d’une IC). « Devant Le Lavandou » est la ligne par défaut du plan
// d’eau (`lineDefaut`) : gardée, chaque parcours part de sa propre ligne (`line`), comme « Rade des Vignettes (défaut) » à Toulon.
// Milieu de la baie (08-08) : ligne de la banane n° 4, que l’étude ne place pas. Choisie au milieu de la baie (point de référence du vent) :
// à 1,1 M au moins de toute terre du pack dans toutes les directions, elle garde la marque au vent et la bouée sous le vent en mer par tous
// les vents à la distance par défaut (0,8 M) ; testé dans tests/bormes.test.mjs. Au-delà, l’alerte « tombe à terre » reste affichée.
const LINE_PRESETS = {
  lavandou: { label: 'Devant Le Lavandou (défaut, position à confirmer)', lat: 43.133, lon: 6.381 },
  faviere: { label: 'Devant Bormes – La Favière (position à confirmer)', lat: 43.123, lon: 6.376 },
  baie: { label: 'Milieu de la baie (banane n° 4, position à confirmer)', lat: 43.120, lon: 6.392 },
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
  // catalogue (non gelé : applyRegattaMarks et addBanane le modifient sur place) : parcours du Challenge de la Baie (08-08) puis la banane
  MARKS,
  COURSES,
  LINE_PRESETS,
  lineDefaut: 'lavandou',
  // classes du cahier CVAT de Toulon sans objet : tous les parcours du Challenge sont les mêmes pour tous les groupes (choix masqué)
  sansClasses: true,
  PLACES,
  FORBIDDEN_ZONES: ZONES,
  DANGERS,
  regimes: REGIMES,
  presets: PRESETS,
  // textes du lieu (étude § 3.6, § 4.2) ; `mer` et `courant` : carte « État de la mer » (point marin de la prévision, information seulement :
  // ni marée ni modèle de courant dans le routage, D-11). Courant : modèle de surface servi par Open-Meteo, maille de 8 km, du 26 août au
  // 28 novembre 2026 (médianes : 0,22 nd dans la baie ; 0,54 à 0,86 nd entre et au sud des îles, portant surtout à l’ouest)
  texts: {
    centre: 'milieu de la baie de Bormes', point: 'milieu de la baie de Bormes',
    relief: 'mur des Maures (450 à 520 m) à 3 km au nord, massif du cap Bénat (184 m) au sud-ouest, Port-Cros (190 m) et le Levant au sud',
    origine: 'Conseils tirés de mesures (Météo-France, 2010-2026) et du modèle de relief de l’app ; les hypothèses sont à confirmer sur l’eau.',
    mer: 'au large de la baie de Bormes',
    courant: 'Courant de surface modélisé (maille de 8 km) : faible dans la baie (0,2 nd en médiane) ; entre les îles et au sud de Port-Cros et du Levant, le courant général porte en général à l’ouest (0,5 à 0,9 nd en médiane), à prévoir sur les côtiers autour des îles. Information seulement : l’app n’en tient pas compte dans les routes ; à confirmer sur l’eau.',
  },
  // autres sources (onglet Vent) : liens neutres, sans balise de Toulon
  links: [
    ['Bulletin côtier Météo-France', 'https://meteofrance.com/previsions-meteo-marine/bulletin/cotier'],
    ['Windy', 'https://www.windy.com/43.12/6.39?43.12,6.39,11'],
  ],
});
