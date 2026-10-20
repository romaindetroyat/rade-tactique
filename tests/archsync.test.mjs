// js/archsync.js (ARCH-01, D-03, D-04) : trois « téléphones » purs (état des régates, méta, horloge simulée) appellent le VRAI gestionnaire
// d’api/archive.js sur un faux Blob partagé (aucun réseau). L’auteur est celui que poserait le middleware, jamais celui du téléphone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/archive.js';
import { stampState, markDirty, canon, toShared } from '../js/archmerge.js';
import { createRegatta, upsertRegatta, addRace, setCurrent, removeRegatta } from '../js/regates.js';
import { runSync, applyDoc, buildDoc, canSync, syncStatus } from '../js/archsync.js';
import { createFakeBlob, invoke } from './helpers/fakeblob.mjs';

const T0 = Date.parse('2026-11-07T08:00:00Z');

// Le monde : un faux Blob, la vraie fonction, une horloge commune
function monde() {
  const clock = { t: T0 }, n0 = 0, blob = createFakeBlob(), handler = createHandler({ blob, now: () => clock.t });
  return { clock, blob, handler, appels: [], n: n0 };
}
// Un téléphone : l’état local (comme REG), la méta (comme rade.sync.v1), l’horloge, le réseau, la course
function telephone(nom, w, { membre = nom } = {}) {
  const p = {
    nom, st: { v: 1, current: null, list: [] }, meta: {}, online: true, active: false, saisie: false, busy: null,
    // équivalent de saveReg(next) : marquage par stampState puis markDirty
    save(next) { const r = stampState(p.st, next, { now: w.clock.t, by: membre }); p.st = r.st; if (r.changed.length) markDirty(p.meta, r.changed); return r.changed; },
    creer(nomRegate, debut = '2026-11-07', fin = '') {
      const r = createRegatta({ name: nomRegate, dateStart: debut, dateEnd: fin, club: 'CVAT' }, { now: w.clock.t, by: membre, rnd: () => (++w.n % 97) / 97 });
      p.save(setCurrent(upsertRegatta(p.st, r.regatta), r.regatta.id)); return r.regatta.id;
    },
    manche(id, heure, date) {
      const reg = p.st.list.find((x) => x.id === id), r = addRace(reg, { date, time: heure, courseId: 3, cls: 'G', laps: 2 }, { now: w.clock.t, by: membre, courses: [{ id: 3 }] });
      assert.ok(r.ok, JSON.stringify(r.errors)); p.save(upsertRegatta(p.st, r.regatta));
    },
    supprimer(id) { p.save(removeRegatta(p.st, id)); },
    deps: null,
    sync(raison = 'manuel') { return runSync(p.deps, raison); },
  };
  p.deps = {
    now: () => w.clock.t,
    async fetchJson(method, query, body) {
      const url = '/api/archive?' + new URLSearchParams(query);
      w.appels.push({ nom, method });
      if (p.reseau) return p.reseau(method, url, body);
      const r = await invoke(w.handler, { method, url, body, headers: { 'x-rt-membre': encodeURIComponent(membre) } });
      return { status: r.status, body: r.body };
    },
    getState: () => p.st, setState: (st) => { p.st = st; }, getMarks: () => p.meta.marksDoc || {}, setMarks: (m) => { p.meta.marksDoc = m; },
    meta: p.meta, saveMeta() {}, isActive: () => p.active, isOnline: () => p.online, canApply: () => !p.saisie,
  };
  return p;
}
const avance = (w, ms) => { w.clock.t += ms; };
const noms = (p) => p.st.list.map((r) => r.name);

test('tracer : la régate créée sur A apparaît sur B, signée par le serveur ; les compteurs « sale » de A sont effacés', async () => {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w);
  const id = A.creer('Régate partagée', '2026-11-07', '2026-11-08');
  A.manche(id, '10:55', '2026-11-07');
  assert.deepEqual(Object.keys(A.meta.dirty), [id], 'la régate est marquée sale');
  const a = await A.sync('manuel');
  assert.equal(a.merged, true);
  assert.deepEqual(A.meta.dirty, {}, 'compteurs effacés après succès');
  assert.ok(A.meta.rev, 'rev posé'); assert.equal(A.meta.env, 'preview', 'env du serveur gardé'); assert.equal(A.meta.first, true);
  avance(w, 60e3);
  const b = await B.sync('manuel');
  assert.equal(b.merged, true);
  assert.deepEqual(noms(B), ['Régate partagée']);
  const r = B.st.list[0];
  assert.equal(r.by, 'Teiva', 'auteur posé par le serveur'); assert.equal(r.races[0].by, 'Teiva');
  assert.equal(r.races[0].n, 1);
  assert.equal(B.st.current, r.id, 'la courante est celle de CET appareil, ou la première si aucune');
});

test('l’auteur vient du serveur : le by du téléphone est ignoré', async () => {
  const w = monde(), A = telephone('Teiva', w, { membre: 'Teiva' });
  const id = A.creer('Signée');
  A.st.list.find((r) => r.id === id).by = 'Usurpateur';          // le téléphone se trompe d’auteur
  A.meta.dirty = { [id]: 1 };
  await A.sync('manuel');
  assert.equal(A.st.list[0].by, 'Teiva');
});

test('applyDoc : garde current et sel de l’appareil, renumérote les manches et trie la liste', () => {
  const w = monde(), A = telephone('Teiva', w);
  const id = A.creer('Zèbre', '2026-12-01', '2026-12-02'), id2 = A.creer('Alpha', '2026-11-01');
  A.manche(id, '13:25', '2026-12-01'); A.manche(id, '10:55', '2026-12-01');
  const reg = A.st.list.find((r) => r.id === id);
  assert.deepEqual(reg.races.map((m) => m.time), ['10:55', '13:25']);
  A.save(upsertRegatta(A.st, { ...reg, sel: 2 }));                // manche choisie : la seconde (13:25)
  A.st = { ...A.st, current: id };
  // un autre équipier a ajouté une manche à 09:00 : elle passe en tête, `sel` doit suivre la manche 13:25
  const distant = buildDoc(A.st, {});
  const r0 = distant.regattas[id];
  distant.regattas[id] = { ...r0, races: [...r0.races, { id: 'm202612010900', date: '2026-12-01', time: '09:00', courseId: 3, cls: 'G', laps: 2, note: '', by: 'Thibaud', at: 1, u: w.clock.t, ub: 'Thibaud' }] };
  const { st } = applyDoc(A.st, distant);
  assert.deepEqual(st.list.map((r) => r.name), ['Alpha', 'Zèbre'], 'liste triée par date de début');
  assert.equal(st.current, id, 'current gardé');
  const z = st.list.find((r) => r.id === id);
  assert.deepEqual(z.races.map((m) => [m.n, m.time]), [[1, '09:00'], [2, '10:55'], [3, '13:25']], 'manches renumérotées');
  assert.equal(z.sel, 3, 'sel suit sa manche (13:25)');
  assert.ok(id2);
});

test('sans modification locale, la synchronisation suivante est un GET conditionnel', async () => {
  const w = monde(), A = telephone('Teiva', w);
  A.creer('Une régate');
  await A.sync('manuel');
  avance(w, 60e3);
  const avant = w.blob.ops.put;
  const r = await A.sync('manuel');
  assert.equal(r.unchanged, true);
  assert.equal(w.appels.at(-1).method, 'GET');
  assert.equal(w.blob.ops.put, avant, 'aucune écriture');
  assert.ok(syncStatus({ lastOkAt: 1, dirty: 0, online: true }).text === 'À jour');
  assert.ok(canSync({ now: 1e9, active: false, online: true }).ok);
  assert.equal(canon(toShared(A.st.list[0])).length > 0, true);
});
