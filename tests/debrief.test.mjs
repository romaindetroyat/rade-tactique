// Passages de porte au débrief et dans l’analyse d’une trace (phase 6, D-07) : une porte compte un seul passage, celui de la bouée approchée
// de plus près, et dit laquelle a été prise ; un parcours sans porte se lit exactement comme en v37. Tables de test en copies (bouées X1-X4),
// jamais les vraies MARKS / COURSES (comparées à la fin du fichier).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { MARKS, COURSES } from '../js/courses.js';
import { toXY, toLL, distXY, bearingXY } from '../js/geo.js';
import { boatSpeed } from '../js/polar.js';
import { analyzeTrack } from '../js/track.js';
import { passages, expectedSeq, matchCourse, analyze } from '../js/debrief.js';

const MARKS_AVANT = JSON.stringify(MARKS), COURSES_AVANT = JSON.stringify(COURSES);
after(() => {
  assert.equal(JSON.stringify(MARKS), MARKS_AVANT, 'MARKS réel modifié par un test');
  assert.equal(JSON.stringify(COURSES), COURSES_AVANT, 'COURSES réel modifié par un test');
});

// Bouées de test en eau libre de la Grande Rade : X2 et X3 forment une porte (environ 90 m)
const BOUEES = {
  X1: { lat: 43.0950, lon: 5.9600, name: 'Alpha' },
  X2: { lat: 43.0850, lon: 5.9700, name: '4s' },
  X3: { lat: 43.0850, lon: 5.9711, name: '4p' },
  X4: { lat: 43.0900, lon: 5.9750, name: 'F' },
};
const XY = Object.fromEntries(Object.entries(BOUEES).map(([k, m]) => [k, toXY(m.lat, m.lon)]));
const PARCOURS = [{ id: 101, title: 'Parcours B (IC)', seq: { G: [['X1', 'b'], ['X2', null, 'X3'], ['X4', 'b']], P: [['X1', 'b'], ['X2', null, 'X3'], ['X4', 'b']] } }];
const T0 = Date.parse('2026-10-24T09:00:00Z');

// Points { x, y, t } espacés de `pas` mètres le long d’une ligne brisée, un point toutes les 5 s
function trajet(waypoints, { pas = 15, t0 = T0 } = {}) {
  const P = []; let t = t0;
  for (let k = 1; k < waypoints.length; k++) {
    const a = waypoints[k - 1], b = waypoints[k], n = Math.max(1, Math.round(distXY(a, b) / pas));
    for (let i = k === 1 ? 0 : 1; i <= n; i++) { P.push({ x: a.x + (b.x - a.x) * (i / n), y: a.y + (b.y - a.y) * (i / n), t }); t += 5000; }
  }
  return P;
}
const decale = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy });

// Copie de l’algorithme de la v37 (6e7af98) pour un parcours sans porte : le résultat courant doit lui être identique
const exp37 = (c, cls, laps, marks = MARKS) => { const seq = (c.seq[cls] || c.seq.G).filter(([m]) => marks[m]).map(([m, s]) => ({ k: m, side: s })); if (!c.laps) return seq; const o = []; for (let i = 0; i < laps; i++) o.push(...seq); return o; };
function matchV37(pass, courses, marks) {
  let best = null;
  for (const c of courses) for (const cls of Object.keys(c.seq)) for (const laps of c.laps ? [1, 2, 3] : [1]) {
    const exp = exp37(c, cls, laps, marks); if (!exp.length) continue;
    let j = 0; const hit = [];
    for (const p of pass) if (j < exp.length && p.k === exp[j].k) { hit.push({ ...p, side: exp[j].side }); j++; }
    if (!j) continue;
    const score = j * 10 - (exp.length - j) * 0.5 - laps * 0.1;
    if (!best || score > best.score) best = { c, cls, laps, exp, hit, score, reduced: j < exp.length };
  }
  return best;
}

test('passages : une trace à 60 m de X2 puis, 20 s plus tard, à 15 m de X3 (porte X2/X3) donne un passage pour chacune', () => {
  const a = decale(XY.X2, 0, -60), b = decale(XY.X3, 0, -15);
  const P = [...trajet([decale(XY.X2, -600, -60), a], { pas: 15 }), ...trajet([a, b], { pas: 22.5, t0: T0 + 1e6 }).slice(1)];
  // le second tronçon commence 20 s après le passage au plus près de X2 (4 points de 5 s)
  const iA = P.findIndex((p) => p.x === a.x && p.y === a.y);
  for (let i = iA + 1; i < P.length; i++) P[i].t = P[iA].t + (i - iA) * 5000;
  P.push(...trajet([b, decale(XY.X3, 800, -15)], { t0: P.at(-1).t + 5000 }).slice(1));
  const pass = passages(P, BOUEES);
  const x2 = pass.find((p) => p.k === 'X2'), x3 = pass.find((p) => p.k === 'X3');
  assert.ok(x2 && x3, `un passage pour chacune : ${pass.map((p) => p.k).join(', ')}`);
  assert.ok(x3.d < 16 && x2.d <= 60.5, `distances : X2 ${x2.d.toFixed(1)} m, X3 ${x3.d.toFixed(1)} m`);
  assert.equal(x3.t - P[iA].t, 20000);
  assert.ok(!pass.some((p) => p.k === 'X1' || p.k === 'X4'));
});

test('expectedSeq : élément à trois valeurs → { k, side, gate } ; élément à deux valeurs → objet de la v37 (sans gate)', () => {
  const e = expectedSeq(PARCOURS[0], 'G', 1, BOUEES);
  assert.deepEqual(e, [{ k: 'X1', side: 'b' }, { k: 'X2', side: null, gate: 'X3' }, { k: 'X4', side: 'b' }]);
  assert.deepEqual(Object.keys(e[0]), ['k', 'side']);
  for (const c of COURSES.filter((x) => !x.built)) for (const cls of ['G', 'P']) for (const laps of [1, 2]) assert.deepEqual(expectedSeq(c, cls, laps), exp37(c, cls, laps), `parcours ${c.id} ${cls} ${laps}`);
  const sansX3 = { X1: BOUEES.X1, X2: BOUEES.X2, X4: BOUEES.X4 };
  assert.deepEqual(expectedSeq(PARCOURS[0], 'G', 1, sansX3)[1], { k: 'X2', side: null }, 'autre bouée inconnue : bouée simple');
});

test('matchCourse : le passage de porte retenu est la bouée la plus approchée (X3), marqué gate ; X2 n’est pas compté ; suite X1 → X3 → X4', () => {
  const pass = [
    { k: 'X1', d: 30, t: T0 }, { k: 'X2', d: 60, t: T0 + 600000 }, { k: 'X3', d: 15, t: T0 + 620000 }, { k: 'X4', d: 20, t: T0 + 1200000 },
  ];
  const mc = matchCourse(pass, PARCOURS, BOUEES);
  assert.deepEqual(mc.hit.map((h) => h.k), ['X1', 'X3', 'X4']);
  assert.deepEqual(mc.hit[1].gate, ['X2', 'X3']);
  assert.equal(mc.hit[1].d, 15);
  assert.equal(mc.reduced, false);
  assert.ok(!('gate' in mc.hit[0]) && !('gate' in mc.hit[2]));
  // l’autre ordre (X3 passée d’abord, X2 plus près) : X2 retenue
  const inverse = matchCourse([pass[0], { k: 'X3', d: 70, t: T0 + 600000 }, { k: 'X2', d: 10, t: T0 + 640000 }, pass[3]], PARCOURS, BOUEES);
  assert.deepEqual(inverse.hit.map((h) => h.k), ['X1', 'X2', 'X4']);
  // au-delà de 180 s, le second passage n’est plus celui de la porte : la première bouée est retenue
  const tard = matchCourse([pass[0], { k: 'X2', d: 60, t: T0 + 600000 }, { k: 'X3', d: 15, t: T0 + 800000 }, pass[3]], PARCOURS, BOUEES);
  assert.deepEqual(tard.hit.map((h) => h.k), ['X1', 'X2', 'X4']);
});

test('matchCourse : un parcours sans porte (parcours du cahier, vraies tables) donne exactement le résultat de la v37', () => {
  const c3 = COURSES.find((c) => c.id === 3);
  const seq = c3.seq.G.map(([m]) => m);
  let t = T0;
  const pass = [];
  for (let tour = 0; tour < 2; tour++) for (const k of seq) { pass.push({ k, d: 40 + (pass.length % 5) * 20, t: (t += 400000) }); if (pass.length % 4 === 0) pass.push({ k: '9', d: 150, t: (t += 30000) }); }
  const now = matchCourse(pass), v37 = matchV37(pass, COURSES, MARKS);
  assert.deepEqual(now, v37);
  assert.ok(now.hit.length >= seq.length, 'les passages du parcours sont retrouvés');
});

// Champ de vent simulé : vent du Nord uniforme, 12 nd, sans relief (seul analyzeLeg le lit)
const champ = { t: {}, compute() {}, sample: () => ({ u: 0, v: -12, gust: 16, shelter: 0, dir: 0, spd: 12 }), shiftAmplitude: () => 5 };

test('analyze : le bord vers la bouée de porte prise s’appelle « … → X3 4p (porte : bouée prise) »', () => {
  // vraies bouées du cahier pour la table MARKS lue par analyze : 3 → 1 (porte, bouée prise) → 2 (arrivée)
  const k = Object.keys(MARKS).slice(0, 3);
  const M = Object.fromEntries(k.map((x) => [x, toXY(MARKS[x].lat, MARKS[x].lon)]));
  const P = trajet([decale(M[k[0]], 0, -800), M[k[0]], M[k[1]], M[k[2]]], { pas: 15 }).map((p) => ({ ...p, ...toLL(p.x, p.y), v: 6, hd: 0 }));
  for (let i = 1; i < P.length; i++) P[i].hd = bearingXY(P[i - 1], P[i]);
  const tAt = (m) => P.reduce((a, p) => (distXY(p, m) < distXY(a, m) ? p : a)).t;
  const det = { P, launches: [] };
  const ans = { tStart: P[0].t, startWind: 0, marks: [{ k: k[0], t: tAt(M[k[0]]), side: 'b' }, { k: k[1], t: tAt(M[k[1]]), side: null, gate: true }, { k: k[2], t: tAt(M[k[2]]), side: 'b' }] };
  const api = { F: champ, ctx: { terrain: null, forbidden: [], perf: 1 }, forecastAt: () => ({ dir: 0, spd: 12 }), localFx: false, restoreField() {} };
  const an = analyze(det, ans, api);
  assert.equal(an.legs.length, 3);
  assert.equal(an.legs[1].name, `${k[0]} → ${k[1]} ${MARKS[k[1]].name} (porte : bouée prise)`);
  assert.doesNotMatch(an.legs[0].name, /porte/);
  assert.match(an.legs[2].name, /\(arrivée\)$/);
});

// Trace au format enregistré : [t, lat, lon, sog, cog]
const pts = (P) => P.map((p) => { const ll = toLL(p.x, p.y); return [p.t, ll.lat, ll.lon, 6, null]; });
const bordPorte = (from) => ({ to: { ...XY.X2, name: 'X2 4s' }, mark: 'PORTE', order: 2, time: 300, gate: { g: { ...XY.X2, name: 'X2 4s', side: 'b' }, d: { ...XY.X3, name: 'X3 4p', side: 't' }, pick: 'g' }, from });

test('analyzeTrack : un bord porte (destination g) dont la trace contourne d → passage trouvé près de d, took « d » ; sans porte, découpage de la v37', () => {
  // X1, puis arrivée par le nord-est et contour de X3 par l’est à 20 m (110 m de X2), puis X4
  const P = trajet([XY.X1, decale(XY.X3, 400, 500), decale(XY.X3, 20, 0), decale(XY.X3, 400, -400), XY.X4], { pas: 15 });
  const tr = { pts: pts(P) };
  const opts = { windAt: () => ({ dir: 0, spd: 12 }), boatSpeed };
  const legs = [{ to: { ...XY.X1, name: 'X1 Alpha' }, mark: 'X1', order: 1, time: 100 }, bordPorte(XY.X1), { to: { ...XY.X4, name: 'X4 F' }, mark: 'X4', order: 3, time: 200 }];
  const res = analyzeTrack(tr, { ...opts, legs });
  const s = res.split[1];
  assert.equal(s.missed, undefined, 'passage de porte trouvé');
  assert.ok(s.dMark < 50, `au plus près de la porte : ${s.dMark.toFixed(1)} m`);
  assert.equal(s.took, 'd');
  assert.ok(!res.split[0].missed && !res.split[2].missed);
  assert.ok(!('took' in res.split[0]) && !('took' in res.split[2]), 'bord sans porte : pas de took');
  // sans porte : mêmes opérations que la v37 (point le plus proche de l.to, arrêt quand on s’éloigne, 250 m au plus)
  const simple = [{ to: { ...XY.X1, name: 'X1' }, time: 1 }, { to: { ...XY.X3, name: 'X3' }, time: 1 }, { to: { ...XY.X4, name: 'X4' }, time: 1 }];
  const r2 = analyzeTrack(tr, { ...opts, legs: simple });
  const Q = r2.P; let i0 = 0;
  for (const [n, l] of simple.entries()) {
    let best = null;
    for (let i = i0; i < Q.length; i++) { const d = distXY(Q[i], l.to); if (!best || d < best.d) best = { d, i }; if (best && d > best.d + 400 && best.d < 150) break; }
    assert.equal(r2.split[n].dMark, best.d); assert.equal(r2.split[n].at, Q[best.i].t);
    assert.deepEqual(Object.keys(r2.split[n]), ['leg', 't', 'at', 'dMark', 'plan', 'pct', 'vmean'], 'entrée de la v37');
    i0 = best.i;
  }
  // la même trace vers g seul (sans porte) : g à 110 m environ, la bouée réellement contournée n’est pas vue
  const r3 = analyzeTrack(tr, { ...opts, legs: [legs[0], { ...bordPorte(XY.X1), gate: undefined }, legs[2]] });
  assert.ok(r3.split[1].dMark > 100, `${r3.split[1].dMark}`);
});

test('garde : le choix du parcours du débrief exclut toujours les parcours construits ; passages, expectedSeq et matchCourse prennent leurs tables en paramètre', () => {
  const src = readFileSync(ROOT + 'js/debrief.js', 'utf8');
  assert.match(src, /COURSES\.filter\(\(c\) => !c\.built\)/);
  assert.match(src, /export function passages\(P, marks = MARKS\)/);
  assert.match(src, /export function expectedSeq\(c, cls, laps, marks = MARKS\)/);
  assert.match(src, /export function matchCourse\(pass, courses = COURSES, marks = MARKS\)/);
  assert.match(src, /\(porte : bouée prise\)/);
});
