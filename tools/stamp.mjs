// Version et liste hors réseau générées : plus rien n’est tenu à la main dans sw.js ni dans js/app.js.
// Source humaine : release.json (n, date, note, critical, hash). Node pur, aucune dépendance, aucun git.
//   node tools/stamp.mjs                       écrit le bloc généré de sw.js et js/version.js
//   node tools/stamp.mjs --release "note" [--critical]
//                                              n + 1, date du jour (Paris), écrit, enregistre le hachage dans release.json
//   node tools/stamp.mjs --check               n’écrit rien ; code 1 si sw.js / js/version.js sont périmés
//                                              (et, en production ou avec RT_STRICT=1, si le contenu a changé sans release)
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_FILES = ['index.html', 'styles.css', 'manifest.webmanifest', 'guide.html', 'regles.html'];
const DIRS = ['js', 'data', 'vendor', 'icons'];
const SKIP = /\.(txt|md|py)$|(^|\/)\.|LICENSE/;
const GENERATED = 'js/version.js';                      // dans le SHELL, hors hachage (il contient le hachage)
const BEGIN = '/* stamp:begin — bloc généré par tools/stamp.mjs, ne pas modifier à la main */';
const END = '/* stamp:end */';
const NOTE_MAX = 80;

// Tous les fichiers d’un dossier, chemins relatifs avec « / », récursif
function walk(root, dir) {
  const out = [];
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (SKIP.test(rel)) continue;
    if (e.isDirectory()) out.push(...walk(root, rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

// Liste des fichiers précachés : './' puis le reste trié. js/version.js y figure même s’il n’existe pas encore.
export function listShell(root) {
  const files = new Set(ROOT_FILES.filter((f) => existsSync(join(root, f))));
  for (const d of DIRS) for (const f of walk(root, d)) files.add(f);
  files.add(GENERATED);
  return ['./', ...[...files].sort()];
}

// sw.js sans son bloc généré (le bloc est remplacé par un repère fixe)
function swTemplateOf(sw) {
  const a = sw.indexOf('/* stamp:begin');
  const z = sw.indexOf(END);
  if (a < 0 || z < a) throw new Error('sw.js : marqueurs stamp:begin / stamp:end introuvables');
  return sw.slice(0, a) + '@@stamp@@' + sw.slice(z + END.length);
}

// 10 hex de SHA-256 : logique du worker (hors bloc) puis chemin et contenu de chaque fichier du SHELL
export function contentHash(shell, swTemplate, root) {
  const h = createHash('sha256');
  h.update(swTemplate);
  for (const f of shell) {
    if (f === './' || f === GENERATED) continue;
    h.update('\0' + f + '\0');
    h.update(readFileSync(join(root, f)));
  }
  return h.digest('hex').slice(0, 10);
}

// La note est affichée dans l’app : courte, sans balise
export function validateNote(note) {
  if (typeof note !== 'string' || !note.trim()) throw new Error('la note de version est vide');
  if (note.length > NOTE_MAX) throw new Error(`la note de version dépasse ${NOTE_MAX} caractères`);
  if (/[<>]/.test(note)) throw new Error('la note de version ne doit contenir ni < ni >');
  return note;
}

const readRelease = (root) => JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const labelOf = (n, date) => `v${n} · ${date.slice(8, 10)}/${date.slice(5, 7)}`;

// Ce que l’écriture produirait : { BUILD, sw, versionJs, hash, rel } (rel peut être surchargé par --release)
export function build(root, rel = readRelease(root)) {
  validateNote(rel.note);
  if (!Number.isInteger(rel.n) || !/^\d{4}-\d\d-\d\d$/.test(rel.date)) throw new Error('release.json : n ou date invalide');
  const sw0 = readFileSync(join(root, 'sw.js'), 'utf8');
  const shell = listShell(root);
  const hash = contentHash(shell, swTemplateOf(sw0), root);
  const BUILD = { n: rel.n, date: rel.date, label: labelOf(rel.n, rel.date), note: rel.note, critical: !!rel.critical, id: hash };
  const block = [
    BEGIN,
    `const BUILD = ${JSON.stringify(BUILD)};`,
    `const VERSION = 'rade-' + BUILD.id;`,
    `const SHELL = ${JSON.stringify(shell)};`,
    END,
  ].join('\n');
  const a = sw0.indexOf('/* stamp:begin');
  const z = sw0.indexOf(END) + END.length;
  const sw = sw0.slice(0, a) + block + sw0.slice(z);
  const versionJs = `// Généré par tools/stamp.mjs — ne pas modifier à la main.\nexport const BUILD = ${JSON.stringify(BUILD)};\n`;
  return { BUILD, sw, versionJs, hash, rel };
}

// Vérification sans écriture : erreurs bloquantes et avertissements
export function check(root, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  let b;
  try { b = build(root); } catch (e) { return { errors: [e.message], warnings }; }
  const same = (f, want) => { try { return readFileSync(join(root, f), 'utf8') === want; } catch { return false; } };
  if (!same('sw.js', b.sw)) errors.push('sw.js est périmé : lancez npm run stamp');
  if (!same(GENERATED, b.versionJs)) errors.push('js/version.js est périmé : lancez npm run stamp');
  if (b.rel.hash !== b.hash) {
    const msg = `contenu modifié depuis la v${b.rel.n} : lancez npm run release -- "ce qui change"`;
    (strict ? errors : warnings).push(msg);
  }
  return { errors, warnings };
}

// ───────────────────────── ligne de commande (seulement si exécuté directement)
function parisToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

function main(root, argv) {
  if (argv.includes('--check')) {
    const strict = process.env.VERCEL_ENV === 'production' || process.env.RT_STRICT === '1';
    const { errors, warnings } = check(root, { strict });
    for (const w of warnings) console.error('avertissement : ' + w);
    for (const e of errors) console.error('erreur : ' + e);
    if (errors.length) return 1;
    console.log('stamp à jour');
    return 0;
  }
  let rel = readRelease(root);
  const i = argv.indexOf('--release');
  if (i >= 0) {
    try { validateNote(argv[i + 1]); } catch (e) { console.error('erreur : ' + e.message); return 1; }
    rel = { ...rel, n: rel.n + 1, date: parisToday(), note: argv[i + 1], critical: argv.includes('--critical') };
  }
  const b = build(root, rel);
  writeFileSync(join(root, 'sw.js'), b.sw);
  writeFileSync(join(root, GENERATED), b.versionJs);
  if (i >= 0) writeFileSync(join(root, 'release.json'), JSON.stringify({ ...rel, hash: b.hash }, null, 2) + '\n');
  console.log(`stamp écrit : ${b.BUILD.label} · ${b.hash} · ${listShell(root).length} fichiers`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(fileURLToPath(new URL('../', import.meta.url)), process.argv.slice(2));
}
