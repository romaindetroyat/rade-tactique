// Instructions de course du GPEN (zone A, J80) pour les consignes des fonctions d’IA à Brest (07-09, D-11) : texte fixe, jamais complété par
// une valeur reçue. D’après les IC 2022-2026 (07-RESEARCH § B.2-B.4) ; à mettre à jour avec les IC 2027 (fin avril 2027). Pas une route (« _ »).

export const GPEN = `Instructions de course du GPEN (Grand Prix de l’École navale, rade de Brest, zone A des J80), d’après les IC 2026, qui modifient les RRS :
- Pénalité : un seul tour (un virement et un empannage) au lieu de deux (RCV 44.1 modifiée, IC 15.1).
- Jugement semi-direct possible en zone A (IC 15.2, annexe 2) : le bateau qui réclame hèle « Protest » et montre un pavillon rouge ; le juge sur l’eau répond pavillon vert et blanc (pas de pénalité) ou pavillon rouge (une pénalité a été donnée ou reste en suspens).
- Pavillon orange avec un son au moins 2 min avant le signal d’avertissement (IC 6.1).
- Ligne de départ : mât à pavillon orange du bateau comité (à tribord) et marque de départ blanche ou viseur (à bâbord). Un bateau qui ne part pas au plus tard 4 min après son signal de départ est classé DNS sans instruction (IC 12.4).
- Marques 1 et 2 à bâbord, porte 3S/3P ; si une marque de la porte manque, contourner l’autre à bâbord (IC 10.3). Une marque peut être déplacée de ±10° et d’environ 200 m sans signal de changement (IC 13.2).
- Ligne d’arrivée : mât à pavillon bleu et marque d’arrivée, à droite du comité (IC 14.1).
- Temps limites des J80 : 90 min pour le premier, 20 min après le premier, sinon DNF (IC 16).
- Réclamations : 60 min après que le dernier bateau a fini la dernière course du jour (IC 17.1).
- Canal de course : VHF 14 (zone A).
- Zones interdites, qui sont des obstacles : autour de l’Île Longue (marques spéciales 0 à 10) et entre la cardinale de Pen ar Vir et la pointe du même nom (IC annexe 5).
Bateau : J80, longueur de coque 8 m (zone = 24 m, deux longueurs = 16 m).`;

// Plan d’eau d’une requête : liste fermée ; toute autre valeur (absente, inconnue, objet, casse différente) → Toulon (consignes de la v42)
export const venueOf = (body) => (body?.venue === 'brest' ? 'brest' : 'toulon');
