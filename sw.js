// Service worker : l’application et le modèle 3D sont disponibles hors réseau.
// Les prévisions (Open-Meteo, balises) passent toujours par le réseau ; l’app garde sa propre copie.
// Aucune activation automatique : une nouvelle version attend (état « waiting ») que la page envoie SKIP_WAITING,
// sur le geste de l’équipier et hors course (js/swupdate.js, js/racelock.js).
/* stamp:begin — bloc généré par tools/stamp.mjs, ne pas modifier à la main */
const BUILD = {"n":31,"date":"2026-10-20","label":"v31 · 20/10","note":"archive partagée : traces, rapports et vent du jour hors réseau","critical":false,"id":"8ef1646a8d"};
const VERSION = 'rade-' + BUILD.id;
const SHELL = ["./","data/basemap.jpg","data/coast.json","data/cover.bin","data/j80.pol","data/meta.json","data/seamask.png","data/terrain.bin","data/wx-snapshot.json","guide.html","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/logo.png","index.html","js/app.js","js/archheavy.js","js/archmerge.js","js/archsync.js","js/attach.js","js/beeper.js","js/courses.js","js/debrief.js","js/diag.js","js/events.js","js/gel.js","js/geo.js","js/help.js","js/icplaus.js","js/icread.js","js/j80.js","js/journal.js","js/markfit.js","js/marks.js","js/obs.js","js/polar-orc.js","js/polar.js","js/racelock.js","js/regates.js","js/regmarks.js","js/regstore.js","js/regview.js","js/reprise.js","js/router.js","js/scene3d.js","js/segments.js","js/startmode.js","js/status.js","js/swupdate.js","js/tactics.js","js/track.js","js/tuning.js","js/version.js","js/voice.js","js/wakelock.js","js/weather.js","js/wind.js","manifest.webmanifest","regles.html","styles.css","vendor/OrbitControls.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","vendor/qrcode.js","vendor/three.module.min.js"];
/* stamp:end */
self.addEventListener('install', (e) => {
  // précache de la version, sans s’activer soi-même (pas de skipWaiting ici)
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  const t = e.data && e.data.type;
  if (t === 'SKIP_WAITING') self.skipWaiting();
  else if (t === 'GET_BUILD' && e.source) e.source.postMessage({ type: 'BUILD', build: BUILD });
});
const inShell = (u) => SHELL.includes(u.pathname === '/' ? './' : u.pathname.slice(1));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  if (u.searchParams.has('acces')) return;          // lien personnel : toujours au réseau, le middleware pose le cookie
  // fichiers de l’app : toujours ceux de la version installée (cache d’abord), la page reste cohérente jusqu’à la mise à jour acceptée
  if (inShell(u)) { e.respondWith(caches.open(VERSION).then((c) => c.match(r, { ignoreSearch: true })).then((hit) => hit || fetch(r))); return; }
  // le reste (rapports, page d’accès…) : réseau d’abord, cache si hors ligne
  e.respondWith(fetch(r, { cache: 'no-cache' }).then((x) => {
    if (x.ok && !x.redirected) { const copy = x.clone(); caches.open(VERSION).then((c) => c.put(r, copy)); }
    return x;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((x) => x || caches.match('index.html'))));
});
