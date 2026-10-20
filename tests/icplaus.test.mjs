// Vraisemblance des valeurs lues dans les IC (D-02, REG-03) : seuils de date, d’heure, de canal VHF et de position, sur le vrai terrain (data/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { Terrain, toXY } from '../js/geo.js';
import { MARKS } from '../js/courses.js';
import * as P from '../js/icplaus.js';

const t = (s) => Date.parse(s);
const NOW = t('2026-10-19T08:30:00Z');                      // lundi 19/10/2026, 10 h 30 à Paris
const niveau = (r) => r?.level;

test('checkDate : le 30 février est impossible, au-delà de 400 jours c’est inhabituel, sinon plausible', () => {
  assert.equal(niveau(P.checkDate('2026-02-30', { now: NOW })), 'bad');
  assert.equal(niveau(P.checkDate('', { now: NOW })), 'bad');
  assert.equal(niveau(P.checkDate('18/10/2026', { now: NOW })), 'bad');
  assert.equal(niveau(P.checkDate('2027-12-01', { now: NOW })), 'warn');
  assert.equal(niveau(P.checkDate('2026-11-07', { now: NOW })), 'ok');
  assert.equal(niveau(P.checkDate('2026-10-18', { now: NOW })), 'ok', 'les IC SNPM, la veille');
  assert.equal(P.checkDate('2026-11-07', { now: NOW }).msg, '');
  assert.match(P.checkDate('2027-12-01', { now: NOW }).msg, /lointaine/);
  assert.equal(niveau(P.checkDate('2027-11-23', { now: NOW })), 'ok', '400 jours exactement');
  assert.equal(niveau(P.checkDate('2027-11-24', { now: NOW })), 'warn', '401 jours');
  assert.equal(niveau(P.checkDate('2025-09-01', { now: NOW })), 'warn', 'une date passée lointaine aussi');
});

test('checkDate : le jour de référence est le jour de Paris, pas celui du fuseau du téléphone', () => {
  // 18/10 à 22 h 30 UTC = 00 h 30 le 19/10 à Paris : 400 jours avant le 23/11/2027 ; une heure plus tôt on est encore le 18 (401 jours)
  assert.equal(niveau(P.checkDate('2027-11-23', { now: t('2026-10-18T22:30:00Z') })), 'ok');
  assert.equal(niveau(P.checkDate('2027-11-23', { now: t('2026-10-18T21:30:00Z') })), 'warn');
});

test('checkDateEnd : réelle, postérieure au premier jour, et pas plus de 6 jours après lui', () => {
  assert.equal(niveau(P.checkDateEnd('2026-11-07', '2026-11-20')), 'warn');
  assert.match(P.checkDateEnd('2026-11-07', '2026-11-20').msg, /6 jours/);
  assert.equal(niveau(P.checkDateEnd('2026-11-07', '2026-11-09')), 'ok');
  assert.equal(niveau(P.checkDateEnd('2026-11-07', '2026-11-13')), 'ok', '6 jours après');
  assert.equal(niveau(P.checkDateEnd('2026-11-07', '2026-11-14')), 'warn', '7 jours après');
  assert.equal(niveau(P.checkDateEnd('2026-11-07', '2026-11-07')), 'warn', 'égal au premier jour : ignoré');
  assert.equal(niveau(P.checkDateEnd('2026-11-07', '2026-11-06')), 'warn', 'antérieur : ignoré');
  assert.match(P.checkDateEnd('2026-11-07', '2026-11-06').msg, /ignoré/);
  assert.equal(niveau(P.checkDateEnd('2026-11-07', '2026-02-30')), 'bad');
  assert.equal(niveau(P.checkDateEnd('', '2026-11-09')), 'ok', 'premier jour inconnu : rien à comparer');
});

test('checkTime : 25:00 impossible, 03:30 inhabituelle, 10:55 plausible, bornes 06:00 et 21:00 comprises', () => {
  for (const x of ['25:00', '24:00', '10:60', '3:30', '10h55', '', '10:5']) assert.equal(niveau(P.checkTime(x)), 'bad', x);
  assert.equal(niveau(P.checkTime('03:30')), 'warn');
  assert.match(P.checkTime('03:30').msg, /inhabituelle/);
  for (const x of ['10:55', '06:00', '21:00', '16:00']) assert.equal(niveau(P.checkTime(x)), 'ok', x);
  assert.equal(niveau(P.checkTime('21:01')), 'warn');
  assert.equal(niveau(P.checkTime('05:59')), 'warn');
});

test('checkSeq : limite d’arrivée avant le premier signal = inhabituel ; rien à comparer si une heure est invalide', () => {
  assert.equal(niveau(P.checkSeq('10:55', '09:00')), 'warn');
  assert.match(P.checkSeq('10:55', '09:00').msg, /avant le premier signal/);
  assert.equal(niveau(P.checkSeq('10:55', '16:00')), 'ok');
  assert.equal(niveau(P.checkSeq('', '09:00')), 'ok');
  assert.equal(niveau(P.checkSeq('10:55', '25:00')), 'ok');
});

test('checkVhf : 72 plausible, 16 et 45 en alerte, 99 et la chaîne « 72 » impossibles', () => {
  assert.equal(niveau(P.checkVhf(72)), 'ok');
  assert.equal(niveau(P.checkVhf(16)), 'warn'); assert.match(P.checkVhf(16).msg, /détresse/);
  assert.equal(niveau(P.checkVhf(45)), 'warn'); assert.match(P.checkVhf(45).msg, /table internationale/);
  for (const n of [1, 28, 60, 69, 88]) assert.equal(niveau(P.checkVhf(n)), 'ok', String(n));
  for (const n of [29, 59]) assert.equal(niveau(P.checkVhf(n)), 'warn', String(n));
  for (const n of [99, 89, 0, -3, 72.5, NaN, '72', null, undefined]) assert.equal(niveau(P.checkVhf(n)), 'bad', String(n));
});

test('checkPos : Grande Jetée dans la carte, hors carte impossible, position illisible impossible', () => {
  assert.equal(niveau(P.checkPos(43.097417, 5.93415)), 'ok');
  assert.equal(niveau(P.checkPos(43.5, 5.9)), 'bad');
  assert.equal(niveau(P.checkPos(43.0, 7.2)), 'bad');
  assert.match(P.checkPos(43.5, 5.9).msg, /hors de la carte/);
  assert.equal(niveau(P.checkPos(42.99, 5.95)), 'bad'); assert.equal(niveau(P.checkPos(43.19, 5.95)), 'bad');
  assert.equal(niveau(P.checkPos(43.1, 5.79)), 'bad'); assert.equal(niveau(P.checkPos(43.1, 6.11)), 'bad');
  assert.equal(niveau(P.checkPos(NaN, 5.9)), 'bad'); assert.equal(niveau(P.checkPos('43.1', 5.9)), 'bad');
  assert.equal(niveau(P.checkPos(43.1, 5.95, { isLand: () => true })), 'warn', 'sur terre selon isLand');
  assert.equal(niveau(P.checkPos(43.1, 5.95, { isLand: () => false })), 'ok');
  assert.equal(niveau(P.checkPos(43.5, 5.9, { isLand: () => true })), 'bad', 'hors carte l’emporte sur « sur terre »');
});

test('les bornes de la carte sont celles de data/meta.json', () => {
  const meta = JSON.parse(readFileSync(ROOT + 'data/meta.json', 'utf8'));
  assert.deepEqual({ ...P.BOUNDS }, { south: meta.south, north: meta.north, west: meta.west, east: meta.east });
});

test('checkPos sur le vrai terrain : un point de la ville de Toulon est sur terre, les 11 marques CVAT sont en mer', async () => {
  const T = await new Terrain().load('data/');
  const land = (x, y) => T.isLand(x, y);
  const ville = P.checkPos(43.1242, 5.928, { isLand: land });
  assert.equal(niveau(ville), 'warn'); assert.match(ville.msg, /terre/);
  assert.equal(niveau(P.checkPos(43.097417, 5.93415, { isLand: land })), 'ok');
  const marques = structuredClone(MARKS), cles = Object.keys(marques);
  assert.equal(cles.length, 11);
  for (const k of cles) assert.equal(niveau(P.checkPos(marques[k].lat, marques[k].lon, { isLand: land })), 'ok', `marque ${k} (${marques[k].name})`);
  // le terrain et toXY donnent bien la même chose que la carte
  const p = toXY(43.1242, 5.928); assert.equal(T.isLand(p.x, p.y), true);
});

test('chaque contrôle non plausible a un message court en français ; plausible : message vide', () => {
  const cas = [P.checkDate('2026-02-30', { now: NOW }), P.checkDate('2027-12-01', { now: NOW }), P.checkDateEnd('2026-11-07', '2026-11-20'), P.checkTime('25:00'), P.checkTime('03:30'),
    P.checkSeq('10:55', '09:00'), P.checkVhf(99), P.checkVhf(16), P.checkVhf(45), P.checkPos(43.5, 5.9)];
  for (const r of cas) { assert.ok(['warn', 'bad'].includes(r.level)); assert.ok(r.msg.length > 5 && r.msg.length <= 80, r.msg); }
  for (const r of [P.checkDate('2026-11-07', { now: NOW }), P.checkTime('10:55'), P.checkVhf(72), P.checkSeq('10:55', '16:00')]) assert.deepEqual({ ...r }, { level: 'ok', msg: '' });
});

test('module pur : ni DOM ni stockage', () => {
  const src = readFileSync(ROOT + 'js/icplaus.js', 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\bdocument\b|\bwindow\b|localStorage|\bfetch\(/.test(src));
});
