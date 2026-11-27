// Éditeur de parcours d’une régate (D-17, 08-11) : bouées ajoutées à la main (position saisie ou touchée sur la carte) et parcours saisis.
// Module pur, sans DOM ni stockage : chaque appel rend un nouvel objet, la régate reçue n’est jamais modifiée. Il ne sert que dans l’espace
// Tofinou tant que Naos ne l’ouvre pas (drapeau `editeurParcours` de js/espaces.js).
// Une bouée ajoutée entre toujours « à confirmer » : elle ne sert ni au routage, ni au mode départ, ni au débrief, ni à un parcours avant le
// geste « Confirmer » (js/regmarks.js). Un parcours saisi ne prend que des bouées CONFIRMÉES de la régate.
//
// Bouée saisie (élément de r.marks) : { id: 'X<4 chiffres>', name, text, lat, lon, excerpt: '', status: 'a_confirmer', src, origine: 'saisie' | 'carte', by, at }
// Parcours saisi (élément de r.courses) : { id: 1000…9999, name, seq: [{ mark, side: 'b' | 't' } | { mark, side: null, gate }], finish?: { kind: 'comite' | 'pres', mark },
//   laps?: 2 à 4 (absent = 1), lapLine?: false (absent = par la ligne de départ entre deux tours), origine: 'saisie', excerpt: '', incomplete: false, missing: [],
//   by, at, edited?: { by, at } }. Même forme que les parcours lus : une v43 le lit comme un parcours d’un tour titré « (IC) », bouées et côtés justes.
// Identifiants tirés au hasard parmi les libres : deux téléphones hors réseau ne créent pas le même « X3 » ou le même « 101 », qui s’écraseraient
// à la fusion de l’archive (éléments fusionnés par identifiant, js/archmerge.js).
//
// Brouillon de parcours (état de la page) : { id: null | id, name, steps: [{ kind: 'mark', mark, side } | { kind: 'gate', mark, gate }],
//   finish: { kind: 'ligne' | 'comite' | 'pres', mark }, laps: 1 à 4, lapLine: booléen }

import { normName, isLineName, clean, STATUS, MAX_MARKS, MAX_COURSES, MAX_LEGS, MARK_PREFIX } from './regmarks.js';
import { parseLatLon } from './marks.js';
import { VENUES, venueOf } from './venues.js';

export const HAND = 'saisie';                    // origine d’un parcours saisi (lue par applyRegattaMarks de js/regmarks.js)
export const LAP_MAX = 4;
const MAX_NAME = 40, MAX_TITLE = 60, MAX_TEXT = 120;
const ORIGINES = { saisie: 'position saisie', carte: 'touchée sur la carte' };
const MARK_IDS = [1000, 9999], COURSE_IDS = [1000, 9999];
const FINS = ['ligne', 'comite', 'pres'];

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const hasPos = (m) => finite(m?.lat) && finite(m?.lon);
const str = (v) => (v == null ? '' : String(v).trim());

// Nombre tiré dans [lo, hi] hors de `pris` : le tirage, puis les suivants (en boucle) ; null si tout est pris
function tire([lo, hi], pris, rnd) {
  const n = hi - lo + 1, x = Number(rnd());
  let k = Number.isFinite(x) ? Math.min(n - 1, Math.max(0, Math.floor(x * n))) : 0;
  for (let i = 0; i < n; i++, k = (k + 1) % n) if (!pris.has(lo + k)) return lo + k;
  return null;
}

// Bouées confirmées de la régate qui ont une position : seules elles entrent dans un parcours
const confirmees = (r) => new Set((r?.marks || []).filter((m) => m?.status === STATUS.CONFIRMEE && hasPos(m)).map((m) => m.id));

// ───────────────────────── bouées

// Ajoute une bouée « à confirmer ». origine : 'saisie' (position tapée) ou 'carte' (point touché) ; autre valeur → 'saisie'.
// Rend { ok: true, id, regatta } ou { ok: false, error, regatta } (régate inchangée). Position bornée au plan d’eau de la régate (venueOf).
export function addHandMark(r, { name, txt, origine } = {}, { by = null, at = Date.now(), rnd = Math.random } = {}) {
  const marks = r?.marks || [];
  const non = (error) => ({ ok: false, error, regatta: r });
  if (marks.length >= MAX_MARKS) return non(`${MAX_MARKS} bouées au plus dans une régate`);
  const brut = str(name);
  if (brut.length > MAX_NAME) return non(`Nom trop long (${MAX_NAME} caractères au plus)`);
  const nom = clean(brut, MAX_NAME);
  if (!nom) return non('Nom de la bouée à saisir');
  if (isLineName(nom)) return non('La ligne de départ ou d’arrivée n’est pas une bouée : donnez un autre nom');
  if (marks.some((m) => m?.status !== STATUS.IGNOREE && normName(m?.name) === normName(nom))) return non(`Une bouée « ${nom} » existe déjà dans la régate`);
  const p = parseLatLon(String(txt ?? ''), VENUES[venueOf(r)].inputBounds);
  if (p.error) return non(p.error);
  const pris = new Set(marks.map((m) => { const k = /^X(\d+)$/.exec(String(m?.id ?? '')); return k ? +k[1] : null; }).filter((x) => x != null));
  const n = tire(MARK_IDS, pris, rnd);
  if (n == null) return non(`${MAX_MARKS} bouées au plus dans une régate`);
  const o = Object.hasOwn(ORIGINES, origine) ? origine : 'saisie';
  const id = `${MARK_PREFIX}${n}`;
  const mark = { id, name: nom, text: clean(txt, MAX_TEXT), lat: p.lat, lon: p.lon, excerpt: '', status: STATUS.A_CONFIRMER, src: ORIGINES[o], origine: o, by, at };
  return { ok: true, id, regatta: { ...r, marks: [...marks, mark] } };
}

// ───────────────────────── parcours : brouillon, contrôles, enregistrement

// Brouillon vide (id null) ou celui d’un parcours de la régate (lu ou saisi) ; null si le parcours n’existe pas
export function courseDraft(r, id = null) {
  if (id == null) return { id: null, name: '', steps: [{ kind: 'mark', mark: '', side: '' }], finish: { kind: 'ligne', mark: '' }, laps: 1, lapLine: true };
  const c = (r?.courses || []).find((x) => x.id === id);
  if (!c) return null;
  const steps = (c.seq || []).map((l) => (l?.gate ? { kind: 'gate', mark: l.mark, gate: l.gate } : { kind: 'mark', mark: l?.mark ?? '', side: l?.side === 'b' || l?.side === 't' ? l.side : '' }));
  const fin = c.finish && (c.finish.kind === 'comite' || c.finish.kind === 'pres') ? { kind: c.finish.kind, mark: c.finish.mark } : { kind: 'ligne', mark: '' };
  const laps = Number.isInteger(c.laps) && c.laps >= 2 && c.laps <= LAP_MAX ? c.laps : 1;
  return { id: c.id, name: c.name ?? '', steps, finish: fin, laps, lapLine: c.lapLine !== false };
}

// Erreurs par champ, en français : { name, steps, 'step.<rang>', finish, laps, lapLine } ; {} si le brouillon est enregistrable
export function checkCourseDraft(r, d) {
  const e = {}, ok = confirmees(r);
  const nom = str(d?.name);
  if (!nom) e.name = 'Nom du parcours à saisir';
  else if (nom.length > MAX_TITLE) e.name = `Nom trop long (${MAX_TITLE} caractères au plus)`;
  else if ((r?.courses || []).some((c) => c.id !== d?.id && normName(c.name) === normName(clean(nom, MAX_TITLE)))) e.name = 'Un autre parcours de la régate porte déjà ce nom';
  const steps = Array.isArray(d?.steps) ? d.steps : [];
  if (!steps.length) e.steps = 'Ajoutez au moins une étape (bouée ou porte)';
  else if (steps.length > MAX_LEGS) e.steps = `${MAX_LEGS} étapes au plus`;
  else {
    steps.forEach((s, i) => {
      const k = `step.${i}`;
      if (s?.kind === 'mark') {
        if (!ok.has(s.mark)) e[k] = 'Choisissez une bouée confirmée de la régate';
        else if (s.side !== 'b' && s.side !== 't') e[k] = 'Côté à choisir : bâbord ou tribord';
      } else if (s?.kind === 'gate') {
        if (!ok.has(s.mark) || !ok.has(s.gate)) e[k] = 'Porte : choisissez deux bouées confirmées de la régate';
        else if (s.mark === s.gate) e[k] = 'Porte : deux bouées différentes';
      } else e[k] = 'Étape illisible : choisissez une bouée ou une porte';
    });
  }
  const f = d?.finish;
  if (!f || !FINS.includes(f.kind)) e.finish = 'Arrivée à choisir';
  else if (f.kind !== 'ligne' && !ok.has(f.mark)) e.finish = 'Arrivée : choisissez une bouée confirmée de la régate';
  const n = typeof d?.laps === 'number' ? d.laps : NaN;
  if (!Number.isInteger(n) || n < 1 || n > LAP_MAX) e.laps = `Tours : de 1 à ${LAP_MAX}`;
  if (typeof d?.lapLine !== 'boolean') e.lapLine = 'Passage entre deux tours à choisir';
  return e;
}

// Enregistre le brouillon : nouveau parcours (identifiant entier libre de 1000 à 9999, hors de la régate et de `taken`, les identifiants de la
// table des parcours) ou modification (même identifiant, auteur et date de création gardés, `edited`). Un parcours lu modifié devient saisi.
// Rend { ok: true, id, regatta } ou { ok: false, errors, regatta } (régate inchangée).
export function saveCourseDraft(r, d, { by = null, at = Date.now(), rnd = Math.random, taken = [] } = {}) {
  const courses = r?.courses || [];
  const non = (errors) => ({ ok: false, errors, regatta: r });
  const errors = checkCourseDraft(r, d);
  if (Object.keys(errors).length) return non(errors);
  const old = d.id != null ? courses.find((c) => c.id === d.id) : null;
  if (d.id != null && !old) return non({ course: 'Parcours introuvable : il a peut-être été supprimé sur un autre téléphone.' });
  let id = old?.id;
  if (!old) {
    if (courses.length >= MAX_COURSES) return non({ course: `${MAX_COURSES} parcours au plus dans une régate` });
    id = tire(COURSE_IDS, new Set([...courses.map((c) => c.id), ...(taken || [])].filter(Number.isInteger)), rnd);
    if (id == null) return non({ course: 'Plus d’identifiant de parcours libre' });
  }
  const seq = d.steps.map((s) => (s.kind === 'gate' ? { mark: s.mark, side: null, gate: s.gate } : { mark: s.mark, side: s.side }));
  const n = d.laps;
  const c = {
    id, name: clean(d.name, MAX_TITLE), seq,
    ...(d.finish.kind !== 'ligne' ? { finish: { kind: d.finish.kind, mark: d.finish.mark } } : {}),
    ...(n > 1 ? { laps: n } : {}), ...(n > 1 && d.lapLine === false ? { lapLine: false } : {}),
    origine: HAND, excerpt: '', incomplete: false, missing: [],
    by: old ? old.by ?? null : by, at: old ? old.at ?? at : at, ...(old ? { edited: { by, at } } : {}),
  };
  return { ok: true, id, regatta: { ...r, courses: old ? courses.map((x) => (x.id === id ? c : x)) : [...courses, c] } };
}

// Retire un parcours de la régate (la pierre tombale est posée par le marquage de l’archive, stampState)
export function removeCourse(r, id) {
  return { ...r, courses: (r?.courses || []).filter((c) => c.id !== id) };
}
