// Gel automatique du vent du jour et de la route conseillée (ARCH-02) : politique pure, sans DOM, sans stockage, sans horloge.
// Le jour de régate, sans geste, l’app copie dans la régate les prévisions du jour, les relevés de vent et la dernière route conseillée
// (js/app.js décide quand, ce module décide quoi). La copie est scellée au premier signal d’avertissement du jour ; une régate sans heure
// de manche ni IC est copiée toute la journée et scellée à la fin de son dernier jour (minuit de Paris, signal « inconnu »).
// Les instants sont toujours des instants de Paris (parisClock) : le fuseau du téléphone ne compte pas.

import { parisClock } from './racelock.js';
import { isTime, lastDay, daysOf } from './regates.js';

export const THROTTLE_MS = 10 * 60e3;          // au plus une copie complète toutes les 10 minutes
export const MAX_STRATEGY_BYTES = 12000;       // la route conseillée figée tient en moins de 12 Ko
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
  if (hasAnalysis && !slot.strategy) return 'gel';                          // la route conseillée vient d’être calculée : pas d’attente de 10 min
  return now - slot.at >= THROTTLE_MS ? 'gel' : 'rien';
}

// Les relevés de vent sont des observations, pas un plan : ils continuent d’être copiés après le sceau, jusqu’au soir.
// obsStamp = instant du dernier relevé du jour ; une copie est due quand leur nombre ou ce dernier instant a changé.
export function obsNeedsCopy({ slot, nObsNow = 0, obsStamp = 0 }) {
  return !!slot && (nObsNow !== (slot.nObs ?? 0) || obsStamp !== (slot.obsStamp ?? 0));
}
// Une copie tardive (app ouverte après le signal) peut recevoir la route conseillée une seule fois, quand la première analyse est prête
export const stratNeedsCopy = ({ slot, hasAnalysis = false }) => !!slot && !!slot.late && !slot.strategy && !!hasAnalysis;

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

// ───────────────────────── route conseillée compacte

const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000, r5 = (x) => Math.round(x * 1e5) / 1e5;
const octets = (o) => new TextEncoder().encode(JSON.stringify(o)).length;
// Route conseillée d’une analyse (celle de runAnalysis) : positions en latitude / longitude (jamais en x / y : l’origine de la projection
// pourrait changer), chemin décimé d’un point sur trois, réglages inclus pour pouvoir recalculer plus tard. `reglages` vient de l’app ;
// toLL(x, y) → { lat, lon } est injectée (module pur). Si le JSON dépasse MAX_STRATEGY_BYTES, le chemin est décimé davantage, puis les
// conseils sont raccourcis, puis le chemin est retiré : aucun bord n’est perdu.
export function compactStrategy(analysis, reglages = {}, { toLL } = {}) {
  const ll = (p) => { const q = toLL(p.x, p.y); return [r5(q.lat), r5(q.lon)]; };
  const build = (pas, conseils) => ({
    v: 1,
    settings: { ...reglages },
    total: r3(analysis.total), dist: Math.round(analysis.dist),
    line: analysis.line ? { cb: ll(analysis.line.cb), pin: ll(analysis.line.pin) } : null,
    start: analysis.start?.startPoint ? ll(analysis.start.startPoint) : null,
    legs: analysis.legs.map((l, i) => ({
      n: i + 1, order: l.order ?? null, mark: l.mark, side: l.side ?? null, name: l.to?.name ?? '', to: ll(l.to),
      brg: r1(l.brg), dist: Math.round(l.dist), time: Math.round(l.time), eta0: r3(l.eta0 ?? 0), eta1: r3(l.eta1 ?? 0),
      type: { id: l.type?.id ?? '', label: l.type?.label ?? '', sail: l.type?.sail ?? '' },
      wind: { dir: Math.round(l.wind.dir), spd: r1(l.wind.spd), gust: r1(l.wind.gust) },
      advice: (l.advice || []).slice(0, conseils).map((a) => String(a).slice(0, 300)),
      path: pas && l.route?.path ? l.route.path.filter((_, k, a) => k % pas === 0 || k === a.length - 1).map(ll) : [],
    })),
  });
  let out = null;
  for (const [pas, conseils] of [[3, 5], [4, 3], [6, 2], [12, 1], [0, 1]]) {
    out = build(pas, conseils);
    if (octets(out) <= MAX_STRATEGY_BYTES) break;
  }
  return out;
}

// Ce que la fiche garde dans l’index (sans attendre la base) : réglages et détail des bords en peu de mots
export function strategySummary(s) {
  return {
    courseId: s.settings?.courseId ?? null, cls: s.settings?.cls ?? null, laps: s.settings?.laps ?? null, startTime: s.settings?.startTime ?? null,
    nLegs: s.legs.length, total: s.total, dist: s.dist,
    legs: s.legs.map((l) => ({
      mark: l.mark, name: l.name, side: l.side, brg: l.brg, dist: l.dist, time: l.time, type: l.type.label, windDir: l.wind.dir, windSpd: l.wind.spd,
      advice: String(l.advice[1] ?? l.advice[0] ?? '').slice(0, 140),
    })),
  };
}

// Résumé d’un gel pour l’index de la régate : affiché par la fiche sans toucher à la base IndexedDB
export function freezeSummary({ action, now, regatta, day, data, series, model = null, nObs = 0, obsStamp = 0, by = null, strategy = null }) {
  const seal = sealAt(regatta, day);
  const signal = seal?.signal ?? null;
  const out = {
    at: now, sealed: action === 'sceau' || action === 'tard', late: action === 'tard',
    fetched: data?.fetched ?? null, snapshot: !!data?.snapshot, by, auto: true,
    windStart: seal && signal !== 'inconnu' ? windAtHour(series, day, clockOf(seal.at)) : null,
    model, nObs, obsStamp, signal, sealAt: seal?.at ?? null,
  };
  if (strategy) out.strategy = strategySummary(strategy);
  return out;
}

// Source du vent d’une trace : les prévisions vivantes si leur jour y figure (plus récentes que la copie), sinon le gel de ce jour, sinon rien
export function windSourceKind({ day, liveDays, frozenDays }) {
  if (liveDays?.has?.(day)) return 'live';
  if (frozenDays?.has?.(day)) return 'gel';
  return 'aucun';
}

// « vent du jour figé le JJ/MM à HH:MM » (heure de Paris du gel) : dit d’où vient le vent d’une analyse ou d’un débrief tardif
export function frozenLabel(f) {
  const d = parisClock(f.at).date;
  return `vent du jour figé le ${d.slice(8, 10)}/${d.slice(5, 7)} à ${clockOf(f.at)}`;
}
