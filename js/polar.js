// Polaire J80 : certificat ORC One Design 2023 « J-80 OD » (VPP 2023 1.02, data.orc.org/public/od/2023/j80.od.html).
// 6–20 nd : valeurs ORC (angles intermédiaires interpolés) ; 4 et 25 nd extrapolés. Voir tools/build_polar.mjs.
import { ORC_TWS, ORC_TWA, ORC_BSP } from './polar-orc.js';

export const DEFAULT_TWS = ORC_TWS;
export const DEFAULT_TWA = ORC_TWA;
export const DEFAULT_BSP = ORC_BSP;
const DEFAULT_SOURCE = 'ORC One Design 2023 (J-80 OD)';
let TWS = DEFAULT_TWS, TWA = DEFAULT_TWA;
let BSP = DEFAULT_BSP;
const cache = new Map();
export let polarSource = DEFAULT_SOURCE;

export const getPolar = () => ({ tws: TWS, twa: TWA, bsp: BSP, source: polarSource });

// Remplace la polaire (tableaux TWS, TWA et BSP[twa][tws]) ; la ligne TWA 0 est ajoutée si absente
export function setPolar(tws, twa, bsp, source) {
  if (twa[0] !== 0) { twa = [0, ...twa]; bsp = [tws.map(() => 0), ...bsp]; }
  TWS = tws; TWA = twa; BSP = bsp; polarSource = source || 'Polaire importée';
  cache.clear();
}
export const resetPolar = () => setPolar(DEFAULT_TWS, DEFAULT_TWA, DEFAULT_BSP, DEFAULT_SOURCE);

// Lecture d’un fichier polaire classique (.pol / .csv / .txt) : 1re ligne « TWA\\TWS  6  8 … »,
// puis une ligne par TWA. Séparateurs : tabulation, point-virgule, virgule ou espaces.
export function parsePolar(text) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/[\t;, ]+/).filter(Boolean));
  if (rows.length < 3) throw new Error('Fichier polaire trop court');
  const tws = rows[0].slice(1).map(Number);
  if (tws.some(isNaN) || !tws.length) throw new Error('En-tête des vitesses de vent illisible');
  const twa = [], bsp = [];
  for (const r of rows.slice(1)) {
    const a = Number(r[0]); if (isNaN(a)) continue;
    twa.push(a); bsp.push(tws.map((_, i) => Number(r[i + 1]) || 0));
  }
  return { tws, twa, bsp };
}

// interp sans tableau intermédiaire (boatSpeed est appelée des centaines de milliers de fois par analyse) : mêmes calculs, résultat dans IX, IT
let IX = 0, IT = 0;
function interpTo(arr, v) {
  const n = arr.length;
  if (v <= arr[0]) { IX = 0; IT = 0; return; }
  if (v >= arr[n - 1]) { IX = n - 2; IT = 1; return; }
  for (let i = 0; i < n - 1; i++) if (v <= arr[i + 1]) { IX = i; IT = (v - arr[i]) / (arr[i + 1] - arr[i]); return; }
  IX = n - 2; IT = 1;
}

export function boatSpeed(tws, twa) {
  twa = Math.abs(twa) % 360; if (twa > 180) twa = 360 - twa;
  if (tws <= 0.3) return 0;
  interpTo(TWA, twa);
  const i = IX, ti = IT;
  interpTo(TWS, tws);
  let j = IX, tj = IT;
  let scale = 1;
  if (tws < TWS[0]) { scale = tws / TWS[0]; j = 0; tj = 0; }
  const a = BSP[i][j] * (1 - tj) + BSP[i][j + 1] * tj;
  const b = BSP[i + 1][j] * (1 - tj) + BSP[i + 1][j + 1] * tj;
  return (a * (1 - ti) + b * ti) * scale;
}

export function optimalAngles(tws) {
  const k = Math.round(tws * 4) / 4;
  if (cache.has(k)) return cache.get(k);
  let up = { twa: 45, vmg: 0, bsp: 0 }, down = { twa: 150, vmg: 0, bsp: 0 };
  for (let a = 30; a <= 180; a += 0.5) {
    const b = boatSpeed(k, a), v = b * Math.cos((a * Math.PI) / 180);
    if (v > up.vmg) up = { twa: a, vmg: v, bsp: b };
    if (-v > down.vmg) down = { twa: a, vmg: -v, bsp: b };
  }
  const r = { up, down };
  cache.set(k, r);
  return r;
}

// Limite basse du spi asymétrique (TWA mini où l’on envoie)
export const spiMinTwa = (tws) => (tws < 8 ? 95 : tws < 14 ? 100 : tws < 20 ? 110 : 120);

// Conseils de réglage J80 (qualitatifs) selon la force du vent réel
export function trimAdvice(tws, gust) {
  const g = gust || tws;
  if (tws < 6) return { mode: 'Petit temps', crew: 'Équipage sous le vent / au centre, gîte légère pour garder la forme des voiles.', rig: 'Gréement souple (haubans détendus selon votre guide), pataras relâché, creux maxi.', sails: 'Chariot de GV au vent, écoute douce, bordure ouverte. Foc écoute choquée de quelques cm, pas de sur-bordage.', tactic: 'Priorité à la pression : relier les risées, éviter les zones sans vent sous les reliefs, peu de virements.' };
  if (tws < 11) return { mode: 'Médium', crew: 'Rappel plein dès que la gîte dépasse ~10°.', rig: 'Tension de base, pataras progressif selon les rafales.', sails: 'Chariot au centre, chute de GV qui commence à vriller dans les rafales. Penons de foc qui décrochent ensemble.', tactic: 'Jouer les bascules ; viser le bord rapprochant puis la pression.' };
  if (tws < 17) return { mode: 'Brise', crew: 'Rappel maxi, poids sur l’avant au près dans le clapot ; reculer au portant pour faire planer.', rig: 'Haubans plus tendus, pataras fort, hale-bas repris.', sails: 'Chariot descendu dans les rafales plutôt que choquer l’écoute, cunningham et bordure à bloc. Spi : planer en lofant dans les risées, abattre dans les surventes.', tactic: 'Limiter manœuvres et risques ; choisir les bords de plus mer plate près des côtes au vent.' };
  return { mode: g > 25 ? 'Très forte brise' : 'Forte brise', crew: 'Rappel maxi, l’équipage réparti pour un réglage calme.', rig: 'Gréement le plus tendu admis par la jauge, pataras à fond.', sails: 'GV dévente largement, chariot sous le vent. Spi uniquement si l’équipage maîtrise l’affalage ; prévoir un affalage anticipé (bouée Grande Jetée par vent d’Est : l’IC prévoit de la marge).', tactic: 'Sécurité d’abord : brassières (pavillon Y), virements de bord plutôt qu’empannages risqués près des marques.' };
}
