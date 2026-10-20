// Mesure de l’ouverture de l’app hors réseau à CPU ralenti (FIAB-06). Outil facultatif, hors npm test.
//
//   PW_REQUIRED=1 node tools/measure-boot.mjs [cpu = 4] [ouvertures = 5]
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
const CPU = Number(process.argv[2]) || 4;
const OUVERTURES = Number(process.argv[3]) || 5;
const ATTENTE_MS = Number(process.env.BOOT_WAIT_MS) || 15000;
const SEUIL_MS = 2000;
const REQUIS = process.env.PW_REQUIRED === '1';

// Serveur commun aux outils (tools/serveur-local.mjs) : en-têtes de sécurité de vercel.json et liste blanche du middleware appliqués comme en production.
// Les ouvertures hors réseau passent par le service worker, dont les réponses en cache gardent leurs en-têtes : la politique de contenu y est donc exercée.
const { serveur, base: url, refuses } = await demarreServeur({ root: ROOT });
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
    return { n, ui, depart: depart == null ? null : depart - ui, carte, plusLongue, erreurs };
  } finally { await page.close().catch(() => {}); }
}

let browser, code = 0;
try {
  ({ browser } = await launchChromium({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--no-proxy-server'] }));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT, process.env.BOOT_GPU !== '1');
  const n = await premiereVisite(ctx);
  console.log(`Première visite en ligne : service worker actif, ${n} fichiers en cache.`);
  await arreteServeur();
  console.log(`Serveur arrêté (connexion refusée sur 127.0.0.1:${port}) : ouvertures hors réseau, CPU ×${CPU}, ${OUVERTURES} ouvertures.\n`);
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
  else console.log(`RÉSULTAT : OK — médiane de l’interface utile ${Math.round(m)} ms < ${SEUIL_MS} ms (hors réseau, CPU ×${CPU})`);
} catch (e) {
  console.error('Mesure en échec :', e.message);
  code = REQUIS ? 2 : 1;
} finally {
  await browser?.close().catch(() => {});
  try { serveur.closeAllConnections?.(); serveur.close(); } catch { /* déjà arrêté */ }
}
process.exit(code);
