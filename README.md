# Athletics

Application web progressive (PWA) personnelle de suivi de transformation physique.
Tout reste sur l'appareil : pas de serveur, pas de compte, pas de service tiers.

**Version 1.4.0** — check-in quotidien et séance du jour, programme sur-mesure de 6 mois (Push / Pull / Legs / Upper / Lower) et mode séance, suivi du poids et du tour de taille sur 6 mois, bilan hebdomadaire et calendrier, records, rappels, sauvegarde et restauration JSON.

App en ligne : <https://medbensito.github.io/ATHLETICS/> (dépôt `medbensito/ATHLETICS`, GitHub Pages sur la branche `main`).

## Structure du projet

```
ATHLETICS/
├── index.html            Page unique de l'app (en-tête, contenu, navigation basse)
├── manifest.json         Identité PWA : nom, couleurs, icônes, mode plein écran
├── sw.js                 Service worker : cache de l'app pour le hors ligne
├── css/style.css         Thème sombre, zones sûres iPhone, composants
├── js/
│   ├── app.js            Routeur, démarrage, service worker
│   ├── db.js             Accès à IndexedDB (lecture, écriture, structure)
│   ├── dates.js          Dates et durées (clé de jour, durée de sommeil)
│   ├── sauvegarde.js     Export et import JSON
│   ├── programme.js      Programme et journal des séances : données et calculs
│   ├── corps.js          Mesures, période de 6 mois, tendance : données et calculs
│   ├── graphique.js      Graphique SVG (sans bibliothèque) et bulle au toucher
│   ├── bilan.js          Bilan hebdomadaire : calculs et message de la semaine
│   ├── rappels.js        Rappels dans l'app et fichier calendrier (.ics)
│   ├── plan.js           Programme sur-mesure 6 mois : contenu et phases
│   ├── seance-du-jour.js Séance prévue aujourd'hui, démarrage d'une séance
│   ├── alternatives.js   Exercices de remplacement, par groupes de mouvements
│   ├── records.js        Records, max estimé, nouveaux records d'une séance
│   ├── plateforme.js     Détection iOS / app installée, état technique
│   ├── ui.js             Morceaux d'interface partagés
│   ├── version.js        Numéro de version affiché dans les réglages
│   └── vues/
│       ├── checkin.js    Écran « Aujourd'hui » : check-in quotidien
│       ├── seances.js    Écran « Séances » : programme et éditeur
│       ├── seance-en-cours.js  Mode séance et chronomètre de repos
│       ├── exercice.js   Historique d'un exercice
│       ├── corps.js      Écran « Corps » : mesures, graphiques, période
│       ├── bilan.js      Écran « Bilan » : le point de la semaine
│       ├── calendrier.js Calendrier de régularité, mois par mois
│       ├── records.js    Écran « Records »
│       └── reglages.js   Écran « Réglages » : rappels, sauvegarde, état de l'app
├── icons/                Icônes 180 (iOS), 192, 512 et 512 « maskable »
├── README.md             Ce fichier
├── PROGRAMME.md          Le programme sur-mesure en entier
└── NOTES-TECHNIQUES.md   Choix techniques et points à vérifier sur iPhone
```

## Utiliser le check-in

- Tout s'enregistre tout seul à chaque geste : il n'y a pas de bouton « Enregistrer ».
- Rien n'est obligatoire. Une rubrique laissée vide reste « non renseignée » (différent de zéro ou de « non »).
- Un second appui sur un choix le retire.
- Compteurs (repas équilibrés, cigarettes) : depuis l'état vide, **−** note zéro et **+** note 1.
- Sommeil : il s'agit de la nuit qui précède le jour affiché. La durée est calculée automatiquement, y compris quand la nuit passe minuit. Dès qu'une nuit a été saisie, un bouton propose de reprendre les mêmes heures.
- Les flèches **‹ ›** permettent de remplir ou corriger un jour passé.

## Séance du jour

- Chaque séance peut avoir un jour (le programme sur-mesure les règle : mardi Push, mercredi Pull, jeudi Legs, samedi Upper, dimanche Lower). Le jour se change dans l'éditeur, ou se met sur « Libre ».
- L'écran **Aujourd'hui** affiche la séance prévue avec un bouton **Démarrer** : un appui et le mode séance s'ouvre. Une séance commencée y apparaît avec **Reprendre**.
- Les jours sans séance, l'écran indique un jour de repos et suggère une marche.
- La carte disparaît dès que la séance est faite, ou si « Repos » ou « Non faite » est coché dans le check-in.

## Utiliser les séances

**Programme sur-mesure** (recommandé, détail dans `PROGRAMME.md`)

- 26 semaines en 3 phases : **Fondations** (1–4), **Construction** (5–12), **Performance** (13–26).
- Chaque semaine : **Push** le mardi, **Pull** le mercredi, **Legs** le jeudi, **Upper** le samedi, **Lower** le dimanche ; repos le lundi et le vendredi. Cardio en fin de séance, intervalles le samedi à partir de la phase 2.
- Adopter le programme règle les rappels de séance sur ces cinq jours (les heures ne changent pas).
- Pour l'adopter : onglet Séances → **Programme sur-mesure 6 mois** (ou **Adopter ce programme** si un programme existe déjà). Les séances réalisées restent dans l'historique.
- Programme adopté en version 1.1 : un bouton **Mettre à jour mes séances** applique la nouvelle répartition en gardant la semaine et la phase.
- La carte du programme indique la phase et la semaine. Quand une phase commence, un bouton **Passer à la phase suivante** apparaît.
- **Progression** : quand toutes les séries d'un exercice atteignent les répétitions visées, l'app propose + 2,5 kg la fois suivante.
- **Semaines allégées** (8, 16, 24) : une série de moins par exercice de musculation, même charge.
- Chaque exercice a une consigne et une unité (répétitions, secondes ou minutes). Pour le cardio et les intervalles, la charge n'est pas demandée et le chronomètre de repos sert de phase lente.

**Programme** (onglet Séances)

- Autres départs possibles : un programme d'exemple simple ou 5 séances vides. Aucune charge n'est imposée.
- **Modifier** ouvre l'éditeur : nom de la séance, et pour chaque exercice nom, séries, quantité, charge (kg), temps de repos (secondes), unité et consigne. Les flèches ↑ ↓ changent l'ordre. Tout s'enregistre automatiquement.
- Laisser « Kg » vide pour un exercice au poids du corps.
- Modifier le programme ne change jamais les séances déjà réalisées.

**Mode séance** (bouton Démarrer)

- La charge et les répétitions sont pré-remplies avec ce qui a été fait la dernière fois, sinon avec le programme. Les boutons − / + ajustent (2,5 kg par appui pour la charge) ; on peut aussi toucher le nombre pour le saisir.
- **Série faite** valide la série et lance le chronomètre de repos (− 15 s, + 15 s, Passer). À la fin du repos, l'écran change de couleur et un signal sonore retentit si le son est disponible.
- Une série validée par erreur : toucher sa pastille pour la corriger.
- **Remplacer** (avant la première série d'un exercice) : machine occupée, matériel absent, gêne. L'app propose des exercices équivalents, ou en accepte un saisi librement. **Pour cette séance** ne change que la séance du jour ; **Aussi les prochaines fois** modifie aussi le programme. Chaque exercice garde son propre historique : un remplaçant déjà fait retrouve ses charges.
- On peut passer d'un exercice à l'autre dans la liste, et ajouter une série.
- **Terminer la séance** l'enregistre et coche « Séance : faite » dans le check-in du jour.
- Si l'app est fermée en pleine séance, elle reprend où elle en était (carte « Séance en cours »).

**Historique** : lien « Historique » dans le mode séance ou dans l'éditeur — dernière charge, meilleure charge, max estimé et détail séance par séance avec l'écart d'une fois sur l'autre.

**Records** (onglet Séances, en bas) : meilleure charge et max estimé de chaque exercice. Le max estimé est la charge théorique sur une répétition, calculée d'après tes séries (formule d'Epley, jusqu'à 12 répétitions) : une estimation, pas un test à faire. En fin de séance, les nouveaux records sont annoncés.

## Utiliser le suivi corporel

- Onglet **Corps** → **Mesure de la semaine** : poids (kg) et/ou tour de taille (cm), puis **Enregistrer**. Une seule mesure par jour ; ressaisir le même jour la met à jour.
- Conseil : mesurer dans les mêmes conditions chaque semaine (même jour, le matin à jeun). L'accueil affiche un rappel discret quand la dernière mesure date de 7 jours ou plus.
- **Graphiques** : un pour le poids, un pour le tour de taille. Ils couvrent la période de 6 mois, avec la date cible (trait vertical pointillé) et la tendance (droite pointillée, prolongée jusqu'à la date cible). Toucher le graphique affiche la valeur et la date de la mesure la plus proche.
- La tendance apparaît à partir de 3 mesures sur au moins 2 semaines.
- **Période et objectifs** (en bas de l'écran) : la période démarre à la première mesure et dure 6 mois ; les deux dates sont modifiables. Poids et tour de taille visés sont facultatifs et n'ajoutent qu'un repère sur la courbe.
- **Toutes les mesures** : liste complète, pour modifier ou supprimer une mesure.

## Utiliser le bilan

- Onglet **Bilan** : la semaine en cours (lundi → dimanche), et les semaines passées avec les flèches ‹ ›.
- **Régularité** : séances faites sur prévues (prévues = nombre de séances du programme), check-ins remplis sur les jours écoulés.
- **Sommeil** (durée et qualité moyennes), **cigarettes** par jour, **alimentation** (part de repas équilibrés, jours sans grignotage, jours sans boisson sucrée), chacun comparé à la semaine précédente.
- Une séance compte si elle a été terminée dans l'app **ou** si le check-in indique « faite ».
- Les moyennes ne portent que sur les jours renseignés : un jour vide ne compte jamais comme un zéro.
- Le message de la semaine ne reprend que des faits encourageants ; les chiffres, eux, restent complets.
- Le nombre de repas par jour (3 par défaut) se règle dans Réglages.
- **Calendrier du mois** (lien en haut du bilan) : chaque jour du mois, avec les séances faites, les check-ins remplis, les jours de repos et les séances prévues. Pas de compteur de jours d'affilée : un oubli n'efface rien.

## Rappels

Sur iPhone, une app web sans serveur ne peut pas envoyer de notification quand elle est fermée. L'app propose deux rappels complémentaires (Réglages → **Rappels**) :

1. **Dans l'app** : à partir de l'heure du check-in du soir, l'écran Aujourd'hui affiche un rappel tant que le check-in est incomplet. Les jours d'entraînement, un rappel de séance apparaît une heure avant l'heure choisie, jusqu'à ce que la séance soit notée.
2. **Dans Calendrier** : **Ajouter les rappels au calendrier** produit un fichier `.ics` avec deux événements récurrents et leurs alarmes (check-in chaque jour, séance les jours choisis). Ouvre-le et choisis **Ajouter tout**. Ces alarmes sonnent même app fermée.

Après un changement d'heure ou de jours, recréer le fichier calendrier (et supprimer les anciens événements dans Calendrier s'ils apparaissent en double).

## Lancer en local (ordinateur)

Un service worker ne fonctionne pas en ouvrant `index.html` par double-clic : il faut un petit serveur local.

Avec Python (Windows) — dans le dossier `ATHLETICS` :

```
py -m http.server 8080
```

Ou avec Node.js :

```
npx serve -l 8080
```

Puis ouvrir <http://localhost:8080>. Pour simuler un iPhone : outils de développement du navigateur (F12) → mode appareil mobile.

Pour tester le hors ligne : charger la page une fois, couper le serveur (Ctrl+C), recharger. L'app doit s'afficher normalement.

## Héberger (nécessaire pour l'iPhone)

L'iPhone exige une adresse en **HTTPS**. N'importe quel hébergement statique gratuit convient, il suffit d'y déposer le contenu du dossier tel quel :

- **GitHub Pages** : créer un dépôt, y pousser les fichiers, puis Settings → Pages → déployer la branche `main`.
- **Cloudflare Pages** ou **Netlify** : glisser-déposer le dossier depuis leur interface.

Tous les chemins sont relatifs : l'app fonctionne à la racine d'un domaine comme dans un sous-dossier (`https://nom.github.io/athletics/`).

L'app ne contient aucune donnée personnelle : les données restent dans le navigateur de l'iPhone. L'adresse peut donc être publique sans exposer quoi que ce soit.

## Installer sur l'iPhone

1. Ouvrir l'adresse de l'app dans **Safari** (pas Chrome ni un navigateur intégré à une autre app).
2. Toucher le bouton **Partager** (carré avec une flèche vers le haut).
3. Choisir **Sur l'écran d'accueil**, puis **Ajouter**.
4. Lancer l'app depuis son icône : elle s'ouvre en plein écran, sans barre Safari.

Toujours utiliser l'app depuis l'icône. L'app installée et l'onglet Safari ont des **données séparées** : ce qui est saisi dans l'un n'apparaît pas dans l'autre.

## Sauvegarde des données

> Safari peut effacer les données d'un site **non installé** après 7 jours sans visite. Installer l'app sur l'écran d'accueil évite cette purge, mais une sauvegarde régulière reste la seule vraie sécurité (changement de téléphone, désinstallation, réinitialisation).

- **Exporter** : Réglages → **Exporter mes données**. Sur iPhone, la feuille de partage s'ouvre : choisir **Enregistrer dans Fichiers** (iCloud Drive de préférence). Sur ordinateur, le fichier est téléchargé.
- Le fichier s'appelle `athletics-sauvegarde-AAAA-MM-JJ.json` et contient toutes les données (check-ins, programme, séances, mesures, réglages).
- L'app rappelle discrètement de sauvegarder quand le dernier export date de plus de 7 jours.
- **Importer** : Réglages → **Importer une sauvegarde**, choisir le fichier. L'app affiche d'abord son contenu ; rien n'est modifié tant que **Remplacer par cette sauvegarde** n'est pas confirmé. L'import **remplace toutes** les données actuelles : exporter d'abord pour les garder. Un fichier abîmé ou étranger est refusé sans rien toucher.
- Changer de téléphone : exporter sur l'ancien, installer l'app sur le nouveau, importer.
- Rythme conseillé : un export par semaine, enregistré dans Fichiers / iCloud Drive.
- Supprimer l'icône de l'écran d'accueil **supprime les données** de l'app : exporter avant.

## Mettre à jour l'app

Le site est publié par GitHub Pages depuis la branche `main` : un `git push` suffit, l'adresse ne change pas. Avant de pousser :

1. Incrémenter `VERSION` dans `sw.js` et `VERSION_APP` dans `js/version.js`.
2. Si un fichier a été ajouté, l'inscrire dans la liste `FICHIERS` de `sw.js`.
3. Sur l'iPhone : ouvrir l'app (elle télécharge la mise à jour en arrière-plan), la fermer, la rouvrir.

Les mises à jour ne touchent jamais les données saisies.

## Jalons

- [x] **J1** — structure, manifest, service worker, écran d'accueil vide
- [x] **J2** — check-in quotidien, stockage IndexedDB, export JSON
- [x] **J3** — programme d'entraînement éditable, mode séance avec chronomètre
- [x] **J4** — suivi corporel, graphique sur 6 mois
- [x] **J5** — bilan hebdomadaire, rappels, import JSON, finitions
- [x] **1.1** — programme sur-mesure 6 mois, progression des charges, semaines allégées
- [x] **1.2** — répartition Push / Pull / Legs / Upper / Lower (mar, mer, jeu, sam, dim)
- [x] **1.3** — séance du jour à l'accueil, remplacement d'exercice en séance
- [x] **1.4** — calendrier de régularité, records et max estimé
