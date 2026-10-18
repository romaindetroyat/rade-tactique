// Mode départ plein écran : ping Comité et bouée, distance de l'étrave à la ligne, temps pour la ligne,
// temps à brûler, extrémité favorisée, chrono 5-4-1-0 avec bips et annonces vocales, détection du départ.
// Convention (IC) : le Comité est à l'extrémité tribord de la ligne en regardant au vent,
// donc le côté parcours est à gauche du vecteur bouée → Comité.

import { toXY, toLL, bearingXY, distXY, fromBearing, norm180, norm360, fmtBrg, cardinal } from './geo.js';
import { boatSpeed, optimalAngles } from './polar.js';

const J80 = 8; // longueur de coque (m), pour exprimer les écarts en longueurs
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtS = (s) => { const a = Math.abs(Math.round(s)); return a >= 60 ? `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}` : `${a} s`; };

export function createStartMode(api) {
  // api : { S, persist, line(), windAt(p), timer, beep, audioInit, startGps, gps(), say, setLineEnd, toast }
  let root = null, lock = null, raf = null, compass = null, compassOn = false, lastSaid = null;
  const st = { crossed: null, ocs: false };

  const line = () => {
    const L = api.line(); if (!L) return null;
    const pin = toXY(L.pin.lat, L.pin.lon), cb = toXY(L.cb.lat, L.cb.lon);
    const brg = bearingXY(pin, cb), len = distXY(pin, cb);
    return { pin, cb, brg, len, up: norm360(brg - 90), pinged: L.pinged };
  };
  const wind = () => {
    const sw = api.S.startWind;
    const Ln = line(), c = Ln ? { x: (Ln.pin.x + Ln.cb.x) / 2, y: (Ln.pin.y + Ln.cb.y) / 2 } : null;
    const w = c ? api.windAt(c) : null;
    if (sw && Date.now() - sw.t < 3 * 3600e3) return { dir: sw.dir, spd: sw.spd ?? w?.spd ?? 8, src: sw.src };
    return w ? { dir: w.dir, spd: w.spd, src: w.src || 'modèle' } : null;
  };
  // position de l'étrave : antenne GPS + décalage vers l'avant selon la route fond
  const bow = (q) => {
    if (!q) return null;
    const off = api.S.bowOffset ?? 5;
    return q.sog > 1 && q.cog != null ? fromBearing(q, q.cog, off) : { x: q.x, y: q.y };
  };

  function metrics() {
    const L = line(), q = api.gps()?.pos, w = wind();
    const out = { L, q, w };
    if (!L) return out;
    if (w) {
      out.bias = norm180(w.dir - L.up); // > 0 : vent tourné à droite → Comité favorisé
      out.adv = L.len * Math.sin(Math.abs(out.bias) * Math.PI / 180);
      out.fav = Math.abs(out.bias) < 2 ? null : out.bias > 0 ? 'Comité' : 'Bouée';
      const up = optimalAngles(Math.max(2, w.spd)).up;
      out.vmg = up.vmg;
      out.advS = out.adv / Math.max(0.5, up.vmg * 0.5144);
    }
    if (!q) return out;
    const b = bow(q); out.b = b;
    const ux = Math.sin(L.up * Math.PI / 180), uy = Math.cos(L.up * Math.PI / 180);
    // distance signée : > 0 côté pré-départ (sous la ligne), < 0 au-dessus
    out.d = -((b.x - L.pin.x) * ux + (b.y - L.pin.y) * uy);
    const t = ((b.x - L.pin.x) * (L.cb.x - L.pin.x) + (b.y - L.pin.y) * (L.cb.y - L.pin.y)) / (L.len * L.len);
    out.along = t; // 0 = bouée, 1 = Comité
    out.dPin = distXY(b, L.pin); out.dCb = distXY(b, L.cb);
    // temps pour la ligne à la route et à la vitesse actuelles
    if (q.sog > 0.5 && q.cog != null) {
      const vn = q.sog * 0.5144 * Math.cos((q.cog - L.up) * Math.PI / 180);
      out.ttl = vn > 0.05 && out.d > 0 ? out.d / vn : null;
      out.away = vn <= 0.05;
    }
    // au près à pleine vitesse, en route vers la ligne
    if (w && out.d > 0) {
      const up = optimalAngles(Math.max(2, w.spd)).up, bsp = boatSpeed(w.spd, up.twa) * 0.5144;
      const best = Math.max(...[-1, 1].map((s) => Math.cos(((w.dir + s * up.twa) - L.up) * Math.PI / 180)));
      out.ttlFull = best > 0.05 ? out.d / (bsp * best) : null;
    }
    const rem = api.timer.end ? (api.timer.end - Date.now()) / 1000 : null;
    out.rem = rem;
    if (rem != null && rem > 0 && out.ttl != null) out.burn = rem - out.ttl;
    return out;
  }

  // ───────── affichage
  function open() {
    api.audioInit(); api.startGps();
    if (!root) build();
    root.hidden = false; document.body.classList.add('startmode-open');
    try { navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {}); } catch { /* sans verrou d’écran */ }
    loop();
  }
  function close() {
    if (root) root.hidden = true; document.body.classList.remove('startmode-open');
    cancelAnimationFrame(raf); raf = null;
    try { lock?.release(); } catch { /* déjà libéré */ } lock = null;
    stopCompass();
  }
  function build() {
    root = document.createElement('div'); root.id = 'startMode'; root.hidden = true;
    root.innerHTML = `
      <div class="sm-top"><button class="sm-x" data-a="close" aria-label="Fermer">✕</button><b>Mode départ</b><button class="sm-chip" data-a="voice" id="smVoice"></button><span class="sm-gps" id="smGps">GPS…</span></div>
      <div class="sm-clockrow"><div class="sm-clock" id="smClock">5:00</div><div class="sm-phase" id="smPhase">Lancez le chrono au signal</div></div>
      <div class="sm-tbtns"><button data-a="t5">Top 5’</button><button data-a="t4">Top 4’</button><button data-a="t1">Top 1’</button><button data-a="sync">Arrondir</button><button data-a="m1">−1’</button><button data-a="p1">+1’</button></div>
      <div class="sm-tiles">
        <div class="sm-tile" id="smDist"><span>Distance à la ligne</span><b>—</b><small>étrave</small></div>
        <div class="sm-tile" id="smBurn"><span>À brûler</span><b>—</b><small>chrono − temps pour la ligne</small></div>
        <div class="sm-tile" id="smTtl"><span>Temps pour la ligne</span><b>—</b><small>route et vitesse actuelles</small></div>
        <div class="sm-tile" id="smSog"><span>Vitesse · cap</span><b>—</b><small>—</small></div>
      </div>
      <canvas id="smCanvas" aria-label="Ligne de départ et position du bateau"></canvas>
      <div class="sm-bias" id="smBias">Pinguez le Comité et la bouée pour définir la ligne.</div>
      <div class="sm-wind"><span id="smWind">Vent : —</span>
        <div class="sm-wbtns"><button data-a="wm">−5°</button><button data-a="wp">+5°</button><button data-a="cs">Près tribord</button><button data-a="cp">Près bâbord</button><button data-a="cmp">Bout au vent (compas)</button></div>
        <small class="sm-hint" id="smWindHint">Pour le vent sur la ligne : faites un bord de près de chaque côté et touchez « Près tribord » puis « Près bâbord » en route, ou mettez-vous bout au vent avec le téléphone pointé vers l’étrave.</small></div>
      <div class="sm-pings"><button class="sm-ping" data-a="pcb">📍 Ping Comité</button><button class="sm-ping" data-a="ppin">📍 Ping bouée</button></div>
      <div class="sm-foot"><label>GPS → étrave <input type="number" id="smBow" min="0" max="12" step="0.5" inputmode="decimal"> m</label><span id="smPinged"></span></div>`;
    document.body.appendChild(root);
    root.querySelector('#smBow').value = api.S.bowOffset ?? 5;
    root.querySelector('#smBow').onchange = (e) => { api.S.bowOffset = Math.max(0, Math.min(12, +e.target.value || 0)); api.persist(); };
    root.addEventListener('click', (e) => { const a = e.target.closest('[data-a]')?.dataset.a; if (a) act(a); });
    updateVoice();
  }
  function setT(sec) { api.audioInit(); api.timer.end = Date.now() + sec * 1000; api.timer.beeps.clear(); api.startTimer(); st.crossed = null; st.ocs = false; lastSaid = null; }
  function act(a) {
    const T = api.timer;
    if (a === 'close') return close();
    if (a === 't5') setT(300); else if (a === 't4') setT(240); else if (a === 't1') setT(60);
    else if (a === 'sync' && T.end) { const r = (T.end - Date.now()) / 1000; T.end = Date.now() + Math.round(r / 60) * 60000; }
    else if (a === 'm1' && T.end) T.end -= 60000; else if (a === 'p1' && T.end) T.end += 60000;
    else if (a === 'pcb' || a === 'ppin') ping(a === 'pcb' ? 'cb' : 'pin');
    else if (a === 'wm' || a === 'wp') { const w = wind(); if (w) setWind(norm360(w.dir + (a === 'wp' ? 5 : -5)), 'ajusté'); }
    else if (a === 'cs' || a === 'cp') tackHeading(a === 'cs' ? 'stb' : 'port');
    else if (a === 'cmp') compassWind();
    else if (a === 'voice') { api.S.startVoice = !(api.S.startVoice ?? true); api.persist(); updateVoice(); }
  }
  function updateVoice() { const b = root?.querySelector('#smVoice'); if (b) b.textContent = (api.S.startVoice ?? true) ? '🔊 voix' : '🔇 voix'; }
  function setWind(dir, src) { api.S.startWind = { dir: Math.round(norm360(dir)), spd: wind()?.spd, src, t: Date.now() }; api.persist(); }

  function ping(which) {
    const g = api.gps(), q = g?.pos;
    const done = (p, acc) => {
      const ll = toLL(p.x, p.y);
      api.setLineEnd(which, ll);
      const L = api.S.lineOverride; if (L) { L.pinged = { ...(L.pinged || {}), [which]: Date.now() }; api.persist(); }
      api.toast(`${which === 'cb' ? 'Comité' : 'Bouée'} enregistré${which === 'cb' ? '' : 'e'} (± ${Math.round(acc ?? 5)} m)`);
      api.beep(1200, 0.15);
    };
    if (q && Date.now() - q.t < 4000) return done(bow(q), q.acc);
    if (!navigator.geolocation) return api.toast('GPS indisponible');
    navigator.geolocation.getCurrentPosition((p) => done(toXY(p.coords.latitude, p.coords.longitude), p.coords.accuracy), (e) => api.toast('GPS : ' + e.message), { enableHighAccuracy: true, timeout: 15000 });
  }
  // vent par les deux bords de près : bissectrice des routes fond tribord et bâbord
  function tackHeading(side) {
    const q = api.gps()?.pos;
    if (!q || q.cog == null || q.sog < 1.5) return api.toast('Il faut être en route au près (plus de 1,5 nd)');
    api.S.startTacks = { ...(api.S.startTacks || {}), [side]: { cog: q.cog, t: Date.now() } };
    const k = api.S.startTacks, s = k.stb, p = k.port;
    if (s && p && Math.abs(s.t - p.t) < 15 * 60e3) {
      const dir = norm360(p.cog + norm180(s.cog - p.cog) / 2); // bissectrice de l'angle de virement = vent
      setWind(dir, 'deux bords de près'); api.toast(`Vent relevé : ${fmtBrg(dir)} (angle de virement ${Math.round(Math.abs(norm180(s.cog - p.cog)))}°)`);
    } else api.toast(`Route ${side === 'stb' ? 'tribord' : 'bâbord'} enregistrée : ${fmtBrg(q.cog)}. Faites l’autre bord.`);
    api.persist();
  }
  async function compassWind() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return api.toast('Accès au compas refusé');
      }
    } catch { return api.toast('Compas indisponible'); }
    if (!compassOn) {
      compass = null; compassOn = true;
      window.addEventListener('deviceorientation', onOrient, true);
      api.toast('Pointez le téléphone vers l’étrave, bateau bout au vent, puis touchez à nouveau « Bout au vent »');
      return;
    }
    if (compass == null) { api.toast('Pas de cap compas reçu'); return stopCompass(); }
    setWind(compass, 'compas, bout au vent'); api.toast(`Vent relevé au compas : ${fmtBrg(compass)}`); stopCompass();
  }
  function onOrient(e) { const h = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? 360 - e.alpha : null); if (h != null) compass = norm360(h); }
  function stopCompass() { if (compassOn) window.removeEventListener('deviceorientation', onOrient, true); compassOn = false; }

  // ───────── boucle d'affichage
  function loop() { render(); raf = requestAnimationFrame(() => setTimeout(loop, 250)); }
  function render() {
    if (!root || root.hidden) return;
    const m = metrics(), $ = (s) => root.querySelector(s);
    const g = api.gps();
    $('#smGps').textContent = g?.pos ? `GPS ± ${Math.round(g.pos.acc ?? 0)} m` : g?.err ? 'GPS : ' + g.err : 'GPS…';
    // chrono
    const r = m.rem;
    if (r == null) { $('#smClock').textContent = '5:00'; $('#smPhase').textContent = 'Lancez le chrono au signal d’avertissement'; }
    else if (r > 0) {
      const s = Math.ceil(r);
      $('#smClock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      $('#smPhase').textContent = s > 240 ? 'Avertissement' : s > 60 ? 'Préparatoire' : 'Dernière minute';
      speak(s);
    } else {
      const e = -r; $('#smClock').textContent = `+${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, '0')}`;
      $('#smPhase').textContent = st.crossed ? `Parti à +${st.crossed.dt.toFixed(0)} s, ${st.crossed.where}` : 'PARTEZ !';
    }
    root.classList.toggle('sm-last', r != null && r > 0 && r <= 60);
    // tuiles
    const tile = (id, val, sub, cls) => { const t = $(id); t.querySelector('b').textContent = val; if (sub != null) t.querySelector('small').textContent = sub; t.className = 'sm-tile ' + (cls || ''); };
    if (m.d != null) {
      const over = m.d < 0;
      tile('#smDist', `${over ? '−' : ''}${Math.abs(m.d) < 100 ? Math.abs(m.d).toFixed(0) : Math.round(Math.abs(m.d))} m`, over ? 'AU-DESSUS DE LA LIGNE' : `bouée ${Math.round(m.dPin)} m · Comité ${Math.round(m.dCb)} m`, over ? 'bad' : m.d < 20 ? 'warn' : '');
      if (over && r != null && r > 0 && r < 60 && !st.ocs) { st.ocs = true; api.beep(300, 0.6); if (api.S.startVoice ?? true) api.say('Au-dessus de la ligne'); }
      if (!over) st.ocs = false;
      // départ franchi après le signal
      if (r != null && r <= 0 && !st.crossed && over && m.along > -0.3 && m.along < 1.3) {
        const where = m.along < 0.25 ? 'côté bouée' : m.along > 0.75 ? 'côté Comité' : 'au milieu de la ligne';
        st.crossed = { dt: -r, where }; api.beep(1500, 0.3);
      }
    } else tile('#smDist', '—', m.L ? 'en attente du GPS' : 'ligne non définie', '');
    if (m.ttl != null) tile('#smTtl', fmtS(m.ttl), m.ttlFull != null ? `au près plein pot : ${fmtS(m.ttlFull)}` : 'route et vitesse actuelles', '');
    else tile('#smTtl', m.away ? 's’éloigne' : '—', m.ttlFull != null ? `au près plein pot : ${fmtS(m.ttlFull)}` : 'route et vitesse actuelles', '');
    if (m.burn != null) tile('#smBurn', m.burn >= 0 ? fmtS(m.burn) : `retard ${fmtS(m.burn)}`, m.burn >= 0 ? 'temps à perdre avant de lancer' : 'vous arriverez après le signal', m.burn < 0 ? 'bad' : m.burn < 8 ? 'good' : '');
    else tile('#smBurn', '—', r == null ? 'lancez le chrono' : r <= 0 ? 'départ donné' : 'route vers la ligne nécessaire', '');
    const q = m.q;
    tile('#smSog', q?.sog != null ? `${q.sog.toFixed(1)} nd` : '—', q?.cog != null ? `cap fond ${fmtBrg(q.cog)}` : '—', '');
    // biais
    const bias = $('#smBias');
    if (!m.L) bias.innerHTML = 'Pinguez le Comité et la bouée pour définir la ligne.';
    else if (!m.w) bias.innerHTML = `Ligne ${Math.round(m.L.len)} m · ${fmtBrg(m.L.brg)} (bouée → Comité). Relevez le vent pour l’extrémité favorisée.`;
    else bias.innerHTML = m.fav
      ? `<b class="fav">${m.fav} favorisé${m.fav === 'Bouée' ? 'e' : ''}</b> de ${Math.abs(m.bias).toFixed(0)}° · <b>${Math.round(m.adv)} m</b> (${(m.adv / J80).toFixed(1).replace('.', ',')} longueurs, ≈ ${Math.round(m.advS)} s) · ligne ${Math.round(m.L.len)} m`
      : `<b class="fav">Ligne équilibrée</b> (biais ${Math.abs(m.bias).toFixed(0)}°) · ligne ${Math.round(m.L.len)} m`;
    $('#smWind').textContent = m.w ? `Vent ${fmtBrg(m.w.dir)} ${cardinal(m.w.dir)} · ${Math.round(m.w.spd)} nd · ${m.w.src}` : 'Vent : —';
    const pg = m.L?.pinged || {};
    $('#smPinged').textContent = `${pg.cb ? 'Comité pingué ✓' : 'Comité : position théorique'} · ${pg.pin ? 'bouée pinguée ✓' : 'bouée : position théorique'}`;
    draw(m);
  }
  function speak(s) {
    if (!(api.S.startVoice ?? true) || s === lastSaid) return;
    const say = { 240: '4 minutes', 180: '3 minutes', 120: '2 minutes', 60: '1 minute', 30: '30 secondes', 20: '20 secondes', 10: '10', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1' }[s];
    if (say) { lastSaid = s; api.say(say); }
  }
  function draw(m) {
    const cv = root.querySelector('#smCanvas'), dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const L = m.L; if (!L) return;
    // repère tourné : la ligne horizontale, le côté parcours en haut
    const mid = { x: (L.pin.x + L.cb.x) / 2, y: (L.pin.y + L.cb.y) / 2 };
    const ang = (L.brg - 90) * Math.PI / 180;
    const pts = [L.pin, L.cb]; if (m.b) pts.push(m.b);
    const rot = (p) => { const dx = p.x - mid.x, dy = p.y - mid.y; return { u: dx * Math.cos(ang) - dy * Math.sin(ang), v: dx * Math.sin(ang) + dy * Math.cos(ang) }; };
    const R = pts.map(rot);
    const span = Math.max(L.len * 1.3, ...R.map((r) => Math.abs(r.u) * 2.2), ...R.map((r) => Math.abs(r.v) * 3.6), 60);
    const k = Math.min(W, H * 1.6) / span, cx = W / 2, cy = H * 0.4;
    const P = (p) => { const r = rot(p); return [cx + r.u * k, cy - r.v * k]; };
    const css = (v) => getComputedStyle(root).getPropertyValue(v).trim();
    // côté parcours
    c.fillStyle = css('--sm-over'); c.fillRect(0, 0, W, cy);
    c.strokeStyle = css('--sm-line'); c.lineWidth = 3; c.setLineDash([10, 7]);
    const [ax, ay] = P(L.pin), [bx, by] = P(L.cb);
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
    const fav = m.fav;
    const end = (x, y, lab, on) => { c.fillStyle = on ? css('--sm-good') : css('--sm-fg'); c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.font = '600 14px system-ui'; c.textAlign = 'center'; c.fillText(lab, x, y + 28); };
    end(ax, ay, 'Bouée', fav === 'Bouée'); end(bx, by, 'Comité', fav === 'Comité');
    // vent
    if (m.w) {
      const a = (m.w.dir - (L.brg - 90)) * Math.PI / 180; // angle du vent dans le repère tourné (0 = vers le haut)
      const wx = W - 34, wy = 34;
      c.save(); c.translate(wx, wy); c.rotate(a + Math.PI); c.strokeStyle = css('--sm-fg'); c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -18); c.lineTo(0, 18); c.moveTo(-7, 9); c.lineTo(0, 18); c.lineTo(7, 9); c.stroke(); c.restore();
    }
    // bateau
    if (m.b) {
      const [x, y] = P(m.b);
      c.fillStyle = m.d < 0 ? css('--sm-bad') : css('--sm-acc'); c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill();
      const q = m.q; if (q?.cog != null && q.sog > 0.5) {
        const a = (q.cog - (L.brg - 90)) * Math.PI / 180, len = Math.min(120, q.sog * 0.5144 * 30 * k);
        c.strokeStyle = c.fillStyle; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); c.stroke();
      }
    }
  }
  return { open, close, isOpen: () => !!root && !root.hidden, render };
}
