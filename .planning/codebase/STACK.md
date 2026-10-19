---
last_mapped_commit: 7ca5ba6e5a21f8caf7a9640bf6acad4e08155e2d
last_mapped_at: 2026-10-19
---
# Technology Stack

**Analysis Date:** 2026-10-19

## Languages

**Primary:**
- JavaScript (ES modules, browser, no bundler) - all front-end code: `js/*.js` (e.g. `js/app.js`, `js/scene3d.js`, `js/wind.js`, `js/weather.js`)
- JavaScript (Node, ES modules, `"type": "module"` in `package.json`) - Vercel serverless functions: `api/voice.js`, `api/debrief.js`, `api/rules.js`, `api/_rrs.js` (RRS text as a JS string export)
- Edge middleware (JavaScript, Vercel Routing Middleware) - `middleware.js`

**Secondary:**
- HTML5 / CSS3 - `index.html`, `guide.html`, `regles.html`, `acces.html`, `rapports/coupe-snpm-2026.html`, `styles.css`
- Python 3 - offline data-build scripts only, not deployed: `tools/build_terrain.py`, `tools/build_basemap.py` (uses numpy, PIL), `tools/snapshot_weather.py` (uses `curl` via subprocess)
- Node ESM script - `tools/build_polar.mjs` (generates `data/j80.pol`)
- Markdown - `docs/J80-polaires-reglages.md`, `README.md`

## Runtime

**Client (browser / installed PWA):**
- Modern browsers with ES modules, Service Worker, Geolocation, Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` in `js/voice.js`), `speechSynthesis`, IndexedDB (`js/track.js`), localStorage (`js/app.js`, `js/weather.js`, `js/events.js`, `js/help.js`)
- Target platforms: iPhone Safari (Add to Home Screen), desktop browsers. No framework.

**Server:**
- Node.js serverless functions on Vercel (`api/*.js`). The Node version is not pinned (no `engines` field in `package.json`).
- Vercel Routing Middleware (`middleware.js`, imports `next` from `@vercel/functions`).

**Package Manager:**
- npm (implied by `package.json`); only two runtime dependencies are declared.
- Lockfile: **missing** (no `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock` in the repository). Installed versions are not reproducible from the repository.

**Git ignore:** `.gitignore` excludes `node_modules/` and `.DS_Store`.

## Frameworks

**Core:**
- None on the client: hand-written vanilla JavaScript modules and HTML templates with template strings.
- Three.js r170 (vendored, `vendor/three.module.min.js`, header `Copyright 2010-2024`, REVISION "170") - 3D model of the Toulon roadstead in `js/scene3d.js`
- Three.js `OrbitControls` (vendored, `vendor/OrbitControls.js`) - camera controls, imported in `js/scene3d.js`

**Document / utility libraries (vendored, loaded on demand or by script tag):**
- pdf.js (vendored, `vendor/pdf.min.js` and `vendor/pdf.worker.min.js`; version string 3.x, 3.32.2 for the worker) - PDF text extraction for the Cahier de Parcours / instructions de course, loaded lazily by `pdfText()` in `js/events.js`
- qrcode.js 1.1 (vendored, `vendor/qrcode.js`, loaded by `<script>` in `index.html`) - QR code generation for sharing

**Testing:**
- Not detected. No test files, test runner or test configuration in the repository.

**Build/Dev:**
- No build step. The README states: "Aucune étape de build : ce dossier est un site statique." Local testing with `python3 -m http.server`.
- Offline data generation (not part of the deploy):
  - `tools/build_terrain.py` - terrain and sea model (Terrarium tiles, EMODnet bathymetry, OSM extract) producing `data/terrain.bin`, `data/cover.bin`, `data/coast.json`, `data/meta.json`
  - `tools/build_basemap.py` - basemap `data/basemap.jpg` and `data/seamask.png`
  - `tools/build_polar.mjs` - J80 polar from ORC data to `data/j80.pol`
  - `tools/snapshot_weather.py` - forecast snapshot to `data/wx-snapshot.json`

## Key Dependencies

**Runtime (declared in `package.json`):**
- `openai` `^7.36.0` - OpenAI SDK; used in `api/voice.js`, `api/debrief.js`, `api/rules.js` via `client.responses.create(...)` (Responses API with `json_schema` structured output, `strict: true`)
- `@vercel/functions` `^3.10.1` - provides `next()` for `middleware.js`

**Vendored front-end libraries (in `vendor/`, with licences):**
- Three.js r170 - `vendor/LICENSE-three.txt` (MIT)
- pdf.js - `vendor/LICENSE-pdfjs.txt` (Apache-2.0)
- qrcode.js 1.1 - no separate licence file

**Models used by the server (no SDK pin, configured by env var):**
- Default model `gpt-5.5` (overridable with `OPENAI_MODEL`) in `api/voice.js`, `api/debrief.js`, `api/rules.js`. Reasoning effort: `low` (voice, rules), `medium` (debrief).

## Configuration

**Environment variables (names only):**
- `OPENAI_API_KEY` - required by all three `api/` functions; without it they answer HTTP 503 `no_key`. Set on Vercel.
- `OPENAI_MODEL` - optional, defaults to `gpt-5.5`.
- Access control hashes are stored in `middleware.js` as a constant table (SHA-256 digests of personal crew codes), not as environment variables. Do not copy them into documentation.

**Vercel project configuration (`vercel.json`):**
- Response headers `Cache-Control: no-cache` for `/`, `/index.html`, `/sw.js`, `/styles.css`, `/js/:path*`, `/data/:path*`.
- Function limits: `api/debrief.js` and `api/rules.js` have `maxDuration: 60` seconds. `api/voice.js` uses the default.

**Client configuration:**
- `manifest.webmanifest` - `lang: "fr"`, `display: "standalone"`, `orientation: "any"`, `theme_color` and `background_color` `#0c2236`, icons in `icons/` (192, 512, maskable 512, apple-touch).
- `sw.js` - service worker, cache name `VERSION = 'rade-v25'` (bump to invalidate the cache). Precaches the app shell, vendor files, `data/` files and icons. Network-first for other same-origin GET requests; `/api/` requests are not handled.
- Local storage keys: `rade.wx.v1` (forecast cache), `rade.welcome` (first-visit flag), plus the keys in `js/app.js` and `js/events.js`.
- IndexedDB database used by `js/track.js` (GPS track recording).

**Data files (`data/`):**
- `meta.json` (grid extent 5.80-6.10 E, 43.00-43.18 N, 814 x 667 cells, units dm)
- `terrain.bin` (Int16 altitude), `cover.bin` (Uint8 land/sea/urban/dike), `coast.json`, `basemap.jpg`, `seamask.png`, `j80.pol` (polar table), `wx-snapshot.json` (offline forecast fallback, about the forecast fetched by `tools/snapshot_weather.py`)
- `cover.bin` and `terrain.bin` must be regenerated together with `meta.json` by the tools.

**Forbidden / sensitive files:** `srv.log` is a local development server log (Python `http.server` on port 8766); it is not configuration. No `.env` file is present in the repository.

## Platform Requirements

**Development:**
- Any static HTTP server (`python3 -m http.server`) for the client.
- Python 3 with numpy and Pillow for the data-build tools (not needed to run the app).
- Node.js and npm to install `openai` and `@vercel/functions` for the Vercel functions when running them locally (for example with `vercel dev`).
- HTTPS is required for geolocation, service worker and PWA install (the README recommends Vercel, Netlify, Cloudflare Pages or GitHub Pages).

**Production:**
- Vercel: static hosting of the repository root, Node serverless functions in `api/`, Routing Middleware `middleware.js`. The whole repository root is served; `middleware.js` gates everything except `acces.html`, `manifest.webmanifest`, `sw.js`, `icons/` and `rapports/`.

---

*Stack analysis: 2026-10-19*
