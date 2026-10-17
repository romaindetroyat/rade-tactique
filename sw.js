// Service worker : l’application et le modèle 3D sont disponibles hors réseau.
// Les prévisions (Open-Meteo, balises) passent toujours par le réseau ; l’app garde sa propre copie.
const VERSION = 'rade-v6';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/geo.js', 'js/wind.js', 'js/scene3d.js', 'js/courses.js', 'js/weather.js', 'js/tactics.js', 'js/polar.js', 'js/router.js', 'js/j80.js', 'js/tuning.js', 'js/polar-orc.js', 'js/obs.js', 'js/help.js', 'js/track.js', 'js/events.js', 'js/voice.js',
  'vendor/three.module.min.js', 'vendor/OrbitControls.js', 'vendor/qrcode.js',
  'data/meta.json', 'data/terrain.bin', 'data/cover.bin', 'data/coast.json', 'data/basemap.jpg', 'data/seamask.png', 'data/j80.pol', 'data/wx-snapshot.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // réseau d’abord (pour recevoir les mises à jour), cache si hors ligne
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
