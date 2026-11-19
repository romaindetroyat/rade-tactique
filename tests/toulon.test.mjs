// Toulon ne change pas d’un bord (phase 7, D-01, D-02) : ce que le code courant calcule pour Toulon est comparé, section par section,
// à la capture faite sur la v42 extraite de 56f6625 (tests/fixtures/toulon-v42.json, tests/helpers/toulon.mjs). Nombres à 1e-9 relatif,
// chaînes, booléens et structure à l’identique. La fixture n’est jamais recapturée sur le code modifié.
// Les tables réelles MARKS et COURSES sont rendues à l’identique : comparaison avec l’état du début à la fin du fichier.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, ROOT } from './helpers/setup.mjs';
import { toulonCases, sameDeep } from './helpers/toulon.mjs';
import * as geo from '../js/geo.js';
import * as wind from '../js/wind.js';
import * as tactics from '../js/tactics.js';
import * as router from '../js/router.js';
import * as courses from '../js/courses.js';
import * as banane from '../js/banane.js';
import * as regmarks from '../js/regmarks.js';
import * as marks from '../js/marks.js';
import * as icplaus from '../js/icplaus.js';
import * as weather from '../js/weather.js';

const MARKS_AVANT = JSON.stringify(courses.MARKS), COURSES_AVANT = JSON.stringify(courses.COURSES);
after(() => {
  assert.equal(JSON.stringify(courses.MARKS), MARKS_AVANT, 'MARKS réel modifié par le gel');
  assert.equal(JSON.stringify(courses.COURSES), COURSES_AVANT, 'COURSES réel modifié par le gel');
});

const ref = JSON.parse(fixture('toulon-v42.json'));
let cur;
before(async () => {
  const T = await new geo.Terrain().load('data/');
  const F = new wind.WindField(T);
  // aller-retour JSON : mêmes valeurs que la fixture (NaN → null, clés absentes retirées)
  cur = JSON.parse(JSON.stringify(await toulonCases({ geo, wind, tactics, router, courses, banane, regmarks, marks, icplaus, weather, T, F, racine: ROOT })));
});

test('fixture Toulon v42 capturée sur 56f6625', () => {
  assert.equal(ref.v, 42);
  assert.equal(ref.from, '56f6625');
});

const SECTIONS = {
  bords: 'bords des parcours 1 à 13, variantes de ligne, régate archivée et banane',
  analyses: 'analyses comme runAnalysis : départ, bords, temps, routes, conseils (parcours 1, 3, 5, 7, 9, 12, 13 et banane, six vents)',
  vent: 'champ de vent aux marques, aux lignes et sur une grille de mer de 1 500 m (six vents)',
  routes: 'routes entre dix paires de marques sur quatre vents',
  regimes: 'régimes de vent, leurs conseils et classement des parcours',
  positions: 'positions des marques et des lieux (toXY, fmtLat, fmtLon, parseLatLon, checkPos)',
  meteo: 'requêtes météo, balises gardées et lecture de l’instantané embarqué',
  donnees: 'empreintes SHA-256 et tailles des fichiers data/ de Toulon',
};
for (const [k, quoi] of Object.entries(SECTIONS)) {
  test(`Toulon v42 : ${quoi} identiques à la capture`, () => {
    assert.ok(ref[k], `section ${k} absente de la fixture`);
    const d = sameDeep(cur[k], ref[k], k);
    assert.equal(d, null, d ?? '');
  });
}
