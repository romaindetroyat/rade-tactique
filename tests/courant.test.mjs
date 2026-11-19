// Courant de la rade de Brest (D-13) et fonds (D-14c) : js/courant.js sur data/brest.courants.{json,bin} et data/brest.fonds.bin
// (tools/build_courants.py, atlas 560 du Shom, rade de Brest, 100 m). Valeurs de contrôle de l’étude (07-RESEARCH-PLAN-EAU.md § 4.3 et
// § 6.4) : l’étude les a lues au nœud de l’atlas le plus proche de chaque position ; les tests les relisent à ces mêmes nœuds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { chargeAtlas, courantEn, fondEn } from '../js/courant.js';
import { mareeEn } from '../js/maree.js';
import { BREST } from '../js/venue-brest.js';
import { ROOT, fixture } from './helpers/setup.mjs';

const lit = (p) => { const b = readFileSync(ROOT + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const HEAD = JSON.parse(readFileSync(ROOT + 'data/brest.courants.json', 'utf8'));
const A = chargeAtlas(HEAD, lit('data/brest.courants.bin'), lit('data/brest.fonds.bin'));
const P = JSON.parse(readFileSync(ROOT + 'data/brest.maree.json', 'utf8'));
const H = 3600000, KN = 3600 / 1852, CY = 12.42 * H;
const nd = (c) => Math.hypot(c.u, c.v) * KN;
const cap = (c) => ((Math.atan2(c.u, c.v) * 180 / Math.PI) + 360) % 360;      // direction VERS laquelle porte le courant
const ecartCap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Marée de synthèse : pleine mer la plus proche à T − hm, cycles de 12 h 25, marnage donné (avant et après la basse mer qui sépare les cycles)
function maree(hm, marnage, { apres: m2 = marnage } = {}) {
  const T = Date.UTC(2027, 4, 6, 12), pm = T - hm * H, PMH = 7.0;
  const [avant, apres] = hm >= 0 ? [pm, pm + CY] : [pm - CY, pm];
  const entre = { t: (avant + apres) / 2, h: PMH - marnage };
  return { t: T, pm: { t: pm, h: PMH }, bm: entre, marnage, hm, avant: { t: avant, h: PMH }, apres: { t: apres, h: entre.h + m2 }, entre };
}
// Nœud de l’atlas le plus proche d’une position (méthode de lecture de l’étude)
const g = HEAD.grid;
const noeud = (lat, lon) => ({ lat: g.lat0 + Math.round((lat - g.lat0) / g.dlat) * g.dlat, lon: g.lon0 + Math.round((lon - g.lon0) / g.dlon) * g.dlon });

// Positions de l’étude (§ 4.3, script de lecture de l’atlas) : goulet, milieu entre la Pointe des Espagnols et le Portzic ; zone A du GPEN,
// centre (IC GPEN 2026) ; zone F, devant la baie de Roscanvel
const GOULET = noeud(48.3490, -4.5400), ZONE_A = noeud(48.29817, -4.3605), ZONE_F = noeud(48.31825, -4.5275);

const proche = (c, vitesse, dir, quoi) => {
  assert.ok(c, `${quoi} : courant attendu`);
  assert.ok(Math.abs(nd(c) - vitesse) <= 0.05, `${quoi} : ${nd(c).toFixed(3)} nd au lieu de ${vitesse}`);
  assert.ok(ecartCap(cap(c), dir) <= 5, `${quoi} : vers ${cap(c).toFixed(1)}° au lieu de ${dir}°`);
};

test('en-tête : grille, 13 heures, coefficients 45 et 95, source, licence, DOI et avertissement du Shom', () => {
  assert.equal(HEAD.hours, 13);
  assert.deepEqual(HEAD.coefs, [45, 95]);
  assert.equal(HEAD.scale, 0.02);
  assert.equal(HEAD.grid.ni, 277); assert.equal(HEAD.grid.nj, 182);
  assert.equal(HEAD.sea, 17397);
  assert.match(HEAD.source, /Shom – Atlas de courants de marée 2D \(édition de juin 2026\), rade de Brest, 100 m/);
  assert.equal(HEAD.licence, 'Licence Ouverte 2.0');
  assert.equal(HEAD.doi, '10.17183/ATLASCOURANTS2D_NETCDF');
  assert.equal(HEAD.avertissement, 'À n’utiliser qu’en complément des cartes et ouvrages nautiques officiels');
  assert.equal(typeof HEAD.ordre, 'string');
  assert.ok(HEAD.fonds && HEAD.fonds.file === 'data/brest.fonds.bin');
});

test('atlas décodé : redonne les valeurs de l’atlas aux heures pleines à un demi-pas près (0,01 m/s)', () => {
  const F = JSON.parse(fixture('brest-courant-atlas.json'));
  assert.match(F.source, /10\.17183\/ATLASCOURANTS2D_NETCDF/);
  let n = 0;
  for (const p of F.points) for (const [hm, c45, c95] of p.heures) {
    for (const [mar, ref] of [[2.80, c45], [5.90, c95]]) {
      const c = courantEn(A, maree(hm, mar), p.lat, p.lon);
      assert.ok(Math.abs(c.u - ref[0]) <= 0.0101 && Math.abs(c.v - ref[1]) <= 0.0101, `${p.lat} ${p.lon} PM${hm >= 0 ? '+' : ''}${hm} h`);
      n++;
    }
  }
  assert.ok(n >= 400, `${n} valeurs`);
});

test('entre deux heures : interpolation linéaire proche de l’atlas à 5 min (écart quadratique sous 0,08 nd)', () => {
  const F = JSON.parse(fixture('brest-courant-atlas.json'));
  let s = 0, n = 0;
  for (const p of F.points) for (const [hm, ref] of p.demi) {
    const c = courantEn(A, maree(hm, 5.90), p.lat, p.lon);
    s += ((c.u - ref[0]) ** 2 + (c.v - ref[1]) ** 2) * KN * KN; n++;
  }
  assert.ok(n >= 50);
  assert.ok(Math.sqrt(s / n) < 0.08, `écart quadratique ${Math.sqrt(s / n).toFixed(3)} nd`);
});

test('goulet, milieu entre les Espagnols et le Portzic, vive-eau : 3,6 nd vers 077° à PM−3 h, 3,5 nd vers 272° à PM+4 h', () => {
  proche(courantEn(A, maree(-3, 5.90), GOULET.lat, GOULET.lon), 3.6, 77, 'goulet PM−3 h');
  proche(courantEn(A, maree(4, 5.90), GOULET.lat, GOULET.lon), 3.5, 272, 'goulet PM+4 h');
});

test('zone A, centre : 0,5 nd vers 107° à PM−4 h, 0,6 nd vers 274° à PM+4 h ; zone F : 0,7 nd vers 304° à PM', () => {
  proche(courantEn(A, maree(-4, 5.90), ZONE_A.lat, ZONE_A.lon), 0.5, 107, 'zone A PM−4 h');
  proche(courantEn(A, maree(4, 5.90), ZONE_A.lat, ZONE_A.lon), 0.6, 274, 'zone A PM+4 h');
  proche(courantEn(A, maree(0, 5.90), ZONE_F.lat, ZONE_F.lon), 0.7, 304, 'zone F PM');
});

test('le flot porte à l’est dans le goulet à PM−3 h, le jusant à l’ouest à PM+4 h (directions jamais inversées)', () => {
  for (const mar of [2.80, 4.35, 5.90]) {
    assert.ok(courantEn(A, maree(-3, mar), GOULET.lat, GOULET.lon).u > 0, `flot, marnage ${mar}`);
    assert.ok(courantEn(A, maree(4, mar), GOULET.lat, GOULET.lon).u < 0, `jusant, marnage ${mar}`);
  }
  // avec la vraie marée : 6 mai 2027 (GPEN), trois heures avant la pleine mer de 17:50 (heure légale)
  const ms = Date.parse('2027-05-06T14:50:00+02:00'), M = mareeEn(P, ms);
  assert.ok(Math.abs(M.hm + 3) < 0.1);
  const c = courantEn(A, M, GOULET.lat, GOULET.lon);
  assert.ok(c.u > 0 && nd(c) > 3, `${nd(c).toFixed(2)} nd vers ${cap(c).toFixed(0)}°`);
});

test('dosage par le marnage : 5,90 m = vive-eau (95), 2,80 m = morte-eau (45), 4,35 m = moyenne des deux, jamais une règle de trois', () => {
  const F = JSON.parse(fixture('brest-courant-atlas.json'));
  const p = F.points[0], [hm, c45, c95] = p.heures[1];
  const at = (mar) => courantEn(A, maree(hm, mar), p.lat, p.lon);
  const ve = at(5.90), me = at(2.80), mi = at(4.35);
  const ve2 = courantEn(A, maree(-3, 5.90), GOULET.lat, GOULET.lon), me2 = courantEn(A, maree(-3, 2.80), GOULET.lat, GOULET.lon);
  const mi2 = courantEn(A, maree(-3, 4.35), GOULET.lat, GOULET.lon);
  assert.ok(Math.abs(mi2.u - (ve2.u + me2.u) / 2) < 1e-9 && Math.abs(mi2.v - (ve2.v + me2.v) / 2) < 1e-9);
  assert.ok(Math.abs(mi.u - (ve.u + me.u) / 2) < 1e-9);
  assert.ok(Math.abs(ve.u - c95[0]) <= 0.0101 && Math.abs(me.u - c45[0]) <= 0.0101);
  // règle de trois (courant ∝ marnage) : 2,80 / 5,90 du courant de vive-eau ; l’atlas de morte-eau est plus faible (étude § 4.3, piège 6)
  assert.ok(nd(me2) < nd(ve2) * 2.80 / 5.90 - 0.1, `morte-eau ${nd(me2).toFixed(2)} nd, vive-eau ${nd(ve2).toFixed(2)} nd`);
  // dosage borné : au-delà des coefficients de l’atlas, extrapolation limitée
  const fort = courantEn(A, maree(-3, 12), GOULET.lat, GOULET.lon), borne = courantEn(A, maree(-3, 2.80 + 1.4 * 3.10), GOULET.lat, GOULET.lon);
  assert.ok(Math.abs(fort.u - borne.u) < 1e-9);
});

test('entre PM+6 h d’un cycle et PM−6 h du suivant : valeur entre les deux, sans saut', () => {
  const T = Date.UTC(2027, 4, 6, 12);
  const pts = [GOULET, ZONE_A];
  for (const p of pts) {
    // cycle de 12 h 25 : de PM+6 h à la PM−6 h suivante, 25 min de liaison ; marnage 5,90 m avant la basse mer, 2,80 m après
    const M = (dt) => { const m = maree(0, 5.90, { apres: 2.80 }); return { ...m, t: m.avant.t + dt * H }; };
    const fin = courantEn(A, maree(6, 5.90), p.lat, p.lon), debut = courantEn(A, maree(-6, 2.80), p.lat, p.lon);
    const a = courantEn(A, M(6), p.lat, p.lon), b = courantEn(A, M(12.42 - 6), p.lat, p.lon), mid = courantEn(A, M(6.21), p.lat, p.lon);
    assert.ok(Math.abs(a.u - fin.u) < 1e-9 && Math.abs(b.u - debut.u) < 1e-9, 'bords de la liaison : dernière et première heures');
    assert.ok(Math.abs(mid.u - (fin.u + debut.u) / 2) < 1e-6 && Math.abs(mid.v - (fin.v + debut.v) / 2) < 1e-6, 'milieu : moyenne');
    let prev = null, saut = 0;
    for (let dt = 5; dt <= 7.5; dt += 1 / 60) {
      const c = courantEn(A, M(dt), p.lat, p.lon);
      if (prev) saut = Math.max(saut, Math.hypot(c.u - prev.u, c.v - prev.v) * KN);
      prev = c;
    }
    assert.ok(saut < 0.05, `plus grand écart d’une minute à l’autre : ${saut.toFixed(3)} nd`);
  }
  assert.ok(T > 0);
});

test('à terre, hors de la grille, hors des années de marée : null, jamais NaN', () => {
  const M = maree(-3, 5.90);
  assert.equal(courantEn(A, M, 48.3050, -4.5050), null, 'Île Longue');
  assert.equal(courantEn(A, M, 48.2300, -4.4000), null, 'sud de la grille');
  assert.equal(courantEn(A, M, 48.3300, -4.7000), null, 'ouest de la grille');
  assert.equal(courantEn(A, null, GOULET.lat, GOULET.lon), null, 'pas de marée');
  assert.equal(courantEn(A, mareeEn(P, Date.UTC(2032, 4, 1)), GOULET.lat, GOULET.lon), null, '2032');
  assert.equal(courantEn(A, M, NaN, GOULET.lon), null);
  // près de la côte : moyenne des voisins en mer, un nombre fini
  for (let k = 0; k < 400; k++) {
    const c = courantEn(A, maree(-6 + (k % 13), 2.80 + (k % 7) * 0.5), 48.25 + (k * 0.0004), -4.62 + k * 0.00092);
    if (c) assert.ok(Number.isFinite(c.u) && Number.isFinite(c.v));
  }
});

test('fonds vrais (EMODnet, zéro des cartes) : zone A vers −8,7 m, goulet au Portzic plus profond que −25 m', () => {
  const a = fondEn(A, 48.29817, -4.3605);
  assert.ok(Math.abs(a - -8.7) <= 1.5, `zone A ${a} m`);
  const goulet = fondEn(A, GOULET.lat, GOULET.lon);
  assert.ok(goulet < -25, `goulet ${goulet} m`);
  assert.equal(fondEn(A, 48.10, -4.40), null, 'hors de la grille');
  assert.equal(fondEn(chargeAtlas(HEAD, lit('data/brest.courants.bin')), 48.29817, -4.3605), null, 'fonds non chargés');
});

test('chargeAtlas : refuse un fichier tronqué ou un en-tête incohérent (message en français)', () => {
  const bin = lit('data/brest.courants.bin');
  assert.throws(() => chargeAtlas(HEAD, bin.slice(0, bin.byteLength - 1)), /atlas de courant/);
  assert.throws(() => chargeAtlas({ ...HEAD, sea: HEAD.sea + 1 }, bin), /atlas de courant/);
  assert.throws(() => chargeAtlas({ ...HEAD, hours: 12 }, bin), /atlas de courant/);
  assert.throws(() => chargeAtlas(null, bin), /atlas de courant/);
  assert.throws(() => chargeAtlas(HEAD, bin, new ArrayBuffer(10)), /fonds/);
});

test('pack de Brest : fichiers du courant dans le manifeste, moins de 8 Mo ; chemins dans le descripteur', () => {
  assert.deepEqual(BREST.courant, { header: 'data/brest.courants.json', bin: 'data/brest.courants.bin', fonds: 'data/brest.fonds.bin' });
  const man = JSON.parse(readFileSync(ROOT + 'data/venues.json', 'utf8')).venues.brest;
  for (const f of ['data/brest.courants.bin', 'data/brest.courants.json', 'data/brest.fonds.bin']) assert.ok(man.files.some((x) => x.path === f), f);
  assert.ok(man.bytes < 8e6, `${man.bytes} octets`);
  assert.ok(statSync(ROOT + 'data/brest.courants.bin').size < 1.0e6);
  assert.ok(statSync(ROOT + 'data/brest.fonds.bin').size < 120e3);
});
