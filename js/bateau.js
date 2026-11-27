// Bateau de l’espace (phase 8, D-09) : polaire par défaut et voile d’avant choisie par l’équipier. L’espace Naos n’a pas de polaire propre
// (`bateau.polaire` absent) : rien ne change pour lui, ni polaire, ni clé de stockage. Les autres espaces gardent leur voile d’avant dans
// `rade.bateau.v1` (`{ voile }`), jamais dans `rade.state`.

import { setDefaultPolar } from './polar.js';
import { TOF_TWS, TOF_TWA, TOF_BSP, TOF_BSP_FOC, TOF_SOURCES } from './polar-tofinou95.js';

export const BATEAU_KEY = 'rade.bateau.v1';

// Polaires connues, par variante de voile d’avant : tableaux (BSP[angle][vent]) et fichier téléchargeable
const POLAIRES = Object.freeze({
  tofinou95: Object.freeze({
    tws: TOF_TWS, twa: TOF_TWA,
    variantes: Object.freeze({
      genois: Object.freeze({ bsp: TOF_BSP, source: TOF_SOURCES.genois, fichier: 'data/tofinou95.pol' }),
      foc: Object.freeze({ bsp: TOF_BSP_FOC, source: TOF_SOURCES.foc, fichier: 'data/tofinou95-foc.pol' }),
    }),
  }),
});

const polaireDe = (espace) => (typeof espace?.bateau?.polaire === 'string' && Object.hasOwn(POLAIRES, espace.bateau.polaire) ? POLAIRES[espace.bateau.polaire] : null);

// Voile d’avant de l’espace : celle de rade.bateau.v1 si l’espace la propose et si la polaire la connaît, sinon celle par défaut ; Naos : null
export function voileDe(espace, storage) {
  const p = polaireDe(espace);
  if (!p) return null;
  const voiles = (espace.bateau.voiles || []).filter((v) => Object.hasOwn(p.variantes, v));
  const defaut = voiles.includes(espace.bateau.voileDefaut) ? espace.bateau.voileDefaut : voiles[0] ?? Object.keys(p.variantes)[0];
  let v = null;
  try { v = JSON.parse(storage?.getItem(BATEAU_KEY) ?? 'null')?.voile ?? null; } catch { v = null; /* valeur illisible : voile par défaut */ }
  return voiles.includes(v) ? v : defaut;
}

// Choix de l’équipier : écrit rade.bateau.v1 (`{ voile }`) pour une voile proposée par l’espace ; Naos ou voile inconnue : rien lu ni écrit.
// Rend vrai si le choix est gardé (stockage plein ou indisponible : faux, sans exception).
export function choisirVoile(espace, storage, voile) {
  const p = polaireDe(espace);
  if (!p || typeof voile !== 'string' || !(espace.bateau.voiles || []).includes(voile) || !Object.hasOwn(p.variantes, voile)) return false;
  try { storage.setItem(BATEAU_KEY, JSON.stringify({ voile })); return true; } catch { return false; /* stockage plein ou indisponible */ }
}

// Variantes proposées par l’espace (ordre du registre) : [{ voile, source, fichier }] ; Naos : []
export function variantesDe(espace) {
  const p = polaireDe(espace);
  return p ? (espace.bateau.voiles || []).filter((v) => Object.hasOwn(p.variantes, v)).map((v) => ({ voile: v, source: p.variantes[v].source, fichier: p.variantes[v].fichier })) : [];
}

// Variante (tableaux, source, fichier) d’une voile de l’espace ; null pour Naos
export function varianteDe(espace, voile) {
  const p = polaireDe(espace);
  if (!p) return null;
  const v = Object.hasOwn(p.variantes, voile) ? p.variantes[voile] : null;
  return v && { tws: p.tws, twa: p.twa, ...v };
}

// Au démarrage, AVANT la polaire personnelle (S.polar, qui garde la priorité) : polaire par défaut de l’espace (cible de « Polaire par défaut »).
// Naos : rien (polaire J80 de js/polar.js) ; rend la voile appliquée ou null.
export function appliquerPolaireEspace(espace, storage) {
  const voile = voileDe(espace, storage);
  const v = voile && varianteDe(espace, voile);
  if (!v) return null;
  setDefaultPolar(v.tws, v.twa, v.bsp, v.source);
  return voile;
}
