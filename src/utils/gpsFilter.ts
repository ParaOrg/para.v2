// src/utils/gpsFilter.ts
// GPS jitter filter + smoothing.
// Drop garbage fixes, reject teleports, smooth small jitter.

export interface RawFix {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
}

const MAX_ACCURACY_M = 50;      // reject fixes worse than this
const MAX_SPEED_MPS = 40;       // reject teleports (> 144 km/h)
const EMA_ALPHA = 0.35;         // smoothing factor for small jitter
const JITTER_THRESHOLD_M = 3;   // below this distance, smooth instead of append

export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Create a stateful filter. Call `createGpsFilter()` once per tracking session.
 * Returns null to indicate "drop this fix".
 */
export function createGpsFilter() {
  let last: RawFix | null = null;

  return function filter(fix: RawFix): RawFix | null {
    // 1. Reject bad accuracy
    if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) return null;

    // First accepted fix is the baseline
    if (!last) {
      last = fix;
      return fix;
    }

    const dtSec = Math.max(0.001, (fix.timestamp - last.timestamp) / 1000);
    const distM = haversineMeters(last.lat, last.lng, fix.lat, fix.lng);

    // 2. Reject teleports
    if (distM / dtSec > MAX_SPEED_MPS) return null;

    // 3. Smooth small jitter (don't append a new point, nudge the previous one)
    if (distM < JITTER_THRESHOLD_M) {
      const smoothed: RawFix = {
        ...fix,
        lat: last.lat + (fix.lat - last.lat) * EMA_ALPHA,
        lng: last.lng + (fix.lng - last.lng) * EMA_ALPHA,
      };
      last = smoothed;
      return smoothed;
    }

    // 4. Genuine movement — accept as-is
    last = fix;
    return fix;
  };
}

/** Reset an existing filter's internal state (e.g. when a session restarts). */
export function resetGpsFilter(filterFn: ReturnType<typeof createGpsFilter>) {
  // Access internal `last` via closure trick — simplest is to just create a new one.
  // Kept as a stub for API symmetry; callers should call createGpsFilter() again.
  void filterFn;
}
