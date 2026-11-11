/*
 * Programme sur-mesure « Athletics 6 mois » : contenu et suivi des phases.
 *
 * Conçu pour un départ très sédentaire, 5 séances par semaine en salle,
 * avec un objectif mixte : perte de graisse, muscle visible, force et endurance.
 *
 * Principes :
 *  - 3 phases sur 26 semaines : Fondations (1–4), Construction (5–12), Performance (13–26).
 *  - Répartition Push / Pull / Legs / Upper / Lower :
 *    mardi, mercredi, jeudi, samedi, dimanche (repos lundi et vendredi).
 *  - Cardio en zone 2 en fin de séance ; intervalles le samedi à partir de la phase 2.
 *  - Progression double : quand toutes les séries atteignent les répétitions visées,
 *    l'app propose + 2,5 kg à la séance suivante.
 *  - Semaines allégées (8, 16, 24) : une série de moins, même charge, pour récupérer.
 *
 * Réglage « plan » : { id: 'athletics-6m', version: 2, debut: '2026-11-09' (un lundi), phase: 1 }
 * version 1 = programme 1.1 (3 muscu + 2 cardio), version 2 = Push / Pull / Legs / Upper / Lower.
 * Les séances de la phase sont écrites dans le magasin « seances », chacune avec son jour : elles restent
 * entièrement modifiables. Le journal (séances réalisées) n'est jamais touché.
 */

import { lireReglage, ecrireReglage, lireTout, supprimer, ecrire } from './db.js';
import { cleJour, joursEntre } from './dates.js';
import { lundi } from './bilan.js';
import { nouvelleSeance, nouvelId } from './programme.js';

export const ID_PLAN = 'athletics-6m';
export const DUREE_SEMAINES = 26;
export const SEMAINES_ALLEGEES = [8, 16, 24];
export const VERSION_PLAN = 2;

/** Jours d'entraînement du programme (0 = dimanche) : mar, mer, jeu, sam, dim. */
export const JOURS_PLAN = [2, 3, 4, 6, 0];

/**
 * Exercice du plan. unite : 'reps' (répétitions), 's' (secondes) ou 'min' (minutes).
 * sansCharge : pas de champ de charge en séance, et pas de série retirée en semaine allégée (cardio).
 */
const ex = (nom, series, reps, repos, consigne = '', unite = 'reps', sansCharge = false) =>
  ({ nom, series, reps, repos, consigne, unite, sansCharge });

/** Cardio en fin de séance, allure facile (zone 2). */
const cardio = (minutes) => ex('Cardio zone 2 (vélo, rameur ou marche inclinée)', 1, minutes, 0,
  'Tu peux parler en phrases complètes. C\'est l\'allure qui sollicite le plus les graisses.', 'min', true);

/** Intervalles : séries de 30 s rapides ; le chronomètre de repos sert de phase lente. */
const intervalles = (nombre, repos) => ex('Intervalles vélo ou rameur', nombre, 30, repos,
  `30 secondes soutenues (parler devient difficile), puis ${repos} secondes lentes pendant le repos : continue à pédaler doucement.`, 's', true);

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
    objectif: 'Apprendre les mouvements, habituer le corps à l\'effort, installer la routine. 3 séries, charges confortables : finir chaque série avec 2 à 3 répétitions encore possibles.',
    seances: [
      {
        nom: 'Push · poussée',
        description: 'Mardi · pectoraux, épaules, triceps.',
        exercices: [
          echauffement,
          ex('Développé couché haltères', 3, 10, 90, 'Omoplates serrées, descendre les haltères au niveau de la poitrine.'),
          ex('Développé militaire haltères assis', 3, 10, 90, 'Dos collé au dossier, pousser au-dessus de la tête sans cambrer.'),
          ex('Développé incliné machine', 3, 12, 90, 'Banc à 30°. Haltères si pas de machine.'),
          ex('Élévations latérales', 3, 12, 60, 'Coudes légèrement fléchis, monter jusqu\'à l\'horizontale, sans élan.'),
          ex('Extension triceps poulie', 3, 12, 60, 'Coudes collés au corps.'),
          cardio(15),
        ],
      },
      {
        nom: 'Pull · tirage',
        description: 'Mercredi · dos, arrière d\'épaules, biceps.',
        exercices: [
          echauffement,
          ex('Tirage vertical', 3, 10, 90, 'Tirer la barre vers le haut de la poitrine, coudes vers le bas.'),
          ex('Tirage horizontal poulie', 3, 10, 90, 'Poitrine haute, tirer vers le nombril.'),
          ex('Rowing haltère un bras', 3, 10, 60, 'Répétitions par bras. Tirer le coude vers la hanche.'),
          ex('Face pull', 3, 15, 60, 'Corde vers le front, coudes hauts : bon pour la posture.'),
          ex('Curl haltères', 3, 12, 60, 'Sans balancer le buste.'),
          cardio(15),
        ],
      },
      {
        nom: 'Legs · jambes',
        description: 'Jeudi · cuisses, fessiers, mollets, gainage.',
        exercices: [
          echauffement,
          ex('Goblet squat', 3, 10, 90, 'Haltère contre la poitrine, descendre hanches entre les genoux, dos droit.'),
          ex('Presse à cuisses', 3, 12, 90, 'Pieds largeur d\'épaules, ne pas verrouiller les genoux en haut.'),
          ex('Soulevé de terre roumain haltères', 3, 10, 90, 'Genoux légèrement fléchis, pousser les hanches en arrière, dos plat.'),
          ex('Leg curl', 3, 12, 60, 'Mouvement contrôlé, surtout à la descente.'),
          ex('Mollets debout', 3, 15, 60, 'Pause d\'une seconde en haut.'),
          ex('Planche', 3, 30, 60, 'Corps aligné, fessiers et ventre serrés. Sur les genoux si besoin.', 's'),
          cardio(10),
        ],
      },
      {
        nom: 'Upper · haut du corps',
        description: 'Samedi · tout le haut du corps, avec d\'autres angles.',
        exercices: [
          echauffement,
          ex('Pompes', 3, 8, 60, 'Mains sur un banc si c\'est trop dur au sol. Corps gainé.'),
          ex('Tirage vertical prise serrée', 3, 10, 90),
          ex('Développé militaire machine', 3, 10, 90, 'Haltères si pas de machine.'),
          ex('Rowing machine', 3, 10, 90, 'Poitrine contre l\'appui, serrer les omoplates en fin de mouvement.'),
          ex('Dips assistés', 2, 10, 90, 'Machine assistée. Descendre sans douleur aux épaules.'),
          ex('Curl marteau', 2, 12, 60),
          cardio(15),
        ],
      },
      {
        nom: 'Lower · bas du corps',
        description: 'Dimanche · fessiers et ischios en priorité, gainage.',
        exercices: [
          echauffement,
          ex('Fentes arrière haltères', 3, 8, 90, 'Répétitions par jambe. Genou avant au-dessus du pied.'),
          ex('Hip thrust', 3, 10, 90, 'Haut du dos sur le banc, serrer les fessiers en haut une seconde.'),
          ex('Leg extension', 3, 12, 60),
          ex('Leg curl', 3, 12, 60),
          ex('Dead bug', 3, 10, 45, 'Répétitions par côté. Bas du dos plaqué au sol en permanence.'),
          ex('Gainage latéral', 3, 20, 45, 'Secondes par côté. Hanches hautes.', 's'),
          cardio(15),
        ],
      },
    ],
  },
  {
    numero: 2,
    nom: 'Construction',
    semaines: [5, 12],
    objectif: 'Construire du muscle et de la force : 4 séries sur les mouvements principaux, charges en progression, premiers intervalles le samedi. Finir chaque série avec 1 à 2 répétitions encore possibles.',
    seances: [
      {
        nom: 'Push · poussée',
        description: 'Mardi · pectoraux, épaules, triceps.',
        exercices: [
          echauffement,
          ex('Développé couché', 4, 8, 120, 'Barre au bas des pectoraux, pieds ancrés au sol, omoplates serrées.'),
          ex('Développé militaire haltères assis', 3, 10, 90),
          ex('Développé incliné haltères', 3, 10, 90, 'Banc à 30°.'),
          ex('Élévations latérales', 3, 15, 60),
          ex('Dips assistés', 3, 10, 90),
          ex('Extension triceps poulie', 2, 12, 60),
          cardio(20),
        ],
      },
      {
        nom: 'Pull · tirage',
        description: 'Mercredi · dos, arrière d\'épaules, biceps.',
        exercices: [
          echauffement,
          ex('Tirage vertical', 4, 8, 90, 'Contrôler la remontée.'),
          ex('Rowing barre', 4, 8, 90, 'Buste penché à 45°, dos plat, tirer vers le nombril.'),
          ex('Tirage horizontal poulie', 3, 10, 90),
          ex('Face pull', 3, 15, 60),
          ex('Curl barre', 3, 10, 60),
          ex('Curl marteau', 2, 12, 60),
          cardio(20),
        ],
      },
      {
        nom: 'Legs · jambes',
        description: 'Jeudi · cuisses, fessiers, mollets, abdos.',
        exercices: [
          echauffement,
          ex('Squat barre', 4, 8, 150, 'Goblet squat si la technique n\'est pas encore sûre. Descendre sous contrôle.'),
          ex('Soulevé de terre roumain barre', 4, 8, 120, 'Barre près des jambes, dos plat.'),
          ex('Presse à cuisses', 3, 12, 90),
          ex('Leg curl', 3, 12, 60),
          ex('Mollets debout', 4, 12, 60),
          ex('Relevés de genoux suspendu', 3, 10, 60, 'Sans élan. Au sol (relevés de jambes) si besoin.'),
          cardio(10),
        ],
      },
      {
        nom: 'Upper · haut du corps',
        description: 'Samedi · haut du corps et intervalles.',
        exercices: [
          echauffement,
          ex('Développé militaire barre', 4, 8, 120, 'Debout, fessiers serrés, barre au-dessus de la tête.'),
          ex('Tractions assistées', 4, 8, 120, 'Machine assistée ou élastique. Menton au-dessus de la barre.'),
          ex('Développé couché haltères', 3, 10, 90),
          ex('Rowing haltère un bras', 3, 10, 60, 'Répétitions par bras.'),
          ex('Élévations latérales', 3, 15, 60),
          intervalles(8, 90),
        ],
      },
      {
        nom: 'Lower · bas du corps',
        description: 'Dimanche · fessiers, ischios, conditionnement.',
        exercices: [
          echauffement,
          ex('Hip thrust barre', 4, 10, 90, 'Pause d\'une seconde en haut.'),
          ex('Fentes marchées haltères', 3, 10, 90, 'Répétitions par jambe.'),
          ex('Leg extension', 3, 12, 60),
          ex('Leg curl', 3, 12, 60),
          ex('Kettlebell swing', 3, 15, 60, 'Le mouvement vient des hanches, pas des bras. Dos plat.'),
          ex('Planche', 3, 45, 60, '', 's'),
          cardio(20),
        ],
      },
    ],
  },
  {
    numero: 3,
    nom: 'Performance',
    semaines: [13, 26],
    objectif: 'Force et définition : charges lourdes sur les mouvements de base (5 × 5), volume sur le reste, intervalles plus intenses. Finir les séries de 5 avec 1 à 2 répétitions encore possibles.',
    seances: [
      {
        nom: 'Push · poussée',
        description: 'Mardi · force en développé couché.',
        exercices: [
          echauffement,
          ex('Développé couché', 5, 5, 180, 'Charge lourde, technique impeccable. Un partenaire ou des sécurités.'),
          ex('Développé militaire barre', 4, 6, 120),
          ex('Développé incliné haltères', 3, 8, 90),
          ex('Dips', 3, 8, 90, 'Assistés si besoin.'),
          ex('Élévations latérales', 4, 15, 45),
          ex('Extension triceps poulie', 3, 12, 60),
          cardio(20),
        ],
      },
      {
        nom: 'Pull · tirage',
        description: 'Mercredi · force en tractions et rowing.',
        exercices: [
          echauffement,
          ex('Tractions', 5, 5, 150, 'Assistées si besoin ; lestées quand 5 × 5 passent au poids du corps.'),
          ex('Rowing barre', 4, 6, 120),
          ex('Tirage horizontal poulie', 3, 10, 90),
          ex('Face pull', 3, 15, 60),
          ex('Curl incliné haltères', 3, 10, 60),
          ex('Curl marteau', 3, 12, 60),
          cardio(20),
        ],
      },
      {
        nom: 'Legs · jambes',
        description: 'Jeudi · force en squat.',
        exercices: [
          echauffement,
          ex('Squat barre', 5, 5, 180),
          ex('Soulevé de terre roumain barre', 3, 8, 120),
          ex('Fentes bulgares haltères', 3, 8, 90, 'Répétitions par jambe. Pied arrière sur un banc.'),
          ex('Leg curl', 3, 10, 60),
          ex('Mollets debout', 4, 12, 60),
          ex('Roue abdominale', 3, 10, 60, 'À genoux, amplitude limitée au début. Relevés de jambes si besoin.'),
          cardio(10),
        ],
      },
      {
        nom: 'Upper · haut du corps',
        description: 'Samedi · volume haut du corps et intervalles.',
        exercices: [
          echauffement,
          ex('Développé couché haltères', 4, 8, 90),
          ex('Tirage vertical', 4, 8, 90),
          ex('Développé militaire haltères assis', 3, 10, 90),
          ex('Rowing haltère un bras', 3, 10, 60, 'Répétitions par bras.'),
          ex('Élévations latérales', 3, 15, 45),
          intervalles(10, 60),
        ],
      },
      {
        nom: 'Lower · bas du corps',
        description: 'Dimanche · force en soulevé de terre, conditionnement.',
        exercices: [
          echauffement,
          ex('Soulevé de terre', 4, 5, 180, 'Barre contre les tibias, pousser le sol, dos plat du début à la fin.'),
          ex('Hip thrust barre', 4, 8, 90),
          ex('Presse à cuisses', 3, 12, 90),
          ex('Leg extension', 3, 12, 60),
          ex('Kettlebell swing', 4, 15, 60),
          ex('Marche du fermier', 3, 40, 60, 'Haltères lourds, épaules basses, buste droit.', 's'),
          cardio(15),
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
      repos: e.repos, unite: e.unite, consigne: e.consigne, sansCharge: e.sansCharge,
    })));
    seance.description = def.description;
    seance.jour = JOURS_PLAN[ordre - 1] ?? null; // mar, mer, jeu, sam, dim
    await ecrire('seances', seance);
    ordre += 1;
  }
  const actuel = await lirePlan();
  await ecrireReglage('plan', {
    id: ID_PLAN,
    version: VERSION_PLAN,
    debut: debut || (actuel && actuel.debut) || lundi(cleJour()),
    phase: numero,
  });
  // Les rappels de séance suivent les jours du programme (les heures ne changent pas).
  const rappels = await lireReglage('rappels', {});
  await ecrireReglage('rappels', { ...rappels, jours: JOURS_PLAN });
}

/** Vrai si le programme adopté date d'une version précédente (séances à mettre à jour). */
export const planAncien = (plan) => Boolean(plan) && (plan.version || 1) < VERSION_PLAN;

/** Démarre le plan : semaine 1 = semaine en cours (à partir de son lundi), phase 1. */
export const demarrerPlan = () => appliquerPhase(1, lundi(cleJour()));
