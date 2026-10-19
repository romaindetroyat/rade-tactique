// Cales communes des tests, chargées par `node --test --import ./tests/helpers/setup.mjs`.
// Fuseau Paris (les heures affichées en dépendent), DOMParser (fromGPX), fetch local vers les fichiers du dépôt.
// Le réseau est interdit : un test qui sortirait sur Internet échoue au lieu de dépendre d’un service tiers.
process.env.TZ = 'Europe/Paris';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

globalThis.DOMParser = parseHTML('<html></html>').DOMParser;

globalThis.fetch = async (url) => {
  const u = String(url);
  if (/^https?:/i.test(u)) throw new Error('réseau interdit dans les tests');
  const buf = readFileSync(ROOT + u.replace(/^\.?\//, ''));
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(buf.toString('utf8')),
    text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
};

// Lit un fichier de tests/fixtures/ (texte par défaut ; enc = null pour des octets)
export const fixture = (name, enc = 'utf8') => readFileSync(ROOT + 'tests/fixtures/' + name, enc ?? undefined);
