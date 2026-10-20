// Contrôle d’accès : sans code d’équipage, rien de privé n’est servi (TEST-02).
// On exécute le VRAI middleware.js et on émule son `matcher` comme Vercel. Aucun vrai code d’accès n’est utilisé :
// pour le cas « code valide », crypto.subtle.digest est simulé (le faux code « code-de-test » reçoit l’empreinte d’une ligne
// de la table, lue à l’exécution). Aucune empreinte ni aucun code n’est écrit dans ce fichier ni affiché par lui.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import middleware, { config, cheminDeLApp } from '../middleware.js';
import { listShell } from '../tools/stamp.mjs';
import { avecCodeSimule, tableEquipage, COOKIE_TEST, FAUX_CODE } from './helpers/codesimule.mjs';

// Seuls ces noms exacts et ces dossiers sont publics ; tout le reste du dépôt passe par le middleware.
const PUBLIC_EXACT = ['/acces.html', '/acces.js', '/manifest.webmanifest', '/sw.js'];
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

test('seuls acces.html, acces.js, manifest.webmanifest, sw.js, icons/ et rapports/ échappent au middleware', () => {
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
    ...api, '/api/membre', '/', '/api/inconnu', '/.planning/STATE.md', '/srv.log', '/package.json', '/middleware.js', '/vercel.json',
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

test('GET /api/membre : 401 sans code ; avec un code valide simulé, le prénom seul (no-store), jamais le code ni l’empreinte ; le reste passe toujours', async () => {
  // prénom et empreinte d’une ligne de la table, lus à l’exécution (jamais affichés ni recopiés)
  const source = readFileSync(ROOT + 'middleware.js', 'utf8');
  const ligne = /'([0-9a-f]{64})'\s*:\s*'([^']+)'/.exec(source);
  assert.ok(ligne, 'la table EQUIPAGE doit contenir au moins une ligne');
  const [, hex, prenom] = ligne;
  assert.ok(interceptee('/api/membre'), '/api/membre doit passer par le middleware');
  for (const h of VISITEURS) {
    const res = await appeler('/api/membre', h);
    assert.equal(res.headers.get('x-middleware-next'), null, 'sans code : jamais servie');
    assert.ok(refuse(res), `sans code : réponse ${res.status} inattendue`);
    if (!h.accept) { assert.equal(res.status, 401); assert.equal(res.headers.get('content-type'), 'application/json'); }
  }
  const octets = Buffer.from(hex, 'hex');
  const vrai = crypto.subtle.digest.bind(crypto.subtle);
  const faux = mock.method(crypto.subtle, 'digest', async (algo, data) => (new TextDecoder().decode(data) === 'code-de-test' ? octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) : vrai(algo, data)));
  try {
    const res = await appeler('/api/membre', { cookie: 'rt_acces=code-de-test' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /^application\/json/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-middleware-next'), null, 'répondue par le middleware, pas transmise');
    assert.equal(res.headers.get('set-cookie'), null);
    const texte = await res.text();
    assert.deepEqual(JSON.parse(texte), { membre: prenom }, 'le prénom et rien d’autre');
    assert.ok(!texte.includes('code-de-test') && !texte.includes(hex), 'ni le code ni l’empreinte dans le corps');
    const index = await appeler('/index.html', { cookie: 'rt_acces=code-de-test' });
    assert.equal(index.headers.get('x-middleware-next'), '1', 'le reste du site passe toujours');
    const autre = await appeler('/api/voice', { cookie: 'rt_acces=code-de-test' });
    assert.equal(autre.headers.get('x-middleware-next'), '1', 'les autres fonctions passent toujours');
  } finally {
    faux.mock.restore();
  }
  const apres = await appeler('/api/membre', { cookie: 'rt_acces=code-de-test' });
  assert.equal(apres.status, 401, 'simulacre retiré : refusée');
});

test('vercel.json : aucune réécriture, route, redirection ni cleanUrls qui contournerait le middleware', () => {
  const v = JSON.parse(readFileSync(ROOT + 'vercel.json', 'utf8'));
  for (const cle of ['rewrites', 'routes', 'redirects', 'cleanUrls']) assert.ok(!(cle in v), `vercel.json ne doit pas contenir ${cle} sans relecture de l’accès`);
});

// ── Archive partagée (ARCH-01, critère 3) : /api/archive est fermée sans code, et l’auteur vient du middleware seul

// Toutes les formes d’adresse de l’archive qu’un visiteur sans code pourrait essayer (majuscules, barre finale, .js, encodage du « a »)
const ARCHIVE = [
  '/api/archive', '/api/archive?k=light', '/api/archive?k=light&rev=abc', '/api/archive?k=trace&id=x', '/api/archive?k=report&id=x&t=1',
  '/api/archive?k=day&r=x&d=2026-11-07', '/api/archive/', '/api/archive.js', '/API/archive', '/API/ARCHIVE?k=light', '/%61pi/archive?k=light',
  '/api/archive/../archive?k=light', '/api//archive',
];

test('archive : sans code, /api/archive sous toutes ses formes et toutes ses méthodes est refusée, rien n’est transmis', async () => {
  for (const chemin of ARCHIVE) {
    assert.ok(interceptee(chemin), `${chemin} devrait passer par le middleware`);
    for (const method of ['GET', 'PUT', 'POST', 'DELETE']) {
      for (const h of VISITEURS) {
        const res = await middleware(new Request('https://rade.test' + chemin, { method, headers: h, ...(method === 'GET' ? {} : { body: '{"doc":{}}' }) }));
        assert.equal(res.headers.get('x-middleware-next'), null, `${method} ${chemin} transmise sans code`);
        assert.equal(res.headers.get('x-middleware-override-headers'), null, `${method} ${chemin} : aucun en-tête posé pour un visiteur sans code`);
        assert.ok(refuse(res), `${method} ${chemin} : réponse ${res.status} inattendue`);
        if (!h.accept) assert.equal(res.status, 401, `${method} ${chemin} : 401 attendu`);
      }
    }
  }
  const json = await appeler('/api/archive?k=light');
  assert.equal(json.headers.get('content-type'), 'application/json');
  assert.equal(await json.text(), '{"error":"acces"}');
});

test('archive : avec un code valide simulé, x-rt-membre est le prénom de la table et remplace celui du navigateur ; ni code ni empreinte dans les en-têtes', async () => {
  await avecCodeSimule(async ({ hex, prenom }) => {
    for (const usurpe of ['Usurpateur', encodeURIComponent('Usurpateur'), '', 'Romain, Teiva']) {
      const res = await appeler('/api/archive?k=light', { cookie: COOKIE_TEST, 'x-rt-membre': usurpe, 'content-type': 'application/json', accept: 'application/json' });
      assert.equal(res.headers.get('x-middleware-next'), '1', 'une requête avec code valide est transmise');
      const transmis = res.headers.get('x-middleware-request-x-rt-membre');
      assert.equal(decodeURIComponent(transmis), prenom, 'l’auteur est le prénom de la table');
      assert.equal(transmis, encodeURIComponent(prenom), 'valeur encodée : une valeur d’en-tête reste en octets simples');
      assert.notEqual(decodeURIComponent(transmis), 'Usurpateur');
      const liste = (res.headers.get('x-middleware-override-headers') || '').split(',');
      assert.ok(liste.includes('x-rt-membre'), 'x-rt-membre est dans la liste des en-têtes remplacés');
      assert.ok(liste.includes('content-type'), 'les en-têtes utiles à la fonction (type du corps) sont conservés');
      assert.ok(!liste.includes('cookie'), 'le cookie du code d’accès n’est pas transmis aux fonctions');
      for (const [nom, valeur] of res.headers) {
        assert.ok(!valeur.includes(FAUX_CODE) && !valeur.includes(hex), `l’en-tête ${nom} contient le code ou l’empreinte`);
      }
    }
    // sans en-tête du navigateur : le prénom est posé quand même
    const sans = await appeler('/api/archive?k=light', { cookie: COOKIE_TEST });
    assert.equal(decodeURIComponent(sans.headers.get('x-middleware-request-x-rt-membre')), prenom);
    // un corps PUT passe aussi (méthode et type de contenu intacts)
    const put = await middleware(new Request('https://rade.test/api/archive?k=light', { method: 'PUT', headers: { cookie: COOKIE_TEST, 'content-type': 'application/json' }, body: '{"doc":{}}' }));
    assert.equal(put.headers.get('x-middleware-next'), '1');
    assert.equal(decodeURIComponent(put.headers.get('x-middleware-request-x-rt-membre')), prenom);
  });
});

test('archive : les formes inhabituelles de l’adresse (majuscules, encodage, barre finale, .js) reçoivent elles aussi l’auteur du middleware, jamais celui du navigateur', async () => {
  await avecCodeSimule(async ({ prenom }) => {
    for (const chemin of ARCHIVE) {
      const res = await appeler(chemin, { cookie: COOKIE_TEST, 'x-rt-membre': 'Usurpateur' });
      if (res.headers.get('x-middleware-next') !== '1') continue;                      // refusée : rien n’arrive à la fonction
      assert.equal(decodeURIComponent(res.headers.get('x-middleware-request-x-rt-membre') || ''), prenom, `${chemin} : l’en-tête du navigateur ne doit jamais arriver à une fonction`);
    }
  });
});

test('archive : le reste du site n’est pas modifié (aucun en-tête remplacé), /api/membre reste répondue par le middleware', async () => {
  await avecCodeSimule(async ({ prenom }) => {
    for (const chemin of ['/index.html', '/', '/js/app.js', '/data/meta.json', '/styles.css']) {
      const res = await appeler(chemin, { cookie: COOKIE_TEST, 'x-rt-membre': 'Usurpateur' });
      assert.equal(res.headers.get('x-middleware-next'), '1', `${chemin} passe avec un code valide`);
      assert.equal(res.headers.get('x-middleware-override-headers'), null, `${chemin} : la requête ne doit pas être modifiée`);
      assert.equal(res.headers.get('x-middleware-request-x-rt-membre'), null);
    }
    // hors de la liste blanche : 404 du middleware, jamais transmise, et rien n'est posé sur la requête
    const docs = await appeler('/api-docs.html', { cookie: COOKIE_TEST, 'x-rt-membre': 'Usurpateur' });
    assert.equal(docs.status, 404, '/api-docs.html n’est pas l’app');
    assert.equal(docs.headers.get('x-middleware-next'), null);
    assert.equal(docs.headers.get('x-middleware-request-x-rt-membre'), null);
    const membre = await appeler('/api/membre', { cookie: COOKIE_TEST });
    assert.equal(membre.status, 200);
    assert.equal(membre.headers.get('x-middleware-next'), null);
    assert.deepEqual(JSON.parse(await membre.text()), { membre: prenom });
  });
});

test('archive : aucune empreinte de la table n’apparaît ailleurs que dans middleware.js (seuls des noms de fichiers sont rapportés)', () => {
  const empreintes = tableEquipage().map((l) => l.hex);
  assert.ok(empreintes.length >= 1, 'la table EQUIPAGE doit contenir au moins une empreinte');
  const trouves = fichiers().filter((p) => p !== '/middleware.js').filter((p) => {
    const contenu = readFileSync(ROOT + p.slice(1));
    return empreintes.some((h) => contenu.includes(h));
  });
  assert.deepEqual(trouves, [], 'fichiers contenant une empreinte de la table (noms seulement)');
});

test('vercel.json : api/archive.js a une durée maximale et embarque js/archmerge.js (Pitfall 15)', () => {
  const v = JSON.parse(readFileSync(ROOT + 'vercel.json', 'utf8'));
  const f = v.functions?.['api/archive.js'];
  assert.ok(f, 'api/archive.js doit être déclarée dans functions');
  assert.ok(f.maxDuration > 0 && f.maxDuration <= 60, 'maxDuration entre 1 et 60 s');
  assert.ok(String(f.includeFiles || '').includes('js/archmerge.js'), 'includeFiles doit couvrir js/archmerge.js');
  for (const cle of ['rewrites', 'routes', 'redirects', 'cleanUrls']) assert.ok(!(cle in v), `${cle} ne doit pas apparaître`);
});

// ── Fichiers internes (défaut du 20/10) : le dépôt entier est publié, la liste blanche cheminDeLApp ferme tout ce qui n’est pas l’app

// Les onze fichiers lisibles avec un code valide avant la v35
const ONZE = ['/.planning/STATE.md', '/.claude/CLAUDE.md', '/middleware.js', '/api/_ia.js', '/api/rules.js', '/tests/access.test.mjs',
  '/tools/stamp.mjs', '/docs/ia-budget.md', '/README.md', '/vercel.json', '/release.json'];
// Chemins refusés par la liste blanche : fichiers internes, dossiers cachés, contournements d’écriture, casse, extensions, barres
const REFUSES = [...ONZE, '/package.json', '/package-lock.json', '/srv.log', '/.gitignore', '/.git/config', '/node_modules/openai/package.json',
  '/js/..%2F.planning/STATE.md', '/js/%2e%2e%2fmiddleware.js', '/JS/app.js', '/js/', '/vendor/sous/x.js', '/api/_ia', '/api/archive/', '/api/archive.js',
  '/API/archive', '/%61pi/archive', '/api//archive', '/api-docs.html', '/favicon.ico', '/js/.cache', '/js/a\\b.js', '//js/app.js', '/rapports/a/b.html'];
const apiDuDepot = () => readdirSync(ROOT + 'api').filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => '/api/' + f.slice(0, -3));
const cheminsDeLApp = () => [...listShell(ROOT).map((f) => (f === './' ? '/' : '/' + f)), ...PUBLIC_EXACT,
  '/icons/logo.png', '/rapports/coupe-snpm-2026.html', '/rapports/coupe-snpm-2026.js', '/vendor/pdf.worker.min.js', '/api/membre', ...apiDuDepot()];
const internes = () => [...new Set([...fichiers().filter((p) => !cheminDeLApp(p)), ...REFUSES])];

test('cheminDeLApp : vrai pour tout ce que l’app sert (liste hors réseau, pages publiques, fonctions /api)', () => {
  assert.ok(apiDuDepot().length >= 4, 'les fonctions /api du dépôt doivent être énumérées');
  for (const p of cheminsDeLApp()) assert.equal(cheminDeLApp(p), true, `${p} fait partie de l’app`);
});

test('cheminDeLApp : faux pour tout fichier du dépôt hors de l’app et pour chaque contournement d’écriture', () => {
  for (const p of ONZE) assert.ok(internes().includes(p), `${p} doit figurer dans la liste des chemins internes`);
  for (const p of internes()) assert.equal(cheminDeLApp(p), false, `${p} n’est pas l’app`);
  for (const p of [undefined, null, '', 'js/app.js', 42]) assert.equal(cheminDeLApp(p), false, `${String(p)} : pas un chemin`);
  // un fichier du dépôt n’est servi que s’il est dans la liste de l’app : aucun fichier de js/, data/, vendor/ ou icons/ n’est oublié
  for (const p of fichiers().filter((f) => /^\/(js|data|vendor|icons)\//.test(f))) assert.equal(cheminDeLApp(p), true, `${p} doit rester servi`);
});

test('avec un code valide simulé : chaque chemin interne reçoit 404, sans écho, sans cookie, sans le code ni une empreinte', async () => {
  await avecCodeSimule(async () => {
    const empreintes = tableEquipage().map((l) => l.hex);
    for (const chemin of internes()) {
      if (!interceptee(chemin)) continue;               // dossiers publics : le middleware n’y passe pas
      for (const h of [{ cookie: COOKIE_TEST }, { cookie: COOKIE_TEST, accept: 'text/html' }]) {
        const res = await appeler(chemin, h);
        assert.equal(res.status, 404, `${chemin} : 404 attendu`);
        assert.equal(res.headers.get('x-middleware-next'), null, `${chemin} transmis alors qu’il n’est pas l’app`);
        assert.equal(res.headers.get('x-middleware-override-headers'), null, `${chemin} : aucun en-tête posé`);
        assert.equal(res.headers.get('set-cookie'), null, `${chemin} : aucun cookie`);
        assert.equal(res.headers.get('cache-control'), 'no-store', `${chemin} : rien en cache`);
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        const corps = await res.text();
        assert.ok(corps === 'Introuvable.' || corps === '{"error":"introuvable"}', `${chemin} : corps fixe attendu`);
        assert.ok(!corps.includes(chemin) && !corps.includes('code-de-test'), `${chemin} : le corps ne renvoie ni le chemin ni le code`);
        for (const [nom, valeur] of res.headers) {
          assert.ok(!valeur.includes(FAUX_CODE) && !empreintes.some((e) => valeur.includes(e)), `l’en-tête ${nom} de ${chemin} contient le code ou une empreinte`);
          assert.ok(!valeur.includes(chemin) || chemin === '/', `l’en-tête ${nom} de ${chemin} renvoie le chemin`);
        }
        assert.equal(res.headers.get('content-type'), chemin.startsWith('/api') ? 'application/json' : 'text/plain; charset=utf-8');
      }
    }
  });
});

test('avec un code valide simulé : tout ce que l’app sert est transmis ; /api/membre répond le prénom ; les fonctions reçoivent x-rt-membre', async () => {
  await avecCodeSimule(async ({ prenom }) => {
    for (const chemin of cheminsDeLApp()) {
      if (!interceptee(chemin)) continue;
      const res = await appeler(chemin, { cookie: COOKIE_TEST });
      if (chemin === '/api/membre') { assert.equal(res.status, 200); continue; }
      assert.equal(res.headers.get('x-middleware-next'), '1', `${chemin} doit rester servi (réponse ${res.status})`);
      if (chemin.startsWith('/api/')) assert.equal(decodeURIComponent(res.headers.get('x-middleware-request-x-rt-membre')), prenom, `${chemin} : auteur posé`);
    }
  });
});

test('sans code : un chemin interne reste refusé en 401 ou redirigé vers acces.html, jamais 404 (un 404 dirait qu’un fichier existe)', async () => {
  for (const chemin of internes()) {
    if (!interceptee(chemin)) continue;
    for (const h of VISITEURS) {
      const res = await appeler(chemin, h);
      assert.notEqual(res.status, 404, `${chemin} : sans code, pas de 404`);
      assert.equal(res.headers.get('x-middleware-next'), null);
      assert.ok(refuse(res), `${chemin} : réponse ${res.status} inattendue`);
    }
  }
});

// Adresses de même origine demandées par l’app : modèle du balayage de tests/stamp.test.mjs
test('toute adresse de même origine demandée par l’app est servie par la liste blanche', () => {
  const lu = (f) => readFileSync(ROOT + f, 'utf8');
  const adresses = new Map();                               // chemin → origine
  const noter = (brut, base, origine) => {
    if (!brut || /^(https?:|\/\/|#|tel:|mailto:|data:|blob:|javascript:)/i.test(brut) || brut.includes('${')) return;
    adresses.set(new URL(brut, 'https://rade.test' + base).pathname, origine);
  };
  const jsFiles = readdirSync(ROOT + 'js').filter((f) => f.endsWith('.js'));
  for (const f of jsFiles) {
    const src = lu('js/' + f);
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) noter(m[1], '/js/', f);
    for (const m of src.matchAll(/\bfetch\(\s*(['"`])([^'"`]*)\1/g)) noter(m[2], '/', f + ' fetch');
    for (const m of src.matchAll(/(?:loadScript\(|window\.open\(|workerSrc\s*=)\s*['"]([^'"]+)['"]/g)) noter(m[1], '/', f);
    for (const m of src.matchAll(/(?<![-\w])(?:src|href)=["']([^"']+)["']/g)) noter(m[1], '/', f + ' gabarit');
  }
  // Terrain.load(base = 'data/') : fetch(base + 'nom')
  const geo = lu('js/geo.js');
  const base = /base\s*=\s*'([^']+)'/.exec(geo)?.[1];
  assert.ok(base, 'js/geo.js doit nommer le dossier des données');
  for (const m of geo.matchAll(/fetch\(\s*base\s*\+\s*'([^']+)'/g)) noter(base + m[1], '/', 'js/geo.js');
  for (const f of ['index.html', 'guide.html', 'regles.html', 'acces.html']) {
    for (const m of lu(f).matchAll(/(?<![-\w])(?:src|href)=["']([^"']+)["']/g)) noter(m[1], '/', f);
  }
  assert.ok(adresses.size >= 20, 'le balayage doit trouver les adresses de l’app');
  for (const a of ['/api/voice', '/api/membre', '/api/archive', '/api/ic', '/api/debrief', '/api/rules', '/vendor/pdf.min.js', '/data/terrain.bin', '/data/wx-snapshot.json', '/regles.html', '/guide.html']) {
    assert.ok(adresses.has(a), `le balayage doit trouver ${a}`);
  }
  const refusees = [...adresses].filter(([a]) => !cheminDeLApp(a)).map(([a, o]) => `${a} (demandée par ${o})`);
  assert.deepEqual(refusees, [], 'adresses demandées par l’app mais refusées par la liste blanche');
});

test('acces.html, regles.html et le rapport public n’ont plus de script en ligne : chaque balise script a un src', () => {
  for (const f of ['acces.html', 'regles.html', 'rapports/coupe-snpm-2026.html']) {
    const balises = [...readFileSync(ROOT + f, 'utf8').matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
    assert.ok(balises.length >= 1, `${f} garde son script, dans un fichier`);
    for (const attrs of balises) assert.match(attrs, /\bsrc="[^"]+"/, `${f} : balise script sans src`);
  }
  assert.ok(listShell(ROOT).includes('js/regles.js'), 'js/regles.js est hors réseau (l’arbitre marche en mer)');
});
