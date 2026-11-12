/*
 * Écran « Corps » : saisie hebdomadaire du poids et du tour de taille,
 * graphiques sur la période de 6 mois, liste des mesures, période et objectifs.
 */

import { ecrire, supprimer } from '../db.js';
import { cleJour, estCleJour, dateCourte, joursEntre } from '../dates.js';
import { echapper } from '../ui.js';
import { lireNombre, laisserMessage, prendreMessage } from '../programme.js';
import {
  MESURES, RAPPEL_JOURS, ajouterMois, DUREE_MOIS, lireMesures, lirePeriode, ecrirePeriode,
  points, tendance, formatValeur, formatEcart, joursDepuisMesure, lirePeseeCollee,
} from '../corps.js';
import { graphique, activerSurvol } from '../graphique.js';

export async function monter(racine, params, entete) {
  entete({ titre: 'Corps', surTitre: 'Poids et tour de taille' });

  const aujourdhui = cleJour();
  // État de l'écran, rechargé à chaque rendu ; les gestionnaires plus bas le lisent.
  let mesures = [];
  let periode = null;
  const $ = (sel) => racine.querySelector(sel);

  /** Redessine tout l'écran à partir de la base. */
  async function rendre(message = '', dateDemandee = null) {
    mesures = await lireMesures();
    periode = await lirePeriode(mesures);
    const derniere = mesures[mesures.length - 1] || null;
    const ecart = joursDepuisMesure(mesures);

    // Date de saisie : aujourd'hui, avec les valeurs déjà saisies ce jour-là s'il y en a.
    const dateSaisie = dateDemandee && estCleJour(dateDemandee) && dateDemandee <= aujourdhui ? dateDemandee : aujourdhui;
    const existante = mesures.find((m) => m.date === dateSaisie);

    // ---------- Saisie ----------
    const invite = ecart === null
      ? 'Première mesure : elle servira de point de départ.'
      : ecart >= RAPPEL_JOURS
        ? `Dernière mesure : il y a ${ecart} jours. C'est le moment de la mesure de la semaine.`
        : `Dernière mesure : ${ecart === 0 ? 'aujourd\'hui' : ecart === 1 ? 'hier' : `il y a ${ecart} jours`}. Prochaine conseillée dans ${RAPPEL_JOURS - ecart} jour${RAPPEL_JOURS - ecart > 1 ? 's' : ''}.`;

    const champ = (id, { libelle, unite }) => `
      <label class="champ">
        <span class="champ__libelle">${libelle} (${unite})</span>
        <input class="saisie saisie--grande" data-mesure="${id}" inputmode="decimal" autocomplete="off" placeholder="—"
               value="${existante && existante[id] !== null && existante[id] !== undefined ? formatValeur(existante[id]) : ''}">
      </label>`;

    const carteSaisie = `
      <section class="carte">
        <h2 class="carte__titre">Mesure de la semaine</h2>
        <p class="carte__texte">${echapper(invite)}</p>
        <div class="heures">
          ${champ('poids', MESURES.poids)}
          ${champ('taille', MESURES.taille)}
        </div>
        <label class="champ">
          <span class="champ__libelle">Date</span>
          <input class="saisie" type="date" data-role="date" value="${dateSaisie}" max="${aujourdhui}">
        </label>
        <button type="button" class="bouton" data-action="enregistrer">${existante ? 'Mettre à jour' : 'Enregistrer'}</button>
        <button type="button" class="bouton bouton--secondaire" data-action="coller-pesee">Coller la pesée de Santé</button>
        <p class="carte__note" data-role="message" role="status">${echapper(message)}</p>
        <p class="carte__note">Conseil : toujours dans les mêmes conditions, par exemple le même jour de la semaine, le matin à jeun. Pesée dans Santé : lance le raccourci « Pesée Athletics », puis « Coller » ici (mode d'emploi dans Réglages).</p>
      </section>`;

    // ---------- Graphiques ----------
    const survols = {}; // points de chaque graphique, pour la bulle au toucher
    const carteGraphique = (id) => {
      const def = MESURES[id];
      const pts = points(mesures, id).filter((p) => p.date >= ajouterMois(periode.debut, -1));
      if (pts.length === 0) {
        return `
          <section class="carte">
            <h2 class="carte__titre">${def.libelle} <span class="rubrique__sous-titre">${def.unite}</span></h2>
            <p class="carte__texte">La courbe apparaîtra dès la première mesure.</p>
          </section>`;
      }
      const objectif = periode[def.objectif];
      const { svg, aTendance, cibles } = graphique({
        points: pts, debut: periode.debut, cible: periode.cible, aujourdhui, objectif, unite: def.unite, libelle: def.libelle,
      });
      survols[id] = cibles;
      const premier = pts[0];
      const dernier = pts[pts.length - 1];
      const t = tendance(pts);

      const resume = [];
      resume.push(`<span class="chiffre"><span class="chiffre__valeur">${formatValeur(dernier.valeur)}</span><span class="chiffre__libelle">Dernière</span></span>`);
      resume.push(`<span class="chiffre"><span class="chiffre__valeur">${pts.length > 1 ? formatEcart(dernier.valeur - premier.valeur) : '—'}</span><span class="chiffre__libelle">Depuis le début</span></span>`);
      resume.push(`<span class="chiffre"><span class="chiffre__valeur">${t ? formatEcart(t.pente * 7) : '—'}</span><span class="chiffre__libelle">Par semaine</span></span>`);

      return `
        <section class="carte">
          <h2 class="carte__titre">${def.libelle} <span class="rubrique__sous-titre">${def.unite}</span></h2>
          <div class="chiffres">${resume.join('')}</div>
          <p class="carte__note">Mesures du ${echapper(dateCourte(premier.date))} au ${echapper(dateCourte(dernier.date))}</p>
          <div class="graph" data-graph="${id}">
            <div class="graph__bulle" data-role="bulle" hidden></div>
            ${svg}
          </div>
          <p class="legende">
            <span class="legende__item"><span class="legende__cle legende__cle--mesure"></span>Mesures</span>
            ${aTendance ? '<span class="legende__item"><span class="legende__cle legende__cle--tendance"></span>Tendance</span>' : ''}
            <span class="legende__item"><span class="legende__cle legende__cle--repere"></span>Date cible${typeof objectif === 'number' ? ' et objectif' : ''}</span>
          </p>
          ${!aTendance ? '<p class="carte__note">La tendance s\'affichera à partir de 3 mesures sur au moins 2 semaines.</p>' : ''}
        </section>`;
    };

    // ---------- Liste des mesures (vue tableau) ----------
    const carteListe = mesures.length ? `
      <section class="carte">
        <h2 class="carte__titre">Toutes les mesures</h2>
        <ul class="etat">
          ${mesures.slice().reverse().map((m) => `
            <li class="etat__ligne etat__ligne--libre etat__ligne--3">
              <span class="etat__libelle">${echapper(dateCourte(m.date))}<br><small>${[
                typeof m.poids === 'number' ? `${formatValeur(m.poids)} kg` : null,
                typeof m.taille === 'number' ? `${formatValeur(m.taille)} cm` : null,
              ].filter(Boolean).join(' · ')}</small></span>
              <a class="lien" href="#/corps/${m.date}">Modifier</a>
              <button type="button" class="lien lien--discret" data-action="supprimer" data-date="${m.date}">Supprimer</button>
            </li>`).join('')}
        </ul>
      </section>` : '';

    // ---------- Période et objectifs ----------
    const valeurObjectif = (cle) => (typeof periode[cle] === 'number' ? formatValeur(periode[cle]) : '');
    const cartePeriode = `
      <details class="carte depliable">
        <summary class="depliable__titre">Période et objectifs</summary>
        <p class="carte__texte">La période dure ${DUREE_MOIS} mois par défaut. Les objectifs sont facultatifs : ils ajoutent seulement un repère sur la courbe.</p>
        <div class="empile">
          <label class="champ"><span class="champ__libelle">Début</span>
            <input class="saisie" type="date" data-periode="debut" value="${periode.debut}"></label>
          <label class="champ"><span class="champ__libelle">Date cible</span>
            <input class="saisie" type="date" data-periode="cible" value="${periode.cible}"></label>
        </div>
        <div class="heures">
          <label class="champ"><span class="champ__libelle">Poids visé (kg)</span>
            <input class="saisie" inputmode="decimal" data-periode="poidsObjectif" value="${valeurObjectif('poidsObjectif')}" placeholder="facultatif" autocomplete="off"></label>
          <label class="champ"><span class="champ__libelle">Tour visé (cm)</span>
            <input class="saisie" inputmode="decimal" data-periode="tailleObjectif" value="${valeurObjectif('tailleObjectif')}" placeholder="facultatif" autocomplete="off"></label>
        </div>
        <p class="carte__note" data-role="message-periode" role="status"></p>
      </details>`;

    racine.innerHTML = carteSaisie + carteGraphique('poids') + carteGraphique('taille') + carteListe + cartePeriode;

    // Bulles des graphiques
    for (const id of Object.keys(MESURES)) {
      const conteneur = racine.querySelector(`[data-graph="${id}"]`);
      if (!conteneur) continue;
      activerSurvol(conteneur, survols[id], MESURES[id].unite);
    }

    // Changer la date de saisie recharge les valeurs de ce jour-là.
    $('[data-role="date"]').addEventListener('change', (evt) => {
      const date = evt.target.value;
      if (estCleJour(date) && date <= aujourdhui) location.hash = `#/corps/${date}`;
    });
  } // fin de rendre()

  const afficherMessage = (texte) => { $('[data-role="message"]').textContent = texte; };

  racine.addEventListener('click', async (evt) => {
    const cible = evt.target.closest('[data-action]');
    if (!cible) return;

    if (cible.dataset.action === 'enregistrer') {
      const date = $('[data-role="date"]').value;
      if (!estCleJour(date) || date > aujourdhui) { afficherMessage('Choisis une date valide, au plus tard aujourd\'hui.'); return; }

      const valeurs = {};
      for (const [id, def] of Object.entries(MESURES)) {
        const texte = $(`[data-mesure="${id}"]`).value;
        const v = lireNombre(texte, { min: 0, max: 9999 });
        if (texte.trim() !== '' && (v === null || v < def.min || v > def.max)) {
          afficherMessage(`${def.libelle} : saisis une valeur entre ${def.min} et ${def.max} ${def.unite}.`);
          return;
        }
        valeurs[id] = v === null ? null : Math.round(v * 10) / 10;
      }
      if (valeurs.poids === null && valeurs.taille === null) {
        afficherMessage('Saisis au moins le poids ou le tour de taille.');
        return;
      }

      await ecrire('mesures', { date, ...valeurs, majLe: new Date().toISOString() });
      // La période est figée dès la première mesure, pour que la date cible ne bouge plus.
      if (periode.provisoire) {
        const debut = mesures.length ? [mesures[0].date, date].sort()[0] : date;
        await ecrirePeriode({ ...periode, debut, cible: ajouterMois(debut, DUREE_MOIS) });
      }
      if (location.hash === '#/corps') {
        await rendre('Mesure enregistrée.');
      } else {
        // L'adresse change : le routeur redessine l'écran et affiche le message.
        laisserMessage('Mesure enregistrée.');
        location.hash = '#/corps';
      }
      return;
    }

    // Pesée copiée par le raccourci iOS : lecture du presse-papiers (iOS demande de toucher « Coller »).
    if (cible.dataset.action === 'coller-pesee') {
      let texte = null;
      try {
        texte = await navigator.clipboard.readText();
      } catch {
        afficherMessage('Le collage n\'a pas été autorisé : touche « Coller » dans la bulle d\'iOS, ou saisis la valeur.');
        return;
      }
      const poids = lirePeseeCollee(texte);
      if (poids === null) {
        afficherMessage('Aucune pesée dans le presse-papiers. Lance d\'abord le raccourci « Pesée Athletics » (Réglages › Pesée depuis Santé).');
        return;
      }
      $('[data-mesure="poids"]').value = formatValeur(poids);
      afficherMessage(`Pesée collée : ${formatValeur(poids)} kg. Vérifie la date, puis enregistre.`);
      return;
    }

    if (cible.dataset.action === 'supprimer') {
      const date = cible.dataset.date;
      if (!confirm(`Supprimer la mesure du ${dateCourte(date)} ?`)) return;
      await supprimer('mesures', date);
      await rendre('Mesure supprimée.');
    }
  });

  // Période : enregistrée à chaque modification valide.
  racine.addEventListener('change', async (evt) => {
    const champPeriode = evt.target.dataset.periode;
    if (!champPeriode) return;
    const nouvelle = { ...periode };
    const msg = $('[data-role="message-periode"]');

    if (champPeriode === 'debut' || champPeriode === 'cible') {
      if (!estCleJour(evt.target.value)) { msg.textContent = 'Date invalide.'; return; }
      nouvelle[champPeriode] = evt.target.value;
      // Changer le début décale la date cible de la même durée si elle n'a pas été choisie à part.
      if (champPeriode === 'debut' && periode.cible === ajouterMois(periode.debut, DUREE_MOIS)) {
        nouvelle.cible = ajouterMois(nouvelle.debut, DUREE_MOIS);
      }
      if (joursEntre(nouvelle.debut, nouvelle.cible) < 14) { msg.textContent = 'La date cible doit être au moins 2 semaines après le début.'; return; }
    } else {
      const def = Object.values(MESURES).find((m) => m.objectif === champPeriode);
      const v = lireNombre(evt.target.value, { min: 0, max: 9999 });
      if (evt.target.value.trim() !== '' && (v === null || v < def.min || v > def.max)) {
        msg.textContent = `Saisis une valeur entre ${def.min} et ${def.max} ${def.unite}, ou laisse vide.`;
        return;
      }
      nouvelle[champPeriode] = v === null ? null : Math.round(v * 10) / 10;
    }
    await ecrirePeriode(nouvelle);
    await rendre('', params[0]);
    $('details.depliable').open = true;
    $('[data-role="message-periode"]').textContent = 'Enregistré.';
  });

  await rendre(prendreMessage(), params[0]);
}

/** Rappel discret pour l'écran Aujourd'hui (chaîne vide s'il n'y a rien à rappeler). */
export async function carteRappelMesure() {
  const mesures = await lireMesures();
  const ecart = joursDepuisMesure(mesures);
  if (ecart !== null && ecart < RAPPEL_JOURS) return '';
  const texte = ecart === null
    ? 'Poids et tour de taille : une première mesure servira de point de départ.'
    : `Dernière mesure il y a ${ecart} jours.`;
  return `
    <a class="carte carte--lien" href="#/corps">
      <span class="carte__titre">Mesure de la semaine</span>
      <span class="carte__texte">${echapper(texte)}</span>
    </a>`;
}
