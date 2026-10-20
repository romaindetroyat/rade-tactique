// api/_ia.js et les fonctions d’IA bornées (SECU2-01, D-05 à D-07) : sans réseau, sans clé réelle, sur le faux Blob de tests/helpers/fakeblob.mjs.
// Vérifié : `store: false` posé en un seul endroit et impossible à écraser, quota de 30 appels par équipier et par jour de Paris (le 31e reçoit
// 429 sans appel à OpenAI), prénom lu dans le seul en-tête du middleware, compteur ouvert en panne, erreurs d’OpenAI traduites et bornées.
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import OpenAI from 'openai';
import { ROOT } from './helpers/setup.mjs';
import {
  QUOTA, DELAI_MS, MESSAGES, BUDGET_CODES, jourParis, cheminQuota, compte, erreurIA, createIA, prefix,
} from '../api/_ia.js';
import * as voix from '../api/voice.js';
import * as debrief from '../api/debrief.js';
import * as lecture from '../api/ic.js';
import * as regles from '../api/rules.js';
import * as archive from '../api/archive.js';
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

// ── les quatre fonctions partagent la même aide (tâche 2)

// Corps valide minimal de chaque fonction
const FONCTIONS = [
  ['voice', voix, '/api/voice', { alts: ['vent au 300 12 nœuds'] }],
  ['debrief', debrief, '/api/debrief', { bords: [{ nom: 'Bord 1' }] }],
  ['rules', regles, '/api/rules', { question: 'Bâbord / tribord ?' }],
  ['ic', lecture, '/api/ic', { text: 'Instructions de course. '.repeat(20) }],
];
function fonction(module, { blob = createFakeBlob(), client = faux().client } = {}) {
  assert.equal(typeof module.createHandler, 'function', 'la fonction exporte createHandler({ openai, blob, now })');
  return module.createHandler({ openai: client, blob, now: () => T });
}
const appelFonction = (handler, url, body, nom = 'Romain') => invoke(handler, { method: 'POST', url, body, headers: nom ? entete(nom) : {} });

for (const [nom, module, url, corps] of FONCTIONS) {
  test(`${nom} : store:false dans l’argument du seul appel d’OpenAI, et le compteur du prénom passe à 1`, async () => {
    const { client, appels } = faux();
    const blob = createFakeBlob();
    const r = await appelFonction(fonction(module, { blob, client }), url, corps);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(appels.length, 1);
    assert.equal(appels[0].store, false);
    assert.equal(blob.store.get(`preview/quota/${JOUR}/romain.json`).text, '{"n":1}');
  });

  test(`${nom} : sans prénom du middleware → 403 sans appel ; 400 et 503 ne sont pas comptés`, async () => {
    const { client, appels } = faux();
    const blob = createFakeBlob();
    const handler = fonction(module, { blob, client });
    let r = await appelFonction(handler, url, corps, null);
    assert.equal(r.status, 403); assert.deepEqual(r.body, { error: 'membre_inconnu' });
    r = await appelFonction(handler, url, {});
    assert.equal(r.status, 400);
    const cle = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try { r = await appelFonction(handler, url, corps); assert.equal(r.status, 503); } finally { process.env.OPENAI_API_KEY = cle; }
    assert.equal(appels.length, 0);
    assert.equal(blob.ops.get, 0); assert.equal(blob.ops.put, 0);
  });
}

test('garde statique : aucun fichier de api/ n’appelle le client OpenAI sans passer par api/_ia.js', () => {
  const fichiers = readdirSync(ROOT + 'api').filter((f) => f.endsWith('.js'));
  assert.ok(fichiers.includes('_ia.js') && fichiers.length >= 6);
  for (const f of fichiers) {
    const source = readFileSync(ROOT + 'api/' + f, 'utf8');
    if (f === '_ia.js') { assert.equal((source.match(/responses\s*\.\s*create/g) || []).length, 1, 'un seul appel du client, dans _ia.js'); continue; }
    assert.ok(!/responses\s*\.\s*create/.test(source), `${f} : appel direct du client OpenAI`);
    assert.ok(!/new\s+OpenAI\s*\(/.test(source), `${f} : client OpenAI créé hors de _ia.js`);
  }
  for (const f of ['voice.js', 'debrief.js', 'ic.js', 'rules.js']) {
    const source = readFileSync(ROOT + 'api/' + f, 'utf8');
    assert.equal((source.match(/createIA\(/g) || []).length, 1, `${f} : createIA( une fois`);
    assert.match(source, /export default createHandler\(\)/, `${f} : export par défaut`);
  }
});

test('quota commun : 10 dictées + 10 débriefs + 10 questions puis une lecture d’IC du même équipier → 429 ; un autre équipier → 200', async () => {
  const { client, appels } = faux();
  const blob = createFakeBlob();
  const [voice, deb, reg, ic] = FONCTIONS.map(([, module]) => fonction(module, { blob, client }));
  const [, , urlIc, corpsIc] = FONCTIONS[3];
  for (let i = 0; i < 10; i++) {
    assert.equal((await appelFonction(voice, FONCTIONS[0][2], FONCTIONS[0][3])).status, 200);
    assert.equal((await appelFonction(deb, FONCTIONS[1][2], FONCTIONS[1][3])).status, 200);
    assert.equal((await appelFonction(reg, FONCTIONS[2][2], FONCTIONS[2][3])).status, 200);
  }
  assert.equal(appels.length, QUOTA);
  const puts = blob.ops.put;
  const r = await appelFonction(ic, urlIc, corpsIc);
  assert.equal(r.status, 429);
  assert.deepEqual(r.body, { error: 'quota_equipier', message: 'Limite d’IA du jour atteinte — reprise demain' });
  assert.equal(appels.length, QUOTA, 'la lecture d’IC ne part pas chez OpenAI');
  assert.equal(blob.ops.put, puts);
  assert.equal((await appelFonction(ic, urlIc, corpsIc, 'Thibaud')).status, 200, 'un autre équipier le même jour');
});

test('ic : incomplete → 502, JSON illisible → 502, 429 → ia_occupee avec message, 401 → 502, erreur simple → 500', async () => {
  const corps = FONCTIONS[3][3], url = FONCTIONS[3][2];
  const cas = async (client) => appelFonction(fonction(lecture, { client }), url, corps);
  let r = await cas({ responses: { create: async () => ({ status: 'incomplete', output_text: '' }) } });
  assert.equal(r.status, 502);
  r = await cas({ responses: { create: async () => ({ status: 'completed', output_text: '{ pas du json' }) } });
  assert.equal(r.status, 502);
  r = await cas(faux(null, erreurApi(429, 'rate_limit_exceeded')).client);
  assert.equal(r.status, 429); assert.equal(r.body.error, 'ia_occupee'); assert.ok(r.body.message.length > 0);
  r = await cas(faux(null, erreurApi(401, 'invalid_api_key')).client);
  assert.equal(r.status, 502);
  r = await cas(faux(null, new Error('panne')).client);
  assert.equal(r.status, 500);
});

// ── parité avec api/archive.js (le prénom et le préfixe doivent y être lus de la même façon)

test('parité : membre() de _ia.js est nul exactement quand api/archive.js répond 403 membre_inconnu', async () => {
  const { membre } = await import('../api/_ia.js');
  const blob = createFakeBlob(), handler = archive.createHandler({ blob, now: () => T });
  const enTetes = ['Romain', encodeURIComponent('Éloïse'), encodeURIComponent('Anne-Sophie'), encodeURIComponent('D’Artagnan'), '  Teiva  ', '', 'x'.repeat(40), 'x'.repeat(41), '%E0%A4%A', encodeURIComponent('Rom/ain'), encodeURIComponent('Jean.Luc'), encodeURIComponent('<b>'), '123', undefined];
  for (const h of enTetes) {
    const r = await invoke(handler, { method: 'GET', url: '/api/archive?k=light', headers: h === undefined ? {} : { 'x-rt-membre': h } });
    assert.equal(membre(h) === null, r.status === 403, `en-tête ${JSON.stringify(h)} : membre=${membre(h)}, archive=${r.status}`);
  }
});

test('parité : prefix() de _ia.js égale celui d’api/archive.js sous VERCEL_ENV production, preview et absent', async () => {
  for (const env of ['production', 'preview', 'development', undefined]) {
    await avecEnv(env, () => assert.equal(prefix(), archive.prefix(), String(env)));
  }
});
