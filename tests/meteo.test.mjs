// Prévisions absentes pour le jour affiché (v41) : un échec réseau à l’ouverture laissait l’instantané embarqué du 17/10, qui ne couvre pas le jour ;
// la carte peignait alors le vent manuel par défaut (315° 15 nd) sous l’étiquette « AROME HD 1,3 km » et le briefing perdait sa courbe sans rien dire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { withRetry, coversDay } from '../js/weather.js';
import { modelPoints } from '../js/obs.js';

const snap = JSON.parse(readFileSync(ROOT + 'data/wx-snapshot.json', 'utf8'));
const app = readFileSync(ROOT + 'js/app.js', 'utf8');
const nap = async () => {};

test('coversDay : l’instantané embarqué ne couvre que ses trois jours', () => {
  const j0 = snap.multi.hourly.time[0].slice(0, 10);
  assert.equal(coversDay(snap, j0), true);
  assert.equal(coversDay(snap, '2026-11-08'), false);
  assert.equal(coversDay(null, j0), false);
  assert.equal(coversDay({ multi: {} }, j0), false);
});

test('jour non couvert : aucun point de modèle (cause du vent manuel affiché)', () => {
  assert.equal(modelPoints(snap, '2026-11-08', 11, 'meteofrance_arome_france_hd'), null);
  const j0 = snap.multi.hourly.time[0].slice(0, 10);
  assert.ok(modelPoints(snap, j0, 11, 'meteofrance_arome_france_hd')?.length > 0);
});

test('withRetry : un second essai après coupure ou 429/5xx ; jamais après un refus 4xx ni un délai dépassé', async () => {
  let n = 0;
  assert.equal(await withRetry(async () => { if (++n === 1) throw new Error('Failed to fetch'); return 'ok'; }, { sleep: nap }), 'ok');
  assert.equal(n, 2);
  n = 0;
  assert.equal(await withRetry(async () => { if (++n === 1) throw new Error('HTTP 429'); return 'ok'; }, { sleep: nap }), 'ok');
  n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new Error('HTTP 400'); }, { sleep: nap }), /HTTP 400/);
  assert.equal(n, 1);
  n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new Error('délai dépassé (10 s)'); }, { sleep: nap }), /délai/);
  assert.equal(n, 1, 'réseau muet : repli à 10 s, sans second essai');
  n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new Error('HTTP 503'); }, { sleep: nap }), /503/);
  assert.equal(n, 2, 'deux essais au plus');
});

test('fetchAll : prévisions multi-modèles et grille AROME réessayées', () => {
  const w = readFileSync(ROOT + 'js/weather.js', 'utf8');
  assert.equal((w.match(/withRetry\(\(\) => getJSON\(`\$\{OM\}/g) || []).length, 2);
});

test('app : un vent sans prévision n’est jamais présenté sous le nom d’un modèle', () => {
  assert.match(app, /return \{ points: \[\{ x: 0, y: 0, \.\.\.S\.manual \}\], missing: true \};/, 'baseAt marque le repli sur le vent manuel');
  assert.match(app, /manuel, sans prévision/, 'badge de la carte');
  assert.doesNotMatch(app, /S\.src === 'forecast' && data \? ' · ' \+ modelLabel\(selectedModel\(\)\)/, 'ancien badge : nom du modèle même sans prévision');
  assert.match(app, /!coversDay\(data, S\.day\)\) html \+= `<div class="notice" id="noWx">/, 'avertissement du briefing');
});
