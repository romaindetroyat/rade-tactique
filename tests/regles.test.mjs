// Page des règles (regles.html, js/regles.js) selon l’espace (08-09, D-06, D-07) : dans l’espace Tofinou, note du bateau et de l’épreuve en
// tête de page, libellé « IC du Challenge de la Baie », arbitre présenté avec les règles locales ; pour Naos, la page de la v43 à l’identique
// (empreintes du DOM capturées sur 5e9b8a5 : tests/fixtures/regles-v43.json). Rendu sous linkedom, sans réseau ni navigateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { pageRegles, captureRegles, sha, REPONSE, CAS_NAOS } from './helpers/regles.mjs';
import { ESPACES } from '../js/espaces.js';

const V43 = JSON.parse(readFileSync(ROOT + 'tests/fixtures/regles-v43.json', 'utf8'));
const espaces = (s) => String(s).replace(/\s+/g, ' ').trim();
const NOTE = 'Tofinou 9.5 : zone = 3 longueurs = 28,4 m ; deux longueurs = 18,9 m. Challenge de la Baie : Règles d’introduction à la régate (RIR), pénalité d’un tour, VHF 72.';

test('page des règles de Naos identique à la v43 (DOM avant et après une réponse de l’arbitre, corps envoyés ; hôtes de Naos, aperçu, Brest)', async () => {
  assert.equal(V43.from, '5e9b8a5');
  assert.deepEqual(Object.keys(V43.cas), Object.keys(CAS_NAOS));
  const ici = await captureRegles();
  for (const nom of Object.keys(CAS_NAOS)) assert.deepEqual(ici[nom], V43.cas[nom], nom);
  const n = await pageRegles({ hote: 'rade-tactique.vercel.app' });
  assert.equal(n.document.querySelector('#espace'), null, 'Naos : aucune note d’espace');
});

test('espace Tofinou : note du bateau et de l’épreuve en tête de page, longueurs calculées depuis le bateau de l’espace', async () => {
  for (const cas of [{ hote: 'tofinou.localhost' }, { hote: 'tofinou-bormes.vercel.app' }, { hote: 'apercu.localhost', stockage: { 'rade.espace.v1': 'tofinou' } }]) {
    const { document } = await pageRegles(cas);
    const note = document.querySelector('#noteEspace');
    assert.ok(note, JSON.stringify(cas));
    assert.equal(note.textContent, NOTE);
    assert.equal(document.querySelector('main').firstElementChild.id, 'espace', 'en tête du contenu, avant l’arbitre');
    assert.match(espaces(document.querySelector('#arbitre .lead').textContent), /les règles locales du Challenge de la Baie/);
    assert.doesNotMatch(document.querySelector('#arbitre .lead').textContent, /CVAT/);
    assert.equal(document.querySelector('#brest').hidden, true, 'partie de Brest cachée');
    assert.equal(document.querySelector('nav.toc a[href="#brest"]'), null, 'lien du sommaire vers Brest retiré');
    assert.equal(document.querySelector('.hero a[href="guide.html"]'), null, 'pas de lien vers le guide de Naos');
    assert.ok(document.querySelector('.hero a[href="./"]'), 'lien « Ouvrir l’app » gardé');
  }
  const L = ESPACES.tofinou.bateau.longueur;
  assert.equal(L, 9.47);
  assert.ok(NOTE.includes(`${(Math.round(3 * L * 10) / 10).toFixed(1).replace('.', ',')} m`) && NOTE.includes(`${(Math.round(2 * L * 10) / 10).toFixed(1).replace('.', ',')} m`));
});

test('espace Tofinou : la réponse de l’arbitre nomme « IC du Challenge de la Baie » ; le corps n’envoie aucun plan d’eau (le serveur décide par l’espace)', async () => {
  const t = await pageRegles({ hote: 'tofinou.localhost', question: 'Combien de tours ?', reponse: REPONSE, stockage: { 'rade.state': JSON.stringify({ venue: 'bormes' }) } });
  assert.equal(t.document.querySelector('.msg.bot .verdict').textContent, REPONSE.verdict);
  assert.equal(espaces(t.document.querySelector('.msg.bot .note').textContent), 'IC du Challenge de la Baie : Pénalité d’un tour.');
  assert.deepEqual(t.corps, [{ url: 'api/rules', body: { question: 'Combien de tours ?', history: [] } }]);
});

test('espace inconnu ou valeur hostile dans rade.espace.v1 sur un aperçu : page de Naos (même règle que l’app)', async () => {
  for (const v of ['Tofinou', '__proto__', 'naos', '<b>x</b>']) {
    const p = await pageRegles({ hote: 'apercu.localhost', stockage: { 'rade.espace.v1': v } });
    assert.equal(sha(p.html), V43.cas.apercu.page, v);
  }
});

test('js/regles.js : note construite par textContent, aucun innerHTML pour la note', () => {
  const src = readFileSync(ROOT + 'js/regles.js', 'utf8');
  const bloc = src.slice(src.indexOf('const noteEspace'), src.indexOf('const espacePret'));
  assert.ok(bloc.length > 100);
  assert.ok(!/innerHTML/.test(bloc), 'note sans innerHTML');
  assert.match(bloc, /textContent/);
  assert.match(src, /bootEspace\(location\.hostname, localStorage\)/);
});
