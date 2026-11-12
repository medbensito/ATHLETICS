/*
 * Bilan d'une phase du programme sur-mesure (Fondations, Construction, Performance).
 *
 * Calculs purs, à partir des données déjà chargées : bornes de la phase, régularité,
 * évolution du corps et progrès en salle. Uniquement des faits, sans jugement.
 * Annonces de l'accueil : phase qui vient de se terminer, semaine allégée qui commence demain.
 */

import { decalerJour, joursEntre } from './dates.js';
import { PHASES, JOURS_PLAN, DUREE_SEMAINES, SEMAINES_ALLEGEES, semaineDuPlan } from './plan.js';
import { checkinRempli } from './bilan.js';
import { maxEstime } from './records.js';

const normaliser = (nom) => String(nom || '').trim().toLowerCase();

/** Dates de début et de fin (incluses) d'une phase, d'après le début du plan. */
export function bornesPhase(plan, numero) {
  const p = PHASES.find((x) => x.numero === numero);
  return {
    debut: decalerJour(plan.debut, (p.semaines[0] - 1) * 7),
    fin: decalerJour(plan.debut, p.semaines[1] * 7 - 1),
  };
}

/** Valeur d'une mesure au début et à la fin d'une période (dernière mesure connue à chaque borne). */
function evolution(mesures, champ, debut, fin) {
  const avec = mesures.filter((m) => typeof m[champ] === 'number').sort((a, b) => (a.date < b.date ? -1 : 1));
  // Départ : dernière mesure au plus tard le premier jour, sinon la première de la phase.
  const depart = [...avec].reverse().find((m) => m.date <= debut) || avec.find((m) => m.date >= debut && m.date <= fin);
  const arrivee = [...avec].reverse().find((m) => m.date <= fin && m.date >= debut);
  if (!depart || !arrivee || depart.date === arrivee.date) {
    return depart ? { debut: depart[champ], fin: null, ecart: null, dateDebut: depart.date, dateFin: null } : null;
  }
  return {
    debut: depart[champ], fin: arrivee[champ],
    ecart: Math.round((arrivee[champ] - depart[champ]) * 10) / 10,
    dateDebut: depart.date, dateFin: arrivee.date,
  };
}

/**
 * Progrès en salle pendant la phase : pour chaque exercice avec charge,
 * max estimé de la première séance de la phase → meilleur max estimé de la phase.
 * Renvoie au plus `limite` exercices, les plus forts progrès d'abord (seulement ceux qui ont progressé).
 */
function progresSalle(journal, debut, fin, limite = 5) {
  const parExo = new Map();
  const seances = journal.filter((j) => j.fin && j.date >= debut && j.date <= fin)
    .sort((a, b) => (a.debut < b.debut ? -1 : 1));
  for (const s of seances) {
    for (const ex of s.exercices) {
      if ((ex.unite || 'reps') !== 'reps') continue;
      const valeurs = ex.series
        .filter((x) => x.fait && typeof x.charge === 'number' && x.charge > 0 && x.reps > 0)
        .map((x) => ({ max: maxEstime(x.charge, x.reps), charge: x.charge, reps: x.reps }))
        .filter((v) => v.max !== null);
      if (!valeurs.length) continue;
      const meilleure = valeurs.reduce((a, b) => (b.max > a.max ? b : a));
      const cle = normaliser(ex.nom);
      const suivi = parExo.get(cle);
      if (!suivi) parExo.set(cle, { nom: ex.nom, premier: meilleure, meilleur: meilleure, seances: 1 });
      else {
        suivi.seances += 1;
        if (meilleure.max > suivi.meilleur.max) suivi.meilleur = meilleure;
      }
    }
  }
  const arrondi = (v) => Math.round(v * 2) / 2;
  return [...parExo.values()]
    .map((e) => ({
      nom: e.nom,
      seances: e.seances,
      de: arrondi(e.premier.max),
      a: arrondi(e.meilleur.max),
      gain: arrondi(e.meilleur.max) - arrondi(e.premier.max),
      meilleure: { charge: e.meilleur.charge, reps: e.meilleur.reps },
    }))
    .filter((e) => e.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, limite);
}

/**
 * Bilan complet d'une phase. Une phase en cours est arrêtée à aujourd'hui.
 * @returns {{ phase, debut, fin, terminee, enCours, aVenir, semainesEcoulees, joursEcoules,
 *   seancesFaites, seancesPrevues, checkinsRemplis, poids, taille, progres, suivante }}
 */
export function bilanPhase({ plan, numero, mesures, journal, checkins, aujourdhui }) {
  const p = PHASES.find((x) => x.numero === numero);
  const { debut, fin } = bornesPhase(plan, numero);
  const aVenir = aujourdhui < debut;
  const terminee = aujourdhui > fin;
  const limite = terminee ? fin : aujourdhui;
  const joursEcoules = aVenir ? 0 : joursEntre(debut, limite) + 1;
  const semainesEcoulees = Math.ceil(joursEcoules / 7);

  // Séances : un jour compte s'il y a une séance terminée ou un check-in « faite ».
  const jours = new Set(journal.filter((j) => j.fin && j.date >= debut && j.date <= limite).map((j) => j.date));
  checkins.forEach((c) => { if (c.seance === 'faite' && c.date >= debut && c.date <= limite) jours.add(c.date); });
  // Séances prévues : jours du programme écoulés dans la phase, semaines allégées comprises.
  let prevues = 0;
  for (let k = 0; k < joursEcoules; k += 1) {
    const jour = new Date(`${decalerJour(debut, k)}T12:00:00`).getDay();
    if (JOURS_PLAN.includes(jour)) prevues += 1;
  }

  return {
    phase: p,
    debut, fin, terminee, aVenir, enCours: !aVenir && !terminee,
    semainesEcoulees, joursEcoules,
    seancesFaites: jours.size,
    seancesPrevues: prevues,
    checkinsRemplis: checkins.filter((c) => c.date >= debut && c.date <= limite && checkinRempli(c)).length,
    poids: evolution(mesures, 'poids', debut, limite),
    taille: evolution(mesures, 'taille', debut, limite),
    progres: progresSalle(journal, debut, limite),
    suivante: PHASES.find((x) => x.numero === numero + 1) || null,
  };
}

/**
 * Annonce de l'accueil liée au calendrier du plan, ou null :
 *  - { type: 'fin-phase', numero } pendant la semaine qui suit la fin d'une phase ;
 *  - { type: 'allegee', semaine } la veille du premier jour d'une semaine allégée.
 */
export function annoncePlan(plan, aujourdhui) {
  if (!plan || !plan.debut || aujourdhui < plan.debut) return null;
  const semaine = semaineDuPlan(plan, aujourdhui);
  const terminee = PHASES.find((p) => p.semaines[1] === semaine - 1);
  if (terminee) return { type: 'fin-phase', numero: terminee.numero };
  if (semaine === DUREE_SEMAINES + 1) return { type: 'fin-phase', numero: PHASES[PHASES.length - 1].numero };
  const demain = semaineDuPlan(plan, decalerJour(aujourdhui, 1));
  if (demain !== semaine && SEMAINES_ALLEGEES.includes(demain)) return { type: 'allegee', semaine: demain };
  return null;
}
