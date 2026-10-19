// Régates : vues HTML (chaînes) de la liste par saison, du formulaire de création et de la fiche. Modules purs, sans DOM ni stockage :
// tout texte venu d’une régate (nom, club, note, auteur) passe par escHTML ; les attributs sont toujours entre guillemets doubles.

import { parisClock } from './racelock.js';
import { regattaStatus, STATUS_LABEL, MAX_NAME, MAX_CLUB, MAX_NOTE, daysOf } from './regates.js';

// Échappe & < > " ' (le esc() d’app.js laisse passer l’apostrophe)
export const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

// « par Prénom le JJ/MM » ; « — » quand l’auteur n’est pas encore connu (complété au premier succès de /api/membre)
export function byLine(by, at) {
  if (!by) return '—';
  const d = Number.isFinite(at) ? parisClock(at).date : null;
  return `par ${escHTML(by)}${d ? ` le ${d.slice(8, 10)}/${d.slice(5, 7)}` : ''}`;
}

// Jours en clair, calculés en UTC sur la date seule (le fuseau du téléphone ne les décale jamais)
const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_Y = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const at12 = (s) => new Date(s + 'T12:00:00Z');
export function datesLabel(r) {
  if (!r?.dateStart) return 'date à préciser';
  return r.dateEnd && r.dateEnd > r.dateStart ? `du ${DAY.format(at12(r.dateStart))} au ${DAY_Y.format(at12(r.dateEnd))}` : DAY_Y.format(at12(r.dateStart));
}
const CHIP = { avenir: 'chip pres', aujourdhui: 'chip good', passee: 'chip' };
const statusChip = (r, now) => { const st = regattaStatus(r, now); return `<span class="${CHIP[st]}">${escHTML(STATUS_LABEL[st])}</span>`; };

// groups : sortie de groupBySeason ; une ligne par régate (touchable), la courante est marquée
export function listHTML(groups, { currentId = null, now = Date.now() } = {}) {
  if (!groups.length) return '<p class="small muted">Aucune régate pour l’instant : touchez « ＋ Nouvelle régate ».</p>';
  return groups.map(({ season, groups: gs }) => `<div class="rgseason"><h4>Saison ${escHTML(season)}</h4>${gs.map((g) => `<div class="rgstatus">${escHTML(g.label)}</div>${g.items.map((r) => {
    const cur = r.id === currentId;
    return `<button type="button" class="rg${cur ? ' on' : ''}" data-rg="${escHTML(r.id)}" aria-pressed="${cur ? 'true' : 'false'}">`
      + `<span class="rgn">${escHTML(r.name)}</span>`
      + `<span class="rgm">${escHTML(datesLabel(r))}${r.club ? ` · ${escHTML(r.club)}` : ''}</span>`
      + `<span class="rgb">${statusChip(r, now)}<span class="small muted">${byLine(r.by, r.at)}</span></span></button>`;
  }).join('')}`).join('')}</div>`).join('');
}

// Formulaire de création : nom, premier jour, club ; dernier jour facultatif. draft garde la saisie quand l’écran est redessiné.
export function newRegattaFormHTML(draft = {}, errors = {}) {
  const err = (k) => (errors[k] ? `<div class="rgerr" data-err="${k}">${escHTML(errors[k])}</div>` : '');
  return `<div class="card" id="rgForm"><h3>Nouvelle régate <small>trois champs</small></h3>
    <label class="f" for="rgName">Nom</label><input id="rgName" type="text" maxlength="${MAX_NAME}" autocomplete="off" placeholder="Coupe de…" value="${escHTML(draft.name)}">${err('name')}
    <label class="f" for="rgStart">Premier jour</label><input id="rgStart" type="date" value="${escHTML(draft.dateStart)}">${err('dateStart')}
    <label class="f" for="rgClub">Club</label><input id="rgClub" type="text" list="rgClubs" maxlength="${MAX_CLUB}" autocomplete="off" placeholder="CVAT" value="${escHTML(draft.club)}"><datalist id="rgClubs"><option value="CVAT"></option></datalist>${err('club')}
    <label class="f" for="rgEnd">Dernier jour <small>facultatif, si la régate dure plusieurs jours</small></label><input id="rgEnd" type="date" value="${escHTML(draft.dateEnd)}">${err('dateEnd')}
    <div class="btns"><button type="button" class="btn acc" id="rgCreate">Créer la régate</button><button type="button" class="btn alt" id="rgCancel">Annuler</button></div></div>`;
}

const dayLabel = (d) => DAY.format(at12(d));
const courseLabel = (id, courses) => (id == null ? 'parcours à préciser' : courses.find((c) => String(c.id) === String(id))?.title || `Parcours ${id}`);

// Une ligne par manche : numéro, jour, signal d’avertissement, parcours, classe, tours, auteur ; « Choisir cette manche » et suppression
function raceRowHTML(m, { courses, chosen }) {
  const signal = m.time ? `signal ${escHTML(m.time)}` : 'signal : heure inconnue';
  return `<div class="rgrace${chosen ? ' on' : ''}" data-n="${m.n}"><div class="rgrh"><b>Manche ${m.n}</b> <span class="small">${escHTML(dayLabel(m.date))} · ${signal}</span>${chosen ? ' <span class="chip good">choisie</span>' : ''}</div>`
    + `<div class="small">${escHTML(courseLabel(m.courseId, courses))} · classe ${escHTML(m.cls)} · ${m.laps} tour${m.laps > 1 ? 's' : ''}</div>`
    + `${m.note ? `<div class="small"><i>${escHTML(m.note)}</i></div>` : ''}<div class="small muted">${byLine(m.by, m.at)}</div>`
    + `<div class="btns" style="margin-top:6px"><button type="button" class="btn small acc" data-race="${m.n}">Choisir cette manche</button><button type="button" class="btn small alt" data-rmrace="${m.n}" aria-label="Supprimer la manche ${m.n}">✕</button></div></div>`;
}
// Petit formulaire « Ajouter une manche » : jour (parmi ceux de la régate), signal d’avertissement, parcours, classe, tours, note
function raceFormHTML(r, d, errors, courses) {
  const err = (k) => (errors[k] ? `<div class="rgerr" data-err="${k}">${escHTML(errors[k])}</div>` : '');
  const sel = (v, x) => (String(v ?? '') === String(x) ? ' selected' : '');
  return `<div class="rgrform" id="rcForm"><h4>Nouvelle manche</h4>
    <div class="row2"><div><label class="f" for="rcDate">Jour</label><select id="rcDate">${daysOf(r).map((x) => `<option value="${escHTML(x)}"${sel(d.date, x)}>${escHTML(dayLabel(x))}</option>`).join('')}</select>${err('date')}</div>
    <div><label class="f" for="rcTime">Signal d’avertissement</label><input id="rcTime" type="time" value="${escHTML(d.time)}">${err('time')}</div></div>
    <label class="f" for="rcCourse">Parcours</label><select id="rcCourse"><option value="">parcours à préciser</option>${courses.map((c) => `<option value="${escHTML(c.id)}"${sel(d.courseId, c.id)}>${escHTML(c.title)}</option>`).join('')}</select>${err('courseId')}
    <div class="row2"><div><label class="f" for="rcCls">Classe</label><select id="rcCls"><option value="G"${sel(d.cls, 'G')}>G (grand)</option><option value="P"${sel(d.cls, 'P')}>P (petit)</option></select>${err('cls')}</div>
    <div><label class="f" for="rcLaps">Tours</label><select id="rcLaps">${[1, 2, 3, 4].map((n) => `<option value="${n}"${sel(d.laps, n)}>${n}</option>`).join('')}</select>${err('laps')}</div></div>
    <label class="f" for="rcNote">Note <small>facultatif</small></label><input id="rcNote" type="text" maxlength="${MAX_NOTE}" autocomplete="off" value="${escHTML(d.note)}">${err('note')}
    <div class="btns"><button type="button" class="btn acc" id="rcAdd">Ajouter la manche</button><button type="button" class="btn alt" id="rcCancel">Annuler</button></div></div>`;
}

// Fiche de la régate courante : nom, club, dates, statut, auteur, puis les manches (courses = parcours connus [{ id, title }])
export function sheetHTML(r, { now = Date.now(), courses = [], raceDraft = null, raceErrors = {} } = {}) {
  if (!r) return '<div class="card" id="rgSheet"><p class="small muted">Aucune régate courante : créez-en une ou choisissez-en une dans la liste.</p></div>';
  const races = r.races || [];
  return `<div class="card" id="rgSheet"><h3><span>${escHTML(r.name)}</span><small>${escHTML(r.club || 'club à préciser')}</small></h3>
    <div class="small">${escHTML(datesLabel(r))} ${statusChip(r, now)}</div>
    <div class="small muted" style="margin-top:4px">Créée ${byLine(r.by, r.at)}</div>
    <div class="rgraces"><h4>Manches</h4>${races.length ? races.map((m) => raceRowHTML(m, { courses, chosen: r.sel === m.n })).join('') : '<p class="small muted">Aucune manche : ajoutez-en une avec son heure de signal et son parcours.</p>'}
    ${raceDraft ? raceFormHTML(r, raceDraft, raceErrors, courses) : '<div class="btns"><button type="button" class="btn small acc" id="rcNew">＋ Ajouter une manche</button></div>'}</div></div>`;
}
