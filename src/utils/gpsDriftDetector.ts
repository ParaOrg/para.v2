/**
 * ML-based GPS Drift Detection
 * Identifies: idle, walking, transit, traffic, drift
 */

export interface DriftAnalysis {
  mode: 'idle' | 'walking' | 'transit' | 'traffic' | 'drift';
  confidence: number;
  speed_kmh: number;
  total_distance_m: number;
  idle_duration_sec: number;
}

export function analyzeGpsTrack(
  points: Array<{ lat: number; lng: number; timestamp: number }>
): DriftAnalysis {
  if (points.length < 2) {
    return { mode: 'idle', confidence: 0.9, speed_kmh: 0, total_distance_m: 0, idle_duration_sec: 0 };
  }

  // Calculate total distance and time
  let totalDist = 0;
  for (let i = 1; i < points.length; i++) {
    totalDist += haversineMeters(points[i-1], points[i]);
  }
  
  const totalTime = (points[points.length - 1].timestamp - points[0].timestamp) / 1000;
  const avgSpeed = totalDist / totalTime; // m/s
  const speedKmh = avgSpeed * 3.6;

  // DRIFT DETECTION: Many points but tiny total distance
  if (points.length > 50 && totalDist < 50 && totalTime > 300) {
    return {
      mode: 'drift',
      confidence: 0.95,
      speed_kmh: speedKmh,
      total_distance_m: totalDist,
      idle_duration_sec: totalTime,
    };
  }

  // IDLE: Very slow or no movement
  if (speedKmh < 1) {
    return {
      mode: 'idle',
      confidence: 0.9,
      speed_kmh: speedKmh,
      total_distance_m: totalDist,
      idle_duration_sec: totalTime,
    };
  }

  // WALKING: 1-5 km/h
  if (speedKmh < 5) {
    return {
      mode: 'walking',
      confidence: 0.85,
      speed_kmh: speedKmh,
      total_distance_m: totalDist,
      idle_duration_sec: 0,
    };
  }

  // TRAFFIC: 5-15 km/h (slow vehicle)
  if (speedKmh < 15) {
    return {
      mode: 'traffic',
      confidence: 0.7,
      speed_kmh: speedKmh,
      total_distance_m: totalDist,
      idle_duration_sec: 0,
    };
  }

  // TRANSIT: 15-40 km/h
  if (speedKmh < 40) {
    return {
      mode: 'transit',
      confidence: 0.85,
      speed_kmh: speedKmh,
      total_distance_m: totalDist,
      idle_duration_sec: 0,
    };
  }

  // RAIL: >40 km/h
  return {
    mode: 'rail',
    confidence: 0.9,
    speed_kmh: speedKmh,
    total_distance_m: totalDist,
    idle_duration_sec: 0,
  };
}

function haversineMeters(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}
