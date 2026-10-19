// FIAB-07 : le journal de diagnostic est borné, sans secret, à l’heure de Paris, et plus aucune erreur du chemin
// départ / course n’est avalée sans trace (garde statique sur le texte des sources).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT } from './helpers/setup.mjs';
import { KEY, MAX_ENTRIES, MAX_MSG, MAX_BYTES, scrub, createDiag } from '../js/diag.js';

const src = (f) => readFileSync(ROOT + f, 'utf8');
const mem = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };

test('plafond : jamais plus de 300 entrées', () => {
  const d = createDiag({ storage: mem() });
  for (let i = 0; i < MAX_ENTRIES + 80; i++) d.log('error', 'essai', 'erreur ' + i);
  assert.equal(d.entries().length, MAX_ENTRIES);
  assert.equal(d.entries().at(-1).m, 'erreur ' + (MAX_ENTRIES + 79), 'la plus récente est gardée');
});

test('persistance : une seconde instance relit le journal', () => {
  const st = mem(), d = createDiag({ storage: st, now: () => 1e12 });
  d.log('error', 'gps', 'code 1 : refusé');
  d.log('info', 'page', 'masquée'); d.flush();
  const d2 = createDiag({ storage: st });
  assert.deepEqual(d2.entries().map((e) => e.m), ['code 1 : refusé', 'masquée']);
});

test('les erreurs partent tout de suite, les informations au prochain flush', () => {
  const st = mem(), d = createDiag({ storage: st });
  d.log('info', 'page', 'visible');
  assert.equal(st.getItem(KEY), null, 'une information attend le flush');
  d.log('error', 'gps', 'panne');
  assert.equal(JSON.parse(st.getItem(KEY)).length, 2, 'l’erreur écrit tout le tampon');
});

test('plein : les informations partent avant les erreurs', () => {
  const d = createDiag({ storage: mem() });
  d.log('error', 'gps', 'la première erreur');
  for (let i = 0; i < MAX_ENTRIES + 20; i++) d.log('info', 'page', 'info ' + i);
  const e = d.entries();
  assert.equal(e.length, MAX_ENTRIES);
  assert.equal(e[0].m, 'la première erreur', 'l’erreur la plus ancienne survit aux informations');
});

test('répétition : un compteur au lieu de lignes identiques', () => {
  const d = createDiag({ storage: mem() });
  for (let i = 0; i < 5; i++) d.log('error', 'gps', 'code 3 : délai dépassé');
  const e = d.entries();
  assert.equal(e.length, 1);
  assert.equal(e[0].n, 5);
  assert.match(d.text(), /\(×5\)/);
});

test('secrets : code d’accès, jeton long et adresse e-mail sont retirés', () => {
  const d = createDiag({ storage: mem() });
  d.log('error', 'page', 'échec sur https://rade.example/?acces=MonCodeSecret&x=1 pour jean@exemple.fr', 'a'.repeat(40));
  const t = d.text();
  assert.ok(!t.includes('MonCodeSecret'), 'le code d’accès a disparu');
  assert.ok(!t.includes('jean@exemple.fr'), 'l’adresse e-mail a disparu');
  assert.ok(!t.includes('a'.repeat(32)), 'le jeton long a disparu');
  assert.equal(scrub('?acces=abc'), '?acces=…');
  assert.ok(scrub('x'.repeat(1000)).length <= MAX_MSG, 'message borné à ' + MAX_MSG);
});

test('quota dépassé : aucune exception, le journal reste en mémoire', () => {
  const st = { getItem: () => null, setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } };
  const d = createDiag({ storage: st });
  assert.doesNotThrow(() => d.log('error', 'trace', 'écriture impossible'));
  assert.equal(d.entries().length, 1);
});

test('stockage illisible ou absent : journal vide, aucune exception', () => {
  assert.equal(createDiag({ storage: { getItem: () => { throw new Error('fermé'); }, setItem() {} } }).entries().length, 0);
  assert.equal(createDiag({ storage: mem() }).entries().length, 0);
  const st = mem(); st.setItem(KEY, '{pas du json');
  assert.equal(createDiag({ storage: st }).entries().length, 0);
  st.setItem(KEY, '{"a":1}');
  assert.equal(createDiag({ storage: st }).entries().length, 0, 'un objet n’est pas un tableau');
  assert.doesNotThrow(() => createDiag().log('info', 'x', 'sans stockage'));
});

test('octets : le texte écrit ne dépasse jamais 40 000 caractères', () => {
  const st = mem(), d = createDiag({ storage: st });
  for (let i = 0; i < 280; i++) d.log(i % 3 ? 'info' : 'error', 'essai', `${i} ` + 'x '.repeat(140));
  d.flush();
  const s = st.getItem(KEY);
  assert.ok(s.length <= MAX_BYTES, `${s.length} octets écrits`);
  assert.ok(JSON.parse(s).length >= 10, 'le journal garde l’essentiel');
});

test('texte : heure de Paris (été), genre, contexte et complément', () => {
  const d = createDiag({ storage: mem(), now: () => Date.UTC(2026, 6, 14, 10, 30, 0), context: () => 'depart' });
  d.log('error', 'gps', 'code 1 : refusé', 'PositionError');
  const l = d.text();
  assert.equal(l, '14/07/2026 12:30:00 [error] départ · gps : code 1 : refusé — PositionError');
  assert.equal(d.text('UTC').slice(0, 19), '14/07/2026 10:30:00', 'le fuseau se choisit');
});

test('contexte : « départ » et « course » sont enregistrés et lisibles', () => {
  let c = 'depart';
  const d = createDiag({ storage: mem(), context: () => c });
  d.log('error', 'gps', 'a');
  c = 'course'; d.log('error', 'gps', 'a');
  c = 'app'; d.log('info', 'page', 'b');
  assert.deepEqual(d.entries().map((e) => e.c), ['depart', 'course', 'app']);
  const t = d.text();
  assert.match(t, /départ · gps/); assert.match(t, /course · gps/); assert.match(t, /app · page/);
  assert.equal(d.entries().length, 3, 'un autre contexte n’est pas une répétition');
});

test('vider : le journal et son stockage sont remis à zéro', () => {
  const st = mem(), d = createDiag({ storage: st });
  d.log('error', 'a', 'b'); d.clear();
  assert.equal(d.entries().length, 0);
  assert.equal(createDiag({ storage: st }).entries().length, 0);
});

test('journal.js s’importe sous Node : report() renvoie une entrée « error », note() une « info »', async () => {
  const J = await import('../js/journal.js');
  const e = J.report('essai', new Error('x'));
  assert.equal(e.k, 'error'); assert.equal(e.m, 'x'); assert.equal(e.w, 'essai');
  assert.equal(J.report('essai', 'texte brut').m, 'texte brut');
  assert.equal(J.report('essai', Object.assign(new Error('refus'), { name: 'NotAllowedError' })).x, 'NotAllowedError');
  assert.equal(J.note('page', 'masquée').k, 'info');
  J.setContext(() => 'course');
  assert.equal(J.report('essai', new Error('y')).c, 'course');
  J.setContext(null);
  assert.equal(J.report('essai', new Error('z')).c, 'app');
  J.journal.clear();
});

test('en-tête : version, iOS, installée, API présentes ; rien de secret', async () => {
  const J = await import('../js/journal.js');
  const old = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const nav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
  try {
    nav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15', standalone: true, wakeLock: {}, storage: { persisted: async () => true } });
    const h = await J.header();
    assert.match(h, /^Rade Tactique v\d+ · \d\d\/\d\d — /);
    assert.match(h, /système : iOS 18\.4/);
    assert.match(h, /app installée : oui/);
    assert.match(h, /verrou d’écran : API présente/);
    assert.match(h, /session audio : API absente/);
    assert.match(h, /stockage persistant : oui/);
    assert.match(h, /copie du \d\d\/\d\d\/\d{4} \d\d:\d\d:\d\d/);
    nav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
    const h2 = await J.header();
    assert.match(h2, /système : autre/); assert.match(h2, /app installée : non/); assert.match(h2, /stockage persistant : inconnu/);
    assert.ok(!/acces|cookie|http/i.test(h + h2), 'aucune adresse, aucun code');
  } finally { if (old) Object.defineProperty(globalThis, 'navigator', old); else delete globalThis.navigator; }
});

// ───────────────────────── gardes statiques

test('garde : journal.js est le premier import de js/app.js', () => {
  const first = /^import\s.*$/m.exec(src('js/app.js'))[0];
  assert.match(first, /from '\.\/journal\.js'/);
});

test('garde : journal.js ne lit ni les cookies ni l’adresse de la page', () => {
  const t = src('js/journal.js') + src('js/diag.js');
  assert.ok(!/document\.cookie|\.cookie\b|location\.(href|search|hash|pathname|origin)|\blocation\s*\)/.test(t), 'lecture interdite trouvée');
  assert.ok(!/geolocation|getCurrentPosition|watchPosition/.test(t), 'aucune position');
});

test('garde : le journal est lu en texte, jamais posé en HTML (help.js)', () => {
  const h = src('js/help.js');
  assert.match(h, /diagText/);
  assert.match(h, /openJournal/);
  assert.match(h, /getElementById\('diagText'\)|querySelector\('#diagText'\)/);
  assert.match(h, /\bpre\.textContent\s*=/, 'le journal est posé par textContent');
  assert.ok(!/innerHTML[^;]*journal\.text|\$\{[^}]*journal\.text/.test(h), 'le journal n’entre jamais dans un gabarit HTML');
  const m = /<pre[^>]*id="diagText"[^>]*>([^<]*)<\/pre>/.exec(h);
  assert.ok(m && m[1] === '', 'le <pre> est créé vide dans le gabarit');
});

// ── « aucune erreur avalée » : chaque gestionnaire d’erreur consigne (report / note) ou explique son repli par un commentaire

// Lit un bloc ouvert par `open` en src[from] jusqu’à son pendant, sans se laisser tromper par les chaînes, gabarits et commentaires.
// Rend { end, comment } : end = position du caractère fermant ; comment = texte des commentaires rencontrés.
function scan(s, from, open, close) {
  let depth = 0, comment = '';
  for (let i = from; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { const e = s.indexOf('\n', i); const t = s.slice(i + 2, e < 0 ? s.length : e); comment += t; i = e < 0 ? s.length : e; continue; }
    if (c === '/' && n === '*') { const e = s.indexOf('*/', i + 2); comment += s.slice(i + 2, e < 0 ? s.length : e); i = e < 0 ? s.length : e + 1; continue; }
    if (c === '\'' || c === '"') { let j = i + 1; while (j < s.length && s[j] !== c && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1; i = j; continue; }
    if (c === '`') {
      let j = i + 1;
      while (j < s.length && s[j] !== '`') {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '$' && s[j + 1] === '{') { j = scan(s, j + 1, '{', '}').end + 1; continue; }
        j++;
      }
      i = j; continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return { end: i, comment };
  }
  return { end: s.length, comment };
}

// Gestionnaires d’erreur d’un texte : blocs `catch` et rappels passés à `.catch(`
function handlers(s) {
  const out = [], line = (i) => s.slice(0, i).split('\n').length;
  for (const m of s.matchAll(/(?<![.\w])catch\s*(?:\([^)]*\))?\s*\{/g)) {
    const open = m.index + m[0].length - 1, { end, comment } = scan(s, open, '{', '}');
    out.push({ line: line(m.index), body: s.slice(open + 1, end), comment });
  }
  for (const m of s.matchAll(/\.catch\s*\(/g)) {
    const open = m.index + m[0].length - 1, { end, comment } = scan(s, open, '(', ')');
    const arg = s.slice(open + 1, end), arrow = arg.indexOf('=>');
    out.push({ line: line(m.index), body: arrow < 0 ? arg : arg.slice(arrow + 2), comment });
  }
  return out;
}
const conforme = (h) => /\b(?:report|note)\(/.test(h.body) || h.comment.trim().length >= 8;

test('garde (outil) : un gestionnaire vide, réduit à une valeur ou à un toast est repéré ; consigné ou commenté est accepté', () => {
  const bad = ['try { a(); } catch { }', 'try { a(); } catch (e) { return null; }', 'p.catch(() => {})', 'p.catch(() => undefined)', 'try { a(); } catch (e) { toast(e.message); }', 'try {} catch { /* x */ }'];
  for (const b of bad) assert.ok(handlers(b).some((h) => !conforme(h)), 'devrait être refusé : ' + b);
  const good = ['try { a(); } catch (e) { report(\'x\', e); }', 'p.catch((e) => this.report(\'trace\', e))', 'p.catch((e) => api.note(\'a\', \'b\'))', 'try { a(); } catch { /* repli : plein écran refusé */ }', 'p.catch(() => { /* déjà fermé, sans conséquence */ })'];
  for (const g of good) assert.ok(handlers(g).length && handlers(g).every(conforme), 'devrait être accepté : ' + g);
  const t = 'const a = `x ${ {b: 1}.b } {`; try { a(); } catch (e) { report(\'ok\', e); } const s = "}";';
  assert.equal(handlers(t).length, 1, 'gabarits et chaînes ne perturbent pas l’appariement');
});

for (const f of ['js/app.js', 'js/track.js', 'js/startmode.js', 'js/wakelock.js', 'js/beeper.js']) {
  test(`garde : aucune erreur avalée dans ${f}`, () => {
    const hs = handlers(src(f));
    assert.ok(hs.length > 0 || f === 'js/wakelock.js', 'le repérage trouve des gestionnaires');
    const mauvais = hs.filter((h) => !conforme(h)).map((h) => `${f}:${h.line}`);
    assert.deepEqual(mauvais, [], 'gestionnaire sans consignation ni commentaire : ' + mauvais.join(', '));
  });
}
