// Service Worker for Wiki Roulette PWA
const CACHE_NAME = 'wikiroulette-v3';

// Files to cache for offline shell
const SHELL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=IBM+Plex+Mono:wght@300;400;500&display=swap',
];

// Install — cache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - App shell (html/css/js): cache-first
// - Wikipedia API calls: network-first, fall back to cache
// - Google Fonts: cache-first
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Wikipedia API — network first
  if (url.hostname.includes('wikipedia.org')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache successful API responses briefly
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else — cache first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});