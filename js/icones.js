/*
 * Icônes de l'app : SVG dessinés au même trait (2 px, extrémités arrondies),
 * jamais de caractères ou d'emoji à la place d'une icône.
 * Toutes sont décoratives (aria-hidden) : le bouton qui les porte a son propre libellé.
 */

const svg = (chemins) =>
  `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${chemins}</svg>`;

export const ICONES = {
  gauche: svg('<path d="M15 5l-7 7 7 7"/>'),
  droite: svg('<path d="M9 5l7 7-7 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  moins: svg('<path d="M5 12h14"/>'),
  haut: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  bas: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
};
