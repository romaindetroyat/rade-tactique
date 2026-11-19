// GPEN 2027 en rade de Brest (07-09, D-08, D-09) : parcours J80 de la zone A construits au vent (banane, arrivée « à droite du comité »,
// 3P seule au dernier tour), zone A, variante Virginie Hériot, analyse avec le courant. Ce fichier tourne dans son propre processus
// (node --test) : il passe à Brest (setVenue) avant tout calcul de position.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { setVenue } from '../js/lieu.js';
import { toXY, toLL, NM, bearingXY, distXY, norm180, norm360, Terrain } from '../js/geo.js';
import { WindField } from '../js/wind.js';
import { BREST, zoneA, inZoneA } from '../js/venue-brest.js';
import { zonesXY } from '../js/venues.js';
import { BANANE, BAN_DEF, FINS, cleanBan, bananeCourse, courseBan, courseLaps, banHorsZone, banHorsEau } from '../js/banane.js';
import * as tactics from '../js/tactics.js';
import { parisInstant } from '../js/gel.js';
import { chargeAtlas, courantXY, profondeurOk } from '../js/courant.js';

setVenue('brest');
const { buildLegs, gateText, prepareLeg, analyzeLeg, routeOf, routeOpts } = tactics;
const cours = (id) => BREST.COURSES.find((c) => c.id === id);
const ZA = BREST.LINE_PRESETS.zoneA;
const ligne = { center: ZA, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null };
// parcours tel que runAnalysis le construit (réglages et tours imposés par le parcours, distance de la marque 1 de l’équipier)
const construit = (id, { dir = 270, S = { laps: 5, banNm: 0.8 } } = {}) => {
  const c = cours(id);
  return buildLegs(c, 'G', { laps: courseLaps(c, S), windDir: dir, ban: courseBan(c, S), line: ligne });
};
const noms = (B) => B.legs.map((l) => l.to.name);
const dansA = (p) => { const q = toLL(p.x, p.y); return inZoneA(q.lat, q.lon); };

test('catalogue de Brest : parcours 91 et 92 du GPEN (titres, construits par la banane, réglages imposés), la banane reste en 90', () => {
  assert.equal(cours(91).title, 'GPEN — parcours 1 (2 tours)');
  assert.equal(cours(92).title, 'GPEN — parcours 2 (3 tours)');
  for (const id of [91, 92]) {
    const c = cours(id);
    assert.equal(c.built, 'BAN'); assert.equal(c.line, 'zoneA');
    assert.deepEqual(cleanBan(c.ban), { nm: BAN_DEF.nm, off: true, side: 'b', gate: true, fin: 'comite' });
    assert.match(c.text, /le comité fait foi/);
    assert.ok(![...Array(13).keys()].map((k) => k + 1).includes(id) && id !== BANANE.id && id < 101);
  }
  assert.equal(cours(91).fixedLaps, 2); assert.equal(cours(92).fixedLaps, 3);
});

test('parcours 1 (vent 270°, ligne au centre de la zone A) : 1 – 2 (dégagement) – porte 3S / 3P – 1 – 2 – 3P – Arrivée, 2 tours quel que soit S.laps', () => {
  const B = construit(91);
  assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'B', 'C', 'PG', 'FINISH']);
  assert.deepEqual(noms(B), ['1', '2 (dégagement)', '3P', '1', '2 (dégagement)', '3P', 'Arrivée (à droite du comité)']);
  assert.deepEqual(B.legs.map((l) => l.lap ?? null), [1, 1, 1, 2, 2, 2, null]);
  // porte du premier tour : 3S et 3P ; dernier tour : 3P seule, à bâbord
  const g = B.legs[2].gate;
  assert.equal(g.g.name, '3P'); assert.equal(g.d.name, '3S'); assert.equal(g.g.side, 'b'); assert.equal(g.d.side, 't');
  assert.equal(B.legs[5].side, 'b'); assert.ok(!B.legs[5].gate);
  // 3P = bouée gauche en regardant sous le vent (vers 090°) : au nord du centre de la porte
  const mid = { x: (g.g.x + g.d.x) / 2, y: (g.g.y + g.d.y) / 2 };
  assert.ok(norm180(bearingXY(mid, g.g) - 90) < 0, '3P à gauche en regardant sous le vent');
  assert.ok(Math.abs(norm180(bearingXY(mid, g.g) - 0)) < 1);
  // tours imposés : S.laps ignoré
  assert.equal(construit(91, { S: { laps: 1, banNm: 0.8 } }).legs.length, 7);
});

test('marque 2 : à 0,07 Nq de la marque 1, au relèvement W − 90 (à gauche en regardant au vent)', () => {
  const B = construit(91), m1 = B.points.B, m2 = B.points.C;
  assert.ok(Math.abs(distXY(m1, m2) / NM - 0.07) < 1e-6);
  assert.ok(Math.abs(norm180(bearingXY(m1, m2) - 180)) < 0.01, `relèvement ${bearingXY(m1, m2).toFixed(2)}°`);
  assert.equal(m1.name, '1'); assert.equal(m2.name, '2 (dégagement)');
});

test('parcours 2 : trois tours, porte aux deux premiers passages, 3P seule au troisième', () => {
  const B = construit(92);
  assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'B', 'C', 'PORTE', 'B', 'C', 'PG', 'FINISH']);
  assert.deepEqual(B.legs.filter((l) => l.mark === 'PORTE').map((l) => l.lap), [1, 2]);
  assert.equal(B.legs[8].lap, 3); assert.equal(B.legs[8].to.name, '3P');
});

test('arrivée « à droite du comité » : ligne de 0,06 Nq depuis le comité au relèvement W + 90, centre au milieu', () => {
  for (const dir of [270, 225, 10]) {
    const B = construit(91, { dir }), L = B.line, f = B.finishLine, fin = B.legs.at(-1).to;
    assert.ok(distXY(f.a, L.cb) < 1e-6, 'la ligne part du comité');
    assert.ok(Math.abs(distXY(f.a, f.b) / NM - 0.06) < 1e-6);
    assert.ok(Math.abs(norm180(bearingXY(f.a, f.b) - (dir + 90))) < 0.01, `vent ${dir}° : relèvement ${bearingXY(f.a, f.b).toFixed(1)}`);
    assert.ok(distXY(fin, { x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 }) < 1e-6);
    assert.equal(fin.name, 'Arrivée (à droite du comité)');
    // le comité est à droite en regardant au vent : l’arrivée est encore plus à droite, loin de la bouée de départ
    assert.ok(distXY(f.b, L.pin) > distXY(f.a, L.pin));
  }
});

test('fin « comite » : gardée par cleanBan, ajoutée après les trois formes existantes ; banane de la v42 sans noms ni arrivée propre', () => {
  assert.deepEqual(FINS, ['depart', 'sousvent', 'auvent', 'comite']);
  assert.equal(cleanBan({ fin: 'comite' }).fin, 'comite');
  assert.equal(cleanBan({ fin: 'chapelle' }).fin, BAN_DEF.fin);
  // banane (90) : réglages et tours de l’état
  const S = { laps: 3, banNm: 1.1, banFin: 'sousvent' };
  assert.deepEqual(courseBan(BANANE, S), cleanBan({ nm: 1.1, fin: 'sousvent' }));
  assert.equal(courseLaps(BANANE, S), 3);
  // parcours GPEN : réglages imposés, distance de la marque 1 de l’équipier
  assert.deepEqual(courseBan(cours(91), { banNm: 1.1, banFin: 'sousvent', banOff: false, banSide: 't', banGate: false }), { nm: 1.1, off: true, side: 'b', gate: true, fin: 'comite' });
  // sans noms : noms de la banane, et la porte n’a pas de noms courts (conseil « bouée gauche / droite » de la v42)
  const L = { c: { x: 0, y: 0 }, cb: { x: 0, y: 0 }, pin: { x: 0, y: 0 }, face: 0 };
  const bc = bananeCourse(L, 0, { laps: 2, ban: { fin: 'comite' } });
  assert.deepEqual(bc.seq.map((p) => p.name), ['B (au vent)', 'C (dégagement)', 'Porte', 'B (au vent)', 'C (dégagement)', 'Porte gauche']);
  assert.equal(bc.seq[2].gate.g.label, undefined);
  assert.equal(gateText({ pick: 'g', gain: 12, equal: false, g: {}, d: {} }), 'Porte : bouée gauche conseillée — 12 s de mieux');
});

test('conseil de porte du GPEN : « Porte 3S / 3P : bouée … »', () => {
  const g = construit(91).legs[2].gate;
  assert.equal(gateText({ ...g, pick: 'd', gain: 15, equal: false }), 'Porte 3S / 3P : bouée 3S conseillée — 15 s de mieux');
  assert.equal(gateText({ ...g, pick: 'g', gain: 4, equal: true, why: null }), 'Porte 3S / 3P : bouées équivalentes (4 s d’écart) — bouée 3P retenue pour le calcul');
});

test('zone A : cercle de 1,2 NM de diamètre centré 48°17,890 N 004°21,630 W ; vrai au centre, faux à 0,7 NM', () => {
  assert.equal(zoneA.rayonNm, 0.6); assert.equal(zoneA.nom, 'Zone A — École Navale');
  assert.ok(Math.abs(zoneA.lat - (48 + 17.890 / 60)) < 1e-5 && Math.abs(zoneA.lon + (4 + 21.630 / 60)) < 1e-5);
  assert.equal(BREST.zoneA, zoneA);
  assert.ok(inZoneA(zoneA.lat, zoneA.lon));
  assert.ok(!inZoneA(zoneA.lat + 0.7 / 60, zoneA.lon), '0,7 NM au nord');
  assert.ok(!inZoneA(zoneA.lat, zoneA.lon - 0.7 / 60 / Math.cos(zoneA.lat * Math.PI / 180)), '0,7 NM à l’ouest');
  assert.ok(inZoneA(zoneA.lat + 0.55 / 60, zoneA.lon));
  assert.ok(!inZoneA(Number.NaN, zoneA.lon));
});

test('zone A : parcours centré dans le cercle avec Dist. 1 de 0,8 Nq (aucune marque dehors) ; marque 1 à 1,5 Nq hors de la zone, signalée', () => {
  for (const dir of [270, 225, 0, 90]) {
    const B = construit(91, { dir });
    assert.deepEqual(banHorsZone(B, dansA), [], `vent ${dir}° : marques dans la zone`);
    // centre de la zone au milieu du bord de près
    const c = toXY(ZA.lat, ZA.lon);
    assert.ok(Math.abs(distXY(B.line.c, c) / NM - 0.4) < 1e-6);
  }
  const loin = construit(91, { S: { laps: 2, banNm: 1.5 } });
  // ligne recentrée de 0,75 Nq : le bas du parcours sort aussi du cercle
  assert.deepEqual(banHorsZone(loin, dansA), ['1', '2 (dégagement)', '3P', '3S', 'Arrivée']);
  // une ligne pinguée fait foi (pas de recentrage)
  const c = toXY(ZA.lat, ZA.lon), ov = { cb: { x: c.x, y: c.y - 100 }, pin: { x: c.x, y: c.y + 100 } };
  const P = buildLegs(cours(91), 'G', { laps: 2, windDir: 270, ban: courseBan(cours(91), { banNm: 0.8 }), line: { ...ligne, override: ov } });
  assert.ok(distXY(P.line.c, c) < 1e-6);
  assert.deepEqual(banHorsZone(P, dansA), ['1', '2 (dégagement)']);
});

// ───────── Virginie Hériot : arrivée devant la chapelle de l’École navale (position à confirmer)
test('Virginie Hériot (93) : 1 – 2 – 3S/3P – 1 – 2 – 3S/3P – arrivée devant la chapelle, position à confirmer, ligne bouée – mât à terre', () => {
  const c = cours(93);
  assert.equal(c.title, 'GPEN — Virginie Hériot');
  assert.match(c.text, /à confirmer/);
  const B = construit(93);
  assert.deepEqual(B.legs.map((l) => l.mark), ['B', 'C', 'PORTE', 'B', 'C', 'PORTE', 'FINISH']);
  const fin = B.legs.at(-1).to;
  assert.equal(fin.name, 'Arrivée devant la chapelle (position à confirmer)');
  const chapelle = toXY(48.283165, -4.4159);
  assert.ok(distXY(B.finishLine.b, chapelle) < 40, 'mât devant la chapelle');
  assert.equal(B.finishLine.b.shore, true);
  assert.ok(distXY(fin, B.finishLine.a) < 1e-6, 'le routage vise la bouée');
  assert.ok(!dansA(fin), 'arrivée hors de la zone A');
  // la zone ne compte pas l’arrivée propre ; le mât à terre n’est jamais signalé « à terre »
  assert.deepEqual(banHorsZone(B, dansA, { finish: false }), []);
  assert.deepEqual(banHorsEau(B, () => false), []);
  assert.ok(!banHorsEau(B, (p) => p.shore === true).includes('Arrivée'));
});

// ───────── Analyse à Brest sur le vrai relief, avec le courant (6 mai 2027 à 14 h, vent 270° / 10 nd)
const PACK = existsSync(ROOT + 'data/brest.meta.json') && existsSync(ROOT + 'data/brest.courants.bin');
const sansPack = PACK ? false : 'pack de Brest absent';
const lit = (p) => { const b = readFileSync(ROOT + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
let TB = null, FB = null;
const brest = async () => {
  if (!TB) { TB = await new Terrain().load(BREST.files.base); FB = new WindField(TB, BREST.wind); FB.compute({ points: [{ x: 0, y: 0, dir: 270, spd: 10, gust: 13 }] }, { localEffects: 1 }); }
  return { T: TB, F: FB };
};
const at = (h) => parisInstant('2027-05-06', Math.floor(h), Math.round((h % 1) * 60));
async function analyse(id, h0 = 14) {
  const { T, F } = await brest();
  const A = chargeAtlas(JSON.parse(readFileSync(ROOT + BREST.courant.header, 'utf8')), lit(BREST.courant.bin), lit(BREST.courant.fonds));
  const M = JSON.parse(readFileSync(ROOT + BREST.maree, 'utf8'));
  const c = toXY(ZA.lat, ZA.lon), w = F.sample(c.x, c.y), crs = cours(id);
  const B = buildLegs(crs, 'G', { laps: courseLaps(crs, { laps: 1 }), windDir: w.dir, ban: courseBan(crs, { banNm: 0.8 }), line: ligne });
  const ctx = { terrain: T, forbidden: zonesXY(BREST.FORBIDDEN_ZONES, toXY), perf: 1, trend: 0, memo: new Map(), current: courantXY(A, M), depth: profondeurOk(A, M), t0: at(h0) };
  const legs = []; let t = h0;
  for (const [k, leg] of B.legs.entries()) {
    ctx.t0 = at(t);
    prepareLeg(leg, legs[legs.length - 1], B.legs[k + 1], F, ctx);
    const a = analyzeLeg(leg, F, ctx);
    a.eta0 = t; t += a.time / 3600; a.eta1 = t;
    legs.push(a);
  }
  return { B, legs, total: t - h0 };
}

test('Brest, parcours 1 du GPEN analysé avec le courant (270° / 10 nd, 6 mai 2027 à 14 h) : chaque bord a un temps fini, conseil de porte 3S / 3P', { skip: sansPack }, async () => {
  const { legs, total } = await analyse(91);
  assert.equal(legs.length, 7);
  for (const l of legs) { assert.ok(Number.isFinite(l.time) && l.time > 0, `bord vers ${l.to.name} : ${l.time}`); assert.ok(l.route, `route vers ${l.to.name}`); }
  assert.ok(total > 0.3 && total < 1.5, `total ${(total * 60).toFixed(1)} min`);
  const g = legs.find((l) => l.gate);
  assert.match(gateText(g.gate), /^Porte 3S \/ 3P : (bouée 3[SP] conseillée — \d+ s de mieux|bouées équivalentes)/);
  assert.ok(legs.some((l) => l.advice.some((a) => /atlas du Shom/.test(a))), 'conseils de courant');
});

test('Brest, Virginie Hériot analysé avec le courant : l’arrivée devant la chapelle est atteinte (temps fini)', { skip: sansPack }, async () => {
  const { legs } = await analyse(93);
  const fin = legs.at(-1);
  assert.ok(Number.isFinite(fin.time) && fin.time > 0 && fin.route, `dernier bord : ${fin.time}`);
  assert.ok(fin.dist / NM > 1.5, `dernier bord ${(fin.dist / NM).toFixed(2)} Nq`);
});

test('Brest, fonds : à la basse mer du 6 mai 2027 (11 h 54), vent 045°, la porte du parcours 1 tombe sur des fonds trop faibles (avertissement) ; à 14 h par 270°, aucune', { skip: sansPack }, async () => {
  const A = chargeAtlas(JSON.parse(readFileSync(ROOT + BREST.courant.header, 'utf8')), lit(BREST.courant.bin), lit(BREST.courant.fonds));
  const M = JSON.parse(readFileSync(ROOT + BREST.maree, 'utf8')), ok = profondeurOk(A, M);
  const bm = construit(91, { dir: 45 }), t = parisInstant('2027-05-06', 11, 54);
  assert.ok(banHorsEau(bm, (p) => !ok(p.x, p.y, t)).includes('3S'), 'basse mer, vent 045° : 3S trop peu profonde');
  const pm = construit(91, { dir: 270 }), t14 = parisInstant('2027-05-06', 14, 0);
  assert.deepEqual(banHorsEau(pm, (p) => !ok(p.x, p.y, t14)), []);
});
