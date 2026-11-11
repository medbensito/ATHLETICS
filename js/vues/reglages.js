/*
 * Écran « Réglages » : sauvegarde (export JSON), installation, état technique.
 */

import { etat, estInstallee } from '../plateforme.js';
import { echapper, ligneEtat, carteInstallation } from '../ui.js';
import { compter } from '../db.js';
import { preparerExport, remettreExport, joursDepuisExport, formatAnciennete } from '../sauvegarde.js';
import { VERSION_APP, JALON } from '../version.js';

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

export async function monter(racine, params, entete, message = '') {
  entete({ titre: 'Réglages', surTitre: 'Application' });

  const [nbCheckins, jours] = await Promise.all([compter('checkins'), joursDepuisExport()]);
  // L'export est préparé d'avance : au clic, Safari exige une réponse immédiate
  // pour ouvrir la feuille de partage.
  const exportPret = await preparerExport();

  racine.innerHTML = `
    <section class="carte">
      <h2 class="carte__titre">Sauvegarde</h2>
      <ul class="etat">
        ${ligneEtat('Check-ins enregistrés', nbCheckins > 0 ? true : null, String(nbCheckins))}
        ${ligneEtat('Dernier export', jours === null ? null : jours < 7, formatAnciennete(jours))}
      </ul>
      <button type="button" class="bouton" data-role="exporter">Exporter mes données</button>
      <p class="carte__note" data-role="message" aria-live="polite">${echapper(message)}</p>
      <p class="carte__note">Un fichier JSON avec toutes tes données. Sur iPhone, choisis « Enregistrer dans Fichiers ». Rythme conseillé : une fois par semaine. L'import arrivera au jalon J5.</p>
    </section>
    ${carteInstallation()}
    ${carteEtat()}
    <p class="version">Athletics ${echapper(VERSION_APP)} · ${echapper(JALON)}</p>`;

  racine.querySelector('[data-role="exporter"]').addEventListener('click', async () => {
    const resultat = await remettreExport(exportPret);
    const texte = {
      partage: 'Export terminé.',
      telechargement: `Fichier téléchargé : ${exportPret.nom}`,
      annule: 'Export annulé, rien n\'a changé.',
    }[resultat];
    // On remonte l'écran pour rafraîchir la date du dernier export et préparer le suivant.
    if (racine.isConnected) monter(racine, params, entete, texte);
  });
}
