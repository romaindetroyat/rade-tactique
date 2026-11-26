// Rapport de débrief de Naos figé sur la v43 (08-06, D-01, D-07) : HTML rendu par buildReport (js/debrief.js) d’une racine, sur la trace de
// référence de la Coupe SNPM (même chaîne que tests/helpers/reference.mjs : fromGPX → detect → analyze → narrative automatique → buildReport).
// Capture une seule fois sur le code extrait de 5e9b8a5 (v43), jamais sur le code modifié :
//   node tests/helpers/debriefv43.mjs --capture <racine> <sortie>
//   node tests/helpers/debriefv43.mjs --rendu <racine> [--espace <id>]     rendus sur la sortie standard (processus neuf : espace fixé une fois)
// tests/debrief.test.mjs compare le rendu du dépôt à tests/fixtures/debrief-v43.json (empreinte SHA-256 du HTML, octet pour octet ; aucun appel
// à git pendant npm test). Le fichier n’a pas « .test. » dans son nom : `npm test` ne le lance pas. Aucun réseau : la rédaction est l’automatique.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

process.env.TZ = 'Europe/Paris';
const DEPOT = fileURLToPath(new URL('../../', import.meta.url));
const GPX = 'tests/fixtures/coupe-snpm-2026-10-18.gpx';
const REF = JSON.parse(readFileSync(DEPOT + 'tests/reference/coupe-snpm-2026-10-18.json', 'utf8'));

// Cales d’un navigateur hors réseau : DOMParser (fromGPX), fetch des fichiers de la racine, image de fond illisible (rapport sans carte)
function cales(base) {
  globalThis.DOMParser = parseHTML('<html></html>').DOMParser;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/^https?:/i.test(u) || u.startsWith('api/') || u.startsWith('/api/')) throw new Error('réseau interdit');
    const buf = readFileSync(base + u.replace(/^\.?\//, ''));
    return { ok: true, status: 200, json: async () => JSON.parse(buf.toString('utf8')), text: async () => buf.toString('utf8'),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  };
  globalThis.Image = class { decode() { return Promise.reject(new Error('pas d’image hors navigateur')); } };
}

// Textes lisibles du rapport (pour un écart parlant) : titres, sur-titre et notes
const textes = (html) => [...html.matchAll(/<(h2|div class="eyebrow"|p class="note")>([\s\S]*?)<\/(h2|div|p)>/g)].map((m) => m[2].replace(/<[^>]+>/g, ''));

// Rendus de deux états : relevés de vent de la référence, puis prévision seule (force du vent tirée de la prévision)
export async function rapports(racine, { espace = null } = {}) {
  const base = racine.replace(/\/?$/, '/');
  cales(base);
  const imp = (f) => import(pathToFileURL(base + f).href);
  if (espace) (await imp('js/espaces.js')).setEspace(espace);
  const [{ fromGPX }, { detect, analyze, narrative, buildReport }, { Terrain }, { WindField }] =
    await Promise.all([imp('js/track.js'), imp('js/debrief.js'), imp('js/geo.js'), imp('js/wind.js')]);
  const T = await new Terrain().load('data/');
  const e = REF.entrees, out = {};
  for (const [nom, avecVent] of [['relevés de la référence', true], ['prévision seule, sans relevé', false]]) {
    const tr = fromGPX(readFileSync(DEPOT + GPX, 'utf8'), GPX.split('/').pop());
    const det = detect(tr);
    const jour = new Date(tr.start).toISOString().slice(0, 10);
    const mc = det.mc;
    const ans = {
      course: mc.c, cls: 'P', marks: mc.hit.slice(0, 3).map((h, i) => ({ k: h.k, t: h.t, side: mc.exp[i].side })),
      startWind: e.startWind, tStart: det.tStart, falseStarts: 2, reduced: true, event: 'Coupe SNPM', place: '3', fleet: '9', notes: 'Note de l’équipier',
    };
    const api = {
      F: new WindField(T), ctx: { terrain: T, forbidden: [], perf: 1 }, localFx: 1, restoreField() {},
      forecastAt: () => (avecVent ? e.prevision : null),
      obs: avecVent ? e.releves.map(([h, dir, spd]) => ({ t: Date.parse(`${jour}T${h}`), dir, spd })) : [],
      meta: T.meta, files: { base: 'data/' },
    };
    const an = analyze(det, ans, api);
    const nar = await narrative(an, ans);
    const html = (await buildReport(an, ans, nar, det, api)).replace(` le ${new Date().toLocaleDateString('fr-FR')}.`, ' le <date>.');
    out[nom] = { sha256: createHash('sha256').update(html).digest('hex'), octets: Buffer.byteLength(html), textes: textes(html) };
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, racine, a, b] = process.argv.slice(2);
  if (mode === '--rendu' && racine) { process.stdout.write(JSON.stringify(await rapports(racine, { espace: a === '--espace' ? b : null }))); process.exit(0); }
  if (mode !== '--capture' || !racine || !a) { console.error('usage : node tests/helpers/debriefv43.mjs --capture <racine> <sortie> | --rendu <racine> [--espace <id>]'); process.exit(2); }
  writeFileSync(a, JSON.stringify(await rapports(racine), null, 1) + '\n');
  console.log('capture écrite : ' + a);
}
