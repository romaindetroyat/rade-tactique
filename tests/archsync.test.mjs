// js/archsync.js (ARCH-01, D-03, D-04) : trois « téléphones » purs (état des régates, méta, horloge simulée) appellent le VRAI gestionnaire
// d’api/archive.js sur un faux Blob partagé (aucun réseau). L’auteur est celui que poserait le middleware, jamais celui du téléphone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/archive.js';
import { stampState, markDirty, canon, toShared, legacyStamp } from '../js/archmerge.js';
import { createRegatta, upsertRegatta, addRace, setCurrent, removeRegatta, migrate, backfillAuthor, seedNorm, SEED_AT, KEY } from '../js/regates.js';
import { runSync, applyDoc, buildDoc, canSync, syncStatus } from '../js/archsync.js';
import { createFakeBlob, invoke } from './helpers/fakeblob.mjs';

const T0 = Date.parse('2026-11-07T08:00:00Z');

// Le monde : un faux Blob, la vraie fonction, une horloge commune
function monde() {
  const clock = { t: T0 }, n0 = 0, blob = createFakeBlob(), handler = createHandler({ blob, now: () => clock.t });
  return { clock, blob, handler, appels: [], n: n0 };
}
// Un téléphone : l’état local (comme REG), la méta (comme rade.sync.v1), l’horloge, le réseau, la course
function telephone(nom, w, { membre = nom, st = { v: 1, current: null, list: [] } } = {}) {
  const p = {
    nom, st, meta: {}, copies: [], online: true, active: false, saisie: false, busy: null,
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
    // comme syncNow de js/app.js : avant le premier envoi, les éléments sans date reçoivent la leur
    sync(raison = 'manuel') { if (!p.meta.first) p.st = legacyStamp(p.st); return runSync(p.deps, raison); },
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
    meta: p.meta, saveMeta() {}, backup() { p.copies.push(JSON.stringify(p.st)); if (p.copieEchoue) throw new Error('stockage plein'); }, isActive: () => p.active, isOnline: () => p.online, canApply: () => !p.saisie,
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

// ───────────────────────── freins, plafonds et textes (Pattern 6, Pattern 9)

test('canSync : désactivée, course, hors réseau, 30 s minimum, recul 30 s · 2 min · 10 min · 30 min, 401, document plus récent', () => {
  const ok = { now: 1e9, active: false, online: true, lastTry: 0 };
  assert.deepEqual(canSync({ ...ok, off: true }), { ok: false, why: 'desactivee' });
  assert.equal(canSync({ ...ok, active: true }).why, 'course');
  assert.equal(canSync({ ...ok, online: false }).why, 'hors_reseau');
  assert.equal(canSync({ ...ok, lastTry: 1e9 - 10e3 }).why, 'trop_tot');
  assert.equal(canSync({ ...ok, lastTry: 1e9 - 10e3 }).in, 20e3, 'délai restant rendu');
  assert.equal(canSync({ ...ok, lastTry: 1e9 - 30e3 }).ok, true, '30 s écoulées : permis');
  for (const [fails, ms] of [[1, 30e3], [2, 120e3], [3, 600e3], [4, 1800e3], [9, 1800e3]]) {
    assert.equal(canSync({ ...ok, fails, lastTry: 1e9 - ms + 1 }).why, 'trop_tot', `après ${fails} échecs : ${ms} ms`);
    assert.equal(canSync({ ...ok, fails, lastTry: 1e9 - ms }).ok, true);
  }
  assert.equal(canSync({ ...ok, denied: true }).why, 'acces');
  assert.equal(canSync({ ...ok, outdated: true }).why, 'ancienne_version');
});

test('canSync : plafonds par jour de Paris (40 envois, 150 lectures), remis à zéro le jour suivant', () => {
  const now = Date.parse('2026-11-07T10:00:00Z'), jour = '2026-11-07';
  const base = { now, active: false, online: true, lastTry: 0, day: jour };
  assert.equal(canSync({ ...base, w: 39, write: true }).ok, true);
  assert.equal(canSync({ ...base, w: 40, write: true }).why, 'plafond');
  assert.equal(canSync({ ...base, w: 40, write: false }).ok, true, 'les lectures ont leur propre plafond');
  assert.equal(canSync({ ...base, r: 149, write: false }).ok, true);
  assert.equal(canSync({ ...base, r: 150, write: false }).why, 'plafond');
  assert.equal(canSync({ ...base, day: '2026-11-06', w: 40, r: 150, write: true }).ok, true, 'jour suivant : compteurs remis à zéro');
  // 23 h 30 UTC le 7 = 00 h 30 le 8 à Paris : c’est déjà un autre jour
  assert.equal(canSync({ ...base, now: Date.parse('2026-11-07T23:30:00Z'), w: 40, write: true }).ok, true);
});

test('syncStatus : tous les textes, niveaux ok / warn / off seulement', () => {
  const t = (o) => syncStatus({ online: true, ...o });
  assert.equal(t({}).text, 'Pas encore synchronisé');
  assert.equal(t({ lastOkAt: 1 }).text, 'À jour');
  assert.equal(t({ busy: true }).text, 'Synchronisation…');
  assert.equal(t({ dirty: 1 }).text, 'En attente d’envoi');
  assert.equal(t({ online: false, dirty: 1 }).text, 'Hors réseau · 1 modification en attente');
  assert.equal(t({ online: false, dirty: 3 }).text, 'Hors réseau · 3 modifications en attente');
  assert.equal(t({ online: false }).text, 'Hors réseau');
  assert.equal(t({ fails: 2 }).text, 'Synchronisation à relancer');
  assert.equal(t({ active: true }).text, 'En pause pendant la course');
  assert.equal(t({ off: true }).text, 'Synchronisation désactivée');
  assert.equal(t({ absent: true }).text, 'Archive non configurée');
  assert.equal(t({ denied: true }).text, 'Code d’accès à renouveler');
  assert.equal(t({ capped: true }).text, 'Plafond du jour atteint · reprise demain');
  assert.equal(t({ outdated: true }).text, 'Mettez l’app à jour pour synchroniser');
  for (const o of [{}, { lastOkAt: 1 }, { busy: true }, { dirty: 1 }, { online: false, dirty: 2 }, { fails: 1 }, { active: true }, { off: true }, { absent: true }, { denied: true }, { capped: true }, { outdated: true }]) {
    assert.ok(['ok', 'warn', 'off'].includes(t(o).level), JSON.stringify(o));
  }
});

// ───────────────────────── critère 1 : hors réseau, sans perte ni doublon

test('critère 1 : créé hors réseau, rien ne part, tout part au retour du réseau, sans doublon même renvoyé deux fois', async () => {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w);
  await A.sync('manuel'); avance(w, 60e3); await B.sync('manuel'); avance(w, 60e3);   // première synchronisation faite des deux côtés
  A.online = false;
  const id = A.creer('Régate hors réseau');
  const avant = w.appels.length;
  assert.deepEqual(await A.sync('manuel'), { skipped: 'hors_reseau', in: undefined });
  assert.equal(w.appels.length, avant, 'aucun appel hors réseau');
  assert.deepEqual(Object.keys(A.meta.dirty), [id], 'compteur « sale » gardé');
  assert.equal(syncStatus({ online: A.online, dirty: Object.keys(A.meta.dirty).length }).text, 'Hors réseau · 1 modification en attente');
  A.online = true; avance(w, 60e3);
  assert.equal((await A.sync('auto')).merged, true);
  avance(w, 60e3);
  await B.sync('auto');
  assert.ok(noms(B).includes('Régate hors réseau'), 'la saisie hors réseau arrive chez B');
  assert.equal(B.st.list.filter((r) => r.id === id).length, 1);
  // même document renvoyé deux fois : le serveur ne change rien, aucune ligne d’historique de plus
  const ecrit = w.blob.ops.put;
  for (let i = 0; i < 2; i++) { A.meta.dirty = { [id]: ++A.meta.seq }; avance(w, 60e3); await A.sync('auto'); }
  assert.equal(w.blob.ops.put, ecrit, 'renvoyer le même document n’écrit rien');
  assert.equal((A.st.list.find((r) => r.id === id).hist || []).length, 0, 'aucune ligne d’historique');
  // synchronisation sans modification : GET conditionnel et aucune écriture
  avance(w, 60e3);
  const r = await A.sync('auto');
  assert.equal(r.unchanged, true); assert.equal(w.appels.at(-1).method, 'GET'); assert.equal(w.blob.ops.put, ecrit);
});

test('critère 1 : deux coupures de suite puis un envoi qui échoue — la saisie reste en attente et part au succès suivant', async () => {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w);
  await A.sync('manuel'); avance(w, 60e3);
  const id = A.creer('Après coupure');
  A.reseau = async () => { throw new Error('Failed to fetch'); };
  for (let i = 0; i < 2; i++) { avance(w, 3600e3); const r = await A.sync('auto'); assert.ok(r.error, 'échec consigné'); }
  assert.equal(A.meta.fails, 2); assert.deepEqual(Object.keys(A.meta.dirty), [id]);
  A.reseau = null; avance(w, 3600e3);
  assert.equal((await A.sync('auto')).merged, true);
  assert.equal(A.meta.fails, 0); assert.deepEqual(A.meta.dirty, {});
  avance(w, 60e3); await B.sync('auto');
  assert.ok(noms(B).includes('Après coupure'));
});

// ───────────────────────── critère 2 : ajouts simultanés hors réseau

for (const ordre of ['A puis B puis A', 'B puis A puis B']) {
  test(`critère 2 : deux équipiers ajoutent chacun une manche hors réseau (${ordre}) — les deux manches, une seule fois, états identiques`, async () => {
    const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w);
    const id = A.creer('Régate partagée', '2026-11-07', '2026-11-08');
    await A.sync('manuel'); avance(w, 60e3); await B.sync('manuel'); avance(w, 60e3);
    A.online = false; B.online = false;
    A.manche(id, '10:55', '2026-11-07'); avance(w, 5e3);
    B.manche(id, '13:25', '2026-11-07');
    await A.sync('auto'); await B.sync('auto');
    A.online = true; B.online = true; avance(w, 3600e3);
    for (const x of ordre.split(' puis ')) { const p = x === 'A' ? A : B; await p.sync('auto'); avance(w, 60e3); }
    for (const p of [A, B]) { avance(w, 60e3); await p.sync('manuel'); }
    const courses = (p) => p.st.list.find((r) => r.id === id).races.map((m) => `${m.n}:${m.time}`);
    assert.deepEqual(courses(A), ['1:10:55', '2:13:25']);
    assert.deepEqual(courses(B), courses(A));
    assert.equal(canon(A.st.list.map(toShared)), canon(B.st.list.map(toShared)), 'états identiques');
    assert.deepEqual(A.meta.dirty, {}); assert.deepEqual(B.meta.dirty, {});
  });
}

test('suppression : la régate supprimée sur A disparaît chez B ; un téléphone C resté hors réseau avec l’ancienne copie ne la fait pas revenir', async () => {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w), C = telephone('Romain', w);
  const id = A.creer('À supprimer');
  await A.sync('manuel'); avance(w, 60e3); await B.sync('manuel'); avance(w, 60e3); await C.sync('manuel'); avance(w, 60e3);
  assert.ok(noms(C).includes('À supprimer'));
  C.online = false;
  A.supprimer(id); avance(w, 60e3);
  await A.sync('manuel'); avance(w, 60e3); await B.sync('manuel');
  assert.ok(!noms(B).includes('À supprimer'), 'disparue chez B');
  C.online = true; avance(w, 3600e3);
  C.meta.dirty = { [id]: ++C.meta.seq };                           // C renvoie son ancienne copie
  await C.sync('auto');
  assert.ok(!noms(C).includes('À supprimer'), 'la copie de C est supprimée à son tour');
  avance(w, 60e3); await A.sync('manuel'); await B.sync('manuel');
  assert.ok(!noms(A).includes('À supprimer') && !noms(B).includes('À supprimer'), 'ne revient pas');
  assert.ok([...w.blob.store.keys()].some((k) => /trash\//.test(k)), 'copie dans la corbeille du serveur');
});

// ───────────────────────── D-03 : rien pendant une course, rien pendant une saisie

test('D-03 : course active — aucun appel, état et compteurs inchangés', async () => {
  const w = monde(), A = telephone('Teiva', w);
  A.creer('Pendant la course');
  A.active = true;
  const r = await A.sync('manuel');
  assert.equal(r.skipped, 'course'); assert.equal(w.appels.length, 0);
  assert.equal(Object.keys(A.meta.dirty).length, 1);
});

test('D-03 : course commencée pendant l’échange — réponse jetée, état inchangé, compteurs gardés, appliquée après la course', async () => {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w);
  const idB = B.creer('Créée par B'); await B.sync('manuel'); avance(w, 60e3);
  const id = A.creer('Créée par A');
  A.reseau = async (method, url, body) => {                          // la course commence pendant l’aller-retour
    const r = await invoke(w.handler, { method, url, body, headers: { 'x-rt-membre': 'Teiva' } });
    A.active = true; return { status: r.status, body: r.body };
  };
  const avant = canon(A.st);
  const r = await A.sync('manuel');
  assert.equal(r.skipped, 'course');
  assert.equal(canon(A.st), avant, 'état inchangé');
  assert.ok(!noms(A).includes('Créée par B'));
  assert.deepEqual(Object.keys(A.meta.dirty), [id], 'compteurs gardés');
  assert.equal(A.meta.first, undefined, 'première synchronisation pas encore acquittée');
  A.reseau = null; A.active = false; avance(w, 60e3);
  assert.equal((await A.sync('auto')).merged, true);
  assert.ok(noms(A).includes('Créée par B')); assert.ok(idB);
  assert.deepEqual(A.meta.dirty, {});
});

test('D-03 : échange abandonné par la course (AbortError) — ni échec ni recul', async () => {
  const w = monde(), A = telephone('Teiva', w);
  A.creer('x');
  A.reseau = async () => { A.active = true; throw Object.assign(new Error('aborted'), { name: 'AbortError' }); };
  const r = await A.sync('manuel');
  assert.equal(r.skipped, 'course'); assert.equal(A.meta.fails || 0, 0);
});

test('saisie en cours (canApply faux) : réponse jetée comme pour une course, appliquée ensuite', async () => {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w);
  B.creer('Autre'); await B.sync('manuel'); avance(w, 60e3);
  A.saisie = true;
  const r = await A.sync('manuel');
  assert.equal(r.skipped, 'saisie'); assert.deepEqual(noms(A), []);
  A.saisie = false; avance(w, 60e3);
  assert.equal((await A.sync('manuel')).merged, true); assert.deepEqual(noms(A), ['Autre']);
});

// ───────────────────────── réponses du serveur

test('401 : plus aucun essai (même longtemps après) ; 429 : recul maximal ; 503 no_blob : archive non configurée', async () => {
  const w = monde(), A = telephone('Teiva', w);
  A.creer('x');
  A.reseau = async () => ({ status: 401, body: { error: 'acces' } });
  assert.equal((await A.sync('manuel')).error, 'acces');
  assert.equal(A.meta.denied, true);
  A.reseau = null; avance(w, 86400e3 * 3);
  const avant401 = w.appels.length;
  assert.deepEqual(await A.sync('manuel'), { skipped: 'acces', in: undefined }, 'aucun nouvel essai, même sur geste');
  assert.equal(w.appels.length, avant401, 'aucun appel de plus');

  const B = telephone('Thibaud', w); B.creer('y');
  B.reseau = async () => ({ status: 429, body: { error: 'limite' } });
  await B.sync('manuel');
  assert.equal(B.meta.fails, 4, 'recul maximal');
  B.reseau = null; avance(w, 29 * 60e3);
  assert.equal((await B.sync('auto')).skipped, 'trop_tot');
  avance(w, 61e3);
  assert.equal((await B.sync('auto')).merged, true);

  const C = telephone('Romain', w); C.creer('z');
  C.reseau = async () => ({ status: 503, body: { error: 'no_blob' } });
  const avant = canon(C.st);
  assert.equal((await C.sync('manuel')).error, 'no_blob');
  assert.equal(C.meta.absent, true); assert.equal(canon(C.st), avant);
  assert.equal(syncStatus({ absent: C.meta.absent, online: true }).text, 'Archive non configurée');
});

test('document d’une version plus récente : jamais touché, plus d’essai, « Mettez l’app à jour »', async () => {
  const w = monde(), A = telephone('Teiva', w);
  A.creer('x');
  A.reseau = async () => ({ status: 200, body: { rev: 'r', doc: { v: 2, regattas: { z: { id: 'z', name: 'Futur' } }, tomb: {}, marks: {} } } });
  const avant = canon(A.st);
  const r = await A.sync('manuel');
  assert.equal(r.outdated, true); assert.equal(canon(A.st), avant, 'état inchangé');
  assert.equal(A.meta.outdated, true);
  A.reseau = null; avance(w, 3600e3);
  assert.equal((await A.sync('manuel')).skipped, 'ancienne_version');
  assert.equal(w.appels.length, 1);
  assert.equal(syncStatus({ outdated: true, online: true }).text, 'Mettez l’app à jour pour synchroniser');
});

test('plafonds : 40 envois par jour de Paris, même sur geste ; le jour suivant tout repart ; compteurs du jour dans la méta', async () => {
  const w = monde(), A = telephone('Teiva', w);
  w.clock.t = Date.parse('2026-11-07T10:00:00Z');
  for (let i = 0; i < 40; i++) { A.creer('r' + i); avance(w, 31e3); assert.equal((await A.sync('auto')).merged, true, `envoi ${i + 1}`); }
  assert.equal(A.meta.w, 40);
  A.creer('de trop'); avance(w, 31e3);
  assert.equal((await A.sync('manuel')).skipped, 'plafond');
  assert.equal(syncStatus({ capped: true, online: true }).text, 'Plafond du jour atteint · reprise demain');
  w.clock.t = Date.parse('2026-11-08T08:00:00Z');
  assert.equal((await A.sync('manuel')).merged, true); assert.equal(A.meta.w, 1); assert.equal(A.meta.day, '2026-11-08');
});

test('le geste « Synchroniser » franchit l’écart de 30 s mais ni la course ni la désactivation', async () => {
  const w = monde(), A = telephone('Teiva', w);
  A.creer('Une régate'); await A.sync('manuel'); avance(w, 5e3);
  assert.equal((await A.sync('auto')).skipped, 'trop_tot');
  assert.equal((await A.sync('manuel')).unchanged, true);
  A.meta.off = true; assert.equal((await A.sync('manuel')).skipped, 'desactivee');
  A.meta.off = false; A.active = true; assert.equal((await A.sync('manuel')).skipped, 'course');
});

// ───────────────────────── première synchronisation de l’existant (Pitfall 7, Open Question 8)

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; };
// Un téléphone déjà utilisé : la Coupe SNPM semée à l’installation (instants différents), puis signée de l’équipier par backfillAuthor
function ancien(nom, w, installe) {
  const p = telephone(nom, w, { st: migrate({ storage: mem(), now: Date.parse(installe), by: null }) });
  p.st = backfillAuthor(p.st, nom).st;
  return p;
}
const PERMUTATIONS = [['A', 'B', 'C'], ['A', 'C', 'B'], ['B', 'A', 'C'], ['B', 'C', 'A'], ['C', 'A', 'B'], ['C', 'B', 'A']];

test('graine SNPM sur trois téléphones : semée à des instants et par des équipiers différents, une seule régate sans ligne d’historique, dans tous les ordres', async () => {
  for (const ordre of PERMUTATIONS) {
    const w = monde();
    const T = { A: ancien('Romain', w, '2026-10-18T09:00:00Z'), B: ancien('Teiva', w, '2026-10-19T14:00:00Z'), C: ancien('Thibaud', w, '2026-10-20T08:00:00Z') };
    // C est un ancien téléphone dont la graine porte encore l’instant d’installation : normalisée au chargement
    T.C.st = seedNorm({ ...T.C.st, list: T.C.st.list.map((r) => ({ ...r, at: Date.parse('2026-10-20T08:00:00Z'), ic: { ...r.ic, validated: { by: 'Thibaud', at: Date.parse('2026-10-20T08:00:00Z') } } })) });
    for (let tour = 0; tour < 2; tour++) for (const k of ordre) { avance(w, 60e3); await T[k].sync('manuel'); }
    for (const k of ordre) {
      const l = T[k].st.list;
      assert.equal(l.length, 1, `${ordre.join('')} : une seule régate chez ${k}`);
      assert.equal(l[0].id, 'snpm-2026');
      assert.deepEqual(l[0].hist || [], [], `${ordre.join('')} : aucune ligne d’historique chez ${k}`);
      assert.equal(l[0].ic.validated.at, SEED_AT);
    }
    assert.equal(canon(T.A.st.list.map(toShared).map(({ by, ub, ...r }) => r)), canon(T.B.st.list.map(toShared).map(({ by, ub, ...r }) => r)));
  }
});

test('fiche revalidée l’emporte : un téléphone qui a relu les IC (lecture « motifs », validation du 21/10) garde sa fiche face aux deux graines intactes, avec une seule ligne d’historique', async () => {
  const valide = Date.parse('2026-10-21T10:00:00Z');
  for (const ordre of PERMUTATIONS) {
    const w = monde();
    const T = { A: ancien('Romain', w, '2026-10-18T09:00:00Z'), B: ancien('Teiva', w, '2026-10-19T14:00:00Z'), C: ancien('Thibaud', w, '2026-10-20T08:00:00Z') };
    // B a relu les IC avant la mise à jour : lecture « motifs », VHF 69, validation datée du 21/10, aucune date de modification
    T.B.st = { ...T.B.st, list: T.B.st.list.map((r) => ({ ...r, ic: { ...r.ic, read: 'motifs', fields: { ...r.ic.fields, vhf: 69 }, validated: { by: 'Teiva', at: valide } } })) };
    for (let tour = 0; tour < 2; tour++) for (const k of ordre) { avance(w, 60e3); await T[k].sync('manuel'); }
    for (const k of ['A', 'B', 'C']) {
      const r = T[k].st.list[0];
      assert.equal(T[k].st.list.length, 1);
      assert.equal(r.ic.fields.vhf, 69, `${ordre.join('')} : la fiche revalidée l’emporte chez ${k}`);
      assert.equal(r.ic.read, 'motifs');
      assert.equal(r.hist.filter((h) => h.kind === 'head').length, 1, `${ordre.join('')} : une seule ligne d’historique chez ${k}`);
    }
  }
});

test('première synchronisation : toutes les régates partent, même sans compteur « sale » ; renvoyées ensuite, aucune écriture', async () => {
  const w = monde(), A = telephone('Teiva', w);
  A.creer('Une'); A.creer('Deux'); A.meta.dirty = {};            // un téléphone d’avant la mise à jour : rien de marqué
  assert.equal((await A.sync('manuel')).merged, true);
  const serveur = JSON.parse([...w.blob.store.entries()].find(([k]) => /light\.json$/.test(k))[1].text);
  assert.deepEqual(Object.values(serveur.regattas).map((r) => r.name).sort(), ['Deux', 'Une']);
  const ecrit = w.blob.ops.put; avance(w, 60e3);
  assert.equal((await A.sync('manuel')).unchanged, true); assert.equal(w.blob.ops.put, ecrit);
});

test('copie de secours : l’index d’avant est copié une seule fois, juste avant la première fusion appliquée ; un échec de copie ne bloque rien', async () => {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w);
  B.creer('Venue de B'); await B.sync('manuel'); avance(w, 60e3);
  A.creer('Locale de A');
  const avant = JSON.stringify(A.st);
  assert.equal((await A.sync('manuel')).merged, true);
  assert.equal(A.copies.length, 1, 'une copie');
  assert.equal(A.copies[0], avant.length ? A.copies[0] : '', 'copie lisible');
  const copie = JSON.parse(A.copies[0]);
  assert.deepEqual(copie.list.map((r) => r.name), ['Locale de A'], 'la copie est l’état d’AVANT la fusion (sans la régate de B)');
  assert.ok(noms(A).includes('Venue de B'));
  assert.equal(A.meta.bak, true);
  A.creer('Autre'); avance(w, 60e3); await A.sync('manuel'); avance(w, 60e3); await A.sync('manuel');
  assert.equal(A.copies.length, 1, 'jamais réécrite');
  const C = telephone('Romain', w); C.copieEchoue = true; C.creer('c');
  avance(w, 60e3);
  assert.equal((await C.sync('manuel')).merged, true, 'la copie qui échoue ne bloque pas la synchronisation');
  assert.equal(C.copies.length, 1); assert.ok(KEY.endsWith('v1'));
});
