// FIAB-03 / FIAB-04 : jalons du chrono, bips posés sur l’horloge audio, suspension, bip manqué, flash ≤ 1 par minute.
// Faux contexte audio { state, currentTime } et fonction de lecture injectée : aucun navigateur requis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { LOOKAHEAD_S, TICK_MS, milestones, KEY, SOUND, audioTime, audioAlive, createBeeper } from '../js/beeper.js';

const T0 = 1_000_000;

// Monde simulé : horloge murale (Date) et horloge audio séparées, la seconde peut s’arrêter (suspension)
function monde({ state = 'running', ct = 0, wall = T0 } = {}) {
  const w = { ctx: { state, currentTime: ct }, wall, plays: [], missed: [] };
  w.now = () => w.wall;
  w.play = (f, d, when, m) => { const n = { f, d, when, s: m.s, stopped: false, stop() { this.stopped = true; } }; w.plays.push(n); return n; };
  w.beeper = createBeeper({ ctx: w.ctx, now: w.now, play: w.play, onMiss: (m) => w.missed.push(m) });
  // avance de dt ms : l’horloge audio suit quand le contexte tourne, reste figée sinon
  w.advance = (dt) => { w.wall += dt; if (w.ctx.state === 'running') w.ctx.currentTime += dt / 1000; };
  w.live = () => w.plays.filter((p) => !p.stopped);
  return w;
}

test('jalons d’un 5-0 : minutes, dizaines, 9…1 s puis signal', () => {
  const end = T0 + 300000, ms = milestones(end, end - 300000);
  assert.deepEqual(ms.filter((m) => m.kind === 'min').map((m) => m.s), [300, 240, 180, 120, 60]);
  assert.deepEqual(ms.filter((m) => m.kind === 'dix').map((m) => m.s), [50, 40, 30, 20, 10]);
  assert.deepEqual(ms.filter((m) => m.kind === 'sec').map((m) => m.s), [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(ms.length, 20);
  assert.deepEqual(ms.at(-1), { at: end, s: 0, kind: 'go' });
  assert.ok(ms.every((m, i) => i === 0 || m.at > ms[i - 1].at), 'jalons strictement croissants');
});

test('un chrono lancé à 3 min 20 ne rejoue ni le 5 ni le 4', () => {
  const end = T0 + 200000, ms = milestones(end, T0 - 400);
  assert.equal(ms[0].s, 180);
  assert.ok(!ms.some((m) => m.s === 300 || m.s === 240));
  const w = monde(); w.beeper.arm(end);
  w.advance(1000); w.beeper.tick();
  assert.equal(w.plays.length, 0, 'rien n’est dû dans les 8 premières secondes');
});

test('audioTime : instant Date → horloge audio', () => {
  assert.equal(audioTime(10500, 10000, 7), 7.5);
  assert.equal(audioTime(10000, 10000, 7), 7);
  assert.equal(audioTime(9000, 10000, 7), 6);
});

test('la fenêtre de 8 s est remplie sans doublon, au fil des ticks', () => {
  const w = monde({ ct: 5 }), end = T0 + 20000;
  w.beeper.arm(end);                                   // H−20 s : bip « dix » posé tout de suite
  assert.deepEqual(w.plays.map((p) => p.s), [20]);
  assert.equal(w.plays[0].when, 5);
  for (let i = 0; i < 80; i++) { w.advance(TICK_MS); w.beeper.tick(); w.beeper.tick(); }   // 20 s, chaque tick doublé : aucun doublon
  assert.deepEqual(w.plays.map((p) => p.s), [20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  const attendu = [20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((s) => 5 + (20 - s));
  w.plays.forEach((p, i) => assert.ok(Math.abs(p.when - attendu[i]) < 1e-6, `bip ${p.s} posé à ${p.when}, attendu ${attendu[i]}`));
  assert.deepEqual(w.plays.map((p) => [p.f, p.d]).slice(-1), [SOUND.go]);
  assert.ok(w.plays.slice(0, 2).every((p) => p.f === SOUND.dix[0]) && LOOKAHEAD_S === 8);
});

test('suspension de 3 s : les bips déjà posés sont annulés puis reposés sur l’heure réelle', () => {
  const w = monde({ ct: 10 }), end = T0 + 15000;
  w.advance(5000);                                     // H−10 s, horloge audio à 15 s : on la remet à 10 s pour des chiffres ronds
  w.ctx.currentTime = 10;
  w.beeper.arm(end);
  const avant = w.plays.slice();
  assert.deepEqual(avant.map((p) => p.s), [10, 9, 8, 7, 6, 5, 4, 3, 2], 'fenêtre de 8 s posée d’un coup');
  w.ctx.state = 'suspended'; w.advance(3000);          // 3 s murales, horloge audio figée
  w.beeper.tick(); assert.equal(w.plays.length, avant.length, 'contexte suspendu : rien de posé');
  w.ctx.state = 'running'; w.beeper.tick();            // retour : recalage sur Date
  assert.ok(avant.filter((p) => p.s <= 9).every((p) => p.stopped), 'les bips décalés de 3 s sont annulés');
  assert.deepEqual(w.missed.map((m) => m.s), [9, 8], 'ceux dont l’heure est passée sont signalés, pas rejoués');
  const apres = w.plays.slice(avant.length);
  assert.deepEqual(apres.map((p) => p.s), [7, 6, 5, 4, 3, 2, 1, 0]);
  assert.ok(apres.every((p) => !p.stopped));
  for (const p of apres) assert.ok(Math.abs(p.when - audioTime(end - p.s * 1000, w.wall, w.ctx.currentTime)) < 1e-6, `bip ${p.s} reposé sur l’heure réelle`);
});

test('contexte non « running » : rien n’est posé', () => {
  for (const state of ['suspended', 'interrupted', 'closed']) {
    const w = monde({ state }); w.beeper.arm(T0 + 5000); w.advance(1000); w.beeper.tick();
    assert.equal(w.plays.length, 0, state);
  }
});

test('audioAlive : horloge qui avance, figée, ou trop peu de recul', () => {
  assert.equal(audioAlive({ wall: 0, ct: 0 }, { wall: 2000, ct: 2 }), true);
  assert.equal(audioAlive({ wall: 0, ct: 5 }, { wall: 2000, ct: 5 }), false);
  assert.equal(audioAlive({ wall: 0, ct: 0 }, { wall: 2000, ct: 0.5 }), false);
  assert.equal(audioAlive({ wall: 0, ct: 0 }, { wall: 500, ct: 0 }), null);
});

test('un jalon passé pendant une suspension est signalé une fois et jamais rejoué', () => {
  const w = monde({ ct: 10 }), end = T0 + 20000;
  w.beeper.arm(end);
  w.advance(5000); w.beeper.tick();                    // H−15 s : 10, 9, 8, 7 posés
  w.ctx.state = 'suspended'; w.advance(5700);          // retour à H−9,3 s : le « 10 » (H−10 s) est passé depuis 700 ms
  w.ctx.state = 'running'; w.beeper.tick(); w.beeper.tick();
  assert.deepEqual(w.missed.map((m) => m.s), [10], 'onMiss reçoit le jalon { at, s, kind }, une seule fois');
  assert.equal(w.missed[0].kind, 'dix'); assert.equal(w.missed[0].at, end - 10000);
  const rejoues = w.plays.filter((p) => !p.stopped && p.s === 10);
  assert.equal(rejoues.length, 0, 'le bip manqué n’est pas rejoué');
  assert.ok(w.live().some((p) => p.s === 9), 'les suivants sont bien posés');
});

test('au retour d’une suspension, un bip dû depuis moins de 400 ms est encore joué, un plus ancien est manqué', () => {
  const w = monde({ ct: 3 }), end = T0 + 12000;
  w.advance(3000); w.beeper.arm(end);                  // H−9 s
  w.ctx.state = 'suspended'; w.advance(2300);          // retour à H−6,7 s : le « 8 » est passé depuis 1,3 s, le « 7 » depuis 300 ms
  w.ctx.state = 'running'; w.beeper.tick();
  assert.deepEqual(w.missed.map((m) => m.s), [8]);
  const sept = w.live().find((p) => p.s === 7);
  assert.ok(sept && sept.when === w.ctx.currentTime, 'le 7 est joué tout de suite');
  assert.ok(!w.live().some((p) => p.s === 8));
});

test('un décalage de moins de 30 ms ne repose aucun bip, au-delà si', () => {
  const w = monde({ ct: 4 }), end = T0 + 12000;
  w.advance(5000); w.ctx.currentTime = 9; w.beeper.arm(end);          // H−7 s : bips 7…1 et signal posés à 9…16 s
  const n = w.plays.length; assert.equal(n, 8);
  w.ctx.currentTime += 0.02; w.beeper.tick();                         // gigue de 20 ms
  assert.equal(w.plays.length, n); assert.ok(w.plays.every((p) => !p.stopped));
  w.ctx.currentTime += 0.2; w.beeper.tick();                          // 200 ms de décalage
  assert.ok(w.plays.slice(0, n).filter((p) => p.s <= 6).every((p) => p.stopped), 'bips à venir annulés');
  assert.ok(!w.plays[0].stopped, 'le bip déjà sonné n’est pas touché');
  assert.ok(w.plays.length > n, 'et reposés');
});

test('disarm annule tout, ré-armer repart d’une ardoise vide', () => {
  const w = monde({ ct: 1 }); w.beeper.arm(T0 + 9000);
  assert.ok(w.plays.length > 0 && w.beeper.end === T0 + 9000);
  w.beeper.disarm();
  assert.ok(w.plays.every((p) => p.stopped) && w.beeper.end === null);
  assert.equal(w.beeper.tick(), false);
  const n = w.plays.length; w.beeper.arm(T0 + 9000); assert.ok(w.plays.length > n, 'reposés après un nouvel armement');
});

test('flash : les jalons clés sont les minutes et le signal, espacés d’au moins 60 s (≤ 1 flash par minute)', () => {
  const ks = milestones(T0 + 600000, T0).filter(KEY);
  assert.equal(ks.length, 10 + 1);
  assert.ok(ks.every((m) => m.kind === 'min' || m.kind === 'go'));
  for (let i = 1; i < ks.length; i++) assert.ok(ks[i].at - ks[i - 1].at >= 60000, `écart ${ks[i].s} → ${ks[i - 1].s}`);
  assert.ok(!milestones(T0 + 300000, T0).some((m) => m.kind === 'sec' && KEY(m)), 'pas de flash pour les 10 dernières secondes');
});

// ───────────────────────── gardes statiques du câblage
const APP = readFileSync(ROOT + 'js/app.js', 'utf8');
const SM = readFileSync(ROOT + 'js/startmode.js', 'utf8');
const corps = (src, nom) => { const i = src.indexOf(`function ${nom}(`); assert.ok(i >= 0, `${nom} introuvable`); const j = src.indexOf('\n}\n', i); return src.slice(i, j); };

test('garde : js/app.js pose les bips par createBeeper et l’accesseur de timer.end', () => {
  assert.ok(APP.includes('createBeeper('));
  assert.ok(APP.includes("Object.defineProperty(timer, 'end'"));
  assert.ok(APP.includes('rade.timer.v1'));
});

test('garde : tickTimer ne sonne plus aucun bip', () => {
  assert.ok(!/\bbeep\(/.test(corps(APP, 'tickTimer')), 'tickTimer appelle encore beep(');
  assert.ok(/beeper\??\.tick\(\)/.test(corps(APP, 'tickTimer')));
});

test('garde : l’ensemble des bips déjà joués de timer a disparu', () => {
  assert.ok(!/timer\.beeps|beeps:\s*new Set/.test(APP), 'js/app.js');
  assert.ok(!/\.beeps\b/.test(SM), 'js/startmode.js');
});

test('garde : son vérifié et flash câblés dans js/app.js, js/startmode.js et styles.css', () => {
  for (const mot of ['audioSession', 'beepFlash', 'Tester le son', 'startFlash']) assert.ok(APP.includes(mot), `js/app.js : ${mot}`);
  assert.ok(SM.includes('sndtest') && SM.includes('smAlert'), 'js/startmode.js : sndtest, smAlert');
  assert.ok(readFileSync(ROOT + 'styles.css', 'utf8').includes('#beepFlash'), 'styles.css : #beepFlash');
  assert.ok(/startFlash:\s*true/.test(APP.slice(0, APP.indexOf('const S ='))), 'startFlash est dans DEF (persisté)');
});

test('garde : le flash n’est jamais rouge', () => {
  const css = readFileSync(ROOT + 'styles.css', 'utf8');
  const bloc = css.slice(css.indexOf('#beepFlash {'), css.indexOf('#sndAsk {'));
  assert.ok(bloc.length > 100 && !/red|#f00|#ff0000|#d63031|var\(--bad\)/i.test(bloc));
});
