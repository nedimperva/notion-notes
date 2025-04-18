// Initialize workbox through importScripts without modules
self.importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js'
);

if (!workbox) {
  console.log('Workbox failed to load');
} else {
  workbox.setConfig({ debug: false });
  
  const { registerRoute } = workbox.routing;
  const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;

  // Ensure manifest is properly initialized
  const manifest = self.__WB_MANIFEST || [];
  
  // Make sure to precache routes
  precacheAndRoute([
    { url: '/', revision: null },
    { url: '/index.html', revision: null },
    { url: '/icons/icon.svg', revision: null },
    { url: '/icons/icon-192x192.png', revision: null },
    { url: '/icons/icon-512x512.png', revision: null },
    ...manifest
  ]);

  // Clean up old caches
  cleanupOutdatedCaches();

  // Cache static assets
  registerRoute(
    ({request}) => request.destination === 'style' ||
                   request.destination === 'script' ||
                   request.destination === 'image',
    new CacheFirst({
      cacheName: 'static-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Cache API responses
  registerRoute(
    ({request}) => request.destination === 'fetch',
    new NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        }),
      ],
    })
  );

  // Handle navigation routes
  registerRoute(
    ({request}) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'pages-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 25,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }),
      ],
    })
  );
}

// Handle clients claiming and skipWaiting
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.skipWaiting();

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});