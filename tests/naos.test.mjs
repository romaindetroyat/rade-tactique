// Gel de Naos v43 (phase 8, D-01, ESPACE-05) : ce que le serveur fait pour l’équipage de Naos est comparé, section par section, à la capture
// faite sur le code extrait de 5e9b8a5 (tests/fixtures/naos-v43.json, tests/helpers/naos.mjs). Seules les différences écrites dans
// `differencesAdmises` sont tolérées ; tout autre écart casse `npm test`. La fixture n’est jamais recapturée sur le code modifié.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, fixture } from './helpers/setup.mjs';
import { naosCases, modulesNaos, fichiersDepot, differencesAdmises, canon, FROM } from './helpers/naos.mjs';
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
