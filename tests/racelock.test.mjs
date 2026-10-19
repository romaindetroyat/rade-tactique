// FIAB-01 : règles du verrou « en course » et « journée de régate » (D-01, D-02, D-03, D-15), heure de Paris et changement d’heure.
// Les instants sont donnés en UTC ; l’heure de Paris est dans le commentaire (été UTC+2 jusqu’au 25/10/2026 03 h, hiver UTC+1 ensuite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parisClock, isActive, isRaceDay, lockState, TIMER_GRACE_MS, heavyPaused, HEAVY_BEFORE_MS, HEAVY_AFTER_MS } from '../js/racelock.js';
import { eventForm, readForm } from '../js/events.js';

const t = (s) => Date.parse(s);
const verrou = (now, o = {}) => lockState({ now: t(now), active: false, ...o });

test('parisClock : heure d’été, heure d’hiver et changement d’heure du 25/10/2026', () => {
  assert.deepEqual(parisClock(t('2026-10-18T10:00:00Z')), { date: '2026-10-18', hour: 12, minute: 0 });   // CEST
  assert.deepEqual(parisClock(t('2026-11-07T08:00:00Z')), { date: '2026-11-07', hour: 9, minute: 0 });    // CET
  assert.deepEqual(parisClock(t('2026-10-24T22:30:00Z')), { date: '2026-10-25', hour: 0, minute: 30 });   // minuit passé à Paris
  assert.equal(parisClock(t('2026-10-25T00:59:59Z')).hour, 2);   // 02:59:59 CEST
  assert.equal(parisClock(t('2026-10-25T01:00:00Z')).hour, 2);   // 02:00:00 CET : 02 h deux fois
});

test('D-01 : une activité verrouille tous les jours, entraînement compris', () => {
  assert.deepEqual(lockState({ now: t('2026-09-01T12:00:00Z'), active: true }), { locked: true, reason: 'course' });
  assert.deepEqual(lockState({ now: t('2026-11-07T12:00:00Z'), active: true, raceFrom: '2026-11-07' }), { locked: true, reason: 'course' });
});

test('sans régate et sans activité : libre', () => {
  assert.deepEqual(verrou('2026-11-07T12:00:00Z'), { locked: false, reason: null });
  assert.deepEqual(verrou('2026-11-07T12:00:00Z', { raceFrom: null, raceTo: null }), { locked: false, reason: null });
});

test('D-03 : le jour de régate, libre jusqu’à 8 h 59 (Paris), verrouillé à 9 h 00', () => {
  const r = { raceFrom: '2026-11-07' };
  assert.deepEqual(verrou('2026-11-07T07:59:00Z', r), { locked: false, reason: null });      // 08:59 CET
  assert.deepEqual(verrou('2026-11-07T08:00:00Z', r), { locked: true, reason: 'journee' });  // 09:00 CET
  assert.deepEqual(verrou('2026-11-08T12:00:00Z', r), { locked: false, reason: null });      // le lendemain : libre
});

test('D-03 : même règle le 25/10/2026, jour du changement d’heure', () => {
  const r = { raceFrom: '2026-10-25' };
  assert.deepEqual(verrou('2026-10-25T01:00:00Z', r), { locked: false, reason: null });      // 02:00 CET
  assert.deepEqual(verrou('2026-10-25T07:59:00Z', r), { locked: false, reason: null });      // 08:59 CET
  assert.deepEqual(verrou('2026-10-25T08:00:00Z', r), { locked: true, reason: 'journee' });  // 09:00 CET
});

test('D-02 : retour au port = « course finie » ou tout arrêté depuis 1 h', () => {
  const r = { raceFrom: '2026-11-07' };
  const now = '2026-11-07T12:00:00Z';                                                          // 13:00 CET
  assert.equal(verrou(now, { ...r, lastActiveAt: t('2026-11-07T11:30:00Z') }).locked, true, 'arrêté depuis 30 min');
  assert.equal(verrou(now, { ...r, lastActiveAt: t('2026-11-07T10:30:00Z') }).locked, false, 'arrêté depuis 1 h 30');
  assert.equal(verrou(now, { ...r, lastActiveAt: t('2026-11-07T11:00:00Z') }).locked, false, 'arrêté depuis exactement 1 h');
  assert.equal(verrou(now, { ...r, lastActiveAt: t('2026-11-07T11:30:00Z'), finishedAt: t('2026-11-07T11:40:00Z') }).locked, false, '« course finie » après la dernière activité');
  assert.equal(verrou(now, { ...r, lastActiveAt: t('2026-11-07T11:50:00Z'), finishedAt: t('2026-11-07T11:00:00Z') }).locked, true, 'activité reprise après « course finie »');
  assert.equal(verrou(now, { ...r }).locked, true, 'aucune activité ni « course finie » : verrouillé jusqu’au retour au port');
});

test('D-02 : une activité de 8 h (Paris) ne libère pas l’après-midi', () => {
  const r = { raceFrom: '2026-11-07', lastActiveAt: t('2026-11-07T07:00:00Z') };               // 08:00 CET
  assert.deepEqual(verrou('2026-11-07T12:00:00Z', r), { locked: true, reason: 'journee' });
});

test('D-15 : régate du 7 au 9 novembre, chaque jour recommence', () => {
  const r = { raceFrom: '2026-11-07', raceTo: '2026-11-09' };
  assert.deepEqual(verrou('2026-11-08T12:00:00Z', r), { locked: true, reason: 'journee' });
  assert.deepEqual(verrou('2026-11-09T07:30:00Z', r), { locked: false, reason: null });        // 08:30 CET
  assert.deepEqual(verrou('2026-11-09T12:00:00Z', r), { locked: true, reason: 'journee' });
  assert.deepEqual(verrou('2026-11-10T12:00:00Z', r), { locked: false, reason: null });
  assert.equal(verrou('2026-11-08T12:00:00Z', { ...r, finishedAt: t('2026-11-07T16:00:00Z') }).locked, true, '« course finie » du 7 ne libère pas le 8');
  assert.equal(verrou('2026-11-08T12:00:00Z', { ...r, lastActiveAt: t('2026-11-07T14:00:00Z') }).locked, true, 'l’inactivité du 7 ne libère pas le 8');
  assert.equal(verrou('2026-11-08T14:00:00Z', { ...r, finishedAt: t('2026-11-08T13:00:00Z') }).locked, false, '« course finie » du 8 libère le 8');
});

test('isRaceDay : de la date de début à la date de fin, faux sans date de début', () => {
  const r = { raceFrom: '2026-11-07', raceTo: '2026-11-09' };
  for (const j of ['07', '08', '09']) assert.equal(isRaceDay({ now: t(`2026-11-${j}T12:00:00Z`), ...r }), true, j);
  assert.equal(isRaceDay({ now: t('2026-11-10T12:00:00Z'), ...r }), false);
  assert.equal(isRaceDay({ now: t('2026-11-06T12:00:00Z'), ...r }), false);
  assert.equal(isRaceDay({ now: t('2026-11-07T12:00:00Z'), raceFrom: '2026-11-07' }), true, 'sans fin : un seul jour');
  assert.equal(isRaceDay({ now: t('2026-11-08T12:00:00Z'), raceFrom: '2026-11-07' }), false);
  assert.equal(isRaceDay({ now: t('2026-11-07T12:00:00Z'), raceFrom: null, raceTo: '2026-11-09' }), false);
  assert.equal(isRaceDay({ now: t('2026-11-07T12:00:00Z') }), false);
  // la date de Paris compte, pas celle d’UTC : 23:30 UTC le 6 = 00:30 le 7 à Paris
  assert.equal(isRaceDay({ now: t('2026-11-06T23:30:00Z'), ...r }), true);
});

test('isActive : chrono (3 h de grâce après H), mode départ, trace ou GPS', () => {
  const now = t('2026-11-07T12:00:00Z');
  assert.equal(isActive({ now, timerEnd: now - 2 * 3600e3 }), true, 'chrono parti il y a 2 h');
  assert.equal(isActive({ now, timerEnd: now - TIMER_GRACE_MS + 1000 }), true);
  assert.equal(isActive({ now, timerEnd: now - TIMER_GRACE_MS - 1000 }), false, 'chrono parti il y a 3 h et 1 s : rend la main');
  assert.equal(isActive({ now, timerEnd: now + 240e3 }), true, 'chrono avant H');
  assert.equal(isActive({ now, startModeOpen: true }), true);
  assert.equal(isActive({ now, recording: true }), true);
  assert.equal(isActive({ now, gpsOn: true }), true);
  assert.equal(isActive({ now }), false);
  assert.equal(isActive({ now, timerEnd: null, startModeOpen: false, recording: false, gpsOn: false }), false);
});

// D-15 : la fiche de régate porte un dernier jour, lu seulement s’il est postérieur au premier
function lire(ev, saisie = {}) {
  const { document } = parseHTML(`<html><body>${eventForm(ev)}</body></html>`);
  globalThis.document = document;
  try {
    for (const [id, v] of Object.entries(saisie)) {
      const champ = document.getElementById(id);
      assert.ok(champ, `le formulaire doit contenir le champ #${id}`);
      champ.value = v;
    }
    return readForm(ev);
  } finally { delete globalThis.document; }
}

test('D-15 : la fiche garde le dernier jour saisi s’il est postérieur à la date', () => {
  assert.equal(lire({ date: '2026-11-07', dateEnd: '2026-11-09' }).dateEnd, '2026-11-09');
  assert.equal(lire({ date: '2026-11-07' }, { evDateEnd: '2026-11-08' }).dateEnd, '2026-11-08', 'saisie dans le champ');
});

test('D-15 : un dernier jour absent, égal ou antérieur à la date est ignoré', () => {
  assert.equal(lire({ date: '2026-11-07' }).dateEnd, '');
  assert.equal(lire({ date: '2026-11-07', dateEnd: '2026-11-07' }).dateEnd, '', 'même jour');
  assert.equal(lire({ date: '2026-11-07', dateEnd: '2026-11-05' }).dateEnd, '', 'antérieur');
  assert.equal(lire({ date: '', dateEnd: '2026-11-09' }).dateEnd, '', 'sans date de début');
});

// ── FIAB-06 : pas de recalcul automatique pendant la séquence de départ (de H−6 min à H+1 min, H = fin du chrono)
const H = t('2026-11-07T10:00:00Z');       // un signal de départ, heure sans importance : le prédicat est pur
const pause = (now, timerEnd = H) => heavyPaused({ now, timerEnd });

test('heavyPaused : sans chrono, jamais de pause', () => {
  assert.equal(heavyPaused({ now: H, timerEnd: null }), false);
  assert.equal(heavyPaused({ now: H }), false);
  assert.equal(heavyPaused({ now: 0, timerEnd: undefined }), false);
});

test('heavyPaused : bornes de la séquence, H−7 min libre, H−6 min pris, H pris, H+1 min pris, H+1 min 1 s libre', () => {
  assert.equal(pause(H - 7 * 60e3), false);
  assert.equal(pause(H - 6 * 60e3 - 1), false);
  assert.equal(pause(H - 6 * 60e3), true);
  assert.equal(pause(H - 60e3), true);
  assert.equal(pause(H), true);
  assert.equal(pause(H + 60e3), true);
  assert.equal(pause(H + 60e3 + 1000), false);
});

test('heavyPaused : les constantes sont 6 min avant et 1 min après', () => {
  assert.equal(HEAVY_BEFORE_MS, 6 * 60e3);
  assert.equal(HEAVY_AFTER_MS, 60e3);
});

test('heavyPaused : un chrono lancé tard (Top 4’, Top 1’) est déjà dans la séquence', () => {
  const now = t('2026-11-07T09:00:00Z');
  assert.equal(pause(now, now + 4 * 60e3), true);       // Top 4’
  assert.equal(pause(now, now + 60e3), true);           // Top 1’
  assert.equal(pause(now, now + 5 * 60e3), true);       // Top 5’ : H−5 min
  assert.equal(pause(now, now + 7 * 60e3), false);      // à H−7 min, pas encore
});

test('heavyPaused : un chrono décalé de ±1 min déplace la fenêtre', () => {
  const now = H - 6 * 60e3 - 30e3;                       // H−6 min 30 s : libre
  assert.equal(pause(now, H), false);
  assert.equal(pause(now, H - 60e3), true);              // « −1 min » : H est plus proche, la séquence a commencé
  assert.equal(pause(H + 90e3, H), false);               // H+1 min 30 s : libre
  assert.equal(pause(H + 90e3, H + 60e3), true);         // « +1 min » : la pause se prolonge
});

test('heavyPaused : un chrono oublié depuis des heures ne bloque rien', () => {
  assert.equal(pause(H + 3 * 3600e3, H), false);
  assert.equal(pause(H - 3 * 3600e3, H), false);
});

test('heavyPaused : pur, ne lit ni l’horloge ni le chrono de la page (même résultat quel que soit l’instant réel)', () => {
  const a = pause(H - 3 * 60e3), b = pause(H - 3 * 60e3);
  assert.equal(a, b);
  assert.equal(a, true);
});
