// Cloisonnement des espaces (phase 8, D-02 à D-05) : le code décide de l’espace, jamais la page ; l’archive de chaque espace est un arbre à part.
// Le middleware est construit par `creerMiddleware` avec des tables d’empreintes calculées ICI à partir de faux codes (code-naos-test,
// code-tofinou-test, code-double-test) : aucun vrai code, aucune empreinte écrite. Les tables réelles de middleware.js sont lues sans jamais
// afficher une empreinte (les assertions ne portent que sur des booléens et des prénoms).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { creerMiddleware, ESPACES, manifestePour } from '../middleware.js';
import { ESPACE_IDS, espaceDe, prefixe, POLITIQUE, IA_ESPACES } from '../api/_espace.js';
import { createHandler } from '../api/archive.js';
import { emptyDoc } from '../js/archmerge.js';
import { createFakeBlob, invoke } from './helpers/fakeblob.mjs';
import { tableEquipage } from './helpers/codesimule.mjs';
import * as app from '../js/espaces.js';

const empreinte = (code) => createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
const DOUBLE = 'code-double-test', NAOS = 'code-naos-test', TOFI = 'code-tofinou-test', INCONNU = 'code-inconnu-test';
// Mêmes hôtes et mêmes packs que le vrai middleware ; seules les tables sont fausses
const espacesDeTest = () => ({
  naos: { ...ESPACES.naos, table: { [empreinte(NAOS)]: 'Teiva', [empreinte(DOUBLE)]: 'Romain' } },
  tofinou: { ...ESPACES.tofinou, table: { [empreinte(TOFI)]: 'Frédéric', [empreinte(DOUBLE)]: 'Romain' } },
});
const mw = creerMiddleware({ espaces: espacesDeTest() });
const H_NAOS = 'https://rade-tactique.vercel.app', H_TOFI = 'https://tofinou-bormes.vercel.app', H_APERCU = 'https://rade-tactique-git-apercu-x.vercel.app';
const appel = (url, headers = {}, method = 'GET') => mw(new Request(url, { method, headers, ...(method === 'GET' ? {} : { body: '{}' }) }));
const cookie = (code) => ({ cookie: `rt_acces=${code}` });
const transmis = (r, nom) => r.headers.get(`x-middleware-request-${nom}`);
// Réponse réduite à ce qu’un visiteur peut observer
async function forme(r) {
  const h = r.headers;
  return { status: r.status, location: h.get('location'), setCookie: h.get('set-cookie'), cache: h.get('cache-control'), type: h.get('content-type'),
    next: h.get('x-middleware-next'), overrides: h.get('x-middleware-override-headers'), corps: r.body ? await r.text() : '' };
}
async function avecEnv(valeur, fn) {
  const avant = process.env.VERCEL_ENV;
  if (valeur === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = valeur;
  try { return await fn(); } finally { if (avant === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = avant; }
}

// ───────────────────────── middleware

test('T1 : code Tofinou → x-rt-espace « tofinou » et prénom de la table, même si la page envoie x-rt-espace: naos et x-rt-membre: Usurpateur', async () => {
  for (const hote of [H_TOFI, H_APERCU, 'http://tofinou.localhost:8080']) {
    for (const chemin of ['/api/archive?k=light', '/api/rules', '/api/ic']) {
      for (const forge of [{}, { 'x-rt-espace': 'naos', 'x-rt-membre': 'Usurpateur' }, { 'x-rt-espace': 'NAOS' }, { 'x-rt-espace': 'naos, tofinou' }]) {
        const r = await appel(hote + chemin, { ...cookie(TOFI), ...forge, 'content-type': 'application/json' }, 'PUT');
        assert.equal(r.headers.get('x-middleware-next'), '1', `${hote}${chemin} transmis`);
        assert.equal(transmis(r, 'x-rt-espace'), 'tofinou', `${hote}${chemin} ${JSON.stringify(forge)}`);
        assert.equal(decodeURIComponent(transmis(r, 'x-rt-membre')), 'Frédéric');
        const liste = (r.headers.get('x-middleware-override-headers') || '').split(',');
        assert.ok(liste.includes('x-rt-espace') && liste.includes('x-rt-membre') && !liste.includes('cookie'));
      }
    }
  }
  // et l’inverse : un code Naos qui forge « tofinou » reste Naos
  for (const hote of [H_NAOS, H_APERCU, 'http://127.0.0.1:8080', 'http://localhost:8080']) {
    const r = await appel(hote + '/api/archive?k=light', { ...cookie(NAOS), 'x-rt-espace': 'tofinou', 'x-rt-membre': 'Usurpateur' });
    assert.equal(transmis(r, 'x-rt-espace'), 'naos', hote);
    assert.equal(decodeURIComponent(transmis(r, 'x-rt-membre')), 'Teiva');
  }
});

test('T2 : code d’un espace sur l’hôte d’un autre espace → exactement la réponse d’un code inconnu, aucun cookie posé', async () => {
  const cas = [[TOFI, H_NAOS], [TOFI, 'http://127.0.0.1:8080'], [TOFI, 'http://localhost:8080'], [NAOS, H_TOFI], [NAOS, 'http://tofinou.localhost:8080']];
  const requetes = [['/api/archive?k=light', {}], ['/index.html', {}], ['/index.html', { accept: 'text/html', 'sec-fetch-mode': 'navigate' }], ['/api/membre', {}], ['/data/meta.json', {}]];
  for (const [code, hote] of cas) {
    for (const [chemin, h] of requetes) {
      // cookie
      const a = await forme(await appel(hote + chemin, { ...cookie(code), ...h })), b = await forme(await appel(hote + chemin, { ...cookie(INCONNU), ...h }));
      assert.deepEqual(a, b, `cookie ${code === TOFI ? 'Tofinou' : 'Naos'} sur ${hote}${chemin}`);
      assert.equal(a.setCookie, null); assert.equal(a.next, null); assert.ok([401, 302].includes(a.status));
      // lien ?acces=
      const sep = chemin.includes('?') ? '&' : '?';
      const l1 = await forme(await appel(hote + chemin + sep + 'acces=' + code, h)), l2 = await forme(await appel(hote + chemin + sep + 'acces=' + INCONNU, h));
      assert.deepEqual(l1, l2, `lien ${code === TOFI ? 'Tofinou' : 'Naos'} sur ${hote}${chemin}`);
      assert.equal(l1.setCookie, null);
      assert.ok(l1.location.startsWith('/acces.html?erreur=1'));
    }
  }
  // sur son propre hôte, le même lien pose le cookie
  const ok = await appel(H_TOFI + '/?acces=' + TOFI);
  assert.equal(ok.status, 302);
  assert.ok((ok.headers.get('set-cookie') || '').startsWith(`rt_acces=${TOFI};`));
});

test('membre de deux espaces : espace de l’hôte connu, premier espace sur un hôte inconnu, /api/membre donne les deux', async () => {
  const attendu = [[H_NAOS, 'naos'], [H_TOFI, 'tofinou'], [H_APERCU, 'naos'], ['http://tofinou.localhost:8080', 'tofinou'], ['http://localhost:8080', 'naos']];
  for (const [hote, espace] of attendu) {
    const r = await appel(hote + '/api/archive?k=light', { ...cookie(DOUBLE), 'x-rt-espace': espace === 'naos' ? 'tofinou' : 'naos' });
    assert.equal(transmis(r, 'x-rt-espace'), espace, hote);
    assert.equal(decodeURIComponent(transmis(r, 'x-rt-membre')), 'Romain');
    const m = await appel(hote + '/api/membre', cookie(DOUBLE));
    assert.equal(m.status, 200);
    assert.equal(m.headers.get('cache-control'), 'no-store');
    assert.equal(m.headers.get('x-middleware-next'), null);
    assert.deepEqual(await m.json(), { membre: 'Romain', espace, espaces: ['naos', 'tofinou'] });
  }
  const t = await appel(H_TOFI + '/api/membre', cookie(TOFI));
  assert.deepEqual(await t.json(), { membre: 'Frédéric', espace: 'tofinou', espaces: ['tofinou'] });
  const n = await appel(H_APERCU + '/api/membre', cookie(NAOS));
  assert.deepEqual(await n.json(), { membre: 'Teiva', espace: 'naos', espaces: ['naos'] });
});

test('le reste du site ne reçoit aucun en-tête posé, quel que soit l’espace', async () => {
  for (const [hote, code] of [[H_TOFI, TOFI], [H_NAOS, NAOS], [H_APERCU, DOUBLE]]) {
    const r = await appel(hote + '/index.html', { ...cookie(code), 'x-rt-espace': 'naos' });
    assert.equal(r.headers.get('x-middleware-next'), '1');
    assert.equal(r.headers.get('x-middleware-override-headers'), null);
  }
});

// ───────────────────────── archive

// ───────────────────────── manifeste par espace (D-07)

test('manifeste par hôte : Naos (avec, sans code, code inconnu) → transmis tel quel ; Tofinou → réécrit vers son manifeste ; hôte inconnu → Naos ; rien d’autre réécrit', async () => {
  const sansRien = (f) => { assert.equal(f.setCookie, null); assert.equal(f.location, null); assert.equal(f.overrides, null); };
  for (const hote of [H_NAOS, 'http://127.0.0.1:8080', 'http://localhost:8080', H_APERCU, 'https://inconnu.example']) {
    for (const h of [{}, cookie(NAOS), cookie(INCONNU), cookie(TOFI), cookie(DOUBLE), { accept: 'text/html', 'sec-fetch-mode': 'navigate' }]) {
      const r = await appel(hote + '/manifest.webmanifest', h);
      const f = await forme(r);
      assert.equal(f.status, 200, hote); assert.equal(f.next, '1', `${hote} ${JSON.stringify(h)} : transmis`);
      assert.equal(r.headers.get('x-middleware-rewrite'), null, `${hote} : jamais réécrit`);
      sansRien(f);
    }
  }
  for (const hote of [H_TOFI, 'http://tofinou.localhost:8080', 'https://TOFINOU-BORMES.vercel.app']) {
    for (const h of [{}, cookie(TOFI), cookie(NAOS), cookie(INCONNU), cookie(DOUBLE)]) {
      for (const method of ['GET', 'HEAD']) {
        const r = await mw(new Request(hote + '/manifest.webmanifest', { method, headers: h }));
        const dest = new URL(r.headers.get('x-middleware-rewrite') || 'http://vide/');
        assert.equal(dest.pathname, '/manifest-tofinou.webmanifest', `${hote} ${method} ${JSON.stringify(h)}`);
        assert.equal(dest.host, new URL(hote).host, 'même hôte');
        assert.equal(r.headers.get('x-middleware-next'), null);
        sansRien(await forme(r));
      }
      // le manifeste de l’espace, demandé directement sur son hôte (réécriture réévaluée), est servi lui aussi sans code
      const direct = await forme(await appel(hote + '/manifest-tofinou.webmanifest', h));
      assert.equal(direct.next, '1'); sansRien(direct);
    }
  }
  // ailleurs, le manifeste de Tofinou suit la règle de toute adresse de l’app : code exigé (comme un fichier inconnu de la v43 sur l’hôte de Naos)
  for (const hote of [H_NAOS, H_APERCU]) {
    assert.equal((await appel(hote + '/manifest-tofinou.webmanifest')).status, 401, hote);
    assert.equal((await appel(hote + '/manifest-tofinou.webmanifest', cookie(INCONNU))).status, 401, hote);
  }
  assert.equal((await appel(H_NAOS + '/manifest-tofinou.webmanifest', cookie(NAOS))).headers.get('x-middleware-next'), '1', 'liste hors réseau servie avec le code');
  // aucun autre chemin n’est réécrit, sur aucun hôte
  for (const hote of [H_TOFI, H_NAOS, H_APERCU]) {
    for (const chemin of ['/', '/index.html', '/acces.html', '/js/app.js', '/api/membre', '/Manifest.webmanifest', '/manifest.webmanifest.old', '/js/manifest.webmanifest']) {
      for (const h of [{}, cookie(TOFI), cookie(NAOS)]) {
        assert.equal((await appel(hote + chemin, h)).headers.get('x-middleware-rewrite'), null, `${hote}${chemin}`);
      }
    }
  }
  assert.equal((await appel(H_TOFI + '/manifest.webmanifest', {}, 'POST')).status, 401, 'autre méthode : déroulé ordinaire');
});

test('manifestePour : hôtes de Tofinou seulement (casse ignorée), sinon null ; le manifeste de Tofinou existe et nomme l’espace', () => {
  for (const h of ESPACES.tofinou.hotes) { assert.equal(manifestePour(h), '/manifest-tofinou.webmanifest', h); assert.equal(manifestePour(h.toUpperCase()), '/manifest-tofinou.webmanifest'); }
  for (const h of [...ESPACES.naos.hotes, 'rade-tactique-git-x.vercel.app', '', undefined, null, 'tofinou-bormes.vercel.app.evil.example', 'x.tofinou.localhost']) assert.equal(manifestePour(h), null, String(h));
  const m = JSON.parse(readFileSync(ROOT + 'manifest-tofinou.webmanifest', 'utf8')), n = JSON.parse(readFileSync(ROOT + 'manifest.webmanifest', 'utf8'));
  assert.equal(m.name, 'Tofinou — Bormes'); assert.equal(m.short_name, 'Tofinou Bormes'); assert.equal(m.lang, 'fr');
  assert.match(m.description, /Bormes – Le Lavandou/); assert.doesNotMatch(JSON.stringify(m), /Toulon|CVAT|J80|Naos/);
  for (const k of ['start_url', 'scope', 'display', 'orientation', 'background_color', 'theme_color', 'icons', 'lang']) assert.deepEqual(m[k], n[k], `${k} identique à Naos`);
  assert.deepEqual(Object.keys(m), Object.keys(n), 'même forme');
});

test('T3 : archive sans x-rt-espace valide (absent, inconnu, __proto__, autre casse, liste) → 403 espace_inconnu, rien lu ni écrit', async () => {
  const blob = createFakeBlob(), handler = createHandler({ blob, now: () => 2_000_000 });
  const valeurs = [undefined, '', 'inconnu', '__proto__', 'constructor', 'toString', 'Naos', 'NAOS', 'Tofinou', ' naos', 'naos ', 'naos, tofinou', ['naos'], 'prod', 'preview'];
  for (const v of valeurs) {
    for (const [method, url, body] of [['GET', '/api/archive?k=light'], ['PUT', '/api/archive?k=light', { doc: emptyDoc() }], ['GET', '/api/archive?k=trace&id=tr1'],
      ['PUT', '/api/archive?k=trace&id=tr1', { id: 'tr1', pts: [[1, 2, 3], [4, 5, 6]] }], ['GET', '/api/archive?k=day&r=rgA&d=2026-11-07&by=romain']]) {
      const headers = { 'x-rt-membre': 'Romain', ...(v === undefined ? {} : { 'x-rt-espace': v }) };
      const r = await invoke(handler, { method, url, body, headers });
      assert.equal(r.status, 403, `${method} ${url} avec ${JSON.stringify(v)}`);
      assert.deepEqual(r.body, { error: 'espace_inconnu' });
      assert.equal(r.headers['cache-control'], 'no-store');
    }
  }
  assert.equal(blob.ops.log.length, 0, 'aucune lecture ni écriture du magasin');
  for (const v of valeurs) assert.equal(espaceDe(v), null, JSON.stringify(v));
  assert.equal(espaceDe('naos'), 'naos'); assert.equal(espaceDe('tofinou'), 'tofinou');
});

const regate = (over = {}) => ({ id: 'rgA', name: 'Coupe test', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-09', season: 2026, ic: null,
  races: [], marks: [], courses: [], traces: [], frozen: {}, tomb: {}, hist: [], at: 1000, u: 1000, ...over });
const trace = (id) => ({ id, name: 'Trace', pts: [[1000, 43.07, 5.93, 5, 90, 5], [2000, 43.0701, 5.93, 5, 90, 5]] });

test('T5 : un magasin rempli par Naos est invisible pour Tofinou (léger vide, trace, rapport, jour → 404), aucun chemin hors de tofinou/ touché', async () => {
  for (const env of [undefined, 'production']) {
    await avecEnv(env, async () => {
      const P = env === 'production' ? 'prod' : 'preview';
      const blob = createFakeBlob(), handler = createHandler({ blob, now: () => 2_000_000 });
      const naos = (method, url, body) => invoke(handler, { method, url, body, headers: { 'x-rt-membre': 'Romain', 'x-rt-espace': 'naos' } });
      const tofi = (method, url, body) => invoke(handler, { method, url, body, headers: { 'x-rt-membre': 'Romain', 'x-rt-espace': 'tofinou' } });
      assert.equal((await naos('PUT', '/api/archive?k=light', { doc: { v: 1, regattas: { rgA: regate(), 'snpm-2026': regate({ id: 'snpm-2026' }) }, tomb: {}, marks: { 7: { lat: 43.07, lon: 5.93, t: 1500 } } } })).status, 200);
      assert.equal((await naos('PUT', '/api/archive?k=trace&id=tr1', trace('tr1'))).status, 200);
      assert.equal((await naos('PUT', '/api/archive?k=report&id=tr1&t=123', { html: '<p>x</p>', t: 123, name: 'R' })).status, 200);
      assert.equal((await naos('PUT', '/api/archive?k=day&r=rgA&d=2026-11-07', { wx: { dir: 260 } })).status, 200);
      for (const p of [`${P}/light.json`, `${P}/trace/tr1.json`, `${P}/report/tr1-123.json`, `${P}/day/rgA/2026-11-07/romain.json`]) assert.ok(blob.store.has(p), `Naos : ${p}`);
      const avant = new Map([...blob.store].map(([k, v]) => [k, v.text]));
      const n = blob.ops.log.length;

      const lu = await tofi('GET', '/api/archive?k=light');
      assert.equal(lu.status, 200);
      assert.deepEqual(lu.body, { rev: null, doc: emptyDoc(), env: P }, 'Tofinou : document vide, env inchangé');
      for (const url of ['/api/archive?k=trace&id=tr1', '/api/archive?k=report&id=tr1&t=123', '/api/archive?k=day&r=rgA&d=2026-11-07&by=romain',
        '/api/archive?k=trace&id=..%2Fprod%2Ftrace%2Ftr1', '/api/archive?k=trace&id=..']) {
        const r = await tofi('GET', url);
        assert.ok([404, 400].includes(r.status), `${url} : ${r.status}`);
        if (!url.includes('..')) assert.equal(r.status, 404, url);
      }
      assert.equal((await tofi('PUT', '/api/archive?k=trace&id=trT', trace('trT'))).status, 200);
      assert.equal((await tofi('PUT', '/api/archive?k=trace&id=tr1', trace('tr1'))).body.ok, true, 'même identifiant que Naos : écrit à part, pas « déjà en ligne »');
      const ops = blob.ops.log.slice(n);
      assert.ok(ops.length > 0);
      assert.deepEqual(ops.filter((o) => !o.path.startsWith(`tofinou/${P}/`)).map((o) => o.path), [], 'chemins hors de tofinou/ touchés par Tofinou');
      for (const [k, v] of avant) assert.equal(blob.store.get(k)?.text, v, `objet de Naos modifié : ${k}`);
      assert.ok(blob.store.has(`tofinou/${P}/trace/trT.json`) && blob.store.has(`tofinou/${P}/trace/tr1.json`));
      // et l’inverse : Naos ne voit pas la trace de Tofinou
      const m = blob.ops.log.length;
      assert.equal((await naos('GET', '/api/archive?k=trace&id=trT')).status, 404);
      assert.ok(blob.ops.log.slice(m).every((o) => !o.path.startsWith('tofinou/')));
    });
  }
});

test('bout à bout : l’en-tête x-rt-espace du vrai déroulé du middleware range l’écriture de Tofinou sous tofinou/ et celle de Naos sous preview/', async () => {
  const blob = createFakeBlob(), handler = createHandler({ blob, now: () => 2_000_000 });
  await avecEnv(undefined, async () => {
    for (const [hote, code, attendu] of [[H_TOFI, TOFI, 'tofinou/preview/trace/trX.json'], [H_NAOS, NAOS, 'preview/trace/trY.json']]) {
      const id = attendu.match(/(tr[XY])/)[1];
      const r = await appel(`${hote}/api/archive?k=trace&id=${id}`, { ...cookie(code), 'x-rt-espace': 'naos', 'content-type': 'application/json' }, 'PUT');
      const w = await invoke(handler, { method: 'PUT', url: `/api/archive?k=trace&id=${id}`, body: trace(id), headers: { 'x-rt-membre': transmis(r, 'x-rt-membre'), 'x-rt-espace': transmis(r, 'x-rt-espace') } });
      assert.equal(w.status, 200);
      assert.ok(blob.store.has(attendu), attendu);
    }
  });
});

// ───────────────────────── parité et tables réelles (sans jamais afficher une empreinte)

test('parité : ESPACE_IDS = espaces du middleware ; préfixes de Naos inchangés ; politique et IA par espace', async () => {
  assert.deepEqual([...ESPACE_IDS], Object.keys(ESPACES));
  assert.deepEqual(Object.keys(POLITIQUE), [...ESPACE_IDS]);
  for (const id of ESPACE_IDS) assert.ok(Array.isArray(ESPACES[id].hotes) && ESPACES[id].hotes.length && Array.isArray(ESPACES[id].packs), id);
  // un hôte n’appartient qu’à un espace ; un pack n’appartient qu’à un espace
  const hotes = ESPACE_IDS.flatMap((id) => ESPACES[id].hotes), packs = ESPACE_IDS.flatMap((id) => ESPACES[id].packs);
  assert.equal(new Set(hotes).size, hotes.length); assert.equal(new Set(packs).size, packs.length);
  assert.deepEqual(ESPACES.naos.hotes, ['rade-tactique.vercel.app', '127.0.0.1', 'localhost']);
  assert.deepEqual(ESPACES.tofinou.hotes, ['tofinou-bormes.vercel.app', 'tofinou.localhost']);
  await avecEnv(undefined, () => { assert.equal(prefixe('naos'), 'preview'); assert.equal(prefixe('tofinou'), 'tofinou/preview'); });
  await avecEnv('production', () => { assert.equal(prefixe('naos'), 'prod'); assert.equal(prefixe('tofinou'), 'tofinou/prod'); });
  assert.deepEqual([...POLITIQUE.naos.venues], ['toulon', 'brest']);
  assert.deepEqual([...IA_ESPACES], ['naos', 'tofinou']);         // 08-09 : IA de Tofinou ouverte avec ses consignes (api/_tofinou.js)
});

test('tables réelles : EQUIPAGE en premier, prénoms uniques par table, une empreinte commune porte le même prénom (aucune empreinte affichée)', () => {
  const lignes = tableEquipage();
  assert.ok(lignes.length >= 1);
  assert.ok(Object.hasOwn(ESPACES.naos.table, lignes[0].hex), 'la première ligne du fichier est une ligne de Naos (faux code des tests)');
  assert.equal(ESPACES.naos.table[lignes[0].hex], 'Romain', 'la première ligne de Naos reste celle de Romain');
  const NAME = /^[\p{L}\p{M} '’-]{1,40}$/u;
  const nombre = ESPACE_IDS.reduce((s, id) => s + Object.keys(ESPACES[id].table).length, 0);
  assert.equal(lignes.length, nombre, 'chaque ligne d’empreinte du fichier est dans une table d’espace');
  for (const id of ESPACE_IDS) {
    const prenoms = Object.values(ESPACES[id].table);
    assert.equal(new Set(prenoms).size, prenoms.length, `${id} : un prénom en double`);
    for (const p of prenoms) assert.ok(NAME.test(p), `${id} : prénom invalide ${p}`);
    for (const hex of Object.keys(ESPACES[id].table)) assert.ok(/^[0-9a-f]{64}$/.test(hex), `${id} : une clé n’est pas une empreinte`);
  }
  for (const a of ESPACE_IDS) for (const b of ESPACE_IDS) {
    if (a >= b) continue;
    for (const [hex, p] of Object.entries(ESPACES[a].table)) {
      if (Object.hasOwn(ESPACES[b].table, hex)) assert.ok(ESPACES[b].table[hex] === p, `empreinte commune à ${a} et ${b} avec deux prénoms (${p})`);
    }
  }
  assert.deepEqual(Object.values(ESPACES.naos.table), ['Romain', 'Teiva', 'Thibaud'], 'Naos : trois membres, inchangés');
});

// ───────────────────────── packs par espace (D-05) : T10

import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { listShell } from '../tools/stamp.mjs';

test('T10 : pack d’un autre espace → même 404 sans écho qu’un fichier interne ; toute la liste hors réseau (Toulon compris) reste servie à chaque espace', async () => {
  const interne = await forme(await appel(H_TOFI + '/middleware.js', cookie(TOFI)));
  assert.equal(interne.status, 404);
  for (const [hote, code, chemins] of [
    [H_TOFI, TOFI, ['/data/brest.meta.json', '/data/brest.terrain.bin', '/data/brest.cover.bin', '/data/BREST.meta.json', '/data/brest.inconnu']],
    [H_APERCU, TOFI, ['/data/brest.meta.json']],
    [H_NAOS, NAOS, ['/data/bormes.meta.json', '/data/bormes.terrain.bin', '/data/Bormes.meta.json']],
    [H_APERCU, NAOS, ['/data/bormes.meta.json']],
  ]) {
    for (const chemin of chemins) {
      for (const h of [cookie(code), { ...cookie(code), accept: 'text/html' }]) {
        const r = await appel(hote + chemin, h), f = await forme(r);
        const ref = await forme(await appel(hote + '/middleware.js', h));
        assert.deepEqual(f, ref, `${hote}${chemin} : réponse différente d’un fichier interne`);
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.ok(!f.corps.includes('brest') && !f.corps.includes('bormes'), 'sans écho');
      }
    }
  }
  // la liste hors réseau complète, à chaque espace (sw.js l’installe en entier : un seul refus casserait l’installation)
  const shell = listShell(ROOT).map((f) => (f === './' ? '/' : '/' + f));
  assert.ok(shell.includes('/data/terrain.bin') && shell.includes('/data/meta.json'), 'fichiers de Toulon dans la liste');
  for (const [hote, code] of [[H_TOFI, TOFI], [H_NAOS, NAOS], [H_APERCU, DOUBLE], ['http://tofinou.localhost:8080', DOUBLE]]) {
    for (const chemin of shell) {
      const r = await appel(hote + chemin, cookie(code));
      // sur un hôte de Tofinou, le manifeste est servi par réécriture (D-07)
      const reecrit = chemin === '/manifest.webmanifest' && r.headers.get('x-middleware-rewrite');
      assert.ok(r.headers.get('x-middleware-next') === '1' || reecrit, `${hote}${chemin} doit rester servi`);
    }
  }
  // les packs de son espace restent servis : Brest à Naos (manifeste des plans d’eau)
  const packs = Object.values(JSON.parse(readFileSync(ROOT + 'data/venues.json', 'utf8')).venues).flatMap((v) => v.files.map((f) => '/' + f.path));
  assert.ok(packs.some((p) => p.startsWith('/data/brest.')));
  for (const p of packs.filter((x) => x.startsWith('/data/brest.'))) assert.equal((await appel(H_NAOS + p, cookie(NAOS))).headers.get('x-middleware-next'), '1', p);
  // Tofinou sur un hôte d’aperçu partagé par un membre double : espace Naos (premier), donc Brest servi, Bormes refusé
  assert.equal((await appel(H_APERCU + '/data/brest.meta.json', cookie(DOUBLE))).headers.get('x-middleware-next'), '1');
  assert.equal((await appel(H_TOFI + '/data/brest.meta.json', cookie(DOUBLE))).status, 404);
});

test('accès de l’espace Tofinou : exactement Frédéric et Romain ; Romain avec la même empreinte que dans Naos ; Frédéric dans aucune autre table (rien affiché)', () => {
  const t = ESPACES.tofinou.table, n = ESPACES.naos.table;
  assert.deepEqual(Object.values(t).sort(), ['Frédéric', 'Romain']);
  const romain = Object.keys(t).find((h) => t[h] === 'Romain'), frederic = Object.keys(t).find((h) => t[h] === 'Frédéric');
  assert.ok(Object.hasOwn(n, romain) && n[romain] === 'Romain', 'Romain : même ligne que dans Naos');
  assert.ok(tableEquipage()[0].hex === romain, 'la ligne de Romain dans Naos reste la première du fichier');
  assert.ok(!Object.hasOwn(n, frederic), 'Frédéric n’a pas accès à Naos');
  assert.ok(ESPACE_IDS.filter((id) => Object.hasOwn(ESPACES[id].table, frederic)).join() === 'tofinou', 'Frédéric : espace Tofinou seulement');
  for (const p of ['Teiva', 'Thibaud']) assert.ok(!Object.values(t).includes(p), `${p} reste Naos seulement`);
});

// ───────────────────────── registre de l’app (js/espaces.js, 08-04)

test('parité app ↔ middleware ↔ fonctions : mêmes identifiants, mêmes hôtes, même pack par espace, plans d’eau et graines réservées de la politique serveur', () => {
  assert.deepEqual([...app.ESPACE_IDS], Object.keys(ESPACES), 'identifiants : js/espaces.js = middleware.js');
  assert.deepEqual([...app.ESPACE_IDS], [...ESPACE_IDS], 'identifiants : js/espaces.js = api/_espace.js');
  for (const id of ESPACE_IDS) {
    assert.deepEqual([...app.ESPACES[id].hotes], [...ESPACES[id].hotes], `hôtes de ${id}`);
    assert.deepEqual([app.ESPACES[id].pack], [...ESPACES[id].packs], `pack de ${id}`);
    assert.deepEqual([...app.ESPACES[id].venues], [...POLITIQUE[id].venues], `plans d’eau de ${id} = politique de l’archive`);
    assert.ok(app.ESPACES[id].venues.includes(app.ESPACES[id].venueDefaut), `plan d’eau par défaut de ${id} ouvert`);
    assert.equal(app.ESPACES[id].recalage, POLITIQUE[id].recalage, `recalage de ${id}`);
    assert.equal(app.ESPACES[id].id, id);
    // aucun membre dans le registre public
    assert.ok(!('table' in app.ESPACES[id]) && !('membres' in app.ESPACES[id]), `aucun membre dans js/espaces.js (${id})`);
  }
  // graines de Naos = identifiants réservés hors de Naos
  assert.deepEqual([...POLITIQUE.tofinou.reserves], [...app.ESPACES.naos.graines]);
  // graine de Tofinou (08-08) : le Challenge de la Baie, jamais un identifiant de Naos ; Naos ne réserve rien (politique de la v43)
  assert.deepEqual([...app.ESPACES.tofinou.graines], ['baie-2026-2027']);
  assert.ok(!app.ESPACES.tofinou.graines.some((g) => app.ESPACES.naos.graines.includes(g)));
  assert.deepEqual([...POLITIQUE.naos.reserves], []);
  // table hôte → espace
  for (const id of ESPACE_IDS) for (const h of ESPACES[id].hotes) assert.equal(app.HOTES[h], id, h);
  assert.equal(Object.keys(app.HOTES).length, ESPACE_IDS.reduce((n, id) => n + ESPACES[id].hotes.length, 0));
  // plafonds : Naos ceux des modules (null), Tofinou la moitié
  assert.equal(app.ESPACES.naos.caps, null);
  assert.deepEqual(app.ESPACES.tofinou.caps, { archive: { w: 20, r: 75 }, lourd: { up: 10, down: 20 } });
  assert.ok(Object.isFrozen(app.ESPACES) && Object.isFrozen(app.ESPACES.tofinou) && Object.isFrozen(app.ESPACES.tofinou.venues));
});

test('js/espaces.js public : aucune empreinte (64 hexadécimaux) ni prénom de membre', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/espaces.js', import.meta.url), 'utf8');
  assert.ok(!/[0-9a-f]{64}/i.test(src), 'aucune empreinte');
  for (const p of ['Romain', 'Frédéric', 'Teiva', 'Thibaud']) assert.ok(!src.includes(p), 'aucun prénom');
});

// Faux stockage qui relève les écritures
const stockage = (init = {}) => {
  const m = new Map(Object.entries(init)), ecrits = [];
  return { ecrits, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { ecrits.push(k); m.set(k, String(v)); }, removeItem: (k) => { ecrits.push('-' + k); m.delete(k); } };
};

test('bootEspace : hôte connu → son espace (la clé est ignorée) ; hôte inconnu → rade.espace.v1 si elle nomme un espace autre que Naos ; sinon Naos ; aucune écriture', () => {
  const K = app.ESPACE_KEY;
  assert.equal(K, 'rade.espace.v1');
  const T = () => stockage({ [K]: 'tofinou' });
  assert.equal(app.bootEspace('rade-tactique.vercel.app', T()), 'naos', 'hôte de Naos : la clé ne compte pas');
  assert.equal(app.bootEspace('127.0.0.1', T()), 'naos');
  assert.equal(app.bootEspace('localhost', stockage()), 'naos');
  assert.equal(app.bootEspace('tofinou-bormes.vercel.app', stockage()), 'tofinou');
  assert.equal(app.bootEspace('tofinou.localhost', stockage({ [K]: 'naos' })), 'tofinou');
  assert.equal(app.bootEspace('TOFINOU-BORMES.vercel.app', stockage()), 'tofinou', 'casse de l’hôte sans effet');
  const apercu = 'rade-tactique-git-apercu-phase-08-x.vercel.app';
  assert.equal(app.bootEspace(apercu, T()), 'tofinou', 'aperçu : clé Tofinou');
  for (const v of [null, 'naos', '__proto__', 'constructor', 'Tofinou', 'TOFINOU', ' tofinou', '"tofinou"', 'inconnu', '']) {
    assert.equal(app.bootEspace(apercu, stockage(v == null ? {} : { [K]: v })), 'naos', `clé ${JSON.stringify(v)}`);
  }
  assert.equal(app.bootEspace(apercu, null), 'naos', 'sans stockage');
  assert.equal(app.bootEspace(apercu, { getItem: () => { throw new Error('refusé'); } }), 'naos', 'stockage illisible');
  for (const h of [undefined, null, 3, {}, '__proto__', 'hasOwnProperty']) assert.equal(app.bootEspace(h, stockage()), 'naos', String(h));
  const s = stockage({ [K]: 'tofinou' });
  for (const h of ['rade-tactique.vercel.app', apercu, 'tofinou.localhost']) app.bootEspace(h, s);
  assert.deepEqual(s.ecrits, [], 'bootEspace ne fait que lire');
  assert.equal(app.espaceDeLHote(apercu), null);
  assert.equal(app.espaceDeLHote('__proto__'), null);
});

test('setEspace : Naos par défaut (export vivant), une seule fois par session, valeur inconnue → Naos', () => {
  assert.equal(app.ESPACE, app.ESPACES.naos);
  assert.equal(app.setEspace('naos'), app.ESPACES.naos, 'même espace : rien ne change');
  assert.equal(app.setEspace('__proto__'), app.ESPACES.naos);
  assert.equal(app.setEspace('tofinou'), app.ESPACES.tofinou);
  assert.equal(app.ESPACE, app.ESPACES.tofinou, 'export vivant');
  assert.throws(() => app.setEspace('naos'), /rechargement/);
  assert.equal(app.ESPACE.id, 'tofinou');
});
