/* Rewritten by scripts/finalize-web.mjs after each single-page web export. */
const BUILD_ID = '__FINANCE_WEB_BUILD_ID__';
const BASE_URL = '__FINANCE_BASE_URL__';
const PRECACHE_URLS = []; // __FINANCE_PRECACHE_URLS__
const DEVELOPMENT = new URL(self.location.href).searchParams.get('dev') === '1';
const CACHE_PREFIX = `finance-${BASE_URL || 'root'}-`;
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const NAVIGATION_CACHE = `${BASE_URL}/index.html`;

function withIsolationHeaders(response) {
  if (!response || response.type === 'opaque' || response.status === 0) return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const isUpdate = Boolean(self.registration.active);
      if (!DEVELOPMENT) {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_URLS);
      }
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (isUpdate && clients.some((client) => client.url.startsWith(self.registration.scope))) {
        for (const client of clients) client.postMessage({ type: 'FINANCE_UPDATE_READY' });
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (!DEVELOPMENT) {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FINANCE_ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = DEVELOPMENT ? null : await caches.open(CACHE_NAME);
      const cached = cache ? await cache.match(request) : null;
      if (cached) return withIsolationHeaders(cached);

      try {
        const response = withIsolationHeaders(await fetch(request));
        if (cache && response.ok && request.destination !== 'document') {
          await cache.put(request, response.clone());
        }
        if (cache && request.mode === 'navigate' && response.status === 404) {
          const fallback = await cache.match(NAVIGATION_CACHE);
          if (fallback) return withIsolationHeaders(fallback);
        }
        return response;
      } catch (error) {
        if (cache && request.mode === 'navigate') {
          const fallback = await cache.match(NAVIGATION_CACHE);
          if (fallback) return withIsolationHeaders(fallback);
        }
        if (cached) return withIsolationHeaders(cached);
        throw error;
      }
    })()
  );
});
