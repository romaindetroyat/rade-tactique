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
