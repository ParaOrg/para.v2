// BUMP THIS VERSION every time you change caching behavior
const CACHE_NAME = 'para-ph-v20260912';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// A minimal response so respondWith() never receives undefined
function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Offline — Para PH</title>' +
    '<style>body{font-family:sans-serif;text-align:center;padding:40px;color:#381D65}</style>' +
    '<h1>You are offline</h1>' +
    '<p>Please check your connection and try again.</p>' +
    '<button onclick="location.reload()" style="padding:10px 20px;border-radius:10px;background:#7A4BC8;color:white;border:none;cursor:pointer">Retry</button>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass service worker for these:
  // 1. Non-GET requests (POST/PUT/DELETE)
  // 2. Supabase REST/Edge functions
  // 3. Google APIs (legacy Firebase)
  // 4. Route-search API (needs live data)
  if (
    request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  // --- Navigation requests (page loads) — network-first with SPA fallback ---
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);

          // Cache the latest index.html under a stable key
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', clone).catch(() => {});
          }
          return networkResponse;
        } catch {
          // Offline: try cached index.html, else return offline page
          const cached = await caches.match('/index.html');
          return cached || offlineResponse();
        }
      })()
    );
    return;
  }

  // --- Hashed assets (immutable, cache-first) ---
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const clone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, clone).catch(() => {});
          }
          return response;
        } catch {
          // No cached version and no network — return empty response
          return new Response('', { status: 504 });
        }
      })()
    );
    return;
  }

  // --- Everything else: network-first, fall through to cache, else 504 ---
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match(request);
        return cached || new Response('', { status: 504 });
      }
    })()
  );
});
