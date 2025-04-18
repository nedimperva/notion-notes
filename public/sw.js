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
  const { setCacheNameDetails } = workbox.core;

  // Set custom cache names for better organization
  setCacheNameDetails({
    prefix: 'thoughtbase',
    suffix: 'v1',
    precache: 'app-shell',
    runtime: 'runtime'
  });

  // Ensure manifest is properly initialized
  const manifest = self.__WB_MANIFEST || [];
  
  // Make sure to precache routes
  precacheAndRoute([
    { url: '/', revision: null },
    { url: '/index.html', revision: null },
    { url: '/icons/icon.svg', revision: null },
    { url: '/icons/icon-192x192.png', revision: null },
    { url: '/icons/icon-512x512.png', revision: null },
    // Include splash screen images for native-like loading experience
    { url: '/icons/splash-640x1136.png', revision: null },
    { url: '/icons/splash-750x1334.png', revision: null },
    { url: '/icons/splash-1242x2208.png', revision: null },
    { url: '/icons/splash-1125x2436.png', revision: null },
    { url: '/icons/splash-1536x2048.png', revision: null },
    ...manifest
  ]);

  // Clean up old caches
  cleanupOutdatedCaches();

  // Cache static assets with a Cache First strategy for better performance
  registerRoute(
    ({request}) => request.destination === 'style' ||
                   request.destination === 'script' ||
                   request.destination === 'font',
    new CacheFirst({
      cacheName: 'thoughtbase-static-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Cache images with a Cache First strategy but with shorter expiration
  registerRoute(
    ({request}) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'thoughtbase-images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
        }),
      ],
    })
  );

  // Cache API responses with a Network First strategy
  registerRoute(
    ({url}) => url.pathname.startsWith('/api/'),
    new NetworkFirst({
      cacheName: 'thoughtbase-api-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        }),
      ],
      networkTimeoutSeconds: 5, // Show cached content if network is slow
    })
  );

  // Handle navigation routes with a Network First strategy
  registerRoute(
    ({request}) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'thoughtbase-pages',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 25,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }),
      ],
      networkTimeoutSeconds: 3, // Show cached pages quickly if network is slow
    })
  );

  // Cache external resources (like Google Fonts) with StaleWhileRevalidate
  registerRoute(
    ({url}) => url.origin !== self.location.origin,
    new StaleWhileRevalidate({
      cacheName: 'thoughtbase-external',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    })
  );

  // Background sync for offline data
  if ('sync' in self.registration) {
    self.addEventListener('sync', (event) => {
      if (event.tag === 'sync-notes') {
        event.waitUntil(syncNotes());
      }
    });
  }

  // Function to sync notes when online
  async function syncNotes() {
    try {
      // In a real implementation, this would get data from IndexedDB
      // and sync with the server
      const notesToSync = await getNotesToSync();
      
      if (notesToSync.length > 0) {
        console.log('Background sync: syncing notes', notesToSync);
        // Would send data to server here
      }
      
      return true;
    } catch (error) {
      console.error('Background sync failed:', error);
      return false;
    }
  }

  // Mock function - would be replaced with actual IndexedDB code
  async function getNotesToSync() {
    return []; // placeholder
  }
}

// Handle clients claiming and skipWaiting
self.addEventListener('activate', (event) => {
  // Claim clients immediately so the newly activated SW controls clients
  event.waitUntil(self.clients.claim());
});
self.skipWaiting();

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_URLS') {
    // Handle explicit URL caching requests from the app
    const urls = event.data.urls;
    if (Array.isArray(urls) && urls.length > 0) {
      event.waitUntil(
        caches.open('thoughtbase-user-requested').then((cache) => {
          return cache.addAll(urls);
        })
      );
    }
  }
});

// Remove the forced page refresh when service worker is installed
self.addEventListener('install', (event) => {
  // No forced refresh - just skip waiting to activate the new service worker
  self.skipWaiting();
});