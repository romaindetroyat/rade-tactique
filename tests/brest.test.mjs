// Pack physique de la rade de Brest (07-03, D-03, D-14) : relief, couverture et côte construits par tools/build_terrain.py,
// lus par Terrain.load('data/brest.') après setVenue('brest'). Ce fichier tourne dans son propre processus (node --test) :
// l’origine de projection y est celle de Brest du début à la fin.
// Points de contrôle : étude du plan d’eau (07-RESEARCH-PLAN-EAU.md § 1.3, § 6.4) et IC du GPEN 2026 (centre de la zone A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers/setup.mjs';
import { setVenue } from '../js/lieu.js';
import { Terrain, toXY } from '../js/geo.js';
import { BREST } from '../js/venue-brest.js';

setVenue('brest');
const PACK = existsSync(join(ROOT, 'data/brest.meta.json'));
const sansPack = PACK ? false : 'data/brest.meta.json absent : pack de Brest non construit';
let T = null;
const terrain = async () => (T ??= await new Terrain().load(BREST.files.base));
const xy = (lat, lon) => toXY(lat, lon);

test('meta de Brest : emprise du plan d’eau, maille 30 m, sources citées', { skip: sansPack }, () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'data/brest.meta.json'), 'utf8'));
  assert.deepEqual([m.west, m.east, m.south, m.north], [BREST.bounds.west, BREST.bounds.east, BREST.bounds.south, BREST.bounds.north]);
  assert.deepEqual([m.nx, m.ny], [1086, 774]);
  assert.equal(m.units, 'dm');
  for (const s of ['OpenStreetMap (ODbL)', 'EMODnet Bathymetry', 'Terrarium']) assert.ok(m.sources.some((x) => x.includes(s)), s);
  assert.equal(readFileSync(join(ROOT, 'data/brest.terrain.bin')).length, m.nx * m.ny * 2);
  assert.equal(readFileSync(join(ROOT, 'data/brest.cover.bin')).length, m.nx * m.ny);
  const coast = JSON.parse(readFileSync(join(ROOT, 'data/brest.coast.json'), 'utf8'));
  assert.ok(Array.isArray(coast) && coast.length > 20, 'traits de côte');
});

test('terre et mer aux points connus : zones A et B, goulet en mer ; Île Longue en terre', { skip: sansPack }, async () => {
  const t = await terrain();
  const mer = { 'centre de la zone A': [48.29817, -4.3605], 'zone B (Poulmic)': [48.2840, -4.4108], 'milieu du goulet': [48.3500, -4.5330] };
  for (const [nom, [lat, lon]] of Object.entries(mer)) {
    const p = xy(lat, lon);
    assert.ok(!t.isLand(p.x, p.y), nom + ' doit être en mer');
    assert.ok(t.height(p.x, p.y) < 0, nom + ' : fond sous le zéro');
  }
  // point intérieur du polygone de l’Île Longue (côte OSM), relevé sur l’extrait
  const il = xy(48.3060, -4.5070);
  assert.ok(t.isLand(il.x, il.y), 'Île Longue en terre');
  assert.ok(t.height(il.x, il.y) > 0, 'Île Longue au-dessus de l’eau');
});

test('part de terre de la couverture entre 60 et 80 %', { skip: sansPack }, async () => {
  const t = await terrain();
  let land = 0;
  for (const c of t.cover) if (c === 1 || c === 2) land++;
  const part = land / t.cover.length;
  assert.ok(part > 0.6 && part < 0.8, `part de terre ${part.toFixed(3)}`);
});

test('relief : Pointe des Espagnols à 60 m au moins dans un rayon de 600 m', { skip: sansPack }, async () => {
  const t = await terrain();
  const c = xy(48.3418, -4.5319);
  let max = -Infinity;
  for (let dy = -600; dy <= 600; dy += 30) for (let dx = -600; dx <= 600; dx += 30) {
    if (Math.hypot(dx, dy) <= 600) max = Math.max(max, t.height(c.x + dx, c.y + dy));
  }
  assert.ok(max >= 60, `altitude maximale ${max.toFixed(1)} m`);
});
