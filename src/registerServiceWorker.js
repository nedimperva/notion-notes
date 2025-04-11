let registration;

export async function register() {
  if ('serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('ServiceWorker registration successful');

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            showUpdateNotification();
          }
        });
      });

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 1000 * 60 * 60); // Check every hour

    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  }
}

function showUpdateNotification() {
  if (Notification.permission === 'granted') {
    const notification = new Notification('New Update Available', {
      body: 'A new version of the app is available. Click to update.',
      icon: '/icon-192x192.png',
      requireInteraction: true
    });

    notification.onclick = () => {
      window.location.reload();
    };
  }
}

export function checkForUpdates() {
  if (registration) {
    registration.update();
  }
} 