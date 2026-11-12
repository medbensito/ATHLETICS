/*
 * Fin de séance : le moment qui récompense.
 * Adresse : #/seances/fin/<id de la séance du journal>
 *
 * Contenu, uniquement à partir de ce qui a été fait :
 *  - le récapitulatif (exercices, séries, durée) ;
 *  - les nouveaux records, chacun avec la courbe de son max estimé ;
 *  - le détail des séries de chaque exercice ;
 *  - la semaine mise à jour et la prochaine séance prévue.
 */

import { lire, lireTout } from '../db.js';
import { cleJour, decalerJour, dateLongue, depuisCle, joursEntre } from '../dates.js';
import { echapper } from '../ui.js';
import { compterSeries, dureeMinutes, formatCharge, historiqueExercice } from '../programme.js';
import { nouveauxRecords, maxEstime } from '../records.js';
import { mesuresProgression, resumeSeries } from '../progression.js';
import { lirePlan } from '../plan.js';
import { seanceDuJour, NOMS_JOURS_LONGS } from '../seance-du-jour.js';
import { semaineEnBref } from './checkin.js';
import { ICONES } from '../icones.js';

/** Petite courbe (sans axes) des valeurs d'un exercice : la dernière en braise. */
function miniCourbe(points, libelle) {
  if (points.length < 2) return '';
  const L = 300; const H = 70; const m = 8;
  const valeurs = points.map((p) => p.valeur);
  let bas = Math.min(...valeurs); let haut = Math.max(...valeurs);
  if (haut - bas < 1) { bas -= 1; haut += 1; }
  const x = (i) => m + (i * (L - 2 * m)) / (points.length - 1);
  const y = (v) => H - m - ((v - bas) / (haut - bas)) * (H - 2 * m);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(' ');
  const premier = points[0].valeur; const dernier = points[points.length - 1].valeur;
  return `
    <svg class="fin__courbe" viewBox="0 0 ${L} ${H}" role="img" aria-label="${echapper(`${libelle} sur ${points.length} séances : de ${formatCharge(premier)} à ${formatCharge(dernier)} kg`)}">
      <line class="fin__courbe-base" x1="0" x2="${L}" y1="${H - 2}" y2="${H - 2}"/>
      <path class="fin__courbe-ligne" d="${d}"/>
      ${points.map((p, i) => `<circle class="fin__courbe-point ${i === points.length - 1 ? 'fin__courbe-point--dernier' : ''}" cx="${x(i).toFixed(1)}" cy="${y(p.valeur).toFixed(1)}" r="${i === points.length - 1 ? 5 : 3.5}"/>`).join('')}
    </svg>`;
}

/** Prochaine séance prévue après la date donnée (sur 7 jours), ou null. */
function prochaineSeance(seances, plan, date) {
  for (let k = 1; k <= 7; k += 1) {
    const cle = decalerJour(date, k);
    const s = seanceDuJour(seances, plan, cle);
    if (s) return { cle, seance: s };
  }
  return null;
}

export async function monter(racine, params, entete) {
  const id = params[0];
  const [entree, journal, checkins, seances, plan] = await Promise.all([
    lire('journal', id), lireTout('journal'), lireTout('checkins'), lireTout('seances'), lirePlan(),
  ]);
  if (!entree || !entree.fin) { location.replace('#/seances'); return; }

  const court = String(entree.nomSeance).split(' · ')[0];
  entete({ titre: `${court} terminé`, surTitre: dateLongue(entree.date) });

  const nbSeries = compterSeries(entree);
  const faits = entree.exercices.filter((e) => e.series.some((s) => s.fait));
  const duree = dureeMinutes(entree);
  const records = nouveauxRecords(entree, journal).slice(0, 3);

  // Un record = une carte, avec la courbe du max estimé de l'exercice.
  const cartesRecords = records.map((r) => {
    const ex = entree.exercices.find((e) => e.nom === r.nom);
    const passages = historiqueExercice(journal, ex ? ex.exerciceId : null, r.nom);
    const max = mesuresProgression(passages).find((m) => m.cle === 'max');
    const estime = maxEstime(r.charge, r.reps);
    const gain = max && max.points.length > 1 ? max.points[max.points.length - 1].valeur - max.points[0].valeur : 0;
    return `
      <section class="carte fin__record">
        <p class="etiquette">Nouveau record${r.type === 'max' ? ' · max estimé' : ''}</p>
        <div class="fin__record-ligne">
          <div>
            <p class="carte__titre">${echapper(r.nom)}</p>
            <p class="fin__record-valeur">${formatCharge(r.charge)} kg × ${r.reps}</p>
          </div>
          ${estime ? `<p class="fin__record-max">max estimé<strong>${formatCharge(Math.round(estime * 2) / 2)} kg</strong></p>` : ''}
        </div>
        ${max ? miniCourbe(max.points, 'Max estimé') : ''}
        ${gain > 0 ? `<p class="carte__note">+ ${formatCharge(gain)} kg de max estimé en ${max.points.length} séances.</p>` : ''}
      </section>`;
  }).join('');

  const suivante = prochaineSeance(seances, plan, entree.date);
  const quand = suivante
    ? (joursEntre(entree.date, suivante.cle) === 1 ? 'Demain' : NOMS_JOURS_LONGS[depuisCle(suivante.cle).getDay()])
    : '';
  const sousTitreSuivante = suivante && suivante.seance.description
    ? suivante.seance.description.replace(/^[^·]*·\s*/, '').replace(/\.$/, '')
    : '';

  racine.innerHTML = `
    <div class="fin">
      <header class="fin__tete">
        <span class="fin__coche" aria-hidden="true">${ICONES.coche}</span>
        <h1 class="fin__titre">${echapper(court)}<br>terminé</h1>
        <p class="meta">${echapper(dateLongue(entree.date).replace(/^./, (c) => c.toUpperCase()))} · ${faits.length} exercice${faits.length > 1 ? 's' : ''} · ${nbSeries} série${nbSeries > 1 ? 's' : ''}${duree ? ` · ${duree} min` : ''}</p>
      </header>

      ${cartesRecords}

      <section class="carte">
        <h2 class="carte__titre">Séance par séance</h2>
        <ul class="etat">
          ${faits.map((e) => `
            <li class="etat__ligne etat__ligne--libre">
              <span class="etat__libelle">${echapper(e.nom)}<br><small>${echapper(resumeSeries(e.series.filter((s) => s.fait), e.unite))}</small></span>
              <span class="etat__valeur">${e.series.filter((s) => s.fait).length}/${e.series.length}</span>
            </li>`).join('')}
        </ul>
      </section>

      <section class="vue" aria-label="Cette semaine" style="padding-top:0;gap:10px">
        <h2 class="carte__titre">Cette semaine</h2>
        ${semaineEnBref(entree.date === cleJour() ? cleJour() : entree.date, checkins, journal, seances, plan)}
      </section>

      ${suivante ? `
        <a class="carte carte--lien carte--rangee" href="#/seances">
          <span><span class="etiquette etiquette--douce">${echapper(quand)}</span><br><span class="carte__titre">${echapper(suivante.seance.nom)}</span>${sousTitreSuivante ? `<br><span class="carte__note">${echapper(sousTitreSuivante)}</span>` : ''}</span>
          <span class="carte__fleche">${ICONES.droite}</span>
        </a>` : ''}

      <div class="fin__actions">
        <a class="bouton bouton--clair" href="#/aujourdhui">Retour à l'accueil</a>
      </div>
    </div>`;
}
