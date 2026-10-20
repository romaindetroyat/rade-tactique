// Faux Vercel Blob au contrat du SDK @vercel/blob 2.8.0 (ARCH-01) : aucun réseau, aucun jeton. Partagé par les tests de l’archive et par
// tools/regate-e2e.mjs. Il applique les règles qui comptent pour api/archive.js et FAIT ÉCHOUER tout écart :
//   - tout accès autre que `access: 'private'` lève ; `list()` lève toujours (le magasin n’est jamais énuméré : opération avancée comptée) ;
//   - `get` rend null si le blob est absent, { statusCode: 304, stream: null } si `ifNoneMatch` égale l’etag, sinon un flux ;
//   - `put` échoue (BlobError) si le blob existe sans `allowOverwrite` ni `ifMatch`, et (BlobPreconditionFailedError) si `ifMatch` diffère ;
//   - `head` lève BlobNotFoundError si le blob est absent ;
//   - `ops` compte les appels (écritures = opérations avancées du quota) et `ops.log` garde chaque appel avec ses options.
// `invoke` adapte un gestionnaire Vercel (req, res) à un appel de fonction : { status, headers, body }.

import { Writable } from 'node:stream';

export function createFakeBlob({ gate = null } = {}) {
  class BlobError extends Error {}
  class BlobPreconditionFailedError extends BlobError { constructor() { super('Precondition failed: ETag mismatch.'); } }
  class BlobNotFoundError extends BlobError { constructor() { super('The requested blob does not exist'); } }
  class BlobServiceRateLimited extends BlobError {
    constructor(seconds) { super(`Too many requests${seconds ? ` - try again in ${seconds} seconds` : ''}.`); this.retryAfter = seconds != null ? seconds : 0; }
  }

  const store = new Map();                                    // chemin → { text, etag, contentType, uploadedAt }
  const ops = { get: 0, put: 0, head: 0, list: 0, log: [] };
  const pending = [];                                         // pannes programmées : { err, op, times }
  let seq = 0;

  const enter = (op, path, opts) => {
    ops[op]++; ops.log.push({ op, path, opts: { ...opts } });
    const i = pending.findIndex((p) => !p.op || p.op === op);
    if (i >= 0) { const p = pending[i]; if (--p.times <= 0) pending.splice(i, 1); throw p.err; }
  };
  const priv = (op, opts) => { if (opts?.access !== 'private') throw new Error(`faux Blob : ${op} sans accès privé (access: ${JSON.stringify(opts?.access)})`); };
  const toStream = (text) => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } });

  async function get(path, opts = {}) {
    enter('get', path, opts); priv('get', opts);
    if (gate) await gate(path, ops.get);                      // porte de test : retient la lecture avant qu’elle ne regarde le magasin
    const e = store.get(path);
    if (!e) return null;
    const blob = { pathname: path, etag: e.etag, contentType: e.contentType, size: Buffer.byteLength(e.text), uploadedAt: e.uploadedAt };
    if (opts.ifNoneMatch && opts.ifNoneMatch === e.etag) return { statusCode: 304, stream: null, headers: new Headers(), blob: { ...blob, contentType: null, size: null } };
    return { statusCode: 200, stream: toStream(e.text), headers: new Headers({ etag: e.etag }), blob };
  }

  async function put(path, body, opts = {}) {
    enter('put', path, opts); priv('put', opts);
    if (typeof body !== 'string' && !Buffer.isBuffer(body)) throw new Error('faux Blob : corps de put illisible (chaîne ou Buffer attendus)');
    if (opts.ifMatch && opts.allowOverwrite === false) throw new Error('ifMatch and allowOverwrite: false are contradictory.');
    let target = path;
    if (opts.addRandomSuffix) { const dot = path.lastIndexOf('.'); target = dot > path.lastIndexOf('/') ? `${path.slice(0, dot)}-r${String(seq + 1).padStart(6, '0')}${path.slice(dot)}` : `${path}-r${String(seq + 1).padStart(6, '0')}`; }
    const cur = store.get(target);
    if (opts.ifMatch) { if (!cur || cur.etag !== opts.ifMatch) throw new BlobPreconditionFailedError(); }
    else if (cur && !opts.allowOverwrite) throw new BlobError('This blob already exists, use `allowOverwrite: true` if you want to overwrite it.');
    const etag = `"e${++seq}"`;
    store.set(target, { text: String(body), etag, contentType: opts.contentType || 'application/octet-stream', uploadedAt: new Date(0) });
    return { pathname: target, contentType: opts.contentType, etag };
  }

  async function head(path, opts = {}) {
    enter('head', path, opts);
    if (opts.access !== undefined) priv('head', opts);
    const e = store.get(path);
    if (!e) throw new BlobNotFoundError();
    return { pathname: path, etag: e.etag, contentType: e.contentType, size: Buffer.byteLength(e.text) };
  }

  async function list() { ops.list++; throw new Error('faux Blob : énumération interdite (list) — le magasin ne doit jamais être énuméré'); }

  // Fait échouer les `times` prochains appels (de l’opération `op` si donnée) avec `err` : 429, précondition perpétuellement refusée…
  const failNext = (err, { op = null, times = 1 } = {}) => { pending.push({ err, op, times }); };

  return { get, put, head, list, BlobError, BlobPreconditionFailedError, BlobNotFoundError, BlobServiceRateLimited, store, ops, failNext };
}

// Porte pour `createFakeBlob({ gate })` : les `n` premières lectures attendent d’être toutes arrivées, puis repartent ensemble
// (deux équipiers qui lisent le même état avant que l’un des deux n’écrive).
export function createGate(n) {
  let arrived = 0, open;
  const opened = new Promise((r) => { open = r; });
  return async () => { if (arrived >= n) return; if (++arrived >= n) open(); await opened; };
}

// Appelle un gestionnaire Vercel comme le ferait la plateforme : req.query tiré de l’URL, req.body copié (JSON), res.status().json(),
// res.setHeader() et un puits inscriptible pour les réponses en flux. Rend { status, headers (noms en minuscules), body }.
export async function invoke(handler, { method = 'GET', url = '/api/archive', body, headers = {} } = {}) {
  const u = new URL(url, 'http://localhost');
  const req = {
    method, url, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    query: Object.fromEntries(u.searchParams), body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
  };
  const out = { status: 200, headers: {}, body: undefined };
  const chunks = [];
  let finish;
  const done = new Promise((r) => { finish = r; });
  const res = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); }, final(cb) { cb(); } });
  res.on('finish', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    try { out.body = /json/.test(out.headers['content-type'] || '') ? JSON.parse(text) : text; } catch { out.body = text; }
    finish();
  });
  res.status = (c) => { out.status = c; return res; };
  res.setHeader = (k, v) => { out.headers[String(k).toLowerCase()] = String(v); return res; };
  res.getHeader = (k) => out.headers[String(k).toLowerCase()];
  res.json = (b) => { out.body = b === undefined ? undefined : JSON.parse(JSON.stringify(b)); out.headers['content-type'] ||= 'application/json'; finish(); return res; };
  await handler(req, res);
  await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error('invoke : le gestionnaire n’a jamais répondu')), 2000).unref())]);
  return out;
}
