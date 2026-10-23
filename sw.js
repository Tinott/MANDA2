// Service worker minimal — sa seule raison d'être ici est de rendre l'app
// éligible à l'installation ("Ajouter à l'écran d'accueil" / bouton
// "Installer" dans le navigateur). Il ne met rien en cache : toute requête
// part normalement sur le réseau, pour ne jamais servir une version
// périmée de l'app.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Intentionnellement vide — laisse le navigateur gérer la requête
  // normalement (nécessaire uniquement pour satisfaire les critères
  // d'installabilité, pas pour du cache hors-ligne).
});
