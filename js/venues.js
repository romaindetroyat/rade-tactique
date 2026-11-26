// Registre des plans d’eau (D-03) : Toulon est décrit PAR RÉFÉRENCE aux objets de js/courses.js et aux fichiers data/ actuels
// (rien ne déménage, garde SNPM) ; Brest et Bormes viennent de leurs modules légers js/venue-brest.js et js/venue-bormes.js.
// Fonctions pures : aucun état ici. Le plan d’eau courant est porté par js/lieu.js ; les plans d’eau ouverts, par l’espace (js/espaces.js) :
// chaque fonction reçoit la liste des plans d’eau de l’espace (`ids`, par défaut ceux de l’espace courant, Naos tant qu’il n’est pas fixé).

import { MARKS, COURSES, LINE_PRESETS, PLACES, FORBIDDEN_ZONE, DANGERS } from './courses.js';
import { BREST } from './venue-brest.js';
import { BORMES } from './venue-bormes.js';
import { ESPACE } from './espaces.js';

// Grille météo de Toulon : mêmes points, dans le même ordre, que la v42 (js/weather.js)
const GRID_TOULON = [];
for (const lat of [43.045, 43.065, 43.085, 43.100]) for (const lon of [5.885, 5.920, 5.955, 5.990, 6.030, 6.075]) GRID_TOULON.push({ lat, lon });

const TOULON = Object.freeze({
  id: 'toulon',
  nom: 'Rade de Toulon',
  origin: { lat: 43.09, lon: 5.95 },
  bounds: { south: 43.0, north: 43.18, west: 5.8, east: 6.1 },        // emprise de data/meta.json
  inputBounds: { south: 42.9, north: 43.28, west: 5.7, east: 6.2 },   // RADE de js/marks.js (sans nom : message de Toulon par défaut)
  exemple: null,
  files: { base: 'data/' },
  weather: {
    center: { lat: 43.085, lon: 5.958 },
    grid: GRID_TOULON,
    cellSelection: null,
    marine: 'latitude=43.06&longitude=5.96',
    live: { south: 42.98, north: 43.22, west: 5.7, east: 6.25 },
    key: 'rade.wx.v1',
    snapshot: 'data/wx-snapshot.json',
  },
  wind: {},               // défauts de js/wind.js
  scene: null,            // défauts de js/scene3d.js
  windRef: { lat: 43.088, lon: 5.962 },
  MARKS, COURSES, LINE_PRESETS, PLACES,
  // zone de Saint-Mandrier : MÊMES points, même ordre que la v42 (pts est l’objet de js/courses.js) ; ni note ni description (textes de la v42)
  FORBIDDEN_ZONES: [{ name: 'Presqu’île de Saint-Mandrier', note: null, desc: null, pts: FORBIDDEN_ZONE }],
  DANGERS,
  regimes: null,          // null = REGIMES de js/tactics.js
  presets: null,
  texts: null,
  links: null,             // liens « Autres sources » de la v42
});

export const VENUES = Object.freeze({ toulon: TOULON, brest: BREST, bormes: BORMES });
export const VENUE_IDS = ['toulon', 'brest', 'bormes'];

// Liste des plans d’eau ouverts : celle reçue, sinon celle de l’espace courant (une fonction passée à .some, .map… reçoit un rang à la place)
const liste = (ids) => (Array.isArray(ids) ? ids : ESPACE.venues);
// Plan d’eau d’un identifiant, seulement s’il est connu et ouvert à l’espace
const ouvert = (id, ids) => typeof id === 'string' && Object.hasOwn(VENUES, id) && liste(ids).includes(id);
// Plan d’eau lu au démarrage dans rade.state : liste blanche bornée aux plans d’eau de l’espace (un identifiant inconnu, hostile — `__proto__`
// compris — ou d’un autre espace donne le plan d’eau par défaut de l’espace : Toulon pour Naos, comme en v43)
export const bootVenue = (st, espace = ESPACE) => (ouvert(st?.venue, espace.venues) ? st.venue : espace.venueDefaut);

// Carte « État de la mer » (D-11, D-12) : lieu du point marin et note du courant du plan d’eau (`texts.mer`, `texts.courant`) ; sans eux,
// les textes de Toulon de la v43 à l’identique (Brest n’a pas de point marin : pas de carte)
const MER_TOULON = Object.freeze({ lieu: 'large de Cépet', note: 'Courant de surface modélisé (Copernicus) : faible en rade, à vérifier sur les bouées.' });
export const merTexte = (v) => (v?.texts?.mer ? { lieu: v.texts.mer, note: v.texts.courant ?? '' } : { ...MER_TOULON });

// Zones interdites → polygones en mètres pour le routage et la carte : { name, note, desc, pts: [{ lat, lon }] } → [[{ x, y }]]
export const zonesXY = (zones, xy) => zones.map((z) => z.pts.map((p) => xy(p.lat, p.lon)));

// Point dans des bornes { south, north, west, east } (bornes incluses, nombres finis)
export const inBounds = (b, lat, lon) => !!b && Number.isFinite(lat) && Number.isFinite(lon) && lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

// Identifiant du premier plan d’eau de l’espace dont l’emprise contient le point, sinon null
export const venueAt = (lat, lon, ids) => VENUE_IDS.find((id) => liste(ids).includes(id) && inBounds(VENUES[id].bounds, lat, lon)) ?? null;

const knownVenue = (r, ids) => ouvert(r?.venue, ids);
// Plan d’eau d’une régate sans champ ni bouées : Toulon (régates d’avant la v43) si l’espace l’a, sinon le premier plan d’eau de l’espace
const parDefaut = (ids) => (liste(ids).includes('toulon') ? 'toulon' : liste(ids)[0]);
// Plan d’eau désigné par les bouées CONFIRMÉES d’une régate (js/regmarks.js, status 'confirmee', position connue) : toutes dans les bornes de
// saisie d’un même plan d’eau, sinon null (aucune, ou mélange). Les bornes de saisie (emprise ± 0,1°) sont celles qui ont servi à les lire.
function venueOfMarks(r, ids) {
  const conf = (Array.isArray(r?.marks) ? r.marks : []).filter((m) => m?.status === 'confirmee' && Number.isFinite(m.lat) && Number.isFinite(m.lon));
  if (!conf.length) return null;
  return VENUE_IDS.find((id) => liste(ids).includes(id) && conf.every((m) => inBounds(VENUES[id].inputBounds, m.lat, m.lon))) ?? null;
}
// Plan d’eau d’une régate (D-06) : son champ `venue` (liste blanche), sinon celui de ses bouées confirmées (champ perdu par une copie v42),
// sinon Toulon (régates d’avant la v43) ; plans d’eau de l’espace seulement (une régate de Naos courue à Bormes reste à Toulon, comme en v43)
export function venueOf(r, ids) {
  if (knownVenue(r, ids)) return r.venue;
  return venueOfMarks(r, ids) ?? parDefaut(ids);
}
// Réparation hors course (07-05) : champ absent (ou inconnu) alors que les bouées confirmées désignent un autre plan d’eau que Toulon.
// Une régate de Toulon n’est jamais réécrite (absent = Toulon, forme de la v42) ; « toulon » écrit explicitement non plus.
export function needsVenueRepair(r, ids) {
  if (!r || knownVenue(r, ids)) return false;
  return venueOf(r, ids) !== 'toulon';
}
