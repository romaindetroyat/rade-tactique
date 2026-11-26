// Script de la page d’accès, sorti de acces.html sans changement (la CSP interdit les scripts en ligne).
  const q = new URLSearchParams(location.search);
  // retour seulement vers une page du site
  const suite = /^\/(?!\/)/.test(q.get('suite') || '') ? q.get('suite') : '/';
  if (q.get('erreur')) document.getElementById('err').hidden = false;
  document.getElementById('f').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('code').value.trim().toLowerCase();
    if (code) location.href = suite + (suite.includes('?') ? '&' : '?') + 'acces=' + encodeURIComponent(code);
  });
  // Espace Tofinou (phase 8, D-07) : sur ses hôtes, la page porte le nom de l’espace ; partout ailleurs, les textes de acces.html restent tels quels.
  // Hôtes recopiés de js/espaces.js (acces.js n’importe aucun module) : test de parité dans tests/espaces.test.mjs.
  {
    const HOTES_TOFINOU = ['tofinou-bormes.vercel.app', 'tofinou.localhost'];
    if (HOTES_TOFINOU.includes(location.hostname.toLowerCase())) {
      document.title = 'Tofinou — Bormes · Accès';
      document.querySelector('h1').textContent = 'Tofinou — Bormes';
      document.querySelector('main > p').textContent = 'Application réservée à l’équipage du Tofinou — Bormes.';
      document.getElementById('code').placeholder = 'votre code personnel';
    }
  }
