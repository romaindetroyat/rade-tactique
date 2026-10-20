// Archive partagée, objets lourds (ARCH-03, D-03) : vent figé d'un jour, traces, rapports de débrief. Module pur : tout est injecté (horloge,
// réseau, bases locales, verrou de course), aucun DOM. Chargé par import() après une synchronisation légère réussie, hors course.
// Chaque objet a UN écrivain : il part une seule fois de chez l'équipier qui l'a, et arrive dans les bases locales existantes (`rade-regates`,
// `rade-traces`) aux clés que lisent déjà `getSlot` et `getTrack` : les lecteurs de la fiche et du débrief ne changent pas.
// Aucune perte : un jour figé en file d'envoi n'est jamais remplacé par un téléchargement ; un objet reçu n'est jamais renvoyé (`meta.down`) ;
// un objet immuable déjà en ligne n'est pas réécrit (le serveur le dit). Rien ne part ni n'arrive pendant une course ni la journée de régate.
import { parisClock } from './racelock.js';
import { lastDay } from './regates.js';
import { slug } from './archmerge.js';

export const HORIZON_DAYS = 180;          // régates terminées depuis moins de 180 jours (et toutes celles à venir) : lisibles hors réseau
export const MAX_PER_PASS = 6;            // au plus 6 objets par passage, avec un nouveau contrôle de la course entre deux
export const STORAGE_MAX = 0.6;           // arrêt des téléchargements au-delà de 60 % du stockage estimé
export const CAPS = { up: 20, down: 40 }; // par téléphone et par jour de Paris : envois et téléchargements d'objets lourds
export const MISS_MS = 30 * 60e3;         // objet annoncé mais pas encore en ligne (404) : on ne le redemande pas avant 30 minutes
const DAY_MS = 864e5, NATURES = ['wx', 'strat', 'obs'];

// Régate terminée depuis moins de 180 jours (jour de Paris), ou à venir ; sans date : incluse
export function inHorizon(r, now) {
  const last = lastDay(r);
  return !last || last >= parisClock(now - HORIZON_DAYS * DAY_MS).date;
}

// Stockage assez libre pour télécharger ? usage / quota < 60 % ; estimation inconnue ou absente : on continue
export function storageOk(est) {
  const usage = est?.usage, quota = est?.quota;
  if (!(quota > 0) || !(usage >= 0)) return true;
  return usage / quota < STORAGE_MAX;
}

// Clé d'un objet dans les marqueurs de la méta (`up` : envoyé, `down` : reçu, `miss` : annoncé mais absent, `hq` : jours figés en file d'envoi)
export const itemKey = (it) => (it.k === 'trace' ? `trace:${it.id}` : it.k === 'report' ? `report:${it.id}` : `day:${it.r}|${it.d}`);
// Empreinte du jour figé reçu : qui, quand (instant `u` du résumé). Elle est notée à la réception pour ne pas retélécharger la même chose.
export const dayStamp = (f) => `${slug(f?.by)}@${f?.u ?? 0}`;
// Contenu d'un jour figé en ligne : les trois copies de la base (prévisions du jour, route conseillée, relevés), celles qui existent seulement
export function dayObject(slots) {
  const out = {};
  for (const n of NATURES) if (slots?.[n] != null) out[n] = slots[n];
  return Object.keys(out).length ? out : null;
}

const missing = (meta, key, now) => Number.isFinite(meta.miss?.[key]) && now - meta.miss[key] < MISS_MS;
const byRecent = (a, b) => String(lastDay(b)).localeCompare(String(lastDay(a))) || String(a.id).localeCompare(String(b.id));
const refs = (r) => (Array.isArray(r.traces) ? r.traces : []);
const frozenOf = (r) => Object.entries(r.frozen && typeof r.frozen === 'object' ? r.frozen : {}).sort(([a], [b]) => (a < b ? 1 : -1));

// Quoi envoyer, quoi télécharger. list : régates locales ; me : prénom de CE téléphone (null tant qu'inconnu : aucun jour n'est téléchargé) ;
// localTraces : [{ id, rt }] (listTracks, rt = instant du rapport local ou null) ; localDays : clés `day:…` dont les copies existent localement
// (seuls les jours sans marqueur sont à vérifier) ; only : identifiant d'une régate (geste « Télécharger pour le hors réseau ») = rien d'autre,
// sans horizon ni délai de réessai. Rend { up, down } : envois d'abord, au plus MAX_PER_PASS en tout.
// Éléments : { k: 'day', r, d, by? } | { k: 'trace', id } | { k: 'report', id, t } (mêmes noms que les adresses de api/archive.js).
export function heavyPlan({ list = [], me = null, meta = {}, localTraces = [], localDays = [], now, only = null }) {
  const L = new Map(localTraces.map((x) => [x.id, x])), days = new Set(localDays), mine = slug(me), up = [], down = [];
  const all = list.filter((r) => !only || r.id === only).sort(byRecent);
  // envois : d'abord les jours figés en file, puis ceux d'avant l'archive (copies locales jamais envoyées ni reçues), puis traces et rapports
  const queued = [], legacy = [];
  for (const r of all) {
    for (const [d] of frozenOf(r)) {
      const key = `day:${r.id}|${d}`;
      if (meta.hq?.[key]) queued.push({ k: 'day', r: r.id, d });
      else if (!meta.up?.[key] && !meta.down?.[key] && days.has(key)) legacy.push({ k: 'day', r: r.id, d });
    }
  }
  up.push(...queued, ...legacy);
  const enFile = new Set(up.filter((x) => x.k === 'day').map(itemKey));          // un jour à envoyer n'est pas téléchargé dans le même passage (plafond, panne : ses copies locales ne sont jamais remplacées avant leur envoi)
  for (const r of all) {
    for (const ref of refs(r)) {
      const local = L.get(ref.id);
      if (!local) continue;
      if (!meta.up?.[`trace:${ref.id}`] && !meta.down?.[`trace:${ref.id}`]) up.push({ k: 'trace', id: ref.id });
      const rt = local.rt;
      if (rt && meta.up?.[`report:${ref.id}`] !== rt && meta.down?.[`report:${ref.id}`] !== rt) up.push({ k: 'report', id: ref.id, t: rt });
    }
  }
  // réceptions : régates de l'horizon seulement (ou celle demandée)
  const skip = (key) => !only && missing(meta, key, now);
  for (const r of all.filter((x) => only || inHorizon(x, now))) {
    if (mine) {
      for (const [d, f] of frozenOf(r)) {
        const key = `day:${r.id}|${d}`, by = slug(f?.by);
        if (!by || by === mine || meta.hq?.[key] || enFile.has(key) || meta.down?.[key] === dayStamp(f) || skip(key)) continue;       // le mien, en file, déjà reçu, ou absent depuis peu
        down.push({ k: 'day', r: r.id, d, by });
      }
    }
    for (const ref of refs(r)) {
      const local = L.get(ref.id);
      if (!local && !skip(`trace:${ref.id}`)) down.push({ k: 'trace', id: ref.id });
      const t = ref.report?.t;
      if (Number.isFinite(t) && t > (local?.rt || 0) && meta.down?.[`report:${ref.id}`] !== t && !skip(`report:${ref.id}`)) down.push({ k: 'report', id: ref.id, t });
    }
  }
  const u = up.slice(0, MAX_PER_PASS);
  return { up: u, down: down.slice(0, MAX_PER_PASS - u.length) };
}

// Trace reçue d'un autre téléphone → trace locale propre (champs connus seulement, points vérifiés) ; null si elle n'a pas la forme attendue
export function cleanTrace(body, id) {
  if (!body || typeof body !== 'object' || body.id !== id || !Array.isArray(body.pts) || body.pts.length < 2) return null;
  if (!body.pts.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]))) return null;
  const out = { id, name: String(body.name ?? '').slice(0, 200), start: Number.isFinite(body.start) ? body.start : body.pts[0][0], course: body.course ?? null, pts: body.pts };
  if (Array.isArray(body.brk) && body.brk.every(Number.isInteger)) out.brk = body.brk;
  if (body.imported === true) out.imported = true;
  return out;
}
// Rapport reçu → { html, t, name } ou null
export function cleanReport(body, t) {
  if (!body || typeof body.html !== 'string' || body.t !== t) return null;
  return { html: body.html, t, name: String(body.name ?? '').slice(0, 200) };
}
// Jour figé reçu → seules les copies qui ont la forme attendue (prévisions avec leurs heures, route avec ses bords, relevés avec leur liste) ; null si aucune
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function cleanDay(body) {
  if (!isObj(body)) return null;
  const out = {};
  if (isObj(body.wx) && Array.isArray(body.wx.multi?.hourly?.time)) out.wx = body.wx;
  if (isObj(body.strat) && Array.isArray(body.strat.legs)) out.strat = body.strat;
  if (isObj(body.obs) && Array.isArray(body.obs.obs)) out.obs = body.obs;
  return dayObject(out);
}

const mark = (meta, bag, key, v) => { (meta[bag] ||= {})[key] = v; };
const today = (d) => parisClock(d.now()).date;
// Compteurs du jour de Paris (remis à zéro quand le jour change)
function counters(meta, day) { return meta.hday === day ? { up: meta.hup || 0, down: meta.hdown || 0 } : { up: 0, down: 0 }; }

// Un passage. d : { now(), meta, saveMeta(), me(), getList(), fetchJson(method, query, body) → { status, body }, listTracks(), getTrack(id), saveTrack(tr),
//                   getSlot(clé), putSlot(clé, valeur), slotKey(régate, jour, nature), estimate() → { usage, quota }, isActive(), isLocked(), report(où, erreur) }
// Rend { up, down, skipped?, error?, capped?, storage? } : nombres d'objets passés, raison d'un arrêt. Le premier échec arrête le passage (jamais de boucle).
export async function runHeavy(d, { only = null } = {}) {
  const meta = d.meta, out = { up: 0, down: 0 };
  const halt = () => (d.isActive() ? 'course' : d.isLocked() ? 'journee' : null);
  let why = halt();
  if (why) return { ...out, skipped: why };
  const list = d.getList(), day = today(d), c = counters(meta, day);
  const count = (dir) => { c[dir]++; meta.hday = day; meta.hup = c.up; meta.hdown = c.down; };
  // les jours figés sans marqueur : leurs copies locales existent-elles ? (d'avant l'archive : à envoyer avant d'être éventuellement remplacées)
  const localDays = [];
  for (const r of list) {
    for (const dd of Object.keys(r.frozen && typeof r.frozen === 'object' ? r.frozen : {})) {
      const key = `day:${r.id}|${dd}`;
      if (meta.hq?.[key] || meta.up?.[key] || meta.down?.[key]) continue;
      let any = false;
      for (const n of NATURES) if ((await d.getSlot(d.slotKey(r.id, dd, n))) != null) { any = true; break; }
      if (any) localDays.push(key);
    }
  }
  const plan = heavyPlan({ list, me: d.me?.() ?? null, meta, localTraces: await d.listTracks(), localDays, now: d.now(), only });
  let est = null;
  try { est = await d.estimate?.(); } catch { /* estimation indisponible : on continue */ }
  if (plan.down.length && !storageOk(est)) { plan.down = []; out.storage = 'plein'; }        // stockage du téléphone au-delà de 60 % : on n'y met plus rien, les envois continuent
  const ctx = { d, count };
  for (const it of [...plan.up.map((x) => ({ ...x, dir: 'up' })), ...plan.down.map((x) => ({ ...x, dir: 'down' }))]) {
    if ((why = halt())) { out.skipped = why; break; }                    // nouveau contrôle de la course entre deux objets
    if (c[it.dir] >= CAPS[it.dir]) { out.capped = true; continue; }       // plafond du jour atteint pour ce sens
    try {
      const r = it.dir === 'up' ? await send(ctx, it) : await receive(ctx, it);
      if (r === 'stop') { out.error = meta.denied ? 'acces' : 'arret'; break; }
      if (r === 'ok') out[it.dir]++;
      d.saveMeta();
    } catch (e) {
      d.saveMeta();
      if ((why = halt())) { out.skipped = why; break; }                  // échange abandonné parce qu'une course a commencé : ce n'est pas un échec
      out.error = String(e?.message || e).slice(0, 120);
      d.report?.('archive', e);
      break;
    }
  }
  return out;
}

// Réponses communes : 'stop' (arrêt du passage), 'next' (objet laissé, on continue), null (réponse à traiter par l'appelant)
function refused(d, res, key) {
  if (res.status === 401) { d.meta.denied = true; return 'stop'; }
  if (res.status === 429 || (res.status === 503 && res.body?.error === 'no_blob')) return 'stop';
  if (res.status === 404) { mark(d.meta, 'miss', key, d.now()); return 'next'; }
  return null;
}

async function send({ d, count }, it) {
  const meta = d.meta, key = itemKey(it);
  if (it.k === 'day') {
    const marker = meta.hq?.[key] ?? null;                                           // lu AVANT les copies : un nouveau gel pendant l'envoi garde le jour en file
    const slots = {};
    for (const n of NATURES) slots[n] = await d.getSlot(d.slotKey(it.r, it.d, n));
    const body = dayObject(slots);
    const done = (v) => { mark(meta, 'up', key, v); if (marker != null && meta.hq?.[key] === marker) delete meta.hq[key]; };
    if (!body) { done('vide'); return 'next'; }                                      // aucune copie locale : rien à envoyer, rien à redemander
    count('up');
    const res = await d.fetchJson('PUT', { k: 'day', r: it.r, d: it.d }, body);
    if (res.status === 413) { done('trop-gros'); return 'next'; }
    if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`envoi refusé (${res.status})`); }
    done(marker ?? 1);
    return 'ok';
  }
  const tr = await d.getTrack(it.id);
  if (!tr || (it.k === 'report' && tr.report?.t !== it.t)) return 'next';           // supprimée ou rapport refait depuis : le prochain passage recalcule
  count('up');
  const res = it.k === 'trace'
    ? await d.fetchJson('PUT', { k: 'trace', id: it.id }, (({ report, ...sans }) => sans)(tr))
    : await d.fetchJson('PUT', { k: 'report', id: it.id, t: it.t }, { html: tr.report.html, t: it.t, name: tr.report.name });
  if (res.status === 413) { mark(meta, 'up', key, 'trop-gros'); return 'next'; }     // jamais de boucle : l'objet est abandonné, la fiche reste lisible
  if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`envoi refusé (${res.status})`); }
  mark(meta, 'up', key, it.k === 'trace' ? 1 : it.t);
  return 'ok';
}

async function receive({ d, count }, it) {
  const meta = d.meta, key = itemKey(it);
  if (it.k === 'day') {
    const f = d.getList().find((r) => r.id === it.r)?.frozen?.[it.d];
    if (meta.hq?.[key] || !f || slug(f.by) !== it.by) return 'next';                 // gelé entre-temps, ou le résumé a changé : le prochain passage recalcule
    count('down');
    const res = await d.fetchJson('GET', { k: 'day', r: it.r, d: it.d, by: it.by });
    if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`téléchargement refusé (${res.status})`); }
    const body = cleanDay(res.body);
    if (!body) { mark(meta, 'miss', key, d.now()); d.report?.('archive', new Error('vent du jour reçu illisible')); return 'next'; }
    if (meta.hq?.[key]) return 'next';                                               // gelé pendant le téléchargement : les copies locales ne sont JAMAIS remplacées avant leur envoi
    for (const n of NATURES) if (body[n] != null) await d.putSlot(d.slotKey(it.r, it.d, n), body[n]);     // une copie absente n'efface pas la locale
    mark(meta, 'down', key, dayStamp(f));
    return 'ok';
  }
  if (it.k === 'trace') {
    count('down');
    const res = await d.fetchJson('GET', { k: 'trace', id: it.id });
    if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`téléchargement refusé (${res.status})`); }
    const tr = cleanTrace(res.body, it.id);
    if (!tr) { mark(meta, 'miss', key, d.now()); d.report?.('archive', new Error('trace reçue illisible')); return 'next'; }
    if (!(await d.getTrack(it.id))) await d.saveTrack(tr);                          // une trace déjà là (importée entre-temps) n'est pas écrasée
    mark(meta, 'down', key, 1);                                                      // reçue : elle ne repart jamais
    return 'ok';
  }
  count('down');
  const res = await d.fetchJson('GET', { k: 'report', id: it.id, t: it.t });
  if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`téléchargement refusé (${res.status})`); }
  const rep = cleanReport(res.body, it.t), tr = await d.getTrack(it.id);
  if (!rep) { mark(meta, 'miss', key, d.now()); d.report?.('archive', new Error('rapport reçu illisible')); return 'next'; }
  if (!tr) return 'next';
  if (!(tr.report?.t >= it.t)) await d.saveTrack({ ...tr, report: rep });          // un rapport local plus récent reste
  mark(meta, 'down', key, it.t);
  return 'ok';
}
