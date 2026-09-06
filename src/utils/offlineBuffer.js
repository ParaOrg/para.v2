/**
 * offlineBuffer.js — IndexedDB-backed offline storage with localStorage fallback.
 * Stores pending commutes, GPS streams, POIs, and fare reports.
 * 
 * WHY: All user contributions pass through here first. This prevents
 * data loss in the Philippine context where connectivity is unreliable.
 */

const DB_NAME = "para_offline_buffer";
const DB_VERSION = 1;
const STORES = ["pending_commutes", "gps_streams", "poi_events", "fare_reports"];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id", autoIncrement: true });
        }
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

async function idbAdd(storeName, data) {
  const db = await openDB();
  if (!db) {
    // Fallback to localStorage
    try {
      const key = `para_offline_${storeName}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push({ id: Date.now() + Math.random(), ...data, _timestamp: Date.now() });
      localStorage.setItem(key, JSON.stringify(existing));
      return true;
    } catch { return false; }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.add({ id: Date.now() + Math.random(), ...data, _timestamp: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function idbGetAll(storeName) {
  const db = await openDB();
  if (!db) {
    try {
      const key = `para_offline_${storeName}`;
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch { return []; }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

async function idbClear(storeName) {
  const db = await openDB();
  if (!db) {
    try {
      localStorage.removeItem(`para_offline_${storeName}`);
    } catch {}
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function idbDelete(storeName, id) {
  const db = await openDB();
  if (!db) {
    try {
      const key = `para_offline_${storeName}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify(existing.filter(x => x.id !== id)));
    } catch {}
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// Utility: Generate or retrieve anonymous install ID
function getOrCreateInstallId() {
  const key = 'para_install_id';
  let installId = localStorage.getItem(key);
  if (!installId) {
    installId = crypto.randomUUID();
    localStorage.setItem(key, installId);
  }
  return installId;
}

// Utility: Generate client log ID for idempotency
function generateClientLogId() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

// ── Public API ────────────────────────────────────────

export const offlineBuffer = {
  addCommute: (data) => idbAdd("pending_commutes", data),
  getPendingCommutes: () => idbGetAll("pending_commutes"),
  clearCommutes: () => idbClear("pending_commutes"),
  deleteCommute: (id) => idbDelete("pending_commutes", id),

  addGpsStream: (data) => idbAdd("gps_streams", data),
  getGpsStreams: () => idbGetAll("gps_streams"),
  clearGpsStreams: () => idbClear("gps_streams"),

  addPoi: (data) => idbAdd("poi_events", data),
  getPois: () => idbGetAll("poi_events"),
  clearPois: () => idbClear("poi_events"),

  addFareReport: (data) => idbAdd("fare_reports", data),
  getFareReports: () => idbGetAll("fare_reports"),
  clearFareReports: () => idbClear("fare_reports"),

  // Generic methods for sync engine
  getAll: (storeName) => idbGetAll(storeName),
  clear: (storeName) => idbClear(storeName),
  add: (storeName, data) => idbAdd(storeName, data),

  // Utilities
  getOrCreateInstallId,
  generateClientLogId,
};

export { getOrCreateInstallId, generateClientLogId };

export async function syncOfflineBuffer() {
  const stores = ["poi_events", "fare_reports", "pending_commutes", "gps_streams"];
  for (const store of stores) {
    const items = await offlineBuffer.getAll(store);
    for (const item of items) {
      try {
        let fn = null;
        if (store === "poi_events") fn = "poi-add";
        else if (store === "fare_reports") fn = "fare-report";
        else if (store === "pending_commutes") fn = "commute-save";
        else if (store === "gps_streams") fn = "commute-save";
        
        if (fn) {
          const { edgePost } = await import("./api");
          await edgePost(fn, item);
          await offlineBuffer.delete(store, item.id);
        }
      } catch (e) {
        console.warn(`Failed to sync ${store}:`, e);
      }
    }
  }
}

// Auto-sync when back online
if (typeof window !== "undefined") {
  window.addEventListener("online", syncOfflineBuffer);
}
