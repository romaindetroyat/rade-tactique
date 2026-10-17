// Routage par isochrones d’un J80 entre deux points, dans le champ de vent local.
// Pénalités de manœuvre, évitement de la terre et de la zone interdite.

import { boatSpeed, optimalAngles } from './polar.js';
import { rad, norm360, norm180, bearingXY, distXY, pointInPolygon } from './geo.js';

const KN = 1852 / 3600; // m/s par nœud

export function route(from, to, field, opts = {}) {
  const { terrain, forbidden = [], tackLoss = 9, gybeLoss = 6, perf = 1 } = opts;
  const total = distXY(from, to);
  if (total < 20) return null;
  const mid = field.sample((from.x + to.x) / 2, (from.y + to.y) / 2);
  const est = Math.max(2, boatSpeed(Math.max(mid.spd, 2), 90) * 0.7) * KN;
  const dt = Math.min(90, Math.max(10, total / est / 45)); // ~45 pas
  const blocked = (x, y) => (terrain && terrain.isLand(x, y)) || forbidden.some((poly) => pointInPolygon({ x, y }, poly));
  let front = [{ x: from.x, y: from.y, t: 0, tack: 0, parent: null, man: 0 }];
  const brgTo = bearingXY(from, to);
  let best = null;
  for (let step = 0; step < 220 && !best; step++) {
    const cand = [];
    for (const p of front) {
      const w = field.sample(p.x, p.y);
      const tws = Math.max(0.5, w.spd);
      const { up, down } = optimalAngles(tws);
      const remain = distXY(p, to);
      const dirMark = bearingXY(p, to);
      // directions testées : éventail autour de la route + angles optimaux
      const heads = new Set();
      for (let a = -90; a <= 90; a += 6) heads.add(Math.round(norm360(dirMark + a)));
      for (const s of [-1, 1]) {
        heads.add(Math.round(norm360(w.dir + s * up.twa)));
        heads.add(Math.round(norm360(w.dir + 180 + s * (180 - down.twa))));
      }
      for (const hd of heads) {
        const twa = norm180(hd - w.dir);
        const bsp = boatSpeed(tws, twa) * perf;
        if (bsp < 0.2) continue;
        const tack = twa >= 0 ? 1 : -1; // 1 = bâbord amures, −1 = tribord amures
        let lost = 0, man = p.man;
        if (p.tack && tack !== p.tack) { lost = Math.abs(twa) < 90 ? tackLoss : gybeLoss; man++; }
        const dist = bsp * KN * Math.max(0, dt - lost);
        const nx = p.x + Math.sin(rad(hd)) * dist, ny = p.y + Math.cos(rad(hd)) * dist;
        // arrivée possible dans ce pas ?
        const proj = (to.x - p.x) * Math.sin(rad(hd)) + (to.y - p.y) * Math.cos(rad(hd));
        if (proj > 0 && proj <= dist + 1) {
          const off = Math.abs((to.x - p.x) * Math.cos(rad(hd)) - (to.y - p.y) * Math.sin(rad(hd)));
          if (off < Math.max(25, dist * 0.06)) {
            const tArr = p.t + lost + proj / (bsp * KN);
            if (!best || tArr < best.t) best = { x: to.x, y: to.y, t: tArr, tack, parent: p, man, hd, twa, bsp };
            continue;
          }
        }
        if (blocked(nx, ny) || blocked((p.x + nx) / 2, (p.y + ny) / 2)) continue;
        cand.push({ x: nx, y: ny, t: p.t + dt, tack, parent: p, man, hd, twa, bsp, rem: distXY({ x: nx, y: ny }, to) });
      }
      if (remain < 1) best = p;
    }
    if (best) break;
    if (!cand.length) break;
    // élagage : par secteur angulaire vu depuis l’arrivée, garder le plus proche de l’arrivée
    const bins = new Map();
    for (const c of cand) {
      const b = Math.round(norm180(bearingXY(to, c) - (brgTo + 180)) / 1.5);
      const cur = bins.get(b);
      if (!cur || c.rem < cur.rem) bins.set(b, c);
    }
    front = [...bins.values()];
    // garde-fou : ne pas trop s’écarter
    front = front.filter((c) => c.rem < total * 1.6 + 600);
  }
  if (!best) return null;
  const path = [];
  for (let p = best; p; p = p.parent) path.push(p);
  path.reverse();
  // statistiques : bords, côté de la route directe
  let stbd = 0, port = 0, right = 0, left = 0, maxOff = 0;
  const ux = Math.sin(rad(brgTo)), uy = Math.cos(rad(brgTo));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], d = b.t - a.t;
    if (b.tack > 0) stbd += d; else port += d;
    const side = (b.x - from.x) * uy - (b.y - from.y) * ux; // >0 = à droite de la route directe
    if (side > 0) right += d; else left += d;
    maxOff = Math.max(maxOff, Math.abs(side));
  }
  return {
    path, time: best.t, maneuvers: best.man,
    firstTack: path[1]?.tack, firstHeading: path[1]?.hd, firstTwa: path[1]?.twa,
    stbdShare: stbd / (stbd + port || 1), rightShare: right / (right + left || 1), maxOff,
  };
}

// Convention : twa = cap − direction du vent (en ±180°).
// twa > 0 : le vent vient de la gauche du bateau → BÂBORD amures ; twa < 0 → TRIBORD amures.
export const tackName = (tack) => (tack > 0 ? 'bâbord amures' : 'tribord amures');

