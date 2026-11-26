// PDF texte minimal fabriqué pour les essais (08-11, D-16) : jamais un document réel. Aucune dépendance : PDF 1.4, pages A4 de 45 lignes
// au plus, police Helvetica en codage WinAnsi, parenthèses et barres obliques inverses échappées, table xref aux décalages exacts.
// Un caractère absent de WinAnsi lève une erreur qui le nomme (’ « » – — ° é è à ç ô œ sont acceptés).

const LIGNES_PAGE = 45;
// WinAnsi : ASCII imprimable, Latin-1 (U+00A0 à U+00FF à la même valeur) et les signes de 0x80 à 0x9F
const SPECIAUX = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};
function octet(c) {
  const u = c.codePointAt(0);
  if ((u >= 0x20 && u <= 0x7e) || (u >= 0xa0 && u <= 0xff)) return u;
  if (Object.hasOwn(SPECIAUX, c)) return SPECIAUX[c];
  throw new Error(`caractère absent du codage WinAnsi : « ${c} » (U+${u.toString(16).toUpperCase().padStart(4, '0')})`);
}
// Chaîne littérale PDF (octets WinAnsi) : ( ) \ échappés
function litteral(ligne) {
  const out = [0x28];
  for (const c of String(ligne)) {
    const b = octet(c);
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c);
    out.push(b);
  }
  out.push(0x29);
  return out;
}
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

// lignes : tableau de textes (une ligne de texte par élément) → Uint8Array d’un PDF lisible par pdf.js
export function pdfMinimal(lignes) {
  const liste = Array.isArray(lignes) && lignes.length ? lignes.map(String) : [''];
  const pages = [];
  for (let i = 0; i < liste.length; i += LIGNES_PAGE) pages.push(liste.slice(i, i + LIGNES_PAGE));
  // objets : 1 catalogue, 2 arbre des pages, 3 police, puis pour chaque page : la page et son contenu
  const objets = [];
  const ref = (n) => `${n} 0 R`;
  const idsPages = pages.map((_, k) => 4 + 2 * k);
  objets[1] = ascii('<< /Type /Catalog /Pages 2 0 R >>');
  objets[2] = ascii(`<< /Type /Pages /Kids [${idsPages.map(ref).join(' ')}] /Count ${pages.length} >>`);
  objets[3] = ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pages.forEach((texte, k) => {
    const flux = [...ascii('BT /F1 11 Tf 14 TL 50 800 Td\n')];
    for (const l of texte) flux.push(...litteral(l), ...ascii(' Tj T*\n'));
    flux.push(...ascii('ET\n'));
    const idP = idsPages[k], idC = idP + 1;
    objets[idP] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${ref(idC)} >>`);
    objets[idC] = [...ascii(`<< /Length ${flux.length} >>\nstream\n`), ...flux, ...ascii('endstream')];
  });
  const octets = [...ascii('%PDF-1.4\n'), 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a];
  const decalages = [];
  for (let n = 1; n < objets.length; n++) {
    decalages[n] = octets.length;
    octets.push(...ascii(`${n} 0 obj\n`), ...objets[n], ...ascii('\nendobj\n'));
  }
  const xref = octets.length;
  let table = `xref\n0 ${objets.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objets.length; n++) table += `${String(decalages[n]).padStart(10, '0')} 00000 n \n`;
  table += `trailer\n<< /Size ${objets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  octets.push(...ascii(table));
  return Uint8Array.from(octets);
}

// IC d’essai de Bormes (08-11, D-16) : fabriquées pour les essais, aucun nom de personne. Trois bouées en mer autour de 43,12° N 6,39° E,
// une porte de deux bouées, une arrivée entre le bateau comité et une bouée, et une bouée dont la position est dans la rade de Toulon
// (Echo) : elle doit rester « position à saisir » dans une régate de Bormes.
export const IC_ESSAI = Object.freeze([
  'INSTRUCTIONS DE COURSE',
  'Régate d’essai du Lavandou',
  'Club d’essai — baie de Bormes – Le Lavandou',
  'dimanche 6 décembre 2026',
  '1. RÈGLES',
  'La régate est régie par les règles telles que définies dans les Règles de Course à la Voile.',
  '2. PROGRAMME',
  'Heure du premier signal d’avertissement : 11:00',
  'Aucun signal d’avertissement ne sera fait après 16:00.',
  '3. COMMUNICATION',
  'Canal VHF 72 pendant toute la durée de la course.',
  '4. ZONE DE COURSE',
  'Baie de Bormes, au large de La Fourmigue (« zone d’essai »).',
  '5. BOUÉES',
  'Bouée Alpha : 43°07,200 N – 006°24,000 E',
  'Bouée Bravo : 43°06,600 N – 006°23,400 E',
  'Bouée Charlie : 43°06,600 N – 006°23,700 E',
  'Bouée Delta : 43°07,800 N – 006°23,700 E',
  'Bouée Echo : 43°05,845 N – 005°56,049 E',
  '6. PARCOURS',
  'Parcours d’essai : départ, Alpha à bâbord, porte Bravo / Charlie, arrivée.',
  '7. ARRIVÉE',
  'La ligne d’arrivée est entre le bateau comité et la bouée Delta.',
  '8. PÉNALITÉS',
  'Pénalité : un tour, y compris un virement et un empannage.',
  '9. SÉCURITÉ',
  'Tout concurrent qui abandonne doit en informer le comité de course sur le canal VHF (canal 72).',
  'Le port du gilet de sauvetage est recommandé ; température de l’eau environ 14 °C.',
]);
