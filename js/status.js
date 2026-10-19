// Voyant d’état en mer : quatre lampes (GPS, écran, son, réseau) calculées par une fonction pure (FIAB-05).
// Chaque lampe vient d’une observation réelle, jamais d’une intention : âge du dernier point GPS reçu, verrou d’écran réellement tenu,
// horloge audio qui avance, réponse HTTP d’une sonde. Squelette : le calcul est écrit au commit suivant.

export const GPS_STALE_S = 10, GPS_WARN_S = 4, GPS_ACC_WARN_M = 15, NET_STALE_MS = 10 * 60e3;

export function computeStatus() {
  return { lamps: [], worst: 'ok' };
}
