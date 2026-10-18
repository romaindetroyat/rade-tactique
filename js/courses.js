// Marques et parcours du Cahier de Parcours CVAT (V2, novembre 2025)
// et des Instructions de Course types (Coupe SNPM, 18/10/2026).
// Positions : coordonnées données par le CVAT quand elles existent,
// sinon positions OpenStreetMap / relevées sur les cartes du cahier (« approx »).

// Lieux nommés de la rade (étiquettes de la carte et localisation des effets de site) : [nom, lat, lon, type]
// type : 1 ville, 2 cap ou pointe, 3 sommet, 4 plan d'eau
export const PLACES = [
  ['Toulon', 43.1225, 5.930, 1], ['La Seyne-sur-Mer', 43.1000, 5.878, 1], ['Saint-Mandrier', 43.0770, 5.927, 1], ['Le Mourillon', 43.1075, 5.944, 2],
  ['Cap Cépet', 43.0676, 5.9465, 2], ['Cap Brun', 43.1020, 5.972, 2], ['Le Pradet', 43.1060, 6.020, 1], ['Carqueiranne', 43.0950, 6.073, 1],
  ['Les Sablettes', 43.0790, 5.893, 2], ['Tamaris', 43.0930, 5.900, 2], ['Mont Faron 584 m', 43.1497, 5.951, 3], ['Mont Coudon 702 m', 43.1609, 6.008, 3],
  ['Cap Sicié', 43.0460, 5.859, 2], ['Les Deux Frères', 43.0640, 5.8705, 2], ['Petite Rade', 43.1080, 5.912, 4], ['Grande Rade', 43.0930, 5.972, 4],
  ['Baie de la Garonne', 43.0915, 6.016, 4], ['Anse des Sablettes', 43.0730, 5.887, 4], ['Pointe Sainte-Marguerite', 43.1036, 5.992, 2], ['La Colle Noire', 43.0898, 6.0475, 3]
];

export const MARKS = {
  1: { name: 'Grande Jetée', lat: 43.097417, lon: 5.934150, kind: 'gonflable', color: '#f5c400',
       note: 'Bouée gonflable mouillée ~0,4 Nq dans l’Est de la Grande Jetée (43°05.845N 005°56.049E, fonds 12 m).', src: 'CVAT' },
  2: { name: 'GR3', lat: 43.093883, lon: 5.941883, kind: 'lat-vert', color: '#1f9d55',
       note: 'Bouée de chenal verte, 0,4 Nq au 122° de la bouée Grande Jetée.', src: 'CVAT (calculé)' },
  3: { name: 'GR1', lat: 43.090000, lon: 5.958667, kind: 'lat-vert', color: '#1f9d55',
       note: 'Bouée de chenal verte, dans le Nord de la bouée Grande Rade.', src: 'approx' },
  4: { name: 'Grande Rade', lat: 43.083480, lon: 5.958850, kind: 'eaux-saines', color: '#e03131',
       note: 'Bouée de chenal rouge et blanche (eaux saines).', src: 'OSM' },
  5: { name: 'GR2', lat: 43.076140, lon: 5.959440, kind: 'lat-rouge', color: '#e03131',
       note: 'Bouée de chenal rouge, Est de Saint-Mandrier.', src: 'OSM' },
  6: { name: 'Houlographe', lat: 43.053194, lon: 5.947083, kind: 'speciale', color: '#f5c400',
       note: 'Marque spéciale à 0,8 Nq dans le 170 du Cap Cépet.', src: 'relevé GPS du 18/10/2026 (±50 m)' },
  7: { name: 'Ste Marguerite', lat: 43.088607, lon: 5.993660, kind: 'speciale', color: '#f5c400',
       note: 'Marque spéciale « Émissaire de Sainte-Marguerite », au large de la pointe Sainte-Marguerite.', src: 'relevé GPS du 18/10/2026 (±50 m)' },
  8: { name: 'Renardière milieu', lat: 43.060917, lon: 5.922083, kind: 'speciale', color: '#f5c400',
       note: 'Marque spéciale 43°03,655N / 005°55,325E — au milieu des 3 bouées.', src: 'CVAT' },
  9: { name: 'Renardière sud', lat: 43.055917, lon: 5.920833, kind: 'speciale', color: '#f5c400',
       note: 'Marque spéciale 43°03,355N / 005°55,250E — la plus sud des 3 bouées.', src: 'CVAT' },
  10: { name: 'St Elme', lat: 43.071817, lon: 5.891800, kind: 'gonflable', color: '#f5c400',
       note: 'Coffre SNSM ou bouée CVAT (position recommandée 43°04.309N 005°53.508E, fonds 14 m). Précisions données par le Comité avant la procédure.', src: 'CVAT' },
  11: { name: 'Carqueiranne', lat: 43.081700, lon: 6.079000, kind: 'gonflable', color: '#f5c400',
       note: 'Bouée gonflable ~500 m dans le Sud du port de Carqueiranne (Les Salettes).', src: 'approx' },
};

// Ligne de départ par défaut : Rade des Vignettes, Sud des Anses du Mourillon.
// Le comité est à TRIBORD de la ligne (IC §10.2) ; la bouée blanche CCIV/CVAT à bâbord.
export const DEFAULT_LINE = { lat: 43.1015, lon: 5.9525, lengthNm: 0.12 };
export const LINE_PRESETS = {
  vignettes: { label: 'Rade des Vignettes (défaut)', lat: 43.1015, lon: 5.9525 },
  mourillon: { label: 'Sud des Anses du Mourillon (vent d’Ouest, parcours 9)', lat: 43.1012, lon: 5.9455 },
  capbrun: { label: 'Cap Brun – Anse Tabarly (parcours 10)', lat: 43.1003, lon: 5.9640 },
  grandrade: { label: 'Grande Rade (parcours construit 13)', lat: 43.0905, lon: 5.9700 },
};

// Zone interdite (presqu’île de Saint-Mandrier) — annexe A du cahier.
const dm = (d, m) => d + m / 60;
export const FORBIDDEN_ZONE = [
  [dm(43, 5.071), dm(5, 56.290)], [dm(43, 5.120), dm(5, 56.290)], [dm(43, 4.960), dm(5, 56.830)],
  [dm(43, 4.860), dm(5, 57.020)], [dm(43, 4.410), dm(5, 57.250)], [dm(43, 3.910), dm(5, 56.670)],
  [dm(43, 4.230), dm(5, 56.280)],
].map(([lat, lon]) => ({ lat, lon }));

export const DANGERS = [
  { name: 'Le Rascas', lat: dm(43, 3.950), lon: dm(5, 56.603), note: 'Rocher effleurant au sud immédiat de la Pointe du Rascas (Cap Cépet), en limite de zone interdite.' },
  { name: 'Banc de l’Âne', lat: 43.10403, lon: 5.92359, note: 'Cardinale — haut-fond devant la Petite Passe.' },
];

// Séquence : [marque, côté] ; côté 'b' = bâbord, 't' = tribord.
// 'GATE' = porte « ligne Départ/Arrivée » (point de réduction privilégié *).
const s = (str) => str.split(',').map((x) => x.trim()).map((x) => (x === 'GATE' ? ['GATE', null] : [x.slice(0, -1), x.slice(-1)]));

export const COURSES = [
  { id: 1, title: 'Parcours 1', laps: true, lapNm: 6, both: true, axis: 100,
    seq: { G: s('1b,2t,3t,7b'), P: s('1b,2t,3t,7b') },
    text: 'Ligne de départ, 1 bâbord, 2 tribord, 3 tribord, 7 bâbord, porte « ligne de Départ Arrivée » et nouveau tour ou ligne d’arrivée selon le nombre de tours. 1 tour = 6 Nq.' },
  { id: 2, title: 'Parcours 2', laps: true, lapNm: 6, both: true, axis: 280,
    seq: { G: s('7t,3b,2b,1t'), P: s('7t,3b,2b,1t') },
    text: 'Ligne de départ, 7 tribord, 3 bâbord, 2 bâbord, 1 tribord, porte « ligne de Départ Arrivée » et nouveau tour ou ligne d’arrivée. 1 tour = 6 Nq.' },
  { id: 3, title: 'Parcours 3', nm: { G: 15, P: 10 },
    seq: { G: s('1b,2t,3t,4t,5t,6b,7b,GATE,1b,2t,3t,7b'), P: s('1b,2t,3t,4t,5t,6b,7b') },
    text: 'Ligne de départ, 1 bâbord, 2 tribord, 3 tribord, 4 tribord, 5 tribord, 6 bâbord, 7 bâbord, porte*, 1 bâbord, 2 tribord, 3 tribord, 7 bâbord, ligne d’arrivée (P1/P2 : arrivée après 7).' },
  { id: 4, title: 'Parcours 4', nm: { G: 15, P: 10 },
    seq: { G: s('7t,6t,5b,4b,3b,2b,1t,GATE,7t,3b,2b,1t'), P: s('7t,6t,5b,4b,3b,2b,1t') },
    text: 'Ligne de départ, 7 tribord, 6 tribord, 5 bâbord, 4 bâbord, 3 bâbord, 2 bâbord, 1 tribord, porte*, 7 tribord, 3 bâbord, 2 bâbord, 1 tribord, ligne d’arrivée (P1/P2 : arrivée après 1).' },
  { id: 5, title: 'Parcours 5', nm: { G: 17.5, P: 11.5 },
    seq: { G: s('1b,2t,3t,4t,5t,8b,9b,6b,7b,GATE,1b,2t,3t,7b'), P: s('1b,2t,3t,4t,5t,8b,9b,6b,7b') },
    text: 'Ligne de départ, 1 bâbord, 2 tribord, 3 tribord, 4 tribord, 5 tribord, 8 bâbord, 9 bâbord, 6 bâbord, 7 bâbord, porte*, 1 bâbord, 2 tribord, 3 tribord, 7 bâbord, ligne d’arrivée.' },
  { id: 6, title: 'Parcours 6', nm: { G: 17.5, P: 11.5 },
    seq: { G: s('7t,6t,9t,8t,5b,4b,3b,2b,1t,GATE,7t,3b,2b,1t'), P: s('7t,6t,9t,8t,5b,4b,3b,2b,1t') },
    text: 'Ligne de départ, 7 tribord, 6 tribord, 9 tribord, 8 tribord, 5 bâbord, 4 bâbord, 3 bâbord, 2 bâbord, 1 tribord, porte*, 7 tribord, 3 bâbord, 2 bâbord, 1 tribord, ligne d’arrivée.' },
  { id: 7, title: 'Parcours 7', nm: { G: 20, P: 14.5 },
    seq: { G: s('1b,2t,3t,4t,5t,8b,10b,9b,6b,7b,3b,GATE,1b,2t,3t,7b,3b'), P: s('1b,2t,3t,4t,5t,8b,10b,9b,6b,7b,3b') },
    text: 'Ligne de départ, 1 bâbord, 2 tribord, 3 tribord, 4 tribord, 5 tribord, 8 bâbord, 10 bâbord, 9 bâbord, 6 bâbord, 7 bâbord, 3 bâbord, porte*, 1 bâbord, 2 tribord, 3 tribord, 7 bâbord, 3 bâbord, ligne d’arrivée.' },
  { id: 8, title: 'Parcours 8', nm: { G: 20, P: 14.5 },
    seq: { G: s('7t,6t,9t,10t,8t,5b,4b,3b,2b,1t,GATE,7t,3b,2b,1t'), P: s('7t,6t,9t,10t,8t,5b,4b,3b,2b,1t') },
    text: 'Ligne de départ, 7 tribord, 6 tribord, 9 tribord, 10 tribord, 8 tribord, 5 bâbord, 4 bâbord, 3 bâbord, 2 bâbord, 1 tribord, porte*, 7 tribord, 3 bâbord, 2 bâbord, 1 tribord, ligne d’arrivée.' },
  { id: 9, title: 'Parcours 9', nm: { G: 16, P: 10 }, line: 'mourillon', finishNear1: true,
    seq: { G: s('1b,2t,3t,7t,6t,7t,6t,5b,4b,3b,2b'), P: s('1b,2t,3t,7t,6t,5b,4b,3b,2b') },
    text: 'Ligne de départ (dans le Sud des Anses du Mourillon), 1 bâbord, 2 tribord, 3 tribord, 7 tribord, 6 tribord, 7 tribord, 6 tribord, 5 bâbord, 4 bâbord, 3 bâbord, 2 bâbord, ligne d’arrivée (près de la bouée 1). P1/P2 : un seul aller-retour 7–6.' },
  { id: 10, title: 'Parcours 10', laps: true, lapNm: 6, both: true, line: 'capbrun', built: 'D',
    seq: { G: s('3t,4t,5t,6b,5b,4b,3b,Db'), P: s('3t,4t,5t,6b,5b,4b,3b,Db') },
    text: '1 tour = départ entre Bateau Comité et D, 3 tribord, 4 tribord, 5 tribord, 6 bâbord, 5 bâbord, 4 bâbord, 3 bâbord, D bâbord puis tour suivant par la porte entre D et le Bateau Comité. Au dernier tour, après D, arrivée entre le Bateau Comité et A. Ligne idéalement entre Cap Brun et l’Anse Tabarly, par 8–12 m.' },
  { id: 11, title: 'Parcours 11', nm: { G: 19.5, P: 14 },
    seq: { G: s('7t,11t,3b,2b,1t,GATE,7t,3b,2b,1t'), P: s('7t,11t,3b,2b,1t') },
    text: 'Ligne de départ, 7 tribord, 11 tribord, 3 bâbord, 2 bâbord, 1 tribord, porte*, 7 tribord, 3 bâbord, 2 bâbord, 1 tribord, ligne d’arrivée.' },
  { id: 12, title: 'Parcours 12', nm: { G: 18, P: 13 },
    seq: { G: s('2t,3t,11t,6t,7b,3b,2b'), P: s('2t,3t,11t,3b,2b') },
    text: 'Ligne de départ, 2 tribord, 3 tribord, 11 tribord, 6 tribord, 7 bâbord, 3 bâbord, 2 bâbord, ligne d’arrivée (P1/P2 : sans 6 et 7).' },
  { id: 13, title: 'Parcours 13 (construit)', laps: true, both: true, built: 'WL', line: 'grandrade',
    seq: { G: s('Bb,Cb,Db'), P: s('Bb,Cb,Db') },
    text: 'Construit au vent. 1 tour = départ entre Bateau Comité et D, B bâbord, C bâbord, D bâbord puis tour suivant par la porte D–Bateau Comité. Au dernier tour, après D, arrivée entre Bateau Comité et A. Azimut/distance de B annoncés par le Comité. Une bouée rouge peut remplacer B (plus de dog-leg).' },
];

export const IC = {
  event: 'Coupe de la SNPM — CVAT',
  date: '2026-10-18',
  firstWarning: '10:55',
  lastFinishSignal: '16:00',
  vhf: 72,
  committee: 'Ludovic JEGO — tél./SMS 06 34 43 36 73',
  zone: 'Grande Rade de Toulon, à 1 Nq au Sud du Cap Cépet',
  classes: [
    ['P (P1/P2)', 'Pavillon blanc'],
    ['C – D1 / D2', 'Flamme numérique 1'],
    ['L / R1 R2 R3 – R4', 'Flamme numérique 2'],
  ],
  groups: ['G1 : C et D1', 'G2 : D2', 'G3 : L', 'G4 : R1 R2 R3 R4', 'G5 : P1', 'G6 : P2'],
  sequence: [
    ['H−5', 'Pavillon de classe + son', 'Avertissement'],
    ['H−4', 'P, I, U, Z ou Noir + son', 'Préparatoire'],
    ['H−1', 'Affalé du préparatoire + son', 'Dernière minute'],
    ['H', 'Pavillon de classe affalé + son', 'Départ'],
  ],
  keyRules: [
    'Ligne de départ : mât du Comité (pavillon orange, à tribord) — bouée blanche CCIV/CVAT. La bouée rouge à l’arrière du Comité fait partie du Comité.',
    'Ligne d’arrivée : mât du Comité (pavillon bleu) — bouée blanche CCIV/CVAT.',
    'Partir au plus tard 10 min après son signal de départ.',
    'Rester à l’écart de la zone de départ tant que son avertissement n’est pas donné.',
    'Parcours côtiers : pavillon « D » = bouée de dégagement. Pavillon VERT = la laisser à TRIBORD ; sans pavillon vert = à BÂBORD.',
    'Pénalité chap. 2 : un 360° (virement + empannage). Reconnaissance écrite obligatoire ensuite.',
    'Autres règles : pénalité de 20 % du temps de course.',
    'HFL = D × (C Len − C Rap) + HAP + BONI ; BONI = D × 2 min (min. 30 min).',
    'Temps compensé Osiris « temps sur distance » (sauf parcours construits), CVL appliqué. 1 course valide l’épreuve.',
    'Réduction de parcours (RCV 32.1 modifiée) : bateau Comité avec 2e substitut + pavillon de classe près d’une marque = porte de pointage. S sur H + 2 sons = course interrompue, dernier pointage = ordre d’arrivée.',
    'VHF obligatoire, veille canal 72 dès 30 min avant le 1er avertissement. Pavillon Y = brassière obligatoire (classe L : dès H−30 min).',
    'Pavillon « C » (ou blanc pour la classe P) au pataras ou hauban tribord.',
    'Bateaux de plongée possibles sur la zone : distance de sécurité. Être en régate ne donne aucune priorité sur les autres navires.',
    'Abandon : le signaler au Comité (VHF 72 ou téléphone).',
    'Résultats et prix : 18 h 30 à la SNPM, 87 allée de la Petite Mer, La Seyne.',
  ],
};
