// Routage par isochrones d’un J80 entre deux points, dans le champ de vent local.
// Pénalités de manœuvre, évitement de la terre et de la zone interdite.
// Courant de marée (D-13, Brest seulement) : options current, t0 et depth ; sans elles, le pas d’isochrone est celui de la v42, ligne
// pour ligne (D-01 : Toulon ne les passe jamais).

import { boatSpeed, optimalAngles } from './polar.js';
import { rad, deg, norm360, norm180, bearingXY, distXY, pointInPolygon } from './geo.js';

const KN = 1852 / 3600; // m/s par nœud
// sinus et cosinus des caps entiers testés (0 à 360°) : mêmes valeurs que Math.sin(rad(cap)), calculées une fois
const LOOK = 5;        // s : regard en avant de l’élagage avec courant
const SIN = Array.from({ length: 361 }, (_, h) => Math.sin(rad(h))), COS = Array.from({ length: 361 }, (_, h) => Math.cos(rad(h)));

// opts.current(x, y, ms) → { u, v } (m/s, vers l’est et vers le nord) ou null : courant au point et à l’instant (ms UTC) ;
// opts.t0 : instant du départ (ms UTC, p.t du routage en secondes) ; opts.depth(x, y, ms) → faux si la hauteur d’eau y manque (obstacle).
export function route(from, to, field, opts = {}) {
  const { terrain, forbidden = [], tackLoss = 9, gybeLoss = 6, perf = 1, current = null, t0 = 0, depth = null } = opts;
  const total = distXY(from, to);
  if (total < 20) return null;
  const mid = field.sample((from.x + to.x) / 2, (from.y + to.y) / 2);
  const est = Math.max(2, boatSpeed(Math.max(mid.spd, 2), 90) * 0.7) * KN;
  const dt = Math.min(90, Math.max(10, total / est / 45)); // ~45 pas
  // zone interdite : un point hors du rectangle d’une zone (1 m de marge en x) n’y est jamais, pointInPolygon rendrait faux ; il n’est pas testé
  const boxes = forbidden.map((poly) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of poly) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } return { poly, x0: x0 - 1, x1: x1 + 1, y0, y1 }; });
  const inZone = (x, y) => { for (const b of boxes) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y < b.y1 && pointInPolygon({ x, y }, b.poly)) return true; return false; };
  const blocked = (x, y) => (terrain && terrain.isLand(x, y)) || inZone(x, y);
  // ── branche avec courant (et hauteur d’eau) : appelée seulement quand l’option existe
  const water = current || depth ? (x, y, t) => !blocked(x, y) && (!depth || depth(x, y, t0 + t * 1000)) : null;
  const withCurrent = (p, w, cand) => {
    const c = (current && current(p.x, p.y, t0 + p.t * 1000)) || { u: 0, v: 0 };
    // vent sur l’eau = vent au sol − courant (vecteurs « vers », m/s) : il donne l’angle et la vitesse de la polaire
    const wu = -Math.sin(rad(w.dir)) * w.spd * KN - c.u, wv = -Math.cos(rad(w.dir)) * w.spd * KN - c.v;
    const tws = Math.max(0.5, Math.hypot(wu, wv) / KN), wdir = norm360(deg(Math.atan2(-wu, -wv)));
    const { up, down } = optimalAngles(tws);
    const dirMark = bearingXY(p, to);
    const heads = [];
    const add = (h) => { h = Math.round(norm360(h)) % 360; if (!heads.includes(h)) heads.push(h); };
    for (let a = -90; a <= 90; a += 6) add(dirMark + a);
    for (const s of [-1, 1]) { add(wdir + s * up.twa); add(wdir + 180 + s * (180 - down.twa)); }
    // cap qui compense la dérive pour faire route fond droit sur l’arrivée
    let hc = dirMark;
    for (let k = 0; k < 3; k++) {
      const b = boatSpeed(tws, norm180(hc - wdir)) * perf * KN;
      if (!(b > 0.1)) break;
      const cross = c.u * Math.cos(rad(dirMark)) - c.v * Math.sin(rad(dirMark));   // courant de travers (>0 : porte à droite de la route)
      if (Math.abs(cross) >= b) break;
      hc = dirMark - deg(Math.asin(cross / b));
    }
    add(hc);
    for (const hd of heads) {
      const sh = SIN[hd], ch = COS[hd];
      const twa = norm180(hd - wdir);
      const bsp = boatSpeed(tws, twa) * perf;
      if (bsp < 0.2) continue;
      const tack = twa >= 0 ? 1 : -1;
      let lost = 0, man = p.man;
      if (p.tack && tack !== p.tack) { lost = Math.abs(twa) < 90 ? tackLoss : gybeLoss; man++; }
      // vitesse fond = vitesse sur l’eau selon le cap + courant ; pendant la manœuvre, le seul courant déplace le bateau
      const gx = sh * bsp * KN + c.u, gy = ch * bsp * KN + c.v, G = Math.hypot(gx, gy);
      const run = Math.max(0, dt - lost), drift = dt - run;
      const nx = p.x + c.u * drift + gx * run, ny = p.y + c.v * drift + gy * run;
      // arrivée possible dans ce pas ? testée sur la direction fond, depuis le point où la manœuvre s’achève
      if (G > 0.05) {
        const qx = p.x + c.u * lost, qy = p.y + c.v * lost, ex = gx / G, ey = gy / G;
        const proj = (to.x - qx) * ex + (to.y - qy) * ey, dist = G * run;
        if (proj > 0 && proj <= dist + 1) {
          const off = Math.abs((to.x - qx) * ey - (to.y - qy) * ex);
          if (off < Math.max(25, dist * 0.06)) {
            const tArr = p.t + lost + proj / G;
            if (!best || tArr < best.t) best = { x: to.x, y: to.y, t: tArr, tack, parent: p, man, hd, twa, bsp, sog: G / KN };
            continue;
          }
        }
      }
      if (!water(nx, ny, p.t + dt) || !water((p.x + nx) / 2, (p.y + ny) / 2, p.t + dt / 2)) continue;
      const rem = Math.hypot(to.x - nx, to.y - ny);
      cand.push({ x: nx, y: ny, t: p.t + dt, tack, parent: p, man, hd, twa, bsp, sog: G / KN, rem, vm: rem > 0 ? ((to.x - nx) * gx + (to.y - ny) * gy) / rem : 0 });
    }
    if (distXY(p, to) < 1) best = p;
  };
  let front = [{ x: from.x, y: from.y, t: 0, tack: 0, parent: null, man: 0 }];
  const brgTo = bearingXY(from, to);
  let best = null;
  for (let step = 0; step < 220 && !best; step++) {
    const cand = [];
    for (const p of front) {
      const w = field.sample(p.x, p.y);
      if (water) { withCurrent(p, w, cand); continue; }
      const tws = Math.max(0.5, w.spd);
      const { up, down } = optimalAngles(tws);
      const remain = distXY(p, to);
      const dirMark = bearingXY(p, to);
      // directions testées : éventail autour de la route + angles optimaux (sans doublon, dans l’ordre d’ajout)
      const heads = [];
      const add = (h) => { if (!heads.includes(h)) heads.push(h); };
      for (let a = -90; a <= 90; a += 6) add(Math.round(norm360(dirMark + a)));
      for (const s of [-1, 1]) {
        add(Math.round(norm360(w.dir + s * up.twa)));
        add(Math.round(norm360(w.dir + 180 + s * (180 - down.twa))));
      }
      for (const hd of heads) {
        const sh = SIN[hd], ch = COS[hd];
        const twa = norm180(hd - w.dir);
        const bsp = boatSpeed(tws, twa) * perf;
        if (bsp < 0.2) continue;
        const tack = twa >= 0 ? 1 : -1; // 1 = bâbord amures, −1 = tribord amures
        let lost = 0, man = p.man;
        if (p.tack && tack !== p.tack) { lost = Math.abs(twa) < 90 ? tackLoss : gybeLoss; man++; }
        const dist = bsp * KN * Math.max(0, dt - lost);
        const nx = p.x + sh * dist, ny = p.y + ch * dist;
        // arrivée possible dans ce pas ?
        const proj = (to.x - p.x) * sh + (to.y - p.y) * ch;
        if (proj > 0 && proj <= dist + 1) {
          const off = Math.abs((to.x - p.x) * ch - (to.y - p.y) * sh);
          if (off < Math.max(25, dist * 0.06)) {
            const tArr = p.t + lost + proj / (bsp * KN);
            if (!best || tArr < best.t) best = { x: to.x, y: to.y, t: tArr, tack, parent: p, man, hd, twa, bsp };
            continue;
          }
        }
        if (blocked(nx, ny) || blocked((p.x + nx) / 2, (p.y + ny) / 2)) continue;
        cand.push({ x: nx, y: ny, t: p.t + dt, tack, parent: p, man, hd, twa, bsp, rem: Math.hypot(to.x - nx, to.y - ny) });
      }
      if (remain < 1) best = p;
    }
    if (best) break;
    if (!cand.length) break;
    // élagage : par secteur angulaire vu depuis l’arrivée, garder le plus proche de l’arrivée
    const bins = new Map();
    if (water) {
      // avec courant : dans chaque secteur, le plus proche de l’arrivée dans 5 s à sa vitesse fond d’approche (rem − vm × 5 s) ; à distance
      // presque égale (le même point atteint par deux chemins), celui dont la route fond mène à l’arrivée l’emporte sur celui qui devra virer
      for (const c of cand) {
        const b = Math.round(norm180(bearingXY(to, c) - (brgTo + 180)) / 1.5);
        const cur = bins.get(b);
        if (!cur || c.rem - c.vm * LOOK < cur.rem - cur.vm * LOOK) bins.set(b, c);
      }
    } else {
      for (const c of cand) {
        const b = Math.round(norm180(bearingXY(to, c) - (brgTo + 180)) / 1.5);
        const cur = bins.get(b);
        if (!cur || c.rem < cur.rem) bins.set(b, c);
      }
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

