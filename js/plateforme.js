/*
 * Informations sur l'environnement d'exécution (installée ou non, iOS ou non)
 * et état technique partagé entre les écrans.
 */

/** Vrai si l'app est lancée depuis l'écran d'accueil (et non dans un onglet Safari). */
export const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

/** Vrai sur iPhone / iPad (y compris iPadOS qui se présente comme un Mac). */
export const estIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** État technique, mis à jour au démarrage par app.js. */
export const etat = {
  horsLignePret: false,     // le service worker contrôle la page
  stockagePersistant: null, // true / false / null (inconnu)
};
