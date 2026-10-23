// Parcours banane, porte à deux bouées, arrivées décalées et conseil de porte (phase 6, D-01 à D-05, D-09, D-10).
// Les bords des parcours 1 à 13 et d’une régate archivée sont comparés à ceux de la v37 (fixture capturée sur 6e7af98).
// Les tables réelles MARKS et COURSES sont rendues à l’identique : comparaison avec l’état du début à la fin du fichier.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/setup.mjs';
import { legCases, sameLegs } from './helpers/legs.mjs';
import { buildLegs } from '../js/tactics.js';
import { MARKS, COURSES, LINE_PRESETS } from '../js/courses.js';
import { applyRegattaMarks } from '../js/regmarks.js';

const MARKS_AVANT = JSON.stringify(MARKS), COURSES_AVANT = JSON.stringify(COURSES);
after(() => {
  assert.equal(JSON.stringify(MARKS), MARKS_AVANT, 'MARKS réel modifié par un test');
  assert.equal(JSON.stringify(COURSES), COURSES_AVANT, 'COURSES réel modifié par un test');
});

test('non-régression v37 : bords des parcours 1 à 13 et d’une régate archivée identiques à la fixture capturée sur 6e7af98 (D-10, D-09)', () => {
  const ref = JSON.parse(fixture('legs-v37.json'));
  assert.equal(ref.v, 37); assert.equal(ref.from, '6e7af98');
  const cur = legCases({ buildLegs, COURSES, MARKS, LINE_PRESETS, applyRegattaMarks });
  assert.equal(cur.length, ref.cases.length, 'nombre de cas');
  assert.deepEqual(cur.map((c) => c.key), ref.cases.map((c) => c.key), 'clés des cas');
  for (let i = 0; i < cur.length; i++) {
    const d = sameLegs(cur[i], ref.cases[i]);
    assert.equal(d, null, d ?? '');
  }
});

test('non-régression v37 : aucun bord des parcours existants n’a de porte, aucune ligne d’arrivée décalée', () => {
  for (const c of COURSES.filter((x) => x.id >= 1 && x.id <= 13)) {
    for (const cls of ['G', 'P']) {
      const B = buildLegs(c, cls, { laps: 2, windDir: 315, line: { center: LINE_PRESETS[c.line || 'vignettes'], lengthNm: 0.12, mode: 'wind' } });
      assert.ok(B.legs.every((l) => l.gate === undefined), `parcours ${c.id} ${cls} : pas de porte`);
      assert.equal(B.finishLine, undefined, `parcours ${c.id} : finishLine absent`);
    }
  }
});
