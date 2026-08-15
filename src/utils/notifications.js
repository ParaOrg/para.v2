/**
 * notifications.js — Push notifications for route sync completion.
 */

export async function notifySyncComplete(routeName) {
  if (!("Notification" in window)) return;
  
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;
  
  navigator.serviceWorker.ready.then((reg) => {
    reg.showNotification("Para PH", {
      body: `✅ "${routeName}" synced successfully!`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });
  });
}
