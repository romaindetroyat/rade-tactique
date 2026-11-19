// Gel de Toulon v42 (phase 7, D-01) : tout ce que l’app calcule pour Toulon, partagé par la capture et par tests/toulon.test.mjs.
// Capture une seule fois sur le code extrait de 56f6625 (v42), jamais sur le code modifié :
//   node tests/helpers/toulon.mjs --capture <racine> <sortie>
// Les modules sont passés en paramètre : la même matrice tourne sur l’ancien et sur le nouveau code.
// Le fichier n’a pas « .test. » dans son nom : `npm test` ne le lance pas.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { legCases, serialLegs } from './legs.mjs';
import { BAN_CASES, legVue } from './banvue.mjs';

// Fichiers de données de Toulon (empreintes figées dans la fixture)
export const DATA_TOULON = Object.freeze(['meta.json', 'terrain.bin', 'cover.bin', 'coast.json', 'basemap.jpg', 'seamask.png', 'j80.pol', 'wx-snapshot.json']);

// Vents de la matrice : [direction, force] ; rafale = force × 1,3
export const VENTS = Object.freeze([[315, 25], [265, 14], [215, 10], [140, 14], [85, 12], [40, 6]]);
// Vents et paires de marques du cahier pour les routes ; maille de la grille d’échantillonnage du champ de vent (m)
const VENTS_ROUTES = [[315, 25], [215, 10], [140, 14], [40, 6]];
const PAIRES = [['1', '2'], ['3', '7'], ['9', '1'], ['11', '4'], ['2', '3'], ['7', '6'], ['6', '5'], ['4', '11'], ['10', '8'], ['5', '9']];
const GRILLE_M = 1500;
// Saisies de positions : marque du cahier, virgule décimale, ordre inversé, Brest (refusée à Toulon en v42), texte illisible
const SAISIES = ['43°05.845N 005°56.049E', '43°03,655N / 005°55,325E', '005°53.508E 43°04.309N', '48°17,890 N 004°21,630 W', 'quarante-trois nord'];
// Positions d’IC à juger : mer, Brest, terre à Toulon (Mont Faron), bords de la carte, hors carte
const POS_CHECK = [[43.09, 5.96], [48.29817, -4.3605], [43.1497, 5.951], [43.0, 5.8], [43.18, 6.1], [42.99, 5.95], [43.09, 6.11], [43.12, 5.93], [NaN, 5.9], [43.07, 5.89]];
// Parcours analysés comme runAnalysis : [id, classes, tours]
const ANALYSES = [[1, ['G'], 2], [3, ['G', 'P'], 2], [5, ['G'], 2], [7, ['G'], 2], [9, ['G', 'P'], 2], [12, ['G'], 2], [13, ['G', 'P'], 2], [90, ['G'], 3]];

const xy = (p) => ({ x: p.x, y: p.y });
const baseOf = (dir, spd) => ({ points: [{ x: 0, y: 0, dir, spd, gust: spd * 1.3 }] });

// Bords d’une banane : ceux de serialLegs, plus les deux bouées de chaque porte et la ligne d’arrivée décalée
const banBords = (B) => ({
  ...serialLegs(B),
  gates: B.legs.map((l) => (l.gate ? { g: [l.gate.g.x, l.gate.g.y, l.gate.g.side, l.gate.g.mark], d: [l.gate.d.x, l.gate.d.y, l.gate.d.side, l.gate.d.mark] } : null)),
  finishLine: B.finishLine ? JSON.parse(JSON.stringify(B.finishLine)) : null,
});

// Une analyse complète comme runAnalysis (js/app.js) sans DOM ni prévision : ligne, départ conseillé, conseil de porte, bords, passages de marque
function analyse(m, T, F, forbidden, course, cls, laps) {
  const { buildLegs, analyzeStart, prepareLeg, analyzeLeg, routeOf, markAdvice } = m.tactics;
  const { bearingXY, distXY, toXY } = m.geo;
  const preset = m.courses.LINE_PRESETS[course.line || 'vignettes'];
  const ctr = toXY(preset.lat, preset.lon), wLine = F.sample(ctr.x, ctr.y);
  const B = buildLegs(course, cls, { laps, windDir: wLine.dir, wlLengthNm: 0.8, ban: m.banane.cleanBan({}), line: { center: preset, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null } });
  const ctx = { terrain: T, forbidden, perf: 1, trend: 0, memo: new Map() };
  const start = analyzeStart(B.line, F, { ...B.legs[0] }, ctx);
  const L0 = B.line, first = B.legs[0], cands = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const p = { x: L0.pin.x + (L0.cb.x - L0.pin.x) * f, y: L0.pin.y + (L0.cb.y - L0.pin.y) * f };
    const r = routeOf(p, first.to, F, { terrain: T, forbidden, perf: 1 }, ctx);
    if (r) cands.push({ f, p, time: r.time });
  }
  let startPoint = null;
  if (cands.length) {
    const best = cands.reduce((a, b) => (b.time < a.time ? b : a)), mid = cands.find((c) => c.f === 0.5) || best;
    first.from = { ...best.p, name: 'Départ' };
    first.brg = bearingXY(first.from, first.to); first.dist = distXY(first.from, first.to);
    startPoint = { ...xy(best.p), f: best.f, gain: mid.time - best.time, times: cands.map((c) => c.time) };
  }
  const legs = []; let t = 11;
  for (const [k, leg] of B.legs.entries()) {
    prepareLeg(leg, legs[legs.length - 1], B.legs[k + 1], F, ctx);
    const a = analyzeLeg(leg, F, ctx);
    t += a.time / 3600;
    legs.push(a);
  }
  return {
    line: { c: xy(L0.c), cb: xy(L0.cb), pin: xy(L0.pin), face: L0.face },
    start: { lineBrg: start.lineBrg, len: start.len, bias: start.bias, gain: start.gain, favored: start.favored ?? null, advice: start.advice, wind: start.wind, startPoint },
    legs: legs.map(legVue),
    marks: legs.map((a, i) => markAdvice(a, legs[i + 1])),
    total: t - 11,
  };
}

// Toutes les sections du gel ; m = { geo, wind, tactics, router, courses, banane, regmarks, marks, icplaus, weather, T, F }
export async function toulonCases(m) {
  const { T, F } = m;
  const { COURSES, MARKS, LINE_PRESETS, FORBIDDEN_ZONE } = m.courses;
  const { buildLegs } = m.tactics;
  const { toXY } = m.geo;
  const forbidden = [FORBIDDEN_ZONE.map((p) => toXY(p.lat, p.lon))];          // zone interdite de l’app (js/app.js)

  // ── bords : parcours 1 à 13, variantes de ligne, régate archivée (legs.mjs) et banane en bords seuls (six réglages)
  const bords = legCases({ buildLegs, COURSES, MARKS, LINE_PRESETS, applyRegattaMarks: m.regmarks.applyRegattaMarks });
  const BAN = m.banane.addBanane([...COURSES]).find((c) => c.id === m.banane.BANANE_ID);
  const GR = LINE_PRESETS.grandrade;
  for (const c of BAN_CASES) {
    const B = buildLegs(BAN, 'G', { laps: c.laps, windDir: c.dir, ban: c.ban, line: { center: GR, lengthNm: 0.12, mode: 'wind' } });
    bords.push({ key: `90|G|${c.laps}|${c.dir}|${JSON.stringify(c.ban)}`, ...banBords(B) });
  }

  // ── analyses, champ de vent et routes : un seul calcul du champ par vent (vent manuel constant, effets de site au maximum)
  const analyses = [], vent = [], routes = [];
  const liste = m.banane.addBanane([...COURSES]);
  const pick = (w) => ({ spd: w.spd, dir: w.dir, gust: w.gust, shelter: w.shelter, block: w.block });
  const grille = [];
  for (let y = T.y1 - GRILLE_M / 2; y > T.y0; y -= GRILLE_M) for (let x = T.x0 + GRILLE_M / 2; x < T.x1; x += GRILLE_M) if (!T.isLand(x, y)) grille.push({ x, y });
  for (const [dir, spd] of VENTS) {
    F.compute(baseOf(dir, spd), { localEffects: 1 });
    const v = `${dir}/${spd}`;
    vent.push({
      key: v,
      marks: Object.entries(MARKS).map(([k, p]) => { const q = toXY(p.lat, p.lon); return [k, pick(F.sample(q.x, q.y))]; }),
      lines: Object.entries(LINE_PRESETS).map(([k, p]) => { const q = toXY(p.lat, p.lon); return [k, pick(F.sample(q.x, q.y))]; }),
      grid: grille.map((q) => [q.x, q.y, pick(F.sample(q.x, q.y))]),
    });
    if (VENTS_ROUTES.some(([d, s]) => d === dir && s === spd)) {
      for (const [a, b] of PAIRES) {
        const A = MARKS[a], Bm = MARKS[b], from = toXY(A.lat, A.lon), to = toXY(Bm.lat, Bm.lon);
        const r = m.router.route(from, to, F, { terrain: T, forbidden, perf: 1 });
        routes.push({ key: `${a}→${b}|${v}`, r: r ? {
          time: r.time, maneuvers: r.maneuvers, firstTack: r.firstTack ?? null, firstHeading: r.firstHeading ?? null, firstTwa: r.firstTwa ?? null,
          stbdShare: r.stbdShare, rightShare: r.rightShare, maxOff: r.maxOff, n: r.path.length,
          sx: r.path.reduce((t, p, i) => t + p.x * (i + 1), 0), sy: r.path.reduce((t, p, i) => t + p.y * (i + 1), 0),
        } : null });
      }
    }
    for (const [id, classes, laps] of ANALYSES) {
      const course = liste.find((c) => c.id === id);
      for (const cls of classes) analyses.push({ key: `${id}|${cls}|${laps}|${v}`, ...analyse(m, T, F, forbidden, course, cls, laps) });
    }
  }

  // ── régimes de vent, conseils et classement des parcours
  const { REGIMES, regimeOf, rankCourses } = m.tactics;
  const regimes = {
    table: REGIMES.map((r) => ({ id: r.id, name: r.name, tips: r.tips })),
    of: [2, 6, 12, 20].map((s) => [s, Array.from({ length: 72 }, (_, i) => regimeOf(i * 5, s)?.id ?? null)]),
    rank: VENTS.map(([d, s]) => [`${d}/${s}`, rankCourses('G', d, s).map((x) => [x.c.id, x.score, x.twa, x.brg])]),
  };

  // ── positions : projection, écriture et lecture des positions, vraisemblance des positions d’IC
  const { fmtLat, fmtLon } = m.geo;
  const { parseLatLon } = m.marks;
  const isLand = (x, y) => T.isLand(x, y);
  const lieu = (name, lat, lon) => { const q = toXY(lat, lon); return [name, q.x, q.y, fmtLat(lat), fmtLon(lon)]; };
  const positions = {
    marks: Object.entries(MARKS).map(([k, p]) => lieu(k, p.lat, p.lon)),
    places: m.courses.PLACES.map(([n, lat, lon]) => lieu(n, lat, lon)),
    parseMarks: Object.entries(MARKS).map(([k, p]) => [k, parseLatLon(`${fmtLat(p.lat)} ${fmtLon(p.lon)}`)]),
    parse: SAISIES.map((t) => [t, parseLatLon(t)]),
    check: [...POS_CHECK, ...Object.values(MARKS).map((p) => [p.lat, p.lon])].map(([lat, lon]) => [lat, lon, m.icplaus.checkPos(lat, lon, { isLand })]),
  };

  // ── météo : requêtes, balises gardées (cale de fetch le temps de la section), instantané embarqué
  const meteo = await meteoOf(m.weather);

  // ── données : empreinte et taille de chaque fichier de Toulon
  const racine = m.racine.replace(/\/?$/, '/');
  const donnees = DATA_TOULON.map((f) => { const b = readFileSync(`${racine}data/${f}`); return [f, createHash('sha256').update(b).digest('hex'), b.length]; });

  return { bords, analyses, vent, routes, regimes, positions, meteo, donnees };
}

// Faux paquet de balises Pioupiou : trois dans le cadre de la rade, trois dehors (latitude, longitude, mesure absente)
const BALISES = [
  { id: 1, meta: { name: 'Dedans 1' }, location: { latitude: 43.10, longitude: 5.95 }, measurements: { date: '2026-12-05T09:00:00Z', wind_speed_avg: 20, wind_speed_max: 30, wind_heading: 300 } },
  { id: 2, meta: { name: 'Dedans 2' }, location: { latitude: 43.0, longitude: 6.2 }, measurements: { date: '2026-12-05T09:05:00Z', wind_speed_avg: 9.3, wind_speed_max: 14.8, wind_heading: 95 } },
  { id: 3, meta: { name: 'Dedans 3' }, location: { latitude: 43.21, longitude: 5.71 }, measurements: { date: '2026-12-05T08:55:00Z', wind_speed_avg: 0, wind_speed_max: 3.7, wind_heading: 180 } },
  { id: 4, meta: { name: 'Brest' }, location: { latitude: 48.30, longitude: -4.40 }, measurements: { date: '2026-12-05T09:00:00Z', wind_speed_avg: 25, wind_speed_max: 35, wind_heading: 250 } },
  { id: 5, meta: { name: 'Hyères' }, location: { latitude: 43.10, longitude: 6.30 }, measurements: { date: '2026-12-05T09:00:00Z', wind_speed_avg: 12, wind_speed_max: 18, wind_heading: 270 } },
  { id: 6, meta: { name: 'Sans mesure' }, location: { latitude: 43.08, longitude: 5.96 }, measurements: { date: '2026-12-05T09:00:00Z', wind_speed_max: 10 } },
];

async function meteoOf(W) {
  const urls = [], avant = globalThis.fetch;
  let requetes, balises;
  try {
    globalThis.fetch = async (url) => {
      const u = String(url); urls.push(u);
      const body = /pioupiou/.test(u) ? { data: BALISES } : { hourly: { time: [] } };
      return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
    };
    const d = await W.fetchAll();
    requetes = { urls: urls.splice(0), keys: Object.keys(d).filter((k) => k !== 'fetched'), multi: d.multi, grid: d.grid, marine: d.marine };
    balises = { urls: [], stations: (await W.fetchLive()).map(({ ageMin, ...s }) => s) };
    balises.urls = urls.splice(0);
  } finally { globalThis.fetch = avant; }
  const snap = await W.snapshot();
  const cons = W.consensus(snap).slice(0, 10);
  const t0 = snap.multi.hourly.time[0];
  return {
    requetes, balises,
    GRID: W.GRID, CENTER: W.CENTER, MODELS: W.MODELS,
    snapshot: { fetched: snap.fetched ?? null, consensus: cons, grid0: W.gridPoints(snap, 0), marine0: W.marineAt(snap, t0) },
  };
}

const near = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x));

// null si identiques ; sinon le premier écart (chemin, valeurs) : même structure, mêmes clés dans le même ordre, chaînes et booléens à l’identique,
// nombres à 1e-9 relatif
export function sameDeep(a, b, chemin = '') {
  if (typeof a === 'number' && typeof b === 'number') return near(a, b) ? null : `${chemin || '·'} : ${a} ≠ ${b}`;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b) ? null : `${chemin || '·'} : ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${chemin || '·'} : structure différente`;
  if (Array.isArray(a) && a.length !== b.length) return `${chemin || '·'} : ${a.length} élément(s) au lieu de ${b.length}`;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.join(',') !== kb.join(',')) return `${chemin || '·'} : clés ${ka.join(',')} au lieu de ${kb.join(',')}`;
  for (const k of ka) {
    const sous = Array.isArray(a) ? `${chemin}[${k}]` : chemin ? `${chemin}.${k}` : k;
    const d = sameDeep(a[k], b[k], sous);
    if (d) return d;
  }
  return null;
}

// Modules d’une racine (dépôt ou extraction), dans la forme attendue par toulonCases
export async function modulesOf(racine) {
  const imp = (f) => import(pathToFileURL(`${racine.replace(/\/$/, '')}/js/${f}`).href);
  const noms = ['geo', 'wind', 'tactics', 'router', 'courses', 'banane', 'regmarks', 'marks', 'icplaus', 'weather'];
  const mods = await Promise.all(noms.map((n) => imp(`${n}.js`)));
  return Object.fromEntries(noms.map((n, i) => [n, mods[i]]));
}

async function capture(racine, sortie) {
  process.env.TZ = 'Europe/Paris';
  const base = racine.replace(/\/$/, '') + '/';
  // cale fetch de la capture : fichiers de <racine>, réseau refusé (comme tests/helpers/setup.mjs)
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/^https?:/i.test(u)) throw new Error('réseau interdit dans la capture');
    const buf = readFileSync(base + u.replace(/^\.?\//, ''));
    return {
      ok: true, status: 200,
      json: async () => JSON.parse(buf.toString('utf8')),
      text: async () => buf.toString('utf8'),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  };
  const m = await modulesOf(racine);
  m.T = await new m.geo.Terrain().load('data/');
  m.F = new m.wind.WindField(m.T);
  const out = await toulonCases({ ...m, racine: base });
  writeFileSync(sortie, JSON.stringify({ v: 42, from: '56f6625', ...out }) + '\n');
  console.log(Object.entries(out).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.length : Object.keys(v).length}`).join(' · ') + ` → ${sortie}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [opt, racine, sortie] = process.argv.slice(2);
  if (opt !== '--capture' || !racine || !sortie) { console.error('usage : node tests/helpers/toulon.mjs --capture <racine> <sortie>'); process.exit(2); }
  await capture(racine, sortie);
}
