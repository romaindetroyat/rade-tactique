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
//   races = manches lues par l’IA [{ date, time, label, excerpt, verified, keep }] ; marks, courses = bouées et parcours lus, gardés tels quels

import { escHTML } from './regview.js';
import { isDate, seasonOf, MAX_NAME, MAX_IC_TEXT } from './regates.js';
import { parisClock } from './racelock.js';
import { checkDate, checkDateEnd, checkTime, checkSeq, checkVhf } from './icplaus.js';

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
  const clone = (v) => list(v).map((x) => ({ ...x }));
  return build(values, excerpts, { source, read: 'ia', text, keyRules, flags, extra: { races, marks: clone(a?.marks), courses: clone(a?.courses), truncated: !!a?.truncated } });
}

// Nouvel objet : la valeur d’un champ change, `edited` dit si elle diffère de celle du départ (son extrait ne la décrit alors plus)
export function setValue(review, key, value) {
  const v = String(value ?? '').slice(0, MAX_FIELD);
  return { ...review, fields: review.fields.map((f) => (f.key === key ? { ...f, value: v, edited: v.trim() !== f.orig } : f)) };
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
  return { ...r, name: (v('event') || r.name || '').slice(0, MAX_NAME), dateStart, dateEnd: dateStart && isDate(end) && end > dateStart ? end : '', season: seasonOf(dateStart), ic };
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
  const tronque = review.truncated ? '<div class="small muted icex">Texte long : seuls les 50 000 premiers caractères ont été lus par l’IA.</div>' : '';
  return `<div class="card" id="icReview"><h3>Relecture des IC <small>rien n’est retenu avant « Valider les IC »</small></h3>`
    + `<div class="small muted">Source : ${escHTML(review.source || 'saisie')} · lecture ${escHTML(READ_LONG[review.read] || READ_LONG.saisie)}</div>`
    + iaHTML(opts.ia)
    + tronque
    + review.fields.map((f) => fieldHTML(f, checks[f.key])).join('')
    + rules
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
