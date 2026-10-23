// Analyse tactique : parcours → bords, ligne de départ, conseils par bord, stratégie du jour.

import { MARKS, COURSES, LINE_PRESETS, PLACES } from './courses.js';
import { toXY, toLL, NM, bearingXY, distXY, fromBearing, norm180, norm360, fmtBrg, fmtNm, cardinal } from './geo.js';
import { boatSpeed, optimalAngles, spiMinTwa } from './polar.js';
import { route, tackName } from './router.js';
import { bananeCourse, orientGate } from './banane.js';

export const sideName = (s) => (s === 'b' ? 'bâbord' : s === 't' ? 'tribord' : '');

// ───────────────────────── Régimes de vent et connaissance locale
export const REGIMES = [
  { id: 'calme', name: 'Calme / très petit temps', test: (d, s) => s < 4,
    tips: [
      'La pression prime sur tout : lire le plan d’eau (risées sombres), relier les zones de vent plutôt que de jouer les bascules.',
      'Les modèles sont peu fiables sous 5 nd : se fier aux observations et aux autres bateaux.',
      'Éviter le pied des reliefs et les abords immédiats des quais (zones mortes). Le comité peut différer (aperçu).',
      'Transition brise de terre → brise de mer possible vers midi : zone sans vent puis rotation ; se placer du côté où le nouveau vent arrive.',
    ] },
  { id: 'mistral', name: 'Mistral (NO)', test: (d, s) => d >= 285 && d <= 345 && s >= 12,
    tips: [
      'Vent de terre en rade : mer plate près de la côte Nord (Mourillon, Cap Brun), la mer se forme vers Saint-Mandrier, le Cap Cépet et au large.',
      'Rafales et rotations fortes près des côtes au vent (ville, Faron, Six-Fours) : s’en écarter de quelques centaines de mètres pour un vent plus établi, tout en gardant la mer plate.',
      'Effet de pointe au Cap Cépet et au Sud de Saint-Mandrier (Renardière, Houlographe) : vent plus fort et mer plus creuse, réduire la toile tôt.',
      'Au portant : planer dans les rafales, empanner dans les molles ; anticiper l’affalage avant les marques au vent des côtes.',
      'Le mistral a tendance à forcir en journée et à mollir en soirée.',
    ] },
  { id: 'ouest', name: 'Vent d’Ouest / Labech', test: (d, s) => d >= 235 && d < 285,
    tips: [
      'Le vent passe par-dessus Sicié, l’isthme des Sablettes et la presqu’île de Saint-Mandrier : la rade est partiellement abritée, vent irrégulier entre la Grande Jetée et la Petite Passe.',
      'Par vent d’Ouest, le CVAT place la ligne plutôt dans le Sud des Anses du Mourillon pour un bord de près plus proche de l’axe du vent vers la bouée 1.',
      'Au Sud et à l’Est de Cépet le vent est plus fort et plus régulier ; clapot au passage du cap.',
      'Les dévents de la presqu’île créent des trous près de la côte Est de Saint-Mandrier (marques 4–5) : garder de l’eau.',
    ] },
  { id: 'thermique', name: 'Sud-Ouest / brise thermique', test: (d, s) => d >= 185 && d < 235,
    tips: [
      'Brise de mer : s’établit en fin de matinée par beau temps et gradient faible ; elle tourne en général progressivement vers la droite (dans le sens des aiguilles) au cours de l’après-midi.',
      'Persistant à droite : au près, privilégier la droite du plan d’eau quand la rotation est attendue.',
      'La presqu’île de Sicié et Saint-Mandrier abritent l’Ouest de la zone (Sablettes, Renardière) : trous possibles sous Cépet.',
      'En octobre la brise est plus faible et plus tardive qu’en été ; elle peut ne pas s’installer si le ciel est couvert.',
    ] },
  { id: 'marin', name: 'Sud-Est / Marin', test: (d, s) => d >= 120 && d < 185,
    tips: [
      'Vent de mer : régulier sur l’eau, mer et houle qui entrent dans la Grande Rade ; plus irrégulier contre la côte Nord (compression et refus près du Mourillon).',
      'Temps souvent couvert et humide, visibilité réduite : relever les marques au compas avant le départ.',
      'Au près vers le SE, la mer formée pénalise les bords face à la houle : choisir l’amure la plus confortable dans les vagues quand le gain est faible.',
    ] },
  { id: 'est', name: 'Vent d’Est / Levant', test: (d, s) => d >= 55 && d < 120,
    tips: [
      'Le vent longe la côte depuis Carqueiranne et Le Pradet ; Cap Brun et la pointe Sainte-Marguerite créent des dévents locaux près de la côte.',
      'Bords portants vers l’Ouest (7 → 3 → 2 → 1) : l’IC rappelle la marge à garder pour l’affalage avant la bouée Grande Jetée par vent d’Est modéré à assez fort.',
      'Le levant amène souvent houle, nuages et pluie ; il peut forcir rapidement.',
    ] },
  { id: 'nord', name: 'Nord / Nord-Est (vent de terre)', test: () => true,
    tips: [
      'Vent de terre descendant du Faron et du Coudon : très irrégulier près des côtes Nord, plus établi au milieu de la rade.',
      'Le matin, brise de terre faible, souvent remplacée vers midi par la brise de mer : zone de transition sans vent, puis rotation vers l’Est ou le Sud.',
      'Repérer de quel côté arrive le nouveau vent (risées au large, nuages) et s’y placer avant la transition.',
    ] },
];
export const regimeOf = (dir, spd) => REGIMES.find((r) => r.test(norm360(dir), spd));

// ───────────────────────── Géométrie du parcours
export function lineGeometry({ center, lengthNm = 0.12, windDir, mode = 'wind', firstMark, bearing }) {
  const c = toXY(center.lat, center.lon);
  let face = windDir; // regard au vent
  if (mode === 'axis' && firstMark) face = bearingXY(c, firstMark);
  if (mode === 'fixed' && bearing != null) face = bearing;
  const L = lengthNm * NM;
  const cb = fromBearing(c, face + 90, L / 2); // comité à tribord (à droite en regardant au vent)
  const pin = fromBearing(c, face - 90, L / 2);
  return { c, cb, pin, face };
}

export function buildLegs(course, cls, opts) {
  const { laps = 2, windDir, line, wlLengthNm = 0.8, ban } = opts;
  const seqDef = course.seq[cls] || course.seq.G;
  const pts = {};
  for (const [k, m] of Object.entries(MARKS)) pts[k] = { ...toXY(m.lat, m.lon), name: `${k} ${m.name}` };
  const center = line.center;
  let L;
  if (course.built === 'D') {
    const c = toXY(center.lat, center.lon);
    const cb = fromBearing(c, 270, (line.lengthNm * NM) / 2), D = fromBearing(c, 90, (line.lengthNm * NM) / 2);
    L = { c, cb, pin: D, face: 0 };
    pts.D = { ...D, name: 'D (départ)' };
    pts.A = { ...fromBearing(cb, 0, 0.06 * NM), name: 'A (arrivée)' };
  } else if (course.built === 'WL') {
    L = lineGeometry({ center, lengthNm: line.lengthNm, windDir });
    pts.D = { ...L.pin, name: 'D' };
    const B = fromBearing(L.c, windDir, wlLengthNm * NM);
    pts.B = { ...B, name: 'B (au vent)' };
    pts.C = { ...fromBearing(B, windDir - 90, 0.08 * NM), name: 'C (dog-leg)' };
    pts.A = { ...fromBearing(L.cb, windDir + 180, 0.05 * NM), name: 'A (arrivée)' };
  } else if (course.built === 'BAN') {
    L = lineGeometry({ center, lengthNm: line.lengthNm, windDir });
  } else {
    const first = seqDef[0][0];
    L = lineGeometry({ center, lengthNm: line.lengthNm, windDir, mode: line.mode, firstMark: pts[first], bearing: line.bearing });
  }
  if (line.override?.cb && line.override?.pin) { L = { ...L, cb: line.override.cb, pin: line.override.pin, c: { x: (line.override.cb.x + line.override.pin.x) / 2, y: (line.override.cb.y + line.override.pin.y) / 2 } }; }
  // Chaîne des bords : un élément ordinaire comme en v37 ; une porte ({ g, d } orientés) est UN bord vers la bouée gauche par défaut,
  // le conseil de porte (adviseGate) choisit ensuite la bouée et prepareLeg fait partir le bord suivant d’elle.
  const chain = (start, items) => {
    const legs = [];
    let prev = start;
    items.forEach((p, i) => {
      if (p.gate) {
        const { g, d } = p.gate.pair ? orientGate(prev, p.gate.pair[0], p.gate.pair[1]) : p.gate;
        legs.push({ i, from: prev, to: g, brg: bearingXY(prev, g), dist: distXY(prev, g), side: g.side, mark: 'PORTE', lap: p.lap, gate: { g, d, pick: 'g', gain: null, times: null, equal: null, why: null } });
        prev = g;
        return;
      }
      legs.push({ i, from: prev, to: p, brg: bearingXY(prev, p), dist: distXY(prev, p), side: p.side, mark: p.mark, lap: p.lap });
      prev = p;
    });
    return legs;
  };
  if (course.built === 'BAN') {
    const bc = bananeCourse(L, windDir, { laps, ban });
    Object.assign(pts, bc.points);
    const legs = chain({ x: L.c.x, y: L.c.y, name: 'Départ' }, [...bc.seq, { ...bc.finish, mark: 'FINISH', side: null }]);
    return { legs, line: L, points: pts, finishLine: bc.finishLine };
  }
  const gate = { x: L.c.x, y: L.c.y, name: 'Porte Départ/Arrivée' };
  let finish = { x: L.c.x, y: L.c.y, name: 'Arrivée' };
  if (course.finishNear1) finish = { ...toXY(43.0955, 5.9325), name: 'Arrivée (près de 1)' };
  if (course.built) finish = { x: (L.cb.x + pts.A.x) / 2, y: (L.cb.y + pts.A.y) / 2, name: 'Arrivée Comité–A' };
  // arrivée propre d’un parcours de régate (ligne Comité – bouée, ou près d’une bouée nommée) ; bouée inconnue → arrivée habituelle
  const fm = course.finish?.mark;
  if (!course.built && fm && Object.hasOwn(pts, fm) && (course.finish.kind === 'comite' || course.finish.kind === 'pres')) {
    finish = { x: pts[fm].x, y: pts[fm].y, name: course.finish.kind === 'comite' ? `Arrivée (Comité – ${pts[fm].name})` : `Arrivée (près de ${pts[fm].name})` };
  }
  // porte d’un parcours de régate : élément [bouée, côté, autre bouée] ; orientée au moment de chaîner (la bouée précédente est connue)
  const item = (m, sd, g2, lap) => {
    if (g2 != null && Object.hasOwn(pts, g2) && Object.hasOwn(pts, m)) {
      const a = pts[m], b = pts[g2];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, name: `Porte ${m} / ${g2}`, mark: 'PORTE', side: null, ...(lap ? { lap } : {}), gate: { pair: [{ ...a, mark: m }, { ...b, mark: g2 }] } };
    }
    return lap ? { ...pts[m], mark: m, side: sd, lap } : { ...pts[m], mark: m, side: sd };
  };

  const seq = [];
  if (course.laps) {
    for (let k = 0; k < laps; k++) {
      seqDef.forEach(([m, sd, g2]) => seq.push(item(m, sd, g2, k + 1)));
      if (k < laps - 1 && !course.built) seq.push({ ...gate, mark: 'GATE', side: null, lap: k + 1 });
    }
  } else {
    seqDef.forEach(([m, sd, g2]) => seq.push(m === 'GATE' ? { ...gate, mark: 'GATE', side: null } : item(m, sd, g2)));
  }
  seq.push({ ...finish, mark: 'FINISH', side: null });
  const legs = chain({ x: L.c.x, y: L.c.y, name: 'Départ' }, seq);
  return { legs, line: L, points: pts };
}

// ───────────────────────── Effets de site (relief)
// Le champ de vent garde le vent « de base » (prévision ou saisie, sans relief) : l’écart entre les deux
// mesure l’effet du relief en chaque point. On en tire les accélérations, les dévents et les déviations
// les plus marqués d’une zone, localisés par le lieu nommé le plus proche.
let placesXY = null;
const placeNear = (p, maxD = 3500, kinds = null) => {
  placesXY ??= PLACES.map(([name, lat, lon, kind]) => ({ name, kind, ...toXY(lat, lon) }));
  let best = null, bd = maxD;
  for (const q of placesXY) { if (kinds && !kinds.includes(q.kind)) continue; const d = distXY(p, q); if (d < bd) { bd = d; best = q; } }
  return best?.name ?? null;
};
// relief responsable d’un dévent : point le plus « masquant » en remontant au vent
function shelterSource(field, p, windFrom) {
  const sx = Math.sin(windFrom * Math.PI / 180), sy = Math.cos(windFrom * Math.PI / 180);
  let best = null, bs = 0;
  for (let d = 150; d <= 5000; d += 150) {
    const q = { x: p.x + sx * d, y: p.y + sy * d }, h = field.t.height(q.x, q.y);
    if (h > 2) { const s = h / (h + 0.1 * d); if (s > bs) { bs = s; best = { ...q, h }; } }
  }
  return best && { name: placeNear(best, 4000, [1, 2, 3]), h: best.h };
}

// samples : points de mer à examiner ; leg (facultatif) : situe chaque effet à droite / à gauche de la route directe
export function siteEffects(field, samples, leg = null) {
  let acc = null, lee = null, rot = null;
  for (const p of samples) {
    if (field.t.isLand?.(p.x, p.y)) continue;
    const w = field.sample(p.x, p.y);
    if (w.baseSpd < 2.5) continue;
    const r = w.spd / w.baseSpd - 1, dd = norm180(w.dir - w.baseDir), lees = -r + 0.4 * w.shelter;
    if (!acc || r > acc.r) acc = { r, p, w };
    if (!lee || lees > lee.s) lee = { s: lees, r, p, w };
    if (!rot || Math.abs(dd) > Math.abs(rot.dd)) rot = { dd, p, w };
  }
  const where = (p) => {
    const n = placeNear(p);
    let side = '';
    if (leg) {
      const L = Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) || 1;
      const cross = ((leg.to.x - leg.from.x) * (p.y - leg.from.y) - (leg.to.y - leg.from.y) * (p.x - leg.from.x)) / L;
      if (Math.abs(cross) > 120) side = cross < 0 ? ', à droite de la route directe' : ', à gauche de la route directe';
    }
    return (n ? `vers ${n}` : 'au milieu du plan d’eau') + side;
  };
  const out = [];
  if (acc && acc.r >= 0.08) out.push({ kind: 'acc', p: acc.p, text: `Accélération ${where(acc.p)} : ${acc.w.spd.toFixed(0)} nd au lieu de ${acc.w.baseSpd.toFixed(0)} (+${Math.round(acc.r * 100)} %), le vent contourne le relief ou s’engouffre entre deux reliefs.` });
  if (lee && (lee.r <= -0.12 || lee.w.shelter >= 0.3)) {
    const nums = `${lee.w.spd.toFixed(0)} nd au lieu de ${lee.w.baseSpd.toFixed(0)} (${Math.round(lee.r * 100)} %)`;
    if (lee.w.shelter >= 0.25) {
      const src = shelterSource(field, lee.p, lee.w.baseDir);
      out.push({ kind: 'lee', p: lee.p, text: `Dévent ${where(lee.p)}${src?.name && src.h >= 30 ? ` (masqué par ${src.name}, relief de ${Math.round(src.h)} m au vent)` : ''} : ${nums}, vent irrégulier et rafaleux.` });
    } else if ((lee.w.block ?? 0) >= 0.2) {
      out.push({ kind: 'block', p: lee.p, text: `Vent ralenti ${where(lee.p)} : ${nums}, il vient buter sur la côte haute sous le vent. Plus de pression en restant au large.` });
    } else {
      out.push({ kind: 'coast', p: lee.p, text: `Vent freiné par la côte ${where(lee.p)} : ${nums}. La terre freine le vent sur 1 à 2 km, surtout par petit temps : plus de pression au large.` });
    }
  }
  if (rot && Math.abs(rot.dd) >= 5) out.push({ kind: 'rot', p: rot.p, text: `Vent dévié ${where(rot.p)} : ${fmtBrg(rot.w.dir)} au lieu de ${fmtBrg(rot.w.baseDir)}, ${Math.abs(rot.dd).toFixed(0)}° ${rot.dd > 0 ? 'à droite' : 'à gauche'}, le vent longe la côte ou contourne le relief.` });
  return out;
}

// points d’échantillonnage d’un bord : couloir de part et d’autre de la route directe, plus la route conseillée
export function legSamples(leg, routePath = []) {
  const off = Math.min(0.35 * leg.dist, 900), pts = [];
  for (let k = 0; k <= 10; k++) {
    const f = k / 10, c = { x: leg.from.x + (leg.to.x - leg.from.x) * f, y: leg.from.y + (leg.to.y - leg.from.y) * f };
    for (const o of [-1, -0.5, 0, 0.5, 1]) pts.push(fromBearing(c, leg.brg + 90, o * off));
  }
  return pts.concat(routePath.map((p) => ({ x: p.x, y: p.y })));
}

// ───────────────────────── Routes mémorisées (une analyse)
// ctx.memo : Map créée par l’appelant pour UNE analyse (runAnalysis, planRest, plan d’une trace). Une route déjà calculée entre les mêmes
// points, dans le même état du champ (field.gen, +1 à chaque WindField.compute) et avec les mêmes options n’est pas recalculée : c’est le
// même résultat (le même objet), donc les mêmes bords, temps et conseils. Sert au bord de porte retenu (déjà routé par adviseGate), au bord
// qui en part, et aux bords identiques d’un tour à l’autre. Sans ctx.memo : route() à chaque appel, comme avant.
export function routeOf(from, to, field, opts, ctx) {
  const memo = ctx?.memo;
  if (!memo) return route(from, to, field, opts);
  const k = `${field.gen ?? 0}|${from.x},${from.y}|${to.x},${to.y}|${opts.perf}|${opts.tackLoss}|${opts.gybeLoss}`;
  const m = memo.get(k);
  if (m && m.field === field && m.terrain === opts.terrain && m.forbidden === opts.forbidden) return m.r;
  const r = route(from, to, field, opts);
  memo.set(k, { field, terrain: opts.terrain, forbidden: opts.forbidden, r });
  return r;
}

// ───────────────────────── Analyse d’un bord
const legType = (twa, tws) => {
  const a = Math.abs(twa), { up, down } = optimalAngles(tws);
  if (a < up.twa + 6) return { id: 'pres', label: 'Près (louvoyage)', sail: 'Foc' };
  if (a < 70) return { id: 'bonplein', label: 'Bon plein', sail: 'Foc' };
  if (a < spiMinTwa(tws)) return { id: 'travers', label: 'Travers / petit largue', sail: 'Foc (spi limite)' };
  if (a < down.twa - 6) return { id: 'largue', label: 'Largue sous spi', sail: 'Spi asymétrique' };
  return { id: 'arriere', label: 'Vent arrière (empannages)', sail: 'Spi asymétrique' };
};

function sideSample(field, leg) {
  const off = Math.min(0.35 * leg.dist, 900);
  const res = { left: { spd: 0, dir: [] }, right: { spd: 0, dir: [] }, center: { spd: 0 } };
  for (const f of [0.3, 0.55, 0.8]) {
    const p = { x: leg.from.x + (leg.to.x - leg.from.x) * f, y: leg.from.y + (leg.to.y - leg.from.y) * f };
    // point d’échantillonnage de chaque côté, rapproché de la route s’il tombe à terre
    const onWater = (sgn) => { for (const k of [1, 0.6, 0.35, 0.15]) { const q = fromBearing(p, leg.brg + sgn * 90, off * k); if (!field.t.isLand?.(q.x, q.y) && field.sample(q.x, q.y).shelter < 0.9) return q; } return p; };
    const R = onWater(1), Lp = onWater(-1);
    const r = field.sample(R.x, R.y), l = field.sample(Lp.x, Lp.y), c = field.sample(p.x, p.y);
    res.right.spd += r.spd / 3; res.left.spd += l.spd / 3; res.center.spd += c.spd / 3;
    res.right.dir.push(r.dir); res.left.dir.push(l.dir);
  }
  const dmean = (a) => { let s = 0, c = 0; a.forEach((d) => { s += Math.sin(d * Math.PI / 180); c += Math.cos(d * Math.PI / 180); }); return norm360(Math.atan2(s, c) * 180 / Math.PI); };
  res.right.dir = dmean(res.right.dir); res.left.dir = dmean(res.left.dir);
  return res;
}

export function analyzeLeg(leg, field, ctx) {
  const N = 6; let su = 0, sv = 0, sg = 0, ssh = 0;
  for (let k = 0; k <= N; k++) {
    const f = k / N, w = field.sample(leg.from.x + (leg.to.x - leg.from.x) * f, leg.from.y + (leg.to.y - leg.from.y) * f);
    su += w.u; sv += w.v; sg += w.gust; ssh += w.shelter;
  }
  const spd = Math.hypot(su, sv) / (N + 1), dir = norm360(Math.atan2(-su, -sv) * 180 / Math.PI), gust = sg / (N + 1), shelter = ssh / (N + 1);
  const twa = norm180(leg.brg - dir);
  const type = legType(twa, spd);
  const r = routeOf(leg.from, leg.to, field, { terrain: ctx.terrain, forbidden: ctx.forbidden, perf: ctx.perf ?? 1 }, ctx);
  const time = r ? r.time : leg.dist / (Math.max(1, boatSpeed(spd, twa)) * 0.5144);
  const sides = sideSample(field, leg);
  const dP = sides.right.spd - sides.left.spd; // >0 : plus de vent à droite
  const dS = Math.max(-25, Math.min(25, norm180(sides.right.dir - sides.left.dir))); // >0 : vent plus à droite (adonné tribord) côté droit
  const shiftAmp = field.shiftAmplitude(spd, shelter);
  const { up, down } = optimalAngles(Math.max(spd, 1));
  const advice = [];
  const trend = ctx.trend || 0; // °/h, >0 = rotation à droite attendue
  const legHours = time / 3600;

  if (type.id === 'pres') {
    const stb = norm360(dir - up.twa), prt = norm360(dir + up.twa);
    advice.push(`Bord de près : cap tribord amures ≈ ${fmtBrg(stb)}, bâbord amures ≈ ${fmtBrg(prt)} (angle optimal ${Math.round(up.twa)}° du vent réel, VMG ${up.vmg.toFixed(1)} nd).`);
    if (r) {
      const first = tackName(r.firstTack);
      const longTack = Math.abs(norm180(leg.brg - stb)) < Math.abs(norm180(leg.brg - prt)) ? 'tribord amures' : 'bâbord amures';
      advice.push(`Bord rapprochant (le plus long) : ${longTack}. Routage : partir ${first}, ${r.maneuvers} virement(s), ${Math.round(r.rightShare * 100)} % du temps à droite de la route directe.`);
    }
    let score = dP * 0.9 + dS * 0.25 + trend * legHours * 0.6;
    const why = [];
    if (Math.abs(dP) >= 0.4) why.push(`${dP > 0 ? 'plus de pression à droite' : 'plus de pression à gauche'} (${dP > 0 ? '+' : ''}${dP.toFixed(1)} nd)`);
    if (Math.abs(dS) >= 3) why.push(`vent ${dS > 0 ? 'plus à droite côté droit' : 'plus à gauche côté gauche'} (${Math.abs(dS).toFixed(0)}° d’écart : aller vers la bascule)`);
    if (Math.abs(trend * legHours) >= 3) why.push(`rotation attendue ${trend > 0 ? 'à droite' : 'à gauche'} de ~${Math.abs(trend * legHours).toFixed(0)}° pendant le bord`);
    if (Math.abs(score) < 0.4) advice.push(`Pas de côté nettement favorisé : rester près de l’axe, jouer les oscillations (±${shiftAmp}° attendues) — virer sur les refus, rester sur les adonnantes.`);
    else advice.push(`Côté ${score > 0 ? 'DROIT' : 'GAUCHE'} favorisé : ${why.join(' ; ')}. Ne pas aller toucher la lay-line trop tôt.`);
  } else if (type.id === 'arriere' || type.id === 'largue') {
    const s1 = norm360(dir + 180 - (180 - down.twa)), s2 = norm360(dir + 180 + (180 - down.twa));
    if (type.id === 'arriere') {
      advice.push(`Vent arrière : ne pas descendre plein vent arrière ; angle optimal ≈ ${Math.round(down.twa)}° du vent (caps ≈ ${fmtBrg(s1)} / ${fmtBrg(s2)}), VMG ${down.vmg.toFixed(1)} nd.`);
      if (r) advice.push(`Routage : partir ${tackName(r.firstTack)}, ${r.maneuvers} empannage(s), ${Math.round(r.rightShare * 100)} % à droite de la route directe.`);
    } else {
      advice.push(`Largue sous spi : route quasi directe au ${fmtBrg(leg.brg)} (TWA ${Math.abs(twa).toFixed(0)}°). Lofer dans les molles, abattre dans les risées.`);
    }
    if (Math.abs(dP) >= 0.4) advice.push(`Au portant la pression prime : ${dP > 0 ? 'plus de vent à droite' : 'plus de vent à gauche'} de la route (${dP > 0 ? '+' : ''}${dP.toFixed(1)} nd).`);
    if (spd > 16) advice.push('Brise : planer en lofant légèrement dans les surventes, empanner en sortie de rafale (bateau rapide = moins de charge).');
  } else {
    advice.push(`${type.label} : route directe au ${fmtBrg(leg.brg)}, TWA ${Math.abs(twa).toFixed(0)}° ${twa > 0 ? 'bâbord' : 'tribord'} amures.`);
    const lim = spiMinTwa(spd);
    if (Math.abs(twa) > lim - 12) advice.push(`Spi limite (envoi conseillé au-delà de ~${lim}° de TWA) : envoyer si le vent adonne, sinon rester sous foc et « monter » légèrement.`);
    if (Math.abs(dP) >= 0.5) advice.push(`${dP > 0 ? 'Plus de pression à droite' : 'Plus de pression à gauche'} : faire la route du côté du vent fort si l’écart est durable.`);
  }
  if (shelter > 0.25) advice.push(`Zone partiellement déventée par le relief (indice ${Math.round(shelter * 100)} %) : vent irrégulier, rafales jusqu’à ${gust.toFixed(0)} nd, bascules ±${shiftAmp}°.`);
  const site = siteEffects(field, legSamples(leg, r?.path), leg);
  return { ...leg, wind: { dir, spd, gust, shelter }, twa, type, route: r, time, sides: { dP, dS }, shiftAmp, advice, site };
}

// ───────────────────────── Porte sous le vent à deux bouées (D-05)
export const GATE_EQUAL_S = 10;     // écart de moins de 10 s : bouées équivalentes
const SHIFT_DEG_H = 2;              // bascule annoncée : |tendance| ≥ 2°/h, le seuil de « Rotation attendue » du briefing
const FALLBACK_KN = 4;              // repli quand le routage n’aboutit pas : distance à 4 nd

// Conseil de porte : pour chaque bouée, temps routé du bord qui y mène plus celui du bord suivant (vers nextTo) ; la plus courte est retenue
// et devient la destination du bord. Mêmes options de routage que analyzeLeg, et mêmes routes mémorisées (ctx.memo, routeOf) : analyzeLeg
// reprend la route de la bouée retenue et celle du bord suivant sans les recalculer. ctx.routeFn sert aux seuls tests (l’app ne la passe jamais).
// Gauche et droite sont vues par les bateaux qui arrivent ; tendance > 0 (rotation à droite) → au près suivant le côté droit du plan d’eau,
// c’est la bouée gauche en regardant sous le vent.
export function adviseGate(leg, nextTo, field, ctx = {}) {
  const opts = { terrain: ctx.terrain, forbidden: ctx.forbidden, perf: ctx.perf ?? 1 };
  const rf = ctx.routeFn ?? ((a, b, f, o) => routeOf(a, b, f, o, ctx));
  const trip = (a, b) => {
    const d = distXY(a, b);
    if (d < 20) return 0;
    const t = rf(a, b, field, opts)?.time;
    return Number.isFinite(t) ? t : d / (FALLBACK_KN * 0.5144);
  };
  const { g, d } = leg.gate;
  const tg = trip(leg.from, g) + (nextTo ? trip(g, nextTo) : 0);
  const td = trip(leg.from, d) + (nextTo ? trip(d, nextTo) : 0);
  const gain = Math.abs(tg - td), equal = gain < GATE_EQUAL_S, trend = ctx.trend || 0;
  let pick, why;
  if (!equal) { pick = tg <= td ? 'g' : 'd'; why = 'routage'; }
  else if (trend >= SHIFT_DEG_H) { pick = 'g'; why = 'bascule'; }
  else if (trend <= -SHIFT_DEG_H) { pick = 'd'; why = 'bascule'; }
  else { pick = 'g'; why = 'defaut'; }
  const to = pick === 'g' ? g : d;
  leg.to = to; leg.side = to.side; leg.brg = bearingXY(leg.from, to); leg.dist = distXY(leg.from, to);
  leg.gate = { g, d, pick, gain, times: { g: tg, d: td }, equal, why, ...(why === 'bascule' ? { shift: trend > 0 ? 'droite' : 'gauche' } : {}) };
  return leg.gate;
}

// Prépare un bord avant son analyse : après une porte, il part de la bouée retenue ; une porte reçoit son conseil
// (cible = destination du bord suivant, ou milieu de la porte suivante). Un bord ordinaire après un bord ordinaire ne change pas.
export function prepareLeg(leg, prev, next, field, ctx) {
  if (prev?.gate) { leg.from = prev.to; leg.brg = bearingXY(leg.from, leg.to); leg.dist = distXY(leg.from, leg.to); }
  if (leg.gate) {
    const target = !next ? null : next.gate ? { x: (next.gate.g.x + next.gate.d.x) / 2, y: (next.gate.g.y + next.gate.d.y) / 2 } : next.to;
    adviseGate(leg, target, field, ctx);
  }
  return leg;
}

// Conseil de porte en français (briefing, navigation en course)
export function gateText(gate) {
  if (!gate) return '';
  const nom = gate.pick === 'd' ? 'droite' : 'gauche';
  if (!Number.isFinite(gate.gain)) return `Porte : bouée ${nom} retenue pour le calcul`;
  const s = Math.round(gate.gain);
  if (!gate.equal) return `Porte : bouée ${nom} conseillée — ${s} s de mieux`;
  if (gate.why === 'bascule') return `Porte : bouées équivalentes (${s} s d’écart) — bouée ${nom}, du côté de la bascule à ${gate.shift} annoncée`;
  return `Porte : bouées équivalentes (${s} s d’écart) — bouée ${nom} retenue pour le calcul`;
}

// Conseils de passage de marque (entre le bord i et le bord i+1)
export function markAdvice(a, b) {
  if (!a || a.mark === 'FINISH') return [];
  const out = [];
  if (a.gate) out.push(gateText(a.gate));
  if (a.mark === 'GATE') { out.push('Porte « ligne de Départ/Arrivée » : point de réduction privilégié — surveiller le Comité (2e substitut + pavillon de classe).'); }
  if (a.side) out.push(`Laisser ${a.to.name} à ${sideName(a.side).toUpperCase()}.`);
  if (a.side === 'b' && a.type.id === 'pres') out.push('Approche conseillée tribord amures (priorité, pas de lay-line bâbord dans la flotte).');
  if (a.side === 't' && a.type.id === 'pres') out.push('Marque à tribord au près : approcher bâbord amures sur la lay-line, attention aux bateaux tribord.');
  if (b) {
    const spiA = a.type.sail.startsWith('Spi'), spiB = b.type.sail.startsWith('Spi');
    if (!spiA && spiB) {
      const sameTack = Math.sign(a.twa) === Math.sign(b.twa);
      out.push(`Envoi de spi après la marque : ${sameTack ? 'envoi direct (bear-away set)' : 'empannage-envoi (gybe set)'} — bord suivant ${b.type.label.toLowerCase()} au ${fmtBrg(b.brg)}.`);
    }
    if (spiA && !spiB) out.push(`Affalage avant la marque (bord suivant : ${b.type.label.toLowerCase()} au ${fmtBrg(b.brg)}) — anticiper de 3–4 longueurs, plus en brise.`);
    if (spiA && spiB && Math.sign(a.twa) !== Math.sign(b.twa)) out.push('Empannage à la marque sous spi.');
  }
  return out;
}

// ───────────────────────── Ligne de départ
export function analyzeStart(L, field, firstLeg, ctx) {
  const lineBrg = bearingXY(L.pin, L.cb), len = distXY(L.pin, L.cb);
  const w = field.sample(L.c.x, L.c.y);
  const square = norm360(lineBrg - 90);
  const bias = norm180(w.dir - square); // >0 : vent tourné à droite → comité favorisé
  const gain = len * Math.sin(Math.abs(bias) * Math.PI / 180);
  const out = { lineBrg, len, wind: w, bias, gain, advice: [] };
  const twa1 = norm180(firstLeg.brg - w.dir);
  const upwind = Math.abs(twa1) < optimalAngles(Math.max(w.spd, 1)).up.twa + 6;
  if (upwind) {
    if (Math.abs(bias) < 3) out.favored = 'aucun';
    else out.favored = bias > 0 ? 'comité' : 'bouée';
    out.advice.push(Math.abs(bias) < 3
      ? `Ligne quasi équilibrée (biais ${Math.abs(bias).toFixed(0)}°) : partir là où l’on est libre, du côté favorable pour le premier bord.`
      : `Biais ${Math.abs(bias).toFixed(0)}° côté ${out.favored.toUpperCase()} (≈ ${Math.round(gain)} m, soit ${Math.round(gain / Math.max(0.5, optimalAngles(w.spd).up.vmg * 0.5144))} s de VMG).`);
    if (bias < -8) out.advice.push('Fort biais bouée : un départ bâbord amures près de la bouée peut passer devant la flotte — à évaluer dans la dernière minute.');
    if (bias > 3) out.advice.push('Côté comité favorisé : il y aura du monde ; se garder un trou sous le vent et attention à la bouée rouge à l’arrière du Comité.');
  } else {
    const dCb = distXY(L.cb, firstLeg.to), dPin = distXY(L.pin, firstLeg.to);
    out.favored = Math.abs(dCb - dPin) < 15 ? 'aucun' : dCb < dPin ? 'comité' : 'bouée';
    out.advice.push(`Premier bord ${Math.abs(twa1) > 100 ? 'portant' : 'de travers'} (TWA ${Math.abs(twa1).toFixed(0)}°) : l’extrémité la plus proche de la marque est ${out.favored === 'aucun' ? 'indifférente' : 'côté ' + out.favored} (${Math.round(Math.abs(dCb - dPin))} m d’écart).`);
    out.advice.push(`Départ ${twa1 > 0 ? 'bâbord' : 'tribord'} amures ; ${Math.abs(twa1) > spiMinTwa(w.spd) ? 'préparer l’envoi du spi dès la ligne coupée' : 'sous foc, vitesse maxi au top'}.`);
  }
  out.advice.push(`Vent sur la ligne : ${cardinal(w.dir)} ${fmtBrg(w.dir)} ${w.spd.toFixed(1)} nd (rafales ${w.gust.toFixed(0)} nd). Relever le cap de la ligne au compas : ${fmtBrg(lineBrg)} (bouée → comité).`);
  return out;
}

// ───────────────────────── Tendance de rotation dans la fenêtre de course
export function trendOf(series, startIdx, endIdx) {
  const pts = [];
  for (let i = startIdx; i <= endIdx && i < series.length; i++) if (series[i].dir != null) pts.push([i - startIdx, series[i].dir]);
  if (pts.length < 2) return 0;
  // déroulé angulaire
  for (let k = 1; k < pts.length; k++) pts[k][1] = pts[k - 1][1] + norm180(pts[k][1] - pts[k - 1][1]);
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const num = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0), den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  return den ? num / den : 0; // °/h
}

// Classement des parcours selon le vent (le comité cherche souvent un premier bord au près)
export function rankCourses(cls, windDir, windSpd) {
  return COURSES.filter((c) => c.seq[cls] && !c.built).map((c) => {
    const first = MARKS[c.seq[cls][0][0]];
    const ctr = toXY(LINE_PRESETS[c.line || 'vignettes'].lat, LINE_PRESETS[c.line || 'vignettes'].lon);
    const brg = bearingXY(ctr, toXY(first.lat, first.lon));
    const twa = Math.abs(norm180(brg - windDir));
    return { c, twa, brg, score: Math.abs(twa - 40) };
  }).sort((a, b) => a.score - b.score);
}

export const summarizeTime = (s) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`; };
export { toLL, fmtNm };
