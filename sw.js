/*
 * Service worker — fonctionnement hors ligne.
 *
 * Stratégie :
 *  1. À l'installation, on met en cache toute la « coquille » de l'app (liste FICHIERS).
 *  2. Ensuite, chaque requête est servie depuis le cache immédiatement (rapide, hors ligne),
 *     et rafraîchie en arrière-plan quand le réseau est là (« stale-while-revalidate »).
 *     Une modification déployée est donc visible au 2e lancement.
 *
 * IMPORTANT : à chaque mise en ligne d'une nouvelle version, incrémenter VERSION
 * (et ajouter tout nouveau fichier à FICHIERS). Cela purge l'ancien cache.
 *
 * Les données de l'utilisateur ne sont PAS ici : elles vivent dans IndexedDB
 * et ne sont jamais touchées par ce fichier.
 */

const VERSION = 'v3.1.0';
const CACHE = `athletics-${VERSION}`;

// Chemins relatifs : l'app fonctionne aussi dans un sous-dossier (ex. GitHub Pages).
const FICHIERS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './fonts/inter-tight-latin-400-normal.woff2',
  './fonts/inter-tight-latin-500-normal.woff2',
  './fonts/inter-tight-latin-600-normal.woff2',
  './fonts/inter-tight-latin-700-normal.woff2',
  './fonts/big-shoulders-display-latin-700-normal.woff2',
  './fonts/big-shoulders-display-latin-800-normal.woff2',
  './fonts/big-shoulders-display-latin-900-normal.woff2',
  './js/app.js',
  './js/version.js',
  './js/icones.js',
  './js/db.js',
  './js/dates.js',
  './js/plateforme.js',
  './js/ui.js',
  './js/sauvegarde.js',
  './js/programme.js',
  './js/corps.js',
  './js/graphique.js',
  './js/bilan.js',
  './js/rappels.js',
  './js/plan.js',
  './js/seance-du-jour.js',
  './js/alternatives.js',
  './js/records.js',
  './js/progression.js',
  './js/phase.js',
  './js/vues/phase.js',
  './js/piste.js',
  './js/vues/fin-seance.js',
  './js/vues/checkin.js',
  './js/vues/reglages.js',
  './js/vues/seances.js',
  './js/vues/seance-en-cours.js',
  './js/vues/exercice.js',
  './js/vues/corps.js',
  './js/vues/bilan.js',
  './js/vues/calendrier.js',
  './js/vues/records.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// Installation : pré-cache de la coquille.
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' évite de recopier une vieille version depuis le cache HTTP du navigateur
      .then((cache) => cache.addAll(FICHIERS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Activation : suppression des caches des versions précédentes.
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(
        cles.filter((c) => c.startsWith('athletics-') && c !== CACHE).map((c) => caches.delete(c))
      ))
      .then(() => self.clients.claim())
  );
});

// Requêtes : cache d'abord, mise à jour en arrière-plan.
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // aucun service tiers n'est utilisé

  evt.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // Toute navigation renvoie la page unique de l'app.
    const cle = req.mode === 'navigate' ? './index.html' : req;
    const enCache = await cache.match(cle, { ignoreSearch: true });

    const reseau = fetch(req)
      .then((rep) => {
        if (rep && rep.ok && rep.type === 'basic') cache.put(cle, rep.clone());
        return rep;
      })
      .catch(() => null);

    if (enCache) {
      evt.waitUntil(reseau); // laisse la mise à jour se terminer
      return enCache;
    }
    const rep = await reseau;
    return rep || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
