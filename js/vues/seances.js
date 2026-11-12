/*
 * Écran « Séances » : le programme et son éditeur.
 *
 * Adresses :
 *   #/seances                    liste des séances du programme
 *   #/seances/modifier/<id>      éditeur d'une séance
 *   #/seances/en-cours           mode séance            (js/vues/seance-en-cours.js)
 *   #/seances/fin/<id>           fin de séance          (js/vues/fin-seance.js)
 *   #/seances/exercice/<id>      historique d'un exercice (js/vues/exercice.js)
 */

import { lire, lireTout, ecrire, supprimer } from '../db.js';
import { nomJour, cleJour } from '../dates.js';
import { echapper } from '../ui.js';
import {
  lireProgramme, creerSeancesVides, chargerExemple, nouvelleSeance, nouvelExercice,
  formatCharge, lireNombre, trouverEnCours, compterSeries, dureeMinutes, prendreMessage,
} from '../programme.js';
import {
  lirePlan, demarrerPlan, appliquerPhase, semaineDuPlan, phasePourSemaine, phase as phaseNumero,
  estSemaineAllegee, DUREE_SEMAINES, PHASES, planAncien,
} from '../plan.js';
import { demarrerSeance, seanceDuJour, NOMS_JOURS_LONGS } from '../seance-du-jour.js';
import * as enCours from './seance-en-cours.js';
import * as fin from './fin-seance.js';
import { pisteTransformation } from '../piste.js';
import * as exercice from './exercice.js';
import * as records from './records.js';
import { ICONES } from '../icones.js';

export function monter(racine, params, entete) {
  if (params[0] === 'en-cours') return enCours.monter(racine, params, entete);
  if (params[0] === 'fin') return fin.monter(racine, params.slice(1), entete);
  if (params[0] === 'exercice') return exercice.monter(racine, params.slice(1), entete);
  if (params[0] === 'modifier') return editeur(racine, params[1], entete);
  if (params[0] === 'records') return records.monter(racine, params.slice(1), entete);
  return liste(racine, entete);
}

// =====================================================================
// Liste des séances
// =====================================================================

async function liste(racine, entete) {
  entete({ titre: 'Séances', surTitre: 'Programme et séances réalisées' });

  // État de l'écran, rechargé à chaque rendu ; les gestionnaires (posés une seule fois) le lisent.
  let programme = [];
  let journal = [];
  let plan = null;
  let occupe = false; // évite qu'un double appui lance deux fois la même action

  async function rendre(message = '') {
    [programme, journal, plan] = await Promise.all([lireProgramme(), lireTout('journal'), lirePlan()]);
    const seanceEnCours = trouverEnCours(journal);
    const terminees = journal.filter((j) => j.fin).sort((a, b) => (a.debut < b.debut ? 1 : -1));

    // Aucun programme : trois façons de démarrer.
    if (programme.length === 0) {
      racine.innerHTML = `
        <section class="carte">
          <h2 class="carte__titre">Créer ton programme</h2>
          <p class="carte__texte">Trois façons de commencer. Dans tous les cas, tout reste modifiable : noms, exercices, séries, répétitions, charges.</p>
          <button type="button" class="bouton" data-action="plan-demarrer">Programme sur-mesure 6 mois</button>
          <p class="carte__note">Recommandé : Push, Pull, Legs, Upper, Lower (mardi, mercredi, jeudi, samedi, dimanche), en 3 phases progressives pensées pour un départ très sédentaire.</p>
          <button type="button" class="bouton bouton--secondaire" data-action="exemple">Partir d'un exemple simple</button>
          <button type="button" class="bouton bouton--secondaire" data-action="vides">Créer 5 séances vides</button>
          <p class="carte__note">Aucune charge n'est imposée : tu les choisis à la première séance.</p>
        </section>`;
      return;
    }

    const duJour = seanceDuJour(programme, plan, cleJour());
    const carteSeance = (s) => {
      const derniere = terminees.find((j) => j.seanceId === s.id);
      const estDuJour = duJour && duJour.id === s.id;
      // Les exercices de musculation d'abord ; échauffement et cardio résumés en une mention.
      const muscu = s.exercices.filter((e) => e.nom && !e.sansCharge && e.unite !== 'min');
      const annexes = s.exercices.length - muscu.length;
      const noms = muscu.map((e) => e.nom);
      return `
        <section class="carte ${estDuJour ? 'carte--du-jour' : ''}">
          <header class="seance__entete">
            <h2 class="seance__nom">${echapper(s.nom || 'Séance sans nom')}</h2>
            <a class="lien" href="#/seances/modifier/${s.id}">Modifier</a>
          </header>
          ${s.description ? `<p class="seance__description">${echapper(s.description)}</p>` : ''}
          ${noms.length ? `<ul class="liste-exos">${noms.map((n) => `<li>${echapper(n)}</li>`).join('')}</ul>` : (s.exercices.length ? '' : '<p class="carte__texte">Aucun exercice pour l\'instant.</p>')}
          <p class="carte__note">${estDuJour ? '<strong class="du-jour">Aujourd\'hui</strong> · ' : ''}${s.exercices.length} exercice${s.exercices.length > 1 ? 's' : ''}${annexes ? ' dont échauffement et cardio' : ''}${derniere ? ` · dernière fois : ${echapper(nomJour(derniere.date).toLowerCase())}` : ''}</p>
          ${seanceEnCours ? '' : s.exercices.length
            ? `<button type="button" class="bouton ${estDuJour ? '' : 'bouton--secondaire'}" data-action="demarrer" data-id="${s.id}">Démarrer</button>`
            : `<a class="bouton bouton--secondaire" href="#/seances/modifier/${s.id}">Ajouter des exercices</a>`}
        </section>`;
    };

    racine.innerHTML = `
      ${message ? `<p class="annonce" role="status">${echapper(message)}</p>` : ''}
      ${seanceEnCours ? '' : cartePlan(plan)}
      ${seanceEnCours ? `
        <section class="carte carte--accent">
          <h2 class="carte__titre">Séance en cours : ${echapper(seanceEnCours.nomSeance)}</h2>
          <p class="carte__texte">${compterSeries(seanceEnCours)} série${compterSeries(seanceEnCours) > 1 ? 's' : ''} validée${compterSeries(seanceEnCours) > 1 ? 's' : ''} pour l'instant.</p>
          <a class="bouton" href="#/seances/en-cours">Reprendre</a>
        </section>` : ''}
      ${programme.map(carteSeance).join('')}
      <button type="button" class="bouton bouton--secondaire" data-action="ajouter">${ICONES.plus}Ajouter une séance</button>
      <a class="carte carte--lien carte--rangee" href="#/seances/records">
        <span class="carte__titre">Records et force estimée</span>
        <span class="carte__fleche">${ICONES.droite}</span>
      </a>
      ${terminees.length ? `
        <section class="carte">
          <h2 class="carte__titre">Dernières séances</h2>
          <ul class="etat">
            ${terminees.slice(0, 10).map((j) => `
              <li class="etat__ligne etat__ligne--libre etat__ligne--3">
                <span class="etat__libelle">${echapper(j.nomSeance)}<br><small>${echapper(nomJour(j.date))} · ${compterSeries(j)} séries · ${dureeMinutes(j)} min</small></span>
                <span></span>
                <button type="button" class="lien lien--discret" data-action="supprimer-faite" data-id="${j.id}" aria-label="Supprimer la séance ${echapper(j.nomSeance)} du ${echapper(nomJour(j.date).toLowerCase())}">Supprimer</button>
              </li>`).join('')}
          </ul>
        </section>` : ''}`;
  }

  async function agir(cible) {
    switch (cible.dataset.action) {
      case 'plan-demarrer':
        await demarrerPlan();
        await rendre();
        return;
      case 'exemple':
        await chargerExemple();
        await rendre();
        return;
      case 'vides':
        await creerSeancesVides();
        await rendre();
        return;
      case 'demarrer':
        if (await demarrerSeance(cible.dataset.id)) location.hash = '#/seances/en-cours';
        return;
      case 'plan-adopter':
        if (!confirm('Remplacer les séances actuelles par le programme sur-mesure (phase 1) ? Les séances déjà réalisées et leur historique sont conservés.')) return;
        await demarrerPlan();
        await rendre('Programme sur-mesure en place : phase 1, Fondations.');
        return;
      case 'plan-mettre-a-jour':
        if (!confirm('Remplacer les séances actuelles par la nouvelle répartition (Push, Pull, Legs, Upper, Lower) ? Ta phase, ta semaine et ton historique sont conservés.')) return;
        await appliquerPhase(plan.phase);
        await rendre('Séances mises à jour : Push, Pull, Legs, Upper, Lower.');
        return;
      case 'phase-suivante': {
        const numero = Number(cible.dataset.phase);
        if (!confirm(`Passer à la phase ${numero} ? Les séances du programme seront remplacées par celles de la phase ${numero} (tes modifications éventuelles de la phase actuelle seront perdues). L'historique est conservé.`)) return;
        await appliquerPhase(numero);
        await rendre(`Phase ${numero} en place.`);
        return;
      }
      case 'supprimer-faite': {
        // Séance enregistrée par erreur : suppression définitive après confirmation.
        const entree = journal.find((j) => j.id === cible.dataset.id);
        if (!entree) return;
        if (!confirm(`Supprimer définitivement la séance « ${entree.nomSeance} » du ${nomJour(entree.date).toLowerCase()} ? Ses séries disparaîtront de l'historique, des records et du bilan. Cette action ne peut pas être annulée.`)) return;
        await supprimer('journal', entree.id);
        // Le check-in « Séance : faite » avait été coché automatiquement : on le retire
        // s'il ne reste aucune autre séance terminée ce jour-là.
        const autre = journal.some((j) => j.id !== entree.id && j.fin && j.date === entree.date);
        const checkin = await lire('checkins', entree.date);
        if (!autre && checkin && checkin.seance === 'faite') {
          await ecrire('checkins', { ...checkin, seance: null, majLe: new Date().toISOString() });
        }
        await rendre('Séance supprimée.');
        return;
      }
      case 'ajouter': {
        const ordre = Math.max(0, ...programme.map((s) => s.ordre)) + 1;
        const seance = nouvelleSeance(`Séance ${programme.length + 1}`, ordre);
        await ecrire('seances', seance);
        location.hash = `#/seances/modifier/${seance.id}`;
        return;
      }
      default:
    }
  }

  racine.addEventListener('click', async (evt) => {
    const cible = evt.target.closest('button[data-action]');
    if (!cible || occupe) return;
    occupe = true;
    try {
      await agir(cible);
    } finally {
      occupe = false;
    }
  });

  await rendre(prendreMessage());
}

/** Carte du programme sur-mesure : phase, semaine, passage à la phase suivante. */
function cartePlan(plan) {
  if (!plan) {
    return `
      <section class="carte carte--accent">
        <h2 class="carte__titre">Programme sur-mesure 6 mois</h2>
        <p class="carte__texte">Push, Pull, Legs, Upper, Lower le mardi, mercredi, jeudi, samedi et dimanche, avec du cardio en fin de séance. 3 phases progressives (Fondations, Construction, Performance) pensées pour un départ très sédentaire, et une progression des charges proposée automatiquement.</p>
        <button type="button" class="bouton" data-action="plan-adopter">Adopter ce programme</button>
      </section>`;
  }
  const semaine = semaineDuPlan(plan);
  const actuelle = phaseNumero(plan.phase);
  const prevue = phasePourSemaine(semaine);
  const termine = semaine > DUREE_SEMAINES;
  const allegee = estSemaineAllegee(plan);
  const suivante = !termine && prevue.numero > actuelle.numero ? prevue : null;

  return `
    <section class="carte carte--plan">
      <h2 class="seance__nom">${echapper(actuelle.nom)}</h2>
      <p class="meta">Programme sur-mesure · phase ${actuelle.numero} sur ${PHASES.length}</p>
      <p class="carte__texte">${termine
        ? `Les ${DUREE_SEMAINES} semaines sont terminées. Continue la phase ${actuelle.numero} en augmentant les charges, ou fais le point sur tes objectifs avant un nouveau cycle.`
        : `Semaine ${semaine} sur ${DUREE_SEMAINES}${allegee ? ' · semaine allégée' : ''}`}</p>
      ${pisteTransformation(plan, undefined, { entete: false })}
      ${allegee ? '<p class="carte__note">Cette semaine, une série de moins par exercice, à charge égale : le corps récupère et progresse ensuite.</p>' : ''}
      ${planAncien(plan) ? `
        <p class="carte__texte">Nouvelle répartition disponible : Push, Pull, Legs, Upper, Lower, le mardi, mercredi, jeudi, samedi et dimanche. Ta semaine et ta phase sont conservées.</p>
        <button type="button" class="bouton" data-action="plan-mettre-a-jour">Mettre à jour mes séances</button>` : ''}
      ${suivante ? `
        <p class="carte__texte">La phase ${suivante.numero} (${echapper(suivante.nom)}) commence cette semaine.</p>
        <button type="button" class="bouton" data-action="phase-suivante" data-phase="${suivante.numero}">Passer à la phase ${suivante.numero}</button>` : ''}
      <details class="depliable">
        <summary class="depliable__titre depliable__titre--petit">Comment fonctionne le programme</summary>
        <p class="carte__texte">${echapper(actuelle.objectif)}</p>
        <ul class="principes">
          <li><strong>Progression :</strong> quand toutes les séries atteignent les répétitions visées, l'app propose + 2,5 kg la fois suivante.</li>
          <li><strong>Charges de départ :</strong> choisis-les à la première séance, assez légères pour une technique propre.</li>
          <li><strong>Cardio « zone 2 » :</strong> tu peux parler en phrases complètes. C'est l'allure qui sollicite le plus les graisses.</li>
          <li><strong>Semaine :</strong> Push le mardi, Pull le mercredi, Legs le jeudi, Upper le samedi, Lower le dimanche. Si tu rates une séance, fais simplement la suivante.</li>
          <li><strong>Lundi et vendredi :</strong> repos. Une marche de 30 à 45 minutes ces jours-là aide beaucoup la perte de graisse.</li>
          <li><strong>Semaines allégées :</strong> 8, 16 et 24.</li>
          <li><strong>Sécurité :</strong> une douleur vive, une gêne dans la poitrine ou un essoufflement inhabituel, c'est stop.</li>
        </ul>
      </details>
    </section>`;
}

// =====================================================================
// Éditeur d'une séance
// =====================================================================

async function editeur(racine, id, entete) {
  const seance = await lire('seances', id);
  if (!seance) { location.replace('#/seances'); return undefined; }
  entete({ titre: 'Modifier', surTitre: 'Séance du programme' });

  // Enregistrement automatique, légèrement différé pendant la frappe.
  let minuterie = null;
  const enregistrer = () => { clearTimeout(minuterie); minuterie = null; return ecrire('seances', seance); };
  const enregistrerBientot = () => { clearTimeout(minuterie); minuterie = setTimeout(enregistrer, 400); };

  const champNombre = (i, champ, libelle, valeur, decimal = false) => `
    <label class="mini">
      <span class="mini__libelle">${libelle}</span>
      <input class="saisie saisie--nombre" data-ex="${i}" data-champ="${champ}" inputmode="${decimal ? 'decimal' : 'numeric'}"
             value="${echapper(decimal ? formatCharge(valeur) : (valeur ?? ''))}" placeholder="—" autocomplete="off">
    </label>`;

  function rendre() {
    racine.innerHTML = `
      <a class="retour" href="#/seances">${ICONES.gauche}Retour au programme</a>
      <label class="champ">
        <span class="champ__libelle">Nom de la séance</span>
        <input class="saisie" data-role="nom-seance" value="${echapper(seance.nom)}" placeholder="Ex. Jambes" maxlength="40" autocomplete="off">
      </label>
      <label class="champ">
        <span class="champ__libelle">Jour</span>
        <select class="saisie saisie--select" data-role="jour-seance">
          <option value="" ${seance.jour === undefined || seance.jour === null ? 'selected' : ''}>Libre (pas de jour fixe)</option>
          ${[1, 2, 3, 4, 5, 6, 0].map((j) => `<option value="${j}" ${seance.jour === j ? 'selected' : ''}>${NOMS_JOURS_LONGS[j]}</option>`).join('')}
        </select>
      </label>
      ${seance.exercices.map((ex, i) => `
        <section class="carte exo-edit">
          <input class="saisie" data-ex="${i}" data-champ="nom" value="${echapper(ex.nom)}" placeholder="Nom de l'exercice" maxlength="60" autocomplete="off" aria-label="Nom de l'exercice ${i + 1}">
          <div class="grille4">
            ${champNombre(i, 'series', 'Séries', ex.series)}
            ${champNombre(i, 'reps', { reps: 'Rép.', s: 'Sec.', min: 'Min.' }[ex.unite || 'reps'], ex.reps)}
            ${champNombre(i, 'charge', 'Kg', ex.charge, true)}
            ${champNombre(i, 'repos', 'Repos (s)', ex.repos)}
          </div>
          <div class="exo-edit__options">
            <select class="saisie saisie--select" data-ex="${i}" data-champ="unite" aria-label="Unité de l'exercice ${i + 1}">
              ${[['reps', 'Répétitions'], ['s', 'Secondes'], ['min', 'Minutes']].map(([v, t]) => `<option value="${v}" ${(ex.unite || 'reps') === v ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <input class="saisie" data-ex="${i}" data-champ="consigne" value="${echapper(ex.consigne || '')}" placeholder="Consigne (facultatif)" maxlength="160" autocomplete="off" aria-label="Consigne de l'exercice ${i + 1}">
          </div>
          <div class="exo-edit__actions">
            <button type="button" class="icone" data-action="monter" data-ex="${i}" aria-label="Monter l'exercice" ${i === 0 ? 'disabled' : ''}>${ICONES.haut}</button>
            <button type="button" class="icone" data-action="descendre" data-ex="${i}" aria-label="Descendre l'exercice" ${i === seance.exercices.length - 1 ? 'disabled' : ''}>${ICONES.bas}</button>
            <a class="lien" href="#/seances/exercice/${ex.id}">Historique</a>
            <button type="button" class="lien lien--discret" data-action="retirer" data-ex="${i}">Retirer</button>
          </div>
        </section>`).join('')}
      <button type="button" class="bouton bouton--secondaire" data-action="ajouter">+ Ajouter un exercice</button>
      <button type="button" class="lien lien--discret lien--centre" data-action="supprimer-seance">Supprimer cette séance</button>
      <p class="carte__note">Les modifications sont enregistrées automatiquement. Laisse « Kg » vide pour un exercice au poids du corps.</p>`;
  }

  // Saisie dans un champ : on met à jour la donnée sans redessiner (le clavier reste ouvert).
  racine.addEventListener('input', (evt) => {
    const champ = evt.target;
    if (champ.dataset.role === 'nom-seance') {
      seance.nom = champ.value;
    } else if (champ.dataset.role === 'jour-seance') {
      seance.jour = champ.value === '' ? null : Number(champ.value);
    } else if (champ.dataset.champ) {
      const ex = seance.exercices[Number(champ.dataset.ex)];
      const limites = {
        series: { entier: true, min: 1, max: 20 },
        reps: { entier: true, min: 1, max: 999 },
        charge: { min: 0, max: 999 },
        repos: { entier: true, min: 0, max: 900 },
      };
      if (champ.dataset.champ === 'nom') ex.nom = champ.value;
      else if (champ.dataset.champ === 'consigne') ex.consigne = champ.value;
      else if (champ.dataset.champ === 'unite') {
        ex.unite = champ.value;
        enregistrer();
        rendre(); // le libellé « Rép. / Sec. / Min. » change
        return;
      }
      else ex[champ.dataset.champ] = lireNombre(champ.value, limites[champ.dataset.champ]);
    } else return;
    enregistrerBientot();
  });

  // Valeurs obligatoires : remises à une valeur sûre en quittant le champ.
  racine.addEventListener('change', (evt) => {
    const champ = evt.target;
    if (!champ.dataset.champ || ['nom', 'consigne', 'unite', 'charge'].includes(champ.dataset.champ)) return;
    const ex = seance.exercices[Number(champ.dataset.ex)];
    if (ex[champ.dataset.champ] === null) {
      ex[champ.dataset.champ] = { series: 3, reps: 10, repos: 90 }[champ.dataset.champ];
      champ.value = ex[champ.dataset.champ];
      enregistrer();
    }
  });

  racine.addEventListener('click', async (evt) => {
    const cible = evt.target.closest('[data-action]');
    if (!cible) return;
    const i = Number(cible.dataset.ex);
    const liste = seance.exercices;

    switch (cible.dataset.action) {
      case 'ajouter':
        liste.push(nouvelExercice());
        break;
      case 'monter':
        [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
        break;
      case 'descendre':
        [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]];
        break;
      case 'retirer':
        if (liste[i].nom && !confirm(`Retirer « ${liste[i].nom} » de cette séance ? L'historique déjà enregistré est conservé.`)) return;
        liste.splice(i, 1);
        break;
      case 'supprimer-seance':
        if (!confirm(`Supprimer la séance « ${seance.nom || 'sans nom'} » du programme ? Les séances déjà réalisées restent dans l'historique.`)) return;
        clearTimeout(minuterie);
        await supprimer('seances', seance.id);
        location.hash = '#/seances';
        return;
      default:
        return;
    }
    rendre(); // affichage immédiat, enregistrement dans la foulée
    enregistrer();
    if (cible.dataset.action === 'ajouter') {
      racine.querySelector(`[data-ex="${liste.length - 1}"][data-champ="nom"]`)?.focus();
    }
  });

  rendre();
  // En quittant l'écran : on s'assure que la dernière frappe est enregistrée.
  return () => { if (minuterie) enregistrer(); };
}
