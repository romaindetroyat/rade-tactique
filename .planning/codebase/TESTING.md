---
last_mapped_commit: 7ca5ba6e5a21f8caf7a9640bf6acad4e08155e2d
last_mapped_at: 2026-10-19
---
# Testing Patterns

**Analysis Date:** 2026-10-19

## Current State

- No committed test suite. No test files (`*.test.*`, `*.spec.*`) exist in the repository.
- No test framework in `package.json` (dependencies are `openai` and `@vercel/functions` only; no `scripts` block).
- No CI configuration in the repository (`.github/`, `vercel.json` has no test hooks).
- Verification so far is ad hoc and happens outside the repository:
  - `node --check <file>` for syntax on changed JavaScript files.
  - Node harness scripts kept outside the repo that import the `js/` modules directly (geo, wind, tactics, polar, router) to check numeric outputs.
  - Playwright scripts driving Chromium (browsers under `/opt/pw-browsers`) for UI and PWA checks at the local static server or at the deployed site.
  - Live checks against the deployed site https://rade-tactique.vercel.app (including the crew-access middleware and API routes).
- Local run for manual testing: `python3 -m http.server` in the repo root (per `README.md`). Note that the browser app needs `data/` files and network access to Open-Meteo for live forecasts; `data/wx-snapshot.json` is the offline fallback.

Treat any new test as a deliberate addition: do not assume a runner exists. If you add one, put it under a new `tests/` directory and add a `"scripts": { "test": ... }` entry to `package.json`.

## Test Framework

**Runner:** Not configured.

**Assertion library:** Not configured. Use `node:assert/strict` for Node-side checks (no install needed).

**Run commands (available today):**

```bash
node --check js/app.js                       # syntax check one module
for f in js/*.js api/*.js; do node --check "$f"; done   # syntax check all (see note)
python3 -m http.server 8000                  # serve the static app locally
python3 tools/snapshot_weather.py            # refresh data/wx-snapshot.json (network required)
```

Note on `node --check`: browser modules in `js/` import with `.js` extensions and `export`, so `node --check` parses them as ES modules because the root `package.json` has `"type": "module"`. Browser-only globals (`document`, `localStorage`, `indexedDB`) are not executed by `--check`, so it only validates syntax.

## Test File Organization

**Location:** No convention yet. Recommended if tests are added: `tests/` at the repo root, one file per module (`tests/geo.test.js`, `tests/router.test.js`), mirroring `js/` names.

**Naming:** Not established. Use `<module>.test.js` for Node tests run with `node --test`.

**Excluded from deployment:** Vercel deploys the static files at the root. Keep test files out of served paths; `vercel.json` has no `ignore` rule for `tests/`, so either add one or keep tests under a folder that is not a route.

## Test Structure

**Suite Organization (proposed, using Node's built-in runner):**

```js
// tests/geo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toXY, toLL, norm360, norm180, bearingXY, distXY } from '../js/geo.js';

test('aller-retour lat/lon via toXY/toLL', () => {
  const p = toLL(1000, -2000);
  const q = toXY(p.lat, p.lon);
  assert.ok(Math.abs(q.x - 1000) < 1e-6 && Math.abs(q.y + 2000) < 1e-6);
});

test('norm360 et norm180 bornent les angles', () => {
  assert.equal(norm360(-10), 350);
  assert.equal(norm180(270), -90);
});
```

Run with `node --test tests/`.

**Patterns to follow:**
- Keep tests pure: call exported functions of `js/*.js` that do not touch `document`, `localStorage` or `indexedDB` (`geo.js`, `polar.js` math, `router.js` with a stub field, `tactics.js`, `wind.js` math, `track.js` GPX parsing with a stub `DOMParser` if needed).
- Modules that read `localStorage` at import time need a shim before import (`globalThis.localStorage = { getItem: () => null, setItem() {} }`). `js/events.js` and `js/weather.js` call storage inside functions, so a shim is enough.
- `js/app.js` runs `init()` on import and touches the DOM: do not import it in Node tests.

## Mocking

**Framework:** None. Use plain stubs.

**Patterns (for Node harnesses, as used ad hoc):**

```js
// stub du champ de vent : vent uniforme
const field = { sample: () => ({ dir: 315, spd: 14, gust: 18 }) };
const r = route({ x: 0, y: 0 }, { x: 3000, y: 2000 }, field, { perf: 1 });
```

`route()` in `js/router.js` takes any object with `sample(x, y)` returning `{ spd, dir, ... }`, and an optional `terrain` with `isLand(x, y)`. Use this seam instead of mocking the whole app.

**What to mock:**
- Network: `fetch` in `js/weather.js`, `js/app.js` (`fetchLive`, `fetchAll`) and in `api/*.js` (OpenAI client). Replace with canned JSON copied from `data/wx-snapshot.json` (structure: `{ fetched, snapshot, multi, grid, marine }`).
- Storage: `localStorage` and `indexedDB` (`js/track.js`).
- OpenAI: in `api/*.js`, inject a fake `client.responses.create` by setting the module client before the call is not possible (it is module-private `let client`). For API tests, prefer testing the pure parts (`norm`, `verbatim` in `api/rules.js` are not exported; extract to a helper module before testing) or run against the deployed endpoint with `OPENAI_API_KEY` set in the environment only.

**What NOT to mock:**
- Geometry, polar and routing math (`js/geo.js`, `js/polar.js`, `js/router.js`, `js/tactics.js`): test with real values.
- The official RRS text in `api/_rrs.js`: the citation check depends on the exact text.

## Fixtures and Factories

**Test data in the repo:**
- `data/wx-snapshot.json`: real forecast snapshot (Open-Meteo multi-model, 24-point grid, marine). Use as a fixture for `consensus()`, `modelPoints()`, `scoreModels()` in `js/weather.js` and `js/obs.js`.
- `data/j80.pol`: J80 polar table consumed by `js/polar.js` (`parsePolar`). Use for `boatSpeed` and `optimalAngles` checks.
- `data/meta.json`, `data/terrain.bin` (Int16 decimetres, row 0 = north), `data/cover.bin` (Uint8: 0 sea, 1 land, 2 urban, 3 dike): fixtures for `Terrain.load` and `isLand`. Load with `fs.readFileSync` and wrap in an `ArrayBuffer` for Node tests.
- `rapports/coupe-snpm-2026.html`: static report page, not a test fixture.

**Location:** Not established; reference `data/` directly rather than duplicating files.

**Coverage:** Not measured. No threshold enforced.

## Coverage

**Requirements:** None enforced.

**View coverage:** Not available without a runner. If `node --test --experimental-test-coverage` is adopted, the command is:

```bash
node --test --experimental-test-coverage tests/
```

## Test Types

**Unit tests (not present; highest-value candidates):**
- `js/geo.js`: projection round trip, angle normalisation, `cardinal`, formatting helpers.
- `js/polar.js`: `parsePolar` error paths (short file, unreadable TWS header), interpolation in `boatSpeed`.
- `js/track.js`: `fromGPX` error messages for non-GPX and untimed files.
- `js/voice.js`: `wordsToDigits` (French number words to digits, e.g. "deux cent quatre-vingt-dix" → "290").
- `api/rules.js` verbatim check: the citation rule (length > 20 and substring of the normalised RRS text).

**Integration / manual scenario tests (done ad hoc):**
- Full race flow in a browser: forecast load, route, start-line analysis, GPS "mode en course", export GPX, debrief generation. Driven with Playwright against `python3 -m http.server` or the deployed site.
- PWA: service-worker install and offline reload (`sw.js` shell list); check that `sw.js` `VERSION` changed when shell files changed.
- Access gate: middleware redirects to `/acces.html`, cookie set on `?acces=` link, `/api/*` returns 401 JSON without cookie. Verify on the deployed site only; never log codes in test output.
- Device checks: iPhone Safari (install to home screen, audio, GPS). Done manually.

**E2E Tests:** Not used as a committed suite. Playwright with Chromium is available in the sandbox (`/opt/pw-browsers`); keep scripts outside the repo unless the user asks for a suite.

## Common Patterns

**Numeric checks:** compare with tolerance; the code works in metres and nautical miles (`NM = 1852`) and knots:

```js
assert.ok(Math.abs(distXY({ x: 0, y: 0 }, { x: 3 * 1852, y: 4 * 1852 }) - 5 * 1852) < 1e-6);
```

**Async I/O checks:** use `await` with `node:test`; for the offline fallback, assert that `snapshot()` returns the structure of `data/wx-snapshot.json`.

**Error paths:** assert the French message text where the UI shows it (`/trace trop courte/`, `/Fichier polaire trop court/`).

**Regression checks for the API prompts:** not automated. When changing `SYSTEM` prompts in `api/rules.js` or `api/debrief.js`, verify on the deployed endpoint with three known questions (a rule with a verbatim citation, a non-rule question, a question with missing facts) and check that each citation still passes `verbatim()`.

## Before Merging a Change

1. `node --check` every changed `.js` file (and `api/*.js`).
2. If shell files changed (`index.html`, `styles.css`, `js/*.js` listed in `sw.js`), bump `VERSION` and `APP_VERSION` consistently.
3. For geometry, polar or routing changes, rerun the Node harness on `data/j80.pol` and a fixed wind field and compare with the previous output.
4. For UI changes, load the page in Chromium (Playwright), check the portrait phone layout and the console for errors.
5. Do not commit test output that contains crew codes, API keys or the OpenAI responses with personal data.

---

*Testing analysis: 2026-10-19*
