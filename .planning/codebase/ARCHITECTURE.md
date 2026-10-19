---
last_mapped_commit: 7ca5ba6e5a21f8caf7a9640bf6acad4e08155e2d
last_mapped_at: 2026-10-19
---
<!-- refreshed: 2026-10-19 -->

# Architecture

**Analysis Date:** 2026-10-19

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    Browser (PWA, iPhone / desktop)                    │
│  index.html → js/app.js (state S, UI, orchestration)                  │
├───────────────┬──────────────────┬──────────────────┬────────────────┤
│ Forecast /    │ Local wind model │ Tactics / routing│ Live / capture │
│ Weather       │ js/wind.js       │ js/tactics.js    │ js/track.js    │
│ js/weather.js │ js/geo.js        │ js/router.js     │ js/startmode.js│
│               │                  │ js/polar.js      │ js/obs.js      │
├───────────────┴──────────────────┴──────────────────┴────────────────┤
│ 3D view js/scene3d.js (three.js, vendor/)   Courses js/courses.js     │
│ Debrief js/debrief.js   Help/guide js/help.js   Voice js/voice.js     │
└───────┬───────────────────────────────┬───────────────────────────────┘
        │ static files                  │ fetch POST (same origin)
        ▼                               ▼
┌──────────────────────────┐   ┌────────────────────────────────────────┐
│ Static assets            │   │ Vercel Functions (Node)                 │
│ data/*.bin, *.json,      │   │ api/voice.js, api/debrief.js,           │
│ data/j80.pol, basemap    │   │ api/rules.js (+ api/_rrs.js text)       │
│ styles.css, icons/       │   │ → OpenAI API (OPENAI_API_KEY env)        │
└──────────────────────────┘   └────────────────────────────────────────┘
        ▲
        │ every request passes through
┌──────────────────────────────────────────────────────────────────────┐
│ middleware.js (Vercel Edge): crew access cookie check, redirects      │
└──────────────────────────────────────────────────────────────────────┘
```

External data is fetched directly by the browser (Open-Meteo, Pioupiou / OpenWindMap, AWS terrain tiles); these calls bypass the Vercel functions.

## Pattern Overview

**Overall:** Static single-page PWA with a single orchestrating controller module and a set of plain ES modules that hold pure computation (no framework, no bundler, no build step).

**Key Characteristics:**
- No build step: browser loads ES modules directly via `<script type="module" src="js/app.js">` in `index.html`.
- Dependency graph is a shallow DAG rooted at `js/app.js`; the leaf modules `js/geo.js`, `js/polar-orc.js`, `js/courses.js` and `js/voice.js` (the `SR` helper) have no project-internal imports except `voice.js`/`courses.js` being consumed elsewhere.
- Heavy domain logic lives in pure functions (`route()` in `js/router.js`, `analyzeLeg()` in `js/tactics.js`, `WindField` in `js/wind.js`) that take inputs and return data; `js/app.js` wires them to the DOM.
- Application state is one mutable object `S` in `js/app.js` (default values in `DEF`), persisted to `localStorage` key `rade.state` via `persist()`.
- Only three serverless functions exist, and they are stateless: the client sends data and receives an interpretation. All computation of numbers stays client side ("L'app calcule tous les chiffres").
- Offline-first shell: `sw.js` precaches the generated `SHELL` list and serves it cache-first; other same-origin GET requests are network-first with cache fallback. A new version waits and is applied only on the crew member's gesture, never during a race (`js/swupdate.js`, `js/racelock.js`).

## Layers

**Entry / orchestration layer:**
- Purpose: bootstrap, global state, DOM binding, screen switching, timers, GPS mode.
- Location: `index.html`, `js/app.js` (1069 lines)
- Contains: `init()` (line ~63), `bindUI()` (~353), `bindSheet()` (~393), `renderX()` view functions (`renderBrief`, `renderCourse`, `renderStart`, `renderLive`, `renderLiveNav`, ...), `runAnalysis()` (~288), `startGps()` (~716), `startTimer()` (~697), `planRest()` (~802).
- Depends on: every `js/*.js` module, `vendor/qrcode.js` (global script loaded before app.js).
- Used by: nothing (top of the graph).

**Domain / computation layer (pure-ish modules):**
- Purpose: geography, wind field, polars, routing, tactics, track analysis, debrief maths.
- Location: `js/geo.js`, `js/wind.js`, `js/polar.js`, `js/polar-orc.js`, `js/router.js`, `js/tactics.js`, `js/track.js`, `js/obs.js`, `js/tuning.js`, `js/courses.js`, `js/startmode.js`, `js/debrief.js`, `js/j80.js`.
- Contains: coordinate transforms (`toXY`, `toLL`, `NM`, `bearingXY`, `distXY`) in `js/geo.js`; `WindField` and `speedColor` in `js/wind.js`; `boatSpeed` / `optimalAngles` / `spiMinTwa` in `js/polar.js`; `route()` isochrone router in `js/router.js`; `buildLegs`, `analyzeLeg`, `analyzeStart`, `rankCourses` in `js/tactics.js`; race data constants `MARKS`, `COURSES`, `LINE_PRESETS`, `FORBIDDEN_ZONE`, `DANGERS` in `js/courses.js`.
- Depends on: `js/geo.js` and `js/polar.js` heavily; `js/tactics.js` imports `route` from `js/router.js`.
- Used by: `js/app.js`, `js/debrief.js`, `js/startmode.js`, `js/scene3d.js`.

**Data acquisition layer:**
- Purpose: forecasts (multi-model, cached), consensus, marine state, live buoys.
- Location: `js/weather.js` (`fetchAll`, `cached`, `snapshot`, `consensus`, `fetchLive`, `MODELS`), `js/obs.js` (observed-wind calibration, `scoreModels`), `js/track.js` (GPS trace persistence in IndexedDB `rade-traces`).
- Depends on: `js/geo.js`; `js/obs.js` depends on `js/voice.js` for `SR` (speech recognition constructor).
- Used by: `js/app.js`.

**Presentation / rendering layer:**
- Purpose: 3D harbour scene, tactical overlays, help and guide dialogs, dictation UI.
- Location: `js/scene3d.js` (three.js scene, OrbitControls from `vendor/`), `js/j80.js` (J80 panel), `js/help.js` (tips, welcome, share sheet), `js/events.js` (event/PDF handling: `pdfText`, `parseIC`), `styles.css`, `guide.html`, `regles.html`, `acces.html`.
- Depends on: domain layer modules and `vendor/`.
- Used by: `js/app.js`.

**Server-side functions (Vercel, Node runtime):**
- Purpose: call OpenAI for language tasks only.
- Location: `api/voice.js` (dictated wind report to structured intent), `api/debrief.js` (race debrief prose from computed facts, `maxDuration` 60 s), `api/rules.js` (RRS rules referee, quotes verified against `api/_rrs.js`, `maxDuration` 60 s).
- Depends on: `openai` and `@vercel/functions` (declared in `package.json`); `api/rules.js` imports `api/_rrs.js`.
- Used by: `js/voice.js` and `js/debrief.js` / rules UI on the client via same-origin `fetch('/api/…')`.

**Edge access layer:**
- Purpose: restrict the whole site to crew members.
- Location: `middleware.js` (Vercel Edge middleware, `config.matcher` excludes `acces.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `rapports/`).
- Mechanism: a `?acces=` query parameter or `rt_acces` cookie is hashed (SHA-256) and looked up in a fixed table of member hashes; a match sets a 400-day cookie. Browser navigations without access redirect to `acces.html`; other requests get HTTP 401. Access codes and hashes are deliberately not reproduced in this document.

## Data Flow

### Primary Request Path (forecast to recommendation)

1. `init()` in `js/app.js` restores `S` from `localStorage` (`store.get('rade.state')`) and loads terrain (`Terrain`, `data/terrain.bin`, `data/cover.bin`, `data/meta.json`).
2. `refreshWeather()` calls `fetchAll()` in `js/weather.js` (direct network calls to forecast providers) and falls back to `data/wx-snapshot.json` offline.
3. `updateAll()` (`js/app.js` ~270) recomputes the wind field: `computeField(day, hour)` → `baseAt()` (interpolated forecast or manual `S.manual`) → `WindField.compute()` in `js/wind.js` with `localEffects`.
4. `scheduleAnalysis()` debounces (120 ms) into `runAnalysis()` (~288), which calls `buildLegs` / `analyzeLeg` / `analyzeStart` in `js/tactics.js`; those call `route()` in `js/router.js` using polars from `js/polar.js`.
5. Results go to the 3D scene (`Scene3D` in `js/scene3d.js`) and to panel renderers (`renderCourse`, `renderBrief`, `renderStart`).

### Observation / dictation path

1. User speaks; `js/voice.js` `listen()` uses the browser SpeechRecognition (`SR`).
2. `understand()` in `js/app.js` (~208) posts the text to `/api/voice`; the function returns a structured intent; the app computes the shift and stores it in `S.obs`.
3. `js/obs.js` `scoreModels()` ranks forecast models against observations; `refreshObs()` re-runs the field via `applyResiduals()`.

### Live / GPS path

1. `startGps()` (`js/app.js` ~716) watches position; `Recorder` in `js/track.js` appends fixes to IndexedDB.
2. `startTimer()` drives the start countdown; `js/startmode.js` `createStartMode()` runs the full-screen start mode.
3. After the race, `analyzeTrack()` (`js/track.js`) and `js/debrief.js` `analyze()` / `buildReport()` compute facts; `ask()` posts facts to `/api/debrief` for prose.

### Service worker / install path

1. `index.html` links `manifest.webmanifest`; `sw.js` precaches the generated `SHELL` under cache name `VERSION` (`rade-<hash>`, derived from the content by `tools/stamp.mjs`).
2. Fetch handler: files of the `SHELL` come from the cache first; other same-origin GET requests are network-first, successful responses are stored, then the cache, then `index.html` as fallback. Requests whose path contains `/api/` are not intercepted.

**State Management:**
- One module-level object `S` in `js/app.js`, seeded from `DEF`, with `persist()` writing only keys present in `DEF`.
- Derived caches are module-level `let`s (`series`, `ranking`, `F` for the `WindField`, `anaTimer`, `actx` for AudioContext, `timer`, `sheet`).
- Track data is in IndexedDB; no server-side state exists.

## Key Abstractions

**WindField:**
- Purpose: local wind over the harbour from a base forecast plus terrain corrections.
- Examples: `js/wind.js` (class `WindField`, `speedColor`).
- Pattern: construct with terrain, call `compute(base, opts)` to get a per-cell field.

**Polar:**
- Purpose: boat speed for true wind speed and angle, with optimal VMG angles.
- Examples: `js/polar.js` (`boatSpeed`, `optimalAngles`, `spiMinTwa`, `setPolar`, `parsePolar`), `js/polar-orc.js` (ORC table), `data/j80.pol` (built by `tools/build_polar.mjs`).
- Pattern: table lookup with interpolation; a personal polar can replace the default via `setPolar()`.

**Course / marks:**
- Purpose: named race marks, courses, start line presets, forbidden zones and dangers.
- Examples: `js/courses.js` (`MARKS`, `COURSES`, `LINE_PRESETS`, `FORBIDDEN_ZONE`, `DANGERS`, `PLACES`, `IC`).
- Pattern: plain exported constant tables; positions are lat/lon, converted with `toXY()`.

**Route:**
- Purpose: isochrone routing between two points in the wind field, avoiding land and forbidden zones.
- Examples: `js/router.js` `route(from, to, field, opts)`.
- Pattern: pure function, returns `null` for trivially short legs (< 20 m); tack and gybe losses are options.

**Event store:**
- Purpose: saved race events (IC documents, PDF text).
- Examples: `js/events.js` (`eventsState`, `currentEvent`, `upsertEvent`, `removeEvent`, `setCurrent`).
- Pattern: state held in module object, persisted by the caller.

## Entry Points

**Web app:**
- Location: `index.html` → `js/app.js`.
- Triggers: browser load or home-screen launch (PWA `manifest.webmanifest`).
- Responsibilities: everything user-facing.

**Service worker:**
- Location: `sw.js`, served from the root.
- Triggers: registration by the page (registration code lives in `js/app.js` or `index.html`).
- Responsibilities: offline shell and cache versioning.

**Vercel edge middleware:**
- Location: `middleware.js`.
- Triggers: every request not excluded by its matcher.

**Vercel functions:**
- Location: `api/voice.js`, `api/debrief.js`, `api/rules.js`.
- Triggers: same-origin `POST /api/...` from the client.

**Offline data builders (not runtime):**
- Location: `tools/build_terrain.py`, `tools/build_basemap.py`, `tools/build_polar.mjs`, `tools/snapshot_weather.py`.
- Triggers: run manually to regenerate `data/`.

## Architectural Constraints

- **Threading:** single-threaded main thread. Timers use `setInterval` (`startTimer`) and `setTimeout` (debounced analysis); no Web Workers are used.
- **Global state:** `js/app.js` holds the mutable global `S` and several module-level `let` caches. `localStorage` key `rade.state` and IndexedDB database `rade-traces` are shared storage.
- **Circular imports:** none observed in the module list; `js/tactics.js` depends on `js/router.js`, which depends on `js/polar.js` and `js/geo.js` only.
- **Build:** no build step for the app. `npm run stamp` regenerates the `SHELL` list and the version (`sw.js` block, `js/version.js`) from the files on disk, `npm run release` publishes a new version (`release.json`), and `npm run check` refuses stale generated files or failing tests. Operating rule: no production deployment within 48 h before a regatta or during a race, except a critical fix applied off the water.
- **Deployment headers:** `vercel.json` forces `no-cache` on the HTML, JS, CSS, data and service worker.
- **Serverless timeout:** `api/debrief.js` and `api/rules.js` set `maxDuration` 60 s in `vercel.json`.

## Anti-Patterns

### Monolithic controller

**What happens:** `js/app.js` is 1069 lines and contains state, DOM, rendering, GPS, timers, voice flow and debrief orchestration.
**Why it's wrong here:** every change touches the same global `S`; there is no test seam for the controller.
**Do this instead:** keep new computation in its own `js/*.js` module with exported pure functions (as `js/router.js` and `js/tactics.js` do), and call it from `js/app.js` with a thin renderer.

### Manually duplicated asset list (resolved in phase 1)

**What happened:** the `SHELL` array in `sw.js` and the version strings were edited by hand.
**Now:** `tools/stamp.mjs` generates the `SHELL` list and the version; after adding or changing a file, run `npm run stamp` (and `npm run release -- "ce qui change"` for a new version). `npm run check` fails if the generated files are stale. Never edit the generated block of `sw.js` or `js/version.js` by hand.

### Duplicated date helpers

**What happens:** `today()`, `addDays()` and `dayName()` are defined in `js/app.js`, while `js/debrief.js` and `js/tactics.js` format dates on their own.
**Why it's wrong here:** date formatting can drift between screens.
**Do this instead:** reuse the helpers from `js/geo.js` or move them to a shared module when a new consumer needs them.

## Error Handling

**Strategy:** graceful degradation. Storage and audio calls are wrapped in `try`/`catch` (`store` helper in `js/app.js`, `audioInit()`), and network-dependent features fall back to snapshots (`data/wx-snapshot.json`) or to a manual wind.

**Patterns:**
- `store.get`/`store.set` swallow storage errors and return defaults.
- The service worker serves cached content when the network fails.
- Serverless functions create the OpenAI client lazily so a missing key fails per request, not at module load.
- `api/rules.js` checks every quoted English passage against `api/_rrs.js` before showing it.

## Cross-Cutting Concerns

**Logging:** `console` only; no logging library. Server logs appear in Vercel function logs (`srv.log` at repo root is a local server log and is not part of the app).
**Validation:** manual checks in `js/app.js` (e.g. `parseIC`, `readForm` in `js/events.js`); server-side function prompts constrain output format.
**Authentication:** crew access only, via `middleware.js` cookie and hash table; no user accounts.
**Internationalisation:** UI strings are French, written inline in the modules.

---

*Architecture analysis: 2026-10-19*
