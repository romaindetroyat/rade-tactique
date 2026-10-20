// FIAB-06 : l’app s’ouvre sur l’interface utile avant tout calcul lourd (gardes statiques sur le texte des sources : l’ouverture en
// deux temps est un ordre d’appels, la mesure réelle est faite par tools/measure-boot.mjs), et le téléchargement des prévisions abandonne à 10 s.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import { fetchAll, FETCH_TIMEOUT_MS } from '../js/weather.js';
import { Terrain } from '../js/geo.js';
import { WindField } from '../js/wind.js';

const src = (f) => readFileSync(ROOT + f, 'utf8');
const app = src('js/app.js');

test('js/app.js n’importe plus la 3D à l’évaluation : import différé de scene3d.js dans init()', () => {
  assert.ok(!/^import[^\n]*['"]\.\/scene3d\.js['"]/m.test(app), 'pas d’import statique de ./scene3d.js');
  assert.ok(!/^import[^\n]*\bScene3D\b/m.test(app), 'pas d’import statique de Scene3D');
  const init = bodyOf(app, 'init');
  assert.ok(init, 'init() trouvée');
  assert.match(init, /const \{ Scene3D \} = await import\('\.\/scene3d\.js'\)/);
  assert.equal((app.match(/import\('\.\/scene3d\.js'\)/g) || []).length, 1, 'un seul import différé');
});

test('init() : onglets, Départ, En course et marque rt:ui avant le terrain et la 3D, sans rien attendre avant', () => {
  const init = bodyOf(app, 'init');
  const at = (re) => { const i = init.search(re); assert.ok(i >= 0, 'absent de init() : ' + re); return i; };
  const ui = at(/performance\.mark\('rt:ui'\)/);
  const tard = Math.min(at(/new Terrain\(\)\.load\(/), at(/await import\('\.\/scene3d\.js'\)/));
  for (const re of [/bindShell\(\)/, /renderStart\(\)/, /renderLive\(\)/, /classList\.add\('gone'\)/]) assert.ok(at(re) < ui, `${re} avant la marque rt:ui`);
  assert.ok(ui < tard, 'la marque rt:ui précède le terrain et l’import de la 3D');
  assert.ok(!/\bawait\b/.test(init.slice(0, ui)), 'aucune attente avant l’interface utile (ni réseau, ni terrain, ni 3D)');
  assert.ok(!/\bnew Scene3D\(|\bF\s*=\s*new WindField/.test(init.slice(0, ui)), 'ni la 3D ni le champ de vent avant l’interface utile');
  assert.ok(at(/performance\.mark\('rt:map'\)/) > tard, 'rt:map après la carte');
});

test('bindUI est coupée en bindShell (sans carte) et bindMap (avec la 3D)', () => {
  const shell = bodyOf(app, 'bindShell'), map = bodyOf(app, 'bindMap');
  assert.ok(shell && map, 'les deux fonctions existent');
  assert.ok(!/\bscene\b/.test(shell), 'bindShell ne touche pas à la 3D');
  for (const id of ['#tabs', '#helpBtn', '#shareBtn']) assert.ok(shell.includes(id), id + ' dans bindShell');
  for (const id of ['#hour', '#srcSeg', '#refresh', '#mapBtns', '#compass', '#rhPlay']) assert.ok(map.includes(id), id + ' dans bindMap');
  assert.equal(bodyOf(app, 'bindUI'), null, 'plus de bindUI');
});

test('gardes : rien ne suppose la 3D ou le champ de vent avant leur création', () => {
  const gard = (name, re) => assert.match(bodyOf(app, name), re, `${name} : garde manquante`);
  gard('updateAll', /if \(!F \|\| !scene\) return/);
  gard('updateDisplayField', /if \(!F \|\| !scene\) return/);
  gard('runAnalysis', /if \(!F \|\| !scene\) return/);
  gard('refreshObs', /!data \|\| !F/);
  gard('onPick', /!F \|\| !fieldOn/);
  gard('stopGps', /scene\?\.setBoat\(null\)/);
  gard('refreshLive', /scene\?\.setStations/);
  gard('setSheet', /scene\?\.resize\(\)/);
  assert.match(app, /scene\?\.setBoat\(q, q\.cog\)/, 'rappel GPS');
  assert.match(app, /if \(!fieldOn\) return null;[^\n]*\n[^\n]*F\.sample/, 'windAt du mode départ : sans vent calculé, pas de F.sample');
});

test('index.html : le script du QR code est différé', () => {
  const html = src('index.html');
  const tag = /<script\b[^>]*vendor\/qrcode\.js[^>]*>/.exec(html);
  assert.ok(tag, 'script vendor/qrcode.js présent');
  assert.match(tag[0], /\bdefer\b/);
});

test('js/weather.js : getJSON utilise un AbortController (délai de 10 s)', () => {
  const w = src('js/weather.js'), body = bodyOf(w, 'getJSON');
  assert.match(body, /new AbortController\(\)/);
  assert.match(body, /signal:\s*ctl\.signal/);
  assert.match(body, /clearTimeout\(to\)/, 'minuterie levée dans tous les cas');
  assert.equal(FETCH_TIMEOUT_MS, 10000);
});

test('prévisions : un réseau muet est abandonné à 10 s avec un message en français (le repli habituel prend le relais)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ancien = globalThis.fetch;
  globalThis.fetch = (url, { signal } = {}) => new Promise((_, rej) => {
    signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  try {
    const p = fetchAll();
    const issue = p.then(() => null, (e) => e);
    await Promise.resolve();
    t.mock.timers.tick(FETCH_TIMEOUT_MS - 1);
    let fini = false; issue.then(() => { fini = true; });
    await new Promise((ok) => setImmediate(ok));
    assert.equal(fini, false, 'pas d’abandon avant 10 s');
    t.mock.timers.tick(1);
    const e = await issue;
    assert.ok(e instanceof Error);
    assert.match(e.message, /délai dépassé \(10 s\)/);
  } finally { globalThis.fetch = ancien; }
});

// ── FIAB-06 : le champ de vent est préparé par tranches, sans changer un seul nombre

let T;
before(async () => { T = await new Terrain().load('data/'); });
const seul = (dir) => ({ points: [{ x: 0, y: 0, dir, spd: 12, gust: 16 }] });
const memes = (a, b, msg) => { for (const k of ['fac', 'dev', 'shel', 'blk']) assert.deepEqual(Array.from(a[k]), Array.from(b[k]), `${msg} : ${k}`); };

test('kitSteps : générateur qui cède la main plus de 10 fois et range le même kit que kit()', () => {
  const F = new WindField(T), ref = new WindField(T);
  let cedes = 0, r;
  const g = F.kitSteps(315);
  while (!(r = g.next()).done) cedes++;
  assert.ok(cedes > 10, `cède la main ${cedes} fois`);
  assert.ok(F.kits.has(315), 'le kit est rangé dans le cache');
  assert.equal(r.value, F.kits.get(315), 'le générateur renvoie le kit rangé');
  memes(F.kits.get(315), ref.kit(315), 'kitSteps ≡ kit');
  assert.equal(F.kit(315), F.kits.get(315), 'kit() relit le cache');
});

test('warm : un seul point de vent à 312° prépare 310° et 315°, identiques à kit() sur un autre WindField', async () => {
  const F = new WindField(T), ref = new WindField(T);
  await F.warm(seul(312), 1000);
  for (const key of [310, 315]) { assert.ok(F.kits.has(key), `clé ${key} préparée`); memes(F.kits.get(key), ref.kit(key), `warm ≡ kit (${key}°)`); }
  F.compute(seul(312), { localEffects: 1 }); ref.compute(seul(312), { localEffects: 1 });
  assert.deepEqual(Array.from(F.spd), Array.from(ref.spd), 'compute après warm : mêmes vitesses');
  assert.deepEqual(Array.from(F.dir), Array.from(ref.dir), 'compute après warm : mêmes directions');
  assert.equal(F.kits.size, 2, 'aucun kit de plus calculé d’un bloc par compute()');
});

test('warm : une base à deux points (350° et 10°) couvre toutes les clés de 5°, passage par le Nord compris', async () => {
  const F = new WindField(T);
  const base = { points: [{ x: -2000, y: 0, dir: 350, spd: 10 }, { x: 2000, y: 0, dir: 10, spd: 12 }] };
  const keys = new Set(F.warmKeys(base));
  for (const k of [350, 355, 0, 5, 10]) assert.ok(keys.has(k), `warmKeys contient ${k}°`);
  for (const k of [20, 340, 180]) assert.ok(!keys.has(k), `warmKeys ne contient pas ${k}°`);
  await F.warm(base, 1000);
  for (const k of keys) assert.ok(F.kits.has(k), `clé ${k}° préparée par warm`);
  F.compute(base, { localEffects: 1 });
  assert.equal(F.kits.size, keys.size, 'compute() ne calcule plus aucun kit');
});

test('warm : une direction pile sur un multiple de 5° garde la clé du dessous (arrondi du calcul)', () => {
  const F = new WindField(T);
  const keys = new Set(F.warmKeys(seul(315)));
  for (const k of [310, 315, 320]) assert.ok(keys.has(k), `${k}°`);
});

// ── W4 : seuls les recalculs AUTOMATIQUES sont reportés ; un geste ou un relevé de l’équipier calcule tout de suite

const REPORT = /\b(?:heavyPaused|autoHeavy|deferHeavy)\(/;

test('W4 : aucun geste, aucun relevé ne passe par la pause (heavyPaused / autoHeavy / deferHeavy absents de leurs corps)', () => {
  for (const f of ['updateAll', 'updateDisplayField', 'scheduleAnalysis', 'runAnalysis', 'refreshObs', 'planRest', 'setLineEnd', 'renderObs', 'voiceObs', 'bindShell', 'bindMap', 'computeField', 'renderPlan', 'renderStart', 'renderCourse', 'renderWind']) {
    const body = bodyOf(app, f);
    assert.ok(body !== null, `${f} trouvée`);
    assert.ok(!REPORT.test(body), `${f} ne doit pas être reportée (geste de l’équipier)`);
  }
  const reanalyse = /reanalyse:[^\n]*/.exec(app);
  assert.ok(reanalyse, 'entrée reanalyse de l’api du mode départ');
  assert.ok(!REPORT.test(reanalyse[0]), 'un ping de ligne est un geste : la réanalyse n’est pas reportée');
});

test('W4 : autoHeavy( figure dans init et refreshWeather, nulle part ailleurs (liste fermée)', () => {
  assert.match(bodyOf(app, 'init'), /autoHeavy\(/, 'init');
  assert.match(bodyOf(app, 'refreshWeather'), /autoHeavy\(/, 'refreshWeather');
  const bornes = (name) => { const b = bodyOf(app, name), i = app.indexOf(b); return [i, i + b.length]; };
  const dedans = ['init', 'refreshWeather', 'autoHeavy'].map(bornes);
  const hors = [...app.matchAll(/\bautoHeavy\(/g)].filter((m) => !dedans.some(([a, z]) => m.index >= a && m.index <= z) && !/function autoHeavy\(/.test(app.slice(m.index - 9, m.index + 10)));
  assert.deepEqual(hors.map((m) => app.slice(0, m.index).split('\n').length), [], 'autoHeavy appelée hors de init et refreshWeather (lignes)');
  assert.ok(!REPORT.test(bodyOf(app, 'refreshLive')), 'refreshLive n’est pas un recalcul');
});

test('W4 : refreshWeather(true) au démarrage seulement ; le bouton ⟳ garde refreshWeather() (geste)', () => {
  assert.equal((app.match(/refreshWeather\(true\)/g) || []).length, 1, 'un seul appel automatique');
  assert.match(bodyOf(app, 'bindMap'), /refreshWeather\(\)/, '⟳ : sans argument');
  assert.match(app, /async function refreshWeather\(auto = false\)/);
});

test('W4 : deferHeavy range sans doublon, programme une seule minuterie après H+1 min et ne note qu’une fois', () => {
  const d = bodyOf(app, 'deferHeavy');
  assert.match(d, /heavyQ\.add\(/, 'file sans doublon');
  assert.match(d, /note\('calcul', 'reporté après le départ'\)/);
  assert.match(app, /HEAVY_AFTER_MS/, 'délai après H+1 min');
  const a = bodyOf(app, 'autoHeavy');
  assert.match(a, /heavyPaused\(\{ now: Date\.now\(\), timerEnd: timer\.end \}\)/);
});

// ── computeField mémoïsé : même base, même résultat, aucun recalcul ; toute entrée de la base fait partie de la clé

test('computeField mémoïsé : la clé couvre jour, heure, source, vent manuel, modèle, relevés, intensité du relief et prévisions', () => {
  const body = bodyOf(app, 'computeField');
  for (const piece of ['day', 'hour', 'S.src', 'S.manual', 'selectedModel()', 'S.nowcast', 'resid', 'S.localFx', 'data?.fetched', 'S.day']) assert.ok(body.includes(piece), `clé : ${piece}`);
  assert.match(body, /fieldKey/);
  assert.match(bodyOf(app, 'refreshObs'), /fieldKey = null/, 'refreshObs écrit dans F : la clé est remise à null');
  assert.match(bodyOf(app, 'runDebrief'), /fieldKey = null/, 'le débrief écrit dans F : la clé est remise à null');
});

test('init : le champ de vent est préparé (warm) avant le premier updateAll(), et par tranches', () => {
  const prep = bodyOf(app, 'prepareField');
  assert.ok(prep, 'prepareField trouvée');
  const i1 = prep.indexOf('F.warm(baseAt(S.day, S.hour))'), i2 = prep.indexOf('F.warm(baseAt(S.day, S.startTime))'), iu = prep.indexOf('updateAll()');
  assert.ok(i1 >= 0 && i2 > i1 && iu > i2, 'warm(hour) puis warm(startTime) puis updateAll()');
  assert.match(bodyOf(app, 'init'), /autoHeavy\(prepareField\)/);
});

// ── ARCH-01 (plan 04-02) : l’archive partagée n’alourdit jamais l’ouverture et ne circule jamais pendant une course

test('archive : js/archsync.js n’est chargé que par import() dynamique (un seul), jamais statiquement', () => {
  assert.ok(!/^import[^\n]*['"]\.\/archsync\.js['"]/m.test(app), 'pas d’import statique de ./archsync.js');
  assert.equal((app.match(/import\('\.\/archsync\.js'\)/g) || []).length, 1, 'un seul import dynamique');
  assert.match(bodyOf(app, 'syncNow'), /await import\('\.\/archsync\.js'\)/, 'chargé dans syncNow, à la première synchronisation');
  assert.match(app, /^import \{[^}]*\bstampState\b[^}]*\} from '\.\/archmerge\.js'/m, 'archmerge.js (petit) reste statique : saveReg en a besoin');
});

test('archive : dans init(), ni syncNow( ni /api/archive avant la marque rt:map ; la première synchronisation vient 3 s après la carte', () => {
  const init = bodyOf(app, 'init'), map = init.indexOf("performance.mark('rt:map')");
  assert.ok(map > 0, 'marque rt:map trouvée');
  assert.ok(!/syncNow\(|\/api\/archive|archsync/.test(init.slice(0, map)), 'rien de l’archive avant rt:map');
  assert.ok(!init.includes('/api/archive'), 'init() ne cite jamais /api/archive');
  assert.match(init.slice(map), /setTimeout\(\(\) => syncNow\('ouverture'\), 3000\)/, 'ouverture : rt:map + 3 s');
  assert.ok(!/\bawait\b[^\n]*(syncNow|archsync|syncFetch)/.test(init), 'init() n’attend jamais l’archive');
});

test('archive : saveReg marque les modifications (stampState, markDirty) hors fromSync, jamais pour la réponse du serveur', () => {
  const body = bodyOf(app, 'saveReg');
  assert.match(app, /function saveReg\(next, \{ fromSync = false \} = \{\}\)/);
  const garde = body.indexOf('if (!fromSync)');
  assert.ok(garde >= 0, 'marquage sous if (!fromSync)');
  const iS = body.indexOf('stampState('), iM = body.indexOf('markDirty('), iR = body.indexOf('REG = next');
  assert.ok(garde < iS && iS < iM && iM < iR, 'stampState puis markDirty, avant REG = next');
  assert.match(body, /scheduleSync\(20000\)/, 'envoi 20 s après une modification');
  assert.match(bodyOf(app, 'syncDeps'), /saveReg\(st, \{ fromSync: true \}\)/, 'la réponse du serveur ne passe pas par le marquage');
});

test('archive : raceTick abandonne l’échange en cours et programme la synchronisation une minute après la fin de la course', () => {
  const body = bodyOf(app, 'raceTick');
  assert.match(body, /syncCtl\?\.abort\(\)/, 'échange abandonné');
  assert.match(body, /wasRaceActive && !active\) scheduleSync\(60000\)/, 'fin de course : +60 s');
  assert.match(bodyOf(app, 'syncNow'), /raceActive\(Date\.now\(\)\)/, 'syncNow refuse pendant une course');
  assert.match(bodyOf(app, 'syncDeps'), /isActive: \(\) => raceActive\(Date\.now\(\)\)/, 'runSync reçoit le même verrou');
  assert.match(bodyOf(app, 'syncDeps'), /canApply: \(\) => !icBusy\(\) && !markEdit/, 'réponse jetée pendant une saisie');
});

test('archive : les déclencheurs réseau relancent la synchronisation (online, sonde, retour au premier plan)', () => {
  assert.match(app, /addEventListener\('online', \(\) => \{[^\n]*scheduleSync\(2000\)/);
  assert.match(bodyOf(app, 'probeNet'), /if \(net\.online\) scheduleSync\(2000\)/);
  assert.match(app, /document\.hidden[\s\S]{0,200}scheduleSync\(2000\)/);
});
