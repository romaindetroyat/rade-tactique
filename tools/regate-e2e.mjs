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

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extname, join, normalize } from 'node:path';
import assert from 'node:assert/strict';

// unknown : noms demandés qui n’existent pas ; requested : noms à lancer ; ok : noms qui ont affiché « OK » ; chromium : faux s’il n’a pas pu démarrer
export function verdict({ unknown = [], requested = [], ok = [], chromium = true } = {}) {
  if (unknown.length) return 1;
  if (!chromium) return 2;
  if (!requested.length) return 1;
  return requested.every((n) => ok.includes(n)) ? 0 : 1;
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DELAI_MS = 240000;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.pol': 'text/plain; charset=utf-8',
};

// Posé avant tout script de la page : accueil désactivé, dessin et téléversement WebGL neutralisés (le rendu logiciel de Chromium sans tête
// fausse les temps ; tout le travail JavaScript de la 3D reste exécuté), sondes de l’outil
const INIT = () => {
  try { localStorage.setItem('rade.welcome', '1'); } catch { /* stockage refusé : l’accueil s’ouvrira */ }
  // l’horloge de Playwright remplace performance.mark par une fonction vide : les marques de l’app sont relevées ici (après elle, voir ouvreContexte)
  const marque = performance.mark;
  performance.mark = function (nom) { (window.__marks ||= []).push(String(nom)); return marque.apply(this, arguments); };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (C) for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'generateMipmap']) if (C.prototype[f]) C.prototype[f] = function () {};
  }
};

// ───────────────────────── outils communs

async function ouvreContexte(browser, { heure }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  await ctx.clock.setFixedTime(new Date(heure));         // d’abord : INIT doit s’exécuter après le script de l’horloge de Playwright
  await ctx.addInitScript(INIT);
  // seul l’hôte local est joignable ; une route enregistrée ensuite par un scénario passe avant celle-ci
  await ctx.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.fallback() : route.abort()));
  return ctx;
}
// Page + liste des erreurs vues par la page (hors échecs de chargement voulus : réseau coupé)
function ouvrePage(ctx) {
  const erreurs = [];
  return ctx.newPage().then((page) => {
    page.on('pageerror', (e) => erreurs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
    return { page, erreurs };
  });
}
// L’app est prête quand la carte l’est (marque rt:map relevée par INIT) : plus aucun redessin automatique ne viendra défaire une saisie
const pret = (page) => page.waitForFunction(() => window.__marks?.includes('rt:map'), null, { timeout: 90000, polling: 100 });
const ouvreApp = async (page, base) => { await page.goto(base, { waitUntil: 'load' }); await pret(page); };
const sansErreur = (erreurs, quand) => assert.deepEqual(erreurs, [], `erreur de page ${quand} : ${erreurs.join(' ; ')}`);

// Liste des régates affichée : [{ status, rows: [{ id, name, cur }] }] avec les saisons
const lireListe = (page) => page.evaluate(() => [...document.querySelectorAll('section[data-tab=ic] .rgseason')].map((s) => {
  const out = { season: s.querySelector('h4')?.textContent.trim(), groups: [] };
  for (const el of s.children) {
    if (el.classList.contains('rgstatus')) out.groups.push({ status: el.textContent.trim(), rows: [] });
    else if (el.classList.contains('rg')) out.groups.at(-1).rows.push({ id: el.dataset.rg, name: el.querySelector('.rgn').textContent, text: el.textContent, cur: el.classList.contains('on') });
  }
  return out;
}));

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
  assert.equal(liste.length, 1, 'une seule saison');
  assert.equal(liste[0].season, 'Saison 2026');
  assert.deepEqual(liste[0].groups.map((g) => g.status), ['Aujourd’hui', 'Passée'], 'statuts : Aujourd’hui puis Passées');
  assert.equal(liste[0].groups[0].rows[0].name, NOM_PIEGE, 'le nom s’affiche en texte');
  assert.ok(liste[0].groups[0].rows[0].cur, 'la nouvelle régate est la courante');
  assert.equal(liste[0].groups[1].rows[0].id, 'snpm-2026', 'la Coupe SNPM est passée');
  assert.equal(await page.locator('section[data-tab=ic] img').count(), 0, 'aucune balise img dans l’onglet');
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'le nom piégé a exécuté du code');
  await page.click('#tabs button[data-tab=live]');
  assert.equal(await page.locator('#raceDone').count(), 1, 'jour de régate : la carte « Course finie » doit être là');

  // elle survit à un rechargement
  await ouvreApp(page, base);
  liste = await lireListe(page);
  assert.equal(liste[0].groups[0].rows[0].name, NOM_PIEGE, 'la régate a disparu au rechargement');
  assert.equal(await page.evaluate(() => localStorage.getItem('rade.events.v1')), ancien, 'rade.events.v1 modifiée au rechargement');

  // lundi 09/11 à 23 h 30 (Paris) : encore le dernier jour ; mardi 10/11 : passée, plus de carte « Course finie »
  await ctx.clock.setFixedTime(new Date('2026-11-09T22:30:00Z'));
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=live]');
  assert.equal(await page.locator('#raceDone').count(), 1, 'dernier jour à 23 h 30 : la carte doit rester');
  await ctx.clock.setFixedTime(new Date('2026-11-10T08:30:00Z'));
  await ouvreApp(page, base);
  liste = await lireListe(page);
  assert.deepEqual(liste[0].groups.map((g) => g.status), ['Passée'], 'le 10/11 la régate est passée');
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
  const reg = etat.idx.list.find((r) => r.id === etat.idx.current);
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
const regateCourante = (page) => page.evaluate(() => { const i = JSON.parse(localStorage.getItem('rade.regates.v1')); return i.list.find((r) => r.id === i.current); });

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
  let reg = await regateCourante(page);
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
  reg = await regateCourante(p2);
  assert.equal(reg.by, null); assert.equal(reg.races[0].by, null);
  assert.equal(await p2.evaluate(() => localStorage.getItem('rade.membre.v1')), null, 'rien de gardé sans réponse');
  servi2.ok = true;                                          // le réseau revient : au rechargement, la réponse arrive
  await ouvreApp(p2, base);
  await membreGarde(p2, NOM);
  await p2.waitForFunction(() => document.querySelector('#rgWho')?.textContent.includes('Vous : Équipier test'), null, { timeout: 20000 });
  await p2.click('#tabs button[data-tab=ic]');
  assert.match(await p2.locator('section[data-tab=ic] .rg.on').textContent(), /par Équipier test/, 'la régate créée hors réseau est complétée');
  assert.match(await p2.locator('#rgSheet .rgrace').textContent(), /par Équipier test/, 'la manche créée hors réseau est complétée');
  reg = await regateCourante(p2);
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
  assert.equal((await regateCourante(page)).ic, null, 'une régate créée n’a pas d’IC');
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
  assert.equal((await regateCourante(page)).ic, null, 'rien n’entre avant « Valider les IC »');
  assert.match(await page.locator('#icVal').textContent(), /Pas encore d’IC validées/);
  // un changement d'onglet n'écrit rien non plus
  await page.click('#tabs button[data-tab=live]'); await page.click('#tabs button[data-tab=ic]');
  assert.equal((await regateCourante(page)).ic, null, 'changement d’onglet : rien d’écrit');

  // « Annuler » : la relecture disparaît, toujours rien
  await page.click('#icCancel');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  assert.equal((await regateCourante(page)).ic, null, '« Annuler » : rien d’écrit');
  // une relance abandonne aussi une relecture ouverte
  await importeIC(page);
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=ic]');
  assert.equal(await page.locator('#icReview').count(), 0, 'relance : la relecture est abandonnée');
  assert.equal((await regateCourante(page)).ic, null, 'relance : rien d’écrit');

  // nouvel import, correction d'un champ puis « Valider les IC »
  await importeIC(page);
  await page.fill('#icf-zone', 'Rade de Toulon corrigée');
  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg = await regateCourante(page);
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
  // elle survit à un rechargement
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=ic]');
  assert.match(await page.locator('#icVal').textContent(), /IC validées/);
  assert.equal((await regateCourante(page)).ic.fields.vhf, 72);
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

const SCENARIOS = { creer, manche, auteur, ic };

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

  const serveur = createServer(async (req, res) => {
    try {
      let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u.endsWith('/')) u += 'index.html';
      const f = normalize(join(ROOT, u));
      if (f !== ROOT.slice(0, -1) && !f.startsWith(ROOT)) throw new Error('hors dépôt');
      const octets = await readFile(f);
      res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(octets);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${serveur.address().port}/`;
  const ok = [];
  let browser, chromium = true;
  try {
    try { ({ browser } = await launchChromium({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--no-proxy-server'] })); }
    catch (e) { console.error('Chromium impossible à lancer : ' + e.message); chromium = false; }
    if (chromium) {
      for (const nom of requested) {
        let minuterie;
        try {
          await Promise.race([
            SCENARIOS[nom]({ browser, base }),
            new Promise((_, ko) => { minuterie = setTimeout(() => ko(new Error(`délai dépassé (${DELAI_MS / 1000} s)`)), DELAI_MS); }),
          ]);
          console.log(`OK ${nom}`); ok.push(nom);
        } catch (e) { console.log(`ÉCHEC ${nom} : ${String(e.message || e).split('\n')[0].slice(0, 400)}`); } finally { clearTimeout(minuterie); }
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
