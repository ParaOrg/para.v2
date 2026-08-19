import { useState, useRef, useCallback } from 'react';
import { offlineBuffer } from '../utils/offlineBuffer';
import { getStopsForVehicle, filterStops } from '../utils/stopDatabase';

export interface ContributeSession {
  segments: Array<{
    type: 'walking' | 'riding';
    vehicle?: string;
    routeName?: string;
    fare?: number;
    startTime: number;
    endTime: number | null;
    gpsPoints: Array<{ lat: number; lng: number; timestamp: number }>;
    boardingStop?: string;
    alightingStop?: string;
  }>;
  totalDistanceM: number;
  totalFare: number;
  destinationGoal?: { lat: number; lng: number; name: string } | null;
  myStopMarkers: Array<{ lat: number; lng: number; name: string; timestamp: number }>;
  routeRecording: {
    active: boolean;
    shapePoints: Array<{ lat: number; lng: number }>;
    routeName: string;
  } | null;
}

export function useContributeSync() {
  const [session, setSession] = useState<ContributeSession>({
    segments: [],
    totalDistanceM: 0,
    totalFare: 0,
    destinationGoal: null,
    myStopMarkers: [],
    routeRecording: null,
  });

  const gpsWatchRef = useRef<number | null>(null);

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
        (err) => console.error('GPS error:', err),
        { enableHighAccuracy: true, maximumAge: 5000 }
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

  // Save to offline buffer
  const syncToOffline = useCallback(() => {
    offlineBuffer.enqueue({
      type: 'commute-save',
      payload: session,
      timestamp: Date.now(),
    });
  }, [session]);

  return {
    session,
    startRouteRecording,
    stopRouteRecording,
    addMyStop,
    setDestinationGoal,
    searchStops,
    syncToOffline,
  };
}
