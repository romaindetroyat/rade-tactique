// Archive partagée, côté téléphone : quand synchroniser, quoi envoyer, comment appliquer la réponse (ARCH-01, D-03, D-04).
// Tout est injecté (horloge, réseau, stockage, état des régates, verrou de course) : aucun DOM. La fusion et le marquage sont dans js/archmerge.js.
// Chargé par import() après la carte (jamais avant l’interface utile) : js/app.js n’en dépend pas pour ouvrir.
import { mergeDoc, emptyDoc, toShared, fromShared } from './archmerge.js';

export const MIN_GAP_MS = 30e3;                    // jamais deux essais automatiques à moins de 30 s
export const DEBOUNCE_MS = 20e3;                   // après une modification locale
export const BACKOFF_MS = [30e3, 120e3, 600e3, 1800e3];

// D-03 : rien n’est envoyé ni reçu tant qu’un chrono, une trace, le mode départ ou le GPS de course est actif (raceActive de js/app.js)
export function canSync({ now, active, online, off = false, lastTry = 0, fails = 0 }) {
  if (off) return { ok: false, why: 'desactivee' };
  if (active) return { ok: false, why: 'course' };
  if (online === false) return { ok: false, why: 'hors_reseau' };
  const wait = Math.max(MIN_GAP_MS, fails ? BACKOFF_MS[Math.min(fails, BACKOFF_MS.length) - 1] : 0);
  if (now - lastTry < wait) return { ok: false, why: 'trop_tot', in: wait - (now - lastTry) };
  return { ok: true, why: null };
}

// Indicateur discret : { level: 'ok' | 'warn' | 'off', text } — jamais rouge
export function syncStatus({ off, active, online, busy, dirty = 0, lastOkAt = null, fails = 0, absent = false }) {
  if (absent) return { level: 'off', text: 'Archive non configurée' };
  if (off) return { level: 'off', text: 'Synchronisation désactivée' };
  if (active) return { level: 'off', text: 'En pause pendant la course' };
  if (busy) return { level: 'ok', text: 'Synchronisation…' };
  if (online === false) return { level: 'warn', text: dirty ? `Hors réseau · ${dirty} modification${dirty > 1 ? 's' : ''} en attente` : 'Hors réseau' };
  if (fails) return { level: 'warn', text: 'Synchronisation à relancer' };
  if (dirty) return { level: 'warn', text: 'En attente d’envoi' };
  return { level: 'ok', text: lastOkAt ? 'À jour' : 'Pas encore synchronisé' };
}

// ───────────────────────── document à envoyer et réponse appliquée

// Document local à envoyer : les régates sales (toutes à la première synchronisation), les suppressions, les recalages de bouées
export function buildDoc(st, { ids, marks = {} }) {
  const doc = emptyDoc();
  for (const r of st.list) if (!ids || ids.includes(r.id)) doc.regattas[r.id] = toShared(r);
  for (const [id, t] of Object.entries(st.tomb || {})) doc.tomb[`regatta:${id}`] = { t: t.t, by: t.by ?? null };
  doc.marks = marks;
  return doc;
}
// Réponse du serveur appliquée à l’état local : `sel` et `current` restent ceux de CET appareil ; les manches sont triées et renumérotées
export function applyDoc(st, remote) {
  const local = { ...emptyDoc(), regattas: Object.fromEntries(st.list.map((r) => [r.id, toShared(r)])), tomb: Object.fromEntries(Object.entries(st.tomb || {}).map(([id, t]) => [`regatta:${id}`, t])) };
  const m = mergeDoc(local, remote), byId = new Map(st.list.map((r) => [r.id, r]));
  const list = Object.values(m.regattas).map((r) => fromShared(r, byId.get(r.id))).sort((a, b) => String(a.dateStart).localeCompare(String(b.dateStart)) || String(a.id).localeCompare(String(b.id)));
  const tomb = Object.fromEntries(Object.entries(m.tomb).map(([k, t]) => [k.replace(/^regatta:/, ''), t]));
  const current = list.some((r) => r.id === st.current) ? st.current : list[0]?.id ?? null;
  return { st: { ...st, list, tomb, current }, marks: m.marks };
}

// ───────────────────────── une synchronisation
// deps : { now, fetchJson(method, query, body) → { status, body }, getState(), setState(st), getMarks(), setMarks(marks), meta (objet persisté),
//          saveMeta(), isActive(), isOnline(), canApply() }
export async function runSync(d, reason = 'auto') {
  const t = d.now(), meta = d.meta;
  const gate = canSync({ now: t, active: d.isActive(), online: d.isOnline(), off: meta.off, lastTry: meta.lastTry || 0, fails: meta.fails || 0 });
  if (!gate.ok && !(reason === 'manuel' && gate.why === 'trop_tot')) return { skipped: gate.why, in: gate.in };
  meta.lastTry = t;
  const first = !meta.first, snapshot = { ...(meta.dirty || {}) }, keys = Object.keys(snapshot);
  const ids = first ? undefined : keys.filter((k) => !k.startsWith('~'));
  const st = d.getState();
  let res;
  try {
    res = first || keys.length
      ? await d.fetchJson('PUT', { k: 'light' }, { doc: buildDoc(st, { ids, marks: first || snapshot['~marks'] ? d.getMarks() : {} }) })
      : await d.fetchJson('GET', { k: 'light', ...(meta.rev ? { rev: meta.rev } : {}) });
  } catch (e) {
    if (d.isActive()) return { skipped: 'course' };                       // échange abandonné parce qu’une course a commencé : ce n’est pas un échec
    meta.fails = (meta.fails || 0) + 1; d.saveMeta(); return { error: String(e.message || e).slice(0, 120) };
  }
  if (res.status === 503 && res.body?.error === 'no_blob') { meta.absent = true; d.saveMeta(); return { error: 'no_blob' }; }
  if (res.status !== 200) { meta.fails = (meta.fails || 0) + 1; d.saveMeta(); return { error: res.body?.error || String(res.status) }; }
  if (d.isActive()) return { skipped: 'course' };                         // la course a commencé pendant l’échange : réponse jetée, elle reviendra
  if (d.canApply && !d.canApply()) return { skipped: 'saisie' };          // saisie en cours : réponse jetée, elle reviendra
  meta.absent = false; meta.fails = 0; meta.lastOkAt = d.now();
  if (res.body.env) meta.env = res.body.env;
  if (res.body.unchanged) { d.saveMeta(); return { unchanged: true }; }
  const out = applyDoc(d.getState(), res.body.doc);                       // la fusion repart de l’état d’AUJOURD’HUI, pas de celui d’avant l’échange
  d.setState(out.st); d.setMarks(out.marks);
  for (const k of keys) if (meta.dirty[k] === snapshot[k]) delete meta.dirty[k];
  meta.first = true; meta.rev = res.body.rev;
  d.saveMeta();
  return { merged: true, rev: res.body.rev };
}
