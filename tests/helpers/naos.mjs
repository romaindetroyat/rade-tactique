// Gel de Naos v43 (phase 8, D-01) : tout ce que le serveur fait pour l’équipage de Naos, partagé par la capture et par tests/naos.test.mjs.
// Capture une seule fois sur le code extrait de 5e9b8a5 (v43), jamais sur le code modifié :
//   node tests/helpers/naos.mjs --capture <racine> <sortie>
// Les modules sont passés en paramètre (`modulesNaos(racine)`) : la même matrice tourne sur l’ancien et sur le nouveau code.
// Le faux code est celui de tests/helpers/codesimule.mjs, accepté sur la table de middleware.js de la racine capturée (première ligne, lue à
// l’exécution, jamais écrite) : la fixture ne contient que des prénoms et le faux code, jamais une empreinte de la table.
// Les requêtes de l’archive et de l’IA portent dès la capture `x-rt-espace: naos` à côté de `x-rt-membre` : la v43 l’ignore, la v44 l’exigera.
// Seules les différences écrites dans `differencesAdmises` sont tolérées pour Naos en v44 ; tout autre écart casse `npm test`.
// Le fichier n’a pas « .test. » dans son nom : `npm test` ne le lance pas.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createFakeBlob, invoke } from './fakeblob.mjs';
// tests/helpers/codesimule.mjs (et donc tests/helpers/setup.mjs, qui remplace fetch) n’est chargé qu’au calcul des sections : tools/regate-e2e.mjs
// importe AJOUTS_SHELL d’ici sans ces cales
const simule = () => import('./codesimule.mjs');

export const FROM = '5e9b8a5';
const DEPOT = fileURLToPath(new URL('../../', import.meta.url));

// Fichiers que la v44 a le droit d’ajouter à la liste hors réseau (SHELL) et aux adresses demandées par l’app de Naos (scénario naos-cles),
// 64 Ko au plus chacun ; chaque plan de la phase y ajoute les siens. 08-04 : registre des espaces, descripteur de Bormes (importés par
// js/venues.js, donc demandés aussi par l’app de Naos). 08-05 : bateau de l’espace et polaire du Tofinou (importés par js/app.js), polaire
// téléchargeable du Tofinou (liste hors réseau seulement : l’app de Naos ne la demande pas).
export const AJOUTS_SHELL = Object.freeze(['js/espaces.js', 'js/venue-bormes.js', 'js/bateau.js', 'js/polar-tofinou95.js', 'data/tofinou95.pol', 'data/tofinou95-foc.pol']);
export const TAILLE_AJOUT_MAX = 64 * 1024;

// ───────────────────────── outils communs

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
// Forme canonique : clés triées à tous les niveaux (l’ordre des clés d’un JSON n’est pas un comportement)
export const canon = (x) => (Array.isArray(x) ? x.map(canon) : isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const copie = (x) => JSON.parse(JSON.stringify(x));

async function avecEnv(nom, valeur, fn) {
  const avant = process.env[nom];
  if (valeur == null) delete process.env[nom]; else process.env[nom] = valeur;
  try { return await fn(); } finally { if (avant === undefined) delete process.env[nom]; else process.env[nom] = avant; }
}

// Modules d’une racine (dépôt ou extraction), dans la forme attendue par naosCases
export async function modulesNaos(racine) {
  const base = racine.replace(/\/?$/, '/');
  const imp = (f) => import(pathToFileURL(base + f).href);
  const noms = ['middleware', 'archive', 'ia', 'rules', 'debrief', 'voice', 'ic'];
  const mods = await Promise.all(['middleware.js', 'api/archive.js', 'api/_ia.js', 'api/rules.js', 'api/debrief.js', 'api/voice.js', 'api/ic.js'].map(imp));
  return { racine: base, ...Object.fromEntries(noms.map((n, i) => [n, mods[i]])) };
}

// Fichiers d’un dossier (chemins « /… »), comme tests/access.test.mjs : node_modules, .git et .vercel exclus
export function fichiersDepot(racine, dir = '') {
  const base = racine.replace(/\/?$/, '/'), out = [];
  for (const nom of readdirSync(base + dir)) {
    if (!dir && ['node_modules', '.git', '.vercel'].includes(nom)) continue;
    const rel = dir + nom;
    if (statSync(base + rel).isDirectory()) out.push(...fichiersDepot(base, rel + '/'));
    else out.push('/' + rel);
  }
  return out;
}

// ───────────────────────── middleware

export const HOTES = Object.freeze(['https://rade.test', 'https://rade-tactique.vercel.app']);
const HOTE_NAOS = 'https://rade-tactique.vercel.app';
const etats = ({ FAUX_CODE, COOKIE_TEST }) => ({
  'sans-code': {},
  'lien-faux-code': { acces: FAUX_CODE },
  'lien-inconnu': { acces: 'inconnu-de-test' },
  'cookie-faux-code': { cookie: COOKIE_TEST },
  'cookie-inconnu': { cookie: 'rt_acces=inconnu-de-test' },
});
const REQUETES = [
  ['GET', '/'], ['GET', '/index.html'], ['GET', '/js/app.js'], ['GET', '/data/meta.json'], ['GET', '/data/brest.meta.json'], ['GET', '/regles.html'],
  ['GET', '/middleware.js'], ['GET', '/.planning/STATE.md'], ['GET', '/api/membre'], ['GET', '/api/archive?k=light'], ['PUT', '/api/archive?k=light'],
  ['POST', '/api/rules'],
];
const FORGES = { 'x-rt-membre': 'Usurpateur', 'x-rt-espace': 'tofinou' };
const NAVIGATION = { 'sec-fetch-mode': 'navigate', accept: 'text/html' };
const VARIANTES = { simple: {}, navigation: NAVIGATION, forges: FORGES, 'navigation-forges': { ...NAVIGATION, ...FORGES } };
const NOMMES = ['location', 'set-cookie', 'cache-control', 'content-type', 'x-middleware-next', 'x-middleware-override-headers'];

// Une réponse du middleware réduite à ce qui compte : statut, en-têtes de la réponse, en-têtes transmis à la fonction, corps court
async function reponse(mw, url, methode, headers) {
  const init = { method: methode, headers: { ...headers } };
  if (methode !== 'GET') { init.body = methode === 'PUT' ? '{"doc":{}}' : '{"question":"?"}'; init.headers['content-type'] = 'application/json'; }
  const r = await mw(new Request(url, init));
  const h = r.headers, transmis = {}, autres = {};
  for (const [k, v] of h) {
    if (k.startsWith('x-middleware-request-')) transmis[k.slice('x-middleware-request-'.length)] = v;
    else if (!NOMMES.includes(k)) autres[k] = v;
  }
  const texte = r.body ? await r.text() : '';
  let corps = null;
  if (texte && Buffer.byteLength(texte) <= 300) { try { corps = /json/.test(h.get('content-type') || '') ? JSON.parse(texte) : texte; } catch { corps = texte; } }
  let membre = null;
  if (transmis['x-rt-membre'] != null) { try { membre = decodeURIComponent(transmis['x-rt-membre']); } catch { membre = transmis['x-rt-membre']; } }
  return {
    status: r.status, location: h.get('location'), setCookie: h.get('set-cookie'), cacheControl: h.get('cache-control'), contentType: h.get('content-type'),
    next: h.get('x-middleware-next'), overrides: (h.get('x-middleware-override-headers') || '').split(',').filter(Boolean).sort(),
    membre, cookieTransmis: 'cookie' in transmis, espace: transmis['x-rt-espace'] ?? null, autres, corps,
  };
}

async function casMiddleware(m) {
  const mw = m.middleware.default, out = {}, cs = await simule();
  await avecEnv('VERCEL_ENV', null, () => cs.avecCodeSimule(async () => {
    for (const hote of HOTES) for (const [etat, e] of Object.entries(etats(cs))) for (const [methode, chemin] of REQUETES) for (const [variante, v] of Object.entries(VARIANTES)) {
      const url = hote + chemin + (e.acces ? `${chemin.includes('?') ? '&' : '?'}acces=${encodeURIComponent(e.acces)}` : '');
      out[`${hote} | ${etat} | ${methode} ${chemin} | ${variante}`] = await reponse(mw, url, methode, { ...v, ...(e.cookie ? { cookie: e.cookie } : {}) });
    }
  }, m.racine + 'middleware.js'));
  return out;
}

// Fichiers servis sans code sur l’hôte de Naos : non interceptés par le `config.matcher` (émulé comme Vercel, tests/access.test.mjs), ou
// interceptés mais transmis, réécrits ou répondus en 200 par le middleware pour un visiteur sans code.
async function casPublics(m) {
  const matcher = new RegExp('^' + m.middleware.config.matcher[0] + '[/#?]?$', 'i'), mw = m.middleware.default, out = [];
  await avecEnv('VERCEL_ENV', null, async () => {
    for (const p of [...new Set(m.fichiers)].sort()) {
      if (!matcher.test(p)) { out.push(p); continue; }
      const r = await mw(new Request(HOTE_NAOS + p));
      if (r.status === 200 || r.headers.get('x-middleware-next') === '1' || r.headers.get('x-middleware-rewrite')) out.push(p);
    }
  });
  return out;
}

// ───────────────────────── archive et compteur d’IA sur faux Blob

const T = Date.parse('2026-12-05T09:00:00Z');                       // samedi 05/12/2026 10 h à Paris
const ENTETES = (nom = 'Romain') => ({ 'x-rt-membre': encodeURIComponent(nom), 'x-rt-espace': 'naos' });
const ENVS = [['sans-env', null], ['production', 'production']];

// Étiquettes du faux Blob ("e3", W/"e3") remplacées par un ordinal dans l’ordre d’apparition ; suffixe aléatoire de la corbeille masqué
function normalise(x, revs = new Map()) {
  if (typeof x === 'string') {
    const e = /^(W\/)?"e(\d+)"$/.exec(x);
    if (e) { if (!revs.has(e[2])) revs.set(e[2], revs.size + 1); return `${e[1] || ''}<rev ${revs.get(e[2])}>`; }
    return x.includes('/trash/') ? x.replace(/-r\d{6}(\.json)?$/, '-r<suffixe>$1') : x;
  }
  if (Array.isArray(x)) return x.map((v) => normalise(v, revs));
  if (isObj(x)) return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, normalise(v, revs)]));
  return x;
}
const magasin = (blob) => [...blob.store.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([path, e]) => {
  let doc; try { doc = JSON.parse(e.text); } catch { doc = e.text; }
  return { path, contentType: e.contentType, doc: canon(doc) };
});
const journal = (blob) => blob.ops.log.map((o) => ({ op: o.op, path: o.path, opts: canon(o.opts) }));
const etape = (nom, r) => ({ nom, status: r.status, cacheControl: r.headers['cache-control'] ?? null, contentType: r.headers['content-type'] ?? null, nosniff: r.headers['x-content-type-options'] ?? null, body: canon(r.body ?? null) });

const regate = (over) => ({ name: 'Régate', club: 'CVAT', dateStart: '2026-12-05', dateEnd: '2026-12-06', season: 2026, ic: null, races: [], marks: [], courses: [], traces: [], frozen: {}, tomb: {}, hist: [], at: 1000, u: 1000, ...over });
const REG_TOULON = regate({
  id: 'rg-toulon', name: 'Coupe de Noël', races: [{ id: 'm202612051055', date: '2026-12-05', time: '10:55', courseId: 3, cls: 'J80', laps: 2, note: '', u: 1500 }],
  marks: [{ id: 'X1', name: 'X1', lat: 43.085, lon: 5.952, src: 'ic', u: 1500 }],
  courses: [{ id: 101, name: 'Parcours 1', seq: ['X1', '7'], u: 1500 }],
});
const REG_BREST = regate({ id: 'rg-brest', name: 'Entraînement en rade de Brest', club: 'SRB', venue: 'brest', vu: 1200 });
const DOC1 = { v: 1, regattas: { 'rg-toulon': REG_TOULON, 'rg-brest': REG_BREST }, tomb: {}, marks: { 7: { lat: 43.0712, lon: 5.9341, src: 'trace', t: 1600 } } };
const TRACE = { id: 'tr1', name: 'Manche 1', pts: [[T - 600e3, 43.08, 5.95, 5.2, 210, 4], [T - 590e3, 43.0798, 5.9497, 5.4, 212, 4], [T - 580e3, 43.0796, 5.9494, 5.5, 214, 5]], report: { t: 1, html: 'x' } };
const RAPPORT = { html: '<h1>Débrief</h1><p>Bon départ.</p>', t: T - 300e3, name: 'Débrief manche 1' };
const JOUR = { wx: { dir: 265, spd: 14 }, strat: { cote: 'gauche' }, obs: { n: 2 } };

async function casArchive(m) {
  const out = {};
  for (const [nomEnv, env] of ENVS) {
    out[nomEnv] = await avecEnv('VERCEL_ENV', env, async () => {
      const blob = createFakeBlob(), handler = m.archive.createHandler({ blob, now: () => T });
      const appel = (method, url, body, headers = ENTETES()) => invoke(handler, { method, url, body, headers });
      const etapes = [];
      const note = async (nom, p) => { const r = await p; etapes.push(etape(nom, r)); return r; };
      await note('PUT léger : deux régates (Toulon avec bouées, Brest)', appel('PUT', '/api/archive?k=light', { doc: DOC1 }));
      const lu = await note('GET léger', appel('GET', '/api/archive?k=light'));
      await note('GET léger avec rev à jour', appel('GET', `/api/archive?k=light&rev=${encodeURIComponent(lu.body?.rev ?? '')}`));
      await note('GET léger avec rev périmé', appel('GET', `/api/archive?k=light&rev=${encodeURIComponent('"autre"')}`));
      await note('PUT trace', appel('PUT', '/api/archive?k=trace&id=tr1', TRACE));
      await note('PUT trace déjà en ligne', appel('PUT', '/api/archive?k=trace&id=tr1', TRACE));
      await note('GET trace', appel('GET', '/api/archive?k=trace&id=tr1'));
      await note('PUT rapport', appel('PUT', `/api/archive?k=report&id=tr1&t=${RAPPORT.t}`, RAPPORT));
      await note('GET rapport', appel('GET', `/api/archive?k=report&id=tr1&t=${RAPPORT.t}`));
      await note('PUT vent du jour (by du client ignoré)', appel('PUT', '/api/archive?k=day&r=rg-toulon&d=2026-12-05&by=teiva', JOUR));
      await note('GET vent du jour de Romain', appel('GET', '/api/archive?k=day&r=rg-toulon&d=2026-12-05&by=romain'));
      await note('GET vent du jour de Teiva (absent)', appel('GET', '/api/archive?k=day&r=rg-toulon&d=2026-12-05&by=teiva'));
      await note('PUT léger : régate de Brest retirée (corbeille)', appel('PUT', '/api/archive?k=light', { doc: { v: 1, regattas: {}, tomb: { 'regatta:rg-brest': { t: 1800 } }, marks: {} } }));
      await note('GET léger après retrait', appel('GET', '/api/archive?k=light'));
      for (const [nom, url] of [
        ['trace ..', '/api/archive?k=trace&id=..'], ['trace a/b', '/api/archive?k=trace&id=a%2Fb'], ['trace ../prod/light', '/api/archive?k=trace&id=..%2Fprod%2Flight'],
        ['rapport t hostile', '/api/archive?k=report&id=tr1&t=..%2F1'], ['jour by hostile', '/api/archive?k=day&r=rg-toulon&d=2026-12-05&by=..%2Fromain'],
        ['jour date hostile', '/api/archive?k=day&r=rg-toulon&d=..%2F2026&by=romain'], ['k inconnu', '/api/archive?k=quota'],
      ]) await note(`GET hostile : ${nom}`, appel('GET', url));
      await note('DELETE léger', appel('DELETE', '/api/archive?k=light'));
      await note('GET léger sans x-rt-membre', appel('GET', '/api/archive?k=light', undefined, { 'x-rt-espace': 'naos' }));
      await note('GET léger sans aucun en-tête', appel('GET', '/api/archive?k=light', undefined, {}));
      await note('PUT léger, prénom hostile', appel('PUT', '/api/archive?k=light', { doc: DOC1 }, { 'x-rt-membre': encodeURIComponent('Rom/ain'), 'x-rt-espace': 'naos' }));
      const revs = new Map();
      return normalise({ etapes, journal: journal(blob), magasin: magasin(blob) }, revs);
    });
  }
  return out;
}

async function casQuota(m) {
  const out = {};
  const jamais = { responses: { create: async () => { throw new Error('le compteur ne doit jamais appeler l’IA'); } } };
  for (const [nomEnv, env] of ENVS) {
    out[nomEnv] = await avecEnv('VERCEL_ENV', env, async () => {
      const blob = createFakeBlob(), ia = m.ia.createIA({ openai: jamais, blob, now: () => T });
      const handler = async (req, res) => { if (await ia.garde(req, res)) res.status(200).json({ ok: true }); };
      const statuts = [], corps = [];
      for (const nom of [...Array(31).fill('Romain'), 'Teiva']) {
        const r = await invoke(handler, { method: 'POST', url: '/api/rules', body: {}, headers: ENTETES(nom) });
        statuts.push(r.status); corps.push(r.body);
      }
      const sans = await invoke(handler, { method: 'POST', url: '/api/rules', body: {}, headers: { 'x-rt-espace': 'naos' } });
      return normalise({ statuts, dernierRomain: canon(corps[30]), teiva: canon(corps[31]), sansMembre: { status: sans.status, body: canon(sans.body) }, journal: journal(blob), magasin: magasin(blob) });
    });
  }
  return out;
}

// ───────────────────────── consignes d’IA, liste hors réseau, pack de Brest

const sha = (x) => createHash('sha256').update(x).digest('hex');
const SORTIES = {
  rules: { verdict: 'B doit s’écarter', explication: 'B est au vent.', regles: [], ic: '', attention: '' },
  debrief: { resume: { bien: 'b', coute: 'c', meteo: 'm' }, bords: [], retenir: [] },
  voice: { understood: true, direction: { mode: 'unchanged', value: null }, speed: { mode: 'unchanged', value: null }, gust: null, confidence: 'high', summary: 's', question: null },
  ic: {},
};
const CORPS = {
  rules: { question: 'Bâbord / tribord ?' }, debrief: { bords: [{ n: 1 }] }, voice: { alts: ['vent au 300, 14 nœuds'] },
  ic: { text: 'INSTRUCTIONS DE COURSE — Coupe de Noël du CVAT, samedi 5 décembre 2026. Premier signal d’avertissement à 10 h 55. VHF 72. '.repeat(4) },
};

// SHA-256 des consignes (`instructions`) reçues par un faux client OpenAI propre à chaque appel : aucun réseau, aucune clé réelle ; la fausse
// clé et l’environnement sont rendus dans un try/finally (avecEnv)
async function casIA(m) {
  const consigne = async (f, corps) => {
    const appels = [];
    const client = { responses: { create: async (args) => { appels.push(args); return { status: 'completed', output_text: JSON.stringify(SORTIES[f]) }; } } };
    const h = m[f].createHandler({ openai: client, blob: createFakeBlob(), now: () => T });
    await invoke(h, { method: 'POST', url: '/api/' + f, body: corps, headers: ENTETES() });
    if (appels.length !== 1) throw new Error(`${f} : ${appels.length} appel(s) au faux client au lieu d’un`);
    return sha(appels[0].instructions);
  };
  return avecEnv('OPENAI_API_KEY', 'cle-de-test', () => avecEnv('OPENAI_MODEL', null, () => avecEnv('VERCEL_ENV', null, async () => {
    const out = {};
    for (const f of ['rules', 'debrief', 'voice']) out[f] = { toulon: await consigne(f, CORPS[f]), brest: await consigne(f, { ...CORPS[f], venue: 'brest' }) };
    out.ic = await consigne('ic', CORPS.ic);
    return out;
  })));
}

// Liste SHELL du bloc généré de <racine>/sw.js, lue dans le texte (le worker n’est jamais exécuté)
export function shellDe(racine) {
  const sw = readFileSync(racine.replace(/\/?$/, '/') + 'sw.js', 'utf8');
  const a = sw.indexOf('/* stamp:begin'), z = sw.indexOf('/* stamp:end */');
  if (a < 0 || z < a) throw new Error('sw.js : bloc généré introuvable');
  const l = /const SHELL = (\[[^\n]*\]);/.exec(sw.slice(a, z));
  if (!l) throw new Error('sw.js : SHELL introuvable dans le bloc généré');
  return JSON.parse(l[1]);
}

// Taille et SHA-256 de chaque data/brest.*, entrée « brest » du manifeste des plans d’eau
function casBrest(m) {
  const data = m.racine + 'data/', fichiers = {};
  for (const f of readdirSync(data).filter((n) => n.startsWith('brest.')).sort()) {
    const buf = readFileSync(data + f);
    fichiers['data/' + f] = { bytes: buf.length, sha256: sha(buf) };
  }
  return { fichiers, venues: JSON.parse(readFileSync(data + 'venues.json', 'utf8')).venues?.brest ?? null };
}

// ───────────────────────── sections

// Toutes les sections du gel ; m = { racine, middleware, archive, ia, fichiers }
export async function naosCases(m) {
  return {
    middleware: await casMiddleware(m),
    publics: await casPublics(m),
    archive: await casArchive(m),
    quota: await casQuota(m),
    ia: await casIA(m),
    shell: shellDe(m.racine),
    brest: casBrest(m),
  };
}

// Les SEULES différences admises pour Naos en v44 (08-01, frontmatter) appliquées à la capture : ce qui reste est comparé à l’identique.
//   - GET /api/membre : champs `espace` (= « naos ») et `espaces` (liste de chaînes qui contient « naos ») ;
//   - requêtes /api/ transmises : en-tête `x-rt-espace: naos` posé par le middleware (et donc dans la liste des en-têtes remplacés) ;
//   - liste hors réseau : fichiers nouveaux limités à AJOUTS_SHELL (taille contrôlée par le test).
// Une différence admise n’est jamais exigée : le code de la v43 reste conforme à sa propre capture.
export function differencesAdmises(section, capture, courant) {
  const c = copie(capture);
  if (section === 'middleware') {
    for (const [cle, r] of Object.entries(c)) {
      const k = courant?.[cle];
      if (!k) continue;
      const chemin = cle.split(' | ')[2].split(' ')[1];
      if (r.next === '1' && chemin.startsWith('/api/') && k.espace === 'naos') {
        r.espace = 'naos';
        if (!r.overrides.includes('x-rt-espace')) r.overrides = [...r.overrides, 'x-rt-espace'].sort();
      }
      if (chemin === '/api/membre' && r.status === 200 && isObj(r.corps) && typeof r.corps.membre === 'string' && isObj(k.corps)) {
        if (k.corps.espace === 'naos') r.corps.espace = 'naos';
        const e = k.corps.espaces;
        if (Array.isArray(e) && e.length && e.every((x) => typeof x === 'string') && e.includes('naos')) r.corps.espaces = e;
      }
    }
  }
  if (section === 'shell' && Array.isArray(courant)) {
    // les fichiers de la v43 dans l’ordre du code courant, plus ceux de AJOUTS_SHELL qu’il contient ; un retrait ou un autre ajout reste visible
    const v43 = new Set(c);
    return [...courant.filter((f) => v43.has(f) || AJOUTS_SHELL.includes(f)), ...c.filter((f) => !courant.includes(f))];
  }
  return c;
}

// ───────────────────────── capture

async function capture(racine, sortie) {
  process.env.TZ = 'Europe/Paris';
  const m = await modulesNaos(racine);
  // fichiers du dépôt à la v43 : la liste de l’arbre de 5e9b8a5 (l’extraction peut n’en contenir qu’une partie)
  const fichiers = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', FROM], { cwd: DEPOT, maxBuffer: 64 * 1024 * 1024 }).toString('utf8').split('\0').filter(Boolean).map((f) => '/' + f);
  const cas = await naosCases({ ...m, fichiers });
  writeFileSync(sortie, JSON.stringify({ v: 43, from: FROM, ...cas }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [opt, racine, sortie] = process.argv.slice(2);
  if (opt !== '--capture' || !racine || !sortie) { console.error('usage : node tests/helpers/naos.mjs --capture <racine> <sortie>'); process.exit(2); }
  await capture(racine, sortie);
}
