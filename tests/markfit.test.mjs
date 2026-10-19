// Recalage d’une bouée depuis la trace (JUST-02, D-02 amendé le 19/10) : la trace propose, l’équipier valide.
// Méthode verrouillée = sommet du virage + 14 m vers l’intérieur, jusqu’à 3 virages candidats, précision annoncée ±20 m ;
// le passage au plus près n’est affiché que pour information, jamais proposé (sans virage net : aucun candidat).
// Pitfall 10 : R0 n’est PAS réglé pour coller aux marques 6 et 7 (leurs positions viennent de cette même trace) ; l’exactitude
// est mesurée par simulation. Les marques viennent d’une COPIE de MARKS (Pitfall 11).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/setup.mjs';
import { MARKS } from '../js/courses.js';
import { toXY, toLL, distXY } from '../js/geo.js';
import { fromGPX, analyzeTrack } from '../js/track.js';
import { boatSpeed } from '../js/polar.js';
import { R0, MIN_TURN_DEG, SEARCH_M, MAX_CANDS, ACCURACY_M, closestApproach, proposeMark, candidates } from '../js/markfit.js';

const copie = structuredClone(MARKS);
const lire = (tr) => analyzeTrack(tr, { windAt: () => ({ dir: 0, spd: 10 }), boatSpeed, legs: null }).P;   // même lecture que points() de js/debrief.js
const z = (h) => Date.parse(`2026-10-18T${h}Z`);
const pos = (k) => toXY(copie[k].lat, copie[k].lon);
const KN = 0.5144;

let P;
before(() => { P = lire(fromGPX(fixture('coupe-snpm-2026-10-18.gpx'), 'coupe-snpm-2026-10-18.gpx')); });

// ── trace réelle de la Coupe SNPM
test('constantes de la méthode : sommet + 14 m, virage d’au moins 25°, 3 candidats, 600 m, ±20 m', () => {
  assert.deepEqual([R0, MIN_TURN_DEG, SEARCH_M, MAX_CANDS, ACCURACY_M], [14, 25, 600, 3, 20]);
});

test('SNPM, marque 7 : un virage proposé à moins de 40 m de la position enregistrée, par le sommet, à moins de 2 min du passage de référence', () => {
  const c = candidates(P, pos(7), { t0: z('09:43:42'), t1: z('10:55:20') });
  const m = c[0];
  assert.ok(m, 'au moins un candidat');
  assert.equal(m.method, 'sommet');
  const d = distXY(m, pos(7));
  assert.ok(d < 40, `à ${d.toFixed(1)} m de la position enregistrée`);
  assert.ok(Math.abs(m.turn.t - z('10:11:51')) < 120000, `virage à ${new Date(m.turn.t).toISOString()}`);
  console.log(`# marque 7 : ${d.toFixed(1)} m (virage de ${Math.round(Math.abs(m.turn.D))}° à ${new Date(m.turn.t).toISOString().slice(11, 19)}Z, d0 ${m.d0.toFixed(1)} m, passage au plus près ${m.near.d.toFixed(1)} m)`);
});

test('SNPM, marque 6 : même exigence (passage de référence 10:55:20Z)', () => {
  const c = candidates(P, pos(6), { t0: z('10:11:51'), t1: z('11:42:56') });
  const m = c[0];
  assert.ok(m, 'au moins un candidat');
  assert.equal(m.method, 'sommet');
  const d = distXY(m, pos(6));
  assert.ok(d < 40, `à ${d.toFixed(1)} m de la position enregistrée`);
  assert.ok(Math.abs(m.turn.t - z('10:55:20')) < 120000, `virage à ${new Date(m.turn.t).toISOString()}`);
  console.log(`# marque 6 : ${d.toFixed(1)} m (virage de ${Math.round(Math.abs(m.turn.D))}° à ${new Date(m.turn.t).toISOString().slice(11, 19)}Z, d0 ${m.d0.toFixed(1)} m, passage au plus près ${m.near.d.toFixed(1)} m)`);
});

test('SNPM, marque 7 avec une position supposée décalée de 150 m (N, E, S, O) : un des candidats est à moins de 40 m de la position enregistrée', () => {
  const ref = pos(7);
  for (const [nom, dx, dy] of [['N', 0, 150], ['E', 150, 0], ['S', 0, -150], ['O', -150, 0]]) {
    const c = candidates(P, { x: ref.x + dx, y: ref.y + dy }, { t0: z('09:43:42'), t1: z('10:55:20') });
    const best = Math.min(...c.map((m) => distXY(m, ref)));
    assert.ok(best < 40, `${nom} : le meilleur candidat est à ${best.toFixed(1)} m (${c.length} candidats)`);
  }
});

test('au plus 3 candidats, triés par distance croissante à la position supposée, aucun à plus de 600 m', () => {
  for (const k of [6, 7, 5, 1]) {
    const M0 = pos(k), c = candidates(P, M0);
    assert.ok(c.length <= MAX_CANDS, `marque ${k} : ${c.length} candidats`);
    for (let i = 0; i < c.length; i++) {
      assert.ok(c[i].d0 <= SEARCH_M, `marque ${k} : d0 ${c[i].d0}`);
      assert.ok(Math.abs(c[i].d0 - distXY(c[i], M0)) < 1e-6, 'd0 = distance entre la proposition et la position supposée');
      if (i) assert.ok(c[i].d0 >= c[i - 1].d0, 'tri croissant');
    }
  }
  assert.ok(candidates(P, pos(6)).length >= 1, 'la marque 6 a au moins un candidat sur la trace entière');
});

test('chaque candidat est de méthode « sommet » et porte le passage au plus près de la position actuelle, pour information', () => {
  const M0 = pos(6), c = candidates(P, M0);
  assert.ok(c.length);
  for (const m of c) {
    assert.equal(m.method, 'sommet');
    assert.ok(Math.abs(m.turn.D) >= MIN_TURN_DEG);
    const att = closestApproach(P, M0, m.turn.t);
    assert.ok(Math.abs(m.near.d - att.d) < 1e-6, 'near.d = distance du passage au plus près de M0');
    assert.ok(m.near.d <= distXY(m, M0) + 14 + 1, 'le passage au plus près n’est pas plus loin que la proposition (à R0 près)');
  }
});

// ── trajectoires synthétiques
function ligneDroite(M0, ecart, { v = 5, duree = 300 } = {}) {
  const pts = []; const t0 = z('10:00:00');
  for (let s = 0; s <= duree; s++) {
    const ll = toLL(M0.x + ecart, M0.y - (duree / 2 - s) * v * KN);                  // cap plein nord, à `ecart` m à l’est de la bouée
    pts.push([t0 + s * 1000, ll.lat, ll.lon, null, null, 5]);
  }
  return lire({ start: t0, pts });
}

test('ligne droite passant à 30 m de la bouée : « plus-pres » (pas de virage net) et aucun candidat (D-02 amendé)', () => {
  const M0 = { x: 0, y: 0 }, L = ligneDroite(M0, 30);
  const tp = L[Math.floor(L.length / 2)].t;
  const r = proposeMark(L, M0, 't', tp);
  assert.equal(r?.method, 'plus-pres');
  assert.ok(Math.abs(r.near.d - 30) < 2, `passage à ${r?.near?.d} m`);
  assert.deepEqual(candidates(L, M0), [], 'rien à valider sans virage net');
});

// ── simulation déterministe (graine fixe)
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const rad = Math.PI / 180;

// Un arrondi : virage de 40 à 130° en 15 à 45 s à 3-6 nd ; bouée à 4-24 m à l’intérieur du sommet (décalée de σ 8 m le long de la route) ; 1 point par seconde, bruit GPS σ 4 m
function arrondi(rng, { bruit = 4 } = {}) {
  const sens = rng() < 0.5 ? 1 : -1, D = (40 + rng() * 90) * sens, T = 15 + rng() * 30, v = (3 + rng() * 3) * KN, r = 4 + rng() * 20, h1 = rng() * 360;
  const traj = []; let x = 0, y = 0;
  for (let s = -150; s <= 150; s++) {
    const f = Math.min(1, Math.max(0, (s + T / 2) / T)), h = (h1 + D * f) * rad;
    traj.push({ s, x, y }); x += v * Math.sin(h); y += v * Math.cos(h);
  }
  const apex = traj.find((p) => p.s === 0), ax = apex.x, ay = apex.y;
  const hin = (h1 + D / 2 + (sens > 0 ? 90 : -90)) * rad, hr = (h1 + D / 2) * rad, along = 8 * gauss(rng);
  const bouee = { x: r * Math.sin(hin) + along * Math.sin(hr), y: r * Math.cos(hin) + along * Math.cos(hr) };
  const t0 = z('10:00:00');
  const pts = traj.map((p) => { const ll = toLL(p.x - ax + bruit * gauss(rng), p.y - ay + bruit * gauss(rng)); return [t0 + (p.s + 150) * 1000, ll.lat, ll.lon, null, null, 5]; });
  return { P: lire({ start: t0, pts }), bouee };
}

test('simulation : 200 arrondis, bruit GPS de 4 m, position supposée fausse de 50 m : 90e centile de l’erreur du premier candidat < 25 m', () => {
  const rng = mulberry(20261019), erreurs = [];
  for (let i = 0; i < 200; i++) {
    const { P: S, bouee } = arrondi(rng);
    const th = rng() * 2 * Math.PI, M0 = { x: bouee.x + 50 * Math.sin(th), y: bouee.y + 50 * Math.cos(th) };
    const c = candidates(S, M0);
    erreurs.push(c[0] ? distXY(c[0], bouee) : Infinity);
  }
  erreurs.sort((a, b) => a - b);
  const med = erreurs[100], p90 = erreurs[180], sans = erreurs.filter((e) => !isFinite(e)).length;
  console.log(`# simulation : médiane ${med.toFixed(1)} m, p90 ${p90.toFixed(1)} m, max ${erreurs[199].toFixed(1)} m, sans candidat ${sans}/200`);
  assert.ok(p90 < 25, `p90 ${p90.toFixed(1)} m`);
  assert.ok(sans <= 4, `${sans} arrondis sans candidat`);
});
