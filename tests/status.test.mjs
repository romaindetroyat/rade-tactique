// FIAB-05 : le voyant à quatre lampes (GPS, écran, son, réseau) dit la vérité ; seuils et messages de js/status.js.
// Les formes de wake et de audio sont celles du plan 01 : wake.state() → { supported, wanted, held, err, lastLostAt }, soundState() → { state, alive, tested }.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GPS_STALE_S, GPS_WARN_S, GPS_ACC_WARN_M, NET_STALE_MS, computeStatus } from '../js/status.js';

const NOW = 1_800_000_000_000;
const bon = () => ({
  now: NOW, needGps: true, needScreen: true, needSound: true,
  gps: { on: true, lastAt: NOW - 1000, acc: 5, err: null },
  wake: { supported: true, wanted: true, held: true, err: null, lastLostAt: null },
  audio: { state: 'running', alive: true, tested: true },
  net: { online: true, lastOkAt: NOW - 20_000, rtt: 80 },
});
const avec = (patch) => { const b = bon(); for (const [k, v] of Object.entries(patch)) b[k] = typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...b[k], ...v } : v; return computeStatus(b); };
const L = (s, id) => s.lamps.find((l) => l.id === id);

test('seuils : GPS muet depuis 10 s, orange dès 4 s, précision 15 m', () => {
  assert.deepEqual([GPS_STALE_S, GPS_WARN_S, GPS_ACC_WARN_M, NET_STALE_MS], [10, 4, 15, 600000]);
});

test('tout va bien : quatre lampes vertes, worst ok', () => {
  const s = computeStatus(bon());
  assert.deepEqual(s.lamps.map((l) => l.id), ['gps', 'screen', 'sound', 'net']);
  assert.deepEqual(s.lamps.map((l) => l.level), ['ok', 'ok', 'ok', 'ok']);
  assert.equal(s.worst, 'ok');
});

test('GPS : dernier point reçu il y a 12 s → rouge « muet depuis 12 s », action gps', () => {
  const s = avec({ gps: { lastAt: NOW - 12_000 } });
  assert.equal(L(s, 'gps')?.level, 'bad');
  assert.match(L(s, 'gps')?.detail ?? '', /muet depuis 12 s/);
  assert.equal(L(s, 'gps')?.act, 'gps');
  assert.equal(s.worst, 'bad');
});

test('GPS : 5 s → orange ; bornes 4 s vert, 10 s orange, 11 s rouge', () => {
  assert.equal(L(avec({ gps: { lastAt: NOW - 5000 } }), 'gps')?.level, 'warn');
  assert.equal(L(avec({ gps: { lastAt: NOW - 4000 } }), 'gps')?.level, 'ok');
  assert.equal(L(avec({ gps: { lastAt: NOW - 10_000 } }), 'gps')?.level, 'warn');
  assert.equal(L(avec({ gps: { lastAt: NOW - 11_000 } }), 'gps')?.level, 'bad');
});

test('GPS : l’âge se compte depuis la réception et figure dans la lampe', () => {
  const l = L(avec({ gps: { lastAt: NOW - 2000 } }), 'gps');
  assert.equal(l?.age, 2);
  assert.match(l?.detail ?? '', /2 s/);
});

test('GPS : précision 20 m → orange ; 15 m reste vert', () => {
  assert.equal(L(avec({ gps: { acc: 20 } }), 'gps')?.level, 'warn');
  assert.equal(L(avec({ gps: { acc: 15 } }), 'gps')?.level, 'ok');
});

test('GPS : refusé (code 1) → rouge avec le chemin des Réglages', () => {
  const l = L(avec({ gps: { err: 1, lastAt: null } }), 'gps');
  assert.equal(l?.level, 'bad');
  assert.match(l?.detail ?? '', /Réglages › Confidentialité › Service de localisation/);
  assert.equal(l?.act, 'gps');
});

test('GPS : éteint hors besoin → grisé sans action ; allumé sans point → orange « recherche »', () => {
  const off = L(avec({ needGps: false, gps: { on: false, lastAt: null } }), 'gps');
  assert.equal(off?.level, 'off'); assert.equal(off?.act, null);
  const cherche = L(avec({ gps: { lastAt: null } }), 'gps');
  assert.equal(cherche?.level, 'warn'); assert.match(cherche?.detail ?? '', /recherche/);
});

test('écran : demandé mais non tenu en course → rouge avec action wake ; hors course → grisé', () => {
  const l = L(avec({ wake: { held: false } }), 'screen');
  assert.equal(l?.level, 'bad'); assert.equal(l?.act, 'wake');
  assert.equal(L(avec({ needScreen: false, wake: { held: false, wanted: false } }), 'screen')?.level, 'off');
});

test('écran : API absente en course → rouge avec le conseil « Jamais » ; tenu → vert', () => {
  const l = L(avec({ wake: { supported: false, wanted: true, held: false } }), 'screen');
  assert.equal(l?.level, 'bad'); assert.match(l?.detail ?? '', /Jamais/);
  assert.equal(L(avec({ wake: { held: true } }), 'screen')?.level, 'ok');
});

test('écran : l’erreur de l’API est rappelée dans le détail', () => {
  const l = L(avec({ wake: { held: false, err: 'NotAllowedError' } }), 'screen');
  assert.match(l?.detail ?? '', /NotAllowedError/); assert.match(l?.detail ?? '', /Jamais/);
});

test('son : contexte interrompu → rouge « touchez pour réactiver » ; horloge figée → rouge', () => {
  const i = L(avec({ audio: { state: 'interrupted' } }), 'sound');
  assert.equal(i?.level, 'bad'); assert.match(i?.detail ?? '', /interrompu : touchez pour réactiver/); assert.equal(i?.act, 'sound');
  const f = L(avec({ audio: { state: 'running', alive: false } }), 'sound');
  assert.equal(f?.level, 'bad'); assert.equal(f?.act, 'sound');
  assert.equal(L(avec({ audio: { state: 'suspended' } }), 'sound')?.level, 'bad');
});

test('son : pas entendu au test → rouge (action test) ; non testé → orange ; entendu → vert', () => {
  const non = L(avec({ audio: { tested: false } }), 'sound');
  assert.equal(non?.level, 'bad'); assert.match(non?.detail ?? '', /pas entendu au test/); assert.equal(non?.act, 'test');
  const nt = L(avec({ audio: { tested: null } }), 'sound');
  assert.equal(nt?.level, 'warn'); assert.match(nt?.detail ?? '', /non testé/); assert.equal(nt?.act, 'test');
  const oui = L(avec({ audio: { tested: true } }), 'sound');
  assert.equal(oui?.level, 'ok'); assert.equal(oui?.act, null);
});

test('son : hors chrono et sans contexte → grisé ; avec besoin mais sans contexte → rouge', () => {
  assert.equal(L(avec({ needSound: false, audio: { state: null, alive: null, tested: null } }), 'sound')?.level, 'off');
  assert.equal(L(avec({ needSound: true, audio: { state: null, alive: null, tested: null } }), 'sound')?.level, 'bad');
});

test('réseau : hors ligne depuis 1 h → orange, jamais rouge', () => {
  const l = L(avec({ net: { online: false, lastOkAt: NOW - 3600e3 } }), 'net');
  assert.equal(l?.level, 'warn'); assert.notEqual(l?.level, 'bad');
  assert.match(l?.detail ?? '', /hors réseau/);
});

test('réseau : jamais vérifié → grisé ; sans réponse depuis plus de 10 min → orange ; vu récemment → vert avec le délai', () => {
  assert.equal(L(avec({ net: { online: true, lastOkAt: null } }), 'net')?.level, 'off');
  const vieux = L(avec({ net: { online: true, lastOkAt: NOW - NET_STALE_MS - 1000 } }), 'net');
  assert.equal(vieux?.level, 'warn'); assert.match(vieux?.detail ?? '', /aucune réponse depuis 10 min/);
  const ok = L(avec({ net: { online: true, lastOkAt: NOW - 5000, rtt: 83.4 } }), 'net');
  assert.equal(ok?.level, 'ok'); assert.match(ok?.detail ?? '', /83 ms/);
});

test('le réseau n’est jamais rouge, quoi qu’il arrive', () => {
  for (const net of [{ online: false, lastOkAt: null }, { online: false, lastOkAt: 0 }, { online: true, lastOkAt: 0 }, { online: true, lastOkAt: null }, {}]) {
    assert.notEqual(L(computeStatus({ ...bon(), net }), 'net')?.level, 'bad', JSON.stringify(net));
  }
});

test('worst : rouge s’il y a un rouge, orange s’il n’y a que de l’orange, sinon vert', () => {
  assert.equal(avec({ net: { online: false, lastOkAt: NOW - 3600e3 } }).worst, 'warn', 'réseau seul : orange');
  assert.equal(avec({ audio: { tested: null } }).worst, 'warn');
  assert.equal(avec({ audio: { tested: null }, wake: { held: false } }).worst, 'bad', 'un rouge l’emporte sur un orange');
});

test('chaque lampe porte une action connue ou null', () => {
  const pannes = [
    avec({ gps: { lastAt: NOW - 20_000 }, wake: { held: false }, audio: { state: 'interrupted' }, net: { online: false } }),
    avec({ audio: { tested: false } }), avec({ audio: { tested: null } }), computeStatus(bon()),
  ];
  for (const s of pannes) for (const l of s.lamps) {
    assert.ok([null, 'gps', 'wake', 'sound', 'test', 'net'].includes(l.act), `${l.id} : action ${l.act}`);
    assert.ok(['ok', 'warn', 'bad', 'off'].includes(l.level), `${l.id} : niveau ${l.level}`);
    assert.equal(typeof l.text, 'string'); assert.equal(typeof l.detail, 'string');
  }
  assert.equal(L(pannes[0], 'net')?.act, 'net');
});

test('entrées absentes : aucune exception, quatre lampes', () => {
  const s = computeStatus({ now: NOW });
  assert.equal(s.lamps.length, 4);
  assert.ok(['ok', 'warn', 'bad'].includes(s.worst));
});
