// Pack d’un plan d’eau téléchargé à la demande (D-04) : les fichiers data/<id>.* décrits par data/venues.json (chemin, taille, SHA-256)
// sont téléchargés par la page, vérifiés un par un (taille et empreinte, crypto.subtle) puis écrits ensemble dans un cache dédié
// `rade-venue-<id>-<pack>`, que le service worker sert hors réseau et que ses mises à jour ne suppriment jamais. Tout ou rien : un seul
// fichier altéré ou tronqué et rien n’est écrit ; l’ancien cache du même plan d’eau n’est supprimé qu’après un succès complet.
// Dépendances injectées (fetch, caches, subtle) : le module se teste sous Node avec de faux caches et un faux réseau.

export const PACK_PREFIX = 'rade-venue-';

// Fichiers sans lesquels la carte ne s’ouvre pas (Terrain.load) : un ancien jeu qui les a tous reste utilisable
const CORE = ['meta.json', 'terrain.bin', 'cover.bin', 'coast.json'];
const TYPES = { json: 'application/json', bin: 'application/octet-stream', jpg: 'image/jpeg', png: 'image/png' };

// 3 652 390 → « 3,7 Mo »
export const fmtMo = (octets) => `${(Math.max(0, Number(octets) || 0) / 1e6).toFixed(1).replace('.', ',')} Mo`;

// Nom du cache d’un plan d’eau pour un pack donné
export const packCache = (id, pack) => `${PACK_PREFIX}${id}-${pack}`;

// Entrée du manifeste, contrôlée : identifiant connu, pack et empreintes hexadécimales, chemins plats data/<id>.<suite> ; sinon null
export function packEntry(man, id) {
  const v = man?.venues && Object.hasOwn(man.venues, id) ? man.venues[id] : null;
  if (!v || !/^[a-z0-9-]+$/.test(id) || !/^[0-9a-f]{6,64}$/.test(v.pack ?? '') || !Array.isArray(v.files) || !v.files.length) return null;
  const pre = `data/${id}.`;
  const ok = v.files.every((f) => typeof f?.path === 'string' && f.path.startsWith(pre) && /^data\/[a-z0-9-]+\.[a-z0-9.-]+$/.test(f.path)
    && Number.isInteger(f.bytes) && f.bytes >= 0 && /^[0-9a-f]{64}$/.test(f.sha256 ?? ''));
  return ok ? v : null;
}

const has = async (c, path) => !!(await c.match(path));

// État du pack sur ce téléphone : 'ready' (le cache du pack actuel a chaque fichier du manifeste), 'stale' (un autre cache du même plan
// d’eau a au moins la méta, le relief, la couverture et la côte : utilisable, mise à jour à télécharger), sinon 'absent'.
// Rend { state, cache (nom du cache utilisable ou null), bytes (taille du pack actuel), others (autres caches du même plan d’eau) }.
export async function packStatus(man, id, { caches } = {}) {
  const v = packEntry(man, id);
  const bytes = v?.bytes ?? 0;
  if (!v || !caches) return { state: 'absent', cache: null, bytes, others: [] };
  const name = packCache(id, v.pack), pre = `${PACK_PREFIX}${id}-`;
  const keys = (await caches.keys()).filter((k) => k.startsWith(pre));
  const others = keys.filter((k) => k !== name);
  if (keys.includes(name)) {
    const c = await caches.open(name);
    let all = true;
    for (const f of v.files) if (!(await has(c, f.path))) { all = false; break; }
    if (all) return { state: 'ready', cache: name, bytes, others };
  }
  for (const k of others) {
    const c = await caches.open(k);
    let core = true;
    for (const s of CORE) if (!(await has(c, `data/${id}.${s}`))) { core = false; break; }
    if (core) return { state: 'stale', cache: k, bytes, others: others.filter((x) => x !== k) };
  }
  return { state: 'absent', cache: null, bytes, others };
}

// Supprime les autres caches du même plan d’eau (téléchargement interrompu entre l’écriture et le ménage) ; le cache `keep` reste
export async function prunePacks(id, keep, { caches } = {}) {
  if (!caches || !keep) return 0;
  let n = 0;
  for (const k of await caches.keys()) if (k !== keep && k.startsWith(`${PACK_PREFIX}${id}-`)) { await caches.delete(k); n++; }
  return n;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Télécharge, vérifie et écrit le pack. onProgress(octets vérifiés, total). Rend { ok: true, bytes, cache } ; lève une erreur en français sinon.
export async function downloadPack(man, id, { fetch, caches, subtle, onProgress } = {}) {
  const v = packEntry(man, id);
  if (!v) throw new Error('plan d’eau inconnu ou manifeste illisible');
  if (!subtle || typeof subtle.digest !== 'function') throw new Error('vérification impossible sur cet appareil');
  if (!caches) throw new Error('stockage hors réseau indisponible sur cet appareil');
  // 1. tout en mémoire d’abord, chaque fichier vérifié (taille et empreinte) : rien n’est écrit tant qu’un seul fichier manque
  const got = [];
  let done = 0;
  for (const f of v.files) {
    let r, buf;
    try { r = await fetch(`${f.path}?pack=${v.pack}`, { cache: 'no-store' }); } catch { throw new Error('pas de réseau'); }
    if (!r || r.status !== 200) throw new Error(`fichier altéré ou incomplet : ${f.path}`);
    try { buf = await r.arrayBuffer(); } catch { throw new Error(`fichier altéré ou incomplet : ${f.path}`); /* coupure pendant la lecture */ }
    if (buf.byteLength !== f.bytes) throw new Error(`fichier altéré ou incomplet : ${f.path}`);
    if (hex(await subtle.digest('SHA-256', buf)) !== f.sha256) throw new Error(`fichier altéré ou incomplet : ${f.path}`);
    const ext = f.path.split('.').pop();
    got.push({ path: f.path, buf, type: TYPES[ext] || r.headers?.get?.('content-type') || 'application/octet-stream' });
    done += f.bytes;
    try { onProgress?.(done, v.bytes); } catch { /* affichage de la progression : sans effet sur le téléchargement */ }
  }
  // 2. écriture dans le cache du pack (un reste d’essai interrompu est d’abord retiré), sous le chemin canonique, sans paramètre
  const name = packCache(id, v.pack);
  await caches.delete(name);
  try {
    const c = await caches.open(name);
    for (const g of got) await c.put(g.path, new Response(g.buf, { status: 200, headers: { 'content-type': g.type } }));
  } catch {
    try { await caches.delete(name); } catch { /* cache partiel : packStatus ne le dira jamais prêt */ }
    throw new Error('mémoire du téléphone pleine : plan d’eau non enregistré');
  }
  // 3. succès complet seulement : les anciens caches du même plan d’eau partent
  await prunePacks(id, name, { caches });
  return { ok: true, bytes: v.bytes, cache: name };
}
