// Régates : une fiche par épreuve, remplie depuis les Instructions de Course (PDF ou texte), modifiable à la main.

import { IC as SNPM } from './courses.js';

const KEY = 'rade.events.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

// Valeurs communes aux régates CVAT (signaux de départ règle 26, pavillons de classe habituels)
const COMMON = { sequence: SNPM.sequence, classes: SNPM.classes, groups: SNPM.groups };

export function eventsState() {
  let st = load();
  if (!st) { st = { current: 'snpm-2026', list: [{ id: 'snpm-2026', ...SNPM, source: 'IC fournies (PDF)' }] }; save(st); }
  return st;
}
export function currentEvent() {
  const st = eventsState();
  return { ...COMMON, ...(st.list.find((e) => e.id === st.current) || st.list[0]) };
}
export function setCurrent(id) { const st = eventsState(); st.current = id; save(st); }
export function upsertEvent(ev) {
  const st = eventsState(); const i = st.list.findIndex((e) => e.id === ev.id);
  if (i >= 0) st.list[i] = ev; else st.list.push(ev);
  st.current = ev.id; save(st);
}
export function removeEvent(id) {
  const st = eventsState(); st.list = st.list.filter((e) => e.id !== id);
  if (!st.list.length) { localStorage.removeItem(KEY); return; }
  if (st.current === id) st.current = st.list[0].id; save(st);
}

// ───────────────────────── PDF → texte (pdf.js chargé à la demande)
function loadScript(src) {
  return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('chargement de ' + src)); document.head.appendChild(s); });
}
export async function pdfText(file) {
  if (!window.pdfjsLib) await loadScript('vendor/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    let lastY = null;
    for (const it of c.items) {
      const y = it.transform?.[5];
      if (lastY != null && Math.abs(y - lastY) > 2) out += '\n';
      out += it.str + (it.hasEOL ? '\n' : ' ');
      lastY = y;
    }
    out += '\n';
  }
  return out;
}

// ───────────────────────── texte des IC → fiche
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const hm = (h, m) => `${String(+h).padStart(2, '0')}:${String(+(m || 0)).padStart(2, '0')}`;

export function parseIC(raw, fileName = '') {
  // « p r e m i e r » → « premier » (lettres espacées de certains PDF)
  const text = raw.replace(/\b(?:\p{L} ){3,}\p{L}\b/gu, (m) => m.replace(/ /g, '')).replace(/[ \t]+/g, ' ');
  const flat = text.replace(/\n/g, ' ');
  const f = {};
  const titles = [...flat.matchAll(/\b(coupe|troph[ée]e|r[ée]gate|challenge|grand prix|championnat|crit[ée]rium|interclubs?)\b\s+[\p{L}0-9'’ .-]{2,60}/giu)]
    .map((m) => m[0].split(/\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d)/i)[0].replace(/\s+/g, ' ').trim());
  const title = titles.find((t) => t.length > 8) || '';
  f.event = title.length > 6 ? title : fileName.replace(/\.(pdf|txt)$/i, '').replace(/[_-]+/g, ' ');
  const dm = new RegExp(`(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\\s*(\\d{1,2})(?:er)?\\s+(${MONTHS.join('|')})\\s+(20\\d\\d)`, 'i').exec(flat);
  if (dm) f.date = `${dm[3]}-${String(MONTHS.indexOf(dm[2].toLowerCase()) + 1).padStart(2, '0')}-${String(+dm[1]).padStart(2, '0')}`;
  const fw = /avertissement[^0-9]{0,25}(\d{1,2})\s*[hH:.]\s*(\d{2})?/.exec(flat);
  if (fw) f.firstWarning = hm(fw[1], fw[2]);
  const lf = /(?:limite|aucun signal)[^.]{0,60}?arriv[ée]e?[^0-9]{0,40}(\d{1,2})\s*[hH:.]\s*(\d{2})?/i.exec(flat);
  if (lf) f.lastFinishSignal = hm(lf[1], lf[2]);
  const vhf = /canal[^0-9]{0,30}(\d{1,2})\b/i.exec(flat) || /VHF[^0-9]{0,20}(\d{1,2})\b/.exec(flat);
  if (vhf) f.vhf = +vhf[1];
  const tel = /(0[1-9](?:[ .-]?\d{2}){4})/.exec(flat);
  const pres = /Pr[ée]sident du comit[ée] de course\s*:?\s*([A-ZÉÈ][\p{L} .'-]{2,40})/u.exec(flat) || /Comit[ée] de course\s*:\s*([A-ZÉÈ][\p{L} .'-]{2,40}?)\s{2,}/u.exec(text);
  f.committee = [pres?.[1]?.split(/\s{2,}/)[0].trim(), tel ? 'tél. ' + tel[1] : null].filter(Boolean).join(' — ');
  const zone = /zone de course\s*:?\s*([^.\n]{8,160})/i.exec(text);
  if (zone) f.zone = zone[1].trim();
  // points clés : phrases qui contiennent des mots-clés de la régate
  const KW = /(pénalit|360|720|ligne de départ|ligne d.arrivée|pavillon|VHF|canal|abandon|brassière|gilet|délai|temps limite|HFL|réduction|bouée de dégagement|zone interdite|réclamation|remise des prix|classement)/i;
  const sentences = flat.split(/(?<=[.;])\s+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 25 && s.length < 260 && KW.test(s));
  f.keyRules = [...new Set(sentences)].slice(0, 18);
  f.text = raw.slice(0, 60000);
  return f;
}

// ───────────────────────── formulaire d'édition
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function eventForm(ev) {
  return `<div class="card" id="evForm"><h3>Fiche de la régate <small>vérifiez les champs extraits</small></h3>
    <label class="f" for="evName">Épreuve</label><input id="evName" type="text" value="${esc(ev.event)}">
    <div class="row2"><div><label class="f" for="evDate">Date</label><input id="evDate" type="date" value="${esc(ev.date || '')}"></div>
    <div><label class="f" for="evVhf">Canal VHF</label><input id="evVhf" type="number" min="1" max="88" value="${esc(ev.vhf ?? '')}"></div></div>
    <div class="row2"><div><label class="f" for="evWarn">1er signal d’avertissement</label><input id="evWarn" type="time" value="${esc(ev.firstWarning || '')}"></div>
    <div><label class="f" for="evLast">Limite d’arrivée du 1er</label><input id="evLast" type="time" value="${esc(ev.lastFinishSignal || '')}"></div></div>
    <label class="f" for="evCom">Comité de course (nom, téléphone)</label><input id="evCom" type="text" value="${esc(ev.committee || '')}">
    <label class="f" for="evZone">Zone de course</label><input id="evZone" type="text" value="${esc(ev.zone || '')}">
    <label class="f" for="evRules">Points clés (une ligne par point)</label><textarea id="evRules" rows="8">${esc((ev.keyRules || []).join('\n'))}</textarea>
    <div class="btns"><button class="btn acc" id="evSave">Enregistrer cette régate</button><button class="btn alt" id="evCancel">Annuler</button></div></div>`;
}
export function readForm(base) {
  const v = (id) => document.getElementById(id).value.trim();
  return {
    ...base, event: v('evName') || 'Régate', date: v('evDate'), vhf: v('evVhf') ? +v('evVhf') : null,
    firstWarning: v('evWarn'), lastFinishSignal: v('evLast'), committee: v('evCom'), zone: v('evZone'),
    keyRules: v('evRules').split('\n').map((l) => l.trim()).filter(Boolean),
  };
}
