/*
 * Programme sur-mesure « Athletics 6 mois » : contenu et suivi des phases.
 *
 * Conçu pour un départ très sédentaire, 5 séances par semaine en salle,
 * avec un objectif mixte : perte de graisse, muscle visible, force et endurance.
 *
 * Principes :
 *  - 3 phases sur 26 semaines : Fondations (1–4), Construction (5–12), Performance (13–26).
 *  - Chaque semaine : 3 séances de musculation + 2 séances de cardio.
 *  - Progression double : quand toutes les séries atteignent les répétitions visées,
 *    l'app propose + 2,5 kg à la séance suivante.
 *  - Semaines allégées (8, 16, 24) : une série de moins, même charge, pour récupérer.
 *
 * Réglage « plan » : { id: 'athletics-6m', debut: '2026-11-09' (un lundi), phase: 1 }
 * Les séances de la phase sont écrites dans le magasin « seances » : elles restent
 * entièrement modifiables. Le journal (séances réalisées) n'est jamais touché.
 */

import { lireReglage, ecrireReglage, lireTout, supprimer, ecrire } from './db.js';
import { cleJour, joursEntre } from './dates.js';
import { lundi } from './bilan.js';
import { nouvelleSeance, nouvelId } from './programme.js';

export const ID_PLAN = 'athletics-6m';
export const DUREE_SEMAINES = 26;
export const SEMAINES_ALLEGEES = [8, 16, 24];

/** Exercice du plan. unite : 'reps' (répétitions), 's' (secondes) ou 'min' (minutes). */
const ex = (nom, series, reps, repos, consigne = '', unite = 'reps') =>
  ({ nom, series, reps, repos, consigne, unite });

const echauffement = ex('Échauffement vélo ou rameur', 1, 5, 0,
  'Allure facile, puis une série légère du premier exercice.', 'min');

// ---------------------------------------------------------------------
// Contenu des phases
// ---------------------------------------------------------------------

export const PHASES = [
  {
    numero: 1,
    nom: 'Fondations',
    semaines: [1, 4],
    objectif: 'Apprendre les mouvements, habituer le corps à l\'effort, installer la routine. Charges confortables : finir chaque série avec 2 à 3 répétitions encore possibles.',
    seances: [
      {
        nom: 'Force A · corps entier',
        description: 'Lundi conseillé. Les grands mouvements de base, en douceur.',
        exercices: [
          echauffement,
          ex('Goblet squat', 3, 10, 90, 'Haltère contre la poitrine, descendre hanches entre les genoux, dos droit.'),
          ex('Développé couché haltères', 3, 10, 90, 'Omoplates serrées, descendre les haltères au niveau de la poitrine.'),
          ex('Tirage vertical', 3, 10, 90, 'Tirer la barre vers le haut de la poitrine, coudes vers le bas.'),
          ex('Soulevé de terre roumain haltères', 3, 10, 90, 'Genoux légèrement fléchis, pousser les hanches en arrière, dos plat.'),
          ex('Planche', 3, 30, 60, 'Corps aligné, fessiers et ventre serrés. Sur les genoux si besoin.', 's'),
        ],
      },
      {
        nom: 'Cardio · endurance',
        description: 'Mardi conseillé. Effort facile et long : c\'est lui qui fait fondre la graisse viscérale.',
        exercices: [
          ex('Marche inclinée ou vélo', 1, 30, 0, 'Zone 2 : tu peux parler en phrases complètes. Si tu es essoufflé, ralentis.', 'min'),
          ex('Mobilité hanches et dos', 1, 10, 0, 'Fentes basses, rotations du buste, chat-vache : sans forcer.', 'min'),
        ],
      },
      {
        nom: 'Force B · corps entier',
        description: 'Mercredi conseillé.',
        exercices: [
          echauffement,
          ex('Presse à cuisses', 3, 12, 90, 'Pieds largeur d\'épaules, ne pas verrouiller les genoux en haut.'),
          ex('Rowing haltère un bras', 3, 10, 60, 'Répétitions par bras. Tirer le coude vers la hanche.'),
          ex('Développé militaire haltères assis', 3, 10, 90, 'Dos collé au dossier, pousser au-dessus de la tête sans cambrer.'),
          ex('Hip thrust', 3, 10, 90, 'Haut du dos sur le banc, serrer les fessiers en haut une seconde.'),
          ex('Dead bug', 3, 10, 45, 'Répétitions par côté. Bas du dos plaqué au sol en permanence.'),
        ],
      },
      {
        nom: 'Cardio · endurance et gainage',
        description: 'Jeudi conseillé.',
        exercices: [
          ex('Vélo ou rameur', 1, 30, 0, 'Zone 2 : effort régulier, respiration contrôlée.', 'min'),
          ex('Gainage latéral', 3, 20, 45, 'Secondes par côté. Hanches hautes.', 's'),
          ex('Marche du fermier', 3, 30, 60, 'Haltères lourds mais tenus sans effort de posture : épaules basses, buste droit.', 's'),
        ],
      },
      {
        nom: 'Force C · corps entier',
        description: 'Vendredi conseillé.',
        exercices: [
          echauffement,
          ex('Fentes arrière haltères', 3, 8, 90, 'Répétitions par jambe. Genou avant au-dessus du pied.'),
          ex('Pompes', 3, 8, 60, 'Mains sur un banc si c\'est trop dur au sol. Corps gainé.'),
          ex('Tirage horizontal poulie', 3, 10, 90, 'Poitrine haute, tirer vers le nombril.'),
          ex('Leg curl', 3, 12, 60, 'Mouvement contrôlé, surtout à la descente.'),
          ex('Face pull', 3, 15, 60, 'Corde vers le front, coudes hauts : bon pour la posture.'),
          ex('Marche inclinée', 1, 10, 0, 'Retour au calme, allure facile.', 'min'),
        ],
      },
    ],
  },
  {
    numero: 2,
    nom: 'Construction',
    semaines: [5, 12],
    objectif: 'Construire du muscle et de la force : plus de séries, charges en progression, premiers intervalles. Finir chaque série avec 1 à 2 répétitions encore possibles.',
    seances: [
      {
        nom: 'Haut du corps · force',
        description: 'Lundi conseillé.',
        exercices: [
          echauffement,
          ex('Développé couché', 4, 8, 120, 'Barre au bas des pectoraux, pieds ancrés au sol.'),
          ex('Tirage vertical', 4, 8, 90, 'Contrôler la remontée.'),
          ex('Développé militaire haltères assis', 3, 10, 90),
          ex('Rowing barre', 3, 10, 90, 'Buste penché à 45°, dos plat, tirer vers le nombril.'),
          ex('Curl haltères', 2, 12, 60),
          ex('Extension triceps poulie', 2, 12, 60),
        ],
      },
      {
        nom: 'Cardio · intervalles',
        description: 'Mardi conseillé. Le chrono de repos sert de phase lente : continue à pédaler doucement.',
        exercices: [
          ex('Échauffement vélo ou rameur', 1, 8, 0, 'Montée progressive de l\'allure.', 'min'),
          ex('Intervalle rapide', 8, 1, 120, '1 minute soutenue (parler devient difficile), puis 2 minutes lentes pendant le repos.', 'min'),
          ex('Retour au calme', 1, 5, 0, 'Allure très facile.', 'min'),
        ],
      },
      {
        nom: 'Bas du corps · force',
        description: 'Mercredi conseillé.',
        exercices: [
          echauffement,
          ex('Squat barre', 4, 8, 120, 'Goblet squat si la technique n\'est pas encore sûre. Descendre sous contrôle.'),
          ex('Soulevé de terre roumain barre', 4, 8, 120, 'Barre près des jambes, dos plat.'),
          ex('Presse à cuisses', 3, 12, 90),
          ex('Leg curl', 3, 12, 60),
          ex('Mollets debout', 3, 15, 60, 'Pause d\'une seconde en haut.'),
          ex('Relevés de genoux suspendu', 3, 10, 60, 'Sans élan. Au sol (relevés de jambes) si besoin.'),
        ],
      },
      {
        nom: 'Cardio · endurance',
        description: 'Jeudi conseillé.',
        exercices: [
          ex('Vélo, rameur ou marche inclinée', 1, 40, 0, 'Zone 2 : tu peux parler en phrases complètes.', 'min'),
          ex('Mobilité hanches et dos', 1, 10, 0, '', 'min'),
        ],
      },
      {
        nom: 'Corps entier · athlétique',
        description: 'Vendredi conseillé.',
        exercices: [
          echauffement,
          ex('Fentes marchées haltères', 3, 10, 90, 'Répétitions par jambe.'),
          ex('Pompes', 3, 10, 60),
          ex('Tirage horizontal poulie', 3, 10, 90),
          ex('Hip thrust', 3, 10, 90),
          ex('Kettlebell swing', 3, 15, 60, 'Le mouvement vient des hanches, pas des bras. Dos plat.'),
          ex('Marche du fermier', 3, 40, 60, '', 's'),
          ex('Planche', 3, 45, 60, '', 's'),
        ],
      },
    ],
  },
  {
    numero: 3,
    nom: 'Performance',
    semaines: [13, 26],
    objectif: 'Force, définition et condition physique : charges lourdes sur les mouvements de base, circuits et intervalles plus intenses. Finir les séries de 5 avec 1 à 2 répétitions encore possibles.',
    seances: [
      {
        nom: 'Haut du corps · force',
        description: 'Lundi conseillé.',
        exercices: [
          echauffement,
          ex('Développé couché', 5, 5, 150, 'Charge lourde, technique impeccable. Un partenaire ou des sécurités.'),
          ex('Tractions', 4, 6, 120, 'Machine assistée ou élastique si besoin. Menton au-dessus de la barre.'),
          ex('Développé militaire barre', 4, 6, 120, 'Debout, fessiers serrés, barre au-dessus de la tête.'),
          ex('Rowing barre', 4, 8, 90),
          ex('Dips', 3, 8, 90, 'Machine assistée si besoin. Descendre sans douleur aux épaules.'),
          ex('Curl incliné haltères', 3, 10, 60),
          ex('Face pull', 3, 15, 60),
        ],
      },
      {
        nom: 'Cardio · intervalles',
        description: 'Mardi conseillé.',
        exercices: [
          ex('Échauffement vélo ou rameur', 1, 8, 0, '', 'min'),
          ex('Intervalle rapide', 10, 1, 90, '1 minute intense, puis 1 min 30 lente pendant le repos.', 'min'),
          ex('Retour au calme', 1, 5, 0, '', 'min'),
        ],
      },
      {
        nom: 'Bas du corps · force',
        description: 'Mercredi conseillé.',
        exercices: [
          echauffement,
          ex('Squat barre', 5, 5, 150),
          ex('Soulevé de terre', 4, 5, 150, 'Barre contre les tibias, pousser le sol, dos plat du début à la fin.'),
          ex('Fentes bulgares haltères', 3, 8, 90, 'Répétitions par jambe. Pied arrière sur un banc.'),
          ex('Leg curl', 3, 10, 60),
          ex('Mollets debout', 3, 15, 60),
          ex('Roue abdominale', 3, 10, 60, 'À genoux, amplitude limitée au début. Relevés de jambes si besoin.'),
        ],
      },
      {
        nom: 'Cardio · endurance',
        description: 'Jeudi conseillé.',
        exercices: [
          ex('Vélo, rameur ou marche inclinée', 1, 45, 0, 'Zone 2.', 'min'),
          ex('Mobilité hanches et dos', 1, 10, 0, '', 'min'),
        ],
      },
      {
        nom: 'Corps entier · circuit athlétique',
        description: 'Vendredi conseillé. Enchaîner vite, repos courts.',
        exercices: [
          echauffement,
          ex('Kettlebell swing', 4, 15, 60),
          ex('Pompes', 4, 12, 60),
          ex('Tirage vertical', 4, 10, 60),
          ex('Goblet squat', 3, 12, 60),
          ex('Rameur rapide', 4, 2, 90, '2 minutes soutenues, repos actif.', 'min'),
          ex('Marche du fermier', 3, 40, 60, '', 's'),
          ex('Planche', 3, 60, 60, '', 's'),
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------
// Suivi du plan
// ---------------------------------------------------------------------

export const lirePlan = () => lireReglage('plan');

/** Semaine du plan (1 = première semaine), d'après la date du jour. */
export const semaineDuPlan = (plan, aujourdhui = cleJour()) =>
  Math.floor(joursEntre(plan.debut, aujourdhui) / 7) + 1;

/** Phase prévue pour une semaine donnée (la dernière au-delà de 26 semaines). */
export const phasePourSemaine = (semaine) =>
  PHASES.find((p) => semaine >= p.semaines[0] && semaine <= p.semaines[1]) || PHASES[PHASES.length - 1];

export const phase = (numero) => PHASES.find((p) => p.numero === numero);

export const estSemaineAllegee = (plan, aujourdhui = cleJour()) =>
  Boolean(plan) && SEMAINES_ALLEGEES.includes(semaineDuPlan(plan, aujourdhui));

/**
 * Remplace les séances du programme par celles d'une phase.
 * Le journal n'est pas modifié : l'historique de chaque exercice se retrouve par son nom.
 */
export async function appliquerPhase(numero, debut = null) {
  const p = phase(numero);
  const anciennes = await lireTout('seances');
  for (const s of anciennes) await supprimer('seances', s.id);
  let ordre = 1;
  for (const def of p.seances) {
    const seance = nouvelleSeance(def.nom, ordre, def.exercices.map((e) => ({
      id: nouvelId(), nom: e.nom, series: e.series, reps: e.reps, charge: null,
      repos: e.repos, unite: e.unite, consigne: e.consigne,
    })));
    seance.description = def.description;
    await ecrire('seances', seance);
    ordre += 1;
  }
  const actuel = await lirePlan();
  await ecrireReglage('plan', {
    id: ID_PLAN,
    debut: debut || (actuel && actuel.debut) || lundi(cleJour()),
    phase: numero,
  });
}

/** Démarre le plan : semaine 1 = semaine en cours (à partir de son lundi), phase 1. */
export const demarrerPlan = () => appliquerPhase(1, lundi(cleJour()));
