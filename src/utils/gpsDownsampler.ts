/**
 * GPS Downsampler — reduces GPS points to 1 per 5 seconds
 * Reduces storage and bandwidth for 1,000+ users
 */

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export function downsampleGpsPoints(
  points: GpsPoint[],
  intervalSec: number = 3
): GpsPoint[] {
  if (points.length <= 1) return points;

  const sampled: GpsPoint[] = [points[0]];
  let lastSampledTime = points[0].timestamp;

  for (let i = 1; i < points.length; i++) {
    if (points[i].timestamp - lastSampledTime >= intervalSec * 1000) {
      sampled.push(points[i]);
      lastSampledTime = points[i].timestamp;
    }
  }

  // Always include last point for accuracy
  if (sampled[sampled.length - 1].timestamp !== points[points.length - 1].timestamp) {
    sampled.push(points[points.length - 1]);
  }

  return sampled;
}

export function compressGpsPoints(points: GpsPoint[]): GpsPoint[] {
  // Douglas-Peucker simplification for route shapes
  // For tracking: just downsample
  return downsampleGpsPoints(points, 3);
}
