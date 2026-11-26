// Page des règles (regles.html + js/regles.js) rendue sous linkedom, sans réseau ni navigateur (08-09) : le script de la page tourne dans un
// contexte vm avec un faux stockage, un faux hôte et une fausse réponse de /api/rules ; son import de js/espaces.js passe par le chargeur
// de Node (vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER, fonction expérimentale de Node : un avertissement s’affiche). `racine` permet de rendre une extraction d’une ancienne version (capture de tests/fixtures/regles-v43.json sur 5e9b8a5).
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { ROOT } from './setup.mjs';

const tours = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

// → { document, html, corps } : DOM après le script (et après la réponse de l’arbitre si `question`), corps envoyés à /api/rules
export async function pageRegles({ racine = ROOT, hote = '127.0.0.1', stockage = {}, question = null, reponse = null } = {}) {
  const R = racine.replace(/\/?$/, '/');
  const { window, document } = parseHTML(readFileSync(R + 'regles.html', 'utf8'));
  window.Element.prototype.scrollIntoView ??= function () { /* sans mise en page */ };
  const store = new Map(Object.entries(stockage));
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
  const corps = [];
  const bac = {
    document, window, localStorage, location: { hostname: hote }, navigator: { onLine: true },
    IntersectionObserver: class { observe() { /* pas d’écran */ } },
    setTimeout, clearTimeout,
    fetch: async (url, opts) => { corps.push({ url: String(url), body: JSON.parse(opts?.body || 'null') }); return { ok: true, status: 200, json: async () => reponse }; },
  };
  vm.createContext(bac);
  const fichier = R + 'js/regles.js';
  if (existsSync(R + 'js/espaces.js')) await import(pathToFileURL(R + 'js/espaces.js').href);       // module déjà chargé : import du script résolu tout de suite
  new vm.Script(readFileSync(fichier, 'utf8'), { filename: fichier, importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }).runInContext(bac);
  await tours();
  if (question != null) {
    document.querySelector('#chatIn').value = question;
    document.querySelector('#chatForm').dispatchEvent(new window.Event('submit', { cancelable: true }));
    for (let i = 0; i < 50 && document.querySelector('#chatGo').disabled !== false; i++) await tours(5);
    await tours();
  }
  return { document, html: document.toString(), corps };
}

export const sha = (s) => createHash('sha256').update(s).digest('hex');

// États de Naos comparés à la v43 : hôtes de Naos, aperçu (hôte inconnu), plan d’eau de Brest, clé d’espace posée sur un hôte de Naos
export const REPONSE = { verdict: 'Un tour suffit', explication: 'La pénalité est d’un tour.', regles: [], ic: 'Pénalité d’un tour.', attention: '' };
export const CAS_NAOS = {
  local: { hote: '127.0.0.1' },
  production: { hote: 'rade-tactique.vercel.app' },
  apercu: { hote: 'apercu.localhost' },
  brest: { hote: '127.0.0.1', stockage: { 'rade.state': JSON.stringify({ venue: 'brest' }) } },
  'cle-tofinou-sur-naos': { hote: 'rade-tactique.vercel.app', stockage: { 'rade.espace.v1': 'tofinou' } },
};

// Empreintes du DOM de chaque état, sans puis avec une réponse de l’arbitre ; corps envoyés
export async function captureRegles(racine = ROOT) {
  const out = {};
  for (const [nom, cas] of Object.entries(CAS_NAOS)) {
    const vide = await pageRegles({ racine, ...cas });
    const rep = await pageRegles({ racine, ...cas, question: 'Combien de tours ?', reponse: REPONSE });
    out[nom] = { page: sha(vide.html), reponse: sha(rep.html), corps: rep.corps };
  }
  return out;
}
