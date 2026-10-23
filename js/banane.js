// Parcours banane construit au vent (aller-retour au vent / sous le vent), défini hors du cahier js/courses.js (D-01, D-02, D-03).
// Module pur (aucun DOM, aucun stockage) : js/app.js l’ajoute à COURSES au chargement (addBanane) ; buildLegs (js/tactics.js) en tire les bords.
// Toutes les distances partent du centre de la ligne de départ réellement utilisée (pinguée comprise), axe = vent de la ligne.

import { NM, fromBearing, bearingXY, norm180 } from './geo.js';

export const BANANE_ID = 90;                     // hors des parcours SNPM (1-13) et des parcours de régate (101+) ; numérique (comparaisons strictes)
export const BAN_DEF = Object.freeze({ nm: 0.8, off: true, side: 'b', gate: true, fin: 'depart' });
export const FINS = ['depart', 'sousvent', 'auvent'];

const OFF_NM = 0.07;                             // dégagement C : 0,07 Nq de B, perpendiculaire au vent
const GATE_UP_NM = 0.05, GATE_W_NM = 0.05;       // porte : centrée 0,05 Nq au vent du centre de la ligne, 0,05 Nq de large
const FIN_LEN_NM = 0.06;                         // lignes d’arrivée décalées : 0,06 Nq, perpendiculaires au vent
const FIN_DOWN_NM = 0.1;                         // « Sous le vent, décalée » : 0,1 Nq sous le vent du centre de la porte
const FIN_UNDER_B_NM = 0.05, FIN_SHIFT_NM = 0.1; // « Au vent, décalée » : 0,05 Nq sous le vent de B, 0,1 Nq à l’opposé du dégagement

// Réglages bornés : objet neuf aux cinq seules clés, lues sur l’objet lui-même (rien du prototype) ; toute valeur inconnue → défaut
export function cleanBan(x) {
  const o = x && typeof x === 'object' ? x : {};
  const own = (k) => (Object.hasOwn(o, k) ? o[k] : undefined);
  const nm = own('nm'), off = own('off'), side = own('side'), gate = own('gate'), fin = own('fin');
  return {
    nm: typeof nm === 'number' && Number.isFinite(nm) ? Math.round(Math.min(2, Math.max(0.3, nm)) * 100) / 100 : BAN_DEF.nm,
    off: typeof off === 'boolean' ? off : BAN_DEF.off,
    side: side === 'b' || side === 't' ? side : BAN_DEF.side,
    gate: typeof gate === 'boolean' ? gate : BAN_DEF.gate,
    fin: FINS.includes(fin) ? fin : BAN_DEF.fin,
  };
}
export const banOf = (S) => cleanBan({ nm: S?.banNm, off: S?.banOff, side: S?.banSide, gate: S?.banGate, fin: S?.banFin });

export const BANANE = {
  id: BANANE_ID, title: 'Banane (construite)', laps: true, both: true, built: 'BAN', line: 'grandrade',
  seq: { G: [['B', 'b'], ['C', 'b'], ['PORTE', null]], P: [['B', 'b'], ['C', 'b'], ['PORTE', null]] },
  text: 'Construite au vent depuis la ligne de départ choisie. 1 tour = B au vent à la distance réglée, dégagement C (facultatif), puis porte sous le vent à deux bouées (ou une seule bouée). Au dernier tour, arrivée sur la ligne de départ ou sur une ligne décalée, au vent ou sous le vent. Positions théoriques : le Comité fait foi.',
};

// Ajoute la banane à une liste de parcours, une seule fois
export function addBanane(courses) {
  if (!courses.some((c) => c.id === BANANE_ID)) courses.push(BANANE);
  return courses;
}

// Bouées et séquence d’une banane depuis la ligne L ({ c, cb, pin, face }) : { points, seq, finish, finishLine }.
// Un tour = B, C (si dégagement), puis la porte (ou la bouée sous le vent) sauf au dernier tour — sauf arrivée au vent, où tous les tours
// finissent par la porte avant un dernier près vers la ligne d’arrivée décalée.
export function bananeCourse(L, windDir, { laps = 1, ban } = {}) {
  const W = windDir, c = L.c, b = cleanBan(ban);
  const B = { ...fromBearing(c, W, b.nm * NM), name: 'B (au vent)' };
  const cs = b.side === 'b' ? W - 90 : W + 90;          // côté où l’on tourne : à gauche en regardant au vent pour B à bâbord
  const C = b.off ? { ...fromBearing(B, cs, OFF_NM * NM), name: 'C (dégagement)' } : null;
  const G0 = fromBearing(c, W, GATE_UP_NM * NM);
  // gauche et droite en regardant sous le vent (comme les bateaux qui arrivent) : la gauche se laisse à bâbord
  const PG = { ...fromBearing(G0, W + 90, (GATE_W_NM / 2) * NM), name: 'Porte gauche', mark: 'PG', side: 'b' };
  const PD = { ...fromBearing(G0, W - 90, (GATE_W_NM / 2) * NM), name: 'Porte droite', mark: 'PD', side: 't' };
  const S = { x: G0.x, y: G0.y, name: 'Bouée sous le vent' };
  const points = { B };
  if (C) points.C = C;
  const seq = [];
  let bas = 0;
  for (let k = 1; k <= laps; k++) {
    seq.push({ ...B, mark: 'B', side: b.side, lap: k });
    if (C) seq.push({ ...C, mark: 'C', side: b.side, lap: k });
    if (k < laps || b.fin === 'auvent') {
      seq.push(b.gate
        ? { x: G0.x, y: G0.y, name: 'Porte', mark: 'PORTE', side: null, lap: k, gate: { g: { ...PG }, d: { ...PD } } }
        : { ...S, mark: 'S', side: b.side, lap: k });
      bas++;
    }
  }
  if (bas && b.gate) { points.PG = { ...PG }; points.PD = { ...PD }; }
  if (bas && !b.gate) points.S = { ...S };
  let finish = { x: c.x, y: c.y, name: 'Arrivée (ligne de départ)' }, finishLine = null;
  if (b.fin === 'sousvent' || b.fin === 'auvent') {
    const F = b.fin === 'sousvent'
      ? fromBearing(G0, W + 180, FIN_DOWN_NM * NM)
      : fromBearing(fromBearing(B, W + 180, FIN_UNDER_B_NM * NM), b.side === 'b' ? W + 90 : W - 90, FIN_SHIFT_NM * NM);
    finish = { x: F.x, y: F.y, name: b.fin === 'sousvent' ? 'Arrivée sous le vent (décalée)' : 'Arrivée au vent (décalée)' };
    finishLine = { a: fromBearing(F, W + 90, (FIN_LEN_NM / 2) * NM), b: fromBearing(F, W - 90, (FIN_LEN_NM / 2) * NM) };
  }
  return { points, seq, finish, finishLine };
}

// Oriente une porte de deux bouées depuis la bouée précédente : gauche et droite vues par les bateaux qui arrivent,
// la gauche se laisse à bâbord ('b'), la droite à tribord ('t'). Rend des copies (entrées non modifiées).
export function orientGate(prev, a, b) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const beta = bearingXY(prev, mid);
  const aLeft = norm180(bearingXY(mid, a) - beta) < 0;
  const [l, r] = aLeft ? [a, b] : [b, a];
  return { g: { ...l, side: 'b' }, d: { ...r, side: 't' } };
}

// Bouées du parcours pour la carte (utilisé par drawCourse, 06-02) : même résultat que la boucle `used` de la v37 pour un parcours sans porte
// (bord numéroté → { side, orders } sous la clé de la marque). Un bord porte numérote ses deux bouées ; la bouée retenue est marquée
// « conseillée » seulement quand le conseil en est un (écart d’au moins 10 s, ou bascule annoncée).
export function courseMarkUse(legs) {
  const used = new Map(), adv = new Map();
  legs.forEach((l) => {
    if (!l.order) return;
    if (l.gate?.g && l.gate?.d) {
      const gt = l.gate, conseil = gt.equal === false || gt.why === 'bascule';
      for (const k of ['g', 'd']) {
        const m = gt[k], u = used.get(m.mark) || { side: m.side, orders: [] };
        u.orders.push(l.order); used.set(m.mark, u);
        if (conseil && gt.pick === k) { const a = adv.get(m.mark) || []; a.push(l.lap ?? u.orders.length); adv.set(m.mark, a); }
      }
      return;
    }
    const u = used.get(l.mark) || { side: l.side, orders: [] };
    u.orders.push(l.order); used.set(l.mark, u);
  });
  for (const [k, tours] of adv) {
    const u = used.get(k);
    u.advised = true;
    u.note = tours.length === u.orders.length ? '· conseillée' : `· conseillée (${tours.length > 1 ? 'tours' : 'tour'} ${tours.join(', ')})`;
  }
  return used;
}
