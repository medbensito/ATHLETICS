/*
 * Rappels : séance et check-in du soir.
 *
 * Sur iPhone, une app web sans serveur ne peut pas programmer de notification
 * qui sonne app fermée (les notifications d'une PWA passent par un serveur push).
 * L'app propose donc deux mécanismes complémentaires, sans serveur ni service tiers :
 *  1. des rappels visibles dans l'app, à l'écran « Aujourd'hui » ;
 *  2. un fichier calendrier (.ics) à importer une fois dans Calendrier d'iOS,
 *     avec des alarmes récurrentes qui sonnent même app fermée.
 *
 * Réglage « rappels » : { heureCheckin: '21:00', heureSeance: '18:00', jours: [1,2,3,4,5] }
 * jours : jours d'entraînement, 0 = dimanche … 6 = samedi.
 */

import { lireReglage } from './db.js';
import { cleJour, depuisCle } from './dates.js';

export const RAPPELS_DEFAUT = { heureCheckin: '21:00', heureSeance: '18:00', jours: [1, 2, 3, 4, 5] };
export const NOMS_JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const CODES_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export async function lireRappels() {
  return { ...RAPPELS_DEFAUT, ...(await lireReglage('rappels', {})) };
}

const minutes = (heure) => {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + m;
};

/** Minutes écoulées depuis minuit (heure de l'appareil). */
const maintenant = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

/** Vrai si aujourd'hui est un jour d'entraînement. */
export const jourEntrainement = (rappels, cle = cleJour()) => rappels.jours.includes(depuisCle(cle).getDay());

/** Le rappel du check-in s'affiche à partir de l'heure choisie, tant que le check-in est incomplet. */
export const rappelCheckinActif = (rappels) => maintenant() >= minutes(rappels.heureCheckin);

/** Le rappel de séance s'affiche un jour d'entraînement, une heure avant l'heure choisie et ensuite. */
export const rappelSeanceActif = (rappels) => jourEntrainement(rappels) && maintenant() >= minutes(rappels.heureSeance) - 60;

// ---------- Fichier calendrier ----------

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** Date et heure « flottante » au format iCalendar (heure locale de l'iPhone). */
function dateIcs(date, heure) {
  const [h, m] = heure.split(':');
  return `${date.getFullYear()}${deuxChiffres(date.getMonth() + 1)}${deuxChiffres(date.getDate())}T${h}${m}00`;
}

/** Horodatage UTC au format iCalendar. */
const horodatageIcs = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Échappe un texte pour iCalendar. */
const texteIcs = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function evenement({ uid, debut, duree, regle, titre, description, url }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${horodatageIcs()}`,
    `DTSTART:${debut}`,
    `DURATION:${duree}`,
    `RRULE:${regle}`,
    `SUMMARY:${texteIcs(titre)}`,
    `DESCRIPTION:${texteIcs(description)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${texteIcs(titre)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/**
 * Fichier .ics avec deux événements récurrents :
 *  - check-in chaque jour à l'heure choisie ;
 *  - séance les jours d'entraînement à l'heure choisie.
 * Les UID sont fixes : réimporter le fichier met à jour les rappels au lieu de les dupliquer
 * (selon l'application Calendrier ; sinon, supprimer les anciens événements avant).
 */
export function fichierCalendrier(rappels) {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const url = location.href.split('#')[0];
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Athletics//Rappels//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Athletics',
    ...evenement({
      uid: 'athletics-checkin@athletics.local',
      debut: dateIcs(demain, rappels.heureCheckin),
      duree: 'PT10M',
      regle: 'FREQ=DAILY',
      titre: 'Check-in Athletics',
      description: 'Séance, sommeil, alimentation, cigarettes : moins de 30 secondes.',
      url,
    }),
  ];
  if (rappels.jours.length) {
    lignes.push(...evenement({
      uid: 'athletics-seance@athletics.local',
      debut: dateIcs(demain, rappels.heureSeance),
      duree: 'PT1H',
      regle: `FREQ=WEEKLY;BYDAY=${rappels.jours.map((j) => CODES_ICS[j]).join(',')}`,
      titre: 'Séance Athletics',
      description: 'Ouvre Athletics, onglet Séances, puis Démarrer.',
      url,
    }));
  }
  lignes.push('END:VCALENDAR');
  const texte = `${lignes.join('\r\n')}\r\n`;
  return new File([texte], 'athletics-rappels.ics', { type: 'text/calendar' });
}
