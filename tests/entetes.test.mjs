// En-têtes de sécurité de vercel.json (défaut du 20/10) : la politique de contenu doit rester celle que l’app respecte VRAIMENT.
// Ces gardes lisent vercel.json et le code de l’app ; la preuve dans le navigateur est faite par `node tools/regate-e2e.mjs` (serveur
// local commun tools/serveur-local.mjs : mêmes en-têtes, même liste blanche, échec à la moindre violation).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { lireEntetes, motifSource, reglesPour, entetesPour } from '../tools/serveur-local.mjs';

const lu = (f) => readFileSync(ROOT + f, 'utf8');
const regles = lireEntetes(ROOT);
const jsFiles = readdirSync(ROOT + 'js').filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
const rapports = readdirSync(ROOT + 'rapports').filter((f) => f.endsWith('.html')).map((f) => 'rapports/' + f);
const PAGES = ['index.html', 'guide.html', 'regles.html', 'acces.html'];

// « dir-a 'self' x; dir-b y » → Map { dir-a → ["'self'", 'x'], … }
const lireListe = (texte, separateur) => new Map(texte.split(separateur).map((s) => s.trim()).filter(Boolean).map((d) => {
  const [nom, ...sources] = d.split(/\s+/);
  return [nom, sources];
}));
const csp = (chemin) => lireListe(entetesPour(chemin, regles)['content-security-policy'] || '', ';');

const CHEMINS_APP = ['/', '/index.html', '/guide.html', '/regles.html', '/acces.html', '/acces.js', '/sw.js', '/js/app.js', '/data/meta.json',
  '/vendor/pdf.worker.min.js', '/icons/logo.png', '/api/archive'];
const RAPPORT = '/rapports/coupe-snpm-2026.html';
const SECURITE = ['x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options'];

test('motifSource : émule les motifs de vercel.json comme Vercel ; une syntaxe inconnue lève une erreur', () => {
  const ok = (source, chemin) => motifSource(source).test(chemin);
  assert.ok(ok('/', '/') && !ok('/', '/index.html'));
  assert.ok(ok('/index.html', '/index.html') && !ok('/index.html', '/indexxhtml'), 'les points sont littéraux');
  assert.ok(ok('/js/:path*', '/js') && ok('/js/:path*', '/js/a.js') && ok('/js/:path*', '/js/x/y.js') && !ok('/js/:path*', '/jsx/a.js'));
  assert.ok(ok('/(.*)', '/') && ok('/(.*)', '/index.html') && ok('/(.*)', '/rapports/x.html'));
  assert.ok(ok('/((?!rapports/).*)', '/') && ok('/((?!rapports/).*)', '/index.html') && ok('/((?!rapports/).*)', '/js/app.js'));
  assert.ok(!ok('/((?!rapports/).*)', '/rapports/x.html'), 'les rapports sont exclus de la politique de l’app');
  assert.ok(ok('/rapports/(.*)', '/rapports/x.html') && !ok('/rapports/(.*)', '/index.html'));
  for (const source of ['/x/:id', '/a+', '/a?', '/a*', '/{a,b}', '/(ouverte']) assert.throws(() => motifSource(source), /non émulé/, `${source} doit être refusé`);
  for (const r of regles) assert.doesNotThrow(() => motifSource(r.source), `${r.source} : motif de vercel.json non émulé`);
});

test('vercel.json : les six règles de cache et les fonctions sont intactes ; ni réécriture ni redirection', () => {
  const v = JSON.parse(lu('vercel.json'));
  assert.deepEqual(v.headers.slice(0, 6).map((r) => r.source), ['/', '/index.html', '/sw.js', '/styles.css', '/js/:path*', '/data/:path*']);
  for (const r of v.headers.slice(0, 6)) assert.deepEqual(r.headers, [{ key: 'Cache-Control', value: 'no-cache' }]);
  assert.deepEqual(Object.keys(v.functions), ['api/archive.js', 'api/debrief.js', 'api/ic.js', 'api/rules.js']);
  for (const cle of ['rewrites', 'routes', 'redirects', 'cleanUrls']) assert.ok(!(cle in v), `${cle} ne doit pas apparaître`);
});

test('entetesPour : les quatre en-têtes de sécurité et la politique de l’app sur tout le site, celle des rapports sur /rapports/', () => {
  for (const chemin of CHEMINS_APP) {
    const e = entetesPour(chemin, regles);
    for (const k of SECURITE) assert.ok(e[k], `${chemin} : ${k} manquant`);
    assert.equal(e['x-content-type-options'], 'nosniff');
    assert.equal(e['referrer-policy'], 'same-origin');
    assert.equal(e['x-frame-options'], 'DENY');
    assert.ok(e['content-security-policy']?.includes("script-src 'self';"), `${chemin} : politique de l’app manquante`);
    assert.ok(!e['content-security-policy'].includes('googleapis'), `${chemin} : la politique de l’app ne s’ouvre pas à Google Fonts`);
  }
  const r = entetesPour(RAPPORT, regles);
  for (const k of SECURITE) assert.ok(r[k], `rapport : ${k} manquant`);
  assert.ok(r['content-security-policy'].includes('https://fonts.googleapis.com'), 'le rapport public garde ses polices');
  assert.ok(r['content-security-policy'].includes("form-action 'none'"));
});

test('entetesPour : une même clé n’est jamais posée par deux règles pour un même chemin', () => {
  for (const chemin of [...CHEMINS_APP, RAPPORT, '/rapports/coupe-snpm-2026.js']) {
    const cles = reglesPour(chemin, regles).flatMap((r) => r.headers.map((h) => h.key.toLowerCase()));
    assert.deepEqual(cles.filter((k, i) => cles.indexOf(k) !== i), [], `${chemin} : clé posée deux fois (le résultat dépendrait de l’ordre)`);
  }
});

test('politique de l’app : script-src exactement \'self\', rien d’ouvert, connect-src = \'self\' + les hôtes de js/weather.js', () => {
  const p = csp('/');
  assert.deepEqual(p.get('script-src'), ["'self'"], 'ni script en ligne, ni eval, ni hôte');
  assert.deepEqual(p.get('default-src'), ["'self'"]);
  assert.deepEqual(p.get('object-src'), ["'none'"]);
  assert.deepEqual(p.get('base-uri'), ["'none'"]);
  assert.deepEqual(p.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(p.get('form-action'), ["'self'"]);
  const hotes = [...new Set([...lu('js/weather.js').matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((m) => 'https://' + m[1]))].sort();
  assert.ok(hotes.length >= 3, 'js/weather.js nomme ses hôtes (prévisions, mer, balises)');
  assert.deepEqual(p.get('connect-src').filter((s) => s !== "'self'").sort(), hotes, 'connect-src = les hôtes réellement fetchés, ni plus ni moins');
  assert.ok(p.get('connect-src').includes("'self'"));
  for (const [dir, sources] of p) {
    for (const s of sources) {
      assert.ok(!['*', 'https:', 'http:', "'unsafe-eval'", "'wasm-unsafe-eval'"].includes(s), `${dir} ${s} : trop large`);
    }
  }
  for (const dir of ['script-src', 'connect-src']) {
    for (const s of p.get(dir)) assert.ok(!['data:', 'blob:', "'unsafe-inline'"].includes(s), `${dir} ne doit pas accepter ${s}`);
  }
  assert.ok(p.get('style-src').includes("'unsafe-inline'"), 'les attributs style des gabarits de l’app l’exigent (seule source en ligne admise : le style)');
});

test('politique des rapports : script-src \'self\' ; Google Fonts seulement dans style-src et font-src', () => {
  const p = csp(RAPPORT);
  assert.deepEqual(p.get('script-src'), ["'self'"]);
  assert.deepEqual(p.get('object-src'), ["'none'"]);
  assert.deepEqual(p.get('frame-ancestors'), ["'none'"]);
  for (const [dir, sources] of p) {
    for (const s of sources) {
      assert.ok(!['*', 'https:', "'unsafe-eval'"].includes(s), `${dir} ${s} : trop large`);
      if (/google|gstatic/.test(s)) assert.ok(['style-src', 'font-src'].includes(dir), `${dir} : Google Fonts n’a rien à faire ici`);
    }
  }
  assert.deepEqual(p.get('style-src').filter((s) => s.startsWith('https:')), ['https://fonts.googleapis.com']);
  assert.deepEqual(p.get('font-src').filter((s) => s.startsWith('https:')), ['https://fonts.gstatic.com']);
  // la page ne charge rien d’autre que ces deux hôtes
  for (const f of rapports) {
    const hotes = [...lu(f).matchAll(/(?:src|href)=["']https?:\/\/([^/"']+)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(hotes)].filter((h) => h !== 'fonts.googleapis.com'), [], `${f} charge un hôte que la politique des rapports ne permet pas`);
  }
});

test('aucun script en ligne, aucun attribut on…=, aucune adresse javascript: dans les pages ni dans les gabarits de js/', () => {
  for (const f of [...PAGES, ...rapports]) {
    const html = lu(f);
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) assert.match(m[1], /\bsrc="[^"]+"/, `${f} : balise script sans src`);
    assert.ok(!/<[a-z][^>]*\son[a-z]+\s*=/i.test(html), `${f} : attribut on…= (gestionnaire en ligne)`);
    assert.ok(!/javascript:/i.test(html), `${f} : adresse javascript:`);
  }
  for (const f of jsFiles) {
    const src = lu(f);
    assert.ok(!/<[a-z][^>]*\son[a-z]+\s*=\s*["'\\]/i.test(src), `${f} : un gabarit HTML pose un attribut on…=`);
    assert.ok(!/javascript:/i.test(src), `${f} : adresse javascript:`);
    assert.ok(!/\beval\(|new Function\(/.test(src.replace(/isEvalSupported/g, '')), `${f} : eval ou Function`);
  }
});

test('aucun fichier de js/ n’appelle fetch avec une adresse absolue, sauf js/weather.js', () => {
  for (const f of jsFiles.filter((x) => x !== 'js/weather.js')) {
    assert.ok(!/\bfetch\(\s*[`'"]\s*(?:https?:)?\/\//.test(lu(f)), `${f} : fetch vers une adresse absolue`);
    assert.ok(!/new (?:WebSocket|EventSource)\(/.test(lu(f)), `${f} : connexion hors fetch`);
  }
});

test('Permissions-Policy : géolocalisation et micro permis à (self) ; chaque fonction du navigateur utilisée par le code a sa permission, jamais à ()', () => {
  const entrees = new Map(entetesPour('/', regles)['permissions-policy'].split(',').map((x) => x.trim().split('=')));
  assert.equal(entrees.get('geolocation'), '(self)');
  assert.equal(entrees.get('microphone'), '(self)');
  const code = [...jsFiles, 'index.html', 'guide.html', 'regles.html'].map(lu).join('\n');
  const UTILISEES = [
    [/navigator\.geolocation/, ['geolocation']],
    [/SpeechRecognition/, ['microphone']],
    [/wakeLock/, ['screen-wake-lock']],
    [/requestFullscreen/, ['fullscreen']],
    [/DeviceOrientationEvent|deviceorientation/, ['accelerometer', 'gyroscope', 'magnetometer']],
    [/navigator\.clipboard/, ['clipboard-write']],
  ];
  for (const [motif, fonctions] of UTILISEES) {
    assert.match(code, motif, `le code utilise encore ${fonctions[0]} ? sinon retirez-la de la liste du test`);
    for (const fn of fonctions) assert.equal(entrees.get(fn), '(self)', `${fn} est utilisée par le code : elle doit être permise à (self)`);
  }
  // « web-share » (navigator.share) est inconnue de Chromium : son message « Unrecognized feature » fait échouer les outils ; elle est retirée de la
  // liste (le partage reste permis à la page elle-même par la valeur par défaut)
  assert.ok(!entrees.has('web-share'), 'web-share n’est pas reconnue par Chromium : à ne pas remettre dans la liste');
  // les fonctions coupées ne sont pas utilisées
  const COUPEES = { camera: /getUserMedia|mediaDevices|capture=/, payment: /PaymentRequest/, usb: /navigator\.usb/, midi: /requestMIDIAccess/, 'display-capture': /getDisplayMedia/ };
  for (const [fn, motif] of Object.entries(COUPEES)) {
    assert.equal(entrees.get(fn), '()', `${fn} doit rester coupée`);
    assert.doesNotMatch(code, motif, `le code utilise ${fn} alors que la politique la coupe`);
  }
});
