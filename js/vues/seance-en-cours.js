/*
 * Mode séance : on déroule les exercices, série après série.
 *
 * Principes :
 *  - Un seul gros bouton, « Série faite », toujours sous le pouce, qui lance le repos (anneau qui se vide).
 *  - Charge et répétitions pré-remplies (dernière fois, sinon programme), ajustables en un appui.
 *  - Tout est enregistré à chaque geste : si l'app est fermée, la séance reprend où elle en était.
 *  - Le chronomètre repose sur l'heure de fin (et non sur un décompte) : il reste juste
 *    même si l'iPhone met l'app en pause quand l'écran s'éteint.
 */

import { lire, lireTout, ecrire, supprimer } from '../db.js';
import { echapper } from '../ui.js';
import {
  trouverEnCours, historiqueExercice, formatCharge, formatSerie, lireNombre,
  compterSeries, PAS_CHARGE, unite, nouvelId,
} from '../programme.js';
import { resumeSeries } from '../progression.js';
import { checkinVide } from './checkin.js';
import { alternatives } from '../alternatives.js';
import { ICONES } from '../icones.js';

// ---------- Signal de fin de repos ----------

let audio = null;

/** À appeler pendant un appui : iOS n'autorise le son qu'à la suite d'un geste. */
function preparerSon() {
  try {
    const Contexte = window.AudioContext || window.webkitAudioContext;
    if (!Contexte) return;
    if (!audio) audio = new Contexte();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* le son est un confort, jamais bloquant */ }
}

function signalFinRepos() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // sans effet sur iPhone
  if (!audio || audio.state !== 'running') return;
  [0, 0.25].forEach((decalage) => {
    const oscillateur = audio.createOscillator();
    const volume = audio.createGain();
    oscillateur.frequency.value = 880;
    volume.gain.setValueAtTime(0.25, audio.currentTime + decalage);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + decalage + 0.18);
    oscillateur.connect(volume).connect(audio.destination);
    oscillateur.start(audio.currentTime + decalage);
    oscillateur.stop(audio.currentTime + decalage + 0.2);
  });
}

/** Circonférence de l'anneau de repos (rayon 100). */
const CIRCONFERENCE = Math.round(2 * Math.PI * 100 * 10) / 10;

const formatChrono = (secondes) => `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;

// ---------- Écran ----------

export async function monter(racine, params, entete) {
  const journal = await lireTout('journal');
  const seance = trouverEnCours(journal);
  if (!seance) { location.replace('#/seances'); return undefined; }

  entete({ titre: seance.nomSeance, surTitre: 'Séance en cours' });

  // Dernier passage de chaque exercice, pour afficher « la dernière fois ».
  const dernierPassage = seance.exercices.map((ex) => historiqueExercice(journal, ex.exerciceId, ex.nom).pop() || null);

  const sauver = () => ecrire('journal', seance).catch((err) => console.error('Enregistrement impossible :', err));

  /** Première série non faite d'un exercice (-1 si toutes sont faites). */
  const serieCourante = (ex) => ex.series.findIndex((s) => !s.fait);
  const estTermine = (ex) => serieCourante(ex) === -1;
  /** Prochain exercice incomplet après l'exercice i (en bouclant), ou -1. */
  function prochainIncomplet(i) {
    const n = seance.exercices.length;
    for (let k = 1; k <= n; k += 1) {
      const j = (i + k) % n;
      if (!estTermine(seance.exercices[j])) return j;
    }
    return -1;
  }

  // Charge affichée au moment du rendu : sert à savoir si l'utilisateur l'a changée.
  let chargeInitiale = null;
  // Panneau « Remplacer » ouvert : { index de l'exercice, choix (rang dans les alternatives ou -1), message }
  let remplacement = null;
  let reposSignale = false;

  function compteurNombre(champ, libelle, valeur, decimal) {
    return `
      <div class="nombre">
        <span class="nombre__libelle">${libelle}</span>
        <div class="nombre__ligne">
          <button type="button" class="compteur__bouton" data-action="pas" data-champ="${champ}" data-pas="-1" aria-label="Diminuer ${libelle.toLowerCase()}">${ICONES.moins}</button>
          <input class="nombre__champ" data-champ="${champ}" inputmode="${decimal ? 'decimal' : 'numeric'}" value="${echapper(decimal ? formatCharge(valeur) : valeur)}"
                 placeholder="—" autocomplete="off" aria-label="${libelle}">
          <button type="button" class="compteur__bouton" data-action="pas" data-champ="${champ}" data-pas="1" aria-label="Augmenter ${libelle.toLowerCase()}">${ICONES.plus}</button>
        </div>
      </div>`;
  }

  /** Panneau de remplacement : alternatives connues, saisie libre, portée du changement. */
  function panneauRemplacement(ex) {
    const alts = alternatives(ex.nom);
    return `
      <div class="remplacer">
        <p class="carte__titre">Remplacer par…</p>
        ${alts.length
          ? `<div class="pilules">${alts.map((a, k) => `
              <button type="button" class="pilule pilule--choix" data-action="remplacer-choisir" data-k="${k}" aria-pressed="${remplacement.choix === k}">${echapper(a.nom)}</button>`).join('')}</div>`
          : '<p class="carte__note">Pas d\'alternative connue pour cet exercice : saisis celui que tu fais.</p>'}
        <input class="saisie" data-role="remplacer-libre" placeholder="Autre exercice" maxlength="60" autocomplete="off" aria-label="Autre exercice">
        ${remplacement.message ? `<p class="carte__note" role="alert">${echapper(remplacement.message)}</p>` : ''}
        <button type="button" class="bouton" data-action="remplacer-valider" data-duree="seance">Pour cette séance</button>
        <button type="button" class="bouton bouton--secondaire" data-action="remplacer-valider" data-duree="toujours">Aussi les prochaines fois</button>
        <p class="carte__note">« Aussi les prochaines fois » modifie le programme. Avec le programme sur-mesure, le changement dure jusqu'au prochain passage de phase.</p>
        <button type="button" class="lien lien--discret lien--centre" data-action="remplacer-annuler">Annuler</button>
      </div>`;
  }

  /**
   * Remplace l'exercice i par « choix » ({ nom, consigne, unite, sansCharge }).
   * L'exercice reçoit un nouvel identifiant : chaque exercice garde son propre historique,
   * et les charges sont reprises de la dernière fois où le remplaçant a été fait.
   */
  async function remplacer(i, choix, toujours) {
    const ex = seance.exercices[i];
    const u = choix.unite || 'reps';
    const memeUnite = u === (ex.unite || 'reps');
    const repsVisees = memeUnite ? (ex.cible.reps || 10) : { reps: 10, s: 30, min: 10 }[u];
    const historique = historiqueExercice(journal, null, choix.nom).pop() || null;
    const id = nouvelId();

    if (toujours) {
      const programme = await lire('seances', seance.seanceId);
      const cibleProgramme = programme && programme.exercices.find((x) => x.id === ex.exerciceId);
      if (cibleProgramme) {
        Object.assign(cibleProgramme, {
          id, nom: choix.nom, consigne: choix.consigne || '', unite: u, sansCharge: Boolean(choix.sansCharge),
          charge: null, reps: memeUnite ? cibleProgramme.reps : repsVisees,
        });
        await ecrire('seances', programme);
      }
    }

    Object.assign(ex, {
      exerciceId: id,
      remplace: ex.remplace || ex.nom,
      nom: choix.nom,
      consigne: choix.consigne || '',
      unite: u,
      sansCharge: Boolean(choix.sansCharge) || u === 'min',
      progression: false,
      cible: { ...ex.cible, reps: repsVisees, charge: null },
      series: ex.series.map((_, n) => {
        const ref = historique ? historique.series[Math.min(n, historique.series.length - 1)] : null;
        return { charge: ref ? ref.charge : null, reps: ref ? ref.reps : repsVisees, fait: false };
      }),
    });
    dernierPassage[i] = historique;
  }

  function rendre() {
    const i = Math.min(seance.courant || 0, seance.exercices.length - 1);
    const ex = seance.exercices[i];
    const n = serieCourante(ex);
    const serie = n === -1 ? null : ex.series[n];
    const dernier = dernierPassage[i];
    const suivant = prochainIncomplet(i);
    const toutFait = seance.exercices.every(estTermine);
    chargeInitiale = serie ? serie.charge : null;

    const faites = ex.series.map((s, k) => (s.fait
      ? `<button type="button" class="pilule pilule--faite" data-action="rouvrir" data-serie="${k}" aria-label="Corriger la série ${k + 1}">${k + 1} · ${echapper(formatSerie(s, ex.unite))}</button>`
      : '')).join('');

    const court = String(seance.nomSeance).split(' · ')[0];
    const nbFaitesEx = ex.series.filter((x) => x.fait).length;
    const prevu = `${ex.cible.series} × ${ex.cible.reps ?? '—'}${ex.unite && ex.unite !== 'reps' ? ` ${unite(ex.unite).court}` : ''}${ex.cible.charge !== null && ex.cible.charge !== undefined ? ` à ${formatCharge(ex.cible.charge)} kg` : ''}`;
    // Barre d'action : « Série faite », sinon l'exercice suivant, sinon terminer.
    const action = serie
      ? `<button type="button" class="bouton bouton--grand" data-action="valider">Série faite</button>
         ${suivant !== -1 && suivant !== i ? `<button type="button" class="bouton bouton--secondaire barre-action__suivant" data-action="aller" data-index="${suivant}" aria-label="Exercice suivant">${ICONES.droite}</button>` : ''}`
      : suivant !== -1
        ? `<button type="button" class="bouton bouton--grand" data-action="aller" data-index="${suivant}">Exercice suivant</button>`
        : '<button type="button" class="bouton bouton--grand" data-action="terminer">Terminer la séance</button>';
    const seule = !serie || suivant === -1 || suivant === i;

    racine.innerHTML = `
      <header class="seance-tete">
        <div class="seance-tete__ligne">
          <a class="retour" href="#/seances">${ICONES.gauche}${echapper(court)}</a>
          <p class="seance-tete__compte">Exercice ${i + 1} sur ${seance.exercices.length}</p>
        </div>
        <div class="segments" aria-hidden="true">
          ${seance.exercices.map((e, k) => `<span class="segments__seg ${estTermine(e) ? 'segments__seg--fait' : k === i ? 'segments__seg--courant' : ''}"></span>`).join('')}
        </div>
      </header>

      ${seance.allegee ? '<p class="annonce annonce--douce">Semaine allégée : une série de moins, même charge. Récupérer fait partie du progrès.</p>' : ''}

      <section class="chrono repos" data-role="repos" aria-label="Repos" hidden>
        <div class="anneau">
          <svg viewBox="0 0 224 224" aria-hidden="true">
            <circle class="anneau__fond" cx="112" cy="112" r="100"/>
            <circle class="anneau__reste" data-role="anneau" cx="112" cy="112" r="100" stroke-dasharray="${CIRCONFERENCE}" stroke-dashoffset="0"/>
          </svg>
          <div class="anneau__centre">
            <p class="chrono__libelle" data-role="repos-libelle">Repos</p>
            <p class="chrono__temps" data-role="repos-temps" aria-live="off">0:00</p>
            <p class="chrono__sur" data-role="repos-sur"></p>
          </div>
        </div>
        <div class="chrono__actions">
          <button type="button" class="choix__option" data-action="repos" data-delta="-15">− 15 s</button>
          <button type="button" class="choix__option" data-action="repos" data-delta="15">+ 15 s</button>
          <button type="button" class="choix__option" data-action="repos-fin">Passer</button>
        </div>
      </section>

      <section class="exo">
        <div class="exo__tete">
          <div>
            <h2 class="exo__nom">${echapper(ex.nom)}</h2>
            ${serie ? `<p class="exo__serie">Série ${n + 1} sur ${ex.series.length} · prévu ${echapper(prevu)}</p>` : ''}
          </div>
          <div class="exo__points" role="img" aria-label="Séries faites : ${nbFaitesEx} sur ${ex.series.length}">
            ${ex.series.map((x, k) => `<span class="exo__point ${x.fait ? 'exo__point--fait' : k === n ? 'exo__point--courant' : ''}"></span>`).join('')}
          </div>
        </div>
        ${ex.remplace ? `<p class="carte__note">Remplace : ${echapper(ex.remplace)}</p>` : ''}
        ${ex.consigne ? `<p class="exo__consigne">${echapper(ex.consigne)}</p>` : ''}
        ${serie ? `
          ${ex.progression && n === 0 && !ex.series.some((x) => x.fait)
            ? `<p class="exo__progression">Objectif atteint la dernière fois : + ${formatCharge(PAS_CHARGE)} kg proposés.</p>` : ''}
          ${faites ? `<div class="pilules">${faites}</div>` : ''}
          <div class="nombres">
            ${ex.sansCharge || ex.unite === 'min' ? '' : compteurNombre('charge', 'Charge · kg', serie.charge, true)}
            ${compteurNombre('reps', unite(ex.unite).saisie, serie.reps, false)}
          </div>
          <p class="exo__prevu">${dernier
            ? `La dernière fois : ${echapper(resumeSeries(dernier.series, dernier.unite))}`
            : 'Première fois : choisis une charge confortable.'}</p>
        ` : `
          <p class="exo__serie exo__serie--fait">Exercice terminé</p>
          <div class="pilules">${faites}</div>
        `}
        ${remplacement && remplacement.index === i ? panneauRemplacement(ex) : `
        <div class="exo__liens">
          <button type="button" class="lien lien--icone" data-action="ajouter-serie">${ICONES.plus}Série</button>
          ${ex.series.some((x) => x.fait) ? '' : '<button type="button" class="lien" data-action="remplacer-ouvrir">Remplacer</button>'}
          <a class="lien" href="#/seances/exercice/${ex.exerciceId}">Historique</a>
        </div>`}
        <div class="barre-action ${seule ? 'barre-action--seule' : ''}">${action}</div>
      </section>

      <section class="carte">
        <h2 class="carte__titre">Exercices</h2>
        <ul class="etat">
          ${seance.exercices.map((e, k) => {
            const nbFaites = e.series.filter((x) => x.fait).length;
            return `
              <li>
                <button type="button" class="etat__ligne etat__ligne--bouton ${k === i ? 'etat__ligne--courant' : ''} ${nbFaites === e.series.length ? 'etat__ligne--fait' : ''}" data-action="aller" data-index="${k}" ${k === i ? 'aria-current="true"' : ''}>
                  <span class="pastille ${nbFaites === e.series.length ? 'pastille--ok' : nbFaites ? 'pastille--encours' : ''}" aria-hidden="true"></span>
                  <span class="etat__libelle">${echapper(e.nom)}</span>
                  <span class="etat__valeur">${nbFaites}/${e.series.length}</span>
                </button>
              </li>`;
          }).join('')}
        </ul>
      </section>

      ${serie || suivant !== -1 ? `<button type="button" class="bouton ${toutFait ? '' : 'bouton--secondaire'}" data-action="terminer">Terminer la séance</button>` : ''}
      <button type="button" class="lien lien--discret lien--centre" data-action="abandonner">Abandonner sans enregistrer</button>`;

    majRepos();
  }

  /** Met à jour le chronomètre de repos (appelé 4 fois par seconde) : temps et anneau. */
  function majRepos() {
    const carte = racine.querySelector('[data-role="repos"]');
    if (!carte) return;
    if (!seance.reposFin) { carte.hidden = true; return; }

    const reste = Math.ceil((seance.reposFin - Date.now()) / 1000);
    // Durée totale du repos en cours (ajustée par − 15 s / + 15 s) ; séance reprise d'une ancienne version : repos de l'exercice.
    const total = Math.max(1, seance.reposDuree || ((seance.exercices[seance.courant] || {}).repos || 90));
    carte.hidden = false;
    carte.classList.toggle('chrono--fini', reste <= 0);
    racine.querySelector('[data-role="repos-libelle"]').textContent = reste > 0 ? 'Repos' : 'Repos terminé';
    racine.querySelector('[data-role="repos-temps"]').textContent = reste > 0 ? formatChrono(reste) : 'C\'est reparti';
    racine.querySelector('[data-role="repos-sur"]').textContent = reste > 0 ? `sur ${formatChrono(total)}` : '';
    const part = reste > 0 ? Math.min(1, reste / total) : 1;
    racine.querySelector('[data-role="anneau"]').setAttribute('stroke-dashoffset', String((CIRCONFERENCE * (1 - part)).toFixed(1)));
    if (reste <= 0 && !reposSignale) {
      reposSignale = true;
      // Pas de signal si le repos était déjà terminé depuis longtemps (retour dans l'app).
      if (reste > -3) signalFinRepos();
    }
  }

  /** Lit les champs Charge et Répétitions dans la série affichée. */
  function lireSaisie(serie) {
    const charge = racine.querySelector('.nombre__champ[data-champ="charge"]');
    const reps = racine.querySelector('.nombre__champ[data-champ="reps"]');
    if (!reps) return;
    if (charge) serie.charge = lireNombre(charge.value, { min: 0, max: 999 });
    serie.reps = lireNombre(reps.value, { entier: true, min: 0, max: 999 }) ?? 0;
  }

  racine.addEventListener('input', (evt) => {
    if (!evt.target.classList.contains('nombre__champ')) return;
    const ex = seance.exercices[seance.courant];
    const n = serieCourante(ex);
    if (n === -1) return;
    lireSaisie(ex.series[n]);
    sauver();
  });

  racine.addEventListener('click', async (evt) => {
    const cible = evt.target.closest('[data-action]');
    if (!cible) return;
    const ex = seance.exercices[seance.courant];
    const n = serieCourante(ex);
    const serie = n === -1 ? null : ex.series[n];

    switch (cible.dataset.action) {
      case 'pas': { // − / + sur la charge ou les répétitions
        if (!serie) return;
        lireSaisie(serie);
        const sens = Number(cible.dataset.pas);
        if (cible.dataset.champ === 'charge') {
          const actuelle = serie.charge ?? 0;
          const nouvelle = Math.max(0, actuelle + sens * PAS_CHARGE);
          serie.charge = nouvelle === 0 && serie.charge === null ? null : nouvelle;
          racine.querySelector('.nombre__champ[data-champ="charge"]').value = formatCharge(serie.charge);
        } else {
          serie.reps = Math.max(0, serie.reps + sens * unite(ex.unite).pas);
          racine.querySelector('.nombre__champ[data-champ="reps"]').value = serie.reps;
        }
        sauver();
        return;
      }

      case 'valider': {
        if (!serie) return;
        preparerSon();
        lireSaisie(serie);
        serie.fait = true;
        // Charge modifiée : on la propose aussi pour les séries restantes de l'exercice.
        if (serie.charge !== chargeInitiale) {
          ex.series.forEach((s) => { if (!s.fait) s.charge = serie.charge; });
        }
        const resteDansExercice = !estTermine(ex);
        const suivant = resteDansExercice ? seance.courant : prochainIncomplet(seance.courant);
        if (suivant !== -1) {
          seance.reposFin = Date.now() + ex.repos * 1000;
          seance.reposDuree = ex.repos;
          reposSignale = false;
          seance.courant = suivant;
        } else {
          seance.reposFin = null; // toute dernière série : pas de repos à attendre
        }
        break;
      }

      case 'repos':
        if (!seance.reposFin) return;
        seance.reposFin = Math.max(Date.now(), seance.reposFin) + Number(cible.dataset.delta) * 1000;
        seance.reposDuree = Math.max(15, (seance.reposDuree || ex.repos) + Number(cible.dataset.delta));
        reposSignale = false;
        sauver();
        majRepos();
        return;

      case 'repos-fin':
        seance.reposFin = null;
        sauver();
        majRepos();
        return;

      case 'aller':
        seance.courant = Number(cible.dataset.index);
        break;

      case 'remplacer-ouvrir':
        remplacement = { index: seance.courant, choix: -1, message: '' };
        break;

      case 'remplacer-choisir':
        remplacement.choix = Number(cible.dataset.k);
        remplacement.message = '';
        rendre();
        return;

      case 'remplacer-annuler':
        remplacement = null;
        rendre();
        return;

      case 'remplacer-valider': {
        const libre = racine.querySelector('[data-role="remplacer-libre"]').value.trim();
        const alts = alternatives(ex.nom);
        // La saisie libre garde l'unité de l'exercice remplacé.
        const choix = libre
          ? { nom: libre, consigne: '', unite: ex.unite || 'reps', sansCharge: ex.sansCharge }
          : alts[remplacement.choix];
        if (!choix) {
          remplacement.message = 'Choisis un exercice ou saisis-en un.';
          rendre();
          return;
        }
        await remplacer(seance.courant, choix, cible.dataset.duree === 'toujours');
        remplacement = null;
        break;
      }

      case 'ajouter-serie': {
        const modele = ex.series[ex.series.length - 1];
        ex.series.push({ charge: modele.charge, reps: modele.reps, fait: false });
        break;
      }

      case 'rouvrir': // corriger une série déjà validée
        ex.series[Number(cible.dataset.serie)].fait = false;
        break;

      case 'terminer': {
        const nbSeries = compterSeries(seance);
        if (nbSeries === 0) {
          alert('Aucune série n\'est encore validée. Pour quitter sans rien enregistrer, utilise « Abandonner sans enregistrer ».');
          return;
        }
        if (!seance.exercices.every(estTermine) && !confirm('Toutes les séries prévues ne sont pas validées. Terminer la séance maintenant ?')) return;
        seance.fin = new Date().toISOString();
        seance.reposFin = null;
        await ecrire('journal', seance);

        // Le check-in du jour est renseigné automatiquement.
        const checkin = { ...checkinVide(seance.date), ...(await lire('checkins', seance.date)) };
        if (checkin.seance !== 'faite') {
          checkin.seance = 'faite';
          checkin.majLe = new Date().toISOString();
          await ecrire('checkins', checkin);
        }
        // Récapitulatif, nouveaux records et séance suivante : écran de fin.
        location.hash = `#/seances/fin/${encodeURIComponent(seance.id)}`;
        return;
      }

      case 'abandonner':
        if (!confirm('Abandonner cette séance ? Les séries saisies ne seront pas enregistrées.')) return;
        await supprimer('journal', seance.id);
        location.hash = '#/seances';
        return;

      default:
        return;
    }

    sauver();
    rendre();
    window.scrollTo(0, 0);
  });

  rendre();

  // Chronomètre : simple rafraîchissement de l'affichage.
  const horloge = setInterval(majRepos, 250);

  // Écran maintenu allumé pendant la séance, quand le navigateur le permet.
  let verrou = null;
  const garderEcranAllume = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') verrou = await navigator.wakeLock.request('screen');
    } catch { /* refusé (batterie faible, etc.) : sans conséquence */ }
  };
  const surRetour = () => { if (document.visibilityState === 'visible') { garderEcranAllume(); majRepos(); } };
  document.addEventListener('visibilitychange', surRetour);
  garderEcranAllume();

  // Nettoyage en quittant l'écran.
  return () => {
    clearInterval(horloge);
    document.removeEventListener('visibilitychange', surRetour);
    if (verrou) verrou.release().catch(() => {});
  };
}
