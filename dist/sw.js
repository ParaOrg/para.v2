const CACHE_NAME = 'para-ph-v20260908'; // BUMP THIS VERSION

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // BYPASS service worker for these:
  // 1. Firebase Auth (POST requests)
  // 2. Google Identity Toolkit
  // 3. Supabase REST/Edge Functions
  // 4. Any non-GET request (POST, PUT, DELETE)
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/') ||
    event.request.method !== 'GET'
  ) {
    return; // Let browser handle directly
  }
  
  // Network-first for HTML (always get latest)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // Cache-first for hashed assets (immutable)
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }
  
  // Default: network-first
  event.respondWith(
    fetch(event.request)
      .then(response => response)
      .catch(() => caches.match(event.request))
  );
});
