// Courant de marée dans le routage et les conseils (07-08, D-13, D-14c, D-01). Ce fichier tourne dans son propre processus (node --test) :
// il passe à Brest (setVenue) pour l’analyse sur le vrai relief ; les cas de courant uniforme ne dépendent pas du plan d’eau ; les routes de
// Toulon sans option sont rejouées dans un processus à part (origine de Toulon), contre la fixture v42.
// Temps de l’étude (07-RESEARCH-PLAN-EAU.md § 4.4 et § 6.4) : bord de près de 0,8 Nq par 8 nd de vent sur l’eau, courant de 0,75 nd dans
// l’axe : 12,1 min sans courant, 14,9 contre, 10,2 avec — calculés par l’étude comme distance / (gain au vent de la polaire ± courant).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers/setup.mjs';
import { route } from '../js/router.js';
import { optimalAngles } from '../js/polar.js';
import * as tactics from '../js/tactics.js';

const KN = 1852 / 3600, NQ = 1852;
const champ = (spd, dir = 0) => ({ sample: () => ({ dir, spd }) });
// courant uniforme de `nd` nœuds portant vers `brg`
const uni = (nd, brg) => () => ({ u: Math.sin(brg * Math.PI / 180) * nd * KN, v: Math.cos(brg * Math.PI / 180) * nd * KN });
const O = { x: 0, y: 0 }, M = { x: 0, y: 0.8 * NQ };
// formule de l’étude : distance / (gain au vent par 8 nd de vent sur l’eau ± courant)
const etude = (c) => 0.8 * NQ / ((optimalAngles(8).up.vmg + c) * KN) / 60;

test('courant uniforme dans l’axe : temps de l’étude à 0,3 min près (12,1 ; 14,9 ; 10,2 min)', () => {
  assert.ok(Math.abs(etude(0) - 12.1) < 0.05 && Math.abs(etude(-0.75) - 14.9) < 0.1 && Math.abs(etude(0.75) - 10.2) < 0.05, 'formule de l’étude');
  const sans = route(O, M, champ(8), {}).time / 60;
  // vent sur l’eau de 8 nd : vent au sol 8,75 nd quand le courant porte sous le vent (vers 180°), 7,25 nd quand il porte au vent (vers 000°)
  const contre = route(O, M, champ(8.75), { current: uni(0.75, 180) }).time / 60;
  const avec = route(O, M, champ(7.25), { current: uni(0.75, 0) }).time / 60;
  assert.ok(Math.abs(sans - etude(0)) <= 0.3, `sans courant : ${sans.toFixed(2)} min`);
  assert.ok(Math.abs(contre - etude(-0.75)) <= 0.3, `courant contre : ${contre.toFixed(2)} min (étude ${etude(-0.75).toFixed(2)})`);
  assert.ok(Math.abs(avec - etude(0.75)) <= 0.3, `courant avec : ${avec.toFixed(2)} min (étude ${etude(0.75).toFixed(2)})`);
  assert.ok(contre > sans + 2 && avec < sans - 1.5, 'le courant contre allonge, le courant avec raccourcit');
});

test('vent sur l’eau = vent au sol − courant : 8 nd au sol avec 0,75 nd portant sous le vent, le bateau a moins de vent et va moins vite', () => {
  const eau8 = route(O, M, champ(8.75), { current: uni(0.75, 180) }).time;
  const sol8 = route(O, M, champ(8), { current: uni(0.75, 180) }).time;
  assert.ok(sol8 > eau8 + 30, `${(sol8 / 60).toFixed(2)} min contre ${(eau8 / 60).toFixed(2)} : 7,25 nd sur l’eau au lieu de 8`);
  const p = route(O, M, champ(8), { current: uni(0.75, 180) }).path[2];
  assert.ok(Math.abs(Math.abs(p.twa) - optimalAngles(7.25).up.twa) < 4, 'angle au vent de la polaire pris sur le vent de l’eau');
});

test('courant de travers (0,6 nd vers l’est) : la route arrive à la marque, premier cap différent d’au moins 4° de celui sans courant', () => {
  const sans = route(O, M, champ(8), {}), r = route(O, M, champ(8), { current: uni(0.6, 90) });
  assert.ok(r, 'route trouvée');
  const fin = r.path[r.path.length - 1];
  assert.deepEqual([fin.x, fin.y], [M.x, M.y], 'arrivée à la marque, pas de dérive non compensée');
  for (const p of r.path.slice(1)) assert.ok(Number.isFinite(p.sog) && p.sog > 0, 'vitesse fond notée à chaque pas');
  const d = Math.abs(((r.firstHeading - sans.firstHeading + 540) % 360) - 180);
  assert.ok(d >= 4, `premier cap ${r.firstHeading}° contre ${sans.firstHeading}° sans courant`);
  // la route fond suit l’arrivée : le dernier pas vise la marque à quelques mètres près
  const a = r.path[r.path.length - 2];
  assert.ok(Math.hypot(a.x - M.x, a.y - M.y) < 200, 'dernier pas au voisinage de la marque');
});

test('courant toujours nul : même temps que sans courant à 1 s près ; t0 transmis à la fonction de courant', () => {
  const sans = route(O, M, champ(8), {}), vus = [];
  const nul = route(O, M, champ(8), { current: (x, y, ms) => { vus.push(ms); return { u: 0, v: 0 }; }, t0: 1.8e12 });
  assert.ok(Math.abs(nul.time - sans.time) <= 1, `${nul.time.toFixed(1)} s contre ${sans.time.toFixed(1)} s`);
  assert.ok(vus.length > 50 && vus[0] === 1.8e12 && Math.max(...vus) > 1.8e12 + 600e3, 'instants = t0 + p.t × 1000');
  // courant inconnu (null : hors de l’atlas) : courant nul
  const inconnu = route(O, M, champ(8), { current: () => null });
  assert.ok(Math.abs(inconnu.time - sans.time) <= 1, 'courant null traité comme nul');
});

test('routeOf avec courant : clé selon l’heure de départ arrondie à 5 min ; sans courant, une seule entrée comme en v42', () => {
  const memo = new Map(), F = champ(8), ctx = { memo };
  const cur = uni(0.5, 180), t0 = Date.UTC(2027, 4, 6, 12);
  const a = tactics.routeOf(O, M, F, { perf: 1, current: cur, t0 }, ctx);
  const b = tactics.routeOf(O, M, F, { perf: 1, current: cur, t0: t0 + 60e3 }, ctx);
  const c = tactics.routeOf(O, M, F, { perf: 1, current: cur, t0: t0 + 6 * 60e3 }, ctx);
  assert.equal(a, b, 'même tranche de 5 min : même route');
  assert.notEqual(a, c, 'plus de 5 min plus tard : autre route');
  assert.equal(memo.size, 2);
  const m2 = new Map(), x = tactics.routeOf(O, M, F, { perf: 1 }, { memo: m2 }), y = tactics.routeOf(O, M, F, { perf: 1, t0: 5e12 }, { memo: m2 });
  assert.equal(x, y, 'sans courant, t0 n’entre pas dans la clé');
  assert.deepEqual([...m2.keys()], ['0|0,0|0,1481.6000000000001|1|undefined|undefined'], 'clé de la v42');
  // options de routage : celles de la v42 sans courant ; avec, courant, hauteur d’eau et instant
  const T = {}, Z = [];
  assert.deepEqual(Object.keys(tactics.routeOpts({ terrain: T, forbidden: Z, perf: 1, trend: 0, memo })), ['terrain', 'forbidden', 'perf']);
  const o = tactics.routeOpts({ terrain: T, forbidden: Z, perf: 1, current: cur, depth: null, t0 });
  assert.equal(o.current, cur); assert.equal(o.t0, t0);
  assert.equal(tactics.routeOpts({ terrain: T, forbidden: Z, current: cur, t0 }, t0 + 5).t0, t0 + 5);
});

test('Toulon : route() sans option de courant identique à la v42 sur les dix routes de la fixture (quatre vents)', () => {
  const url = (p) => JSON.stringify(pathToFileURL(ROOT + p).href);
  const out = execFileSync(process.execPath, ['--import', pathToFileURL(ROOT + 'tests/helpers/setup.mjs').href, '--input-type=module', '-e', `
    const { Terrain, toXY } = await import(${url('js/geo.js')});
    const { WindField } = await import(${url('js/wind.js')});
    const { route } = await import(${url('js/router.js')});
    const { MARKS, FORBIDDEN_ZONE } = await import(${url('js/courses.js')});
    const T = await new Terrain().load('data/'), F = new WindField(T), forbidden = [FORBIDDEN_ZONE.map((p) => toXY(p.lat, p.lon))];
    const PAIRES = [['1', '2'], ['3', '7'], ['9', '1'], ['11', '4'], ['2', '3'], ['7', '6'], ['6', '5'], ['4', '11'], ['10', '8'], ['5', '9']];
    const routes = [];
    for (const [dir, spd] of [[315, 25], [215, 10], [140, 14], [40, 6]]) {
      F.compute({ points: [{ x: 0, y: 0, dir, spd, gust: spd * 1.3 }] }, { localEffects: 1 });
      for (const [a, b] of PAIRES) {
        const A = MARKS[a], B = MARKS[b], r = route(toXY(A.lat, A.lon), toXY(B.lat, B.lon), F, { terrain: T, forbidden, perf: 1 });
        routes.push({ key: a + '→' + b + '|' + dir + '/' + spd, r: r ? { time: r.time, maneuvers: r.maneuvers, firstTack: r.firstTack ?? null, firstHeading: r.firstHeading ?? null, firstTwa: r.firstTwa ?? null,
          stbdShare: r.stbdShare, rightShare: r.rightShare, maxOff: r.maxOff, n: r.path.length,
          sx: r.path.reduce((t, p, i) => t + p.x * (i + 1), 0), sy: r.path.reduce((t, p, i) => t + p.y * (i + 1), 0) } : null });
      }
    }
    process.stdout.write(JSON.stringify(routes));
  `], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 }).toString();
  const cur = JSON.parse(out), ref = JSON.parse(readFileSync(ROOT + 'tests/fixtures/toulon-v42.json', 'utf8')).routes;
  assert.equal(cur.length, 40);
  assert.deepEqual(cur.map((r) => r.key), ref.map((r) => r.key));
  for (let i = 0; i < ref.length; i++) {
    const a = cur[i].r, b = ref[i].r;
    if (!b) { assert.equal(a, null, ref[i].key); continue; }
    for (const k of Object.keys(b)) {
      const ok = typeof b[k] === 'number' ? Math.abs(a[k] - b[k]) <= 1e-9 * Math.max(1, Math.abs(b[k])) : a[k] === b[k];
      assert.ok(ok, `${ref[i].key} : ${k} ${a[k]} au lieu de ${b[k]}`);
    }
  }
});

// ───────── À Brest, sur le vrai relief : banane de la zone A, vent 270°/10 nd, marée du 6 mai 2027 (GPEN, vive-eau)
import { setVenue } from '../js/lieu.js';
import { Terrain, toXY, pointInPolygon } from '../js/geo.js';
import { WindField } from '../js/wind.js';
import { BREST } from '../js/venue-brest.js';
import { BANANE } from '../js/banane.js';
import { zonesXY } from '../js/venues.js';
import { parisInstant } from '../js/gel.js';
import { chargeAtlas, courantXY, profondeurOk } from '../js/courant.js';

setVenue('brest');
const PACK = existsSync(ROOT + 'data/brest.meta.json') && existsSync(ROOT + 'data/brest.courants.bin');
const sansPack = PACK ? false : 'pack de Brest absent';
const lit = (p) => { const b = readFileSync(ROOT + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const ATLAS = PACK ? chargeAtlas(JSON.parse(readFileSync(ROOT + BREST.courant.header, 'utf8')), lit(BREST.courant.bin), lit(BREST.courant.fonds)) : null;
const MAREE = JSON.parse(readFileSync(ROOT + BREST.maree, 'utf8'));
const xy = (lat, lon) => toXY(lat, lon);
let TB = null, FB = null;
const brest = async () => {
  if (!TB) { TB = await new Terrain().load(BREST.files.base); FB = new WindField(TB, BREST.wind); FB.compute({ points: [{ x: 0, y: 0, dir: 270, spd: 10, gust: 13 }] }, { localEffects: 1 }); }
  return { T: TB, F: FB };
};
const at = (h) => parisInstant('2027-05-06', Math.floor(h), Math.round((h % 1) * 60));

// Analyse de la banane comme runAnalysis (js/app.js) : départ à `h0` (heure de Paris), courant à l’heure de chaque bord si `cur`
async function banane(h0, cur) {
  const { T, F } = await brest();
  const { buildLegs, prepareLeg, analyzeLeg, routeOf, routeOpts } = tactics;
  const preset = BREST.LINE_PRESETS.zoneA, forbidden = zonesXY(BREST.FORBIDDEN_ZONES, xy);
  const c = xy(preset.lat, preset.lon), w = F.sample(c.x, c.y);
  const B = buildLegs(BANANE, 'G', { laps: 2, windDir: w.dir, wlLengthNm: 0.8, ban: { nm: 0.8 }, line: { center: preset, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null } });
  const ctx = { terrain: T, forbidden, perf: 1, trend: 0, memo: new Map() };
  if (cur) Object.assign(ctx, { current: cur.current, depth: cur.depth, t0: at(h0) });
  const L0 = B.line, first = B.legs[0], cands = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const p = { x: L0.pin.x + (L0.cb.x - L0.pin.x) * f, y: L0.pin.y + (L0.cb.y - L0.pin.y) * f };
    const r = routeOf(p, first.to, F, routeOpts(ctx), ctx);
    if (r) cands.push({ f, p, time: r.time });
  }
  if (cands.length) { const best = cands.reduce((a, b) => (b.time < a.time ? b : a)); first.from = { ...best.p, name: 'Départ' }; }
  const legs = []; let t = h0;
  for (const [k, leg] of B.legs.entries()) {
    if (cur) ctx.t0 = at(t);
    prepareLeg(leg, legs[legs.length - 1], B.legs[k + 1], F, ctx);
    const a = analyzeLeg(leg, F, ctx);
    a.eta0 = t; t += a.time / 3600; a.eta1 = t;
    legs.push(a);
  }
  return { legs, total: t - h0, forbidden, ctx };
}
const COURANT = () => ({ current: courantXY(ATLAS, MAREE), depth: profondeurOk(ATLAS, MAREE) });

test('Brest, banane de la zone A (270°/10 nd, 6 mai 2027 à 14 h 00) : chaque bord a un temps fini, le total change de plus de 5 % avec le courant', { skip: sansPack }, async () => {
  const sans = await banane(14, null), avec = await banane(14, COURANT());
  assert.equal(avec.legs.length, sans.legs.length);
  for (const l of avec.legs) {
    assert.ok(Number.isFinite(l.time) && l.time > 0, `bord vers ${l.to.name} : temps ${l.time}`);
    assert.ok(l.route, `bord vers ${l.to.name} : route avec courant trouvée`);
  }
  const ecart = Math.abs(avec.total - sans.total) / sans.total;
  assert.ok(ecart > 0.05, `total ${(avec.total * 60).toFixed(1)} min avec courant, ${(sans.total * 60).toFixed(1)} sans (${(ecart * 100).toFixed(1)} %)`);
  // les bords sont routés à leur heure : l’instant de chaque bord suit le précédent
  for (let i = 1; i < avec.legs.length; i++) assert.ok(avec.legs[i].eta0 > avec.legs[i - 1].eta0);
});

test('Brest, routes avec courant hors des zones interdites : un pas ne rogne une zone que de moins de 25 m (pas plus longs avec le courant)', { skip: sansPack }, async () => {
  const { T, F } = await brest(), polys = zonesXY(BREST.FORBIDDEN_ZONES, xy), cur = COURANT();
  const bord = (poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
  const distSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
  // route de 07-06 (nord de l’Île Longue vers l’est), à la mi-marée montante et descendante du 6 mai 2027
  for (const h of [9, 15]) {
    const r = route(xy(48.3200, -4.5100), xy(48.3050, -4.4800), F, { terrain: T, forbidden: polys, perf: 1, current: cur.current, depth: cur.depth, t0: at(h) });
    assert.ok(r && r.path.length > 2, `${h} h : route trouvée`);
    let prof = 0;
    for (const p of r.path) for (const poly of polys) assert.ok(!pointInPolygon(p, poly), `${h} h : point du chemin dans une zone`);
    for (let i = 1; i < r.path.length; i++) {
      const a = r.path[i - 1], b = r.path[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
      for (let k = 1; k < n; k++) {
        const q = { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n };
        for (const poly of polys) if (pointInPolygon(q, poly)) prof = Math.max(prof, Math.min(...bord(poly).map(([u, v]) => distSeg(q, u, v))));
      }
    }
    assert.ok(prof < 25, `${h} h : un pas rogne une zone de ${prof.toFixed(0)} m`);
  }
});

// ───────── Conseils de courant (tâche 2) : courant du bord, côté favorable, renverse, vent contre courant, hauteur d’eau
const RESERVE = '(estimation d’après l’atlas du Shom)';
const textes = (cs) => cs.map((c) => c.t);
// bord synthétique vers le nord (0,8 Nq), déjà routé : temps avec et sans courant donnés
const bordNord = (extra = {}) => ({ from: { x: 0, y: 0 }, to: { x: 0, y: 0.8 * NQ }, brg: 0, dist: 0.8 * NQ, time: 14.95 * 60, timeSans: 12.12 * 60,
  wind: { dir: 0, spd: 8 }, route: null, ...extra });

test('currentAdvice sans courant dans le contexte : aucun conseil (Toulon)', () => {
  assert.equal(typeof tactics.currentAdvice, 'function');
  assert.deepEqual(tactics.currentAdvice(bordNord(), { terrain: null, forbidden: [], perf: 1 }), []);
  assert.deepEqual(tactics.currentAdvice(bordNord(), {}), []);
});

test('courant contre le bord (0,75 nd vers 180°) : « Courant 0,8 nd vers 180° : contre vous sur ce bord (≈ +2 min 50 s) », origine courant', () => {
  const cs = tactics.currentAdvice(bordNord(), { current: uni(0.75, 180), t0: Date.UTC(2027, 4, 6, 12) });
  assert.ok(cs.length >= 1);
  for (const c of cs) { assert.equal(c.o, 'C'); assert.ok(!/'/.test(c.t), 'apostrophe typographique'); }
  assert.ok(cs[0].t.startsWith('Courant 0,8 nd vers 180° : contre vous sur ce bord (≈ +2 min 50 s)'), cs[0].t);
  // courant avec : gain annoncé en moins
  const av = tactics.currentAdvice(bordNord({ time: 10.19 * 60 }), { current: uni(0.75, 0), t0: 0 });
  assert.ok(av[0].t.startsWith('Courant 0,8 nd vers 000° : avec vous sur ce bord (≈ −1 min 50 s)'), av[0].t);
  // de travers : dérive annoncée
  const tr = tactics.currentAdvice(bordNord({ time: 12.3 * 60 }), { current: uni(0.6, 90), t0: 0 });
  assert.match(tr[0].t, /^Courant 0,6 nd vers 090° : de travers, il vous dépose à droite de la route/);
});

test('côté favorable : 0,3 nd de mieux à droite → conseillé ; écart sous 0,15 nd → rien', () => {
  const KNs = (nd) => nd * KN;
  const fort = (x) => (x > 200 ? 0.5 : 0.2), faible = (x) => (x > 200 ? 0.3 : 0.2);
  const ctx = (f) => ({ current: (x) => ({ u: 0, v: KNs(f(x)) }), t0: 0 });
  const a = textes(tactics.currentAdvice(bordNord({ time: 11 * 60 }), ctx(fort)));
  assert.ok(a.some((t) => t.startsWith('Courant plus favorable à droite du bord (0,3 nd de mieux)')), a.join(' | '));
  const g = textes(tactics.currentAdvice(bordNord({ time: 11 * 60 }), ctx((x) => (x < -200 ? 0.5 : 0.2))));
  assert.ok(g.some((t) => t.startsWith('Courant plus favorable à gauche du bord (0,3 nd de mieux)')), g.join(' | '));
  const b = textes(tactics.currentAdvice(bordNord({ time: 11 * 60 }), ctx(faible)));
  assert.ok(!b.some((t) => /plus favorable/.test(t)), 'écart de 0,1 nd : pas de côté annoncé');
});

test('vent contre courant : vent de 270° et courant vers 270° de plus de 0,5 nd → clapot ; sinon rien', () => {
  const leg = bordNord({ wind: { dir: 270, spd: 12 }, time: 12 * 60 });
  const oui = textes(tactics.currentAdvice(leg, { current: uni(0.7, 270), t0: 0 }));
  assert.ok(oui.some((t) => t.startsWith('Vent contre courant : clapot plus dur')), oui.join(' | '));
  for (const c of [uni(0.4, 270), uni(0.7, 90), uni(0.7, 180)]) assert.ok(!textes(tactics.currentAdvice(leg, { current: c, t0: 0 })).some((t) => /clapot/.test(t)));
});

test('réserve « (estimation d’après l’atlas du Shom) » une fois par bord, en fin du dernier conseil de courant', () => {
  const KNs = (nd) => nd * KN;
  for (const ctx of [{ current: uni(0.75, 180), t0: 0 }, { current: (x) => ({ u: 0, v: KNs(x > 200 ? 0.5 : 0.2) }), t0: 0 }, { current: uni(0.05, 90), t0: 0 }]) {
    const t = textes(tactics.currentAdvice(bordNord({ wind: { dir: 0, spd: 8 } }), ctx));
    assert.equal(t.filter((x) => x.includes(RESERVE)).length, 1, t.join(' | '));
    assert.ok(t[t.length - 1].endsWith(RESERVE), t.join(' | '));
  }
});

test('renverses du 6 mai 2027 en zone A : vers 12 h 10 (après la basse mer de 11 h 54) et vers la pleine mer du soir (17 h 52)', { skip: sansPack }, () => {
  const z = xy(BREST.LINE_PRESETS.zoneA.lat, BREST.LINE_PRESETS.zoneA.lon), zone = { x: z.x, y: z.y, r: 0.6 * NQ };
  const ctx = { current: courantXY(ATLAS, MAREE) };
  const rv = tactics.renverses(ctx, at(0), at(24), zone);
  const h = (ms) => (ms - at(0)) / 3600e3;
  assert.ok(rv.some((r) => h(r.t) >= 12 && h(r.t) <= 12.5), `renverses : ${rv.map((r) => h(r.t).toFixed(2)).join(', ')}`);
  assert.ok(rv.some((r) => Math.abs(h(r.t) - (17 + 52 / 60)) <= 0.5), `renverse du soir : ${rv.map((r) => h(r.t).toFixed(2)).join(', ')}`);
  for (const r of rv) assert.ok(r.t >= at(0) && r.t <= at(24) && Number.isFinite(r.de) && Number.isFinite(r.vers));
  // un bord de 11 h 50 à 12 h 30 contient la renverse de midi
  const leg = bordNord({ wind: { dir: 270, spd: 10 }, time: 40 * 60, from: z, to: { x: z.x, y: z.y + 0.8 * NQ } });
  const t = textes(tactics.currentAdvice(leg, { ...ctx, t0: at(11 + 50 / 60), zone }));
  assert.ok(t.some((x) => /^Renverse vers 12 h [0-3]\d : le courant tourne pendant ce bord/.test(x)), t.join(' | '));
  // un bord de 14 h à 14 h 40 n’en contient pas
  assert.ok(!textes(tactics.currentAdvice(leg, { ...ctx, t0: at(14), zone })).some((x) => /^Renverse/.test(x)));
  assert.equal(tactics.renverseText(rv[0].t), `Renverse vers ${String(new Date(rv[0].t).getHours()).padStart(2, '0')} h ${String(new Date(rv[0].t).getMinutes()).padStart(2, '0')}`);
});

test('hauteur d’eau (synthétique) : un haut-fond qui découvre à basse mer dévie la route ; à pleine mer la même route passe', () => {
  const F = champ(10, 90), A = { x: 0, y: 0 }, B = { x: 0, y: 1500 };
  const banc = (x, y) => Math.abs(x) < 150 && y > 500 && y < 1000;
  const basse = 1e12, pleine = 2e12;
  const depth = (x, y, ms) => !(banc(x, y) && ms < 1.5e12);          // banc à sec avant 1,5e12 (basse mer), couvert après
  const rb = route(A, B, F, { current: () => ({ u: 0, v: 0 }), depth, t0: basse });
  const rp = route(A, B, F, { current: () => ({ u: 0, v: 0 }), depth, t0: pleine });
  assert.ok(rb && rp);
  assert.ok(!rb.path.some((p) => banc(p.x, p.y)), 'basse mer : aucun point sur le banc');
  assert.ok(rb.maxOff > 100, `basse mer : route déviée (${rb.maxOff.toFixed(0)} m)`);
  assert.ok(rp.path.some((p) => banc(p.x, p.y)), 'pleine mer : la route droite passe sur le banc couvert');
});

test('hauteur d’eau à Brest (fonds de l’atlas, marée du 6 mai 2027) : haut-fond de +0,1 m au sud-est de la zone A obstacle à la basse mer, navigable à la pleine mer', { skip: sansPack }, () => {
  const ok = profondeurOk(ATLAS, MAREE), p = xy(48.28672, -4.35428);
  assert.equal(ok(p.x, p.y, at(11 + 54 / 60)), false, 'basse mer de 11 h 54 (1,34 m) : 1,2 m d’eau sur le fond, moins de 1,5 + 1 m');
  assert.equal(ok(p.x, p.y, at(17 + 52 / 60)), true, 'pleine mer de 17 h 52 (7,11 m)');
  const centre = xy(BREST.LINE_PRESETS.zoneA.lat, BREST.LINE_PRESETS.zoneA.lon);
  assert.equal(ok(centre.x, centre.y, at(11 + 54 / 60)), true, 'centre de la zone A (−8 m) navigable à basse mer');
  assert.equal(ok(1e7, 1e7, at(12)), true, 'hors de la grille des fonds : aucune donnée, la règle de la terre seule');
  assert.equal(ok(centre.x, centre.y, Date.UTC(2035, 0, 1)), true, 'marée inconnue : aucune donnée');
});

test('analyse de Brest avec courant : chaque bord porte ses conseils de courant et une seule réserve Shom ; sans courant, aucun', { skip: sansPack }, async () => {
  const avec = await banane(14, COURANT()), sans = await banane(14, null);
  for (const l of avec.legs) {
    assert.ok(l.advice.some((a) => /^Courant \d,\d nd/.test(a)), `bord vers ${l.to.name} : ${l.advice.join(' | ')}`);
    assert.equal(l.advice.filter((a) => a.includes(RESERVE)).length, 1, `bord vers ${l.to.name}`);
    assert.ok(l.courant && Array.isArray(l.courant.advice) && l.courant.advice.every((c) => c.o === 'C'));
    assert.ok(Number.isFinite(l.timeSans));
  }
  for (const l of sans.legs) { assert.ok(!l.advice.some((a) => a.includes(RESERVE) || /^Courant \d/.test(a))); assert.equal(l.courant, undefined); assert.equal(l.timeSans, undefined); }
});
