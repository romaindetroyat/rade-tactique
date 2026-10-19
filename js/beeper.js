// Bips du chrono de départ posés à l’avance sur l’horloge audio (AudioContext), jamais depuis le fil principal.
// Module pur : aucun DOM, aucun AudioContext global ; le contexte et la fonction de lecture sont injectés (tests sous Node).
// Les jalons se calculent depuis timer.end (Date) ; l’ancrage Date ↔ horloge audio est recalculé à chaque tick, si bien
// qu’un fil principal bloqué ou un contexte suspendu (écran verrouillé, appel) ne décale ni ne fusionne aucun bip.

export const LOOKAHEAD_S = 8;      // fenêtre posée à l’avance : un blocage du fil principal plus court ne fait manquer aucun bip
export const TICK_MS = 250;        // remplissage de la fenêtre (setInterval : sa précision n’a aucune importance)
// Un bip posé dont l’instant dévie de plus de 12 ms (suspension, dérive, saut de l’horloge audio) est annulé puis reposé à chaque tick.
// Mesuré dans Chromium : l’horloge audio dérive de ~1,5 ms par seconde sur l’heure murale ; avec une tolérance de 30 ms et 8 s d’avance,
// un bip pouvait sonner à 31-34 ms de l’heure (seuil de la mesure : 30 ms). À 12 ms l’écart au son reste sous ~15 ms.
const DRIFT_S = 0.012;
const GRACE_MS = 400;              // aucun bip rejoué avec plus de 400 ms de retard

// Jalons (instants Date en ms) d’un compte à rebours qui finit à endMs. kind : 'min' | 'dix' | 'sec' | 'go'
export function milestones(endMs, fromMs = -Infinity) {
  const out = [];
  for (let s = Math.floor((endMs - Math.max(fromMs, endMs - 3600e3)) / 1000); s >= 1; s--) {
    const kind = s % 60 === 0 ? 'min' : s <= 60 && s % 10 === 0 ? 'dix' : s <= 10 ? 'sec' : null;
    if (kind) out.push({ at: endMs - s * 1000, s, kind });
  }
  out.push({ at: endMs, s: 0, kind: 'go' });
  return out.filter((m) => m.at >= fromMs);
}

// Jalons doublés d’un flash plein écran : les minutes et le signal (au plus un par minute)
export const KEY = (m) => m.kind === 'min' || m.kind === 'go';
// Hz, secondes : mêmes bips que l’ancien tickTimer (660 Hz 0,5 s aux minutes, 880 Hz 0,12 s ensuite, 990 Hz 1 s au signal)
export const SOUND = { min: [660, 0.5], dix: [880, 0.12], sec: [880, 0.12], go: [990, 1.0] };
export const audioTime = (atMs, nowMs, ctxNow) => ctxNow + (atMs - nowMs) / 1000;

// WebKit 276016 : l’état peut rester « running » alors que l’horloge audio est arrêtée.
// prev / cur : { wall (ms), ct (s) }. true / false, ou null si moins d’une seconde de recul.
export function audioAlive(prev, cur) {
  const dw = (cur.wall - prev.wall) / 1000;
  return dw < 1 ? null : (cur.ct - prev.ct) > 0.5 * dw;
}

export function createBeeper({ ctx, now = Date.now, play, onMiss = () => {} }) {
  let end = null, done = new Set(), live = [], scanned = 0;
  const tone = play || ((f, d, when) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.4, when + 0.005); g.gain.exponentialRampToValueAtTime(0.001, when + d);
    o.start(when); o.stop(when + d + 0.02);
    return o;
  });
  const cancel = (l) => { try { l.node?.stop(0); } catch { /* déjà arrêté */ } };

  function tick() {
    if (end == null || ctx.state !== 'running') return false;
    const t = now(), c = ctx.currentTime;
    live = live.filter((l) => {                                         // bips posés mais décalés (suspension, dérive) : annulés, reposés plus bas
      if (l.when <= c) return false;                                    // déjà sonné : on ne touche plus
      if (Math.abs(audioTime(l.m.at, t, c) - l.when) <= DRIFT_S) return true;
      cancel(l); done.delete(l.m.at); return false;
    });
    for (const m of milestones(end, scanned)) {                         // jalons passés sans avoir été posés : signalés une fois, jamais rejoués
      if (m.at >= t - GRACE_MS) break;
      if (done.has(m.at)) continue;
      done.add(m.at);
      try { onMiss(m); } catch { /* le rapport ne doit jamais gêner les bips */ }
    }
    scanned = Math.max(scanned, t - GRACE_MS);
    for (const m of milestones(end, t - GRACE_MS)) {
      if (m.at > t + LOOKAHEAD_S * 1000) break;
      if (done.has(m.at)) continue;
      done.add(m.at);
      const when = audioTime(m.at, t, c), [f, d] = SOUND[m.kind];
      live.push({ m, node: tone(f, d, Math.max(when, c), m), when });
    }
    return true;
  }
  function disarm() { for (const l of live) cancel(l); live = []; done = new Set(); end = null; }
  function arm(endMs) { disarm(); end = endMs; scanned = now() - GRACE_MS; return tick(); }
  return { arm, disarm, tick, get end() { return end; } };
}
