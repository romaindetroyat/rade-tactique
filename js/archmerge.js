// Archive partagée : fusion des régates entre téléphones (ARCH-01, D-04). Module pur : aucun DOM, aucun stockage, aucune horloge (now injecté).
// Importé par la page ET par la fonction api/archive.js : une seule implémentation des règles, côté téléphone comme côté serveur.
// Principe : ensemble d’éléments à « dernier écrit gagne » (LWW). Chaque élément a un id et une date de dernière modification `u` (ms) ;
// les ajouts des deux côtés sont tous gardés, une suppression est une pierre tombale `tomb`, et pour une même valeur modifiée des deux côtés
// la plus récente gagne : l’autre va dans `hist` (historique de la fiche). La fusion est commutative, associative et idempotente.

export const MAX_HIST = 30, MAX_HIST_BYTES = 4000;
export const HEAD = ['name', 'club', 'dateStart', 'dateEnd', 'season', 'ic'];      // « fiche » : modifiée d’un bloc par la validation des IC
export const LISTS = { race: 'races', mark: 'marks', course: 'courses', trace: 'traces' };
export const LOCAL_ONLY = ['sel'];                                                 // état d’affichage de CET appareil : jamais partagé
const DANGER = new Set(['__proto__', 'constructor', 'prototype']);                // clés refusées partout (pollution de prototype)

const sorted = (o) => (Array.isArray(o) ? o.map(sorted) : o && typeof o === 'object'
  ? Object.fromEntries(Object.keys(o).filter((k) => !DANGER.has(k)).sort().map((k) => [k, sorted(o[k])])) : o);
export const canon = (o) => JSON.stringify(sorted(o));
const body = (e) => { const { u, ub, by, ...rest } = e || {}; return rest; };       // contenu d’un élément sans ses métadonnées (date, modifié par, créé par : posées par le serveur)
export const sameBody = (a, b) => canon(body(a)) === canon(body(b));
// > 0 si `a` gagne : la plus récente, à égalité le contenu le plus grand (arbitraire mais identique sur tous les appareils)
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
export const wins = (a, b) => ((a?.u || 0) - (b?.u || 0)) || cmp(canon(body(a)), canon(body(b)))
  || ((a?.by != null) - (b?.by != null)) || cmp(String(a?.by), String(b?.by)) || cmp(String(a?.ub), String(b?.ub));   // à contenu égal : celui qui a un auteur (posé par le serveur)

// Nom d’équipier ou de régate réduit à un identifiant de chemin : sans accent, minuscules, tirets (le serveur et la page calculent le même)
export const slug = (n) => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const hist = (kind, id, e) => {
  let v = body(e); if (canon(v).length > MAX_HIST_BYTES) v = null;                  // gros contenu (texte des IC) : seule la trace de l’écrasement reste
  return { kind, id: String(id), t: e.u || 0, by: e.ub ?? null, v };
};
const mergeTomb = (a = {}, b = {}) => {
  const out = Object.create(null);
  for (const src of [a, b]) for (const [k, v] of Object.entries(src)) if (!DANGER.has(k) && (!out[k] || (v.t || 0) > out[k].t)) out[k] = { t: v.t || 0, by: v.by ?? null };
  return { ...out };
};
const headOf = (r) => ({ ...Object.fromEntries(HEAD.filter((k) => k in r).map((k) => [k, r[k]])), u: r.u, ub: r.ub });
// rang d’un gel de jour : une copie « tardive » (app ouverte après le signal) ne remplace jamais une copie prise avant ; ensuite la plus récente
const frozenWins = (a, b) => ((a.late ? 0 : 1) - (b.late ? 0 : 1)) || wins(a, b);

export function mergeRegatta(a, b) {
  const h = [...(a.hist || []), ...(b.hist || [])];
  const ha = headOf(a), hb = headOf(b), hw = wins(ha, hb) >= 0 ? ha : hb, hl = hw === ha ? hb : ha;
  if (!sameBody(ha, hb)) h.push(hist('head', a.id, hl));
  const tomb = mergeTomb(a.tomb, b.tomb);
  const ord = cmp(a.at ?? Infinity, b.at ?? Infinity) || ((b.by != null) - (a.by != null)) || cmp(String(a.by), String(b.by));
  const first = ord <= 0 ? a : b;                                                  // le créateur : le plus ancien, à égalité celui qui a un auteur
  const out = { id: a.id, ...hw, by: first.by ?? null, at: Math.min(a.at ?? Infinity, b.at ?? Infinity) };
  if (!Number.isFinite(out.at)) out.at = 0;
  for (const [kind, key] of Object.entries(LISTS)) {
    const A = new Map((a[key] || []).map((e) => [String(e.id), e])), B = new Map((b[key] || []).map((e) => [String(e.id), e])), res = [];
    for (const id of new Set([...A.keys(), ...B.keys()])) {
      const ea = A.get(id), eb = B.get(id);
      let pick = ea && eb ? (wins(ea, eb) >= 0 ? ea : eb) : ea || eb;
      if (ea && eb && !sameBody(ea, eb)) h.push(hist(kind, id, pick === ea ? eb : ea));
      if (kind === 'trace' && ea && eb) {                                           // rapport : le plus récent (t) gagne quel que soit u
        const rp = [ea.report, eb.report].filter(Boolean).sort((x, y) => (y.t || 0) - (x.t || 0))[0];
        pick = rp ? { ...pick, report: rp } : pick;
      }
      const t = tomb[`${kind}:${id}`]?.t;
      if (t != null && t >= (pick.u || 0)) continue;                                // supprimé (et pas recréé depuis)
      res.push(pick);
    }
    out[key] = res.sort((x, y) => String(x.id) < String(y.id) ? -1 : 1);
  }
  const frozen = {}, days = new Set([...Object.keys(a.frozen || {}), ...Object.keys(b.frozen || {})]);
  for (const d of days) {
    if (DANGER.has(d)) continue;
    const fa = a.frozen?.[d], fb = b.frozen?.[d];
    frozen[d] = fa && fb ? (frozenWins(fa, fb) >= 0 ? fa : fb) : fa || fb;
  }
  out.frozen = frozen; out.tomb = tomb;
  const seen = new Set();
  out.hist = h.filter((x) => { const k = `${x.kind}|${x.id}|${x.t}|${canon(x.v)}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => (y.t - x.t) || (canon(x) < canon(y) ? -1 : 1)).slice(0, MAX_HIST);
  return out;
}

// Recalages de bouées (D-05) : { [numéro]: { lat, lon, src, t, by } | { del: true, t, by } } — le plus récent (t) gagne, 5 versions gardées
export function mergeMarks(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (DANGER.has(k)) continue;
    const ea = a[k], eb = b[k];
    if (!ea || !eb) { out[k] = ea || eb; continue; }
    const w = ((ea.t || 0) - (eb.t || 0)) || (canon(ea) < canon(eb) ? -1 : 1), win = w >= 0 ? ea : eb, lose = win === ea ? eb : ea;
    const h = [...(ea.h || []), ...(eb.h || [])];
    if (canon({ ...ea, h: 0 }) !== canon({ ...eb, h: 0 })) h.push({ lat: lose.lat ?? null, lon: lose.lon ?? null, src: lose.src ?? null, t: lose.t || 0, by: lose.by ?? null, del: !!lose.del });
    const seen = new Set(), keep = h.filter((x) => { const s = canon(x); if (seen.has(s)) return false; seen.add(s); return true; }).sort((x, y) => y.t - x.t).slice(0, 5);
    const { h: _h, ...res } = win;
    out[k] = keep.length ? { ...res, h: keep } : res;                               // jamais de `h: []` : la forme doit rester la même après chaque fusion
  }
  return out;
}

// Document partagé : { v:1, regattas: { id: R }, tomb: { 'regatta:id': {t,by} }, marks }
export const emptyDoc = () => ({ v: 1, regattas: {}, tomb: {}, marks: {} });
export function mergeDoc(a = emptyDoc(), b = emptyDoc()) {
  const tomb = mergeTomb(a.tomb, b.tomb), regattas = {};
  for (const id of new Set([...Object.keys(a.regattas || {}), ...Object.keys(b.regattas || {})])) {
    if (DANGER.has(id) || tomb[`regatta:${id}`]) continue;                          // régate supprimée : définitif sur tous les téléphones
    const ra = a.regattas?.[id], rb = b.regattas?.[id];
    regattas[id] = mergeRegatta(ra || rb, rb || ra);                                  // seule d’un côté : fusionnée avec elle-même, ce qui normalise sa forme
  }
  return { v: 1, regattas, tomb, marks: mergeMarks(a.marks, b.marks) };
}
export const docEquals = (a, b) => canon(a) === canon(b);

// ───────────────────────── marquage des modifications locales (appelé par saveReg, donc chargé avec la page : pas dans archsync.js)

// Identifiant stable d’une manche : jour + heure (une manche par jour et par heure) ; sans heure, aléatoire
export const raceId = (m, rnd = Math.random) => (m.time ? `m${String(m.date).replace(/-/g, '')}${String(m.time).replace(':', '')}` : 'm' + rnd().toString(36).slice(2, 8));
const ensureIds = (r, rnd) => (r.races || []).some((m) => !m.id) ? { ...r, races: r.races.map((m) => (m.id ? m : { ...m, id: raceId({ ...m, date: m.date || r.dateStart }, rnd) })) } : r;
const noN = ({ n, ...r }) => r;

// prev, next : une régate locale avant / après une modification ; rend `next` marqué (u = now sur ce qui a changé, pierres tombales pour ce qui a disparu)
export function stamp(prev, next, { now, by = null, rnd } = {}) {
  const n = ensureIds(next, rnd), out = { ...n };
  const hp = prev && headOf(prev);
  const hn = headOf(n);
  if (!prev || !sameBody(hp, hn)) { out.u = now; out.ub = by; } else { out.u = prev.u; out.ub = prev.ub; }
  const tomb = { ...(prev?.tomb || {}), ...(n.tomb || {}) };
  for (const [kind, key] of Object.entries(LISTS)) {
    const P = new Map((prev?.[key] || []).map((e) => [String(e.id), e]));
    const cmpBody = kind === 'race' ? (x, y) => sameBody(noN(x), noN(y)) : sameBody;       // `n` (rang d’une manche) est déduit de l’ordre : renuméroter ne modifie aucune manche
    out[key] = (n[key] || []).map((e) => {
      const p = P.get(String(e.id));
      if (p && cmpBody(p, e)) return { ...e, u: p.u, ub: p.ub };
      return { ...e, u: now, ub: by };
    });
    for (const id of P.keys()) if (!(n[key] || []).some((e) => String(e.id) === id)) tomb[`${kind}:${id}`] = { t: now, by };
  }
  const frozen = {};
  for (const [d, f] of Object.entries(n.frozen || {})) {
    const p = prev?.frozen?.[d];
    frozen[d] = p && sameBody(p, f) ? { ...f, u: p.u, ub: p.ub } : { ...f, u: now, ub: by };
  }
  out.frozen = frozen; out.tomb = tomb;
  return out;
}

// prev, next : états { list, tomb, current } avant / après ; rend { st, changed: [ids] } avec les éléments modifiés marqués
export function stampState(prev, next, { now, by = null }) {
  const old = new Map(prev.list.map((r) => [r.id, r]));
  const list = next.list.map((r) => (old.get(r.id) === r ? r : stamp(old.get(r.id), r, { now, by })));   // même objet qu’avant : rien à comparer
  const tomb = { ...(prev.tomb || {}), ...(next.tomb || {}) };
  for (const id of old.keys()) if (!list.some((r) => r.id === id)) tomb[id] = { t: now, by };
  const changed = list.filter((r) => old.get(r.id) !== r && (!old.has(r.id) || canon(toShared(r)) !== canon(toShared(old.get(r.id))))).map((r) => r.id);   // objet inchangé : rien à comparer
  if ([...old.keys()].some((id) => !list.some((r) => r.id === id))) changed.push('~tomb');
  return { st: { ...next, list, tomb }, changed };
}

// Modifications à envoyer : un compteur par clé (id de régate, « ~tomb » suppressions, « ~marks » recalages) ; on n’efface une clé que si
// personne ne l’a re-modifiée pendant l’échange (le compteur n’a pas bougé)
export function markDirty(meta, keys) { meta.seq = (meta.seq || 0) + 1; meta.dirty ||= {}; for (const k of keys) meta.dirty[k] = meta.seq; }

// Même ordre que raceOrder de js/regates.js : jour, puis heure (une manche sans heure après celles du même jour qui en ont une)
const raceOrder = (a, b) => cmp(String(a.date), String(b.date)) || ((a.time ? 0 : 1) - (b.time ? 0 : 1)) || cmp(String(a.time), String(b.time)) || cmp(String(a.id), String(b.id));
// Régate sans l’état propre à l’appareil et sans le rang des manches (avant envoi)
export const toShared = (r) => { const o = { ...r, races: (r.races || []).map(noN) }; for (const k of LOCAL_ONLY) delete o[k]; return o; };
// Fusion dans l’état local : les manches sont triées et renumérotées, `sel` (manche choisie, affichage de CET appareil) suit sa manche
export const fromShared = (shared, local) => {
  const o = { ...shared, races: [...(shared.races || [])].sort(raceOrder).map((m, i) => ({ ...m, n: i + 1 })) };
  if (local && local.sel != null) { const id = (local.races || []).find((m) => m.n === local.sel)?.id; const i = o.races.findIndex((m) => m.id === id); if (i >= 0) o.sel = i + 1; }
  return o;
};
