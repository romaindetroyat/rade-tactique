// Parcours banane, porte à deux bouées, arrivées décalées et conseil de porte (phase 6, D-01 à D-05, D-09, D-10).
// Les bords des parcours 1 à 13 et d’une régate archivée sont comparés à ceux de la v37 (fixture capturée sur 6e7af98).
// Les tables réelles MARKS et COURSES sont rendues à l’identique : comparaison avec l’état du début à la fin du fichier.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/setup.mjs';
import { legCases, sameLegs } from './helpers/legs.mjs';
import { buildLegs, rankCourses } from '../js/tactics.js';
import { BANANE_ID, BANANE, BAN_DEF, cleanBan, banOf, addBanane, bananeCourse } from '../js/banane.js';
import { NM, toXY, bearingXY, distXY, norm180 } from '../js/geo.js';
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
