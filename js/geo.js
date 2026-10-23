// Géographie : projection locale, relief, utilitaires de cap et de distance.

export const ORIGIN = { lat: 43.09, lon: 5.95 };
const KX = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320;
const KY = 110574;
export const NM = 1852;

// x vers l'Est, y vers le Nord (mètres)
export const toXY = (lat, lon) => ({ x: (lon - ORIGIN.lon) * KX, y: (lat - ORIGIN.lat) * KY });
export const toLL = (x, y) => ({ lat: ORIGIN.lat + y / KY, lon: ORIGIN.lon + x / KX });

export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const norm360 = (a) => ((a % 360) + 360) % 360;
export const norm180 = (a) => { const b = norm360(a); return b > 180 ? b - 360 : b; };

// Cap vrai de a vers b (points en XY)
export const bearingXY = (a, b) => norm360(deg(Math.atan2(b.x - a.x, b.y - a.y)));
export const distXY = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const fromBearing = (p, brg, dist) => ({ x: p.x + Math.sin(rad(brg)) * dist, y: p.y + Math.cos(rad(brg)) * dist });

export const fmtLat = (lat) => { const d = Math.floor(lat); return `${d}°${((lat - d) * 60).toFixed(3).padStart(6, '0')}N`; };
export const fmtLon = (lon) => { const d = Math.floor(lon); return `${String(d).padStart(3, '0')}°${((lon - d) * 60).toFixed(3).padStart(6, '0')}E`; };
export const fmtBrg = (b) => `${String(Math.round(norm360(b)) % 360).padStart(3, '0')}°`;
export const fmtNm = (m) => `${(m / NM).toFixed(m < 2 * NM ? 2 : 1)} Nq`;
export const cardinal = (d) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'][Math.round(norm360(d) / 22.5) % 16];

export class Terrain {
  async load(base = 'data/') {
    const [meta, h, c, coast] = await Promise.all([
      fetch(base + 'meta.json').then((r) => r.json()),
      fetch(base + 'terrain.bin').then((r) => r.arrayBuffer()),
      fetch(base + 'cover.bin').then((r) => r.arrayBuffer()),
      fetch(base + 'coast.json').then((r) => r.json()),
    ]);
    this.meta = meta;
    this.nx = meta.nx; this.ny = meta.ny;
    const raw = new Int16Array(h);
    this.h = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) this.h[i] = raw[i] / 10;
    this.cover = new Uint8Array(c);
    this.coast = coast;
    const sw = toXY(meta.south, meta.west), ne = toXY(meta.north, meta.east);
    this.x0 = sw.x; this.x1 = ne.x; this.y0 = sw.y; this.y1 = ne.y;
    this.dx = (this.x1 - this.x0) / this.nx; this.dy = (this.y1 - this.y0) / this.ny;
    return this;
  }
  // indices fractionnaires (centre de cellule), ligne 0 = nord
  fi(x, y) { return [(x - this.x0) / this.dx - 0.5, (this.y1 - y) / this.dy - 0.5]; }
  height(x, y) {
    let [fx, fy] = this.fi(x, y);
    fx = Math.max(0, Math.min(this.nx - 1.001, fx)); fy = Math.max(0, Math.min(this.ny - 1.001, fy));
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, n = this.nx, H = this.h;
    return H[j * n + i] * (1 - tx) * (1 - ty) + H[j * n + i + 1] * tx * (1 - ty) + H[(j + 1) * n + i] * (1 - tx) * ty + H[(j + 1) * n + i + 1] * tx * ty;
  }
  coverAt(x, y) {
    // mêmes indices que fi(), sans tableau intermédiaire (appelée pour chaque pas de chaque route)
    const i = Math.round((x - this.x0) / this.dx - 0.5), j = Math.round((this.y1 - y) / this.dy - 0.5);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return 0;
    return this.cover[j * this.nx + i];
  }
  isLand(x, y) { const c = this.coverAt(x, y); return c === 1 || c === 2; }
  inside(x, y) { return x > this.x0 && x < this.x1 && y > this.y0 && y < this.y1; }
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
