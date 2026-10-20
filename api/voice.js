// Compréhension d'un relevé de vent dicté en langage naturel (Vercel, fonction Node).
// Le modèle OpenAI traduit la phrase en intention structurée ; l'app fait les calculs (amure, bascules) et l'enregistrement.
// Variables d'environnement sur Vercel : OPENAI_API_KEY (obligatoire), OPENAI_MODEL (facultatif, défaut gpt-5.5).
// L'appel à OpenAI, le quota par équipier et les erreurs passent par api/_ia.js ; `createHandler({ openai, blob, now })` accepte un client et un
// faux Blob simulés (tests, aucun réseau).

import { createIA } from './_ia.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

const SYSTEM = `Tu interprètes ce qu'un régatier dit à voix haute sur un J80 dans la rade de Toulon pour mettre à jour le vent réel observé.
La phrase vient d'une reconnaissance vocale : elle peut contenir des fautes, des mots mal reconnus, des nombres écrits en lettres ou mal découpés.

Règles :
- La direction est celle d'où vient le vent, en degrés vrais (0 = nord, 90 = est, 270 = ouest).
- Le vent de régate ne dépasse pas 25 nœuds : un nombre seul jusqu'à 30 est une force, au-delà une direction, sauf si le contexte dit clairement l'inverse.
- Rose des vents : nord 0, nord-nord-est 22, nord-est 45, est-nord-est 67, est 90, est-sud-est 112, sud-est 135, sud-sud-est 157, sud 180, sud-sud-ouest 202, sud-ouest 225, ouest-sud-ouest 247, ouest 270, ouest-nord-ouest 292, nord-ouest 315, nord-nord-ouest 337. Mistral ≈ 315, levant ≈ 90, marin ≈ 135, labech ≈ 225, tramontane ≈ 0.
- « adonne / ça adonne / adonnante » = mode "lift" ; « refuse / ça refuse / refusante » = mode "header" ; valeur en degrés (positive). Sans chiffre : 10°. « un peu » ≈ 5°, « beaucoup / grosse bascule » ≈ 15–20°.
- « tourne à droite / dans le sens des aiguilles / veer » = delta positif ; « à gauche / recule / back » = delta négatif.
- « forcit / monte / plus » = delta de force positif ; « mollit / baisse / moins » = négatif. Sans chiffre : 2 nœuds, « un peu » 1, « beaucoup » 4.
- Une valeur absolue l'emporte sur une variation pour la même grandeur. « Rafales / risées à X » = gust.
- Si une grandeur n'est pas mentionnée : mode "unchanged".
- Si la phrase ne parle pas de vent ou est incompréhensible : understood = false et pose une question courte.
- summary : une phrase française très courte qui reformule ce que tu as compris (ex. « Vent au 300, 14 nœuds »).`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['understood', 'direction', 'speed', 'gust', 'confidence', 'summary', 'question'],
  properties: {
    understood: { type: 'boolean' },
    direction: {
      type: 'object', additionalProperties: false, required: ['mode', 'value'],
      properties: { mode: { type: 'string', enum: ['absolute', 'delta', 'lift', 'header', 'unchanged'] }, value: { type: ['number', 'null'] } },
    },
    speed: {
      type: 'object', additionalProperties: false, required: ['mode', 'value'],
      properties: { mode: { type: 'string', enum: ['absolute', 'delta', 'unchanged'] }, value: { type: ['number', 'null'] } },
    },
    gust: { type: ['number', 'null'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    summary: { type: 'string' },
    question: { type: ['string', 'null'] },
  },
};

export function createHandler({ openai, blob, now, delai } = {}) {
  const ia = createIA({ openai, blob, now, delai });
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'no_key' });
    const { alts = [], last = null, tack = null } = req.body || {};
    const phrases = (Array.isArray(alts) ? alts : [String(alts)]).map((s) => String(s).slice(0, 300)).filter(Boolean).slice(0, 4);
    if (!phrases.length) return res.status(400).json({ error: 'phrase vide' });
    const context = `Dernier vent connu : ${last ? `${Math.round(last.dir)}°, ${Math.round(last.spd)} nœuds` : 'aucun'}. Amure actuelle : ${tack === 1 ? 'bâbord amures' : tack === -1 ? 'tribord amures' : 'inconnue'}.`;
    const user = `${context}\nCe qu'a entendu la reconnaissance vocale (hypothèses, la première est la plus probable) :\n${phrases.map((p, i) => `${i + 1}. « ${p} »`).join('\n')}`;
    if (!(await ia.garde(req, res))) return;
    try {
      const response = await ia.appelle({
        model: MODEL,
        instructions: SYSTEM,
        input: user,
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_schema', name: 'releve_vent', schema: SCHEMA, strict: true } },
      });
      return res.status(200).json(JSON.parse(response.output_text));
    } catch (err) {
      return ia.repond(res, err);
    }
  };
}

export default createHandler();
