// Aide : infobulles (survol ou ⓘ), guide de démarrage, partage de l'app (lien, QR code, parcours).

import { BUILD } from './version.js';
import { journal, header } from './journal.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Petit bouton ⓘ à placer à côté d'un titre
export const tip = (text) => `<button type="button" class="tip-i" data-tip="${esc(text)}" aria-label="Aide">i</button>`;

// Bulle de l’indicateur de synchronisation (onglet Régates), cohérente avec la carte « Archive partagée » du guide
export const SYNC_TIP = 'Régates, manches, IC validées, bouées confirmées, recalages des bouées, vent du jour figé, traces, débriefs et rapports sont partagés avec l’équipage, en privé, jamais pendant une course. « À jour » : tout est échangé. « En attente d’envoi » : une modification part dans une vingtaine de secondes. « Hors réseau · n modifications en attente » : elles partiront au retour du réseau. « En pause pendant la course » : rien ne circule pendant un chrono, une trace ou le mode départ. « Pas encore synchronisé » : aucun échange réussi sur ce téléphone, touchez « Synchroniser ». « Synchronisation à relancer » : le dernier essai a échoué, l’app réessaie. « Plafond du jour atteint · reprise demain » : trop d’échanges aujourd’hui, attendez demain. « Code d’accès à renouveler » : rouvrez le lien personnel reçu de Romain. « Mettez l’app à jour pour synchroniser » : un autre téléphone a une version plus récente, mettez à jour hors course. « Archive non configurée » : l’app marche comme avant. « (essai) » : version d’essai. Une valeur écrasée reste dans « Historique » de la fiche. « Désactiver la synchronisation » coupe tout échange sur ce téléphone.';

// Bulle du bouton « Télécharger pour le hors réseau » (fiche de régate), cohérente avec la carte « Lire une régate hors réseau » du guide
export const DL_TIP = 'Les régates des six derniers mois et à venir sont déjà entières sur le téléphone après une synchronisation : fiche, vent du jour, traces, débrief et rapport, lisibles en mode avion. Pour une régate plus ancienne, ce bouton rapatrie d’un geste ses traces, rapports et vent du jour (environ 1 Mo par régate). À faire avec du réseau, hors course : rien de lourd ne circule pendant la journée de régate.';

// Infobulles des éléments fixes de l'interface
const STATIC_TIPS = {
  '#daySeg': 'Jour affiché : Auj., Demain, puis le jour suivant écrit en abrégé. 🏁 marque le premier jour de la régate ouverte.',
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
  '[data-tab=course]': 'Parcours du cahier CVAT ou Banane (construite) avec sa porte conseillée, relevés de vent, route optimale bord par bord, animation.',
  '[data-tab=start]': 'Ligne de départ : position, biais, extrémité favorisée, chrono 5-4-1-0.',
  '[data-tab=live]': 'Pendant la course : GPS, prochaine marque, recalcul de la suite, enregistrement de la trace.',
  '[data-tab=wind]': 'Vent manuel, relevés, intensité des effets du relief et explications du modèle.',
  '[data-tab=tracks]': 'Traces enregistrées : carte, statistiques, comparaison à la route optimale, export GPX.',
  '[data-tab=j80]': 'Polaires J80 (ORC), vitesses cibles et guides de réglage.',
  '[data-tab=ic]': 'Régates : la liste (En préparation, En cours, Terminées) avec Ouvrir, et Fermer la régate pour revenir à l’entraînement libre ; créez une régate, ses manches, importez et relisez ses IC ; vent du jour figé, traces et débrief dans la fiche, partagés avec l’équipage hors course ; règles de course, marques, dangers.',
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
  <li><b>Parcours</b> : choisissez le parcours annoncé par le Comité (et le nombre de tours). Les bouées sont numérotées dans l’ordre de passage. Chaque bord donne l’amure, le côté favorisé et la route optimale (pointillés bleus). <b>▶ Animer le parcours</b> montre un J80 qui le parcourt. « Banane (construite) » : un aller-retour au vent / sous le vent depuis la ligne de départ, réglé par « Dist. B (Nq) », « Dégagement (C) », « B laissée à », « Porte sous le vent » et « Arrivée » (« Ligne de départ », « Sous le vent, décalée » ou « Au vent, décalée ») ; positions théoriques, le Comité fait foi. À la porte, l’app nomme la bouée la plus rapide (<b>Porte : bouée droite conseillée — 25 s de mieux</b>, cerclée d’orange sur la carte) ou dit « bouées équivalentes » sous 10 s d’écart ; en course, la porte passe près de l’une ou l’autre bouée et « ↻ Recalculer la suite depuis ma position » refait le conseil. Si une bouée tombe à terre avec ce vent, une carte ⚠ le dit : réduisez « Dist. B (Nq) ». Pour que les trois téléphones aient la même banane, ajoutez-la comme manche puis « Choisir cette manche » sur les autres. Le débrief de course ne connaît pas encore la banane.</li>
  <li><b>Relevé de vent</b> (en haut de Parcours ou dans En course) : touchez 🎤 et parlez librement : « ça refuse d’une dizaine de degrés et ça mollit un peu », « mistral 18 nœuds avec des rafales à 24 », « 290 12 » ; ou réglez le compas puis « Enregistrer ». L’app retient le modèle météo qui colle le mieux et recale la prévision.</li>
  <li><b>Départ</b> : placez la ligne (GPS au ras du Comité puis de la bouée), lisez le biais et lancez le chrono au signal d’avertissement : <b>Top 5’ (avertissement)</b>, <b>Top 4’</b> ou <b>Top 1’</b>. <b>⛵ Mode départ plein écran</b> (onglet Départ) montre la même chose en grand, avec <b>DÉPART 5’</b>. Avant chaque départ, touchez <b>🔊 Tester le son</b> : trois bips, puis « Avez-vous entendu 3 bips ? ».</li>
  <li><b>En course</b> : activez le GPS et l’enregistrement de la trace. Relèvement et distance de la prochaine marque, et « Recalculer la suite » depuis votre position avec le dernier vent relevé. Sur iPhone, le GPS de l’app s’arrête quand l’écran se verrouille : lancez aussi <b>Open GPX Tracker</b>, qui enregistre même verrouillé, et importez son fichier après la course.</li>
  <li><b>Les voyants</b> : quatre lampes, GPS, ÉCRAN, SON et RÉSEAU. Touchez une lampe pour lire son détail ; un bouton propose de réparer ce qui est rouge.</li>
  <li><b>Au retour au port</b> : <b>⏹ Arrêter et enregistrer</b>, puis <b>Stop</b> si le chrono tourne encore et ✕ du mode départ : le GPS qu’ils avaient allumé s’arrête de lui-même. Si vous l’aviez allumé vous-même (<b>▶ Activer le GPS</b> ou ◎), <b>Arrêter le GPS</b> (sinon l’app se croit encore en course). Puis <b>🏁 Course finie — retour au port</b>.</li>
  <li><b>Mise à jour</b> : quand une nouvelle version est prête, un bandeau propose <b>Mettre à jour</b> ; rien ne change tout seul. Le bandeau n’apparaît jamais pendant une course. Le jour d’une régate, à partir de 9 h, il reste caché jusqu’à <b>🏁 Course finie — retour au port</b> (ou une heure après la dernière activité de la journée) : faites la mise à jour la veille ou le matin.</li>
  <li><b>IA</b> : 30 appels par équipier et par jour (dictée, débrief, arbitre, lecture d’IC). Au-delà : « Limite d’IA du jour atteinte — reprise demain ». Le reste de l’app marche sans IA.</li>
  <li><b>Entraînement libre</b> : à chaque lancement, aucune régate n’est ouverte et tout marche quand même (vent, parcours du cahier, chrono, mode départ, GPS, trace, débrief). Le jour d’une régate, l’app l’ouvre toute seule. Sinon, <b>Ouvrir une régate</b> en tête du panneau mène à la liste, puis <b>Ouvrir</b> ; <b>Fermer la régate</b> revient à l’entraînement libre. Ouvrir ou fermer une régate ne change rien chez les autres.</li>
  <li><b>Régates</b> : créez la régate en trois champs (nom, premier jour, club), ajoutez ses manches (heure du signal, parcours) et touchez <b>Choisir cette manche</b>. Ouvrez d’abord la régate avant d’importer ses IC. Importez le PDF des IC : chaque valeur s’affiche avec sa phrase d’origine, rien n’est retenu avant <b>Valider les IC</b>. Pour un autre club, <b>Lire avec l’IA</b> (avec le réseau, avant la régate) ; ses bouées restent « <b>X1 ?</b> » à confirmer dans la fiche avant de servir. Une porte (porte 4s / 4p) et une arrivée (<b>Arrivée : entre le Comité et F</b>) lues dans les IC se relisent avec leur extrait ; le parcours ne sert qu’une fois toutes ses bouées confirmées, porte et arrivée comprises. Au débrief, une porte dit la bouée prise (« porte : bouée prise »). Passez les trois téléphones à la même version avant la régate. Le vent du jour se fige tout seul à l’ouverture de l’app le jour de la régate. <b>Archive partagée</b> : les régates, manches, IC validées, bouées confirmées, recalages des bouées, vent du jour figé, traces, débriefs et rapports sont partagés avec l’équipage, en privé, à l’ouverture, au retour du réseau, 20 secondes après une modification et une minute après la course, <b>jamais pendant un chrono, une trace, le mode départ ou la course</b> ; l’indicateur de l’onglet Régates dit où l’on en est (« À jour », « En attente d’envoi », « Hors réseau · n modifications en attente »), et <b>Désactiver la synchronisation</b> coupe tout sur ce téléphone.</li>
  <li><b>Traces</b> : après la course, importez le GPX (rangé tout seul dans la régate du jour), revoyez-le, comparez-le à la route optimale et validez le débrief pré-rempli.</li>
</ol>
<p class="small"><a href="guide.html#minute" target="_blank" rel="noopener"><b>📖 Guide complet de l’équipage</b></a> : toutes les fonctions, du départ au débrief.</p>
<p class="small"><a href="regles.html" target="_blank" rel="noopener"><b>📘 Règles de course expliquées</b></a> : départs P, I, U, Z, noir, priorités, bouées, arrivée, pénalités, et un arbitre de poche à qui poser vos questions (aussi dans l’onglet Régates).</p>
<p class="small"><b>Installer l’app</b> : sur iPhone, ouvrez le lien dans Safari puis Partager → « Sur l’écran d’accueil ». Sur Android, menu ⋮ → « Installer l’application ».</p>
<p class="small muted">Le vent local est un modèle simplifié pour la tactique : il donne les tendances (pression, bascules, dévents), utile jusqu’à 25 nœuds ; au-delà, les chiffres ne sont pas faits pour. Il ne remplace pas l’observation du plan d’eau. Les positions marquées « approx » sont à vérifier sur zone ; le Comité fait foi.</p>`;

// La version vient de js/version.js (généré) ; la note est affichée échappée. Rien n’est envoyé au serveur.
export function openGuide() {
  const m = modal(`${GUIDE}<p class="small muted" id="appVersion">Version ${esc(BUILD.label)} — ${esc(BUILD.note)}</p>
    <p><button type="button" class="btn small alt" id="openJournal">Journal de diagnostic (${journal.entries().length})</button></p>`, 'guide');
  m.querySelector('#openJournal').onclick = openJournal;
}

// Journal de diagnostic (FIAB-07) : lire, copier, partager, vider. Le texte est posé par textContent, jamais en HTML.
export function openJournal() {
  const m = modal(`<h2>Journal de diagnostic</h2>
    <p class="small">Ce journal reste sur ce téléphone. Après une sortie, envoyez-le à Romain (Copier ou Partager). Aucun code d’accès ni position n’y figure.</p>
    <pre id="diagText" class="diagtext"></pre>
    <div class="btns"><button type="button" class="btn small acc" id="diagCopy">Copier</button>${navigator.share ? '<button type="button" class="btn small alt" id="diagShare">Partager</button>' : ''}<button type="button" class="btn small alt" id="diagClear">Vider</button></div>`, 'journal');
  const pre = m.querySelector('#diagText'), copy = m.querySelector('#diagCopy'), clear = m.querySelector('#diagClear');
  let text = '';
  const fill = async () => { text = (await header()) + '\n\n' + (journal.text() || 'Journal vide'); pre.textContent = text; };
  fill();
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      // presse-papiers refusé : sélection du texte puis copie par l’ancienne méthode
      const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand?.('copy');
    }
    copy.textContent = 'Copié ✓';
  };
  m.querySelector('#diagShare')?.addEventListener('click', () => navigator.share({ title: 'Journal Rade Tactique', text }).catch(() => { /* partage annulé par l’équipier */ }));
  clear.onclick = async () => {
    if (clear.dataset.confirm !== '1') { clear.dataset.confirm = '1'; clear.textContent = 'Confirmer ?'; return; }
    journal.clear(); clear.dataset.confirm = ''; clear.textContent = 'Vider'; copy.textContent = 'Copier'; await fill();
  };
}

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
