// Plan d’eau courant : exports vivants lus par le moteur (tactique, débrief, 3D, app). À Toulon ce sont LES MÊMES objets que
// js/courses.js (les bouées de régate et la banane y sont injectées sur place, comme en v42). `setVenue` est appelé une seule fois,
// au tout début de js/app.js, avant tout toXY ; changer de plan d’eau demande un rechargement de l’app (D-05).

import { setOrigin } from './geo.js';
import { VENUES } from './venues.js';

export let VENUE = VENUES.toulon;
export let MARKS = VENUE.MARKS, COURSES = VENUE.COURSES, LINE_PRESETS = VENUE.LINE_PRESETS, PLACES = VENUE.PLACES,
  FORBIDDEN_ZONES = VENUE.FORBIDDEN_ZONES, DANGERS = VENUE.DANGERS;

// Corps des requêtes aux fonctions d’IA (07-09, D-11) : plan d’eau ajouté seulement hors de Toulon (à Toulon, corps identique à la v42)
export const venueBody = () => (VENUE.id === 'toulon' ? {} : { venue: VENUE.id });

let change = false;          // vrai dès que l’origine a quitté Toulon : un autre changement est refusé

export function setVenue(id) {
  const v = Object.hasOwn(VENUES, id) ? VENUES[id] : VENUES.toulon;
  if (v === VENUE) return VENUE;                                         // même plan d’eau : rien à recalculer
  if (change) throw new Error('changer de plan d’eau demande un rechargement de l’app');
  change = true;
  setOrigin(v.origin);
  VENUE = v;
  ({ MARKS, COURSES, LINE_PRESETS, PLACES, FORBIDDEN_ZONES, DANGERS } = v);
  return VENUE;
}
