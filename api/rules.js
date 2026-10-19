// Arbitre de poche : répond aux questions de règles de course (Vercel, fonction Node).
// Le modèle OpenAI ne s'appuie que sur le texte officiel des RRS 2025-2028 (api/_rrs.js) et sur les IC CVAT ;
// chaque citation anglaise renvoyée est vérifiée mot pour mot dans ce texte avant d'être affichée.
// Variables d'environnement : OPENAI_API_KEY, OPENAI_MODEL (défaut gpt-5.5).

import OpenAI from 'openai';
import RRS from './_rrs.js';

let client = null; // créé à la première requête : sans clé, le constructeur lèverait une erreur au chargement
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

const CVAT = `Instructions de course habituelles du CVAT (Toulon), qui modifient les RRS :
- Pénalité pour une règle du chapitre 2 : un seul tour (un virement + un empannage) au lieu de deux, puis reconnaissance écrite au Comité.
- Autres règles : pénalité de 20 % du temps de course.
- Ligne de départ : mât du Comité (pavillon orange, à tribord) et bouée blanche ; la bouée rouge à l'arrière du Comité fait partie du Comité.
- Ligne d'arrivée : mât du Comité (pavillon bleu) et bouée blanche.
- Partir au plus tard 10 min après son signal de départ ; rester à l'écart de la zone de départ avant son avertissement.
- Réduction de parcours (règle 32.1 modifiée) : bateau Comité avec 2e substitut + pavillon de classe près d'une marque = porte de pointage.
- Être en régate ne donne aucune priorité sur les autres navires (plongeurs, navires de commerce, Marine).
Bateau : J80, longueur de coque 8 m (zone = 24 m, deux longueurs = 16 m).`;

const SYSTEM = `Tu es l'arbitre de poche d'un équipage de J80 qui régate au CVAT, dans la rade de Toulon. Tu réponds en français simple et concret à des questions sur les règles de course à la voile.

Sources : uniquement le texte officiel anglais des Racing Rules of Sailing 2025-2028 fourni ci-dessous et les IC CVAT. N'utilise pas de souvenirs d'anciennes éditions (la numérotation a changé en 2025 : la règle 21 est « Starting errors; taking penalties; backing a sail », l'exonération est la règle 43).

Règles de réponse :
- verdict : 15 mots au plus, qui répond directement (« B doit s'écarter », « Non, il n'a pas droit à la place »). Les nuances vont dans explication.
- explication : 2 à 6 phrases courtes, vocabulaire de régate français (bâbord/tribord amures, au vent/sous le vent, engagé, route libre derrière, place à la marque, zone, se maintenir à l'écart, route normale, prolongement de la ligne). Explique le raisonnement et ce qu'il faut faire sur l'eau. Pas d'anglicisme : « faire la marque » ou « être sur la lay-line » (pas « fetcher »), « bord » ou « amures » selon le cas, « place à la marque ».
- regles : 1 à 4 règles utiles. "numero" (ex. "18.2(a)", "Définition Overlap"), "titre" en français, "en" = extrait COPIÉ MOT POUR MOT du texte officiel fourni (la phrase utile seulement, trois phrases au plus, sans rien modifier ni ajouter, sans guillemets), "fr" = ta traduction française fidèle de cet extrait.
- ic : ce que les IC CVAT changent pour cette question, sinon chaîne vide.
- attention : limites de la réponse (faits à vérifier, appréciation du jury), sinon chaîne vide. Rappelle que seul le jury tranche une réclamation quand c'est pertinent.
- Si la question ne porte pas sur les règles de course, réponds brièvement dans verdict et laisse regles vide.
- Si les faits manquent (amures, engagement, entrée dans la zone…), donne la réponse pour chaque cas plutôt que d'inventer.

Points d'interprétation à respecter (tirés du texte officiel) :
- 18.2(a) : tout se fixe quand le PREMIER des deux bateaux atteint la zone. Engagés à ce moment : l'extérieur donne la place à l'intérieur. Non engagés : celui qui n'a pas encore atteint la zone donne la place à l'autre, et continue à la donner même si un engagement se crée ensuite. Un bateau qui s'engage à l'intérieur après cela n'a aucun droit à la place.
- 18.2(d) vise seulement le cas où 18.2(a) ou (c) donnerait la place à un bateau engagé par derrière ou en virant au vent, alors que l'extérieur n'a pas pu la donner : il retire un droit, il n'en crée jamais.
- 18.1 : la règle 18 ne s'applique pas entre bâbord et tribord au près (règle 10), ni à une marque de départ à l'approche du départ (préambule section C).
- 30.1 (I) porte sur la ligne et ses prolongements, pas sur le triangle ; le triangle concerne Z, U et noir.
- Avant le signal de départ, aucun bateau n'a de route normale.
- Ne cite que des règles qui s'appliquent vraiment à la situation ; n'en cite pas deux fois la même.

${CVAT}

=== TEXTE OFFICIEL RRS 2025-2028 (extraits : signaux, définitions, chapitres 1 à 4, règle 60) ===
${RRS}`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['verdict', 'explication', 'regles', 'ic', 'attention'],
  properties: {
    verdict: { type: 'string' },
    explication: { type: 'string' },
    regles: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['numero', 'titre', 'en', 'fr'], properties: { numero: { type: 'string' }, titre: { type: 'string' }, en: { type: 'string' }, fr: { type: 'string' } } } },
    ic: { type: 'string' },
    attention: { type: 'string' },
  },
};

// Comparaison tolérante à la mise en page du PDF (sauts de ligne, colonnes, apostrophes)
const norm = (s) => String(s).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const CORPUS = norm(RRS);
const verbatim = (en) => { const n = norm(en).replace(/^["«\s]+|["»\s]+$/g, ''); return n.length > 20 && CORPUS.includes(n); };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'no_key' });
  const question = String(req.body?.question || '').trim().slice(0, 1500);
  if (!question) return res.status(400).json({ error: 'question manquante' });
  const history = (Array.isArray(req.body?.history) ? req.body.history : []).slice(-6)
    .map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '').slice(0, 1500) }))
    .filter((h) => h.content);
  try {
    client ??= new OpenAI();
    const response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM,
      input: [...history, { role: 'user', content: question }],
      reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'arbitre', schema: SCHEMA, strict: true } },
    });
    const out = JSON.parse(response.output_text);
    out.regles = (out.regles || []).map((r) => ({ ...r, verifie: verbatim(r.en) }));
    return res.status(200).json(out);
  } catch (err) {
    const status = err instanceof OpenAI.APIError ? err.status || 502 : 500;
    return res.status(status).json({ error: String(err.message || err).slice(0, 300) });
  }
}
