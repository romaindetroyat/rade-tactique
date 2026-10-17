// Aide : infobulles (survol ou ⓘ), guide de démarrage, partage de l'app (lien, QR code, parcours).

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Petit bouton ⓘ à placer à côté d'un titre
export const tip = (text) => `<button type="button" class="tip-i" data-tip="${esc(text)}" aria-label="Aide">i</button>`;

// Infobulles des éléments fixes de l'interface
const STATIC_TIPS = {
  '#daySeg': 'Jour affiché : aujourd’hui, demain (🏁 = jour de régate) ou après-demain.',
  '.hour': 'Heure affichée sur la carte du vent. Glissez pour voir l’évolution du vent dans la journée.',
  '#srcSeg': 'Prévision : vent des modèles météo, recalé sur vos relevés. Manuel : vous imposez un vent (onglet Vent) pour étudier n’importe quelle situation.',
  '#refresh': 'Télécharger les dernières prévisions (à faire avant de partir et à l’arrivée sur zone).',
  '#shareBtn': 'Partager l’app ou le parcours en cours (lien, QR code).',
  '#helpBtn': 'Guide d’utilisation.',
  '#compass': 'Nord en haut. Touchez pour revenir à une vue orientée au Nord.',
  '#windBadge': 'Vent au centre de la rade à l’heure affichée, et modèle utilisé.',
  '[data-v=top]': 'Vue de dessus (carte).',
  '[data-v=tilt]': 'Vue 3D inclinée.',
  '[data-v=course]': 'Cadrer tout le parcours.',
  '[data-v=boat]': 'Suivre ma position GPS sur la carte.',
  '[data-v=layers]': 'Calques : couleurs du vent, filets animés, routes, noms, exagération du relief.',
  '#legend': 'Couleur de l’eau = force du vent prévue (nœuds), avec les effets du relief.',
  '[data-tab=brief]': 'Résumé du jour : vent, modèles, stratégie, effets locaux, réglages.',
  '[data-tab=course]': 'Parcours du cahier CVAT, relevés de vent, route optimale bord par bord, animation.',
  '[data-tab=start]': 'Ligne de départ : position, biais, extrémité favorisée, chrono 5-4-1-0.',
  '[data-tab=live]': 'Pendant la course : GPS, prochaine marque, recalcul de la suite, enregistrement de la trace.',
  '[data-tab=wind]': 'Vent manuel, relevés, intensité des effets du relief et explications du modèle.',
  '[data-tab=tracks]': 'Traces enregistrées : carte, statistiques, comparaison à la route optimale, export GPX.',
  '[data-tab=j80]': 'Polaires J80 (ORC), vitesses cibles et guides de réglage.',
  '[data-tab=ic]': 'Instructions de course, marques, dangers, contacts.',
};

let bubble = null, bubbleFor = null;
function show(el) {
  const text = el.getAttribute('data-tip'); if (!text) return;
  if (!bubble) { bubble = document.createElement('div'); bubble.id = 'tipBubble'; bubble.setAttribute('role', 'tooltip'); document.body.appendChild(bubble); }
  bubble.textContent = text; bubble.hidden = false; bubbleFor = el;
  const r = el.getBoundingClientRect(), bw = Math.min(300, innerWidth - 16);
  bubble.style.maxWidth = bw + 'px';
  const b = bubble.getBoundingClientRect();
  let x = r.left + r.width / 2 - b.width / 2; x = Math.max(8, Math.min(innerWidth - b.width - 8, x));
  let y = r.bottom + 8; if (y + b.height > innerHeight - 8) y = r.top - b.height - 8;
  bubble.style.left = x + 'px'; bubble.style.top = Math.max(8, y) + 'px';
}
function hide() { if (bubble) bubble.hidden = true; bubbleFor = null; }

export function initTips() {
  for (const [sel, text] of Object.entries(STATIC_TIPS)) document.querySelectorAll(sel).forEach((el) => { if (!el.hasAttribute('data-tip')) el.setAttribute('data-tip', text); });
  const hover = matchMedia('(hover: hover)').matches;
  if (hover) {
    document.addEventListener('pointerover', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && el !== bubbleFor) show(el); else if (!el) hide(); });
  }
  // sur téléphone : appui sur ⓘ, ou appui long sur un élément muni d'une infobulle
  document.addEventListener('click', (e) => {
    const i = e.target.closest?.('.tip-i');
    if (i) { e.preventDefault(); e.stopPropagation(); if (bubbleFor === i) hide(); else show(i); return; }
    if (!hover) hide();
  }, true);
  let lp = null;
  document.addEventListener('touchstart', (e) => { const el = e.target.closest?.('[data-tip]'); if (!el) return; lp = setTimeout(() => show(el), 550); }, { passive: true });
  document.addEventListener('touchend', () => clearTimeout(lp), { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(lp), { passive: true });
  addEventListener('scroll', hide, true);
}

// ───────────────────────── fenêtres (guide, partage)
function modal(html, cls = '') {
  let m = document.getElementById('modal');
  if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
  m.className = cls; m.hidden = false;
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${html}<button class="btn modal-close" type="button">Fermer</button></div>`;
  const close = () => { m.hidden = true; };
  m.querySelector('.modal-close').onclick = close;
  m.onclick = (e) => { if (e.target === m) close(); };
  return m;
}

export const GUIDE = `
<h2>Rade Tactique — mode d’emploi</h2>
<p class="small muted">Préparer et courir les régates du CVAT en J80 dans la rade de Toulon.</p>
<ol class="guide">
  <li><b>La carte</b> : un doigt pour déplacer, deux doigts pour zoomer et tourner. La couleur de l’eau donne la force du vent prévue, les filets blancs sa direction. Touchez l’eau pour lire le vent en un point.</li>
  <li><b>L’heure</b> (curseur en haut) fait défiler la prévision de la journée. <b>⟳</b> télécharge les dernières prévisions.</li>
  <li><b>Briefing</b> : vent attendu, accord entre les modèles, stratégie du jour, effets locaux et réglages J80.</li>
  <li><b>Parcours</b> : choisissez le parcours annoncé par le Comité (et le nombre de tours). Les bouées sont numérotées dans l’ordre de passage. Chaque bord donne l’amure, le côté favorisé et la route optimale (pointillés bleus). <b>▶ Animer le parcours</b> montre un J80 qui le parcourt.</li>
  <li><b>Relevé de vent</b> (en haut de Parcours ou dans En course) : touchez 🎤 et parlez librement : « ça refuse d’une dizaine de degrés et ça mollit un peu », « mistral 18 nœuds avec des rafales à 24 », « 290 12 » ; ou réglez le compas puis « Enregistrer ». L’app retient le modèle météo qui colle le mieux et recale la prévision.</li>
  <li><b>Départ</b> : placez la ligne (GPS au ras du Comité puis de la bouée), lisez le biais et lancez le chrono au signal d’avertissement.</li>
  <li><b>En course</b> : activez le GPS et l’enregistrement de la trace. Relèvement et distance de la prochaine marque, et « Recalculer la suite » depuis votre position avec le dernier vent relevé.</li>
  <li><b>Traces</b> : après la course, revoyez votre trace, comparez-la à la route optimale et exportez-la (GPX).</li>
</ol>
<p class="small"><b>Installer l’app</b> : sur iPhone, ouvrez le lien dans Safari puis Partager → « Sur l’écran d’accueil ». Sur Android, menu ⋮ → « Installer l’application ».</p>
<p class="small muted">Le vent local est un modèle simplifié pour la tactique : il donne les tendances (pression, bascules, dévents). Il ne remplace pas l’observation du plan d’eau. Les positions marquées « approx » sont à vérifier sur zone ; le Comité fait foi.</p>`;

export function openGuide() { modal(GUIDE, 'guide'); }

export function maybeWelcome() {
  let seen = false;
  try { seen = localStorage.getItem('rade.welcome') === '1'; localStorage.setItem('rade.welcome', '1'); } catch { /* stockage indisponible */ }
  if (!seen) openGuide();
}

// ───────────────────────── partage
function qrSVG(text) {
  const Q = window.qrcode; if (!Q) return '';
  const q = Q(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), s = 4;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c * s + 16},${r * s + 16}h${s}v${s}h-${s}z`;
  const W = n * s + 32;
  return `<svg viewBox="0 0 ${W} ${W}" class="qr" role="img" aria-label="QR code du lien"><rect width="${W}" height="${W}" fill="#fff"/><path d="${d}" fill="#0c2236"/></svg>`;
}

export function openShare({ base, courseLink, courseLabel }) {
  const m = modal(`
    <h2>Partager Rade Tactique</h2>
    <p class="small">Envoyez le lien à votre équipage : il s’ouvre sur iPhone comme sur ordinateur, sans compte ni installation.</p>
    <div class="share-row"><label class="f">L’application</label><div class="copyline"><input type="text" readonly value="${esc(base)}" id="shBase"><button class="btn small" data-copy="shBase">Copier</button></div></div>
    <div class="share-row"><label class="f">Ce parcours (${esc(courseLabel)}) — s’ouvre directement dessus</label><div class="copyline"><input type="text" readonly value="${esc(courseLink)}" id="shCourse"><button class="btn small" data-copy="shCourse">Copier</button></div></div>
    <div class="btns">${navigator.share ? '<button class="btn acc" id="shNative">Partager… (WhatsApp, Messages)</button>' : ''}<a class="btn alt" href="https://wa.me/?text=${encodeURIComponent('Rade Tactique : ' + courseLink)}" target="_blank" rel="noopener">WhatsApp</a></div>
    <div class="qrwrap">${qrSVG(courseLink)}<div class="small muted">À scanner avec l’appareil photo d’un téléphone (ponton, briefing).</div></div>`, 'share');
  m.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const inp = m.querySelector('#' + b.dataset.copy);
    try { await navigator.clipboard.writeText(inp.value); b.textContent = 'Copié ✓'; } catch { inp.select(); document.execCommand?.('copy'); b.textContent = 'Copié ✓'; }
  }));
  m.querySelector('#shNative')?.addEventListener('click', () => navigator.share({ title: 'Rade Tactique', text: `Rade Tactique — ${courseLabel} : vent, parcours et tactique pour la rade de Toulon`, url: courseLink }).catch(() => {}));
}
