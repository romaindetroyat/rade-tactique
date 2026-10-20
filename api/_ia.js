// IA bornée de l’app (SECU2-01, D-05 à D-07) : ce que les quatre fonctions d’IA (dictée, débrief, arbitre, lecture d’IC) ont en commun.
//   - `store: false` est posé ICI, après les paramètres de la fonction : OpenAI ne garde pas les réponses, et aucune fonction ne peut l’écraser ;
//   - quota de 30 appels par équipier et par jour de Paris, toutes fonctions confondues, compté avant l’appel dans le Blob privé
//     (`<prod|preview>/quota/<AAAA-MM-JJ>/<prénom>.json`, un blob par équipier et par jour : une lecture et une écriture `ifMatch`, jamais `list`) ;
//   - compteur ouvert en panne : magasin absent, en erreur, plus lent que 2 s ou conflit perdu deux fois → l’appel passe, un avertissement
//     sans prénom, sans clé ni texte est écrit ; l’IA ne tombe jamais à cause du compteur ;
//   - erreurs d’OpenAI traduites en français (plafond de dépense, service occupé), toujours bornées à 300 caractères.
// Le prénom vient du seul en-tête `x-rt-membre` posé par le middleware, jamais du corps ni de l’adresse.
// Le nom commence par « _ » : Vercel n’en fait pas une route. Ce fichier n’importe ni `js/` ni `api/archive.js` (il serait embarqué avec lui) ;
// `prefix` et `membre` copient la règle d’api/archive.js et tests/apiia.test.mjs en vérifie la parité. @vercel/blob n’est importé que si un
// compteur est configuré.

import OpenAI from 'openai';

export const QUOTA = 30;                       // appels d’IA par équipier et par jour de Paris
export const DELAI_MS = 2000;                  // chaque opération sur le compteur est abandonnée au-delà
export const MESSAGES = {
  quota_equipier: 'Limite d’IA du jour atteinte — reprise demain',
  budget_ia: 'Budget d’IA du mois atteint — l’IA reprend le mois prochain',
  ia_occupee: 'L’IA est très sollicitée — réessayez dans un instant',
};
// Codes que renvoie OpenAI avec un 429 quand la dépense plafonnée, le crédit ou la facturation sont épuisés (un code inconnu devient « occupée »)
export const BUDGET_CODES = new Set([
  'project_spend_limit_exceeded', 'organization_spend_limit_exceeded', 'insufficient_quota', 'credit_balance_exhausted', 'billing_not_active',
]);

// ───────────────────────── règles recopiées d’api/archive.js

const NAME = /^[\p{L}\p{M} '’-]{1,40}$/u;
// Les données d’un aperçu ne se mélangent jamais à celles de la production (le même magasin est branché aux deux environnements)
export const prefix = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview');
// Le prénom posé par le middleware est encodé (une valeur d’en-tête reste en octets simples) : décodé puis validé, sinon null
export function membre(header) {
  try { const who = decodeURIComponent(String(header || '')).trim(); return NAME.test(who) ? who : null; } catch { return null; }
}

// ───────────────────────── compteur

const JOUR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });         // AAAA-MM-JJ, heure d’été comprise
export const jourParis = (ms) => JOUR.format(ms);

// Le chemin ne contient que des lettres minuscules, des chiffres et des tirets : un prénom piégé ne sort jamais du dossier du jour
const cle = (who) => who.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '-');
export const cheminQuota = (P, who, ms) => `${P}/quota/${jourParis(ms)}/${cle(who)}.json`;

function borne(promesse, delai) {
  let minuterie;
  const trop = new Promise((_, ko) => { minuterie = setTimeout(() => ko(new Error('délai dépassé')), delai); });
  return Promise.race([promesse, trop]).finally(() => clearTimeout(minuterie));
}
async function lit(B, chemin) {
  const r = await B.get(chemin, { access: 'private', useCache: false });       // relire la dernière version, pas la copie du CDN
  if (!r || r.statusCode !== 200) return { n: 0, etag: null };
  const j = JSON.parse(await new Response(r.stream).text());
  if (!Number.isSafeInteger(j?.n) || j.n < 0) throw new Error('compteur illisible');
  return { n: j.n, etag: r.blob.etag };
}
// Écriture refusée parce qu’un autre appel a écrit entre-temps ; à la création, l’échec « existe déjà » n’a pas de classe dédiée dans le SDK
const perdue = (B, e, etag) => e instanceof B.BlobPreconditionFailedError || (!etag && e instanceof B.BlobError && !(e instanceof B.BlobServiceRateLimited));

// Compte un appel pour `who` : { ok: true, n } (n = appels du jour avec celui-ci) ou { ok: false, n } au-delà de `max`, sans écriture.
// `now` rend l’heure en millisecondes. Une écriture perdue se rejoue une seule fois (relire, recompter), puis l’erreur remonte.
export async function compte({ B, P, who, now = Date.now, max = QUOTA, delai = DELAI_MS }) {
  const chemin = cheminQuota(P, who, now());
  for (let essai = 0; ; essai++) {
    const { n, etag } = await borne(lit(B, chemin), delai);
    if (n >= max) return { ok: false, n };
    const opts = { access: 'private', contentType: 'application/json', ...(etag ? { allowOverwrite: true, ifMatch: etag } : {}) };
    try {
      await borne(B.put(chemin, JSON.stringify({ n: n + 1 }), opts), delai);
      return { ok: true, n: n + 1 };
    } catch (e) {
      if (essai === 0 && perdue(B, e, etag)) continue;
      throw e;
    }
  }
}

// ───────────────────────── erreurs d’OpenAI

const bornee = (err) => String(err?.message || err).slice(0, 300);

// → { status, body }. 429 de budget → `budget_ia` ; autre 429 → `ia_occupee` ; 401/403 d’OpenAI (clé refusée) → 502, car la page lit 401 comme
// « rouvrez l’app avec votre code » ; autre erreur d’OpenAI → son statut ; toute autre erreur → 500.
export function erreurIA(err) {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      const type = BUDGET_CODES.has(err.code ?? err.error?.code) ? 'budget_ia' : 'ia_occupee';
      return { status: 429, body: { error: type, message: MESSAGES[type] } };
    }
    return { status: [401, 403].includes(err.status) ? 502 : err.status || 502, body: { error: bornee(err) } };
  }
  return { status: 500, body: { error: bornee(err) } };
}

// ───────────────────────── aide commune aux quatre fonctions

// `openai` : client (objet, ou fonction qui le rend) ; sans lui, créé à la première requête (sans clé, le constructeur lèverait une erreur au chargement).
// `blob` : faux Blob des tests ; sans lui et sans jeton configuré, il n’y a pas de compteur (l’appel passe).
export function createIA({ openai, blob, now = Date.now, delai = DELAI_MS } = {}) {
  let client = null, sdk = blob || null;
  const getClient = () => (typeof openai === 'function' ? openai() : openai || (client ??= new OpenAI()));
  const getBlob = async () => (sdk ||= await import('@vercel/blob'));
  const configure = () => !!sdk || !!process.env.BLOB_READ_WRITE_TOKEN || !!process.env.BLOB_STORE_ID;
  return {
    // true : l’appel peut partir. false : la réponse (403 sans prénom, 429 au-delà du quota) est déjà envoyée.
    async garde(req, res) {
      res.setHeader?.('Cache-Control', 'no-store');
      const who = membre(req.headers?.['x-rt-membre']);
      if (!who) { res.status(403).json({ error: 'membre_inconnu' }); return false; }      // fermé par défaut : sans prénom du middleware, rien n’est compté
      if (!configure()) return true;
      let r;
      try { r = await compte({ B: await getBlob(), P: prefix(), who, now, delai }); } catch {
        console.warn('quota IA : compteur indisponible, appel laissé passer');             // jamais le prénom, la clé ni le texte
        return true;
      }
      if (!r.ok) { res.status(429).json({ error: 'quota_equipier', message: MESSAGES.quota_equipier }); return false; }
      return true;
    },
    // `store: false` vient en dernier : rien dans `params` ne peut l’écraser (OpenAI ne garde pas les réponses)
    appelle(params) { return getClient().responses.create({ ...params, store: false }); },
    repond(res, err) { const { status, body } = erreurIA(err); return res.status(status).json(body); },
  };
}
