<!-- GSD:project-start source:PROJECT.md -->

## Project

**Rade Tactique**

Rade Tactique est une application web installable (PWA) pour l'équipage du J80 *Naos* (Romain, Teiva Rameil, Thibaud Delaunay) qui régate dans la rade de Toulon, surtout aux épreuves du CVAT. Elle prépare la régate (vent local en 3D avec effets de relief, parcours, routage et tactique), accompagne la course (mode départ plein écran, GPS, trace) et aide à progresser après (débrief automatique depuis le GPX, analyse face à la polaire, règles de course et arbitre IA). L'accès est réservé à l'équipage.

**Core Value:** Le jour de la régate, l'équipage peut ouvrir l'épreuve, s'en servir en mer sans que rien ne lâche, et retrouver ensuite le débrief : des conseils et des chiffres justes, fiables sur l'eau, et partagés par tout l'équipage.

### Constraints

- **Échéance** : prochaine régate CVAT dans 2 à 3 semaines (vers le 7-9 novembre 2026) — la fiabilité en mer et l'ouverture de régate passent en premier
- **Plateforme** : PWA, aussi soignée sur iPhone (Safari et app installée) que sur ordinateur ; doit fonctionner hors réseau en mer
- **Hébergement** : Vercel (site statique, fonctions Node, middleware) — en place ; tout stockage partagé doit rester compatible
- **Technique** : JavaScript sans framework ni build, Three.js vendorisé ; introduire des outils (tests, script de vérification) sans alourdir le chargement de l'app
- **IA** : OpenAI uniquement (pas l'API Anthropic) pour les fonctions de l'app, modèle `gpt-5.5`
- **Langue** : interface et documents d'équipage en français
- **Accès** : réservé aux codes personnels de l'équipage de Naos ; toute nouvelle donnée partagée doit rester derrière ce contrôle
- **Vent** : plage utile jusqu'à 25 nœuds

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ES modules, browser, no bundler) - all front-end code: `js/*.js` (e.g. `js/app.js`, `js/scene3d.js`, `js/wind.js`, `js/weather.js`)
- JavaScript (Node, ES modules, `"type": "module"` in `package.json`) - Vercel serverless functions: `api/voice.js`, `api/debrief.js`, `api/rules.js`, `api/_rrs.js` (RRS text as a JS string export)
- Edge middleware (JavaScript, Vercel Routing Middleware) - `middleware.js`
- HTML5 / CSS3 - `index.html`, `guide.html`, `regles.html`, `acces.html`, `rapports/coupe-snpm-2026.html`, `styles.css`
- Python 3 - offline data-build scripts only, not deployed: `tools/build_terrain.py`, `tools/build_basemap.py` (uses numpy, PIL), `tools/snapshot_weather.py` (uses `curl` via subprocess)
- Node ESM script - `tools/build_polar.mjs` (generates `data/j80.pol`)
- Markdown - `docs/J80-polaires-reglages.md`, `README.md`

## Runtime

- Modern browsers with ES modules, Service Worker, Geolocation, Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` in `js/voice.js`), `speechSynthesis`, IndexedDB (`js/track.js`), localStorage (`js/app.js`, `js/weather.js`, `js/events.js`, `js/help.js`)
- Target platforms: iPhone Safari (Add to Home Screen), desktop browsers. No framework.
- Node.js serverless functions on Vercel (`api/*.js`). The Node version is not pinned (no `engines` field in `package.json`).
- Vercel Routing Middleware (`middleware.js`, imports `next` from `@vercel/functions`).
- npm (implied by `package.json`); only two runtime dependencies are declared.
- Lockfile: **missing** (no `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock` in the repository). Installed versions are not reproducible from the repository.

## Frameworks

- None on the client: hand-written vanilla JavaScript modules and HTML templates with template strings.
- Three.js r170 (vendored, `vendor/three.module.min.js`, header `Copyright 2010-2024`, REVISION "170") - 3D model of the Toulon roadstead in `js/scene3d.js`
- Three.js `OrbitControls` (vendored, `vendor/OrbitControls.js`) - camera controls, imported in `js/scene3d.js`
- pdf.js 3.11.174 (vendored, `vendor/pdf.min.js` and `vendor/pdf.worker.min.js`; the « 3.32.2 » found inside the worker is the version of the core-js bundled with it, not of pdf.js) - PDF text extraction for the Cahier de Parcours / instructions de course, loaded lazily by `pdfText()` in `js/events.js`. `getDocument` must always receive `isEvalSupported: false` (`PDF_OPTIONS` in `js/events.js`, mandatory: CVE-2024-4367)
- qrcode.js 1.1 (vendored, `vendor/qrcode.js`, loaded by `<script>` in `index.html`) - QR code generation for sharing
- `node:test` + `linkedom` (devDependency), tests in `tests/*.test.mjs`. `npm test` runs them; `npm run check` first verifies that the generated files (`sw.js` block, `js/version.js`) are up to date, then runs `npm test`.
- No build step for the app itself (README: « pas d’étape de build pour l’app »). A check runs before each deployment: `npm run gate` (`npm ci` then `npm run gate` on Vercel once the gate is activated in `vercel.json`). Local testing with `python3 -m http.server`.
- Offline data generation (not part of the deploy):

## Key Dependencies

- `openai` `^7.36.0` - OpenAI SDK; used in `api/voice.js`, `api/debrief.js`, `api/rules.js` via `client.responses.create(...)` (Responses API with `json_schema` structured output, `strict: true`)
- `@vercel/functions` `^3.10.1` - provides `next()` for `middleware.js`
- Three.js r170 - `vendor/LICENSE-three.txt` (MIT)
- pdf.js - `vendor/LICENSE-pdfjs.txt` (Apache-2.0)
- qrcode.js 1.1 - no separate licence file
- Default model `gpt-5.5` (overridable with `OPENAI_MODEL`) in `api/voice.js`, `api/debrief.js`, `api/rules.js`. Reasoning effort: `low` (voice, rules), `medium` (debrief).

## Configuration

- `OPENAI_API_KEY` - required by all three `api/` functions; without it they answer HTTP 503 `no_key`. Set on Vercel.
- `OPENAI_MODEL` - optional, defaults to `gpt-5.5`.
- Access control hashes are stored in `middleware.js` as a constant table (SHA-256 digests of personal crew codes), not as environment variables. Do not copy them into documentation.
- Response headers `Cache-Control: no-cache` for `/`, `/index.html`, `/sw.js`, `/styles.css`, `/js/:path*`, `/data/:path*`.
- Function limits: `api/debrief.js` and `api/rules.js` have `maxDuration: 60` seconds. `api/voice.js` uses the default.
- `manifest.webmanifest` - `lang: "fr"`, `display: "standalone"`, `orientation: "any"`, `theme_color` and `background_color` `#0c2236`, icons in `icons/` (192, 512, maskable 512, apple-touch).
- `sw.js` - service worker. The block between `stamp:begin` and `stamp:end` (`BUILD`, `VERSION = 'rade-' + BUILD.id`, `SHELL`) and `js/version.js` are generated by `tools/stamp.mjs` (`npm run stamp`) and never edited by hand; the cache name follows the content hash. The shell (app files, vendor files, `data/` files, icons) is served cache-first; a new version is applied only on the crew member's gesture and never during a race (`js/swupdate.js`, `js/racelock.js`). Other same-origin GET requests are network-first; `/api/` requests are not handled.
- Operating rule: no production deployment within 48 h before a regatta or during a race, except a critical fix applied off the water. Commands: `npm run release -- "what changes" [--critical]` for a new version, `npm run stamp` after any change to the app. Emergency bypass: `RT_GATE_BYPASS=1` in the Vercel project variables for one redeployment (tests skipped, version check kept), then remove it. The Coupe SNPM reference changes only with Romain's agreement (D-12).
- Local storage keys: `rade.wx.v1` (forecast cache), `rade.welcome` (first-visit flag), plus the keys in `js/app.js` and `js/events.js`.
- IndexedDB database used by `js/track.js` (GPS track recording).
- `meta.json` (grid extent 5.80-6.10 E, 43.00-43.18 N, 814 x 667 cells, units dm)
- `terrain.bin` (Int16 altitude), `cover.bin` (Uint8 land/sea/urban/dike), `coast.json`, `basemap.jpg`, `seamask.png`, `j80.pol` (polar table), `wx-snapshot.json` (offline forecast fallback, about the forecast fetched by `tools/snapshot_weather.py`)
- `cover.bin` and `terrain.bin` must be regenerated together with `meta.json` by the tools.

## Platform Requirements

- Any static HTTP server (`python3 -m http.server`) for the client.
- Python 3 with numpy and Pillow for the data-build tools (not needed to run the app).
- Node.js and npm to install `openai` and `@vercel/functions` for the Vercel functions when running them locally (for example with `vercel dev`).
- HTTPS is required for geolocation, service worker and PWA install (the README recommends Vercel, Netlify, Cloudflare Pages or GitHub Pages).
- Vercel: static hosting of the repository root, Node serverless functions in `api/`, Routing Middleware `middleware.js`. The whole repository root is served; `middleware.js` gates everything except `acces.html`, `manifest.webmanifest`, `sw.js`, `icons/` and `rapports/`.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Scope and Language Context

- Static PWA: vanilla JavaScript ES modules in the browser (`js/*.js`), no bundler, no build step, no TypeScript.
- Serverless functions for Vercel in `api/*.js` (Node, ES modules, `export default async function handler(req, res)`).
- Edge middleware in `middleware.js` (Vercel `next()` / `Response` API).
- Service worker in `sw.js` (classic script, not a module).
- Python and Node build scripts in `tools/` (`build_terrain.py`, `build_basemap.py`, `snapshot_weather.py`, `build_polar.mjs`).
- `package.json` sets `"type": "module"`; the only runtime dependencies are `openai` and `@vercel/functions` (used by `api/` and `middleware.js` only).
- UI strings, code comments and most identifiers' documentation are in French. Identifiers in code are mostly short English/French mixes (`S`, `T`, `F`, `series`, `resid`, `lineBrg`).

## Naming Patterns

- Lowercase, single word or kebab-case for multi-word names: `js/app.js`, `js/startmode.js`, `js/polar-orc.js`, `api/debrief.js`, `api/_rrs.js`.
- Leading underscore for a non-endpoint helper inside `api/` (`api/_rrs.js` holds the RRS text constant and is not a route).
- HTML pages at root, lowercase: `index.html`, `guide.html`, `regles.html`, `acces.html`.
- Data artifacts in `data/` use descriptive names (`terrain.bin`, `coast.json`, `j80.pol`, `wx-snapshot.json`).
- Python tools use snake_case (`tools/build_basemap.py`); Node tool uses snake_case with `.mjs` (`tools/build_polar.mjs`).
- camelCase for everything: `refreshWeather`, `refreshObs`, `baseAt`, `seriesIndex`, `selectedModel`, `dayObs`, `buildLegs`, `analyzeLeg`.
- Short arrow helpers defined at module top for DOM and formatting, e.g. in `js/app.js`:
- Exported geo/format helpers keep short names: `toXY`, `toLL`, `norm360`, `norm180`, `bearingXY`, `distXY`, `fmtBrg`, `fmtNm`, `cardinal` (`js/geo.js`).
- Handler functions for DOM events are named or inline arrows inside `bindUI()` (`js/app.js`).
- `const` by default; `let` only for reassigned module state. Example module state block in `js/app.js`: `let T, F, scene, data = null, series = [], live = [], ...`.
- Single-letter names are used for short-lived locals and for the main state objects (`S` = persisted UI state, `T` = terrain, `F` = wind field, `P` = points, `h` for hour, `o` for observation). Do not rename these in patches; they are referenced across long functions.
- Element references are fetched at the call site with `$('#id')`, not cached in globals (exceptions exist; keep local).
- Object keys in state use short camelCase: `courseId`, `cls`, `laps`, `wlNm`, `startTime`, `linePreset`, `lineBrg`, `localFx`, `modelSel`.
- Classes are used only for stateful subsystems: `Terrain` (`js/geo.js`), `WindField` (`js/wind.js`), `Scene3D` (`js/scene3d.js`), `Recorder` (`js/track.js`). Pure logic is plain functions.
- No TypeScript, no JSDoc type annotations; document shapes in comments (`// point : [t (ms), lat, lon, sog (nd), cog (°), précision (m)]` in `js/track.js`).
- Module-level `UPPER_SNAKE_CASE` for configuration tables and fixed catalogs: `MARKS`, `COURSES`, `LINE_PRESETS`, `FORBIDDEN_ZONE`, `DANGERS` (`js/courses.js`), `EQUIPAGE` and `COOKIE` (`middleware.js`), `BUILD` (`js/version.js`), `SHELL` and `VERSION` (`sw.js`, generated block), `MODEL`, `SYSTEM`, `SCHEMA`, `CVAT` (`api/*.js`).
- Storage keys are namespaced strings: `'rade.state'`, `'rade.events.v1'`, `'rade-traces'` (IndexedDB), cache `rade-<hash>` (`sw.js`, name derived from the content hash by `tools/stamp.mjs`). Bump the storage-key suffix when the persisted shape changes.
- The app version is `BUILD` in `js/version.js`, generated by `tools/stamp.mjs` from `release.json` (nothing to align by hand). `npm run release -- "what changes" [--critical]` publishes a new version; `npm run stamp` refreshes the generated files after any change to the app.

## Code Style

- No formatter configured (no `.prettierrc`, no `.editorconfig`). Observed style is consistent enough to follow by hand:
- Section dividers are used in long files with box-drawing characters:
- None configured. There is no ESLint, Biome or Prettier config and no lint script in `package.json`.
- The pre-deployment gate is `npm run check` (generated files up to date, then `npm test`). For a quick syntax check: `node --check <file>` on each changed `.js` file (ES modules: use `node --check --input-type=module < file` if the file uses `import` and the `.js` extension is not under a `"type": "module"` package; the root `package.json` already sets `"type": "module"`).
- Use the typographic apostrophe `’` in UI strings and French prose inside JS strings (`'l’app'`, `'ce fichier n’est pas un GPX lisible'`, `'Hors ligne — prévisions du …'`). Mixed usage exists: the ASCII apostrophe appears in code strings written in the same file. Match the surrounding strings.
- Use the guillemets-free French style in messages; em dash `—` and middle dot `·` are used as separators in status text.
- Prompts in `api/*.js` are written in French with the typographic apostrophe `'`/`’` as in the surrounding text; quoted English RRS citations are kept verbatim.

## Import Organization

- Named exports for almost everything in `js/`; `export default` only for API handlers, the RRS text module (`api/_rrs.js`) and the middleware.
- Re-exports are not used; each module exports what it defines.
- `js/app.js` exports nothing and is imported by no other module (it is the entry point); the version comes from `js/version.js` (`BUILD`).

## Error Handling

- Fail soft and keep the UI usable. Wrap optional I/O in `try { … } catch { … }` with a comment or a fallback value:
- Use the parameterless `catch {` (optional catch binding) by default; use `catch (e)` only when the error is shown or reported.
- Throw `new Error('message in French')` only in parsers and loaders whose caller shows the message: `js/polar.js` (`'Fichier polaire trop court'`), `js/track.js` (`'ce fichier n’est pas un GPX lisible'`), `js/weather.js` (`` `HTTP ${r.status}` ``), `js/debrief.js` (`'trace trop courte'`).
- Degrade to cached/offline data instead of raising. Pattern in `refreshWeather()` (`js/app.js`): on failure, fall back to `snapshot()` and set a French status message with `status(...)`.
- Top-level bootstrap failures are shown in the splash screen with `esc(e.message)` and logged with `console.error(e)` (the only `console` call in `js/`).
- Always escape text inserted with `innerHTML` through `esc()` (79 call sites use it; 35 `innerHTML` assignments exist). Prefer `textContent` for plain text (`toast` in `js/app.js` does this).
- Validate the request shape first and return early with a status code and a JSON error object:
- Create the OpenAI client lazily inside the `try` block (`client ??= new OpenAI();`) so a missing key does not crash module load.
- Map SDK errors to HTTP status in the `catch`:
- Bound all user input before sending it to the model: `.slice(0, 1500)` for questions and history items, `.slice(0, 60000)` for JSON facts (`api/rules.js`, `api/debrief.js`).
- Model output is constrained with a strict JSON Schema (`text.format: { type: 'json_schema', strict: true, schema: SCHEMA }`) and `additionalProperties: false` on every object. Keep this pattern for any new endpoint.
- Factual claims from the model are verified mechanically: `api/rules.js` checks each quoted English citation against the official text (`verbatim()` with `norm()`) before showing it.
- Middleware returns `401` JSON for `/api/*` and a redirect to `/acces.html` for HTML navigation (`middleware.js`). Responses that must not be cached carry `Cache-Control: no-store`.
- Network-first with cache fallback for same-origin GET requests that are not under `/api/`. Errors fall back to `caches.match(...)` and then to `index.html`.

## Logging

- No logging framework. Browser code has no `console.log`; the single `console.error(e)` is in the `init()` catch of `js/app.js`.
- Server code has no logging statements; errors are returned in the HTTP response body.
- User-visible feedback goes through `toast(msg)` (`js/app.js`, auto-hides after 4.5 s) or the `status(msg)` line in the header.

## Comments

- Explain intent, domain rules, and non-obvious constraints, in French. Examples:
- Module header comment (one to three lines, French) at the top of every file describing purpose and data flow. Keep this for new modules, e.g. `// Routage par isochrones d’un J80 entre deux points …` (`js/router.js`).
- Domain formulas and units are annotated inline: `const KN = 1852 / 3600; // m/s par nœud`.
- Do not add comments that restate the code.

## Function Design

- Positional for two or three values (`distXY(a, b)`, `bearingXY(a, b)`, `route(from, to, field, opts)`).
- Options objects with defaults for optional knobs: `route(from, to, field, opts = {})` destructures `{ terrain, forbidden = [], tackLoss = 9, gybeLoss = 6, perf = 1 }` (`js/router.js`).
- Plain objects and arrays. Return `null` for "not found / not available" (`route` returns `null` when the trip is shorter than 20 m; `listTracks` maps stored records to summaries).
- Async I/O returns promises; use `async`/`await` with `Promise.all` for parallel fetches (`Terrain.load`, `js/geo.js`).

## Module Design

## Patterns to Follow for New Code

- New browser module: `js/<name>.js`, header comment in French, named exports, and imported from `js/app.js`; then run `npm run stamp` (it adds the module to the offline `SHELL` and refreshes the version). Never edit `sw.js` or `js/version.js` by hand.
- New API route: `api/<name>.js` with `export default async function handler(req, res)`, `POST`-only check, `process.env.OPENAI_MODEL || 'gpt-5.5'` default, strict JSON Schema, and a `maxDuration` entry in `vercel.json` `functions`.
- New UI text: French, with `’` apostrophes and `—`/`·` separators as in the existing strings. Escape with `esc()` before any `innerHTML`.
- Never commit secrets. The only secrets are environment variables (`OPENAI_API_KEY`, `OPENAI_MODEL`) and the hashed crew access codes in `middleware.js`. Do not paste codes, hashes or keys into code, comments, docs or reports.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Pattern Overview

- No build step: browser loads ES modules directly via `<script type="module" src="js/app.js">` in `index.html`.
- Dependency graph is a shallow DAG rooted at `js/app.js`; the leaf modules `js/geo.js`, `js/polar-orc.js`, `js/courses.js` and `js/voice.js` (the `SR` helper) have no project-internal imports except `voice.js`/`courses.js` being consumed elsewhere.
- Heavy domain logic lives in pure functions (`route()` in `js/router.js`, `analyzeLeg()` in `js/tactics.js`, `WindField` in `js/wind.js`) that take inputs and return data; `js/app.js` wires them to the DOM.
- Application state is one mutable object `S` in `js/app.js` (default values in `DEF`), persisted to `localStorage` key `rade.state` via `persist()`.
- Only three serverless functions exist, and they are stateless: the client sends data and receives an interpretation. All computation of numbers stays client side ("L'app calcule tous les chiffres").
- Offline-first shell: `sw.js` precaches the generated `SHELL` list and serves it cache-first; other same-origin GET requests are network-first with cache fallback. A new version waits and is applied only on the crew member's gesture, never during a race (`js/swupdate.js`, `js/racelock.js`).

## Layers

- Purpose: bootstrap, global state, DOM binding, screen switching, timers, GPS mode.
- Location: `index.html`, `js/app.js` (1069 lines)
- Contains: `init()` (line ~63), `bindUI()` (~353), `bindSheet()` (~393), `renderX()` view functions (`renderBrief`, `renderCourse`, `renderStart`, `renderLive`, `renderLiveNav`, ...), `runAnalysis()` (~288), `startGps()` (~716), `startTimer()` (~697), `planRest()` (~802).
- Depends on: every `js/*.js` module, `vendor/qrcode.js` (global script loaded before app.js).
- Used by: nothing (top of the graph).
- Purpose: geography, wind field, polars, routing, tactics, track analysis, debrief maths.
- Location: `js/geo.js`, `js/wind.js`, `js/polar.js`, `js/polar-orc.js`, `js/router.js`, `js/tactics.js`, `js/track.js`, `js/obs.js`, `js/tuning.js`, `js/courses.js`, `js/startmode.js`, `js/debrief.js`, `js/j80.js`.
- Contains: coordinate transforms (`toXY`, `toLL`, `NM`, `bearingXY`, `distXY`) in `js/geo.js`; `WindField` and `speedColor` in `js/wind.js`; `boatSpeed` / `optimalAngles` / `spiMinTwa` in `js/polar.js`; `route()` isochrone router in `js/router.js`; `buildLegs`, `analyzeLeg`, `analyzeStart`, `rankCourses` in `js/tactics.js`; race data constants `MARKS`, `COURSES`, `LINE_PRESETS`, `FORBIDDEN_ZONE`, `DANGERS` in `js/courses.js`.
- Depends on: `js/geo.js` and `js/polar.js` heavily; `js/tactics.js` imports `route` from `js/router.js`.
- Used by: `js/app.js`, `js/debrief.js`, `js/startmode.js`, `js/scene3d.js`.
- Purpose: forecasts (multi-model, cached), consensus, marine state, live buoys.
- Location: `js/weather.js` (`fetchAll`, `cached`, `snapshot`, `consensus`, `fetchLive`, `MODELS`), `js/obs.js` (observed-wind calibration, `scoreModels`), `js/track.js` (GPS trace persistence in IndexedDB `rade-traces`).
- Depends on: `js/geo.js`; `js/obs.js` depends on `js/voice.js` for `SR` (speech recognition constructor).
- Used by: `js/app.js`.
- Purpose: 3D harbour scene, tactical overlays, help and guide dialogs, dictation UI.
- Location: `js/scene3d.js` (three.js scene, OrbitControls from `vendor/`), `js/j80.js` (J80 panel), `js/help.js` (tips, welcome, share sheet), `js/events.js` (event/PDF handling: `pdfText`, `parseIC`), `styles.css`, `guide.html`, `regles.html`, `acces.html`.
- Depends on: domain layer modules and `vendor/`.
- Used by: `js/app.js`.
- Purpose: call OpenAI for language tasks only.
- Location: `api/voice.js` (dictated wind report to structured intent), `api/debrief.js` (race debrief prose from computed facts, `maxDuration` 60 s), `api/rules.js` (RRS rules referee, quotes verified against `api/_rrs.js`, `maxDuration` 60 s).
- Depends on: `openai` and `@vercel/functions` (declared in `package.json`); `api/rules.js` imports `api/_rrs.js`.
- Used by: `js/voice.js` and `js/debrief.js` / rules UI on the client via same-origin `fetch('/api/…')`.
- Purpose: restrict the whole site to crew members.
- Location: `middleware.js` (Vercel Edge middleware, `config.matcher` excludes `acces.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `rapports/`).
- Mechanism: a `?acces=` query parameter or `rt_acces` cookie is hashed (SHA-256) and looked up in a fixed table of member hashes; a match sets a 400-day cookie. Browser navigations without access redirect to `acces.html`; other requests get HTTP 401. Access codes and hashes are deliberately not reproduced in this document.

## Data Flow

### Primary Request Path (forecast to recommendation)

### Observation / dictation path

### Live / GPS path

### Service worker / install path

- One module-level object `S` in `js/app.js`, seeded from `DEF`, with `persist()` writing only keys present in `DEF`.
- Derived caches are module-level `let`s (`series`, `ranking`, `F` for the `WindField`, `anaTimer`, `actx` for AudioContext, `timer`, `sheet`).
- Track data is in IndexedDB; no server-side state exists.

## Key Abstractions

- Purpose: local wind over the harbour from a base forecast plus terrain corrections.
- Examples: `js/wind.js` (class `WindField`, `speedColor`).
- Pattern: construct with terrain, call `compute(base, opts)` to get a per-cell field.
- Purpose: boat speed for true wind speed and angle, with optimal VMG angles.
- Examples: `js/polar.js` (`boatSpeed`, `optimalAngles`, `spiMinTwa`, `setPolar`, `parsePolar`), `js/polar-orc.js` (ORC table), `data/j80.pol` (built by `tools/build_polar.mjs`).
- Pattern: table lookup with interpolation; a personal polar can replace the default via `setPolar()`.
- Purpose: named race marks, courses, start line presets, forbidden zones and dangers.
- Examples: `js/courses.js` (`MARKS`, `COURSES`, `LINE_PRESETS`, `FORBIDDEN_ZONE`, `DANGERS`, `PLACES`, `IC`).
- Pattern: plain exported constant tables; positions are lat/lon, converted with `toXY()`.
- Purpose: isochrone routing between two points in the wind field, avoiding land and forbidden zones.
- Examples: `js/router.js` `route(from, to, field, opts)`.
- Pattern: pure function, returns `null` for trivially short legs (< 20 m); tack and gybe losses are options.
- Purpose: saved race events (IC documents, PDF text).
- Examples: `js/events.js` (`eventsState`, `currentEvent`, `upsertEvent`, `removeEvent`, `setCurrent`).
- Pattern: state held in module object, persisted by the caller.

## Entry Points

- Location: `index.html` → `js/app.js`.
- Triggers: browser load or home-screen launch (PWA `manifest.webmanifest`).
- Responsibilities: everything user-facing.
- Location: `sw.js`, served from the root.
- Triggers: registration by the page (registration code lives in `js/app.js` or `index.html`).
- Responsibilities: offline shell and cache versioning.
- Location: `middleware.js`.
- Triggers: every request not excluded by its matcher.
- Location: `api/voice.js`, `api/debrief.js`, `api/rules.js`.
- Triggers: same-origin `POST /api/...` from the client.
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

### Manually duplicated asset list

### Duplicated date helpers

## Error Handling

- `store.get`/`store.set` swallow storage errors and return defaults.
- The service worker serves cached content when the network fails.
- Serverless functions create the OpenAI client lazily so a missing key fails per request, not at module load.
- `api/rules.js` checks every quoted English passage against `api/_rrs.js` before showing it.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
