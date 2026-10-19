// Mise à jour différée : la nouvelle version attend (état « waiting ») ; elle n’est appliquée que sur un geste de l’équipier
// et jamais en course (D-04 à D-07). Aucun rechargement ailleurs que dans apply().
import { BUILD } from './version.js';

export function initUpdates({ isLocked, onAvailable, onHidden, onApplied = () => location.reload() }) {
  if (!('serviceWorker' in navigator)) return null;
  const sw = navigator.serviceWorker;
  let pending = null, wantReload = false, reg = null;

  // un worker en attente : on lui demande sa version (GET_BUILD), il répond BUILD
  const announce = (worker) => {
    if (!worker || worker === pending?.worker) return;
    pending = { worker, build: null };
    worker.postMessage({ type: 'GET_BUILD' });
  };
  sw.addEventListener('message', (e) => {
    if (e.data?.type !== 'BUILD' || !pending) return;
    pending.build = e.data.build;
    if (!pending.build || pending.build.id === BUILD.id) { pending = null; return; }   // déjà cette version : rien à proposer
    refresh();
  });

  // appelé par le tick de 5 s de app.js : bandeau masqué sous verrou, proposé sinon
  function refresh() {
    if (!pending) return;
    if (!pending.build) { pending.worker.postMessage({ type: 'GET_BUILD' }); return; }
    if (isLocked()) onHidden(); else onAvailable(pending.build);
  }

  // bouton « Mettre à jour » : le verrou peut s’être fermé entre l’affichage et le geste
  function apply() {
    if (!pending || isLocked()) return false;
    wantReload = true;
    pending.worker.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }

  // pas de téléchargement de version en course
  function check() { if (reg && !isLocked()) reg.update().catch(() => {}); }

  // sans geste (premier claim d’une installation neuve, par exemple) : on ne touche à rien
  sw.addEventListener('controllerchange', () => { if (wantReload) { wantReload = false; onApplied(); } });

  sw.register('sw.js', { updateViaCache: 'none' }).then((r) => {
    reg = r;
    if (r.waiting && sw.controller) announce(r.waiting);
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) announce(w); });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 15 * 60e3);
    check();
  }).catch(() => {});

  return { apply, refresh, check };
}
