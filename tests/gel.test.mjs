// Gel automatique du vent du jour (ARCH-02) : instant du sceau (heure d’hiver et d’été, signal inconnu), décisions, découpe des prévisions
// (25 heures, mêmes calculs que sur l’original), résumé, section « Vent du jour » de la fiche (linkedom) et gardes statiques du câblage.
// Fonctions lues par espace de noms (G.) : un module ou une fonction absents font échouer le test visé, pas le chargement du fichier.
// Aucun code d’accès ni aucune empreinte ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import * as G from '../js/gel.js';
import { sheetHTML } from '../js/regview.js';
import { consensus } from '../js/weather.js';
import { modelPoints, scoreModels } from '../js/obs.js';

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
