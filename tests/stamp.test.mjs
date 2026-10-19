// TEST-04 : la liste hors réseau et la version sont générées, sans oubli possible.
// Ne vérifie PAS que sw.js / js/version.js committés sont à jour : c’est le rôle de `node tools/stamp.mjs --check`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { listShell, build, check, validateNote } from '../tools/stamp.mjs';
import { ROOT } from './helpers/setup.mjs';

const SW = [
  '// service worker de test',
  '/* stamp:begin — bloc généré par tools/stamp.mjs, ne pas modifier à la main */',
  '/* stamp:end */',
  "self.addEventListener('fetch', () => {});",
  '',
].join('\n');

// Copie minimale d’une app dans un dossier temporaire
function appli() {
  const d = mkdtempSync(join(tmpdir(), 'stamp-'));
  for (const sub of ['js', 'data', 'vendor', 'icons', 'tools']) mkdirSync(join(d, sub));
  const put = (f, c = 'x') => writeFileSync(join(d, f), c);
  put('index.html', '<html></html>'); put('styles.css', 'body{}'); put('sw.js', SW);
  put('release.json', JSON.stringify({ n: 7, date: '2026-10-19', note: 'essai', critical: false, hash: '' }));
  put('js/a.js', 'export const a = 1;'); put('data/x.json', '{}'); put('vendor/LICENSE-x.txt', 'licence');
  put('vendor/lib.js', 'var lib;'); put('icons/i.png', 'png'); put('js/.cache', 'cache');
  put('tools/t.mjs', 'export {};'); put('README.md', '# lisez-moi');
  return { d, put };
}

test('listShell : racine d’abord, js/version.js toujours présent, rien d’autre que l’app', () => {
  const { d, put } = appli();
  try {
    const l = listShell(d);
    assert.equal(l[0], './');
    for (const f of ['index.html', 'styles.css', 'js/a.js', 'js/version.js', 'data/x.json', 'vendor/lib.js', 'icons/i.png']) assert.ok(l.includes(f), f + ' doit être hors réseau');
    for (const f of ['vendor/LICENSE-x.txt', 'js/.cache', 'tools/t.mjs', 'README.md', 'sw.js', 'release.json']) assert.ok(!l.includes(f), f + ' ne doit pas y être');
    assert.deepEqual(l.slice(1), [...l.slice(1)].sort(), 'liste triée, donc déterministe');
    assert.ok(!l.includes('js/nouveau.js'));
    put('js/nouveau.js', 'export {};');
    assert.ok(listShell(d).includes('js/nouveau.js'), 'un fichier ajouté entre sans autre geste');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('build : deterministe ; l’identifiant suit les fichiers de l’app et la logique du worker, rien d’autre', () => {
  const { d, put } = appli();
  try {
    const a = build(d);
    const b = build(d);
    assert.equal(a.sw, b.sw);
    assert.equal(a.versionJs, b.versionJs);
    assert.match(a.BUILD.id, /^[0-9a-f]{10}$/);
    assert.equal(a.BUILD.label, 'v7 · 19/10');
    assert.ok(a.sw.includes("const VERSION = 'rade-' + BUILD.id;"));

    put('tools/t.mjs', 'export const autre = 1;'); put('README.md', 'autre'); put('release.json', JSON.stringify({ n: 8, date: '2026-10-20', note: 'autre', critical: true, hash: '' }));
    assert.equal(build(d).BUILD.id, a.BUILD.id, 'tools/, README et release.json ne créent pas de fausse version');

    put('js/a.js', 'export const a = 2;');
    const c = build(d).BUILD.id;
    assert.notEqual(c, a.BUILD.id, 'un octet de l’app change l’identifiant');

    put('sw.js', SW.replace('fetch', 'message'));
    assert.notEqual(build(d).BUILD.id, c, 'la logique du worker (hors bloc) change l’identifiant');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('check : contenu non releasé en erreur si strict, en avertissement sinon ; fichiers générés périmés toujours en erreur', () => {
  const { d, put } = appli();
  try {
    const b = build(d);
    writeFileSync(join(d, 'sw.js'), b.sw);
    writeFileSync(join(d, 'js/version.js'), b.versionJs);
    const strict = check(d, { strict: true });
    assert.ok(strict.errors.some((e) => /contenu modifié/.test(e)));
    const souple = check(d, { strict: false });
    assert.deepEqual(souple.errors, []);
    assert.ok(souple.warnings.some((w) => /contenu modifié/.test(w)));

    put('release.json', JSON.stringify({ n: 7, date: '2026-10-19', note: 'essai', critical: false, hash: b.hash }));
    assert.deepEqual(check(d, { strict: true }), { errors: [], warnings: [] });

    put('js/a.js', 'export const a = 3;');
    assert.ok(check(d, { strict: false }).errors.some((e) => /sw\.js est périmé/.test(e)), 'sw.js périmé : toujours une erreur');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('validateNote : refuse les chevrons, le vide et plus de 80 caractères', () => {
  assert.equal(validateNote('bips plus sûrs'), 'bips plus sûrs');
  assert.throws(() => validateNote('<b>gras</b>'), /ni </);
  assert.throws(() => validateNote('a > b'), /ni </);
  assert.throws(() => validateNote(''), /vide/);
  assert.throws(() => validateNote('   '), /vide/);
  assert.throws(() => validateNote('x'.repeat(81)), /80/);
  assert.equal(validateNote('x'.repeat(80)).length, 80);
});

// Tout ce que l’app charge : imports, index.html, icônes du manifeste, pdf.js
test('tout fichier chargé par l’app est dans le SHELL', () => {
  const shell = new Set(listShell(ROOT));
  const lu = (f) => readFileSync(join(ROOT, f), 'utf8');
  const jsFiles = readdirSync(join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
  const chargés = new Map(); // fichier → origine
  const noter = (f, origine) => { if (!chargés.has(f)) chargés.set(f, origine); };

  for (const f of jsFiles) {
    noter(f, 'dossier js/');
    const src = lu(f);
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) noter(posix.normalize('js/' + m[1]), f);
    for (const m of src.matchAll(/loadScript\(\s*['"]([^'"]+)['"]/g)) noter(m[1], f + ' loadScript');
    for (const m of src.matchAll(/workerSrc\s*=\s*['"]([^'"]+)['"]/g)) noter(m[1], f + ' workerSrc');
  }
  const html = lu('index.html');
  for (const m of html.matchAll(/(?<![-\w])(?:src|href)=["']([^"']+)["']/g)) {
    const u = m[1].split(/[?#]/)[0];
    if (!u || /^(https?:|\/\/|mailto:|tel:|data:)/.test(m[1]) || m[1].startsWith('#')) continue;
    noter(u.replace(/^\.\//, ''), 'index.html');
  }
  for (const ic of JSON.parse(lu('manifest.webmanifest')).icons) noter(ic.src.replace(/^\.\//, ''), 'manifest.webmanifest');

  for (const f of ['vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'icons/icon-maskable-512.png', 'js/version.js']) assert.ok(chargés.has(f) || shell.has(f), f);
  const manquants = [...chargés].filter(([f]) => !shell.has(f)).map(([f, o]) => `${f} (chargé par ${o})`);
  assert.deepEqual(manquants, [], 'fichiers chargés par l’app mais absents de la liste hors réseau');
});

test('la version n’est plus tenue à la main dans sw.js ni dans js/app.js', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.equal((sw.match(/stamp:begin/g) || []).length, 1);
  assert.ok(!/rade-v\d+/.test(sw), 'nom de cache écrit à la main');
  assert.ok(!/APP_VERSION/.test(readFileSync(join(ROOT, 'js/app.js'), 'utf8')), 'APP_VERSION doit disparaître de js/app.js (D-08)');
});
