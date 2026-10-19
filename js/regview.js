// Régates : vues HTML (chaînes) de la liste par saison, du formulaire de création et de la fiche. Modules purs, sans DOM ni stockage :
// tout texte venu d’une régate (nom, club, note, auteur) passe par escHTML ; les attributs sont toujours entre guillemets doubles.

import { parisClock } from './racelock.js';
import { regattaStatus, STATUS_LABEL, MAX_NAME, MAX_CLUB } from './regates.js';

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

// En-tête de la fiche de la régate courante (nom, club, dates, statut, auteur)
export function sheetHTML(r, { now = Date.now() } = {}) {
  if (!r) return '<div class="card" id="rgSheet"><p class="small muted">Aucune régate courante : créez-en une ou choisissez-en une dans la liste.</p></div>';
  return `<div class="card" id="rgSheet"><h3><span>${escHTML(r.name)}</span><small>${escHTML(r.club || 'club à préciser')}</small></h3>
    <div class="small">${escHTML(datesLabel(r))} ${statusChip(r, now)}</div>
    <div class="small muted" style="margin-top:4px">Créée ${byLine(r.by, r.at)}</div></div>`;
}
