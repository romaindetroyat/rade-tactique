// Verrou d’écran unique pour tout ce qui doit rester allumé en mer : mode départ, chrono, trace, GPS.
// Un seul propriétaire, plusieurs raisons (« startmode », « timer », « recording », « gps ») : le verrou est tenu tant qu’une raison
// est demandée. L’état est celui du verrou réellement tenu (sentinelle présente et non libérée), jamais l’intention.
// Sur iOS le verrou n’est fiable en app installée qu’à partir de 18.4 (WebKit 254545) : refus, libération à chaque masquage de page,
// redemandes (retour de visibilité, geste, toutes les 15 s) et rapport de chaque perte pour que l’app alerte et conseille (D-05).

export function createWakeLock({ nav = globalThis.navigator, doc = globalThis.document, report = () => {}, now = Date.now } = {}) {
  const why = new Set();
  let sentinel = null, err = null, lastLostAt = null, pending = false;
  const supported = () => !!nav?.wakeLock?.request;
  const held = () => !!sentinel && sentinel.released === false;     // booléen nu : jamais une promesse, un objet ni une intention

  async function acquire() {
    if (!supported() || !why.size || held() || pending || doc?.visibilityState === 'hidden') return held();
    pending = true;
    try {
      const s = await nav.wakeLock.request('screen');
      sentinel = s; err = null;
      s.addEventListener?.('release', () => {
        if (sentinel === s) { lastLostAt = now(); report('wake', 'verrou libéré' + (why.size ? ' (encore demandé)' : '')); }
      });
    } catch (e) {
      err = e?.name || 'Error';
      report('wake', 'demande refusée : ' + err);
    } finally { pending = false; }
    return held();
  }

  return {
    want(reason) { why.add(reason); return acquire(); },
    drop(reason) {
      why.delete(reason);
      if (!why.size && sentinel) {
        const s = sentinel; sentinel = null;                          // avant release() : la libération voulue n’est pas une perte
        try { Promise.resolve(s.release()).catch(() => {}); } catch { /* déjà libéré */ }
      }
    },
    retry: acquire,
    state: () => ({ supported: supported(), wanted: why.size > 0, held: held(), err, lastLostAt }),
  };
}
