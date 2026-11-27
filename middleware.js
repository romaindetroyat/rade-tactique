// Accès réservé aux équipages : chaque membre a un code personnel, valable dans un ou plusieurs espaces (Naos : J80, Toulon et Brest ;
// Tofinou : Tofinou 9.5, Bormes – Le Lavandou). Le code arrive par un lien (…?acces=CODE) ou par la page acces.html ; il est gardé dans un
// cookie de 400 jours. Seules les empreintes SHA-256 des codes sont ici, une table par espace : pour retirer un accès, supprimer sa ligne
// (node tools/codes-acces.mjs --retirer <Prénom> --espace <espace>) et redéployer.
// L’espace d’une requête est décidé ici, par le code et l’hôte, jamais par la page : les fonctions /api/ le reçoivent par x-rt-espace.
import { next, rewrite } from '@vercel/functions';

const EQUIPAGE = {
  '82d6f57ee27c4dd70d5998dc1a7a88954861050c82047d0184702ad30eff414f': 'Romain',
  '0b8feb03445d9e7fb0b9377a4ee3006ea48cb3302e8f9d38d44fa4668f72cea6': 'Teiva',
  '0a3f4c7910ffbfb574f7250ceba87db0730182e815769948cf5d3d3b089d6fc5': 'Thibaud',
};
// Espace Tofinou : lignes ajoutées par tools/codes-acces.mjs (empreinte seule, jamais le code). Un membre de deux espaces a la même ligne
// (même empreinte, même prénom) dans les deux tables.
const TOFINOU = {
  '8c33171f1d71db9d88f9a4f00d348a282da387a4bfcedd1903c925a9d599c373': 'Frédéric',
  '82d6f57ee27c4dd70d5998dc1a7a88954861050c82047d0184702ad30eff414f': 'Romain',
};
const COOKIE = 'rt_acces';
const MAX_AGE = 400 * 24 * 3600; // durée maximale admise par les navigateurs

// Espaces : table des empreintes, hôtes connus (mêmes listes que js/espaces.js, test de parité), packs de plans d’eau propres à l’espace.
// Sur un hôte connu, l’espace est celui de l’hôte s’il est ouvert au code ; sur un hôte inconnu (aperçu), le premier espace du code.
// Les noms locaux (127.0.0.1, localhost, tofinou.localhost) n’arrivent jamais sur Vercel : ils servent aux essais.
export const ESPACES = {
  naos: { table: EQUIPAGE, hotes: ['rade-tactique.vercel.app', '127.0.0.1', 'localhost'], packs: ['brest'] },
  tofinou: { table: TOFINOU, hotes: ['tofinou-bormes.vercel.app', 'tofinou.localhost'], packs: ['bormes'] },
};

// Vercel n’exécute le middleware que sur les chemins du matcher : trois noms publics exacts (acces.html, acces.js, sw.js) et deux dossiers
// (icons/, rapports/) y échappent, chaque nom ancré par `$` (un nom voisin comme sw.js.map ou acces.html.bak passe par le middleware).
// Les manifestes passent par le middleware, qui les traite en tout premier et sans code (manifestePour, creerMiddleware ; phase 8, D-07).
export const config = {
  matcher: ['/((?!acces\\.html$|acces\\.js$|sw\\.js$|icons/|rapports/).*)'],
};

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
const NOMS_PUBLICS = new Set(['/', '/index.html', '/guide.html', '/guide-tofinou.html', '/regles.html', '/styles.css', '/manifest.webmanifest', '/manifest-tofinou.webmanifest', '/sw.js', '/acces.html', '/acces.js']);
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

// Membre d’un code : { prenom, espaces } (espaces dans l’ordre de `espaces`, ceux dont la table contient l’empreinte) ou null
async function membreDe(code, espaces) {
  if (!code) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim().toLowerCase()));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  let prenom = null;
  const ids = [];
  for (const [id, { table }] of Object.entries(espaces)) {
    if (!Object.hasOwn(table, hex)) continue;
    prenom ??= table[hex];
    ids.push(id);
  }
  return ids.length ? { prenom, espaces: ids } : null;
}

// Espace d’une requête : hôte connu → son espace s’il est ouvert au code, sinon null (même refus qu’un code inconnu) ; hôte inconnu → le premier
// espace du code. Seuls le code et l’hôte décident.
function espaceDeLaRequete(m, hote, espaces) {
  if (!m) return null;
  const connu = Object.keys(espaces).find((id) => espaces[id].hotes.includes(hote));
  if (connu) return m.espaces.includes(connu) ? connu : null;
  return m.espaces[0] ?? null;
}

// Fichier d’un pack de plan d’eau propre à un autre espace (data/<id>.*) : même 404 sans écho qu’un fichier interne
function packDUnAutreEspace(chemin, espace, espaces) {
  const c = chemin.toLowerCase();
  const miens = espaces[espace].packs;
  return Object.entries(espaces).some(([id, e]) => id !== espace && e.packs.some((p) => !miens.includes(p) && c.startsWith(`/data/${p}.`)));
}

// Le déroulé du middleware pour des espaces donnés : l’export par défaut utilise ESPACES ; les tests passent des tables de faux codes
function deroule({ espaces }) {
  return async function middleware(req) {
    const url = new URL(req.url);
    const hote = url.hostname.toLowerCase();

    // lien personnel ou formulaire de acces.html : ?acces=CODE ; un code d’un autre espace que celui de l’hôte reçoit la réponse d’un code inconnu
    const code = url.searchParams.get('acces');
    if (code !== null) {
      url.searchParams.delete('acces');
      const suite = url.pathname + url.search;
      if (espaceDeLaRequete(await membreDe(code, espaces), hote, espaces)) {
        return redirige(suite, { 'Set-Cookie': `${COOKIE}=${encodeURIComponent(code.trim().toLowerCase())}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` });
      }
      return redirige(`/acces.html?erreur=1&suite=${encodeURIComponent(suite)}`);
    }

    // D-05 : le prénom de l'équipier connecté (jamais le code ni l'empreinte) sert à signer ce qu'il crée dans l'app ; réponse minuscule, jamais mise en cache.
    // Phase 8 : l’espace de la requête et les espaces ouverts au code (bascule) l’accompagnent.
    const m = await membreDe(lireCookie(req), espaces);
    const espace = espaceDeLaRequete(m, hote, espaces);
    if (espace) {
      if (req.method === 'GET' && url.pathname === '/api/membre') {
        return Response.json({ membre: m.prenom, espace, espaces: m.espaces }, { headers: { 'Cache-Control': 'no-store' } });
      }
      // Tout ce qui n'est pas l'app (fichiers internes du dépôt) : 404 sans écho, après authentification seulement
      if (!cheminDeLApp(url.pathname)) return introuvable(url.pathname);
      // D-05 (phase 8) : le pack de plan d’eau d’un autre espace n’existe pas pour cet espace
      if (packDUnAutreEspace(url.pathname, espace, espaces)) return introuvable(url.pathname);
      // ARCH-01 : les fonctions /api/ apprennent QUI écrit par l'en-tête x-rt-membre, et DANS QUEL ESPACE par x-rt-espace, posés ici après
      // vérification du code : ce sont les seules sources de l'auteur et de l'espace (les valeurs du navigateur sont remplacées). Le prénom est
      // encodé (une valeur d'en-tête reste en octets simples). Le cookie du code d'accès n'est pas transmis aux fonctions. Le reste du site passe tel quel.
      if (versApi(url.pathname)) {
        const h = new Headers(req.headers);
        h.delete('cookie');
        h.set('x-rt-membre', encodeURIComponent(m.prenom));
        h.set('x-rt-espace', espace);
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
  };
}

// ───────────────────────── manifeste par espace (phase 8, D-07)
// Le manifeste de l’app est traité en tout premier, avant le lien ?acces= et le cookie : jamais de 401 ni de redirection, avec ou sans code.
// Sur un hôte de Tofinou, il est réécrit vers le manifeste de l’espace ; sur tout autre hôte (Naos, aperçu), le fichier de Naos tel quel.
// Le manifeste de Tofinou n’est servi sans code que sur un hôte de Tofinou (si la plateforme réévaluait la réécriture) ; ailleurs il suit
// la règle de toute adresse de l’app (code exigé). Seuls GET et HEAD sont concernés ; toute autre méthode suit le déroulé ordinaire.
const MANIFESTE = '/manifest.webmanifest';
const MANIFESTES = Object.freeze({ tofinou: '/manifest-tofinou.webmanifest' });

// Chemin du manifeste propre à l’espace d’un hôte (nom sans port), ou null : celui de Naos
export function manifestePour(hote, espaces = ESPACES) {
  const h = String(hote || '').toLowerCase();
  for (const [id, chemin] of Object.entries(MANIFESTES)) if (espaces[id]?.hotes?.includes(h)) return chemin;
  return null;
}

export function creerMiddleware({ espaces }) {
  const suite = deroule({ espaces });
  return async function middleware(req) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const url = new URL(req.url);
      const propre = manifestePour(url.hostname, espaces);
      if (url.pathname === MANIFESTE) return propre ? rewrite(new URL(propre, req.url)) : next();
      if (propre && url.pathname === propre) return next();
    }
    return suite(req);
  };
}

export default creerMiddleware({ espaces: ESPACES });
