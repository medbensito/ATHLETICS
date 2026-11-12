/*
 * Calendrier de régularité : un mois, jour par jour.
 * Adresses : #/bilan/mois (mois en cours) et #/bilan/mois/AAAA-MM.
 *
 * Volontairement sans compteur de jours d'affilée : un oubli ne « casse » rien,
 * on voit simplement ce qui a été fait.
 */

import { lireTout } from '../db.js';
import { cleJour, depuisCle } from '../dates.js';
import { echapper } from '../ui.js';
import { checkinRempli } from '../bilan.js';
import { lirePlan } from '../plan.js';
import { seanceDuJour } from '../seance-du-jour.js';
import { ICONES } from '../icones.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const deux = (n) => String(n).padStart(2, '0');

/** « 2026-11 » → { annee, mois (0-11) } ; mois en cours si invalide ou futur. */
function lireMois(texte) {
  const auj = depuisCle(cleJour());
  const m = /^(\d{4})-(\d{2})$/.exec(texte || '');
  if (m) {
    const annee = Number(m[1]);
    const mois = Number(m[2]) - 1;
    if (mois >= 0 && mois < 12 && (annee < auj.getFullYear() || (annee === auj.getFullYear() && mois <= auj.getMonth()))) {
      return { annee, mois };
    }
  }
  return { annee: auj.getFullYear(), mois: auj.getMonth() };
}

const cleMois = (annee, mois) => {
  const d = new Date(annee, mois, 1, 12);
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}`;
};

export async function monter(racine, params, entete) {
  const { annee, mois } = lireMois(params[0]);
  const aujourdhui = cleJour();
  const [checkins, journal, seances, plan] = await Promise.all([
    lireTout('checkins'), lireTout('journal'), lireTout('seances'), lirePlan(),
  ]);

  entete({ titre: `${MOIS[mois].charAt(0).toUpperCase()}${MOIS[mois].slice(1)} ${annee}`, surTitre: 'Calendrier de régularité' });

  const parDate = new Map(checkins.map((c) => [c.date, c]));
  const joursSeance = new Set(journal.filter((j) => j.fin).map((j) => j.date));
  checkins.forEach((c) => { if (c.seance === 'faite') joursSeance.add(c.date); });

  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7; // lundi = 0
  const premier = `${annee}-${deux(mois + 1)}-01`;
  const premiereDonnee = [...checkins.map((c) => c.date), ...journal.map((j) => j.date)].sort()[0] || aujourdhui;

  let seancesFaites = 0;
  let joursNotes = 0;
  let joursEcoules = 0;
  const cellules = [];
  for (let i = 0; i < decalage; i += 1) cellules.push('<span class="cal__jour cal__jour--vide" aria-hidden="true"></span>');

  for (let j = 1; j <= nbJours; j += 1) {
    const cle = `${annee}-${deux(mois + 1)}-${deux(j)}`;
    const c = parDate.get(cle);
    const futur = cle > aujourdhui;
    let etat = '';
    let libelle = 'rien de noté';
    if (joursSeance.has(cle)) { etat = 'seance'; libelle = 'séance faite'; seancesFaites += 1; } else if (c && c.seance === 'repos') { etat = 'repos'; libelle = 'repos'; } else if (checkinRempli(c)) { etat = 'note'; libelle = 'check-in rempli'; } else if (cle >= aujourdhui && seanceDuJour(seances, plan, cle)) { etat = 'prevu'; libelle = 'séance prévue'; }
    if (!futur) {
      joursEcoules += 1;
      if (checkinRempli(c) || joursSeance.has(cle)) joursNotes += 1;
    }
    cellules.push(`
      <span class="cal__jour ${etat ? `cal__jour--${etat}` : ''} ${cle === aujourdhui ? 'cal__jour--aujourdhui' : ''} ${futur ? 'cal__jour--futur' : ''}"
            role="img" aria-label="${j} ${MOIS[mois]} : ${libelle}">${j}</span>`);
  }

  const precedent = cleMois(annee, mois - 1);
  const suivant = cleMois(annee, mois + 1);
  const moisCourant = cleMois(depuisCle(aujourdhui).getFullYear(), depuisCle(aujourdhui).getMonth());
  const aDesDonneesAvant = premiereDonnee < premier;

  racine.innerHTML = `
    <a class="retour" href="#/bilan">${ICONES.gauche}Retour au bilan</a>
    <div class="jours">
      ${aDesDonneesAvant
        ? `<a class="jours__fleche" href="#/bilan/mois/${precedent}" aria-label="Mois précédent">${ICONES.gauche}</a>`
        : `<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">${ICONES.gauche}</span>`}
      <p class="jours__etat">${seancesFaites} séance${seancesFaites > 1 ? 's' : ''} · ${joursNotes} jour${joursNotes > 1 ? 's' : ''} noté${joursNotes > 1 ? 's' : ''} sur ${joursEcoules}</p>
      ${cleMois(annee, mois) < moisCourant
        ? `<a class="jours__fleche" href="#/bilan/mois/${suivant}" aria-label="Mois suivant">${ICONES.droite}</a>`
        : `<span class="jours__fleche jours__fleche--inactive" aria-hidden="true">${ICONES.droite}</span>`}
    </div>
    <section class="carte">
      <div class="cal" role="group" aria-label="Calendrier de ${MOIS[mois]} ${annee}">
        ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((n) => `<span class="cal__entete" aria-hidden="true">${n}</span>`).join('')}
        ${cellules.join('')}
      </div>
      <p class="legende">
        <span class="legende__item"><span class="cal__cle cal__jour--seance"></span>Séance faite</span>
        <span class="legende__item"><span class="cal__cle cal__jour--note"></span>Check-in rempli</span>
        <span class="legende__item"><span class="cal__cle cal__jour--repos"></span>Repos</span>
        <span class="legende__item"><span class="cal__cle cal__jour--prevu"></span>Séance prévue</span>
      </p>
    </section>
    <p class="carte__note">Chaque case remplie compte. Un jour vide n'efface rien de ce qui a été fait.</p>`;
}
