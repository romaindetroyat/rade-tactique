// Régates : modèle pur (stockage injecté, sans DOM) — création, statut au jour de Paris, saison, reprise des fiches IC existantes,
// manches, dates du verrou « journée de régate » et auteur. Les fonctions de mise à jour rendent un nouvel état, jamais une mutation.
// L’index (petit, lu de façon synchrone au chargement) est dans localStorage `rade.regates.v1` ; les données lourdes viendront plus tard.

import { parisClock } from './racelock.js';
import { IC as SNPM } from './courses.js';

export const KEY = 'rade.regates.v1';
export const VERSION = 1;
export const MEMBRE_KEY = 'rade.membre.v1';
const EVENTS_KEY = 'rade.events.v1';            // ancienne clé des fiches IC : lue pour la reprise, jamais écrite ni effacée
export const STATUS_LABEL = { avenir: 'À venir', aujourdhui: 'Aujourd’hui', passee: 'Passée' };
export const MAX_NAME = 80, MAX_CLUB = 40, MAX_NOTE = 200, MAX_IC_TEXT = 20000;
// Valeurs communes aux régates CVAT (signaux de départ règle 26, pavillons de classe habituels), comme js/events.js
const COMMON = { sequence: SNPM.sequence, classes: SNPM.classes, groups: SNPM.groups };

// ───────────────────────── dates

// Vrai pour une date calendaire réelle AAAA-MM-JJ (le 30 février est refusé)
export function isDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');
export const lastDay = (r) => r?.dateEnd || r?.dateStart || '';

// 'avenir' | 'aujourdhui' | 'passee' : jour de Paris de `now`, jamais l’heure ni le fuseau du téléphone ; sans date : à venir (brouillon)
export function regattaStatus(r, now) {
  if (!r?.dateStart) return 'avenir';
  const d = parisClock(now).date, end = lastDay(r);
  return d < r.dateStart ? 'avenir' : d > end ? 'passee' : 'aujourdhui';
}
// Saison = année civile du premier jour
export const seasonOf = (dateStart) => (dateStart ? String(dateStart).slice(0, 4) : '—');

// La régate d’aujourd’hui : la courante si elle l’est, sinon la première d’aujourd’hui, sinon null
export function todayRegatta({ now, list, currentId }) {
  const today = (list || []).filter((r) => regattaStatus(r, now) === 'aujourdhui');
  return today.find((r) => r.id === currentId) || today[0] || null;
}
// Dates du verrou « journée de régate » : la régate d’aujourd’hui, sinon la courante
export function lockDates({ now, list, currentId }) {
  const r = todayRegatta({ now, list, currentId }) || (list || []).find((x) => x.id === currentId) || null;
  return { raceFrom: r?.dateStart || null, raceTo: r?.dateEnd || r?.dateStart || null };
}

// ───────────────────────── reprise des fiches de rade.events.v1

// Fiche IC d’avant → régate. Ces fiches avaient été relues et enregistrées par un équipier : `validated` les marque ainsi.
export function fromEvent(ev, now, by = null) {
  const club = /CVAT/i.test(`${ev.event || ''} ${ev.source || ''} ${ev.id || ''}`) || ev.id === 'snpm-2026' ? 'CVAT' : '';
  const { id, event, date, dateEnd, source, text, ...fields } = ev;
  return {
    id: String(id), name: String(event || 'Régate').slice(0, MAX_NAME), club, dateStart: date || '', dateEnd: date && dateEnd && dateEnd > date ? dateEnd : '', season: seasonOf(date),
    races: [], ic: { fields, text: String(text || '').slice(0, MAX_IC_TEXT), source: source || '', read: 'reprise', excerpts: {}, validated: { by, at: now } },
    marks: [], courses: [], frozen: {}, traces: [], by, at: now,
  };
}

function readJSON(storage, key) {
  try { const v = storage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; /* absent ou illisible : on repart d’ailleurs */ }
}
// Écrit l’index ; faux (sans exception) si le stockage est plein ou refusé
export function saveRegattas(storage, st) {
  try { storage.setItem(KEY, JSON.stringify(st)); return true; } catch { return false; /* quota ou stockage refusé : l’état reste en mémoire */ }
}
// Lit l’index ; sinon le crée une seule fois depuis rade.events.v1 (jamais modifiée), sinon sème la Coupe SNPM comme le faisait js/events.js
export function migrate({ storage, now = Date.now(), by = null }) {
  const cur = readJSON(storage, KEY);
  if (cur && cur.v === VERSION && Array.isArray(cur.list)) return cur;
  const ev = readJSON(storage, EVENTS_KEY);
  const fiches = Array.isArray(ev?.list) && ev.list.length ? ev.list : [{ id: 'snpm-2026', ...SNPM, source: 'IC fournies (PDF)' }];
  const list = fiches.map((e) => fromEvent(e, now, by));
  const st = { v: VERSION, current: list.find((r) => r.id === ev?.current)?.id || list[0].id, list };
  saveRegattas(storage, st);
  return st;
}

// ───────────────────────── création et mise à jour de l’état

export function newId(now = Date.now(), rnd = Math.random) { return 'rg' + Number(now).toString(36) + rnd().toString(36).slice(2, 6); }

// Trois champs (nom, premier jour, club) ; dernier jour facultatif, gardé seulement s’il est postérieur au premier (D-15)
export function createRegatta({ name, dateStart, dateEnd, club } = {}, { now = Date.now(), by = null, rnd } = {}) {
  const errors = {};
  const nom = String(name ?? '').trim(), cl = String(club ?? '').trim(), d1 = String(dateStart ?? '').trim(), d2 = String(dateEnd ?? '').trim();
  if (!nom) errors.name = 'Donnez un nom à la régate.';
  else if (nom.length > MAX_NAME) errors.name = `Nom trop long (${MAX_NAME} caractères au plus).`;
  if (!d1) errors.dateStart = 'Indiquez le premier jour.';
  else if (!isDate(d1)) errors.dateStart = 'Date impossible : jour AAAA-MM-JJ attendu.';
  if (cl.length > MAX_CLUB) errors.club = `Club trop long (${MAX_CLUB} caractères au plus).`;
  if (Object.keys(errors).length) return { ok: false, regatta: null, errors };
  return {
    ok: true, errors,
    regatta: {
      id: newId(now, rnd), name: nom, club: cl, dateStart: d1, dateEnd: isDate(d2) && d2 > d1 ? d2 : '', season: seasonOf(d1),
      races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by, at: now,
    },
  };
}
export function upsertRegatta(st, r) {
  const list = st.list.some((x) => x.id === r.id) ? st.list.map((x) => (x.id === r.id ? r : x)) : [...st.list, r];
  return { ...st, list, current: st.current || r.id };
}
export function removeRegatta(st, id) {
  const list = st.list.filter((x) => x.id !== id);
  return { ...st, list, current: st.current === id || !list.some((x) => x.id === st.current) ? list[0]?.id ?? null : st.current };
}
export const setCurrent = (st, id) => (st.list.some((x) => x.id === id) ? { ...st, current: id } : st);
export const currentRegatta = (st) => st?.list?.find((x) => x.id === st.current) || st?.list?.[0] || null;

// Forme de l’ancien `IC` de js/courses.js (lue par le briefing, le chrono, le débrief) : les consommateurs existants ne changent pas
export function icOf(r) {
  const f = r?.ic?.fields || {};
  return {
    ...COMMON, firstWarning: '', lastFinishSignal: '', vhf: null, committee: '', zone: '', keyRules: [],
    ...f,
    id: r?.id, event: r?.name || '', date: r?.dateStart || '', dateEnd: r?.dateEnd || '', text: r?.ic?.text || '', source: r?.ic?.source || '',
  };
}

// Liste par saison (la plus récente d’abord), puis Aujourd’hui, À venir (date croissante), Passées (date décroissante)
export function groupBySeason(list, now) {
  const order = ['aujourdhui', 'avenir', 'passee'], seasons = new Map();
  for (const r of list || []) {
    const s = r.season || seasonOf(r.dateStart);
    if (!seasons.has(s)) seasons.set(s, { season: s, groups: new Map() });
    const g = seasons.get(s).groups, st = regattaStatus(r, now);
    if (!g.has(st)) g.set(st, []);
    g.get(st).push(r);
  }
  const cmp = (st) => (a, b) => (st === 'passee' ? -1 : 1) * String(a.dateStart || '').localeCompare(String(b.dateStart || '')) || a.name.localeCompare(b.name);
  return [...seasons.values()].sort((a, b) => b.season.localeCompare(a.season))
    .map(({ season, groups }) => ({ season, groups: order.filter((st) => groups.has(st)).map((st) => ({ status: st, label: STATUS_LABEL[st], items: groups.get(st).slice().sort(cmp(st)) })) }));
}
