// Rade Tactique — application principale.

import { report, note, setContext } from './journal.js';
import { Terrain, toXY, toLL, NM, bearingXY, distXY, norm360, norm180, fmtBrg, fmtNm, fmtLat, fmtLon, cardinal } from './geo.js';
import { WindField, speedColor } from './wind.js';
import { MARKS, COURSES, LINE_PRESETS, FORBIDDEN_ZONE, DANGERS } from './courses.js';
import { pdfText, parseIC, cleanText } from './events.js';
import { IA_IC, iaOffer, iaErrorMessage, reviewFromParse, reviewFromRegatta, reviewFromApi, setValue, setKeep, setKeepRace, setKeepMark, setKeepCourse, courseReady, canValidate, checksFor, applyReview, reviewHTML, chipOf, validatedHTML } from './icread.js';
import { stampState, markDirty, canon, legacyStamp } from './archmerge.js';
import { migrate, seedNorm, KEY as REG_KEY, saveRegattas, createRegatta, upsertRegatta, removeRegatta, openRegatta, openAtBoot, openOnNewDay, regattaStatus, STATUS_LABEL, todayRegatta, icOf, groupByStatus, lockDates, daysOf, addRace, removeRace, raceSettings, membre, saveMembre, backfillAuthor } from './regates.js';
import { THROTTLE_MS, slotKey, freezeAction, obsNeedsCopy, stratNeedsCopy, sliceDays, freezeSummary, strategySummary, compactStrategy, windSourceKind, frozenLabel } from './gel.js';
import { putSlot, getSlot } from './regstore.js';
import { listHTML, noRegattaHTML, newRegattaFormHTML, sheetHTML } from './regview.js';
import { applyRegattaMarks, pendingMarks, confirmMark, moveMark, ignoreMark } from './regmarks.js';
import { trackDay, matchRegattas, raceOfTrack, sameTrack, attachTrace, detachTrace, traceSummary, setTraceSummary, setTraceReport } from './attach.js';
import { breaksOf } from './segments.js';
import { fetchAll, cached, snapshot, consensus, gridPoints, marineAt, fetchLive, MODELS, WMO, CENTER } from './weather.js';
import { buildLegs, analyzeLeg, markAdvice, analyzeStart, trendOf, rankCourses, regimeOf, sideName, summarizeTime, prepareLeg, gateText } from './tactics.js';
import { BANANE_ID, addBanane, banOf, courseMarkUse } from './banane.js';
import { optimalAngles, boatSpeed, trimAdvice, spiMinTwa, getPolar, setPolar, resetPolar, parsePolar } from './polar.js';
import { renderJ80 } from './j80.js';
import { modelPoints, modelAt, idwAt, scoreModels, renderObsCard } from './obs.js';
import { route } from './router.js';
import { initTips, maybeWelcome, openGuide, openShare, tip, SYNC_TIP, DL_TIP } from './help.js';
import { parseWind, listen, say } from './voice.js';
import { Recorder, listTracks, getTrack, deleteTrack, saveTrack, analyzeTrack, exportGPX, fromGPX } from './track.js';
import { shroudsFor } from './tuning.js';
import { createStartMode } from './startmode.js';
import { initUpdates } from './swupdate.js';
import { createBeeper, audioAlive, milestones, KEY } from './beeper.js';
import { candidates, ACCURACY_M } from './markfit.js';
import { MAX_MOVE_M, DOUBT, parseLatLon, loadOverrides, saveOverride, clearOverride, applyOverrides, restoreMark, sharedMarks, remoteMarkChanges } from './marks.js';
import { createWakeLock } from './wakelock.js';
import { computeStatus, lampLabel, actionLabel, GPS_STALE_S } from './status.js';
import { isActive, isRaceDay, lockState, heavyPaused, parisClock, gpsLeftAlone, HEAVY_AFTER_MS } from './racelock.js';
import { detect as dbDetect, ask as dbAsk, askModes as dbAskModes, analyze as dbAnalyze, narrative as dbNarrative, buildReport as dbBuild, shareReport as dbShare } from './debrief.js';

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
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; /* valeur absente ou illisible : la valeur par défaut */ } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* indisponible */ } } };
const marksStore = () => { try { return localStorage; } catch { return null; /* stockage indisponible : aucun recalage */ } };
const localStore = () => { try { return localStorage; } catch { return null; /* stockage indisponible : les régates restent en mémoire */ } };
// Auteur de ce qu’on crée : le prénom donné par le middleware (D-05), gardé sur l’appareil ; null tant qu’il n’est pas connu (affiché « — », complété plus tard)
const who = () => membre(localStore());
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayName = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// Banane construite (D-01) : ajoutée à la liste des parcours hors du cahier js/courses.js, AVANT toute lecture de S.courseId et avant
// syncRegMarks (sinon un parcours choisi à 90 serait ramené au parcours 3) ; applyRegattaMarks ne retire que les parcours d’une régate
addBanane(COURSES);

const DEF = {
  day: today(), hour: 11, src: 'forecast', manual: { dir: 315, spd: 15, gust: 20 }, calib: null, localFx: 1, obs: [], modelSel: 'auto', nowcast: true,
  courseId: 3, cls: 'G', laps: 2, wlNm: 0.8, startTime: 11, linePreset: 'vignettes', lineLen: 0.12, lineMode: 'wind', lineBrg: 0, lineOverride: null,
  perf: 1, polar: null, obsOpen: true, startFlash: true,
  banNm: 0.8, banOff: true, banSide: 'b', banGate: true, banFin: 'depart',          // réglages de la banane (D-04), lus par banOf(S) qui les borne
};
const S = { ...DEF, ...store.get('rade.state', {}) };
// Régates : l’index (petit) se lit de façon synchrone au chargement ; IC garde la forme d’avant (icOf)
let REG = migrate({ storage: localStore(), now: Date.now(), by: who() });
// la Coupe SNPM semée est la même fiche sur les trois téléphones (instant commun) : une graine d'avant ramenée à cet instant, index réécrit seulement si l'objet change
{ const seeded = seedNorm(REG); if (seeded !== REG) { REG = seeded; saveRegattas(localStore(), REG); } }
// D-A3, D-A4 : régate du jour, sinon entraînement libre ; jamais lue dans l’index, jamais écrite, jamais partagée. `OPEN` ne change que dans setOpen.
let OPEN = openAtBoot({ now: Date.now(), list: REG.list });
let openDay = parisClock(Date.now()).date;          // jour de Paris pour lequel la règle d’ouverture a joué (passage de jour sans relance : dayOpenTick)
const openReg = () => openRegatta(REG.list, OPEN);
let IC = icOf(openReg());
// Remplace l’état des régates, l’écrit et recalcule IC ; un stockage plein ou refusé laisse l’état en mémoire, avec un message
// Archive partagée (ARCH-01) : `SYNC` (rade.sync.v1) ne porte que les compteurs « sale » par clé, rev, essais et plafonds du jour ; l’état marqué EST la file d’envoi.
// `fromSync` : la réponse du serveur est appliquée telle quelle, sans marquage (ce n’est pas une saisie de l’équipier).
const SYNC = store.get('rade.sync.v1', {});
delete SYNC.denied; delete SYNC.outdated; delete SYNC.marksDoc;                // code périmé, format plus récent : en mémoire seulement, ils retombent à la prochaine ouverture
const saveSync = () => { const { denied, outdated, ...gardes } = SYNC; store.set('rade.sync.v1', gardes); };
function saveReg(next, { fromSync = false } = {}) {
  if (!fromSync) {
    const r = stampState(REG, next, { now: Date.now(), by: who() });
    next = r.st;
    if (r.changed.length) { markDirty(SYNC, r.changed); saveSync(); scheduleSync(20000); paintSync(); }
  }
  REG = next; IC = icOf(openReg());
  if (!saveRegattas(localStore(), REG)) { note('regates', 'index non écrit : stockage plein ou refusé'); toast('Mémoire pleine : la régate ne sera pas gardée après fermeture'); }
  return REG;
}
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

if (S.polar) { try { setPolar(S.polar.tws, S.polar.twa, S.polar.bsp, S.polar.source); } catch (e) { S.polar = null; report('polaire', e); } }

// ───────────────────────── démarrage
// En deux temps (FIAB-06). Temps 1, synchrone : onglets, Départ (chrono, « Mode départ »), En course (GPS, trace), voyant, mises à jour
// différées, puis retrait du splash : rien n’attend le terrain, la 3D ni le champ de vent. Temps 2, après une image : la 3D (import différé,
// three.js pèse 691 Ko), le terrain, le vent, la carte, puis les prévisions du réseau. Marques performance rt:ui (interface utile) et rt:map.
const nextFrame = () => new Promise((ok) => {
  let fait = false;
  const go = () => { if (!fait) { fait = true; setTimeout(ok, 0); } };
  requestAnimationFrame(go); setTimeout(go, 250);          // page masquée : pas d’image, on n’attend pas
});
async function init() {
  // recalages de bouées de ce téléphone (D-04) : appliqués ici, une seule fois au démarrage, avant toute vue ; jamais dans les tests
  try { applyOverrides(MARKS, loadOverrides(marksStore())); } catch (e) { report('bouees', e); }
  // bouées et parcours confirmés de la régate ouverte (autre club, D-04) : injectés ici, après les recalages et la lecture de l’index, avant toute vue
  syncRegMarks();
  // chrono repris après un rechargement ou une relance d’iOS : l’affichage repart tout de suite, le son revient au premier toucher
  const saved = store.get('rade.timer.v1', null);
  let resumed = false;
  if (saved?.end && Date.now() < saved.end + 10 * 60e3) { timer.end = saved.end; startTimer(); resumed = true; }
  else if (saved?.end) store.set('rade.timer.v1', { end: null });
  // ── temps 1 : l’interface utile
  bindShell();
  paintRegBar();
  renderStart();
  renderLive();
  status('Préparation de la carte…');
  $('#splash').classList.add('gone');
  performance.mark('rt:ui');
  if (resumed) toast('Chrono repris — touchez l’écran pour réactiver le son');
  // réactivation au toucher : le contexte audio ne naît ou ne revient que d’un geste (relance d’iOS, écran verrouillé, appel)
  const reveil = () => {
    const w = wake.state(); if (w.wanted && !w.held) wake.retry();            // le verrou d’écran se redemande aussi sur geste
    if (timer.end == null && !startMode.isOpen()) return;
    if (!actx || actx.state !== 'running' || snd.alive === false) audioInit();
  };
  document.addEventListener('pointerdown', reveil, true); document.addEventListener('pointerup', reveil, true);
  const redemande = () => { const w = wake.state(); if (w.wanted && !w.held) wake.retry(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) redemande(); });
  setInterval(redemande, 15000);
  // mise à jour différée : bandeau hors course, application sur geste seulement (js/swupdate.js, js/racelock.js)
  updates = initUpdates({ isLocked: () => raceLock().locked, onAvailable: showUpdateBar, onHidden: hideUpdateBar });
  setInterval(raceTick, 5000);
  setInterval(lampTick, 1000);
  addEventListener('pagehide', saveRaceActivity);
  document.addEventListener('visibilitychange', () => {
    note('page', document.hidden ? 'masquée' : 'visible');
    if (document.hidden) saveRaceActivity();
    else { lastProbe = Date.now(); probeNet(); renderRaceBar(); if (!(Date.now() - SYNC.lastOkAt < 300000)) scheduleSync(2000); }   // retour au premier plan, dernier succès de plus de 5 min
  });
  addEventListener('online', () => { note('reseau', 'en ligne'); probeNet(); scheduleSync(2000); if (!who()) refreshMembre(); });
  addEventListener('offline', () => { net.online = false; note('reseau', 'hors ligne'); renderRaceBar(); paintIa(); paintSync(); });
  // ── temps 2 : la carte et le vent
  await nextFrame();
  refreshMembre();                                     // prénom de l’équipier : jamais attendu
  data = cached();
  const snap = await snapshot();
  if (snap && (!data || snap.fetched > data.fetched)) data = snap;
  if (data) series = consensus(data);
  renderStatic();                                      // onglets Prévisions, Vent, J80 et IC : sans la carte
  const { Scene3D } = await import('./scene3d.js');
  T = await new Terrain().load('data/');
  F = new WindField(T);
  scene = new Scene3D($('#view'), T);
  scene.upAngle = (tws) => optimalAngles(Math.max(1, tws)).up.twa;
  scene.setDangers(forbidden, DANGERS);
  scene.onPick = onPick;
  scene.onCamera = () => { $('#compass .needle').style.transform = `rotate(${-scene.azimuth()}deg)`; };
  bindMap();
  initTips();
  await autoHeavy(prepareField);                       // app ouverte pendant la séquence de départ : reporté après H+1 min
  performance.mark('rt:map');
  syncReady = true; setTimeout(() => syncNow('ouverture'), 3000);   // archive partagée : jamais avant la carte, ni attendue
  mapOk();                                              // showTrace et le débrief attendaient la carte : ils peuvent continuer
  setTimeout(() => reprise(), 1500);                    // rattrapage des anciennes traces (ARCH2-01) : après la carte, avant la synchronisation d’ouverture, jamais attendu
  freezeTick('ouverture');                              // prévisions en cache ou embarquées déjà lues : le gel marche aussi hors réseau, sans rien attendre
  maybeWelcome();
  renderTracks();
  refreshWeather(true);
  refreshLive();
  setInterval(refreshLive, 5 * 60000);
}

// auto : téléchargement lancé sans geste (ouverture de l’app) ; son calcul est reporté pendant la séquence de départ. Le bouton ⟳ est un geste : tout de suite.
async function refreshWeather(auto = false) {
  const b = $('#refresh'); b.classList.add('spin');
  try {
    data = await fetchAll(); series = consensus(data);
    status();
    freezeTick('prévisions');
    await (auto ? autoHeavy(prepareField) : runHeavy(prepareField));
  } catch (e) {
    note('meteo', 'prévisions indisponibles : ' + (e?.message || e));      // hors réseau : l’instantané embarqué prend le relais
    if (!data) { data = await snapshot(); if (data) { series = consensus(data); await (auto ? autoHeavy(prepareField) : runHeavy(prepareField)); } }
    status(data ? `Hors ligne — prévisions du ${new Date(data.fetched).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Prévisions indisponibles (réseau)');
  } finally { b.classList.remove('spin'); }
}
async function refreshLive() {
  try { live = await fetchLive(); scene?.setStations(live.filter((s) => s.ageMin < 90)); if ($('section[data-tab=brief]').classList.contains('on')) renderBrief(); } catch { /* balises indisponibles */ }
}
function status(msg) {
  const el = $('#status');
  if (msg) { el.textContent = msg; return; }
  if (!data) { el.textContent = 'Pas de prévision'; return; }
  const ago = Math.round((Date.now() - data.fetched) / 60000);
  const when = ago < 1 ? 'à l’instant' : ago < 120 ? `il y a ${ago} min` : `le ${new Date(data.fetched).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;
  el.textContent = S.src === 'manual' ? 'vent manuel' : `prévisions ${data.snapshot ? 'embarquées' : 'màj'} ${when}`;
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

// Écart résiduel de chaque relevé au modèle retenu `sel` : même calcul pour le jour courant (refreshObs) et pour un vent figé (débrief tardif).
// Chaque relevé fixe le champ F sur son vent : F n'est plus celui de l'écran ensuite, d'où fieldKey = null.
function residualsFor(dataX, obsList, sel) {
  const out = [];
  for (const o of obsList) {
    const pts = modelPoints(dataX, o.day, o.h, sel);
    if (!pts) continue;
    F.compute({ points: pts }, { localEffects: S.localFx });
    fieldKey = null;                         // F porte maintenant le vent de ce relevé : le champ affiché sera recalculé
    const p = toXY(o.lat, o.lon), w = F.sample(p.x, p.y);
    o.fit = { dir: w.dir, spd: w.spd };
    out.push({ h: o.h, dd: norm180(o.dir - w.dir), rr: Math.max(0.3, Math.min(3, o.spd / Math.max(0.8, w.spd))) });
  }
  return out;
}
// Recalcule le classement des modèles puis, pour le modèle retenu, l'écart résiduel à chaque relevé
function refreshObs() {
  ranking = data ? scoreModels(data, dayObs()) : [];
  resid = [];
  if (!data || !F) return;                   // sans champ de vent (ouverture en cours), seul le classement des modèles se calcule
  resid = residualsFor(data, dayObs(), selectedModel());
  if (resid.length) fieldKey = null;         // F porte le vent du dernier relevé (residualsFor l’a déjà noté) : le champ affiché sera recalculé
}
// L'écart mesuré s'applique pleinement à l'heure du relevé, puis s'estompe (≈ 2 h 30)
function applyResiduals(pts, day, hour, rs = resid, refDay = S.day) {
  if (day !== refDay || !rs.length) return pts;
  let sw = 0, sd = 0, sr = 0, wmax = 0;
  for (const r of rs) { const w = Math.exp(-Math.abs(hour - r.h) / 2.5); sw += w; sd += w * r.dd; sr += w * (r.rr - 1); wmax = Math.max(wmax, w); }
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
      } catch (err) { note('voix', 'reconnaissance vocale indisponible : ' + (err?.message || err)); btn.classList.remove('rec'); btn.textContent = '🎤'; toast('Reconnaissance vocale indisponible ici : utilisez le micro du clavier dans le champ texte.'); }
    },
    onDelete: (i) => { const o = dayObs()[i]; S.obs = S.obs.filter((x) => x !== o); persist(); refreshObs(); updateAll(); },
    onModel: (v) => { S.modelSel = v; persist(); refreshObs(); updateAll(); },
    onNowcast: (v) => { S.nowcast = v; persist(); refreshObs(); updateAll(); },
  });
}
// Compréhension en langage naturel (fonction /api/voice, OpenAI) ; repli sur l'analyse locale sans réseau
async function understand(alts, last, tack) {
  if (navigator.onLine) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch('api/voice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ alts, last, tack }), signal: ctl.signal });
      clearTimeout(to);
      if (r.ok) {
        const j = await r.json();
        if (!j.understood) return { error: j.question || 'pas compris', ai: true };
        let dir = last?.dir ?? null, spd = last?.spd ?? null; const notes = [];
        const d = j.direction, v = j.speed;
        if (d.mode === 'absolute' && d.value != null) dir = d.value;
        else if (d.mode === 'delta' && d.value != null && dir != null) dir += d.value;
        else if ((d.mode === 'lift' || d.mode === 'header') && dir != null) {
          if (!tack) return { error: 'amure inconnue (GPS inactif) pour « adonne / refuse » : précisez « tourne à droite / à gauche »', ai: true };
          const n = (d.value ?? 10) * (d.mode === 'lift' ? 1 : -1); dir -= tack * n;
        }
        if (v.mode === 'absolute' && v.value != null) spd = v.value;
        else if (v.mode === 'delta' && v.value != null && spd != null) spd = Math.max(0, spd + v.value);
        if (dir == null || spd == null) return { error: 'il manque la direction ou la force', ai: true };
        if (j.confidence === 'low') notes.push('à vérifier');
        return { dir: ((Math.round(dir / 5) * 5) % 360 + 360) % 360, spd: Math.round(spd), gust: j.gust, notes, summary: j.summary, ai: true };
      }
      if (r.status === 429) {                                                // quota du jour ou budget du mois : le serveur le dit, puis l'analyse locale prend le relais
        const j = await r.json().catch(() => { /* corps illisible : l'analyse locale suffit, sans message */ return null; });
        if (typeof j?.message === 'string' && j.message.trim()) toast(j.message.trim().slice(0, 200));
      }
    } catch { /* hors réseau ou délai dépassé : analyse locale */ }
  }
  for (const a of alts) { const r = parseWind(a, last, tack); if (!r.error) return r; }
  return parseWind(alts[0], last, tack);
}

// Relevé dicté : interprétation, confirmation 3 s (annulable), puis enregistrement
let pend = null;
async function voiceObs(alts) {
  const lastObs = dayObs().slice(-1)[0];
  const last = lastObs ? { dir: lastObs.dir, spd: lastObs.spd } : obsDraft ? { dir: obsDraft.dir, spd: obsDraft.spd } : null;
  const tack = gps?.pos?.cog != null && last ? (norm180(gps.pos.cog - last.dir) >= 0 ? 1 : -1) : null;
  const b = document.getElementById('voicePend') || Object.assign(document.createElement('div'), { id: 'voicePend' });
  document.body.appendChild(b);
  b.innerHTML = `<div><b>…</b><div class="small">« ${esc(alts[0])} » — compréhension…</div></div>`; b.hidden = false;
  const res = await understand(alts, last, tack);
  if (res.error || res.dir == null || res.spd == null) {
    b.hidden = true; toast(`« ${alts[0]} » : ${res.error || 'il manque la direction ou la force'}`); say(res.ai && res.error ? res.error : 'Pas compris'); return;
  }
  obsDraft = { ...(obsDraft || {}), dir: res.dir, spd: res.spd, hManual: false };
  b.innerHTML = `<div><b>${fmtBrg(res.dir)} · ${res.spd} nd</b>${res.gust ? ` <span class="small">rafales ${Math.round(res.gust)}</span>` : ''}${res.notes?.length ? ` <span class="small">(${esc(res.notes.join(', '))})</span>` : ''}<div class="small">« ${esc(alts[0])} »${res.summary ? ` → ${esc(res.summary)}` : ''} — enregistrement dans 3 s</div></div><button class="btn alt small" id="vpCancel">Annuler</button>`;
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

// fieldOn : F porte un vent calculé (avant cela, F.sample() ne donnerait que des zéros : le mode départ affiche « Vent à relever »)
let fieldOn = false;
// Mémoïsé : même base (jour, heure, source, vent manuel, modèle, relevés, intensité du relief, prévisions), rien à recalculer.
// Au démarrage, l’affichage (S.hour) et l’analyse (S.startTime) demandaient deux fois le même champ. Quiconque écrit dans F d’autre
// part (refreshObs, débrief) remet fieldKey à null.
let fieldKey = null;
function computeField(day, hour) {
  const key = [day, hour, S.day, S.src, JSON.stringify(S.manual), selectedModel(), S.nowcast, JSON.stringify(resid), S.localFx, data?.fetched].join('|');
  if (key !== fieldKey) { F.compute(baseAt(day, hour), { localEffects: S.localFx }); fieldKey = key; }
  fieldOn = true;
  return F;
}
// Prépare le champ de vent par tranches courtes (F.warm) pour que les calculs qui suivent ne figent pas l’interface, puis affiche.
// L’ordre compte : les relevés fixent le modèle retenu et l’écart appliqué aux bases de l’affichage et du départ.
async function prepareField() {
  if (!F) return;
  ranking = data ? scoreModels(data, dayObs()) : [];
  if (data) for (const o of dayObs()) { const pts = modelPoints(data, o.day, o.h, selectedModel()); if (pts) await F.warm({ points: pts }); }
  refreshObs();
  await F.warm(baseAt(S.day, S.hour));
  await F.warm(baseAt(S.day, S.startTime));
  updateAll();
}

// ───────────────────────── mises à jour
let anaTimer = null, anaToken = 0;
// Ce qui s’affiche sans le terrain ni le champ de vent
function renderStatic() { renderDaySeg(); renderBrief(); renderWind(); renderIC(); renderJ80Tab(); }
function updateAll() {
  if (!F || !scene) return;                  // le temps 2 d’init() appelle updateAll() quand ils existent
  status();
  renderDaySeg();
  $('#hour').value = S.hour; $('#hourLbl').textContent = hhmm(S.hour);
  $$('#srcSeg button').forEach((b) => b.classList.toggle('on', b.dataset.src === S.src));
  updateDisplayField();
  scheduleAnalysis();
  renderBrief(); renderWind(); if (!icBusy()) renderIC(); renderJ80Tab();     // un formulaire ouvert n’est jamais redessiné sous les doigts de l’équipier
}
function updateDisplayField() {
  if (!F || !scene) return;
  computeField(S.day, S.hour);
  scene.setField(F);
  const c = F.sample(toXY(43.088, 5.962).x, toXY(43.088, 5.962).y);
  $('#windBadge').innerHTML = `${arrow(c.dir)} <b>${c.spd.toFixed(0)}</b> nd · ${cardinal(c.dir)} ${fmtBrg(c.dir)}<br><span class="small">rafales ${c.gust.toFixed(0)} nd · ${hhmm(S.hour)}${S.src === 'manual' ? ' · manuel' : ''}${S.src === 'forecast' && data ? ' · ' + modelLabel(selectedModel()) : ''}${S.src === 'forecast' && S.nowcast && resid.length ? ' + relevés' : ''}</span>`;
  renderLegend();
}
function scheduleAnalysis() { clearTimeout(anaTimer); anaTimer = setTimeout(runAnalysis, 120); }

async function runAnalysis() {
  if (!F || !scene) return;
  const token = ++anaToken;
  const course = COURSES.find((c) => c.id === S.courseId);
  const cls = course.seq[S.cls] ? S.cls : 'G';
  computeField(S.day, S.startTime);
  const preset = LINE_PRESETS[course.line && S.linePreset === 'vignettes' ? course.line : S.linePreset] || LINE_PRESETS.vignettes;
  const ctr = toXY(preset.lat, preset.lon);
  const wLine = F.sample(ctr.x, ctr.y);
  const ov = S.lineOverride ? { cb: toXY(S.lineOverride.cb.lat, S.lineOverride.cb.lon), pin: toXY(S.lineOverride.pin.lat, S.lineOverride.pin.lon) } : null;
  const B = buildLegs(course, cls, { laps: S.laps, windDir: wLine.dir, wlLengthNm: S.wlNm, ban: banOf(S), line: { center: preset, lengthNm: S.lineLen, mode: S.lineMode, bearing: S.lineBrg, override: ov } });
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
  for (const [k, leg] of B.legs.entries()) {
    if (token !== anaToken) return;
    if (S.src === 'forecast' && Math.abs(t - lastH) >= 0.25) { computeField(S.day, t); lastH = t; }
    // porte conseillée avec le vent de l’heure du bord (D-05) ; après une porte, le bord part de la bouée retenue
    prepareLeg(leg, legs[legs.length - 1], B.legs[k + 1], F, ctx);
    const a = analyzeLeg(leg, F, ctx);
    a.eta0 = t; t += a.time / 3600; a.eta1 = t;
    legs.push(a);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (token !== anaToken) return;
  let ord = 0;
  legs.forEach((l) => { if (l.mark !== 'GATE' && l.mark !== 'FINISH') l.order = ++ord; });
  analysis = { course, cls, legs, line: B.line, points: B.points, start, total: t - S.startTime, dist: legs.reduce((s, l) => s + l.dist, 0), trend, day: S.day, cfg: stratSettings(cls), finishLine: B.finishLine ?? null };
  freezeTick('analyse');
  applyPendingEnds();
  updateDisplayField();
  drawCourse();
  renderCourse(); renderStart(); renderLive(); renderBrief(); renderJ80Tab();
  if (autoReplay) { autoReplay = false; startReplay(); } else if (scene.replay) { const R = scene.replay, f = R.t / R.T, was = R.playing; startReplay(false); scene.replayControl('seek', f * scene.replay.T); if (!was) scene.replayControl('toggle'); }
}

function drawCourse() {
  if (!analysis) return;
  // marques du parcours, avec leurs numéros d'ordre de passage ; les deux bouées d’une porte portent son numéro, la conseillée est marquée
  const used = courseMarkUse(analysis.legs);
  const marks = Object.fromEntries(Object.entries(MARKS).map(([k, m]) => [k, { ...m, doubt: DOUBT(m) }]));        // « 3 ? » sur la carte (D-01)
  Object.assign(marks, pendingMarks(openReg()));        // « X1 ? » : bouées d’un autre club à confirmer, pour la carte seulement (jamais dans MARKS)
  for (const k of ['A', 'B', 'C', 'D', 'PG', 'PD', 'S']) if (analysis.points[k]) { const ll = toLL(analysis.points[k].x, analysis.points[k].y); marks[k] = { name: analysis.points[k].name, ...ll, color: '#f5c400' }; }
  scene.setMarks(marks, used);
  scene.setLine(analysis.line, analysis.start.startPoint ? [{ ...analysis.start.startPoint, name: '◆ Départ conseillé' }] : [], analysis.finishLine);
  scene.setCourse(analysis, selLeg);
}

// ───────────────────────── interface : liaisons
// Liaisons de l’interface utile : onglets, aide, partage, poignée du panneau (aucune n’a besoin de la carte)
function bindShell() {
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
    if (b.dataset.tab === 'ic' && icStale && !icBusy()) { icStale = false; renderIC(); }
    if (sheet === 'min') setSheet('half');
  });
  bindSheet();
}
// Liaisons de la carte et du champ de vent : après la création de la 3D
function bindMap() {
  $('#hour').addEventListener('input', (e) => { S.hour = +e.target.value; $('#hourLbl').textContent = hhmm(S.hour); updateDisplayField(); });
  $('#hour').addEventListener('change', () => { persist(); renderBrief(); });
  $('#srcSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.src = b.dataset.src; persist(); updateAll(); });
  $('#refresh').addEventListener('click', () => { refreshWeather(); refreshLive(); });
  $('#mapBtns').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.v;
    if (v === 'top') scene.topView();
    if (v === 'tilt') scene.tiltView();
    if (v === 'course' && analysis) scene.focus(analysis.legs.flatMap((l) => [l.from, l.to]));
    if (v === 'boat') { follow = !follow; b.classList.toggle('on', follow); if (follow) startGps('manuel'); }
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
}

let sheet = 'half';
function setSheet(s) { sheet = s; const p = $('#panel'); p.classList.toggle('min', s === 'min'); p.classList.toggle('max', s === 'max'); document.body.dataset.sheet = s; setTimeout(() => scene?.resize(), 280); }
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
  if (!F || !fieldOn) return;                // vent pas encore calculé
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
// Ping reçu avant que la ligne soit calculée (le mode départ s’ouvre avant l’analyse) : gardé, puis appliqué dès que l’analyse est prête
const pendingEnds = {};
function setLineEnd(which, ll) {
  const cur = S.lineOverride || (analysis ? { cb: toLL(analysis.line.cb.x, analysis.line.cb.y), pin: toLL(analysis.line.pin.x, analysis.line.pin.y) } : null);
  if (!cur) { pendingEnds[which] = { lat: ll.lat, lon: ll.lon }; toast('Ping noté : la ligne se calcule, il sera appliqué dans quelques secondes'); return; }
  cur[which] = { lat: ll.lat, lon: ll.lon };
  S.lineOverride = cur; persist(); scheduleAnalysis();
}
function applyPendingEnds() {
  if (!pendingEnds.cb && !pendingEnds.pin) return;
  const cur = S.lineOverride || { cb: toLL(analysis.line.cb.x, analysis.line.cb.y), pin: toLL(analysis.line.pin.x, analysis.line.pin.y) };
  for (const k of ['cb', 'pin']) if (pendingEnds[k]) { cur[k] = pendingEnds[k]; delete pendingEnds[k]; }
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
    ${isRace && (IC.firstWarning || IC.lastFinishSignal || IC.vhf != null) ? `<div class="small muted" style="margin-top:6px">${[IC.firstWarning && `1er avertissement ${esc(IC.firstWarning)}`, IC.lastFinishSignal && `arrivée limite ${esc(IC.lastFinishSignal)}`, IC.vhf != null && `VHF ${esc(IC.vhf)}`].filter(Boolean).join(' · ')}</div>` : ''}
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
    for (const l of analysis.legs) if (l.gate) tips.push(`Tour ${esc(l.lap ?? 1)} · ${esc(gateText(l.gate))}`);         // porte conseillée à chaque passage (D-06)
    html += `<div class="card"><h3>Stratégie du jour ${tip('Synthèse automatique : rotation du vent attendue pendant la course, zones les plus ventées, désaccord entre modèles et temps estimé du parcours.')}</h3><ul class="tips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
  }
  if (analysis) {
    const seen = new Set(), rows = [];
    for (const l of analysis.legs) for (const x of l.site || []) {
      const key = x.kind + x.text.split(' : ')[0]; if (seen.has(key)) continue; seen.add(key);
      rows.push(`<li><b>${l.order ? `Bord vers la marque ${l.order}` : esc(l.to.name)}</b> (${hhmm(l.eta0)}) — ${esc(x.text)}</li>`);
    }
    html += `<div class="card"><h3>Effets de site du relief ${tip('Calculés par le modèle de vent local à partir du relief de la rade (accélérations, dévents, vent dévié le long des côtes), à l’heure où chaque bord est couru. Ils sont intégrés au routage et au choix du côté.')}<small>sur le parcours ${analysis.course.id}</small></h3>${rows.length ? `<ul class="tips">${rows.slice(0, 6).join('')}</ul>` : '<p class="small muted">Pas d’effet de site marqué sur ce parcours avec ce vent : le plan d’eau est homogène.</p>'}<div class="small muted">Intensité réglable dans l’onglet Vent (« Effets locaux du relief »).</div></div>`;
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
    html += `<div class="card"><h3><span>Parcours probables ${tip('Parcours dont le premier bord est au près avec le vent prévu : le Comité choisit souvent ce type de parcours. Simple aide à la préparation.')}</span><small>1er bord au près</small></h3>${rk.map((r) => `<div class="row" style="display:flex;justify-content:space-between;margin:4px 0"><span><b>${esc(r.c.title)}</b> → ${esc(MARKS[r.c.seq[S.cls][0][0]].name)}</span><span class="small">${fmtBrg(r.brg)} · TWA ${Math.round(r.twa)}° <button class="btn small alt" data-pick="${r.c.id}">Voir</button></span></div>`).join('')}<div class="small muted">Le comité cherche en général un premier bord de près : simple aide pour se préparer, le parcours est annoncé avant la procédure.</div></div>`;
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
// Réglages de la banane construite (D-04), montrés seulement quand elle est choisie ; valeurs bornées par banOf
function banPanel() {
  const b = banOf(S), opt = (v, txt, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(txt)}</option>`;
  return `<div class="row3" id="cBan" style="margin-top:8px">
    <div><label class="f">Dist. B (Nq)</label><input id="cBanNm" type="number" min="0.3" max="2" step="0.1" value="${esc(b.nm)}"></div>
    <div><label class="f">Dégagement (C)</label><select id="cBanOff">${opt('1', 'Oui', b.off ? '1' : '0')}${opt('0', 'Non', b.off ? '1' : '0')}</select></div>
    <div><label class="f">B laissée à</label><select id="cBanSide">${opt('b', 'bâbord', b.side)}${opt('t', 'tribord', b.side)}</select></div>
    <div><label class="f">Porte sous le vent</label><select id="cBanGate">${opt('1', 'Deux bouées (porte)', b.gate ? '1' : '0')}${opt('0', 'Une bouée', b.gate ? '1' : '0')}</select></div>
    <div><label class="f">Arrivée</label><select id="cBanFin">${opt('depart', 'Ligne de départ', b.fin)}${opt('sousvent', 'Sous le vent, décalée', b.fin)}${opt('auvent', 'Au vent, décalée', b.fin)}</select></div>
  </div>`;
}
function renderCourse() {
  const el = $('section[data-tab=course]');
  const c = COURSES.find((x) => x.id === S.courseId);
  const nObs = dayObs().length;
  let html = `<details class="card obsbox" ${S.obsOpen !== false ? 'open' : ''}><summary><span>🌬 Relevé de vent sur l’eau ${tip('Réglez la direction d’où vient le vent (compas) et sa force mesurée, puis Enregistrer. L’app compare votre relevé aux 6 modèles, garde celui qui colle le mieux et recale la prévision autour de cette heure. Plusieurs relevés dans la journée affinent le choix.')}</span><small>${S.src === 'manual' ? 'mode manuel' : `${nObs ? nObs + ' relevé(s) · ' : ''}modèle : ${esc(modelLabel(selectedModel()))}`}</small></summary><div class="obs-card"></div></details>
  <div class="card"><div class="row2"><div><label class="f">Parcours (cahier CVAT)</label><select id="cSel">${COURSES.map((x) => `<option value="${x.id}" ${x.id === S.courseId ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>
    <div><label class="f">Classes</label><select id="cCls"><option value="G" ${S.cls === 'G' ? 'selected' : ''}>C–D–L–R1-R3 (grand)</option><option value="P" ${S.cls === 'P' ? 'selected' : ''}>P1–P2 (petit)</option></select></div></div>
    <div class="row3">${c.laps ? `<div><label class="f">Tours</label><input id="cLaps" type="number" min="1" max="5" value="${S.laps}"></div>` : ''}${c.built === 'WL' ? `<div><label class="f">Dist. B (Nq)</label><input id="cWl" type="number" min="0.3" max="2" step="0.1" value="${S.wlNm}"></div>` : ''}
    <div><label class="f">Heure de départ</label><input id="cStart" type="text" inputmode="numeric" value="${hhmm(S.startTime)}"></div></div>
    ${c.built === 'BAN' ? banPanel() : ''}
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
        <div class="hd"><span>${l.order ? `<span class="ord">${l.order}</span> ` : ''}${esc((/^\d/.test(l.to.name) ? 'n°' : '') + l.to.name)}${l.lap ? ` <span class="muted small">tour ${l.lap}</span>` : ''}</span>${DOUBT(MARKS[l.mark]) ? '<span class="chip mid">position à confirmer</span>' : ''}${l.side ? `<span class="chip ${l.side === 'b' ? 'port' : 'stbd'}">${sideName(l.side)}</span>` : ''}</div>
        <div class="meta">${fmtBrg(l.brg)} · ${fmtNm(l.dist)} · vent ${fmtBrg(l.wind.dir)} ${l.wind.spd.toFixed(0)} nd (raf. ${l.wind.gust.toFixed(0)}) · TWA ${Math.abs(l.twa).toFixed(0)}° · ${hhmm(l.eta0)}→${hhmm(l.eta1)} (${summarizeTime(l.time)})</div>
        <span class="chip ${chip}">${l.type.label}</span><span class="chip">${l.type.sail}</span>
        <ul class="tips">${l.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        ${l.site?.length ? `<div class="site"><b>Effets de site ${tip('Écart entre le vent prévu sans relief et le vent local recalculé avec le relief (contournement, dévents, côtes). Ces écarts sont déjà pris en compte dans la route conseillée et le côté favorisé.')}</b><ul class="tips">${l.site.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul></div>` : ''}
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
  // réglages de la banane (D-04) : gardés dans rade.state, bornés par cleanBan au calcul (banOf)
  const banSet = { '#cBanNm': (v) => { S.banNm = banOf({ ...S, banNm: Number.parseFloat(String(v).replace(',', '.')) }).nm; }, '#cBanOff': (v) => { S.banOff = v === '1'; }, '#cBanSide': (v) => { S.banSide = v; }, '#cBanGate': (v) => { S.banGate = v === '1'; }, '#cBanFin': (v) => { S.banFin = v; } };
  for (const [id, set] of Object.entries(banSet)) if ($(id)) $(id).onchange = (e) => { set(e.target.value); persist(); scheduleAnalysis(); };
  $('#cStart').onchange = (e) => { const m = /^(\d{1,2})[:h ]?(\d{2})?$/.exec(e.target.value.trim()); if (m) { S.startTime = +m[1] + (+m[2] || 0) / 60; S.hour = Math.floor(S.startTime * 4) / 4; persist(); updateAll(); } };
  $$('.leg', el).forEach((d) => d.addEventListener('click', () => {
    const i = +d.dataset.i; selLeg = selLeg === i ? null : i;
    scene.setCourse(analysis, selLeg);
    $$('.leg', el).forEach((x) => x.classList.toggle('sel', +x.dataset.i === selLeg));
    if (selLeg != null && scene.replay) scene.replayControl('seek', replayLegStarts[i] ?? 0);
    if (selLeg != null) { const l = analysis.legs[i]; scene.focus([l.from, l.to, ...(l.route?.path ?? [])], 1.35); S.hour = Math.min(21, Math.floor(l.eta0 * 4) / 4); $('#hour').value = S.hour; $('#hourLbl').textContent = hhmm(S.hour); updateDisplayField(); }
  }));
}

// ───────────────────────── MISE À JOUR DIFFÉRÉE ET VERROU « EN COURSE »
let updates = null;
const RL = store.get('rade.racelock', {});     // { lastActiveAt, finishedAt } : survit au rechargement et à la relance iOS
let rlSavedAt = 0, wasLocked = false;
const saveRL = (now = Date.now()) => { rlSavedAt = now; store.set('rade.racelock', RL); };
const raceActive = (now) => isActive({ now, timerEnd: timer.end, startModeOpen: startMode.isOpen(), recording: recorder.active, gpsOn: gps?.watch != null });
function raceLock(now = Date.now()) {
  // le verrou lit les dates de la régate d’aujourd’hui dans la liste, ouverte ou non : il ne dépend jamais de la régate ouverte à l’écran
  const { raceFrom, raceTo } = lockDates({ now, list: REG.list });
  return lockState({ now, active: raceActive(now), raceFrom, raceTo, lastActiveAt: RL.lastActiveAt ?? null, finishedAt: RL.finishedAt ?? null });
}
function saveRaceActivity() { const now = Date.now(); if (raceActive(now)) { RL.lastActiveAt = now; saveRL(now); } }
let wasRaceActive = false, lockReason = null;
function raceTick() {
  const now = Date.now();
  const active = raceActive(now);
  if (active) { RL.lastActiveAt = now; if (now - rlSavedAt >= 30000) saveRL(now); }
  // D-03 : une course qui commence abandonne l’échange en cours ; une course qui finit relance la synchronisation une minute plus tard
  if (active) syncCtl?.abort();
  if (wasRaceActive && !active) scheduleSync(60000);
  if (wasRaceActive && !active) reprise();         // le rattrapage reporté pendant la course repart à sa fin (D-03)
  if (active !== wasRaceActive) { wasRaceActive = active; paintSync(); }
  const lk = raceLock(now), locked = lk.locked;
  const raison = locked ? (lk.reason === 'course' ? 'en course' : 'journée de régate') : 'libre';
  if (raison !== lockReason) { lockReason = raison; note('verrou', raison); }      // pourquoi une mise à jour attend : lisible au journal (aucune position, aucun secret)
  updates?.refresh();
  if (wasLocked && !locked) { updates?.check(); scheduleSync(60000); reprise(); }    // le téléchargement était suspendu pendant le verrou ; l'archive (objets lourds compris) repart une minute plus tard
  wasLocked = locked;
  freezeTick('tic');                             // copie du vent du jour (gel) : jamais reportée, voir plus bas
  dayOpenTick(now, active);
}
// Bandeau discret en haut ; texte posé par textContent, jamais en HTML (la note vient du worker)
function showUpdateBar(build) {
  let el = document.getElementById('updbar');
  if (!el) {
    el = document.createElement('div'); el.id = 'updbar'; el.setAttribute('role', 'status'); document.body.appendChild(el);
  }
  if (el.dataset.bid !== String(build.id)) {
    el.dataset.bid = String(build.id);
    const msg = document.createElement('span'); msg.textContent = `Nouvelle version v${build.n} · ${build.note}`;
    const btn = document.createElement('button'); btn.className = 'btn small acc'; btn.textContent = 'Mettre à jour';
    btn.addEventListener('click', () => { if (!updates?.apply()) toast('Course en cours : mise à jour reportée'); });
    el.replaceChildren(msg, btn);
  }
  el.classList.toggle('crit', !!build.critical);
  el.hidden = false;
}
function hideUpdateBar() { const el = document.getElementById('updbar'); if (el) el.hidden = true; }

// ───────────────────────── RECALCULS AUTOMATIQUES PENDANT LA SÉQUENCE DE DÉPART
// De H−6 min à H+1 min (js/racelock.js), l’app ne lance AUCUN recalcul qu’aucun geste n’a demandé : l’affichage du mode départ doit rester fluide.
// Liste fermée (testée) : la préparation du champ à l’ouverture (init) et le calcul qui suit un téléchargement de prévisions sans geste
// (refreshWeather appelée avec auto), via autoHeavy. Tout geste de l’équipier (curseur d’heure, bord, « Recalculer la suite », parcours, réglages, ⟳, ping de
// ligne) et tout relevé de vent (dicté ou saisi) calculent tout de suite : ils n’appellent jamais autoHeavy.
const heavyQ = new Set();                    // calculs reportés, dans l’ordre, sans doublon
let heavyTm = null, heavyNoted = false;
const runHeavy = (fn) => Promise.resolve().then(fn).catch((e) => report('calcul', e));
function autoHeavy(fn) {
  if (heavyPaused({ now: Date.now(), timerEnd: timer.end })) { deferHeavy(fn); return Promise.resolve(); }
  return runHeavy(fn);
}
function deferHeavy(fn) {
  heavyQ.add(fn);
  if (!heavyNoted) { heavyNoted = true; note('calcul', 'reporté après le départ'); status('Carte et calculs reportés après le départ'); }
  armHeavy();
}
// Une seule minuterie, à H+1 min + 1 s ; recalculée si le chrono bouge (±1 min, Stop) et au déclenchement
function armHeavy() {
  clearTimeout(heavyTm);
  heavyTm = setTimeout(flushHeavy, timer.end == null ? 1000 : Math.max(1000, timer.end + HEAVY_AFTER_MS + 1000 - Date.now()));
}
function flushHeavy() {
  heavyTm = null;
  if (heavyPaused({ now: Date.now(), timerEnd: timer.end })) { armHeavy(); return; }
  heavyNoted = false;
  const q = [...heavyQ]; heavyQ.clear();
  for (const fn of q) runHeavy(fn);
}

// ───────────────────────── DÉPART
// timer.end est un accesseur : tout site d’appel (Top, ±1 min, Arrondir, Synchro, Stop) replanifie les bips sans autre geste
// et mémorise l’heure de fin pour qu’un rechargement ou une relance d’iOS ne perde pas le chrono.
// Un seul verrou d’écran pour le mode départ, le chrono, la trace et le GPS (js/wakelock.js) ; perdu ou refusé alors qu’il est demandé : alerte et conseil (D-05)
const wake = createWakeLock({ report: (w, m) => onWakeEvent(w, m) });
const WAKE_ADVICE = 'Écran non maintenu : réglez Verrouillage automatique sur « Jamais » pendant la course';
let wakeToastAt = 0;
function onWakeEvent(w, m) {
  if (/refus/i.test(m)) report('ecran', m); else note('ecran', m);
  renderRaceBar();
  const st = wake.state();
  if (document.visibilityState === 'hidden' || !st.wanted || st.held) return;      // masquer la page libère le verrou : ce n’est pas une perte à signaler
  if (Date.now() - wakeToastAt < 60000) return;
  wakeToastAt = Date.now(); toast(WAKE_ADVICE);
}
const timer = { running: false, iv: null };
let timerEnd = null;
Object.defineProperty(timer, 'end', {
  enumerable: true,
  get: () => timerEnd,
  set(v) {
    timerEnd = v ?? null;
    if (timerEnd == null) { beeper?.disarm(); releaseAudioIfIdle(); wake.drop('timer'); } else { beeper?.arm(timerEnd); flashKick(); wake.want('timer'); }
    store.set('rade.timer.v1', { end: timerEnd });
    if (heavyQ.size) armHeavy();
  },
});
const startMode = createStartMode({
  S, persist, timer, wake, beep: (...x) => beep(...x), audioInit: () => audioInit(), startTimer: () => startTimer(), startGps: () => startGps('auto'), gps: () => gps, say, toast,
  closed: () => { releaseGps('mode départ fermé'); raceTick(); },
  setLineEnd: (w, ll) => setLineEnd(w, ll), reanalyse: () => scheduleAnalysis(), help: () => openGuide(),
  audioRelease: () => audioRelease(), testSound: () => testSound(), chronoAlert: () => chronoAlert(), fixAlert: (a) => fixAlert(a),
  status: () => statusView(), fixLamp: (a) => fixLamp(a), lampTouch: (id) => lampTouch(id),
  firstMark: () => { const l = analysis?.legs?.[0]; return l ? { x: l.to.x, y: l.to.y, name: l.order ? String(l.order) : (l.to.name || '').split(' ')[0], doubt: DOUBT(MARKS[l.mark]) } : null; },
  line: () => S.lineOverride?.cb && S.lineOverride?.pin ? S.lineOverride : analysis ? { cb: toLL(analysis.line.cb.x, analysis.line.cb.y), pin: toLL(analysis.line.pin.x, analysis.line.pin.y) } : null,
  windAt: (p) => {
    const o = dayObs().slice(-1)[0];
    if (o && Date.now() - (o.t ?? 0) < 2 * 3600e3) return { dir: o.dir, spd: o.spd, src: 'dernier relevé' };
    if (!fieldOn) return null;                 // ouverture en cours : le mode départ affiche « Vent à relever »
    const w = F.sample(p.x, p.y); return { dir: w.dir, spd: w.spd, src: S.src === 'manual' ? 'vent manuel' : 'prévision' };
  },
});
setContext(() => (startMode.isOpen() ? 'depart' : raceActive(Date.now()) ? 'course' : 'app'));
function renderStart() {
  const el = $('section[data-tab=start]');
  const A = analysis;
  let html = `<button class="btn acc startmode-btn" id="smOpen">⛵ Mode départ plein écran <small>ping Comité / bouée · distance à la ligne · temps à brûler · côté favorisé</small></button>
    <div class="card"><h3>Ligne de départ ${tip('Position théorique de la ligne selon le cahier. Sur l’eau, passez au ras du bateau Comité et de la bouée et « pinguez » pour enregistrer la vraie ligne.')}</h3>
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
    <button type="button" class="snd-line" id="tSnd" hidden></button>
    <div class="btns" style="justify-content:center"><button class="btn acc" id="t5">Top 5’ (avertissement)</button><button class="btn" id="t4">Top 4’</button><button class="btn" id="t1">Top 1’</button></div>
    <div class="btns" style="justify-content:center"><button class="btn alt small" id="tm">−1 min</button><button class="btn alt small" id="tp">+1 min</button><button class="btn alt small" id="tsync">Arrondir à la minute</button><button class="btn alt small" id="tstop">Stop</button><button class="btn alt small" id="tTest">🔊 Tester le son</button></div>
    <table class="t" style="margin-top:8px">${IC.sequence.map((r) => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>
    <div class="small muted">Bips aux minutes, toutes les 10 s dans la dernière minute et chaque seconde les 10 dernières. Le temps se compte sur les signaux visuels (IC 10.1).</div></div>`;
  el.innerHTML = html;
  $('#lPre').onchange = (e) => { S.linePreset = e.target.value; S.lineOverride = null; persist(); scheduleAnalysis(); };
  $('#lLen').onchange = (e) => { S.lineLen = Math.max(0.04, +e.target.value || 0.12); S.lineOverride = null; persist(); scheduleAnalysis(); };
  $('#lMode').onchange = (e) => { S.lineMode = e.target.value; S.lineOverride = null; persist(); scheduleAnalysis(); renderStart(); };
  if ($('#lBrg')) $('#lBrg').onchange = (e) => { S.lineBrg = norm360(+e.target.value || 0); persist(); scheduleAnalysis(); };
  $('#lReset')?.addEventListener('click', () => { S.lineOverride = null; persist(); scheduleAnalysis(); });
  $('#smOpen').onclick = () => { startMode.open(); raceTick(); };
  $('#pingCb').onclick = () => pingLine('cb');
  $('#pingPin').onclick = () => pingLine('pin');
  const setT = (sec) => { audioInit(); timer.end = Date.now() + sec * 1000; startTimer(); raceTick(); };
  $('#t5').onclick = () => setT(300); $('#t4').onclick = () => setT(240); $('#t1').onclick = () => setT(60);
  $('#tm').onclick = () => { if (timer.end) timer.end -= 60000; }; $('#tp').onclick = () => { if (timer.end) timer.end += 60000; };
  $('#tsync').onclick = () => { if (timer.end) { const r = (timer.end - Date.now()) / 1000; timer.end = Date.now() + Math.round(r / 60) * 60000; } };
  $('#tstop').onclick = () => { timer.end = null; clearInterval(timer.iv); timer.iv = null; $('#tClock').textContent = '5:00'; $('#tPhase').textContent = 'Prêt'; renderChronoAlert(); releaseGps('chrono arrêté'); raceTick(); };
  $('#tTest').onclick = () => testSound();
  $('#tSnd').onclick = (e) => fixAlert(e.currentTarget.dataset.act);
  if (timer.iv) tickTimer();
  renderChronoAlert();
}
function pingLine(which) {
  if (!navigator.geolocation) return toast('GPS indisponible');
  navigator.geolocation.getCurrentPosition((p) => setLineEnd(which, { lat: p.coords.latitude, lon: p.coords.longitude }), (e) => { report('gps', 'ping : code ' + e.code + ' : ' + e.message); toast('GPS : ' + e.message); }, { enableHighAccuracy: true, timeout: 15000 });
}
let actx = null, beeper = null;
// Santé du son : tested = null (jamais testé) / true (entendu) / false (pas entendu) ; alive = l’horloge audio avance vraiment
const snd = { tested: null, alive: null, prev: null };
// Toujours appelé dans un geste. Le type de session « playback » (iOS 17+) passe outre le bouton silencieux : posé avant de créer
// ou de reprendre le contexte, remis à « auto » quand plus rien n’en a besoin (audioRelease). Le contexte naît ici avec son planificateur de bips.
function audioInit() {
  try {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* session audio non prise en charge */ }
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)(); beeper = createBeeper({ ctx: actx, onMiss: (m) => note('bips', 'bip manqué à ' + m.s + ' s du signal') });
      actx.addEventListener?.('statechange', () => { note('son', 'état ' + actx.state); snd.prev = null; snd.alive = null; renderChronoAlert(); renderRaceBar(); });
    }
    // resume() peut ne jamais se résoudre quand le navigateur est suspendu en arrière-plan (WebKit 281566) : reprise bornée à 1,5 s
    const prete = Promise.race([actx.resume(), new Promise((ok) => setTimeout(ok, 1500))]).catch((e) => report('son', e));
    if (timer.end != null && beeper.end !== timer.end) beeper.arm(timer.end);
    return prete;
  } catch (e) { report('son', e); return Promise.resolve(); /* audio indisponible */ }
}
function audioRelease() { try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch { /* rien à remettre */ } }
function releaseAudioIfIdle() { if (timer.end == null && !startMode?.isOpen()) audioRelease(); }
function beepAt(f, d, when) {
  const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; o.connect(g); g.connect(actx.destination);
  g.gain.setValueAtTime(0.4, when); g.gain.exponentialRampToValueAtTime(0.001, when + d); o.start(when); o.stop(when + d);
}
function beep(f = 880, d = 0.12) {
  if (!actx) return;
  beepAt(f, d, actx.currentTime);
  navigator.vibrate?.(d * 1000);
}
// L’état « running » ne prouve pas que le son sort (WebKit 276016) : l’horloge audio doit avancer au rythme de l’horloge murale
function sampleSound(now) {
  if (!actx) return;
  if (actx.state !== 'running') { snd.prev = null; snd.alive = null; return; }
  if (snd.prev && now - snd.prev.wall < 1000) return;
  const cur = { wall: now, ct: actx.currentTime };
  if (!snd.prev) { snd.prev = cur; return; }
  const a = audioAlive(snd.prev, cur); if (a !== null) { snd.alive = a; snd.prev = cur; }
}
const soundState = () => ({ state: actx?.state ?? null, alive: snd.alive, tested: snd.tested });
// « Tester le son » : trois bips posés sur l’horloge audio, puis l’équipier dit s’il les a entendus (ni le bouton silencieux ni le volume ne sont lisibles)
async function testSound() {
  await audioInit();
  if (!actx) return toast('Son indisponible sur cet appareil');
  const t = actx.currentTime;
  for (const d of [0.15, 0.55, 0.95]) beepAt(1000, 0.12, t + d);
  setTimeout(askHeard, 1300);
}
function askHeard() {
  let el = document.getElementById('sndAsk');
  if (!el) {
    el = document.createElement('div'); el.id = 'sndAsk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Test du son');
    const q = document.createElement('p'); q.textContent = 'Avez-vous entendu 3 bips ?';
    const row = document.createElement('div'); row.className = 'btns';
    const answer = (heard) => {
      snd.tested = heard; el.hidden = true;
      if (!heard) toast('Vérifiez le bouton silencieux (sur le côté de l’iPhone), le volume et le Bluetooth ; le flash visuel reste actif.');
      renderChronoAlert(); startMode?.render(); releaseAudioIfIdle();
    };
    const yes = document.createElement('button'); yes.className = 'yes'; yes.textContent = 'Oui, entendus'; yes.onclick = () => answer(true);
    const no = document.createElement('button'); no.className = 'no'; no.textContent = 'Non'; no.onclick = () => answer(false);
    row.append(yes, no); el.append(q, row); document.body.appendChild(el);
  }
  el.hidden = false;
}
// Ligne d’alerte du chrono (onglet Départ et mode départ) : null ou { text, act } ; act : 'sound' | 'test' | 'wake'.
// Priorité : son coupé, puis écran demandé mais non tenu, puis son non testé / non entendu.
function chronoAlert() {
  if (timer.end == null && !startMode.isOpen()) return null;
  sampleSound(Date.now());
  const s = soundState(), w = wake.state();
  if (s.state !== 'running' || s.alive === false) return { text: '🔇 Son coupé — touchez pour réactiver', act: 'sound' };
  if (w.wanted && !w.held) {
    return w.supported
      ? { text: '🔆 Écran non maintenu — touchez pour réessayer · sinon Réglages › Affichage et luminosité › Verrouillage automatique › Jamais', act: 'wake' }
      : { text: '🔆 Maintien de l’écran indisponible : Verrouillage automatique sur « Jamais » pendant la course', act: 'wake' };
  }
  if (s.tested === false) return { text: '🔇 Bips non entendus au test — le flash visuel reste actif', act: 'test' };
  if (s.tested === null) return { text: '🔈 Son non testé', act: 'test' };
  return null;
}
async function fixAlert(act) {
  if (act === 'sound') return audioInit();
  if (act === 'test') return testSound();
  if (act === 'wake') { await wake.retry(); if (!wake.state().held) toast(WAKE_ADVICE); }
}
function renderChronoAlert() {
  const el = document.getElementById('tSnd'); if (!el) return;
  const a = chronoAlert();
  el.hidden = !a;
  if (a) { if (el.textContent !== a.text) el.textContent = a.text; el.dataset.act = a.act; el.classList.toggle('bad', a.act !== 'test'); }
}
// Flash plein écran sur les bips clés (minutes et signal), doublure visuelle des bips ; jamais en retard de plus de 400 ms, jamais rouge
const flash = { raf: null, seen: new Set() };
function flashKick() { if (!flash.raf) flash.raf = requestAnimationFrame(flashLoop); }
function flashLoop() {
  flash.raf = null;
  const end = timer.end; if (end == null) { flash.seen.clear(); return; }
  const now = Date.now();
  for (const m of milestones(end, now - 400)) {
    if (m.at > now) break;
    if (!KEY(m) || flash.seen.has(m.at)) continue;
    flash.seen.add(m.at);
    if (S.startFlash !== false) flashNow(m.kind);
  }
  if (now < end + 2000) flash.raf = requestAnimationFrame(flashLoop);
}
function flashNow(kind) {
  let el = document.getElementById('beepFlash');
  if (!el) { el = document.createElement('div'); el.id = 'beepFlash'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
  el.className = ''; void el.offsetWidth;                                  // relance l’animation
  el.className = kind === 'go' ? 'go' : 'min';
  if (S.startSun && startMode.isOpen()) el.classList.add('dark');          // mode « plein soleil » : fond blanc, un flash blanc ne se verrait pas
}
function startTimer() { clearInterval(timer.iv); timer.iv = setInterval(tickTimer, 100); tickTimer(); flashKick(); }
function tickTimer() {
  beeper?.tick();     // remplit la fenêtre de bips posés sur l’horloge audio (js/beeper.js) ; l’affichage ci-dessous ne sonne plus
  renderChronoAlert();
  const c = $('#tClock'), ph = $('#tPhase'); if (!timer.end) return;
  const r = (timer.end - Date.now()) / 1000, s = Math.ceil(r);
  if (r > 0) {
    if (c) c.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (ph) ph.textContent = s > 240 ? 'Avertissement — pavillon de classe' : s > 60 ? 'Préparatoire (P / I / U / Z / Noir)' : 'Dernière minute !';
  } else {
    const e = -r;
    if (c) c.textContent = `+${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, '0')}`;
    if (ph) ph.textContent = e < 600 ? 'PARTI ! (départ possible jusqu’à H+10’)' : 'En course';
  }
  const lc = $('#liveClock'); if (lc && c) lc.textContent = c.textContent;
}

// ───────────────────────── VOYANT (FIAB-05) : GPS, écran, son, réseau
// Quatre lampes calculées par js/status.js à partir d’observations réelles. Visible en mode départ (barre du haut) et en course
// (bande #raceBar sous la barre du haut) ; hors course, rien. Alerte visuelle seulement : jamais de son (un son pourrait passer pour un signal).
const net = { online: navigator.onLine !== false, lastOkAt: null, rtt: null };
let probing = false, lastProbe = 0, silence = null, lampShown = null;
const lampBad = new Set();
// Sonde réseau : HEAD sur un fichier public de l’app. Le worker ne traite que les GET (sw.js) : un GET serait servi par son cache et
// dirait « réseau ok » en mode avion. Toute réponse HTTP prouve que le réseau est joignable ; navigator.onLine n’est qu’un indice.
async function probeNet() {
  if (probing) return;
  probing = true;
  const c = new AbortController(), t0 = performance.now(), to = setTimeout(() => c.abort(), 4000), avant = net.online;
  try {
    await fetch('icons/favicon-32.png?p=' + Date.now(), { method: 'HEAD', cache: 'no-store', signal: c.signal });
    net.lastOkAt = Date.now(); net.rtt = performance.now() - t0; net.online = true;
  } catch { net.rtt = null; net.online = false; /* aucune réponse : réseau injoignable, ce n’est pas une erreur de l’app */ }
  finally { clearTimeout(to); probing = false; }
  if (net.online !== avant) { note('reseau', net.online ? 'sonde : réseau joignable' : 'sonde : aucune réponse'); if (net.online) scheduleSync(2000); }   // réseau revenu : l’archive repart
  renderRaceBar(); paintIa(); paintSync();
}
function statusNow() {
  const now = Date.now();
  sampleSound(now);
  const st = computeStatus({
    now, needGps: startMode.isOpen() || recorder.active || gps?.watch != null, needScreen: raceActive(now),
    needSound: startMode.isOpen() || (timer.end != null && now < timer.end + 60e3),
    gps: { on: gps?.watch != null, lastAt: gps?.lastAt, acc: gps?.pos?.acc, err: gps?.err },
    wake: wake.state(), audio: soundState(), net,
  });
  for (const l of st.lamps) {                                  // une ligne au journal à chaque passage au rouge, pas à chaque seconde
    if (l.level === 'bad' && !lampBad.has(l.id)) { lampBad.add(l.id); note('voyant', `${l.text} : ${l.detail}`); }
    else if (l.level !== 'bad') lampBad.delete(l.id);
  }
  return st;
}
// Lampe à afficher dans la ligne d’action : celle que l’équipier vient de toucher (6 s), sinon la première lampe rouge
function statusView() {
  const st = statusNow();
  const shown = lampShown && Date.now() < lampShown.until ? st.lamps.find((l) => l.id === lampShown.id) : null;
  return { ...st, pick: shown || st.lamps.find((l) => l.level === 'bad') || null };
}
function lampTouch(id) { lampShown = { id, until: Date.now() + 6000 }; renderRaceBar(); }
function relaunchGps() {
  const origine = gps?.origin ?? 'auto';          // la lampe ne s’affiche que pendant une activité de course : sans GPS, il était d’office
  if (gps?.watch != null) { navigator.geolocation.clearWatch(gps.watch); gps = null; }      // suivi neuf : repart de zéro, avec son origine
  startGps(origine);
}
// Action d’une lampe : relancer le GPS, redemander l’écran, réactiver ou tester le son, resonder le réseau
function fixLamp(act) {
  if (act === 'gps') {
    const l = statusNow().lamps.find((x) => x.id === 'gps');
    if (gps?.watch != null && l?.level !== 'bad') { toast('GPS : ' + l.detail); return; }
    const refuse = gps?.err === 1;
    relaunchGps();
    if (refuse) toast(l.detail);
    return;
  }
  if (act === 'net') return probeNet();
  return fixAlert(act);
}
// Silence du GPS : consigné quand il commence (plus de 10 s sans point reçu) et quand il finit
function gpsSilence(now) {
  if (gps?.lastAt == null) return;
  const age = Math.round((now - gps.lastAt) / 1000);
  if (!silence && age > GPS_STALE_S) { silence = { from: gps.lastAt }; note('gps', `silence commencé (dernier point il y a ${age} s)`); }
  else if (silence && gps.lastAt > silence.from) { note('gps', `silence terminé après ${Math.round((gps.lastAt - silence.from) / 1000)} s`); silence = null; }
}
function paintLamp(b, l) {
  const t = lampLabel(l), c = 'lamp ' + l.level;
  if (b.lastChild.textContent !== t) b.lastChild.textContent = t;
  if (b.className !== c) b.className = c;
}
function buildRaceBar() {
  const el = document.createElement('div'); el.id = 'raceBar'; el.setAttribute('role', 'status'); el.hidden = true;
  const row = document.createElement('div'); row.className = 'lamps';
  for (const id of ['gps', 'screen', 'sound', 'net']) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lamp off'; b.dataset.id = id;
    b.append(document.createElement('i'), document.createElement('b')); row.appendChild(b);
  }
  const al = document.createElement('button'); al.type = 'button'; al.className = 'rb-alert'; al.hidden = true;
  al.append(document.createElement('span'), document.createElement('b'));
  el.append(row, al);
  el.addEventListener('click', (e) => {
    const lamp = e.target.closest('.lamp'); if (lamp) return lampTouch(lamp.dataset.id);
    if (e.target.closest('.rb-alert') && al.dataset.act) fixLamp(al.dataset.act);
  });
  document.body.appendChild(el);
  return el;
}
// Bande « en course » : affichée seulement quand quelque chose tourne (chrono, trace, GPS) et que le mode départ est fermé
function renderRaceBar() {
  const on = raceActive(Date.now()) && !startMode.isOpen();
  let el = document.getElementById('raceBar');
  if (!on) { if (el && !el.hidden) el.hidden = true; return; }
  if (!el) el = buildRaceBar();
  el.hidden = false;
  const v = statusView();
  el.querySelectorAll('.lamp').forEach((b) => { const l = v.lamps.find((x) => x.id === b.dataset.id); if (l) paintLamp(b, l); });
  const al = el.querySelector('.rb-alert'), p = v.pick;
  al.hidden = !p;
  if (p) {
    const txt = `${p.text} : ${p.detail}`, act = actionLabel(p.act);
    if (al.firstChild.textContent !== txt) al.firstChild.textContent = txt;
    if (al.lastChild.textContent !== act) al.lastChild.textContent = act;
    al.dataset.act = p.act || ''; al.className = 'rb-alert ' + p.level;
  }
}
// Chaque seconde : silence du GPS, sonde réseau toutes les 30 s tant que le voyant est visible, rafraîchissement de la bande
function lampTick() {
  const now = Date.now();
  if (gps) gpsSilence(now);
  if (!document.hidden && (startMode.isOpen() || raceActive(now)) && now - lastProbe >= 30000) { lastProbe = now; probeNet(); }
  if (!document.hidden) renderRaceBar();
}

// ───────────────────────── EN COURSE
// origine : 'manuel' (▶ Activer le GPS, suivi du bateau ◎) ou 'auto' (mode départ, « ⏺ Enregistrer ma trace »). Elle ne change plus tant que le GPS tourne.
function startGps(origine) {
  if (gps?.watch) return;
  if (!navigator.geolocation) { toast('GPS indisponible sur cet appareil'); return; }
  gps = { watch: null, pos: null, hist: [], lastAt: null, err: null, errMsg: null, origin: origine }; silence = null;
  gps.watch = navigator.geolocation.watchPosition((p) => {
    const q = { ...toXY(p.coords.latitude, p.coords.longitude), t: p.timestamp, acc: p.coords.accuracy, lat: p.coords.latitude, lon: p.coords.longitude };
    gps.lastAt = Date.now();                       // heure de RÉCEPTION : le voyant mesure le silence, pas l’horloge du GPS
    gps.hist.push(q); gps.hist = gps.hist.filter((h) => q.t - h.t < 20000);
    // vitesse et cap : ceux du GPS quand il les donne (iPhone), sinon calculés sur les 6 dernières secondes
    const o = gps.hist.find((h) => q.t - h.t <= 6000) || gps.hist[0], dt = (q.t - o.t) / 1000;
    if (p.coords.speed != null && p.coords.speed >= 0) { q.sog = p.coords.speed / 0.5144; q.cog = p.coords.heading >= 0 ? p.coords.heading : (dt > 2 && distXY(o, q) > 2 ? bearingXY(o, q) : null); }
    else if (dt > 2 && distXY(o, q) > 2) { q.sog = distXY(o, q) / dt / 0.5144; q.cog = bearingXY(o, q); }
    gps.pos = q; gps.err = null; gps.errMsg = null;
    scene?.setBoat(q, q.cog);
    if (follow && scene) { const t = scene.controls.target, off = scene.camera.position.clone().sub(t); t.set(q.x, 0, -q.y); scene.camera.position.copy(t.clone().add(off)); }
    if (recorder.active) recorder.add(q);
    autoAdvance();
    renderLiveNav();
    gpsSilence(gps.lastAt); renderRaceBar();
  }, (e) => { gps.err = e.code; gps.errMsg = e.message; report('gps', 'code ' + e.code + ' : ' + e.message); renderLiveNav(); renderRaceBar(); }, { enableHighAccuracy: true, maximumAge: 1000 });
  wake.want('gps');
  renderLive();
  raceTick();                                    // le verrou et le voyant de synchronisation suivent le geste tout de suite, sans attendre le tic de 5 s
}
// Le GPS allumé d’office s’éteint au geste qui termine la dernière activité de course : ✕ du mode départ, ⏹ de la trace, Stop du chrono.
// Jamais sur une horloge ; jamais tant qu’un chrono existe, que le mode départ est ouvert, qu’une trace s’enregistre ou que l’équipier l’a allumé lui-même.
// Le verrou de mise à jour n’est pas touché : tout GPS allumé reste une activité de course (D-01), donc rien ne s’échange tant qu’il tourne (D-03).
function releaseGps(cause) {
  if (!gpsLeftAlone({ gpsOn: gps?.watch != null, gpsAuto: gps?.origin === 'auto', startModeOpen: startMode.isOpen(), recording: recorder.active, timerEnd: timer.end })) return;
  note('gps', 'arrêté : ' + cause);
  stopGps();
}
async function stopGps() {
  if (recorder.active) { const tr = await recorder.stop(); if (tr?.pts.length > 1) toast(`Trace enregistrée (${tr.pts.length} points)${await rangeEnregistree(tr)}`); renderTracks(); }
  if (gps?.watch != null) navigator.geolocation.clearWatch(gps.watch); gps = null; silence = null; wake.drop('gps'); scene?.setBoat(null); renderLive(); renderRaceBar(); raceTick();
}
function autoAdvance() {
  if (!analysis || !gps?.pos) return;
  const l = analysis.legs[nextIdx]; if (!l) return;
  if (distXY(gps.pos, l.to) < 40 && nextIdx < analysis.legs.length - 1) nextIdx++;
}
// Onglet « En course » : cadre fixe + zones mises à jour à chaque position GPS
const recorder = new Recorder({ wake, report: (w, e) => report(w, e) });
let rest = null;
function renderLive() {
  const el = $('section[data-tab=live]');
  // jour de régate (D-15) : « Course finie » lève le verrou de mise à jour ; il n’arrête ni chrono, ni trace, ni GPS
  const { raceFrom, raceTo } = lockDates({ now: Date.now(), list: REG.list });
  const raceCard = isRaceDay({ now: Date.now(), raceFrom, raceTo })
    ? `<div class="card"><button class="btn alt" id="raceDone">🏁 Course finie — retour au port</button><div class="small muted" style="margin-top:6px">Permet d’appliquer une mise à jour en attente. Le chrono, la trace et le GPS ne sont pas arrêtés.</div></div>` : '';
  el.innerHTML = `${raceCard}<div class="card" id="liveGps"></div>
    <div class="card"><h3><span>Trace ${tip('Enregistre votre position toutes les 1–2 s pendant la course. L’écran reste allumé pendant l’enregistrement (sur iPhone, le GPS s’arrête si l’écran se verrouille). Les traces se retrouvent dans l’onglet Traces.')}</span></h3><div id="liveRec"></div></div>
    <div class="card timer"><div class="small muted">Chrono</div><div class="clock" id="liveClock" style="font-size:40px">—</div></div>
    <div class="card" id="liveNav"></div>
    <div class="card"><h3><span>Suite du parcours ${tip('Recalcule les bords restants depuis votre position GPS, à l’heure actuelle, avec le modèle retenu par vos relevés et l’ajustement sur le dernier relevé. Fait automatiquement après chaque nouveau relevé si le GPS est actif.')}</span></h3><div id="livePlan"></div></div>
    <details class="card obsbox" open><summary><span>🌬 Relevé de vent</span><small>sans quitter l’onglet</small></summary><div class="obs-card"></div></details>`;
  $('#raceDone')?.addEventListener('click', () => { RL.finishedAt = Date.now(); saveRL(); toast('Course finie notée'); raceTick(); });
  renderLiveNav(); renderPlan(); renderObsAll();
  if (timer.iv) tickTimer();
}
function renderLiveNav() {
  const g = $('#liveGps'), n = $('#liveNav'), r = $('#liveRec'); if (!g) return;
  const A = analysis, p = gps?.pos;
  g.innerHTML = `<div class="btns" style="margin:0">${gps ? '<button class="btn alt" id="gOff">Arrêter le GPS</button>' : '<button class="btn acc" id="gOn">▶ Activer le GPS</button>'}<span class="small muted" style="align-self:center">${gps?.err ? 'Erreur : ' + esc(gps.errMsg || gps.err) : p ? `précision ±${Math.round(p.acc)} m` : gps ? 'Recherche…' : 'Position, vitesse et cap du bateau'}</span></div>`;
  $('#gOn')?.addEventListener('click', () => startGps('manuel')); $('#gOff')?.addEventListener('click', stopGps);
  const T = recorder.track;
  r.innerHTML = T ? `<div class="btns" style="margin:0"><button class="btn rec" id="recStop">⏹ Arrêter et enregistrer</button><span class="small" style="align-self:center"><span class="recdot"></span>${T.pts.length} points · ${summarizeTime((Date.now() - T.start) / 1000)}</span></div>`
    : `<div class="btns" style="margin:0"><button class="btn acc" id="recStart">⏺ Enregistrer ma trace</button></div>`;
  $('#recStart')?.addEventListener('click', () => {
    if (!gps) startGps('auto');
    const c = COURSES.find((x) => x.id === S.courseId);
    recorder.start({ name: `${dayName(today())} — ${c.title}`, course: { id: S.courseId, cls: S.cls, laps: S.laps, day: S.day, startTime: S.startTime } });
    toast('Enregistrement lancé : gardez l’app ouverte, écran allumé.'); renderLiveNav(); raceTick();
  });
  $('#recStop')?.addEventListener('click', async () => {
    try {
      const tr = await recorder.stop();
      toast(tr && tr.pts.length > 1 ? `Trace enregistrée (${tr.pts.length} points)${await rangeEnregistree(tr)} — onglet Traces` : 'Trace trop courte, non enregistrée');
    } finally { renderLiveNav(); renderTracks(); releaseGps('trace arrêtée'); raceTick(); }      // même si la sauvegarde finale échoue : la trace n’est plus en cours
  });
  if (!A) { n.innerHTML = '<p class="small muted">Analyse du parcours en cours de calcul…</p>'; return; }
  nextIdx = Math.min(nextIdx, A.legs.length - 1);
  const l = A.legs[nextIdx];
  let html = `<h3>Prochaine marque</h3><select id="nSel">${A.legs.map((x, i) => `<option value="${i}" ${i === nextIdx ? 'selected' : ''}>${x.order ? 'Marque ' + x.order + ' — ' : ''}${esc((/^\d/.test(x.to.name) ? 'n°' : '') + x.to.name)}${x.side ? ' (' + sideName(x.side) + ')' : ''}${DOUBT(MARKS[x.mark]) ? ' (à confirmer)' : ''}</option>`).join('')}</select>`;
  if (p) {
    const brg = bearingXY(p, l.to), d = distXY(p, l.to), w = fieldOn ? F.sample(p.x, p.y) : { dir: l.wind.dir, spd: l.wind.spd };
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

// ───────────────────────── GEL DU VENT DU JOUR (ARCH-02)
// Le jour d’une régate, sans aucun geste, l’app COPIE dans la régate les prévisions du jour et les relevés de vent : à l’ouverture (y compris
// hors réseau, depuis le cache ou l’instantané embarqué), après chaque téléchargement, à chaque analyse et à chaque tic de raceTick, au plus
// toutes les 10 minutes (js/gel.js décide). Ce n’est pas un recalcul automatique : aucune copie ne lance de calcul, elle n’est donc jamais
// reportée de H−6 min à H+1 min (le sceau tombe justement à H−5 min) et ne passe ni par autoHeavy ni par deferHeavy. Une seule copie à la fois,
// lancée hors du tour courant ; une base refusée ou pleine est consignée et ne gêne ni l’interface ni le chrono.
let freezeBusy = false, freezeAgain = false, freezeFailAt = 0, icStale = false;     // icStale : un gel est tombé fiche fermée ou occupée ; elle est redessinée à la prochaine ouverture de l’onglet Régates
const couvre = (d, day) => !!d?.multi?.hourly?.time?.some((t) => String(t).startsWith(day));
const obsStamp = (obs) => obs.reduce((m, o) => Math.max(m, o.t || 0), 0);
const obsCopy = (o) => ({ day: o.day, h: o.h, t: o.t, dir: o.dir, spd: o.spd, lat: o.lat, lon: o.lon });
function freezeTick(why) {
  if (freezeBusy) { freezeAgain = true; return; }
  const now = Date.now(), day = parisClock(now).date;
  const reg = todayRegatta({ now, list: REG.list, currentId: OPEN });      // la régate ouverte ne sert qu’à départager deux régates du même jour : le gel ne dépend jamais d’une ouverture
  if (!reg || !data || now - freezeFailAt < THROTTLE_MS) return;       // pas de régate aujourd’hui, rien à copier, ou base refusée il y a moins de 10 min
  const slot = reg.frozen?.[day] || null, obs = (S.obs || []).filter((o) => o.day === day);
  const ana = analysis && analysis.day === day ? analysis : null;                // la dernière analyse déjà faite, si elle porte sur ce jour : aucun calcul n’est lancé pour geler
  const action = freezeAction({ now, regatta: reg, day, slot, dataFetched: couvre(data, day) ? data.fetched : 0, hasAnalysis: !!ana });
  const stratDue = action === 'rien' && stratNeedsCopy({ slot, hasAnalysis: !!ana });
  if (action === 'rien' && !stratDue && !obsNeedsCopy({ slot, nObsNow: obs.length, obsStamp: obsStamp(obs) })) return;
  freezeBusy = true;
  const job = { why, now, day, rid: reg.id, action, d: data, ser: series, obs: obs.map(obsCopy), slot, ana: action !== 'rien' || stratDue ? ana : null, sel: reg.sel ?? null };
  setTimeout(() => {
    freezeWrite(job).catch((e) => { freezeFailAt = Date.now(); report('gel', e); }).finally(() => {
      freezeBusy = false;
      if (freezeAgain) { freezeAgain = false; freezeTick('suite'); }
    });
  }, 0);
}
async function freezeWrite({ why, now, day, rid, action, d, ser, obs, slot, ana, sel }) {
  const strat = ana ? compactStrategy(ana, { ...ana.cfg, sel }, { toLL }) : null;
  let summary;
  if (action === 'rien') {
    summary = { ...slot, nObs: obs.length, obsStamp: obsStamp(obs) };               // nouveau relevé (ou route d’une copie tardive) : prévisions et stratégie ne bougent plus
    if (strat) summary.strategy = strategySummary(strat);
  } else {
    const reg = REG.list.find((x) => x.id === rid);
    if (!reg) return;
    const wx = couvre(d, day);                                                       // prévisions qui ne couvrent pas le jour (analyse au vent manuel) : rien de copié, et le résumé le dit
    if (wx) await putSlot(slotKey(rid, day, 'wx'), sliceDays(d, [day]));
    const model = !wx ? null : S.modelSel !== 'auto' ? S.modelSel : scoreModels(d, obs)[0]?.id || AROME_ID;
    summary = freezeSummary({ action, now, regatta: reg, day, data: wx ? d : null, series: wx ? ser : [], model, nObs: obs.length, obsStamp: obsStamp(obs), by: who(), strategy: strat });
    if (!strat && slot?.strategy) summary.strategy = slot.strategy;                 // pas d’analyse cette fois : la route déjà figée est gardée
  }
  if (strat) await putSlot(slotKey(rid, day, 'strat'), strat);
  await putSlot(slotKey(rid, day, 'obs'), { day, at: now, obs });
  const cur = REG.list.find((x) => x.id === rid);                                    // la régate a pu changer pendant l’écriture : l’index est relu
  if (!cur) return;
  // archive partagée : ce jour est à envoyer, et un téléchargement ne remplacera JAMAIS ces copies avant leur envoi (marqué après l’écriture des copies)
  const hq = (SYNC.hq ||= {}), cle = `day:${rid}|${day}`; hq[cle] = Math.max(Date.now(), (hq[cle] || 0) + 1); saveSync();
  saveReg(upsertRegatta(REG, { ...cur, frozen: { ...(cur.frozen || {}), [day]: summary } }));
  note('gel', `${action === 'rien' ? (strat ? 'route' : 'relevés') : action} · ${why} · ${obs.length} relevé(s)${strat ? ` · ${strat.legs.length} bords` : ''}`);
  if ($('section[data-tab=ic]')?.classList.contains('on') && !icBusy()) renderIC();     // la fiche, si elle est ouverte, montre le gel qui vient d’avoir lieu
  else icStale = true;                                                                    // sinon elle dirait « Pas encore figé » à l’ouverture de l’onglet
}
// Réglages qui ont servi à calculer l’analyse en cours : figés avec la route conseillée pour pouvoir la recalculer plus tard
function stratSettings(cls) {
  return {
    courseId: S.courseId, cls, laps: S.laps, wlNm: S.wlNm, startTime: S.startTime, day: S.day, linePreset: S.linePreset, lineLen: S.lineLen, lineMode: S.lineMode,
    lineBrg: S.lineBrg, lineOverride: S.lineOverride, perf: S.perf, polar: getPolar().source, model: selectedModel(), src: S.src, ...(S.src === 'manual' ? { manual: S.manual } : {}),
  };
}

// ───────────────────────── TRACES
let traceView = null;
let mapOk; const mapReady = new Promise((ok) => { mapOk = ok; });      // résolue à la marque rt:map
// Source du vent d'une trace (ARCH-02) : les prévisions vivantes si leur jour y figure, sinon le gel de ce jour (prévisions et relevés copiés
// dans la régate), sinon le vent manuel, annoncé comme tel. { kind, data, ser (série consensus), obs, resid, refDay, model, label }
async function windSource(day) {
  const manuel = (label) => ({ kind: 'aucun', data: null, ser: [], obs: S.obs || [], resid, refDay: S.day, model: selectedModel(), label });
  if (S.src === 'manual') return manuel('vent manuel (réglé dans l’onglet Vent)');
  const liveDays = new Set((data?.multi?.hourly?.time || []).map((x) => String(x).slice(0, 10)));
  const reg = REG.list.find((r) => r.frozen?.[day]);
  const kind = windSourceKind({ day, liveDays, frozenDays: new Set(reg ? [day] : []) });
  if (kind === 'live') return { kind, data, ser: series, obs: S.obs || [], resid, refDay: S.day, model: selectedModel(), label: 'prévisions du jour' };
  if (kind === 'gel') {
    try {
      const f = reg.frozen[day];
      const [wx, ob] = await Promise.all([getSlot(slotKey(reg.id, day, 'wx')), getSlot(slotKey(reg.id, day, 'obs'))]);
      if (wx?.multi?.hourly?.time?.length) {
        const obs = ob?.obs || [], model = f.model || AROME_ID;
        return { kind, data: wx, ser: consensus(wx), obs, resid: residualsFor(wx, obs, model), refDay: day, model, label: frozenLabel(f) };
      }
      note('gel', `vent figé du ${day} sans prévisions dans la base : vent manuel`);
    } catch (e) { report('gel', e); }            // base illisible : le vent manuel, dit comme tel
  }
  return manuel('vent manuel (aucune prévision pour ce jour)');
}
function trackWindAt(day, src) {
  const cache = new Map();
  return (x, y, tMs) => {
    const c = parisClock(tMs), h = Math.round((c.hour + c.minute / 60) * 4) / 4;
    let pts = cache.get(h);
    if (!pts) {
      const manuel = [{ x: 0, y: 0, ...S.manual }];
      pts = src.kind === 'aucun' || !src.data ? manuel : (modelPoints(src.data, day, h, src.model) || manuel);
      if (S.nowcast) pts = applyResiduals(pts, day, h, src.resid, src.refDay);
      cache.set(h, pts);
    }
    return idwAt(pts, x, y);
  };
}
// ───────────────────────── débrief de course
// Prévision de l'heure de tMs (heure de Paris) dans une série consensus
function forecastIn(ser, tMs) {
  const c = parisClock(tMs), key = `${c.date}T${String(c.hour).padStart(2, '0')}:00`;
  const r = ser.find((x) => x.time === key); return r?.dir != null ? { dir: r.dir, spd: r.spd } : null;
}
function busy(msg) {
  let m = document.getElementById('modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
  m.className = 'debrief'; m.hidden = false; m.innerHTML = `<div class="modal-card"><h2>Débrief de course</h2><p>${esc(msg)}</p></div>`;
}
async function runDebrief(tr) {
  fieldKey = null;                           // le débrief écrit dans F (une base par bord) : le champ affiché sera recalculé
  // même vent que l'analyse de la trace : prévisions vivantes, ou vent du jour figé quand elles ne couvrent plus ce jour (jamais le vent manuel sans le dire)
  const src = traceView?.id === tr.id && traceView.src ? traceView.src : await windSource(parisClock(tr.start).date);
  const figeTxt = src.kind === 'gel' ? ` (${src.label})` : '';
  await mapReady;                                       // le questionnaire écrit dans F et lit le terrain : la carte d'abord
  // trace rangée dans une régate : nom de l'épreuve = la régate, parcours de sa manche (celle dont le signal tombe dans la trace, sinon la manche choisie)
  const reg = regOfTrace(tr.id), manche = reg ? (raceOfTrack(reg, trackDay(tr.pts, breaksOf(tr))) || reg.races?.find((m) => m.n === reg.sel) || null) : null;
  const api = {
    F, ctx: { terrain: T, forbidden, perf: S.perf ?? 1 }, localFx: S.localFx ?? 1, forecastAt: (t) => forecastIn(src.ser, t), toast, meta: T.meta, eventName: reg?.name || IC?.event || '', courseHint: manche?.courseId ?? null,
    // relevé saisi ce jour-là le plus proche du départ (figé, si le jour l'est), sinon la prévision (figée de même)
    windGuess: (t) => {
      const near = src.obs.filter((o) => o.t && Math.abs(o.t - t) < 3 * 3600e3).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
      if (near) return { dir: Math.round(near.dir), src: `votre relevé de ${new Date(near.t).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}${figeTxt}` };
      const f = forecastIn(src.ser, t); return f ? { dir: Math.round(f.dir), src: `la prévision${figeTxt}` } : null;
    },
    restoreField: () => { fieldKey = null; updateDisplayField(); }, obs: src.obs,
  };
  let det;
  try { det = dbDetect(tr); } catch (e) { report('debrief', e); toast('Débrief impossible : ' + e.message); return; }
  const ans = await dbAsk(det, tr, api); if (!ans) return;
  busy('Analyse de la trace et calcul des routes conseillées…');
  await new Promise((r) => setTimeout(r, 30));
  let an = dbAnalyze(det, ans, api);
  const modes = await dbAskModes(an, api);
  if (modes) { ans.legModes = modes; busy('Recalcul avec vos réponses…'); await new Promise((r) => setTimeout(r, 30)); an = dbAnalyze(det, ans, api); }
  busy(navigator.onLine ? 'Rédaction de l’analyse…' : 'Rédaction de l’analyse (hors réseau : version automatique)…');
  const nar = await dbNarrative(an, ans);
  if (typeof nar.iaNote === 'string' && nar.iaNote) toast(nar.iaNote);          // quota ou budget atteint : le rapport est écrit par la rédaction automatique
  const html = await dbBuild(an, ans, nar, det, api);
  tr.report = { html, t: Date.now(), name: `${ans.event || 'Débrief'} ${new Date(an.tStart).toLocaleDateString('fr-FR')}` };
  await saveTrack(tr);
  if (traceView?.id === tr.id) traceView.tr = tr;
  const rangee = regOfTrace(tr.id);                                          // le rapport rejoint la fiche de la régate, avec son auteur
  if (rangee) { const nx = setTraceReport(rangee, tr.id, { t: tr.report.t, by: who() }); if (nx !== rangee) { saveReg(upsertRegatta(REG, nx)); refreshSheet(); } }
  showReport(tr); renderTraceDetail();
}
// Un rapport peut venir d’un autre téléphone (archive partagée) : c’est une DONNÉE, jamais du code de l’app. Il s’affiche dans un cadre `sandbox`
// sans `allow-scripts` ni `allow-same-origin` (origine opaque : ni scripts, ni stockage local, ni appels à /api avec le cookie de l’équipier) ;
// en « Plein écran », une page à nous, précédée de la politique de contenu qui interdit les scripts, l’enferme dans le même cadre.
function showReport(tr) {
  const rep = tr.report; if (!rep) return;
  let m = document.getElementById('modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
  m.className = 'report'; m.hidden = false;
  m.innerHTML = `<div class="modal-card report-card"><div class="btns" style="margin:0 0 8px"><button class="btn acc" id="rpShare">Partager le rapport</button><button class="btn alt" id="rpOpen">Plein écran</button><button class="btn alt" id="rpClose">Fermer</button></div><iframe id="rpFrame" title="Rapport de course" sandbox></iframe></div>`;
  m.querySelector('#rpFrame').srcdoc = rep.html;
  m.querySelector('#rpClose').onclick = () => { m.hidden = true; };
  m.querySelector('#rpShare').onclick = () => dbShare(rep.html, rep.name);
  m.querySelector('#rpOpen').onclick = () => {
    // politique de contenu de la page « Plein écran » : aucun script, aucun objet, aucun envoi de formulaire
    const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
    const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">${csp}<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(rep.name || 'Rapport de course')}</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;background:#fff}</style></head><body><iframe sandbox title="Rapport de course" srcdoc="${esc(rep.html)}"></iframe></body></html>`;
    const u = URL.createObjectURL(new Blob([page], { type: 'text/html' })); const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  };
}
async function renderTracks() {
  const el = $('section[data-tab=tracks]'); if (!el) return;
  let list = [];
  try { list = await listTracks(); } catch (e) { report('traces', e); /* IndexedDB indisponible : liste vide */ }
  let html = `<div class="card"><h3><span>Mes traces ${tip('Traces enregistrées dans l’onglet En course, ou importées (GPX d’un autre GPS, d’un équipier). Rangées dans la régate de leur jour, elles sont partagées avec l’équipage, hors course ; une trace d’un jour sans régate reste sur ce téléphone seulement. Exportez-les en GPX pour en garder une copie.')}</span></h3>
    ${list.length ? list.map((t) => `<div class="trow"><div><b>${esc(t.name)}</b><div class="small muted">${new Date(t.start).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${t.n} points</div></div><div class="btns" style="margin:0"><button class="btn small" data-tv="${t.id}">Analyser</button><button class="btn small alt" data-tx="${t.id}">GPX</button><button class="btn small alt" data-td="${t.id}" aria-label="Supprimer">✕</button></div></div>`).join('') : '<p class="small muted">Aucune trace. Lancez « Enregistrer ma trace » dans l’onglet En course.</p>'}
    <button class="btn alt" id="gpxBtn" style="width:100%;margin-top:8px">⤓ Importer un fichier GPX</button><input type="file" id="gpxIn" multiple hidden>
    <div class="small muted" style="margin-top:4px">Depuis Open GPX Tracker ou une autre app : enregistrez la trace dans Fichiers (Partager → « Enregistrer dans Fichiers »), puis choisissez-la ici.</div></div><div id="traceDetail"></div>`;
  el.innerHTML = html;
  $$('[data-tv]', el).forEach((b) => b.onclick = () => showTrace(b.dataset.tv));
  $$('[data-tx]', el).forEach((b) => b.onclick = async () => exportGPX(await getTrack(b.dataset.tx)));
  $$('[data-td]', el).forEach((b) => b.onclick = async () => {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Supprimer ?'; return; }
    await deleteTrack(b.dataset.td); if (traceView?.id === b.dataset.td) { traceView = null; scene.setTrace(null); }
    const rangee = regOfTrace(b.dataset.td); if (rangee) { saveReg(upsertRegatta(REG, detachTrace(rangee, b.dataset.td))); refreshSheet(); }      // plus de référence vers une trace effacée
    renderTracks();
  });
  // pas de filtre « accept » : sur iPhone, l’extension .gpx n’est pas reconnue et les fichiers apparaîtraient grisés
  $('#gpxBtn').onclick = () => $('#gpxIn').click();
  $('#gpxIn').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
    importGpx(files).catch((err) => { report('import', err); toast('Import impossible : ' + (err?.message || err)); });
  };
  if (traceView) renderTraceDetail();
  refreshLocal();
}
// Régate qui garde la référence de cette trace (null : trace sans régate)
const regOfTrace = (id) => REG.list.find((r) => (r.traces || []).some((x) => x.id === id)) || null;
const dmj = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const refreshSheet = () => { if (!icBusy()) renderIC(); };                   // la fiche de la régate courante montre les traces rangées
// Invite de choix (modale du type de busy) : l'équipier tranche quand le jour de la trace ne suffit pas. Rend { reg } (une régate de la liste),
// { create: true } (nouvelle régate à la date de la trace) ou null (laisser sans régate). Textes par esc ; une invite à la fois (l'appelant attend).
function askPlace(tr, m) {
  return new Promise((ok) => {
    let el = document.getElementById('modal'); if (!el) { el = document.createElement('div'); el.id = 'modal'; document.body.appendChild(el); }
    el.className = 'debrief'; el.hidden = false;
    const jour = dmj(m.day), btn = (att, label, cls = 'alt') => `<button type="button" class="btn ${cls}" ${att} style="width:100%;margin-top:6px">${label}</button>`;
    const titre = m.how === 'choix' ? `Cette trace du ${jour} correspond à plusieurs régates`
      : m.how === 'aucune' || m.how === 'proche' ? `Cette trace du ${jour} n’est dans aucune régate` : `Ranger cette trace du ${jour}`;
    const lignes = m.candidates.map((r, i) => btn(`data-rp="${i}"`, m.how === 'choix' ? esc(r.name) : `Ranger dans <b>${esc(r.name)}</b> (${esc(dmj(r.dateStart))})`, 'acc')).join('');
    const bas = m.how === 'choix' ? btn('data-rn="1"', 'Aucune')
      : btn('data-rc="1"', `Créer une régate le ${jour}`, 'acc') + btn('data-rn="1"', 'Laisser sans régate');
    el.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true"><h2>Trace à ranger</h2><p class="small"><b>${esc(tr.name)}</b></p><p>${esc(titre)}.</p>${lignes}${bas}</div>`;
    const fin = (v) => { el.hidden = true; ok(v); };
    el.querySelectorAll('[data-rp]').forEach((b) => b.addEventListener('click', () => fin({ reg: m.candidates[+b.dataset.rp] })));
    el.querySelector('[data-rc]')?.addEventListener('click', () => fin({ create: true }));
    el.querySelector('[data-rn]')?.addEventListener('click', () => fin(null));
  });
}
// Pose la référence de la trace dans la régate (nouvelle régate « Régate du JJ/MM » si l'équipier l'a demandé) ; rend la régate de l'index
function attachTo(reg, tr) {
  saveReg(upsertRegatta(REG, attachTrace(reg, tr, { by: who(), at: Date.now() })));
  refreshSheet();
  return REG.list.find((r) => r.id === reg.id);
}
function createFor(m, tr) {
  const r = createRegatta({ name: `Régate du ${dmj(m.day)}`, dateStart: m.day }, { now: Date.now(), by: who() });
  return r.ok ? attachTo(r.regatta, tr) : null;
}
// Range la trace dans la régate de son jour. Une seule régate ce jour-là, ou une seule manche à l'heure de la trace : sans question.
// Sinon (choix, proche, aucune) l'équipier décide par une invite ; invite = faux : la trace reste sans régate. Rend { reg, how }
async function rangeTrace(tr, { invite = true, force = false } = {}) {
  const deja = regOfTrace(tr.id);
  if (deja) return { reg: deja, how: 'deja' };                                 // déjà rangée : jamais une seconde référence
  const m = matchRegattas(tr.pts, REG.list, breaksOf(tr));
  if (!force && (m.how === 'unique' || m.how === 'heure')) return { reg: attachTo(m.candidates[0], tr), how: m.how };
  if (!invite) return { reg: null, how: m.how };
  const c = await askPlace(tr, m);
  if (!c) return { reg: null, how: m.how };
  return { reg: c.create ? createFor(m, tr) : attachTo(c.reg, tr), how: c.create ? 'cree' : 'choisie' };
}
// Trace enregistrée dans l’app, rangée à l’arrêt comme un import GPX, sans question (D-09). Rend le suffixe du message d’arrêt
// (« · rangée dans <régate> ») ou une chaîne vide. Ne fait que poser la référence : l’envoi attend toujours la fin de la course et du verrou.
async function rangeEnregistree(tr) {
  if (!(tr?.pts?.length > 1)) return '';
  try {
    const r = await rangeTrace(tr, { invite: false });
    return r.reg ? ` · rangée dans ${r.reg.name}` : '';
  } catch (e) { report('trace', e); return ''; }                              // le rangement ne doit jamais faire perdre le message d’arrêt
}
// Import de fichiers GPX, un par un : doublon reconnu (même début, même nombre de points), rangement dans la régate du jour, puis la dernière
// trace s'ouvre et, si elle est rangée, le questionnaire du débrief s'ouvre seul, pré-rempli : l'équipier le valide comme avant.
async function importGpx(files) {
  let last = null, ok = 0, dup = 0, placed = null, launch = false;
  for (const f of files) {
    try {
      let tr = fromGPX(await f.text(), f.name);
      const known = sameTrack(await listTracks(), tr);
      if (known) { tr = (await getTrack(known.id)) || tr; dup++; }              // « Déjà importée » : la trace existante est reprise, rien n'est dupliqué
      else await saveTrack(tr);
      const r = await rangeTrace(tr);
      last = tr; placed = r.reg; ok++;
      launch = !!r.reg && r.how !== 'deja';                                     // trace déjà rangée et déjà connue : on la montre, sans rouvrir le questionnaire
      if (known) toast(`Déjà importée : ${tr.name}${r.reg ? ` · dans ${r.reg.name}` : ''}`);
      else if (r.reg) toast(`Trace rangée dans ${r.reg.name}`);
    } catch (err) { report('import', err); toast(`Import impossible (${f.name}) : ${err.message}`); }
  }
  if (!last) return;
  if (ok > 1) toast(`${ok} traces importées${dup ? ` (dont ${dup} déjà importée${dup > 1 ? 's' : ''})` : ''}`);
  else if (!dup && !placed) toast(`Trace importée : ${last.pts.length} points · sans régate`);
  renderTracks();
  await showTrace(last.id);
  if (launch) runDebrief(last).catch((err) => { report('debrief', err); toast('Débrief impossible : ' + (err?.message || err)); });
}
// Trace rangée : son résumé (distance, durée active, vitesse, % de la polaire) et son rapport suivent dans la référence de la régate,
// pour que la fiche s'affiche sans ouvrir la liste des traces. Écrit seulement ce qui a changé.
function syncRef(tr, res) {
  const reg = regOfTrace(tr.id); if (!reg) return;
  let next = setTraceSummary(reg, tr.id, traceSummary(res));
  if (tr.report) next = setTraceReport(next, tr.id, { t: tr.report.t, by: reg.traces.find((x) => x.id === tr.id)?.report?.by ?? who() });
  if (next !== reg) { saveReg(upsertRegatta(REG, next)); refreshSheet(); }
}
// Fiche de régate : « Débrief » (questionnaire) ou « Voir le débrief » (rapport déjà écrit), sur un geste
async function openTraceDebrief(id) {
  const tr = await getTrack(id); if (!tr) { toast('Trace introuvable sur cet appareil'); return; }
  if (tr.report) showReport(tr); else await runDebrief(tr);
}
async function showTrace(id) {
  await mapReady;                                        // la carte (temps 2 d'init) : jamais gelée, l'appel attend
  const tr = await getTrack(id); if (!tr) { toast('Trace introuvable sur cet appareil'); return; }
  const day = parisClock(tr.start).date;
  const src = await windSource(day);                     // vent des prévisions, ou vent du jour figé si elles ne couvrent plus ce jour
  const sameCourse = analysis && tr.course && tr.course.id === analysis.course.id && tr.course.cls === analysis.cls;
  const res = analyzeTrack(tr, { windAt: trackWindAt(day, src), boatSpeed, legs: sameCourse ? analysis.legs.filter((l) => l.order) : null });
  if (!res) { toast('Trace vide'); return; }
  syncRef(tr, res);
  traceView = { id, tr, res, sameCourse, src };
  scene.setTrace(res.P, res.man);
  scene.focus(res.P.filter((_, i) => i % 10 === 0));
  renderTraceDetail();
}
function renderTraceDetail() {
  const el = $('#traceDetail'); if (!el || !traceView) return;
  const { tr, res, sameCourse, src } = traceView;
  const nT = res.man.filter((m) => m.kind === 'virement').length, nE = res.man.length - nT;
  const sp = res.split.filter((s) => !s.missed);
  const worst = sp.filter((s) => s.plan && s.t - s.plan > 30).sort((a, b) => (b.t - b.plan) - (a.t - a.plan))[0];
  // bouées à confirmer contournées sur cette trace : jusqu’à trois virages proposés par bouée, l’équipier valide (D-02 amendé, JUST-02)
  const fits = Object.entries(MARKS).filter(([, m]) => DOUBT(m)).map(([k, m]) => ({ k, m, c: candidates(res.P, toXY(m.lat, m.lon)) })).filter((f) => f.c.length);
  const hms = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fitCard = fits.length ? `<div class="card"><h3><span>Bouées à confirmer ${tip('La trace montre où vous avez contourné la bouée : l’app propose le sommet de votre virage, décalé de 14 m vers l’intérieur. Choisissez le virage qui correspond à votre arrondi : rien n’est changé sans votre validation, puis le recalage est partagé avec l’équipage à la synchronisation suivante, hors course.')}</span><small>d’après cette trace</small></h3>
    <p class="small muted" style="margin:0 0 4px">Précision attendue ±${ACCURACY_M} m (davantage si l’arrondi était large). Choisissez le virage où vous avez contourné la bouée.</p>
    ${fits.map((f) => `<div style="margin-top:10px"><b>${esc(f.k)} ${esc(f.m.name)}</b> — position à confirmer</div>${f.c.map((c, i) => `<div class="small" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0"><span>virage de ${Math.round(Math.abs(c.turn.D))}° à ${hms(c.turn.t)} · à ${Math.round(c.d0)} m de la position actuelle · passage au plus près à ${Math.round(c.near.d)} m <span class="muted">(pour information)</span></span><button class="btn small acc" data-mkfit="${esc(f.k)}" data-i="${i}">Valider</button></div>`).join('')}`).join('')}</div>` : '';
  el.innerHTML = `<div class="card"><h3><span>${esc(tr.name)}</span><small>${new Date(tr.start).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}</small></h3>
    <div class="kpis"><div class="kpi"><b>${(res.dist / NM).toFixed(1)}</b><span>Nq parcourus</span></div><div class="kpi"><b>${summarizeTime(res.dur)}</b><span>durée active ${tip('Durée d’enregistrement réel : les pauses (arrêt puis reprise, perte du GPS de plus de 2 minutes) ne sont comptées ni dans la durée ni dans la distance.')}</span></div><div class="kpi"><b>${res.vmean.toFixed(1)}</b><span>nd moyen (max ${res.vmax.toFixed(1)})</span></div></div>
    <div class="kpis" style="margin-top:8px"><div class="kpi"><b>${nT}</b><span>virements</span></div><div class="kpi"><b>${nE}</b><span>empannages</span></div><div class="kpi"><b>${res.perf ? Math.round(res.perf * 100) + ' %' : '—'}</b><span>de la polaire ${tip('Vitesse mesurée ÷ vitesse cible de la polaire J80 pour le vent du modèle à cet endroit et cette heure. Indicatif : le vent réel peut différer du modèle.')}</span></div></div>
    <p class="small muted" id="trWind" style="margin:8px 0 0">Vent de l’analyse : ${esc(src.label)}.</p>
    <p class="small" id="trReg" style="margin:4px 0 0">${regOfTrace(tr.id) ? `Rangée dans <b>${esc(regOfTrace(tr.id).name)}</b> · <button type="button" class="btn small alt" id="trDetach">Détacher</button>` : 'Sans régate · <button type="button" class="btn small alt" id="trPlace">Ranger…</button>'}</p>
    <button class="btn acc" id="trDebrief" style="width:100%;margin-top:8px">📝 ${tr.report ? 'Refaire le débrief de course' : 'Débrief de course'}</button>${tr.report ? '<button class="btn" id="trReport" style="width:100%;margin-top:6px">📄 Voir le débrief</button>' : ''}
    <div class="btns"><button class="btn alt" id="trPlay">▶ Rejouer la trace</button><button class="btn alt" id="trGpx">Exporter GPX</button><button class="btn alt" id="trHide">Masquer</button></div>
    ${sameCourse ? (sp.length ? `<h3 style="margin-top:12px">Bord par bord ${tip('Temps réel entre deux marques comparé au temps du routage optimal (même vent modèle). Un écart positif = temps perdu.')}</h3><table class="t"><tr><th>Marque</th><th>Réel</th><th>Optimal</th><th>Écart</th><th>Polaire</th></tr>${res.split.map((s) => s.missed ? `<tr><td>${s.leg.order} · ${esc(s.leg.to.name)}</td><td colspan="4" class="muted">non détectée</td></tr>` : `<tr><td>${s.leg.order} · ${esc(s.leg.to.name)}</td><td>${summarizeTime(s.t)}</td><td>${summarizeTime(s.plan)}</td><td style="color:${s.t > s.plan ? 'var(--bad)' : 'var(--ok)'}">${s.t > s.plan ? '+' : '−'}${summarizeTime(Math.abs(s.t - s.plan))}</td><td>${s.pct ? Math.round(s.pct * 100) + ' %' : '—'}</td></tr>`).join('')}</table>${worst ? `<p class="small">Bord le plus coûteux : vers <b>${esc(worst.leg.to.name)}</b> (${summarizeTime(worst.t - worst.plan)} de plus que l’optimal). Rejouez-le en comparant à la route bleue.</p>` : ''}` : '<p class="small muted">Aucune marque du parcours détectée sur cette trace (passage à plus de 250 m).</p>')
      : '<p class="small muted">Pour le découpage bord par bord, sélectionnez dans l’onglet Parcours le parcours couru (même numéro et même classe).</p>'}
    <p class="small muted">Couleur de la trace : du bleu (lent) au rouge (rapide). V = virement, E = empannage.</p></div>${fitCard}`;
  $$('[data-mkfit]', el).forEach((b) => b.addEventListener('click', () => {
    const f = fits.find((x) => x.k === b.dataset.mkfit), c = f?.c[+b.dataset.i]; if (!c) return;
    const ll = toLL(c.x, c.y);
    recalMark(f.k, { lat: +ll.lat.toFixed(6), lon: +ll.lon.toFixed(6), src: 'trace', t: tr.start });
  }));
  $('#trPlay').onclick = () => {
    const t0 = res.P[0].t; let saut = 0;                     // une pause dure une seconde de rejeu, pas des heures de bateau immobile
    scene.setReplay(res.P.map((p, i) => { if (p.brk) saut += (p.t - res.P[i - 1].t) / 1000 - 1; return { x: p.x, y: p.y, t: (p.t - t0) / 1000 - saut, hd: p.hd, twa: p.twa, bsp: p.v, spi: Math.abs(p.twa) > 110, trace: true, pct: p.pct, abs: p.t, brk: !!p.brk }; }));
    $('#replayHud').hidden = false; scene.replayControl('speed', +$('#rhSpeed').value);
  };
  $('#trGpx').onclick = () => exportGPX(tr);
  $('#trDebrief').onclick = () => runDebrief(tr);
  $('#trDetach')?.addEventListener('click', (e) => {                           // le rattachement se défait sur deux touches
    if (e.target.dataset.c !== '1') { e.target.dataset.c = '1'; e.target.textContent = 'Détacher ?'; return; }
    const reg = regOfTrace(tr.id); if (reg) { saveReg(upsertRegatta(REG, detachTrace(reg, tr.id))); refreshSheet(); toast(`Trace détachée de ${reg.name}`); }
    renderTraceDetail();
  });
  $('#trPlace')?.addEventListener('click', async () => {                      // « Ranger… » : l'invite propose les régates et la création, jamais un choix automatique
    try {
      const r = await rangeTrace(tr, { force: true });
      renderTraceDetail();
      if (r.reg) { toast(`Trace rangée dans ${r.reg.name}`); runDebrief(tr).catch((err) => { report('debrief', err); toast('Débrief impossible : ' + (err?.message || err)); }); }
    } catch (err) { report('import', err); toast('Rangement impossible : ' + (err?.message || err)); }
  });
  $('#trReport')?.addEventListener('click', () => showReport(tr));
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

// ───────────────────────── bouées : recalage par saisie (JUST-02, D-02 : possible, sans être mise en avant)
let markEdit = null;                                       // { k, txt, err, ask } : ligne du tableau des marques en cours de saisie
const cvatKey = (k) => /^\d+$/.test(k);                    // « Recaler » ne concerne que les bouées du cahier CVAT (clés numériques) ; celles d’une régate se corrigent dans la fiche
function marksRow(k, m) {
  const ed = markEdit?.k === k ? markEdit : null;
  let html = `<tr><td><b>${esc(k)}</b></td><td>${esc(m.name)}<div class="small muted">${esc(m.note)}</div></td><td class="small">${fmtLat(m.lat)}<br>${fmtLon(m.lon)}<br><span class="muted">${esc(m.src)}</span>${DOUBT(m) ? ' <span class="chip mid">à confirmer</span>' : ''}
    <div>${ed || !cvatKey(k) ? '' : `<button class="btn small alt" data-mkfix="${esc(k)}">Recaler</button>`}${m.base && !ed ? ` <button class="btn small alt" data-mkorig="${esc(k)}">Position d’origine</button>` : ''}</div></td></tr>`;
  if (ed) {
    const ask = ed.ask ? `Confirmer : déplacement de ${esc(fmtNm(ed.ask.d))}` : 'Valider';
    html += `<tr><td colspan="3"><label class="f" for="mkTxt">Nouvelle position de la bouée ${esc(k)} ${esc(m.name)}</label>
      <input id="mkTxt" type="text" inputmode="text" autocomplete="off" placeholder="43°05.845N 005°56.049E" value="${esc(ed.txt)}">
      <div class="small" id="mkErr" style="color:var(--bad)">${esc(ed.err || '')}</div>
      <div class="btns" style="margin:6px 0 0"><button class="btn small acc" id="mkOk">${ask}</button><button class="btn small alt" id="mkNo">Annuler</button></div></td></tr>`;
  }
  return html;
}
// Applique un recalage validé : mémorisé sur ce téléphone (D-04), appliqué tout de suite à MARKS, puis tout ce qui en dépend est redessiné.
// D-05 : il est aussi partagé avec l’équipage (clé « ~marks » à envoyer, hors course) ; un recalage plus récent annule une remise à l’origine en attente.
function recalMark(k, ov) {
  const kept = saveOverride(marksStore(), k, ov);
  applyOverrides(MARKS, { [k]: ov });
  if (SYNC.marksDel) delete SYNC.marksDel[k];
  markDirty(SYNC, ['~marks']); saveSync(); scheduleSync(20000);
  refreshMarks();
  const m = MARKS[k];
  toast(`Bouée ${k} ${m.name} recalée${ov.src === 'trace' ? ` : ${m.src} (±${ACCURACY_M} m)` : ` (${m.src})`}${kept ? '' : ' — non gardée après fermeture : mémoire pleine'}`);
}
function resetMark(k) {
  clearOverride(marksStore(), k); restoreMark(MARKS, k);
  (SYNC.marksDel ||= {})[k] = Date.now();                  // la remise à l’origine est envoyée tant que la fusion ne l’a pas couverte
  markDirty(SYNC, ['~marks']); saveSync(); scheduleSync(20000);
  refreshMarks();
  toast(`Bouée ${k} ${MARKS[k].name} : position d’origine rétablie`);
}
// Recalages venus de l’archive (D-05), appliqués seulement après une réponse acceptée hors course (runSync) : mémorisés comme un recalage local,
// jamais renvoyés. Un toast dit qui les a faits quand ce n’est pas cet équipier ; MARKS n’est touchée qu’ici et dans recalMark / resetMark.
function applyRemoteMarks(fusion) {
  const st = marksStore(), ch = remoteMarkChanges(fusion, loadOverrides(st), SYNC.marksDel || {}), msgs = [];
  let change = false;
  for (const [k, { by, ...ov }] of ch.put) {
    if (!MARKS[k]) continue;
    saveOverride(st, k, ov); applyOverrides(MARKS, { [k]: ov }); change = true;
    if (by !== who()) msgs.push(`Bouée ${k} ${MARKS[k].name} recalée${by ? ` par ${by}` : ''} (${MARKS[k].src})`);
  }
  for (const k of ch.del) {
    if (!MARKS[k]) continue;
    clearOverride(st, k); restoreMark(MARKS, k); change = true;
    if (ch.by[k] !== who()) msgs.push(`Bouée ${k} ${MARKS[k].name} : position d’origine rétablie${ch.by[k] ? ` par ${ch.by[k]}` : ''}`);
  }
  for (const k of ch.ack) delete SYNC.marksDel?.[k];
  if (change) { refreshMarks(); if (msgs.length) toast(msgs.join(' · ')); }
}
function refreshMarks() { markEdit = null; renderIC(); drawCourse(); scheduleAnalysis(); if (traceView) renderTraceDetail(); renderLive(); }
function submitMark() {
  const ed = markEdit; if (!ed) return;
  const r = parseLatLon(ed.txt);
  if (r.error) { ed.err = r.error; ed.ask = null; renderIC(); return; }
  const m = MARKS[ed.k], d = distXY(toXY(m.lat, m.lon), toXY(r.lat, r.lon));
  if (d > MAX_MOVE_M && !(ed.ask && ed.ask.lat === r.lat && ed.ask.lon === r.lon)) { ed.err = ''; ed.ask = { lat: r.lat, lon: r.lon, d }; renderIC(); return; }
  recalMark(ed.k, { lat: r.lat, lon: r.lon, src: 'saisie', t: Date.now() });
}
function bindMarksEdit(el) {
  $$('[data-mkfix]', el).forEach((b) => b.addEventListener('click', () => { markEdit = { k: b.dataset.mkfix, txt: '', err: '', ask: null }; renderIC(); $('#mkTxt')?.focus(); }));
  $$('[data-mkorig]', el).forEach((b) => b.addEventListener('click', () => resetMark(b.dataset.mkorig)));
  if (!markEdit) return;
  $('#mkTxt').addEventListener('input', (e) => { markEdit.txt = e.target.value; markEdit.err = ''; if (markEdit.ask) { markEdit.ask = null; $('#mkOk').textContent = 'Valider'; } $('#mkErr').textContent = ''; });
  $('#mkTxt').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitMark(); });
  $('#mkOk').addEventListener('click', submitMark);
  $('#mkNo').addEventListener('click', () => { markEdit = null; renderIC(); });
}

// ───────────────────────── RÉGATES ET IC
// D-05 : le prénom de l’équipier est donné par le middleware (GET /api/membre : jamais le code ni son empreinte), copié sur l’appareil pour le hors-réseau,
// puis il complète les éléments créés sans auteur sur cet appareil. Jamais attendu avant l’interface utile ; un échec est consigné, sans message à l’équipier.
async function refreshMembre() {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch('/api/membre', { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const nom = (await r.json())?.membre;
    if (!saveMembre(localStore(), nom)) throw new Error('prénom illisible');
    const { st, n } = backfillAuthor(REG, nom);
    if (n) saveReg(st);
    if (!icBusy()) renderIC();                           // « Vous : prénom » et les auteurs complétés
  } catch (e) { note('membre', 'prénom indisponible : ' + (e?.message || e)); } finally { clearTimeout(to); }
}
// ───────────────────────── ARCHIVE PARTAGÉE (ARCH-01, D-03, D-04)
// js/archsync.js n’est jamais importé statiquement : il est chargé à la première synchronisation, après la carte (l’ouverture ne l’attend pas).
// Tout échange et toute application de réponse sont interdits pendant une course (raceActive) ; un échange commencé avant est abandonné (raceTick).
let syncMod = null, syncTimer = null, syncBusy = false, syncCtl = null, syncReady = false;
function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow('auto'), ms); }
async function syncFetch(method, query, body, delai = 15000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), delai);
  syncCtl = ctl;
  try {
    const r = await fetch('/api/archive?' + new URLSearchParams(query), { method, cache: 'no-store', credentials: 'same-origin', signal: ctl.signal, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    let j = null;
    try { j = await r.json(); } catch { /* corps vide ou illisible : seul le code de réponse compte */ }
    return { status: r.status, body: j };
  } finally { clearTimeout(to); }
}
function syncDeps() {
  return {
    now: Date.now, fetchJson: syncFetch, getState: () => REG,
    setState: (st) => {
      if (canon([st.list, st.tomb]) === canon([REG.list, REG.tomb])) return;          // rien de nouveau : ni écriture ni redessin
      saveReg(st, { fromSync: true });
      paintRegBar(); refreshRegMarks(); renderIC(); renderDaySeg(); renderBrief(); renderLive();
    },
    getMarks: () => sharedMarks(loadOverrides(marksStore()), SYNC.marksDel || {}), setMarks: applyRemoteMarks,        // recalages de bouées (D-05)
    meta: SYNC, saveMeta: saveSync, isActive: () => raceActive(Date.now()), isOnline: () => net.online,
    // copie de secours de l'index avant la première fusion appliquée ; un échec est consigné, jamais bloquant
    backup: () => { try { const brut = localStore()?.getItem(REG_KEY); if (brut != null) localStore().setItem('rade.regates.v1.bak', brut); } catch (e) { note('archive', 'copie de secours non écrite : ' + (e?.name || 'erreur')); } },
    canApply: () => !icBusy() && !markEdit && !SYNC.off,
  };
}
async function syncNow(reason) {
  if (syncBusy || (!syncReady && reason !== 'manuel')) return;
  clearTimeout(syncTimer);
  if (SYNC.off) { paintSync(); return; }                     // désactivée sur ce téléphone : aucun échange, le module n’est même pas chargé
  if (raceActive(Date.now())) { if (reason === 'manuel') toast('Course en cours : synchronisation après la course'); paintSync(); return; }
  syncBusy = true; paintSync();
  let leger = false;
  try {
    syncMod ||= await import('./archsync.js');
    if (!SYNC.first) { const marque = legacyStamp(REG); if (marque !== REG) saveReg(marque, { fromSync: true }); }     // première synchronisation : les éléments d'avant l'archive reçoivent une date
    const res = await syncMod.runSync(syncDeps(), reason);
    note('archive', res.merged ? `fusion faite, ${Object.keys(SYNC.dirty || {}).length} en attente` : res.unchanged ? 'à jour' : res.skipped ? 'reporté : ' + res.skipped : 'échec : ' + res.error);
    if (res.skipped === 'trop_tot') scheduleSync((res.in || 30000) + 500);
    else if (res.skipped === 'saisie') scheduleSync(30000);
    else if (res.error && !['no_blob', 'acces'].includes(res.error)) scheduleSync(syncMod.BACKOFF_MS[Math.min(SYNC.fails || 1, syncMod.BACKOFF_MS.length) - 1] + 500);   // recul : 30 s · 2 min · 10 min · 30 min
    else if (res.merged && Object.keys(SYNC.dirty || {}).length) scheduleSync(20000);                   // modifié pendant l’échange : à renvoyer
    leger = !!(res.merged || res.unchanged);
  } catch (e) { report('archive', e); } finally { syncBusy = false; syncCtl = null; paintSync(); }
  if (leger) runHeavyNow().catch((e) => report('archive', e));            // objets lourds : seulement après une synchronisation légère réussie
}
// Geste « Télécharger pour le hors réseau » : tout ce qui manque à CETTE régate, sans tenir compte de l'horizon de 180 jours ; la course et le verrou du jour passent avant
async function telecharger(rid, btn) {
  if (SYNC.off) { toast('Synchronisation désactivée sur ce téléphone'); return; }
  if (!net.online) { toast('Hors réseau : à faire dès le retour du réseau'); return; }
  if (heavyBusy) { toast('Un échange est déjà en cours : patientez un instant'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Téléchargement…'; }
  try {
    const res = await runHeavyNow({ only: rid, manuel: true });
    if (!res) { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Télécharger pour le hors réseau'; } return; }
    toast(res.error ? 'Téléchargement interrompu : réessayez plus tard' : res.storage ? 'Espace insuffisant sur ce téléphone : rien de plus n’est téléchargé' : res.capped ? 'Plafond du jour atteint : suite demain' : res.down ? `${res.down} élément${res.down > 1 ? 's' : ''} téléchargé${res.down > 1 ? 's' : ''}` : 'Rien de plus à télécharger pour le moment');
  } catch (e) { report('archive', e); toast('Téléchargement impossible : ' + (e?.message || e)); }
}
// Objets lourds (ARCH-03) : vent figé du jour, traces et rapports. js/archheavy.js se charge à la première fois (jamais à l'ouverture).
// D-03 : ni pendant une course ni pendant la journée de régate (jusqu'au retour au port), vérifié avant le passage et entre deux objets.
let heavyMod = null, heavyBusy = false;
// Ce qui est lisible hors réseau sur CE téléphone, pour la fiche : identifiants des traces locales et jours de vent dont les copies sont là.
// null tant que la base n'a pas été lue (la fiche ne dit alors rien de l'état). Relu par renderTracks et après chaque passage lourd.
let LOCAL = null;
async function refreshLocal() {
  try {
    const traces = new Set((await listTracks()).map((t) => t.id)), days = new Set();
    for (const r of REG.list) for (const d of Object.keys(r.frozen || {})) if ((await getSlot(slotKey(r.id, d, 'wx'))) != null) days.add(`${r.id}|${d}`);
    const nouveau = { traces, days };
    const meme = LOCAL && LOCAL.traces.size === traces.size && LOCAL.days.size === days.size && [...traces].every((x) => LOCAL.traces.has(x)) && [...days].every((x) => LOCAL.days.has(x));
    LOCAL = nouveau;
    if (!meme) refreshSheet();
  } catch (e) { report('archive', e); /* bases illisibles : la fiche ne dit rien de l'état local */ }
}
function heavyDeps() {
  return {
    now: Date.now, meta: SYNC, saveMeta: saveSync, getList: () => REG.list,
    fetchJson: (method, query, body) => syncFetch(method, query, body, 60000),
    me: who, listTracks, getTrack, saveTrack, getSlot, putSlot, slotKey,
    estimate: () => navigator.storage?.estimate?.(),
    isActive: () => raceActive(Date.now()), isLocked: () => raceLock().locked, report,
  };
}
async function runHeavyNow({ only = null, manuel = false } = {}) {
  if (heavyBusy || SYNC.off || SYNC.denied || SYNC.absent || SYNC.outdated) return null;
  if (raceActive(Date.now())) { if (manuel) toast('Course en cours : téléchargement après la course'); return null; }
  if (raceLock().locked) { if (manuel) toast('Journée de régate : téléchargement au retour au port'); return null; }
  heavyBusy = true;
  let res = null;
  try {
    heavyMod ||= await import('./archheavy.js');
    res = await heavyMod.runHeavy(heavyDeps(), { only });
    note('archive', `lourds : ${res.up} envoyé(s), ${res.down} reçu(s)${res.skipped ? ' · reporté : ' + res.skipped : ''}${res.error ? ' · échec : ' + res.error : ''}`);
    if (res.up || res.down) { renderTracks(); refreshLocal(); }
    if (!res.error && !res.skipped && !SYNC.persisted) {                              // une fois : demander au navigateur de ne pas purger les données de l’app (iOS)
      SYNC.persisted = true; saveSync();
      try { await navigator.storage?.persist?.(); } catch { /* refusé ou indisponible : sans effet */ }
    }
  } finally { heavyBusy = false; syncCtl = null; }
  if (res && (res.up || res.down) && !res.error) setTimeout(() => runHeavyNow({ only }).catch((e) => report('archive', e)), 3000);     // la suite du plan (6 objets par passage)
  return res;
}
// Rattrapage des traces gardées avant l’archive (ARCH2-01) : une seule fois par téléphone, hors course et hors journée verrouillée (D-03).
// REPRISE_KEY = { done: true, at, rangees, laissees } : posé seulement quand la boucle est allée au bout ; reportée, interrompue ou base illisible, elle est rejouée.
// Une fois posé, plus jamais de rattrapage : une trace que l’équipier détache ensuite ne revient pas. Le module est chargé par import() seulement (FIAB-06).
const REPRISE_KEY = 'rade.reprise.v1';
let repriseBusy = false;
async function reprise() {
  if (repriseBusy || store.get(REPRISE_KEY, null)?.done) return;
  repriseBusy = true;
  try {
    const mod = await import('./reprise.js');
    const res = await mod.runReprise({
      listTracks, getTrack, saveTrack, deleteTrack, getList: () => REG.list,
      save: (r) => { saveReg(upsertRegatta(REG, r)); refreshSheet(); },
      who, now: Date.now, isActive: () => raceActive(Date.now()), isLocked: () => raceLock().locked, report,
    });
    const dit = res.skipped ? 'reportée : ' + res.skipped
      : `${res.rangees} rangée(s), ${res.laissees} laissée(s) sans régate, ${res.deja} déjà rangée(s)${res.renommees ? `, ${res.renommees} renommée(s)` : ''}${res.erreurs ? `, ${res.erreurs} erreur(s)` : ''}${res.error ? ' · échec : ' + res.error : ''}`;
    note('reprise', dit);
    if (!res.skipped && !res.error) store.set(REPRISE_KEY, { done: true, at: Date.now(), rangees: res.rangees, laissees: res.laissees });
    if (res.rangees > 0) { toast(res.rangees === 1 ? '1 trace rangée dans l’archive' : `${res.rangees} traces rangées dans l’archive`); renderTracks(); }
  } catch (e) { report('reprise', e); } finally { repriseBusy = false; }
}
// Ligne d’état sous « Vous : » ; masquée tant que le module n’est pas chargé. Texte posé par textContent, jamais rouge.
// Interrupteur (Open Question 16) : couper l’échange sur CE téléphone, d’abord sur deux touches, remettre d’un geste. L’échange en cours est jeté (canApply).
function toggleSync(btn) {
  if (SYNC.off) { SYNC.off = false; saveSync(); renderIC(); scheduleSync(2000); return; }
  if (btn.dataset.c !== '1') { btn.dataset.c = '1'; btn.textContent = 'Toucher encore pour désactiver'; return; }
  SYNC.off = true; saveSync(); clearTimeout(syncTimer); renderIC();
}
function paintSync() {
  const el = $('#rgSync');
  if (!el) return;
  if (!syncMod && !SYNC.off) { el.hidden = true; return; }
  if (!syncMod) { el.textContent = 'Synchronisation désactivée'; el.dataset.level = 'off'; el.hidden = false; return; }      // désactivée avant tout chargement : le module reste dehors
  const s = syncMod.syncStatus({ off: SYNC.off, active: raceActive(Date.now()), online: net.online, busy: syncBusy, dirty: Object.keys(SYNC.dirty || {}).length, lastOkAt: SYNC.lastOkAt, fails: SYNC.fails, absent: SYNC.absent, denied: SYNC.denied, outdated: SYNC.outdated, capped: syncMod.capped(SYNC, Date.now()) });
  el.textContent = s.text + (SYNC.env === 'preview' ? ' (essai)' : ''); el.dataset.level = s.level; el.hidden = false;
}
let icDraft = null;                          // relecture des IC en cours (import ou « Modifier »), en mémoire de la page seulement : rien n’est écrit avant « Valider les IC »
// Lecture par l’IA (plan 03-06) : `imported` = numéro de l’import qui a ouvert la relecture (un autre import, « Annuler » ou « Modifier » rend la réponse en attente caduque) ;
// `icSrc` = le texte du PDF importé, en mémoire seulement. Le texte ne part chez OpenAI (via /api/ic) que sur le geste « Lire avec l’IA ».
let icSrc = null, iaSeq = 0, iaCtl = null, iaBusy = false, iaMsg = '';
const IA_TIMEOUT_MS = 70000;                 // un peu plus que maxDuration (60 s) de la fonction
// Ce que montre le bouton : l’offre (iaOffer : autre club ou lecture CVAT incomplète, avec le réseau, avec du texte), puis l’état de l’appel en cours ou de son échec
function iaState() {
  if (!(icDraft?.imported && icDraft.read === 'motifs' && icSrc)) return { show: false, enabled: false, msg: '' };
  const o = iaOffer({ text: icSrc.text, parse: icSrc.parse, online: net.online, IA: IA_IC });
  return { show: o.show, enabled: o.enabled && !iaBusy, msg: iaBusy ? iaMsg : o.enabled ? iaMsg : o.msg };
}
let rgDraft = null, rgErr = {};              // formulaire « Nouvelle régate » ouvert : sa saisie survit à un redessin
let raceDraft = null, raceErr = {};          // formulaire « Nouvelle manche » ouvert
let markFix = null;                          // correction de la position d’une bouée de régate en cours : { id, txt, err, ask }
const icBusy = () => !!(rgDraft || icDraft || raceDraft || markFix);
const courseList = () => COURSES.map(({ id, title }) => ({ id, title }));
// ── Régate ouverte (D-A1 à D-A4) : un état de la page, en mémoire. setOpen est le SEUL endroit où OPEN change après le chargement ; il n’écrit rien
// (ni index, ni file d’envoi, ni synchronisation) : ouvrir ou fermer une régate n’échange rien et ne change rien chez les autres (D-03 phase 4).
function setOpen(id) {
  OPEN = id ?? null; IC = icOf(openReg());
  note('regate', OPEN ? 'ouverte' : 'entraînement libre');          // identifiant jamais noté : le journal ne porte aucun nom
  paintRegBar();
}
// Gestes « Ouvrir » (id) et « Fermer la régate » (null) : une relecture des IC ou une saisie en cours est abandonnée, comme par « Annuler »
function openGesture(id) {
  iaCtl?.abort(); iaBusy = false; iaMsg = '';
  icDraft = null; raceDraft = null; markFix = null;
  setOpen(id);
  const r = openReg();
  toast(r ? `Régate ouverte : ${r.name}` : 'Retour à l’entraînement libre');
  afterRegChange();                                                // si le parcours choisi disparaît, son message (plus important) passe en dernier
  if (r) $('#rgSheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Bandeau du panneau, sur tous les onglets : textContent seulement (un nom de régate peut venir d’un autre téléphone)
function paintRegBar() {
  const el = $('#regBar'); if (!el) return;
  const r = openReg(), mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = txt; return e; };
  if (r) {
    const close = mk('button', 'btn small alt', 'Fermer la régate'); close.type = 'button'; close.id = 'regClose';
    close.addEventListener('click', () => openGesture(null));
    el.replaceChildren(mk('span', '', '🏁'), mk('span', 'regname', r.name), mk('span', 'chip pres', STATUS_LABEL[regattaStatus(r, Date.now())]), close);
  } else {
    const go = mk('button', 'btn small acc', 'Ouvrir une régate'); go.type = 'button'; go.id = 'regGo';
    go.addEventListener('click', () => { openTab('ic'); $('#rgList')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    el.replaceChildren(mk('span', 'regname', 'Entraînement libre'), go);
  }
  el.dataset.open = r?.id ?? '';
}
// Passage de jour sans relance (P-02) : hors course et hors saisie seulement ; sinon le jour n’avance pas et l’essai revient au tic suivant
function dayOpenTick(now, active) {
  if (active || icBusy()) return;
  const r = openOnNewDay({ now, list: REG.list, openId: OPEN, day: openDay });
  openDay = r.day;
  if (r.openId === OPEN) return;
  setOpen(r.openId);
  toast(`Jour de régate : ${openReg()?.name || ''} ouverte`);
  afterRegChange();
}

// Après un changement de régate ouverte ou de ses données : tout ce qui lit IC ou le verrou est redessiné
function afterRegChange() { markFix = null; paintRegBar(); refreshRegMarks(); renderIC(); renderDaySeg(); renderBrief(); renderLive(); }
// Bouées et parcours de la régate ouverte (D-04) : retire ceux de la précédente, ajoute les seules bouées CONFIRMÉES et les parcours dont toutes les bouées le sont.
// Un parcours choisi qui disparaît (autre régate, bouée ignorée) ramène le parcours 3 AVANT tout calcul (Pitfall 7).
function syncRegMarks() {
  const was = COURSES.find((c) => c.id === S.courseId)?.title;
  let res;
  try { res = applyRegattaMarks(MARKS, COURSES, openReg()); } catch (e) { report('bouees-regate', e); return; }
  if (res.gone.includes(S.courseId) || !COURSES.some((c) => c.id === S.courseId)) {
    S.courseId = 3; selLeg = null; S.lineOverride = null; persist();
    toast(`${was || 'Parcours choisi'} retiré (bouées d’une autre régate ou plus confirmées) : ${COURSES.find((c) => c.id === 3).title}`);
  }
}
function refreshRegMarks() { syncRegMarks(); if (analysis) { drawCourse(); renderCourse(); } scheduleAnalysis(); }
// « Choisir cette manche » (geste) : cale parcours, classe, tours, jour et heure de départ (avertissement + 5 min) comme « Caler le départ sur ces IC »
function chooseRace(n) {
  const reg = openReg(), m = reg?.races.find((x) => x.n === n);
  if (!m) return;
  const set = raceSettings(m);
  if (set.courseId != null && COURSES.some((c) => c.id === set.courseId) && S.courseId !== set.courseId) { S.courseId = set.courseId; selLeg = null; S.lineOverride = null; }
  if (set.cls) S.cls = set.cls;
  if (set.laps) S.laps = set.laps;
  if (set.startTime != null) { S.startTime = set.startTime; S.hour = Math.floor(S.startTime * 4) / 4; }
  if (set.day && set.day >= today()) S.day = set.day;
  saveReg(upsertRegatta(REG, { ...reg, sel: n }));         // la manche choisie est gardée avec la régate
  persist(); renderCourse(); updateAll(); renderIC();
  const c = COURSES.find((x) => x.id === S.courseId);
  toast(`Manche ${n} : ${c?.title || 'parcours'}, ${m.time ? `départ ${hhmm(S.startTime)} le ${dayName(S.day)}` : 'heure de départ inchangée (signal inconnu)'}`);
}
function renderIC() {
  const el = $('section[data-tab=ic]');
  const cur = openReg(), now = Date.now();
  IC = icOf(cur);
  const tel = /(0[1-9](?:[ .-]?\d{2}){4})/.exec(IC.committee || '')?.[1];
  let html = `<div class="card" id="rgList"><h3><span>Régates ${tip('Chaque régate a sa fiche : jours, manches, Instructions de Course. À l’ouverture, l’app est en Entraînement libre : Ouvrir ouvre une régate (sa fiche, ses manches, ses IC, son vent figé et ses traces), Fermer la régate revient à l’entraînement. Le jour d’une régate, l’app l’ouvre seule. La régate ouverte fixe le jour 🏁, l’heure de départ par défaut et les points clés affichés. Classées En préparation, En cours, Terminées. Ouvrir ou fermer ne change rien chez les autres.')}</span><button type="button" class="btn acc small" id="rgNew">＋ Nouvelle régate</button></h3>
    ${listHTML(groupByStatus(REG.list, now), { openId: cur?.id ?? null, now })}
    <div class="small muted" id="rgWho" style="margin-top:6px">${who() ? `Vous : ${esc(who())}` : 'Vous : — (prénom donné à la prochaine connexion)'}</div>
    <div class="small muted" id="rgSync" hidden></div>
    <div class="btns" style="margin:6px 0 0"><button type="button" class="btn small alt" id="rgSyncBtn"${SYNC.off ? ' disabled' : ''}>Synchroniser</button><button type="button" class="btn small alt" id="rgSyncOff">${SYNC.off ? 'Réactiver la synchronisation' : 'Désactiver la synchronisation'}</button>${tip(SYNC_TIP)}</div></div>`;
  if (rgDraft) html += newRegattaFormHTML(rgDraft, rgErr);
  html += cur ? sheetHTML(cur, { now, courses: courseList(), raceDraft, raceErrors: raceErr, markFix, nmOf: fmtNm, local: LOCAL?.traces ?? null, daysLocal: LOCAL?.days ?? null, me: who(), tipHtml: tip(DL_TIP) }) : noRegattaHTML();
  if (icDraft) html += reviewHTML(icDraft, icChecks(), { ia: iaState(), isLand: T ? (x, y) => T.isLand(x, y) : undefined });
  if (cur) html += `<div class="card"><h3>Instructions de course <small>${cur.ic ? 'validées' : 'à importer'}</small></h3>
    <div class="btns" style="margin:0 0 6px"><label class="btn acc small" for="icFile" style="cursor:pointer">＋ Importer des IC (PDF)</label><button class="btn alt small" id="evEdit">Modifier</button></div>
    <input type="file" id="icFile" accept="application/pdf,.pdf,.txt,text/plain" hidden>
    <div class="small muted" id="icMsg" style="margin-bottom:8px">L’app lit le PDF des IC et montre, pour chaque valeur (date, heures, VHF, Comité, zone), la phrase d’où elle vient : relisez, corrigez, puis « Valider les IC ».</div>
    <div class="small" id="icVal" style="margin-bottom:8px">${validatedHTML(cur.ic)}</div>
    <div class="kpis"><div class="kpi"><b>${esc(IC.firstWarning || '—')}</b><span>1er avertissement</span></div><div class="kpi"><b>${esc(IC.lastFinishSignal || '—')}</b><span>limite arrivée du 1er</span></div><div class="kpi"><b>VHF ${esc(IC.vhf ?? '—')}</b><span>canal de course</span></div></div>
    <p class="small">${IC.committee ? `Comité : ${tel ? `<a href="tel:${tel.replace(/\D/g, '')}">${esc(IC.committee)}</a>` : esc(IC.committee)}<br>` : ''}${IC.zone ? `Zone : ${esc(IC.zone)}<br>` : ''}${IC.id === 'snpm-2026' ? 'Avis : <a href="https://chat.whatsapp.com/J2W7onZ86t9AnqJJliPUSU" target="_blank" rel="noopener">WhatsApp « CVAT Tableau Officiel »</a>' : ''}</p>
    ${IC.firstWarning && IC.date ? `<button class="btn small alt" id="evUse">Caler le départ sur ces IC (${esc(dayName(IC.date))}, ${esc(IC.firstWarning)} + 5 min)</button>` : ''}</div>`;
  html += `<div class="card"><h3>Règles de course <small>RCV / RRS 2025-2028</small></h3><p class="small">Départs (P, I, U, Z, noir), priorités, bouées, arrivée et pénalités, en langage simple avec schémas et textes officiels FR / EN.</p>
    <div class="btns" style="margin:0"><a class="btn acc small" href="regles.html" target="_blank" rel="noopener">📘 Ouvrir les règles</a><a class="btn alt small" href="regles.html#depart" target="_blank" rel="noopener">Pavillons de départ</a><a class="btn alt small" href="regles.html#bouees" target="_blank" rel="noopener">Bouées</a><a class="btn alt small" href="regles.html#arbitre" target="_blank" rel="noopener">💬 Demander à l’arbitre</a></div></div>
  <div class="card"><h3>Pavillons de classe <small>habituels CVAT</small></h3><table class="t">${IC.classes.map((c) => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td></tr>`).join('')}</table></div>`;
  if (cur) html += `<div class="card"><h3>Points clés</h3><ul class="tips small">${(IC.keyRules || []).map((r) => `<li>${esc(r)}</li>`).join('') || '<li>Aucun point clé enregistré.</li>'}</ul>
    ${IC.text ? `<details><summary class="small">Texte complet des IC</summary><pre class="ictext">${esc(IC.text)}</pre></details>` : ''}
    <button class="btn small alt" id="evDel" style="margin-top:8px">Supprimer cette régate</button></div>`;
  html += `<div class="card"><h3>Marques <small>cahier de parcours CVAT</small></h3><table class="t"><tr><th>N°</th><th>Marque</th><th>Position</th></tr>${Object.entries(MARKS).filter(([k]) => cvatKey(k)).map(([k, m]) => marksRow(k, m)).join('')}</table>
    <div class="small muted" style="margin-top:6px">« à confirmer » = position approximative (cartes du cahier ou OpenStreetMap) : à vérifier sur zone, le Comité fait foi. Un recalage est partagé avec l’équipage à la synchronisation suivante, hors course.</div></div>
  <div class="card"><h3>Dangers</h3><ul class="tips small"><li><b>Zone interdite</b> de la presqu’île de Saint-Mandrier (zone Marine nationale, rouge sur la carte).</li>${DANGERS.map((d) => `<li><b>${esc(d.name)}</b> (${fmtLat(d.lat)} ${fmtLon(d.lon)}) : ${esc(d.note)}</li>`).join('')}</ul></div>`;
  el.innerHTML = html;
  bindMarksEdit(el);
  $('#rgSyncBtn').onclick = () => syncNow('manuel');
  $('#rgSyncOff').onclick = (e) => toggleSync(e.currentTarget);
  paintSync();
  // liste : « Ouvrir » ouvre la régate (état local de la page, rien n’est écrit ni échangé)
  $$('[data-rg]', el).forEach((b) => b.addEventListener('click', () => openGesture(b.dataset.rg)));
  // « Nouvelle régate » : trois champs (le premier jour vaut aujourd’hui, jour de Paris, tant qu’on ne le change pas)
  $('#rgNew').onclick = () => { rgDraft = { name: '', dateStart: parisClock(Date.now()).date, dateEnd: '', club: '' }; rgErr = {}; renderIC(); $('#rgName')?.focus(); };
  if (rgDraft) {
    const sync = () => { rgDraft = { name: $('#rgName').value, dateStart: $('#rgStart').value, dateEnd: $('#rgEnd').value, club: $('#rgClub').value }; };
    const create = () => {
      sync();
      const r = createRegatta(rgDraft, { now: Date.now(), by: who() });
      if (!r.ok) { rgErr = r.errors; renderIC(); return; }
      rgDraft = null; rgErr = {}; icDraft = null;
      saveReg(upsertRegatta(REG, r.regatta)); setOpen(r.regatta.id);
      toast(`Régate créée : ${r.regatta.name}`); afterRegChange();                  // si le parcours choisi disparaît, son message (plus important) passe en dernier
    };
    for (const id of ['#rgName', '#rgStart', '#rgEnd', '#rgClub']) {
      $(id).addEventListener('input', sync); $(id).addEventListener('change', sync);
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    }
    $('#rgCreate').onclick = create;
    $('#rgCancel').onclick = () => { rgDraft = null; rgErr = {}; renderIC(); };
  }
  // manches : ajout, suppression (deux touches), choix (cale parcours, classe, tours, jour et heure de départ)
  $('#rcNew')?.addEventListener('click', () => {
    const jours = daysOf(cur), auj = parisClock(Date.now()).date;
    raceDraft = { date: jours.includes(auj) ? auj : cur.dateStart, time: '', courseId: String(S.courseId), cls: S.cls, laps: String(Math.min(4, S.laps)), note: '' }; raceErr = {};
    renderIC(); $('#rcTime')?.focus();
  });
  if (raceDraft) {
    const sync = () => { raceDraft = { date: $('#rcDate').value, time: $('#rcTime').value, courseId: $('#rcCourse').value, cls: $('#rcCls').value, laps: $('#rcLaps').value, note: $('#rcNote').value }; };
    for (const id of ['#rcDate', '#rcTime', '#rcCourse', '#rcCls', '#rcLaps', '#rcNote']) { $(id).addEventListener('input', sync); $(id).addEventListener('change', sync); }
    $('#rcAdd').onclick = () => {
      sync();
      const r = addRace(cur, raceDraft, { now: Date.now(), by: who(), courses: COURSES });
      if (!r.ok) { raceErr = r.errors; renderIC(); return; }
      raceDraft = null; raceErr = {};
      saveReg(upsertRegatta(REG, r.regatta)); renderIC(); toast(`Manche ajoutée (${r.regatta.races.length} dans la régate)`);
    };
    $('#rcCancel').onclick = () => { raceDraft = null; raceErr = {}; renderIC(); };
  }
  $$('[data-race]', el).forEach((b) => b.addEventListener('click', () => chooseRace(+b.dataset.race)));
  $$('[data-rmrace]', el).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.c !== '1') { b.dataset.c = '1'; b.textContent = 'Supprimer ?'; return; }
    saveReg(upsertRegatta(REG, removeRace(cur, +b.dataset.rmrace))); renderIC();
  }));
  // traces rangées : voir (onglet Traces), débrief ou rapport, détacher (deux touches)
  $$('[data-trv]', el).forEach((b) => b.addEventListener('click', () => { openTab('tracks'); showTrace(b.dataset.trv).catch((err) => report('traces', err)); }));
  $$('[data-trd]', el).forEach((b) => b.addEventListener('click', () => openTraceDebrief(b.dataset.trd).catch((err) => { report('debrief', err); toast('Débrief impossible : ' + (err?.message || err)); })));
  $$('[data-trx]', el).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.c !== '1') { b.dataset.c = '1'; b.textContent = 'Détacher ?'; return; }
    saveReg(upsertRegatta(REG, detachTrace(cur, b.dataset.trx))); renderIC(); if (traceView) renderTraceDetail(); toast('Trace détachée de la régate');
  }));
  $$('[data-rg-dl]', el).forEach((b) => b.addEventListener('click', () => telecharger(b.dataset.rgDl, b)));       // « Télécharger pour le hors réseau » (geste)
  bindRegMarks(el, cur);
  $('#evEdit')?.addEventListener('click', () => { icDraft = reviewFromRegatta(cur); renderIC(); $('#icReview')?.scrollIntoView({ behavior: 'smooth' }); });
  $('#evDel')?.addEventListener('click', (e) => { if (e.target.dataset.c !== '1') { e.target.dataset.c = '1'; e.target.textContent = 'Confirmer la suppression'; return; } icDraft = null; saveReg(removeRegatta(REG, cur.id)); setOpen(null); afterRegChange(); });
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
      iaCtl?.abort(); iaBusy = false; iaMsg = '';
      const parse = parseIC(text, f.name); icSrc = { text, parse };
      icDraft = { ...reviewFromParse(parse, { source: f.name, text, regatta: cur }), imported: ++iaSeq };
      renderIC(); $('#icReview')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { report('ic', err); $('#icMsg').textContent = 'Lecture impossible : ' + err.message + '. Vous pouvez saisir la fiche à la main (Modifier).'; }
  };
  if (icDraft) {
    // la carte n’est pas reconstruite à chaque touche : le curseur reste dans le champ
    $$('input[data-f]', el).forEach((inp) => inp.addEventListener('input', () => { icDraft = setValue(icDraft, inp.dataset.f, inp.value); paintReview(); }));
    $$('input[data-kr]', el).forEach((cb) => cb.addEventListener('change', () => { icDraft = setKeep(icDraft, +cb.dataset.kr, cb.checked); }));
    $$('input[data-rc]', el).forEach((cb) => cb.addEventListener('change', () => { icDraft = setKeepRace(icDraft, +cb.dataset.rc, cb.checked); }));
    $$('input[data-mk]', el).forEach((cb) => cb.addEventListener('change', () => { icDraft = setKeepMark(icDraft, +cb.dataset.mk, cb.checked); paintMarksReview(); }));
    $$('input[data-co]', el).forEach((cb) => cb.addEventListener('change', () => { icDraft = setKeepCourse(icDraft, +cb.dataset.co, cb.checked); paintMarksReview(); }));
    $('#icValidate').onclick = validateIC;
    $('#icCancel').onclick = () => { iaCtl?.abort(); iaBusy = false; iaMsg = ''; icDraft = null; renderIC(); };
    $('#icIa')?.addEventListener('click', () => { readWithAI(); });
  }
}

// Bouées et parcours de la relecture : l’état des cases des parcours suit celles des bouées, sans reconstruire la carte
function paintMarksReview() {
  if (!icDraft || !$('#icReview')) return;
  (icDraft.marks || []).forEach((m, i) => { const cb = $(`#icReview input[data-mk="${i}"]`); if (cb) cb.checked = !!m.keep; });
  (icDraft.courses || []).forEach((c, i) => {
    const cb = $(`#icReview input[data-co="${i}"]`), ready = courseReady(icDraft, c);
    if (cb) { cb.checked = !!c.keep; cb.disabled = !(c.verified && ready); }
    const nr = $(`#icReview [data-co-nr="${i}"]`); if (nr) nr.hidden = ready;
  });
}

// ───────────────────────── bouées d’une régate (autre club) : voir, confirmer, corriger, ignorer (D-04, REG-04)
// Chaque geste range le résultat dans la régate (auteur et instant gardés), réinjecte les bouées confirmées et redessine la carte et le calcul.
function commitRegMarks(next, msg) {
  saveReg(upsertRegatta(REG, next)); markFix = null;
  refreshRegMarks(); renderIC();
  if (msg) toast(msg);
}
function submitRegMark(cur) {
  const fx = markFix; if (!fx) return;
  const mk = cur.marks.find((m) => m.id === fx.id); if (!mk) { markFix = null; renderIC(); return; }
  const same = fx.ask && fx.ask.txt === fx.txt;                                            // deuxième touche sur la même saisie : déplacement confirmé
  const r = moveMark(cur, fx.id, fx.txt, { by: who(), at: Date.now(), confirmFar: !!same });
  if (r.error) { fx.err = r.error; fx.ask = null; renderIC(); $('#mkxTxt')?.focus(); return; }
  if (r.ask) { fx.err = ''; fx.ask = { ...r.ask, txt: fx.txt }; renderIC(); return; }
  commitRegMarks(r.regatta, `Bouée ${mk.id} ${mk.name} : position corrigée, à confirmer`);
}
function bindRegMarks(el, cur) {
  if (!cur) return;
  const mark = (id) => cur.marks.find((m) => m.id === id);
  $$('[data-mk-voir]', el).forEach((b) => b.addEventListener('click', () => {
    const m = mark(b.dataset.mkVoir); if (!m || !Number.isFinite(m.lat)) return;
    if (!scene) { toast('La carte n’est pas encore prête'); return; }
    setSheet('min'); setTimeout(() => scene.focus([toXY(m.lat, m.lon)], 3), 320);       // le panneau se replie, puis la carte se centre sur la bouée
  }));
  $$('[data-mk-ok]', el).forEach((b) => b.addEventListener('click', () => {
    const m = mark(b.dataset.mkOk), next = confirmMark(cur, b.dataset.mkOk, { by: who(), at: Date.now() });
    if (m && next !== cur) commitRegMarks(next, `Bouée ${m.id} ${m.name} confirmée`);
  }));
  $$('[data-mk-ign]', el).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.c !== '1') { b.dataset.c = '1'; b.textContent = 'Ignorer ?'; return; }
    const m = mark(b.dataset.mkIgn);
    if (m) commitRegMarks(ignoreMark(cur, m.id, { by: who(), at: Date.now() }), `Bouée ${m.id} ${m.name} ignorée`);
  }));
  $$('[data-mk-fix]', el).forEach((b) => b.addEventListener('click', () => { markFix = { id: b.dataset.mkFix, txt: '', err: '', ask: null }; renderIC(); $('#mkxTxt')?.focus(); }));
  if (!markFix || !$('#mkxTxt')) return;
  $('#mkxTxt').addEventListener('input', (e) => { markFix.txt = e.target.value; markFix.err = ''; if (markFix.ask) { markFix.ask = null; $('#mkxOk').textContent = 'Valider'; } $('#mkxErr').textContent = ''; });
  $('#mkxTxt').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitRegMark(cur); });
  $('#mkxOk').addEventListener('click', () => submitRegMark(cur));
  $('#mkxNo').addEventListener('click', () => { markFix = null; renderIC(); });
}

// Met à jour le bouton « Lire avec l’IA » et son message sans reconstruire la carte
function paintIa() {
  const b = $('#icIa'), m = $('#icIaMsg'), st = iaState();
  if (b) b.disabled = !st.enabled;
  if (m) m.textContent = st.msg;
}
// « Lire avec l’IA » (geste) : le texte des IC, et lui seul, part à /api/ic (cookie de la page vers CE site, jamais vers OpenAI) ; la réponse arrive déjà
// vérifiée mot pour mot et remplace la relecture ouverte ; rien n’entre dans la régate avant « Valider les IC ». Un seul appel par geste.
async function readWithAI() {
  const token = icDraft?.imported;
  if (!token || iaBusy || !icSrc) return;
  const ctl = iaCtl = new AbortController();
  let timedOut = false;
  const to = setTimeout(() => { timedOut = true; ctl.abort(); }, IA_TIMEOUT_MS);
  iaBusy = true; iaMsg = 'Lecture par l’IA… (jusqu’à une minute)'; paintIa();
  try {
    const r = await fetch('/api/ic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cleanText(icSrc.text) }), signal: ctl.signal });
    const body = await r.json().catch(() => { /* corps illisible : traité comme une erreur juste après */ return null; });
    if (icDraft?.imported !== token) return;                       // relecture fermée ou remplacée entre-temps
    if (!r.ok || !body || typeof body !== 'object') throw Object.assign(new Error('HTTP ' + r.status), { status: r.status, iaCode: typeof body?.error === 'string' ? body.error : '', iaMessage: typeof body?.message === 'string' ? body.message : '' });
    icDraft = { ...reviewFromApi(body, { source: icDraft.source, text: icSrc.text, regatta: openReg() }), imported: token };
    iaMsg = '';
  } catch (err) {
    if (icDraft?.imported !== token) return;
    report('ic-ia', timedOut ? 'délai de 70 s dépassé' : err?.status ? 'HTTP ' + err.status : err?.name || 'erreur');   // jamais le texte des IC
    iaMsg = iaErrorMessage({ status: err?.status, code: err?.iaCode, message: err?.iaMessage, timedOut });                    // la relecture à la main reste ouverte, intacte
  } finally {
    clearTimeout(to);
    if (iaCtl === ctl) iaBusy = false;
  }
  if (icDraft?.imported === token) { renderIC(); $('#icReview')?.scrollIntoView({ behavior: 'smooth' }); }
}

// Contrôles de vraisemblance de la relecture ouverte ; la carte (terrain) sert dès qu'elle est chargée, sinon seules les bornes comptent
const icChecks = () => checksFor(icDraft, { now: Date.now(), isLand: T ? (x, y) => T.isLand(x, y) : undefined });
// Met à jour les puces, l'état du bouton « Valider les IC » et la mention « valeur modifiée » sans reconstruire la carte
function paintReview() {
  if (!icDraft || !$('#icReview')) return;
  const checks = icChecks(), ok = canValidate(icDraft, checks);
  for (const f of icDraft.fields) {
    const chip = $(`#icReview [data-chip="${f.key}"]`), mod = $(`#icReview [data-mod="${f.key}"]`), c = chipOf(checks[f.key]);
    if (chip) { chip.className = c.cls; chip.textContent = c.text; chip.hidden = !c.text; }
    if (mod) mod.hidden = !f.edited;
  }
  $('#icValidate').disabled = !ok; $('#icBlock').hidden = ok;
}

// « Valider les IC » (geste) : seul endroit où la relecture entre dans la régate, avec qui a validé et quand (D-02).
// Sans régate ouverte, elle est d’abord créée depuis les champs relus, puis ouverte.
function validateIC() {
  if (!icDraft || !canValidate(icDraft, icChecks())) return;
  const at = Date.now(), by = who(), read = (k) => String(icDraft.fields.find((f) => f.key === k)?.value ?? '').trim();
  let reg = openReg();
  if (!reg) {
    const r = createRegatta({ name: read('event'), dateStart: read('dateStart'), dateEnd: read('dateEnd'), club: '' }, { now: at, by });
    if (!r.ok) { toast(r.errors.dateStart || r.errors.name || 'Régate incomplète'); return; }
    reg = r.regatta;
  }
  const next = applyReview(reg, icDraft, { by, at });
  icDraft = null;
  saveReg(upsertRegatta(REG, next)); setOpen(next.id);
  const { firstWarning } = next.ic.fields, d = next.dateStart;
  if (firstWarning && d && d >= today() && d <= addDays(today(), 2)) { const [h, m] = firstWarning.split(':').map(Number); S.startTime = h + (m + 5) / 60; S.day = d; persist(); }
  afterRegChange(); toast(`IC validées : ${next.name}`); updateAll();
}

init().catch((e) => {
  report('demarrage', e);
  console.error(e);
  const sp = $('#splash');
  if (!sp.classList.contains('gone')) sp.innerHTML = `<div><b>Erreur au démarrage</b><small>${esc(e.message)}</small></div>`;
  else status('Carte indisponible : ' + e.message);        // l’interface utile est déjà affichée : le chrono, le mode départ et le GPS restent utilisables
});
