const CACHE_NAME = 'pasi-alerts-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate and clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network first strategy (we need live data)
self.addEventListener('fetch', event => {
  // Skip API calls - always fetch from network
  if (event.request.url.includes('binance.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache the response
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const symbol = event.notification.tag;
  const urlToOpen = symbol
    ? `https://www.binance.com/es/futures/${symbol}USDT`
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if app is already open
        for (const client of windowClients) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle push notifications (for future server-side push)
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nueva alerta de short detectada',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.symbol || 'alert',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Ver en Binance' },
      { action: 'dismiss', title: 'Descartar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Crypto Short Alert', options)
  );
});
