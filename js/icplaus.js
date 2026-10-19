// Vraisemblance des valeurs lues dans des IC : une puce par valeur, jamais une correction. Fonctions pures, sans DOM ni stockage.
// Chaque contrôle rend { level: 'ok' | 'warn' | 'bad', msg } avec un message court en français :
//   bad  = impossible (30 février, 25:00, canal 99, position hors de la carte) : la validation est refusée tant que la valeur n’est pas corrigée ou vidée ;
//   warn = inhabituel (départ à 3 h 30, canal 16, date à plus d’un an) : signalé, n’empêche rien ;
//   ok   = plausible, message vide.

import { isDate, isTime } from './regates.js';
import { parisClock } from './racelock.js';
import { toXY } from './geo.js';

// Bornes de la carte (data/meta.json : west 5.8, east 6.1, south 43.0, north 43.18)
export const BOUNDS = Object.freeze({ south: 43.0, north: 43.18, west: 5.8, east: 6.1 });
export const MAX_DAYS_AWAY = 400, MAX_SPAN_DAYS = 6;
const OK = Object.freeze({ level: 'ok', msg: '' });
const bad = (msg) => ({ level: 'bad', msg });
const warn = (msg) => ({ level: 'warn', msg });
const DAY_MS = 864e5;
const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY_MS);

// Premier jour : date calendaire réelle (le 30 février est impossible) ; à plus de 400 jours d’aujourd’hui (jour de Paris) : inhabituel
export function checkDate(s, { now = Date.now() } = {}) {
  if (!isDate(s)) return bad('date impossible (AAAA-MM-JJ)');
  const ecart = Math.abs(days(parisClock(now).date, s));
  return ecart > MAX_DAYS_AWAY ? warn(`date lointaine (à plus de ${MAX_DAYS_AWAY} jours d’aujourd’hui)`) : OK;
}
// Dernier jour : réelle ; postérieure au premier jour (sinon elle est ignorée) ; à plus de 6 jours du premier : inhabituel
export function checkDateEnd(start, end) {
  if (!isDate(end)) return bad('date impossible (AAAA-MM-JJ)');
  if (!isDate(start)) return OK;
  if (end <= start) return warn('ignoré : le dernier jour doit suivre le premier');
  return days(start, end) > MAX_SPAN_DAYS ? warn(`plus de ${MAX_SPAN_DAYS} jours après le premier jour`) : OK;
}
// Heure HH:MM valide ; hors de 06:00-21:00 : inhabituelle pour un départ
export function checkTime(hhmm, { min = '06:00', max = '21:00' } = {}) {
  if (!isTime(hhmm)) return bad('heure impossible (HH:MM)');
  return hhmm < min || hhmm > max ? warn(`heure inhabituelle pour un départ (${min}-${max})`) : OK;
}
// Limite d’arrivée avant le premier signal : inhabituel (les deux heures doivent être valides, sinon rien à comparer)
export function checkSeq(first, last) {
  if (!isTime(first) || !isTime(last)) return OK;
  return last < first ? warn('limite d’arrivée avant le premier signal') : OK;
}
// Canal VHF : entier de 1 à 88 (une chaîne est impossible : la conversion se fait avant) ; 16 = veille de détresse ; 29-59 hors table internationale (A2)
export function checkVhf(n) {
  if (!Number.isInteger(n) || n < 1 || n > 88) return bad('canal VHF impossible (1 à 88)');
  if (n === 16) return warn('canal 16 : veille de détresse, rarement un canal de course');
  return n > 28 && n < 60 ? warn('canal hors de la table internationale (1-28, 60-88)') : OK;
}
// Position : hors des bornes de la carte = impossible ; sur terre (isLand(x, y) en mètres, comme Terrain.isLand) = inhabituelle
export function checkPos(lat, lon, { isLand } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return bad('position illisible');
  if (lat < BOUNDS.south || lat > BOUNDS.north || lon < BOUNDS.west || lon > BOUNDS.east) return bad('position hors de la carte');
  if (typeof isLand === 'function') { const p = toXY(lat, lon); if (isLand(p.x, p.y)) return warn('position sur terre'); }
  return OK;
}
