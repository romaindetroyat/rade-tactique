// Scénarios de bout en bout des régates dans Chromium. Outil facultatif, hors npm test et hors package.json.
//
//   node tools/regate-e2e.mjs [scénario…]      (tous les scénarios si aucun nom n’est donné)
//
// Déroulé : petit serveur HTTP du dépôt sur 127.0.0.1 ; Chromium en émulation mobile 390 × 844 (fr-FR, fuseau Europe/Paris), service
// worker bloqué, toute requête vers un autre hôte interrompue, dessin WebGL neutralisé (voir INIT), accueil désactivé. L’heure de la page
// est fixée par l’horloge de Playwright (`context.clock.setFixedTime`, Playwright ≥ 1.45). Toute erreur de page fait échouer le scénario.
// Chaque scénario écrit « OK <nom> » seulement après sa dernière vérification, sinon « ÉCHEC <nom> : raison » (délai de 240 s par scénario).
//
// Codes de sortie, décidés par la fonction pure `verdict` (testée dans tests/regates.test.mjs) : cet outil est la porte des tâches,
// il ne « saute » jamais une mesure.
//   1 : un nom de scénario est inconnu (contrôlé avant tout lancement de Chromium), ou aucun scénario n’a tourné, ou un scénario a échoué
//   2 : Chromium ne peut pas être lancé (toujours exigé : PW_REQUIRED=1 est posé ici, jamais « mesure sautée »)
//   0 : chaque scénario demandé a affiché « OK <nom> »

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { demarreServeur, lireEntetes, entetesPour } from './serveur-local.mjs';

// unknown : noms demandés qui n’existent pas ; requested : noms à lancer ; ok : noms qui ont affiché « OK » ; chromium : faux s’il n’a pas pu démarrer
export function verdict({ unknown = [], requested = [], ok = [], chromium = true } = {}) {
  if (unknown.length) return 1;
  if (!chromium) return 2;
  if (!requested.length) return 1;
  return requested.every((n) => ok.includes(n)) ? 0 : 1;
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DELAI_MS = 240000;
// Serveur local commun (tools/serveur-local.mjs) : les en-têtes de vercel.json et la liste blanche du middleware y sont appliqués comme en production.
// Violations relevées par toutes les pages de tous les contextes : politique de contenu, ou Permissions-Policy mal formée (fonction inconnue de Chromium)
const REGLES_VERCEL = lireEntetes(ROOT);
const CSP_APP = entetesPour('/', REGLES_VERCEL)['content-security-policy'];
const VIOLATION = /Content.Security.Policy|^CSP :|Unrecognized feature|Error with Permissions-Policy/i;
const violations = [];
// Chemins que la liste blanche refuse sans que ce soit un défaut de l’app. /favicon.ico : demande automatique du navigateur. /x : l’image « <img src=x> »
// du rapport PIÉGÉ de ces scénarios (RAPPORT_TEST), affichée dans le cadre sandbox : c’est le contenu hostile qui la demande, pas l’app.
const REFUS_ADMIS = { '*': ['/favicon.ico'], archive: ['/x'], archivehors: ['/x'], equipage: ['/x'] };

// Posé avant tout script de la page : accueil désactivé, dessin et téléversement WebGL neutralisés (le rendu logiciel de Chromium sans tête
// fausse les temps ; tout le travail JavaScript de la 3D reste exécuté), sondes de l’outil
const INIT = () => {
  try { localStorage.setItem('rade.welcome', '1'); } catch { /* stockage refusé : l’accueil s’ouvrira */ }
  // toute violation de la politique de contenu devient un message console « CSP : … », relevé par l’outil et jamais masqué par le BRUIT
  document.addEventListener('securitypolicyviolation', (e) => console.error('CSP : ' + e.violatedDirective + ' ' + e.blockedURI));
  // l’horloge de Playwright remplace performance.mark par une fonction vide : les marques de l’app sont relevées ici (après elle, voir ouvreContexte)
  const marque = performance.mark;
  performance.mark = function (nom) { (window.__marks ||= []).push(String(nom)); return marque.apply(this, arguments); };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (C) for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'generateMipmap']) if (C.prototype[f]) C.prototype[f] = function () {};
  }
};

// ───────────────────────── outils communs

// geo : { latitude, longitude } du GPS simulé (l’autorisation est donnée) ; sans lui, aucune position n’est fournie
async function ouvreContexte(browser, { heure, geo = null }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', ...(geo ? { geolocation: geo, permissions: ['geolocation'] } : {}) });
  await ctx.clock.setFixedTime(new Date(heure));         // d’abord : INIT doit s’exécuter après le script de l’horloge de Playwright
  await ctx.addInitScript(INIT);
  // chaque page du contexte, fenêtres ouvertes par l’app comprises (« Plein écran » du rapport) : violations relevées avant tout filtre
  ctx.on('page', (p) => p.on('console', (m) => { if (VIOLATION.test(m.text())) violations.push(m.text().slice(0, 300)); }));
  // seul l’hôte local est joignable ; une route enregistrée ensuite par un scénario passe avant celle-ci
  await ctx.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.fallback() : route.abort()));
  return ctx;
}
// Page + liste des erreurs vues par la page (hors échecs de chargement voulus : réseau coupé)
function ouvrePage(ctx) {
  const erreurs = [];
  return ctx.newPage().then((page) => {
    // bruits attendus du cadre sandboxé du rapport (aucun script, origine opaque) : l'init de l'outil (horloge, accueil) y est refusée par le navigateur ; ils ne viennent pas de l'app
    const BRUIT = /Failed to load resource|net::ERR|Failed to read the 'serviceWorker'.*sandboxed|Blocked script execution in 'about:srcdoc'/;
    page.on('pageerror', (e) => { if (!BRUIT.test(e.message)) erreurs.push(e.message); });
    page.on('console', (m) => { if (m.type() === 'error' && !BRUIT.test(m.text())) erreurs.push(m.text()); });
    return { page, erreurs };
  });
}
// L’app est prête quand la carte l’est (marque rt:map relevée par INIT) : plus aucun redessin automatique ne viendra défaire une saisie
const pret = (page) => page.waitForFunction(() => window.__marks?.includes('rt:map'), null, { timeout: 90000, polling: 100 });
// Le document de l’app porte la politique de contenu de vercel.json : cela prouve que l’émulation des en-têtes est active
const ouvreApp = async (page, base) => {
  const rep = await page.goto(base, { waitUntil: 'load' });
  assert.equal(rep?.headers()['content-security-policy'], CSP_APP, 'le document de l’app doit porter la politique de contenu de vercel.json');
  await pret(page);
};
const sansErreur = (erreurs, quand) => assert.deepEqual(erreurs, [], `erreur de page ${quand} : ${erreurs.join(' ; ')}`);

// Liste des régates affichée : [{ status: titre du groupe, rows: [{ id, name, text, open }] }] (En préparation, En cours, Terminées)
const lireListe = (page) => page.evaluate(() => [...document.querySelectorAll('section[data-tab=ic] .rggroup')].map((g) => ({
  status: g.querySelector('h4').textContent.trim(),
  rows: [...g.querySelectorAll('.rg[data-rg-row]')].map((el) => ({ id: el.dataset.rgRow, name: el.querySelector('.rgn').textContent, text: el.textContent, open: el.classList.contains('on') })),
})));
// Régate ouverte à l’écran : l’identifiant est lu sur le bandeau du panneau (#regBar[data-open], état de la page), puis la régate dans l’index ; null en entraînement libre
const regateOuverte = (page) => page.evaluate(() => {
  const id = document.querySelector('#regBar')?.dataset.open;
  if (!id) return null;
  return JSON.parse(localStorage.getItem('rade.regates.v1')).list.find((r) => r.id === id) ?? null;
});
const idOuverte = (page) => page.evaluate(() => document.querySelector('#regBar')?.dataset.open ?? null);
// « Ouvrir » sur une régate de la liste (onglet Régates), puis attente du bandeau
async function ouvreRegate(page, id) {
  await page.click('#tabs button[data-tab=ic]');
  await page.click(`#rgList [data-rg="${id}"]`);
  await page.waitForSelector(`#regBar[data-open="${id}"]`, { timeout: 10000 });
}
// Ouvre la régate d'une ligne de la liste (bouton « Ouvrir ») ; une ligne sans bouton est déjà la régate ouverte
const ouvreLigne = async (ligne) => { const b = ligne.locator('[data-rg]'); if (await b.count()) await b.click(); };
// « Fermer la régate » (bandeau) : retour à l’entraînement libre
async function fermeRegate(page) {
  await page.click('#regClose');
  await page.waitForSelector('#regBar[data-open=""]', { timeout: 10000 });
}

// Crée une régate par l’interface : « ＋ Nouvelle régate », trois champs (et le dernier jour), « Créer la régate »
async function creeRegate(page, { nom, debut, fin = '', club = '' }) {
  await page.click('#tabs button[data-tab=ic]');
  await page.click('#rgNew');
  await page.fill('#rgName', nom);
  await page.fill('#rgStart', debut);
  if (club) await page.fill('#rgClub', club);
  if (fin) await page.fill('#rgEnd', fin);
  await page.click('#rgCreate');
  await page.waitForSelector('#rgForm', { state: 'detached', timeout: 10000 });
}

// ───────────────────────── scénarios

// Fiche IC de l’ancienne version (rade.events.v1), telle que l’app d’avant l’enregistrait
const FICHE_SNPM = { current: 'snpm-2026', list: [{ id: 'snpm-2026', event: 'Coupe de la SNPM — CVAT', date: '2026-10-18', firstWarning: '10:55', lastFinishSignal: '16:00', vhf: 72, committee: 'Comité', zone: 'Grande Rade', keyRules: ['Abandon : le signaler au Comité.'], source: 'IC fournies (PDF)', text: 'IC de la Coupe de la SNPM' }] };
const NOM_PIEGE = 'Régate test <img src=x onerror="window.__xss=1">';

// REG-01 : créer une régate en trois champs, la voir classée par saison et par statut ; le verrou lit la régate du jour
async function creer({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-11-07T08:30:00Z' });        // samedi 07/11/2026 09:30 à Paris
  const { page, erreurs } = await ouvrePage(ctx);
  // une fiche de l’ancienne version, déposée avant le premier chargement de la nouvelle
  const ancien = JSON.stringify(FICHE_SNPM);
  await page.goto(base + 'data/meta.json');            // page de même origine sans l’app : le stockage est écrit avant le premier chargement
  await page.evaluate((v) => localStorage.setItem('rade.events.v1', v), ancien);
  await ouvreApp(page, base);
  const repris = await page.evaluate(() => ({ idx: JSON.parse(localStorage.getItem('rade.regates.v1')), ev: localStorage.getItem('rade.events.v1') }));
  assert.equal(repris.ev, ancien, 'rade.events.v1 modifiée par la nouvelle version');
  assert.equal(repris.idx.list.length, 1, 'la fiche existante devient une régate');
  assert.equal(repris.idx.list[0].id, 'snpm-2026');
  assert.equal(repris.idx.list[0].club, 'CVAT');
  assert.equal(repris.idx.list[0].ic.fields.vhf, 72, 'les champs de la fiche sont repris');

  await creeRegate(page, { nom: NOM_PIEGE, debut: '2026-11-07', fin: '2026-11-09', club: 'CVAT' });
  let liste = await lireListe(page);
  assert.deepEqual(liste.map((g) => g.status), ['En cours', 'Terminées'], 'statuts : En cours puis Terminées');
  assert.equal(liste[0].rows[0].name, NOM_PIEGE, 'le nom s’affiche en texte');
  assert.match(liste[0].rows[0].text, /2026/, 'l’année reste lisible dans la ligne');
  assert.ok(liste[0].rows[0].open, 'la nouvelle régate est la régate ouverte');
  assert.equal(await idOuverte(page), liste[0].rows[0].id, 'le bandeau porte la régate créée');
  assert.equal(liste[1].rows[0].id, 'snpm-2026', 'la Coupe SNPM est terminée'); assert.ok(!liste[1].rows[0].open);
  assert.equal(await page.locator('section[data-tab=ic] img').count(), 0, 'aucune balise img dans l’onglet');
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'le nom piégé a exécuté du code');
  await page.click('#tabs button[data-tab=live]');
  assert.equal(await page.locator('#raceDone').count(), 1, 'jour de régate : la carte « Course finie » doit être là');

  // elle survit à un rechargement
  await ouvreApp(page, base);
  liste = await lireListe(page);
  assert.equal(liste[0].rows[0].name, NOM_PIEGE, 'la régate a disparu au rechargement');
  assert.equal(await idOuverte(page), liste[0].rows[0].id, 'le jour de la régate, elle est ouverte au lancement sans aucun geste');
  assert.equal(await page.evaluate(() => localStorage.getItem('rade.events.v1')), ancien, 'rade.events.v1 modifiée au rechargement');

  // lundi 09/11 à 23 h 30 (Paris) : encore le dernier jour ; mardi 10/11 : passée, plus de carte « Course finie »
  await ctx.clock.setFixedTime(new Date('2026-11-09T22:30:00Z'));
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=live]');
  assert.equal(await page.locator('#raceDone').count(), 1, 'dernier jour à 23 h 30 : la carte doit rester');
  await ctx.clock.setFixedTime(new Date('2026-11-10T08:30:00Z'));
  await ouvreApp(page, base);
  liste = await lireListe(page);
  assert.deepEqual(liste.map((g) => g.status), ['Terminées'], 'le 10/11 la régate est terminée, comme la Coupe SNPM');
  assert.equal(liste[0].rows.length, 2); assert.equal(await idOuverte(page), '', 'le 10/11 : entraînement libre');
  await page.click('#tabs button[data-tab=live]');
  assert.equal(await page.locator('#raceDone').count(), 0, 'le 10/11 la carte « Course finie » doit disparaître');
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

// Ajoute une manche par l’interface : « ＋ Ajouter une manche », heure du signal, parcours, classe, tours, « Ajouter la manche »
async function ajouteManche(page, { heure, parcours, cls, tours }) {
  const avant = await page.locator('section[data-tab=ic] .rgrace').count();
  await page.click('#rcNew');
  await page.fill('#rcTime', heure);
  await page.selectOption('#rcCourse', parcours);
  await page.selectOption('#rcCls', cls);
  await page.selectOption('#rcLaps', tours);
  await page.click('#rcAdd');
  await page.waitForSelector('#rcForm', { state: 'detached', timeout: 10000 });
  assert.equal(await page.locator('section[data-tab=ic] .rgrace').count(), avant + 1, 'la manche doit apparaître dans la fiche');
}
const reglages = (page) => page.evaluate(() => ({ parcours: document.querySelector('#cSel')?.value, cls: document.querySelector('#cCls')?.value, depart: document.querySelector('#cStart')?.value }));

// REG-02 : plusieurs manches dans une journée, chacune avec son parcours ; « Choisir cette manche » cale le départ
async function manche({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-11-07T08:30:00Z' });        // samedi 07/11/2026 09:30 à Paris
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await creeRegate(page, { nom: 'Régate des manches', debut: '2026-11-07', club: 'CVAT' });
  await ajouteManche(page, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  await ajouteManche(page, { heure: '13:25', parcours: '3', cls: 'P', tours: '1' });
  const lignes = await page.locator('section[data-tab=ic] .rgrace').allTextContents();
  assert.match(lignes[0], /Manche 1[\s\S]*10:55[\s\S]*classe G[\s\S]*2 tours/);
  assert.match(lignes[1], /Manche 2[\s\S]*13:25[\s\S]*classe P[\s\S]*1 tour(?!s)/);

  // première manche : parcours 5, classe G, départ à 11:00 (10:55 + 5 min)
  await page.click('[data-race="1"]');
  await page.click('#tabs button[data-tab=course]');
  assert.deepEqual(await reglages(page), { parcours: '5', cls: 'G', depart: '11:00' });
  // seconde manche : parcours 3, classe P, départ à 13:30 (13:25 + 5 min)
  await page.click('#tabs button[data-tab=ic]');
  await page.click('[data-race="2"]');
  await page.click('#tabs button[data-tab=course]');
  assert.deepEqual(await reglages(page), { parcours: '3', cls: 'P', depart: '13:30' });
  const etat = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('rade.state')), idx: JSON.parse(localStorage.getItem('rade.regates.v1')) }));
  assert.equal(etat.s.courseId, 3); assert.equal(etat.s.cls, 'P'); assert.equal(etat.s.startTime, 13.5); assert.equal(etat.s.day, '2026-11-07');
  const reg = await regateOuverte(page);                      // la régate créée est la régate ouverte (bandeau)
  assert.equal(reg.sel, 2, 'la manche choisie est gardée avec la régate');
  assert.deepEqual(reg.races.map((m) => [m.n, m.time, m.courseId, m.cls, m.laps]), [[1, '10:55', 5, 'G', 2], [2, '13:25', 3, 'P', 1]]);

  // après un rechargement : les deux manches et le choix sont là
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=ic]');
  assert.equal(await page.locator('section[data-tab=ic] .rgrace').count(), 2);
  assert.equal(await page.locator('section[data-tab=ic] .rgrace.on').count(), 1);
  assert.match(await page.locator('section[data-tab=ic] .rgrace.on').textContent(), /Manche 2/);
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

// Sert GET /api/membre comme le middleware : { membre } en 200, ou 401 { error: 'acces' } tant que `servi.ok` est faux ; `servi.vu` se résout à la première demande
async function simuleMembre(ctx, nom) {
  const servi = { ok: true, appels: 0 };
  servi.vu = new Promise((ok) => { servi.signale = ok; });
  await ctx.route('**/api/membre', (route) => {
    servi.appels++; servi.signale();
    return servi.ok ? route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ membre: nom }) })
      : route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"acces"}' });
  });
  return servi;
}
const membreGarde = (page, nom) => page.waitForFunction((n) => localStorage.getItem('rade.membre.v1') === n, nom, { timeout: 20000 });

// ARCH-02 (auteur, D-05) : le prénom donné par le middleware signe la régate et la manche ; gardé hors réseau ; complété au premier succès
async function auteur({ browser, base }) {
  const NOM = 'Équipier test';
  // 1) réponse du middleware dès le premier chargement : tout ce qui est créé porte le prénom
  const ctx = await ouvreContexte(browser, { heure: '2026-11-07T08:30:00Z' });
  const servi = await simuleMembre(ctx, NOM);
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await membreGarde(page, NOM);
  await creeRegate(page, { nom: 'Régate signée', debut: '2026-11-07', club: 'CVAT' });
  await ajouteManche(page, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  assert.match(await page.locator('section[data-tab=ic] .rg.on').textContent(), /par Équipier test/, 'la ligne de la régate porte son auteur');
  assert.match(await page.locator('#rgSheet').textContent(), /Créée par Équipier test/);
  assert.match(await page.locator('#rgSheet .rgrace').textContent(), /par Équipier test/, 'la manche porte son auteur');
  assert.match(await page.locator('#rgWho').textContent(), /Vous : Équipier test/);
  let reg = await regateOuverte(page);
  assert.equal(reg.by, NOM); assert.equal(reg.races[0].by, NOM);
  assert.ok(servi.appels >= 1, '/api/membre a été demandée');
  assert.ok(!JSON.stringify(await page.evaluate(() => ({ ...localStorage }))).match(/rt_acces|acces=/), 'aucun code d’accès côté page');
  sansErreur(erreurs, 'avec le middleware');
  await ctx.close();

  // 2) premier lancement hors réseau (la réponse échoue) : « — », puis complété au premier succès
  const ctx2 = await ouvreContexte(browser, { heure: '2026-11-07T08:30:00Z' });
  const servi2 = await simuleMembre(ctx2, NOM);
  servi2.ok = false;
  const { page: p2, erreurs: e2 } = await ouvrePage(ctx2);
  await ouvreApp(p2, base);
  await servi2.vu;
  await creeRegate(p2, { nom: 'Régate hors réseau', debut: '2026-11-07', club: 'CVAT' });
  await ajouteManche(p2, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  const ligne = await p2.locator('section[data-tab=ic] .rg.on').textContent();
  assert.ok(ligne.includes('—') && !/par /.test(ligne), `sans réponse : « — » attendu, vu « ${ligne} »`);
  assert.match(await p2.locator('#rgWho').textContent(), /Vous : —/);
  reg = await regateOuverte(p2);
  assert.equal(reg.by, null); assert.equal(reg.races[0].by, null);
  assert.equal(await p2.evaluate(() => localStorage.getItem('rade.membre.v1')), null, 'rien de gardé sans réponse');
  servi2.ok = true;                                          // le réseau revient : au rechargement, la réponse arrive
  await ouvreApp(p2, base);
  await membreGarde(p2, NOM);
  await p2.waitForFunction(() => document.querySelector('#rgWho')?.textContent.includes('Vous : Équipier test'), null, { timeout: 20000 });
  await p2.click('#tabs button[data-tab=ic]');
  assert.match(await p2.locator('section[data-tab=ic] .rg.on').textContent(), /par Équipier test/, 'la régate créée hors réseau est complétée');
  assert.match(await p2.locator('#rgSheet .rgrace').textContent(), /par Équipier test/, 'la manche créée hors réseau est complétée');
  reg = await regateOuverte(p2);
  assert.equal(reg.by, NOM); assert.equal(reg.races[0].by, NOM);
  sansErreur(e2, 'hors réseau puis en ligne');
  await ctx2.close();
}

const PDF_IC = ROOT + 'tests/fixtures/ic-coupe-snpm-2026-10-18.pdf';
// Dépose le PDF des IC SNPM dans #icFile (lecture réelle par pdf.js dans Chromium) et attend la carte de relecture
async function importeIC(page) {
  await page.setInputFiles('#icFile', PDF_IC);
  await page.waitForSelector('#icReview', { timeout: 60000 });
}
// Relecture affichée : { clé: { valeur, extrait, texte } } (extrait = ligne « Extrait : … » ou la mention « non lu… »)
const lireRelecture = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#icReview .icf')].map((el) => [el.dataset.field, {
  valeur: el.querySelector('input[data-f]').value, extrait: el.querySelector('.icex')?.textContent ?? '', puce: el.querySelector('[data-chip]')?.className ?? '', puceTexte: el.querySelector('[data-chip]')?.textContent ?? '',
}])));

// REG-03 (IC CVAT, D-02, D-03) : le PDF s'importe en relecture champ par champ avec l'extrait d'origine ; rien n'est retenu avant « Valider les IC »
async function ic({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });        // lundi 19/10/2026 10 h 30 à Paris
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await creeRegate(page, { nom: 'Test IC', debut: '2026-10-19', club: 'CVAT' });
  assert.equal((await regateOuverte(page)).ic, null, 'une régate créée n’a pas d’IC');
  assert.match(await page.locator('#icVal').textContent(), /Pas encore d’IC validées/);

  await importeIC(page);
  let rel = await lireRelecture(page);
  assert.equal(rel.firstWarning.valeur, '10:55', 'premier signal lu');
  assert.match(rel.firstWarning.extrait, /^Extrait : .*10h55/, 'l’extrait contient « 10h55 »');
  assert.equal(rel.vhf.valeur, '72'); assert.match(rel.vhf.extrait, /^Extrait : .*72/);
  assert.equal(rel.dateStart.valeur, '2026-10-18'); assert.match(rel.dateStart.extrait, /18 octobre 2026/);
  assert.equal(rel.lastFinishSignal.valeur, '16:00');
  assert.match(rel.dateEnd.extrait, /non lu dans le texte/, 'le dernier jour n’est pas lu : vide, et le dit');
  assert.equal(rel.dateEnd.valeur, '');
  assert.equal(await page.locator('#icReview input[data-f]').evaluateAll((l) => l.every((i) => i.type === 'text')), true, 'saisie en texte');
  // l'import n'a rien retenu : ni dans l'index, ni dans la fiche
  assert.equal((await regateOuverte(page)).ic, null, 'rien n’entre avant « Valider les IC »');
  assert.match(await page.locator('#icVal').textContent(), /Pas encore d’IC validées/);
  // un changement d'onglet n'écrit rien non plus
  await page.click('#tabs button[data-tab=live]'); await page.click('#tabs button[data-tab=ic]');
  assert.equal((await regateOuverte(page)).ic, null, 'changement d’onglet : rien d’écrit');

  // « Annuler » : la relecture disparaît, toujours rien
  await page.click('#icCancel');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  assert.equal((await regateOuverte(page)).ic, null, '« Annuler » : rien d’écrit');
  // une relance abandonne aussi une relecture ouverte
  await importeIC(page);
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=ic]');
  assert.equal(await page.locator('#icReview').count(), 0, 'relance : la relecture est abandonnée');
  assert.equal((await regateOuverte(page)).ic, null, 'relance : rien d’écrit');

  // nouvel import, correction d'un champ puis « Valider les IC »
  await importeIC(page);
  await page.fill('#icf-zone', 'Rade de Toulon corrigée');
  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg = await regateOuverte(page);
  assert.equal(typeof reg.ic.validated.at, 'number', 'qui a validé et quand : l’heure est posée');
  assert.ok(reg.ic.validated.by === null || typeof reg.ic.validated.by === 'string');
  assert.equal(reg.ic.fields.vhf, 72); assert.equal(reg.ic.fields.firstWarning, '10:55'); assert.equal(reg.ic.fields.lastFinishSignal, '16:00');
  assert.equal(reg.ic.fields.zone, 'Rade de Toulon corrigée');
  assert.equal(reg.dateStart, '2026-10-18', 'le premier jour vient des IC'); assert.equal(reg.season, '2026');
  assert.ok(reg.ic.excerpts.firstWarning && /10h55/.test(reg.ic.excerpts.firstWarning), 'l’extrait est gardé');
  assert.ok(!('zone' in reg.ic.excerpts), 'une valeur corrigée à la main perd son extrait');
  assert.equal(reg.ic.read, 'motifs'); assert.equal(reg.ic.source, 'ic-coupe-snpm-2026-10-18.pdf');
  assert.ok(reg.ic.fields.keyRules.length > 0 && reg.ic.text.length > 10000 && reg.ic.text.length <= 20000);
  assert.match(await page.locator('#icVal').textContent(), /^IC validées.* le \d\d\/\d\d \(lecture par motifs\)$/);
  assert.match(await page.locator('section[data-tab=ic]').textContent(), /VHF 72/);
  // elle survit à un rechargement : les IC ont ramené la régate au 18/10 (passée), l'app repart en entraînement libre ; on la rouvre explicitement
  await ouvreApp(page, base);
  assert.equal(await idOuverte(page), '', 'rechargement : entraînement libre, la régate est passée depuis les IC');
  await ouvreRegate(page, reg.id);
  assert.match(await page.locator('#icVal').textContent(), /IC validées/);
  assert.equal((await regateOuverte(page)).ic.fields.vhf, 72);
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

// Saisit une valeur dans un champ de la relecture ; rend l'état de la puce du champ et du bouton « Valider les IC »
async function saisit(page, champ, valeur) {
  await page.fill('#icf-' + champ, valeur);
  return page.evaluate((c) => ({
    puce: document.querySelector(`#icReview [data-chip="${c}"]`).className, puceTexte: document.querySelector(`#icReview [data-chip="${c}"]`).textContent,
    bouton: document.querySelector('#icValidate').disabled, blocVisible: !document.querySelector('#icBlock').hidden, actif: document.activeElement?.id,
  }), champ);
}

// REG-03 (D-02) : une puce de vraisemblance à côté de chaque valeur ; une valeur impossible empêche la validation tant qu'elle n'est pas corrigée ou vidée
async function vraisemblance({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await creeRegate(page, { nom: 'Test vraisemblance', debut: '2026-10-19', club: 'CVAT' });
  await importeIC(page);
  // les IC SNPM lues sont plausibles : une puce verte par valeur lue, bouton actif
  const rel = await lireRelecture(page);
  for (const k of ['event', 'dateStart', 'firstWarning', 'lastFinishSignal', 'vhf']) assert.match(rel[k].puce, /\bgood\b/, `${k} : puce verte attendue, vu « ${rel[k].puce} » ${rel[k].puceTexte}`);
  assert.equal(await page.locator('#icValidate').isDisabled(), false);

  let e = await saisit(page, 'vhf', '99');
  assert.match(e.puce, /\blow\b/, 'VHF 99 : puce rouge'); assert.match(e.puceTexte, /impossible/);
  assert.equal(e.bouton, true, 'VHF 99 : « Valider les IC » désactivé'); assert.equal(e.blocVisible, true);
  assert.equal(e.actif, 'icf-vhf', 'la carte n’est pas reconstruite à chaque touche : le curseur reste dans le champ');
  assert.match(await page.locator('#icBlock').textContent(), /Corrigez ou videz les valeurs impossibles/);
  e = await saisit(page, 'vhf', '72');
  assert.match(e.puce, /\bgood\b/); assert.equal(e.bouton, false); assert.equal(e.blocVisible, false);
  e = await saisit(page, 'firstWarning', '03:30');
  assert.match(e.puce, /\bmid\b/, '03:30 : puce orange'); assert.match(e.puceTexte, /inhabituelle/); assert.equal(e.bouton, false, 'une valeur inhabituelle n’empêche rien');
  e = await saisit(page, 'firstWarning', '25:00');
  assert.match(e.puce, /\blow\b/, '25:00 : puce rouge'); assert.equal(e.bouton, true, '25:00 : « Valider les IC » désactivé');
  e = await saisit(page, 'firstWarning', '');
  assert.equal(e.bouton, false, 'valeur vidée : la validation est possible'); assert.match(e.puce, /\bmid\b/, 'vidée : « non lu » en alerte'); assert.match(e.puceTexte, /non lu dans le texte/);
  e = await saisit(page, 'firstWarning', '10:55');
  assert.match(e.puce, /\bgood\b/); assert.equal(e.bouton, false);
  e = await saisit(page, 'lastFinishSignal', '09:00');
  assert.match(e.puce, /\bmid\b/); assert.match(e.puceTexte, /avant le premier signal/);
  e = await saisit(page, 'dateStart', '2026-02-30');
  assert.match(e.puce, /\blow\b/); assert.equal(e.bouton, true);
  e = await saisit(page, 'dateStart', '2026-10-18');
  assert.equal(e.bouton, false);
  e = await saisit(page, 'vhf', '16');
  assert.match(e.puce, /\bmid\b/); assert.match(e.puceTexte, /détresse/); assert.equal(e.bouton, false);
  e = await saisit(page, 'vhf', '7 2');
  assert.match(e.puce, /\blow\b/); assert.equal(e.bouton, true);
  assert.equal(await page.locator('#icReview [data-mod=vhf]').isVisible(), true, 'valeur modifiée à la main : signalé');
  // rien n'a été écrit pendant la saisie ; la valeur impossible vidée, la validation passe et l'impossible n'entre pas
  assert.equal((await regateOuverte(page)).ic, null);
  e = await saisit(page, 'vhf', '');
  assert.equal(e.bouton, false);
  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg = await regateOuverte(page);
  assert.equal(reg.ic.fields.vhf, null, 'VHF vidée : rien d’écrit');
  assert.equal(reg.ic.fields.firstWarning, '10:55'); assert.equal(reg.ic.fields.lastFinishSignal, '09:00', 'une valeur inhabituelle est validée telle quelle');
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

// ───────────────────────── gel du vent du jour (ARCH-02)

// Valeur rangée sous `cle` dans la base rade-regates de la page (null si absente ou si la base n'existe pas encore)
const lireSlot = (page, cle) => page.evaluate((k) => new Promise((ok) => {
  const o = indexedDB.open('rade-regates');
  o.onerror = () => ok(null);
  o.onupgradeneeded = () => { o.transaction.abort(); ok(null); };                    // base inexistante : ne rien créer
  o.onsuccess = () => {
    const d = o.result;
    if (!d.objectStoreNames.contains('slots')) { d.close(); ok(null); return; }
    const g = d.transaction('slots').objectStore('slots').get(k);
    g.onsuccess = () => { d.close(); ok(g.result ?? null); }; g.onerror = () => { d.close(); ok(null); };
  };
}), cle);
// Résumé du gel d'un jour dans l'index de la régate courante
const gelDuJour = (page, jour) => regateOuverte(page).then((r) => r?.frozen?.[jour] ?? null);
// Attend (sans geste) que le gel du jour vérifie `cond`, puis le rend
async function attendGel(page, jour, cond, quoi) {
  const t0 = Date.now();
  for (;;) {
    const f = await gelDuJour(page, jour);
    if (f && cond(f)) return f;
    if (Date.now() - t0 > 40000) throw new Error(`gel ${jour} : ${quoi} jamais atteint (dernier résumé : ${JSON.stringify(f)})`);
    await page.waitForTimeout(250);
  }
}
const ongletIC = (page) => page.click('#tabs button[data-tab=ic]');
const texteVent = async (page, jour) => (await page.locator(`#rgSheet .rgwind[data-day="${jour}"]`).textContent()).replace(/\s+/g, ' ');

// ARCH-02 : le jour de régate, sans geste, prévisions et relevés sont copiés dans la régate (hors réseau : instantané embarqué), scellés au
// premier signal ; première ouverture après le signal = « figé après le départ » ; régate sans heure = « signal inconnu », copiée toute la journée
async function gel({ browser, base }) {
  // 1) samedi 18/10/2026, 10 h à Paris : régate avec une manche à 10:55, aucun réseau
  const ctx = await ouvreContexte(browser, { heure: '2026-10-18T08:00:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await creeRegate(page, { nom: 'Coupe du gel', debut: '2026-10-18', club: 'CVAT' });
  await ajouteManche(page, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  const id = (await regateOuverte(page)).id;
  const f = await attendGel(page, '2026-10-18', (x) => x.signal === 'manche', 'copie à jour avec le signal de la manche');   // une copie faite avant l'ajout de la manche (signal inconnu) est refaite sans attendre 10 min
  assert.equal(f.sealed, false, 'avant le signal : pas scellé'); assert.equal(f.late, false); assert.equal(f.auto, true);
  assert.equal(f.snapshot, true, 'hors réseau : les prévisions embarquées'); assert.equal(f.signal, 'manche');
  assert.equal(f.sealAt, Date.parse('2026-10-18T08:55:00Z'));
  assert.equal(f.at, Date.parse('2026-10-18T08:00:00Z'));
  const wx = await lireSlot(page, `${id}|2026-10-18|wx`);
  assert.ok(wx, 'prévisions du jour dans la base rade-regates');
  assert.equal(wx.multi.hourly.time.length, 25, '25 heures : le jour plus l’heure qui suit'); assert.equal(wx.grid.length, 24); assert.equal(wx.snapshot, true);
  assert.ok(await lireSlot(page, `${id}|2026-10-18|obs`), 'relevés du jour dans la base');
  await ongletIC(page);
  await page.waitForFunction(() => document.querySelector('#rgSheet .rgwind[data-day="2026-10-18"]')?.textContent.includes('Figé automatiquement'), null, { timeout: 20000 });
  assert.match(await texteVent(page, '2026-10-18'), /Figé automatiquement à 10:00/);
  assert.match(await texteVent(page, '2026-10-18'), /prévisions embarquées du 17\/10/);
  assert.match(await texteVent(page, '2026-10-18'), /sera scellé au signal de 10:55/);
  // la route conseillée du jour (dernière analyse déjà faite) est figée avec le vent : en base et dans la fiche, sans requête
  const g1 = await attendGel(page, '2026-10-18', (x) => x.strategy, 'route conseillée');
  const strat = await lireSlot(page, `${id}|2026-10-18|strat`);
  assert.ok(strat, 'route conseillée dans la base rade-regates');
  assert.ok(strat.legs.length >= 8 && strat.legs.length === g1.strategy.nLegs, `bords figés : ${strat.legs.length}`);
  assert.ok(JSON.stringify(strat).length <= 12000, 'moins de 12 Ko');
  assert.equal(strat.settings.day, '2026-10-18'); assert.equal(typeof strat.settings.courseId, 'number'); assert.ok(strat.settings.polar && strat.settings.model, 'les réglages sont gardés');
  assert.ok(strat.legs.every((l) => l.to[0] > 43 && l.to[0] < 43.2 && l.to[1] > 5.8 && l.to[1] < 6.1), 'positions en latitude / longitude');
  assert.match(await texteVent(page, '2026-10-18'), /Route conseillée figée : .*classe [GP] · \d tours? · départ \d\d:\d\d · \d+ bords · arrivée estimée en/);
  assert.equal(await page.locator('#rgSheet .rgwind[data-day="2026-10-18"] details .rgleg').count(), strat.legs.length, 'détail des bords sans requête');

  // 2) 11 h : un tic de raceTick (5 s) suffit pour sceller
  await ctx.clock.setFixedTime(new Date('2026-10-18T09:00:00Z'));
  const s = await attendGel(page, '2026-10-18', (x) => x.sealed, 'sceau');
  assert.equal(s.late, false, 'copie faite avant le signal : pas « tardive »');
  await ongletIC(page);
  await page.waitForFunction(() => /scellé au signal de 10:55/.test(document.querySelector('#rgSheet .rgwind[data-day="2026-10-18"]')?.textContent || ''), null, { timeout: 20000 });
  // après le sceau, plus rien ne bouge : l’heure du gel reste celle d’avant le signal
  await page.waitForTimeout(6000);
  assert.equal((await gelDuJour(page, '2026-10-18')).at, s.at, 'scellé : la copie ne bouge plus');
  sansErreur(erreurs, 'gel avant et au signal');
  await ctx.close();

  // 3) première ouverture après le signal (11 h 30) : copie marquée « figé après le départ »
  const ctx2 = await ouvreContexte(browser, { heure: '2026-10-18T09:30:00Z' });
  const { page: p2, erreurs: e2 } = await ouvrePage(ctx2);
  await ouvreApp(p2, base);
  // (l'onglet Régates n'est ouvert qu'après la copie : la fiche doit alors montrer le gel qui a eu lieu fiche fermée — ancien défaut d'affichage « Pas encore figé » corrigé avec icStale)
  // La régate et sa manche de 10:55 sont posées dans le stockage AVANT l'ouverture de l'app : la première copie voit déjà le signal, donc sans signal ni copie antérieure elle est « tardive »
  // (créée par l'interface, un tic de gel pouvait tomber entre la création et l'ajout de la manche : copie « signal inconnu », puis « sceau » et non « tardive » — échec une fois sur six)
  const manche1 = { n: 1, date: '2026-10-18', time: '10:55', courseId: 5, cls: 'G', laps: 2, note: '', by: null, at: 0 };
  await sème(p2, base, [{ ...regateSemee('tard', 'Ouverte trop tard', '2026-10-18'), races: [manche1] }]);
  const id2 = (await regateOuverte(p2)).id;
  const t = await attendGel(p2, '2026-10-18', (x) => x.signal === 'manche', 'copie tardive');
  assert.equal(t.late, true, 'copie marquée tardive'); assert.equal(t.sealed, true, 'et scellée d’emblée');
  assert.ok(await lireSlot(p2, `${id2}|2026-10-18|wx`), 'les prévisions sont tout de même copiées');
  await ongletIC(p2);
  await p2.waitForFunction(() => /figé après le départ/.test(document.querySelector('#rgSheet .rgwind[data-day="2026-10-18"]')?.textContent || ''), null, { timeout: 20000 });
  assert.doesNotMatch(await texteVent(p2, '2026-10-18'), /scellé au signal de/);
  sansErreur(e2, 'première ouverture après le signal');
  await ctx2.close();

  // 4) signal inconnu (revue W1) : régate « Sortie sans heure » du seul 19/10, ni manche ni IC ; 15 h à Paris, aucun réseau
  const ctx3 = await ouvreContexte(browser, { heure: '2026-10-19T13:00:00Z' });
  const { page: p3, erreurs: e3 } = await ouvrePage(ctx3);
  await ouvreApp(p3, base);
  await creeRegate(p3, { nom: 'Sortie sans heure', debut: '2026-10-19', club: '' });
  const id3 = (await regateOuverte(p3)).id;
  const u = await attendGel(p3, '2026-10-19', () => true, 'copie sans signal');
  assert.equal(u.signal, 'inconnu'); assert.ok(!u.sealed, 'pas scellé : la copie continue toute la journée'); assert.equal(u.late, false, 'jamais « tardive »');
  assert.equal(u.sealAt, Date.parse('2026-10-19T22:00:00Z'), 'fin du 19/10 à Paris (minuit, heure d’été)');
  assert.ok(await lireSlot(p3, `${id3}|2026-10-19|wx`), 'prévisions du 19/10 dans la base');
  await ongletIC(p3);
  await p3.waitForFunction(() => /signal inconnu/.test(document.querySelector('#rgSheet .rgwind[data-day="2026-10-19"]')?.textContent || ''), null, { timeout: 20000 });
  const x = await texteVent(p3, '2026-10-19');
  assert.match(x, /signal inconnu/); assert.match(x, /19\/10 à 24:00/); assert.doesNotMatch(x, /scellé/);
  sansErreur(e3, 'signal inconnu');
  await ctx3.close();
}

// ───────────────────────── débrief tardif sur le vent figé (ARCH-02, Pitfall 1)

const GPX_SNPM = ROOT + 'tests/fixtures/coupe-snpm-2026-10-18.gpx';
// Copie de data/wx-snapshot.json décalée de 7 jours calendaires, heure locale inchangée (« 2026-10-17T00:00 » → « 2026-10-24T00:00 ») :
// chaque horodatage de multi, des 24 points de grille et de la mer, et `fetched` ; aucune autre valeur n'est modifiée
function snapshotDecale(jours = 7) {
  const wx = JSON.parse(readFileSync(ROOT + 'data/wx-snapshot.json', 'utf8'));
  const pousse = (t) => new Date(Date.parse(t.slice(0, 10) + 'T12:00:00Z') + jours * 864e5).toISOString().slice(0, 10) + t.slice(10);
  const cale = (loc) => { if (loc?.hourly?.time) loc.hourly.time = loc.hourly.time.map(pousse); };
  cale(wx.multi); (Array.isArray(wx.grid) ? wx.grid : [wx.grid]).forEach(cale); cale(wx.marine);
  wx.fetched += jours * 864e5;
  return wx;
}
const lireDirections = (jour) => {                          // directions AROME HD du jour dans l'instantané embarqué : le vent figé en vient
  const h = JSON.parse(readFileSync(ROOT + 'data/wx-snapshot.json', 'utf8')).multi.hourly;
  return new Set(h.time.map((t, i) => (t.startsWith(jour) ? Math.round(h.wind_direction_10m_meteofrance_arome_france_hd[i]) : null)).filter((x) => x != null));
};

// Deux jours ou plus après la course : l'analyse de la trace et le questionnaire du débrief utilisent le vent figé du jour, et le disent
async function debriefTardif({ browser, base }) {
  // 1) le 18/10 à 10 h (Paris), régate avec une manche : le vent et la route sont figés sans geste
  const ctx = await ouvreContexte(browser, { heure: '2026-10-18T08:00:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await creeRegate(page, { nom: 'Coupe SNPM figée', debut: '2026-10-18', club: 'CVAT' });
  await ajouteManche(page, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  await attendGel(page, '2026-10-18', (x) => x.strategy, 'vent et route figés');

  // 2) le 25/10 à 12 h (Paris, heure d'hiver) : les prévisions vivantes couvrent 24 au 26/10, plus le 18/10
  await ctx.clock.setFixedTime(new Date('2026-10-25T11:00:00Z'));
  await page.evaluate((v) => localStorage.setItem('rade.wx.v1', v), JSON.stringify(snapshotDecale()));
  await ouvreApp(page, base);
  const vivant = await page.evaluate(() => JSON.parse(localStorage.getItem('rade.wx.v1')).multi.hourly.time.map((t) => t.slice(0, 10)));
  assert.ok(!vivant.includes('2026-10-18') && vivant.includes('2026-10-25'), 'les prévisions vivantes ne couvrent plus le 18/10');
  await page.click('#tabs button[data-tab=tracks]');
  await page.setInputFiles('#gpxIn', GPX_SNPM);
  await page.waitForSelector('#trWind', { timeout: 90000 });
  assert.match(await page.locator('#trWind').textContent(), /vent du jour figé le 18\/10 à 10:\d\d/, 'l’analyse de la trace annonce le vent figé');
  assert.match(await page.locator('#traceDetail').textContent(), /% de la polaire|de la polaire/);

  // 3) le questionnaire du débrief : vent au départ pré-rempli d'après le gel (jamais le vent manuel par défaut), source citée
  await page.waitForSelector('#dqWind', { timeout: 30000 });                  // le questionnaire s'ouvre seul : la trace s'est rangée dans la régate du jour
  const vent = await page.inputValue('#dqWind');
  assert.ok(vent !== '' && lireDirections('2026-10-18').has(+vent), `vent au départ « ${vent} » : une direction des prévisions figées du 18/10 attendue (${[...lireDirections('2026-10-18')].join(', ')})`);
  const modal = (await page.locator('#modal').textContent()).replace(/\s+/g, ' ');
  assert.match(modal, /Pré-rempli avec[^.]*figé le 18\/10/, 'le questionnaire cite le gel du 18/10');
  await page.click('#dqCancel');

  // 4) contrôle négatif : sans le gel du jour, c'est le vent manuel, annoncé comme tel et sans valeur pré-remplie (le défaut que le gel corrige)
  await page.evaluate(() => { const i = JSON.parse(localStorage.getItem('rade.regates.v1')); i.list.forEach((r) => { r.frozen = {}; }); localStorage.setItem('rade.regates.v1', JSON.stringify(i)); });
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=tracks]');
  await page.click('[data-tv]');
  await page.waitForSelector('#trWind', { timeout: 60000 });
  assert.match(await page.locator('#trWind').textContent(), /vent manuel \(aucune prévision pour ce jour\)/, 'sans gel : vent manuel, annoncé');
  await page.click('#trDebrief');
  await page.waitForSelector('#dqWind', { timeout: 30000 });
  assert.equal(await page.inputValue('#dqWind'), '', 'sans gel, rien n’est pré-rempli');
  await page.click('#dqCancel');
  sansErreur(erreurs, 'débrief tardif');
  await ctx.close();
}

// ───────────────────────── GPX importé : rangé seul dans la régate de son jour, débrief ouvert pré-rempli, jamais en double (ARCH-04)

// Traces de la base rade-traces : [{ id, n }] (nombre de points, pas les points)
const lireTraces = (page) => page.evaluate(() => new Promise((ok, ko) => {
  const r = indexedDB.open('rade-traces', 1);
  r.onsuccess = () => { const q = r.result.transaction('tracks').objectStore('tracks').getAll(); q.onsuccess = () => ok(q.result.map((t) => ({ id: t.id, n: t.pts.length, start: t.start, brk: t.brk ?? null }))); q.onerror = () => ko(q.error); };
  r.onerror = () => ko(r.error);
}));
const toastVu = (page, re, delai = 90000) => page.waitForFunction((s) => new RegExp(s).test(document.getElementById('toast')?.textContent || ''), re, { timeout: delai });
const ongletTraces = (page) => page.click('#tabs button[data-tab=tracks]');

async function gpx({ browser, base }) {
  const NOM = 'Équipier test';
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T09:00:00Z' });          // lundi 19/10/2026 : la Coupe de la SNPM du 18/10 est semée
  await simuleMembre(ctx, NOM);
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await membreGarde(page, NOM);
  assert.equal(await idOuverte(page), '', 'au lancement le 19/10 : entraînement libre');
  const snpm = () => indexRegates(page).then((i) => i.list.find((r) => r.id === 'snpm-2026'));          // la Coupe SNPM lue dans l'index, ouverte ou non
  await ongletTraces(page);
  await page.setInputFiles('#gpxIn', GPX_SNPM);
  await toastVu(page, 'Trace rangée dans Coupe de la SNPM — CVAT');
  // le questionnaire du débrief s'ouvre seul, pré-rempli : épreuve, vent au départ
  await page.waitForSelector('#dqEvent', { timeout: 60000 });
  assert.equal(await page.inputValue('#dqEvent'), 'Coupe de la SNPM — CVAT', 'nom de l’épreuve = la régate');
  assert.notEqual(await page.inputValue('#dqWind'), '', 'vent au départ pré-rempli');
  const r1 = await snpm();
  assert.equal(r1.traces.length, 1, 'une référence de trace dans la régate');
  assert.equal(await idOuverte(page), '', 'la trace est rangée dans la Coupe SNPM sans l’ouvrir');
  assert.equal(r1.traces[0].by, NOM, 'la référence porte son auteur');
  assert.equal(r1.traces[0].n, 9538);
  const base1 = await lireTraces(page);
  assert.equal(base1.length, 1, 'une trace en base');
  assert.equal(r1.traces[0].id, base1[0].id);
  assert.deepEqual(base1[0].brk, [293], 'la pause est enregistrée dans la trace');
  assert.match(await page.locator('#trReg').textContent(), /Rangée dans\s*Coupe de la SNPM — CVAT/, 'le détail de la trace dit où elle est rangée');
  assert.match(await page.locator('#traceDetail').textContent(), /durée active/, 'le détail parle de durée active');

  // l'équipier valide le questionnaire tel quel ; la précision éventuelle (près ou portant) est acceptée telle quelle ; le rapport s'ouvre (réseau coupé : version automatique)
  await page.click('#dqGo');
  await page.waitForSelector('#rpFrame, #dmGo', { state: 'attached', timeout: 120000 });
  if (await page.locator('#dmGo').isVisible()) { await page.click('#dmGo'); await page.waitForSelector('#rpFrame', { state: 'attached', timeout: 120000 }); }
  await page.waitForFunction(() => document.querySelector('#rpFrame')?.srcdoc?.length > 500, null, { timeout: 120000 });
  // « Plein écran » : une page à nous (blob) qui enferme le rapport dans un cadre sandbox, sous la politique de contenu ; toute violation, même dans cette fenêtre, fait échouer le scénario
  const [plein] = await Promise.all([ctx.waitForEvent('page', { timeout: 20000 }), page.click('#rpOpen')]);
  await plein.waitForLoadState('load');
  await plein.waitForSelector('iframe[sandbox]', { state: 'attached', timeout: 20000 });
  assert.ok(await plein.evaluate(() => document.querySelector('iframe[sandbox]').srcdoc.length) > 500, 'la page « Plein écran » enferme le rapport dans un cadre sandbox');
  assert.equal(await plein.locator('iframe[sandbox]').count(), 1, 'un seul cadre');
  await plein.waitForTimeout(500);                  // laisse le cadre se charger : une violation y serait relevée
  await plein.close();
  await page.click('#rpClose');

  // le même fichier une seconde fois : « Déjà importée », ni seconde trace ni seconde référence, pas de second questionnaire
  await ongletTraces(page);
  await page.setInputFiles('#gpxIn', GPX_SNPM);
  await toastVu(page, 'Déjà importée', 30000);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#dqWind').isVisible(), false, 'pas de second questionnaire pour une trace déjà rangée');
  assert.equal((await lireTraces(page)).length, 1, 'toujours une seule trace en base');
  assert.equal((await snpm()).traces.length, 1, 'toujours une seule référence');
  assert.equal(await idOuverte(page), '', 'toujours en entraînement libre');

  // la Coupe SNPM est dans « Terminées » : « Ouvrir » la rouvre avec sa trace et son débrief
  await ouvreRegate(page, 'snpm-2026');
  // la fiche de la régate réunit la trace, son analyse, son débrief et leurs auteurs
  await page.click('#tabs button[data-tab=ic]');
  await page.waitForSelector('#rgSheet .rgtr', { timeout: 20000 });
  const ligne = (await page.locator('#rgSheet .rgtr').first().textContent()).replace(/\s+/g, ' ');
  assert.match(ligne, /\d+,\d Nq · [^·]*actives · \d+,\d nd · \d+ % de la polaire/, `résumé de la trace dans la fiche : ${ligne}`);
  assert.match(ligne, new RegExp(`par ${NOM}`), 'auteur de la trace');
  assert.match(ligne, new RegExp(`Débrief par ${NOM}`), 'auteur du débrief');
  assert.equal((await page.locator('#rgSheet [data-trd]').first().textContent()).trim(), 'Voir le débrief');
  await page.click('#rgSheet [data-trd]');
  await page.waitForFunction(() => document.querySelector('#rpFrame')?.srcdoc?.length > 500 && !document.querySelector('#modal')?.hidden, null, { timeout: 20000 });
  const idx = await snpm();
  assert.ok(idx.traces[0].sum && idx.traces[0].sum.dist > 25000 && idx.traces[0].sum.dur > 12000 && idx.traces[0].sum.dur < 13500, `résumé dans la référence : ${JSON.stringify(idx.traces[0].sum)}`);
  assert.ok(idx.traces[0].report?.t, 'rapport relié à la fiche');
  await page.click('#rpClose');
  await fermeRegate(page);                                         // « Fermer la régate » : entraînement libre, la trace reste dans l'archive
  assert.equal(await page.locator('#rgNone').count(), 1);
  assert.equal((await snpm()).traces.length, 1);
  sansErreur(erreurs, 'import GPX');
  await ctx.close();
}

// Index de régates posé avant le premier chargement de l'app (page de même origine sans l'app), puis app ouverte
const regateSemee = (id, name, debut, fin = '') => ({ id, name, club: 'CVAT', dateStart: debut, dateEnd: fin, season: debut.slice(0, 4), races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: null, at: 0 });
async function sème(page, base, regates) {
  await page.goto(base + 'data/meta.json');
  await page.evaluate((v) => localStorage.setItem('rade.regates.v1', v), JSON.stringify({ v: 1, list: regates }));
  await ouvreApp(page, base);
}
const indexRegates = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rade.regates.v1')));

// ARCH-04 : un jour ambigu est tranché par l'équipier, jamais deviné ; un rattachement se défait depuis la fiche
async function gpxChoix({ browser, base }) {
  // 1) deux régates le 18/10, sans manche : l'invite liste les deux
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T09:00:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  await sème(page, base, [regateSemee('ra', 'Régate A', '2026-10-18'), regateSemee('rb', 'Régate B', '2026-10-18')]);
  await ongletTraces(page);
  await page.setInputFiles('#gpxIn', GPX_SNPM);
  await page.waitForSelector('#modal [data-rp]', { timeout: 90000 });
  const invite = (await page.locator('#modal').textContent()).replace(/\s+/g, ' ');
  assert.match(invite, /Cette trace du 18\/10 correspond à plusieurs régates/);
  assert.deepEqual(await page.locator('#modal [data-rp]').allTextContents(), ['Régate A', 'Régate B']);
  assert.match(invite, /Aucune/);
  assert.equal((await indexRegates(page)).list.flatMap((r) => r.traces).length, 0, 'rien n’est rangé avant le choix');
  await page.click('#modal [data-rp="1"]');
  await page.waitForSelector('#dqEvent', { timeout: 60000 });
  assert.equal(await page.inputValue('#dqEvent'), 'Régate B', 'le débrief s’ouvre sur la régate choisie');
  let idx = await indexRegates(page);
  assert.deepEqual(idx.list.map((r) => [r.id, r.traces.length]), [['ra', 0], ['rb', 1]], 'rangée dans la seconde seulement');
  await page.click('#dqCancel');
  // « Détacher » depuis la fiche (deux touches) : la trace reste en base, la fiche n'en liste plus
  await page.click('#tabs button[data-tab=ic]');
  await page.click('[data-rg="rb"]');
  await page.waitForSelector('#rgSheet .rgtr', { timeout: 20000 });
  await page.click('#rgSheet [data-trx]');
  assert.match(await page.locator('#rgSheet [data-trx]').textContent(), /Détacher \?/, 'première touche : confirmation');
  await page.click('#rgSheet [data-trx]');
  await page.waitForFunction(() => !document.querySelector('#rgSheet .rgtr'), null, { timeout: 10000 });
  assert.match(await page.locator('#rgSheet').textContent(), /Aucune trace : importez le GPX/);
  idx = await indexRegates(page);
  assert.equal(idx.list.flatMap((r) => r.traces).length, 0, 'plus aucune référence');
  assert.equal((await lireTraces(page)).length, 1, 'la trace elle-même reste sur l’appareil');
  await ongletTraces(page);
  assert.match(await page.locator('#trReg').textContent(), /Sans régate/, 'le détail de la trace le dit');
  // « Ranger… » depuis le détail : la même invite, la trace va dans la régate choisie
  await page.click('#trPlace');
  await page.waitForSelector('#modal [data-rp]', { timeout: 20000 });
  await page.click('#modal [data-rp="0"]');
  await page.waitForSelector('#dqEvent', { timeout: 60000 });
  assert.equal(await page.inputValue('#dqEvent'), 'Régate A');
  await page.click('#dqCancel');
  assert.deepEqual((await indexRegates(page)).list.map((r) => [r.id, r.traces.length]), [['ra', 1], ['rb', 0]]);
  assert.match(await page.locator('#trReg').textContent(), /Rangée dans\s*Régate A/);
  sansErreur(erreurs, 'jour ambigu');
  await ctx.close();

  // 2) seule une régate du 7 au 9 novembre : l'invite propose d'en créer une à la date de la trace
  const ctx2 = await ouvreContexte(browser, { heure: '2026-10-19T09:00:00Z' });
  const { page: p2, erreurs: e2 } = await ouvrePage(ctx2);
  await sème(p2, base, [regateSemee('nov', 'Régate de novembre', '2026-11-07', '2026-11-09')]);
  await ouvreRegate(p2, 'nov');                                   // ouverture explicite : la régate de novembre est la régate ouverte pendant l'import
  await ongletTraces(p2);
  await p2.setInputFiles('#gpxIn', GPX_SNPM);
  await p2.waitForSelector('#modal [data-rc]', { timeout: 90000 });
  assert.match(await p2.locator('#modal').textContent(), /Cette trace du 18\/10 n’est dans aucune régate/);
  assert.equal((await p2.locator('#modal [data-rc]').textContent()).trim(), 'Créer une régate le 18/10');
  assert.equal((await p2.locator('#modal [data-rn]').textContent()).trim(), 'Laisser sans régate');
  await p2.click('#modal [data-rc]');
  await p2.waitForSelector('#dqEvent', { timeout: 60000 });
  assert.equal(await p2.inputValue('#dqEvent'), 'Régate du 18/10');
  const i2 = await indexRegates(p2);
  assert.deepEqual(i2.list.map((r) => [r.name, r.dateStart, r.traces.length]), [['Régate de novembre', '2026-11-07', 0], ['Régate du 18/10', '2026-10-18', 1]]);
  assert.equal(await idOuverte(p2), 'nov', 'la régate ouverte ne change pas');
  await p2.click('#dqCancel');
  sansErreur(e2, 'création depuis l’invite');
  await ctx2.close();

  // 3) « Laisser sans régate » : la trace s'ouvre, aucun questionnaire, aucune référence
  const ctx3 = await ouvreContexte(browser, { heure: '2026-10-19T09:00:00Z' });
  const { page: p3, erreurs: e3 } = await ouvrePage(ctx3);
  await sème(p3, base, [regateSemee('nov', 'Régate de novembre', '2026-11-07', '2026-11-09')]);
  await ongletTraces(p3);
  await p3.setInputFiles('#gpxIn', GPX_SNPM);
  await p3.waitForSelector('#modal [data-rn]', { timeout: 90000 });
  await p3.click('#modal [data-rn]');
  await p3.waitForSelector('#trReg', { timeout: 60000 });
  assert.match(await p3.locator('#trReg').textContent(), /Sans régate/);
  await p3.waitForTimeout(1000);
  assert.equal(await p3.locator('#dqWind').count(), 0, 'aucun questionnaire');
  assert.equal((await indexRegates(p3)).list.flatMap((r) => r.traces).length, 0);
  sansErreur(e3, 'laisser sans régate');
  await ctx3.close();
}

// REG-03 (vérité 2 du plan 03-05) : l'ancien formulaire de fiche IC n'existe plus ; sans aucune régate, importer un PDF d'IC ouvre quand même
// la relecture champ par champ et « Valider les IC » crée la régate depuis les IC (nom, dates, heures, VHF)
async function depuisIC({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });        // lundi 19/10/2026 10 h 30 à Paris
  const { page, erreurs } = await ouvrePage(ctx);
  const sansAncien = async (quand) => {
    assert.equal(await page.locator('#evSave, #evSel, #evForm').count(), 0, `ancien formulaire ou sélecteur de fiches visible ${quand}`);
  };
  await sème(page, base, []);                                  // index vide : { v: 1, list: [] }, aucune clé rade.events.v1
  assert.equal(await page.evaluate(() => localStorage.getItem('rade.events.v1')), null, 'aucune clé rade.events.v1 au départ');
  assert.deepEqual(await indexRegates(page), { v: 1, list: [] }, 'index vide conservé');
  await page.click('#tabs button[data-tab=ic]');
  assert.match(await page.locator('#tabs button[data-tab=ic]').textContent(), /^Régates$/, 'l’onglet s’appelle « Régates »');
  await sansAncien('à l’ouverture de l’onglet');
  assert.equal(await page.locator('section[data-tab=ic] .rg').count(), 0, 'aucune régate dans la liste');

  await importeIC(page);                                             // sans régate courante : la relecture s'ouvre quand même
  assert.equal(await page.locator('#icValidate').count(), 1, '« Valider les IC » présent');
  const rel = await lireRelecture(page);
  assert.equal(rel.firstWarning.valeur, '10:55'); assert.match(rel.firstWarning.extrait, /10h55/, 'extrait de « 10h55 » affiché');
  await sansAncien('pendant la relecture');
  assert.deepEqual((await indexRegates(page)).list, [], 'rien n’entre avant « Valider les IC »');
  const nom = rel.event.valeur;
  assert.ok(nom.length > 3, 'le nom de la régate est lu dans les IC');

  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  await sansAncien('après la validation');
  const idx = await indexRegates(page);
  assert.equal(idx.list.length, 1, 'une régate créée depuis les IC');
  const r = idx.list[0];
  assert.equal(await idOuverte(page), r.id, 'elle devient la régate ouverte');
  assert.equal(r.name, nom, 'au nom lu dans les IC'); assert.equal(r.dateStart, '2026-10-18'); assert.equal(r.season, '2026');
  assert.ok(r.ic.validated && typeof r.ic.validated.at === 'number', 'IC validées');
  assert.equal(r.ic.fields.vhf, 72); assert.equal(r.ic.fields.firstWarning, '10:55');
  const liste = await lireListe(page);
  assert.equal(liste.length, 1); assert.match(liste[0].rows[0].text, /2026/, 'l’année reste lisible dans la ligne');
  assert.deepEqual(liste.map((g) => g.status), ['Terminées'], 'le 18/10 est passé le 19/10');
  assert.equal(liste[0].rows[0].name, nom); assert.ok(liste[0].rows[0].open);

  // après relance : cette seule régate, aucune ancienne fiche, rade.events.v1 toujours absente
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=ic]');
  await sansAncien('après la relance');
  const apres = await lireListe(page);
  assert.equal(apres.flatMap((g) => g.rows).length, 1, 'une seule régate après relance');
  assert.equal(await idOuverte(page), '', 'après relance : entraînement libre, la régate est terminée');
  assert.equal((await indexRegates(page)).list.length, 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('rade.events.v1')), null, 'rade.events.v1 n’existe toujours pas');
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

// ───────────────────────── lecture des IC d'un autre club par l'IA (plan 03-06)

// Texte fabriqué d'un autre club (D-06 : aucun PDF réel d'un autre club) : même forme que les IC SNPM, club renommé, « 10:30 », « VHF 69 »
const TEXTE_AUTRE_CLUB = `Instructions de Course

Coupe de la Société Nautique de Marseille Sud

dimanche 18 octobre 2026

5. PROGRAMME DES COURSES dimanche 18 octobre 2026

5.1 Heure du premier signal d’avertissement : 10:30

5.2 Heure limite du signal d’arrivée du premier : 16:00

7. DEFINITION DE L’EMPLACEMENT DE LA ZONE DE COURSE

de la rade de Marseille, au large de la Pointe Rouge

17.3 Canal de vacation Radio : VHF 69

Président du comité de course : Marie DUPONT

Téléphone ou sms : 06 12 34 56 78

Tout concurrent qui abandonne doit en informer le comité de course sur le canal VHF dans les plus brefs délais.

Le port du gilet de sauvetage est obligatoire pendant toute la durée de la course sur Marseille.
`;
const importeTexte = async (page, texte, nom = 'ic-autre-club.txt') => {
  await page.setInputFiles('#icFile', { name: nom, mimeType: 'text/plain', buffer: Buffer.from(texte, 'utf8') });
  await page.waitForSelector('#icReview', { timeout: 60000 });
};

// Sert POST /api/ic avec la VRAIE fonction serveur (api/ic.js, vérification mot pour mot comprise) et un client OpenAI simulé : aucun réseau, aucune clé réelle.
// `sortie(texteEnvoye)` rend ce que dirait le modèle. Rend l'état observé : demandes reçues, corps, arguments donnés au client simulé.
const PRENOM_IA = 'Teiva';                                    // prénom de test posé comme le ferait le middleware
async function serviaIA(ctx, sortie) {
  const { createHandler } = await import('../api/ic.js');
  process.env.OPENAI_API_KEY ||= 'cle-de-test';
  const etat = { demandes: [], corps: [], enTetes: [], client: [] };
  const client = { responses: { create: async (args) => { etat.client.push(args); return { status: 'completed', output_text: JSON.stringify(sortie(args.input)) }; } } };
  const handler = createHandler({ openai: client });
  await ctx.route('**/api/ic', async (route) => {
    const req = route.request();
    etat.demandes.push(req.method());
    const corps = JSON.parse(req.postData() || 'null');
    etat.corps.push(corps); etat.enTetes.push(req.headers());
    const out = { code: 200, body: null, status(c) { out.code = c; return out; }, json(b) { out.body = b; return out; }, setHeader() { return out; } };
    // le middleware pose le prénom de l’équipier sur toute demande /api/ (api/_ia.js ne compte que sous ce prénom)
    await handler({ method: req.method(), headers: { ...req.headers(), 'x-rt-membre': encodeURIComponent(PRENOM_IA) }, body: corps }, out);
    await route.fulfill({ status: out.code, contentType: 'application/json', body: JSON.stringify(out.body) });
  });
  return etat;
}
const vide = () => ({ value: null, excerpt: null });
const sortieIA = (surcharge) => ({
  event: vide(), club: vide(), dateStart: vide(), dateEnd: vide(), firstWarning: vide(), lastFinish: vide(), vhf: vide(), committee: vide(), zone: vide(),
  startLine: vide(), finishLine: vide(), penalty: vide(), races: [], marks: [], courses: [], specialRules: [], ...surcharge,
});
// Extrait copié du texte reçu par le « modèle » (la première occurrence de l'expression)
const copie = (input, re) => { const m = re.exec(input); if (!m) throw new Error('extrait introuvable dans le texte de test : ' + re); return m[0]; };

// REG-03 (autre club, D-01, D-02) : « Lire avec l'IA » sur geste ; les valeurs prouvées reviennent avec leur extrait, l'invention est vidée et signalée ; rien sans validation
async function ia({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });        // lundi 19/10/2026 10 h 30 à Paris
  const { page, erreurs } = await ouvrePage(ctx);
  const etat = await serviaIA(ctx, (input) => sortieIA({
    event: { value: 'Coupe de la Société Nautique de Marseille Sud', excerpt: copie(input, /Coupe de la Société Nautique de Marseille Sud/) },
    dateStart: { value: '2026-10-18', excerpt: copie(input, /dimanche 18 octobre 2026/) },
    firstWarning: { value: '10:30', excerpt: copie(input, /Heure du premier signal d’avertissement : 10:30/) },
    lastFinish: { value: '16:00', excerpt: copie(input, /Heure limite du signal d’arrivée du premier : 16:00/) },
    vhf: { value: '69', excerpt: copie(input, /Canal de vacation Radio : VHF 69/) },
    committee: { value: 'Jean MARTIN', excerpt: 'Président du comité de course : Jean MARTIN' },           // extrait inventé : le texte dit Marie DUPONT
    zone: { value: 'au large de la Pointe Rouge', excerpt: copie(input, /de la rade de Marseille, au large de la Pointe Rouge/) },
  }));
  await ouvreApp(page, base);
  await creeRegate(page, { nom: 'Régate autre club', debut: '2026-10-19', club: 'SNM' });
  await importeTexte(page, TEXTE_AUTRE_CLUB);
  assert.equal(etat.demandes.length, 0, 'rien n’est envoyé à l’import : seul le geste « Lire avec l’IA » envoie');
  let rel = await lireRelecture(page);
  assert.match(rel.committee.valeur, /Marie DUPONT/, 'la lecture par motifs a lu le Comité avant l’IA');
  const bouton = page.locator('#icIa');
  assert.equal(await bouton.count(), 1, 'bouton « Lire avec l’IA » dans la relecture d’un fichier importé');
  assert.match(await bouton.textContent(), /Lire avec l’IA \(le texte part chez OpenAI\)/);

  await bouton.click();
  await page.waitForFunction(() => document.querySelector('#icReview')?.textContent.includes('lecture par l’IA (OpenAI)'), null, { timeout: 30000 });
  assert.equal(etat.demandes.length, 1, 'un seul appel par geste');
  assert.deepEqual(Object.keys(etat.corps[0]), ['text'], 'le corps ne porte que le texte des IC');
  assert.ok(!JSON.stringify(etat.client).match(/cookie|rt_acces/i), 'rien de la requête ne part chez OpenAI');
  assert.equal(etat.client[0].text.format.strict, true);
  assert.equal(etat.client[0].store, false, 'store: false part avec l’appel');
  rel = await lireRelecture(page);
  assert.equal(rel.firstWarning.valeur, '10:30'); assert.match(rel.firstWarning.extrait, /^Extrait : .*10:30/);
  assert.equal(rel.vhf.valeur, '69'); assert.match(rel.vhf.extrait, /VHF 69/);
  assert.equal(rel.dateStart.valeur, '2026-10-18'); assert.match(rel.dateStart.extrait, /18 octobre 2026/);
  assert.equal(rel.committee.valeur, '', 'extrait inventé : la valeur du modèle n’est jamais affichée');
  assert.match(rel.committee.puceTexte, /extrait introuvable dans le texte/);
  assert.match(rel.committee.puce, /\bmid\b/);
  assert.doesNotMatch(await page.locator('#icReview').textContent(), /Jean MARTIN/, 'la valeur inventée n’apparaît nulle part');
  assert.match(rel.firstWarning.puce, /\bgood\b/, 'mêmes puces de vraisemblance que la lecture CVAT');
  assert.equal(await page.locator('#icIa').count(), 0, 'plus de bouton une fois la lecture IA faite');
  // la lecture n'a rien retenu
  assert.equal((await regateOuverte(page)).ic, null, 'rien n’entre avant « Valider les IC »');
  assert.match(await page.locator('#icVal').textContent(), /Pas encore d’IC validées/);

  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg = await regateOuverte(page);
  assert.equal(reg.ic.read, 'ia'); assert.equal(typeof reg.ic.validated.at, 'number');
  assert.equal(reg.ic.fields.vhf, 69); assert.equal(reg.ic.fields.firstWarning, '10:30'); assert.equal(reg.ic.fields.committee, '');
  assert.match(reg.ic.excerpts.firstWarning, /10:30/);
  assert.match(await page.locator('#icVal').textContent(), /^IC validées.* le \d\d\/\d\d \(lecture par l’IA\)$/);
  assert.equal(etat.demandes.length, 1, 'aucun autre appel');
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

// D-03 : l'IA seulement quand il le faut, avec le réseau et sur geste ; toute erreur laisse la relecture manuelle ; une manche vérifiée entre, une inventée jamais
async function iaErreurs({ browser, base }) {
  const texteIC = (page) => page.locator('#icReview').textContent();
  const etatBouton = (page) => page.evaluate(() => { const b = document.querySelector('#icIa'); return b ? { desactive: b.disabled, msg: document.querySelector('#icIaMsg')?.textContent ?? '' } : null; });
  const journal = async (page) => { await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); return page.evaluate(() => localStorage.getItem('rade.diag.v1') || ''); };

  // 1) IC CVAT bien lues : pas de bouton ; autre club : bouton, inactif hors réseau, de nouveau actif au retour du réseau ; texte mince : inactif ; aucun appel sans geste
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });
  let appels = 0;
  await ctx.route('**/api/ic', (route) => { appels++; return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"inattendu"}' }); });
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await creeRegate(page, { nom: 'Régate sans IA', debut: '2026-10-19', club: 'CVAT' });
  await importeIC(page);
  assert.equal(await page.locator('#icIa').count(), 0, 'IC CVAT bien lues : aucun bouton « Lire avec l’IA »');
  assert.match((await lireRelecture(page)).firstWarning.valeur, /10:55/);
  await page.click('#icCancel');
  await importeTexte(page, TEXTE_AUTRE_CLUB);
  let b = await etatBouton(page);
  assert.deepEqual(b && { desactive: b.desactive, msg: b.msg }, { desactive: false, msg: '' }, 'autre club en ligne : bouton actif');
  await ctx.setOffline(true);
  await page.waitForFunction(() => document.querySelector('#icIa')?.disabled === true, null, { timeout: 15000 });
  assert.equal((await etatBouton(page)).msg, 'Lecture IA indisponible hors réseau : importez les IC avant la régate');
  await page.fill('#icf-zone', 'Zone saisie hors réseau');                       // la relecture manuelle reste utilisable
  assert.equal(await page.locator('#icValidate').isEnabled(), true);
  await ctx.setOffline(false);
  await page.waitForFunction(() => document.querySelector('#icIa')?.disabled === false, null, { timeout: 20000 });
  assert.equal((await etatBouton(page)).msg, '', 'réseau revenu : bouton de nouveau actif, sans message');
  await page.click('#icCancel');
  await importeTexte(page, 'Texte trop court pour être des instructions de course.');
  b = await etatBouton(page);
  assert.deepEqual(b && { desactive: b.desactive, msg: b.msg }, { desactive: true, msg: 'PDF sans texte : saisissez la fiche à la main' });
  assert.equal(appels, 0, 'aucun appel à /api/ic sans le geste de l’équipier');
  sansErreur(erreurs, 'sans geste');
  await ctx.close();

  // 2) erreurs : un message français par cause, la relecture manuelle intacte et validable, rien du texte des IC dans le journal
  const ctx2 = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });
  const reponse = { statut: 503, corps: '{"error":"no_key"}', abandon: false };
  await ctx2.route('**/api/ic', (route) => (reponse.abandon ? route.abort('failed') : route.fulfill({ status: reponse.statut, contentType: 'application/json', body: reponse.corps })));
  const { page: p2, erreurs: e2 } = await ouvrePage(ctx2);
  await ouvreApp(p2, base);
  await creeRegate(p2, { nom: 'Régate erreurs IA', debut: '2026-10-19', club: 'SNM' });
  await importeTexte(p2, TEXTE_AUTRE_CLUB);
  const essaie = async (attendu, quand) => {
    await p2.click('#icIa');
    await p2.waitForFunction((t) => document.querySelector('#icIaMsg')?.textContent === t, attendu, { timeout: 20000 });
    assert.equal(await p2.locator('#icIa').isEnabled(), true, `${quand} : on peut réessayer`);
    assert.equal(await p2.locator('#icValidate').isEnabled(), true, `${quand} : la relecture manuelle reste validable`);
  };
  await essaie('Lecture IA indisponible sur ce déploiement (clé OpenAI absente)', 'clé absente');
  await p2.fill('#icf-zone', 'Rade corrigée à la main');                           // modifiable après l'échec
  Object.assign(reponse, { statut: 502, corps: '{"error":"réponse tronquée : réessayez"}' });
  await essaie('Réponse tronquée ou refusée : réessayez, ou saisissez à la main', 'réponse tronquée');
  Object.assign(reponse, { statut: 401, corps: '{"error":"acces"}' });
  await essaie('Accès refusé : rouvrez l’app avec votre code', 'accès refusé');
  Object.assign(reponse, { statut: 400, corps: '{"error":"texte des IC manquant ou trop court"}' });
  await essaie('Texte des IC trop court', 'texte court');
  Object.assign(reponse, { statut: 429, corps: JSON.stringify({ error: 'quota_equipier', message: 'Limite d’IA du jour atteinte — reprise demain' }) });
  await essaie('Limite d’IA du jour atteinte — reprise demain', 'quota du jour');
  Object.assign(reponse, { statut: 429, corps: JSON.stringify({ error: 'budget_ia', message: 'Budget d’IA du mois atteint — l’IA reprend le mois prochain' }) });
  await essaie('Budget d’IA du mois atteint — l’IA reprend le mois prochain', 'budget du mois');
  reponse.abandon = true;
  await essaie('Pas de réseau : la lecture IA se fait avant la régate', 'réseau coupé');
  assert.equal((await lireRelecture(p2)).zone.valeur, 'Rade corrigée à la main', 'les échecs n’ont rien changé à la saisie');
  const j = await journal(p2);
  assert.ok(j.includes('ic-ia'), 'chaque échec est consigné au journal');
  assert.ok(!/DUPONT|PROGRAMME|Pointe Rouge|Marseille/.test(j), 'jamais le texte des IC dans le journal');
  await p2.click('#icValidate');
  await p2.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg2 = await regateOuverte(p2);
  assert.equal(reg2.ic.read, 'motifs'); assert.equal(reg2.ic.fields.zone, 'Rade corrigée à la main'); assert.equal(reg2.ic.fields.vhf, 69);
  sansErreur(e2, 'avec les erreurs');
  await ctx2.close();

  // 3) manches lues par l'IA : la vérifiée est cochée et ajoutée sans parcours, l'inventée est grisée et jamais ajoutée
  const ctx3 = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });
  const etat = await serviaIA(ctx3, (input) => sortieIA({
    dateStart: { value: '2026-10-18', excerpt: copie(input, /dimanche 18 octobre 2026/) },
    firstWarning: { value: '10:30', excerpt: copie(input, /Heure du premier signal d’avertissement : 10:30/) },
    races: [
      { date: '2026-10-18', warning: '10:30', label: 'Manche 1', excerpt: copie(input, /dimanche 18 octobre 2026\s+5\.1 Heure du premier signal d’avertissement : 10:30/) },
      { date: '2026-10-18', warning: '14:00', label: 'Manche 2', excerpt: 'Seconde manche à 14h00 sur le parcours long' },
    ],
    specialRules: [
      { value: 'Abandon', excerpt: copie(input, /Tout concurrent qui abandonne doit en informer le comité de course/) },
      { value: 'Règle inventée', excerpt: 'Le port du casque est obligatoire pour tous' },
    ],
  }));
  const { page: p3, erreurs: e3 } = await ouvrePage(ctx3);
  await ouvreApp(p3, base);
  await creeRegate(p3, { nom: 'Régate manches IA', debut: '2026-10-19', club: 'SNM' });
  await importeTexte(p3, TEXTE_AUTRE_CLUB);
  await p3.click('#icIa');
  await p3.waitForSelector('.icrace', { timeout: 30000 });
  assert.equal(etat.demandes.length, 1);
  assert.equal(await p3.locator('.icrace').count(), 2);
  assert.equal(await p3.locator('input[data-rc]:checked').count(), 1, 'une seule manche cochée');
  assert.match(await p3.locator('.icrace').nth(0).textContent(), /10:30[\s\S]*Manche 1[\s\S]*Extrait/);
  assert.match(await p3.locator('.icrace.icoff').textContent(), /Manche 2/);
  assert.equal(await p3.locator('.icrace.icoff input').isDisabled(), true);
  assert.equal(await p3.locator('input[data-kr]:checked').count(), 1, 'une seule règle particulière cochée');
  assert.equal(await p3.locator('.icrule.icoff input[data-kr]').isDisabled(), true);
  assert.equal((await regateOuverte(p3)).races.length, 0, 'rien n’entre avant « Valider les IC »');
  await p3.click('#icValidate');
  await p3.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg3 = await regateOuverte(p3);
  assert.equal(reg3.ic.read, 'ia');
  assert.equal(reg3.races.length, 1, 'la manche vérifiée seulement');
  assert.deepEqual([reg3.races[0].date, reg3.races[0].time, reg3.races[0].courseId], ['2026-10-18', '10:30', null]);
  assert.deepEqual(reg3.ic.fields.keyRules, ['Tout concurrent qui abandonne doit en informer le comité de course'], 'seule la règle vérifiée entre');
  assert.match(await p3.locator('#rgSheet .rgrace').textContent(), /Manche 1[\s\S]*10:30[\s\S]*parcours à préciser/);
  sansErreur(e3, 'manches lues');
  await ctx3.close();
}

// SECU2-01 (D-05, D-06, D-07) : l'arbitre de poche borné de bout en bout. Page des règles → VRAIE fonction api/rules.js → faux Blob → client OpenAI simulé.
// Faux Blob et client simulé : aucune clé réelle, aucun réseau ; on observe ce qui part chez « OpenAI » (store: false) et le compteur du jour.
async function arbitre({ browser, base }) {
  const { createHandler } = await import('../api/rules.js');
  const { cheminQuota, prefix, MESSAGES } = await import('../api/_ia.js');
  const { createFakeBlob, invoke } = await import('../tests/helpers/fakeblob.mjs');
  process.env.OPENAI_API_KEY ||= 'cle-de-test';
  const HEURE = '2026-10-21T08:00:00Z';
  const blob = createFakeBlob(), appels = [];
  const verdict = 'B doit s’écarter : il est sous le vent';
  const client = { responses: { create: async (args) => { appels.push(args); return { status: 'completed', output_text: JSON.stringify({ verdict, explication: 'Bâbord amures doit s’écarter.', regles: [], ic: '', attention: '' }) }; } } };
  const handler = createHandler({ openai: client, blob, now: () => Date.parse(HEURE) });
  const chemin = cheminQuota(prefix(), PRENOM_IA, Date.parse(HEURE));
  const compteur = () => blob.store.get(chemin)?.text;

  const ctx = await ouvreContexte(browser, { heure: HEURE });
  await ctx.route('**/api/rules', async (route) => {
    const req = route.request();
    const r = await invoke(handler, { method: req.method(), url: '/api/rules', body: JSON.parse(req.postData() || 'null'), headers: { 'x-rt-membre': encodeURIComponent(PRENOM_IA) } });
    await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body ?? null) });
  });
  const { page, erreurs } = await ouvrePage(ctx);
  await page.goto(base + 'regles.html', { waitUntil: 'load' });
  const questionne = async (q) => {
    await page.fill('#chatIn', q);
    await page.click('#chatGo');
    await page.waitForFunction(() => !document.querySelector('#chatGo').disabled, null, { timeout: 15000 });
  };

  // (a) une question : le verdict s'affiche, OpenAI reçoit store: false, le compteur du jour vaut 1
  await questionne('Bâbord ou tribord, qui passe ?');
  await page.waitForSelector('#chatLog .msg.bot .verdict', { timeout: 10000 });
  assert.equal(await page.locator('#chatLog .msg.bot .verdict').last().textContent(), verdict);
  assert.equal(appels.length, 1, 'un appel chez OpenAI');
  assert.equal(appels[0].store, false, 'store: false part avec chaque appel');
  assert.equal(compteur(), '{"n":1}', 'le compteur de l’équipier vaut 1');

  // (b) 30 appels déjà faits aujourd'hui : le message du quota s'affiche tel quel, sans appel chez OpenAI ni nouvelle écriture
  await blob.put(chemin, '{"n":30}', { access: 'private', contentType: 'application/json', allowOverwrite: true });
  const puts = blob.ops.put;
  await questionne('Et si je suis engagé à la marque ?');
  assert.equal(await page.locator('#chatLog .msg.err').last().textContent(), 'Limite d’IA du jour atteinte — reprise demain');
  assert.equal(MESSAGES.quota_equipier, 'Limite d’IA du jour atteinte — reprise demain');
  assert.equal(appels.length, 1, 'le 31e appel ne part pas chez OpenAI');
  assert.equal(blob.ops.put, puts, 'ni écriture de plus');
  assert.equal(compteur(), '{"n":30}');

  // (c) compteur en panne : l'arbitre répond quand même (le serveur écrit un avertissement, capté ici)
  await blob.put(chemin, '{"n":0}', { access: 'private', contentType: 'application/json', allowOverwrite: true });
  blob.failNext(new Error('panne du magasin'), { op: 'get' });
  const avertissements = [], avertir = console.warn;
  console.warn = (...a) => { avertissements.push(a.join(' ')); };
  try { await questionne('Et au départ, avant le signal ?'); } finally { console.warn = avertir; }
  await page.waitForFunction((n) => document.querySelectorAll('#chatLog .msg.bot .verdict').length === n, 2, { timeout: 10000 });
  assert.equal(appels.length, 2, 'le compteur en panne n’empêche pas l’appel');
  assert.equal(avertissements.length, 1, 'un avertissement côté serveur');
  assert.ok(!/Teiva|cle-de-test|Et au départ/i.test(avertissements[0]), 'ni prénom, ni clé, ni texte dans l’avertissement');
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

// ───────────────────────── bouées et parcours d'un autre club « à confirmer » (plan 03-07, D-04, REG-04)

// Texte fabriqué (D-06) : deux bouées dans la rade (Alpha en degrés-minutes, Bravo en décimal), une sans position lisible (Charlie) et un parcours A
const TEXTE_BOUEES = `${TEXTE_AUTRE_CLUB}
ANNEXE : MARQUES ET PARCOURS

Bouée Alpha : 43°05,845' N – 005°56,049' E

Bouée Bravo : 43,0905 N ; 5,9587 E

Bouée Charlie : au large de la Pointe Rouge, position donnée par le Comité

Parcours A : départ, Alpha bâbord, Bravo bâbord, arrivée
`;

// REG-04 : les bouées et parcours lus par l'IA sont « à confirmer » (X1 ? sur la carte) et n'entrent ni dans les marques ni dans les parcours avant confirmation
async function bouees({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });        // lundi 19/10/2026 10 h 30 à Paris
  // les étiquettes dessinées sur la carte (texte de chaque sprite) sont relevées pour vérifier « X1 ? »
  await ctx.addInitScript(() => {
    window.__labels = [];
    const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t) { window.__labels.push(String(t)); return f.apply(this, arguments); };
  });
  await simuleMembre(ctx, 'Équipier test');                                       // le prénom signe la lecture et la confirmation
  const etat = await serviaIA(ctx, (input) => sortieIA({
    event: { value: 'Coupe de la Société Nautique de Marseille Sud', excerpt: copie(input, /Coupe de la Société Nautique de Marseille Sud/) },
    dateStart: { value: '2026-10-18', excerpt: copie(input, /dimanche 18 octobre 2026/) },
    marks: [
      { name: 'Alpha', position: copie(input, /43°05,845. N . 005°56,049. E/), excerpt: copie(input, /Bouée Alpha : 43°05,845. N . 005°56,049. E/) },
      { name: 'Bravo', position: copie(input, /43,0905 N ; 5,9587 E/), excerpt: copie(input, /Bouée Bravo : 43,0905 N ; 5,9587 E/) },
      { name: 'Charlie', position: 'au large de la Pointe Rouge', excerpt: copie(input, /Bouée Charlie : au large de la Pointe Rouge, position donnée par le Comité/) },
    ],
    courses: [{ name: 'Parcours A', excerpt: copie(input, /Parcours A : départ, Alpha bâbord, Bravo bâbord, arrivée/), sequence: [{ mark: 'Départ', side: null }, { mark: 'Alpha', side: 'b' }, { mark: 'Bravo', side: 'b' }, { mark: 'Arrivée', side: null }] }],
  }));
  const { page, erreurs } = await ouvrePage(ctx);
  // les tables réelles de la page (même module que l'app)
  const tables = () => page.evaluate(async () => { const m = await import('/js/courses.js'); return { marks: Object.keys(m.MARKS), courses: m.COURSES.map((c) => `${c.id}:${c.title}`) }; });
  const parcours = async () => { await page.click('#tabs button[data-tab=course]'); const l = await page.locator('#cSel option').allTextContents(); await page.click('#tabs button[data-tab=ic]'); return l; };
  const etatApp = () => page.evaluate(() => JSON.parse(localStorage.getItem('rade.state')));
  const CVAT = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

  await ouvreApp(page, base);
  await membreGarde(page, 'Équipier test');
  await creeRegate(page, { nom: 'Régate bouées', debut: '2026-10-19', club: 'SNM' });
  const idPremiere = (await regateOuverte(page)).id;
  await importeTexte(page, TEXTE_BOUEES);
  await page.click('#icIa');
  await page.waitForSelector('.icmark', { timeout: 30000 });
  assert.equal(etat.demandes.length, 1, 'un seul appel');
  // relecture : bouées lues, conversion en degrés-minutes, puces, extraits ; Charlie illisible non cochée ; le parcours A coché
  const marques = await page.locator('.icmark').evaluateAll((l) => l.map((el) => ({ txt: el.textContent, coche: el.querySelector('input').checked, puce: el.querySelector('.chip')?.className ?? '' })));
  assert.equal(marques.length, 3);
  assert.match(marques[0].txt, /Alpha · 43°05\.845N 005°56\.049E/); assert.equal(marques[0].coche, true); assert.match(marques[0].puce, /\bgood\b/);
  assert.match(marques[0].txt, /Extrait : « Bouée Alpha/);
  assert.match(marques[1].txt, /Bravo · 43°05\.430N 005°57\.522E/); assert.equal(marques[1].coche, true);
  assert.match(marques[2].txt, /Charlie · position à saisir/); assert.equal(marques[2].coche, false, 'position illisible : non cochée par défaut'); assert.match(marques[2].puce, /\bmid\b/);
  assert.match(await page.locator('.iccourse').textContent(), /Parcours A : Départ → Alpha bâbord → Bravo bâbord → Arrivée/);
  assert.equal(await page.locator('.iccourse input').isChecked(), true);
  // décocher Bravo décoche le parcours (il en dépend), le recocher ne le recoche pas tout seul
  await page.uncheck('input[data-mk="1"]');
  assert.equal(await page.locator('.iccourse input').isChecked(), false); assert.equal(await page.locator('.iccourse input').isDisabled(), true);
  await page.check('input[data-mk="1"]');
  assert.equal(await page.locator('.iccourse input').isDisabled(), false); await page.check('.iccourse input');
  await page.check('input[data-mk="2"]');                                        // Charlie : retenue malgré tout, « position à saisir »
  assert.deepEqual(((await regateOuverte(page)).marks || []), [], 'rien n’entre avant « Valider les IC »');
  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });

  // fiche : trois bouées à confirmer, un parcours en attente ; rien dans les tables ni dans l'onglet Parcours
  const reg = await regateOuverte(page);
  assert.deepEqual(reg.marks.map((m) => [m.id, m.name, m.status]), [['X1', 'Alpha', 'a_confirmer'], ['X2', 'Bravo', 'a_confirmer'], ['X3', 'Charlie', 'a_confirmer']]);
  assert.equal(reg.marks[0].by, 'Équipier test'); assert.match(reg.marks[0].excerpt, /Bouée Alpha/); assert.equal(reg.marks[0].src, 'IC SNM');
  assert.deepEqual([reg.marks[0].lat, reg.marks[0].lon, reg.marks[1].lat, reg.marks[1].lon, reg.marks[2].lat], [43.097417, 5.93415, 43.0905, 5.9587, null]);
  assert.equal(reg.courses.length, 1); assert.equal(reg.courses[0].id, 101);
  const ligne = (id) => page.locator(`#rgSheet [data-mk-row=${id}]`);
  assert.equal((await ligne('X1').locator('.rgdn').textContent()).trim(), 'X1 Alpha ?');
  assert.equal((await ligne('X2').locator('.rgdn').textContent()).trim(), 'X2 Bravo ?');
  assert.match(await ligne('X3').textContent(), /position à saisir/);
  assert.equal(await ligne('X3').locator('[data-mk-ok]').count(), 0, 'position à saisir : rien à confirmer');
  assert.match(await page.locator('#rgSheet [data-co-row="101"]').textContent(), /Parcours A \(IC\)[\s\S]*en attente de : X1 Alpha, X2 Bravo/);
  await page.waitForFunction(() => window.__labels.includes('X1 ?') && window.__labels.includes('X2 ?'), null, { timeout: 30000 });
  assert.ok((await page.evaluate(() => window.__labels)).includes('Alpha · à confirmer'), '« X1 ? » et « Alpha · à confirmer » dessinés sur la carte');
  let t = await tables();
  assert.deepEqual(t.marks, CVAT, 'aucune bouée à confirmer dans la table des marques (routage, mode départ, débrief)');
  assert.ok(!t.courses.some((c) => /^10\d:/.test(c)), 'aucun parcours lu dans la table');
  assert.ok(!(await parcours()).some((x) => /\(IC\)/.test(x)), 'l’onglet Parcours ne propose pas « Parcours A (IC) »');

  // Corriger la position : hors rade refusée ; plus de 2 Nq demande confirmation ; la bouée reste à confirmer
  await page.click('[data-mk-fix=X1]');
  await page.fill('#mkxTxt', '48°51.400N 002°21.100E'); await page.click('#mkxOk');
  assert.match(await page.locator('#mkxErr').textContent(), /hors de la rade/i);
  await page.fill('#mkxTxt', '43°02.000N 006°05.000E'); await page.click('#mkxOk');
  assert.match(await page.locator('#mkxOk').textContent(), /^Confirmer : déplacement de \d/);
  await page.click('#mkxOk');
  await page.waitForSelector('#mkxTxt', { state: 'detached', timeout: 10000 });
  assert.match(await ligne('X1').textContent(), /43°02\.000N 006°05\.000E[\s\S]*position corrigée/);
  assert.match(await ligne('X1').locator('.chip').textContent(), /à confirmer/);
  await page.click('[data-mk-fix=X1]');                                          // retour à la position du texte (plus de 2 Nq : confirmation de nouveau)
  await page.fill('#mkxTxt', "43°05.845N 005°56.049E"); await page.click('#mkxOk'); await page.click('#mkxOk');
  await page.waitForSelector('#mkxTxt', { state: 'detached', timeout: 10000 });
  assert.match(await ligne('X1').textContent(), /43°05\.845N 005°56\.049E/);
  await page.click('[data-mk-fix=X3]');                                          // Charlie : « Saisir la position », sans distance de référence
  await page.fill('#mkxTxt', '43,0910 ; 5,9500'); await page.click('#mkxOk');
  await page.waitForSelector('#mkxTxt', { state: 'detached', timeout: 10000 });
  assert.match(await ligne('X3').textContent(), /43°05\.460N 005°57\.000E/);
  assert.equal(await ligne('X3').locator('[data-mk-ok]').count(), 1, 'une fois saisie, elle se confirme');
  t = await tables();
  assert.deepEqual(t.marks, CVAT, 'corriger ne fait rien servir');

  // Confirmer Alpha : la bouée entre sous X1 ; le parcours reste absent (Bravo n'est pas confirmée)
  await page.click('[data-mk-ok=X1]');
  assert.equal((await ligne('X1').locator('.rgdn').textContent()).trim(), 'X1 Alpha');
  assert.match(await ligne('X1').textContent(), /Confirmée par Équipier test le 19\/10/, 'qui a confirmé, et quand');
  t = await tables();
  assert.deepEqual(t.marks, [...CVAT, 'X1'], 'seule Alpha est entrée');
  assert.ok(!(await parcours()).some((x) => /\(IC\)/.test(x)), 'toujours absent : Bravo reste à confirmer');
  const apresAlpha = await regateOuverte(page);
  assert.equal(apresAlpha.marks[0].status, 'confirmee'); assert.equal(typeof apresAlpha.marks[0].confirmed.at, 'number'); assert.equal(apresAlpha.marks[0].confirmed.by, 'Équipier test');

  // Confirmer Bravo : le parcours est proposé
  await page.click('[data-mk-ok=X2]');
  t = await tables();
  assert.deepEqual(t.marks, [...CVAT, 'X1', 'X2'], 'X3 (Charlie) n’est jamais entrée');
  assert.ok(t.courses.includes('101:Parcours A (IC)'));
  assert.ok((await parcours()).includes('Parcours A (IC)'), 'l’onglet Parcours propose « Parcours A (IC) »');
  assert.match(await page.locator('#rgSheet [data-co-row="101"]').textContent(), /proposé dans l’onglet Parcours/);

  // le choisir : l'analyse se fait avec les deux bouées confirmées, sans erreur de page
  await page.click('#tabs button[data-tab=course]');
  await page.selectOption('#cSel', '101');
  await page.waitForFunction(() => [...document.querySelectorAll('section[data-tab=course] .leg .hd')].some((e) => /X1 Alpha/.test(e.textContent)) && [...document.querySelectorAll('section[data-tab=course] .leg .hd')].some((e) => /X2 Bravo/.test(e.textContent)), null, { timeout: 90000 });
  assert.equal(await page.locator('section[data-tab=course] .leg').count(), 3, 'Alpha, Bravo, arrivée');
  assert.equal(await page.locator('section[data-tab=course] .leg .chip.mid').filter({ hasText: 'position à confirmer' }).count(), 0);
  assert.equal((await etatApp()).courseId, 101);
  sansErreur(erreurs, 'avec le parcours lu');

  // après relance : l'app repart en entraînement libre (la régate est du 18/10, passée) ; les bouées et le parcours de la régate ne sont pas injectés et le
  // parcours choisi revient au 3 AVANT tout calcul ; en rouvrant la régate (« Ouvrir »), bouées confirmées et parcours sont retrouvés, et le parcours se rechoisit
  await ouvreApp(page, base);
  assert.equal(await idOuverte(page), '', 'après relance : entraînement libre');
  assert.equal((await etatApp()).courseId, 3, 'le parcours de la régate n’est plus proposé sans la régate : retour au parcours 3');
  t = await tables();
  assert.deepEqual(t.marks, CVAT, 'sans régate ouverte, aucune bouée de régate');
  assert.ok(!t.courses.some((c) => /^10\d:/.test(c)));
  await ouvreRegate(page, idPremiere);
  t = await tables();
  assert.deepEqual(t.marks, [...CVAT, 'X1', 'X2'], 'régate rouverte : bouées confirmées retrouvées'); assert.ok(t.courses.includes('101:Parcours A (IC)'));
  await page.click('#tabs button[data-tab=course]');
  await page.selectOption('#cSel', '101');
  assert.equal((await etatApp()).courseId, 101);
  await page.waitForFunction(() => [...document.querySelectorAll('section[data-tab=course] .leg .hd')].some((e) => /X2 Bravo/.test(e.textContent)), null, { timeout: 90000 });
  sansErreur(erreurs, 'après la relance');

  // Ignorer (deux touches) : Charlie n'est plus proposée ; l'ignorée ne sert jamais
  await page.click('#tabs button[data-tab=ic]');
  await page.click('[data-mk-ign=X3]');
  assert.equal(await ligne('X3').locator('[data-mk-ign]').textContent(), 'Ignorer ?');
  await page.click('[data-mk-ign=X3]');
  assert.match(await ligne('X3').locator('.chip').textContent(), /ignorée/);
  assert.equal((await regateOuverte(page)).marks[2].status, 'ignoree');
  assert.equal(await ligne('X3').locator('button').count(), 0);

  // une autre régate : les bouées et le parcours de la précédente sont retirés, le parcours choisi redevient le 3
  await creeRegate(page, { nom: 'Autre régate', debut: '2026-10-20', club: 'CVAT' });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('rade.state')).courseId === 3, null, { timeout: 15000 });
  assert.match(await page.locator('#toast').textContent(), /Parcours A \(IC\) retiré \(bouées d’une autre régate/);
  t = await tables();
  assert.deepEqual(t.marks, CVAT, 'les bouées de la régate précédente sont retirées');
  assert.ok(!t.courses.some((c) => /^10\d:/.test(c)));
  assert.ok(!(await parcours()).some((x) => /\(IC\)/.test(x)), 'le parcours disparaît de la liste');
  await page.waitForFunction(() => [...document.querySelectorAll('section[data-tab=course] .leg .hd')].some((e) => /GR1|Grande Jetée/.test(e.textContent)), null, { timeout: 90000 });
  assert.equal((await page.locator('#cSel').inputValue()), '3', 'le parcours 3 est choisi');
  sansErreur(erreurs, 'après le changement de régate');

  // retour à la première : bouées confirmées réinjectées (le parcours choisi reste le 3), « Voir sur la carte » replie le panneau
  await page.click(`#tabs button[data-tab=ic]`);
  await page.click(`[data-rg="${idPremiere}"]`);
  t = await tables();
  assert.deepEqual(t.marks, [...CVAT, 'X1', 'X2']); assert.ok(t.courses.includes('101:Parcours A (IC)'));
  assert.equal((await etatApp()).courseId, 3);
  await page.click('[data-mk-voir=X2]');
  await page.waitForFunction(() => document.body.dataset.sheet === 'min', null, { timeout: 5000 });
  sansErreur(erreurs, 'à la fin du scénario');
  await ctx.close();
}

// ───────────────────────── archive partagée (ARCH-01, D-03, D-04) : deux téléphones, un faux Blob, la VRAIE fonction api/archive.js

// Le serveur travaille à l’heure fixée des téléphones (sinon il ramènerait leurs dates « futures » à sa propre heure) : `avanceHeure` règle les deux
async function mondeArchive(depart = '2026-11-07T08:30:00Z') {
  const { createHandler } = await import('../api/archive.js');
  const { createFakeBlob, invoke } = await import('../tests/helpers/fakeblob.mjs');
  const m = { t: Date.parse(depart), blob: createFakeBlob(), appels: {}, lourds: {}, ctxs: [], invoke };
  m.handler = createHandler({ blob: m.blob, now: () => m.t });
  return m;
}
async function avanceHeure(m, ms) { m.t += ms; for (const c of m.ctxs) await c.clock.setFixedTime(new Date(m.t)); }
// Un téléphone : contexte, prénom donné par le « middleware », route de l’archive (prénom encodé dans x-rt-membre) et décompte des requêtes vues par la page
async function telephoneArchive(browser, base, m, nom, opts = {}) {
  const ctx = await ouvreContexte(browser, { heure: new Date(m.t).toISOString(), ...opts });
  m.ctxs.push(ctx);
  await simuleMembre(ctx, nom);
  m.appels[nom] = 0; m.lourds[nom] = [];                      // lourds : les requêtes d'objets lourds (trace, rapport, jour), méthode et k
  await ctx.route('**/api/archive*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    m.appels[nom]++;
    if (req.method() === 'PUT') (m.puts ||= []).push(req.postData() || '');                // corps envoyés à l’archive, relus par les scénarios
    if (u.searchParams.get('k') !== 'light') m.lourds[nom].push(`${req.method()} ${u.searchParams.get('k')}`);
    const r = await m.invoke(m.handler, { method: req.method(), url: u.pathname + u.search, body: req.postData() ? JSON.parse(req.postData()) : undefined, headers: { 'x-rt-membre': encodeURIComponent(nom) } });
    await route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(r.body ?? null) });
  });
  const { page, erreurs } = await ouvrePage(ctx);
  const requetes = [];                                         // toute tentative vue par la page, même celle qu’un réseau coupé fait échouer
  page.on('request', (r) => { if (r.url().includes('/api/archive')) requetes.push(r.method()); });
  await ouvreApp(page, base);
  await membreGarde(page, nom);
  return { nom, ctx, page, erreurs, requetes };
}
const syncMeta = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rade.sync.v1') || '{}'));
const ligneSync = (page) => page.evaluate(() => document.querySelector('#rgSync')?.textContent ?? '');
// « Synchroniser » jusqu’à ce qu’un échange complet ait eu lieu à l’heure `m.t` : plus rien en attente et dernier succès daté de maintenant
async function synchronise(m, tel) {
  const fait = ([h]) => { const x = JSON.parse(localStorage.getItem('rade.sync.v1') || '{}'); return x.lastOkAt === h && !Object.keys(x.dirty || {}).length; };
  for (let i = 0; i < 12; i++) {
    await tel.page.click('#tabs button[data-tab=ic]');
    await tel.page.click('#rgSyncBtn');                      // sans effet pendant un échange déjà en cours : on retouche
    try { await tel.page.waitForFunction(fait, [m.t], { timeout: 2500, polling: 100 }); return; } catch { /* échange en cours ou refusé : nouvel essai */ }
  }
  throw new Error(`${tel.nom} : synchronisation non terminée (${await ligneSync(tel.page)}) ${JSON.stringify(await syncMeta(tel.page))} m.t=${m.t}`);
}
const noms = async (page) => (await lireListe(page)).flatMap((g) => g.rows.map((r) => r.name));

// ARCH-01 : la régate créée sur un téléphone apparaît sur l’autre, signée par le serveur
async function archive({ browser, base }) {
  const m = await mondeArchive();
  const A = await telephoneArchive(browser, base, m, 'Teiva'), B = await telephoneArchive(browser, base, m, 'Thibaud');
  await creeRegate(A.page, { nom: 'Régate partagée', debut: '2026-11-14', fin: '2026-11-15', club: 'CVAT' });
  await avanceHeure(m, 60e3);
  await synchronise(m, A);
  assert.match(await ligneSync(A.page), /^À jour \(essai\)$/, 'l’aperçu se dit « essai »');
  await avanceHeure(m, 60e3);
  await synchronise(m, B);
  assert.ok((await noms(B.page)).includes('Régate partagée'), 'la régate de A est chez B');
  assert.match(await B.page.locator('section[data-tab=ic] .rg', { hasText: 'Régate partagée' }).textContent(), /par Teiva/, 'auteur posé par le serveur');
  assert.match(await ligneSync(B.page), /^À jour/);

  // hors réseau, sur les deux : A crée une régate ; A et B ajoutent chacun une manche à la régate commune — aucune requête vers l’archive
  const vues = { A: A.requetes.length, B: B.requetes.length }, serveur = { ...m.appels };
  await A.ctx.setOffline(true); await B.ctx.setOffline(true);
  await A.page.waitForFunction(() => !navigator.onLine); await B.page.waitForFunction(() => !navigator.onLine);
  await creeRegate(A.page, { nom: 'Régate hors réseau', debut: '2026-11-14', club: 'CVAT' });
  await A.page.waitForFunction(() => /^Hors réseau · 1 modification en attente( \(essai\))?$/.test(document.querySelector('#rgSync')?.textContent ?? ''), null, { timeout: 10000 })
    .catch(async () => { throw new Error(`indicateur de A hors réseau : « ${await ligneSync(A.page)} » (méta ${JSON.stringify(await syncMeta(A.page))})`); });
  const rangee = (page) => page.locator('section[data-tab=ic] .rg', { hasText: 'Régate partagée' });
  await A.page.click('#tabs button[data-tab=ic]'); await ouvreLigne(rangee(A.page)); await ajouteManche(A.page, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  await B.page.click('#tabs button[data-tab=ic]'); await ouvreLigne(rangee(B.page)); await ajouteManche(B.page, { heure: '13:25', parcours: '3', cls: 'P', tours: '1' });
  assert.match(await ligneSync(A.page), /^Hors réseau · 2 modifications en attente \(essai\)$/);
  assert.match(await ligneSync(B.page), /^Hors réseau · 1 modification en attente \(essai\)$/);
  await A.page.waitForTimeout(1500);
  assert.deepEqual([A.requetes.length, B.requetes.length], [vues.A, vues.B], 'aucune requête vers /api/archive hors réseau (même échouée)');
  assert.deepEqual(m.appels, serveur, 'rien n’est arrivé au serveur');

  // retour du réseau sur les deux (l’heure a avancé de plus de 30 s) : l’envoi part de lui-même, sans geste
  await avanceHeure(m, 120e3);
  await A.ctx.setOffline(false); await B.ctx.setOffline(false);
  const parti = (tel) => tel.page.waitForFunction(([h]) => { const x = JSON.parse(localStorage.getItem('rade.sync.v1') || '{}'); return x.lastOkAt === h && !Object.keys(x.dirty || {}).length; }, [m.t], { timeout: 30000, polling: 200 });
  await Promise.all([parti(A), parti(B)]);
  await avanceHeure(m, 60e3); await synchronise(m, B);
  await avanceHeure(m, 60e3); await synchronise(m, A);
  const etat = (page) => page.evaluate(() => { const i = JSON.parse(localStorage.getItem('rade.regates.v1')); return i.list.filter((r) => /^Régate (partagée|hors réseau)$/.test(r.name)).map((r) => ({ nom: r.name, manches: r.races.map((x) => `${x.n}:${x.time}`) })).sort((a, b) => a.nom.localeCompare(b.nom)); });
  const attendu = [{ nom: 'Régate hors réseau', manches: [] }, { nom: 'Régate partagée', manches: ['1:10:55', '2:13:25'] }];
  assert.deepEqual(await etat(A.page), attendu, 'les deux manches, une seule fois, et la régate hors réseau, chez A');
  assert.deepEqual(await etat(B.page), attendu, 'et chez B');
  for (const tel of [A, B]) assert.match(await ligneSync(tel.page), /^À jour \(essai\)$/, `${tel.nom} : ${JSON.stringify(await syncMeta(tel.page))}`);

  // D-03 : pendant un chrono, rien n’est envoyé ni reçu ; la saisie attend la fin de la course
  const reqA = () => A.requetes.length, avantChrono = reqA(), serveurAvant = m.appels.Teiva;
  await A.page.click('#tabs button[data-tab=start]'); await A.page.click('#t5');
  await creeRegate(A.page, { nom: 'Régate pendant le chrono', debut: '2026-11-14', club: 'CVAT' });
  await A.page.click('#rgSyncBtn');
  await A.page.waitForFunction(() => /^En pause pendant la course/.test(document.querySelector('#rgSync')?.textContent ?? ''), null, { timeout: 10000 });
  await avanceHeure(m, 120e3);
  await A.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await A.page.waitForTimeout(3500);                         // le déclencheur « online » (+2 s) est passé : il doit avoir été refusé
  assert.equal(reqA(), avantChrono, 'aucun appel à /api/archive pendant un chrono');
  assert.equal(m.appels.Teiva, serveurAvant, 'rien n’est arrivé au serveur pendant le chrono');
  assert.equal(await ligneSync(A.page), 'En pause pendant la course (essai)');
  const putsAvant = A.requetes.filter((x) => x === 'PUT').length;
  await A.page.click('#tabs button[data-tab=start]'); await A.page.click('#tstop');
  await synchronise(m, A);
  assert.equal(A.requetes.filter((x) => x === 'PUT').length - putsAvant, 1, 'exactement un envoi après la course');
  await avanceHeure(m, 60e3); await synchronise(m, B);
  assert.ok((await noms(B.page)).includes('Régate pendant le chrono'), 'la régate créée pendant le chrono arrive chez B après la course');
  sansErreur(A.erreurs, 'sur A'); sansErreur(B.erreurs, 'sur B');
  await A.ctx.close(); await B.ctx.close();
}

// D-05 : un recalage de bouée fait sur un téléphone arrive sur l’autre hors course, avec un message qui dit qui l’a fait ; la remise à l’origine aussi
async function archiveBouees({ browser, base }) {
  const m = await mondeArchive();
  const A = await telephoneArchive(browser, base, m, 'Teiva'), B = await telephoneArchive(browser, base, m, 'Thibaud');
  const bouee = (page, k) => page.evaluate(async (n) => { const { MARKS } = await import('/js/courses.js'); const x = MARKS[n]; return { lat: x.lat, lon: x.lon, src: x.src, name: x.name, base: x.base ?? null }; }, k);
  const rangee = (page, k) => page.locator('section[data-tab=ic] tr', { has: page.locator(`[data-mkfix="${k}"]`) });
  const recaler = async (page, k, lat, lon) => {
    await page.click('#tabs button[data-tab=ic]'); await page.click(`[data-mkfix="${k}"]`);
    await page.fill('#mkTxt', `${lat} ${lon}`); await page.click('#mkOk');
    await page.waitForSelector('#mkTxt', { state: 'detached', timeout: 10000 });
  };
  const origine = await bouee(A.page, 3), origine11 = await bouee(A.page, 11);
  assert.equal(origine.src, 'approx'); assert.deepEqual(await bouee(B.page, 3), origine);

  // A recale la bouée 3 (saisie), synchronise ; B reçoit le recalage avec le message « recalée par Teiva »
  await recaler(A.page, 3, 43.0905, 5.9587);
  assert.deepEqual([(await bouee(A.page, 3)).lat, (await bouee(A.page, 3)).lon], [43.0905, 5.9587]);
  await avanceHeure(m, 60e3); await synchronise(m, A);
  await avanceHeure(m, 60e3);
  const vu = toastVu(B.page, `Bouée 3 ${origine.name} recalée par Teiva \\(saisie du 07/11\\)`, 20000);
  await synchronise(m, B); await vu;
  const b3 = await bouee(B.page, 3);
  assert.deepEqual([b3.lat, b3.lon, b3.src], [43.0905, 5.9587, 'saisie du 07/11'], 'la carte, le routage et le mode départ lisent MARKS : la nouvelle position y est');
  await B.page.click('#tabs button[data-tab=ic]');
  const txt = await rangee(B.page, 3).textContent();
  assert.match(txt, /saisie du 07\/11/); assert.doesNotMatch(txt, /à confirmer/);
  assert.equal(JSON.parse(await B.page.evaluate(() => localStorage.getItem('rade.marks.v1')))[3].src, 'saisie', 'gardé sur le téléphone de B');
  assert.deepEqual(Object.keys((await syncMeta(B.page)).dirty || {}), [], 'un recalage reçu n’est pas renvoyé');

  // B remet la bouée 3 à sa position d’origine ; A la reçoit
  await B.page.click('[data-mkorig="3"]');
  assert.deepEqual(await bouee(B.page, 3), origine);
  await avanceHeure(m, 60e3); await synchronise(m, B);
  await avanceHeure(m, 60e3);
  const vu2 = toastVu(A.page, `Bouée 3 ${origine.name} : position d’origine rétablie par Thibaud`, 20000);
  await synchronise(m, A); await vu2;
  assert.deepEqual(await bouee(A.page, 3), origine, 'retour à la position d’origine chez A');
  assert.match(await rangee(A.page, 3).textContent(), /à confirmer/);
  assert.equal(await A.page.evaluate(() => JSON.parse(localStorage.getItem('rade.marks.v1') || '{}')[3]), undefined);

  // T-04-17 : pendant un chrono sur B, le recalage de A n’est ni reçu ni appliqué ; il arrive après la course
  await B.page.click('#tabs button[data-tab=start]'); await B.page.click('#t5');         // le chrono de B est lancé AVANT le recalage de A : aucun échange légitime de B ne peut le précéder
  const avant = B.requetes.length;
  await recaler(A.page, 11, +(origine11.lat + 0.001).toFixed(5), +(origine11.lon + 0.001).toFixed(5));
  await avanceHeure(m, 60e3); await synchronise(m, A);
  await avanceHeure(m, 60e3);
  await B.page.click('#tabs button[data-tab=ic]'); await B.page.click('#rgSyncBtn');
  await B.page.waitForFunction(() => /^En pause pendant la course/.test(document.querySelector('#rgSync')?.textContent ?? ''), null, { timeout: 10000 });
  await B.page.waitForTimeout(1000);
  assert.equal(B.requetes.length, avant, 'aucun appel à /api/archive pendant le chrono');
  assert.deepEqual(await bouee(B.page, 11), origine11, 'la bouée 11 de B est inchangée pendant le chrono');
  await B.page.click('#tabs button[data-tab=start]'); await B.page.click('#tstop');
  await synchronise(m, B);
  const b11 = await bouee(B.page, 11);
  assert.deepEqual([b11.lat, b11.lon], [+(origine11.lat + 0.001).toFixed(5), +(origine11.lon + 0.001).toFixed(5)], 'recalage de A appliqué après la course');

  // D-04 : deux équipiers changent la même manche (même jour et même heure, parcours différents) — la plus récente reste, l’autre est dans « Historique » de la fiche
  await creeRegate(A.page, { nom: 'Régate historique', debut: '2026-11-14', club: 'CVAT' });
  await avanceHeure(m, 60e3); await synchronise(m, A); await avanceHeure(m, 60e3); await synchronise(m, B);
  const rangeeH = (page) => page.locator('section[data-tab=ic] .rg', { hasText: 'Régate historique' });
  await B.page.click('#tabs button[data-tab=ic]'); await ouvreLigne(rangeeH(B.page));
  await ajouteManche(A.page, { heure: '09:30', parcours: '5', cls: 'G', tours: '2' });
  await ajouteManche(B.page, { heure: '09:30', parcours: '3', cls: 'G', tours: '2' });
  await avanceHeure(m, 60e3); await synchronise(m, A); await avanceHeure(m, 60e3); await synchronise(m, B); await avanceHeure(m, 60e3); await synchronise(m, A);
  for (const tel of [A, B]) {
    await tel.page.click('#tabs button[data-tab=ic]');
    assert.equal(await tel.page.locator('#rgSheet .rgrace').count(), 1, `${tel.nom} : une seule manche à 09:30`);
    assert.equal(await tel.page.locator('#rgSheet details.rghist summary').textContent(), 'Historique (1)', `${tel.nom} : l’écrasée est dans l’historique`);
    assert.equal(await tel.page.locator('#rgSheet details.rghist').evaluate((d) => d.open), false, 'replié');
    assert.match(await tel.page.locator('#rgSheet .rghl').textContent(), /^Manche · /);
  }

  // Interrupteur : deux touches pour désactiver, plus aucun échange ; un geste pour réactiver, la saisie en attente part alors
  await A.page.click('#tabs button[data-tab=ic]');
  const vuesA = A.requetes.length;
  await A.page.click('#rgSyncOff');
  assert.equal(await A.page.locator('#rgSyncOff').textContent(), 'Toucher encore pour désactiver');
  assert.equal(A.requetes.length, vuesA); assert.notEqual((await syncMeta(A.page)).off, true, 'une seule touche ne désactive rien');
  await A.page.click('#rgSyncOff');
  assert.equal(await ligneSync(A.page), 'Synchronisation désactivée (essai)');
  assert.equal(await A.page.locator('#rgSyncOff').textContent(), 'Réactiver la synchronisation');
  assert.equal(await A.page.locator('#rgSyncBtn').isDisabled(), true);
  await recaler(A.page, 3, 43.0906, 5.9588);
  await avanceHeure(m, 120e3);
  await A.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await A.page.waitForTimeout(3500);
  assert.equal(A.requetes.length, vuesA, 'aucun échange tant que la synchronisation est désactivée');
  assert.equal((await syncMeta(A.page)).off, true, 'gardé après relance');
  await A.page.click('#rgSyncOff');
  assert.equal(await A.page.locator('#rgSyncOff').textContent(), 'Désactiver la synchronisation');
  await synchronise(m, A);
  assert.equal(await ligneSync(A.page), 'À jour (essai)');
  await avanceHeure(m, 60e3); await synchronise(m, B);
  assert.deepEqual([(await bouee(B.page, 3)).lat, (await bouee(B.page, 3)).lon], [43.0906, 5.9588], 'la saisie faite pendant la désactivation est partie à la réactivation');
  sansErreur(A.erreurs, 'sur A'); sansErreur(B.erreurs, 'sur B');
  await A.ctx.close(); await B.ctx.close();
}

// ───────────────────────── objets lourds de l'archive (ARCH-03, D-03) : traces, rapports, vent figé du jour, lisibles hors réseau

// Attend côté outil (le faux Blob est dans ce processus) qu'une condition soit vraie
async function attendre(cond, quoi, delai = 40000) {
  const t0 = Date.now();
  while (!(await cond())) { if (Date.now() - t0 > delai) throw new Error(`${quoi} : jamais atteint`); await new Promise((r) => setTimeout(r, 200)); }
}
const lireTraceLocale = (page, id) => page.evaluate((i) => new Promise((ok, ko) => {
  const r = indexedDB.open('rade-traces', 1);
  r.onsuccess = () => { const q = r.result.transaction('tracks').objectStore('tracks').get(i); q.onsuccess = () => ok(q.result ? { id: q.result.id, name: q.result.name, n: q.result.pts.length, report: q.result.report ?? null } : null); q.onerror = () => ko(q.error); };
  r.onerror = () => ko(r.error);
}), id);
// Pose un rapport dans la trace locale (même base que l'app) ; la référence de la fiche suit quand l'équipier ouvre la trace (syncRef)
const poseRapport = (page, id, rapport) => page.evaluate(async ([i, rp]) => { const { getTrack, saveTrack } = await import('/js/track.js'); const tr = await getTrack(i); tr.report = rp; await saveTrack(tr); }, [id, rapport]);
// Rapport « piégé » : s'il s'exécutait, il marquerait la page et son stockage local
const RAPPORT_TEST = { t: Date.parse('2026-10-19T09:00:00Z'), name: 'Rapport archive test', html: '<!doctype html><html><head><meta charset="utf-8"><title>Rapport archive test</title></head><body><h1>Rapport archive test</h1><script>try{window.parent.__xss=1;window.top.__xss=1;localStorage.setItem("xss","1")}catch(e){}</script><img src=x onerror="try{window.top.__xss=2}catch(e){}"></body></html>' };

// A importe la trace de la Coupe SNPM et lui pose un rapport ; B reçoit tout et le lit réseau coupé
async function archiveHors({ browser, base }) {
  const m = await mondeArchive();
  const A = await telephoneArchive(browser, base, m, 'Teiva'), B = await telephoneArchive(browser, base, m, 'Thibaud');
  // 1) A importe le GPX (rangé dans la Coupe SNPM semée), laisse le questionnaire du débrief, pose le rapport marqueur et ouvre la trace
  await ongletTraces(A.page);
  await A.page.setInputFiles('#gpxIn', GPX_SNPM);
  await toastVu(A.page, 'Trace rangée dans Coupe de la SNPM — CVAT');
  await A.page.waitForSelector('#dqCancel', { timeout: 60000 }); await A.page.click('#dqCancel');
  await ouvreRegate(A.page, 'snpm-2026');                                                    // la trace est rangée dans la Coupe SNPM sans l'ouvrir : ouverture explicite
  const id = (await regateOuverte(A.page)).traces[0].id;
  assert.match(id, /^tr\d+/, 'trace rangée');
  await poseRapport(A.page, id, RAPPORT_TEST);
  await ongletTraces(A.page);
  await A.page.click('[data-tv]');                                                            // « Analyser » : le résumé et le rapport rejoignent la fiche
  await A.page.waitForFunction(() => { const i = JSON.parse(localStorage.getItem('rade.regates.v1')); const t = i.list.find((r) => r.id === document.querySelector('#regBar').dataset.open)?.traces[0]; return t?.sum && t?.report?.t; }, null, { timeout: 60000 });
  // 2) A synchronise : la fiche part (légère), puis la trace et le rapport (lourds), une fois chacun
  await avanceHeure(m, 60e3);
  await synchronise(m, A);
  const chemins = [`preview/trace/${id}.json`, `preview/report/${id}-${RAPPORT_TEST.t}.json`];
  await attendre(() => chemins.every((c) => m.blob.store.has(c)), 'trace et rapport en ligne');
  const taille = (c) => Buffer.byteLength(m.blob.store.get(c).text);
  console.log(`  mesure archivehors : trace ${taille(chemins[0])} octets, rapport ${taille(chemins[1])} octets`);
  assert.ok(!('report' in JSON.parse(m.blob.store.get(chemins[0]).text)), 'la trace en ligne est sans rapport');
  assert.ok(!(await A.page.evaluate(() => JSON.stringify(Object.keys(JSON.parse(localStorage.getItem('rade.sync.v1')).up || {})))).includes('day:'), 'pas encore de jour figé');
  // 3) B synchronise (légère), puis reçoit la trace et le rapport dans ses bases locales
  await avanceHeure(m, 60e3);
  await synchronise(m, B);
  await attendre(async () => (await lireTraceLocale(B.page, id))?.report, 'trace et rapport reçus par B');
  const tb = await lireTraceLocale(B.page, id);
  assert.equal(tb.n, 9538, 'la trace complète est chez B'); assert.equal(tb.report.name, 'Rapport archive test');
  const puts = m.blob.ops.log.filter((o) => o.op === 'put').length;
  const envoisB = B.requetes.filter((x) => x === 'PUT').length;
  // 4) B coupe le réseau : fiche, trace (carte et analyse) et débrief s'ouvrent, sans aucun appel à /api/archive
  await B.ctx.setOffline(true); await B.page.waitForFunction(() => !navigator.onLine);
  const avant = { requetes: B.requetes.length, serveur: m.appels.Thibaud };
  await ouvreRegate(B.page, 'snpm-2026');                                                     // ouverture explicite de la Coupe SNPM chez B, réseau coupé : un état de la page, rien à échanger
  await B.page.waitForSelector('#rgSheet .rgtr', { timeout: 20000 });
  const ligne = (await B.page.locator('#rgSheet .rgtr').first().textContent()).replace(/\s+/g, ' ');
  assert.match(ligne, /\d+,\d Nq · [^·]*actives/, `résumé de la trace chez B : ${ligne}`);
  assert.match(ligne, /Débrief par Teiva/, 'le rapport de A, signé de A');
  await B.page.click('#rgSheet [data-trv]');
  await B.page.waitForSelector('#traceDetail .kpis', { timeout: 60000 });
  assert.match(await B.page.locator('#traceDetail').textContent(), /Nq parcourus/, 'l’analyse de la trace de A, chez B');
  await B.page.click('#tabs button[data-tab=ic]');
  assert.equal((await B.page.locator('#rgSheet [data-trd]').first().textContent()).trim(), 'Voir le débrief');
  await B.page.click('#rgSheet [data-trd]');
  await B.page.waitForFunction(() => /Rapport archive test/.test(document.querySelector('#rpFrame')?.srcdoc || '') && !document.querySelector('#modal')?.hidden, null, { timeout: 20000 });
  // le rapport d'un autre téléphone ne s'exécute pas : cadre en sandbox (ni scripts ni même origine), rien n'a marqué la page ni son stockage
  assert.equal(await B.page.evaluate(() => document.querySelector('#rpFrame').getAttribute('sandbox')), '', 'cadre du rapport en sandbox sans permission');
  await B.page.waitForTimeout(500);
  assert.deepEqual(await B.page.evaluate(() => [window.__xss ?? null, localStorage.getItem('xss')]), [null, null], 'le script du rapport n’a rien exécuté');
  assert.equal(B.requetes.length, avant.requetes, 'aucune requête vers /api/archive pendant la lecture hors réseau');
  assert.equal(m.appels.Thibaud, avant.serveur, 'rien n’est arrivé au serveur');
  assert.equal(B.requetes.filter((x) => x === 'PUT').length, envoisB, 'B n’a rien renvoyé');
  assert.equal(m.blob.ops.log.filter((o) => o.op === 'put').length, puts, 'aucune écriture en ligne de plus');
  // Chromium consigne le script bloqué du rapport piégé (preuve du bac à sable) et Playwright, en mode « service worker bloqué », se plaint dans le cadre sandboxé : deux bruits attendus
  // « Mes traces » de B liste la trace reçue (nom, date, points) ; importer le même GPX une seconde fois ne la double pas
  await B.page.click('#rpClose');
  await ongletTraces(B.page);
  const lignes = (await B.page.locator('section[data-tab=tracks] .trow').allTextContents()).map((x) => x.replace(/\s+/g, ' '));
  assert.equal(lignes.length, 1, `une seule trace chez B : ${lignes}`);
  assert.ok(lignes[0].includes(tb.name), `nom de la trace reçue : ${lignes[0]}`);
  assert.match(lignes[0], /18\/10\/2026/); assert.match(lignes[0], /9538 points/);
  await B.page.setInputFiles('#gpxIn', GPX_SNPM);
  await toastVu(B.page, 'Déjà importée', 30000);
  await B.page.waitForTimeout(1000);
  assert.equal((await lireTraces(B.page)).length, 1, 'toujours une seule trace en base chez B'); assert.equal((await regateOuverte(B.page)).traces.length, 1, 'toujours une seule référence');
  assert.equal(id, (await lireTraces(B.page))[0].id, 'même GPX, même identifiant sur les deux téléphones');
  sansErreur(A.erreurs, 'sur A'); sansErreur(B.erreurs, 'sur B');
  await A.ctx.close(); await B.ctx.close();

  // 4 bis) une régate de plus de 180 jours reste lisible en version légère ; « Télécharger pour le hors réseau » apporte la trace et le rapport d'un geste
  m.t = Date.parse('2027-04-20T10:00:00Z');
  const C = await telephoneArchive(browser, base, m, 'Romain');
  await synchronise(m, C);
  await C.page.waitForTimeout(2500);
  assert.deepEqual(m.lourds.Romain, [], 'hors horizon (184 jours) : rien de lourd tout seul');
  await ouvreRegate(C.page, 'snpm-2026');
  await C.page.waitForSelector('#rgSheet .rgtr', { timeout: 20000 });
  await C.page.waitForSelector('#rgSheet [data-rg-dl]', { timeout: 20000 });
  assert.match(await C.page.locator('#rgSheet .rgtr').first().textContent(), /en ligne seulement/);
  assert.equal(await C.page.locator('#rgSheet .rgtr [data-trv]').count(), 0, 'pas de lecture d’une trace qui n’est pas là');
  assert.match(await C.page.locator('#rgSheet .rgtr').first().textContent(), /\d+,\d Nq/, 'mais son résumé se lit déjà (version légère)');
  await C.page.click('#rgSheet [data-rg-dl]');
  await attendre(async () => (await lireTraceLocale(C.page, id))?.report, 'trace et rapport téléchargés par le geste');
  await C.page.waitForFunction(() => /sur ce téléphone/.test(document.querySelector('#rgSheet .rgtr')?.textContent || '') && !document.querySelector('#rgSheet [data-rg-dl]'), null, { timeout: 20000 });
  assert.deepEqual(m.lourds.Romain, ['GET trace', 'GET report']);
  sansErreur(C.erreurs, 'sur C (régate ancienne)');
  await C.ctx.close();

  // 5) vent figé du jour : A le fige le jour de la régate (signal à 10:55, il est 10:00) ; pendant la journée de régate (verrou) rien de lourd ne part ;
  //    le lendemain à 08:00 il part ; B, qui ouvre l'app après, le reçoit et le lit réseau coupé
  const m2 = await mondeArchive('2026-10-18T08:00:00Z');
  const A2 = await telephoneArchive(browser, base, m2, 'Teiva');
  await creeRegate(A2.page, { nom: 'Coupe du gel', debut: '2026-10-18', club: 'CVAT' });
  await ajouteManche(A2.page, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  const rid = (await regateOuverte(A2.page)).id, cleJour = `day:${rid}|2026-10-18`;
  await attendGel(A2.page, '2026-10-18', (x) => x.signal === 'manche' && x.strategy, 'vent et route du jour figés');
  assert.ok((await syncMeta(A2.page)).hq?.[cleJour], 'le jour figé est en file d’envoi');
  await avanceHeure(m2, 60e3);
  await synchronise(m2, A2);                                                     // synchronisation légère : permise ; lourde : verrou de la journée de régate
  await A2.page.waitForTimeout(2500);
  assert.deepEqual(m2.lourds.Teiva, [], 'aucun appel lourd pendant la journée de régate');
  assert.ok((await syncMeta(A2.page)).hq?.[cleJour], 'toujours en file');
  // la Coupe SNPM semée est « du jour » elle aussi : son vent est figé et part avec l'autre (deux jours, un par régate)
  const jourM2 = () => [...m2.blob.store.keys()].filter((c) => c.includes('/day/'));
  assert.deepEqual(jourM2(), [], 'rien en ligne');
  await avanceHeure(m2, Date.parse('2026-10-19T06:00:00Z') - m2.t);             // lendemain, 08:00 à Paris : plus de verrou
  await synchronise(m2, A2);
  const monJour = `preview/day/${rid}/2026-10-18/teiva.json`;
  await attendre(() => m2.blob.store.has(monJour), 'le jour figé de A en ligne');
  assert.ok(jourM2().every((c) => /\/2026-10-18\/teiva\.json$/.test(c)), 'sous le prénom de A, jamais un autre');
  assert.ok(m2.lourds.Teiva.length >= 1 && m2.lourds.Teiva.every((x) => x === 'PUT day'), `seuls des jours sont partis : ${m2.lourds.Teiva}`);
  await attendre(async () => !(await syncMeta(A2.page)).hq?.[cleJour], 'jour sorti de la file');
  const oj = JSON.parse(m2.blob.store.get(monJour).text);
  console.log(`  mesure archivehors : vent du jour ${Buffer.byteLength(m2.blob.store.get(monJour).text)} octets (prévisions ${JSON.stringify(oj.wx).length}, route ${JSON.stringify(oj.strat).length}, relevés ${JSON.stringify(oj.obs).length})`);
  assert.ok(oj.wx.multi.hourly.time.length === 25 && oj.strat.legs.length >= 8 && Array.isArray(oj.obs.obs), 'les trois copies du jour');
  const B2 = await telephoneArchive(browser, base, m2, 'Thibaud');
  await synchronise(m2, B2);
  await attendre(async () => (await lireSlot(B2.page, `${rid}|2026-10-18|wx`)) && (await lireSlot(B2.page, `${rid}|2026-10-18|strat`)) && (await lireSlot(B2.page, `${rid}|2026-10-18|obs`)), 'les trois copies du jour chez B');
  assert.ok(m2.lourds.Thibaud.length >= 1 && m2.lourds.Thibaud.every((x) => x === 'GET day'), `B n’a fait que recevoir : ${m2.lourds.Thibaud}`);
  await B2.ctx.setOffline(true); await B2.page.waitForFunction(() => !navigator.onLine);
  await ongletIC(B2.page);
  await ouvreLigne(B2.page.locator('section[data-tab=ic] .rg', { hasText: 'Coupe du gel' }));
  await B2.page.waitForFunction(() => /Figé automatiquement/.test(document.querySelector('#rgSheet .rgwind[data-day="2026-10-18"]')?.textContent || ''), null, { timeout: 20000 });
  assert.match(await texteVent(B2.page, '2026-10-18'), /Figé automatiquement à 10:00/, 'la fiche de B montre le vent du jour figé par A, réseau coupé');
  const wxB = await lireSlot(B2.page, `${rid}|2026-10-18|wx`);
  assert.equal(wxB.multi.hourly.time.length, 25, 'les prévisions du jour de A sont dans la base de B');
  assert.ok((await syncMeta(B2.page)).down?.[cleJour], 'noté reçu : il ne repartira pas');
  sansErreur(A2.erreurs, 'sur A (jour figé)'); sansErreur(B2.erreurs, 'sur B (jour figé)');
  await A2.ctx.close(); await B2.ctx.close();
}

// ───────────────────────── l'équipage au complet : trois téléphones, toute la phase 4 d'un seul tenant

const NOM_EQUIPAGE = 'Régate de l’équipage', NOM_SNPM = 'Coupe de la SNPM — CVAT';
const regateNommee = (page, nom) => page.evaluate((n) => JSON.parse(localStorage.getItem('rade.regates.v1')).list.find((r) => r.name === n) ?? null, nom);
// Heures, auteurs et nombre d'exemplaires de la régate de l'équipage, tels que gardés sur le téléphone
const mancheLocales = (page) => page.evaluate((n) => JSON.parse(localStorage.getItem('rade.regates.v1')).list.filter((r) => r.name === n).map((r) => r.races.map((x) => `${x.n}:${x.time}:${x.by}`)), NOM_EQUIPAGE);

// Critères 1, 2 et 4 et D-03 réunis, avec ce que les scénarios archive, archive-bouees et archivehors vérifient séparément : A (Teiva) crée hors réseau,
// B (Thibaud) et A complètent chacun hors réseau, tout part au retour du réseau sans perte ni doublon et C (Romain) le reçoit ; rien n'est échangé
// pendant le chrono de A ; C lit ensuite, réseau coupé, la fiche, la trace, le débrief et le rapport faits par A
async function equipage({ browser, base }) {
  const m = await mondeArchive();
  const A = await telephoneArchive(browser, base, m, 'Teiva'), B = await telephoneArchive(browser, base, m, 'Thibaud'), C = await telephoneArchive(browser, base, m, 'Romain');
  const tous = [A, B, C];
  const rangee = (page) => page.locator('section[data-tab=ic] .rg', { hasText: NOM_EQUIPAGE });
  const parti = (tel) => tel.page.waitForFunction(([h]) => { const x = JSON.parse(localStorage.getItem('rade.sync.v1') || '{}'); return x.lastOkAt === h && !Object.keys(x.dirty || {}).length; }, [m.t], { timeout: 30000, polling: 200 });
  const horsReseau = async (...tels) => { for (const t of tels) { await t.ctx.setOffline(true); await t.page.waitForFunction(() => !navigator.onLine); } };
  const enLigne = async (...tels) => { for (const t of tels) await t.ctx.setOffline(false); };

  // 0) chaque téléphone a déjà synchronisé une fois en ligne (modules d'échange chargés : sans service worker dans l'outil, un module demandé réseau coupé échouerait pour de bon)
  for (const t of tous) { await avanceHeure(m, 60e3); await synchronise(m, t); }
  await A.page.waitForTimeout(1500);

  // 1) A et B hors réseau ; A crée la régate de l'équipage et sa première manche ; le réseau revient chez A, l'envoi part tout seul
  const serveur0 = { ...m.appels }, vues0 = tous.map((t) => t.requetes.length);
  await horsReseau(A, B);
  await creeRegate(A.page, { nom: NOM_EQUIPAGE, debut: '2026-11-14', fin: '2026-11-15', club: 'CVAT' });
  await ajouteManche(A.page, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  await A.page.waitForTimeout(1500);
  assert.equal(A.requetes.length, vues0[0], 'A hors réseau : aucune requête vers /api/archive');
  assert.equal(m.appels.Teiva, serveur0.Teiva, 'rien n’est arrivé au serveur');
  await avanceHeure(m, 120e3);
  await enLigne(A);
  await parti(A);
  // B reçoit la régate de A, puis repasse hors réseau (A aussi)
  await avanceHeure(m, 60e3);
  await enLigne(B);
  await synchronise(m, B);
  assert.deepEqual(await mancheLocales(B.page), [['1:10:55:Teiva']], 'la régate de A et sa manche, signées de A, chez B');
  await horsReseau(A, B);

  // 2) hors réseau, B ajoute 13:30 et A ajoute 15:00 à la même régate ; aucune requête
  await B.page.click('#tabs button[data-tab=ic]'); await ouvreLigne(rangee(B.page));
  await ajouteManche(B.page, { heure: '13:30', parcours: '3', cls: 'P', tours: '1' });
  await A.page.click('#tabs button[data-tab=ic]'); await ouvreLigne(rangee(A.page));
  await ajouteManche(A.page, { heure: '15:00', parcours: '5', cls: 'G', tours: '2' });
  const avantRetour = { A: A.requetes.length, B: B.requetes.length, serveur: { ...m.appels } };
  await A.page.waitForTimeout(1500);
  assert.deepEqual([A.requetes.length, B.requetes.length], [avantRetour.A, avantRetour.B], 'aucune requête hors réseau');
  // retour du réseau sur les deux (l'heure a avancé de plus de 30 s) : l'envoi part de lui-même, puis chacun reçoit ce que l'autre a envoyé
  await avanceHeure(m, 120e3);
  await enLigne(A, B);
  await Promise.all([parti(A), parti(B)]);
  await avanceHeure(m, 60e3); await synchronise(m, B);
  await avanceHeure(m, 60e3); await synchronise(m, A);
  await avanceHeure(m, 60e3); await synchronise(m, C);
  const attendu = ['1:10:55:Teiva', '2:13:30:Thibaud', '3:15:00:Teiva'];
  for (const t of tous) {
    assert.deepEqual(await mancheLocales(t.page), [attendu], `${t.nom} : une seule régate de l’équipage, trois manches, chacune une fois et signée de son auteur`);
    assert.equal((await noms(t.page)).filter((x) => x === NOM_EQUIPAGE).length, 1, `${t.nom} : une seule ligne dans la liste`);
    assert.match(await ligneSync(t.page), /^À jour \(essai\)$/, `${t.nom} : ${JSON.stringify(await syncMeta(t.page))}`);
  }
  await C.page.click('#tabs button[data-tab=ic]'); await ouvreLigne(rangee(C.page));
  const lignesC = (await C.page.locator('#rgSheet .rgrace').allTextContents()).map((x) => x.replace(/\s+/g, ' '));
  assert.equal(lignesC.length, 3, `trois manches dans la fiche de C : ${lignesC}`);
  assert.ok(/par Thibaud/.test(lignesC[1]) && /par Teiva/.test(lignesC[0]) && /par Teiva/.test(lignesC[2]), `auteurs affichés chez C : ${lignesC}`);

  // 3) D-03 : A lance le chrono, modifie la régate (quatrième manche) et touche « Synchroniser » : rien n'est échangé ; après « Stop », la modification part et arrive chez C
  const reqA = A.requetes.length, serveurA = m.appels.Teiva;
  await A.page.click('#tabs button[data-tab=start]'); await A.page.click('#t5');
  await A.page.click('#tabs button[data-tab=ic]'); await ouvreLigne(rangee(A.page));
  await ajouteManche(A.page, { heure: '16:20', parcours: '3', cls: 'P', tours: '1' });
  await A.page.click('#rgSyncBtn');
  await A.page.waitForFunction(() => /^En pause pendant la course/.test(document.querySelector('#rgSync')?.textContent ?? ''), null, { timeout: 10000 });
  await avanceHeure(m, 120e3);
  await A.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await A.page.waitForTimeout(3500);                          // le déclencheur « online » (+2 s) est passé : il doit avoir été refusé
  assert.equal(A.requetes.length, reqA, 'aucun appel à /api/archive pendant le chrono de A');
  assert.equal(m.appels.Teiva, serveurA, 'rien n’est arrivé au serveur pendant le chrono');
  assert.equal(await ligneSync(A.page), 'En pause pendant la course (essai)');
  assert.equal((await mancheLocales(C.page))[0].length, 3, 'et C ne voit pas encore la quatrième manche');
  await A.page.click('#tabs button[data-tab=start]'); await A.page.click('#tstop');
  await synchronise(m, A);
  await avanceHeure(m, 60e3); await synchronise(m, C);
  const apres = ['1:10:55:Teiva', '2:13:30:Thibaud', '3:15:00:Teiva', '4:16:20:Teiva'];
  assert.deepEqual(await mancheLocales(C.page), [apres], 'la manche ajoutée pendant le chrono arrive chez C après la course');
  await avanceHeure(m, 60e3); await synchronise(m, B);
  assert.deepEqual(await mancheLocales(B.page), [apres], 'et chez B');

  // 4) A range la trace de la Coupe SNPM (régate non courante), pose le rapport marqueur, l'analyse, puis tout part : la fiche légère, puis la trace et le rapport
  await ongletTraces(A.page);
  await A.page.setInputFiles('#gpxIn', GPX_SNPM);
  await toastVu(A.page, 'Trace rangée dans Coupe de la SNPM — CVAT');
  await A.page.waitForSelector('#dqCancel', { timeout: 60000 }); await A.page.click('#dqCancel');
  const id = (await regateNommee(A.page, NOM_SNPM)).traces[0].id;
  assert.match(id, /^tr\d+/, 'trace rangée dans la Coupe SNPM');
  await poseRapport(A.page, id, RAPPORT_TEST);
  await ongletTraces(A.page);
  await A.page.click('[data-tv]');
  await A.page.waitForFunction((n) => { const t = JSON.parse(localStorage.getItem('rade.regates.v1')).list.find((r) => r.name === n)?.traces[0]; return t?.sum && t?.report?.t; }, NOM_SNPM, { timeout: 60000 });
  await avanceHeure(m, 60e3); await synchronise(m, A);
  const chemins = [`preview/trace/${id}.json`, `preview/report/${id}-${RAPPORT_TEST.t}.json`];
  await attendre(() => chemins.every((c) => m.blob.store.has(c)), 'trace et rapport en ligne');
  assert.equal(chemins.filter((c) => m.blob.ops.log.filter((o) => o.op === 'put' && o.path === c).length > 1).length, 0, 'ni trace ni rapport écrits deux fois');

  // 5) C reçoit (fiche légère, puis objets lourds), coupe le réseau et lit tout sans appel : fiche, trace (carte et analyse), débrief, rapport
  await avanceHeure(m, 60e3); await synchronise(m, C);
  await attendre(async () => (await lireTraceLocale(C.page, id))?.report, 'trace et rapport reçus par C');
  const tc = await lireTraceLocale(C.page, id);
  assert.equal(tc.n, 9538, 'la trace complète est chez C'); assert.equal(tc.report.name, 'Rapport archive test');
  await horsReseau(C);
  const avant = { requetes: C.requetes.length, serveur: m.appels.Romain, puts: C.requetes.filter((x) => x === 'PUT').length, ecritures: m.blob.ops.log.filter((o) => o.op === 'put').length };
  await C.page.click('#tabs button[data-tab=ic]');
  await ouvreLigne(C.page.locator('section[data-tab=ic] .rg', { hasText: 'Coupe de la SNPM' }));
  await C.page.waitForSelector('#rgSheet .rgtr', { timeout: 20000 });
  const ligne = (await C.page.locator('#rgSheet .rgtr').first().textContent()).replace(/\s+/g, ' ');
  assert.match(ligne, /\d+,\d Nq · [^·]*actives/, `résumé de la trace chez C : ${ligne}`);
  assert.match(ligne, /sur ce téléphone/, 'trace lisible sur le téléphone de C');
  assert.match(ligne, /Débrief par Teiva/, 'le rapport de A, signé de A');
  await C.page.click('#rgSheet [data-trv]');
  await C.page.waitForSelector('#traceDetail .kpis', { timeout: 60000 });
  assert.match(await C.page.locator('#traceDetail').textContent(), /Nq parcourus/, 'l’analyse de la trace de A, chez C');
  await C.page.click('#tabs button[data-tab=ic]');
  assert.equal((await C.page.locator('#rgSheet [data-trd]').first().textContent()).trim(), 'Voir le débrief');
  await C.page.click('#rgSheet [data-trd]');
  await C.page.waitForFunction(() => /Rapport archive test/.test(document.querySelector('#rpFrame')?.srcdoc || '') && !document.querySelector('#modal')?.hidden, null, { timeout: 20000 });
  assert.equal(await C.page.evaluate(() => document.querySelector('#rpFrame').getAttribute('sandbox')), '', 'cadre du rapport en sandbox sans permission');
  await C.page.waitForTimeout(500);
  assert.deepEqual(await C.page.evaluate(() => [window.__xss ?? null, localStorage.getItem('xss')]), [null, null], 'le script du rapport n’a rien exécuté');
  assert.equal(C.requetes.length, avant.requetes, 'aucune requête vers /api/archive pendant la lecture hors réseau');
  assert.equal(m.appels.Romain, avant.serveur, 'rien n’est arrivé au serveur');
  assert.equal(C.requetes.filter((x) => x === 'PUT').length, avant.puts, 'C n’a rien renvoyé');
  assert.equal(m.blob.ops.log.filter((o) => o.op === 'put').length, avant.ecritures, 'aucune écriture en ligne de plus');
  assert.equal((await lireTraces(C.page)).length, 1, 'une seule trace chez C'); assert.equal((await regateNommee(C.page, NOM_SNPM)).traces.length, 1, 'une seule référence');
  assert.deepEqual(await mancheLocales(C.page), [apres], 'les manches de l’équipage sont toujours lisibles chez C, réseau coupé');
  for (const t of tous) sansErreur(t.erreurs, `sur ${t.nom}`);
  for (const t of tous) await t.ctx.close();
}

// ───────────────────────── rattrapage des traces d'avant l'archive (ARCH2-01, D-01 à D-03, D-10, D-11)

const REPRISE = 'rade.reprise.v1';
const reprisePosee = (page) => page.waitForFunction((k) => !!JSON.parse(localStorage.getItem(k) || 'null')?.done, REPRISE, { timeout: 60000, polling: 100 });
const lireReprise = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), REPRISE);
const journalDe = async (page) => { await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); return page.evaluate(() => localStorage.getItem('rade.diag.v1') || ''); };
// Écrit dans la base de traces de la page (même base que l'app) : le GPX de la Coupe SNPM, avec un ancien identifiant aléatoire si `suffixe` est donné
// ('tr' + début + suffixe, comme avant la v31), un rapport local éventuel. Rend { id, stable } (stable = l'identifiant actuel de fromGPX)
const poseTrace = (page, texteGpx, { suffixe = null, report = null } = {}) => page.evaluate(async ([txt, suf, rp]) => {
  const { fromGPX, saveTrack } = await import('/js/track.js');
  const tr = fromGPX(txt, 'snpm.gpx'), stable = tr.id;
  if (suf) tr.id = 'tr' + tr.start + suf;
  if (rp) tr.report = rp;
  await saveTrack(tr);
  return { id: tr.id, stable };
}, [texteGpx, suffixe, report]);
const poseOrpheline = (page) => page.evaluate(async () => {
  const { saveTrack } = await import('/js/track.js');
  const t0 = Date.parse('2026-09-01T08:00:00Z');
  await saveTrack({ id: 'tr' + t0, name: 'Entraînement du 01/09', start: t0, course: null, pts: [0, 1, 2].map((i) => [t0 + i * 60000, 43.07, 5.93, null, null, 5]) });
  return 'tr' + t0;
});

async function reprise({ browser, base }) {
  const NOM = 'Équipier test', TEXTE = readFileSync(GPX_SNPM, 'utf8');
  // 1) Un téléphone qui a déjà servi : appareil neuf (aucune trace) → passage sans trace, drapeau posé ; puis ses traces d'avant sont posées et le drapeau retiré
  const ctx = await ouvreContexte(browser, { heure: '2026-10-20T10:00:00Z' });          // lendemain de régate : aucun verrou
  await simuleMembre(ctx, NOM);
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);
  await membreGarde(page, NOM);
  await reprisePosee(page);
  assert.equal((await lireReprise(page)).rangees, 0, 'appareil neuf : rien à ranger');
  const idSnpm = (await poseTrace(page, TEXTE)).id, idOrph = await poseOrpheline(page);
  await page.evaluate((k) => localStorage.removeItem(k), REPRISE);                       // premier lancement de la v32 sur un téléphone qui a déjà servi
  await ouvreApp(page, base);
  await toastVu(page, '1 trace rangée dans l’archive', 30000);
  await reprisePosee(page);
  const flag1 = await lireReprise(page);
  assert.equal(flag1.rangees, 1); assert.equal(flag1.laissees, 1);
  const idx = await indexRegates(page);
  const snpm = idx.list.find((r) => r.id === 'snpm-2026');
  assert.equal(snpm.traces.length, 1, 'la Coupe SNPM porte une seule référence');
  assert.equal(snpm.traces[0].id, idSnpm); assert.equal(snpm.traces[0].by, NOM); assert.equal(snpm.traces[0].n, 9538);
  assert.ok(idx.list.every((r) => !r.traces.some((t) => t.id === idOrph)), 'l’orpheline n’est dans aucune régate');
  assert.equal(idx.list.length, 1, 'aucune fiche créée (D-02)');
  assert.ok((await lireTraces(page)).some((t) => t.id === idOrph), 'l’orpheline reste dans « Traces »');
  assert.ok((await lireTraces(page)).some((t) => t.id === idSnpm), 'la trace rangée reste aussi sur le téléphone');
  assert.match(await journalDe(page), /reprise/, 'une ligne reprise au journal');
  // 2) Relance : sans effet (même drapeau, même instant, toujours une seule référence)
  await ouvreApp(page, base);
  await page.waitForTimeout(4000);
  assert.deepEqual(await lireReprise(page), flag1, 'drapeau inchangé après une relance');
  assert.equal((await indexRegates(page)).list.find((r) => r.id === 'snpm-2026').traces.length, 1);
  sansErreur(erreurs, 'rattrapage sur un téléphone');
  await ctx.close();

  // 3) Deux téléphones qui avaient importé le même GPX avant la v31 (deux identifiants au hasard) : une seule référence, un seul envoi au magasin (D-10),
  //    le rapport fait sur le premier est annoncé et reçu par le second (D-11)
  const m = await mondeArchive('2026-10-20T10:00:00Z');
  const A = await telephoneArchive(browser, base, m, 'Teiva'), B = await telephoneArchive(browser, base, m, 'Thibaud');
  const RAPPORT = { html: '<p>Rapport du premier</p>', t: Date.UTC(2026, 9, 18, 15), name: 'Débrief SNPM' };
  let stable = null;
  for (const [tel, suffixe, rapport] of [[A, '417', RAPPORT], [B, '82', null]]) {
    await reprisePosee(tel.page);                                                         // premier lancement : appareil neuf, rien à ranger
    stable = (await poseTrace(tel.page, TEXTE, { suffixe, report: rapport })).stable;
    await tel.page.evaluate((k) => localStorage.removeItem(k), REPRISE);
    await ouvreApp(tel.page, base);                                                       // premier lancement de la v32 sur ce téléphone
    await reprisePosee(tel.page);
    assert.deepEqual((await lireTraces(tel.page)).map((t) => t.id), [stable], `${tel.nom} : l’ancien identifiant est remplacé par l’identifiant stable`);
    assert.equal((await indexRegates(tel.page)).list.find((r) => r.id === 'snpm-2026').traces.map((t) => t.id).join(), stable);
  }
  const chemins = { trace: `preview/trace/${stable}.json`, report: `preview/report/${stable}-${RAPPORT.t}.json` };
  await avanceHeure(m, 60e3);
  await synchronise(m, A);
  await attendre(() => m.blob.store.has(chemins.trace) && m.blob.store.has(chemins.report), 'trace et rapport de A en ligne');
  await avanceHeure(m, 60e3);
  await synchronise(m, B);                                                                // la fiche de B rencontre celle de A : une seule référence
  await attendre(async () => (await lireTraceLocale(B.page, stable))?.report, 'rapport de A reçu par B');
  assert.equal((await lireTraceLocale(B.page, stable)).report.name, 'Débrief SNPM');
  for (const tel of [A, B]) {
    const ref = (await indexRegates(tel.page)).list.find((r) => r.id === 'snpm-2026').traces;
    assert.deepEqual(ref.map((t) => t.id), [stable], `${tel.nom} : une seule référence, d’identifiant stable`);
    assert.equal(ref[0].report?.t, RAPPORT.t, `${tel.nom} : le rapport du premier est annoncé sur la référence`);
    assert.deepEqual((await lireTraces(tel.page)).map((t) => t.id), [stable], `${tel.nom} : aucun identifiant au hasard`);
  }
  const ecrits = m.blob.ops.log.filter((o) => o.op === 'put').map((o) => o.path);
  assert.equal(ecrits.filter((c) => c.includes('/trace/')).length, 1, `un seul envoi de la trace au magasin : ${ecrits}`);
  assert.equal(ecrits.filter((c) => c.includes('/report/')).length, 1, 'un seul envoi du rapport');
  sansErreur(A.erreurs, 'sur le premier téléphone'); sansErreur(B.erreurs, 'sur le second téléphone');
  await A.ctx.close(); await B.ctx.close();
}

// Guide de prise en main (guide.html, tâche rapide 261020-eaq) : rendu sur téléphone, ancres, aucune requête hors de l’hôte local, impression.
// GUIDE_SHOT=<dossier> : écrit une seule capture de la page entière en 390 px de large, guide-390.png (pour la relire à l’œil).
async function guide({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-11-07T07:30:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  const dehors = [];
  page.on('request', (r) => { let h = ''; try { h = new URL(r.url()).hostname; } catch { /* adresse illisible : comptée comme extérieure */ } if (h !== '127.0.0.1') dehors.push(r.url().slice(0, 80)); });
  await page.goto(base + 'guide.html', { waitUntil: 'load' });
  const largeur = () => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vue: document.documentElement.clientWidth }));
  const sansDefilement = async (quand) => { const l = await largeur(); assert.ok(l.doc <= l.vue, `défilement horizontal ${quand} : page ${l.doc} px pour une fenêtre de ${l.vue} px`); };

  // téléphone 390 × 844 : pas de défilement horizontal, images chargées, ancres résolues
  await sansDefilement('sur téléphone');
  const images = await page.evaluate(() => [...document.images].map((i) => i.complete && i.naturalWidth > 0));
  assert.ok(images.length > 0 && images.every(Boolean), 'toutes les images sont chargées');
  const cassees = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].filter((a) => !document.getElementById(a.getAttribute('href').slice(1))).map((a) => a.getAttribute('href')));
  assert.deepEqual(cassees, [], 'chaque lien # a sa destination');

  // une seule capture de la page entière, à la demande, avant tout clic (la barre collante n’a pas encore défilé)
  if (process.env.GUIDE_SHOT) {
    mkdirSync(process.env.GUIDE_SHOT, { recursive: true });
    await page.screenshot({ path: join(process.env.GUIDE_SHOT, 'guide-390.png'), fullPage: true, scale: 'css' });
  }

  // « En 1 minute » se voit dès l’ouverture, sans défiler : son titre tient dans l’écran et passe sous la barre collante du sommaire
  const haut = await page.evaluate(() => ({ titre: document.querySelector('#minute h2').getBoundingClientRect().bottom, barre: document.querySelector('nav.toc').getBoundingClientRect().bottom, fenetre: window.innerHeight }));
  assert.ok(haut.titre > haut.barre && haut.titre < haut.fenetre, `« En 1 minute » visible à l’ouverture (titre à ${Math.round(haut.titre)} px, barre à ${Math.round(haut.barre)} px, fenêtre ${haut.fenetre} px)`);

  // chaque lien du sommaire détaillé et de la barre collante amène sa section à l’écran, sous la barre
  const ids = await page.evaluate(() => [...document.querySelectorAll('nav.sommaire a')].map((a) => a.getAttribute('href').slice(1)));
  assert.ok(ids.length >= 17, `le sommaire détaillé liste les sections (${ids.length})`);
  for (const [nav, lien] of [['nav.sommaire', (id) => `nav.sommaire a[href="#${id}"]`], ['nav.toc', (id) => `nav.toc a[href="#${id}"]`]]) {
    for (const id of ids) {
      await page.locator(lien(id)).click();
      await page.waitForFunction((x) => location.hash === `#${x}`, id, { timeout: 5000 });
      const r = await page.evaluate((x) => ({ haut: document.getElementById(x).getBoundingClientRect().top, barre: document.querySelector('nav.toc').getBoundingClientRect().bottom, fenetre: window.innerHeight }), id);
      assert.ok(r.haut >= r.barre - 2 && r.haut < r.fenetre, `${nav} → #${id} : section en haut sous la barre (haut ${Math.round(r.haut)} px, barre ${Math.round(r.barre)} px)`);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  // paysage 844 × 390
  await page.setViewportSize({ width: 844, height: 390 });
  await sansDefilement('en paysage');

  // impression : barre collante cachée, fond blanc, texte noir
  await page.emulateMedia({ media: 'print' });
  const imprime = await page.evaluate(() => ({ barre: getComputedStyle(document.querySelector('nav.toc')).display, fond: getComputedStyle(document.body).backgroundColor, encre: getComputedStyle(document.body).color, bouton: getComputedStyle(document.querySelector('.hero a.open')).display }));
  assert.equal(imprime.barre, 'none', 'barre collante cachée à l’impression');
  assert.equal(imprime.bouton, 'none', 'boutons du bandeau cachés à l’impression');
  assert.equal(imprime.fond, 'rgb(255, 255, 255)', 'fond blanc à l’impression');
  assert.equal(imprime.encre, 'rgb(0, 0, 0)', 'texte noir à l’impression');

  assert.deepEqual(dehors, [], `requête hors de l’hôte local : ${dehors.join(' ; ')}`);
  sansErreur(erreurs, 'sur le guide');
  await ctx.close();
}

// Jour de régate, GPS simulé : le GPS allumé d’office par le mode départ ou la trace s’arrête avec la dernière activité de course (✕, ⏹, Stop) et l’app ne se
// croit plus en course ; mais jamais tant qu’un chrono, une trace, le mode départ ou un GPS allumé à la main tournent, et rien ne s’échange tant qu’un GPS tourne (D-03).
// Le verrou de mise à jour se lit à la dernière entrée « verrou » du journal (rade.diag.v1) ; la synchronisation à #rgSync ; le GPS à #gOn / #gOff ; la bande à #raceBar.
async function retourPort({ browser, base }) {
  const m = await mondeArchive('2026-11-07T09:30:00Z');                                  // samedi 07/11/2026, 10 h 30 à Paris
  const tel = await telephoneArchive(browser, base, m, 'Teiva', { geo: { latitude: 43.09, longitude: 5.93 } });
  const { page } = tel;
  let etape = 'début';
  const enPause = async (oui, delai = 12000) => {
    try { await page.waitForFunction((v) => /^En pause pendant la course/.test(document.querySelector('#rgSync')?.textContent ?? '') === v, oui, { timeout: delai }); }
    catch { assert.fail(`étape ${etape} : pause ${oui ? 'attendue' : 'levée attendue'}, ligne « ${await ligneSync(page)} », GPS ${await gpsAllume() ? 'allumé' : 'éteint'}, journal ${JSON.stringify((await entrees()).slice(-6).map((x) => `${x.w}:${x.m}`))}`); }
  };
  const gpsAllume = () => page.evaluate(() => !!document.querySelector('#gOff') && !document.querySelector('#gOn'));
  const barre = () => page.evaluate(() => { const b = document.getElementById('raceBar'); return !!b && !b.hidden; });
  const entrees = async () => { await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); return JSON.parse(await page.evaluate(() => localStorage.getItem('rade.diag.v1') || '[]')); };
  const verrou = async () => (await entrees()).filter((x) => x.w === 'verrou').at(-1)?.m ?? null;
  const gpsArretes = async () => (await entrees()).filter((x) => x.w === 'gps' && x.m.startsWith('arrêté')).map((x) => x.m);
  const attend = async (quoi, lire, attendu, delai = 25000) => {
    const fin = Date.now() + delai;
    for (;;) {
      const v = await lire();
      if (v === attendu) return;
      if (Date.now() > fin) assert.fail(`${quoi} : « ${v} » au lieu de « ${attendu} » après ${delai / 1000} s`);
      await page.waitForTimeout(400);
    }
  };
  const onglet = (nom) => page.click(`#tabs button[data-tab=${nom}]`);
  const gpsEtat = async (quoi, allume) => { await onglet('live'); await attend(quoi, gpsAllume, allume, 8000); };
  const rienNeBouge = async (quoi) => { const n = tel.requetes.length; await page.waitForTimeout(3500); assert.equal(tel.requetes.length, n, `${quoi} : aucun échange avec l’archive tant qu’un GPS ou un chrono tourne`); };

  await creeRegate(page, { nom: 'Régate du jour', debut: '2026-11-07', club: 'CVAT' });
  await synchronise(m, tel);
  await gpsEtat('au départ : GPS éteint', false);
  await attend('verrou avant toute activité', verrou, 'journée de régate');

  etape = 'a';
  // (a) un chrono : en pause et verrou « en course » ; Stop : la pause disparaît, le verrou du jour de régate reste
  await onglet('start'); await page.click('#t5');
  await enPause(true);
  await attend('verrou pendant le chrono', verrou, 'en course');
  await page.click('#tstop');
  await enPause(false);
  await attend('verrou après Stop', verrou, 'journée de régate');
  assert.deepEqual(await gpsArretes(), [], 'aucun GPS à éteindre : un chrono seul ne l’allume pas');

  etape = 'b';
  // (b) mode départ ouvert (GPS d’office), puis ✕ sans chrono : le GPS s’arrête, l’app ne se croit plus en course
  await onglet('start'); await page.click('#smOpen');
  await page.waitForSelector('#startMode', { state: 'visible', timeout: 10000 });
  await enPause(true);
  await page.click('#startMode [data-a=close]');
  await gpsEtat('✕ sans chrono : le GPS d’office s’arrête', false);
  await enPause(false, 8000);
  await attend('✕ sans chrono : la bande de course disparaît', barre, false, 8000);
  await attend('verrou après ✕', verrou, 'journée de régate');
  assert.deepEqual(await gpsArretes(), ['arrêté : mode départ fermé'], 'l’arrêt est consigné au journal avec sa raison');

  etape = 'c';
  // (c) mode départ, DÉPART 5’, puis ✕ : le chrono tourne, le GPS n’est PAS coupé, toujours en pause ; Stop : tout s’arrête
  await onglet('start'); await page.click('#smOpen');
  await page.waitForSelector('#startMode', { state: 'visible', timeout: 10000 });
  await page.click('#startMode [data-a=go]');
  await page.click('#startMode [data-a=close]');
  await gpsEtat('✕ avec un chrono : le GPS reste allumé', true);
  await enPause(true);
  await attend('✕ avec un chrono : la bande de course reste', barre, true, 8000);
  await rienNeBouge('✕ avec un chrono');
  assert.equal((await gpsArretes()).length, 1, 'rien de plus au journal : le GPS n’a pas été coupé');
  await onglet('start'); await page.click('#tstop');
  await gpsEtat('Stop après ✕ : le GPS d’office s’arrête', false);
  await enPause(false, 8000);
  assert.deepEqual(await gpsArretes(), ['arrêté : mode départ fermé', 'arrêté : chrono arrêté']);
  await attend('verrou après Stop (GPS d’office)', verrou, 'journée de régate');

  etape = 'd';
  // (d) trace : ⏺ allume le GPS d’office, en pause ; une saisie faite pendant la pause attend ; ⏹ éteint le GPS, la pause disparaît, la synchronisation repart
  await onglet('live'); await page.click('#recStart');
  await enPause(true);
  await creeRegate(page, { nom: 'Saisie pendant la trace', debut: '2026-11-14', club: 'CVAT' });
  await page.click('#rgSyncBtn');
  await rienNeBouge('pendant la trace');
  await onglet('live'); await page.click('#recStop');
  await gpsEtat('⏹ : le GPS allumé par la trace s’arrête', false);
  await enPause(false, 8000);
  await synchronise(m, tel);
  assert.match(await ligneSync(page), /^À jour/, 'la synchronisation repart après ⏹ : « À jour »');
  assert.ok((await noms(page)).includes('Saisie pendant la trace'));
  assert.equal((await gpsArretes()).at(-1), 'arrêté : trace arrêtée');
  await attend('verrou après ⏹', verrou, 'journée de régate');         // le tic de course a vu la fin : le prochain GPS sera vu comme un début

  etape = 'e';
  // (e) GPS allumé à la main : ✕ du mode départ ne le coupe pas ; « Arrêter le GPS » seul le coupe
  await onglet('live'); await page.click('#gOn');
  await gpsEtat('▶ Activer le GPS', true);
  await enPause(true);
  await onglet('start'); await page.click('#smOpen');
  await page.waitForSelector('#startMode', { state: 'visible', timeout: 10000 });
  await page.click('#startMode [data-a=close]');
  await gpsEtat('✕ avec un GPS manuel : il reste allumé', true);
  await enPause(true);
  await rienNeBouge('GPS allumé à la main');
  const nArrets = (await gpsArretes()).length;
  await page.click('#gOff');
  await gpsEtat('Arrêter le GPS', false);
  await enPause(false, 8000);
  assert.equal((await gpsArretes()).length, nArrets, 'le GPS manuel est arrêté par l’équipier, pas par releaseGps');

  etape = 'f';
  // (f) 🏁 Course finie : le verrou du jour de régate se lève
  await onglet('live'); await page.click('#raceDone');
  await toastVu(page, 'Course finie notée', 10000);
  await attend('verrou après « Course finie »', verrou, 'libre');

  sansErreur(tel.erreurs, 'au retour au port');
  await tel.ctx.close();
}

// Défaut du 20/10 : en-têtes de sécurité de vercel.json. L’app, la page d’accès, le partage et le rapport public marchent sous leur politique de contenu ;
// la moindre violation (relevée par INIT, toutes pages et fenêtres) ou le moindre chemin refusé par la liste blanche fait échouer le scénario (voir main).
// Aucun vrai code d’accès : seul le faux code « code-de-test » est saisi, et la page visée est interceptée.
async function entetes({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T08:30:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  const attendu = (chemin) => entetesPour(chemin, REGLES_VERCEL);

  // (a) en-têtes du document de l’app, et nosniff sur un script lu par l’API de requête
  const rep = await page.goto(base, { waitUntil: 'load' });
  const h = rep.headers();
  const e = attendu('/');
  for (const k of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options']) assert.equal(h[k], e[k], `en-tête ${k} du document de l’app`);
  assert.equal(h['x-content-type-options'], 'nosniff');
  assert.match(h['content-security-policy'], /script-src 'self';/);
  assert.equal((await page.request.get(base + 'js/app.js')).headers()['x-content-type-options'], 'nosniff', 'nosniff sur js/app.js');
  await pret(page);

  // (c) fenêtre de partage : le QR code est un SVG dessiné par le code, sous la politique de contenu
  await page.click('#shareBtn');
  await page.waitForSelector('svg.qr', { timeout: 10000 });

  // (b) page d’accès : script hors de la page (acces.js), même règle « suite » qu’avant
  const acces = await ctx.newPage();
  await acces.goto(base + 'acces.html?erreur=1&suite=%2Fguide.html', { waitUntil: 'load' });
  assert.equal(await acces.locator('#err').isVisible(), true, 'le message d’erreur est visible (acces.js a tourné)');
  await acces.fill('#code', '  Code-De-Test  ');
  await Promise.all([acces.waitForURL((u) => u.pathname === '/guide.html' && u.search === '?acces=code-de-test', { timeout: 10000 }), acces.click('button[type=submit]')]);
  // une suite vers un autre site est ignorée : retour à « / » (l’adresse visée est interceptée, jamais envoyée au serveur)
  await acces.route(/\/\?acces=code-de-test$/, (r) => r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: 'intercepté' }));
  await acces.goto(base + 'acces.html?suite=%2F%2Fexemple.test', { waitUntil: 'load' });
  assert.equal(await acces.locator('#err').isVisible(), false, 'pas de message d’erreur sans ?erreur');
  await acces.fill('#code', 'code-de-test');
  await Promise.all([acces.waitForURL((u) => u.pathname === '/' && u.search === '?acces=code-de-test', { timeout: 10000 }), acces.click('button[type=submit]')]);
  await acces.close();

  // (d) rapport public : politique propre aux rapports, son script tourne
  const rp = await ctx.newPage();
  const rr = await rp.goto(base + 'rapports/coupe-snpm-2026.html', { waitUntil: 'load' });
  assert.equal(rr.headers()['content-security-policy'], attendu('/rapports/coupe-snpm-2026.html')['content-security-policy'], 'politique des rapports');
  assert.equal(rr.headers()['x-frame-options'], 'DENY');
  await rp.waitForFunction(() => document.getElementById('map')?.childElementCount > 0 && document.getElementById('windChart')?.childElementCount > 0, null, { timeout: 15000 });
  await rp.close();

  sansErreur(erreurs, 'sous les en-têtes de sécurité');
  await ctx.close();
}


// D-A1 à D-A5 : l’app s’ouvre en « Entraînement libre » un jour sans régate (jeudi 22/10/2026), même avec la Coupe SNPM dans l’archive ;
// tout ce qui sert en mer marche sans régate ; une régate s’ouvre et se ferme d’un geste ; rien n’est gardé d’un lancement à l’autre ;
// un index de la v36 qui marquait la Coupe SNPM courante est réécrit sans cette clé.
const GEO_RADE = { latitude: 43.09, longitude: 5.93 };
const bandeau = (page) => page.evaluate(() => ({ texte: document.querySelector('#regBar').textContent.replace(/\s+/g, ' ').trim(), ouverte: document.querySelector('#regBar').dataset.open }));
async function accueil({ browser, base }) {
  const ctx = await ouvreContexte(browser, { heure: '2026-10-22T08:30:00Z', geo: GEO_RADE });       // jeudi 22/10/2026, 10 h 30 à Paris
  const { page, erreurs } = await ouvrePage(ctx);
  await ouvreApp(page, base);

  // (a) appareil neuf : entraînement libre, la Coupe SNPM est dans l’archive mais pas ouverte
  let b = await bandeau(page);
  assert.equal(b.ouverte, '', 'aucune régate ouverte au lancement'); assert.match(b.texte, /Entraînement libre/);
  assert.equal(await page.locator('#regGo').textContent(), 'Ouvrir une régate');
  let idx = await indexRegates(page);
  assert.deepEqual(idx.list.map((r) => r.id), ['snpm-2026']); assert.ok(!('current' in idx), 'aucune clé current dans l’index');
  await page.click('#tabs button[data-tab=ic]');
  assert.match(await page.locator('#rgNone').textContent(), /Aucune régate ouverte/);
  assert.equal(await page.locator('#rgSheet').count(), 0, 'pas de fiche sans régate ouverte');
  assert.equal(await page.locator('#rgList [data-rg]').count(), 1);
  let liste = await lireListe(page);
  assert.deepEqual(liste.map((g) => g.status), ['Terminées']); assert.equal(liste[0].rows[0].id, 'snpm-2026'); assert.ok(!liste[0].rows[0].open);
  assert.equal(await page.locator('#rgList [data-rg="snpm-2026"]').textContent(), 'Ouvrir');
  assert.equal(await page.locator('#rgNone label[for=icFile]').textContent(), '＋ Importer des IC (PDF)');
  for (const id of ['#evDel', '#evEdit', '#evUse']) assert.equal(await page.locator(id).count(), 0, `${id} n’a de sens que dans une régate`);
  assert.doesNotMatch(await page.locator('#daySeg').textContent(), /🏁/, 'aucun jour de course marqué');
  await page.click('#tabs button[data-tab=brief]');
  assert.doesNotMatch(await page.locator('section[data-tab=brief]').textContent(), /Coupe de la SNPM|1er avertissement/, 'le briefing ne parle d’aucune épreuve');

  // le chrono (séquence commune), le mode départ, le GPS et la trace marchent sans régate
  await page.click('#tabs button[data-tab=start]');
  assert.ok((await page.locator('.card.timer table.t tr').count()) >= 4, 'séquence de départ commune CVAT');
  assert.equal(await page.locator('#tPhase').textContent(), 'Prêt');
  await page.click('#t5');
  await page.waitForFunction(() => document.querySelector('#tPhase').textContent !== 'Prêt', null, { timeout: 10000 });
  await page.click('#tstop');
  await page.waitForFunction(() => document.querySelector('#tPhase').textContent === 'Prêt', null, { timeout: 10000 });
  await page.click('#smOpen');
  await page.waitForSelector('#startMode', { state: 'visible', timeout: 10000 });
  await page.click('#startMode [data-a=close]');
  await page.waitForSelector('#startMode', { state: 'hidden', timeout: 10000 });
  await page.click('#tabs button[data-tab=live]');
  await page.click('#gOn');
  await page.waitForFunction(() => /précision ±/.test(document.querySelector('#liveGps')?.textContent || ''), null, { timeout: 20000 });
  await page.click('#recStart');
  await page.waitForSelector('#recStop', { timeout: 10000 });
  await page.click('#recStop');
  await page.waitForSelector('#recStart', { timeout: 10000 });
  await page.waitForSelector('#gOff', { timeout: 10000 });                       // GPS allumé à la main : la trace ne le coupe pas
  await page.click('#gOff'); await page.waitForSelector('#gOn', { timeout: 10000 });
  assert.equal(await idOuverte(page), '', 'rien de tout cela n’a ouvert de régate');

  // « Ouvrir une régate » mène à la liste
  await page.click('#tabs button[data-tab=brief]');
  await page.click('#regGo');
  await page.waitForSelector('section[data-tab=ic].on', { timeout: 10000 });
  assert.ok(await page.locator('#rgList').isVisible());

  // (b) « Ouvrir » sur la Coupe SNPM, puis « Fermer la régate »
  await page.click('#rgList [data-rg="snpm-2026"]');
  await page.waitForSelector('#regBar[data-open="snpm-2026"]', { timeout: 10000 });
  b = await bandeau(page);
  assert.match(b.texte, /🏁/); assert.match(b.texte, /Coupe de la SNPM/); assert.match(b.texte, /Terminée/); assert.match(b.texte, /Fermer la régate/);
  assert.match(await page.locator('#rgSheet h3').textContent(), /Coupe de la SNPM/);
  assert.match(await page.locator('section[data-tab=ic]').textContent(), /Instructions de course/);
  assert.equal(await page.locator('#rgNone').count(), 0);
  liste = await lireListe(page);
  assert.ok(liste[0].rows[0].open, 'la liste marque la régate ouverte'); assert.equal(await page.locator('#rgList [data-rg="snpm-2026"]').count(), 0, 'plus de bouton « Ouvrir » sur la régate ouverte');
  assert.doesNotMatch(await page.locator('#daySeg').textContent(), /🏁/, 'le 18/10 est passé : il n’est pas parmi les trois jours affichés');
  idx = await indexRegates(page); assert.ok(!('current' in idx), 'ouvrir n’écrit rien dans l’index');
  await fermeRegate(page);
  b = await bandeau(page); assert.match(b.texte, /Entraînement libre/);
  assert.equal(await page.locator('#rgNone').count(), 1); assert.equal(await page.locator('#rgSheet').count(), 0);

  // (c) le bandeau reste visible, dans la fenêtre, dans les trois hauteurs du panneau (moitié → grand → réduit → moitié), régate ouverte ou non
  const dansLaFenetre = async (quoi) => {
    await page.waitForTimeout(450);                                              // transition de hauteur du panneau
    const r = await page.evaluate(() => { const e = document.querySelector('#regBar').getBoundingClientRect(), p = document.querySelector('#panel').getBoundingClientRect(); return { top: e.top, bottom: e.bottom, h: e.height, w: e.width, pBottom: p.bottom, pTop: p.top, vh: innerHeight, vw: innerWidth }; });
    assert.ok(r.h > 20 && r.w > 200, `${quoi} : bandeau visible (${JSON.stringify(r)})`);
    assert.ok(r.top >= r.pTop && r.bottom <= Math.min(r.vh, r.pBottom) + 0.5, `${quoi} : bandeau dans le panneau et dans la fenêtre (${JSON.stringify(r)})`);
  };
  for (const [etat, ouvre] of [['sans régate', false], ['régate ouverte', true]]) {
    if (ouvre) await ouvreRegate(page, 'snpm-2026');
    await dansLaFenetre(`${etat}, moitié`);
    await page.click('#grab'); await dansLaFenetre(`${etat}, grand`);
    await page.click('#grab'); await dansLaFenetre(`${etat}, réduit`);
    await page.click('#grab'); await dansLaFenetre(`${etat}, moitié`);
  }
  await fermeRegate(page);

  // (d) rechargement : toujours en entraînement libre, même après avoir ouvert une régate (aucune mémoire d’un lancement à l’autre)
  await ouvreRegate(page, 'snpm-2026');
  await ouvreApp(page, base);
  b = await bandeau(page); assert.equal(b.ouverte, ''); assert.match(b.texte, /Entraînement libre/);
  assert.ok(!JSON.stringify(await page.evaluate(() => ({ ...localStorage }))).includes('"current"'), 'aucune trace de la régate ouverte dans le stockage');
  sansErreur(erreurs, 'pendant le scénario');
  const v36 = { ...(await indexRegates(page)), current: 'snpm-2026' };
  await ctx.close();

  // (e) téléphone resté en v36 : l’index porte « current: snpm-2026 » ; l’app s’ouvre en entraînement libre et réécrit l’index sans cette clé
  const ctx2 = await ouvreContexte(browser, { heure: '2026-10-22T08:30:00Z' });
  const { page: p2, erreurs: e2 } = await ouvrePage(ctx2);
  await p2.goto(base + 'data/meta.json');
  await p2.evaluate((v) => localStorage.setItem('rade.regates.v1', v), JSON.stringify(v36));
  await ouvreApp(p2, base);
  b = await bandeau(p2); assert.equal(b.ouverte, ''); assert.match(b.texte, /Entraînement libre/);
  const apres = await indexRegates(p2);
  assert.ok(!('current' in apres), 'l’index réécrit n’a plus de current');
  assert.deepEqual(apres.list, v36.list, 'la Coupe SNPM est intacte : mêmes champs');
  await p2.click('#tabs button[data-tab=ic]');
  liste = await lireListe(p2);
  assert.deepEqual(liste.map((g) => [g.status, g.rows.map((r) => r.id)]), [['Terminées', ['snpm-2026']]]);
  sansErreur(e2, 'avec un index v36');
  await ctx2.close();
}

// D-A3 : le jour d'une régate, l'app l'ouvre sans geste (au lancement, puis au passage de minuit sans relance, hors chrono) ; le verrou et le gel suivent
// la régate du jour de la liste, ouverte ou non. Index posé avant le premier chargement : une seule régate « Régate du lundi » (19/10, manche à 14 h), sans la
// Coupe SNPM ; les prévisions embarquées couvrent du 17 au 19/10, donc le gel se fait hors réseau comme dans le scénario gel.
async function jourJ({ browser, base }) {
  const manche14 = { n: 1, date: '2026-10-19', time: '14:00', courseId: 5, cls: 'G', laps: 2, note: '', by: null, at: 0 };
  const lundi = { ...regateSemee('lundi', 'Régate du lundi', '2026-10-19'), races: [manche14] };
  const JOUR = '2026-10-19';

  // (1) lundi 19/10, 8 h 30 à Paris : la régate est ouverte sans geste, 🏁 sur « Auj. », fiche visible, vent figé dans la fiche
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T06:30:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  await sème(page, base, [lundi]);
  assert.equal(await idOuverte(page), 'lundi', 'ouverte au lancement, sans geste');
  assert.match((await bandeau(page)).texte, /Régate du lundi/);
  assert.match(await page.locator('#daySeg button').first().textContent(), /Auj\. 🏁/);
  await ongletIC(page);
  assert.ok(await page.locator('#rgSheet').isVisible(), 'fiche de la régate visible');
  await page.waitForFunction(() => document.querySelector('#rgSheet .rgwind[data-day="2026-10-19"]')?.textContent.includes('Figé automatiquement'), null, { timeout: 30000 });
  assert.match(await texteVent(page, JOUR), /Figé automatiquement/);

  // (2) « Fermer la régate » : le verrou, « Course finie » et le gel suivent la liste, pas l'écran
  await fermeRegate(page);
  assert.match((await bandeau(page)).texte, /Entraînement libre/);
  await page.click('#tabs button[data-tab=live]');
  assert.equal(await page.locator('#raceDone').count(), 1, '« Course finie » reste là : le verrou suit la régate du jour de la liste');
  const nObs = async () => (await indexRegates(page)).list.find((r) => r.id === 'lundi').frozen?.[JOUR]?.nObs ?? 0;
  const avant = await nObs();
  await page.click('section[data-tab=live] #obsAdd');
  const t0 = Date.now();
  while ((await nObs()) <= avant) {
    if (Date.now() - t0 > 15000) assert.fail(`le relevé n’a pas été copié dans le vent figé de la régate fermée (nObs ${await nObs()})`);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(6500);                                                                   // au moins un tic de plus
  assert.equal(await idOuverte(page), '', 'fermée à la main le jour J : pas rouverte le même jour');
  sansErreur(erreurs, 'jour J');
  await ctx.close();

  // (3) dimanche 18/10, 22 h 30 : entraînement libre ; l'horloge passe 0 h 00 min 30 s sans recharger : la régate s'ouvre toute seule
  const ctx2 = await ouvreContexte(browser, { heure: '2026-10-18T20:30:00Z' });
  const { page: p2, erreurs: e2 } = await ouvrePage(ctx2);
  await sème(p2, base, [lundi]);
  assert.equal(await idOuverte(p2), '', 'la veille : entraînement libre');
  await ctx2.clock.setFixedTime(new Date('2026-10-18T22:00:30Z'));  // 00:00:30 le 19/10, heure de Paris
  await p2.waitForSelector('#regBar[data-open="lundi"]', { timeout: 15000 });
  await toastVu(p2, 'Jour de régate : Régate du lundi ouverte', 10000);
  sansErreur(e2, 'passage de minuit');
  await ctx2.close();

  // (4) même passage de jour pendant un chrono : pas d'ouverture tant qu'il tourne ; après Stop, ouverture au tic suivant
  const ctx3 = await ouvreContexte(browser, { heure: '2026-10-18T20:30:00Z' });
  const { page: p3, erreurs: e3 } = await ouvrePage(ctx3);
  await sème(p3, base, [lundi]);
  await p3.click('#tabs button[data-tab=start]'); await p3.click('#t5');
  await p3.waitForFunction(() => document.querySelector('#tPhase').textContent !== 'Prêt', null, { timeout: 10000 });
  await ctx3.clock.setFixedTime(new Date('2026-10-18T22:00:30Z'));
  await p3.waitForTimeout(8000);                                                                     // plus d'un tic de raceTick (5 s)
  assert.equal(await idOuverte(p3), '', 'pendant le chrono : aucune ouverture');
  await p3.click('#tstop');
  await p3.waitForSelector('#regBar[data-open="lundi"]', { timeout: 15000 });
  sansErreur(e3, 'passage de jour pendant un chrono');
  await ctx3.close();
}

// D-A4 : la régate ouverte est un état local de chaque téléphone ; ouvrir ou fermer ne change rien chez l'autre et ne voyage jamais dans l'archive
async function deuxTelephones({ browser, base }) {
  const m = await mondeArchive('2026-10-22T08:30:00Z');                                  // jeudi 22/10/2026, 10 h 30 à Paris
  const A = await telephoneArchive(browser, base, m, 'Teiva'), B = await telephoneArchive(browser, base, m, 'Thibaud');
  await avanceHeure(m, 60e3); await synchronise(m, A);
  await avanceHeure(m, 60e3); await synchronise(m, B);
  assert.equal(await idOuverte(A.page), ''); assert.equal(await idOuverte(B.page), '');

  // A ouvre la Coupe SNPM, puis crée « Régate du club » (21/11), qui devient la régate ouverte de A
  await ouvreRegate(A.page, 'snpm-2026');
  await creeRegate(A.page, { nom: 'Régate du club', debut: '2026-11-21', club: 'CVAT' });
  const club = await idOuverte(A.page);
  assert.ok(club && club !== 'snpm-2026', 'la régate créée est ouverte sur A');
  await avanceHeure(m, 60e3); await synchronise(m, A);
  await avanceHeure(m, 60e3); await synchronise(m, B);
  assert.equal(await idOuverte(B.page), '', 'B est toujours en entraînement libre');
  await B.page.click('#tabs button[data-tab=ic]');
  const listeB = await lireListe(B.page);
  const prep = listeB.find((g) => g.status === 'En préparation');
  assert.ok(prep?.rows.some((r) => r.name === 'Régate du club'), 'B voit « Régate du club » dans « En préparation »');
  assert.equal(await B.page.locator(`#rgList [data-rg="${club}"]`).textContent(), 'Ouvrir');
  assert.ok((m.puts || []).length > 0, 'au moins un envoi à l’archive a été vu');
  for (const corps of m.puts) assert.ok(!/"current"/.test(corps), 'aucun envoi ne porte d’état « régate ouverte »');
  assert.ok(!('current' in (await indexRegates(A.page))), 'l’index de A n’a pas de current');
  assert.ok(!('current' in (await indexRegates(B.page))), 'l’index de B non plus');

  // B ouvre « Régate du club » et synchronise ; A synchronise : la régate ouverte sur A n'a pas changé
  await ouvreRegate(B.page, club);
  await avanceHeure(m, 60e3); await synchronise(m, B);
  await avanceHeure(m, 60e3); await synchronise(m, A);
  assert.equal(await idOuverte(A.page), club, 'A garde sa régate ouverte');
  await fermeRegate(A.page);
  await avanceHeure(m, 60e3); await synchronise(m, A);
  await avanceHeure(m, 60e3); await synchronise(m, B);
  assert.equal(await idOuverte(B.page), club, 'fermer sur A ne ferme rien sur B');
  for (const corps of m.puts) assert.ok(!/"current"/.test(corps), 'toujours aucun état d’ouverture dans les envois');

  // A recharge : entraînement libre (aucune mémoire d'un lancement à l'autre)
  await ouvreRegate(A.page, club);
  await ouvreApp(A.page, base);
  assert.equal(await idOuverte(A.page), '', 'après rechargement : entraînement libre');
  sansErreur(A.erreurs, 'téléphone A'); sansErreur(B.erreurs, 'téléphone B');
  await A.ctx.close(); await B.ctx.close();
}

const SCENARIOS = { accueil, 'jour-j': jourJ, 'deux-telephones': deuxTelephones, reprise, equipage, archive, 'archive-bouees': archiveBouees, archivehors: archiveHors, creer, manche, auteur, ic, 'depuis-ic': depuisIC, vraisemblance, gel, 'debrief-tardif': debriefTardif, gpx, 'gpx-choix': gpxChoix, ia, 'ia-erreurs': iaErreurs, arbitre, bouees, guide, entetes, 'retour-port': retourPort };

// ───────────────────────── lancement

async function main() {
  const demandes = [...new Set(process.argv.slice(2))];
  const inconnus = demandes.filter((n) => !Object.hasOwn(SCENARIOS, n));
  if (inconnus.length) {
    for (const n of inconnus) console.error(`scénario inconnu : ${n} (connus : ${Object.keys(SCENARIOS).join(', ')})`);
    process.exit(verdict({ unknown: inconnus, requested: demandes, ok: [] }));
  }
  const requested = demandes.length ? demandes : Object.keys(SCENARIOS);
  process.env.PW_REQUIRED = '1';                              // toujours exigeant : tools/pw.mjs sort en 2 si Chromium est introuvable
  const { launchChromium } = await import('./pw.mjs');       // import dynamique : un import statique serait évalué avant la ligne ci-dessus

  const { serveur, base, refuses } = await demarreServeur({ root: ROOT });
  const ok = [];
  let browser, chromium = true;
  try {
    try { ({ browser } = await launchChromium({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--no-proxy-server'] })); }
    catch (e) { console.error('Chromium impossible à lancer : ' + e.message); chromium = false; }
    if (chromium) {
      for (const nom of requested) {
        let minuterie;
        const v0 = violations.length, r0 = refuses.length;
        try {
          await Promise.race([
            SCENARIOS[nom]({ browser, base }),
            new Promise((_, ko) => { minuterie = setTimeout(() => ko(new Error(`délai dépassé (${DELAI_MS / 1000} s)`)), DELAI_MS); }),
          ]);
          // le moindre écart de sécurité fait échouer le scénario : violation de la politique de contenu, ou chemin refusé par la liste blanche
          const admis = [...REFUS_ADMIS['*'], ...(REFUS_ADMIS[nom] || [])];
          const vues = violations.slice(v0), refusees = refuses.slice(r0).filter((x) => !admis.includes(x));
          if (vues.length) throw new Error(`violation CSP : ${[...new Set(vues)].join(' ; ')}`);
          if (refusees.length) throw new Error(`chemin refusé par la liste blanche : ${[...new Set(refusees)].join(' ; ')}`);
          console.log(`OK ${nom}`); ok.push(nom);
        } catch (e) { console.log(`ÉCHEC ${nom} : ${String(e.message || e).split('\n')[0].slice(0, 400)}${e && 'actual' in e && 'expected' in e ? ` — obtenu ${JSON.stringify(e.actual)?.slice(0, 200)}, attendu ${JSON.stringify(e.expected)?.slice(0, 200)}` : ''}${e?.stack ? ` @ ${String(e.stack).split('\n').find((l) => /regate-e2e/.test(l))?.trim().slice(-60) ?? ''}` : ''}`); } finally { clearTimeout(minuterie); }
      }
    }
  } catch (e) {
    console.error('Erreur hors scénario : ' + (e.message || e));          // serveur ou navigateur tombé : aucun « OK » de plus
  } finally {
    await browser?.close().catch(() => { /* déjà fermé */ });
    try { serveur.closeAllConnections?.(); serveur.close(); } catch { /* déjà arrêté */ }
  }
  const code = verdict({ requested, ok, chromium });
  console.log(`Bilan : ${ok.length}/${requested.length} scénario(s) OK${ok.length === requested.length ? '' : ` (manquants : ${requested.filter((n) => !ok.includes(n)).join(', ')})`}`);
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
