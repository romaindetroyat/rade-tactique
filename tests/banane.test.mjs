// Parcours banane, porte à deux bouées, arrivées décalées et conseil de porte (phase 6, D-01 à D-05, D-09, D-10).
// Les bords des parcours 1 à 13 et d’une régate archivée sont comparés à ceux de la v37 (fixture capturée sur 6e7af98).
// Les tables réelles MARKS et COURSES sont rendues à l’identique : comparaison avec l’état du début à la fin du fichier.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/setup.mjs';
import { legCases, sameLegs, serialLegs, REGATE_V37 } from './helpers/legs.mjs';
import { buildLegs, rankCourses, adviseGate, prepareLeg, gateText, markAdvice, GATE_EQUAL_S } from '../js/tactics.js';
import * as banane from '../js/banane.js';
import { BANANE_ID, BANANE, BAN_DEF, cleanBan, banOf, addBanane, bananeCourse, orientGate, courseMarkUse } from '../js/banane.js';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import * as R from '../js/regates.js';
import { NM, toXY, bearingXY, distXY, norm180, Terrain } from '../js/geo.js';
import { WindField } from '../js/wind.js';
import { MARKS, COURSES, LINE_PRESETS } from '../js/courses.js';
import { applyRegattaMarks } from '../js/regmarks.js';

const MARKS_AVANT = JSON.stringify(MARKS), COURSES_AVANT = JSON.stringify(COURSES);
after(() => {
  assert.equal(JSON.stringify(MARKS), MARKS_AVANT, 'MARKS réel modifié par un test');
  assert.equal(JSON.stringify(COURSES), COURSES_AVANT, 'COURSES réel modifié par un test');
});

test('non-régression v37 : bords des parcours 1 à 13 et d’une régate archivée identiques à la fixture capturée sur 6e7af98 (D-10, D-09)', () => {
  const ref = JSON.parse(fixture('legs-v37.json'));
  assert.equal(ref.v, 37); assert.equal(ref.from, '6e7af98');
  const cur = legCases({ buildLegs, COURSES, MARKS, LINE_PRESETS, applyRegattaMarks });
  assert.equal(cur.length, ref.cases.length, 'nombre de cas');
  assert.deepEqual(cur.map((c) => c.key), ref.cases.map((c) => c.key), 'clés des cas');
  for (let i = 0; i < cur.length; i++) {
    const d = sameLegs(cur[i], ref.cases[i]);
    assert.equal(d, null, d ?? '');
  }
});

test('non-régression v37 : aucun bord des parcours existants n’a de porte, aucune ligne d’arrivée décalée', () => {
  for (const c of COURSES.filter((x) => x.id >= 1 && x.id <= 13)) {
    for (const cls of ['G', 'P']) {
      const B = buildLegs(c, cls, { laps: 2, windDir: 315, line: { center: LINE_PRESETS[c.line || 'vignettes'], lengthNm: 0.12, mode: 'wind' } });
      assert.ok(B.legs.every((l) => l.gate === undefined), `parcours ${c.id} ${cls} : pas de porte`);
      assert.equal(B.finishLine, undefined, `parcours ${c.id} : finishLine absent`);
    }
  }
});

// ───────────────────────── Banane construite (D-01, D-02, D-03)
const GR = LINE_PRESETS.grandrade;
const banLegs = (w, opts = {}) => buildLegs(BANANE, 'G', { laps: 2, windDir: w, line: { center: GR, lengthNm: 0.12, mode: 'wind', ...(opts.line || {}) }, ban: opts.ban, ...(opts.laps ? { laps: opts.laps } : {}) });
const brgClose = (a, b, msg) => assert.ok(Math.abs(norm180(a - b)) < 1e-6, `${msg} : ${a} au lieu de ${b}`);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b}`);

for (const W of [0, 315]) {
  test(`banane par défaut, vent ${W}° : B, C, porte, B, C, arrivée sur la ligne de départ`, () => {
    const B = banLegs(W);
    assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'B', 'C', 'FINISH']);
    const c = B.line.c, pB = B.points.B;
    near(distXY(c, pB), 0.8 * NM, 1, 'centre–B');
    brgClose(bearingXY(c, pB), W, 'relèvement de B');
    near(distXY(pB, B.points.C), 0.07 * NM, 1e-6, 'B–C');
    brgClose(bearingXY(pB, B.points.C), W - 90, 'C à gauche en regardant au vent');
    assert.equal(B.legs[1].side, 'b'); assert.equal(B.legs[0].side, 'b');
    assert.equal(B.legs[0].lap, 1); assert.equal(B.legs[3].lap, 2);
    assert.equal(B.finishLine, null);
  });

  test(`banane par défaut, vent ${W}° : porte à deux bouées, gauche (bâbord) et droite (tribord) en regardant sous le vent`, () => {
    const B = banLegs(W), c = B.line.c;
    const p = B.legs[2], { g, d } = p.gate;
    assert.equal(p.mark, 'PORTE');
    near(distXY(g, d), 0.05 * NM, 1e-6, 'largeur de porte');
    const mid = { x: (g.x + d.x) / 2, y: (g.y + d.y) / 2 };
    near(distXY(c, mid), 0.05 * NM, 1e-6, 'centre de la porte');
    brgClose(bearingXY(c, mid), W, 'porte au vent du centre');
    brgClose(bearingXY(mid, g), W + 90, 'bouée gauche');
    assert.equal(g.side, 'b'); assert.equal(d.side, 't');
    assert.equal(g.mark, 'PG'); assert.equal(d.mark, 'PD');
    assert.deepEqual([p.to.x, p.to.y], [g.x, g.y], 'bord de porte vers la gauche par défaut');
    assert.equal(p.side, 'b');
    assert.deepEqual([B.legs[3].from.x, B.legs[3].from.y], [g.x, g.y], 'bord suivant parti de la bouée gauche');
    assert.deepEqual({ pick: p.gate.pick, gain: p.gate.gain, times: p.gate.times, equal: p.gate.equal, why: p.gate.why }, { pick: 'g', gain: null, times: null, equal: null, why: null });
    assert.ok(B.points.PG && B.points.PD);
    const f = B.legs.at(-1);
    assert.equal(f.to.name, 'Arrivée (ligne de départ)');
    near(distXY(f.to, c), 0, 1e-9, 'arrivée au centre de la ligne');
  });
}

test('banane : avec une ligne pinguée, B et la porte partent du centre pingué', () => {
  const cb = { x: 1500, y: -1000 }, pin = { x: 1300, y: -1100 }, c = { x: 1400, y: -1050 };
  const B = banLegs(315, { line: { override: { cb, pin } } });
  assert.deepEqual(B.line.c, c);
  near(distXY(c, B.points.B), 0.8 * NM, 1e-6, 'centre pingué–B');
  brgClose(bearingXY(c, B.points.B), 315, 'relèvement de B');
  const { g, d } = B.legs[2].gate;
  near(distXY(c, { x: (g.x + d.x) / 2, y: (g.y + d.y) / 2 }), 0.05 * NM, 1e-6, 'porte depuis le centre pingué');
  assert.deepEqual(B.legs[0].from, { x: c.x, y: c.y, name: 'Départ' });
});

test('banane : jamais proposée par rankCourses (construite), même ajoutée aux parcours réels', () => {
  const n = COURSES.length;
  try {
    addBanane(COURSES);
    assert.ok(COURSES.some((c) => c.id === BANANE_ID));
    for (const [cls, w] of [['G', 315], ['P', 315], ['G', 135], ['G', 0]]) assert.ok(!rankCourses(cls, w, 15).some((r) => r.c.id === BANANE_ID));
  } finally {
    const i = COURSES.findIndex((c) => c.id === BANANE_ID);
    if (i >= 0) COURSES.splice(i, 1);
  }
  assert.equal(COURSES.length, n);
});

test('banane : identifiant 90 hors des parcours SNPM et de régate ; addBanane idempotent sur une copie', () => {
  assert.equal(BANANE_ID, 90); assert.equal(BANANE.id, 90); assert.equal(BANANE.built, 'BAN'); assert.equal(BANANE.line, 'grandrade');
  assert.ok(!COURSES.some((c) => c.id === BANANE_ID));
  const copie = structuredClone(COURSES);
  addBanane(copie); addBanane(copie);
  assert.equal(copie.filter((c) => c.id === BANANE_ID).length, 1);
  assert.equal(copie.length, COURSES.length + 1);
});

test('cleanBan : bornes, valeurs inconnues, prototype ignoré, objet neuf aux cinq seules clés', () => {
  assert.deepEqual(cleanBan(undefined), { ...BAN_DEF });
  assert.deepEqual(cleanBan(null), { ...BAN_DEF });
  assert.equal(cleanBan({ nm: 5 }).nm, 2);
  assert.equal(cleanBan({ nm: 0.1 }).nm, 0.3);
  assert.equal(cleanBan({ nm: '1.2' }).nm, 0.8);
  assert.equal(cleanBan({ nm: NaN }).nm, 0.8);
  assert.equal(cleanBan({ nm: 1.234 }).nm, 1.23);
  assert.equal(cleanBan({ side: 'x' }).side, 'b');
  assert.equal(cleanBan({ side: 't' }).side, 't');
  assert.equal(cleanBan({ fin: 'ailleurs' }).fin, 'depart');
  assert.equal(cleanBan({ fin: 'auvent' }).fin, 'auvent');
  assert.equal(cleanBan({ off: 'non', gate: 0 }).off, true);
  assert.equal(cleanBan({ off: false, gate: false }).gate, false);
  const hostile = JSON.parse('{"__proto__": {"nm": 1.5, "side": "t"}, "extra": 1}');
  const r = cleanBan(hostile);
  assert.deepEqual(r, { ...BAN_DEF });
  assert.deepEqual(Object.keys(r).sort(), ['fin', 'gate', 'nm', 'off', 'side']);
  const herite = Object.create({ nm: 1.5, fin: 'auvent' });
  assert.deepEqual(cleanBan(herite), { ...BAN_DEF });
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  assert.deepEqual(banOf({ banNm: 1.5, banOff: false, banSide: 't', banGate: false, banFin: 'sousvent' }), { nm: 1.5, off: false, side: 't', gate: false, fin: 'sousvent' });
  assert.deepEqual(banOf({}), { ...BAN_DEF });
});

test('bananeCourse : 1 tour, arrivée sur la ligne → B, C, arrivée ; aucune bouée de porte', () => {
  const c = toXY(GR.lat, GR.lon);
  const r = bananeCourse({ c }, 315, { laps: 1 });
  assert.deepEqual(r.seq.map((p) => p.mark), ['B', 'C']);
  assert.ok(!r.points.PG && !r.points.PD);
  assert.deepEqual({ x: r.finish.x, y: r.finish.y }, c);
});

// ───────────────────────── Toutes les options de la banane (D-02, D-03)
const ctrOf = (B) => B.line.c;
const G0of = (B, W) => ({ x: ctrOf(B).x + Math.sin(W * Math.PI / 180) * 0.05 * NM, y: ctrOf(B).y + Math.cos(W * Math.PI / 180) * 0.05 * NM });

test('banane sans dégagement : B, porte, B, arrivée ; aucun point C', () => {
  const B = banLegs(315, { ban: { off: false } });
  assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'PORTE', 'B', 'FINISH']);
  assert.equal(B.points.C, undefined);
});

test('banane B laissée à tribord : C à droite en regardant au vent, côté tribord', () => {
  for (const W of [0, 315]) {
    const B = banLegs(W, { ban: { side: 't' } });
    assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'B', 'C', 'FINISH']);
    brgClose(bearingXY(B.points.B, B.points.C), W + 90, 'C au relèvement W + 90');
    near(distXY(B.points.B, B.points.C), 0.07 * NM, 1e-6, 'B–C');
    assert.equal(B.legs[0].side, 't'); assert.equal(B.legs[1].side, 't');
  }
});

test('banane sans porte : une bouée sous le vent S au centre de porte, laissée du côté de B ; aucun point PG ni PD', () => {
  for (const side of ['b', 't']) {
    const B = banLegs(315, { ban: { gate: false, side } });
    assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'S', 'B', 'C', 'FINISH']);
    const s = B.legs[2];
    assert.equal(s.to.name, 'Bouée sous le vent'); assert.equal(s.side, side); assert.equal(s.gate, undefined);
    near(distXY(s.to, G0of(B, 315)), 0, 1e-6, 'S au centre de porte');
    assert.ok(B.points.S); assert.equal(B.points.PG, undefined); assert.equal(B.points.PD, undefined);
  }
});

test('banane arrivée sous le vent décalée : ligne de 0,06 Nq centrée 0,1 Nq sous le vent du centre de la porte', () => {
  for (const W of [0, 315]) {
    const B = banLegs(W, { ban: { fin: 'sousvent' } });
    assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'B', 'C', 'FINISH']);
    const f = B.legs.at(-1).to, G0 = G0of(B, W);
    assert.equal(f.name, 'Arrivée sous le vent (décalée)');
    near(distXY(G0, f), 0.1 * NM, 1e-6, 'G0–arrivée'); brgClose(bearingXY(G0, f), W + 180, 'arrivée sous le vent');
    const { a, b } = B.finishLine;
    near(distXY(a, b), 0.06 * NM, 1e-6, 'longueur de la ligne');
    brgClose(bearingXY(f, a), W + 90, 'bout a'); brgClose(bearingXY(f, b), W - 90, 'bout b');
  }
});

test('banane arrivée au vent décalée : tous les tours finissent par la porte, puis une ligne 0,05 Nq sous B, décalée de 0,1 Nq à l’opposé du dégagement', () => {
  for (const [side, dir] of [['b', 90], ['t', -90]]) {
    const W = 315, B = banLegs(W, { ban: { fin: 'auvent', side } });
    assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'B', 'C', 'PORTE', 'FINISH']);
    const f = B.legs.at(-1).to, under = { x: B.points.B.x - Math.sin(W * Math.PI / 180) * 0.05 * NM, y: B.points.B.y - Math.cos(W * Math.PI / 180) * 0.05 * NM };
    assert.equal(f.name, 'Arrivée au vent (décalée)');
    near(distXY(under, f), 0.1 * NM, 1e-6, 'décalage'); brgClose(bearingXY(under, f), W + dir, 'côté opposé au dégagement');
    near(distXY(B.finishLine.a, B.finishLine.b), 0.06 * NM, 1e-6, 'longueur de la ligne');
    assert.deepEqual([B.legs.at(-1).from.x, B.legs.at(-1).from.y], [B.legs[5].to.x, B.legs[5].to.y], 'dernier près parti de la bouée de porte');
  }
});

test('banane 1 tour : arrivée sur la ligne → B, C, arrivée ; arrivée au vent → B, C, porte, arrivée', () => {
  const a = banLegs(315, { laps: 1 });
  assert.deepEqual(a.legs.map((l) => l.mark), ['B', 'C', 'FINISH']);
  assert.equal(a.points.PG, undefined);
  const b = banLegs(315, { laps: 1, ban: { fin: 'auvent' } });
  assert.deepEqual(b.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'FINISH']);
  assert.ok(b.points.PG && b.points.PD);
});

// ───────────────────────── Porte et arrivée d’un parcours de régate (préparation de D-08)
test('orientGate : gauche et droite vues par les bateaux qui arrivent, ordre indifférent, entrées non modifiées', () => {
  const prev = { x: 0, y: 1500 }, E = { x: 46, y: 0, name: 'Est', mark: 'XE' }, O = { x: -46, y: 0, name: 'Ouest', mark: 'XO' };
  const avant = JSON.stringify([E, O]);
  for (const [a, b] of [[E, O], [O, E]]) {
    const r = orientGate(prev, a, b);
    assert.equal(r.g.name, 'Est'); assert.equal(r.g.side, 'b');
    assert.equal(r.d.name, 'Ouest'); assert.equal(r.d.side, 't');
    assert.notEqual(r.g, E); assert.notEqual(r.d, O);
  }
  assert.equal(JSON.stringify([E, O]), avant);
  // arrivée du Sud vers le Nord : la gauche est à l’Ouest
  assert.equal(orientGate({ x: 0, y: -1500 }, E, O).g.name, 'Ouest');
});

const avecRegate = (fn) => {
  try {
    applyRegattaMarks(MARKS, COURSES, REGATE_V37);
    const c = structuredClone(COURSES.find((x) => x.id === 101));
    return fn(c);
  } finally {
    applyRegattaMarks(MARKS, COURSES, null);
  }
};
const regLine = { center: LINE_PRESETS.vignettes, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null };

test('parcours de régate : une porte [X2, null, X3] est UN bord vers la gauche des arrivants ; les éléments à deux valeurs ne changent pas', () => {
  avecRegate((c) => {
    const avant = buildLegs(c, 'G', { laps: 2, windDir: 315, line: regLine });
    const seq = [['X1', 'b'], ['X2', null, 'X3'], ['X4', 'b']];
    const B = buildLegs({ ...c, seq: { G: seq, P: seq } }, 'G', { laps: 2, windDir: 315, line: regLine });
    assert.deepEqual(B.legs.map((l) => l.mark), ['X1', 'PORTE', 'X4', 'FINISH']);
    assert.deepEqual(serialLegs({ line: B.line, legs: [B.legs[0]] }), serialLegs({ line: avant.line, legs: [avant.legs[0]] }));
    const p = B.legs[1], { g, d } = p.gate;
    const o = orientGate(B.legs[0].to, B.points.X2, B.points.X3);
    assert.deepEqual([g.x, g.y, g.side], [o.g.x, o.g.y, 'b']);
    assert.deepEqual([d.x, d.y, d.side], [o.d.x, o.d.y, 't']);
    assert.deepEqual(new Set([g.mark, d.mark]), new Set(['X2', 'X3']));
    assert.deepEqual([p.to.x, p.to.y], [g.x, g.y]); assert.equal(p.side, 'b');
    assert.deepEqual([B.legs[2].from.x, B.legs[2].from.y], [g.x, g.y], 'bord suivant parti de la bouée gauche');
    // bouée de porte inconnue : l’élément reste l’élément à deux valeurs d’aujourd’hui
    const s2 = [['X1', 'b'], ['X2', 't', 'X9'], ['X4', 'b']];
    const B2 = buildLegs({ ...c, seq: { G: s2, P: s2 } }, 'G', { laps: 2, windDir: 315, line: regLine });
    assert.deepEqual(B2.legs.map((l) => l.mark), ['X1', 'X2', 'X4', 'FINISH']);
    assert.equal(B2.legs[1].gate, undefined); assert.equal(B2.legs[1].side, 't');
  });
});

test('parcours de régate : arrivée Comité – bouée ou près d’une bouée nommée ; bouée inconnue → arrivée habituelle', () => {
  avecRegate((c) => {
    const base = buildLegs(c, 'G', { laps: 2, windDir: 315, line: regLine });
    const com = buildLegs({ ...c, finish: { kind: 'comite', mark: 'X4' } }, 'G', { laps: 2, windDir: 315, line: regLine });
    const f = com.legs.at(-1);
    assert.equal(f.mark, 'FINISH'); assert.equal(f.to.name, 'Arrivée (Comité – X4 Delta)');
    assert.deepEqual([f.to.x, f.to.y], [com.points.X4.x, com.points.X4.y]);
    const pres = buildLegs({ ...c, finish: { kind: 'pres', mark: 'X4' } }, 'G', { laps: 2, windDir: 315, line: regLine });
    assert.equal(pres.legs.at(-1).to.name, 'Arrivée (près de X4 Delta)');
    const inc = buildLegs({ ...c, finish: { kind: 'comite', mark: 'X9' } }, 'G', { laps: 2, windDir: 315, line: regLine });
    assert.equal(sameLegs({ key: 'k', ...serialLegs(inc) }, { key: 'k', ...serialLegs(base) }), null);
    assert.equal(inc.legs.at(-1).to.name, 'Arrivée');
  });
});

// ───────────────────────── Conseil de porte par routage (D-05), texte et bouées de la carte (D-06, moteur)
const champ = { sample: () => ({ dir: 0, spd: 12 }) };          // vent du Nord uniforme, 12 nd, sans terrain
const E = { x: 46, y: 0, name: 'Porte Est', mark: 'PE' }, O = { x: -46, y: 0, name: 'Porte Ouest', mark: 'PO' };
const bordPorte = (from = { x: 0, y: 1500, name: 'B' }) => {
  const { g, d } = orientGate(from, E, O);
  return { i: 2, from, to: g, brg: bearingXY(from, g), dist: distXY(from, g), side: g.side, mark: 'PORTE', lap: 1, gate: { g, d, pick: 'g', gain: null, times: null, equal: null, why: null } };
};
// routage simulé : temps imposés selon la bouée d’arrivée ou de départ (ctx.routeFn, réservé aux tests)
const routeSimule = ({ g, d, gNext, dNext }) => (a, b) => {
  if (b.x === E.x && b.y === E.y) return { time: g };
  if (b.x === O.x && b.y === O.y) return { time: d };
  if (a.x === E.x && a.y === E.y) return { time: gNext };
  if (a.x === O.x && a.y === O.y) return { time: dNext };
  return null;
};
const NEXT = { x: 2000, y: 0 };

test('adviseGate : vent uniforme, bord suivant vers l’Est → bouée Est (gauche des arrivants) retenue par le routage', () => {
  const leg = bordPorte();
  const r = adviseGate(leg, NEXT, champ, { terrain: null, forbidden: [], perf: 1, trend: 0 });
  assert.equal(r, leg.gate);
  assert.equal(r.pick, 'g'); assert.equal(r.why, 'routage'); assert.equal(r.equal, false);
  assert.ok(r.gain >= 10, `gain ${r.gain}`);
  assert.ok(r.times.g < r.times.d);
  assert.equal(leg.to.name, 'Porte Est'); assert.equal(leg.side, 'b');
  assert.equal(leg.brg, bearingXY(leg.from, E)); assert.equal(leg.dist, distXY(leg.from, E));
  // bord suivant vers l’Ouest : la droite
  const l2 = bordPorte();
  adviseGate(l2, { x: -2000, y: 0 }, champ, { trend: 0 });
  assert.equal(l2.gate.pick, 'd'); assert.equal(l2.to.name, 'Porte Ouest'); assert.equal(l2.side, 't');
});

test('adviseGate : moins de 10 s d’écart → bouées équivalentes ; bascule annoncée (|tendance| ≥ 2°/h) ou gauche par défaut', () => {
  const eq = { g: 300, gNext: 200, d: 304, dNext: 200 };
  const cas = [[0, 'g', 'defaut', undefined], [3, 'g', 'bascule', 'droite'], [-3, 'd', 'bascule', 'gauche'], [1.9, 'g', 'defaut', undefined], [-2, 'd', 'bascule', 'gauche']];
  for (const [trend, pick, why, shift] of cas) {
    const leg = bordPorte();
    const r = adviseGate(leg, NEXT, champ, { trend, routeFn: routeSimule(eq) });
    assert.equal(r.equal, true); assert.equal(r.gain, 4);
    assert.equal(r.pick, pick, `tendance ${trend}`); assert.equal(r.why, why); assert.equal(r.shift, shift);
    assert.deepEqual(r.times, { g: 500, d: 504 });
    assert.equal(leg.to, pick === 'g' ? r.g : r.d);
  }
  const leg = bordPorte();
  const r = adviseGate(leg, NEXT, champ, { trend: 3, routeFn: routeSimule({ g: 300, gNext: 200, d: 300, dNext: 190 }) });
  assert.equal(r.pick, 'd'); assert.equal(r.gain, 10); assert.equal(r.equal, false); assert.equal(r.why, 'routage'); assert.equal(r.shift, undefined);
  assert.equal(GATE_EQUAL_S, 10);
});

test('adviseGate : porte en dernier (pas de bord suivant) → seul le bord vers chaque bouée compte', () => {
  const leg = bordPorte();
  const r = adviseGate(leg, null, champ, { routeFn: routeSimule({ g: 320, gNext: 1, d: 300, dNext: 1 }) });
  assert.deepEqual(r.times, { g: 320, d: 300 });
  assert.equal(r.pick, 'd'); assert.equal(r.gain, 20);
});

test('adviseGate : routage impossible → repli sur la distance à 4 nd, jamais de NaN ni d’exception', () => {
  const leg = bordPorte();
  const r = adviseGate(leg, NEXT, champ, { routeFn: () => null });
  for (const k of ['g', 'd']) assert.ok(Number.isFinite(r.times[k]) && r.times[k] > 0);
  const tg = (distXY(leg.from, E) + distXY(E, NEXT)) / (4 * 0.5144);
  near(r.times.g, tg, 1e-9, 'repli à 4 nd');
  assert.ok(Number.isFinite(r.gain));
  // routage qui lève une valeur absurde : même repli
  const r2 = adviseGate(bordPorte(), NEXT, champ, { routeFn: () => ({ time: NaN }) });
  assert.ok(Number.isFinite(r2.times.g) && Number.isFinite(r2.gain));
});

test('prepareLeg : bord ordinaire inchangé ; après une porte, le bord part de la bouée retenue ; porte conseillée vers la cible du bord suivant', () => {
  const B = buildLegs(COURSES.find((c) => c.id === 3), 'G', { laps: 2, windDir: 315, line: regLine });
  const leg = B.legs[1], avant = JSON.stringify(leg);
  assert.equal(prepareLeg(leg, B.legs[0], B.legs[2], champ, {}), leg);
  assert.equal(JSON.stringify(leg), avant);
  // précédent porte qui a retenu la droite
  const porte = bordPorte();
  adviseGate(porte, NEXT, champ, { trend: -3, routeFn: routeSimule({ g: 300, gNext: 200, d: 302, dNext: 200 }) });
  assert.equal(porte.gate.pick, 'd');
  const suivant = { i: 3, from: porte.gate.g, to: { x: 0, y: 1500, name: 'B' }, brg: 0, dist: 0, side: 'b', mark: 'B', lap: 2 };
  prepareLeg(suivant, porte, null, champ, {});
  assert.equal(suivant.from, porte.gate.d);
  assert.equal(suivant.brg, bearingXY(O, suivant.to)); assert.equal(suivant.dist, distXY(O, suivant.to));
  // porte : cible = destination du bord suivant, ou milieu de la porte suivante
  const vus = [];
  const espion = (a, b) => { vus.push(b); return { time: 100 }; };
  prepareLeg(bordPorte(), null, { to: NEXT }, champ, { routeFn: espion });
  assert.ok(vus.some((p) => p.x === NEXT.x && p.y === NEXT.y));
  vus.length = 0;
  const p2 = bordPorte({ x: 0, y: 3000, name: 'X' });
  p2.gate.g = { ...p2.gate.g, x: 500, y: 100 }; p2.gate.d = { ...p2.gate.d, x: 700, y: 100 };
  prepareLeg(bordPorte(), null, p2, champ, { routeFn: espion });
  assert.ok(vus.some((p) => p.x === 600 && p.y === 100), 'milieu de la porte suivante');
});

test('gateText : conseil, bouées équivalentes par défaut, bascule annoncée', () => {
  assert.equal(gateText({ pick: 'd', gain: 25.4, equal: false, why: 'routage' }), 'Porte : bouée droite conseillée — 25 s de mieux');
  assert.equal(gateText({ pick: 'g', gain: 6.2, equal: true, why: 'defaut' }), 'Porte : bouées équivalentes (6 s d’écart) — bouée gauche retenue pour le calcul');
  assert.equal(gateText({ pick: 'g', gain: 6.2, equal: true, why: 'bascule', shift: 'droite' }), 'Porte : bouées équivalentes (6 s d’écart) — bouée gauche, du côté de la bascule à droite annoncée');
  assert.equal(gateText({ pick: 'd', gain: 3, equal: true, why: 'bascule', shift: 'gauche' }), 'Porte : bouées équivalentes (3 s d’écart) — bouée droite, du côté de la bascule à gauche annoncée');
});

test('markAdvice : un bord porte commence par le conseil de porte ; un bord sans porte donne le texte de la v37', () => {
  const pres = { id: 'pres', label: 'Près (louvoyage)', sail: 'Foc' }, spi = { id: 'largue', label: 'Largue sous spi', sail: 'Spi asymétrique' };
  const porte = bordPorte();
  adviseGate(porte, { x: -2000, y: 0 }, champ, {});
  const out = markAdvice({ ...porte, type: spi, twa: 150 }, { type: pres, twa: -40, brg: 0 });
  assert.equal(out[0], gateText(porte.gate));
  assert.equal(out[1], 'Laisser Porte Ouest à TRIBORD.');
  // parcours 3, bord vers 1 au près puis largue : texte v37 recopié
  const B = buildLegs(COURSES.find((c) => c.id === 3), 'G', { laps: 2, windDir: 315, line: regLine });
  const a = { ...B.legs[0], type: pres, twa: 40 }, b = { ...B.legs[1], type: spi, twa: 120, brg: 200 };
  assert.deepEqual(markAdvice(a, b), [
    `Laisser 1 ${MARKS['1'].name} à BÂBORD.`,
    'Approche conseillée tribord amures (priorité, pas de lay-line bâbord dans la flotte).',
    'Envoi de spi après la marque : envoi direct (bear-away set) — bord suivant largue sous spi au 200°.',
  ]);
});

test('banane réelle (relief et vent du dépôt, 315° 15 nd, 2 tours) : chaque porte conseillée, bord suivant parti de la bouée retenue', async () => {
  const T = await new Terrain().load('data/');
  const F = new WindField(T);
  F.compute({ points: [{ x: 0, y: 0, dir: 315, spd: 15, gust: 20 }] }, { localEffects: 1 });
  const B = buildLegs(BANANE, 'G', { laps: 2, windDir: 315, line: { center: GR, lengthNm: 0.12, mode: 'wind' } });
  const ctx = { terrain: T, forbidden: [], perf: 1, trend: 0 };
  B.legs.forEach((l, i) => prepareLeg(l, B.legs[i - 1], B.legs[i + 1], F, ctx));
  const portes = B.legs.filter((l) => l.gate);
  assert.equal(portes.length, 1);
  for (const p of portes) {
    assert.ok(p.gate.pick === 'g' || p.gate.pick === 'd');
    assert.ok(Number.isFinite(p.gate.gain));
    for (const k of ['g', 'd']) assert.ok(Number.isFinite(p.gate.times[k]) && p.gate.times[k] > 0, `temps ${k}`);
    const retenue = p.gate[p.gate.pick];
    assert.equal(p.to, retenue);
    assert.equal(B.legs[p.i + 1].from, retenue);
  }
});

test('courseMarkUse : parcours 3 identique à la boucle de drawCourse v37 ; banane : bouées de porte numérotées, conseillée marquée', () => {
  // boucle `used` de drawCourse (v37), recopiée comme référence
  const refUse = (legs) => {
    const used = new Map();
    legs.forEach((l) => { if (!l.order) return; const u = used.get(l.mark) || { side: l.side, orders: [] }; u.orders.push(l.order); used.set(l.mark, u); });
    return used;
  };
  const num = (legs) => { let o = 0; legs.forEach((l) => { if (l.mark !== 'GATE' && l.mark !== 'FINISH') l.order = ++o; }); return legs; };
  for (const cls of ['G', 'P']) {
    const legs = num(buildLegs(COURSES.find((c) => c.id === 3), cls, { laps: 2, windDir: 315, line: regLine }).legs);
    assert.deepEqual(courseMarkUse(legs), refUse(legs));
  }
  // banane 3 tours : deux portes ; la première conseillée à droite, la seconde équivalente par défaut
  const legs = num(banLegs(315, { laps: 3 }).legs);
  const [p1, p2] = legs.filter((l) => l.gate);
  adviseGate(p1, legs[p1.i + 1].to, champ, { routeFn: () => null, trend: 0 });
  Object.assign(p1.gate, { pick: 'd', equal: false, why: 'routage', gain: 30 });
  Object.assign(p2.gate, { pick: 'g', equal: true, why: 'defaut', gain: 3 });
  const u = courseMarkUse(legs);
  assert.deepEqual(u.get('PG').orders, [p1.order, p2.order]); assert.deepEqual(u.get('PD').orders, [p1.order, p2.order]);
  assert.equal(u.get('PG').side, 'b'); assert.equal(u.get('PD').side, 't');
  assert.equal(u.get('PD').advised, true); assert.equal(u.get('PD').note, '· conseillée (tour 1)');
  assert.equal(u.get('PG').advised, undefined);
  // les deux passages conseillés du même côté : « · conseillée »
  Object.assign(p2.gate, { pick: 'd', equal: false, why: 'routage', gain: 12 });
  assert.equal(courseMarkUse(legs).get('PD').note, '· conseillée');
  // portes équivalentes par défaut partout : aucune bouée conseillée
  Object.assign(p1.gate, { pick: 'g', equal: true, why: 'defaut' }); Object.assign(p2.gate, { pick: 'g', equal: true, why: 'defaut' });
  const v = courseMarkUse(legs);
  assert.ok(![...v.values()].some((x) => x.advised));
  // bascule annoncée : c’est un conseil
  Object.assign(p1.gate, { pick: 'g', equal: true, why: 'bascule', shift: 'droite' });
  assert.equal(courseMarkUse(legs).get('PG').note, '· conseillée (tour 1)');
});

// ───────────────────────── interface (plan 06-02)
const APP = readFileSync(ROOT + 'js/app.js', 'utf8');

test('legReached : bord ordinaire près de sa bouée seulement ; porte près de l’une OU l’autre bouée (D-06)', () => {
  const { legReached } = banane;
  assert.equal(typeof legReached, 'function');
  const to = { x: 1000, y: 2000 };
  const leg = { to, mark: '3', side: 'b' };
  assert.equal(legReached({ x: 1030, y: 2000 }, leg), true, 'à 30 m de la bouée');
  assert.equal(legReached({ x: 1039.9, y: 2000 }, leg, 40), true);
  assert.equal(legReached({ x: 1041, y: 2000 }, leg, 40), false, 'au-delà de 40 m');
  assert.equal(legReached({ x: 1000, y: 2100 }, leg), false);
  assert.equal(legReached({ x: 1000, y: 2060 }, leg, 80), true, 'rayon donné');
  const g = { x: 0, y: 0, side: 'b' }, d = { x: 90, y: 0, side: 't' };
  const porte = { to: g, mark: 'PORTE', gate: { g, d, pick: 'g' } };
  assert.equal(legReached({ x: 10, y: 10 }, porte), true, 'près de la bouée conseillée');
  assert.equal(legReached({ x: 95, y: -20 }, porte), true, 'près de l’autre bouée');
  assert.equal(legReached({ x: 45, y: 0 }, porte), false, 'au milieu de la porte, à 45 m de chacune');
  assert.equal(legReached({ x: 90, y: 200 }, porte), false, 'loin des deux');
  assert.equal(legReached(null, leg), false, 'sans position');
});

test('gardes : passage automatique par legReached, porte reconseillée depuis le bateau, conseil en course (D-06, D-07)', () => {
  assert.match(bodyOf(APP, 'autoAdvance'), /legReached\(gps\.pos, l, 40\)/);
  assert.doesNotMatch(bodyOf(APP, 'autoAdvance'), /distXY\(/, 'plus de test de distance à la seule destination');
  const pr = bodyOf(APP, 'planRest');
  assert.ok(pr.indexOf('prepareLeg(') > 0 && pr.indexOf('prepareLeg(') < pr.indexOf('analyzeLeg('), 'prepareLeg avant analyzeLeg');
  assert.match(pr, /gate: src\.gate \? \{ g: src\.gate\.g, d: src\.gate\.d \} : undefined/, 'la porte du bord d’origine est transmise');
  assert.match(bodyOf(APP, 'renderLiveNav'), /gateText\(/);
  assert.match(bodyOf(APP, 'renderPlan'), /gateText\(/);
});

// Réglages de la banane gardés avec la manche (D-04) ; facultatifs, une manche sans banane garde la forme v37 (D-09)
const regateB = () => ({ id: 'a', name: 'Régate', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-09', season: '2026', races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: null, at: 0 });
const PARCOURS_B = [...COURSES.map(({ id, title }) => ({ id, title })), { id: BANANE_ID, title: BANANE.title }];

test('manche : ban nettoyé gardé avec la manche, ban hostile borné, manche sans banane à la forme v37 (D-04, D-09)', () => {
  const ok = R.addRace(regateB(), { date: '2026-11-07', time: '10:55', courseId: '90', cls: 'G', laps: '2', ban: { nm: 1.2, off: true, side: 't', gate: false, fin: 'auvent' } }, { now: 1000, by: 'Teiva', courses: PARCOURS_B });
  assert.equal(ok.ok, true);
  const m = ok.regatta.races[0];
  assert.equal(m.courseId, 90);
  assert.deepEqual(m.ban, { nm: 1.2, off: true, side: 't', gate: false, fin: 'auvent' });
  assert.deepEqual(Object.keys(m), ['n', 'date', 'time', 'courseId', 'cls', 'laps', 'note', 'by', 'at', 'ban']);
  const hostile = JSON.parse('{"nm": 99, "side": "x", "gate": "oui", "fin": "<b>", "__proto__": { "pollue": 1 }, "extra": 3}');
  const h = R.addRace(regateB(), { courseId: 90, ban: hostile }, { now: 1, by: null, courses: PARCOURS_B }).regatta.races[0].ban;
  assert.deepEqual(h, { nm: 2, off: true, side: 'b', gate: true, fin: 'depart' }, 'bornes et défauts');
  assert.deepEqual(Object.keys(h), ['nm', 'off', 'side', 'gate', 'fin'], 'aucune clé de plus');
  assert.equal(Object.getPrototypeOf(h), Object.prototype); assert.equal(h.pollue, undefined);
  const sans = R.addRace(regateB(), { date: '2026-11-07', time: '10:55', courseId: '5', cls: 'G', laps: '2' }, { now: 1000, by: 'Teiva', courses: PARCOURS_B }).regatta.races[0];
  assert.deepEqual(Object.keys(sans), ['n', 'date', 'time', 'courseId', 'cls', 'laps', 'note', 'by', 'at'], 'forme v37, sans ban');
  assert.equal(R.addRace(regateB(), { courseId: 90, ban: 'texte' }, { now: 1, courses: PARCOURS_B }).regatta.races[0].ban, undefined, 'ban qui n’est pas un objet : ignoré');
});

test('manche : raceSettings rend ban nettoyé ; sans ban, sortie v37 ; banToState aller-retour (D-04)', () => {
  const avec = R.raceSettings({ date: '2026-11-07', time: '10:55', courseId: 90, cls: 'G', laps: 2, ban: { nm: 5, off: false, side: 't', gate: false, fin: 'sousvent', x: 1 } });
  assert.deepEqual(avec, { courseId: 90, cls: 'G', laps: 2, day: '2026-11-07', startTime: 11, ban: { nm: 2, off: false, side: 't', gate: false, fin: 'sousvent' } });
  assert.deepEqual(R.raceSettings({ date: '2026-11-07', time: '10:55', courseId: 5, cls: 'P', laps: 2 }), { courseId: 5, cls: 'P', laps: 2, day: '2026-11-07', startTime: 11 });
  const { banToState } = banane;
  assert.equal(typeof banToState, 'function');
  for (const x of [{}, { nm: 1.2, off: false, side: 't', gate: false, fin: 'auvent' }, { nm: 0.1, fin: 'sousvent' }]) {
    const b = cleanBan(x), st = banToState(b);
    assert.deepEqual(Object.keys(st), ['banNm', 'banOff', 'banSide', 'banGate', 'banFin']);
    assert.deepEqual(banOf(st), b);
  }
});

test('gardes : réglages de la banane figés avec la route conseillée, gardés avec la manche, rendus par « Choisir cette manche » (D-04)', () => {
  assert.match(bodyOf(APP, 'stratSettings'), /S\.courseId === BANANE_ID \? \{ ban: banOf\(S\) \} : \{\}/);
  assert.match(bodyOf(APP, 'chooseRace'), /if \(set\.ban\) Object\.assign\(S, banToState\(set\.ban\)\);/);
  const ic = bodyOf(APP, 'renderIC');
  assert.match(ic, /addRace\(cur, \{ \.\.\.raceDraft, \.\.\.\(Number\(raceDraft\.courseId\) === BANANE_ID \? \{ ban: banOf\(S\) \} : \{\}\) \}/);
});
