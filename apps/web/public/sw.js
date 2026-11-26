const CACHE_VERSION = 'unai-crm-pwa-v1';
const CORE_PRECACHE_URLS = [
  '/offline.html',
  '/unai-logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated API calls or auth endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // Navigation requests: network-first so auth cookies & server renders stay fresh,
  // with clean offline fallback page if completely disconnected.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOffline = await caches.match('/offline.html');
        return cachedOffline || Response.error();
      })
    );
    return;
  }

  // Immutable Next static chunks & branded media/icons: stale-while-revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname === '/unai-logo.png' ||
    url.pathname === '/unai-logo.webp';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              const clone = response.clone();
              caches
                .open(CACHE_VERSION)
                .then((cache) => cache.put(request, clone))
                .catch(() => {});
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkPromise;
      })
    );
  }
});

