// Rattrapage, une fois par téléphone, des traces gardées avant l’archive (ARCH2-01, D-01 à D-03) : chaque trace locale jamais rangée entre dans la
// régate de son jour quand les règles de js/attach.js en désignent une seule (unique ou heure), sans question et sans créer de régate (D-02).
// Module pur comme js/archheavy.js : tout est injecté par js/app.js (bases de traces, liste des régates, enregistrement, course, verrou), aucun DOM.
// Rien ne tourne pendant une course ni la journée de régate verrouillée (D-03) ; l’envoi des traces rangées suit le chemin lourd de la phase 4.
import { matchRegattas, sameTrack, attachTrace, setTraceReport } from './attach.js';
import { canonicalTraceId } from './track.js';
import { breaksOf } from './segments.js';

// Un passage. d : { listTracks(), getTrack(id), saveTrack(tr), deleteTrack(id), getList(), save(régate), who(), now(), isActive(), isLocked(), report(où, erreur) }
// Rend { rangees, deja, laissees, renommees, erreurs, skipped?, error? } : nombres de traces, raison d’un arrêt ('course' | 'journee'), ou 'base_traces'.
export async function runReprise(d) {
  const out = { rangees: 0, deja: 0, laissees: 0, renommees: 0, erreurs: 0 };
  const halt = () => (d.isActive() ? 'course' : d.isLocked() ? 'journee' : null);
  let why = halt();
  if (why) return { ...out, skipped: why };
  let liste;
  try { liste = await d.listTracks(); } catch (e) { d.report('reprise', e); return { ...out, error: 'base_traces' }; }
  const refs = (id) => d.getList().some((r) => (r.traces || []).some((x) => x.id === id));
  for (const t of liste) {
    if ((why = halt())) { out.skipped = why; break; }                      // nouveau contrôle entre deux traces : une course qui commence arrête tout
    try {
      if (refs(t.id)) { out.deja++; continue; }                            // déjà rangée : on ne lit pas la trace (≈ 600 Ko)
      let tr = await d.getTrack(t.id);
      if (!tr || !(tr.pts?.length > 1)) continue;
      // D-10 : un import d’avant la v31 a un identifiant au hasard ; il prend l’identifiant stable (écrire d’abord, effacer ensuite : jamais de perte,
      // et rejouable si le passage a été interrompu entre les deux). Une trace enregistrée dans l’app (sans `imported`) ne change jamais d’identifiant.
      if (tr.imported && tr.id !== canonicalTraceId(tr)) {
        const canon = canonicalTraceId(tr), exist = await d.getTrack(canon);
        if (exist) { await d.deleteTrack(tr.id); tr = exist; }              // passage précédent interrompu : l’ancienne copie seule disparaît
        else { await d.saveTrack({ ...tr, id: canon }); await d.deleteTrack(tr.id); tr = { ...tr, id: canon }; }
        out.renommees++;
      }
      if (refs(tr.id)) { out.deja++; continue; }
      const m = matchRegattas(tr.pts, d.getList(), breaksOf(tr));
      if (m.how !== 'unique' && m.how !== 'heure') { out.laissees++; continue; }   // choix, proche, aucune : elle reste dans « Traces », jamais d’invite
      if (sameTrack(m.candidates[0].traces, tr)) { out.deja++; continue; }       // un autre téléphone a déjà rangé ce fichier (même début, même nombre de points)
      let next = attachTrace(m.candidates[0], tr, { by: d.who(), at: d.now() });
      if (Number.isFinite(tr.report?.t)) next = setTraceReport(next, tr.id, { t: tr.report.t, by: d.who() });   // D-11 : les autres téléphones téléchargeront le rapport
      d.save(next);
      out.rangees++;
    } catch (e) { d.report('reprise', e); out.erreurs++; }                 // une trace illisible n’arrête pas les autres
  }
  return out;
}
