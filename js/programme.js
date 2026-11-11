/*
 * Programme d'entraînement et journal des séances : données et calculs.
 *
 * Magasin « seances » — le programme (ce qui est prévu) :
 * {
 *   id, ordre, nom: 'Jambes',
 *   exercices: [{ id, nom: 'Squat', series: 4, reps: 8, charge: 60 | null, repos: 90 }]
 * }
 * charge : en kg, null = poids du corps ou non défini. repos : en secondes.
 *
 * Magasin « journal » — les séances réalisées (ce qui a été fait) :
 * {
 *   id, date: '2026-11-11', seanceId, nomSeance, debut, fin,   ← fin = null tant que la séance est en cours
 *   exercices: [{ exerciceId, nom, repos, cible: { series, reps, charge },
 *                 series: [{ charge, reps, fait }] }],
 *   courant: 0,            ← exercice affiché (séance en cours uniquement)
 *   reposFin: 1794420652528 | null   ← heure de fin du repos en cours
 * }
 * Le journal recopie les noms : modifier le programme ne réécrit jamais le passé.
 */

import { lireTout, ecrire } from './db.js';
import { cleJour } from './dates.js';

export const REPOS_DEFAUT = 90; // secondes
export const PAS_CHARGE = 2.5;  // kg ajoutés ou retirés par appui

export const nouvelId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const nouvelExercice = (nom = '', series = 3, reps = 10) =>
  ({ id: nouvelId(), nom, series, reps, charge: null, repos: REPOS_DEFAUT });

export const nouvelleSeance = (nom, ordre, exercices = []) =>
  ({ id: nouvelId(), ordre, nom, exercices });

// ---------- Nombres ----------

/** « 62,5 » : charge avec virgule française, sans zéro inutile. */
export const formatCharge = (n) => (n === null || n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/** « 60 kg × 8 » ou « × 12 » sans charge. */
export const formatSerie = (s) => (s.charge === null ? `× ${s.reps}` : `${formatCharge(s.charge)} kg × ${s.reps}`);

/** Lit un nombre saisi (virgule ou point). Renvoie null si vide ou invalide. */
export function lireNombre(texte, { entier = false, min = 0, max = 9999 } = {}) {
  const propre = String(texte ?? '').trim().replace(',', '.');
  if (propre === '') return null;
  let n = Number(propre);
  if (!Number.isFinite(n)) return null;
  if (entier) n = Math.round(n);
  return Math.min(max, Math.max(min, n));
}

// ---------- Programme ----------

/** Les séances du programme, dans l'ordre. */
export async function lireProgramme() {
  const seances = await lireTout('seances');
  return seances.sort((a, b) => a.ordre - b.ordre);
}

/** Cinq séances vides à remplir. */
export async function creerSeancesVides() {
  for (let i = 1; i <= 5; i += 1) await ecrire('seances', nouvelleSeance(`Séance ${i}`, i));
}

/**
 * Programme d'exemple : une simple base de départ, entièrement modifiable.
 * Aucune charge n'est proposée : c'est à l'utilisateur de la renseigner.
 */
export async function chargerExemple() {
  const exemple = [
    ['Poussée', [['Développé couché', 4, 8], ['Développé incliné haltères', 3, 10], ['Développé militaire', 3, 10], ['Élévations latérales', 3, 15], ['Extension triceps poulie', 3, 12]]],
    ['Tirage', [['Tirage vertical', 4, 10], ['Rowing barre', 4, 8], ['Tirage horizontal poulie', 3, 10], ['Face pull', 3, 15], ['Curl haltères', 3, 12]]],
    ['Jambes', [['Squat', 4, 8], ['Presse à cuisses', 3, 10], ['Soulevé de terre roumain', 3, 10], ['Leg curl', 3, 12], ['Mollets debout', 3, 15]]],
    ['Haut du corps', [['Développé haltères', 3, 10], ['Tirage vertical prise serrée', 3, 10], ['Pompes', 3, 12], ['Rowing haltère', 3, 10], ['Curl marteau', 3, 12]]],
    ['Bas du corps et abdos', [['Fentes marchées', 3, 12], ['Hip thrust', 3, 10], ['Leg extension', 3, 12], ['Relevés de jambes', 3, 12], ['Crunch poulie', 3, 15]]],
  ];
  let ordre = 1;
  for (const [nom, exercices] of exemple) {
    await ecrire('seances', nouvelleSeance(nom, ordre, exercices.map((e) => nouvelExercice(...e))));
    ordre += 1;
  }
}

// ---------- Journal ----------

const normaliser = (nom) => String(nom || '').trim().toLowerCase();

/** Séries validées d'un exercice du journal. */
const seriesFaites = (exercice) => exercice.series.filter((s) => s.fait);

/** Nombre total de séries validées dans une séance du journal. */
export const compterSeries = (entree) => entree.exercices.reduce((n, e) => n + seriesFaites(e).length, 0);

/** Durée d'une séance terminée, en minutes. */
export const dureeMinutes = (entree) =>
  (entree.fin ? Math.max(1, Math.round((new Date(entree.fin) - new Date(entree.debut)) / 60000)) : null);

/** La séance en cours (non terminée), s'il y en a une. */
export const trouverEnCours = (journal) => journal.find((j) => !j.fin) || null;

/**
 * Historique d'un exercice, du plus ancien au plus récent.
 * On retrouve l'exercice par son identifiant, ou à défaut par son nom.
 * Chaque passage : { date, series: [{ charge, reps }], meilleure (charge max ou null) }
 */
export function historiqueExercice(journal, exerciceId, nom = '') {
  const cle = normaliser(nom);
  const passages = [];
  for (const entree of journal) {
    if (!entree.fin) continue;
    for (const ex of entree.exercices) {
      const correspond = ex.exerciceId === exerciceId || (cle && normaliser(ex.nom) === cle);
      const faites = seriesFaites(ex);
      if (!correspond || faites.length === 0) continue;
      const charges = faites.map((s) => s.charge).filter((c) => c !== null);
      passages.push({
        date: entree.date,
        debut: entree.debut,
        series: faites.map(({ charge, reps }) => ({ charge, reps })),
        meilleure: charges.length ? Math.max(...charges) : null,
      });
    }
  }
  return passages.sort((a, b) => (a.debut < b.debut ? -1 : 1));
}

/**
 * Prépare une nouvelle séance à partir du programme.
 * Chaque série est pré-remplie avec ce qui a été fait la dernière fois
 * (même numéro de série), sinon avec la cible du programme.
 */
export function preparerSeance(seance, journal) {
  return {
    id: nouvelId(),
    date: cleJour(),
    seanceId: seance.id,
    nomSeance: seance.nom || 'Séance',
    debut: new Date().toISOString(),
    fin: null,
    courant: 0,
    reposFin: null,
    exercices: seance.exercices.map((ex, i) => {
      const dernier = historiqueExercice(journal, ex.id, ex.nom).pop();
      const nb = Math.max(1, ex.series || 1);
      const series = Array.from({ length: nb }, (_, n) => {
        const ref = dernier ? dernier.series[Math.min(n, dernier.series.length - 1)] : null;
        return {
          charge: ref ? ref.charge : ex.charge,
          reps: ref ? ref.reps : (ex.reps || 10),
          fait: false,
        };
      });
      return {
        exerciceId: ex.id,
        nom: ex.nom || `Exercice ${i + 1}`,
        repos: ex.repos || REPOS_DEFAUT,
        cible: { series: nb, reps: ex.reps, charge: ex.charge },
        series,
      };
    }),
  };
}

// ---------- Message d'un écran au suivant ----------

let messageEnAttente = '';
export const laisserMessage = (texte) => { messageEnAttente = texte; };
export const prendreMessage = () => { const m = messageEnAttente; messageEnAttente = ''; return m; };
