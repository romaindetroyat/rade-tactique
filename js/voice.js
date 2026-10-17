// Relevé de vent à la voix : reconnaissance vocale du navigateur (si disponible) et lecture de phrases en français.
// Le même analyseur sert au champ texte, où l'on peut dicter avec le micro du clavier.

const UNITS = { zero: 0, zéro: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16 };
const TENS = { vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };

// « deux cent quatre-vingt-dix » → 290 ; renvoie le texte avec les nombres écrits en chiffres
export function wordsToDigits(text) {
  const toks = text.toLowerCase().replace(/[’']/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  const out = []; let cur = null, sub = 0, kind = null;
  const flush = () => { if (cur != null) { out.push(String(cur + sub)); cur = null; sub = 0; kind = null; } };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], next = toks[i + 1] || '';
    if (t === 'et' && cur != null && /^(un|une|onze)$/.test(next)) continue;
    const isQV = t === 'quatre' && /^vingts?$/.test(next);
    if (isQV) { if (kind === 'unit' || kind === 'tens') flush(); if (cur == null) cur = 0; sub += 80; kind = 'tens80'; i++; continue; }
    if (t === 'cent' || t === 'cents') { if (cur == null) cur = 0; cur += (sub || 1) * 100; sub = 0; kind = 'hundred'; continue; }
    if (t in TENS) { if (kind === 'unit' || kind === 'tens' || kind === 'tens80') flush(); if (cur == null) cur = 0; sub += TENS[t]; kind = TENS[t] === 60 ? 'tens60' : 'tens'; continue; }
    if (t in UNITS) {
      const u = UNITS[t];
      // une unité ne prolonge un nombre que s'il se termine par une dizaine (vingt-trois, soixante-douze, quatre-vingt-dix)
      if (kind === 'unit' || (kind === 'tens' && u > 9)) flush();
      if (cur == null) cur = 0;
      sub += u; kind = 'unit'; continue;
    }
    flush(); out.push(t);
  }
  flush();
  return out.join(' ');
}

const COMPASS = [
  ['nord nord est', 22.5], ['est nord est', 67.5], ['est sud est', 112.5], ['sud sud est', 157.5],
  ['sud sud ouest', 202.5], ['ouest sud ouest', 247.5], ['ouest nord ouest', 292.5], ['nord nord ouest', 337.5],
  ['nord est', 45], ['sud est', 135], ['sud ouest', 225], ['nord ouest', 315],
  ['nord', 0], ['est', 90], ['sud', 180], ['ouest', 270],
];
const r5 = (d) => ((Math.round(d / 5) * 5) % 360 + 360) % 360;
const SPEED_MAX = 30; // un nombre seul ≤ 30 est une force (on ne régate pas au-delà de 25 nd)

// last : { dir, spd } dernier vent connu ; tack : 1 bâbord amures, −1 tribord amures, null inconnu
export function parseWind(raw, last, tack = null) {
  const t = ' ' + wordsToDigits(raw).replace(/[,;.!?]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let dir = null, spd = null; const notes = [];
  // variations relatives
  const rel = (re) => { const m = re.exec(t); return m ? (m[1] ? +m[1] : 10) : null; };
  const ad = rel(/ adonn\w*(?: de)? (\d+)?/), rf = rel(/ refus\w*(?: de)? (\d+)?/);
  const rd = rel(/ (?:rotation |tourne |bascule )?(?:à |a )?droite(?: de)? (\d+)?/), rg = rel(/ (?:rotation |tourne |bascule )?(?:à |a )?gauche(?: de)? (\d+)?/);
  const pl = / (?:plus|\+) (\d+)(?: n\w*)?/.exec(t), mo = / (?:moins|-) (\d+)(?: n\w*)?/.exec(t);
  if (ad != null || rf != null) {
    if (!last) return { error: 'aucun relevé précédent pour « adonne / refuse »' };
    if (!tack) return { error: 'amure inconnue (GPS inactif) : dites « rotation à droite / à gauche de… »' };
    const n = ad ?? -rf; dir = r5(last.dir - tack * n); // bâbord : adonnante = le vent recule (gauche)
    notes.push(`${ad != null ? 'adonne' : 'refuse'} de ${Math.abs(n)}° (${tack > 0 ? 'bâbord' : 'tribord'} amures)`);
  } else if (rd != null || rg != null) {
    if (!last) return { error: 'aucun relevé précédent pour une rotation' };
    dir = r5(last.dir + (rd ?? -rg)); notes.push(`rotation à ${rd != null ? 'droite' : 'gauche'} de ${rd ?? rg}°`);
  }
  if (pl || mo) {
    if (!last) return { error: 'aucun relevé précédent pour « plus / moins »' };
    spd = Math.max(0, last.spd + (pl ? +pl[1] : -mo[1])); notes.push(pl ? `+${pl[1]} nd` : `−${mo[1]} nd`);
  }
  // valeurs absolues
  for (const [name, d] of COMPASS) if (t.includes(' ' + name + ' ')) { dir = r5(d); break; }
  const tAbs = t.replace(/ (?:plus|moins|\+|-) \d+(?: n\S*)?/g, ' ');
  const kn = /(\d+(?:[.,]\d)?) ?(?:n(?:œ|oe)uds?|nds?|kts?|kn)\b/.exec(tAbs);
  if (kn) spd = Math.round(+kn[1].replace(',', '.'));
  const dg = /(?:direction|du|cap|vent) (\d{1,3})\b/.exec(t) || /(\d{1,3}) ?(?:degrés?|°)/.exec(t);
  if (dg && +dg[1] <= 360 && !(kn && kn[1] === dg[1])) dir = r5(+dg[1]);
  const nums = [...t.matchAll(/\b(\d{1,3})\b/g)].map((m) => +m[1]).filter((n) => !(kn && n === Math.round(+kn[1])) && !(dg && n === +dg[1]) && !(pl && n === +pl[1]) && !(mo && n === +mo[1]) && ![ad, rf, rd, rg].includes(n));
  for (const n of nums) {
    if (dir == null && n > SPEED_MAX && n <= 360) dir = r5(n);
    else if (spd == null && n <= SPEED_MAX) spd = n;
    else if (dir == null && n <= 360) dir = r5(n);
  }
  if (dir == null && spd == null) return { error: 'je n’ai pas reconnu de direction ni de force' };
  return { dir: dir ?? last?.dir ?? null, spd: spd ?? last?.spd ?? null, partial: dir == null || spd == null, notes };
}

// ───────────────────────── reconnaissance vocale
export const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export function listen({ onResult, onError, onEnd }) {
  const rec = new SR();
  rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 4; rec.continuous = false;
  rec.onresult = (e) => onResult([...e.results[0]].map((a) => a.transcript));
  rec.onerror = (e) => onError(e.error === 'not-allowed' ? 'micro refusé (autorisez le micro pour ce site)' : e.error === 'no-speech' ? 'rien entendu' : e.error === 'network' ? 'pas de réseau pour la reconnaissance vocale' : e.error);
  rec.onend = onEnd;
  rec.start();
  return rec;
}
export function say(text) {
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* synthèse indisponible */ }
}
