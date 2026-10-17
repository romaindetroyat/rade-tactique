// Rade Tactique — application principale.

import { Terrain, toXY, toLL, NM, bearingXY, distXY, norm360, norm180, fmtBrg, fmtNm, fmtLat, fmtLon, cardinal } from './geo.js';
import { WindField, speedColor } from './wind.js';
import { Scene3D } from './scene3d.js';
import { MARKS, COURSES, LINE_PRESETS, FORBIDDEN_ZONE, DANGERS } from './courses.js';
import { eventsState, currentEvent, setCurrent, upsertEvent, removeEvent, pdfText, parseIC, eventForm, readForm } from './events.js';
import { fetchAll, cached, snapshot, consensus, gridPoints, marineAt, fetchLive, MODELS, WMO, CENTER } from './weather.js';
import { buildLegs, analyzeLeg, markAdvice, analyzeStart, trendOf, rankCourses, regimeOf, sideName, summarizeTime } from './tactics.js';
import { optimalAngles, boatSpeed, trimAdvice, spiMinTwa, getPolar, setPolar, resetPolar, parsePolar } from './polar.js';
import { renderJ80 } from './j80.js';
import { modelPoints, modelAt, idwAt, scoreModels, renderObsCard } from './obs.js';
import { route } from './router.js';
import { initTips, maybeWelcome, openGuide, openShare, tip } from './help.js';
import { parseWind, listen, say } from './voice.js';
import { Recorder, listTracks, getTrack, deleteTrack, saveTrack, analyzeTrack, exportGPX, fromGPX } from './track.js';
import { shroudsFor } from './tuning.js';

export const APP_VERSION = 'v6 · relevé vocal';
const $ = (s, r = document) => r.querySelector(s);
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toast.tm); toast.tm = setTimeout(() => { t.hidden = true; }, 4500);
}
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const arrow = (dir) => `<span class="arr" style="transform:rotate(${dir + 180}deg)">↑</span>`;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* indisponible */ } } };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayName = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const DEF = {
  day: today(), hour: 11, src: 'forecast', manual: { dir: 315, spd: 15, gust: 20 }, calib: null, localFx: 1, obs: [], modelSel: 'auto', nowcast: true,
  courseId: 3, cls: 'G', laps: 2, wlNm: 0.8, startTime: 11, linePreset: 'vignettes', lineLen: 0.12, lineMode: 'wind', lineBrg: 0, lineOverride: null,
  perf: 1, polar: null, obsOpen: true,
};
const S = { ...DEF, ...store.get('rade.state', {}) };
let IC = currentEvent();
if (S.day < today()) S.day = today();
// lien partagé : #p=<parcours>-<classe>-<tours>[-<jour>]
(() => {
  const m = /^#p=(\d+)-([GP])-(\d)(?:-(\d{4}-\d{2}-\d{2}))?/.exec(location.hash);
  if (!m) return;
  S.courseId = +m[1]; S.cls = m[2]; S.laps = +m[3]; S.lineOverride = null;
  if (m[4] && m[4] >= today()) S.day = m[4];
  history.replaceState(null, '', location.pathname);
})();
S.calib = null; // remplacé par les relevés (S.obs)
S.obs = (S.obs || []).filter((o) => o.day >= addDays(today(), -1));
const persist = () => store.set('rade.state', Object.fromEntries(Object.keys(DEF).map((k) => [k, S[k]])));

let T, F, scene, data = null, series = [], live = [], analysis = null, selLeg = null, gps = null, follow = false, nextIdx = 0;
const forbidden = [FORBIDDEN_ZONE.map((p) => toXY(p.lat, p.lon))];

if (S.polar) { try { setPolar(S.polar.tws, S.polar.twa, S.polar.bsp, S.polar.source); } catch { S.polar = null; } }

// ───────────────────────── démarrage
async function init() {
  T = await new Terrain().load('data/');
  F = new WindField(T);
  scene = new Scene3D($('#view'), T);
  scene.upAngle = (tws) => optimalAngles(Math.max(1, tws)).up.twa;
  scene.setDangers(forbidden, DANGERS);
  scene.onPick = onPick;
  scene.onCamera = () => { $('#compass .needle').style.transform = `rotate(${-scene.azimuth()}deg)`; };
  bindUI();
  initTips();
  data = cached();
  const snap = await snapshot();
  if (snap && (!data || snap.fetched > data.fetched)) data = snap;
  if (data) { series = consensus(data); refreshObs(); }
  updateAll();
  $('#splash').classList.add('gone');
  maybeWelcome();
  renderTracks();
  refreshWeather();
  refreshLive();
  setInterval(refreshLive, 5 * 60000);
  if ('serviceWorker' in navigator) {
    // mise à jour sans intervention : nouvelle version détectée → rechargement unique
    const had = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  }
}

async function refreshWeather() {
  const b = $('#refresh'); b.classList.add('spin');
  try {
    data = await fetchAll(); series = consensus(data); refreshObs();
    status();
    updateAll();
  } catch (e) {
    if (!data) { data = await snapshot(); if (data) { series = consensus(data); updateAll(); } }
    status(data ? `Hors ligne — prévisions du ${new Date(data.fetched).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Prévisions indisponibles (réseau)');
  } finally { b.classList.remove('spin'); }
}
async function refreshLive() {
  try { live = await fetchLive(); scene.setStations(live.filter((s) => s.ageMin < 90)); if ($('section[data-tab=brief]').classList.contains('on')) renderBrief(); } catch { /* balises indisponibles */ }
}
function status(msg) {
  const el = $('#status');
  if (msg) { el.textContent = msg; return; }
  if (!data) { el.textContent = 'Pas de prévision'; return; }
  const ago = Math.round((Date.now() - data.fetched) / 60000);
  const when = ago < 1 ? 'à l’instant' : ago < 120 ? `il y a ${ago} min` : `le ${new Date(data.fetched).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;
  el.textContent = `${APP_VERSION} · ${S.src === 'manual' ? 'vent manuel' : `prévisions ${data.snapshot ? 'embarquées' : 'màj'} ${when}`}`;
}

// ───────────────────────── vent de base
const seriesIndex = (day, h) => series.findIndex((r) => r.time === `${day}T${String(Math.floor(h)).padStart(2, '0')}:00`);

function baseAt(day, hour) {
  let pts;
  if (S.src === 'manual' || !data) {
    pts = [{ x: 0, y: 0, ...S.manual }];
  } else {
    pts = modelPoints(data, day, hour, selectedModel());
    if (!pts) pts = [{ x: 0, y: 0, ...S.manual }];
    else if (S.nowcast) pts = applyResiduals(pts, day, hour);
  }
  return { points: pts };
}

// ───────────────────────── relevés de vent : modèle du jour et ajustement
const AROME_ID = 'meteofrance_arome_france_hd';
let ranking = [], resid = [];
const dayObs = () => S.obs.filter((o) => o.day === S.day).sort((a, b) => a.h - b.h);
function selectedModel() { return S.modelSel !== 'auto' ? S.modelSel : ranking[0]?.id || AROME_ID; }
const modelLabel = (id) => MODELS.find((m) => m.id === id)?.label || id;

// Recalcule le classement des modèles puis, pour le modèle retenu, l'écart résiduel à chaque relevé
function refreshObs() {
  ranking = data ? scoreModels(data, dayObs()) : [];
  resid = [];
  if (!data) return;
  const sel = selectedModel();
  for (const o of dayObs()) {
    const pts = modelPoints(data, o.day, o.h, sel);
    if (!pts) continue;
    F.compute({ points: pts }, { localEffects: S.localFx });
    const p = toXY(o.lat, o.lon), w = F.sample(p.x, p.y);
    o.fit = { dir: w.dir, spd: w.spd };
    resid.push({ h: o.h, dd: norm180(o.dir - w.dir), rr: Math.max(0.3, Math.min(3, o.spd / Math.max(0.8, w.spd))) });
  }
}
// L'écart mesuré s'applique pleinement à l'heure du relevé, puis s'estompe (≈ 2 h 30)
function applyResiduals(pts, day, hour) {
  if (day !== S.day || !resid.length) return pts;
  let sw = 0, sd = 0, sr = 0, wmax = 0;
  for (const r of resid) { const w = Math.exp(-Math.abs(hour - r.h) / 2.5); sw += w; sd += w * r.dd; sr += w * (r.rr - 1); wmax = Math.max(wmax, w); }
  const dd = (sd / sw) * wmax, k = 1 + (sr / sw) * wmax;
  return pts.map((p) => ({ ...p, dir: norm360(p.dir + dd), spd: p.spd * k, gust: (p.gust ?? p.spd * 1.3) * k }));
}

let obsDraft = null, obsPos = null;
function obsPosition() {
  if (gps?.pos) return { lat: gps.pos.lat, lon: gps.pos.lon, label: 'ma position GPS' };
  if (obsPos) return { ...obsPos, label: 'point choisi sur la carte' };
  if (analysis) { const ll = toLL(analysis.line.c.x, analysis.line.c.y); return { ...ll, label: 'zone de départ (activez le GPS ou touchez la carte pour préciser)' }; }
  return { lat: CENTER.lat, lon: CENTER.lon, label: 'centre de la rade' };
}
function nowHour() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
function renderObs(el) {
  const pos = obsPosition(), p = toXY(pos.lat, pos.lon);
  const h = obsDraft?.hManual ? obsDraft.h : (S.day === today() ? nowHour() : S.hour);
  let model = null;
  if (data && S.src === 'forecast') { const pts = modelPoints(data, S.day, h, selectedModel()); if (pts) model = idwAt(pts, p.x, p.y); }
  if (!obsDraft) obsDraft = { dir: model ? Math.round(model.dir / 5) * 5 % 360 : S.manual.dir, spd: model ? Math.round(model.spd) : S.manual.spd };
  obsDraft.h = h;
  renderObsCard(el, {
    draft: obsDraft, obs: dayObs(), ranking, selected: selectedModel(), selectedLabel: modelLabel(selectedModel()), modelSel: S.modelSel, nowcast: S.nowcast, model, posLabel: pos.label,
    onDraft: (patch, rerender) => { Object.assign(obsDraft, patch); if (rerender) renderObsAll(); },
    onAdd: () => {
      const q = obsPosition();
      S.obs.push({ day: S.day, h: obsDraft.h, lat: q.lat, lon: q.lon, dir: obsDraft.dir, spd: obsDraft.spd, t: Date.now() });
      obsDraft.hManual = false;
      persist(); refreshObs(); updateAll();
      if (rest && gps?.pos) setTimeout(planRest, 300);
      toast(`Relevé enregistré : ${fmtBrg(obsDraft.dir)} ${obsDraft.spd} nd — modèle retenu : ${modelLabel(selectedModel())}`);
    },
    onVoice: (alts) => voiceObs(alts),
    onMic: (btn) => {
      btn.classList.add('rec'); btn.textContent = '…';
      try {
        listen({
          onResult: (alts) => voiceObs(alts),
          onError: (m) => toast('Micro : ' + m + '. Vous pouvez dicter avec le micro du clavier dans le champ texte.'),
          onEnd: () => { btn.classList.remove('rec'); btn.textContent = '🎤'; },
        });
      } catch (err) { btn.classList.remove('rec'); btn.textContent = '🎤'; toast('Reconnaissance vocale indisponible ici : utilisez le micro du clavier dans le champ texte.'); }
    },
    onDelete: (i) => { const o = dayObs()[i]; S.obs = S.obs.filter((x) => x !== o); persist(); refreshObs(); updateAll(); },
    onModel: (v) => { S.modelSel = v; persist(); refreshObs(); updateAll(); },
    onNowcast: (v) => { S.nowcast = v; persist(); refreshObs(); updateAll(); },
  });
}
// Relevé dicté : interprétation, confirmation 3 s (annulable), puis enregistrement
let pend = null;
function voiceObs(alts) {
  const lastObs = dayObs().slice(-1)[0];
  const last = lastObs ? { dir: lastObs.dir, spd: lastObs.spd } : obsDraft ? { dir: obsDraft.dir, spd: obsDraft.spd } : null;
  const tack = gps?.pos?.cog != null && last ? (norm180(gps.pos.cog - last.dir) >= 0 ? 1 : -1) : null;
  let res = null, heard = alts[0];
  for (const a of alts) { const r = parseWind(a, last, tack); if (!r.error) { res = r; heard = a; break; } if (!res) res = r; }
  if (res.error || res.dir == null || res.spd == null) { toast(`« ${heard} » : ${res.error || 'il manque la direction ou la force'}`); say('Pas compris'); return; }
  obsDraft = { ...(obsDraft || {}), dir: res.dir, spd: res.spd, hManual: false };
  const b = document.getElementById('voicePend') || Object.assign(document.createElement('div'), { id: 'voicePend' });
  document.body.appendChild(b);
  b.innerHTML = `<div><b>${fmtBrg(res.dir)} · ${res.spd} nd</b>${res.notes.length ? ` <span class="small">(${esc(res.notes.join(', '))})</span>` : ''}<div class="small">« ${esc(heard)} » — enregistrement dans 3 s</div></div><button class="btn alt small" id="vpCancel">Annuler</button>`;
  b.hidden = false;
  clearTimeout(pend);
  say(`Relevé ${res.dir}, ${res.spd} nœuds`);
  pend = setTimeout(() => { b.hidden = true; renderObsAll(); $$('.obs-card #obsAdd')[0]?.click(); }, 3000);
  $('#vpCancel').onclick = () => { clearTimeout(pend); b.hidden = true; say('Annulé'); renderObsAll(); };
  renderObsAll();
}
function renderObsAll() { $$('.obs-card').forEach((el) => renderObs(el)); }

function blend(a, b, t) {
  const ux = (1 - t) * a.spd * Math.sin(a.dir * Math.PI / 180) + t * b.spd * Math.sin(b.dir * Math.PI / 180);
  const uy = (1 - t) * a.spd * Math.cos(a.dir * Math.PI / 180) + t * b.spd * Math.cos(b.dir * Math.PI / 180);
  return { x: a.x, y: a.y, dir: norm360(Math.atan2(ux, uy) * 180 / Math.PI), spd: (1 - t) * a.spd + t * b.spd, gust: (1 - t) * (a.gust ?? a.spd * 1.3) + t * (b.gust ?? b.spd * 1.3) };
}

function computeField(day, hour) { return F.compute(baseAt(day, hour), { localEffects: S.localFx }); }

// ───────────────────────── mises à jour
let anaTimer = null, anaToken = 0;
function updateAll() {
  status();
  renderDaySeg();
  $('#hour').value = S.hour; $('#hourLbl').textContent = hhmm(S.hour);
  $$('#srcSeg button').forEach((b) => b.classList.toggle('on', b.dataset.src === S.src));
  updateDisplayField();
  scheduleAnalysis();
  renderBrief(); renderWind(); renderIC(); renderJ80Tab();
}
function updateDisplayField() {
  computeField(S.day, S.hour);
  scene.setField(F);
  const c = F.sample(toXY(43.088, 5.962).x, toXY(43.088, 5.962).y);
  $('#windBadge').innerHTML = `${arrow(c.dir)} <b>${c.spd.toFixed(0)}</b> nd · ${cardinal(c.dir)} ${fmtBrg(c.dir)}<br><span class="small">rafales ${c.gust.toFixed(0)} nd · ${hhmm(S.hour)}${S.src === 'manual' ? ' · manuel' : ''}${S.src === 'forecast' && data ? ' · ' + modelLabel(selectedModel()) : ''}${S.src === 'forecast' && S.nowcast && resid.length ? ' + relevés' : ''}</span>`;
  renderLegend();
}
function scheduleAnalysis() { clearTimeout(anaTimer); anaTimer = setTimeout(runAnalysis, 120); }

async function runAnalysis() {
  const token = ++anaToken;
  const course = COURSES.find((c) => c.id === S.courseId);
  const cls = course.seq[S.cls] ? S.cls : 'G';
  computeField(S.day, S.startTime);
  const preset = LINE_PRESETS[course.line && S.linePreset === 'vignettes' ? course.line : S.linePreset] || LINE_PRESETS.vignettes;
  const ctr = toXY(preset.lat, preset.lon);
  const wLine = F.sample(ctr.x, ctr.y);
  const ov = S.lineOverride ? { cb: toXY(S.lineOverride.cb.lat, S.lineOverride.cb.lon), pin: toXY(S.lineOverride.pin.lat, S.lineOverride.pin.lon) } : null;
  const B = buildLegs(course, cls, { laps: S.laps, windDir: wLine.dir, wlLengthNm: S.wlNm, line: { center: preset, lengthNm: S.lineLen, mode: S.lineMode, bearing: S.lineBrg, override: ov } });
  const trend = S.src === 'forecast' && data ? trendOf(series, Math.max(0, seriesIndex(S.day, S.startTime)), Math.max(0, seriesIndex(S.day, S.startTime + 4))) : 0;
  const ctx = { terrain: T, forbidden, perf: S.perf, trend };
  const start = analyzeStart(B.line, F, { ...B.legs[0] }, ctx);
  // le premier bord part du point de la ligne qui mène le plus vite à la 1re marque
  const L0 = B.line, first = B.legs[0], cands = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const p = { x: L0.pin.x + (L0.cb.x - L0.pin.x) * f, y: L0.pin.y + (L0.cb.y - L0.pin.y) * f };
    const r = route(p, first.to, F, { terrain: T, forbidden, perf: S.perf });
    if (r) cands.push({ f, p, time: r.time });
  }
  if (cands.length) {
    const best = cands.reduce((a, b) => (b.time < a.time ? b : a)), mid = cands.find((c) => c.f === 0.5) || best;
    first.from = { ...best.p, name: 'Départ' };
    first.brg = bearingXY(first.from, first.to); first.dist = distXY(first.from, first.to);
    const where = best.f >= 0.9 ? 'au ras du Comité' : best.f >= 0.6 ? 'dans le tiers Comité' : best.f <= 0.1 ? 'au ras de la bouée' : best.f <= 0.4 ? 'dans le tiers bouée' : 'au milieu de la ligne';
    const gain = mid.time - best.time;
    start.startPoint = { ...best.p, f: best.f, gain };
    start.advice.unshift(`Routage : départ le plus rapide ${where}${gain >= 3 ? ` (≈ ${Math.round(gain)} s gagnées sur un départ au milieu)` : ' (écart faible le long de la ligne)'}. La route optimale part de ce point (◆ orange).`);
  }
  const legs = []; let t = S.startTime, lastH = S.startTime;
  for (const leg of B.legs) {
    if (token !== anaToken) return;
    if (S.src === 'forecast' && Math.abs(t - lastH) >= 0.25) { computeField(S.day, t); lastH = t; }
    const a = analyzeLeg(leg, F, ctx);
    a.eta0 = t; t += a.time / 3600; a.eta1 = t;
    legs.push(a);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (token !== anaToken) return;
  let ord = 0;
  legs.forEach((l) => { if (l.mark !== 'GATE' && l.mark !== 'FINISH') l.order = ++ord; });
  analysis = { course, cls, legs, line: B.line, points: B.points, start, total: t - S.startTime, dist: legs.reduce((s, l) => s + l.dist, 0), trend };
  updateDisplayField();
  drawCourse();
  renderCourse(); renderStart(); renderLive(); renderBrief(); renderJ80Tab();
  if (autoReplay) { autoReplay = false; startReplay(); } else if (scene.replay) { const R = scene.replay, f = R.t / R.T, was = R.playing; startReplay(false); scene.replayControl('seek', f * scene.replay.T); if (!was) scene.replayControl('toggle'); }
}

function drawCourse() {
  if (!analysis) return;
  // marques du parcours, avec leurs numéros d'ordre de passage
  const used = new Map();
  analysis.legs.forEach((l) => {
    if (!l.order) return;
    const u = used.get(l.mark) || { side: l.side, orders: [] };
    u.orders.push(l.order); used.set(l.mark, u);
  });
  const marks = { ...MARKS };
  for (const k of ['A', 'B', 'C', 'D']) if (analysis.points[k]) { const ll = toLL(analysis.points[k].x, analysis.points[k].y); marks[k] = { name: analysis.points[k].name, ...ll, color: '#f5c400' }; }
  scene.setMarks(marks, used);
  scene.setLine(analysis.line, analysis.start.startPoint ? [{ ...analysis.start.startPoint, name: '◆ Départ conseillé' }] : []);
  scene.setCourse(analysis, selLeg);
}

// ───────────────────────── interface : liaisons
function bindUI() {
  $('#hour').addEventListener('input', (e) => { S.hour = +e.target.value; $('#hourLbl').textContent = hhmm(S.hour); updateDisplayField(); });
  $('#hour').addEventListener('change', () => { persist(); renderBrief(); });
  $('#srcSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.src = b.dataset.src; persist(); updateAll(); });
  $('#refresh').addEventListener('click', () => { refreshWeather(); refreshLive(); });
  $('#helpBtn').addEventListener('click', openGuide);
  $('#shareBtn').addEventListener('click', () => {
    const base = location.origin + location.pathname;
    const c = COURSES.find((x) => x.id === S.courseId);
    openShare({ base, courseLink: `${base}#p=${S.courseId}-${S.cls}-${S.laps}-${S.day}`, courseLabel: `${c.title}${c.laps ? ', ' + S.laps + (S.laps > 1 ? ' tours' : ' tour') : ''}, ${S.cls === 'P' ? 'P1–P2' : 'C–R3'}, ${dayName(S.day)}` });
  });
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $$('#content section').forEach((s) => s.classList.toggle('on', s.dataset.tab === b.dataset.tab));
    if (sheet === 'min') setSheet('half');
  });
  $('#mapBtns').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.v;
    if (v === 'top') scene.topView();
    if (v === 'tilt') scene.tiltView();
    if (v === 'course' && analysis) scene.focus(analysis.legs.flatMap((l) => [l.from, l.to]));
    if (v === 'boat') { follow = !follow; b.classList.toggle('on', follow); if (follow) startGps(); }
    if (v === 'layers') $('#layersMenu').hidden = !$('#layersMenu').hidden;
  });
  $('#layersMenu').addEventListener('change', (e) => { const l = e.target.dataset.layer; if (l) scene.setLayer(l, e.target.checked); });
  $('#exag').addEventListener('change', (e) => scene.setExaggeration(+e.target.value));
  $('#compass').addEventListener('click', () => { scene.home({ x: scene.controls.target.x, y: -scene.controls.target.z }, scene.camera.position.distanceTo(scene.controls.target), 0.75, 0); });
  scene.onReplay = onReplay;
  $('#rhPlay').addEventListener('click', () => scene.replayControl('toggle'));
  $('#rhSeek').addEventListener('input', (e) => { const R = scene.replay; if (R) scene.replayControl('seek', (+e.target.value / 1000) * R.T); });
  $('#rhSpeed').addEventListener('change', (e) => scene.replayControl('speed', +e.target.value));
  $('#rhFollow').addEventListener('click', (e) => { e.currentTarget.classList.toggle('on'); scene.replayControl('follow', e.currentTarget.classList.contains('on')); });
  $('#rhClose').addEventListener('click', stopReplay);
  bindSheet();
}

let sheet = 'half';
function setSheet(s) { sheet = s; const p = $('#panel'); p.classList.toggle('min', s === 'min'); p.classList.toggle('max', s === 'max'); document.body.dataset.sheet = s; setTimeout(() => scene.resize(), 280); }
function bindSheet() {
  const g = $('#grab'); let y0 = null;
  g.addEventListener('pointerdown', (e) => { y0 = e.clientY; g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointerup', (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) < 8) setSheet(sheet === 'min' ? 'half' : sheet === 'half' ? 'max' : 'min');
    else if (dy < 0) setSheet(sheet === 'min' ? 'half' : 'max'); else setSheet(sheet === 'max' ? 'half' : 'min');
  });
  document.body.dataset.sheet = sheet;
}

function renderDaySeg() {
  const t0 = today(), days = [t0, addDays(t0, 1), addDays(t0, 2)];
  if (!days.includes(S.day)) S.day = t0;
  $('#daySeg').innerHTML = days.map((d, i) => `<button data-d="${d}" class="${d === S.day ? 'on' : ''}">${i === 0 ? 'Auj.' : i === 1 ? 'Demain' : new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short' })}${d === IC.date ? ' 🏁' : ''}</button>`).join('');
  $('#daySeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.day = b.dataset.d; persist(); updateAll(); };
}

function renderLegend() {
  const stops = [0, 4, 8, 12, 16, 22, 30];
  $('#legend').innerHTML = `<div class="small"><b>Vent (nœuds)</b> — modèle local</div><div class="bar" style="background:linear-gradient(90deg,${stops.map((s) => `rgb(${speedColor(s).join(',')})`).join(',')})"></div><div class="ticks">${stops.map((s) => `<span>${s}</span>`).join('')}</div>`;
}

// ───────────────────────── sélection sur la carte
function onPick(p, screen) {
  const w = F.sample(p.x, p.y), land = T.isLand(p.x, p.y), pop = $('#pickPop');
  const depth = T.height(p.x, p.y);
  let legInfo = '';
  if (analysis && selLeg != null) { const l = analysis.legs[selLeg]; const twa = norm180(l.brg - w.dir); legInfo = `<div class="row"><span>TWA bord ${selLeg + 1}</span><b>${Math.abs(twa).toFixed(0)}° ${twa > 0 ? 'bâbord' : 'tribord'}</b></div>`; }
  pop.innerHTML = `<h4>${land ? 'À terre' : 'Point choisi'}</h4>
    <div class="small muted">${fmtLat(p.lat)} ${fmtLon(p.lon)} · ${land ? `alt. ${depth.toFixed(0)} m` : `fond ≈ ${(-depth).toFixed(0)} m`}</div>
    ${land ? '' : `<div class="row"><span>Vent</span><b>${cardinal(w.dir)} ${fmtBrg(w.dir)} · ${w.spd.toFixed(1)} nd</b></div>
    <div class="row"><span>Rafales</span><b>${w.gust.toFixed(0)} nd</b></div>
    <div class="row"><span>Dévent relief</span><b>${Math.round(w.shelter * 100)} %</b></div>
    <div class="row"><span>Oscillations</span><b>±${F.shiftAmplitude(w.spd, w.shelter)}°</b></div>${legInfo}`}
    <div class="acts">${land ? '' : `<button class="btn small alt" data-a="cb">Comité ici</button><button class="btn small alt" data-a="pin">Bouée ici</button><button class="btn small alt" data-a="obs">Relevé de vent ici…</button>`}<button class="btn small" data-a="close">✕</button></div>`;
  const vw = $('#stage').clientWidth;
  pop.style.left = Math.min(vw - 230, Math.max(8, screen.clientX + 12)) + 'px';
  pop.style.top = Math.max(8, screen.clientY - 20) + 'px';
  pop.hidden = false;
  pop.onclick = (e) => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'close') { pop.hidden = true; scene.clearPick(); return; }
    if (a === 'cb' || a === 'pin') setLineEnd(a, p);
    if (a === 'obs') { pop.hidden = true; obsPos = { lat: p.lat, lon: p.lon }; openTab('course'); renderObsAll(); $('.obs-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    pop.hidden = true; scene.clearPick();
  };
}
function setLineEnd(which, ll) {
  const cur = S.lineOverride || (analysis ? { cb: toLL(analysis.line.cb.x, analysis.line.cb.y), pin: toLL(analysis.line.pin.x, analysis.line.pin.y) } : null);
  if (!cur) return;
  cur[which] = { lat: ll.lat, lon: ll.lon };
  S.lineOverride = cur; persist(); scheduleAnalysis();
}
function openTab(t) { $(`#tabs button[data-tab=${t}]`).click(); }

// ───────────────────────── animation du parcours
let replayLegStarts = [], autoReplay = false;
function buildTrack(A) {
  const tr = []; let t0 = 0;
  replayLegStarts = [];
  A.legs.forEach((l, i) => {
    replayLegStarts.push(t0);
    const spi = l.type.sail.startsWith('Spi');
    const path = l.route?.path?.length > 1 ? l.route.path : [{ x: l.from.x, y: l.from.y, t: 0 }, { x: l.to.x, y: l.to.y, t: l.time, hd: l.brg, twa: l.twa, bsp: l.dist / Math.max(1, l.time) / 0.5144 }];
    path.forEach((p, k) => { if (k === 0 && tr.length) return; tr.push({ x: p.x, y: p.y, t: t0 + p.t, hd: p.hd, twa: p.twa, bsp: p.bsp, leg: i, spi }); });
    t0 += l.time;
  });
  return tr;
}
function startReplay(focus = true) {
  if (!analysis) return;
  scene.setReplay(buildTrack(analysis));
  $('#replayHud').hidden = false;
  $('#rhPlay').textContent = '⏸';
  scene.replayControl('speed', +$('#rhSpeed').value);
  scene.replayControl('follow', $('#rhFollow').classList.contains('on'));
  if (focus) scene.focus(analysis.legs.flatMap((l) => [l.from, l.to]));
}
function stopReplay() { scene.setReplay(null); $('#replayHud').hidden = true; }
let lastHud = 0;
function onReplay(st) {
  const now = performance.now(); if (now - lastHud < 100 && st.playing) return; lastHud = now;
  if (st.p.trace) {
    $('#rhInfo').innerHTML = `<b>${new Date(st.p.abs).toLocaleTimeString('fr-FR')}</b> · trace ${summarizeTime(st.t)} / ${summarizeTime(st.T)}<br>${(st.p.bsp ?? 0).toFixed(1)} nd · cap ${fmtBrg(st.hd)} · TWA ${Math.abs(st.p.twa ?? 0).toFixed(0)}° ${(st.p.twa ?? 0) >= 0 ? 'bâbord' : 'tribord'} amures${st.p.pct ? ` · ${Math.round(st.p.pct * 100)} % polaire` : ''}`;
    $('#rhPlay').textContent = st.playing ? '⏸' : '▶';
    if (document.activeElement !== $('#rhSeek')) $('#rhSeek').value = Math.round((st.t / st.T) * 1000);
    return;
  }
  const l = analysis?.legs[st.p.leg]; if (!l) return;
  const clock = S.startTime + st.t / 3600, twa = st.p.twa ?? l.twa;
  $('#rhInfo').innerHTML = `<b>${hhmm(clock)}</b> · course ${summarizeTime(st.t)} / ${summarizeTime(st.T)}<br>Bord ${st.p.leg + 1}/${analysis.legs.length} → ${l.order ? `<b>marque ${l.order}</b> (n°${esc(l.to.name)})` : esc(l.to.name)}${l.side ? ' · ' + sideName(l.side) : ''}<br>${(st.p.bsp ?? 0).toFixed(1)} nd · cap ${fmtBrg(st.hd)} · TWA ${Math.abs(twa).toFixed(0)}° ${twa >= 0 ? 'bâbord' : 'tribord'} amures · ${st.p.spi ? 'spi' : 'foc'}`;
  $('#rhPlay').textContent = st.playing ? '⏸' : '▶';
  if (document.activeElement !== $('#rhSeek')) $('#rhSeek').value = Math.round((st.t / st.T) * 1000);
}


function dayRows() { return series.map((r, i) => ({ ...r, i })).filter((r) => r.time.startsWith(S.day)); }

function renderBrief() {
  const el = $('section[data-tab=brief]');
  const isRace = S.day === IC.date;
  const rows = dayRows();
  const iStart = seriesIndex(S.day, S.startTime);
  const rs = series[iStart];
  let html = '';
  if (!data) html += `<div class="notice">Pas encore de prévision chargée${navigator.onLine ? ' — téléchargement en cours…' : ' (hors ligne). Le mode « Manuel » reste disponible.'}</div>`;
  if (S.src === 'manual') html += `<div class="notice">Mode <b>vent manuel</b> : ${fmtBrg(S.manual.dir)} ${S.manual.spd} nd. Les prévisions sont ignorées pour la carte et l’analyse.</div>`;
  if (S.src === 'forecast' && dayObs().length) html += `<div class="notice">${dayObs().length} relevé(s) aujourd’hui · modèle retenu : <b>${esc(modelLabel(selectedModel()))}</b>${S.nowcast ? ', ajusté sur vos relevés' : ''}. <button class="btn small alt" id="goObs2">Relevés</button></div>`;
  const w = rs ? { dir: rs.dir, spd: rs.spd, gust: rs.gust } : S.manual;
  const reg = w?.dir != null ? regimeOf(w.dir, w.spd) : null;
  html += `<div class="card hero">
    <div class="muted small">${esc(dayName(S.day))}${isRace ? ` · <b style="color:#fff">${esc(IC.event)}</b>` : ''}</div>
    <div class="big">${w?.dir != null ? `<span class="arrow" style="transform:rotate(${w.dir + 180}deg)">↑</span><div><b>${Math.round(w.spd)} nd</b> <span class="muted">rafales ${Math.round(w.gust ?? w.spd * 1.3)}</span><div>${cardinal(w.dir)} · ${fmtBrg(w.dir)} au départ (${hhmm(S.startTime)})</div></div>` : '<div>—</div>'}</div>
    ${reg ? `<span class="chip">${esc(reg.name)}</span>` : ''}${rs ? `<span class="chip ${rs.confidence > 70 ? 'good' : rs.confidence > 45 ? 'mid' : 'low'}">Confiance ${rs.confidence} %</span>` : ''}
    ${isRace ? `<div class="small muted" style="margin-top:6px">1er avertissement ${IC.firstWarning} · arrivée limite ${IC.lastFinishSignal} · VHF ${IC.vhf}</div>` : ''}
  </div>`;
  if (rows.length) html += `<div class="card"><h3><span>Vent sur la journée ${tip('Trait plein : vent moyen AROME HD au centre de la rade. Pointillés : rafales. Bande bleue : écart entre les 6 modèles (plus elle est large, moins la prévision est sûre). Zone orange : fenêtre de course.')}</span><small>point central rade</small></h3>${chartSVG(rows, isRace)}<div class="small muted">Trait plein : AROME HD · pointillé : rafales · bande : écart entre les ${MODELS.length} modèles · flèches : direction (vers où souffle le vent).</div></div>`;
  // stratégie
  if (analysis) {
    const tips = [];
    const tr = analysis.trend;
    if (S.src === 'forecast' && Math.abs(tr) >= 2) tips.push(`<b>Rotation attendue ${tr > 0 ? 'à DROITE (vent qui adonne tribord / « veer »)' : 'à GAUCHE (« back »)'}</b> d’environ ${Math.abs(tr).toFixed(0)}°/h pendant la course : au près, privilégier le côté ${tr > 0 ? 'droit' : 'gauche'} du plan d’eau (aller vers la bascule).`);
    else if (S.src === 'forecast') tips.push('Direction assez stable dans la fenêtre de course : jouer les oscillations et la pression.');
    const spots = Object.entries(MARKS).map(([k, m]) => { const p = toXY(m.lat, m.lon); return { k, m, w: F.sample(p.x, p.y) }; }).sort((a, b) => b.w.spd - a.w.spd);
    tips.push(`Zones les plus ventées (modèle, heure affichée) : ${spots.slice(0, 3).map((s) => `${s.k} ${s.m.name} ${s.w.spd.toFixed(0)} nd`).join(', ')}. Plus faibles : ${spots.slice(-2).map((s) => `${s.k} ${s.m.name} ${s.w.spd.toFixed(0)} nd`).join(', ')}.`);
    if (rs && rs.spreadDir > 30) {
      const far = rs.per.reduce((acc, p) => { for (const q of rs.per) { const d = Math.abs(norm180(p.dir - q.dir)); if (d > acc.d) acc = { d, a: p, b: q }; } return acc; }, { d: 0 });
      const best = ranking[0];
      tips.push(`<b>Modèles en désaccord</b> : ${esc(far.a.label)} donne ${fmtBrg(far.a.dir)} ${far.a.spd.toFixed(0)} nd, ${esc(far.b.label)} ${fmtBrg(far.b.dir)} ${far.b.spd.toFixed(0)} nd. ` + (best
        ? `Vos relevés tranchent pour <b>${esc(best.label)}</b> (écart moyen ${Math.round(best.ddir)}° et ${Math.abs(best.dspd).toFixed(1)} nd)${ranking[1] ? `, devant ${esc(ranking[1].label)} (${Math.round(ranking[1].ddir)}°)` : ''}.`
        : 'Faites un relevé dès l’arrivée sur zone (onglet Parcours) : l’app retiendra le modèle qui colle.'));
    }
    tips.push(`Parcours ${analysis.course.id} estimé à <b>${summarizeTime(analysis.total * 3600)}</b> pour un J80 (${(analysis.dist / NM).toFixed(1)} Nq route directe).`);
    html += `<div class="card"><h3>Stratégie du jour ${tip('Synthèse automatique : rotation du vent attendue pendant la course, zones les plus ventées, désaccord entre modèles et temps estimé du parcours.')}</h3><ul class="tips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
  }
  if (reg) html += `<div class="card"><h3>Effets locaux — ${esc(reg.name)} <small>connaissance de la rade</small></h3><ul class="tips">${reg.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  if (w?.spd != null) { const ta = trimAdvice(w.spd, w.gust); html += `<div class="card"><h3>Réglages J80 — ${ta.mode}</h3><ul class="tips"><li><b>Gréement</b> : ${ta.rig} Haubans / intermédiaires / bas-haubans (North, jauge Loos B) : <b>${shroudsFor(w.gust ? (w.spd + w.gust) / 2 : w.spd)}</b>.</li><li><b>Voiles</b> : ${ta.sails}</li><li><b>Équipage</b> : ${ta.crew}</li><li><b>Tactique</b> : ${ta.tactic}</li></ul><div class="small muted">Valeurs chiffrées (haubans, points de tir) : onglet J80.</div></div>`; }
  // modèles à l'heure affichée
  const ih = seriesIndex(S.day, S.hour);
  if (ih >= 0) {
    const r = series[ih];
    html += `<div class="card"><h3>Modèles à ${hhmm(Math.floor(S.hour))} <small>au centre de la rade</small></h3><table class="t"><tr><th>Modèle</th><th>Dir.</th><th>Vent</th><th>Raf.</th><th>Écart relevés</th></tr>${r.per.map((p) => { const rk = ranking.find((x) => x.id === p.id); const sel = S.src === 'forecast' && p.id === selectedModel(); return `<tr${sel ? ' class="sel"' : ''}><td>${sel ? '✔ ' : ''}${esc(p.label)}</td><td>${arrow(p.dir)} ${fmtBrg(p.dir)}</td><td>${p.spd.toFixed(0)} nd</td><td>${p.gust != null ? p.gust.toFixed(0) : '—'}</td><td>${rk ? `${Math.round(rk.ddir)}° · ${rk.dspd > 0 ? '+' : ''}${rk.dspd.toFixed(1)} nd` : '—'}</td></tr>`; }).join('')}</table>
    <div class="small muted" style="margin-top:4px">✔ = modèle utilisé pour la carte et l’analyse${S.modelSel === 'auto' ? (ranking.length ? ' (le plus proche de vos relevés)' : ' (AROME HD par défaut, en attendant un relevé)') : ' (choisi manuellement)'}.</div>
    <div class="small muted" style="margin-top:6px">${r.temp != null ? `${r.temp.toFixed(0)} °C · ` : ''}${WMO[r.code] ?? ''}${r.cloud != null ? ` · nuages ${r.cloud} %` : ''}${r.rain ? ` · pluie ${r.rain} mm` : ''}${r.pmsl ? ` · ${r.pmsl.toFixed(0)} hPa` : ''}</div></div>`;
    const m = marineAt(data, r.time);
    if (m) html += `<div class="card"><h3>État de la mer <small>large de Cépet</small></h3><div class="kpis"><div class="kpi"><b>${m.hs?.toFixed(1) ?? '—'} m</b><span>houle+mer ${m.dir != null ? cardinal(m.dir) : ''}</span></div><div class="kpi"><b>${m.per?.toFixed(0) ?? '—'} s</b><span>période</span></div><div class="kpi"><b>${m.cur != null ? m.cur.toFixed(1) : '—'} nd</b><span>courant ${m.curDir != null ? '→ ' + fmtBrg(m.curDir) : ''}</span></div></div><div class="small muted" style="margin-top:6px">Eau ${m.sst?.toFixed(0) ?? '—'} °C. Courant de surface modélisé (Copernicus) : faible en rade, à vérifier sur les bouées.</div></div>`;
  }
  // parcours probables
  if (w?.dir != null) {
    const rk = rankCourses(S.cls, w.dir, w.spd).slice(0, 4);
    html += `<div class="card"><h3><span>Parcours probables ${tip('Parcours dont le premier bord est au près avec le vent prévu : le Comité choisit souvent ce type de parcours. Simple aide à la préparation.')}</span><small>1er bord au près</small></h3>${rk.map((r) => `<div class="row" style="display:flex;justify-content:space-between;margin:4px 0"><span><b>${r.c.title}</b> → ${MARKS[r.c.seq[S.cls][0][0]].name}</span><span class="small">${fmtBrg(r.brg)} · TWA ${Math.round(r.twa)}° <button class="btn small alt" data-pick="${r.c.id}">Voir</button></span></div>`).join('')}<div class="small muted">Le comité cherche en général un premier bord de près : simple aide pour se préparer, le parcours est annoncé avant la procédure.</div></div>`;
  }
  if (live.length) html += `<div class="card"><h3>Balises en direct <small>OpenWindMap</small></h3>${live.map((s) => `<div class="small">📡 <b>${esc(s.name)}</b> : ${s.dir != null ? fmtBrg(s.dir) + ' ' : ''}${s.spd.toFixed(0)} nd (max ${s.gust.toFixed(0)}) <span class="muted">il y a ${Math.round(s.ageMin)} min</span></div>`).join('')}<div class="small muted" style="margin-top:4px">Autres sources : <a href="https://www.windguru.cz/48529" target="_blank" rel="noopener">Windguru Toulon</a> · <a href="https://meteofrance.com/previsions-meteo-marine/bulletin/cotier" target="_blank" rel="noopener">Bulletin côtier Météo-France</a> · <a href="https://www.windy.com/43.08/5.96?43.03,5.96,11" target="_blank" rel="noopener">Windy</a></div></div>`;
  el.innerHTML = html;
  $('#goObs2')?.addEventListener('click', () => openTab('course'));
  $$('[data-pick]', el).forEach((b) => b.addEventListener('click', () => { S.courseId = +b.dataset.pick; autoReplay = true; persist(); scheduleAnalysis(); openTab('course'); }));
}

function chartSVG(rows, isRace) {
  const W = 380, H = 170, x0 = 28, x1 = W - 6, y0 = 26, y1 = H - 22;
  const h0 = 6, h1 = 21;
  const xs = (h) => x0 + ((h - h0) / (h1 - h0)) * (x1 - x0);
  const r = rows.filter((x) => { const h = +x.time.slice(11, 13); return h >= h0 && h <= h1; });
  const vmax = Math.max(10, ...r.map((x) => Math.max(x.gust ?? 0, ...x.per.map((p) => p.spd)))) * 1.1;
  const ys = (v) => y1 - (v / vmax) * (y1 - y0);
  const hr = (x) => +x.time.slice(11, 13);
  const band = r.map((x) => [xs(hr(x)), ys(Math.max(...x.per.map((p) => p.spd)))]).concat(r.slice().reverse().map((x) => [xs(hr(x)), ys(Math.min(...x.per.map((p) => p.spd)))]));
  const line = (f) => r.filter((x) => f(x) != null).map((x, i) => `${i ? 'L' : 'M'}${xs(hr(x)).toFixed(1)},${ys(f(x)).toFixed(1)}`).join('');
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  const hh = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(v || ''); return m ? +m[1] + +m[2] / 60 : null; };
  const ws = isRace && hh(IC.firstWarning) != null ? hh(IC.firstWarning) : S.startTime, we = isRace && hh(IC.lastFinishSignal) != null ? hh(IC.lastFinishSignal) : ws + 3;
  s += `<rect x="${xs(ws)}" y="${y0}" width="${xs(we) - xs(ws)}" height="${y1 - y0}" fill="#ff8c00" opacity=".08"/>`;
  for (let v = 0; v <= vmax; v += vmax > 25 ? 10 : 5) s += `<line x1="${x0}" x2="${x1}" y1="${ys(v)}" y2="${ys(v)}" stroke="#e3e8ee"/><text x="${x0 - 4}" y="${ys(v) + 4}" font-size="10" text-anchor="end" fill="#5d6b7a">${v}</text>`;
  for (let h = h0; h <= h1; h += 3) s += `<text x="${xs(h)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#5d6b7a">${h}h</text>`;
  if (band.length > 2) s += `<path d="M${band.map((p) => p.join(',')).join('L')}Z" fill="#1673c9" opacity=".13"/>`;
  s += `<path d="${line((x) => x.gust)}" fill="none" stroke="#e8a400" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  s += `<path d="${line((x) => x.spd)}" fill="none" stroke="#0c2236" stroke-width="2.4"/>`;
  r.forEach((x) => { if (x.dir == null) return; const cx = xs(hr(x)); s += `<g transform="translate(${cx},${13}) rotate(${x.dir + 180})"><path d="M0,-7 L4,5 L0,2 L-4,5Z" fill="rgb(${speedColor(x.spd).join(',')})" stroke="#0c2236" stroke-width=".6"/></g>`; });
  s += `<line x1="${xs(S.hour)}" x2="${xs(S.hour)}" y1="${y0}" y2="${y1}" stroke="#ff8c00" stroke-width="1.5"/>`;
  return s + '</svg>';
}

// ───────────────────────── PARCOURS
function renderCourse() {
  const el = $('section[data-tab=course]');
  const c = COURSES.find((x) => x.id === S.courseId);
  const nObs = dayObs().length;
  let html = `<details class="card obsbox" ${S.obsOpen !== false ? 'open' : ''}><summary><span>🌬 Relevé de vent sur l’eau ${tip('Réglez la direction d’où vient le vent (compas) et sa force mesurée, puis Enregistrer. L’app compare votre relevé aux 6 modèles, garde celui qui colle le mieux et recale la prévision autour de cette heure. Plusieurs relevés dans la journée affinent le choix.')}</span><small>${S.src === 'manual' ? 'mode manuel' : `${nObs ? nObs + ' relevé(s) · ' : ''}modèle : ${esc(modelLabel(selectedModel()))}`}</small></summary><div class="obs-card"></div></details>
  <div class="card"><div class="row2"><div><label class="f">Parcours (cahier CVAT)</label><select id="cSel">${COURSES.map((x) => `<option value="${x.id}" ${x.id === S.courseId ? 'selected' : ''}>${x.title}</option>`).join('')}</select></div>
    <div><label class="f">Classes</label><select id="cCls"><option value="G" ${S.cls === 'G' ? 'selected' : ''}>C–D–L–R1-R3 (grand)</option><option value="P" ${S.cls === 'P' ? 'selected' : ''}>P1–P2 (petit)</option></select></div></div>
    <div class="row3">${c.laps ? `<div><label class="f">Tours</label><input id="cLaps" type="number" min="1" max="5" value="${S.laps}"></div>` : ''}${c.built === 'WL' ? `<div><label class="f">Dist. B (Nq)</label><input id="cWl" type="number" min="0.3" max="2" step="0.1" value="${S.wlNm}"></div>` : ''}
    <div><label class="f">Heure de départ</label><input id="cStart" type="text" inputmode="numeric" value="${hhmm(S.startTime)}"></div></div>
    <p class="small muted" style="margin:8px 0 0">${esc(c.text)}</p></div>`;
  if (!analysis) html += '<div class="card">Calcul en cours…</div>';
  else {
    const A = analysis, man = A.legs.reduce((s, l) => s + (l.route?.maneuvers || 0), 0);
    html += `<div class="card"><div class="kpis"><div class="kpi"><b>${(A.dist / NM).toFixed(1)}</b><span>Nq route directe${c.nm ? ` (cahier : ${c.nm[A.cls]})` : c.lapNm ? ` (${c.lapNm} Nq/tour)` : ''}</span></div><div class="kpi"><b>${summarizeTime(A.total * 3600)}</b><span>temps J80 estimé</span></div><div class="kpi"><b>${man}</b><span>virements / empannages</span></div></div>
      <div class="small muted" style="margin-top:6px">Arrivée estimée ≈ ${hhmm(S.startTime + A.total)}. Chaque bord est calculé avec le vent prévu à l’heure où vous le courez, depuis le meilleur point de la ligne de départ.</div><button class="btn acc" id="playCourse" style="width:100%;margin-top:8px">▶ Animer le parcours</button></div>`;
    html += `<div class="legs">` + A.legs.map((l, i) => {
      const chip = l.type.id === 'pres' ? 'pres' : l.type.sail.startsWith('Spi') ? 'spi' : 'reach';
      const ma = markAdvice(l, A.legs[i + 1]);
      return `<div class="leg ${selLeg === i ? 'sel' : ''}" data-i="${i}">
        <div class="hd"><span>${l.order ? `<span class="ord">${l.order}</span> ` : ''}${esc((/^\d/.test(l.to.name) ? 'n°' : '') + l.to.name)}${l.lap ? ` <span class="muted small">tour ${l.lap}</span>` : ''}</span>${l.side ? `<span class="chip ${l.side === 'b' ? 'port' : 'stbd'}">${sideName(l.side)}</span>` : ''}</div>
        <div class="meta">${fmtBrg(l.brg)} · ${fmtNm(l.dist)} · vent ${fmtBrg(l.wind.dir)} ${l.wind.spd.toFixed(0)} nd (raf. ${l.wind.gust.toFixed(0)}) · TWA ${Math.abs(l.twa).toFixed(0)}° · ${hhmm(l.eta0)}→${hhmm(l.eta1)} (${summarizeTime(l.time)})</div>
        <span class="chip ${chip}">${l.type.label}</span><span class="chip">${l.type.sail}</span>
        <ul class="tips">${l.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        ${ma.length ? `<div class="mark">${ma.map(esc).join('<br>')}</div>` : ''}
      </div>`;
    }).join('') + '</div>';
    html += `<div class="card small muted">Route optimale (pointillés bleus) : routage par isochrones sur le champ de vent local avec la polaire J80 (pénalité ~9 s par virement, ~6 s par empannage), évitement de la terre et de la zone interdite. Touchez un bord pour l’afficher seul avec ses lay-lines.</div>`;
  }
  el.innerHTML = html;
  renderObsAll();
  $('.obsbox', el).addEventListener('toggle', (e) => { S.obsOpen = e.target.open; persist(); });
  $('#cSel').onchange = (e) => { S.courseId = +e.target.value; selLeg = null; S.lineOverride = null; autoReplay = true; persist(); scheduleAnalysis(); renderCourse(); };
  $('#cCls').onchange = (e) => { S.cls = e.target.value; autoReplay = true; persist(); scheduleAnalysis(); };
  $('#playCourse')?.addEventListener('click', () => startReplay());
  if ($('#cLaps')) $('#cLaps').onchange = (e) => { S.laps = Math.max(1, Math.min(5, +e.target.value || 1)); persist(); scheduleAnalysis(); };
  if ($('#cWl')) $('#cWl').onchange = (e) => { S.wlNm = +e.target.value || 0.8; persist(); scheduleAnalysis(); };
  $('#cStart').onchange = (e) => { const m = /^(\d{1,2})[:h ]?(\d{2})?$/.exec(e.target.value.trim()); if (m) { S.startTime = +m[1] + (+m[2] || 0) / 60; S.hour = Math.floor(S.startTime * 4) / 4; persist(); updateAll(); } };
  $$('.leg', el).forEach((d) => d.addEventListener('click', () => {
    const i = +d.dataset.i; selLeg = selLeg === i ? null : i;
    scene.setCourse(analysis, selLeg);
    $$('.leg', el).forEach((x) => x.classList.toggle('sel', +x.dataset.i === selLeg));
    if (selLeg != null && scene.replay) scene.replayControl('seek', replayLegStarts[i] ?? 0);
    if (selLeg != null) { const l = analysis.legs[i]; scene.focus([l.from, l.to], 1.6); S.hour = Math.min(21, Math.floor(l.eta0 * 4) / 4); $('#hour').value = S.hour; $('#hourLbl').textContent = hhmm(S.hour); updateDisplayField(); }
  }));
}

// ───────────────────────── DÉPART
let timer = { end: null, running: false, iv: null, beeps: new Set() };
function renderStart() {
  const el = $('section[data-tab=start]');
  const A = analysis;
  let html = `<div class="card"><h3>Ligne de départ ${tip('Position théorique de la ligne selon le cahier. Sur l’eau, passez au ras du bateau Comité et de la bouée et « pinguez » pour enregistrer la vraie ligne.')}</h3>
    <label class="f">Position de la ligne</label><select id="lPre">${Object.entries(LINE_PRESETS).map(([k, v]) => `<option value="${k}" ${k === S.linePreset ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
    <div class="row2"><div><label class="f">Longueur (Nq)</label><input id="lLen" type="number" min="0.04" max="0.4" step="0.01" value="${S.lineLen}"></div>
    <div><label class="f">Orientation</label><select id="lMode"><option value="wind" ${S.lineMode === 'wind' ? 'selected' : ''}>⟂ au vent local</option><option value="axis" ${S.lineMode === 'axis' ? 'selected' : ''}>⟂ au 1er bord</option><option value="fixed" ${S.lineMode === 'fixed' ? 'selected' : ''}>Cap saisi</option></select></div></div>
    ${S.lineMode === 'fixed' ? `<label class="f">Regard au vent depuis la ligne (°)</label><input id="lBrg" type="number" min="0" max="359" value="${S.lineBrg}">` : ''}
    <div class="btns"><button class="btn small acc" id="pingCb">📍 Ping Comité (GPS)</button><button class="btn small acc" id="pingPin">📍 Ping Bouée (GPS)</button>${S.lineOverride ? '<button class="btn small alt" id="lReset">Ligne théorique</button>' : ''}</div>
    <div class="small muted" style="margin-top:6px">Sur l’eau : passez au ras du Comité puis de la bouée et « pinguez » ; ou touchez la carte → « Comité ici / Bouée ici ». Comité à tribord de la ligne (IC 10.2).</div></div>`;
  if (A) {
    const st = A.start;
    html += `<div class="card"><h3><span>Analyse de la ligne ${tip('Biais = écart entre la perpendiculaire au vent et la ligne. L’extrémité favorisée est la plus au vent (1er bord au près) ou la plus proche de la marque (1er bord portant). Le routage indique aussi le point de la ligne qui mène le plus vite à la 1re marque.')}</span><small>à ${hhmm(S.startTime)}</small></h3>
      <div class="kpis"><div class="kpi"><b>${Math.abs(st.bias).toFixed(0)}°</b><span>biais</span></div><div class="kpi"><b>${st.favored === 'aucun' ? '=' : st.favored}</b><span>extrémité favorisée</span></div><div class="kpi"><b>${Math.round(st.len)} m</b><span>longueur · ${fmtBrg(st.lineBrg)}</span></div></div>
      <ul class="tips">${st.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      ${A.legs[0]?.advice?.length ? `<div class="mark small" style="background:#f2f6fa;border-radius:8px;padding:6px 8px;margin-top:6px"><b>Premier bord</b> : ${esc(A.legs[0].advice.slice(0, 3).join(' '))}</div>` : ''}</div>`;
  }
  html += `<div class="card timer"><h3>Chrono de départ <small>règle 26 : 5-4-1-0</small></h3>
    <div class="clock" id="tClock">5:00</div><div class="phase" id="tPhase">Prêt</div>
    <div class="btns" style="justify-content:center"><button class="btn acc" id="t5">Top 5’ (avertissement)</button><button class="btn" id="t4">Top 4’</button><button class="btn" id="t1">Top 1’</button></div>
    <div class="btns" style="justify-content:center"><button class="btn alt small" id="tm">−1 min</button><button class="btn alt small" id="tp">+1 min</button><button class="btn alt small" id="tsync">Arrondir à la minute</button><button class="btn alt small" id="tstop">Stop</button></div>
    <table class="t" style="margin-top:8px">${IC.sequence.map((r) => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>
    <div class="small muted">Bips aux minutes, toutes les 10 s dans la dernière minute et chaque seconde les 10 dernières. Le temps se compte sur les signaux visuels (IC 10.1).</div></div>`;
  el.innerHTML = html;
  $('#lPre').onchange = (e) => { S.linePreset = e.target.value; S.lineOverride = null; persist(); scheduleAnalysis(); };
  $('#lLen').onchange = (e) => { S.lineLen = Math.max(0.04, +e.target.value || 0.12); S.lineOverride = null; persist(); scheduleAnalysis(); };
  $('#lMode').onchange = (e) => { S.lineMode = e.target.value; S.lineOverride = null; persist(); scheduleAnalysis(); renderStart(); };
  if ($('#lBrg')) $('#lBrg').onchange = (e) => { S.lineBrg = norm360(+e.target.value || 0); persist(); scheduleAnalysis(); };
  $('#lReset')?.addEventListener('click', () => { S.lineOverride = null; persist(); scheduleAnalysis(); });
  $('#pingCb').onclick = () => pingLine('cb');
  $('#pingPin').onclick = () => pingLine('pin');
  const setT = (sec) => { audioInit(); timer.end = Date.now() + sec * 1000; timer.beeps.clear(); startTimer(); };
  $('#t5').onclick = () => setT(300); $('#t4').onclick = () => setT(240); $('#t1').onclick = () => setT(60);
  $('#tm').onclick = () => { if (timer.end) timer.end -= 60000; }; $('#tp').onclick = () => { if (timer.end) timer.end += 60000; };
  $('#tsync').onclick = () => { if (timer.end) { const r = (timer.end - Date.now()) / 1000; timer.end = Date.now() + Math.round(r / 60) * 60000; } };
  $('#tstop').onclick = () => { timer.end = null; clearInterval(timer.iv); timer.iv = null; $('#tClock').textContent = '5:00'; $('#tPhase').textContent = 'Prêt'; };
  if (timer.iv) tickTimer();
}
function pingLine(which) {
  if (!navigator.geolocation) return toast('GPS indisponible');
  navigator.geolocation.getCurrentPosition((p) => setLineEnd(which, { lat: p.coords.latitude, lon: p.coords.longitude }), (e) => toast('GPS : ' + e.message), { enableHighAccuracy: true, timeout: 15000 });
}
let actx = null;
function audioInit() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch { /* audio indisponible */ } }
function beep(f = 880, d = 0.12) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; o.connect(g); g.connect(actx.destination);
  g.gain.setValueAtTime(0.4, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d); o.start(); o.stop(actx.currentTime + d);
  navigator.vibrate?.(d * 1000);
}
function startTimer() { clearInterval(timer.iv); timer.iv = setInterval(tickTimer, 100); tickTimer(); }
function tickTimer() {
  const c = $('#tClock'), ph = $('#tPhase'); if (!timer.end) return;
  const r = (timer.end - Date.now()) / 1000, s = Math.ceil(r);
  if (r > 0) {
    if (c) c.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (ph) ph.textContent = s > 240 ? 'Avertissement — pavillon de classe' : s > 60 ? 'Préparatoire (P / I / U / Z / Noir)' : 'Dernière minute !';
    const key = s;
    if (!timer.beeps.has(key) && ((s % 60 === 0) || (s <= 60 && s % 10 === 0) || s <= 10)) { timer.beeps.add(key); beep(s % 60 === 0 ? 660 : 880, s % 60 === 0 ? 0.5 : 0.12); }
  } else {
    const e = -r;
    if (c) c.textContent = `+${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, '0')}`;
    if (ph) ph.textContent = e < 600 ? 'PARTI ! (départ possible jusqu’à H+10’)' : 'En course';
    if (!timer.beeps.has('go')) { timer.beeps.add('go'); beep(990, 1.0); }
  }
  const lc = $('#liveClock'); if (lc && c) lc.textContent = c.textContent;
}

// ───────────────────────── EN COURSE
function startGps() {
  if (gps?.watch) return;
  if (!navigator.geolocation) { toast('GPS indisponible sur cet appareil'); return; }
  gps = { watch: null, pos: null, hist: [] };
  gps.watch = navigator.geolocation.watchPosition((p) => {
    const q = { ...toXY(p.coords.latitude, p.coords.longitude), t: p.timestamp, acc: p.coords.accuracy, lat: p.coords.latitude, lon: p.coords.longitude };
    gps.hist.push(q); gps.hist = gps.hist.filter((h) => q.t - h.t < 20000);
    const o = gps.hist[0], dt = (q.t - o.t) / 1000;
    if (dt > 3 && distXY(o, q) > 3) { q.sog = distXY(o, q) / dt / 0.5144; q.cog = bearingXY(o, q); }
    else if (p.coords.speed != null) { q.sog = p.coords.speed / 0.5144; q.cog = p.coords.heading; }
    gps.pos = q;
    scene.setBoat(q, q.cog);
    if (follow) { const t = scene.controls.target, off = scene.camera.position.clone().sub(t); t.set(q.x, 0, -q.y); scene.camera.position.copy(t.clone().add(off)); }
    if (recorder.active) recorder.add(q);
    autoAdvance();
    renderLiveNav();
  }, (e) => { gps.err = e.message; renderLiveNav(); }, { enableHighAccuracy: true, maximumAge: 1000 });
  renderLive();
}
async function stopGps() {
  if (recorder.active) { const tr = await recorder.stop(); if (tr?.pts.length > 1) toast(`Trace enregistrée (${tr.pts.length} points)`); renderTracks(); }
  if (gps?.watch != null) navigator.geolocation.clearWatch(gps.watch); gps = null; scene.setBoat(null); renderLive();
}
function autoAdvance() {
  if (!analysis || !gps?.pos) return;
  const l = analysis.legs[nextIdx]; if (!l) return;
  if (distXY(gps.pos, l.to) < 40 && nextIdx < analysis.legs.length - 1) nextIdx++;
}
// Onglet « En course » : cadre fixe + zones mises à jour à chaque position GPS
const recorder = new Recorder();
let rest = null;
function renderLive() {
  const el = $('section[data-tab=live]');
  el.innerHTML = `<div class="card" id="liveGps"></div>
    <div class="card"><h3><span>Trace ${tip('Enregistre votre position toutes les 1–2 s pendant la course. L’écran reste allumé pendant l’enregistrement (sur iPhone, le GPS s’arrête si l’écran se verrouille). Les traces se retrouvent dans l’onglet Traces.')}</span></h3><div id="liveRec"></div></div>
    <div class="card timer"><div class="small muted">Chrono</div><div class="clock" id="liveClock" style="font-size:40px">—</div></div>
    <div class="card" id="liveNav"></div>
    <div class="card"><h3><span>Suite du parcours ${tip('Recalcule les bords restants depuis votre position GPS, à l’heure actuelle, avec le modèle retenu par vos relevés et l’ajustement sur le dernier relevé. Fait automatiquement après chaque nouveau relevé si le GPS est actif.')}</span></h3><div id="livePlan"></div></div>
    <details class="card obsbox" open><summary><span>🌬 Relevé de vent</span><small>sans quitter l’onglet</small></summary><div class="obs-card"></div></details>`;
  renderLiveNav(); renderPlan(); renderObsAll();
  if (timer.iv) tickTimer();
}
function renderLiveNav() {
  const g = $('#liveGps'), n = $('#liveNav'), r = $('#liveRec'); if (!g) return;
  const A = analysis, p = gps?.pos;
  g.innerHTML = `<div class="btns" style="margin:0">${gps ? '<button class="btn alt" id="gOff">Arrêter le GPS</button>' : '<button class="btn acc" id="gOn">▶ Activer le GPS</button>'}<span class="small muted" style="align-self:center">${gps?.err ? 'Erreur : ' + esc(gps.err) : p ? `précision ±${Math.round(p.acc)} m` : gps ? 'Recherche…' : 'Position, vitesse et cap du bateau'}</span></div>`;
  $('#gOn')?.addEventListener('click', startGps); $('#gOff')?.addEventListener('click', stopGps);
  const T = recorder.track;
  r.innerHTML = T ? `<div class="btns" style="margin:0"><button class="btn rec" id="recStop">⏹ Arrêter et enregistrer</button><span class="small" style="align-self:center"><span class="recdot"></span>${T.pts.length} points · ${summarizeTime((Date.now() - T.start) / 1000)}</span></div>`
    : `<div class="btns" style="margin:0"><button class="btn acc" id="recStart">⏺ Enregistrer ma trace</button></div>`;
  $('#recStart')?.addEventListener('click', () => {
    if (!gps) startGps();
    const c = COURSES.find((x) => x.id === S.courseId);
    recorder.start({ name: `${dayName(today())} — ${c.title}`, course: { id: S.courseId, cls: S.cls, laps: S.laps, day: S.day, startTime: S.startTime } });
    toast('Enregistrement lancé : gardez l’app ouverte, écran allumé.'); renderLiveNav();
  });
  $('#recStop')?.addEventListener('click', async () => { const tr = await recorder.stop(); toast(tr && tr.pts.length > 1 ? `Trace enregistrée (${tr.pts.length} points) — onglet Traces` : 'Trace trop courte, non enregistrée'); renderLiveNav(); renderTracks(); });
  if (!A) { n.innerHTML = '<p class="small muted">Choisissez un parcours (onglet Parcours).</p>'; return; }
  nextIdx = Math.min(nextIdx, A.legs.length - 1);
  const l = A.legs[nextIdx];
  let html = `<h3>Prochaine marque</h3><select id="nSel">${A.legs.map((x, i) => `<option value="${i}" ${i === nextIdx ? 'selected' : ''}>${x.order ? 'Marque ' + x.order + ' — ' : ''}${esc((/^\d/.test(x.to.name) ? 'n°' : '') + x.to.name)}${x.side ? ' (' + sideName(x.side) + ')' : ''}</option>`).join('')}</select>`;
  if (p) {
    const brg = bearingXY(p, l.to), d = distXY(p, l.to), w = F.sample(p.x, p.y);
    const twaM = norm180(brg - w.dir), { up, down } = optimalAngles(Math.max(1, w.spd));
    const vmc = p.sog != null && p.cog != null ? p.sog * Math.cos((p.cog - brg) * Math.PI / 180) : null;
    const eta = vmc > 0.3 ? d / (vmc * 0.5144) : null;
    let rec = '';
    if (Math.abs(twaM) < up.twa) {
      const stb = norm360(w.dir - up.twa), prt = norm360(w.dir + up.twa);
      const onStbLay = Math.abs(norm180(brg - stb)) < 3, onPrtLay = Math.abs(norm180(brg - prt)) < 3;
      rec = `Marque au vent : caps ${fmtBrg(stb)} (tribord) / ${fmtBrg(prt)} (bâbord). ${onStbLay ? '<b>Sur la lay-line tribord.</b>' : onPrtLay ? '<b>Sur la lay-line bâbord.</b>' : `Bord rapprochant : ${Math.abs(norm180(brg - stb)) < Math.abs(norm180(brg - prt)) ? 'tribord' : 'bâbord'} amures.`}`;
    } else if (Math.abs(twaM) > down.twa) rec = `Marque sous le vent : empanner pour rester vers ${Math.round(down.twa)}° de TWA (caps ${fmtBrg(norm360(w.dir + 180 - (180 - down.twa)))} / ${fmtBrg(norm360(w.dir + 180 + (180 - down.twa)))}).`;
    else rec = `Route directe possible : TWA ${Math.abs(twaM).toFixed(0)}° ${twaM > 0 ? 'bâbord' : 'tribord'} amures — ${Math.abs(twaM) > spiMinTwa(w.spd) ? 'spi' : 'foc'}. Cible ${boatSpeed(w.spd, twaM).toFixed(1)} nd.`;
    html += `<div class="kpis" style="margin-top:8px"><div class="kpi live"><b class="big">${fmtBrg(brg)}</b><span>relèvement</span></div><div class="kpi"><b class="big" style="font-size:28px">${(d / NM).toFixed(2)}</b><span>Nq</span></div><div class="kpi"><b>${eta ? summarizeTime(eta) : '—'}</b><span>ETA (VMC ${vmc != null ? vmc.toFixed(1) : '—'} nd)</span></div></div>
      <div class="kpis" style="margin-top:8px"><div class="kpi"><b>${p.sog != null ? p.sog.toFixed(1) : '—'}</b><span>SOG nd</span></div><div class="kpi"><b>${p.cog != null ? fmtBrg(p.cog) : '—'}</b><span>COG</span></div><div class="kpi"><b>${fmtBrg(w.dir)}</b><span>vent modèle ${w.spd.toFixed(0)} nd</span></div></div>
      <p class="small">${rec}</p>`;
  } else html += `<p class="small muted">Activez le GPS pour le relèvement, la distance et l’ETA vers la marque.</p>`;
  html += `<div class="btns"><button class="btn alt small" id="nPrev">◀ Marque précédente</button><button class="btn small" id="nNext">Marque passée ▶</button></div>`;
  n.innerHTML = html;
  $('#nSel').addEventListener('change', (e) => { nextIdx = +e.target.value; renderLiveNav(); });
  $('#nPrev').addEventListener('click', () => { nextIdx = Math.max(0, nextIdx - 1); renderLiveNav(); });
  $('#nNext').addEventListener('click', () => { nextIdx = Math.min(analysis.legs.length - 1, nextIdx + 1); renderLiveNav(); if (rest) planRest(); });
}

// Recalcul des bords restants depuis la position actuelle, à l'heure actuelle
async function planRest() {
  if (!analysis) return;
  const pos = gps?.pos || (obsPos && toXY(obsPos.lat, obsPos.lon));
  if (!pos) { toast('Activez le GPS (ou touchez la carte → « Relevé de vent ici ») pour situer le bateau.'); return; }
  const t0 = S.day === today() ? nowHour() : analysis.legs[nextIdx].eta0;
  const ctx = { terrain: T, forbidden, perf: S.perf, trend: analysis.trend };
  const legs = []; let t = t0, lastH = -1;
  for (let i = nextIdx; i < analysis.legs.length; i++) {
    const src = analysis.legs[i];
    const leg = { from: i === nextIdx ? { x: pos.x, y: pos.y, name: 'Bateau' } : legs[legs.length - 1].to, to: src.to, side: src.side, mark: src.mark, lap: src.lap };
    leg.brg = bearingXY(leg.from, leg.to); leg.dist = distXY(leg.from, leg.to);
    if (S.src === 'forecast' && Math.abs(t - lastH) >= 0.25) { computeField(S.day, t); lastH = t; }
    const a = analyzeLeg(leg, F, ctx); a.order = src.order; a.eta0 = t; t += a.time / 3600; a.eta1 = t;
    legs.push(a);
    await new Promise((r) => setTimeout(r, 0));
  }
  rest = { legs, t0, t1: t, model: modelLabel(selectedModel()), obs: dayObs().length };
  updateDisplayField();
  scene.setCourse({ legs }, null);
  renderPlan();
}
function renderPlan() {
  const el = $('#livePlan'); if (!el) return;
  if (!rest) { el.innerHTML = `<p class="small muted">Plan initial (calculé depuis la ligne de départ à ${hhmm(S.startTime)}).</p><button class="btn acc" id="planGo" style="width:100%">↻ Recalculer la suite depuis ma position</button>`; $('#planGo').onclick = planRest; return; }
  el.innerHTML = `<p class="small">Recalculé à ${hhmm(rest.t0)} · modèle ${esc(rest.model)}${rest.obs ? ` + ${rest.obs} relevé(s)` : ''} · arrivée estimée <b>${hhmm(rest.t1)}</b></p>
    ${rest.legs.map((l) => `<div class="small" style="border-top:1px solid var(--line);padding:6px 0">${l.order ? `<span class="ord">${l.order}</span>` : ''}<b>${esc((/^\d/.test(l.to.name) ? 'n°' : '') + l.to.name)}</b> · ${hhmm(l.eta0)}→${hhmm(l.eta1)} · ${esc(l.type.label)} · vent ${fmtBrg(l.wind.dir)} ${l.wind.spd.toFixed(0)} nd<br>${esc(l.advice[1] || l.advice[0] || '')}</div>`).join('')}
    <div class="btns"><button class="btn acc small" id="planGo">↻ Recalculer</button><button class="btn alt small" id="planReset">Revenir au plan initial</button></div>`;
  $('#planGo').onclick = planRest;
  $('#planReset').onclick = () => { rest = null; drawCourse(); renderPlan(); };
}

// ───────────────────────── TRACES
let traceView = null;
function trackWindAt(day) {
  const cache = new Map();
  return (x, y, tMs) => {
    const d = new Date(tMs), h = Math.round((d.getHours() + d.getMinutes() / 60) * 4) / 4;
    let pts = cache.get(h);
    if (!pts) { pts = S.src === 'manual' || !data ? [{ x: 0, y: 0, ...S.manual }] : (modelPoints(data, day, h, selectedModel()) || [{ x: 0, y: 0, ...S.manual }]); if (S.nowcast) pts = applyResiduals(pts, day, h); cache.set(h, pts); }
    return idwAt(pts, x, y);
  };
}
async function renderTracks() {
  const el = $('section[data-tab=tracks]'); if (!el) return;
  let list = [];
  try { list = await listTracks(); } catch { /* IndexedDB indisponible */ }
  let html = `<div class="card"><h3><span>Mes traces ${tip('Traces enregistrées dans l’onglet En course, ou importées (GPX d’un autre GPS, d’un équipier). Elles restent sur cet appareil ; exportez-les en GPX pour les garder ou les partager.')}</span></h3>
    ${list.length ? list.map((t) => `<div class="trow"><div><b>${esc(t.name)}</b><div class="small muted">${new Date(t.start).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${t.n} points</div></div><div class="btns" style="margin:0"><button class="btn small" data-tv="${t.id}">Analyser</button><button class="btn small alt" data-tx="${t.id}">GPX</button><button class="btn small alt" data-td="${t.id}" aria-label="Supprimer">✕</button></div></div>`).join('') : '<p class="small muted">Aucune trace. Lancez « Enregistrer ma trace » dans l’onglet En course.</p>'}
    <label class="f" for="gpxIn">Importer un fichier GPX</label><input type="file" id="gpxIn" accept=".gpx,application/gpx+xml,application/xml,text/xml"></div><div id="traceDetail"></div>`;
  el.innerHTML = html;
  $$('[data-tv]', el).forEach((b) => b.onclick = () => showTrace(b.dataset.tv));
  $$('[data-tx]', el).forEach((b) => b.onclick = async () => exportGPX(await getTrack(b.dataset.tx)));
  $$('[data-td]', el).forEach((b) => b.onclick = async () => {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Supprimer ?'; return; }
    await deleteTrack(b.dataset.td); if (traceView?.id === b.dataset.td) { traceView = null; scene.setTrace(null); } renderTracks();
  });
  $('#gpxIn').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const tr = fromGPX(await f.text(), f.name); await saveTrack(tr); toast(`Trace importée : ${tr.pts.length} points`); renderTracks(); showTrace(tr.id); } catch (err) { toast('Import impossible : ' + err.message); }
  };
  if (traceView) renderTraceDetail();
}
async function showTrace(id) {
  const tr = await getTrack(id); if (!tr) return;
  const d = new Date(tr.start), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sameCourse = analysis && tr.course && tr.course.id === analysis.course.id && tr.course.cls === analysis.cls;
  const res = analyzeTrack(tr, { windAt: trackWindAt(day), boatSpeed, legs: sameCourse ? analysis.legs.filter((l) => l.order) : null });
  if (!res) { toast('Trace vide'); return; }
  traceView = { id, tr, res, sameCourse };
  scene.setTrace(res.P, res.man);
  scene.focus(res.P.filter((_, i) => i % 10 === 0));
  renderTraceDetail();
}
function renderTraceDetail() {
  const el = $('#traceDetail'); if (!el || !traceView) return;
  const { tr, res, sameCourse } = traceView;
  const nT = res.man.filter((m) => m.kind === 'virement').length, nE = res.man.length - nT;
  const sp = res.split.filter((s) => !s.missed);
  const worst = sp.filter((s) => s.plan && s.t - s.plan > 30).sort((a, b) => (b.t - b.plan) - (a.t - a.plan))[0];
  el.innerHTML = `<div class="card"><h3><span>${esc(tr.name)}</span><small>${new Date(tr.start).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}</small></h3>
    <div class="kpis"><div class="kpi"><b>${(res.dist / NM).toFixed(1)}</b><span>Nq parcourus</span></div><div class="kpi"><b>${summarizeTime(res.dur)}</b><span>durée</span></div><div class="kpi"><b>${res.vmean.toFixed(1)}</b><span>nd moyen (max ${res.vmax.toFixed(1)})</span></div></div>
    <div class="kpis" style="margin-top:8px"><div class="kpi"><b>${nT}</b><span>virements</span></div><div class="kpi"><b>${nE}</b><span>empannages</span></div><div class="kpi"><b>${res.perf ? Math.round(res.perf * 100) + ' %' : '—'}</b><span>de la polaire ${tip('Vitesse mesurée ÷ vitesse cible de la polaire J80 pour le vent du modèle à cet endroit et cette heure. Indicatif : le vent réel peut différer du modèle.')}</span></div></div>
    <div class="btns"><button class="btn acc" id="trPlay">▶ Rejouer la trace</button><button class="btn alt" id="trGpx">Exporter GPX</button><button class="btn alt" id="trHide">Masquer</button></div>
    ${sameCourse ? (sp.length ? `<h3 style="margin-top:12px">Bord par bord ${tip('Temps réel entre deux marques comparé au temps du routage optimal (même vent modèle). Un écart positif = temps perdu.')}</h3><table class="t"><tr><th>Marque</th><th>Réel</th><th>Optimal</th><th>Écart</th><th>Polaire</th></tr>${res.split.map((s) => s.missed ? `<tr><td>${s.leg.order} · ${esc(s.leg.to.name)}</td><td colspan="4" class="muted">non détectée</td></tr>` : `<tr><td>${s.leg.order} · ${esc(s.leg.to.name)}</td><td>${summarizeTime(s.t)}</td><td>${summarizeTime(s.plan)}</td><td style="color:${s.t > s.plan ? 'var(--bad)' : 'var(--ok)'}">${s.t > s.plan ? '+' : '−'}${summarizeTime(Math.abs(s.t - s.plan))}</td><td>${s.pct ? Math.round(s.pct * 100) + ' %' : '—'}</td></tr>`).join('')}</table>${worst ? `<p class="small">Bord le plus coûteux : vers <b>${esc(worst.leg.to.name)}</b> (${summarizeTime(worst.t - worst.plan)} de plus que l’optimal). Rejouez-le en comparant à la route bleue.</p>` : ''}` : '<p class="small muted">Aucune marque du parcours détectée sur cette trace (passage à plus de 250 m).</p>')
      : '<p class="small muted">Pour le découpage bord par bord, sélectionnez dans l’onglet Parcours le parcours couru (même numéro et même classe).</p>'}
    <p class="small muted">Couleur de la trace : du bleu (lent) au rouge (rapide). V = virement, E = empannage.</p></div>`;
  $('#trPlay').onclick = () => {
    const t0 = res.P[0].t;
    scene.setReplay(res.P.map((p) => ({ x: p.x, y: p.y, t: (p.t - t0) / 1000, hd: p.hd, twa: p.twa, bsp: p.v, spi: Math.abs(p.twa) > 110, trace: true, pct: p.pct, abs: p.t })));
    $('#replayHud').hidden = false; scene.replayControl('speed', +$('#rhSpeed').value);
  };
  $('#trGpx').onclick = () => exportGPX(tr);
  $('#trHide').onclick = () => { traceView = null; scene.setTrace(null); el.innerHTML = ''; };
}

// ───────────────────────── VENT
const PRESETS = [
  ['Mistral fort', 315, 25, 34], ['Mistral modéré', 310, 16, 23], ['Ouest', 265, 14, 19], ['Brise SO', 215, 10, 13],
  ['Marin SE', 140, 14, 19], ['Levant E', 85, 12, 17], ['NE de terre', 40, 6, 10], ['Petit temps', 180, 4, 6],
];
function renderWind() {
  const el = $('section[data-tab=wind]');
  const m = S.manual;
  el.innerHTML = `<div class="card"><h3>Vent manuel <small>toute situation météo</small></h3>
    <div class="btns" style="margin-top:0">${PRESETS.map((p, i) => `<button class="btn small alt" data-p="${i}">${p[0]}</button>`).join('')}</div>
    <label class="f">Direction (d’où vient le vent) : <b id="mDirL">${fmtBrg(m.dir)} ${cardinal(m.dir)}</b></label><input id="mDir" type="range" min="0" max="355" step="5" value="${m.dir}">
    <label class="f">Vent moyen : <b id="mSpdL">${m.spd} nd</b></label><input id="mSpd" type="range" min="1" max="40" step="1" value="${m.spd}">
    <label class="f">Rafales : <b id="mGL">${m.gust} nd</b></label><input id="mG" type="range" min="1" max="50" step="1" value="${m.gust}">
    <div class="btns"><button class="btn ${S.src === 'manual' ? 'alt' : 'acc'}" id="mUse">${S.src === 'manual' ? 'Revenir aux prévisions' : 'Utiliser ce vent'}</button></div></div>
  <div class="card"><h3>Vent relevé sur l’eau <small>choix du modèle</small></h3><div class="obs-card"></div></div>
  <div class="card"><h3>Actualiser le vent pendant la course</h3><ol class="guide small">
    <li><b>Avant de partir</b> : ⟳ en haut pour télécharger les dernières prévisions (6 modèles, AROME HD sur 24 points de la zone).</li>
    <li><b>Sur zone</b> : faites un <b>relevé</b> (onglet Parcours ou En course) : direction d’où vient le vent au compas, force moyenne. Idéalement bateau arrêté face au vent, ou girouette + compas, en dehors des dévents.</li>
    <li>L’app <b>compare le relevé aux 6 modèles</b> et retient celui qui colle le mieux ; plus il y a de relevés, plus le choix est sûr (les plus récents comptent davantage).</li>
    <li>Elle <b>recale ensuite la prévision</b> sur votre mesure : l’écart (rotation et force) s’applique pleinement à l’heure du relevé puis s’estompe en 2 à 3 h, pour laisser revenir la tendance du modèle (ex. une rotation prévue l’après-midi reste prise en compte).</li>
    <li><b>Pour la suite du parcours</b> : onglet En course → « Recalculer la suite depuis ma position ». Chaque bord restant est routé avec le vent prévu <i>à l’heure où vous le courrez</i>, effets du relief compris. Après chaque nouveau relevé, si le GPS est actif, ce recalcul se fait tout seul.</li>
    <li>Un relevé toutes les 20–30 min, ou dès qu’une bascule nette apparaît, suffit. Supprimez un relevé douteux (✕) : tout se recalcule.</li></ol></div>
  <div class="card"><h3>Effets locaux du relief</h3><label class="f">Intensité : <b id="fxL">${Math.round(S.localFx * 100)} %</b></label><input id="fx" type="range" min="0" max="1.5" step="0.1" value="${S.localFx}">
    <div class="small muted">0 % = vent prévu seul ; 100 % = corrections normales ; au-delà = effets accentués (situation stable, vent de terre).</div></div>
  <div class="card"><h3>Comment est calculé le vent ?</h3><ul class="tips small">
    <li><b>Prévisions</b> : AROME HD 1,3 km de Météo-France sur 24 points de la zone (interpolés), comparé à AROME 2,5 km, ARPEGE, ECMWF, ICON-EU et GFS (écart = confiance). Données Open-Meteo, mises en cache pour l’usage hors réseau.</li>
    <li><b>Contournement du relief</b> : écoulement 2D où la terre haute fait obstacle — accélérations aux caps (Cépet, Sicié, Cap Brun) et dans les passes, déviations le long des côtes.</li>
    <li><b>Dévent</b> : sous le vent d’un relief (falaises, collines, ville), perte de vitesse et rafales plus marquées ; d’autant plus que le relief est haut et proche.</li>
    <li><b>Frottement côtier</b> : près d’une côte au vent, le vent est légèrement « reculé » (tourné à gauche) puis adonne en s’éloignant au large.</li>
    <li>Modèle heuristique pour la tactique : il indique les tendances (où est la pression, de quel côté le vent tourne) ; il ne remplace pas l’observation sur l’eau.</li></ul>
    <div class="small muted">Relief : AWS Terrain Tiles · Bathymétrie : EMODnet · Côte et bouées : © contributeurs OpenStreetMap (ODbL).</div></div>`;
  const upd = () => { $('#mDirL').textContent = `${fmtBrg(S.manual.dir)} ${cardinal(S.manual.dir)}`; $('#mSpdL').textContent = `${S.manual.spd} nd`; $('#mGL').textContent = `${S.manual.gust} nd`; if (S.src === 'manual') { updateDisplayField(); scheduleAnalysis(); } persist(); };
  $('#mDir').oninput = (e) => { S.manual.dir = +e.target.value; upd(); };
  $('#mSpd').oninput = (e) => { S.manual.spd = +e.target.value; if (S.manual.gust < S.manual.spd) { S.manual.gust = S.manual.spd; $('#mG').value = S.manual.gust; } upd(); };
  $('#mG').oninput = (e) => { S.manual.gust = Math.max(+e.target.value, S.manual.spd); upd(); };
  $$('[data-p]', el).forEach((b) => b.onclick = () => { const p = PRESETS[+b.dataset.p]; S.manual = { dir: p[1], spd: p[2], gust: p[3] }; S.src = 'manual'; persist(); updateAll(); });
  $('#mUse').onclick = () => { S.src = S.src === 'manual' ? 'forecast' : 'manual'; persist(); updateAll(); };
  $('#fx').oninput = (e) => { S.localFx = +e.target.value; $('#fxL').textContent = `${Math.round(S.localFx * 100)} %`; };
  $('#fx').onchange = () => { persist(); refreshObs(); updateDisplayField(); scheduleAnalysis(); };
  renderObsAll();
}

// ───────────────────────── J80
function renderJ80Tab() {
  const el = $('section[data-tab=j80]');
  renderJ80(el, {
    onImport: (text, name) => {
      const p = parsePolar(text);
      setPolar(p.tws, p.twa, p.bsp, name);
      S.polar = { ...p, source: name }; persist(); renderJ80Tab(); scheduleAnalysis();
    },
    onReset: () => { resetPolar(); S.polar = null; persist(); renderJ80Tab(); scheduleAnalysis(); },
    perf: S.perf,
    onPerf: (v) => { S.perf = v; persist(); scheduleAnalysis(); },
    wind: analysis?.legs?.[0]?.wind,
  });
}

// ───────────────────────── IC
let icDraft = null;
function renderIC() {
  const el = $('section[data-tab=ic]');
  IC = currentEvent();
  const st = eventsState();
  const tel = /(0[1-9](?:[ .-]?\d{2}){4})/.exec(IC.committee || '')?.[1];
  let html = `<div class="card"><h3><span>Régate ${tip('Chaque régate a sa fiche, remplie depuis ses Instructions de Course. La régate choisie fixe le jour 🏁, l’heure de départ par défaut et les points clés affichés.')}</span></h3>
    <div class="row2"><div><select id="evSel">${st.list.map((e) => `<option value="${esc(e.id)}" ${e.id === st.current ? 'selected' : ''}>${esc(e.event)}${e.date ? ' — ' + esc(e.date) : ''}</option>`).join('')}</select></div>
    <div class="btns" style="margin:0"><label class="btn acc small" for="icFile" style="cursor:pointer">＋ Importer des IC (PDF)</label><button class="btn alt small" id="evEdit">Modifier</button></div></div>
    <input type="file" id="icFile" accept="application/pdf,.pdf,.txt,text/plain" hidden>
    <div class="small muted" id="icMsg" style="margin-top:6px">L’app lit le PDF des IC, propose la fiche (date, heures, VHF, Comité, zone, points clés) : vérifiez puis enregistrez.</div></div>`;
  if (icDraft) html += eventForm(icDraft);
  html += `<div class="card"><h3>${esc(IC.event)} <small>${IC.date ? esc(dayName(IC.date)) : 'date à préciser'}</small></h3>
    <div class="kpis"><div class="kpi"><b>${esc(IC.firstWarning || '—')}</b><span>1er avertissement</span></div><div class="kpi"><b>${esc(IC.lastFinishSignal || '—')}</b><span>limite arrivée du 1er</span></div><div class="kpi"><b>VHF ${esc(IC.vhf ?? '—')}</b><span>canal de course</span></div></div>
    <p class="small">${IC.committee ? `Comité : ${tel ? `<a href="tel:${tel.replace(/\D/g, '')}">${esc(IC.committee)}</a>` : esc(IC.committee)}<br>` : ''}${IC.zone ? `Zone : ${esc(IC.zone)}<br>` : ''}${IC.id === 'snpm-2026' ? 'Avis : <a href="https://chat.whatsapp.com/J2W7onZ86t9AnqJJliPUSU" target="_blank" rel="noopener">WhatsApp « CVAT Tableau Officiel »</a>' : ''}</p>
    ${IC.firstWarning && IC.date ? `<button class="btn small alt" id="evUse">Caler le départ sur ces IC (${esc(dayName(IC.date))}, ${esc(IC.firstWarning)} + 5 min)</button>` : ''}</div>
  <div class="card"><h3>Pavillons de classe <small>habituels CVAT</small></h3><table class="t">${IC.classes.map((c) => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>Points clés</h3><ul class="tips small">${(IC.keyRules || []).map((r) => `<li>${esc(r)}</li>`).join('') || '<li>Aucun point clé enregistré.</li>'}</ul>
    ${IC.text ? `<details><summary class="small">Texte complet des IC</summary><pre class="ictext">${esc(IC.text)}</pre></details>` : ''}
    ${st.list.length > 1 ? `<button class="btn small alt" id="evDel" style="margin-top:8px">Supprimer cette régate</button>` : ''}</div>
  <div class="card"><h3>Marques <small>cahier de parcours CVAT</small></h3><table class="t"><tr><th>N°</th><th>Marque</th><th>Position</th></tr>${Object.entries(MARKS).map(([k, m]) => `<tr><td><b>${k}</b></td><td>${esc(m.name)}<div class="small muted">${esc(m.note)}</div></td><td class="small">${fmtLat(m.lat)}<br>${fmtLon(m.lon)}<br><span class="muted">${esc(m.src)}</span></td></tr>`).join('')}</table>
    <div class="small muted" style="margin-top:6px">« approx » = position relevée sur les cartes du cahier ou sur OpenStreetMap : vérifier sur zone, le Comité fait foi.</div></div>
  <div class="card"><h3>Dangers</h3><ul class="tips small"><li><b>Zone interdite</b> de la presqu’île de Saint-Mandrier (zone Marine nationale, rouge sur la carte).</li>${DANGERS.map((d) => `<li><b>${esc(d.name)}</b> (${fmtLat(d.lat)} ${fmtLon(d.lon)}) : ${esc(d.note)}</li>`).join('')}</ul></div>`;
  el.innerHTML = html;
  $('#evSel').onchange = (e) => { setCurrent(e.target.value); icDraft = null; IC = currentEvent(); renderIC(); renderDaySeg(); renderBrief(); };
  $('#evEdit').onclick = () => { icDraft = { ...IC }; renderIC(); };
  $('#evDel')?.addEventListener('click', (e) => { if (e.target.dataset.c !== '1') { e.target.dataset.c = '1'; e.target.textContent = 'Confirmer la suppression'; return; } removeEvent(IC.id); renderIC(); renderDaySeg(); renderBrief(); });
  $('#evUse')?.addEventListener('click', () => {
    const [h, m] = IC.firstWarning.split(':').map(Number);
    S.startTime = h + (m + 5) / 60; S.hour = Math.floor(S.startTime * 4) / 4;
    if (IC.date >= today()) S.day = IC.date;
    persist(); updateAll(); toast(`Départ calé à ${hhmm(S.startTime)} le ${dayName(S.day)}`);
  });
  $('#icFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#icMsg').textContent = 'Lecture des IC…';
    try {
      const text = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await pdfText(f) : await f.text();
      icDraft = { ...parseIC(text, f.name), id: 'ev' + Date.now(), source: f.name };
      renderIC(); $('#evForm')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { $('#icMsg').textContent = 'Lecture impossible : ' + err.message + '. Vous pouvez saisir la fiche à la main (Modifier).'; }
  };
  if (icDraft) {
    $('#evSave').onclick = () => {
      const ev = readForm(icDraft); upsertEvent(ev); icDraft = null; IC = currentEvent();
      if (ev.firstWarning && ev.date && ev.date >= today() && ev.date <= addDays(today(), 2)) { const [h, m] = ev.firstWarning.split(':').map(Number); S.startTime = h + (m + 5) / 60; S.day = ev.date; persist(); }
      toast(`Régate enregistrée : ${ev.event}`); updateAll();
    };
    $('#evCancel').onclick = () => { icDraft = null; renderIC(); };
  }
}

init().catch((e) => {
  console.error(e);
  $('#splash').innerHTML = `<div><b>Erreur au démarrage</b><small>${esc(e.message)}</small></div>`;
});
