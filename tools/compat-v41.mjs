// compat-v41 : « Modifier une manche » (v42) face à un téléphone resté en v41, dans les deux sens. Hors `npm test`, comme tools/compat-v37.mjs :
// il importe le code de la v41 extrait par `git archive` de dda755b (js/ et package.json).
//   W=$(mktemp -d) && git archive -o "$W/v41.tar" dda755b js package.json && tar -xf "$W/v41.tar" -C "$W" && node tools/compat-v41.mjs "$W"
// Monde simulé : la fonction api/archive.js COURANTE (le serveur passe en v42 avec l’app) sur un faux Blob, un téléphone v42 (modules courants) et un
// téléphone v41 (modules extraits). La v42 modifie une manche (même heure), puis la déplace ; la v41 lit, affiche, fusionne, renvoie un état en
// retard et supprime une manche : aucun doublon, aucune résurrection, mêmes données des deux côtés ; les deux versions de mergeDoc donnent le même
// résultat sur les mêmes documents. Une ligne « OK … » par contrôle. Codes de sortie : 0 = tout OK, 1 = un contrôle échoue, 2 = racine v41 illisible.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

const racine = process.argv[2];
if (!racine || !existsSync(resolve(racine, 'js/archmerge.js')) || !existsSync(resolve(racine, 'package.json'))) {
  console.error('usage : node tools/compat-v41.mjs <racine v41> (extraction git archive de dda755b : js/ et package.json)');
  process.exit(2);
}
const MODS = ['regates.js', 'regview.js', 'archmerge.js', 'archsync.js'];
const charge = (url) => Promise.all(MODS.map((f) => import(url(f))));
let V41, V42, serveur, faux;
try {
  const [rg, view, arch, sync] = await charge((f) => pathToFileURL(resolve(racine, 'js', f)).href);
  V41 = { nom: 'v41', rg, view, arch, sync };
  const [rg2, view2, arch2, sync2] = await charge((f) => new URL(`../js/${f}`, import.meta.url).href);
  V42 = { nom: 'v42', rg: rg2, view: view2, arch: arch2, sync: sync2 };
  serveur = await import(new URL('../api/archive.js', import.meta.url).href);
  faux = await import(new URL('../tests/helpers/fakeblob.mjs', import.meta.url).href);
  if (typeof V41.arch.mergeDoc !== 'function' || typeof V41.sync.runSync !== 'function') throw new Error('modules v41 inattendus');
  if ('updateRace' in V41.rg) throw new Error('la racine donnée a déjà updateRace : ce n’est pas la v41');
} catch (e) {
  console.error(`Racine v41 illisible : ${e.message}`);
  process.exit(2);
}

const ok = [], echecs = [];
async function controle(nom, fn) {
  try { const detail = await fn(); ok.push(nom); console.log(`OK ${nom}${detail ? ` : ${detail}` : ''}`); } catch (e) { echecs.push(nom); console.log(`ÉCHEC : ${nom} — ${e.message}`); }
}
const exige = (cond, msg) => { if (!cond) throw new Error(msg); };

// ───────────────────────── le monde : serveur courant, téléphones v41 et v42

const T0 = Date.parse('2026-11-07T07:00:00Z'), PARCOURS = [{ id: 3 }, { id: 5 }];
const clock = { t: T0 }, handler = serveur.createHandler({ blob: faux.createFakeBlob(), now: () => clock.t });
const avance = (ms = 60e3) => { clock.t += ms; };
function telephone(nom, M) {
  const p = {
    nom, M, st: { v: 1, list: [] }, meta: {}, online: true,
    save(next) { const r = M.arch.stampState(p.st, next, { now: clock.t, by: nom }); p.st = r.st; if (r.changed.length) M.arch.markDirty(p.meta, r.changed); },
    reg(id) { return p.st.list.find((r) => r.id === id); },
    sync() { if (!p.meta.first) p.st = M.arch.legacyStamp(p.st); return M.sync.runSync(p.deps, 'manuel'); },
  };
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
const A = telephone('Teiva', V42), B = telephone('Thibaud', V41);
const tour = async (...ps) => { for (let i = 0; i < 2; i++) for (const p of ps) { avance(30e3); const r = await p.sync(); exige(!r?.error, `${p.nom} : ${JSON.stringify(r)}`); } };
const manches = (p, id) => (p.reg(id)?.races || []).map((m) => `${m.n}:${m.date.slice(8)} ${m.time} p${m.courseId}${m.note ? ` «${m.note}»` : ''}`).join(' | ');
const partage = (p, id) => { const r = p.reg(id); return V42.arch.canon({ ...V42.arch.toShared(r), races: (r.races || []).map(({ n, ...m }) => m) }); };
const fiche = (M, r) => {
  const html = M.view.sheetHTML(r, { now: clock.t, courses: PARCOURS.map((c) => ({ id: c.id, title: `Parcours ${c.id}` })) });
  const { document } = parseHTML(`<div id="racine">${html}</div>`);
  return { html, document, balises: document.querySelectorAll('#racine img, #racine script, #racine iframe').length };
};

let ID, ANCIEN;
await controle('départ : régate de deux manches créée en v42, lue par la v41 par le serveur v42', async () => {
  const r = V42.rg.createRegatta({ name: 'Régate mixte', dateStart: '2026-11-07', dateEnd: '2026-11-08', club: 'CVAT' }, { now: clock.t, by: 'Teiva', rnd: () => 0.5 }).regatta;
  let x = V42.rg.addRace(r, { date: '2026-11-07', time: '10:55', courseId: 5, cls: 'G', laps: 2, note: 'vent faible' }, { now: clock.t, by: 'Teiva', courses: PARCOURS }).regatta;
  x = V42.rg.addRace(x, { date: '2026-11-07', time: '13:25', courseId: 3, cls: 'P', laps: 1 }, { now: clock.t, by: 'Teiva', courses: PARCOURS }).regatta;
  A.save(V42.rg.upsertRegatta(A.st, x)); ID = x.id;
  await tour(A, B);
  ANCIEN = A.reg(ID).races[0].id;
  exige(manches(B, ID) === '1:07 10:55 p5 «vent faible» | 2:07 13:25 p3', manches(B, ID));
  return manches(B, ID);
});

await controle('v41 lit une manche modifiée en v42 (même heure) : nouvelle version, même identifiant, fiche v41 sans erreur ni balise, ancienne version dans son historique', async () => {
  avance();
  const r = V42.rg.updateRace(A.reg(ID), 1, { courseId: 3, note: 'grain <img src=x onerror=alert(1)>' }, { now: clock.t, by: 'Teiva', courses: PARCOURS });
  exige(r.ok && !r.moved, JSON.stringify(r.errors));
  A.save(V42.rg.upsertRegatta(A.st, r.regatta));
  await tour(A, B);
  const m = B.reg(ID).races[0];
  exige(m.id === ANCIEN && m.courseId === 3 && m.note.startsWith('grain'), JSON.stringify(m));
  const f = fiche(V41, B.reg(ID));
  exige(f.balises === 0, 'balise non échappée dans la fiche v41');
  exige(!f.html.includes('data-edrace'), 'la v41 n’a pas de bouton Modifier');
  exige(f.document.querySelectorAll('.rghl[data-kind=race]').length === 1, 'historique v41 : une ligne « Manche »');
  exige(partage(A, ID) === partage(B, ID), 'données différentes');
  return 'fiche v41 de ' + f.html.length + ' caractères';
});

await controle('v41 lit une manche déplacée en v42 (10:55 → 14:00) : une seule manche, au nouvel identifiant ; l’ancien a sa pierre tombale', async () => {
  avance();
  const r = V42.rg.updateRace(A.reg(ID), 1, { time: '14:00' }, { now: clock.t, by: 'Teiva', courses: PARCOURS });
  exige(r.ok && r.moved, JSON.stringify(r.errors));
  A.save(V42.rg.upsertRegatta(A.st, r.regatta));
  await tour(A, B);
  const ids = B.reg(ID).races.map((m) => m.id).join(',');
  exige(ids === 'm202611071325,m202611071400', ids);
  exige(B.reg(ID).tomb[`race:${ANCIEN}`], 'pas de pierre tombale chez la v41');
  exige(fiche(V41, B.reg(ID)).balises === 0, 'fiche v41');
  exige(partage(A, ID) === partage(B, ID), 'données différentes');
  return manches(B, ID);
});

await controle('v41 en retard : un état d’avant le déplacement (sa saisie comprise) renvoyé par la v41 ne fait ni doublon ni résurrection', async () => {
  // B (v41) repart d'une copie d'avant le déplacement : la manche 10:55 ; hors réseau, il ajoute une manche le 8 à 11:00
  const avant = A.reg(ID);
  const vieux = { ...B.reg(ID), races: [...B.reg(ID).races.filter((m) => m.time !== '14:00'), { ...avant.races.find((m) => m.time === '14:00'), id: ANCIEN, time: '10:55', u: T0, ub: 'Teiva', n: 9 }] };
  B.st = { ...B.st, list: B.st.list.map((r) => (r.id === ID ? { ...vieux, tomb: {} } : r)) };
  B.online = false; avance();
  const x = V41.rg.addRace(B.reg(ID), { date: '2026-11-08', time: '11:00', courseId: 3, cls: 'G', laps: 2 }, { now: clock.t, by: 'Thibaud', courses: PARCOURS });
  exige(x.ok, JSON.stringify(x.errors));
  B.save(V41.rg.upsertRegatta(B.st, x.regatta));
  B.online = true;
  await tour(B, A);
  for (const p of [A, B]) {
    const l = manches(p, ID);
    exige(!/10:55/.test(l) && (l.match(/14:00/g) || []).length === 1 && /08 11:00/.test(l), `${p.nom} (${p.M.nom}) : ${l}`);
  }
  exige(partage(A, ID) === partage(B, ID), 'données différentes');
  return manches(A, ID);
});

await controle('v41 supprime la manche déplacée, v42 modifie l’autre : les deux gestes arrivent partout', async () => {
  avance();
  const n = B.reg(ID).races.find((m) => m.time === '14:00').n;
  B.save(V41.rg.upsertRegatta(B.st, V41.rg.removeRace(B.reg(ID), n)));
  const r = V42.rg.updateRace(A.reg(ID), A.reg(ID).races.find((m) => m.time === '13:25').n, { note: 'dernière manche' }, { now: clock.t, by: 'Teiva', courses: PARCOURS });
  exige(r.ok, JSON.stringify(r.errors));
  A.save(V42.rg.upsertRegatta(A.st, r.regatta));
  await tour(A, B);
  for (const p of [A, B]) exige(manches(p, ID) === '1:07 13:25 p3 «dernière manche» | 2:08 11:00 p3', `${p.nom} : ${manches(p, ID)}`);
  return manches(B, ID);
});

await controle('v42 modifie une manche écrite par la v41 (sans changer l’heure, puis en la déplaçant)', async () => {
  avance();
  const m = A.reg(ID).races.find((x) => x.time === '11:00');
  let r = V42.rg.updateRace(A.reg(ID), m.id, { laps: 3 }, { now: clock.t, by: 'Teiva', courses: PARCOURS });
  exige(r.ok && !r.moved && r.regatta.races.find((x) => x.id === m.id).laps === 3, JSON.stringify(r));
  r = V42.rg.updateRace(r.regatta, m.id, { time: '12:00' }, { now: clock.t, by: 'Teiva', courses: PARCOURS });
  exige(r.ok && r.moved, JSON.stringify(r.errors));
  A.save(V42.rg.upsertRegatta(A.st, r.regatta));
  await tour(A, B);
  exige(manches(B, ID) === '1:07 13:25 p3 «dernière manche» | 2:08 12:00 p3', manches(B, ID));
  exige(partage(A, ID) === partage(B, ID), 'données différentes');
  return manches(B, ID);
});

await controle('mergeDoc v41 et v42 : même résultat (et commutatif) sur les documents de ce scénario, déplacement concurrent compris', async () => {
  const d = (r) => ({ v: 1, regattas: { [r.id]: V42.arch.toShared(r) }, tomb: {}, marks: {} });
  const base = V42.arch.stamp(null, V42.rg.addRace({ id: 'rgX', name: 'X', club: '', dateStart: '2026-11-07', dateEnd: '', races: [], marks: [], courses: [], traces: [], frozen: {}, by: 'Teiva', at: 1000 },
    { date: '2026-11-07', time: '10:55', courseId: 3 }, { now: 1000, by: 'Teiva', courses: PARCOURS }).regatta, { now: 1000, by: 'Teiva' });
  const deplace = V42.arch.stamp(base, V42.rg.updateRace(base, 1, { time: '14:00' }, { now: 2000, by: 'Teiva', courses: PARCOURS }).regatta, { now: 2000, by: 'Teiva' });
  const ajout41 = V41.arch.stamp(base, V41.rg.addRace(base, { date: '2026-11-07', time: '16:00', courseId: 3 }, { now: 3000, by: 'Thibaud', courses: PARCOURS }).regatta, { now: 3000, by: 'Thibaud' });
  const paires = [[d(deplace), d(ajout41)], [d(A.reg(ID)), d(B.reg(ID))], [d(deplace), d(base)]];
  for (const [x, y] of paires) {
    const r41 = V41.arch.canon(V41.arch.mergeDoc(structuredClone(x), structuredClone(y))), r42 = V42.arch.canon(V42.arch.mergeDoc(structuredClone(x), structuredClone(y)));
    exige(r41 === r42, 'mergeDoc v41 ≠ v42');
    exige(r42 === V42.arch.canon(V42.arch.mergeDoc(structuredClone(y), structuredClone(x))), 'non commutatif');
  }
  const f = V41.arch.mergeDoc(d(deplace), d(ajout41)).regattas.rgX.races.map((m) => m.time).join(',');
  exige(f === '14:00,16:00', f);
  return `${paires.length} paires`;
});

const total = ok.length + echecs.length;
if (echecs.length) {
  console.log(`ÉCHEC : ${echecs.length} contrôle(s) sur ${total} — ${echecs.join(' ; ')}`);
  process.exit(1);
}
console.log(`Compatibilité v41 : ${ok.length} contrôles OK`);
process.exit(0);
