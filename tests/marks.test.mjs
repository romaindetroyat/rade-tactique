// Bouées à confirmer (JUST-01, JUST-02) : signalement, saisie de coordonnées, recalages mémorisés.
// Les recalages ne sont JAMAIS appliqués au vrai MARKS dans un test (Pitfall 11, T-02-16) : copies structuredClone seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { MARKS } from '../js/courses.js';
import {
  OV_KEY, MAX_MOVE_M, DOUBT, parseCoord, parseLatLon, loadOverrides, saveOverride, clearOverride, srcLabel, applyOverrides, restoreMark, sharedMarks, remoteMarkChanges,
} from '../js/marks.js';

const AVANT = JSON.stringify(MARKS);
const mem = (init = {}) => { const d = { ...init }; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, d }; };

test('DOUBT : vrai pour GR1 (3) et Carqueiranne (11) seulement, sur le vrai MARKS (D-01)', () => {
  const doute = Object.keys(MARKS).filter((k) => DOUBT(MARKS[k]));
  assert.deepEqual(doute, ['3', '11']);
  assert.equal(DOUBT(undefined), false);
});

test('la marque 1 saisie « 43°05.845N 005°56.049E » redonne exactement sa position enregistrée', () => {
  assert.deepEqual(parseLatLon('43°05.845N 005°56.049E'), { lat: 43.097417, lon: 5.93415 });
  assert.equal(MARKS[1].lat, 43.097417);
  assert.equal(MARKS[1].lon, 5.93415);
});

test('formats voisins acceptés : virgule décimale, hémisphère devant, ordre inversé, décimal pur, secondes', () => {
  const attendu = { lat: 43.097417, lon: 5.93415 };
  for (const txt of ['43°05,845\' N, 5°56,049\' E', 'N 43°05.845 E 005°56.049', '5°56.049E 43°05.845N']) {
    assert.deepEqual(parseLatLon(txt), attendu, txt);
  }
  const dec = parseLatLon('43,0974 ; 5,9342');
  assert.deepEqual(dec, { lat: 43.0974, lon: 5.9342 });
  const dms = parseLatLon('43°05\'50.7"N 5°56\'02.9"E');
  assert.ok(Math.abs(dms.lat - 43.097417) < 1e-4 && Math.abs(dms.lon - 5.93414) < 1e-4, JSON.stringify(dms));
});

test('refus : hors de la rade, une seule valeur, minutes de 60 ou plus, texte vide (T-02-14)', () => {
  for (const txt of ['48°51.400N 002°21.100E', '43°05.845N', '43°65.845N 005°56.049E', '', 'abc', '43°05.845S 005°56.049E']) {
    const r = parseLatLon(txt);
    assert.ok(r.error, `« ${txt} » devrait être refusé`);
    assert.equal(r.lat, undefined);
  }
  assert.match(parseLatLon('48°51.400N 002°21.100E').error, /hors de la rade/i);
  assert.match(parseLatLon('43°05.845N').error, /Deux coordonnées/);
  assert.equal(parseCoord(null).length, 0);
});

test('le plafond de déplacement sans confirmation est de 2 Nq', () => {
  assert.equal(MAX_MOVE_M, 3704);
});

test('applyOverrides sur une copie : source « saisie du 19/10 », DOUBT devenu faux, position d’origine conservée', () => {
  const copie = structuredClone(MARKS);
  const t = Date.parse('2026-10-19T10:00:00Z');
  const ov = { lat: 43.0905, lon: 5.9587, src: 'saisie', t };
  assert.deepEqual(applyOverrides(copie, { 3: ov }), ['3']);
  assert.equal(copie[3].lat, 43.0905);
  assert.equal(copie[3].lon, 5.9587);
  assert.equal(copie[3].src, 'saisie du 19/10');
  assert.equal(srcLabel({ src: 'trace', t: Date.parse('2026-10-18T12:00:00Z') }), 'trace du 18/10');
  assert.equal(DOUBT(copie[3]), false, 'plus signalée une fois recalée (D-03)');
  assert.deepEqual(copie[3].base, { lat: 43.09, lon: 5.958667, src: 'approx' });
  assert.deepEqual(copie[3].ov, { src: 'saisie', t });
  assert.equal(MARKS[3].src, 'approx', 'le vrai MARKS n’a pas bougé');
});

test('applyOverrides ignore un numéro inconnu, une position non finie et un recalage mal formé', () => {
  const copie = structuredClone(MARKS);
  const t = Date.now();
  const ap = applyOverrides(copie, {
    99: { lat: 43.1, lon: 5.9, src: 'saisie', t },
    3: { lat: NaN, lon: 5.9, src: 'saisie', t },
    11: { lat: 43.08, lon: 'x', src: 'saisie', t },
    4: null,
    5: { lat: 43.07, lon: 5.96, src: 'saisie' },
  });
  assert.deepEqual(ap, []);
  assert.equal(JSON.stringify(copie), AVANT);
  assert.deepEqual(applyOverrides(copie, undefined), []);
});

test('un second recalage garde la toute première position d’origine ; restoreMark la rétablit et DOUBT redevient vrai', () => {
  const copie = structuredClone(MARKS);
  const t = Date.parse('2026-10-19T10:00:00Z');
  applyOverrides(copie, { 3: { lat: 43.0905, lon: 5.9587, src: 'saisie', t } });
  applyOverrides(copie, { 3: { lat: 43.0907, lon: 5.9589, src: 'trace', t } });
  assert.equal(copie[3].base.src, 'approx');
  assert.equal(copie[3].src, 'trace du 19/10');
  assert.equal(restoreMark(copie, 3), true);
  assert.deepEqual(copie[3], MARKS[3]);
  assert.equal(DOUBT(copie[3]), true);
  assert.equal('base' in copie[3] || 'ov' in copie[3], false);
  assert.equal(restoreMark(copie, 3), false, 'rien à rétablir deux fois');
});

test('stockage : aller-retour, stockage illisible → {}, quota dépassé → false sans exception', () => {
  const s = mem();
  const ov = { lat: 43.08, lon: 6.07, src: 'saisie', t: 1 };
  assert.equal(saveOverride(s, 11, ov), true);
  assert.deepEqual(loadOverrides(s), { 11: ov });
  assert.equal(clearOverride(s, 11), true);
  assert.deepEqual(loadOverrides(s), {});
  assert.deepEqual(loadOverrides(mem({ [OV_KEY]: '{pas du json' })), {});
  assert.deepEqual(loadOverrides(mem({ [OV_KEY]: '[1,2]' })), {});
  assert.deepEqual(loadOverrides(mem({ [OV_KEY]: 'null' })), {});
  assert.deepEqual(loadOverrides({ getItem() { throw new Error('refusé'); } }), {});
  const plein = { getItem: () => null, setItem() { throw new DOMException('quota', 'QuotaExceededError'); } };
  assert.equal(saveOverride(plein, 3, ov), false);
  assert.equal(clearOverride(plein, 3), false);
  assert.equal(OV_KEY, 'rade.marks.v1');
});

test('garde statique : seul js/app.js appelle applyOverrides(, jamais un module de calcul (T-02-16)', () => {
  const appelants = readdirSync(ROOT + 'js').filter((f) => f.endsWith('.js') && f !== 'marks.js')
    .filter((f) => /applyOverrides\(/.test(readFileSync(ROOT + 'js/' + f, 'utf8')));
  assert.deepEqual(appelants, ['app.js']);
  assert.match(readFileSync(ROOT + 'js/app.js', 'utf8'), /applyOverrides\(MARKS, loadOverrides/);
});

test('le signalement est câblé : carte (« n ? »), mode départ (« Marque n ? »), parcours, liste En course', () => {
  const src = (f) => readFileSync(ROOT + 'js/' + f, 'utf8');
  assert.match(src('scene3d.js'), /m\.doubt \? txt0 \+ ' \?'/);
  assert.match(src('scene3d.js'), /à confirmer/);
  assert.match(src('startmode.js'), /Marque \$\{m\.mk\.name\}\$\{m\.mk\.doubt \? ' \?' : ''\}/);
  assert.match(src('startmode.js'), /position à confirmer/);
  const app = src('app.js');
  assert.match(app, /doubt: DOUBT\(m\)/);
  assert.match(app, /position à confirmer<\/span>/);
  assert.match(app, /\(à confirmer\)/);
  assert.match(app, /doubt: DOUBT\(MARKS\[l\.mark\]\)/);
});

test('sharedMarks : recalages tels quels, remise à l’origine { del, t }, le plus récent des deux l’emporte, clés non numériques écartées', () => {
  const ov = { 3: { lat: 43.09, lon: 5.95, src: 'saisie', t: 100, base: 'x' }, 11: { lat: 43.08, lon: 6.07, src: 'trace', t: 300 }, X1: { lat: 43, lon: 5.9, src: 'saisie', t: 1 }, 4: { lat: NaN, lon: 5.9, src: 'saisie', t: 1 } };
  const r = sharedMarks(ov, { 3: 200, 11: 250, 5: 400, __proto__: 5, abc: 9 });
  assert.deepEqual(r, { 3: { del: true, t: 200 }, 11: { lat: 43.08, lon: 6.07, src: 'trace', t: 300 }, 5: { del: true, t: 400 } });
  assert.deepEqual(sharedMarks(undefined, undefined), {});
  assert.deepEqual(sharedMarks({ 3: ov[3] }, {}), { 3: { lat: 43.09, lon: 5.95, src: 'saisie', t: 100 } }, 'seuls les champs du partage');
});

test('remoteMarkChanges : recalage plus récent ou différent → put (avec l’auteur) ; identique ou plus ancien que le local → rien', () => {
  const loc = { 3: { lat: 43.09, lon: 5.95, src: 'saisie', t: 100 } };
  const nouv = { lat: 43.0912, lon: 5.96, src: 'trace', t: 200, by: 'Teiva' };
  assert.deepEqual(remoteMarkChanges({ 3: nouv }, loc, {}), { put: [['3', nouv]], del: [], ack: [], by: { 3: 'Teiva' } });
  assert.deepEqual(remoteMarkChanges({ 3: { ...loc[3], by: 'Teiva' } }, loc, {}).put, [], 'identique');
  assert.deepEqual(remoteMarkChanges({ 3: { ...nouv, t: 50 } }, loc, {}).put, [], 'plus ancien que le local : le local part au prochain envoi');
  assert.deepEqual(remoteMarkChanges({ 11: nouv }, {}, {}).put, [['11', nouv]], 'bouée sans recalage local');
  assert.deepEqual(remoteMarkChanges({}, loc, {}), { put: [], del: [], ack: [], by: {} });
  assert.deepEqual(remoteMarkChanges(undefined, undefined, undefined), { put: [], del: [], ack: [], by: {} });
});

test('remoteMarkChanges : remise à l’origine plus récente → del ; plus ancienne que le recalage local → rien ; couvrant ma remise → ack', () => {
  const loc = { 3: { lat: 43.09, lon: 5.95, src: 'saisie', t: 100 } };
  assert.deepEqual(remoteMarkChanges({ 3: { del: true, t: 200, by: 'Thibaud' } }, loc, {}), { put: [], del: ['3'], ack: [], by: { 3: 'Thibaud' } });
  assert.deepEqual(remoteMarkChanges({ 3: { del: true, t: 50, by: 'Thibaud' } }, loc, {}).del, []);
  assert.deepEqual(remoteMarkChanges({ 3: { del: true, t: 200, by: 'Teiva' } }, {}, { 3: 200 }), { put: [], del: [], ack: ['3'], by: {} }, 'ma propre remise revenue : acquittée');
  assert.deepEqual(remoteMarkChanges({ 3: { del: true, t: 200, by: 'Teiva' } }, {}, { 3: 300 }).ack, [], 'ma remise est plus récente : elle part encore');
  const plusRecent = { lat: 43.0912, lon: 5.96, src: 'saisie', t: 400, by: 'Teiva' };
  const r = remoteMarkChanges({ 3: plusRecent }, {}, { 3: 300 });
  assert.deepEqual([r.put.length, r.ack], [1, ['3']], 'un recalage plus récent que ma remise l’emporte et l’acquitte');
  assert.deepEqual(remoteMarkChanges({ 3: plusRecent }, {}, { 3: 500 }).put, [], 'ma remise plus récente que le recalage reçu : rien à appliquer');
});

test('remoteMarkChanges : clés non numériques ou dangereuses, positions non finies, hors de la rade, dates mal formées → ignorées (T-04-18)', () => {
  const ok = { lat: 43.09, lon: 5.95, src: 'saisie', t: 1 };
  const mauvais = JSON.parse('{"__proto__":{"lat":43.09,"lon":5.95,"t":1},"constructor":{"lat":43.09,"lon":5.95,"t":1},"X1":{"lat":43.09,"lon":5.95,"t":1},"3":{"lat":null,"lon":5.95,"t":1},"4":{"lat":"43.09","lon":5.95,"t":1},"5":{"lat":48.85,"lon":2.35,"t":1},"6":{"lat":43.09,"lon":5.95},"7":null,"8":42}');
  assert.deepEqual(remoteMarkChanges({ ...mauvais, 9: ok }, {}, {}).put.map(([k]) => k), ['9']);
  assert.equal(remoteMarkChanges({ 9: { ...ok, src: '<img onerror=alert(1)>' } }, {}, {}).put[0][1].src, 'saisie', 'source ramenée à trace | saisie');
});

test('à la fin, le vrai MARKS est identique à sa copie prise au début (Pitfall 11)', () => {
  assert.equal(JSON.stringify(MARKS), AVANT);
});
