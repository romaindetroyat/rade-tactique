// FIAB-06 : l’app s’ouvre sur l’interface utile avant tout calcul lourd (gardes statiques sur le texte des sources : l’ouverture en
// deux temps est un ordre d’appels, la mesure réelle est faite par tools/measure-boot.mjs), et le téléchargement des prévisions abandonne à 10 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import { fetchAll, FETCH_TIMEOUT_MS } from '../js/weather.js';

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

