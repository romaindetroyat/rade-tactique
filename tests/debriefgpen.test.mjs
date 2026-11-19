// Débrief d’une trace courue sur un parcours du GPEN (91, 92, 93) à Brest (07-10) : le parcours se reconstruit comme une banane, avec les
// réglages imposés (courseBan), ses noms (1, 2 (dégagement), 3S / 3P, 3P seule au dernier tour) et son arrivée (à droite du comité, ou
// devant la chapelle pour Virginie Hériot) ; le questionnaire le propose sous son titre, l’analyse nomme les bords par ses bouées, le tableau
// bord par bord d’une trace le découpe. Ce fichier tourne dans son propre processus : il passe à Brest avant tout calcul de position.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import { setVenue } from '../js/lieu.js';
import { toXY, toLL, distXY, fromBearing } from '../js/geo.js';
import { boatSpeed } from '../js/polar.js';
import { analyzeTrack } from '../js/track.js';
import { BREST } from '../js/venue-brest.js';
import { buildLegs } from '../js/tactics.js';
import { BANANE_ID, courseBan, courseLaps } from '../js/banane.js';
import * as D from '../js/debrief.js';

setVenue('brest');
const cours = (id) => BREST.COURSES.find((c) => c.id === id);
const ZA = BREST.LINE_PRESETS.zoneA;
const T0 = Date.parse('2027-05-06T12:00:00Z');
const S = { laps: 5, banNm: 0.6 };              // état de l’app : 5 tours réglés pour la banane (ignorés par le GPEN), Dist. 1 de 0,6 Nq
// parcours tel que runAnalysis le construit (ligne recentrée dans la zone A, réglages et tours imposés)
const couru = (id, dir = 270) => {
  const c = cours(id);
  return buildLegs(c, 'G', { laps: courseLaps(c, S), windDir: dir, ban: courseBan(c, S), line: { center: ZA, lengthNm: 0.12, mode: 'wind', bearing: 0, override: null } });
};
// Trace au format enregistré ([t, lat, lon, sog, cog]) le long d’une ligne brisée : un point tous les 10 m, toutes les 3 s
function trace(wps, t0 = T0) {
  const pts = []; let t = t0;
  for (let k = 1; k < wps.length; k++) {
    const a = wps[k - 1], b = wps[k], n = Math.max(1, Math.round(distXY(a, b) / 10));
    for (let i = k === 1 ? 0 : 1; i <= n; i++) { const ll = toLL(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n); pts.push([t, +ll.lat.toFixed(6), +ll.lon.toFixed(6), 6, null]); t += 3000; }
  }
  return { id: 'tr-gpen', name: 'GPEN test', start: pts[0][0], course: null, pts };
}
// boucles d’avant-départ près de la ligne, puis chaque bouée du parcours (porte : bouée `porte`), puis on s’éloigne
function course(B, porte = 'd') {
  const c = B.line.c;
  const wps = [fromBearing(c, 120, 400), fromBearing(c, 200, 150), fromBearing(c, 20, 150), fromBearing(c, 120, 250), c];
  for (const l of B.legs) wps.push(l.gate ? l.gate[porte] : l.to);
  wps.push(fromBearing(wps.at(-1), 180, 600));
  return trace(wps);
}
// options du débrief telles que bananeOfTrace les rend pour un parcours du GPEN (ligne courue, parcours désigné)
const opts = (id, B, o = {}) => ({ ban: courseBan(cours(id), S), cls: 'G', c: toLL(B.line.c.x, B.line.c.y), dir: 270, fit: false, prefer: true, from: 'enregistrés avec la trace', course: cours(id), ...o });

function dom() {
  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  return document;
}
const apiQ = { toast: (m) => { throw new Error(m); }, eventName: 'GPEN 2027 — J80', courseHint: null, windGuess: () => ({ dir: 280, src: 'la prévision' }) };
const champ = { t: {}, compute() {}, sample: () => ({ u: 12 * Math.sin(Math.PI * 90 / 180), v: 12 * Math.cos(Math.PI * 90 / 180), gust: 16, shelter: 0, dir: 270, spd: 12 }), shiftAmplitude: () => 5 };

test('parcours 1 du GPEN couru : reconstruit comme une banane (axe ajusté), 2 tours, 1 → 2 → porte 3S/3P → 1 → 2 → 3P seule → arrivée à droite du comité', () => {
  const B = couru(91);
  const det = D.detect(course(B, 'd'), { banane: opts(91, B, { dir: 290, fit: true }) });
  assert.equal(det.kind, 'ban');
  assert.equal(det.mc.c.id, 91, 'parcours nommé : celui du GPEN, pas la banane');
  assert.equal(det.ban.course.id, 91);
  assert.equal(det.ban.laps, 2);
  assert.ok(Math.abs(det.ban.dir - 270) <= 1, `axe retrouvé : ${det.ban.dir}°`);
  assert.deepEqual(det.mc.hit.map((h) => h.k), ['B', 'C', 'PD', 'B', 'C', 'PG', 'A']);
  assert.deepEqual(det.mc.hit[2].gate, ['PG', 'PD'], 'porte du premier tour : 3S prise');
  assert.equal(det.mc.hit[5].gate, undefined, '3P seule au dernier tour : une marque, pas une porte');
  const t = det.ban.table;
  assert.deepEqual([t.B.name, t.C.name, t.PG.name, t.PD.name, t.A.name], ['1', '2 (dégagement)', '3P', '3S', 'Arrivée (à droite du comité)']);
  assert.deepEqual([t.B.short, t.C.short, t.PG.short, t.PD.short], ['1', '2', '3P', '3S']);
  assert.equal(det.mc.reduced, false);
});

test('questionnaire : le parcours du GPEN est proposé sous son titre, noms du GPEN, 3P du dernier tour à bâbord sans porte', async () => {
  const doc = dom();
  const B = couru(91);
  const tr = course(B, 'd'), det = D.detect(tr, { banane: opts(91, B, { dir: 285, fit: true, from: 'de l’app' }) });
  const p = D.ask(det, tr, apiQ);
  const sel = doc.querySelector('#dqCourse');
  assert.equal(sel.value, '91');
  const opt = [...sel.querySelectorAll('option')].find((o) => o.getAttribute('value') === '91');
  assert.equal(opt.textContent, 'GPEN — parcours 1 (2 tours)');
  assert.ok(![...sel.querySelectorAll('option')].some((o) => o.getAttribute('value') === String(BANANE_ID)), 'pas de banane proposée à la place');
  const txt = doc.querySelector('#modal').textContent.replace(/\s+/g, ' ');
  assert.match(txt, /Parcours reconstruit \(GPEN — parcours 1 \(2 tours\)\) : marque 1 à 0,6 Nq, axe 27\d° \(ajusté sur la trace\), réglages de l’app\./);
  assert.match(txt, /Détecté : 1 → 2 → 3S → 1 → 2 → 3P → Arrivée/);
  assert.match(txt, /3S \(porte\)/);
  assert.doesNotMatch(txt, /Banane reconstruite/);
  for (const x of doc.querySelectorAll('[data-p]')) Object.defineProperty(x, 'checked', { value: x.hasAttribute('checked') });
  doc.querySelector('#dqGo').onclick();
  const ans = await p;
  assert.equal(ans.course.id, 91);
  assert.equal(ans.course.title, 'GPEN — parcours 1 (2 tours)');
  assert.deepEqual(ans.marks.map((m) => [m.k, m.side, !!m.gate]), [['B', 'b', false], ['C', 'b', false], ['PD', null, true], ['B', 'b', false], ['C', 'b', false], ['PG', 'b', false], ['A', null, false]]);
  assert.equal(ans.ban.laps, 2); assert.equal(ans.ban.fin, 'comite'); assert.equal(ans.ban.nm, 0.6);
  delete globalThis.document;
});

test('analyse du débrief : bords nommés par les bouées du GPEN (Départ → 1 … 3P → Arrivée (à droite du comité))', () => {
  const B = couru(92);
  const tr = course(B, 'g'), det = D.detect(tr, { banane: opts(92, B) });
  assert.equal(det.ban.laps, 3);
  const ans = { tStart: det.tStart, startWind: 270, table: det.ban.table, marks: det.mc.hit.map((h) => ({ k: h.k, t: h.t, side: h.k === 'B' || h.k === 'C' || (h.k === 'PG' && !h.gate) ? 'b' : null, ...(h.gate ? { gate: true } : {}) })) };
  const api = { F: champ, ctx: { terrain: null, forbidden: [], perf: 1 }, forecastAt: () => ({ dir: 270, spd: 12 }), localFx: 1, restoreField() {} };
  const an = D.analyze(det, ans, api);
  assert.deepEqual(an.legs.map((L) => L.name), [
    'Départ → 1', '1 → 2 (dégagement)', '2 → 3P (porte : bouée prise)', '3P → 1', '1 → 2 (dégagement)', '2 → 3P (porte : bouée prise)',
    '3P → 1', '1 → 2 (dégagement)', '2 → 3P', '3P → Arrivée (à droite du comité)',
  ]);
  an.legs.forEach((L) => assert.ok(Number.isFinite(L.plan.time) && L.plan.time > 0, L.name));
});

test('Virginie Hériot (93) : bord par bord d’une trace, arrivée devant la chapelle (position à confirmer), recentrage de la ligne non refait', () => {
  const B = couru(93);
  const tr = course(B, 'd');
  const ban = D.traceBanane(tr, opts(93, B));
  assert.ok(ban && ban.laps === 2 && ban.course.id === 93);
  // la ligne passée est celle courue : la reconstruction ne la recule pas une deuxième fois
  assert.ok(distXY(ban.B.line.c, B.line.c) < 1, `ligne reconstruite à ${distXY(ban.B.line.c, B.line.c).toFixed(1)} m de la ligne courue`);
  const legs = D.planBanane(ban.B, champ, { terrain: null, forbidden: [], perf: 1, trend: 0 });
  assert.equal(legs.at(-1).to.name, 'Arrivée devant la chapelle (position à confirmer)');
  const res = analyzeTrack(tr, { windAt: () => ({ dir: 270, spd: 12 }), boatSpeed, legs });
  assert.equal(res.split.length, legs.length);
  assert.ok(res.split.every((s) => !s.missed), res.split.map((s) => `${s.leg.to.name}:${s.missed ? 'manquée' : Math.round(s.dMark)}`).join(' | '));
});

test('câblage : la trace d’un parcours du GPEN garde ses réglages, sa ligne et son axe ; bananeOfTrace le reconstruit ; briefing titré hors de Toulon', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  const bo = bodyOf(app, 'bananeOfTrace');
  assert.match(bo, /COURSES\.find\(\(c\) => c\.id === Number\(designe\) && c\.built === 'BAN' && c\.ban\)/, 'parcours du GPEN désigné : retrouvé dans le catalogue');
  assert.match(bo, /courseBan\(K, S\)/, 'réglages imposés par le parcours');
  assert.match(bo, /K\.centre && !ov/, 'ligne recentrée comme runAnalysis, sauf ligne pinguée');
  assert.match(bo, /\.\.\.course \}/, 'parcours passé au débrief');
  assert.match(app, /construit \? \{ ban: courseBan\(c, S\), \.\.\.banGeo \}/, 'la trace enregistrée garde le parcours construit, son axe et sa ligne');
  assert.match(app, /VENUE\.id === 'toulon' \? `Parcours \$\{analysis\.course\.id\}` : esc\(analysis\.course\.title\)/, 'briefing : numéro à Toulon (v42), titre ailleurs');
  assert.match(bodyOf(app, 'renderTraceDetail'), /Parcours reconstruit \(\$\{esc\(ban\.course\.title\)\}\)/);
});
