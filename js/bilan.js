/*
 * Bilan hebdomadaire : calculs.
 *
 * Une semaine va du lundi au dimanche ; elle est identifiée par la clé de son lundi.
 * Pour la semaine en cours, seuls les jours écoulés (jusqu'à aujourd'hui) comptent.
 *
 * Règle importante : un jour non renseigné n'est jamais compté comme un zéro.
 * Les moyennes portent uniquement sur les jours où la donnée a été saisie.
 */

import { lireTout, lireReglage } from './db.js';
import { cleJour, decalerJour, depuisCle } from './dates.js';

export const SEANCES_PAR_DEFAUT = 5;
export const REPAS_PAR_DEFAUT = 3;

/** Clé du lundi de la semaine qui contient ce jour. */
export function lundi(cle) {
  const jour = depuisCle(cle).getDay(); // 0 = dimanche
  return decalerJour(cle, jour === 0 ? -6 : 1 - jour);
}

/** Les 7 clés de la semaine (lundi → dimanche). */
export const joursSemaine = (cleLundi) => Array.from({ length: 7 }, (_, i) => decalerJour(cleLundi, i));

const moyenne = (valeurs) => (valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null);

/** Vrai si au moins une rubrique du check-in est renseignée. */
export const checkinRempli = (c) => Boolean(c) && (
  c.seance !== null && c.seance !== undefined
  || Boolean(c.coucher && c.lever)
  || (c.qualite ?? null) !== null
  || (c.repas ?? null) !== null
  || (c.grignotage ?? null) !== null
  || (c.boissons ?? null) !== null
  || (c.cigarettes ?? null) !== null
);

/** Chiffres d'une semaine, à partir des données déjà chargées. */
function calculerSemaine(cleLundi, { checkins, journal, seancesPrevues, repasParJour }) {
  const aujourdhui = cleJour();
  const jours = joursSemaine(cleLundi);
  const ecoules = jours.filter((j) => j <= aujourdhui);
  const parDate = new Map(checkins.map((c) => [c.date, c]));
  const duJour = ecoules.map((j) => parDate.get(j)).filter(Boolean);

  // Séances : un jour compte s'il y a une séance terminée dans le journal
  // ou si le check-in indique « faite » (séance faite hors de l'app).
  const joursSeance = new Set(journal.filter((j) => j.fin && jours.includes(j.date)).map((j) => j.date));
  duJour.forEach((c) => { if (c.seance === 'faite') joursSeance.add(c.date); });

  const sommeils = duJour.map((c) => c.sommeilMin).filter((v) => typeof v === 'number');
  const qualites = duJour.map((c) => c.qualite).filter((v) => typeof v === 'number');
  const cigarettes = duJour.map((c) => c.cigarettes).filter((v) => typeof v === 'number');
  const repas = duJour.map((c) => c.repas).filter((v) => typeof v === 'number');
  const grignotage = duJour.filter((c) => typeof c.grignotage === 'boolean');
  const boissons = duJour.filter((c) => typeof c.boissons === 'boolean');

  return {
    lundi: cleLundi,
    dimanche: jours[6],
    joursEcoules: ecoules.length,
    enCours: aujourdhui >= cleLundi && aujourdhui <= jours[6],
    seancesFaites: joursSeance.size,
    seancesPrevues,
    checkinsRemplis: duJour.filter(checkinRempli).length,
    sommeilMoyen: moyenne(sommeils),          // minutes
    sommeilJours: sommeils.length,
    qualiteMoyenne: moyenne(qualites),
    cigarettesMoyenne: moyenne(cigarettes),   // par jour renseigné
    cigarettesJours: cigarettes.length,
    repasEquilibres: repas.reduce((a, b) => a + b, 0),
    repasPrevus: repas.length * repasParJour, // sur les jours renseignés
    repasJours: repas.length,
    joursSansGrignotage: grignotage.filter((c) => c.grignotage === false).length,
    joursGrignotageRenseignes: grignotage.length,
    joursSansBoissons: boissons.filter((c) => c.boissons === false).length,
    joursBoissonsRenseignes: boissons.length,
  };
}

/** Bilan d'une semaine et de la précédente (pour les comparaisons). */
export async function calculerBilan(cleLundi) {
  const [checkins, journal, seances, repasParJour] = await Promise.all([
    lireTout('checkins'), lireTout('journal'), lireTout('seances'), lireReglage('repasParJour', REPAS_PAR_DEFAUT),
  ]);
  // Séances prévues = nombre de séances du programme (5 par défaut s'il n'y en a pas).
  const contexte = { checkins, journal, seancesPrevues: seances.length || SEANCES_PAR_DEFAUT, repasParJour };
  return {
    semaine: calculerSemaine(cleLundi, contexte),
    precedente: calculerSemaine(decalerJour(cleLundi, -7), contexte),
    premiereDonnee: [...checkins.map((c) => c.date), ...journal.map((j) => j.date)].sort()[0] || null,
  };
}

/**
 * Message de la semaine : uniquement des faits, et seulement ceux qui encouragent.
 * Les écarts défavorables restent visibles dans les chiffres, jamais dans le message.
 */
export function messageSemaine(s, p) {
  const faits = [];
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

  if (s.seancesFaites >= s.seancesPrevues) faits.push(`Toutes les séances prévues sont faites : ${s.seancesFaites} sur ${s.seancesPrevues}.`);
  else if (s.seancesFaites > p.seancesFaites && p.seancesFaites > 0) faits.push(`${pluriel(s.seancesFaites, 'séance')} cette semaine, contre ${p.seancesFaites} la semaine précédente.`);
  else if (s.seancesFaites > 0) faits.push(`${pluriel(s.seancesFaites, 'séance')} ${s.seancesFaites > 1 ? 'réalisées' : 'réalisée'} cette semaine.`);

  if (s.cigarettesMoyenne !== null && p.cigarettesMoyenne !== null && s.cigarettesMoyenne < p.cigarettesMoyenne) {
    faits.push(`Moins de cigarettes par jour que la semaine précédente (${formatNombre(s.cigarettesMoyenne)} contre ${formatNombre(p.cigarettesMoyenne)}).`);
  } else if (s.cigarettesJours > 0 && s.cigarettesMoyenne === 0) {
    faits.push('Aucune cigarette notée sur les jours renseignés.');
  }

  if (s.sommeilMoyen !== null && p.sommeilMoyen !== null && s.sommeilMoyen - p.sommeilMoyen >= 10) {
    faits.push('Plus de sommeil en moyenne que la semaine précédente.');
  }

  if (s.repasJours > 0 && s.repasEquilibres / s.repasPrevus >= 0.66) {
    faits.push('Une large majorité de repas équilibrés.');
  }

  if (s.joursEcoules > 0 && s.checkinsRemplis === s.joursEcoules && s.joursEcoules >= 3) {
    faits.push(`Check-in rempli chaque jour (${s.checkinsRemplis} sur ${s.joursEcoules}).`);
  }

  if (faits.length) return faits.slice(0, 2).join(' ');
  if (s.checkinsRemplis > 0) {
    return `${pluriel(s.checkinsRemplis, 'jour noté')} cette semaine. Chaque check-in rend le bilan plus précis.`;
  }
  return s.enCours
    ? 'Nouvelle semaine. Un check-in ce soir suffit pour lancer le bilan.'
    : 'Pas de données cette semaine-là.';
}

/** « 7,4 » — une décimale au plus. */
export const formatNombre = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
