// Gel de Toulon v42 (phase 7, D-01) : tout ce que l’app calcule pour Toulon, partagé par la capture et par tests/toulon.test.mjs.
// Capture une seule fois sur le code extrait de 56f6625 (v42), jamais sur le code modifié :
//   node tests/helpers/toulon.mjs --capture <racine> <sortie>
// Les modules sont passés en paramètre : la même matrice tourne sur l’ancien et sur le nouveau code.
// Le fichier n’a pas « .test. » dans son nom : `npm test` ne le lance pas.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { legCases, serialLegs } from './legs.mjs';
import { BAN_CASES, legVue } from './banvue.mjs';

// Fichiers de données de Toulon (empreintes figées dans la fixture)
export const DATA_TOULON = Object.freeze(['meta.json', 'terrain.bin', 'cover.bin', 'coast.json', 'basemap.jpg', 'seamask.png', 'j80.pol', 'wx-snapshot.json']);

// Vents de la matrice : [direction, force] ; rafale = force × 1,3
export const VENTS = Object.freeze([[315, 25], [265, 14], [215, 10], [140, 14], [85, 12], [40, 6]]);
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

  // ── analyses : boucle de runAnalysis, vent manuel constant, effets de site au maximum
  const analyses = [];
  const liste = m.banane.addBanane([...COURSES]);
  for (const [dir, spd] of VENTS) {
    F.compute(baseOf(dir, spd), { localEffects: 1 });
    for (const [id, classes, laps] of ANALYSES) {
      const course = liste.find((c) => c.id === id);
      for (const cls of classes) analyses.push({ key: `${id}|${cls}|${laps}|${dir}/${spd}`, ...analyse(m, T, F, forbidden, course, cls, laps) });
    }
  }
  return { bords, analyses };
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
