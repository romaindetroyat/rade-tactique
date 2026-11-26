// Gel de Naos v43 (phase 8, D-01, ESPACE-05) : ce que le serveur fait pour l’équipage de Naos est comparé, section par section, à la capture
// faite sur le code extrait de 5e9b8a5 (tests/fixtures/naos-v43.json, tests/helpers/naos.mjs). Seules les différences écrites dans
// `differencesAdmises` sont tolérées ; tout autre écart casse `npm test`. La fixture n’est jamais recapturée sur le code modifié.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, fixture } from './helpers/setup.mjs';
import { statSync, existsSync } from 'node:fs';
import { naosCases, modulesNaos, fichiersDepot, differencesAdmises, canon, FROM, AJOUTS_SHELL, TAILLE_AJOUT_MAX } from './helpers/naos.mjs';
import { sameDeep } from './helpers/toulon.mjs';
import { tableEquipage, FAUX_CODE } from './helpers/codesimule.mjs';

const TEXTE = fixture('naos-v43.json');
const F = JSON.parse(TEXTE);
let courant = null;
const cas = async () => (courant ??= await naosCases({ ...(await modulesNaos(ROOT)), fichiers: fichiersDepot(ROOT) }));

test('fixture de Naos : capturée sur 5e9b8a5 (v43)', () => {
  assert.equal(F.v, 43);
  assert.equal(F.from, FROM);
  assert.equal(FROM, '5e9b8a5');
});

// Premier écart entre le code courant et la capture ajustée des seules différences admises
const ecart = (section, c) => sameDeep(canon(c), canon(differencesAdmises(section, F[section], c)), section);

for (const section of ['middleware', 'publics', 'archive', 'quota']) {
  test(`Naos v43 : ${section} identique à la capture (différences admises seulement)`, async () => {
    assert.ok(F[section], `section ${section} absente de la fixture`);
    const d = ecart(section, (await cas())[section]);
    assert.equal(d, null, d);
  });
}

for (const section of ['ia', 'brest']) {
  test(`Naos v43 : ${section} identique à la capture`, async () => {
    assert.ok(F[section], `section ${section} absente de la fixture`);
    const d = ecart(section, (await cas())[section]);
    assert.equal(d, null, d);
  });
}

test('Naos v43 : consignes de Toulon de la v43 = empreintes de la v42 (tests/fixtures/ia-toulon-v42.json)', () => {
  const v42 = JSON.parse(fixture('ia-toulon-v42.json'));
  for (const f of ['rules', 'debrief', 'voice']) assert.equal(F.ia?.[f]?.toulon, v42[f], f);
  for (const f of ['rules', 'debrief', 'voice']) assert.match(F.ia[f].brest, /^[0-9a-f]{64}$/);
  assert.match(F.ia.ic, /^[0-9a-f]{64}$/);
});

test('Naos v43 : liste hors réseau — tout le SHELL de la v43 reste, ajouts limités à AJOUTS_SHELL (64 Ko au plus chacun), aucun pack', async () => {
  assert.ok(Array.isArray(F.shell) && F.shell.length > 20, 'section shell absente de la fixture');
  const c = (await cas()).shell, v43 = new Set(F.shell);
  const manque = F.shell.filter((f) => !c.includes(f));
  assert.deepEqual(manque, [], 'fichiers de la v43 retirés de la liste hors réseau');
  const ajouts = c.filter((f) => !v43.has(f));
  assert.deepEqual(ajouts.filter((f) => !AJOUTS_SHELL.includes(f)), [], 'fichiers ajoutés hors de AJOUTS_SHELL');
  for (const f of ajouts) {
    assert.ok(existsSync(ROOT + f), `${f} absent du dépôt`);
    assert.ok(statSync(ROOT + f).size <= TAILLE_AJOUT_MAX, `${f} dépasse 64 Ko`);
  }
  const packs = fichiersDepot(ROOT, 'data/').map((p) => /^\/data\/([a-z0-9-]+)\.meta\.json$/.exec(p)?.[1]).filter(Boolean);
  assert.ok(packs.includes('brest'));
  assert.deepEqual(c.filter((f) => packs.some((id) => f.startsWith(`data/${id}.`))), [], 'un fichier de pack dans la liste hors réseau');
  assert.equal(ecart('shell', c), null, ecart('shell', c));
});

test('Naos v43 : les différences admises ne masquent rien (un écart ailleurs reste visible)', async () => {
  const c = structuredClone((await cas()).middleware);
  const cle = Object.keys(c).find((k) => k.includes('| cookie-faux-code | GET /api/archive?k=light | simple'));
  assert.ok(cle, 'cas de l’archive avec le faux code');
  c[cle].membre = 'Usurpateur';
  assert.notEqual(ecart('middleware', c), null, 'un auteur changé doit être vu');
  const m = structuredClone((await cas()).middleware);
  const membre = Object.keys(m).find((k) => k.includes('| cookie-faux-code | GET /api/membre | simple'));
  m[membre].corps = { ...m[membre].corps, espace: 'tofinou' };
  assert.notEqual(ecart('middleware', m), null, 'un autre espace que « naos » doit être vu');
});

test('la fixture ne contient ni empreinte de la table ni code autre que le faux code', () => {
  for (const { hex } of tableEquipage()) assert.ok(!TEXTE.includes(hex), 'une empreinte de la table figure dans la fixture');
  // hors des sections d’empreintes de contenus (consignes d’IA, pack de Brest), aucune suite de 64 hexadécimaux
  const { ia, brest, ...reste } = F;
  assert.doesNotMatch(JSON.stringify(reste), /[0-9a-f]{64}/i, 'suite de 64 hexadécimaux hors des sections ia et brest');
  const codes = new Set([...TEXTE.matchAll(/rt_acces=([^;"\s\\]*)/g)].map((x) => x[1]));
  for (const c of codes) assert.ok([FAUX_CODE, 'inconnu-de-test'].includes(c), 'code inattendu dans la fixture');
  const liens = new Set([...TEXTE.matchAll(/acces=([^&"\s\\]+)/g)].map((x) => x[1]).filter((x) => !x.startsWith('code-de-test') && !x.startsWith('inconnu-de-test')));
  assert.deepEqual([...liens], [], 'lien d’accès inattendu dans la fixture');
});
