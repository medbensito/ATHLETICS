---
name: Athletics
description: Une salle le soir, un projecteur sur ce qui compte maintenant.
colors:
  fond: "#0f1115"
  carte: "#181b21"
  plateau: "#20242b"
  plateau-fort: "#2a2f38"
  trait: "#2c313a"
  vide: "#3a404a"
  encre: "#f2f1ee"
  encre-douce: "#a7adb6"
  encre-pale: "#8e959f"
  braise: "#ff6b2c"
  braise-texte: "#ff8a57"
  braise-fond: "#2c1d16"
  menthe: "#3ddc97"
  menthe-fond: "#15291f"
  craie: "#f2f1ee"
  sur-couleur: "#0f1115"
  rouge: "#ff6b7a"
typography:
  titre-ecran:
    fontFamily: "Big Shoulders Display, Inter Tight, -apple-system, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 0.95
    textTransform: uppercase
  titre-geant:
    fontFamily: "Big Shoulders Display, Inter Tight, -apple-system, sans-serif"
    fontSize: "88px"
    fontWeight: 900
    lineHeight: 0.84
    textTransform: uppercase
  chrono:
    fontFamily: "Big Shoulders Display, Inter Tight, -apple-system, sans-serif"
    fontSize: "80px"
    fontWeight: 900
    lineHeight: 0.95
  chiffre-saisie:
    fontFamily: "Big Shoulders Display, Inter Tight, -apple-system, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1
  titre-carte:
    fontFamily: "Inter Tight, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  corps:
    fontFamily: "Inter Tight, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  etiquette:
    fontFamily: "Inter Tight, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.14em"
    textTransform: uppercase
rounded:
  petit: "12px"
  moyen: "16px"
  carte: "20px"
  bouton: "18px"
  pilule: "999px"
spacing:
  gouttiere: "20px"
  entre-cartes: "16px"
  tap: "52px"
components:
  bouton-action:
    backgroundColor: "{colors.braise}"
    textColor: "{colors.sur-couleur}"
    rounded: "{rounded.bouton}"
    height: "56px"
  bouton-secondaire:
    backgroundColor: "{colors.plateau}"
    textColor: "{colors.encre}"
    rounded: "{rounded.bouton}"
  bouton-clair:
    backgroundColor: "{colors.craie}"
    textColor: "{colors.sur-couleur}"
    rounded: "{rounded.bouton}"
  option-choix:
    backgroundColor: "{colors.plateau}"
    textColor: "{colors.encre}"
    rounded: "{rounded.petit}"
  option-choix-selectionnee:
    backgroundColor: "{colors.craie}"
    textColor: "{colors.sur-couleur}"
  carte:
    backgroundColor: "{colors.carte}"
    rounded: "{rounded.carte}"
  onglets:
    backgroundColor: "rgba(24, 27, 33, 0.92)"
    rounded: "{rounded.pilule}"
---

# Athletics — système visuel « Projecteur »

## Intention

Mehdi utilise l'app surtout en salle, entre les séries, et le soir pour le check-in. L'écran doit se lire d'un coup d'œil, à bout de bras, dans une salle plus ou moins éclairée. Le fond est presque noir et éclairé par le haut, comme un projecteur posé sur ce qui compte maintenant : la séance du soir, le repos en cours, la série à faire.

## Couleurs : un rôle chacune

- **Braise** (`#ff6b2c`) : l'action du moment. Démarrer, Série faite, repos en cours, semaine en cours, aujourd'hui. Texte foncé dessus (6,9:1). Utilisée comme texte : `#ff8a57`.
- **Menthe** (`#3ddc97`) : ce qui est fait. Séances, séries, rubriques remplies, semaines passées. Texte foncé dessus.
- **Craie** (`#f2f1ee`) : ce qui est sélectionné. Options choisies, onglet actif, bouton de retour neutre.
- Le reste est en gris froids : fond `#0f1115`, cartes `#181b21`, champs `#20242b`, contours `#2c313a`.
- Aucune couleur décorative. Pas de halo coloré : les ombres sont neutres.

## Typographie

- **Big Shoulders Display** pour les titres d'écran, le nom de la séance du soir (88 px), le chrono (80 px) et tous les chiffres saisis. En capitales pour les titres.
- **Inter Tight** pour le texte, les libellés et les boutons.
- Étiquettes en petites capitales espacées (« Ce soir », « Nouveau record », « Repos »).

## Signatures

1. **La piste des 26 semaines** (accueil et carte du programme) : une barre par semaine, groupées par phase, semaines allégées plus courtes ; passé en menthe, semaine en cours en braise.
2. **L'anneau de repos** : il se vide autour du chrono, puis passe au menthe quand c'est reparti.

## Écrans clés

- **Accueil** : date en petit, piste, carte « Ce soir » (nom en très grand, bouton « Démarrer la séance »), semaine avec le nom des séances, tuiles du check-in qui mènent à chaque rubrique, puis les rubriques.
- **Séance** : sans barre d'onglets. Retour + « Exercice n sur 7 », segments de progression, anneau de repos, nom de l'exercice, points des séries, charge et répétitions côte à côte, « la dernière fois », barre fixe « Série faite » + exercice suivant.
- **Fin de séance** : coche menthe, « Push terminé », nouveaux records avec la courbe du max estimé, détail des séries, semaine, séance suivante, bouton craie « Retour à l'accueil ».

## Règles

- Cibles tactiles ≥ 44 px ; boutons d'action ≥ 56 px.
- Contrastes ≥ 4,5:1 pour le texte (vérifiés), ≥ 3:1 pour les grands chiffres.
- Navigation : barre flottante d'icônes, libellés lus par VoiceOver.
- Petits écrans (hauteur ≤ 740 px) : anneau et actions de repos côte à côte, pour que les champs restent visibles au-dessus de « Série faite ».
- Mouvement réduit respecté (`prefers-reduced-motion`).
