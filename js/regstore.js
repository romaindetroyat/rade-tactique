// Données lourdes des régates (prévisions du jour, relevés de vent, route conseillée figée) : base IndexedDB `rade-regates`, séparée de
// la base des traces pour ne jamais monter la version d’une base existante. Les clés sont écrites par l'appelant (voir slotKey de js/gel.js).
// Les erreurs (base pleine, refusée, corrompue) remontent à l’appelant, qui les consigne : rien n’est avalé ici.

const DB = 'rade-regates', ST = 'slots';
let ouverte = null;                           // une seule connexion partagée ; remise à zéro si l’ouverture échoue ou si un autre onglet la réclame

function db() {
  ouverte ??= new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);                // clés explicites : put(valeur, clé)
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); ouverte = null; }; ok(d); };
    r.onerror = () => { ouverte = null; ko(r.error); };
    r.onblocked = () => { ouverte = null; ko(new Error('base des régates bloquée par un autre onglet')); };
  });
  return ouverte;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, ko) => {
    const t = d.transaction(ST, mode), r = fn(t.objectStore(ST));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => ko(t.error);
    t.onabort = () => ko(t.error || new Error('écriture annulée (base pleine ?)'));
  });
}

// Range une valeur sous sa clé (remplace la précédente)
export const putSlot = (cle, valeur) => tx('readwrite', (s) => s.put(valeur, cle));
// Relit une valeur ; undefined si elle n’existe pas
export const getSlot = (cle) => tx('readonly', (s) => s.get(cle));
