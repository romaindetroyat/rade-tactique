// Relecture des IC champ par champ (D-02, D-03). Module pur, sans DOM ni stockage : un brouillon en mémoire de la page (`review`)
// est fabriqué depuis un lecteur (motifs de parseIC, ou l’IA pour un autre club : réponse déjà vérifiée par api/ic.js) ou depuis la régate (« Modifier »).
// Chaque valeur garde son extrait d’origine (la phrase du PDF qui l’a produite). Rien n’entre dans la régate avant `applyReview`,
// appelé sur le geste « Valider les IC » : le brouillon ne touche jamais le stockage. Tout texte affiché passe par escHTML.
//
// Forme d’une relecture : { source, read, text, fields: [{ key, label, kind, value, orig, excerpt, flag, edited }], keyRules: [{ value, keep, verified? }], races, marks, courses }
//   value  = ce que l’équipier voit dans le champ ('' si la lecture n’a rien trouvé : jamais deviné) ; orig = la valeur au départ
//   excerpt = extrait d’origine (null si la valeur n’a pas été lue dans le texte) ; edited = vrai si l’équipier a changé la valeur
//   flag = (lecture par l’IA) pourquoi la valeur est vide : « extrait introuvable dans le texte » ou « la valeur ne figure pas dans l’extrait »
//   keyRules[].verified === false = règle lue par l’IA dont l’extrait n’est pas dans le texte : grisée, jamais cochée
//   races = manches lues par l’IA [{ date, time, label, excerpt, verified, keep }]
//   marks = bouées lues [{ name, position (texte du PDF), lat, lon (nuls si illisible), excerpt, verified, keep }] ; courses = parcours lus
//   [{ name, sequence: [{ mark, side, gate }], finish: { kind, mark, excerpt } | null, finishFlag, excerpt, verified, keep }] (gate : l’autre bouée d’une porte)
//   (plan 03-07 : cochés ici, rangés « à confirmer » par applyReview ; un parcours n’est retenu que si toutes ses bouées le sont)

import { escHTML } from './regview.js';
import { isDate, seasonOf, addRace, MAX_NAME, MAX_NOTE, MAX_IC_TEXT } from './regates.js';
import { parisClock } from './racelock.js';
import { checkDate, checkDateEnd, checkTime, checkSeq, checkVhf, checkPos } from './icplaus.js';
import { parseLatLon } from './marks.js';
import { marksFromReview, coursesFromReview, normName, isLineName, fmtPos, sideTxt } from './regmarks.js';

export const FIELDS = Object.freeze([
  { key: 'event', label: 'Épreuve', kind: 'text' },
  { key: 'dateStart', label: 'Premier jour', kind: 'date' },
  { key: 'dateEnd', label: 'Dernier jour', kind: 'date' },
  { key: 'firstWarning', label: '1er signal d’avertissement', kind: 'time' },
  { key: 'lastFinishSignal', label: 'Limite d’arrivée du 1er', kind: 'time' },
  { key: 'vhf', label: 'Canal VHF', kind: 'int' },
  { key: 'committee', label: 'Comité de course', kind: 'text' },
  { key: 'zone', label: 'Zone de course', kind: 'text' },
].map(Object.freeze));
const MAX_FIELD = 200;                                     // longueur d’une valeur saisie
const READ_LONG = { motifs: 'par motifs (CVAT, hors réseau)', saisie: 'saisie à la main', reprise: 'reprise d’une ancienne fiche', ia: 'par l’IA (OpenAI) : vérifiez chaque valeur' };
const READ_SHORT = { motifs: 'par motifs', saisie: 'saisie', reprise: 'reprise', ia: 'par l’IA' };
export const NOT_READ = 'non lu dans le texte';
// false masque « Lire avec l’IA » sans rien changer d’autre ; décision après l’essai réel sur l’aperçu (plan 03-07)
export const IA_IC = true;

const str = (v) => (v == null ? '' : String(v).trim());
const valueOf = (review, key) => str(review?.fields?.find((f) => f.key === key)?.value);

// ───────────────────────── fabrication d’une relecture

// keyRules : des textes (cochés au départ) ou des objets { value, keep, verified } ; flags : { clé: raison } pour les champs vides signalés
function build(values, excerpts, { source, read, text, keyRules, flags = {}, extra = {} }) {
  return {
    source: String(source ?? ''), read, text: String(text ?? '').slice(0, MAX_IC_TEXT),
    fields: FIELDS.map((d) => { const v = str(values[d.key]); return { ...d, value: v, orig: v, excerpt: excerpts[d.key] || null, flag: flags[d.key] || null, edited: false }; }),
    keyRules: (keyRules || []).map((k) => (k && typeof k === 'object' ? { value: String(k.value), keep: !!k.keep, ...(k.verified === false ? { verified: false } : {}) } : { value: String(k), keep: true })),
    races: [], marks: [], courses: [], ...extra,
  };
}

// Depuis la sortie de parseIC (lecture par motifs). `regatta` (facultatif) : la régate courante, dont le dernier jour est repris
// (le PDF ne le donne pas) pour qu’une régate de plusieurs jours ne le perde pas ; il n’a pas d’extrait.
export function reviewFromParse(p, { source = '', text, regatta = null } = {}) {
  const ex = p?.ex || {};
  const values = { event: p?.event, dateStart: p?.date, dateEnd: regatta?.dateEnd, firstWarning: p?.firstWarning, lastFinishSignal: p?.lastFinishSignal, vhf: p?.vhf, committee: p?.committee, zone: p?.zone };
  const excerpts = { event: ex.event, dateStart: ex.date, firstWarning: ex.firstWarning, lastFinishSignal: ex.lastFinishSignal, vhf: ex.vhf, committee: ex.committee, zone: ex.zone };
  return build(values, excerpts, { source, read: 'motifs', text: text ?? p?.text, keyRules: p?.keyRules });
}
// « Modifier » : les valeurs et extraits déjà validés ; `read` = la lecture d’origine, 'saisie' si la régate n’a pas d’IC
export function reviewFromRegatta(r) {
  const f = r?.ic?.fields || {};
  const values = { event: r?.name, dateStart: r?.dateStart, dateEnd: r?.dateEnd, firstWarning: f.firstWarning, lastFinishSignal: f.lastFinishSignal, vhf: f.vhf, committee: f.committee, zone: f.zone };
  return build(values, r?.ic?.excerpts || {}, { source: r?.ic?.source, read: r?.ic?.read || 'saisie', text: r?.ic?.text, keyRules: f.keyRules });
}

// Depuis la réponse de /api/ic (déjà vérifiée côté serveur : extrait retrouvé dans le texte envoyé ET valeur retrouvée dans l’extrait). Une valeur
// vide y est accompagnée de sa raison (`flag`) ; une règle ou une manche non vérifiée est grisée et non cochée. Une règle vérifiée est montrée
// avec le texte de son extrait (celui du PDF), pas avec la reformulation du modèle. `regatta` (facultatif) : le dernier jour déjà connu est repris.
const FROM_API = { event: 'event', dateStart: 'dateStart', dateEnd: 'dateEnd', firstWarning: 'firstWarning', lastFinishSignal: 'lastFinish', vhf: 'vhf', committee: 'committee', zone: 'zone' };
export function reviewFromApi(a, { source = '', text, regatta = null } = {}) {
  const values = {}, excerpts = {}, flags = {};
  for (const [key, src] of Object.entries(FROM_API)) {
    const x = a?.[src] || {};
    values[key] = x.value ?? '';
    excerpts[key] = x.excerpt ?? null;
    if (x.flag) flags[key] = String(x.flag);
  }
  if (!str(values.dateEnd) && !flags.dateEnd && regatta?.dateEnd) { values.dateEnd = regatta.dateEnd; excerpts.dateEnd = null; }
  const list = (v) => (Array.isArray(v) ? v : []);
  const keyRules = list(a?.specialRules)
    .map((r) => (r?.verified ? { value: str(r.excerpt), keep: true } : { value: str(r?.value), keep: false, verified: false }))
    .filter((k) => k.value !== '');
  const races = list(a?.races).map((r) => ({ date: str(r?.date), time: str(r?.warning), label: str(r?.label), excerpt: r?.verified ? str(r.excerpt) : null, verified: !!r?.verified, keep: !!r?.verified }));
  // Bouées : la position est du TEXTE recopié du PDF, convertie ici par la page (parseLatLon, bornée à la rade) ; illisible → lat/lon nuls, jamais devinée.
  // Cochée au départ seulement si vérifiée, lisible et sans puce rouge (positions hors carte).
  const marks = list(a?.marks).map((m) => {
    const p = parseLatLon(str(m?.position)), lat = p.error ? null : p.lat, lon = p.error ? null : p.lon, verified = !!m?.verified;
    return { name: str(m?.name), position: str(m?.position), lat, lon, excerpt: verified ? str(m?.excerpt) : null, verified, keep: verified && lat != null && str(m?.name) !== '' && checkPos(lat, lon).level !== 'bad' };
  });
  // Porte (gate) et arrivée (finish) : seulement prouvées par api/ic.js ; une arrivée non prouvée n’est jamais gardée, sa raison est montrée (finishFlag)
  const courses = list(a?.courses).map((c) => {
    const f = c?.finish, kind = f?.kind === 'comite' || f?.kind === 'pres' ? f.kind : null;
    return {
      name: str(c?.name), excerpt: c?.verified ? str(c.excerpt) : null, verified: !!c?.verified, keep: false,
      sequence: list(c?.sequence).map((x) => ({ mark: str(x?.mark), side: x?.side === 'b' || x?.side === 't' ? x.side : null, gate: str(x?.gate) || null })),
      finish: f?.verified === true && kind && str(f.mark) ? { kind, mark: str(f.mark), excerpt: str(f.excerpt) } : null,
      finishFlag: f?.flag ? String(f.flag) : null,
    };
  });
  for (const c of courses) c.keep = c.verified && c.name !== '' && courseReady({ marks }, c);
  return build(values, excerpts, { source, read: 'ia', text, keyRules, flags, extra: { races, marks, courses, truncated: !!a?.truncated } });
}

// Nouvel objet : la valeur d’un champ change, `edited` dit si elle diffère de celle du départ (son extrait ne la décrit alors plus)
export function setValue(review, key, value) {
  const v = String(value ?? '').slice(0, MAX_FIELD);
  return { ...review, fields: review.fields.map((f) => (f.key === key ? { ...f, value: v, edited: v.trim() !== f.orig } : f)) };
}
export function setKeepRace(review, i, keep) {
  return { ...review, races: (review.races || []).map((m, j) => (j === i && m.verified ? { ...m, keep: !!keep } : m)) };   // une manche non vérifiée ne se coche pas
}
// Un parcours lu n’est retenable que si chacune de ses bouées (hors départ et arrivée), celles de ses portes et de son arrivée comprises, est retenue dans la relecture
export function courseReady(review, c) {
  const kept = new Set((review?.marks || []).filter((m) => m.keep && m.verified).map((m) => normName(m.name)));
  const names = [...(c?.sequence || []).flatMap((x) => [x.mark, x.gate]), c?.finish?.mark].filter((n) => n && !isLineName(n));
  return names.length > 0 && names.every((n) => kept.has(normName(n)));
}
export function setKeepMark(review, i, keep) {
  const marks = (review.marks || []).map((m, j) => (j === i && m.verified ? { ...m, keep: !!keep } : m));    // une bouée non vérifiée ne se coche pas
  const next = { ...review, marks };
  return { ...next, courses: (next.courses || []).map((c) => (c.keep && !courseReady(next, c) ? { ...c, keep: false } : c)) };   // sans l’une de ses bouées, le parcours est décoché
}
export function setKeepCourse(review, i, keep) {
  return { ...review, courses: (review.courses || []).map((c, j) => (j === i && c.verified && (!keep || courseReady(review, c)) ? { ...c, keep: !!keep } : c)) };
}
export function setKeep(review, i, keep) {
  return { ...review, keyRules: review.keyRules.map((k, j) => (j === i && k.verified !== false ? { ...k, keep: !!keep } : k)) };   // une règle non vérifiée ne se coche pas
}

// ───────────────────────── vraisemblance et validation

// Une puce par champ : { clé: { level: 'ok' | 'warn' | 'bad', msg } }. Valeur vide : « non lu dans le texte » (alerte), sauf le dernier jour,
// facultatif ; la VHF saisie en texte est convertie en entier avant le contrôle (« 7 2 » est impossible). Les positions (isLand) servent aux bouées (plan 07).
const GRAVITE = { ok: 0, warn: 1, bad: 2 };
const pire = (a, b) => (GRAVITE[b.level] > GRAVITE[a.level] ? b : a);
export function checksFor(review, { now = Date.now() } = {}) {
  const lu = review.read === 'motifs' || review.read === 'ia';          // une lecture automatique dit « non lu dans le texte » ; la saisie, « valeur vide »
  const out = {};
  for (const f of review.fields) {
    const x = str(f.value);
    if (x === '') { out[f.key] = f.key === 'dateEnd' && !f.flag ? { level: 'ok', msg: '' } : { level: 'warn', msg: f.flag || (lu ? NOT_READ : 'valeur vide') }; continue; }
    switch (f.key) {
      case 'dateStart': out[f.key] = checkDate(x, { now }); break;
      case 'dateEnd': out[f.key] = checkDateEnd(valueOf(review, 'dateStart'), x); break;
      case 'firstWarning': out[f.key] = checkTime(x); break;
      case 'lastFinishSignal': out[f.key] = pire(checkTime(x), checkSeq(valueOf(review, 'firstWarning'), x)); break;
      case 'vhf': out[f.key] = checkVhf(/^\d+$/.test(x) ? Number(x) : NaN); break;
      case 'event': out[f.key] = x.length > MAX_NAME ? { level: 'warn', msg: `nom trop long : raccourci à ${MAX_NAME} caractères` } : { level: 'ok', msg: '' }; break;
      default: out[f.key] = { level: 'ok', msg: '' };
    }
  }
  return out;
}

// Faux si une valeur non vide porte un contrôle de niveau 'bad' (checks : { clé: { level, msg } }, voir js/icplaus.js) ; vider la valeur lève le blocage
export function canValidate(review, checks = {}) {
  return !(review?.fields || []).some((f) => str(f.value) !== '' && checks[f.key]?.level === 'bad');
}

// La régate après validation : un objet neuf, `r` n’est pas modifié. Seules les valeurs non vides entrent ; les champs que la relecture
// ne porte pas (pavillons, séquence…) sont gardés. Le dernier jour n’est gardé que s’il est postérieur au premier (D-15).
export function applyReview(r, review, { by = null, at = Date.now() } = {}) {
  const v = (k) => valueOf(review, k);
  const dateStart = isDate(v('dateStart')) ? v('dateStart') : r.dateStart || '';
  const end = v('dateEnd');
  const vhf = /^\d{1,3}$/.test(v('vhf')) ? Number(v('vhf')) : null;
  const excerpts = {};
  for (const f of review.fields) if (str(f.value) !== '' && !f.edited && f.excerpt) excerpts[f.key] = f.excerpt;
  const ic = {
    fields: {
      ...(r.ic?.fields || {}),
      firstWarning: v('firstWarning'), lastFinishSignal: v('lastFinishSignal'), vhf, committee: v('committee'), zone: v('zone'),
      keyRules: review.keyRules.filter((k) => k.keep).map((k) => k.value),
    },
    excerpts, text: String(review.text ?? '').slice(0, MAX_IC_TEXT), source: review.source || r.ic?.source || '', read: review.read || 'saisie',
    validated: { by, at },
  };
  let next = { ...r, name: (v('event') || r.name || '').slice(0, MAX_NAME), dateStart, dateEnd: dateStart && isDate(end) && end > dateStart ? end : '', season: seasonOf(dateStart), ic };
  // Manches lues par l’IA, cochées ET vérifiées : ajoutées sans parcours (« parcours à préciser »). Une manche déjà présente (même jour, même heure)
  // ou hors des jours de la régate est ignorée ; la validation, elle, n’est jamais empêchée.
  for (const m of review.races || []) {
    if (!m.keep || !m.verified) continue;
    const date = m.date || next.dateStart;
    if ((next.races || []).some((x) => x.date === date && x.time === m.time)) continue;
    const note = `${m.label ? `${m.label} — ` : ''}parcours à préciser`.slice(0, MAX_NOTE);
    const res = addRace(next, { date, time: m.time, note }, { now: at, by });
    if (res.ok) next = res.regatta;
  }
  // Bouées et parcours lus (autre club) : rangés « à confirmer » dans la régate. Ils ne servent à rien tant qu’un équipier ne les a pas confirmés sur la carte.
  const keptMarks = (review.marks || []).filter((m) => m.keep && m.verified);
  if (keptMarks.length) {
    const fresh = marksFromReview(keptMarks, { by, at, club: next.club, existing: next.marks });
    next = { ...next, marks: [...(next.marks || []), ...fresh] };
    const keptCourses = (review.courses || []).filter((c) => c.keep && c.verified && courseReady(review, c));
    if (keptCourses.length) next = { ...next, courses: [...(next.courses || []), ...coursesFromReview(keptCourses, next.marks, { by, at, existing: next.courses })] };
  }
  return next;
}

// ───────────────────────── vues HTML

// Puce d’un contrôle : { cls, text } (couleur ET signe, lisible au soleil : ✓ plausible, ⚠ inhabituel, ✕ impossible)
export function chipOf(check) {
  if (!check) return { cls: 'chip', text: '' };
  if (check.level === 'bad') return { cls: 'chip low', text: `✕ ${check.msg || 'impossible'}` };
  if (check.level === 'warn') return { cls: 'chip mid', text: `⚠ ${check.msg || 'inhabituel'}` };
  return { cls: 'chip good', text: `✓ ${check.msg || 'plausible'}` };
}
export const BLOCK_MSG = 'Corrigez ou videz les valeurs impossibles (en rouge) pour valider';
const HINT = { date: 'AAAA-MM-JJ', time: 'HH:MM', int: 'ex. 72', text: '' };

function fieldHTML(f, check) {
  const chip = chipOf(check);
  const sans = f.excerpt ? '' : f.value.trim() === '' ? `<div class="small icex none">${NOT_READ} : saisissez la valeur ou laissez vide</div>` : '<div class="small icex">Sans extrait du texte (nom du fichier, fiche ou saisie à la main)</div>';
  const ex = f.excerpt ? `<div class="small icex">Extrait : « ${escHTML(f.excerpt.replace(/\s+/g, ' '))} »<span class="icmod" data-mod="${escHTML(f.key)}"${f.edited ? '' : ' hidden'}> · valeur modifiée</span></div>` : '';
  return `<div class="icf" data-field="${escHTML(f.key)}"><label class="f" for="icf-${escHTML(f.key)}">${escHTML(f.label)}</label>`
    + `<input type="text" id="icf-${escHTML(f.key)}" data-f="${escHTML(f.key)}" value="${escHTML(f.value)}" placeholder="${escHTML(HINT[f.kind] || '')}" maxlength="${MAX_FIELD}" autocomplete="off"${f.kind === 'int' ? ' inputmode="numeric"' : ''}>`
    + `<span class="${chip.cls}" data-chip="${escHTML(f.key)}"${chip.text ? '' : ' hidden'}>${escHTML(chip.text)}</span>${ex}${sans}</div>`;
}

// ───────────────────────── quand proposer l’IA (D-03) et que dire quand elle échoue

// Les IC du CVAT se reconnaissent à leur sigle répété (titre, cahier de parcours, avis aux concurrents, bouée « CCIV/CVAT »)
export const icLooksCvat = (text) => (String(text ?? '').match(/\bCVAT\b/g) || []).length >= 2;
// La lecture par motifs est complète : une date valide, le premier signal et la VHF (p : sortie de parseIC)
export const cvatReadOk = (p) => !!p && isDate(p.date) && !!str(p.firstWarning) && Number.isInteger(p.vhf);
// PDF scanné ou texte vide : moins de 200 caractères non blancs (Pitfall 3)
export const textTooThin = (text) => String(text ?? '').replace(/\s+/g, '').length < 200;
// Que montrer pour « Lire avec l’IA » : { show, enabled, msg }. Jamais pour des IC CVAT bien lues ; jamais si IA est faux ; inactif hors réseau
// (navigator.onLine n’est qu’un indice : l’échec réel de l’appel prime) ou sans texte. Rien ne part sans le geste de l’équipier.
export function iaOffer({ text, parse, online, IA = IA_IC } = {}) {
  if (!IA) return { show: false, enabled: false, msg: '' };
  if (textTooThin(text)) return { show: true, enabled: false, msg: 'PDF sans texte : saisissez la fiche à la main' };
  if (icLooksCvat(text) && cvatReadOk(parse)) return { show: false, enabled: false, msg: '' };
  if (!online) return { show: true, enabled: false, msg: 'Lecture IA indisponible hors réseau : importez les IC avant la régate' };
  return { show: true, enabled: true, msg: '' };
}
// Message français d’un échec de /api/ic ; ni statut ni délai : l’appel n’a pas abouti (réseau). 429 avec le message du serveur (quota du jour,
// budget du mois) : ce message, borné à 200 caractères ; il est inséré par escHTML comme les autres.
export function iaErrorMessage({ status, code, message, timedOut } = {}) {
  if (timedOut) return 'L’IA n’a pas répondu à temps (70 s)';
  if (status == null) return 'Pas de réseau : la lecture IA se fait avant la régate';
  if (status === 429 && typeof message === 'string' && message.trim()) return message.trim().slice(0, 200);
  if (status === 503 && code === 'no_key') return 'Lecture IA indisponible sur ce déploiement (clé OpenAI absente)';
  if (status === 502) return 'Réponse tronquée ou refusée : réessayez, ou saisissez à la main';
  if (status === 400) return 'Texte des IC trop court';
  if (status === 401) return 'Accès refusé : rouvrez l’app avec votre code';
  return `La lecture par l’IA a échoué (code ${status}) : relisez et corrigez à la main`;
}

// Bloc « Lire avec l’IA » de la relecture d’un PDF importé : ia = { show, enabled, msg } (décidé par la page ; rien n’est envoyé sans le geste)
const IA_LABEL = 'Lire avec l’IA (le texte part chez OpenAI)';
function iaHTML(ia) {
  if (!ia?.show) return '';
  return `<div class="btns icia"><button type="button" class="btn alt small" id="icIa"${ia.enabled ? '' : ' disabled'}>${IA_LABEL}</button></div><div class="small muted" id="icIaMsg" aria-live="polite">${escHTML(ia.msg || '')}</div>`;
}

// Carte « Relecture des IC » ; checks : { clé: { level, msg } } (vide : pas de puces). Le bouton « Valider les IC » est désactivé si canValidate est faux.
// opts.ia : bloc « Lire avec l’IA » (voir iaHTML).
export function reviewHTML(review, checks = {}, opts = {}) {
  const ok = canValidate(review, checks);
  const rules = review.keyRules.length
    ? `<div class="icrules"><h4>Points clés <small>décochez ceux à ne pas garder</small></h4>${review.keyRules.map((k, i) => (k.verified === false
      ? `<label class="small icrule icoff"><input type="checkbox" data-kr="${i}" disabled> ${escHTML(k.value)} <em>(extrait introuvable dans le texte : non retenu)</em></label>`
      : `<label class="small icrule"><input type="checkbox" data-kr="${i}"${k.keep ? ' checked' : ''}> ${escHTML(k.value)}</label>`)).join('')}</div>`
    : '';
  const races = (review.races || []).length
    ? `<div class="icrules icraces"><h4>Manches lues <small>décochez celles à ne pas ajouter (le parcours reste à préciser)</small></h4>${review.races.map((m, i) => `<label class="small icrule icrace${m.verified ? '' : ' icoff'}"><input type="checkbox" data-rc="${i}"${m.keep ? ' checked' : ''}${m.verified ? '' : ' disabled'}> ${escHTML(m.date || 'jour à préciser')} · ${escHTML(m.time || 'heure inconnue')}${m.label ? ` · ${escHTML(m.label)}` : ''}${m.verified && m.excerpt ? `<span class="icex" style="display:block">Extrait : « ${escHTML(m.excerpt.replace(/\s+/g, ' '))} »</span>` : '<em> (extrait introuvable dans le texte : non retenue)</em>'}</label>`).join('')}</div>`
    : '';
  const isLand = opts.isLand;
  const marks = (review.marks || []).length
    ? `<div class="icblock icmarks"><h4>Bouées lues <small>elles resteront « à confirmer » sur la carte jusqu’à votre confirmation</small></h4>${review.marks.map((m, i) => {
      const c = m.lat != null ? chipOf(checkPos(m.lat, m.lon, { isLand })) : { cls: 'chip mid', text: '⚠ position à saisir : illisible dans le texte' };
      const pos = m.lat != null ? `${escHTML(fmtPos(m.lat, m.lon))}` : 'position à saisir';
      return `<label class="small icrule icmark${m.verified ? '' : ' icoff'}"><input type="checkbox" data-mk="${i}"${m.keep ? ' checked' : ''}${m.verified ? '' : ' disabled'}> <span class="icmn">${escHTML(m.name || 'sans nom')}</span> · ${pos}`
        + `${m.verified ? ` <span class="${c.cls}">${escHTML(c.text)}</span><span class="icex" style="display:block">Texte : « ${escHTML(m.position)} » · Extrait : « ${escHTML(String(m.excerpt || '').replace(/\s+/g, ' '))} »</span>` : '<em> (extrait introuvable dans le texte : non retenue)</em>'}</label>`;
    }).join('')}</div>`
    : '';
  const courses = (review.courses || []).length
    ? `<div class="icblock iccourses"><h4>Parcours lus <small>proposés dans l’onglet Parcours une fois toutes leurs bouées confirmées</small></h4>${review.courses.map((c, i) => {
      const ready = courseReady(review, c);
      const seq = c.sequence.map((x) => (x.gate ? `porte ${escHTML(x.mark)} / ${escHTML(x.gate)}` : `${escHTML(x.mark)}${sideTxt(x.side)}`)).join(' → ') || 'séquence non lue';
      const fin = c.finish
        ? `<span class="icex icfin" style="display:block">Arrivée : ${c.finish.kind === 'pres' ? 'près de' : 'entre le Comité et'} ${escHTML(c.finish.mark)}${c.finish.excerpt ? ` · Extrait : « ${escHTML(c.finish.excerpt.replace(/\s+/g, ' '))} »` : ''}</span>`
        : c.finishFlag ? `<em class="icfin" style="display:block">(arrivée non prouvée : ${escHTML(c.finishFlag)} ; arrivée sur la ligne de départ)</em>` : '';
      return `<label class="small icrule iccourse${c.verified ? '' : ' icoff'}"><input type="checkbox" data-co="${i}"${c.keep ? ' checked' : ''}${c.verified && ready ? '' : ' disabled'}> <span class="icmn">${escHTML(c.name || 'sans nom')}</span> : ${seq}`
        + `${c.verified ? `<em data-co-nr="${i}"${ready ? ' hidden' : ''}> (une bouée n’est pas retenue ci-dessus : parcours non retenu)</em>${fin}<span class="icex" style="display:block">Extrait : « ${escHTML(String(c.excerpt || '').replace(/\s+/g, ' '))} »</span>` : '<em> (extrait introuvable dans le texte : non retenu)</em>'}</label>`;
    }).join('')}</div>`
    : '';
  const tronque = review.truncated ? '<div class="small muted icex">Texte long : seuls les 50 000 premiers caractères ont été lus par l’IA.</div>' : '';
  return `<div class="card" id="icReview"><h3>Relecture des IC <small>rien n’est retenu avant « Valider les IC »</small></h3>`
    + `<div class="small muted">Source : ${escHTML(review.source || 'saisie')} · lecture ${escHTML(READ_LONG[review.read] || READ_LONG.saisie)}</div>`
    + iaHTML(opts.ia)
    + tronque
    + review.fields.map((f) => fieldHTML(f, checks[f.key])).join('')
    + rules
    + races
    + marks
    + courses
    + `<div class="rgerr" id="icBlock"${ok ? ' hidden' : ''}>${BLOCK_MSG}</div>`
    + `<div class="btns"><button type="button" class="btn acc" id="icValidate"${ok ? '' : ' disabled'}>Valider les IC</button><button type="button" class="btn alt" id="icCancel">Annuler</button></div></div>`;
}

// Ligne « IC validées par … le JJ/MM (lecture par motifs | saisie | reprise) » de la fiche, en HTML échappé
export function validatedHTML(ic) {
  if (!ic?.validated) return 'Pas encore d’IC validées pour cette régate.';
  const { by, at } = ic.validated;
  const d = Number.isFinite(at) ? parisClock(at).date : null;
  return `IC validées${by ? ` par ${escHTML(by)}` : ''}${d ? ` le ${d.slice(8, 10)}/${d.slice(5, 7)}` : ''} (lecture ${escHTML(READ_SHORT[ic.read] || READ_SHORT.saisie)})`;
}
