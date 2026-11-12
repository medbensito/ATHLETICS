/*
 * Petits morceaux d'interface réutilisés par plusieurs écrans.
 * Chaque fonction renvoie du HTML sous forme de texte.
 */

import { estInstallee, estIOS } from './plateforme.js';

/** Échappe un texte avant insertion dans du HTML. */
export const echapper = (texte) =>
  String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Ligne d'état : pastille + libellé + valeur. */
export function ligneEtat(libelle, ok, valeur) {
  const classe = ok === true ? 'pastille--ok' : ok === false ? 'pastille--attente' : 'pastille--inconnu';
  return `
    <li class="etat__ligne">
      <span class="pastille ${classe}" aria-hidden="true"></span>
      <span class="etat__libelle">${echapper(libelle)}</span>
      <span class="etat__valeur">${echapper(valeur)}</span>
    </li>`;
}

/** Aide à l'installation, affichée uniquement tant que l'app tourne dans le navigateur. */
export function carteInstallation() {
  if (estInstallee()) return '';
  const etapes = estIOS()
    ? `<ol class="etapes">
         <li>Dans <strong>Safari</strong>, touche le bouton <strong>Partager</strong>.</li>
         <li>Choisis <strong>Sur l'écran d'accueil</strong>.</li>
         <li>Valide avec <strong>Ajouter</strong>, puis ouvre l'app depuis son icône.</li>
       </ol>`
    : `<p class="carte__texte">Sur iPhone : ouvre cette page dans Safari, puis Partager → Sur l'écran d'accueil.
       Sur ordinateur, l'app se teste directement ici.</p>`;
  return `
    <section class="carte carte--rappel">
      <h2 class="carte__titre">Installer sur l'écran d'accueil</h2>
      ${etapes}
      <p class="carte__note">Une fois installée, l'app garde ses données et s'ouvre en plein écran.</p>
    </section>`;
}
