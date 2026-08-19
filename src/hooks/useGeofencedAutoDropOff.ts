import { useEffect, useRef } from 'react';
import { checkGeofenceIntersection } from '../utils/spatialCalculations';

interface Station {
  name: string;
  lat: number;
  lng: number;
}

interface UseGeofencedAutoDropOffProps {
  isTracking: boolean;
  commuteState: string;
  currentLocation: { lat: number; lng: number } | null;
  stations: Station[];
  thresholdMeters?: number;
  onStationReached: (stationName: string, distanceMeters: number) => void;
}

export function useGeofencedAutoDropOff({
  isTracking,
  commuteState,
  currentLocation,
  stations,
  thresholdMeters = 50,
  onStationReached,
}: UseGeofencedAutoDropOffProps) {
  const lastTriggeredStation = useRef<string | null>(null);
  const lastTriggerTime = useRef<number>(0);

  useEffect(() => {
    if (!isTracking || commuteState !== 'riding' || !currentLocation) {
      lastTriggeredStation.current = null;
      return;
    }

    const now = Date.now();
    if (now - lastTriggerTime.current < 5000) return;

    const result = checkGeofenceIntersection(
      currentLocation.lat,
      currentLocation.lng,
      stations,
      thresholdMeters
    );

    if (result && result.stationName !== lastTriggeredStation.current) {
      lastTriggeredStation.current = result.stationName;
      lastTriggerTime.current = now;
      onStationReached(result.stationName, result.distanceMeters);
    }
  }, [isTracking, commuteState, currentLocation, stations, thresholdMeters, onStationReached]);
}
