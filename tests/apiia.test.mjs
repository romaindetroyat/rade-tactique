// api/_ia.js et les fonctions d’IA bornées (SECU2-01, D-05 à D-07) : sans réseau, sans clé réelle, sur le faux Blob de tests/helpers/fakeblob.mjs.
// Vérifié : `store: false` posé en un seul endroit et impossible à écraser, quota de 30 appels par équipier et par jour de Paris (le 31e reçoit
// 429 sans appel à OpenAI), prénom lu dans le seul en-tête du middleware, compteur ouvert en panne, erreurs d’OpenAI traduites et bornées.
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import './helpers/setup.mjs';
import {
  QUOTA, DELAI_MS, MESSAGES, BUDGET_CODES, jourParis, cheminQuota, compte, erreurIA, createIA, prefix,
} from '../api/_ia.js';
import { createHandler as creeArbitre } from '../api/rules.js';
import { createFakeBlob, createGate, invoke } from './helpers/fakeblob.mjs';

const cle0 = process.env.OPENAI_API_KEY;
before(() => { process.env.OPENAI_API_KEY = 'cle-de-test'; });
after(() => { if (cle0 === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = cle0; });

const T = Date.parse('2026-10-21T08:00:00Z');                    // mercredi 21/10/2026 10 h à Paris
const JOUR = '2026-10-21';
const entete = (nom) => ({ 'x-rt-membre': encodeURIComponent(nom) });
const SORTIE_ARBITRE = { verdict: 'B doit s’écarter', explication: 'B est au vent.', regles: [], ic: '', attention: '' };

// Client OpenAI simulé : garde les arguments de chaque appel
function faux(sortie = SORTIE_ARBITRE, erreur = null) {
  const appels = [];
  const client = { responses: { create: async (args) => { appels.push(args); if (erreur) throw erreur; return { status: 'completed', output_text: JSON.stringify(sortie) }; } } };
  return { client, appels };
}
function arbitre({ blob = createFakeBlob(), client = faux().client, delai } = {}) {
  return { blob, handler: creeArbitre({ openai: client, blob, now: () => T, delai }) };
}
const demande = (handler, nom = 'Romain', corps = { question: 'Bâbord / tribord ?' }, extra = {}) =>
  invoke(handler, { method: 'POST', url: '/api/rules', body: corps, headers: nom ? entete(nom) : {}, ...extra });
async function avecEnv(valeur, fn) {
  const avant = process.env.VERCEL_ENV;
  if (valeur === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = valeur;
  try { return await fn(); } finally { if (avant === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = avant; }
}
const erreurApi = (status, code, message = 'refus') => new OpenAI.APIError(status, { message, code }, undefined, new Headers());

// ── jour de Paris et chemin

test('jourParis : le jour change à minuit heure de Paris, été comme hiver', () => {
  assert.equal(jourParis(Date.parse('2026-10-25T22:30:00Z')), '2026-10-25');      // 23 h 30 à Paris (heure d’hiver revenue ce jour-là)
  assert.equal(jourParis(Date.parse('2026-10-25T23:30:00Z')), '2026-10-26');
  assert.equal(jourParis(Date.parse('2026-10-24T21:59:00Z')), '2026-10-24');      // 23 h 59 à Paris (heure d’été)
  assert.equal(jourParis(Date.parse('2026-10-24T22:00:00Z')), '2026-10-25');
});

test('cheminQuota : préfixe, jour de Paris, clé sans accent ni caractère de chemin', () => {
  assert.equal(cheminQuota('preview', 'Romain', T), `preview/quota/${JOUR}/romain.json`);
  assert.equal(cheminQuota('prod', 'Thibaud', T), `prod/quota/${JOUR}/thibaud.json`);
  for (const nom of ['Éloïse', 'Jean Luc', 'D’Artagnan', 'O\'Neil', 'Anne-Sophie', 'Çelik']) {
    const chemin = cheminQuota('preview', nom, T), cle = chemin.slice(`preview/quota/${JOUR}/`.length, -'.json'.length);
    assert.match(cle, /^[a-z0-9-]+$/, `${nom} → ${cle}`);
    assert.ok(!/[/.%]/.test(cle), `${nom} : ni « / », ni « . », ni « % »`);
    assert.equal(chemin.split('/').length, 4, `${nom} : le chemin garde ses quatre niveaux`);
  }
  assert.equal(cheminQuota('preview', 'Éloïse', T), `preview/quota/${JOUR}/eloise.json`);
});

// ── compteur

test('compte : 30 appels acceptés, le 31e refusé sans écriture ; ni list ni head ; un blob par équipier', async () => {
  const blob = createFakeBlob();
  const base = { B: blob, P: 'preview', who: 'Romain', now: () => T };
  for (let i = 1; i <= QUOTA; i++) assert.deepEqual(await compte(base), { ok: true, n: i });
  assert.deepEqual(await compte(base), { ok: false, n: QUOTA });
  assert.equal(blob.ops.get, QUOTA + 1);
  assert.equal(blob.ops.put, QUOTA, 'aucune écriture pour le refus');
  assert.equal(blob.ops.list, 0); assert.equal(blob.ops.head, 0);
  assert.equal(blob.store.get(`preview/quota/${JOUR}/romain.json`).text, `{"n":${QUOTA}}`);
  assert.deepEqual(await compte({ ...base, who: 'Teiva' }), { ok: true, n: 1 }, 'le compteur de Teiva est à part');
  assert.deepEqual([...blob.store.keys()].sort(), [`preview/quota/${JOUR}/romain.json`, `preview/quota/${JOUR}/teiva.json`]);
});

test('compte : accès privé, première écriture sans écrasement, suivantes sous ifMatch', async () => {
  const blob = createFakeBlob();
  await compte({ B: blob, P: 'preview', who: 'Romain', now: () => T });
  await compte({ B: blob, P: 'preview', who: 'Romain', now: () => T });
  const [g1, p1, g2, p2] = blob.ops.log;
  assert.deepEqual([g1.op, p1.op, g2.op, p2.op], ['get', 'put', 'get', 'put']);
  assert.equal(g1.opts.access, 'private'); assert.equal(g1.opts.useCache, false);
  assert.equal(p1.opts.access, 'private'); assert.equal(p1.opts.contentType, 'application/json');
  assert.equal(p1.opts.allowOverwrite, undefined); assert.equal(p1.opts.ifMatch, undefined);
  assert.equal(p2.opts.allowOverwrite, true); assert.ok(p2.opts.ifMatch);
});

test('compte : le jour suivant (Paris) repart de zéro', async () => {
  const blob = createFakeBlob();
  const soir = Date.parse('2026-10-21T21:30:00Z'), minuit = Date.parse('2026-10-21T22:30:00Z');       // 23 h 30 puis 00 h 30 à Paris
  for (let i = 0; i < QUOTA; i++) await compte({ B: blob, P: 'preview', who: 'Romain', now: () => soir });
  assert.equal((await compte({ B: blob, P: 'preview', who: 'Romain', now: () => soir })).ok, false);
  assert.deepEqual(await compte({ B: blob, P: 'preview', who: 'Romain', now: () => minuit }), { ok: true, n: 1 });
});

test('compte : deux appels simultanés retenus par la porte → le compteur finit à 2', async () => {
  const blob = createFakeBlob({ gate: createGate(2) });
  const base = { B: blob, P: 'preview', who: 'Romain', now: () => T };
  const [a, b] = await Promise.all([compte(base), compte(base)]);
  assert.ok(a.ok && b.ok);
  assert.equal(blob.store.get(`preview/quota/${JOUR}/romain.json`).text, '{"n":2}');
});

test('compte : deux appels simultanés sur un compteur déjà créé (ifMatch perdu, relu une fois) → 3 au total', async () => {
  const blob = createFakeBlob({ gate: createGate(2) });
  await blob.put(`preview/quota/${JOUR}/romain.json`, '{"n":1}', { access: 'private', contentType: 'application/json' });
  const base = { B: blob, P: 'preview', who: 'Romain', now: () => T };
  await Promise.all([compte(base), compte(base)]);
  assert.equal(blob.store.get(`preview/quota/${JOUR}/romain.json`).text, '{"n":3}');
});

// ── erreurs d’OpenAI

test('erreurIA : les cinq codes de budget → 429 budget_ia ; autre 429 → ia_occupee', () => {
  assert.equal(BUDGET_CODES.size, 5);
  for (const code of BUDGET_CODES) {
    const r = erreurIA(erreurApi(429, code));
    assert.equal(r.status, 429); assert.deepEqual(r.body, { error: 'budget_ia', message: 'Budget d’IA du mois atteint — l’IA reprend le mois prochain' }, code);
  }
  for (const code of [undefined, 'rate_limit_exceeded', 'inconnu']) {
    const r = erreurIA(erreurApi(429, code));
    assert.equal(r.status, 429); assert.deepEqual(r.body, { error: 'ia_occupee', message: MESSAGES.ia_occupee }, String(code));
  }
});

test('erreurIA : 401 et 403 → 502 ; autres statuts d’OpenAI gardés ; erreur ordinaire → 500 ; message borné à 300 caractères', () => {
  assert.equal(erreurIA(erreurApi(401, 'invalid_api_key')).status, 502);
  assert.equal(erreurIA(erreurApi(403, null)).status, 502);
  assert.equal(erreurIA(erreurApi(400, null)).status, 400);
  assert.equal(erreurIA(erreurApi(503, null)).status, 503);
  assert.equal(erreurIA(new Error('panne')).status, 500);
  assert.equal(erreurIA('texte brut').status, 500);
  for (const err of [new Error('x'.repeat(1000)), erreurApi(500, null, 'y'.repeat(1000)), erreurApi(401, null, 'z'.repeat(1000))]) {
    const r = erreurIA(err);
    assert.ok(r.body.error.length > 0 && r.body.error.length <= 300, `${r.status} : ${r.body.error.length} caractères`);
  }
});

// ── store: false

test('createIA.appelle : store:false vient en dernier, rien dans les paramètres ne peut l’écraser', async () => {
  const { client, appels } = faux();
  const ia = createIA({ openai: client });
  await ia.appelle({ model: 'm', input: 'x', store: true });
  assert.equal(appels.length, 1);
  assert.equal(appels[0].store, false);
  assert.equal(appels[0].model, 'm');
});

test('createIA : le client peut être une fonction qui le rend', async () => {
  const { client, appels } = faux();
  await createIA({ openai: () => client }).appelle({ model: 'm' });
  assert.equal(appels.length, 1);
});

// ── arbitre (api/rules.js) de bout en bout, sur le faux Blob

test('arbitre : 200, store:false, un appel d’OpenAI, le compteur du prénom passe à 1', async () => {
  const { client, appels } = faux();
  const { blob, handler } = arbitre({ client });
  const r = await demande(handler);
  assert.equal(r.status, 200);
  assert.equal(r.body.verdict, SORTIE_ARBITRE.verdict);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].store, false);
  assert.equal(blob.store.get(`preview/quota/${JOUR}/romain.json`).text, '{"n":1}');
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('arbitre : le 31e appel du jour reçoit 429 quota_equipier, sans appel d’OpenAI ni écriture de plus', async () => {
  const { client, appels } = faux();
  const { blob, handler } = arbitre({ client });
  for (let i = 0; i < QUOTA; i++) assert.equal((await demande(handler)).status, 200, `appel ${i + 1}`);
  const puts = blob.ops.put;
  const r = await demande(handler);
  assert.equal(r.status, 429);
  assert.deepEqual(r.body, { error: 'quota_equipier', message: 'Limite d’IA du jour atteinte — reprise demain' });
  assert.equal(appels.length, QUOTA, 'aucun appel d’OpenAI pour le 31e');
  assert.equal(blob.ops.put, puts, 'aucune écriture pour le 31e');
  assert.equal((await demande(handler, 'Teiva')).status, 200, 'un autre équipier le même jour');
});

test('arbitre : question vide → 400, sans appel au compteur ; sans clé → 503, sans appel au compteur', async () => {
  const { client, appels } = faux();
  const { blob, handler } = arbitre({ client });
  let r = await demande(handler, 'Romain', { question: '   ' });
  assert.equal(r.status, 400);
  r = await invoke(handler, { method: 'POST', url: '/api/rules', headers: entete('Romain') });
  assert.equal(r.status, 400);
  const cle = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try { r = await demande(handler); assert.equal(r.status, 503); assert.deepEqual(r.body, { error: 'no_key' }); } finally { process.env.OPENAI_API_KEY = cle; }
  r = await invoke(handler, { method: 'GET', url: '/api/rules', headers: entete('Romain') });
  assert.equal(r.status, 405);
  assert.equal(blob.ops.get, 0, 'ni lu ni compté'); assert.equal(blob.ops.put, 0);
  assert.equal(appels.length, 0);
});

test('arbitre : sans x-rt-membre valide → 403 membre_inconnu, sans compteur ni appel', async () => {
  const { client, appels } = faux();
  const { blob, handler } = arbitre({ client });
  for (const h of [undefined, '', '%E0%A4%A', 'x'.repeat(41), 'Rom/ain']) {
    const r = await invoke(handler, { method: 'POST', url: '/api/rules', body: { question: 'Q ?' }, headers: h === undefined ? {} : { 'x-rt-membre': h } });
    assert.equal(r.status, 403, String(h)); assert.deepEqual(r.body, { error: 'membre_inconnu' });
  }
  assert.equal(blob.ops.get, 0); assert.equal(appels.length, 0);
});

test('arbitre : un prénom dans le corps ou dans l’adresse est ignoré, seul l’en-tête du middleware compte', async () => {
  const { client } = faux();
  const { blob, handler } = arbitre({ client });
  const r = await demande(handler, 'Romain', { question: 'Q ?', membre: 'Teiva', who: 'Thibaud', by: 'Teiva' }, { url: '/api/rules?membre=Teiva&who=Thibaud', headers: { ...entete('Romain'), 'x-forwarded-for': 'Teiva', cookie: 'membre=Teiva' } });
  assert.equal(r.status, 200);
  assert.deepEqual([...blob.store.keys()], [`preview/quota/${JOUR}/romain.json`]);
});

test('arbitre : VERCEL_ENV=production → prod/, sinon preview/', async () => {
  for (const [env, attendu] of [['production', 'prod'], ['preview', 'preview'], [undefined, 'preview']]) {
    await avecEnv(env, async () => {
      assert.equal(prefix(), attendu);
      const { blob, handler } = arbitre();
      assert.equal((await demande(handler)).status, 200);
      assert.deepEqual([...blob.store.keys()], [`${attendu}/quota/${JOUR}/romain.json`], String(env));
    });
  }
});

// ── compteur ouvert en panne (D-06)

async function avecAvertissements(fn) {
  const m = mock.method(console, 'warn', () => {});
  try { await fn(); return m.mock.calls.map((c) => c.arguments.join(' ')); } finally { m.mock.restore(); }
}
const sansTrace = (avertissements, ...mots) => {
  for (const a of avertissements) for (const mot of mots) assert.ok(!a.toLowerCase().includes(mot.toLowerCase()), `l’avertissement contient « ${mot} » : ${a}`);
};

test('panne de lecture du Blob → 200, un seul avertissement sans prénom, clé ni texte', async () => {
  const { client, appels } = faux();
  const { blob, handler } = arbitre({ client });
  blob.failNext(new Error('panne du magasin'), { op: 'get' });
  const w = await avecAvertissements(async () => {
    const r = await demande(handler, 'Romain', { question: 'Question confidentielle sur Teiva' });
    assert.equal(r.status, 200);
  });
  assert.equal(w.length, 1);
  sansTrace(w, 'romain', 'cle-de-test', 'confidentielle', 'quota/', 'preview');
  assert.equal(appels.length, 1);
});

test('écriture perdue deux fois → 200 et un seul avertissement ; perdue une fois → recomptée, aucun avertissement', async () => {
  const { client } = faux();
  let { blob, handler } = arbitre({ client });
  blob.failNext(new blob.BlobPreconditionFailedError(), { op: 'put', times: 2 });
  let w = await avecAvertissements(async () => { assert.equal((await demande(handler)).status, 200); });
  assert.equal(w.length, 1); sansTrace(w, 'romain', 'cle-de-test');
  ({ blob, handler } = arbitre({ client }));
  blob.failNext(new blob.BlobPreconditionFailedError(), { op: 'put', times: 1 });
  w = await avecAvertissements(async () => { assert.equal((await demande(handler)).status, 200); });
  assert.equal(w.length, 0, 'une seule perte est rejouée sans bruit');
  assert.equal(blob.store.get(`preview/quota/${JOUR}/romain.json`).text, '{"n":1}');
});

test('compteur illisible → 200 et un avertissement', async () => {
  const { blob, handler } = arbitre();
  await blob.put(`preview/quota/${JOUR}/romain.json`, 'pas du json', { access: 'private', contentType: 'application/json' });
  const w = await avecAvertissements(async () => { assert.equal((await demande(handler)).status, 200); });
  assert.equal(w.length, 1);
});

test('lecture retenue indéfiniment : abandonnée après le délai, l’appel passe', async () => {
  assert.equal(DELAI_MS, 2000);
  const blob = createFakeBlob({ gate: () => new Promise(() => {}) });
  const { handler } = arbitre({ blob, delai: 25 });
  const t0 = Date.now();
  const w = await avecAvertissements(async () => { assert.equal((await demande(handler)).status, 200); });
  assert.ok(Date.now() - t0 < 1500, 'la minuterie de 25 ms a tranché');
  assert.equal(w.length, 1);
});

test('ni Blob injecté ni jeton configuré → 200, aucun compteur, aucun avertissement', async () => {
  const { client, appels } = faux();
  const handler = creeArbitre({ openai: client, now: () => T });
  const w = await avecAvertissements(async () => { assert.equal((await demande(handler)).status, 200); });
  assert.equal(w.length, 0);
  assert.equal(appels.length, 1); assert.equal(appels[0].store, false);
});

test('erreurs d’OpenAI vues par la page : budget → 429 budget_ia, occupé → 429 ia_occupee, clé refusée → 502', async () => {
  for (const [err, statut, corps] of [
    [erreurApi(429, 'project_spend_limit_exceeded'), 429, { error: 'budget_ia', message: MESSAGES.budget_ia }],
    [erreurApi(429, 'rate_limit_exceeded'), 429, { error: 'ia_occupee', message: MESSAGES.ia_occupee }],
  ]) {
    const { handler } = arbitre({ client: faux(SORTIE_ARBITRE, err).client });
    const r = await demande(handler);
    assert.equal(r.status, statut); assert.deepEqual(r.body, corps);
  }
  const { handler } = arbitre({ client: faux(SORTIE_ARBITRE, erreurApi(401, 'invalid_api_key', 'Incorrect API key')).client });
  const r = await demande(handler);
  assert.equal(r.status, 502);
});
