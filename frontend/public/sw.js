/* ─────────────────────────────────────────────
   Service Worker for TU Hmawbi Smart Campus CMS
   Tier A: Cache-First App Shell (HTML, JS, CSS, Icons)
   Tier B: Network-Only API (/api/*) — No stale data caching
   ───────────────────────────────────────────── */

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json',
  '/favicon.ico',
];

// Install Event: Fetch version.json to compute dynamic CACHE_NAME
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/version.json?t=' + Date.now())
      .then((res) => res.json())
      .then((data) => {
        const cacheName = `campus-shell-${data.buildId || 'v1'}`;
        return caches.open(cacheName).then((cache) => {
          return cache.addAll(PRECACHE_ASSETS);
        });
      })
      .catch(() => {
        return caches.open('campus-shell-v1').then((cache) => cache.addAll(PRECACHE_ASSETS));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Purge stale caches from old builds
self.addEventListener('activate', (event) => {
  event.waitUntil(
    fetch('/version.json?t=' + Date.now())
      .then((res) => res.json())
      .then((data) => {
        const currentCacheName = `campus-shell-${data.buildId || 'v1'}`;
        return caches.keys().then((keys) =>
          Promise.all(
            keys.filter((key) => key !== currentCacheName).map((key) => caches.delete(key))
          )
        );
      })
      .catch(() => Promise.resolve())
      .then(() => self.clients.claim())
  );
});

// Fetch Event Router
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Tier B: API Requests (/api/*) -> Network-Only (No SW Interception)
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Tier A: App Shell & Build Assets -> Network-First with Cache/Index Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If asset found and status OK, cache copy for offline usage
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open('campus-shell-v1').then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If offline or network fails, fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
