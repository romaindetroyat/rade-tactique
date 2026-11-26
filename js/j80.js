// Onglet J80 : polaire (tableau, diagramme, import de fichier), cibles de vitesse, guide de réglage.
// Onglet du bateau d’un autre espace (08-05, D-09 : `bateau.reglages` faux, Tofinou 9.5) : mêmes cibles et polaire, voile d’avant au choix,
// longueur, pertes et tirant d’eau, polaires téléchargeables, sans le guide de réglage du J80. L’onglet de Naos reste celui de la v43.

import { getPolar, boatSpeed, optimalAngles, spiMinTwa } from './polar.js';
import { TUNING } from './tuning.js';
import { variantesDe } from './bateau.js';

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

export function renderJ80(el, opts) {
  if (opts.bateau?.reglages === false) { renderBateau(el, opts); return; }
  const { onImport, onReset, perf, onPerf, wind } = opts;
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

// ───────── Bateau d’un autre espace (Tofinou 9.5) : aucun texte ni réglage du J80
const VOILES = { genois: 'Génois', foc: 'Foc d’origine' };
const nom = (v) => VOILES[v] ?? v;
const fr = (x, d = 2) => (+x).toFixed(d).replace('.', ',');

function renderBateau(el, { onImport, onReset, perf, onPerf, wind, bateau: b, voile, onVoile }) {
  const P = getPolar();
  const variantes = variantesDe({ bateau: b });
  const choisie = variantes.find((v) => v.voile === voile) ?? variantes[0];
  const perso = choisie && P.source !== choisie.source;                 // polaire personnelle importée : elle garde la priorité
  const targets = [4, 6, 8, 10, 12, 14, 16, 20, 24].map((t) => ({ t, ...optimalAngles(t), spi: spiMinTwa(t), b90: boatSpeed(t, 90) }));
  const cur = wind ? optimalAngles(Math.max(1, wind.spd)) : null;
  const tir = b.tirant ? `${fr(b.tirant.bas)} m quille basse, ${fr(b.tirant.haut)} m quille relevée` : '—';
  el.innerHTML = `
  ${cur ? `<div class="card hero"><div class="muted small">Cibles au vent prévu sur le 1er bord (${wind.spd.toFixed(0)} nd)</div><div class="kpis" style="margin-top:6px">
    <div class="kpi" style="background:rgba(255,255,255,.12)"><b>${cur.up.bsp.toFixed(1)} nd</b><span style="color:#cfe0ef">près · ${Math.round(cur.up.twa)}° TWA</span></div>
    <div class="kpi" style="background:rgba(255,255,255,.12)"><b>${cur.up.vmg.toFixed(1)}</b><span style="color:#cfe0ef">VMG près</span></div>
    <div class="kpi" style="background:rgba(255,255,255,.12)"><b>${cur.down.bsp.toFixed(1)} nd</b><span style="color:#cfe0ef">portant · ${Math.round(cur.down.twa)}°</span></div></div></div>` : ''}
  <div class="card"><h3>${esc(b.classe)} <small>bateau de l’espace</small></h3>
    <div class="kpis"><div class="kpi"><b>${fr(b.longueur)} m</b><span>longueur de coque</span></div>
    <div class="kpi"><b>${esc(b.virement_s)} s · ${esc(b.empannage_s)} s</b><span>perte au virement · à l’empannage (estimation)</span></div></div>
    <div class="small muted">Tirant d’eau : ${tir} (à confirmer). Les pertes aux manœuvres sont une estimation utilisée par le routage : à mesurer sur les traces.</div>
    <label class="f">Voile d’avant</label>
    <div class="btns" role="group">${variantes.map((v) => `<button type="button" class="btn small${v === choisie ? ' on' : ' alt'}" data-voile="${esc(v.voile)}" aria-pressed="${v === choisie}">${esc(nom(v.voile))}</button>`).join('')}</div>
    <div class="small muted">Génois : celui du certificat du sister-ship. Foc d’origine : polaire estimée, plus lente au près par petit temps. Voile du bateau à confirmer avec le skipper.</div>
    ${perso ? `<div class="small">Polaire personnelle importée (${esc(P.source)}) : elle reste appliquée ; « Polaire par défaut » revient à celle du ${esc(b.classe)} (${esc(nom(choisie.voile))}).</div>` : ''}</div>
  <div class="card"><h3>Vitesses cibles ${esc(b.classe)} <small>${esc(P.source)}</small></h3><div class="tablewrap"><table class="t">
    <tr><th>Vent</th><th>Près TWA</th><th>Vit.</th><th>VMG</th><th>Spi dès</th><th>Portant TWA</th><th>Vit.</th><th>VMG</th></tr>
    ${targets.map((r) => `<tr><td><b>${r.t}</b></td><td>${Math.round(r.up.twa)}°</td><td>${r.up.bsp.toFixed(1)}</td><td>${r.up.vmg.toFixed(1)}</td><td>${r.spi}°</td><td>${Math.round(r.down.twa)}°</td><td>${r.down.bsp.toFixed(1)}</td><td>${r.down.vmg.toFixed(1)}</td></tr>`).join('')}
  </table></div>
  ${polarSVG()}
  <label class="f">Performance de l’équipage par rapport à la polaire : <b id="pfL">${Math.round(perf * 100)} %</b></label><input id="pf" type="range" min="0.75" max="1.05" step="0.01" value="${perf}">
  <div class="small muted">Sert aux temps estimés (90–95 % est réaliste en flotte). N’influence pas les angles conseillés. Polaire d’un sister-ship, estimation à recaler : ce curseur d’abord, puis le débrief et, au besoin, une polaire personnelle. « Spi dès » : repère indicatif, à vérifier sur l’eau.</div></div>
  <div class="card"><h3>Polaire complète <small>nœuds</small></h3><div class="tablewrap"><table class="t"><tr><th>TWA \\ TWS</th>${P.tws.map((t) => `<th>${t}</th>`).join('')}</tr>
    ${P.twa.map((a, i) => (a === 0 ? '' : `<tr><td><b>${a}°</b></td>${P.bsp[i].map((v) => `<td>${(+v).toFixed(1)}</td>`).join('')}</tr>`)).join('')}</table></div>
    <label class="f">Importer votre polaire (.pol, .csv, .txt — format « TWA\\TWS » : 1re ligne = vents, 1re colonne = angles)</label>
    <input type="file" id="polFile" accept=".pol,.csv,.txt,text/plain">
    <div class="btns"><button class="btn small alt" id="polReset">Polaire par défaut</button>${variantes.map((v) => `<a class="btn small alt" href="${esc(v.fichier)}" download style="text-decoration:none">Télécharger la polaire (${esc(nom(v.voile).toLowerCase())}, .pol)</a>`).join('')}</div>
    <div class="small muted">Source : ${esc(choisie?.source ?? P.source)}.</div>
    <div class="small muted" id="polMsg"></div></div>`;
  el.querySelector('#pf').oninput = (e) => { el.querySelector('#pfL').textContent = `${Math.round(e.target.value * 100)} %`; };
  el.querySelector('#pf').onchange = (e) => onPerf(+e.target.value);
  el.querySelector('#polReset').onclick = onReset;
  for (const bt of el.querySelectorAll('[data-voile]')) bt.onclick = () => { const v = bt.getAttribute('data-voile'); if (v !== choisie?.voile) onVoile?.(v); };
  el.querySelector('#polFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { onImport(await f.text(), f.name); } catch (err) { el.querySelector('#polMsg').textContent = 'Import impossible : ' + err.message; }
  };
}
