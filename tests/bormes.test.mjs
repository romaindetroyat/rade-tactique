// Pack physique de la rade de Bormes – Le Lavandou (08-03, D-10) : relief, fonds, couverture et côte construits par les outils du dépôt
// avec tools/venues/bormes.json, lus par Terrain.load('data/bormes.'). Le plan d’eau n’est pas encore au registre (08-04) : l’origine de
// projection de Bormes est posée ici à la main, puis celle de Toulon est rétablie. Ce fichier tourne dans son propre processus (node --test).
// Valeurs de contrôle : étude du plan d’eau (08-RESEARCH-PLAN-EAU.md § 1.3, § 1.4, § 3.4, § 3.5, § 6.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './helpers/setup.mjs';
import { ORIGIN, Terrain, toXY } from '../js/geo.js';
import { setVenue } from '../js/lieu.js';
import { BORMES } from '../js/venue-bormes.js';
import { WindField } from '../js/wind.js';
import { listShell } from '../tools/stamp.mjs';

// Plan d’eau de Bormes au registre (08-04) : origine posée par setVenue, comme tests/brest.test.mjs (ce fichier tourne dans son propre processus)
setVenue('bormes');

const EMPRISE = { west: 6.22, east: 6.60, south: 42.96, north: 43.20 };
const FICHIERS = ['basemap.jpg', 'coast.json', 'cover.bin', 'meta.json', 'seamask.png', 'terrain.bin'].map((f) => 'data/bormes.' + f);
const PACK = existsSync(join(ROOT, 'data/bormes.meta.json'));
const sansPack = PACK ? false : 'data/bormes.meta.json absent : pack de Bormes non construit';
let T = null;
const terrain = async () => (T ??= await new Terrain().load('data/bormes.'));
const xy = (lat, lon) => toXY(lat, lon);
const meta = () => JSON.parse(readFileSync(join(ROOT, 'data/bormes.meta.json'), 'utf8'));

test('meta de Bormes : emprise 6,22–6,60° E × 42,96–43,20° N, 1030 × 885 cellules de 30 m, sources citées', { skip: sansPack }, () => {
  const m = meta();
  assert.deepEqual([m.west, m.east, m.south, m.north], [EMPRISE.west, EMPRISE.east, EMPRISE.south, EMPRISE.north]);
  assert.deepEqual([m.nx, m.ny], [1030, 885]);
  assert.equal(m.units, 'dm');
  for (const s of ['OpenStreetMap (ODbL)', 'EMODnet Bathymetry', 'Terrarium']) assert.ok(m.sources.some((x) => x.includes(s)), s);
  assert.equal(readFileSync(join(ROOT, 'data/bormes.terrain.bin')).length, m.nx * m.ny * 2);
  assert.equal(readFileSync(join(ROOT, 'data/bormes.cover.bin')).length, m.nx * m.ny);
  const coast = JSON.parse(readFileSync(join(ROOT, 'data/bormes.coast.json'), 'utf8'));
  assert.ok(Array.isArray(coast) && coast.length > 20, 'traits de côte');
});

test('pack de Bormes : six fichiers, 3,3 à 4,0 Mo en tout', { skip: sansPack }, () => {
  for (const f of FICHIERS) assert.ok(existsSync(join(ROOT, f)), `${f} absent`);
  const total = FICHIERS.reduce((n, f) => n + statSync(join(ROOT, f)).size, 0);
  assert.ok(total >= 3.3e6 && total <= 4.0e6, `${total} octets`);
});

test('terre et mer : baie, coffre 1, passe Bénat – Bagaud, passe des Grottes en mer ; La Fourmigue, Gabinière, îlot du Cristau en terre', { skip: sansPack }, async () => {
  const t = await terrain();
  const mer = { 'milieu de la baie de Bormes': [43.122, 6.386], 'coffre 1': [43.08522, 6.27945], 'passe Bénat – Bagaud': [43.042, 6.375], 'passe des Grottes': [43.0091, 6.4250] };
  for (const [nom, [lat, lon]] of Object.entries(mer)) {
    const p = xy(lat, lon);
    assert.ok(!t.isLand(p.x, p.y), nom + ' doit être en mer');
    assert.ok(t.height(p.x, p.y) < -5, `${nom} : fond ${t.height(p.x, p.y).toFixed(1)} m`);
  }
  const terre = { 'La Fourmigue': [43.10603, 6.40420], 'îlot de la Gabinière': [42.9882, 6.3952], 'îlot du Cristau': [43.0911, 6.3721] };
  for (const [nom, [lat, lon]] of Object.entries(terre)) { const p = xy(lat, lon); assert.ok(t.isLand(p.x, p.y), nom + ' doit être en terre'); }
});

test('fonds à 2 m près : baie −25,6 m, devant Le Lavandou −19,8 m, coffre 1 −32,0 m', { skip: sansPack }, async () => {
  const t = await terrain();
  for (const [nom, [lat, lon], ref] of [['baie', [43.122, 6.386], -25.6], ['devant Le Lavandou', [43.132, 6.380], -19.8], ['coffre 1', [43.08522, 6.27945], -32.0]]) {
    const p = xy(lat, lon), h = t.height(p.x, p.y);
    assert.ok(Math.abs(h - ref) <= 2, `${nom} : ${h.toFixed(1)} m (étude ${ref} m)`);
  }
});

const maxDans = (t, lat, lon, r) => {
  const c = xy(lat, lon); let max = -Infinity;
  for (let dy = -r; dy <= r; dy += 30) for (let dx = -r; dx <= r; dx += 30) if (Math.hypot(dx, dy) <= r) max = Math.max(max, t.height(c.x + dx, c.y + dy));
  return max;
};

test('reliefs : massif du cap Bénat ≥ 170 m dans 2,5 km du phare, Port-Cros ≥ 180 m, point culminant de l’emprise ≥ 590 m', { skip: sansPack }, async () => {
  const t = await terrain();
  const benat = maxDans(t, 43.08853, 6.36286, 2500), portCros = maxDans(t, 43.005, 6.39, 3000);
  assert.ok(benat >= 170, `Bénat : ${benat.toFixed(1)} m`);
  assert.ok(portCros >= 180, `Port-Cros : ${portCros.toFixed(1)} m`);
  let max = -Infinity;
  for (const v of t.h) max = Math.max(max, v);
  assert.ok(max >= 590, `point culminant de l’emprise : ${max.toFixed(1)} m (étude 597,6 m)`);
});

test('part de terre de la couverture : 27 % ± 2', { skip: sansPack }, async () => {
  const t = await terrain();
  let land = 0;
  for (const c of t.cover) if (c === 1 || c === 2) land++;
  const part = land / t.cover.length;
  assert.ok(Math.abs(part - 0.27) <= 0.02, `part de terre ${part.toFixed(3)}`);
});

// Le Levant est en landuse=military dans OpenStreetMap : avec la liste par défaut toute l’île était « urbain » (pack d’essai de l’étude).
// Restent urbains, à juste titre : le village d’Héliopolis (residential, ouest de l’île, jusqu’à 6,442° E) et deux petites zones
// landuse=industrial (6,452–6,463° E et 6,468–6,474° E) : moins de 8 % de la terre de l’île, rien à l’est de 6,48° E.
test('île du Levant : terre naturelle (landuse=military hors des types urbains de bormes.json), seuls Héliopolis et deux petites zones industrielles en urbain', { skip: sansPack }, async () => {
  const t = await terrain();
  let terre = 0, urbain = 0, terreEst = 0, urbainEst = 0;
  for (let lat = 43.02; lat <= 43.05; lat += 0.00025) for (let lon = 6.44; lon <= 6.52; lon += 0.00035) {
    const p = xy(lat, lon), c = t.coverAt(p.x, p.y);
    if (c !== 1 && c !== 2) continue;
    terre++; if (c === 2) urbain++;
    if (lon >= 6.48) { terreEst++; if (c === 2) urbainEst++; }
  }
  assert.ok(terre > 5000 && terreEst > 1500, `Levant : ${terre} points de terre (${terreEst} à l’est de 6,48° E)`);
  assert.ok(urbain / terre <= 0.08, `Levant : ${urbain} points urbains sur ${terre}`);
  assert.equal(urbainEst, 0, `Levant à l’est de 6,48° E : ${urbainEst} points urbains`);
});

// Cellules d’eau intérieures (mêmes cellules que la référence de js/wind.js)
function eau(F) {
  let n = 0, loin = 0;
  for (let j = 1; j < F.ny - 1; j++) for (let i = 1; i < F.nx - 1; i++) { const id = j * F.nx + i; if (!F.land[id]) { n++; if (F.distLand[id] > F.openSea) loin++; } }
  return { n, loin };
}

test('champ de vent aux réglages par défaut : 36 462 cellules de 150 m, 40 à 50 % de l’eau au-delà de 4 000 m ; ouest 260° : 0,75 à 0,95 au milieu de la baie', { skip: sansPack }, async () => {
  const t = await terrain(), F = new WindField(t);
  assert.equal(F.openSea, 4000, 'seuil « mer dégagée » par défaut');
  assert.ok(Math.abs(F.nx * F.ny - 36462) <= 365, `${F.nx} × ${F.ny} cellules`);
  const e = eau(F), part = e.loin / e.n;
  assert.ok(part >= 0.4 && part <= 0.5, `${(part * 100).toFixed(1)} % de l’eau au-delà de 4 000 m (${e.loin} sur ${e.n})`);
  F.compute({ points: [{ ...xy(43.12, 6.39), dir: 260, spd: 18 }] });
  const p = xy(43.120, 6.392), s = F.sample(p.x, p.y), f = s.spd / s.baseSpd;
  assert.ok(f >= 0.75 && f <= 0.95, `facteur 260° au milieu de la baie : ${f.toFixed(3)} (étude 0,84)`);
});

test('pack de Bormes hors de la liste hors réseau ; entrée « bormes » de data/venues.json conforme aux fichiers (tailles, SHA-256)', { skip: sansPack }, () => {
  const shell = listShell(ROOT);
  assert.deepEqual(shell.filter((f) => f.startsWith('data/bormes.')), [], 'un fichier du pack de Bormes dans la liste hors réseau');
  const v = JSON.parse(readFileSync(join(ROOT, 'data/venues.json'), 'utf8')).venues.bormes;
  assert.ok(v, 'entrée bormes absente de data/venues.json');
  const attendus = FICHIERS.concat(existsSync(join(ROOT, 'data/bormes.wx-snapshot.json')) ? ['data/bormes.wx-snapshot.json'] : []).sort();
  assert.deepEqual(v.files.map((f) => f.path), attendus);
  for (const f of v.files) {
    const buf = readFileSync(join(ROOT, f.path));
    assert.equal(f.bytes, buf.length, `${f.path} : taille`);
    assert.equal(f.sha256, createHash('sha256').update(buf).digest('hex'), `${f.path} : SHA-256`);
  }
  assert.equal(v.bytes, v.files.reduce((n, f) => n + f.bytes, 0));
});

// Types landuse rangés en « urbain » par tools/prepare_venue.py (contrôle sans réseau)
let python = true;
try { execFileSync('python3', ['-I', '-c', 'pass'], { stdio: 'ignore' }); } catch { python = false; }
const sansPython = python ? false : 'python3 absent';
const typesUrbains = (cfg) => JSON.parse(execFileSync('python3', ['-I', 'tools/prepare_venue.py', '--types-urbains', cfg], { cwd: ROOT, encoding: 'utf8' }));

test('--types-urbains : liste par défaut pour Brest (configuration sans « urban »), sans « military » pour Bormes', { skip: sansPython }, () => {
  assert.deepEqual(typesUrbains('tools/venues/brest.json'), ['residential', 'industrial', 'commercial', 'military', 'harbour']);
  assert.deepEqual(typesUrbains('tools/venues/bormes.json'), ['residential', 'industrial', 'commercial', 'harbour']);
});

// ───────── Instantané météo (08-03, tâche 2) : tools/snapshot_weather.py --urls, sans réseau, contre les adresses construites par js/weather.js
import { fetchAll, configureWeather } from '../js/weather.js';
import { BREST } from '../js/venue-brest.js';

const urlsOutil = (...args) => execFileSync('python3', ['-I', 'tools/snapshot_weather.py', ...args, '--urls'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
// Adresses demandées par fetchAll() (fetch remplacé le temps de l’appel : rien ne sort sur le réseau)
async function urlsApp(cfg) {
  const vues = [], vrai = globalThis.fetch;
  globalThis.fetch = async (u) => { vues.push(String(u)); return { ok: true, status: 200, json: async () => ({}) }; };
  try { if (cfg) configureWeather(cfg); await fetchAll(); } finally { globalThis.fetch = vrai; }
  return vues;
}
const CFG = JSON.parse(readFileSync(join(ROOT, 'tools/venues/bormes.json'), 'utf8'));
const meteoBormes = () => {
  const w = CFG.weather;
  return { center: w.center, grid: w.grid.lats.flatMap((lat) => w.grid.lons.map((lon) => ({ lat, lon }))), cellSelection: w.cellSelection,
    marine: w.marine, live: null, key: 'rade.wx.bormes.v1', snapshot: 'data/bormes.wx-snapshot.json' };
};

test('instantané : sans option (Toulon) puis --venue brest, l’outil demande exactement les adresses de l’app (js/weather.js, js/venue-brest.js)', { skip: sansPython }, async () => {
  const toulon = urlsOutil();
  assert.equal(toulon.length, 3, 'Toulon : multi-modèles, grille, état de la mer');
  assert.deepEqual(toulon, await urlsApp(null), 'Toulon : adresses de la v42');
  assert.ok(!toulon.some((u) => u.includes('cell_selection')), 'Toulon : pas de cell_selection');
  const brest = urlsOutil('--venue', 'brest');
  assert.equal(brest.length, 2, 'Brest : aucune requête marine');
  assert.deepEqual(brest, await urlsApp(BREST.weather), 'Brest : adresses de js/venue-brest.js');
});

test('instantané : --venue bormes lit tools/venues/bormes.json — 20 points, cell_selection=sea, point marin gardé ; mêmes adresses que l’app', { skip: sansPython }, async () => {
  const u = urlsOutil('--venue', 'bormes');
  assert.equal(u.length, 3);
  assert.match(u[0], /\?latitude=43\.115&longitude=6\.39&/);
  const q = new URL(u[1]).searchParams;
  assert.equal(q.get('latitude').split(',').length, 20, 'grille de 20 points');
  assert.equal(q.get('longitude').split(',').length, 20);
  for (const x of u.slice(0, 2)) assert.ok(x.endsWith('&cell_selection=sea'), 'points pris sur la mer');
  assert.ok(u[2].startsWith('https://marine-api.open-meteo.com/v1/marine?latitude=43.115&longitude=6.39&'), 'point marin');
  assert.deepEqual(u, await urlsApp(meteoBormes()), 'adresses construites par js/weather.js avec le même bloc');
  assert.deepEqual(u, await urlsApp(BORMES.weather), 'adresses construites avec le descripteur js/venue-bormes.js');
  for (const v of ['Bormes', '../bormes', 'inconnu', 'toulon', '']) {
    assert.throws(() => execFileSync('python3', ['-I', 'tools/snapshot_weather.py', '--venue', v, '--urls'], { cwd: ROOT, stdio: 'pipe' }), `--venue ${v || '(vide)'} refusé`);
  }
});

const SNAP = join(ROOT, 'data/bormes.wx-snapshot.json');
test('instantané météo de Bormes : modèles, grille de 20 points, état de la mer', { skip: existsSync(SNAP) ? false : 'data/bormes.wx-snapshot.json absent (Open-Meteo a refusé : limite quotidienne) : l’app reçoit null' }, () => {
  const s = JSON.parse(readFileSync(SNAP, 'utf8'));
  assert.equal(s.snapshot, true);
  assert.ok(s.multi?.hourly?.time?.length > 0, 'prévisions multi-modèles');
  assert.ok(Array.isArray(s.grid) && s.grid.length === 20, 'grille de 20 points');
  assert.ok(s.marine?.hourly?.time?.length > 0, 'état de la mer');
});

test('descripteur ↔ configuration : météo (centre, grille latitude d’abord, cellules de mer, point marin), emprise, origine, fichiers et point de référence de js/venue-bormes.js = tools/venues/bormes.json et data/bormes.meta.json', () => {
  assert.deepEqual(ORIGIN, { lat: 43.10, lon: 6.40 }, 'origine posée par setVenue');
  assert.deepEqual(BORMES.weather, meteoBormes(), 'bloc weather identique à la configuration');
  assert.deepEqual(BORMES.bounds, CFG.bounds);
  assert.deepEqual(BORMES.bounds, EMPRISE);
  assert.equal(BORMES.files.base, 'data/' + CFG.prefix);
  assert.equal(BORMES.id, CFG.id); assert.equal(BORMES.nom, CFG.nom);
  assert.deepEqual(BORMES.windRef, { lat: 43.120, lon: 6.392 });
  assert.deepEqual(BORMES.wind, {}, 'maille et seuil par défaut');
  assert.equal(BORMES.inputBounds.west, 6.20, 'borne ouest de saisie à 6,20° E (piège 6)');
  for (const k of ['maree', 'courant']) assert.ok(!(k in BORMES), `ni ${k} à Bormes`);
  if (PACK) { const m = meta(); for (const k of ['west', 'east', 'south', 'north']) assert.equal(m.bounds?.[k] ?? m[k], BORMES.bounds[k], k); }
});

// ───────── Savoir local de Bormes (08-07, D-13, D-14) : zones interdites, marques, lieux, dangers (étude § 2.3 à 2.6, § 6.5, pièges 5 et 7)
import { pointInPolygon, NM, fmtLat, fmtLon, toLL } from '../js/geo.js';
import { route } from '../js/router.js';
import { zonesXY } from '../js/venues.js';
import { parseLatLon } from '../js/marks.js';

const dmn = (d, m) => d + m / 60;
const zoneB = (nom) => BORMES.FORBIDDEN_ZONES.find((z) => z.name === nom);
const polyB = (nom) => zoneB(nom).pts.map((p) => xy(p.lat, p.lon));
const LEVANT = 'Île du Levant — zone militaire', BREG = 'Fort de Brégançon';
const segCroiseB = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const distSegB = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const dansEmpriseB = (p) => p.lat > EMPRISE.south && p.lat < EMPRISE.north && p.lon > EMPRISE.west && p.lon < EMPRISE.east;
const ecartB = (a, b) => { const p = xy(a.lat, a.lon), q = xy(b.lat, b.lon); return Math.hypot(p.x - q.x, p.y - q.y); };
const milles = (a, b) => ecartB(a, b) / NM;
const toLLb = (p) => toLL(p.x, p.y);
// Repères de contrôle (étude § 2.3 ; Héliopolis : centre des cellules « urbain » de l’ouest de l’île dans le pack, aucun nœud nommé)
const REP = {
  titan: { lat: dmn(43, 2.793), lon: dmn(6, 30.614) }, portMan: { lat: dmn(43, 0.835), lon: dmn(6, 25.251) }, grottes: { lat: 43.0091, lon: 6.4250 },
  ayguade: { lat: dmn(43, 0.914), lon: dmn(6, 25.948) }, heliopolis: { lat: 43.0188, lon: 6.4374 }, esquillade: { lat: dmn(43, 3.039), lon: dmn(6, 31.95) },
  feuLavandou: { lat: dmn(43, 8.136), lon: dmn(6, 22.361) }, fort: { lat: 43.0916, lon: 6.3216 },
};
// Chemin hors des zones : aucun point dedans ; un pas peut rogner un coin (le routage teste les bouts et le milieu) : profondeur rendue (m)
function horsZonesB(path, polys, quoi) {
  for (const p of path) for (const poly of polys) assert.ok(!pointInPolygon(p, poly), `${quoi} : point du chemin dans une zone interdite`);
  let prof = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
    for (let k = 1; k < n; k++) {
      const q = { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n };
      for (const poly of polys) if (pointInPolygon(q, poly)) prof = Math.max(prof, Math.min(...poly.map((u, j) => distSegB(q, u, poly[(j + 1) % poly.length]))));
    }
  }
  return prof;
}

test('zones interdites de Bormes : Levant militaire et Brégançon, « à compléter sur carte marine », polygones simples dans l’emprise', () => {
  assert.deepEqual(BORMES.FORBIDDEN_ZONES.map((z) => z.name), [LEVANT, BREG]);
  for (const z of BORMES.FORBIDDEN_ZONES) {
    assert.equal(z.note, 'à compléter sur carte marine', z.name);
    assert.ok(z.desc && z.desc.length > 60 && !/'/.test(z.desc), `${z.name} : description, apostrophe typographique`);
    assert.ok(z.pts.length >= 4, `${z.name} : au moins 4 sommets`);
    for (const p of z.pts) assert.ok(dansEmpriseB(p), `${z.name} : sommet hors emprise`);
    const poly = polyB(z.name), n = poly.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      assert.ok(!segCroiseB(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n]), `${z.name} : arêtes ${i} et ${j} se coupent`);
    }
  }
  assert.match(zoneB(LEVANT).desc, /55\/2021/);
  assert.match(zoneB(LEVANT).desc, /zone 6[^.]*tenue interdite toute l’année/);
  assert.match(zoneB(BREG).desc, /192\/2018[^]*110\/2023/);
});

test('zone du Levant : Titan dedans ; Port-Man et passe des Grottes dehors, ouest de l’île (Ayguade, Héliopolis) libre', () => {
  const poly = polyB(LEVANT);
  assert.ok(pointInPolygon(xy(REP.titan.lat, REP.titan.lon), poly), 'phare du Titan dans la zone');
  assert.ok(pointInPolygon(xy(REP.esquillade.lat, REP.esquillade.lon), poly), 'L’Esquillade (zone 6) dans la zone : tenue interdite toute l’année');
  for (const k of ['portMan', 'grottes', 'ayguade', 'heliopolis']) assert.ok(!pointInPolygon(xy(REP[k].lat, REP[k].lon), poly), `${k} hors de la zone`);
  // points de l’arrêté repris tels quels : 1 (Tablier), 23, 24, 25, 26, 29, 30, 6, 7, 2 (Maupertuis)
  const P = zoneB(LEVANT).pts, a = (lat, lon) => P.some((p) => ecartB(p, { lat, lon }) < 1);
  for (const [n, la, lo] of [[1, [43, 1.494], [6, 26.663]], [23, [43, 3.224], [6, 30.614]], [24, [43, 3.512], [6, 30.695]], [25, [43, 3.296], [6, 32.338]], [26, [43, 2.499], [6, 32.218]],
    [29, [43, 1.898], [6, 32.155]], [30, [43, 1.209], [6, 31.046]], [6, [43, 1.321], [6, 30.99]], [7, [42, 59.618], [6, 26.262]], [2, [43, 0.205], [6, 26.262]]]) {
    assert.ok(a(dmn(...la), dmn(...lo)), `point ${n} de l’arrêté`);
  }
});

test('zone du Levant fermée au nord par la bande de 200 m : chaque arête de la bande à 200 à 240 m de la côte du pack', { skip: sansPack }, () => {
  const coast = JSON.parse(readFileSync(join(ROOT, 'data/bormes.coast.json'), 'utf8')).map((l) => l.map(([lon, lat]) => xy(lat, lon)));
  const dCote = (p) => { let m = Infinity; for (const l of coast) for (let i = 1; i < l.length; i++) if (Math.abs(l[i].x - p.x) < 3000 && Math.abs(l[i].y - p.y) < 3000) m = Math.min(m, distSegB(p, l[i - 1], l[i])); return m; };
  const poly = polyB(LEVANT), fin = poly.findIndex((p) => ecartB(toLLb(p), { lat: dmn(43, 3.224), lon: dmn(6, 30.614) }) < 1);
  assert.ok(fin > 10, 'bande avant le point 23');
  let min = Infinity, max = 0;
  for (let i = 2; i < fin; i++) {
    const a = poly[i - 1], b = poly[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
    for (let k = 0; k <= n; k++) { const e = dCote({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }); min = Math.min(min, e); max = Math.max(max, e); }
  }
  assert.ok(min >= 200 && max <= 240, `bande : ${min.toFixed(1)} à ${max.toFixed(1)} m de la côte`);
});

test('zone de Brégançon : contient l’îlot du fort, passe par les deux points de l’arrêté 110/2023, laisse libres la Galère et la pointe du Diable', () => {
  const poly = polyB(BREG), P = zoneB(BREG).pts;
  assert.ok(pointInPolygon(xy(REP.fort.lat, REP.fort.lon), poly), 'îlot du fort dans la zone');
  for (const [la, lo] of [[5.341, 19.392], [5.569, 19.625]]) assert.ok(P.some((p) => ecartB(p, { lat: dmn(43, la), lon: dmn(6, lo) }) < 1), `point 43°0${la} N 006°${lo} E`);
  for (const [nom, lat, lon] of [['Pointe de la Galère', 43.0897, 6.3318], ['Pointe du Diable', 43.0978, 6.3240], ['coffre 1', 43.085217, 6.27945]]) assert.ok(!pointInPolygon(xy(lat, lon), poly), `${nom} hors de la zone`);
});

const NOMS_BORMES = ['Le Lavandou', 'Bormes-les-Mimosas (village)', 'La Londe-les-Maures', 'Rayol-Canadel-sur-Mer', 'Cavalaire-sur-Mer', 'Cap Bénat', 'Cap Blanc',
  'Pointe du Cristau', 'Pointe du Pinet', 'Pointe de l’Esquillette', 'Pointe de la Ris', 'Cap de Brégançon', 'Pointe de la Galère (Brégançon)', 'Pointe du Diable',
  'Pointe Pilon', 'Pointe de Nard Viou', 'Pointe de la Fossette', 'Pointe du Layet', 'Cap Nègre', 'Pointe du Souffre', 'Pointe de l’Écuelle', 'Pointe de Malpague',
  'Pointe du Trésor', 'Pointe de la Chappe', 'Pointe du Dattier', 'Pointe de Vergeron', 'Cap des Mèdes (Porquerolles)', 'Pointe du Titan (Levant)', 'Île de Port-Cros',
  'Île de Bagaud', 'Île du Levant', 'Îlot de la Gabinière', 'Îlot la Fourmigue', 'Pierre d’Avenon (443 m)', 'Biscarre (482 m)', 'Malatra (492 m)', 'L’Eau Blanche (527 m)',
  'Fortin de la Vigie, Port-Cros (199 m)', 'Rade d’Hyères', 'Baie du Gau', 'Baie de l’Estagnol', 'Anse de Cavalière', 'Baie de Cavalaire', 'Rade de Port-Cros',
  'Baie de Port-Man', 'Passe des Grottes'];

test('lieux de Bormes : les 46 nœuds du tableau de l’étude § 2.4, dans l’emprise, forme [nom, lat, lon, type], aucun lieu sans nœud inventé', () => {
  const P = BORMES.PLACES, noms = P.map((p) => p[0]);
  assert.deepEqual(noms, NOMS_BORMES);
  for (const [nom, lat, lon, type] of P) {
    assert.ok(dansEmpriseB({ lat, lon }), `${nom} hors emprise`);
    assert.ok([1, 2, 3, 4].includes(type), `${nom} : type ${type}`);
    assert.ok(!/'/.test(nom), `${nom} : apostrophe typographique`);
  }
  assert.ok(!noms.some((n) => /Héliopolis|Favière|Saint-Clair|Aiguebelle|Pramousquier|Baie de Bormes/i.test(n)), 'lieux sans nœud nommé : jamais placés au jugé');
});

const FIXES_B = new Set(['tourelle', 'ilot', 'balise', 'amer']);
test('marques de Bormes : La Fourmigue et coffre 1 fixes aux positions de l’étude, bouées mouillées « position à confirmer », clés courtes non numériques', () => {
  const M = BORMES.MARKS;
  assert.deepEqual(Object.keys(M), ['FOU', 'COF', 'DAM', 'CNE', 'BEN', 'CAV', 'ORA', 'PCS', 'BAG']);
  // points de passage du tour de Port-Cros (08-08) : jamais présentés comme des bouées ni comme « position à confirmer »
  for (const k of ['PCS', 'BAG']) { assert.equal(M[k].kind, 'passage'); assert.notEqual(M[k].src, 'approx'); assert.match(M[k].note, /ce n’est pas une bouée/); }
  assert.ok(Math.abs(M.FOU.lat - 43.10603) < 1e-5 && Math.abs(M.FOU.lon - 6.40420) < 1e-5, 'La Fourmigue 43,10603° N 6,40420° E');
  assert.ok(Math.abs(M.COF.lat - 43.08522) < 1e-5 && Math.abs(M.COF.lon - 6.27945) < 1e-5, 'coffre 1 43,08522° N 6,27945° E');
  assert.ok(ecartB(M.FOU, parseLatLon('43°06.362N 006°24.252E', BORMES.inputBounds)) < 1, 'La Fourmigue : degrés-minutes de l’arrêté');
  assert.ok(ecartB(M.COF, parseLatLon('43°05.113N 006°16.767E', BORMES.inputBounds)) < 1, 'coffre 1 : degrés-minutes de l’annexe');
  assert.ok(ecartB(M.DAM, parseLatLon('43°00.399N 006°25.240E', BORMES.inputBounds)) < 1, 'La Dame : OpenStreetMap');
  for (const [k, m] of Object.entries(M)) {
    assert.ok(/^[A-Z][A-Z0-9]{1,3}$/.test(k) && !['A', 'B', 'C', 'D', 'PG', 'PD', 'S'].includes(k), `${k} : clé courte, non réservée`);
    for (const f of ['name', 'note', 'src', 'kind', 'color']) assert.ok(typeof m[f] === 'string' && m[f], `${k} : ${f}`);
    assert.ok(dansEmpriseB(m), `${k} hors emprise`);
    assert.ok(!/'/.test(m.name + m.note), `${k} : apostrophe typographique`);
  }
  for (const k of ['FOU', 'COF', 'DAM']) assert.notEqual(M[k].src, 'approx', `${k} : marque fixe`);
  assert.match(M.COF.note, /à confirmer sur l’eau/);
  assert.match(M.DAM.note, /« Sa cardinale »[^]*à confirmer au club/);
  for (const k of ['CNE', 'BEN', 'CAV', 'ORA']) {
    assert.equal(M[k].src, 'approx', `${k} : bouée mouillée, jamais présentée comme fixe (piège 7)`);
    assert.match(M[k].note, /position à confirmer/, `${k} : position à confirmer`);
  }
  // bouée orange : milieu du segment ligne du Lavandou – La Fourmigue
  const L = BORMES.LINE_PRESETS.lavandou;
  assert.ok(ecartB(M.ORA, { lat: (L.lat + M.FOU.lat) / 2, lon: (L.lon + M.FOU.lon) / 2 }) < 1, 'bouée orange au milieu du segment');
});

test('marques de Bormes en mer (sauf tourelles et balises), hors des zones interdites ; dangers de l’étude et information du parc de Port-Cros', { skip: sansPack }, async () => {
  const t = await terrain(), polys = zonesXY(BORMES.FORBIDDEN_ZONES, xy);
  for (const [k, m] of Object.entries(BORMES.MARKS)) {
    const p = xy(m.lat, m.lon);
    if (!FIXES_B.has(m.kind)) assert.ok(!t.isLand(p.x, p.y), `${k} ${m.name} à terre`);
    assert.ok(!polys.some((poly) => pointInPolygon(p, poly)), `${k} dans une zone interdite`);
  }
  const fou = xy(BORMES.MARKS.FOU.lat, BORMES.MARKS.FOU.lon);
  assert.ok(t.isLand(fou.x, fou.y), 'La Fourmigue : cellule de terre du pack (îlot), comme la Roche Mengam à Brest');
  const D = BORMES.DANGERS;
  for (const re of [/La Fourmigue/, /Îlot du Cristau/, /La Dame/, /Rocher du Rascas/, /Gabinière/, /L’Esquillade/, /sud du port de Bormes/, /Batterie des Maures/, /Léoube/, /Port-Cros/]) assert.ok(D.some((d) => re.test(d.name)), `danger manquant : ${re}`);
  for (const d of D) {
    assert.ok(typeof d.note === 'string' && d.note.length > 20, `${d.name} : note`);
    assert.ok(dansEmpriseB(d), `${d.name} hors emprise`);
    assert.ok(!/'/.test(d.name + d.note), `${d.name} : apostrophe typographique`);
    const r = parseLatLon(`${fmtLat(d.lat)} ${fmtLon(d.lon)}`, BORMES.inputBounds);
    assert.ok(!r.error && ecartB(r, d) < 1, `${d.name} : aller-retour fmtLat/fmtLon`);
  }
  const pc = D.find((d) => /Parc national de Port-Cros/.test(d.name)).note;
  for (const m of ['5 nd à moins de 300 m', '12 nd dans les 600 m', 'pas de débarquement à Bagaud', 'réserve intégrale', 'À compléter sur carte marine']) assert.ok(pc.includes(m), `Port-Cros : « ${m} »`);
  assert.ok(!D.some((d) => /Gouron/.test(d.name)), 'Sèche de Gouron sans position : non placée');
});

test('distances de contrôle (étude § 2.2) : feu du Lavandou → La Fourmigue 2,24 M ; La Fourmigue → pointe de Port-Man 5,55 M (± 0,05)', () => {
  const fou = BORMES.MARKS.FOU;
  const d1 = milles(REP.feuLavandou, fou), d2 = milles(fou, REP.portMan);
  assert.ok(Math.abs(d1 - 2.24) <= 0.05, `Lavandou → La Fourmigue : ${d1.toFixed(3)} M`);
  assert.ok(Math.abs(d2 - 5.55) <= 0.05, `La Fourmigue → Port-Man : ${d2.toFixed(3)} M`);
});

let F270B = null;
const champ270B = async () => { if (!F270B) { F270B = new WindField(await terrain(), BORMES.wind); F270B.compute({ points: [{ x: 0, y: 0, dir: 270, spd: 10, gust: 13 }] }, { localEffects: 1 }); } return F270B; };

test('routage à Bormes (270°/10 nd) : La Fourmigue → sud du Levant (42,99° N 6,48° E) ne coupe aucune zone ; sans zone, la route traverse le Levant militaire', { skip: sansPack }, async () => {
  const t = await terrain(), F = await champ270B(), polys = zonesXY(BORMES.FORBIDDEN_ZONES, xy);
  const fou = xy(BORMES.MARKS.FOU.lat, BORMES.MARKS.FOU.lon), sud = xy(42.99, 6.48);
  const r = route(fou, sud, F, { terrain: t, forbidden: polys, perf: 1 });
  assert.ok(r && r.path.length > 2, 'route trouvée');
  const prof = horsZonesB(r.path, polys, 'La Fourmigue → sud du Levant');
  assert.ok(prof < 25, `un pas rogne une zone de ${prof.toFixed(0)} m`);
  const fin = r.path.at(-1);
  assert.ok(Math.hypot(fin.x - sud.x, fin.y - sud.y) < 30, 'route jusqu’au point visé');
  // contrôle négatif : sans les zones, le chemin le plus court entre dans la zone militaire
  const libre = route(fou, sud, F, { terrain: t, forbidden: [], perf: 1 });
  assert.ok(libre.path.some((q) => pointInPolygon(q, polys[0])), 'sans zone, la route entre dans la zone militaire');
});

test('routage à Bormes : une route de la ligne du Lavandou vers La Fourmigue (îlot, cellule de terre) arrive à 30 m de la marque', { skip: sansPack }, async () => {
  const t = await terrain(), F = await champ270B(), polys = zonesXY(BORMES.FORBIDDEN_ZONES, xy);
  const L = BORMES.LINE_PRESETS.lavandou, fou = xy(BORMES.MARKS.FOU.lat, BORMES.MARKS.FOU.lon);
  for (const de of [xy(L.lat, L.lon), xy(43.09, 6.42)]) {
    const r = route(de, fou, F, { terrain: t, forbidden: polys, perf: 1 });
    assert.ok(r && r.path.length >= 2, 'route trouvée');
    const fin = r.path.at(-1);
    assert.ok(Math.hypot(fin.x - fou.x, fin.y - fou.y) <= 30, `arrivée à ${Math.hypot(fin.x - fou.x, fin.y - fou.y).toFixed(0)} m de La Fourmigue`);
  }
});

// ───────── Vents et textes du lieu de Bormes (08-07, D-11, D-12) : étude § 3.6, § 3.7, § 4.2, pièges 1, 2 et 8
import * as tactiques from '../js/tactics.js';
import { VENUES, merTexte } from '../js/venues.js';

const IDS_BORMES = ['calme', 'mistral', 'ouest', 'nord', 'est', 'sudest', 'sud', 'suroit'];
const ORIG_B = ['D', 'M', 'S', 'H'];

test('régimes de Bormes : huit, exclusifs — chaque direction (0 à 359°) et chaque force (0 à 30 nd) dans exactement un régime', () => {
  const R = BORMES.regimes;
  assert.deepEqual(R.map((r) => r.id), IDS_BORMES);
  for (let d = 0; d < 360; d++) for (let s = 0; s <= 30; s += 0.5) {
    const ok = R.filter((r) => r.test(d, s));
    assert.equal(ok.length, 1, `${d}° ${s} nd : ${ok.map((r) => r.id).join(', ') || 'aucun'}`);
    assert.equal(tactiques.regimeOf(d, s), ok[0], `regimeOf ${d}° ${s} nd`);
  }
  for (let d = 0; d <= 355; d += 5) for (const s of [2, 6, 12, 20, 28]) assert.ok(tactiques.regimeOf(d, s), `${d}° ${s} nd`);
});

test('régimes de Bormes : le mistral vient de l’ouest (piège 1) — 260° 20 nd « Mistral (ouest) », 260° 10 nd ouest, 75° 14 nd est, 130° 7 nd sud-est, 330° 8 nd nord, 3 nd calme', () => {
  const de = (d, s) => tactiques.regimeOf(d, s).id;
  assert.equal(de(260, 20), 'mistral');
  assert.equal(tactiques.regimeOf(260, 20).name, 'Mistral (ouest)');
  assert.equal(de(260, 10), 'ouest');
  assert.equal(de(75, 14), 'est');
  assert.equal(de(130, 7), 'sudest');
  assert.equal(de(330, 8), 'nord');
  for (let d = 0; d < 360; d += 15) assert.equal(de(d, 3), 'calme', `${d}° 3 nd`);
  assert.deepEqual([de(234, 20), de(235, 20), de(299, 20), de(300, 20), de(235, 13.9), de(235, 14), de(29, 8), de(30, 8), de(109, 8), de(110, 8), de(159, 8), de(160, 8), de(199, 8), de(200, 8)],
    ['suroit', 'mistral', 'mistral', 'nord', 'ouest', 'mistral', 'nord', 'est', 'est', 'sudest', 'sudest', 'sud', 'sud', 'suroit']);
  assert.notEqual(de(320, 20), 'mistral', 'le nord-ouest n’est pas le mistral de Bormes');
});

test('conseils de Bormes : chacun porte son origine (D, M, S, H) ; une hypothèse s’affiche « à confirmer sur l’eau » ; doutes du modèle par sud signalés (piège 8)', () => {
  let h = 0;
  for (const r of BORMES.regimes) {
    assert.ok(r.tips.length >= 2, `${r.id} : au moins deux conseils`);
    for (const c of r.tips) {
      assert.ok(c && typeof c.t === 'string' && c.t.length > 10, `${r.id} : texte`);
      assert.ok(ORIG_B.includes(c.o), `${r.id} : origine ${c.o}`);
      assert.ok(!/'/.test(c.t), `${r.id} : apostrophe typographique`);
      assert.ok(!/Toulon|Cépet|Saint-Mandrier|Sicié|Mourillon|CVAT|J80|Naos/.test(c.t), `${r.id} : aucun lieu ni mot de Toulon`);
      const vu = tactiques.tipText(c);
      if (c.o === 'H') { h++; assert.ok(vu.endsWith('(à confirmer sur l’eau)'), `${r.id} : hypothèse affichée sans réserve`); }
      else assert.equal(vu, c.t);
    }
  }
  assert.ok(h >= 5, `${h} hypothèses signalées`);
  for (const id of ['sudest', 'sud']) assert.ok(BORMES.regimes.find((r) => r.id === id).tips.some((c) => c.o === 'M' && /à confirmer sur l’eau/.test(c.t)), `${id} : doute du modèle « à confirmer sur l’eau »`);
  assert.match(BORMES.regimes.find((r) => r.id === 'mistral').tips[0].t, /vient de l’ouest[^]*260°/);
  assert.match(BORMES.texts.origine, /hypothèses sont à confirmer sur l’eau/);
  assert.ok(!/atlas/.test(BORMES.texts.origine), 'aucun atlas de courant à Bormes');
});

test('vents prédéfinis de Bormes : les huit de l’étude § 3.6 ; chacun dans le régime attendu', () => {
  assert.deepEqual(BORMES.presets, [['Mistral fort', 260, 24, 34], ['Mistral modéré', 265, 16, 23], ['Est', 75, 12, 17], ['Est fort', 70, 22, 30],
    ['Brise de sud-est', 130, 7, 9], ['Brise de sud-ouest', 220, 10, 13], ['Vent de terre', 330, 5, 8], ['Petit temps', 110, 4, 6]]);
  assert.deepEqual(BORMES.presets.map(([, d, s]) => tactiques.regimeOf(d, s).id), ['mistral', 'mistral', 'est', 'est', 'sudest', 'suroit', 'nord', 'sudest']);
});

test('textes du lieu de Bormes : milieu de la baie, relief des Maures et de Bénat, liens neutres, point marin gardé ; aucun texte de Toulon', () => {
  const T = BORMES.texts;
  assert.equal(T.centre, 'milieu de la baie de Bormes');
  assert.equal(T.point, 'milieu de la baie de Bormes');
  assert.match(T.relief, /mur des Maures \(450 à 520 m\)[^]*cap Bénat \(184 m\)[^]*Port-Cros \(190 m\)/);
  assert.equal(BORMES.weather.marine, 'latitude=43.115&longitude=6.39', 'point marin gardé (étude § 3.7)');
  assert.deepEqual(BORMES.links.map(([t]) => t), ['Bulletin côtier Météo-France', 'Windy']);
  assert.ok(BORMES.links.every(([, u]) => /^https:\/\//.test(u) && !/48529|5\.96/.test(u)), 'liens sans balise ni cadrage de Toulon');
  assert.ok(!/Toulon|Cépet|Saint-Mandrier|Sicié|CVAT|J80|Naos/.test(JSON.stringify(T)), 'textes sans lieu ni mot de Toulon');
  for (const k of ['maree', 'courant']) assert.ok(!(k in BORMES), `ni ${k} : ni marée ni modèle de courant (D-11)`);
});

test('carte « État de la mer » : Toulon garde les textes de la v43 à l’octet ; Bormes nomme sa baie et le courant général d’ouest entre les îles (information) ; Brest sans point marin', () => {
  const t = merTexte(VENUES.toulon);
  assert.deepEqual(t, { lieu: 'large de Cépet', note: 'Courant de surface modélisé (Copernicus) : faible en rade, à vérifier sur les bouées.' });
  assert.ok(!/[&<>"]/.test(t.lieu + t.note), 'aucun caractère échappé : HTML de la v43 identique');
  assert.equal(VENUES.toulon.weather.marine, 'latitude=43.06&longitude=5.96', 'point marin de Toulon inchangé');
  const b = merTexte(BORMES);
  assert.equal(b.lieu, 'au large de la baie de Bormes');
  assert.match(b.note, /faible dans la baie/);
  assert.match(b.note, /entre les îles[^]*porte[^]*ouest/);
  assert.match(b.note, /Information seulement[^]*à confirmer sur l’eau/);
  assert.ok(!/Cépet|rade de Toulon|Copernicus/.test(b.lieu + b.note), 'aucun texte de Toulon à Bormes');
  assert.equal(VENUES.brest.weather.marine, null, 'Brest : pas de point marin, pas de carte');
});

// Code de la carte dans js/app.js : textes choisis par merTexte, rien d’autre de changé (Toulon : chaînes de la v43)
test('js/app.js : la carte « État de la mer » prend lieu et note dans merTexte(VENUE) ; plus de « large de Cépet » en dur ; parcours hors du cahier CVAT seulement pour Naos', () => {
  const src = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  assert.match(src, /État de la mer <small>\$\{esc\(mer\.lieu\)\}<\/small>/);
  assert.match(src, /°C\. \$\{esc\(mer\.note\)\}<\/div>/);
  assert.ok(!/large de Cépet/.test(src), 'texte de Toulon en dur retiré de js/app.js (gardé pour Toulon dans js/venues.js)');
  assert.match(src, /ESPACE\.id === 'naos' \? 'du cahier CVAT'/);
});

test('type de bord : voile d’avant du bateau (« Génois » au Tofinou) ; sans voile passée (Naos), « Foc » de la v43', { skip: sansPack }, async () => {
  const t = await terrain(), F = await champ270B(), polys = zonesXY(BORMES.FORBIDDEN_ZONES, xy);
  const de = xy(43.115, 6.40), vers = { ...xy(43.115, 6.38), name: 'au vent' };          // bord de près vers l’ouest par 270°
  const leg = { from: de, to: vers, brg: 270, dist: Math.hypot(vers.x - de.x, vers.y - de.y) };
  const ctx = { terrain: t, forbidden: polys, perf: 1, trend: 0, memo: new Map() };
  const naos = tactiques.analyzeLeg({ ...leg }, F, ctx), tof = tactiques.analyzeLeg({ ...leg }, F, { ...ctx, memo: new Map(), voileAvant: 'Génois' });
  assert.equal(naos.type.id, 'pres');
  assert.equal(naos.type.sail, 'Foc');
  assert.equal(tof.type.sail, 'Génois');
});

// ───────── Catalogue du Challenge de la Baie 2026-2027 (08-08, D-13) : annexe « Parcours 1 à 10 », étude § 2.2

import { buildLegs } from '../js/tactics.js';
import { courseBan, courseLaps, banHorsEau, BANANE_ID } from '../js/banane.js';

const CAT = Object.fromEntries(BORMES.COURSES.map((c) => [c.id, c]));
const ligneB = (k) => ({ center: BORMES.LINE_PRESETS[k], lengthNm: 0.12, mode: 'wind', bearing: 0 });
const bords = (c, windDir = 270, S = {}) => buildLegs(c, 'G', { laps: courseLaps(c, { laps: 2, ...S }), windDir, wlLengthNm: 0.8, ban: courseBan(c, S), line: ligneB(c.line) });
const nmB = (B) => B.legs.reduce((a, l) => a + l.dist, 0) / NM;
const echange = (seq) => [...seq].reverse().map(([m, c]) => [m, c === 'b' ? 't' : 'b']);
// Annexe : marques et côtés de chaque parcours direct (PCS, BAG : points de passage du tour de Port-Cros et de Bagaud, île à tribord)
const ANNEXE = {
  1: { nom: 'parcours 1 : bouée de cap Nègre à tribord, La Fourmigue à tribord', seq: [['CNE', 't'], ['FOU', 't']] },
  2: { nom: 'parcours 2 : bouée de Bénat à bâbord, La Fourmigue à bâbord', seq: [['BEN', 'b'], ['FOU', 'b']] },
  3: { nom: 'parcours 3 : La Fourmigue à tribord, bouée orange à tribord, La Fourmigue à tribord', seq: [['FOU', 't'], ['ORA', 't'], ['FOU', 't']] },
  5: { nom: 'parcours 5, groupe régate : La Fourmigue à tribord, coffre 1 à bâbord, La Fourmigue à bâbord', seq: [['FOU', 't'], ['COF', 'b'], ['FOU', 'b']] },
  25: { nom: 'parcours 5, groupe croisière : coffre 1 à bâbord, retour direct', seq: [['COF', 'b']] },
  6: { nom: 'parcours 6 : La Fourmigue à tribord, Port-Cros et sa cardinale à tribord (tour de Port-Cros et de Bagaud)', seq: [['FOU', 't'], ['DAM', 't'], ['PCS', 't'], ['BAG', 't']] },
  7: { nom: 'parcours 7 : La Fourmigue à tribord, coffre 1 à tribord, La Fourmigue à bâbord', seq: [['FOU', 't'], ['COF', 't'], ['FOU', 'b']] },
  9: { nom: 'parcours 9 : bouée Cavalaire à tribord, La Fourmigue à tribord', seq: [['CAV', 't'], ['FOU', 't']] },
  10: { nom: 'parcours 10 : Port-Cros et sa cardinale à tribord, bouée orange à tribord, La Fourmigue à tribord', seq: [['DAM', 't'], ['PCS', 't'], ['BAG', 't'], ['ORA', 't'], ['FOU', 't']] },
};

test('catalogue du Challenge de la Baie : parcours 1 à 10 sans 8, banane n° 4, variante croisière du 5, sens inverse « R » de chaque côtier ; identifiants entiers, uniques, sous 90', () => {
  const ids = BORMES.COURSES.map((c) => c.id);
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 25, 6, 7, 9, 10, 51, 52, 53, 55, 75, 56, 57, 59, 60]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  assert.ok(ids.every((id) => Number.isInteger(id) && id > 0 && id < 90 && id !== BANANE_ID));
  assert.ok(!ids.includes(8) && !ids.includes(58), 'pas de parcours 8 (absent de l’annexe)');
  for (const c of BORMES.COURSES) {
    assert.ok(c.title && c.text && c.seq.G && c.both, `${c.id} : forme`);
    assert.deepEqual(c.seq.G, c.seq.P, `${c.id} : même parcours pour tous les groupes`);
    assert.ok(!/'/.test(c.title + c.text), `${c.id} : apostrophe typographique`);
    assert.ok(!/CVAT|Toulon|J80|Naos|cahier/i.test(c.title + c.text), `${c.id} : aucun texte de Toulon`);
    if (!c.built) {
      assert.equal(c.line, 'lavandou');
      for (const [m] of c.seq.G) assert.ok(Object.hasOwn(BORMES.MARKS, m), `${c.id} : marque ${m} connue`);
      assert.match(c.text, /Départ entre le bateau comité et la bouée cylindrique orange/);
      assert.match(c.text, /arrivée sur la ligne de départ \(entre bateau comité et bouée cylindrique orange\)/);
      assert.match(c.text, /Pavillon D : bouée de dégagement ; pavillon vert : dégagement à laisser à tribord/);
    }
  }
  assert.equal(CAT[1].title, 'Parcours 1 — cap Nègre, La Fourmigue');
  assert.equal(CAT[51].title, 'Parcours 1 R (sens inverse)');
  for (const [id, a] of [[1, '7,8 M'], [2, '6,2 M'], [3, '4 à 8 M'], [6, '20 M'], [7, '16,5 M'], [9, 'environ 20 M']]) {
    assert.equal(CAT[id].annonce, a); assert.match(CAT[id].text, new RegExp(`Longueur annoncée : ${a}\\.`));
  }
});

for (const [id, { nom, seq }] of Object.entries(ANNEXE)) {
  test(`${nom} ; sens inverse : marques dans l’ordre inverse, côtés échangés`, () => {
    const c = CAT[id], r = CAT[+id + 50];
    assert.deepEqual(c.seq.G, seq, 'sens direct');
    assert.deepEqual(r.seq.G, echange(seq), 'sens inverse');
    const n = [5, 25].includes(+id) ? 5 : +id;
    assert.match(r.text, new RegExp(`^Sens inverse du parcours ${n}( du groupe « (régate|croisière) »)? \\(« ${n} R » affiché par le comité\\)`));
    assert.ok(c.text.includes(seq.map(([m, s]) => `${BORMES.MARKS[m].name} à ${s === 'b' ? 'bâbord' : 'tribord'}`).join(', ')), 'texte : marques et côtés dans l’ordre');
  });
}

test('parcours 4 : banane construite au vent — bouée 1 au vent, bouée 2 sous le vent, bouée 1, arrivée sur la ligne de départ ; ligne au milieu de la baie', () => {
  const c = CAT[4];
  assert.equal(c.built, 'BAN'); assert.equal(c.fixedLaps, 2); assert.equal(c.line, 'baie');
  assert.deepEqual(c.ban, { off: false, side: 'b', gate: false, fin: 'depart' });
  assert.equal(BORMES.lineDefaut, 'lavandou');
  assert.match(BORMES.LINE_PRESETS.baie.label, /position à confirmer/);
  const B = bords(c, 260);
  assert.deepEqual(B.legs.map((l) => l.to.name), ['1', 'Bouée sous le vent', '1', 'Arrivée (ligne de départ)']);
  assert.ok(!CAT[54], 'pas de sens inverse pour la banane');
});

test('banane n° 4 : bouées et ligne en mer, hors des zones interdites, par 36 directions de vent à 0,8 M ; alerte « à terre » quand la distance réglée met une bouée à terre', { skip: sansPack }, async () => {
  const t = await terrain(), polys = zonesXY(BORMES.FORBIDDEN_ZONES, xy);
  const bloque = (p) => !t.inside(p.x, p.y) || t.isLand(p.x, p.y) || polys.some((poly) => pointInPolygon(p, poly));
  for (let d = 0; d < 360; d += 10) {
    const B = bords(CAT[4], d, { banNm: 0.8 });
    assert.deepEqual(banHorsEau(B, bloque), [], `vent du ${d}° : bouées en mer`);
    for (const p of [B.line.cb, B.line.pin]) assert.ok(!bloque(p), `vent du ${d}° : ligne en mer`);
  }
  // l’équipier règle 1,5 M par vent d’ouest : la bouée 1 tombe à terre, l’alerte la nomme
  assert.deepEqual(banHorsEau(bords(CAT[4], 280, { banNm: 1.5 }), bloque), ['1']);
});

test('buildLegs de chaque parcours depuis la ligne « Devant Le Lavandou » : bords non vides, dernier bord vers la ligne ; longueurs annoncées (1 : 7 à 9 M, 2 : 5,5 à 7 M, 6 : 18 à 22 M, 7 : 15 à 18 M)', () => {
  const c0 = xy(BORMES.LINE_PRESETS.lavandou.lat, BORMES.LINE_PRESETS.lavandou.lon);
  const nm = {};
  for (const c of BORMES.COURSES.filter((x) => !x.built)) {
    const B = bords(c);
    assert.equal(B.legs.length, c.seq.G.length + 1, `${c.id} : un bord par marque puis l’arrivée`);
    assert.equal(B.legs.at(-1).mark, 'FINISH');
    assert.ok(Math.hypot(B.legs.at(-1).to.x - c0.x, B.legs.at(-1).to.y - c0.y) < 10, `${c.id} : arrivée sur la ligne de départ`);
    assert.ok(B.legs.every((l) => l.dist > 100), `${c.id} : bords non vides`);
    nm[c.id] = nmB(B);
  }
  for (const [id, lo, hi] of [[1, 7, 9], [2, 5.5, 7], [6, 18, 22], [7, 15, 18], [51, 7, 9], [52, 5.5, 7], [56, 18, 22], [57, 15, 18]]) assert.ok(nm[id] >= lo && nm[id] <= hi, `parcours ${id} : ${nm[id].toFixed(2)} M`);
  assert.ok(nm[3] >= 4 && nm[3] <= 8, `parcours 3 : ${nm[3].toFixed(2)} M (4 à 8 M annoncés)`);
});

test('routage du tour de Port-Cros (parcours 6) par la passe des Grottes, hors du Levant militaire ; parcours 7 (coffre 1) hors de Brégançon ; chaque route jusqu’à sa marque', { skip: sansPack }, async () => {
  const t = await terrain(), F = await champ270B(), polys = zonesXY(BORMES.FORBIDDEN_ZONES, xy), grottes = xy(REP.grottes.lat, REP.grottes.lon);
  for (const id of [6, 7]) {
    for (const [i, l] of bords(CAT[id]).legs.entries()) {
      const r = route(l.from, l.to, F, { terrain: t, forbidden: polys, perf: 1 });
      assert.ok(r && r.path.length >= 2, `parcours ${id}, bord ${i + 1} : route trouvée`);
      const prof = horsZonesB(r.path, polys, `parcours ${id}, bord ${i + 1}`);
      assert.ok(prof < 25, `parcours ${id}, bord ${i + 1} : un pas rogne une zone de ${prof.toFixed(0)} m`);
      const fin = r.path.at(-1);
      assert.ok(Math.hypot(fin.x - l.to.x, fin.y - l.to.y) <= 40, `parcours ${id}, bord ${i + 1} : arrivée sur la marque`);
      if (id === 6 && l.mark === 'DAM') assert.ok(Math.min(...r.path.map((p) => Math.hypot(p.x - grottes.x, p.y - grottes.y))) < 0.6 * NM, 'La Fourmigue → La Dame par la passe des Grottes');
    }
  }
});

test('js/app.js : ligne propre au parcours quand la ligne par défaut du plan d’eau est gardée (Toulon : « vignettes » de la v42) ; classes du CVAT masquées à Bormes ; longueur annoncée', () => {
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  assert.equal((app.match(/S\.linePreset === \(VENUE\.lineDefaut \?\? 'vignettes'\)/g) || []).length, 2);
  assert.ok(!/S\.linePreset === 'vignettes'/.test(app));
  assert.match(app, /\$\{VENUE\.sansClasses \? '' : `<div><label class="f">Classes<\/label><select id="cCls">/);
  assert.match(app, /\$\{VENUE\.sansClasses \? '' : `\$\{S\.cls === 'P' \? 'P1–P2' : 'C–R3'\}, `\}\$\{dayName\(S\.day\)\}/);
  assert.match(app, /c\.annonce \? ` \(annoncée : \$\{esc\(c\.annonce\)\}\)`/);
  assert.match(app, /bormes: \{ courseId: 4, linePreset: 'lavandou'/);
  for (const v of [VENUES.toulon, VENUES.brest]) { assert.equal(v.lineDefaut, undefined); assert.equal(v.sansClasses, undefined); }
});
