// api/archive.js (ARCH-01, D-01, D-04) : la VRAIE fonction, appelée par des « téléphones » simulés sur un faux Blob au contrat du SDK 2.8.0
// (tests/helpers/fakeblob.mjs) : aucun réseau, aucun jeton. Vérifié : auteur posé par le serveur depuis l’en-tête du middleware, fusion sans
// perte ni doublon, préfixe d’environnement, accès toujours privé, magasin jamais énuméré, aucune écriture quand rien ne change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { createHandler, cleanDoc, attribute, mutateLight, MAX_LIGHT, MAX_REGATTA, MAX_REGATTAS, MAX_HEAVY } from '../api/archive.js';
import { emptyDoc, mergeDoc } from '../js/archmerge.js';
import middleware from '../middleware.js';
import { createFakeBlob, createGate, invoke } from './helpers/fakeblob.mjs';
import { avecCodeSimule, COOKIE_TEST } from './helpers/codesimule.mjs';

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

test('bout à bout serveur : l’en-tête produit par le vrai middleware, passé tel quel à la fonction, donne l’auteur ; celui du navigateur est sans effet', async () => {
  await avecCodeSimule(async ({ prenom }) => {
    const { blob, handler } = installe();
    const res = await middleware(new Request('https://rade.test/api/archive?k=light', { method: 'PUT', headers: { cookie: COOKIE_TEST, 'x-rt-membre': encodeURIComponent('Usurpateur'), 'content-type': 'application/json' }, body: '{}' }));
    assert.equal(res.headers.get('x-middleware-next'), '1');
    const transmis = res.headers.get('x-middleware-request-x-rt-membre');
    const r = await invoke(handler, { method: 'PUT', url: PUT, body: { doc: doc(regatta({ by: 'Usurpateur', races: [manche('2026-11-07', '10:55')] })) }, headers: { 'x-rt-membre': transmis } });
    assert.equal(r.status, 200);
    assert.equal(r.body.doc.regattas.rgA.by, prenom);
    assert.equal(r.body.doc.regattas.rgA.races[0].by, prenom);
    assert.ok(blob.store.has('preview/light.json'));
  });
});

test('fermée par défaut : sans prénom valide du middleware (absent, vide, non décodable, illisible, trop long), 403 et rien n’est lu', async () => {
  const { blob, handler } = installe();
  const essais = [undefined, '', '   ', '%E0%A4%A', '%', 'Romain<script>', '<b>', '1234', 'a'.repeat(41), 'Romain\nTeiva', '../Teiva', 'Rom,ain'];
  for (const v of essais) {
    for (const [method, url, body] of [['GET', GET], ['PUT', PUT, { doc: doc(regatta()) }]]) {
      const r = await invoke(handler, { method, url, body, headers: v === undefined ? {} : { 'x-rt-membre': v } });
      assert.equal(r.status, 403, `${method} avec ${JSON.stringify(v)}`);
      assert.deepEqual(r.body, { error: 'membre_inconnu' });
      assert.equal(r.headers['cache-control'], 'no-store');
    }
  }
  assert.equal(blob.ops.log.length, 0, 'aucune lecture ni écriture du magasin');
  assert.equal(blob.store.size, 0);
});

test('un prénom accentué passe encodé dans l’en-tête et signe correctement', async () => {
  const { handler } = installe();
  const r = await invoke(handler, { method: 'PUT', url: PUT, body: { doc: doc(regatta()) }, headers: { 'x-rt-membre': encodeURIComponent('Éloïse-Marie') } });
  assert.equal(r.status, 200);
  assert.equal(r.body.doc.regattas.rgA.by, 'Éloïse-Marie');
});

// ───────────────────────── fusion à trois téléphones par la vraie fonction (D-04)

test('trois équipiers complètent la même régate : ajouts gardés, plus récent gagnant avec l’autre dans l’historique, suppression définitive, renvois sans doublon', async () => {
  const { blob, romain, teiva, thibaud } = installe();
  const base = regatta({ name: 'Coupe', races: [manche('2026-11-07', '10:55'), manche('2026-11-07', '12:00')] });
  await teiva('PUT', PUT, { doc: doc(base) });
  // chacun part du même état, hors réseau
  const parRomain = { ...base, name: 'Coupe de Romain', u: 2000, races: [...base.races, manche('2026-11-08', '09:30', { u: 2100 })] };
  const parThibaud = { ...base, name: 'Coupe de Thibaud', u: 3000, tomb: { 'race:m202611071200': { t: 3100 } }, races: [base.races[0], manche('2026-11-09', '14:00', { u: 3200 })] };
  const parTeiva = { ...base, races: [{ ...base.races[0], note: 'départ retardé', u: 2500 }, base.races[1]] };
  const r1 = await romain('PUT', PUT, { doc: doc(parRomain) });
  const r2 = await thibaud('PUT', PUT, { doc: doc(parThibaud) });
  const r3 = await teiva('PUT', PUT, { doc: doc(parTeiva) });
  for (const r of [r1, r2, r3]) assert.equal(r.status, 200);
  const fin = r3.body.doc.regattas.rgA;
  assert.equal(fin.name, 'Coupe de Thibaud', 'la plus récente gagne');
  assert.ok(fin.hist.some((h) => h.kind === 'head' && h.v.name === 'Coupe de Romain' && h.by === 'Romain'), 'l’autre version est dans l’historique de la fiche');
  assert.deepEqual(fin.races.map((m) => m.id).sort(), ['m202611071055', 'm202611080930', 'm202611091400'], 'ajouts des trois côtés gardés, manche supprimée absente');
  assert.equal(fin.races.find((m) => m.id === 'm202611071055').note, 'départ retardé');
  assert.equal(fin.races.find((m) => m.id === 'm202611080930').by, 'Romain');
  assert.equal(fin.races.find((m) => m.id === 'm202611091400').by, 'Thibaud');
  // tout renvoyer, deux fois, dans le désordre, après une coupure : l’état ne bouge plus (aucun doublon, aucune écriture)
  const ecritures = blob.ops.put;
  const etat = JSON.stringify((await thibaud('GET', GET)).body.doc);
  for (const [qui, corps] of [[thibaud, parThibaud], [romain, parRomain], [teiva, parTeiva], [romain, parRomain], [thibaud, parThibaud]]) {
    const r = await qui('PUT', PUT, { doc: doc(corps) });
    assert.equal(r.body.changed, false);
  }
  assert.equal(blob.ops.put, ecritures);
  assert.equal(JSON.stringify((await romain('GET', GET)).body.doc), etat);
  assert.equal(JSON.parse(etat).regattas.rgA.races.length, 3);
});

test('recalages de bouées partagés : l’auteur est posé par le serveur, le plus récent gagne, la suppression est une valeur, rien n’est écrit si rien ne change', async () => {
  const { blob, romain, teiva, thibaud } = installe();
  const m = (over) => ({ lat: 43.07, lon: 5.93, src: 'trace', t: 1000, ...over });
  const un = await teiva('PUT', PUT, { doc: { ...doc(), marks: { 3: m({ by: 'Usurpateur', inconnu: 'x'.repeat(1000) }) } } });
  assert.equal(un.body.doc.marks[3].by, 'Teiva');
  assert.ok(!('inconnu' in un.body.doc.marks[3]), 'seuls les champs connus sont gardés');
  const deux = await romain('PUT', PUT, { doc: { ...doc(), marks: { 3: m({ lat: 43.08, src: 'saisie', t: 2000 }) } } });
  assert.equal(deux.body.doc.marks[3].lat, 43.08); assert.equal(deux.body.doc.marks[3].by, 'Romain');
  assert.equal(deux.body.doc.marks[3].h[0].lat, 43.07, 'la position écrasée reste dans l’historique');
  const sup = await teiva('PUT', PUT, { doc: { ...doc(), marks: { 3: { del: true, t: 3000 } } } });
  assert.equal(sup.body.doc.marks[3].del, true); assert.equal(sup.body.doc.marks[3].by, 'Teiva');
  const ecritures = blob.ops.put;
  const encore = await romain('PUT', PUT, { doc: { ...doc(), marks: { 3: m({ lat: 43.08, src: 'saisie', t: 2000 }) } } });
  assert.equal(encore.body.changed, false);
  assert.equal(encore.body.doc.marks[3].del, true, 'une modification plus ancienne que la suppression ne la défait pas');
  assert.equal(blob.ops.put, ecritures);
  // un téléphone en retard renvoie une ancienne version qu'un autre équipier avait écrite : elle garde son auteur et ne change rien
  const vieux = await thibaud('PUT', PUT, { doc: { ...doc(), marks: { 3: m({ lat: 43.08, src: 'saisie', t: 2000, by: 'Thibaud' }) } } });
  assert.equal(vieux.body.changed, false, 'version déjà connue de l’historique : pas de nouvelle écriture');
  assert.deepEqual(vieux.body.doc.marks[3].h.map((x) => x.by), ['Romain', 'Teiva'], 'l’historique garde les auteurs d’origine');
  // clés invalides ou dangereuses ignorées
  const sale = await teiva('PUT', PUT, { doc: JSON.parse('{"v":1,"regattas":{},"tomb":{"__proto__":{"t":1}},"marks":{"__proto__":{"t":1,"polluted":1},"trop-long-pour-une-bouée":{"t":1},"4":{"t":"x"}}}') });
  assert.equal(sale.status, 200);
  assert.deepEqual(Object.keys(sale.body.doc.marks), ['3']);
  assert.equal(({}).polluted, undefined);
});

// ───────────────────────── contrat de la fonction : méthodes, bornes, dates, concurrence

test('autre méthode : 405 ; k inconnu ou absent : 400', async () => {
  const { teiva, blob } = installe();
  for (const method of ['POST', 'DELETE', 'PATCH']) {
    const r = await teiva(method, PUT, { doc: doc() });
    assert.equal(r.status, 405, method);
    assert.deepEqual(r.body, { error: 'GET ou PUT' });
  }
  for (const url of ['/api/archive', '/api/archive?k=', '/api/archive?k=traces&id=x', '/api/archive?k=Trace&id=x', '/api/archive?k=__proto__', '/api/archive?k=constructor', '/api/archive?k=../light', '/api/archive?k=LIGHT']) {
    const r = await teiva('GET', url);
    assert.equal(r.status, 400, url);
    assert.deepEqual(r.body, { error: 'k inconnu' });
  }
  assert.equal(blob.ops.log.length, 0, 'rien n’est lu pour une demande refusée');
});

test('400 : document illisible, identifiant invalide, liste qui n’en est pas une, élément sans identifiant, version de format inconnue ; rien n’est écrit', async () => {
  const { teiva, blob } = installe();
  const mauvais = {
    'sans document': undefined, 'corps vide': {}, 'document en liste': { doc: [] }, 'document en texte': { doc: 'x' },
    'version inconnue': { doc: { v: 2, regattas: {}, tomb: {}, marks: {} } },
    'identifiant de régate invalide': { doc: { v: 1, regattas: { 'mauvais id!': regatta({ id: 'mauvais id!' }) } } },
    'identifiant qui ne correspond pas à la clé': { doc: { v: 1, regattas: { rgA: regatta({ id: 'rgB' }) } } },
    'régate en texte': { doc: { v: 1, regattas: { rgA: 'x' } } },
    'manches qui n’en sont pas': { doc: doc(regatta({ races: 'beaucoup' })) },
    'manche sans identifiant': { doc: doc(regatta({ races: [{ date: '2026-11-07' }] })) },
    'manche à identifiant invalide': { doc: doc(regatta({ races: [{ id: '../x', date: '2026-11-07' }] })) },
    'élément en texte': { doc: doc(regatta({ traces: ['x'] })) },
  };
  for (const [nom, corps] of Object.entries(mauvais)) {
    const r = await teiva('PUT', PUT, corps);
    assert.equal(r.status, 400, nom);
    assert.ok(typeof r.body.error === 'string' && r.body.error.length <= 300, `${nom} : message borné`);
  }
  assert.equal(blob.ops.put, 0);
  assert.equal(blob.store.size, 0);
  // l’identifiant de la régate dans un message reste court et ne contient pas le document
  const long = await teiva('PUT', PUT, { doc: { v: 1, regattas: { ['x'.repeat(200)]: regatta({ id: 'x'.repeat(200) }) } } });
  assert.equal(long.status, 400);
  assert.ok(long.body.error.length < 60);
});

test('413 : régate de plus de 150 Ko, plus de 200 régates, document de plus de 3,5 Mo ; sous la borne, 200', async () => {
  const { teiva, blob } = installe();
  const gros = (id, n) => regatta({ id, name: 'x'.repeat(n) });
  const juste = await teiva('PUT', PUT, { doc: doc(gros('rgA', MAX_REGATTA - 2000)) });
  assert.equal(juste.status, 200);
  const trop = await teiva('PUT', PUT, { doc: doc(gros('rgB', MAX_REGATTA + 10)) });
  assert.equal(trop.status, 413);
  assert.match(trop.body.error, /trop volumineuse/);
  const toutes = Object.fromEntries(Array.from({ length: MAX_REGATTAS + 1 }, (_, i) => [`r${i}`, regatta({ id: `r${i}` })]));
  const nombre = await teiva('PUT', PUT, { doc: { v: 1, regattas: toutes, tomb: {}, marks: {} } });
  assert.equal(nombre.status, 413);
  assert.match(nombre.body.error, /trop de régates/);
  const enorme = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`e${i}`, gros(`e${i}`, MAX_REGATTA - 5000)]));
  const lourd = await teiva('PUT', PUT, { doc: { v: 1, regattas: enorme, tomb: {}, marks: {} } });
  assert.equal(lourd.status, 413);
  assert.ok(MAX_LIGHT === 3_500_000);
  assert.equal(blob.ops.put, 1, 'seule la première écriture a eu lieu');
});

test('une date future (plus de 5 min d’avance) est ramenée à l’heure du serveur ; un décalage normal est conservé', async () => {
  const { teiva } = installe();
  const futur = T + 10 * 60e3, proche = T + 60e3;
  const r = await teiva('PUT', PUT, { doc: {
    v: 1,
    regattas: { rgA: regatta({ u: futur, races: [manche('2026-11-07', '10:55', { u: futur }), manche('2026-11-08', '10:55', { u: proche })], frozen: { '2026-11-07': { wx: 1, u: futur } },
      tomb: { 'race:mx': { t: futur }, 'race:my': { t: proche } }, traces: [{ id: 'tr1', u: 1, report: { t: futur, html: 'x' } }] }) },
    tomb: { 'regatta:rgZ': { t: futur } }, marks: { 2: { lat: 1, lon: 2, src: 'saisie', t: futur } },
  } });
  assert.equal(r.status, 200);
  const g = r.body.doc.regattas.rgA;
  assert.equal(g.u, T);
  assert.equal(g.races.find((m) => m.id === 'm202611071055').u, T);
  assert.equal(g.races.find((m) => m.id === 'm202611081055').u, proche, 'moins de 5 min d’avance : conservé');
  assert.equal(g.frozen['2026-11-07'].u, T);
  assert.equal(g.tomb['race:mx'].t, T); assert.equal(g.tomb['race:my'].t, proche);
  assert.equal(g.traces[0].report.t, T);
  assert.equal(r.body.doc.tomb['regatta:rgZ'].t, T);
  assert.equal(r.body.doc.marks[2].t, T);
});

test('deux écritures simultanées : la perdante relit et refusionne, les deux ajouts sont gardés (création, puis écrasement avec ifMatch)', async () => {
  // 1. le document n’existe pas encore : les deux lisent « rien », la seconde création échoue et reprend
  {
    const { blob, romain, thibaud } = installe({ blob: { gate: createGate(2) } });
    const [a, b] = await Promise.all([
      romain('PUT', PUT, { doc: doc(regatta({ races: [manche('2026-11-08', '09:30', { u: 2100 })] })) }),
      thibaud('PUT', PUT, { doc: doc(regatta({ races: [manche('2026-11-09', '14:00', { u: 2200 })] })) }),
    ]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    const final = JSON.parse([...blob.store.values()][0].text);
    assert.deepEqual(final.regattas.rgA.races.map((m) => m.id), ['m202611080930', 'm202611091400']);
    assert.ok(blob.ops.get >= 3, 'la perdante a relu');
    assert.equal(blob.store.size, 1);
  }
  // 2. le document existe : la seconde écriture est refusée par ifMatch (BlobPreconditionFailedError), relue, refusionnée
  {
    let porte = null;                                        // armée seulement après la première écriture
    const { blob, teiva, romain, thibaud } = installe({ blob: { gate: (...a) => porte?.(...a) } });
    const base = regatta({ races: [manche('2026-11-07', '10:55')] });
    await teiva('PUT', PUT, { doc: doc(base) });
    porte = createGate(2);
    const lus = blob.ops.get, avant = blob.ops.log.filter((o) => o.op === 'put').length;
    const [a, b] = await Promise.all([
      romain('PUT', PUT, { doc: doc({ ...base, races: [...base.races, manche('2026-11-08', '09:30', { u: 2100 })] }) }),
      thibaud('PUT', PUT, { doc: doc({ ...base, races: [...base.races, manche('2026-11-09', '14:00', { u: 2200 })] }) }),
    ]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    const final = JSON.parse(blob.store.get('preview/light.json').text);
    assert.deepEqual(final.regattas.rgA.races.map((m) => m.id), ['m202611071055', 'm202611080930', 'm202611091400']);
    assert.equal(blob.ops.get - lus, 3, 'deux lectures simultanées, puis une relecture par la perdante');
    const puts = blob.ops.log.filter((o) => o.op === 'put').slice(avant);
    assert.equal(puts.length, 3, 'trois écritures : la gagnante, la perdante refusée, la perdante refaite');
    assert.ok(puts.every((o) => o.opts.ifMatch), 'chaque écrasement est conditionnel (ifMatch)');
  }
});

test('écritures simultanées au-delà de 4 essais : 409 ; une erreur du magasin n’est pas prise pour une course perdue', async () => {
  const { blob, teiva } = installe();
  await teiva('PUT', PUT, { doc: doc(regatta()) });
  const avant = blob.ops.get;
  blob.failNext(new blob.BlobPreconditionFailedError(), { op: 'put', times: 99 });
  const r = await teiva('PUT', PUT, { doc: doc(regatta({ races: [manche('2026-11-07', '10:55')] })) });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /réessayez/);
  assert.equal(blob.ops.get - avant, 4, 'quatre essais, pas un de plus');
  // une panne du magasin autre qu'une course perdue ressort telle quelle (502), sans relire quatre fois
  const b2 = createFakeBlob(), h = createHandler({ blob: b2, now: () => T });
  const phone = (nom) => (corps) => invoke(h, { method: 'PUT', url: PUT, body: corps, headers: { 'x-rt-membre': nom } });
  await phone('Teiva')({ doc: doc(regatta()) });
  const lus = b2.ops.get;
  b2.failNext(new b2.BlobError('boum'), { op: 'put' });
  const e = await phone('Teiva')({ doc: doc(regatta({ races: [manche('2026-11-07', '10:55')] })) });
  assert.equal(e.status, 502);
  assert.match(e.body.error, /boum/);
  assert.equal(b2.ops.get - lus, 1, 'une seule lecture : ce n’était pas une écriture simultanée');
});

test('régate supprimée : copie sous <env>/trash/ avant de quitter le document ; un téléphone en retard ne la ressuscite pas ; copie impossible = suppression refusée', async () => {
  const { blob, romain, teiva, thibaud } = installe();
  await teiva('PUT', PUT, { doc: doc(regatta({ name: 'À supprimer', races: [manche('2026-11-07', '10:55')] })) });
  const sup = await romain('PUT', PUT, { doc: { v: 1, regattas: {}, tomb: { 'regatta:rgA': { t: 1800 } }, marks: {} } });
  assert.equal(sup.status, 200);
  assert.deepEqual(Object.keys(sup.body.doc.regattas), []);
  assert.equal(sup.body.doc.tomb['regatta:rgA'].by, 'Romain');
  const copies = [...blob.store.keys()].filter((k) => k.startsWith('preview/trash/'));
  assert.equal(copies.length, 1);
  assert.match(copies[0], /^preview\/trash\/rgA-2000000-r\d+\.json$/);
  assert.equal(JSON.parse(blob.store.get(copies[0]).text).name, 'À supprimer');
  assert.ok(blob.ops.log.filter((o) => o.path.includes('/trash/')).every((o) => o.opts.access === 'private'));
  // un téléphone en retard renvoie la régate (même modifiée après) : elle reste supprimée et la corbeille n’est pas réécrite
  const tard = await thibaud('PUT', PUT, { doc: doc(regatta({ u: 99_999, races: [manche('2026-11-07', '10:55', { u: 99_999 })] })) });
  assert.deepEqual(Object.keys(tard.body.doc.regattas), []);
  assert.equal([...blob.store.keys()].filter((k) => k.startsWith('preview/trash/')).length, 1);
  // la copie dans la corbeille échoue : la régate reste dans le document (rien n’est perdu)
  const { blob: b2, teiva: t2, romain: r2 } = installe();
  await t2('PUT', PUT, { doc: doc(regatta({ name: 'Gardée' })) });
  b2.failNext(new Error('corbeille indisponible'), { op: 'put' });
  const refus = await r2('PUT', PUT, { doc: { v: 1, regattas: {}, tomb: { 'regatta:rgA': { t: 1800 } }, marks: {} } });
  assert.equal(refus.status, 502);
  assert.equal(JSON.parse(b2.store.get('preview/light.json').text).regattas.rgA.name, 'Gardée');
});

test('limite du stockage (429) : réponse 429 avec Retry-After, sans détail interne', async () => {
  const { blob, teiva } = installe();
  blob.failNext(new blob.BlobServiceRateLimited(42), { op: 'get' });
  const r = await teiva('GET', GET);
  assert.equal(r.status, 429);
  assert.equal(r.headers['retry-after'], '42');
  assert.match(r.body.error, /réessayez plus tard/);
  blob.failNext(new blob.BlobServiceRateLimited(), { op: 'put' });
  const w = await teiva('PUT', PUT, { doc: doc(regatta()) });
  assert.equal(w.status, 429);
  assert.equal(w.headers['retry-after'], '60', 'valeur par défaut quand le magasin n’en donne pas');
  assert.equal(w.headers['cache-control'], 'no-store');
  // pas de nouvelle tentative à la création quand c’est la limite (elle ne ressemble pas à « existe déjà »)
  assert.equal(blob.ops.get, 2);
});

test('les erreurs du magasin sont bornées à 300 caractères et ne contiennent pas le contenu des régates', async () => {
  const { blob, teiva } = installe();
  blob.failNext(new Error('panne '.repeat(200)), { op: 'get' });
  const r = await teiva('PUT', PUT, { doc: doc(regatta({ name: 'Secret du club' })) });
  assert.equal(r.status, 502);
  assert.ok(r.body.error.length <= 300);
  assert.doesNotMatch(JSON.stringify(r.body), /Secret du club/);
  // un document stocké illisible : 502 explicite, rien n’est écrasé
  const { blob: b2, teiva: t2 } = installe();
  b2.store.set('preview/light.json', { text: '{pas du json', etag: '"x"', contentType: 'application/json', uploadedAt: new Date(0) });
  const g = await t2('GET', GET);
  assert.equal(g.status, 502);
  const p = await t2('PUT', PUT, { doc: doc(regatta()) });
  assert.equal(p.status, 502);
  assert.equal(b2.ops.put, 0);
});

test('cleanDoc, attribute et mutateLight : unités exportées (sel retiré, auteur ignoré, fusion sans écriture inutile)', async () => {
  const sale = cleanDoc({ v: 1, regattas: { rgA: regatta({ sel: 2, by: 'Moi', hist: 'pas une liste', tomb: [1, 2], frozen: { 'pas-un-jour': {}, '2026-11-07': { u: 1 }, '2026-11-08': 'x' } }) } }, T);
  assert.ok(!('sel' in sale.regattas.rgA));
  assert.deepEqual(sale.regattas.rgA.hist, []);
  assert.deepEqual(sale.regattas.rgA.tomb, {});
  assert.deepEqual(Object.keys(sale.regattas.rgA.frozen), ['2026-11-07']);
  const a = attribute(sale, emptyDoc(), 'Teiva');
  assert.equal(a.regattas.rgA.by, 'Teiva'); assert.equal(a.regattas.rgA.ub, 'Teiva');
  const blob = createFakeBlob();
  const r1 = await mutateLight(blob, 'preview/light.json', (stored) => ({ doc: mergeDoc(stored, a) }));
  assert.equal(r1.changed, true);
  const r2 = await mutateLight(blob, 'preview/light.json', (stored) => ({ doc: mergeDoc(stored, a) }));
  assert.equal(r2.changed, false);
  assert.equal(r2.rev, r1.rev);
  assert.equal(blob.ops.put, 1);
  assert.equal(MAX_REGATTAS, 200); assert.equal(MAX_REGATTA, 150_000);
});

// ───────────────────────── objets lourds : trace, rapport, vent figé du jour (plan 04-04)

const trace = (id = 'tr1', n = 3, over = {}) => ({ id, name: 'Trace test', start: 1_000, course: null, pts: Array.from({ length: n }, (_, i) => [1_000 + i * 1000, 43.07 + i * 1e-4, 5.93, 5, 90, 5]), ...over });
const TR = (id = 'tr1') => `/api/archive?k=trace&id=${id}`;
const RP = (id = 'tr1', t = 123) => `/api/archive?k=report&id=${id}&t=${t}`;
const DY = (extra = '') => `/api/archive?k=day&r=rgA&d=2026-11-07${extra}`;
const jour = { wx: { multi: { hourly: { time: ['2026-11-07T00:00'] } } }, strat: { legs: [] }, obs: { day: '2026-11-07', obs: [] } };

test('trace : PUT puis GET rendent le même JSON en flux, privé, nosniff, sans rapport ; déjà en ligne → exists, aucune réécriture', async () => {
  const { blob, teiva, thibaud } = installe();
  const t = trace('tr1', 5, { report: { html: '<p>x</p>', t: 5, name: 'R' } });
  const mis = await teiva('PUT', TR(), t);
  assert.equal(mis.status, 200); assert.deepEqual(mis.body, { ok: true });
  assert.ok(blob.store.has('preview/trace/tr1.json'));
  assert.ok(!('report' in JSON.parse(blob.store.get('preview/trace/tr1.json').text)), 'le rapport ne voyage pas avec la trace');
  const puts = blob.ops.put;
  const encore = await thibaud('PUT', TR(), trace('tr1', 5));
  assert.equal(encore.status, 200); assert.deepEqual(encore.body, { exists: true });
  assert.equal(blob.ops.put, puts, 'un objet immuable déjà en ligne n’est pas réécrit');
  const lu = await thibaud('GET', TR());
  assert.equal(lu.status, 200);
  assert.equal(lu.headers['content-type'], 'application/json');
  assert.equal(lu.headers['x-content-type-options'], 'nosniff');
  assert.equal(lu.headers['cache-control'], 'no-store');
  const { report, ...sans } = t;
  assert.deepEqual(lu.body, sans);
  assert.ok(blob.ops.log.filter((o) => o.op !== 'head').every((o) => o.opts.access === 'private'), 'accès toujours privé');
  assert.doesNotMatch(JSON.stringify(lu), /blob\.vercel-storage|https?:\/\//);
  const absent = await thibaud('GET', TR('tr404'));
  assert.equal(absent.status, 404); assert.deepEqual(absent.body, { error: 'absent' });
});

test('trace : un immuable écrit entre-temps par un autre téléphone n’est pas réécrit (la perte de course est un « exists »)', async () => {
  const { blob, teiva } = installe();
  blob.store.set('preview/trace/tr1.json', { text: JSON.stringify(trace()), etag: '"z"', contentType: 'application/json', uploadedAt: new Date(0) });
  blob.failNext(new blob.BlobNotFoundError(), { op: 'head' });           // le premier contrôle ne l’a pas vu…
  blob.failNext(new blob.BlobError('This blob already exists'), { op: 'put' });   // …l’écriture a perdu la course
  const r = await teiva('PUT', TR(), trace());
  assert.equal(r.status, 200); assert.deepEqual(r.body, { exists: true });
  // une vraie panne d’écriture reste une panne
  const { blob: b2, teiva: t2 } = installe();
  b2.failNext(new b2.BlobError('boum'), { op: 'put' });
  assert.equal((await t2('PUT', TR(), trace())).status, 502);
});

test('rapport : { html, t, name } immuable, un chemin par instant ; instant incohérent ou html absent → 400', async () => {
  const { blob, teiva, romain } = installe();
  const rapport = { html: '<!doctype html><title>Rapport archive test</title>', t: 123, name: 'Débrief SNPM' };
  assert.deepEqual((await teiva('PUT', RP(), rapport)).body, { ok: true });
  assert.ok(blob.store.has('preview/report/tr1-123.json'));
  assert.deepEqual((await romain('PUT', RP(), rapport)).body, { exists: true });
  assert.deepEqual((await romain('GET', RP())).body, rapport);
  assert.equal((await teiva('PUT', RP('tr1', 124), rapport)).status, 400, 't du corps différent de celui de l’adresse');
  assert.equal((await teiva('PUT', RP(), { t: 123 })).status, 400);
  assert.equal((await teiva('PUT', RP('tr1', 'abc'), rapport)).status, 400);
  assert.equal((await teiva('GET', RP('tr1', 999))).status, 404);
  // un rapport plus récent est un autre objet
  assert.deepEqual((await teiva('PUT', RP('tr1', 200), { ...rapport, t: 200 })).body, { ok: true });
  assert.ok(blob.store.has('preview/report/tr1-200.json') && blob.store.has('preview/report/tr1-123.json'));
});

test('vent du jour : le PUT écrit sous le prénom du middleware, jamais celui du client ; le GET lit celui de l’équipier demandé', async () => {
  const { blob, teiva, thibaud } = installe();
  const mis = await teiva('PUT', DY('&by=thibaud'), jour);                        // `by` du client : ignoré en écriture
  assert.equal(mis.status, 200); assert.deepEqual(mis.body, { ok: true });
  assert.deepEqual([...blob.store.keys()].filter((k) => k.includes('/day/')), ['preview/day/rgA/2026-11-07/teiva.json']);
  const lu = await thibaud('GET', DY('&by=teiva'));
  assert.equal(lu.status, 200); assert.deepEqual(lu.body, jour);
  assert.equal(lu.headers['x-content-type-options'], 'nosniff');
  // réécrit à chaque gel (un seul écrivain), lu sans cache
  const v2 = { ...jour, obs: { day: '2026-11-07', obs: [{ t: 1 }] } };
  assert.deepEqual((await teiva('PUT', DY(), v2)).body, { ok: true });
  assert.deepEqual((await thibaud('GET', DY('&by=teiva'))).body, v2);
  assert.ok(blob.ops.log.filter((o) => o.op === 'get' && o.path.includes('/day/')).every((o) => o.opts.useCache === false), 'jamais la copie du CDN');
  // chacun son objet : Thibaud écrit le sien, celui de Teiva ne bouge pas
  await thibaud('PUT', DY(), { ...jour, strat: null });
  assert.deepEqual(JSON.parse(blob.store.get('preview/day/rgA/2026-11-07/teiva.json').text), v2);
  assert.ok(blob.store.has('preview/day/rgA/2026-11-07/thibaud.json'));
  assert.equal((await thibaud('GET', DY('&by=romain'))).status, 404);
});

test('vent du jour : GET sans `by` valide → 400, jour ou régate invalides → 400, corps de plus de 0,6 Mo → 413, corps vide → 400', async () => {
  const { blob, teiva } = installe();
  for (const by of ['', '&by=Teiva', '&by=../teiva', '&by=a%20b', `&by=${'a'.repeat(41)}`]) assert.equal((await teiva('GET', DY(by))).status, 400, `by=${by}`);
  for (const url of ['/api/archive?k=day&r=rgA&d=2026-13-99x', '/api/archive?k=day&r=rgA&d=07/11/2026', '/api/archive?k=day&r=..&d=2026-11-07', '/api/archive?k=day&r=a%2Fb&d=2026-11-07', '/api/archive?k=day&d=2026-11-07']) {
    assert.equal((await teiva('PUT', url, jour)).status, 400, url);
  }
  const gros = await teiva('PUT', DY(), { wx: { x: 'a'.repeat(MAX_HEAVY.day) } });
  assert.equal(gros.status, 413); assert.match(gros.body.error, /trop volumineux/);
  assert.equal((await teiva('PUT', DY(), {})).status, 400);
  assert.equal((await teiva('PUT', DY(), { wx: 'texte' })).status, 400);
  assert.equal(blob.ops.put, 0, 'rien n’a été écrit');
  assert.deepEqual(MAX_HEAVY, { trace: 4_000_000, report: 3_000_000, day: 600_000 });
});

test('objets lourds : bornes de trace (4 Mo) et de rapport (3 Mo) → 413, paramètres invalides → 400, autres méthodes → 405, k inconnu → 400', async () => {
  const { blob, teiva } = installe();
  const t413 = await teiva('PUT', TR(), trace('tr1', 2, { pad: 'a'.repeat(MAX_HEAVY.trace) }));
  assert.equal(t413.status, 413);
  assert.equal((await teiva('PUT', RP(), { html: 'a'.repeat(MAX_HEAVY.report), t: 123, name: 'x' })).status, 413);
  for (const url of ['/api/archive?k=trace', '/api/archive?k=trace&id=..', '/api/archive?k=trace&id=a%2Fb', `/api/archive?k=trace&id=${'a'.repeat(81)}`, '/api/archive?k=report&id=tr1']) {
    assert.equal((await teiva('GET', url)).status, 400, url);
  }
  assert.equal((await teiva('PUT', TR(), trace('autre'))).status, 400, 'identifiant du corps ≠ celui de l’adresse');
  assert.equal((await teiva('PUT', TR(), { id: 'tr1', pts: [] })).status, 400);
  assert.equal((await teiva('PUT', TR(), undefined)).status, 400);
  for (const method of ['POST', 'DELETE']) assert.equal((await teiva(method, TR(), trace())).status, 405);
  assert.equal((await teiva('GET', '/api/archive?k=autre')).status, 400);
  assert.equal(blob.ops.put, 0);
});

test('objets lourds : fermés sans prénom du middleware (403), préfixe de l’environnement, 429 relayé avec Retry-After', async () => {
  const { blob, handler, teiva } = installe();
  for (const url of [TR(), RP(), DY('&by=teiva')]) {
    assert.equal((await invoke(handler, { method: 'GET', url })).status, 403, `${url} sans prénom`);
    assert.equal((await invoke(handler, { method: 'PUT', url, body: trace(), headers: { 'x-rt-membre': '' } })).status, 403);
  }
  assert.equal(blob.ops.get + blob.ops.put + blob.ops.head, 0, 'le magasin n’a pas été touché');
  await avecEnv('production', async () => { await teiva('PUT', TR('trp'), trace('trp')); });
  assert.ok(blob.store.has('prod/trace/trp.json'), 'la production a son préfixe');
  assert.ok(![...blob.store.keys()].some((k) => k.startsWith('preview/')), 'rien dans l’aperçu');
  blob.failNext(new blob.BlobServiceRateLimited(17), { op: 'get' });
  const l = await teiva('GET', TR());
  assert.equal(l.status, 429); assert.equal(l.headers['retry-after'], '17');
});

// ───────────────────────── gardes statiques

// Source sans commentaires (un commentaire qui cite une option interdite ne doit ni déclencher ni masquer la garde) ; les chaînes sont respectées
function sansCommentaires(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j; continue;
    }
    out += c;
  }
  return out;
}

test('garde statique : api/archive.js n’a que des accès privés et n’énumère jamais le magasin', () => {
  const src = readFileSync(ROOT + 'api/archive.js', 'utf8');
  const code = sansCommentaires(src);
  assert.ok(src.includes('//') && code.length < src.length, 'les commentaires sont bien retirés');
  const acces = [...code.matchAll(/\baccess\s*:\s*([^,}\s]+)/g)].map((m) => m[1]);
  assert.ok(acces.length >= 4, 'chaque appel au magasin déclare son accès');
  assert.deepEqual([...new Set(acces)], ["'private'"], 'aucune option d’accès autre que privée');
  assert.doesNotMatch(code, /\bpublic\b/);
  assert.doesNotMatch(code, /\blist\s*\(/, 'aucune énumération du magasin');
  assert.doesNotMatch(code, /\{[^}]*\blist\b[^}]*\}\s*from\s*['"]@vercel\/blob/);
  assert.doesNotMatch(code, /\bdownloadUrl\b|\bblob\.url\b|\bpathname\b/, 'aucune URL Blob manipulée ni renvoyée');
  assert.doesNotMatch(code, /json\([^)]*(BLOB_READ_WRITE_TOKEN|BLOB_STORE_ID)/, 'le jeton n’est jamais renvoyé');
  // le détecteur voit un commentaire piégé comme un commentaire, et un accès public caché dans le code comme un accès public
  assert.deepEqual([...sansCommentaires("// access: 'public'\nconst a = { access: 'private' }; /* list( */").matchAll(/\baccess\s*:\s*([^,}\s]+)/g)].map((m) => m[1]), ["'private'"]);
  assert.deepEqual([...sansCommentaires("const a = { access: 'public' };").matchAll(/\baccess\s*:\s*([^,}\s]+)/g)].map((m) => m[1]), ["'public'"]);
});

test('garde statique : aucun fichier de js/ ne contient d’adresse de magasin Blob, de jeton ni d’import du SDK', () => {
  for (const f of readdirSync(ROOT + 'js').filter((n) => n.endsWith('.js'))) {
    const code = sansCommentaires(readFileSync(ROOT + 'js/' + f, 'utf8'));
    assert.doesNotMatch(code, /blob\.vercel-storage\.com/i, `js/${f} : adresse de magasin Blob`);
    assert.doesNotMatch(code, /BLOB_READ_WRITE_TOKEN|BLOB_STORE_ID|VERCEL_OIDC_TOKEN/, `js/${f} : nom de jeton`);
    assert.doesNotMatch(code, /@vercel\/blob/, `js/${f} : le SDK ne se charge que dans la fonction`);
  }
  const vue = readFileSync(ROOT + 'index.html', 'utf8');
  assert.doesNotMatch(vue, /blob\.vercel-storage\.com|BLOB_READ_WRITE_TOKEN/i);
});
