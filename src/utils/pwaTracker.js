/**
 * pwaTracker.js — Track PWA installs and home screen usage.
 */

let deferredPrompt = null;

export function initPwaTracker() {
  // Android: Capture install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Track that user SAW the install prompt
    trackEvent("pwa_prompt_shown");
  });

  // Android: User completed install
  window.addEventListener("appinstalled", () => {
    trackEvent("pwa_installed");
  });

  // Check if opened from home screen (standalone mode)
  if (window.matchMedia("(display-mode: standalone)").matches) {
    trackEvent("pwa_opened_from_homescreen");
  }

  // iOS: Can't detect install directly, but can detect standalone mode
  if (window.navigator.standalone === true) {
    trackEvent("pwa_opened_ios_homescreen");
  }
}

function trackEvent(eventName) {
  try {
    // Store locally
    const events = JSON.parse(localStorage.getItem("para_pwa_events") || "[]");
    events.push({ event: eventName, timestamp: new Date().toISOString() });
    localStorage.setItem("para_pwa_events", JSON.stringify(events));
    
    // Send to backend
    fetch(`${import.meta.env.VITE_API_URL || ""}/telemetry/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: eventName, source: "pwa" }),
    }).catch(() => {});
  } catch {}
}

export function getPwaStats() {
  try {
    return JSON.parse(localStorage.getItem("para_pwa_events") || "[]");
  } catch { return []; }
}
