// Service worker : l’application et le modèle 3D sont disponibles hors réseau.
// Les prévisions (Open-Meteo, balises) passent toujours par le réseau ; l’app garde sa propre copie.
/* stamp:begin — bloc généré par tools/stamp.mjs, ne pas modifier à la main */
const BUILD = {"n":25,"date":"2026-10-19","label":"v25 · 19/10","note":"accès équipage","critical":false,"id":"e12dbfd1a0"};
const VERSION = 'rade-' + BUILD.id;
const SHELL = ["./","data/basemap.jpg","data/coast.json","data/cover.bin","data/j80.pol","data/meta.json","data/seamask.png","data/terrain.bin","data/wx-snapshot.json","guide.html","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/logo.png","index.html","js/app.js","js/courses.js","js/debrief.js","js/events.js","js/geo.js","js/help.js","js/j80.js","js/obs.js","js/polar-orc.js","js/polar.js","js/router.js","js/scene3d.js","js/startmode.js","js/tactics.js","js/track.js","js/tuning.js","js/version.js","js/voice.js","js/weather.js","js/wind.js","manifest.webmanifest","regles.html","styles.css","vendor/OrbitControls.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","vendor/qrcode.js","vendor/three.module.min.js"];
/* stamp:end */
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  // réseau d’abord (pour recevoir les mises à jour), cache si hors ligne
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok && !r.redirected) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
