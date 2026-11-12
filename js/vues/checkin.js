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

import { lire, lireTout, ecrire, lireReglage, ecrireReglage } from '../db.js';
import { cleJour, estCleJour, decalerJour, dateLongue, nomJour, dureeSommeil, formatDuree, depuisCle } from '../dates.js';
import { echapper, carteInstallation } from '../ui.js';
import { joursDepuisExport, formatAnciennete, preparerExport, remettreExport } from '../sauvegarde.js';
import { carteRappelMesure } from './corps.js';
import { lireRappels, rappelCheckinActif, rappelSeanceActif } from '../rappels.js';
import { lirePlan, estSemaineAllegee, phase as phaseNumero } from '../plan.js';
import { seanceDuJour, joursConnus, demarrerSeance, NOMS_JOURS_LONGS } from '../seance-du-jour.js';
import { ICONES } from '../icones.js';
import { pisteTransformation } from '../piste.js';
import { annoncePlan } from '../phase.js';

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
      <button type="button" class="compteur__bouton" data-champ="${champ}" data-pas="-1" aria-label="Retirer 1">${ICONES.moins}</button>
      <output class="compteur__valeur" data-affiche="${champ}" aria-live="polite">—</output>
      <button type="button" class="compteur__bouton" data-champ="${champ}" data-pas="1" aria-label="Ajouter 1">${ICONES.plus}</button>
    </div>`;
}

function rubrique(id, titre, contenu, sousTitre = '') {
  return `
    <section class="carte rubrique" data-rubrique="${id}" id="rubrique-${id}" tabindex="-1">
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
      <a class="jours__fleche" href="#/aujourdhui/${decalerJour(date, -1)}" aria-label="Jour précédent">${ICONES.gauche}</a>
      <p class="jours__etat" data-role="progression" aria-live="polite"></p>
      ${estAujourdhui
        ? `<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">${ICONES.droite}</span>`
        : `<a class="jours__fleche" href="#/aujourdhui/${decalerJour(date, 1)}" aria-label="Jour suivant">${ICONES.droite}</a>`}
    </div>

    <div class="tuiles" role="group" aria-label="Rubriques du check-in">
      ${[['seance', 'Séance'], ['sommeil', 'Sommeil'], ['alimentation', 'Alimentation'], ['cigarettes', 'Cigarettes']].map(([id, titre]) => `
        <button type="button" class="tuile" data-aller="${id}">${titre}<span class="tuile__etat" data-etat-tuile="${id}" role="img" aria-label="à noter"></span></button>`).join('')}
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
 * @param {Function}    entete   met à jour le titre et le sous-titre de l'app
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

  // Séance du jour et rappels (check-in du soir), seulement pour aujourd'hui.
  if (estAujourdhui) {
    const [rappels, journal, seances, plan] = await Promise.all([lireRappels(), lireTout('journal'), lireTout('seances'), lirePlan()]);
    const enCours = journal.find((j) => !j.fin);
    const faiteAujourdhui = journal.some((j) => j.fin && j.date === date);
    const prevue = seanceDuJour(seances, plan, date);
    let cartes = '';

    /** Nom court affiché en très grand : « Push » pour « Push · poussée ». */
    const court = (nom) => String(nom).split(' · ')[0];
    const titreGeant = (nom) => {
      const c = court(nom);
      return `<h2 class="seance-jour__titre ${c.length > 9 ? 'seance-jour__titre--long' : ''}" aria-label="${echapper(nom)}">${echapper(c)}</h2>`;
    };

    if (enCours) {
      // Une séance commencée passe avant tout le reste.
      cartes += `
        <section class="carte carte--accent seance-jour">
          <p class="etiquette">Séance en cours</p>
          ${titreGeant(enCours.nomSeance)}
          <p class="meta">${echapper(enCours.nomSeance)}</p>
          <a class="bouton bouton--lancer" href="#/seances/en-cours">Reprendre<span class="bouton__icone" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg></span></a>
        </section>`;
    } else if (prevue && !faiteAujourdhui) {
      // Séance prévue aujourd'hui : un appui pour démarrer. Masquée dès que la rubrique Séance est remplie.
      const nb = prevue.exercices.length;
      const description = prevue.description ? prevue.description.replace(/^[^·]*·\s*/, '').replace(/\.$/, '') : '';
      cartes += `
        <section class="carte carte--accent seance-jour" data-rappel="seance">
          <p class="etiquette">Ce soir${estSemaineAllegee(plan) ? ' · semaine allégée' : ''}</p>
          ${titreGeant(prevue.nom)}
          <p class="meta">${echapper(prevue.nom)} · ${nb} exercice${nb > 1 ? 's' : ''}</p>
          ${description ? `<p class="carte__texte">${echapper(description)}.</p>` : ''}
          ${nb ? `<button type="button" class="bouton bouton--lancer" data-action="demarrer-seance" data-id="${prevue.id}">Démarrer la séance<span class="bouton__icone" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg></span></button>`
            : `<a class="bouton bouton--secondaire" href="#/seances/modifier/${prevue.id}">Ajouter des exercices</a>`}
          <p class="carte__note">Imprévu ou fatigue : coche simplement « Repos » dans le check-in.</p>
        </section>`;
    } else if (!prevue && !faiteAujourdhui && joursConnus(seances, plan)) {
      cartes += `
        <section class="carte seance-jour" data-rappel="seance">
          <p class="etiquette etiquette--douce">${NOMS_JOURS_LONGS[depuisCle(date).getDay()]} · jour de repos</p>
          <h2 class="seance-jour__titre" aria-label="Jour de repos">Repos</h2>
          <p class="carte__texte">Pas de séance prévue. Une marche de 30 à 45 minutes, si tu en as envie : elle aide la perte de graisse sans gêner la récupération.</p>
        </section>`;
    }

    if (!prevue && !joursConnus(seances, plan) && rappelSeanceActif(rappels) && !enCours) {
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
    // La semaine en un coup d'œil : chaque jour fait est coché en menthe.
    if (joursConnus(seances, plan) || journal.some((j) => j.fin)) cartes += semaineEnBref(date, tous, journal, seances, plan);
    // La piste des 26 semaines ouvre l'écran, au-dessus de la séance du soir.
    // Annonces du calendrier du plan : bilan d'une phase terminée, semaine allégée qui commence demain.
    const annonce = annoncePlan(plan, date);
    let carteAnnonce = '';
    if (annonce && annonce.type === 'fin-phase') {
      const p = phaseNumero(annonce.numero);
      carteAnnonce = `
        <a class="carte carte--lien carte--rangee annonce-phase" href="#/bilan/phase/${p.numero}">
          <span><span class="etiquette">Phase ${p.numero} terminée</span><br><span class="carte__titre">${echapper(p.nom)} : le bilan</span><br><span class="carte__note">Régularité, corps et progrès en salle sur ${p.semaines[1] - p.semaines[0] + 1} semaines.</span></span>
          <span class="carte__fleche">${ICONES.droite}</span>
        </a>`;
    } else if (annonce && annonce.type === 'allegee') {
      carteAnnonce = `<p class="annonce annonce--douce" data-role="annonce-allegee">Demain commence la semaine ${annonce.semaine}, une semaine allégée : une série de moins par exercice, même charge. Le corps récupère, puis progresse.</p>`;
    }
    cartes = pisteTransformation(plan, date) + carteAnnonce + cartes;
    if (cartes) $('.jours').insertAdjacentHTML('beforebegin', cartes);
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
      sortie.classList.toggle('compteur__valeur--vide', valeur === null);
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
      const tuile = $(`[data-aller="${id}"]`);
      tuile.classList.toggle('tuile--remplie', ok);
      $(`[data-etat-tuile="${id}"]`).setAttribute('aria-label', ok ? 'rempli' : 'à noter');
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

  // Export préparé au début de l'appui, prêt quand le clic arrive.
  let exportEnPreparation = null;
  racine.addEventListener('pointerdown', (evt) => {
    if (evt.target.closest('[data-action="exporter-accueil"]')) exportEnPreparation = preparerExport();
  });

  racine.addEventListener('click', async (evt) => {
    const cible = evt.target.closest('button');
    if (!cible) return;

    // Tuile du check-in : défile jusqu'à la rubrique.
    if (cible.dataset.aller) {
      const rubrique = $(`#rubrique-${cible.dataset.aller}`);
      rubrique.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      rubrique.focus({ preventScroll: true });
      return;
    }

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

    // Sauvegarde depuis l'accueil. L'export est préparé dès l'appui (pointerdown) :
    // Safari n'ouvre la feuille de partage que juste après le geste.
    if (cible.dataset.action === 'exporter-accueil') {
      const carte = cible.closest('[data-role="sauvegarde"]');
      const pret = await (exportEnPreparation || preparerExport());
      exportEnPreparation = null;
      const resultat = await remettreExport(pret);
      if (resultat === 'annule') return; // feuille refermée : la carte reste
      carte.classList.remove('carte--rappel');
      carte.innerHTML = `<p class="carte__texte" role="status">Sauvegarde faite${resultat === 'telechargement' ? ` : ${echapper(pret.nom)}` : ''}. Prochain rappel dans ${DELAI_SAUVEGARDE} jours.</p>`;
      return;
    }
    if (cible.dataset.action === 'reporter-sauvegarde') {
      await ecrireReglage('sauvegardeReportee', decalerJour(cleJour(), DELAI_REPORT));
      cible.closest('[data-role="sauvegarde"]').remove();
      return;
    }

    // Démarrer la séance du jour.
    if (cible.dataset.action === 'demarrer-seance') {
      cible.disabled = true; // évite un double démarrage
      if (await demarrerSeance(cible.dataset.id)) location.hash = '#/seances/en-cours';
      else cible.disabled = false;
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

/** Bande des 7 jours de la semaine (lundi → dimanche) : séance faite, repos, prévue, aujourd'hui. */
export function semaineEnBref(date, checkins, journal, seances, plan) {
  const lundi = decalerJour(date, -((depuisCle(date).getDay() + 6) % 7));
  const parDate = new Map(checkins.map((c) => [c.date, c]));
  const faits = new Set(journal.filter((j) => j.fin).map((j) => j.date));
  checkins.forEach((c) => { if (c.seance === 'faite') faits.add(c.date); });
  const lettres = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const coche = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const jours = lettres.map((lettre, i) => {
    const cle = decalerJour(lundi, i);
    const prevue = seanceDuJour(seances, plan, cle);
    const nomCourt = prevue ? String(prevue.nom).split(' · ')[0].toLowerCase() : '';
    let etat = 'libre';
    let marque = 'repos';
    let libelle = prevue ? `${prevue.nom} prévue` : 'jour de repos';
    if (faits.has(cle)) { etat = 'fait'; marque = coche; libelle = 'séance faite'; } else if (parDate.get(cle)?.seance === 'repos') { etat = 'repos'; marque = 'repos'; libelle = 'repos'; } else if (prevue) { etat = cle >= date ? 'prevu' : 'manque'; marque = echapper(nomCourt); }
    return `
      <li class="semaine__jour semaine__jour--${etat} ${cle === date ? 'semaine__jour--aujourdhui' : ''}">
        <span class="semaine__lettre" aria-hidden="true">${lettre}</span>
        <span class="semaine__numero" aria-hidden="true">${depuisCle(cle).getDate()}</span>
        <span class="semaine__marque" role="img" aria-label="${NOMS_JOURS_LONGS[depuisCle(cle).getDay()]} : ${echapper(libelle)}">${marque}</span>
      </li>`;
  }).join('');
  return `<ol class="semaine" aria-label="Cette semaine">${jours}</ol>`;
}

// ---------- Rappel de sauvegarde ----------

/** Nombre de jours après lequel l'accueil propose une sauvegarde. */
export const DELAI_SAUVEGARDE = 7;
/** « Plus tard » repousse le rappel de ce nombre de jours. */
const DELAI_REPORT = 3;

/**
 * Rappel de sauvegarde, avec export en un geste depuis l'accueil.
 * Affiché seulement s'il y a de quoi sauvegarder (au moins 3 check-ins ou séances)
 * et si le dernier export date de 7 jours ou plus (ou n'a jamais eu lieu).
 * « Plus tard » le masque 3 jours (réglage « sauvegardeReportee »).
 */
async function carteSauvegarde(nbCheckins) {
  const journal = await lireTout('journal');
  const nbSeances = journal.filter((j) => j.fin).length;
  if (nbCheckins + nbSeances < 3) return '';

  const jours = await joursDepuisExport();
  if (jours !== null && jours < DELAI_SAUVEGARDE) return '';
  const reportee = await lireReglage('sauvegardeReportee');
  if (reportee && reportee > cleJour()) return '';

  const contenu = [
    nbCheckins ? `${nbCheckins} check-in${nbCheckins > 1 ? 's' : ''}` : '',
    nbSeances ? `${nbSeances} séance${nbSeances > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' et ');

  return `
    <section class="carte carte--rappel sauvegarde" data-role="sauvegarde">
      <h2 class="carte__titre">Sauvegarder mes données</h2>
      <p class="carte__texte">Dernier export : ${echapper(formatAnciennete(jours))}. Tes ${contenu} ne sont que sur ce téléphone ; un fichier JSON dans Fichiers ou iCloud les met à l'abri.</p>
      <div class="sauvegarde__actions">
        <button type="button" class="bouton" data-action="exporter-accueil">Exporter maintenant</button>
        <button type="button" class="lien lien--discret" data-action="reporter-sauvegarde">Plus tard</button>
      </div>
    </section>`;
}
