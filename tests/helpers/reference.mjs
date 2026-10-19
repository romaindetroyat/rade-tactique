// Chaîne de mesure d’un cas de référence : trace GPX réelle → fromGPX → detect → analyze.
// Écrite UNE fois et partagée par le test (tests/reference.test.mjs) et par la mesure initiale des valeurs consignées :
// ce que le test recalcule est donc exactement ce qui a été consigné. Ce module n’écrit jamais sur le disque
// et ne régénère jamais la référence (D-12 : une référence ne change qu’après l’accord de Romain).
import { fixture } from './setup.mjs';
import { fromGPX } from '../../js/track.js';
import { detect, analyze } from '../../js/debrief.js';
import { Terrain } from '../../js/geo.js';
import { WindField } from '../../js/wind.js';

// Heure UTC en HH:MM:SSZ (indépendant du fuseau)
export const hmsZ = (t) => new Date(t).toISOString().slice(11, 19) + 'Z';

export async function mesurer(cas) {
  const e = cas.entrees;
  const tr = fromGPX(fixture(cas.gpx), cas.gpx);
  const det = detect(tr);
  const jour = new Date(tr.start).toISOString().slice(0, 10);

  const mc = det.mc;
  const trace = { points: tr.pts.length, debut: hmsZ(tr.start) };
  const parcours = { id: mc.c.id, cls: mc.cls, tours: mc.laps, reduit: mc.reduced };
  const passages = det.pass.slice(0, 3).map((p) => [p.k, hmsZ(p.t), Math.round(p.d)]);
  const fauxDeparts = det.launches.map((l) => [hmsZ(l.t0), hmsZ(l.t1)]);
  const depart = hmsZ(det.tStart);

  const T = await new Terrain().load('data/');
  const obs = e.releves.map(([h, dir, spd]) => ({ t: Date.parse(`${jour}T${h}`), dir, spd }));
  const ans = {
    course: mc.c,
    cls: 'P',
    marks: mc.hit.slice(0, 3).map((h, i) => ({ k: h.k, t: h.t, side: mc.exp[i].side })),
    startWind: e.startWind,
    tStart: det.tStart, // départ détecté (D-14) : jamais une heure saisie
    falseStarts: 2,
    reduced: true,
  };
  const api = {
    F: new WindField(T),
    ctx: { terrain: T, forbidden: [], perf: 1 },
    localFx: 1,
    forecastAt: () => e.prevision,
    restoreField() {},
    obs,
  };
  const an = analyze(det, ans, api);
  const bords = an.legs.map((L) => ({
    vent: [L.wind.src, Math.round(L.wind.dir), Math.round(L.wind.spd * 10) / 10],
    polaire: (L.polar || []).map((p) => [p.allure, Math.round(p.pct)]),
    stats: [L.st.man, Math.round(L.st.slow * 100), Math.round(L.st.right * 100)],
  }));
  return { trace, parcours, passages, fauxDeparts, depart, bords };
}
