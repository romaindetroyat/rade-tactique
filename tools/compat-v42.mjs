// compat-v42 : plan d’eau d’une régate (`venue`, v43, 07-05) face à un téléphone resté en v42, dans les deux sens. Hors `npm test`, comme
// tools/compat-v41.mjs : il importe le code de la v42 extrait par `git archive` de 56f6625 (js/ et package.json).
//   W=$(mktemp -d) && git archive -o "$W/v42.tar" 56f6625 js package.json && tar -xf "$W/v42.tar" -C "$W" && node tools/compat-v42.mjs "$W"
// Monde simulé : la fonction api/archive.js COURANTE (le serveur passe en v43 avec l’app) sur un faux Blob, un téléphone v43 (modules courants) et un
// téléphone v42 (modules extraits), partis tous deux de la Coupe SNPM semée. La v43 crée deux régates de Brest (avec et sans bouées confirmées) ;
// la v42 les lit, les affiche, les complète, en renomme une : le serveur et la v43 gardent le plan d’eau ; « toulon » écrit explicitement par la v43
// passe partout ; les deux versions de mergeDoc donnent le même résultat sur les régates de Toulon (sans plan d’eau). Une ligne « OK … » par contrôle.
// Codes de sortie : 0 = tout OK, 1 = un contrôle échoue, 2 = racine v42 illisible.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

const racine = process.argv[2];
if (!racine || !existsSync(resolve(racine, 'js/archmerge.js')) || !existsSync(resolve(racine, 'package.json'))) {
  console.error('usage : node tools/compat-v42.mjs <racine v42> (extraction git archive de 56f6625 : js/ et package.json)');
  process.exit(2);
}
const MODS = ['regates.js', 'regview.js', 'archmerge.js', 'archsync.js', 'regmarks.js'];
const charge = (url) => Promise.all(MODS.map((f) => import(url(f))));
let V42, V43, serveur, faux, lieux;
try {
  const [rg, view, arch, sync, marks] = await charge((f) => pathToFileURL(resolve(racine, 'js', f)).href);
  V42 = { nom: 'v42', rg, view, arch, sync, marks };
  const [rg2, view2, arch2, sync2, marks2] = await charge((f) => new URL(`../js/${f}`, import.meta.url).href);
  V43 = { nom: 'v43', rg: rg2, view: view2, arch: arch2, sync: sync2, marks: marks2 };
  serveur = await import(new URL('../api/archive.js', import.meta.url).href);
  faux = await import(new URL('../tests/helpers/fakeblob.mjs', import.meta.url).href);
  lieux = await import(new URL('../js/venues.js', import.meta.url).href);
  if (typeof V42.arch.mergeDoc !== 'function' || typeof V42.sync.runSync !== 'function' || typeof V42.rg.updateRace !== 'function') throw new Error('modules v42 inattendus');
  if (V42.arch.HEAD.includes('venue')) throw new Error('la racine donnée connaît déjà `venue` : ce n’est pas la v42');
  if (!V43.arch.HEAD.includes('venue')) throw new Error('le dépôt ne connaît pas `venue` : ce n’est pas la v43');
} catch (e) {
  console.error(`Racine v42 illisible : ${e.message}`);
  process.exit(2);
}

const ok = [], echecs = [];
async function controle(nom, fn) {
  try { const detail = await fn(); ok.push(nom); console.log(`OK ${nom}${detail ? ` : ${detail}` : ''}`); } catch (e) { echecs.push(nom); console.log(`ÉCHEC : ${nom} — ${e.message}`); }
}
const exige = (cond, msg) => { if (!cond) throw new Error(msg); };

// ───────────────────────── le monde : serveur courant, téléphones v42 et v43, Coupe SNPM semée

const T0 = Date.parse('2026-12-01T08:00:00Z'), PARCOURS = [{ id: 3 }, { id: 90 }];
const clock = { t: T0 }, handler = serveur.createHandler({ blob: faux.createFakeBlob(), now: () => clock.t });
const avance = (ms = 60e3) => { clock.t += ms; };
const memoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
function telephone(nom, M) {
  const p = {
    nom, M, meta: {}, online: true,
    save(next) { const r = M.arch.stampState(p.st, next, { now: clock.t, by: nom }); p.st = r.st; if (r.changed.length) M.arch.markDirty(p.meta, r.changed); },
    reg(id) { return p.st.list.find((r) => r.id === id); },
    sync() { if (!p.meta.first) p.st = M.arch.legacyStamp(p.st); return M.sync.runSync(p.deps, 'manuel'); },
  };
  p.st = M.rg.seedNorm(M.rg.migrate({ storage: memoire(), now: clock.t, by: nom }));        // premier lancement : la Coupe SNPM semée
  p.deps = {
    now: () => clock.t,
    async fetchJson(method, query, body) {
      const r = await faux.invoke(handler, { method, url: '/api/archive?' + new URLSearchParams(query), body, headers: { 'x-rt-membre': encodeURIComponent(nom) } });
      return { status: r.status, body: r.body };
    },
    getState: () => p.st, setState: (st) => { p.st = st; }, getMarks: () => ({}), setMarks() {},
    meta: p.meta, saveMeta() {}, backup() {}, isActive: () => false, isOnline: () => p.online, canApply: () => true,
  };
  return p;
}
const A = telephone('Teiva', V43), B = telephone('Thibaud', V42);
const tour = async (...ps) => { for (let i = 0; i < 2; i++) for (const p of ps) { avance(30e3); const r = await p.sync(); exige(!r?.error, `${p.nom} : ${JSON.stringify(r)}`); } };
const enLigne = async (id) => (await faux.invoke(handler, { method: 'GET', url: '/api/archive?k=light', headers: { 'x-rt-membre': 'Romain' } })).body.doc.regattas[id];
// ce que les deux versions connaissent d’une régate (sans le plan d’eau, que la v42 ignore) : doit être identique des deux côtés
const sansLieu = ({ venue, vu, ...r }) => r;
const partage = (p, id) => { const r = p.reg(id); return V43.arch.canon(sansLieu({ ...V43.arch.toShared(r), races: (r.races || []).map(({ n, ...m }) => m) })); };
// premier écart entre deux textes (pour le message d’échec)
const ecart = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return `caractère ${i} : ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 40))} / ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 40))}`; };
const memes = (id) => { const a = partage(A, id), b = partage(B, id); exige(a === b, `données différentes (${ecart(a, b)})`); };
const vue = (M, html) => { const { document } = parseHTML(`<div id="racine">${html}</div>`); return { document, balises: document.querySelectorAll('#racine img, #racine script, #racine iframe').length }; };
const bouee = (id, name, lat, lon) => ({ id, name, text: `${lat} ${lon}`, lat, lon, excerpt: '', status: 'confirmee', src: 'IC GPEN', by: 'Teiva', at: T0, confirmed: { by: 'Teiva', at: T0 } });

let AVEC, SANS;
await controle('(a) v43 crée deux régates de Brest (deux bouées confirmées / aucune) ; la v42 les reçoit, les liste et ouvre leur fiche sans exception', async () => {
  const mk = (name) => V43.rg.createRegatta({ name, dateStart: '2026-12-05', dateEnd: '2026-12-06', club: 'GPEN', venue: 'brest' }, { now: clock.t, by: 'Teiva', rnd: Math.random }).regatta;
  const avec = { ...mk('Entraînement Brest bouées'), marks: [bouee('X1', 'Bouée 1', 48.29817, -4.3605), bouee('X2', 'Bouée 2', 48.31, -4.37)] };
  const sans = mk('Entraînement Brest');
  exige(avec.venue === 'brest' && sans.venue === 'brest', 'createRegatta v43 sans plan d’eau');
  A.save(V43.rg.upsertRegatta(V43.rg.upsertRegatta(A.st, avec), sans)); AVEC = avec.id; SANS = sans.id;
  await tour(A, B);
  for (const id of [AVEC, SANS]) {
    exige(B.reg(id), `la v42 n’a pas reçu ${id}`);
    exige(!('venue' in B.reg(id)), 'la v42 ne garde pas le plan d’eau (attendu : elle ne le connaît pas)');
    exige((await enLigne(id)).venue === 'brest', 'le serveur a perdu le plan d’eau');
  }
  const liste = vue(V42, V42.view.listHTML(V42.rg.groupByStatus(B.st.list, clock.t), { now: clock.t }));
  exige(liste.balises === 0 && liste.document.querySelectorAll('.rg[data-rg-row]').length === 3, 'liste v42');
  let tailles = 0;
  for (const id of [AVEC, SANS]) {
    const f = vue(V42, V42.view.sheetHTML(B.reg(id), { now: clock.t, courses: PARCOURS.map((c) => ({ id: c.id, title: `Parcours ${c.id}` })) }));
    exige(f.balises === 0, 'fiche v42');
    tailles += f.document.querySelector('#rgSheet').textContent.length;
  }
  // la v42 qui ouvre la régate injecte ses bouées confirmées (copies, jamais les vraies tables) : aucune exception
  const marks = {}, courses = [];
  V42.marks.applyRegattaMarks(marks, courses, B.reg(AVEC));
  exige(Object.keys(marks).length === 2, 'bouées confirmées lues par la v42');
  return `3 régates listées, fiches v42 de ${tailles} caractères`;
});

await controle('(b) la v42 ajoute une manche à chacune et synchronise : le serveur et la v43 gardent « brest » aux deux', async () => {
  avance();
  for (const id of [AVEC, SANS]) {
    const x = V42.rg.addRace(B.reg(id), { date: '2026-12-05', time: '10:30', courseId: 90, cls: 'G', laps: 2 }, { now: clock.t, by: 'Thibaud', courses: PARCOURS });
    exige(x.ok, JSON.stringify(x.errors));
    B.save(V42.rg.upsertRegatta(B.st, x.regatta));
  }
  await tour(B, A);
  for (const id of [AVEC, SANS]) {
    exige((await enLigne(id)).venue === 'brest', `serveur : ${id}`);
    exige(A.reg(id).venue === 'brest' && lieux.venueOf(A.reg(id)) === 'brest', `v43 : ${id}`);
    exige(A.reg(id).races.length === 1 && B.reg(id).races.length === 1, 'une manche des deux côtés');
    memes(id);
  }
  return 'manche 10:30 chez les deux, plan d’eau gardé';
});

await controle('(c) la v42 renomme la régate sans bouée (tête de fiche) : le serveur et la v43 la gardent à Brest ; la copie de la v42 n’a pas de plan d’eau (limite consignée)', async () => {
  avance();
  B.save(V42.rg.upsertRegatta(B.st, { ...B.reg(SANS), name: 'Entraînement Brest (renommé en v42)' }));
  await tour(B, A);
  const s = await enLigne(SANS);
  exige(s.name === 'Entraînement Brest (renommé en v42)' && s.ub === 'Thibaud', `fiche : ${s.name} par ${s.ub}`);
  exige(s.venue === 'brest', 'le serveur a perdu le plan d’eau');
  exige(A.reg(SANS).name === s.name && A.reg(SANS).venue === 'brest', 'v43');
  exige(!('venue' in B.reg(SANS)), 'v42 : pas de champ');
  exige(lieux.venueOf(B.reg(SANS)) === 'toulon', 'vue par la règle de la v43, la copie v42 sans bouée serait à Toulon (c’est la limite)');
  memes(SANS);
  return 'serveur et v43 : brest ; v42 : champ ignoré';
});

await controle('(d) la v43 remet explicitement « toulon » : le serveur, la v43 et la v42 la voient à Toulon', async () => {
  avance();
  A.save(V43.rg.upsertRegatta(A.st, { ...A.reg(SANS), venue: 'toulon' }));
  await tour(A, B);
  exige((await enLigne(SANS)).venue === 'toulon', 'serveur');
  exige(A.reg(SANS).venue === 'toulon' && lieux.venueOf(A.reg(SANS)) === 'toulon', 'v43');
  exige(lieux.venueOf(B.reg(SANS)) === 'toulon', 'v42');
  exige((await enLigne(AVEC)).venue === 'brest', 'l’autre régate reste à Brest');
  // la v42 renomme encore : « toulon » reste (une copie qui ignore le champ ne l’efface pas, quelle que soit sa valeur)
  avance();
  B.save(V42.rg.upsertRegatta(B.st, { ...B.reg(SANS), name: 'Retour à Toulon' }));
  await tour(B, A);
  exige((await enLigne(SANS)).venue === 'toulon' && A.reg(SANS).name === 'Retour à Toulon', 'après la v42');
  return 'toulon partout';
});

await controle('(e) mergeDoc v42 et v43 : même résultat sur les régates de Toulon (sans plan d’eau) ; sur celles de Brest, mêmes données hors plan d’eau ; ni doublon ni résurrection', async () => {
  const d = (...rs) => ({ v: 1, regattas: Object.fromEntries(rs.map((r) => [r.id, V43.arch.toShared(r)])), tomb: {}, marks: {} });
  const base = V43.arch.stamp(null, V43.rg.addRace(V43.rg.createRegatta({ name: 'CVAT', dateStart: '2026-12-13', club: 'CVAT' }, { now: 1000, by: 'Teiva', rnd: () => 0.25 }).regatta,
    { date: '2026-12-13', time: '10:55', courseId: 3 }, { now: 1000, by: 'Teiva', courses: PARCOURS }).regatta, { now: 1000, by: 'Teiva' });
  exige(!('venue' in base) && !('vu' in base), 'une régate de Toulon créée en v43 n’a pas de plan d’eau (forme de la v42)');
  const renomme = V43.arch.stamp(base, { ...base, name: 'CVAT — Coupe de Noël' }, { now: 2000, by: 'Teiva' });
  const ajout42 = V42.arch.stamp(base, V42.rg.addRace(base, { date: '2026-12-13', time: '13:25', courseId: 3 }, { now: 3000, by: 'Thibaud', courses: PARCOURS }).regatta, { now: 3000, by: 'Thibaud' });
  const supp = V43.arch.stamp(base, V43.rg.removeRace(base, 1), { now: 4000, by: 'Romain' });
  const toulon = [[d(renomme), d(ajout42)], [d(supp), d(ajout42)], [d(base), d(supp)], [d(A.reg('snpm-2026')), d(B.reg('snpm-2026'))]];
  for (const [x, y] of toulon) {
    const r42 = V42.arch.canon(V42.arch.mergeDoc(structuredClone(x), structuredClone(y))), r43 = V43.arch.canon(V43.arch.mergeDoc(structuredClone(x), structuredClone(y)));
    exige(r42 === r43, 'mergeDoc v42 ≠ v43 sur une régate de Toulon');
    exige(r43 === V43.arch.canon(V43.arch.mergeDoc(structuredClone(y), structuredClone(x))), 'non commutatif');
  }
  const m = V43.arch.mergeDoc(d(supp), d(ajout42)).regattas[base.id];
  exige(m.races.map((x) => x.time).join(',') === '13:25', `manches : ${m.races.map((x) => x.time)}`);
  const brest = [[d(A.reg(AVEC)), d(B.reg(AVEC))], [d(A.reg(SANS)), d(B.reg(SANS))]];
  for (const [x, y] of brest) {
    const r42 = V42.arch.mergeDoc(structuredClone(x), structuredClone(y)), r43 = V43.arch.mergeDoc(structuredClone(x), structuredClone(y));
    const sans = (doc) => V43.arch.canon({ ...doc, regattas: Object.fromEntries(Object.entries(doc.regattas).map(([k, r]) => [k, sansLieu(r)])) });
    exige(sans(r42) === sans(r43), 'mergeDoc v42 ≠ v43 hors plan d’eau');
    for (const r of Object.values(r43.regattas)) exige(r.venue, 'la fusion v43 a perdu le plan d’eau');
    for (const r of Object.values(r43.regattas)) for (const k of ['races', 'marks']) exige(new Set(r[k].map((e) => e.id)).size === r[k].length, `doublon dans ${k}`);
  }
  return `${toulon.length} paires de Toulon identiques, ${brest.length} paires de Brest`;
});

await controle('(f) la Coupe SNPM semée reste la même fiche sur les deux téléphones et sur le serveur', async () => {
  const graine = V42.rg.fromEvent({ id: 'snpm-2026', ...(await import(pathToFileURL(resolve(racine, 'js/courses.js')).href)).IC, source: 'IC fournies (PDF)' }, 0, null);       // comme migrate (premier lancement)
  const voir = (r) => V43.arch.canon(sansLieu({ name: r.name, club: r.club, dateStart: r.dateStart, dateEnd: r.dateEnd, ic: r.ic, at: r.at, marks: r.marks, courses: r.courses }));
  exige(voir(A.reg('snpm-2026')) === voir(B.reg('snpm-2026')), 'v42 ≠ v43');
  exige(voir(A.reg('snpm-2026')) === voir(await enLigne('snpm-2026')), 'serveur différent');
  exige(voir(graine) === voir(B.reg('snpm-2026')), 'graine changée');
  exige(!('venue' in A.reg('snpm-2026')) && !('venue' in (await enLigne('snpm-2026'))), 'la graine de Toulon n’a pas de plan d’eau');
  // tête de fiche : contenu comparé, pas `ub` (auteur local d’une graine jamais modifiée : déjà différent entre deux v42, voir deferred-items.md)
  const tete = (p) => { const { u, ub, ...r } = JSON.parse(partage(p, 'snpm-2026')); return V43.arch.canon(r); };
  exige(tete(A) === tete(B), `données différentes (${ecart(tete(A), tete(B))})`);
  return `fiche de ${voir(graine).length} caractères`;
});

const total = ok.length + echecs.length;
if (echecs.length) {
  console.log(`ÉCHEC : ${echecs.length} contrôle(s) sur ${total} — ${echecs.join(' ; ')}`);
  process.exit(1);
}
console.log(`Compatibilité v42 : ${ok.length} contrôles OK`);
process.exit(0);
