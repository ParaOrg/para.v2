import * as turf from '@turf/turf';

export interface RouteCandidate {
  route_uuid: string;
  name: string;
  origin: [number, number]; // [lng, lat]
  destination: [number, number];
  pathCoordinates?: [number, number][]; // Full route path
  score?: number;
  bearingDiff?: number;
  distanceToUser?: number;
}

export interface RankedRoute extends RouteCandidate {
  score: number;
  bearingDiff: number;
  distanceToUser: number;
}

/**
 * Calculate bearing from point A to point B
 * Returns bearing in degrees (0-360)
 */
export function calculateBearing(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const from = turf.point([fromLng, fromLat]);
  const to = turf.point([toLng, toLat]);
  const rawBearing = turf.bearing(from, to);
  // Normalize to 0-360
  return ((rawBearing % 360) + 360) % 360;
}

/**
 * Calculate the general bearing of a route path
 * Uses first and last point of the path, or origin/destination
 */
export function calculateRouteBearing(route: RouteCandidate): number {
  const start = route.pathCoordinates && route.pathCoordinates.length > 0 
    ? route.pathCoordinates[0] 
    : route.origin;
  const end = route.pathCoordinates && route.pathCoordinates.length > 1 
    ? route.pathCoordinates[route.pathCoordinates.length - 1] 
    : route.destination;
  
  // pathCoordinates are [lat, lng] — pass as (fromLat, fromLng, toLat, toLng)
  return calculateBearing(start[0], start[1], end[0], end[1]);
}

/**
 * Calculate bearing difference (0-180 degrees)
 */
export function bearingDifference(bearing1: number, bearing2: number): number {
  const diff = Math.abs(bearing1 - bearing2);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const from = turf.point([lng1, lat1]);
  const to = turf.point([lng2, lat2]);
  // Turf returns kilometers by default — convert to meters
  const distanceKm = turf.distance(from, to);
  return distanceKm * 1000;
}

/**
 * Find nearest point on route path to user location
 * Returns distance in meters and the nearest point coordinates
 */
export function nearestPointOnRoute(
  userLat: number,
  userLng: number,
  pathCoordinates: [number, number][]
): { distanceMeters: number; nearestPoint: [number, number] } {
  if (pathCoordinates.length < 2) {
    return {
      distanceMeters: calculateDistanceMeters(userLat, userLng, pathCoordinates[0][1], pathCoordinates[0][0]),
      nearestPoint: pathCoordinates[0],
    };
  }

  // Convert [lat, lng] to [lng, lat] for Turf
  const lngLatCoords = pathCoordinates.map(([lat, lng]) => [lng, lat] as [number, number]);
  const line = turf.lineString(lngLatCoords);
  const point = turf.point([userLng, userLat]);
  const snapped = turf.nearestPointOnLine(line, point);
  
  const distanceMeters = (snapped.properties.dist || 0) * 1000;
  
  return {
    distanceMeters,
    nearestPoint: [snapped.geometry.coordinates[0], snapped.geometry.coordinates[1]],
  };
}

/**
 * REQUIREMENT 1: Trajectory-Based Route Ranking
 * 
 * Scores routes based on:
 * 1. Bearing alignment with destination vector (60% weight)
 * 2. Proximity to user's current location (40% weight)
 * 
 * Filters out routes going in opposite direction (bearing diff > 120°)
 */
export function rankRoutesByTrajectory(
  userLocation: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  routes: RouteCandidate[],
  maxResults: number = 3
): RankedRoute[] {
  // Calculate destination bearing from user
  const destBearing = calculateBearing(
    userLocation.lat,
    userLocation.lng,
    destination.lat,
    destination.lng
  );

  const scored: RankedRoute[] = [];

  for (const route of routes) {
    // Calculate route bearing
    const routeBearing = calculateRouteBearing(route);
    
    // Calculate bearing difference
    const bearingDiff = bearingDifference(destBearing, routeBearing);
    
    // FILTER: Skip routes going in opposite direction (>120° off)
    if (bearingDiff > 120) continue;
    
    // Calculate proximity
    let distanceToUser: number;
    if (route.pathCoordinates && route.pathCoordinates.length >= 2) {
      const nearest = nearestPointOnRoute(
        userLocation.lat,
        userLocation.lng,
        route.pathCoordinates
      );
      distanceToUser = nearest.distanceMeters;
    } else {
      distanceToUser = calculateDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        route.origin[1],
        route.origin[0]
      );
    }
    
    // Normalize distance (0-1, closer = better)
    const maxDistance = 5000; // 5km max considered
    const distanceScore = Math.max(0, 1 - (distanceToUser / maxDistance));
    
    // Normalize bearing (0-1, aligned = better)
    const bearingScore = Math.max(0, 1 - (bearingDiff / 120));
    
    // Composite score: 60% bearing alignment + 40% proximity
    const score = (bearingScore * 0.6) + (distanceScore * 0.4);
    
    scored.push({
      ...route,
      score,
      bearingDiff,
      distanceToUser,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults);
}

/**
 * REQUIREMENT 2: Geofenced Auto-Drop-Off
 * 
 * Checks if user is within threshold radius of any station
 * Returns the station name if within radius, null otherwise
 */
export function checkGeofenceIntersection(
  userLat: number,
  userLng: number,
  stations: Array<{ name: string; lat: number; lng: number }>,
  thresholdMeters: number = 50
): { stationName: string; distanceMeters: number } | null {
  for (const station of stations) {
    const distance = calculateDistanceMeters(
      userLat,
      userLng,
      station.lat,
      station.lng
    );
    
    if (distance <= thresholdMeters) {
      return {
        stationName: station.name,
        distanceMeters: Math.round(distance),
      };
    }
  }
  
  return null;
}

/**
 * Convert array of [lat, lng] to Turf lineString for path operations
 */
export function coordinatesToLineString(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  const lngLatCoords = coords.map(([lat, lng]) => [lng, lat] as [number, number]);
  return turf.lineString(lngLatCoords);
}

/**
 * Get bearing from user to a specific route's nearest point
 * Used for directional indication
 */
export function bearingToRoute(
  userLat: number,
  userLng: number,
  route: RouteCandidate
): number {
  let targetLat: number;
  let targetLng: number;
  
  if (route.pathCoordinates && route.pathCoordinates.length >= 2) {
    const nearest = nearestPointOnRoute(userLat, userLng, route.pathCoordinates);
    targetLng = nearest.nearestPoint[0];
    targetLat = nearest.nearestPoint[1];
  } else {
    targetLng = route.origin[0];
    targetLat = route.origin[1];
  }
  
  return calculateBearing(userLat, userLng, targetLat, targetLng);
}
