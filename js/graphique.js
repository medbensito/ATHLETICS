/*
 * Graphique d'une mesure sur la période (SVG fait main, aucune bibliothèque).
 *
 * Un graphique = une seule mesure et un seul axe (poids et tour de taille ont
 * chacun le leur). Contenu :
 *  - les mesures (ligne + points) dans la couleur d'accent
 *  - la tendance (droite pointillée, prolongée jusqu'à la date cible)
 *  - la date cible (trait vertical) et aujourd'hui (trait discret)
 *  - l'objectif s'il a été renseigné (trait horizontal)
 * Au toucher : un repère vertical et une bulle avec la date et la valeur.
 */

import { joursEntre, depuisCle, dateCourte } from './dates.js';
import { tendance, formatValeur } from './corps.js';
import { echapper } from './ui.js';

// Dimensions en unités du viewBox (le SVG s'adapte à la largeur de l'écran).
const L = 340;
const H = 210;
const M = { haut: 16, droite: 12, bas: 26, gauche: 34 };
const LP = L - M.gauche - M.droite; // largeur de la zone de tracé
const HP = H - M.haut - M.bas;      // hauteur de la zone de tracé

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Pas « rond » pour environ 4 graduations. */
function pasRond(etendue) {
  const brut = etendue / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const options = [1, 2, 2.5, 5, 10].map((k) => k * puissance);
  return options.find((p) => p >= brut) || options[options.length - 1];
}

/**
 * @param {object} o
 * @param {{date:string, valeur:number}[]} o.points
 * @param {string} o.debut  @param {string} o.cible  @param {string} o.aujourdhui
 * @param {number|null} o.objectif  @param {string} o.unite  @param {string} o.libelle
 */
export function graphique({ points, debut, cible, aujourdhui, objectif, unite, libelle }) {
  // ----- Échelle horizontale : toute la période, élargie si une mesure en sort
  const x0 = [debut, points[0]?.date].filter(Boolean).sort()[0];
  const x1 = [cible, points[points.length - 1]?.date].filter(Boolean).sort().pop();
  const totalJours = Math.max(1, joursEntre(x0, x1));
  const x = (cle) => M.gauche + (joursEntre(x0, cle) / totalJours) * LP;

  // ----- Tendance (prolongée jusqu'à la date cible)
  const t = tendance(points);
  const finTendance = points.length ? [points[points.length - 1].date, cible].sort().pop() : null;
  const tendanceDebut = t ? t.valeurA(points[0].date) : null;
  const tendanceFin = t ? t.valeurA(finTendance) : null;

  // ----- Échelle verticale : mesures + objectif + extrémités de la tendance
  const valeurs = points.map((p) => p.valeur);
  if (typeof objectif === 'number') valeurs.push(objectif);
  if (t) valeurs.push(tendanceDebut, tendanceFin);
  let bas = Math.min(...valeurs);
  let haut = Math.max(...valeurs);
  if (haut - bas < 2) { bas -= 1; haut += 1; }
  const pas = pasRond(haut - bas);
  bas = Math.floor(bas / pas) * pas;
  haut = Math.ceil(haut / pas) * pas;
  const y = (v) => M.haut + (1 - (v - bas) / (haut - bas)) * HP;

  // ----- Graduations
  const gradY = [];
  for (let v = bas; v <= haut + pas / 2; v += pas) gradY.push(Math.round(v * 100) / 100);

  const gradX = [];
  const d = depuisCle(x0);
  d.setDate(1);
  if (joursEntre(x0, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`) < 0) d.setMonth(d.getMonth() + 1);
  while (true) {
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    if (cle > x1) break;
    gradX.push({ cle, texte: MOIS[d.getMonth()] });
    d.setMonth(d.getMonth() + 1);
  }
  const sautX = gradX.length > 8 ? 2 : 1; // au-delà de 8 mois : un mois sur deux

  // ----- Tracé
  const ligne = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(' ');
  const xAuj = aujourdhui >= x0 && aujourdhui <= x1 ? x(aujourdhui) : null;
  const xCible = x(cible);

  const svg = `
    <svg class="graph__svg" viewBox="0 0 ${L} ${H}" role="img" aria-label="${echapper(`${libelle} en ${unite} du ${dateCourte(debut)} au ${dateCourte(cible)}`)}">
      <g class="graph__grille">
        ${gradY.map((v) => `
          <line x1="${M.gauche}" x2="${L - M.droite}" y1="${y(v)}" y2="${y(v)}"/>
          <text class="graph__txt" x="${M.gauche - 6}" y="${y(v) + 4}" text-anchor="end">${formatValeur(v)}</text>`).join('')}
        ${gradX.filter((_, i) => i % sautX === 0).map((g) => `
          <text class="graph__txt" x="${x(g.cle)}" y="${H - 8}" text-anchor="middle">${g.texte}</text>`).join('')}
      </g>

      ${typeof objectif === 'number' ? `
        <line class="graph__repere" x1="${M.gauche}" x2="${L - M.droite}" y1="${y(objectif)}" y2="${y(objectif)}"/>
        <text class="graph__txt graph__txt--fort" x="${M.gauche + 4}" y="${y(objectif) - 5}">Objectif ${formatValeur(objectif)}</text>` : ''}

      ${xAuj !== null ? `<line class="graph__aujourdhui" x1="${xAuj}" x2="${xAuj}" y1="${M.haut}" y2="${H - M.bas}"/>` : ''}
      <line class="graph__repere" x1="${xCible}" x2="${xCible}" y1="${M.haut}" y2="${H - M.bas}"/>
      <text class="graph__txt graph__txt--fort" x="${xCible - 4}" y="${M.haut + 10}" text-anchor="end">${echapper(dateCourte(cible))}</text>

      ${t ? `<line class="graph__tendance" x1="${x(points[0].date)}" x2="${x(finTendance)}" y1="${y(tendanceDebut)}" y2="${y(tendanceFin)}"/>` : ''}

      ${points.length > 1 ? `<path class="graph__ligne" d="${ligne}"/>` : ''}
      ${points.map((p) => `<circle class="graph__point" cx="${x(p.date)}" cy="${y(p.valeur)}" r="4"/>`).join('')}

      <line class="graph__curseur" data-role="curseur" x1="0" x2="0" y1="${M.haut}" y2="${H - M.bas}" hidden/>
      <circle class="graph__point graph__point--actif" data-role="actif" r="6" hidden/>
      <rect class="graph__zone" x="${M.gauche}" y="${M.haut}" width="${LP}" height="${HP}"/>
    </svg>`;

  // Coordonnées des points pour le survol (en unités du viewBox).
  const cibles = points.map((p) => ({ x: x(p.date), y: y(p.valeur), date: p.date, valeur: p.valeur }));
  return { svg, cibles, aTendance: Boolean(t) };
}

/**
 * Active la bulle au toucher / survol dans un conteneur .graph.
 * Le point le plus proche horizontalement est mis en avant.
 * texteBulle (facultatif) : (cible) => HTML de la bulle, à la place de « valeur unité / date ».
 */
export function activerSurvol(conteneur, cibles, unite, texteBulle = null) {
  if (!cibles.length) return;
  const svg = conteneur.querySelector('svg');
  const curseur = svg.querySelector('[data-role="curseur"]');
  const actif = svg.querySelector('[data-role="actif"]');
  const bulle = conteneur.querySelector('[data-role="bulle"]');

  function montrer(evt) {
    const boite = svg.getBoundingClientRect();
    const echelle = boite.width / L;
    const xv = (evt.clientX - boite.left) / echelle;
    let proche = cibles[0];
    for (const c of cibles) if (Math.abs(c.x - xv) < Math.abs(proche.x - xv)) proche = c;

    curseur.setAttribute('x1', proche.x);
    curseur.setAttribute('x2', proche.x);
    actif.setAttribute('cx', proche.x);
    actif.setAttribute('cy', proche.y);
    curseur.hidden = false;
    actif.hidden = false;

    bulle.innerHTML = texteBulle
      ? texteBulle(proche)
      : `<strong>${echapper(formatValeur(proche.valeur))} ${echapper(unite)}</strong><span>${echapper(dateCourte(proche.date))}</span>`;
    bulle.hidden = false;
    // Bulle centrée sur le point, sans sortir du cadre.
    const largeur = bulle.offsetWidth;
    const gauche = Math.min(Math.max(proche.x * echelle - largeur / 2, 0), boite.width - largeur);
    bulle.style.transform = `translate(${gauche}px, 0)`;
  }

  function cacher() {
    curseur.hidden = true;
    actif.hidden = true;
    bulle.hidden = true;
  }

  svg.addEventListener('pointerdown', montrer);
  svg.addEventListener('pointermove', montrer);
  svg.addEventListener('pointerleave', (evt) => { if (evt.pointerType === 'mouse') cacher(); });
  // Sur iPhone, la bulle reste affichée après le toucher ; un toucher ailleurs la referme.
  document.addEventListener('pointerdown', (evt) => { if (!conteneur.contains(evt.target)) cacher(); });
}

// ---------- Progression d'un exercice ----------

/** Graduations de dates : une par semaine sur une courte période, sinon une par mois. */
function graduationsDates(x0, x1) {
  const total = joursEntre(x0, x1);
  const grad = [];
  if (total <= 56) {
    const pasJours = total <= 21 ? 7 : 14;
    for (let j = 0; j <= total; j += pasJours) {
      const d = depuisCle(x0);
      d.setDate(d.getDate() + j);
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      grad.push({ cle, texte: `${d.getDate()} ${MOIS[d.getMonth()]}` });
    }
    return grad;
  }
  const d = depuisCle(x0);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  while (true) {
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    if (cle > x1) break;
    grad.push({ cle, texte: MOIS[d.getMonth()] });
    d.setMonth(d.getMonth() + 1);
  }
  return grad.filter((_, i) => grad.length <= 8 || i % 2 === 0);
}

/**
 * Courbe de progression d'un exercice, séance après séance.
 * Une seule mesure, un seul axe ; la dernière valeur est écrite au bout de la courbe.
 * Pas d'objectif ni de tendance : seulement ce qui a été fait.
 *
 * @param {object} o
 * @param {{date:string, valeur:number, detail?:string}[]} o.points  au moins 2, triés par date
 * @param {string} o.unite    « kg », « reps », « s »…
 * @param {string} o.libelle  pour le lecteur d'écran : « Charge », « Max estimé »…
 */
export function graphiqueProgression({ points, unite, libelle }) {
  const x0 = points[0].date;
  const x1 = points[points.length - 1].date;
  const totalJours = Math.max(1, joursEntre(x0, x1));
  // Marge à droite pour l'étiquette de la dernière valeur.
  const largeurTrace = LP - 16;
  const x = (cle) => M.gauche + (joursEntre(x0, cle) / totalJours) * largeurTrace;

  const valeurs = points.map((p) => p.valeur);
  let bas = Math.min(...valeurs);
  let haut = Math.max(...valeurs);
  if (haut - bas < 2) { bas -= 1; haut += 1; }
  let pas = pasRond(haut - bas);
  if (unite === 'kg' && pas === 2) pas = 2.5; // graduations alignées sur les disques de 1,25 kg
  bas = Math.max(0, Math.floor(bas / pas) * pas);
  haut = Math.ceil(haut / pas) * pas;
  // Un peu d'air au-dessus du maximum, pour l'étiquette de la dernière valeur.
  if (Math.max(...valeurs) > haut - pas * 0.3) haut += pas;
  const y = (v) => M.haut + (1 - (v - bas) / (haut - bas)) * HP;

  const gradY = [];
  for (let v = bas; v <= haut + pas / 2; v += pas) gradY.push(Math.round(v * 100) / 100);
  const gradX = graduationsDates(x0, x1);

  const ligne = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(' ');
  const dernier = points[points.length - 1];
  const xd = x(dernier.date);
  const yd = y(dernier.valeur);
  // Étiquette de la dernière valeur : du côté opposé à l'arrivée de la courbe
  // (au-dessus si elle monte ou reste stable, en dessous si elle descend), dans le cadre.
  const descend = points[points.length - 2].valeur > dernier.valeur;
  let yEtiquette = descend ? yd + 20 : yd - 12;
  if (yEtiquette < M.haut + 4) yEtiquette = yd + 20;
  if (yEtiquette > H - M.bas - 4) yEtiquette = yd - 12;

  const svg = `
    <svg class="graph__svg" viewBox="0 0 ${L} ${H}" role="img" aria-label="${echapper(`${libelle} en ${unite}, ${points.length} séances du ${dateCourte(x0)} au ${dateCourte(x1)} : de ${formatValeur(points[0].valeur)} à ${formatValeur(dernier.valeur)}`)}">
      <g class="graph__grille">
        ${gradY.map((v) => `
          <line x1="${M.gauche}" x2="${L - M.droite}" y1="${y(v)}" y2="${y(v)}"/>
          <text class="graph__txt" x="${M.gauche - 6}" y="${y(v) + 4}" text-anchor="end">${formatValeur(v)}</text>`).join('')}
        ${gradX.map((g) => `
          <text class="graph__txt" x="${x(g.cle)}" y="${H - 8}" text-anchor="middle">${echapper(g.texte)}</text>`).join('')}
      </g>
      <path class="graph__ligne" d="${ligne}"/>
      ${points.map((p) => `<circle class="graph__point" cx="${x(p.date)}" cy="${y(p.valeur)}" r="4"/>`).join('')}
      <text class="graph__txt graph__txt--fort graph__txt--valeur" x="${L - M.droite}" y="${yEtiquette}" text-anchor="end">${formatValeur(dernier.valeur)} ${echapper(unite)}</text>

      <line class="graph__curseur" data-role="curseur" x1="0" x2="0" y1="${M.haut}" y2="${H - M.bas}" hidden/>
      <circle class="graph__point graph__point--actif" data-role="actif" r="6" hidden/>
      <rect class="graph__zone" x="${M.gauche}" y="${M.haut}" width="${LP}" height="${HP}"/>
    </svg>`;

  const cibles = points.map((p) => ({ x: x(p.date), y: y(p.valeur), date: p.date, valeur: p.valeur, detail: p.detail || '' }));
  return { svg, cibles };
}
