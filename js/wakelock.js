// Verrou d’écran unique (squelette de la phase RED : aucun comportement, les tests de tests/wakelock.test.mjs échouent).
export function createWakeLock() {
  return { want: async () => false, drop() {}, retry: async () => false, state: () => ({ supported: false, wanted: false, held: false, err: null, lastLostAt: null }) };
}
