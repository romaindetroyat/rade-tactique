// Courant de marée de la rade de Brest (D-13) : atlas 560 du Shom compacté par tools/build_courants.py (data/brest.courants.{json,bin},
// 13 heures de marée × coefficients 45 et 95, U et V au pas de 0,02 m/s) et fonds vrais (data/brest.fonds.bin, D-14c).
// Fonctions pures : ni horloge ni réseau ; la marée en cours vient de js/maree.js (mareeEn). Le courant est rendu en m/s, U vers l’est,
// V vers le nord (jamais de direction stockée : atan2(U, V) donne la direction VERS laquelle il porte). Source : Shom, Licence Ouverte 2.0,
// doi 10.17183/ATLASCOURANTS2D_NETCDF ; à n’utiliser qu’en complément des cartes et ouvrages nautiques officiels.

const H = 3600000;

const err = (m) => new Error(`atlas de courant illisible : ${m}`);

// Atlas décodé : { grid, hours, h0, coefs, scale, sea, idx (nœud → rang du point en mer, −1 à terre), val (Int8), fonds (Int16 ou null) }.
// header : contenu de data/brest.courants.json ; buffer : data/brest.courants.bin ; fonds (facultatif) : data/brest.fonds.bin
export function chargeAtlas(header, buffer, fonds = null) {
  const g = header?.grid;
  if (!g || ![g.lat0, g.lon0, g.dlat, g.dlon].every(Number.isFinite) || !(g.dlat > 0 && g.dlon > 0)) throw err('grille');
  if (!Number.isInteger(g.ni) || !Number.isInteger(g.nj) || g.ni < 2 || g.nj < 2) throw err('grille');
  if (header.hours !== 13 || header.h0 !== -6 || JSON.stringify(header.coefs) !== '[45,95]' || !(header.scale > 0)) throw err('en-tête');
  if (!(buffer instanceof ArrayBuffer)) throw err('fichier absent');
  const n = g.ni * g.nj, mask = Math.ceil(n / 8), sea = header.sea;
  if (!Number.isInteger(sea) || buffer.byteLength !== mask + 2 * 13 * 2 * sea) throw err('taille');
  const bits = new Uint8Array(buffer, 0, mask), idx = new Int32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) idx[i] = (bits[i >> 3] >> (i & 7)) & 1 ? k++ : -1;
  if (k !== sea) throw err('masque');
  let fd = null;
  if (fonds != null) {
    if (!(fonds instanceof ArrayBuffer) || fonds.byteLength !== n * 2) throw new Error('fonds illisibles : taille');
    fd = new Int16Array(n);
    const dv = new DataView(fonds);
    for (let i = 0; i < n; i++) fd[i] = dv.getInt16(i * 2, true);
  }
  return { grid: { ...g }, hours: 13, h0: -6, coefs: [45, 95], scale: header.scale, sea, idx, val: new Int8Array(buffer, mask), fonds: fd };
}

// Position → coordonnées fractionnaires dans la grille, ou null hors de la grille
function place(A, lat, lon) {
  if (!A || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const g = A.grid, E = 1e-6;                     // tolérance d’arrondi des coordonnées de l’en-tête (un millionième de maille)
  let fy = (lat - g.lat0) / g.dlat, fx = (lon - g.lon0) / g.dlon;
  if (!(fy >= -E && fy <= g.nj - 1 + E && fx >= -E && fx <= g.ni - 1 + E)) return null;
  fy = Math.max(0, Math.min(g.nj - 1, fy)); fx = Math.max(0, Math.min(g.ni - 1, fx));
  const j = Math.min(Math.floor(fy), g.nj - 2), i = Math.min(Math.floor(fx), g.ni - 2);
  return { j, i, ty: fy - j, tx: fx - i };
}

// Champ (U et V) d’un coefficient (0 : 45, 1 : 95) à l’heure ronde h (0 à 12) au point : bilinéaire sur les seuls nœuds en mer
// (poids renormalisés : un voisin à terre est écarté) ; null si aucun des quatre nœuds n’est en mer
function champ(A, c, h, p) {
  const { ni } = A.grid, base = (c * 13 + h) * 2 * A.sea;
  let su = 0, sv = 0, sw = 0;
  for (const [dj, di, w] of [[0, 0, (1 - p.tx) * (1 - p.ty)], [0, 1, p.tx * (1 - p.ty)], [1, 0, (1 - p.tx) * p.ty], [1, 1, p.tx * p.ty]]) {
    const k = A.idx[(p.j + dj) * ni + p.i + di];
    if (k < 0 || w <= 0) continue;
    su += w * A.val[base + k]; sv += w * A.val[base + A.sea + k]; sw += w;
  }
  if (!(sw > 0)) {
    // point exactement sur un nœud à terre ou sur une arête : aucun poids positif
    return null;
  }
  return { u: su / sw * A.scale, v: sv / sw * A.scale };
}

// Dosage par le marnage de la marée en cours : 0 = morte-eau moyenne (2,80 m, coef. 45), 1 = vive-eau moyenne (5,90 m, coef. 95) ;
// interpolation entre les deux champs de l’atlas (jamais une règle de trois sur le marnage), bornée à [−0,4 ; 1,4]
const dose = (marnage) => Math.max(-0.4, Math.min(1.4, (marnage - 2.80) / 3.10));

// Courant à l’heure de marée hm (−6 à +6 h depuis la pleine mer), dosé par k
function aHeure(A, p, hm, k) {
  const x = Math.max(0, Math.min(12, hm + 6)), a = Math.min(11, Math.floor(x)), t = x - a;
  const m0 = champ(A, 0, a, p), m1 = champ(A, 0, a + 1, p), v0 = champ(A, 1, a, p), v1 = champ(A, 1, a + 1, p);
  if (!m0 || !m1 || !v0 || !v1) return null;
  const me = { u: m0.u + (m1.u - m0.u) * t, v: m0.v + (m1.v - m0.v) * t };
  const ve = { u: v0.u + (v1.u - v0.u) * t, v: v0.v + (v1.v - v0.v) * t };
  return { u: me.u + (ve.u - me.u) * k, v: me.v + (ve.v - me.v) * k };
}

// Courant (m/s, { u vers l’est, v vers le nord }) au point et à l’instant de la marée M (js/maree.js, mareeEn), ou null
// (à terre, hors de la grille, marée inconnue). Heure de marée rattachée à la pleine mer la plus proche (avant ou après) ; entre PM+6 h d’un
// cycle et PM−6 h du suivant (cycle de 12 h 25 environ contre 12 h d’atlas) : interpolation linéaire entre la dernière heure de l’un et la
// première de l’autre, chacune dosée par le marnage de sa marée (descendante avant la basse mer, montante après).
export function courantEn(A, M, lat, lon) {
  if (!A || !M || !M.avant || !M.apres || !M.entre || !Number.isFinite(M.t)) return null;
  const p = place(A, lat, lon);
  if (!p) return null;
  const s0 = (M.t - M.avant.t) / H, s1 = (M.apres.t - M.t) / H;
  const k0 = dose(M.avant.h - M.entre.h), k1 = dose(M.apres.h - M.entre.h);
  let c;
  if (s0 <= 6 || s1 <= 6) c = s0 <= s1 ? aHeure(A, p, s0, k0) : aHeure(A, p, -s1, k1);
  else {
    const a = aHeure(A, p, 6, k0), b = aHeure(A, p, -6, k1);
    if (!a || !b) return null;
    const f = (s0 - 6) / (s0 - 6 + s1 - 6);
    c = { u: a.u + (b.u - a.u) * f, v: a.v + (b.v - a.v) * f };
  }
  return c && Number.isFinite(c.u) && Number.isFinite(c.v) ? c : null;
}

// Fond (m au-dessus du zéro des cartes, négatif sous le zéro ; positif : découvre) au point, bilinéaire ; null hors de la grille ou sans fonds
export function fondEn(A, lat, lon) {
  if (!A?.fonds) return null;
  const p = place(A, lat, lon);
  if (!p) return null;
  const { ni } = A.grid, f = A.fonds, n = p.j * ni + p.i;
  const z = f[n] * (1 - p.tx) * (1 - p.ty) + f[n + 1] * p.tx * (1 - p.ty) + f[n + ni] * (1 - p.tx) * p.ty + f[n + ni + 1] * p.tx * p.ty;
  return Number.isFinite(z) ? z / 10 : null;
}
