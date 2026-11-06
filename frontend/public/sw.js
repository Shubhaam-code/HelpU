/**
 * Helpu Progressive Web App Service Worker
 * Robust caching for static assets, network-first for navigation,
 * strict network-only bypass for APIs, Firebase auth, and mutating requests.
 */

const CACHE_VERSION = 'helpu-v1.0.0';
const CORE_CACHE = `helpu-core-${CACHE_VERSION}`;
const STATIC_CACHE = `helpu-static-${CACHE_VERSION}`;

// Core assets to pre-cache on install for standalone offline shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/offline.html',
  '/favicon.svg',
  '/logo-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png'
];

// Install Event: pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    }).catch((err) => {
      console.warn('[PWA SW] Pre-caching warning:', err);
    })
  );
});

// Activate Event: remove obsolete caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CORE_CACHE && name !== STATIC_CACHE) {
            return caches.delete(name);
          }
          return null;
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper to identify API or Auth URLs that MUST NOT be cached
function isApiOrAuth(url) {
  return (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.includes('/api/')
  );
}

// Helper to identify static asset URLs (JS, CSS, images, fonts)
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Rule 1: NEVER intercept non-GET requests (POST, PUT, DELETE, PATCH, etc.)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Rule 2: NEVER cache sensitive API endpoints, Firebase authentication or database calls
  if (isApiOrAuth(url)) {
    event.respondWith(
      fetch(request).catch(() => {
        // Graceful offline JSON fallback for API requests
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            message: 'You are currently offline. Please reconnect to access live campus rides.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Rule 3: Navigation requests (HTML pages) -> Network-First with Cache/Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If network succeeds, cache the latest HTML
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CORE_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(async () => {
          // When offline, try returning cached page or fallback to /offline.html
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          const rootCache = await caches.match('/index.html');
          if (rootCache) return rootCache;

          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;

          return new Response('Offline - Helpu', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // Rule 4: Static assets (JS, CSS, fonts, public icons) -> Cache-First with Network Revalidation
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch update in background for next time
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

