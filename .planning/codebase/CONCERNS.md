---
last_mapped_commit: 7ca5ba6e5a21f8caf7a9640bf6acad4e08155e2d
last_mapped_at: 2026-10-19
---
# Codebase Concerns

**Analysis Date:** 2026-10-19

## Tech Debt

**Monolithic orchestrator `js/app.js` (1069 lines):**
- Issue: almost all UI wiring, state and rendering live in one module: 14 module-level mutable `let` globals (`T`, `F`, `scene`, `data`, `series`, `live`, `analysis`, `gps`, `timer`, `actx`, `rest`, `traceView`, `icDraft`, ...), about 40 `innerHTML` template blocks, and timers/animation tokens (`anaToken`, `anaTimer`, `lastHud`).
- Files: `js/app.js` (see `let` declarations around lines 43-1012, `innerHTML` writes around lines 245-765)
- Impact: any change touches shared state with hidden coupling; regressions are only caught by hand. Changing a value in one panel can silently affect the 3D scene, the live GPS mode or the debrief.
- Fix approach: extract panels (analysis, live GPS, timer, observations, IC editor) into modules that receive an explicit state object; keep `app.js` as composition only. Do this incrementally, one panel per change.

**Hand-maintained service-worker precache list and version:**
- Issue: `sw.js` holds `const VERSION = 'rade-v25'` and a hand-written `SHELL` array. `js/app.js` line 21 holds `APP_VERSION = 'v25 · accès équipage'`. Both must be bumped by hand. Nothing checks that they agree, and nothing checks that every module in `js/` is listed in `SHELL`.
- Files: `sw.js` (lines 3-9), `js/app.js` (line 21)
- Current state: consistent today (both at 25) and all 19 modules under `js/` are listed, but `vendor/pdf.min.js` and `vendor/pdf.worker.min.js` (loaded on demand by `js/events.js` lines 37-40) are not in `SHELL`; they only become offline-available after one online use through the runtime cache.
- Impact: forgetting to bump `VERSION` serves stale cached code after deploy; forgetting to add a new module to `SHELL` breaks offline use without any error.
- Fix approach: generate `SHELL` and the version at build/deploy time (for example from a hash of the files), or add a small check script run before deploy. Add the on-demand PDF assets to `SHELL` or document why not.

**Parallel version constants drift risk:**
- Files: `sw.js` line 3, `js/app.js` line 21
- Impact: the version shown in the UI (`APP_VERSION`) and the cache name can disagree, which makes field reports ("which version is this phone running?") ambiguous.
- Fix approach: derive both from one source, e.g. a single `version.json` read by both.

**Duplicated helpers:**
- Issue: the same `esc` (HTML escape) function is copy-pasted into 7 modules: `js/app.js` line 29, `js/j80.js` line 6, `js/events.js` line 91, `js/help.js` line 3, `js/startmode.js` line 10, `js/obs.js` line 8, `js/debrief.js` line 12. The same `load`/`save` localStorage wrappers are repeated in `js/weather.js` (lines 23-24), `js/events.js` (lines 6-7) and `js/app.js` (line 32, `store`).
- Impact: a fix to escaping (for example adding single quotes) must be repeated seven times and is easy to miss.
- Fix approach: move `esc` and `store` into `js/geo.js` or a new `js/util.js` and import them.

**Mixed French/English identifiers and comments in code:**
- Files: throughout `js/` (for example `js/wind.js`, `api/rules.js`)
- Impact: low; the French comments are informative, but identifiers such as `bd`, `bs`, `fac`, `dev`, `sh`, `bk` in `js/wind.js` (lines 135-160) are cryptic and make the physics hard to review.
- Fix approach: give the wind-correction terms descriptive names and tie each one to the four corrections described in the header comment of `js/wind.js`.

**Hard-coded course and site data:**
- Files: `js/courses.js` (course list, marks, `LINE_PRESETS`, `FORBIDDEN_ZONE`, `DANGERS`), `js/weather.js` lines 12-15 (`GRID`, `CENTER` coordinates), `js/geo.js` line 5 (`ORIGIN`), `api/_rrs.js` and the `CVAT` constant in `api/rules.js` (lines 14-22)
- Impact: each new season or venue requires editing code in several places; the CVAT sailing instructions are embedded in an API handler.
- Fix approach: move course and instruction data into `data/*.json` files with a schema, loaded at runtime.

**No build, lint or type checking:**
- Files: `package.json` (declares dependencies but no `scripts`), `README.md` ("Aucune étape de build")
- Impact: no automated gate catches syntax or import errors before deploy; ES modules are loaded directly by the browser, so a broken import only shows at runtime.
- Fix approach: add a minimal `package.json` script that runs `node --check` on the ES modules and a bundle/import check, plus a pre-deploy hook.

## Known Bugs and Unverified Behaviour

**Approximate buoy positions:**
- Symptoms: two course marks are placed from approximate sources, not from the official Comité data. The UI itself warns about this in `js/app.js` line 1035 ("approx = position relevée sur les cartes du cahier ou sur OpenStreetMap : vérifier sur zone, le Comité fait foi").
- Files: `js/courses.js` lines 22 and 38 (`src: 'approx'`)
- Trigger: using the planner or routing for those courses; the routed time and the start-line analysis depend on these positions.
- Workaround: check on the water and trust the Comité's marks over the app.

**Simplified local wind model presented as a tactical guide:**
- Symptoms: the local wind field (`js/wind.js`) is a heuristic (Darcy-like porous flow, lee-side reduction, friction, blocking). It is not calibrated against measurements except by the manual observation fit (`js/obs.js`, `refreshObs` in `js/app.js` line 141). Its confidence is shown to the user (`rs.confidence` in `js/app.js` lines 507-508) but the underlying method is not validated.
- Files: `js/wind.js`, `js/app.js` (`refreshObs`, lines 141-160), `js/help.js` line 95 (disclaimer)
- Trigger: any tactical decision based on the "vent local" map far from the observation points.
- Workaround: recalibrate with recorded observations (the app does this per model); treat the map as trend only, as stated in `js/help.js`.

**Mutable Float32 wind kits computed on the main thread:**
- Symptoms: first use of a wind direction calls `kit()` in `js/wind.js` (line 60), which runs a 420-iteration relaxation over the whole grid (about 140 x 135 cells at 150 m). `refreshObs` in `js/app.js` line 150 calls `F.compute()` once per observation of the day, inside a loop, which can stall the UI on phones on the first recompute of a day.
- Files: `js/wind.js` lines 60-75 and 147-150, `js/app.js` lines 141-160
- Trigger: opening the analysis with several observations, or changing the forecast model.
- Workaround: none in code; the kit cache (`this.kits`) limits the cost to the first computation per 5 degrees.

**Stale-version mixing during update:**
- Symptoms: `sw.js` calls `skipWaiting()` on install and `clients.claim()` on activate, so a new service worker takes over open pages at once. The fetch handler is network-first, so most files come fresh, but a page that loaded old `app.js` and then new `wind.js` can run mismatched modules.
- Files: `sw.js` lines 11-13 and 15-22
- Trigger: a deploy while the app is open (for example during a race) on a phone.
- Workaround: reload the page; no prompt is shown to the user.

## Security Considerations

**Access control depends on a single middleware and a cookie that holds the raw code:**
- Risk: `middleware.js` accepts a personal code either from `?acces=` in the URL or from the `rt_acces` cookie, then re-hashes it with unsalted SHA-256 to look it up in a constant table. The cookie stores the code itself (lower-cased), valid for 400 days (`MAX_AGE`). Anyone who reads the cookie (shared device, backup, malware on the browser profile) has a working access until the code is removed from the table and the site is redeployed.
- Files: `middleware.js` (`EQUIPAGE` table, `membre()`, `lireCookie()`, `Set-Cookie` in the `acces` branch), `acces.html` (form that builds `?acces=` links)
- Current mitigation: `HttpOnly; Secure; SameSite=Lax`; hashes rather than plain codes in the source; `Cache-Control: no-store` on redirects and 401s; API routes return 401 JSON without the cookie.
- Recommendations:
  - Store a random session token (not the code) in the cookie, mapped server-side or derived with an HMAC key from an environment variable, so that revoking a member does not require a redeploy.
  - Check the entropy of the personal codes before relying on the hash table; unsalted hashes of low-entropy codes can be reversed offline by anyone who reads `middleware.js`. Do not put the codes or hashes in this document.
  - Compare hashes in constant time (currently a plain `===` on lookup; low practical risk but easy to fix).
  - Be aware that `?acces=CODE` links put the code in browser history, server/Vercel logs and possibly referrers; the middleware redirects it away, but the first request is still logged.

**Public shared report bypasses access control:**
- Risk: `middleware.js` matcher excludes `rapports/`, `acces.html`, `manifest.webmanifest`, `sw.js` and `icons/`. `rapports/coupe-snpm-2026.html` (about 250 KB) is publicly readable by design.
- Files: `middleware.js` line 9 (`config.matcher`), `rapports/coupe-snpm-2026.html`
- Current mitigation: the file is intentionally shared; `acces.html` carries `noindex`.
- Recommendations: review the report content before each publication; add `noindex` in the report itself if it should not be indexed.

**Unbounded and unthrottled paid OpenAI calls:**
- Risk: `api/debrief.js` line 35 passes the entire request body (`req.body`) as the facts payload to the model without a size or schema check, and calls the OpenAI Responses API once per request. `api/rules.js` and `api/voice.js` each call the model per request. A member (or anyone holding a code) can drive cost and latency with no rate limit. `api/rules.js` also sends the full RRS text (`api/_rrs.js`, about 61 KB) as system instructions on every call.
- Files: `api/debrief.js` (lines 35-40), `api/rules.js` (lines 10, 66-80), `api/voice.js` (lines 48-60), `api/_rrs.js`
- Current mitigation: input length caps in `api/rules.js` (question 1500 chars, last 6 history items) and `api/voice.js` (4 phrases of 300 chars); the 503 `no_key` path when `OPENAI_API_KEY` is absent; client-side abort timers of 9 s for the wind dictation (`js/app.js` line 211) and 45 s for the debrief (`js/debrief.js` line 323).
- Recommendations: validate and truncate the debrief payload like the other two endpoints; add a per-member daily quota (for example in Vercel KV or a counter cookie); consider prompt caching for the fixed system prompt; monitor the OpenAI spend in the project dashboard.

**Model name defaults not pinned:**
- Risk: `OPENAI_MODEL` defaults to `gpt-5.5` in `api/rules.js` line 10, `api/voice.js` line 8 and `api/debrief.js` line 8. A model rename or retirement fails at runtime with a 5xx and no fallback.
- Files: the three `api/*.js` files above
- Recommendations: pin the model in one shared constant and log the model identifier returned by the API.

**Model output used as data:**
- Risk: `api/voice.js` returns the model's JSON (direction, speed, gust) straight to the client, which then writes wind values into the analysis. `js/app.js` line 212 and `js/debrief.js` line 323 rely on it.
- Files: `api/voice.js` (line 62), `js/app.js` (line 212), `js/debrief.js` (line 323)
- Current mitigation: strict JSON schema (`strict: true`) in the request; the client treats `understood: false` and asks for confirmation.
- Recommendations: clamp numeric results server-side (the system prompt says 25 kn max, but nothing enforces it) and reject values outside 0-360 degrees and 0-80 kn.

**`api/rules.js` quotation check is a soft guarantee:**
- Risk: the `verifie` flag (`api/rules.js` lines 62-63 and 79-81) only confirms that an English quote appears in the local RRS text. Model paraphrases in `fr` are not checked.
- Files: `api/rules.js`
- Recommendations: state clearly in the UI that `fr` is a translation; keep the disclaimer in `attention`.

**HTML built with string templates:**
- Risk: about 40 `innerHTML` assignments across `js/*.js`. Most interpolated values pass through `esc()`, but escaping is by convention, not enforced, and `esc` is duplicated (see Tech Debt). Values that come from files (GPX track names in `js/track.js` line 127, imported polars, course names) and from the model (`api/debrief.js` output rendered in `js/debrief.js`) are the highest-risk inputs.
- Files: `js/app.js`, `js/debrief.js` (line 246 modal, rendering of `resume`/`bords`), `js/obs.js` line 109, `js/startmode.js` line 111, `js/track.js`
- Recommendations: route all user- and model-provided text through `textContent` or a single sanitising helper; add a Content-Security-Policy header in `vercel.json` (none is set today).

**No security headers beyond caching:**
- Files: `vercel.json` (a `headers` block sets only `Cache-Control`), `index.html`
- Risk: no CSP, no `frame-ancestors`/`X-Frame-Options`, no `Referrer-Policy` in `vercel.json`. Inline `<script>` exists in `acces.html`.
- Recommendations: extend the existing `headers` section of `vercel.json` with CSP (allowing `'self'` and the Open-Meteo/Pioupiou/OpenWindMap origins used by `js/weather.js`), `frame-ancestors 'none'` and `Referrer-Policy: strict-origin-when-cross-origin`. The `Referrer-Policy` also reduces the risk of the access code leaking through the `?acces=` URL.

**Committed local artifacts:**
- Risk: `srv.log` (a local `python -m http.server` log, 156 lines) is tracked in git, although it is not part of the app. Logs can contain request paths including `?acces=` values.
- Files: `srv.log`, `.gitignore` (does not list `*.log`)
- Recommendations: `git rm --cached srv.log`, add `*.log` to `.gitignore`, and check the git history for logged access codes; rotate any code that appears there.

## Performance Bottlenecks

**Wind field recomputation:**
- Problem: `F.compute()` walks the whole grid and an inverse-distance interpolation over all forecast points (`js/wind.js` lines 120-160). It runs on every forecast or model change and once per observation in `refreshObs` (`js/app.js` line 150).
- Files: `js/wind.js`, `js/app.js` (lines 141-160, 266)
- Cause: no caching of intermediate results across observations; the loop over observations recomputes the same field with different points.
- Improvement path: compute the base field once per model/hour and reuse it for the residual step; move the relaxation (`kit`) and `compute` into a Web Worker, which also keeps the 3D scene responsive.

**3D scene on low-end phones:**
- Problem: `js/scene3d.js` (621 lines) animates particles and a Three.js scene; `vendor/three.module.min.js` is about 690 KB and `vendor/pdf.worker.min.js` about 1.1 MB, loaded in full.
- Files: `js/scene3d.js` (particle initialisation around lines 263-266), `vendor/three.module.min.js`, `vendor/pdf.min.js`, `vendor/pdf.worker.min.js`
- Cause: the scene is always created at start (`js/app.js` line 66); the PDF tooling loads only when a PDF is imported but then costs about 1.5 MB.
- Improvement path: lazy-create the 3D view on first use of the map tab; reduce particle counts on small screens; consider a lighter PDF path or a text-only import for the course PDFs.

**Terrain and basemap assets:**
- Problem: `data/terrain.bin` (about 1.1 MB), `data/cover.bin` (about 540 KB), `data/basemap.jpg` (about 650 KB), `data/seamask.png` (about 130 KB) and `data/coast.json` are all precached by the service worker (`sw.js` lines 6-7), so the first install downloads about 2.5 MB of data before the app is usable offline.
- Files: `sw.js`, `data/`
- Improvement path: precache the app shell only and fetch the terrain on first use; or keep as is and note the install size for the users.

## Fragile Areas

**Wind model constants and the observation fit:**
- Files: `js/wind.js` (factors such as `wFac = pts.length > 1 ? 0.6 : 1`, friction constant `fr = 0.15 + 0.15 * ...`, `CELL = 150`), `js/app.js` (`refreshObs`, `scoreModels`)
- Why fragile: the constants were tuned by hand (the header comments mention a single observation on 18/10/2026 for the blocking effect). Changing one shifts every local map and every tactical verdict.
- Safe modification: change one constant at a time, compare the map against the recorded observations in `js/obs.js` before and after, and record the change in the wind module header.
- Test coverage: none (no tests in the repository).

**Polar and routing data:**
- Files: `data/j80.pol`, `js/polar.js`, `js/polar-orc.js`, `js/router.js`, `js/j80.js`, `tools/build_polar.mjs`, `docs/J80-polaires-reglages.md`
- Why fragile: the routing and the "% de la polaire" verdicts depend on `data/j80.pol` being generated by `tools/build_polar.mjs` from the ORC certificate; a hand edit or a regenerate with a different source changes the verdicts silently. The debrief (`api/debrief.js`) also reads these percentages.
- Safe modification: regenerate through the tool only; keep `js/polar-orc.js` and `data/j80.pol` in sync and check a few known speeds after any change.
- Test coverage: none.

**Access middleware edge cases:**
- Files: `middleware.js`, `acces.html`
- Why fragile: the public-path regex in `config.matcher` must stay in sync with every new public asset (a new icon folder, a new report folder). A new file outside the exceptions is blocked for the service worker and for offline users.
- Safe modification: after adding a public folder, test with and without the cookie (401 for files, redirect for navigations) and check that `sw.js` still installs on a fresh browser.
- Test coverage: none.

**Offline and visibility transitions:**
- Files: `js/startmode.js` (wake lock, line 99), `js/track.js` (wake lock, line 38, GPS recording), `js/app.js` (GPS watch, lines 718-738)
- Why fragile: wake lock and GPS are released by the OS when the tab is hidden; recording can silently stop. The app relies on the user returning to the page.
- Safe modification: re-acquire the wake lock on `visibilitychange`, and check the recording state when the page becomes visible.
- Test coverage: none.

**Speech and voice input:**
- Files: `js/voice.js` (93 lines), `js/app.js` lines 200-260 (wind dictation), `js/events.js` (PDF import)
- Why fragile: browser speech APIs differ between iOS Safari and Chrome; the error path returns text alternatives that the model must interpret. A missing `OPENAI_API_KEY` returns a 503 and the UI falls back to manual entry.
- Safe modification: keep the manual entry path working; test on an iPhone in the PWA context.

## Scaling Limits

**Single-team, single-deployment static site:**
- Current capacity: one crew (three personal codes in `middleware.js`), one static deployment on Vercel with three Node functions (`api/rules.js`, `api/voice.js`, `api/debrief.js`).
- Limit: adding members requires editing `middleware.js` and redeploying; there is no admin UI or revocation list.
- Scaling path: move the membership list to a store (Vercel KV, Blob or a small database) read by the middleware, and add an admin page for issuing and revoking codes.

**OpenAI cost per race:**
- Current capacity: not measured in the repository.
- Limit: each debrief and each rules or voice question calls a paid model; the rules endpoint sends about 61 KB of system text each time.
- Scaling path: quotas, prompt caching for the fixed system prompt, and a cheaper model for the voice interpretation step.

## Dependencies at Risk

**Vendored third-party libraries without update process:**
- Packages: `vendor/three.module.min.js` (Three.js), `vendor/OrbitControls.js`, `vendor/pdf.min.js` and `vendor/pdf.worker.min.js` (PDF.js), `vendor/qrcode.js`
- Risk: no version pins are recorded in the repository (no `package.json` dependencies); updates are manual copies. Licence files are present (`vendor/LICENSE-pdfjs.txt`, `vendor/LICENSE-three.txt`).
- Impact: security fixes are not applied automatically; PDF.js has had past parsing vulnerabilities, and the app parses files from the user.
- Migration plan: record the exact version and source URL for each vendored file in a `vendor/README` and set a review date; or move to npm dependencies with a lockfile.

**OpenAI SDK and model dependency:**
- Packages: `openai` (`^7.36.0`) is imported in `api/rules.js`, `api/voice.js`, `api/debrief.js`; `@vercel/functions` (`^3.10.1`) in `middleware.js`. Both are declared in `package.json`.
- Resolved in phase 1: `package-lock.json` committed, `npm ci` on Vercel.

## Missing Critical Features

**No automated tests or regression checks:**
- Problem: the repository contains no test files and no test runner configuration. The wind model, routing, polar percentages, debrief computations and the access middleware are verified only by hand on the water.
- Blocks: safe refactoring of `js/app.js`; confident changes to `js/wind.js`; verifying that the access middleware still denies unauthenticated requests after an edit.

**No error reporting or usage telemetry:**
- Problem: errors are caught silently in many places (`catch { /* ... */ }` used about 25 times across `js/`, and `window.onerror` is not set). Field failures (GPS, sound, storage) are invisible to the developer.
- Blocks: knowing which phones and browsers fail, and why, after a race.

## Test Coverage Gaps

**Wind model and tactical verdicts:**
- What's not tested: `js/wind.js` (`compute`, `kit`, `sample`), `js/tactics.js` (349 lines), `js/router.js` (isochrone routing), `js/polar.js`.
- Files: `js/wind.js`, `js/tactics.js`, `js/router.js`, `js/polar.js`
- Risk: a change in the wind corrections or the routing silently changes the advice given before and during a race.
- Priority: High

**Access control:**
- What's not tested: `middleware.js` behaviour for valid cookie, invalid code, `?acces=` redirect, and public paths (`acces.html`, `sw.js`, `rapports/`, `icons/`).
- Files: `middleware.js`, `acces.html`
- Risk: a regex change in `config.matcher` could expose the whole site or lock out the crew.
- Priority: High

**API endpoints and output validation:**
- What's not tested: `api/rules.js` verbatim check (`verbatim()`), `api/voice.js` JSON result bounds, `api/debrief.js` payload validation and error mapping.
- Files: `api/rules.js`, `api/voice.js`, `api/debrief.js`
- Risk: malformed or out-of-range model output reaches the UI; a bad payload is forwarded to the model.
- Priority: Medium

**Service worker and offline behaviour:**
- What's not tested: install/activate/fetch paths in `sw.js`, the completeness of `SHELL`, and the version bump.
- Files: `sw.js`, `js/app.js` line 21
- Risk: stale or missing offline assets in the field.
- Priority: Medium

**Course data:**
- What's not tested: `js/courses.js` marks and line presets (including the two `approx` marks); geometric sanity (zone sizes, forbidden zones).
- Files: `js/courses.js`
- Risk: a mistyped mark position changes the start-line analysis without warning.
- Priority: Medium

---

*Concerns audit: 2026-10-19*
