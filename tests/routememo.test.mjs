// Routes mémorisées d’une analyse (ctx.memo, routeOf de js/tactics.js) : le conseil de porte et les bords d’une banane donnent EXACTEMENT
// les mêmes résultats avec et sans mémoire (mêmes bords, mêmes temps, même conseil), sur plusieurs vents et sur le vrai relief, avec au moins
// deux fois moins de routes calculées ; une route n’est jamais reprise d’un autre état du champ (WindField.gen) ni d’autres options.
// Avant / après : six bananes comparées à la capture de la v38 (tests/fixtures/banane-v38.json, tests/helpers/banvue.mjs), route accélérée comprise.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import { buildLegs, prepareLeg, analyzeLeg, routeOf } from '../js/tactics.js';
import { BANANE } from '../js/banane.js';
import { Terrain, toXY } from '../js/geo.js';
import { WindField } from '../js/wind.js';
import { COURSES, LINE_PRESETS, FORBIDDEN_ZONE } from '../js/courses.js';
import * as tac from '../js/tactics.js';
import { fixture } from './helpers/setup.mjs';
import { BAN_CASES, banCase } from './helpers/banvue.mjs';

let T, F;
before(async () => { T = await new Terrain().load('data/'); F = new WindField(T); });

// Même boucle que runAnalysis (js/app.js) : porte conseillée puis analyse de chaque bord, vent constant (un seul état du champ)
function analyse(course, laps, dir, spd, memo) {
  F.compute({ points: [{ x: 0, y: 0, dir, spd, gust: spd * 1.3 }] }, { localEffects: 1 });
  const preset = LINE_PRESETS[course.line || 'vignettes'], c = toXY(preset.lat, preset.lon), w = F.sample(c.x, c.y);
  const B = buildLegs(course, 'G', { laps, windDir: w.dir, wlLengthNm: 0.8, ban: { nm: 0.8 }, line: { center: preset, lengthNm: 0.12, mode: 'wind' } });
  const ctx = { terrain: T, forbidden: [], perf: 1, trend: 0, ...(memo ? { memo } : {}) };
  const legs = [];
  for (const [k, leg] of B.legs.entries()) { prepareLeg(leg, legs[legs.length - 1], B.legs[k + 1], F, ctx); legs.push(analyzeLeg(leg, F, ctx)); }
  return legs;
}
// Tout ce que l’app montre d’un bord : destination, départ, distances, temps, porte, conseils, effets de site, route
const vue = (legs) => legs.map((l) => ({
  to: [l.to.name, l.to.x, l.to.y], from: [l.from.x, l.from.y], brg: l.brg, dist: l.dist, time: l.time, twa: l.twa, type: l.type.id, side: l.side,
  gate: l.gate ? { pick: l.gate.pick, gain: l.gate.gain, times: l.gate.times, equal: l.gate.equal, why: l.gate.why } : null,
  advice: l.advice, site: l.site.map((s) => s.text), wind: l.wind,
  route: l.route ? { time: l.route.time, man: l.route.maneuvers, n: l.route.path.length, right: l.route.rightShare, off: l.route.maxOff } : null,
}));

test('banane de 3 tours, quatre vents, vrai relief : résultats strictement identiques avec et sans routes mémorisées, au moins deux fois moins de routes', () => {
  for (const [dir, spd] of [[315, 15], [135, 10], [90, 12], [225, 7]]) {
    const sans = vue(analyse(BANANE, 3, dir, spd, null));
    const memo = new Map();
    const avec = vue(analyse(BANANE, 3, dir, spd, memo));
    assert.deepEqual(avec, sans, `vent ${dir}° ${spd} nd`);
    // appels de route sans mémoire : un par bord, plus quatre par porte (deux bouées, chacune avec le bord suivant)
    const appels = sans.length + 4 * sans.filter((l) => l.gate).length;
    assert.ok(memo.size * 2 <= appels, `vent ${dir}° : ${memo.size} routes calculées pour ${appels} appels`);
    assert.ok(sans.some((l) => l.gate), 'la banane a au moins une porte');
  }
});

test('avant / après : six bananes (vent constant, ou qui tourne de ±6°/h avec le champ recalculé tous les quarts d’heure) identiques à la v38 capturée (d311328)', () => {
  const ref = JSON.parse(fixture('banane-v38.json'));
  assert.equal(ref.v, 38); assert.equal(ref.from, 'd311328');
  assert.deepEqual(ref.cases.map((x) => x.c), BAN_CASES, 'mêmes cas que la capture');
  const mods = { tac, BANANE, LINE_PRESETS, FORBIDDEN_ZONE, toXY, F, T };
  for (const [i, c] of BAN_CASES.entries()) {
    const memo = new Map(), cur = banCase(mods, c, memo);
    assert.deepEqual(cur.legs, ref.cases[i].legs, `cas ${i + 1} (${c.dir}° ${c.spd} nd${c.turn ? `, ${c.turn}°/h` : ''}) : mêmes bords, temps, portes, conseils et routes qu’en v38`);
    assert.ok(memo.size < cur.calls, `cas ${i + 1} : ${memo.size} routes calculées pour ${cur.calls} appels`);
  }
});

test('parcours du cahier (3, 2 tours) : mêmes bords avec et sans mémoire', () => {
  const c3 = COURSES.find((c) => c.id === 3);
  assert.deepEqual(vue(analyse(c3, 2, 315, 15, new Map())), vue(analyse(c3, 2, 315, 15, null)));
});

test('routeOf : même résultat (même objet) pour les mêmes points, le même état du champ et les mêmes options ; sinon route recalculée', () => {
  const champ = { gen: 1, sample: () => ({ u: 0, v: -12, gust: 16, shelter: 0, dir: 0, spd: 12 }) };
  const a = { x: 0, y: 0 }, b = { x: 300, y: 1500 }, opts = { terrain: null, forbidden: [], perf: 1 }, ctx = { memo: new Map() };
  const r1 = routeOf(a, b, champ, opts, ctx);
  assert.ok(r1 && Number.isFinite(r1.time));
  assert.equal(routeOf({ ...a }, { ...b }, champ, { ...opts, forbidden: opts.forbidden }, ctx), r1, 'mêmes points (copies), même champ : même route');
  champ.gen = 2;
  const r2 = routeOf(a, b, champ, opts, ctx);
  assert.notEqual(r2, r1, 'champ recalculé : nouvelle route');
  assert.deepEqual(r2.time, r1.time, 'même vent : même temps');
  assert.notEqual(routeOf(a, b, champ, { ...opts, perf: 0.9 }, ctx), r2, 'autre performance : nouvelle route');
  assert.notEqual(routeOf(a, b, champ, { ...opts, forbidden: [] }, ctx), r2, 'autre liste de zones interdites : nouvelle route');
  assert.notEqual(routeOf(a, b, { ...champ }, opts, ctx), r2, 'autre champ au même numéro : nouvelle route');
  assert.notEqual(routeOf(a, b, champ, opts, {}), routeOf(a, b, champ, opts, {}), 'sans ctx.memo : route() à chaque appel');
});

test('WindField.compute fait avancer gen ; runAnalysis et planRest donnent une mémoire neuve à chaque calcul', () => {
  const g = F.gen;
  F.compute({ points: [{ x: 0, y: 0, dir: 300, spd: 10, gust: 13 }] }, { localEffects: 1 });
  assert.equal(F.gen, g + 1);
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  for (const f of ['runAnalysis', 'planRest']) assert.match(bodyOf(app, f), /memo: new Map\(\)/, `${f} : mémoire propre à l’analyse`);
  assert.match(bodyOf(app, 'runAnalysis'), /routeOf\(p, first\.to, F,/, 'points de départ : la route retenue resservira au 1er bord');
});
