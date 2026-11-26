// Régates : modèle pur (stockage injecté, sans DOM) — création, statut au jour de Paris, saison, reprise des fiches IC existantes,
// manches, dates du verrou « journée de régate », règle d’ouverture et auteur. Les fonctions de mise à jour rendent un nouvel état, jamais une mutation.
// L’index (petit, lu de façon synchrone au chargement) est dans localStorage `rade.regates.v1` ; les données lourdes viendront plus tard.
// La régate OUVERTE à l’écran n’est pas dans l’index : c’est un état de la page (js/app.js), oublié à chaque lancement et jamais partagé (D-A4).

import { parisClock } from './racelock.js';
import { IC as SNPM } from './courses.js';
import { cleanBan } from './banane.js';
import { raceId, VENUE_IDS } from './archmerge.js';

export const KEY = 'rade.regates.v1';
export const VERSION = 1;
export const MEMBRE_KEY = 'rade.membre.v1';
const EVENTS_KEY = 'rade.events.v1';            // ancienne clé des fiches IC : lue pour la reprise, jamais écrite ni effacée
export const STATUS_LABEL = { avenir: 'En préparation', aujourdhui: 'En cours', passee: 'Terminée' };
export const GROUP_LABEL = { avenir: 'En préparation', aujourdhui: 'En cours', passee: 'Terminées' };
export const MAX_NAME = 80, MAX_CLUB = 40, MAX_NOTE = 200, MAX_IC_TEXT = 20000;
// Valeurs communes aux régates CVAT (signaux de départ règle 26, pavillons de classe habituels), comme js/events.js : mêlées aux fiches de
// l’espace Naos seulement (08-04, D-05). Réglage du module posé une fois par js/app.js (`setCommuns`), Naos par défaut ; hors de Naos, une fiche
// n’a que ce que ses IC disent (listes vides sinon).
const COMMON = { sequence: SNPM.sequence, classes: SNPM.classes, groups: SNPM.groups };
const SANS_COMMUN = { sequence: [], classes: [], groups: [] };
let communs = true;
export const setCommuns = (oui) => { communs = oui !== false; };
// Graines de l’espace (identifiants des fiches semées) : celles de Naos par défaut (js/espaces.js, ESPACES.naos.graines)
const GRAINES_NAOS = ['snpm-2026', 'gpen-2027'];
const seme = (graines, id) => (Array.isArray(graines) ? graines : GRAINES_NAOS).includes(id);

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

// La régate d’aujourd’hui : l’ouverte si elle l’est, sinon la première d’aujourd’hui, sinon null. `currentId` (la régate ouverte) ne sert
// qu’à départager deux régates du même jour : sans régate ouverte, la première du jour est retenue.
export function todayRegatta({ now, list, currentId }) {
  const today = (list || []).filter((r) => regattaStatus(r, now) === 'aujourdhui');
  return today.find((r) => r.id === currentId) || today[0] || null;
}
// Dates du verrou « journée de régate » : la régate d’aujourd’hui dans la liste, ouverte ou non. Le verrou ne dépend pas de la régate ouverte
// à l’écran (CONTEXT, contraintes) ; l’ancien repli sur la courante ne verrouillait jamais (le verrou ne lit que isRaceDay).
export function lockDates({ now, list }) {
  const r = todayRegatta({ now, list });
  return { raceFrom: r?.dateStart || null, raceTo: r?.dateEnd || r?.dateStart || null };
}
// Régate d’id donné, sinon null : jamais de repli sur la première
export function openRegatta(list, id) {
  if (id == null) return null;
  return (list || []).find((r) => r.id === id) || null;
}
// D-A3, D-A4 : au lancement, la régate d’aujourd’hui (jour de Paris), sinon aucune (entraînement libre). Aucune mémoire d’un lancement à l’autre.
// Plan d’eau (07-05, D-05) : `here(r)` dit si la régate se court sur le plan d’eau chargé ; la régate du jour d’un autre plan d’eau n’est pas ouverte.
// `reopen` : régate demandée par « Passer » juste avant le rechargement (lue une seule fois par l’appelant), ouverte si elle est ici.
export function openAtBoot({ now, list, here = () => true, reopen = null }) {
  const again = reopen != null ? openRegatta(list, reopen) : null;
  if (again && here(again)) return again.id;
  const r = todayRegatta({ now, list });
  return r && here(r) ? r.id : null;
}
// Passage de jour sans relance (iOS reprend l’app installée sans la relancer) : au premier jour de Paris nouveau qui porte une régate, elle est ouverte
// (celle déjà ouverte si elle en fait partie) ; un nouveau jour sans régate garde l’état ouvert, l’écran n’est jamais retiré sous les doigts.
// Rend { day, openId } : `day` est le jour de Paris de `now`, à mémoriser par l’appelant quand la fonction a pu s’appliquer.
export function openOnNewDay({ now, list, openId = null, day }) {
  const d = parisClock(now).date;
  if (d === day) return { day, openId };
  const today = (list || []).filter((r) => regattaStatus(r, now) === 'aujourdhui');
  if (!today.length) return { day: d, openId };
  return { day: d, openId: today.find((r) => r.id === openId)?.id ?? today[0].id };
}

// ───────────────────────── reprise des fiches de rade.events.v1

// La Coupe SNPM semée dans l’app (js/courses.js) est la MÊME fiche sur les trois téléphones : elle prend un instant commun (le 18/10/2026 à 00 h 00,
// heure de Paris, heure d’été) au lieu de celui de l’installation, et sa validation n’a pas d’auteur. Sans cela, la première synchronisation de
// trois téléphones écrirait une ligne d’historique pour une fiche que personne n’a touchée (archive partagée, Pitfall 7).
export const SEED_ID = 'snpm-2026';
export const SEED_AT = Date.UTC(2026, 9, 17, 22, 0, 0);

// Fiche IC d’avant → régate. Ces fiches avaient été relues et enregistrées par un équipier : `validated` les marque ainsi.
export function fromEvent(ev, now, by = null) {
  const club = /CVAT/i.test(`${ev.event || ''} ${ev.source || ''} ${ev.id || ''}`) || ev.id === SEED_ID ? 'CVAT' : '';
  const { id, event, date, dateEnd, source, text, ...fields } = ev;
  const seed = String(id) === SEED_ID, at = seed ? SEED_AT : now;
  return {
    id: String(id), name: String(event || 'Régate').slice(0, MAX_NAME), club, dateStart: date || '', dateEnd: date && dateEnd && dateEnd > date ? dateEnd : '', season: seasonOf(date),
    races: [], ic: { fields, text: String(text || '').slice(0, MAX_IC_TEXT), source: source || '', read: 'reprise', excerpts: {}, validated: { by: seed ? null : by, at } },
    marks: [], courses: [], frozen: {}, traces: [], by, at,
  };
}
// Une graine déjà présente sur un téléphone et jamais revalidée (`ic.read === 'reprise'`) est ramenée à la graine commune ; une fiche relue
// (autre lecture) et toute autre régate restent le même objet, un état inchangé aussi.
export function seedNorm(st, { graines } = {}) {
  if (!seme(graines, SEED_ID)) return st;                    // espace sans la Coupe SNPM : sans effet
  let changed = false;
  const list = (st?.list || []).map((r) => {
    if (r.id !== SEED_ID || r.ic?.read !== 'reprise') return r;
    const v = r.ic.validated;
    if (r.at === SEED_AT && v && v.at === SEED_AT && v.by == null) return r;
    changed = true;
    return { ...r, at: SEED_AT, ic: { ...r.ic, validated: { by: null, at: SEED_AT } } };
  });
  return changed ? { ...st, list } : st;
}

// ───────────────────────── fiche « GPEN 2027 — J80 » semée (07-09, D-08)
// Même fiche sur les trois téléphones (identifiant, instant et dates de modification fixes, sans auteur), comme la Coupe SNPM : la semer ne crée
// aucune modification à envoyer. Règles des IC 2022-2026 (07-RESEARCH § B.2-B.4), supposées identiques en 2027 et dites telles.
export const GPEN_ID = 'gpen-2027';
export const GPEN_AT = Date.UTC(2026, 10, 19, 0, 0, 0);
export const GPEN_SEED_KEY = 'rade.seed.gpen.v1';
export const GPEN_IC = Object.freeze({
  event: 'GPEN 2027 — J80',
  firstWarning: '',
  lastFinishSignal: '',
  vhf: 14,
  committee: '',
  zone: 'Zone A — École Navale : cercle de 1,2 NM centré 48°17,890 N 004°21,630 W',
  classes: [['J80', 'Sigle J80']],
  groups: ['J80'],
  sequence: [
    ['H−7', 'Pavillon orange + son', 'Course bientôt (au moins 2 min avant l’avertissement)'],
    ['H−5', 'Pavillon de classe (Sigle J80) + son', 'Avertissement'],
    ['H−4', 'P, I, Z, U ou Noir + son', 'Préparatoire'],
    ['H−1', 'Affalé du préparatoire + son', 'Dernière minute'],
    ['H', 'Pavillon de classe affalé + son', 'Départ'],
  ],
  keyRules: [
    'D’après les IC 2026 : à mettre à jour avec les IC 2027 (fin avril 2027).',
    'Zone A — École Navale : cercle de 1,2 NM centré 48°17,890 N 004°21,630 W. VHF 14 ; signaux à terre à l’École navale, sur le bâtiment « Albatros » (IC 5.1.1).',
    'Pavillon orange avec un son au moins 2 min avant le signal d’avertissement (IC 6.1) ; après l’Aperçu à terre, pas d’avertissement moins d’une heure après son amené (IC 5.2).',
    'Départ entre le mât à pavillon orange du bateau comité (à tribord) et la marque de départ blanche ou un viseur (à bâbord). DNS sans instruction au-delà de 4 min après son signal de départ (IC 12.4).',
    'Parcours 1 (flamme numérique n° 1) : Départ – 1 – 2 – 3S/3P – 1 – 2 – 3P – Arrivée. Parcours 2 (flamme n° 2) : trois tours. Marques 1 et 2 à bâbord ; marques de parcours orange, changement de parcours vert, arrivée blanche (IC 10, annexe 3.1).',
    'Arrivée entre le mât à pavillon bleu et la marque d’arrivée, à droite du comité (IC 14.1, annexe 3.1).',
    'Une marque peut être déplacée de ±10° et d’environ 200 m sans signal de changement (IC 13.2). Changement signalé à la porte 3 : seule la marque 1 est remouillée ; à la marque 2 : la porte devient une seule marque 3P à bâbord (IC 13.3).',
    'Pénalité d’un tour au lieu de deux (RCV 44.1 modifiée, IC 15.1).',
    'Jugement semi-direct possible en zone A : héler « Protest » et montrer un pavillon rouge ; le juge répond pavillon vert et blanc (pas de pénalité) ou rouge (pénalité) (IC 15.2, annexe 2).',
    'Temps limites J80 : 90 min pour le premier, 20 min après le premier, sinon DNF (IC 16).',
    'Classement : 3 courses pour valider la compétition ; une course retirée dès 4 courses (IC 18).',
    'Bout-dehors sorti seulement pour établir et porter le spi (IC 19.3) ; gilet (EIF) obligatoire du départ sur l’eau au retour à terre (IC 19.2).',
    'Réclamations : 60 min après que le dernier bateau a fini la dernière course du jour ; jury à l’École navale, bâtiment Ailée (IC 17).',
    'Zones interdites : autour de l’Île Longue (marques spéciales 0 à 10) et entre la cardinale de Pen ar Vir et la pointe du même nom (IC annexe 5).',
    'Parcours Virginie Hériot (pavillon jaune + pavillon GPEN) : Départ – 1 – 2 – 3S/3P – 1 – 2 – 3S/3P – arrivée décalée entre une bouée blanche à laisser à bâbord et un mât à terre (pavillon bleu) devant la chapelle de l’École navale ; dans l’app, parcours « GPEN — Virginie Hériot », position de l’arrivée à confirmer.',
  ],
});
// Fiche neuve (objet frais à chaque appel, jamais partagé entre deux états)
export function gpenSeed() {
  return {
    id: GPEN_ID, name: 'GPEN 2027 — J80', club: 'AGPEN — École navale', dateStart: '2027-05-05', dateEnd: '2027-05-09', season: seasonOf('2027-05-05'),
    races: [], ic: { fields: structuredClone({ ...GPEN_IC }), text: '', source: 'IC du GPEN 2026 (agpen.fr)', read: 'semee', excerpts: {}, validated: { by: null, at: GPEN_AT } },
    marks: [], courses: [], frozen: {}, traces: [], by: null, at: GPEN_AT, venue: 'brest', u: GPEN_AT, ub: null, vu: GPEN_AT, tomb: {}, hist: [],
  };
}
// Sème la fiche si elle manque, si l’index n’en porte pas la pierre tombale et si le marqueur local n’est pas posé (une fiche supprimée par
// l’équipage ne revient jamais) ; pose le marqueur ensuite (et quand la fiche est déjà là ou supprimée). Rend le même objet si rien ne change.
export function seedGpen(st, { storage = null, graines } = {}) {
  if (!seme(graines, GPEN_ID)) return st;                    // espace sans le GPEN : ni fiche ni marqueur
  const list = st?.list || [];
  const has = list.some((r) => r.id === GPEN_ID), tomb = !!(st?.tomb?.[GPEN_ID] || st?.tomb?.[`regatta:${GPEN_ID}`]);
  let mark = null;
  try { mark = storage?.getItem(GPEN_SEED_KEY) ?? null; } catch { mark = null; /* stockage illisible : l’index décide seul */ }
  const pose = () => { try { storage?.setItem(GPEN_SEED_KEY, '1'); } catch { /* stockage refusé : l’index garde la fiche ou sa pierre tombale */ } };
  if (has || tomb || mark) { if (!mark) pose(); return st; }
  const next = { ...st, list: [...list, gpenSeed()] };
  pose();
  return next;
}

function readJSON(storage, key) {
  try { const v = storage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; /* absent ou illisible : on repart d’ailleurs */ }
}
// Écrit l’index (sans régate ouverte : D-A4) ; faux (sans exception) si le stockage est plein ou refusé
export function saveRegattas(storage, st) {
  try { const { current, ...index } = st; storage.setItem(KEY, JSON.stringify(index)); return true; } catch { return false; /* quota ou stockage refusé : l’état reste en mémoire */ }
}
// Lit l’index ; sinon le crée une seule fois depuis rade.events.v1 (jamais modifiée), sinon sème la Coupe SNPM comme le faisait js/events.js.
// L’état rendu n’a jamais de clé `current` : un index d’avant (v36) qui en portait une est réécrit une seule fois sans elle, donc plus aucune
// régate n’est ouverte d’office (D-A4, D-A5). Les régates, elles, ne bougent pas.
// Hors de Naos (`graines` sans la Coupe SNPM) : ni graine ni reprise des fiches rade.events.v1 (fiches CVAT de Naos), index vide.
export function migrate({ storage, now = Date.now(), by = null, graines }) {
  const cur = readJSON(storage, KEY);
  if (cur && cur.v === VERSION && Array.isArray(cur.list)) {
    if (!('current' in cur)) return cur;
    const { current, ...index } = cur;
    saveRegattas(storage, index);
    return index;
  }
  if (!seme(graines, SEED_ID)) { const vide = { v: VERSION, list: [] }; saveRegattas(storage, vide); return vide; }
  const ev = readJSON(storage, EVENTS_KEY);
  const fiches = Array.isArray(ev?.list) && ev.list.length ? ev.list : [{ id: 'snpm-2026', ...SNPM, source: 'IC fournies (PDF)' }];
  const list = fiches.map((e) => fromEvent(e, now, by));
  const st = { v: VERSION, list };
  saveRegattas(storage, st);
  return st;
}

// ───────────────────────── création et mise à jour de l’état

export function newId(now = Date.now(), rnd = Math.random) { return 'rg' + Number(now).toString(36) + rnd().toString(36).slice(2, 6); }

// Trois champs (nom, premier jour, club) ; dernier jour facultatif, gardé seulement s’il est postérieur au premier (D-15).
// Plan d’eau (D-06) : liste blanche ; écrit seulement hors de Toulon (absent = Toulon) : une régate de Toulon reste exactement celle de la v42
export function createRegatta({ name, dateStart, dateEnd, club, venue } = {}, { now = Date.now(), by = null, rnd } = {}) {
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
      races: [], ic: null, marks: [], courses: [], frozen: {}, traces: [], by, at: now, ...(VENUE_IDS.includes(venue) && venue !== 'toulon' ? { venue } : {}),
    },
  };
}
export function upsertRegatta(st, r) {
  const list = st.list.some((x) => x.id === r.id) ? st.list.map((x) => (x.id === r.id ? r : x)) : [...st.list, r];
  return { ...st, list };
}
export function removeRegatta(st, id) {
  return { ...st, list: st.list.filter((x) => x.id !== id) };
}

// Forme de l’ancien `IC` de js/courses.js (lue par le briefing, le chrono, le débrief) : les consommateurs existants ne changent pas
export function icOf(r) {
  const f = r?.ic?.fields || {};
  return {
    ...(communs ? COMMON : SANS_COMMUN), firstWarning: '', lastFinishSignal: '', vhf: null, committee: '', zone: '', keyRules: [],
    ...f,
    id: r?.id, event: r?.name || '', date: r?.dateStart || '', dateEnd: r?.dateEnd || '', text: r?.ic?.text || '', source: r?.ic?.source || '',
  };
}

// Liste classée En préparation, En cours, Terminées (D-A2) : seuls les groupes non vides ; En préparation en dates croissantes (sans date en dernier),
// Terminées en dates décroissantes, à date égale par nom. L’année reste lisible dans chaque ligne.
export function groupByStatus(list, now) {
  const order = ['avenir', 'aujourdhui', 'passee'], groups = new Map();
  for (const r of list || []) {
    const st = regattaStatus(r, now);
    if (!groups.has(st)) groups.set(st, []);
    groups.get(st).push(r);
  }
  const date = (r) => String(r.dateStart || '');
  const cmp = (st) => (a, b) => {
    if (st === 'avenir' && !date(a) !== !date(b)) return date(a) ? -1 : 1;
    return (st === 'passee' ? -1 : 1) * date(a).localeCompare(date(b)) || String(a.name).localeCompare(String(b.name));
  };
  return order.filter((st) => groups.has(st)).map((st) => ({ status: st, label: GROUP_LABEL[st], items: groups.get(st).slice().sort(cmp(st)) }));
}

// ───────────────────────── manches

// Jours de la régate (premier au dernier), AAAA-MM-JJ
export function daysOf(r) {
  if (!isDate(r?.dateStart)) return [];
  const out = [], end = isDate(lastDay(r)) ? lastDay(r) : r.dateStart;
  for (let t = Date.parse(r.dateStart + 'T12:00:00Z'), i = 0; i < 31; t += 864e5, i++) { const d = new Date(t).toISOString().slice(0, 10); if (d > end) break; out.push(d); }
  return out;
}
// Ordre des manches : jour, puis heure ; une manche sans heure après celles du même jour qui en ont une
const raceOrder = (a, b) => String(a.date).localeCompare(String(b.date)) || (a.time ? 0 : 1) - (b.time ? 0 : 1) || String(a.time).localeCompare(String(b.time));

// Champs d’une manche vérifiés : { date, time, courseId, cls, laps, note }. `courses` = parcours connus ([{ id }]). Un parcours vide est accepté (à préciser).
// Rend { errors, v } : mêmes règles pour l’ajout et la modification.
function checkRace(r, race, courses) {
  const errors = {};
  const date = race.date ? String(race.date) : r.dateStart;
  if (!daysOf(r).includes(date)) errors.date = 'Ce jour ne fait pas partie de la régate.';
  const time = String(race.time ?? '').trim();
  if (time && !isTime(time)) errors.time = 'Heure impossible (HH:MM).';
  let courseId = null;
  if (race.courseId != null && race.courseId !== '') {
    const c = courses.find((x) => String(x.id) === String(race.courseId));
    if (c) courseId = c.id; else errors.courseId = 'Parcours inconnu.';
  }
  const cls = race.cls == null || race.cls === '' ? 'G' : String(race.cls);
  if (cls !== 'G' && cls !== 'P') errors.cls = 'Classe G ou P.';
  const lapsRaw = race.laps == null || race.laps === '' ? 2 : Number(race.laps);
  if (!Number.isInteger(lapsRaw) || lapsRaw < 1 || lapsRaw > 4) errors.laps = 'Tours : de 1 à 4.';
  const note = String(race.note ?? '').trim();
  if (note.length > MAX_NOTE) errors.note = `Note trop longue (${MAX_NOTE} caractères au plus).`;
  return { errors, v: { date, time, courseId, cls, laps: lapsRaw, note } };
}
// Trie et renumérote les manches ; la manche choisie (sel) suit sa nouvelle place : chaque manche porte une étiquette temporaire d’origine `_o`
function resort(r, tagged) {
  const sorted = tagged.sort(raceOrder);
  const races = sorted.map(({ _o, ...m }, i) => ({ ...m, n: i + 1 }));
  const next = { ...r, races };
  if (r.sel != null) { const i = sorted.findIndex((m) => m._o === r.sel); if (i >= 0) next.sel = i + 1; else delete next.sel; }
  return next;
}

// Ajoute une manche : { date, time, courseId, cls, laps, note }. `courses` = parcours connus ([{ id }]). Un parcours vide est accepté (à préciser).
export function addRace(r, race = {}, { now = Date.now(), by = null, courses = [] } = {}) {
  const { errors, v } = checkRace(r, race, courses);
  if (Object.keys(errors).length) return { ok: false, regatta: r, errors };
  // réglages de la banane gardés avec la manche (D-04), facultatifs : une manche sans eux garde la forme v37, qu’une v37 lit sans peine (D-09)
  const ban = race.ban && typeof race.ban === 'object' ? { ban: cleanBan(race.ban) } : {};
  const tagged = [...(r.races || []).map((m) => ({ ...m, _o: m.n })), { n: 0, ...v, by, at: now, ...ban, _o: 0 }];
  return { ok: true, regatta: resort(r, tagged), errors };
}

// Modifie une manche, désignée par son rang `n` (nombre) ou son identifiant `id` (texte) : mêmes champs et mêmes règles qu’addRace. Un champ absent
// de `race` garde sa valeur ; `ban` : objet = réglages de banane (bornés), null = retirés, absent = gardés.
// Fusion (js/archmerge.js) : même jour et même heure → même identifiant, la modification est datée par stamp (u/ub) et la plus récente gagne sur les
// autres téléphones. Jour ou heure changés → l’identifiant (jour + heure) change : la manche est DÉPLACÉE (nouvel élément, l’ancien reçoit une pierre
// tombale au marquage, son contenu va dans l’historique de la fiche) ; elle prend l’auteur et l’instant du déplacement, comme le serveur la signera.
// Refusée si une autre manche a déjà ce jour et cette heure : rien n’est jamais écrasé.
export function updateRace(r, key, race = {}, { now = Date.now(), by = null, courses = [], rnd = Math.random } = {}) {
  const list = r.races || [];
  const old = typeof key === 'string' ? list.find((m) => m.id === key) : list.find((m) => m.n === key);
  if (!old) return { ok: false, regatta: r, errors: { race: 'Manche introuvable : elle a peut-être été supprimée sur un autre téléphone.' } };
  const src = { date: old.date, time: old.time, courseId: old.courseId, cls: old.cls, laps: old.laps, note: old.note, ...race };
  const { errors, v } = checkRace(r, src, courses);
  if (v.time && !errors.date && !errors.time) {
    const autre = list.find((m) => m !== old && m.date === v.date && m.time === v.time);
    if (autre) errors.time = `La manche ${autre.n} a déjà ce jour et cette heure : changez l’heure, ou modifiez ou supprimez l’autre manche.`;
  }
  if (Object.keys(errors).length) return { ok: false, regatta: r, errors };
  const { ban: oldBan, _o, ...base } = old;
  let ban = oldBan && typeof oldBan === 'object' ? { ban: cleanBan(oldBan) } : {};
  if ('ban' in race) ban = race.ban && typeof race.ban === 'object' ? { ban: cleanBan(race.ban) } : {};
  const moved = v.date !== old.date || v.time !== String(old.time ?? '').trim();
  const m = { ...base, ...v, ...ban };
  if (moved && old.id != null) {
    // nouvel identifiant : jour + heure, ou aléatoire pour une manche qui perd son heure (sans heure, l’ancien identifiant aléatoire reste valable)
    if (v.time || old.time) m.id = raceId({ date: v.date, time: v.time }, rnd);
    if (m.id !== old.id) {
      const { n, u, ub, by: _b, ...ancien } = old;
      const t = Number.isFinite(u) ? u : Number.isFinite(old.at) ? old.at : 0;
      Object.assign(m, { by, at: now });
      delete m.u; delete m.ub;
      const trace = { kind: 'race', id: String(old.id), t, by: ub ?? old.by ?? null, v: ancien };
      return { ok: true, moved: true, regatta: { ...resort(r, list.map((x) => (x === old ? { ...m, _o: x.n } : { ...x, _o: x.n }))), hist: [...(r.hist || []), trace] }, errors };
    }
  }
  return { ok: true, moved: false, regatta: resort(r, list.map((x) => (x === old ? { ...m, _o: x.n } : { ...x, _o: x.n }))), errors };
}
// Retire la manche n et renumérote ; la manche choisie suit sa nouvelle place (ou disparaît avec elle)
export function removeRace(r, n) {
  const races = (r.races || []).filter((m) => m.n !== n).map((m, i) => ({ ...m, n: i + 1 }));
  const next = { ...r, races };
  if (r.sel != null && r.sel !== n) next.sel = r.sel > n ? r.sel - 1 : r.sel; else delete next.sel;
  return next;
}
// Réglages de l’app pour une manche : l’heure de départ = signal d’avertissement + 5 min (comme « Caler le départ sur ces IC »)
export function raceSettings(race) {
  const out = {};
  if (race.courseId != null && race.courseId !== '') out.courseId = race.courseId;
  if (race.cls) out.cls = race.cls;
  if (race.laps) out.laps = race.laps;
  if (race.date) out.day = race.date;
  if (isTime(race.time)) { const [h, m] = race.time.split(':').map(Number); out.startTime = (h * 60 + m + 5) / 60; }
  if (race.ban && typeof race.ban === 'object') out.ban = cleanBan(race.ban);       // banane de la manche (D-04), bornée : elle peut venir d’un autre téléphone
  return out;
}

// ───────────────────────── auteur (D-05)

// Prénom donné par le middleware, gardé sur l’appareil pour le hors-réseau ; null si inconnu ou stockage illisible
export function membre(storage) {
  try { const v = storage.getItem(MEMBRE_KEY); return validName(v) ? v.trim() : null; } catch { return null; /* stockage illisible : auteur inconnu */ }
}
const validName = (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 40 && /^[\p{L}\p{M} '’-]+$/u.test(v.trim()) && /\p{L}/u.test(v);
export function saveMembre(storage, nom) {
  if (!validName(nom)) return false;
  try { storage.setItem(MEMBRE_KEY, nom.trim()); return true; } catch { return false; /* stockage plein ou refusé */ }
}
// Complète les `by: null` créés sur cet appareil ; ne remplace jamais un auteur déjà posé, ni ne signe la validation de la graine commune (SEED_AT). Rend { st, n } (n = éléments complétés).
export function backfillAuthor(st, nom) {
  if (!validName(nom)) return { st, n: 0 };
  const by = nom.trim();
  let n = 0;
  const fill = (o) => { if (o && typeof o === 'object' && o.by == null) { n++; return { ...o, by }; } return o; };
  const list = st.list.map((r) => {
    const out = fill(r);
    const races = (r.races || []).map(fill);
    const ic = r.ic?.validated && r.ic.validated.by == null && r.ic.validated.at !== SEED_AT ? (n++, { ...r.ic, validated: { ...r.ic.validated, by } }) : r.ic;
    const frozen = r.frozen ? Object.fromEntries(Object.entries(r.frozen).map(([k, v]) => [k, fill(v)])) : r.frozen;
    return { ...out, races, ic, marks: (r.marks || []).map(fill), courses: (r.courses || []).map(fill), traces: (r.traces || []).map(fill), frozen };
  });
  return n ? { st: { ...st, list }, n } : { st, n: 0 };
}
