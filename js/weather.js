// Prévisions : Open-Meteo (AROME HD 1,3 km de Météo-France et autres modèles), état de la mer,
// et vent mesuré en direct (balises Pioupiou / OpenWindMap). Mise en cache locale pour l’usage hors réseau.

import { toXY, rad, deg, norm360, norm180 } from './geo.js';

export const MODELS = [
  { id: 'meteofrance_arome_france_hd', label: 'AROME HD 1,3 km', weight: 3 },
  { id: 'meteofrance_arome_france', label: 'AROME 2,5 km', weight: 2 },
  { id: 'meteofrance_arpege_europe', label: 'ARPEGE', weight: 1 },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS', weight: 1 },
  { id: 'icon_eu', label: 'ICON-EU', weight: 1 },
  { id: 'gfs_seamless', label: 'GFS', weight: 0.5 },
];

// Points de grille sur la zone de course (AROME HD), pour la variabilité spatiale
export const GRID = [];
for (const lat of [43.045, 43.065, 43.085, 43.100]) for (const lon of [5.885, 5.920, 5.955, 5.990, 6.030, 6.075]) GRID.push({ lat, lon });

export const CENTER = { lat: 43.085, lon: 5.958 };
const KEY = 'rade.wx.v1';
const OM = 'https://api.open-meteo.com/v1/forecast';

const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchAll() {
  const common = 'wind_speed_unit=kn&timezone=Europe%2FParis&forecast_days=3';
  const models = MODELS.map((m) => m.id).join(',');
  const vars = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,cloud_cover,precipitation,pressure_msl,weather_code';
  const lats = GRID.map((p) => p.lat).join(','), lons = GRID.map((p) => p.lon).join(',');
  const [multi, grid, marine] = await Promise.allSettled([
    getJSON(`${OM}?latitude=${CENTER.lat}&longitude=${CENTER.lon}&hourly=${vars}&models=${models}&${common}`),
    getJSON(`${OM}?latitude=${lats}&longitude=${lons}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&models=meteofrance_arome_france_hd&${common}`),
    getJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=43.06&longitude=5.96&hourly=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&timezone=Europe%2FParis&forecast_days=3`),
  ]);
  if (multi.status !== 'fulfilled') throw multi.reason;
  const data = { fetched: Date.now(), multi: multi.value, grid: grid.status === 'fulfilled' ? grid.value : null, marine: marine.status === 'fulfilled' ? marine.value : null };
  save(KEY, data);
  return data;
}

export const cached = () => load(KEY);

// Instantané livré avec l’app (data/wx-snapshot.json) : secours sans réseau
export async function snapshot() {
  try { const r = await fetch('data/wx-snapshot.json'); return r.ok ? r.json() : null; } catch { return null; }
}

// Moyenne circulaire pondérée
export function circMean(dirs, weights) {
  let s = 0, c = 0, w = 0;
  dirs.forEach((d, i) => { if (d == null) return; const k = weights ? weights[i] : 1; s += k * Math.sin(rad(d)); c += k * Math.cos(rad(d)); w += k; });
  if (!w) return null;
  return { mean: norm360(deg(Math.atan2(s, c))), r: Math.hypot(s, c) / w };
}

// Série horaire consolidée au point central + écart entre modèles
export function consensus(data) {
  const h = data.multi.hourly;
  return h.time.map((time, i) => {
    const per = MODELS.map((m) => ({
      id: m.id, label: m.label, w: m.weight,
      dir: h[`wind_direction_10m_${m.id}`]?.[i], spd: h[`wind_speed_10m_${m.id}`]?.[i], gust: h[`wind_gusts_10m_${m.id}`]?.[i],
    })).filter((p) => p.dir != null && p.spd != null);
    const arome = per.find((p) => p.id === 'meteofrance_arome_france_hd') || per.find((p) => p.id === 'meteofrance_arome_france') || per[0];
    const cm = circMean(per.map((p) => p.dir), per.map((p) => p.w * Math.max(1, p.spd)));
    const spds = per.map((p) => p.spd);
    const mean = per.reduce((a, p) => a + p.spd * p.w, 0) / (per.reduce((a, p) => a + p.w, 0) || 1);
    const spreadDir = per.length ? Math.max(...per.map((p) => Math.abs(norm180(p.dir - (cm?.mean ?? 0))))) : 0;
    const spreadSpd = per.length ? Math.max(...spds) - Math.min(...spds) : 0;
    const v = (k) => h[`${k}_${MODELS[0].id}`]?.[i] ?? h[`${k}_${MODELS[1].id}`]?.[i] ?? h[`${k}_${MODELS[3].id}`]?.[i];
    return {
      time, per, arome, dir: arome?.dir, spd: arome?.spd, gust: arome?.gust,
      ensDir: cm?.mean, ensSpd: mean, spreadDir, spreadSpd,
      confidence: confidenceOf(spreadDir, spreadSpd, arome?.spd ?? 0),
      temp: v('temperature_2m'), cloud: v('cloud_cover'), rain: v('precipitation'), pmsl: v('pressure_msl'), code: v('weather_code'),
    };
  });
}

function confidenceOf(sd, ss, spd) {
  // vent faible + gros écart de direction = peu fiable
  let score = 100 - sd * (spd < 6 ? 0.9 : 1.2) - ss * 3;
  return Math.max(5, Math.min(100, Math.round(score)));
}

// Points de vent pour une heure (index dans la série). Retourne des points XY.
export function gridPoints(data, idx) {
  const g = data.grid;
  const arr = Array.isArray(g) ? g : g ? [g] : [];
  const pts = [];
  arr.forEach((loc) => {
    const h = loc.hourly; if (!h) return;
    const dir = h.wind_direction_10m[idx], spd = h.wind_speed_10m[idx], gust = h.wind_gusts_10m[idx];
    if (dir == null || spd == null) return;
    const { x, y } = toXY(loc.latitude, loc.longitude);
    pts.push({ x, y, dir, spd, gust });
  });
  return pts;
}

export function marineAt(data, time) {
  const m = data.marine?.hourly; if (!m) return null;
  const i = m.time.indexOf(time); if (i < 0) return null;
  return {
    hs: m.wave_height[i], dir: m.wave_direction[i], per: m.wave_period[i], wind: m.wind_wave_height?.[i], swell: m.swell_wave_height?.[i], swellDir: m.swell_wave_direction?.[i],
    cur: m.ocean_current_velocity?.[i] != null ? m.ocean_current_velocity[i] / 1.852 : null, curDir: m.ocean_current_direction?.[i], sst: m.sea_surface_temperature?.[i],
  };
}

// Balises de vent en direct autour de la rade (Pioupiou / OpenWindMap)
export async function fetchLive() {
  const j = await getJSON('https://api.pioupiou.fr/v1/live/all');
  return (j.data || []).filter((s) => {
    const l = s.location || {};
    return l.latitude > 42.98 && l.latitude < 43.22 && l.longitude > 5.7 && l.longitude < 6.25 && s.measurements?.wind_speed_avg != null;
  }).map((s) => ({
    id: s.id, name: s.meta?.name, lat: s.location.latitude, lon: s.location.longitude,
    date: s.measurements.date, spd: s.measurements.wind_speed_avg / 1.852, gust: s.measurements.wind_speed_max / 1.852,
    dir: s.measurements.wind_heading, ageMin: (Date.now() - Date.parse(s.measurements.date)) / 60000,
  }));
}

export const WMO = {
  0: 'Ciel clair', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert', 45: 'Brouillard', 48: 'Brouillard givrant',
  51: 'Bruine faible', 53: 'Bruine', 55: 'Bruine forte', 61: 'Pluie faible', 63: 'Pluie', 65: 'Forte pluie',
  80: 'Averses', 81: 'Averses', 82: 'Fortes averses', 95: 'Orage', 96: 'Orage + grêle', 99: 'Orage violent',
};
