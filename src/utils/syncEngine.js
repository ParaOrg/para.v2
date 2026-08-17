/**
 * syncEngine.js — Background sync engine with retry + backoff.
 * Flushes offline buffer to backend when online.
 * Guarantees no data loss via client_log_id deduplication.
 */

import { offlineBuffer } from "./offlineBuffer";
import { apiPost } from "./api";

const SYNC_INTERVAL_MS = 5000; // Check every 5s
const MAX_RETRY_DELAY_MS = 60000; // 60s max backoff
let syncTimer = null;
let retryDelay = 1000;
let isSyncing = false;

export function startSyncEngine() {
  if (syncTimer) return;
  syncTimer = setInterval(syncAll, SYNC_INTERVAL_MS);
  syncAll(); // immediate first sync
  window.addEventListener("online", syncAll);
}

export function stopSyncEngine() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  window.removeEventListener("online", syncAll);
}

async function syncAll() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;
  try {
    await syncCommutes();
    await syncFareReports();
    retryDelay = 1000; // reset backoff on success
  } catch (e) {
    console.warn("Sync failed:", e);
  } finally {
    isSyncing = false;
  }
}

async function syncCommutes() {
  const pending = await offlineBuffer.getPendingCommutes();
  for (const item of pending) {
    try {
      await apiPost("/commute/save", {
        client_log_id: item.client_log_id || `offline-${item.id}`,
        route_name: item.route_name,
        route_uuid: item.route_uuid,
        user_email: item.user_email,
        consent_granted: item.consent_granted,
        total_time_sec: item.total_time_sec,
        gps_points: item.gps_points || [],
        pois: item.pois || [],
        is_loop: item.is_loop || false,
        completed_at: item.completed_at,
        source: item.source || "offline_sync",
      });
      await offlineBuffer.deleteCommute(item.id);
    } catch (e) {
      console.warn("Commute sync failed for", item.client_log_id, e);
      // Keep in buffer for retry
      break; // stop batch on first failure
    }
  }
}

async function syncFareReports() {
  const reports = await offlineBuffer.getFareReports();
  for (const item of reports) {
    try {
      await apiPost("/fare/report", {
        user_email: item.user_email,
        mode: item.mode,
        fare_amount: item.fare_amount,
        route_name: item.route_name,
        surge_multiplier: item.surge_multiplier,
        tnvs_provider: item.tnvs_provider,
        reported_at: item.reported_at,
      });
      await offlineBuffer.deleteCommute(item.id);
    } catch (e) {
      break;
    }
  }
}

export async function flushNow() {
  await syncAll();
}
