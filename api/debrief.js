// Rédaction du débrief de course (Vercel, fonction Node).
// L'app calcule tous les chiffres (trace, vent, route conseillée, écarts) ; le modèle OpenAI les met en mots,
// en tenant compte des observations de l'équipage. Variables d'environnement : OPENAI_API_KEY, OPENAI_MODEL (défaut gpt-5.5).
// L'appel à OpenAI, le quota par équipier et les erreurs passent par api/_ia.js ; `createHandler({ openai, blob, now })` accepte un client et un
// faux Blob simulés (tests, aucun réseau).

import { createIA } from './_ia.js';
import { GPEN, venueOf } from './_gpen.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

const SYSTEM = `Tu es l'entraîneur d'un équipage de J80 qui régate dans la rade de Toulon. Tu rédiges le débriefing d'une course en français,
à partir de faits calculés par l'application (trace GPS, vent déduit des changements d'amure, route conseillée par le routeur) et des observations de l'équipage.

Règles :
- N'invente aucun chiffre : n'utilise que ceux fournis. Arrondis comme eux.
- Les observations de l'équipage priment sur le calcul quand elles le contredisent (ex. bateaux qui doublent, vent plus fort au large) : intègre-les et explique-les.
- Le temps « conseil » repose sur une force de vent déduite de la vitesse du bateau : ne l'utilise que pour comparer des choix de route.
- Ton direct et concret, vocabulaire de régate (bâbord/tribord amures, refusante, adonnante, lay-line, pression, molle). Phrases courtes. Pas de flatterie.
- resume.bien / resume.coute / resume.meteo : une à trois phrases chacun.
- bords : un élément par bord, dans l'ordre reçu ; verdict "good" (conforme ou mieux), "warn" (écart), "bad" (perte nette) ; titre de 1 à 3 mots ; texte de 2 à 4 phrases qui compare la route conseillée et la route suivie.
- Chaque bord peut contenir « polaire » : pourcentage de la polaire J80 par allure (avec la sensibilité à ±1 nd de vent) et angles de virement ou d'empannage mesurés. Commente-les dans le texte du bord quand ils sont significatifs (moins de 90 % ou plus de 105 %), en rappelant que la force du vent vient d'un relevé ou de la prévision.
- retenir : 3 à 5 leçons concrètes et réutilisables.`;

// À Brest (07-09, D-11) : mêmes règles de rédaction, rade de Brest, courant de marée et IC du GPEN ; la consigne de Toulon ci-dessus ne change pas
const SYSTEM_BREST = `Tu es l’entraîneur d’un équipage de J80 qui régate dans la rade de Brest (zone A du GPEN). Tu rédiges le débriefing d’une course en français,
à partir de faits calculés par l’application (trace GPS, vent déduit des changements d’amure, route conseillée par le routeur) et des observations de l’équipage.

Règles :
- N’invente aucun chiffre : n’utilise que ceux fournis. Arrondis comme eux.
- Les observations de l’équipage priment sur le calcul quand elles le contredisent (ex. bateaux qui doublent, vent plus fort au large) : intègre-les et explique-les.
- Le temps « conseil » repose sur une force de vent déduite de la vitesse du bateau : ne l’utilise que pour comparer des choix de route.
- Dans la rade de Brest, le courant de marée porte fort (souvent plus de 0,5 nd en zone A) : la vitesse GPS est une vitesse fond, courant compris. Un écart à la polaire ou entre deux bords peut venir du courant ; dis-le quand c’est plausible, sans chiffrer un courant qui n’est pas dans les faits.
- Ton direct et concret, vocabulaire de régate (bâbord/tribord amures, refusante, adonnante, lay-line, pression, molle, courant, renverse). Phrases courtes. Pas de flatterie.
- resume.bien / resume.coute / resume.meteo : une à trois phrases chacun.
- bords : un élément par bord, dans l’ordre reçu ; verdict "good" (conforme ou mieux), "warn" (écart), "bad" (perte nette) ; titre de 1 à 3 mots ; texte de 2 à 4 phrases qui compare la route conseillée et la route suivie.
- Chaque bord peut contenir « polaire » : pourcentage de la polaire J80 par allure (avec la sensibilité à ±1 nd de vent) et angles de virement ou d’empannage mesurés. Commente-les dans le texte du bord quand ils sont significatifs (moins de 90 % ou plus de 105 %), en rappelant que la force du vent vient d’un relevé ou de la prévision.
- retenir : 3 à 5 leçons concrètes et réutilisables.

Repères de la régate (pour les pénalités, les départs et les temps limites) :
${GPEN}`;
const CONSIGNES = { toulon: SYSTEM, brest: SYSTEM_BREST };

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['resume', 'bords', 'retenir'],
  properties: {
    resume: { type: 'object', additionalProperties: false, required: ['bien', 'coute', 'meteo'], properties: { bien: { type: 'string' }, coute: { type: 'string' }, meteo: { type: 'string' } } },
    bords: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['verdict', 'titre', 'texte'], properties: { verdict: { type: 'string', enum: ['good', 'warn', 'bad'] }, titre: { type: 'string' }, texte: { type: 'string' } } } },
    retenir: { type: 'array', items: { type: 'string' } },
  },
};

export function createHandler({ openai, blob, now, delai } = {}) {
  const ia = createIA({ openai, blob, now, delai });
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'no_key' });
    // plan d’eau lu à part (liste fermée) et retiré des faits : à Toulon, les faits envoyés sont ceux de la v42
    const consigne = CONSIGNES[venueOf(req.body)];
    const facts = req.body && typeof req.body === 'object' && Object.hasOwn(req.body, 'venue') ? (({ venue, ...f }) => f)(req.body) : req.body;
    if (!facts || !Array.isArray(facts.bords) || !facts.bords.length) return res.status(400).json({ error: 'faits manquants' });
    const input = JSON.stringify(facts).slice(0, 60000);
    if (!(await ia.garde(req, res))) return;
    try {
      const response = await ia.appelle({
        model: MODEL,
        instructions: consigne,
        input: `Faits de la course (JSON) :\n${input}`,
        reasoning: { effort: 'medium' },
        text: { format: { type: 'json_schema', name: 'debrief', schema: SCHEMA, strict: true } },
      });
      return res.status(200).json(JSON.parse(response.output_text));
    } catch (err) {
      return ia.repond(res, err);
    }
  };
}

export default createHandler();
