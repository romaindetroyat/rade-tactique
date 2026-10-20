// Garde du guide de l’équipage (guide.html) : structure, autonomie hors réseau, phrases exigées ou interdites, exactitude des libellés.
// Aucun réseau ni navigateur : le guide est lu comme du texte et analysé avec linkedom. Le rendu sur téléphone est contrôlé par
// `node tools/regate-e2e.mjs guide`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';

const lire = (f) => readFileSync(ROOT + f, 'utf8');
const html = lire('guide.html');
const { document } = parseHTML(html);

// Les 17 sections, dans l’ordre du document : « En 1 minute », la journée de régate (7 temps), puis la référence (9 parties)
const SECTIONS = ['minute', 'installer', 'veille', 'matin', 'depart', 'course', 'apres', 'ailleurs', 'onglets', 'voyants', 'ia', 'archive', 'horsreseau', 'journal', 'reglages', 'depannage', 'limites'];
const espaces = (s) => String(s).replace(/\s+/g, ' ').trim();
const texte = espaces(document.body.textContent);

test('structure : page française pour téléphone, un seul titre, 17 sections dans l’ordre, ancres toutes résolues', () => {
  assert.equal(document.documentElement.getAttribute('lang'), 'fr');
  assert.equal(document.querySelectorAll('h1').length, 1, 'un seul h1');
  assert.ok(document.querySelector('meta[name=viewport]'), 'meta viewport');

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  assert.deepEqual(ids.filter((i) => SECTIONS.includes(i)), SECTIONS, 'les 17 sections, dans l’ordre');
  for (const id of SECTIONS) assert.equal(document.getElementById(id)?.tagName.toLowerCase(), 'section', `#${id} est une section`);

  const etapes = document.querySelectorAll('#minute ol > li');
  assert.ok(etapes.length >= 5, `« En 1 minute » : au moins 5 étapes numérotées (${etapes.length})`);

  const sommaire = document.querySelector('nav.sommaire'), barre = document.querySelector('nav.toc');
  assert.ok(sommaire && barre, 'sommaire détaillé et barre collante');
  assert.equal(sommaire.getAttribute('aria-label'), 'Sommaire détaillé');
  for (const s of document.querySelectorAll('section[id]')) {
    assert.ok(sommaire.querySelector(`a[href="#${s.id}"]`), `#${s.id} n’est pas dans le sommaire détaillé`);
    assert.ok(barre.querySelector(`a[href="#${s.id}"]`), `#${s.id} n’est pas dans la barre collante`);
  }
  assert.ok(barre.querySelector('a[href="regles.html"]'), 'la barre renvoie aux règles de course');

  for (const a of document.querySelectorAll('a[href^="#"]')) assert.ok(document.getElementById(a.getAttribute('href').slice(1)), `lien ${a.getAttribute('href')} sans destination`);
});

test('autonomie : aucun script, aucune ressource extérieure, page dans la liste hors réseau', () => {
  assert.equal(document.querySelectorAll('script, iframe, object, embed, link[rel~=stylesheet]').length, 0, 'ni script, ni cadre, ni feuille de style séparée');
  for (const el of document.querySelectorAll('[src], [href]')) {
    const v = el.getAttribute('src') ?? el.getAttribute('href');
    assert.ok(!/^(?:https?:)?\/\//i.test(v), `ressource extérieure : ${v}`);
  }
  for (const st of document.querySelectorAll('style')) {
    assert.ok(!/@import/i.test(st.textContent), '@import interdit');
    assert.ok(!/url\(\s*["']?\s*(?:https?:)?\/\//i.test(st.textContent), 'url() extérieur interdit');
  }
  assert.match(lire('sw.js'), /const SHELL = \[[^\]]*"guide\.html"/, 'guide.html est dans la liste hors réseau de sw.js');
});

// Phrases que la page doit contenir : celles de tests/regates.test.mjs (lecture hors réseau), puis les repères de l’archive, de l’IA et de la journée
const EXIGEES = [
  'Lire une régate hors réseau', 'Télécharger pour le hors réseau', 'six derniers mois et à venir', 'mode avion', '1 Mo par régate', 'sur ce téléphone', 'en ligne seulement', 'écran d’accueil',
  'Archive partagée', 'Historique', 'Désactiver la synchronisation', 'OpenAI ne garde pas les réponses', 'Limite d’IA du jour atteinte — reprise demain',
  'En 1 minute', 'Open GPX Tracker', 'Course finie',
  // repères de la rédaction : limites, verrous, IA, iPhone
  '25 nœuds', 'Ce qui ne s’échange pas pendant une course', 'Budget d’IA du mois atteint — l’IA reprend le mois prochain', '30 appels par équipier et par jour',
  'iOS 18.4', 'Verrouillage automatique', 'GR1 (3)', 'Carqueiranne (11)', 'Le Comité fait foi', 'Les voyants', 'Dépannage',
];
// Formules qui ne doivent jamais apparaître : [motif, raison]
const INTERDITES = [
  [/sur le téléphone qui les a|restent pour l’instant|viendra avec la version suivante|pas encore partagés/, 'plus de mention d’un partage à venir'],
  [/blob\.vercel|vercel-storage|\?acces=|rt_acces|BLOB_READ_WRITE_TOKEN/i, 'ni code d’accès, ni nom de cookie, ni adresse ou jeton du magasin'],
  [/\bne\s+(?:conserve|garde)\s+(?:rien|aucune?\s+donn)/i, 'jamais la promesse absolue que l’IA ne garde rien (docs/ia-budget.md)'],
  [/[0-9a-f]{64}/i, 'aucune empreinte de 64 caractères hexadécimaux'],
  [/naos-[\p{L}]+-[0-9a-z]{4}/iu, 'ni la forme du code personnel'],
  [/gpt|claude|opus|sonnet|haiku/i, 'aucun nom de modèle d’IA'],
];

test('phrases : repères exigés présents, formules interdites absentes', () => {
  for (const p of EXIGEES) assert.ok(texte.includes(p), `phrase exigée absente : « ${p} »`);
  for (const [motif, raison] of INTERDITES) assert.doesNotMatch(html, motif, raison);
});

// Libellés de l’app recopiés dans span.k : chacun doit exister tel quel dans le code (index.html, regles.html, acces.html, js/*.js, api/*.js).
// Comparaison sans tenir compte des espaces répétés, de U+FE0F, de la casse ni du style d’apostrophe.
const SOURCES = ['index.html', 'regles.html', 'acces.html',
  ...readdirSync(ROOT + 'js').filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
  ...readdirSync(ROOT + 'api').filter((f) => f.endsWith('.js')).map((f) => `api/${f}`)];
const norm = (s) => espaces(String(s).replace(/️/g, '').replace(/[’‘]/g, '\'')).toLowerCase();
const CODE = norm(SOURCES.map(lire).join('\n'));
// Exceptions (cinq au plus) : un signe dessiné par la feuille de style plutôt que écrit dans le code ; chaque entrée dit d’où il vient.
const EXCEPTIONS = [];

test('exactitude : chaque libellé en style touche (span.k) existe dans le code de l’app', () => {
  assert.ok(EXCEPTIONS.length <= 5, 'cinq exceptions au plus');
  const touches = [...document.querySelectorAll('span.k')];
  assert.ok(touches.length > 0, 'le guide cite des libellés de l’app');
  const absents = touches.map((el) => espaces(el.textContent)).filter((t) => !t || (!CODE.includes(norm(t)) && !EXCEPTIONS.includes(t)));
  assert.deepEqual([...new Set(absents)], [], 'libellés introuvables dans le code (à écrire en <b> si ce n’est pas un libellé de l’app)');
});

test('texte visible : apostrophe typographique partout', () => {
  const m = /\p{L}'\p{L}/u.exec(document.body.textContent);
  assert.equal(m, null, m && `apostrophe droite dans « ${document.body.textContent.slice(Math.max(0, m.index - 20), m.index + 20)} »`);
});

// Messages que l’app affiche et que le guide cite : chacun doit être écrit dans le guide ET retrouvé tel quel dans le code (index.html, js/*.js, api/*.js…).
const MESSAGES_DE_L_APP = [
  'Limite d’IA du jour atteinte — reprise demain', 'Budget d’IA du mois atteint — l’IA reprend le mois prochain', 'L’IA est très sollicitée — réessayez dans un instant',
  'À jour', 'Pas encore synchronisé', 'En attente d’envoi', 'En pause pendant la course', 'Archive non configurée', 'Synchronisation à relancer', 'Plafond du jour atteint · reprise demain',
  'Code d’accès à renouveler', 'Mettez l’app à jour pour synchroniser', 'Synchronisation désactivée', 'Toucher encore pour désactiver',
  'Course en cours : mise à jour reportée', 'Course en cours : synchronisation après la course', 'Journée de régate : téléchargement au retour au port', 'Course finie notée',
  'Déjà importée', 'Chrono repris — touchez l’écran pour réactiver le son', 'Code non reconnu. Vérifiez-le ou demandez-le à Romain.', 'Avez-vous entendu 3 bips ?',
  'Ligne non pinguée', 'Vent à relever (⚙)', 'Comité pingué ✓', 'Comité : position théorique', 'Une précision', 'figé après le départ', 'position à saisir', 'Votre code personnel',
  'Écran non maintenu : réglez Verrouillage automatique sur « Jamais » pendant la course', 'Son coupé — touchez pour réactiver', 'Bips non entendus au test — le flash visuel reste actif', 'Son non testé',
  'Hors ligne — prévisions du', 'Laisser sans régate', 'Confirmer la suppression', 'Copié ✓', 'Confirmer ?',
];

test('messages : chaque message cité par le guide est celui de l’app', () => {
  const absentsDuGuide = MESSAGES_DE_L_APP.filter((m) => !texte.includes(m));
  assert.deepEqual(absentsDuGuide, [], 'messages absents du guide');
  const absentsDuCode = MESSAGES_DE_L_APP.filter((m) => !CODE.includes(norm(m)));
  assert.deepEqual(absentsDuCode, [], 'messages introuvables dans le code de l’app : le guide les invente ou l’app a changé');
});

// Inventaire des boutons de l’app (extrait des <button> de js/*.js, index.html et regles.html le 2026-10-20) : chacun figure dans le guide en style touche.
const BOUTONS = [
  '+1 min', '−1 min', '+5°', '−5°', '+10°', '−10°', '1 min', '4 min', '5 min', 'Ajouter la manche', 'Analyser', 'Annuler', 'Arrondir', 'Arrondir à la minute', 'Arrêter le GPS', 'Arrêter le chrono',
  'Bips', 'Bouée ici', 'Chiffres', 'Choisir cette manche', 'Comité ici', 'Confirmer', 'Continuer', 'Copier', 'Créer la régate', 'Détacher', 'Enregistrer le relevé', 'Exporter GPX', 'Fermer', 'GPX',
  'Ignorer', 'Ligne', 'Ligne théorique', 'Marque passée ▶', '◀ Marque précédente', 'Masquer', 'Modifier', 'OK', 'Partager', 'Partager le rapport', 'Partager… (WhatsApp, Messages)', 'Plein soleil',
  'Plein écran', 'Polaire par défaut', 'Position d’origine', 'Ranger…', 'Recaler', 'Relevé de vent ici…', 'Relevés', 'Revenir au plan initial', 'Règles du départ (P, I, U, Z, noir)', 'Stop',
  'Supprimer cette régate', 'Synchroniser', 'Top 1’', 'Top 4’', 'Top 5’ (avertissement)', 'Télécharger pour le hors réseau', 'Valider', 'Valider les IC', 'Vider', 'Voir', 'Voir la trace',
  'Voir sur la carte', 'Voix', '↻ Recalculer', '↻ Recalculer la suite depuis ma position', '⏹ Arrêter et enregistrer', '⏺ Enregistrer ma trace', '▶ Activer le GPS', '▶ Animer le parcours',
  '▶ Rejouer la trace', '⚙', '⚡ Flash visuel', '⤓ Importer un fichier GPX', '＋ Ajouter une manche', '＋ Nouvelle régate', '🎤', '🏁 Course finie — retour au port', '📄 Voir le débrief',
  '📍 Ping Bouée (GPS)', '📍 Ping Comité (GPS)', '🔊 Tester le son', '🔓',
  // boutons dont le libellé est construit dans le code
  'Débrief de course', 'Refaire le débrief de course', 'Débrief', 'Corriger la position', 'Saisir la position', 'Lire avec l’IA (le texte part chez OpenAI)', 'Désactiver la synchronisation',
  'Réactiver la synchronisation', '＋ Importer des IC (PDF)', 'Caler le départ sur ces IC', 'Mettre à jour', 'Journal de diagnostic', 'Oui, entendus', 'Non', 'Près tribord', 'Près bâbord', 'Compas',
  'GPS → étrave', 'Aide', 'Relancer', 'Réessayer', 'Réactiver', 'Vérifier', '🔒', 'BOUÉE', 'COMITÉ', 'DÉPART 5’', 'SYNCHRO', '⟳', '⤴', '?', '2D', '3D', '⌖', '◎', '☰', '⏸', '×½', '×1', '×2', '×4',
];

test('couverture : chaque bouton de l’app figure dans le guide, en style touche', () => {
  const dansLeGuide = new Set([...document.querySelectorAll('span.k')].map((el) => norm(el.textContent)));
  const manquants = BOUTONS.filter((b) => !dansLeGuide.has(norm(b)));
  assert.deepEqual(manquants, [], 'boutons de l’app absents du guide');
  const inconnus = BOUTONS.filter((b) => !CODE.includes(norm(b)));
  assert.deepEqual(inconnus, [], 'boutons de l’inventaire introuvables dans le code (inventaire à corriger)');
});
