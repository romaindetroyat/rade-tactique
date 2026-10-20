// Archive partagée de l’équipage (Vercel, fonction Node) : lit et écrit le stockage Vercel Blob PRIVÉ pour le compte des trois équipiers.
// Le middleware a déjà vérifié le code d’accès et pose l’en-tête `x-rt-membre` (prénom, encodé) : c’est la seule source de l’auteur, jamais le corps.
// Variables d’environnement : BLOB_READ_WRITE_TOKEN (ou BLOB_STORE_ID + OIDC), VERCEL_ENV. Aucune URL Blob n’est jamais renvoyée au client.
// Routes de ce plan (toutes sur /api/archive, paramètre k) ; les autres (day, trace, report) arrivent avec le plan 04 :
//   GET  ?k=light[&rev=…]   document léger partagé { rev, doc, env } (ou { unchanged, rev, env } si rev est à jour)
//   PUT  ?k=light           { doc } : fusion côté serveur (lire → fusionner → écrire avec ifMatch, 4 essais) → { rev, doc, changed, env }
// `createHandler({ blob, now })` accepte un faux Blob (tests, aucun réseau) : { get, put, head, BlobError, BlobPreconditionFailedError,
// BlobNotFoundError, BlobServiceRateLimited } ; sans lui, le SDK @vercel/blob est importé à la première requête.

import { mergeDoc, emptyDoc, docEquals, canon, sameBody, LOCAL_ONLY, HEAD, LISTS, MAX_HIST } from '../js/archmerge.js';

export const MAX_LIGHT = 3_500_000, MAX_REGATTA = 150_000, MAX_REGATTAS = 200;
const TRIES = 4, FUTURE_MS = 5 * 60e3;
const ID = /^[A-Za-z0-9._-]{1,80}$/, DAY = /^\d{4}-\d{2}-\d{2}$/, NAME = /^[\p{L}\p{M} '’-]{1,40}$/u, TOMB_KEY = /^[\w:.|-]{1,120}$/, MARK_KEY = /^\w{1,12}$/;
const DANGER = new Set(['__proto__', 'constructor', 'prototype']);
const fail = (message, status) => Object.assign(new Error(message), { status });
const validId = (id) => (typeof id === 'string' || Number.isFinite(id)) && ID.test(String(id));    // un identifiant absent ne devient pas la chaîne « undefined »
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
// Les données d’un aperçu ne se mélangent jamais à celles de la production (le même magasin est branché aux deux environnements)
export const prefix = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview');
const bornee = (e) => String(e?.message || e).slice(0, 300);

// ───────────────────────── validation et attribution

const clampU = (e, now) => (isObj(e) && e.u > now + FUTURE_MS ? { ...e, u: now } : e);   // horloge d’un téléphone dans le futur : ramenée à l’heure du serveur
const clampT = (t, now) => (t > now + FUTURE_MS ? now : t);                     // au-delà de 5 min d'avance : l'heure du serveur ; en deçà, le décalage normal entre téléphones est sans effet
const clampReport = (e, now) => (isObj(e.report) && e.report.t > now + FUTURE_MS ? { ...e, report: { ...e.report, t: now } } : e);   // le rapport le plus récent gagne : une date future le ferait gagner pour toujours
const tombs = (src, now) => Object.fromEntries(Object.entries(isObj(src) ? src : {}).filter(([k, v]) => !DANGER.has(k) && TOMB_KEY.test(k) && Number.isFinite(v?.t)).map(([k, v]) => [k, { t: clampT(v.t, now), by: null }]));
const mark = (v, now) => {                                                          // recalage de bouée : seuls les champs connus, `by` posé plus tard par le serveur
  const o = { t: clampT(v.t, now) };
  if (Number.isFinite(v.lat) && Number.isFinite(v.lon)) { o.lat = v.lat; o.lon = v.lon; }
  if (typeof v.src === 'string') o.src = v.src.slice(0, 40);
  if (v.del === true) o.del = true;
  if (Array.isArray(v.h)) o.h = v.h.filter((x) => isObj(x) && Number.isFinite(x.t)).slice(0, 5).map((x) => ({ lat: Number.isFinite(x.lat) ? x.lat : null, lon: Number.isFinite(x.lon) ? x.lon : null, src: typeof x.src === 'string' ? x.src.slice(0, 40) : null, t: x.t, by: typeof x.by === 'string' ? x.by.slice(0, 40) : null, del: x.del === true }));
  return o;
};

// Document reçu → document propre : limites, clés refusées, `sel` retiré, dates futures ramenées à maintenant
export function cleanDoc(doc, now) {
  if (!isObj(doc)) throw fail('document illisible', 400);
  if (doc.v != null && doc.v !== 1) throw fail('version de format inconnue : mettez l’app à jour', 400);
  if (JSON.stringify(doc).length > MAX_LIGHT) throw fail('document trop volumineux', 413);
  const out = emptyDoc(), ids = Object.keys(isObj(doc.regattas) ? doc.regattas : {}).filter((k) => !DANGER.has(k));
  if (ids.length > MAX_REGATTAS) throw fail('trop de régates', 413);
  for (const id of ids) {
    const r = doc.regattas[id];
    if (!ID.test(id) || !isObj(r) || r.id !== id) throw fail(`régate invalide : ${id.slice(0, 20)}`, 400);
    if (JSON.stringify(r).length > MAX_REGATTA) throw fail('régate trop volumineuse', 413);
    const c = { ...r }; for (const k of LOCAL_ONLY) delete c[k];
    for (const key of Object.values(LISTS)) {
      if (c[key] != null && !Array.isArray(c[key])) throw fail(`${key} invalide`, 400);
      c[key] = (c[key] || []).map((e) => { if (!isObj(e) || !validId(e.id)) throw fail(`élément invalide dans ${key}`, 400); return clampReport(clampU(e, now), now); });
    }
    c.frozen = Object.fromEntries(Object.entries(isObj(c.frozen) ? c.frozen : {}).filter(([d, f]) => DAY.test(d) && isObj(f)).map(([d, f]) => [d, clampU(f, now)]));
    c.tomb = tombs(c.tomb, now);
    c.hist = (Array.isArray(c.hist) ? c.hist : []).filter((x) => isObj(x) && Number.isFinite(x.t) && typeof x.kind === 'string').slice(0, MAX_HIST);
    out.regattas[id] = clampU(c, now);
  }
  out.tomb = tombs(doc.tomb, now);
  for (const [k, v] of Object.entries(isObj(doc.marks) ? doc.marks : {})) if (!DANGER.has(k) && MARK_KEY.test(k) && isObj(v) && Number.isFinite(v.t)) out.marks[k] = mark(v, now);
  return out;
}

// Auteur : tout ce qui est nouveau ou différent de ce qui est stocké est signé par l'équipier connecté (le `by` du client est ignoré).
// Exception : une ancienne version déjà connue du serveur (elle figure dans l'historique de la fiche ou d'un recalage) que renvoie un téléphone en
// retard garde son auteur d'origine : renvoyer un état périmé ne réécrit pas l'histoire et ne change rien au document.
const knownRegatta = (hist, kind, id, e, fields) => (hist || []).find((h) => h.kind === kind && h.id === String(id) && h.t === (e.u || 0) && h.v && sameBody(h.v, fields ? Object.fromEntries(fields.map((k) => [k, e[k]])) : e));
const knownMark = (marks, v) => (marks?.h || []).find((x) => x.t === v.t && x.lat === (v.lat ?? null) && x.lon === (v.lon ?? null) && x.src === (v.src ?? null) && x.del === !!v.del);

export function attribute(incoming, stored, who) {
  const out = emptyDoc();
  for (const [id, r] of Object.entries(incoming.regattas)) {
    const s = stored.regattas?.[id], o = { ...r };
    const head = (x) => canon(Object.fromEntries(HEAD.map((k) => [k, x?.[k]])));
    if (!s) { o.by = who; o.ub = who; }
    else {
      o.by = s.by ?? who;
      o.ub = head(s) === head(r) ? s.ub ?? null : (knownRegatta(s.hist, 'head', id, r, HEAD.filter((k) => k in r))?.by ?? who);
    }
    for (const key of Object.values(LISTS)) {
      const kind = Object.keys(LISTS).find((k) => LISTS[k] === key), S = new Map((s?.[key] || []).map((e) => [String(e.id), e]));
      o[key] = o[key].map((e) => {
        const p = S.get(String(e.id));
        if (!p) return { ...e, by: who, ub: who };
        if (sameBody(p, e)) return { ...e, by: p.by ?? null, ub: p.ub ?? null };
        return { ...e, by: p.by ?? who, ub: knownRegatta(s.hist, kind, e.id, e)?.by ?? who };
      });
    }
    o.frozen = Object.fromEntries(Object.entries(o.frozen).map(([d, f]) => { const p = s?.frozen?.[d]; return [d, p && sameBody(p, f) ? { ...f, by: p.by, ub: p.ub } : { ...f, by: who, ub: who }]; }));
    o.tomb = Object.fromEntries(Object.entries(o.tomb || {}).map(([k, v]) => [k, { t: v.t, by: s?.tomb?.[k]?.by ?? who }]));
    out.regattas[id] = o;
  }
  out.tomb = Object.fromEntries(Object.entries(incoming.tomb).map(([k, v]) => [k, { t: v.t, by: stored.tomb?.[k]?.by ?? who }]));
  out.marks = Object.fromEntries(Object.entries(incoming.marks).map(([k, v]) => {
    const p = stored.marks?.[k];
    if (p && canon({ ...p, h: 0 }) === canon({ ...v, by: p.by, h: 0 })) return [k, p];
    return [k, { ...v, by: knownMark(p, v)?.by ?? who }];
  }));
  return out;
}

// ───────────────────────── lecture / écriture du document léger avec ifMatch

async function readText(stream) { return new Response(stream).text(); }
async function readLight(B, path) {
  const r = await B.get(path, { access: 'private', useCache: false });          // useCache:false : relire la dernière version, pas la copie du CDN (jusqu’à 60 s de retard)
  if (!r || r.statusCode !== 200) return { doc: emptyDoc(), etag: null };
  try { return { doc: { ...emptyDoc(), ...JSON.parse(await readText(r.stream)) }, etag: r.blob.etag }; } catch { throw fail('document stocké illisible', 502); }
}
// Une écriture qui a perdu la course contre un autre équipier se rejoue (relire, refusionner) ; à la création, l’échec « existe déjà » n’a pas de classe dédiée dans le SDK
const lost = (B, e, etag) => e instanceof B.BlobPreconditionFailedError || (!etag && e instanceof B.BlobError && !(e instanceof B.BlobServiceRateLimited));

export async function mutateLight(B, path, fn, { tries = TRIES } = {}) {
  const dir = path.replace(/light\.json$/, ''), kept = new Set();
  let last = null;
  for (let i = 0; i < tries; i++) {
    const { doc: stored, etag } = await readLight(B, path);
    const { doc, trash = [] } = fn(stored);
    if (docEquals(doc, stored)) return { doc, rev: etag, changed: false };            // rien ne change : aucune écriture (quota Blob), pas même la création d’un document vide
    const text = JSON.stringify(doc);
    if (text.length > MAX_LIGHT) throw fail('archive trop volumineuse : à découper', 413);
    // une régate supprimée est copiée dans trash/ AVANT de quitter le document : si la copie échoue, la suppression n’a pas lieu
    for (const t of trash) {
      const key = `${t.id}|${t.t}`; if (kept.has(key)) continue;
      await B.put(`${dir}trash/${t.id}-${t.t}.json`, JSON.stringify(t.value), { access: 'private', contentType: 'application/json', addRandomSuffix: true });
      kept.add(key);
    }
    try {
      const opts = { access: 'private', contentType: 'application/json', cacheControlMaxAge: 60 };
      const r = etag ? await B.put(path, text, { ...opts, allowOverwrite: true, ifMatch: etag }) : await B.put(path, text, opts);   // création : échoue si un autre l’a créé entre-temps
      return { doc, rev: r.etag, changed: true };
    } catch (e) {
      last = e;
      if (lost(B, e, etag)) continue;                                           // quelqu’un a écrit entre-temps : on relit, on refusionne
      throw e;
    }
  }
  throw last && !(last instanceof B.BlobPreconditionFailedError) ? last : fail('écritures simultanées : réessayez', 409);
}

// ───────────────────────── fonction

// Le prénom posé par le middleware est encodé (une valeur d’en-tête reste en octets simples) : décodé puis validé, sinon null
function membre(header) {
  try { const who = decodeURIComponent(String(header || '')).trim(); return NAME.test(who) ? who : null; } catch { return null; }
}

export function createHandler({ blob, now = Date.now } = {}) {
  let sdk = blob || null;
  const getBlob = async () => (sdk ||= await import('@vercel/blob'));
  return async function handler(req, res) {
    res.setHeader?.('Cache-Control', 'no-store');
    const who = membre(req.headers?.['x-rt-membre']);
    if (!who) return res.status(403).json({ error: 'membre_inconnu' });         // fermé par défaut : sans prénom du middleware, rien n’est lu
    if (!sdk && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return res.status(503).json({ error: 'no_blob' });
    const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);
    if (q.k !== 'light') return res.status(400).json({ error: 'k inconnu' });
    if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'GET ou PUT' });
    const P = prefix(), path = `${P}/light.json`;
    try {
      const B = await getBlob();
      if (req.method === 'GET') {
        const r = await B.get(path, { access: 'private', useCache: false, ...(q.rev ? { ifNoneMatch: String(q.rev) } : {}) });
        if (!r) return res.status(200).json({ rev: null, doc: emptyDoc(), env: P });
        if (r.statusCode === 304) return res.status(200).json({ unchanged: true, rev: r.blob.etag, env: P });
        let doc;
        try { doc = { ...emptyDoc(), ...JSON.parse(await readText(r.stream)) }; } catch { throw fail('document stocké illisible', 502); }
        return res.status(200).json({ rev: r.blob.etag, doc, env: P });
      }
      const t = now(), incoming = cleanDoc(req.body?.doc, t);
      const out = await mutateLight(B, path, (stored) => {
        const merged = mergeDoc(stored, attribute(incoming, stored, who));
        const trash = Object.keys(stored.regattas || {}).filter((id) => !merged.regattas[id]).map((id) => ({ id, t, value: stored.regattas[id] }));
        return { doc: merged, trash };
      });
      return res.status(200).json({ ...out, env: P });
    } catch (err) {
      if (sdk && err instanceof sdk.BlobServiceRateLimited) { res.setHeader?.('Retry-After', String(err.retryAfter || 60)); return res.status(429).json({ error: 'limite du stockage atteinte, réessayez plus tard' }); }
      return res.status(err.status || 502).json({ error: bornee(err) });
    }
  };
}

export default createHandler();
