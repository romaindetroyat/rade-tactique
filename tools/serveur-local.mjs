// Serveur local commun aux outils de Chromium (regate-e2e.mjs, measure-boot.mjs) : il sert le dépôt comme la production le ferait.
//   - les en-têtes de sécurité de vercel.json sont posés, règle par règle, avec l’émulation des motifs `source` de Vercel ;
//   - la liste blanche du middleware (cheminDeLApp, la MÊME fonction qu’en production) refuse tout ce qui n’est pas l’app : 404, et le chemin
//     est noté dans `refuses`, pour que l’outil échoue si l’app demandait un jour un chemin interne.
// Rien ne démarre à l’import du module. Aucun code d’accès, aucune empreinte : le middleware n’est pas exécuté, seule sa liste blanche l’est.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { cheminDeLApp } from '../middleware.js';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.pol': 'text/plain; charset=utf-8',
};

// Les règles `headers` de vercel.json : [{ source, headers: [{ key, value }] }]
export function lireEntetes(root) {
  return JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).headers || [];
}

// Motif `source` de Vercel → expression régulière ancrée. Syntaxe émulée : littéraux, `/:nom*` (segment facultatif) et groupes `( … )` gardés
// comme expression brute. Toute autre syntaxe lève une erreur : un nouveau motif dans vercel.json fait échouer les tests au lieu d’être mal émulé.
export function motifSource(source) {
  let re = '';
  for (let i = 0; i < source.length;) {
    const reste = source.slice(i);
    const joker = /^\/:[A-Za-z_]\w*\*/.exec(reste);
    if (joker) { re += '(?:\\/.*)?'; i += joker[0].length; continue; }
    const c = source[i];
    if (c === '(') {
      let profondeur = 0, j = i;
      for (; j < source.length; j++) {
        if (source[j] === '\\') { j++; continue; }
        if (source[j] === '(') profondeur++;
        else if (source[j] === ')' && --profondeur === 0) break;
      }
      if (j >= source.length) throw new Error(`motif de vercel.json non émulé (parenthèse ouverte) : ${source}`);
      re += source.slice(i, j + 1); i = j + 1; continue;
    }
    if (/[A-Za-z0-9/._-]/.test(c)) { re += c.replace(/[./]/g, '\\$&'); i++; continue; }
    throw new Error(`motif de vercel.json non émulé (« ${c} ») : ${source}`);
  }
  return new RegExp('^' + re + '$');
}

// Les règles qui s’appliquent à un chemin (sans requête), dans l’ordre de vercel.json
export const reglesPour = (chemin, regles) => regles.filter((r) => motifSource(r.source).test(chemin));

// En-têtes fusionnés dans l’ordre de vercel.json : { nom-en-minuscules: valeur }
export function entetesPour(chemin, regles) {
  const out = {};
  for (const r of reglesPour(chemin, regles)) for (const { key, value } of r.headers) out[key.toLowerCase()] = value;
  return out;
}

// Serveur statique sur 127.0.0.1, port libre. Renvoie { serveur, base, refuses } ; `refuses` reçoit chaque chemin brut refusé par la liste blanche.
export async function demarreServeur({ root }) {
  const regles = lireEntetes(root);
  const refuses = [];
  const serveur = createServer(async (req, res) => {
    try {
      const brut = new URL(req.url, 'http://x').pathname;      // chemin brut, tel que le middleware le reçoit
      if (!cheminDeLApp(brut)) { refuses.push(brut); res.writeHead(404); res.end(); return; }
      let u = decodeURIComponent(brut);
      if (u.endsWith('/')) u += 'index.html';
      const f = normalize(join(root, u));
      if (f !== root.slice(0, -1) && !f.startsWith(root)) throw new Error('hors dépôt');
      const octets = await readFile(f);
      res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache', ...entetesPour(brut, regles) });
      res.end(octets);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  return { serveur, base: `http://127.0.0.1:${serveur.address().port}/`, refuses };
}
