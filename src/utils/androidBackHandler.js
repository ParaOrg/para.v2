/**
 * androidBackHandler.js — Handles Android hardware back button in PWA.
 * Closes modals/drawers before exiting the app.
 */

export function initAndroidBackHandler() {
  window.addEventListener("popstate", () => {
    // Close any open overlays
    const overlays = document.querySelectorAll("[data-overlay]");
    for (const overlay of overlays) {
      if (overlay.style.display !== "none") {
        overlay.style.display = "none";
        return;
      }
    }
    // If no overlays open, let default back behavior happen
  });

  // Push a dummy state so back button triggers popstate
  window.history.pushState(null, "", window.location.pathname);
}
