const CACHE_VERSION = 'unai-crm-pwa-v2';
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

  // Never intercept API calls, auth endpoints, Next dev HMR updates, or SW itself
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('hot-update') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // Navigation requests: always network-first so SSR HTML and auth state stay fresh,
  // with clean offline fallback page if disconnected.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOffline = await caches.match('/offline.html');
        return cachedOffline || Response.error();
      })
    );
    return;
  }

  // In local dev (localhost / 127.0.0.1), never serve cached /_next/static/ JS/CSS chunks
  // because Turbopack/Next dev reuses chunk paths across edits and stale client chunks cause hydration mismatches.
  const isLocalDevHost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.endsWith('.local');

  const isStaticAsset =
    (!isLocalDevHost && url.pathname.startsWith('/_next/static/')) ||
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
