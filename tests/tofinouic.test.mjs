// IC de l’équipage Tofinou à Bormes (08-11, D-16) : PDF d’essai fabriqué (jamais un document réel) lu par le vrai pdf.js, relecture d’une
// réponse de l’IA bornée à la rade de Bormes – Le Lavandou, bouées rangées « à confirmer », parcours lu injecté une fois ses bouées
// confirmées, libellés de l’espace Tofinou sans texte de Naos ; sans libellés, ceux de la v43. Ce fichier tourne dans son propre processus :
// le plan d’eau de Bormes y est posé une fois (setVenue), comme dans tests/bormes.test.mjs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { pdfMinimal, IC_ESSAI } from './helpers/pdfmini.mjs';
import { setVenue, MARKS, COURSES, LINE_PRESETS } from '../js/lieu.js';
import { VENUES } from '../js/venues.js';
import { parseLatLon } from '../js/marks.js';
import { Terrain, toXY } from '../js/geo.js';
import { ESPACES, setEspace } from '../js/espaces.js';

// espace Tofinou et plan d’eau de Bormes, comme l’app à l’adresse de Tofinou (venueOf lit les plans d’eau de l’espace courant)
setEspace('tofinou');
setVenue('bormes');

const { reviewFromApi, reviewFromParse, applyReview, reviewHTML } = await import('../js/icread.js');
const { confirmMark, moveMark, waitingFor, applyRegattaMarks, STATUS } = await import('../js/regmarks.js');
const { sheetHTML } = await import('../js/regview.js');
const { buildLegs } = await import('../js/tactics.js');
const { parseIC } = await import('../js/events.js');

const T0 = Date.parse('2026-12-06T09:00:00Z');
const BORMES = VENUES.bormes;
const TEXTE = IC_ESSAI.join('\n');
const sansBlancs = (s) => String(s).replace(/\s+/g, '');
const ligne = (re) => { const l = IC_ESSAI.find((x) => re.test(x)); assert.ok(l, `ligne d’essai introuvable : ${re}`); return l; };
const pos = (nom) => ligne(new RegExp(`^Bouée ${nom} :`)).replace(/^Bouée \w+ : /, '');

// Réponse simulée de /api/ic, déjà vérifiée (extraits copiés du texte d’essai) : quatre bouées de Bormes, Echo à Toulon, le parcours d’essai
const vide = () => ({ value: null, excerpt: null });
const reponse = () => ({
  event: { value: 'Régate d’essai du Lavandou', excerpt: 'Régate d’essai du Lavandou' }, club: vide(),
  dateStart: { value: '2026-12-06', excerpt: 'dimanche 6 décembre 2026' }, dateEnd: vide(),
  firstWarning: { value: '11:00', excerpt: ligne(/premier signal/) }, lastFinish: vide(), vhf: { value: 72, excerpt: ligne(/^Canal VHF/) },
  committee: vide(), zone: vide(), races: [], specialRules: [],
  marks: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((n) => ({ name: n, position: pos(n), excerpt: ligne(new RegExp(`^Bouée ${n} :`)), verified: true })),
  courses: [{
    name: 'Parcours d’essai', excerpt: ligne(/^Parcours d’essai/), verified: true,
    sequence: [{ mark: 'Départ', side: null }, { mark: 'Alpha', side: 'b' }, { mark: 'Bravo', side: null, gate: 'Charlie' }, { mark: 'Arrivée', side: null }],
    finish: { kind: 'comite', mark: 'Delta', excerpt: ligne(/^La ligne d’arrivée/), verified: true },
  }],
});
const regate = () => ({ id: 'rg-essai', name: 'Régate d’essai du Lavandou', club: 'Club d’essai', venue: 'bormes', dateStart: '2026-12-06', dateEnd: '', races: [], marks: [], courses: [], ic: null });

let pdfText;
before(async () => {
  await import(new URL('../vendor/pdf.worker.min.js', import.meta.url));
  await import(new URL('../vendor/pdf.min.js', import.meta.url));
  globalThis.window = { pdfjsLib: globalThis.pdfjsLib };
  ({ pdfText } = await import('../js/events.js'));
});

test('(a) PDF d’essai : pdfMinimal rend un PDF que le vrai pdf.js lit, texte identique aux lignes (sans les blancs)', async () => {
  const octets = pdfMinimal(IC_ESSAI);
  assert.equal(new TextDecoder('latin1').decode(octets.slice(0, 8)), '%PDF-1.4');
  const lu = await pdfText(new Blob([octets]));
  assert.equal(sansBlancs(lu), sansBlancs(TEXTE));
  // échappements et pages : parenthèses, barre oblique inverse, plus de 45 lignes sur deux pages
  const lignes = ['a (b) \\ c', ...Array.from({ length: 50 }, (_, i) => `ligne ${i + 1} — « ’ » ° é è à ç ô œ –`)];
  assert.equal(sansBlancs(await pdfText(new Blob([pdfMinimal(lignes)]))), sansBlancs(lignes.join('\n')));
  assert.throws(() => pdfMinimal(['vent ≈ 12 nd']), /caractère absent du codage WinAnsi : « ≈ »/);
  // la lecture par motifs (hors réseau) reconnaît l’épreuve et ne la prend pas pour des IC du CVAT
  const p = parseIC(lu, 'ic-essai.pdf');
  assert.equal(p.date, '2026-12-06');
  assert.equal(p.vhf, 72);
});

test('(b) reviewFromApi dans une régate de Bormes : bouées de Bormes lues et cochées, bouée de Toulon « position à saisir » non cochée ; messages de Bormes', () => {
  const rv = reviewFromApi(reponse(), { source: 'ic-essai.pdf', text: TEXTE, regatta: regate() });
  const par = Object.fromEntries(rv.marks.map((m) => [m.name, m]));
  assert.deepEqual([par.Alpha.lat, par.Alpha.lon, par.Delta.lat, par.Delta.lon], [43.12, 6.4, 43.13, 6.395]);
  for (const n of ['Alpha', 'Bravo', 'Charlie', 'Delta']) assert.equal(par[n].keep, true, `${n} cochée`);
  assert.deepEqual([par.Echo.lat, par.Echo.lon, par.Echo.keep], [null, null, false], 'Echo (rade de Toulon) : position à saisir, non cochée');
  assert.equal(rv.courses[0].keep, true, 'parcours coché : toutes ses bouées sont retenues');
  const html = reviewHTML(rv, {}, {});
  const doc = parseHTML(`<div>${html}</div>`).document;
  const echo = [...doc.querySelectorAll('.icmark')].find((el) => /Echo/.test(el.textContent));
  assert.match(echo.textContent, /Echo · position à saisir/);
  // bornes de saisie de Bormes : position de Toulon refusée avec le nom de la rade de Bormes ; exemple pris à Bormes (La Fourmigue)
  assert.equal(BORMES.inputBounds.nom, 'la rade de Bormes – Le Lavandou');
  const toulon = parseLatLon('43°05.845N 005°56.049E', BORMES.inputBounds);
  assert.match(toulon.error, /hors de la rade de Bormes – Le Lavandou/);
  assert.doesNotMatch(toulon.error, /Toulon/);
  const deux = parseLatLon('à côté de la bouée', BORMES.inputBounds);
  assert.match(deux.error, /^Deux coordonnées attendues, par exemple 43°06\.362N 006°24\.252E$/, 'exemple de La Fourmigue');
  assert.equal(BORMES.exemple, '43°06.362N 006°24.252E');
  const f = parseLatLon(BORMES.exemple, BORMES.inputBounds), fou = MARKS.FOU;
  assert.ok(Math.abs(f.lat - fou.lat) < 1e-5 && Math.abs(f.lon - fou.lon) < 1e-5, 'l’exemple est la position de La Fourmigue');
});

test('(c) applyReview range les bouées « à confirmer » (bornes de Bormes) ; le parcours attend ses bouées puis s’injecte ; porte et arrivée « Comité » routées', () => {
  const rv = reviewFromApi(reponse(), { source: 'ic-essai.pdf', text: TEXTE, regatta: regate() });
  rv.marks = rv.marks.map((m) => (m.name === 'Echo' ? { ...m, keep: true } : m));        // Echo retenue malgré tout : elle reste « position à saisir »
  let r = applyReview(regate(), rv, { by: 'Frédéric', at: T0 });
  assert.deepEqual(r.marks.map((m) => [m.id, m.name, m.status]), [['X1', 'Alpha', 'a_confirmer'], ['X2', 'Bravo', 'a_confirmer'], ['X3', 'Charlie', 'a_confirmer'], ['X4', 'Delta', 'a_confirmer'], ['X5', 'Echo', 'a_confirmer']]);
  assert.deepEqual([r.marks[4].lat, r.marks[4].lon], [null, null], 'bornes de Bormes : la position de Toulon n’est jamais convertie');
  assert.equal(r.marks[0].src, 'IC Club d’essai');
  assert.equal(r.courses.length, 1);
  const c = r.courses[0];
  assert.deepEqual(c.seq, [{ mark: 'X1', side: 'b' }, { mark: 'X2', side: null, gate: 'X3' }]);
  assert.deepEqual(c.finish, { kind: 'comite', mark: 'X4', excerpt: ligne(/^La ligne d’arrivée/) });
  assert.deepEqual(waitingFor(r, c), ['X1', 'X2', 'X3', 'X4']);
  // « Corriger la position » d’une bouée de cette régate : une position de Toulon est refusée avec le message de Bormes
  const mv = moveMark(r, 'X5', '43°05.845N 005°56.049E', { by: 'Frédéric', at: T0 });
  assert.equal(mv.ok, false); assert.match(mv.error, /hors de la rade de Bormes – Le Lavandou/);
  // copies des tables : rien d’injecté tant qu’une bouée attend
  let t = { marks: structuredClone(MARKS), courses: structuredClone(COURSES) };
  assert.deepEqual(applyRegattaMarks(t.marks, t.courses, r).addedCourses, []);
  for (const id of ['X1', 'X2', 'X3', 'X4']) r = confirmMark(r, id, { by: 'Frédéric', at: T0 + 60e3 });
  assert.equal(confirmMark(r, 'X5', { by: 'Frédéric', at: T0 }), r, '« position à saisir » ne se confirme pas');
  assert.deepEqual(waitingFor(r, c), []);
  t = { marks: structuredClone(MARKS), courses: structuredClone(COURSES) };
  const res = applyRegattaMarks(t.marks, t.courses, r);
  assert.deepEqual(res.addedMarks, ['X1', 'X2', 'X3', 'X4']);
  assert.deepEqual(res.addedCourses, [101]);
  const inj = t.courses.find((x) => x.id === 101);
  assert.equal(inj.title, 'Parcours d’essai (IC)');
  assert.deepEqual(inj.seq.G, [['X1', 'b'], ['X2', null, 'X3']]);
  assert.match(inj.text, /^Ligne de départ, Alpha bâbord, porte Bravo \/ Charlie, arrivée entre le Comité et Delta\./);
  // buildLegs lit la table vivante du plan d’eau : bouées de la régate posées puis retirées (applyRegattaMarks(…, null)), comme tests/helpers/legs.mjs
  const avant = JSON.stringify({ m: Object.keys(MARKS), c: COURSES.map((x) => x.id) });
  try {
    applyRegattaMarks(MARKS, COURSES, r);
    const course = COURSES.find((x) => x.id === 101);
    const B = buildLegs(course, 'G', { laps: 2, windDir: 280, line: { center: LINE_PRESETS.lavandou, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null } });
    assert.deepEqual(B.legs.map((l) => l.mark), ['X1', 'PORTE', 'FINISH']);
    assert.ok(B.legs[1].gate, 'la porte Bravo / Charlie est un bord à deux bouées');
    assert.match(B.legs[2].to.name, /^Arrivée \(Comité – X4 Delta\)$/);
  } finally {
    applyRegattaMarks(MARKS, COURSES, null);
  }
  assert.equal(JSON.stringify({ m: Object.keys(MARKS), c: COURSES.map((x) => x.id) }), avant, 'tables du plan d’eau rendues intactes');
});

test('(c) les bouées d’essai sont en mer sur le pack de Bormes', { skip: existsSync(join(ROOT, 'data/bormes.meta.json')) ? false : 'pack de Bormes absent' }, async () => {
  const T = await new Terrain().load('data/bormes.');
  for (const n of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
    const p = parseLatLon(pos(n), BORMES.inputBounds), q = toXY(p.lat, p.lon);
    assert.equal(T.isLand(q.x, q.y), false, `${n} en mer`);
  }
});

test('(d) libellés de l’espace Tofinou : lecture par motifs et fiche semée sans le sigle du club de Toulon ; sans libellés, ceux de la v43', () => {
  const L = ESPACES.tofinou.textesIC;
  assert.equal(ESPACES.naos.textesIC, null, 'aucun texte pour Naos');
  const rv = reviewFromParse(parseIC(TEXTE, 'ic-essai.pdf'), { source: 'ic-essai.pdf', text: TEXTE });
  const avec = parseHTML(`<div>${reviewHTML(rv, {}, { libelles: L })}</div>`).document.querySelector('#icReview').textContent;
  assert.match(avec, /lecture par motifs \(hors réseau\)/);
  assert.doesNotMatch(avec, /CVAT|J80|Toulon|GPEN|Brest/);
  const sans = reviewHTML(rv, {}, {});
  assert.match(sans, /lecture par motifs \(CVAT, hors réseau\)/, 'Naos : libellé de la v43');
  assert.equal(reviewHTML(rv, {}, {}), reviewHTML(rv, {}), 'sans option, sortie inchangée');
  const semee = { ...rv, read: 'semee', source: 'documents du club' };
  assert.match(reviewHTML(semee, {}, { libelles: L }), /lecture semée par l’app d’après les documents du club : à vérifier avec ceux en vigueur/);
  assert.match(reviewHTML(semee, {}, {}), /lecture semée par l’app d’après les IC 2026 : à vérifier avec les IC 2027/);
  // notice de la fiche semée
  const fiche = { ...regate(), ic: { read: 'semee', source: 'documents du club', fields: {} } };
  const noticeDe = (html) => parseHTML(`<div>${html}</div>`).document.querySelector('#rgSemee')?.textContent;
  assert.equal(noticeDe(sheetHTML(fiche, { now: T0, semee: L.notice })), 'Fiche semée par l’app d’après les documents du club — à vérifier avec ceux en vigueur.');
  assert.equal(noticeDe(sheetHTML(fiche, { now: T0 })), 'Fiche semée par l’app (IC 2026) — à vérifier avec les IC 2027.', 'sans option : notice de la v43');
  assert.equal(noticeDe(sheetHTML({ ...fiche, ic: { ...fiche.ic, source: 'piège <img src=x onerror=alert(1)>' } }, { now: T0, semee: '<b>notice</b>' })), '<b>notice</b>', 'notice échappée');
});

test('(d) formulaire et lignes de manche à Bormes sans classes du CVAT (WINDOWS n° 15) ; valeur `cls` gardée ; sans option, vue de la v43', () => {
  const r = { ...regate(), races: [{ n: 1, id: 'm1', date: '2026-12-06', time: '11:00', courseId: 4, cls: 'G', laps: 2, note: '', by: 'Frédéric', at: T0 }], sel: null };
  const draft = { date: '2026-12-06', time: '11:00', courseId: '4', cls: 'G', laps: '2', note: '' };
  const sans = sheetHTML(r, { now: T0, raceDraft: draft, sansClasses: true });
  const doc = parseHTML(`<div>${sans}</div>`).document;
  assert.equal(doc.querySelector('#rcCls'), null, 'pas de choix de classe à Bormes');
  assert.doesNotMatch(doc.querySelector('.rgrace').textContent, /classe/);
  assert.ok(doc.querySelector('#rcLaps'), 'les tours restent proposés');
  const v43 = sheetHTML(r, { now: T0, raceDraft: draft });
  assert.match(v43, /<select id="rcCls">/); assert.match(v43, /classe G/);
});
