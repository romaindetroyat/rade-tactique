// Bateau de l’espace Tofinou (08-05, D-09) : polaire du Tofinou 9.5 tirée du certificat ORC Club 2026 d’un sister-ship (référence 03510004F1O),
// polaire par défaut de l’espace, recalage ; Naos garde le J80 à l’identique. Valeurs de contrôle : 08-RESEARCH-PLAN-EAU.md § 5.3 et § 6.5.
// Ce fichier tourne dans son propre processus (node --test) : la polaire courante de js/polar.js lui est propre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT } from './helpers/setup.mjs';
import { getPolar, setPolar, resetPolar, parsePolar, polarSource, boatSpeed, optimalAngles, DEFAULT_TWS, DEFAULT_TWA, DEFAULT_BSP } from '../js/polar.js';
import { ORC_TWS, ORC_TWA, ORC_BSP } from '../js/polar-orc.js';
import { TOF_TWS, TOF_TWA, TOF_BSP, TOF_SOURCES } from '../js/polar-tofinou95.js';
import { ESPACES } from '../js/espaces.js';
import { BATEAU_KEY, voileDe, varianteDe, appliquerPolaireEspace } from '../js/bateau.js';
import { setVenue } from '../js/lieu.js';
import { Terrain, toXY } from '../js/geo.js';
import { WindField } from '../js/wind.js';
import { route } from '../js/router.js';

const J80_SOURCE = 'ORC One Design 2023 (J-80 OD)';                  // polarSource de la v43
const lire = (f) => readFileSync(join(ROOT, f), 'utf8');
const pres = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a.toFixed(3)} au lieu de ${b} ± ${tol}`);

// Stockage espion : lectures et écritures notées
function espion(init = {}) {
  const m = new Map(Object.entries(init)), journal = [];
  return {
    journal,
    getItem: (k) => { journal.push(['get', k]); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { journal.push(['set', k]); m.set(k, String(v)); },
    removeItem: (k) => { journal.push(['del', k]); m.delete(k); },
    valeur: (k) => m.get(k) ?? null,
  };
}

test('Naos : aucune polaire d’espace, aucune lecture ni écriture de stockage ; « Polaire par défaut » revient au J80 de la v43', () => {
  const s = espion({ [BATEAU_KEY]: '{"voile":"foc"}' });
  assert.equal(appliquerPolaireEspace(ESPACES.naos, s), null);
  assert.equal(voileDe(ESPACES.naos, s), null);
  assert.deepEqual(s.journal, []);
  setPolar([6, 10], [0, 40, 90], [[0, 0], [4, 5], [5, 6]], 'essai.pol');
  resetPolar();
  assert.equal(polarSource, J80_SOURCE);
  const P = getPolar();
  assert.deepEqual([P.tws, P.twa, P.bsp], [ORC_TWS, ORC_TWA, ORC_BSP]);
  assert.deepEqual([DEFAULT_TWS, DEFAULT_TWA, DEFAULT_BSP], [ORC_TWS, ORC_TWA, ORC_BSP]);
});

test('outil de la polaire du Tofinou : --check en 0 (data/tofinou95.pol et js/polar-tofinou95.js à jour)', () => {
  execFileSync(process.execPath, ['tools/build_polar_tofinou.mjs', '--check'], { cwd: ROOT, stdio: 'pipe' });
});

test('extrait du certificat : référence 03510004F1O, type CLUB, vents 4 à 24 nd, aucun nom de bateau, de personne ni de club', () => {
  const c = JSON.parse(lire('tools/boats/tofinou95.orc.json'));
  assert.equal(c.RefNo, '03510004F1O');
  assert.equal(c.C_Type, 'CLUB');
  assert.equal(c.Class, 'TOFINOU 950');
  assert.deepEqual(c.Allowances.WindSpeeds, [4, 6, 8, 10, 12, 14, 16, 20, 24]);
  assert.deepEqual(Object.keys(c).sort(), ['Allowances', 'C_Type', 'Class', 'Family', 'IssueDate', 'NatAuth', 'RefNo']);
  for (const k of ['YachtName', 'SailNo', 'Owner', 'Club', 'Designer', 'Builder', 'BIN', 'CertNo']) assert.ok(!(k in c), k);
});

test('data/tofinou95.pol : format de data/j80.pol, moins de 1 200 octets, relu par parsePolar = table du module (génois du certificat)', () => {
  const txt = lire('data/tofinou95.pol');
  assert.ok(statSync(join(ROOT, 'data/tofinou95.pol')).size < 1200);
  assert.match(txt, /^TWA\\TWS\t4\t6\t8\t10\t12\t14\t16\t20\t24\n30\t/);
  assert.equal(txt.split('\n')[0].split('\t').length, lire('data/j80.pol').split('\n')[0].split('\t').length);
  const p = parsePolar(txt);
  assert.deepEqual(p.tws, TOF_TWS);
  assert.deepEqual([0, ...p.twa], TOF_TWA);
  assert.deepEqual([TOF_TWS.map(() => 0), ...p.bsp], TOF_BSP);
  assert.equal(TOF_SOURCES.genois, 'ORC Club 2026 (Tofinou 9.5, sister-ship) — à recaler');
});

test('espace Tofinou : polaire par défaut du Tofinou (génois) ; cibles par 10 nd : VMG près 4,74, portant 5,39, travers 7,03 (± 0,02)', () => {
  const s = espion();
  assert.equal(appliquerPolaireEspace(ESPACES.tofinou, s), 'genois');
  assert.ok(s.journal.every(([op, k]) => op === 'get' && k === BATEAU_KEY), 'lecture de rade.bateau.v1 seulement');
  assert.equal(polarSource, TOF_SOURCES.genois);
  const o = optimalAngles(10);
  pres(o.up.vmg, 4.74, 0.02, 'VMG près');
  pres(o.down.vmg, 5.39, 0.02, 'VMG portant');
  pres(boatSpeed(10, 90), 7.03, 0.02, 'travers');
  // cibles de l’étude (§ 5.3) pour toutes les forces : VMG à 0,02 nd
  const cibles = { 4: [2.53, 2.51], 6: [3.59, 3.63], 8: [4.34, 4.58], 12: [4.89, 5.98], 14: [4.97, 6.43], 16: [5.04, 6.83], 20: [5.10, 7.92], 24: [5.06, 10.02] };
  for (const [t, [up, down]] of Object.entries(cibles)) { const r = optimalAngles(+t); pres(r.up.vmg, up, 0.02, `près ${t} nd`); pres(r.down.vmg, down, 0.02, `portant ${t} nd`); }
});

test('recalage : une polaire importée garde la priorité ; « Polaire par défaut » revient au Tofinou, pas au J80', () => {
  appliquerPolaireEspace(ESPACES.tofinou, espion());
  setPolar([6, 10], [0, 40, 90], [[0, 0], [4, 5], [5, 6]], 'perso.pol');
  assert.equal(polarSource, 'perso.pol');
  resetPolar();
  assert.equal(polarSource, TOF_SOURCES.genois);
  assert.deepEqual(getPolar().bsp, TOF_BSP);
});

test('voile d’avant : valeur inconnue, illisible ou absente → génois ; variante d’une voile inconnue → null', () => {
  for (const v of [null, '', 'xx', '{"voile":"spi"}', '{"voile":1}', '[]']) assert.equal(voileDe(ESPACES.tofinou, espion(v == null ? {} : { [BATEAU_KEY]: v })), 'genois', String(v));
  assert.equal(voileDe(ESPACES.tofinou, { getItem: () => { throw new Error('indisponible'); } }), 'genois');
  assert.equal(varianteDe(ESPACES.tofinou, 'spi'), null);
  assert.equal(varianteDe(ESPACES.naos, 'genois'), null);
});

// Début du SHA-256 des fichiers de 5e9b8a5 (v43), relevé une fois : aucun appel à git pendant npm test (un déploiement peut ne pas avoir l’historique)
const J80_V43 = { 'tools/build_polar.mjs': 'ec351de2101be7ea', 'data/j80.pol': '132707ebcd36a078', 'js/polar-orc.js': 'f26e2e0f74949bc2' };
test('outil, polaire et module du J80 intacts (= 5e9b8a5, à l’octet)', () => {
  for (const [f, h] of Object.entries(J80_V43)) assert.equal(createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex').slice(0, 16), h, f);
});

// Route de Bormes : du large de La Fourmigue (300 m à l’ouest du rocher) à la ligne du Lavandou, avec le pack du dépôt
const PACK = existsSync(join(ROOT, 'data/bormes.meta.json'));
test('route de Bormes (La Fourmigue → ligne du Lavandou) : plus rapide avec la polaire du Tofinou qu’avec celle du J80, par 10 nd d’ouest et au près par 10 nd de nord-ouest', { skip: PACK ? false : 'pack de Bormes absent' }, async () => {
  setVenue('bormes');
  const T = await new Terrain().load('data/bormes.');
  const de = toXY(43.10603, 6.40050), vers = toXY(43.133, 6.381);
  for (const dir of [270, 330]) {
    const F = new WindField(T);
    F.compute({ points: [{ x: 0, y: 0, dir, spd: 10 }] });
    const opts = { terrain: T, forbidden: [], perf: 1 };
    setPolar(ORC_TWS, ORC_TWA, ORC_BSP, J80_SOURCE);
    const j80 = route(de, vers, F, opts);
    appliquerPolaireEspace(ESPACES.tofinou, espion());
    const tof = route(de, vers, F, opts);
    assert.ok(j80 && tof, 'deux routes');
    assert.ok(tof.time < j80.time, `${dir}° : Tofinou ${tof.time.toFixed(0)} s, J80 ${j80.time.toFixed(0)} s`);
  }
});
