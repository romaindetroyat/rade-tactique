// Pauses d’une trace (ARCH-04) : coupures de la trace SNPM, trous courts, distance et durée actives, index de dessin sans pont, GPX aller-retour.
// Les chiffres de la trace SNPM sont RECALCULÉS ICI par une somme orthodromique des paires de points, écrite dans ce test et indépendante de
// js/geo.js ; ils ne sont jamais recopiés d’une recherche. Aucune valeur de tests/reference/ n’est lue ni modifiée (D-12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/setup.mjs';
import { fromGPX, toGPX, analyzeTrack } from '../js/track.js';
import { boatSpeed } from '../js/polar.js';
import { distXY } from '../js/geo.js';
import * as SEG from '../js/segments.js';                 // lu par espace de noms : un module incomplet échoue sur « is not a function », pas au chargement
const { PAUSE_GAP_S, SEG_GAP_S, segmentBreaks } = SEG;

const texte = fixture('coupe-snpm-2026-10-18.gpx');
const snpm = fromGPX(texte, 'coupe-snpm-2026-10-18.gpx');
const NQ = 1852;

// Grande distance sur la sphère (rayon moyen 6 371 008,8 m) entre deux points [t, lat, lon]
const R = 6371008.8, rad = Math.PI / 180;
const orthodromie = (a, b) => {
  const dl = (b[1] - a[1]) * rad, dn = (b[2] - a[2]) * rad;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
// Somme des paires ; `coupures` = indices des points qui commencent un segment (la paire qui les franchit est ignorée)
function mesure(pts, coupures = []) {
  const cut = new Set(coupures);
  let dist = 0, dur = 0;
  for (let i = 1; i < pts.length; i++) {
    if (cut.has(i)) continue;
    dist += orthodromie(pts[i - 1], pts[i]); dur += (pts[i][0] - pts[i - 1][0]) / 1000;
  }
  return { nq: dist / NQ, h: dur / 3600 };
}
// Trace synthétique : trous donnés en secondes entre points successifs (le premier point est à t0)
const trace = (gaps, t0 = Date.parse('2026-10-18T09:00:00Z')) => { let t = t0; return [[t, 43.07, 5.93, null, null, 5], ...gaps.map((g, i) => { t += g * 1000; return [t, 43.07 + 0.0001 * (i + 1), 5.93, null, null, 5]; })]; };
const air = { windAt: () => ({ dir: 315, spd: 12 }), boatSpeed, legs: null };

test('constantes : un trou de plus de 120 s coupe toujours, un nouveau <trkseg> coupe au-delà de 5 s', () => {
  assert.equal(PAUSE_GAP_S, 120);
  assert.equal(SEG_GAP_S, 5);
});

test('coupures de la trace SNPM : un seul <trkseg> de reprise, au point 293 ; la règle du trou seule donne la même coupure', () => {
  const doc = new DOMParser().parseFromString(texte, 'application/xml');
  const starts = SEG.segStartsFromDoc(doc);
  assert.equal(starts.length, 2, 'deux <trkseg> : le quai puis la course');
  assert.equal(starts[1], Date.parse('2026-10-18T08:40:43.000Z'));
  assert.deepEqual(SEG.breaksFromInstants(snpm.pts, starts), [293]);
  assert.deepEqual(segmentBreaks(snpm.pts), [293], 'sans <trkseg> : le trou de 8 828 s suffit');
  assert.deepEqual(snpm.brk, [293], 'fromGPX pose tr.brk');
  assert.deepEqual(SEG.breaksOf(snpm), [293]);
  assert.deepEqual(SEG.breaksOf({ pts: snpm.pts }), [293], 'une trace déjà enregistrée, sans brk, est coupée par la règle du trou');
});

test('trous synthétiques : 40 s en course ne coupe pas ; nouveau segment après 3 s ne coupe pas, après 40 s oui ; 3 min sans <trkseg> coupe', () => {
  const enCourse = trace([5, 5, 40, 5, 5]);
  assert.deepEqual(segmentBreaks(enCourse), [], 'un trou de 40 s en course reste relié');
  assert.deepEqual(segmentBreaks(enCourse, [3]), [3], 'mais un nouveau <trkseg> à cet endroit le coupe (40 s > 5 s)');
  const court = trace([5, 5, 3, 5, 5]);
  assert.deepEqual(segmentBreaks(court, [3]), [], 'nouveau <trkseg> après 3 s : pas de coupure');
  assert.deepEqual(segmentBreaks(trace([5, 5, 180, 5]), []), [3], 'trou de 3 min sans <trkseg> : coupure');
  assert.deepEqual(segmentBreaks(trace([5, 120, 5])), [], 'exactement 120 s ne coupe pas (« plus de 2 min »)');
  assert.deepEqual(segmentBreaks(trace([5, 121, 5])), [2]);
  assert.deepEqual(segmentBreaks(trace([5, 5]), [0, 99, -1]), [], 'indices hors trace ignorés');
});

test('chiffres SNPM recalculés par le test : tous les points 16,38 Nq en 6,00 h ; segments actifs seulement 15,25 Nq en 3,55 h', () => {
  const tous = mesure(snpm.pts), actifs = mesure(snpm.pts, [293]);
  assert.ok(Math.abs(tous.nq - 16.38) <= 0.05, `tous points : ${tous.nq.toFixed(3)} Nq`);
  assert.ok(Math.abs(tous.h - 6.0) <= 0.02, `6,00 h : ${tous.h.toFixed(3)}`);
  assert.equal(tous.h, (snpm.pts.at(-1)[0] - snpm.pts[0][0]) / 3600e3, 'durée de tous les points = dernier instant − premier');
  assert.ok(Math.abs(actifs.nq - 15.25) <= 0.05, `actifs : ${actifs.nq.toFixed(3)} Nq`);
  assert.ok(Math.abs(actifs.h - 3.55) <= 0.02, `3,55 h : ${actifs.h.toFixed(3)}`);
  assert.ok(tous.nq - actifs.nq > 1, 'la paire qui franchit la pause pesait plus d’un mille');
});

test('analyzeTrack sur la trace SNPM : distance, durée et vitesse moyenne actives ; P[293] marque la coupure ; trace sans brk identique', () => {
  const res = analyzeTrack(snpm, air), actifs = mesure(snpm.pts, [293]), tous = mesure(snpm.pts);
  assert.ok(Math.abs(res.dist / NQ - actifs.nq) <= 0.05, `distance active ${(res.dist / NQ).toFixed(3)} Nq pour ${actifs.nq.toFixed(3)} calculés par le test`);
  assert.ok(Math.abs(res.dur / 3600 - actifs.h) <= 0.02, `durée active ${(res.dur / 3600).toFixed(3)} h pour ${actifs.h.toFixed(3)}`);
  assert.ok(Math.abs(res.vmean - actifs.nq / actifs.h) <= 0.05, `vitesse moyenne ${res.vmean.toFixed(3)} nd`);
  assert.ok(Math.abs(res.vmean - 4.3) <= 0.1, 'environ 4,3 nd actifs, au lieu de 2,7 nd sur tous les points');
  // distance d’avant : somme du même calcul sur toutes les paires (sans coupure)
  const avant = res.P.reduce((s, p, i) => (i ? s + distXY(res.P[i - 1], p) : 0), 0);
  assert.ok(Math.abs(avant / NQ - tous.nq) <= 0.05, `somme sur toutes les paires ${(avant / NQ).toFixed(3)} Nq`);
  assert.ok(avant > res.dist + 1000, 'la distance active est plus courte que l’ancienne somme');
  assert.equal(res.P[293].brk, true);
  assert.equal(res.P.filter((p) => p.brk).length, 1);
  const sans = analyzeTrack({ ...snpm, brk: undefined }, air);
  assert.equal(sans.dist, res.dist); assert.equal(sans.dur, res.dur); assert.equal(sans.vmean, res.vmean);
});

test('activeStats : somme par segment, aucune paire à travers une coupure', () => {
  const P = [{ t: 0, x: 0, y: 0 }, { t: 10000, x: 30, y: 40 }, { t: 5000000, x: 9000, y: 9000, brk: true }, { t: 5020000, x: 9030, y: 9040 }];
  const r = SEG.activeStats(P, distXY);
  assert.equal(r.dist, 100, '50 m + 50 m, la paire (1, 2) n’est pas comptée');
  assert.equal(r.dur, 30, '10 s + 20 s');
  assert.deepEqual(SEG.activeStats([{ t: 0, x: 0, y: 0 }], distXY), { dist: 0, dur: 0 });
});

test('la trace est coupée aussi à l’analyse quand le tracé s’interrompt en pleine course (trou de 3 min), pas pour un trou de 30 s', () => {
  const pts = [[0, 43.07, 5.93], [5000, 43.0701, 5.93], [10000, 43.0702, 5.93], [190000, 43.08, 5.95], [195000, 43.0801, 5.95], [200000, 43.0802, 5.95]].map((p) => [p[0] + 1.7e12, p[1], p[2], null, null, 5]);
  const res = analyzeTrack({ id: 'x', name: 'x', start: pts[0][0], pts }, air);
  assert.deepEqual(res.P.map((p) => !!p.brk), [false, false, false, true, false, false]);
  assert.ok(res.dist < 60, 'le saut d’environ 2 km n’est pas compté');
  assert.equal(res.dur, 20, '10 s + 10 s d’enregistrement actif');
  const ok = analyzeTrack({ id: 'y', name: 'y', start: pts[0][0], pts: pts.map((p, i) => (i > 2 ? [p[0] - 150000, ...p.slice(1)] : p)) }, air);
  assert.ok(!ok.P.some((p) => p.brk), 'trou de 30 s : une seule ligne');
});

test('index de dessin : paires (i, i + 1) sauf celle qui franchit une coupure', () => {
  assert.deepEqual(SEG.lineIndex(5, []), [0, 1, 1, 2, 2, 3, 3, 4]);
  assert.deepEqual(SEG.lineIndex(5, [2]), [0, 1, 2, 3, 3, 4]);
  assert.deepEqual(SEG.lineIndex(5, [1, 3]), [1, 2, 3, 4]);
  assert.deepEqual(SEG.lineIndex(1, []), []);
  assert.deepEqual(SEG.lineIndex(0, []), []);
  const idx = SEG.lineIndex(snpm.pts.length, [293]);
  assert.equal(idx.length, 2 * (snpm.pts.length - 2), 'toutes les paires sauf une');
  for (let k = 0; k < idx.length; k += 2) assert.ok(!(idx[k] === 292 && idx[k + 1] === 293), 'aucun pont entre le quai et la course');
});

test('GPX aller-retour : un <trkseg> par segment ; relue, la trace redonne les mêmes coupures', () => {
  const gpx = toGPX(snpm);
  assert.equal((gpx.match(/<trkseg>/g) || []).length, 2);
  const retour = fromGPX(gpx, 'retour.gpx');
  assert.deepEqual(retour.brk, [293]);
  assert.equal(retour.pts.length, snpm.pts.length);
  // une trace sans coupure : un seul <trkseg>, comme avant
  assert.equal((toGPX({ ...snpm, brk: [], pts: snpm.pts.slice(0, 200), name: 'court' }).match(/<trkseg>/g) || []).length, 1);
});

test('dessin 3D et analyse câblés sur les coupures (js/scene3d.js, js/track.js, js/debrief.js)', async () => {
  const { readFileSync } = await import('node:fs');
  const { ROOT } = await import('./helpers/setup.mjs');
  assert.match(readFileSync(ROOT + 'js/scene3d.js', 'utf8'), /LineSegments/, 'setTrace dessine des segments indexés');
  assert.match(readFileSync(ROOT + 'js/scene3d.js', 'utf8'), /lineIndex\(/);
  assert.match(readFileSync(ROOT + 'js/track.js', 'utf8'), /breaksOf\(/);
  assert.match(readFileSync(ROOT + 'js/debrief.js', 'utf8'), /\.brk/, 'legStats ignore les ponts');
});
