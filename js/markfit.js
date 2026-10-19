// Position d’une bouée d’après un arrondi de la trace (JUST-02, D-02 amendé le 19/10) : la trace propose, l’équipier valide.
// Méthode verrouillée : sommet du virage + R0 (14 m) vers l’intérieur ; jusqu’à MAX_CANDS virages candidats, précision annoncée ±ACCURACY_M.
// Le passage au plus près n’est que de l’information (near) : sans virage net, aucune proposition (la saisie reste possible).
// Module pur, sans état ni accès à MARKS : js/debrief.js et sa référence SNPM n’en dépendent pas (Pitfall 9).
// P : points lissés { t (ms), x, y (m), hd (cap lissé ~8 s) } = analyzeTrack(...).P, triés par le temps.

export const R0 = 14, MIN_TURN_DEG = 25, IN_WIN = [45000, 75000], MAX_FROM_M0 = 300;
export const SEARCH_M = 600, MAX_CANDS = 3, ACCURACY_M = 20;
const TURN_SPAN_MS = 45000, TURN_GAP_MS = 60000, DUP_MS = 30000;

const rad = Math.PI / 180, n360 = (a) => ((a % 360) + 360) % 360, n180 = (a) => n360(a + 180) - 180;
const circMean = (A) => { let s = 0, c = 0; for (const a of A) { s += Math.sin(a * rad); c += Math.cos(a * rad); } return n360(Math.atan2(s, c) / rad); };

// Point de la trace au plus près de M0 autour de l’instant tp (± win)
export function closestApproach(P, M0, tp, win = 120000) {
  let b = null;
  for (const p of P) { if (Math.abs(p.t - tp) > win) continue; const d = Math.hypot(p.x - M0.x, p.y - M0.y); if (!b || d < b.d) b = { d, p }; }
  return b && { x: b.p.x, y: b.p.y, d: b.d, t: b.p.t };
}

// Instant qui sépare au mieux le cap d’entrée (−75…−45 s) du cap de sortie (+45…+75 s) : somme des carrés des écarts avant / après
export function turnApex(P, tp) {
  const sel = (a, b) => P.filter((p) => p.t >= tp + a && p.t <= tp + b);
  const A = sel(-IN_WIN[1], -IN_WIN[0]).map((p) => p.hd), B = sel(IN_WIN[0], IN_WIN[1]).map((p) => p.hd);
  if (A.length < 5 || B.length < 5) return null;
  const h1 = circMean(A), h2 = circMean(B), D = n180(h2 - h1), W = sel(-IN_WIN[1], IN_WIN[1]);
  let pre = 0, post = W.reduce((s, p) => s + n180(p.hd - h2) ** 2, 0), best = { c: Infinity, i: 0 };
  for (let i = 0; i < W.length; i++) { if (pre + post < best.c) best = { c: pre + post, i }; pre += n180(W[i].hd - h1) ** 2; post -= n180(W[i].hd - h2) ** 2; }
  return { p: W[best.i], h1, h2, D };
}

// side : 't' (bouée laissée à tribord, virage à droite) | 'b' (bâbord). M0 : point de référence du virage (≤ MAX_FROM_M0 du sommet).
export function proposeMark(P, M0, side, tp, r0 = R0) {
  const near = closestApproach(P, M0, tp); if (!near) return null;
  let tq = tp, a = null;
  for (let i = 0; i < 3; i++) { a = turnApex(P, tq); if (!a) break; tq = a.p.t; }          // 3 passes : se recentre sur le virage
  if (!a || (side !== 't' && side !== 'b') || Math.abs(a.D) < MIN_TURN_DEG || Math.hypot(a.p.x - M0.x, a.p.y - M0.y) > MAX_FROM_M0)
    return { method: 'plus-pres', x: near.x, y: near.y, near, turn: a ? { D: a.D } : null };      // pas de virage net : jamais proposé à la validation
  const h = (a.h1 + a.D / 2 + (side === 't' ? 90 : -90)) * rad;                                  // vers l’intérieur du virage
  return { method: 'sommet', x: a.p.x + r0 * Math.sin(h), y: a.p.y + r0 * Math.cos(h), near, turn: { D: a.D, h1: a.h1, h2: a.h2, t: a.p.t } };
}

// Virages nets de la trace : variation du cap lissé d’au moins MIN_TURN_DEG entre −45 s et +45 s, un seul centre par virage
// (milieu du plateau de variation maximale), centres séparés d’au moins 60 s. Un passage sur P (deux curseurs) : linéaire.
function turnCenters(P) {
  const n = P.length, D = new Float64Array(n);
  for (let i = 0, a = 0, b = 0; i < n; i++) {
    while (a < n && P[a].t < P[i].t - TURN_SPAN_MS) a++;
    while (b < n - 1 && P[b + 1].t <= P[i].t + TURN_SPAN_MS) b++;
    if (a >= n || P[i].t - P[a].t < TURN_SPAN_MS * 0.6 || P[b].t - P[i].t < TURN_SPAN_MS * 0.6) continue;   // début et fin de trace : pas de cap de part et d’autre
    D[i] = n180(P[b].hd - P[a].hd);
  }
  const out = [];
  for (let i = 0; i < n;) {
    if (Math.abs(D[i]) < MIN_TURN_DEG) { i++; continue; }
    const sg = Math.sign(D[i]); let j = i, mx = 0;
    while (j < n && Math.sign(D[j]) === sg && Math.abs(D[j]) >= MIN_TURN_DEG) { mx = Math.max(mx, Math.abs(D[j])); j++; }
    let s = 0, k = 0; for (let m = i; m < j; m++) if (Math.abs(D[m]) >= mx * 0.9) { s += P[m].t; k++; }
    const tm = s / k; let c = i; for (let m = i; m < j; m++) if (Math.abs(P[m].t - tm) < Math.abs(P[c].t - tm)) c = m;
    out.push({ i: c, D: D[c], mx });
    i = j;
  }
  // deux centres à moins de 60 s : on garde le plus net
  return out.reduce((acc, c) => {
    const last = acc[acc.length - 1];
    if (last && P[c.i].t - P[last.i].t < TURN_GAP_MS) { if (c.mx > last.mx) acc[acc.length - 1] = c; } else acc.push(c);
    return acc;
  }, []);
}

// Jusqu’à MAX_CANDS propositions { x, y, method: 'sommet', d0, near, turn: { D, t, … } } pour une bouée supposée en M0 : virages nets de la trace
// à moins de SEARCH_M de M0 (et dans [t0, t1]), classés par distance de la proposition à M0 (Pitfall 12 : l’équipier choisit).
// d0 = distance entre la proposition et M0 ; near = passage au plus près de M0 autour du virage, POUR INFORMATION.
// Les propositions de repli « plus-pres » ne sont jamais renvoyées (D-02 amendé : sans virage net, rien à valider).
export function candidates(P, M0, { t0 = -Infinity, t1 = Infinity } = {}) {
  if (!P?.length || !M0) return [];
  const out = [];
  for (const c of turnCenters(P)) {
    const p = P[c.i];
    if (p.t < t0 || p.t > t1 || Math.hypot(p.x - M0.x, p.y - M0.y) > SEARCH_M) continue;
    const r = proposeMark(P, p, c.D > 0 ? 't' : 'b', p.t);
    if (!r || r.method !== 'sommet') continue;
    const d0 = Math.hypot(r.x - M0.x, r.y - M0.y);
    if (d0 > SEARCH_M || out.some((o) => Math.abs(o.turn.t - r.turn.t) < DUP_MS)) continue;     // deux centres voisins ont convergé sur le même virage
    out.push({ x: r.x, y: r.y, method: 'sommet', d0, near: closestApproach(P, M0, r.turn.t), turn: r.turn });
  }
  return out.sort((a, b) => a.d0 - b.d0).slice(0, MAX_CANDS);
}
