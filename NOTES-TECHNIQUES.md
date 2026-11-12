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

## Choix techniques (J5)

| Sujet | Choix | Raison |
|---|---|---|
| Semaine | Lundi → dimanche ; la semaine en cours ne compte que les jours écoulés | Un mercredi, 2 check-ins sur 3 jours est juste ; sur 7 jours ce serait décourageant. |
| Séances prévues | Nombre de séances du programme (5 par défaut) | Aucun jour fixe imposé (voir J3). |
| Séance comptée | Journal terminé **ou** check-in « faite », un jour = au plus une séance | Une séance faite hors de l'app compte aussi. |
| Jours vides | Exclus des moyennes, jamais comptés comme zéro | Oublier un check-in ne fausse pas le bilan. |
| Repas équilibrés | Part = repas équilibrés / (repas par jour × jours notés) ; repas par jour réglable, 3 par défaut | Le check-in note le nombre de repas équilibrés, pas le total : il fallait une référence, laissée à l'utilisateur. |
| Message | Construit uniquement à partir de faits favorables (séances, cigarettes en baisse, sommeil en hausse, repas, régularité) ; sinon un message neutre | Ton encourageant sans culpabilisation ; les chiffres défavorables restent visibles, sans commentaire. |
| Rappels dans l'app | Carte à l'accueil après l'heure du check-in ; carte de séance les jours choisis, une heure avant l'heure | Seul rappel possible sans serveur quand l'app est ouverte. |
| Rappels hors de l'app | Fichier `.ics` : deux événements récurrents avec alarme, UID fixes | Sonne app fermée, sans serveur ni service tiers. Heure « flottante » : suit le fuseau de l'iPhone. |
| Notifications Web | Non utilisées | Sur iOS, une PWA ne reçoit que des notifications push envoyées par un serveur, exclu par le cahier des charges. |
| Import | Lecture et vérification complètes avant toute modification, aperçu, confirmation, puis remplacement en **une seule transaction** | Un fichier abîmé ne peut pas laisser la base à moitié remplacée. |
| Compatibilité | Format de sauvegarde versionné (`format: 1`) ; un magasin absent (sauvegarde ancienne) est vidé, un format plus récent est refusé | Les sauvegardes des jalons précédents restent importables. |
| Finitions | Écrans provisoires supprimés, version 1.0.0 | — |

## Points à vérifier sur iPhone (J5)

- [ ] La mise à jour arrive (Réglages affiche 1.0.0) ; toutes les données sont là.
- [ ] Bilan : les chiffres correspondent aux check-ins de la semaine ; les flèches changent de semaine.
- [ ] Après 21 h (ou l'heure choisie), l'accueil affiche le rappel du check-in, qui disparaît une fois le check-in complet.
- [ ] **Fichier calendrier** : « Ajouter les rappels au calendrier » ouvre soit la feuille de partage, soit un aperçu Calendrier avec « Ajouter tout ». Si rien ne se passe dans l'app installée, essayer depuis Safari (même adresse) : les événements ajoutés au calendrier ne dépendent pas de l'app. Vérifier ensuite que l'alarme sonne à l'heure prévue.
- [ ] **Import** : « Importer une sauvegarde » ouvre le sélecteur de Fichiers ; l'aperçu s'affiche ; après confirmation, les données sont restaurées.
- [ ] Test complet conseillé : exporter, supprimer l'icône de l'écran d'accueil, réinstaller, importer, vérifier que tout est revenu.

## Choix techniques (1.1 — programme sur-mesure)

| Sujet | Choix | Raison |
|---|---|---|
| Contenu | `js/plan.js`, source unique ; `PROGRAMME.md` en est généré | Une seule définition, impossible de désynchroniser l'app et le document. |
| Structure | 3 phases (4, 8 et 14 semaines), 3 séances de musculation + 2 de cardio | Départ très sédentaire : d'abord la technique et l'habitude, puis le volume, puis l'intensité. Le cardio en zone 2 vise la graisse abdominale ; les intervalles n'arrivent qu'en phase 2. |
| Stockage | Réglage `plan` (date de début = un lundi, phase) ; les séances de la phase sont écrites dans `seances` | Aucune nouvelle table : le programme reste éditable comme n'importe quel autre, et l'export / import le couvre. |
| Passage de phase | Proposé, jamais automatique, avec confirmation | Garder la main, notamment si la phase actuelle a été modifiée. |
| Continuité | L'historique se retrouve par nom d'exercice d'une phase à l'autre | Les charges suivent quand un exercice revient (tirage vertical, leg curl…). |
| Progression | Double progression : toutes les séries prévues aux répétitions visées → + 2,5 kg proposés, répétitions remises à l'objectif | Simple, éprouvée, et automatique : un seul appui dans le cas courant. |
| Semaine allégée | Une série de moins pour les exercices de 3 séries ou plus, sans progression ; le cardio n'est pas allégé | Récupération planifiée ; le cardio en zone 2 ne fatigue pas assez pour justifier une baisse. |
| Unités | `reps`, `s`, `min` par exercice ; pas des boutons 1, 5 et 1 ; charge masquée pour les minutes | Gainage et cardio se saisissent naturellement. |
| Intervalles | Séries de 1 minute, le repos du chronomètre sert de phase lente | Réutilise le chronomètre existant. |
| Robustesse | Liste des séances : gestionnaires posés une seule fois, verrou contre le double appui, une seule séance en cours possible | Corrige un défaut présent depuis le J3 : après un rechargement de la liste, « Démarrer » pouvait créer deux séances. |

## Points à vérifier sur iPhone (1.1)

- [ ] Réglages affiche 1.1.0 ; adopter le programme sur-mesure remplace bien les séances, l'historique reste.
- [ ] En séance : consigne lisible, libellés Secondes / Minutes, pas de champ charge pour le cardio.
- [ ] Deuxième passage d'un exercice réussi : la charge + 2,5 kg est proposée.
- [ ] Le sélecteur d'unité de l'éditeur ouvre la roue iOS.

## Choix techniques (1.2 — Push / Pull / Legs / Upper / Lower)

| Sujet | Choix | Raison |
|---|---|---|
| Répartition | Push mardi, Pull mercredi, Legs jeudi, Upper samedi, Lower dimanche | Demandé. Chaque groupe musculaire est travaillé deux fois par semaine, avec au moins 48 h entre deux séances qui le sollicitent fortement (Legs jeudi → Lower dimanche). |
| Lower ≠ Legs | Legs centré sur les quadriceps (squat, presse), Lower sur fessiers et ischios (hip thrust, soulevé de terre, fentes) | Varier les mouvements et limiter la fatigue cumulée des genoux. |
| Cardio | En fin de chaque séance (10 à 20 min de zone 2), intervalles de 30 s le samedi à partir de la phase 2 | Plus de séance dédiée : le cardio reste présent pour la graisse viscérale et le souffle, sans gêner la musculation. 10 min seulement après Legs. |
| Jours de repos | Lundi et vendredi, marche conseillée | Activité douce sans coût de récupération. |
| Rappels | Adopter ou mettre à jour le programme règle les jours de rappel sur mar, mer, jeu, sam, dim ; les heures sont conservées | Cohérence avec le planning, sans écraser les heures choisies. Le fichier calendrier est à régénérer. |
| Mise à niveau | `plan.version` (1 → 2) ; carte « Mettre à jour mes séances » pour un programme adopté en 1.1, phase et semaine conservées | Pas de remplacement silencieux des séances. |
| Cardio sans charge | Drapeau `sansCharge` sur le cardio et les intervalles : pas de champ de charge, pas de série retirée en semaine allégée | Les intervalles se comptent en secondes mais n'ont pas de charge. |
| Volume | 15 à 18 séries de musculation par séance en phase 1, 17 à 22 en phase 3 | Montée progressive adaptée à un départ très sédentaire. |

## Points à vérifier sur iPhone (1.2)

- [ ] Réglages affiche 1.2.0. Si le programme avait été adopté en 1.1, le bouton « Mettre à jour mes séances » apparaît.
- [ ] Les rappels de séance tombent les mardis, mercredis, jeudis, samedis et dimanches (Réglages → Rappels) ; régénérer le fichier calendrier.
- [ ] Durée réelle d'une séance de phase 1 : si elle dépasse nettement 1 h 15, réduire le cardio ou une série d'isolation.

## Choix techniques (1.3 — séance du jour, remplacement d'exercice)

| Sujet | Choix | Raison |
|---|---|---|
| Jour d'une séance | Champ `jour` sur chaque séance (0 = dimanche, `null` = libre), rempli par le programme, modifiable dans l'éditeur | Fonctionne aussi pour un programme fait à la main. |
| Programme adopté en 1.2 | Sans champ `jour`, les jours du programme suivent l'ordre des séances | Rien à refaire pour un programme déjà en place. |
| Carte de l'accueil | Séance en cours → Reprendre ; sinon séance du jour → Démarrer ; sinon jour de repos | Une seule carte, la plus utile au moment présent. Elle remplace le rappel de séance quand les jours sont connus. |
| Démarrage | Fonction commune `demarrerSeance()` (accueil et onglet Séances), sans effet si une séance est déjà en cours ; bouton désactivé pendant le démarrage | Une seule logique ; impossible de lancer deux séances. |
| Alternatives | Catalogue de groupes de mouvements équivalents (`js/alternatives.js`) ; saisie libre possible | Couvre tous les exercices du programme, sans service externe. |
| Remplacement | Possible tant qu'aucune série de l'exercice n'est validée | Les séries déjà faites restent attribuées au bon exercice. |
| Historique | Le remplaçant reçoit un nouvel identifiant ; ses charges sont reprises de sa dernière exécution (par nom) | L'historique du développé couché ne se mélange pas avec celui des pompes. |
| Durée du changement | « Pour cette séance » ne touche que le journal ; « Aussi les prochaines fois » modifie aussi le programme | Une machine occupée n'est pas une décision durable. |

## Points à vérifier sur iPhone (1.3)

- [ ] Un mardi, l'accueil propose Push ; « Démarrer » ouvre directement la séance.
- [ ] En séance, « Remplacer » affiche les alternatives ; la saisie libre ouvre le clavier sans zoom.
- [ ] Le sélecteur « Jour » de l'éditeur ouvre la roue iOS.

## Choix techniques (1.4 — calendrier et records)

| Sujet | Choix | Raison |
|---|---|---|
| Calendrier | Vue mensuelle depuis le bilan (`#/bilan/mois/AAAA-MM`) ; une case par jour : séance faite, check-in rempli, repos, séance prévue | Voir la régularité d'un coup d'œil. Navigation limitée aux mois qui ont des données, jusqu'au mois en cours. |
| Pas de « série » | Aucun compteur de jours consécutifs | Un compteur remis à zéro au premier oubli est démotivant ; le calendrier montre ce qui a été fait, pas ce qui a été manqué. |
| Codage des cases | Plein = séance, trait bas = check-in, contour gris = repos, contour vert = prévu ; chaque case a un libellé lisible par VoiceOver | L'information ne repose pas sur la seule couleur. |
| Max estimé | Formule d'Epley, `charge × (1 + reps / 30)`, jusqu'à 12 répétitions, arrondi à 0,5 kg à l'affichage | Formule simple et répandue ; au-delà de 12 répétitions l'estimation devient peu fiable. Présentée comme une estimation, jamais comme un test à réaliser. |
| Records | Regroupés par nom d'exercice, séances terminées, exercices en répétitions avec charge | Cohérent avec l'historique et le remplacement d'exercice. |
| Annonce | En fin de séance : record de charge, ou à défaut de max estimé ; un exercice fait pour la première fois ne compte pas | Pas de faux records à la première séance. |
| Routeur | Les morceaux d'adresse sont décodés (`decodeURIComponent`) | Un identifiant avec accents ou espaces ouvre bien la bonne page. |

## Points à vérifier sur iPhone (1.4)

- [ ] Le calendrier tient sur l'écran sans défilement horizontal ; les cases se touchent facilement.
- [ ] L'annonce de fin de séance affiche un nouveau record après une séance plus lourde.

## Choix techniques (2.0 — refonte « tableau blanc »)

| Sujet | Choix | Raison |
|---|---|---|
| Direction | « Tableau blanc de salle » : fond blanc, encre noire, feutres bleu (sélection, action) et vert (fait) | Usage principal en salle entre les séries : lisible d'un coup d'œil, même en pleine lumière. |
| Thème | Clair uniquement (`color-scheme: light`) | Choix validé : le thème sombre n'était plus une contrainte. |
| Polices | Barlow (texte) et Barlow Condensed (chiffres, titres), en woff2 dans `fonts/`, mises en cache par le service worker | Aucune dépendance réseau, chiffres larges et étroits pour le chrono et les charges. |
| Icônes | SVG en ligne (`js/icones.js`) à la place des caractères ‹ › − + | Rendu identique sur tous les appareils. |
| Accueil | Bande « la semaine en bref » (fait, prévu, repos, aujourd'hui) | Voir la régularité sans ouvrir le bilan. |
| Séance | Bouton « Série faite » collé au-dessus des onglets, chrono en 64 px | Un seul geste entre deux séries. |
| Accessibilité | Contrastes ≥ 4,5:1, cibles ≥ 44 px, animation coupée si « réduire les animations » | Vérifié par le détecteur Impeccable (aucune alerte sur les 6 écrans). |
| Données | Aucun changement de base (VERSION_DB 3) | La refonte ne touche que l'affichage : les données existantes restent intactes. |

## Points à vérifier sur iPhone (2.0)

- [ ] Après mise à jour (fermer puis rouvrir l'app), le thème blanc et les nouvelles polices s'affichent, y compris hors ligne.
- [ ] La barre d'état est lisible (texte sombre sur fond blanc).
- [ ] En séance, le bouton « Série faite » reste accessible au pouce sans masquer le chrono.
- [ ] L'icône de l'écran d'accueil est la nouvelle (il peut falloir supprimer puis réinstaller l'app — exporter d'abord ses données).

## Choix techniques (2.1 — chrono compact et sauvegarde depuis l'accueil)

| Sujet | Choix | Raison |
|---|---|---|
| Chrono de repos | Une seule bande (~100 px) : temps à gauche, −15 s / +15 s / Passer à droite | Le champ Répétitions reste visible au-dessus du bouton « Série faite » pendant le repos. |
| Petits écrans | Hauteur ≤ 740 px (iPhone SE) : « Série faite » reste dans le flux, sous les répétitions | Un bouton collé masquerait un champ sur un écran court. |
| Focus | `scroll-padding-bottom` en séance | Un champ touché défile au-dessus du bouton et des onglets. |
| Rappel de sauvegarde | À l'accueil dès 3 check-ins ou séances, si le dernier export date de 7 jours ou plus ; bouton « Exporter maintenant » | Les données ne vivent que sur le téléphone : l'export doit être à un geste. |
| Export depuis l'accueil | Fichier préparé dès l'appui (`pointerdown`), feuille de partage ouverte au clic | Safari n'ouvre la feuille de partage que juste après le geste. |
| « Plus tard » | Masque le rappel 3 jours (réglage `sauvegardeReportee`) | Rappeler sans insister. |

## Points à vérifier sur iPhone (2.1)

- [ ] Pendant le repos, le chrono, la charge, les répétitions et « Série faite » tiennent sur un écran.
- [ ] « Exporter maintenant » à l'accueil ouvre la feuille de partage ; « Enregistrer dans Fichiers » fait disparaître le rappel.

## Choix techniques (2.2 — courbe de progression par exercice)

| Sujet | Choix | Raison |
|---|---|---|
| Où | Fiche de l'exercice (« Historique » en séance ou dans l'éditeur, et chaque ligne de Records) | Là où l'on se demande « est-ce que je progresse ? ». |
| Mesures | Charge la plus lourde de la séance, ou max estimé de la meilleure série (bascule) ; sans charge : meilleure série (répétitions ou durée) | Avec la progression double, la charge reste stable pendant que les répétitions montent : le max estimé le rend visible. |
| Forme | Une courbe, un axe, une mesure à la fois ; dernière valeur écrite au bout | Lisible en un coup d'œil, pas de double axe. |
| Axe des dates | Une graduation par semaine (ou deux) sur 8 semaines, puis une par mois | Garde des repères lisibles du début à la fin des 6 mois. |
| Graduations en kg | Pas de 2,5 kg plutôt que 2 | Correspond aux charges réellement utilisées. |
| Toucher | Bulle : valeur, date et séries du jour (« 22,5 kg × 10, 10, 9 ») | Le détail sans quitter le graphique. |
| Peu de données | Courbe dès la 2ᵉ séance ; avant, un message | Un seul point ne dit rien d'une progression. |
| Correctif | Bouton « Retour » de la fiche exercice et des records : l'icône s'affichait en texte brut | Erreur introduite par la refonte 2.0. |

## Points à vérifier sur iPhone (2.2)

- [ ] Toucher la courbe affiche la bulle ; toucher ailleurs la referme.
- [ ] La bascule Charge / Max estimé répond au premier toucher.

## Choix techniques (3.0 — refonte « Projecteur »)

Direction choisie sur le canevas de maquettes (option D), à partir de la piste B « Vestiaire de nuit ».

| Sujet | Choix | Raison |
|---|---|---|
| Thème | Sombre (`color-scheme: dark`), fond #0f1115 éclairé par le haut, grain très léger | Lisible en salle et le soir ; l'écran ne fatigue pas les yeux au check-in de 21 h. |
| Couleurs | Braise (#ff6b2c) = action, menthe (#3ddc97) = fait, craie = sélection ; texte foncé sur les trois | Un rôle par couleur ; contrastes vérifiés (≥ 4,5:1). |
| Polices | Big Shoulders Display (titres, chiffres) et Inter Tight (texte), en woff2 dans `fonts/` | Chiffres étroits et très lisibles ; hors ligne. |
| Navigation | Barre flottante d'icônes, libellés lus par VoiceOver ; masquée en séance et en fin de séance | Mode concentré pendant l'effort. |
| Accueil | Piste des 26 semaines (phases, semaines allégées), carte « Ce soir » en titre géant, semaine avec le nom des séances, tuiles du check-in qui mènent à chaque rubrique | Toute la transformation et la journée en un écran. |
| Séance | Anneau de repos qui se vide (durée totale gardée dans `reposDuree`), points des séries, charge et répétitions côte à côte, « la dernière fois », barre « Série faite » + exercice suivant fixée en bas | Un geste entre deux séries ; rien n'est masqué, même sur iPhone SE (mise en page compacte sous 740 px de haut). |
| Fin de séance | Nouvel écran `#/seances/fin/<id>` : récapitulatif, nouveaux records avec la courbe du max estimé, semaine, séance suivante | Le moment qui récompense ; remplace l'ancien message en haut de Séances. |
| Ombres | Ombres neutres, pas de halo coloré | Signalé par le détecteur Impeccable ; plus sobre. |
| Données | Aucun changement de base (VERSION_DB 3) ; le champ `reposDuree` d'une séance en cours est facultatif | Les séances commencées avec la 2.x reprennent normalement. |

## Points à vérifier sur iPhone (3.0)

- [ ] Après mise à jour, le thème sombre et les polices s'affichent, y compris hors ligne ; la barre d'état (heure, batterie) reste lisible sur le fond sombre.
- [ ] L'anneau de repos se vide régulièrement, même après avoir verrouillé puis rouvert l'iPhone.
- [ ] La barre « Série faite » ne cache ni la charge ni les répétitions pendant le repos.
- [ ] Toucher une tuile du check-in amène à la bonne rubrique.
- [ ] La nouvelle icône (fond sombre, trois barres) : il faut réinstaller l'app pour la voir — exporter ses données avant.

## Choix techniques (3.1 — bilans de phase et pesée depuis Santé)

| Sujet | Choix | Raison |
|---|---|---|
| Bilan de phase | Écran `#/bilan/phase/<n>` : régularité, corps (dernière mesure connue au début → dernière de la phase), progrès en salle (max estimé de la 1re séance de la phase → meilleur) et phase suivante | Donner des étapes aux 6 mois, uniquement avec des faits. |
| Accès | Accueil (semaine qui suit la fin d'une phase), Bilan (lien vers la phase de la semaine affichée), Séances (avant de passer à la phase suivante) | Le bilan arrive au moment où il sert. |
| Semaines allégées | Annonce la veille (semaines 8, 16, 24) | Éviter la surprise d'une série en moins. |
| Calculs | Module pur `js/phase.js`, testé sans interface | Fiable et vérifiable. |
| Santé | Raccourci iOS → presse-papiers → bouton « Coller la pesée de Santé » (`navigator.clipboard.readText`) | iOS ouvre les liens dans Safari, pas dans l'app installée (stockage séparé) : le presse-papiers est le seul pont fiable. Rien n'est enregistré sans validation ; les livres sont refusées. |

## Points à vérifier sur iPhone (3.1)

- [ ] Le raccourci « Pesée Athletics » copie la dernière pesée de Santé.
- [ ] Dans Corps, « Coller la pesée de Santé » affiche la bulle « Coller » d'iOS, puis remplit le poids.
- [ ] En semaine 5, l'accueil propose le bilan de la phase 1.

## Récapitulatif : ce qui ne peut être vérifié que sur un vrai iPhone

- Installation, plein écran, encoche et barre d'accueil (J1).
- Roulettes iOS des heures et du calendrier, pavés numériques avec virgule, absence de zoom à la saisie (J2 à J4).
- Feuille de partage pour l'export et le fichier calendrier (J2, J5).
- Son de fin de repos (coupé en mode silencieux) et écran maintenu allumé pendant une séance (J3).
- Conservation des données après plusieurs jours sans ouvrir l'app (l'app installée y est protégée).

## Note sur les rappels

Les notifications d'une PWA sur iOS nécessitent un serveur push. Le choix retenu au J5 : rappels visibles dans l'app et fichier calendrier `.ics` (voir le tableau J5).
