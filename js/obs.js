// Relevés de vent sur l'eau : comparaison aux modèles, choix du modèle du jour, saisie au compas.

import { MODELS, gridPoints } from './weather.js';
import { toXY, rad, deg, norm360, norm180, fmtBrg, cardinal } from './geo.js';
import { SR } from './voice.js';

const AROME = 'meteofrance_arome_france_hd';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

function blend(a, b, t) {
  const ux = (1 - t) * a.spd * Math.sin(rad(a.dir)) + t * b.spd * Math.sin(rad(b.dir));
  const uy = (1 - t) * a.spd * Math.cos(rad(a.dir)) + t * b.spd * Math.cos(rad(b.dir));
  return { ...a, dir: norm360(deg(Math.atan2(ux, uy))), spd: (1 - t) * a.spd + t * b.spd, gust: (1 - t) * (a.gust ?? a.spd * 1.3) + t * (b.gust ?? b.spd * 1.3) };
}

const hourIndex = (data, day, h) => data.multi.hourly.time.indexOf(`${day}T${String(Math.floor(h)).padStart(2, '0')}:00`);

// Vent d'un modèle au point central, interpolé dans le temps
export function modelAt(data, id, day, hour) {
  const h = data.multi.hourly, i0 = hourIndex(data, day, hour);
  if (i0 < 0) return null;
  const i1 = Math.min(h.time.length - 1, i0 + 1);
  const get = (i) => {
    const dir = h[`wind_direction_10m_${id}`]?.[i], spd = h[`wind_speed_10m_${id}`]?.[i];
    return dir == null || spd == null ? null : { dir, spd, gust: h[`wind_gusts_10m_${id}`]?.[i] ?? spd * 1.3 };
  };
  const a = get(i0), b = get(i1) || a;
  return a ? blend(a, b, hour - Math.floor(hour)) : null;
}

// Points de vent pour un modèle : la structure spatiale d'AROME HD (24 points)
// recalée sur la direction et la force du modèle choisi au centre de la rade.
export function modelPoints(data, day, hour, id) {
  const i0 = hourIndex(data, day, hour);
  if (i0 < 0) return null;
  const t = hour - Math.floor(hour), i1 = Math.min(data.multi.hourly.time.length - 1, i0 + 1);
  const g0 = gridPoints(data, i0), g1 = gridPoints(data, i1);
  const sel = modelAt(data, id, day, hour);
  if (!sel) return null;
  if (!g0.length || g0.length !== g1.length) return [{ x: 0, y: 0, ...sel }];
  let pts = g0.map((p, k) => blend(p, g1[k], t));
  if (id !== AROME) {
    const ar = modelAt(data, AROME, day, hour);
    if (ar) {
      const dd = norm180(sel.dir - ar.dir), k = Math.max(0.3, Math.min(3, sel.spd / Math.max(0.8, ar.spd)));
      pts = pts.map((p) => ({ ...p, dir: norm360(p.dir + dd), spd: p.spd * k, gust: (p.gust ?? p.spd * 1.3) * k }));
    } else pts = [{ x: 0, y: 0, ...sel }];
  }
  return pts;
}

export function idwAt(points, x, y) {
  let u = 0, v = 0, ws = 0;
  for (const p of points) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + 4e6, w = 1 / (d2 * d2);
    u += w * p.spd * Math.sin(rad(p.dir)); v += w * p.spd * Math.cos(rad(p.dir)); ws += w;
  }
  return { dir: norm360(deg(Math.atan2(u, v))), spd: Math.hypot(u, v) / ws };
}

// Écart d'un relevé à une prévision : direction (pondérée par la force du vent) et force
export function obsError(o, m) {
  const dd = norm180(m.dir - o.dir), ds = m.spd - o.spd;
  const dirTol = o.spd < 5 ? 35 : o.spd < 9 ? 22 : 15;
  return { dd, ds, e: (dd / dirTol) ** 2 + (ds / (1.5 + 0.15 * o.spd)) ** 2 };
}

// Classement des modèles d'après les relevés du jour (les plus récents comptent davantage)
export function scoreModels(data, obs) {
  if (!data || !obs.length) return [];
  const last = Math.max(...obs.map((o) => o.h));
  return MODELS.map((m) => {
    let sw = 0, se = 0, sdd = 0, sds = 0, n = 0;
    for (const o of obs) {
      const pts = modelPoints(data, o.day, o.h, m.id);
      if (!pts) continue;
      const p = toXY(o.lat, o.lon), v = idwAt(pts, p.x, p.y);
      const { dd, ds, e } = obsError(o, v), w = Math.exp(-(last - o.h) / 3);
      sw += w; se += w * e; sdd += w * Math.abs(dd); sds += w * ds; n++;
    }
    return n ? { id: m.id, label: m.label, n, score: Math.sqrt(se / sw), ddir: sdd / sw, dspd: sds / sw } : null;
  }).filter(Boolean).sort((a, b) => a.score - b.score);
}

// ───────────────────────── saisie au compas
function dialSVG(dir, model) {
  const R = 92, c = 110;
  let s = `<svg viewBox="0 0 220 220" class="dial" role="slider" aria-label="Direction du vent" aria-valuenow="${dir}" tabindex="0">`;
  s += `<circle cx="${c}" cy="${c}" r="${R + 14}" fill="var(--dialBg)" />`;
  for (let a = 0; a < 360; a += 10) {
    const big = a % 30 === 0, r0 = R + 12 - (big ? 12 : 6);
    s += `<line x1="${c + Math.sin(rad(a)) * r0}" y1="${c - Math.cos(rad(a)) * r0}" x2="${c + Math.sin(rad(a)) * (R + 12)}" y2="${c - Math.cos(rad(a)) * (R + 12)}" stroke="var(--dialTick)" stroke-width="${big ? 2 : 1}"/>`;
  }
  for (const [a, l] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'O']]) s += `<text x="${c + Math.sin(rad(a)) * (R - 14)}" y="${c - Math.cos(rad(a)) * (R - 14) + 6}" text-anchor="middle" font-size="17" font-weight="800" fill="var(--dialTxt)">${l}</text>`;
  if (model) s += `<g transform="rotate(${model.dir} ${c} ${c})" opacity=".45"><path d="M${c},${c - R - 8} l-7,-12 h14z" fill="var(--dialModel)"/></g>`;
  // flèche : le vent vient de « dir » et souffle vers le centre
  s += `<g transform="rotate(${dir} ${c} ${c})"><line x1="${c}" y1="${c - R + 4}" x2="${c}" y2="${c - 58}" stroke="var(--accent)" stroke-width="6" stroke-linecap="round"/><path d="M${c},${c - 42} l-11,-18 h22z" fill="var(--accent)"/><circle cx="${c}" cy="${c - R + 4}" r="9" fill="var(--accent)"/></g>`;
  s += `<text x="${c}" y="${c + 12}" text-anchor="middle" font-size="28" font-weight="800" fill="var(--dialTxt)">${fmtBrg(dir)}</text><text x="${c}" y="${c + 32}" text-anchor="middle" font-size="14" fill="var(--dialTxt)" opacity=".7">${cardinal(dir)}</text>`;
  return s + '</svg>';
}

// el : conteneur ; ctx : { draft, obs, ranking, selected, modelSel, nowcast, model, posLabel, onDraft, onAdd, onDelete, onModel, onNowcast }
export function renderObsCard(el, ctx) {
  const d = ctx.draft, rk = ctx.ranking;
  const best = rk[0];
  const verdict = !ctx.obs.length ? '<p class="small muted">Aucun relevé aujourd’hui. Dès le premier relevé, l’app compare les modèles et retient celui qui colle le mieux.</p>'
    : `<p class="small"><b>Modèle retenu : ${esc(ctx.selectedLabel)}</b>${ctx.modelSel === 'auto' ? ' (choisi par vos relevés)' : ' (forcé)'}${best && rk[1] && rk[1].score > best.score * 1.6 ? ` — nettement meilleur que ${esc(rk[1].label)}` : best && rk[1] ? ` — proche de ${esc(rk[1].label)}, à confirmer par un autre relevé` : ''}.</p>`;
  el.innerHTML = `
    <div class="voicebar">
      ${SR ? '<button class="btn acc mic" type="button" data-mic aria-label="Dicter le relevé">🎤</button>' : ''}
      <input type="text" data-vtext placeholder="Parlez ou tapez librement : « ça refuse un peu, autour de 14 nœuds »" enterkeyhint="done" autocomplete="off">
      <button class="btn small" type="button" data-vgo>OK</button>
    </div>
    <div class="obs-grid">
      <div class="dialwrap">${dialSVG(d.dir, ctx.model)}
        <div class="btns center"><button class="btn alt small" data-dd="-10">−10°</button><button class="btn alt small" data-dd="-5">−5°</button><button class="btn alt small" data-dd="5">+5°</button><button class="btn alt small" data-dd="10">+10°</button></div>
      </div>
      <div class="obs-side">
        <label class="f">Vent moyen</label>
        <div class="stepper"><button class="btn alt" data-ds="-1" aria-label="moins 1 nœud">−</button><b>${d.spd}<small> nd</small></b><button class="btn alt" data-ds="1" aria-label="plus 1 nœud">+</button></div>
        <label class="f" for="obsTime">Heure</label><input id="obsTime" type="time" value="${hhmm(d.h)}">
        <div class="small muted" style="margin-top:6px">📍 ${esc(ctx.posLabel)}</div>
        ${ctx.model ? `<div class="small muted">Modèle ici : ${fmtBrg(ctx.model.dir)} ${ctx.model.spd.toFixed(0)} nd (repère gris)</div>` : ''}
        <button class="btn acc" id="obsAdd" style="margin-top:8px;width:100%">Enregistrer le relevé</button>
      </div>
    </div>
    ${ctx.obs.length ? `<table class="t" style="margin-top:8px"><tr><th>Heure</th><th>Relevé</th><th>Modèle retenu</th><th></th></tr>${ctx.obs.map((o, i) => `<tr><td>${hhmm(o.h)}</td><td>${fmtBrg(o.dir)} · ${o.spd} nd</td><td>${o.fit ? `${fmtBrg(o.fit.dir)} · ${o.fit.spd.toFixed(0)} nd` : '—'}</td><td><button class="btn alt small" data-del="${i}" aria-label="Supprimer">✕</button></td></tr>`).join('')}</table>` : ''}
    ${verdict}
    ${rk.length ? `<table class="t"><tr><th>Modèle</th><th>Écart dir.</th><th>Écart force</th><th>Note</th></tr>${rk.map((r, i) => `<tr${r.id === ctx.selected ? ' class="sel"' : ''}><td>${r.id === ctx.selected ? '✔ ' : ''}${esc(r.label)}</td><td>${Math.round(r.ddir)}°</td><td>${r.dspd > 0 ? '+' : ''}${r.dspd.toFixed(1)} nd</td><td><span class="bar" style="--w:${Math.max(6, 100 - r.score * 35)}%"></span></td></tr>`).join('')}</table>` : ''}
    <div class="row2" style="margin-top:8px">
      <div><label class="f" for="obsModel">Modèle utilisé</label><select id="obsModel"><option value="auto" ${ctx.modelSel === 'auto' ? 'selected' : ''}>Automatique (relevés)</option>${MODELS.map((m) => `<option value="${m.id}" ${ctx.modelSel === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>
      <div><label class="f" for="obsNow">Ajuster sur les relevés</label><select id="obsNow"><option value="1" ${ctx.nowcast ? 'selected' : ''}>Oui (heures proches)</option><option value="0" ${!ctx.nowcast ? 'selected' : ''}>Non</option></select></div>
    </div>`;
  const svg = el.querySelector('.dial');
  const setFromEvent = (e) => {
    const r = svg.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    if (Math.hypot(x, y) < r.width * 0.12) return;
    d.dir = Math.round(norm360(deg(Math.atan2(x, -y))) / 5) * 5 % 360;
    svg.innerHTML = dialSVG(d.dir, ctx.model).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    ctx.onDraft({ dir: d.dir }, false);
  };
  let drag = false;
  svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); setFromEvent(e); });
  svg.addEventListener('pointermove', (e) => { if (drag) setFromEvent(e); });
  svg.addEventListener('pointerup', () => { if (drag) { drag = false; ctx.onDraft({}, true); } });
  svg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') ctx.onDraft({ dir: norm360(d.dir + 5) }, true); if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ctx.onDraft({ dir: norm360(d.dir - 5) }, true); });
  el.querySelectorAll('[data-dd]').forEach((b) => b.addEventListener('click', () => ctx.onDraft({ dir: norm360(d.dir + +b.dataset.dd) }, true)));
  el.querySelectorAll('[data-ds]').forEach((b) => b.addEventListener('click', () => ctx.onDraft({ spd: Math.max(0, Math.min(50, d.spd + +b.dataset.ds)) }, true)));
  el.querySelector('#obsTime').addEventListener('change', (e) => { const [a, b] = e.target.value.split(':').map(Number); if (!isNaN(a)) ctx.onDraft({ h: a + (b || 0) / 60, hManual: true }, true); });
  el.querySelector('#obsAdd').addEventListener('click', ctx.onAdd);
  const vt = el.querySelector('[data-vtext]');
  const go = () => { if (vt.value.trim()) { ctx.onVoice([vt.value.trim()]); vt.value = ''; vt.blur(); } };
  el.querySelector('[data-vgo]').addEventListener('click', go);
  vt.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  el.querySelector('[data-mic]')?.addEventListener('click', (e) => ctx.onMic(e.currentTarget));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => ctx.onDelete(+b.dataset.del)));
  el.querySelector('#obsModel').addEventListener('change', (e) => ctx.onModel(e.target.value));
  el.querySelector('#obsNow').addEventListener('change', (e) => ctx.onNowcast(e.target.value === '1'));
}
