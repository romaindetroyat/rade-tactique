// Parcours banane construit au vent (aller-retour au vent / sous le vent), défini hors du cahier js/courses.js (D-01, D-02, D-03).
// Module pur (aucun DOM, aucun stockage) : js/app.js l’ajoute à COURSES au chargement (addBanane) ; buildLegs (js/tactics.js) en tire les bords.
// Toutes les distances partent du centre de la ligne de départ réellement utilisée (pinguée comprise), axe = vent de la ligne.

import { NM, fromBearing } from './geo.js';

export const BANANE_ID = 90;                     // hors des parcours SNPM (1-13) et des parcours de régate (101+) ; numérique (comparaisons strictes)
export const BAN_DEF = Object.freeze({ nm: 0.8, off: true, side: 'b', gate: true, fin: 'depart' });
export const FINS = ['depart', 'sousvent', 'auvent'];

const OFF_NM = 0.07;                             // dégagement C : 0,07 Nq de B, perpendiculaire au vent
const GATE_UP_NM = 0.05, GATE_W_NM = 0.05;       // porte : centrée 0,05 Nq au vent du centre de la ligne, 0,05 Nq de large

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

// Bouées et séquence d’une banane depuis la ligne L ({ c, cb, pin, face }) : { points, seq, finish, finishLine }
export function bananeCourse(L, windDir, { laps = 1, ban } = {}) {
  const W = windDir, c = L.c, b = cleanBan(ban);
  const B = { ...fromBearing(c, W, b.nm * NM), name: 'B (au vent)' };
  const cs = b.side === 'b' ? W - 90 : W + 90;          // côté où l’on tourne : à gauche en regardant au vent pour B à bâbord
  const C = b.off ? { ...fromBearing(B, cs, OFF_NM * NM), name: 'C (dégagement)' } : null;
  const G0 = fromBearing(c, W, GATE_UP_NM * NM);
  // gauche et droite en regardant sous le vent (comme les bateaux qui arrivent) : la gauche se laisse à bâbord
  const PG = { ...fromBearing(G0, W + 90, (GATE_W_NM / 2) * NM), name: 'Porte gauche', mark: 'PG', side: 'b' };
  const PD = { ...fromBearing(G0, W - 90, (GATE_W_NM / 2) * NM), name: 'Porte droite', mark: 'PD', side: 't' };
  const points = { B };
  if (C) points.C = C;
  const seq = [];
  let gates = 0;
  for (let k = 1; k <= laps; k++) {
    seq.push({ ...B, mark: 'B', side: b.side, lap: k });
    if (C) seq.push({ ...C, mark: 'C', side: b.side, lap: k });
    if (k < laps) {
      seq.push({ x: G0.x, y: G0.y, name: 'Porte', mark: 'PORTE', side: null, lap: k, gate: { g: { ...PG }, d: { ...PD } } });
      gates++;
    }
  }
  if (gates) { points.PG = { ...PG }; points.PD = { ...PD }; }
  const finish = { x: c.x, y: c.y, name: 'Arrivée (ligne de départ)' };
  return { points, seq, finish, finishLine: null };
}
