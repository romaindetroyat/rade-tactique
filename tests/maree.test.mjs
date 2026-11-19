// Marée de Brest (D-13) : js/maree.js contre l’outil (tools/build_maree.py), contre les observations du marégraphe non utilisées pour
// l’ajustement (tests/fixtures/brest-maree-obs.json, Shom – REFMAR, Licence Ouverte 2.0) et contre le tableau du GPEN 2027 de l’étude
// (07-RESEARCH-PLAN-EAU.md § 4.2) ; hors des années du fichier, pas de marée ; Toulon n’a ni marée ni courant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { hauteur, extremes, mareeEn, coefApproche } from '../js/maree.js';
import { VENUES } from '../js/venues.js';
import { BREST } from '../js/venue-brest.js';
import { ROOT, fixture } from './helpers/setup.mjs';

const P = JSON.parse(readFileSync(ROOT + 'data/brest.maree.json', 'utf8'));
const OBS = JSON.parse(fixture('brest-maree-obs.json'));
const OUTIL = JSON.parse(fixture('brest-maree-outil.json'));
const H = 3600000, MIN = 60000;
const ecartType = (xs) => { const m = xs.reduce((a, x) => a + x, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length); };

test('fichier du pack : moins de 10 ko, années 2026 à 2031, source citée', () => {
  assert.ok(statSync(ROOT + 'data/brest.maree.json').size < 10000);
  assert.deepEqual(Object.keys(P.years), ['2026', '2027', '2028', '2029', '2030', '2031']);
  assert.ok(P.c.length >= 35, `${P.c.length} constituants`);
  for (const y of Object.values(P.years)) { assert.equal(y.f.length, P.c.length); assert.equal(y.vu.length, P.c.length); }
  assert.match(P.source, /Shom – REFMAR/);
  assert.match(P.source, /Licence Ouverte 2\.0/);
  assert.equal(P.c[0][0], 'M2');
});

test('le module redonne les prédictions de l’outil à moins de 5 cm', () => {
  assert.equal(OUTIL.h.length, OBS.h.length);
  assert.ok(OUTIL.h.length >= 300 && OUTIL.h.length <= 600, `${OUTIL.h.length} heures`);
  let max = 0;
  for (const [t, h] of OUTIL.h) max = Math.max(max, Math.abs(hauteur(P, t) - h));
  assert.ok(max < 0.05, `écart maximal ${(max * 100).toFixed(1)} cm`);
});

test('contre les observations de 2026 (non utilisées pour l’ajustement) : écart-type sous 16 cm', () => {
  const e = OBS.h.map(([t, h]) => hauteur(P, t) - h);
  assert.ok(ecartType(e) < 0.16, `écart-type ${(ecartType(e) * 100).toFixed(1)} cm`);
  assert.match(OBS.source, /REFMAR/);
});

test('pleines et basses mers observées : heures à moins de 5 min et hauteurs à moins de 16 cm en écart-type', () => {
  const dt = [], dh = [];
  for (const [t, h, type] of OBS.extremes) {
    const p = extremes(P, t - 2 * H, t + 2 * H).filter((e) => e.type === type).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    assert.ok(p && Math.abs(p.t - t) < 90 * MIN, `extrême ${type} du ${new Date(t).toISOString()} retrouvé`);
    dt.push((p.t - t) / MIN); dh.push(p.h - h);
  }
  assert.ok(dt.length >= 60, `${dt.length} extrêmes`);
  assert.ok(ecartType(dt) < 5, `heures : écart-type ${ecartType(dt).toFixed(1)} min`);
  assert.ok(ecartType(dh) < 0.16, `hauteurs : écart-type ${(ecartType(dh) * 100).toFixed(1)} cm`);
});

// Tableau du GPEN 2027 de l’étude (§ 4.2), heures légales (UTC + 2 h en mai) : cohérence avec l’étude ; l’annuaire officiel reste un contrôle humain
const GPEN = [
  ['05-05 04:55', 'PM', 6.78], ['05-05 11:15', 'BM', 1.55], ['05-05 17:15', 'PM', 6.89], ['05-05 23:35', 'BM', 1.49],
  ['05-06 05:35', 'PM', 7.03], ['05-06 11:55', 'BM', 1.34], ['05-06 17:50', 'PM', 7.11],
  ['05-07 00:15', 'BM', 1.29], ['05-07 06:15', 'PM', 7.15], ['05-07 12:35', 'BM', 1.27], ['05-07 18:30', 'PM', 7.21],
  ['05-08 01:00', 'BM', 1.21], ['05-08 06:55', 'PM', 7.13], ['05-08 13:20', 'BM', 1.33], ['05-08 19:15', 'PM', 7.17],
  ['05-09 01:45', 'BM', 1.28], ['05-09 07:40', 'PM', 6.97], ['05-09 14:05', 'BM', 1.52], ['05-09 20:00', 'PM', 7.00],
];
const legale = (s) => Date.parse(`2027-${s.replace(' ', 'T')}:00+02:00`);

test('GPEN 2027 : extrêmes du 5 au 9 mai à 5 min et 10 cm du tableau de l’étude', () => {
  const ex = extremes(P, legale('05-05 00:00'), legale('05-10 00:00'));
  assert.equal(ex.length, GPEN.length);
  ex.forEach((e, i) => {
    const [s, type, h] = GPEN[i];
    assert.equal(e.type, type, s);
    assert.ok(Math.abs(e.t - legale(s)) <= 5 * MIN, `${s} : ${new Date(e.t).toISOString()}`);
    assert.ok(Math.abs(e.h - h) <= 0.10, `${s} : ${e.h.toFixed(2)} m`);
  });
});

test('extrêmes : alternés, dans la fenêtre demandée, à la minute près', () => {
  const t0 = Date.UTC(2026, 11, 13), t1 = t0 + 24 * H;
  const ex = extremes(P, t0, t1);
  assert.ok(ex.length >= 3 && ex.length <= 5);
  for (let i = 0; i < ex.length; i++) {
    assert.ok(ex[i].t >= t0 && ex[i].t < t1);
    assert.equal(ex[i].t % MIN, 0);
    if (i) assert.notEqual(ex[i].type, ex[i - 1].type);
    const v = hauteur(P, ex[i].t), a = hauteur(P, ex[i].t - MIN), b = hauteur(P, ex[i].t + MIN);
    if (ex[i].type === 'PM') assert.ok(v >= a && v >= b); else assert.ok(v <= a && v <= b);
  }
  assert.deepEqual(extremes(P, t1, t0), []);
});

test('marée en cours : pleine mer la plus proche, basse mer adjacente, marnage et heure de marée', () => {
  const ms = legale('05-06 13:00');                         // 1 h 05 après la basse mer de 11:55, 4 h 50 avant la pleine mer de 17:50
  const M = mareeEn(P, ms);
  assert.equal(M.pm.type, 'PM');
  assert.ok(Math.abs(M.pm.t - legale('05-06 17:50')) <= 5 * MIN);
  assert.ok(Math.abs(M.bm.t - legale('05-06 11:55')) <= 5 * MIN);
  assert.ok(M.hm < -4.7 && M.hm > -5, `hm ${M.hm}`);
  assert.equal(M.marnage, M.pm.h - M.bm.h);
  assert.ok(M.avant.t <= ms && M.apres.t > ms && M.entre.t > M.avant.t && M.entre.t < M.apres.t);
  const N = mareeEn(P, legale('05-06 07:00'));              // 1 h 25 après la pleine mer de 05:35 : marée descendante
  assert.ok(N.hm > 1.3 && N.hm < 1.5);
  assert.ok(Math.abs(N.bm.t - legale('05-06 11:55')) <= 5 * MIN);
  assert.ok(Math.abs(coefApproche(M.marnage) - 93) <= 2, `coefficient approché ${coefApproche(M.marnage)}`);
});

test('hors des années du fichier : pas de marée plutôt qu’une marée fausse', () => {
  assert.equal(hauteur(P, Date.UTC(2032, 0, 1, 6)), null);
  assert.equal(hauteur(P, Date.UTC(2025, 5, 1)), null);
  assert.deepEqual(extremes(P, Date.UTC(2032, 4, 1), Date.UTC(2032, 4, 2)), []);
  assert.equal(mareeEn(P, Date.UTC(2032, 4, 1)), null);
  assert.equal(mareeEn(P, NaN), null);
  assert.equal(hauteur(null, Date.UTC(2027, 0, 1)), null);
});

test('coefficient approché : 5,90 m → 95, 2,80 m → 45, borné à [20, 120]', () => {
  assert.equal(coefApproche(5.90), 95);
  assert.equal(coefApproche(2.80), 45);
  assert.equal(coefApproche(4.35), 70);
  assert.equal(coefApproche(0), 20);
  assert.equal(coefApproche(9), 120);
  assert.equal(coefApproche(NaN), null);
});

test('registre : Brest porte la marée ; Toulon n’a ni marée ni courant', () => {
  assert.equal(BREST.maree, 'data/brest.maree.json');
  assert.ok(!('maree' in VENUES.toulon) && !('courant' in VENUES.toulon));
  const man = JSON.parse(readFileSync(ROOT + 'data/venues.json', 'utf8'));
  assert.ok(man.venues.brest.files.some((f) => f.path === 'data/brest.maree.json'));
});
