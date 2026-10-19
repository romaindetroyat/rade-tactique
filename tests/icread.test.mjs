// Relecture des IC champ par champ (REG-03, D-02, D-03, D-06) : depuis parseIC (texte SNPM et texte fabriqué d’un autre club), champ non lu
// laissé vide, rien d’écrit sans validation, règle du dernier jour (D-15), blocage par une valeur impossible, vue sans injection (linkedom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { ROOT } from './helpers/setup.mjs';
import { parseIC } from '../js/events.js';
import { createRegatta } from '../js/regates.js';
import {
  FIELDS, NOT_READ, checksFor, reviewFromParse, reviewFromRegatta, setValue, setKeep, canValidate, applyReview, reviewHTML, chipOf, validatedHTML,
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
