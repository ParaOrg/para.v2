import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import GpsIcon from '../GpsIcon';
import { useTrackingConsent } from '../../context/TrackingConsentContext';

export interface CommutePath {
  id: string;
  mode: string;         // 'walking' | 'jeepney' | 'bus' | 'train' | 'trike' | 'uv_express' | 'grab' | 'angkas'
  points: [number, number][];
  isActive: boolean;
}

interface LiveMapBackgroundProps {
  isTracking: boolean;
  commuteState: string;
  currentRouteName: string | null;
  panelHeight?: string;
  externalPinMode?: boolean;
  onExternalPinModeChange?: (active: boolean) => void;
  /** When provided, the map draws each commute segment as a colored polyline. */
  commutePaths?: CommutePath[];
  /** When true, the in-map buttons (GPS/pin/weather) are not rendered. */
  hideControls?: boolean;
}

const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];
const DEFAULT_ZOOM = 14;

const SEGMENT_COLORS: Record<string, string> = {
  walking:     '#9CA3AF',
  jeepney:     '#7A4BC8',
  bus:         '#2563EB',
  train:       '#16A34A',
  trike:       '#F59E0B',
  uv_express:  '#7A4BC8',
  grab:        '#0891B2',
  angkas:      '#DC2626',
};

export const LiveMapBackground: React.FC<LiveMapBackgroundProps> = ({
  isTracking,
  commuteState,
  currentRouteName,
  panelHeight = '40vh',
  externalPinMode = false,
  onExternalPinModeChange,
  commutePaths,
  hideControls = false,
}) => {
  // __HIDE_CONTROLS__
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const pendingPinMarkerRef = useRef<L.Marker | null>(null);
  const [currentPos, setCurrentPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [hasLocation, setHasLocation] = useState(false);
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const pinModeRef = useRef(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const gpsTrailRef = useRef<L.Polyline | null>(null);
  const gpsTrailPoints = useRef<[number, number][]>([]);
  const [routeShapePoints, setRouteShapePoints] = useState<[number, number][]>([]);
  const routeShapeRef = useRef<L.Polyline | null>(null);

  // Commute-segment paths — one polyline per segment + hop markers
  const commuteLayerRef = useRef<L.LayerGroup | null>(null);
  const commutePolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const commuteMarkersRef = useRef<Map<string, L.CircleMarker[]>>(new Map());

  // Expose route shape points for parent
  useEffect(() => {
    window.__routeShapePoints = routeShapePoints;
  }, [routeShapePoints]);

  // Listen for route-drawing events
  useEffect(() => {
    const handleStart = () => {
      setRouteShapePoints([]);
      if (routeShapeRef.current) routeShapeRef.current.remove();
      routeShapeRef.current = null;
    };
    const handleStop = () => {
      if (routeShapeRef.current) routeShapeRef.current.remove();
      routeShapeRef.current = null;
    };
    window.addEventListener('route-drawing-start', handleStart as EventListener);
    window.addEventListener('route-drawing-stop', handleStop as EventListener);
    return () => {
      window.removeEventListener('route-drawing-start', handleStart as EventListener);
      window.removeEventListener('route-drawing-stop', handleStop as EventListener);
    };
  }, []);


  const [pendingPinLocation, setPendingPinLocation] = useState<[number, number] | null>(null);
  const { location, requestConsentAndLocation } = useTrackingConsent();

  // Listen for navbar toggle
  useEffect(() => {
    const handleNavToggle = (e: CustomEvent) => {
      setNavbarOpen(e.detail?.open || false);
    };
    window.addEventListener('navbar-toggle', handleNavToggle as EventListener);
    return () => {
      window.removeEventListener('navbar-toggle', handleNavToggle as EventListener);
    };
  }, []);

  // Listen for activate-pin-mode event from parent
  useEffect(() => {
    const handleActivatePinMode = () => {
      console.log('🟢 LiveMapBackground received activate-pin-mode event');
      setPinMode(true);
      pinModeRef.current = true;
      console.log('🟢 LiveMapBackground internal pinMode set to true (event)');
    };
    window.addEventListener('activate-pin-mode', handleActivatePinMode as EventListener);
    return () => {
      window.removeEventListener('activate-pin-mode', handleActivatePinMode as EventListener);
    };
  }, []);

  // Listen for poi-form-cancelled to remove pin marker
  useEffect(() => {
    const handlePoiFormCancelled = () => {
      console.log('🟢 Removing pin marker due to form cancellation');
      if (pendingPinMarkerRef.current) {
        pendingPinMarkerRef.current.remove();
        pendingPinMarkerRef.current = null;
      }
      setPendingPinLocation(null);
    };
    window.addEventListener('poi-form-cancelled', handlePoiFormCancelled as EventListener);
    return () => {
      window.removeEventListener('poi-form-cancelled', handlePoiFormCancelled as EventListener);
    };
  }, []);

  // Sync external pinMode prop with internal state
  useEffect(() => {
    console.log('🟢 LiveMapBackground externalPinMode changed:', externalPinMode);
    if (externalPinMode) {
      setPinMode(true);
      pinModeRef.current = true;
      console.log('🟢 LiveMapBackground internal pinMode set to true');
    }
  }, [externalPinMode]);

  // Keep pinModeRef in sync with pinMode state
  useEffect(() => {
    pinModeRef.current = pinMode;
  }, [pinMode]);

  // Initialize Leaflet map
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map('contribute-map', {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    window.__paraMap = map;
    setMapReady(true);

    // Handle map click for pin mode
    map.on('click', (e: L.LeafletMouseEvent) => {
      console.log('🟢 Map clicked. pinModeRef:', pinModeRef.current);
      if (pinModeRef.current) {
        const { lat, lng } = e.latlng;
        console.log('🟢 Pin mode active! Dropping pin at:', lat, lng);
        setPendingPinLocation([lat, lng]);
        setPinMode(false);
        pinModeRef.current = false;
        onExternalPinModeChange?.(false);
        
        // Create visual pin marker on map
        if (pendingPinMarkerRef.current) {
          pendingPinMarkerRef.current.remove();
        }
        const pinIcon = L.divIcon({
          className: 'pin-marker',
          html: '<div style="font-size: 36px; filter: drop-shadow(0 3px 3px rgba(0,0,0,0.3));">📍</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });
        pendingPinMarkerRef.current = L.marker([lat, lng], { icon: pinIcon })
          .addTo(mapRef.current!)
          .bindPopup('📍 New Pin Location', { closeButton: true });
        pendingPinMarkerRef.current.openPopup();
        
        console.log('🟢 Visual pin marker added to map');
        
        // Dispatch custom event for parent to handle
        window.dispatchEvent(new CustomEvent('poi-location-selected', { 
          detail: { lat, lng } 
        }));
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      window.__paraMap = null;
    };
  }, []);

  // GPS Locate — manual button press. Centers the map ONLY when user taps.
  // If location isn't available yet, request it; the effect below will
  // center the map once location arrives.
  const locateMap = () => {
    if (location && mapRef.current) {
      mapRef.current.setView([location.lat, location.lng], 17, { animate: true });
      setCurrentPos([location.lat, location.lng]);
      setHasLocation(true);
    } else {
      requestConsentAndLocation();
    }
  };

  // If the user tapped locate and location arrived asynchronously, center.
  // We only do this ONCE per request to avoid fighting the user.
  // Never auto-centers on mount.
  const pendingCenterRef = useRef(false);
  useEffect(() => {
    if (location && mapRef.current && pendingCenterRef.current) {
      mapRef.current.setView([location.lat, location.lng], 17, { animate: true });
      setCurrentPos([location.lat, location.lng]);
      setHasLocation(true);
      pendingCenterRef.current = false;
    }
  }, [location]);

  // Mark that a center is pending when the user taps GPS without a location yet
  const locateMapWithPending = () => {
    if (!location) pendingCenterRef.current = true;
    locateMap();
  };
  // __LOCATE_FIXED__

  // __LOCATION_PROMPT_REMOVED__

  // Timer for tracking
  useEffect(() => {
    if (!isTracking) {
      setElapsedTime(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTracking]);

  // GPS trail when tracking
  useEffect(() => {
    if (!isTracking || !location || !mapRef.current) {
      if (gpsTrailRef.current) {
        gpsTrailRef.current.remove();
        gpsTrailRef.current = null;
        gpsTrailPoints.current = [];
      }
      return;
    }
    
    const newPoint: [number, number] = [location.lat, location.lng];
    gpsTrailPoints.current = [...gpsTrailPoints.current, newPoint];
    
    // Store GPS points for current segment based on commute state
    if (commuteState === 'riding') {
      window.__currentSegmentGpsPoints = gpsTrailPoints.current;
    } else if (commuteState === 'walking') {
      window.__currentWalkingGpsPoints = gpsTrailPoints.current;
    }
    
    // trailStyle is now properly scoped outside the if/else block
    const trailStyle = commuteState === 'riding' 
      ? { color: '#7A4BC8', weight: 5, opacity: 0.9, dashArray: '' }
      : commuteState === 'waiting'
      ? { color: '#F59E0B', weight: 3, opacity: 0.7, dashArray: '1, 5' }
      : { color: '#9CA3AF', weight: 3, opacity: 0.6, dashArray: '5, 5' };
    
    if (!gpsTrailRef.current && mapRef.current) {
      gpsTrailRef.current = L.polyline(gpsTrailPoints.current, trailStyle).addTo(mapRef.current);
    } else if (gpsTrailRef.current) {
      gpsTrailRef.current.setLatLngs(gpsTrailPoints.current);
      gpsTrailRef.current.setStyle(trailStyle);
    }
  }, [location, isTracking, commuteState]);

  // Commute paths — draws each segment in its mode color.
  // Only active when `commutePaths` is provided (i.e., on /contribute-v2).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Initialize the layer group once
    if (!commuteLayerRef.current) {
      commuteLayerRef.current = L.layerGroup().addTo(map);
    }
    const layer = commuteLayerRef.current;

    // If no commutePaths provided, do nothing (leave existing trail logic alone)
    if (!commutePaths) return;

    // Clear existing commute polylines and markers that are no longer relevant
    const incomingIds = new Set(commutePaths.map((p) => p.id));
    commutePolylinesRef.current.forEach((poly, id) => {
      if (!incomingIds.has(id)) {
        poly.remove();
        commutePolylinesRef.current.delete(id);
      }
    });
    commuteMarkersRef.current.forEach((markers, id) => {
      if (!incomingIds.has(id)) {
        markers.forEach((m) => m.remove());
        commuteMarkersRef.current.delete(id);
      }
    });

    // Draw or update each path
    commutePaths.forEach((path) => {
      // Skip empty segments
      if (!path.points || path.points.length < 2) return;

      const color = SEGMENT_COLORS[path.mode] || '#7A4BC8';
      const isWalking = path.mode === 'walking';
      const weight = path.isActive ? 6 : 4;
      const opacity = path.isActive ? 1 : 0.75;
      const dashArray = isWalking ? '6 6' : undefined;

      let poly = commutePolylinesRef.current.get(path.id);
      if (!poly) {
        poly = L.polyline(path.points, {
          color,
          weight,
          opacity,
          dashArray,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);
        commutePolylinesRef.current.set(path.id, poly);
      } else {
        poly.setLatLngs(path.points);
        poly.setStyle({ color, weight, opacity, dashArray });
      }

      // Hop-on / hop-off markers at start & end of each segment
      let markers = commuteMarkersRef.current.get(path.id);
      if (!markers) {
        const startMarker = L.circleMarker(path.points[0], {
          radius: 6,
          fillColor: color,
          color: '#fff',
          weight: 2,
          fillOpacity: 1,
        })
          .addTo(layer)
          .bindTooltip(`Start ${path.mode}`, { direction: 'top' });
        const endMarker = L.circleMarker(path.points[path.points.length - 1], {
          radius: 6,
          fillColor: '#fff',
          color,
          weight: 3,
          fillOpacity: 1,
        })
          .addTo(layer)
          .bindTooltip(`End ${path.mode}`, { direction: 'top' });
        markers = [startMarker, endMarker];
        commuteMarkersRef.current.set(path.id, markers);
      } else {
        markers[0].setLatLng(path.points[0]);
        markers[0].setStyle({ fillColor: color, color: '#fff' });
        markers[1].setLatLng(path.points[path.points.length - 1]);
        markers[1].setStyle({ fillColor: '#fff', color });
      }
    });

    // Fit bounds ONCE per flow, on the first two points. After that the user
    // owns the map — panning/zooming is never overridden by GPS ticks.
    const allPoints = commutePaths.flatMap((p) => p.points);
    if (allPoints.length >= 2 && !(window as any).__hasFitThisFlow) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      (window as any).__hasFitThisFlow = true;
    }
    // Reset the flag when all paths clear (flow ends / new flow starts)
    if (allPoints.length === 0) {
      (window as any).__hasFitThisFlow = false;
    }
  }, [commutePaths, mapReady]);

  // GPS marker — only when location is available
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    if (location?.lat && location?.lng) {
      if (!markerRef.current) {
        markerRef.current = L.circleMarker([location.lat, location.lng], {
          radius: 10,
          fillColor: '#4285F4',
          color: '#fff',
          weight: 3,
          fillOpacity: 1,
          zIndexOffset: 9999,
        }).addTo(mapRef.current)
          .bindTooltip('You are here', { permanent: true, direction: 'top' });
      } else {
        markerRef.current.setLatLng([location.lat, location.lng]);
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [location, mapReady]);

  // Trail — only when tracking
  useEffect(() => {
    if (!mapRef.current) return;

    if (isTracking) {
      if (!trailLayerRef.current) {
        trailLayerRef.current = L.polyline([], {
          color: '#7A4BC8',
          weight: 4,
          opacity: 0.8,
        }).addTo(mapRef.current);
      }
      const currentTrail = trailLayerRef.current?.getLatLngs() as L.LatLng[] || [];
      trailLayerRef.current?.setLatLngs([...currentTrail, currentPos]);
      
      // Off-course detection: if user deviates significantly from recent path
      if (currentTrail.length > 5) {
        const recentPoints = currentTrail.slice(-5);
        const avgLat = recentPoints.reduce((sum, p) => sum + (p as L.LatLng).lat, 0) / recentPoints.length;
        const avgLng = recentPoints.reduce((sum, p) => sum + (p as L.LatLng).lng, 0) / recentPoints.length;
        const deviation = Math.sqrt(
          Math.pow(currentPos[0] - avgLat, 2) + 
          Math.pow(currentPos[1] - avgLng, 2)
        ) * 111000; // Rough meters
        
        if (deviation > 500 && currentRouteName) {
          // Dispatch off-course alert
          window.dispatchEvent(new CustomEvent('off-course-alert', { 
            detail: { deviation: Math.round(deviation), routeName: currentRouteName } 
          }));
        }
      }
    } else {
      if (trailLayerRef.current) {
        trailLayerRef.current.remove();
        trailLayerRef.current = null;
      }
    }
  }, [isTracking, currentPos, currentRouteName]);

  return (
    <div className="relative w-full h-full">
      {/* Leaflet Map */}
      <div id="contribute-map" className="absolute inset-0 z-0" style={{ zIndex: 0, pointerEvents: "auto" }} />

      {/* Map Controls — top right. Hidden when `hideControls` is true. */}
      {!hideControls && (
      <div className="absolute right-4 z-[9999] flex flex-col gap-2" style={{ top: "calc(env(safe-area-inset-top) + 5.5rem)" }}>
        {/* __CONTROLS_HIDDEN__ */}
        {/* GPS Locate Button */}
        {!navbarOpen && (
        <button
          onClick={locateMapWithPending}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 border border-gray-200"
        >
          <GpsIcon size={30} color="#7A4BC8" />
        </button>
        )}

        {/* Add Pin Button */}
        {!navbarOpen && (
        <button
          onClick={() => setPinMode(!pinMode)}
          className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center border transition-colors ${
            pinMode 
              ? 'bg-[#7A4BC8] text-white border-[#7A4BC8]' 
              : 'bg-white text-[#381D65] border-gray-200 hover:bg-gray-50'
          }`}
          title="Add Pin"
        >
          <span className="text-base">📍</span>
        </button>
        )}

        {/* Weather Button — opens full WeatherPage */}
        {!navbarOpen && (
        <button
          onClick={() => window.dispatchEvent(new Event("para-show-weather"))}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 border border-gray-200"
        >
          <span className="text-base">🌤️</span>
        </button>
        )}

      </div>
      )}




      {/* Recording Timer Pill */}
      {false && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-red-500 text-white rounded-full px-5 py-2 flex items-center gap-2 shadow-2xl">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="font-black text-lg tabular-nums">
            {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
          </span>
          <span className="text-xs font-bold">
            {commuteState === 'riding' ? `🚐 ${currentRouteName || 'Riding'}` : '🚶 Walking'}
          </span>
        </div>
      )}

      {/* Pin Mode Prompt */}
      {pinMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] bg-[#7A4BC8] text-white rounded-full px-5 py-3 shadow-lg pointer-events-none">
          <p className="text-[13px] font-poppins font-medium whitespace-nowrap">
            Click anywhere to add pin
          </p>
        </div>
      )}

    </div>
  );
};
