// Débrief d’une course en banane : la banane se reconstruit (réglages, centre de la ligne, axe du vent ajusté sur la trace ou enregistré),
// ses passages (B, C, porte = bouée prise, arrivée décalée) sont retrouvés, le questionnaire la propose, l’analyse nomme ses bords, et le
// tableau bord par bord d’une trace (analyzeTrack) la découpe. Les débriefs du cahier restent ceux d’avant. Aucun code d’accès ici.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import { MARKS, COURSES, LINE_PRESETS } from '../js/courses.js';
import { toXY, toLL, distXY, fromBearing, norm180 } from '../js/geo.js';
import { boatSpeed } from '../js/polar.js';
import { analyzeTrack } from '../js/track.js';
import { BANANE_ID } from '../js/banane.js';
import * as D from '../js/debrief.js';

const MARKS_AVANT = JSON.stringify(MARKS), COURSES_AVANT = JSON.stringify(COURSES);
after(() => {
  assert.equal(JSON.stringify(MARKS), MARKS_AVANT, 'MARKS réel modifié par un test');
  assert.equal(JSON.stringify(COURSES), COURSES_AVANT, 'COURSES réel modifié par un test');
});

const GR = LINE_PRESETS.grandrade, C = { lat: GR.lat, lon: GR.lon }, CXY = toXY(C.lat, C.lon);
const T0 = Date.parse('2026-11-07T10:00:00Z');
// Trace au format enregistré ([t, lat, lon, sog, cog]) le long d’une ligne brisée : un point tous les 10 m, toutes les 3 s
function trace(wps, t0 = T0) {
  const pts = []; let t = t0;
  for (let k = 1; k < wps.length; k++) {
    const a = wps[k - 1], b = wps[k], n = Math.max(1, Math.round(distXY(a, b) / 10));
    for (let i = k === 1 ? 0 : 1; i <= n; i++) { const ll = toLL(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n); pts.push([t, +ll.lat.toFixed(6), +ll.lon.toFixed(6), 6, null]); t += 3000; }
  }
  return { id: 'tr-test', name: 'Banane test', start: pts[0][0], course: null, pts };
}
// Course d’une banane réelle : boucles d’avant-départ près de la ligne, puis chaque bouée du parcours (porte : bouée `porte`), retour au port
function courue(B, porte = 'd') {
  const wps = [fromBearing(CXY, 120, 500), fromBearing(CXY, 200, 160), fromBearing(CXY, 20, 160), fromBearing(CXY, 120, 300), CXY];
  for (const l of B.legs) wps.push(l.gate ? l.gate[porte] : l.to);
  wps.push(fromBearing(wps.at(-1), 120, 700));
  return trace(wps);
}
const opts = (o = {}) => ({ ban: { nm: 0.8 }, cls: 'G', c: C, dir: 300, fit: false, prefer: false, from: 'de l’app', ...o });

test('detectBanane : axe ajusté sur la trace à partir d’un vent du moment décalé de 25°, nombre de tours retrouvé, suite B → C → porte (bouée prise) → … → arrivée', () => {
  const vraie = D.bananeLegs({ ban: { nm: 0.8 }, c: C, dir: 300, laps: 2 });
  const tr = courue(vraie, 'd');
  const det = D.detect(tr, { banane: opts({ dir: 325, fit: true }) });
  assert.equal(det.kind, 'ban');
  assert.ok(Math.abs(norm180(det.ban.dir - 300)) <= 1, `axe retrouvé : ${det.ban.dir}°`);
  assert.equal(det.ban.laps, 2);
  assert.equal(det.ban.fitted, true);
  assert.deepEqual(det.mc.hit.map((h) => h.k), ['B', 'C', 'PD', 'B', 'C', 'A']);
  assert.deepEqual(det.mc.hit[2].gate, ['PG', 'PD'], 'porte : bouée droite prise, la gauche n’est pas comptée');
  assert.equal(det.mc.reduced, false);
  assert.equal(det.mc.c.id, BANANE_ID);
  assert.equal(det.pass, det.ban.pass, 'les passages montrés sont ceux de la banane');
  assert.ok(det.tStart < det.mc.hit[0].t);
  // le cahier est gardé à côté (le questionnaire peut y revenir)
  assert.ok(det.cahier && 'pass' in det.cahier && 'mc' in det.cahier);
});

test('detectBanane : axe enregistré avec la trace pris tel quel ; arrivée « sous le vent, décalée » et porte gauche retrouvées', () => {
  const ban = { nm: 0.6, fin: 'sousvent' };
  const vraie = D.bananeLegs({ ban, c: C, dir: 135, laps: 3 });
  const det = D.detect(courue(vraie, 'g'), { banane: opts({ ban, dir: 135, prefer: true, from: 'enregistrés avec la trace' }) });
  assert.equal(det.ban.dir, 135);
  assert.equal(det.ban.fitted, false);
  assert.equal(det.ban.laps, 3);
  assert.deepEqual(det.mc.hit.map((h) => h.k), ['B', 'C', 'PG', 'B', 'C', 'PG', 'B', 'C', 'A']);
  assert.match(det.ban.table.A.name, /^Arrivée sous le vent \(décalée\)/);
  assert.equal(det.ban.from, 'enregistrés avec la trace');
});

test('detect : sans banane demandée, détection d’avant ; une trace du cahier garde le cahier même quand la banane est cherchée', () => {
  // trace par les bouées 1, 2, 3 du cahier (parcours du cahier), loin d’une banane construite au vent de la Grande Rade
  const k = Object.keys(MARKS).slice(0, 3), M = k.map((x) => toXY(MARKS[x].lat, MARKS[x].lon));
  const tr = trace([fromBearing(M[0], 180, 900), ...M, fromBearing(M[2], 90, 900)]);
  const avant = D.detect(tr), avec = D.detect(tr, { banane: opts({ dir: 300, fit: true }) });
  assert.equal(avant.kind, undefined, 'sans banane : aucun champ nouveau');
  assert.deepEqual(Object.keys(avant), ['P', 'pass', 'mc', 'tStart', 'launches', 'finish']);
  assert.deepEqual(avec.mc, avant.mc); assert.deepEqual(avec.pass, avant.pass); assert.equal(avec.tStart, avant.tStart);
  assert.notEqual(avec.kind, 'ban');
});

// Document minimal pour la modale du questionnaire (overlay crée #modal dans le body)
function dom() {
  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  return document;
}
const apiQ = { toast: (m) => { throw new Error(m); }, eventName: 'Coupe test', courseHint: null, windGuess: () => ({ dir: 290, src: 'la prévision' }) };

test('questionnaire : la banane est proposée et choisie, ses passages listés (porte nommée), axe pré-rempli ; le cahier reste au choix', async () => {
  const doc = dom();
  const vraie = D.bananeLegs({ ban: { nm: 0.8 }, c: C, dir: 300, laps: 2 });
  const tr = courue(vraie, 'd');
  const det = D.detect(tr, { banane: opts({ dir: 320, fit: true }) });
  const p = D.ask(det, tr, apiQ);
  const sel = doc.querySelector('#dqCourse');
  assert.equal(sel.value, String(BANANE_ID), 'banane sélectionnée');
  assert.equal(sel.querySelectorAll('option').length, COURSES.filter((c) => !c.built).length + 1, 'parcours du cahier plus la banane');
  const txt = doc.querySelector('#modal').textContent.replace(/\s+/g, ' ');
  assert.match(txt, /Banane reconstruite : B à 0,8 Nq, axe 30\d° \(ajusté sur la trace\), réglages de l’app\./);
  assert.match(txt, /Détecté : B → C → Porte D → B → C → Arrivée/);
  assert.match(txt, /Porte droite \(porte\)/);
  assert.equal(doc.querySelector('#dqWind').value, String(Math.round(det.ban.dir)), 'vent au départ : l’axe retrouvé');
  // retour au cahier, puis à la banane : la liste suit (linkedom n’écrit pas la valeur d’un select : propriété simple pour le test)
  for (const el of [sel, doc.querySelector('#dqFinish')]) Object.defineProperty(el, 'value', { value: el.value, writable: true, configurable: true });
  sel.value = '3'; sel.onchange({ target: sel });
  assert.match(doc.querySelector('#dqFound').textContent, /Aucune marque du cahier détectée|Détecté : /);
  assert.doesNotMatch(doc.querySelector('.dq-list').textContent, /Porte droite/);
  sel.value = String(BANANE_ID); sel.onchange({ target: sel });
  assert.match(doc.querySelector('.dq-list').textContent, /Porte droite \(porte\)/);
  for (const x of doc.querySelectorAll('[data-p]')) Object.defineProperty(x, 'checked', { value: x.hasAttribute('checked') });        // linkedom : case cochée = attribut
  doc.querySelector('#dqGo').onclick();
  const ans = await p;
  assert.equal(ans.course.id, BANANE_ID);
  assert.ok(ans.table && ans.table.B && ans.table.PD);
  assert.deepEqual(ans.marks.map((m) => [m.k, m.side, !!m.gate]), [['B', 'b', false], ['C', 'b', false], ['PD', null, true], ['B', 'b', false], ['C', 'b', false], ['A', null, false]]);
  assert.equal(ans.ban.laps, 2); assert.equal(ans.ban.nm, 0.8);
  delete globalThis.document;
});

test('questionnaire sans banane : le choix du parcours est celui d’avant (cahier seul)', () => {
  const doc = dom();
  const k = Object.keys(MARKS).slice(0, 3), M = k.map((x) => toXY(MARKS[x].lat, MARKS[x].lon));
  const tr = trace([fromBearing(M[0], 180, 900), ...M]);
  D.ask(D.detect(tr), tr, apiQ);
  const opts2 = [...doc.querySelectorAll('#dqCourse option')].map((o) => o.value);
  assert.ok(!opts2.includes(String(BANANE_ID)), 'pas de banane');
  assert.equal(opts2.length, COURSES.filter((c) => !c.built).length);
  assert.equal(doc.querySelector('#dqWind').value, '290');
  delete globalThis.document;
});

// Champ de vent simulé : vent uniforme de 300°, 12 nd, sans relief
const champ = { t: {}, compute() {}, sample: () => ({ u: 12 * Math.sin(Math.PI * 120 / 180), v: 12 * Math.cos(Math.PI * 120 / 180), gust: 16, shelter: 0, dir: 300, spd: 12 }), shiftAmplitude: () => 5 };

test('analyse du débrief : bords nommés par les bouées de la banane, porte « bouée prise », arrivée sans doublon ; table gardée pour le rapport', () => {
  const vraie = D.bananeLegs({ ban: { nm: 0.8 }, c: C, dir: 300, laps: 2 });
  const tr = courue(vraie, 'd'), det = D.detect(tr, { banane: opts({ fit: true }) });
  const ans = { tStart: det.tStart, startWind: 300, table: det.ban.table, marks: det.mc.hit.map((h) => ({ k: h.k, t: h.t, side: h.k === 'B' || h.k === 'C' ? 'b' : null, ...(h.gate ? { gate: true } : {}) })) };
  const api = { F: champ, ctx: { terrain: null, forbidden: [], perf: 1 }, forecastAt: () => ({ dir: 300, spd: 12 }), localFx: 1, restoreField() {} };
  const an = D.analyze(det, ans, api);
  assert.deepEqual(an.legs.map((L) => L.name), [
    'Départ → B (au vent)', 'B → C (dégagement)', 'C → Porte droite (porte : bouée prise)', 'Porte D → B (au vent)', 'B → C (dégagement)', 'C → Arrivée (ligne de départ)',
  ]);
  assert.equal(an.table, det.ban.table);
  an.legs.forEach((L) => assert.ok(Number.isFinite(L.plan.time) && L.plan.time > 0, L.name));
});

test('tableau bord par bord d’une trace : banane reconstruite (traceBanane), bords planifiés (planBanane), porte prise et arrivée trouvées', () => {
  const vraie = D.bananeLegs({ ban: { nm: 0.8, fin: 'sousvent' }, c: C, dir: 300, laps: 2 });
  const tr = courue(vraie, 'g');
  const ban = D.traceBanane(tr, opts({ ban: { nm: 0.8, fin: 'sousvent' }, dir: 315, fit: true }));
  assert.ok(ban && ban.laps === 2);
  const legs = D.planBanane(ban.B, champ, { terrain: null, forbidden: [], perf: 1, trend: 0 });
  assert.deepEqual(legs.map((l) => l.order), [1, 2, 3, 4, 5, 6], 'arrivée comprise');
  const res = analyzeTrack(tr, { windAt: () => ({ dir: 300, spd: 12 }), boatSpeed, legs });
  assert.equal(res.split.length, 6);
  assert.ok(res.split.every((s) => !s.missed), res.split.map((s) => `${s.leg.to.name}:${s.missed ? 'manquée' : Math.round(s.dMark)}`).join(' | '));
  assert.equal(res.split[2].took, 'g', 'porte : bouée gauche prise');
  assert.match(res.split[5].leg.to.name, /^Arrivée sous le vent \(décalée\)/);
  assert.ok(res.split.every((s) => Number.isFinite(s.plan) && s.plan > 0));
  // trace sans rapport avec la banane : rien (moins de 3 bouées, rien ne la désigne)
  const ailleurs = trace([toXY(43.12, 5.92), toXY(43.13, 5.93)]);
  ailleurs.pts = ailleurs.pts.concat(trace([toXY(43.13, 5.93), toXY(43.125, 5.95)], ailleurs.pts.at(-1)[0] + 3000).pts.slice(1));
  assert.equal(D.traceBanane(ailleurs, opts({ fit: true })), null);
});

test('câblage : débrief et bord par bord de l’app reconstruisent la banane de la trace (manche, trace ou réglages de l’app), enregistrement de l’axe et de la ligne', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  const bo = bodyOf(app, 'bananeOfTrace');
  assert.match(bo, /raceSettings\(manche\)/, 'réglages de la manche');
  assert.match(bo, /cleanBan\(rec\.ban\)/, 'réglages enregistrés, bornés');
  assert.match(bo, /banOf\(S\)/, 'à défaut, réglages de l’app');
  assert.match(bo, /trackWindAt\(/, 'vent du moment de la course');
  assert.match(bodyOf(app, 'runDebrief'), /dbDetect\(tr, bo \? \{ banane: bo \} : \{\}\)/);
  assert.match(bodyOf(app, 'showTrace'), /traceBanane\(tr, bo\)/);
  assert.match(bodyOf(app, 'planBananeTrace'), /F\.compute\(prev\.base, \{ localEffects: prev\.fx \}\)/, 'champ rétabli à l’identique');
  assert.match(app, /ban: banOf\(S\), \.\.\.banGeo/, 'la trace enregistrée garde la banane, son axe et sa ligne');
  // rien de la banane n’entre dans MARKS ni dans le choix du cahier
  const dbr = readFileSync(ROOT + 'js/debrief.js', 'utf8');
  assert.match(dbr, /COURSES\.filter\(\(c\) => !c\.built\)/);
  assert.doesNotMatch(dbr, /MARKS\[[^\]]+\]\s*=/);
});
