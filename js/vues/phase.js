/*
 * Bilan de phase : le point sur 4, 8 ou 14 semaines du programme sur-mesure.
 * Adresse : #/bilan/phase/<numéro> (1 Fondations, 2 Construction, 3 Performance).
 *
 * Régularité, corps (début → fin), progrès en salle (max estimé), puis ce que change
 * la phase suivante. Uniquement des faits ; une phase en cours s'arrête à aujourd'hui.
 */

import { lireTout } from '../db.js';
import { cleJour, dateCourte } from '../dates.js';
import { echapper } from '../ui.js';
import { lirePlan, PHASES, phase as phaseNumero, semaineDuPlan } from '../plan.js';
import { lireMesures, formatValeur, formatEcart } from '../corps.js';
import { bilanPhase } from '../phase.js';
import { formatCharge } from '../programme.js';
import { ICONES } from '../icones.js';

const court = (cle) => dateCourte(cle).toLowerCase();

/** Ligne « début → fin » d'une mesure du corps, ou une phrase d'attente. */
function ligneCorps(libelle, unite, e) {
  if (!e) return `<li class="etat__ligne etat__ligne--libre"><span class="etat__libelle">${libelle}</span><span class="etat__valeur">—</span></li>`;
  if (e.fin === null) {
    return `
      <li class="etat__ligne etat__ligne--libre">
        <span class="etat__libelle">${libelle}<br><small>Une seule mesure (${formatValeur(e.debut)} ${unite}) : l'évolution apparaîtra à la suivante.</small></span>
        <span class="etat__valeur">—</span>
      </li>`;
  }
  return `
    <li class="etat__ligne etat__ligne--libre">
      <span class="etat__libelle">${libelle}<br><small>${formatValeur(e.debut)} → ${formatValeur(e.fin)} ${unite} · du ${court(e.dateDebut)} au ${court(e.dateFin)}</small></span>
      <span class="bilan__valeur">${formatEcart(e.ecart)} ${unite}</span>
    </li>`;
}

export async function monter(racine, params, entete) {
  const plan = await lirePlan();
  const numero = Number(params[0]);
  const p = phaseNumero(numero);
  if (!plan || !plan.debut || !p) { location.replace('#/bilan'); return; }

  const [mesures, journal, checkins] = await Promise.all([lireMesures(), lireTout('journal'), lireTout('checkins')]);
  const aujourdhui = cleJour();
  const b = bilanPhase({ plan, numero, mesures, journal, checkins, aujourdhui });

  entete({
    titre: `Phase ${p.numero} · ${p.nom}`,
    surTitre: `Semaines ${p.semaines[0]} à ${p.semaines[1]} · du ${court(b.debut)} au ${court(b.fin)}`,
  });

  const navigation = `
    <div class="jours">
      ${numero > 1
        ? `<a class="jours__fleche" href="#/bilan/phase/${numero - 1}" aria-label="Phase précédente">${ICONES.gauche}</a>`
        : `<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">${ICONES.gauche}</span>`}
      <p class="jours__etat">Phase ${numero} sur ${PHASES.length}</p>
      ${numero < PHASES.length
        ? `<a class="jours__fleche" href="#/bilan/phase/${numero + 1}" aria-label="Phase suivante">${ICONES.droite}</a>`
        : `<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">${ICONES.droite}</span>`}
    </div>`;

  if (b.aVenir) {
    racine.innerHTML = `
      <a class="retour" href="#/bilan">${ICONES.gauche}Retour au bilan</a>
      ${navigation}
      <section class="carte">
        <p class="etiquette etiquette--douce">À venir · commence le ${court(b.debut)}</p>
        <h2 class="carte__titre">${echapper(p.nom)}</h2>
        <p class="carte__texte">${echapper(p.objectif)}</p>
      </section>`;
    return;
  }

  const semaineActuelle = Math.min(semaineDuPlan(plan, aujourdhui), p.semaines[1]);
  const duree = p.semaines[1] - p.semaines[0] + 1;
  const partSeances = b.seancesPrevues ? b.seancesFaites / b.seancesPrevues : 0;
  const partCheckins = b.joursEcoules ? b.checkinsRemplis / b.joursEcoules : 0;

  racine.innerHTML = `
    <a class="retour" href="#/bilan">${ICONES.gauche}Retour au bilan</a>
    ${navigation}

    ${b.enCours ? `<p class="annonce annonce--douce">Phase en cours : semaine ${semaineActuelle - p.semaines[0] + 1} sur ${duree}. Le bilan se complète au fil des semaines.</p>` : ''}

    <section class="carte">
      <h2 class="carte__titre">Régularité</h2>
      <div class="regularite">
        <div>
          <p class="chiffre__valeur">${b.seancesFaites}<span class="chiffre__sur"> / ${b.seancesPrevues}</span></p>
          <p class="chiffre__libelle">Séances</p>
          <div class="barre" role="img" aria-label="${b.seancesFaites} séances sur ${b.seancesPrevues} prévues"><span class="barre__remplie" style="width:${Math.round(Math.min(1, partSeances) * 100)}%"></span></div>
        </div>
        <div>
          <p class="chiffre__valeur">${b.checkinsRemplis}<span class="chiffre__sur"> / ${b.joursEcoules}</span></p>
          <p class="chiffre__libelle">Check-ins remplis</p>
          <div class="barre" role="img" aria-label="${b.checkinsRemplis} check-ins sur ${b.joursEcoules} jours"><span class="barre__remplie" style="width:${Math.round(Math.min(1, partCheckins) * 100)}%"></span></div>
        </div>
      </div>
      <p class="carte__note">${b.semainesEcoulees} semaine${b.semainesEcoulees > 1 ? 's' : ''} sur ${duree}${b.enCours ? ' pour l\'instant' : ''}. Chaque séance compte, même courte.</p>
    </section>

    <section class="carte">
      <h2 class="carte__titre">Corps</h2>
      <ul class="etat">
        ${ligneCorps('Poids', 'kg', b.poids)}
        ${ligneCorps('Tour de taille', 'cm', b.taille)}
      </ul>
      ${!b.poids && !b.taille ? '<p class="carte__note">Aucune mesure sur cette phase : l\'écran Corps les enregistre en un geste.</p>' : ''}
    </section>

    <section class="carte">
      <h2 class="carte__titre">Progrès en salle</h2>
      ${b.progres.length ? `
        <ul class="etat">
          ${b.progres.map((e) => `
            <li class="etat__ligne etat__ligne--libre">
              <span class="etat__libelle">${echapper(e.nom)}<br><small>Max estimé ${formatCharge(e.de)} → ${formatCharge(e.a)} kg · meilleure série ${formatCharge(e.meilleure.charge)} kg × ${e.meilleure.reps}</small></span>
              <span class="bilan__valeur">+ ${formatCharge(e.gain)} kg</span>
            </li>`).join('')}
        </ul>
        <p class="carte__note">Max estimé : de la première séance de la phase à la meilleure. Il monte aussi quand les répétitions augmentent à charge égale.</p>`
        : `<p class="carte__texte">${b.seancesFaites ? 'Les progrès apparaîtront dès qu\'un exercice aura été fait au moins deux fois avec une charge.' : 'Aucune séance enregistrée sur cette phase pour l\'instant.'}</p>`}
    </section>

    ${b.suivante ? `
      <section class="carte carte--accent">
        <p class="etiquette">${b.terminee ? 'Maintenant' : 'Ensuite'} · phase ${b.suivante.numero}</p>
        <h2 class="carte__titre">${echapper(b.suivante.nom)}</h2>
        <p class="carte__texte">${echapper(b.suivante.objectif)}</p>
        ${b.terminee && plan.phase < b.suivante.numero
          ? '<a class="bouton" href="#/seances">Passer à la phase suivante</a>'
          : ''}
      </section>` : b.terminee ? `
      <section class="carte carte--accent">
        <p class="etiquette">Programme terminé</p>
        <h2 class="carte__titre">26 semaines</h2>
        <p class="carte__texte">Le programme de 6 mois est bouclé. Tu peux continuer la phase Performance en augmentant les charges, ou faire le point sur tes objectifs avant un nouveau cycle.</p>
      </section>` : ''}`;
}
