// SafeSie Service Worker for PWA
const CACHE_NAME = 'safesie-v1';
const urlsToCache = [
  '/SafeSieProject/',
  '/SafeSieProject/index.html',
  '/SafeSieProject/styles.css',
  '/SafeSieProject/script.js',
  '/SafeSieProject/twilio-config.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('SafeSie SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SafeSie SW: Caching assets');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('SafeSie SW: Cache failed', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SafeSie SW: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SafeSie SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // If both fail, return offline page (optional)
        console.log('SafeSie SW: Fetch failed');
      })
  );
});

// Background sync for SOS alerts (when connection returns)
self.addEventListener('sync', (event) => {
  if (event.tag === 'safesie-sos') {
    console.log('SafeSie SW: Background sync for SOS');
    event.waitUntil(sendSOSInBackground());
  }
});

// Push notifications (for emergency alerts)
self.addEventListener('push', (event) => {
  console.log('SafeSie SW: Push received');
  const options = {
    body: event.data ? event.data.text() : 'SafeSie Alert',
    icon: 'icon-192x192.png',
    badge: 'icon-72x72.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('SafeSie', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/SafeSieProject/')
    );
  }
});

async function sendSOSInBackground() {
  // This would handle pending SOS alerts when connection returns
  console.log('SafeSie SW: Processing background SOS');
}
