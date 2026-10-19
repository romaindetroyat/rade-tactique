// Gel automatique du vent du jour et de la route conseillée (ARCH-02) : politique pure, sans DOM, sans stockage, sans horloge.
// Le jour de régate, sans geste, l’app copie dans la régate les prévisions du jour, les relevés de vent et la dernière route conseillée
// (js/app.js décide quand, ce module décide quoi). La copie est scellée au premier signal d’avertissement du jour ; une régate sans heure
// de manche ni IC est copiée toute la journée et scellée à la fin de son dernier jour (minuit de Paris, signal « inconnu »).
// Les instants sont toujours des instants de Paris (parisClock) : le fuseau du téléphone ne compte pas.

import { parisClock } from './racelock.js';
import { isTime, lastDay, daysOf } from './regates.js';

export const THROTTLE_MS = 10 * 60e3;          // au plus une copie complète toutes les 10 minutes
const pad = (n) => String(n).padStart(2, '0');

// Clé d’une donnée lourde dans la base rade-regates : nature = 'wx' (prévisions), 'obs' (relevés) ou 'strat' (route conseillée)
export const slotKey = (id, day, nature) => `${id}|${day}|${nature}`;

const nextDay = (d) => new Date(Date.parse(`${d}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
// Instant (ms) de HH:MM à Paris le jour AAAA-MM-JJ, en heure d’été ou d’hiver ; une heure sautée au changement d’heure tombe sur l’heure d’après
export function parisInstant(day, h, m = 0) {
  const base = Date.parse(`${day}T00:00:00Z`) + (h * 60 + m) * 60000;
  for (const off of [1, 2]) {
    const t = base - off * 3600e3, c = parisClock(t);
    if (c.date === day && c.hour === h && c.minute === m) return t;
  }
  return base - 3600e3;
}
export const clockOf = (ms) => { const c = parisClock(ms); return `${pad(c.hour)}:${pad(c.minute)}`; };

// Instant du sceau d’un jour de la régate : { at, signal } ; null hors des jours de la régate.
//  - 'manche' : la manche la plus tôt du jour qui a une heure ;
//  - 'ic'     : sinon l’heure du premier signal des IC, le premier jour seulement ;
//  - 'inconnu': sinon la fin du dernier jour de la régate (minuit de Paris qui suit), jamais « pas de sceau ».
export function sealAt(r, day) {
  if (!r || !daysOf(r).includes(day)) return null;
  const heures = (r.races || []).filter((m) => (m.date || r.dateStart) === day && isTime(m.time)).map((m) => m.time).sort();
  let hh = heures[0], signal = 'manche';
  if (!hh && day === r.dateStart && isTime(r.ic?.fields?.firstWarning)) { hh = r.ic.fields.firstWarning; signal = 'ic'; }
  if (hh) { const [h, m] = hh.split(':').map(Number); return { at: parisInstant(day, h, m), signal }; }
  return { at: parisInstant(nextDay(lastDay(r)), 0, 0), signal: 'inconnu' };
}

// Que faire maintenant ? 'rien' | 'gel' (copie à jour) | 'sceau' (dernière copie, au signal) | 'tard' (première copie après le signal).
// slot = résumé du dernier gel de ce jour (frozen[jour]) ou null ; dataFetched = date de téléchargement des prévisions qui couvrent le jour
// (0 si elles ne le couvrent pas) ; hasAnalysis = une route conseillée de ce jour est prête. `day` doit être le jour de Paris de `now`.
export function freezeAction({ now, regatta, day, slot = null, dataFetched = 0, hasAnalysis = false }) {
  const seal = sealAt(regatta, day);
  if (!seal || parisClock(now).date !== day) return 'rien';
  if (!dataFetched && !hasAnalysis) return 'rien';
  if (slot?.sealed) return 'rien';
  if (now >= seal.at) return slot ? 'sceau' : 'tard';
  if (!slot) return 'gel';
  if (dataFetched && dataFetched !== slot.fetched) return 'gel';            // nouvelles prévisions
  return now - slot.at >= THROTTLE_MS ? 'gel' : 'rien';
}

// Les relevés de vent sont des observations, pas un plan : ils continuent d’être copiés après le sceau, jusqu’au soir.
// obsStamp = instant du dernier relevé du jour ; une copie est due quand leur nombre ou ce dernier instant a changé.
export function obsNeedsCopy({ slot, nObsNow = 0, obsStamp = 0 }) {
  return !!slot && (nObsNow !== (slot.nObs ?? 0) || obsStamp !== (slot.obsStamp ?? 0));
}
// Prévisions : mêmes tableaux horaires que le cache, réduits aux jours demandés plus l’heure qui suit le dernier
// (modelAt interpole entre l’heure i et i+1 : sans elle, 23 h 30 serait faux). Ne modifie pas l’original.
export function sliceDays(data, days) {
  const cut = (loc) => {
    if (!loc?.hourly?.time) return loc;
    const dedans = loc.hourly.time.map((t) => days.includes(String(t).slice(0, 10)));
    const idx = dedans.map((b, i) => (b || dedans[i - 1] ? i : -1)).filter((i) => i >= 0);
    return { ...loc, hourly: Object.fromEntries(Object.entries(loc.hourly).map(([k, v]) => [k, Array.isArray(v) ? idx.map((i) => v[i]) : v])) };
  };
  return { fetched: data.fetched, snapshot: data.snapshot, multi: cut(data.multi), grid: Array.isArray(data.grid) ? data.grid.map(cut) : cut(data.grid), marine: cut(data.marine) };
}

// Vent prévu (série consensus) à l’heure ronde la plus proche de HH:MM un jour donné : { dir, spd } ou null
export function windAtHour(series, day, hhmm) {
  if (!isTime(hhmm) || !Array.isArray(series)) return null;
  const [h, m] = hhmm.split(':').map(Number), hr = h + (m >= 30 ? 1 : 0);
  const key = hr === 24 ? `${nextDay(day)}T00:00` : `${day}T${pad(hr)}:00`;
  const r = series.find((x) => x.time === key);
  return r?.dir == null || r.spd == null ? null : { dir: Math.round(r.dir), spd: Math.round(r.spd * 10) / 10 };
}

// Résumé d’un gel pour l’index de la régate : affiché par la fiche sans toucher à la base IndexedDB
export function freezeSummary({ action, now, regatta, day, data, series, model = null, nObs = 0, obsStamp = 0, by = null }) {
  const seal = sealAt(regatta, day);
  const signal = seal?.signal ?? null;
  const out = {
    at: now, sealed: action === 'sceau' || action === 'tard', late: action === 'tard',
    fetched: data?.fetched ?? null, snapshot: !!data?.snapshot, by, auto: true,
    windStart: seal && signal !== 'inconnu' ? windAtHour(series, day, clockOf(seal.at)) : null,
    model, nObs, obsStamp, signal, sealAt: seal?.at ?? null,
  };
  return out;
}
