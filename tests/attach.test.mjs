// Rattachement d’une trace à une régate (ARCH-04) : jour de Paris du plus long segment, cas unique / heure / choix / proche / aucune,
// minuit de Paris, doublon (même début et même nombre de points), rattachement idempotent, références sans mutation des entrées.
// La trace de test est celle de la Coupe SNPM du 18/10/2026 (tests/fixtures) : quai de 06:04 à 06:13Z, course de 08:40 à 12:04Z.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT, fixture } from './helpers/setup.mjs';
import { fromGPX } from '../js/track.js';
import { trackDay, matchRegattas, raceOfTrack, sameTrack, attachTrace, detachTrace } from '../js/attach.js';

const t = (s) => Date.parse(s);
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const regate = (over = {}) => ({ id: 'a', name: 'Régate', club: 'CVAT', dateStart: '2026-10-18', dateEnd: '', season: '2026', races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: null, at: 0, ...over });
const manche = (over = {}) => ({ n: 1, date: '2026-10-18', time: '10:55', courseId: 5, cls: 'G', laps: 2, note: '', by: null, at: 0, ...over });
// Trace synthétique : un point toutes les 60 s entre deux instants (aucune coupure)
const synth = (from, to, pas = 60000) => { const pts = []; for (let x = t(from); x <= t(to); x += pas) pts.push([x, 43.07, 5.93, null, null, 5]); return pts; };

const snpm = fromGPX(fixture('coupe-snpm-2026-10-18.gpx'), 'coupe-snpm-2026-10-18.gpx');

test('jour de la trace SNPM : 18/10/2026, segment retenu = la course (08:40:43Z), pas le quai', () => {
  const d = trackDay(snpm.pts);
  assert.equal(d.day, '2026-10-18');
  assert.equal(d.from, t('2026-10-18T08:40:43.000Z'));
  assert.equal(d.to, snpm.pts.at(-1)[0]);
});

test('jour de la trace : minuit de Paris, jamais l’heure du téléphone ni l’UTC', () => {
  // 23 h 30 → 00 h 30 (Paris, heure d’été) : le milieu est minuit passé, donc le 20
  assert.equal(trackDay(synth('2026-10-19T21:30:00Z', '2026-10-19T22:30:00Z')).day, '2026-10-20');
  // 23 h 00 → 00 h 30 : le milieu (23 h 45) est encore le 19
  assert.equal(trackDay(synth('2026-10-19T21:00:00Z', '2026-10-19T22:30:00Z')).day, '2026-10-19');
  // nuit du changement d’heure : 23 h 35 UTC le 25/10 = 00 h 35 à Paris le 26/10 (heure d’hiver)
  assert.equal(trackDay(synth('2026-10-25T23:20:00Z', '2026-10-25T23:50:00Z')).day, '2026-10-26');
  // 22 h 30 UTC le 18/10 est déjà le 19/10 à 00 h 30 à Paris (heure d’été)
  assert.equal(trackDay(synth('2026-10-18T22:10:00Z', '2026-10-18T22:50:00Z')).day, '2026-10-19');
});

test('jour de la trace : un trou de plus de 2 min coupe, le plus long segment décide', () => {
  // petit segment la veille au soir, long segment le lendemain matin : le long l’emporte
  const pts = [...synth('2026-10-17T20:00:00Z', '2026-10-17T20:10:00Z'), ...synth('2026-10-18T08:00:00Z', '2026-10-18T10:00:00Z')];
  assert.equal(trackDay(pts).day, '2026-10-18');
  // coupures explicites : même résultat que la règle du trou
  const brk = [pts.findIndex((p) => p[0] >= t('2026-10-18T08:00:00Z'))];
  assert.equal(trackDay(pts, brk).day, '2026-10-18');
});

test('rattachement : une seule régate ce jour-là → unique, sans question', () => {
  const r = regate();
  const res = matchRegattas(snpm.pts, [r, regate({ id: 'b', dateStart: '2026-11-07', dateEnd: '2026-11-09' })]);
  assert.equal(res.how, 'unique');
  assert.deepEqual(res.candidates.map((x) => x.id), ['a']);
  assert.equal(res.day, '2026-10-18');
  assert.equal(res.from, t('2026-10-18T08:40:43.000Z'));
});

test('rattachement : une régate de plusieurs jours contient le jour de la trace → unique', () => {
  const res = matchRegattas(snpm.pts, [regate({ dateStart: '2026-10-17', dateEnd: '2026-10-19' })]);
  assert.equal(res.how, 'unique');
});

test('rattachement : deux régates ce jour-là, une seule a une manche à 10:55 → heure (et c’est elle)', () => {
  const a = regate({ id: 'a', races: [manche({ time: '10:55' })] });
  const b = regate({ id: 'b', races: [manche({ time: '16:30' })] });      // 14:30Z : la trace s’arrête à 12:04Z
  const res = matchRegattas(snpm.pts, [a, b]);
  assert.equal(res.how, 'heure');
  assert.deepEqual(res.candidates.map((x) => x.id), ['a']);
});

test('rattachement : deux régates ce jour-là sans manche, ou les deux avec une manche dans la trace → choix', () => {
  const sans = matchRegattas(snpm.pts, [regate({ id: 'a' }), regate({ id: 'b' })]);
  assert.equal(sans.how, 'choix');
  assert.deepEqual(sans.candidates.map((x) => x.id), ['a', 'b']);
  const deux = matchRegattas(snpm.pts, [regate({ id: 'a', races: [manche()] }), regate({ id: 'b', races: [manche({ time: '11:30' })] })]);
  assert.equal(deux.how, 'choix', 'deux manches plausibles : l’équipier tranche, jamais une devinette');
});

test('rattachement : une manche sans heure ou d’un autre jour ne départage pas', () => {
  const a = regate({ id: 'a', dateEnd: '2026-10-19', races: [manche({ time: '', date: '2026-10-18' })] });
  const b = regate({ id: 'b', dateEnd: '2026-10-19', races: [manche({ date: '2026-10-19', time: '10:55' })] });
  assert.equal(matchRegattas(snpm.pts, [a, b]).how, 'choix');
});

test('rattachement : régate du lendemain seulement → proche ; régate du 7 au 9 novembre seulement → aucune', () => {
  const veille = regate({ id: 'v', dateStart: '2026-10-19' });
  const proche = matchRegattas(snpm.pts, [veille]);
  assert.equal(proche.how, 'proche');
  assert.deepEqual(proche.candidates.map((x) => x.id), ['v']);
  const apres = matchRegattas(snpm.pts, [regate({ id: 'w', dateStart: '2026-10-17', dateEnd: '2026-10-17' })]);
  assert.equal(apres.how, 'proche', 'la veille compte aussi');
  const loin = matchRegattas(snpm.pts, [regate({ id: 'n', dateStart: '2026-11-07', dateEnd: '2026-11-09' })]);
  assert.equal(loin.how, 'aucune');
  assert.deepEqual(loin.candidates, []);
  assert.equal(loin.day, '2026-10-18');
  assert.equal(matchRegattas(snpm.pts, []).how, 'aucune');
  assert.equal(matchRegattas(snpm.pts, [regate({ dateStart: '' })]).how, 'aucune', 'une régate sans date ne se rattache jamais seule');
});

test('manche de la trace : celle dont le signal tombe dans la trace (heure de Paris, heure d’été et d’hiver)', () => {
  const r = regate({ races: [manche({ n: 1, time: '08:30' }), manche({ n: 2, time: '10:55', courseId: 3 }), manche({ n: 3, time: '17:00' })] });
  const w = trackDay(snpm.pts);
  assert.equal(raceOfTrack(r, w).n, 2, 'signal de 10:55 = 08:55Z, dans la trace de 08:40Z à 12:04Z');
  assert.equal(raceOfTrack(regate({ races: [manche({ time: '17:00' })] }), w), null);
  assert.equal(raceOfTrack(regate(), w), null);
  // heure d’hiver : signal de 11:00 à Paris le 07/11 = 10:00Z
  const hiver = regate({ dateStart: '2026-11-07', races: [manche({ date: '2026-11-07', time: '11:00' })] });
  assert.equal(raceOfTrack(hiver, { day: '2026-11-07', from: t('2026-11-07T10:05:00Z'), to: t('2026-11-07T13:00:00Z') }).n, 1);
  assert.equal(raceOfTrack(hiver, { day: '2026-11-07', from: t('2026-11-07T11:30:00Z'), to: t('2026-11-07T13:00:00Z') }), null, 'le signal d’une heure avant le début de la trace est au-delà');
});

test('doublon : même début et même nombre de points → la trace existante est reconnue', () => {
  const liste = [{ id: 'trX', name: 'Autre', start: 1, n: 5 }, { id: 'trY', name: 'Coupe', start: snpm.start, n: snpm.pts.length }];
  assert.equal(sameTrack(liste, snpm)?.id, 'trY');
  assert.equal(sameTrack(liste, { start: snpm.start, pts: snpm.pts.slice(1) }), null, 'même début mais autre nombre de points : une autre trace');
  assert.equal(sameTrack(liste, { start: snpm.start + 1000, pts: snpm.pts }), null);
  assert.equal(sameTrack([], snpm), null);
  // le même fichier lu deux fois donne des identifiants différents (aléa) mais reste reconnu
  const encore = fromGPX(fixture('coupe-snpm-2026-10-18.gpx'), 'copie.gpx');
  assert.ok(sameTrack([{ id: snpm.id, name: snpm.name, start: snpm.start, n: snpm.pts.length }], encore));
});

test('rattachement : une référence (id, name, start, n, by, at), une seule même posée deux fois, régates d’entrée intactes', () => {
  const r = deepFreeze(regate({ id: 'a', traces: [] }));
  const un = attachTrace(r, snpm, { by: 'Teiva', at: 1000 });
  assert.deepEqual(un.traces, [{ id: snpm.id, name: snpm.name, start: snpm.start, n: snpm.pts.length, by: 'Teiva', at: 1000 }]);
  assert.deepEqual(r.traces, [], 'la régate d’entrée n’est pas modifiée');
  const deux = attachTrace(un, snpm, { by: 'Thibaud', at: 2000 });
  assert.equal(deux.traces.length, 1, 'idempotent par identifiant de trace');
  assert.equal(deux.traces[0].by, 'Teiva', 'le premier rattachement garde son auteur');
  // une trace listée (sans points) se rattache aussi : n vient de la liste
  const listee = attachTrace(r, { id: 'trZ', name: 'Z', start: 5, n: 77 }, { by: null, at: 3 });
  assert.equal(listee.traces[0].n, 77);
  assert.equal(listee.traces[0].by, null);
});

test('détacher : la référence disparaît, les autres restent, un identifiant inconnu ne change rien', () => {
  const a = attachTrace(attachTrace(regate(), snpm, { by: 'Teiva', at: 1 }), { id: 'trZ', name: 'Z', start: 5, n: 77 }, { by: 'Teiva', at: 2 });
  assert.equal(a.traces.length, 2);
  const b = detachTrace(deepFreeze(structuredClone(a)), snpm.id);
  assert.deepEqual(b.traces.map((x) => x.id), ['trZ']);
  assert.equal(detachTrace(a, 'inconnu').traces.length, 2);
  assert.equal(detachTrace(regate(), 'x').traces.length, 0);
});

test('câblage de l’import dans js/app.js : doublon, rattachement, débrief lancé après un geste de validation', () => {
  const src = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(src, /sameTrack\(/, 'doublon reconnu avant saveTrack');
  assert.match(src, /matchRegattas\(/, 'rattachement par le jour de la trace');
  assert.match(src, /courseHint/, 'parcours de la manche donné au débrief');
  assert.match(src, /mapReady/, 'le débrief attend la carte sans geler l’interface');
  assert.ok(src.indexOf('sameTrack(') < src.indexOf('await saveTrack(tr)', src.indexOf('sameTrack(')), 'sameTrack avant saveTrack');
});
