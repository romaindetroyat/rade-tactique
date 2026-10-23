// compat-v37 : contrôle des deux sens de la synchronisation entre un téléphone resté en v37 et un téléphone en v38 (phase 6, D-09).
// Hors `npm test`, comme tools/regate-e2e.mjs : il importe le code de la v37 extrait par `git archive` de 6e7af98 (js/ et package.json).
//   W=$(mktemp -d) && git archive -o "$W/v37.tar" 6e7af98 js package.json && tar -xf "$W/v37.tar" -C "$W" && node tools/compat-v37.mjs "$W"
// Il fabrique avec les modules COURANTS une régate v38 (bouées X1-X4 confirmées, parcours 101 avec la porte X2/X3 et l’arrivée X4, manche banane
// avec ses réglages `ban`), puis vérifie : la v37 la lit (injection, bords, réglages de manche, fiche) ; une fusion faite par la v37 garde la porte,
// l’arrivée et `ban`, que la v38 réinjecte ; la v38 lit une régate archivée v37 avec les mêmes bords que la v37. Une ligne « OK … » par contrôle.
// Codes de sortie : 0 = tout OK, 1 = un contrôle échoue, 2 = racine v37 illisible.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

const racine = process.argv[2];
if (!racine || !existsSync(resolve(racine, 'js/regmarks.js')) || !existsSync(resolve(racine, 'package.json'))) {
  console.error('usage : node tools/compat-v37.mjs <racine v37> (extraction git archive de 6e7af98 : js/ et package.json)');
  process.exit(2);
}
const v37 = async (f) => import(pathToFileURL(resolve(racine, 'js', f)).href);
const cur = async (f) => import(new URL(`../js/${f}`, import.meta.url).href);

let A, B;
try {
  const [r37, t37, c37, g37, v37v, a37] = await Promise.all(['regmarks.js', 'tactics.js', 'courses.js', 'regates.js', 'regview.js', 'archmerge.js'].map(v37));
  const [r38, t38, c38, g38, v38v, a38] = await Promise.all(['regmarks.js', 'tactics.js', 'courses.js', 'regates.js', 'regview.js', 'archmerge.js'].map(cur));
  const legs = await import(new URL('../tests/helpers/legs.mjs', import.meta.url).href);
  A = { reg: r37, tac: t37, crs: c37, rg: g37, view: v37v, arch: a37 };
  B = { reg: r38, tac: t38, crs: c38, rg: g38, view: v38v, arch: a38, legs };
  if (typeof A.reg.applyRegattaMarks !== 'function' || typeof A.arch.mergeRegatta !== 'function') throw new Error('modules v37 inattendus');
} catch (e) {
  console.error(`Racine v37 illisible : ${e.message}`);
  process.exit(2);
}

const ok = [];
const echecs = [];
function controle(nom, fn) {
  try { const detail = fn(); ok.push(nom); console.log(`OK ${nom}${detail ? ` : ${detail}` : ''}`); } catch (e) { echecs.push(nom); console.log(`ÉCHEC : ${nom} — ${e.message}`); }
}
const exige = (cond, msg) => { if (!cond) throw new Error(msg); };
const fini = (n) => typeof n === 'number' && Number.isFinite(n);

// ───────────────────────── régate écrite en v38 (modules courants)

const T0 = Date.parse('2026-11-07T07:00:00Z');
const lues = [
  { name: 'Alpha', position: '43.0950 N ; 5.9600 E', excerpt: 'Bouée Alpha : 43.0950 N ; 5.9600 E' },
  { name: '4s', position: '43.0850 N ; 5.9700 E', excerpt: 'Bouée 4s : 43.0850 N ; 5.9700 E' },
  { name: '4p', position: '43.0850 N ; 5.9711 E', excerpt: 'Bouée 4p : 43.0850 N ; 5.9711 E' },
  { name: 'F', position: '43.0900 N ; 5.9750 E', excerpt: 'Bouée F : 43.0900 N ; 5.9750 E' },
];
const PARCOURS_B = {
  name: 'Parcours B', excerpt: 'Parcours B : départ, Alpha bâbord, porte 4s/4p, Alpha bâbord, arrivée entre le bateau comité et la bouée F',
  sequence: [{ mark: 'Départ', side: null }, { mark: 'Alpha', side: 'b' }, { mark: '4s', side: null, gate: '4p' }, { mark: 'Alpha', side: 'b' }, { mark: 'Arrivée', side: null }],
  finish: { kind: 'comite', mark: 'F', excerpt: 'arrivée entre le bateau comité et la bouée F' },
};
const BAN = { nm: 1.2, off: true, side: 'b', gate: true, fin: 'sousvent' };

function regateV38() {
  let r = B.rg.createRegatta({ name: 'Régate porte v38', dateStart: '2026-11-07', club: 'SNM' }, { now: T0, by: 'Teiva' }).regatta;
  const marks = B.reg.marksFromReview(lues, { by: 'Teiva', at: T0, club: 'SNM' });
  r = { ...r, marks };
  for (const m of marks) r = B.reg.confirmMark(r, m.id, { by: 'Thibaud', at: T0 + 1000 });
  r = { ...r, courses: B.reg.coursesFromReview([PARCOURS_B], r.marks, { by: 'Teiva', at: T0 }) };
  const res = B.rg.addRace(r, { date: '2026-11-07', time: '10:55', courseId: 90, cls: 'G', laps: 2, ban: BAN }, { now: T0 + 2000, by: 'Teiva', courses: [{ id: 90 }, { id: 101 }] });
  exige(res.ok, `manche banane refusée : ${JSON.stringify(res.errors)}`);
  return B.arch.stamp(null, res.regatta, { now: T0 + 3000, by: 'Teiva' });
}
const R38 = regateV38();
exige(R38.courses[0].seq[1].gate === 'X3' && R38.courses[0].finish?.mark === 'X4' && R38.races[0].ban, 'régate v38 mal formée');

const LIGNE = (presets) => ({ center: presets.vignettes, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null });
const sansBalise = (html) => {
  const { document } = parseHTML(`<div id="racine">${html}</div>`);
  return document.querySelectorAll('#racine img, #racine script, #racine iframe, #racine svg').length === 0;
};

// ───────────────────────── v37 lit v38

controle('v37 lit v38 : applyRegattaMarks injecte le parcours 101 sans erreur, porte réduite à sa première bouée', () => {
  const { MARKS, COURSES } = A.crs;
  try {
    const res = A.reg.applyRegattaMarks(MARKS, COURSES, structuredClone(R38));
    exige(res.addedCourses.includes(101), `parcours 101 non injecté (${JSON.stringify(res.addedCourses)})`);
    const c = COURSES.find((x) => x.id === 101);
    exige(JSON.stringify(c.seq.G) === JSON.stringify([['X1', 'b'], ['X2', null], ['X1', 'b']]), `suite vue par la v37 : ${JSON.stringify(c.seq.G)}`);
    exige(!('finish' in c), 'la v37 n’a pas d’arrivée propre');
    return `suite ${JSON.stringify(c.seq.G)}`;
  } finally { A.reg.applyRegattaMarks(MARKS, COURSES, null); }
});

controle('v37 lit v38 : buildLegs du parcours 101, un bord par élément plus l’arrivée, aucun NaN, arrivée au centre de la ligne de départ', () => {
  const { MARKS, COURSES, LINE_PRESETS } = A.crs;
  try {
    A.reg.applyRegattaMarks(MARKS, COURSES, structuredClone(R38));
    const c = COURSES.find((x) => x.id === 101);
    const out = [];
    for (const cls of ['G', 'P']) for (const w of [315, 135]) {
      const b = A.tac.buildLegs(c, cls, { laps: 2, windDir: w, line: LIGNE(LINE_PRESETS), wlLengthNm: 0.8 });
      exige(b.legs.length === c.seq[cls].length + 1, `${b.legs.length} bords pour ${c.seq[cls].length} éléments`);
      for (const l of b.legs) exige([l.from.x, l.from.y, l.to.x, l.to.y, l.brg, l.dist].every(fini), `valeur non finie au bord ${l.i}`);
      const f = b.legs.at(-1);
      exige(f.mark === 'FINISH' && Math.abs(f.to.x - b.line.c.x) < 1e-9 && Math.abs(f.to.y - b.line.c.y) < 1e-9, 'arrivée hors du centre de la ligne');
      out.push(b.legs.map((l) => l.to.name.split(' ')[0]).join('→'));
    }
    return out[0];
  } finally { A.reg.applyRegattaMarks(MARKS, COURSES, null); }
});

controle('v37 lit v38 : raceSettings de la manche banane sans erreur (réglages ban ignorés, parcours 90 inconnu laissé à l’app)', () => {
  const s = A.rg.raceSettings(structuredClone(R38.races[0]));
  exige(s.courseId === 90 && s.cls === 'G' && s.laps === 2 && fini(s.startTime), JSON.stringify(s));
  exige(!('ban' in s), 'la v37 ne connaît pas ban');
  exige(!A.crs.COURSES.some((c) => c.id === 90), 'la v37 n’a pas la banane : chooseRace garde le parcours courant');
  return JSON.stringify(s);
});

controle('v37 lit v38 : sheetHTML et marksSectionHTML de la régate sans erreur ni balise non échappée', () => {
  const r = structuredClone(R38);
  r.marks = r.marks.map((m) => (m.id === 'X3' ? { ...m, name: '4p<img src=x onerror=alert(1)>' } : m));
  r.courses = r.courses.map((c) => ({ ...c, finish: { ...c.finish, excerpt: 'arrivée <script>window.__x=1</script> F' } }));
  const fiche = A.view.sheetHTML(r, { now: T0, courses: A.crs.COURSES.map((c) => ({ id: c.id, title: c.title })) });
  const bouees = A.view.marksSectionHTML(r);
  exige(typeof fiche === 'string' && fiche.includes('Parcours B (IC)'), 'fiche sans le parcours');
  exige(sansBalise(fiche) && sansBalise(bouees), 'balise non échappée');
  return `${fiche.length} caractères`;
});

// ───────────────────────── v37 écrit, v38 relit

let FUSION = null;
controle('v37 écrit : mergeRegatta v37 entre la régate v38 et une copie modifiée à la v37 garde seq[1].gate, finish et races[0].ban', () => {
  const recue = A.arch.fromShared(structuredClone(B.arch.toShared(R38)), null);                     // le téléphone v37 reçoit la fiche
  const res = A.rg.addRace({ ...recue, name: 'Régate porte (renommée en v37)' }, { date: '2026-11-07', time: '14:00', courseId: 3, cls: 'G', laps: 2 }, { now: T0 + 60000, by: 'Romain', courses: A.crs.COURSES });
  exige(res.ok, `addRace v37 : ${JSON.stringify(res.errors)}`);
  const modif = A.arch.toShared(A.arch.stamp(recue, res.regatta, { now: T0 + 60000, by: 'Romain' }));
  for (const [a, b] of [[B.arch.toShared(R38), modif], [modif, B.arch.toShared(R38)]]) {
    const m = A.arch.mergeRegatta(structuredClone(a), structuredClone(b));
    const c = m.courses.find((x) => x.id === 101), ban = m.races.find((x) => x.courseId === 90);
    exige(m.name === 'Régate porte (renommée en v37)', `nom : ${m.name}`);
    exige(m.races.length === 2, `${m.races.length} manche(s)`);
    exige(c?.seq?.[1]?.gate === 'X3', `porte perdue : ${JSON.stringify(c?.seq)}`);
    exige(c.finish?.kind === 'comite' && c.finish?.mark === 'X4', `arrivée perdue : ${JSON.stringify(c.finish)}`);
    exige(JSON.stringify(ban?.ban) === JSON.stringify(BAN), `ban perdu : ${JSON.stringify(ban)}`);
    FUSION = m;
  }
  return 'dans les deux ordres';
});

controle('v38 relit la fusion v37 : applyRegattaMarks réinjecte la porte (élément à trois valeurs) et l’arrivée ; bords avec porte et arrivée sur F', () => {
  exige(FUSION, 'pas de fusion');
  const marks = structuredClone(B.crs.MARKS), courses = structuredClone(B.crs.COURSES);
  const res = B.reg.applyRegattaMarks(marks, courses, A.arch.fromShared(FUSION, null));
  exige(res.addedCourses.includes(101), 'parcours non réinjecté');
  const c = courses.find((x) => x.id === 101);
  exige(JSON.stringify(c.seq.G) === JSON.stringify([['X1', 'b'], ['X2', null, 'X3'], ['X1', 'b']]), JSON.stringify(c.seq.G));
  exige(c.finish?.kind === 'comite' && c.finish?.mark === 'X4', JSON.stringify(c.finish));
  // buildLegs lit la vraie table MARKS : bouées injectées puis retirées
  try {
    B.reg.applyRegattaMarks(B.crs.MARKS, B.crs.COURSES, A.arch.fromShared(FUSION, null));
    const cc = B.crs.COURSES.find((x) => x.id === 101);
    const b = B.tac.buildLegs(cc, 'G', { laps: 2, windDir: 315, line: LIGNE(B.crs.LINE_PRESETS), wlLengthNm: 0.8 });
    exige(b.legs.length === 4 && b.legs[1].mark === 'PORTE' && b.legs.at(-1).to.name === 'Arrivée (Comité – X4 F)', b.legs.map((l) => l.to.name).join(' | '));
    return b.legs.map((l) => l.to.name).join(' → ');
  } finally { B.reg.applyRegattaMarks(B.crs.MARKS, B.crs.COURSES, null); }
});

// ───────────────────────── v38 lit v37

controle('v38 lit v37 : la régate archivée v37 donne en v38 les mêmes bords qu’en v37 (sameLegs)', () => {
  const { REGATE_V37, serialLegs, sameLegs } = B.legs;
  const bords = (M) => {
    const { MARKS, COURSES, LINE_PRESETS } = M.crs;
    try {
      M.reg.applyRegattaMarks(MARKS, COURSES, structuredClone(REGATE_V37));
      const c = COURSES.find((x) => x.id === 101);
      const out = [];
      for (const cls of ['G', 'P']) for (const w of [315, 135]) out.push({ key: `101|${cls}|${w}`, ...serialLegs(M.tac.buildLegs(c, cls, { laps: 2, windDir: w, line: LIGNE(LINE_PRESETS), wlLengthNm: 0.8 })) });
      return out;
    } finally { M.reg.applyRegattaMarks(MARKS, COURSES, null); }
  };
  const a = bords(A), b = bords(B);
  for (let i = 0; i < a.length; i++) { const d = sameLegs(b[i], a[i]); exige(!d, d); }
  const fiche = B.view.marksSectionHTML(structuredClone(REGATE_V37));
  exige(!/porte|Arrivée :/.test(fiche), 'fiche v38 d’une régate v37 : rien de nouveau');
  return `${a.length} cas identiques`;
});

// ───────────────────────── bilan

const total = ok.length + echecs.length;
if (echecs.length) {
  console.log(`ÉCHEC : ${echecs.length} contrôle(s) sur ${total} — ${echecs.join(' ; ')}`);
  process.exit(1);
}
console.log(`Compatibilité v37 : ${ok.length} contrôles OK`);
process.exit(0);
