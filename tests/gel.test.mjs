// Gel automatique du vent du jour (ARCH-02) : instant du sceau (heure d’hiver et d’été, signal inconnu), décisions, découpe des prévisions
// (25 heures, mêmes calculs que sur l’original), résumé, section « Vent du jour » de la fiche (linkedom) et gardes statiques du câblage.
// Fonctions lues par espace de noms (G.) : un module ou une fonction absents font échouer le test visé, pas le chargement du fichier.
// Aucun code d’accès ni aucune empreinte ici.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import * as G from '../js/gel.js';
import { sheetHTML } from '../js/regview.js';
import { consensus } from '../js/weather.js';
import { modelPoints, scoreModels } from '../js/obs.js';
import { Terrain, toXY, toLL } from '../js/geo.js';
import { WindField } from '../js/wind.js';
import { buildLegs, analyzeLeg } from '../js/tactics.js';
import { COURSES, LINE_PRESETS } from '../js/courses.js';

const t = (s) => Date.parse(s);
const WX = JSON.parse(readFileSync(ROOT + 'data/wx-snapshot.json', 'utf8'));
const src = (f) => readFileSync(ROOT + f, 'utf8');
const regate = (over = {}) => ({ id: 'a', name: 'Régate', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-09', season: '2026', races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: null, at: 0, ...over });
const manche = (n, time, date = '2026-11-07') => ({ n, date, time, courseId: 5, cls: 'G', laps: 2, note: '', by: null, at: 0 });
const bytes = (o) => new TextEncoder().encode(JSON.stringify(o)).length;

test('slotKey : id, jour et nature séparés par une barre', () => {
  assert.equal(G.slotKey('rgabc', '2026-10-18', 'wx'), 'rgabc|2026-10-18|wx');
  assert.equal(G.slotKey('snpm-2026', '2026-10-18', 'strat'), 'snpm-2026|2026-10-18|strat');
  assert.equal(G.THROTTLE_MS, 10 * 60e3);
});

test('sceau : une manche à 11:00 le 7/11 (heure d’hiver) scelle à 10:00Z ; la manche la plus tôt du jour est retenue', () => {
  const r = regate({ races: [manche(1, '13:25'), manche(2, '11:00'), manche(3, '', '2026-11-07')] });
  assert.deepEqual(G.sealAt(r, '2026-11-07'), { at: t('2026-11-07T10:00:00Z'), signal: 'manche' });
  // une manche du lendemain ne compte pas pour le 7 ; elle fixe le sceau du 8
  const r2 = regate({ races: [manche(1, '11:00'), manche(2, '09:50', '2026-11-08')] });
  assert.deepEqual(G.sealAt(r2, '2026-11-08'), { at: t('2026-11-08T08:50:00Z'), signal: 'manche' });
});

test('sceau : en heure d’été, 10:55 à Paris = 08:55Z ; l’heure des IC ne sert que le premier jour et seulement sans manche horaire', () => {
  const r = regate({ dateStart: '2026-10-18', dateEnd: '', ic: { fields: { firstWarning: '10:55' } } });
  assert.deepEqual(G.sealAt(r, '2026-10-18'), { at: t('2026-10-18T08:55:00Z'), signal: 'ic' });
  const deux = regate({ dateStart: '2026-11-07', dateEnd: '2026-11-08', ic: { fields: { firstWarning: '10:55' } } });
  assert.deepEqual(G.sealAt(deux, '2026-11-07'), { at: t('2026-11-07T09:55:00Z'), signal: 'ic' });
  assert.equal(G.sealAt(deux, '2026-11-08').signal, 'inconnu', 'le 2e jour : l’heure des IC ne vaut pas');
  const avecManche = regate({ dateStart: '2026-10-18', dateEnd: '', ic: { fields: { firstWarning: '10:55' } }, races: [manche(1, '11:30', '2026-10-18')] });
  assert.deepEqual(G.sealAt(avecManche, '2026-10-18'), { at: t('2026-10-18T09:30:00Z'), signal: 'manche' }, 'manche horaire d’abord, sinon l’heure des IC');
});

test('sceau, signal inconnu : fin du dernier jour de la régate à Paris (minuit), signal « inconnu », jamais nul pour un jour de la régate', () => {
  const trois = regate();                                                      // du 7 au 9 novembre, ni manche horaire ni IC
  for (const jour of ['2026-11-07', '2026-11-08', '2026-11-09']) assert.deepEqual(G.sealAt(trois, jour), { at: t('2026-11-09T23:00:00Z'), signal: 'inconnu' }, jour);
  const unJour = regate({ dateStart: '2026-10-19', dateEnd: '' });              // heure d’été : minuit de Paris = 22:00Z
  assert.deepEqual(G.sealAt(unJour, '2026-10-19'), { at: t('2026-10-19T22:00:00Z'), signal: 'inconnu' });
  // une manche sans heure (time vide) vaut une régate sans manche
  assert.equal(G.sealAt(regate({ dateStart: '2026-10-19', dateEnd: '', races: [manche(1, '', '2026-10-19')] }), '2026-10-19').signal, 'inconnu');
  // veille du passage à l’heure d’hiver (25/10) : minuit du 25 = 22:00Z le 24 ; le 25 à minuit = 23:00Z (heure d’hiver)
  assert.equal(G.sealAt(regate({ dateStart: '2026-10-24', dateEnd: '2026-10-25' }), '2026-10-24').at, t('2026-10-25T23:00:00Z'));
  assert.equal(G.sealAt(regate({ dateStart: '2026-10-24', dateEnd: '' }), '2026-10-24').at, t('2026-10-24T22:00:00Z'));
  // hors des jours de la régate : rien à sceller
  assert.equal(G.sealAt(trois, '2026-11-10'), null);
  assert.equal(G.sealAt(trois, '2026-11-06'), null);
  assert.equal(G.sealAt(null, '2026-11-07'), null);
});

test('décision : copie, nouvelles prévisions, 10 min, sceau, scellé, première ouverture après le signal', () => {
  const r = regate({ races: [manche(1, '11:00')] });                           // signal 10:00Z
  const base = { regatta: r, day: '2026-11-07', dataFetched: 1000, hasAnalysis: false };
  const at = (hhmm) => t(`2026-11-07T${hhmm}:00Z`);
  assert.equal(G.freezeAction({ ...base, now: at('07:00'), slot: null }), 'gel', 'première copie');
  const slot = { at: at('07:00'), fetched: 1000, sealed: false, strategy: null };
  assert.equal(G.freezeAction({ ...base, now: at('07:09'), slot }), 'rien', 'moins de 10 min');
  assert.equal(G.freezeAction({ ...base, now: at('07:09'), slot, dataFetched: 2000 }), 'gel', 'nouvelles prévisions');
  assert.equal(G.freezeAction({ ...base, now: at('07:10'), slot }), 'gel', '10 min ou plus');
  assert.equal(G.freezeAction({ ...base, now: at('10:00'), slot }), 'sceau', 'au signal');
  assert.equal(G.freezeAction({ ...base, now: at('10:30'), slot }), 'sceau', 'après le signal, copie déjà là : on scelle');
  assert.equal(G.freezeAction({ ...base, now: at('10:30'), slot: { ...slot, sealed: true } }), 'rien', 'scellé');
  assert.equal(G.freezeAction({ ...base, now: at('10:30'), slot: null }), 'tard', 'première ouverture après le signal');
  // sans rien à copier, ou hors des jours de la régate, ou un autre jour que celui d’aujourd’hui
  assert.equal(G.freezeAction({ ...base, now: at('07:00'), slot: null, dataFetched: 0 }), 'rien');
  assert.equal(G.freezeAction({ ...base, now: t('2026-11-10T07:00:00Z'), slot: null, day: '2026-11-10' }), 'rien', 'hors régate');
  assert.equal(G.freezeAction({ ...base, now: t('2026-11-08T07:00:00Z'), slot: null }), 'rien', 'jour passé : plus rien à copier');
});

test('décision, signal inconnu (revue W1) : toute la journée, jamais « tard » ; le lendemain de la dernière journée, plus rien', () => {
  const inconnu = regate({ dateStart: '2026-10-19', dateEnd: '' });
  const b = { regatta: inconnu, day: '2026-10-19', dataFetched: 1000, hasAnalysis: false };
  const dixHuit = t('2026-10-19T16:00:00Z');                                  // 18:00 à Paris
  assert.equal(G.freezeAction({ ...b, now: dixHuit, slot: null }), 'gel', 'première ouverture à 18:00 : une copie, pas « tard »');
  const slot2 = { at: dixHuit, fetched: 1000, sealed: false };
  assert.equal(G.freezeAction({ ...b, now: dixHuit + G.THROTTLE_MS, slot: slot2 }), 'gel');
  assert.equal(G.freezeAction({ ...b, now: t('2026-10-19T21:59:00Z'), slot: slot2, dataFetched: 3000 }), 'gel', 'jusqu’à 23:59 à Paris');
  assert.equal(G.freezeAction({ ...b, now: t('2026-10-20T07:00:00Z'), slot: slot2, day: '2026-10-20' }), 'rien', 'le lendemain');
});

test('relevés : copiés tant que leur nombre ou leur dernier instant change, même scellé', () => {
  const slot = { sealed: true, nObs: 2, obsStamp: 500 };
  assert.equal(G.obsNeedsCopy({ slot, nObsNow: 3, obsStamp: 900 }), true, 'nouveau relevé après le sceau');
  assert.equal(G.obsNeedsCopy({ slot, nObsNow: 2, obsStamp: 500 }), false, 'rien de nouveau');
  assert.equal(G.obsNeedsCopy({ slot, nObsNow: 1, obsStamp: 500 }), true, 'relevé supprimé : la copie suit');
  assert.equal(G.obsNeedsCopy({ slot: { sealed: false }, nObsNow: 0, obsStamp: 0 }), false, 'aucun relevé, aucune copie');
  assert.equal(G.obsNeedsCopy({ slot: null, nObsNow: 4, obsStamp: 900 }), false, 'sans copie du jour, la copie principale s’en charge');
});

test('découpe : 25 heures par lieu, toutes les grilles et la mer ; taille consignée', () => {
  const s = G.sliceDays(WX, ['2026-10-18']);
  assert.equal(s.multi.hourly.time.length, 25);
  assert.equal(s.multi.hourly.time[0], '2026-10-18T00:00'); assert.equal(s.multi.hourly.time.at(-1), '2026-10-19T00:00', 'l’heure 00:00 qui suit est gardée');
  assert.equal(s.grid.length, 24);
  for (const loc of s.grid) { assert.equal(loc.hourly.time.length, 25); assert.equal(loc.hourly.wind_speed_10m.length, 25); }
  assert.equal(s.marine.hourly.time.length, 25); assert.equal(s.marine.hourly.wave_height.length, 25);
  assert.equal(s.fetched, WX.fetched); assert.equal(s.snapshot, true);
  assert.equal(s.multi.hourly_units.wind_speed_10m_meteofrance_arome_france_hd, WX.multi.hourly_units.wind_speed_10m_meteofrance_arome_france_hd, 'les unités sont gardées');
  const n = bytes(s);
  console.log(`# taille des prévisions découpées au 18/10 : ${n} octets (le fichier de 3 jours : ${bytes(WX)})`);
  assert.ok(n > 30000 && n < 50000, `≈ 39 Ko attendus, vu ${n}`);
  assert.equal(WX.multi.hourly.time.length, 72, 'l’original n’est pas modifié');
});

test('découpe : modelPoints, scoreModels et consensus donnent les mêmes résultats que sur l’original (9 h, 11 h 30, 23 h 30)', () => {
  const s = G.sliceDays(WX, ['2026-10-18']);
  const ids = ['meteofrance_arome_france_hd', 'ecmwf_ifs025', 'gfs_seamless'];
  for (const h of [9, 11.5, 23.5]) for (const id of ids) assert.deepEqual(modelPoints(s, '2026-10-18', h, id), modelPoints(WX, '2026-10-18', h, id), `modelPoints ${h} h ${id}`);
  const obs = [{ day: '2026-10-18', h: 9, dir: 300, spd: 12, lat: 43.09, lon: 5.95, t: 1 }, { day: '2026-10-18', h: 11.5, dir: 310, spd: 14, lat: 43.08, lon: 5.96, t: 2 }, { day: '2026-10-18', h: 23.5, dir: 280, spd: 8, lat: 43.07, lon: 5.94, t: 3 }];
  assert.deepEqual(scoreModels(s, obs), scoreModels(WX, obs), 'classement des modèles');
  assert.ok(scoreModels(s, obs).length > 0);
  const a = consensus(s), b = consensus(WX).filter((x) => x.time >= '2026-10-18T00:00' && x.time <= '2026-10-19T00:00');
  assert.equal(a.length, 25); assert.deepEqual(a, b, 'consensus');
  // sans la 25e heure, 23 h 30 changerait : c’est ce que la découpe évite (Pitfall 2)
  assert.equal(modelPoints(s, '2026-10-19', 0, 'ecmwf_ifs025') !== null, true);
});

test('découpe : plusieurs jours, un jour absent, des données sans grille ni mer', () => {
  const deux = G.sliceDays(WX, ['2026-10-17', '2026-10-18']);
  assert.equal(deux.multi.hourly.time.length, 49);
  const rien = G.sliceDays(WX, ['2030-01-01']);
  assert.equal(rien.multi.hourly.time.length, 0);
  const mince = G.sliceDays({ fetched: 5, multi: WX.multi, grid: null, marine: null }, ['2026-10-18']);
  assert.equal(mince.grid, null); assert.equal(mince.marine, null); assert.equal(mince.multi.hourly.time.length, 25);
});

test('windAtHour : vent prévu à l’heure ronde la plus proche, nul si absent', () => {
  const series = consensus(WX);
  const w = G.windAtHour(series, '2026-10-18', '10:55');
  const ref = series.find((x) => x.time === '2026-10-18T11:00');
  assert.deepEqual(w, { dir: Math.round(ref.dir), spd: Math.round(ref.spd * 10) / 10 });
  assert.deepEqual(G.windAtHour(series, '2026-10-18', '10:25'), G.windAtHour(series, '2026-10-18', '10:00'));
  assert.deepEqual(G.windAtHour(series, '2026-10-18', '23:40'), G.windAtHour(series, '2026-10-19', '00:00'), '23:40 → minuit suivant');
  assert.equal(G.windAtHour(series, '2030-01-01', '10:00'), null);
  assert.equal(G.windAtHour(series, '2026-10-18', 'xx'), null);
  assert.equal(G.windAtHour([], '2026-10-18', '10:00'), null);
});

test('résumé : ce que la fiche affiche, sans les données lourdes', () => {
  const r = regate({ dateStart: '2026-10-18', dateEnd: '', races: [manche(1, '10:55', '2026-10-18')] });
  const series = consensus(WX), now = t('2026-10-18T08:00:00Z');
  const gel = G.freezeSummary({ action: 'gel', now, regatta: r, day: '2026-10-18', data: WX, series, model: 'meteofrance_arome_france_hd', nObs: 2, obsStamp: 77, by: 'Teiva' });
  assert.deepEqual(Object.keys(gel).sort(), ['at', 'auto', 'by', 'fetched', 'late', 'model', 'nObs', 'obsStamp', 'sealAt', 'sealed', 'signal', 'snapshot', 'windStart'].sort());
  assert.equal(gel.at, now); assert.equal(gel.sealed, false); assert.equal(gel.late, false); assert.equal(gel.auto, true); assert.equal(gel.by, 'Teiva');
  assert.equal(gel.fetched, WX.fetched); assert.equal(gel.snapshot, true); assert.equal(gel.nObs, 2); assert.equal(gel.model, 'meteofrance_arome_france_hd');
  assert.equal(gel.signal, 'manche'); assert.equal(gel.sealAt, t('2026-10-18T08:55:00Z'));
  assert.deepEqual(gel.windStart, G.windAtHour(series, '2026-10-18', '10:55'));
  assert.equal(G.freezeSummary({ action: 'sceau', now, regatta: r, day: '2026-10-18', data: WX, series }).sealed, true);
  const tard = G.freezeSummary({ action: 'tard', now, regatta: r, day: '2026-10-18', data: WX, series });
  assert.equal(tard.sealed, true); assert.equal(tard.late, true); assert.equal(tard.by, null);
  const inc = G.freezeSummary({ action: 'gel', now, regatta: regate({ dateStart: '2026-10-18', dateEnd: '' }), day: '2026-10-18', data: WX, series });
  assert.equal(inc.signal, 'inconnu'); assert.equal(inc.sealAt, t('2026-10-18T22:00:00Z')); assert.equal(inc.windStart, null, 'pas de signal, pas de vent au signal');
  assert.ok(bytes(gel) < 600, 'un petit résumé');
});

// ───────────────────────── section « Vent du jour » de la fiche

const NOW = t('2026-11-07T08:30:00Z');                                         // 09:30 à Paris le samedi 7/11
const frozen7 = { at: t('2026-11-07T08:00:00Z'), sealed: false, late: false, fetched: t('2026-11-07T07:50:00Z'), snapshot: false, by: 'Teiva', auto: true, windStart: { dir: 315, spd: 14.6 }, model: 'meteofrance_arome_france_hd', nObs: 2, obsStamp: 5, signal: 'manche', sealAt: t('2026-11-07T10:00:00Z') };
const windDoc = (r, now = NOW) => parseHTML(`<html><body>${sheetHTML(r, { now })}</body></html>`).document;
const windText = (r, jour, now = NOW) => windDoc(r, now).querySelector(`.rgwind[data-day="${jour}"]`)?.textContent.replace(/\s+/g, ' ') ?? '';

test('vue : le gel du matin (non scellé) montre l’heure, les prévisions, le modèle, les relevés, le vent au signal et l’auteur', () => {
  const r = regate({ races: [manche(1, '11:00')], frozen: { '2026-11-07': frozen7 } });
  const doc = windDoc(r);
  assert.ok(doc.querySelector('#rgSheet .rgwinds'), 'section « Vent du jour »');
  assert.match(doc.querySelector('#rgSheet').textContent, /Vent du jour/);
  assert.equal(doc.querySelectorAll('.rgwind').length, 3, 'une ligne par jour de la régate');
  const x = windText(r, '2026-11-07');
  assert.match(x, /Figé automatiquement à 09:00/);
  assert.match(x, /prévisions du 07\/11 08:50/);
  assert.match(x, /AROME HD 1,3 km/);
  assert.match(x, /2 relevés/);
  assert.match(x, /vent prévu au signal de 11:00 : 315° 15 nd/);
  assert.match(x, /sera scellé au signal de 11:00/);
  assert.match(x, /par Teiva le 07\/11/);
  assert.doesNotMatch(x, /scellé au signal de 11:00 \(/);
  assert.match(windText(r, '2026-11-08'), /Pas encore figé : l’app le fera seule le jour de la régate, à chaque ouverture, jusqu’au premier signal/);
});

test('vue : scellé au signal, figé après le départ, prévisions embarquées, un relevé, aucun relevé', () => {
  const sealed = regate({ races: [manche(1, '11:00')], frozen: { '2026-11-07': { ...frozen7, sealed: true, nObs: 1, snapshot: true } } });
  const x = windText(sealed, '2026-11-07', t('2026-11-07T11:00:00Z'));
  assert.match(x, /scellé au signal de 11:00/); assert.match(x, /1 relevé(?!s)/); assert.match(x, /prévisions embarquées du 07\/11 08:50/);
  const tard = regate({ races: [manche(1, '11:00')], frozen: { '2026-11-07': { ...frozen7, sealed: true, late: true, nObs: 0 } } });
  const y = windText(tard, '2026-11-07', t('2026-11-07T11:00:00Z'));
  assert.match(y, /figé après le départ \(app ouverte après le signal\)/); assert.match(y, /aucun relevé/);
  assert.doesNotMatch(y, /scellé au signal de/, 'une copie tardive ne prétend pas être celle du signal');
  // jour passé sans copie : on le dit
  assert.match(windText(regate({ dateStart: '2026-11-01', dateEnd: '2026-11-02' }), '2026-11-01'), /Pas de vent figé ce jour-là/);
  // app fermée au signal : la dernière copie est antérieure au signal
  const ferme = regate({ races: [manche(1, '11:00')], frozen: { '2026-11-07': frozen7 } });
  assert.match(windText(ferme, '2026-11-07', t('2026-11-08T08:00:00Z')), /dernière copie avant le signal de 11:00/);
});

test('vue : signal inconnu, copie jusqu’à la fin de la régate puis scellé à la fin de la régate', () => {
  const f = { ...frozen7, signal: 'inconnu', sealAt: t('2026-11-09T23:00:00Z'), windStart: null };
  const r = regate({ frozen: { '2026-11-07': f } });
  assert.match(windText(r, '2026-11-07'), /signal inconnu : copie jusqu’à la fin de la régate \(09\/11 à 24:00\)/);
  assert.doesNotMatch(windText(r, '2026-11-07'), /vent prévu au signal/);
  const apres = windText(r, '2026-11-07', t('2026-11-10T08:00:00Z'));
  assert.match(apres, /scellé à la fin de la régate \(signal inconnu\)/);
  assert.doesNotMatch(apres, /copie jusqu’à la fin/);
  const un = regate({ dateStart: '2026-10-19', dateEnd: '', frozen: { '2026-10-19': { ...f, sealAt: t('2026-10-19T22:00:00Z') } } });
  assert.match(windText(un, '2026-10-19', t('2026-10-19T13:00:00Z')), /signal inconnu.*19\/10 à 24:00/);
});

test('vue : l’auteur et les noms venus d’ailleurs sont échappés ; sans auteur : « — »', () => {
  const r = regate({ frozen: { '2026-11-07': { ...frozen7, by: '<img src=x onerror=alert(1)>', model: '<b>x</b>' } } });
  const doc = windDoc(r);
  assert.equal(doc.querySelectorAll('#rgSheet img').length, 0);
  assert.equal(doc.querySelectorAll('#rgSheet .rgwind b, #rgSheet .rgwind img').length, 0, 'ni l’auteur ni le modèle ne sont du HTML');
  assert.match(doc.querySelector('.rgwind[data-day="2026-11-07"]').textContent, /par <img src=x onerror=alert\(1\)>/);
  assert.match(windText(regate({ frozen: { '2026-11-07': { ...frozen7, by: null } } }), '2026-11-07'), /Figé automatiquement à 09:00 · —/);
});

// ───────────────────────── gardes statiques

test('garde : js/gel.js est pur (ni DOM, ni stockage, ni horloge) ; regstore ouvre rade-regates séparée de rade-traces', () => {
  const g = src('js/gel.js');
  for (const mot of ['document', 'localStorage', 'indexedDB', 'Date.now(', 'new Date()', 'fetch(']) assert.ok(!g.includes(mot), `js/gel.js ne doit pas contenir ${mot}`);
  const s = src('js/regstore.js');
  assert.match(s, /'rade-regates'/); assert.ok(!s.includes('rade-traces'), 'base séparée');
  assert.match(s, /export (async )?function putSlot|export const putSlot/); assert.match(s, /export (async )?function getSlot|export const getSlot/);
  assert.match(s, /indexedDB\.open\(DB, 1\)/, 'version 1 : aucune montée de version d’une base existante');
});

test('garde : freezeTick copie sans calcul, une copie à la fois, ne passe jamais par autoHeavy et ne précède pas l’interface utile', () => {
  const app = src('js/app.js');
  const body = bodyOf(app, 'freezeTick');
  assert.ok(body, 'freezeTick existe');
  assert.ok(!/autoHeavy|deferHeavy|runHeavy/.test(body), 'le gel n’est pas reporté pendant la séquence de départ (il copie, il ne calcule pas)');
  assert.match(body, /freezeAction\(/); assert.match(body, /setTimeout\(/, 'copie lancée hors du tour courant');
  assert.match(body, /freezeBusy/, 'une seule copie à la fois');
  assert.match(app, /putSlot\(/);
  assert.ok((app.match(/freezeTick\(/g) || []).length >= 5, 'définition + ouverture, téléchargement, analyse, raceTick');
  assert.match(bodyOf(app, 'raceTick'), /freezeTick\(/);
  assert.match(bodyOf(app, 'runAnalysis'), /freezeTick\(/);
  assert.match(bodyOf(app, 'refreshWeather'), /freezeTick\(/);
  const init = bodyOf(app, 'init'), ui = init.search(/performance\.mark\('rt:ui'\)/), gel = init.search(/freezeTick\(/);
  assert.ok(gel > ui && ui > 0, 'le gel vient après l’interface utile');
  assert.ok(!/\bawait\b[^\n]*freezeTick|freezeTick[^\n]*\bawait\b/.test(init), 'init() n’attend pas le gel');
  assert.match(app, /report\('gel'/, 'échec consigné, l’app reste utilisable');
});

// ───────────────────────── route conseillée figée (tâche 2)

let T, F;
before(async () => {
  T = await new Terrain().load('data/');
  F = new WindField(T);
  F.compute({ points: [{ x: 0, y: 0, dir: 315, spd: 15, gust: 20 }] }, { localEffects: 1 });          // vent constant 315° 15 nd, relief réel
});
// Même construction que runAnalysis (js/app.js), sans la 3D : bords du parcours, puis analyzeLeg sur chacun
function analyse(courseId = 5, cls = 'G', laps = 2, start = 11) {
  const course = COURSES.find((c) => c.id === courseId);
  const preset = LINE_PRESETS[course.line ? course.line : 'vignettes'] || LINE_PRESETS.vignettes, ctr = toXY(preset.lat, preset.lon), w = F.sample(ctr.x, ctr.y);
  const B = buildLegs(course, cls, { laps, windDir: w.dir, wlLengthNm: 0.8, line: { center: preset, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null } });
  const ctx = { terrain: T, forbidden: [], perf: 1, trend: 0 };
  const legs = []; let h = start;
  for (const leg of B.legs) { const a = analyzeLeg(leg, F, ctx); a.eta0 = h; h += a.time / 3600; a.eta1 = h; legs.push(a); }
  let ord = 0; legs.forEach((l) => { if (l.mark !== 'GATE' && l.mark !== 'FINISH') l.order = ++ord; });
  return { course, cls, legs, line: B.line, points: B.points, start: {}, total: h - start, dist: legs.reduce((x, l) => x + l.dist, 0) };
}
const REGL = { courseId: 5, cls: 'G', laps: 2, wlNm: 0.8, startTime: 11, day: '2026-10-18', linePreset: 'vignettes', lineLen: 0.12, lineMode: 'wind', lineBrg: 0, lineOverride: null, perf: 1, polar: 'ORC', model: 'meteofrance_arome_france_hd', sel: 1 };

test('stratégie compacte : parcours 5, classe G, 2 tours, vent 315° 15 nd sur le vrai terrain', () => {
  const a = analyse();
  const s = G.compactStrategy(a, REGL, { toLL });
  assert.equal(s.legs.length, a.legs.length, 'un bord par bord de l’analyse');
  assert.ok(s.legs.length >= 10, `parcours 5 en 2 tours : ${s.legs.length} bords`);
  assert.deepEqual(s.settings, REGL, 'les réglages qui ont servi à la calculer sont là');
  const dansLaCarte = ([lat, lon]) => lat > 43.0 && lat < 43.18 && lon > 5.8 && lon < 6.1;
  s.legs.forEach((l, i) => {
    assert.equal(l.name, a.legs[i].to.name); assert.equal(l.mark, a.legs[i].mark); assert.equal(l.time, Math.round(a.legs[i].time));
    assert.ok(dansLaCarte(l.to), `bord ${i + 1} : position en latitude / longitude`);
    const brut = a.legs[i].route?.path || [];
    assert.ok(l.path.every(dansLaCarte), `bord ${i + 1} : chemin en latitude / longitude`);
    if (brut.length > 6) { assert.ok(l.path.length < brut.length / 2, `bord ${i + 1} : chemin décimé (${l.path.length} sur ${brut.length})`); assert.ok(l.path.length >= 2); }
    assert.ok(l.advice.length >= 1 && l.advice.length <= 5); assert.equal(typeof l.type.label, 'string'); assert.ok(l.wind.dir >= 0 && l.wind.dir < 360 && l.wind.spd > 0);
  });
  assert.ok(dansLaCarte(s.line.cb) && dansLaCarte(s.line.pin), 'la ligne de départ aussi');
  assert.ok(!/"x":|"y":/.test(JSON.stringify(s)), 'jamais de x / y');
  assert.ok(Math.abs(s.total - a.total) < 0.001);
  const n = bytes(s);
  console.log(`# taille de la route conseillée figée (${s.legs.length} bords) : ${n} octets (limite ${G.MAX_STRATEGY_BYTES})`);
  assert.ok(n <= 12000, `moins de 12 Ko, vu ${n}`);
  assert.equal(G.MAX_STRATEGY_BYTES, 12000);
});

test('stratégie compacte : même trop riche, elle tient en 12 Ko (chemin décimé davantage, conseils raccourcis)', () => {
  const pt = (k) => ({ x: k * 3, y: k * 2 });
  const leg = (i) => ({ i, to: { name: `Marque ${i}`, x: i * 100, y: i * 50 }, mark: String(i), side: 'b', brg: 123.456, dist: 3600.7, time: 1100.4, eta0: 11, eta1: 11.3, type: { id: 'pres', label: 'Près', sail: 'Foc' }, wind: { dir: 315.4, spd: 15.26, gust: 20.1 }, advice: Array.from({ length: 10 }, (_, k) => `conseil ${k} ` + 'x'.repeat(500)), route: { path: Array.from({ length: 3000 }, (_, k) => pt(k)) } });
  const lourde = { course: {}, cls: 'G', legs: Array.from({ length: 15 }, (_, i) => leg(i)), line: { cb: pt(1), pin: pt(2) }, start: {}, total: 2.1, dist: 30000 };
  const s = G.compactStrategy(lourde, REGL, { toLL: (x, y) => ({ lat: 43.05 + y / 1e6, lon: 5.9 + x / 1e6 }) });
  assert.ok(bytes(s) <= 12000, `vu ${bytes(s)}`);
  assert.equal(s.legs.length, 15, 'aucun bord perdu');
});

test('source du vent : prévisions vivantes si le jour y figure, sinon le gel du jour, sinon rien', () => {
  const live = new Set(['2026-10-24', '2026-10-25']), gel = new Set(['2026-10-18']);
  assert.equal(G.windSourceKind({ day: '2026-10-25', liveDays: live, frozenDays: gel }), 'live');
  assert.equal(G.windSourceKind({ day: '2026-10-18', liveDays: live, frozenDays: gel }), 'gel');
  assert.equal(G.windSourceKind({ day: '2026-10-19', liveDays: live, frozenDays: gel }), 'aucun');
  assert.equal(G.windSourceKind({ day: '2026-10-24', liveDays: live, frozenDays: new Set(['2026-10-24']) }), 'live', 'le vivant d’abord : plus récent que la copie');
  assert.equal(G.windSourceKind({ day: '2026-10-18', liveDays: new Set(), frozenDays: new Set() }), 'aucun');
  assert.equal(G.windSourceKind({ day: '2026-10-18' }), 'aucun');
});

test('libellé du vent figé : « vent du jour figé le JJ/MM à HH:MM » (heure de Paris)', () => {
  assert.equal(G.frozenLabel({ at: t('2026-10-18T08:00:00Z') }), 'vent du jour figé le 18/10 à 10:00');
  assert.equal(G.frozenLabel({ at: t('2026-11-07T23:30:00Z') }), 'vent du jour figé le 08/11 à 00:30', 'jour de Paris, pas d’UTC');
});

test('décision : la route conseillée arrive après la première copie sans attendre 10 min ; copie tardive complétée une seule fois', () => {
  const r = regate({ races: [manche(1, '11:00')] });
  const base = { regatta: r, day: '2026-11-07', dataFetched: 1000 };
  const slot = { at: t('2026-11-07T07:00:00Z'), fetched: 1000, sealed: false, strategy: null };
  assert.equal(G.freezeAction({ ...base, now: t('2026-11-07T07:01:00Z'), slot, hasAnalysis: true }), 'gel', 'analyse faite, route pas encore copiée');
  assert.equal(G.freezeAction({ ...base, now: t('2026-11-07T07:01:00Z'), slot: { ...slot, strategy: { nLegs: 15 } }, hasAnalysis: true }), 'rien');
  assert.equal(G.freezeAction({ ...base, now: t('2026-11-07T07:01:00Z'), slot, hasAnalysis: false }), 'rien', 'sans analyse, rien à attendre');
  assert.equal(G.freezeAction({ ...base, now: t('2026-11-07T07:01:00Z'), slot: null, dataFetched: 0, hasAnalysis: true }), 'gel', 'une analyse suffit à justifier une copie');
  assert.equal(G.stratNeedsCopy({ slot: { sealed: true, late: true, strategy: null }, hasAnalysis: true }), true, 'copie tardive sans route : elle est ajoutée une fois');
  assert.equal(G.stratNeedsCopy({ slot: { sealed: true, late: false, strategy: null }, hasAnalysis: true }), false, 'scellée à l’heure : la route ne bouge plus');
  assert.equal(G.stratNeedsCopy({ slot: { sealed: true, late: true, strategy: { nLegs: 3 } }, hasAnalysis: true }), false);
  assert.equal(G.stratNeedsCopy({ slot: { sealed: true, late: true, strategy: null }, hasAnalysis: false }), false);
});

test('résumé avec route : réglages et détail des bords dans l’index, quelques Ko', () => {
  const a = analyse(), s = G.compactStrategy(a, REGL, { toLL });
  const reg = regate({ dateStart: '2026-10-18', dateEnd: '', races: [manche(1, '10:55', '2026-10-18')] });
  const f = G.freezeSummary({ action: 'gel', now: t('2026-10-18T08:00:00Z'), regatta: reg, day: '2026-10-18', data: WX, series: consensus(WX), model: 'x', strategy: s });
  assert.deepEqual({ ...f.strategy, legs: undefined }, { courseId: 5, cls: 'G', laps: 2, startTime: 11, nLegs: s.legs.length, total: s.total, dist: s.dist, legs: undefined });
  assert.equal(f.strategy.legs.length, s.legs.length);
  assert.deepEqual(Object.keys(f.strategy.legs[0]).sort(), ['advice', 'brg', 'dist', 'mark', 'name', 'side', 'time', 'type', 'windDir', 'windSpd'].sort());
  assert.ok(f.strategy.legs.every((l) => l.advice.length <= 140));
  const n = bytes(f);
  console.log(`# taille du résumé du gel avec le détail des bords : ${n} octets`);
  assert.ok(n < 6000, `vu ${n}`);
  assert.equal(G.freezeSummary({ action: 'gel', now: 1, regatta: reg, day: '2026-10-18', data: WX, series: [] }).strategy, undefined, 'sans route : pas de clé strategy');
});

const COURSES_UI = [{ id: 5, title: 'Parcours 5 — Grande Rade' }];
const FS = {
  courseId: 5, cls: 'G', laps: 2, startTime: 11 + 5 / 60, nLegs: 2, total: 2 + 5 / 60, dist: 21000,
  legs: [
    { mark: '7', name: '7 Cap <b>Sicié</b>', side: 't', brg: 112.4, dist: 3600, time: 1100, type: 'Près (louvoyage)', windDir: 315, windSpd: 15.2, advice: 'Côté DROIT favorisé : plus de pression à droite.' },
    { mark: 'FINISH', name: 'Arrivée', side: null, brg: 280, dist: 1852, time: 600, type: 'Largue sous spi', windDir: 310, windSpd: 14, advice: '' },
  ],
};
test('vue : la route conseillée figée (parcours, classe, tours, départ, bords, temps) et le détail des bords, sans requête', () => {
  const r = regate({ races: [manche(1, '11:00')], frozen: { '2026-11-07': { ...frozen7, strategy: FS } } });
  const doc = parseHTML(`<html><body>${sheetHTML(r, { now: NOW, courses: COURSES_UI })}</body></html>`).document;
  const jour = doc.querySelector('.rgwind[data-day="2026-11-07"]');
  const x = jour.textContent.replace(/\s+/g, ' ');
  assert.match(x, /Route conseillée figée/); assert.match(x, /Parcours 5 — Grande Rade/); assert.match(x, /classe G/); assert.match(x, /2 tours/);
  assert.match(x, /départ 11:05/); assert.match(x, /2 bords/); assert.match(x, /arrivée estimée en 2 h 05/);
  const det = jour.querySelector('details');
  assert.ok(det, 'le détail des bords s’ouvre sans requête (details)');
  const d = det.textContent.replace(/\s+/g, ' ');
  assert.match(d, /Détail des bords/);
  assert.match(d, /1 · 7 Cap <b>Sicié<\/b>/); assert.match(d, /tribord/); assert.match(d, /cap 112°/); assert.match(d, /1,9 Nq/); assert.match(d, /18 min/);
  assert.match(d, /Près \(louvoyage\)/); assert.match(d, /vent 315° 15 nd/); assert.match(d, /Côté DROIT favorisé/);
  assert.match(d, /Arrivée/); assert.match(d, /10 min/);
  assert.equal(jour.querySelectorAll('b, img, script').length, 0, 'le nom d’une marque est du texte');
  assert.equal(jour.querySelectorAll('[data-rgleg]').length, 2, 'une ligne par bord');
  // gel sans route : on le dit
  const sans = regate({ races: [manche(1, '11:00')], frozen: { '2026-11-07': frozen7 } });
  assert.match(windText(sans, '2026-11-07'), /Route conseillée : pas encore figée/);
  assert.equal(windDoc(sans).querySelector('details'), null);
});

test('garde : l’app fige la route et lit la source de vent d’une trace (analyse et débrief tardifs)', () => {
  const app = src('js/app.js');
  assert.ok((app.match(/compactStrategy\(/g) || []).length >= 1); assert.ok((app.match(/windSourceKind\(/g) || []).length >= 1);
  assert.match(bodyOf(app, 'refreshObs'), /residualsFor\(/, 'refreshObs et le vent figé partagent le même calcul de résidus');
  assert.equal((app.match(/F\.compute\(\{ points: pts \}, \{ localEffects: S\.localFx \}\)/g) || []).length, 1, 'un seul calcul de résidus');
  assert.match(bodyOf(app, 'showTrace'), /windSource\(/); assert.match(bodyOf(app, 'showTrace'), /trackWindAt\(day, /);
  assert.match(bodyOf(app, 'runDebrief'), /windSource\(|traceView/); assert.match(bodyOf(app, 'runDebrief'), /forecastIn\(/);
  assert.match(bodyOf(app, 'renderTraceDetail'), /src\.label|vent figé|trWind/, 'le détail de la trace dit d’où vient le vent');
  assert.match(bodyOf(app, 'freezeWrite'), /compactStrategy\(/); assert.match(bodyOf(app, 'freezeWrite'), /'strat'/);
});

test('décision : le signal change après la première copie (manche ajoutée, heure corrigée) → copie à jour tout de suite, sans attendre 10 min', () => {
  const sans = regate({ dateStart: '2026-11-07', dateEnd: '' });                      // aucune manche : signal inconnu, sceau à minuit
  const avec = regate({ dateStart: '2026-11-07', dateEnd: '', races: [manche(1, '11:00')] });   // signal 10:00Z
  const at = (hhmm) => t(`2026-11-07T${hhmm}:00Z`);
  const base = { day: '2026-11-07', dataFetched: 1000, hasAnalysis: false };
  const sceau0 = G.sealAt(sans, '2026-11-07'), sceau1 = G.sealAt(avec, '2026-11-07');
  assert.equal(sceau0.signal, 'inconnu'); assert.equal(sceau1.signal, 'manche');
  const slot = { at: at('07:00'), fetched: 1000, sealed: false, signal: sceau0.signal, sealAt: sceau0.at };
  assert.equal(G.freezeAction({ ...base, regatta: sans, now: at('07:01'), slot }), 'rien', 'rien n’a changé : on attend les 10 min');
  assert.equal(G.freezeAction({ ...base, regatta: avec, now: at('07:01'), slot }), 'gel', 'la manche donne un signal : copie à jour sans attendre');
  assert.equal(G.freezeAction({ ...base, regatta: avec, now: at('07:01'), slot: { ...slot, signal: sceau1.signal, sealAt: sceau1.at } }), 'rien', 'une fois la copie refaite, plus de boucle');
  assert.equal(G.freezeAction({ ...base, regatta: avec, now: at('07:01'), slot: { ...slot, sealed: true } }), 'rien', 'scellé : jamais rouvert');
  const corrigee = regate({ dateStart: '2026-11-07', dateEnd: '', races: [manche(1, '11:30')] });   // heure du signal corrigée : 10:30Z
  assert.equal(G.freezeAction({ ...base, regatta: corrigee, now: at('07:01'), slot: { ...slot, signal: sceau1.signal, sealAt: sceau1.at } }), 'gel', 'heure du signal corrigée');
});
