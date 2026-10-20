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
