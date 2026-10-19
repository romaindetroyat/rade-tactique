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
import { readFileSync } from 'node:fs';
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
  assert.equal((await regateCourante(page)).ic, null);
  e = await saisit(page, 'vhf', '');
  assert.equal(e.bouton, false);
  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg = await regateCourante(page);
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
const gelDuJour = (page, jour) => regateCourante(page).then((r) => r?.frozen?.[jour] ?? null);
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
  const id = (await regateCourante(page)).id;
  const f = await attendGel(page, '2026-10-18', () => true, 'première copie');
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
  await creeRegate(p2, { nom: 'Ouverte trop tard', debut: '2026-10-18', club: 'CVAT' });
  await ajouteManche(p2, { heure: '10:55', parcours: '5', cls: 'G', tours: '2' });
  const id2 = (await regateCourante(p2)).id;
  const t = await attendGel(p2, '2026-10-18', () => true, 'copie tardive');
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
  const id3 = (await regateCourante(p3)).id;
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
  await ongletTraces(page);
  await page.setInputFiles('#gpxIn', GPX_SNPM);
  await toastVu(page, 'Trace rangée dans Coupe de la SNPM — CVAT');
  // le questionnaire du débrief s'ouvre seul, pré-rempli : épreuve, vent au départ
  await page.waitForSelector('#dqEvent', { timeout: 60000 });
  assert.equal(await page.inputValue('#dqEvent'), 'Coupe de la SNPM — CVAT', 'nom de l’épreuve = la régate');
  assert.notEqual(await page.inputValue('#dqWind'), '', 'vent au départ pré-rempli');
  const r1 = await regateCourante(page);
  assert.equal(r1.traces.length, 1, 'une référence de trace dans la régate');
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
  await page.click('#rpClose');

  // le même fichier une seconde fois : « Déjà importée », ni seconde trace ni seconde référence, pas de second questionnaire
  await ongletTraces(page);
  await page.setInputFiles('#gpxIn', GPX_SNPM);
  await toastVu(page, 'Déjà importée', 30000);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#dqWind').isVisible(), false, 'pas de second questionnaire pour une trace déjà rangée');
  assert.equal((await lireTraces(page)).length, 1, 'toujours une seule trace en base');
  assert.equal((await regateCourante(page)).traces.length, 1, 'toujours une seule référence');

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
  const idx = await regateCourante(page);
  assert.ok(idx.traces[0].sum && idx.traces[0].sum.dist > 25000 && idx.traces[0].sum.dur > 12000 && idx.traces[0].sum.dur < 13500, `résumé dans la référence : ${JSON.stringify(idx.traces[0].sum)}`);
  assert.ok(idx.traces[0].report?.t, 'rapport relié à la fiche');
  sansErreur(erreurs, 'import GPX');
  await ctx.close();
}

// Index de régates posé avant le premier chargement de l'app (page de même origine sans l'app), puis app ouverte
const regateSemee = (id, name, debut, fin = '') => ({ id, name, club: 'CVAT', dateStart: debut, dateEnd: fin, season: debut.slice(0, 4), races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: null, at: 0 });
async function sème(page, base, regates, current) {
  await page.goto(base + 'data/meta.json');
  await page.evaluate((v) => localStorage.setItem('rade.regates.v1', v), JSON.stringify({ v: 1, current, list: regates }));
  await ouvreApp(page, base);
}
const indexRegates = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rade.regates.v1')));

// ARCH-04 : un jour ambigu est tranché par l'équipier, jamais deviné ; un rattachement se défait depuis la fiche
async function gpxChoix({ browser, base }) {
  // 1) deux régates le 18/10, sans manche : l'invite liste les deux
  const ctx = await ouvreContexte(browser, { heure: '2026-10-19T09:00:00Z' });
  const { page, erreurs } = await ouvrePage(ctx);
  await sème(page, base, [regateSemee('ra', 'Régate A', '2026-10-18'), regateSemee('rb', 'Régate B', '2026-10-18')], 'ra');
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
  await sème(p2, base, [regateSemee('nov', 'Régate de novembre', '2026-11-07', '2026-11-09')], 'nov');
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
  assert.equal(i2.current, 'nov', 'la régate courante ne change pas');
  await p2.click('#dqCancel');
  sansErreur(e2, 'création depuis l’invite');
  await ctx2.close();

  // 3) « Laisser sans régate » : la trace s'ouvre, aucun questionnaire, aucune référence
  const ctx3 = await ouvreContexte(browser, { heure: '2026-10-19T09:00:00Z' });
  const { page: p3, erreurs: e3 } = await ouvrePage(ctx3);
  await sème(p3, base, [regateSemee('nov', 'Régate de novembre', '2026-11-07', '2026-11-09')], 'nov');
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
  await sème(page, base, [], null);                                  // index vide : { v: 1, current: null, list: [] }, aucune clé rade.events.v1
  assert.equal(await page.evaluate(() => localStorage.getItem('rade.events.v1')), null, 'aucune clé rade.events.v1 au départ');
  assert.deepEqual(await indexRegates(page), { v: 1, current: null, list: [] }, 'index vide conservé');
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
  assert.equal(idx.current, r.id, 'elle devient la régate courante');
  assert.equal(r.name, nom, 'au nom lu dans les IC'); assert.equal(r.dateStart, '2026-10-18'); assert.equal(r.season, '2026');
  assert.ok(r.ic.validated && typeof r.ic.validated.at === 'number', 'IC validées');
  assert.equal(r.ic.fields.vhf, 72); assert.equal(r.ic.fields.firstWarning, '10:55');
  const liste = await lireListe(page);
  assert.equal(liste.length, 1); assert.equal(liste[0].season, 'Saison 2026');
  assert.deepEqual(liste[0].groups.map((g) => g.status), ['Passée'], 'le 18/10 est passé le 19/10');
  assert.equal(liste[0].groups[0].rows[0].name, nom); assert.ok(liste[0].groups[0].rows[0].cur);

  // après relance : cette seule régate, aucune ancienne fiche, rade.events.v1 toujours absente
  await ouvreApp(page, base);
  await page.click('#tabs button[data-tab=ic]');
  await sansAncien('après la relance');
  const apres = await lireListe(page);
  assert.equal(apres.flatMap((s) => s.groups.flatMap((g) => g.rows)).length, 1, 'une seule régate après relance');
  assert.equal((await indexRegates(page)).list.length, 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('rade.events.v1')), null, 'rade.events.v1 n’existe toujours pas');
  sansErreur(erreurs, 'pendant le scénario');
  await ctx.close();
}

const SCENARIOS = { creer, manche, auteur, ic, 'depuis-ic': depuisIC, vraisemblance, gel, 'debrief-tardif': debriefTardif, gpx, 'gpx-choix': gpxChoix };

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
