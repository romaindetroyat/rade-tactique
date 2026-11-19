// Service worker : l’application et le modèle 3D sont disponibles hors réseau.
// Les prévisions (Open-Meteo, balises) passent toujours par le réseau ; l’app garde sa propre copie.
// Aucune activation automatique : une nouvelle version attend (état « waiting ») que la page envoie SKIP_WAITING,
// sur le geste de l’équipier et hors course (js/swupdate.js, js/racelock.js).
// Plans d’eau téléchargés (D-04) : les fichiers data/<id>.* hors liste sont écrits par la page, vérifiés, dans des caches « rade-venue-<id>-<pack> »
// (js/pack.js) ; le worker les sert depuis ces caches, ne les copie jamais dans le cache de version et son activation ne les supprime jamais.
/* stamp:begin — bloc généré par tools/stamp.mjs, ne pas modifier à la main */
const BUILD = {"n":42,"date":"2026-11-09","label":"v42 · 09/11","note":"modifier une manche de régate","critical":false,"id":"d894d94a51"};
const VERSION = 'rade-' + BUILD.id;
const SHELL = ["./","data/basemap.jpg","data/coast.json","data/cover.bin","data/j80.pol","data/meta.json","data/seamask.png","data/terrain.bin","data/venues.json","data/wx-snapshot.json","guide.html","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/logo.png","index.html","js/app.js","js/archheavy.js","js/archmerge.js","js/archsync.js","js/attach.js","js/banane.js","js/beeper.js","js/courant.js","js/courses.js","js/debrief.js","js/diag.js","js/events.js","js/gel.js","js/geo.js","js/help.js","js/icplaus.js","js/icread.js","js/j80.js","js/journal.js","js/lieu.js","js/maree.js","js/markfit.js","js/marks.js","js/obs.js","js/pack.js","js/polar-orc.js","js/polar.js","js/racelock.js","js/regates.js","js/regles.js","js/regmarks.js","js/regstore.js","js/regview.js","js/reprise.js","js/router.js","js/scene3d.js","js/segments.js","js/startmode.js","js/status.js","js/swupdate.js","js/tactics.js","js/track.js","js/tuning.js","js/venue-brest.js","js/venues.js","js/version.js","js/voice.js","js/wakelock.js","js/weather.js","js/wind.js","manifest.webmanifest","regles.html","styles.css","vendor/OrbitControls.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","vendor/qrcode.js","vendor/three.module.min.js"];
/* stamp:end */
self.addEventListener('install', (e) => {
  // précache de la version, sans s’activer soi-même (pas de skipWaiting ici)
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});
const VENUE_PREFIX = 'rade-venue-';
self.addEventListener('activate', (e) => {
  // anciens caches de version supprimés ; les plans d’eau téléchargés (rade-venue-*) restent
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && !k.startsWith(VENUE_PREFIX)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  const t = e.data && e.data.type;
  if (t === 'SKIP_WAITING') self.skipWaiting();
  else if (t === 'GET_BUILD' && e.source) e.source.postMessage({ type: 'BUILD', build: BUILD });
});
const inShell = (u) => SHELL.includes(u.pathname === '/' ? './' : u.pathname.slice(1));
// fichier d’un plan d’eau téléchargé : data/<id>.<suite> hors de la liste (Toulon est dans la liste) ; rend <id>, sinon null
const venueOf = (u) => { const m = /^\/data\/([a-z0-9-]+)\.[^/]+$/.exec(u.pathname); return m ? m[1] : null; };
// cherché dans les caches de ce plan d’eau, du plus ancien au plus récent (un jeu complet sert avant un téléchargement en cours) ;
// à défaut, le réseau, sans copie ; hors réseau, l’échec est rendu tel quel (ce n’est pas une page : jamais index.html)
const fromVenue = async (r, id) => {
  try {
    for (const k of await caches.keys()) {
      if (!k.startsWith(VENUE_PREFIX + id + '-')) continue;
      const hit = await (await caches.open(k)).match(r, { ignoreSearch: true });
      if (hit) return hit;
    }
  } catch { /* stockage illisible : le réseau prend le relais */ }
  return fetch(r);
};
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  if (u.searchParams.has('acces')) return;          // lien personnel : toujours au réseau, le middleware pose le cookie
  // fichiers de l’app : toujours ceux de la version installée (cache d’abord), la page reste cohérente jusqu’à la mise à jour acceptée
  if (inShell(u)) { e.respondWith(caches.open(VERSION).then((c) => c.match(r, { ignoreSearch: true })).then((hit) => hit || fetch(r))); return; }
  const venue = venueOf(u);
  if (venue) {
    if (u.searchParams.has('pack')) return;         // téléchargement du pack par la page (js/pack.js) : toujours au réseau, jamais copié ni servi d’un cache
    e.respondWith(fromVenue(r, venue)); return;
  }
  // le reste (rapports, page d’accès…) : réseau d’abord, cache si hors ligne
  e.respondWith(fetch(r, { cache: 'no-cache' }).then((x) => {
    if (x.ok && !x.redirected) { const copy = x.clone(); caches.open(VERSION).then((c) => c.put(r, copy)); }
    return x;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((x) => x || caches.match('index.html'))));
});
