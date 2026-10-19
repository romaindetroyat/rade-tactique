---
last_mapped_commit: 7ca5ba6e5a21f8caf7a9640bf6acad4e08155e2d
last_mapped_at: 2026-10-19
---
# External Integrations

**Analysis Date:** 2026-10-19

## APIs & External Services

**Weather forecasts (client-side, called directly from the browser):**
- Open-Meteo forecast API - `https://api.open-meteo.com/v1/forecast`
  - Used in `js/weather.js` (`getJSON`, `cache: 'no-store'`) for AROME HD 1.3 km, AROME 2.5 km, ARPEGE, ECMWF IFS, ICON-EU and GFS, on one central point and on a 24-point grid (`GRID` in `js/weather.js`).
  - Also used in the offline snapshot tool `tools/snapshot_weather.py` (same requests, output to `data/wx-snapshot.json`).
  - Auth: none (public, no API key).
- Open-Meteo Marine API - `https://marine-api.open-meteo.com/v1/marine`
  - Sea state (waves, swell, currents, sea temperature), in `js/weather.js` and `tools/snapshot_weather.py`.
  - Auth: none.
- Pioupiou live wind stations - `https://api.pioupiou.fr/v1/live/all`
  - Real-time wind observations from the buoys near the roadstead, fetched in `js/weather.js` (around line 119).
  - Auth: none.
- OpenWindMap - named as the source of the live beacons shown in `js/app.js` ("Balises en direct", around line 554) and in `js/weather.js` comments. The data itself comes through the Pioupiou endpoint above; no separate OpenWindMap URL is called in the code.

**OpenAI (server-side only, Vercel functions):**
- OpenAI Responses API via the `openai` npm SDK (`client.responses.create`), client created lazily with `new OpenAI()` (reads `OPENAI_API_KEY`).
  - `api/voice.js` - POST `/api/voice`, body `{ alts, last, tack }`. Turns a dictated wind reading (Web Speech transcript alternatives, French) into a structured wind observation (direction, speed, gusts, lift/header). Caller: `js/app.js` (around line 212). Reasoning effort `low`.
  - `api/debrief.js` - POST `/api/debrief`, body is a facts object with `bords` (tacks). Returns a structured race debrief in JSON schema form. Caller: `js/debrief.js` (around line 323). Reasoning effort `medium`. `maxDuration: 60`.
  - `api/rules.js` - POST `/api/rules`, body `{ question, history }`. Racing-rules arbiter answering from the official RRS 2025-2028 text in `api/_rrs.js`; it marks each quoted rule as verbatim or not by checking the quote against the RRS text. `maxDuration: 60`.
  - Model: `OPENAI_MODEL` or default `gpt-5.5`.
  - Auth: `OPENAI_API_KEY` environment variable on Vercel. Missing key returns HTTP 503 `{"error":"no_key"}`.
  - Input size limits in code: voice phrases truncated to 300 characters, max 4 alternatives; rules question 1500 characters, last 6 history turns; debrief JSON truncated to 60000 characters.

**Browser APIs (no network, but external platform services):**
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) - voice dictation of wind readings, `js/voice.js` (the `lang` is French). Recognition is performed by the browser vendor's service.
- `speechSynthesis` - spoken feedback in French (`js/voice.js`, `fr-FR`).
- Geolocation API (`navigator.geolocation`) - GPS position for the start-line ends (`js/app.js` around lines 686-738) and for live "mode en course" tracking with `watchPosition` (`js/startmode.js` around line 236-237).

**Map and terrain data sources (used at build time, not fetched by the app at runtime):**
- AWS Terrain Tiles (Terrarium format, SRTM/GMTED) - altitude, read by `tools/build_terrain.py`; results stored in `data/terrain.bin`.
- EMODnet Bathymetry DTM - seabed depth, read by `tools/build_terrain.py` (`bathy.tif`).
- OpenStreetMap (ODbL) - coastline, dikes, urban areas, places; extracted to `osm_extract.json` and used by `tools/build_terrain.py` and `tools/build_basemap.py`. Attribution is shown in the app (`data/meta.json` sources list).
- Auth: none for these downloads; the scripts expect the files to be downloaded beforehand into a data folder.

**Reference links (plain links in HTML, no API calls):**
- Météo-France (`meteofrance.com`), Windy, Windguru - referenced in `index.html`, `guide.html`, `regles.html`
- Sailing references: `www.sailing.org` (World Sailing, RRS PDF linked in `regles.html`), `www.j80na.com`, `data.orc.org` (ORC One Design certificate, source of `js/polar-orc.js` and `tools/build_polar.mjs`), `arbitrage.ffvoile.fr`, `yachting.web.cern.ch`
- Sail makers: `www.northsails.com`, `www.quantumsails.com` (tuning guides summarised in `js/tuning.js` and `docs/J80-polaires-reglages.md`)
- Chat invitation links: `chat.whatsapp.com`, `wa.me` (in the HTML/JS, used as contact links)
- `http://www.topografix.com` - GPX namespace reference (GPX export in `js/track.js` context, string only)

## Data Storage

**Databases:**
- None server-side. No database client, no ORM, no SQL.

**Browser storage:**
- `localStorage`: forecast cache (`rade.wx.v1` in `js/weather.js`), welcome flag (`rade.welcome` in `js/help.js`), event definitions and settings (`js/events.js`), application settings in `js/app.js` (wrapped `store` helper with try/catch).
- IndexedDB: database opened in `js/track.js` (`indexedDB.open(DB, 1)`) to store recorded GPS tracks offline.
- Service worker Cache Storage: cache `rade-v25` (name in `sw.js`) for the app shell and data.

**File Storage:**
- Local filesystem only for shared static assets in the repository (`data/`, `rapports/`, `icons/`). Served as static files by Vercel.
- User imports: the Event Instructions file (PDF or text) is read in the browser (`js/app.js` around line 1021-1051; PDF text extraction by pdf.js in `js/events.js`). Nothing is uploaded to a server by this path.

**Caching:**
- Service worker network-first cache (`sw.js`), explicit `Cache-Control: no-cache` headers in `vercel.json`.
- Forecast local cache in localStorage (`js/weather.js`) and offline snapshot `data/wx-snapshot.json`.

## Authentication & Identity

**Auth Provider:**
- Custom, minimal "crew access" control. Not an external identity provider.
  - Implementation: `middleware.js` (Vercel Routing Middleware) runs on every path except `acces.html`, `manifest.webmanifest`, `sw.js`, `icons/` and `rapports/`.
  - A personal crew code is accepted either as a link query parameter (`?acces=...`) or via the form in `acces.html`. The middleware hashes the code with SHA-256 (Web Crypto) and compares the digest against a fixed table of member digests. On match it sets an `HttpOnly; Secure; SameSite=Lax` cookie valid for 400 days, then redirects to the clean URL.
  - Unauthenticated page navigations are redirected to `acces.html`; unauthenticated `/api/*` requests and other files get HTTP 401 with `Cache-Control: no-store`.
  - Security notes: access codes and digests must not be reproduced in documentation. The member table is in the source file, so anyone with repository access can read the digests.
- No user accounts, sessions server-side, OAuth or passwords.

**API authentication:**
- The `api/` functions do not check the crew cookie themselves; they rely on Vercel Routing Middleware, which runs before them (the matcher covers `/api/*`).

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, analytics or error reporting SDK.

**Logs:**
- Server functions return error messages in JSON (`{ error: ... }`) with truncated messages (200-300 characters). No structured logging library.
- Local development log `srv.log` from a Python HTTP server (not deployed).

## CI/CD & Deployment

**Hosting:**
- Vercel (static files from repository root, `api/*.js` as Node functions, `middleware.js` as Routing Middleware). The README also lists Netlify, Cloudflare Pages and GitHub Pages as possible hosts, but only Vercel-specific features (`vercel.json`, `@vercel/functions`, `api/` functions) are used by the code, so only Vercel is supported without changes.

**CI Pipeline:**
- None detected (no `.github/workflows`, no CI configuration in the repository).

## Environment Configuration

**Required env vars:**
- `OPENAI_API_KEY` - Vercel project environment variable for `api/voice.js`, `api/debrief.js`, `api/rules.js`.

**Optional env vars:**
- `OPENAI_MODEL` - overrides the default `gpt-5.5`.

**Secrets location:**
- OpenAI key: Vercel project environment variables (not in the repository).
- Crew access digests: constant table in `middleware.js` (hashes only, no plain-text codes).
- No `.env` files present in the repository.

## Webhooks & Callbacks

**Incoming:**
- None. The server exposes only the POST endpoints `/api/voice`, `/api/debrief`, `/api/rules` (each returns 405 for non-POST).

**Outgoing:**
- None from the server. The browser calls the external data endpoints listed above (Open-Meteo, Open-Meteo Marine, Pioupiou).

---

*Integration audit: 2026-10-19*
