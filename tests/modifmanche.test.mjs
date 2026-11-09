// Modifier une manche (v42) : modification simple, déplacement de jour ou d’heure, deux téléphones qui modifient la même manche, téléphone en
// retard, conflit d’heure. Trois « téléphones » purs (état, méta, horloge simulée) synchronisent par la VRAIE fonction api/archive.js sur un faux
// Blob (aucun réseau), comme tests/archsync.test.mjs ; la fusion directe (mergeDoc) est vérifiée dans les deux ordres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/archive.js';
import { stampState, markDirty, canon, legacyStamp, mergeRegatta, mergeDoc, stamp, toShared } from '../js/archmerge.js';
import { createRegatta, upsertRegatta, addRace, updateRace } from '../js/regates.js';
import { runSync } from '../js/archsync.js';
import { createFakeBlob, invoke } from './helpers/fakeblob.mjs';

const T0 = Date.parse('2026-11-07T07:00:00Z');
const PARCOURS = [{ id: 3 }, { id: 5 }];

function monde() {
  const clock = { t: T0 }, blob = createFakeBlob(), handler = createHandler({ blob, now: () => clock.t });
  return { clock, blob, handler, n: 0 };
}
// Un téléphone : l’état local (REG), la méta (rade.sync.v1) ; save = saveReg (stampState puis markDirty), sync = syncNow
function telephone(nom, w) {
  const p = {
    nom, st: { v: 1, list: [] }, meta: {}, online: true,
    save(next) { const r = stampState(p.st, next, { now: w.clock.t, by: nom }); p.st = r.st; if (r.changed.length) markDirty(p.meta, r.changed); },
    reg(id) { return p.st.list.find((r) => r.id === id); },
    creer() {
      const r = createRegatta({ name: 'Régate des manches', dateStart: '2026-11-07', dateEnd: '2026-11-08', club: 'CVAT' }, { now: w.clock.t, by: nom, rnd: () => 0.5 });
      p.save(upsertRegatta(p.st, r.regatta)); return r.regatta.id;
    },
    ajoute(id, race) { const r = addRace(p.reg(id), { courseId: 3, cls: 'G', laps: 2, ...race }, { now: w.clock.t, by: nom, courses: PARCOURS }); assert.ok(r.ok, JSON.stringify(r.errors)); p.save(upsertRegatta(p.st, r.regatta)); },
    modifie(id, key, race) { const r = updateRace(p.reg(id), key, race, { now: w.clock.t, by: nom, courses: PARCOURS, rnd: () => 0.25 }); if (r.ok) p.save(upsertRegatta(p.st, r.regatta)); return r; },
    sync() { if (!p.meta.first) p.st = legacyStamp(p.st); return runSync(p.deps, 'manuel'); },
  };
  p.deps = {
    now: () => w.clock.t,
    async fetchJson(method, query, body) {
      const r = await invoke(w.handler, { method, url: '/api/archive?' + new URLSearchParams(query), body, headers: { 'x-rt-membre': encodeURIComponent(nom) } });
      return { status: r.status, body: r.body };
    },
    getState: () => p.st, setState: (st) => { p.st = st; }, getMarks: () => ({}), setMarks() {},
    meta: p.meta, saveMeta() {}, backup() {}, isActive: () => false, isOnline: () => p.online, canApply: () => true,
  };
  return p;
}
const avance = (w, ms = 60e3) => { w.clock.t += ms; };
const manches = (p, id) => (p.reg(id)?.races || []).map((m) => `${m.n}:${m.date.slice(8)} ${m.time} p${m.courseId}${m.note ? ` «${m.note}»` : ''}`);
const partage = (p, id) => canon({ ...toShared(p.reg(id)), races: (p.reg(id).races || []).map(({ n, ...m }) => m) });
// Trois téléphones à jour d’une régate de deux manches (10:55 et 13:25 le 7)
async function depart() {
  const w = monde(), A = telephone('Teiva', w), B = telephone('Thibaud', w), C = telephone('Romain', w);
  const id = A.creer();
  A.ajoute(id, { date: '2026-11-07', time: '10:55', courseId: 5, note: 'vent faible' });
  A.ajoute(id, { date: '2026-11-07', time: '13:25' });
  avance(w); await A.sync();
  for (const p of [B, C]) { avance(w); await p.sync(); }
  assert.deepEqual(manches(C, id), ['1:07 10:55 p5 «vent faible»', '2:07 13:25 p3']);
  return { w, A, B, C, id };
}
// Échanges jusqu’au repos : chaque téléphone synchronise deux fois, dans l’ordre donné
async function tour(w, ...ps) { for (let i = 0; i < 2; i++) for (const p of ps) { avance(w, 30e3); await p.sync(); } }

test('modification simple (même jour, même heure) : même identifiant, la nouvelle version chez tous, l’ancienne dans l’historique, signée par le serveur', async () => {
  const { w, A, B, C, id } = await depart();
  const avant = A.reg(id).races[0];
  avance(w);
  const r = B.modifie(id, 1, { courseId: 3, note: 'grain annoncé' });
  assert.equal(r.ok, true); assert.equal(r.moved, false);
  await tour(w, B, A, C);
  for (const p of [A, B, C]) {
    assert.deepEqual(manches(p, id), ['1:07 10:55 p3 «grain annoncé»', '2:07 13:25 p3'], p.nom);
    const m = p.reg(id).races[0];
    assert.equal(m.id, avant.id, 'même identifiant');
    assert.deepEqual([m.by, m.ub], ['Teiva', 'Thibaud'], 'créée par Teiva, modifiée par Thibaud (posé par le serveur)');
    const h = p.reg(id).hist.filter((x) => x.kind === 'race');
    assert.deepEqual(h.map((x) => [x.id, x.v.note, x.v.courseId, x.by]), [[avant.id, 'vent faible', 5, 'Teiva']], `${p.nom} : ancienne version dans l’historique`);
  }
  assert.equal(partage(A, id), partage(C, id), 'mêmes données partout');
});

test('déplacement d’heure : une seule manche, au nouvel identifiant, chez tous ; l’ancien a sa pierre tombale ; le choix de chaque téléphone suit', async () => {
  const { w, A, B, C, id } = await depart();
  C.save(upsertRegatta(C.st, { ...C.reg(id), sel: 1 }));         // C a choisi la manche 10:55
  const ancien = A.reg(id).races[0].id;
  avance(w);
  const r = A.modifie(id, 1, { time: '14:00' });
  assert.equal(r.ok, true); assert.equal(r.moved, true);
  await tour(w, A, B, C);
  for (const p of [A, B, C]) {
    assert.deepEqual(manches(p, id), ['1:07 13:25 p3', '2:07 14:00 p5 «vent faible»'], p.nom);
    assert.deepEqual(p.reg(id).races.map((m) => m.id), ['m202611071325', 'm202611071400']);
    assert.ok(p.reg(id).tomb[`race:${ancien}`], `${p.nom} : pierre tombale de ${ancien}`);
    assert.ok(p.reg(id).hist.some((x) => x.kind === 'race' && x.id === ancien && x.v.time === '10:55'), `${p.nom} : l’ancienne version reste lisible dans l’historique`);
  }
  // sur C, la manche choisie a changé d’identifiant : le choix est retiré (jamais reporté sur une autre manche), C la choisit de nouveau
  assert.equal(C.reg(id).sel, undefined, 'choix retiré sur C, jamais reporté sur la manche 13:25');
});

test('deux téléphones modifient la même manche hors réseau : la modification la plus récente gagne partout, l’autre reste dans l’historique', async () => {
  const { w, A, B, C, id } = await depart();
  A.online = false; B.online = false;
  avance(w); A.modifie(id, 1, { note: 'note de Teiva', laps: 3 });
  avance(w); B.modifie(id, 1, { note: 'note de Thibaud' });      // plus récente
  A.online = true; B.online = true;
  await tour(w, A, B, C);
  for (const p of [A, B, C]) {
    assert.deepEqual(manches(p, id), ['1:07 10:55 p5 «note de Thibaud»', '2:07 13:25 p3'], p.nom);
    assert.equal(p.reg(id).races[0].laps, 2, 'la version gagnante entière, sans mélange de champs');
    assert.ok(p.reg(id).hist.some((x) => x.kind === 'race' && x.v.note === 'note de Teiva' && x.v.laps === 3), `${p.nom} : la version de Teiva dans l’historique`);
  }
  assert.equal(partage(A, id), partage(B, id)); assert.equal(partage(B, id), partage(C, id));
  // dans l’autre ordre d’échange : même résultat
  const x = await depart();
  x.A.online = false; x.B.online = false;
  avance(x.w); x.A.modifie(x.id, 1, { note: 'note de Teiva', laps: 3 });
  avance(x.w); x.B.modifie(x.id, 1, { note: 'note de Thibaud' });
  x.A.online = true; x.B.online = true;
  await tour(x.w, x.C, x.B, x.A);
  assert.deepEqual(manches(x.A, x.id), manches(A, id));
});

test('un téléphone en retard (resté sur l’ancienne heure, avec sa propre saisie) synchronise après le déplacement : ni doublon ni résurrection, sa saisie est gardée', async () => {
  const { w, A, B, C, id } = await depart();
  C.online = false;
  avance(w); C.ajoute(id, { date: '2026-11-08', time: '11:00' });   // C, hors réseau, ajoute une manche le 8 ; il a encore la manche de 10:55
  avance(w); A.modifie(id, 1, { time: '11:30', note: 'retardée' });
  await tour(w, A, B);
  avance(w, 3600e3); C.online = true;
  await tour(w, C, A, B);
  for (const p of [A, B, C]) assert.deepEqual(manches(p, id), ['1:07 11:30 p5 «retardée»', '2:07 13:25 p3', '3:08 11:00 p3'], p.nom);
  assert.equal(partage(A, id), partage(C, id));
  // C renvoie encore une fois son vieil état complet (coupure pendant l’échange) : rien ne revient
  const serveur = JSON.parse(JSON.stringify(A.reg(id)));
  const retard = { ...serveur, races: [...serveur.races.filter((m) => m.time !== '11:30'), { id: 'm202611071055', date: '2026-11-07', time: '10:55', courseId: 5, cls: 'G', laps: 2, note: 'vent faible', by: 'Teiva', at: T0, u: T0, ub: 'Teiva' }], tomb: {} };
  const d = (r) => ({ v: 1, regattas: { [r.id]: r }, tomb: {}, marks: {} });
  const f1 = mergeDoc(d(serveur), d(retard)), f2 = mergeDoc(d(retard), d(serveur));
  assert.equal(canon(f1), canon(f2), 'fusion commutative');
  assert.deepEqual(f1.regattas[id].races.map((m) => m.time).sort(), ['11:00', '11:30', '13:25'], 'la manche 10:55 ne ressuscite pas');
});

test('conflit d’heure : déplacer une manche sur le jour et l’heure d’une autre est refusé (message clair), rien n’est envoyé ni écrasé', async () => {
  const { w, A, B, id } = await depart();
  const sale = { ...A.meta.dirty };
  avance(w);
  const r = A.modifie(id, 1, { time: '13:25', note: 'écrase ?' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.time, 'La manche 2 a déjà ce jour et cette heure : changez l’heure, ou modifiez ou supprimez l’autre manche.');
  assert.deepEqual(A.meta.dirty, sale, 'rien à envoyer');
  await tour(w, A, B);
  assert.deepEqual(manches(B, id), ['1:07 10:55 p5 «vent faible»', '2:07 13:25 p3']);
});

test('cas limite : une modification hors réseau PLUS RÉCENTE que le déplacement, sur l’ancienne heure, est gardée à côté (aucune perte), partout pareil', () => {
  // A déplace 10:55 → 14:00 à t=2000 ; B, hors réseau, modifie la note de 10:55 à t=3000 : le « dernier écrit gagne » garde la modification de B
  const base = stamp(null, addRace({ id: 'rg', name: 'R', club: '', dateStart: '2026-11-07', dateEnd: '', races: [], marks: [], courses: [], traces: [], frozen: {}, by: 'Teiva', at: 1000 },
    { date: '2026-11-07', time: '10:55', courseId: 3 }, { now: 1000, by: 'Teiva', courses: PARCOURS }).regatta, { now: 1000, by: 'Teiva' });
  const a = stamp(base, updateRace(base, 1, { time: '14:00' }, { now: 2000, by: 'Teiva', courses: PARCOURS }).regatta, { now: 2000, by: 'Teiva' });
  const b = stamp(base, updateRace(base, 1, { note: 'B' }, { now: 3000, by: 'Thibaud', courses: PARCOURS }).regatta, { now: 3000, by: 'Thibaud' });
  const m1 = mergeRegatta(toShared(a), toShared(b)), m2 = mergeRegatta(toShared(b), toShared(a));
  assert.equal(canon(m1), canon(m2), 'même résultat dans les deux ordres');
  assert.deepEqual(m1.races.map((m) => [m.time, m.note]), [['10:55', 'B'], ['14:00', '']], 'deux manches : l’équipage supprime celle en trop');
  // modification de B plus ANCIENNE que le déplacement : une seule manche, à 14:00 (la saisie de B est remplacée)
  const b2 = stamp(base, updateRace(base, 1, { note: 'B' }, { now: 1500, by: 'Thibaud', courses: PARCOURS }).regatta, { now: 1500, by: 'Thibaud' });
  assert.deepEqual(mergeRegatta(toShared(a), toShared(b2)).races.map((m) => m.time), ['14:00']);
});
