// Bouées et parcours d’une régate hors cahier CVAT (D-04, REG-04). Module pur : aucun stockage, aucun DOM, rien n’est appliqué à l’import.
// Les bouées lues dans les IC d’un autre club sont « à confirmer » : elles ne servent ni au routage, ni au mode départ, ni aux passages du débrief
// tant qu’un équipier ne les a pas confirmées sur la carte. Un parcours lu n’est proposé que lorsque TOUTES ses bouées sont confirmées.
// Seul js/app.js appelle applyRegattaMarks (au démarrage, au changement de régate courante, après une confirmation) : jamais ici, jamais dans un
// test sur les vraies tables (les tests travaillent sur des copies structuredClone).
//
// Forme d’une bouée de régate (r.marks[]) : { id: 'X1', name, text (position telle qu’écrite), lat, lon (nuls : « position à saisir »), excerpt,
//   status: 'a_confirmer' | 'confirmee' | 'ignoree', src, by, at, confirmed?: { by, at }, moved?: { by, at, from } }
// Forme d’un parcours de régate (r.courses[]) : { id: 101…, name, seq: [{ mark: 'X1', side: 'b' | 't' | null }], excerpt, incomplete, missing, by, at }
// Les bouées injectées dans MARKS portent `fromRegatta` (identifiant de la régate) : c’est ce qui permet de les retirer sans état caché.

import { parseLatLon, MAX_MOVE_M } from './marks.js';
import { toXY, distXY, fmtLat, fmtLon } from './geo.js';

export const MARK_PREFIX = 'X';
export const COURSE_BASE = 100;                 // identifiants numériques 101, 102… : les comparaisons `x.id === S.courseId` sont strictes
export const MAX_MARKS = 40, MAX_COURSES = 20, MAX_LEGS = 40;
const MAX_NAME = 40, MAX_TITLE = 60, MAX_EXCERPT = 300, MAX_CLUB = 40;
export const STATUS = Object.freeze({ A_CONFIRMER: 'a_confirmer', CONFIRMEE: 'confirmee', IGNOREE: 'ignoree' });

const str = (v) => (v == null ? '' : String(v).trim());
// Texte venu d’un PDF : sans caractères de contrôle ni chevrons, borné (l’affichage échappe de toute façon)
const clean = (v, max) => str(v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const hasPos = (m) => finite(m?.lat) && finite(m?.lon);

// Nom comparable : sans accents, minuscules, sans ponctuation ni mot « bouée »/« marque »
export function normName(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(?:la |le |l )?(?:bouee|marque|mark)\s+/, '');
}
// La ligne de départ ou d’arrivée n’est pas une bouée : « départ », « ligne d’arrivée », « porte… »
const LINE_WORDS = new Set(['ligne', 'de', 'd', 'la', 'le', 'depart', 'arrivee', 'start', 'finish', 'porte', 'et', 'line', 'gate', 'a']);
export const isLineName = (s) => { const w = normName(s).split(' ').filter(Boolean); return w.length > 0 && w.every((x) => LINE_WORDS.has(x)) && w.some((x) => x !== 'de' && x !== 'd' && x !== 'la' && x !== 'le' && x !== 'a'); };

// « 43°05.845N 005°56.049E » : degrés-minutes comme le cahier CVAT
export const fmtPos = (lat, lon) => `${fmtLat(lat)} ${fmtLon(lon)}`;
const SIDE_TXT = { b: ' bâbord', t: ' tribord' };
export const sideTxt = (side) => SIDE_TXT[side] || '';

// ───────────────────────── lecture depuis la relecture

const nextMarkNumber = (existing) => (existing || []).reduce((n, m) => { const k = /^X(\d+)$/.exec(m?.id || ''); return k ? Math.max(n, +k[1]) : n; }, 0) + 1;
const nextCourseId = (existing) => (existing || []).reduce((n, c) => (Number.isInteger(c?.id) ? Math.max(n, c.id) : n), COURSE_BASE) + 1;

// Bouées cochées de la relecture → bouées de régate « à confirmer ». items : [{ name, position, excerpt }] ; la position est du TEXTE recopié du PDF,
// convertie ici par parseLatLon (bornée à la rade) : illisible → lat/lon nuls (« position à saisir »), jamais devinée. Une bouée de même nom déjà
// présente n’est pas ajoutée deux fois. existing : bouées déjà dans la régate (les identifiants ne sont jamais réutilisés, même pour une bouée ignorée).
export function marksFromReview(items, { by = null, at = Date.now(), club = '', existing = [] } = {}) {
  const out = [], known = new Set((existing || []).map((m) => normName(m.name)));
  let n = nextMarkNumber(existing);
  const src = `IC ${clean(club, MAX_CLUB) || 'autre club'}`;
  for (const it of Array.isArray(items) ? items : []) {
    if ((existing.length + out.length) >= MAX_MARKS) break;
    const name = clean(it?.name, MAX_NAME);
    if (!name || known.has(normName(name))) continue;
    const text = clean(it?.position, 120), p = text ? parseLatLon(text) : { error: 'position absente' };
    known.add(normName(name));
    out.push({
      id: `${MARK_PREFIX}${n++}`, name, text, lat: p.error ? null : p.lat, lon: p.error ? null : p.lon, excerpt: clean(it?.excerpt, MAX_EXCERPT),
      status: STATUS.A_CONFIRMER, src, by, at,
    });
  }
  return out;
}

// Parcours cochés → parcours de régate. items : [{ name, sequence: [{ mark, side }], excerpt }] ; marks : bouées de la régate (les nouvelles comprises).
// Le départ et l’arrivée ne sont pas des bouées. Une bouée citée mais inconnue (nom absent de la régate) rend le parcours incomplet : jamais injecté.
export function coursesFromReview(items, marks, { by = null, at = Date.now(), existing = [] } = {}) {
  const out = [], byName = new Map();
  for (const m of marks || []) byName.set(normName(m.name), m.id);
  const ids = new Set((marks || []).map((m) => m.id));
  const taken = new Set((existing || []).map((c) => normName(c.name)));
  let id = nextCourseId(existing);
  for (const it of Array.isArray(items) ? items : []) {
    if ((existing.length + out.length) >= MAX_COURSES) break;
    const name = clean(it?.name, MAX_TITLE);
    if (!name || taken.has(normName(name))) continue;
    const seq = [], missing = [];
    for (const leg of Array.isArray(it?.sequence) ? it.sequence.slice(0, MAX_LEGS) : []) {
      const label = clean(leg?.mark, MAX_NAME);
      if (!label || isLineName(label)) continue;
      const mid = ids.has(label) ? label : byName.get(normName(label));
      if (mid) seq.push({ mark: mid, side: leg?.side === 'b' || leg?.side === 't' ? leg.side : null }); else missing.push(label);
    }
    taken.add(normName(name));
    out.push({ id: id++, name, seq, excerpt: clean(it?.excerpt, MAX_EXCERPT), incomplete: !seq.length || missing.length > 0, missing, by, at });
  }
  return out;
}

// ───────────────────────── confirmer, corriger, ignorer (nouvel objet à chaque fois)

const setMark = (r, id, fn) => ({ ...r, marks: (r.marks || []).map((m) => (m.id === id ? fn(m) : m)) });
const find = (r, id) => (r?.marks || []).find((m) => m.id === id) || null;

// Geste « Confirmer » : seulement une bouée à confirmer qui a une position (« position à saisir » ne se confirme pas)
export function confirmMark(r, id, { by = null, at = Date.now() } = {}) {
  const m = find(r, id);
  if (!m || m.status !== STATUS.A_CONFIRMER || !hasPos(m)) return r;
  return setMark(r, id, (x) => ({ ...x, status: STATUS.CONFIRMEE, confirmed: { by, at } }));
}
// « Corriger la position » : même saisie que « Recaler » (parseLatLon, bornée à la rade). Rend { ok, regatta, error?, ask? }.
// Un déplacement de plus de 2 Nq demande une confirmation (`ask` : { lat, lon, d }) puis passe avec confirmFar. La bouée reste « à confirmer »
// (ou redevient à confirmer) : seul le geste « Confirmer » la fait servir.
export function moveMark(r, id, txt, { by = null, at = Date.now(), confirmFar = false } = {}) {
  const m = find(r, id);
  if (!m || m.status === STATUS.IGNOREE) return { ok: false, regatta: r, error: 'Bouée inconnue ou ignorée' };
  const p = parseLatLon(txt);
  if (p.error) return { ok: false, regatta: r, error: p.error };
  if (hasPos(m)) {
    const d = distXY(toXY(m.lat, m.lon), toXY(p.lat, p.lon));
    if (d > MAX_MOVE_M && !confirmFar) return { ok: false, regatta: r, ask: { lat: p.lat, lon: p.lon, d } };
  }
  const from = hasPos(m) ? { lat: m.lat, lon: m.lon } : null;
  const next = setMark(r, id, (x) => {
    const { confirmed, ...rest } = x;                                   // une position changée n’est plus la position confirmée
    return { ...rest, lat: p.lat, lon: p.lon, text: clean(txt, 120), status: STATUS.A_CONFIRMER, moved: { by, at, from } };
  });
  return { ok: true, regatta: next };
}
export function ignoreMark(r, id, { by = null, at = Date.now() } = {}) {
  const m = find(r, id);
  if (!m || m.status === STATUS.IGNOREE) return r;
  const { confirmed, ...rest } = m;
  return setMark(r, id, () => ({ ...rest, status: STATUS.IGNOREE, ignored: { by, at } }));
}

// Pour la carte seulement : copies { name, lat, lon, doubt: true } des bouées à confirmer qui ont une position, par identifiant.
// Jamais ajoutées à MARKS (le routage, le mode départ et le débrief lisent MARKS).
export function pendingMarks(r) {
  const out = {};
  for (const m of r?.marks || []) if (m.status === STATUS.A_CONFIRMER && hasPos(m)) out[m.id] = { name: m.name, lat: m.lat, lon: m.lon, kind: 'speciale', color: '#f5c400', doubt: true };
  return out;
}

// Parcours en attente : bouées qui manquent encore (à confirmer, à saisir, ignorée ou inconnue)
export function waitingFor(r, course) {
  const conf = new Set((r?.marks || []).filter((m) => m.status === STATUS.CONFIRMEE && hasPos(m)).map((m) => m.id));
  return [...new Set((course?.seq || []).map((l) => l.mark))].filter((id) => !conf.has(id));
}

// ───────────────────────── injection dans les tables de marques et de parcours

const dm = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });

// Applique la régate courante SUR PLACE à `marks` et `courses` (comme applyOverrides) : retire d’abord tout ce qu’une régate y avait mis
// (entrées portant `fromRegatta`), puis ajoute les bouées CONFIRMÉES (clé X1…) et les parcours dont toutes les bouées sont confirmées.
// Rend { marks, courses, removedMarks, removedCourses, gone } : `gone` = identifiants de parcours retirés qui ne reviennent pas à l’identique
// (autre régate, bouée ignorée…) ; l’appelant ramène alors le parcours choisi au parcours 3 avant tout calcul.
export function applyRegattaMarks(marks, courses, r) {
  const removedMarks = [], prior = [];
  for (const k of Object.keys(marks)) if (marks[k]?.fromRegatta) { removedMarks.push(k); delete marks[k]; }
  for (let i = courses.length - 1; i >= 0; i--) if (courses[i]?.fromRegatta) { prior.unshift({ id: courses[i].id, from: courses[i].fromRegatta }); courses.splice(i, 1); }
  const addedMarks = [], addedCourses = [];
  if (r?.id != null) {
    for (const m of r.marks || []) {
      if (m.status !== STATUS.CONFIRMEE || !hasPos(m) || !/^X\d+$/.test(String(m.id)) || Object.hasOwn(marks, m.id)) continue;
      const by = m.confirmed?.by ? ` par ${m.confirmed.by}` : '', d = Number.isFinite(m.confirmed?.at) ? ` le ${dm(m.confirmed.at)}` : '';
      marks[m.id] = {
        name: m.name, lat: m.lat, lon: m.lon, kind: 'speciale', color: '#f5c400',
        note: m.excerpt || m.text || '', src: `${m.src || 'IC'}, confirmée${by}${d}`, fromRegatta: r.id,
      };
      addedMarks.push(m.id);
    }
    for (const c of r.courses || []) {
      if (c.incomplete || !Number.isInteger(c.id) || c.id <= COURSE_BASE || !(c.seq || []).length) continue;
      if (!c.seq.every((l) => Object.hasOwn(marks, l.mark) && marks[l.mark].fromRegatta === r.id)) continue;
      if (courses.some((x) => x.id === c.id)) continue;
      const seq = c.seq.map((l) => [l.mark, l.side || null]);
      const names = c.seq.map((l) => `${marks[l.mark].name}${SIDE_TXT[l.side] || ''}`);
      courses.push({
        id: c.id, title: `${c.name} (IC)`, custom: true, fromRegatta: r.id, seq: { G: seq, P: seq.map((x) => [...x]) },
        text: `Ligne de départ, ${names.join(', ')}, ligne d’arrivée. Parcours lu dans les IC d’un autre club, bouées confirmées sur la carte : le Comité fait foi.`,
      });
      addedCourses.push(c.id);
    }
  }
  const removedCourses = prior.map((p) => p.id);
  const gone = prior.filter((p) => !(r?.id != null && p.from === r.id && addedCourses.includes(p.id))).map((p) => p.id);
  return { marks, courses, addedMarks, addedCourses, removedMarks, removedCourses, gone };
}
