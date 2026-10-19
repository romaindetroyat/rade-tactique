---
last_mapped_commit: 7ca5ba6e5a21f8caf7a9640bf6acad4e08155e2d
last_mapped_at: 2026-10-19
---
# Codebase Structure

**Analysis Date:** 2026-10-19

## Directory Layout

```
rade-tactique/
├── index.html            # Application shell (entry page, loads js/app.js as module)
├── styles.css            # All application styles
├── sw.js                 # Service worker (offline shell, SHELL precache list)
├── manifest.webmanifest  # PWA manifest
├── middleware.js        # Vercel edge middleware (crew access)
├── vercel.json           # Vercel headers, function maxDuration
├── package.json          # Declares openai and @vercel/functions for api/
├── README.md             # Project overview (French)
├── guide.html            # User guide page (standalone)
├── regles.html           # Racing rules page (standalone)
├── acces.html            # Crew access login page (public)
├── js/                   # All client-side ES modules
├── api/                  # Vercel Node functions (server side)
├── data/                 # Static generated data (terrain, basemap, polar, snapshot)
├── tools/                # Offline build and fetch scripts (python / node)
├── vendor/               # Third-party browser libraries (three.js, pdf.js, qrcode)
├── icons/                # PWA and favicon images
├── rapports/             # Shared standalone report page (public)
└── docs/                 # Reference notes (J80 tuning and polars)
```

## Directory Purposes

**js/:**
- Purpose: every client-side module.
- Contains: `app.js` (controller), domain modules, rendering modules, data-acquisition modules.
- Key files: `js/app.js` (entry), `js/geo.js` (coordinates), `js/wind.js` (wind field), `js/router.js` (isochrones), `js/tactics.js` (leg and start analysis), `js/polar.js` (boat performance), `js/courses.js` (marks and courses), `js/scene3d.js` (3D scene), `js/startmode.js` (start countdown), `js/track.js` (GPS recording), `js/debrief.js` (race debrief), `js/voice.js` (speech input), `js/obs.js` (observation scoring), `js/weather.js` (forecast fetch), `js/events.js` (event / PDF import), `js/help.js` (tips and sharing), `js/tuning.js` (rigging advice), `js/j80.js` (J80 panel), `js/polar-orc.js` (ORC polar table).

**api/:**
- Purpose: Vercel serverless functions calling OpenAI.
- Contains: one endpoint per file; `_rrs.js` is a data module (underscore prefix keeps it out of routing).
- Key files: `api/voice.js`, `api/debrief.js`, `api/rules.js`, `api/_rrs.js`.

**data/:**
- Purpose: static assets consumed by the browser at runtime.
- Contains: `terrain.bin`, `cover.bin`, `meta.json` (terrain grid, built by `tools/build_terrain.py`); `coast.json` and `seamask.png` (coastline and sea mask); `basemap.jpg` (background map, `tools/build_basemap.py`); `j80.pol` (J80 polar, `tools/build_polar.mjs`); `wx-snapshot.json` (offline forecast copy, `tools/snapshot_weather.py`).
- Generated: Yes. Committed: Yes.

**tools/:**
- Purpose: one-off or periodic regeneration scripts; not loaded by the app.
- Contains: `build_terrain.py`, `build_basemap.py`, `build_polar.mjs`, `snapshot_weather.py`.

**vendor/:**
- Purpose: pinned third-party browser code, loaded as-is.
- Contains: `three.module.min.js`, `OrbitControls.js`, `qrcode.js` (global script), `pdf.min.js` and `pdf.worker.min.js` (PDF text extraction), license files `LICENSE-three.txt` and `LICENSE-pdfjs.txt`.
- Do not edit by hand.

**rapports/:**
- Purpose: shared static report pages that are reachable without crew access.
- Contains: `coupe-snpm-2026.html`.

**docs/:**
- Purpose: human-readable reference, not served as code.
- Contains: `J80-polaires-reglages.md`.

**icons/:**
- Purpose: PWA icons and logo.
- Contains: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `logo.png`.

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell and script tags (`vendor/qrcode.js` classic script, then `js/app.js` module).
- `js/app.js`: application bootstrap (`init()`).
- `sw.js`: service worker.
- `middleware.js`: request gate.

**Configuration:**
- `vercel.json`: cache headers and function timeouts.
- `package.json`: dependencies for serverless functions; `"type": "module"`.
- `manifest.webmanifest`: installable app metadata.
- Environment variables used by functions: `OPENAI_API_KEY`, `OPENAI_MODEL` (read in `api/*.js`; values are never stored in the repository).

**Core Logic:**
- `js/wind.js`: local wind correction model.
- `js/router.js`: isochrone routing.
- `js/tactics.js`: leg analysis and start analysis.
- `js/polar.js`: boat speed model.
- `js/courses.js`: course and mark data.

**Testing:**
- Tests live in `tests/` (`node:test` + linkedom): `npm test`, `npm run check`. The Coupe SNPM 18/10/2026 track is the reference case (`tests/reference/`, `tests/fixtures/`).

## Naming Conventions

**Files:**
- Lowercase, hyphenated for multi-word names: `js/polar-orc.js`, `js/startmode.js` (single word preferred), `tools/build_polar.mjs` (underscore in tools/).
- Serverless function files named after their endpoint: `api/voice.js` → `/api/voice`.
- Private helper modules prefixed with underscore: `api/_rrs.js`.
- Build outputs under `data/` use short lowercase names with extension (`.bin`, `.pol`, `.json`).

**Directories:**
- Lowercase single words: `js`, `api`, `data`, `tools`, `vendor`, `icons`, `rapports`, `docs`.

**Identifiers:**
- Functions and variables: camelCase (`runAnalysis`, `computeField`, `optimalAngles`).
- Constants: UPPER_SNAKE or PascalCase tables (`MARKS`, `COURSES`, `TUNING`, `ORC_TWS`, `EQUIPAGE` in middleware).
- Exported modules use named exports (`export function route`, `export class WindField`).

## Where to Add New Code

**New domain computation (e.g. a new routing or tactics rule):**
- Primary code: a new or existing pure module in `js/` (for example, add to `js/tactics.js` or create `js/<topic>.js`).
- Wire it from: `js/app.js` (calls in `runAnalysis()` or the relevant `render*` function).
- Add the file to the `SHELL` array in `sw.js` if it is new, and bump `VERSION`.

**New screen or panel:**
- Markup: `index.html` (tabs are in `#tabs`, panels referenced by `data-tab`).
- Styling: `styles.css`.
- Rendering and event binding: `js/app.js` (`bindUI()` and a new `renderX()` function), or a dedicated module that exports a render function and receives the DOM element.

**New constant data (marks, courses, polars):**
- Add to `js/courses.js` for race data or `js/polar-orc.js` for polar tables; regenerate binary assets through `tools/`.

**New serverless endpoint:**
- File: `api/<name>.js` (default export handler, Node runtime, `OPENAI_API_KEY` from env).
- Add `maxDuration` under `functions` in `vercel.json` if it may run longer than the default.

**New static asset (image, sound, data):**
- Place under `data/` or `icons/`; add it to `SHELL` in `sw.js`.

**New standalone page:**
- Place at root (like `guide.html`); if it must be public, add it to the `matcher` exclusion in `middleware.js`.

**Utilities:**
- Coordinate, angle and distance helpers: `js/geo.js` (`norm360`, `norm180`, `distXY`, `bearingXY`, `fmtBrg`, `cardinal`).

## Special Directories

**.planning/:**
- Purpose: GSD planning artifacts, including this codebase map.
- Generated: Yes (by GSD commands).
- Committed: decided by the project owner.

**.git/:**
- Purpose: version control metadata.
- Generated: Yes. Committed: n/a.

**node_modules/:**
- Purpose: dependencies for `api/` functions.
- Generated: Yes (by npm install). Committed: No (listed in `.gitignore`).

**vendor/ and data/:**
- Generated or copied: `data/` by `tools/`; `vendor/` by hand from upstream releases.
- Committed: Yes.

---

*Structure analysis: 2026-10-19*
