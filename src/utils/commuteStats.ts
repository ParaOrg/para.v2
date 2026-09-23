// src/utils/commuteStats.ts
// Single source of truth for commute distance / duration / speed.

export interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

const R_EARTH_M = 6371000;

/** Great-circle distance between two points, in meters. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R_EARTH_M * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Sum of great-circle distances between consecutive points, in meters. */
export function segmentDistance(points: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Wall-clock duration of a segment, in seconds (from timestamps). */
export function segmentDurationSec(points: GeoPoint[]): number {
  if (points.length < 2) return 0;
  const first = points[0].timestamp;
  const last = points[points.length - 1].timestamp;
  return Math.max(0, Math.round((last - first) / 1000));
}

/** Average speed over the segment, in km/h. */
export function segmentAvgSpeedKmh(points: GeoPoint[]): number {
  const dist = segmentDistance(points);
  const durSec = segmentDurationSec(points);
  if (durSec <= 0) return 0;
  return (dist / durSec) * 3.6;
}

/** Max instantaneous speed (between consecutive points), in km/h. */
export function segmentMaxSpeedKmh(points: GeoPoint[]): number {
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    const dtSec = Math.max(0.001, (points[i].timestamp - points[i - 1].timestamp) / 1000);
    const dM = haversineMeters(points[i - 1], points[i]);
    const kmh = (dM / dtSec) * 3.6;
    if (kmh > max) max = kmh;
  }
  return max;
}

export interface SegmentStats {
  distanceM: number;
  durationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
}

export function computeSegmentStats(points: GeoPoint[]): SegmentStats {
  return {
    distanceM: segmentDistance(points),
    durationSec: segmentDurationSec(points),
    avgSpeedKmh: segmentAvgSpeedKmh(points),
    maxSpeedKmh: segmentMaxSpeedKmh(points),
  };
}

export interface SegmentLike {
  mode: string;
  gpsPoints: GeoPoint[];
  distanceM?: number;
  durationSec?: number;
}

export interface CommuteStats {
  totalDistanceM: number;
  totalDurationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  segmentBreakdown: Array<{ mode: string } & SegmentStats>;
}

/**
 * Aggregate stats over a list of segments.
 * Uses pre-computed distanceM/durationSec if present, otherwise recomputes.
 */
export function computeCommuteStats(segments: SegmentLike[]): CommuteStats {
  const breakdown = segments.map((seg) => {
    const pts = seg.gpsPoints || [];
    const distanceM = seg.distanceM != null ? seg.distanceM : segmentDistance(pts);
    const durationSec = seg.durationSec != null ? seg.durationSec : segmentDurationSec(pts);
    const avgSpeedKmh = durationSec > 0 ? (distanceM / durationSec) * 3.6 : 0;
    const maxSpeedKmh = segmentMaxSpeedKmh(pts);
    return { mode: seg.mode, distanceM, durationSec, avgSpeedKmh, maxSpeedKmh };
  });

  const totalDistanceM = breakdown.reduce((s, x) => s + x.distanceM, 0);
  const totalDurationSec = breakdown.reduce((s, x) => s + x.durationSec, 0);
  const avgSpeedKmh = totalDurationSec > 0 ? (totalDistanceM / totalDurationSec) * 3.6 : 0;
  const maxSpeedKmh = breakdown.reduce((m, x) => Math.max(m, x.maxSpeedKmh), 0);

  return { totalDistanceM, totalDurationSec, avgSpeedKmh, maxSpeedKmh, segmentBreakdown: breakdown };
}

/** Human-friendly km / m formatter used across the app. */
export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

/** Human-friendly duration formatter (mm:ss). */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
