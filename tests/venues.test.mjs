// Plans d’eau (phase 7, D-03, D-05, D-07) : registre, Toulon par référence aux objets de js/courses.js, origine de Brest,
// moteur de bout en bout à Brest sans terrain. Ce fichier tourne dans son propre processus (node --test) : il peut passer à Brest.
// L’ordre compte : les tests de Toulon d’abord, puis le passage à Brest (un seul changement de plan d’eau par session).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as geo from '../js/geo.js';
import * as courses from '../js/courses.js';
import * as lieu from '../js/lieu.js';
import { VENUES, VENUE_IDS, bootVenue, inBounds, venueAt } from '../js/venues.js';
import { BREST } from '../js/venue-brest.js';
import { buildLegs } from '../js/tactics.js';
import { parseLatLon } from '../js/marks.js';
import { checkPos } from '../js/icplaus.js';
import { BANANE } from '../js/banane.js';

// ───────── Toulon (défaut)

test('registre : Toulon et Brest, identifiants en liste', () => {
  assert.deepEqual(VENUE_IDS, ['toulon', 'brest']);
  assert.deepEqual(Object.keys(VENUES), VENUE_IDS);
  assert.equal(VENUES.brest, BREST);
  for (const id of VENUE_IDS) assert.equal(VENUES[id].id, id);
});

test('Toulon par référence : les exports de lieu.js sont les objets de js/courses.js', () => {
  assert.equal(lieu.VENUE, VENUES.toulon);
  assert.equal(lieu.MARKS, courses.MARKS);
  assert.equal(lieu.COURSES, courses.COURSES);
  assert.equal(lieu.LINE_PRESETS, courses.LINE_PRESETS);
  assert.equal(lieu.PLACES, courses.PLACES);
  assert.equal(lieu.DANGERS, courses.DANGERS);
  assert.equal(lieu.FORBIDDEN_ZONES.length, 1);
  assert.equal(lieu.FORBIDDEN_ZONES[0], courses.FORBIDDEN_ZONE);
  assert.equal(VENUES.toulon.FORBIDDEN_ZONES, lieu.FORBIDDEN_ZONES, 'tableau créé une seule fois');
});

test('Toulon sans marée ni courant : le registre ne porte aucune marée ni aucun courant à Toulon (chemin de calcul de la v42)', () => {
  const t = VENUES.toulon;
  for (const k of ['tide', 'maree', 'current', 'courant']) assert.equal(t[k] ?? null, null, `Toulon : ${k}`);
  assert.equal(t.weather.marine, 'latitude=43.06&longitude=5.96', 'point marin de la v42 (vagues seulement affichées)');
  assert.equal(t.regimes, null, 'régimes de js/tactics.js');
});

test('Toulon : origine 43,09 / 5,95, emprise de data/meta.json, fichiers data/', async () => {
  assert.deepEqual(geo.ORIGIN, { lat: 43.09, lon: 5.95 });
  assert.deepEqual(VENUES.toulon.origin, { lat: 43.09, lon: 5.95 });
  const meta = await (await fetch('data/meta.json')).json();
  const b = VENUES.toulon.bounds;
  assert.deepEqual([b.south, b.north, b.west, b.east], [meta.south, meta.north, meta.west, meta.east]);
  assert.equal(VENUES.toulon.files.base, 'data/');
});

test('setVenue(\'toulon\') ne change rien (aucun recalcul)', () => {
  const avant = geo.toXY(43.0974, 5.9341), o = geo.ORIGIN;
  assert.equal(lieu.setVenue('toulon'), VENUES.toulon);
  assert.equal(geo.ORIGIN, o, 'origine non réassignée');
  assert.deepEqual(geo.toXY(43.0974, 5.9341), avant);
  assert.equal(lieu.MARKS, courses.MARKS);
});

test('bootVenue : liste blanche, Toulon sinon (valeur absente, inconnue, __proto__, non textuelle)', () => {
  assert.equal(bootVenue(undefined), 'toulon');
  assert.equal(bootVenue(null), 'toulon');
  assert.equal(bootVenue({}), 'toulon');
  assert.equal(bootVenue({ venue: 'marseille' }), 'toulon');
  assert.equal(bootVenue({ venue: '__proto__' }), 'toulon');
  assert.equal(bootVenue({ venue: 'constructor' }), 'toulon');
  assert.equal(bootVenue({ venue: 'hasOwnProperty' }), 'toulon');
  assert.equal(bootVenue(JSON.parse('{"venue": {"id": "brest"}}')), 'toulon');
  assert.equal(bootVenue({ venue: 'toulon' }), 'toulon');
  assert.equal(bootVenue({ venue: 'brest' }), 'brest');
});

test('inBounds et venueAt : bornes incluses, nombres finis', () => {
  const b = { south: 1, north: 2, west: -3, east: -2 };
  assert.ok(inBounds(b, 1, -3) && inBounds(b, 2, -2) && inBounds(b, 1.5, -2.5));
  assert.ok(!inBounds(b, 0.99, -2.5) && !inBounds(b, 1.5, -1.9) && !inBounds(b, NaN, -2.5) && !inBounds(b, 1.5, Infinity) && !inBounds(null, 1.5, -2.5));
  assert.equal(venueAt(43.0974, 5.9341), 'toulon');
  assert.equal(venueAt(48.29817, -4.3605), 'brest');
  assert.equal(venueAt(47.5, -3), null);
});

test('Brest : descripteur léger (emprise, bornes de saisie à ± 0,1°, fichiers à noms plats, catalogue initial non gelé)', () => {
  assert.deepEqual(BREST.origin, { lat: 48.33, lon: -4.45 });
  assert.deepEqual(BREST.bounds, { west: -4.66, east: -4.22, south: 48.22, north: 48.43 });
  const ib = BREST.inputBounds, r = (x) => Math.round(x * 1000) / 1000;
  assert.deepEqual([r(ib.south), r(ib.north), r(ib.west), r(ib.east)], [48.12, 48.53, -4.76, -4.12]);
  assert.equal(ib.nom, 'la rade de Brest');
  assert.equal(BREST.files.base, 'data/brest.');
  assert.ok(Object.isFrozen(BREST));
  assert.ok(!Object.isFrozen(BREST.MARKS) && !Object.isFrozen(BREST.COURSES), 'applyRegattaMarks et addBanane écrivent sur place');
  assert.deepEqual(BREST.LINE_PRESETS.zoneA, { label: 'Zone A du GPEN (centre)', lat: 48.29817, lon: -4.3605 });
});

// ───────── Positions Ouest et bornes du plan d’eau (D-07)

const MSG_TOULON = 'Position hors de la rade de Toulon : vérifiez les degrés et l’hémisphère';
// Marques de la rade relevées dans les IC du GPEN 2026, annexe 3.4 (07-RESEARCH-PLAN-EAU.md § 2.2) : [nom, lat °, lat ′, lon °, lon ′] (N, W)
const GPEN = [
  ['Plateau des Fillettes', 48, 19.752, 4, 35.654], ['Roche Mengam', 48, 20.330, 4, 34.560], ['Kerviniou', 48, 19.779, 4, 35.240],
  ['La Cormorandière', 48, 20.609, 4, 31.780], ['Pénoupèle', 48, 21.444, 4, 30.520], ['Basse du Renard', 48, 19.760, 4, 29.070],
  ['Duc d’Albe de Lanvéoc', 48, 17.840, 4, 27.150], ['Aulne n° 6', 48, 18.505, 4, 20.719], ['Océanopolis', 48, 22.520, 4, 26.730],
].map(([name, la, lam, lo, lom]) => ({ name, lat: la + lam / 60, lon: -(lo + lom / 60) }));
// distance en mètres entre deux positions (projection locale, indépendante de l’origine courante)
const metres = (a, b) => Math.hypot((b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180) * 111320, (b.lat - a.lat) * 110574);

test('fmtLon et fmtLat : Ouest et Sud écrits juste ; Est et Nord comme en v42', () => {
  assert.equal(geo.fmtLon(-4.3605), '004°21.630W');
  assert.equal(geo.fmtLon(-0.5), '000°30.000W');
  assert.equal(geo.fmtLon(-4.6), '004°36.000W');
  assert.equal(geo.fmtLat(-12.5), '12°30.000S');
  assert.equal(geo.fmtLat(48.29817), '48°17.890N');
  // v42 (figé aussi par la fixture `positions`)
  assert.equal(geo.fmtLon(5.934), '005°56.040E');
  assert.equal(geo.fmtLon(5.93415), '005°56.049E');
  assert.equal(geo.fmtLat(43.0975), '43°05.850N');
  assert.equal(geo.fmtLat(43.097417), '43°05.845N');
});

test('parseLatLon : position de Brest lue avec les bornes de Brest, refusée avec celles de Toulon (message de la v42)', () => {
  assert.deepEqual(parseLatLon('48°17,890 N 004°21,630 W', BREST.inputBounds), { lat: 48.298167, lon: -4.3605 });
  assert.deepEqual(parseLatLon('48°17,890 N 004°21,630 W'), { error: MSG_TOULON });
  assert.deepEqual(parseLatLon('43°05.845N 005°56.049E', BREST.inputBounds), { error: 'Position hors de la rade de Brest : vérifiez les degrés et l’hémisphère' });
  assert.deepEqual(parseLatLon('43°05.845N 005°56.049E'), { lat: 43.097417, lon: 5.93415 });
});

test('parseLatLon : exemple du plan d’eau dans le message « deux coordonnées attendues »', () => {
  assert.deepEqual(parseLatLon('48°17,890 N', BREST.inputBounds), { error: 'Deux coordonnées attendues, par exemple 48°17.890N 004°21.630W' });
  assert.deepEqual(parseLatLon('43°05.845N'), { error: 'Deux coordonnées attendues, par exemple 43°05.845N 005°56.049E' });
});

test('aller-retour à Brest : fmtLat / fmtLon puis parseLatLon rendent chaque marque du GPEN à moins de 1 m', () => {
  for (const m of GPEN) {
    const txt = geo.fmtLat(m.lat) + ' ' + geo.fmtLon(m.lon);
    assert.match(txt, /^48°\d\d\.\d{3}N 004°\d\d\.\d{3}W$/, m.name);
    const r = parseLatLon(txt, BREST.inputBounds);
    assert.ok(!r.error, `${m.name} : ${r.error}`);
    assert.ok(metres(m, r) < 1, `${m.name} : ${metres(m, r)} m`);
    assert.ok(inBounds(BREST.bounds, r.lat, r.lon), `${m.name} dans l’emprise`);
  }
});

test('checkPos : bornes du plan d’eau en paramètre ; Toulon par défaut (v42)', () => {
  assert.deepEqual(checkPos(48.29817, -4.3605, { bounds: BREST.bounds }), { level: 'ok', msg: '' });
  assert.deepEqual(checkPos(48.29817, -4.3605), { level: 'bad', msg: 'position hors de la carte' });
  assert.deepEqual(checkPos(43.0974, 5.9341, { bounds: BREST.bounds }), { level: 'bad', msg: 'position hors de la carte' });
  assert.deepEqual(checkPos(43.0974, 5.9341), { level: 'ok', msg: '' });
  assert.deepEqual(checkPos(43.0974, 5.9341, { bounds: VENUES.toulon.bounds }), { level: 'ok', msg: '' });
  for (const m of GPEN) assert.equal(checkPos(m.lat, m.lon, { bounds: BREST.bounds }).level, 'ok', m.name);
});

// ───────── Passage à Brest (une fois pour toute la suite du fichier)

test('setVenue(\'brest\') : origine de Brest, exports vivants du catalogue de Brest', () => {
  assert.equal(lieu.setVenue('brest'), BREST);
  assert.equal(lieu.VENUE, BREST);
  assert.deepEqual(geo.ORIGIN, { lat: 48.33, lon: -4.45 });
  assert.deepEqual(geo.toXY(48.33, -4.45), { x: 0, y: 0 });
  assert.equal(lieu.MARKS, BREST.MARKS);
  assert.equal(lieu.COURSES, BREST.COURSES);
  assert.equal(lieu.LINE_PRESETS, BREST.LINE_PRESETS);
  assert.equal(lieu.FORBIDDEN_ZONES, BREST.FORBIDDEN_ZONES);
  // les objets de Toulon ne sont pas touchés
  assert.ok(courses.MARKS[1] && courses.COURSES.length >= 13);
});

test('Brest : aller-retour toXY / toLL au millimètre sur toute l’emprise', () => {
  for (const lat of [48.22, 48.29817, 48.43]) for (const lon of [-4.66, -4.3605, -4.22]) {
    const p = geo.toXY(lat, lon), q = geo.toLL(p.x, p.y), back = geo.toXY(q.lat, q.lon);
    assert.ok(Math.hypot(back.x - p.x, back.y - p.y) < 1e-3, `${lat} ${lon}`);
    assert.ok(Math.abs(q.lat - lat) < 1e-8 && Math.abs(q.lon - lon) < 1e-8);
  }
  // l’Ouest est à gauche, le Sud en bas
  assert.ok(geo.toXY(48.33, -4.6).x < 0 && geo.toXY(48.25, -4.45).y < 0);
});

test('un second setVenue vers un autre plan d’eau est refusé (changer de plan d’eau = recharger)', () => {
  assert.throws(() => lieu.setVenue('toulon'), { message: 'changer de plan d’eau demande un rechargement de l’app' });
  assert.equal(lieu.VENUE, BREST);
  assert.deepEqual(geo.ORIGIN, { lat: 48.33, lon: -4.45 });
  assert.equal(lieu.setVenue('brest'), BREST, 'même plan d’eau : accepté, sans effet');
});

test('moteur de bout en bout à Brest (sans terrain) : banane sur la ligne de la zone A, B à 0,8 Nq au 270°', () => {
  const r = buildLegs(BANANE, 'G', { laps: 2, windDir: 270, line: { center: lieu.LINE_PRESETS.zoneA, lengthNm: 0.12, mode: 'wind' } });
  assert.ok(r.legs.length >= 5);
  for (const l of r.legs) for (const v of [l.from.x, l.from.y, l.to.x, l.to.y, l.dist, l.brg]) assert.ok(Number.isFinite(v));
  const c = geo.toXY(48.29817, -4.3605);
  assert.ok(Math.hypot(r.line.c.x - c.x, r.line.c.y - c.y) < 1e-6, 'centre de la ligne = centre de la zone A');
  const B = r.points.B;
  assert.ok(Math.abs(geo.distXY(r.line.c, B) - 0.8 * geo.NM) < 1e-6);
  assert.ok(Math.abs(geo.norm180(geo.bearingXY(r.line.c, B) - 270)) < 1e-6);
  const ll = geo.toLL(B.x, B.y);
  assert.equal(venueAt(ll.lat, ll.lon), 'brest');
});
