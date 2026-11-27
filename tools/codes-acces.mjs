// Codes d’accès personnels (phase 8, D-08) : crée un code, ne laisse dans le dépôt que son empreinte SHA-256, dans la table de l’espace de
// middleware.js. Le code n’est montré qu’une fois, dans le lien personnel : s’il est perdu, `--retirer` puis en créer un autre.
//   node tools/codes-acces.mjs --espace <espace> --prenom <Prénom> [--hote <hôte>] [--fichier <middleware.js>]
//       tire un code (crypto.randomBytes), écrit la ligne '<empreinte>': '<Prénom>', affiche une seule fois le lien https://<hôte>/?acces=<code>
//   node tools/codes-acces.mjs --copier <Prénom> --de <espace> --espace <espace> [--fichier …]
//       recopie la ligne de ce membre (même empreinte, même prénom) dans la table d’un autre espace : il entre avec le même code
//   node tools/codes-acces.mjs --retirer <Prénom> --espace <espace> [--fichier …]
//       retire la ligne de ce membre de la table de l’espace (ses autres espaces ne changent pas)
//   node tools/codes-acces.mjs --empreinte-de <fichier hors du dépôt> --prenom <Prénom> --espace <espace> [--fichier …]
//       pose une empreinte déjà calculée (64 caractères hexadécimaux minuscules, seule ligne du fichier), sans l’afficher
// Aucune empreinte n’est jamais affichée ; le code n’est écrit dans aucun fichier. Écriture atomique (fichier temporaire puis renommage).
// L’hôte principal d’un espace est le premier de ses `hotes` dans ESPACES du fichier visé. Codes de sortie : 0 = fait, 1 = refusé (fichier inchangé).
// Node pur, aucune dépendance.

import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, realpathSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = /^[\p{L}\p{M} ’-]{1,40}$/u;                // règle d’api/archive.js, sans l’apostrophe droite (elle fermerait la chaîne de la table)
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';     // ni i, l, o, 0, 1 : rien d’ambigu à recopier
const HEX = /^[0-9a-f]{64}$/;

class Refus extends Error {}
const refuse = (message) => { throw new Refus(message); };
const empreinte = (code) => createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
const ascii = (prenom) => prenom.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Tirage uniforme dans l’alphabet (rejet des octets au-delà du dernier multiple)
function tire(n) {
  const max = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < n) for (const b of randomBytes(n * 2)) if (b < max && out.length < n) out += ALPHABET[b % ALPHABET.length];
  return out;
}
export const nouveauCode = (espace, prenom) => `${espace}-${ascii(prenom) || 'membre'}-${tire(4)}-${tire(4)}-${tire(4)}`;

// ───────────────────────── lecture du fichier

function espacesDu(src) {
  const bloc = /^export const ESPACES = \{\n([\s\S]*?)\n\};/m.exec(src);
  if (!bloc) refuse('ESPACES introuvable dans le fichier');
  const out = {};
  for (const m of bloc[1].matchAll(/^\s+(\w+): \{ table: (\w+), hotes: \[([^\]]*)\]/gm)) out[m[1]] = { table: m[2], hotes: [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]) };
  if (!Object.keys(out).length) refuse('aucun espace dans ESPACES');
  return out;
}
const motifTable = (nom) => new RegExp(`^const ${nom} = \\{\\n((?:  '[0-9a-f]{64}': '[^'\\n]+',\\n)*)\\};`, 'm');
function table(src, nom) {
  const m = motifTable(nom).exec(src);
  if (!m) refuse(`table ${nom} introuvable ou mal formée`);
  return [...m[1].matchAll(/^  '([0-9a-f]{64})': '([^'\n]+)',$/gm)].map(([, hex, prenom]) => ({ hex, prenom }));
}
function avecTable(src, nom, lignes) {
  const corps = lignes.map(({ hex, prenom }) => `  '${hex}': '${prenom}',\n`).join('');
  return src.replace(motifTable(nom), () => `const ${nom} = {\n${corps}};`);
}

// ───────────────────────── opérations (texte → texte ; rien n’est écrit ici)

function espaceVise(espaces, id) {
  if (typeof id !== 'string' || !Object.hasOwn(espaces, id)) refuse(`espace inconnu : ${String(id).slice(0, 40)}`);
  return espaces[id];
}
function prenomValide(prenom) {
  if (typeof prenom !== 'string' || !NAME.test(prenom.trim()) || prenom.trim() !== prenom) refuse('prénom invalide (lettres, espaces, tirets et ’ seulement, 40 caractères au plus)');
  return prenom;
}
// Une empreinte présente dans deux tables doit y porter le même prénom
function coherente(src, espaces, cible, hex, prenom) {
  for (const [id, e] of Object.entries(espaces)) {
    if (id === cible) continue;
    const l = table(src, e.table).find((x) => x.hex === hex);
    if (l && l.prenom !== prenom) refuse(`cette empreinte est déjà celle d’un autre membre dans l’espace ${id}`);
  }
}
function ajoute(src, espaces, id, hex, prenom) {
  const e = espaceVise(espaces, id), lignes = table(src, e.table);
  if (lignes.some((l) => l.prenom === prenom)) refuse(`${prenom} a déjà une ligne dans l’espace ${id}`);
  if (lignes.some((l) => l.hex === hex)) refuse(`cette empreinte a déjà une ligne dans l’espace ${id}`);
  coherente(src, espaces, id, hex, prenom);
  return avecTable(src, e.table, [...lignes, { hex, prenom }]);
}

export function creer(src, { espace, prenom, hote }) {
  const espaces = espacesDu(src), e = espaceVise(espaces, espace);
  prenomValide(prenom);
  const h = hote ?? e.hotes[0];
  if (typeof h !== 'string' || !/^[a-z0-9.-]+(:\d{1,5})?$/.test(h)) refuse('hôte invalide');
  const code = nouveauCode(espace, prenom);
  return { texte: ajoute(src, espaces, espace, empreinte(code), prenom), code, lien: `https://${h}/?acces=${code}` };
}
export function copier(src, { prenom, de, espace }) {
  const espaces = espacesDu(src), source = espaceVise(espaces, de);
  prenomValide(prenom);
  if (de === espace) refuse('espaces source et cible identiques');
  const l = table(src, source.table).find((x) => x.prenom === prenom);
  if (!l) refuse(`${prenom} n’a pas de ligne dans l’espace ${de}`);
  return ajoute(src, espaces, espace, l.hex, prenom);
}
export function retirer(src, { prenom, espace }) {
  const espaces = espacesDu(src), e = espaceVise(espaces, espace);
  prenomValide(prenom);
  const lignes = table(src, e.table);
  if (!lignes.some((l) => l.prenom === prenom)) refuse(`${prenom} n’a pas de ligne dans l’espace ${espace}`);
  return avecTable(src, e.table, lignes.filter((l) => l.prenom !== prenom));
}
export function poserEmpreinte(src, { contenu, prenom, espace }) {
  const espaces = espacesDu(src);
  espaceVise(espaces, espace);
  prenomValide(prenom);
  const lignes = String(contenu).split('\n');
  if (lignes.length > 2 || (lignes.length === 2 && lignes[1] !== '') || !HEX.test(lignes[0])) refuse('le fichier doit contenir une seule ligne : 64 caractères hexadécimaux minuscules');
  return ajoute(src, espaces, espace, lignes[0], prenom);
}

// ───────────────────────── ligne de commande

function options(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--') || i + 1 >= argv.length) refuse(`option incomplète : ${a.slice(0, 40)}`);
    o[a.slice(2)] = argv[++i];
  }
  return o;
}
const dansLeDepot = (chemin) => {
  let reel;
  try { reel = realpathSync(chemin); } catch { refuse('fichier d’empreinte illisible'); }
  const r = relative(realpathSync(DEPOT), reel);
  return r === '' || (!r.startsWith('..') && !isAbsolute(r));
};
function ecrit(fichier, texte) {
  const tmp = join(dirname(fichier), `.codes-acces-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
  try { writeFileSync(tmp, texte); renameSync(tmp, fichier); } catch (e) { try { unlinkSync(tmp); } catch { /* déjà absent */ } throw e; }
}

function principal(argv) {
  const o = options(argv);
  const fichier = resolve(o.fichier ?? join(DEPOT, 'middleware.js'));
  let src;
  try { src = readFileSync(fichier, 'utf8'); } catch { refuse('fichier du middleware illisible'); }
  if (o.copier !== undefined) {
    if (!o.de || !o.espace) refuse('--copier demande --de <espace> et --espace <espace>');
    ecrit(fichier, copier(src, { prenom: o.copier, de: o.de, espace: o.espace }));
    return 'ligne copiée';
  }
  if (o.retirer !== undefined) {
    if (!o.espace) refuse('--retirer demande --espace <espace>');
    ecrit(fichier, retirer(src, { prenom: o.retirer, espace: o.espace }));
    return 'ligne retirée';
  }
  if (o['empreinte-de'] !== undefined) {
    if (!o.prenom || !o.espace) refuse('--empreinte-de demande --prenom <Prénom> et --espace <espace>');
    if (dansLeDepot(o['empreinte-de'])) refuse('le fichier d’empreinte doit être hors du dépôt');
    let contenu;
    try { contenu = readFileSync(o['empreinte-de'], 'utf8'); } catch { refuse('fichier d’empreinte illisible'); }
    ecrit(fichier, poserEmpreinte(src, { contenu, prenom: o.prenom, espace: o.espace }));
    return 'ligne ajoutée';
  }
  if (!o.espace || !o.prenom) refuse('usage : --espace <espace> --prenom <Prénom> [--hote <hôte>] [--fichier <middleware.js>]');
  const { texte, lien } = creer(src, { espace: o.espace, prenom: o.prenom, hote: o.hote });
  ecrit(fichier, texte);
  return [
    `Lien personnel de ${o.prenom} (espace ${o.espace}) : ${lien}`,
    'Le code est la fin du lien, après « acces= ». Il n’est montré qu’une fois et n’est écrit nulle part : s’il est perdu, --retirer puis en créer un autre.',
    'Redéployer pour que la ligne prenne effet.',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(principal(process.argv.slice(2)) + '\n');
  } catch (e) {
    process.stderr.write(`refusé : ${e instanceof Refus ? e.message : 'erreur inattendue'}\n`);
    process.exit(1);
  }
}
