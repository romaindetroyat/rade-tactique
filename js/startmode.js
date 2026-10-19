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
      // temps pour la ligne en lançant maintenant au près : relance du J80 (≈ 0,25 m/s²) depuis la vitesse actuelle
      if (best > 0.05) {
        const V = bsp * best, v0 = Math.min(V, Math.max(0, (q.sog ?? 0) * 0.5144 * best)), a = 0.25 * best;
        const da = (V * V - v0 * v0) / (2 * a);
        out.ttlLaunch = out.d <= da ? (-v0 + Math.sqrt(v0 * v0 + 2 * a * out.d)) / a : (V - v0) / a + (out.d - da) / V;
      }
    }
    // après le départ : marque suivante et bascules par rapport au vent de référence
    const fm = api.firstMark?.();
    if (fm) { out.mk = { d: distXY(b, fm), brg: bearingXY(b, fm), name: fm.name }; }
    if (w && q.cog != null && q.sog > 1.5) {
      const twa = norm180(q.cog - w.dir), up = optimalAngles(Math.max(2, w.spd)).up.twa;
      if (Math.abs(twa) < 70) {
        const stb = twa < 0, expected = stb ? w.dir - up : w.dir + up, delta = norm180(q.cog - expected);
        out.shift = stb ? delta : -delta; // > 0 : adonne
      }
    }
    const rem = api.timer.end ? (api.timer.end - Date.now()) / 1000 : null;
    out.rem = rem;
    const ttlB = out.ttlLaunch ?? out.ttl;
    if (rem != null && rem > 0 && ttlB != null) out.burn = rem - ttlB;
    return out;
  }

  // ───────── affichage : un seul écran, trois chiffres géants, gros boutons en bas
  function open() {
    api.audioInit(); api.startGps();
    if (!root) build();
    root.hidden = false; document.body.classList.add('startmode-open');
    try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); } catch { /* plein écran non disponible (iPhone : installer l’app sur l’écran d’accueil) */ }
    try { navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {}); } catch { /* sans verrou d’écran */ }
    loop();
  }
  function close() {
    if (root) root.hidden = true; document.body.classList.remove('startmode-open');
    cancelAnimationFrame(raf); raf = null;
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* déjà sorti */ }
    try { lock?.release(); } catch { /* déjà libéré */ } lock = null;
    stopCompass();
  }
  function build() {
    root = document.createElement('div'); root.id = 'startMode'; root.hidden = true;
    root.innerHTML = `
      <div class="sm-top">
        <button class="sm-x" data-a="close" aria-label="Fermer le mode départ">✕</button>
        <div class="sm-views"><button data-a="vnum" class="on">Chiffres</button><button data-a="vline">Ligne</button></div>
        <span class="sm-gps" id="smGps">GPS…</span>
        <button class="sm-lock" data-a="lock" id="smLock" aria-label="Verrouiller l’écran">🔓</button>
        <button class="sm-gear" data-a="gear" aria-label="Réglages">⚙</button>
      </div>
      <div class="sm-main">
        <div class="sm-clockbox" data-a="clock" data-lockhold="clock"><div class="sm-clock" id="smClock">5:00</div><div class="sm-phase" id="smPhase">Touchez DÉPART 5’ au signal</div></div>
        <div class="sm-fav" id="smFav"><span class="l"></span><b></b><span class="r"></span></div>
        <div class="sm-num" id="smNumView">
          <div class="sm-big" id="smDist"><span>Ligne</span><b>—</b><small></small></div>
          <div class="sm-big" id="smBurn"><span>À brûler</span><b>—</b><small></small></div>
          <div class="sm-row">
            <div class="sm-mini" id="smTtl"><span>Lancé, ligne en</span><b>—</b></div>
            <div class="sm-mini" id="smSog"><span>Vitesse</span><b>—</b></div>
            <div class="sm-mini" id="smCog"><span>Cap</span><b>—</b></div>
          </div>
        </div>
        <div class="sm-lineview" id="smLineView" hidden><canvas id="smCanvas" aria-label="Ligne de départ et position du bateau"></canvas><div class="sm-linemeta" id="smLineMeta"></div></div>
      </div>
      <div class="sm-bottom">
        <div class="sm-adj"><button data-a="m1">−1 min</button><button data-a="sync">Arrondir</button><button data-a="p1">+1 min</button></div>
        <div class="sm-acts">
          <button class="sm-ping" data-hold="ppin"><span class="fill"></span><b>BOUÉE</b><small>maintenir pour pinguer</small></button>
          <button class="sm-go" data-a="go" data-lockhold="go" id="smGo"><b>DÉPART 5’</b><small>au signal</small></button>
          <button class="sm-ping" data-hold="pcb"><span class="fill"></span><b>COMITÉ</b><small>maintenir pour pinguer</small></button>
        </div>
      </div>
      <div class="sm-undo" id="smUndo" hidden><span></span><button data-a="undo">Annuler</button></div>
      <div class="sm-sheet" id="smSheet" hidden>
        <div class="sm-sheet-card">
          <div class="sm-sheet-hd"><b>Réglages du départ</b><button data-a="gear" aria-label="Fermer">✕</button></div>
          <div class="sm-sheet-sec"><span>Vent sur la ligne</span><b id="smWind">—</b>
            <div class="sm-grid2"><button data-a="cs">Près tribord<small>en route au près</small></button><button data-a="cp">Près bâbord<small>en route au près</small></button></div>
            <div class="sm-grid3"><button data-a="wm">−5°</button><button data-a="cmp">Compas<small>bout au vent</small></button><button data-a="wp">+5°</button></div>
            <small class="sm-hint">Le plus fiable : un bord de près de chaque côté, en touchant « Près tribord » puis « Près bâbord ». Compas : bateau bout au vent, téléphone pointé vers l’étrave, touchez deux fois.</small></div>
          <div class="sm-sheet-sec"><span>Chrono</span><div class="sm-grid3"><button data-a="t5">5 min</button><button data-a="t4">4 min</button><button data-a="t1">1 min</button></div><button data-a="stop" class="sm-wide">Arrêter le chrono</button></div>
          <div class="sm-sheet-sec"><span>Bateau et affichage</span>
            <div class="sm-stepper"><span>GPS → étrave</span><button data-a="bm">−</button><b id="smBowV">5 m</b><button data-a="bp">+</button></div>
            <div class="sm-grid2"><button data-a="voice" id="smVoice">Voix</button><button data-a="sun" id="smSun">Plein soleil</button></div>
            <div class="sm-grid2"><button data-a="bips" id="smBips">Bips</button><button data-a="help" id="smHelpBtn">Aide</button></div>
            <button data-a="rules" class="sm-wide">Règles du départ (P, I, U, Z, noir)</button>
            <small class="sm-hint" id="smPinged"></small></div>
        </div>
      </div>`;
    document.body.appendChild(root);
    if (api.S.startSun) root.classList.add('sun');
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (locked && a !== 'lock') return; // écran verrouillé : seuls les appuis maintenus agissent
      if (locked && a === 'lock') return;  // déverrouillage par appui maintenu
      act(a);
    });
    // écran verrouillé : synchro et déverrouillage par appui maintenu (0,6 s)
    root.querySelectorAll('[data-lockhold], #smLock').forEach((b) => {
      let tm = null;
      b.addEventListener('pointerdown', (e) => {
        if (!locked) return;
        try { b.setPointerCapture(e.pointerId); } catch { /* sans capture */ }
        b.classList.add('holding');
        tm = setTimeout(() => { b.classList.remove('holding'); tm = null; if (b.id === 'smLock') { locked = false; root.classList.remove('locked'); updateToggles(); api.beep(900, 0.08); } else act(b.dataset.lockhold); }, 600);
      });
      ['pointerup', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { if (tm) { clearTimeout(tm); tm = null; b.classList.remove('holding'); } }));
    });
    // ping par appui maintenu (0,7 s) : évite les fausses manœuvres avec des doigts mouillés
    root.querySelectorAll('[data-hold]').forEach((b) => {
      let tm = null;
      // le doigt reste « attaché » au bouton pendant l'appui : un léger glissement ne l'annule pas
      const startHold = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* capture indisponible */ } b.classList.add('holding'); tm = setTimeout(() => { b.classList.remove('holding'); tm = null; ping(b.dataset.hold === 'pcb' ? 'cb' : 'pin'); }, 700); };
      const cancel = () => { if (tm) { clearTimeout(tm); tm = null; b.classList.remove('holding'); } };
      b.addEventListener('pointerdown', startHold); ['pointerup', 'pointercancel'].forEach((ev) => b.addEventListener(ev, cancel));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    updateToggles();
  }
  let view = 'num', locked = false;
  function setT(sec) { api.audioInit(); api.timer.end = Date.now() + sec * 1000; api.startTimer(); st.crossed = null; st.ocs = false; lastSaid = null; }
  function act(a) {
    const T = api.timer, $ = (s) => root.querySelector(s);
    if (a === 'close') return close();
    if (a === 'lock') { locked = true; root.classList.add('locked'); $('#smSheet').hidden = true; updateToggles(); api.toast?.('Écran verrouillé : maintenir 🔒 pour déverrouiller'); return; }
    if (a === 'clock') { if (T.end && T.end > Date.now() - 600000) { const r = (T.end - Date.now()) / 1000; T.end = Date.now() + Math.round(r / 60) * 60000; api.beep(1000, 0.1); } return; }
    if (a === 'bips') { api.S.startBips = !(api.S.startBips ?? true); api.persist(); updateToggles(); return; }
    if (a === 'help') { $('#smSheet').hidden = true; return api.help?.(); }
    if (a === 'rules') { $('#smSheet').hidden = true; return window.open('regles.html#depart', '_blank', 'noopener'); }
    if (a === 'go') { if (!T.end || T.end < Date.now() - 600000) setT(300); else { const r = (T.end - Date.now()) / 1000; T.end = Date.now() + Math.round(r / 60) * 60000; api.beep(1000, 0.1); } }
    else if (a === 't5' || a === 't4' || a === 't1') { setT(a === 't5' ? 300 : a === 't4' ? 240 : 60); $('#smSheet').hidden = true; }
    else if (a === 'sync' && T.end) { const r = (T.end - Date.now()) / 1000; T.end = Date.now() + Math.round(r / 60) * 60000; api.beep(1000, 0.1); }
    else if (a === 'm1' && T.end) T.end -= 60000; else if (a === 'p1' && T.end) T.end += 60000;
    else if (a === 'stop') { T.end = null; $('#smSheet').hidden = true; }
    else if (a === 'vnum' || a === 'vline') { view = a === 'vnum' ? 'num' : 'line'; $('#smNumView').hidden = view !== 'num'; $('#smLineView').hidden = view !== 'line'; root.querySelectorAll('.sm-views button').forEach((b) => b.classList.toggle('on', b.dataset.a === a)); }
    else if (a === 'gear') $('#smSheet').hidden = !$('#smSheet').hidden;
    else if (a === 'wm' || a === 'wp') { const w = wind(); if (w) setWind(norm360(w.dir + (a === 'wp' ? 5 : -5)), 'ajusté'); }
    else if (a === 'cs' || a === 'cp') tackHeading(a === 'cs' ? 'stb' : 'port');
    else if (a === 'cmp') compassWind();
    else if (a === 'bm' || a === 'bp') { api.S.bowOffset = Math.max(0, Math.min(12, (api.S.bowOffset ?? 5) + (a === 'bp' ? 0.5 : -0.5))); api.persist(); }
    else if (a === 'voice') { api.S.startVoice = !(api.S.startVoice ?? true); api.persist(); }
    else if (a === 'sun') { api.S.startSun = !api.S.startSun; api.persist(); root.classList.toggle('sun', !!api.S.startSun); }
    else if (a === 'undo' && undo) { api.S.lineOverride = undo.prev; api.persist(); api.reanalyse?.(); undo = null; $('#smUndo').hidden = true; api.toast('Ping annulé'); }
    updateToggles();
  }
  function updateToggles() {
    if (!root) return;
    root.querySelector('#smVoice').textContent = (api.S.startVoice ?? true) ? '🔊 Voix activée' : '🔇 Voix coupée';
    root.querySelector('#smSun').textContent = api.S.startSun ? '☀ Plein soleil' : '🌙 Écran sombre';
    root.querySelector('#smBips').textContent = (api.S.startBips ?? true) ? '📶 Bips à brûler' : '🔕 Sans bips';
    root.querySelector('#smLock').textContent = locked ? '🔒' : '🔓';
    root.querySelector('#smBowV').textContent = `${String(api.S.bowOffset ?? 5).replace('.', ',')} m`;
  }
  function setWind(dir, src) { api.S.startWind = { dir: Math.round(norm360(dir)), spd: wind()?.spd, src, t: Date.now() }; api.persist(); }
  let undo = null, undoTm = null;
  function ping(which) {
    const g = api.gps(), q = g?.pos;
    const done = (p, acc) => {
      const ll = toLL(p.x, p.y);
      undo = { prev: api.S.lineOverride ? JSON.parse(JSON.stringify(api.S.lineOverride)) : null };
      api.setLineEnd(which, ll);
      const L = api.S.lineOverride; if (L) { L.pinged = { ...(L.pinged || {}), [which]: Date.now() }; api.persist(); }
      api.beep(1200, 0.15);
      const u = root.querySelector('#smUndo'); u.querySelector('span').textContent = `${which === 'cb' ? 'Comité' : 'Bouée'} pingué${which === 'cb' ? '' : 'e'} (± ${Math.round(acc ?? 5)} m)`; u.hidden = false;
      clearTimeout(undoTm); undoTm = setTimeout(() => { u.hidden = true; undo = null; }, 8000);
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
    const acc = g?.pos?.acc;
    $('#smGps').textContent = g?.pos ? `±${Math.round(acc ?? 0)} m` : g?.err ? 'GPS ✕' : 'GPS…';
    $('#smGps').className = 'sm-gps ' + (!g?.pos ? 'bad' : acc > 15 ? 'warn' : 'good');
    // chrono et bouton principal
    const r = m.rem, go = $('#smGo');
    if (r == null) { $('#smClock').textContent = '5:00'; $('#smPhase').textContent = 'Touchez DÉPART 5’ au signal'; go.innerHTML = '<b>DÉPART 5’</b><small>au signal</small>'; }
    else if (r > 0) {
      const s = Math.ceil(r);
      $('#smClock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      $('#smPhase').textContent = s > 240 ? 'Avertissement' : s > 60 ? 'Préparatoire' : 'Dernière minute';
      go.innerHTML = '<b>SYNCHRO</b><small>arrondir au signal</small>';
      speak(s);
    } else {
      const e = -r; $('#smClock').textContent = `+${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, '0')}`;
      $('#smPhase').textContent = st.crossed ? `Parti à +${st.crossed.dt.toFixed(0)} s, ${st.crossed.where}` : 'PARTEZ !';
      go.innerHTML = e < 600 ? '<b>SYNCHRO</b><small>arrondir</small>' : '<b>DÉPART 5’</b><small>nouvelle procédure</small>';
    }
    root.classList.toggle('sm-last', r != null && r > 0 && r <= 60);
    const race = r != null && r <= -15;
    root.classList.toggle('sm-race', race);
    root.classList.toggle('sm-gun', r != null && r <= 0 && r > -10);
    // distance à la ligne
    const big = (id, val, sub, cls) => { const t = $(id); t.querySelector('b').textContent = val; t.querySelector('small').textContent = sub ?? ''; t.className = 'sm-big ' + (cls || ''); };
    if (m.d != null) {
      const over = m.d < 0;
      big('#smDist', `${over ? '−' : ''}${Math.round(Math.abs(m.d))} m`, over ? 'AU-DESSUS !' : `bouée ${Math.round(m.dPin)} m\nComité ${Math.round(m.dCb)} m`, over ? 'bad' : m.d < 15 ? 'warn' : '');
      if (over && r != null && r > 0 && r < 60 && !st.ocs) { st.ocs = true; api.beep(300, 0.6); if (api.S.startVoice ?? true) api.say('Au-dessus de la ligne'); }
      if (!over) st.ocs = false;
      if (r != null && r <= 0 && !st.crossed && over && m.along > -0.3 && m.along < 1.3) {
        const where = m.along < 0.25 ? 'côté bouée' : m.along > 0.75 ? 'côté Comité' : 'au milieu de la ligne';
        st.crossed = { dt: -r, where }; api.beep(1500, 0.3);
      }
    } else big('#smDist', '—', m.L ? 'en attente du GPS' : 'pinguez Comité et bouée', '');
    if (m.burn != null) big('#smBurn', m.burn >= 0 ? fmtS(m.burn) : `−${fmtS(m.burn)}`, m.burn >= 0 ? (m.burn < 6 ? 'LANCEZ !' : 'à perdre avant de lancer') : 'EN RETARD', m.burn < 0 ? 'bad' : m.burn < 6 ? 'good' : '');
    else big('#smBurn', '—', r == null ? 'chrono arrêté' : r <= 0 ? 'départ donné' : m.away ? 'route opposée à la ligne' : 'en route vers la ligne', '');
    // en course (15 s après le signal) : marque suivante et bascules à la place de la ligne et du temps à brûler
    const lab = (id, t) => { $(id).querySelector('span').textContent = t; };
    if (race) {
      lab('#smDist', m.mk ? `Marque ${m.mk.name}` : 'Marque suivante');
      if (m.mk) big('#smDist', m.mk.d >= 1852 ? `${(m.mk.d / 1852).toFixed(1).replace('.', ',')} Nq` : `${Math.round(m.mk.d)} m`, `au ${fmtBrg(m.mk.brg)}`, '');
      lab('#smBurn', 'Bascule');
      if (m.shift != null) big('#smBurn', `${m.shift >= 0 ? '+' : '−'}${Math.abs(Math.round(m.shift))}°`, Math.abs(m.shift) < 4 ? 'dans l’axe' : m.shift > 0 ? 'ADONNE' : 'REFUSE', Math.abs(m.shift) < 4 ? '' : m.shift > 0 ? 'good' : 'bad');
      else big('#smBurn', '—', 'au près seulement', '');
    } else { lab('#smDist', 'Ligne'); lab('#smBurn', 'À brûler'); }
    // bips de plus en plus rapprochés quand le temps à brûler approche de zéro, puis « Lance ! »
    if ((api.S.startBips ?? true) && r != null && r > 0 && m.burn != null && !race) {
      const now = performance.now();
      if (m.burn > 5) st.launched = false;
      if (m.burn <= 1 && !st.launched) { st.launched = true; api.beep(1400, 0.5); if (api.S.startVoice ?? true) api.say('Lance !'); }
      else if (m.burn > 1 && m.burn <= 20 && now >= (st.nextClick ?? 0)) { api.beep(1600, 0.04); st.nextClick = now + Math.max(250, m.burn * 120); }
    }
    const mini = (id, v) => { $(id).querySelector('b').textContent = v; };
    mini('#smTtl', m.ttlLaunch != null ? fmtS(m.ttlLaunch) : m.ttl != null ? fmtS(m.ttl) : '—');
    mini('#smSog', m.q?.sog != null ? `${m.q.sog.toFixed(1).replace('.', ',')}` : '—');
    mini('#smCog', m.q?.cog != null ? fmtBrg(m.q.cog) : '—');
    // extrémité favorisée : bandeau du côté concerné (bouée à gauche, Comité à droite, comme vu au vent)
    const fav = $('#smFav');
    if (!m.L) { fav.className = 'sm-fav'; fav.querySelector('b').textContent = 'Ligne non pinguée'; fav.querySelector('.l').textContent = ''; fav.querySelector('.r').textContent = ''; }
    else if (!m.w) { fav.className = 'sm-fav'; fav.querySelector('b').textContent = 'Vent à relever (⚙)'; }
    else if (!m.fav) { fav.className = 'sm-fav even'; fav.querySelector('b').textContent = `Ligne équilibrée · ${Math.abs(m.bias).toFixed(0)}°`; fav.querySelector('.l').textContent = ''; fav.querySelector('.r').textContent = ''; }
    else {
      const txt = `${m.fav.toUpperCase()} +${Math.round(m.adv)} m`;
      fav.className = 'sm-fav ' + (m.fav === 'Bouée' ? 'pin' : 'cb');
      fav.querySelector('.l').textContent = m.fav === 'Bouée' ? '◀' : '';
      fav.querySelector('.r').textContent = m.fav === 'Comité' ? '▶' : '';
      fav.querySelector('b').textContent = `${txt} · ${Math.abs(m.bias).toFixed(0)}° · ${Math.round(m.advS)} s`;
    }
    $('#smWind').textContent = m.w ? `${fmtBrg(m.w.dir)} ${cardinal(m.w.dir)} · ${Math.round(m.w.spd)} nd · ${m.w.src}` : '—';
    const pg = m.L?.pinged || {};
    $('#smPinged').textContent = `${pg.cb ? 'Comité pingué ✓' : 'Comité : position théorique'} · ${pg.pin ? 'bouée pinguée ✓' : 'bouée : position théorique'}${m.L ? ` · ligne ${Math.round(m.L.len)} m au ${fmtBrg(m.L.brg)}` : ''}`;
    if (view === 'line') { $('#smLineMeta').textContent = m.L ? `Ligne ${Math.round(m.L.len)} m · ${pg.cb ? 'Comité ✓' : 'Comité théorique'} · ${pg.pin ? 'bouée ✓' : 'bouée théorique'}` : ''; draw(m); }
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
