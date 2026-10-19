// D-05 : verrou d’écran unique, honnête (tenu / perdu / refusé / non pris en charge) ; erreurs de la trace consignées (FIAB-07).
// Faux navigator.wakeLock et faux document : aucun navigateur requis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { createWakeLock } from '../js/wakelock.js';
import { Recorder } from '../js/track.js';

function sentinelle() {
  const ls = {};
  return {
    released: false, releases: 0,
    addEventListener(t, f) { (ls[t] ??= []).push(f); },
    async release() { this.releases++; this.perdre(); },
    perdre() { if (this.released) return; this.released = true; (ls.release || []).forEach((f) => f()); },   // comme le vrai : l’événement suit la libération
  };
}
function monde({ api = true, refus = null, visible = true } = {}) {
  const w = { requests: 0, sentinels: [], reports: [], doc: { visibilityState: visible ? 'visible' : 'hidden' }, t: 1000 };
  w.nav = api ? { wakeLock: { request: async (type) => {
    w.requests++; assert.equal(type, 'screen');
    if (refus) { const e = new Error('refus'); e.name = refus; throw e; }
    const s = sentinelle(); w.sentinels.push(s); return s;
  } } } : {};
  w.lock = createWakeLock({ nav: w.nav, doc: w.doc, report: (o, m) => w.reports.push([o, m]), now: () => w.t });
  return w;
}
const formeOk = (st) => { for (const k of ['supported', 'wanted', 'held']) assert.equal(typeof st[k], 'boolean', `${k} doit être un booléen nu`); };

test('API absente : non pris en charge, want se résout à false sans exception', async () => {
  const w = monde({ api: false });
  assert.equal(await w.lock.want('timer'), false);
  const st = w.lock.state(); formeOk(st);
  assert.deepEqual([st.supported, st.wanted, st.held], [false, true, false]);
  w.lock.drop('timer'); assert.equal(w.lock.state().wanted, false);
});

test('deux raisons : une seule demande à l’API, held et wanted vrais', async () => {
  const w = monde();
  await w.lock.want('startmode'); await w.lock.want('timer');
  const st = w.lock.state(); formeOk(st);
  assert.equal(w.requests, 1);
  assert.deepEqual([st.supported, st.wanted, st.held, st.err], [true, true, true, null]);
  w.lock.drop('startmode');
  assert.equal(w.sentinels[0].releases, 0, 'tant qu’une raison reste, le verrou est gardé');
  assert.equal(w.lock.state().held, true);
});

test('verrou libéré par le système alors qu’il est encore demandé : perdu, rapporté, retry le reprend', async () => {
  const w = monde();
  await w.lock.want('recording');
  w.t = 5000; w.sentinels[0].perdre();
  const st = w.lock.state(); formeOk(st);
  assert.deepEqual([st.held, st.wanted, st.lastLostAt], [false, true, 5000]);
  assert.equal(w.reports.length, 1);
  assert.equal(w.reports[0][0], 'wake'); assert.match(w.reports[0][1], /encore demandé/);
  assert.equal(await w.lock.retry(), true);
  assert.equal(w.requests, 2); assert.equal(w.lock.state().held, true);
});

test('drop de la dernière raison : release() appelé, plus rien de voulu, aucun rapport de perte', async () => {
  const w = monde();
  await w.lock.want('gps'); w.lock.drop('gps');
  await Promise.resolve();
  assert.equal(w.sentinels[0].releases, 1);
  const st = w.lock.state(); formeOk(st);
  assert.deepEqual([st.wanted, st.held, st.lastLostAt], [false, false, null]);
  assert.deepEqual(w.reports, []);
});

test('demande rejetée (NotAllowedError) : err renseignée, rapportée, held faux', async () => {
  const w = monde({ refus: 'NotAllowedError' });
  assert.equal(await w.lock.want('startmode'), false);
  const st = w.lock.state(); formeOk(st);
  assert.deepEqual([st.err, st.held, st.wanted, st.supported], ['NotAllowedError', false, true, true]);
  assert.equal(w.reports.length, 1); assert.match(w.reports[0][1], /demande refusée : NotAllowedError/);
});

test('page masquée : aucune demande ; au retour visible, retry la fait', async () => {
  const w = monde({ visible: false });
  assert.equal(await w.lock.want('timer'), false);
  assert.equal(w.requests, 0);
  w.doc.visibilityState = 'visible';
  assert.equal(await w.lock.retry(), true);
  assert.equal(w.requests, 1);
});

test('forme verrouillée : held, wanted et supported restent des booléens, même pendant une demande en cours', async () => {
  const w = monde();
  formeOk(w.lock.state());
  const attente = w.lock.want('timer');                // demande non résolue : état lu au milieu
  const pendant = w.lock.state(); formeOk(pendant); assert.equal(pendant.held, false);
  await attente; formeOk(w.lock.state());
  w.sentinels[0].perdre(); formeOk(w.lock.state());
  const refus = monde({ refus: 'SecurityError' }); await refus.lock.want('x'); formeOk(refus.lock.state());
  const absent = monde({ api: false }); formeOk(absent.lock.state());
});

test('garde : seul js/wakelock.js s’adresse à l’API du verrou d’écran du navigateur', () => {
  for (const f of ['js/startmode.js', 'js/track.js']) assert.ok(!/wakeLock/.test(readFileSync(ROOT + f, 'utf8')), `${f} parle encore directement à wakeLock`);
  assert.ok(/want\('startmode'\)/.test(readFileSync(ROOT + 'js/startmode.js', 'utf8')));
  assert.ok(/want\('recording'\)/.test(readFileSync(ROOT + 'js/track.js', 'utf8')));
});

// ───────────────────────── Recorder : verrou partagé et erreurs consignées (FIAB-07)
function basesQuiEchouent() {
  const prev = globalThis.indexedDB;
  globalThis.indexedDB = { open() { const r = { error: new Error('quota IndexedDB dépassé') }; queueMicrotask(() => r.onerror?.()); return r; } };
  return () => { globalThis.indexedDB = prev; };
}
const pt = (t, lat) => ({ t, lat, lon: 5.93, acc: 5, sog: 5, cog: 90 });

test('Recorder.stop : la sauvegarde finale qui échoue est consignée (trace) puis relancée', async () => {
  const restore = basesQuiEchouent();
  try {
    const raisons = [], rapports = [];
    const wake = { want: (r) => raisons.push('+' + r), drop: (r) => raisons.push('-' + r) };
    const rec = new Recorder({ wake, report: (o, e) => rapports.push([o, e]) });
    rec.start({ name: 't', course: {} });
    rec.add(pt(Date.now(), 43.07)); rec.add(pt(Date.now() + 5000, 43.075));
    await new Promise((ok) => setTimeout(ok, 5));      // la sauvegarde périodique (échec avalé jusqu’ici) est consignée
    const avantStop = rapports.length;
    assert.ok(avantStop >= 1, 'la sauvegarde périodique qui échoue est consignée');
    await assert.rejects(() => rec.stop(), /quota IndexedDB/);
    assert.ok(rapports.length > avantStop, 'la sauvegarde finale qui échoue est consignée aussi');
    assert.ok(rapports.every(([o, e]) => o === 'trace' && /quota/.test(e.message)));
    assert.deepEqual(raisons, ['+recording', '-recording']);
  } finally { restore(); }
});
