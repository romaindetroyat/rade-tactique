// Pack physique de la rade de Bormes – Le Lavandou (08-03, D-10) : relief, fonds, couverture et côte construits par les outils du dépôt
// avec tools/venues/bormes.json, lus par Terrain.load('data/bormes.'). Le plan d’eau n’est pas encore au registre (08-04) : l’origine de
// projection de Bormes est posée ici à la main, puis celle de Toulon est rétablie. Ce fichier tourne dans son propre processus (node --test).
// Valeurs de contrôle : étude du plan d’eau (08-RESEARCH-PLAN-EAU.md § 1.3, § 1.4, § 3.4, § 3.5, § 6.5).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './helpers/setup.mjs';
import { setOrigin, ORIGIN, Terrain, toXY } from '../js/geo.js';
import { WindField } from '../js/wind.js';
import { listShell } from '../tools/stamp.mjs';

const TOULON = { ...ORIGIN };
setOrigin({ lat: 43.10, lon: 6.40 });
after(() => setOrigin(TOULON));

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
