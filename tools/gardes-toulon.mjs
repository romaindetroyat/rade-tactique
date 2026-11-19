// Gardes « Toulon ne change pas d’un bord » (phase 7, D-01, D-02), d’une seule commande : chaque plan de la phase l’appelle.
//   node tools/gardes-toulon.mjs [--racine <dossier>]
// (a) garde SNPM : js/courses.js et tests/reference/ identiques à f80c365 ;
// (b) données de Toulon identiques à 56f6625 (v42) ;
// (c) modules du mode départ identiques à 56f6625 ;
// (d) tests figés : gel v42 de Toulon, banane, routes mémorisées, référence SNPM.
// Écrit « OK <garde> » ou « ÉCHEC <garde> » ; code de sortie 0 si tout est OK, 1 sinon. Aucune variable d’environnement ne désactive une garde.
// --racine : dossier où jouer les gardes (une copie du dépôt, pour les contrôles négatifs) ; par défaut, le dépôt de ce fichier.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const DATA = ['meta.json', 'terrain.bin', 'cover.bin', 'coast.json', 'basemap.jpg', 'seamask.png', 'j80.pol', 'wx-snapshot.json'].map((f) => `data/${f}`);
const DEPART = ['js/startmode.js', 'js/racelock.js', 'js/beeper.js', 'js/wakelock.js'];
const TESTS = ['tests/toulon.test.mjs', 'tests/banane.test.mjs', 'tests/routememo.test.mjs', 'tests/reference.test.mjs'];

const GARDES = [
  ['SNPM (js/courses.js, tests/reference/ = f80c365)', 'git', ['diff', '--quiet', 'f80c365', '--', 'js/courses.js', 'tests/reference/']],
  ['données de Toulon (data/ = 56f6625)', 'git', ['diff', '--quiet', '56f6625', '--', ...DATA]],
  ['modules du mode départ (= 56f6625)', 'git', ['diff', '--quiet', '56f6625', '--', ...DEPART]],
  ['tests figés (Toulon v42, banane, routes mémorisées, référence SNPM)', process.execPath, ['--test', '--import', './tests/helpers/setup.mjs', ...TESTS]],
];

const args = process.argv.slice(2);
const i = args.indexOf('--racine');
if (i >= 0 && !args[i + 1]) { console.error('usage : node tools/gardes-toulon.mjs [--racine <dossier>]'); process.exit(2); }
const racine = i >= 0 ? resolve(args[i + 1]) : fileURLToPath(new URL('../', import.meta.url));

let ok = true;
for (const [nom, cmd, argv] of GARDES) {
  let sortie = '';
  try {
    execFileSync(cmd, argv, { cwd: racine, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    console.log(`OK ${nom}`);
  } catch (e) {
    ok = false;
    sortie = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').filter((l) => /^\s*not ok|^\s*error:/.test(l)).slice(0, 8).join('\n');
    console.log(`ÉCHEC ${nom}${sortie ? '\n' + sortie : ''}`);
  }
}
process.exit(ok ? 0 : 1);
