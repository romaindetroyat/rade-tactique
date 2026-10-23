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
  'Entraînement libre', 'Aucune régate ouverte', 'En préparation', 'Terminées', 'Fermer la régate', 'ne change rien chez les autres',
  '25 nœuds', 'Ce qui ne s’échange pas pendant une course', 'Budget d’IA du mois atteint — l’IA reprend le mois prochain', '30 appels par équipier et par jour',
  'iOS 18.4', 'Verrouillage automatique', 'GR1 (3)', 'Carqueiranne (11)', 'Le Comité fait foi', 'Les voyants', 'Dépannage',
  // repères de la phase 6 (D-11) : banane, porte conseillée, arrivées décalées, porte et arrivée d’un autre club
  'Banane (construite)', 'Porte sous le vent', 'bouées équivalentes', 'Au vent, décalée', 'Sous le vent, décalée', 'porte : bouée prise', 'Arrivée : entre le Comité et',
  'celles de la porte et de l’arrivée comprises', 'Passez les trois téléphones en v38 avant la régate CVAT',
];
// Formules qui ne doivent jamais apparaître : [motif, raison]
const INTERDITES = [
  [/sur le téléphone qui les a|restent pour l’instant|viendra avec la version suivante|pas encore partagés/, 'plus de mention d’un partage à venir'],
  [/blob\.vercel|vercel-storage|\?acces=|rt_acces|BLOB_READ_WRITE_TOKEN/i, 'ni code d’accès, ni nom de cookie, ni adresse ou jeton du magasin'],
  [/\bne\s+(?:conserve|garde)\s+(?:rien|aucune?\s+donn)/i, 'jamais la promesse absolue que l’IA ne garde rien (docs/ia-budget.md)'],
  [/[0-9a-f]{64}/i, 'aucune empreinte de 64 caractères hexadécimaux'],
  [/naos-[\p{L}]+-[0-9a-z]{4}/iu, 'ni la forme du code personnel'],
  [/gpt|claude|opus|sonnet|haiku/i, 'aucun nom de modèle d’IA'],
  [/régate courante/i, 'libellé retiré en v37 : régate ouverte'],
  [/Aujourd’hui, À venir, Passée/, 'ancien classement de la liste'],
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
  'Aucune régate ouverte', 'Entraînement libre', 'Retour à l’entraînement libre',
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
  'Réactiver la synchronisation', 'Ouvrir', 'Ouvrir une régate', 'Fermer la régate', '＋ Importer des IC (PDF)', 'Caler le départ sur ces IC', 'Mettre à jour', 'Journal de diagnostic', 'Oui, entendus', 'Non', 'Près tribord', 'Près bâbord', 'Compas',
  'GPS → étrave', 'Aide', 'Relancer', 'Réessayer', 'Réactiver', 'Vérifier', '🔒', 'BOUÉE', 'COMITÉ', 'DÉPART 5’', 'SYNCHRO', '⟳', '⤴', '?', '2D', '3D', '⌖', '◎', '☰', '⏸', '×½', '×1', '×2', '×4',
];

test('couverture : chaque bouton de l’app figure dans le guide, en style touche', () => {
  const dansLeGuide = new Set([...document.querySelectorAll('span.k')].map((el) => norm(el.textContent)));
  const manquants = BOUTONS.filter((b) => !dansLeGuide.has(norm(b)));
  assert.deepEqual(manquants, [], 'boutons de l’app absents du guide');
  const inconnus = BOUTONS.filter((b) => !CODE.includes(norm(b)));
  assert.deepEqual(inconnus, [], 'boutons de l’inventaire introuvables dans le code (inventaire à corriger)');
});

// ───────────────────────── aide intégrée (js/help.js et deux bulles de js/app.js) : cohérente avec le guide et avec le code
const AIDE = lire('js/help.js'), APP = lire('js/app.js');
const bulle = (titre) => { const m = new RegExp(`${titre} \\$\\{tip\\('((?:[^'\\\\]|\\\\.)*)'\\)\\}`).exec(APP); assert.ok(m, `bulle « ${titre} » introuvable dans js/app.js`); return m[1]; };
const BULLE_REGATES = bulle('Régates'), BULLE_TRACES = bulle('Mes traces');
const guideAide = /export const GUIDE = `([\s\S]*?)`;/.exec(AIDE)?.[1] ?? '';
const syncTip = /export const SYNC_TIP = '((?:[^'\\]|\\.)*)'/.exec(AIDE)?.[1] ?? '';
const bullesFixes = /const STATIC_TIPS = \{([\s\S]*?)\n\};/.exec(AIDE)?.[1] ?? '';
const aideTexte = espaces(`${guideAide} ${syncTip} ${bullesFixes} ${BULLE_REGATES} ${BULLE_TRACES}`.replace(/<[^>]+>/g, ''));

test('aide intégrée : plus de formule périmée, repères de la v32 présents', () => {
  assert.ok(guideAide.length > 1000 && syncTip && bullesFixes, 'GUIDE, SYNC_TIP et STATIC_TIPS lus');
  assert.ok(!APP.includes('Elles restent sur cet appareil'), 'bulle « Mes traces » : plus de « Elles restent sur cet appareil »');
  assert.doesNotMatch(BULLE_REGATES, /Passées/, 'bulle Régates : plus l’ancien libellé « Passées »');
  assert.doesNotMatch(BULLE_REGATES, /Passée/, 'bulle Régates : plus l’ancien libellé « Passée »');
  assert.match(BULLE_REGATES, /En préparation, En cours, Terminées/);
  assert.match(BULLE_TRACES, /partagées avec l’équipage/);
  assert.doesNotMatch(guideAide, /résumés du vent du jour/, 'le partage ne se résume plus au vent du jour');
  assert.match(guideAide, /vent du jour figé, traces, débriefs et rapports sont partagés/);
  for (const p of ['Tester le son', 'Course finie', 'Mettre à jour', 'reprise demain', 'Mode départ plein écran', 'Top 5’', 'Top 4’', 'Top 1’', 'GPS, ÉCRAN, SON et RÉSEAU',
    '30 appels', 'Open GPX Tracker', '25 nœuds', 'Arrêter le GPS', 'Pas encore synchronisé', 'Synchronisation à relancer', 'Plafond du jour atteint · reprise demain',
    'Code d’accès à renouveler', 'Mettez l’app à jour pour synchroniser', 'premier jour de la régate ouverte', 'Entraînement libre', 'Fermer la régate',
    'Banane (construite)', 'Porte sous le vent', 'bouées équivalentes', 'porte : bouée prise']) assert.ok(aideTexte.includes(p), `l’aide ne cite pas « ${p} »`);
  assert.ok(AIDE.includes('href="guide.html#minute"'), 'le lien du guide complet ouvre « En 1 minute »');
  assert.ok(document.getElementById('minute'), 'l’ancre #minute existe dans guide.html');
  assert.doesNotMatch(aideTexte, /blob\.vercel|vercel-storage|\?acces=|rt_acces|BLOB_READ_WRITE_TOKEN|gpt|claude|opus|sonnet|haiku/i, 'ni code, ni cookie, ni adresse, ni nom de modèle');
  assert.doesNotMatch(aideTexte, /régate courante/i, 'libellé retiré en v37 : régate ouverte');
});

// Entre guillemets français : un libellé ou un message de l’app (à retrouver dans le code) ou un exemple/menu système (listé ici avec sa raison)
const CITATIONS_LIBRES = [
  // phrases dictées en exemple dans la rubrique « Relevé de vent »
  'ça refuse d’une dizaine de degrés et ça mollit un peu', 'mistral 18 nœuds avec des rafales à 24', '290 12',
  // menus d’iOS et d’Android, pas de l’app
  'Sur l’écran d’accueil', 'Installer l’application',
  // « n » remplace le nombre de modifications
  'Hors réseau · n modifications en attente',
];
test('aide intégrée : chaque libellé entre guillemets existe dans l’app', () => {
  const hors = norm(SOURCES.filter((f) => f !== 'js/help.js').map(lire).join('\n'));
  const cites = [...new Set([...`${guideAide} ${syncTip} ${bullesFixes} ${BULLE_REGATES} ${BULLE_TRACES}`.replace(/<[^>]+>/g, '').matchAll(/«\s*([^»]+?)\s*»/g)].map((m) => m[1]))];
  assert.ok(cites.length > 10, `citations lues (${cites.length})`);
  const absentes = cites.filter((c) => !CITATIONS_LIBRES.includes(c) && !hors.includes(norm(c)));
  assert.deepEqual(absentes, [], 'libellés cités par l’aide et introuvables dans le code');
  for (const c of CITATIONS_LIBRES.slice(3, 5)) assert.ok(aideTexte.includes(c));
});

// ───────────────────────── GPS laissé seul après la course (261020-sec, P-03) : le guide et l’aide disent la même procédure que le code
test('retour au port : le guide (#apres et la carte « Rentrer au port ») et l’aide disent que le GPS allumé d’office s’arrête de lui-même', () => {
  const apres = espaces(document.getElementById('apres').textContent);
  assert.match(apres, /s’arrête de lui-même/, '#apres : le GPS allumé par le mode départ ou la trace s’arrête de lui-même');
  assert.match(apres, /Arrêter le GPS/, '#apres garde « Arrêter le GPS » pour le GPS allumé à la main');
  const carte = [...document.querySelectorAll('h3')].find((h) => /Rentrer au port/.test(h.textContent))?.parentElement;
  assert.ok(carte, 'la carte « Rentrer au port : dans cet ordre »');
  const cTexte = espaces(carte.textContent);
  assert.match(cTexte, /s’arrête de lui-même/);
  assert.match(cTexte, /Arrêter le GPS/);
  assert.match(cTexte, /plus de 3 h/, 'un chrono jamais arrêté garde le GPS');
  assert.match(cTexte, /un chrono, une trace, le mode départ ou un GPS tournent/, 'la raison : tant que l’un d’eux tourne, l’app se croit en course');
  assert.match(aideTexte, /s’arrête de lui-même/, 'l’aide intégrée dit la même chose');
  assert.match(aideTexte, /Arrêter le GPS\s*\(sinon l’app se croit encore en course\)/, 'l’aide garde « Arrêter le GPS » pour le GPS allumé à la main');
});
