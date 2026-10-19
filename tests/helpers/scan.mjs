// Outils de lecture statique des sources (gardes de tests) : appariement d’accolades et de parenthèses sans se laisser tromper
// par les chaînes, les gabarits et les commentaires.

// Lit un bloc ouvert par `open` en src[from] jusqu’à son pendant, sans se laisser tromper par les chaînes, gabarits et commentaires.
// Rend { end, comment } : end = position du caractère fermant ; comment = texte des commentaires rencontrés.
export function scan(s, from, open, close) {
  let depth = 0, comment = '';
  for (let i = from; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { const e = s.indexOf('\n', i); const t = s.slice(i + 2, e < 0 ? s.length : e); comment += t; i = e < 0 ? s.length : e; continue; }
    if (c === '/' && n === '*') { const e = s.indexOf('*/', i + 2); comment += s.slice(i + 2, e < 0 ? s.length : e); i = e < 0 ? s.length : e + 1; continue; }
    if (c === '\'' || c === '"') { let j = i + 1; while (j < s.length && s[j] !== c && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1; i = j; continue; }
    if (c === '`') {
      let j = i + 1;
      while (j < s.length && s[j] !== '`') {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '$' && s[j + 1] === '{') { j = scan(s, j + 1, '{', '}').end + 1; continue; }
        j++;
      }
      i = j; continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return { end: i, comment };
  }
  return { end: s.length, comment };
}

// Corps (entre accolades) de la fonction `name` d’un source : `function name(`, `async function name(` ; null si absente
export function bodyOf(src, name) {
  const m = new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?function\\s*\\*?\\s*${name}\\s*\\(`).exec(src);
  if (!m) return null;
  const par = src.indexOf('(', m.index + m[0].length - 1), p = scan(src, par, '(', ')');
  const open = src.indexOf('{', p.end), { end } = scan(src, open, '{', '}');
  return src.slice(open + 1, end);
}
