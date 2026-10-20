// Archive partagée, objets lourds (ARCH-03, D-03) : traces, rapports de débrief, [tâche 2 : vent figé du jour]. Module pur : tout est injecté
// (horloge, réseau, bases locales, verrou de course), aucun DOM. Chargé par import() après une synchronisation légère réussie, hors course.
// Chaque objet a UN écrivain : il part une seule fois de chez l'équipier qui l'a, et arrive dans les bases locales existantes (`rade-traces`),
// que lisent déjà `getTrack` et `listTracks` sans changement. Aucun objet venu d'un autre téléphone n'est repartagé (marqueur `meta.down`).
import { parisClock } from './racelock.js';
import { lastDay } from './regates.js';

export const HORIZON_DAYS = 180;          // régates terminées depuis moins de 180 jours (et toutes celles à venir) : lisibles hors réseau
export const MAX_PER_PASS = 6;            // au plus 6 objets par passage, avec un nouveau contrôle de la course entre deux
export const STORAGE_MAX = 0.6;           // [tâche 2] arrêt des téléchargements au-delà de 60 % du stockage estimé
export const MISS_MS = 30 * 60e3;         // objet annoncé mais pas encore en ligne (404) : on ne le redemande pas avant 30 minutes
const DAY_MS = 864e5;

// Régate terminée depuis moins de 180 jours (jour de Paris), ou à venir ; sans date : incluse
export function inHorizon(r, now) {
  const last = lastDay(r);
  return !last || last >= parisClock(now - HORIZON_DAYS * DAY_MS).date;
}

// Clé d'un objet dans les marqueurs de la méta (`up` : ce que ce téléphone a envoyé, `down` : ce qu'il a reçu, `miss` : annoncé mais absent)
export const itemKey = (it) => (it.k === 'trace' ? `trace:${it.id}` : it.k === 'report' ? `report:${it.id}` : `day:${it.r}|${it.d}`);

const missing = (meta, key, now) => Number.isFinite(meta.miss?.[key]) && now - meta.miss[key] < MISS_MS;
const byRecent = (a, b) => String(lastDay(b)).localeCompare(String(lastDay(a))) || String(a.id).localeCompare(String(b.id));

// Quoi envoyer, quoi télécharger. list : régates locales (REG.list) ; localTraces : [{ id, rt }] (listTracks, rt = instant du rapport local ou null) ;
// only : identifiant d'une régate (geste « Télécharger pour le hors réseau ») = rien d'autre, sans horizon ni délai de réessai.
// Rend { up, down } : envois d'abord, au plus MAX_PER_PASS en tout ; éléments { k: 'trace', id } | { k: 'report', id, t } (mêmes noms que les adresses).
export function heavyPlan({ list = [], meta = {}, localTraces = [], now, only = null }) {
  const L = new Map(localTraces.map((x) => [x.id, x])), up = [], down = [];
  const regs = list.filter((r) => (only ? r.id === only : inHorizon(r, now))).sort(byRecent);
  for (const r of regs) {
    for (const ref of Array.isArray(r.traces) ? r.traces : []) {
      const local = L.get(ref.id);
      if (local) {
        if (!meta.up?.[`trace:${ref.id}`] && !meta.down?.[`trace:${ref.id}`]) up.push({ k: 'trace', id: ref.id });
        const rt = local.rt;
        if (rt && meta.up?.[`report:${ref.id}`] !== rt && meta.down?.[`report:${ref.id}`] !== rt) up.push({ k: 'report', id: ref.id, t: rt });
      }
    }
    for (const ref of Array.isArray(r.traces) ? r.traces : []) {
      const local = L.get(ref.id), skip = (key) => !only && missing(meta, key, now);
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

const mark = (meta, bag, key, v) => { (meta[bag] ||= {})[key] = v; };

// Un passage. d : { now(), meta, saveMeta(), getList(), fetchJson(method, query, body) → { status, body }, listTracks(), getTrack(id), saveTrack(tr),
//                   isActive(), isLocked(), report(où, erreur) }
// Rend { up, down, skipped?, error? } : nombres d'objets passés, raison d'un arrêt. Le premier échec arrête le passage (jamais de boucle).
export async function runHeavy(d, { only = null } = {}) {
  const meta = d.meta, out = { up: 0, down: 0 };
  const halt = () => (d.isActive() ? 'course' : d.isLocked() ? 'journee' : null);
  let why = halt();
  if (why) return { ...out, skipped: why };
  const plan = heavyPlan({ list: d.getList(), meta, localTraces: await d.listTracks(), now: d.now(), only });
  for (const it of [...plan.up.map((x) => ({ ...x, dir: 'up' })), ...plan.down.map((x) => ({ ...x, dir: 'down' }))]) {
    if ((why = halt())) { out.skipped = why; break; }                    // nouveau contrôle de la course entre deux objets
    try {
      const r = it.dir === 'up' ? await send(d, it) : await receive(d, it);
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

async function send(d, it) {
  const meta = d.meta, key = itemKey(it);
  if (it.k === 'trace' || it.k === 'report') {
    const tr = await d.getTrack(it.id);
    if (!tr || (it.k === 'report' && tr.report?.t !== it.t)) return 'next';        // supprimée ou rapport refait depuis : le prochain passage recalcule
    const res = it.k === 'trace'
      ? await d.fetchJson('PUT', { k: 'trace', id: it.id }, (({ report, ...sans }) => sans)(tr))
      : await d.fetchJson('PUT', { k: 'report', id: it.id, t: it.t }, { html: tr.report.html, t: it.t, name: tr.report.name });
    if (res.status === 413) { mark(meta, 'up', key, 'trop-gros'); return 'next'; }   // jamais de boucle : l'objet est abandonné, la fiche reste lisible
    if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`envoi refusé (${res.status})`); }
    mark(meta, 'up', key, it.k === 'trace' ? 1 : it.t);
    return 'ok';
  }
  return 'next';
}

async function receive(d, it) {
  const meta = d.meta, key = itemKey(it);
  if (it.k === 'trace') {
    const res = await d.fetchJson('GET', { k: 'trace', id: it.id });
    if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`téléchargement refusé (${res.status})`); }
    const tr = cleanTrace(res.body, it.id);
    if (!tr) { mark(meta, 'miss', key, d.now()); d.report?.('archive', new Error('trace reçue illisible')); return 'next'; }
    if (!(await d.getTrack(it.id))) await d.saveTrack(tr);                          // une trace déjà là (importée entre-temps) n'est pas écrasée
    mark(meta, 'down', key, 1);                                                      // reçue : elle ne repart jamais
    return 'ok';
  }
  if (it.k === 'report') {
    const res = await d.fetchJson('GET', { k: 'report', id: it.id, t: it.t });
    if (res.status !== 200) { const r = refused(d, res, key); if (r) return r; throw new Error(`téléchargement refusé (${res.status})`); }
    const rep = cleanReport(res.body, it.t), tr = await d.getTrack(it.id);
    if (!rep) { mark(meta, 'miss', key, d.now()); d.report?.('archive', new Error('rapport reçu illisible')); return 'next'; }
    if (!tr) return 'next';
    if (!(tr.report?.t >= it.t)) await d.saveTrack({ ...tr, report: rep });        // un rapport local plus récent reste
    mark(meta, 'down', key, it.t);
    return 'ok';
  }
  return 'next';
}
