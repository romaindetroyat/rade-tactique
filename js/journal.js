// Journal de diagnostic de l’app : un seul journal, alimenté par les erreurs du départ et de la course (FIAB-07).
// Premier module importé par js/app.js : une erreur d’évaluation d’un module importé ensuite est déjà rapportée ici.
// Rien ne quitte le téléphone sans un geste de l’équipier (copier, partager). Ne jamais y mettre : adresse de la page,
// témoins de connexion, position, code d’accès. Les messages sont nettoyés par scrub() (js/diag.js).

import { createDiag, stamp } from './diag.js';
import { BUILD } from './version.js';

const browser = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
let storage = null;
if (browser) { try { storage = window.localStorage; } catch { storage = null; /* stockage refusé : le journal reste en mémoire */ } }

let ctxFn = null;
export const setContext = (fn) => { ctxFn = typeof fn === 'function' ? fn : null; };     // 'depart' | 'course' | 'app'

export const journal = createDiag({ storage, context: () => (ctxFn ? ctxFn() : 'app') });

// Erreur : message de l’erreur, sinon le texte de ce qui a été levé ; son nom en complément
export function report(where, err, extra) {
  const msg = err?.message ?? (typeof err === 'string' ? err : String(err));
  const x = extra ?? (err && typeof err === 'object' && err.name && err.name !== 'Error' ? err.name : undefined);
  return journal.log('error', where, msg, x);
}
// Information : un fait utile au diagnostic (page masquée, silence du GPS, état du son)
export const note = (where, msg) => journal.log('info', where, msg);

// En-tête du texte copié : de quoi lever l’inconnue des versions d’iOS et des API (D-05). Aucun secret, aucune adresse de page.
export async function header() {
  const nav = globalThis.navigator || {};
  const ios = /(?:iPhone|iPad|iPod)[^)]*?OS (\d+)[_.](\d+)/.exec(nav.userAgent || '');
  let installed = nav.standalone === true;
  try { if (!installed && typeof matchMedia === 'function') installed = matchMedia('(display-mode: standalone)').matches; } catch { /* media query indisponible : non installée */ }
  let persisted = 'inconnu';
  try { const p = await nav.storage?.persisted?.(); if (p === true) persisted = 'oui'; else if (p === false) persisted = 'non'; } catch { /* API absente : inconnu */ }
  const api = (name) => (name in nav ? 'API présente' : 'API absente');
  return [
    `Rade Tactique ${BUILD.label} — ${BUILD.note}`,
    `système : ${ios ? `iOS ${ios[1]}.${ios[2]}` : 'autre'}`,
    `app installée : ${installed ? 'oui' : 'non'}`,
    `verrou d’écran : ${api('wakeLock')}`,
    `session audio : ${api('audioSession')}`,
    `stockage persistant : ${persisted}`,
    `copie du ${stamp(Date.now())} (heure de Paris)`,
  ].join('\n');
}

if (browser) {
  window.addEventListener('error', (e) => report('page', e.error ?? e.message, [e.filename, e.lineno].filter((v) => v != null && v !== '').join(':') || undefined));
  window.addEventListener('unhandledrejection', (e) => report('promesse', e.reason));
  setInterval(() => journal.flush(), 10000);
  window.addEventListener('pagehide', () => journal.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) journal.flush(); });
}
