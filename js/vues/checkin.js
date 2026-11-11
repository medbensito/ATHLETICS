/*
 * Écran « Aujourd'hui » : le check-in quotidien.
 *
 * Principes :
 *  - Aucune touche « Enregistrer » : chaque geste est sauvegardé immédiatement.
 *  - Rien n'est obligatoire : une rubrique vide reste simplement vide.
 *  - On peut revenir sur un jour passé avec les flèches (jamais sur le futur).
 *
 * Forme d'un check-in dans IndexedDB (magasin « checkins ») :
 * {
 *   date: '2026-11-11',
 *   seance: 'faite' | 'non' | 'repos' | null,
 *   coucher: '23:30' | null, lever: '07:00' | null,   ← nuit qui précède ce jour
 *   sommeilMin: 450 | null,                           ← calculé automatiquement
 *   qualite: 1..5 | null,
 *   repas: 0..10 | null,                              ← nombre de repas équilibrés
 *   grignotage: true | false | null,
 *   boissons: true | false | null,                    ← boissons sucrées
 *   notes: '',
 *   cigarettes: 0..99 | null,
 *   majLe: '2026-11-11T21:04:00.000Z'
 * }
 * « null » signifie « non renseigné », à ne pas confondre avec 0 ou « non ».
 */

import { lire, lireTout, ecrire } from '../db.js';
import { cleJour, estCleJour, decalerJour, dateLongue, nomJour, dureeSommeil, formatDuree } from '../dates.js';
import { echapper, carteInstallation } from '../ui.js';
import { joursDepuisExport, formatAnciennete } from '../sauvegarde.js';
import { carteRappelMesure } from './corps.js';
import { lireRappels, rappelCheckinActif, rappelSeanceActif } from '../rappels.js';

const LIMITES = { repas: 10, cigarettes: 99 };

export const checkinVide = (date) => ({
  date,
  seance: null,
  coucher: null, lever: null, sommeilMin: null, qualite: null,
  repas: null, grignotage: null, boissons: null, notes: '',
  cigarettes: null,
  majLe: null,
});

/** Rubriques et condition pour les considérer comme remplies. */
const RUBRIQUES = {
  seance: (c) => c.seance !== null,
  sommeil: (c) => Boolean(c.coucher && c.lever && c.qualite),
  alimentation: (c) => c.repas !== null && c.grignotage !== null && c.boissons !== null,
  cigarettes: (c) => c.cigarettes !== null,
};

// ---------- Morceaux de HTML ----------

/** Groupe de boutons à choix unique. options : [[valeur, libellé], …] */
function choix(champ, options, libelleGroupe) {
  return `
    <div class="choix" role="group" aria-label="${echapper(libelleGroupe)}" style="--colonnes:${options.length}">
      ${options.map(([valeur, libelle]) => `
        <button type="button" class="choix__option" data-champ="${champ}" data-valeur='${JSON.stringify(valeur)}' aria-pressed="false">${echapper(libelle)}</button>`).join('')}
    </div>`;
}

/** Compteur − valeur + */
function compteur(champ, libelle, grand = false) {
  return `
    <div class="compteur ${grand ? 'compteur--grand' : ''}" role="group" aria-label="${echapper(libelle)}">
      <button type="button" class="compteur__bouton" data-champ="${champ}" data-pas="-1" aria-label="Retirer 1">−</button>
      <output class="compteur__valeur" data-affiche="${champ}" aria-live="polite">—</output>
      <button type="button" class="compteur__bouton" data-champ="${champ}" data-pas="1" aria-label="Ajouter 1">+</button>
    </div>`;
}

function rubrique(id, titre, contenu, sousTitre = '') {
  return `
    <section class="carte rubrique" data-rubrique="${id}">
      <header class="rubrique__entete">
        <h2 class="carte__titre">${echapper(titre)}${sousTitre ? ` <span class="rubrique__sous-titre">${echapper(sousTitre)}</span>` : ''}</h2>
        <span class="rubrique__coche" aria-hidden="true"></span>
      </header>
      ${contenu}
    </section>`;
}

function gabarit(date, estAujourdhui, habitude) {
  return `
    <div class="jours">
      <a class="jours__fleche" href="#/aujourdhui/${decalerJour(date, -1)}" aria-label="Jour précédent">‹</a>
      <p class="jours__etat" data-role="progression" aria-live="polite"></p>
      ${estAujourdhui
        ? '<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">›</span>'
        : `<a class="jours__fleche" href="#/aujourdhui/${decalerJour(date, 1)}" aria-label="Jour suivant">›</a>`}
    </div>

    ${rubrique('seance', 'Séance',
      choix('seance', [['faite', 'Faite'], ['non', 'Non faite'], ['repos', 'Repos']], 'Séance du jour'))}

    ${rubrique('sommeil', 'Sommeil', `
      <div class="heures">
        <label class="heure">
          <span class="heure__libelle">Coucher</span>
          <input class="heure__champ" type="time" data-heure="coucher" aria-label="Heure de coucher">
        </label>
        <label class="heure">
          <span class="heure__libelle">Lever</span>
          <input class="heure__champ" type="time" data-heure="lever" aria-label="Heure de lever">
        </label>
      </div>
      ${habitude ? `<button type="button" class="pilule" data-role="habitude" data-coucher="${habitude.coucher}" data-lever="${habitude.lever}">Comme la dernière fois : ${habitude.coucher} → ${habitude.lever}</button>` : ''}
      <p class="duree" data-role="duree" aria-live="polite"></p>
      <p class="champ__libelle">Qualité</p>
      ${choix('qualite', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 'Qualité du sommeil de 1 à 5')}
      <p class="echelle"><span>Mauvaise</span><span>Excellente</span></p>
    `, 'la nuit dernière')}

    ${rubrique('alimentation', 'Alimentation', `
      <div class="ligne">
        <p class="champ__libelle">Repas équilibrés</p>
        ${compteur('repas', 'Nombre de repas équilibrés')}
      </div>
      <div class="ligne">
        <p class="champ__libelle">Grignotage</p>
        ${choix('grignotage', [[true, 'Oui'], [false, 'Non']], 'Grignotage')}
      </div>
      <div class="ligne">
        <p class="champ__libelle">Boissons sucrées</p>
        ${choix('boissons', [[true, 'Oui'], [false, 'Non']], 'Boissons sucrées')}
      </div>
      <label class="notes">
        <span class="champ__libelle">Notes <span class="facultatif">facultatif</span></span>
        <textarea class="notes__champ" data-role="notes" rows="2" maxlength="1000" placeholder="Un mot sur la journée…"></textarea>
      </label>
    `)}

    ${rubrique('cigarettes', 'Cigarettes', `
      ${compteur('cigarettes', 'Nombre de cigarettes', true)}
      <p class="aide" data-role="aide-cigarettes">Touche − pour noter zéro.</p>
    `)}
  `;
}

// ---------- Montage de l'écran ----------

/**
 * @param {HTMLElement} racine   conteneur de l'écran
 * @param {string[]}    params   suite de l'adresse : #/aujourdhui/2026-11-10 → ['2026-11-10']
 * @param {Function}    entete   met à jour le titre et le sur-titre de l'app
 */
export async function monter(racine, params, entete) {
  const aujourdhui = cleJour();
  // Date demandée, sinon aujourd'hui. Jamais dans le futur.
  const date = estCleJour(params[0]) && params[0] <= aujourdhui ? params[0] : aujourdhui;
  const estAujourdhui = date === aujourdhui;

  entete({ titre: nomJour(date), surTitre: dateLongue(date) });

  const [existant, tous] = await Promise.all([lire('checkins', date), lireTout('checkins')]);
  const checkin = { ...checkinVide(date), ...existant };

  // Dernières heures de sommeil connues avant ce jour : proposées en un geste.
  const precedent = tous.filter((c) => c.date < date && c.coucher && c.lever).pop();
  const habitude = precedent ? { coucher: precedent.coucher, lever: precedent.lever } : null;

  racine.innerHTML = gabarit(date, estAujourdhui, habitude)
    + (estAujourdhui ? await carteRappelMesure() + await carteSauvegarde(tous.length) + carteInstallation() : '');

  const $ = (sel) => racine.querySelector(sel);

  // Rappels du jour (séance, check-in du soir), seulement pour aujourd'hui.
  if (estAujourdhui) {
    const rappels = await lireRappels();
    const enCours = (await lireTout('journal')).some((j) => !j.fin);
    let cartes = '';
    if (rappelSeanceActif(rappels) && !enCours) {
      cartes += `
        <a class="carte carte--lien carte--rappel" href="#/seances" data-rappel="seance">
          <span class="carte__titre">Séance prévue aujourd'hui</span>
          <span class="carte__texte">Ouvre Séances quand tu es prêt. Repos ou imprévu : coche simplement « Repos ».</span>
        </a>`;
    }
    if (rappelCheckinActif(rappels)) {
      cartes += `
        <div class="carte carte--rappel" data-rappel="checkin">
          <span class="carte__titre">C'est l'heure du check-in du soir</span>
          <span class="carte__texte">Quelques touches suffisent, rien n'est obligatoire.</span>
        </div>`;
    }
    if (cartes) $('.jours').insertAdjacentHTML('afterend', cartes);
  }

  const champCoucher = $('[data-heure="coucher"]');
  const champLever = $('[data-heure="lever"]');
  const champNotes = $('[data-role="notes"]');

  // Valeurs initiales des champs de saisie (les boutons sont gérés par peindre()).
  champCoucher.value = checkin.coucher || '';
  champLever.value = checkin.lever || '';
  champNotes.value = checkin.notes || '';

  /** Met l'affichage en accord avec les données, sans recréer les champs. */
  function peindre() {
    racine.querySelectorAll('[data-valeur]').forEach((bouton) => {
      const actif = checkin[bouton.dataset.champ] === JSON.parse(bouton.dataset.valeur);
      bouton.setAttribute('aria-pressed', String(actif));
    });
    racine.querySelectorAll('[data-affiche]').forEach((sortie) => {
      const valeur = checkin[sortie.dataset.affiche];
      sortie.textContent = valeur === null ? '—' : String(valeur);
    });

    $('[data-role="duree"]').textContent =
      checkin.sommeilMin !== null ? `${formatDuree(checkin.sommeilMin)} de sommeil` : '';
    $('[data-role="aide-cigarettes"]').hidden = checkin.cigarettes !== null;
    const pilule = $('[data-role="habitude"]');
    if (pilule) pilule.hidden = Boolean(checkin.coucher || checkin.lever);

    let remplies = 0;
    for (const [id, estRemplie] of Object.entries(RUBRIQUES)) {
      const ok = estRemplie(checkin);
      if (ok) remplies += 1;
      $(`[data-rubrique="${id}"]`).classList.toggle('rubrique--remplie', ok);
    }
    const total = Object.keys(RUBRIQUES).length;
    // Les rappels disparaissent dès que la rubrique concernée est remplie.
    const rappelSeance = $('[data-rappel="seance"]');
    if (rappelSeance) rappelSeance.hidden = checkin.seance !== null;
    const rappelCheckin = $('[data-rappel="checkin"]');
    if (rappelCheckin) rappelCheckin.hidden = remplies === total;
    $('[data-role="progression"]').textContent =
      remplies === total ? 'Check-in complet' : `${remplies} rubrique${remplies > 1 ? 's' : ''} sur ${total}`;
    $('[data-role="progression"]').classList.toggle('jours__etat--complet', remplies === total);
  }

  /** Écrit le check-in dans IndexedDB. */
  async function enregistrer() {
    checkin.majLe = new Date().toISOString();
    try {
      await ecrire('checkins', checkin);
    } catch (err) {
      console.error('Enregistrement impossible :', err);
      $('[data-role="progression"]').textContent = 'Enregistrement impossible';
    }
  }

  function modifier(changements) {
    Object.assign(checkin, changements);
    checkin.sommeilMin = dureeSommeil(checkin.coucher, checkin.lever);
    peindre();
    enregistrer();
  }

  // --- Gestes ---

  racine.addEventListener('click', (evt) => {
    const cible = evt.target.closest('button');
    if (!cible) return;

    // Bouton de choix : un second appui retire la sélection.
    if (cible.dataset.valeur !== undefined) {
      const champ = cible.dataset.champ;
      const valeur = JSON.parse(cible.dataset.valeur);
      modifier({ [champ]: checkin[champ] === valeur ? null : valeur });
      return;
    }

    // Compteur : depuis « non renseigné », − donne 0 et + donne 1.
    if (cible.dataset.pas !== undefined) {
      const champ = cible.dataset.champ;
      const pas = Number(cible.dataset.pas);
      const actuel = checkin[champ];
      const suivant = actuel === null ? (pas > 0 ? 1 : 0) : Math.min(LIMITES[champ], Math.max(0, actuel + pas));
      modifier({ [champ]: suivant });
      return;
    }

    // Reprendre les heures de la dernière nuit saisie.
    if (cible.dataset.role === 'habitude') {
      champCoucher.value = cible.dataset.coucher;
      champLever.value = cible.dataset.lever;
      modifier({ coucher: cible.dataset.coucher, lever: cible.dataset.lever });
    }
  });

  // Heures : sur iOS l'événement arrive pendant que la roulette tourne,
  // d'où une mise à jour sur place (ne jamais recréer le champ ici).
  const surHeure = () => modifier({ coucher: champCoucher.value || null, lever: champLever.value || null });
  champCoucher.addEventListener('input', surHeure);
  champLever.addEventListener('input', surHeure);
  champCoucher.addEventListener('change', surHeure);
  champLever.addEventListener('change', surHeure);

  // Notes : enregistrement après une courte pause de frappe, et en quittant le champ.
  let minuterie = null;
  const surNotes = () => {
    clearTimeout(minuterie);
    checkin.notes = champNotes.value;
    enregistrer();
  };
  champNotes.addEventListener('input', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(surNotes, 500);
  });
  champNotes.addEventListener('blur', surNotes);

  peindre();
}

/** Rappel discret de sauvegarde, seulement quand il y a de quoi sauvegarder. */
async function carteSauvegarde(nbCheckins) {
  if (nbCheckins < 3) return '';
  const jours = await joursDepuisExport();
  if (jours !== null && jours < 7) return '';
  return `
    <a class="carte carte--lien" href="#/reglages">
      <span class="carte__titre">Penser à la sauvegarde</span>
      <span class="carte__texte">Dernier export : ${echapper(formatAnciennete(jours))}. Un fichier JSON met tes ${nbCheckins} check-ins à l'abri.</span>
    </a>`;
}
