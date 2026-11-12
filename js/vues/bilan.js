/*
 * Écran « Bilan » : le point de la semaine.
 * Adresses : #/bilan (semaine en cours) et #/bilan/<lundi> (semaine passée).
 */

import { cleJour, estCleJour, decalerJour, dateCourte, formatDuree } from '../dates.js';
import { echapper } from '../ui.js';
import { lundi, calculerBilan, messageSemaine, formatNombre } from '../bilan.js';
import * as calendrier from './calendrier.js';
import { ICONES } from '../icones.js';

/** Écart avec la semaine précédente, en texte neutre (sans couleur ni jugement). */
function ecart(actuel, precedent, format) {
  if (actuel === null || precedent === null) return '';
  return `Semaine précédente : ${format(precedent)}`;
}

/** Une ligne de chiffre : valeur principale, libellé, détail facultatif. */
const ligne = (libelle, valeur, detail = '') => `
  <li class="etat__ligne etat__ligne--libre">
    <span class="etat__libelle">${echapper(libelle)}${detail ? `<br><small>${echapper(detail)}</small>` : ''}</span>
    <span class="bilan__valeur">${echapper(valeur)}</span>
  </li>`;

/** Barre de progression simple (part entre 0 et 1). */
const barre = (part, libelle) => `
  <div class="barre" role="img" aria-label="${echapper(libelle)}">
    <span class="barre__remplie" style="width:${Math.round(Math.min(1, Math.max(0, part)) * 100)}%"></span>
  </div>`;

export async function monter(racine, params, entete) {
  if (params[0] === 'mois') return calendrier.monter(racine, params.slice(1), entete);
  const actuelle = lundi(cleJour());
  const demande = estCleJour(params[0]) ? lundi(params[0]) : actuelle;
  const cle = demande > actuelle ? actuelle : demande;

  const { semaine: s, precedente: p, premiereDonnee } = await calculerBilan(cle);
  const estActuelle = cle === actuelle;
  const premiereSemaine = premiereDonnee ? lundi(premiereDonnee) : actuelle;

  entete({
    titre: estActuelle ? 'Cette semaine' : `Semaine du ${dateCourte(cle).toLowerCase()}`,
    surTitre: `Du ${dateCourte(cle).toLowerCase()} au ${dateCourte(s.dimanche).toLowerCase()}`,
  });

  const minutes = (m) => formatDuree(Math.round(m));
  const aucuneDonnee = s.checkinsRemplis === 0 && s.seancesFaites === 0;

  racine.innerHTML = `
    <div class="jours">
      ${cle > premiereSemaine
        ? `<a class="jours__fleche" href="#/bilan/${decalerJour(cle, -7)}" aria-label="Semaine précédente">${ICONES.gauche}</a>`
        : `<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">${ICONES.gauche}</span>`}
      <p class="jours__etat">${estActuelle ? `Jour ${s.joursEcoules} sur 7` : 'Semaine terminée'}</p>
      ${estActuelle
        ? `<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">${ICONES.droite}</span>`
        : `<a class="jours__fleche" href="#/bilan/${decalerJour(cle, 7)}" aria-label="Semaine suivante">${ICONES.droite}</a>`}
    </div>

    <a class="carte carte--lien carte--rangee" href="#/bilan/mois/${cle.slice(0, 7)}">
      <span class="carte__titre">Calendrier du mois</span>
      <span class="carte__fleche">${ICONES.droite}</span>
    </a>

    <section class="carte message-semaine">
      <p class="message-semaine__texte">${echapper(messageSemaine(s, p))}</p>
    </section>

    <section class="carte">
      <h2 class="carte__titre">Régularité</h2>
      <div class="regularite">
        <div>
          <p class="chiffre__valeur">${s.seancesFaites}<span class="chiffre__sur"> / ${s.seancesPrevues}</span></p>
          <p class="chiffre__libelle">Séances</p>
          ${barre(s.seancesFaites / s.seancesPrevues, `${s.seancesFaites} séances sur ${s.seancesPrevues}`)}
        </div>
        <div>
          <p class="chiffre__valeur">${s.checkinsRemplis}<span class="chiffre__sur"> / ${s.joursEcoules || 7}</span></p>
          <p class="chiffre__libelle">Check-ins remplis</p>
          ${barre(s.joursEcoules ? s.checkinsRemplis / s.joursEcoules : 0, `${s.checkinsRemplis} check-ins sur ${s.joursEcoules} jours`)}
        </div>
      </div>
      <p class="carte__note">Semaine précédente : ${p.seancesFaites} séance${p.seancesFaites > 1 ? 's' : ''}, ${p.checkinsRemplis} check-in${p.checkinsRemplis > 1 ? 's' : ''}.</p>
    </section>

    ${aucuneDonnee ? '' : `
    <section class="carte">
      <h2 class="carte__titre">Sommeil</h2>
      <ul class="etat">
        ${ligne('Durée moyenne', s.sommeilMoyen !== null ? minutes(s.sommeilMoyen) : '—',
          s.sommeilMoyen !== null ? `${s.sommeilJours} nuit${s.sommeilJours > 1 ? 's' : ''} notée${s.sommeilJours > 1 ? 's' : ''}. ${ecart(s.sommeilMoyen, p.sommeilMoyen, minutes)}` : 'Aucune nuit notée.')}
        ${ligne('Qualité moyenne', s.qualiteMoyenne !== null ? `${formatNombre(s.qualiteMoyenne)} / 5` : '—',
          ecart(s.qualiteMoyenne, p.qualiteMoyenne, (v) => `${formatNombre(v)} / 5`))}
      </ul>
    </section>

    <section class="carte">
      <h2 class="carte__titre">Cigarettes</h2>
      <ul class="etat">
        ${ligne('Par jour en moyenne', s.cigarettesMoyenne !== null ? formatNombre(s.cigarettesMoyenne) : '—',
          s.cigarettesMoyenne !== null
            ? `Sur ${s.cigarettesJours} jour${s.cigarettesJours > 1 ? 's' : ''} noté${s.cigarettesJours > 1 ? 's' : ''}. ${p.cigarettesMoyenne !== null ? `Semaine précédente : ${formatNombre(p.cigarettesMoyenne)} par jour.` : ''}`
            : 'Aucun jour noté.')}
      </ul>
    </section>

    <section class="carte">
      <h2 class="carte__titre">Alimentation</h2>
      <ul class="etat">
        ${ligne('Repas équilibrés', s.repasJours ? `${Math.round((s.repasEquilibres / s.repasPrevus) * 100)} %` : '—',
          s.repasJours ? `${s.repasEquilibres} sur ${s.repasPrevus} (${s.repasPrevus / s.repasJours} par jour, ${s.repasJours} jour${s.repasJours > 1 ? 's' : ''} noté${s.repasJours > 1 ? 's' : ''})` : 'Aucun jour noté.')}
        ${ligne('Jours sans grignotage', s.joursGrignotageRenseignes ? `${s.joursSansGrignotage} / ${s.joursGrignotageRenseignes}` : '—')}
        ${ligne('Jours sans boisson sucrée', s.joursBoissonsRenseignes ? `${s.joursSansBoissons} / ${s.joursBoissonsRenseignes}` : '—')}
      </ul>
      <p class="carte__note">Le nombre de repas par jour se règle dans Réglages.</p>
    </section>`}

    <p class="carte__note">Les moyennes ne portent que sur les jours renseignés : un jour vide ne compte jamais comme un zéro.</p>`;
}
