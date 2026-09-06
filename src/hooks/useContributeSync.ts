import { useState, useRef, useCallback } from 'react';
import { offlineBuffer } from '../utils/offlineBuffer';
import { getStopsForVehicle, filterStops } from '../utils/stopDatabase';
import { getOrCreateInstallId, generateClientLogId } from '../utils/offlineBuffer';

export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface Segment {
  mode: 'walking' | 'riding' | 'idle';
  startTime: number;
  endTime: number;
  gpsPoints: GPSPoint[];
  routeName?: string | null;
  durationSec: number;
}

export interface ContributeSession {
  segments: Segment[];
  totalDistanceM: number;
  totalFare: number;
  destinationGoal?: { lat: number; lng: number; name: string } | null;
  myStopMarkers: Array<{ lat: number; lng: number; name: string; timestamp: number }>;
  routeRecording: {
    active: boolean;
    shapePoints: Array<{ lat: number; lng: number }>;
    routeName: string;
  } | null;
  gpsPoints: GPSPoint[];
  trackingStartTime: number | null;
}

export function useContributeSync() {
  const [session, setSession] = useState<ContributeSession>({
    segments: [],
    totalDistanceM: 0,
    totalFare: 0,
    destinationGoal: null,
    myStopMarkers: [],
    routeRecording: null,
    gpsPoints: [],
    trackingStartTime: null,
  });

  const gpsWatchRef = useRef<number | null>(null);

  // Start GPS tracking for commute
  const startCommuteTracking = useCallback(() => {
    setSession(prev => ({
      ...prev,
      gpsPoints: [],
      trackingStartTime: Date.now(),
    }));

    if (navigator.geolocation) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const point: GPSPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp || Date.now(),
            accuracy: pos.coords.accuracy,
          };
          setSession(prev => ({
            ...prev,
            gpsPoints: [...prev.gpsPoints, point],
          }));
        },
        (err) => console.error('GPS error:', err.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
  }, []);

  // Stop GPS tracking and return collected points
  const stopCommuteTracking = useCallback((): GPSPoint[] => {
    if (gpsWatchRef.current) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    return session.gpsPoints;
  }, [session.gpsPoints]);

  // Start GPS tracking for route recording
  const startRouteRecording = useCallback((routeName: string) => {
    setSession(prev => ({
      ...prev,
      routeRecording: {
        active: true,
        shapePoints: [],
        routeName,
      },
    }));

    if (navigator.geolocation) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setSession(prev => {
            if (!prev.routeRecording?.active) return prev;
            return {
              ...prev,
              routeRecording: {
                ...prev.routeRecording,
                shapePoints: [...prev.routeRecording.shapePoints, point],
              },
            };
          });
        },
        (err) => console.error('GPS error:', err.message),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
  }, []);

  // Stop route recording
  const stopRouteRecording = useCallback(() => {
    if (gpsWatchRef.current) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    setSession(prev => ({
      ...prev,
      routeRecording: prev.routeRecording ? { ...prev.routeRecording, active: false } : null,
    }));
  }, []);

  // Add My Stop marker
  const addMyStop = useCallback((lat: number, lng: number, name: string = 'My Stop') => {
    setSession(prev => ({
      ...prev,
      myStopMarkers: [...prev.myStopMarkers, { lat, lng, name, timestamp: Date.now() }],
    }));
  }, []);

  // Set destination goal
  const setDestinationGoal = useCallback((lat: number, lng: number, name: string) => {
    setSession(prev => ({
      ...prev,
      destinationGoal: { lat, lng, name },
    }));
  }, []);

  // Stop autofill via stopDatabase
  const searchStops = useCallback((vehicle: string, query: string) => {
    const allStops = getStopsForVehicle(vehicle);
    return filterStops(allStops, query).slice(0, 8);
  }, []);

  // Build commute payload with full GPS data
  const buildCommutePayload = useCallback((
    routeName: string,
    totalTimeSec: number,
    mode: string,
    city: string,
    region: string
  ) => {
    const gpsPoints = session.gpsPoints;
    const totalDistanceM = calculateTotalDistance(gpsPoints);
    
    // Build segments from GPS points
    const segments: Segment[] = [{
      mode: classifyMode(gpsPoints),
      startTime: gpsPoints[0]?.timestamp || Date.now(),
      endTime: gpsPoints[gpsPoints.length - 1]?.timestamp || Date.now(),
      gpsPoints,
      routeName: routeName !== 'Personal Commute' ? routeName : null,
      durationSec: totalTimeSec,
    }];

    const gpsTrack = gpsPoints.map(p => [p.lat, p.lng]);

    return {
      track_uuid: crypto.randomUUID(),
      client_log_id: generateClientLogId(),
      install_id: getOrCreateInstallId(),
      user_id: null,
      route_name: routeName,
      total_time_sec: totalTimeSec,
      distance_m: parseFloat(totalDistanceM.toFixed(2)),
      gps_track: gpsTrack,
      gps_points: gpsPoints.length,
      raw_payload: {
        source: 'contribute_button_panel',
        user_id: null,
        route_name: routeName,
        total_time_sec: totalTimeSec,
        segments,
        distance_m: parseFloat(totalDistanceM.toFixed(2)),
        gps_points: gpsPoints,
      },
      mode,
      city,
      region,
      source: 'contribute_button_panel',
      segments,
      is_loop: false,
      ride_count: 0,
    };
  }, [session.gpsPoints]);

  // Save to offline buffer
  const syncToOffline = useCallback(() => {
    offlineBuffer.addCommute({
      ...session,
      timestamp: Date.now(),
    });
  }, [session]);

  return {
    session,
    startCommuteTracking,
    stopCommuteTracking,
    buildCommutePayload,
    startRouteRecording,
    stopRouteRecording,
    addMyStop,
    setDestinationGoal,
    searchStops,
    syncToOffline,
  };
}

// Helper: Calculate total distance from GPS points
function calculateTotalDistance(points: GPSPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    );
  }
  return total;
}

// Helper: Haversine distance
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Classify mode based on average speed
function classifyMode(points: GPSPoint[]): 'walking' | 'riding' | 'idle' {
  if (points.length < 2) return 'idle';
  const totalDistance = calculateTotalDistance(points);
  const totalTimeSec = (points[points.length - 1].timestamp - points[0].timestamp) / 1000;
  if (totalTimeSec <= 0) return 'idle';
  const avgSpeedKmh = (totalDistance / 1000) / (totalTimeSec / 3600);
  if (avgSpeedKmh < 1) return 'idle';
  if (avgSpeedKmh < 5) return 'walking';
  return 'riding';
}
