// FIAB-01 : le service worker n’active jamais une nouvelle version tout seul et sert l’app depuis son cache.
// Le vrai sw.js est exécuté dans node:vm avec un faux self, de faux caches et un faux réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ROOT } from './helpers/setup.mjs';
import { BUILD } from '../js/version.js';

const ORIGIN = 'https://rade.test';
const CODE = readFileSync(ROOT + 'sw.js', 'utf8');

// Request qui résout les URL relatives (new Request('./') échoue tel quel sous Node)
class Req {
  constructor(input, init = {}) {
    this.url = new URL(typeof input === 'string' ? input : input.url, ORIGIN + '/').href;
    this.method = init.method || input.method || 'GET';
    this.cache = init.cache || 'default';
  }
}

function monde() {
  const listeners = {};
  const caches = new Map();                       // nom → Map(url → texte)
  const calls = { skipWaiting: 0, claim: 0, network: [] };
  const net = { reply: (url) => 'reseau:' + url, offline: false };
  const key = (r) => new URL(typeof r === 'string' ? r : r.url, ORIGIN + '/').href;
  const look = (m, r, o) => {
    const k = key(r);
    if (m.has(k)) return m.get(k);
    if (o?.ignoreSearch) { const base = k.split('?')[0]; for (const [u, t] of m) if (u.split('?')[0] === base) return t; }
    return undefined;
  };
  const cache = (m) => ({
    addAll: async (reqs) => { for (const r of reqs) m.set(key(r), 'cache:' + key(r)); },
    match: async (r, o) => { const t = look(m, r, o); return t === undefined ? undefined : new Response(t); },
    put: async (r, res) => { m.set(key(r), await res.text()); },
  });
  const fakeCaches = {
    open: async (n) => { if (!caches.has(n)) caches.set(n, new Map()); return cache(caches.get(n)); },
    keys: async () => [...caches.keys()],
    delete: async (n) => caches.delete(n),
    match: async (r, o) => { for (const m of caches.values()) { const t = look(m, r, o); if (t !== undefined) return new Response(t); } return undefined; },
  };
  const self = {
    addEventListener: (t, f) => { listeners[t] = f; },
    skipWaiting: () => { calls.skipWaiting++; return Promise.resolve(); },
    clients: { claim: () => { calls.claim++; return Promise.resolve(); } },
  };
  const fetch = async (r) => {
    const url = key(r);
    calls.network.push(url);
    if (net.offline) throw new TypeError('hors ligne');
    return new Response(net.reply(url));
  };
  vm.runInNewContext(CODE, { self, location: { origin: ORIGIN }, caches: fakeCaches, Request: Req, Response, URL, fetch });

  const attendre = async (type) => { const p = []; listeners[type]({ waitUntil: (x) => p.push(x) }); await Promise.all(p); };
  const requete = (url, init) => {
    let promesse = null;
    listeners.fetch({ request: new Req(url, init), respondWith: (p) => { promesse = Promise.resolve(p); } });
    return promesse;                                // null : le worker n’intercepte pas
  };
  const message = (data) => { const recus = []; listeners.message({ data, source: { postMessage: (m) => recus.push(m) } }); return recus; };
  return { caches, calls, net, attendre, requete, message };
}

test('installation : précache toute la liste sans s’activer elle-même', async () => {
  const w = monde();
  await w.attendre('install');
  assert.ok(w.caches.get('rade-' + BUILD.id).size > 30, 'plus de 30 fichiers précachés');
  assert.equal(w.calls.skipWaiting, 0, 'aucun skipWaiting à l’installation');
});

test('GET_BUILD répond la version du worker, SKIP_WAITING l’active une seule fois', () => {
  const w = monde();
  const r = w.message({ type: 'GET_BUILD' });
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'BUILD');
  assert.match(r[0].build.label, /^v\d+ · \d\d\/\d\d$/);
  assert.equal(r[0].build.id, BUILD.id, 'même identifiant que js/version.js');
  assert.equal(w.calls.skipWaiting, 0, 'GET_BUILD n’active rien');
  w.message({ type: 'SKIP_WAITING' });
  assert.equal(w.calls.skipWaiting, 1);
  w.message({ type: 'AUTRE' });
  assert.equal(w.calls.skipWaiting, 1, 'un message inconnu n’active rien');
});

test('activation : supprime les anciens caches et réclame les pages', async () => {
  const w = monde();
  await w.attendre('install');
  w.caches.set('rade-ancien', new Map([['x', 'y']]));
  await w.attendre('activate');
  assert.deepEqual([...w.caches.keys()], ['rade-' + BUILD.id]);
  assert.equal(w.calls.claim, 1);
});

test('/api/ et le lien personnel ?acces= ne sont pas interceptés', async () => {
  const w = monde();
  await w.attendre('install');
  assert.equal(w.requete('/api/voice'), null);
  assert.equal(w.requete('/?acces=quelquechose'), null);
  assert.equal(w.requete('/js/app.js', { method: 'POST' }), null);
  assert.equal(w.requete('https://autre.example/js/app.js'), null);
});

test('les fichiers de l’app viennent du cache, même si le réseau répondrait autre chose', async () => {
  const w = monde();
  await w.attendre('install');
  w.net.reply = () => 'NOUVELLE VERSION';
  const avant = w.calls.network.length;
  for (const u of ['/js/app.js', '/js/app.js?v=3', '/', '/index.html', '/styles.css']) {
    const res = await w.requete(u);
    assert.match(await res.text(), /^cache:/, u + ' servi depuis le cache');
  }
  assert.equal(w.calls.network.length, avant, 'aucun appel réseau pour l’app');
});

test('hors réseau, un fichier de l’app reste servi', async () => {
  const w = monde();
  await w.attendre('install');
  w.net.offline = true;
  const res = await w.requete('/js/geo.js');
  assert.match(await res.text(), /^cache:/);
});

test('le reste (rapports) passe par le réseau, avec index.html en secours hors ligne', async () => {
  const w = monde();
  await w.attendre('install');
  const res = await w.requete('/rapports/coupe-snpm-2026.html');
  assert.equal(await res.text(), 'reseau:' + ORIGIN + '/rapports/coupe-snpm-2026.html');
  w.net.offline = true;
  const inconnu = await w.requete('/rapports/autre.html');
  assert.match(await inconnu.text(), /^cache:.*index\.html$/);
});

// FIAB-05 : la lampe RÉSEAU ne peut pas mentir. Un GET d’un fichier de l’app est servi par le cache (200 hors réseau) ;
// la sonde de js/app.js est un HEAD de même origine que le worker ne traite pas : elle part vraiment sur le réseau.
test('sonde réseau : HEAD /icons/favicon-32.png n’est pas intercepté (alors que le GET est servi par le cache)', async () => {
  const w = monde();
  await w.attendre('install');
  assert.equal(w.requete('/icons/favicon-32.png?p=1', { method: 'HEAD' }), null, 'le worker ne répond pas à la place du réseau');
  w.net.offline = true;
  const get = await w.requete('/icons/favicon-32.png');
  assert.match(await get.text(), /^cache:/, 'contre-épreuve : le GET, lui, mentirait « réseau ok »');
});

test('sonde réseau : GET /api/_ping n’est pas intercepté', async () => {
  const w = monde();
  await w.attendre('install');
  assert.equal(w.requete('/api/_ping'), null);
});

test('garde : la sonde de js/app.js est ce HEAD, avec abandon à 4 s et sans cache', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /fetch\('icons\/favicon-32\.png\?p=' \+ Date\.now\(\), \{ method: 'HEAD', cache: 'no-store'/);
  assert.match(app, /setTimeout\(\(\) => c\.abort\(\), 4000\)/);
});

// D-04 : plans d’eau téléchargés (js/pack.js) dans des caches rade-venue-<id>-<pack>. Le worker les épargne à l’activation, sert leurs fichiers
// (data/<id>.* hors liste) depuis ces caches, hors réseau compris, et ne les copie jamais dans le cache de version.
const PACK = 'rade-venue-brest-abc1234567';
const U = (p) => ORIGIN + p;
const avecPack = async () => {
  const w = monde();
  await w.attendre('install');
  w.caches.set(PACK, new Map([[U('/data/brest.terrain.bin'), 'pack:terrain'], [U('/data/brest.meta.json'), 'pack:meta']]));
  return w;
};
const partout = (w, url) => [...w.caches.entries()].filter(([, m]) => [...m.keys()].some((k) => k.split('?')[0] === url)).map(([n]) => n);

test('activation : l’ancien cache de version et un cache inconnu partent, les caches rade-venue-* restent', async () => {
  const w = await avecPack();
  w.caches.set('rade-ancien', new Map([['x', 'y']]));
  w.caches.set('autre-cache', new Map([['x', 'y']]));
  w.caches.set('rade-venue-brest-0000000000', new Map());
  await w.attendre('activate');
  assert.deepEqual([...w.caches.keys()].sort(), ['rade-' + BUILD.id, PACK, 'rade-venue-brest-0000000000'].sort());
  assert.equal(w.caches.get(PACK).size, 2, 'pack intact');
  assert.equal(w.calls.claim, 1);
});

test('fichier du pack : servi depuis son cache, en ligne (sans réseau) comme hors réseau, paramètre ignoré', async () => {
  const w = await avecPack();
  w.net.reply = () => 'RESEAU';
  const avant = w.calls.network.length;
  assert.equal(await (await w.requete('/data/brest.terrain.bin')).text(), 'pack:terrain');
  assert.equal(await (await w.requete('/data/brest.meta.json?v=2')).text(), 'pack:meta');
  assert.equal(w.calls.network.length, avant, 'aucun appel réseau');
  w.net.offline = true;
  assert.equal(await (await w.requete('/data/brest.terrain.bin')).text(), 'pack:terrain', 'hors réseau');
});

test('fichier du pack absent de tout cache : en ligne, le réseau sans copie ; hors réseau, l’échec tel quel (jamais index.html)', async () => {
  const w = await avecPack();
  const res = await w.requete('/data/brest.basemap.jpg');
  assert.equal(await res.text(), 'reseau:' + U('/data/brest.basemap.jpg'));
  await new Promise((ok) => setTimeout(ok, 10));                       // une copie éventuelle (non attendue par le worker) aurait eu lieu
  assert.deepEqual(partout(w, U('/data/brest.basemap.jpg')), [], 'copié dans aucun cache');
  w.net.offline = true;
  await assert.rejects(w.requete('/data/brest.wx-snapshot.json'), /hors ligne/, 'échec réseau rendu, pas la page de l’app');
});

test('téléchargement du pack (?pack=) : jamais intercepté, même si le cache a le fichier ; aucun cache ne change', async () => {
  const w = await avecPack();
  const avant = JSON.stringify([...w.caches.entries()].map(([n, m]) => [n, [...m.keys()]]));
  assert.equal(w.requete('/data/brest.terrain.bin?pack=abc1234567'), null, 'au réseau, sans le worker');
  assert.equal(w.requete('/data/brest.cover.bin?pack=abc1234567'), null);
  assert.equal(JSON.stringify([...w.caches.entries()].map(([n, m]) => [n, [...m.keys()]])), avant);
});

test('seuls les caches du même plan d’eau servent ses fichiers ; un fichier du pack n’entre jamais dans le cache de version', async () => {
  const w = monde();
  await w.attendre('install');
  w.caches.set('rade-venue-ouessant-1111111111', new Map([[U('/data/brest.coast.json'), 'MAUVAIS']]));
  assert.equal(await (await w.requete('/data/brest.coast.json')).text(), 'reseau:' + U('/data/brest.coast.json'));
  for (const p of ['/data/brest.terrain.bin', '/data/brest.coast.json', '/data/brest.meta.json']) await w.requete(p);
  await new Promise((ok) => setTimeout(ok, 10));
  assert.ok(![...w.caches.get('rade-' + BUILD.id).keys()].some((k) => /\/data\/brest\./.test(k)), 'aucun data/brest.* dans le cache de version');
});

test('comportement v42 gardé : data/meta.json (Toulon, dans la liste) par le cache de version, un rapport réseau d’abord avec copie dans la version', async () => {
  const w = await avecPack();
  w.net.reply = () => 'NOUVEAU';
  const avant = w.calls.network.length;
  assert.match(await (await w.requete('/data/meta.json')).text(), /^cache:.*\/data\/meta\.json$/);
  assert.match(await (await w.requete('/data/venues.json')).text(), /^cache:/);
  assert.equal(w.calls.network.length, avant, 'Toulon : aucun appel réseau');
  assert.equal(await (await w.requete('/rapports/x.html')).text(), 'NOUVEAU');
  await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(w.caches.get('rade-' + BUILD.id).get(U('/rapports/x.html')), 'NOUVEAU', 'rapport copié dans le cache de version');
  assert.equal(w.requete('/api/archive'), null);
  assert.equal(w.requete('/data/brest.terrain.bin?acces=x'), null, 'lien personnel jamais intercepté');
});

test('garde : le préfixe des caches de plan d’eau est le même dans sw.js et js/pack.js', async () => {
  const { PACK_PREFIX } = await import('../js/pack.js');
  assert.equal(PACK_PREFIX, 'rade-venue-');
  assert.match(CODE, /const VENUE_PREFIX = 'rade-venue-';/);
  assert.ok(!/stamp:begin[\s\S]*rade-venue-[\s\S]*stamp:end/.test(CODE), 'jamais dans le bloc généré');
});
