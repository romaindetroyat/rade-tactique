// Éditeur de parcours de l’espace Tofinou (08-11, D-17) : bouées saisies ou touchées sur la carte (toujours « à confirmer »), parcours saisis
// (côté, porte, arrivée, tours), injection et routage avec leurs tours, partage élément par élément (fusion de l’archive), archive Tofinou.
// Les tests travaillent sur des copies (structuredClone) des tables, jamais sur les vraies ; buildLegs lit la table vivante du plan d’eau :
// les bouées y sont posées puis retirées (applyRegattaMarks(…, null)), comme tests/helpers/legs.mjs. Ce fichier tourne dans son propre processus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setVenue, MARKS, COURSES, LINE_PRESETS } from '../js/lieu.js';
import { setEspace } from '../js/espaces.js';
import { parseLatLon } from '../js/marks.js';
import { toXY, distXY } from '../js/geo.js';

setEspace('tofinou');
setVenue('bormes');

const { addHandMark, courseDraft, checkCourseDraft, saveCourseDraft, removeCourse, HAND, LAP_MAX } = await import('../js/regedit.js');
const { applyRegattaMarks, allowedCourses, confirmMark, ignoreMark, fmtPos, normName, STATUS, MAX_MARKS, marksFromReview, coursesFromReview } = await import('../js/regmarks.js');
const { buildLegs } = await import('../js/tactics.js');
const { courseLaps } = await import('../js/banane.js');
const { stampState, mergeDoc, canon, emptyDoc, toShared } = await import('../js/archmerge.js');
const { createHandler } = await import('../api/archive.js');
const { createFakeBlob, invoke } = await import('./helpers/fakeblob.mjs');

const T0 = Date.parse('2026-12-06T09:00:00Z');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };             // tirages « au hasard » imposés
const POS = { Alpha: '43°07.200N 006°24.000E', Bravo: '43°06.600N 006°23.400E', Charlie: '43°06.600N 006°23.700E', Delta: '43°07.800N 006°23.700E' };
const TOULON = '43°05.845N 005°56.049E';
const regate = (over = {}) => ({ id: 'rg-entr', name: 'Entraînement du club', club: 'Club', venue: 'bormes', dateStart: '2026-12-06', dateEnd: '', races: [], marks: [], courses: [], at: T0, by: 'Frédéric', ...over });
const ajoute = (r, name, txt = POS[name], o = {}) => { const res = addHandMark(r, { name, txt, origine: o.origine }, { by: o.by ?? 'Frédéric', at: o.at ?? T0, rnd: o.rnd }); assert.ok(res.ok, `${name} : ${res.error}`); return res; };
// régate à quatre bouées saisies, toutes confirmées (identifiants imposés : X1001 à X1004)
function quatre({ confirmer = true } = {}) {
  let r = regate();
  ['Alpha', 'Bravo', 'Charlie', 'Delta'].forEach((n, i) => { r = ajoute(r, n, POS[n], { rnd: () => (1 + i) / 9000 }).regatta; });
  if (confirmer) for (const m of r.marks) r = confirmMark(r, m.id, { by: 'Frédéric', at: T0 + 1000 });
  return r;
}
const brouillon = (over = {}) => ({
  id: null, name: 'Parcours d’entraînement',
  steps: [{ kind: 'mark', mark: 'X1001', side: 't' }, { kind: 'gate', mark: 'X1002', gate: 'X1003' }],
  finish: { kind: 'comite', mark: 'X1004' }, laps: 2, lapLine: false, ...over,
});
const tables = () => ({ marks: structuredClone(MARKS), courses: structuredClone(COURSES) });
const ligne = { center: LINE_PRESETS.lavandou, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null };
function legsDe(r, id, opts = {}) {
  try {
    applyRegattaMarks(MARKS, COURSES, r);
    const c = COURSES.find((x) => x.id === id);
    assert.ok(c, `parcours ${id} injecté`);
    return buildLegs(c, 'G', { laps: courseLaps(c, { laps: 2 }), windDir: 280, line: ligne, ...opts });
  } finally { applyRegattaMarks(MARKS, COURSES, null); }
}

// ───────────────────────── bouées saisies

test('addHandMark : position de Bormes → bouée « à confirmer » X1000–X9999, origine saisie ou carte ; position de Toulon refusée avec le message de Bormes', () => {
  const r0 = regate();
  const a = addHandMark(r0, { name: 'Alpha', txt: POS.Alpha, origine: 'saisie' }, { by: 'Frédéric', at: T0, rnd: () => 0.5 });
  assert.equal(a.ok, true);
  assert.match(a.id, /^X\d{4}$/); const n = +a.id.slice(1); assert.ok(n >= 1000 && n <= 9999);
  assert.equal(r0.marks.length, 0, 'la régate d’origine n’est pas modifiée');
  const m = a.regatta.marks[0];
  assert.deepEqual(m, { id: a.id, name: 'Alpha', text: POS.Alpha, lat: 43.12, lon: 6.4, excerpt: '', status: 'a_confirmer', src: 'position saisie', origine: 'saisie', by: 'Frédéric', at: T0 });
  const b = addHandMark(a.regatta, { name: 'Bravo', txt: POS.Bravo, origine: 'carte' }, { by: 'Romain', at: T0, rnd: () => 0.1 });
  assert.equal(b.regatta.marks[1].origine, 'carte'); assert.equal(b.regatta.marks[1].src, 'touchée sur la carte');
  const c = addHandMark(a.regatta, { name: 'Charlie', txt: POS.Charlie, origine: '<script>' }, { by: 'Romain', at: T0 });
  assert.equal(c.regatta.marks[1].origine, 'saisie', 'autre origine → saisie');
  const t = addHandMark(a.regatta, { name: 'Echo', txt: TOULON }, { by: 'Frédéric', at: T0 });
  assert.equal(t.ok, false); assert.match(t.error, /hors de la rade de Bormes – Le Lavandou/); assert.equal(t.regatta, a.regatta);
  assert.match(addHandMark(r0, { name: 'Echo', txt: 'n’importe où' }, {}).error, /par exemple 43°06\.362N 006°24\.252E/);
  assert.equal(HAND, 'saisie'); assert.equal(LAP_MAX, 4);
});

test('addHandMark : nom vide, trop long, nom de ligne ou déjà pris refusés ; 40 bouées au plus ; nom nettoyé ; identifiant libre suivant ; fmtPos relu à 3 m près', () => {
  let r = ajoute(regate(), 'Alpha', POS.Alpha, { rnd: () => 0 }).regatta;
  assert.equal(r.marks[0].id, 'X1000');
  for (const [name, re] of [['', /Nom de la bouée/], ['   ', /Nom de la bouée/], ['x'.repeat(41), /40 caractères/], ['Départ', /ligne/], ['ligne d’arrivée', /ligne/], ['alpha', /existe déjà/], ['Bouée ALPHA', /existe déjà/]]) {
    const res = addHandMark(r, { name, txt: POS.Bravo }, { by: 'F', at: T0 });
    assert.equal(res.ok, false, name); assert.match(res.error, re, name);
  }
  // une bouée ignorée libère son nom
  const ign = ignoreMark(r, 'X1000', { by: 'F', at: T0 });
  assert.equal(addHandMark(ign, { name: 'Alpha', txt: POS.Bravo }, { rnd: () => 0.5 }).ok, true);
  // chevrons et caractères de contrôle retirés
  const sale = addHandMark(r, { name: 'Bra<img src=x>\u0007vo', txt: POS.Bravo }, { rnd: () => 0.5 });
  assert.equal(sale.ok, true); assert.doesNotMatch(sale.regatta.marks[1].name, /[<>\u0007]/);
  // tirage qui retombe sur X1000 (pris) → X1001
  const re = addHandMark(r, { name: 'Bravo', txt: POS.Bravo }, { rnd: () => 0 });
  assert.equal(re.id, 'X1001');
  // 40 bouées
  let plein = regate({ marks: Array.from({ length: MAX_MARKS }, (_, i) => ({ id: `X${i + 1}`, name: `B${i}`, lat: 43.12, lon: 6.4, status: 'a_confirmer' })) });
  const trop = addHandMark(plein, { name: 'Zoulou', txt: POS.Bravo }, {});
  assert.equal(trop.ok, false); assert.match(trop.error, /40 bouées/);
  // fmtPos → parseLatLon : même point à 3 m près
  for (const [lat, lon] of [[43.1234567, 6.3876543], [43.0011, 6.6999], [42.95, 6.21]]) {
    const p = parseLatLon(fmtPos(lat, lon), { south: 42.86, north: 43.30, west: 6.20, east: 6.70 });
    assert.ok(distXY(toXY(lat, lon), toXY(p.lat, p.lon)) < 3, `${lat} ${lon}`);
  }
});

// ───────────────────────── brouillon et contrôles

test('courseDraft : brouillon vide, ou celui d’un parcours de la régate (lu ou saisi), porte comprise', () => {
  assert.deepEqual(courseDraft(regate(), null), { id: null, name: '', steps: [{ kind: 'mark', mark: '', side: '' }], finish: { kind: 'ligne', mark: '' }, laps: 1, lapLine: true });
  const r = saveCourseDraft(quatre(), brouillon(), { by: 'Frédéric', at: T0, rnd: () => 0 }).regatta;
  const d = courseDraft(r, r.courses[0].id);
  assert.deepEqual(d, { ...brouillon(), id: r.courses[0].id });
  // parcours lu dans les IC (porte, arrivée près d’une bouée)
  const lu = { id: 101, name: 'Parcours B', seq: [{ mark: 'X1001', side: 'b' }, { mark: 'X1002', side: null, gate: 'X1003' }], finish: { kind: 'pres', mark: 'X1004', excerpt: 'arrivée près de Delta' }, excerpt: 'Parcours B', incomplete: false, missing: [], by: 'Teiva', at: T0 };
  assert.deepEqual(courseDraft({ ...quatre(), courses: [lu] }, 101), { id: 101, name: 'Parcours B', steps: [{ kind: 'mark', mark: 'X1001', side: 'b' }, { kind: 'gate', mark: 'X1002', gate: 'X1003' }], finish: { kind: 'pres', mark: 'X1004' }, laps: 1, lapLine: true });
  assert.equal(courseDraft(regate(), 999), null, 'parcours inconnu');
});

test('checkCourseDraft : erreurs en français par champ ; seules les bouées CONFIRMÉES avec position entrent dans un parcours', () => {
  const r = quatre();
  assert.deepEqual(checkCourseDraft(r, brouillon()), {});
  const e = (over) => checkCourseDraft(r, brouillon(over));
  assert.match(e({ name: ' ' }).name, /Nom du parcours/);
  assert.match(e({ name: 'x'.repeat(61) }).name, /60 caractères/);
  const avec = saveCourseDraft(r, brouillon({ name: 'Autre' }), { rnd: () => 0 }).regatta;
  assert.match(checkCourseDraft(avec, brouillon({ name: 'autre' })).name, /déjà/, 'nom déjà pris par un autre parcours');
  assert.deepEqual(checkCourseDraft(avec, { ...brouillon({ name: 'Autre' }), id: avec.courses[0].id }), {}, 'le parcours lui-même garde son nom');
  assert.match(e({ steps: [] }).steps, /au moins une étape/);
  assert.match(e({ steps: Array.from({ length: 41 }, () => ({ kind: 'mark', mark: 'X1001', side: 'b' })) }).steps, /40 étapes/);
  assert.match(e({ steps: [{ kind: 'mark', mark: 'X1001', side: '' }] })['step.0'], /Côté/);
  assert.match(e({ steps: [{ kind: 'mark', mark: 'X9999', side: 'b' }] })['step.0'], /bouée confirmée/);
  assert.match(e({ steps: [{ kind: 'gate', mark: 'X1002', gate: 'X1002' }] })['step.0'], /deux bouées différentes/);
  assert.match(e({ steps: [{ kind: 'gate', mark: 'X1002', gate: '' }] })['step.0'], /deux bouées confirmées/);
  assert.match(e({ steps: [{ kind: 'autre', mark: 'X1001' }] })['step.0'], /illisible/);
  assert.match(e({ finish: { kind: 'comite', mark: '' } }).finish, /bouée confirmée/);
  assert.match(e({ finish: { kind: 'pres', mark: 'X9999' } }).finish, /bouée confirmée/);
  assert.match(e({ finish: { kind: 'ailleurs', mark: '' } }).finish, /Arrivée/);
  assert.deepEqual(e({ finish: { kind: 'ligne', mark: '' } }), {});
  for (const laps of [0, 5, 1.5, 'deux', null]) assert.match(e({ laps }).laps ?? '', /de 1 à 4/, String(laps));
  assert.match(e({ lapLine: 'oui' }).lapLine, /entre deux tours/);
  // bouée à confirmer, à saisir ou ignorée : refusée
  let r2 = quatre({ confirmer: false });
  r2 = confirmMark(r2, 'X1001', {}); r2 = confirmMark(r2, 'X1002', {}); r2 = ignoreMark(confirmMark(r2, 'X1003', {}), 'X1003', {});
  r2 = { ...r2, marks: [...r2.marks, { id: 'X5', name: 'Sans position', lat: null, lon: null, status: 'confirmee' }] };
  const er = checkCourseDraft(r2, brouillon({ steps: [{ kind: 'mark', mark: 'X1004', side: 'b' }, { kind: 'gate', mark: 'X1002', gate: 'X1003' }, { kind: 'mark', mark: 'X5', side: 'b' }] }));
  assert.match(er['step.0'], /bouée confirmée/, 'à confirmer'); assert.match(er['step.1'], /deux bouées confirmées/, 'ignorée'); assert.match(er['step.2'], /bouée confirmée/, 'sans position');
  assert.match(er.finish, /bouée confirmée/);
});

test('saveCourseDraft : forme du parcours saisi, identifiant libre 1000–9999 (régate et table), modification datée, parcours lu devenu saisi, 20 au plus ; removeCourse', () => {
  const r = quatre();
  const s = saveCourseDraft(r, brouillon(), { by: 'Frédéric', at: T0, rnd: () => 0, taken: [1000, 1001] });
  assert.equal(s.ok, true);
  assert.equal(s.id, 1002, 'tirage sur 1000 et 1001 pris par la table : 1002');
  assert.deepEqual(s.regatta.courses[0], {
    id: 1002, name: 'Parcours d’entraînement', seq: [{ mark: 'X1001', side: 't' }, { mark: 'X1002', side: null, gate: 'X1003' }],
    finish: { kind: 'comite', mark: 'X1004' }, laps: 2, lapLine: false, origine: 'saisie', excerpt: '', incomplete: false, missing: [], by: 'Frédéric', at: T0,
  });
  assert.equal(r.courses.length, 0, 'régate d’origine intacte');
  const un = saveCourseDraft(r, brouillon({ laps: 1, lapLine: false, finish: { kind: 'ligne', mark: '' } }), { rnd: () => 0.5 }).regatta.courses[0];
  assert.ok(!('laps' in un) && !('lapLine' in un) && !('finish' in un), 'un tour : ni laps ni lapLine ; arrivée sur la ligne : pas de finish');
  assert.equal(saveCourseDraft(r, brouillon({ lapLine: true }), { rnd: () => 0.5 }).regatta.courses[0].lapLine, undefined, 'par la ligne : clé absente');
  // modification : même identifiant, auteur et date de création gardés, edited
  const m = saveCourseDraft(s.regatta, { ...courseDraft(s.regatta, 1002), steps: [{ kind: 'mark', mark: 'X1001', side: 'b' }, { kind: 'gate', mark: 'X1002', gate: 'X1003' }], laps: 3 }, { by: 'Romain', at: T0 + 5000, rnd: () => 0.9 });
  assert.equal(m.id, 1002); assert.equal(m.regatta.courses.length, 1);
  const c = m.regatta.courses[0];
  assert.deepEqual([c.by, c.at, c.edited, c.laps, c.seq[0].side], ['Frédéric', T0, { by: 'Romain', at: T0 + 5000 }, 3, 'b']);
  // parcours lu dans les IC modifié : même identifiant, devient saisi, extrait vidé
  const marks = marksFromReview([{ name: 'Golf', position: '43.12 N ; 6.39 E', excerpt: 'Golf : 43.12 N ; 6.39 E' }], { by: 'Teiva', at: T0, existing: r.marks, bounds: { south: 42.86, north: 43.30, west: 6.20, east: 6.70 } });
  let rl = { ...r, marks: [...r.marks, ...marks] };
  rl = { ...rl, courses: coursesFromReview([{ name: 'Parcours lu', sequence: [{ mark: 'Golf', side: 'b' }], excerpt: 'Parcours lu : Golf bâbord' }], rl.marks, { by: 'Teiva', at: T0 }) };
  rl = confirmMark(rl, rl.marks[4].id, {});
  const ml = saveCourseDraft(rl, { ...courseDraft(rl, rl.courses[0].id), laps: 2 }, { by: 'Frédéric', at: T0 + 9000 });
  assert.equal(ml.ok, true);
  const cl = ml.regatta.courses[0];
  assert.deepEqual([cl.id, cl.origine, cl.excerpt, cl.by, cl.edited.by, cl.laps], [rl.courses[0].id, 'saisie', '', 'Teiva', 'Frédéric', 2]);
  // erreurs : brouillon invalide, parcours disparu, 20 parcours
  assert.equal(saveCourseDraft(r, brouillon({ name: '' })).ok, false);
  assert.match(saveCourseDraft(r, { ...brouillon(), id: 4242 }).errors.course, /introuvable/);
  const vingt = { ...r, courses: Array.from({ length: 20 }, (_, i) => ({ id: 2000 + i, name: `P${i}`, seq: [{ mark: 'X1001', side: 'b' }], origine: 'saisie' })) };
  assert.match(saveCourseDraft(vingt, brouillon()).errors.course, /20 parcours/);
  // removeCourse
  const sans = removeCourse(s.regatta, 1002);
  assert.deepEqual(sans.courses, []); assert.equal(removeCourse(s.regatta, 7).courses.length, 1);
});

// ───────────────────────── injection, parcours proposés, routage

test('applyRegattaMarks : parcours saisi injecté une fois ses bouées confirmées, « (saisi) », tours imposés, texte ; parcours lus inchangés', () => {
  const pas = saveCourseDraft(quatre({ confirmer: false }), brouillon(), { rnd: () => 0 });
  assert.equal(pas.ok, false, 'bouées à confirmer : refusé par checkCourseDraft');
  let r = saveCourseDraft(quatre(), brouillon(), { by: 'Frédéric', at: T0, rnd: () => 0 }).regatta;
  // une bouée redevenue « à confirmer » (position corrigée) retire le parcours
  const moins = { ...r, marks: r.marks.map((m) => (m.id === 'X1003' ? { ...m, status: STATUS.A_CONFIRMER } : m)) };
  let t = tables();
  assert.deepEqual(applyRegattaMarks(t.marks, t.courses, moins).addedCourses, []);
  t = tables();
  assert.deepEqual(applyRegattaMarks(t.marks, t.courses, r).addedCourses, [1000]);
  const c = t.courses.find((x) => x.id === 1000);
  assert.deepEqual(c, {
    id: 1000, title: 'Parcours d’entraînement (saisi)', custom: true, saisi: true, fromRegatta: 'rg-entr',
    seq: { G: [['X1001', 't'], ['X1002', null, 'X1003']], P: [['X1001', 't'], ['X1002', null, 'X1003']] },
    finish: { kind: 'comite', mark: 'X1004' }, laps: true, fixedLaps: 2, lapLine: false,
    text: 'Ligne de départ, Alpha tribord, porte Bravo / Charlie (2 tours, sans repasser la ligne entre deux tours), arrivée entre le Comité et Delta. Parcours saisi dans l’app, bouées confirmées sur la carte : le Comité fait foi.',
  });
  r = saveCourseDraft(quatre(), brouillon({ laps: 1, finish: { kind: 'ligne', mark: '' } }), { rnd: () => 0 }).regatta;
  t = tables(); applyRegattaMarks(t.marks, t.courses, r);
  const c1 = t.courses.find((x) => x.id === 1000);
  assert.ok(!('laps' in c1) && !('fixedLaps' in c1) && !('lapLine' in c1) && !('finish' in c1));
  assert.match(c1.text, /^Ligne de départ, Alpha tribord, porte Bravo \/ Charlie, ligne d’arrivée\. Parcours saisi/);
  r = saveCourseDraft(quatre(), brouillon({ laps: 3, lapLine: true }), { rnd: () => 0 }).regatta;
  t = tables(); applyRegattaMarks(t.marks, t.courses, r);
  assert.match(t.courses.find((x) => x.id === 1000).text, /\(3 tours, par la ligne de départ entre deux tours\)/);
});

test('allowedCourses : parcours saisis seuls → catalogue + saisis ; avec des parcours lus → les siens ; sans parcours saisi → sortie de la v43', () => {
  const r = saveCourseDraft(quatre(), brouillon(), { rnd: () => 0 }).regatta;
  let t = tables(); applyRegattaMarks(t.marks, t.courses, r);
  const ids = (l) => l.map((c) => c.id);
  const cat = ids(COURSES);
  assert.deepEqual(ids(allowedCourses(t.courses, 'rg-entr')), [...cat, 1000], 'catalogue du Challenge, puis le parcours saisi');
  assert.deepEqual(ids(allowedCourses(t.courses, null)), cat, 'sans régate ouverte : le catalogue');
  assert.deepEqual(ids(allowedCourses(t.courses, 'autre')), cat);
  // avec un parcours lu injecté : les parcours de la régate seulement (lus et saisis)
  const lu = { id: 101, name: 'Parcours lu', seq: [{ mark: 'X1001', side: 'b' }], excerpt: 'x', incomplete: false, missing: [], by: 'T', at: T0 };
  t = tables(); applyRegattaMarks(t.marks, t.courses, { ...r, courses: [lu, ...r.courses] });
  assert.deepEqual(ids(allowedCourses(t.courses, 'rg-entr')), [101, 1000]);
  t = tables(); applyRegattaMarks(t.marks, t.courses, { ...r, courses: [lu] });
  assert.deepEqual(ids(allowedCourses(t.courses, 'rg-entr')), [101], 'sans parcours saisi : comme en v43');
});

test('buildLegs : parcours saisi à 2 tours — par la ligne entre les tours (comme le parcours 1 du cahier), ou sans la repasser (lapLine: false)', () => {
  const sans = saveCourseDraft(quatre(), brouillon({ laps: 2, lapLine: false }), { rnd: () => 0 }).regatta;
  const B = legsDe(sans, 1000);
  assert.deepEqual(B.legs.map((l) => l.mark), ['X1001', 'PORTE', 'X1001', 'PORTE', 'FINISH']);
  assert.match(B.legs.at(-1).to.name, /^Arrivée \(Comité – X1004 Delta\)$/);
  const par = saveCourseDraft(quatre(), brouillon({ laps: 2, lapLine: true }), { rnd: () => 0 }).regatta;
  assert.deepEqual(legsDe(par, 1000).legs.map((l) => l.mark), ['X1001', 'PORTE', 'GATE', 'X1001', 'PORTE', 'FINISH']);
  const trois = saveCourseDraft(quatre(), brouillon({ laps: 3, lapLine: false }), { rnd: () => 0 }).regatta;
  assert.equal(legsDe(trois, 1000).legs.filter((l) => l.mark === 'X1001').length, 3, 'tours imposés (fixedLaps) : courseLaps ignore les tours de l’état');
  const un = saveCourseDraft(quatre(), brouillon({ laps: 1 }), { rnd: () => 0 }).regatta;
  assert.deepEqual(legsDe(un, 1000).legs.map((l) => l.mark), ['X1001', 'PORTE', 'FINISH']);
  assert.deepEqual(Object.keys(MARKS).filter((k) => /^X/.test(k)), [], 'table du plan d’eau rendue intacte');
});

// ───────────────────────── partage par éléments

const etat = (list) => ({ list, tomb: {}, current: null });
const docDe = (st) => ({ v: 1, regattas: Object.fromEntries(st.list.map((r) => [r.id, toShared(r)])), tomb: {}, marks: {} });
test('partage : deux téléphones hors réseau créent chacun une bouée et un parcours → les quatre gardés ; même parcours modifié → le plus récent gagne, l’autre dans hist ; suppression = pierre tombale ; fusion commutative', () => {
  const base = stampState(etat([]), etat([quatre()]), { now: T0, by: 'Frédéric' }).st;
  const docBase = docDe(base);
  // A : une bouée et un parcours ; B : une bouée et un parcours (tirages différents)
  const enA = () => { let r = structuredClone(base.list[0]); r = ajoute(r, 'Écho', '43°07.000N 006°23.000E', { rnd: () => 0.31 }).regatta; r = saveCourseDraft(r, brouillon({ name: 'Parcours A' }), { by: 'Frédéric', at: T0 + 10, rnd: () => 0.31 }).regatta; return stampState(base, etat([r]), { now: T0 + 100, by: 'Frédéric' }).st; };
  const enB = () => { let r = structuredClone(base.list[0]); r = ajoute(r, 'Fox', '43°07.100N 006°23.100E', { rnd: () => 0.62, by: 'Romain' }).regatta; r = saveCourseDraft(r, brouillon({ name: 'Parcours B' }), { by: 'Romain', at: T0 + 20, rnd: () => 0.62 }).regatta; return stampState(base, etat([r]), { now: T0 + 200, by: 'Romain' }).st; };
  const A = enA(), B = enB();
  assert.notEqual(A.list[0].courses[0].id, B.list[0].courses[0].id, 'identifiants tirés au hasard : pas de collision');
  const ab = mergeDoc(docDe(A), docDe(B)), ba = mergeDoc(docDe(B), docDe(A));
  assert.equal(canon(ab), canon(ba), 'commutative');
  const rg = ab.regattas['rg-entr'];
  assert.deepEqual(rg.marks.map((m) => m.name).sort(), ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Fox', 'Écho'].sort());
  assert.deepEqual(rg.courses.map((c) => c.name).sort(), ['Parcours A', 'Parcours B']);
  // même parcours modifié des deux côtés : le plus récent gagne partout, l’autre dans l’historique (kind course)
  const commun = mergeDoc(docBase, docDe(A)).regattas['rg-entr'];
  const id = commun.courses[0].id;
  const st0 = etat([commun]);
  const mod = (laps, by, now) => { const r = structuredClone(commun); const s = saveCourseDraft(r, { ...courseDraft(r, id), laps }, { by, at: now, rnd: () => 0 }); return stampState(st0, etat([s.regatta]), { now, by }).st; };
  const MA = mod(3, 'Frédéric', T0 + 1000), MB = mod(4, 'Romain', T0 + 2000);
  const x = mergeDoc(docDe(MA), docDe(MB)), y = mergeDoc(docDe(MB), docDe(MA));
  assert.equal(canon(x), canon(y));
  const gagnant = x.regattas['rg-entr'].courses.find((c) => c.id === id);
  assert.equal(gagnant.laps, 4, 'le plus récent (Romain) gagne');
  const h = x.regattas['rg-entr'].hist.filter((e) => e.kind === 'course' && e.id === String(id));
  assert.equal(h.length, 1); assert.equal(h[0].v.laps, 3, 'la version écrasée est dans l’historique');
  // suppression puis fusion avec une copie plus ancienne : pierre tombale respectée
  const sup = stampState(st0, etat([removeCourse(structuredClone(commun), id)]), { now: T0 + 3000, by: 'Frédéric' }).st;
  assert.ok(sup.list[0].tomb[`course:${id}`]);
  const z = mergeDoc(docDe(sup), docDe(etat([commun])));
  assert.ok(!z.regattas['rg-entr'].courses.some((c) => c.id === id), 'supprimé partout');
  assert.equal(canon(z), canon(mergeDoc(docDe(etat([commun])), docDe(sup))));
  assert.equal(canon(mergeDoc(z, z)), canon(mergeDoc(z, emptyDoc())), 'idempotente');
});

test('archive Tofinou : régate de Bormes avec bouées et parcours saisis acceptée, rangée sous tofinou/preview/light.json, éléments relus identiques, auteur signé', async () => {
  const blob = createFakeBlob(), handler = createHandler({ blob, now: () => T0 + 60e3 });
  let r = quatre();
  r = saveCourseDraft(r, brouillon(), { by: 'Frédéric', at: T0, rnd: () => 0 }).regatta;
  const st = stampState(etat([]), etat([r]), { now: T0 + 1000, by: 'Frédéric' }).st;
  const res = await invoke(handler, { method: 'PUT', url: '/api/archive?k=light', body: { doc: docDe(st) }, headers: { 'x-rt-membre': encodeURIComponent('Frédéric'), 'x-rt-espace': 'tofinou' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([...blob.store.keys()], ['tofinou/preview/light.json']);
  const lu = JSON.parse(blob.store.get('tofinou/preview/light.json').text).regattas['rg-entr'];
  const sans = (e) => { const { by, ub, ...x } = e; return x; };
  assert.deepEqual(lu.marks.map(sans), st.list[0].marks.map(sans));
  assert.deepEqual(lu.courses.map(sans), st.list[0].courses.map(sans));
  assert.ok([...lu.marks, ...lu.courses].every((e) => e.ub === 'Frédéric'), 'auteur signé par le serveur, élément par élément');
  assert.equal(normName(lu.courses[0].name), normName('Parcours d’entraînement'));
});

// ───────────────────────── vues de l’éditeur (linkedom)

const { parseHTML } = await import('linkedom');
const { marksSectionHTML, sheetHTML, markAddHTML, courseFormHTML } = await import('../js/regview.js');
const dom = (html) => parseHTML(`<div id="racine">${html}</div>`).document;
const PIEGE = '<img src=x onerror=alert(1)>';

test('marksSectionHTML avec l’éditeur : section toujours affichée, « ＋ Ajouter une bouée », « Créer un parcours », « Modifier le parcours », « Supprimer le parcours » ; tout inactif en course', () => {
  let d = dom(marksSectionHTML(regate(), { editeur: true }));
  assert.match(d.querySelector('#rgEdit h4').textContent, /^Bouées et parcours de la régate/);
  assert.equal(d.querySelector('#mkNew').textContent, '＋ Ajouter une bouée');
  assert.equal(d.querySelector('#coNew').textContent, 'Créer un parcours');
  assert.equal(marksSectionHTML(regate(), {}), '', 'sans éditeur : rien pour une régate sans bouée (v43)');
  const r = saveCourseDraft(quatre(), brouillon(), { by: 'Frédéric', at: T0, rnd: () => 0 }).regatta;
  d = dom(marksSectionHTML(r, { editeur: true }));
  const row = d.querySelector('[data-co-row="1000"]');
  assert.match(row.textContent, /Parcours d’entraînement \(saisi\)/);
  assert.match(row.textContent, /Alpha tribord → porte Bravo \/ Charlie/);
  assert.match(row.textContent, /Arrivée : entre le Comité et Delta/);
  assert.match(row.textContent, /2 tours · entre deux tours : sans repasser la ligne/);
  assert.match(row.textContent, /Saisi par Frédéric le 06\/12/);
  assert.match(row.textContent, /proposé dans l’onglet Parcours/);
  assert.equal(row.querySelector('[data-co-edit]').textContent, 'Modifier le parcours');
  assert.equal(row.querySelector('[data-co-del]').textContent, 'Supprimer le parcours');
  assert.match(d.querySelector('[data-mk-row="X1001"]').textContent, /Confirmée par Frédéric/);
  const pend = quatre({ confirmer: false });
  assert.match(dom(marksSectionHTML(pend, { editeur: true })).querySelector('[data-mk-row="X1001"]').textContent, /Ajoutée par Frédéric le 06\/12/);
  assert.match(dom(marksSectionHTML(pend, {})).querySelector('[data-mk-row="X1001"]').textContent, /Lue par Frédéric/, 'sans éditeur : « Lue » de la v43');
  // en course : boutons inactifs, mention de la course
  d = dom(marksSectionHTML({ ...r, marks: [...r.marks, ...pend.marks.map((m) => ({ ...m, id: m.id.replace('X1', 'X2') }))] }, { editeur: true, locked: true }));
  for (const b of d.querySelectorAll('#mkNew, #coNew, [data-co-edit], [data-co-del], [data-mk-ok], [data-mk-fix], [data-mk-ign]')) assert.ok(b.hasAttribute('disabled'), b.outerHTML);
  assert.ok(d.querySelectorAll('[data-mk-ok]').length > 0);
  assert.match(d.querySelector('#rgEditLock').textContent, /Course en cours : parcours et bouées modifiables après la course/);
  assert.ok(!d.querySelector('[data-mk-voir]').hasAttribute('disabled'), '« Voir sur la carte » reste possible');
});

test('formulaires : ajout de bouée (exemple de Bormes) ; parcours avec les seules bouées confirmées, étapes, arrivée, tours, erreurs sous chaque champ', () => {
  let d = dom(markAddHTML({ name: 'Alpha', txt: '43°07.200N 006°24.000E', err: 'Position hors de…' }, { exemple: '43°06.362N 006°24.252E' }));
  assert.equal(d.querySelector('#mkaName').getAttribute('value'), 'Alpha');
  assert.equal(d.querySelector('#mkaPos').getAttribute('placeholder'), '43°06.362N 006°24.252E');
  assert.ok(d.querySelector('#mkaOk') && d.querySelector('#mkaNo'));
  assert.equal(d.querySelector('#mkaErr').textContent, 'Position hors de…');
  // la section passe l’exemple du plan d’eau de la régate
  assert.equal(dom(marksSectionHTML(regate(), { editeur: true, markAdd: { name: '', txt: '' } })).querySelector('#mkaPos').getAttribute('placeholder'), '43°06.362N 006°24.252E');
  let r = quatre({ confirmer: false });
  r = confirmMark(confirmMark(r, 'X1001', {}), 'X1002', {});
  const dr = { ...brouillon(), steps: [{ kind: 'mark', mark: 'X1001', side: 't' }, { kind: 'gate', mark: 'X1002', gate: '' }] };
  d = dom(courseFormHTML(r, dr, checkCourseDraft(r, dr)));
  const opts = [...d.querySelectorAll('[data-st-mark="0"] option')].map((o) => o.getAttribute('value'));
  assert.deepEqual(opts, ['', 'X1001', 'X1002'], 'seules les bouées confirmées sont proposées');
  assert.equal(d.querySelector('[data-st-side="0"] option[selected]').getAttribute('value'), 't');
  assert.ok(d.querySelector('[data-st-gate="1"]'), 'porte : deux bouées');
  assert.match(d.querySelector('[data-err="step.1"]').textContent, /deux bouées confirmées/);
  assert.match(d.querySelector('[data-err="finish"]').textContent, /bouée confirmée/, 'Delta n’est pas confirmée');
  assert.deepEqual([...d.querySelectorAll('#coFin option')].map((o) => o.textContent), ['Sur la ligne de départ', 'Entre le Comité et une bouée', 'Près d’une bouée']);
  assert.deepEqual([...d.querySelectorAll('#coLaps option')].map((o) => o.textContent), ['1', '2', '3', '4']);
  assert.deepEqual([...d.querySelectorAll('#coLapLine option')].map((o) => [o.textContent, o.hasAttribute('selected')]), [['par la ligne de départ', false], ['sans repasser la ligne', true]]);
  assert.ok(d.querySelector('#coStepAdd') && d.querySelector('#coSave') && d.querySelector('#coCancel'));
  assert.equal(d.querySelector('#coForm h4').textContent, 'Créer un parcours');
  assert.equal(dom(courseFormHTML(r, { ...dr, id: 1000 })).querySelector('#coForm h4').textContent, 'Modifier le parcours');
  assert.equal(dom(courseFormHTML(r, { ...dr, laps: 1 })).querySelector('#coLapLine'), null, 'un tour : pas de passage entre les tours');
  d = dom(courseFormHTML(quatre({ confirmer: false }), courseDraft(regate(), null)));
  assert.match(d.querySelector('#coNone').textContent, /confirmez d’abord une bouée/);
});

test('noms venus d’un membre ou d’un autre téléphone échappés (bouée, parcours, porte, arrivée) ; sans option, sheetHTML sans éditeur', () => {
  const r0 = quatre();
  const r = { ...saveCourseDraft(r0, brouillon(), { rnd: () => 0 }).regatta };
  r.marks = r.marks.map((m) => (m.id === 'X1003' || m.id === 'X1004' ? { ...m, name: `${m.name}${PIEGE}` } : m));
  r.courses = r.courses.map((c) => ({ ...c, name: `Parcours ${PIEGE}` }));
  for (const html of [marksSectionHTML(r, { editeur: true, markAdd: { name: PIEGE, txt: PIEGE, err: PIEGE }, courseEdit: { ...courseDraft(r, 1000), name: PIEGE }, courseErr: { name: PIEGE } }), courseFormHTML(r, courseDraft(r, 1000), { 'step.0': PIEGE }), sheetHTML(r, { now: T0, editeur: { locked: false, markAdd: null, courseEdit: null, courseErr: {} } })]) {
    assert.equal(dom(html).querySelectorAll('img, script').length, 0, html.slice(0, 200));
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  }
  const avec = dom(sheetHTML(r, { now: T0, editeur: { locked: false } }));
  assert.ok(avec.querySelector('#coNew') && avec.querySelector('[data-co-edit]'));
  const sans = dom(sheetHTML(r, { now: T0 }));
  assert.equal(sans.querySelectorAll('#mkNew, #coNew, [data-co-edit], [data-co-del], #rgEdit').length, 0, 'Naos : aucun élément de l’éditeur');
  assert.match(sans.querySelector('[data-co-row="1000"]').textContent, /\(IC\)/, 'sans éditeur : la vue de la v43');
});
