/*
 * Progression d'un exercice : les mesures à tracer, séance après séance.
 *
 * Selon l'exercice, on peut suivre :
 *  - charge    : la charge la plus lourde de la séance (exercices avec charge, en répétitions)
 *  - max       : le max estimé de la séance (meilleure série, formule d'Epley, ≤ 12 répétitions).
 *                Avec la progression double, la charge reste parfois stable pendant que les
 *                répétitions montent : le max estimé, lui, le montre.
 *  - quantite  : sans charge, la meilleure série (répétitions, secondes ou minutes)
 *
 * Entrée : les passages renvoyés par historiqueExercice() (programme.js), triés par date.
 */

import { maxEstime } from './records.js';
import { formatCharge, UNITES } from './programme.js';

/** « 22,5 kg × 10, 10, 9 » si la charge est la même partout, sinon « 20 kg × 10 · 22,5 kg × 8 ». */
export function resumeSeries(series, unite = 'reps') {
  if (!series.length) return '';
  const court = unite === 'reps' ? '' : ` ${(UNITES[unite] || UNITES.reps).court}`;
  const quantites = (liste) => liste.map((s) => `${s.reps}${court}`).join(', ');
  const charges = new Set(series.map((s) => s.charge ?? null));
  if (charges.size === 1) {
    const c = series[0].charge;
    const q = quantites(series);
    if (c === null || c === undefined) return unite === 'reps' ? `× ${q}` : q;
    return unite === 'reps' ? `${formatCharge(c)} kg × ${q}` : `${formatCharge(c)} kg · ${q}`;
  }
  return series.map((s) => (s.charge === null || s.charge === undefined
    ? `${s.reps}${court}`
    : `${formatCharge(s.charge)} kg ${unite === 'reps' ? '×' : '·'} ${s.reps}${court}`)).join(' · ');
}

/**
 * Mesures disponibles pour un exercice, dans l'ordre d'affichage.
 * Renvoie [{ cle, libelle, unite, points: [{date, valeur, detail}] }] ;
 * une mesure n'est gardée que si elle a au moins 2 points (une courbe).
 */
export function mesuresProgression(passages) {
  const unite = passages[0]?.unite || 'reps';
  const detail = (p) => resumeSeries(p.series, p.unite);
  const mesures = [];

  const charge = passages.filter((p) => p.meilleure !== null)
    .map((p) => ({ date: p.date, valeur: p.meilleure, detail: detail(p) }));

  const max = unite !== 'reps' ? [] : passages.map((p) => {
    const valeurs = p.series.map((s) => maxEstime(s.charge, s.reps)).filter((v) => v !== null);
    return valeurs.length ? { date: p.date, valeur: Math.round(Math.max(...valeurs) * 2) / 2, detail: detail(p) } : null;
  }).filter(Boolean);

  const quantite = passages.filter((p) => p.meilleure === null && p.series.some((s) => s.reps > 0))
    .map((p) => ({ date: p.date, valeur: Math.max(...p.series.map((s) => s.reps || 0)), detail: detail(p) }));

  if (charge.length >= 2) mesures.push({ cle: 'charge', libelle: 'Charge', unite: 'kg', points: charge });
  if (max.length >= 2) mesures.push({ cle: 'max', libelle: 'Max estimé', unite: 'kg', points: max });
  if (quantite.length >= 2) {
    const u = UNITES[unite] || UNITES.reps;
    mesures.push({ cle: 'quantite', libelle: unite === 'reps' ? 'Répétitions' : 'Durée', unite: u.court || 'reps', points: quantite });
  }
  return mesures;
}
