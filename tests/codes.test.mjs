// tools/codes-acces.mjs (phase 8, D-08) : l’outil est exécuté sur une COPIE temporaire d’un faux middleware, hors du dépôt. Le faux middleware
// reprend la forme du vrai middleware.js, chaque empreinte réelle remplacée (en mémoire) par celle d’un faux code calculée ici : aucune
// empreinte réelle n’est écrite. Vérifié : le code n’apparaît qu’une fois dans la sortie et dans aucun fichier, l’empreinte écrite est celle
// du code normalisé, aucune suite de 64 hexadécimaux n’est affichée, refus sans modification, copie et retrait de lignes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers/setup.mjs';

const OUTIL = ROOT + 'tools/codes-acces.mjs';
const sha = (c) => createHash('sha256').update(c.trim().toLowerCase()).digest('hex');
const HEX64 = /[0-9a-f]{64}/;
const ALPHA = '[abcdefghjkmnpqrstuvwxyz23456789]{4}';

let dir, fichier, faux;
// Le vrai middleware.js, empreintes remplacées par celles de faux codes (une empreinte commune à deux tables reste commune), table TOFINOU
// vidée : l’état de départ des essais ne dépend pas des accès déjà posés
function fauxMiddleware() {
  const vrai = readFileSync(ROOT + 'middleware.js', 'utf8'), vus = new Map();
  return vrai.replace(/'([0-9a-f]{64})'(\s*:)/g, (_, hex, s) => {
    if (!vus.has(hex)) vus.set(hex, sha(`code-faux-${vus.size}`));
    return `'${vus.get(hex)}'${s}`;
  }).replace(/^const TOFINOU = \{\n[\s\S]*?\};/m, 'const TOFINOU = {\n};');
}
before(() => { dir = mkdtempSync(join(tmpdir(), 'codes-acces-')); fichier = join(dir, 'middleware.js'); faux = fauxMiddleware(); });
after(() => rmSync(dir, { recursive: true, force: true }));
const remet = () => writeFileSync(fichier, faux);
const lit = () => readFileSync(fichier, 'utf8');
function outil(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [OUTIL, ...args, '--fichier', fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), err: '' };
  } catch (e) { return { code: e.status, out: String(e.stdout || ''), err: String(e.stderr || '') }; }
}
const bloc = (src, nom) => new RegExp(`^const ${nom} = \\{\\n([\\s\\S]*?)\\};`, 'm').exec(src)[1];
const lignes = (src, nom) => [...bloc(src, nom).matchAll(/'([0-9a-f]{64})': '([^']+)'/g)].map(([, hex, prenom]) => ({ hex, prenom }));

test('le faux middleware a la forme du vrai et aucune de ses empreintes', () => {
  const vraies = [...readFileSync(ROOT + 'middleware.js', 'utf8').matchAll(/'([0-9a-f]{64})'\s*:/g)].map((m) => m[1]);
  assert.ok(vraies.length >= 3);
  assert.ok(!vraies.some((h) => faux.includes(h)), 'aucune empreinte réelle dans la copie');
  assert.deepEqual(lignes(faux, 'EQUIPAGE').map((l) => l.prenom), ['Romain', 'Teiva', 'Thibaud']);
  assert.deepEqual(lignes(faux, 'TOFINOU'), [], 'table Tofinou vide au départ');
});

test('création : code tiré au hasard, montré une seule fois dans le lien personnel, empreinte seule écrite, jamais affichée', () => {
  remet();
  const r = outil(['--espace', 'tofinou', '--prenom', 'Frédéric']);
  assert.equal(r.code, 0, r.err);
  const m = /https:\/\/tofinou-bormes\.vercel\.app\/\?acces=([a-z0-9-]+)\n/.exec(r.out);
  assert.ok(m, 'lien personnel de l’hôte principal de l’espace');
  const code = m[1];
  assert.match(code, new RegExp(`^tofinou-frederic-${ALPHA}-${ALPHA}-${ALPHA}$`));
  assert.equal(r.out.split(code).length - 1, 1, 'le code n’apparaît qu’une fois dans la sortie');
  assert.ok(!HEX64.test(r.out + r.err), 'aucune empreinte affichée');
  const apres = lit();
  assert.ok(!apres.includes(code), 'le code n’est écrit dans aucun fichier');
  assert.deepEqual(lignes(apres, 'TOFINOU').filter((l) => l.prenom === 'Frédéric').map((l) => l.hex === sha(code)), [true], 'empreinte du code normalisé');
  assert.equal(bloc(apres, 'EQUIPAGE'), bloc(faux, 'EQUIPAGE'), 'la table de Naos ne change pas');
  assert.equal(apres.replace(`  '${sha(code)}': 'Frédéric',\n`, ''), faux, 'une seule ligne ajoutée, rien d’autre ne change');
  assert.deepEqual(readdirSync(dir), ['middleware.js'], 'aucun autre fichier écrit (écriture atomique, temporaire retiré)');
  // un second code est différent
  const r2 = outil(['--espace', 'tofinou', '--prenom', 'Éloïse-Marie', '--hote', 'autre.example']);
  assert.equal(r2.code, 0, r2.err);
  const code2 = /https:\/\/autre\.example\/\?acces=([a-z0-9-]+)\n/.exec(r2.out)?.[1];
  assert.match(code2, new RegExp(`^tofinou-eloise-marie-${ALPHA}-${ALPHA}-${ALPHA}$`));
  assert.notEqual(code2, code);
});

test('refus (code 1, fichier inchangé, aucune empreinte affichée) : espace inconnu, prénom invalide ou déjà présent, table absente, options incomplètes', () => {
  remet();
  const cas = [
    ['--espace', 'inconnu', '--prenom', 'Frédéric'], ['--espace', '__proto__', '--prenom', 'Frédéric'], ['--espace', 'Tofinou', '--prenom', 'Frédéric'],
    ['--espace', 'tofinou', '--prenom', '1234'], ['--espace', 'tofinou', '--prenom', 'a'.repeat(41)], ['--espace', 'tofinou', '--prenom', 'O\'Neil'],
    ['--espace', 'tofinou', '--prenom', 'Rom/ain'], ['--espace', 'tofinou', '--prenom', ' Frédéric'], ['--espace', 'naos', '--prenom', 'Teiva'],
    ['--espace', 'tofinou', '--prenom', 'Frédéric', '--hote', 'a/b'], ['--espace', 'tofinou'], ['--prenom', 'Frédéric'], ['--espace'],
  ];
  for (const args of cas) {
    const r = outil(args);
    assert.equal(r.code, 1, JSON.stringify(args));
    assert.equal(lit(), faux, `fichier modifié : ${JSON.stringify(args)}`);
    assert.ok(!HEX64.test(r.out + r.err));
    assert.match(r.err, /^refusé : /);
  }
  // prénom déjà présent dans la table visée
  assert.equal(outil(['--espace', 'tofinou', '--prenom', 'Frédéric']).code, 0);
  const avant = lit();
  const r = outil(['--espace', 'tofinou', '--prenom', 'Frédéric']);
  assert.equal(r.code, 1); assert.equal(lit(), avant);
  // fichier sans la table attendue
  writeFileSync(fichier, faux.replace('const TOFINOU = {', 'const AUTRE = {'));
  const sans = lit();
  assert.equal(outil(['--espace', 'tofinou', '--prenom', 'Lucie']).code, 1);
  assert.equal(lit(), sans);
});

test('--copier : même empreinte et même prénom dans l’autre espace, sortie « ligne copiée » seulement ; refus si absent ou déjà présent', () => {
  remet();
  const r = outil(['--copier', 'Romain', '--de', 'naos', '--espace', 'tofinou']);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'ligne copiée\n');
  assert.equal(r.err, '');
  const apres = lit(), romain = lignes(apres, 'EQUIPAGE').find((l) => l.prenom === 'Romain');
  const copie = lignes(apres, 'TOFINOU').find((l) => l.prenom === 'Romain');
  assert.ok(copie && copie.hex === romain.hex, 'même empreinte');
  assert.equal(bloc(apres, 'EQUIPAGE'), bloc(faux, 'EQUIPAGE'));
  for (const args of [['--copier', 'Romain', '--de', 'naos', '--espace', 'tofinou'], ['--copier', 'Lucie', '--de', 'naos', '--espace', 'tofinou'],
    ['--copier', 'Romain', '--de', 'naos', '--espace', 'naos'], ['--copier', 'Romain', '--de', 'inconnu', '--espace', 'tofinou'], ['--copier', 'Romain', '--espace', 'tofinou']]) {
    const k = outil(args);
    assert.equal(k.code, 1, JSON.stringify(args)); assert.equal(lit(), apres); assert.ok(!HEX64.test(k.out + k.err));
  }
});

test('--retirer : la ligne quitte la table de l’espace, les autres espaces ne changent pas ; refus si absente', () => {
  remet();
  assert.equal(outil(['--copier', 'Romain', '--de', 'naos', '--espace', 'tofinou']).code, 0);
  const r = outil(['--retirer', 'Romain', '--espace', 'tofinou']);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'ligne retirée\n');
  assert.equal(lit(), faux, 'retour exact au fichier de départ');
  const k = outil(['--retirer', 'Romain', '--espace', 'tofinou']);
  assert.equal(k.code, 1); assert.equal(lit(), faux);
});

test('--empreinte-de : empreinte lue dans un fichier hors du dépôt, jamais affichée ; refus d’un fichier du dépôt ou mal formé', () => {
  remet();
  const hex = sha('code-pose-de-test'), source = join(dir, 'empreinte.txt');
  // mal formées : majuscules, trop courte, deux lignes, espaces
  for (const contenu of [hex.toUpperCase(), hex.slice(1), `${hex}\n${hex}\n`, ` ${hex}`, '', 'z'.repeat(64)]) {
    writeFileSync(source, contenu);
    const k = outil(['--empreinte-de', source, '--prenom', 'Frédéric', '--espace', 'tofinou']);
    assert.equal(k.code, 1); assert.equal(lit(), faux); assert.ok(!HEX64.test(k.out + k.err));
  }
  // un fichier du dépôt est refusé avant d’être lu
  const dep = outil(['--empreinte-de', ROOT + 'package.json', '--prenom', 'Frédéric', '--espace', 'tofinou']);
  assert.equal(dep.code, 1); assert.match(dep.err, /hors du dépôt/); assert.equal(lit(), faux);
  // une empreinte déjà portée par un autre prénom dans un autre espace est refusée
  const teiva = lignes(faux, 'EQUIPAGE').find((l) => l.prenom === 'Teiva').hex;
  writeFileSync(source, teiva + '\n');
  const autre = outil(['--empreinte-de', source, '--prenom', 'Frédéric', '--espace', 'tofinou']);
  assert.equal(autre.code, 1); assert.equal(lit(), faux); assert.ok(!HEX64.test(autre.out + autre.err));
  // bonne forme
  writeFileSync(source, hex + '\n');
  const r = outil(['--empreinte-de', source, '--prenom', 'Frédéric', '--espace', 'tofinou']);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'ligne ajoutée\n');
  assert.ok(lignes(lit(), 'TOFINOU').some((l) => l.hex === hex && l.prenom === 'Frédéric'));
  assert.equal(lit().replace(`  '${hex}': 'Frédéric',\n`, ''), faux);
});
