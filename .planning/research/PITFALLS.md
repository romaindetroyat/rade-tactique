# Pitfalls Research

**Domain:** PWA de tactique de régate (iPhone en mer), sans build, sur Vercel. Jalon : archive partagée en ligne, synchro hors ligne, fiabilité en mer, import d'IC d'autres clubs, tests de modèles numériques.
**Researched:** 2026-10-19
**Confidence:** MEDIUM-HIGH. Les règles de stockage WebKit, le Wake Lock, le Blob privé de Vercel et la rétention OpenAI sont vérifiés sur des sources officielles. Le comportement de l'iPhone écran verrouillé, la reconnaissance vocale en app installée et le bouton silencieux reposent sur des sources secondaires ou des bugs WebKit : ils sont marqués et doivent être confirmés sur les iPhone de l'équipage avant la régate du 7-9 novembre.

Légende des niveaux : [H] source officielle (WebKit, Vercel, OpenAI, W3C) ou lecture directe du code ; [M] bug tracker, doc tierce sérieuse ou recoupement ; [L] témoignages de forums, à tester sur appareil.

---

## Ce qui a été vérifié (et ce qui ne l'est pas)

| Affirmation | Niveau | Source |
|---|---|---|
| Les apps ajoutées à l'écran d'accueil sont exemptées du plafond ITP de 7 jours sur tout le stockage écrit par script (IndexedDB, localStorage, SW, caches). Un onglet Safari ne l'est pas. | [H] | webkit.org/tracking-prevention |
| Les données d'une app installée sont séparées de celles de Safari. Les cookies de connexion sont copiés une seule fois, à l'ajout à l'écran d'accueil (iOS 17.2+). | [M] | firt.dev/notes/pwa-ios, notes Safari 17.2 (relayées), bug WebKit « session cookies reset » iOS 17.2-17.4.1 |
| Le stockage est « best-effort » par défaut et peut être évincé (pression disque, inutilisation). `navigator.storage.persist()` est accordé selon des heuristiques, notamment pour une app installée. | [H] | webkit.org/blog/14403 |
| Wake Lock : ne marche en app installée que depuis iOS 18.4 (bug 254545 corrigé). Il se libère quand la page est masquée et doit être redemandé. | [H] | bugs.webkit.org/show_bug.cgi?id=254545 |
| Géolocalisation : pas de position en arrière-plan ni écran éteint pour une web app. | [M] | forums, Progressier. Aucune doc Apple. À mesurer sur appareil. |
| Pas de Vibration API, pas de Background Sync sur iOS. | [M] | firt.dev, rapport W3C iOS 17.4.1, WebKit bug 201866 |
| Web Audio suit le type de session « ambient » par défaut, donc se tait avec le bouton silencieux. `navigator.audioSession.type = "playback"` est la parade, mais sa prise en charge est expérimentale. | [M] | WebKit bug 264473, MDN (API expérimentale) |
| `webkitSpeechRecognition` : absente des web apps installées d'après un ingénieur WebKit (2021), bug classé LATER, aucune correction trouvée. | [M] | bugs.webkit.org/show_bug.cgi?id=225298 |
| Vercel Blob : un store privé exige une authentification en lecture. Vercel déconseille de s'appuyer sur le middleware pour l'auth des blobs. Écrasement : propagation jusqu'à 60 s. `ifMatch` (ETag) existe pour les écritures conditionnelles. | [H] | vercel.com/docs/vercel-blob/private-storage |
| OpenAI : journaux anti-abus conservés jusqu'à 30 jours. L'API Responses a une rétention d'état de 30 jours par défaut. | [H] | developers.openai.com/api/docs/guides/your-data |
| pdf.js vendorisé en 3.x (le fichier annonce 3.32.2). Les versions ≤ 4.1.392 sont dans la plage de GHSA-wgrm-67xf-hhpq / CVE-2024-4367 (exécution de JS via une police de PDF). Contournement : `isEvalSupported:false`. | [M] | GitHub advisory, lecture de `vendor/pdf.min.js`. Rétroportage non vérifié. |
| iOS 26 : tout site ajouté à l'écran d'accueil s'ouvre en web app par défaut, sauf si l'utilisateur désactive « Ouvrir comme app web ». | [M] | firt.dev, couverture WWDC25 |

---

## Critical Pitfalls

### Pitfall 1 : croire que le GPS, la trace et le chrono continuent écran verrouillé ou app en arrière-plan

**What goes wrong:**
Un équipier lance « En course », range le téléphone dans la poche ou l'écran se verrouille. iOS suspend la page : `watchPosition` ne livre plus de points, les `setInterval` du chrono s'arrêtent, le verrou d'écran est libéré. La trace a un trou de 10 à 40 minutes. Rien n'est signalé, et le débrief « détecte » ensuite un parcours faux ou rate le départ. Dans le code actuel (`js/track.js`, `js/app.js:718-738`), `Recorder.add` ne note jamais de coupure, et `startGps` n'a ni minuterie de péremption ni indicateur « dernier point il y a X s ».

**Why it happens:**
Sur Android, un PWA ou Chrome tolère plus de choses. Un web app iOS n'a aucun mode de localisation en arrière-plan. Le Wake Lock est la seule parade, et il demande iOS 18.4+ en app installée. Il est refusé ou libéré en mode économie d'énergie et dès que la page est masquée. Le code redemande le verrou à `visibilitychange` pour `Recorder`, mais `startmode.js` ne le fait qu'à l'ouverture. Les erreurs sont avalées (`catch { this.lock = null }`).

**How to avoid:**
- Poser le principe de conception : une app web iOS ne peut enregistrer que « écran allumé, app au premier plan ». Ne pas promettre davantage dans l'interface ni dans le guide. Garder Open GPX Tracker, qui est natif et tourne en arrière-plan, comme enregistreur de secours officiel de l'équipage, et faire de l'import GPX un parcours de première classe, pas un à-côté.
- Écouter l'événement `release` du `WakeLockSentinel`, le redemander à chaque retour de visibilité (dans `startmode.js` aussi), et afficher un voyant permanent « écran maintenu éveillé : oui/non ».
- Si le verrou est refusé : instruction explicite (Réglages > Luminosité > Verrouillage automatique : Jamais, mode économie d'énergie coupé) et repli connu (vidéo muette en boucle, à tester d'abord sur l'iOS de l'équipage).
- Marquer les coupures dans les données : enregistrer les événements `hidden`/`visible` dans la trace, calculer l'écart entre points, et afficher au retour « trace interrompue de 12:03 à 12:27 ». Le débrief doit traiter un trou comme un trou, pas comme une ligne droite.
- Sauvegarde incrémentale : enregistrer à chaque N points ET à chaque `visibilitychange`/`pagehide`, pas seulement toutes les 20 s.
- Reprise après arrêt brutal : marquer la trace `enCours:true` dans IndexedDB, et au lancement proposer « Une trace n'a pas été terminée (12:03 à 12:51) : reprendre / clore ».
- Faire l'inventaire des iPhone de l'équipage (version d'iOS, mode économie, réglage de verrouillage) avant toute autre chose.

**Warning signs:**
Trace de 2 h qui ne contient que 40 min de points. Wake lock `null` après un retour d'arrière-plan. Un équipier dont l'iOS est < 18.4 et qui a installé l'app sur l'écran d'accueil. Alerte de permission de localisation qui revient à chaque lancement de l'app installée [L].

**Phase to address:** Phase A (fiabilité en mer). À faire en premier.

---

### Pitfall 2 : chrono de départ et bips qui se taisent ou sautent au pire moment

**What goes wrong:**
La séquence 5-4-1-0 est ce que l'équipage regarde le plus. Dans `tickTimer` (`js/app.js:~700`), les bips sont émis à partir d'un `setInterval(…, 100)` et d'un `Set` de secondes déjà jouées. Si le fil principal gèle (calcul du vent : 420 itérations sur 140 x 135 cellules, scène Three.js, fond de carte), les secondes sautées ne sont jamais rattrapées : le bip à 60 s ou 10 s n'existe simplement pas. L'`AudioContext` peut passer en `interrupted` (appel, Siri, notification), et Web Audio peut se taire avec le bouton silencieux. `navigator.vibrate` n'existe pas sur iPhone, donc le retour haptique du code est un no-op silencieux.

**Why it happens:**
Le chrono lit bien un horodatage de fin (`timer.end`), ce qui est correct. Mais le son dépend d'une boucle de scrutation sur le thread qui fait aussi tout le reste, et l'initialisation audio est faite une seule fois.

**How to avoid:**
- Planifier tous les bips à l'ouverture du chrono sur l'horloge audio (`osc.start(ctx.currentTime + delta)` pour chaque jalon), pas depuis un `setInterval`. Recalculer et replanifier si le chrono est recalé (rappel général, report).
- Suspendre le rendu 3D et tout calcul lourd (`F.compute()`, `kit()`) quand le mode départ est ouvert, ou au moins dans les 6 dernières minutes.
- Gérer `audioContext.onstatechange` et `visibilitychange` : si l'état n'est pas `running`, appeler `resume()` et afficher un badge rouge « SON COUPÉ ». Prévoir un bouton « test du son » avant la séquence.
- Essayer `navigator.audioSession.type = 'playback'` (avec détection de fonctionnalité) et garder un élément `<audio>` court comme repli, qui ne dépend pas du bouton silencieux [M]. Tester sur iPhone avec le bouton silencieux enclenché.
- Doubler chaque signal d'un signal visuel plein écran (flash de la couleur de phase). Ne pas compter sur la vibration sur iPhone.
- Un jalon manqué (téléphone figé 3 s) doit être signalé visuellement, pas rejoué en retard sans le dire.

**Warning signs:**
Bips décalés quand la page 3D est ouverte en parallèle. Aucun son après un appel ou un message vocal. Bouton silencieux actif. Chrono correct mais bips en retard de 1 à 2 s.

**Phase to address:** Phase A.

---

### Pitfall 3 : la mise à jour du service worker recharge l'app en pleine course

**What goes wrong:**
`sw.js` appelle `skipWaiting()` à l'installation et `clients.claim()` à l'activation. `js/app.js:85-90` recharge la page sur `controllerchange`. Si Romain déploie le matin de la régate, ou entre deux manches, les téléphones qui reviennent en ligne rechargent l'app, ce qui détruit l'état en mémoire : `Recorder.track`, chrono, mode départ ouvert, ligne pingée non persistée. L'enregistrement s'arrête sans prévenir. Le point secondaire connu (modules mélangés ancien/nouveau pendant la bascule) s'ajoute à cela.

**Why it happens:**
La « mise à jour sans intervention » est confortable en développement. Aucune règle ne dit « pas de rechargement si un enregistrement ou un chrono est actif », et `VERSION` et `SHELL` sont tenus à la main.

**How to avoid:**
- Supprimer le rechargement automatique. Remplacer par une bannière « Nouvelle version prête : appliquer après la course », qui n'agit jamais si `recorder.active`, mode départ ouvert ou chrono en cours.
- Retirer `skipWaiting()` automatique : activer la nouvelle version seulement après action explicite ou au prochain lancement à froid.
- Générer `VERSION` et `SHELL` à partir d'un hash des fichiers, via un petit script Node lancé avant déploiement (pas d'outil de build à introduire). Un test vérifie que chaque fichier de `js/`, `data/` et `vendor/` utilisé est listé, et que `APP_VERSION` et `VERSION` viennent d'une même source.
- Règle d'exploitation, écrite dans le guide : pas de déploiement de production dans les 48 h avant une régate ni le jour même, sauf correctif critique. L'archive et ses nouvelles API ne doivent pas casser la version déjà installée : toute évolution d'API est rétrocompatible pendant deux versions.
- Afficher la version réellement exécutée dans l'écran de départ, pour qu'un équipier puisse dire « je suis en v26 ».

**Warning signs:**
Un déploiement le vendredi soir. Un équipier signale que « l'app s'est relancée toute seule ». Version affichée différente entre deux téléphones du même bateau.

**Phase to address:** Phase A (comportement du SW), puis règle d'exploitation permanente.

---

### Pitfall 4 : stratégie « réseau d'abord » sans délai, qui fige l'app en mer

**What goes wrong:**
Dans `sw.js`, chaque requête same-origin fait `fetch(request, {cache:'no-cache'})` et ne se replie sur le cache qu'en cas d'échec. En mer avec une barre de 4G, la requête n'échoue pas : elle traîne jusqu'au délai d'attente du système (de l'ordre d'une minute). Chaque module (`app.js`, `wind.js`, `terrain.bin` 1,1 Mo…) attend son tour. L'app semble gelée au lancement alors que tout est déjà dans le cache. `navigator.onLine` ne détecte pas ce cas. Le même piège attend les futurs appels d'archive.

**Why it happens:**
La stratégie a été choisie pour recevoir les mises à jour, et le test a eu lieu sur du réseau soit bon, soit absent, jamais « mauvais ».

**How to avoid:**
- Pour le shell versionné (fichiers du `SHELL`) : cache d'abord, avec vérification de la version en arrière-plan et bannière de mise à jour (voir pitfall 3). Les deux problèmes se résolvent avec la même stratégie.
- Pour tout `fetch` réseau restant : course entre la requête et un délai de 3 s, puis repli sur le cache ou un état « hors ligne ». Même règle côté client (`AbortController`) pour les API d'archive et de météo.
- Le trajet critique (mode départ, GPS, chrono, carte, parcours) ne doit effectuer aucun appel réseau bloquant. Les prévisions et l'archive se chargent après l'affichage, avec des délais.
- Tester avec une limitation réseau très lente et une perte de paquets, pas seulement en mode avion (réglages réseau de Safari Web Inspector, ou réseau dégradé de macOS).

**Warning signs:**
« L'app reste blanche quand on est au large mais pas au ponton ». Écran de lancement qui dure plus de 5 s sans mode avion.

**Phase to address:** Phase A.

---

### Pitfall 5 : perdre des données à cause de la séparation Safari / app installée et de l'éviction du stockage

**What goes wrong:**
- Les données locales d'un appareil sont dans deux boîtes étanches : l'onglet Safari et l'app installée ne partagent ni localStorage, ni IndexedDB, ni cookies [M]. Avec iOS 26, une même icône peut s'ouvrir en web app ou en simple signet selon un réglage de l'utilisateur : le même équipier peut avoir deux jeux de traces sans le savoir.
- Un onglet Safari qui n'a pas été utilisé depuis 7 jours perd localStorage, IndexedDB, cache et service worker (ITP). L'app installée est exemptée [H].
- Le stockage est « best-effort » : sous pression disque, WebKit évince des origines [H].
- `store.set` / `save` avalent `QuotaExceededError` (`catch { /* indisponible */ }`), et `saveTrack(T).catch(() => {})` ignore les échecs d'écriture IndexedDB. Une trace peut n'exister nulle part sans que personne le sache.
- Jusqu'à l'envoi à l'archive, la seule copie d'une trace est dans un téléphone qui est sur un bateau.

**Why it happens:**
La persistance locale est ressentie comme « sûre » parce que ça marche en développement. Les cas d'éviction apparaissent des semaines plus tard.

**How to avoid:**
- Appeler `navigator.storage.persist()` dès le premier lancement de l'app installée, et afficher le résultat dans un écran « Diagnostic » (installée ? persistante ? quota restant ? version d'iOS ?).
- Rendre l'état de synchro visible partout : « 3 éléments non envoyés ». Envoyer la trace automatiquement à l'arrêt de l'enregistrement et dès qu'une connexion saine est détectée (au ponton), pas seulement quand l'utilisateur y pense.
- Garder la copie locale jusqu'à l'accusé de réception du serveur et à une relecture de contrôle. Ne jamais purger sur une réponse 200 non vérifiée.
- Conserver l'export GPX par le menu Partager comme sauvegarde manuelle toujours disponible.
- Remplacer les `catch {}` par un journal local d'erreurs consultable (et, plus tard, envoyé à l'archive). C'est le seul moyen de connaître les échecs du terrain.
- Migration des données existantes (`rade.state`, `rade.events.v1`, `rade-traces`, observations) : opération explicite « Envoyer mes données locales », idempotente (identifiants stables), avec aperçu du nombre d'éléments, jamais automatique et destructive.
- Dire dans l'écran d'accueil de l'app : « utilisez l'icône de l'écran d'accueil, pas Safari ».

**Warning signs:**
Un équipier affirme avoir « perdu » une trace qui est dans l'autre contexte. Compteur « éléments non envoyés » qui augmente sans retomber. `persisted()` retourne `false`.

**Phase to address:** Phase A (diagnostic, erreurs visibles, `persist()`), Phase D (synchro, migration).

---

### Pitfall 6 : l'accès par cookie se casse entre Safari et l'app installée

**What goes wrong:**
Le lien personnel `?acces=CODE` ouvert depuis un message s'ouvre dans Safari : le cookie est posé dans Safari, pas dans l'app installée. Les cookies de connexion ne sont copiés qu'une fois, au moment de l'ajout à l'écran d'accueil (iOS 17.2+), et des régressions de cookies de session ont été signalées sur iOS 17.2 à 17.4.1 [M]. Résultat : l'app installée affiche `acces.html` au pire moment, parfois hors réseau. Une fois les API d'archive ajoutées, un 401 inattendu au milieu d'une synchro peut aussi faire perdre la file d'attente si le code la jette sur erreur.

**Why it happens:**
Le middleware est un point d'accès unique et simple, mais l'équipage n'a pas de session ré-établissable sans réseau.

**How to avoid:**
- Parcours d'installation documenté et testé sur chaque iPhone : 1) ouvrir le lien personnel dans Safari, 2) ajouter à l'écran d'accueil, 3) ouvrir l'app installée et vérifier que l'accès est reconnu. Sinon saisir le code dans l'app (déjà prévu par `acces.html`).
- Écran de diagnostic : « Accès : reconnu en tant que Teiva » via un petit `GET /api/moi`, avec message clair en cas de 401.
- Une réponse 401 ou une redirection vers `acces.html` ne doit jamais effacer ni abandonner la file d'attente de synchro : l'état passe à « reconnectez-vous » et la file attend.
- Ne pas casser le cookie actuel pendant la migration vers un jeton de session (voir Security) : accepter les deux formats pendant un temps, pour que personne ne soit déconnecté la semaine d'une régate.
- Le shell en cache doit s'ouvrir hors réseau même sans cookie valide ; seules les fonctions réseau demandent la connexion.

**Warning signs:**
Un équipier voit la page de code en ouvrant l'app. 401 en cascade dans la console après un changement d'iOS.

**Phase to address:** Phase A (parcours d'installation), Phase C (identité côté serveur).

---

### Pitfall 7 : des fichiers privés qui échappent au contrôle d'accès

**What goes wrong:**
Plusieurs façons de rendre public ce qui devait être réservé :
1. Le matcher du middleware exclut `rapports/`, `icons/`, `acces.html`, `sw.js`, `manifest.webmanifest`. Une archive de rapports rangée sous `rapports/` serait publique. Le rapport existant (`coupe-snpm-2026.html`, 250 Ko) contient déjà la trace et la tactique du bateau.
2. Un store Vercel Blob public génère des URL lisibles par quiconque les possède. Elles ne passent jamais par le middleware du site. Il suffit qu'une URL fuite (journal, capture, message) pour que les traces soient accessibles à tous.
3. Vercel déconseille de compter sur le middleware pour protéger des blobs privés : une erreur de configuration pourrait exposer un contenu mis en cache à la mauvaise personne [H].
4. Le middleware ne transmet pas l'identité du membre aux fonctions. Une API qui n'a que `next()` derrière elle ne sait pas qui écrit, et on ajoutera un champ `auteur` fourni par le client, donc falsifiable.
5. Les réponses d'archive avec un `Cache-Control` par défaut ou `s-maxage` peuvent être mises en cache par le CDN ou le service worker : le SW de l'app met en cache toute réponse same-origin `ok` hors `/api/`, donc un chemin d'archive hors `/api/` serait conservé dans le cache de l'appareil même après la révocation d'un membre.

**Why it happens:**
Le matcher actuel est une liste de chemins publics, ce qui est la bonne polarité (tout est protégé par défaut) mais chaque nouveau dossier public élargit la brèche. Les fichiers stockés ont une URL propre, hors du site.

**How to avoid:**
- Store Blob **privé** uniquement (le type d'accès se choisit à la création du store, SDK `@vercel/blob` ≥ 2.3) [H]. Servir les fichiers par une route `/api/...` qui vérifie le cookie dans le gestionnaire lui-même, avec `Cache-Control: private, no-store` et `X-Content-Type-Options: nosniff`. Ne jamais renvoyer ni stocker l'URL brute côté client.
- Écrire un module `api/_auth.js` commun : chaque gestionnaire appelle `requireMember(req)`, qui revérifie le cookie et renvoie le nom du membre. L'auteur d'une modification vient toujours de ce module, jamais du corps de requête. Défense en profondeur : le middleware reste, mais n'est pas la seule barrière.
- Aucun nouveau chemin public sans décision écrite. Ne pas placer d'archive sous `rapports/`. Si un rapport doit rester partageable avec des personnes extérieures, faire un lien de partage explicite, révocable, daté, jamais le dossier public.
- Test automatique de non-régression d'accès : une liste de chemins (anciens et nouveaux) appelée sans cookie doit renvoyer 401 ou redirection, sauf la liste blanche exacte. Lancer ce test contre l'URL de prévisualisation avant chaque mise en production.
- Séparer les variables d'environnement par environnement (production, prévisualisation) : une prévisualisation ne doit pas pointer sur le store Blob de production ni sur la clé OpenAI de production.
- Raccourcir et nettoyer les journaux : les liens `?acces=` laissent le code dans les journaux Vercel. Ajouter `Referrer-Policy` (déjà recommandé) et, plus tard, des liens d'accès à usage unique.

**Warning signs:**
Un `curl` sans cookie sur une URL d'archive renvoie 200. L'URL d'un blob est visible dans la réponse JSON ou dans l'onglet Réseau. Le dossier `rapports/` grossit.

**Phase to address:** Phase C (socle de données partagées et accès). Doit précéder Phase D.

---

### Pitfall 8 : XSS stocké une fois que les données sont partagées

**What goes wrong:**
Aujourd'hui, un XSS ne touche que son propre appareil. Dès que l'archive est partagée, un nom de trace GPX, le texte d'une IC importée, un nom de régate, une observation ou la prose du modèle écrits par un équipier s'affichent dans la session des autres. Le code utilise une quarantaine d'`innerHTML`, et `esc()` est dupliqué sept fois et n'échappe pas l'apostrophe. Une charge malveillante, ou un nom de fichier bizarre (`</script>`, `"` dans un nom de trace), peut appeler les API au nom du membre : supprimer l'archive, dépenser le budget OpenAI. Le rapport HTML autonome sert depuis la même origine que l'app, donc avec les mêmes privilèges.

**Why it happens:**
L'échappement « par convention » tient tant que les données viennent de soi.

**How to avoid:**
- Un seul `esc` partagé (module `js/util.js`) qui échappe aussi `'` et `` ` ``. Préférer `textContent` pour tout champ venu d'un fichier, de l'archive ou du modèle.
- Stocker des données (JSON), jamais du HTML. Regénérer le rapport HTML à l'affichage avec le même gabarit.
- Afficher les anciens rapports HTML dans un `<iframe sandbox>` (sans `allow-same-origin`) ou les servir avec l'en-tête `Content-Security-Policy: sandbox`.
- Ajouter une Content-Security-Policy dans `vercel.json` (`default-src 'self'` et liste des origines Open-Meteo / Pioupiou), plus `frame-ancestors 'none'`. Les scripts en ligne de `acces.html` demandent un hash ou un déplacement vers un fichier.
- Valider côté serveur la forme de chaque objet d'archive (types, longueurs, plages) avant stockage.

**Warning signs:**
Un nom de trace contenant `<` s'affiche mal. Deux fonctions `esc` différentes.

**Phase to address:** Phase C (validation des entrées, CSP), Phase D (rendu des données partagées).

---

### Pitfall 9 : conflits et pertes silencieuses dans une synchro hors ligne bricolée

**What goes wrong:**
- « Tout équipier peut modifier l'archive » : deux téléphones éditent la même régate hors ligne ; avec un enregistrement par document et « le dernier écrit gagne », l'un efface l'autre sans le dire.
- Pas de Background Sync sur iOS [M] : l'envoi n'a lieu que quand l'app est ouverte. Une file qui « partira toute seule » ne partira pas.
- Vercel Blob : un écrasement met jusqu'à 60 s à se propager [H]. L'app relit juste après l'enregistrement, voit l'ancienne version, croit que l'envoi a échoué et l'utilisateur ressaisit.
- Un fichier index partagé (`index.json`) modifié par deux personnes en même temps perd des entrées.
- Une suppression faite sur un appareil est « ressuscitée » par la file d'un autre (absence de pierre tombale).
- Deux téléphones dans le même bateau produisent deux traces quasi identiques d'une même course ; les doublons gonflent l'archive et faussent les comparaisons.
- Les horloges des téléphones diffèrent : elles ne doivent pas arbitrer les conflits.

**Why it happens:**
La synchro paraît simple (« un POST quand la connexion revient ») jusqu'au premier cas de concurrence.

**How to avoid:**
- Modéliser l'archive en **enregistrements immuables** à identifiant côté client (UUID) : trace, relevé de vent, débrief, rapport, version de fiche. Ajout seul ; pas de réécriture partielle. L'envoi est idempotent (même UUID = même objet).
- Pour les rares objets modifiables (fiche de régate, notes), versionner : chemin unique par révision, ou écriture conditionnelle `ifMatch` (ETag) avec message « quelqu'un a modifié, voulez-vous fusionner ? ». Éviter l'écrasement sur place ; si inévitable, lire avec `useCache:false`.
- Supprimer = marquer « supprimé » (pierre tombale) avec auteur et date, et possibilité de restaurer. Aucune suppression physique par un équipier.
- Pas de fichier index partagé : construire la liste par préfixe (`list`) ou dans une petite base. Si un compteur atomique est nécessaire (quota), prévoir une base clé-valeur (Redis via Marketplace) plutôt que Blob.
- Doublons : conserver les deux traces avec leur auteur et appareil, regroupées par régate (« trace de Teiva », « trace de Romain »). Ne pas fusionner automatiquement.
- Envoi : à l'ouverture de l'app, au retour de visibilité, sur l'événement `online` (qui ne prouve rien) et par un bouton « Envoyer maintenant ». Détecter la vraie joignabilité par une requête courte avec délai, pas par `navigator.onLine`.
- Garder les données brutes (GPX d'origine, valeurs de prévision) et traiter les calculs comme dérivés (voir pitfall 10).

**Warning signs:**
Deux versions d'une fiche coexistent sur deux appareils. Un élément supprimé réapparaît. La liste des régates passées diffère d'un téléphone à l'autre.

**Phase to address:** Phase D.

---

### Pitfall 10 : archiver des résultats recalculables comme s'ils étaient des faits

**What goes wrong:**
L'archive doit garder « le vent et la stratégie du jour ». Si elle ne stocke que les identifiants de parcours, les prévisions sont réécrites par Open-Meteo, le modèle de vent est retouché à la main, la polaire peut être régénérée : rouvrir une régate de septembre dans un an recalcule une stratégie différente et la présente comme celle du jour. À l'inverse, stocker seulement le résultat calculé empêche de le corriger si le modèle était faux. Le code lie en outre les coordonnées à `ORIGIN` (repère local x/y de `geo.js`) : archiver des positions en x/y rendrait les données dépendantes de ce choix.

**Why it happens:**
Le modèle de vent évolue par touches manuelles (`js/wind.js`), et l'app calcule tout à l'ouverture.

**How to avoid:**
- Stocker à la fois **(a)** les entrées brutes de ce jour (prévisions utilisées, relevés, parcours choisi, polaire, GPX d'origine) et **(b)** le résultat tel qu'il a été montré (route conseillée, verdicts, texte du débrief), avec la **version du modèle** (hash court de `wind.js`, `router.js`, `polar-orc.js`) et la date de calcul.
- À l'affichage, distinguer « tel que vu le jour J » et « recalculé avec le modèle actuel », en deux onglets ou un bouton clair.
- Coordonnées en lat/lon WGS84 uniquement, jamais en x/y local.
- Inclure un identifiant de plan d'eau (`venue: "toulon-rade"`) dans chaque objet dès le premier jour, même s'il n'y en a qu'un, pour que le jalon « autres plans d'eau » n'impose pas de migration.

**Warning signs:**
Une régate archivée change d'aspect après une mise à jour du modèle. Aucune mention de version dans les objets stockés.

**Phase to address:** Phase D (schéma d'archive), Phase F (plans d'eau).

---

### Pitfall 11 : mal lire les GPX d'Open GPX Tracker

**What goes wrong:**
D'après le code source de l'application (merlos/iOS-Open-GPX-Tracker) [M] :
- chaque « Démarrer » / « Pause » crée un `trkseg`, consolidés dans une seule `trk` à l'enregistrement. `fromGPX` aplatit tous les `trkpt` et lisse vitesse et cap sur 8 s à travers les coupures : une pause de 10 min devient une ligne droite à vitesse faible.
- `distanceFilter = 2 m` : il n'y a aucun point tant que le bateau n'a pas bougé de 2 m. À l'arrêt ou à très faible vitesse (attente sur la ligne de départ), les points sont rares et irréguliers. La fréquence n'est pas du 1 Hz.
- Les points n'ont pas de vitesse ni de cap : tout est dérivé de positions bruitées (le code met une précision fictive de 5 m).
- Les waypoints posés à la main (appui long) peuvent être confondus avec des points de route dans le repli `rtept + wpt`.
- Un fichier couvre souvent plusieurs choses (transit, entraînement, course) ; un second fichier existe si la batterie ou l'app s'est arrêtée.
- L'enregistrement peut avoir été fait sur le même bateau par deux équipiers.
- iOS ne permet pas à une PWA de recevoir un fichier partagé depuis une autre app (pas de Web Share Target [L], à vérifier) : l'import passe par un sélecteur de fichiers, et le fichier d'Open GPX Tracker doit être visible dans l'app Fichiers.

**Why it happens:**
Le parseur actuel est pensé pour les traces que l'app produit elle-même.

**How to avoid:**
- Garder la structure en segments dans le modèle de données ; calculer vitesse et cap par segment ; marquer les coupures supérieures à, disons, 20 s comme trous, pas comme déplacement.
- Tolérer un échantillonnage irrégulier : lisser sur une fenêtre de **distance** autant que de temps, ne jamais supposer 1 Hz.
- Import multi-fichiers (« ajouter une trace à cette régate »), fusion explicite par l'utilisateur, et affichage de l'intervalle couvert par chaque fichier.
- Refuser les points sans heure avec un message clair (déjà fait) mais le signaler au lieu de les ignorer en silence quand c'est une fraction significative. Contrôler les plages de latitude/longitude, d'horodatage futur et les sauts de position impossibles.
- Stocker le GPX d'origine tel quel dans l'archive (source de vérité, rejouable quand les algorithmes s'améliorent).
- Dédoublonner à l'import sur (premier horodatage, dernier horodatage, nombre de points, empreinte), pas sur `Math.random()` comme aujourd'hui.
- Avant publication ou partage large, proposer de rogner la trace à la fenêtre de la course : le début et la fin d'une trace révèlent souvent le domicile ou le mouillage.

**Warning signs:**
Une pause d'enregistrement apparaît comme un trait droit. Vitesses énormes ou nulles juste après une coupure. Deux imports du même fichier créent deux traces.

**Phase to address:** Phase B (cas de test avec un vrai GPX), Phase D (import dans l'archive).

---

### Pitfall 12 : extraction des IC d'un autre club : une valeur plausible mais fausse est pire qu'un échec

**What goes wrong:**
`parseIC` (`js/events.js`) est un jeu d'expressions régulières écrites pour le vocabulaire du CVAT. Sur les IC d'un autre club :
- le premier motif « date » peut être celle de l'avis de course ou d'un avenant, pas de la régate ; « avertissement » peut renvoyer le mauvais signal ;
- pdf.js sur un PDF scanné ne rend aucun texte ; sur deux colonnes ou avec des tableaux, l'ordre de lecture est mélangé ;
- les positions de bouées, quand elles existent, sont en degrés-minutes (`43°06,500'N`), en degrés décimaux, en relèvement/distance depuis un repère, ou seulement sur un schéma image. Elles sont souvent mouillées à la demande par le comité : l'IC ne donne pas de position ;
- les parcours sont parfois des images (annexes) que rien ne lit ;
- les avenants, ou « IC modifiées », contredisent le corps du texte ;
- un champ vide ou erroné au départ peut coûter une course (heure du premier signal, canal VHF, limite de temps).
En outre, le `pdf.js` vendorisé est une version 3.x, dans la plage de la CVE-2024-4367 (exécution de JS via une police de PDF, corrigée en 4.2.67), et il charge des PDF d'autres clubs, donc non fiables.

**Why it happens:**
Le premier PDF qui marche fait croire que l'extraction « marche ».

**How to avoid:**
- Traiter toute valeur extraite comme une **suggestion** : afficher chaque champ à côté de l'extrait source et de la page, avec un voyant de confiance, et obliger une validation explicite des champs critiques (date, 1er avertissement, VHF, limite, zone). Le formulaire existant (« vérifiez les champs extraits ») va dans ce sens ; le rendre plus strict.
- Contrôles de vraisemblance : date dans les 60 jours, heures entre 07:00 et 20:00, canal VHF 6 à 88, coordonnées dans la boîte englobante du plan d'eau choisi. Si un contrôle échoue, vider le champ plutôt que de deviner.
- Ne jamais créer une bouée d'après un PDF sans confirmation sur la carte ; marquer ces positions `src: 'ic-pdf'` avec le même statut que le `approx` actuel. « Le Comité fait foi » reste affiché.
- Détecter le PDF sans couche texte (peu de caractères par page) et le dire, plutôt que d'extraire du bruit. Conserver le PDF d'origine rattaché à la régate.
- Si une extraction par modèle est envisagée plus tard : contenu du PDF = donnée non fiable (injection de consignes), sortie à schéma strict, plafond de pages et de taille, aucune action déclenchée.
- Mettre à jour pdf.js (≥ 4.2.67) ou, au minimum tout de suite, passer `isEvalSupported:false` à `getDocument`. Consigner la version et la source dans `vendor/README`. Ajouter les deux fichiers pdf.js au SHELL ou documenter qu'il faut les ouvrir une fois avec réseau.
- Constituer un petit corpus de vrais PDF d'IC (3 à 5 clubs) comme jeu de test avant de prétendre à la généralité.

**Warning signs:**
Une date extraite qui est passée. Un « premier signal » à 09:55 alors que la régate commence à 13:30. Texte extrait vide ou plein de lettres isolées.

**Phase to address:** Phase E (avec un correctif de sécurité immédiat dès la Phase A).

---

### Pitfall 13 : des tests qui figent des comportements faux dans les modèles numériques

**What goes wrong:**
Le vent (`js/wind.js`), le routage (`js/router.js`), la polaire et le débrief sont réglés à la main : les constantes ont été ajustées sur une seule observation du 18/10. Si les tests sont de simples « instantanés » de la sortie actuelle, ils n'attestent que la stabilité, pas la justesse : ils échouent à chaque amélioration légitime et incitent à les réécrire sans réfléchir, ou à ne plus toucher le modèle. D'autres causes d'échecs :
- les tests tournent en UTC alors que le code utilise `getHours()` en heure locale : un test passe sur le portable et échoue en CI, et la veille du 25/10 le décalage horaire passe de CEST à CET (la Coupe SNPM du 18/10 est en heure d'été, la régate du 7-9/11 en heure d'hiver) ;
- les moteurs JS (V8 contre JavaScriptCore) peuvent différer au dernier bit sur `sin`, `cos`, `pow`, `exp` : une relaxation à 420 itérations ou un tri d'isochrones peuvent diverger de façon invisible ;
- l'import de `app.js` ou de modules qui touchent `document`/`window` au chargement empêche d'exécuter quoi que ce soit sous Node ;
- `Date.now()` et `Math.random()` sont partout (26 occurrences) ;
- un test de non-régression rouge la veille du départ bloque un déploiement urgent.

**Why it happens:**
Les tests de caractérisation (« la sortie ne bouge pas ») sont le moyen le plus rapide d'avoir un filet. On les prend pour des tests de correction.

**How to avoid:**
- Trois catégories distinctes, nommées comme telles :
  1. **Oracles indépendants** (corrects par construction) : distances et relèvements connus, conversions (0,5144), `norm180`/`norm360` autour de 0/360 (les vents de nord sont fréquents ici), valeurs de la polaire ORC lues dans le certificat, allers-retours `toGPX`/`fromGPX`.
  2. **Propriétés** (invariants physiques) : vitesse du vent toujours ≥ 0 et bornée ; sans relief, le champ égale l'interpolation des prévisions ; temps routé ≥ distance / vitesse maximale ; plus de vent (dans la plage 4 à 25 nd) ne ralentit pas le meilleur cap ; l'angle de VMG optimal du routeur coïncide avec celui de la polaire ; symétrie bâbord/tribord pour un vent sans effet de site.
  3. **Cas réels étiquetés** (la Coupe SNPM du 18/10, trace et rapport) : n'affirmer que des faits connus de la course (deux faux départs, parcours 4 réduit, détection du départ à ±N secondes), avec des tolérances larges, plutôt que des chiffres que le modèle a lui-même produits. Documenter l'origine de chaque valeur attendue.
- Les « instantanés » restent possibles mais séparés, étiquetés *caractérisation*, avec une règle : un changement de sortie est examiné, puis accepté en connaissance de cause (une ligne dans le journal du modèle).
- Comparer avec des tolérances (`assert.ok(Math.abs(a-b) < eps)`), jamais l'égalité exacte entre flottants ; fixer les graines et injecter l'horloge.
- Lancer les tests avec `TZ=Europe/Paris` et ajouter un cas qui traverse le 25/10/2026 (changement d'heure).
- Exécuteur sans dépendance : `node --test`. Séparer les modules purs (`geo`, `wind`, `polar`, `router`, `tactics`, `track` sans DOM) de ce qui touche le DOM. Ne pas tester `scene3d.js`.
- Tests rapides (moins de 30 s) et déterministes, sinon ils seront contournés. Les brancher à la commande de build de Vercel seulement quand ils sont fiables, avec une procédure de contournement documentée pour un correctif de dernière minute.
- Tester le middleware : unité (`membre`, expression du matcher) et fumée HTTP contre une prévisualisation (voir pitfall 7).

**Warning signs:**
Un test qui passe parce qu'il lit la sortie du code qu'il teste. Tests qui échouent sur la machine d'un autre. Plus personne n'ose changer une constante de `wind.js`.

**Phase to address:** Phase B. Les oracles et propriétés d'abord (avant tout changement de modèle).

---

### Pitfall 14 : OpenAI : coût, latence et données au ponton comme en mer

**What goes wrong:**
- `api/debrief.js` envoie le corps de la requête entier, tronqué à 60 000 caractères, avec un raisonnement de niveau moyen : réponse lente, parfois plus que `maxDuration` (60 s). Le client abandonne à 45 s, mais la fonction continue et la dépense est faite. Une réponse 504 de Vercel est du HTML, pas du JSON, et le client affiche une erreur obscure.
- `api/rules.js` renvoie à chaque appel le texte des règles (61 Ko) ; sans plafond, un équipier qui boucle (ou une page ouverte qui redéclenche l'appel) fait grimper la facture. Aucune limite par membre.
- Un double appui relance un appel payant ; aucune clé d'idempotence.
- La dictée de vent en mer : réseau faible, abandon à 9 s, alors qu'une bonne partie du travail est faisable localement. `js/voice.js` contient déjà un analyseur local, mais le code l'utilise comme repli, pas comme voie principale.
- `store` : la rétention de l'état est de 30 jours par défaut pour l'API Responses, et les journaux anti-abus sont conservés jusqu'à 30 jours [H]. Les « faits » du débrief contiennent des positions, des observations et des noms.
- Le nom de modèle (`gpt-5.5`) est répété dans trois fichiers sans repli ; un retrait du modèle fait 5xx.
- La sortie du modèle de dictée est reprise telle quelle comme valeur de vent (pas de bornes imposées côté serveur).

**Why it happens:**
Les fonctions ont grandi une par une, sans couche commune ni budget.

**How to avoid:**
- Un module commun `api/_ai.js` : modèle épinglé en une constante, `store:false`, plafond de taille d'entrée et schéma de validation, délai de sortie inférieur à `maxDuration`, retour JSON systématique (y compris pour les erreurs), journal du modèle effectivement utilisé.
- Local d'abord : pour le vent dicté, l'analyseur local est la voie normale et s'applique immédiatement ; le modèle n'est qu'un raffinement facultatif. Le débrief affiche d'abord les chiffres calculés ; la prose arrive ensuite, relançable, jamais bloquante. Rien de critique à l'heure du départ ne dépend d'OpenAI.
- Plafond de dépense dans le tableau de bord OpenAI (budget et alerte) dès maintenant. Quota par membre et par jour : exige un compteur atomique, donc une petite base clé-valeur ; à défaut, au minimum un plafond de taille et une temporisation par appareil.
- Un bouton désactivé pendant l'appel ; la même requête (empreinte du contenu) renvoie la réponse déjà obtenue plutôt que de repayer.
- Ordonner les prompts avec la partie fixe en tête (texte des règles) pour profiter du cache automatique des préfixes identiques [M].
- Bornes côté serveur sur les valeurs numériques renvoyées (0-360°, 0-80 nd) ; la validation côté client en plus.
- Les contenus issus de l'archive (observations d'autres équipiers, texte d'une IC) entrant dans les prompts sont traités comme des données non fiables ; la sortie reste à schéma strict, sans action.

**Warning signs:**
Facture OpenAI qui monte sans régate. Erreurs « Unexpected token < » dans la console après un délai dépassé. Appels doublés dans le journal Vercel.

**Phase to address:** Phase C (module commun, quotas) avec un plafond de dépense à poser tout de suite.

---

### Pitfall 15 : la reconnaissance vocale n'existe peut-être pas dans l'app installée

**What goes wrong:**
`js/voice.js` s'appuie sur `webkitSpeechRecognition`. D'après WebKit (2021, toujours « LATER » en mars 2025), l'API n'est pas disponible dans les web apps ajoutées à l'écran d'accueil [M]. L'équipage dicte ses relevés dans l'app installée : le bouton du micro peut ne rien faire ou échouer avec `not-allowed`, et la dictée de l'arbitre aussi. S'ajoutent : la permission micro redemandée, Siri/Dictée à activer dans les réglages, `SR` présent mais inutilisable, et mains mouillées dans le vent.

**Why it happens:**
Ça marche dans Safari à l'établi, donc on suppose que ça marche installé.

**How to avoid:**
- Détecter à l'exécution : tenter un démarrage, et si `error` immédiat, cacher le micro et proposer le champ texte avec cette consigne : « touchez le micro du clavier iPhone » (la dictée du clavier fonctionne dans les champs de saisie d'une app installée [M], à valider). Ce chemin est le plus robuste et passe déjà par l'analyse locale puis OpenAI.
- Garder la saisie manuelle (curseurs, préréglages de relevés) comme chemin principal en course, avec de gros boutons.
- Test sur chaque iPhone de l'équipage dans l'app installée, avec Dictée activée, pendant la phase de fiabilité. Noter le résultat dans le diagnostic.

**Warning signs:**
Bouton micro sans effet dans l'app installée ; `onerror` avec `service-not-allowed`.

**Phase to address:** Phase A.

---

## Moderate Pitfalls

### Pitfall 16 : identité, révocation et attribution

**What goes wrong:** le cookie contient le code lui-même (400 jours), les empreintes sont sans sel, et retirer un membre exige un redéploiement. L'archive partagée augmente l'enjeu : un téléphone perdu donne l'accès aux données de l'équipage et à la dépense OpenAI. Sans identité côté serveur, on ne sait pas « qui a modifié ».
**Prevention:** jeton de session aléatoire signé (HMAC, clé en variable d'environnement), liste des membres dans un stockage modifiable sans redéploiement, comparaison à temps constant, période de transition où les deux formats sont acceptés. Vérifier l'entropie des codes. Garder un journal d'audit minimal des écritures (membre, date, objet).
**Phase:** Phase C.

### Pitfall 17 : heure locale de l'appareil et changement d'heure

**What goes wrong:** le code lit `getHours()` (heure du téléphone) alors que les prévisions sont demandées en `Europe/Paris`. Un équipier avec un fuseau différent, un portable réglé en UTC ou un test en CI donnent des heures décalées. Le changement d'heure du 25/10/2026 sépare le cas de référence (18/10, CEST) de la prochaine régate (CET).
**Prevention:** une fonction unique « heure de Paris » basée sur `Intl.DateTimeFormat` avec `timeZone:'Europe/Paris'`, utilisée partout, et un test qui traverse la bascule. Les objets d'archive stockent l'instant en UTC plus la date locale de la régate.
**Phase:** Phase B.

### Pitfall 18 : refonte « autres plans d'eau » trop tôt et trop large

**What goes wrong:** déplacer `courses.js`, `weather.js`, `geo.js` vers des fichiers `data/*.json` touche le code même qui fait tourner la course, à trois semaines de l'échéance. Les nouveaux fichiers oubliés dans `SHELL` cassent le hors-ligne sans erreur.
**Prevention:** ne le faire qu'après les phases de fiabilité et de tests, par déplacement de données pur (aucune logique modifiée), schéma validé au chargement, fichiers générés dans le `SHELL` automatique, et le test de couverture du SHELL (pitfall 3). Poser l'identifiant de plan d'eau dans les données d'archive dès la Phase D.
**Phase:** Phase F, après la régate de novembre si possible.

### Pitfall 19 : réseau et API qui se mélangent avec le chargement initial

**What goes wrong:** `refreshLive` toutes les 5 minutes, prévisions, balises et maintenant archive concourent pour un réseau faible ; un appel qui échoue ne doit pas bloquer l'affichage. Plusieurs `F.compute()` consécutifs figent l'interface.
**Prevention:** file d'appels réseau avec délais, priorité au trajet de course, diagnostic « dernière mise à jour des prévisions à HH:MM ». Calculer le champ de vent une fois par modèle et par heure, hors du fil principal si possible.
**Phase:** Phase A.

### Pitfall 20 : politique de conservation absente

**What goes wrong:** l'archive ne cesse de grossir (traces de plusieurs Mo, rapports) ; quota Blob et coûts de transfert ; personne ne sait ce qui peut être supprimé.
**Prevention:** compresser les traces (gzip côté client avant envoi), une régate = quelques centaines de Ko, limites par objet côté serveur, 4,5 Mo de corps maximum par fonction Vercel (envoi direct vers le Blob pour les gros fichiers), page « espace utilisé ».
**Phase:** Phase D.

---

## Minor Pitfalls

### Pitfall 21 : icône maskable et manifeste
`manifest.webmanifest` déclare `icon-maskable-512.png`, absent de la liste du `SHELL`. Le vérifier dans le test de couverture. Ajouter la balise `apple-mobile-web-app-capable` n'est plus nécessaire sous iOS 26 mais reste utile avant.

### Pitfall 22 : `srv.log` suivi dans git
Peut contenir des chemins `?acces=`. `git rm --cached`, `*.log` dans `.gitignore`, rechercher dans l'historique et changer tout code qui y figure (voir CONCERNS).

### Pitfall 23 : dépendances sans verrou
`openai ^7.36.0` et `@vercel/functions` sans fichier de verrouillage : l'ajout de `@vercel/blob` aggrave l'écart entre déploiements. Commiter `package-lock.json`, épingler les versions.

### Pitfall 24 : ne pas tester sur appareil réel
Les simulateurs ne reproduisent ni le verrouillage, ni le bouton silencieux, ni l'éviction, ni les réseaux dégradés. Prévoir une checklist de recette sur les trois iPhone, en app installée, avant chaque régate.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Un seul document JSON par régate, écrasé à chaque envoi | Très rapide à coder | Pertes silencieuses entre équipiers, cache de 60 s sur le Blob | Jamais pour les données partagées ; acceptable pour un cache local |
| Store Blob public avec URL « indevinable » | Pas de route de lecture à écrire | Fuite définitive à la première URL partagée ; échappe au middleware | Jamais |
| Auth uniquement dans le middleware | Un seul fichier | Une erreur de matcher expose tout, pas d'identité côté fonction | Jamais pour l'archive ; garder en plus de la vérification par gestionnaire |
| Stocker le HTML du rapport | Réutilise le code actuel | XSS stocké partagé, impossible à régénérer | Seulement pour les anciens rapports, en `iframe sandbox` |
| Tests « instantané » de toute la sortie | Filet immédiat | Fige des erreurs, bruit à chaque amélioration | Seulement étiquetés *caractérisation* et revus |
| `catch {}` partout | Pas de plantage visible | Pannes de terrain invisibles | Seulement pour des fonctions non critiques et avec un compteur d'erreurs |
| `VERSION`/`SHELL` à la main | Aucun outil à ajouter | Cache périmé ou hors-ligne cassé sans erreur | Jamais après ce jalon |
| `skipWaiting` + rechargement automatique | Mises à jour sans effort | Rechargement en pleine course | Jamais |
| Déploiement direct en production le jour J | Correctif rapide | Perte de trace, version mélangée | Seulement pour un correctif critique, hors course |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel Blob | Écraser un chemin et relire aussitôt | Chemin unique par révision, ou `ifMatch` plus `useCache:false` ; ne pas dépendre de la cohérence immédiate |
| Vercel Blob | Mettre l'URL du blob dans le JSON renvoyé au client | Garder le chemin interne ; servir via une route authentifiée |
| Vercel Blob (écritures) | Passer de gros fichiers par la fonction (4,5 Mo max) | Envoi direct client vers Blob (jeton à courte durée), ou compresser |
| Vercel (middleware) | Ajouter un chemin public pour « faire marcher » le SW | Tester le SW avec et sans cookie ; ne rendre public que le strict nécessaire |
| Vercel (prévisualisations) | Variables de production partagées | Variables par environnement, store de test séparé |
| OpenAI Responses | Laisser `store` par défaut | `store:false` explicite, modèle épinglé, délai < `maxDuration` |
| Open-Meteo | Supposer que la prévision d'hier est toujours disponible | Archiver les données de prévision utilisées (pitfall 10) ; plafond d'appels |
| Open GPX Tracker | Traiter le fichier comme une trace continue à 1 Hz | Segments, trous, échantillonnage par distance (pitfall 11) |
| pdf.js | Charger des PDF tiers avec les options par défaut | `isEvalSupported:false`, version à jour, PDF non fiable |
| Service worker | Mettre en cache une réponse d'archive hors `/api/` | Exclure les chemins d'archive du cache SW, ou utiliser un cache dédié vidé à la déconnexion |
| Safari / iOS | Compter sur Background Sync, vibration ou localisation d'arrière-plan | Envoi à l'ouverture, signal visuel, enregistreur natif de secours |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calcul du champ de vent sur le fil principal | Gel de l'interface, bips en retard | Calculer une fois par modèle/heure ; Web Worker ; suspendre en mode départ | Premier calcul de la journée sur un iPhone ancien ; plusieurs relevés |
| Scène Three.js toujours créée et animée | Chauffe, batterie, saccades | Création différée à l'onglet Carte, pause hors écran | Régate de plusieurs heures avec écran allumé |
| Précache de 2,5 Mo de données dès l'installation | Installation lente sur réseau faible | Précache progressif, indicateur « prêt pour le hors-ligne » | Première installation au ponton |
| Réseau d'abord sans délai | Lancement figé de 30 à 60 s | Cache d'abord + délai de 3 s (pitfall 4) | Une barre de 4G en mer |
| Écriture IndexedDB toutes les 20 s sans reprise | Perte jusqu'à 20 s ; aucun rattrapage | Écriture à chaque lot de points et à `pagehide` | App tuée par iOS |
| Liste d'archive chargée en entier | Écran vide au lancement | Pagination ; cache local de l'index | Quelques dizaines de régates |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Auteur pris dans le corps de la requête | Falsification de l'attribution | L'auteur vient du cookie vérifié dans le gestionnaire |
| Données d'équipage dans un store public ou dans `rapports/` | Fuite de tactique, de trajets, de positions de domicile | Store privé + route authentifiée ; rogner les traces avant partage |
| Cookie qui contient le code | Accès durable en cas de vol d'appareil | Jeton de session révocable (pitfall 16) |
| `?acces=CODE` dans l'URL | Code dans l'historique et les journaux | Politique de référent, lien à usage unique à terme |
| pdf.js 3.x avec PDF d'autres clubs | Exécution de JS via une police (CVE-2024-4367) | `isEvalSupported:false` tout de suite, mise à jour |
| Pas de CSP | Un XSS stocké a tous les droits | CSP stricte + `esc` unique + `textContent` |
| OpenAI sans plafond ni quota | Facture imprévue | Budget dans le tableau de bord + quota par membre |
| Corps du débrief transmis tel quel au modèle | Coût, injection par données d'archive | Schéma et plafonds, entrée traitée comme non fiable |
| CSRF sur les nouvelles routes d'écriture | Écriture à l'insu du membre via un autre site | `SameSite=Lax` aide ; vérifier `Origin` et exiger `Content-Type: application/json`, jamais d'écriture en GET |
| Prévisualisation Vercel avec secrets de production | Écriture dans l'archive réelle | Variables par environnement |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Pannes silencieuses (GPS, son, stockage, synchro) | Fausse confiance, découverte au débrief | Voyants permanents : GPS (âge du dernier point), écran maintenu, son actif, éléments non envoyés, version |
| Messages d'erreur techniques | L'équipier ne sait pas quoi faire | Une phrase d'action : « Son coupé : touchez pour tester » |
| Cibles tactiles petites en mer | Appuis manqués, gants, éclaboussures | Gros boutons, déjà amorcé dans le mode départ ; étendre aux autres écrans de course |
| Configuration cachée (verrouillage auto, Dictée, mode éco) | « Ça marchait au ponton » | Écran de diagnostic avec check-list de l'iPhone et lien vers les réglages |
| Archive sans indication d'auteur ni version | Confusion sur « la bonne » version | Auteur, date, version du modèle, bouton restaurer |
| Une seule voie de saisie du vent (voix) | Bloqué si la reconnaissance est absente | Voix, clavier, curseurs, préréglages : tous menant au même relevé |
| Message « mise à jour » qui recharge | Perte d'état en course | Bannière passive, application après la course |

## "Looks Done But Isn't" Checklist

- [ ] **Enregistrement de trace :** souvent sans coupure signalée ni reprise — vérifier : verrouiller 5 min, revenir, la trace montre un trou marqué ; tuer l'app, la relancer, proposer la reprise.
- [ ] **Wake Lock :** souvent redemandé au mauvais moment — vérifier sur un iPhone en iOS < 18.4 et un autre en ≥ 18.4, app installée, mode éco activé.
- [ ] **Bips :** souvent absents avec le bouton silencieux ou après un appel — vérifier : bouton silencieux enclenché, appel entrant, retour à l'app, séquence complète 5-4-1-0.
- [ ] **Hors-ligne :** souvent seulement en mode avion — vérifier avec un réseau très lent et avec le SW fraîchement installé sur un autre iPhone.
- [ ] **Mise à jour du SW :** souvent testée sans enregistrement actif — vérifier : déploiement pendant un chrono, rien ne se recharge.
- [ ] **Accès :** souvent testé dans Safari seulement — vérifier le parcours dans l'app installée (iOS 17.2+ et plus ancien), cookie absent, hors réseau.
- [ ] **Archive privée :** souvent testée avec cookie — vérifier tous les chemins (anciens, nouveaux, URL de blob) sans cookie : 401 partout sauf la liste blanche.
- [ ] **Synchro :** souvent testée avec un seul appareil — vérifier deux téléphones qui éditent hors ligne puis se reconnectent, et une suppression concurrente.
- [ ] **Import GPX :** souvent testé avec un fichier produit par l'app — vérifier avec un vrai fichier d'Open GPX Tracker contenant une pause, un waypoint et deux segments.
- [ ] **Import d'IC :** souvent testé avec le PDF du CVAT — vérifier avec 3 PDF d'autres clubs, dont un scanné, et vérifier que les champs douteux restent vides.
- [ ] **Tests de modèle :** souvent verts parce qu'ils lisent leur propre sortie — vérifier que chaque test a un oracle indépendant ou une propriété, et passe avec `TZ=Europe/Paris` comme en `UTC`.
- [ ] **OpenAI :** souvent testé en bonne connexion — vérifier : coupure à mi-appel, double appui, dépassement de délai, quota atteint, modèle indisponible.
- [ ] **Dictée :** souvent testée dans Safari — vérifier dans l'app installée, avec la Dictée du clavier en repli.
- [ ] **Version affichée :** souvent différente entre `APP_VERSION` et `VERSION` du SW — vérifier la source unique.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Trace perdue (écran verrouillé) | MEDIUM | Importer le GPX d'Open GPX Tracker ; sinon reconstituer le début depuis le chrono et les relevés ; marquer la trace « incomplète » |
| Trace perdue (stockage évincé) | HIGH si non envoyée | Aucun moyen ; d'où l'envoi automatique et l'export GPX |
| Mise à jour du SW en course | LOW | Relancer l'app, reprendre la trace non terminée, rejouer le chrono depuis son horodatage de fin |
| Fuite d'un fichier privé | HIGH | Changer le store, régénérer les liens, changer les codes d'accès, inspecter les journaux |
| Conflit d'écriture | MEDIUM | Restaurer la version précédente (versions conservées), fusionner à la main |
| Facture OpenAI excessive | MEDIUM | Couper la clé ou le budget, plafonner, revoir les quotas ; examiner les journaux |
| Extraction d'IC fausse | LOW si validée | Corriger la fiche ; ajouter le PDF au corpus de test |
| Test qui fige un défaut | MEDIUM | Reclasser en caractérisation, remplacer par un oracle, consigner le changement de comportement |
| Cookie perdu en mer | LOW | Saisir le code dans l'app ; la file d'attente n'est pas touchée |

## Pitfall-to-Phase Mapping

Les phases sont indicatives (à renommer par le feuillet de route).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. GPS, trace, chrono écran verrouillé | Phase A | Recette sur iPhone : verrouillage, retour, trou marqué, reprise après arrêt |
| 2. Bips et chrono | Phase A | Séquence complète avec bouton silencieux, appel et gel simulé du fil principal |
| 3. Mise à jour du SW en course | Phase A | Déploiement pendant un chrono : aucun rechargement ; test de couverture du SHELL |
| 4. Réseau d'abord sans délai | Phase A | Lancement avec réseau très lent < 5 s |
| 5. Stockage séparé / évincé | Phase A puis D | `persisted()` vrai ; compteur d'éléments non envoyés ; migration idempotente |
| 6. Cookie et app installée | Phase A (parcours), Phase C | Parcours d'installation sur les trois iPhone ; 401 ne vide pas la file |
| 7. Fichiers privés | Phase C (avant D) | Test sans cookie sur tous les chemins et sur une prévisualisation |
| 8. XSS stocké | Phase C, D | Noms piégés dans une trace, une IC et un rapport : rien ne s'exécute ; CSP active |
| 9. Conflits de synchro | Phase D | Deux appareils hors ligne, modifications croisées, suppression concurrente |
| 10. Archiver le recalculable | Phase D | Rouvrir une régate après modification du modèle : la vue « jour J » ne change pas |
| 11. GPX Open GPX Tracker | Phase B (test), Phase D | Vrai fichier avec pause et deux segments : trou marqué, pas de ligne droite |
| 12. Extraction d'IC | Phase E (+ correctif pdf.js en A) | Corpus de PDF ; champs douteux vides ; `isEvalSupported:false` |
| 13. Tests de modèles | Phase B | Oracles et propriétés ; `TZ=Europe/Paris` ; cas à la bascule d'heure |
| 14. OpenAI | Phase C (plafond immédiat) | Coupure à mi-appel ; double appui ; quota ; `store:false` |
| 15. Reconnaissance vocale installée | Phase A | Test micro dans l'app installée ; repli clavier |
| 16. Identité et révocation | Phase C | Retirer un membre sans redéployer |
| 17. Heure et changement d'heure | Phase B | Test traversant le 25/10/2026 |
| 18. Refonte des plans d'eau | Phase F | Aucun changement de logique ; SHELL généré |
| 19-20. Réseau, conservation | Phase A, D | Diagnostic de fraîcheur ; limites par objet |

**Ordre recommandé (échéance du 7-9 novembre) :** A (fiabilité, 1re semaine) → B (tests, en parallèle de A pour les oracles) → C (accès et socle) → D (archive) → E (IC d'autres clubs) → F (plans d'eau). Si le temps manque, tenir A et B pour la régate et livrer C et D sans exposer d'écriture partagée avant d'avoir passé le test d'accès du pitfall 7. Pas de déploiement de production dans les 48 h avant la régate.

**Phases à approfondir (drapeaux de recherche) :**
- Phase A : mesure sur appareil réel (écran verrouillé, mode éco, bouton silencieux, Dictée en app installée) ; les sources en ligne sont des témoignages, pas des garanties.
- Phase D : choix du stockage (Blob privé seul, ou Blob plus petite base pour index et compteurs) ; combinaison `ifMatch` et écrasement à vérifier à l'essai.
- Phase E : corpus réel d'IC de plusieurs clubs avant de concevoir l'extraction.

## Sources

- WebKit, « Tracking Prevention » (plafond de 7 jours, exemption des web apps de l'écran d'accueil) : https://webkit.org/tracking-prevention/ [H]
- WebKit, « Updates to Storage Policy » (quotas, éviction, `persist()`) : https://webkit.org/blog/14403/updates-to-storage-policy/ [H]
- WebKit bug 254545, Wake Lock en web app installée, corrigé en iOS 18.4 : https://bugs.webkit.org/show_bug.cgi?id=254545 [H]
- WebKit bug 255363, ré-acquisition du Wake Lock après `visibilitychange` : https://bugs.webkit.org/show_bug.cgi?id=255363 [M]
- WebKit bug 225298, SpeechRecognition non disponible dans les web apps de l'écran d'accueil (LATER) : https://bugs.webkit.org/show_bug.cgi?id=225298 [M]
- WebKit bug 264473 et MDN AudioSession (type `ambient` par défaut, `playback`) : https://bugs.webkit.org/show_bug.cgi?id=264473, https://developer.mozilla.org/en-US/docs/Web/API/AudioSession [M]
- WebKit bug 201866, Background Sync : https://bugs.webkit.org/show_bug.cgi?id=201866 [M]
- Maximiliano Firtman, « iOS PWA Compatibility » (cookies copiés iOS 17.2, pas de vibration ni de Background Sync, iOS 26) : https://firt.dev/notes/pwa-ios/ [M]
- Vercel, « Private Storage » pour Blob (accès authentifié, déconseil du middleware, cache de 60 s, `useCache`) : https://vercel.com/docs/vercel-blob/private-storage [H]
- Vercel Blob, SDK (`ifMatch`, `allowOverwrite`) : https://vercel.com/docs/vercel-blob/using-blob-sdk [M]
- OpenAI, « Your data » (rétention 30 jours, journaux anti-abus) : https://developers.openai.com/api/docs/guides/your-data [H]
- GHSA-wgrm-67xf-hhpq / CVE-2024-4367 (pdf.js, `isEvalSupported`) : https://github.com/advisories/GHSA-wgrm-67xf-hhpq [M]
- Code source Open GPX Tracker (segments, `distanceFilter`, pause) : https://github.com/merlos/iOS-Open-GPX-Tracker (`GPXMapView.swift`, `ViewController.swift`) [M]
- Lecture directe du code du dépôt : `sw.js`, `middleware.js`, `js/app.js`, `js/track.js`, `js/startmode.js`, `js/events.js`, `js/voice.js`, `api/*.js`, `vendor/pdf.min.js` ; `.planning/PROJECT.md` ; `.planning/codebase/CONCERNS.md` [H]
- Non vérifié, à tester sur appareil : arrêt exact de `watchPosition` écran verrouillé, redemande de permission de localisation en app installée, Web Share Target absent, effet du bouton silencieux avec `audioSession`.

---
*Pitfalls research for: PWA de tactique de régate (iPhone en mer, archive partagée Vercel)*
*Researched: 2026-10-19*
