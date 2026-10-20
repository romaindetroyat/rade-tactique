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
let pdfText, parseIC, cleanText, PDF_OPTIONS;

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
  ({ pdfText, parseIC, cleanText, PDF_OPTIONS } = await import('../js/events.js'));
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

// Sortie de parseIC sur les IC SNPM figée AVANT la phase 3 (relevée sur le code d’alors) : tous les champs sauf `text`.
// Les extraits `ex` ajoutés ensuite ne doivent rien changer à ces valeurs (Pitfall 13 par analogie).
test('figé : parseIC sur le texte réel des IC SNPM rend exactement les champs d’avant la phase 3', async () => {
  const { text, ex, ...f } = parseIC(await extraire('ic-coupe-snpm-2026-10-18.pdf'), 'ic.pdf');
  const { keyRules, ...champs } = f;
  assert.deepEqual(champs, {
    event: 'COUPE de la SNPM CVAT',
    date: '2026-10-18',
    firstWarning: '10:55',
    lastFinishSignal: '16:00',
    vhf: 72,
    committee: 'Ludovic JEGO — tél. 06 34 43 36 73',
    zone: 'de la Grande Rade de Toulon, à un Mille nautique au Sud du Cap Cépet',
  });
  assert.equal(keyRules.length, 18);
  assert.deepEqual(keyRules.slice(0, 2), [
    'Par ailleurs, les concurrents devront arborer dans leur pataras, ou à défaut dans le hauban tribord , un pavillon blanc pour la classe P, un pavillon « C » pour les autres classes.',
    'Tout concurrent qui n’est plus en course doit enlever ce pavillon distinctif.',
  ]);
  assert.ok(text.length > 10000 && text.length <= 60000, 'le texte brut est gardé (60 000 caractères au plus)');
});

// D-03 : l’extrait de chaque valeur est le segment du texte nettoyé qui l’a produite (vérifié par construction : il en est tiré)
test('extraits : chaque valeur lue a son extrait, tiré tel quel du texte nettoyé, et qui contient la valeur sous sa forme du texte', async () => {
  const brut = await extraire('ic-coupe-snpm-2026-10-18.pdf');
  const f = parseIC(brut, 'ic.pdf');
  const propre = cleanText(brut), uneLigne = propre.replace(/\n/g, ' ');
  const forme = {
    event: 'COUPE de la SNPM CVAT', date: '18 octobre 2026', firstWarning: '10h55', lastFinishSignal: '16h00', vhf: '72',
    committee: 'Ludovic JEGO', zone: 'Grande Rade de Toulon',
  };
  assert.ok(f.ex && typeof f.ex === 'object', 'parseIC doit rendre f.ex');
  for (const [cle, attendu] of Object.entries(forme)) {
    const ex = f.ex[cle];
    assert.equal(typeof ex, 'string', `f.ex.${cle} manquant`);
    assert.ok(ex.length > 0 && ex.length <= 260, `f.ex.${cle} : ${ex.length} caractères`);
    assert.ok(uneLigne.includes(ex) || propre.includes(ex), `f.ex.${cle} ne figure pas dans le texte nettoyé : « ${ex} »`);
    assert.ok(ex.replace(/\s+/g, ' ').includes(attendu), `f.ex.${cle} ne contient pas « ${attendu} » : « ${ex} »`);
    assert.equal(ex, ex.trim(), `f.ex.${cle} : blancs en bordure`);
  }
  assert.ok(f.ex.committee.includes('06 34 43 36 73'), 'l’extrait du Comité garde le téléphone quand il est proche du nom');
  assert.ok(Object.keys(f.ex).every((k) => k in forme), 'pas d’extrait pour une clé inconnue');
});

const blanc = (c) => c === undefined || /\s/.test(c);
test('extraits : ni coupés au milieu d’un mot, ni pour une valeur non lue', () => {
  const sans = parseIC('Texte sans rien de reconnaissable à lire ici, ni date ni heure.', 'Mon fichier_IC.pdf');
  assert.equal(sans.event, 'Mon fichier IC', 'le titre vient du nom de fichier, comme avant');
  assert.deepEqual(sans.ex, {}, 'aucun extrait quand rien n’est lu (le nom de fichier n’est pas un extrait)');
  assert.equal(sans.date, undefined); assert.equal(sans.vhf, undefined);
  const f = parseIC('Instructions.   Le premier signal d’avertissement : 9h30 sera donné au large de la pointe, VHF 69, on repart ensuite vers la bouée de dégagement sans perdre de temps.', 'x.txt');
  assert.equal(f.firstWarning, '09:30'); assert.equal(f.vhf, 69);
  const propre = cleanText(f.text);
  assert.ok(Object.keys(f.ex).length >= 2, 'au moins deux extraits attendus');
  for (const [cle, ex] of Object.entries(f.ex)) {
    const i = propre.indexOf(ex);
    assert.ok(i >= 0, `f.ex.${cle} absent du texte : « ${ex} »`);
    assert.ok(blanc(propre[i - 1]), `f.ex.${cle} commence au milieu d’un mot : « ${ex} »`);
    assert.ok(blanc(propre[i + ex.length]) || /[.,;:]/.test(propre[i + ex.length]) || /[.,;:]$/.test(ex), `f.ex.${cle} finit au milieu d’un mot : « ${ex} »`);
  }
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
