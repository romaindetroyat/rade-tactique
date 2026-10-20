// Faux code d’accès « code-de-test » pour exécuter le VRAI middleware.js (TEST-02, ARCH-01) : crypto.subtle.digest est simulé pour que ce faux
// code reçoive l’empreinte d’une ligne de la table, lue à l’exécution dans middleware.js. Aucune empreinte ni aucun code n’est écrit ici.
import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { ROOT } from './setup.mjs';

export const FAUX_CODE = 'code-de-test';
export const COOKIE_TEST = `rt_acces=${FAUX_CODE}`;

// Toutes les lignes { empreinte, prénom } de la table, lues à l’exécution (jamais affichées par les tests)
export function tableEquipage() {
  const source = readFileSync(ROOT + 'middleware.js', 'utf8');
  return [...source.matchAll(/'([0-9a-f]{64})'\s*:\s*'([^']+)'/g)].map(([, hex, prenom]) => ({ hex, prenom }));
}

// Exécute fn({ hex, prenom }) pendant que le faux code est accepté ; le simulacre est toujours retiré ensuite
export async function avecCodeSimule(fn) {
  const [ligne] = tableEquipage();
  if (!ligne) throw new Error('la table EQUIPAGE doit contenir au moins une ligne');
  const octets = Buffer.from(ligne.hex, 'hex');
  const vrai = crypto.subtle.digest.bind(crypto.subtle);
  const faux = mock.method(crypto.subtle, 'digest', async (algo, data) => (new TextDecoder().decode(data) === FAUX_CODE
    ? octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) : vrai(algo, data)));
  try { return await fn(ligne); } finally { faux.mock.restore(); }
}
