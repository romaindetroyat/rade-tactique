// js/archheavy.js (ARCH-03, D-03) : objets lourds de l'archive (traces, rapports, vent figé du jour). Trois « téléphones » purs (régates, traces,
// méta, horloge) appellent le VRAI gestionnaire d'api/archive.js sur un faux Blob partagé : aucun réseau. La page est remplacée par des
// dépendances injectées ; les bases locales par des Map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { createHandler } from '../api/archive.js';
import { createFakeBlob, invoke } from './helpers/fakeblob.mjs';
import { bodyOf } from './helpers/scan.mjs';
import { HORIZON_DAYS, MAX_PER_PASS, inHorizon, heavyPlan, runHeavy, itemKey, cleanTrace, cleanReport } from '../js/archheavy.js';

const T0 = Date.parse('2026-11-10T09:00:00Z');
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const pts = (n = 6) => Array.from({ length: n }, (_, i) => [T0 + i * 1000, 43.07 + i * 1e-4, 5.93, 5, 90, 5]);
const trace = (id, over = {}) => ({ id, name: `Trace ${id}`, start: T0, course: null, pts: pts(), brk: [], imported: true, ...over });
const regate = (id, traces = [], over = {}) => ({ id, name: `Régate ${id}`, club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-08', season: 2026, races: [], ic: null, marks: [], courses: [], frozen: {}, traces, by: 'Teiva', at: 0, ...over });
const ref = (id, over = {}) => ({ id, name: `Trace ${id}`, start: T0, n: 6, by: 'Teiva', at: T0, ...over });

// Le monde : un faux Blob, la vraie fonction, une horloge commune
function monde() {
  const clock = { t: T0 }, blob = createFakeBlob(), handler = createHandler({ blob, now: () => clock.t });
  return { clock, blob, handler };
}
// Un téléphone : régates, traces locales (Map), méta, course, verrou ; deps = ce que js/app.js passerait à runHeavy
function telephone(nom, w, { list = [] } = {}) {
  const p = { nom, list, tracks: new Map(), meta: {}, active: false, locked: false, errors: [], appels: [], reseau: null };
  p.deps = {
    now: () => w.clock.t, meta: p.meta, saveMeta() {}, getList: () => p.list,
    async fetchJson(method, query, body) {
      p.appels.push({ method, k: query.k, id: query.id });
      if (p.reseau) return p.reseau(method, query, body);
      const r = await invoke(w.handler, { method, url: '/api/archive?' + new URLSearchParams(query), body, headers: { 'x-rt-membre': encodeURIComponent(nom) } });
      return { status: r.status, body: r.body };
    },
    async listTracks() { return [...p.tracks.values()].map((t) => ({ id: t.id, rt: t.report?.t ?? null })); },
    async getTrack(id) { return clone(p.tracks.get(id)); },
    async saveTrack(tr) { p.tracks.set(tr.id, clone(tr)); },
    isActive: () => p.active, isLocked: () => p.locked || p.active, report: (ou, e) => p.errors.push(`${ou}: ${e.message}`),
  };
  return p;
}
const rapport = (t = 5000, html = '<!doctype html><title>Rapport archive test</title>') => ({ html, t, name: 'Débrief test' });

// ───────────────────────── plan

test('inHorizon : régate terminée depuis moins de 180 jours (jour de Paris) ou à venir ; plus ancienne exclue ; sans date incluse', () => {
  const now = Date.parse('2027-05-01T10:00:00Z');                            // 180 jours avant : 2026-11-02
  assert.equal(HORIZON_DAYS, 180);
  assert.equal(inHorizon(regate('a', [], { dateStart: '2026-11-02', dateEnd: '' }), now), true, 'exactement 180 jours : incluse');
  assert.equal(inHorizon(regate('b', [], { dateStart: '2026-11-01', dateEnd: '2026-11-01' }), now), false, '181 jours : exclue');
  assert.equal(inHorizon(regate('c', [], { dateStart: '2026-10-30', dateEnd: '2026-11-03' }), now), true, 'le DERNIER jour compte');
  assert.equal(inHorizon(regate('d', [], { dateStart: '2027-06-10', dateEnd: '' }), now), true, 'à venir');
  assert.equal(inHorizon({ id: 'e', name: 'brouillon' }, now), true);
  assert.equal(inHorizon(regate('f', [], { dateStart: '2026-11-01', dateEnd: '' }), Date.parse('2027-04-30T23:30:00Z')), false, 'le jour est celui de Paris : 01:30 le 1er mai à Paris');
});

test('plan : trace locale jamais envoyée → envoi de la trace puis de son rapport ; trace absente localement → téléchargement de la trace puis de son rapport', () => {
  const list = [regate('rg1', [ref('tr1', { report: { t: 5000, by: 'Teiva' } })])];
  const envoi = heavyPlan({ list, localTraces: [{ id: 'tr1', rt: 5000 }], now: T0 });
  assert.deepEqual(envoi, { up: [{ k: 'trace', id: 'tr1' }, { k: 'report', id: 'tr1', t: 5000 }], down: [] });
  const sans = heavyPlan({ list, localTraces: [{ id: 'tr1', rt: null }], now: T0 });
  assert.deepEqual(sans.up, [{ k: 'trace', id: 'tr1' }], 'pas de rapport local : pas d’envoi de rapport');
  assert.deepEqual(sans.down, [{ k: 'report', id: 'tr1', t: 5000 }], 'le rapport du fichier partagé, lui, est à télécharger');
  const reception = heavyPlan({ list, localTraces: [], now: T0 });
  assert.deepEqual(reception, { up: [], down: [{ k: 'trace', id: 'tr1' }, { k: 'report', id: 'tr1', t: 5000 }] });
  assert.deepEqual(heavyPlan({ list: [regate('rg2', [ref('tr2')])], localTraces: [], now: T0 }).down, [{ k: 'trace', id: 'tr2' }], 'pas de rapport annoncé : pas de rapport demandé');
});

test('plan : ce qui est déjà envoyé ou reçu ne repart jamais ; un rapport refait repart ; un rapport local plus récent ne se télécharge pas', () => {
  const list = [regate('rg1', [ref('tr1', { report: { t: 5000, by: 'Teiva' } })])];
  const fait = { up: { 'trace:tr1': 1, 'report:tr1': 5000 } };
  assert.deepEqual(heavyPlan({ list, meta: fait, localTraces: [{ id: 'tr1', rt: 5000 }], now: T0 }), { up: [], down: [] });
  assert.deepEqual(heavyPlan({ list, meta: fait, localTraces: [{ id: 'tr1', rt: 6000 }], now: T0 }).up, [{ k: 'report', id: 'tr1', t: 6000 }], 'un rapport refait est un autre objet');
  const recu = { down: { 'trace:tr1': 1, 'report:tr1': 5000 } };
  assert.deepEqual(heavyPlan({ list, meta: recu, localTraces: [{ id: 'tr1', rt: 5000 }], now: T0 }), { up: [], down: [] }, 'une trace et un rapport téléchargés ne sont pas renvoyés');
  assert.deepEqual(heavyPlan({ list, localTraces: [{ id: 'tr1', rt: 7000 }], now: T0 }).down, [], 'rapport local plus récent que celui de la fiche');
  assert.deepEqual(heavyPlan({ list, meta: { up: { 'trace:tr1': 'trop-gros' } }, localTraces: [{ id: 'tr1', rt: null }], now: T0 }).up, [], 'trop gros : abandonné, pas de boucle');
});

test('plan : horizon de 180 jours, régates à venir, `only` sans horizon ; objet annoncé mais absent (404) : pas redemandé avant 30 minutes', () => {
  const vieille = regate('vieille', [ref('trv')], { dateStart: '2026-03-01', dateEnd: '2026-03-02' });
  const recente = regate('recente', [ref('trr')]);
  const avenir = regate('avenir', [ref('tra')], { dateStart: '2027-01-10', dateEnd: '' });
  const ids = (p) => p.down.map((x) => x.id);
  assert.deepEqual(ids(heavyPlan({ list: [vieille, recente, avenir], localTraces: [], now: T0 })), ['tra', 'trr'], 'à venir d’abord (la plus récente), la vieille exclue');
  assert.deepEqual(ids(heavyPlan({ list: [vieille, recente, avenir], localTraces: [], now: T0, only: 'vieille' })), ['trv'], 'le geste ignore l’horizon et ne touche qu’à cette régate');
  const miss = { miss: { 'trace:trr': T0 - 10 * 60e3 } };
  assert.deepEqual(ids(heavyPlan({ list: [recente], meta: miss, localTraces: [], now: T0 })), [], 'absent il y a 10 minutes');
  assert.deepEqual(ids(heavyPlan({ list: [recente], meta: miss, localTraces: [], now: T0 + 25 * 60e3 })), ['trr'], 'redemandé après 30 minutes');
  assert.deepEqual(ids(heavyPlan({ list: [recente], meta: miss, localTraces: [], now: T0, only: 'recente' })), ['trr'], 'le geste redemande tout de suite');
});

test('plan : au plus 6 objets par passage, envois d’abord', () => {
  const traces = Array.from({ length: 5 }, (_, i) => ref(`t${i}`));
  const list = [regate('rg1', traces)];
  const mixte = heavyPlan({ list, localTraces: [{ id: 't0', rt: null }, { id: 't1', rt: null }], now: T0 });
  assert.equal(MAX_PER_PASS, 6);
  assert.deepEqual(mixte.up.map((x) => x.id), ['t0', 't1']);
  assert.deepEqual(mixte.down.map((x) => x.id), ['t2', 't3', 't4']);
  const beaucoup = heavyPlan({ list: [regate('rg1', Array.from({ length: 9 }, (_, i) => ref(`u${i}`)))], localTraces: [], now: T0 });
  assert.equal(beaucoup.down.length, 6);
  const tout = heavyPlan({ list: [regate('rg1', Array.from({ length: 9 }, (_, i) => ref(`v${i}`)))], localTraces: Array.from({ length: 9 }, (_, i) => ({ id: `v${i}`, rt: 100 + i })), now: T0 });
  assert.equal(tout.up.length, 6, 'envois plafonnés aussi'); assert.deepEqual(tout.down, []);
  assert.equal(itemKey({ k: 'trace', id: 'x' }), 'trace:x'); assert.equal(itemKey({ k: 'report', id: 'x', t: 1 }), 'report:x'); assert.equal(itemKey({ k: 'day', r: 'rg', d: '2026-11-07' }), 'day:rg|2026-11-07');
});

// ───────────────────────── trois téléphones

test('tracer : A envoie sa trace et son rapport ; B les télécharge dans ses bases locales ; getTrack de B rend la trace avec son rapport ; rien ne repart', async () => {
  const w = monde();
  const liste = () => [regate('rg1', [ref('tr1', { report: { t: 5000, by: 'Teiva' } })])];
  const A = telephone('Teiva', w, { list: liste() }), B = telephone('Thibaud', w, { list: liste() }), C = telephone('Romain', w, { list: liste() });
  A.tracks.set('tr1', trace('tr1', { report: rapport(5000) }));
  const a = await runHeavy(A.deps);
  assert.deepEqual(a, { up: 2, down: 0 });
  assert.ok(w.blob.store.has('preview/trace/tr1.json') && w.blob.store.has('preview/report/tr1-5000.json'));
  assert.ok(!('report' in JSON.parse(w.blob.store.get('preview/trace/tr1.json').text)), 'la trace en ligne est sans rapport');
  const b = await runHeavy(B.deps);
  assert.deepEqual(b, { up: 0, down: 2 });
  const tb = await B.deps.getTrack('tr1');
  assert.equal(tb.pts.length, 6); assert.equal(tb.name, 'Trace tr1');
  assert.deepEqual(tb.report, rapport(5000), 'le rapport écrit sur le téléphone de A est lisible sur celui de B');
  assert.equal(B.appels.filter((x) => x.method === 'PUT').length, 0, 'une trace téléchargée n’est pas renvoyée');
  // passages suivants : plus rien d'échangé nulle part
  const puts = w.blob.ops.put, gets = w.blob.ops.get;
  assert.deepEqual(await runHeavy(B.deps), { up: 0, down: 0 });
  assert.deepEqual(await runHeavy(A.deps), { up: 0, down: 0 });
  assert.equal(w.blob.ops.put, puts, 'aucune réécriture'); assert.equal(w.blob.ops.get, gets, 'aucune lecture inutile');
  // C reçoit la même chose ; la trace déjà en ligne n'a pas été réécrite par un second envoyeur
  assert.deepEqual(await runHeavy(C.deps), { up: 0, down: 2 });
  const puts2 = w.blob.ops.put;
  C.meta.up = {}; C.meta.down = {}; C.tracks.set('tr1', trace('tr1', { report: rapport(5000) }));
  const c2 = await runHeavy(C.deps);
  assert.equal(c2.up, 2, 'C croit devoir envoyer : le serveur répond « exists »');
  assert.equal(w.blob.ops.put, puts2, 'objets immuables : pas de réécriture');
});

test('un rapport refait sur A est un nouvel objet : B le reçoit et remplace l’ancien ; un rapport local plus récent n’est pas remplacé', async () => {
  const w = monde();
  const A = telephone('Teiva', w, { list: [regate('rg1', [ref('tr1', { report: { t: 5000, by: 'Teiva' } })])] }), B = telephone('Thibaud', w, { list: [regate('rg1', [ref('tr1', { report: { t: 5000, by: 'Teiva' } })])] });
  A.tracks.set('tr1', trace('tr1', { report: rapport(5000) }));
  await runHeavy(A.deps); await runHeavy(B.deps);
  A.tracks.get('tr1').report = rapport(9000, '<!doctype html><title>Rapport refait</title>');
  A.list = [regate('rg1', [ref('tr1', { report: { t: 9000, by: 'Teiva' } })])]; B.list = clone(A.list);
  assert.deepEqual(await runHeavy(A.deps), { up: 1, down: 0 });
  assert.deepEqual(await runHeavy(B.deps), { up: 0, down: 1 });
  assert.match((await B.deps.getTrack('tr1')).report.html, /Rapport refait/);
  assert.ok(w.blob.store.has('preview/report/tr1-5000.json') && w.blob.store.has('preview/report/tr1-9000.json'), 'l’ancien reste en ligne');
  // B a refait un rapport plus récent entre-temps : il garde le sien
  const B2 = telephone('Romain', w, { list: clone(A.list) });
  B2.tracks.set('tr1', trace('tr1', { report: rapport(12000, '<title>à moi</title>') }));
  B2.meta.up = { 'trace:tr1': 1, 'report:tr1': 12000 };
  assert.deepEqual(await runHeavy(B2.deps), { up: 0, down: 0 }, 'rien à recevoir : le rapport local est plus récent');
});

test('D-03 : rien n’est appelé si une course est active ou si la journée de régate est verrouillée ; une course commencée entre deux objets arrête le passage', async () => {
  const w = monde();
  const A = telephone('Teiva', w, { list: [regate('rg1', [ref('tr1', { report: { t: 5000, by: 'Teiva' } }), ref('tr2')])] });
  A.tracks.set('tr1', trace('tr1', { report: rapport(5000) })); A.tracks.set('tr2', trace('tr2'));
  A.active = true;
  assert.deepEqual(await runHeavy(A.deps), { up: 0, down: 0, skipped: 'course' });
  A.active = false; A.locked = true;
  assert.deepEqual(await runHeavy(A.deps), { up: 0, down: 0, skipped: 'journee' });
  assert.equal(A.appels.length, 0, 'aucun appel réseau');
  assert.equal(w.blob.ops.get + w.blob.ops.put + w.blob.ops.head, 0);
  A.locked = false;
  // la course démarre pendant le premier envoi : aucun second objet
  const reseau = A.deps.fetchJson;
  A.deps.fetchJson = async (...a) => { const r = await reseau(...a); A.active = true; return r; };
  const r = await runHeavy(A.deps);
  assert.equal(r.skipped, 'course'); assert.equal(r.up, 1, 'le premier objet est parti, pas le deuxième');
  assert.equal(A.appels.length, 1);
});

test('échange abandonné parce qu’une course commence (requête interrompue) : un arrêt, pas une erreur, rien de consigné', async () => {
  const w = monde();
  const A = telephone('Teiva', w, { list: [regate('rg1', [ref('tr1')])] }); A.tracks.set('tr1', trace('tr1'));
  A.reseau = async () => { A.active = true; throw new Error('The operation was aborted'); };
  const r = await runHeavy(A.deps);
  assert.deepEqual(r, { up: 0, down: 0, skipped: 'course' });
  assert.deepEqual(A.errors, []);
});

test('erreurs : 404 → objet noté absent (pas de boucle), 401 → accès refusé et arrêt, 413 → abandonné, panne réseau → arrêt au premier échec consigné', async () => {
  const w = monde();
  // 404 : la fiche annonce une trace que son auteur n'a pas encore envoyée
  const B = telephone('Thibaud', w, { list: [regate('rg1', [ref('tr1'), ref('tr2')])] });
  const r1 = await runHeavy(B.deps);
  assert.deepEqual(r1, { up: 0, down: 0 }, 'rien de reçu, mais pas d’erreur');
  assert.equal(B.appels.length, 2);
  assert.ok(B.meta.miss['trace:tr1'] && B.meta.miss['trace:tr2']);
  await runHeavy(B.deps);
  assert.equal(B.appels.length, 2, 'pas redemandé tout de suite');
  w.clock.t += 31 * 60e3;
  await runHeavy(B.deps);
  assert.equal(B.appels.length, 4, 'redemandé 30 minutes plus tard');
  // 401
  const A = telephone('Teiva', w, { list: [regate('rg1', [ref('tr1'), ref('tr2')])] });
  A.tracks.set('tr1', trace('tr1')); A.tracks.set('tr2', trace('tr2'));
  A.reseau = async () => ({ status: 401, body: { error: 'acces' } });
  const r2 = await runHeavy(A.deps);
  assert.deepEqual([r2.up, r2.error], [0, 'acces']); assert.equal(A.meta.denied, true); assert.equal(A.appels.length, 1, 'arrêt au premier refus');
  // 413
  const gros = telephone('Romain', w, { list: [regate('rg1', [ref('tr1'), ref('tr2')])] });
  gros.tracks.set('tr1', trace('tr1')); gros.tracks.set('tr2', trace('tr2'));
  gros.reseau = async (m, q) => (q.id === 'tr1' ? { status: 413, body: { error: 'objet trop volumineux' } } : { status: 200, body: { ok: true } });
  const r3 = await runHeavy(gros.deps);
  assert.deepEqual([r3.up, gros.meta.up['trace:tr1'], gros.meta.up['trace:tr2']], [1, 'trop-gros', 1]);
  assert.deepEqual(heavyPlan({ list: gros.list, meta: gros.meta, localTraces: [{ id: 'tr1', rt: null }, { id: 'tr2', rt: null }], now: T0 }), { up: [], down: [] });
  // panne réseau : consignée, arrêt, aucune exception
  const P = telephone('Teiva', w, { list: [regate('rg1', [ref('tr7'), ref('tr8')])] });
  P.tracks.set('tr7', trace('tr7')); P.tracks.set('tr8', trace('tr8'));
  P.reseau = async () => { throw new Error('réseau coupé'); };
  const r4 = await runHeavy(P.deps);
  assert.equal(r4.up, 0); assert.match(r4.error, /réseau coupé/); assert.equal(P.appels.length, 1);
  assert.deepEqual(P.errors, ['archive: réseau coupé']);
});

test('écriture locale refusée (stockage plein) : arrêt du passage, consigné, rien n’est marqué reçu', async () => {
  const w = monde();
  const A = telephone('Teiva', w, { list: [regate('rg1', [ref('tr1'), ref('tr2')])] }); A.tracks.set('tr1', trace('tr1')); A.tracks.set('tr2', trace('tr2'));
  await runHeavy(A.deps);
  const B = telephone('Thibaud', w, { list: clone(A.list) });
  B.deps.saveTrack = async () => { throw new Error('QuotaExceededError'); };
  const r = await runHeavy(B.deps);
  assert.match(r.error, /Quota/); assert.equal(r.down, 0); assert.equal(B.appels.length, 1, 'arrêt au premier échec');
  assert.deepEqual(B.meta.down || {}, {}); assert.match(B.errors[0], /archive: QuotaExceededError/);
});

test('cleanTrace / cleanReport : champs connus seulement, points vérifiés, rapport sans instant cohérent refusé', () => {
  const ok = cleanTrace({ ...trace('x'), report: { html: 'piège' }, extra: { a: 1 }, __proto__: { p: 1 } }, 'x');
  assert.deepEqual(Object.keys(ok).sort(), ['brk', 'course', 'id', 'imported', 'name', 'pts', 'start']);
  assert.equal(cleanTrace(trace('x'), 'y'), null);
  assert.equal(cleanTrace({ ...trace('x'), pts: [[1, 2, 3]] }, 'x'), null, 'moins de deux points');
  assert.equal(cleanTrace({ ...trace('x'), pts: [[1, 2, 3], [1, 'a', 3]] }, 'x'), null);
  assert.equal(cleanTrace(null, 'x'), null);
  assert.deepEqual(cleanReport({ html: '<p>', t: 5, name: 'N', plus: 1 }, 5), { html: '<p>', t: 5, name: 'N' });
  assert.equal(cleanReport({ html: '<p>', t: 6 }, 5), null); assert.equal(cleanReport({ t: 5 }, 5), null);
});

// ───────────────────────── gardes statiques

test('garde : le rapport d’un autre téléphone ne peut rien exécuter — cadre en sandbox sans allow-scripts ni allow-same-origin, « Plein écran » précédé de script-src \'none\'', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8'), corps = bodyOf(app, 'showReport');
  assert.ok(corps, 'showReport existe');
  assert.match(corps, /rpFrame[\s\S]{0,200}\.setAttribute\(\s*['"]sandbox['"]\s*,\s*['"]['"]\s*\)|<iframe[^>]*\bsandbox\b/, 'le cadre porte un attribut sandbox');
  assert.doesNotMatch(corps, /allow-scripts|allow-same-origin/, 'ni scripts ni même origine');
  assert.match(corps, /script-src 'none'/, 'politique de contenu qui interdit les scripts');
  assert.match(corps, /http-equiv=["']Content-Security-Policy["']|Content-Security-Policy/i);
  assert.ok(corps.indexOf("script-src 'none'") < corps.indexOf('createObjectURL'), 'la politique précède la création de l’adresse locale');
  assert.match(corps, /srcdoc/);
});

test('garde : listTracks lit par curseur (jamais getAll) et rend les mêmes champs qu’avant plus rt', () => {
  const src = readFileSync(ROOT + 'js/track.js', 'utf8').replace('export async function listTracks', 'async function listTracks'), corps = bodyOf(src, 'listTracks');
  assert.ok(corps, 'listTracks existe');
  assert.match(corps, /openCursor/); assert.doesNotMatch(corps, /getAll/);
  assert.match(corps, /\{ id: t\.id, name: t\.name, start: t\.start, n: t\.pts\.length, course: t\.course, rt: t\.report\?\.t \?\? null \}/);
});

test('câblage : js/app.js charge archheavy.js par import dynamique et appelle runHeavy après une synchronisation légère réussie', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /import\(['"]\.\/archheavy\.js['"]\)/);
  assert.match(app, /runHeavy\(/);
  assert.doesNotMatch(app.split('\n').filter((l) => /^import /.test(l)).join('\n'), /archheavy/, 'jamais d’import statique : l’ouverture ne l’attend pas');
});
