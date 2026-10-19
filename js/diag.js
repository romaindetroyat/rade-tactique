// Journal de diagnostic : tampon circulaire borné, sans secret, stocké sur l’appareil (module pur, stockage injecté).
// Une erreur y est écrite tout de suite ; les informations attendent le prochain flush. Plein, le tampon sacrifie d’abord les
// informations : les erreurs restent plus longtemps. Aucune exception ne sort d’ici (stockage illisible, quota dépassé).

export const KEY = 'rade.diag.v1';
export const MAX_ENTRIES = 300, MAX_MSG = 300, MAX_BYTES = 40000;

const clip = (s, n) => String(s ?? '').slice(0, n);

// Retire d’un texte ce qui pourrait ouvrir l’app à un tiers : paramètre acces= d’une adresse, jeton long, adresse e-mail
export const scrub = (s) => clip(s, MAX_MSG)
  .replace(/([?&#]acces=)[^&\s"'<>]*/gi, '$1…')
  .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '…')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '…@…');

const CTX = { depart: 'départ', course: 'course', app: 'app' };

// Date et heure d’un instant dans un fuseau, au format jj/mm/aaaa hh:mm:ss (fr-FR) : indépendant des variantes d’ICU
export function stamp(t, tz = 'Europe/Paris') {
  const p = {};
  for (const x of new Intl.DateTimeFormat('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t))) p[x.type] = x.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

export function createDiag({ storage = null, now = Date.now, context = () => null } = {}) {
  let buf = [];
  try { const v = JSON.parse(storage?.getItem(KEY) || '[]'); if (Array.isArray(v)) buf = v.filter((e) => e && typeof e === 'object' && Number.isFinite(e.t)); } catch { buf = []; /* stockage illisible : journal vide */ }
  let dirty = false;

  // Plus de 300 entrées ou plus de 40 000 octets : les informations les plus anciennes partent avant les erreurs
  const dropOne = () => { const i = buf.findIndex((x) => x.k !== 'error'); buf.splice(i < 0 ? 0 : i, 1); };
  const size = () => JSON.stringify(buf).length;
  function fit() {
    while (buf.length > MAX_ENTRIES) dropOne();
    let s = size();
    while (s > MAX_BYTES && buf.length > 1) { dropOne(); s = size(); }
    return s;
  }
  function flush() {
    if (!dirty) return;
    dirty = false;
    try { fit(); storage?.setItem(KEY, JSON.stringify(buf)); } catch { /* quota dépassé ou stockage fermé : le journal reste en mémoire */ }
  }

  function log(kind, where, msg, extra) {
    let c = null;
    try { c = context(); } catch { /* contexte indisponible : l’entrée n’en porte pas */ }
    const e = { t: now(), k: clip(kind, 12), w: clip(where, 24), m: scrub(msg) };
    if (c) e.c = clip(c, 12);
    if (extra != null && extra !== '') {
      let x = extra;
      if (typeof x !== 'string') { try { x = JSON.stringify(x); } catch { x = String(x); /* structure circulaire */ } }
      e.x = scrub(x);
    }
    const last = buf[buf.length - 1];
    if (last && last.k === e.k && last.w === e.w && last.m === e.m && last.c === e.c) { last.n = (last.n || 1) + 1; last.t2 = e.t; }   // répétition : un compteur
    else { buf.push(e); while (buf.length > MAX_ENTRIES) dropOne(); }
    dirty = true;
    if (e.k === 'error') flush();
    return e;
  }

  function text(tz = 'Europe/Paris') {
    return buf.map((e) => {
      const rep = e.n > 1 ? ` (×${e.n})` : '';
      const where = (e.c ? `${CTX[e.c] || e.c} · ` : '') + e.w;
      return `${stamp(e.t, tz)}${rep} [${e.k}] ${where} : ${e.m}${e.x ? ' — ' + e.x : ''}`;
    }).join('\n');
  }

  return {
    log, flush, text,
    entries: () => buf.slice(),
    clear() { buf = []; dirty = true; flush(); },
  };
}
