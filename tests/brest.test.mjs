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

// ───────── Zones interdites (07-06, D-10, D-14c) : étude § 2.3, IC GPEN 2026 annexe 5
import { pointInPolygon } from '../js/geo.js';
import { route } from '../js/router.js';
import { zonesXY } from '../js/venues.js';

const dmn = (d, m) => d + m / 60;
// Bouées de l’Île Longue relevées dans OpenStreetMap (étude § 2.3)
const BOUEES_IL = { 0: [17.870, 31.430], 1: [18.027, 31.283], 2: [18.263, 31.083], '2 bis': [18.417, 30.949], 3: [18.575, 30.815], '3 bis': [18.665, 30.742],
  4: [18.822, 30.601], 5: [18.834, 30.234], 6: [18.852, 29.848], '6 bis': [18.779, 29.651], 7: [18.549, 29.503], D: [18.685, 29.451] };
const CARD_PAV = { lat: dmn(48, 17.754), lon: -dmn(4, 24.883) }, POINTE_PAV = { lat: 48.2944, lon: -4.4185 };
const zone = (nom) => BREST.FORBIDDEN_ZONES.find((z) => z.name === nom);
const segCroise = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const distSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const bord = (poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
// Chemin (suite de points) : aucun point dans une zone ; le routage ne contrôle que les bouts et le milieu de chaque pas, un pas peut donc
// rogner un coin de zone : on mesure de combien il y entre (points tous les 5 m), et on rend la plus grande profondeur (m)
function horsZones(path, polys, quoi) {
  for (const p of path) for (const poly of polys) assert.ok(!pointInPolygon(p, poly), `${quoi} : point du chemin dans une zone interdite`);
  let prof = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
    for (let k = 1; k < n; k++) {
      const q = { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n };
      for (const poly of polys) if (pointInPolygon(q, poly)) prof = Math.max(prof, Math.min(...bord(poly).map(([u, v]) => distSeg(q, u, v))));
    }
  }
  return prof;
}
let F270 = null;
const champ270 = async () => { if (!F270) { F270 = new WindField(await terrain(), BREST.wind); F270.compute({ points: [{ x: 0, y: 0, dir: 270, spd: 12, gust: 15.6 }] }, { localEffects: 1 }); } return F270; };

test('zones interdites de Brest : Île Longue et Pen ar Vir, « à compléter sur carte marine », polygones fermés et simples dans l’emprise', () => {
  assert.deepEqual(BREST.FORBIDDEN_ZONES.map((z) => z.name), ['Île Longue', 'Passage de Pen ar Vir']);
  for (const z of BREST.FORBIDDEN_ZONES) {
    assert.equal(z.note, 'à compléter sur carte marine', z.name);
    assert.ok(z.desc && z.desc.includes('IC GPEN'), `${z.name} : source citée`);
    assert.ok(z.pts.length >= 4, `${z.name} : au moins 4 sommets`);
    for (const p of z.pts) assert.ok(p.lat > BREST.bounds.south && p.lat < BREST.bounds.north && p.lon > BREST.bounds.west && p.lon < BREST.bounds.east, `${z.name} : sommet hors emprise`);
    const poly = z.pts.map((p) => xy(p.lat, p.lon)), n = poly.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;                                       // arêtes voisines par la fermeture
      assert.ok(!segCroise(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n]), `${z.name} : arêtes ${i} et ${j} se coupent`);
    }
  }
  assert.match(zone('Île Longue').desc, /marques 0 à 10/);
});

test('Île Longue : les bouées 0 à 7 et « D » sont dans la zone, à 40 m au moins du bord (tracé large de 50 m)', () => {
  const poly = zone('Île Longue').pts.map((p) => xy(p.lat, p.lon));
  for (const [n, [la, lo]] of Object.entries(BOUEES_IL)) {
    const b = xy(dmn(48, la), -dmn(4, lo));
    assert.ok(pointInPolygon(b, poly), `bouée ${n} dans la zone`);
    const m = Math.min(...bord(poly).map(([a, c]) => distSeg(b, a, c)));
    assert.ok(m >= 40, `bouée ${n} à ${m.toFixed(0)} m du bord`);
  }
});

test('Pen ar Vir : le couloir couvre l’axe cardinale → pointe et touche la terre au bout de la pointe', { skip: sansPack }, async () => {
  const t = await terrain();
  const poly = zone('Passage de Pen ar Vir').pts.map((p) => xy(p.lat, p.lon));
  const c = xy(CARD_PAV.lat, CARD_PAV.lon), p = xy(POINTE_PAV.lat, POINTE_PAV.lon);
  for (let k = 0; k <= 20; k++) assert.ok(pointInPolygon({ x: c.x + (p.x - c.x) * k / 20, y: c.y + (p.y - c.y) * k / 20 }, poly), `axe à ${k * 5} %`);
  let terre = 0;                                                    // cellules de terre dans le couloir, à moins de 100 m de la pointe
  for (let dx = -100; dx <= 100; dx += 10) for (let dy = -100; dy <= 100; dy += 10) {
    const q = { x: p.x + dx, y: p.y + dy };
    if (Math.hypot(dx, dy) <= 100 && pointInPolygon(q, poly) && t.isLand(q.x, q.y)) terre++;
  }
  assert.ok(terre >= 5, `le couloir chevauche la terre de la pointe (${terre} points)`);
});

test('routage à Brest (270°/12 nd) : du nord de l’Île Longue à l’est, la route contourne la zone', { skip: sansPack }, async () => {
  const t = await terrain(), F = await champ270(), polys = zonesXY(BREST.FORBIDDEN_ZONES, xy);
  const r = route(xy(48.3200, -4.5100), xy(48.3050, -4.4800), F, { terrain: t, forbidden: polys, perf: 1 });
  assert.ok(r && r.path.length > 2, 'route trouvée');
  const prof = horsZones(r.path, polys, 'Île Longue');
  assert.ok(prof < 25, `un pas rogne la zone de ${prof.toFixed(0)} m : les bouées (à 50 m du bord) restent hors de la route`);
  // contrôle négatif : sans la zone, la route directe passe par la zone balisée
  const libre = route(xy(48.3200, -4.5100), xy(48.3050, -4.4800), F, { terrain: t, forbidden: [], perf: 1 });
  assert.ok(libre.path.some((q) => pointInPolygon(q, polys[0])), 'sans zone, la route entre dans la zone balisée');
});

test('routage à Brest : la route ne passe jamais entre la cardinale Pen ar Vir et la pointe', { skip: sansPack }, async () => {
  const t = await terrain(), F = await champ270(), polys = zonesXY(BREST.FORBIDDEN_ZONES, xy);
  const c = xy(CARD_PAV.lat, CARD_PAV.lon), p = xy(POINTE_PAV.lat, POINTE_PAV.lon);
  // de part et d’autre du couloir (étude), puis au ras de la pointe, d’ouest en est et d’est en ouest
  for (const [a, b] of [[[48.2930, -4.4300], [48.2990, -4.4050]], [[48.2935, -4.4230], [48.2948, -4.4110]], [[48.2948, -4.4110], [48.2935, -4.4230]]]) {
    const r = route(xy(...a), xy(...b), F, { terrain: t, forbidden: polys, perf: 1 });
    assert.ok(r, `route ${a} → ${b}`);
    const prof = horsZones(r.path, polys, `${a} → ${b}`);
    assert.ok(prof < 25, `${a} → ${b} : un pas rogne une zone de ${prof.toFixed(0)} m`);
    for (let i = 1; i < r.path.length; i++) assert.ok(!segCroise(r.path[i - 1], r.path[i], c, p), `${a} → ${b} : passage entre la cardinale et la pointe`);
  }
  // contrôle négatif : sans les zones, la route au ras de la pointe (vent arrière) passe entre la cardinale et la pointe
  const libre = route(xy(48.2935, -4.4230), xy(48.2948, -4.4110), F, { terrain: t, forbidden: [], perf: 1 });
  assert.ok(libre.path.some((q, i) => i && segCroise(libre.path[i - 1], q, c, p)), 'sans zone, la route passe entre la cardinale et la pointe');
});
