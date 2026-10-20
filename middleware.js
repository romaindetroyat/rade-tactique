// Accès réservé à l'équipage de Naos (J80) : chaque équipier a un code personnel.
// Le code arrive par un lien (…?acces=CODE) ou par la page acces.html ; il est gardé dans un cookie de 400 jours.
// Seules les empreintes SHA-256 des codes sont ici : pour retirer un accès, supprimer sa ligne et redéployer.
import { next } from '@vercel/functions';

const EQUIPAGE = {
  '82d6f57ee27c4dd70d5998dc1a7a88954861050c82047d0184702ad30eff414f': 'Romain',
  '0b8feb03445d9e7fb0b9377a4ee3006ea48cb3302e8f9d38d44fa4668f72cea6': 'Teiva',
  '0a3f4c7910ffbfb574f7250ceba87db0730182e815769948cf5d3d3b089d6fc5': 'Thibaud',
};
const COOKIE = 'rt_acces';
const MAX_AGE = 400 * 24 * 3600; // durée maximale admise par les navigateurs

// Restent publics : quatre noms EXACTS (page de connexion et son script, manifeste, service worker) et les dossiers icons/ et rapports/.
// Les quatre noms sont ancrés par « $ » : /sw.js.map, /sw.jsx, /acces.html.bak, /acces.json… restent privés.
export const config = {
  matcher: ['/((?!acces\\.html$|acces\\.js$|manifest\\.webmanifest$|sw\\.js$|icons/|rapports/).*)'],
};

async function membre(code) {
  if (!code) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim().toLowerCase()));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return EQUIPAGE[hex] || null;
}

const lireCookie = (req) => {
  const m = /(?:^|;\s*)rt_acces=([^;]+)/.exec(req.headers.get('cookie') || '');
  return m ? decodeURIComponent(m[1]) : null;
};

// Adresse d'une fonction /api/ sous toutes ses écritures (majuscules, encodage %61pi) : une adresse mal décodée ici est traitée comme /api/ par précaution
const versApi = (chemin) => {
  let d = chemin;
  try { d = decodeURIComponent(chemin); } catch { return true; }
  d = d.toLowerCase();
  return d === '/api' || d.startsWith('/api/');
};

// Ce que l'app sert vraiment. Le dépôt entier est publié (outputDirectory « . ») : planification, sources des fonctions, tests, outils, documents
// et ce fichier-ci (les empreintes des codes) y sont aussi. C'est donc une LISTE BLANCHE, jamais une liste noire : une liste noire laisserait
// passer le prochain dossier interne (.vercel/, node_modules/, un nouveau fichier de notes). Le chemin est jugé tel que reçu (encodé) :
// toute forme déguisée (%2F, %2e%2e, //, \, segment en point, majuscules, .js, _) est refusée avant le reste.
const NOMS_PUBLICS = new Set(['/', '/index.html', '/guide.html', '/regles.html', '/styles.css', '/manifest.webmanifest', '/sw.js', '/acces.html', '/acces.js']);
const FICHIER_DE_DOSSIER = /^\/(?:js|data|vendor|icons|rapports)\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FONCTION_API = /^\/api\/[a-z0-9-]+$/;
export function cheminDeLApp(chemin) {
  if (typeof chemin !== 'string' || !chemin.startsWith('/')) return false;
  if (/[%\\]|\/\/|\/\./.test(chemin)) return false;
  return NOMS_PUBLICS.has(chemin) || FICHIER_DE_DOSSIER.test(chemin) || FONCTION_API.test(chemin);
}

// Un fichier interne n'existe pas, pour un équipier connecté comme pour les autres : corps fixe, jamais le chemin demandé ni un cookie
const introuvable = (chemin) => {
  const api = chemin.startsWith('/api');
  return new Response(api ? '{"error":"introuvable"}' : 'Introuvable.', {
    status: 404,
    headers: { 'Content-Type': api ? 'application/json' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
};

const redirige = (location, extra = {}) => new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', ...extra } });

export default async function middleware(req) {
  const url = new URL(req.url);

  // lien personnel ou formulaire de acces.html : ?acces=CODE
  const code = url.searchParams.get('acces');
  if (code !== null) {
    url.searchParams.delete('acces');
    const suite = url.pathname + url.search;
    if (await membre(code)) {
      return redirige(suite, { 'Set-Cookie': `${COOKIE}=${encodeURIComponent(code.trim().toLowerCase())}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` });
    }
    return redirige(`/acces.html?erreur=1&suite=${encodeURIComponent(suite)}`);
  }

  // D-05 : le prénom de l'équipier connecté (jamais le code ni l'empreinte) sert à signer ce qu'il crée dans l'app ; réponse minuscule, jamais mise en cache
  const prenom = await membre(lireCookie(req));
  if (prenom) {
    if (req.method === 'GET' && url.pathname === '/api/membre') return Response.json({ membre: prenom }, { headers: { 'Cache-Control': 'no-store' } });
    // Tout ce qui n'est pas l'app (fichiers internes du dépôt) : 404 sans écho, après authentification seulement
    if (!cheminDeLApp(url.pathname)) return introuvable(url.pathname);
    // ARCH-01 : les fonctions /api/ apprennent QUI écrit par l'en-tête x-rt-membre, posé ici après vérification du code : c'est la seule source
    // de l'auteur (celui du navigateur est remplacé). Le prénom est encodé (une valeur d'en-tête reste en octets simples). Le cookie du code
    // d'accès n'est pas transmis aux fonctions. Le reste du site passe tel quel.
    if (versApi(url.pathname)) {
      const h = new Headers(req.headers);
      h.delete('cookie');
      h.set('x-rt-membre', encodeURIComponent(prenom));
      return next({ request: { headers: h } });
    }
    return next();
  }

  // page demandée par le navigateur : vers la connexion ; fichiers et API : refus net (rien ne doit être mis en cache)
  const navigation = req.headers.get('sec-fetch-mode') === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (navigation) return redirige(`/acces.html?suite=${encodeURIComponent(url.pathname + url.search)}`);
  const api = url.pathname.startsWith('/api/');
  return new Response(api ? '{"error":"acces"}' : 'Accès réservé à l’équipage.', {
    status: 401,
    headers: { 'Content-Type': api ? 'application/json' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
