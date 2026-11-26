# Phase 8 : Espace Tofinou — rade de Bormes – Le Lavandou — Contexte

**Recueilli :** 2026-11-26, avec Romain (« créer la même chose pour un Tofinou dans la rade de Bormes / Le Lavandou, à partager avec un code… sans accès aux régates de J80 de Toulon et Brest » ; réponses : accès pour Frédéric ; Romain dans les deux espaces avec bascule ; Bormes seulement ; même quota d'IA)
**Statut :** décisions fixées (défauts recommandés là où Romain n'a pas tranché ; il peut en changer)
**Échéance :** pas de production avant la régate de Toulon du 13/12/2026 ; v44 en production ensuite, sur « publie » de Romain.

<domain>
## Périmètre
Un second « espace » (tenant) dans le même projet et le même déploiement : espace « Tofinou — Bormes » pour un Tofinou 9.5, plan d'eau Bormes – Le Lavandou, membres Frédéric (et Romain), cloisonné de l'espace Naos (J80, Toulon, Brest). Références : 08-RESEARCH.md (cloisonnement), 08-RESEARCH-PLAN-EAU.md (plan d'eau, régates, vents, courants, polaire).
Hors périmètre : autres bateaux ou plans d'eau ; Trophée des Îles (Porquerolles) et Saint-Tropez ; modèle de courant à Bormes.
</domain>

<decisions>
## Décisions

### A. Naos ne change pas
- **D-01 :** gel de Naos v43 AVANT toute modification (réponses du middleware, chemins Blob, empreintes des consignes d'IA, clés de stockage, SHELL), en plus des gardes Toulon de la phase 7 et de la garde SNPM ; un écart casse `npm test`. L'équipage de Naos garde la même URL, la même archive (`prod/light.json`), les mêmes clés locales.

### B. Espaces et cloisonnement
- **D-02 :** le code d'accès décide de l'espace, jamais l'app. `middleware.js` garde la table de Naos telle quelle et reçoit une table Tofinou séparée (empreintes seulement) ; il pose `x-rt-espace` en écrasant toute valeur du client ; `/api/membre` rend `{ membre, espace }`.
- **D-03 :** une adresse distincte par espace (même projet, même déploiement) pour que le navigateur sépare stockage, caches, service worker et cookie : l'espace Tofinou sur un second nom de domaine du projet (proposé : `tofinou-bormes.vercel.app`, à ajouter par Romain dans Vercel ; à confirmer au moment de la livraison). Le code de Romain est valable dans les deux espaces ; « Changer d'espace » ouvre l'autre adresse (bascule demandée par Romain). Frédéric n'a accès qu'à l'espace Tofinou.
- **D-04 :** archive cloisonnée côté serveur par préfixe calculé à partir de `x-rt-espace` (`tofinou/prod/…`, `tofinou/preview/…`) ; Naos garde ses préfixes à l'octet près ; sans espace valide : 403. L'archive Tofinou refuse les régates d'un autre plan d'eau, les graines SNPM/GPEN et les recalages de bouées CVAT. Garde dans l'app : pas de synchronisation si `/api/membre` annonce un autre espace que celui de l'adresse.
- **D-05 :** plans d'eau par espace : Tofinou ne voit que Bormes (packs de Brest et, si possible, de Toulon refusés à l'espace Tofinou par le middleware, sans casser l'installation hors réseau — vérifier) ; Naos ne voit pas Bormes. Aucune graine SNPM/GPEN dans l'espace Tofinou.
- **D-06 :** IA : même clé et même budget OpenAI (choix de Romain), quota de 30 appels par personne et par jour compté par espace + prénom ; consignes de l'arbitre, du débrief et de la dictée propres à l'espace Tofinou (Tofinou 9.5, Challenge de la Baie, RIR, un tour) ; celles de Naos inchangées (empreintes figées).
- **D-07 :** textes, manifeste et nom par espace (« Tofinou — Bormes ») ; stockage local séparé de fait par l'adresse.
- **D-08 :** outil de création de codes : affiche le code une seule fois, n'écrit que l'empreinte ; le code de Frédéric est donné à Romain dans la conversation, jamais écrit dans le dépôt.

### C. Bateau
- **D-09 :** polaire Tofinou 9.5 tirée du certificat ORC Club 2026 du sister-ship (variante génois par défaut, variante foc disponible) ; `data/tofinou95.pol` au format de `data/j80.pol`, chargée comme polaire par défaut de l'espace ; recalage par l'équipage (performance, polaire personnelle). Longueur 9,47 m (textes, règles de zone), pertes virement 11 s / empannage 8 s, tirant d'eau à confirmer (1,20 / 2,20 m). Confiance affichée comme estimation.

### D. Plan d'eau de Bormes
- **D-10 :** pack `bormes` : emprise 6,22–6,60° E, 42,96–43,20° N, maille 30 m, mêmes outils que Brest (outil d'instantané météo étendu à `bormes` ; Levant « militaire » à ne pas classer en urbain) ; borne ouest de saisie à 6,20° E pour ne pas recouvrir Toulon ; seuil « mer dégagée » par défaut (4 000 m).
- **D-11 :** pas de marée ni de modèle de courant (marnage ~21 cm) ; simple mention du courant général d'ouest entre les îles pour les côtiers.
- **D-12 :** régimes de vent de Bormes (ouest fort ~260°, est, brise tournant à droite…), conseils marqués selon leur origine et « à confirmer sur l'eau » ; supprimer les textes de Toulon en dur (« large de Cépet », `js/app.js:894`).
- **D-13 :** catalogue du Challenge de la Baie 2026-2027 (neuf parcours, dont la banane n° 4, La Fourmigue, coffre 1, cap Nègre, Bénat, Cavalaire, tour de Port-Cros), marques fixes sûres (La Fourmigue, coffre 1) et bouées mouillées marquées « position à confirmer » ; fiche « Challenge de la Baie 2026-2027 » semée dans l'espace Tofinou (sept manches, VHF 72, un tour, RIR) — corriger la date de la manche 1 (dimanche 11/10).
- **D-14 :** zones interdites : partie militaire du Levant, Brégançon (partielle), règles de Port-Cros (5 nd à moins de 300 m) — marquées « à compléter sur carte marine ».

### Livraison
- **D-15 :** branche `apercu-phase-08`, PR brouillon, aperçu vérifié ; production (v44) après le 13/12 sur « publie » ; Romain ajoute le domaine du second espace dans Vercel ; contrôles humains : bateau exact (voile d'avant, quille), arrêtés du Levant et de Brégançon, positions des bouées, conseils de vent relus, polaire recalée sur l'eau.
</decisions>

<canonical_refs>
## Références
- 08-RESEARCH.md, 08-RESEARCH-PLAN-EAU.md
- Phase 7 (packs, gardes Toulon, compat), tools/gardes-toulon.mjs
</canonical_refs>
