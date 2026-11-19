// Registre des plans d’eau (D-03) : Toulon est décrit PAR RÉFÉRENCE aux objets de js/courses.js et aux fichiers data/ actuels
// (rien ne déménage, garde SNPM) ; Brest vient de son module léger js/venue-brest.js. Fonctions pures : aucun état ici.
// Le plan d’eau courant est porté par js/lieu.js.

import { MARKS, COURSES, LINE_PRESETS, PLACES, FORBIDDEN_ZONE, DANGERS } from './courses.js';
import { BREST } from './venue-brest.js';

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
  FORBIDDEN_ZONES: [FORBIDDEN_ZONE],
  DANGERS,
  regimes: null,          // null = REGIMES de js/tactics.js
  presets: null,
  texts: null,
  links: null,             // liens « Autres sources » de la v42
});

export const VENUES = Object.freeze({ toulon: TOULON, brest: BREST });
export const VENUE_IDS = ['toulon', 'brest'];

// Plan d’eau lu au démarrage dans rade.state : liste blanche (un identifiant inconnu ou hostile, `__proto__` compris, donne Toulon)
export const bootVenue = (st) => (typeof st?.venue === 'string' && Object.hasOwn(VENUES, st.venue) ? st.venue : 'toulon');

// Point dans des bornes { south, north, west, east } (bornes incluses, nombres finis)
export const inBounds = (b, lat, lon) => !!b && Number.isFinite(lat) && Number.isFinite(lon) && lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

// Identifiant du premier plan d’eau dont l’emprise contient le point, sinon null
export const venueAt = (lat, lon) => VENUE_IDS.find((id) => inBounds(VENUES[id].bounds, lat, lon)) ?? null;

const knownVenue = (r) => typeof r?.venue === 'string' && Object.hasOwn(VENUES, r.venue);
// Plan d’eau désigné par les bouées CONFIRMÉES d’une régate (js/regmarks.js, status 'confirmee', position connue) : toutes dans les bornes de
// saisie d’un même plan d’eau, sinon null (aucune, ou mélange). Les bornes de saisie (emprise ± 0,1°) sont celles qui ont servi à les lire.
function venueOfMarks(r) {
  const conf = (Array.isArray(r?.marks) ? r.marks : []).filter((m) => m?.status === 'confirmee' && Number.isFinite(m.lat) && Number.isFinite(m.lon));
  if (!conf.length) return null;
  return VENUE_IDS.find((id) => conf.every((m) => inBounds(VENUES[id].inputBounds, m.lat, m.lon))) ?? null;
}
// Plan d’eau d’une régate (D-06) : son champ `venue` (liste blanche), sinon celui de ses bouées confirmées (champ perdu par une copie v42),
// sinon Toulon (régates d’avant la v43)
export function venueOf(r) {
  if (knownVenue(r)) return r.venue;
  return venueOfMarks(r) ?? 'toulon';
}
// Réparation hors course (07-05) : champ absent (ou inconnu) alors que les bouées confirmées désignent un autre plan d’eau que Toulon.
// Une régate de Toulon n’est jamais réécrite (absent = Toulon, forme de la v42) ; « toulon » écrit explicitement non plus.
export function needsVenueRepair(r) {
  if (!r || knownVenue(r)) return false;
  return venueOf(r) !== 'toulon';
}
