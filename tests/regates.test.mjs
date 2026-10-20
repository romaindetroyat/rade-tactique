// Régates (REG-01, REG-02, ARCH-02) : statut au jour de Paris, saison, reprise des fiches IC, création, manches, verrou de régate,
// auteur, vues sans injection (linkedom) et gardes statiques du câblage de js/app.js. Aucun code d’accès ni aucune empreinte ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import {
  KEY, VERSION, STATUS_LABEL, regattaStatus, seasonOf, todayRegatta, lockDates, fromEvent, migrate, saveRegattas, newId, createRegatta,
  upsertRegatta, removeRegatta, setCurrent, currentRegatta, icOf, groupBySeason, SEED_AT, seedNorm, backfillAuthor,
} from '../js/regates.js';
import { parisClock } from '../js/racelock.js';
import { escHTML, byLine, listHTML, newRegattaFormHTML, sheetHTML, historySectionHTML, tracesSectionHTML } from '../js/regview.js';
import { IC as SNPM } from '../js/courses.js';
import { verdict } from '../tools/regate-e2e.mjs';

const t = (s) => Date.parse(s);
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const regate = (over = {}) => ({ id: 'a', name: 'Régate', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-09', season: '2026', races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: null, at: 0, ...over });

test('statut : minuit de Paris (heure d’hiver), régate du 7 au 9 novembre', () => {
  const r = regate();
  assert.equal(regattaStatus(r, t('2026-11-06T22:59:59Z')), 'avenir');       // 23:59:59 le 6
  assert.equal(regattaStatus(r, t('2026-11-06T23:00:00Z')), 'aujourdhui');   // 00:00 le 7
  assert.equal(regattaStatus(r, t('2026-11-09T22:59:59Z')), 'aujourdhui');   // 23:59:59 le 9
  assert.equal(regattaStatus(r, t('2026-11-09T23:00:00Z')), 'passee');       // 00:00 le 10
});

test('statut : changement d’heure du 25/10/2026 et régate d’un seul jour', () => {
  const r = regate({ dateStart: '2026-10-25', dateEnd: '' });
  assert.equal(regattaStatus(r, t('2026-10-24T21:59:59Z')), 'avenir');       // 23:59:59 CEST le 24
  assert.equal(regattaStatus(r, t('2026-10-24T22:00:00Z')), 'aujourdhui');   // 00:00 CEST le 25
  assert.equal(regattaStatus(r, t('2026-10-25T22:59:59Z')), 'aujourdhui');   // 23:59:59 CET le 25
  assert.equal(regattaStatus(r, t('2026-10-25T23:00:00Z')), 'passee');       // 00:00 CET le 26
});

test('statut : sans date, à venir ; libellés ; saison = année du premier jour', () => {
  assert.equal(regattaStatus(regate({ dateStart: '', dateEnd: '' }), t('2026-11-07T10:00:00Z')), 'avenir');
  assert.equal(regattaStatus(null, 0), 'avenir');
  assert.deepEqual(STATUS_LABEL, { avenir: 'À venir', aujourdhui: 'Aujourd’hui', passee: 'Passée' });
  assert.equal(seasonOf('2026-11-07'), '2026');
  assert.equal(seasonOf('2027-01-02'), '2027');
  assert.equal(seasonOf(''), '—');
});

test('verrou : la régate d’aujourd’hui commande, même si la courante est la Coupe SNPM ; sinon la courante', () => {
  const snpm = regate({ id: 'snpm-2026', dateStart: '2026-10-18', dateEnd: '' }), nov = regate({ id: 'nov' });
  const list = [snpm, nov];
  assert.deepEqual(lockDates({ now: t('2026-11-07T10:00:00Z'), list, currentId: 'snpm-2026' }), { raceFrom: '2026-11-07', raceTo: '2026-11-09' });
  assert.deepEqual(lockDates({ now: t('2026-10-20T10:00:00Z'), list, currentId: 'snpm-2026' }), { raceFrom: '2026-10-18', raceTo: '2026-10-18' });
  assert.deepEqual(lockDates({ now: t('2026-10-20T10:00:00Z'), list, currentId: 'nov' }), { raceFrom: '2026-11-07', raceTo: '2026-11-09' });
  assert.deepEqual(lockDates({ now: 0, list: [], currentId: null }), { raceFrom: null, raceTo: null });
  // deux régates le même jour : la courante d’abord
  const b = regate({ id: 'b' });
  assert.equal(todayRegatta({ now: t('2026-11-08T10:00:00Z'), list: [nov, b], currentId: 'b' }).id, 'b');
  assert.equal(todayRegatta({ now: t('2026-11-08T10:00:00Z'), list: [nov, b], currentId: 'x' }).id, 'nov');
  assert.equal(todayRegatta({ now: t('2026-12-08T10:00:00Z'), list: [nov, b], currentId: 'b' }), null);
});

test('reprise : une fiche rade.events.v1 devient une régate (CVAT, VHF 72), sans toucher la clé d’origine, deuxième appel identique', () => {
  const ancien = JSON.stringify({ current: 'snpm-2026', list: [
    { id: 'snpm-2026', event: 'Coupe de la SNPM — CVAT', date: '2026-10-18', dateEnd: '2026-10-17', vhf: 72, firstWarning: '10:55', text: 'IC', source: 'IC fournies (PDF)' },
    { id: 'ev1', event: 'Trophée du Large', date: '2026-11-07', dateEnd: '2026-11-09', vhf: 69, source: 'tl.pdf' },
  ] });
  const storage = mem({ 'rade.events.v1': ancien });
  const a = migrate({ storage, now: 1000, by: 'Teiva' });
  assert.equal(a.v, VERSION); assert.equal(a.current, 'snpm-2026'); assert.equal(a.list.length, 2);
  const [snpm, tl] = a.list;
  assert.equal(snpm.club, 'CVAT'); assert.equal(snpm.ic.fields.vhf, 72); assert.equal(snpm.ic.read, 'reprise');
  assert.deepEqual(snpm.ic.validated, { by: null, at: SEED_AT }, 'la graine commune a le même instant sur tous les téléphones, sans auteur');
  assert.equal(snpm.at, SEED_AT); assert.deepEqual(tl.ic.validated, { by: 'Teiva', at: 1000 }, 'une autre fiche garde l’instant de reprise');
  assert.equal(snpm.dateEnd, '', 'dernier jour antérieur : non gardé');
  assert.equal(tl.club, ''); assert.equal(tl.dateEnd, '2026-11-09', 'dernier jour postérieur : gardé'); assert.equal(tl.season, '2026');
  assert.equal(storage.getItem('rade.events.v1'), ancien, 'rade.events.v1 octet pour octet inchangée');
  const brut = storage.getItem(KEY);
  const b = migrate({ storage, now: 5000, by: 'Autre' });
  assert.deepEqual(b, a, 'deuxième appel identique');
  assert.equal(storage.getItem(KEY), brut, 'l’index n’est pas réécrit');
  assert.equal(storage.getItem('rade.events.v1'), ancien);
});

test('semis : sur un appareil neuf, la Coupe SNPM est semée comme le faisait l’ancien js/events.js (club CVAT, passée depuis le 19/10)', () => {
  const st = migrate({ storage: mem(), now: t('2026-10-19T10:00:00Z') });
  assert.equal(st.list.length, 1); assert.equal(st.current, 'snpm-2026');
  const r = st.list[0];
  assert.equal(r.club, 'CVAT'); assert.equal(r.ic.source, 'IC fournies (PDF)');
  assert.equal(regattaStatus(r, t('2026-10-19T10:00:00Z')), 'passee');
  // même forme que l’ancienne fiche courante (js/events.js, retirée au plan 03-05) pour tout ce que lit app.js : les constantes de js/courses.js
  const neuf = icOf(r);
  for (const k of ['event', 'date', 'firstWarning', 'lastFinishSignal', 'vhf', 'committee', 'zone', 'keyRules', 'classes', 'groups', 'sequence']) assert.deepEqual(neuf[k], SNPM[k], k);
  assert.equal(neuf.id, 'snpm-2026'); assert.equal(neuf.source, 'IC fournies (PDF)');
  assert.equal(SNPM.vhf, 72);
});

test('reprise : index illisible → repart des fiches ; quota dépassé ou stockage fermé → état rendu sans exception', () => {
  const storage = mem({ 'rade.regates.v1': '{pas du json', 'rade.events.v1': JSON.stringify({ current: 'x', list: [{ id: 'x', event: 'X', date: '2026-11-07' }] }) });
  const st = migrate({ storage, now: 1 });
  assert.equal(st.list[0].id, 'x');
  assert.equal(JSON.parse(storage.getItem(KEY)).list[0].id, 'x', 'l’index illisible est remplacé');
  const plein = { getItem: () => null, setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } };
  assert.doesNotThrow(() => migrate({ storage: plein, now: 1 }));
  assert.equal(migrate({ storage: plein, now: 1 }).list.length, 1);
  assert.equal(saveRegattas(plein, st), false);
  assert.equal(saveRegattas(mem(), st), true);
  assert.doesNotThrow(() => migrate({ storage: null, now: 1 }), 'stockage absent');
  assert.equal(migrate({ storage: { getItem() { throw new Error('fermé'); }, setItem() {} }, now: 1 }).list.length, 1);
});

test('création : champs manquants, date impossible, dernier jour antérieur ignoré, longueurs, identifiants distincts', () => {
  const now = t('2026-11-01T10:00:00Z');
  assert.deepEqual(Object.keys(createRegatta({}, { now }).errors).sort(), ['dateStart', 'name']);
  assert.equal(createRegatta({}, { now }).ok, false);
  assert.ok(createRegatta({ name: 'R', dateStart: '2026-02-30' }, { now }).errors.dateStart, '30 février');
  assert.ok(createRegatta({ name: 'R', dateStart: '07/11/2026' }, { now }).errors.dateStart);
  assert.ok(createRegatta({ name: 'x'.repeat(81), dateStart: '2026-11-07' }, { now }).errors.name);
  assert.ok(createRegatta({ name: 'R', dateStart: '2026-11-07', club: 'c'.repeat(41) }, { now }).errors.club);
  const ok = createRegatta({ name: '  Trophée  ', dateStart: '2026-11-07', dateEnd: '2026-11-09', club: ' CVAT ' }, { now, by: 'Thibaud' });
  assert.equal(ok.ok, true);
  assert.deepEqual({ ...ok.regatta, id: 'x' }, { id: 'x', name: 'Trophée', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-09', season: '2026', races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by: 'Thibaud', at: now });
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07', dateEnd: '2026-11-06' }, { now }).regatta.dateEnd, '', 'dernier jour antérieur ignoré');
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07', dateEnd: '2026-11-07' }, { now }).regatta.dateEnd, '', 'même jour : une régate d’un jour');
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07', dateEnd: '2026-02-30' }, { now }).regatta.dateEnd, '', 'dernier jour impossible ignoré');
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07' }, { now }).regatta.club, '', 'club facultatif');
  const ids = new Set(Array.from({ length: 200 }, () => createRegatta({ name: 'R', dateStart: '2026-11-07' }, { now }).regatta.id));
  assert.equal(ids.size, 200, 'identifiants distincts');
  assert.match(newId(now, () => 0.123456789), /^rg[0-9a-z]+$/);
});

test('mises à jour : un nouvel état, jamais une mutation (état gelé)', () => {
  const a = regate({ id: 'a' }), b = regate({ id: 'b', name: 'B' });
  const st = deepFreeze({ v: 1, current: 'a', list: [a] });
  const st2 = upsertRegatta(st, b);
  assert.equal(st2.list.length, 2); assert.equal(st.list.length, 1);
  assert.equal(upsertRegatta(st2, { ...b, name: 'B2' }).list[1].name, 'B2');
  assert.equal(upsertRegatta(st2, { ...b, name: 'B2' }).list.length, 2);
  assert.equal(setCurrent(st2, 'b').current, 'b'); assert.equal(setCurrent(st2, 'inconnue'), st2, 'identifiant inconnu : inchangé');
  assert.equal(currentRegatta(setCurrent(st2, 'b')).id, 'b');
  assert.equal(currentRegatta(st2).id, 'a');
  assert.equal(removeRegatta(setCurrent(st2, 'b'), 'b').current, 'a', 'supprimer la courante : la première reste');
  assert.equal(removeRegatta(st2, 'b').current, 'a');
  assert.equal(removeRegatta(st, 'a').current, null); assert.equal(currentRegatta(removeRegatta(st, 'a')), null);
  assert.equal(currentRegatta({ v: 1, current: 'zzz', list: [a] }).id, 'a', 'courante inconnue : la première');
});

test('icOf : forme de l’ancien IC (communs CVAT compris) ; icOf(null) et régate sans IC sans exception', () => {
  const r = fromEvent({ id: 'snpm-2026', ...SNPM, source: 'IC fournies (PDF)', text: 'texte' }, 1, 'Teiva');
  const ic = icOf(r);
  assert.equal(ic.id, 'snpm-2026'); assert.equal(ic.event, SNPM.event); assert.equal(ic.date, SNPM.date); assert.equal(ic.firstWarning, '10:55');
  assert.equal(ic.vhf, 72); assert.equal(ic.text, 'texte'); assert.equal(ic.source, 'IC fournies (PDF)');
  assert.ok(Array.isArray(ic.sequence) && Array.isArray(ic.classes) && Array.isArray(ic.groups) && Array.isArray(ic.keyRules));
  const vide = icOf(null);
  assert.deepEqual([vide.event, vide.date, vide.dateEnd, vide.text, vide.firstWarning], ['', '', '', '', '']);
  assert.ok(vide.sequence.length >= 4 && vide.classes.length >= 3, 'valeurs communes seules');
  const sans = icOf(regate({ ic: null }));
  assert.equal(sans.event, 'Régate'); assert.equal(sans.vhf, null); assert.deepEqual(sans.keyRules, []); assert.ok(sans.sequence.length);
});

test('groupBySeason : saisons décroissantes ; Aujourd’hui, À venir (croissant), Passées (décroissant)', () => {
  const now = t('2026-11-08T10:00:00Z');
  const list = [
    regate({ id: 'p1', name: 'P1', dateStart: '2026-10-18', dateEnd: '', season: '2026' }), regate({ id: 'p2', name: 'P2', dateStart: '2026-09-05', dateEnd: '', season: '2026' }),
    regate({ id: 'au', name: 'Auj' }), regate({ id: 'v2', name: 'V2', dateStart: '2026-12-20', dateEnd: '', season: '2026' }), regate({ id: 'v1', name: 'V1', dateStart: '2026-11-21', dateEnd: '', season: '2026' }),
    regate({ id: 's27', name: 'S27', dateStart: '2027-03-01', dateEnd: '', season: '2027' }), regate({ id: 'sd', name: 'SD', dateStart: '', dateEnd: '', season: '—' }),
  ];
  const g = groupBySeason(list, now);
  assert.deepEqual(g.map((x) => x.season), ['2027', '2026', '—']);
  assert.deepEqual(g[1].groups.map((x) => [x.status, x.label, x.items.map((r) => r.id)]), [
    ['aujourdhui', 'Aujourd’hui', ['au']], ['avenir', 'À venir', ['v1', 'v2']], ['passee', 'Passée', ['p1', 'p2']],
  ]);
  assert.deepEqual(groupBySeason([], now), []);
});

test('vues : un nom ou un club piégé ne produit ni img ni script (liste, fiche, formulaire) ; l’apostrophe est échappée', () => {
  const piege = regate({ name: '<img src=x onerror=alert(1)>', club: '"><script>x</script>', by: '<b>Pirate</b>', at: t('2026-11-01T10:00:00Z') });
  const now = t('2026-11-08T10:00:00Z');
  const html = listHTML(groupBySeason([piege], now), { currentId: piege.id, now }) + sheetHTML(piege, { now }) + newRegattaFormHTML({ name: '"><img src=x>', dateStart: '2026-11-07', dateEnd: '', club: '\'x\'' }, { name: '<script>e</script>' });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelectorAll('img, script, b').length, 0, 'balise injectée');
  for (const el of document.querySelectorAll('*')) for (const a of el.getAttributeNames()) assert.ok(!/^on/i.test(a), `attribut ${a} sur ${el.tagName}`);
  assert.ok(document.body.textContent.includes('<img src=x onerror=alert(1)>'), 'le nom s’affiche en texte');
  assert.equal(escHTML('l\'été "oui" <&>'), 'l&#39;été &quot;oui&quot; &lt;&amp;&gt;');
  assert.ok(!listHTML(groupBySeason([regate({ name: 'L\'Aber' })], now), { now }).includes('\'Aber'), 'apostrophe échappée');
});

test('vues : liste par saison, ligne courante marquée, attribut data-rg entre guillemets, auteur « — » sans auteur', () => {
  const now = t('2026-11-08T10:00:00Z');
  const a = regate({ id: 'a', name: 'Aujourd’hui CVAT', by: 'Teiva', at: t('2026-11-01T10:00:00Z') }), b = regate({ id: 'b', name: 'Sans auteur', dateStart: '2026-12-01', dateEnd: '', by: null });
  const html = listHTML(groupBySeason([a, b], now), { currentId: 'a', now });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelector('.rgseason h4').textContent, 'Saison 2026');
  assert.deepEqual([...document.querySelectorAll('.rgstatus')].map((x) => x.textContent), ['Aujourd’hui', 'À venir']);
  const [ra, rb] = [...document.querySelectorAll('button.rg')];
  assert.equal(ra.getAttribute('data-rg'), 'a'); assert.ok(ra.classList.contains('on')); assert.ok(!rb.classList.contains('on'));
  assert.match(ra.textContent, /par Teiva le 01\/11/); assert.match(rb.textContent, /—/); assert.ok(!/par /.test(rb.textContent));
  assert.match(html, /data-rg="a"/);
  assert.equal(byLine(null, 1), '—'); assert.equal(byLine('Teiva', t('2026-11-01T23:30:00Z')), 'par Teiva le 02/11', 'jour de Paris');
  assert.equal(byLine('Teiva'), 'par Teiva');
  assert.match(listHTML([], {}), /Aucune régate/);
  assert.match(sheetHTML(null), /Aucune régate courante/);
});

// ───────────────────────── manches (REG-02)

// addRace / removeRace / raceSettings : lus par l’espace de noms (une fonction absente fait échouer le test visé, pas le chargement du fichier)
import * as R from '../js/regates.js';
import { COURSES } from '../js/courses.js';

const PARCOURS = deepFreeze(COURSES.map(({ id, title }) => ({ id, title })));          // copie gelée : COURSES n’est jamais muté
const AVANT = JSON.stringify(COURSES);
const ajoute = (r, race, by = 'Teiva') => R.addRace(r, race, { now: 1000, by, courses: PARCOURS });

test('manche : date hors de la régate, heure impossible, parcours inconnu, classe, tours : refusés, un message en français par champ', () => {
  const r = regate();
  const bad = (race, champ) => { const x = ajoute(r, race); assert.equal(x.ok, false, JSON.stringify(race)); assert.ok(x.errors[champ], `message pour ${champ}`); assert.match(x.errors[champ], /[a-zé]/i); assert.equal(x.regatta, r, 'régate inchangée'); };
  bad({ date: '2026-11-06' }, 'date'); bad({ date: '2026-11-10' }, 'date'); bad({ date: '2026-02-30' }, 'date');
  bad({ time: '25:00' }, 'time'); bad({ time: '10h55' }, 'time'); bad({ time: '9:5' }, 'time');
  bad({ courseId: 9999 }, 'courseId'); bad({ courseId: 'X1' }, 'courseId');
  bad({ cls: 'Z' }, 'cls'); bad({ cls: 'g' }, 'cls');
  bad({ laps: 0 }, 'laps'); bad({ laps: 5 }, 'laps'); bad({ laps: 1.5 }, 'laps'); bad({ laps: 'deux' }, 'laps');
  bad({ note: 'n'.repeat(201) }, 'note');
  const plusieurs = ajoute(r, { time: '99:99', cls: 'Z', laps: 9 });
  assert.deepEqual(Object.keys(plusieurs.errors).sort(), ['cls', 'laps', 'time'], 'une erreur par champ fautif');
  // valeurs acceptées : tout vide (parcours à préciser, heure inconnue), numéro de parcours en texte (liste déroulante)
  const vide = ajoute(r, {});
  assert.equal(vide.ok, true);
  assert.deepEqual({ ...vide.regatta.races[0] }, { n: 1, date: '2026-11-07', time: '', courseId: null, cls: 'G', laps: 2, note: '', by: 'Teiva', at: 1000 });
  assert.equal(ajoute(r, { courseId: '5', cls: 'P', laps: '1', date: '2026-11-09', time: '13:25', note: ' vent faible ' }).regatta.races[0].courseId, 5);
  assert.equal(ajoute(r, { note: ' vent faible ' }).regatta.races[0].note, 'vent faible');
  assert.equal(JSON.stringify(COURSES), AVANT, 'COURSES n’est pas muté');
});

test('manche : numérotation par jour puis heure, deux manches le même jour, sans heure en dernier ; removeRace renumérote ; la manche choisie suit', () => {
  let r = regate();
  r = ajoute(r, { date: '2026-11-08', time: '10:55', courseId: 5 }).regatta;
  r = ajoute(r, { date: '2026-11-07', time: '13:25', courseId: 3 }).regatta;
  r = ajoute(r, { date: '2026-11-07', time: '' }).regatta;                                  // sans heure : après celles du jour qui en ont
  r = ajoute(r, { date: '2026-11-07', time: '10:55', courseId: 5 }).regatta;
  assert.deepEqual(r.races.map((m) => [m.n, m.date, m.time]), [[1, '2026-11-07', '10:55'], [2, '2026-11-07', '13:25'], [3, '2026-11-07', ''], [4, '2026-11-08', '10:55']]);
  const gel = deepFreeze(JSON.parse(JSON.stringify({ ...r, sel: 2 })));
  const sans = R.removeRace(gel, 1);
  assert.deepEqual(sans.races.map((m) => [m.n, m.date, m.time]), [[1, '2026-11-07', '13:25'], [2, '2026-11-07', ''], [3, '2026-11-08', '10:55']], 'renumérotée');
  assert.equal(sans.sel, 1, 'la manche choisie suit sa nouvelle place');
  assert.equal(gel.races.length, 4, 'état d’origine intact');
  assert.equal(R.removeRace(gel, 2).sel, undefined, 'la manche choisie est supprimée : plus de choix');
  assert.equal(R.removeRace(gel, 4).sel, 2, 'supprimer après la manche choisie : le choix ne bouge pas');
  // ajouter une manche plus tôt décale le choix
  const choisie = { ...r, sel: 2 };                                                         // 13:25 le 7
  const plusTot = ajoute(choisie, { date: '2026-11-07', time: '08:00' }).regatta;
  assert.equal(plusTot.races[plusTot.sel - 1].time, '13:25', 'sel désigne toujours la même manche');
  assert.equal(ajoute(r, { date: '2026-11-07', time: '13:25' }).regatta.races.filter((m) => m.time === '13:25').length, 2, 'deux manches à la même heure acceptées');
});

test('manche : raceSettings cale parcours, classe, tours, jour et départ = avertissement + 5 min ; sans heure, pas d’heure de départ', () => {
  assert.deepEqual(R.raceSettings({ date: '2026-11-07', time: '10:55', courseId: 5, cls: 'P', laps: 2 }), { courseId: 5, cls: 'P', laps: 2, day: '2026-11-07', startTime: 11 });
  assert.equal(R.raceSettings({ date: '2026-11-07', time: '13:25', courseId: 3, cls: 'G', laps: 1 }).startTime, 13.5);
  assert.equal(R.raceSettings({ date: '2026-11-08', time: '09:57', courseId: 3, cls: 'G', laps: 1 }).startTime, (9 * 60 + 62) / 60);
  const sans = R.raceSettings({ date: '2026-11-07', time: '', courseId: 5, cls: 'G', laps: 2 });
  assert.ok(!('startTime' in sans), 'sans heure : pas de startTime'); assert.equal(sans.courseId, 5);
  const aPreciser = R.raceSettings({ date: '2026-11-07', time: '10:55', courseId: null, cls: 'G', laps: 2 });
  assert.ok(!('courseId' in aPreciser), 'parcours à préciser : le parcours de l’app ne change pas');
});

test('manche : la fiche affiche chaque manche (n, jour, heure, parcours, classe, tours, auteur), « heure inconnue », la note échappée, le choix', () => {
  let r = regate();
  r = ajoute(r, { date: '2026-11-07', time: '10:55', courseId: 5, cls: 'G', laps: 2, note: '<img src=x onerror=alert(1)>' }, 'Thibaud').regatta;
  r = ajoute(r, { date: '2026-11-08', time: '', courseId: null, cls: 'P', laps: 1 }, null).regatta;
  const now = t('2026-11-07T08:30:00Z');
  const html = sheetHTML({ ...r, sel: 1 }, { now, courses: PARCOURS });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelectorAll('img, script').length, 0, 'note piégée : aucune balise');
  const lignes = [...document.querySelectorAll('.rgrace')];
  assert.equal(lignes.length, 2);
  assert.match(lignes[0].textContent, /Manche 1/); assert.match(lignes[0].textContent, /10:55/); assert.match(lignes[0].textContent, /Parcours 5/); assert.match(lignes[0].textContent, /2 tours/); assert.match(lignes[0].textContent, /par Thibaud le 01\/01/);
  assert.ok(lignes[0].textContent.includes('<img src=x onerror=alert(1)>'), 'la note s’affiche en texte');
  assert.match(lignes[1].textContent, /signal : heure inconnue/); assert.match(lignes[1].textContent, /parcours à préciser/); assert.match(lignes[1].textContent, /1 tour(?!s)/); assert.match(lignes[1].textContent, /—/);
  assert.deepEqual([...document.querySelectorAll('button[data-race]')].map((b) => b.getAttribute('data-race')), ['1', '2']);
  assert.match(document.querySelector('button[data-race]').textContent, /Choisir cette manche/);
  assert.ok(lignes[0].classList.contains('on') && !lignes[1].classList.contains('on'), 'la manche choisie est marquée');
  assert.deepEqual([...document.querySelectorAll('button[data-rmrace]')].map((b) => b.getAttribute('data-rmrace')), ['1', '2']);
  const avecForm = parseHTML(`<html><body>${sheetHTML(r, { now, courses: PARCOURS, raceDraft: { date: '2026-11-07', time: '', courseId: '', cls: 'G', laps: '2', note: '' }, raceErrors: { time: 'Heure impossible (HH:MM).' } })}</body></html>`).document;
  assert.deepEqual([...avecForm.querySelectorAll('#rcDate option')].map((o) => o.getAttribute('value')), ['2026-11-07', '2026-11-08', '2026-11-09'], 'les jours de la régate');
  assert.equal(avecForm.querySelectorAll('#rcCourse option').length, PARCOURS.length + 1, 'tous les parcours + « à préciser »');
  assert.ok(avecForm.querySelector('#rcAdd') && avecForm.querySelector('#rcTime') && avecForm.querySelector('#rcCls') && avecForm.querySelector('#rcLaps') && avecForm.querySelector('#rcNote'));
  assert.match(avecForm.querySelector('[data-err=time]').textContent, /Heure impossible/);
  assert.ok(parseHTML(`<html><body>${sheetHTML(r, { now, courses: PARCOURS })}</body></html>`).document.querySelector('#rcNew'), 'bouton « Ajouter une manche »');
});

// ───────────────────────── auteur (D-05, ARCH-02)

test('auteur : membre() rend le prénom gardé ou null (stockage illisible compris) ; saveMembre refuse vide, trop long, caractères étrangers', () => {
  const st = mem();
  assert.equal(R.membre(st), null, 'rien de gardé');
  assert.equal(R.saveMembre(st, '  Teiva '), true);
  assert.equal(st.getItem(R.MEMBRE_KEY), 'Teiva'); assert.equal(R.membre(st), 'Teiva');
  for (const ok of ['Jean-Luc', 'D’Artagnan', 'D\'Artagnan', 'Élodie', 'Anne Sophie']) assert.equal(R.saveMembre(mem(), ok), true, ok);
  for (const mauvais of ['', '   ', 'a'.repeat(41), 'Teiva1', '<b>x</b>', 'x;y', '---', '\'\'', null, undefined, 42]) { const s2 = mem(); assert.equal(R.saveMembre(s2, mauvais), false, String(mauvais)); assert.equal(s2.m.size, 0, 'rien d’écrit'); }
  assert.equal(R.saveMembre(mem(), 'a'.repeat(40)), true);
  assert.equal(R.membre(mem({ [R.MEMBRE_KEY]: '<script>' })), null, 'une valeur gardée invalide est ignorée');
  assert.equal(R.membre({ getItem() { throw new Error('fermé'); } }), null);
  assert.equal(R.membre(null), null);
  assert.equal(R.saveMembre({ setItem() { throw new DOMException('quota', 'QuotaExceededError'); } }, 'Teiva'), false, 'quota dépassé : faux, sans exception');
});

test('auteur : backfillAuthor complète les by: null (régates, manches, IC validées), compte, et ne remplace jamais un auteur posé', () => {
  const avecIC = (by) => ({ fields: {}, text: '', source: '', read: 'saisie', excerpts: {}, validated: { by, at: 1 } });
  const a = regate({ id: 'a', by: null, ic: avecIC(null), races: [{ n: 1, by: null, at: 1 }, { n: 2, by: 'Thibaud', at: 1 }] });
  const b = regate({ id: 'b', by: 'Teiva', ic: avecIC('Teiva'), races: [{ n: 1, by: null, at: 1 }] });
  const c = regate({ id: 'c', by: null, ic: null, races: [] });
  const st = deepFreeze({ v: 1, current: 'a', list: [a, b, c] });
  const { st: suite, n } = R.backfillAuthor(st, ' Teiva ');
  assert.equal(n, 5, 'régate a + sa manche 1 + son IC + manche 1 de b + régate c');
  assert.deepEqual(suite.list.map((r) => r.by), ['Teiva', 'Teiva', 'Teiva']);
  assert.deepEqual(suite.list[0].races.map((m) => m.by), ['Teiva', 'Thibaud'], 'l’auteur déjà posé reste');
  assert.equal(suite.list[0].ic.validated.by, 'Teiva'); assert.equal(suite.list[1].ic.validated.by, 'Teiva');
  assert.equal(suite.list[1].races[0].by, 'Teiva'); assert.equal(suite.list[2].ic, null);
  assert.equal(st.list[0].by, null, 'état d’origine intact');
  const { st: encore, n: zero } = R.backfillAuthor(suite, 'Autre');
  assert.equal(zero, 0, 'plus rien à compléter'); assert.equal(encore, suite, 'état rendu tel quel'); assert.equal(encore.list[0].by, 'Teiva', 'jamais écrasé');
  assert.equal(R.backfillAuthor(st, '').n, 0); assert.equal(R.backfillAuthor(st, '<b>').n, 0); assert.equal(R.backfillAuthor(st, null).st, st);
});

test('garde : /api/membre est demandée après la marque rt:ui (jamais attendue avant l’interface utile), une seule fois, sans code ni cookie lus', () => {
  const init = bodyOf(app, 'init'), ui = init.indexOf("performance.mark('rt:ui')");
  assert.ok(ui > 0, 'marque rt:ui dans init()');
  const appel = init.search(/\brefreshMembre\(/);
  assert.ok(appel > ui, 'refreshMembre() est appelée dans init(), après la marque rt:ui');
  assert.ok(!/\bawait\b/.test(init.slice(0, ui)), 'aucune attente avant l’interface utile');
  assert.ok(!/\bawait\s+refreshMembre\(/.test(init), 'init() n’attend pas la réponse du middleware');
  assert.equal((app.match(/fetch\('\/api\/membre'/g) || []).length, 1, 'une seule demande');
  const corps = bodyOf(app, 'refreshMembre');
  assert.match(corps, /fetch\('\/api\/membre'/); assert.match(corps, /new AbortController\(\)/); assert.match(corps, /cache: 'no-store'/); assert.match(corps, /\b(?:saveMembre|backfillAuthor)\(/);
  assert.match(corps, /note\('membre'/, 'un échec est consigné, sans message à l’équipier');
  assert.ok(!/document\.cookie|rt_acces|\bacces\b/.test(corps), 'le code d’accès n’est jamais lu côté page');
});

test('garde : tout élément créé porte l’auteur donné par le middleware (plus de by: null en dur dans les créations de js/app.js)', () => {
  for (const f of ['renderIC', 'chooseRace']) assert.ok(!/\bby:\s*null\b/.test(bodyOf(app, f)), `${f} : by: null en dur`);
  assert.match(bodyOf(app, 'renderIC'), /by: who\(\)/);
  assert.match(app, /migrate\(\{ storage: localStore\(\), now: Date\.now\(\), by: who\(\) \}\)|migrate\(\{[^}]*by: membre\(/, 'la reprise des fiches porte l’auteur déjà connu de l’appareil');
});

test('garde : aucune chaîne hexadécimale de 64 caractères (empreinte) dans les tests ni dans l’outil de bout en bout', () => {
  for (const f of ['tests/regates.test.mjs', 'tools/regate-e2e.mjs']) assert.ok(!/(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/i.test(readFileSync(ROOT + f, 'utf8')), `empreinte dans ${f}`);
});

// ───────────────────────── gardes statiques du câblage (le comportement réel est exécuté par tools/regate-e2e.mjs)

const app = readFileSync(ROOT + 'js/app.js', 'utf8');

test('garde : le verrou lit les dates de la régate (raceLock et renderLive appellent lockDates), plus la seule fiche courante', () => {
  for (const f of ['raceLock', 'renderLive']) assert.match(bodyOf(app, f), /lockDates\(/, `${f} doit appeler lockDates(`);
  assert.ok(!/raceFrom:\s*IC\?\./.test(app), 'plus de raceFrom lu dans IC');
});

test('garde : js/app.js n’importe plus les fonctions de fiches de ./events.js ; l’index est lu au chargement du module (hors init)', () => {
  const imp = /^import\s[^\n]*from '\.\/events\.js';/m.exec(app)?.[0] || '';
  assert.ok(imp, 'import de ./events.js');
  for (const nom of ['eventsState', 'currentEvent', 'upsertEvent', 'removeEvent', 'setCurrent']) assert.ok(!new RegExp(`\\b${nom}\\b`).test(imp), `${nom} importé de ./events.js`);
  assert.match(app, /migrate\(\{/, 'migrate({ … }) présent');
  assert.ok(!/migrate\(/.test(bodyOf(app, 'init')), 'la lecture de l’index se fait au chargement du module, pas dans init()');
  assert.match(app, /^let IC = icOf\(currentRegatta\(REG\)\);/m);
});

test('garde : js/events.js ne garde que la lecture du PDF et des IC (plus de fiches ni d’ancien formulaire, plan 03-05)', async () => {
  const m = await import('../js/events.js');
  assert.deepEqual(Object.keys(m).sort(), ['PDF_OPTIONS', 'cleanText', 'parseIC', 'pdfText']);
  const src = readFileSync(ROOT + 'js/events.js', 'utf8');
  assert.ok(!/localStorage|rade\.events\.v1|evSave|evSel/.test(src), 'plus aucun stockage ni ancien formulaire dans js/events.js');
});

// ───────────────────────── outil de bout en bout : codes de sortie stricts (REVUE, BLOCKER)

test('verdict : nom inconnu → 1 (même sans Chromium) ; Chromium impossible → 2 ; aucun scénario → 1 ; 0 seulement si chaque scénario demandé est OK', () => {
  assert.equal(verdict({ unknown: ['inconnu'], requested: ['inconnu'], ok: [], chromium: true }), 1);
  assert.equal(verdict({ unknown: ['inconnu'], requested: ['creer', 'inconnu'], ok: ['creer'], chromium: false }), 1, 'inconnu prime, même sans Chromium');
  assert.equal(verdict({ requested: ['creer'], ok: [], chromium: false }), 2);
  assert.equal(verdict({ requested: ['creer'], ok: ['creer'], chromium: false }), 2);
  assert.equal(verdict({ requested: [], ok: [], chromium: true }), 1, 'aucun scénario demandé');
  assert.equal(verdict({ requested: ['creer'], ok: [], chromium: true }), 1, 'aucun scénario n’a affiché OK');
  assert.equal(verdict({}), 1);
  assert.equal(verdict({ requested: ['creer', 'manche'], ok: ['creer', 'manche'] }), 0);
  assert.equal(verdict({ requested: ['creer', 'manche'], ok: ['creer'] }), 1, 'un scénario demandé sans OK (échec ou interrompu)');
  assert.equal(verdict({ requested: ['creer'], ok: ['manche'] }), 1, 'un OK étranger ne compte pas');
});

// ───────────────────────── graine commune de la Coupe SNPM (04-02, Pitfall 7)

test('SEED_AT : le 18/10/2026 à 00 h 00, heure de Paris ; la graine semée porte cet instant, sans auteur, quel que soit le téléphone', () => {
  assert.deepEqual(parisClock(SEED_AT), { date: '2026-10-18', hour: 0, minute: 0 });
  const un = migrate({ storage: mem(), now: t('2026-10-19T10:00:00Z'), by: 'Teiva' }), deux = migrate({ storage: mem(), now: t('2026-10-30T08:00:00Z'), by: 'Thibaud' });
  assert.equal(un.list[0].at, SEED_AT); assert.deepEqual(un.list[0].ic.validated, { by: null, at: SEED_AT });
  const sans = (st) => { const { by, ...r } = st.list[0]; return r; };
  assert.deepEqual(sans(un), sans(deux), 'seul l’auteur de la fiche diffère entre deux téléphones');
  const autre = fromEvent({ id: 'ev9', event: 'Autre', date: '2026-11-07' }, 4242, 'Teiva');
  assert.equal(autre.at, 4242); assert.deepEqual(autre.ic.validated, { by: 'Teiva', at: 4242 });
});

test('seedNorm : une graine jamais revalidée prend l’instant commun ; revalidée, autre régate ou état inchangé : même objet', () => {
  const ancienne = fromEvent({ id: 'snpm-2026', ...SNPM }, 1, 'Teiva');
  const vieille = { ...ancienne, at: t('2026-10-20T08:00:00Z'), ic: { ...ancienne.ic, validated: { by: 'Teiva', at: t('2026-10-20T08:00:00Z') } } };
  const st = deepFreeze({ v: 1, current: 'snpm-2026', list: [vieille, regate({ id: 'z' })] });
  const n = seedNorm(st);
  assert.notEqual(n, st);
  assert.equal(n.list[0].at, SEED_AT); assert.deepEqual(n.list[0].ic.validated, { by: null, at: SEED_AT });
  assert.equal(n.list[1], st.list[1], 'les autres régates restent le même objet');
  assert.equal(seedNorm(n), n, 'idempotent : état inchangé → même objet');
  const revalidee = { ...vieille, ic: { ...vieille.ic, read: 'motifs', validated: { by: 'Thibaud', at: t('2026-10-21T10:00:00Z') } } };
  const st2 = deepFreeze({ v: 1, current: 'snpm-2026', list: [revalidee] });
  assert.equal(seedNorm(st2), st2, 'une fiche revalidée est intacte');
  assert.equal(seedNorm(st2).list[0], revalidee);
});

test('backfillAuthor : l’auteur de la validation d’une graine commune (instant SEED_AT) n’est jamais complété ; le reste inchangé', () => {
  const graine = fromEvent({ id: 'snpm-2026', ...SNPM }, 1, null);
  const autre = regate({ id: 'b', by: null, ic: { fields: {}, text: '', source: '', read: 'saisie', excerpts: {}, validated: { by: null, at: 5 } }, races: [{ n: 1, by: null, at: 1 }] });
  const { st, n } = backfillAuthor(deepFreeze({ v: 1, current: 'b', list: [graine, autre] }), 'Teiva');
  assert.equal(st.list[0].ic.validated.by, null, 'la graine reste sans auteur de validation');
  assert.equal(st.list[0].by, 'Teiva', 'la fiche elle-même est signée');
  assert.equal(st.list[1].ic.validated.by, 'Teiva', 'une validation réelle est complétée');
  assert.equal(n, 4, 'régate graine + régate b + son IC + sa manche');
});

test('garde : js/app.js normalise la graine au chargement (index réécrit seulement si l’objet change), copie de secours et legacyStamp avant le premier envoi', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /seedNorm\(REG\)/);
  assert.match(app, /seeded !== REG\)[^\n]*saveRegattas\(/, 'réécrit seulement si l’objet a changé');
  assert.match(bodyOf(app, 'syncNow'), /!SYNC\.first[^\n]*legacyStamp\(REG\)/);
  assert.match(app, /rade\.regates\.v1\.bak/);
});

test('graine SNPM (contrôle W1) : seuls les champs d’instant changent — at, ic.validated.at et l’auteur de la validation ; le contenu de js/courses.js reste celui de la référence', () => {
  const fiche = { id: 'snpm-2026', ...SNPM, source: 'IC fournies (PDF)' };
  const ancienne = fromEvent({ ...fiche, id: 'copie' }, 123456, 'Teiva');           // ce que faisait fromEvent pour toute fiche : l’instant de la reprise
  const graine = fromEvent(fiche, 123456, 'Teiva');
  const nu = (r) => { const { at, id, ...x } = r; const { validated, ...ic } = x.ic; return { ...x, ic }; };
  assert.deepEqual(nu(graine), nu(ancienne), 'tout le reste est identique : nom, dates, club, champs de l’IC, texte, séquence, pavillons');
  assert.deepEqual(Object.keys(graine).sort(), Object.keys(ancienne).sort());
  assert.deepEqual([ancienne.at, ancienne.ic.validated], [123456, { by: 'Teiva', at: 123456 }]);
  assert.deepEqual([graine.at, graine.ic.validated], [SEED_AT, { by: null, at: SEED_AT }]);
  assert.equal(graine.ic.fields.vhf, SNPM.vhf); assert.equal(graine.name, SNPM.event); assert.equal(graine.dateStart, SNPM.date);
  const src = readFileSync(ROOT + 'js/courses.js', 'utf8');
  assert.ok(!/SEED_AT/.test(src), 'js/courses.js (référence de la Coupe SNPM) n’est pas touché');
});

// ───────────────────────── historique des valeurs écrasées (D-04, plan 04-03)

const H0 = Date.parse('2026-10-21T12:05:00Z');                    // 21/10 14:05 à Paris
const hist = (extra = {}) => ([
  { kind: 'head', id: 'r1', t: H0, by: 'Teiva', v: { name: 'Ancien nom', club: 'CVAT', dateStart: '2026-11-07', dateEnd: '2026-11-08' } },
  { kind: 'race', id: 'm202611071055', t: H0 + 60e3, by: 'Thibaud', v: { id: 'm202611071055', date: '2026-11-07', time: '10:55', courseId: 3, cls: 'G', laps: 2 } },
  { kind: 'mark', id: 'X1', t: H0 + 120e3, by: null, v: { id: 'X1', name: 'Alpha', lat: 43.097417, lon: 5.93415, status: 'a_confirmer' } },
  { kind: 'course', id: '101', t: H0 + 180e3, by: 'Teiva', v: { id: '101', name: 'Parcours A' } },
  { kind: 'trace', id: 't1', t: H0 + 240e3, by: 'Romain', v: { id: 't1', name: 'Sortie du dimanche', start: H0 } },
  { kind: 'head', id: 'r1', t: H0 - 1000, by: 'Romain', v: null },
]).map((x, i) => (i === 0 ? { ...x, ...extra } : x));

test('historySectionHTML : rien sans historique ; sinon un <details> replié « Historique (n) », de la plus récente à la plus ancienne', () => {
  assert.equal(historySectionHTML({}), ''); assert.equal(historySectionHTML({ hist: [] }), ''); assert.equal(historySectionHTML(null), ''); assert.equal(historySectionHTML({ hist: 'x' }), '');
  const { document } = parseHTML(`<html><body>${historySectionHTML({ hist: hist() })}</body></html>`);
  const d = document.querySelector('details.rghist');
  assert.ok(d && !d.hasAttribute('open'), 'replié');
  assert.equal(d.querySelector('summary').textContent, 'Historique (6)');
  const lignes = [...d.querySelectorAll('.rghl')].map((l) => l.textContent);
  assert.equal(lignes.length, 6);
  assert.match(lignes[0], /^Trace · 21\/10 14:09 · par Romain/); assert.match(lignes[0], /Sortie du dimanche/);
  assert.match(lignes[1], /^Parcours · .* par Teiva/); assert.match(lignes[1], /Parcours A/);
  assert.match(lignes[2], /^Bouée · .* — /); assert.match(lignes[2], /Alpha/); assert.match(lignes[2], /43°/);
  assert.match(lignes[3], /^Manche · 21\/10 14:06 · par Thibaud/); assert.match(lignes[3], /07\/11/); assert.match(lignes[3], /10:55/);
  assert.match(lignes[4], /^Fiche · 21\/10 14:05 · par Teiva/); assert.match(lignes[4], /Ancien nom/); assert.match(lignes[4], /CVAT/); assert.match(lignes[4], /07\/11/);
  assert.match(lignes[5], /\(texte des IC non conservé\)/, 'valeur nulle : seule la trace de l’écrasement reste');
});

test('historySectionHTML : un nom, un prénom ou une ancienne valeur piégés ne produisent ni img ni script ni attribut on* ; texte borné à 120 caractères ; 30 lignes au plus', () => {
  const piege = '<img src=x onerror=alert(1)>"\'<script>x</script>';
  const h = [
    { kind: 'head', id: 'r', t: H0, by: piege, v: { name: piege, club: piege, dateStart: piege, dateEnd: '' } },
    { kind: 'race', id: piege, t: H0 + 1, by: '<b>Pirate</b>', v: { date: piege, time: piege } },
    { kind: 'mark', id: 'X1', t: H0 + 2, by: 'a', v: { name: piege, lat: 'x', lon: {} } },
    { kind: piege, id: 'z', t: H0 + 3, by: 'a', v: { name: piege } },
    { kind: 'trace', id: 't', t: H0 + 4, by: 'a', v: { name: 'N'.repeat(5000) } },
    null, 42, { kind: 'race' }, { kind: 'race', t: 'x', v: {} },
  ];
  const html = historySectionHTML({ hist: h });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelectorAll('img, script, b').length, 0, 'balise injectée');
  for (const el of document.querySelectorAll('*')) for (const a of el.getAttributeNames()) assert.ok(!/^on/i.test(a), `attribut ${a} sur ${el.tagName}`);
  assert.ok(document.body.textContent.includes('<img src=x onerror=alert(1)>'), 'affiché en texte');
  for (const l of document.querySelectorAll('.rghl .rghv')) assert.ok(l.textContent.length <= 120, `valeur de ${l.textContent.length} caractères`);
  assert.equal(document.querySelectorAll('.rghl').length, 5, 'les entrées mal formées sont écartées');
  const beaucoup = Array.from({ length: 80 }, (_, i) => ({ kind: 'race', id: 'm' + i, t: H0 + i, by: 'a', v: { date: '2026-11-07', time: '10:55' } }));
  assert.equal(parseHTML(`<html><body>${historySectionHTML({ hist: beaucoup })}</body></html>`).document.querySelectorAll('.rghl').length, 30);
});

test('sheetHTML : la fiche contient la section « Historique » quand r.hist n’est pas vide, et pas sinon', () => {
  const now = t('2026-11-08T10:00:00Z');
  const sans = parseHTML(`<html><body>${sheetHTML(regate({}), { now })}</body></html>`).document;
  assert.equal(sans.querySelector('details.rghist'), null);
  const avec = parseHTML(`<html><body>${sheetHTML(regate({ hist: hist() }), { now })}</body></html>`).document;
  assert.ok(avec.querySelector('#rgSheet details.rghist'));
});

test('interrupteur : « Désactiver la synchronisation » en deux touches, « Réactiver » en une ; branché sur SYNC.off et le test canSync off reste vert', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /id="rgSyncOff"/);
  assert.match(app, /Désactiver la synchronisation/); assert.match(app, /Toucher encore pour désactiver/); assert.match(app, /Réactiver la synchronisation/);
  assert.match(app, /SYNC\.off = /);
});

// ───────────────────────── lisible hors réseau (plan 04-04, ARCH-03)

const PIEGE_ID = 'tr1"><img src=x onerror=alert(1)>';
const refTrace = (id, over = {}) => ({ id, name: 'Trace <b>x</b>', start: t('2026-11-07T09:00:00Z'), n: 600, by: 'Teiva', at: t('2026-11-07T12:00:00Z'), ...over });
const rendu = (html) => parseHTML(`<html><body>${html}</body></html>`).document;

test('fiche : chaque trace dit « sur ce téléphone » ou « en ligne seulement » ; sans cet état, la fiche reste comme avant ; une trace absente n’a ni « Voir la trace » ni « Débrief »', () => {
  const r = regate({ traces: [refTrace('tr1'), refTrace('tr2', { report: { t: 5, by: 'Teiva' } })] });
  const sans = rendu(tracesSectionHTML(r));
  assert.equal(sans.querySelectorAll('.chip').length, 0, 'état inconnu : rien d’affiché');
  assert.equal(sans.querySelectorAll('[data-trv]').length, 2); assert.equal(sans.querySelectorAll('[data-trd]').length, 2);
  const avec = rendu(tracesSectionHTML(r, { local: new Set(['tr1']) }));
  const lignes = [...avec.querySelectorAll('.rgtr')];
  assert.match(lignes[0].textContent, /sur ce téléphone/); assert.doesNotMatch(lignes[0].textContent, /en ligne seulement/);
  assert.match(lignes[1].textContent, /en ligne seulement/);
  assert.ok(lignes[0].querySelector('[data-trv]') && lignes[0].querySelector('[data-trd]'));
  assert.equal(lignes[1].querySelector('[data-trv]'), null, 'pas de lecture d’une trace absente'); assert.equal(lignes[1].querySelector('[data-trd]'), null);
  assert.ok(lignes[1].querySelector('[data-trx]'), 'on peut toujours détacher');
});

test('fiche : « Télécharger pour le hors réseau » quand une trace ou un jour figé par un autre équipier manque ; rien quand tout est là ou que l’état est inconnu ; texte échappé', () => {
  const now = t('2026-11-08T10:00:00Z');
  const r = regate({ id: 'rg1', traces: [refTrace('tr1'), refTrace(PIEGE_ID)], frozen: { '2026-11-07': { at: 1, by: 'Teiva' }, '2026-11-08': { at: 2, by: 'Thibaud' }, '2026-11-09': { at: 3, by: 'Éric <i>' } } });
  const tout = { local: new Set(['tr1', PIEGE_ID]), daysLocal: new Set(['rg1|2026-11-07', 'rg1|2026-11-08', 'rg1|2026-11-09']), me: 'Thibaud' };
  assert.equal(rendu(sheetHTML(r, { now, ...tout })).querySelector('[data-rg-dl]'), null, 'tout est là');
  assert.equal(rendu(sheetHTML(r, { now })).querySelector('[data-rg-dl]'), null, 'état inconnu');
  const trace = rendu(sheetHTML(r, { now, ...tout, local: new Set(['tr1']) })), b = trace.querySelector('[data-rg-dl]');
  assert.ok(b, 'une trace manque'); assert.equal(b.textContent.trim(), 'Télécharger pour le hors réseau'); assert.equal(b.getAttribute('data-rg-dl'), 'rg1');
  assert.match(trace.querySelector('.rgdl').textContent, /1 trace/);
  const jours = rendu(sheetHTML(r, { now, ...tout, daysLocal: new Set(['rg1|2026-11-08']) }));
  assert.match(jours.querySelector('.rgdl').textContent, /2 jours de vent figé/, 'les jours de Teiva et d’Éric manquent ; celui de Thibaud (moi) ne compte pas');
  const moi = rendu(sheetHTML(r, { now, ...tout, daysLocal: new Set(), me: 'thibaud' }));
  assert.match(moi.querySelector('.rgdl').textContent, /2 jours/, 'mon jour n’est jamais « à télécharger »');
  const sansNom = rendu(sheetHTML(r, { now, ...tout, daysLocal: new Set(), me: null }));
  assert.equal(sansNom.querySelector('[data-rg-dl]'), null, 'prénom inconnu : on ne sait pas quels jours sont les miens');
  // aucune balise ni attribut injecté par un identifiant ou un nom venu d’un autre téléphone
  const piege = rendu(sheetHTML(regate({ id: 'rg"><img src=y>', traces: [refTrace(PIEGE_ID)], frozen: { '2026-11-07': { at: 1, by: 'Éric <i>' } } }), { now, local: new Set(), daysLocal: new Set(), me: 'Thibaud' }));
  assert.equal(piege.querySelectorAll('img, i').length, 0, 'balise injectée');
  for (const el of piege.querySelectorAll('*')) for (const a of el.getAttributeNames()) assert.ok(!/^on/i.test(a), `attribut ${a} sur ${el.tagName}`);
  assert.equal(piege.querySelector('[data-rg-dl]').getAttribute('data-rg-dl'), 'rg"><img src=y>', 'identifiant intact, hors balise');
});

test('câblage du téléchargement : le geste respecte la course et le verrou du jour avant tout appel, passe par runHeavyNow({ only }) et ne contourne pas le désactivé', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  const lourd = bodyOf(app, 'runHeavyNow'), geste = bodyOf(app, 'telecharger');
  assert.ok(lourd && geste);
  const a = lourd.indexOf('raceActive(Date.now())'), v = lourd.indexOf('raceLock().locked'), r = lourd.indexOf('runHeavy(');
  assert.ok(a >= 0 && v > a && r > v, 'course, puis verrou du jour, puis le passage');
  assert.match(lourd, /Course en cours : téléchargement après la course/); assert.match(lourd, /Journée de régate : téléchargement au retour au port/);
  assert.match(lourd, /SYNC\.off/);
  assert.match(geste, /runHeavyNow\(\{ only: rid, manuel: true \}\)/); assert.match(geste, /SYNC\.off/);
  assert.match(app, /\$\$\('\[data-rg-dl\]', el\)\.forEach/);
  assert.match(app, /local: LOCAL\?\.traces \?\? null, daysLocal: LOCAL\?\.days \?\? null, me: who\(\)/);
});

test('aide et guide : « Télécharger pour le hors réseau » a sa bulle, le guide explique la lecture hors réseau et ne dit plus que traces et rapports restent sur un seul téléphone', async () => {
  const { DL_TIP, SYNC_TIP, tip } = await import('../js/help.js');
  const now = t('2026-11-08T10:00:00Z');
  const r = regate({ id: 'rg1', traces: [refTrace('tr1')] });
  const doc = rendu(sheetHTML(r, { now, local: new Set(), daysLocal: new Set(), me: 'Thibaud', tipHtml: tip(DL_TIP) }));
  const bulle = doc.querySelector('.rgdl .tip-i');
  assert.ok(bulle, 'bulle d’aide à côté du bouton'); assert.equal(bulle.getAttribute('data-tip'), DL_TIP);
  assert.equal(rendu(sheetHTML(r, { now, local: new Set(), daysLocal: new Set(), me: 'Thibaud' })).querySelector('.rgdl .tip-i'), null, 'sans bulle fournie, rien de plus');
  assert.match(DL_TIP, /six derniers mois/); assert.match(DL_TIP, /mode avion/); assert.match(SYNC_TIP, /traces, débriefs et rapports/);
  const guide = readFileSync(ROOT + 'guide.html', 'utf8');
  for (const motif of [/Lire une régate hors réseau/, /Télécharger pour le hors réseau/, /six derniers mois et à venir/, /mode avion/, /1 Mo par régate/, /sur ce téléphone/, /en ligne seulement/, /écran d’accueil/]) assert.match(guide, motif);
  assert.doesNotMatch(guide, /sur le téléphone qui les a|restent pour l’instant|viendra avec la version suivante|pas encore partagés/, 'plus de mention d’un partage à venir');
  // ni code d'accès ni adresse du magasin dans le guide ou les bulles (T-04-31)
  for (const texte of [guide, DL_TIP, SYNC_TIP]) assert.doesNotMatch(texte, /blob\.vercel|vercel-storage|\?acces=|rt_acces|BLOB_READ_WRITE_TOKEN/i);
});
