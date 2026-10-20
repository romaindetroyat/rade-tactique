// Rattachement d’une trace à une régate (ARCH-04) : jour de Paris du plus long segment, cas unique / heure / choix / proche / aucune,
// minuit de Paris, doublon (même début et même nombre de points), rattachement idempotent, références sans mutation des entrées.
// La trace de test est celle de la Coupe SNPM du 18/10/2026 (tests/fixtures) : quai de 06:04 à 06:13Z, course de 08:40 à 12:04Z.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT, fixture } from './helpers/setup.mjs';
import { fromGPX } from '../js/track.js';
import { parseHTML } from 'linkedom';
import * as ATT from '../js/attach.js';           // lu aussi par espace de noms (traceSummary, setTraceReport, setTraceSummary) : un module incomplet échoue sur « is not a function »
import { sheetHTML } from '../js/regview.js';
import { bodyOf } from './helpers/scan.mjs';
const { trackDay, matchRegattas, raceOfTrack, sameTrack, attachTrace, detachTrace } = ATT;

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
  // le même fichier lu deux fois : même identifiant (déterministe) et reconnu comme doublon
  const encore = fromGPX(fixture('coupe-snpm-2026-10-18.gpx'), 'copie.gpx');
  assert.ok(sameTrack([{ id: snpm.id, name: snpm.name, start: snpm.start, n: snpm.pts.length }], encore));
});

test('identifiant déterministe (Pitfall 8) : le même GPX lu deux fois donne la même trace, deux fichiers différents deux identifiants', () => {
  const a = fromGPX(fixture('coupe-snpm-2026-10-18.gpx'), 'a.gpx'), b = fromGPX(fixture('coupe-snpm-2026-10-18.gpx'), 'b.gpx');
  assert.equal(a.id, b.id);
  assert.equal(a.id, `tr${a.pts[0][0]}-${a.pts.length}`, 'tr + premier instant + - + nombre de points');
  assert.equal(a.id, `tr${snpm.start}-9538`);
  const gpx = (t0, n) => `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${Array.from({ length: n }, (_, i) => `<trkpt lat="43.07" lon="${5.9 + i * 1e-4}"><time>${new Date(t0 + i * 2000).toISOString()}</time></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const x = fromGPX(gpx(Date.UTC(2026, 10, 7, 9), 10), 'x.gpx'), y = fromGPX(gpx(Date.UTC(2026, 10, 7, 9), 12), 'y.gpx'), z = fromGPX(gpx(Date.UTC(2026, 10, 7, 10), 10), 'z.gpx');
  assert.equal(new Set([x.id, y.id, z.id]).size, 3, 'autre nombre de points ou autre début : autre trace');
  assert.equal(fromGPX(gpx(Date.UTC(2026, 10, 7, 9), 10), 'copie.gpx').id, x.id);
});

test('garde : listTracks lit par curseur (jamais getAll), un enregistrement à la fois, et rend les mêmes champs qu’avant plus rt', () => {
  const src = readFileSync(ROOT + 'js/track.js', 'utf8').replace('export async function listTracks', 'async function listTracks'), corps = bodyOf(src, 'listTracks');
  assert.ok(corps, 'listTracks existe');
  assert.match(corps, /openCursor/); assert.doesNotMatch(corps, /getAll/);
  assert.match(corps, /cur\.continue\(\)/, 'un enregistrement après l’autre');
  assert.match(corps, /\{ id: t\.id, name: t\.name, start: t\.start, n: t\.pts\.length, course: t\.course, rt: t\.report\?\.t \?\? null \}/);
  assert.match(corps, /sort\(\(a, b\) => b\.start - a\.start\)/, 'tri inchangé : la plus récente d’abord');
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

// ───────────────────────── résumés et rapport d’une trace dans la fiche de régate (ARCH-02)

const resume = { dist: 28150, dur: 12780, vmean: 4.28, perf: 0.87 };

test('résumé d’une analyse : distance (m), durée active (s), vitesse moyenne (nd) et pourcentage de la polaire, arrondis', () => {
  const s = ATT.traceSummary({ dist: 28150.4, dur: 12780.2, vmean: 4.2812, vmax: 7.5, perf: 0.8712, P: [] });
  assert.deepEqual(s, { dist: 28150, dur: 12780, vmean: 4.28, perf: 0.87 });
  assert.equal(ATT.traceSummary({ dist: 100, dur: 60, vmean: 3.2, perf: null }).perf, null, 'sans polaire : null, jamais 0');
  assert.equal(ATT.traceSummary(null), null);
  // la trace SNPM : 15,2 Nq en 3 h 33 actifs, vitesse moyenne d’environ 4,3 nd
  const nombres = ATT.traceSummary({ dist: 15.218 * 1852, dur: 3.551 * 3600, vmean: 4.29, perf: 0.9 });
  assert.equal(nombres.dist, Math.round(15.218 * 1852));
});

test('résumé posé sur la référence : changé seulement s’il diffère ; régate d’entrée intacte ; identifiant absent sans effet', () => {
  const r = deepFreeze(attachTrace(regate(), snpm, { by: 'Teiva', at: 1 }));
  const a = ATT.setTraceSummary(r, snpm.id, resume);
  assert.deepEqual(a.traces[0].sum, resume);
  assert.equal(r.traces[0].sum, undefined, 'régate d’entrée non modifiée');
  assert.equal(ATT.setTraceSummary(a, snpm.id, { ...resume }), a, 'même résumé : même objet, rien à écrire');
  assert.equal(ATT.setTraceSummary(r, 'inconnu', resume), r);
});

test('rapport du débrief posé sur la référence de la trace : instant et auteur ; identifiant absent sans effet', () => {
  const r = deepFreeze(attachTrace(regate(), snpm, { by: 'Teiva', at: 1 }));
  const a = ATT.setTraceReport(r, snpm.id, { t: 5000, by: 'Thibaud' });
  assert.deepEqual(a.traces[0].report, { t: 5000, by: 'Thibaud' });
  assert.equal(r.traces[0].report, undefined);
  assert.equal(ATT.setTraceReport(r, 'inconnu', { t: 1, by: 'x' }), r);
  assert.equal(ATT.setTraceReport(a, snpm.id, { t: 6000, by: null }).traces[0].report.by, null, 'auteur inconnu : null, affiché « — »');
});

const fiche = (r) => parseHTML(`<html><body>${sheetHTML(r, { now: t('2026-10-19T09:00:00Z') })}</body></html>`).document;

test('fiche de régate, section « Traces » : nom, jour et heure, auteur, résumé mis en forme, débrief et boutons', () => {
  let r = regate({ traces: [] });
  r = attachTrace(r, { id: 'trA', name: 'Coupe SNPM', start: t('2026-10-18T08:40:43Z'), n: 9538 }, { by: 'Teiva', at: t('2026-10-19T07:00:00Z') });
  r = ATT.setTraceSummary(r, 'trA', resume);
  r = ATT.setTraceReport(r, 'trA', { t: t('2026-10-19T08:00:00Z'), by: 'Thibaud' });
  r = attachTrace(r, { id: 'trB', name: 'Sortie du soir', start: t('2026-10-18T16:00:00Z'), n: 100 }, { by: null, at: 0 });
  const d = fiche(r);
  const lignes = [...d.querySelectorAll('#rgSheet .rgtr')];
  assert.equal(lignes.length, 2, 'une ligne par trace');
  const a = lignes[0].textContent.replace(/\s+/g, ' ');
  assert.match(a, /Coupe SNPM/);
  assert.match(a, /18\/10 10:40/, 'jour et heure de Paris');
  assert.match(a, /par Teiva le 19\/10/, 'auteur');
  assert.match(a, /15,2 Nq · 3 h 33 actives · 4,3 nd · 87 % de la polaire/);
  assert.match(a, /Débrief par Thibaud le 19\/10/);
  assert.equal(lignes[0].querySelector('[data-trd]').textContent.trim(), 'Voir le débrief');
  assert.equal(lignes[0].querySelector('[data-trd]').getAttribute('data-trd'), 'trA');
  assert.equal(lignes[0].querySelector('[data-trv]').textContent.trim(), 'Voir la trace');
  assert.equal(lignes[0].querySelector('[data-trx]').textContent.trim(), 'Détacher');
  const b = lignes[1].textContent.replace(/\s+/g, ' ');
  assert.match(b, /pas encore débriefée/);
  assert.match(b, /par —|—/, 'auteur inconnu : « — »');
  assert.equal(lignes[1].querySelector('[data-trd]').textContent.trim(), 'Débrief');
});

test('fiche de régate : sans polaire, le pourcentage est omis ; sans résumé, la ligne le dit ; sans trace, le message d’aide', () => {
  let r = attachTrace(regate(), { id: 'trA', name: 'A', start: t('2026-10-18T08:40:43Z'), n: 5 }, { by: 'Teiva', at: 1 });
  r = ATT.setTraceSummary(r, 'trA', { dist: 1852, dur: 600, vmean: 6, perf: null });
  const a = fiche(r).querySelector('#rgSheet .rgtr').textContent.replace(/\s+/g, ' ');
  assert.match(a, /1,0 Nq · 10 min actives · 6,0 nd/);
  assert.doesNotMatch(a, /polaire/);
  const sans = attachTrace(regate(), { id: 'trB', name: 'B', start: 1, n: 5 }, { by: 'Teiva', at: 1 });
  assert.match(fiche(sans).querySelector('#rgSheet .rgtr').textContent, /Ouvrez la trace pour la mesurer|analyse pas encore faite/i);
  assert.match(fiche(regate()).querySelector('#rgSheet').textContent.replace(/\s+/g, ' '), /Aucune trace : importez le GPX après la course \(onglet Traces\)/);
});

test('fiche de régate : un nom de trace piégé s’affiche en texte, sans balise img ni attribut exécutable', () => {
  const piege = '<img src=x onerror=alert(1)>';
  const r = ATT.setTraceReport(attachTrace(regate(), { id: 'trP"><b>', name: piege, start: 1, n: 5 }, { by: '<script>alert(2)</script>', at: 1 }), 'trP"><b>', { t: 1, by: '<i onclick=alert(3)>' });
  const d = fiche(r);
  assert.equal(d.querySelectorAll('#rgSheet img').length, 0);
  assert.equal(d.querySelectorAll('#rgSheet script').length, 0);
  assert.equal(d.querySelectorAll('#rgSheet i').length, 0);
  assert.equal(d.querySelectorAll('#rgSheet [onerror], #rgSheet [onclick]').length, 0);
  assert.ok(d.querySelector('#rgSheet .rgtr').textContent.includes(piege), 'le nom reste lisible, en texte');
  assert.equal([...d.querySelectorAll('#rgSheet [data-trd]')].length, 1, 'l’identifiant piégé ne casse pas l’attribut');
});

test('fiche de régate : lit seulement r.traces (résumés), jamais la liste complète des traces', () => {
  const vue = readFileSync(ROOT + 'js/regview.js', 'utf8');
  assert.doesNotMatch(vue, /listTracks|getTrack|indexedDB/, 'aucun accès aux traces complètes depuis la vue');
  assert.match(vue, /data-trx/);
});

test('câblage de l’invite et des résumés dans js/app.js', () => {
  const src = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(src, /traceSummary\(/);
  assert.match(src, /setTraceReport\(/);
  assert.match(src, /detachTrace\(/);
  assert.match(src, /Créer une régate le /);
  assert.match(src, /Laisser sans régate/);
  assert.match(src, /durée active/, 'le détail de la trace parle de durée active');
});
