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
    await handler({ method: req.method(), headers: req.headers(), body: corps }, out);
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
  assert.equal((await regateCourante(page)).ic, null, 'rien n’entre avant « Valider les IC »');
  assert.match(await page.locator('#icVal').textContent(), /Pas encore d’IC validées/);

  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg = await regateCourante(page);
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
  reponse.abandon = true;
  await essaie('Pas de réseau : la lecture IA se fait avant la régate', 'réseau coupé');
  assert.equal((await lireRelecture(p2)).zone.valeur, 'Rade corrigée à la main', 'les échecs n’ont rien changé à la saisie');
  const j = await journal(p2);
  assert.ok(j.includes('ic-ia'), 'chaque échec est consigné au journal');
  assert.ok(!/DUPONT|PROGRAMME|Pointe Rouge|Marseille/.test(j), 'jamais le texte des IC dans le journal');
  await p2.click('#icValidate');
  await p2.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg2 = await regateCourante(p2);
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
  assert.equal((await regateCourante(p3)).races.length, 0, 'rien n’entre avant « Valider les IC »');
  await p3.click('#icValidate');
  await p3.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });
  const reg3 = await regateCourante(p3);
  assert.equal(reg3.ic.read, 'ia');
  assert.equal(reg3.races.length, 1, 'la manche vérifiée seulement');
  assert.deepEqual([reg3.races[0].date, reg3.races[0].time, reg3.races[0].courseId], ['2026-10-18', '10:30', null]);
  assert.deepEqual(reg3.ic.fields.keyRules, ['Tout concurrent qui abandonne doit en informer le comité de course'], 'seule la règle vérifiée entre');
  assert.match(await p3.locator('#rgSheet .rgrace').textContent(), /Manche 1[\s\S]*10:30[\s\S]*parcours à préciser/);
  sansErreur(e3, 'manches lues');
  await ctx3.close();
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
  const idPremiere = (await regateCourante(page)).id;
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
  assert.deepEqual(((await regateCourante(page)).marks || []), [], 'rien n’entre avant « Valider les IC »');
  await page.click('#icValidate');
  await page.waitForSelector('#icReview', { state: 'detached', timeout: 10000 });

  // fiche : trois bouées à confirmer, un parcours en attente ; rien dans les tables ni dans l'onglet Parcours
  const reg = await regateCourante(page);
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
  const apresAlpha = await regateCourante(page);
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

  // après relance : bouées confirmées et parcours choisi retrouvés dès le démarrage
  await ouvreApp(page, base);
  assert.equal((await etatApp()).courseId, 101, 'le parcours choisi survit à la relance');
  t = await tables();
  assert.deepEqual(t.marks, [...CVAT, 'X1', 'X2']);
  await page.waitForFunction(() => [...document.querySelectorAll('section[data-tab=course] .leg .hd')].some((e) => /X2 Bravo/.test(e.textContent)), null, { timeout: 90000 });
  sansErreur(erreurs, 'après la relance');

  // Ignorer (deux touches) : Charlie n'est plus proposée ; l'ignorée ne sert jamais
  await page.click('#tabs button[data-tab=ic]');
  await page.click('[data-mk-ign=X3]');
  assert.equal(await ligne('X3').locator('[data-mk-ign]').textContent(), 'Ignorer ?');
  await page.click('[data-mk-ign=X3]');
  assert.match(await ligne('X3').locator('.chip').textContent(), /ignorée/);
  assert.equal((await regateCourante(page)).marks[2].status, 'ignoree');
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

const SCENARIOS = { creer, manche, auteur, ic, 'depuis-ic': depuisIC, vraisemblance, gel, 'debrief-tardif': debriefTardif, gpx, 'gpx-choix': gpxChoix, ia, 'ia-erreurs': iaErreurs, bouees };

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
