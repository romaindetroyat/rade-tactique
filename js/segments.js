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

// Instants (ms) du premier point de chaque <trkseg> : robuste au tri et au dédoublonnage de fromGPX (on retrouve l’indice par l’instant)
export function segStartsFromDoc(doc) {
  const starts = [];
  for (const seg of [...doc.getElementsByTagName('trkseg')]) {
    const t = Date.parse(seg.getElementsByTagName('trkpt')[0]?.getElementsByTagName('time')[0]?.textContent?.trim() || '');
    if (!isNaN(t)) starts.push(t);
  }
  return starts;
}
export const breaksFromInstants = (pts, instants) => segmentBreaks(pts, instants.map((t) => pts.findIndex((p) => p[0] >= t)).filter((i) => i > 0));

// Coupures d’une trace : celles qui sont enregistrées (tr.brk), sinon la règle du trou (traces enregistrées avant les pauses, sans brk)
export const breaksOf = (tr) => tr.brk ?? segmentBreaks(tr.pts);

// Distance (m) et durée (s) d’enregistrement actif : somme par segment, jamais à travers une coupure.
// P : points avec .t (ms) ; .brk vrai sur le premier point d’un nouveau segment ; distXY(a, b) : distance en mètres
export function activeStats(P, distXY) {
  let dist = 0, dur = 0, start = 0;
  for (let i = 1; i <= P.length; i++) {
    if (i === P.length || P[i].brk) { if (i > start) dur += (P[i - 1].t - P[start].t) / 1000; start = i; }
    else dist += distXY(P[i - 1], P[i]);
  }
  return { dist, dur };
}

// Index des paires de points à relier pour THREE.LineSegments : (i, i + 1) pour tout i, sauf la paire qui franchirait une coupure
export function lineIndex(n, breaks = []) {
  const cut = new Set(breaks), out = [];
  for (let i = 0; i + 1 < n; i++) if (!cut.has(i + 1)) out.push(i, i + 1);
  return out;
}
