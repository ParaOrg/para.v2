self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { self.clients.claim(); });

// Periodic background sync for pending data
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "sync-pending-commutes") {
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: "SYNC_NOW" }));
      })
    );
  }
});

// Keep alive handler
self.addEventListener("message", (e) => {
  if (e.data?.type === "KEEP_ALIVE") {
    e.source.postMessage({ type: "ALIVE" });
  }
  if (e.data?.type === "REGISTER_SYNC") {
    self.registration.periodicSync.register("sync-pending-commutes", {
      minInterval: 60 * 1000,
    }).catch(() => {});
  }
});

self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
