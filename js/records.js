/*
 * Records et force estimée.
 *
 * Force estimée (« max estimé ») : charge maximale théorique sur une répétition,
 * calculée avec la formule d'Epley : charge × (1 + répétitions / 30).
 * C'est une estimation à partir des séries faites, jamais un test à réaliser.
 * Elle n'est calculée que jusqu'à 12 répétitions (au-delà, elle devient peu fiable).
 *
 * Les records sont regroupés par nom d'exercice, sur les séances terminées,
 * pour les exercices comptés en répétitions avec une charge.
 */

export const REPS_MAX_ESTIMATION = 12;

/** Max estimé d'une série (null si non calculable). */
export function maxEstime(charge, reps) {
  if (typeof charge !== 'number' || charge <= 0 || !reps || reps < 1 || reps > REPS_MAX_ESTIMATION) return null;
  return reps === 1 ? charge : charge * (1 + reps / 30);
}

const normaliser = (nom) => String(nom || '').trim().toLowerCase();

/** Séries comptables d'un exercice du journal : faites, en répétitions, avec une charge. */
const seriesComptables = (ex) => ((ex.unite || 'reps') !== 'reps' ? [] : ex.series.filter((s) => s.fait && typeof s.charge === 'number' && s.charge > 0 && s.reps > 0));

/**
 * Records de tous les exercices.
 * Renvoie une Map : nom normalisé → {
 *   nom, seances,
 *   meilleureCharge: { charge, reps, date },
 *   max: { valeur, charge, reps, date } | null
 * }
 * exclure : identifiant d'une séance du journal à ignorer (pour comparer une séance à l'historique).
 */
export function calculerRecords(journal, exclure = null) {
  const records = new Map();
  const terminees = journal.filter((j) => j.fin && j.id !== exclure).sort((a, b) => (a.debut < b.debut ? -1 : 1));
  for (const entree of terminees) {
    for (const ex of entree.exercices) {
      const series = seriesComptables(ex);
      if (!series.length) continue;
      const cle = normaliser(ex.nom);
      const r = records.get(cle) || { nom: ex.nom, seances: 0, meilleureCharge: null, max: null };
      r.nom = ex.nom;
      r.seances += 1;
      for (const s of series) {
        if (!r.meilleureCharge || s.charge > r.meilleureCharge.charge
          || (s.charge === r.meilleureCharge.charge && s.reps > r.meilleureCharge.reps)) {
          r.meilleureCharge = { charge: s.charge, reps: s.reps, date: entree.date };
        }
        const m = maxEstime(s.charge, s.reps);
        if (m !== null && (!r.max || m > r.max.valeur)) r.max = { valeur: m, charge: s.charge, reps: s.reps, date: entree.date };
      }
      records.set(cle, r);
    }
  }
  return records;
}

/** Records d'un exercice (ou null). */
export const recordsExercice = (journal, nom) => calculerRecords(journal).get(normaliser(nom)) || null;

/**
 * Nouveaux records établis pendant une séance, par rapport à l'historique précédent.
 * Un exercice fait pour la première fois ne compte pas comme un record.
 * Renvoie [{ nom, charge, reps, type: 'charge' | 'max' }].
 */
export function nouveauxRecords(seance, journal) {
  const avant = calculerRecords(journal, seance.id);
  const resultat = [];
  for (const ex of seance.exercices) {
    const series = seriesComptables(ex);
    const precedent = avant.get(normaliser(ex.nom));
    if (!series.length || !precedent) continue;
    const plusLourde = series.reduce((a, s) => (s.charge > a.charge || (s.charge === a.charge && s.reps > a.reps) ? s : a));
    if (plusLourde.charge > precedent.meilleureCharge.charge) {
      resultat.push({ nom: ex.nom, charge: plusLourde.charge, reps: plusLourde.reps, type: 'charge' });
      continue;
    }
    let meilleure = null;
    for (const s of series) {
      const m = maxEstime(s.charge, s.reps);
      if (m !== null && (!meilleure || m > meilleure.m)) meilleure = { m, s };
    }
    if (meilleure && precedent.max && meilleure.m > precedent.max.valeur + 0.01) {
      resultat.push({ nom: ex.nom, charge: meilleure.s.charge, reps: meilleure.s.reps, type: 'max' });
    }
  }
  return resultat;
}
