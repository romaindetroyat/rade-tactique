// Champ de vent local sur la rade.
//
// Le vent « de base » vient soit des prévisions (points AROME 1,3 km interpolés),
// soit d’une saisie manuelle. On y ajoute des corrections d’échelle fine, liées au relief :
//  1. Contournement : écoulement 2D « poreux » (Darcy) — la terre haute fait obstacle,
//     le vent accélère aux caps et dans les passes, et se dévie le long des côtes.
//  2. Déventement : sous le vent d’un relief, perte de vitesse et rafales plus marquées.
//  3. Frottement : près d’une côte au vent, le vent est « reculé » (rotation à gauche) de quelques degrés,
//     et près de toute côte il perd de la force sur 1 à 2 km, surtout par petit temps.
//  4. Blocage : quand le vent vient de la mer et bute sur une côte haute, il ralentit en amont du relief
//     (plus de vent au large que le long de la côte, observé le 18/10/2026 devant Saint-Mandrier).
// C’est un modèle heuristique, rapide, destiné à la tactique ; pas une simulation CFD.

import { rad, deg, norm360, norm180 } from './geo.js';

const CELL = 150; // m

export class WindField {
  constructor(terrain) {
    this.t = terrain;
    this.nx = Math.round((terrain.x1 - terrain.x0) / CELL);
    this.ny = Math.round((terrain.y1 - terrain.y0) / CELL);
    this.x0 = terrain.x0; this.y1 = terrain.y1;
    this.dx = (terrain.x1 - terrain.x0) / this.nx; this.dy = (terrain.y1 - terrain.y0) / this.ny;
    const n = this.nx * this.ny;
    this.h = new Float32Array(n); this.land = new Uint8Array(n); this.k = new Float32Array(n);
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const x = this.x0 + (i + 0.5) * this.dx, y = this.y1 - (j + 0.5) * this.dy;
      const h = terrain.height(x, y), c = terrain.coverAt(x, y), id = j * this.nx + i;
      this.h[id] = Math.max(0, h);
      this.land[id] = c === 1 || c === 2 ? 1 : 0;
      // perméabilité : la mer et les terres basses laissent passer le vent, le relief le bloque
      this.k[id] = this.land[id] ? Math.max(0.04, Math.exp(-h / 110)) * (c === 2 ? 0.75 : 1) : 1;
    }
    this.distLand = this.#distanceToLand();
    this.kits = new Map();
    this.u = new Float32Array(n); this.v = new Float32Array(n);
    this.spd = new Float32Array(n); this.dir = new Float32Array(n); this.gust = new Float32Array(n);
    this.shelter = new Float32Array(n); this.block = new Float32Array(n);
    this.bu = new Float32Array(n); this.bv = new Float32Array(n); // vent de base, sans effets de site
  }

  #distanceToLand() {
    const { nx, ny } = this, d = new Float32Array(nx * ny).fill(1e9);
    const q = [];
    for (let id = 0; id < nx * ny; id++) if (this.land[id]) { d[id] = 0; q.push(id); }
    for (let h = 0; h < q.length; h++) {
      const id = q[h], i = id % nx, j = (id - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const k = jj * nx + ii;
        if (d[k] > d[id] + CELL) { d[k] = d[id] + CELL; q.push(k); }
      }
    }
    return d;
  }

  // Corrections pré-calculées pour une direction donnée (par pas de 5°)
  kit(dirFrom) {
    const key = Math.round(norm360(dirFrom) / 5) * 5 % 360;
    if (this.kits.has(key)) return this.kits.get(key);
    const { nx, ny, dx, dy, k } = this;
    const to = rad(key + 180), Ux = Math.sin(to), Uy = Math.cos(to);
    const n = nx * ny;
    const P = new Float64Array(n);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) P[j * nx + i] = Ux * (i * dx) + Uy * (-j * dy);
    // perméabilités aux faces (moyenne harmonique)
    const kE = new Float32Array(n), kS = new Float32Array(n);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      if (i < nx - 1) kE[id] = (2 * k[id] * k[id + 1]) / (k[id] + k[id + 1]);
      if (j < ny - 1) kS[id] = (2 * k[id] * k[id + nx]) / (k[id] + k[id + nx]);
    }
    const ax = 1 / (dx * dx), ay = 1 / (dy * dy), w = 1.9;
    for (let it = 0; it < 420; it++) {
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const id = j * nx + i;
        const e = kE[id] * ax, wv = kE[id - 1] * ax, s = kS[id] * ay, nn = kS[id - nx] * ay;
        const sum = e + wv + s + nn;
        if (sum <= 0) continue;
        const target = (e * P[id + 1] + wv * P[id - 1] + s * P[id + nx] + nn * P[id - nx]) / sum;
        P[id] += w * (target - P[id]);
      }
    }
    const fac = new Float32Array(n), dev = new Float32Array(n), shel = new Float32Array(n), blk = new Float32Array(n);
    const speeds = [];
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const id = j * nx + i;
      const vx = k[id] * (P[id + 1] - P[id - 1]) / (2 * dx), vy = k[id] * (P[id - nx] - P[id + nx]) / (2 * dy);
      const sp = Math.hypot(vx, vy);
      fac[id] = sp;
      dev[id] = norm180(deg(Math.atan2(vx, vy)) - (key + 180));
      if (!this.land[id] && this.distLand[id] > 4000) speeds.push(sp);
    }
    speeds.sort((a, b) => a - b);
    const ref = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 1;
    // déventement par le relief au vent
    const sx = Math.sin(rad(key)), sy = Math.cos(rad(key));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      if (this.land[id]) { fac[id] = 0.5; continue; }
      fac[id] = Math.min(1.45, Math.max(0.55, fac[id] / ref));
      dev[id] = Math.max(-35, Math.min(35, dev[id]));
      const x = this.x0 + (i + 0.5) * dx, y = this.y1 - (j + 0.5) * dy;
      let s = 0;
      for (let d = 75; d <= 5000; d += d < 1000 ? 75 : 200) {
        const h = this.t.height(x + sx * d, y + sy * d);
        if (h > 2) s = Math.max(s, h / (h + 0.1 * d));
      }
      shel[id] = s;
      // blocage : relief situé sous le vent du point (le vent va buter dessus)
      let b = 0;
      for (let d = 100; d <= 3000; d += d < 1000 ? 100 : 250) {
        const h = this.t.height(x - sx * d, y - sy * d);
        if (h > 2) b = Math.max(b, h / (h + 0.12 * d));
      }
      blk[id] = b;
    }
    const kitObj = { fac, dev, shel, blk };
    this.kits.set(key, kitObj);
    return kitObj;
  }

  // base : { points: [{x,y,dir,spd,gust}] } (IDW) — un seul point = vent uniforme
  compute(base, opts = {}) {
    const { nx, ny, dx, dy } = this;
    const pts = base.points;
    const strength = opts.localEffects ?? 1;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      const x = this.x0 + (i + 0.5) * dx, y = this.y1 - (j + 0.5) * dy;
      let wu = 0, wv = 0, wg = 0, ws = 0;
      for (const p of pts) {
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + 4e6; // lissage ~2 km
        const w = 1 / (d2 * d2);
        wu += w * p.spd * Math.sin(rad(p.dir)); wv += w * p.spd * Math.cos(rad(p.dir));
        wg += w * (p.gust ?? p.spd * 1.3); ws += w;
      }
      const bs = Math.hypot(wu, wv) / ws, bd = norm360(deg(Math.atan2(wu, wv))), bg = wg / ws;
      if (this.land[id]) {
        this.spd[id] = bs * 0.5; this.dir[id] = bd; this.gust[id] = bg * 0.6; this.shelter[id] = 1; this.block[id] = 0;
        this.u[id] = 0; this.v[id] = 0; this.bu[id] = 0; this.bv[id] = 0; continue;
      }
      // interpolation entre deux kits de 5°
      const a = norm360(bd) / 5, a0 = Math.floor(a) * 5, t = a - Math.floor(a);
      const k0 = this.kit(a0), k1 = this.kit(a0 + 5);
      const fac = k0.fac[id] * (1 - t) + k1.fac[id] * t;
      const dev = k0.dev[id] * (1 - t) + k1.dev[id] * t;
      const sh = k0.shel[id] * (1 - t) + k1.shel[id] * t;
      const bk = k0.blk[id] * (1 - t) + k1.blk[id] * t;
      // les points AROME contiennent déjà l’effet des grands reliefs : on atténue
      const wFac = pts.length > 1 ? 0.6 : 1;
      let f = 1 + (fac - 1) * wFac * strength;
      f *= 1 - 0.5 * sh * strength;
      // blocage en amont d’une côte haute et frottement près de toute côte
      const dl = this.distLand[id];
      f *= 1 - 0.3 * bk * strength;
      // la terre freine le vent sur 1 à 2 km, davantage par petit temps (couche d’air plus stable)
      const fr = 0.15 + 0.15 * Math.min(1, Math.max(0, (10 - bs) / 6));
      f *= 1 - fr * Math.exp(-dl / 1200) * strength;
      const coastBack = dl < 1500 ? -7 * (1 - dl / 1500) * Math.min(1, sh * 3) : 0;
      const d = norm360(bd + (dev * wFac + coastBack) * strength);
      const s = Math.max(0, bs * f);
      this.spd[id] = s; this.dir[id] = d; this.shelter[id] = sh; this.block[id] = bk;
      const gf = bs > 0.5 ? Math.max(1.1, bg / bs) : 1.3;
      this.gust[id] = s * (gf + 0.35 * sh * strength);
      this.u[id] = -s * Math.sin(rad(d)); this.v[id] = -s * Math.cos(rad(d)); // vecteur « vers »
      this.bu[id] = -bs * Math.sin(rad(bd)); this.bv[id] = -bs * Math.cos(rad(bd));
    }
    this.base = base;
    return this;
  }

  sample(x, y) {
    const fx = (x - this.x0) / this.dx - 0.5, fy = (this.y1 - y) / this.dy - 0.5;
    const i = Math.max(0, Math.min(this.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(this.ny - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - i)), ty = Math.min(1, Math.max(0, fy - j));
    const n = this.nx, id = j * n + i;
    const L = (A) => A[id] * (1 - tx) * (1 - ty) + A[id + 1] * tx * (1 - ty) + A[id + n] * (1 - tx) * ty + A[id + n + 1] * tx * ty;
    const u = L(this.u), v = L(this.v);
    const spd = Math.hypot(u, v), bu = L(this.bu), bv = L(this.bv);
    return { spd, dir: norm360(deg(Math.atan2(-u, -v))), gust: L(this.gust), shelter: L(this.shelter), block: L(this.block), u, v,
      baseSpd: Math.hypot(bu, bv), baseDir: norm360(deg(Math.atan2(-bu, -bv))) };
  }

  // Amplitude des oscillations attendues (°) : plus forte par petit temps et sous le vent des reliefs
  shiftAmplitude(spd, shelter) {
    const base = spd < 5 ? 18 : spd < 8 ? 13 : spd < 12 ? 9 : spd < 18 ? 7 : 6;
    return Math.round(base * (1 + 0.8 * shelter));
  }
}

export const speedColor = (kn) => {
  // échelle « météo marine » : bleu calme → vert → jaune → orange → rouge → violet
  const stops = [[0, [40, 70, 160]], [4, [40, 140, 210]], [8, [50, 190, 140]], [12, [200, 215, 60]], [16, [245, 160, 40]], [22, [225, 60, 50]], [30, [160, 40, 160]]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i], [b, cb] = stops[i + 1];
    if (kn <= b) { const t = Math.max(0, (kn - a) / (b - a)); return ca.map((c, k) => Math.round(c + (cb[k] - c) * t)); }
  }
  return stops[stops.length - 1][1];
};
