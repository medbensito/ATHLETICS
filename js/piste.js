/*
 * Piste de la transformation : les 26 semaines du programme en un coup d'œil.
 *
 * Une barre par semaine, groupées par phase (Fondations, Construction, Performance).
 * Les semaines allégées sont plus courtes ; les semaines passées sont en menthe,
 * la semaine en cours en braise.
 */

import { PHASES, DUREE_SEMAINES, SEMAINES_ALLEGEES, semaineDuPlan, phasePourSemaine } from './plan.js';
import { cleJour } from './dates.js';
import { echapper } from './ui.js';

/**
 * HTML de la piste, ou '' sans programme démarré.
 * @param {object|null} plan  réglage « plan » (lirePlan())
 * @param {string} aujourdhui clé du jour
 * @param {{entete?: boolean}} options  entete: false pour n'afficher que les barres et les phases
 */
export function pisteTransformation(plan, aujourdhui = cleJour(), { entete = true } = {}) {
  if (!plan || !plan.debut) return '';
  const semaine = semaineDuPlan(plan, aujourdhui);
  if (semaine < 1) return '';
  const termine = semaine > DUREE_SEMAINES;
  const phase = phasePourSemaine(Math.min(semaine, DUREE_SEMAINES));

  const barre = (n) => {
    const classes = ['piste__barre'];
    if (SEMAINES_ALLEGEES.includes(n)) classes.push('piste__barre--allegee');
    if (n < semaine) classes.push('piste__barre--faite');
    else if (n === semaine) classes.push('piste__barre--courante');
    return `<span class="${classes.join(' ')}"></span>`;
  };
  const groupes = PHASES.map((p) => {
    const [debut, fin] = p.semaines;
    const nb = fin - debut + 1;
    const barres = Array.from({ length: nb }, (_, k) => barre(debut + k)).join('');
    return `<div class="piste__groupe" style="flex:${nb}">${barres}</div>`;
  }).join('');
  const libelles = PHASES.map((p) => `<span style="flex:${p.semaines[1] - p.semaines[0] + 1}">${echapper(p.nom)}</span>`).join('');

  return `
    <section class="piste" aria-label="${termine ? `Programme de ${DUREE_SEMAINES} semaines terminé` : `Semaine ${semaine} sur ${DUREE_SEMAINES}, phase ${phase.numero} : ${phase.nom}`}">
      ${entete ? `<div class="piste__entete">
        <p class="piste__semaine">${termine ? 'Programme terminé' : `Semaine ${semaine}<span> / ${DUREE_SEMAINES}</span>`}</p>
        <p class="piste__phase">Phase ${phase.numero} · ${echapper(phase.nom)}</p>
      </div>` : ''}
      <div class="piste__barres" aria-hidden="true">${groupes}</div>
      <div class="piste__phases" aria-hidden="true">${libelles}</div>
    </section>`;
}
