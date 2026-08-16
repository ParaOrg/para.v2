/**
 * backgroundTracker.js — Keeps GPS alive in background for hours.
 * Uses Wake Lock + Service Worker + Notification API.
 */

let wakeLock = null;
let keepAliveInterval = null;
let isTracking = false;

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch {}
}

async function releaseWakeLock() {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {}
}

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "KEEP_ALIVE" });
    }
  }, 15000); // Every 15s
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

export function startBackgroundTracking() {
  if (isTracking) return;
  isTracking = true;
  requestWakeLock();
  startKeepAlive();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isTracking) {
      requestWakeLock();
    }
  });
}

export function stopBackgroundTracking() {
  isTracking = false;
  releaseWakeLock();
  stopKeepAlive();
}

export function isTrackingInBackground() {
  return isTracking;
}

// ── Notifications ──────────────────────────────────────

export async function sendNotification(title, body, icon = "/icon-192.png") {
  if (!("Notification" in window)) return;
  
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;
  
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, icon, badge: icon });
  } catch {}
}

// Pre-built notifications
export function notifyRouteSaved(routeName) {
  sendNotification("Para PH", `✅ "${routeName}" saved successfully!`);
}

export function notifySyncComplete(count) {
  sendNotification("Para PH", `📡 ${count} route(s) synced to server.`);
}

export function notifyEmergencyAlert(message) {
  sendNotification("⚠️ Para PH Alert", message);
}

export function notifyRouteChange(routeName) {
  sendNotification("🔄 Para PH", `Route changed: ${routeName}. Tap to view.`);
}
