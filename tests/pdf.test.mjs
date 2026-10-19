// Import d’un PDF d’IC : le pdf.js vendorisé (3.11.174) est touché par CVE-2024-4367 (une police piégée peut faire exécuter du code).
// Ces tests exécutent la vraie bibliothèque sous Node, sans nouveau paquet : on importe d’abord le worker (qui définit
// globalThis.pdfjsWorker, donc pdf.js utilise son « faux worker » dans le même processus), puis la bibliothèque.
// Les avertissements « Cannot polyfill DOMMatrix / Path2D », « Setting up fake worker » et « TT: undefined function » sont attendus.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { ROOT, fixture } from './helpers/setup.mjs';

// Borne basse documentée : l’extraction réelle donne 11476 caractères pour les IC SNPM et 11257 pour le cahier de parcours
// sous Node 22 (19/10/2026) ; 11302 et 11036 sous Chromium. 10000 reste sous toutes ces mesures et attrape une extraction
// vide ou tronquée sans figer une longueur exacte, qui dépend de l’environnement d’extraction.
const MIN_CARACTERES = 10000;

const appels = [];
let pdfText, parseIC, PDF_OPTIONS;

before(async () => {
  await import(new URL('../vendor/pdf.worker.min.js', import.meta.url));
  await import(new URL('../vendor/pdf.min.js', import.meta.url));
  const lib = globalThis.pdfjsLib;
  assert.ok(lib?.getDocument, 'pdf.js vendorisé non chargé');
  // espion : mémorise les options puis appelle le vrai getDocument
  globalThis.window = {
    pdfjsLib: new Proxy(lib, {
      get: (cible, cle) => (cle === 'getDocument' ? (opts) => { appels.push(opts); return cible.getDocument(opts); } : cible[cle]),
    }),
  };
  ({ pdfText, parseIC, PDF_OPTIONS } = await import('../js/events.js'));
});

const extraire = async (nom) => pdfText(new Blob([fixture(nom, null)]));

test('pdfText ouvre le PDF avec isEvalSupported: false (CVE-2024-4367)', async () => {
  appels.length = 0;
  await extraire('ic-coupe-snpm-2026-10-18.pdf');
  assert.equal(appels.length, 1, 'un seul appel à getDocument attendu');
  assert.strictEqual(appels[0].isEvalSupported, false);
});

test('les IC de la Coupe SNPM donnent un texte au-dessus de la borne basse et s’importent comme avant', async (t) => {
  const texte = await extraire('ic-coupe-snpm-2026-10-18.pdf');
  t.diagnostic(`longueur du texte extrait des IC SNPM : ${texte.length}`);
  assert.ok(texte.length > MIN_CARACTERES, 'texte des IC trop court : extraction vide ou tronquée');
  const f = parseIC(texte, 'ic.pdf');
  assert.equal(f.event, 'COUPE de la SNPM CVAT');
  assert.equal(f.date, '2026-10-18');
  assert.equal(f.firstWarning, '10:55');
  assert.equal(f.lastFinishSignal, '16:00');
  assert.equal(f.vhf, 72);
  assert.ok(f.keyRules.length > 0, 'au moins un point clé attendu');
});

test('le cahier de parcours CVAT s’extrait sans erreur, au-dessus de la borne basse', async (t) => {
  const texte = await extraire('cahier-parcours-cvat-v2-nov25.pdf');
  t.diagnostic(`longueur du texte extrait du cahier de parcours : ${texte.length}`);
  assert.ok(texte.length > MIN_CARACTERES, 'texte du cahier trop court : extraction vide ou tronquée');
});

test('garde statique : tout appel getDocument( de js/ passe isEvalSupported: false, et PDF_OPTIONS est gelé', () => {
  const fichiers = readdirSync(ROOT + 'js', { recursive: true }).filter((f) => f.endsWith('.js'));
  let trouves = 0;
  for (const f of fichiers) {
    const src = readFileSync(ROOT + 'js/' + f, 'utf8');
    let i = -1;
    while ((i = src.indexOf('getDocument(', i + 1)) >= 0) {
      trouves++;
      // liste d’arguments : de la parenthèse ouvrante à la parenthèse fermante correspondante
      let prof = 0, j = i + 'getDocument'.length;
      for (; j < src.length; j++) { if (src[j] === '(') prof++; else if (src[j] === ')' && --prof === 0) break; }
      const args = src.slice(i, j);
      assert.ok(args.includes('PDF_OPTIONS') || args.includes('isEvalSupported: false'), `js/${f} : getDocument( sans isEvalSupported: false`);
    }
  }
  assert.ok(trouves >= 1, 'le point d’appel de pdf.js doit être trouvé par la garde');
  assert.ok(Object.isFrozen(PDF_OPTIONS), 'PDF_OPTIONS doit être gelé');
  assert.strictEqual(PDF_OPTIONS.isEvalSupported, false);
});
