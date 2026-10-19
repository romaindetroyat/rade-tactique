// Verrou « en course » et « journée de régate » (D-01 à D-03, D-15) : fonctions pures, sans DOM, sans horloge, sans stockage.
// Tant que le verrou est fermé, aucune mise à jour de l’app n’est proposée ni appliquée.
export const PARIS = 'Europe/Paris';
export const MORNING_END_H = 9;             // D-03 : avant 9 h (Paris) le jour de régate, la mise à jour reste possible
export const IDLE_MS = 3600e3;              // D-02 : retour au port = tout arrêté depuis 1 h
export const TIMER_GRACE_MS = 3 * 3600e3;   // chrono oublié : actif jusqu’à 3 h après H, puis il rend la main
export const HEAVY_BEFORE_MS = 6 * 60e3;    // séquence de départ : de H−6 min (un peu avant le signal d’avertissement)…
export const HEAVY_AFTER_MS = 60e3;         // …à H+1 min

const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

// Date et heure de Paris d’un instant (ms) : { date: 'AAAA-MM-JJ', hour, minute }. Gère l’heure d’été.
export function parisClock(ms) {
  const p = Object.fromEntries(FMT.formatToParts(ms).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute };
}

// D-01 : un chrono (jusqu’à 3 h après H), le mode départ, une trace ou le GPS comptent comme « en course », tous les jours
export function isActive({ now, timerEnd = null, startModeOpen = false, recording = false, gpsOn = false }) {
  if (timerEnd != null && now < timerEnd + TIMER_GRACE_MS) return true;
  return !!(startModeOpen || recording || gpsOn);
}

// Pas de recalcul automatique pendant la séquence de départ (de H−6 min à H+1 min inclus, H = fin du chrono) : l’affichage du mode départ
// doit rester fluide. Les gestes et les relevés de l’équipier ne sont jamais reportés : seul le code qui décide de reporter appelle ce prédicat.
export function heavyPaused({ now, timerEnd = null }) {
  if (timerEnd == null) return false;
  return now >= timerEnd - HEAVY_BEFORE_MS && now <= timerEnd + HEAVY_AFTER_MS;
}

// D-15 : la date de Paris de « now » est comprise entre le premier et le dernier jour de la régate (faux sans premier jour)
export function isRaceDay({ now, raceFrom = null, raceTo = null }) {
  if (!raceFrom) return false;
  const d = parisClock(now).date;
  return d >= raceFrom && d <= (raceTo || raceFrom);
}

// { locked, reason } : 'course' (activité en cours) ou 'journee' (jour de régate après 9 h, avant le retour au port)
export function lockState({ now, active, raceFrom = null, raceTo = null, lastActiveAt = null, finishedAt = null }) {
  if (active) return { locked: true, reason: 'course' };
  if (!isRaceDay({ now, raceFrom, raceTo })) return { locked: false, reason: null };
  const n = parisClock(now);
  if (n.hour < MORNING_END_H) return { locked: false, reason: null };
  // une activité ou un « course finie » ne comptent que le même jour de Paris (chaque jour d’une régate recommence)
  const sameDay = (t) => t != null && parisClock(t).date === n.date;
  const finished = sameDay(finishedAt) && finishedAt >= (lastActiveAt ?? 0);
  // l’activité du matin (avant 9 h) ne libère pas l’après-midi
  const idle = sameDay(lastActiveAt) && parisClock(lastActiveAt).hour >= MORNING_END_H && now - lastActiveAt >= IDLE_MS;
  return finished || idle ? { locked: false, reason: null } : { locked: true, reason: 'journee' };
}
