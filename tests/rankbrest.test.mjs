// « Parcours probables » à Brest : un parcours lu dans les IC sans ligne propre part de la première ligne du plan d’eau (zone A du GPEN),
// au lieu de planter faute de préréglage « vignettes » (défaut présent depuis la v43). Processus propre : setVenue('brest').
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/setup.mjs';
import { setVenue, MARKS } from '../js/lieu.js';

setVenue('brest');
const { rankCourses } = await import('../js/tactics.js');

test('rankCourses à Brest : parcours d’IC sans ligne classé depuis la zone A, sans erreur', () => {
  const k = Object.keys(MARKS)[0];
  const ic = { id: 101, name: 'Parcours IC', seq: { G: [[k, 'P']], P: [[k, 'P']] } };
  const r = rankCourses('G', 270, 10, [ic]);
  assert.equal(r.length, 1);
  assert.ok(Number.isFinite(r[0].brg) && Number.isFinite(r[0].twa));
});
