/*
 * Écran « Records » : meilleure charge et max estimé de chaque exercice.
 * Adresse : #/seances/records
 */

import { lireTout } from '../db.js';
import { dateCourte } from '../dates.js';
import { echapper } from '../ui.js';
import { formatCharge } from '../programme.js';
import { calculerRecords } from '../records.js';
import { ICONES } from '../icones.js';

export async function monter(racine, params, entete) {
  entete({ titre: 'Records', surTitre: 'Meilleures charges et max estimé' });
  const records = [...calculerRecords(await lireTout('journal')).values()]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const retour = '<a class="retour" href="#/seances">${ICONES.gauche}Retour au programme</a>';
  if (!records.length) {
    racine.innerHTML = `
      ${retour}
      <section class="carte">
        <h2 class="carte__titre">Pas encore de records</h2>
        <p class="carte__texte">Ils apparaîtront après ta première séance terminée avec des charges.</p>
      </section>`;
    return;
  }

  racine.innerHTML = `
    ${retour}
    <section class="carte">
      <ul class="etat">
        ${records.map((r) => `
          <li class="etat__ligne etat__ligne--libre record">
            <span class="etat__libelle">${echapper(r.nom)}<br><small>Meilleure charge : ${echapper(formatCharge(r.meilleureCharge.charge))} kg × ${r.meilleureCharge.reps}, ${echapper(dateCourte(r.meilleureCharge.date).toLowerCase())}</small></span>
            <span class="record__max">${r.max ? `${echapper(formatCharge(Math.round(r.max.valeur * 2) / 2))} kg<small>max estimé</small>` : '—'}</span>
          </li>`).join('')}
      </ul>
    </section>
    <p class="carte__note">Max estimé : charge théorique sur une seule répétition, calculée à partir de tes séries (formule d'Epley, jusqu'à 12 répétitions). C'est une estimation, pas un test à faire.</p>`;
}
