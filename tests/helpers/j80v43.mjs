// Onglet du bateau de Naos figé sur la v43 (08-05, D-01, D-09) : HTML rendu par renderJ80 (js/j80.js) d’une racine, pour quelques états
// (vent prévu ou non, performance, polaire J80 ou importée). Capture une seule fois sur le code extrait de 5e9b8a5 (v43), jamais sur le code
// modifié :   node tests/helpers/j80v43.mjs --capture <racine> <sortie>
// tests/tofinou.test.mjs compare le rendu du dépôt (--rendu, processus neuf) à tests/fixtures/j80-v43.json (aucun appel à git pendant npm test).
// Le fichier n’a pas « .test. » dans son nom : `npm test` ne le lance pas.

import { writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

// Bateau que js/app.js passe pour Naos (la v43 ignore l’option)
const NAOS = { classe: 'J80', longueur: 8 };
const ETATS = [
  ['sans vent, performance 100 %', { perf: 1, wind: undefined }],
  ['vent prévu 12 nd, performance 93 %', { perf: 0.93, wind: { spd: 12, dir: 270 } }],
  ['vent prévu 4,4 nd, performance 75 %', { perf: 0.75, wind: { spd: 4.4, dir: 90 } }],
  ['polaire importée, vent prévu 18 nd', { perf: 1.05, wind: { spd: 18, dir: 300 }, importee: true }],
];

// Rendu de chaque état par les modules de `racine` (dépôt ou extraction) ; la polaire J80 est rétablie après chaque état
export async function rendusJ80(racine) {
  const base = racine.replace(/\/?$/, '/');
  const imp = (f) => import(pathToFileURL(base + f).href);
  const [{ renderJ80 }, polar] = await Promise.all([imp('js/j80.js'), imp('js/polar.js')]);
  const out = {};
  for (const [nom, e] of ETATS) {
    polar.resetPolar();
    if (e.importee) polar.setPolar([6, 10, 14], [40, 90, 150], [[4, 5, 5.5], [5, 6.5, 7], [4.5, 6, 7.5]], 'ma-polaire.pol');
    const { document } = parseHTML('<html><body><section data-tab="j80"></section></body></html>');
    const el = document.querySelector('section');
    renderJ80(el, { onImport() {}, onReset() {}, perf: e.perf, onPerf() {}, wind: e.wind, bateau: NAOS });
    out[nom] = el.innerHTML;
  }
  polar.resetPolar();
  return out;
}

// --rendu <racine> : rendus sur la sortie standard, dans un processus neuf (aucune polaire d’espace posée avant : état d’une session de Naos)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, racine, sortie] = process.argv.slice(2);
  if (mode === '--rendu' && racine) { process.stdout.write(JSON.stringify(await rendusJ80(racine))); process.exit(0); }
  if (mode !== '--capture' || !racine || !sortie) { console.error('usage : node tests/helpers/j80v43.mjs --capture <racine> <sortie> | --rendu <racine>'); process.exit(2); }
  writeFileSync(sortie, JSON.stringify(await rendusJ80(racine), null, 1) + '\n');
  console.log('capture écrite : ' + sortie);
}
