// Registre public des espaces (phase 8, D-02, D-03) : ce que l’app affiche et borne pour chaque équipage (nom, bateau, plans d’eau, graines,
// recalage, plafonds d’archive, hôtes). AUCUN membre ici : les membres ne sont que dans middleware.js, sous forme d’empreintes, et le serveur
// décide seul de l’espace d’une requête (api/_espace.js). Mêmes identifiants et mêmes hôtes que middleware.js et api/_espace.js (test de parité).
// L’espace de la session est fixé au démarrage, de façon synchrone et hors réseau, AVANT le plan d’eau (js/app.js) : export vivant `ESPACE`.

const gele = (e) => Object.freeze({ ...e, bateau: Object.freeze({ ...e.bateau }), venues: Object.freeze([...e.venues]), graines: Object.freeze([...e.graines]),
  hotes: Object.freeze([...e.hotes]), textesIC: e.textesIC ? Object.freeze({ ...e.textesIC }) : null, caps: e.caps ? Object.freeze({ archive: Object.freeze({ ...e.caps.archive }), lourd: Object.freeze({ ...e.caps.lourd }) }) : null });

export const ESPACES = Object.freeze({
  // Naos : la v43 telle quelle (plafonds de js/archsync.js et js/archheavy.js, graines de la Coupe SNPM et du GPEN, recalages du cahier CVAT)
  naos: gele({
    id: 'naos', nom: 'Naos', app: 'Rade Tactique', bateau: { classe: 'J80', longueur: 8 },
    venues: ['toulon', 'brest'], venueDefaut: 'toulon', pack: 'brest', graines: ['snpm-2026', 'gpen-2027'], recalage: true, caps: null,
    // éditeur de parcours (08-11, D-17) : fermé à Naos (vues de la v43) ; il pourra être ouvert en changeant ce seul drapeau, sur décision du skipper de Naos
    editeurParcours: false,
    hotes: ['rade-tactique.vercel.app', '127.0.0.1', 'localhost'],
  }),
  // Tofinou — Bormes : rade de Bormes – Le Lavandou seule, aucune graine de Naos (sa graine : le Challenge de la Baie 2026-2027, 08-08), plafonds d’archive par téléphone à la moitié de ceux de Naos
  // (le quota Blob est commun aux deux espaces : un dépassement bloquerait aussi l’archive de Naos)
  tofinou: gele({
    id: 'tofinou', nom: 'Tofinou — Bormes', app: 'Tofinou Bormes',
    // polaire du sister-ship (js/bateau.js) : génois du certificat par défaut, foc estimé au choix de l’équipier (à confirmer avec le skipper) ;
    // pertes aux manœuvres estimées (bateau trois fois plus lourd que le J80), utilisées par le routage ; tirant d’eau affiché seulement (Bormes :
    // ni fonds ni marée dans le routage), à confirmer ; réglages du J80 (carte du briefing, guide de réglage) masqués
    bateau: {
      classe: 'Tofinou 9.5', longueur: 9.47, polaire: 'tofinou95', voiles: Object.freeze(['genois', 'foc']), voileDefaut: 'genois',
      virement_s: 11, empannage_s: 8, tirant: Object.freeze({ bas: 2.2, haut: 1.2 }), onglet: 'Tofinou', reglages: false,
    },
    venues: ['bormes'], venueDefaut: 'bormes', pack: 'bormes', graines: ['baie-2026-2027'], recalage: false, editeurParcours: true,
    caps: { archive: { w: 20, r: 75 }, lourd: { up: 10, down: 20 } },
    // textes du chemin des IC (08-11, D-16) : lecture par motifs et fiche semée sans le sigle du club de Toulon ; Naos garde ceux de la v43 (aucun texte ici)
    textesIC: {
      motifs: 'par motifs (hors réseau)',
      semee: 'semée par l’app d’après les documents du club : à vérifier avec ceux en vigueur',
      notice: 'Fiche semée par l’app d’après les documents du club — à vérifier avec ceux en vigueur.',
    },
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

// ───────── Garde de synchronisation (D-04) : aucun envoi ni réception tant que l’espace de l’appareil n’est pas sûr.
// Sur un hôte connu, le middleware refuse tout code d’un autre espace : comportement de la v43 ('ok' tout de suite). Sur un hôte inconnu
// (aperçu), il faut la réponse de /api/membre (`annonce` : undefined tant qu’elle n’est pas là ; null = réponse sans espace, serveur v43 = Naos).
// Autre espace annoncé : l’appareil vierge adopte l’espace du serveur (s’il est connu) ; sinon la synchronisation est arrêtée.
// Rend 'ok' | 'attendre' | 'adopter' | 'bloquer'.
export function espaceSur({ hoteConnu = false, attendu = 'naos', annonce, vierge = false } = {}) {
  if (hoteConnu) return 'ok';
  if (annonce === undefined) return 'attendre';
  const e = annonce === null ? 'naos' : annonce;
  if (e === attendu) return 'ok';
  return vierge && typeof e === 'string' && Object.hasOwn(ESPACES, e) ? 'adopter' : 'bloquer';
}

// Appareil vierge (adoption possible) : rade.sync.v1 sans `rev`, sans première synchronisation ni marque « sale » ; index (rade.regates.v1)
// absent ou ne contenant que des graines de l’espace de démarrage (pierres tombales comprises) ; aucune trace dans rade-traces.
// Toute valeur illisible compte comme des données (pas vierge).
export function appareilVierge({ sync = {}, index = null, graines = [], traces = 0 } = {}) {
  if (sync?.rev || sync?.first || Object.keys(sync?.dirty || {}).length) return false;
  if (!(Number.isFinite(traces) && traces === 0)) return false;
  if (index == null) return true;
  if (typeof index !== 'object' || !Array.isArray(index.list)) return false;
  if (!index.list.every((r) => graines.includes(r?.id))) return false;
  return Object.keys(index.tomb || {}).every((k) => graines.includes(k.replace(/^regatta:/, '')));
}
