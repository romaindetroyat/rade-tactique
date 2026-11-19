// Marée calculée dans l’app (D-13) à partir de data/brest.maree.json (tools/build_maree.py : harmoniques ajustées sur le marégraphe
// du Shom – REFMAR) : hauteur, pleines et basses mers, marée en cours, coefficient approché. Fonctions pures : ni horloge ni réseau ;
// tout instant est en millisecondes de temps universel (l’heure de Paris n’intervient qu’à l’affichage).
// P = { z0, c: [[nom, fréquence (cycles/h), amplitude (m), situation (°)]], years: { AAAA: { f: […], vu: […] } } }

const H = 3600000;           // ms par heure
const RAD = Math.PI / 180;

// Hauteur d’eau (m au-dessus du zéro des cartes) à l’instant ms ; null hors des années du fichier (pas de marée plutôt qu’une marée fausse)
export function hauteur(P, ms) {
  if (!P || !Number.isFinite(ms)) return null;
  const Y = new Date(ms).getUTCFullYear(), y = P.years?.[Y];
  if (!y) return null;
  const h = (ms - Date.UTC(Y, 0, 1)) / H;
  let z = P.z0;
  for (let i = 0; i < P.c.length; i++) {
    const [, frq, A, g] = P.c[i];
    z += y.f[i] * A * Math.cos(2 * Math.PI * frq * h + (y.vu[i] - g) * RAD);
  }
  return z;
}

const PAS = 6 * 60000;       // balayage au pas de 6 min, puis affinage à la minute

// Pleines et basses mers entre t0 (inclus) et t1 (exclu) : [{ t, h, type: 'PM' | 'BM' }], triées ; [] hors des années du fichier
export function extremes(P, t0, t1) {
  const out = [];
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return out;
  const a0 = Math.floor(t0 / 60000) * 60000 - PAS;
  let pa = hauteur(P, a0), pb = hauteur(P, a0 + PAS);
  for (let t = a0 + PAS; t < t1 + PAS; t += PAS) {
    const pc = hauteur(P, t + PAS);
    if (pa != null && pb != null && pc != null && ((pb > pa && pb >= pc) || (pb < pa && pb <= pc))) {
      const haut = pb > pa;
      let bt = t, bh = pb;
      for (let m = t - PAS + 60000; m < t + PAS; m += 60000) {
        const v = hauteur(P, m);
        if (v != null && (haut ? v > bh : v < bh)) { bt = m; bh = v; }
      }
      if (bt >= t0 && bt < t1 && !(out.length && out[out.length - 1].t === bt)) out.push({ t: bt, h: bh, type: haut ? 'PM' : 'BM' });
    }
    pa = pb; pb = pc;
  }
  return out;
}

// Marée en cours à l’instant ms : { t, pm, bm, marnage, hm, avant, apres, entre } ou null.
//   pm : pleine mer la plus proche { t, h } ; hm : heure de marée (h depuis pm, négative avant) ;
//   bm : basse mer adjacente, du côté de l’instant (avant la pleine mer : celle qui la précède ; après : celle qui la suit) ;
//   marnage = pm.h − bm.h (marée montante avant la pleine mer, descendante après) ;
//   avant, apres : pleines mers qui encadrent l’instant ; entre : basse mer qui les sépare (liaison entre deux cycles, js/courant.js).
export function mareeEn(P, ms) {
  if (!Number.isFinite(ms)) return null;
  const ex = extremes(P, ms - 14 * H, ms + 14 * H);
  const pms = ex.filter((e) => e.type === 'PM');
  const avant = pms.filter((e) => e.t <= ms).pop(), apres = pms.find((e) => e.t > ms);
  if (!avant || !apres) return null;
  const entre = ex.filter((e) => e.type === 'BM' && e.t > avant.t && e.t < apres.t).reduce((a, e) => (!a || e.h < a.h ? e : a), null);
  if (!entre) return null;
  const pm = ms - avant.t <= apres.t - ms ? avant : apres;
  // la basse mer du côté de l’instant est toujours celle qui sépare les deux pleines mers qui l’encadrent
  return { t: ms, pm, bm: entre, marnage: pm.h - entre.h, hm: (ms - pm.t) / H, avant, apres, entre };
}

// Coefficient approché d’après le marnage (étude § 4.2 : 2,80 m → 45, 5,90 m → 95), borné à [20, 120] ; ce n’est pas le coefficient officiel
export function coefApproche(marnage) {
  if (!Number.isFinite(marnage)) return null;
  return Math.max(20, Math.min(120, Math.round(45 + (marnage - 2.80) * 50 / 3.10)));
}
