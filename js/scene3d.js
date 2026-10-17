// Scène 3D : relief, fonds marins, champ de vent animé, marques, parcours et routes.

import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { toXY, toLL } from './geo.js';
import { speedColor } from './wind.js';

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
    for (const g of ['terrain', 'water', 'coast', 'particles', 'labels', 'marks', 'course', 'routes', 'line', 'boat', 'zones', 'stations', 'pick']) {
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
    if (this.camera.aspect < 1) this.home({ x: 900, y: -5200 }, 30000, 0.5); else this.home();
    this.clock = new THREE.Clock();
    this.controls.addEventListener('change', () => { this.needRibbons = true; this.onCamera?.(); });
    this.#bindPick();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.needRibbons = true;
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
  focus(pts, pad = 1.35) {
    if (!pts.length) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    const span = Math.max(x1 - x0, (y1 - y0) * this.camera.aspect, 800) * pad;
    const dist = span / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, this.camera.aspect) * 1.1;
    const t = this.controls.target, off = this.camera.position.clone().sub(t).normalize();
    t.copy(W((x0 + x1) / 2, (y0 + y1) / 2, 0));
    this.camera.position.copy(t.clone().add(off.multiplyScalar(Math.max(900, dist))));
    this.controls.update();
  }
  azimuth() { const v = this.camera.position.clone().sub(this.controls.target); return (Math.atan2(v.x, v.z) * 180) / Math.PI; }

  // ───────── relief
  buildTerrain() {
    const T = this.t, step = Math.min(window.innerWidth, window.innerHeight) < 700 ? 2 : 1;
    const nx = Math.floor(T.nx / step), ny = Math.floor(T.ny / step);
    const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
    const cLand = [hexColor('#c9c19a'), hexColor('#8d9b62'), hexColor('#6f7f4c'), hexColor('#a99d80'), hexColor('#e2dccd')];
    const cUrb = hexColor('#d7cfc2'), cSea0 = hexColor('#7cc6bd'), cSea1 = hexColor('#2c7da0'), cSea2 = hexColor('#0b2a4a');
    const tmp = new THREE.Color();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const si = i * step, sj = j * step, id = sj * T.nx + si, k = (j * nx + i) * 3;
      const x = T.x0 + (si + 0.5) * T.dx, y = T.y1 - (sj + 0.5) * T.dy;
      let h = T.h[id]; const c = T.cover[id];
      pos[k] = x; pos[k + 2] = -y;
      if (c === 0) {
        const d = Math.min(1, -h / 90);
        tmp.copy(cSea0).lerp(cSea1, Math.min(1, d * 1.8)); if (d > 0.5) tmp.lerp(cSea2, (d - 0.5) * 2);
        pos[k + 1] = Math.max(h, -400) * this.exag * 0.5 - 6;
      } else if (c === 3) { tmp.set('#e8e4da'); pos[k + 1] = 6 * this.exag; }
      else {
        const e = h / 600;
        const stops = [0, 0.08, 0.35, 0.7, 1];
        let s = 0; while (s < stops.length - 2 && e > stops[s + 1]) s++;
        tmp.copy(cLand[s]).lerp(cLand[s + 1], Math.min(1, (e - stops[s]) / (stops[s + 1] - stops[s])));
        if (c === 2) tmp.lerp(cUrb, 0.65);
        const n = Math.sin(x * 0.013) * Math.cos(y * 0.011) * 0.04;
        tmp.offsetHSL(0, 0, n);
        pos[k + 1] = Math.max(h, 2) * this.exag;
      }
      col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.groups.terrain.clear();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
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
    this.groups.coast.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#fdfbf5', transparent: true, opacity: 0.85 })));
  }

  // ───────── surface de l’eau colorée par la force du vent
  buildWater() {
    const T = this.t;
    this.waterCanvas = document.createElement('canvas');
    this.waterTex = new THREE.CanvasTexture(this.waterCanvas);
    this.waterTex.colorSpace = THREE.SRGBColorSpace; this.waterTex.magFilter = THREE.LinearFilter;
    const g = new THREE.PlaneGeometry(T.x1 - T.x0, T.y1 - T.y0);
    g.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshBasicMaterial({ map: this.waterTex, transparent: true, opacity: 0.78, depthWrite: false });
    const m = new THREE.Mesh(g, this.waterMat);
    m.position.set((T.x0 + T.x1) / 2, 0, -(T.y0 + T.y1) / 2);
    m.renderOrder = 2;
    this.groups.water.add(m);
    this.waterMesh = m;
    // calque « eau simple » quand la carte du vent est masquée
    this.plainMat = new THREE.MeshBasicMaterial({ color: '#3b8fc0', transparent: true, opacity: 0.35, depthWrite: false });
  }

  setField(field) {
    this.field = field;
    const T = this.t, c = this.waterCanvas, nx = field.nx, ny = field.ny;
    c.width = nx; c.height = ny;
    const ctx = c.getContext('2d'), img = ctx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = j * nx + i, k = id * 4;
      if (field.land[id]) { img.data[k + 3] = 0; continue; }
      const [r, g, b] = speedColor(field.spd[id]);
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
    const places = [
      ['Toulon', 43.1225, 5.930, 1], ['La Seyne-sur-Mer', 43.1000, 5.878, 1], ['Saint-Mandrier', 43.0770, 5.927, 1], ['Le Mourillon', 43.1075, 5.944, 2],
      ['Cap Cépet', 43.0676, 5.9465, 2], ['Cap Brun', 43.1020, 5.972, 2], ['Le Pradet', 43.1060, 6.020, 1], ['Carqueiranne', 43.0950, 6.073, 1],
      ['Les Sablettes', 43.0790, 5.893, 2], ['Tamaris', 43.0930, 5.900, 2], ['Mont Faron 584 m', 43.1497, 5.951, 3], ['Mont Coudon 702 m', 43.1609, 6.008, 3],
      ['Cap Sicié', 43.0460, 5.859, 2], ['Les Deux Frères', 43.0640, 5.8705, 2], ['Petite Rade', 43.1080, 5.912, 4], ['Grande Rade', 43.0930, 5.972, 4],
      ['Baie de la Garonne', 43.0915, 6.016, 4], ['Anse des Sablettes', 43.0730, 5.887, 4], ['Pointe Sainte-Marguerite', 43.1036, 5.992, 2], ['La Colle Noire', 43.0898, 6.0475, 3],
    ];
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
      const s = makeLabel(String(id), { circle: true, bg: m.color === '#1f9d55' ? '#1f9d55' : m.color === '#e03131' ? '#d63031' : '#f5c400', fg: m.color === '#f5c400' ? '#222' : '#fff', size: 26, border: ring || '#fff' }, a ? 30 : 22);
      s.position.copy(W(p.x, p.y, 70));
      s.userData.mark = id;
      g.add(s);
      const name = makeLabel(m.name + (a?.side ? (a.side === 'b' ? ' · bâbord' : ' · tribord') : ''), { bg: 'rgba(12,24,38,.7)', size: 22 }, a ? 16 : 13);
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
      gc.add(this.#ribbon([leg.from, leg.to], sel ? '#ff9f1c' : col, sel ? 5 : 3, { opacity: sel ? 1 : 0.85, y: 12 }));
      // flèche au milieu du bord
      const m = { x: (leg.from.x + leg.to.x) / 2, y: (leg.from.y + leg.to.y) / 2 };
      const s = makeLabel('➤', { bg: 'rgba(0,0,0,0)', fg: sel ? '#ff9f1c' : '#fff', size: 30 }, 16);
      s.material.rotation = -((leg.brg - 90) * Math.PI) / 180 + (this.azimuthRad ?? 0);
      s.userData.brg = leg.brg; s.userData.arrow = true;
      s.position.copy(W(m.x, m.y, 30)); gc.add(s);
      if (leg.route && (selectedLeg == null || sel)) {
        const pts = leg.route.path.map((p) => ({ x: p.x, y: p.y }));
        gr.add(this.#ribbon(pts, sel ? '#00e5ff' : '#7ae7ff', sel ? 3.5 : 2, { dash: 9, y: 14, opacity: 0.95 }));
      }
      if (sel && leg.type.id === 'pres') this.#laylines(leg, gr);
    });
    this.needRibbons = true;
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

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.controls.update();
    if (this.layers.particles) this.#stepParticles(dt);
    if (this.needRibbons) { this.needRibbons = false; this.#updateRibbons(); }
    // orientation des flèches selon l’azimut caméra (vue de dessus approximative)
    const az = (this.azimuth() * Math.PI) / 180;
    for (const g of [this.groups.course, this.groups.boat]) for (const o of g.children) {
      if (o.userData.arrow) o.material.rotation = o.userData.up ? -(o.userData.brg * Math.PI) / 180 + az : -((o.userData.brg - 90) * Math.PI) / 180 + az;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
