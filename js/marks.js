// Bouées à confirmer : signalement (D-01), saisie de coordonnées, recalages mémorisés sur ce téléphone (D-04)
// et retour à la position d’origine. Module pur : le stockage est injecté, rien n’est appliqué à l’import.
// Les recalages ne sont appliqués à MARKS que par js/app.js (au démarrage, puis juste après un recalage validé) :
// les tests de référence lisent MARKS tel que courses.js le définit (Pitfall 11, T-02-16).

export const OV_KEY = 'rade.marks.v1';
export const MAX_MOVE_M = 2 * 1852;                       // au-delà : confirmation demandée (T-02-14)
export const DOUBT = (m) => m?.src === 'approx';          // D-01 : seules les positions approximatives sont à confirmer

const NUM = '\\d+(?:[.,]\\d+)?';
const TOKEN = new RegExp(`([NSEWO])?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*(?:[°º]|\\s)\\s*(?:(${NUM})\\s*['’′]?\\s*)?(?:(${NUM})\\s*(?:"|”|″|'')?\\s*)?([NSEWO])?`, 'gi');

// Lit des coordonnées (degrés décimaux, degrés-minutes ou degrés-minutes-secondes) : liste de { v, hemi }
export function parseCoord(txt) {
  const out = [], s = String(txt ?? '').replace(/;/g, ' ').trim();
  if (!/[°º'’′"”″NSEWO]/i.test(s)) {                      // décimal pur
    for (const m of s.matchAll(/-?\d+(?:[.,]\d+)?/g)) out.push({ v: parseFloat(m[0].replace(',', '.')), hemi: '' });
    return out;
  }
  for (const m of s.matchAll(TOKEN)) {
    const [, h1, d, mn, sc, h2] = m, hemi = (h1 || h2 || '').toUpperCase();
    if (d == null) continue;
    const deg = parseFloat(d.replace(',', '.'));
    if (!isFinite(deg)) continue;
    const min = mn ? parseFloat(mn.replace(',', '.')) : 0, sec = sc ? parseFloat(sc.replace(',', '.')) : 0;
    if (min >= 60 || sec >= 60) continue;                 // minutes ou secondes impossibles : valeur écartée
    let v = Math.abs(deg) + min / 60 + sec / 3600;
    if (deg < 0 || hemi === 'S' || hemi === 'W' || hemi === 'O') v = -v;
    out.push({ v, hemi });
  }
  return out;
}

// Bornes = data/meta.json (5,8-6,1 E ; 43,00-43,18 N) avec une marge de 0,1°
export function parseLatLon(txt, bounds = { south: 42.9, north: 43.28, west: 5.7, east: 6.2 }) {
  const t = parseCoord(txt);
  if (t.length !== 2) return { error: 'Deux coordonnées attendues, par exemple 43°05.845N 005°56.049E' };
  let [a, b] = t;
  if (['E', 'W', 'O'].includes(a.hemi) || ['N', 'S'].includes(b.hemi)) [a, b] = [b, a];
  if (!isFinite(a.v) || !isFinite(b.v) || a.v < bounds.south || a.v > bounds.north || b.v < bounds.west || b.v > bounds.east)
    return { error: 'Position hors de la rade de Toulon : vérifiez les degrés et l’hémisphère' };
  return { lat: +a.v.toFixed(6), lon: +b.v.toFixed(6) };
}

// Recalages mémorisés : { [numéro]: { lat, lon, src: 'trace' | 'saisie', t (ms) } }. Stockage illisible → aucun recalage.
export function loadOverrides(storage) {
  try { const o = JSON.parse(storage.getItem(OV_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  catch { return {}; }
}
export function saveOverride(storage, k, ov) {
  const all = loadOverrides(storage); all[k] = ov;
  try { storage.setItem(OV_KEY, JSON.stringify(all)); return true; } catch { return false; }
}
export function clearOverride(storage, k) {
  const all = loadOverrides(storage); delete all[k];
  try { storage.setItem(OV_KEY, JSON.stringify(all)); return true; } catch { return false; }
}

const dd = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });
// D-03 : « trace du 18/10 » ou « saisie du 19/10 » (heure de Paris)
export const srcLabel = (ov) => `${ov.src === 'trace' ? 'trace' : 'saisie'} du ${dd(ov.t)}`;

// Applique les recalages SUR PLACE (tactics.js, debrief.js et app.js relisent MARKS à chaque appel). Garde la position et la
// source d’origine dans m.base, pose m.ov = { src, t }. Renvoie les numéros appliqués ; ignore un numéro inconnu ou une position non finie.
export function applyOverrides(marks, overrides) {
  const applied = [];
  for (const [k, ov] of Object.entries(overrides || {})) {
    const m = marks[k];
    if (!m || !isFinite(ov?.lat) || !isFinite(ov?.lon) || !isFinite(ov?.t)) continue;
    m.base ??= { lat: m.lat, lon: m.lon, src: m.src };
    m.lat = ov.lat; m.lon = ov.lon; m.src = srcLabel(ov); m.ov = { src: ov.src, t: ov.t };
    applied.push(k);
  }
  return applied;
}

// Remet la position et la source d’origine (« Position d’origine ») : retire base et ov
export function restoreMark(marks, k) {
  const m = marks[k];
  if (!m?.base) return false;
  m.lat = m.base.lat; m.lon = m.base.lon; m.src = m.base.src;
  delete m.base; delete m.ov;
  return true;
}
