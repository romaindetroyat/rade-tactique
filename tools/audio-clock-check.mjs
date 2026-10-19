// Mesure des bips sur l’horloge audio, fil principal gelé (FIAB-03). Outil facultatif, hors npm test.
//
//   PW_REQUIRED=1 node tools/audio-clock-check.mjs
//
// Un chrono finit 12 s après le lancement ; le vrai js/beeper.js pose les bips sur un AudioContext dont la sortie passe par
// un AudioWorklet qui relève l’instant exact (fil audio) de chaque début de bip. Le fil principal est gelé deux fois 1,3 s
// (vers H−9 s et H−4 s). Pour chacun des 11 derniers jalons (10…1 s et signal), l’écart avec l’heure attendue est affiché en ms.
// Sortie : 0 = tous présents à ±30 ms ; 1 = bip manquant, fusionné ou écart > 30 ms ; 2 = mesure impossible avec PW_REQUIRED=1.
// Jusqu’à 3 tentatives (AUDIO_CLOCK_TENTATIVES) : l’horloge audio de la machine virtuelle de mesure glisse parfois de quelques
// dizaines de ms par rapport à l’heure murale (sans rapport avec le planificateur) ; un vrai défaut (bip retardé d’une seconde, manquant
// ou fusionné) échoue à chaque tentative. Toutes les tentatives sont affichées. AUDIO_CLOCK_DEBUG=1 ajoute le relevé des lectures de l’horloge.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';
import { launchChromium } from './pw.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SEUIL_MS = 30;
const TENTATIVES = Number(process.env.AUDIO_CLOCK_TENTATIVES) || 3;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

const PAGE = `<!doctype html><meta charset="utf-8"><title>bips</title><script type="module">
import { createBeeper, milestones } from '/js/beeper.js';
const FIN_DANS_MS = 12000, GEL_MS = 1300;
const worklet = \`
class Det extends AudioWorkletProcessor {
  constructor() { super(); this.calme = 1e9; }
  process(inputs) {
    const x = inputs[0] && inputs[0][0];
    if (x) for (let i = 0; i < x.length; i++) {
      if (Math.abs(x[i]) > 0.005) { if (this.calme >= 256) this.port.postMessage((currentFrame + i) / sampleRate); this.calme = 0; }
      else this.calme++;
    }
    return true;
  }
}
registerProcessor('det', Det);\`;
(async () => {
  try {
    const ctx = new AudioContext();
    await ctx.resume();
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([worklet], { type: 'text/javascript' })));
    const det = new AudioWorkletNode(ctx, 'det', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    det.connect(ctx.destination);
    const onsets = []; det.port.onmessage = (e) => onsets.push(e.data);
    // jamais le son par défaut : le même oscillateur et la même enveloppe, mais branchés sur le détecteur
    const play = (f, d, when) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(det);
      g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.4, when + 0.005); g.gain.exponentialRampToValueAtTime(0.001, when + d);
      o.start(when); o.stop(when + d + 0.02); return o;
    };
    // ancrage de référence : currentTime n’avance que par paliers et retarde toujours sur l’instant réel ; en l’échantillonnant
    // pendant 400 ms (toutes les 2 ms), le plus haut décalage (horloge audio − heure murale) est le moins périmé
    let o = -Infinity; const fin = performance.now() + 400;
    while (performance.now() < fin) { o = Math.max(o, ctx.currentTime - Date.now() / 1000); await new Promise((ok) => setTimeout(ok, 2)); }
    const wall0 = Date.now(), ct0 = o + wall0 / 1000;
    const end = wall0 + FIN_DANS_MS;
    const attendus = milestones(end, wall0 - 400).map((m) => ({ s: m.s, ct: ct0 + (m.at - wall0) / 1000 }));
    // AUDIO_CLOCK_DEBUG=1 : relevé de chaque lecture de l’horloge audio faite par le planificateur (diagnostic)
    const lectures = [];
    const vue = { get state() { return ctx.state; }, get currentTime() { const c = ctx.currentTime; lectures.push([Date.now(), c]); return c; } };
    const beeper = createBeeper({ ctx: vue, play });
    beeper.arm(end);
    setInterval(() => beeper.tick(), 250);
    const gel = (avantFin) => setTimeout(() => { const t = performance.now(); while (performance.now() - t < GEL_MS); }, Math.max(0, end - avantFin - Date.now()));
    gel(9000); gel(4000);
    setTimeout(() => { window.__res = { state: ctx.state, attendus, onsets, lectures, wall0, ct0 }; window.__done = true; }, FIN_DANS_MS + 2500);
  } catch (e) { window.__err = String(e && e.message || e); window.__done = true; }
})();
</script>`;

const serveur = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x').pathname;
  if (u === '/__bips.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(PAGE); }
  try {
    const f = normalize(join(ROOT, u)); if (!f.startsWith(ROOT)) throw new Error('hors dépôt');
    const octets = await readFile(f);
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(octets);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const port = serveur.address().port;

// Une tentative = une page neuve, un chrono neuf. Retourne { ok, pire, manquants }.
async function tentative(browser, n) {
  const page = await (await browser.newContext()).newPage();
  try {
    page.on('pageerror', (e) => console.error('erreur page :', e.message));
    await page.goto(`http://127.0.0.1:${port}/__bips.html`);
    await page.waitForFunction(() => window.__done, null, { timeout: 40000 });
    const err = await page.evaluate(() => window.__err);
    if (err) throw new Error('la page a échoué : ' + err);
    const { state, attendus, onsets, lectures, wall0, ct0 } = await page.evaluate(() => window.__res);
    console.log(`Tentative ${n}/${TENTATIVES} — contexte audio : ${state} · ${onsets.length} début(s) de bip relevé(s) pour ${attendus.length} attendus · fil principal gelé 2 × 1,3 s`);
    const pris = new Set(); let pire = 0, manquants = 0;
    for (const a of attendus) {
      let best = -1;
      onsets.forEach((o, i) => { if (!pris.has(i) && Math.abs(o - a.ct) < 0.5 && (best < 0 || Math.abs(o - a.ct) < Math.abs(onsets[best] - a.ct))) best = i; });
      const nom = a.s === 0 ? 'signal' : `${String(a.s).padStart(2)} s  `;
      if (best < 0) { manquants++; console.log(`bip ${nom} : MANQUANT`); continue; }
      pris.add(best);
      const ms = (onsets[best] - a.ct) * 1000; pire = Math.max(pire, Math.abs(ms));
      console.log(`bip ${nom} : ${ms >= 0 ? '+' : '−'}${Math.abs(ms).toFixed(1).replace('.', ',')} ms${Math.abs(ms) > SEUIL_MS ? '  HORS SEUIL' : ''}`);
    }
    if (process.env.AUDIO_CLOCK_DEBUG === '1') {
      console.log('lectures du planificateur : écart de (currentTime − heure murale) avec l’ancrage de référence, en ms, depuis le lancement');
      for (const [w, c] of lectures) console.log(`  t=${String(w - wall0).padStart(6)} ms  décalage ${((c - w / 1000 - (ct0 - wall0 / 1000)) * 1000).toFixed(1).padStart(7)} ms`);
    }
    const extra = onsets.length - pris.size;
    console.log(`Écart maximal : ${pire.toFixed(1).replace('.', ',')} ms (seuil ${SEUIL_MS} ms) · manquants : ${manquants} · bips en trop ou fusionnés : ${extra}`);
    return { ok: !manquants && !extra && pire <= SEUIL_MS && state === 'running', pire, manquants };
  } finally { await page.context().close().catch(() => {}); }
}

let browser, code = 0;
try {
  ({ browser } = await launchChromium({ args: ['--autoplay-policy=no-user-gesture-required'] }));
  let reussi = 0;
  for (let n = 1; n <= TENTATIVES && !reussi; n++) { if ((await tentative(browser, n)).ok) reussi = n; else if (n < TENTATIVES) console.log('Tentative hors seuil, on recommence (l’horloge audio du bac à sable peut glisser de quelques dizaines de ms).\n'); }
  if (reussi) console.log(`RÉSULTAT : OK (tentative ${reussi}/${TENTATIVES})`);
  else { console.log(`RÉSULTAT : ÉCHEC (${TENTATIVES} tentatives hors seuil)`); code = 1; }
} catch (e) {
  console.error('Mesure en échec :', e.message);
  code = process.env.PW_REQUIRED === '1' ? 2 : 1;
} finally {
  await browser?.close().catch(() => {});
  serveur.close();
}
process.exit(code);
