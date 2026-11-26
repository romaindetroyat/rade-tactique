// Plans d’eau (phase 7, D-03, D-05, D-07) : registre, Toulon par référence aux objets de js/courses.js, origine de Brest,
// moteur de bout en bout à Brest sans terrain. Ce fichier tourne dans son propre processus (node --test) : il peut passer à Brest.
// L’ordre compte : les tests de Toulon d’abord, puis le passage à Brest (un seul changement de plan d’eau par session).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as geo from '../js/geo.js';
import * as courses from '../js/courses.js';
import * as lieu from '../js/lieu.js';
import { VENUES, VENUE_IDS, bootVenue, inBounds, venueAt, venueOf, needsVenueRepair, zonesXY } from '../js/venues.js';
import { VENUE_IDS as ARCHIVE_VENUE_IDS } from '../js/archmerge.js';
import { BREST } from '../js/venue-brest.js';
import { BORMES } from '../js/venue-bormes.js';
import { ESPACES } from '../js/espaces.js';
import { buildLegs } from '../js/tactics.js';
import { parseLatLon } from '../js/marks.js';
import { checkPos } from '../js/icplaus.js';
import * as weather from '../js/weather.js';
import { WindField } from '../js/wind.js';
import { fixture } from './helpers/setup.mjs';
import { BANANE } from '../js/banane.js';

// ───────── Toulon (défaut)

test('registre : Toulon, Brest et Bormes, identifiants en liste', () => {
  assert.deepEqual(VENUE_IDS, ['toulon', 'brest', 'bormes']);
  assert.deepEqual(Object.keys(VENUES), VENUE_IDS);
  assert.equal(VENUES.brest, BREST);
  assert.equal(VENUES.bormes, BORMES);
  // chaque plan d’eau appartient à un espace et un seul
  const ouverts = Object.values(ESPACES).flatMap((e) => e.venues);
  assert.deepEqual([...ouverts].sort(), [...VENUE_IDS].sort());
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
  assert.equal(lieu.FORBIDDEN_ZONES[0].pts, courses.FORBIDDEN_ZONE, 'points de la zone : l’objet de js/courses.js');
  assert.equal(VENUES.toulon.FORBIDDEN_ZONES, lieu.FORBIDDEN_ZONES, 'tableau créé une seule fois');
});

test('Toulon : polygone XY de la zone de Saint-Mandrier passé au routage identique à celui de la v42 (même points, même ordre)', () => {
  // v42 (56f6625, js/app.js) : FORBIDDEN_ZONES.map((poly) => poly.map((p) => toXY(p.lat, p.lon))) avec FORBIDDEN_ZONES = [FORBIDDEN_ZONE]
  const v42 = [courses.FORBIDDEN_ZONE].map((poly) => poly.map((p) => geo.toXY(p.lat, p.lon)));
  assert.deepEqual(zonesXY(lieu.FORBIDDEN_ZONES, geo.toXY), v42);
  assert.equal(v42[0].length, 7);
  const z = VENUES.toulon.FORBIDDEN_ZONES[0];
  assert.equal(z.note, null, 'aucune mention « à compléter » à Toulon (étiquette « Zone interdite » de la v42)');
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

test('bootVenue borné par l’espace : Naos comme la v43 pour toute entrée (Bormes donne Toulon) ; Tofinou toujours Bormes', () => {
  const entrees = [undefined, null, {}, { venue: 'toulon' }, { venue: 'brest' }, { venue: 'bormes' }, { venue: 'marseille' }, { venue: '__proto__' },
    { venue: 'constructor' }, { venue: 'Bormes' }, { venue: 3 }, JSON.parse('{"venue": {"id": "brest"}}')];
  // règle de la v43 (5e9b8a5) : liste blanche { toulon, brest }, sinon Toulon
  const v43 = (st) => (typeof st?.venue === 'string' && ['toulon', 'brest'].includes(st.venue) ? st.venue : 'toulon');
  for (const st of entrees) {
    assert.equal(bootVenue(st, ESPACES.naos), v43(st), 'Naos ' + JSON.stringify(st));
    assert.equal(bootVenue(st), v43(st), 'espace courant (Naos par défaut) ' + JSON.stringify(st));
    assert.equal(bootVenue(st, ESPACES.tofinou), 'bormes', 'Tofinou ' + JSON.stringify(st));
  }
});

test('bornes de saisie de Bormes et de Toulon disjointes en longitude (ouest de Bormes ≥ est de Toulon, piège 6) ; Brest à part', () => {
  assert.ok(BORMES.inputBounds.west >= VENUES.toulon.inputBounds.east, `${BORMES.inputBounds.west} ≥ ${VENUES.toulon.inputBounds.east}`);
  assert.deepEqual(BORMES.inputBounds, { south: 42.86, north: 43.30, west: 6.20, east: 6.70, nom: 'la rade de Bormes – Le Lavandou', exemple: '43°06.362N 006°24.252E' });
  // l’emprise est dans les bornes de saisie
  for (const k of ['south', 'west']) assert.ok(BORMES.inputBounds[k] <= BORMES.bounds[k], k);
  for (const k of ['north', 'east']) assert.ok(BORMES.inputBounds[k] >= BORMES.bounds[k], k);
  // l’exemple de saisie se lit avec les bornes de Bormes, pas avec celles de Toulon
  const p = parseLatLon(BORMES.exemple, BORMES.inputBounds);
  // exemple = La Fourmigue (08-11, D-13 : 43°06,362′ N 006°24,252′ E), au lieu du point devant Le Lavandou
  assert.ok(Math.abs(p.lat - 43.106033) < 1e-6 && Math.abs(p.lon - 6.4042) < 1e-6, JSON.stringify(p));
  assert.ok(parseLatLon(BORMES.exemple).error, 'bornes de Toulon : refusé');
});

test('plans d’eau d’une régate et d’une trace bornés par l’espace : Bormes invisible pour Naos (comme en v43), Toulon et Brest pour Tofinou', () => {
  const ici = [43.12, 6.39], N = ESPACES.naos.venues, T = ESPACES.tofinou.venues;
  assert.equal(venueAt(...ici), null, 'Naos (espace courant) : point de Bormes hors de tout plan d’eau, comme en v43');
  assert.equal(venueAt(...ici, N), null);
  assert.equal(venueAt(...ici, T), 'bormes');
  assert.equal(venueAt(43.0974, 5.9341, T), null, 'Tofinou : Toulon hors de ses plans d’eau');
  assert.equal(venueAt(48.29817, -4.3605, T), null);
  const b = { id: 'B', name: 'B', lat: 43.12, lon: 6.39, status: 'confirmee' }, c = { ...b, id: 'C', lat: 43.13, lon: 6.36 };
  // Naos : une régate dont les bouées confirmées sont à Bormes reste à Toulon, sans réparation (v43)
  assert.equal(venueOf({ marks: [b, c] }), 'toulon');
  assert.equal(needsVenueRepair({ marks: [b, c] }), false);
  assert.equal(venueOf({ venue: 'bormes' }), 'toulon', 'Naos : « bormes » inconnu, comme en v43');
  assert.equal(needsVenueRepair({ venue: 'bormes' }), false);
  // Tofinou : Bormes par le champ ou par les bouées ; sinon Bormes (jamais Toulon)
  assert.equal(venueOf({ venue: 'bormes' }, T), 'bormes');
  assert.equal(venueOf({ marks: [b, c] }, T), 'bormes');
  for (const r of [{}, null, { venue: 'toulon' }, { venue: 'brest' }, { marks: [{ ...b, lat: 43.09, lon: 5.95 }] }]) assert.equal(venueOf(r, T), 'bormes', JSON.stringify(r));
  assert.equal(needsVenueRepair({ venue: 'bormes' }, T), false);
  assert.equal(needsVenueRepair({ marks: [b] }, T), true, 'Tofinou : régate sans champ réparée vers Bormes');
  // fonctions passées à .some / .filter (rang à la place de la liste) : liste de l’espace courant
  assert.deepEqual([{ marks: [b] }, { venue: 'brest' }].map(needsVenueRepair), [false, false]);
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

// ───────── Météo et champ de vent par plan d’eau (D-13, D-14, D-14b)

// Cale réseau et stockage : enregistre les URL demandées, rend des réponses factices ; tout est rendu à la fin (try/finally de l’appelant)
function cales() {
  const urls = [], store = new Map(), avant = { fetch: globalThis.fetch, ls: globalThis.localStorage };
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.fetch = async (url) => {
    const u = String(url);
    urls.push(u);
    if (!/^https?:/.test(u)) return avant.fetch(url);
    const body = /pioupiou/.test(u) ? { data: [] } : { hourly: { time: [] } };
    return { ok: true, status: 200, json: async () => body };
  };
  return { urls, store, rendre: () => { globalThis.fetch = avant.fetch; if (avant.ls === undefined) delete globalThis.localStorage; else globalThis.localStorage = avant.ls; } };
}

test('météo de Toulon (défaut) : requête marine et balises de la v42, clé rade.wx.v1, instantané data/wx-snapshot.json', async () => {
  const c = cales();
  try {
    const d = await weather.fetchAll();
    assert.equal(c.urls.length, 3);
    assert.ok(c.urls.some((u) => u.startsWith('https://marine-api.open-meteo.com/v1/marine?latitude=43.06&longitude=5.96&hourly=')));
    assert.ok(c.urls.every((u) => !u.includes('cell_selection')), 'pas de cell_selection à Toulon');
    assert.ok(c.urls[0].includes('latitude=43.085&longitude=5.958&'));
    assert.deepEqual([...c.store.keys()], ['rade.wx.v1']);
    assert.deepEqual(weather.cached(), JSON.parse(JSON.stringify(d)));
    c.urls.length = 0;
    assert.deepEqual(await weather.fetchLive(), []);
    assert.deepEqual(c.urls, ['https://api.pioupiou.fr/v1/live/all']);
    c.urls.length = 0;
    assert.deepEqual(await weather.snapshot(), JSON.parse(fixture('../../data/wx-snapshot.json')));
    assert.deepEqual(c.urls, ['data/wx-snapshot.json']);
  } finally { c.rendre(); }
  assert.equal(weather.GRID.length, 24);
  assert.deepEqual(weather.CENTER, { lat: 43.085, lon: 5.958 });
});

test('configureWeather avec le descripteur de Toulon : GRID et CENTER identiques à la v42', () => {
  const g = JSON.stringify(weather.GRID), ce = JSON.stringify(weather.CENTER);
  weather.configureWeather(VENUES.toulon.weather);
  assert.equal(JSON.stringify(weather.GRID), g);
  assert.equal(JSON.stringify(weather.CENTER), ce);
});

// Terrain factice de 5 × 6 km : une côte haute à l’Ouest (x < 1 500 m), la mer ailleurs (au plus 3,5 km d’une terre)
const FAUX = { x0: 0, x1: 5000, y0: 0, y1: 6000, height: (x) => (x < 1500 ? 200 : -10), coverAt: (x) => (x < 1500 ? 1 : 0) };
const memes = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

test('WindField : défauts = maille 150 m et seuil 4 000 m (v42) ; { cell: 300 } a quatre fois moins de cellules', async () => {
  const T = await new geo.Terrain().load('data/');
  const a = new WindField(T), b = new WindField(T, {}), c = new WindField(T, { cell: 150, openSea: 4000 });
  assert.equal(a.cell, 150); assert.equal(a.openSea, 4000);
  for (const f of [b, c]) {
    assert.equal(f.nx, a.nx); assert.equal(f.ny, a.ny);
    assert.ok(memes(f.distLand, a.distLand) && memes(f.k, a.k) && memes(f.land, a.land));
  }
  assert.deepEqual([a.nx, a.ny], [163, 133]);
  const d = new WindField(T, { cell: 300 });
  const r = (a.nx * a.ny) / (d.nx * d.ny);
  assert.ok(r > 3.9 && r < 4.1, `rapport ${r}`);
  assert.ok(Math.abs(d.dx - 300) < 5 && Math.abs(d.dy - 300) < 5);
});

test('WindField : seul `openSea` choisit les cellules de référence (mer à plus de openSea m d’une terre)', () => {
  const kit = (o) => new WindField(FAUX, o).kit(270);
  const loin = new WindField(FAUX).distLand.reduce((m, v) => (v < 1e8 ? Math.max(m, v) : m), 0);   // la cellule de mer la plus éloignée
  assert.ok(loin > 3000 && loin < 4000, `distance maximale ${loin}`);
  const aucune = kit({}), aucune2 = kit({ openSea: loin + 1 });          // aucune cellule au-delà : référence 1 dans les deux cas
  assert.ok(memes(aucune.fac, aucune2.fac));
  const proche = kit({ openSea: 1500 }), proche2 = kit({ openSea: 1501 }); // mêmes cellules (maille de 150 m) : même référence
  assert.ok(memes(proche.fac, proche2.fac));
  assert.ok(!memes(aucune.fac, proche.fac), 'un autre jeu de cellules change la référence');
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

test('météo de Brest : zone A en cell_selection=sea, 20 points, aucune requête marine ni Pioupiou, clé rade.wx.brest.v1', async () => {
  weather.configureWeather(BREST.weather);
  assert.equal(weather.GRID.length, 20);
  assert.deepEqual(weather.CENTER, { lat: 48.298, lon: -4.3605 });
  const c = cales();
  try {
    const d = await weather.fetchAll();
    assert.equal(c.urls.length, 2, 'prévisions multi-modèles et grille seulement');
    assert.ok(c.urls.every((u) => u.startsWith('https://api.open-meteo.com/v1/forecast?') && u.endsWith('&cell_selection=sea')));
    assert.ok(c.urls[0].includes('latitude=48.298&longitude=-4.3605&'));
    const lats = new URL(c.urls[1]).searchParams.get('latitude').split(','), lons = new URL(c.urls[1]).searchParams.get('longitude').split(',');
    assert.equal(lats.length, 20); assert.equal(lons.length, 20);
    assert.deepEqual([...new Set(lats)], ['48.275', '48.295', '48.315', '48.335']);
    assert.deepEqual([...new Set(lons)], ['-4.46', '-4.42', '-4.38', '-4.34', '-4.3']);
    assert.ok(!c.urls.some((u) => /marine-api|pioupiou/.test(u)));
    assert.equal(d.marine, null);
    assert.deepEqual([...c.store.keys()], ['rade.wx.brest.v1']);
    assert.deepEqual(weather.cached(), JSON.parse(JSON.stringify(d)));
    c.store.delete('rade.wx.brest.v1'); c.store.set('rade.wx.v1', '{"de":"Toulon"}');
    assert.equal(weather.cached(), null, 'le cache de Toulon n’est jamais lu à Brest');
  } finally { c.rendre(); }
});

test('météo de Brest : aucune balise (fetchLive rend [] sans requête), instantané data/brest.wx-snapshot.json (null s’il manque)', async () => {
  const c = cales();
  try {
    assert.deepEqual(await weather.fetchLive(), []);
    assert.deepEqual(c.urls, []);
    assert.equal(await weather.snapshot(), null);
    assert.deepEqual(c.urls, ['data/brest.wx-snapshot.json']);
  } finally { c.rendre(); }
});

test('météo de Brest : marineAt sans réponse marine rend null (pas de carte « État de la mer »)', () => {
  assert.equal(weather.marineAt({ marine: null }, '2026-12-05T10:00'), null);
});

// ───────────────────────── plan d’eau d’une régate (07-05, D-06)

test('liste blanche de l’archive (js/archmerge.js) = plans d’eau du registre, dans le même ordre', () => {
  assert.deepEqual([...ARCHIVE_VENUE_IDS], Object.keys(VENUES));
  assert.deepEqual([...ARCHIVE_VENUE_IDS], VENUE_IDS);
});

test('venueOf : champ `venue` en liste blanche, sinon Toulon (régates d’avant la v43)', () => {
  assert.equal(venueOf({ venue: 'brest' }), 'brest');
  assert.equal(venueOf({ venue: 'toulon' }), 'toulon');
  for (const r of [{}, null, undefined, { venue: 'lorient' }, { venue: '__proto__' }, { venue: 'constructor' }, { venue: {} }, { venue: 'Brest' }]) assert.equal(venueOf(r), 'toulon', JSON.stringify(r));
});

// ───────────────────────── déduction par les bouées confirmées et réparation (07-05, tâche 3)

const mk = (lat, lon, status = 'confirmee') => ({ id: 'X' + Math.round(lat * 1000), name: 'B', lat, lon, status });
const B1 = mk(48.29817, -4.3605), B2 = mk(48.31, -4.37), T1 = mk(43.0905, 5.9587), T2 = mk(43.07, 5.93);

test('venueOf : bouées confirmées toutes dans l’emprise d’un même plan d’eau → ce plan d’eau ; mélange ou rien → Toulon', () => {
  assert.equal(venueOf({ marks: [B1, B2] }), 'brest', 'deux bouées confirmées à Brest');
  assert.equal(venueOf({ marks: [B1, T1] }), 'toulon', 'une à Brest, une à Toulon');
  assert.equal(venueOf({ marks: [T1, T2] }), 'toulon');
  assert.equal(venueOf({ marks: [B1, mk(43.07, 5.93, 'a_confirmer')] }), 'brest', 'bouée non confirmée ignorée');
  assert.equal(venueOf({ marks: [mk(48.3, -4.36, 'a_confirmer')] }), 'toulon', 'aucune bouée confirmée');
  assert.equal(venueOf({ marks: [B1, mk(48.3, -4.36, 'ignoree')] }), 'brest', 'bouée ignorée sans effet');
  assert.equal(venueOf({ marks: [{ ...B1, lat: null }, B2] }), 'brest', 'position à saisir ignorée');
  assert.equal(venueOf({ marks: [mk(10, 10)] }), 'toulon', 'hors de tout plan d’eau');
  assert.equal(venueOf({ marks: 'pas une liste' }), 'toulon');
});

test('venueOf : le champ `venue` l’emporte sur les bouées ; une valeur inconnue est ignorée (déduction)', () => {
  assert.equal(venueOf({ venue: 'brest', marks: [T1, T2] }), 'brest');
  assert.equal(venueOf({ venue: 'toulon', marks: [B1, B2] }), 'toulon', '« toulon » écrit explicitement');
  assert.equal(venueOf({ venue: 'lorient', marks: [B1] }), 'brest', 'valeur inconnue : déduite des bouées');
  assert.equal(venueOf({ venue: '__proto__', marks: [T1] }), 'toulon');
});

test('needsVenueRepair : vrai seulement sans `venue` et avec des bouées confirmées hors de Toulon', () => {
  assert.equal(needsVenueRepair({ marks: [B1, B2] }), true, 'plan d’eau perdu (copie v42), bouées à Brest');
  assert.equal(needsVenueRepair({ venue: 'brest', marks: [B1] }), false, 'déjà écrit');
  assert.equal(needsVenueRepair({ venue: 'toulon', marks: [B1, B2] }), false, '« toulon » explicite : jamais réécrit');
  assert.equal(needsVenueRepair({ marks: [T1] }), false, 'Toulon : rien à écrire (forme de la v42)');
  assert.equal(needsVenueRepair({ marks: [] }), false);
  assert.equal(needsVenueRepair({ marks: [B1, T1] }), false, 'mélange : Toulon');
  assert.equal(needsVenueRepair({ venue: 'lorient', marks: [B1] }), true, 'valeur inconnue : réparée');
  assert.equal(needsVenueRepair(null), false);
});
