// Traces GPS : enregistrement pendant la course, stockage local, analyse après coup, export / import GPX.

import { toXY, distXY, bearingXY, norm180, norm360 } from './geo.js';
import { segStartsFromDoc, breaksFromInstants, breaksOf, activeStats } from './segments.js';

// ───────────────────────── stockage (IndexedDB)
const DB = 'rade-traces', ST = 'tracks';
function db() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, ko) => { const t = d.transaction(ST, mode), s = t.objectStore(ST), r = fn(s); t.oncomplete = () => ok(r?.result); t.onerror = () => ko(t.error); });
}
export const saveTrack = (tr) => tx('readwrite', (s) => s.put(tr));
export const deleteTrack = (id) => tx('readwrite', (s) => s.delete(id));
export const getTrack = (id) => tx('readonly', (s) => s.get(id));
// Liste par curseur : un enregistrement à la fois, seul le résumé est gardé (une trace pèse ≈ 600 Ko : `getAll` les désérialiserait toutes d'un coup).
// rt : instant du rapport rangé dans la trace locale, ou null
export async function listTracks() {
  const d = await db();
  const out = await new Promise((ok, ko) => {
    const res = [], c = d.transaction(ST, 'readonly').objectStore(ST).openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) return ok(res);
      const t = cur.value;
      res.push({ id: t.id, name: t.name, start: t.start, n: t.pts.length, course: t.course, rt: t.report?.t ?? null });
      cur.continue();
    };
    c.onerror = () => ko(c.error);
  });
  return out.sort((a, b) => b.start - a.start);
}

// ───────────────────────── enregistrement
// point : [t (ms), lat, lon, sog (nd), cog (°), précision (m)]
export class Recorder {
  // wake : verrou d’écran partagé (js/wakelock.js, raison « recording ») ; report(où, erreur) : journal de diagnostic (FIAB-07)
  constructor({ wake = null, report = () => {} } = {}) { this.track = null; this.lastSave = 0; this.wake = wake; this.report = report; }
  get active() { return !!this.track; }
  start(meta) {
    const now = Date.now();
    this.track = { id: 'tr' + now, name: meta.name, start: now, course: meta.course, pts: [] };
    this.wake?.want('recording');
  }
  add(q) {
    const T = this.track; if (!T) return;
    const last = T.pts[T.pts.length - 1];
    if (last) {
      const d = distXY(toXY(last[1], last[2]), toXY(q.lat, q.lon));
      if (q.t - last[0] < 1500 && d < 3) return;
    }
    if (q.acc > 60) return; // position trop imprécise
    T.pts.push([q.t, +q.lat.toFixed(6), +q.lon.toFixed(6), q.sog != null ? +q.sog.toFixed(2) : null, q.cog != null ? Math.round(q.cog) : null, Math.round(q.acc)]);
    if (Date.now() - this.lastSave > 20000) { this.lastSave = Date.now(); saveTrack(T).catch((e) => this.report('trace', e)); }
  }
  async stop() {
    const T = this.track; this.track = null;
    this.wake?.drop('recording');
    if (T && T.pts.length > 1) {
      try { await saveTrack(T); } catch (e) { this.report('trace', e); throw e; }     // consigné, puis relancé : l’appelant reçoit l’échec comme avant
    }
    return T;
  }
}

// ───────────────────────── analyse
// windAt(x, y, tMs) → { dir, spd } ; boatSpeed(tws, twa) ; legs : bords prévus (avec .to, .time, .order, .side)
export function analyzeTrack(tr, { windAt, boatSpeed, legs }) {
  const P = tr.pts.map(([t, lat, lon, sog, cog]) => ({ t, lat, lon, ...toXY(lat, lon), sog, cog }));
  if (P.length < 2) return null;
  // pauses d'enregistrement et pertes du GPS : jamais reliées (ni lissage, ni distance, ni durée à travers une coupure)
  const seg = new Array(P.length).fill(0);
  for (const b of breaksOf(tr)) if (b > 0 && b < P.length) P[b].brk = true;
  for (let i = 1; i < P.length; i++) seg[i] = seg[i - 1] + (P[i].brk ? 1 : 0);
  // vitesse et cap lissés sur ~8 s (indépendants du GPS du téléphone)
  for (let i = 0; i < P.length; i++) {
    let j = i; while (j > 0 && seg[j - 1] === seg[i] && P[i].t - P[j - 1].t < 8000) j--;
    let k = i; while (k < P.length - 1 && seg[k + 1] === seg[i] && P[k + 1].t - P[i].t < 8000) k++;
    const a = P[j], b = P[k], dt = (b.t - a.t) / 1000, d = distXY(a, b);
    P[i].v = dt > 1 ? d / dt / 0.5144 : (P[i].sog ?? 0);
    P[i].hd = d > 4 ? bearingXY(a, b) : (P[i].cog ?? (P[i].brk ? null : P[i - 1]?.hd) ?? 0);
  }
  let vmax = 0;
  for (const p of P) vmax = Math.max(vmax, p.v);
  const { dist, dur } = activeStats(P, distXY);         // enregistrement actif : somme par segment
  // vent du modèle et performance par rapport à la polaire
  let pSum = 0, pN = 0;
  for (const p of P) {
    const w = windAt(p.x, p.y, p.t); p.tws = w.spd; p.twd = w.dir; p.twa = norm180(p.hd - w.dir);
    const tgt = boatSpeed(w.spd, p.twa); p.pct = tgt > 0.5 ? p.v / tgt : null;
    if (p.pct && p.v > 1.5) { pSum += Math.min(1.5, p.pct); pN++; }
  }
  // virements / empannages : changement d'amure confirmé sur 10 s
  const man = [];
  let side = null, cand = null;
  for (const p of P) {
    if (p.brk) { side = null; cand = null; }          // une pause efface l'amure en cours : pas de virement « à travers » elle
    if (p.v < 1.5) continue;
    const s = p.twa >= 0 ? 1 : -1;
    if (side == null) { side = s; continue; }
    if (s === side) { cand = null; continue; }
    if (!cand) cand = p;
    else if (p.t - cand.t > 10000) { man.push({ t: cand.t, x: cand.x, y: cand.y, kind: Math.abs(cand.twa) < 90 ? 'virement' : 'empannage' }); side = s; cand = null; }
  }
  // passages de marques (dans l'ordre du parcours) et temps par bord
  const split = [];
  if (legs?.length) {
    let i0 = 0, tPrev = P[0].t;
    for (const l of legs) {
      let best = null;
      for (let i = i0; i < P.length; i++) { const d = distXY(P[i], l.to); if (!best || d < best.d) best = { d, i }; if (best && d > best.d + 400 && best.d < 150) break; }
      if (!best || best.d > 250) { split.push({ leg: l, missed: true }); continue; }
      const p = P[best.i], seg = P.slice(i0, best.i + 1);
      const avgPct = seg.filter((q) => q.pct && q.v > 1.5).reduce((a, q, _, arr) => a + Math.min(1.5, q.pct) / arr.length, 0);
      split.push({ leg: l, t: (p.t - tPrev) / 1000, at: p.t, dMark: best.d, plan: l.time, pct: avgPct, vmean: seg.reduce((a, q) => a + q.v, 0) / Math.max(1, seg.length) });
      i0 = best.i; tPrev = p.t;
    }
  }
  return { P, dist, dur, vmean: dist / Math.max(1, dur) / 0.5144, vmax, perf: pN ? pSum / pN : null, man, split };
}

// ───────────────────────── GPX
export function toGPX(tr) {
  const pt = ([t, lat, lon, sog, cog]) => `<trkpt lat="${lat}" lon="${lon}"><time>${new Date(t).toISOString()}</time>${sog != null ? `<extensions><speed>${(sog * 0.5144).toFixed(2)}</speed>${cog != null ? `<course>${cog}</course>` : ''}</extensions>` : ''}</trkpt>`;
  // un <trkseg> par segment : une pause reste une pause quand le fichier est relu
  const cuts = [0, ...breaksOf(tr), tr.pts.length];
  const segs = cuts.slice(0, -1).map((a, k) => `<trkseg>\n${tr.pts.slice(a, cuts[k + 1]).map(pt).join('\n')}\n</trkseg>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Rade Tactique" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${tr.name.replace(/[<&]/g, '')}</name><time>${new Date(tr.start).toISOString()}</time></metadata>\n<trk><name>${tr.name.replace(/[<&]/g, '')}</name>${segs}</trk>\n</gpx>\n`;
}
export function fromGPX(text, name) {
  const doc = new DOMParser().parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || !doc.getElementsByTagName('gpx').length) throw new Error('ce fichier n’est pas un GPX lisible');
  // points de trace, sinon points de route ou waypoints horodatés (selon l’app qui a exporté)
  let els = [...doc.getElementsByTagName('trkpt')];
  if (els.length < 2) els = [...doc.getElementsByTagName('rtept'), ...doc.getElementsByTagName('wpt')];
  const all = els.map((e) => [Date.parse(e.getElementsByTagName('time')[0]?.textContent?.trim() || ''), +e.getAttribute('lat'), +e.getAttribute('lon'), null, null, 5]);
  const pos = all.filter((p) => isFinite(p[1]) && isFinite(p[2]) && (p[1] || p[2]));
  if (pos.length < 2) throw new Error('aucun point de trace dans ce fichier');
  const pts = pos.filter((p) => !isNaN(p[0])).sort((x, y) => x[0] - y[0]).filter((p, i, A) => !i || p[0] > A[i - 1][0]);
  if (pts.length < 2) throw new Error('les points ne sont pas horodatés : réexportez la trace avec l’heure de chaque point');
  const trkName = doc.querySelector('trk > name')?.textContent?.trim();
  // coupures : début de chaque <trkseg> après un trou de plus de 5 s, ou trou de plus de 2 min (js/segments.js)
  const brk = breaksFromInstants(pts, segStartsFromDoc(doc));
  // identifiant déterministe (même fichier = même trace, sur n'importe quel téléphone : l'archive partagée ne la garde qu'une fois) ; les traces déjà enregistrées gardent le leur
  return { id: 'tr' + pts[0][0] + '-' + pts.length, name: trkName || name.replace(/\.(gpx|xml|txt)$/i, ''), start: pts[0][0], course: null, pts, brk, imported: true };
}
export async function exportGPX(tr) {
  const file = new File([toGPX(tr)], `${tr.name.replace(/[^\w\- ]+/g, '_')}.gpx`, { type: 'application/gpx+xml' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: tr.name }); return; } catch { /* annulé : téléchargement */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export { norm360 };
