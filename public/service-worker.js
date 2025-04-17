// Workbox manifest injection point
self.__WB_MANIFEST;

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { precacheAndRoute, createHandlerBoundToURL } = workbox.precaching;
const { NavigationRoute } = workbox.routing;

// Precache and route all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Handle SPA navigation
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/index.html')
  )
);

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

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});