// Scène 3D : relief, fonds marins, champ de vent animé, marques, parcours et routes.

import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { toXY, toLL } from './geo.js';
import { speedColor } from './wind.js';
import { PLACES } from './courses.js';
import { lineIndex } from './segments.js';

const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

function hexColor(h) { return new THREE.Color(h); }

function labelTexture(text, { bg = 'rgba(12,24,38,.82)', fg = '#fff', font = 600, size = 30, circle = false, border = null } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${font} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  const w = circle ? size * 1.7 : Math.ceil(ctx.measureText(text).width) + size;
  const h = circle ? size * 1.7 : Math.round(size * 1.55);
  c.width = w * 2; c.height = h * 2;
  ctx.scale(2, 2);
  ctx.font = `${font} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = bg;
  if (circle) { ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); ctx.fill(); if (border) { ctx.lineWidth = 3; ctx.strokeStyle = border; ctx.stroke(); } }
  else { const r = h / 2; ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, r); ctx.fill(); if (border) { ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke(); } }
  ctx.fillStyle = fg; ctx.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, aspect: w / h };
}

function makeLabel(text, opts = {}, px = 22) {
  const { tex, aspect } = labelTexture(text, opts);
  const m = new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true });
  const s = new THREE.Sprite(m);
  s.userData.px = px; s.userData.aspect = aspect;
  s.renderOrder = 10;
  return s;
}

export class Scene3D {
  constructor(el, terrain) {
    this.el = el; this.t = terrain;
    this.exag = 1.6;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#bcd6ea');
    this.scene.fog = new THREE.Fog('#bcd6ea', 26000, 60000);
    this.camera = new THREE.PerspectiveCamera(42, 1, 20, 120000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.09, screenSpacePanning: false, maxPolarAngle: Math.PI * 0.47, minDistance: 300, maxDistance: 45000, zoomSpeed: 1.2 });
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.scene.add(new THREE.HemisphereLight('#eef6ff', '#5a5040', 1.25));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(-8000, 9000, 6000); this.scene.add(sun);
    this.groups = {};
    for (const g of ['terrain', 'water', 'coast', 'particles', 'labels', 'marks', 'course', 'routes', 'line', 'boat', 'zones', 'stations', 'pick', 'replay', 'trace']) {
      this.groups[g] = new THREE.Group(); this.scene.add(this.groups[g]);
    }
    this.layers = { wind: true, particles: true, labels: true, routes: true, depth: false };
    this.ribbons = [];
    this.buildTerrain();
    this.buildCoast();
    this.buildWater();
    this.buildPlaceLabels();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const pn = document.getElementById('panel'); if (pn && 'ResizeObserver' in window) new ResizeObserver(() => this.updateInsets()).observe(pn);
    if (this.camera.aspect < 1) this.home({ x: 900, y: -5200 }, 30000, 0.5); else this.home();
    this.clock = new THREE.Clock();
    this.controls.addEventListener('change', () => { this.needRibbons = true; this.onCamera?.(); });
    this.#bindPick();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.updateInsets();
  }

  home(target = { x: 300, y: 600 }, dist = 13500, tilt = 0.85, az = 0) {
    const tgt = W(target.x, target.y, 0);
    this.controls.target.copy(tgt);
    const r = dist;
    this.camera.position.set(tgt.x + r * Math.sin(tilt) * Math.sin(az), r * Math.cos(tilt), tgt.z + r * Math.sin(tilt) * Math.cos(az));
    this.controls.update();
  }
  topView() { const t = this.controls.target; const d = this.camera.position.distanceTo(t); this.camera.position.set(t.x, d, t.z + 1); this.controls.update(); }
  tiltView() { const t = this.controls.target; const d = this.camera.position.distanceTo(t); this.camera.position.set(t.x, d * 0.62, t.z + d * 0.78); this.controls.update(); }
  // zone de la carte réellement visible : sur téléphone, le panneau du bas et le badge du vent en haut
  // recouvrent une partie de la scène, et la colonne de boutons le bord droit
  visibleRect() {
    const Wd = this.el.clientWidth || 1, H = this.el.clientHeight || 1, sr = this.el.getBoundingClientRect();
    const box = (id) => { const e = document.getElementById(id); if (!e || e.hidden || !e.getClientRects().length) return null; return e.getBoundingClientRect(); };
    const r = { l: 0, r: Wd, t: 0, b: H, W: Wd, H };
    const pr = box('panel');
    if (!(pr && pr.left <= sr.left + 10 && pr.right >= sr.right - 10 && pr.top < sr.bottom)) return r; // ordinateur : panneau à côté
    r.b = Math.min(H, pr.top - sr.top);
    const hud = box('hud'); if (hud) r.t = Math.max(0, hud.bottom - sr.top + 4);
    const mb = box('mapBtns'); if (mb && mb.left - sr.left > Wd / 2) r.r = Math.min(r.r, mb.left - sr.left - 4);
    if (r.b - r.t < 140) r.t = Math.max(0, r.b - 140);
    return r;
  }
  // place le centre optique de la caméra au milieu de la zone visible (cible des rotations et des cadrages)
  updateInsets() {
    const v = this.visibleRect(), dx = (v.l + v.r) / 2 - v.W / 2, dy = (v.t + v.b) / 2 - v.H / 2;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) this.camera.clearViewOffset();
    else this.camera.setViewOffset(v.W, v.H, -dx, -dy, v.W, v.H);
    this.camera.updateProjectionMatrix();
    this.vis = v; this.needRibbons = true;
  }
  focus(pts, pad = 1.35) {
    if (!pts.length) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    this.updateInsets();
    const v = this.vis, tanH = Math.tan((this.camera.fov * Math.PI) / 360);
    const t = this.controls.target, off = this.camera.position.clone().sub(t).normalize();
    const cosTilt = Math.max(0.35, off.y);
    // distance pour faire tenir la boîte dans la zone visible (vue de dessus approchée)
    const bw = Math.max(x1 - x0, 400) * pad, bh = Math.max(y1 - y0, 400) * pad;
    const dist = Math.max(900, (bw / 2 / (tanH * this.camera.aspect)) * (v.W / (v.r - v.l)), ((bh * cosTilt) / 2 / tanH) * (v.H / (v.b - v.t)));
    t.copy(W((x0 + x1) / 2, (y0 + y1) / 2, 0));
    this.camera.position.copy(t.clone().add(off.multiplyScalar(dist)));
    this.controls.update();
  }
  azimuth() { const v = this.camera.position.clone().sub(this.controls.target); return (Math.atan2(v.x, v.z) * 180) / Math.PI; }

  // ───────── relief
  buildTerrain() {
    const T = this.t, step = Math.min(window.innerWidth, window.innerHeight) < 700 ? 2 : 1;
    const nx = Math.floor((T.nx - 1) / step) + 1, ny = Math.floor((T.ny - 1) / step) + 1;
    const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2);
    const W = T.x1 - T.x0, H = T.y1 - T.y0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const si = i * step, sj = j * step, id = sj * T.nx + si, k = (j * nx + i) * 3, q = (j * nx + i) * 2;
      const x = T.x0 + (si + 0.5) * T.dx, y = T.y1 - (sj + 0.5) * T.dy;
      const h = T.h[id], c = T.cover[id];
      pos[k] = x; pos[k + 2] = -y;
      pos[k + 1] = c === 0 ? Math.max(h, -400) * this.exag * 0.5 - 6 : c === 3 ? 6 * this.exag : Math.max(h, 2) * this.exag;
      uv[q] = (x - T.x0) / W; uv[q + 1] = (y - T.y0) / H;
    }
    const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let n = 0;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    this.groups.terrain.clear();
    if (!this.terrainMat) {
      // fond de carte HD (≈ 6 m/pixel) : côte OSM nette, ombrage du relief, fonds marins
      this.terrainMat = new THREE.MeshLambertMaterial({ color: '#b9b49a' });
      new THREE.TextureLoader().load('data/basemap.jpg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        this.terrainMat.map = tex; this.terrainMat.color.set('#ffffff'); this.terrainMat.needsUpdate = true;
      });
    }
    const mesh = new THREE.Mesh(g, this.terrainMat);
    this.groups.terrain.add(mesh);
    this.terrainMesh = mesh;
  }

  setExaggeration(e) { this.exag = e; this.buildTerrain(); this.buildPlaceLabels(); }

  buildCoast() {
    const pts = [];
    for (const way of this.t.coast) {
      for (let i = 0; i < way.length - 1; i++) {
        const a = toXY(way[i][1], way[i][0]), b = toXY(way[i + 1][1], way[i + 1][0]);
        pts.push(a.x, 3, -a.y, b.x, 3, -b.y);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.groups.coast.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#fdfbf5', transparent: true, opacity: 0.35 })));
  }

  // ───────── surface de l’eau colorée par la force du vent
  buildWater() {
    const T = this.t;
    this.waterCanvas = document.createElement('canvas');
    this.waterTex = new THREE.CanvasTexture(this.waterCanvas);
    this.waterTex.colorSpace = THREE.SRGBColorSpace; this.waterTex.magFilter = THREE.LinearFilter;
    const g = new THREE.PlaneGeometry(T.x1 - T.x0, T.y1 - T.y0);
    g.rotateX(-Math.PI / 2);
    this.seaMask = new THREE.TextureLoader().load('data/seamask.png', () => { this.waterMat.needsUpdate = true; this.plainMat.needsUpdate = true; });
    this.waterMat = new THREE.MeshBasicMaterial({ map: this.waterTex, alphaMap: this.seaMask, transparent: true, opacity: 0.9, depthWrite: false });
    const m = new THREE.Mesh(g, this.waterMat);
    m.position.set((T.x0 + T.x1) / 2, 0, -(T.y0 + T.y1) / 2);
    m.renderOrder = 2;
    this.groups.water.add(m);
    this.waterMesh = m;
    // calque « eau simple » quand la carte du vent est masquée
    this.plainMat = new THREE.MeshBasicMaterial({ color: '#3b8fc0', alphaMap: this.seaMask, transparent: true, opacity: 0.3, depthWrite: false });
  }

  setField(field) {
    this.field = field;
    const T = this.t, c = this.waterCanvas, nx = field.nx, ny = field.ny;
    if (c.width !== nx || c.height !== ny) {
      // la taille d'une texture WebGL est figée à son premier envoi : on la recrée à la bonne taille
      c.width = nx; c.height = ny;
      this.waterTex.dispose();
      this.waterTex = new THREE.CanvasTexture(c);
      this.waterTex.colorSpace = THREE.SRGBColorSpace; this.waterTex.magFilter = THREE.LinearFilter;
      this.waterMat.map = this.waterTex; this.waterMat.needsUpdate = true;
    }
    const ctx = c.getContext('2d'), img = ctx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = j * nx + i, k = id * 4;
      let v = field.spd[id];
      if (field.land[id]) {
        v = null;
        for (let r = 1; r <= 4 && v == null; r++) for (let dj = -r; dj <= r && v == null; dj++) for (let di = -r; di <= r; di++) {
          const ii = i + di, jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && !field.land[jj * nx + ii]) { v = field.spd[jj * nx + ii]; break; }
        }
        if (v == null) { img.data[k + 3] = 0; continue; }
      }
      const [r, g, b] = speedColor(v);
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.waterTex.needsUpdate = true;
    this.waterMesh.material = this.layers.wind ? this.waterMat : this.plainMat;
    if (!this.particles) this.#initParticles();
  }

  setLayer(name, on) {
    this.layers[name] = on;
    if (name === 'wind') this.waterMesh.material = on ? this.waterMat : this.plainMat;
    if (name === 'particles') this.groups.particles.visible = on;
    if (name === 'labels') this.groups.labels.visible = on;
    if (name === 'routes') this.groups.routes.visible = on;
  }

  // ───────── particules (traînées de vent)
  #initParticles() {
    const N = Math.min(window.innerWidth, window.innerHeight) < 700 ? 1400 : 2600;
    this.pN = N;
    this.pPos = new Float32Array(N * 2); this.pAge = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    this.pBuf = new Float32Array(N * 6); this.pCol = new Float32Array(N * 8);
    g.setAttribute('position', new THREE.BufferAttribute(this.pBuf, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 4));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    this.particles = new THREE.LineSegments(g, mat);
    this.particles.renderOrder = 5; this.particles.frustumCulled = false;
    this.groups.particles.add(this.particles);
    for (let i = 0; i < N; i++) this.#respawn(i, true);
  }
  #respawn(i, randomAge) {
    const T = this.t;
    for (let k = 0; k < 20; k++) {
      const x = T.x0 + Math.random() * (T.x1 - T.x0), y = T.y0 + Math.random() * (T.y1 - T.y0);
      if (!T.isLand(x, y)) { this.pPos[i * 2] = x; this.pPos[i * 2 + 1] = y; break; }
    }
    this.pAge[i] = randomAge ? Math.random() * 6 : 0;
  }
  #stepParticles(dt) {
    const F = this.field; if (!F || !this.particles) return;
    const N = this.pN, speedup = 90; // accélération visuelle
    const zoom = this.camera.position.distanceTo(this.controls.target);
    const trail = Math.max(1.2, zoom / 6000) * 14;
    for (let i = 0; i < N; i++) {
      let x = this.pPos[i * 2], y = this.pPos[i * 2 + 1];
      const w = F.sample(x, y);
      const vx = w.u * 0.5144, vy = w.v * 0.5144;
      x += vx * dt * speedup; y += vy * dt * speedup;
      this.pAge[i] += dt;
      if (this.pAge[i] > 6 || this.t.isLand(x, y) || !this.t.inside(x, y)) { this.#respawn(i, false); x = this.pPos[i * 2]; y = this.pPos[i * 2 + 1]; }
      this.pPos[i * 2] = x; this.pPos[i * 2 + 1] = y;
      const k = i * 6;
      this.pBuf[k] = x; this.pBuf[k + 1] = 8; this.pBuf[k + 2] = -y;
      this.pBuf[k + 3] = x - vx * trail; this.pBuf[k + 4] = 8; this.pBuf[k + 5] = -(y - vy * trail);
      const a = Math.min(1, this.pAge[i] * 2) * Math.min(1, (6 - this.pAge[i]) * 1.5);
      const c = i * 8;
      this.pCol[c] = 1; this.pCol[c + 1] = 1; this.pCol[c + 2] = 1; this.pCol[c + 3] = 0.9 * a;
      this.pCol[c + 4] = 1; this.pCol[c + 5] = 1; this.pCol[c + 6] = 1; this.pCol[c + 7] = 0;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  // ───────── étiquettes de lieux
  buildPlaceLabels() {
    const g = this.groups.labels; g.clear();
    const places = PLACES;
    for (const [name, lat, lon, kind] of places) {
      const p = toXY(lat, lon), h = Math.max(0, this.t.height(p.x, p.y)) * this.exag;
      const s = makeLabel(name, kind === 4 ? { bg: 'rgba(255,255,255,0)', fg: '#0d3b66', font: 600, size: 26 } : kind === 3 ? { bg: 'rgba(80,60,30,.75)' } : {}, kind === 4 ? 18 : 17);
      s.position.copy(W(p.x, p.y, h + 40));
      g.add(s);
    }
    this.#sizeSprites();
  }

  #sizeSprites() {
    const h = this.el.clientHeight || 800;
    this.scene.traverse((o) => {
      if (o.isSprite && o.userData.px) {
        const sy = (o.userData.px / h) * (Math.min(innerWidth, innerHeight) < 600 ? 0.68 : 0.9); o.scale.set(sy * o.userData.aspect, sy, 1);
      }
    });
  }

  // ───────── marques
  setMarks(marks, active = new Map()) {
    const g = this.groups.marks; g.clear();
    for (const [id, m] of Object.entries(marks)) {
      const p = toXY(m.lat, m.lon);
      const a = active.get(String(id));
      const ring = a ? (a.side === 'b' ? '#ff4d4d' : a.side === 't' ? '#2ecc71' : '#ffffff') : null;
      const bg = m.color === '#1f9d55' ? '#1f9d55' : m.color === '#e03131' ? '#d63031' : '#f5c400', fg = m.color === '#f5c400' ? '#222' : '#fff';
      // dans le parcours : numéro d'ordre de passage (1, 2, 3…) ; hors parcours : numéro CVAT en grisé
      const txt0 = a?.orders?.length ? a.orders.join('·') : String(id), txt = m.doubt ? txt0 + ' ?' : txt0;      // « 3 ? » : position à confirmer (D-01)
      const s = a ? makeLabel(txt, { circle: a.orders.length < 2, bg, fg, size: 26, border: ring }, 30)
        : makeLabel(String(id) + (m.doubt ? ' ?' : ''), { circle: !m.doubt, bg: 'rgba(120,135,150,.75)', fg: '#fff', size: 22 }, 17);      // hors parcours aussi : « X1 ? » (D-04)
      s.position.copy(W(p.x, p.y, 70));
      s.userData.mark = id;
      g.add(s);
      const nm0 = a ? `${/^\d+$/.test(id) ? 'n°' + id + ' ' : ''}${m.name}${a.side ? (a.side === 'b' ? ' · bâbord' : ' · tribord') : ''}` : m.name, nm = m.doubt ? nm0 + ' · à confirmer' : nm0;
      const name = makeLabel(nm, { bg: a ? 'rgba(12,24,38,.78)' : 'rgba(12,24,38,.45)', size: 22 }, a ? 15 : 11);
      name.position.copy(W(p.x, p.y, 70)); name.center.set(-0.12, 1.25);
      g.add(name);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 70, 8), new THREE.MeshLambertMaterial({ color: m.color }));
      pole.position.copy(W(p.x, p.y, 35));
      g.add(pole);
    }
    this.#sizeSprites();
  }

  setDangers(zones, dangers) {
    const g = this.groups.zones; g.clear();
    for (const poly of zones) {
      const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, p.y)));
      const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#e03131', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
      m.position.y = 4; m.renderOrder = 3; g.add(m);
      const pts = poly.map((p) => W(p.x, p.y, 5)); pts.push(pts[0]);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#e03131', dashSize: 60, gapSize: 40 })).computeLineDistances());
      const c = poly.reduce((a, p) => ({ x: a.x + p.x / poly.length, y: a.y + p.y / poly.length }), { x: 0, y: 0 });
      const s = makeLabel('Zone interdite', { bg: 'rgba(200,30,30,.85)' }, 13); s.position.copy(W(c.x + 200, c.y, 60)); g.add(s);
    }
    for (const d of dangers) {
      const p = toXY(d.lat, d.lon);
      const s = makeLabel('⚠ ' + d.name, { bg: 'rgba(170,20,20,.85)' }, 13); s.position.copy(W(p.x, p.y, 40)); g.add(s);
    }
    this.#sizeSprites();
  }

  // ───────── rubans (largeur constante à l’écran)
  #ribbon(points, color, widthPx, opts = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opts.opacity ?? 0.95, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.renderOrder = opts.order ?? 6; mesh.frustumCulled = false;
    mesh.userData = { points, widthPx, dash: opts.dash, y: opts.y ?? 10 };
    this.ribbons.push(mesh);
    return mesh;
  }
  #updateRibbons() {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const mPerPx = (2 * dist * Math.tan((this.camera.fov * Math.PI) / 360)) / (this.el.clientHeight || 800);
    for (const r of this.ribbons) {
      const { points, widthPx, dash, y } = r.userData, w = (widthPx * mPerPx) / 2;
      const pos = [];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-6) continue;
        const nx = -(b.y - a.y) / L * w, ny = (b.x - a.x) / L * w;
        const pieces = dash ? Math.max(1, Math.floor(L / (dash * mPerPx))) : 1;
        for (let k = 0; k < pieces; k += dash ? 2 : 1) {
          const t0 = k / pieces, t1 = dash ? Math.min(1, (k + 1) / pieces) : 1;
          const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 }, p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };
          pos.push(p0.x + nx, y, -(p0.y + ny), p0.x - nx, y, -(p0.y - ny), p1.x + nx, y, -(p1.y + ny));
          pos.push(p1.x + nx, y, -(p1.y + ny), p0.x - nx, y, -(p0.y - ny), p1.x - nx, y, -(p1.y - ny));
        }
      }
      r.geometry.dispose();
      r.geometry = new THREE.BufferGeometry();
      r.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    }
    this.#sizeSprites();
  }
  #clearRibbons(group) {
    this.ribbons = this.ribbons.filter((r) => !group.children.includes(r));
    group.clear();
  }

  // ───────── parcours et routes
  setCourse(analysis, selectedLeg = null) {
    const gc = this.groups.course, gr = this.groups.routes;
    this.#clearRibbons(gc); this.#clearRibbons(gr);
    if (!analysis) return;
    analysis.legs.forEach((leg, i) => {
      const sel = selectedLeg === i;
      const col = leg.type.id === 'pres' ? '#ffffff' : leg.type.sail.startsWith('Spi') ? '#ffd166' : '#ffe9b0';
      const dim = selectedLeg != null && !sel;
      gc.add(this.#ribbon([leg.from, leg.to], sel ? '#ff9f1c' : col, sel ? 4 : 3, { opacity: sel ? 0.9 : dim ? 0.3 : 0.85, y: 12 }));
      // flèche au milieu du bord
      const m = { x: (leg.from.x + leg.to.x) / 2, y: (leg.from.y + leg.to.y) / 2 };
      const s = makeLabel('➤', { bg: 'rgba(0,0,0,0)', fg: sel ? '#ff9f1c' : '#fff', size: 30 }, 16);
      s.material.rotation = -((leg.brg - 90) * Math.PI) / 180 + (this.azimuthRad ?? 0);
      s.userData.brg = leg.brg; s.userData.arrow = true;
      s.position.copy(W(m.x, m.y, 30)); gc.add(s);
      if (leg.route && selectedLeg == null) {
        gr.add(this.#ribbon(leg.route.path.map((p) => ({ x: p.x, y: p.y })), '#7ae7ff', 2, { dash: 9, y: 14, opacity: 0.95 }));
      } else if (leg.route && sel) this.#selectedRoute(leg, gr);
      if (sel && leg.type.id === 'pres') this.#laylines(leg, gr);
    });
    this.needRibbons = true;
  }
  // route conseillée du bord sélectionné : trait plein cerné de sombre, virements/empannages et cap de chaque bordée
  #selectedRoute(leg, g) {
    const path = leg.route.path, pts = path.map((p) => ({ x: p.x, y: p.y }));
    g.add(this.#ribbon(pts, '#03263b', 10, { y: 14, opacity: 0.55, order: 7 }));
    g.add(this.#ribbon(pts, '#00e5ff', 5, { y: 15, opacity: 1, order: 8 }));
    const man = leg.type.id === 'pres' ? 'virement' : 'empannage';
    // bordées : suites de segments sur la même amure (path[i].tack vaut pour le segment i−1 → i)
    const runs = [];
    for (let i = 1; i < path.length; i++) {
      const r = runs[runs.length - 1];
      if (r && r.tack === path[i].tack) r.e = i; else runs.push({ s: i, e: i, tack: path[i].tack, hd: path[i].hd });
    }
    runs.forEach((r, k) => {
      const a = path[r.s - 1], b = path[r.e];
      if (k > 0) { const m = makeLabel(`↻ ${man} ${k}`, { bg: 'rgba(3,38,59,.9)' }, 12); m.position.copy(W(a.x, a.y, 45)); g.add(m); }
      if (r.hd != null && Math.hypot(b.x - a.x, b.y - a.y) > 150) {
        const hd = String(Math.round(((r.hd % 360) + 360) % 360)).padStart(3, '0');
        const lb = makeLabel(`${hd}° ${r.tack > 0 ? 'bâbord' : 'tribord'}`, { bg: r.tack > 0 ? 'rgba(200,40,40,.9)' : 'rgba(20,140,70,.9)' }, 13);
        lb.position.copy(W((a.x + b.x) / 2, (a.y + b.y) / 2, 60)); g.add(lb);
      }
    });
    this.#sizeSprites();
  }
  #laylines(leg, g) {
    const F = this.field; if (!F) return;
    const w = F.sample(leg.to.x, leg.to.y);
    const up = this.upAngle?.(w.spd) ?? 42;
    const L = Math.min(leg.dist * 0.9, 3000);
    for (const s of [-1, 1]) {
      const hd = w.dir + s * up + 180;
      const p = { x: leg.to.x + Math.sin((hd * Math.PI) / 180) * L, y: leg.to.y + Math.cos((hd * Math.PI) / 180) * L };
      g.add(this.#ribbon([leg.to, p], s < 0 ? '#2ecc71' : '#ff6b6b', 2, { dash: 5, y: 13, opacity: 0.8 }));
    }
  }

  setLine(L, extra = []) {
    const g = this.groups.line; this.#clearRibbons(g);
    if (!L) return;
    g.add(this.#ribbon([L.pin, L.cb], '#ff8c00', 3, { y: 15, dash: 4 }));
    const cb = makeLabel('Comité ⚑', { bg: 'rgba(230,110,0,.92)' }, 15); cb.position.copy(W(L.cb.x, L.cb.y, 50)); g.add(cb);
    const pin = makeLabel('Bouée', { bg: 'rgba(255,255,255,.92)', fg: '#222' }, 13); pin.position.copy(W(L.pin.x, L.pin.y, 50)); g.add(pin);
    for (const e of extra) { const s = makeLabel(e.name, { bg: 'rgba(230,110,0,.85)' }, 13); s.position.copy(W(e.x, e.y, 50)); g.add(s); }
    this.#sizeSprites();
    this.needRibbons = true;
  }

  setBoat(p, cog) {
    const g = this.groups.boat; g.clear();
    if (!p) return;
    const s = makeLabel('▲', { bg: 'rgba(0,0,0,0)', fg: '#ff2d55', size: 40 }, 26);
    s.position.copy(W(p.x, p.y, 25)); s.userData.brg = cog ?? 0; s.userData.arrow = true; s.userData.up = true;
    g.add(s);
    const ring = makeLabel('', { bg: 'rgba(255,45,85,.25)', circle: true, size: 30 }, 34); ring.position.copy(W(p.x, p.y, 20)); g.add(ring);
    this.#sizeSprites();
  }

  setStations(list) {
    const g = this.groups.stations; g.clear();
    for (const s of list) {
      const p = toXY(s.lat, s.lon);
      if (!this.t.inside(p.x, p.y)) continue;
      const lab = makeLabel(`📡 ${Math.round(s.spd)} nd ${s.dir != null ? Math.round(s.dir) + '°' : ''}`, { bg: 'rgba(90,40,160,.85)' }, 13);
      lab.position.copy(W(p.x, p.y, 60)); g.add(lab);
    }
    this.#sizeSprites();
  }

  // ───────── sélection au doigt
  #bindPick() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 6 && performance.now() - down.t < 500) this.#pick(e);
      down = null;
    });
  }
  #pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    if (!rc.ray.intersectPlane(plane, hit)) return;
    const x = hit.x, y = -hit.z;
    const g = this.groups.pick; g.clear();
    const s = makeLabel('＋', { bg: 'rgba(0,0,0,0)', fg: '#111', size: 34 }, 20); s.position.copy(W(x, y, 15)); g.add(s);
    this.#sizeSprites();
    this.onPick?.({ x, y, ...toLL(x, y) }, { clientX: e.clientX - r.left, clientY: e.clientY - r.top });
  }
  clearPick() { this.groups.pick.clear(); }


  // ───────── animation : un J80 parcourt la route optimale en accéléré
  #makeBoat() {
    const g = new THREE.Group();
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, -4); hullShape.quadraticCurveTo(1.35, -1.2, 1.25, 2.6); hullShape.lineTo(1.0, 4);
    hullShape.lineTo(-1.0, 4); hullShape.lineTo(-1.25, 2.6); hullShape.quadraticCurveTo(-1.35, -1.2, 0, -4);
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.9, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: '#f4f6f8' }));
    hull.rotation.x = Math.PI / 2; hull.position.y = 0.9; g.add(hull);
    const deck = new THREE.Mesh(new THREE.ShapeGeometry(hullShape), new THREE.MeshBasicMaterial({ color: '#d63031', side: THREE.DoubleSide }));
    deck.rotation.x = Math.PI / 2; deck.position.y = 0.95; deck.scale.set(0.82, 0.82, 1); g.add(deck);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 9, 6), new THREE.MeshLambertMaterial({ color: '#333' }));
    mast.position.set(0, 5.4, -0.6); g.add(mast);
    const sailMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const main = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 9.8, 0), new THREE.Vector3(0, 1.4, 3.6)]), sailMat);
    main.geometry.computeVertexNormals();
    const boom = new THREE.Group(); boom.position.set(0, 0, -0.6); boom.add(main); g.add(boom);
    const jib = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.3, 0), new THREE.Vector3(0, 8.6, 3.5), new THREE.Vector3(0, 1.3, 3.0)]), sailMat);
    jib.geometry.computeVertexNormals();
    const jibG = new THREE.Group(); jibG.position.set(0, 0, -4); jibG.add(jib); g.add(jibG);
    const spi = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.6, -1.5), new THREE.Vector3(0, 9.4, 3.8), new THREE.Vector3(0, 1.6, 4.4)]), new THREE.MeshLambertMaterial({ color: '#ff8c00', side: THREE.DoubleSide }));
    spi.geometry.computeVertexNormals();
    const spiG = new THREE.Group(); spiG.position.set(0, 0, -5.5); spiG.add(spi); g.add(spiG);
    g.userData = { boom, jibG, spiG };
    return g;
  }

  setReplay(track) {
    const g = this.groups.replay; this.#clearRibbons(g);
    this.replay = null;
    if (!track || track.length < 2) return;
    const boat = this.#makeBoat();
    g.add(boat);
    const T = track[track.length - 1].t;
    this.replay = { track, T, t: 0, playing: true, rate: T / 45, boat, wakeAt: -1, follow: false, i: 0 };
    this.replay.wake = this.#ribbon([track[0], track[0]], '#ff2d55', 3, { y: 16, opacity: 0.95 });
    g.add(this.replay.wake);
  }
  replayControl(cmd, v) {
    const R = this.replay; if (!R) return;
    if (cmd === 'toggle') { if (R.t >= R.T) R.t = 0; R.playing = !R.playing; }
    if (cmd === 'seek') { R.t = Math.max(0, Math.min(R.T, v)); R.i = 0; R.wakeAt = -1; }
    if (cmd === 'speed') R.rate = (R.T / 45) * v;
    if (cmd === 'follow') R.follow = v;
  }
  #stepReplay(dt) {
    const R = this.replay; if (!R) return;
    if (R.playing) { R.t += dt * R.rate; if (R.t >= R.T) { R.t = R.T; R.playing = false; } }
    const tr = R.track;
    if (tr[R.i].t > R.t) R.i = 0;
    while (R.i < tr.length - 2 && tr[R.i + 1].t <= R.t) R.i++;
    const a = tr[R.i], b = tr[R.i + 1], f = b.t > a.t ? Math.min(1, (R.t - a.t) / (b.t - a.t)) : 1;
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    const hd = b.hd ?? Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI;
    const twa = b.twa ?? 0, spi = !!b.spi;
    const dist = this.camera.position.distanceTo(this.controls.target), sc = Math.max(1, dist / 240);
    R.boat.position.set(x, 2, -y); R.boat.rotation.y = -hd * Math.PI / 180; R.boat.scale.setScalar(sc);
    // voiles : bôme sous le vent, ouverte selon l'angle au vent
    const lee = twa >= 0 ? 1 : -1, open = Math.min(80, Math.max(8, (Math.abs(twa) - 30) * 0.6)) * Math.PI / 180;
    R.boat.userData.boom.rotation.y = lee * open;
    R.boat.userData.jibG.rotation.y = lee * open * 0.6;
    R.boat.userData.spiG.visible = spi; R.boat.userData.jibG.visible = !spi;
    R.boat.userData.spiG.rotation.y = lee * Math.min(70, Math.abs(twa) - 80) * Math.PI / 180;
    R.boat.rotation.z = -lee * Math.min(0.35, (b.bsp || 0) / 30) * (Math.abs(twa) < 100 ? 1 : 0.4);
    if (R.follow) { const off = this.camera.position.clone().sub(this.controls.target); this.controls.target.set(x, 0, -y); this.camera.position.copy(this.controls.target.clone().add(off)); }
    if (Math.abs(R.t - R.wakeAt) > R.T / 300 || !R.playing) {
      R.wakeAt = R.t;
      let from = R.i; while (from > 0 && !tr[from].brk) from--;       // le sillage ne franchit pas une pause d'enregistrement
      const pts = tr.slice(from, R.i + 1).map((p) => ({ x: p.x, y: p.y })); pts.push({ x, y });
      R.wake.userData.points = pts; this.needRibbons = true;
    }
    this.onReplay?.({ t: R.t, T: R.T, playing: R.playing, p: b, x, y, hd });
  }

  // trace GPS enregistrée, colorée par la vitesse ; repères de virements / empannages
  setTrace(P, man = []) {
    const g = this.groups.trace; g.clear();
    if (!P || P.length < 2) return;
    const pos = [], col = [], c = new THREE.Color();
    const vmax = Math.max(6, ...P.map((p) => p.v || 0));
    for (const p of P) {
      pos.push(p.x, 18, -p.y);
      const k = Math.min(1, (p.v || 0) / vmax);
      c.setHSL(0.66 - 0.66 * k, 0.9, 0.5); col.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // segments indexés : une pause d'enregistrement ou une perte du GPS n'est jamais reliée par une ligne droite (js/segments.js)
    geo.setIndex(lineIndex(P.length, P.flatMap((p, i) => (p.brk ? [i] : []))));
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 }));
    line.renderOrder = 7; g.add(line);
    for (const m of man) { const s = makeLabel(m.kind === 'virement' ? 'V' : 'E', { circle: true, bg: m.kind === 'virement' ? '#1673c9' : '#7b3fb0', size: 22 }, 14); s.position.copy(W(m.x, m.y, 30)); g.add(s); }
    const a = makeLabel('Départ trace', { bg: 'rgba(0,0,0,.7)' }, 12); a.position.copy(W(P[0].x, P[0].y, 40)); g.add(a);
    this.#sizeSprites();
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.controls.update();
    if (this.layers.particles) this.#stepParticles(dt);
    this.#stepReplay(dt);
    if (this.needRibbons) { this.needRibbons = false; this.#updateRibbons(); }
    // orientation des flèches selon l’azimut caméra (vue de dessus approximative)
    const az = (this.azimuth() * Math.PI) / 180;
    for (const g of [this.groups.course, this.groups.boat]) for (const o of g.children) {
      if (o.userData.arrow) o.material.rotation = o.userData.up ? -(o.userData.brg * Math.PI) / 180 + az : -((o.userData.brg - 90) * Math.PI) / 180 + az;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
