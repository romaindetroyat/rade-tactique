// js/archmerge.js (ARCH-01, D-04) : fusion par éléments « dernier écrit gagne », pierres tombales, historique des valeurs écrasées, marquage des
// modifications locales. Module pur : aucun réseau, aucune horloge. Preuve de non-perte : règles une à une, puis milliers de scénarios
// aléatoires (générateur à graine) à trois téléphones qui s'échangent leurs états par un serveur, dans le désordre et avec des renvois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HIST, HEAD, LISTS, LOCAL_ONLY, canon, sameBody, wins, mergeRegatta, mergeMarks, emptyDoc, mergeDoc, docEquals, raceId, stamp, stampState,
  markDirty, toShared, fromShared, slug,
} from '../js/archmerge.js';

const reg = (over = {}) => ({
  id: 'rgA', name: 'Coupe test', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-09', season: 2026, ic: null,
  races: [], marks: [], courses: [], traces: [], frozen: {}, tomb: {}, hist: [], at: 100, by: 'Teiva', u: 1000, ub: 'Teiva', ...over,
});
const race = (id, over = {}) => ({ id, date: '2026-11-07', time: '10:55', courseId: 3, cls: 'J80', laps: 2, note: '', by: 'Teiva', u: 1000, ub: 'Teiva', ...over });
const doc = (...rs) => ({ v: 1, regattas: Object.fromEntries(rs.map((r) => [r.id, r])), tomb: {}, marks: {} });
const ids = (list) => list.map((e) => e.id);

// ───────────────────────── règles de fusion (D-04)

test('manches ajoutées des deux côtés : union par identifiant, chacune une seule fois, avec son auteur', () => {
  const a = reg({ races: [race('m1'), race('m2', { by: 'Romain', ub: 'Romain', u: 1100 })] });
  const b = reg({ races: [race('m1'), race('m3', { by: 'Thibaud', ub: 'Thibaud', u: 1200 })] });
  const m = mergeRegatta(a, b);
  assert.deepEqual(ids(m.races), ['m1', 'm2', 'm3']);
  assert.equal(m.races.find((x) => x.id === 'm2').by, 'Romain');
  assert.equal(m.races.find((x) => x.id === 'm3').by, 'Thibaud');
  assert.deepEqual(m.hist, [], 'aucun écrasement : aucun historique');
  assert.equal(canon(mergeRegatta(a, b)), canon(mergeRegatta(b, a)), 'commutative');
});

test('fiche modifiée des deux côtés : la plus récente gagne, l’autre version entre dans l’historique de la fiche', () => {
  const a = reg({ name: 'Coupe de Teiva', u: 2000, ub: 'Teiva' });
  const b = reg({ name: 'Coupe de Thibaud', u: 3000, ub: 'Thibaud' });
  const m = mergeRegatta(a, b);
  assert.equal(m.name, 'Coupe de Thibaud');
  assert.equal(m.ub, 'Thibaud');
  assert.equal(m.hist.length, 1);
  assert.deepEqual({ kind: m.hist[0].kind, id: m.hist[0].id, t: m.hist[0].t, by: m.hist[0].by, name: m.hist[0].v.name }, { kind: 'head', id: 'rgA', t: 2000, by: 'Teiva', name: 'Coupe de Teiva' });
  assert.equal(canon(mergeRegatta(b, a)), canon(m), 'même résultat dans l’autre sens');
  // une même valeur modifiée des deux côtés avec la même date : arbitrage identique partout
  const c = reg({ name: 'X', u: 5000 }), d = reg({ name: 'Y', u: 5000 });
  assert.equal(canon(mergeRegatta(c, d)), canon(mergeRegatta(d, c)));
});

test('une manche modifiée des deux côtés : la plus récente gagne, l’autre est gardée dans l’historique', () => {
  const a = reg({ races: [race('m1', { note: 'vent faible', u: 2000, ub: 'Romain' })] });
  const b = reg({ races: [race('m1', { note: 'vent fort', u: 2500, ub: 'Thibaud' })] });
  const m = mergeRegatta(a, b);
  assert.equal(m.races[0].note, 'vent fort');
  assert.equal(m.hist.length, 1);
  assert.equal(m.hist[0].kind, 'race'); assert.equal(m.hist[0].id, 'm1'); assert.equal(m.hist[0].v.note, 'vent faible');
});

test('le texte des IC de plus de 4 000 octets n’est pas recopié dans l’historique ; un petit contenu l’est', () => {
  const gros = { text: 'x'.repeat(5000) }, petit = { text: 'IC courtes' };
  const m = mergeRegatta(reg({ ic: gros, u: 1000 }), reg({ ic: { text: 'y'.repeat(5000) }, u: 2000 }));
  assert.equal(m.hist.length, 1);
  assert.equal(m.hist[0].v, null, 'seule la trace de l’écrasement reste');
  assert.equal(m.hist[0].t, 1000);
  const p = mergeRegatta(reg({ ic: petit, u: 1000 }), reg({ ic: { text: 'IC nouvelles' }, u: 2000 }));
  assert.deepEqual(p.hist[0].v.ic, petit);
});

test('l’historique garde au plus MAX_HIST entrées, les plus récentes', () => {
  let m = reg({ name: 'n0', u: 1000 });
  for (let i = 1; i <= MAX_HIST + 12; i++) m = mergeRegatta(m, reg({ name: `n${i}`, u: 1000 + i }));
  assert.equal(m.hist.length, MAX_HIST);
  assert.equal(m.name, `n${MAX_HIST + 12}`);
  assert.equal(Math.max(...m.hist.map((h) => h.t)), 1000 + MAX_HIST + 11);
});

test('manche supprimée (pierre tombale) : absente partout tant qu’elle n’est pas recréée ; recréée après la suppression : présente', () => {
  const avec = reg({ races: [race('m1', { u: 1000 })] });
  const sans = reg({ races: [], tomb: { 'race:m1': { t: 1500, by: 'Romain' } } });
  const m = mergeRegatta(avec, sans);
  assert.deepEqual(ids(m.races), [], 'la suppression l’emporte sur la version plus ancienne');
  assert.equal(canon(mergeRegatta(sans, avec)), canon(m));
  assert.deepEqual(m.tomb['race:m1'], { t: 1500, by: 'Romain' });
  // un téléphone en retard qui renvoie la manche ne la ressuscite pas
  assert.deepEqual(ids(mergeRegatta(m, avec).races), []);
  // modifiée ou recréée APRÈS la suppression : elle revient
  const apres = reg({ races: [race('m1', { u: 1800, note: 'recréée' })] });
  assert.deepEqual(ids(mergeRegatta(m, apres).races), ['m1']);
  // à égalité de date, la suppression gagne (arbitrage identique partout)
  assert.deepEqual(ids(mergeRegatta(m, reg({ races: [race('m1', { u: 1500 })] })).races), []);
});

test('régate supprimée : absente définitivement, même renvoyée par un téléphone en retard', () => {
  const tel = { ...doc(reg()), tomb: {} };
  const apresSuppression = { v: 1, regattas: {}, tomb: { 'regatta:rgA': { t: 5000, by: 'Romain' } }, marks: {} };
  const m = mergeDoc(tel, apresSuppression);
  assert.deepEqual(Object.keys(m.regattas), []);
  assert.deepEqual(Object.keys(mergeDoc(apresSuppression, tel).regattas), []);
  const tard = doc(reg({ u: 99_999, races: [race('m9', { u: 99_999 })] }));        // modifiée APRÈS la suppression : reste supprimée (définitif)
  assert.deepEqual(Object.keys(mergeDoc(m, tard).regattas), []);
  assert.equal(mergeDoc(m, tard).tomb['regatta:rgA'].t, 5000);
});

test('gel de jour : une copie « tardive » ne remplace jamais une copie prise avant le signal ; sinon la plus récente gagne', () => {
  const avant = { wx: 'avant', u: 1000, ub: 'Teiva' }, tard = { wx: 'tard', late: true, u: 9000, ub: 'Romain' };
  const j = '2026-11-07';
  const m = mergeRegatta(reg({ frozen: { [j]: avant } }), reg({ frozen: { [j]: tard } }));
  assert.equal(m.frozen[j].wx, 'avant');
  assert.equal(canon(m), canon(mergeRegatta(reg({ frozen: { [j]: tard } }), reg({ frozen: { [j]: avant } }))));
  const deux = mergeRegatta(reg({ frozen: { [j]: { wx: 'a', late: true, u: 100 } } }), reg({ frozen: { [j]: { wx: 'b', late: true, u: 200 } } }));
  assert.equal(deux.frozen[j].wx, 'b');
  const nouvelle = mergeRegatta(reg({ frozen: { [j]: { wx: 'a', u: 100 } } }), reg({ frozen: { [j]: { wx: 'b', u: 200 } } }));
  assert.equal(nouvelle.frozen[j].wx, 'b');
  assert.deepEqual(Object.keys(mergeRegatta(reg(), reg({ frozen: { [j]: avant } })).frozen), [j], 'un jour figé d’un seul côté est gardé');
});

test('rapport de trace : le plus grand t gagne quel que soit u ; la trace elle-même suit sa date', () => {
  const a = reg({ traces: [{ id: 'tr1', name: 'A', report: { t: 900, html: 'ancien' }, u: 5000 }] });
  const b = reg({ traces: [{ id: 'tr1', name: 'A', report: { t: 400, html: 'plus vieux' }, u: 7000 }, { id: 'tr2', name: 'B', u: 100 }] });
  const m = mergeRegatta(a, b);
  assert.equal(m.traces.find((t) => t.id === 'tr1').report.t, 900, 'rapport le plus récent, même si la trace de l’autre côté est plus récente');
  assert.equal(m.traces.find((t) => t.id === 'tr1').u, 7000);
  assert.deepEqual(ids(m.traces), ['tr1', 'tr2']);
  assert.equal(canon(m), canon(mergeRegatta(b, a)));
});

test('recalages de bouées : le t le plus récent gagne, suppression comprise ; 5 versions gardées ; jamais de h vide', () => {
  const a = { 3: { lat: 43.1, lon: 5.9, src: 'trace', t: 100, by: 'Teiva' } };
  const b = { 3: { lat: 43.2, lon: 5.95, src: 'saisie', t: 200, by: 'Thibaud' } };
  const m = mergeMarks(a, b);
  assert.equal(m[3].lat, 43.2);
  assert.deepEqual(m[3].h.map((x) => [x.lat, x.by, x.t]), [[43.1, 'Teiva', 100]]);
  assert.equal(canon(m), canon(mergeMarks(b, a)));
  const del = mergeMarks(m, { 3: { del: true, t: 300, by: 'Romain' } });
  assert.equal(del[3].del, true);
  assert.equal(del[3].h[0].lat, 43.2, 'la position écrasée par la suppression reste dans l’historique');
  let x = { 3: { lat: 0, lon: 0, src: 'saisie', t: 1, by: 'a' } };
  for (let i = 2; i <= 12; i++) x = mergeMarks(x, { 3: { lat: i, lon: i, src: 'saisie', t: i, by: 'a' } });
  assert.equal(x[3].lat, 12);
  assert.equal(x[3].h.length, 5);
  assert.deepEqual(x[3].h.map((e) => e.t), [11, 10, 9, 8, 7]);
  const seule = mergeMarks({ 5: { lat: 1, lon: 2, src: 'trace', t: 9 } }, { 5: { lat: 1, lon: 2, src: 'trace', t: 9 } });
  assert.ok(!('h' in seule[5]), 'deux copies identiques : pas de h');
  assert.deepEqual(mergeMarks(seule, seule), seule, 'idempotente');
});

test('clés __proto__, constructor et prototype ignorées partout : aucune pollution', () => {
  const sale = JSON.parse(`{"v":1,"regattas":{"__proto__":{"id":"__proto__","polluted":1},"constructor":{"id":"constructor"},"rgA":${JSON.stringify(reg({ frozen: { __proto__: { u: 1 } } }))}},
    "tomb":{"__proto__":{"t":1},"prototype":{"t":1}},"marks":{"__proto__":{"t":1,"polluted":2},"constructor":{"t":1}}}`);
  const sale2 = JSON.parse(`{"v":1,"regattas":{"rgA":{"id":"rgA","name":"x","u":5,"tomb":{"__proto__":{"t":9},"constructor":{"t":9}},"frozen":{"__proto__":{"u":1,"polluted":3}},"races":[{"id":"__proto__","u":1}]}},"tomb":{},"marks":{}}`);
  const m = mergeDoc(sale, sale2);
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(Object.keys(m.regattas), ['rgA']);
  assert.deepEqual(Object.keys(m.tomb), []);
  assert.deepEqual(Object.keys(m.marks), []);
  assert.deepEqual(Object.keys(m.regattas.rgA.tomb), []);
  assert.ok(!Object.keys(m.regattas.rgA.frozen).includes('__proto__'));
  assert.equal(({}).polluted, undefined);
  assert.equal(canon({ __proto__: 1, a: 1 }), canon({ a: 1 }), 'canon ignore aussi ces clés');
});

// ───────────────────────── marquage des modifications locales

test('stamp : u conservé si le contenu est identique ; u = maintenant sur ce qui change ; ids de manches posés ; pierre tombale pour une manche retirée', () => {
  const prev = reg({ races: [race('m202611071055', { n: 1 })], frozen: { '2026-11-07': { wx: 1, u: 900, ub: 'Teiva' } } });
  const memes = stamp(prev, { ...prev }, { now: 5000, by: 'Romain' });
  assert.equal(memes.u, 1000); assert.equal(memes.ub, 'Teiva');
  assert.equal(memes.races[0].u, 1000);
  assert.equal(memes.frozen['2026-11-07'].u, 900);
  const modif = stamp(prev, { ...prev, name: 'Autre nom' }, { now: 5000, by: 'Romain' });
  assert.equal(modif.u, 5000); assert.equal(modif.ub, 'Romain');
  assert.equal(modif.races[0].u, 1000, 'les manches inchangées gardent leur date');
  const sansId = stamp(prev, { ...prev, races: [...prev.races, { date: '2026-11-08', time: '09:30', courseId: 1 }, { date: '2026-11-08', courseId: 2 }] }, { now: 5000, by: 'Romain', rnd: () => 0.123456789 });
  assert.ok(ids(sansId.races).includes('m202611080930'), 'm<AAAAMMJJ><HHMM>');
  assert.ok(sansId.races.some((m) => /^m[0-9a-z]{1,8}$/.test(m.id) && !m.id.startsWith('m2026')), 'sans heure : identifiant aléatoire');
  assert.equal(sansId.races.find((m) => m.id === 'm202611080930').u, 5000);
  assert.equal(sansId.races.find((m) => m.id === 'm202611080930').ub, 'Romain');
  const retiree = stamp(prev, { ...prev, races: [] }, { now: 7000, by: 'Thibaud' });
  assert.deepEqual(retiree.tomb['race:m202611071055'], { t: 7000, by: 'Thibaud' });
  assert.equal(raceId({ date: '2026-11-07', time: '10:55' }), 'm202611071055');
});

test('renuméroter les manches (n) ou changer la manche choisie (sel) ne marque rien', () => {
  const r = reg({ races: [race('m1', { n: 1, date: '2026-11-07' }), race('m2', { n: 2, time: '11:30' })], sel: 1 });
  const prev = { list: [r], tomb: {}, current: 'rgA' };
  const renum = { list: [{ ...r, sel: 2, races: [{ ...r.races[0], n: 2 }, { ...r.races[1], n: 1 }] }], tomb: {}, current: 'rgA' };
  const out = stampState(prev, renum, { now: 9000, by: 'Romain' });
  assert.deepEqual(out.changed, [], 'rien à envoyer');
  assert.equal(out.st.list[0].u, 1000);
  assert.deepEqual(out.st.list[0].races.map((m) => m.u), [1000, 1000]);
  // le même objet qu’avant : rien à comparer
  assert.deepEqual(stampState(prev, { ...prev }, { now: 9000, by: 'Romain' }).changed, []);
});

test('stampState : régate modifiée, ajoutée ou disparue → clés modifiées ; disparue = pierre tombale et ~tomb', () => {
  const a = reg(), b = reg({ id: 'rgB', name: 'B' });
  const prev = { list: [a, b], tomb: {}, current: 'rgA' };
  const next = { list: [{ ...a, name: 'Renommée' }, reg({ id: 'rgC', name: 'C' })], tomb: {}, current: 'rgC' };
  const out = stampState(prev, next, { now: 4000, by: 'Teiva' });
  assert.deepEqual(out.changed, ['rgA', 'rgC', '~tomb']);
  assert.deepEqual(out.st.tomb.rgB, { t: 4000, by: 'Teiva' });
  assert.equal(out.st.list[0].u, 4000);
  assert.equal(out.st.list[1].u, 4000);
  assert.equal(out.st.current, 'rgC');
});

test('toShared retire sel et n ; fromShared renumérote dans l’ordre des manches et sel suit sa manche', () => {
  const locale = reg({ races: [race('mA', { n: 1, date: '2026-11-07', time: '10:55' }), race('mB', { n: 2, date: '2026-11-07', time: '12:00' })], sel: 2 });
  const partagee = toShared(locale);
  assert.ok(!('sel' in partagee)); assert.ok(partagee.races.every((m) => !('n' in m)));
  assert.deepEqual(LOCAL_ONLY, ['sel']);
  assert.ok('sel' in locale, 'toShared ne modifie pas son entrée');
  // une manche plus tôt arrive d’un autre téléphone : mB devient la 3e, la manche choisie reste mB
  const fusion = { ...partagee, races: [...partagee.races, race('mC', { date: '2026-11-06', time: '09:00' })] };
  const r = fromShared(fusion, locale);
  assert.deepEqual(r.races.map((m) => [m.id, m.n]), [['mC', 1], ['mA', 2], ['mB', 3]]);
  assert.equal(r.sel, 3);
  // sans manche choisie ou sans copie locale : pas de sel inventé
  assert.ok(!('sel' in fromShared(fusion, { ...locale, sel: undefined })));
  assert.ok(!('sel' in fromShared(fusion, undefined)));
  // une manche sans heure se range après celles du même jour qui en ont une
  const sansHeure = fromShared({ ...partagee, races: [{ id: 'mZ', date: '2026-11-07' }, ...partagee.races] });
  assert.deepEqual(sansHeure.races.map((m) => m.id), ['mA', 'mB', 'mZ']);
});

test('markDirty : un compteur croissant par clé ; une clé re-modifiée prend un compteur plus grand', () => {
  const meta = {};
  markDirty(meta, ['rgA', '~tomb']);
  assert.deepEqual(meta.dirty, { rgA: 1, '~tomb': 1 });
  markDirty(meta, ['rgA']);
  assert.deepEqual(meta.dirty, { rgA: 2, '~tomb': 1 });
  assert.equal(meta.seq, 2);
  markDirty(meta, []);
  assert.equal(meta.seq, 3);
});

test('wins, sameBody, slug et les constantes exportées', () => {
  assert.ok(wins({ u: 2, x: 1 }, { u: 1, x: 2 }) > 0);
  assert.ok(wins({ u: 1, x: 1 }, { u: 2, x: 1 }) < 0);
  assert.equal(wins({ u: 1, x: 1 }, { u: 1, x: 1 }), 0);
  assert.ok(sameBody({ id: 1, a: 2, u: 5, ub: 'x', by: 'y' }, { a: 2, id: 1, u: 9, ub: 'z', by: 'w' }), 'les métadonnées ne comptent pas dans le contenu');
  assert.ok(!sameBody({ a: 2 }, { a: 3 }));
  assert.equal(slug('Éloïse Müller-X'), 'eloise-muller-x');
  assert.equal(slug(''), ''); assert.equal(slug(null), '');
  assert.ok(slug('a'.repeat(100)).length <= 40);
  assert.deepEqual(HEAD, ['name', 'club', 'dateStart', 'dateEnd', 'season', 'ic']);
  assert.deepEqual(Object.keys(LISTS), ['race', 'mark', 'course', 'trace']);
  assert.deepEqual(emptyDoc(), { v: 1, regattas: {}, tomb: {}, marks: {} });
  assert.ok(docEquals(emptyDoc(), emptyDoc()));
  assert.ok(docEquals({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 }), 'ordre des clés sans effet');
});

// ───────────────────────── convergence de milliers de scénarios à trois téléphones

function mulberry32(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const PHONES = ['Romain', 'Teiva', 'Thibaud'], REGS = ['rgA', 'rgB', 'rgC'], DAYS = ['2026-11-07', '2026-11-08', '2026-11-09'], TIMES = ['10:55', '11:30', '12:15'];
const MARKS = ['1', '2', '3'];
// L'état visible d'un document : sans l'historique des valeurs écrasées (`hist` des régates, `h` des recalages)
const visible = (d) => ({
  ...d,
  regattas: Object.fromEntries(Object.entries(d.regattas).map(([id, { hist, ...r }]) => [id, r])),
  marks: Object.fromEntries(Object.entries(d.marks).map(([k, { h, ...m }]) => [k, m])),
});

// Un scénario : trois téléphones partent du même état, font des opérations au hasard (ajouts, modifications, suppressions de manches et de
// régates, gels, recalages, traces et rapports), s'échangent leurs états par un serveur dans un ordre quelconque (avec des renvois d'états
// anciens), puis se synchronisent deux fois. `oracle` note ce qui DOIT rester d'après l'horloge : la fusion est jugée contre lui.
function scenario(seed) {
  const rnd = mulberry32(seed), int = (n) => Math.floor(rnd() * n), pick = (a) => a[int(a.length)];
  let now = 10_000, reportT = 5000;
  const oracle = { write: {}, del: {}, regDel: new Set(), head: {}, nonLate: new Set(), marks: {}, report: {} };
  const base = emptyDoc();
  for (const id of REGS.slice(0, int(3))) {
    base.regattas[id] = reg({ id, name: `base ${id}`, u: 1000, ub: pick([null, 'Teiva', 'Romain']), by: pick([null, 'Teiva']), races: int(2) ? [race(`m${id}x`, { u: 1000, by: pick([undefined, 'Teiva']) })] : [] });
    oracle.write[`${id}|m${id}x`] = base.regattas[id].races.length ? 1000 : undefined;
    oracle.head[id] = { t: 1000, name: `base ${id}`, n: 1 };
  }
  let server = clone(base);
  const phones = PHONES.map((by) => ({ by, doc: clone(base), snaps: [] }));
  const touch = (p, id, f) => { const prev = p.doc.regattas[id]; p.doc.regattas[id] = clone(stamp(prev, f(clone(prev)), { now, by: p.by, rnd })); return p.doc.regattas[id]; };
  const record = (id, r, kind) => { if (r.u === now) { const h = oracle.head[id]; oracle.head[id] = { t: now, name: r.name, n: h && h.t === now ? h.n + 1 : 1 }; } void kind; };
  const sync = (p, snap) => { server = clone(mergeDoc(server, snap || p.doc)); if (!snap) p.doc = clone(mergeDoc(p.doc, server)); };

  const steps = 5 + int(9);
  for (let i = 0; i < steps; i++) {
    now += int(4);                                                                  // 0 : égalités de date voulues
    const p = pick(phones), mine = Object.keys(p.doc.regattas), op = int(11);
    if (int(4) === 0) p.snaps.push(clone(p.doc));
    if (op <= 1 && mine.length) {                                                   // ajouter ou modifier une manche (même identifiant sur deux téléphones : conflit voulu)
      const id = pick(mine), rid = `m${pick(DAYS).replace(/-/g, '')}${pick(TIMES).replace(':', '')}`, k = `${id}|${rid}`;
      const r = touch(p, id, (x) => {
        const m = { id: rid, date: `${rid.slice(1, 5)}-${rid.slice(5, 7)}-${rid.slice(7, 9)}`, time: `${rid.slice(9, 11)}:${rid.slice(11, 13)}`, courseId: 1 + int(3), cls: 'J80', laps: 1 + int(3), note: pick(['', 'a', 'b']) };
        if (int(2)) m.by = p.by;
        x.races = [...x.races.filter((e) => e.id !== rid), { ...(x.races.find((e) => e.id === rid) || {}), ...m }];
        return x;
      });
      const e = r.races.find((m) => m.id === rid);
      if (e.u === now) oracle.write[k] = now;
    } else if (op === 2 && mine.length) {                                           // supprimer une manche
      const id = pick(mine), cur = p.doc.regattas[id].races;
      if (cur.length) { const rid = pick(cur).id; touch(p, id, (x) => { x.races = x.races.filter((e) => e.id !== rid); return x; }); oracle.del[`${id}|${rid}`] = now; }
    } else if (op === 3 && mine.length) {                                           // modifier la fiche (parfois avec un gros texte d'IC)
      const id = pick(mine), r = touch(p, id, (x) => ({ ...x, name: `n${i}-${p.by}-${int(1000)}`, ...(int(5) === 0 ? { ic: { text: 'z'.repeat(4500) } } : {}) }));
      record(id, r, 'head');
    } else if (op === 4) {                                                          // créer une régate (même identifiant sur deux téléphones : créations indépendantes)
      const id = pick(REGS);
      if (!p.doc.regattas[id]) {
        const r = stamp(undefined, { id, name: `créée ${id}`, club: 'CVAT', dateStart: pick(DAYS), dateEnd: pick(DAYS), season: 2026, races: [], marks: [], courses: [], traces: [], frozen: {}, at: now }, { now, by: p.by, rnd });
        p.doc.regattas[id] = clone(r); record(id, r, 'head');
      }
    } else if (op === 5 && mine.length && int(3) === 0) {                           // supprimer une régate
      const id = pick(mine); delete p.doc.regattas[id]; p.doc.tomb[`regatta:${id}`] = { t: now, by: p.by }; oracle.regDel.add(id);
    } else if (op === 6 && mine.length) {                                           // geler le vent d'un jour (copie « tardive » ou prise avant le signal)
      const id = pick(mine), day = pick(DAYS), late = int(2) === 1, cur = p.doc.regattas[id].frozen[day];
      if (late && cur && !cur.late) continue;                                       // un téléphone ne remplace jamais sa propre copie d'avant le signal par une copie tardive
      touch(p, id, (x) => ({ ...x, frozen: { ...x.frozen, [day]: { wx: `${p.by}-${i}`, ...(late ? { late: true } : {}) } } }));
      if (!late) oracle.nonLate.add(`${id}|${day}`);
    } else if (op === 7) {                                                          // recaler (ou remettre à l'origine) une bouée
      const k = pick(MARKS), v = int(4) ? { lat: 43 + rnd(), lon: 5.9 + rnd(), src: pick(['trace', 'saisie']), t: now, by: p.by } : { del: true, t: now, by: p.by };
      p.doc.marks = { ...p.doc.marks, [k]: v };
      const o = oracle.marks[k]; oracle.marks[k] = { t: now, del: !!v.del, n: o && o.t === now ? o.n + 1 : 1 };
    } else if (op === 8 && mine.length) {                                           // trace rattachée, puis rapport (t croissant, sans rapport avec u)
      const id = pick(mine), tid = pick(['trA', 'trB']);
      touch(p, id, (x) => {
        const cur = x.traces.find((e) => e.id === tid), report = cur && int(2) ? { t: (reportT += 1 + int(50)), html: `r${reportT}` } : cur?.report;
        x.traces = [...x.traces.filter((e) => e.id !== tid), { ...(cur || { id: tid, name: tid }), ...(report ? { report } : {}) }];
        if (report && report !== cur?.report) oracle.report[`${id}|${tid}`] = report.t;
        return x;
      });
    } else {                                                                        // se synchroniser, ou renvoyer un état ancien (dans le désordre, après une coupure)
      if (p.snaps.length && int(3) === 0) sync(p, pick(p.snaps)); else sync(p);
    }
  }

  // vérifications algébriques sur les états de fin AVANT les derniers échanges. L'état visible (fiche, éléments, pierres tombales, gels,
  // recalages) est une réunion exacte : il est comparé sans l'historique (`hist`, `h`). L'historique est un journal « au mieux » : une version
  // écrasée n'y entre que si elle a été comparée à la gagnante, donc une version qui reprend le contenu d'une plus ancienne (P, puis Q, puis P) peut
  // laisser une entrée de moins selon l'ordre des échanges. Il reste commutatif et idempotent, et identique sur les trois téléphones après échange.
  const [A, B, C] = phones.map((p) => p.doc), S = server;
  const fold = (xs) => xs.reduce((acc, x) => mergeDoc(acc, x), emptyDoc());
  const all = fold([A, B, C, S]), vAll = canon(visible(all));
  for (const perm of [[C, B, A], [B, C, A]]) assert.equal(canon(visible(fold([...perm, S]))), vAll, `ordre d'échange : état différent (graine ${seed})`);
  assert.equal(canon(mergeDoc(A, B)), canon(mergeDoc(B, A)), `non commutative (graine ${seed})`);
  assert.equal(canon(visible(mergeDoc(mergeDoc(A, B), C))), canon(visible(mergeDoc(A, mergeDoc(B, C)))), `non associative (graine ${seed})`);
  assert.equal(canon(mergeDoc(all, all)), canon(all), `non idempotente (graine ${seed})`);
  for (const x of [A, S]) assert.equal(canon(visible(mergeDoc(all, x))), vAll, `absorption : un état ancien change l'état visible (graine ${seed})`);

  // derniers échanges : trois téléphones, jusqu'à quatre tours (le premier fait converger l'état visible, les suivants l'historique)
  let c = canon(server);
  for (let tour = 0; tour < 4; tour++) {
    for (const p of phones) sync(p);
    c = canon(server);
    if (phones.every((p) => canon(p.doc) === c)) break;
  }
  for (const p of phones) assert.equal(canon(p.doc), c, `téléphone ${p.by} différent du serveur (graine ${seed})`);
  assert.equal(canon(visible(server)), vAll, `le résultat final n'est pas la réunion de tout ce qui a été envoyé (graine ${seed})`);
  return { server, oracle, seed };
}

function juge({ server, oracle, seed }) {
  const m = (msg) => `${msg} (graine ${seed})`;
  for (const [id, r] of Object.entries(server.regattas)) {
    assert.ok(!oracle.regDel.has(id), m(`régate supprimée ${id} ressuscitée`));
    for (const key of Object.values(LISTS)) {
      const l = ids(r[key]);
      assert.equal(new Set(l).size, l.length, m(`doublon dans ${id}.${key}`));
      assert.deepEqual(l, [...l].sort(), m(`${id}.${key} non triée`));
    }
    assert.ok(r.hist.length <= MAX_HIST, m('historique trop long'));
    for (const d of Object.keys(r.frozen)) if (oracle.nonLate.has(`${id}|${d}`)) assert.ok(!r.frozen[d].late, m(`gel tardif devant un gel d'avant le signal (${id} ${d})`));
    const h = oracle.head[id];
    if (h && h.n === 1) assert.equal(r.name, h.name, m(`la fiche la plus récente doit gagner (${id})`));
  }
  for (const id of oracle.regDel) assert.ok(!(id in server.regattas), m(`${id} supprimée mais présente`));
  // une manche écrite après sa dernière suppression est présente ; sinon absente (dernier écrit gagne, suppression gagne à égalité)
  for (const [k, w] of Object.entries(oracle.write)) {
    const [id, rid] = k.split('|');
    if (oracle.regDel.has(id) || !server.regattas[id]) continue;
    const attendu = w !== undefined && w > (oracle.del[k] ?? -Infinity);
    assert.equal(server.regattas[id].races.some((e) => e.id === rid), attendu, m(`manche ${k} : ${attendu ? 'perdue' : 'ressuscitée'}`));
  }
  for (const [k, o] of Object.entries(oracle.marks)) {
    const got = server.marks[k];
    assert.ok(got, m(`recalage ${k} perdu`));
    if (o.n === 1) { assert.equal(got.t, o.t, m(`recalage ${k} : pas le plus récent`)); assert.equal(!!got.del, o.del, m(`recalage ${k} : suppression perdue ou ressuscitée`)); }
    assert.ok(!('h' in got) || got.h.length > 0, m('h vide'));
  }
  for (const [k, t] of Object.entries(oracle.report)) {
    const [id, tid] = k.split('|');
    const tr = server.regattas[id]?.traces.find((e) => e.id === tid);
    if (tr) assert.equal(tr.report.t, t, m(`rapport ${k} : le plus récent doit gagner`));
  }
}

test('convergence : 2 000 scénarios aléatoires à trois téléphones (ajouts, modifications, suppressions, bouées, rapports, renvois dans le désordre)', () => {
  const debut = Date.now();
  const N = 2000;
  for (let seed = 1; seed <= N; seed++) juge(scenario(seed));
  assert.ok(Date.now() - debut < 5000, `trop lent : ${Date.now() - debut} ms`);
});

test('convergence : un téléphone qui renvoie deux fois, après une coupure, ne crée aucun doublon', () => {
  const a = doc(reg({ races: [race('m1'), race('m2', { u: 1200 })] }));
  const once = mergeDoc(emptyDoc(), a);
  let m = once;
  for (let i = 0; i < 5; i++) m = mergeDoc(m, a);
  assert.equal(canon(m), canon(once));
  assert.deepEqual(ids(m.regattas.rgA.races), ['m1', 'm2']);
  assert.ok(docEquals(m, mergeDoc(m, emptyDoc())), 'fusionner avec un document vide ne change rien');
  assert.ok(docEquals(m, mergeDoc(emptyDoc(), m)));
});
