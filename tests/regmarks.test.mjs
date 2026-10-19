// Bouées et parcours d’un autre club « à confirmer » (D-04, REG-04). Les tables réelles MARKS et COURSES ne sont JAMAIS modifiées par un test :
// copies structuredClone seulement, et comparaison avec l’état du début à la fin du fichier.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { MARKS, COURSES } from '../js/courses.js';
import {
  MARK_PREFIX, COURSE_BASE, STATUS, marksFromReview, coursesFromReview, confirmMark, moveMark, ignoreMark, pendingMarks, waitingFor, applyRegattaMarks, normName, fmtPos,
} from '../js/regmarks.js';

const MARKS_AVANT = JSON.stringify(MARKS), COURSES_AVANT = JSON.stringify(COURSES);
after(() => {
  assert.equal(JSON.stringify(MARKS), MARKS_AVANT, 'MARKS réel modifié par un test');
  assert.equal(JSON.stringify(COURSES), COURSES_AVANT, 'COURSES réel modifié par un test');
});

const T0 = Date.parse('2026-10-19T10:00:00Z');
const lues = [
  { name: 'Alpha', position: '43°05,845\' N – 005°56,049\' E', excerpt: 'Alpha : 43°05,845\' N – 005°56,049\' E' },
  { name: 'Bravo', position: '43.0905 N ; 5.9587 E', excerpt: 'Bravo : 43.0905 N ; 5.9587 E' },
  { name: 'Charlie', position: 'à 0,4 Nq dans l’Est de la Grande Jetée', excerpt: 'Charlie : à 0,4 Nq dans l’Est de la Grande Jetée' },
];
const reg = (over = {}) => ({ id: 'rgA', name: 'Régate A', club: 'SNM', marks: [], courses: [], ...over });
const tables = () => ({ marks: structuredClone(MARKS), courses: structuredClone(COURSES) });
const avecMarques = (statuts = {}) => {
  const marks = marksFromReview(lues, { by: 'Teiva', at: T0, club: 'SNM' });
  return reg({ marks: marks.map((m) => (statuts[m.id] ? { ...m, status: statuts[m.id], ...(statuts[m.id] === STATUS.CONFIRMEE ? { confirmed: { by: 'Thibaud', at: T0 } } : {}) } : m)) });
};

test('marksFromReview : degrés-minutes et décimal convertis par parseLatLon, illisible → position à saisir (jamais devinée)', () => {
  const m = marksFromReview(lues, { by: 'Teiva', at: T0, club: 'SNM' });
  assert.deepEqual(m.map((x) => x.id), ['X1', 'X2', 'X3']);
  assert.equal(MARK_PREFIX, 'X');
  assert.deepEqual([m[0].lat, m[0].lon], [43.097417, 5.93415]);
  assert.deepEqual([m[1].lat, m[1].lon], [43.0905, 5.9587]);
  assert.deepEqual([m[2].lat, m[2].lon], [null, null]);
  for (const x of m) { assert.equal(x.status, STATUS.A_CONFIRMER); assert.equal(x.src, 'IC SNM'); assert.equal(x.by, 'Teiva'); assert.equal(x.at, T0); }
  assert.equal(m[0].excerpt, lues[0].excerpt, 'l’extrait est gardé');
  assert.equal(m[2].text, lues[2].position);
});

test('marksFromReview : position hors de la rade refusée, nom en double ignoré, identifiants jamais réutilisés', () => {
  const m = marksFromReview([{ name: 'Paris', position: '48°51.400N 002°21.100E', excerpt: 'x' }, { name: 'Alpha', position: '43.09 N 5.95 E' }, { name: 'ALPHA ', position: '43.09 N 5.95 E' }, { name: '  ', position: '43.09 N 5.95 E' }], { club: '' });
  assert.deepEqual(m.map((x) => [x.name, x.lat]), [['Paris', null], ['Alpha', 43.09]], 'hors rade : sans position ; doublon et nom vide écartés');
  assert.equal(m[0].src, 'IC autre club');
  const existantes = [{ id: 'X4', name: 'Delta', status: STATUS.IGNOREE }];
  const suite = marksFromReview([{ name: 'Echo', position: '' }, { name: 'Delta', position: '43.09 N 5.95 E' }], { existing: existantes });
  assert.deepEqual(suite.map((x) => x.id), ['X5'], 'numérotation après X4 (ignorée), Delta déjà là');
});

test('marksFromReview : nom piégé nettoyé (aucun chevron), bornes de longueur', () => {
  const [m] = marksFromReview([{ name: '<img src=x onerror=alert(1)>Alpha'.repeat(5), position: '43.09 N 5.95 E', excerpt: '<b>x</b>'.repeat(200) }]);
  assert.ok(!/[<>]/.test(m.name) && m.name.length <= 40);
  assert.ok(!/[<>]/.test(m.excerpt) && m.excerpt.length <= 300);
});

test('coursesFromReview : séquence de noms → identifiants X…, côtés, départ et arrivée ignorés, identifiants 101, 102…', () => {
  const marks = avecMarques().marks;
  const c = coursesFromReview([
    { name: 'Parcours A', excerpt: 'Parcours A : départ, Alpha bâbord, Bravo bâbord, arrivée', sequence: [{ mark: 'Départ', side: null }, { mark: 'Alpha', side: 'b' }, { mark: 'bouée Bravo', side: 'b' }, { mark: 'Ligne d’arrivée', side: null }] },
    { name: 'Parcours B', sequence: [{ mark: 'Bravo', side: 't' }, { mark: 'Zoulou', side: 'b' }] },
    { name: 'Parcours C', sequence: [{ mark: 'Alpha', side: 'x' }] },
  ], marks, { by: 'Teiva', at: T0 });
  assert.deepEqual(c.map((x) => x.id), [101, 102, 103]);
  assert.equal(COURSE_BASE, 100);
  assert.deepEqual(c[0].seq, [{ mark: 'X1', side: 'b' }, { mark: 'X2', side: 'b' }]);
  assert.equal(c[0].incomplete, false);
  assert.equal(c[1].incomplete, true, 'bouée inconnue : parcours incomplet');
  assert.deepEqual(c[1].missing, ['Zoulou']);
  assert.deepEqual(c[2].seq, [{ mark: 'X1', side: null }], 'côté inconnu → null, jamais deviné');
});

test('coursesFromReview : un parcours sans aucune bouée connue est incomplet ; nom en double ignoré', () => {
  const marks = avecMarques().marks;
  const c = coursesFromReview([{ name: 'Vide', sequence: [{ mark: 'Départ', side: null }] }, { name: 'Vide', sequence: [] }], marks);
  assert.equal(c.length, 1);
  assert.equal(c[0].incomplete, true);
});

test('applyRegattaMarks : une bouée à confirmer n’entre jamais dans la table des marques', () => {
  const { marks, courses } = tables(), r = avecMarques();
  const res = applyRegattaMarks(marks, courses, r);
  assert.deepEqual(res.addedMarks, []);
  assert.deepEqual(Object.keys(marks), Object.keys(MARKS), 'aucune clé X…');
  assert.equal(courses.length, COURSES.length);
});

test('applyRegattaMarks : une bouée confirmée entre sous sa clé X…, avec l’auteur de la confirmation ; ignorée ou sans position : jamais', () => {
  const { marks, courses } = tables();
  const r = avecMarques({ X1: STATUS.CONFIRMEE, X2: STATUS.IGNOREE });
  r.marks[2] = { ...r.marks[2], status: STATUS.CONFIRMEE };              // confirmée mais sans position : ne peut pas servir
  const res = applyRegattaMarks(marks, courses, r);
  assert.deepEqual(res.addedMarks, ['X1']);
  assert.equal(marks.X1.name, 'Alpha');
  assert.deepEqual([marks.X1.lat, marks.X1.lon], [43.097417, 5.93415]);
  assert.match(marks.X1.src, /^IC SNM, confirmée par Thibaud le 19\/10$/);
  assert.equal(marks.X1.fromRegatta, 'rgA');
  assert.ok(!('X2' in marks) && !('X3' in marks));
  assert.equal(Object.keys(MARKS).includes('X1'), false, 'le vrai MARKS est intact');
});

test('applyRegattaMarks : un parcours n’est proposé que lorsque toutes ses bouées sont confirmées', () => {
  const base = avecMarques({ X1: STATUS.CONFIRMEE });
  const cours = coursesFromReview([{ name: 'Parcours A', sequence: [{ mark: 'Alpha', side: 'b' }, { mark: 'Bravo', side: 'b' }] }], base.marks, { by: 'Teiva', at: T0 });
  let r = { ...base, courses: cours };
  const t1 = tables();
  assert.deepEqual(applyRegattaMarks(t1.marks, t1.courses, r).addedCourses, [], 'X2 pas confirmée : pas de parcours');
  assert.deepEqual(waitingFor(r, r.courses[0]), ['X2']);
  r = confirmMark(r, 'X2', { by: 'Romain', at: T0 + 1000 });
  const t2 = tables();
  const res = applyRegattaMarks(t2.marks, t2.courses, r);
  assert.deepEqual(res.addedCourses, [101]);
  const c = t2.courses.find((x) => x.id === 101);
  assert.equal(c.title, 'Parcours A (IC)');
  assert.equal(c.custom, true);
  assert.deepEqual(c.seq.G, [['X1', 'b'], ['X2', 'b']]);
  assert.deepEqual(c.seq.P, c.seq.G);
  assert.match(c.text, /Alpha bâbord, Bravo bâbord/);
  assert.deepEqual(waitingFor(r, r.courses[0]), []);
  // un parcours incomplet n’est jamais injecté, même avec toutes les bouées confirmées
  const t3 = tables();
  const incomplet = { ...r, courses: [{ ...r.courses[0], incomplete: true }] };
  assert.deepEqual(applyRegattaMarks(t3.marks, t3.courses, incomplet).addedCourses, []);
});

test('applyRegattaMarks : le parcours injecté a la forme des parcours du cahier (lue par buildLegs, l’onglet Parcours et le débrief)', () => {
  const r = { ...avecMarques({ X1: STATUS.CONFIRMEE, X2: STATUS.CONFIRMEE }) };
  r.courses = coursesFromReview([{ name: 'Parcours A', sequence: [{ mark: 'Alpha', side: 'b' }, { mark: 'Bravo', side: 't' }] }], r.marks);
  const { marks, courses } = tables();
  applyRegattaMarks(marks, courses, r);
  const c = courses.find((x) => x.id === 101), ref = COURSES[2];
  assert.ok(c);
  assert.deepEqual(Object.keys(c.seq).sort(), Object.keys(ref.seq).sort());
  for (const cls of ['G', 'P']) for (const [m, side] of c.seq[cls]) {
    assert.ok(Object.hasOwn(marks, m), `la bouée ${m} du parcours est dans la table des marques`);
    assert.ok(side === 'b' || side === 't' || side === null);
  }
  assert.equal(typeof c.title, 'string'); assert.equal(typeof c.text, 'string');
  assert.equal(c.laps, undefined); assert.equal(c.built, undefined);
  assert.equal(courses.filter((x) => x.id === 101).length, 1);
  for (const k of ['name', 'lat', 'lon', 'kind', 'color', 'note', 'src']) assert.ok(k in marks.X1, `bouée injectée : ${k}`);
});

test('applyRegattaMarks : changer de régate retire les entrées de la précédente ; l’identifiant du parcours disparu est rendu', () => {
  const { marks, courses } = tables();
  const a = avecMarques({ X1: STATUS.CONFIRMEE, X2: STATUS.CONFIRMEE });
  a.courses = coursesFromReview([{ name: 'Parcours A', sequence: [{ mark: 'Alpha', side: 'b' }, { mark: 'Bravo', side: 'b' }] }], a.marks);
  const r1 = applyRegattaMarks(marks, courses, a);
  assert.deepEqual(r1.addedMarks, ['X1', 'X2']); assert.deepEqual(r1.addedCourses, [101]); assert.deepEqual(r1.gone, []);
  // même régate rejouée (après une confirmation) : tout est retiré puis remis à l’identique, rien n’a « disparu »
  const r2 = applyRegattaMarks(marks, courses, a);
  assert.deepEqual(r2.removedCourses, [101]); assert.deepEqual(r2.addedCourses, [101]); assert.deepEqual(r2.gone, []);
  // autre régate (même identifiant de parcours 101, mais d’une autre régate) : le parcours choisi doit être ramené
  const b = reg({ id: 'rgB', marks: [], courses: [] });
  const r3 = applyRegattaMarks(marks, courses, b);
  assert.deepEqual(r3.gone, [101]);
  assert.deepEqual(Object.keys(marks), Object.keys(MARKS));
  assert.equal(JSON.stringify(courses), COURSES_AVANT, 'tables revenues exactement à l’état du cahier CVAT');
  const c = reg({ id: 'rgC', marks: a.marks.map((m) => ({ ...m, status: STATUS.CONFIRMEE })), courses: a.courses });
  const r4 = applyRegattaMarks(marks, courses, a);
  const r5 = applyRegattaMarks(marks, courses, c);
  assert.deepEqual(r5.gone, [101], 'même numéro mais autre régate : considéré comme disparu');
  assert.ok(r4.addedCourses.includes(101));
  applyRegattaMarks(marks, courses, null);
  assert.equal(JSON.stringify(courses), COURSES_AVANT);
});

test('applyRegattaMarks : une bouée ignorée après coup retire la bouée et le parcours qui en dépend', () => {
  const { marks, courses } = tables();
  let a = avecMarques({ X1: STATUS.CONFIRMEE, X2: STATUS.CONFIRMEE });
  a.courses = coursesFromReview([{ name: 'Parcours A', sequence: [{ mark: 'Alpha', side: 'b' }, { mark: 'Bravo', side: 'b' }] }], a.marks);
  applyRegattaMarks(marks, courses, a);
  assert.ok(marks.X2 && courses.some((c) => c.id === 101));
  a = ignoreMark(a, 'X2', { by: 'Romain', at: T0 + 5 });
  const res = applyRegattaMarks(marks, courses, a);
  assert.ok(!('X2' in marks)); assert.ok(!courses.some((c) => c.id === 101));
  assert.deepEqual(res.gone, [101]);
  assert.ok('X1' in marks);
});

test('confirmMark : geste, auteur et instant gardés ; sans position ou déjà ignorée : sans effet ; l’original n’est pas modifié', () => {
  const r = avecMarques();
  const c = confirmMark(r, 'X1', { by: 'Thibaud', at: T0 + 1 });
  assert.notEqual(c, r);
  assert.equal(c.marks[0].status, STATUS.CONFIRMEE);
  assert.deepEqual(c.marks[0].confirmed, { by: 'Thibaud', at: T0 + 1 });
  assert.equal(r.marks[0].status, STATUS.A_CONFIRMER, 'l’original reste à confirmer');
  assert.equal(confirmMark(r, 'X3', { by: 'Thibaud' }), r, 'position à saisir : ne se confirme pas');
  assert.equal(confirmMark(r, 'X9', {}), r);
  assert.equal(confirmMark(ignoreMark(r, 'X1'), 'X1', {}).marks[0].status, STATUS.IGNOREE);
});

test('moveMark : même saisie que « Recaler », bornée à la rade ; plus de 2 Nq demande confirmation ; la bouée reste à confirmer', () => {
  const r = confirmMark(avecMarques(), 'X1', { by: 'Thibaud', at: T0 });
  assert.match(moveMark(r, 'X1', '48°51.400N 002°21.100E').error, /hors de la rade/i);
  assert.match(moveMark(r, 'X1', '43°05.845N').error, /Deux coordonnées/);
  const loin = moveMark(r, 'X1', '43°02.000N 006°05.000E');
  assert.equal(loin.ok, false); assert.ok(loin.ask && loin.ask.d > 3704, 'déplacement de plus de 2 Nq signalé');
  const ok = moveMark(r, 'X1', '43°02.000N 006°05.000E', { confirmFar: true, by: 'Romain', at: T0 + 9 });
  assert.equal(ok.ok, true);
  const m = ok.regatta.marks[0];
  assert.deepEqual([m.lat, m.lon], [43.033333, 6.083333]);
  assert.equal(m.status, STATUS.A_CONFIRMER, 'une position changée n’est plus confirmée');
  assert.equal(m.confirmed, undefined);
  assert.deepEqual(m.moved.from, { lat: 43.097417, lon: 5.93415 });
  const proche = moveMark(r, 'X1', '43°05.900N 005°56.100E');
  assert.equal(proche.ok, true, 'petit déplacement : sans confirmation');
  const saisie = moveMark(r, 'X3', '43,0910 ; 5,9500');
  assert.equal(saisie.ok, true, 'une position à saisir se saisit, sans distance de référence');
  assert.deepEqual([saisie.regatta.marks[2].lat, saisie.regatta.marks[2].lon], [43.091, 5.95]);
  assert.equal(moveMark(ignoreMark(r, 'X1'), 'X1', '43,09 ; 5,95').ok, false);
});

test('pendingMarks : copies { name, lat, lon, doubt: true } des seules bouées à confirmer qui ont une position', () => {
  const r = avecMarques({ X2: STATUS.CONFIRMEE });
  const p = pendingMarks(r);
  assert.deepEqual(Object.keys(p), ['X1']);
  assert.equal(p.X1.doubt, true); assert.equal(p.X1.name, 'Alpha');
  assert.deepEqual([p.X1.lat, p.X1.lon], [43.097417, 5.93415]);
  assert.deepEqual(pendingMarks(null), {});
  p.X1.lat = 0;
  assert.equal(r.marks[0].lat, 43.097417, 'copie : la régate n’est pas touchée');
});

test('normName et fmtPos', () => {
  assert.equal(normName('  Bouée  « Alpha » '), 'alpha');
  assert.equal(normName('La marque Éole'), 'eole');
  assert.equal(fmtPos(43.097417, 5.93415), '43°05.845N 005°56.049E');
});

test('garde statique : parmi les fichiers de js/, seul js/app.js (hors js/regmarks.js) appelle applyRegattaMarks(', () => {
  const appelants = readdirSync(ROOT + 'js').filter((f) => f.endsWith('.js') && f !== 'regmarks.js')
    .filter((f) => /applyRegattaMarks\(/.test(readFileSync(ROOT + 'js/' + f, 'utf8')));
  assert.deepEqual(appelants, ['app.js']);
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /applyRegattaMarks\(MARKS, COURSES/);
  assert.match(app, /pendingMarks\(/);
  assert.doesNotMatch(readFileSync(ROOT + 'js/regmarks.js', 'utf8'), /saveOverride|localStorage|document\./, 'module pur, jamais de recalage CVAT');
});

test('garde statique : « Recaler » réservé aux clés numériques ; les bouées de régate ne passent jamais par saveOverride', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /\/\^\\d\+\$\/\.test\(k\)/, 'marksRow teste la clé numérique');
  assert.doesNotMatch(app, /saveOverride\([^)]*X\d/);
});

test('les bouées à confirmer apparaissent sur la carte en « X1 ? » même hors parcours', () => {
  const scene = readFileSync(ROOT + 'js/scene3d.js', 'utf8');
  assert.match(scene, /String\(id\) \+ \(m\.doubt \? ' \?' : ''\)/);
});

// ───────────────────────── de la lecture IA à la fiche (relecture → régate)
import { parseHTML } from 'linkedom';
import { reviewFromApi, setKeepMark, setKeepCourse, courseReady, applyReview, reviewHTML, checksFor } from '../js/icread.js';

const vide = () => ({ value: null, excerpt: null });
const reponseIA = () => ({
  event: { value: 'Coupe SNM', excerpt: 'Coupe SNM' }, club: vide(), dateStart: { value: '2026-10-18', excerpt: 'dimanche 18 octobre 2026' }, dateEnd: vide(), firstWarning: vide(), lastFinish: vide(), vhf: vide(), committee: vide(), zone: vide(),
  races: [], specialRules: [],
  marks: [
    { name: 'Alpha', position: '43°05,845\' N – 005°56,049\' E', excerpt: 'Alpha : 43°05,845\' N – 005°56,049\' E', verified: true },
    { name: 'Bravo', position: '43.0905 N 5.9587 E', excerpt: 'Bravo : 43.0905 N 5.9587 E', verified: true },
    { name: 'Charlie', position: 'au large de la Pointe Rouge', excerpt: 'Charlie : au large de la Pointe Rouge', verified: true },
    { name: 'Delta <img src=x onerror=alert(1)>', position: '43.09 N 5.95 E', excerpt: null, verified: false },
  ],
  courses: [
    { name: 'Parcours A', excerpt: 'Parcours A : départ, Alpha bâbord, Bravo bâbord, arrivée', verified: true, sequence: [{ mark: 'Départ', side: null }, { mark: 'Alpha', side: 'b' }, { mark: 'Bravo', side: 'b' }, { mark: 'Arrivée', side: null }] },
    { name: 'Parcours C', excerpt: 'Parcours C : Alpha, Charlie', verified: true, sequence: [{ mark: 'Alpha', side: 'b' }, { mark: 'Charlie', side: 'b' }] },
    { name: 'Parcours D', excerpt: null, verified: false, sequence: [{ mark: 'Alpha', side: 'b' }] },
  ],
});
const regate = () => ({ id: 'rgA', name: 'Régate A', club: 'SNM', dateStart: '2026-10-18', dateEnd: '', races: [], marks: [], courses: [], ic: null });

test('reviewFromApi : positions converties par la page, cochées seulement si vérifiées et lisibles ; un parcours seulement si toutes ses bouées le sont', () => {
  const rv = reviewFromApi(reponseIA(), { source: 'ic.pdf', text: 'x' });
  assert.deepEqual(rv.marks.map((m) => [m.name.slice(0, 7), m.lat, m.lon, m.keep]), [['Alpha', 43.097417, 5.93415, true], ['Bravo', 43.0905, 5.9587, true], ['Charlie', null, null, false], ['Delta <', 43.09, 5.95, false]]);
  assert.deepEqual(rv.courses.map((c) => c.keep), [true, false, false], 'C attend Charlie (position illisible, non cochée) ; D non vérifié');
  assert.equal(courseReady(rv, rv.courses[0]), true); assert.equal(courseReady(rv, rv.courses[1]), false);
});

test('setKeepMark / setKeepCourse : décocher une bouée décoche ses parcours ; un parcours ne se coche pas sans toutes ses bouées ; non vérifié : jamais', () => {
  let rv = reviewFromApi(reponseIA(), { text: 'x' });
  rv = setKeepMark(rv, 1, false);
  assert.equal(rv.courses[0].keep, false, 'sans Bravo, le parcours A est décoché');
  assert.equal(setKeepCourse(rv, 0, true).courses[0].keep, false, 'et ne peut pas être recoché');
  rv = setKeepMark(rv, 1, true);
  assert.equal(setKeepCourse(rv, 0, true).courses[0].keep, true);
  assert.equal(setKeepMark(rv, 3, true).marks[3].keep, false, 'bouée sans extrait vérifié : ne se coche pas');
  rv = setKeepMark(rv, 2, true);                                   // position illisible mais vérifiée : retenable, « position à saisir »
  assert.equal(setKeepCourse(rv, 1, true).courses[1].keep, true);
});

test('applyReview : bouées cochées rangées « à confirmer » (auteur, instant, extrait), parcours cochés rangés ; rien d’injecté', () => {
  const rv = setKeepMark(reviewFromApi(reponseIA(), { source: 'ic.pdf', text: 'x' }), 2, true);
  const base = regate(), at = Date.parse('2026-10-19T09:00:00Z');
  const r = applyReview(base, setKeepCourse(rv, 1, true), { by: 'Teiva', at });
  assert.deepEqual(base.marks, [], 'la régate d’origine n’est pas modifiée');
  assert.deepEqual(r.marks.map((m) => [m.id, m.name, m.status, m.lat]), [['X1', 'Alpha', 'a_confirmer', 43.097417], ['X2', 'Bravo', 'a_confirmer', 43.0905], ['X3', 'Charlie', 'a_confirmer', null]]);
  assert.equal(r.marks[0].by, 'Teiva'); assert.equal(r.marks[0].at, at); assert.match(r.marks[0].excerpt, /^Alpha :/); assert.equal(r.marks[0].src, 'IC SNM');
  assert.deepEqual(r.courses.map((c) => [c.id, c.name, c.incomplete, c.seq.map((l) => l.mark).join('')]), [[101, 'Parcours A', false, 'X1X2'], [102, 'Parcours C', false, 'X1X3']]);
  const t = tables();
  assert.deepEqual(applyRegattaMarks(t.marks, t.courses, r).addedMarks, [], 'rien n’est injecté avant confirmation');
});

test('applyReview : une seconde validation n’ajoute pas deux fois la même bouée ; sans bouée cochée, marks et courses restent intacts', () => {
  const rv = reviewFromApi(reponseIA(), { text: 'x' });
  const r1 = applyReview(regate(), rv, { by: 'A', at: T0 });
  const r2 = applyReview(r1, rv, { by: 'B', at: T0 + 1 });
  assert.equal(r2.marks.length, 2); assert.equal(r2.courses.length, 1);
  const aucune = applyReview(regate(), { ...rv, marks: rv.marks.map((m) => ({ ...m, keep: false })) }, { by: 'A', at: T0 });
  assert.deepEqual([aucune.marks, aucune.courses], [[], []]);
});

test('reviewHTML : bouées et parcours lus avec conversion, puce, extrait ; tout échappé ; position illisible = « position à saisir »', () => {
  const rv = setKeepMark(reviewFromApi(reponseIA(), { source: '<i>x</i>.pdf', text: 'x' }), 2, true);
  const { document } = parseHTML(`<div>${reviewHTML(rv, checksFor(rv), { isLand: () => false })}</div>`);
  const marks = [...document.querySelectorAll('.icmarks .icmark')];
  assert.equal(marks.length, 4);
  assert.match(marks[0].textContent, /Alpha · 43°05\.845N 005°56\.049E/);
  assert.match(marks[0].querySelector('.chip').className, /good/);
  assert.match(marks[2].textContent, /Charlie · position à saisir/);
  assert.match(marks[2].textContent, /illisible/);
  assert.equal(marks[3].querySelector('input').hasAttribute('disabled'), true);
  assert.equal(document.querySelectorAll('img, script').length, 0, 'aucune balise venue du modèle');
  const cours = [...document.querySelectorAll('.iccourses .iccourse')];
  assert.equal(cours.length, 3);
  assert.match(cours[0].textContent, /Alpha bâbord → Bravo bâbord/);
  const sur = parseHTML(`<div>${reviewHTML(rv, checksFor(rv), { isLand: () => true })}</div>`).document;
  assert.match(sur.querySelector('.icmarks .icmark .chip').className, /mid/, 'sur terre : puce orange');
});

import { sheetHTML, marksSectionHTML } from '../js/regview.js';
test('fiche : « X1 Alpha ? » à confirmer avec ses gestes, « en attente de » pour le parcours, tout échappé, rien pour une régate sans bouée', () => {
  assert.equal(marksSectionHTML(regate()), '');
  const rv = setKeepMark(reviewFromApi(reponseIA(), { text: 'x' }), 2, true);
  let r = applyReview(regate(), setKeepCourse(rv, 1, true), { by: 'Teiva', at: T0 });
  r = { ...r, marks: r.marks.map((m) => (m.id === 'X1' ? { ...m, name: 'Alpha<img src=x onerror=alert(1)>' } : m)) };
  r = confirmMark(r, 'X1', { by: 'Thibaud', at: T0 });
  let doc = parseHTML(`<div>${sheetHTML(r, { now: T0 })}</div>`).document;
  assert.equal(doc.querySelectorAll('img').length, 0, 'nom de bouée échappé');
  const x2 = doc.querySelector('[data-mk-row=X2]');
  assert.match(x2.querySelector('.rgdn').textContent, /^X2 Bravo \?$/);
  assert.match(x2.textContent, /à confirmer/);
  for (const a of ['data-mk-voir', 'data-mk-ok', 'data-mk-fix', 'data-mk-ign']) assert.ok(x2.querySelector(`[${a}="X2"]`), a);
  const x3 = doc.querySelector('[data-mk-row=X3]');
  assert.match(x3.textContent, /position à saisir/);
  assert.equal(x3.querySelector('[data-mk-ok]'), null, 'pas de confirmation sans position');
  assert.equal(x3.querySelector('[data-mk-voir]'), null);
  const x1 = doc.querySelector('[data-mk-row=X1]');
  assert.match(x1.textContent, /confirmée/i); assert.equal(x1.querySelector('[data-mk-ok]'), null);
  assert.match(doc.querySelector('[data-co-row="101"]').textContent, /en attente de : X2 Bravo/);
  r = confirmMark(r, 'X2', { by: 'Romain', at: T0 });
  doc = parseHTML(`<div>${sheetHTML(r, { now: T0 })}</div>`).document;
  assert.match(doc.querySelector('[data-co-row="101"]').textContent, /proposé dans l’onglet Parcours/);
  assert.match(doc.querySelector('[data-co-row="102"]').textContent, /en attente de : X3 Charlie/);
  doc = parseHTML(`<div>${sheetHTML(r, { now: T0, markFix: { id: 'X2', txt: '43,09', err: 'Position hors de la rade', ask: null } })}</div>`).document;
  assert.ok(doc.querySelector('#mkxTxt')); assert.match(doc.querySelector('#mkxErr').textContent, /hors de la rade/);
});
