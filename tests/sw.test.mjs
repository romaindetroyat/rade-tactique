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
