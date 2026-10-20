// Script de l’arbitre de poche, sorti de regles.html sans changement (la CSP interdit les scripts en ligne).
// Arbitre de poche : envoie la question et les derniers échanges à /api/rules, affiche verdict, explication et règles citées
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const para = (t) => esc(t).split(/\n+/).filter(Boolean).map((l) => `<p>${l}</p>`).join('');
  const log = $('#chatLog'), input = $('#chatIn'), go = $('#chatGo');
  const history = [];
  const add = (cls, html) => { const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; log.appendChild(d); d.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return d; };
  const render = (a) => `<button type="button" class="say-btn" aria-label="Lire la réponse à voix haute" title="Lire à voix haute">🔊</button><div class="verdict">${esc(a.verdict)}</div>${para(a.explication)}
    ${(a.regles || []).map((r) => `<div class="rn">Règle ${esc(r.numero)} · ${esc(r.titre)}</div><div class="ref">
      <blockquote><span class="lg">FR</span>« ${esc(r.fr)} » (traduction)</blockquote>
      <blockquote class="en"><span class="lg">EN</span>« ${esc(String(r.en).replace(/\s+/g, ' ').trim())} »${r.verifie ? '' : ' <b style="font-style:normal;color:var(--accent)">à vérifier</b>'}</blockquote></div>`).join('')}
    ${a.ic ? `<div class="note"><b>IC CVAT :</b> ${esc(a.ic)}</div>` : ''}${a.attention ? `<div class="note"><b>Attention :</b> ${esc(a.attention)}</div>` : ''}`;
  async function ask(q) {
    q = q.trim(); if (!q || go.disabled) return;
    add('me', esc(q)); input.value = ''; go.disabled = true; $('#chatChips').hidden = true;
    const wait = add('bot', '<span class="dots">L’arbitre consulte les règles</span>');
    try {
      const r = await fetch('api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, history }) });
      const a = await r.json().catch(() => ({}));
      // 429 : quota du jour ou budget du mois, le serveur donne le message en français (affiché par textContent, borné)
      if (!r.ok) throw new Error(a.error === 'no_key' ? 'L’arbitre n’est pas configuré (clé OpenAI absente).' : r.status === 429 && typeof a.message === 'string' && a.message.trim() ? a.message.trim().slice(0, 300) : 'L’arbitre n’a pas pu répondre. Réessayez dans un instant.');
      wait.innerHTML = render(a);
      wait.querySelector('.say-btn').onclick = () => speak(`${a.verdict.replace(/[.\s]+$/, '')}. ${a.explication}${a.ic ? '. Instructions de course : ' + a.ic : ''}`);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: `${a.verdict} ${a.explication}` });
      history.splice(0, Math.max(0, history.length - 6));
    } catch (e) {
      wait.className = 'msg err';
      wait.textContent = navigator.onLine === false ? 'Pas de connexion : l’arbitre a besoin du réseau. Les fiches de cette page restent lisibles hors ligne.' : e.message;
    } finally { go.disabled = false; }
  }
  // lecture à voix haute (synthèse vocale du téléphone)
  function speak(text) {
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 1.05; speechSynthesis.speak(u); } catch { /* synthèse indisponible */ }
  }
  // dictée : le texte s'affiche pendant qu'on parle, on corrige si besoin puis « Demander »
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('#chatMic'), hint = $('#chatHint');
  let rec = null;
  const note = (t) => { hint.textContent = t; hint.hidden = !t; };
  const stopMic = () => { try { rec?.stop(); } catch { /* déjà arrêtée */ } };
  mic.addEventListener('click', () => {
    if (rec) return stopMic();
    if (!SR) { note('La dictée n’est pas disponible dans ce navigateur : touchez la zone de texte et utilisez le micro du clavier.'); input.focus(); return; }
    const base = input.value.trim() ? input.value.trim() + ' ' : '';
    let finals = '';
    rec = new SR(); rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finals += e.results[i][0].transcript + ' '; else interim += e.results[i][0].transcript;
      }
      input.value = (base + finals + interim).replace(/\s+/g, ' ').trimStart();
      input.scrollTop = input.scrollHeight;
    };
    rec.onerror = (e) => note(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Micro refusé : autorisez le micro pour ce site, ou utilisez le micro du clavier.' : e.error === 'no-speech' ? 'Rien entendu : touchez 🎤 et parlez.' : e.error === 'network' ? 'La dictée a besoin du réseau.' : e.error === 'aborted' ? '' : 'Dictée interrompue (' + e.error + ').');
    rec.onend = () => { rec = null; mic.classList.remove('rec'); mic.textContent = '🎤'; mic.setAttribute('aria-label', 'Dicter la question'); if (input.value.trim()) { input.value = input.value.trim(); hint.hidden || note(hint.textContent); } };
    try {
      speechSynthesis?.cancel?.();
      rec.start(); note('');
      mic.classList.add('rec'); mic.textContent = '■'; mic.setAttribute('aria-label', 'Arrêter la dictée');
    } catch { rec = null; note('Impossible de démarrer la dictée : utilisez le micro du clavier.'); }
  });
  $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); stopMic(); ask(input.value); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
  $('#chatChips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { stopMic(); ask(b.textContent); } });
  // le bouton flottant disparaît quand la zone de question est à l'écran
  const fab = $('#fab');
  new IntersectionObserver(([en]) => { fab.hidden = en.isIntersecting; }).observe($('#arbitre'));
  fab.addEventListener('click', () => setTimeout(() => input.focus({ preventScroll: true }), 400));
})();
