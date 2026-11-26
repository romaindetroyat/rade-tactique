// Espaces de l’app côté serveur (phase 8, D-02, D-04, D-06) : liste blanche des identifiants, préfixe du magasin et politique de chaque espace.
// L’espace d’une requête vient du SEUL en-tête `x-rt-espace` posé par le middleware après vérification du code d’accès, jamais du corps, de
// l’adresse ni d’un en-tête envoyé par la page (le middleware l’écrase). Absent, inconnu, autre casse : `null`, et la fonction répond 403.
// Naos garde ses préfixes de la v43 à l’octet près (`prod/…`, `preview/…`) ; un autre espace range tout sous `<espace>/prod/…` ou `<espace>/preview/…`.
// Le nom commence par « _ » : Vercel n’en fait pas une route. Aucune dépendance : importé par api/archive.js et api/_ia.js.

export const ESPACE_IDS = Object.freeze(['naos', 'tofinou']);

// Les données d’un aperçu ne se mélangent jamais à celles de la production (le même magasin est branché aux deux environnements)
export const env = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview');

// Comparaison exacte avec la liste blanche : « Naos », « __proto__ », un tableau ou une valeur absente ne sont pas des espaces
export const espaceDe = (h) => (typeof h === 'string' && ESPACE_IDS.includes(h) ? h : null);

// Espace d’une requête (en-tête posé par le middleware seulement) : sert aux fonctions d’IA à choisir leur consigne fixe (08-09)
export const espaceDeRequete = (req) => espaceDe(req?.headers?.['x-rt-espace']);

// Préfixe du magasin : Naos inchangé depuis la v43 ; les autres espaces dans leur propre arbre
export const prefixe = (e) => (e === 'naos' ? env() : `${e}/${env()}`);

// Archive par espace : plans d’eau acceptés, identifiants de régates réservés à un autre espace (graines), recalages partagés des bouées.
// Naos = v43 exactement : un plan d’eau inconnu est retiré sans refuser la régate, aucun identifiant réservé, recalages gardés.
// Ailleurs : une régate d’un autre plan d’eau (absent = Toulon) ou une graine de Naos est refusée (400), et les recalages sont vidés.
const gele = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze({ ...v, venues: Object.freeze([...v.venues]), reserves: Object.freeze([...v.reserves]) })])));
export const POLITIQUE = gele({
  naos: { venues: ['toulon', 'brest'], reserves: [], recalage: true },
  tofinou: { venues: ['bormes'], reserves: ['snpm-2026', 'gpen-2027'], recalage: false },
});

// Espaces dont l’IA est ouverte : un espace sans consignes propres n’a pas d’IA (jamais les consignes d’un autre espace). Tofinou : consignes
// d’api/_tofinou.js (08-09, D-06), même clé et même budget que Naos, quota compté par espace et prénom
export const IA_ESPACES = Object.freeze(['naos', 'tofinou']);
