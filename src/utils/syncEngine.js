/**
 * syncEngine.js — Background sync engine with retry + backoff.
 * Flushes offline buffer to Supabase edge functions when online.
 * Uses the SAME endpoints as the online path to guarantee payload
 * consistency (commute-save, fare-report).
 */

import { offlineBuffer } from "./offlineBuffer";
import { edgePost } from "./api";

const SYNC_INTERVAL_MS = 5000;     // Check every 5s
const MAX_RETRY_DELAY_MS = 60000;  // 60s max backoff
let syncTimer = null;
let retryDelay = 1000;
let isSyncing = false;

export function startSyncEngine() {
  if (syncTimer) return;
  syncTimer = setInterval(syncAll, SYNC_INTERVAL_MS);
  syncAll();
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
    await syncPois();          // __SYNC_DRAIN_FIX__
    await syncGpsStreams();    // __SYNC_DRAIN_FIX__
    retryDelay = 1000;
  } catch (e) {
    console.warn("[syncEngine] syncAll failed:", e);
  } finally {
    isSyncing = false;
  }
}

/**
 * Sync queued commutes to the commute-save edge function.
 * On 4xx (validation failed) → delete from queue (bad data, don't retry).
 * On 5xx or network error → keep in queue, break batch.
 */
async function syncCommutes() {
  const pending = await offlineBuffer.getPendingCommutes();
  for (const item of pending) {
    try {
      // Ensure required fields exist before sending
      const payload = {
        track_uuid: item.track_uuid || crypto.randomUUID(),
        client_log_id: item.client_log_id || `offline-${item.id}`,
        install_id: item.install_id || null,
        user_id: item.user_id || null,
        user_email: item.user_email || null,
        route_uuid: item.route_uuid || null,
        route_name: item.route_name || "Personal Commute",
        mode: item.mode || null,
        total_time_sec: item.total_time_sec || 0,
        distance_m: item.distance_m || 0,
        gps_track: Array.isArray(item.gps_track) ? item.gps_track
                  : Array.isArray(item.gps_points) ? item.gps_points
                  : [],
        gps_points: item.gps_points_count || (Array.isArray(item.gps_track) ? item.gps_track.length : 0),
        raw_payload: item.raw_payload || item,
        total_fare: item.total_fare ?? 0,
        is_subsidized: item.is_subsidized || false,
        original_fare: item.original_fare ?? null,
        pois: item.pois || [],
        is_loop: item.is_loop || false,
        city: item.city || "Metro Manila",
        region: item.region || "NCR",
        source: item.source || "offline_sync",
      };

      const response = await edgePost("commute-save", payload);

      // Treat success, duplicate, or hard validation failure as "remove from queue"
      if (
        response?.status === "success" ||
        response?.code === "DUPLICATE" ||
        response?.code === "VALIDATION_FAILED"
      ) {
        await offlineBuffer.deleteCommute(item.id);
        if (response?.code === "VALIDATION_FAILED") {
          console.warn("[syncEngine] dropped invalid commute:", response.message);
        }
      } else if (response?.status === "error") {
        // Server error (500, DB insert failed) — keep in queue, break
        console.warn("[syncEngine] server rejected commute:", response.message);
        break;
      } else {
        // Unexpected response — keep in queue
        break;
      }
    } catch (e) {
      console.warn("[syncEngine] commute sync failed for", item.client_log_id, e);
      break;
    }
  }
}

/**
 * Sync queued fare reports to the fare-report edge function.
 * Same error-handling policy as commutes.
 */
async function syncFareReports() {
  const reports = await offlineBuffer.getFareReports();
  for (const item of reports) {
    try {
      const payload = {
        user_email: item.user_email || null,
        mode: item.mode || null,
        fare_amount: item.fare_amount ?? 0,
        route_name: item.route_name || null,
        surge_multiplier: item.surge_multiplier ?? 1,
        is_surge: item.is_surge || false,
        tnvs_provider: item.tnvs_provider || null,
        is_subsidized: item.is_subsidized || false,
        original_fare: item.original_fare ?? null,
        reported_at: item.reported_at || new Date().toISOString(),
      };

      const response = await edgePost("fare-report", payload);

      if (
        response?.status === "success" ||
        response?.code === "DUPLICATE" ||
        response?.code === "VALIDATION_FAILED"
      ) {
        await offlineBuffer.deleteFareReport(item.id);
      } else if (response?.status === "error") {
        break;
      } else {
        break;
      }
    } catch (e) {
      console.warn("[syncEngine] fare sync failed:", e);
      break;
    }
  }
}

// __SYNC_DRAIN_FIX__ — drain POI events to /poi-add
async function syncPois() {
  const pois = await offlineBuffer.getPois();
  for (const item of pois) {
    try {
      const response = await edgePost("poi-add", item);
      if (
        response?.status === "success" ||
        response?.code === "DUPLICATE" ||
        response?.code === "VALIDATION_FAILED"
      ) {
        await offlineBuffer.delete("poi_events", item.id);
      } else if (response?.status === "error") {
        break;
      } else {
        break;
      }
    } catch (e) {
      console.warn("[syncEngine] poi sync failed:", e);
      break;
    }
  }
}

// __SYNC_DRAIN_FIX__ — drain GPS streams via /commute-save
async function syncGpsStreams() {
  const streams = await offlineBuffer.getGpsStreams();
  for (const item of streams) {
    try {
      const response = await edgePost("commute-save", item);
      if (
        response?.status === "success" ||
        response?.code === "DUPLICATE" ||
        response?.code === "VALIDATION_FAILED"
      ) {
        await offlineBuffer.delete("gps_streams", item.id);
      } else if (response?.status === "error") {
        break;
      } else {
        break;
      }
    } catch (e) {
      console.warn("[syncEngine] gps stream sync failed:", e);
      break;
    }
  }
}

export async function flushNow() {
  await syncAll();
}
