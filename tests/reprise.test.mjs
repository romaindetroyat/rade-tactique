// js/reprise.js (ARCH2-01, D-01 à D-03) : rattrapage, une fois par téléphone, des traces gardées avant l’archive. Module pur : les bases locales sont
// des Map, la liste des régates un tableau remplacé par `save`, la course et le verrou des fonctions espionnées. Aucun navigateur, aucun réseau.
// La trace de test est celle de la Coupe SNPM du 18/10/2026 (tests/fixtures) ; l’« orpheline » est une sortie du 01/09/2026 sans régate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT, fixture } from './helpers/setup.mjs';
import { fromGPX, canonicalTraceId } from '../js/track.js';
import { mergeRegatta } from '../js/archmerge.js';
import { runReprise } from '../js/reprise.js';

const T0 = Date.parse('2026-10-20T10:00:00Z');
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const snpm = fromGPX(fixture('coupe-snpm-2026-10-18.gpx'), 'coupe-snpm-2026-10-18.gpx');
const regate = (over = {}) => ({ id: 'snpm-2026', name: 'Coupe SNPM', club: 'CVAT', dateStart: '2026-10-18', dateEnd: '', season: '2026', races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: null, at: 0, ...over });
const manche = (over = {}) => ({ n: 1, date: '2026-10-18', time: '10:55', courseId: 5, cls: 'G', laps: 2, note: '', by: null, at: 0, ...over });
// Sortie du 01/09/2026 : dix minutes, un point par minute, aucune régate ce jour-là
const orpheline = (over = {}) => {
  const start = Date.parse('2026-09-01T08:00:00Z');
  const pts = Array.from({ length: 11 }, (_, i) => [start + i * 60000, 43.07, 5.93, null, null, 5]);
  return { id: 'tr' + start, name: 'Entraînement', start, course: null, pts, ...over };
};

// Un téléphone : traces (Map), régates (tableau remplacé par save), espions ; deps = ce que js/app.js passerait à runReprise
function telephone({ traces = [], list = [regate()], active = false, locked = false } = {}) {
  const p = { tracks: new Map(traces.map((t) => [t.id, clone(t)])), list, active, locked, lus: [], saves: [], renames: [], effaces: [], errors: [], listes: 0 };
  p.deps = {
    async listTracks() {
      p.listes++;
      if (p.listFail) throw new Error('base illisible');
      return [...p.tracks.values()].map((t) => ({ id: t.id, name: t.name, start: t.start, n: t.pts.length, course: t.course, rt: t.report?.t ?? null }));
    },
    async getTrack(id) {
      p.lus.push(id);
      if (p.getFail?.has(id)) throw new Error('lecture impossible');
      p.apresLecture?.();
      return clone(p.tracks.get(id));
    },
    async saveTrack(tr) { p.renames.push(tr.id); p.tracks.set(tr.id, clone(tr)); },
    async deleteTrack(id) { p.effaces.push(id); p.tracks.delete(id); },
    getList: () => p.list,
    save(r) { p.saves.push(r); p.list = p.list.map((x) => (x.id === r.id ? r : x)); },
    who: () => 'Teiva', now: () => T0,
    isActive: () => p.active, isLocked: () => p.locked,
    report: (ou, e) => p.errors.push(`${ou}: ${e.message}`),
  };
  return p;
}

test('unique : la trace de la Coupe SNPM entre sans question dans sa régate (id, start, n, by, at), un seul enregistrement', async () => {
  const p = telephone({ traces: [snpm] });
  const res = await runReprise(p.deps);
  assert.deepEqual(res, { rangees: 1, deja: 0, laissees: 0, renommees: 0, erreurs: 0 });
  assert.equal(p.saves.length, 1, 'save appelé une seule fois');
  assert.deepEqual(p.list[0].traces, [{ id: snpm.id, name: snpm.name, start: snpm.start, n: snpm.pts.length, by: 'Teiva', at: T0 }]);
  assert.equal(p.tracks.size, 1, 'la trace locale reste en place');
});

test('heure : deux régates le 18/10, une seule a une manche à l’heure de la trace → rangée dans celle-là', async () => {
  const a = regate({ id: 'a', races: [manche({ time: '10:55' })] });
  const b = regate({ id: 'b', races: [manche({ time: '16:30' })] });
  const p = telephone({ traces: [snpm], list: [a, b] });
  const res = await runReprise(p.deps);
  assert.equal(res.rangees, 1);
  assert.equal(p.list.find((r) => r.id === 'a').traces.length, 1);
  assert.equal(p.list.find((r) => r.id === 'b').traces.length, 0);
});

test('choix : deux régates ce jour-là sans manche → laissée, aucune référence, aucune invite possible', async () => {
  const p = telephone({ traces: [snpm], list: [regate({ id: 'a' }), regate({ id: 'b' })] });
  const res = await runReprise(p.deps);
  assert.equal(res.rangees, 0);
  assert.equal(res.laissees, 1);
  assert.equal(p.saves.length, 0);
  assert.ok(p.list.every((r) => r.traces.length === 0));
});

test('proche : une régate la veille seulement → laissée (jamais de rattachement par proximité)', async () => {
  const p = telephone({ traces: [snpm], list: [regate({ dateStart: '2026-10-17' })] });
  const res = await runReprise(p.deps);
  assert.equal(res.laissees, 1);
  assert.equal(res.rangees, 0);
  assert.equal(p.saves.length, 0);
});

test('aucune : trace du 01/09 sans régate → laissée, toujours dans les traces du téléphone, rien de créé', async () => {
  const o = orpheline();
  const p = telephone({ traces: [o] });
  const res = await runReprise(p.deps);
  assert.deepEqual(res, { rangees: 0, deja: 0, laissees: 1, renommees: 0, erreurs: 0 });
  assert.ok(p.tracks.has(o.id));
  assert.equal(p.saves.length, 0);
  assert.equal(p.list.length, 1, 'aucune fiche « entraînement » (D-02)');
});

test('une trace de la Coupe et une orpheline : l’une rangée, l’autre laissée', async () => {
  const p = telephone({ traces: [snpm, orpheline()] });
  const res = await runReprise(p.deps);
  assert.equal(res.rangees, 1);
  assert.equal(res.laissees, 1);
});

test('déjà référencée dans une régate → comptée « déjà », sa trace n’est pas lue', async () => {
  const ref = { id: snpm.id, name: snpm.name, start: snpm.start, n: snpm.pts.length, by: 'Thibaud', at: 1 };
  const p = telephone({ traces: [snpm], list: [regate({ traces: [ref] })] });
  const res = await runReprise(p.deps);
  assert.equal(res.deja, 1);
  assert.equal(res.rangees, 0);
  assert.deepEqual(p.lus, [], 'getTrack jamais appelé pour une trace déjà rangée');
  assert.equal(p.saves.length, 0);
});

test('course en cours au départ → { skipped: course }, la liste des traces n’est pas lue', async () => {
  const p = telephone({ traces: [snpm], active: true });
  const res = await runReprise(p.deps);
  assert.equal(res.skipped, 'course');
  assert.equal(p.listes, 0);
  assert.equal(p.saves.length, 0);
});

test('journée de régate verrouillée au départ → { skipped: journee }', async () => {
  const p = telephone({ traces: [snpm], locked: true });
  const res = await runReprise(p.deps);
  assert.equal(res.skipped, 'journee');
  assert.equal(p.listes, 0);
});

test('une course commence après la première trace → la seconde n’est pas lue, skipped: course, la première reste rangée', async () => {
  const p = telephone({ traces: [snpm, orpheline()] });
  p.apresLecture = () => { p.active = true; };
  const res = await runReprise(p.deps);
  assert.equal(res.skipped, 'course');
  assert.equal(p.lus.length, 1, 'une seule trace lue');
  assert.equal(res.rangees, 1);
});

test('seconde exécution sur le résultat de la première : rien de rangé, save jamais rappelé', async () => {
  const p = telephone({ traces: [snpm, orpheline()] });
  await runReprise(p.deps);
  const avant = p.saves.length;
  const res = await runReprise(p.deps);
  assert.equal(res.rangees, 0);
  assert.equal(res.deja, 1);
  assert.equal(p.saves.length, avant, 'aucune seconde référence');
  assert.equal(p.list[0].traces.length, 1);
});

test('une trace illisible est consignée, l’autre est rangée, pas de skipped', async () => {
  const o = orpheline();
  const p = telephone({ traces: [o, snpm] });
  p.getFail = new Set([o.id]);
  const res = await runReprise(p.deps);
  assert.equal(res.erreurs, 1);
  assert.equal(res.rangees, 1);
  assert.equal(res.skipped, undefined);
  assert.equal(p.errors.length, 1);
  assert.match(p.errors[0], /^reprise: /);
});

test('base des traces illisible → { error: base_traces } et consigné', async () => {
  const p = telephone({ traces: [snpm] });
  p.listFail = true;
  const res = await runReprise(p.deps);
  assert.equal(res.error, 'base_traces');
  assert.equal(p.errors.length, 1);
});

test('gardes statiques : js/app.js importe reprise.js une seule fois, et seulement par import() ; js/reprise.js ne touche ni base, ni page, ni stockage', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.equal(app.split("import('./reprise.js')").length - 1, 1);
  assert.equal(/^\s*import\s[^;\n]*from\s+['"]\.\/reprise\.js['"]/m.test(app), false, 'aucun import statique (ouverture FIAB-06)');
  const src = readFileSync(ROOT + 'js/reprise.js', 'utf8');
  for (const mot of ['indexedDB', 'document', 'localStorage']) assert.equal(src.includes(mot), false, `js/reprise.js ne doit pas contenir ${mot}`);
});

// ───────────────────────── identifiant stable des anciens imports, doublon entre téléphones, rapport annoncé (D-10, D-11)
// Avant la v31 un GPX importé recevait un identifiant aléatoire : 'tr' + début + un nombre au hasard.
const STABLE = 'tr' + snpm.start + '-' + snpm.pts.length;
const ancien = (suffixe, over = {}) => ({ ...clone(snpm), id: 'tr' + snpm.start + suffixe, ...over });

test('canonicalTraceId(fromGPX(GPX SNPM)) est l’identifiant de fromGPX : tr + start + - + 9538', () => {
  assert.equal(canonicalTraceId(snpm), snpm.id);
  assert.equal(snpm.id, STABLE);
  assert.equal(snpm.pts.length, 9538);
});

test('ancien import à identifiant aléatoire non rangé → enregistré sous l’identifiant stable, ancien effacé, référence stable, renommees 1', async () => {
  const p = telephone({ traces: [ancien('417')] });
  const res = await runReprise(p.deps);
  assert.equal(res.renommees, 1);
  assert.equal(res.rangees, 1);
  assert.deepEqual(p.renames, [STABLE], 'saveTrack appelé une fois, sous le nouvel identifiant');
  assert.deepEqual(p.effaces, ['tr' + snpm.start + '417']);
  assert.deepEqual([...p.tracks.keys()], [STABLE], 'une seule trace locale, jamais zéro');
  assert.deepEqual(p.list[0].traces.map((x) => x.id), [STABLE]);
  assert.equal(p.tracks.get(STABLE).pts.length, 9538, 'tous les points ont suivi');
});

test('écrire avant d’effacer : saveTrack échoue → l’ancienne trace est intacte, erreur consignée, rien de rangé', async () => {
  const p = telephone({ traces: [ancien('417')] });
  p.deps.saveTrack = async () => { throw new Error('quota dépassé'); };
  const res = await runReprise(p.deps);
  assert.equal(res.erreurs, 1);
  assert.equal(res.rangees, 0);
  assert.deepEqual(p.effaces, [], 'jamais d’effacement sans écriture réussie');
  assert.ok(p.tracks.has('tr' + snpm.start + '417'));
});

test('interruption entre l’écriture et l’effacement (les deux identifiants présents) → seul l’ancien est effacé, saveTrack jamais appelé', async () => {
  const p = telephone({ traces: [ancien('417'), { ...clone(snpm) }] });
  const res = await runReprise(p.deps);
  assert.deepEqual(p.renames, [], 'saveTrack non appelé');
  assert.deepEqual(p.effaces, ['tr' + snpm.start + '417']);
  assert.deepEqual([...p.tracks.keys()], [STABLE]);
  assert.equal(p.list[0].traces.length, 1, 'une seule référence');
  assert.equal(res.rangees, 1);
});

test('même interruption, ordre inverse dans la liste → le même résultat', async () => {
  const p = telephone({ traces: [{ ...clone(snpm) }, ancien('417')] });
  await runReprise(p.deps);
  assert.deepEqual(p.renames, []);
  assert.deepEqual([...p.tracks.keys()], [STABLE]);
  assert.equal(p.list[0].traces.length, 1);
});

test('trace enregistrée dans l’app (sans imported) → identifiant inchangé, jamais renommée', async () => {
  const rec = { ...clone(snpm), id: 'tr' + snpm.start, imported: undefined };
  delete rec.imported;
  const p = telephone({ traces: [rec] });
  const res = await runReprise(p.deps);
  assert.equal(res.renommees, 0);
  assert.deepEqual(p.renames, []);
  assert.deepEqual(p.effaces, []);
  assert.deepEqual(p.list[0].traces.map((x) => x.id), ['tr' + snpm.start]);
});

test('ancien identifiant déjà référencé (téléphone qui l’avait rangé en v31) → ni renommé, ni rattaché de nouveau', async () => {
  const old = 'tr' + snpm.start + '82';
  const ref = { id: old, name: snpm.name, start: snpm.start, n: snpm.pts.length, by: 'Thibaud', at: 1 };
  const p = telephone({ traces: [ancien('82')], list: [regate({ traces: [ref] })] });
  const res = await runReprise(p.deps);
  assert.equal(res.deja, 1);
  assert.equal(res.renommees, 0);
  assert.deepEqual(p.renames, []);
  assert.deepEqual(p.effaces, []);
  assert.equal(p.saves.length, 0);
});

test('la régate a déjà une référence de même début et même nombre de points sous un autre identifiant → aucune seconde référence', async () => {
  const ref = { id: 'tr' + snpm.start + '555', name: snpm.name, start: snpm.start, n: snpm.pts.length, by: 'Thibaud', at: 1 };
  const p = telephone({ traces: [ancien('417')], list: [regate({ traces: [ref] })] });
  const res = await runReprise(p.deps);
  assert.equal(res.deja, 1);
  assert.equal(res.rangees, 0);
  assert.equal(p.saves.length, 0);
  assert.equal(p.list[0].traces.length, 1);
});

test('le même GPX sous deux identifiants aléatoires sur deux téléphones → même identifiant de référence, la fusion n’en garde qu’une', async () => {
  const A = telephone({ traces: [ancien('417')] }), B = telephone({ traces: [ancien('82')] });
  B.deps.who = () => 'Thibaud';
  await runReprise(A.deps);
  await runReprise(B.deps);
  assert.equal(A.list[0].traces[0].id, B.list[0].traces[0].id);
  const fusion = mergeRegatta(A.list[0], B.list[0]);
  assert.deepEqual(fusion.traces.map((x) => x.id), [STABLE], 'une seule référence, donc un seul envoi au magasin');
});

test('rapport local de l’ancienne trace → la référence porte report { t, by } ; sans rapport, pas de champ report', async () => {
  const t = Date.parse('2026-10-18T15:00:00Z');
  const avec = telephone({ traces: [ancien('417', { report: { html: '<p>Rapport</p>', t, name: 'Débrief SNPM' } })] });
  await runReprise(avec.deps);
  assert.deepEqual(avec.list[0].traces[0].report, { t, by: 'Teiva' });
  assert.equal(avec.saves.length, 1, 'un seul enregistrement de la régate');
  const sans = telephone({ traces: [snpm] });
  await runReprise(sans.deps);
  assert.equal('report' in sans.list[0].traces[0], false);
});
