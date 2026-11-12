---
name: Athletics
description: Le tableau blanc de la salle, où la séance du jour s'écrit et se raye à mesure qu'elle se fait.
colors:
  planche: "#ffffff"
  carte: "#ffffff"
  plateau: "#edefea"
  plateau-fort: "#dfe2dc"
  trait: "#d8dbd4"
  cadre: "#16191e"
  encre: "#16191e"
  encre-douce: "#545a64"
  encre-pale: "#5f656f"
  bleu: "#1d4ed8"
  bleu-fonce: "#173fae"
  bleu-pale: "#e6ecfb"
  vert: "#0f7a43"
  vert-pale: "#e2f2e9"
  rouge: "#c81e3a"
  ambre: "#a3530a"
typography:
  titre-ecran:
    fontFamily: "Barlow Condensed, Barlow, -apple-system, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  titre-bloc:
    fontFamily: "Barlow Condensed, Barlow, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.05
  chiffre-geant:
    fontFamily: "Barlow Condensed, Barlow, -apple-system, sans-serif"
    fontSize: "84px"
    fontWeight: 700
    lineHeight: 0.95
  chiffre-saisie:
    fontFamily: "Barlow Condensed, Barlow, -apple-system, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
  titre-carte:
    fontFamily: "Barlow, -apple-system, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
  corps:
    fontFamily: "Barlow, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  libelle:
    fontFamily: "Barlow, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  petit: "8px"
  carte: "10px"
  pilule: "999px"
spacing:
  gouttiere: "18px"
  entre-cartes: "12px"
  dans-carte: "18px"
  tap: "52px"
components:
  bouton-principal:
    backgroundColor: "{colors.bleu}"
    textColor: "{colors.carte}"
    rounded: "{rounded.petit}"
    height: "56px"
    padding: "0 20px"
  bouton-principal-appuye:
    backgroundColor: "{colors.bleu-fonce}"
  bouton-secondaire:
    backgroundColor: "{colors.plateau}"
    textColor: "{colors.encre}"
    rounded: "{rounded.petit}"
    height: "56px"
  option-choix:
    backgroundColor: "{colors.plateau}"
    textColor: "{colors.encre}"
    rounded: "{rounded.petit}"
    height: "52px"
  option-choix-selectionnee:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.carte}"
  carte:
    backgroundColor: "{colors.carte}"
    rounded: "{rounded.carte}"
    padding: "18px"
  carte-action:
    backgroundColor: "{colors.bleu}"
    textColor: "{colors.carte}"
    rounded: "{rounded.carte}"
    padding: "18px"
  champ:
    backgroundColor: "{colors.plateau}"
    textColor: "{colors.encre}"
    rounded: "{rounded.petit}"
    height: "52px"
  barre-onglets:
    backgroundColor: "{colors.cadre}"
    textColor: "#a3a9b2"
    height: "62px"
---

# Design System: Athletics

## Overview

Athletics est le tableau blanc d'une salle de musculation : on y écrit la séance du jour, on raye chaque série faite, on coche les jours de la semaine. L'app est un outil de travail (mode Operate) utilisé entre deux séries, d'une main, sous l'éclairage de la salle : tout doit se lire d'un coup d'œil et se toucher du pouce. Le monde du tableau blanc ne fournit que la typographie, la palette, la densité et un geste signature ; la navigation et les commandes restent celles que tout utilisateur d'iPhone connaît.

Ce que le système refuse : l'écran quasi noir avec un seul accent néon et des anneaux de progression, qui est l'uniforme de la catégorie (et l'ancienne version d'Athletics).

## Colors

Stratégie restreinte, à la manière d'un tableau blanc : une planche claire et quatre encres de feutre, chacune avec un seul rôle.

### Primary
- **Bleu feutre** (`#1d4ed8`) : actions, sélection, l'action du moment. Un aplat bleu signifie « c'est ce qu'il y a à faire maintenant » (séance du jour, message de la semaine).

### Secondary
- **Vert feutre** (`#0f7a43`) : ce qui est fait (séries rayées, rubriques cochées, jours avec séance, barres de régularité). Jamais pour décorer.

### Tertiary
- **Rouge feutre** (`#c81e3a`) : alertes uniquement. **Ambre** (`#a3530a`) : « en cours / en attente » dans les pastilles d'état.

### Neutral
- **Planche** (`#ffffff`) fond de l'app, **carte** (`#ffffff`) le tableau, **plateau** (`#edefea`) champs et boutons secondaires, **trait** (`#d8dbd4`) filets.
- **Encre** (`#16191e`, 17,6:1) texte et structure ; **encre douce** (`#545a64`, 6,9:1) texte secondaire ; **encre pâle** (`#5f656f`, 5,9:1) indications.
- **Cadre** (`#16191e`) : la barre de navigation, comme le cadre noir du tableau.

### Named Rules
- **Une encre, un rôle.** Bleu = agir, vert = fait, rouge = alerte. Une couleur qui ne porte pas de sens n'a pas sa place.
- **Le contraste se calcule.** Tout texte ≥ 4,5:1 sur son fond, vérifié par le calcul et par le détecteur.

## Typography

Une seule famille, Barlow, auto-hébergée (licence SIL OFL, `fonts/`) : l'app reste hors ligne et sans service tiers.

### Hierarchy
- **Titres d'écran et de blocs** : Barlow Condensed 700 (38 px écran, 28–34 px séance, 32 px exercice). Condensée pour tenir les noms longs (« Développé couché haltères ») sur une ligne.
- **Grands chiffres** : Barlow Condensed 700 pour tout ce qui se lit à distance de bras : chronomètre 84 px, charge et répétitions 40 px, compteurs 30–56 px, chiffres du bilan 26–44 px.
- **Interface** : Barlow 400–700, corps 17 px, libellés 15 px 600, notes 15 px.
- Chiffres tabulaires partout.

### Named Rules
- **Jamais de sur-titre.** Le titre porte seul ; l'information secondaire (date, « Exercice 2 sur 7 ») va dessous.
- **Le condensé est pour les chiffres et les titres**, jamais pour un paragraphe ou un bouton.

## Layout

- Une colonne de 524 px de contenu utile (560 px avec les gouttières de 18 px), centrée ; sur iPhone, pleine largeur avec zones sûres.
- En-tête collant : titre puis sous-titre. Barre de navigation fixe en bas, 5 onglets, alignée sur la colonne en grand écran.
- 12 px entre les cartes, 18 px dans une carte ; groupes serrés, séparations nettes.
- Zones tactiles ≥ 52 px pour les commandes principales, ≥ 44 px pour les liens ; ± du mode séance à 66 px.

## Elevation & Depth

Plat, comme un tableau. Les cartes se détachent par un filet de 1 px (`trait`), pas par une ombre. Seule la bulle des graphiques porte une ombre douce (décalée, floutée) car elle flotte au-dessus du tracé.

## Shapes

Coins de 10 px pour les commandes, 14 px pour les cartes, pilules pour les séries et les choix d'alternatives. Pas de verre, pas de halo, pas d'ombre dure.

## Components

### Buttons
- **Principal** : aplat bleu, texte blanc 700, 56 px (66 px pour « Série faite »). Dans une carte bleue, il s'inverse : fond blanc, texte bleu.
- **Secondaire** : plateau gris, texte encre. Les séances qui ne sont pas celles du jour ont un « Démarrer » secondaire.
- États : appuyé (teinte plus foncée, légère réduction), désactivé (50 %), focus clavier (anneau bleu 3 px).

### Chips
- **Options de choix** (Faite / Non faite / Repos, Oui / Non, qualité 1–5, jours) : plateau gris ; sélectionné = bleu plein, texte blanc.
- **Séries validées** : pilule vert pâle avec le trait de feutre (voir signature).

### Cards / Containers
- **Carte** : blanche, filet 1 px, coins 14 px.
- **Carte d'action** (`carte--accent`) : aplat bleu, réservée à l'action du moment.
- **Carte de rappel** : contour bleu 2 px (installation, rappels, séance du jour dans la liste).

### Inputs / Fields
Fond plateau, sans bordure ; au focus, fond blanc et contour bleu 2 px. Saisies numériques en Barlow Condensed. Taille de police ≥ 16 px (pas de zoom iOS).

### Navigation
Barre noire (le cadre du tableau), icônes au trait de 2 px, libellé actif blanc souligné d'un trait de feutre bleu.

### Trait de feutre (composant signature)
Chaque série validée est rayée d'un trait de feutre vert, tracé de gauche à droite en 380 ms (ease-out exponentielle). Le texte reste lisible sous le trait. C'est le seul mouvement « signé » de l'app ; il est supprimé si l'utilisateur demande moins d'animations.

## Do's and Don'ts

### Do:
- Faire ressortir une seule action par écran (l'aplat bleu).
- Écrire les chiffres en grand et en condensé.
- Utiliser les icônes SVG de `js/icones.js`, au même trait.
- Garder les commandes standard de l'iPhone (onglets, champs natifs d'heure et de date, roues de sélection).

### Don't:
- Pas de sur-titre ni d'étiquette en capitales au-dessus d'un titre.
- Pas de caractères (‹ › − + ↑ ↓) ni d'emoji en guise d'icônes.
- Pas de fond sombre avec un accent néon, pas d'anneaux de progression, pas de dégradé de texte.
- Pas de bande colorée épaisse sur un côté d'une carte ou d'une case.
- Pas d'effet « écrit à la main » dans les textes : le tableau blanc prête ses encres et son geste, pas son écriture.
