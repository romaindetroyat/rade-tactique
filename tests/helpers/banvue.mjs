// Cas de calcul d’une banane comme runAnalysis (js/app.js) sur le vrai relief, lus par tests/routememo.test.mjs et capturés une fois sur la
// v38 (d311328) dans tests/fixtures/banane-v38.json : les modules sont passés en paramètre, pour faire tourner la même boucle sur l’ancien
// et sur le nouveau code. Vent constant (un seul état du champ) ou vent qui tourne de 6°/h, champ recalculé tous les quarts d’heure comme
// computeField de l’app (alors les routes d’un tour ne resservent pas au suivant). Zone interdite et relief de l’app.
export const BAN_CASES = [
  { dir: 315, spd: 15, laps: 3, ban: { nm: 0.8 } },
  { dir: 135, spd: 10, laps: 3, ban: { nm: 0.8 } },
  { dir: 90, spd: 12, laps: 3, ban: { nm: 0.8, side: 't', fin: 'sousvent' } },
  { dir: 225, spd: 7, laps: 3, ban: { nm: 0.6, gate: false, fin: 'auvent' } },
  { dir: 300, spd: 14, laps: 3, ban: { nm: 0.8 }, turn: 6 },
  { dir: 120, spd: 9, laps: 2, ban: { nm: 0.8, fin: 'auvent' }, turn: -6 },
];
// Résumé exact d’un bord : tout ce que l’app en montre, et une empreinte du chemin de la route (sommes dans l’ordre des points)
export const legVue = (l) => ({
  to: [l.to.name, l.to.x, l.to.y], from: [l.from.x, l.from.y], brg: l.brg, dist: l.dist, time: l.time, twa: l.twa, type: l.type.id, side: l.side ?? null,
  gate: l.gate ? { pick: l.gate.pick, gain: l.gate.gain, times: l.gate.times, equal: l.gate.equal, why: l.gate.why } : null,
  advice: l.advice, site: l.site.map((s) => s.text), wind: l.wind,
  route: l.route ? { time: l.route.time, man: l.route.maneuvers, n: l.route.path.length, right: l.route.rightShare, off: l.route.maxOff,
    sx: l.route.path.reduce((s, p, i) => s + p.x * (i + 1), 0), sy: l.route.path.reduce((s, p, i) => s + p.y * (i + 1), 0) } : null,
});
// Un cas : { legs: [legVue], calls } (calls : appels de route sans mémoire, un par bord plus quatre par porte)
export function banCase({ tac, BANANE, LINE_PRESETS, FORBIDDEN_ZONE, toXY, F, T }, c, memo = null) {
  const at = (h) => ({ points: [{ x: 0, y: 0, dir: ((c.dir + (c.turn || 0) * (h - 11)) % 360 + 360) % 360, spd: c.spd, gust: c.spd * 1.3 }] });
  F.compute(at(11), { localEffects: 1 });
  const GR = LINE_PRESETS.grandrade, ctr = toXY(GR.lat, GR.lon), w = F.sample(ctr.x, ctr.y);
  const B = tac.buildLegs(BANANE, 'G', { laps: c.laps, windDir: w.dir, ban: c.ban, line: { center: GR, lengthNm: 0.12, mode: 'wind' } });
  const ctx = { terrain: T, forbidden: [FORBIDDEN_ZONE.map((p) => toXY(p.lat, p.lon))], perf: 1, trend: 0, ...(memo ? { memo } : {}) };          // zone interdite de l’app
  const legs = []; let t = 11, lastH = 11;
  for (const [k, leg] of B.legs.entries()) {
    if (c.turn && Math.abs(t - lastH) >= 0.25) { F.compute(at(t), { localEffects: 1 }); lastH = t; }
    tac.prepareLeg(leg, legs[legs.length - 1], B.legs[k + 1], F, ctx);
    const a = tac.analyzeLeg(leg, F, ctx); t += a.time / 3600; legs.push(a);
  }
  return { legs: legs.map(legVue), calls: legs.length + 4 * legs.filter((l) => l.gate).length };
}
