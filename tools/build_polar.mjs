// Construit la polaire J80 à partir du certificat ORC One Design 2023 (data.orc.org/public/od/2023/j80.od.html).
// 6–20 nd : valeurs ORC ; angles intermédiaires interpolés ; 4 et 25 nd extrapolés.
import fs from 'node:fs';
const TWS = [6, 8, 10, 12, 14, 16, 20];
const ORC = {
  beatAngle: [42.6, 40.5, 38.2, 37.8, 37.8, 37.8, 39.0],
  beatVmg: [3.31, 4.00, 4.41, 4.54, 4.60, 4.62, 4.57],
  52: [5.01, 5.83, 6.22, 6.36, 6.43, 6.48, 6.49],
  60: [5.25, 6.01, 6.37, 6.55, 6.64, 6.70, 6.75],
  75: [5.39, 6.12, 6.51, 6.78, 6.96, 7.08, 7.21],
  90: [5.48, 6.23, 6.52, 6.88, 7.18, 7.43, 7.76],
  110: [5.61, 6.44, 6.90, 7.21, 7.50, 7.78, 8.33],
  120: [5.49, 6.40, 6.96, 7.44, 7.88, 8.28, 9.17],
  135: [4.97, 6.04, 6.71, 7.31, 7.96, 8.77, 11.05],
  150: [4.24, 5.32, 6.11, 6.66, 7.11, 7.67, 10.17],
  runVmg: [3.67, 4.60, 5.29, 5.77, 6.16, 6.64, 8.81],
  runAngle: [144.8, 148.7, 149.6, 149.6, 147.3, 144.4, 142.2],
};
const rad = (d) => (d * Math.PI) / 180;
const ROWS = [30, 34, 36, 38, 40, 42, 44, 47, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
function col(k) {
  const opt = ORC.beatAngle[k], beat = ORC.beatVmg[k] / Math.cos(rad(opt));
  const run = ORC.runAngle[k], runB = ORC.runVmg[k] / Math.cos(rad(180 - run));
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
// 4 nd : ~62 % des vitesses à 6 nd ; 25 nd : 20 nd + 3 % au près/travers, +8 % au portant
const c4 = cols[0].map((v) => +(v * 0.62).toFixed(2));
const c25 = cols[6].map((v, i) => +(v * (ROWS[i] < 100 ? 1.0 : 1.08)).toFixed(2));
const tws = [4, ...TWS, 25], all = [c4, ...cols, c25];
const bsp = ROWS.map((_, i) => all.map((c) => c[i]));
let pol = `TWA\\TWS\t${tws.join('\t')}\n`;
ROWS.forEach((a, i) => { pol += `${a}\t${bsp[i].join('\t')}\n`; });
fs.writeFileSync(new URL('../data/j80.pol', import.meta.url), pol);
const js = `// Généré par tools/build_polar.mjs — ORC One Design 2023 (J-80 OD), 4 et 25 nd extrapolés.\nexport const ORC_TWS = ${JSON.stringify(tws)};\nexport const ORC_TWA = ${JSON.stringify([0, ...ROWS])};\nexport const ORC_BSP = ${JSON.stringify([tws.map(() => 0), ...bsp])};\nexport const ORC_TARGETS = ${JSON.stringify(ORC)};\n`;
fs.writeFileSync(new URL('../js/polar-orc.js', import.meta.url), js);
console.log(pol);
