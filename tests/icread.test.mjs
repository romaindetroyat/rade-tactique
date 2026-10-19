// Relecture des IC champ par champ (REG-03, D-02, D-03, D-06) : depuis parseIC (texte SNPM et texte fabriqué d’un autre club), champ non lu
// laissé vide, rien d’écrit sans validation, règle du dernier jour (D-15), blocage par une valeur impossible, vue sans injection (linkedom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT, fixture } from './helpers/setup.mjs';
import { parseIC } from '../js/events.js';
import { createRegatta } from '../js/regates.js';
import {
  FIELDS, NOT_READ, IA_IC, checksFor, reviewFromParse, reviewFromRegatta, reviewFromApi, setValue, setKeep, setKeepRace, canValidate, applyReview, reviewHTML, chipOf, validatedHTML,
  icLooksCvat, cvatReadOk, textTooThin, iaOffer, iaErrorMessage,
} from '../js/icread.js';

const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const champ = (rv, k) => rv.fields.find((f) => f.key === k);
const val = (rv, k) => champ(rv, k).value;

// D-06 : aucun PDF d’un autre club ; ce texte reprend la forme des IC SNPM (club renommé, « 10:55 » au lieu de « 10h55 », « VHF 69 »),
// paragraphes séparés par des lignes vides comme dans le texte extrait du PDF réel
const AUTRE_CLUB = `Instructions de Course

Coupe de la Société Nautique de Marseille Sud

dimanche 18 octobre 2026

5. PROGRAMME DES COURSES dimanche 18 octobre 2026

5.1 Heure du premier signal d’avertissement : 10:55

5.2 Heure limite du signal d’arrivée du premier : 16:00

7. DEFINITION DE L’EMPLACEMENT DE LA ZONE DE COURSE

de la rade de Marseille, au large de la Pointe Rouge

17.3 Canal de vacation Radio : VHF 69

Président du comité de course : Marie DUPONT

Téléphone ou sms : 06 12 34 56 78

Fin des informations générales.

Tout concurrent qui abandonne doit en informer le comité de course sur le canal VHF dans les plus brefs délais.
`;
const relecture = () => reviewFromParse(parseIC(AUTRE_CLUB, 'ic-marseille.pdf'), { source: 'ic-marseille.pdf' });
const regate = () => createRegatta({ name: 'Régate test', dateStart: '2026-10-18', club: 'CVAT' }, { now: 1000, by: 'Teiva' }).regatta;

test('relecture depuis parseIC d’un texte d’un autre club : une valeur, son extrait, pour chaque champ lu', () => {
  const rv = relecture();
  assert.equal(rv.read, 'motifs'); assert.equal(rv.source, 'ic-marseille.pdf');
  assert.deepEqual(rv.fields.map((f) => f.key), FIELDS.map((f) => f.key));
  assert.equal(val(rv, 'event'), 'Coupe de la Société Nautique de Marseille Sud');
  assert.equal(val(rv, 'dateStart'), '2026-10-18');
  assert.equal(val(rv, 'firstWarning'), '10:55');
  assert.equal(val(rv, 'lastFinishSignal'), '16:00');
  assert.equal(val(rv, 'vhf'), '69');
  assert.equal(val(rv, 'committee'), 'Marie DUPONT — tél. 06 12 34 56 78');
  assert.equal(val(rv, 'zone'), 'de la rade de Marseille, au large de la Pointe Rouge');
  assert.match(champ(rv, 'firstWarning').excerpt, /10:55/);
  assert.match(champ(rv, 'vhf').excerpt, /VHF 69/);
  assert.match(champ(rv, 'dateStart').excerpt, /18 octobre 2026/);
  assert.match(champ(rv, 'zone').excerpt, /Pointe Rouge/);
  assert.ok(rv.keyRules.length >= 1, 'au moins un point clé lu');
  assert.ok(rv.keyRules.some((k) => /abandonne/.test(k.value)));
  assert.ok(rv.keyRules.every((k) => k.keep === true), 'les points clés lus sont cochés au départ');
  assert.match(rv.text, /Marie DUPONT/);
  for (const f of rv.fields) assert.equal(f.edited, false);
});

test('champ non lu : valeur vide et extrait nul (jamais deviné) ; le dernier jour n’est pas lu par les motifs', () => {
  const rv = reviewFromParse(parseIC('Texte sans rien de reconnaissable à lire ici.', 'Mon fichier_IC.pdf'), { source: 'x.pdf' });
  for (const k of ['dateStart', 'dateEnd', 'firstWarning', 'lastFinishSignal', 'vhf', 'zone']) {
    assert.equal(val(rv, k), '', `${k} doit rester vide`);
    assert.equal(champ(rv, k).excerpt, null, `${k} : pas d’extrait`);
  }
  assert.equal(val(rv, 'committee'), '');
  assert.equal(val(rv, 'event'), 'Mon fichier IC', 'le titre vient du nom de fichier, comme avant');
  assert.equal(champ(rv, 'event').excerpt, null, 'le nom de fichier n’est pas un extrait');
  assert.equal(rv.keyRules.length, 0);
  const html = reviewHTML(rv);
  assert.equal((html.match(new RegExp(NOT_READ, 'g')) || []).length, 6 + 1, 'sept champs vides le disent (dont le dernier jour et le Comité)');
});

test('le dernier jour de la régate courante est repris (le PDF ne le donne pas), sans extrait', () => {
  const r = { ...regate(), dateEnd: '2026-10-20' };
  const rv = reviewFromParse(parseIC(AUTRE_CLUB, 'a.pdf'), { source: 'a.pdf', regatta: r });
  assert.equal(val(rv, 'dateEnd'), '2026-10-20'); assert.equal(champ(rv, 'dateEnd').excerpt, null);
  assert.equal(applyReview(r, rv, { by: 'T', at: 1 }).dateEnd, '2026-10-20');
});

test('rien n’entre sans validation : la relecture ne touche pas la régate, applyReview rend un objet neuf', () => {
  const r = deepFreeze(regate());
  const rv = deepFreeze(relecture());
  const avant = JSON.stringify(r);
  const suivant = applyReview(r, rv, { by: 'Thibaud', at: 1234 });
  assert.equal(JSON.stringify(r), avant, 'la régate d’origine n’est pas modifiée');
  assert.equal(r.ic, null);
  assert.notEqual(suivant, r);
  assert.deepEqual(suivant.ic.validated, { by: 'Thibaud', at: 1234 }, 'qui a validé et quand');
  assert.equal(suivant.name, 'Coupe de la Société Nautique de Marseille Sud');
  assert.equal(suivant.dateStart, '2026-10-18'); assert.equal(suivant.season, '2026');
  assert.deepEqual(suivant.ic.fields.vhf, 69, 'VHF : entier');
  assert.equal(suivant.ic.fields.firstWarning, '10:55');
  assert.equal(suivant.ic.fields.zone, 'de la rade de Marseille, au large de la Pointe Rouge');
  assert.equal(suivant.ic.read, 'motifs'); assert.equal(suivant.ic.source, 'ic-marseille.pdf');
  assert.match(suivant.ic.excerpts.firstWarning, /10:55/);
  assert.ok(suivant.ic.excerpts.vhf && suivant.ic.excerpts.zone);
  assert.ok(!('dateEnd' in suivant.ic.excerpts), 'pas d’extrait pour un champ sans extrait');
  assert.equal(suivant.ic.fields.keyRules.length, rv.keyRules.length);
});

test('applyReview n’écrit que les champs validés : un champ vidé ne garde ni valeur ni extrait, un point clé décoché disparaît', () => {
  let rv = relecture();
  rv = setValue(rv, 'vhf', ''); rv = setValue(rv, 'zone', '   '); for (let i = 0; i < rv.keyRules.length; i++) rv = setKeep(rv, i, false);
  const r = applyReview(regate(), rv, { by: null, at: 5 });
  assert.equal(r.ic.fields.vhf, null);
  assert.equal(r.ic.fields.zone, '');
  assert.ok(!('vhf' in r.ic.excerpts) && !('zone' in r.ic.excerpts), 'extraits des seuls champs gardés');
  assert.deepEqual(r.ic.fields.keyRules, []);
  assert.deepEqual(r.ic.validated, { by: null, at: 5 }, 'auteur inconnu : complété plus tard (backfillAuthor)');
  // une valeur corrigée à la main n’est plus décrite par l’extrait d’origine
  const corrige = applyReview(regate(), setValue(relecture(), 'firstWarning', '11:00'), { by: 'T', at: 6 });
  assert.equal(corrige.ic.fields.firstWarning, '11:00');
  assert.ok(!('firstWarning' in corrige.ic.excerpts));
  // retaper la valeur d’origine rend l’extrait
  const retape = setValue(setValue(relecture(), 'firstWarning', '11:00'), 'firstWarning', '10:55');
  assert.equal(champ(retape, 'firstWarning').edited, false);
});

test('règle du dernier jour (D-15) : antérieur ou égal ignoré, postérieur gardé', () => {
  const deux = (fin) => applyReview(regate(), setValue(relecture(), 'dateEnd', fin), { by: 'T', at: 1 });
  assert.equal(deux('2026-10-17').dateEnd, '', 'antérieur : ignoré');
  assert.equal(deux('2026-10-18').dateEnd, '', 'égal : ignoré');
  assert.equal(deux('2026-10-20').dateEnd, '2026-10-20', 'postérieur : gardé');
  assert.equal(deux('').dateEnd, '', 'vide : une régate d’un seul jour');
  assert.equal(deux('2026-02-30').dateEnd, '', 'date impossible : jamais écrite');
  // une date de début vide ne retire pas son jour à la régate
  const sansDebut = applyReview(regate(), setValue(relecture(), 'dateStart', ''), { by: 'T', at: 1 });
  assert.equal(sansDebut.dateStart, '2026-10-18');
  // un nom vidé garde le nom de la régate
  assert.equal(applyReview(regate(), setValue(relecture(), 'event', ''), { by: 'T', at: 1 }).name, 'Régate test');
});

test('applyReview garde les champs que la relecture ne porte pas (pavillons, séquence)', () => {
  const r = { ...regate(), ic: { fields: { sequence: [['x']], keyRules: ['ancien'], vhf: 72 }, excerpts: {}, text: 'ancien', source: 'a.pdf', read: 'reprise', validated: { by: 'R', at: 1 } } };
  const rv = reviewFromRegatta(r);
  assert.equal(rv.read, 'reprise'); assert.equal(val(rv, 'vhf'), '72');
  const suivant = applyReview(r, rv, { by: 'Thibaud', at: 9 });
  assert.deepEqual(suivant.ic.fields.sequence, [['x']]);
  assert.equal(suivant.ic.fields.vhf, 72); assert.equal(suivant.ic.text, 'ancien'); assert.equal(suivant.ic.read, 'reprise');
  assert.deepEqual(suivant.ic.fields.keyRules, ['ancien']);
  assert.deepEqual(suivant.ic.validated, { by: 'Thibaud', at: 9 });
});

test('« Modifier » : la relecture d’une régate sans IC est une saisie à la main, vide ; sans régate aussi', () => {
  const rv = reviewFromRegatta(regate());
  assert.equal(rv.read, 'saisie'); assert.equal(val(rv, 'event'), 'Régate test'); assert.equal(val(rv, 'dateStart'), '2026-10-18'); assert.equal(val(rv, 'vhf'), '');
  const aucune = reviewFromRegatta(null);
  assert.equal(aucune.read, 'saisie'); assert.equal(val(aucune, 'event'), ''); assert.equal(aucune.fields.length, FIELDS.length);
});

test('canValidate : faux avec un contrôle bad sur une valeur non vide, vrai si la valeur est vidée ; warn n’empêche rien', () => {
  let rv = setValue(relecture(), 'vhf', '99');
  const checks = { vhf: { level: 'bad', msg: 'canal VHF impossible (1 à 88)' }, firstWarning: { level: 'warn', msg: 'inhabituel' } };
  assert.equal(canValidate(rv, checks), false);
  rv = setValue(rv, 'vhf', '');
  assert.equal(canValidate(rv, checks), true, 'vidée : la valeur impossible ne bloque plus');
  assert.equal(canValidate(relecture(), { firstWarning: { level: 'warn', msg: 'x' } }), true);
  assert.equal(canValidate(relecture(), {}), true);
  assert.equal(canValidate(relecture()), true);
});

test('vue : champs en texte, extrait lisible, indications, boutons ; le bouton est désactivé quand la validation est impossible', () => {
  const rv = relecture();
  const { document } = parseHTML(`<div id="r">${reviewHTML(rv)}</div>`);
  assert.equal(document.querySelectorAll('input[data-f]').length, FIELDS.length);
  for (const i of document.querySelectorAll('input[data-f]')) assert.equal(i.getAttribute('type'), 'text', 'saisie en texte : une valeur impossible doit pouvoir s’afficher');
  assert.equal(document.querySelector('[data-f=firstWarning]').getAttribute('value'), '10:55');
  assert.equal(document.querySelector('[data-f=firstWarning]').getAttribute('placeholder'), 'HH:MM');
  assert.equal(document.querySelector('[data-f=dateStart]').getAttribute('placeholder'), 'AAAA-MM-JJ');
  assert.match(document.querySelector('[data-field=firstWarning] .icex').textContent, /^Extrait : « .*10:55.* »/);
  assert.ok(document.querySelector('[data-mod=firstWarning]').hasAttribute('hidden'), '« valeur modifiée » caché tant que la valeur est celle du texte');
  assert.match(document.querySelector('#r').textContent, /par motifs \(CVAT, hors réseau\)/);
  assert.equal(document.querySelectorAll('input[data-kr]').length, rv.keyRules.length);
  assert.ok(document.querySelector('#icValidate') && document.querySelector('#icCancel'));
  assert.equal(document.querySelector('#icValidate').hasAttribute('disabled'), false);
  assert.ok(document.querySelector('#icBlock').hasAttribute('hidden'));
  const bloque = parseHTML(`<div>${reviewHTML(rv, { vhf: { level: 'bad', msg: 'canal VHF impossible (1 à 88)' } })}</div>`).document;
  assert.equal(bloque.querySelector('#icValidate').hasAttribute('disabled'), true);
  assert.ok(!bloque.querySelector('#icBlock').hasAttribute('hidden'));
  assert.match(bloque.querySelector('#icBlock').textContent, /Corrigez ou videz les valeurs impossibles \(en rouge\) pour valider/);
  assert.match(bloque.querySelector('[data-chip=vhf]').className, /low/);
});

test('vue : un extrait ou une valeur piégés venus du PDF ne produisent ni script ni img, et se lisent en texte (T-03-06)', () => {
  const piege = '<script>alert(1)</script>';
  const rv = relecture();
  rv.fields = rv.fields.map((f) => (f.key === 'zone' ? { ...f, excerpt: `avant ${piege} après ' "` } : f.key === 'committee' ? { ...f, value: '"><img src=x onerror=alert(1)>', orig: '' } : f));
  rv.source = '"><img src=x onerror=alert(2)>.pdf';
  rv.keyRules = [{ value: '<img src=x onerror=alert(3)>', keep: true }];
  const html = reviewHTML(rv, { zone: { level: 'warn', msg: '<b>x</b>' } });
  const { document } = parseHTML(`<div id="r">${html}</div>`);
  assert.equal(document.querySelectorAll('script').length, 0);
  assert.equal(document.querySelectorAll('img').length, 0);
  assert.equal(document.querySelectorAll('b').length, 0);
  assert.ok(document.querySelector('[data-field=zone] .icex').textContent.includes(piege), 'l’extrait se lit en texte');
  assert.equal(document.querySelector('[data-f=committee]').getAttribute('value'), '"><img src=x onerror=alert(1)>');
  assert.ok(document.querySelector('#r').textContent.includes('<img src=x onerror=alert(3)>'));
  assert.equal(document.querySelectorAll('[onerror]').length, 0);
});

test('puce et ligne de validation : signe et couleur, auteur et date de Paris, échappés', () => {
  assert.deepEqual(chipOf({ level: 'ok', msg: '' }), { cls: 'chip good', text: '✓ plausible' });
  assert.deepEqual(chipOf({ level: 'warn', msg: 'canal 16' }), { cls: 'chip mid', text: '⚠ canal 16' });
  assert.deepEqual(chipOf({ level: 'bad', msg: 'impossible' }), { cls: 'chip low', text: '✕ impossible' });
  assert.deepEqual(chipOf(undefined), { cls: 'chip', text: '' });
  const at = Date.parse('2026-10-19T22:30:00Z');                       // 00:30 le 20/10 à Paris
  assert.equal(validatedHTML({ validated: { by: 'Teiva', at }, read: 'motifs' }), 'IC validées par Teiva le 20/10 (lecture par motifs)');
  assert.equal(validatedHTML({ validated: { by: null, at }, read: 'saisie' }), 'IC validées le 20/10 (lecture saisie)');
  assert.equal(validatedHTML({ validated: { by: '<b>x</b>', at }, read: 'reprise' }), 'IC validées par &lt;b&gt;x&lt;/b&gt; le 20/10 (lecture reprise)');
  assert.match(validatedHTML(null), /Pas encore d’IC validées/);
});

test('garde statique : app.js valide par applyReview sur un geste, n’utilise plus l’ancien formulaire, et n’écrit rien à l’import', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.ok((app.match(/applyReview\(/g) || []).length >= 1, 'applyReview( absent de js/app.js');
  assert.ok(!/\beventForm\(|\breadForm\(/.test(app), 'l’ancien formulaire ne doit plus être appelé');
  const debut = app.indexOf('$(\'#icFile\').onchange'), ic = app.slice(debut, app.indexOf('\n  };', debut));          // le gestionnaire d’import seul
  assert.ok(ic.includes('reviewFromParse('), 'l’import produit une relecture');
  assert.ok(!/saveReg\(|upsertRegatta\(|applyReview\(/.test(ic), 'l’import ne doit rien écrire : seule « Valider les IC » écrit');
  assert.ok(/#icValidate/.test(app) && /#icCancel/.test(app));
});

// ───────────────────────── vraisemblance par champ (D-02)

const NOW = Date.parse('2026-10-19T08:30:00Z');
const verif = (rv, opts = {}) => checksFor(rv, { now: NOW, ...opts });

test('checksFor : une puce par champ ; les IC lues sont plausibles, le dernier jour vide est permis', () => {
  const c = verif(relecture());
  assert.deepEqual(Object.keys(c), FIELDS.map((f) => f.key), 'une puce par champ, dans l’ordre');
  for (const k of ['event', 'dateStart', 'dateEnd', 'firstWarning', 'lastFinishSignal', 'vhf', 'committee', 'zone']) assert.equal(c[k].level, 'ok', `${k} : ${c[k].msg}`);
});

test('checksFor : une valeur vide est « non lu dans le texte » (en alerte), sauf le dernier jour qui est facultatif', () => {
  const rv = reviewFromParse(parseIC('Texte sans rien de reconnaissable à lire ici.', 'x.pdf'), { source: 'x.pdf' });
  const c = verif(rv);
  for (const k of ['dateStart', 'firstWarning', 'lastFinishSignal', 'vhf', 'committee', 'zone']) { assert.equal(c[k].level, 'warn', k); assert.equal(c[k].msg, NOT_READ, k); }
  assert.equal(c.dateEnd.level, 'ok');
  // en saisie à la main, rien n’a été « lu » : la mention change
  assert.equal(verif(reviewFromRegatta(regate())).vhf.msg, 'valeur vide');
});

test('checksFor : la VHF saisie en texte est convertie en entier (« 72 » plausible, « 7 2 » impossible)', () => {
  let rv = relecture();
  assert.equal(verif(setValue(rv, 'vhf', '72')).vhf.level, 'ok');
  assert.equal(verif(setValue(rv, 'vhf', ' 72 ')).vhf.level, 'ok');
  assert.equal(verif(setValue(rv, 'vhf', '7 2')).vhf.level, 'bad');
  assert.equal(verif(setValue(rv, 'vhf', '72.5')).vhf.level, 'bad');
  assert.equal(verif(setValue(rv, 'vhf', 'soixante-douze')).vhf.level, 'bad');
  assert.equal(verif(setValue(rv, 'vhf', '99')).vhf.level, 'bad');
  assert.equal(verif(setValue(rv, 'vhf', '16')).vhf.level, 'warn');
  assert.equal(verif(setValue(rv, 'vhf', '45')).vhf.level, 'warn');
});

test('checksFor : heures impossibles ou inhabituelles, ordre des heures, dates', () => {
  const rv = relecture();
  assert.equal(verif(setValue(rv, 'firstWarning', '25:00')).firstWarning.level, 'bad');
  assert.equal(verif(setValue(rv, 'firstWarning', '03:30')).firstWarning.level, 'warn');
  const avant = verif(setValue(rv, 'lastFinishSignal', '09:00'));
  assert.equal(avant.lastFinishSignal.level, 'warn'); assert.match(avant.lastFinishSignal.msg, /avant le premier signal/);
  assert.equal(verif(setValue(setValue(rv, 'firstWarning', '25:00'), 'lastFinishSignal', '09:00')).lastFinishSignal.level, 'ok', 'une heure invalide : pas de comparaison');
  assert.equal(verif(setValue(rv, 'dateStart', '2026-02-30')).dateStart.level, 'bad');
  assert.equal(verif(setValue(rv, 'dateStart', '2027-12-01')).dateStart.level, 'warn');
  assert.equal(verif(setValue(rv, 'dateEnd', '2026-10-30')).dateEnd.level, 'warn', 'plus de 6 jours après le premier jour');
  assert.equal(verif(setValue(rv, 'dateEnd', '2026-10-17')).dateEnd.level, 'warn', 'antérieur : ignoré');
  assert.equal(verif(setValue(rv, 'dateEnd', '2026-10-19')).dateEnd.level, 'ok');
  assert.equal(verif(setValue(rv, 'dateEnd', '2026-13-01')).dateEnd.level, 'bad');
  assert.equal(verif(setValue(rv, 'event', 'x'.repeat(100))).event.level, 'warn', 'nom trop long : raccourci à l’enregistrement');
});

test('checksFor + canValidate : une valeur impossible bloque la validation jusqu’à sa correction ou son vidage ; une valeur inhabituelle ne bloque rien', () => {
  let rv = setValue(relecture(), 'vhf', '99');
  assert.equal(canValidate(rv, verif(rv)), false);
  rv = setValue(rv, 'vhf', '72'); assert.equal(canValidate(rv, verif(rv)), true);
  rv = setValue(rv, 'vhf', '7 2'); assert.equal(canValidate(rv, verif(rv)), false);
  rv = setValue(rv, 'vhf', ''); assert.equal(canValidate(rv, verif(rv)), true, 'vidée');
  rv = setValue(rv, 'firstWarning', '03:30'); assert.equal(canValidate(rv, verif(rv)), true, '03:30 : inhabituel seulement');
  rv = setValue(rv, 'firstWarning', '25:00'); assert.equal(canValidate(rv, verif(rv)), false);
  rv = setValue(rv, 'firstWarning', ''); assert.equal(canValidate(rv, verif(rv)), true);
  // l’impossible n’entre jamais dans la régate même si la garde est contournée : seules les valeurs plausibles de forme sont écrites
  const r = applyReview(regate(), setValue(relecture(), 'vhf', '99'), { by: 'T', at: 1 });
  assert.equal(r.ic.fields.vhf, 99, 'applyReview ne juge pas : la garde est canValidate sur le geste');
});

test('vue avec puces : rouge et bouton désactivé pour une valeur impossible, orange pour une inhabituelle, vert sinon', () => {
  let rv = setValue(relecture(), 'vhf', '99'); rv = setValue(rv, 'firstWarning', '03:30');
  const { document } = parseHTML(`<div>${reviewHTML(rv, verif(rv))}</div>`);
  assert.match(document.querySelector('[data-chip=vhf]').className, /\blow\b/);
  assert.match(document.querySelector('[data-chip=vhf]').textContent, /^✕ canal VHF impossible/);
  assert.match(document.querySelector('[data-chip=firstWarning]').className, /\bmid\b/);
  assert.match(document.querySelector('[data-chip=lastFinishSignal]').className, /\bgood\b/);
  assert.equal(document.querySelector('#icValidate').hasAttribute('disabled'), true);
  assert.ok(!document.querySelector('#icBlock').hasAttribute('hidden'));
  rv = setValue(rv, 'vhf', '72');
  const ok = parseHTML(`<div>${reviewHTML(rv, verif(rv))}</div>`).document;
  assert.equal(ok.querySelector('#icValidate').hasAttribute('disabled'), false);
  assert.ok(ok.querySelector('#icBlock').hasAttribute('hidden'));
});

test('garde statique : app.js calcule les contrôles à l’ouverture de la relecture et à chaque saisie, avec le terrain quand il est chargé', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.ok((app.match(/checksFor\(/g) || []).length >= 1, 'checksFor( absent de js/app.js');
  assert.ok(/isLand/.test(app.slice(app.indexOf('checksFor('))), 'isLand fourni dès que le terrain est chargé');
});

// ───────────────────────── lecture par l’IA (plan 03-06) : la réponse de /api/ic, déjà vérifiée côté serveur, entre dans la même relecture

const REPONSE = () => ({
  event: { value: 'Coupe de la Société Nautique de Marseille Sud', excerpt: 'Coupe de la Société Nautique de Marseille Sud' },
  club: { value: null, excerpt: null },
  dateStart: { value: '2026-10-18', excerpt: 'dimanche 18 octobre 2026' },
  dateEnd: { value: null, excerpt: null },
  firstWarning: { value: '10:55', excerpt: '5.1 Heure du premier signal d’avertissement : 10:55' },
  lastFinish: { value: null, excerpt: null, flag: 'extrait introuvable dans le texte' },
  vhf: { value: null, excerpt: 'Canal de vacation Radio : VHF 69', flag: 'la valeur ne figure pas dans l’extrait' },
  committee: { value: 'Marie DUPONT', excerpt: 'Président du comité de course : Marie DUPONT' },
  zone: { value: null, excerpt: null },
  races: [
    { date: '2026-10-18', warning: '10:55', label: 'Manche 1', excerpt: 'dimanche 18 octobre 2026 Heure du premier signal d’avertissement : 10:55', verified: true },
    { date: '2026-10-18', warning: '14:30', label: 'Manche inventée', excerpt: null, verified: false },
  ],
  marks: [{ name: 'Bouée A', position: '43°04,5 N', excerpt: null, verified: false }],
  courses: [],
  specialRules: [
    { value: 'Les abandons se signalent au comité', excerpt: 'Tout concurrent qui abandonne doit en informer le comité de course', verified: true },
    { value: 'Règle inventée par le modèle', excerpt: null, verified: false },
  ],
  flags: 4, truncated: true, model: 'gpt-5.5',
});
const parApi = (extra = {}) => reviewFromApi({ ...REPONSE(), ...extra }, { source: 'ic-marseille.pdf', text: AUTRE_CLUB });

test('reviewFromApi : read ia, mêmes champs que la lecture CVAT ; valeurs vérifiées avec leur extrait, champs signalés vides avec leur raison', () => {
  const rv = parApi();
  assert.equal(rv.read, 'ia'); assert.equal(rv.source, 'ic-marseille.pdf');
  assert.deepEqual(rv.fields.map((f) => f.key), FIELDS.map((f) => f.key), 'la même relecture champ par champ');
  assert.equal(val(rv, 'event'), 'Coupe de la Société Nautique de Marseille Sud');
  assert.equal(val(rv, 'dateStart'), '2026-10-18'); assert.equal(champ(rv, 'dateStart').excerpt, 'dimanche 18 octobre 2026');
  assert.equal(val(rv, 'firstWarning'), '10:55'); assert.match(champ(rv, 'firstWarning').excerpt, /10:55/);
  assert.equal(val(rv, 'committee'), 'Marie DUPONT');
  assert.equal(val(rv, 'lastFinishSignal'), '', 'extrait introuvable : vide'); assert.equal(champ(rv, 'lastFinishSignal').flag, 'extrait introuvable dans le texte');
  assert.equal(champ(rv, 'lastFinishSignal').excerpt, null);
  assert.equal(val(rv, 'vhf'), '', 'valeur absente de l’extrait : vide, jamais la valeur du modèle');
  assert.equal(champ(rv, 'vhf').flag, 'la valeur ne figure pas dans l’extrait'); assert.match(champ(rv, 'vhf').excerpt, /VHF 69/, 'l’extrait reste affiché');
  assert.equal(val(rv, 'zone'), ''); assert.equal(champ(rv, 'zone').flag, null, 'rien lu, rien à signaler de plus que « non lu »');
  for (const f of rv.fields) assert.equal(f.edited, false);
  assert.equal(rv.truncated, true);
  assert.equal(JSON.stringify(rv).includes('Règle inventée par le modèle'), true, 'une règle non vérifiée reste visible, grisée');
});

test('reviewFromApi : le dernier jour déjà connu de la régate est repris ; une raison de signalement n’est pas écrasée', () => {
  const r = { ...regate(), dateEnd: '2026-10-20' };
  assert.equal(val(reviewFromApi(REPONSE(), { regatta: r }), 'dateEnd'), '2026-10-20');
  const flagged = REPONSE(); flagged.dateEnd = { value: null, excerpt: null, flag: 'extrait introuvable dans le texte' };
  assert.equal(val(reviewFromApi(flagged, { regatta: r }), 'dateEnd'), '');
});

test('reviewFromApi : règles particulières vérifiées cochées (texte de l’extrait), non vérifiées décochées et non cochables ; manches de même', () => {
  const rv = parApi();
  assert.deepEqual(rv.keyRules, [
    { value: 'Tout concurrent qui abandonne doit en informer le comité de course', keep: true },
    { value: 'Règle inventée par le modèle', keep: false, verified: false },
  ]);
  assert.deepEqual(setKeep(rv, 1, true).keyRules[1], { value: 'Règle inventée par le modèle', keep: false, verified: false }, 'une règle non vérifiée ne se coche pas');
  assert.equal(setKeep(rv, 0, false).keyRules[0].keep, false);
  assert.deepEqual(rv.races.map((m) => [m.date, m.time, m.label, m.verified, m.keep]), [['2026-10-18', '10:55', 'Manche 1', true, true], ['2026-10-18', '14:30', 'Manche inventée', false, false]]);
  assert.equal(rv.races[1].excerpt, null);
  assert.deepEqual(rv.marks.map((m) => m.verified), [false]);
  const reg = applyReview(regate(), rv, { by: 'Teiva', at: 5 });
  assert.deepEqual(reg.ic.fields.keyRules, ['Tout concurrent qui abandonne doit en informer le comité de course'], 'seules les règles vérifiées entrent');
  assert.equal(reg.ic.read, 'ia');
});

test('relecture ia : mêmes puces que la lecture CVAT, la raison du signalement en tête ; rien n’entre avant applyReview ; contrôles de vraisemblance inchangés', () => {
  const rv = parApi();
  const c = verif(rv);
  assert.equal(c.lastFinishSignal.level, 'warn'); assert.equal(c.lastFinishSignal.msg, 'extrait introuvable dans le texte');
  assert.equal(c.vhf.level, 'warn'); assert.equal(c.vhf.msg, 'la valeur ne figure pas dans l’extrait');
  assert.equal(c.zone.msg, NOT_READ);
  assert.equal(c.firstWarning.level, 'ok'); assert.equal(c.dateEnd.level, 'ok', 'le dernier jour reste facultatif');
  assert.equal(verif(setValue(rv, 'vhf', '99')).vhf.level, 'bad', 'une valeur saisie par-dessus est jugée comme avant');
  assert.equal(canValidate(rv, c), true, 'des champs vides signalés ne bloquent pas');
  const avant = regate(); const copie = structuredClone(avant);
  const apres = applyReview(avant, rv, { by: 'Teiva', at: 7 });
  assert.deepEqual(avant, copie, 'applyReview ne modifie pas la régate d’origine');
  assert.equal(apres.ic.read, 'ia'); assert.deepEqual(apres.ic.validated, { by: 'Teiva', at: 7 });
  assert.equal(apres.ic.fields.firstWarning, '10:55'); assert.equal(apres.ic.fields.vhf, null); assert.equal(apres.ic.fields.lastFinishSignal, '');
  assert.match(apres.ic.excerpts.firstWarning, /10:55/);
});

test('vue relecture ia : mention « lecture par l’IA (OpenAI) », puce de la raison, règles grisées, tout échappé (XSS par un extrait ou un nom)', () => {
  const rep = REPONSE();
  rep.event = { value: '<img src=x onerror="window.__xss=1">', excerpt: 'Coupe <script>window.__xss=1</script> Marseille' };
  rep.specialRules[1].value = '<b onclick="x()">piège</b>';
  const rv = reviewFromApi(rep, { source: '<i>fichier</i>.pdf', text: AUTRE_CLUB });
  const { document } = parseHTML(`<div>${reviewHTML(rv, verif(rv))}</div>`);
  assert.match(document.querySelector('#icReview').textContent, /lecture par l’IA \(OpenAI\) : vérifiez chaque valeur/);
  assert.match(document.querySelector('[data-chip=lastFinishSignal]').textContent, /^⚠ extrait introuvable dans le texte/);
  assert.match(document.querySelector('[data-chip=vhf]').textContent, /ne figure pas dans l’extrait/);
  assert.equal(document.querySelectorAll('img, script, b, i').length, 0, 'aucune balise venue du modèle ou du fichier');
  assert.equal(document.querySelector('#icf-event').getAttribute('value'), '<img src=x onerror="window.__xss=1">', 'la valeur reste du texte');
  const regles = [...document.querySelectorAll('.icrules:not(.icraces) .icrule')];
  assert.equal(regles.length, 2);
  assert.equal(regles[0].querySelector('input').hasAttribute('checked'), true); assert.equal(regles[0].querySelector('input').hasAttribute('disabled'), false);
  assert.match(regles[1].className, /\bicoff\b/); assert.equal(regles[1].querySelector('input').hasAttribute('checked'), false); assert.equal(regles[1].querySelector('input').hasAttribute('disabled'), true);
  assert.match(document.querySelector('#icReview').textContent, /seuls les 50 000 premiers caractères/);
});

test('validatedHTML : « lecture par l’IA » quand ic.read vaut ia', () => {
  const at = Date.parse('2026-10-19T08:30:00Z');
  assert.equal(validatedHTML({ validated: { by: 'Thibaud', at }, read: 'ia' }), 'IC validées par Thibaud le 19/10 (lecture par l’IA)');
});

// ───────────────────────── l’IA seulement quand il le faut, avec le réseau, sur geste (D-03) ; manches lues ; erreurs lisibles

let snpm = null;                                                     // texte réel des IC SNPM, extrait par le pdf.js vendorisé (comme tests/pdf.test.mjs)
async function snpmText() {
  if (snpm) return snpm;
  await import(new URL('../vendor/pdf.worker.min.js', import.meta.url));
  await import(new URL('../vendor/pdf.min.js', import.meta.url));
  globalThis.window = { pdfjsLib: globalThis.pdfjsLib };
  const { pdfText } = await import('../js/events.js');
  return (snpm = await pdfText(new Blob([fixture('ic-coupe-snpm-2026-10-18.pdf', null)])));
}

test('icLooksCvat : vrai sur le texte réel des IC SNPM, faux sur le texte d’un autre club ; cvatReadOk : date, premier signal et VHF lus', async () => {
  const cvat = await snpmText();
  assert.equal(icLooksCvat(cvat), true);
  assert.equal(icLooksCvat(AUTRE_CLUB), false);
  assert.equal(icLooksCvat(''), false); assert.equal(icLooksCvat(null), false);
  assert.equal(cvatReadOk(parseIC(cvat, 'ic.pdf')), true);
  assert.equal(cvatReadOk(parseIC(AUTRE_CLUB, 'ic.pdf')), true, 'la lecture par motifs d’un texte bien formé est complète quelle que soit la source');
  const p = parseIC(cvat, 'ic.pdf');
  assert.equal(cvatReadOk({ ...p, date: undefined }), false, 'date manquante');
  assert.equal(cvatReadOk({ ...p, date: '2026-02-30' }), false, 'date impossible');
  assert.equal(cvatReadOk({ ...p, firstWarning: undefined }), false, 'premier signal manquant');
  assert.equal(cvatReadOk({ ...p, vhf: undefined }), false, 'VHF manquante');
  assert.equal(cvatReadOk(null), false);
  assert.equal(cvatReadOk(parseIC('Texte sans rien de reconnaissable à lire ici.', 'x.pdf')), false);
});

test('textTooThin : vrai sous 200 caractères non blancs', () => {
  assert.equal(textTooThin(''), true); assert.equal(textTooThin(null), true);
  assert.equal(textTooThin('abc '.repeat(40)), true, '120 caractères non blancs, 160 avec les blancs');
  assert.equal(textTooThin('a'.repeat(199) + ' '.repeat(500)), true, 'les blancs ne comptent pas');
  assert.equal(textTooThin('a'.repeat(200)), false);
  assert.equal(textTooThin(AUTRE_CLUB), false);
});

test('iaOffer : CVAT bien lues → pas de bouton ; autre club en ligne → actif ; hors réseau → inactif avec son message ; texte mince → inactif ; IA:false → jamais', async () => {
  const cvat = await snpmText();
  const bien = parseIC(cvat, 'ic.pdf'), autre = parseIC(AUTRE_CLUB, 'x.pdf');
  assert.equal(IA_IC, true, 'la constante IA_IC vaut true tant que l’essai réel n’a pas dit le contraire');
  assert.equal(iaOffer({ text: cvat, parse: bien, online: true, IA: true }).show, false, 'IC CVAT bien lues : le bouton n’est pas montré');
  assert.equal(iaOffer({ text: cvat, parse: bien, online: false, IA: true }).show, false, 'même hors réseau');
  // lecture CVAT incomplète (premier signal, VHF ou date manquants) : l’IA est proposée
  const incomplet = iaOffer({ text: cvat, parse: { ...bien, vhf: undefined }, online: true, IA: true });
  assert.deepEqual(incomplet, { show: true, enabled: true, msg: '' });
  assert.deepEqual(iaOffer({ text: AUTRE_CLUB, parse: autre, online: true, IA: true }), { show: true, enabled: true, msg: '' });
  assert.deepEqual(iaOffer({ text: AUTRE_CLUB, parse: autre, online: false, IA: true }),
    { show: true, enabled: false, msg: 'Lecture IA indisponible hors réseau : importez les IC avant la régate' });
  assert.deepEqual(iaOffer({ text: 'trop court', parse: parseIC('trop court', 'x.pdf'), online: true, IA: true }),
    { show: true, enabled: false, msg: 'PDF sans texte : saisissez la fiche à la main' });
  assert.equal(iaOffer({ text: 'trop court', parse: null, online: false, IA: true }).msg, 'PDF sans texte : saisissez la fiche à la main', 'sans texte, le message du texte prime');
  for (const online of [true, false]) assert.equal(iaOffer({ text: AUTRE_CLUB, parse: autre, online, IA: false }).show, false, 'IA:false masque le bouton sans rien changer d’autre');
  assert.equal(iaOffer({ text: AUTRE_CLUB, parse: autre, online: true }).show, true, 'par défaut : la constante IA_IC');
});

test('vue : le bouton « Lire avec l’IA (le texte part chez OpenAI) » suit l’offre ; son message est échappé ; sans offre, aucun bouton', () => {
  const rv = relecture();
  const sans = parseHTML(`<div>${reviewHTML(rv, {})}</div>`).document;
  assert.equal(sans.querySelector('#icIa'), null);
  const actif = parseHTML(`<div>${reviewHTML(rv, {}, { ia: { show: true, enabled: true, msg: '' } })}</div>`).document;
  assert.equal(actif.querySelector('#icIa').textContent, 'Lire avec l’IA (le texte part chez OpenAI)');
  assert.equal(actif.querySelector('#icIa').hasAttribute('disabled'), false);
  const inactif = parseHTML(`<div>${reviewHTML(rv, {}, { ia: { show: true, enabled: false, msg: 'Lecture IA indisponible <b>hors</b> réseau' } })}</div>`).document;
  assert.equal(inactif.querySelector('#icIa').hasAttribute('disabled'), true);
  assert.equal(inactif.querySelector('#icIaMsg').textContent, 'Lecture IA indisponible <b>hors</b> réseau');
  assert.equal(inactif.querySelectorAll('#icIaMsg b').length, 0);
  assert.equal(parseHTML(`<div>${reviewHTML(rv, {}, { ia: { show: false } })}</div>`).document.querySelector('#icIa'), null);
});

test('iaErrorMessage : un message français par cause (clé absente, réponse tronquée, texte court, accès refusé, délai, réseau)', () => {
  assert.equal(iaErrorMessage({ status: 503, code: 'no_key' }), 'Lecture IA indisponible sur ce déploiement (clé OpenAI absente)');
  assert.equal(iaErrorMessage({ status: 502 }), 'Réponse tronquée ou refusée : réessayez, ou saisissez à la main');
  assert.equal(iaErrorMessage({ status: 400 }), 'Texte des IC trop court');
  assert.equal(iaErrorMessage({ status: 401 }), 'Accès refusé : rouvrez l’app avec votre code');
  assert.equal(iaErrorMessage({ timedOut: true }), 'L’IA n’a pas répondu à temps (70 s)');
  assert.equal(iaErrorMessage({}), 'Pas de réseau : la lecture IA se fait avant la régate', 'ni statut ni délai : le réseau a échoué');
  assert.match(iaErrorMessage({ status: 429 }), /^La lecture par l’IA a échoué \(code 429\)/);
  assert.match(iaErrorMessage({ status: 503, code: 'autre' }), /code 503/);
});

test('manches lues par l’IA : vérifiées cochées (jour, heure, libellé, extrait), non vérifiées grisées et non cochées ; setKeepRace ne coche pas une manche non vérifiée', () => {
  const rv = parApi();
  const { document } = parseHTML(`<div>${reviewHTML(rv, verif(rv))}</div>`);
  const lignes = [...document.querySelectorAll('.icrace')];
  assert.equal(lignes.length, 2);
  assert.match(lignes[0].textContent, /2026-10-18/); assert.match(lignes[0].textContent, /10:55/); assert.match(lignes[0].textContent, /Manche 1/);
  assert.match(lignes[0].textContent, /Extrait : « dimanche 18 octobre 2026/);
  assert.equal(lignes[0].querySelector('input').hasAttribute('checked'), true);
  assert.match(lignes[1].className, /\bicoff\b/); assert.equal(lignes[1].querySelector('input').hasAttribute('checked'), false); assert.equal(lignes[1].querySelector('input').hasAttribute('disabled'), true);
  assert.equal(setKeepRace(rv, 1, true).races[1].keep, false);
  assert.equal(setKeepRace(rv, 0, false).races[0].keep, false);
  assert.equal(setKeepRace(rv, 0, false).races[1].keep, false);
  assert.equal(document.querySelectorAll('.icrace img, .icrace script').length, 0);
});

test('applyReview : les manches cochées entrent par addRace (parcours à préciser, auteur, instant) ; décochées ou non vérifiées jamais ; pas de doublon ; hors régate ignorées', () => {
  const rv = parApi();
  const at = 1234;
  const reg = applyReview(regate(), rv, { by: 'Teiva', at });
  assert.equal(reg.dateStart, '2026-10-18', 'les manches se rangent selon les jours des IC validées');
  assert.equal(reg.races.length, 1, 'la manche vérifiée seulement');
  const m = reg.races[0];
  assert.deepEqual([m.n, m.date, m.time, m.courseId, m.by, m.at], [1, '2026-10-18', '10:55', null, 'Teiva', at]);
  assert.match(m.note, /Manche 1/); assert.match(m.note, /parcours à préciser/);
  // décochée : rien
  assert.equal(applyReview(regate(), setKeepRace(rv, 0, false), { by: 'T', at }).races.length, 0);
  // déjà présente (même jour, même heure) : pas de doublon
  assert.equal(applyReview(reg, rv, { by: 'T', at: at + 1 }).races.length, 1);
  // un jour qui n’est pas dans la régate (dernier jour absent) : manche ignorée, validation intacte
  const hors = reviewFromApi({ ...REPONSE(), races: [{ date: '2026-12-31', warning: '10:00', label: 'Autre jour', excerpt: 'x', verified: true }] }, { source: 'a.pdf', text: AUTRE_CLUB });
  const r2 = applyReview(regate(), hors, { by: 'T', at });
  assert.equal(r2.races.length, 0); assert.equal(r2.ic.read, 'ia');
  // relecture « Modifier » : aucune manche, aucune ajoutée
  assert.equal(applyReview(reg, reviewFromRegatta(reg), { by: 'T', at }).races.length, 1);
  // l’original n’est pas modifié
  const avant = regate(); const copie = structuredClone(avant); applyReview(avant, rv, { by: 'T', at }); assert.deepEqual(avant, copie);
});

test('garde statique : app.js suit iaOffer, appelle /api/ic sur un geste avec un délai de 70 s, traduit les erreurs et ne journalise jamais le texte des IC', () => {
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  assert.ok(/iaOffer\(/.test(app) && /IA_IC/.test(app), 'le bouton suit iaOffer et IA_IC');
  assert.ok(/fetch\('\/api\/ic'/.test(app) && /70000/.test(app) && /AbortController/.test(app));
  assert.ok(/iaErrorMessage\(/.test(app));
  assert.ok(/addEventListener\('offline'[^\n]*paintIa\(\)/.test(app), 'l’état hors réseau repeint le bouton');
  const ia = app.slice(app.indexOf('async function readWithAI'), app.indexOf('async function readWithAI') + 2600);
  assert.ok(!/report\('ic-ia',[^)]*(?:text|icSrc|body)/.test(ia), 'report(ic-ia) ne reçoit jamais le texte ni le corps');
  const debut = app.indexOf('$(\'#icFile\').onchange'), imp = app.slice(debut, app.indexOf('\n  };', debut));
  assert.ok(!/readWithAI\(|fetch\(/.test(imp), 'l’import n’envoie rien : seul le geste « Lire avec l’IA » envoie');
});
