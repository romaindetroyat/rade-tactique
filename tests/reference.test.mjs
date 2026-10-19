// Cas de référence de bout en bout : trace GPX réelle de la Coupe SNPM du 18/10/2026 → fromGPX → detect → analyze.
// Règle D-12 : les valeurs de tests/reference/*.json ne sont JAMAIS réécrites par un test ni par un script automatique.
// Si ce test échoue après une amélioration voulue du modèle, présenter l’avant/après à Romain ; le fichier de référence
// ne change qu’après son accord. Aucune tolérance élargie : les valeurs sont arrondies à la précision d’affichage.
// D-11 : la bascule à gauche du vent entre le bord 1 et le bord 2 est la cohérence de vent attendue au départ.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { mesurer } from './helpers/reference.mjs';
import { norm180 } from '../js/geo.js';

const cas = JSON.parse(readFileSync(ROOT + 'tests/reference/coupe-snpm-2026-10-18.json', 'utf8'));
let obtenu;
before(async () => { obtenu = await mesurer(cas); });

test('lecture GPX de la Coupe SNPM : nombre de points et heure du premier point', () => {
  assert.deepEqual(obtenu.trace, cas.trace);
});

test('parcours reconnu et trois premiers passages aux bouées', () => {
  assert.deepEqual(obtenu.parcours, cas.parcours);
  assert.deepEqual(obtenu.passages, cas.passages);
});

test('faux départs et départ détecté', () => {
  assert.deepEqual(obtenu.fauxDeparts, cas.fauxDeparts);
  assert.equal(obtenu.depart, cas.depart);
});

test('vent, pourcentage de polaire et statistiques de chaque bord', () => {
  assert.deepEqual(obtenu.bords, cas.bords);
});

test('ancres D-11 / D-14 écrites dans le test : une référence réenregistrée ne peut pas les perdre en silence', () => {
  assert.equal(obtenu.parcours.id, 4, 'parcours 4');
  assert.equal(obtenu.parcours.reduit, true, 'arrivée réduite');
  assert.deepEqual(obtenu.passages.slice(0, 2).map((p) => p[0]), ['7', '6'], 'bouées 7 puis 6 (Houlographe)');
  assert.equal(obtenu.fauxDeparts.length, 2, 'deux faux départs');
  assert.equal(obtenu.depart, '09:43:42Z', 'départ détecté 11:43:42 à Paris');
  const [b1, b2] = obtenu.bords;
  assert.ok(norm180(b2.vent[1] - b1.vent[1]) < 0, 'bascule à gauche du vent entre le bord 1 et le bord 2');
});
