/*
 * Suivi corporel : données et calculs.
 *
 * Magasin « mesures » — une mesure par date :
 *   { date: '2026-11-11', poids: 70.2 | null, taille: 92 | null, majLe }
 *   poids en kg, taille = tour de taille en cm. null = non mesuré ce jour-là.
 *
 * Réglage « periode » — la fenêtre de 6 mois et les objectifs facultatifs :
 *   { debut: '2026-11-11', cible: '2027-05-11', poidsObjectif: null, tailleObjectif: null }
 *   Les objectifs sont uniquement ceux que l'utilisateur renseigne lui-même.
 */

import { lireTout, lireReglage, ecrireReglage } from './db.js';
import { cleJour, depuisCle, joursEntre } from './dates.js';

export const DUREE_MOIS = 6;
export const RAPPEL_JOURS = 7; // une mesure par semaine

export const MESURES = {
  poids: { libelle: 'Poids', unite: 'kg', min: 30, max: 300, objectif: 'poidsObjectif' },
  taille: { libelle: 'Tour de taille', unite: 'cm', min: 40, max: 200, objectif: 'tailleObjectif' },
};

/** Clé décalée de n mois (le 31 janvier + 1 mois donne le dernier jour de février). */
export function ajouterMois(cle, n) {
  const d = depuisCle(cle);
  const jour = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(jour, dernier));
  return cleJour(d);
}

/** Mesures triées par date. */
export async function lireMesures() {
  const mesures = await lireTout('mesures');
  return mesures.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Période enregistrée, sinon une période de 6 mois qui commence à la première mesure (ou aujourd'hui). */
export async function lirePeriode(mesures) {
  const enregistree = await lireReglage('periode');
  if (enregistree) return enregistree;
  const debut = mesures.length ? mesures[0].date : cleJour();
  return { debut, cible: ajouterMois(debut, DUREE_MOIS), poidsObjectif: null, tailleObjectif: null, provisoire: true };
}

export async function ecrirePeriode(periode) {
  const { provisoire, ...aEnregistrer } = periode;
  await ecrireReglage('periode', aEnregistrer);
}

/** Points d'une mesure donnée (poids ou taille), sans les jours où elle manque. */
export const points = (mesures, champ) =>
  mesures.filter((m) => typeof m[champ] === 'number').map((m) => ({ date: m.date, valeur: m[champ] }));

/**
 * Tendance par régression linéaire (moindres carrés) sur les points.
 * Renvoie null s'il n'y a pas assez de recul (3 mesures sur au moins 14 jours).
 * pente : unités par jour ; valeurA(cle) : valeur de la droite à une date.
 */
export function tendance(pts) {
  if (pts.length < 3) return null;
  const origine = pts[0].date;
  if (joursEntre(origine, pts[pts.length - 1].date) < 14) return null;
  const xs = pts.map((p) => joursEntre(origine, p.date));
  const ys = pts.map((p) => p.valeur);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const pente = den === 0 ? 0 : num / den;
  const ordonnee = my - pente * mx;
  return { pente, valeurA: (cle) => ordonnee + pente * joursEntre(origine, cle) };
}

/** « 70,2 » — une décimale au plus, virgule française. */
export const formatValeur = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/** « + 0,4 », « − 1,2 », « 0 » — écart neutre, sans couleur ni jugement. */
export function formatEcart(v) {
  const arrondi = Math.round(v * 10) / 10;
  if (arrondi === 0) return '0';
  return `${arrondi > 0 ? '+' : '−'} ${formatValeur(Math.abs(arrondi))}`;
}

/** Jours depuis la dernière mesure (null si aucune). */
export const joursDepuisMesure = (mesures) =>
  (mesures.length ? joursEntre(mesures[mesures.length - 1].date, cleJour()) : null);
