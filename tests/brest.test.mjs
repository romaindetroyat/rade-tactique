// Pack physique de la rade de Brest (07-03, D-03, D-14) : relief, couverture et côte construits par tools/build_terrain.py,
// lus par Terrain.load('data/brest.') après setVenue('brest'). Ce fichier tourne dans son propre processus (node --test) :
// l’origine de projection y est celle de Brest du début à la fin.
// Points de contrôle : étude du plan d’eau (07-RESEARCH-PLAN-EAU.md § 1.3, § 6.4) et IC du GPEN 2026 (centre de la zone A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers/setup.mjs';
import { setVenue } from '../js/lieu.js';
import { Terrain, toXY } from '../js/geo.js';
import { BREST } from '../js/venue-brest.js';
import { WindField } from '../js/wind.js';

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

// Dimensions d’un JPEG (premier marqueur SOF) et d’un PNG (bloc IHDR), lues dans l’en-tête
function tailleJpeg(b) {
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
const taillePng = (b) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

test('fond de carte et masque de l’eau : 4096 px de large, hauteur tirée de l’emprise, même taille', { skip: sansPack }, () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'data/brest.meta.json'), 'utf8'));
  const kx = Math.cos(((m.south + m.north) / 2) * Math.PI / 180) * 111320;
  const h = Math.round(4096 * (m.north - m.south) * 110574 / ((m.east - m.west) * kx));
  assert.equal(h, 2920);
  assert.deepEqual(m.basemap, { width: 4096, height: h });
  const jpg = readFileSync(join(ROOT, 'data/brest.basemap.jpg'));
  assert.deepEqual([jpg[0], jpg[1]], [0xff, 0xd8], 'JPEG');
  assert.deepEqual(tailleJpeg(jpg), { width: 4096, height: h });
  const png = readFileSync(join(ROOT, 'data/brest.seamask.png'));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.deepEqual(taillePng(png), { width: 4096, height: h });
});

const SNAP = join(ROOT, 'data/brest.wx-snapshot.json');
test('instantané météo de Brest : modèles, grille de 20 points de la zone A, aucune donnée marine', { skip: existsSync(SNAP) ? false : 'data/brest.wx-snapshot.json absent (Open-Meteo injoignable) : l’app reçoit null' }, () => {
  const s = JSON.parse(readFileSync(SNAP, 'utf8'));
  assert.equal(s.snapshot, true);
  assert.ok(s.multi?.hourly?.time?.length > 0, 'prévisions multi-modèles');
  assert.ok(Array.isArray(s.grid) && s.grid.length === 20, 'grille de 20 points');
  assert.equal(s.marine, null);
});

// D-14 : le champ de vent de Brest (maille BREST.wind.cell) coûte au plus 1,7 fois celui de Toulon (maille 150 m, data/).
// Mesure : construction puis deux directions (270°, 150°) ; Toulon dans un sous-processus (son origine de projection) ;
// passes alternées, meilleur temps de chaque côté (le reste de la suite tourne en parallèle).
test('coût du champ de vent de Brest : au plus 1,7 fois celui de Toulon', { skip: sansPack }, async () => {
  const t = await terrain();
  const mesure = () => { const t0 = performance.now(); const f = new WindField(t, BREST.wind); f.kit(270); f.kit(150); return [performance.now() - t0, f.nx * f.ny]; };
  const url = (f) => pathToFileURL(join(ROOT, f)).href;
  const toulon = () => JSON.parse(execFileSync(process.execPath, ['--import', url('tests/helpers/setup.mjs'), '--input-type=module', '-e', `
    const { Terrain } = await import(${JSON.stringify(url('js/geo.js'))});
    const { WindField } = await import(${JSON.stringify(url('js/wind.js'))});
    const t = await new Terrain().load('data/');
    const t0 = performance.now(); const f = new WindField(t); f.kit(270); f.kit(150);
    console.log(JSON.stringify([performance.now() - t0, f.nx * f.ny]));`], { cwd: ROOT, encoding: 'utf8' }));
  let tb = Infinity, tt = Infinity, nb = 0, nt = 0;
  for (let k = 0; k < 3; k++) {
    const [a, n1] = toulon(); tt = Math.min(tt, a); nt = n1;
    const [b, n2] = mesure(); tb = Math.min(tb, b); nb = n2;
  }
  assert.equal(nt, 21679, 'Toulon : 163 × 133 cellules (v42)');
  assert.ok(nb / nt <= 1.7, `cellules : ${nb} contre ${nt}`);
  assert.ok(tb / tt <= 1.7, `Brest ${tb.toFixed(0)} ms, Toulon ${tt.toFixed(0)} ms, rapport ${(tb / tt).toFixed(2)}`);
});
