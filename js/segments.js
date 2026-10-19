// Pauses d’une trace GPS (ARCH-04) : une pause d’enregistrement ou une perte du GPS coupe la trace en segments, jamais reliés.
// Fonctions pures, sans DOM ni stockage : js/track.js pose les coupures dans les données (tr.brk), js/scene3d.js les dessine sans pont.

export const PAUSE_GAP_S = 120;     // un trou de plus de 2 min (perte du GPS, pause) coupe toujours la ligne
export const SEG_GAP_S = 5;         // un nouveau <trkseg> (« Reprendre » d’Open GPX Tracker) coupe si le trou dépasse 5 s

// Indices des points qui commencent un segment (le premier point n’en fait pas partie) ; segStarts = indices des débuts de <trkseg>
export function segmentBreaks(pts, segStarts = []) {
  const set = new Set(segStarts.filter((i) => i > 0 && i < pts.length)), out = [];
  for (let i = 1; i < pts.length; i++) {
    const g = (pts[i][0] - pts[i - 1][0]) / 1000;
    if (g > PAUSE_GAP_S || (set.has(i) && g > SEG_GAP_S)) out.push(i);
  }
  return out;
}
