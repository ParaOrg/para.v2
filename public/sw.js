self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Don't intercept API calls
  if (url.pathname.includes('/api/')) {
    return;
  }
  
  // Don't intercept navigation requests (let browser handle them)
  if (event.request.mode === 'navigate') {
    return;
  }
  
  // For everything else, try network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
