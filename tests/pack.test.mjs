// D-04 : pack de la rade de Brest téléchargé à la demande, vérifié fichier par fichier (taille et SHA-256) contre data/venues.json,
// écrit tout ou rien dans un cache dédié rade-venue-brest-<pack> ; l’ancien cache du même plan d’eau n’est supprimé qu’après un succès.
// Faux caches (Map par nom), faux réseau qui sert les vrais fichiers du dépôt, vrai crypto.subtle de Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { PACK_PREFIX, packStatus, downloadPack, fmtMo, packEntry, packCache, prunePacks } from '../js/pack.js';

const MAN = JSON.parse(readFileSync(ROOT + 'data/venues.json', 'utf8'));
const BREST = MAN.venues.brest;
const NOM = PACK_PREFIX + 'brest-' + BREST.pack;
const subtle = globalThis.crypto.subtle;

function fauxCaches() {
  const m = new Map();                     // nom → Map(chemin → { body, type })
  const key = (r) => String(typeof r === 'string' ? r : r.url).split('?')[0];
  const cache = (c) => ({
    match: async (r) => { const e = c.get(key(r)); return e ? new Response(e.body, { headers: { 'content-type': e.type } }) : undefined; },
    put: async (r, res) => { c.set(key(r), { body: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') }); },
    keys: async () => [...c.keys()],
  });
  return {
    m,
    caches: {
      open: async (n) => { if (!m.has(n)) m.set(n, new Map()); return cache(m.get(n)); },
      keys: async () => [...m.keys()],
      delete: async (n) => m.delete(n),
      has: async (n) => m.has(n),
    },
  };
}
// Réseau : les fichiers du dépôt ; `altere(chemin, octets)` modifie la réponse d’un fichier ; `statut` force un code
function fauxReseau({ altere = null, statut = null, hors = false } = {}) {
  const vus = [];
  const fetch = async (u, o) => {
    vus.push({ u, o });
    if (hors) throw new TypeError('Failed to fetch');
    const chemin = u.split('?')[0];
    const s = statut?.(chemin) ?? 200;
    if (s !== 200) return new Response('introuvable', { status: s });
    let b = new Uint8Array(readFileSync(ROOT + chemin));
    if (altere) b = altere(chemin, b) ?? b;
    return new Response(b, { status: 200 });
  };
  return { fetch, vus };
}
// Pose un ancien pack complet (contenu quelconque) sous un autre nom de cache
async function ancienPack(c, nom = PACK_PREFIX + 'brest-0000000000') {
  const k = await c.caches.open(nom);
  for (const f of BREST.files) await k.put(f.path, new Response('ancien', { headers: { 'content-type': 'text/plain' } }));
  return nom;
}

test('fmtMo, packCache, packEntry : tailles en Mo à la française, nom du cache, manifeste contrôlé', () => {
  assert.equal(fmtMo(3652390), '3,7 Mo');
  assert.equal(fmtMo(4900000), '4,9 Mo');
  assert.equal(fmtMo(0), '0,0 Mo');
  assert.equal(packCache('brest', 'abc1234567'), 'rade-venue-brest-abc1234567');
  assert.ok(packEntry(MAN, 'brest'), 'manifeste du dépôt accepté');
  assert.equal(packEntry(MAN, 'toulon'), null, 'Toulon n’a pas de pack (il est dans le cache de l’app)');
  assert.equal(packEntry(MAN, '__proto__'), null);
  assert.equal(packEntry(null, 'brest'), null);
  const piege = structuredClone(MAN); piege.venues.brest.files[0].path = '../middleware.js';
  assert.equal(packEntry(piege, 'brest'), null, 'chemin hors data/brest.* refusé');
  const autre = structuredClone(MAN); autre.venues.brest.files[0].path = 'data/meta.json';
  assert.equal(packEntry(autre, 'brest'), null, 'un fichier de Toulon ne peut pas entrer dans le pack de Brest');
});

test('téléchargement complet : chaque fichier vérifié, écrit sous son chemin canonique avec son type → état « ready »', async () => {
  const c = fauxCaches(), net = fauxReseau();
  assert.equal((await packStatus(MAN, 'brest', c)).state, 'absent');
  const prog = [];
  const r = await downloadPack(MAN, 'brest', { fetch: net.fetch, caches: c.caches, subtle, onProgress: (d, t) => prog.push([d, t]) });
  assert.deepEqual(r, { ok: true, bytes: BREST.bytes, cache: NOM });
  assert.equal(net.vus.length, BREST.files.length);
  for (const v of net.vus) {
    assert.match(v.u, new RegExp(`^data/brest\\.[a-z.-]+\\?pack=${BREST.pack}$`), 'paramètre ?pack= (le worker laisse passer au réseau)');
    assert.equal(v.o.cache, 'no-store');
  }
  assert.deepEqual(prog.at(-1), [BREST.bytes, BREST.bytes]);
  const k = c.m.get(NOM);
  assert.deepEqual([...k.keys()].sort(), BREST.files.map((f) => f.path).sort(), 'chemins sans paramètre');
  assert.equal(k.get('data/brest.terrain.bin').type, 'application/octet-stream');
  assert.equal(k.get('data/brest.basemap.jpg').type, 'image/jpeg');
  assert.equal(k.get('data/brest.meta.json').type, 'application/json');
  assert.equal(k.get('data/brest.terrain.bin').body.byteLength, 1681128);
  const st = await packStatus(MAN, 'brest', c);
  assert.equal(st.state, 'ready'); assert.equal(st.cache, NOM); assert.equal(st.bytes, BREST.bytes);
});

test('un octet changé dans un fichier : erreur, aucun cache écrit, ancien cache intact', async () => {
  const c = fauxCaches();
  const vieux = await ancienPack(c);
  const net = fauxReseau({ altere: (p, b) => { if (p === 'data/brest.cover.bin') { const x = b.slice(); x[1000] ^= 1; return x; } return null; } });
  await assert.rejects(downloadPack(MAN, 'brest', { fetch: net.fetch, caches: c.caches, subtle }), /fichier altéré ou incomplet : data\/brest\.cover\.bin/);
  assert.deepEqual([...c.m.keys()], [vieux], 'aucun nouveau cache, l’ancien est gardé');
  assert.equal(c.m.get(vieux).size, BREST.files.length, 'ancien cache intact');
  assert.equal((await packStatus(MAN, 'brest', c)).state, 'stale');
});

test('fichier tronqué (taille fausse), 404, réseau coupé : erreur en français, rien d’écrit', async () => {
  for (const [net, re] of [
    [fauxReseau({ altere: (p, b) => (p === 'data/brest.terrain.bin' ? b.slice(0, b.length - 10) : null) }), /fichier altéré ou incomplet : data\/brest\.terrain\.bin/],
    [fauxReseau({ statut: (p) => (p === 'data/brest.seamask.png' ? 404 : 200) }), /fichier altéré ou incomplet : data\/brest\.seamask\.png/],
    [fauxReseau({ hors: true }), /pas de réseau/],
  ]) {
    const c = fauxCaches();
    await assert.rejects(downloadPack(MAN, 'brest', { fetch: net.fetch, caches: c.caches, subtle }), re);
    assert.equal(c.m.size, 0, 'aucun cache créé');
    assert.equal((await packStatus(MAN, 'brest', c)).state, 'absent');
  }
});

test('sans crypto.subtle ni caches : refus, jamais d’écriture non vérifiée', async () => {
  const c = fauxCaches(), net = fauxReseau();
  await assert.rejects(downloadPack(MAN, 'brest', { fetch: net.fetch, caches: c.caches, subtle: undefined }), /vérification impossible sur cet appareil/);
  await assert.rejects(downloadPack(MAN, 'brest', { fetch: net.fetch, caches: undefined, subtle }), /stockage hors réseau indisponible/);
  assert.equal(net.vus.length, 0, 'rien téléchargé');
  assert.equal(c.m.size, 0);
  assert.equal((await packStatus(MAN, 'brest', {})).state, 'absent', 'sans Cache API : absent, sans exception');
});

test('ancien pack : « stale », puis supprimé après un nouveau succès seulement ; un autre plan d’eau n’est jamais touché', async () => {
  const c = fauxCaches();
  const vieux = await ancienPack(c);
  await c.caches.open(PACK_PREFIX + 'ouessant-1111111111');
  const st = await packStatus(MAN, 'brest', c);
  assert.equal(st.state, 'stale'); assert.equal(st.cache, vieux);
  await downloadPack(MAN, 'brest', { fetch: fauxReseau().fetch, caches: c.caches, subtle });
  assert.deepEqual([...c.m.keys()].sort(), [PACK_PREFIX + 'ouessant-1111111111', NOM].sort());
  assert.equal((await packStatus(MAN, 'brest', c)).state, 'ready');
});

test('ancien jeu incomplet (sans la côte) : « absent » ; cache du pack actuel partiel : pas « ready »', async () => {
  const c = fauxCaches();
  const k = await c.caches.open(PACK_PREFIX + 'brest-2222222222');
  for (const s of ['meta.json', 'terrain.bin', 'cover.bin']) await k.put(`data/brest.${s}`, new Response('x'));
  assert.equal((await packStatus(MAN, 'brest', c)).state, 'absent');
  const n = await c.caches.open(NOM);
  for (const f of BREST.files.slice(1)) await n.put(f.path, new Response('x'));
  const st = await packStatus(MAN, 'brest', c);
  assert.notEqual(st.state, 'ready', 'un fichier manque au cache du pack actuel');
});

test('écriture refusée (mémoire pleine) : le cache partiel est retiré, l’ancien gardé', async () => {
  const c = fauxCaches();
  const vieux = await ancienPack(c);
  const open = c.caches.open;
  c.caches.open = async (n) => { const x = await open(n); if (n === NOM) { let i = 0; const put = x.put; x.put = async (r, res) => { if (++i > 2) throw new DOMException('quota', 'QuotaExceededError'); return put(r, res); }; } return x; };
  await assert.rejects(downloadPack(MAN, 'brest', { fetch: fauxReseau().fetch, caches: c.caches, subtle }), /mémoire du téléphone pleine/);
  assert.deepEqual([...c.m.keys()], [vieux]);
  assert.equal((await packStatus(MAN, 'brest', c)).state, 'stale');
});

test('prunePacks : retire les autres caches du même plan d’eau, garde celui donné et les autres plans d’eau', async () => {
  const c = fauxCaches();
  await ancienPack(c);
  await c.caches.open(NOM);
  await c.caches.open('rade-db2f520fdc');
  assert.equal(await prunePacks('brest', NOM, c), 1);
  assert.deepEqual([...c.m.keys()].sort(), [NOM, 'rade-db2f520fdc'].sort());
});
