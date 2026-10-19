// Calculs de base figés par des cas fabriqués : géométrie, polaire, champ de vent, routage, découpage en bords.
// Valeurs exécutées sur le code le 19/10/2026, arrondies à la précision d’affichage (D-12 : pas de tolérance large).
// Si un de ces tests échoue après un changement voulu du modèle, présenter l’avant/après à Romain avant de le mettre à jour.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/setup.mjs';
import { Terrain, toXY, toLL, bearingXY, norm180 } from '../js/geo.js';
import { boatSpeed, optimalAngles, spiMinTwa } from '../js/polar.js';
import { WindField } from '../js/wind.js';
import { route } from '../js/router.js';
import { buildLegs } from '../js/tactics.js';
import { MARKS, COURSES, DEFAULT_LINE } from '../js/courses.js';

const arr = (x, n) => Math.round(x * 10 ** n) / 10 ** n;

let T, F;
before(async () => {
  T = await new Terrain().load('data/');
  F = new WindField(T);
  // vent de base 60° / 8 nd, rafale 11, effets locaux complets
  F.compute({ points: [{ x: 0, y: 0, dir: 60, spd: 8, gust: 11 }] }, { localEffects: 1 });
});

test('géométrie : projection locale, aller-retour, relèvements et angle normalisé', () => {
  const p = toXY(43.1, 5.95);
  assert.equal(p.x, 0);
  assert.equal(arr(p.y, 2), 1105.74);
  const ll = toLL(p.x, p.y);
  assert.equal(arr(ll.lat, 9), 43.1);
  assert.equal(arr(ll.lon, 9), 5.95);
  assert.equal(bearingXY({ x: 0, y: 0 }, { x: 0, y: 100 }), 0);
  assert.equal(bearingXY({ x: 0, y: 0 }, { x: 100, y: 0 }), 90);
  assert.equal(norm180(190), -170);
});

test('polaire : vitesse du J80, angles de VMG et angle minimal de spi', () => {
  assert.equal(arr(boatSpeed(10, 90), 2), 6.52);
  assert.equal(arr(boatSpeed(6, 45), 4), 4.6267);
  const o = optimalAngles(10);
  assert.deepEqual([o.up.twa, arr(o.up.vmg, 4), arr(o.up.bsp, 2)], [38, 4.3656, 5.54]);
  assert.deepEqual([o.down.twa, arr(o.down.vmg, 4), arr(o.down.bsp, 4)], [150.5, 5.2921, 6.0803]);
  assert.equal(spiMinTwa(10), 100);
});

test('vent : champ local sur le vrai terrain (vent de base 60° / 8 nd)', () => {
  const a = F.sample(toXY(43.09, 5.96).x, toXY(43.09, 5.96).y);
  const b = F.sample(toXY(43.07, 5.93).x, toXY(43.07, 5.93).y);
  assert.deepEqual([arr(a.spd, 2), arr(a.dir, 2)], [5.92, 73.67]);
  assert.deepEqual([arr(b.spd, 2), arr(b.dir, 2)], [4.48, 59.61]);
});

test('routage : bouée 7 vers bouée 6 dans ce champ (durée, manœuvres, points)', () => {
  const A = toXY(MARKS['7'].lat, MARKS['7'].lon), B = toXY(MARKS['6'].lat, MARKS['6'].lon);
  const r = route(A, B, F, { terrain: T, forbidden: [], perf: 1 });
  assert.equal(arr(r.time, 1), 2357.7);
  assert.equal(r.maneuvers, 1);
  assert.equal(r.path.length, 42);
});

test('bords : parcours 4, classe P, un tour, vent 60° (nombre de bords, premier bord)', () => {
  const c4 = COURSES.find((c) => c.id === 4);
  const L = buildLegs(c4, 'P', { laps: 1, windDir: 60, line: { center: { lat: DEFAULT_LINE.lat, lon: DEFAULT_LINE.lon }, lengthNm: DEFAULT_LINE.lengthNm, mode: 'wind' } });
  assert.equal(L.legs.length, 8);
  assert.deepEqual(L.legs.map((l) => l.mark), ['7', '6', '5', '4', '3', '2', '1', 'FINISH']);
  assert.equal(Math.round(L.legs[0].dist), 3637);
  assert.equal(Math.round(L.legs[0].brg), 113);
});
