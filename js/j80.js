// Onglet J80 : polaire (tableau, diagramme, import de fichier), cibles de vitesse, guide de réglage.

import { getPolar, boatSpeed, optimalAngles, spiMinTwa } from './polar.js';
import { TUNING } from './tuning.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function polarSVG() {
  const R = 150, cx = 20, cy = 165, W = 200, H = 330, vmax = 14;
  const sc = (v) => (v / vmax) * R;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" style="max-width:300px;margin:auto">`;
  for (let v = 2; v <= vmax; v += 2) s += `<path d="M${cx},${cy - sc(v)} A${sc(v)},${sc(v)} 0 0 1 ${cx},${cy + sc(v)}" fill="none" stroke="#e3e8ee"/><text x="${cx + 2}" y="${cy - sc(v) + 10}" font-size="8" fill="#8b98a6">${v}</text>`;
  for (let a = 0; a <= 180; a += 30) { const r = (a * Math.PI) / 180; s += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(r) * R}" y2="${cy - Math.cos(r) * R}" stroke="#eef1f4"/><text x="${cx + Math.sin(r) * (R + 8)}" y="${cy - Math.cos(r) * (R + 8) + 3}" font-size="8" fill="#8b98a6" text-anchor="middle">${a}°</text>`; }
  const cols = ['#1673c9', '#1f9d55', '#e8a400', '#d63031', '#7b3fb0'];
  [6, 10, 14, 20, 25].forEach((tws, k) => {
    let d = '';
    for (let a = 25; a <= 180; a += 2) { const v = boatSpeed(tws, a), r = (a * Math.PI) / 180; d += `${d ? 'L' : 'M'}${(cx + Math.sin(r) * sc(v)).toFixed(1)},${(cy - Math.cos(r) * sc(v)).toFixed(1)}`; }
    s += `<path d="${d}" fill="none" stroke="${cols[k]}" stroke-width="1.8"/><text x="${W - 4}" y="${12 + k * 11}" font-size="9" text-anchor="end" fill="${cols[k]}">${tws} nd</text>`;
  });
  return s + '</svg>';
}

export function renderJ80(el, { onImport, onReset, perf, onPerf, wind }) {
  const P = getPolar();
  const twsCols = P.tws;
  const targets = [4, 6, 8, 10, 12, 14, 16, 20, 25].map((t) => ({ t, ...optimalAngles(t), spi: spiMinTwa(t), b90: boatSpeed(t, 90) }));
  const cur = wind ? optimalAngles(Math.max(1, wind.spd)) : null;
  el.innerHTML = `
  ${cur ? `<div class="card hero"><div class="muted small">Cibles au vent prévu sur le 1er bord (${wind.spd.toFixed(0)} nd)</div><div class="kpis" style="margin-top:6px">
    <div class="kpi" style="background:rgba(255,255,255,.12)"><b>${cur.up.bsp.toFixed(1)} nd</b><span style="color:#cfe0ef">près · ${Math.round(cur.up.twa)}° TWA</span></div>
    <div class="kpi" style="background:rgba(255,255,255,.12)"><b>${cur.up.vmg.toFixed(1)}</b><span style="color:#cfe0ef">VMG près</span></div>
    <div class="kpi" style="background:rgba(255,255,255,.12)"><b>${cur.down.bsp.toFixed(1)} nd</b><span style="color:#cfe0ef">portant · ${Math.round(cur.down.twa)}°</span></div></div></div>` : ''}
  <div class="card"><h3>Vitesses cibles J80 <small>${esc(P.source)}</small></h3><div class="tablewrap"><table class="t">
    <tr><th>Vent</th><th>Près TWA</th><th>Vit.</th><th>VMG</th><th>Spi dès</th><th>Portant TWA</th><th>Vit.</th><th>VMG</th></tr>
    ${targets.map((r) => `<tr><td><b>${r.t}</b></td><td>${Math.round(r.up.twa)}°</td><td>${r.up.bsp.toFixed(1)}</td><td>${r.up.vmg.toFixed(1)}</td><td>${r.spi}°</td><td>${Math.round(r.down.twa)}°</td><td>${r.down.bsp.toFixed(1)}</td><td>${r.down.vmg.toFixed(1)}</td></tr>`).join('')}
  </table></div>
  ${polarSVG()}
  <label class="f">Performance de l’équipage par rapport à la polaire : <b id="pfL">${Math.round(perf * 100)} %</b></label><input id="pf" type="range" min="0.75" max="1.05" step="0.01" value="${perf}">
  <div class="small muted">Sert aux temps estimés (90–95 % est réaliste en flotte). N’influence pas les angles conseillés.</div></div>
  <div class="card"><h3>Polaire complète <small>nœuds</small></h3><div class="tablewrap"><table class="t"><tr><th>TWA \\ TWS</th>${twsCols.map((t) => `<th>${t}</th>`).join('')}</tr>
    ${P.twa.map((a, i) => (a === 0 ? '' : `<tr><td><b>${a}°</b></td>${P.bsp[i].map((v) => `<td>${(+v).toFixed(1)}</td>`).join('')}</tr>`)).join('')}</table></div>
    <label class="f">Importer votre polaire (.pol, .csv, .txt — format « TWA\\TWS » : 1re ligne = vents, 1re colonne = angles)</label>
    <input type="file" id="polFile" accept=".pol,.csv,.txt,text/plain">
    <div class="btns"><button class="btn small alt" id="polReset">Polaire par défaut</button><a class="btn small alt" href="data/j80.pol" download style="text-decoration:none">Télécharger la polaire (.pol)</a></div>
    <div class="small muted" id="polMsg"></div></div>
  ${TUNING.html}`;
  el.querySelector('#pf').oninput = (e) => { el.querySelector('#pfL').textContent = `${Math.round(e.target.value * 100)} %`; };
  el.querySelector('#pf').onchange = (e) => onPerf(+e.target.value);
  el.querySelector('#polReset').onclick = onReset;
  el.querySelector('#polFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { onImport(await f.text(), f.name); } catch (err) { el.querySelector('#polMsg').textContent = 'Import impossible : ' + err.message; }
  };
}
