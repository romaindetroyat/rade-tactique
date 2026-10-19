// Chargement de Playwright et de Chromium pour les outils de mesure (hors npm test, hors package.json).
// Playwright n’est jamais une dépendance du dépôt : il est installé à part (global), sinon `npm ci` sur Vercel
// téléchargerait des navigateurs. Ces outils sont facultatifs, sauf quand la mesure est exigée (PW_REQUIRED=1).
//
//   PW_MODULE     module Playwright à charger de préférence (chemin du fichier ou du dossier)
//   PW_CHROMIUM   exécutable Chromium à lancer
//   PW_REQUIRED=1 une mesure impossible est un échec (sortie 2), jamais une mesure sautée
//
// Codes de sortie : 0 = mesure faite et dans les seuils (ou sautée sans PW_REQUIRED), 1 = hors seuil, 2 = mesure impossible avec PW_REQUIRED=1.

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const REQUIRED = process.env.PW_REQUIRED === '1';

function candidats() {
  const c = [];
  if (process.env.PW_MODULE) c.push(process.env.PW_MODULE);
  c.push('/opt/node-tools/node_modules/playwright/index.mjs');
  try { c.push(execFileSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 15000 }).trim() + '/playwright'); } catch { /* npm absent */ }
  c.push('/opt/node22/lib/node_modules/playwright');
  return c;
}

async function charge(chemin, essais) {
  try {
    if (!existsSync(chemin)) { essais.push(`${chemin} (absent)`); return null; }
    const mod = /\.m?js$/.test(chemin)
      ? await import(pathToFileURL(chemin).href)
      : createRequire(import.meta.url)(chemin);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (!chromium) { essais.push(`${chemin} (pas de chromium exporté)`); return null; }
    return chromium;
  } catch (e) { essais.push(`${chemin} (${e.message})`); return null; }
}

function abandon(essais, derniere) {
  if (!REQUIRED) { console.log('Playwright absent : mesure sautée'); process.exit(0); }
  console.error(`Playwright requis (PW_REQUIRED=1) : mesure impossible — essayé : ${essais.join(' ; ') || 'rien'}${derniere ? ` ; dernière erreur : ${derniere}` : ''}`);
  process.exit(2);
}

export async function launchChromium({ args = [] } = {}) {
  const essais = []; let derniere = '';
  const exe = process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  for (const chemin of candidats()) {
    const chromium = await charge(chemin, essais);
    if (!chromium) continue;
    try {
      const browser = await chromium.launch({ headless: true, args, ...(exe ? { executablePath: exe } : {}) });
      return { browser, chromium };
    } catch (e) { derniere = e.message.split('\n')[0]; essais.push(`${chemin} (lancement impossible)`); }
  }
  abandon(essais, derniere);
}
