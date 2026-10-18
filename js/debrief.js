// Débrief automatique d'une trace GPX : détection du départ, des passages de marques et du parcours,
// vent réel déduit des bords de près, stratégie conseillée avec ce vent, écarts, puis rapport HTML partageable.
// Quelques questions lèvent les ambiguïtés (parcours, heure de départ, arrivée, près ou portant, observations).

import { toXY, toLL, bearingXY, distXY, norm180, norm360, fmtBrg, cardinal } from './geo.js';
import { boatSpeed, optimalAngles } from './polar.js';
import { analyzeTrack } from './track.js';
import { analyzeLeg } from './tactics.js';
import { MARKS, COURSES } from './courses.js';

const KN = 0.5144;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hms = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const hm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const mins = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const nm = (m) => `${(m / 1852).toFixed(2).replace('.', ',')} Nq`;
const circMean = (angles, w = null) => { let s = 0, c = 0; angles.forEach((a, i) => { const k = w ? w[i] : 1; s += k * Math.sin(a * Math.PI / 180); c += k * Math.cos(a * Math.PI / 180); }); return norm360(Math.atan2(s, c) * 180 / Math.PI); };

// ───────────────────────── détection
function points(tr) {
  const res = analyzeTrack(tr, { windAt: () => ({ dir: 0, spd: 10 }), boatSpeed, legs: null });
  return res ? res.P : [];
}
function passages(P) {
  const out = [];
  for (const [k, m] of Object.entries(MARKS)) {
    const M = toXY(m.lat, m.lon); let cur = null;
    P.forEach((p, i) => {
      const d = distXY(p, M);
      if (d < 200) { if (!cur || d < cur.d) cur = { k, d, t: p.t, i, ...(cur ? { first: cur.first } : { first: p.t }) }; }
      else if (cur && p.t - cur.t > 60000) { out.push(cur); cur = null; }
    });
    if (cur) out.push(cur);
  }
  return out.sort((a, b) => a.t - b.t);
}
function expectedSeq(c, cls, laps) {
  const seq = (c.seq[cls] || c.seq.G).filter(([m]) => MARKS[m]).map(([m, s]) => ({ k: m, side: s }));
  if (!c.laps) return seq;
  const out = []; for (let i = 0; i < laps; i++) out.push(...seq); return out;
}
function matchCourse(pass) {
  let best = null;
  for (const c of COURSES) for (const cls of Object.keys(c.seq)) for (const laps of c.laps ? [1, 2, 3] : [1]) {
    const exp = expectedSeq(c, cls, laps); if (!exp.length) continue;
    let j = 0; const hit = [];
    for (const p of pass) if (j < exp.length && p.k === exp[j].k) { hit.push({ ...p, side: exp[j].side }); j++; }
    if (!j) continue;
    const score = j * 10 - (exp.length - j) * 0.5 - laps * 0.1;
    if (!best || score > best.score) best = { c, cls, laps, exp, hit, score, reduced: j < exp.length };
  }
  return best;
}
// fortes abattées / lofées : virages de plus de 100° en moins de 40 s
function bigTurns(P, t0, t1) {
  const out = []; let last = -1e15;
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if (p.t < t0 || p.t > t1) continue;
    const q = P.find((x) => x.t >= p.t + 40000); if (!q) break;
    const d = Math.abs(norm180(q.hd - p.hd));
    if (d > 100 && p.t - last > 60000) { out.push({ t: p.t + 20000, d }); last = p.t; }
  }
  return out;
}
// lancées vers la ligne : plus de 3,5 nd pendant plus d'une minute avant le départ, suivies d'un demi-tour
function launches(P, t0, tStart) {
  const turns = bigTurns(P, t0, tStart - 30000), out = [];
  let run = null;
  for (const p of P) {
    if (p.t < t0 || p.t > tStart - 30000) continue;
    if (p.v > 3.5) { run ??= { t0: p.t }; run.t1 = p.t; }
    else if (run) { if (run.t1 - run.t0 > 60000) out.push(run); run = null; }
  }
  const merged = [];
  for (const r of out) { const l = merged[merged.length - 1]; if (l && r.t0 - l.t1 < 100000) l.t1 = r.t1; else merged.push({ ...r }); }
  return merged.filter((r) => turns.some((tu) => tu.t > r.t0 && tu.t < r.t1 + 90000));
}
function detectStart(P, firstPass) {
  const t0 = firstPass.t - 50 * 60000;
  const turns = bigTurns(P, t0, firstPass.t - 120000);
  const last = turns[turns.length - 1];
  return last ? last.t : Math.max(P[0].t, firstPass.t - 30 * 60000);
}
// vent : bissectrice des deux familles de caps, fenêtres glissantes de 8 min
function windWindows(P, t0, t1) {
  const out = [];
  for (let t = t0; t < t1; t += 120000) {
    const W = P.filter((p) => p.t >= t && p.t < t + 480000 && p.v > 1.5);
    if (W.length < 60) continue;
    // 2-moyennes circulaires sur les caps
    let a = W[0].hd, b = norm360(a + 90);
    for (let it = 0; it < 12; it++) {
      const A = [], B = [];
      for (const p of W) (Math.abs(norm180(p.hd - a)) <= Math.abs(norm180(p.hd - b)) ? A : B).push(p.hd);
      if (!A.length || !B.length) break;
      a = circMean(A); b = circMean(B);
      if (it === 11) {
        const sep = Math.abs(norm180(a - b)), fa = A.length / W.length;
        const spread = (L, m) => Math.sqrt(L.reduce((s, h) => s + norm180(h - m) ** 2, 0) / L.length);
        if (sep > 65 && sep < 140 && fa > 0.2 && fa < 0.8 && spread(A, a) < 18 && spread(B, b) < 18)
          out.push({ t: t + 240000, mid: norm360(a + norm180(b - a) / 2), sep, sog: W.reduce((s, p) => s + p.v, 0) / W.length });
      }
    }
  }
  return out;
}

export function detect(tr) {
  const P = points(tr);
  if (P.length < 50) throw new Error('trace trop courte');
  const pass = passages(P);
  const mc = pass.length ? matchCourse(pass) : null;
  const firstPass = mc?.hit[0] || null;
  const tStart = firstPass ? detectStart(P, firstPass) : P[0].t;
  const lau = firstPass ? launches(P, tStart - 15 * 60000, tStart) : [];
  return { P, pass, mc, tStart, launches: lau, finish: mc?.hit[mc.hit.length - 1] || null };
}

// ───────────────────────── analyse complète (après les réponses)
function legStats(P, A, B, t0, t1, wdir) {
  const S = P.filter((p) => p.t >= t0 && p.t <= t1);
  let dist = 0; for (let i = 1; i < S.length; i++) dist += distXY(S[i - 1], S[i]);
  const brg = bearingXY(A, B), ux = Math.sin(brg * Math.PI / 180), uy = Math.cos(brg * Math.PI / 180);
  let right = 0, maxOff = 0, side = null, cand = null, man = 0, slow = 0;
  for (const p of S) {
    const s = (p.x - A.x) * uy - (p.y - A.y) * ux; if (s > 0) right++; maxOff = Math.max(maxOff, Math.abs(s));
    if (p.v < 2) slow++;
    if (p.v < 1.5) continue;
    const sd = norm180(p.hd - wdir) >= 0 ? 1 : -1;
    if (side == null) side = sd;
    else if (sd !== side) { if (!cand || cand.s !== sd) cand = { s: sd, t: p.t }; else if (p.t - cand.t > 10000) { man++; side = sd; cand = null; } }
    else cand = null;
  }
  const n = S.length || 1;
  return { dur: (t1 - t0) / 1000, dist, direct: distXY(A, B), right: right / n, maxOff, man, slow: slow / n, sog: S.reduce((s, p) => s + p.v, 0) / n };
}
const invTws = (sog, twa) => { let best = 6, e = 1e9; for (let w = 2; w <= 25; w += 0.25) { const d = Math.abs(boatSpeed(w, twa) - sog); if (d < e) { e = d; best = w; } } return best; };

export function analyze(det, ans, api) {
  const { P } = det;
  const marks = ans.marks; // [{k, t, side}] dans l'ordre, la dernière = arrivée
  const tStart = ans.tStart, startP = P.find((p) => p.t >= tStart) || P[0];
  const tFin = marks[marks.length - 1].t;
  const W = windWindows(P, tStart - 10 * 60000, tFin + 5 * 60000);
  // directions candidates : bissectrice (près) ou son opposé (portant) ; on suit la continuité depuis la prévision
  let ref = ans.startWind ?? api.forecastAt(tStart)?.dir ?? W[0]?.mid ?? 0;
  const ref0 = ref;
  for (const w of W) { const c = [w.mid, norm360(w.mid + 180)]; w.dir = Math.abs(norm180(c[0] - ref)) <= Math.abs(norm180(c[1] - ref)) ? c[0] : c[1]; ref = w.dir; }
  const legs = [];
  let A = { ...toXY(startP.lat, startP.lon), name: 'Départ' }, ta = tStart;
  marks.forEach((m, i) => {
    const mk = MARKS[m.k], pt = P.find((p) => p.t >= m.t) || P[P.length - 1];
    const B = { ...toXY(mk.lat, mk.lon), name: `${m.k} ${mk.name}` };
    const tb = m.t;
    const inLeg = W.filter((w) => w.t - 240000 >= ta && w.t + 240000 <= tb);
    // bord tiré presque d'un seul bord : on garde le vent de référence, affiné par le cap si l'on était au près
    const Sx = P.filter((p) => p.t >= ta && p.t <= tb && p.v > 1.5), hd0 = Sx.length ? circMean(Sx.map((p) => p.hd)) : 0;
    const oneTack = Sx.length && Sx.filter((p) => Math.abs(norm180(p.hd - hd0)) < 30).length / Sx.length > 0.75;
    const brg = bearingXY(A, B);
    let dir, src;
    const forced = ans.legModes?.[i];
    const prev = legs.length ? legs[legs.length - 1].wind.dir : ref0;
    if (oneTack && !forced) {
      const up = optimalAngles(8).up.twa, c = [norm360(hd0 - up), norm360(hd0 + up)].sort((a, b) => Math.abs(norm180(a - prev)) - Math.abs(norm180(b - prev)))[0];
      dir = Math.abs(norm180(c - prev)) < 25 ? c : prev; src = Math.abs(norm180(c - prev)) < 25 ? 'votre cap au près' : 'vent de référence';
    } else if (inLeg.length) {
      const mid = circMean(inLeg.map((w) => w.mid));
      if (forced === 'pres') { dir = Math.abs(norm180(mid - brg)) < 90 ? mid : norm360(mid + 180); src = 'vos bords de près'; }
      else if (forced === 'portant') { dir = Math.abs(norm180(mid - brg)) < 90 ? norm360(mid + 180) : mid; src = 'vos empannages'; }
      else { dir = circMean(inLeg.map((w) => w.dir)); src = 'vos changements d’amure'; }
    } else {
      const near = W.filter((w) => Math.abs(w.t - (ta + tb) / 2) < 30 * 60000);
      dir = near.length ? circMean(near.map((w) => w.dir)) : api.forecastAt((ta + tb) / 2)?.dir ?? 0;
      src = near.length ? 'bords voisins' : 'prévision';
    }
    const S = P.filter((p) => p.t >= ta && p.t <= tb && p.v > 1.5);
    const twas = S.map((p) => Math.abs(norm180(p.hd - dir))).sort((a, b) => a - b);
    const sogs = S.map((p) => p.v).sort((a, b) => a - b);
    const spd = Math.max(3, Math.min(25, invTws(sogs[Math.floor(sogs.length / 2)] || 4, twas[Math.floor(twas.length / 2)] || 60)));
    const st = legStats(P, A, B, ta, tb, dir);
    // stratégie de l'app avec ce vent (relief et côtes compris)
    api.F.compute({ points: [{ x: 0, y: 0, dir, spd, gust: spd * 1.35 }] }, { localEffects: api.localFx });
    const leg = { from: A, to: B, brg, dist: distXY(A, B), side: m.side, mark: m.k };
    const plan = analyzeLeg(leg, api.F, api.ctx);
    legs.push({ i, name: `${i ? A.name.split(' ')[0] : 'Départ'} → ${m.k} ${mk.name}${i === marks.length - 1 ? ' (arrivée)' : ''}`, mk: m.k, mkName: mk.name, side: m.side, ta, tb, wind: { dir, spd: Math.round(spd * 2) / 2, src }, st, plan,
      path: plan.route ? plan.route.path.map((p) => { const ll = toLL(p.x, p.y); return [ll.lat, ll.lon]; }) : [] });
    A = B; A.name = m.k; ta = tb;
  });
  api.restoreField();
  // verdicts automatiques par bord
  for (const L of legs) {
    const p = L.plan, r = p.route, st = L.st, v = [];
    let score = 0;
    if (r) {
      const sideP = r.rightShare > 0.6 ? 'droite' : r.rightShare < 0.4 ? 'gauche' : 'axe', sideA = st.right > 0.6 ? 'droite' : st.right < 0.4 ? 'gauche' : 'axe';
      if (sideP !== 'axe' && sideA !== sideP) { v.push(`La route conseillée passait à ${sideP} de la route directe, vous êtes restés ${sideA === 'axe' ? 'sur l’axe' : 'à ' + sideA}.`); score += 2; }
      else if (sideP !== 'axe') v.push(`Même côté que la route conseillée (${sideP}).`);
      if (st.man > r.maneuvers + 3) { v.push(`${st.man} manœuvres pour ${r.maneuvers} dans la route conseillée.`); score += st.man - r.maneuvers > 6 ? 2 : 1; }
      L.planTime = r.time;
    }
    if (st.slow > 0.08) { v.push(`${Math.round(st.slow * 100)} % du bord sous 2 nd.`); score += 1; }
    L.verdict = score >= 3 ? ['bad', 'À travailler'] : score >= 1 ? ['warn', 'Écart'] : ['good', 'Conforme'];
    L.notes = v;
  }
  return { tStart, tFin, legs, W, launches: det.launches, startP };
}

// ───────────────────────── questions
function overlay(html) {
  let m = document.getElementById('modal');
  if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
  m.className = 'debrief'; m.hidden = false;
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${html}</div>`;
  return m;
}
const toLocalInput = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
const fromLocalInput = (base, v) => { const [h, m, s] = v.split(':').map(Number); const d = new Date(base); d.setHours(h, m || 0, s || 0, 0); return d.getTime(); };

export function ask(det, tr, api) {
  return new Promise((resolve) => {
    const mc = det.mc;
    const courseOpts = COURSES.filter((c) => !c.built).map((c) => `<option value="${c.id}" ${mc?.c.id === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('');
    const passOpts = det.pass.map((p, i) => `<label class="dq-pass"><input type="checkbox" data-p="${i}" ${mc?.hit.some((h) => h.t === p.t) ? 'checked' : ''}> ${hms(p.t)} · marque ${esc(p.k)} ${esc(MARKS[p.k].name)} <span class="muted">(${Math.round(p.d)} m)</span></label>`).join('');
    const m = overlay(`
      <h2>Débrief de course</h2>
      <p class="small muted">L’app a lu la trace. Vérifiez et complétez, puis lancez l’analyse.</p>
      <label class="f">Parcours couru</label><select id="dqCourse">${courseOpts}</select>
      ${mc ? `<p class="small">Détecté : <b>${esc(mc.c.title)}</b>, marques ${mc.hit.map((h) => esc(h.k)).join(' → ')}${mc.reduced ? ' (parcours réduit ou trace arrêtée avant la fin)' : ''}.</p>` : '<p class="small">Aucune marque du cahier détectée à moins de 200 m.</p>'}
      <label class="f">Marques passées (cochez celles du parcours, la dernière cochée = arrivée)</label>
      <div class="dq-list">${passOpts || '<span class="small muted">aucune</span>'}</div>
      <label class="f">Heure du bon départ</label><input id="dqStart" type="time" step="1" value="${toLocalInput(det.tStart)}">
      <p class="small muted">${det.launches.length ? `Lancées avant le départ détectées : ${det.launches.map((l) => `${hm(l.t0)}–${hm(l.t1)}`).join(', ')} (faux départs ou rappels ?).` : 'Pas d’autre lancée détectée avant le départ.'}</p>
      <label class="f">Vent au départ (direction d’où il vient, en degrés)</label><input id="dqWind" type="number" min="0" max="359" inputmode="numeric" value="${api.windGuess(det.tStart)?.dir ?? ''}">
      <p class="small muted">${api.windGuess(det.tStart)?.src ? `Pré-rempli avec ${esc(api.windGuess(det.tStart).src)}. ` : ''}Indispensable : la trace seule ne distingue pas un bord de près d’un vent arrière dans la direction opposée.</p>
      <label class="f">Faux départs / rappels</label><select id="dqFalse">${[0, 1, 2, 3].map((n) => `<option ${n === det.launches.length ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="f">Arrivée</label><select id="dqFinish"><option value="line">Ligne d’arrivée normale</option><option value="reduced" ${mc?.reduced ? 'selected' : ''}>Parcours réduit (pointage à la dernière marque cochée)</option></select>
      <label class="f">Départ : extrémité et amure</label><input id="dqStartNote" type="text" placeholder="ex. bâbord à la bouée sur une bascule gauche">
      <label class="f">Ce que vous avez vu sur l’eau</label><textarea id="dqNotes" rows="4" placeholder="Bateaux qui doublent, plus de vent au large, nouveau vent, molles, erreurs…"></textarea>
      <div class="row2"><div><label class="f">Classement</label><input id="dqPlace" type="text" inputmode="numeric" placeholder="ex. 1"></div><div><label class="f">Sur combien de bateaux</label><input id="dqFleet" type="text" inputmode="numeric" placeholder="facultatif"></div></div>
      <label class="f">Nom de l’épreuve</label><input id="dqEvent" type="text" value="${esc(api.eventName || '')}">
      <div class="btns"><button class="btn acc" id="dqGo">Analyser</button><button class="btn alt" id="dqCancel">Annuler</button></div>`);
    m.querySelector('#dqCancel').onclick = () => { m.hidden = true; resolve(null); };
    m.querySelector('#dqGo').onclick = () => {
      const picked = [...m.querySelectorAll('[data-p]')].filter((x) => x.checked).map((x) => det.pass[+x.dataset.p]);
      if (!picked.length) { api.toast('Cochez au moins une marque'); return; }
      const wv = m.querySelector('#dqWind').value; if (wv === '') { api.toast('Indiquez le vent au départ'); return; }
      const c = COURSES.find((x) => x.id === +m.querySelector('#dqCourse').value);
      const seq = (c.seq[mc?.cls || 'G'] || c.seq.G);
      const marks = picked.map((p) => ({ k: p.k, t: p.t, side: seq.find(([k]) => k === p.k)?.[1] ?? null }));
      resolve({
        course: c, cls: mc?.cls || 'G', marks, startWind: norm360(+wv), tStart: fromLocalInput(det.tStart, m.querySelector('#dqStart').value || toLocalInput(det.tStart)),
        falseStarts: +m.querySelector('#dqFalse').value, reduced: m.querySelector('#dqFinish').value === 'reduced',
        startNote: m.querySelector('#dqStartNote').value.trim(), notes: m.querySelector('#dqNotes').value.trim(),
        place: m.querySelector('#dqPlace').value.trim(), fleet: m.querySelector('#dqFleet').value.trim(), event: m.querySelector('#dqEvent').value.trim(),
      });
    };
  });
}
// près ou portant, seulement quand la trace ne permet pas de trancher
export function askModes(an, api) {
  const amb = an.legs.filter((L) => L.st && L.wind.src === 'vos changements d’amure' && (() => {
    const d = Math.abs(norm180(L.wind.dir - bearingXY(L.plan.from, L.plan.to))); return d < 35 || d > 145;
  })());
  if (!amb.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    const m = overlay(`<h2>Une précision</h2>
      <p class="small">Sur ${amb.length > 1 ? 'ces bords' : 'ce bord'}, vos caps alternent de part et d’autre de la marque : la trace ne permet pas de savoir si vous étiez au près ou au portant.</p>
      ${amb.map((L) => `<label class="f">${esc(L.name)} (${hm(L.ta)}–${hm(L.tb)})</label><select data-l="${L.i}"><option value="pres">Au près</option><option value="portant">Au portant</option></select>`).join('')}
      <div class="btns"><button class="btn acc" id="dmGo">Continuer</button></div>`);
    amb.forEach((L) => { const s = m.querySelector(`[data-l="${L.i}"]`); const up = Math.abs(norm180(L.wind.dir - bearingXY(L.plan.from, L.plan.to))) < 90; s.value = up ? 'pres' : 'portant'; });
    m.querySelector('#dmGo').onclick = () => { const r = {}; m.querySelectorAll('[data-l]').forEach((s) => { r[+s.dataset.l] = s.value; }); m.hidden = true; resolve(r); };
  });
}

// ───────────────────────── rédaction (OpenAI via /api/debrief, sinon règles)
export async function narrative(an, ans) {
  const facts = {
    epreuve: ans.event, classement: ans.place ? `${ans.place}${ans.fleet ? ' / ' + ans.fleet : ''}` : null, parcours: ans.course.title, reduit: ans.reduced,
    depart: { heure: hms(an.tStart), faux_departs: ans.falseStarts, note: ans.startNote },
    observations: ans.notes,
    bords: an.legs.map((L) => ({ nom: L.name, debut: hm(L.ta), fin: hm(L.tb), vent: `${fmtBrg(L.wind.dir)} ${String(L.wind.spd).replace(".", ",")} nd (${L.wind.src})`, type: L.plan.type.label,
      reel: { duree_min: +(L.st.dur / 60).toFixed(1), distance_nq: +(L.st.dist / 1852).toFixed(2), directe_nq: +(L.st.direct / 1852).toFixed(2), manoeuvres: L.st.man, part_droite: Math.round(L.st.right * 100), ecart_max_m: Math.round(L.st.maxOff), part_sous_2nd: Math.round(L.st.slow * 100) },
      conseil: { duree_min: L.planTime ? +(L.planTime / 60).toFixed(1) : null, manoeuvres: L.plan.route?.maneuvers, part_droite: L.plan.route ? Math.round(L.plan.route.rightShare * 100) : null, ecart_max_m: L.plan.route ? Math.round(L.plan.route.maxOff) : null, conseils: L.plan.advice, effets_de_site: (L.plan.site || []).map((s) => s.text) },
      verdict_auto: L.verdict[1], remarques_auto: L.notes })),
  };
  if (navigator.onLine) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 45000);
      const r = await fetch('api/debrief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(facts), signal: ctl.signal });
      clearTimeout(to);
      if (r.ok) { const j = await r.json(); if (j?.resume) return { ...j, ai: true }; }
    } catch { /* hors réseau : rédaction automatique */ }
  }
  // repli : textes construits à partir des chiffres
  const good = an.legs.filter((L) => L.verdict[0] === 'good').map((L) => L.name), bad = an.legs.filter((L) => L.verdict[0] !== 'good');
  return {
    ai: false,
    resume: {
      bien: good.length ? `Bords conformes à la stratégie : ${good.join(', ')}.` : 'Aucun bord entièrement conforme à la route conseillée.',
      coute: bad.length ? bad.map((L) => `${L.name} : ${L.notes.join(' ')}`).join(' ') : 'Pas d’écart notable avec la route conseillée.',
      meteo: `Vent déduit de la trace : ${an.legs.map((L) => `${fmtBrg(L.wind.dir)} ${String(L.wind.spd).replace('.', ',')} nd`).join(', puis ')}.`,
    },
    bords: an.legs.map((L) => ({ verdict: L.verdict[0], titre: L.verdict[1], texte: L.notes.join(' ') || 'Bord conforme à la route conseillée.' })),
    retenir: [
      ...(bad.some((L) => L.st.man > (L.plan.route?.maneuvers ?? 0) + 3) ? ['Petit temps ou vent oscillant : moins de manœuvres, ne virer que sur des refusantes nettes.'] : []),
      ...(bad.some((L) => L.st.slow > 0.08) ? ['Repérer les molles à l’avance et garder de la vitesse en approche de marque.'] : []),
      'Faire un relevé de vent dès que les caps ne collent plus au vent affiché : la suite est recalculée.',
    ],
  };
}

// ───────────────────────── rapport HTML autonome
async function mapImage(an, P, meta) {
  const pts = P.filter((p) => p.t >= an.tStart - 5 * 60000 && p.t <= an.tFin + 2 * 60000);
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  an.legs.forEach((L) => { const m = MARKS[L.mk]; lats.push(m.lat); lons.push(m.lon); });
  let S = Math.min(...lats), N = Math.max(...lats), Wl = Math.min(...lons), E = Math.max(...lons);
  const padY = (N - S) * 0.12 + 0.002, padX = (E - Wl) * 0.12 + 0.003; S -= padY; N += padY; Wl -= padX; E += padX;
  const img = new Image(); img.src = 'data/basemap.jpg';
  try { await img.decode(); } catch { return { bbox: [Wl, E, S, N], url: null, w: 1000, h: 800 }; }
  const px = (lon) => (lon - meta.west) / (meta.east - meta.west) * img.naturalWidth, py = (lat) => (meta.north - lat) / (meta.north - meta.south) * img.naturalHeight;
  const sw = px(E) - px(Wl), sh = py(S) - py(N), w = 1000, h = Math.round(w * sh / sw);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(img, px(Wl), py(N), sw, sh, 0, 0, w, h);
  return { bbox: [Wl, E, S, N], url: cv.toDataURL('image/jpeg', 0.72), w, h };
}

export async function buildReport(an, ans, nar, det, api) {
  const P = det.P, map = await mapImage(an, P, api.meta);
  const [Wl, E, S, N] = map.bbox, X = (lon) => ((lon - Wl) / (E - Wl) * map.w).toFixed(1), Y = (lat) => ((N - lat) / (N - S) * map.h).toFixed(1);
  const col = (v) => v < 2 ? '#c92a2a' : v < 3.5 ? '#c27c0e' : v < 5 ? '#0d6e8a' : '#2b8a3e';
  const race = P.filter((p, i) => p.t >= an.tStart && p.t <= an.tFin && i % 3 === 0);
  const other = (f) => P.filter((p, i) => f(p) && i % 4 === 0).map((p) => `${X(p.lon)},${Y(p.lat)}`).join(' ');
  let svg = `<svg viewBox="0 0 ${map.w} ${map.h}" role="img" aria-label="Carte de la trace">${map.url ? `<image href="${map.url}" width="${map.w}" height="${map.h}"/>` : `<rect width="${map.w}" height="${map.h}" fill="#cfe3ec"/>`}`;
  svg += `<polyline points="${other((p) => p.t < an.tStart)}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".75"/><polyline points="${other((p) => p.t > an.tFin)}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".75"/>`;
  for (const L of an.legs) if (L.path.length) svg += `<polyline points="${L.path.map(([la, lo]) => `${X(lo)},${Y(la)}`).join(' ')}" fill="none" stroke="#00a6c8" stroke-width="3" stroke-dasharray="7 6"/>`;
  for (let i = 1; i < race.length; i++) svg += `<line x1="${X(race[i - 1].lon)}" y1="${Y(race[i - 1].lat)}" x2="${X(race[i].lon)}" y2="${Y(race[i].lat)}" stroke="${col(race[i].v)}" stroke-width="4.5" stroke-linecap="round"/>`;
  const lab = (x, y, t) => `<text x="${x}" y="${y}" font-family="system-ui" font-weight="700" font-size="14" fill="#fff" paint-order="stroke" stroke="#0009" stroke-width="3">${esc(t)}</text>`;
  an.legs.forEach((L, i) => { const m = MARKS[L.mk], last = i === an.legs.length - 1; svg += `<circle cx="${X(m.lon)}" cy="${Y(m.lat)}" r="12" fill="${last ? '#c92a2a' : '#e8590c'}" stroke="#fff" stroke-width="2"/><text x="${X(m.lon)}" y="${+Y(m.lat) + 5}" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="13" fill="#fff">${esc(L.mk)}</text>` + lab(+X(m.lon) + 16, +Y(m.lat) + 5, `${hm(L.tb)}${last ? ' · ARRIVÉE' : ''}`); });
  svg += `<circle cx="${X(an.startP.lon)}" cy="${Y(an.startP.lat)}" r="7" fill="#fff" stroke="#10222f" stroke-width="2"/>` + lab(+X(an.startP.lon) + 12, +Y(an.startP.lat) - 8, `DÉPART ${hm(an.tStart)}`) + '</svg>';
  // graphique du vent
  const t0 = an.tStart - 5 * 60000, t1 = an.tFin + 5 * 60000, cw = 900, ch = 220;
  const ws = an.W.filter((w) => w.t >= t0 && w.t <= t1);
  const ref = ws.length ? circMean(ws.map((w) => w.dir)) : an.legs[0].wind.dir;
  const rel = (d) => norm180(d - ref), lo = Math.min(-60, ...ws.map((w) => rel(w.dir)) ) - 10, hi = Math.max(60, ...ws.map((w) => rel(w.dir))) + 10;
  const cx = (t) => (40 + (t - t0) / (t1 - t0) * (cw - 54)).toFixed(1), cy = (d) => (10 + (hi - rel(d)) / (hi - lo) * (ch - 40)).toFixed(1);
  let wsvg = `<svg viewBox="0 0 ${cw} ${ch}" role="img" aria-label="Direction du vent">`;
  for (let k = Math.ceil(lo / 30) * 30; k <= hi; k += 30) { const d = norm360(ref + k); wsvg += `<line x1="40" x2="${cw - 14}" y1="${cy(d)}" y2="${cy(d)}" class="g"/><text x="34" y="${+cy(d) + 4}" text-anchor="end" class="ax">${fmtBrg(d)}</text>`; }
  for (let t = Math.ceil(t0 / 900000) * 900000; t <= t1; t += 900000) wsvg += `<text x="${cx(t)}" y="${ch - 6}" text-anchor="middle" class="ax">${hm(t)}</text>`;
  an.legs.forEach((L) => { wsvg += `<line x1="${cx(L.tb)}" x2="${cx(L.tb)}" y1="10" y2="${ch - 30}" class="g" stroke-dasharray="3 4"/><text x="${+cx(L.tb) + 4}" y="22" class="ax">${esc(L.mk)}</text>`; });
  const fc = []; for (let t = Math.floor(t0 / 3600000) * 3600000; t <= t1 + 3600000; t += 3600000) { const f = api.forecastAt(t); if (f?.dir != null) fc.push(`${cx(Math.max(t0, Math.min(t1, t)))},${cy(f.dir)}`); }
  if (fc.length > 1) wsvg += `<polyline points="${fc.join(' ')}" fill="none" class="fc"/>`;
  ws.forEach((w) => { wsvg += `<circle cx="${cx(w.t)}" cy="${cy(w.dir)}" r="3" class="ob"/>`; });
  wsvg += '</svg>';
  // tableaux
  const title = ans.event || 'Débrief de course', date = new Date(an.tStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const legRows = an.legs.map((L) => `<tr><td>${esc(L.name)}</td><td class="n">${hms(L.tb)}</td><td>${esc(L.plan.type.label)}</td><td class="n">${nm(L.st.direct)}</td><td class="n">${nm(L.st.dist)}</td><td class="n">${fmtBrg(L.wind.dir)} ${String(L.wind.spd).replace('.', ',')} nd</td></tr>`).join('');
  const stratCards = an.legs.map((L) => `<div class="leg"><h3>${esc(L.name)}</h3><div class="sub">vent ${fmtBrg(L.wind.dir)} ${String(L.wind.spd).replace('.', ',')} nd · ${esc(L.plan.type.label.toLowerCase())} · vent tiré de ${esc(L.wind.src)}</div><ul>${L.plan.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>${L.plan.site?.length ? `<div class="site"><b>Effets de site</b>${L.plan.site.map((s) => `<span>${esc(s.text)}</span>`).join('')}</div>` : ''}</div>`).join('');
  const gapRows = an.legs.map((L, i) => {
    const r = L.plan.route, b = nar.bords?.[i] || {}, v = b.verdict || L.verdict[0];
    const plan = r ? `${r.maneuvers} manœuvre(s), ${Math.round(r.rightShare * 100)} % à droite, écart max ${(r.maxOff / 1000).toFixed(1).replace('.', ',')} km` : '—';
    const done = `${L.st.man} manœuvre(s), ${Math.round(L.st.right * 100)} % à droite, écart max ${(L.st.maxOff / 1000).toFixed(1).replace('.', ',')} km${L.st.slow > 0.05 ? `, ${Math.round(L.st.slow * 100)} % sous 2 nd` : ''}`;
    return `<tr><td><b>${esc(L.name)}</b></td><td>${plan}</td><td>${done}</td><td class="n">${(L.st.dur / 60).toFixed(1).replace('.', ',')} / ${L.planTime ? (L.planTime / 60).toFixed(1).replace('.', ',') : '—'} min</td><td><span class="v v-${esc(v)}">${esc(b.titre || L.verdict[1])}</span><br>${esc(b.texte || L.notes.join(' '))}</td></tr>`;
  }).join('');
  const steps = [];
  an.launches.slice(0, ans.falseStarts).forEach((l, i) => steps.push([`${hm(l.t0)} → ${hm(l.t1)}`, `<b>${i + 1}${i ? 'e' : 'er'} départ, rappel.</b> Lancée à plus de 3,5 nd, puis demi-tour.`]));
  steps.push([hms(an.tStart), `<b>Départ.</b> ${esc(ans.startNote || '')}`]);
  an.legs.forEach((L) => steps.push([`${hm(L.ta)} → ${hm(L.tb)}`, `<b>${esc(L.name)}.</b> ${mins(L.st.dur)}, ${nm(L.st.dist)} parcourus, ${L.st.sog.toFixed(1).replace('.', ',')} nd de moyenne, ${L.st.man} manœuvre(s), ${Math.round(L.st.right * 100)} % du temps à droite de la route directe${L.st.slow > 0.05 ? `, ${Math.round(L.st.slow * 100)} % sous 2 nd` : ''}.`]));
  const total = (an.tFin - an.tStart) / 1000, dist = an.legs.reduce((s, L) => s + L.st.dist, 0), direct = an.legs.reduce((s, L) => s + L.st.direct, 0);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} — débrief</title>
<style>
:root{--bg:#f3f6f8;--surface:#fff;--ink:#10222f;--muted:#5a6d7a;--line:#d6e0e6;--sea:#0d6e8a;--accent:#e8590c;--good:#2b8a3e;--warn:#b8730a;--bad:#c92a2a;--chip:#e7eef2;--gold:#b8860b}
@media (prefers-color-scheme:dark){:root{--bg:#0b1820;--surface:#11232e;--ink:#e4eef3;--muted:#93a8b5;--line:#24404f;--sea:#4cc3e0;--accent:#ff8a3d;--good:#51cf66;--warn:#fcc419;--bad:#ff6b6b;--chip:#1a3240;--gold:#f2c94c;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-right)) 48px max(16px,env(safe-area-inset-left));display:grid;gap:28px}
h1{font-size:clamp(30px,6vw,48px);line-height:1.05;margin:0}h2{font-size:24px;margin:0}h3{font-size:18px;margin:0}p{margin:0;max-width:70ch}
.eyebrow{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--sea);font-weight:700}.win{color:var(--gold);font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.meta{display:flex;flex-wrap:wrap;gap:8px}.chip{background:var(--chip);border-radius:999px;padding:3px 11px;font-size:14px}
.keys,.legs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.key,.leg{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:grid;gap:6px;align-content:start;min-width:0}
.key .k{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.key.good .k{color:var(--good)}.key.warn .k{color:var(--warn)}.key.bad .k{color:var(--bad)}
section{display:grid;gap:12px;min-width:0}.fig{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}.fig svg{display:block;width:100%;height:auto}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}table{border-collapse:collapse;width:100%;font-size:14.5px}.wide{min-width:760px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:var(--chip)}tr:last-child td{border-bottom:0}
td.n{font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:nowrap}.v{display:inline-block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;border-radius:4px}
.v-good{color:var(--good);background:color-mix(in srgb,var(--good) 16%,transparent)}.v-warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 18%,transparent)}.v-bad{color:var(--bad);background:color-mix(in srgb,var(--bad) 16%,transparent)}
.leg .sub{font:13px ui-monospace,Menlo,monospace;color:var(--muted)}.leg ul{margin:0;padding-left:18px;display:grid;gap:4px;font-size:14.5px}.leg .site{font-size:14px;color:var(--muted);border-top:1px dashed var(--line);padding-top:8px;display:grid;gap:4px}
.steps{display:grid;gap:8px}.step{display:grid;grid-template-columns:130px 1fr;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 14px}.step .t{font:600 14px ui-monospace,Menlo,monospace;color:var(--sea)}
@media(max-width:560px){.step{grid-template-columns:1fr;gap:2px}}ul.list{margin:0;padding-left:20px;display:grid;gap:8px;max-width:74ch}.note{font-size:14px;color:var(--muted);max-width:74ch}
.g{stroke:var(--line)}.ax{font:11px ui-monospace,Menlo,monospace;fill:var(--muted)}.fc{stroke:var(--muted);stroke-width:2;stroke-dasharray:6 5}.ob{fill:var(--accent)}
.lg{display:flex;flex-wrap:wrap;gap:6px 16px;padding:10px 14px;font-size:13px;color:var(--muted);border-top:1px solid var(--line)}.lg i{display:inline-block;width:22px;height:4px;border-radius:2px;vertical-align:middle;margin-right:6px}
</style></head><body><div class="wrap">
<header style="display:grid;gap:8px"><div class="eyebrow">Débrief · J80 · Rade Tactique</div>${ans.place === '1' ? '<div class="win">Victoire</div>' : ''}<h1>${esc(title)}, ${esc(date)}</h1>
<div class="meta"><span class="chip">${esc(ans.course.title)}${ans.reduced ? ', réduit' : ''}</span><span class="chip">Départ ${hm(an.tStart)}${ans.falseStarts ? ` après ${ans.falseStarts} rappel${ans.falseStarts > 1 ? 's' : ''}` : ''}</span><span class="chip">Arrivée ${hms(an.tFin)}</span><span class="chip">Course ${mins(total)}</span><span class="chip">${nm(dist)} parcourus pour ${nm(direct)} de route directe</span>${ans.place ? `<span class="chip">Classement ${esc(ans.place)}${ans.fleet ? ' / ' + esc(ans.fleet) : ''}</span>` : ''}</div></header>
<div class="keys"><div class="key good"><span class="k">Ce qui a marché</span><p>${esc(nar.resume.bien)}</p></div><div class="key warn"><span class="k">Ce qui a coûté</span><p>${esc(nar.resume.coute)}</p></div><div class="key bad"><span class="k">La météo</span><p>${esc(nar.resume.meteo)}</p></div></div>
<section><h2>1 · Le parcours</h2><div class="tbl"><table><tr><th>Bord</th><th>Passage</th><th>Allure</th><th>Route directe</th><th>Parcouru</th><th>Vent</th></tr>${legRows}</table></div>
<div class="fig">${svg}<div class="lg"><span><i style="background:#2b8a3e"></i>&gt; 5 nd</span><span><i style="background:#0d6e8a"></i>3,5–5 nd</span><span><i style="background:#c27c0e"></i>2–3,5 nd</span><span><i style="background:#c92a2a"></i>&lt; 2 nd</span><span><i style="background:#00a6c8"></i>route conseillée</span></div></div></section>
<section><h2>2 · Le vent</h2><div class="fig">${wsvg}<div class="lg"><span><i style="background:var(--accent)"></i>vent déduit de vos changements d’amure</span><span><i style="background:var(--muted)"></i>prévision</span></div></div>
<p class="note">Le vent est déduit de la trace : la direction vient de l’angle entre vos deux amures, la force de votre vitesse comparée à la polaire J80. Les temps « conseil » servent à comparer des choix de route, pas à juger la vitesse.</p></section>
<section><h2>3 · La stratégie de l’app avec ce vent</h2><div class="legs">${stratCards}</div></section>
<section><h2>4 · Ce que vous avez fait</h2><div class="steps">${steps.map(([t, x]) => `<div class="step"><span class="t">${t}</span><p>${x}</p></div>`).join('')}</div>${ans.notes ? `<p><b>Sur l’eau :</b> ${esc(ans.notes)}</p>` : ''}</section>
<section><h2>5 · Les écarts</h2><div class="tbl"><table class="wide"><tr><th>Bord</th><th>Route conseillée</th><th>Votre route</th><th>Temps réel / conseil</th><th>Lecture</th></tr>${gapRows}</table></div></section>
<section><h2>6 · À retenir</h2><ul class="list">${(nar.retenir || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
<p class="note">Rapport généré par Rade Tactique${nar.ai ? ', rédaction assistée' : ''} le ${new Date().toLocaleDateString('fr-FR')}.</p>
</div></body></html>`;
  return html;
}

export async function shareReport(html, name) {
  const file = new File([html], `${name.replace(/[^\w\- ]+/g, '_')}.html`, { type: 'text/html' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return true; } catch { /* annulé */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return false;
}
