# Athletics

Application web progressive (PWA) personnelle de suivi de transformation physique.
Tout reste sur l'appareil : pas de serveur, pas de compte, pas de service tiers.

**État actuel : jalon J4** — check-in quotidien, programme d'entraînement et mode séance, suivi du poids et du tour de taille avec graphique sur 6 mois, export JSON.

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
│   ├── sauvegarde.js     Export JSON
│   ├── programme.js      Programme et journal des séances : données et calculs
│   ├── corps.js          Mesures, période de 6 mois, tendance : données et calculs
│   ├── graphique.js      Graphique SVG (sans bibliothèque) et bulle au toucher
│   ├── plateforme.js     Détection iOS / app installée, état technique
│   ├── ui.js             Morceaux d'interface partagés
│   ├── version.js        Numéro de version affiché dans les réglages
│   └── vues/
│       ├── checkin.js    Écran « Aujourd'hui » : check-in quotidien
│       ├── seances.js    Écran « Séances » : programme et éditeur
│       ├── seance-en-cours.js  Mode séance et chronomètre de repos
│       ├── exercice.js   Historique d'un exercice
│       ├── corps.js      Écran « Corps » : mesures, graphiques, période
│       └── reglages.js   Écran « Réglages » : sauvegarde, état de l'app
├── icons/                Icônes 180 (iOS), 192, 512 et 512 « maskable »
├── README.md             Ce fichier
└── NOTES-TECHNIQUES.md   Choix techniques et points à vérifier sur iPhone
```

## Utiliser le check-in

- Tout s'enregistre tout seul à chaque geste : il n'y a pas de bouton « Enregistrer ».
- Rien n'est obligatoire. Une rubrique laissée vide reste « non renseignée » (différent de zéro ou de « non »).
- Un second appui sur un choix le retire.
- Compteurs (repas équilibrés, cigarettes) : depuis l'état vide, **−** note zéro et **+** note 1.
- Sommeil : il s'agit de la nuit qui précède le jour affiché. La durée est calculée automatiquement, y compris quand la nuit passe minuit. Dès qu'une nuit a été saisie, un bouton propose de reprendre les mêmes heures.
- Les flèches **‹ ›** permettent de remplir ou corriger un jour passé.

## Utiliser les séances

**Programme** (onglet Séances)

- Au premier passage : partir d'un programme d'exemple ou de 5 séances vides. L'exemple n'est qu'une base à adapter ; il ne contient aucune charge.
- **Modifier** ouvre l'éditeur : nom de la séance, et pour chaque exercice nom, séries, répétitions, charge (kg) et temps de repos (secondes). Les flèches ↑ ↓ changent l'ordre. Tout s'enregistre automatiquement.
- Laisser « Kg » vide pour un exercice au poids du corps.
- Modifier le programme ne change jamais les séances déjà réalisées.

**Mode séance** (bouton Démarrer)

- La charge et les répétitions sont pré-remplies avec ce qui a été fait la dernière fois, sinon avec le programme. Les boutons − / + ajustent (2,5 kg par appui pour la charge) ; on peut aussi toucher le nombre pour le saisir.
- **Série faite** valide la série et lance le chronomètre de repos (− 15 s, + 15 s, Passer). À la fin du repos, l'écran change de couleur et un signal sonore retentit si le son est disponible.
- Une série validée par erreur : toucher sa pastille pour la corriger.
- On peut passer d'un exercice à l'autre dans la liste, et ajouter une série.
- **Terminer la séance** l'enregistre et coche « Séance : faite » dans le check-in du jour.
- Si l'app est fermée en pleine séance, elle reprend où elle en était (carte « Séance en cours »).

**Historique** : lien « Historique » dans le mode séance ou dans l'éditeur — dernière charge, meilleure charge et détail séance par séance avec l'écart d'une fois sur l'autre.

## Utiliser le suivi corporel

- Onglet **Corps** → **Mesure de la semaine** : poids (kg) et/ou tour de taille (cm), puis **Enregistrer**. Une seule mesure par jour ; ressaisir le même jour la met à jour.
- Conseil : mesurer dans les mêmes conditions chaque semaine (même jour, le matin à jeun). L'accueil affiche un rappel discret quand la dernière mesure date de 7 jours ou plus.
- **Graphiques** : un pour le poids, un pour le tour de taille. Ils couvrent la période de 6 mois, avec la date cible (trait vertical pointillé) et la tendance (droite pointillée, prolongée jusqu'à la date cible). Toucher le graphique affiche la valeur et la date de la mesure la plus proche.
- La tendance apparaît à partir de 3 mesures sur au moins 2 semaines.
- **Période et objectifs** (en bas de l'écran) : la période démarre à la première mesure et dure 6 mois ; les deux dates sont modifiables. Poids et tour de taille visés sont facultatifs et n'ajoutent qu'un repère sur la courbe.
- **Toutes les mesures** : liste complète, pour modifier ou supprimer une mesure.

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
- Le fichier s'appelle `athletics-sauvegarde-AAAA-MM-JJ.json` et contient toutes les données.
- L'app rappelle discrètement de sauvegarder quand le dernier export date de plus de 7 jours.
- L'import (restauration) arrive au jalon J5.
- Rythme conseillé : un export par semaine, enregistré dans Fichiers / iCloud Drive.
- Supprimer l'icône de l'écran d'accueil **supprime les données** de l'app : exporter avant.

## Mettre à jour l'app

Après chaque modification mise en ligne :

1. Incrémenter `VERSION` dans `sw.js` et `VERSION_APP` dans `js/version.js`.
2. Si un fichier a été ajouté, l'inscrire dans la liste `FICHIERS` de `sw.js`.
3. Sur l'iPhone : ouvrir l'app (elle télécharge la mise à jour en arrière-plan), la fermer, la rouvrir.

Les mises à jour ne touchent jamais les données saisies.

## Jalons

- [x] **J1** — structure, manifest, service worker, écran d'accueil vide
- [x] **J2** — check-in quotidien, stockage IndexedDB, export JSON
- [x] **J3** — programme d'entraînement éditable, mode séance avec chronomètre
- [x] **J4** — suivi corporel, graphique sur 6 mois
- [ ] **J5** — bilan hebdomadaire, rappels, import JSON, finitions
