// Matrice des bords figés de la v37 (D-10, D-09), partagée par la capture et par tests/banane.test.mjs.
// Capture (une seule fois, sur le code extrait de 6e7af98, jamais sur le code modifié) :
//   node tests/helpers/legs.mjs --capture <racine> <sortie>
// Le fichier n’a pas « .test. » dans son nom : `npm test` ne le lance pas.

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Régate au format v37 : bouées confirmées X1…X4 en eau libre de la Grande Rade, un parcours à éléments { mark, side } (deux clés)
const bouee = (id, name, lat, lon) => ({
  id, name, text: `${lat} N ; ${lon} E`, lat, lon, excerpt: `${name} : ${lat} N ; ${lon} E`,
  status: 'confirmee', kind: 'speciale', src: 'IC Club test', by: 'Test', at: 0, confirmed: { by: 'Test', at: 0 },
});
export const REGATE_V37 = Object.freeze({
  id: 'rg-archivee-v37', name: 'Régate archivée v37', club: 'Club test',
  marks: [
    bouee('X1', 'Alpha', 43.0905, 5.9587),
    bouee('X2', 'Bravo', 43.0835, 5.9700),
    bouee('X3', 'Charlie', 43.0950, 5.9800),
    bouee('X4', 'Delta', 43.0870, 5.9850),
  ],
  courses: [{
    id: 101, name: 'Parcours A',
    seq: [{ mark: 'X1', side: 'b' }, { mark: 'X2', side: 't' }, { mark: 'X3', side: null }, { mark: 'X4', side: 'b' }],
    excerpt: 'Parcours A : départ, Alpha bâbord, Bravo tribord, Charlie, Delta bâbord, arrivée.', incomplete: false, missing: [], by: 'Test', at: 0,
  }],
});

const xyn = (p) => ({ x: p.x, y: p.y, name: p.name });
const xy = (p) => ({ x: p.x, y: p.y });

// Bords d’un résultat de buildLegs, réduits aux champs comparés (clés dans cet ordre, aucune autre ; côté et tour absents → null, comme en JSON)
export function serialLegs(B) {
  const L = B.line;
  return {
    line: { c: xy(L.c), cb: xy(L.cb), pin: xy(L.pin), face: L.face },
    legs: B.legs.map((l) => ({ i: l.i, mark: l.mark, side: l.side ?? null, lap: l.lap ?? null, from: xyn(l.from), to: xyn(l.to), brg: l.brg, dist: l.dist })),
  };
}

const VENTS = [315, 135];
const lineOf = (LINE_PRESETS, course, over = {}) => ({ center: LINE_PRESETS[course.line || 'vignettes'], lengthNm: 0.12, mode: 'wind', bearing: 0, override: null, ...over });

// Tous les cas figés : parcours 1 à 13 (G et P, tours, deux vents), variantes de ligne, parcours de régate archivé
export function legCases({ buildLegs, COURSES, MARKS, LINE_PRESETS, applyRegattaMarks }) {
  const out = [];
  const push = (key, B) => out.push({ key, ...serialLegs(B) });
  const cours = COURSES.filter((c) => c.id >= 1 && c.id <= 13);
  for (const c of cours) {
    for (const cls of ['G', 'P']) {
      for (const laps of c.laps ? [1, 2, 3] : [2]) {
        for (const w of VENTS) {
          push(`${c.id}|${cls}|${laps}|${w}|base`, buildLegs(c, cls, { laps, windDir: w, line: lineOf(LINE_PRESETS, c), wlLengthNm: 0.8 }));
        }
      }
    }
  }
  const variantes = {
    axis: { mode: 'axis' },
    fixed: { mode: 'fixed', bearing: 200 },
    override: { override: { cb: { x: 1500, y: -1000 }, pin: { x: 1300, y: -1100 } } },
  };
  for (const c of cours) {
    for (const [nom, over] of Object.entries(variantes)) {
      push(`${c.id}|G|2|315|${nom}`, buildLegs(c, 'G', { laps: 2, windDir: 315, line: lineOf(LINE_PRESETS, c, over), wlLengthNm: 1.5 }));
    }
  }
  try {
    applyRegattaMarks(MARKS, COURSES, REGATE_V37);
    const c = COURSES.find((x) => x.id === 101);
    if (!c) throw new Error('parcours 101 de la régate archivée non injecté');
    for (const cls of ['G', 'P']) {
      for (const w of VENTS) {
        push(`101|${cls}|2|${w}|base`, buildLegs(c, cls, { laps: 2, windDir: w, line: lineOf(LINE_PRESETS, c), wlLengthNm: 0.8 }));
      }
    }
  } finally {
    applyRegattaMarks(MARKS, COURSES, null);
  }
  return out;
}

const near = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x));

// null si identiques ; sinon le premier écart (clé du cas, numéro du bord, champ)
export function sameLegs(a, b) {
  const diff = (u, v, path) => {
    if (typeof u === 'number' && typeof v === 'number') return near(u, v) ? null : `${path} : ${u} ≠ ${v}`;
    if (u === null || v === null || typeof u !== 'object' || typeof v !== 'object') return Object.is(u, v) ? null : `${path} : ${JSON.stringify(u)} ≠ ${JSON.stringify(v)}`;
    if (Array.isArray(u) !== Array.isArray(v)) return `${path} : structure différente`;
    if (Array.isArray(u) && u.length !== v.length) return `${path} : ${u.length} élément(s) au lieu de ${v.length}`;
    const ku = Object.keys(u), kv = Object.keys(v);
    if (ku.join(',') !== kv.join(',')) return `${path} : clés ${ku.join(',')} au lieu de ${kv.join(',')}`;
    for (const k of ku) { const d = diff(u[k], v[k], Array.isArray(u) ? `${path}[${k}]` : `${path}.${k}`); if (d) return d; }
    return null;
  };
  const key = a?.key ?? b?.key ?? '?';
  if (a?.key !== b?.key) return `cas ${key} : clé ${a?.key} au lieu de ${b?.key}`;
  const dl = diff(a.line, b.line, 'ligne');
  if (dl) return `cas ${key}, ${dl}`;
  if (!Array.isArray(a.legs) || !Array.isArray(b.legs) || a.legs.length !== b.legs.length) return `cas ${key} : ${a.legs?.length} bord(s) au lieu de ${b.legs?.length}`;
  for (let i = 0; i < a.legs.length; i++) {
    const d = diff(a.legs[i], b.legs[i], 'bord');
    if (d) return `cas ${key}, bord ${i} : ${d}`;
  }
  return null;
}

async function capture(racine, sortie) {
  const imp = (f) => import(pathToFileURL(`${racine.replace(/\/$/, '')}/js/${f}`).href);
  const [{ buildLegs }, { COURSES, MARKS, LINE_PRESETS }, { applyRegattaMarks }] = await Promise.all([imp('tactics.js'), imp('courses.js'), imp('regmarks.js')]);
  const cases = legCases({ buildLegs, COURSES, MARKS, LINE_PRESETS, applyRegattaMarks });
  writeFileSync(sortie, JSON.stringify({ v: 37, from: '6e7af98', cases }) + '\n');
  console.log(`${cases.length} cas écrits dans ${sortie}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [opt, racine, sortie] = process.argv.slice(2);
  if (opt !== '--capture' || !racine || !sortie) { console.error('usage : node tests/helpers/legs.mjs --capture <racine> <sortie>'); process.exit(2); }
  await capture(racine, sortie);
}
