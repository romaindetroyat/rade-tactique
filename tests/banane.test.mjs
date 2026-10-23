// Parcours banane, porte à deux bouées, arrivées décalées et conseil de porte (phase 6, D-01 à D-05, D-09, D-10).
// Les bords des parcours 1 à 13 et d’une régate archivée sont comparés à ceux de la v37 (fixture capturée sur 6e7af98).
// Les tables réelles MARKS et COURSES sont rendues à l’identique : comparaison avec l’état du début à la fin du fichier.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/setup.mjs';
import { legCases, sameLegs, serialLegs, REGATE_V37 } from './helpers/legs.mjs';
import { buildLegs, rankCourses } from '../js/tactics.js';
import { BANANE_ID, BANANE, BAN_DEF, cleanBan, banOf, addBanane, bananeCourse, orientGate } from '../js/banane.js';
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
