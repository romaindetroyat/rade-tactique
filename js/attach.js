// Rattachement d’une trace à la régate de son jour (ARCH-04) : jour de Paris du plus long segment, choix de la régate, doublons,
// références de traces dans la régate. Fonctions pures, sans DOM ni stockage : js/app.js décide quand, ce module décide quoi.
// Le jour est toujours celui de Paris (parisClock) : jamais l’heure locale du téléphone ; une régate ne reçoit jamais deux fois la même trace.

import { parisClock } from './racelock.js';
import { segmentBreaks } from './segments.js';
import { parisInstant } from './gel.js';
import { isTime, lastDay } from './regates.js';

const DAY_MS = 864e5;
const HEURE_AVANT_MS = 3600e3;     // le signal précède souvent le début de l’enregistrement : une heure de marge avant la trace

// Jour de Paris du milieu du plus long segment (le segment du quai ne décide pas) : { day, from, to } avec from / to = bornes du segment (ms)
export function trackDay(pts, breaks = segmentBreaks(pts)) {
  const cuts = [0, ...breaks, pts.length];
  let best = null;
  for (let k = 0; k < cuts.length - 1; k++) {
    const a = pts[cuts[k]][0], b = pts[cuts[k + 1] - 1][0];
    if (!best || b - a > best.to - best.from) best = { from: a, to: b };
  }
  return { day: parisClock(best.from + (best.to - best.from) / 2).date, ...best };
}

// Manche de la régate dont le signal d’avertissement (heure de Paris) tombe dans la trace, une heure de marge avant son début ; null sinon.
// w = { day, from, to } (sortie de trackDay). Une manche sans heure, ou d’un autre jour que celui de la trace, ne compte pas.
export function raceOfTrack(r, w) {
  for (const m of r?.races || []) {
    if (!isTime(m.time) || (m.date || r.dateStart) !== w.day) continue;
    const [h, mi] = m.time.split(':').map(Number), s = parisInstant(w.day, h, mi);
    if (s >= w.from - HEURE_AVANT_MS && s <= w.to) return m;
  }
  return null;
}

const inDays = (r, day) => !!r.dateStart && day >= r.dateStart && day <= lastDay(r);
const nearDays = (r, day) => {
  if (!r.dateStart) return false;
  const a = Date.parse(r.dateStart), b = Date.parse(lastDay(r)), d = Date.parse(day);
  return (d < a && a - d <= DAY_MS) || (d > b && d - b <= DAY_MS);
};

// Quelle régate pour cette trace ? { how, candidates, day, from, to }
//  - 'unique' : une seule régate contient le jour de la trace → rattachement sans question ;
//  - 'heure'  : plusieurs régates ce jour-là, une seule a une manche dont le signal tombe dans la trace → rattachement sans question ;
//  - 'choix'  : plusieurs régates ce jour-là, aucune ou plusieurs manches plausibles → l’équipier tranche ;
//  - 'proche' : aucune régate ce jour-là, mais une la veille ou le lendemain de ses jours → proposition ;
//  - 'aucune' : rien d’approchant → proposer de créer une régate à la date de la trace, ou de laisser la trace sans régate.
export function matchRegattas(pts, regattas, breaks = segmentBreaks(pts)) {
  const w = trackDay(pts, breaks), list = regattas || [];
  const c = list.filter((r) => inDays(r, w.day));
  if (c.length === 1) return { how: 'unique', candidates: c, ...w };
  if (c.length > 1) {
    const hit = c.filter((r) => raceOfTrack(r, w));
    return hit.length === 1 ? { how: 'heure', candidates: hit, ...w } : { how: 'choix', candidates: c, ...w };
  }
  const near = list.filter((r) => nearDays(r, w.day));
  return near.length ? { how: 'proche', candidates: near, ...w } : { how: 'aucune', candidates: [], ...w };
}

// Doublon : la trace déjà enregistrée qui a le même début et le même nombre de points que `tr` (liste = listTracks()), sinon null
export const sameTrack = (list, tr) => (list || []).find((x) => x.start === tr.start && x.n === (tr.pts?.length ?? tr.n)) || null;

// Régate avec la référence de la trace ajoutée (une seule par identifiant) ; la régate d’entrée n’est jamais modifiée.
// tr = trace complète (pts) ou entrée de listTracks (n) ; by / at = auteur et instant du rattachement
export function attachTrace(r, tr, { by = null, at = Date.now() } = {}) {
  if ((r.traces || []).some((x) => x.id === tr.id)) return r;
  const ref = { id: tr.id, name: tr.name, start: tr.start, n: tr.pts?.length ?? tr.n, by, at };
  return { ...r, traces: [...(r.traces || []), ref] };
}

// Régate sans la référence de la trace (le rattachement se défait depuis la fiche et depuis le détail de la trace)
export function detachTrace(r, trId) {
  return { ...r, traces: (r.traces || []).filter((x) => x.id !== trId) };
}
