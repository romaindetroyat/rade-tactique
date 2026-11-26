// Registre public des espaces (phase 8, D-02, D-03) : ce que l’app affiche et borne pour chaque équipage (nom, bateau, plans d’eau, graines,
// recalage, plafonds d’archive, hôtes). AUCUN membre ici : les membres ne sont que dans middleware.js, sous forme d’empreintes, et le serveur
// décide seul de l’espace d’une requête (api/_espace.js). Mêmes identifiants et mêmes hôtes que middleware.js et api/_espace.js (test de parité).
// L’espace de la session est fixé au démarrage, de façon synchrone et hors réseau, AVANT le plan d’eau (js/app.js) : export vivant `ESPACE`.

const gele = (e) => Object.freeze({ ...e, bateau: Object.freeze({ ...e.bateau }), venues: Object.freeze([...e.venues]), graines: Object.freeze([...e.graines]),
  hotes: Object.freeze([...e.hotes]), caps: e.caps ? Object.freeze({ archive: Object.freeze({ ...e.caps.archive }), lourd: Object.freeze({ ...e.caps.lourd }) }) : null });

export const ESPACES = Object.freeze({
  // Naos : la v43 telle quelle (plafonds de js/archsync.js et js/archheavy.js, graines de la Coupe SNPM et du GPEN, recalages du cahier CVAT)
  naos: gele({
    id: 'naos', nom: 'Naos', app: 'Rade Tactique', bateau: { classe: 'J80', longueur: 8 },
    venues: ['toulon', 'brest'], venueDefaut: 'toulon', pack: 'brest', graines: ['snpm-2026', 'gpen-2027'], recalage: true, caps: null,
    hotes: ['rade-tactique.vercel.app', '127.0.0.1', 'localhost'],
  }),
  // Tofinou — Bormes : rade de Bormes – Le Lavandou seule, aucune graine de Naos, plafonds d’archive par téléphone à la moitié de ceux de Naos
  // (le quota Blob est commun aux deux espaces : un dépassement bloquerait aussi l’archive de Naos)
  tofinou: gele({
    id: 'tofinou', nom: 'Tofinou — Bormes', app: 'Tofinou Bormes', bateau: { classe: 'Tofinou 9.5', longueur: 9.47 },
    venues: ['bormes'], venueDefaut: 'bormes', pack: 'bormes', graines: [], recalage: false,
    caps: { archive: { w: 20, r: 75 }, lourd: { up: 10, down: 20 } },
    hotes: ['tofinou-bormes.vercel.app', 'tofinou.localhost'],
  }),
});
export const ESPACE_IDS = Object.freeze(Object.keys(ESPACES));

// Hôte → espace (hôtes connus seulement : un aperçu ou l’adresse d’un déploiement n’y est pas)
export const HOTES = Object.freeze(Object.assign(Object.create(null), ...ESPACE_IDS.flatMap((id) => ESPACES[id].hotes.map((h) => ({ [h]: id })))));

// Espace retenu sur un hôte inconnu (aperçu) : écrit seulement pour un espace autre que Naos (Naos n’écrit aucune clé nouvelle)
export const ESPACE_KEY = 'rade.espace.v1';

// Espace d’un hôte connu, sinon null
export const espaceDeLHote = (h) => (typeof h === 'string' && Object.hasOwn(HOTES, h.toLowerCase()) ? HOTES[h.toLowerCase()] : null);

// Espace de démarrage, en lecture seule : hôte connu → son espace ; hôte inconnu → `rade.espace.v1` s’il nomme un espace autre que Naos
// (valeur hostile, inconnue ou d’une autre casse ignorée) ; sinon Naos
export function bootEspace(hote, storage) {
  const h = espaceDeLHote(hote);
  if (h) return h;
  let v = null;
  try { v = storage?.getItem(ESPACE_KEY) ?? null; } catch { v = null; /* stockage illisible : Naos */ }
  return typeof v === 'string' && v !== 'naos' && Object.hasOwn(ESPACES, v) ? v : 'naos';
}

// Espace courant (export vivant) : Naos tant que setEspace n’a pas été appelé ; fixé une seule fois par session, comme le plan d’eau
export let ESPACE = ESPACES.naos;
let fixe = false;
export function setEspace(id) {
  const e = typeof id === 'string' && Object.hasOwn(ESPACES, id) ? ESPACES[id] : ESPACES.naos;
  if (e === ESPACE) return ESPACE;
  if (fixe) throw new Error('changer d’espace demande un rechargement de l’app');
  fixe = true;
  ESPACE = e;
  return ESPACE;
}
