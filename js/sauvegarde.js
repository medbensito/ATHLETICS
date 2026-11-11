/*
 * Sauvegarde : export de toutes les données dans un fichier JSON, et import de ce fichier.
 *
 * Format du fichier :
 * {
 *   "application": "athletics",
 *   "format": 1,                      ← version du format, pour les imports futurs
 *   "versionApp": "0.2.0",
 *   "exporteLe": "2026-11-11T18:30:00.000Z",
 *   "donnees": { "checkins": [...], "reglages": [...] }
 * }
 */

import { MAGASINS, lireTout, lireReglage, ecrireReglage, remplacerTout } from './db.js';
import { cleJour, joursEntre } from './dates.js';
import { VERSION_APP } from './version.js';

export const FORMAT_EXPORT = 1;

/** Rassemble toutes les données et prépare le fichier (sans le déclencher). */
export async function preparerExport() {
  const donnees = {};
  for (const magasin of MAGASINS) donnees[magasin] = await lireTout(magasin);

  const contenu = {
    application: 'athletics',
    format: FORMAT_EXPORT,
    versionApp: VERSION_APP,
    exporteLe: new Date().toISOString(),
    donnees,
  };
  const texte = JSON.stringify(contenu, null, 2);
  const nom = `athletics-sauvegarde-${cleJour()}.json`;
  return { nom, texte, fichier: new File([texte], nom, { type: 'application/json' }) };
}

/**
 * Remet le fichier à l'utilisateur.
 *  - Sur iPhone : feuille de partage (« Enregistrer dans Fichiers », AirDrop, Mail…)
 *  - Ailleurs : téléchargement classique
 * Renvoie 'partage', 'telechargement' ou 'annule'.
 *
 * À appeler directement dans le gestionnaire du clic, avec un export déjà préparé :
 * Safari refuse d'ouvrir la feuille de partage si trop de temps s'écoule après le geste.
 */
export async function remettreExport({ nom, fichier }) {
  let resultat = null;

  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: 'Sauvegarde Athletics' });
      resultat = 'partage';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'annule'; // feuille refermée : rien n'a été sauvegardé
      // Autre erreur : on se rabat sur le téléchargement.
    }
  }

  if (!resultat) {
    const url = URL.createObjectURL(fichier);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    resultat = 'telechargement';
  }

  await ecrireReglage('dernierExport', new Date().toISOString());
  return resultat;
}

// ---------- Import ----------

/** Clé principale de chaque magasin : chaque enregistrement importé doit l'avoir. */
const CLES = { checkins: 'date', reglages: 'cle', seances: 'id', journal: 'id', mesures: 'date' };

/**
 * Lit et vérifie un fichier de sauvegarde, sans rien modifier.
 * Renvoie { contenu, resume } ou lève une erreur au message compréhensible.
 */
export async function lireSauvegarde(fichier) {
  let contenu;
  try {
    contenu = JSON.parse(await fichier.text());
  } catch {
    throw new Error('Ce fichier n\'est pas un fichier JSON lisible.');
  }
  if (!contenu || contenu.application !== 'athletics' || typeof contenu.donnees !== 'object' || contenu.donnees === null) {
    throw new Error('Ce fichier n\'est pas une sauvegarde Athletics.');
  }
  if (typeof contenu.format !== 'number' || contenu.format > FORMAT_EXPORT) {
    throw new Error('Cette sauvegarde vient d\'une version plus récente de l\'app. Mets l\'app à jour avant de l\'importer.');
  }
  for (const magasin of MAGASINS) {
    const liste = contenu.donnees[magasin];
    if (liste === undefined) continue; // sauvegarde d'une version plus ancienne : magasin vide
    if (!Array.isArray(liste) || liste.some((e) => !e || typeof e !== 'object' || e[CLES[magasin]] === undefined)) {
      throw new Error(`La partie « ${magasin} » du fichier est abîmée. Rien n'a été importé.`);
    }
  }
  const n = (m) => (contenu.donnees[m] || []).length;
  return {
    contenu,
    resume: {
      exporteLe: contenu.exporteLe || null,
      versionApp: contenu.versionApp || '?',
      checkins: n('checkins'),
      seances: n('seances'),
      journal: n('journal'),
      mesures: n('mesures'),
    },
  };
}

/** Remplace toutes les données de l'app par celles de la sauvegarde. */
export async function importerSauvegarde(contenu) {
  const donnees = {};
  for (const magasin of MAGASINS) donnees[magasin] = contenu.donnees[magasin] || [];
  await remplacerTout(donnees);
}

/** Nombre de jours depuis le dernier export (null si jamais exporté). */
export async function joursDepuisExport() {
  const dernier = await lireReglage('dernierExport');
  if (!dernier) return null;
  return joursEntre(cleJour(new Date(dernier)), cleJour());
}

/** « aujourd'hui », « hier », « il y a 5 jours » */
export function formatAnciennete(jours) {
  if (jours === null) return 'jamais';
  if (jours <= 0) return 'aujourd\'hui';
  if (jours === 1) return 'hier';
  return `il y a ${jours} jours`;
}
