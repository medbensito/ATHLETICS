/*
 * Point d'entrée de l'application.
 *  - Routeur minimal basé sur le hash de l'URL (#/aujourdhui, #/seances…)
 *  - Enregistrement du service worker (hors ligne)
 *  - Demande de stockage persistant
 *
 * Chaque écran est un module de js/vues/ qui expose :
 *     monter(racine, params, entete)
 * où « racine » est l'élément à remplir, « params » la suite de l'adresse
 * et « entete({ titre, surTitre }) » met à jour le haut de l'écran.
 * monter() peut renvoyer une fonction de nettoyage, appelée quand on quitte l'écran
 * (arrêt d'un chronomètre, enregistrement d'une saisie en attente…).
 * Les écrans des jalons à venir sont de simples coquilles vides.
 */

import { etat, estInstallee } from './plateforme.js';
import { ecranVide, echapper } from './ui.js';
import { cleJour } from './dates.js';
import * as checkin from './vues/checkin.js';
import * as reglages from './vues/reglages.js';
import * as seances from './vues/seances.js';

const $ = (sel) => document.querySelector(sel);

/** Fabrique un écran provisoire pour un jalon à venir. */
const provisoire = (titre, surTitre, accroche, texte, jalon) => ({
  monter(racine, params, entete) {
    entete({ titre, surTitre });
    racine.innerHTML = ecranVide(accroche, texte, jalon);
  },
});

const routes = {
  aujourdhui: checkin,
  seances,
  corps: provisoire('Corps', 'Suivi', 'Poids et tour de taille',
    'Une saisie par semaine et un graphique sur 6 mois avec la tendance et la date cible.', 'J4'),
  bilan: provisoire('Bilan', 'Semaine', 'Le point de la semaine',
    'Régularité, sommeil, cigarettes et repas équilibrés, résumés simplement.', 'J5'),
  reglages,
};

const ROUTE_PAR_DEFAUT = 'aujourdhui';

// ---------- Routeur ----------

/** Découpe l'adresse : « #/aujourdhui/2026-11-10 » → { nom: 'aujourdhui', params: ['2026-11-10'] } */
function routeCourante() {
  const [nom, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  return routes[nom] ? { nom, params } : { nom: ROUTE_PAR_DEFAUT, params: [] };
}

function majEntete({ titre, surTitre }) {
  $('#titre-ecran').textContent = titre;
  $('#sur-titre').textContent = surTitre;
  document.title = `${titre} · Athletics`;
}

let jeton = 0;      // identifie l'affichage en cours (évite qu'un écran lent écrase le suivant)
let jourAffiche = cleJour();
let nettoyer = null; // fonction de nettoyage de l'écran affiché

async function afficher() {
  const { nom, params } = routeCourante();
  const monJeton = ++jeton;
  jourAffiche = cleJour();

  // Onglet actif
  document.querySelectorAll('.onglet').forEach((lien) => {
    const actif = lien.dataset.route === nom;
    lien.classList.toggle('onglet--actif', actif);
    if (actif) lien.setAttribute('aria-current', 'page');
    else lien.removeAttribute('aria-current');
  });

  // L'écran se construit hors de la page, puis remplace l'ancien d'un coup.
  const racine = document.createElement('div');
  racine.className = 'vue';
  const entete = (infos) => { if (monJeton === jeton) majEntete(infos); };

  let nettoyerNouveau = null;
  try {
    nettoyerNouveau = await routes[nom].monter(racine, params, entete);
  } catch (err) {
    console.error(err);
    racine.innerHTML = `
      <section class="carte">
        <h2 class="carte__titre">Cet écran n'a pas pu s'afficher</h2>
        <p class="carte__texte">${echapper(err && err.message ? err.message : 'Erreur inconnue.')}</p>
        <p class="carte__note">Ferme puis rouvre l'app. En navigation privée, le stockage local peut être indisponible.</p>
      </section>`;
  }

  if (monJeton !== jeton) { // l'utilisateur a déjà changé d'écran
    if (typeof nettoyerNouveau === 'function') nettoyerNouveau();
    return;
  }
  if (nettoyer) nettoyer();
  nettoyer = typeof nettoyerNouveau === 'function' ? nettoyerNouveau : null;
  $('#contenu').replaceChildren(racine);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', afficher);

// Au retour dans l'app après minuit, l'écran « Aujourd'hui » passe au nouveau jour.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || jourAffiche === cleJour()) return;
  const { nom, params } = routeCourante();
  if (nom === 'aujourdhui' && params.length === 0) afficher();
});

/** Rafraîchit l'écran seulement s'il affiche l'état technique (ne jamais interrompre une saisie). */
function rafraichirEtat() {
  if (routeCourante().nom === 'reglages') afficher();
}

// ---------- Hors ligne ----------

function majBandeauReseau() {
  $('#bandeau-hors-ligne').hidden = navigator.onLine;
}
window.addEventListener('online', majBandeauReseau);
window.addEventListener('offline', majBandeauReseau);

async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready; // le cache hors ligne est rempli
    etat.horsLignePret = true;
    rafraichirEtat();
  } catch (err) {
    // Cas typique : page ouverte en file:// ou en http hors localhost.
    console.warn('Service worker non enregistré :', err);
  }
}

/**
 * Demande au navigateur de ne pas purger les données de l'app.
 * Safari l'accorde surtout aux apps installées sur l'écran d'accueil.
 */
async function demanderStockagePersistant() {
  if (!navigator.storage || !navigator.storage.persist) return;
  try {
    etat.stockagePersistant = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    rafraichirEtat();
  } catch {
    /* non bloquant */
  }
}

// ---------- Démarrage ----------

document.documentElement.classList.toggle('installee', estInstallee());
afficher();
majBandeauReseau();
enregistrerServiceWorker();
demanderStockagePersistant();
