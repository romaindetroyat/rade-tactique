// Régates (REG-01, REG-02, ARCH-02) : statut au jour de Paris, saison, reprise des fiches IC, création, manches, verrou de régate,
// règle d’ouverture (entraînement libre, jour J), auteur, vues sans injection (linkedom) et gardes statiques du câblage de js/app.js.
// Aucun code d’accès ni aucune empreinte ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { bodyOf } from './helpers/scan.mjs';
import {
  KEY, VERSION, STATUS_LABEL, GROUP_LABEL, regattaStatus, seasonOf, todayRegatta, lockDates, openRegatta, openAtBoot, openOnNewDay, fromEvent, migrate, saveRegattas, newId, createRegatta,
  upsertRegatta, removeRegatta, icOf, groupByStatus, SEED_AT, seedNorm, backfillAuthor, seedGpen, setCommuns, GPEN_SEED_KEY,
} from '../js/regates.js';
import { join } from 'node:path';
import { ESPACES } from '../js/espaces.js';
import { VENUES } from '../js/venues.js';
import { releve, demarre, memoire, CAS } from './helpers/graines.mjs';
import { parisClock, isRaceDay } from '../js/racelock.js';
import { escHTML, byLine, listHTML, noRegattaHTML, newRegattaFormHTML, sheetHTML, historySectionHTML, tracesSectionHTML, venueCardHTML } from '../js/regview.js';
import { IC as SNPM } from '../js/courses.js';
import { verdict } from '../tools/regate-e2e.mjs';
import { stamp } from '../js/archmerge.js';

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
  assert.deepEqual(STATUS_LABEL, { avenir: 'En préparation', aujourdhui: 'En cours', passee: 'Terminée' });
  assert.deepEqual(GROUP_LABEL, { avenir: 'En préparation', aujourdhui: 'En cours', passee: 'Terminées' });
  assert.equal(seasonOf('2026-11-07'), '2026');
  assert.equal(seasonOf('2027-01-02'), '2027');
  assert.equal(seasonOf(''), '—');
});

test('verrou : la régate d’aujourd’hui de la liste commande, ouverte ou non ; sinon aucun verrou', () => {
  const snpm = regate({ id: 'snpm-2026', dateStart: '2026-10-18', dateEnd: '' }), nov = regate({ id: 'nov' });
  const list = [snpm, nov];
  assert.deepEqual(lockDates({ now: t('2026-11-07T10:00:00Z'), list }), { raceFrom: '2026-11-07', raceTo: '2026-11-09' });
  assert.deepEqual(lockDates({ now: t('2026-10-18T10:00:00Z'), list }), { raceFrom: '2026-10-18', raceTo: '2026-10-18' });
  assert.deepEqual(lockDates({ now: t('2026-10-20T10:00:00Z'), list }), { raceFrom: null, raceTo: null }, 'un jour sans régate : jamais de verrou, quelle que soit la régate ouverte');
  assert.deepEqual(lockDates({ now: 0, list: [] }), { raceFrom: null, raceTo: null });
  assert.deepEqual(lockDates({ now: 0 }), { raceFrom: null, raceTo: null });
  // deux régates le même jour : la régate ouverte départage, sinon la première de la liste
  const b = regate({ id: 'b' });
  assert.equal(todayRegatta({ now: t('2026-11-08T10:00:00Z'), list: [nov, b], currentId: 'b' }).id, 'b');
  assert.equal(todayRegatta({ now: t('2026-11-08T10:00:00Z'), list: [nov, b], currentId: 'x' }).id, 'nov');
  assert.equal(todayRegatta({ now: t('2026-11-08T10:00:00Z'), list: [nov, b] }).id, 'nov', 'sans régate ouverte : la première du jour');
  assert.equal(todayRegatta({ now: t('2026-12-08T10:00:00Z'), list: [nov, b], currentId: 'b' }), null);
});

test('verrou : équivalence avec la v36 (régate d’aujourd’hui en préférant la courante, sinon la courante) pour chaque jour du 15/10 au 12/11 et chaque courante d’alors', () => {
  const list = [regate({ id: 'snpm-2026', dateStart: '2026-10-18', dateEnd: '' }), regate({ id: 'nov' }), regate({ id: 'dec', dateStart: '2026-12-05', dateEnd: '' })];
  const ancien = ({ now, list: l, currentId }) => {                                   // la règle de la v36, réécrite ici comme référence
    const r = todayRegatta({ now, list: l, currentId }) || l.find((x) => x.id === currentId) || null;
    return { raceFrom: r?.dateStart || null, raceTo: r?.dateEnd || r?.dateStart || null };
  };
  let jours = 0;
  for (let ms = t('2026-10-15T08:00:00Z'); ms <= t('2026-11-12T08:00:00Z'); ms += 864e5, jours++) {
    for (const currentId of [null, ...list.map((r) => r.id)]) {
      const nouveau = lockDates({ now: ms, list }), vieux = ancien({ now: ms, list, currentId });
      assert.equal(isRaceDay({ now: ms, ...nouveau }), isRaceDay({ now: ms, ...vieux }), `${new Date(ms).toISOString()} courante ${currentId}`);
    }
  }
  assert.equal(jours, 29);
});

test('ouverture au lancement : la régate d’aujourd’hui (jour de Paris), sinon entraînement libre ; jamais de mémoire', () => {
  const snpm = regate({ id: 'snpm-2026', dateStart: '2026-10-18', dateEnd: '' }), nov = regate({ id: 'nov', dateStart: '2026-11-07', dateEnd: '2026-11-09' });
  const list = deepFreeze([snpm, nov]);
  assert.equal(openAtBoot({ now: t('2026-10-22T08:30:00Z'), list }), null, 'jeudi 22/10 : aucune régate');
  assert.equal(openAtBoot({ now: t('2026-10-18T08:00:00Z'), list }), 'snpm-2026');
  assert.equal(openAtBoot({ now: t('2026-11-08T10:00:00Z'), list }), 'nov');
  const le25 = deepFreeze([regate({ id: 'oct25', dateStart: '2026-10-25', dateEnd: '' })]);
  assert.equal(openAtBoot({ now: t('2026-10-24T22:30:00Z'), list: le25 }), 'oct25', '00:30 le 25 à Paris (heure d’été)');
  assert.equal(openAtBoot({ now: t('2026-10-24T21:30:00Z'), list: le25 }), null, '23:30 le 24 à Paris');
  assert.equal(openAtBoot({ now: t('2026-11-08T10:00:00Z'), list: [] }), null);
  assert.equal(openAtBoot({ now: t('2026-11-08T10:00:00Z') }), null, 'liste absente');
  assert.equal(openAtBoot({ now: t('2026-11-08T10:00:00Z'), list: [regate({ id: 'p' }), regate({ id: 'q' })] }), 'p', 'deux régates aujourd’hui : la première de la liste');
  // plan d’eau (07-05) : la régate du jour d’un autre plan d’eau n’est pas ouverte ; « Passer » (reopen) rouvre la régate demandée si elle est ici
  const ici = (r) => (r.venue || 'toulon') === 'brest', jour = t('2026-11-08T10:00:00Z');
  const mixte = [regate({ id: 'tln' }), regate({ id: 'bst', venue: 'brest', dateStart: '2026-12-01', dateEnd: '' })];
  assert.equal(openAtBoot({ now: jour, list: mixte, here: ici }), null, 'régate du jour à Toulon, téléphone à Brest : rien d’ouvert');
  assert.equal(openAtBoot({ now: jour, list: mixte, here: ici, reopen: 'bst' }), 'bst', 'régate demandée par « Passer » (même hors de ses jours)');
  assert.equal(openAtBoot({ now: jour, list: mixte, here: ici, reopen: 'tln' }), null, 'régate demandée d’un autre plan d’eau : refusée');
  assert.equal(openAtBoot({ now: jour, list: mixte, here: ici, reopen: 'inconnue' }), null);
  assert.equal(openAtBoot({ now: jour, list: mixte, reopen: null }), 'tln', 'sans plan d’eau : la règle de la v42');
});

test('openRegatta : la régate ou null, jamais la première par défaut', () => {
  const list = deepFreeze([regate({ id: 'a' }), regate({ id: 'b' })]);
  assert.equal(openRegatta(list, 'b').id, 'b');
  for (const id of [null, undefined, 'inconnue', '']) assert.equal(openRegatta(list, id), null, String(id));
  assert.equal(openRegatta([], 'a'), null); assert.equal(openRegatta(undefined, 'a'), null);
});

test('passage de jour : openOnNewDay n’ouvre rien le même jour, ouvre la régate du nouveau jour, garde l’écran un jour sans régate', () => {
  const nov = regate({ id: 'nov' }), snpm = regate({ id: 'snpm-2026', dateStart: '2026-10-18', dateEnd: '' });
  const list = deepFreeze([snpm, nov]);
  assert.deepEqual(openOnNewDay({ now: t('2026-10-18T10:00:00Z'), list, openId: null, day: '2026-10-18' }), { day: '2026-10-18', openId: null }, 'même jour : rien ne change');
  assert.deepEqual(openOnNewDay({ now: t('2026-10-18T10:00:00Z'), list, openId: 'nov', day: '2026-10-18' }), { day: '2026-10-18', openId: 'nov' }, 'même jour : l’ouverte reste');
  assert.deepEqual(openOnNewDay({ now: t('2026-10-17T22:30:00Z'), list, openId: null, day: '2026-10-17' }), { day: '2026-10-18', openId: 'snpm-2026' }, '00:30 le 18 (heure d’été) : la régate du jour');
  assert.deepEqual(openOnNewDay({ now: t('2026-10-17T21:30:00Z'), list, openId: null, day: '2026-10-17' }), { day: '2026-10-17', openId: null }, '23:30 le 17 : toujours le 17');
  assert.deepEqual(openOnNewDay({ now: t('2026-11-06T23:00:30Z'), list, openId: null, day: '2026-11-06' }), { day: '2026-11-07', openId: 'nov' }, 'minuit de Paris en heure d’hiver');
  assert.deepEqual(openOnNewDay({ now: t('2026-11-06T22:59:30Z'), list, openId: null, day: '2026-11-06' }), { day: '2026-11-06', openId: null });
  assert.equal(openOnNewDay({ now: t('2026-11-08T10:00:00Z'), list, openId: 'snpm-2026', day: '2026-11-07' }).openId, 'nov', 'ouverte hors du jour : la régate du jour passe devant');
  const b = regate({ id: 'b' });
  assert.equal(openOnNewDay({ now: t('2026-11-08T10:00:00Z'), list: [nov, b], openId: 'b', day: '2026-11-07' }).openId, 'b', 'l’ouverte est de ce jour : elle reste');
  assert.deepEqual(openOnNewDay({ now: t('2026-10-20T10:00:00Z'), list, openId: 'snpm-2026', day: '2026-10-19' }), { day: '2026-10-20', openId: 'snpm-2026' }, 'nouveau jour sans régate : l’état ouvert est gardé');
  assert.deepEqual(openOnNewDay({ now: t('2026-10-20T10:00:00Z'), list, openId: null, day: '2026-10-19' }), { day: '2026-10-20', openId: null });
});

test('reprise : une fiche rade.events.v1 devient une régate (CVAT, VHF 72), sans toucher la clé d’origine, deuxième appel identique', () => {
  const ancien = JSON.stringify({ current: 'snpm-2026', list: [
    { id: 'snpm-2026', event: 'Coupe de la SNPM — CVAT', date: '2026-10-18', dateEnd: '2026-10-17', vhf: 72, firstWarning: '10:55', text: 'IC', source: 'IC fournies (PDF)' },
    { id: 'ev1', event: 'Trophée du Large', date: '2026-11-07', dateEnd: '2026-11-09', vhf: 69, source: 'tl.pdf' },
  ] });
  const storage = mem({ 'rade.events.v1': ancien });
  const a = migrate({ storage, now: 1000, by: 'Teiva' });
  assert.equal(a.v, VERSION); assert.ok(!('current' in a), 'aucune régate ouverte dans l’index'); assert.equal(a.list.length, 2);
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
  assert.equal(st.list.length, 1); assert.ok(!('current' in st), 'sans régate ouverte');
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
  // plan d’eau (D-06) : liste blanche ; écrit hors de Toulon seulement (une régate de Toulon a la forme de la v42 : absent = Toulon)
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07', venue: 'brest' }, { now }).regatta.venue, 'brest');
  for (const v of [undefined, 'toulon', 'lorient', '__proto__', {}, 'Brest']) assert.ok(!('venue' in createRegatta({ name: 'R', dateStart: '2026-11-07', venue: v }, { now }).regatta), String(v));
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07', dateEnd: '2026-11-06' }, { now }).regatta.dateEnd, '', 'dernier jour antérieur ignoré');
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07', dateEnd: '2026-11-07' }, { now }).regatta.dateEnd, '', 'même jour : une régate d’un jour');
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07', dateEnd: '2026-02-30' }, { now }).regatta.dateEnd, '', 'dernier jour impossible ignoré');
  assert.equal(createRegatta({ name: 'R', dateStart: '2026-11-07' }, { now }).regatta.club, '', 'club facultatif');
  // tirages déterministes : avec Math.random, 200 identifiants de même instant ont environ 1 chance sur 80 d'en croiser deux (4 caractères au hasard) et le test échouait de temps en temps
  const ids = new Set(Array.from({ length: 200 }, (_, i) => createRegatta({ name: 'R', dateStart: '2026-11-07' }, { now, rnd: () => (i + 1) / 251 }).regatta.id));
  assert.equal(ids.size, 200, 'identifiants distincts');
  assert.match(newId(now, () => 0.123456789), /^rg[0-9a-z]+$/);
});

test('mises à jour : un nouvel état, jamais une mutation (état gelé), et jamais de régate ouverte', () => {
  const a = regate({ id: 'a' }), b = regate({ id: 'b', name: 'B' });
  const st = deepFreeze({ v: 1, list: [a] });
  const st2 = upsertRegatta(st, b);
  assert.equal(st2.list.length, 2); assert.equal(st.list.length, 1);
  assert.equal(upsertRegatta(st2, { ...b, name: 'B2' }).list[1].name, 'B2');
  assert.equal(upsertRegatta(st2, { ...b, name: 'B2' }).list.length, 2);
  assert.ok(!('current' in st2), 'ajouter une régate n’en ouvre aucune');
  assert.ok(!('current' in upsertRegatta({ v: 1, list: [] }, a)), 'la première régate non plus');
  assert.deepEqual(removeRegatta(st2, 'b').list.map((r) => r.id), ['a']);
  assert.ok(!('current' in removeRegatta(st2, 'a')), 'supprimer ne rouvre pas la première');
  assert.deepEqual(removeRegatta(st, 'a').list, []);
  assert.equal(st.list.length, 1, 'état d’origine intact');
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

test('groupByStatus : En préparation (croissant, sans date en dernier), En cours, Terminées (décroissant) ; groupes vides absents', () => {
  const now = t('2026-11-08T10:00:00Z');
  const list = [
    regate({ id: 'p1', name: 'P1', dateStart: '2026-10-18', dateEnd: '', season: '2026' }), regate({ id: 'p2', name: 'P2', dateStart: '2026-09-05', dateEnd: '', season: '2026' }),
    regate({ id: 'au', name: 'Auj' }), regate({ id: 'v2', name: 'V2', dateStart: '2026-12-20', dateEnd: '', season: '2026' }), regate({ id: 'v1', name: 'V1', dateStart: '2026-11-21', dateEnd: '', season: '2026' }),
    regate({ id: 's27', name: 'S27', dateStart: '2027-03-01', dateEnd: '', season: '2027' }), regate({ id: 'sd', name: 'SD', dateStart: '', dateEnd: '', season: '—' }),
    regate({ id: 'p3', name: 'A-même-date', dateStart: '2026-10-18', dateEnd: '', season: '2026' }),
  ];
  const g = groupByStatus(list, now);
  assert.deepEqual(g.map((x) => [x.status, x.label, x.items.map((r) => r.id)]), [
    ['avenir', 'En préparation', ['v1', 'v2', 's27', 'sd']], ['aujourdhui', 'En cours', ['au']], ['passee', 'Terminées', ['p3', 'p1', 'p2']],
  ]);
  assert.deepEqual(groupByStatus(list.filter((r) => r.id === 'au'), now).map((x) => x.status), ['aujourdhui'], 'groupes vides absents');
  assert.deepEqual(groupByStatus([], now), []); assert.deepEqual(groupByStatus(undefined, now), []);
});

test('vues : un nom ou un club piégé ne produit ni img ni script (liste, fiche, formulaire) ; l’apostrophe est échappée', () => {
  const piege = regate({ name: '<img src=x onerror=alert(1)>', club: '"><script>x</script>', by: '<b>Pirate</b>', at: t('2026-11-01T10:00:00Z') });
  const now = t('2026-11-08T10:00:00Z');
  const html = listHTML(groupByStatus([piege], now), { openId: piege.id, now }) + listHTML(groupByStatus([piege], now), { now }) + sheetHTML(piege, { now }) + newRegattaFormHTML({ name: '"><img src=x>', dateStart: '2026-11-07', dateEnd: '', club: '\'x\'' }, { name: '<script>e</script>' });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  assert.equal(document.querySelectorAll('img, script, b').length, 0, 'balise injectée');
  for (const el of document.querySelectorAll('*')) for (const a of el.getAttributeNames()) assert.ok(!/^on/i.test(a), `attribut ${a} sur ${el.tagName}`);
  assert.ok(document.body.textContent.includes('<img src=x onerror=alert(1)>'), 'le nom s’affiche en texte');
  assert.equal(escHTML('l\'été "oui" <&>'), 'l&#39;été &quot;oui&quot; &lt;&amp;&gt;');
  assert.ok(!listHTML(groupByStatus([regate({ name: 'L\'Aber' })], now), { now }).includes('\'Aber'), 'apostrophe échappée');
  assert.ok(!noRegattaHTML().includes('<script'), 'carte sans donnée de régate');
});

test('plan d’eau (D-06) : formulaire « Plan d’eau » (défaut fourni), puce « Rade de Brest » dans la liste et la fiche, rien pour Toulon', () => {
  const now = t('2026-11-08T10:00:00Z');
  const form = (d) => parseHTML(`<html><body>${newRegattaFormHTML(d)}</body></html>`).document;
  const f = form({ name: '', dateStart: '2026-11-07', venue: 'brest' });
  assert.deepEqual([...f.querySelectorAll('#rgVenue option')].map((o) => [o.value, o.textContent, o.hasAttribute('selected')]), [['toulon', 'Rade de Toulon', false], ['brest', 'Rade de Brest', true]]);
  for (const v of [undefined, 'lorient', '"><img>']) assert.equal(form({ venue: v }).querySelector('#rgVenue option[selected]').value, 'toulon', String(v));
  assert.equal(f.querySelector('label[for=rgVenue]').textContent, 'Plan d’eau');
  const brest = regate({ id: 'b', name: 'Entraînement Brest', venue: 'brest' }), toulon = regate({ id: 't', name: 'CVAT', venue: 'toulon' }), ancienne = regate({ id: 'v', name: 'v42' });
  const { document } = parseHTML(`<html><body>${listHTML(groupByStatus([brest, toulon, ancienne], now), { now })}</body></html>`);
  const puce = (id) => [...document.querySelectorAll(`.rg[data-rg-row="${id}"] .rgv`)].map((x) => [x.textContent, x.getAttribute('data-venue')]);
  assert.deepEqual(puce('b'), [['Rade de Brest', 'brest']]);
  assert.deepEqual(puce('t'), []); assert.deepEqual(puce('v'), [], 'régate sans venue : Toulon, rien de plus');
  assert.match(sheetHTML(brest, { now }), /class="chip pres rgv" data-venue="brest">Rade de Brest</);
  assert.doesNotMatch(sheetHTML(toulon, { now }), /rgv/);
  assert.equal(sheetHTML(toulon, { now }), sheetHTML(ancienne.id === 't' ? ancienne : { ...toulon, venue: undefined }, { now }), 'fiche de Toulon : même vue avec ou sans venue');
});

test('vues : liste par statut, bouton « Ouvrir » par régate, régate ouverte marquée « Ouverte » sans bouton, attribut data-rg entre guillemets, auteur « — » sans auteur', () => {
  const now = t('2026-11-08T10:00:00Z');
  const a = regate({ id: 'a', name: 'Aujourd’hui CVAT', by: 'Teiva', at: t('2026-11-01T10:00:00Z') }), b = regate({ id: 'b', name: 'L’Aber "x"', dateStart: '2026-12-01', dateEnd: '', by: null });
  const html = listHTML(groupByStatus([a, b], now), { openId: 'a', now });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  assert.deepEqual([...document.querySelectorAll('.rggroup h4')].map((x) => x.textContent), ['En préparation', 'En cours']);
  const [rb, ra] = [...document.querySelectorAll('.rg[data-rg-row]')];
  assert.equal(ra.getAttribute('data-rg-row'), 'a'); assert.equal(rb.getAttribute('data-rg-row'), 'b');
  assert.ok(ra.classList.contains('on')); assert.ok(!rb.classList.contains('on'));
  assert.equal(ra.querySelector('[data-rg]'), null, 'la régate ouverte n’a pas de bouton « Ouvrir »');
  assert.match(ra.textContent, /Ouverte/); assert.doesNotMatch(rb.textContent, /Ouverte/);
  const bouton = rb.querySelector('button[data-rg]');
  assert.equal(bouton.getAttribute('data-rg'), 'b'); assert.equal(bouton.textContent, 'Ouvrir'); assert.equal(bouton.getAttribute('aria-label'), 'Ouvrir L’Aber "x"');
  assert.match(ra.textContent, /par Teiva le 01\/11/); assert.match(rb.textContent, /—/); assert.ok(!/par /.test(rb.textContent));
  assert.match(html, /data-rg="b"/);
  assert.equal(byLine(null, 1), '—'); assert.equal(byLine('Teiva', t('2026-11-01T23:30:00Z')), 'par Teiva le 02/11', 'jour de Paris');
  assert.equal(byLine('Teiva'), 'par Teiva');
  assert.match(listHTML([], {}), /Aucune régate pour l’instant/);
  assert.equal(sheetHTML(null), '', 'sans régate ouverte, pas de fiche');
  assert.match(rb.textContent, /En préparation/);
});

test('noRegattaHTML : carte « Aucune régate ouverte » avec l’entraînement libre, l’import des IC relié à #icFile et #icMsg', () => {
  const { document } = parseHTML(`<html><body>${noRegattaHTML()}</body></html>`);
  const carte = document.querySelector('#rgNone');
  assert.ok(carte); assert.equal(carte.querySelector('h3').textContent, 'Aucune régate ouverte');
  for (const m of ['Entraînement libre', '« Ouvrir »', 'Le jour d’une régate, l’app l’ouvre toute seule', 'créent une nouvelle régate', 'ouvrez-la d’abord']) assert.ok(carte.textContent.includes(m), m);
  const label = carte.querySelector('label[for=icFile]');
  assert.equal(label.textContent, '＋ Importer des IC (PDF)');
  assert.ok(carte.querySelector('input#icFile[type=file]') && carte.querySelector('#icMsg'));
  assert.equal(document.querySelector('#rgSheet'), null, 'aucune fiche');
});

test('migrate : appareil neuf, index v36 avec régate courante, reprise : jamais de clé current, une seule réécriture ; saveRegattas ne l’écrit jamais', () => {
  const neuf = mem(), st = migrate({ storage: neuf, now: t('2026-10-22T08:30:00Z') });
  assert.ok(!('current' in st)); assert.ok(!('current' in JSON.parse(neuf.getItem(KEY))), 'index écrit sans current');
  // index v36 : la Coupe SNPM est la courante
  const v36 = { v: 1, current: 'snpm-2026', list: st.list };
  const stockage = mem({ [KEY]: JSON.stringify(v36) });
  let ecritures = 0; const setItem = stockage.setItem; stockage.setItem = (k, v) => { ecritures++; setItem(k, v); };
  const a = migrate({ storage: stockage, now: 1 });
  assert.ok(!('current' in a)); assert.equal(ecritures, 1, 'réécrit une seule fois'); assert.deepEqual(a.list, st.list, 'les régates ne bougent pas');
  assert.ok(!('current' in JSON.parse(stockage.getItem(KEY))));
  const b = migrate({ storage: stockage, now: 2 });
  assert.deepEqual(b, a); assert.equal(ecritures, 1, 'plus aucune écriture au second appel');
  // reprise de rade.events.v1 qui portait current
  const ancien = mem({ 'rade.events.v1': JSON.stringify({ current: 'ev1', list: [{ id: 'ev1', event: 'X', date: '2026-11-07' }] }) });
  assert.ok(!('current' in migrate({ storage: ancien, now: 1 })));
  assert.ok(!('current' in JSON.parse(ancien.getItem(KEY))));
  // saveRegattas écrit sans current même si l’état en porte un
  const s3 = mem(); assert.equal(saveRegattas(s3, { v: 1, current: 'a', list: [] }), true);
  assert.deepEqual(JSON.parse(s3.getItem(KEY)), { v: 1, list: [] });
  assert.ok(!/"current"/.test(s3.getItem(KEY)));
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

// ───────────────────────── modifier une manche (v42)

const modifie = (r, key, race, by = 'Thibaud', now = 5000) => R.updateRace(r, key, race, { now, by, courses: PARCOURS, rnd: () => 0.123456 });
// régate de deux manches marquées comme après une synchronisation (id jour + heure, u/ub posés)
const deuxManches = () => {
  let r = regate();
  r = ajoute(r, { date: '2026-11-07', time: '10:55', courseId: 5, cls: 'G', laps: 2, note: 'vent faible' }).regatta;
  r = ajoute(r, { date: '2026-11-07', time: '13:25', courseId: 3, cls: 'P', laps: 1 }).regatta;
  return deepFreeze(stamp(null, r, { now: 1000, by: 'Teiva' }));
};

test('modifier une manche : mêmes refus qu’à l’ajout, un message par champ, régate inchangée ; manche introuvable : refus clair', () => {
  const r = deuxManches();
  const bad = (race, champ) => { const x = modifie(r, 1, race); assert.equal(x.ok, false, JSON.stringify(race)); assert.match(x.errors[champ] || '', /[a-zé]/i, `message pour ${champ}`); assert.equal(x.regatta, r, 'régate inchangée'); };
  bad({ date: '2026-11-06' }, 'date'); bad({ time: '25:00' }, 'time'); bad({ courseId: 9999 }, 'courseId'); bad({ cls: 'Z' }, 'cls');
  bad({ laps: 0 }, 'laps'); bad({ laps: 5 }, 'laps'); bad({ note: 'n'.repeat(201) }, 'note');
  const absente = modifie(r, 9, { note: 'x' });
  assert.equal(absente.ok, false); assert.match(absente.errors.race, /introuvable/); assert.equal(absente.regatta, r);
  assert.equal(modifie(r, 'm-inconnu', { note: 'x' }).ok, false, 'identifiant inconnu');
});

test('modifier une manche sans changer jour ni heure : même identifiant, champs absents gardés, auteur et instant de création gardés ; stamp date la modification', () => {
  const r = deuxManches(), id = r.races[0].id;
  const x = modifie(r, 1, { courseId: '3', note: ' grain annoncé ' });
  assert.equal(x.ok, true); assert.equal(x.moved, false);
  const m = x.regatta.races[0];
  assert.deepEqual([m.id, m.n, m.date, m.time, m.courseId, m.cls, m.laps, m.note, m.by, m.at], [id, 1, '2026-11-07', '10:55', 3, 'G', 2, 'grain annoncé', 'Teiva', 1000]);
  assert.deepEqual(modifie(r, id, { note: 'par identifiant' }).regatta.races[0].note, 'par identifiant', 'désignée par son identifiant');
  assert.deepEqual(x.regatta.races[1], r.races[1], 'l’autre manche n’est pas touchée');
  const s = stamp(r, x.regatta, { now: 5000, by: 'Thibaud' });
  assert.deepEqual([s.races[0].u, s.races[0].ub, s.races[1].u], [5000, 'Thibaud', r.races[1].u], 'seule la manche modifiée reçoit u/ub');
  assert.deepEqual(s.tomb, {}, 'aucune pierre tombale');
  assert.equal(stamp(r, modifie(r, 1, {}).regatta, { now: 6000, by: 'Thibaud' }).races[0].u, r.races[0].u, 'rien de changé : rien de daté');
});

test('modifier le jour ou l’heure : la manche est déplacée (nouvel identifiant, pierre tombale de l’ancien, ancienne version dans l’historique), renumérotée, le choix suit', () => {
  const r = deepFreeze({ ...deuxManches(), sel: 1 }), ancien = r.races[0];
  const x = modifie(r, 1, { time: '14:00' });
  assert.equal(x.ok, true); assert.equal(x.moved, true);
  assert.deepEqual(x.regatta.races.map((m) => [m.n, m.time, m.id]), [[1, '13:25', r.races[1].id], [2, '14:00', 'm202611071400']]);
  assert.equal(x.regatta.sel, 2, 'la manche choisie suit sa nouvelle place');
  const m = x.regatta.races[1];
  assert.deepEqual([m.courseId, m.note, m.by, m.at, 'u' in m, 'ub' in m], [5, 'vent faible', 'Thibaud', 5000, false, false], 'contenu gardé ; auteur et instant du déplacement');
  assert.deepEqual(x.regatta.hist.map((h) => [h.kind, h.id, h.t, h.by, h.v.time, h.v.note, 'n' in h.v, 'u' in h.v]), [['race', ancien.id, ancien.u, 'Teiva', '10:55', 'vent faible', false, false]]);
  const s = stamp(r, x.regatta, { now: 5000, by: 'Thibaud' });
  assert.deepEqual(s.tomb, { [`race:${ancien.id}`]: { t: 5000, by: 'Thibaud' } }, 'pierre tombale de l’ancien identifiant');
  assert.equal(s.races.find((e) => e.id === 'm202611071400').u, 5000);
  // jour changé (même heure) : autre identifiant aussi ; heure retirée : identifiant aléatoire ; sans heure au départ, l’identifiant aléatoire reste
  assert.equal(modifie(r, 1, { date: '2026-11-08' }).regatta.races[1].id, 'm202611081055');
  const sansHeure = modifie(r, 1, { time: '' });
  assert.equal(sansHeure.moved, true); assert.match(sansHeure.regatta.races[1].id, /^m[0-9a-z]{1,6}$/); assert.notEqual(sansHeure.regatta.races[1].id, ancien.id);
  const libre = stamp(null, ajoute(regate(), { date: '2026-11-07', time: '' }).regatta, { now: 1000, by: 'Teiva', rnd: () => 0.5 });
  const y = modifie(libre, 1, { date: '2026-11-08' });
  assert.equal(y.moved, false); assert.equal(y.regatta.races[0].id, libre.races[0].id, 'manche sans heure : son identifiant ne dépend pas du jour');
});

test('modifier vers le jour et l’heure d’une autre manche : refusé avec un message clair, rien n’est écrasé', () => {
  const r = deuxManches();
  const x = modifie(r, 1, { time: '13:25' });
  assert.equal(x.ok, false); assert.equal(x.regatta, r);
  assert.equal(x.errors.time, 'La manche 2 a déjà ce jour et cette heure : changez l’heure, ou modifiez ou supprimez l’autre manche.');
  assert.equal(modifie(r, 1, { time: '13:25', date: '2026-11-08' }).ok, true, 'même heure un autre jour : acceptée');
  assert.equal(modifie(r, 2, { time: '13:25', note: 'sans déplacer' }).ok, true, 'garder sa propre heure n’est pas un conflit');
});

test('modifier une manche : réglages de banane gardés, remplacés (bornés) ou retirés ; raceSettings les rend', () => {
  let r = regate();
  r = R.addRace(r, { date: '2026-11-07', time: '10:55', courseId: 90, ban: { nm: 1.2, off: true, side: 't', gate: false, fin: 'auvent' } }, { now: 1000, by: 'Teiva', courses: [...PARCOURS, { id: 90 }] }).regatta;
  const cs = { now: 2000, by: 'Thibaud', courses: [...PARCOURS, { id: 90 }] };
  const garde = R.updateRace(r, 1, { note: 'x' }, cs).regatta.races[0];
  assert.deepEqual(garde.ban, r.races[0].ban, 'ban absent de la saisie : gardé');
  const autre = R.updateRace(r, 1, { ban: { nm: 99, off: false, side: 'b', gate: true, fin: 'sousvent' } }, cs).regatta.races[0];
  assert.ok(autre.ban.nm <= 3 && autre.ban.side === 'b', 'remplacé et borné par cleanBan');
  const sans = R.updateRace(r, 1, { courseId: 5, ban: null }, cs).regatta.races[0];
  assert.ok(!('ban' in sans), 'plus une banane : réglages retirés');
  assert.deepEqual(R.raceSettings(R.updateRace(r, 1, { laps: 3 }, cs).regatta.races[0]).ban, r.races[0].ban);
});

test('fiche : bouton « ✎ Modifier » par manche ; formulaire prérempli « Modifier la manche n » avec « Enregistrer » et « Annuler » ; « modifiée par »', () => {
  const r = deuxManches(), now = t('2026-11-07T08:30:00Z');
  const { document } = parseHTML(`<html><body>${sheetHTML(r, { now, courses: PARCOURS })}</body></html>`);
  assert.deepEqual([...document.querySelectorAll('button[data-edrace]')].map((b) => [b.getAttribute('data-edrace'), b.textContent, b.getAttribute('aria-label')]), [['1', '✎ Modifier', 'Modifier la manche 1'], ['2', '✎ Modifier', 'Modifier la manche 2']]);
  const d = { edit: 1, id: r.races[0].id, date: '2026-11-07', time: '10:55', courseId: '5', cls: 'G', laps: '2', note: '"><img src=x>' };
  const f = parseHTML(`<html><body>${sheetHTML(r, { now, courses: PARCOURS, raceDraft: d, raceErrors: { time: 'La manche 2 a déjà ce jour et cette heure : changez l’heure, ou modifiez ou supprimez l’autre manche.' } })}</body></html>`).document;
  assert.equal(f.querySelector('#rcForm h4').textContent, 'Modifier la manche 1');
  assert.ok(f.querySelector('#rcSave') && !f.querySelector('#rcAdd') && f.querySelector('#rcCancel'));
  assert.equal(f.querySelector('#rcSave').textContent, 'Enregistrer');
  assert.deepEqual([f.querySelector('#rcTime').getAttribute('value'), f.querySelector('#rcCourse option[selected]').getAttribute('value'), f.querySelector('#rcNote').getAttribute('value')], ['10:55', '5', '"><img src=x>']);
  assert.equal(f.querySelectorAll('img').length, 0, 'note échappée');
  assert.match(f.querySelector('[data-err=time]').textContent, /La manche 2 a déjà ce jour et cette heure/);
  assert.ok(f.querySelector('.rgrace.edit[data-n="1"]') && !f.querySelector('.rgrace[data-n="1"] [data-edrace]'), 'la manche en cours de modification est marquée, sans ses boutons');
  assert.ok(!f.querySelector('#rcNew'), 'pas d’ajout pendant une modification');
  const mod = { ...r, races: [{ ...r.races[0], u: t('2026-11-08T09:00:00Z'), ub: '<b>Romain</b>' }, r.races[1]] };
  const g = parseHTML(`<html><body>${sheetHTML(mod, { now, courses: PARCOURS })}</body></html>`).document;
  assert.match(g.querySelector('.rgrace[data-n="1"]').textContent, /modifiée par <b>Romain<\/b> le 08\/11/);
  assert.equal(g.querySelectorAll('.rgrace b').length, 2, 'nom échappé (seuls les titres « Manche n » sont en gras)');
  assert.doesNotMatch(g.querySelector('.rgrace[data-n="2"]').textContent, /modifiée/, 'jamais modifiée : rien');
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
  assert.match(app, /migrate\(\{ storage: localStore\(\), now: Date\.now\(\), by: who\(\)(, graines: ESPACE\.graines)? \}\)|migrate\(\{[^}]*by: membre\(/, 'la reprise des fiches porte l’auteur déjà connu de l’appareil');
});

test('garde : aucune chaîne hexadécimale de 64 caractères (empreinte) dans les tests ni dans l’outil de bout en bout', () => {
  for (const f of ['tests/regates.test.mjs', 'tools/regate-e2e.mjs']) assert.ok(!/(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/i.test(readFileSync(ROOT + f, 'utf8')), `empreinte dans ${f}`);
});

// ───────────────────────── gardes statiques du câblage (le comportement réel est exécuté par tools/regate-e2e.mjs)

const app = readFileSync(ROOT + 'js/app.js', 'utf8');

test('garde : le verrou lit les dates de la régate d’aujourd’hui de la liste (raceLock et renderLive appellent lockDates avec la seule liste), jamais la régate ouverte', () => {
  for (const f of ['raceLock', 'renderLive']) {
    const corps = bodyOf(app, f);
    assert.match(corps, /lockDates\(\{ now(: Date\.now\(\))?, list: REG\.list \}\)/, `${f} doit appeler lockDates avec la seule liste`);
    assert.ok(!/\bcurrentId\b|\bOPEN\b|openReg\(/.test(corps), `${f} : le verrou ne dépend pas de la régate ouverte`);
  }
  assert.ok(!/raceFrom:\s*IC\?\./.test(app), 'plus de raceFrom lu dans IC');
  assert.match(bodyOf(app, 'freezeTick'), /todayRegatta\(\{ now, list: REG\.list, currentId: OPEN \}\)/, 'le gel suit la régate du jour de la liste ; l’ouverte ne départage que deux régates du même jour');
});

test('garde : la régate ouverte est un état de la page (OPEN), posé au chargement par la règle d’ouverture et changé par setOpen seulement, sans écriture ni échange', () => {
  // règle d’ouverture du lancement ; depuis 07-05, avec le plan d’eau chargé (`here`) et la régate demandée par « Passer » (`reopen`)
  assert.match(app, /^let OPEN = openAtBoot\(\{ now: Date\.now\(\), list: REG\.list, here: \(r\) => venueOf\(r\) === VENUE\.id, reopen: REOPEN \}\);$/m);
  const lignes = app.split('\n');
  const iMigrate = lignes.findIndex((l) => /^let REG = migrate\(/.test(l)), iSeed = lignes.findIndex((l) => /seedNorm\(REG(, \{ graines: ESPACE\.graines \})?\)/.test(l)), iOpen = lignes.findIndex((l) => /^let OPEN = /.test(l)), iIC = lignes.findIndex((l) => /^let IC = /.test(l));
  assert.ok(iMigrate >= 0 && iSeed > iMigrate && iOpen > iSeed && iIC > iOpen, 'ordre : migrate, seedNorm, OPEN, puis IC');
  // OPEN n’est affecté que par sa déclaration et dans le corps de setOpen
  const hors = app.replace(bodyOf(app, 'setOpen'), '').replace(/^let OPEN = .*$/m, '');
  assert.ok(!/(?<![.\w])OPEN\s*=(?!=)/.test(hors.replace(/\/\/[^\n]*/g, '')), 'OPEN affecté hors de setOpen');
  const set = bodyOf(app, 'setOpen');
  for (const interdit of ['saveReg(', 'scheduleSync(', 'markDirty(', 'saveSync(', 'syncNow(', 'saveRegattas(']) assert.ok(!set.includes(interdit), `setOpen appelle ${interdit}`);
  const sync = bodyOf(app, 'syncDeps');
  assert.ok(!/\bOPEN\b|setOpen/.test(sync), 'syncDeps ne touche jamais la régate ouverte');
  assert.match(sync, /canon\(\[st\.list, st\.tomb\]\) === canon\(\[REG\.list, REG\.tomb\]\)/, 'seuls list et tomb sont comparés');
  for (const f of ['rangeTrace', 'attachTo', 'createFor', 'syncRef', 'freezeWrite', 'reprise']) { const c = bodyOf(app, f); if (c) assert.ok(!/setOpen\(|\bOPEN\b/.test(c), `${f} ne touche pas la régate ouverte`); }
  assert.ok(!/\bcurrentRegatta\b|\bsetCurrentRegatta\b/.test(app), 'plus de lecture d’une régate courante dans l’index');
  assert.ok(!/REG\.current|st\.current/.test(app));
  const barre = bodyOf(app, 'paintRegBar');
  assert.ok(!/innerHTML/.test(barre), 'le bandeau est construit en textContent seulement (un nom peut venir d’un autre téléphone)');
  const init = bodyOf(app, 'init');
  assert.ok(init.indexOf('paintRegBar()') > 0 && init.indexOf('paintRegBar()') < init.indexOf("performance.mark('rt:ui')"), 'bandeau peint avant la marque rt:ui');
  for (const f of ['attach', 'reprise']) assert.ok(!/\bOPEN\b|setOpen|openRegatta/.test(readFileSync(ROOT + `js/${f}.js`, 'utf8')), `js/${f}.js ne cite aucun état d’ouverture`);
});

test('garde : le passage de jour (dayOpenTick) n’ouvre qu’hors course et hors saisie, sur une ligne séparée de raceTick', () => {
  const tic = bodyOf(app, 'raceTick');
  assert.match(tic, /\n\s*dayOpenTick\(now, active\);/, 'appel sur une ligne séparée');
  const jour = bodyOf(app, 'dayOpenTick');
  assert.ok(jour.indexOf('active') >= 0 && jour.indexOf('icBusy()') >= 0);
  assert.ok(jour.indexOf('setOpen(') > jour.indexOf('icBusy()') && jour.indexOf('setOpen(') > jour.indexOf('active'), 'setOpen seulement après les gardes');
  assert.match(jour, /if \(active \|\| icBusy\(\)\) return;/);
});

test('garde : js/app.js n’importe plus les fonctions de fiches de ./events.js ; l’index est lu au chargement du module (hors init)', () => {
  const imp = /^import\s[^\n]*from '\.\/events\.js';/m.exec(app)?.[0] || '';
  assert.ok(imp, 'import de ./events.js');
  for (const nom of ['eventsState', 'currentEvent', 'upsertEvent', 'removeEvent', 'setCurrent']) assert.ok(!new RegExp(`\\b${nom}\\b`).test(imp), `${nom} importé de ./events.js`);
  assert.match(app, /migrate\(\{/, 'migrate({ … }) présent');
  assert.ok(!/migrate\(/.test(bodyOf(app, 'init')), 'la lecture de l’index se fait au chargement du module, pas dans init()');
  assert.match(app, /^let IC = icOf\(openReg\(\)\);/m);
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
  assert.match(app, /seedNorm\(REG, \{ graines: ESPACE\.graines \}\)/, 'graines de l’espace (08-04)');
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

test('garde : un gel tombé fiche fermée est montré à la prochaine ouverture de l’onglet Régates (icStale), sans redessiner la fiche à chaque changement d’onglet', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /let freezeBusy = false, freezeAgain = false, freezeFailAt = 0, icStale = false;/);
  const ecrit = bodyOf(app, 'freezeWrite');
  assert.match(ecrit, /renderIC\(\);[^\n]*\n\s*else icStale = true;/, 'fiche fermée ou occupée : marquée à redessiner');
  assert.match(app, /if \(b\.dataset\.tab === 'ic' && icStale && !icBusy\(\)\) \{ icStale = false; renderIC\(\); \}/, 'redessinée une seule fois, à l’ouverture de l’onglet');
});

// D-04, D-05, D-06 (entraînement libre) : carte « Plan d’eau » en tête de l’onglet Régates
const NOMS = { toulon: { nom: 'Rade de Toulon' }, brest: { nom: 'Rade de Brest' } };
const carteVenue = (o) => parseHTML(`<html><body>${venueCardHTML({ venues: NOMS, ...o })}</body></html>`).document;
test('venueCardHTML : plan d’eau de ce téléphone, trois états du pack de Brest, boutons #pkDl et #pkGo, sources et avertissement', () => {
  const a = carteVenue({ venueId: 'toulon', status: { state: 'absent', bytes: 3652390 } });
  assert.equal(a.querySelector('#pkCard h3').firstChild.textContent.trim(), 'Plan d’eau');
  assert.match(a.querySelector('#pkHere').textContent, /Ce téléphone : Rade de Toulon/);
  assert.match(a.querySelector('#pkState').textContent, /Rade de Brest : À télécharger \(3,7 Mo\)/);
  assert.equal(a.querySelector('#pkDl').textContent, 'Télécharger le plan d’eau');
  assert.equal(a.querySelector('#pkGo').textContent, 'Passer à la rade de Brest');
  assert.equal(a.querySelector('#pkGo').getAttribute('data-to'), 'brest');
  assert.equal(a.querySelector('#pkGo').hasAttribute('disabled'), false);
  const txt = a.querySelector('#pkCard').textContent;
  for (const m of ['OpenStreetMap (ODbL)', 'EMODnet', 'Ne remplace pas les cartes et ouvrages nautiques officiels']) assert.ok(txt.includes(m), m);
  const r = carteVenue({ venueId: 'toulon', status: { state: 'ready', bytes: 3652390 } });
  assert.match(r.querySelector('#pkState').textContent, /Rade de Brest : Prêt hors réseau$/);
  assert.equal(r.querySelector('#pkDl'), null, 'pack prêt : pas de bouton de téléchargement');
  const s = carteVenue({ venueId: 'brest', status: { state: 'stale', bytes: 3652390 } });
  assert.match(s.querySelector('#pkState').textContent, /Mise à jour à télécharger \(3,7 Mo\)/);
  assert.match(s.querySelector('#pkHere').textContent, /Ce téléphone : Rade de Brest/);
  assert.equal(s.querySelector('#pkGo').textContent, 'Revenir à la rade de Toulon');
  assert.equal(s.querySelector('#pkGo').getAttribute('data-to'), 'toulon');
  assert.ok(s.querySelector('#pkDl'));
  const n = carteVenue({ venueId: 'toulon', status: null });
  assert.match(n.querySelector('#pkState').textContent, /état en cours de lecture/);
});

test('venueCardHTML : course en cours → #pkGo désactivé « Pas pendant une course » ; téléchargement en cours → progression ; erreur et noms échappés', () => {
  const l = carteVenue({ venueId: 'toulon', status: { state: 'ready', bytes: 1 }, locked: true });
  assert.ok(l.querySelector('#pkGo').hasAttribute('disabled'));
  assert.match(l.querySelector('#pkLock').textContent, /^Pas pendant une course/);
  const b = carteVenue({ venueId: 'toulon', status: { state: 'absent', bytes: 1000 }, busy: { done: 450, total: 1000 } });
  assert.equal(b.querySelector('#pkDl').textContent, 'Téléchargement… 45 %');
  assert.ok(b.querySelector('#pkDl').hasAttribute('disabled') && b.querySelector('#pkGo').hasAttribute('disabled'));
  const piege = '<img src=x onerror="window.__xss=1">';
  const html = venueCardHTML({ venueId: 'toulon', venues: { toulon: { nom: piege }, brest: { nom: 'Rade de Brest' } }, status: { state: 'absent', bytes: 1 }, error: `fichier altéré ou incomplet : ${piege}` });
  const d = parseHTML(`<html><body>${html}</body></html>`).document;
  assert.equal(d.querySelector('img'), null, 'aucune balise injectée');
  assert.match(d.querySelector('#pkErr').textContent, /Téléchargement impossible : fichier altéré ou incomplet/);
  assert.ok(!html.includes('<img'));
  const inconnu = carteVenue({ venueId: 'toulon', status: { state: '<b>x</b>', bytes: 1 } });
  assert.match(inconnu.querySelector('#pkState').textContent, /état en cours de lecture/, 'état inconnu jamais affiché tel quel');
});

// ───────────────────────── fiche « GPEN 2027 — J80 » semée (07-09, D-08)
test('seedGpen : fiche gpen-2027 ajoutée une seule fois, instant fixe, sans auteur, plan d’eau Brest ; marqueur posé après le semis', async () => {
  const R = await import('../js/regates.js');
  assert.equal(R.GPEN_ID, 'gpen-2027');
  assert.equal(R.GPEN_AT, Date.UTC(2026, 10, 19, 0, 0, 0));
  const s = mem(), st = migrate({ storage: s, now: t('2026-12-01T08:00:00Z'), by: 'Teiva' });
  const n = R.seedGpen(st, { storage: s });
  assert.notEqual(n, st);
  const g = n.list.find((r) => r.id === 'gpen-2027');
  assert.ok(g);
  assert.equal(g.name, 'GPEN 2027 — J80'); assert.equal(g.club, 'AGPEN — École navale');
  assert.equal(g.dateStart, '2027-05-05'); assert.equal(g.dateEnd, '2027-05-09'); assert.equal(g.season, '2027');
  assert.equal(g.venue, 'brest');
  assert.equal(g.at, R.GPEN_AT); assert.equal(g.by, null); assert.equal(g.u, R.GPEN_AT); assert.equal(g.ub, null); assert.equal(g.vu, R.GPEN_AT);
  assert.equal(g.ic.read, 'semee'); assert.deepEqual(g.ic.validated, { by: null, at: R.GPEN_AT });
  assert.equal(s.getItem('rade.seed.gpen.v1'), '1', 'marqueur posé');
  assert.equal(n.list.filter((r) => r.id === 'snpm-2026').length, 1, 'Coupe SNPM toujours là');
  assert.equal(R.seedGpen(n, { storage: mem() }), n, 'déjà présente : même objet');
});

test('seedGpen : deux téléphones qui la sèment séparément ont la même fiche (canon) ; la fusion de l’archive n’en garde qu’une', async () => {
  const R = await import('../js/regates.js'), M = await import('../js/archmerge.js'), Y = await import('../js/archsync.js');
  const a = R.seedGpen(migrate({ storage: mem(), now: t('2026-12-01T08:00:00Z'), by: 'Teiva' }), { storage: mem() });
  const b = R.seedGpen(migrate({ storage: mem(), now: t('2026-12-03T18:00:00Z'), by: 'Thibaud' }), { storage: mem() });
  const ga = a.list.find((r) => r.id === 'gpen-2027'), gb = b.list.find((r) => r.id === 'gpen-2027');
  assert.equal(M.canon(M.toShared(ga)), M.canon(M.toShared(gb)));
  // première synchronisation d’un téléphone (marquage des anciens éléments) : la graine garde son instant et son absence d’auteur
  assert.equal(M.legacyStamp(a).list.find((r) => r.id === 'gpen-2027').ub, null);
  const m = M.mergeDoc(Y.buildDoc(a, { marks: {} }), Y.buildDoc(b, { marks: {} }));
  assert.equal(Object.keys(m.regattas).filter((k) => k === 'gpen-2027').length, 1);
  assert.equal(M.canon(m.regattas['gpen-2027']), M.canon(M.toShared(ga)));
});

test('seedGpen : pierre tombale dans l’index ou marqueur posé → rien n’est semé (une fiche supprimée ne revient pas)', async () => {
  const R = await import('../js/regates.js');
  const base = migrate({ storage: mem(), now: t('2026-12-01T08:00:00Z'), by: 'Teiva' });
  const tombe = { ...base, tomb: { 'gpen-2027': { t: t('2026-12-02T08:00:00Z'), by: 'Teiva' } } };
  assert.equal(R.seedGpen(tombe, { storage: mem() }), tombe);
  const s = mem({ 'rade.seed.gpen.v1': '1' });
  assert.equal(R.seedGpen(base, { storage: s }), base);
  // supprimée puis relancée : stampState pose la pierre tombale, seedGpen n’y touche plus
  const seme = R.seedGpen(base, { storage: mem() });
  const M = await import('../js/archmerge.js');
  const sans = M.stampState(seme, removeRegatta(seme, 'gpen-2027'), { now: t('2026-12-02T08:00:00Z'), by: 'Teiva' }).st;
  assert.ok(sans.tomb['gpen-2027']);
  assert.equal(R.seedGpen(sans, { storage: mem() }), sans);
  // stockage illisible : la fiche est semée quand même (l’index la garde), sans exception
  const casse = { getItem() { throw new Error('refus'); }, setItem() { throw new Error('refus'); } };
  assert.ok(R.seedGpen(base, { storage: casse }).list.some((r) => r.id === 'gpen-2027'));
});

test('fiche GPEN : règles des IC 2026 (VHF 14, zone A, un tour, semi-direct, DNS 4 min, orange 2 min, temps limites, classement, bout-dehors, gilet, réclamations, zones interdites, Virginie Hériot), mention IC 2027', async () => {
  const R = await import('../js/regates.js');
  const g = R.seedGpen(migrate({ storage: mem(), now: t('2026-12-01T08:00:00Z') }), { storage: mem() }).list.find((r) => r.id === 'gpen-2027');
  const f = g.ic.fields, ic = icOf(g);
  assert.equal(f.vhf, 14); assert.equal(ic.vhf, 14);
  assert.equal(f.zone, 'Zone A — École Navale : cercle de 1,2 NM centré 48°17,890 N 004°21,630 W');
  assert.deepEqual(f.classes, [['J80', 'Sigle J80']]); assert.deepEqual(ic.classes, [['J80', 'Sigle J80']], 'pas les pavillons du CVAT');
  assert.ok(!ic.groups.some((x) => /G1 : C et D1/.test(x)), 'pas les groupes du CVAT');
  const regles = f.keyRules.join('\n');
  for (const re of [/D’après les IC 2026 : à mettre à jour avec les IC 2027 \(fin avril 2027\)/, /pénalité d’un tour/i, /RCV 44\.1 modifiée/, /semi-direct/, /pavillon rouge/, /« Protest »/,
    /DNS[^\n]*4 min/, /orange[^\n]*2 min avant le signal d’avertissement/, /90 min[^\n]*20 min/, /3 courses pour valider/, /retirée dès 4 courses/, /Bout-dehors[^\n]*spi/, /gilet/i,
    /60 min après/, /Île Longue[^\n]*0 à 10/, /Pen ar Vir/, /Virginie Hériot[^\n]*chapelle/]) assert.match(regles, re);
  assert.ok(!/'/.test(regles), 'apostrophe typographique ’');
  assert.ok(!/CVAT|Toulon/.test(JSON.stringify(f)), 'aucune règle du CVAT');
});

test('fiche GPEN : « En préparation » le 5 décembre 2026, puce « Rade de Brest », mention « Fiche semée par l’app (IC 2026) — à vérifier avec les IC 2027 »', async () => {
  const R = await import('../js/regates.js');
  const g = R.seedGpen(migrate({ storage: mem(), now: t('2026-12-01T08:00:00Z') }), { storage: mem() }).list.find((r) => r.id === 'gpen-2027');
  assert.equal(regattaStatus(g, t('2026-12-05T09:00:00Z')), 'avenir');
  assert.equal(STATUS_LABEL[regattaStatus(g, t('2026-12-05T09:00:00Z'))], 'En préparation');
  const { document } = parseHTML(`<div>${sheetHTML(g, { now: t('2026-12-05T09:00:00Z') })}</div>`);
  const txt = document.querySelector('#rgSheet').textContent.replace(/\s+/g, ' ');
  assert.match(txt, /GPEN 2027 — J80/); assert.match(txt, /Rade de Brest/);
  assert.match(txt, /Fiche semée par l’app \(IC 2026\) — à vérifier avec les IC 2027/);
  const liste = parseHTML(`<div>${listHTML(groupByStatus([g], t('2026-12-05T09:00:00Z')), { now: t('2026-12-05T09:00:00Z') })}</div>`).document;
  assert.match(liste.querySelector('div').textContent, /Rade de Brest/);
  assert.equal(document.querySelectorAll('script, img, iframe').length, 0);
});

test('câblage : seedGpen appelé juste après seedNorm, l’index réécrit seulement si l’objet change', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /\{ const seeded = seedNorm\(REG, \{ graines: ESPACE\.graines \}\); if \(seeded !== REG\) \{ REG = seeded; saveRegattas\(localStore\(\), REG\); \} \}\n\/\/ [^\n]*\n\{ const g = seedGpen\(REG, \{ storage: localStore\(\), graines: ESPACE\.graines \}\); if \(g !== REG\) \{ REG = g; saveRegattas\(localStore\(\), REG\); \} \}/);
  // graines et valeurs communes de l’espace, posées avant le premier migrate (08-04)
  assert.match(app, /setCommuns\(ESPACE\.id === 'naos'\);\nlet REG = migrate\(\{ storage: localStore\(\), now: Date\.now\(\), by: who\(\), graines: ESPACE\.graines \}\);/);
});

// ───────────────────────── graines et plans d’eau par espace (08-04, D-05)

const REF_V43 = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/graines-v43.json'), 'utf8'));

test('T11 : graines par espace — Naos sème exactement comme la v43 (index, clés, IC, fusion : tests/fixtures/graines-v43.json, capturé sur 5e9b8a5) ; Tofinou ne sème rien et ne pose aucun marqueur', async () => {
  assert.equal(REF_V43.from, '5e9b8a5');
  const defaut = await releve(ROOT);                                                  // appels de la v43, sans graines (défaut : Naos)
  assert.deepEqual(defaut.cas, REF_V43.cas, 'semis de Naos par défaut');
  assert.deepEqual(defaut.ic, REF_V43.ic, 'icOf des fiches de Naos (Toulon et Brest)');
  assert.deepEqual(defaut.fusion, REF_V43.fusion, 'fusion d’un document de Naos');
  const naos = await releve(ROOT, { graines: ESPACES.naos.graines });
  assert.deepEqual(naos.cas, REF_V43.cas, 'semis de Naos avec ses graines');
  const R = await import('../js/regates.js');
  const g = { graines: ESPACES.tofinou.graines };
  for (const [nom, init] of Object.entries(CAS())) {
    const st = memoire(init);
    const REG = demarre(R, st, g);
    assert.ok(!REG.list.some((r) => ['snpm-2026', 'gpen-2027'].includes(r.id)) || nom === 'graine', `${nom} : aucune graine de Naos semée`);
    assert.ok(!st.ecrits.includes(GPEN_SEED_KEY), `${nom} : aucun marqueur ${GPEN_SEED_KEY} écrit`);
    assert.ok(st.ecrits.every((k) => k === KEY), `${nom} : seul l’index est écrit (${st.ecrits.join(', ')})`);
  }
  const neuf = memoire(), vide = demarre(R, neuf, g);
  assert.deepEqual(vide.list, [], 'appareil neuf de Tofinou : index vide');
  assert.deepEqual(Object.keys(neuf.dump()), [KEY]);
  assert.deepEqual(demarre(R, memoire(CAS().events), g).list, [], 'ancienne fiche rade.events.v1 (Naos) : jamais reprise dans l’espace Tofinou');
  // seedNorm et seedGpen sans leurs graines : même objet, rien d’écrit
  const st0 = { v: 1, list: [{ id: 'snpm-2026', ic: { read: 'reprise', validated: { by: 'X', at: 1 } }, at: 1 }] };
  assert.equal(R.seedNorm(st0, g), st0, 'seedNorm sans la Coupe SNPM dans les graines : sans effet');
  assert.notEqual(R.seedNorm(st0), st0, 'Naos : la graine est ramenée à la fiche commune, comme en v43');
  const m = memoire(), s1 = { v: 1, list: [] };
  assert.equal(seedGpen(s1, { storage: m, ...g }), s1); assert.deepEqual(m.ecrits, []);
});

test('IC d’une fiche de l’espace Tofinou : ni signaux, ni pavillons de classe, ni groupes du CVAT ; Naos inchangé après le retour du réglage', () => {
  const r = createRegatta({ name: 'Challenge', dateStart: '2026-12-05', club: 'CNBL', venue: 'bormes' }, { now: t('2026-12-01T10:00:00Z'), by: 'Frédéric' }).regatta;
  assert.equal(r.venue, 'bormes');
  try {
    setCommuns(false);
    const ic = icOf(r);
    assert.deepEqual([ic.sequence, ic.classes, ic.groups], [[], [], []]);
    const lue = icOf({ ...r, ic: { fields: { classes: [['T', 'Tofinou']] }, text: '' } });
    assert.deepEqual(lue.classes, [['T', 'Tofinou']], 'les valeurs lues dans ses IC restent');
  } finally { setCommuns(true); }
  assert.deepEqual(icOf(r).sequence, SNPM.sequence, 'Naos : valeurs communes CVAT, comme en v43');
});

test('formulaire de régate : plans d’eau de l’espace seulement (Naos : Toulon et Brest, comme en v43 ; Tofinou : Bormes, par défaut)', () => {
  const opts = (html) => [...parseHTML(`<html><body>${html}</body></html>`).document.querySelectorAll('#rgVenue option')].map((o) => [o.value, o.hasAttribute('selected')]);
  assert.deepEqual(opts(newRegattaFormHTML({ venue: 'bormes' })), [['toulon', true], ['brest', false]], 'Naos : Bormes jamais proposé');
  const T = { ids: ESPACES.tofinou.venues, defaut: ESPACES.tofinou.venueDefaut };
  for (const v of [undefined, 'toulon', 'brest', 'bormes', '__proto__']) assert.deepEqual(opts(newRegattaFormHTML({ venue: v }, {}, T)), [['bormes', true]], String(v));
  assert.match(newRegattaFormHTML({}, {}, T), /<option value="bormes" selected>Rade de Bormes – Le Lavandou<\/option>/);
});

test('carte « Plan d’eau » : Naos identique avec ou sans la liste de l’espace ; Tofinou sans « Revenir à la rade de Toulon » ni autre plan d’eau, sources de Bormes', () => {
  const base = { venues: VENUES, status: { state: 'ready', bytes: 3604097 } };
  for (const o of [{ venueId: 'toulon' }, { venueId: 'brest' }, { venueId: 'toulon', locked: true }, { venueId: 'brest', status: { state: 'stale', bytes: 1 } }]) {
    assert.equal(venueCardHTML({ ...base, ...o, packId: 'brest', ids: ['toulon', 'brest'] }), venueCardHTML({ ...base, ...o }), JSON.stringify(o));
  }
  const tof = (o = {}) => parseHTML(`<html><body>${venueCardHTML({ ...base, venueId: 'bormes', packId: 'bormes', ids: ['bormes'], ...o })}</body></html>`).document;
  const d = tof();
  assert.equal(d.querySelector('#pkGo') === null, true, 'aucun autre plan d’eau : pas de bouton de bascule');
  assert.match(d.querySelector('#pkHere').textContent, /Ce téléphone : Rade de Bormes – Le Lavandou/);
  assert.equal(d.querySelector('#pkState').textContent, 'Rade de Bormes – Le Lavandou : Prêt hors réseau');
  const txt = d.querySelector('#pkCard').textContent;
  assert.ok(!/Toulon|Brest/.test(txt), txt);
  assert.match(txt, /Rade de Bormes – Le Lavandou : © contributeurs OpenStreetMap \(ODbL\), EMODnet Bathymetry, AWS Terrain Tiles \(Terrarium\)\. Ne remplace pas les cartes et ouvrages nautiques officiels\./);
  assert.equal(tof({ status: { state: 'absent', bytes: 3604097 } }).querySelector('#pkDl') !== null, true, 'pack absent : « Télécharger le plan d’eau »');
});

// ───────────────────────── jours de course et Challenge de la Baie 2026-2027 (08-08, D-13)

const REF_JOURS = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/jours-v43.json'), 'utf8'));
const JOURS_BAIE = ['2026-10-11', '2026-11-08', '2026-12-13', '2027-01-17', '2027-02-14', '2027-03-14', '2027-04-10', '2027-04-11'];
const saison = (over = {}) => regate({ id: 'saison', dateStart: '2026-10-11', dateEnd: '2027-04-11', jours: [...JOURS_BAIE], ...over });
// midi de Paris le jour d (heure d’hiver ou d’été sans effet sur le jour)
const midi = (d) => Date.parse(`${d}T10:00:00Z`);

test('jours : sans jours, statut, régate du jour, verrou, ouverture, jours, sceau et rattachement d’une trace identiques à la v43 (tests/fixtures/jours-v43.json, capturé sur 5e9b8a5)', async () => {
  assert.equal(REF_JOURS.from, '5e9b8a5');
  const { releve: releveJours } = await import('./helpers/jours.mjs');
  const r = await releveJours(ROOT);
  for (const k of ['statut', 'jour', 'ouverture', 'jours', 'sceau', 'trace']) assert.deepEqual(r[k], REF_JOURS[k], k);
});

test('jours : « En cours » les jours de course seulement, « En préparation » entre deux, « Terminée » après le dernier ; minuit de Paris', () => {
  const r = saison();
  assert.equal(regattaStatus(r, midi('2026-12-13')), 'aujourdhui');
  assert.equal(regattaStatus(r, midi('2026-12-14')), 'avenir');
  assert.equal(regattaStatus(r, midi('2026-10-10')), 'avenir', 'le samedi 10 octobre n’est pas un jour de course');
  assert.equal(regattaStatus(r, midi('2026-10-11')), 'aujourdhui');
  assert.equal(regattaStatus(r, midi('2027-04-10')), 'aujourdhui');
  assert.equal(regattaStatus(r, midi('2027-04-11')), 'aujourdhui');
  assert.equal(regattaStatus(r, midi('2027-04-12')), 'passee');
  assert.equal(regattaStatus(r, t('2026-12-12T22:59:00Z')), 'avenir', '23 h 59 le 12/12 à Paris');
  assert.equal(regattaStatus(r, t('2026-12-12T23:00:00Z')), 'aujourdhui', 'minuit le 13/12 à Paris');
  assert.equal(regattaStatus(r, t('2026-12-13T23:00:00Z')), 'avenir', 'minuit le 14/12 à Paris');
  // liste mal formée : dates impossibles, doublons, désordre → jours valides triés ; vide → règles de la v43
  const R = { joursOf: null };
  return import('../js/regates.js').then((M) => {
    R.joursOf = M.joursOf;
    assert.deepEqual(R.joursOf({ jours: ['2027-01-17', '2026-02-30', '2026-12-13', '2026-12-13', 7, null] }), ['2026-12-13', '2027-01-17']);
    assert.equal(R.joursOf({ jours: [] }), null); assert.equal(R.joursOf({ jours: 'x' }), null); assert.equal(R.joursOf({}), null);
    assert.equal(regattaStatus(saison({ jours: [] }), midi('2026-12-14')), 'aujourdhui', 'jours vides : toute la période, comme en v43');
    assert.deepEqual(M.daysOf(r), JOURS_BAIE, 'manches possibles : les jours de course');
  });
});

test('jours : verrou « journée de régate » et ouverture au démarrage le jour d’une manche seulement', () => {
  const list = [saison()];
  assert.deepEqual(lockDates({ now: midi('2027-01-17'), list }), { raceFrom: '2027-01-17', raceTo: '2027-01-17' });
  assert.deepEqual(lockDates({ now: midi('2027-01-18'), list }), { raceFrom: null, raceTo: null });
  assert.deepEqual(lockDates({ now: midi('2027-04-10'), list }), { raceFrom: '2027-04-10', raceTo: '2027-04-10' });
  assert.equal(isRaceDay({ now: midi('2027-01-17'), ...lockDates({ now: midi('2027-01-17'), list }) }), true);
  assert.equal(isRaceDay({ now: midi('2026-12-20'), ...lockDates({ now: midi('2026-12-20'), list }) }), false, 'pas de verrou un dimanche sans manche');
  assert.equal(openAtBoot({ now: midi('2026-12-13'), list }), 'saison');
  assert.equal(openAtBoot({ now: midi('2026-12-14'), list }), null, 'entraînement libre le lendemain');
  assert.equal(todayRegatta({ now: midi('2026-11-01'), list }), null);
  assert.deepEqual(openOnNewDay({ now: midi('2026-12-13'), list, openId: null, day: '2026-12-12' }), { day: '2026-12-13', openId: 'saison' });
  assert.deepEqual(openOnNewDay({ now: midi('2026-12-14'), list, openId: 'saison', day: '2026-12-13' }), { day: '2026-12-14', openId: 'saison' }, 'l’écran n’est pas retiré');
});

test('jours : sceau du vent du jour au premier signal des IC CHAQUE jour de course, sinon à la fin du jour ; trace rangée dans la régate de son jour seulement', async () => {
  const { sealAt, parisInstant } = await import('../js/gel.js');
  const { matchRegattas } = await import('../js/attach.js');
  const r = saison({ ic: { fields: { firstWarning: '11:00' } } });
  assert.deepEqual(sealAt(r, '2027-01-17'), { at: parisInstant('2027-01-17', 11, 0), signal: 'ic' });
  assert.equal(sealAt(r, '2027-01-18'), null, 'hors des jours de course');
  assert.deepEqual(sealAt(saison(), '2027-01-17'), { at: parisInstant('2027-01-18', 0, 0), signal: 'inconnu' }, 'sans heure : fin de CE jour, pas de la saison');
  const pts = (d) => Array.from({ length: 61 }, (_, i) => [Date.parse(`${d}T10:00:00Z`) + i * 60e3, 43.12, 6.39, 5, 90, 5]);
  assert.equal(matchRegattas(pts('2027-01-17'), [r]).how, 'unique');
  assert.equal(matchRegattas(pts('2027-01-18'), [r]).how, 'proche', 'lendemain d’une manche : proposition');
  assert.equal(matchRegattas(pts('2026-12-01'), [r]).how, 'aucune', 'un jour de la saison sans manche : aucune régate');
});

test('seedBaie : fiche baie-2026-2027 semée une seule fois dans l’espace Tofinou (marqueur rade.seed.baie.v1), jamais ressemée après suppression ; sans effet chez Naos', async () => {
  const R = await import('../js/regates.js'), M = await import('../js/archmerge.js');
  assert.equal(R.BAIE_ID, 'baie-2026-2027'); assert.equal(R.BAIE_SEED_KEY, 'rade.seed.baie.v1');
  const g = { graines: ESPACES.tofinou.graines };
  const s = mem(), st = migrate({ storage: s, now: t('2026-11-27T08:00:00Z'), by: 'Frédéric', ...g });
  assert.deepEqual(st.list, []);
  const n = R.seedBaie(st, { storage: s, ...g });
  assert.deepEqual(n.list.map((r) => r.id), ['baie-2026-2027']);
  assert.equal(s.getItem('rade.seed.baie.v1'), '1', 'marqueur posé');
  assert.equal(R.seedBaie(n, { storage: mem(), ...g }), n, 'déjà là : même objet');
  // supprimée : pierre tombale, marqueur ; rien n’est ressemé
  const sans = M.stampState(n, removeRegatta(n, 'baie-2026-2027'), { now: t('2026-11-28T08:00:00Z'), by: 'Frédéric' }).st;
  assert.ok(sans.tomb['baie-2026-2027']);
  assert.equal(R.seedBaie(sans, { storage: mem(), ...g }), sans);
  const vide = { v: 1, list: [] };
  assert.equal(R.seedBaie(vide, { storage: mem({ 'rade.seed.baie.v1': '1' }), ...g }), vide, 'marqueur posé : rien');
  // Naos (graines de Naos, ou défaut) : ni fiche ni marqueur
  for (const opts of [{}, { graines: ESPACES.naos.graines }]) {
    const m = memoire(), s0 = { v: 1, list: [] };
    assert.equal(R.seedBaie(s0, { storage: m, ...opts }), s0); assert.deepEqual(m.ecrits, []);
  }
  // stockage illisible : semée quand même, sans exception
  const casse = { getItem() { throw new Error('refus'); }, setItem() { throw new Error('refus'); } };
  assert.ok(R.seedBaie(vide, { storage: casse, ...g }).list.some((r) => r.id === 'baie-2026-2027'));
  // deux téléphones : même fiche (canon), la fusion n’en garde qu’une, avec ses jours
  const a = R.seedBaie(vide, { storage: mem(), ...g }), b = R.seedBaie({ v: 1, list: [] }, { storage: mem(), ...g });
  assert.equal(M.canon(M.toShared(a.list[0])), M.canon(M.toShared(b.list[0])));
  const Y = await import('../js/archsync.js');
  const doc = M.mergeDoc(Y.buildDoc(M.legacyStamp(a), { marks: {} }), Y.buildDoc(M.legacyStamp(b), { marks: {} }));
  assert.deepEqual(Object.keys(doc.regattas), ['baie-2026-2027']);
  assert.deepEqual(doc.regattas['baie-2026-2027'].jours, JOURS_BAIE);
  assert.equal(M.legacyStamp(a).list[0].ub, null, 'graine sans auteur');
});

test('fiche du Challenge de la Baie : sept manches (huit jours), manche 1 le dimanche 11/10, Bormes, règles de l’avis et des fiches de course, aucun nom de personne', async () => {
  const R = await import('../js/regates.js');
  const f = R.baieSeed();
  assert.notEqual(f, R.baieSeed(), 'objet neuf à chaque appel');
  assert.deepEqual(f.jours, JOURS_BAIE);
  assert.equal(f.dateStart, '2026-10-11'); assert.equal(f.dateEnd, '2027-04-11'); assert.equal(f.season, '2026'); assert.equal(f.venue, 'bormes');
  assert.equal(f.name, 'Challenge de la Baie 2026-2027');
  assert.equal(f.club, 'Yacht Club du Lavandou · École de voile municipale du Lavandou · Club de voile de Bormes');
  assert.equal(f.at, R.BAIE_AT); assert.equal(f.by, null); assert.equal(f.u, R.BAIE_AT); assert.equal(f.ub, null); assert.equal(f.vu, R.BAIE_AT);
  assert.equal(f.ic.read, 'semee'); assert.equal(f.ic.source, 'Avis de course et fiches de course du Challenge de la Baie 2026-2027');
  assert.deepEqual(f.ic.validated, { by: null, at: R.BAIE_AT });
  // dimanches
  for (const d of JOURS_BAIE.filter((x) => x !== '2027-04-10')) assert.equal(new Date(`${d}T12:00:00Z`).getUTCDay(), 0, `${d} est un dimanche`);
  assert.equal(new Date('2027-04-10T12:00:00Z').getUTCDay(), 6, 'finale : samedi 10 et dimanche 11 avril');
  // manches : une par jour, sans heure inventée, identifiant fixe, lieux
  assert.deepEqual(f.races.map((m) => [m.n, m.id, m.date, m.time]), JOURS_BAIE.map((d, i) => [i + 1, `m${d.replace(/-/g, '')}`, d, '']));
  assert.ok(f.races.every((m) => m.courseId === null && m.u === R.BAIE_AT && m.ub === null && m.by === null && m.note.length <= 200));
  assert.match(f.races[0].note, /^Manche 1 — Le Lavandou/); assert.match(f.races[2].note, /^Manche 3 — Bormes/); assert.match(f.races[4].note, /^Manche 5 — Bormes/);
  assert.match(f.races[5].note, /^Manche 6 — Le Lavandou/); assert.match(f.races[6].note, /^Finale \(manche 7\), premier jour/); assert.match(f.races[7].note, /^Finale \(manche 7\), second jour/);
  const ic = icOf(f), regles = ic.keyRules.join('\n');
  assert.equal(ic.vhf, 72); assert.equal(ic.firstWarning, '11:00');
  for (const re of [/VHF 72/, /Règles d’introduction à la régate \(RIR\)/, /pénalité d’un tour/, /Briefing à 10 h, premier signal à 11 h/, /4 minutes[^\n]*DNS/, /Bout-dehors[^\n]*spinnaker/,
    /entre le bateau comité et une bouée cylindrique orange/, /bouée cylindrique rouge siglée Le Lavandou/, /« R »[^\n]*sens inverse/, /Pavillon D[^\n]*pavillon vert : dégagement à laisser à tribord/,
    /groupe 4/, /dimanche 11 octobre/, /devant Le Lavandou[^\n]*devant Bormes – La Favière/]) assert.match(regles, re);
  // aucun « 10 octobre » comme date de manche : seulement cité comme la coquille de l’avis
  const tout = JSON.stringify(f);
  assert.equal((tout.match(/10 octobre/g) || []).length, 1); assert.match(regles, /écrit « dimanche 10 octobre » : coquille/);
  assert.ok(!/'/.test(tout.replace(/"[a-zA-Z]+":/g, '')), 'apostrophe typographique ’');
  assert.ok(!/CVAT|Toulon|J80|Naos|SNPM|GPEN/.test(tout), 'rien de Naos');
  // vue : « En cours » le 13/12, « En préparation » le 14/12, mention de la fiche semée propre au Challenge
  const { document } = parseHTML(`<div>${sheetHTML(f, { now: midi('2026-12-13') })}</div>`);
  const txt = document.querySelector('#rgSheet').textContent.replace(/\s+/g, ' ');
  assert.match(txt, /Challenge de la Baie 2026-2027/); assert.match(txt, /En cours/); assert.match(txt, /8 jours de course, du dim\. 11 oct\. au dim\. 11 avr\. 2027/);
  assert.match(txt, /Fiche semée par l’app \(avis de course et fiches de course 2026-2027\) — à vérifier sur la fiche de course de chaque manche\./);
  assert.ok(!/IC 2027/.test(txt));
  assert.equal(document.querySelectorAll('script, img, iframe').length, 0);
  assert.equal(regattaStatus(f, midi('2026-12-14')), 'avenir');
});

test('câblage : seedBaie appelé juste après seedGpen (même forme), marqueur retiré à l’adoption d’un autre espace avec celui du GPEN', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.match(app, /\{ const g = seedGpen\(REG, \{ storage: localStore\(\), graines: ESPACE\.graines \}\); if \(g !== REG\) \{ REG = g; saveRegattas\(localStore\(\), REG\); \} \}\n\/\/ [^\n]*\n\{ const g = seedBaie\(REG, \{ storage: localStore\(\), graines: ESPACE\.graines \}\); if \(g !== REG\) \{ REG = g; saveRegattas\(localStore\(\), REG\); \} \}/);
  assert.match(app, /for \(const k of \[REG_KEY, GPEN_SEED_KEY, BAIE_SEED_KEY, 'rade\.state'\]\) localStorage\.removeItem\(k\);/);
});
