/*
 * Alternatives d'exercices : pour remplacer un exercice en pleine séance
 * (machine occupée, matériel absent, gêne sur un mouvement).
 *
 * Les exercices sont rangés par groupes de mouvements équivalents.
 * Les alternatives d'un exercice = les autres membres de ses groupes.
 * unite : 'reps' par défaut, 's' (secondes) ou 'min' (minutes) ; sansCharge pour le cardio.
 */

const e = (nom, consigne = '', unite = 'reps', sansCharge = false) => ({ nom, consigne, unite, sansCharge });

const GROUPES = [
  // Pectoraux
  [e('Développé couché', 'Barre au bas des pectoraux, omoplates serrées.'), e('Développé couché haltères'), e('Développé couché machine'),
    e('Développé couché à la Smith machine'), e('Pompes', 'Mains sur un banc si c\'est trop dur au sol.')],
  [e('Développé incliné haltères', 'Banc à 30°.'), e('Développé incliné machine'), e('Développé incliné barre'),
    e('Développé incliné à la Smith machine'), e('Pompes pieds surélevés')],
  [e('Écarté poulie vis-à-vis'), e('Pec deck (butterfly)'), e('Écarté haltères')],
  // Épaules
  [e('Développé militaire haltères assis'), e('Développé militaire barre', 'Debout, fessiers serrés.'), e('Développé militaire machine'),
    e('Développé Arnold'), e('Développé militaire à la Smith machine')],
  [e('Élévations latérales'), e('Élévations latérales poulie', 'Un bras à la fois, câble derrière le corps.'), e('Élévations latérales machine')],
  [e('Face pull'), e('Oiseau haltères', 'Buste penché, bras légèrement fléchis.'), e('Reverse fly machine')],
  // Triceps
  [e('Extension triceps poulie'), e('Extension triceps corde'), e('Extension triceps haltère au-dessus de la tête'),
    e('Barre au front'), e('Pompes serrées')],
  [e('Dips'), e('Dips assistés'), e('Développé couché prise serrée'), e('Pompes serrées')],
  // Dos
  [e('Tirage vertical'), e('Tirage vertical prise serrée'), e('Tractions'), e('Tractions assistées'), e('Tirage vertical un bras')],
  [e('Rowing barre'), e('Rowing haltère un bras'), e('Tirage horizontal poulie'), e('Rowing machine'), e('Rowing T-bar'),
    e('Rowing haltères buste appuyé', 'Poitrine sur un banc incliné.')],
  // Biceps
  [e('Curl haltères'), e('Curl barre'), e('Curl marteau'), e('Curl incliné haltères'), e('Curl poulie'), e('Curl pupitre')],
  // Jambes
  [e('Squat barre'), e('Goblet squat'), e('Hack squat'), e('Squat à la Smith machine'), e('Presse à cuisses')],
  [e('Presse à cuisses'), e('Hack squat'), e('Goblet squat'), e('Squat à la Smith machine'), e('Presse à cuisses unilatérale')],
  [e('Soulevé de terre'), e('Soulevé de terre trap bar'), e('Soulevé de terre roumain barre')],
  [e('Soulevé de terre roumain barre'), e('Soulevé de terre roumain haltères'), e('Good morning'), e('Hyperextensions'),
    e('Soulevé de terre roumain à la Smith machine')],
  [e('Fentes arrière haltères', 'Répétitions par jambe.'), e('Fentes marchées haltères', 'Répétitions par jambe.'),
    e('Fentes bulgares haltères', 'Répétitions par jambe.'), e('Step-up sur banc', 'Répétitions par jambe.'), e('Fentes à la Smith machine')],
  [e('Hip thrust'), e('Hip thrust barre'), e('Hip thrust machine'), e('Pont fessier au sol'), e('Kickback fessier poulie')],
  [e('Leg curl'), e('Leg curl assis'), e('Leg curl allongé'), e('Nordic curl assisté')],
  [e('Leg extension'), e('Presse à cuisses pieds bas'), e('Sissy squat assisté')],
  [e('Mollets debout'), e('Mollets assis'), e('Mollets à la presse'), e('Mollets sur marche')],
  // Gainage et abdominaux
  [e('Planche', 'Corps aligné, ventre serré.', 's'), e('Gainage latéral', 'Secondes par côté.', 's'), e('Dead bug', 'Répétitions par côté.'),
    e('Bird dog', 'Répétitions par côté.'), e('Pallof press', 'Répétitions par côté.')],
  [e('Relevés de genoux suspendu'), e('Relevés de jambes au sol'), e('Roue abdominale'), e('Crunch poulie'), e('Dead bug', 'Répétitions par côté.')],
  // Conditionnement
  [e('Kettlebell swing'), e('Swing haltère'), e('Hyperextensions'), e('Burpees')],
  [e('Marche du fermier', '', 's'), e('Marche valise un bras', 'Secondes par côté.', 's'), e('Tenue de barre lourde', '', 's')],
  // Cardio
  [e('Cardio zone 2 (vélo, rameur ou marche inclinée)', 'Tu peux parler en phrases complètes.', 'min', true),
    e('Elliptique zone 2', '', 'min', true), e('Marche rapide en extérieur', '', 'min', true), e('Vélo zone 2', '', 'min', true),
    e('Rameur zone 2', '', 'min', true)],
  [e('Intervalles vélo ou rameur', '30 s soutenues, phase lente pendant le repos.', 's', true),
    e('Intervalles elliptique', '', 's', true), e('Intervalles corde à sauter', '', 's', true), e('Intervalles assault bike', '', 's', true)],
  [e('Échauffement vélo ou rameur', '', 'min', true), e('Échauffement elliptique', '', 'min', true),
    e('Échauffement corde à sauter', '', 'min', true), e('Échauffement marche inclinée', '', 'min', true)],
];

const normaliser = (nom) => String(nom || '').trim().toLowerCase();

/** Alternatives proposées pour un exercice (sans doublon, sans l'exercice lui-même). */
export function alternatives(nom) {
  const cle = normaliser(nom);
  const vues = new Set([cle]);
  const resultat = [];
  for (const groupe of GROUPES) {
    if (!groupe.some((x) => normaliser(x.nom) === cle)) continue;
    for (const x of groupe) {
      if (vues.has(normaliser(x.nom))) continue;
      vues.add(normaliser(x.nom));
      resultat.push(x);
    }
  }
  return resultat;
}
