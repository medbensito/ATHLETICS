/*
 * Accès à IndexedDB — toutes les données de l'utilisateur vivent ici, sur l'appareil.
 *
 * Magasins (équivalent de tables) :
 *   - checkins : un enregistrement par jour, clé = date « AAAA-MM-JJ »
 *   - reglages : paires clé / valeur (ex. date du dernier export)
 *   - seances  : le programme d'entraînement (voir js/programme.js)
 *   - journal  : les séances réalisées (voir js/programme.js)
 *
 * Pour ajouter un magasin dans un jalon futur :
 *   1. incrémenter VERSION_DB
 *   2. ajouter un bloc « if (ancienne < N) » dans migrer()
 *   3. l'ajouter à MAGASINS (il sera alors inclus dans l'export JSON)
 */

const NOM_DB = 'athletics';
const VERSION_DB = 2;

/** Liste des magasins, utilisée par l'export. */
export const MAGASINS = ['checkins', 'reglages', 'seances', 'journal'];

/** Crée ou fait évoluer la structure. Ne supprime jamais de données. */
function migrer(db, ancienne) {
  if (ancienne < 1) {
    db.createObjectStore('checkins', { keyPath: 'date' });
    db.createObjectStore('reglages', { keyPath: 'cle' });
  }
  if (ancienne < 2) { // J3 : programme et journal des séances
    db.createObjectStore('seances', { keyPath: 'id' });
    db.createObjectStore('journal', { keyPath: 'id' });
  }
}

let connexion = null;

/** Ouvre la base (une seule fois) et renvoie la connexion. */
function ouvrir() {
  if (connexion) return connexion;
  connexion = new Promise((resoudre, rejeter) => {
    if (!('indexedDB' in window)) {
      rejeter(new Error('IndexedDB indisponible dans ce navigateur.'));
      return;
    }
    const demande = indexedDB.open(NOM_DB, VERSION_DB);
    demande.onupgradeneeded = (evt) => migrer(demande.result, evt.oldVersion);
    demande.onsuccess = () => {
      const db = demande.result;
      // Si une version plus récente de l'app s'ouvre ailleurs, on libère la base.
      db.onversionchange = () => { db.close(); connexion = null; };
      resoudre(db);
    };
    demande.onerror = () => rejeter(demande.error);
    demande.onblocked = () => rejeter(new Error('Base de données bloquée par une autre fenêtre de l\'app.'));
  }).catch((err) => {
    connexion = null; // permet de réessayer plus tard
    throw err;
  });
  return connexion;
}

/** Exécute une opération dans une transaction et renvoie son résultat. */
async function transaction(magasin, mode, operation) {
  const db = await ouvrir();
  return new Promise((resoudre, rejeter) => {
    const tx = db.transaction(magasin, mode);
    const demande = operation(tx.objectStore(magasin));
    // On attend la fin de la transaction : la donnée est alors réellement écrite.
    tx.oncomplete = () => resoudre(demande ? demande.result : undefined);
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error || new Error('Écriture interrompue.'));
  });
}

/** Lit un enregistrement par sa clé (undefined s'il n'existe pas). */
export const lire = (magasin, cle) => transaction(magasin, 'readonly', (s) => s.get(cle));

/** Lit tous les enregistrements d'un magasin, triés par clé. */
export const lireTout = (magasin) => transaction(magasin, 'readonly', (s) => s.getAll());

/** Crée ou remplace un enregistrement. */
export const ecrire = (magasin, valeur) => transaction(magasin, 'readwrite', (s) => s.put(valeur));

/** Supprime un enregistrement par sa clé. */
export const supprimer = (magasin, cle) => transaction(magasin, 'readwrite', (s) => s.delete(cle));

/** Compte les enregistrements d'un magasin. */
export const compter = (magasin) => transaction(magasin, 'readonly', (s) => s.count());

// ---------- Raccourcis pour les réglages (clé / valeur) ----------

export async function lireReglage(cle, parDefaut = null) {
  const ligne = await lire('reglages', cle);
  return ligne ? ligne.valeur : parDefaut;
}

export const ecrireReglage = (cle, valeur) => ecrire('reglages', { cle, valeur });
