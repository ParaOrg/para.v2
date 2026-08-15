/**
 * sw.js — Service Worker for Para PH
 */

const CACHE_NAME = "para-ph-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "KEEP_ALIVE") {
    e.source.postMessage({ type: "ALIVE" });
  }
});
