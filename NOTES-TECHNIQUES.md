# Notes techniques

Document tenu à jour à chaque jalon : choix faits, et points à vérifier sur iPhone.

## Choix techniques (J1)

| Sujet | Choix | Raison |
|---|---|---|
| Framework | Aucun : HTML, CSS et JavaScript natifs (modules ES) | Aucune étape de build, rien à installer, le dossier se dépose tel quel sur un hébergement statique. L'app a 5 écrans : un framework n'apporterait rien. |
| Navigation | Routeur par hash (`#/aujourdhui`, `#/seances`…) | Fonctionne sur tout hébergement statique sans règle de réécriture, et hors ligne. |
| Chemins | Tous relatifs (`./`, `css/…`) | L'app marche à la racine comme dans un sous-dossier (GitHub Pages). |
| Hors ligne | Service worker, cache d'abord puis mise à jour en arrière-plan | Ouverture instantanée et hors ligne ; une nouvelle version est visible au 2e lancement. |
| Versions | Constante `VERSION` dans `sw.js` | Changer la version purge l'ancien cache. Les données (IndexedDB) ne sont jamais concernées. |
| Données | `navigator.storage.persist()` demandé au démarrage | Demande au navigateur de ne pas purger les données. Le résultat est affiché dans « État de l'app ». |
| Thème | Sombre uniquement, couleurs en variables CSS | Demandé ; un thème clair resterait facile à ajouter. |
| Ergonomie | Navigation en bas, zones tactiles ≥ 52 px, contenu en une colonne | Utilisation d'une main, au pouce. |
| Encoche | `viewport-fit=cover` + `env(safe-area-inset-*)` | Le contenu évite l'encoche et la barre d'accueil. |
| Icônes | PNG 180, 192, 512 et 512 « maskable », fond opaque | iOS n'accepte pas la transparence sur l'icône d'écran d'accueil. |
| Police | Police système (San Francisco sur iPhone) | Aucun fichier à télécharger, rendu natif, hors ligne. |

## Points à vérifier sur iPhone (J1)

- [ ] L'app s'ajoute à l'écran d'accueil depuis Safari, avec la bonne icône et le nom « Athletics ».
- [ ] Lancée depuis l'icône, elle s'ouvre en plein écran (pas de barre d'adresse).
- [ ] Le titre n'est pas masqué par l'encoche / Dynamic Island ; la navigation ne chevauche pas la barre d'accueil.
- [ ] En mode avion, l'app s'ouvre et les 5 onglets fonctionnent.
- [ ] Dans « État de l'app » : Écran d'accueil = Installée, Hors ligne = Prêt. Noter la valeur de « Données protégées ».
- [ ] Les onglets répondent sans délai et sans zoom intempestif.

## Choix techniques (J2)

| Sujet | Choix | Raison |
|---|---|---|
| Stockage | IndexedDB, base `athletics`, magasins `checkins` (clé = date) et `reglages` (clé / valeur) | Demandé ; un enregistrement par jour rend les bilans simples à calculer. Les magasins des jalons suivants s'ajoutent par migration, sans toucher aux données existantes. |
| Enregistrement | Automatique à chaque geste, pas de bouton | Objectif « moins de 30 secondes » ; aucun risque d'oublier de valider. |
| Valeur vide | `null` = non renseigné, distinct de `0` et de « non » | Le bilan hebdomadaire ne comptera pas un jour non rempli comme un jour à zéro cigarette. |
| Jour d'un check-in | Jour calendaire de l'appareil ; le sommeil est la nuit qui précède | Correspond à un check-in du soir. Après minuit, la flèche ‹ ramène à la veille. |
| Jours passés | Modifiables avec les flèches ; le futur est bloqué | Rattraper un jour oublié sans friction. |
| Durée de sommeil | Calculée et stockée (`sommeilMin`) | Évite de la recalculer partout ; gère le passage de minuit. |
| Saisie des heures | Champ natif `type="time"` + bouton « comme la dernière fois » | Roulette native iOS, et un seul geste les jours habituels. |
| Couleurs des choix | Même couleur pour « oui » et « non », pas de rouge | Ton neutre : l'app enregistre, elle ne juge pas. |
| Export | Fichier JSON versionné (`format: 1`) contenant tous les magasins | L'import du J5 relira ce format ; le numéro permettra de le faire évoluer. |
| Remise du fichier | Feuille de partage iOS si disponible, sinon téléchargement | Dans une PWA installée sur iPhone, le téléchargement direct est peu fiable ; le partage permet « Enregistrer dans Fichiers ». |
| Rappel de sauvegarde | Carte discrète à l'accueil à partir de 3 check-ins, si aucun export depuis 7 jours | Rappel sans insistance. |

## Points à vérifier sur iPhone (J2)

- [ ] Remplir un check-in complet prend moins de 30 secondes.
- [ ] Les champs Coucher / Lever ouvrent la roulette iOS, s'affichent correctement (hauteur, texte non coupé) et la durée se met à jour.
- [ ] Toucher le champ Notes ne provoque pas de zoom de la page.
- [ ] Fermer complètement l'app puis la rouvrir : les données du jour sont toujours là.
- [ ] En mode avion, la saisie fonctionne et reste enregistrée.
- [ ] Réglages → Exporter mes données ouvre la feuille de partage ; « Enregistrer dans Fichiers » produit un fichier `.json` lisible.
- [ ] Après l'export, « Dernier export » indique « aujourd'hui ».
- [ ] La mise à jour J1 → J2 arrive bien : ouvrir l'app, la fermer, la rouvrir (Réglages doit afficher 0.2.0).

## Choix techniques (J3)

| Sujet | Choix | Raison |
|---|---|---|
| Données | Deux magasins : `seances` (le programme prévu) et `journal` (les séances réalisées). Base passée en version 2 par migration. | Le journal recopie les noms et les valeurs : modifier le programme ne réécrit pas le passé. Les données du J2 sont conservées (vérifié). |
| Programme de départ | Au choix : exemple ou 5 séances vides | L'exemple évite de tout taper au téléphone, mais rien n'est imposé et aucune charge n'est proposée. |
| Jours de la semaine | Les séances ne sont pas rattachées à un jour | Liberté de faire les séances dans l'ordre voulu ; la régularité du J5 comptera les séances faites sur 5 prévues. |
| Pré-remplissage | Dernière séance du même exercice (même numéro de série), sinon cible du programme | Dans le cas courant, valider une série = un seul appui. |
| Report de charge | Si la charge est modifiée sur une série, elle est proposée pour les séries suivantes de l'exercice | Évite de refaire le réglage à chaque série. |
| Chronomètre | Basé sur l'heure de fin, pas sur un décompte | Reste exact même si iOS suspend l'app quand l'écran s'éteint. |
| Fin de repos | Changement de couleur + bip (Web Audio) + vibration si disponible | Voir les limites iPhone ci-dessous. |
| Écran allumé | Screen Wake Lock demandé pendant la séance | Évite que l'écran s'éteigne pendant le repos ; ignoré sans erreur s'il est refusé. |
| Reprise | La séance en cours est enregistrée à chaque geste (`fin: null`) | Fermer l'app ou recevoir un appel ne fait rien perdre. |
| Lien avec le check-in | Terminer une séance met « Séance : faite » sur le check-in du jour | Une saisie de moins le soir. |
| Historique | Calculé à la volée depuis le journal, par identifiant d'exercice puis par nom | Pas de données dupliquées ; un exercice recréé sous le même nom retrouve son historique. |
| Nettoyage des écrans | `monter()` peut renvoyer une fonction appelée en quittant l'écran | Arrête proprement le chronomètre et libère l'écran. |

## Points à vérifier sur iPhone (J3)

- [ ] La mise à jour arrive (Réglages affiche 0.3.0) et les check-ins du J2 sont toujours là.
- [ ] Dans l'éditeur, les champs Séries / Rép. / Kg / Repos ouvrent un pavé numérique, avec la virgule disponible pour Kg.
- [ ] En mode séance, les boutons − / + répondent vite, sans zoom de la page en appuyant deux fois rapidement.
- [ ] Le chronomètre reste juste après avoir verrouillé puis rallumé l'iPhone.
- [ ] L'écran reste allumé pendant une séance (Wake Lock). Sur des versions d'iOS plus anciennes, il peut ne pas fonctionner dans une app installée : dans ce cas l'écran s'éteint normalement, sans autre effet.
- [ ] Le bip de fin de repos : il est coupé quand l'iPhone est en mode silencieux, et l'iPhone ne permet pas la vibration depuis une app web. Le changement de couleur reste le signal fiable.
- [ ] Fermer l'app en pleine séance puis la rouvrir : la carte « Séance en cours » permet de reprendre.
- [ ] Les fenêtres de confirmation (terminer avec des séries restantes, abandonner, retirer) s'affichent bien.

## Choix techniques (J4)

| Sujet | Choix | Raison |
|---|---|---|
| Données | Magasin `mesures` (clé = date), base passée en version 3. Réglage `periode` : début, date cible, objectifs facultatifs. | Une mesure par jour, poids et tour de taille indépendants (l'un peut manquer). Données des jalons précédents conservées (vérifié). |
| Rythme | Saisie libre, rappel à l'accueil après 7 jours sans mesure | « Hebdomadaire » sans contrainte : une mesure en retard reste possible, sans message culpabilisant. |
| Période | Démarre à la première mesure, dure 6 mois ; figée à la première mesure, modifiable ensuite | La date cible ne bouge pas toute seule. |
| Objectifs | Facultatifs, saisis par l'utilisateur, simple trait horizontal | Aucun objectif imposé ni calculé. |
| Graphique | SVG fait main, sans bibliothèque | Léger, hors ligne, aucune dépendance. |
| Deux graphiques | Un par mesure, chacun avec son propre axe | Le kg et le cm n'ont pas la même échelle : un graphique à deux axes serait trompeur. |
| Tendance | Régression linéaire sur toutes les mesures de la période, prolongée jusqu'à la date cible ; affichée à partir de 3 mesures sur 14 jours | Lisse les variations d'une semaine à l'autre. Moins de recul donnerait une droite peu fiable. |
| Résumé | Dernière valeur, écart depuis le début, tendance par semaine | Chiffres neutres : ni rouge ni vert, aucun jugement. |
| Toucher | Bulle avec valeur et date de la mesure la plus proche | Lecture précise sans surcharger le graphique d'étiquettes. |
| Couleur | Vert de l'app pour les mesures, gris pour la tendance et les repères | Contraste vérifié sur le fond sombre. |
| Écran Corps | Gestionnaires d'événements posés une seule fois, rendu séparé | Évite les actions en double après une mise à jour de l'écran. |

## Points à vérifier sur iPhone (J4)

- [ ] La mise à jour arrive (Réglages affiche 0.4.0) ; check-ins, programme et séances sont toujours là.
- [ ] Les champs Poids et Tour de taille ouvrent un pavé numérique avec la virgule.
- [ ] Le champ Date ouvre le calendrier iOS et s'affiche sans être tronqué.
- [ ] Toucher le graphique affiche la bulle ; faire défiler la page en partant du graphique reste possible.
- [ ] Les libellés du graphique (mois, valeurs, date cible) sont lisibles sans zoom.
- [ ] Le bloc « Période et objectifs » s'ouvre et se ferme.

## Limite connue à anticiper : les rappels (J5)

Sur iOS, une PWA installée peut recevoir des notifications, mais uniquement des notifications **push envoyées par un serveur**. Une app sans backend ne peut pas programmer une notification qui se déclenche quand elle est fermée.

Conséquence pour J5, à trancher le moment venu :

1. **Rappel visible dans l'app** (prévu par le cahier des charges comme solution de repli) : fiable, mais visible seulement à l'ouverture.
2. **Fichier calendrier (.ics)** généré par l'app, avec des alarmes récurrentes pour la séance et le check-in du soir : s'importe dans Calendrier d'iOS, sonne même app fermée, sans serveur ni service tiers.
3. **Notification locale** tant que l'app est ouverte ou en arrière-plan récent : possible, mais peu utile en pratique.

Recommandation actuelle : 1 + 2.
