// Construit la polaire du Tofinou 9.5 de l’espace Tofinou (phase 8, D-09) à partir du certificat ORC Club 2026 d’un sister-ship espagnol
// (référence 03510004F1O, extrait sans nom dans tools/boats/tofinou95.orc.json) : polaire d’un autre bateau de la série, à recaler sur l’eau.
// Méthode de tools/build_polar.mjs (outil du J80, non modifié) : vitesse = 3600 / temps au mille du certificat, mêmes lignes d’angles,
// angles au-dessous du près optimal, entre le près et 52°, et au-delà de 150° (165° et 180°) par les mêmes formules ; AUCUNE extrapolation :
// le certificat couvre déjà 4 et 24 nd (au-delà de 24 nd, boatSpeed garde la dernière colonne).
// Deux variantes de voile d’avant : « génois » (celui du certificat, 26,4 m²) et « foc d’origine » (16 m² d’après la fiche de série), estimée.
//   node tools/build_polar_tofinou.mjs           écrit data/tofinou95.pol, data/tofinou95-foc.pol et js/polar-tofinou95.js
//   node tools/build_polar_tofinou.mjs --check   régénère en mémoire ; code 1 si un fichier écrit diffère
import fs from 'node:fs';

const ICI = (f) => new URL(`../${f}`, import.meta.url);
const CERT = JSON.parse(fs.readFileSync(ICI('tools/boats/tofinou95.orc.json'), 'utf8'));
const A = CERT.Allowances;
const TWS = A.WindSpeeds;
const nombres = (k) => {
  const v = A[k];
  if (!Array.isArray(v) || v.length !== TWS.length || v.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x <= 0)) throw new Error(`certificat : tableau ${k} illisible`);
  return v;
};
if (CERT.RefNo !== '03510004F1O' || CERT.C_Type !== 'CLUB') throw new Error('certificat : référence ou type inattendu');
if (JSON.stringify(TWS) !== JSON.stringify([4, 6, 8, 10, 12, 14, 16, 20, 24])) throw new Error('certificat : vents inattendus');
const vit = (k) => nombres(k).map((s) => 3600 / s);                 // temps au mille (s) → nœuds
const ORC = {
  beatAngle: nombres('BeatAngle'), beatVmg: vit('Beat'),
  52: vit('R52'), 60: vit('R60'), 75: vit('R75'), 90: vit('R90'), 110: vit('R110'), 120: vit('R120'), 135: vit('R135'), 150: vit('R150'),
  runVmg: vit('Run'), runAngle: nombres('GybeAngle'),
};

// Même calcul que col() de tools/build_polar.mjs
const rad = (d) => (d * Math.PI) / 180;
const ROWS = [30, 34, 36, 38, 40, 42, 44, 47, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
function col(k) {
  const opt = ORC.beatAngle[k], beat = ORC.beatVmg[k] / Math.cos(rad(opt));
  const run = ORC.runAngle[k];
  const fixed = [[52, ORC[52][k]], [60, ORC[60][k]], [75, ORC[75][k]], [90, ORC[90][k]], [110, ORC[110][k]], [120, ORC[120][k]], [135, ORC[135][k]], [150, ORC[150][k]]];
  return ROWS.map((a) => {
    if (a <= opt) return +(beat * Math.max(0.3, 1 - 0.065 * (opt - a))).toFixed(2);
    if (a < 52) { const t = (a - opt) / (52 - opt); return +(beat + (ORC[52][k] - beat) * t).toFixed(2); }
    if (a > 150) { const vmg = ORC.runVmg[k] * (1 - 0.0002 * Math.max(0, a - run) ** 2); return +(vmg / Math.cos(rad(180 - a))).toFixed(2); }
    for (let i = 0; i < fixed.length - 1; i++) if (a >= fixed[i][0] && a <= fixed[i + 1][0]) {
      const t = (a - fixed[i][0]) / (fixed[i + 1][0] - fixed[i][0]); return +(fixed[i][1] + (fixed[i + 1][1] - fixed[i][1]) * t).toFixed(2);
    }
    return 0;
  });
}
const cols = TWS.map((_, k) => col(k));
const BSP = ROWS.map((_, i) => cols.map((c) => c[i]));               // BSP[angle][vent], génois du certificat

// Variante « foc d’origine (estimée) » (08-RESEARCH-PLAN-EAU.md § 5.4, § 5.5) : rapport mesuré entre le certificat d’un Tofinou 9.7 sous foc
// de 18 m² et celui du 9.5 sous génois (près : 0,853 ; 0,877 ; 0,895 ; 0,931 ; 0,976 ; 0,994 ; 0,998 de 4 à 16 nd ; 1,00 à 1,01 de 110 à 180°),
// arrondi et transposé au 9.5 : une ESTIMATION (carènes différentes, bau de 3,00 m contre 2,45 m). Facteurs par colonne de vent (4 à 24 nd) :
const FOC_PRES = [0.85, 0.88, 0.90, 0.93, 0.98, 1, 1, 1, 1];             // lignes de 30 à 75°
const FOC_90 = [0.94, 0.99, 1, 1, 1, 1, 1, 1, 1];                         // ligne 90° ; lignes de 110 à 180° inchangées (spi)
const BSP_FOC = ROWS.map((a, i) => (a <= 75 ? BSP[i].map((v, j) => +(v * FOC_PRES[j]).toFixed(2)) : a === 90 ? BSP[i].map((v, j) => +(v * FOC_90[j]).toFixed(2)) : BSP[i]));

export const SOURCES = { genois: 'ORC Club 2026 (Tofinou 9.5, sister-ship) — à recaler', foc: 'foc d’origine (estimée d’après le Tofinou 9.7) — à recaler' };

const pol = (bsp) => `TWA\\TWS\t${TWS.join('\t')}\n` + ROWS.map((a, i) => `${a}\t${bsp[i].join('\t')}\n`).join('');
const zero = TWS.map(() => 0);
const js = `// Généré par tools/build_polar_tofinou.mjs — ne pas modifier à la main. Polaire du Tofinou 9.5 de l’espace Tofinou : certificat ORC Club 2026
// d’un sister-ship (référence ${CERT.RefNo}, émis le ${CERT.IssueDate.slice(0, 10)}), méthode de tools/build_polar.mjs, sans extrapolation (4 à 24 nd) ;
// TOF_BSP : génois du certificat ; TOF_BSP_FOC : foc d’origine, estimé.
export const TOF_TWS = ${JSON.stringify(TWS)};
export const TOF_TWA = ${JSON.stringify([0, ...ROWS])};
export const TOF_BSP = ${JSON.stringify([zero, ...BSP])};
// Variante « foc d’origine (estimée) » : lignes de 30 à 75° et 90° réduites par petit temps (voir l’outil)
export const TOF_BSP_FOC = ${JSON.stringify([zero, ...BSP_FOC])};
export const TOF_SOURCES = ${JSON.stringify(SOURCES)};
`;

const SORTIES = [['data/tofinou95.pol', pol(BSP)], ['data/tofinou95-foc.pol', pol(BSP_FOC)], ['js/polar-tofinou95.js', js]];
if (process.argv.includes('--check')) {
  const faux = SORTIES.filter(([f, t]) => { try { return fs.readFileSync(ICI(f), 'utf8') !== t; } catch { return true; } }).map(([f]) => f);
  if (faux.length) { console.error(`À régénérer (node tools/build_polar_tofinou.mjs) : ${faux.join(', ')}`); process.exit(1); }
  console.log('Polaire du Tofinou à jour : ' + SORTIES.map(([f]) => f).join(', '));
} else {
  for (const [f, t] of SORTIES) fs.writeFileSync(ICI(f), t);
  console.log(pol(BSP));
}
