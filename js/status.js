// Voyant d’état en mer : quatre lampes (GPS, écran, son, réseau) calculées par une fonction pure (FIAB-05).
// Chaque lampe vient d’une observation réelle, jamais d’une intention : âge du dernier point GPS reçu, verrou d’écran réellement tenu,
// horloge audio qui avance, réponse HTTP d’une sonde. Le réseau n’est jamais rouge : l’app fonctionne hors réseau.
// Niveaux : ok (vert) · warn (orange) · bad (rouge) · off (grisé, rien d’attendu). act : action proposée à l’équipier
// ('gps' | 'wake' | 'sound' | 'test' | 'net') ou null.

export const GPS_STALE_S = 10, GPS_WARN_S = 4, GPS_ACC_WARN_M = 15, NET_STALE_MS = 10 * 60e3;

const lamp = (id, level, text, detail, act = null, extra = null) => ({ id, level, text, detail, act, ...extra });
const JAMAIS = 'verrouillage auto sur « Jamais »';

// gps : { on, lastAt (heure de RÉCEPTION du dernier point, pas celle du GPS), acc, err (code 1 à 3) }
// wake : { supported, wanted, held, err } (js/wakelock.js) · audio : { state, alive, tested } (soundState dans js/app.js) · net : { online, lastOkAt, rtt }
export function computeStatus({ now = Date.now(), needGps = false, needScreen = false, needSound = false, gps = {}, wake = {}, audio = {}, net = {} } = {}) {
  const lamps = [];

  // GPS : muet depuis plus de 10 s = rouge, plus de 4 s ou précision au-delà de 15 m = orange
  if (!needGps && !gps.on) lamps.push(lamp('gps', 'off', 'GPS', 'éteint'));
  else if (gps.err === 1) lamps.push(lamp('gps', 'bad', 'GPS', 'refusé : Réglages › Confidentialité › Service de localisation', 'gps'));
  else if (!gps.on) lamps.push(lamp('gps', 'bad', 'GPS', 'éteint : touchez pour l’activer', 'gps'));
  else if (gps.lastAt == null) lamps.push(lamp('gps', 'warn', 'GPS', 'recherche…' + (gps.err === 2 ? ' (position indisponible)' : gps.err === 3 ? ' (délai dépassé)' : '')));
  else {
    const s = (now - gps.lastAt) / 1000, age = Math.round(s);
    if (s > GPS_STALE_S) lamps.push(lamp('gps', 'bad', 'GPS', `muet depuis ${age} s`, 'gps', { age }));
    else lamps.push(lamp('gps', s > GPS_WARN_S || gps.acc > GPS_ACC_WARN_M ? 'warn' : 'ok', 'GPS', `±${Math.round(gps.acc ?? 0)} m · il y a ${age} s`, null, { age }));
  }

  // Écran : l’état est celui du verrou réellement tenu ; rouge seulement quand quelque chose en dépend (chrono, mode départ, trace, GPS)
  if (wake.held) lamps.push(lamp('screen', 'ok', 'ÉCRAN', 'maintenu allumé'));
  else if (!wake.supported) lamps.push(lamp('screen', needScreen ? 'bad' : 'off', 'ÉCRAN', `non maintenu (API absente), ${JAMAIS}`, needScreen ? 'wake' : null));
  else lamps.push(lamp('screen', needScreen ? 'bad' : 'off', 'ÉCRAN', `non maintenu, ${JAMAIS}`, needScreen ? 'wake' : null));

  // Son : « running » ne prouve pas que le son sort (horloge audio), et ni le bouton silencieux ni le volume ne se lisent : le test fait foi
  if (!needSound && audio.state == null) lamps.push(lamp('sound', 'off', 'SON', 'pas armé'));
  else if (audio.state !== 'running') lamps.push(lamp('sound', 'bad', 'SON', audio.state === 'interrupted' ? 'interrompu : touchez pour réactiver' : 'coupé : touchez pour réactiver', 'sound'));
  else if (audio.alive === false) lamps.push(lamp('sound', 'bad', 'SON', 'horloge audio figée : touchez pour réactiver', 'sound'));
  else if (audio.tested === false) lamps.push(lamp('sound', 'bad', 'SON', 'pas entendu au test : bouton silencieux, volume ?', 'test'));
  else if (audio.tested == null) lamps.push(lamp('sound', 'warn', 'SON', 'non testé : « Tester le son »', 'test'));
  else lamps.push(lamp('sound', 'ok', 'SON', 'testé'));

  // Réseau : jamais rouge (l’app continue hors réseau) ; la sonde passe réellement par le réseau, navigator.onLine n’est qu’un indice
  if (net.online === false) lamps.push(lamp('net', 'warn', 'RÉSEAU', 'hors réseau (l’app continue)', 'net'));
  else if (net.lastOkAt == null) lamps.push(lamp('net', 'off', 'RÉSEAU', 'non vérifié', 'net'));
  else if (now - net.lastOkAt > NET_STALE_MS) lamps.push(lamp('net', 'warn', 'RÉSEAU', `aucune réponse depuis ${Math.round((now - net.lastOkAt) / 60e3)} min`, 'net'));
  else lamps.push(lamp('net', 'ok', 'RÉSEAU', net.rtt ? `${Math.round(net.rtt)} ms` : 'ok'));

  return { lamps, worst: lamps.some((l) => l.level === 'bad') ? 'bad' : lamps.some((l) => l.level === 'warn') ? 'warn' : 'ok' };
}

// Libellés partagés par le mode départ et la bande « en course »
const ACTIONS = { gps: 'Relancer', wake: 'Réessayer', sound: 'Réactiver', test: 'Tester le son', net: 'Vérifier' };
export const actionLabel = (act) => ACTIONS[act] ?? '';
export const lampLabel = (l) => (l.id === 'gps' && l.age != null && l.level !== 'off' ? `GPS ${l.age} s` : l.text);
