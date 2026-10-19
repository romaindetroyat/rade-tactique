// Contrôle d’accès : sans code d’équipage, rien de privé n’est servi (TEST-02).
// On exécute le VRAI middleware.js et on émule son `matcher` comme Vercel. Aucun vrai code d’accès n’est utilisé :
// pour le cas « code valide », crypto.subtle.digest est simulé (le faux code « code-de-test » reçoit l’empreinte d’une ligne
// de la table, lue à l’exécution). Aucune empreinte ni aucun code n’est écrit dans ce fichier ni affiché par lui.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import middleware, { config } from '../middleware.js';

// Seuls ces noms exacts et ces dossiers sont publics ; tout le reste du dépôt passe par le middleware.
const PUBLIC_EXACT = ['/acces.html', '/manifest.webmanifest', '/sw.js'];
const PUBLIC_PREFIX = ['/icons/', '/rapports/'];
const estPublic = (p) => PUBLIC_EXACT.includes(p) || PUBLIC_PREFIX.some((x) => p.startsWith(x));

// Émulation du matcher de Vercel : il décrit les chemins que le middleware intercepte
const matcher = new RegExp('^' + config.matcher[0] + '[/#?]?$', 'i');
const interceptee = (p) => matcher.test(p);

function fichiers(dir = '') {
  const out = [];
  for (const nom of readdirSync(ROOT + dir)) {
    if (!dir && ['node_modules', '.git', '.vercel'].includes(nom)) continue;
    const rel = dir + nom;
    if (statSync(ROOT + rel).isDirectory()) out.push(...fichiers(rel + '/'));
    else out.push('/' + rel);
  }
  return out;
}

const appeler = (chemin, headers = {}) => middleware(new Request('https://rade.test' + chemin, { headers }));
// variantes de requêtes d’un visiteur sans code : en-têtes vides, navigation, cookie quelconque
const VISITEURS = [{}, { accept: 'text/html' }, { cookie: 'rt_acces=n-importe-quoi' }];
const refuse = (res) => res.status === 401 || (res.status === 302 && (res.headers.get('location') || '').startsWith('/acces.html?'));

test('seuls acces.html, manifest.webmanifest, sw.js, icons/ et rapports/ échappent au middleware', () => {
  const tous = fichiers();
  const hors = tous.filter((p) => !interceptee(p));
  assert.deepEqual(hors.filter((p) => !estPublic(p)), [], 'fichiers du dépôt servis sans code alors qu’ils ne sont pas dans la liste publique');
  for (const p of PUBLIC_EXACT) assert.ok(tous.includes(p), `${p} devrait exister dans le dépôt`);
  assert.deepEqual(tous.filter((p) => estPublic(p) && interceptee(p)), [], 'fichiers publics attendus mais interceptés par le middleware');
});

test('noms voisins des fichiers publics : interceptés (sw.js.map, sw.jsx, acces.html.bak, manifest.webmanifest.old)', () => {
  for (const p of ['/sw.js.map', '/sw.jsx', '/acces.html.bak', '/manifest.webmanifest.old', '/acces.html/x']) {
    assert.ok(interceptee(p), `${p} devrait passer par le middleware`);
  }
});

test('sans code : tout fichier non public, toute fonction /api et tout chemin inconnu sont refusés', async () => {
  const api = readdirSync(ROOT + 'api').filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => '/api/' + f.slice(0, -3));
  assert.ok(api.length >= 3, 'les fonctions /api du dépôt doivent être énumérées');
  const chemins = [
    ...fichiers().filter((p) => !estPublic(p)),
    ...api, '/', '/api/inconnu', '/.planning/STATE.md', '/srv.log', '/package.json', '/middleware.js', '/vercel.json',
    '/tests/fixtures/coupe-snpm-2026-10-18.gpx', '/inconnu', '/sw.js.map', '/sw.jsx', '/acces.html.bak', '/manifest.webmanifest.old',
  ];
  for (const chemin of new Set(chemins)) {
    assert.ok(interceptee(chemin), `${chemin} devrait passer par le middleware`);
    for (const h of VISITEURS) {
      const res = await appeler(chemin, h);
      assert.equal(res.headers.get('x-middleware-next'), null, `${chemin} servi sans code (en-têtes ${JSON.stringify(Object.keys(h))})`);
      assert.ok(refuse(res), `${chemin} : réponse ${res.status} inattendue (en-têtes ${JSON.stringify(Object.keys(h))})`);
      if (chemin.startsWith('/api/') && !h.accept) {
        assert.equal(res.status, 401, `${chemin} : 401 attendu`);
        assert.equal(res.headers.get('content-type'), 'application/json', `${chemin} : réponse JSON attendue`);
      }
    }
  }
});

test('avec un code valide simulé : cookie accepté, lien ?acces= redirigé avec cookie, puis refus une fois le simulacre retiré', async () => {
  // une empreinte de la table, lue à l’exécution (jamais affichée ni recopiée)
  const source = readFileSync(ROOT + 'middleware.js', 'utf8');
  const hex = /'([0-9a-f]{64})'\s*:/.exec(source)?.[1];
  assert.ok(hex, 'la table EQUIPAGE doit contenir au moins une empreinte');
  const octets = Buffer.from(hex, 'hex');
  const vrai = crypto.subtle.digest.bind(crypto.subtle);
  const faux = mock.method(crypto.subtle, 'digest', async (algo, data) => {
    const entree = new TextDecoder().decode(data);
    return entree === 'code-de-test' ? octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) : vrai(algo, data);
  });
  try {
    const ok = await appeler('/index.html', { cookie: 'rt_acces=code-de-test' });
    assert.equal(ok.headers.get('x-middleware-next'), '1', 'le cookie du code simulé doit laisser passer');

    const lien = await appeler('/?acces=code-de-test&x=1');
    assert.equal(lien.status, 302);
    assert.equal(lien.headers.get('location'), '/?x=1', 'le code doit disparaître de l’adresse');
    const cookie = lien.headers.get('set-cookie') || '';
    assert.ok(cookie.startsWith('rt_acces=code-de-test;'), 'cookie d’accès posé');
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax']) assert.ok(cookie.includes(attr), `attribut ${attr} manquant`);

    const mauvais = await appeler('/?acces=un-autre-code');
    assert.equal(mauvais.status, 302);
    assert.ok((mauvais.headers.get('location') || '').startsWith('/acces.html?erreur=1'), 'un mauvais code renvoie vers la page d’accès');
    assert.equal(mauvais.headers.get('set-cookie'), null, 'aucun cookie pour un mauvais code');
  } finally {
    faux.mock.restore();
  }
  // simulacre retiré : le même cookie ne passe plus
  const apres = await appeler('/data/meta.json', { cookie: 'rt_acces=code-de-test' });
  assert.equal(apres.status, 401, 'le faux code doit être refusé une fois le simulacre retiré');
  assert.equal(apres.headers.get('x-middleware-next'), null);
});

test('vercel.json : aucune réécriture, route, redirection ni cleanUrls qui contournerait le middleware', () => {
  const v = JSON.parse(readFileSync(ROOT + 'vercel.json', 'utf8'));
  for (const cle of ['rewrites', 'routes', 'redirects', 'cleanUrls']) assert.ok(!(cle in v), `vercel.json ne doit pas contenir ${cle} sans relecture de l’accès`);
});
