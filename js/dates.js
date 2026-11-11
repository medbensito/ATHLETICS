/*
 * Utilitaires de dates et de durées.
 * Une journée est identifiée par sa « clé » locale : « AAAA-MM-JJ ».
 */

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** Clé du jour pour une date (heure locale de l'appareil). */
export function cleJour(date = new Date()) {
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
}

/** Vrai si le texte est une clé de jour valide. */
export function estCleJour(texte) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte || '')) return false;
  return cleJour(depuisCle(texte)) === texte;
}

/** Date (à midi, pour éviter les pièges de changement d'heure) à partir d'une clé. */
export function depuisCle(cle) {
  const [a, m, j] = cle.split('-').map(Number);
  return new Date(a, m - 1, j, 12);
}

/** Clé décalée de n jours (n négatif = passé). */
export function decalerJour(cle, n) {
  const d = depuisCle(cle);
  d.setDate(d.getDate() + n);
  return cleJour(d);
}

/** Nombre de jours entiers entre deux clés (b - a). */
export function joursEntre(a, b) {
  return Math.round((depuisCle(b) - depuisCle(a)) / 86400000);
}

const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** « mercredi 11 novembre » */
export function dateLongue(cle) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(depuisCle(cle));
}

/** « Mer. 11 nov. » */
export function dateCourte(cle) {
  return majuscule(new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(depuisCle(cle)));
}

/** Nom d'un jour par rapport à aujourd'hui : « Aujourd'hui », « Hier » ou date courte. */
export function nomJour(cle) {
  const ecart = joursEntre(cle, cleJour());
  if (ecart === 0) return 'Aujourd\'hui';
  if (ecart === 1) return 'Hier';
  return dateCourte(cle);
}

/** Convertit « HH:MM » en minutes depuis minuit (null si invalide). */
function minutes(heure) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Durée de sommeil en minutes entre le coucher et le lever.
 * Si le lever est « avant » le coucher (23:30 → 07:00), la nuit passe minuit.
 */
export function dureeSommeil(coucher, lever) {
  const c = minutes(coucher);
  const l = minutes(lever);
  if (c === null || l === null) return null;
  let duree = l - c;
  if (duree <= 0) duree += 24 * 60;
  return duree;
}

/** « 7 h 30 » */
export function formatDuree(min) {
  if (min === null || min === undefined) return '';
  return `${Math.floor(min / 60)} h ${deuxChiffres(min % 60)}`;
}
