// Semis et fiches IC de Naos comparés à la v43 (08-04, T11) : mêmes appels que js/app.js de la v43 (migrate, seedNorm, seedGpen, icOf) sur des
// stockages en mémoire, résultat canonique (index écrit, clés écrites, IC des fiches). La référence est capturée UNE fois sur l’extraction de
// 5e9b8a5 (tests/fixtures/graines-v43.json) : npm test ne lit pas git (un déploiement peut ne pas avoir l’historique).
//   node tests/helpers/graines.mjs --capture <racine extraite de 5e9b8a5> <sortie>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NOW = Date.UTC(2026, 11, 5, 9, 0, 0);

// Stockage en mémoire qui garde l’ordre des écritures
export function memoire(init = {}) {
  const m = new Map(Object.entries(init)), ecrits = [];
  return {
    ecrits, dump: () => Object.fromEntries([...m.entries()].sort(([a], [b]) => a.localeCompare(b))),
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { ecrits.push(k); m.set(k, String(v)); }, removeItem: (k) => { ecrits.push('-' + k); m.delete(k); },
  };
}

// Démarrage de js/app.js (l. 81-85 de la v43) : migrate, seedNorm puis seedGpen, index réécrit seulement si l’objet change.
// `opts` : paramètres de plus passés aux trois fonctions (v44 : graines de l’espace) ; vide = appel de la v43.
export function demarre(R, storage, opts = {}) {
  let REG = R.migrate({ storage, now: NOW, by: 'Teiva', ...opts });
  const s = R.seedNorm(REG, opts);
  if (s !== REG) { REG = s; R.saveRegattas(storage, REG); }
  const g = R.seedGpen(REG, { storage, ...opts });
  if (g !== REG) { REG = g; R.saveRegattas(storage, REG); }
  return REG;
}

// Cas de départ : appareil neuf, index d’avant (graine à ramener), ancienne fiche rade.events.v1, pierre tombale du GPEN, marqueur posé
export const CAS = () => ({
  neuf: {},
  events: { 'rade.events.v1': JSON.stringify({ list: [{ id: 'cvat-1', event: 'Régate CVAT', date: '2026-11-07', source: 'IC CVAT', text: 'IC', vhf: 72 }] }) },
  graine: { 'rade.regates.v1': JSON.stringify({ v: 1, list: [{ id: 'snpm-2026', name: 'Coupe SNPM', club: 'CVAT', dateStart: '2026-10-18', dateEnd: '', season: '2026', races: [], ic: { fields: {}, text: '', source: '', read: 'reprise', excerpts: {}, validated: { by: 'Teiva', at: 5 } }, marks: [], courses: [], frozen: {}, traces: [], by: 'Teiva', at: 5 }] }) },
  tombe: { 'rade.regates.v1': JSON.stringify({ v: 1, list: [], tomb: { 'gpen-2027': { t: 9, by: 'Romain' } } }) },
  marque: { 'rade.seed.gpen.v1': '1' },
});

// Relevé canonique d’une version des modules (racine : dossier qui contient js/ et package.json)
export async function releve(racine, opts = {}) {
  const R = await import(pathToFileURL(join(racine, 'js/regates.js')).href);
  const out = { cas: {}, ic: {} };
  for (const [nom, init] of Object.entries(CAS())) {
    const st = memoire(init);
    const REG = demarre(R, st, opts);
    out.cas[nom] = { ids: REG.list.map((r) => r.id), ecrits: st.ecrits, stockage: st.dump() };
  }
  // IC des fiches de Naos : graines (Toulon, Brest), régate de Toulon créée, régate de Brest créée, fiche IC lue
  const REG = demarre(R, memoire(), opts);
  const cree = (venue) => R.createRegatta({ name: 'Essai', dateStart: '2026-12-05', club: 'CVAT', venue }, { now: NOW, by: 'Teiva', rnd: () => 0.5 }).regatta;
  const lue = { ...cree('toulon'), ic: { fields: { vhf: 72, classes: [['J80', 'Sigle J80']] }, text: 'IC', source: 'pdf', read: 'motifs', excerpts: {}, validated: { by: 'Teiva', at: NOW } } };
  for (const [nom, r] of [['snpm', REG.list.find((x) => x.id === 'snpm-2026')], ['gpen', REG.list.find((x) => x.id === 'gpen-2027')], ['toulon', cree('toulon')], ['brest', cree('brest')], ['lue', lue], ['aucune', null]]) out.ic[nom] = R.icOf(r);
  // fusion de documents de Naos (js/archmerge.js) : plan d’eau écrit des deux côtés, copie sans plan d’eau, valeur « bormes » venue d’ailleurs
  const M = await import(pathToFileURL(join(racine, 'js/archmerge.js')).href);
  const doc = (regattas) => ({ ...M.emptyDoc(), regattas: Object.fromEntries(regattas.map((r) => [r.id, r])) });
  const rg = (id, over) => ({ ...R.createRegatta({ name: id, dateStart: '2026-12-05', club: 'CVAT' }, { now: NOW, by: 'Teiva', rnd: () => 0.5 }).regatta, id, u: NOW, ub: 'Teiva', ...over });
  const A = doc([rg('a', { venue: 'brest', vu: NOW }), rg('b', {}), rg('c', { venue: 'bormes', vu: NOW + 5 }), rg('d', { venue: 'toulon', vu: NOW })]);
  const B = doc([rg('a', { venue: 'toulon', vu: NOW + 1, u: NOW + 1 }), rg('b', { venue: 'brest', vu: NOW + 2 }), rg('c', { venue: 'brest', vu: NOW + 1 }), rg('e', { venue: 'bormes', vu: NOW })]);
  out.fusion = { ab: M.mergeDoc(A, B), ba: M.mergeDoc(B, A), aa: M.mergeDoc(A, A) };
  return JSON.parse(JSON.stringify(out));
}

if (process.argv[2] === '--capture') {
  const [, , , racine, sortie] = process.argv;
  const r = await releve(racine);
  writeFileSync(sortie, JSON.stringify({ v: 43, from: '5e9b8a5', ...r }) + '\n');
  console.log(`capture écrite : ${sortie} (${Object.keys(r.cas).length} cas, ${Object.keys(r.ic).length} fiches)`);
}
