/*
 * Historique d'un exercice : dernière charge, meilleure charge, progression séance après séance.
 * Adresse : #/seances/exercice/<id de l'exercice>
 */

import { lireTout } from '../db.js';
import { dateCourte } from '../dates.js';
import { echapper } from '../ui.js';
import { historiqueExercice, formatCharge, formatSerie } from '../programme.js';
import { recordsExercice } from '../records.js';
import { ICONES } from '../icones.js';

export async function monter(racine, params, entete) {
  const id = params[0];
  const [programme, journal] = await Promise.all([lireTout('seances'), lireTout('journal')]);

  // Nom de l'exercice : dans le programme, sinon dans le journal (exercice retiré depuis).
  let nom = '';
  for (const s of programme) for (const e of s.exercices) if (e.id === id) nom = e.nom;
  if (!nom) for (const j of journal) for (const e of j.exercices) if (e.exerciceId === id) nom = e.nom;

  entete({ titre: nom || 'Exercice', surTitre: 'Historique' });

  const passages = historiqueExercice(journal, id, nom);
  const retour = '<button type="button" class="retour" data-action="retour">${ICONES.gauche}Retour</button>';
  racine.addEventListener('click', (evt) => {
    if (evt.target.closest('[data-action="retour"]')) {
      if (history.length > 1) history.back();
      else location.hash = '#/seances';
    }
  });

  if (passages.length === 0) {
    racine.innerHTML = `
      ${retour}
      <section class="carte">
        <h2 class="carte__titre">Pas encore d'historique</h2>
        <p class="carte__texte">Les charges et répétitions apparaîtront ici dès la première séance terminée avec cet exercice.</p>
      </section>`;
    return;
  }

  const avecCharge = passages.filter((p) => p.meilleure !== null);
  const derniere = avecCharge.length ? avecCharge[avecCharge.length - 1].meilleure : null;
  const record = avecCharge.length ? Math.max(...avecCharge.map((p) => p.meilleure)) : null;
  const premiere = avecCharge.length ? avecCharge[0].meilleure : null;

  /** Écart de charge avec le passage précédent : « + 2,5 kg », « = », « − 5 kg ». */
  const ecart = (i) => {
    if (i === 0 || passages[i].meilleure === null || passages[i - 1].meilleure === null) return '';
    const d = passages[i].meilleure - passages[i - 1].meilleure;
    if (d === 0) return '=';
    return `${d > 0 ? '+' : '−'} ${formatCharge(Math.abs(d))} kg`;
  };

  const chiffre = (valeur, libelle) => `
    <div class="chiffre">
      <span class="chiffre__valeur">${echapper(valeur)}</span>
      <span class="chiffre__libelle">${libelle}</span>
    </div>`;

  racine.innerHTML = `
    ${retour}
    <section class="carte">
      <div class="chiffres">
        ${chiffre(derniere !== null ? `${formatCharge(derniere)} kg` : '—', 'Dernière charge')}
        ${chiffre(record !== null ? `${formatCharge(record)} kg` : '—', 'Meilleure charge')}
        ${chiffre(recordsExercice(journal, nom)?.max ? `${formatCharge(Math.round(recordsExercice(journal, nom).max.valeur * 2) / 2)} kg` : '—', 'Max estimé')}
      </div>
      <p class="carte__note">${passages.length} séance${passages.length > 1 ? 's' : ''}. Max estimé : charge théorique sur une répétition, calculée d'après tes séries (pas un test à faire).</p>
      ${avecCharge.length > 1 ? `<p class="carte__note">Depuis la première séance : ${
        derniere - premiere === 0 ? 'charge stable' : `${derniere > premiere ? '+' : '−'} ${formatCharge(Math.abs(derniere - premiere))} kg`}.</p>` : ''}
    </section>
    <section class="carte">
      <h2 class="carte__titre">Séance par séance</h2>
      <ul class="etat">
        ${passages.map((p, i) => `
          <li class="etat__ligne etat__ligne--libre">
            <span class="etat__libelle">${echapper(dateCourte(p.date))}<br><small>${echapper(p.series.map((x) => formatSerie(x, p.unite)).join(' · '))}</small></span>
            <span class="etat__valeur">${echapper(ecart(i))}</span>
          </li>`).reverse().join('')}
      </ul>
    </section>`;
}
