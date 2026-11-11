/*
 * Séance du jour : quelle séance est prévue aujourd'hui, et démarrage d'une séance.
 *
 * Chaque séance du programme peut porter un jour (champ « jour » : 0 = dimanche … 6 = samedi,
 * null = libre). Le programme sur-mesure le renseigne ; l'éditeur permet de le changer.
 */

import { lire, lireTout, ecrire } from './db.js';
import { depuisCle } from './dates.js';
import { preparerSeance, trouverEnCours } from './programme.js';
import { lirePlan, estSemaineAllegee, JOURS_PLAN } from './plan.js';

export const NOMS_JOURS_LONGS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/**
 * Séance prévue un jour donné, ou null.
 * Programme adopté avant que les jours soient enregistrés : les jours du plan suivent l'ordre des séances.
 */
export function seanceDuJour(seances, plan, cle) {
  const jour = depuisCle(cle).getDay();
  const triees = [...seances].sort((a, b) => a.ordre - b.ordre);
  const avecJour = triees.filter((s) => s.jour !== undefined && s.jour !== null);
  if (avecJour.length) return avecJour.find((s) => s.jour === jour) || null;
  if (plan && (plan.version || 1) >= 2) {
    const index = JOURS_PLAN.indexOf(jour);
    return index >= 0 ? triees[index] || null : null;
  }
  return null;
}

/** Vrai si des jours d'entraînement sont connus (pour afficher ou non « jour de repos »). */
export const joursConnus = (seances, plan) =>
  seances.some((s) => s.jour !== undefined && s.jour !== null) || Boolean(plan && (plan.version || 1) >= 2);

/**
 * Démarre une séance du programme : prépare le journal (charges pré-remplies,
 * progression, semaine allégée). Ne fait rien si une séance est déjà en cours.
 * Renvoie true si une séance est en cours à la fin de l'appel.
 */
export async function demarrerSeance(id) {
  const journal = await lireTout('journal');
  if (trouverEnCours(journal)) return true;
  const seance = await lire('seances', id);
  if (!seance) return false;
  const plan = await lirePlan();
  await ecrire('journal', preparerSeance(seance, journal, { allegee: estSemaineAllegee(plan) }));
  return true;
}
