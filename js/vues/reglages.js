/*
 * Écran « Réglages » : rappels, sauvegarde (export et import JSON),
 * repas par jour, installation, état technique.
 */

import { etat, estInstallee } from '../plateforme.js';
import { echapper, ligneEtat, carteInstallation } from '../ui.js';
import { compter, lireReglage, ecrireReglage } from '../db.js';
import { dateCourte, cleJour } from '../dates.js';
import {
  preparerExport, remettreExport, joursDepuisExport, formatAnciennete, lireSauvegarde, importerSauvegarde,
} from '../sauvegarde.js';
import { lireRappels, NOMS_JOURS, fichierCalendrier } from '../rappels.js';
import { REPAS_PAR_DEFAUT } from '../bilan.js';
import { VERSION_APP } from '../version.js';
import { ICONES } from '../icones.js';

function carteEtat() {
  const installee = estInstallee();
  return `
    <section class="carte">
      <h2 class="carte__titre">État de l'app</h2>
      <ul class="etat">
        ${ligneEtat('Écran d\'accueil', installee, installee ? 'Installée' : 'Dans le navigateur')}
        ${ligneEtat('Hors ligne', etat.horsLignePret, etat.horsLignePret ? 'Prêt' : 'En préparation')}
        ${ligneEtat('Données protégées', etat.stockagePersistant,
          etat.stockagePersistant === true ? 'Oui' : etat.stockagePersistant === false ? 'Non garanti' : '—')}
      </ul>
    </section>`;
}

/** Remet un fichier : feuille de partage si possible, sinon téléchargement. */
async function remettreFichier(fichier) {
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier] });
      return 'partage';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'annule';
    }
  }
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = fichier.name;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'telechargement';
}

export async function monter(racine, params, entete) {
  entete({ titre: 'Réglages', surTitre: 'Rappels, sauvegarde, installation' });

  // État de l'écran, rechargé à chaque rendu.
  let exportPret = null;
  let rappels = null;
  let importEnAttente = null; // sauvegarde lue, en attente de confirmation
  const $ = (sel) => racine.querySelector(sel);

  async function rendre(message = '') {
    const [nbCheckins, jours, repasParJour] = await Promise.all([
      compter('checkins'), joursDepuisExport(), lireReglage('repasParJour', REPAS_PAR_DEFAUT),
    ]);
    rappels = await lireRappels();
    // L'export est préparé d'avance : au clic, Safari exige une réponse immédiate
    // pour ouvrir la feuille de partage.
    exportPret = await preparerExport();
    importEnAttente = null;

    racine.innerHTML = `
      ${message ? `<p class="annonce" role="status">${echapper(message)}</p>` : ''}

      <section class="carte">
        <h2 class="carte__titre">Rappels</h2>
        <div class="heures">
          <label class="champ"><span class="champ__libelle">Check-in du soir</span>
            <input class="saisie" type="time" data-rappel="heureCheckin" value="${rappels.heureCheckin}"></label>
          <label class="champ"><span class="champ__libelle">Séance</span>
            <input class="saisie" type="time" data-rappel="heureSeance" value="${rappels.heureSeance}"></label>
        </div>
        <p class="champ__libelle">Jours d'entraînement</p>
        <div class="choix choix--jours" role="group" aria-label="Jours d'entraînement" style="--colonnes:7">
          ${[1, 2, 3, 4, 5, 6, 0].map((j) => `
            <button type="button" class="choix__option" data-jour="${j}" aria-pressed="${rappels.jours.includes(j)}">${NOMS_JOURS[j]}</button>`).join('')}
        </div>
        <p class="carte__note">Dans l'app : à partir de ces heures, l'écran Aujourd'hui affiche un rappel discret.</p>
        <button type="button" class="bouton bouton--secondaire" data-action="calendrier">Ajouter les rappels au calendrier</button>
        <p class="carte__note">Sur iPhone, une app web ne peut pas envoyer de notification quand elle est fermée. Le fichier calendrier crée deux rappels récurrents dans l'app Calendrier, qui sonnent même app fermée. À refaire après un changement d'heure ou de jours.</p>
      </section>

      <section class="carte">
        <h2 class="carte__titre">Sauvegarde</h2>
        <ul class="etat">
          ${ligneEtat('Check-ins enregistrés', nbCheckins > 0 ? true : null, String(nbCheckins))}
          ${ligneEtat('Dernier export', jours === null ? null : jours < 7, formatAnciennete(jours))}
        </ul>
        <button type="button" class="bouton" data-action="exporter">Exporter mes données</button>
        <p class="carte__note">Un fichier JSON avec toutes tes données. Sur iPhone, choisis « Enregistrer dans Fichiers ». Rythme conseillé : une fois par semaine.</p>
        <label class="bouton bouton--secondaire bouton--fichier">
          Importer une sauvegarde
          <input type="file" accept=".json,application/json" data-role="import" hidden>
        </label>
        <div data-role="import-zone" aria-live="polite"></div>
      </section>

      <section class="carte">
        <h2 class="carte__titre">Alimentation</h2>
        <div class="ligne">
          <p class="champ__libelle">Repas par jour</p>
          <div class="compteur" role="group" aria-label="Repas par jour">
            <button type="button" class="compteur__bouton" data-repas="-1" aria-label="Retirer 1">${ICONES.moins}</button>
            <output class="compteur__valeur">${repasParJour}</output>
            <button type="button" class="compteur__bouton" data-repas="1" aria-label="Ajouter 1">${ICONES.plus}</button>
          </div>
        </div>
        <p class="carte__note">Sert uniquement à calculer la part de repas équilibrés dans le bilan.</p>
      </section>

      ${carteInstallation()}
      ${carteEtat()}
      <p class="version">Athletics ${echapper(VERSION_APP)}</p>`;
  }

  async function enregistrerRappels() {
    await ecrireReglage('rappels', rappels);
  }

  // ---------- Gestes (posés une seule fois) ----------

  racine.addEventListener('click', async (evt) => {
    const cible = evt.target.closest('button');
    if (!cible) return;

    if (cible.dataset.jour !== undefined) {
      const j = Number(cible.dataset.jour);
      rappels.jours = rappels.jours.includes(j) ? rappels.jours.filter((x) => x !== j) : [...rappels.jours, j].sort();
      cible.setAttribute('aria-pressed', String(rappels.jours.includes(j)));
      await enregistrerRappels();
      return;
    }

    if (cible.dataset.repas !== undefined) {
      const actuel = await lireReglage('repasParJour', REPAS_PAR_DEFAUT);
      const nouveau = Math.min(8, Math.max(1, actuel + Number(cible.dataset.repas)));
      await ecrireReglage('repasParJour', nouveau);
      cible.parentElement.querySelector('output').textContent = nouveau;
      return;
    }

    switch (cible.dataset.action) {
      case 'exporter': {
        const resultat = await remettreExport(exportPret);
        await rendre({
          partage: 'Export terminé.',
          telechargement: `Fichier téléchargé : ${exportPret.nom}`,
          annule: 'Export annulé, rien n\'a changé.',
        }[resultat]);
        return;
      }
      case 'calendrier': {
        const resultat = await remettreFichier(fichierCalendrier(rappels));
        if (resultat !== 'annule') {
          await rendre('Fichier calendrier prêt. Ouvre-le et choisis « Ajouter tout » pour créer les rappels.');
        }
        return;
      }
      case 'importer': {
        if (!importEnAttente) return;
        if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ? Cette action ne peut pas être annulée.')) return;
        try {
          await importerSauvegarde(importEnAttente);
          // Les autres écrans relisent la base à leur prochain affichage.
          await rendre('Sauvegarde importée. Toutes les données ont été restaurées.');
        } catch (err) {
          console.error(err);
          $('[data-role="import-zone"]').innerHTML = `<p class="carte__note">Import impossible : ${echapper(err.message)}. Les données actuelles n'ont pas été modifiées.</p>`;
        }
        return;
      }
      case 'annuler-import':
        importEnAttente = null;
        $('[data-role="import-zone"]').innerHTML = '';
        $('[data-role="import"]').value = '';
        return;
      default:
    }
  });

  racine.addEventListener('change', async (evt) => {
    // Heures des rappels
    if (evt.target.dataset.rappel) {
      if (!/^\d{2}:\d{2}$/.test(evt.target.value)) return;
      rappels[evt.target.dataset.rappel] = evt.target.value;
      await enregistrerRappels();
      return;
    }

    // Fichier choisi pour l'import : lecture et aperçu, sans rien modifier.
    if (evt.target.dataset.role === 'import') {
      const fichier = evt.target.files && evt.target.files[0];
      const zone = $('[data-role="import-zone"]');
      if (!fichier) return;
      try {
        const { contenu, resume } = await lireSauvegarde(fichier);
        importEnAttente = contenu;
        const date = resume.exporteLe ? dateCourte(cleJour(new Date(resume.exporteLe))) : 'date inconnue';
        zone.innerHTML = `
          <div class="apercu">
            <p class="carte__titre">Sauvegarde du ${echapper(date)}</p>
            <ul class="etat">
              ${ligneEtat('Check-ins', null, String(resume.checkins))}
              ${ligneEtat('Séances au programme', null, String(resume.seances))}
              ${ligneEtat('Séances réalisées', null, String(resume.journal))}
              ${ligneEtat('Mesures', null, String(resume.mesures))}
            </ul>
            <p class="carte__note">L'import remplace toutes les données actuelles. Exporte d'abord si tu veux les garder.</p>
            <button type="button" class="bouton" data-action="importer">Remplacer par cette sauvegarde</button>
            <button type="button" class="lien lien--discret lien--centre" data-action="annuler-import">Annuler</button>
          </div>`;
      } catch (err) {
        importEnAttente = null;
        zone.innerHTML = `<p class="carte__note">${echapper(err.message)}</p>`;
      }
      evt.target.value = ''; // permet de choisir à nouveau le même fichier
    }
  });

  await rendre();
}
