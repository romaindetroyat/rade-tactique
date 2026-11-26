// compat-v43 : bouées et parcours saisis dans l’app (éditeur de l’espace Tofinou, 08-11, D-17) face à un téléphone resté en v43, et vues de
// Naos identiques à la v43. Hors `npm test`, comme tools/compat-v42.mjs : il importe le code de la v43 extrait par `git archive` de 5e9b8a5.
//   W=$(mktemp -d) && git archive -o "$W/v43.tar" 5e9b8a5 js package.json && tar -xf "$W/v43.tar" -C "$W" && node tools/compat-v43.mjs "$W"
// Contrôles (une ligne « OK … » chacun) :
//   (a) mergeDoc de la v43 = mergeDoc de la v44 dans les deux ordres, sur des documents qui portent des bouées et des parcours saisis
//       (régate de Toulon sans `venue`, régate de Bormes), modifications concurrentes comprises
//   (b) stampState de la v43 sur ces régates ne marque que ce qui a changé (comme la v44)
//   (c) applyRegattaMarks de la v43 sur une régate de Toulon à parcours saisi : sans exception, parcours injecté d’un tour, bouées et côtés justes
//   (d) sheetHTML de la v43 sur ces régates : sans exception, noms hostiles échappés
//   (e) vues de Naos : sheetHTML, marksSectionHTML et reviewHTML de la v44 appelées SANS option d’éditeur ni libellés = sorties de la v43
// Codes de sortie : 0 = tout OK, 1 = un contrôle échoue, 2 = racine v43 illisible (ou racine qui connaît déjà l’éditeur : ce n’est pas la v43).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

process.env.TZ = 'Europe/Paris';
const racine = process.argv[2];
if (!racine || !existsSync(resolve(racine, 'js/archmerge.js')) || !existsSync(resolve(racine, 'package.json'))) {
  console.error('usage : node tools/compat-v43.mjs <racine v43> (extraction git archive de 5e9b8a5 : js/ et package.json)');
  process.exit(2);
}
const MODS = ['archmerge.js', 'regmarks.js', 'regview.js', 'icread.js', 'courses.js'];
const charge = (url) => Promise.all(MODS.map((f) => import(url(f))));
let V43, V44, edit;
try {
  if (existsSync(resolve(racine, 'js/regedit.js'))) {
    const e = await import(pathToFileURL(resolve(racine, 'js/regedit.js')).href);
    if ('HAND' in e) throw new Error('la racine donnée connaît déjà l’éditeur de parcours (HAND) : ce n’est pas la v43');
  }
  const [arch, marks, view, ic, tables] = await charge((f) => pathToFileURL(resolve(racine, 'js', f)).href);
  V43 = { nom: 'v43', arch, marks, view, ic, tables };
  const [arch2, marks2, view2, ic2, tables2] = await charge((f) => new URL(`../js/${f}`, import.meta.url).href);
  V44 = { nom: 'v44', arch: arch2, marks: marks2, view: view2, ic: ic2, tables: tables2 };
  edit = await import(new URL('../js/regedit.js', import.meta.url).href);
  if (typeof V43.arch.mergeDoc !== 'function' || typeof V43.marks.applyRegattaMarks !== 'function' || typeof V43.view.sheetHTML !== 'function') throw new Error('modules v43 inattendus');
  if (V43.arch.HEAD.includes('jours')) throw new Error('la racine donnée connaît déjà `jours` (08-08) : ce n’est pas la v43');
} catch (e) {
  console.error(`Racine v43 illisible : ${e.message}`);
  process.exit(2);
}

const ok = [], echecs = [];
async function controle(nom, fn) {
  try { const detail = await fn(); ok.push(nom); console.log(`OK ${nom}${detail ? ` : ${detail}` : ''}`); } catch (e) { echecs.push(nom); console.log(`ÉCHEC : ${nom} — ${e.message}`); }
}
const exige = (cond, msg) => { if (!cond) throw new Error(msg); };
const ecart = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return `caractère ${i} : ${JSON.stringify(a.slice(Math.max(0, i - 50), i + 50))} / ${JSON.stringify(b.slice(Math.max(0, i - 50), i + 50))}`; };
const memes = (a, b, quoi) => exige(a === b, `${quoi} : sorties différentes (${ecart(a, b)})`);

// ───────────────────────── régates d’essai (espace Naos du processus : plan d’eau Toulon par défaut ; Bormes écrite à la forme de js/regedit.js)

const T0 = Date.parse('2026-12-06T09:00:00Z');
const HOSTILE = '<img src=x onerror=alert(1)>';
const tire = (k) => () => k;
const confirme = (r, by = 'Frédéric') => r.marks.reduce((x, m) => V44.marks.confirmMark(x, m.id, { by, at: T0 + 500 }), r);
// Toulon (sans `venue`, comme une régate de Naos) : bouées saisies par js/regedit.js, puis confirmées, et un parcours saisi à porte et à deux tours
function regToulon() {
  let r = { id: 'rg-toulon', name: 'Entraînement en rade', club: 'Club', dateStart: '2026-12-06', dateEnd: '', races: [], marks: [], courses: [], at: T0, by: 'Romain' };
  const pos = [['Alpha', '43°05.845N 005°56.049E'], ['Bravo', '43°05.430N 005°57.522E'], ['Charlie', '43°05.460N 005°57.000E'], [HOSTILE, '43°06.000N 005°58.000E']];
  pos.forEach(([name, txt], i) => {
    const res = edit.addHandMark(r, { name, txt, origine: i % 2 ? 'carte' : 'saisie' }, { by: 'Romain', at: T0, rnd: tire((i + 1) / 9000) });
    if (!res.ok) throw new Error(`bouée de Toulon ${name} : ${res.error}`);
    r = res.regatta;
  });
  r = confirme(r, 'Romain');
  const [a, b, c, d] = r.marks.map((m) => m.id);
  const s = edit.saveCourseDraft(r, { id: null, name: 'Parcours <b>saisi</b>', steps: [{ kind: 'mark', mark: a, side: 't' }, { kind: 'gate', mark: b, gate: c }], finish: { kind: 'comite', mark: d }, laps: 2, lapLine: false }, { by: 'Romain', at: T0 + 600, rnd: tire(0.25) });
  if (!s.ok) throw new Error(`parcours de Toulon : ${JSON.stringify(s.errors)}`);
  return s.regatta;
}
// Bormes : la forme écrite par js/regedit.js (bouées saisies X1xxx, parcours 1000–9999), sans passer par les bornes de saisie
const boueeBormes = (id, name, lat, lon, status, origine = 'saisie') => ({ id, name, text: `${lat} ${lon}`, lat, lon, excerpt: '', status, src: origine === 'carte' ? 'touchée sur la carte' : 'position saisie', origine, by: 'Frédéric', at: T0, ...(status === 'confirmee' ? { confirmed: { by: 'Frédéric', at: T0 + 500 } } : {}) });
function regBormes() {
  const marks = [boueeBormes('X1201', 'Alpha', 43.12, 6.4, 'confirmee'), boueeBormes('X3402', 'Bravo', 43.11, 6.39, 'confirmee', 'carte'), boueeBormes('X5603', 'Charlie', 43.11, 6.395, 'confirmee'), boueeBormes('X7804', HOSTILE, 43.13, 6.395, 'a_confirmer', 'carte')];
  const r = { id: 'rg-bormes', name: 'Entraînement du club', club: 'Club', venue: 'bormes', vu: T0, dateStart: '2026-12-06', dateEnd: '', races: [], marks, courses: [], at: T0, by: 'Frédéric' };
  const s = edit.saveCourseDraft(r, { id: null, name: 'Parcours d’entraînement', steps: [{ kind: 'mark', mark: 'X1201', side: 'b' }, { kind: 'gate', mark: 'X3402', gate: 'X5603' }], finish: { kind: 'ligne', mark: '' }, laps: 3, lapLine: true }, { by: 'Frédéric', at: T0 + 600, rnd: tire(0.75) });
  if (!s.ok) throw new Error(`parcours de Bormes : ${JSON.stringify(s.errors)}`);
  return s.regatta;
}
const etat = (list) => ({ list, tomb: {}, current: null });
const docDe = (st) => ({ v: 1, regattas: Object.fromEntries(st.list.map((r) => [r.id, V44.arch.toShared(r)])), tomb: {}, marks: {} });

// Deux téléphones partis du même état, hors réseau : A ajoute une bouée et modifie le parcours, B en ajoute une autre, modifie aussi le parcours
// (plus tard) et supprime un parcours ; chacun a marqué ses modifications avec la v44
// un second parcours saisi, que B supprime
const avecSecond = (r) => edit.saveCourseDraft(r, { id: null, name: 'À supprimer', steps: [{ kind: 'mark', mark: r.marks.find((m) => m.status === 'confirmee').id, side: 'b' }], finish: { kind: 'ligne', mark: '' }, laps: 1, lapLine: true }, { by: 'Romain', at: T0 + 700, rnd: tire(0.9) }).regatta;
function monde() {
  const base = V44.arch.stampState(etat([]), etat([avecSecond(regToulon()), avecSecond(regBormes())]), { now: T0 + 1000, by: 'Romain' }).st;
  const modifie = (st, by, now, fn) => V44.arch.stampState(st, etat(st.list.map((r) => fn(structuredClone(r)) || r)), { now, by }).st;
  const A = modifie(base, 'Frédéric', T0 + 5000, (r) => {
    let x = edit.addHandMark(r, { name: `Écho ${r.id}`, txt: r.venue ? '43°07.000N 006°23.000E' : '43°05.100N 005°57.100E' }, { by: 'Frédéric', at: T0 + 4000, rnd: tire(0.4) });
    x = x.ok ? x.regatta : { ...r, marks: [...r.marks, boueeBormes('X4600', `Écho ${r.id}`, 43.117, 6.383, 'a_confirmer')] };
    const c = x.courses[0];
    return edit.saveCourseDraft(x, { ...edit.courseDraft(x, c.id), laps: 4 }, { by: 'Frédéric', at: T0 + 4000 }).regatta;
  });
  const B = modifie(base, 'Thibaud', T0 + 9000, (r) => {
    let x = { ...r, marks: [...r.marks, boueeBormes('X8800', `Fox ${r.id}`, r.venue ? 43.118 : 43.09, r.venue ? 6.39 : 5.95, 'a_confirmer')] };
    const c = x.courses[0];
    x = edit.saveCourseDraft(x, { ...edit.courseDraft(x, c.id), steps: edit.courseDraft(x, c.id).steps.map((s) => (s.kind === 'mark' ? { ...s, side: s.side === 'b' ? 't' : 'b' } : s)) }, { by: 'Thibaud', at: T0 + 8000 }).regatta;
    return edit.removeCourse(x, x.courses.find((k) => k.name === 'À supprimer').id);
  });
  return { base, A, B };
}

// ───────────────────────── (a) fusion
await controle('(a) mergeDoc v43 = mergeDoc v44 dans les deux ordres (bouées et parcours saisis, Toulon et Bormes, modifications concurrentes)', () => {
  const { base, A, B } = monde();
  const docs = [docDe(base), docDe(A), docDe(B)];
  let n = 0;
  for (const x of docs) for (const y of docs) {
    const v43 = V43.arch.canon(V43.arch.mergeDoc(x, y)), v44 = V44.arch.canon(V44.arch.mergeDoc(x, y));
    memes(v43, v44, `fusion ${n}`); n++;
  }
  const ab = V44.arch.mergeDoc(docDe(A), docDe(B)), ba = V43.arch.mergeDoc(docDe(B), docDe(A));
  memes(V44.arch.canon(ab), V43.arch.canon(ba), 'v44(A, B) / v43(B, A)');
  for (const id of ['rg-toulon', 'rg-bormes']) {
    const r = ab.regattas[id];
    exige(r.marks.some((m) => m.name === `Écho ${id}`) && r.marks.some((m) => m.name === `Fox ${id}`), `${id} : les deux bouées ajoutées hors réseau sont gardées`);
    exige(r.courses.length === 1, `${id} : parcours supprimé par B absent (pierre tombale), le parcours modifié présent`);
    const c = r.courses[0];
    exige(c.edited?.by === 'Thibaud' && (c.laps ?? 1) !== 4, `${id} : la modification la plus récente (B) gagne`);
    exige(r.hist.some((h) => h.kind === 'course' && h.id === String(c.id) && h.v?.laps === 4), `${id} : la version de A est dans l’historique`);
  }
  return `${n + 1} fusions comparées, égales octet pour octet`;
});

// ───────────────────────── (b) marquage
await controle('(b) stampState v43 = stampState v44, ne marque que ce qui a changé', () => {
  const { base } = monde();
  const next = etat(base.list.map((r) => (r.id === 'rg-bormes' ? { ...r, courses: r.courses.map((c) => ({ ...c, name: 'Renommé' })) } : r)));
  const a = V43.arch.stampState(base, next, { now: T0 + 99000, by: 'Thibaud' }), b = V44.arch.stampState(base, next, { now: T0 + 99000, by: 'Thibaud' });
  memes(V43.arch.canon(a), V44.arch.canon(b), 'marquage');
  exige(a.changed.join() === 'rg-bormes', `régates marquées : ${a.changed.join()}`);
  const r = a.st.list.find((x) => x.id === 'rg-bormes'), r0 = base.list.find((x) => x.id === 'rg-bormes');
  exige(r.courses[0].u === T0 + 99000, 'le parcours modifié est daté de maintenant');
  exige(r.marks.every((m, i) => m.u === r0.marks[i].u), 'les bouées gardent leur date');
  exige(r.u === r0.u, 'la fiche garde sa date');
  const t = a.st.list.find((x) => x.id === 'rg-toulon');
  exige(t === base.list.find((x) => x.id === 'rg-toulon'), 'régate de Toulon inchangée : même objet');
  return 'un seul parcours marqué';
});

// ───────────────────────── (c) injection par la v43
await controle('(c) applyRegattaMarks v43 sur une régate de Toulon à parcours saisi : sans exception, un tour, bouées et côtés justes', () => {
  const r = regToulon(), c = r.courses[0];
  const marks = structuredClone(V43.tables.MARKS), courses = structuredClone(V43.tables.COURSES);
  const res = V43.marks.applyRegattaMarks(marks, courses, r);
  exige(res.addedMarks.length === 4 && res.addedMarks.every((k) => marks[k]?.lat === r.marks.find((m) => m.id === k).lat), `bouées injectées : ${res.addedMarks.join()}`);
  exige(res.addedCourses.length === 1 && res.addedCourses[0] === c.id, `parcours injecté : ${res.addedCourses.join()}`);
  const inj = courses.find((x) => x.id === c.id);
  const [a, b, cc, d] = r.marks.map((m) => m.id);
  exige(JSON.stringify(inj.seq.G) === JSON.stringify([[a, 't'], [b, null, cc]]), `suite : ${JSON.stringify(inj.seq.G)}`);
  exige(inj.finish?.kind === 'comite' && inj.finish.mark === d, 'arrivée entre le Comité et la bouée');
  exige(!inj.laps && inj.fixedLaps == null, 'la v43 le voit d’un tour (dégradé, jamais faux)');
  exige(/\(IC\)$/.test(inj.title), `titre de la v43 : ${inj.title}`);
  // v44 : le même parcours, ses deux tours sans repasser la ligne
  const m4 = structuredClone(V44.tables.MARKS), c4 = structuredClone(V44.tables.COURSES);
  V44.marks.applyRegattaMarks(m4, c4, r);
  const i4 = c4.find((x) => x.id === c.id);
  exige(i4.laps === true && i4.fixedLaps === 2 && i4.lapLine === false && /\(saisi\)$/.test(i4.title), 'v44 : deux tours imposés');
  return `${inj.title} · ${JSON.stringify(inj.seq.G)}`;
});

// ───────────────────────── (d) fiche de la v43
const vue = (html) => { const { document } = parseHTML(`<div id="racine">${html}</div>`); return { document, balises: document.querySelectorAll('#racine img, #racine script, #racine iframe').length }; };
await controle('(d) sheetHTML v43 sur les régates à bouées et parcours saisis : sans exception, noms hostiles échappés', () => {
  const { A, B } = monde();
  const doc = V44.arch.mergeDoc(docDe(A), docDe(B));
  let n = 0;
  for (const r of [regToulon(), regBormes(), ...Object.values(doc.regattas)]) {
    const html = V43.view.sheetHTML(V43.arch.fromShared(r), { now: T0, courses: [{ id: 3, title: 'Parcours 3' }] });
    const { document, balises } = vue(html);
    exige(balises === 0, `${r.id} : balise injectée`);
    exige(document.querySelector('#rgSheet'), `${r.id} : fiche absente`);
    if (r.marks.some((m) => /</.test(m.name))) exige(/&lt;img src=x onerror=alert\(1\)&gt;/.test(html), `${r.id} : nom hostile non échappé`);
    else exige(r.marks.some((m) => /img src=x/.test(m.name)), `${r.id} : nom nettoyé par js/regedit.js (sans chevrons)`);
    n++;
  }
  return `${n} fiches`;
});

// ───────────────────────── (e) vues de Naos
const bouee = (id, name, lat, lon, status, over = {}) => ({ id, name, text: lat == null ? 'au large' : `${lat} N ; ${lon} E`, lat, lon, excerpt: `${name} : ${lat} N ; ${lon} E`, status, src: 'IC SNM', by: 'Teiva', at: T0, ...over });
function matrice() {
  const marks = [
    bouee('X1', 'Alpha', 43.0905, 5.9587, 'a_confirmer'),
    bouee('X2', 'Bravo', 43.0835, 5.97, 'confirmee', { confirmed: { by: 'Thibaud', at: T0 + 60e3 } }),
    bouee('X3', 'Charlie', 43.095, 5.98, 'ignoree', { ignored: { by: 'Romain', at: T0 + 120e3 } }),
    bouee('X4', 'Delta', null, null, 'a_confirmer'),
    bouee('X5', 'F', 43.09, 5.975, 'confirmee', { confirmed: { by: 'Thibaud', at: T0 }, moved: { by: 'Thibaud', at: T0, from: { lat: 43.08, lon: 5.97 } } }),
    bouee('X6', HOSTILE, 43.088, 5.96, 'a_confirmer'),
  ];
  const courses = [
    { id: 101, name: 'Parcours A', seq: [{ mark: 'X1', side: 'b' }, { mark: 'X2', side: 't' }], excerpt: 'Parcours A : Alpha bâbord, Bravo tribord', incomplete: false, missing: [], by: 'Teiva', at: T0 },
    { id: 102, name: 'Parcours B', seq: [{ mark: 'X2', side: 'b' }, { mark: 'X5', side: null, gate: 'X2' }], finish: { kind: 'comite', mark: 'X5', excerpt: 'arrivée' }, excerpt: 'Parcours B', incomplete: false, missing: [], by: 'Teiva', at: T0 },
    { id: 103, name: 'Parcours C', seq: [{ mark: 'X2', side: null }], finish: { kind: 'pres', mark: 'X5', excerpt: 'près de F' }, excerpt: 'Parcours C', incomplete: false, missing: [], by: 'Teiva', at: T0 },
    { id: 104, name: 'Parcours D', seq: [], excerpt: 'Parcours D', incomplete: true, missing: ['Zoulou'], by: 'Teiva', at: T0 },
  ];
  const base = { id: 'rg-snm', name: 'Coupe SNM', club: 'SNM', dateStart: '2026-10-18', dateEnd: '2026-10-19', season: 2026, races: [{ n: 1, id: 'm1', date: '2026-10-18', time: '10:55', courseId: 101, cls: 'G', laps: 2, note: '', by: 'Teiva', at: T0 }], at: T0, by: 'Teiva', ic: { read: 'ia', source: 'ic.pdf', fields: {}, validated: { by: 'Teiva', at: T0 } } };
  return [
    { ...base, marks: [], courses: [] },
    { ...base, marks, courses: [] },
    { ...base, marks, courses },
    { ...base, marks: marks.map((m) => ({ ...m, status: 'confirmee' })), courses, sel: 1 },
    { ...base, id: 'rg-semee', ic: { read: 'semee', source: 'IC 2026', fields: {} }, marks: [], courses: [] },
    { ...base, id: 'rg-brest', venue: 'brest', marks: marks.slice(0, 2), courses: courses.slice(0, 1) },
  ];
}
await controle('(e) vues de Naos : sheetHTML, marksSectionHTML et reviewHTML de la v44 sans option = sorties de la v43', () => {
  let n = 0;
  const C = [{ id: 3, title: 'Parcours 3' }, { id: 101, title: 'Parcours A (IC)' }];
  const fixes = [null, { id: 'X1', txt: '43,09', err: 'Deux coordonnées attendues', ask: null }, { id: 'X5', txt: '43°05.000N 005°58.000E', err: '', ask: { d: 4000, txt: 'x' } }];
  for (const r of matrice()) {
    for (const markFix of fixes) {
      for (const raceDraft of [null, { date: '2026-10-18', time: '11:00', courseId: '3', cls: 'P', laps: '3', note: 'n' }, { edit: 1, id: 'm1', date: '2026-10-18', time: '10:55', courseId: '101', cls: 'G', laps: '2', note: '' }]) {
        const o = { now: T0 + 3600e3, courses: C, choices: C, raceDraft, raceErrors: raceDraft ? { time: 'Heure ?' } : {}, markFix, nmOf: (d) => `${(d / 1852).toFixed(1)} Nq`, local: new Set(), daysLocal: new Set(), me: 'Teiva', tipHtml: '<i>i</i>' };
        memes(V44.view.sheetHTML(r, o), V43.view.sheetHTML(r, o), `fiche ${r.id}`); n++;
      }
      memes(V44.view.marksSectionHTML(r, { markFix }), V43.view.marksSectionHTML(r, { markFix }), `bouées ${r.id}`); n++;
    }
  }
  // relecture des IC (lecture par motifs, par l’IA, saisie, semée), avec et sans offre de l’IA
  const vide = () => ({ value: null, excerpt: null });
  const reponse = { event: { value: 'Coupe SNM', excerpt: 'Coupe SNM 2026' }, club: vide(), dateStart: { value: '2026-10-18', excerpt: 'dimanche 18 octobre 2026' }, dateEnd: vide(), firstWarning: { value: null, excerpt: null, flag: 'extrait introuvable dans le texte' }, lastFinish: vide(), vhf: { value: '72', excerpt: 'VHF 72' }, committee: vide(), zone: vide(),
    races: [{ date: '2026-10-18', warning: '10:55', label: 'Manche 1', excerpt: 'Manche 1 10h55', verified: true }, { date: '2026-10-19', warning: null, label: '', excerpt: null, verified: false }],
    marks: [{ name: 'Alpha', position: '43°05,845 N 005°56,049 E', excerpt: 'Alpha 43°05,845', verified: true }, { name: HOSTILE, position: 'au large', excerpt: null, verified: false }],
    courses: [{ name: 'Parcours A', sequence: [{ mark: 'Alpha', side: 'b', gate: null }], excerpt: 'Parcours A : Alpha', verified: true, finish: { kind: 'comite', mark: 'Alpha', excerpt: 'arrivée Alpha', verified: true } }],
    specialRules: [{ value: 'Gilet', excerpt: 'Gilet obligatoire', verified: true }, { value: 'Invention', excerpt: null, verified: false }], truncated: true };
  const rvs = [
    V44.ic.reviewFromParse({ event: 'Coupe', date: '2026-10-18', firstWarning: '10:55', vhf: 72, keyRules: ['Règle'], ex: { event: 'Coupe 2026' } }, { source: 'ic.pdf', text: 'texte' }),
    V44.ic.reviewFromApi(reponse, { source: 'ic.pdf', text: 'texte' }),
    { ...V44.ic.reviewFromParse({}, { source: '' }), read: 'saisie' },
    { ...V44.ic.reviewFromParse({}, { source: 'IC 2026' }), read: 'semee' },
  ];
  for (const rv of rvs) {
    for (const opts of [{}, { ia: { show: true, enabled: false, msg: 'hors réseau' } }, { ia: { show: true, enabled: true, msg: '' }, isLand: () => false }]) {
      const checks = V44.ic.checksFor(rv, { now: T0 });
      memes(V44.ic.reviewHTML(rv, checks, opts), V43.ic.reviewHTML(rv, checks, opts), `relecture ${rv.read}`); n++;
    }
  }
  return `${n} vues comparées, identiques octet pour octet`;
});

console.log(`Bilan : ${ok.length}/${ok.length + echecs.length} contrôle(s) OK`);
process.exit(echecs.length ? 1 : 0);
