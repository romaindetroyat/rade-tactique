// api/archive.js (ARCH-01, D-01, D-04) : la VRAIE fonction, appelée par des « téléphones » simulés sur un faux Blob au contrat du SDK 2.8.0
// (tests/helpers/fakeblob.mjs) : aucun réseau, aucun jeton. Vérifié : auteur posé par le serveur depuis l’en-tête du middleware, fusion sans
// perte ni doublon, préfixe d’environnement, accès toujours privé, magasin jamais énuméré, aucune écriture quand rien ne change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/archive.js';
import { createFakeBlob, invoke } from './helpers/fakeblob.mjs';

const T = 2_000_000;                                           // « maintenant » du serveur ; les dates `u` des tests sont toutes antérieures
const regatta = (over = {}) => ({
  id: 'rgA', name: 'Coupe test', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-09', season: 2026, ic: null,
  races: [], marks: [], courses: [], traces: [], frozen: {}, tomb: {}, hist: [], at: 1000, u: 1000, ...over,
});
const manche = (date, time, over = {}) => ({ id: `m${date.replace(/-/g, '')}${time.replace(':', '')}`, date, time, courseId: 3, cls: 'J80', laps: 2, note: '', u: 1500, ...over });
const doc = (...rs) => ({ v: 1, regattas: Object.fromEntries(rs.map((r) => [r.id, r])), tomb: {}, marks: {} });

// Un téléphone : appelle le gestionnaire avec le prénom que poserait le middleware (encodé, comme en production)
function installe(opts = {}) {
  const blob = createFakeBlob(opts.blob), handler = createHandler({ blob, now: () => T });
  const phone = (nom) => (method, url, body, headers = {}) => invoke(handler, { method, url, body, headers: { 'x-rt-membre': encodeURIComponent(nom), ...headers } });
  return { blob, handler, romain: phone('Romain'), teiva: phone('Teiva'), thibaud: phone('Thibaud') };
}
const PUT = '/api/archive?k=light', GET = '/api/archive?k=light';
async function avecEnv(valeur, fn) {
  const avant = process.env.VERCEL_ENV;
  if (valeur === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = valeur;
  try { return await fn(); } finally { if (avant === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = avant; }
}

test('un équipier envoie une régate : le serveur la signe de son prénom, jamais de celui du corps', async () => {
  const { teiva } = installe();
  const r = await teiva('PUT', PUT, { doc: doc(regatta({ by: 'Usurpateur', ub: 'Usurpateur', races: [manche('2026-11-07', '10:55', { by: 'Usurpateur', ub: 'Usurpateur' })] })) });
  assert.equal(r.status, 200);
  assert.equal(r.body.changed, true);
  assert.equal(r.body.env, 'preview');
  assert.ok(r.body.rev, 'un etag est rendu');
  const g = r.body.doc.regattas.rgA;
  assert.equal(g.by, 'Teiva'); assert.equal(g.ub, 'Teiva');
  assert.equal(g.races.length, 1);
  assert.equal(g.races[0].by, 'Teiva'); assert.equal(g.races[0].ub, 'Teiva');
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(r.body), /Usurpateur/);
});

test('un autre équipier relit la même régate avec l’auteur d’origine ; rev à jour → rien à renvoyer', async () => {
  const { teiva, thibaud } = installe();
  const mis = await teiva('PUT', PUT, { doc: doc(regatta({ races: [manche('2026-11-07', '10:55')] })) });
  const lu = await thibaud('GET', GET);
  assert.equal(lu.status, 200);
  assert.equal(lu.body.rev, mis.body.rev);
  assert.equal(lu.body.doc.regattas.rgA.by, 'Teiva');
  assert.equal(lu.body.doc.regattas.rgA.races[0].by, 'Teiva');
  const jour = await thibaud('GET', `${GET}&rev=${encodeURIComponent(lu.body.rev)}`);
  assert.equal(jour.status, 200);
  assert.equal(jour.body.unchanged, true);
  assert.equal(jour.body.rev, lu.body.rev);
  assert.equal(jour.body.doc, undefined, 'aucun document dans la réponse conditionnelle');
  const vieux = await thibaud('GET', `${GET}&rev=${encodeURIComponent('"autre"')}`);
  assert.ok(vieux.body.doc?.regattas?.rgA, 'un rev périmé redonne le document');
});

test('Romain et Thibaud complètent la même régate chacun de leur côté : les deux manches, une seule fois, chacune signée par son auteur', async () => {
  const { romain, teiva, thibaud } = installe();
  const base = regatta({ races: [manche('2026-11-07', '10:55')] });
  await teiva('PUT', PUT, { doc: doc(base) });
  const ajoutR = manche('2026-11-08', '11:30', { u: 1600 }), ajoutT = manche('2026-11-09', '12:00', { u: 1700 });
  await romain('PUT', PUT, { doc: doc({ ...base, races: [...base.races, ajoutR] }) });
  const fin = await thibaud('PUT', PUT, { doc: doc({ ...base, races: [...base.races, ajoutT] }) });
  assert.equal(fin.status, 200);
  const courses = fin.body.doc.regattas.rgA.races;
  assert.deepEqual(courses.map((m) => m.id), [ajoutR.id, ajoutT.id, 'm202611071055'].sort());
  assert.equal(courses.find((m) => m.id === ajoutR.id).by, 'Romain');
  assert.equal(courses.find((m) => m.id === ajoutT.id).by, 'Thibaud');
  assert.equal(courses.find((m) => m.id === 'm202611071055').by, 'Teiva');
  // renvoyer l’état d’un téléphone en retard, deux fois, ne duplique rien
  for (let i = 0; i < 2; i++) {
    const again = await romain('PUT', PUT, { doc: doc({ ...base, races: [...base.races, ajoutR] }) });
    assert.equal(again.body.doc.regattas.rgA.races.length, 3);
  }
});

test('renvoyer exactement le même document : changed false et aucune écriture', async () => {
  const { blob, teiva } = installe();
  const corps = { doc: doc(regatta({ races: [manche('2026-11-07', '10:55')] })) };
  const un = await teiva('PUT', PUT, corps);
  assert.equal(un.body.changed, true);
  const ecritures = blob.ops.put;
  const deux = await teiva('PUT', PUT, corps);
  assert.equal(deux.status, 200);
  assert.equal(deux.body.changed, false);
  assert.equal(deux.body.rev, un.body.rev);
  assert.equal(blob.ops.put, ecritures, 'le faux Blob n’a reçu aucune écriture de plus');
  const vide = installe();
  const rien = await vide.teiva('PUT', PUT, { doc: doc() });
  assert.equal(rien.body.changed, false);
  assert.equal(vide.blob.ops.put, 0, 'même pas la création d’un document vide');
});

test('le chemin écrit suit VERCEL_ENV : preview/ par défaut, prod/ en production, jamais une valeur du client', async () => {
  await avecEnv(undefined, async () => {
    const { blob, teiva } = installe();
    await teiva('PUT', `${PUT}&env=prod&path=prod/light.json`, { doc: doc(regatta()), env: 'prod' });
    assert.deepEqual([...blob.store.keys()], ['preview/light.json']);
  });
  await avecEnv('production', async () => {
    const { blob, teiva } = installe();
    const r = await teiva('PUT', PUT, { doc: doc(regatta()) });
    assert.deepEqual([...blob.store.keys()], ['prod/light.json']);
    assert.equal(r.body.env, 'prod');
  });
  await avecEnv('preview', async () => {
    const { blob, teiva } = installe();
    await teiva('PUT', PUT, { doc: doc(regatta()) });
    assert.deepEqual([...blob.store.keys()], ['preview/light.json']);
  });
  assert.notEqual(process.env.VERCEL_ENV, 'production', 'la variable est restaurée');
});

test('le faux Blob refuse tout accès non privé et toute énumération ; la fonction n’en fait aucun', async () => {
  const blob = createFakeBlob();
  await assert.rejects(() => blob.put('x.json', '{}', { access: 'public' }), /sans accès privé/);
  await assert.rejects(() => blob.get('x.json', { access: 'public' }), /sans accès privé/);
  await assert.rejects(() => blob.put('x.json', '{}', {}), /sans accès privé/);
  await assert.rejects(() => blob.list({ access: 'private' }), /énumération interdite/);
  const { blob: b, teiva, thibaud } = installe();
  await teiva('PUT', PUT, { doc: doc(regatta({ races: [manche('2026-11-07', '10:55')] })) });
  await thibaud('GET', GET);
  await thibaud('GET', `${GET}&rev=x`);
  assert.equal(b.ops.list, 0);
  assert.ok(b.ops.log.length > 0);
  assert.ok(b.ops.log.every((o) => o.opts.access === 'private'), 'chaque lecture et écriture passe en accès privé');
  assert.ok(b.ops.log.filter((o) => o.op === 'get').every((o) => o.opts.useCache === false), 'le document partagé est relu sans cache');
  assert.ok(b.ops.log.filter((o) => o.op === 'put').every((o) => o.path.startsWith('preview/')));
});

test('sans magasin configuré : 503 no_blob ; sans client injecté la fonction ne touche à rien d’autre', async () => {
  const jeton = process.env.BLOB_READ_WRITE_TOKEN, id = process.env.BLOB_STORE_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
  try {
    const r = await invoke(createHandler(), { method: 'GET', url: GET, headers: { 'x-rt-membre': 'Teiva' } });
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { error: 'no_blob' });
  } finally {
    if (jeton !== undefined) process.env.BLOB_READ_WRITE_TOKEN = jeton;
    if (id !== undefined) process.env.BLOB_STORE_ID = id;
  }
});
