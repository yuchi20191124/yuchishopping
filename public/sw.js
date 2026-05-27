const CACHE_NAME = 'yuchishopping-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests going to local origin
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network-First strategy: Try the network first, fall back to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, update cache and return
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        // Offline: attempt to retrieve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to offline index.html for navigation actions
          if (event.request.mode === 'navigate') {
            return caches.match('index.html') || caches.match('./');
          }
        });
      })
  );
});
