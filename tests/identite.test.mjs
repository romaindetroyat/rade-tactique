// Identité de chaque espace (08-06, D-03, D-07) : page d’accès, aide et accueil, bulles, « Changer d’espace ».
// Naos : aide, bulles et page d’accès identiques à la v43 (empreintes relevées sur l’extraction de 5e9b8a5, aucun git pendant npm test).
// Ce processus reste en Naos (aucun setEspace) : les textes de Tofinou sont lus par guideDe / tipsDe avec le registre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { ESPACES, ESPACE } from '../js/espaces.js';

const lire = (f) => readFileSync(ROOT + f, 'utf8');
const h16 = (x) => createHash('sha256').update(x).digest('hex').slice(0, 16);
const help = await import('../js/help.js');
const INTERDITS = /J80|CVAT|GPEN|Naos|Toulon|Brest/;
const texte = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// Empreintes (16 premiers hexadécimaux du SHA-256) des textes de l’aide de js/help.js à la v43 (5e9b8a5)
const V43 = { GUIDE: 'ef4caf39a4bf2fa1', STATIC_TIPS: 'e3462835dd0a87ba', SYNC_TIP: '8dc2f257b853a356', DL_TIP: 'ba597acb634b1896' };

test('aide de Naos identique à la v43 : guide, bulles fixes, bulles de synchronisation et de téléchargement ; guideDe et tipsDe rendent ceux de Naos', () => {
  const src = lire('js/help.js');
  assert.equal(ESPACE.id, 'naos');
  assert.equal(h16(/export const GUIDE = `([\s\S]*?)`;/.exec(src)[1]), V43.GUIDE);
  assert.equal(h16(help.GUIDE), V43.GUIDE);
  assert.equal(h16(/const STATIC_TIPS = \{([\s\S]*?)\n\};/.exec(src)[1]), V43.STATIC_TIPS);
  assert.equal(h16(help.SYNC_TIP), V43.SYNC_TIP);
  assert.equal(h16(help.DL_TIP), V43.DL_TIP);
  assert.equal(help.guideDe(ESPACES.naos), help.GUIDE);
  const t = help.tipsDe(ESPACES.naos);
  assert.match(t['[data-tab=j80]'], /^Polaires J80 \(ORC\)/);
  assert.match(t['[data-tab=course]'], /cahier CVAT à Toulon/);
});

test('aide et accueil de Tofinou : « Préparer et courir le Challenge de la Baie en Tofinou 9.5 dans la rade de Bormes – Le Lavandou », sans J80, CVAT, GPEN, Naos, Toulon ni Brest', () => {
  const g = help.guideDe(ESPACES.tofinou);
  assert.equal(g, help.GUIDE_TOFINOU);
  assert.ok(texte(g).includes('Préparer et courir le Challenge de la Baie en Tofinou 9.5 dans la rade de Bormes – Le Lavandou'));
  assert.ok(texte(g).includes('« Tofinou Bormes »'), 'nom à l’installation');
  assert.doesNotMatch(texte(g), INTERDITS);
  assert.doesNotMatch(g, /guide\.html/, 'le guide complet de Naos n’est pas proposé (guide de l’espace en 08-10)');
  assert.doesNotMatch(texte(g), /gpt|claude|opus|sonnet|haiku|\?acces=|rt_acces/i);
  const tips = help.tipsDe(ESPACES.tofinou);
  assert.deepEqual(Object.keys(tips), Object.keys(help.tipsDe(ESPACES.naos)), 'mêmes éléments');
  for (const [k, v] of Object.entries(tips)) assert.doesNotMatch(v, INTERDITS, k);
  assert.doesNotMatch(help.SYNC_TIP + help.DL_TIP, INTERDITS, 'bulles communes aux deux espaces');
});

test('aide de Tofinou : chaque libellé entre guillemets existe dans l’app (ou est un menu système, un nom d’espace)', () => {
  const SOURCES = ['index.html', 'acces.html', ...readdirSync(ROOT + 'js').filter((f) => f.endsWith('.js') && f !== 'help.js').map((f) => `js/${f}`)];
  const norm = (s) => String(s).replace(/\s+/g, ' ').replace(/️/g, '').replace(/[’‘]/g, '\'').toLowerCase();
  const code = norm(SOURCES.map(lire).join('\n'));
  const libres = ['Sur l’écran d’accueil', 'Installer l’application'];
  const cites = [...new Set([...texte(help.GUIDE_TOFINOU).matchAll(/«\s*([^»]+?)\s*»/g)].map((m) => m[1]))];
  assert.ok(cites.length >= 10, `citations lues (${cites.length})`);
  assert.deepEqual(cites.filter((c) => !libres.includes(c) && !code.includes(norm(c))), []);
});

// ───────────────────────── « Changer d’espace »
test('autreEspace : membre des deux espaces sur un hôte connu → adresse principale de l’autre espace ; un seul espace, hôte inconnu ou valeurs hostiles → rien', () => {
  const D = ['naos', 'tofinou'];
  assert.deepEqual(help.autreEspace('rade-tactique.vercel.app', D), { id: 'tofinou', nom: 'Tofinou — Bormes', hote: 'tofinou-bormes.vercel.app', url: 'https://tofinou-bormes.vercel.app/' });
  assert.deepEqual(help.autreEspace('tofinou-bormes.vercel.app', ['tofinou', 'naos']), { id: 'naos', nom: 'Naos', hote: 'rade-tactique.vercel.app', url: 'https://rade-tactique.vercel.app/' });
  assert.equal(help.autreEspace('tofinou.localhost', D).url, 'https://rade-tactique.vercel.app/');
  assert.equal(help.autreEspace('127.0.0.1', D).url, 'https://tofinou-bormes.vercel.app/');
  for (const [hote, e] of [
    ['rade-tactique.vercel.app', ['naos']], ['tofinou-bormes.vercel.app', ['tofinou']], ['rade-tactique.vercel.app', []], ['rade-tactique.vercel.app', undefined],
    ['rade-tactique.vercel.app', 'naos,tofinou'], ['rade-tactique.vercel.app', ['naos', 'naos']], ['rade-tactique.vercel.app', ['naos', '__proto__', 'evil']],
    ['rade-tactique.vercel.app', ['tofinou']], ['rade-tactique-git-apercu-x.vercel.app', D], ['', D], [undefined, D], ['evil.example', D],
  ]) assert.equal(help.autreEspace(hote, e), null, `${hote} ${JSON.stringify(e)}`);
  // valeur par défaut : espaces gardés en mémoire par setEspacesMembre (réponse de /api/membre), filtrés au registre
  help.setEspacesMembre(['naos', 'tofinou', '<img src=x>']);
  assert.equal(help.autreEspace('rade-tactique.vercel.app').id, 'tofinou');
  help.setEspacesMembre({ espaces: D });
  assert.equal(help.autreEspace('rade-tactique.vercel.app'), null);
  help.setEspacesMembre(['naos']);
  assert.equal(help.autreEspace('rade-tactique.vercel.app'), null);
  help.setEspacesMembre([]);
});

test('lien « Changer d’espace » : construit par le DOM (aucun HTML), rel="noopener", mention du code demandé la première fois', () => {
  const { document } = parseHTML('<html><body></body></html>');
  assert.equal(help.lienChangerEspace(document, 'rade-tactique.vercel.app', ['naos']), null);
  assert.equal(help.lienChangerEspace(document, 'rade-tactique-git-x.vercel.app', ['naos', 'tofinou']), null);
  const p = help.lienChangerEspace(document, 'rade-tactique.vercel.app', ['naos', 'tofinou']);
  const a = p.querySelector('a');
  assert.equal(p.id, 'changerEspace');
  assert.equal(a.textContent, 'Changer d’espace');
  assert.equal(a.getAttribute('href'), 'https://tofinou-bormes.vercel.app/');
  assert.equal(a.getAttribute('rel'), 'noopener');
  assert.equal(a.getAttribute('target'), '_blank');
  assert.equal(p.textContent, 'Changer d’espace Ouvre Tofinou — Bormes (tofinou-bormes.vercel.app) ; votre code vous sera demandé la première fois sur cette adresse.');
  assert.ok(/lien\.textContent = 'Changer d’espace'/.test(lire('js/help.js')) && !/innerHTML[^\n]*Changer d’espace/.test(lire('js/help.js')), 'textContent, pas innerHTML');
});

test('openGuide de Naos : même fenêtre pour un membre d’un seul espace qu’avant ; Romain y trouve en plus le seul paragraphe « Changer d’espace »', () => {
  const { window, document } = parseHTML('<html><body></body></html>');
  const avant = { document: globalThis.document, location: globalThis.location };
  globalThis.document = document;
  Object.defineProperty(globalThis, 'location', { value: { hostname: 'rade-tactique.vercel.app' }, configurable: true, writable: true });
  try {
    const rendu = (e) => { help.setEspacesMembre(e); help.openGuide(); return document.getElementById('modal').innerHTML; };
    const seul = rendu(['naos']), rien = rendu([]), romain = rendu(['naos', 'tofinou']);
    assert.equal(seul, rien, 'Teiva, Thibaud : rien de nouveau');
    assert.ok(!seul.includes('changerEspace') && !seul.includes('Changer d’espace'));
    assert.ok(seul.includes(help.GUIDE), 'guide de Naos de la v43');
    const sans = romain.replace(/<p[^>]*id="changerEspace"[^>]*>[\s\S]*?<\/p>/, '');
    assert.notEqual(sans, romain, 'paragraphe présent pour Romain');
    assert.equal(sans, seul, 'le reste de la fenêtre est identique');
  } finally {
    help.setEspacesMembre([]);
    globalThis.document = avant.document;
    Object.defineProperty(globalThis, 'location', { value: avant.location, configurable: true, writable: true });
    void window;
  }
});

// ───────────────────────── page d’accès
function pageAcces(hote) {
  const { document } = parseHTML(lire('acces.html'));
  const location = { hostname: hote, search: '', href: '' };
  new Function('document', 'location', 'URLSearchParams', lire('acces.js'))(document, location, URLSearchParams);
  return document;
}

test('page d’accès : hôtes de Tofinou recopiés de js/espaces.js (parité) ; Naos et aperçu : textes de acces.html inchangés ; Tofinou : nom de l’espace, exemple de code neutre', () => {
  const m = /const HOTES_TOFINOU = (\[[^\]]*\]);/.exec(lire('acces.js'));
  assert.ok(m, 'liste des hôtes dans acces.js');
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), [...ESPACES.tofinou.hotes], 'mêmes hôtes que js/espaces.js');
  const ref = parseHTML(lire('acces.html')).document;
  for (const hote of [...ESPACES.naos.hotes, 'rade-tactique-git-apercu-x.vercel.app']) {
    const d = pageAcces(hote);
    assert.equal(d.querySelector('main').innerHTML, ref.querySelector('main').innerHTML, hote);
    assert.equal(d.title, 'Rade Tactique · Accès');
  }
  for (const hote of [...ESPACES.tofinou.hotes, 'TOFINOU.localhost']) {
    const d = pageAcces(hote);
    assert.equal(d.title, 'Tofinou — Bormes · Accès');
    assert.equal(d.querySelector('h1').textContent, 'Tofinou — Bormes');
    assert.equal(d.querySelector('main > p').textContent, 'Application réservée à l’équipage du Tofinou — Bormes.');
    assert.equal(d.getElementById('code').getAttribute('placeholder'), 'votre code personnel');
    assert.doesNotMatch(d.querySelector('main').textContent, /Naos|J80/);
  }
});
