import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import GpsIcon from '../GpsIcon';
import { useTrackingConsent } from '../../context/TrackingConsentContext';

interface LiveMapBackgroundProps {
  isTracking: boolean;
  commuteState: string;
  currentRouteName: string | null;
  panelHeight?: string;
}

const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];
const DEFAULT_ZOOM = 14;

export const LiveMapBackground: React.FC<LiveMapBackgroundProps> = ({
  isTracking,
  commuteState,
  currentRouteName,
  panelHeight = '40vh',
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);
  const [currentPos, setCurrentPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [hasLocation, setHasLocation] = useState(false);
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [pinMode, setPinMode] = useState(false);
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

  // Initialize Leaflet map
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map('contribute-map', {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    window.__paraMap = map;
    setMapReady(true);

    // Handle map click for pin mode
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pinMode) {
        const { lat, lng } = e.latlng;
        setPendingPinLocation([lat, lng]);
        setPinMode(false);
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

  // GPS Locate
  const locateMap = () => {
    if (location) {
      mapRef.current?.setView([location.lat, location.lng], 17, { animate: true });
    } else {
      requestConsentAndLocation();
    }
  };

  // Auto-center when location becomes available
  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.setView([location.lat, location.lng], 17, { animate: true });
      setCurrentPos([location.lat, location.lng]);
      setHasLocation(true);
    }
  }, [location]);

  // Prompt for location consent on mount if not granted
  useEffect(() => {
    if (!location && mapRef.current) {
      const timer = setTimeout(() => {
        // Dispatch event for parent to show location prompt
        window.dispatchEvent(new CustomEvent('location-prompt', { detail: { reason: 'auto-center' } }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [location]);

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
      <div id="contribute-map" className="absolute inset-0 z-0" style={{ zIndex: 1 }} />

      {/* Map Controls — top right */}
      <div className="absolute top-20 right-4 z-[9999] flex flex-col gap-2">
        {/* GPS Locate Button */}
        {!navbarOpen && (
        <button
          onClick={locateMap}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 border border-gray-200"
        >
          <GpsIcon size={20} color="#7A4BC8" />
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

      </div>




      {/* Pin Mode Prompt */}
      {pinMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[500] bg-[#7A4BC8] text-white rounded-full px-5 py-3 shadow-lg pointer-events-none">
          <p className="text-[13px] font-poppins font-medium whitespace-nowrap">
            Click anywhere to add pin
          </p>
        </div>
      )}

      {/* Status Bar — centered, just above chat panel */}
      {!navbarOpen && (
      <div className="absolute left-1/2 transform -translate-x-1/2 z-[400] bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm whitespace-nowrap" style={{ bottom: `calc(70px + ${panelHeight} + 6px)` }}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-[10px] font-semibold text-gray-800">
            {isTracking ? `Tracking: ${currentRouteName || 'Walking'}` : 'Not Tracking'}
          </span>
          <span className="text-[10px] text-gray-500">
            • {commuteState === 'riding' ? '🚐' : '🚶'} GPS active
          </span>
        </div>
      </div>
      )}
    </div>
  );
};
