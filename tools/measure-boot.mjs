// Mesure de l’ouverture de l’app hors réseau à CPU ralenti (FIAB-06). Outil facultatif, hors npm test.
//
//   PW_REQUIRED=1 node tools/measure-boot.mjs [cpu = 4] [ouvertures = 5] [--venue brest | --espace tofinou]
//
// --espace tofinou (08-10) : l’app ouverte sur l’hôte d’essai de l’espace Tofinou (tofinou.localhost, résolu vers le serveur local comme dans
// tools/regate-e2e.mjs) ; la première visite attend aussi le pack de Bormes, téléchargé seul par l’espace, complet dans son cache ; les
// ouvertures hors réseau sont alors celles de la rade de Bormes (bandeau et carte servie par le cache du pack, exigés).
// --venue brest : à la première visite, passage à la rade de Brest par la carte « Plan d’eau » (téléchargement vérifié du pack, rechargement)
// avant l’arrêt du serveur ; les ouvertures hors réseau sont alors celles de Brest (carte servie par le cache du pack, exigée). Sans option,
// mesure de Toulon inchangée.
//
// Déroulé : petit serveur HTTP du dépôt sur 127.0.0.1 ; Chromium en émulation mobile 390 × 844 ; première visite en ligne jusqu’à ce que
// le service worker contrôle la page et que toute la liste hors réseau soit en cache ; serveur ARRÊTÉ pour de bon (connexion refusée,
// vérifiée) ; puis `ouvertures` ouvertures dans le même contexte, avec Emulation.setCPUThrottlingRate à `cpu`.
// Pour chaque ouverture :
//   - interface utile : instant de la marque performance.mark('rt:ui') (à défaut, retrait du splash : classe « gone » sur #splash) ;
//   - à titre indicatif : délai entre cet instant et l’ouverture du mode départ (onglet Départ puis « Mode départ »), instant de la
//     carte prête (marque rt:map, si elle existe) et plus longue tâche longue après l’interface utile (BOOT_WAIT_MS ms observées, 15000 par défaut).
//     Ces trois colonnes sont indicatives : seul l’instant de l’interface utile fait critère. Les appels de dessin et de téléversement WebGL sont neutralisés (voir INIT).
// Sortie : 0 = médiane de l’interface utile < 2000 ms ; 1 = médiane ≥ 2000 ms, ou violation de la politique de contenu, ou chemin refusé par la liste
// blanche (le serveur applique les en-têtes de vercel.json et le middleware, voir tools/serveur-local.mjs) ; 2 = mesure impossible avec PW_REQUIRED=1.
// Le serveur n’écoute que sur 127.0.0.1, le temps de la première visite ; les requêtes vers d’autres hôtes échouent tout de suite
// (aucun réseau pendant les ouvertures).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { launchChromium } from './pw.mjs';
import { demarreServeur } from './serveur-local.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ARGS = process.argv.slice(2);
const iv = ARGS.indexOf('--venue'), ie = ARGS.indexOf('--espace');
const ESPACE_ID = ie >= 0 ? ARGS[ie + 1] : 'naos';
const VENUE = iv >= 0 ? ARGS[iv + 1] : ESPACE_ID === 'tofinou' ? 'bormes' : 'toulon';
if ((iv >= 0 && VENUE !== 'brest') || (ie >= 0 && ESPACE_ID !== 'tofinou') || (iv >= 0 && ie >= 0)) {
  console.error('usage : node tools/measure-boot.mjs [cpu] [ouvertures] [--venue brest | --espace tofinou]'); process.exit(2);
}
const HOTE_TOFINOU = 'tofinou.localhost';                 // hôte d’essai de l’espace Tofinou (js/espaces.js, tools/regate-e2e.mjs)
const OPTS = [iv, ie].filter((i) => i >= 0).flatMap((i) => [i, i + 1]);
const POS = ARGS.filter((_, i) => !OPTS.includes(i));
const CPU = Number(POS[0]) || 4;
const OUVERTURES = Number(POS[1]) || 5;
const ATTENTE_MS = Number(process.env.BOOT_WAIT_MS) || 15000;
const SEUIL_MS = 2000;
const LIEU = VENUE === 'brest' ? ' à Brest' : VENUE === 'bormes' ? ' dans l’espace Tofinou à Bormes' : '';
const REQUIS = process.env.PW_REQUIRED === '1';

// Serveur commun aux outils (tools/serveur-local.mjs) : en-têtes de sécurité de vercel.json et liste blanche du middleware appliqués comme en production.
// Les ouvertures hors réseau passent par le service worker, dont les réponses en cache gardent leurs en-têtes : la politique de contenu y est donc exercée.
const { serveur, base: base0, refuses } = await demarreServeur({ root: ROOT });
const url = (() => { const u = new URL(base0); if (ESPACE_ID === 'tofinou') u.hostname = HOTE_TOFINOU; return u.href; })();
const port = serveur.address().port;
// violations relevées par toutes les pages (première visite comprise) : politique de contenu, ou Permissions-Policy mal formée
const VIOLATION = /Content.Security.Policy|^CSP :|Unrecognized feature|Error with Permissions-Policy/i;
const violations = [];
const guette = (page) => page.on('console', (m) => { if (VIOLATION.test(m.text())) violations.push(m.text().slice(0, 300)); });

// Posé avant tout script de la page : tâches longues et retrait du splash, avec l’horloge de la page (origine = début de la navigation)
const INIT = (sansDessin) => {
  window.__boot = { ui: null, longs: [] };
  document.addEventListener('securitypolicyviolation', (e) => console.error('CSP : ' + e.violatedDirective + ' ' + e.blockedURI));
  // Chromium sans tête dessine en logiciel (SwiftShader) : une image de la carte coûte 400 ms et le téléversement du fond de carte
  // (texImage2D) 2,7 s sur le fil principal, ce qui fausse toutes les mesures qui suivent l’interface utile (un iPhone a un GPU).
  // Les appels de dessin et de téléversement WebGL sont donc neutralisés ; tout le travail JavaScript de la 3D (import, terrain, maillage)
  // et du vent reste mesuré. BOOT_GPU=1 garde le rendu réel.
  if (sansDessin) for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (C) for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'generateMipmap']) if (C.prototype[f]) C.prototype[f] = function () {};
  }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__boot.longs.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* tâches longues non observables */ }
  new MutationObserver((_m, obs) => {
    const s = document.getElementById('splash');
    if (s && s.classList.contains('gone')) { window.__boot.ui = performance.now(); obs.disconnect(); }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
};

const mediane = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const fmt = (v) => (v == null ? '—' : String(Math.round(v)).padStart(6));

async function premiereVisite(ctx) {
  const shell = JSON.parse(/const SHELL = (\[.*?\]);/s.exec(await readFile(join(ROOT, 'sw.js'), 'utf8'))[1]);
  const page = await ctx.newPage();
  guette(page);
  page.on('pageerror', (e) => console.error('erreur page (1re visite) :', e.message));
  await page.goto(url, { waitUntil: 'load' });
  // la liste hors réseau doit être entièrement en cache ET le worker doit contrôler la page (sondé depuis Node : un prédicat asynchrone
  // passé à waitForFunction ne serait pas attendu)
  const prete = () => page.evaluate(async (n) => {
    if (!navigator.serviceWorker.controller) return false;
    for (const k of (await caches.keys()).filter((x) => x.startsWith('rade-'))) if ((await (await caches.open(k)).keys()).length >= n) return true;
    return false;
  }, shell.length);
  const limite = Date.now() + 90000;
  while (!(await prete())) {
    if (Date.now() > limite) throw new Error('le service worker n’a pas mis toute l’app en cache en 90 s');
    await new Promise((ok) => setTimeout(ok, 300));
  }
  await page.close();
  return shell.length;
}

// --venue brest : passage à Brest en ligne (onglet Régates, « Passer à la rade de Brest » : téléchargement vérifié puis rechargement),
// jusqu’à ce que le pack soit complet dans son cache et l’app rouverte à Brest. Gestes par le DOM (l’accueil peut couvrir l’écran).
async function passeABrest(ctx) {
  const man = JSON.parse(await readFile(join(ROOT, 'data/venues.json'), 'utf8')).venues.brest;
  const nom = 'rade-venue-brest-' + man.pack;
  const page = await ctx.newPage();
  guette(page);
  page.on('pageerror', (e) => console.error('erreur page (passage à Brest) :', e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => performance.getEntriesByName('rt:ui').length > 0, null, { timeout: 60000 });
  await page.evaluate(() => document.querySelector('#tabs button[data-tab=ic]').click());
  await page.waitForSelector('#pkCard[data-state="absent"]', { timeout: 30000 });
  const charge = page.waitForEvent('load', { timeout: 120000 });
  await page.evaluate(() => document.querySelector('#pkGo').click());
  await charge;
  await page.waitForFunction(() => performance.getEntriesByName('rt:map').length > 0, null, { timeout: 120000 });
  const etat = await page.evaluate(async (n) => ({
    venue: JSON.parse(localStorage.getItem('rade.state') || '{}').venue,
    fichiers: (await caches.keys()).includes(n) ? (await (await caches.open(n)).keys()).length : 0,
    bandeau: document.querySelector('#regBar .regname')?.textContent,
  }), nom);
  if (etat.venue !== 'brest' || etat.fichiers !== man.files.length) throw new Error(`passage à Brest incomplet : ${JSON.stringify(etat)}`);
  await page.close();
  return { fichiers: etat.fichiers, octets: man.bytes, bandeau: etat.bandeau };
}

// --espace tofinou : à la première visite, l’espace télécharge seul le pack de Bormes ; on attend qu’il soit complet dans son cache
// et que l’app soit ouverte sur la rade de Bormes (bandeau), avant l’arrêt du serveur.
async function packBormes(ctx) {
  const man = JSON.parse(await readFile(join(ROOT, 'data/venues.json'), 'utf8')).venues.bormes;
  const nom = 'rade-venue-bormes-' + man.pack;
  const page = await ctx.newPage();
  guette(page);
  page.on('pageerror', (e) => console.error('erreur page (pack de Bormes) :', e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => performance.getEntriesByName('rt:ui').length > 0, null, { timeout: 60000 });
  const limite = Date.now() + 120000;
  let etat;
  for (;;) {
    etat = await page.evaluate(async (n) => ({
      fichiers: (await caches.keys()).includes(n) ? (await (await caches.open(n)).keys()).length : 0,
      bandeau: document.querySelector('#regBar .regname')?.textContent,
    }), nom);
    if (etat.fichiers === man.files.length) break;
    if (Date.now() > limite) throw new Error(`pack de Bormes incomplet après 120 s : ${JSON.stringify(etat)}`);
    await new Promise((ok) => setTimeout(ok, 300));
  }
  await page.waitForFunction(() => performance.getEntriesByName('rt:map').length > 0, null, { timeout: 120000 });
  etat.bandeau = await page.evaluate(() => document.querySelector('#regBar .regname')?.textContent);
  if (etat.bandeau !== BANDEAU_BORMES) throw new Error(`l’espace Tofinou n’est pas ouvert à Bormes : ${JSON.stringify(etat)}`);
  await page.close();
  return { fichiers: etat.fichiers, octets: man.bytes, bandeau: etat.bandeau };
}
const BANDEAU_BORMES = 'Entraînement libre · Bormes – Le Lavandou';

async function arreteServeur() {
  serveur.closeAllConnections?.();
  await new Promise((ok) => serveur.close(ok));
  try { await fetch(url, { signal: AbortSignal.timeout(3000) }); throw new Error('le serveur répond encore : mesure hors réseau impossible'); }
  catch (e) { if (/répond encore/.test(e.message)) throw e; /* connexion refusée : attendu */ }
}

async function ouverture(ctx, n) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const erreurs = [];
  guette(page);
  page.on('pageerror', (e) => erreurs.push(e.message));
  try {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.goto(url, { waitUntil: 'commit' });
    const controle = () => page.evaluate(() => !!navigator.serviceWorker.controller);
    await page.waitForFunction(() => performance.getEntriesByName('rt:ui').length > 0 || window.__boot?.ui != null, null, { timeout: 60000, polling: 50 });
    const ui = await page.evaluate(() => performance.getEntriesByName('rt:ui')[0]?.startTime ?? window.__boot.ui);
    const depart = await page.evaluate(() => new Promise((ok) => {
      // le bouton « Mode départ » est rendu avec l’onglet : si l’app ne l’a pas encore dessiné, on retouche jusqu’à ce qu’il existe
      document.querySelector('#tabs button[data-tab=start]')?.click();
      const t0 = performance.now();
      const guette = () => {
        const r = document.getElementById('startMode');
        if (r && !r.hidden) return ok(performance.now());
        if (performance.now() - t0 > 60000) return ok(null);
        document.querySelector('#tabs button[data-tab=start]')?.click();
        document.getElementById('smOpen')?.click();
        setTimeout(guette, 20);
      };
      guette();
    }));
    await page.waitForFunction((t) => performance.now() >= t, ui + ATTENTE_MS, { timeout: ATTENTE_MS + 60000, polling: 250 });
    const { carte, longs, ctrl } = await page.evaluate(() => ({
      carte: performance.getEntriesByName('rt:map')[0]?.startTime ?? null,
      longs: window.__boot.longs, ctrl: !!navigator.serviceWorker.controller,
    }));
    const apres = longs.filter(([t]) => t >= ui);
    const plusLongue = apres.length ? Math.max(...apres.map(([, d]) => d)) : 0;
    if (!ctrl && !(await controle())) throw new Error('la page n’est pas servie par le service worker : mesure hors réseau invalide');
    if (VENUE === 'brest') {
      const bandeau = await page.evaluate(() => document.querySelector('#regBar .regname')?.textContent);
      if (bandeau !== 'Entraînement libre · Brest') throw new Error(`ouverture ${n} : l’app n’est pas à Brest (${bandeau})`);
      if (carte == null) throw new Error(`ouverture ${n} : carte de Brest jamais prête hors réseau (pack non servi par le cache)`);
    }
    if (VENUE === 'bormes') {
      const bandeau = await page.evaluate(() => document.querySelector('#regBar .regname')?.textContent);
      if (bandeau !== BANDEAU_BORMES) throw new Error(`ouverture ${n} : l’espace Tofinou n’est pas à Bormes (${bandeau})`);
      if (carte == null) throw new Error(`ouverture ${n} : carte de Bormes jamais prête hors réseau (pack non servi par le cache)`);
    }
    return { n, ui, depart: depart == null ? null : depart - ui, carte, plusLongue, erreurs };
  } finally { await page.close().catch(() => {}); }
}

let browser, code = 0;
try {
  ({ browser } = await launchChromium({ args: [`--host-resolver-rules=MAP ${HOTE_TOFINOU} 127.0.0.1, MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`, '--no-proxy-server'] }));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT, process.env.BOOT_GPU !== '1');
  const n = await premiereVisite(ctx);
  console.log(`Première visite en ligne : service worker actif, ${n} fichiers en cache.`);
  if (VENUE === 'brest') { const b = await passeABrest(ctx); console.log(`Passage à Brest en ligne : pack de ${b.fichiers} fichiers (${b.octets} octets) dans son cache, bandeau « ${b.bandeau} ».`); }
  if (VENUE === 'bormes') { const b = await packBormes(ctx); console.log(`Espace Tofinou (${HOTE_TOFINOU}) : pack de Bormes de ${b.fichiers} fichiers (${b.octets} octets) dans son cache, bandeau « ${b.bandeau} ».`); }
  await arreteServeur();
  console.log(`Serveur arrêté (connexion refusée sur 127.0.0.1:${port}) : ouvertures hors réseau${LIEU}, CPU ×${CPU}, ${OUVERTURES} ouvertures.\n`);
  const mesures = [];
  for (let i = 1; i <= OUVERTURES; i++) mesures.push(await ouverture(ctx, i));
  console.log('ouverture | interface utile (ms) | mode départ ouvert après (ms) | carte prête (ms) | plus longue tâche après l’interface (ms)');
  for (const m of mesures) console.log(`${String(m.n).padStart(9)} | ${fmt(m.ui).padStart(20)} | ${fmt(m.depart).padStart(29)} | ${fmt(m.carte).padStart(16)} | ${fmt(m.plusLongue).padStart(40)}`);
  const col = (k) => mesures.map((m) => m[k]).filter((v) => v != null);
  const med = (k) => mediane(col(k)), max = (k) => (col(k).length ? Math.max(...col(k)) : null);
  console.log(`  médiane | ${fmt(med('ui')).padStart(20)} | ${fmt(med('depart')).padStart(29)} | ${fmt(med('carte')).padStart(16)} | ${fmt(med('plusLongue')).padStart(40)}`);
  console.log(`  maximum | ${fmt(max('ui')).padStart(20)} | ${fmt(max('depart')).padStart(29)} | ${fmt(max('carte')).padStart(16)} | ${fmt(max('plusLongue')).padStart(40)}`);
  const erreurs = [...new Set(mesures.flatMap((m) => m.erreurs))];
  if (erreurs.length) console.log(`Erreurs de page relevées : ${erreurs.join(' ; ')}`);
  const m = med('ui');
  const refusees = refuses.filter((x) => x !== '/favicon.ico');                // /favicon.ico : demande automatique du navigateur, hors de l’app
  if (violations.length || refusees.length) {
    if (violations.length) console.log(`Violations de la politique de contenu : ${[...new Set(violations)].join(' ; ')}`);
    if (refusees.length) console.log(`Chemins refusés par la liste blanche : ${[...new Set(refusees)].join(' ; ')}`);
    console.log('RÉSULTAT : ÉCHEC — violation de la politique de contenu ou chemin refusé par la liste blanche');
    code = 1;
  }
  else if (m == null) { console.error('Aucune interface utile relevée'); code = REQUIS ? 2 : 1; }
  else if (m >= SEUIL_MS) { console.log(`RÉSULTAT : ÉCHEC — médiane de l’interface utile ${Math.round(m)} ms ≥ ${SEUIL_MS} ms`); code = 1; }
  else console.log(`RÉSULTAT : OK — médiane de l’interface utile ${Math.round(m)} ms < ${SEUIL_MS} ms (hors réseau${LIEU}, CPU ×${CPU})`);
} catch (e) {
  console.error('Mesure en échec :', e.message);
  code = REQUIS ? 2 : 1;
} finally {
  await browser?.close().catch(() => {});
  try { serveur.closeAllConnections?.(); serveur.close(); } catch { /* déjà arrêté */ }
}
process.exit(code);
