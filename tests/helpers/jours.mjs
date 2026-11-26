// Statut, verrou et ouverture des régates SANS jours de course comparés à la v43 (08-08, D-13) : mêmes appels que la v43 (regattaStatus,
// todayRegatta, lockDates, openAtBoot, openOnNewDay, daysOf, sealAt, matchRegattas) sur une matrice de régates et d’instants ; résultat
// canonique. La référence est capturée UNE fois sur l’extraction de 5e9b8a5 (tests/fixtures/jours-v43.json) : npm test ne lit pas git.
//   node tests/helpers/jours.mjs --capture <racine extraite de 5e9b8a5> <sortie>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Régates de Naos (aucune n’a de jours) : un jour, trois jours, sans date, dernier jour vide, autre plan d’eau ; manches avec et sans heure
export const REGATES = () => [
  { id: 'un', name: 'Un jour', dateStart: '2026-10-18', dateEnd: '', races: [{ n: 1, date: '2026-10-18', time: '10:55' }], ic: { fields: { firstWarning: '10:55' } } },
  { id: 'trois', name: 'Trois jours', dateStart: '2026-11-07', dateEnd: '2026-11-09', races: [{ n: 1, date: '2026-11-08', time: '' }], ic: { fields: {} } },
  { id: 'brest', name: 'Brest', dateStart: '2026-11-08', dateEnd: '2026-11-08', venue: 'brest', races: [], ic: null },
  { id: 'hiver', name: 'Hiver', dateStart: '2026-12-13', dateEnd: '', races: [], ic: { fields: { firstWarning: '11:00' } } },
  { id: 'vide', name: 'Sans date', dateStart: '', dateEnd: '', races: [], ic: null },
];
// Instants : minuits et midis de Paris autour des régates, changement d’heure du 25/10/2026
export const INSTANTS = [
  '2026-10-17T21:59:00Z', '2026-10-17T22:00:00Z', '2026-10-18T09:00:00Z', '2026-10-18T21:59:00Z', '2026-10-18T22:00:00Z',
  '2026-10-25T00:30:00Z', '2026-10-25T23:30:00Z', '2026-11-06T23:00:00Z', '2026-11-07T08:00:00Z', '2026-11-08T12:00:00Z', '2026-11-09T22:59:00Z',
  '2026-11-09T23:00:00Z', '2026-12-12T23:00:00Z', '2026-12-13T09:00:00Z', '2026-12-14T09:00:00Z', '2027-04-11T09:00:00Z',
].map((s) => Date.parse(s));

export async function releve(racine) {
  const R = await import(pathToFileURL(join(racine, 'js/regates.js')).href);
  const G = await import(pathToFileURL(join(racine, 'js/gel.js')).href);
  const A = await import(pathToFileURL(join(racine, 'js/attach.js')).href);
  const list = REGATES(), out = { statut: {}, jour: {}, ouverture: {}, jours: {}, sceau: {}, trace: {} };
  for (const now of INSTANTS) {
    out.statut[now] = list.map((r) => R.regattaStatus(r, now));
    out.jour[now] = {
      today: R.todayRegatta({ now, list })?.id ?? null, todayCur: R.todayRegatta({ now, list, currentId: 'brest' })?.id ?? null,
      lock: R.lockDates({ now, list }), lockSeul: list.map((r) => R.lockDates({ now, list: [r] })),
    };
    out.ouverture[now] = {
      boot: R.openAtBoot({ now, list }), ici: R.openAtBoot({ now, list, here: (r) => r.venue !== 'brest' }), again: R.openAtBoot({ now, list, reopen: 'trois' }),
      jour: R.openOnNewDay({ now, list, openId: null, day: '2026-10-01' }), meme: R.openOnNewDay({ now, list, openId: 'brest', day: '2026-11-08' }),
    };
    // trace d’une heure commencée à `now`
    const pts = Array.from({ length: 61 }, (_, i) => [now + i * 60e3, 43.1, 5.95, 5, 90, 5]);
    const m = A.matchRegattas(pts, list);
    out.trace[now] = { how: m.how, ids: m.candidates.map((r) => r.id), day: m.day };
  }
  for (const r of list) {
    out.jours[r.id] = R.daysOf(r);
    out.sceau[r.id] = ['2026-10-18', '2026-11-07', '2026-11-08', '2026-11-09', '2026-12-13', '2026-12-14'].map((d) => G.sealAt(r, d));
  }
  return JSON.parse(JSON.stringify(out));
}

if (process.argv[2] === '--capture') {
  const [, , , racine, sortie] = process.argv;
  const r = await releve(racine);
  writeFileSync(sortie, JSON.stringify({ v: 43, from: '5e9b8a5', ...r }) + '\n');
  console.log(`capture écrite : ${sortie} (${INSTANTS.length} instants, ${REGATES().length} régates)`);
}
