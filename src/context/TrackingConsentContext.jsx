import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";

// Haversine distance calculation (meters)
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const TrackingConsentContext = createContext(null);
const CONSENT_KEY = "para_location_consent_v1";

function readConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === "granted"; } catch { return false; }
}

export function TrackingConsentProvider({ children }) {
  const [consent, setConsent] = useState(readConsent);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const watchId = useRef(null);
  const lastLocation = useRef(null);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    lastLocation.current = null;
    setStatus((prev) => (prev === "watching" || prev === "requesting" ? "idle" : prev));
  }, []);

  const beginWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      setStatus("unsupported");
      return false;
    }
    stopTracking();
    setStatus("requesting");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp };
        
        // Deduplication: Only record if moved at least 5 meters from last point
        if (lastLocation.current) {
          const dist = haversineMeters(
            lastLocation.current.lat, lastLocation.current.lng,
            next.lat, next.lng
          );
          if (dist < 5) return; // Skip if stationary
        }
        
        lastLocation.current = next;
        setLocation(next);
        setStatus("watching");
        setError(null);
        try { window.__userLocation = [next.lat, next.lng]; } catch {}
      },
      (err) => { setError(err.message || "Location permission denied."); setStatus("error"); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000, distanceFilter: 5 }
    );
    return true;
  }, [stopTracking]);

  const grant = useCallback(() => { try { localStorage.setItem(CONSENT_KEY, "granted"); } catch {} setConsent(true); }, []);
  const deny = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, "denied"); } catch {}
    setConsent(false); setLocation(null);
    try { delete window.__userLocation; } catch {}
    stopTracking(); setStatus("denied");
  }, [stopTracking]);

  const requestConsentAndLocation = useCallback(() => { grant(); beginWatch(); }, [grant, beginWatch]);
  const startTracking = useCallback(() => {
    if (!consent) { setStatus("consent_required"); return false; }
    // Register background sync
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "REGISTER_SYNC" });
    }
    return beginWatch();
  }, [consent, beginWatch]);

  useEffect(() => { if (!consent) { stopTracking(); setLocation(null); try { delete window.__userLocation; } catch {} } }, [consent, stopTracking]);
  useEffect(() => () => stopTracking(), [stopTracking]);

  return (
    <TrackingConsentContext.Provider value={{ consent, status, error, location, grant, deny, requestConsentAndLocation, startTracking, stopTracking }}>
      {children}
    </TrackingConsentContext.Provider>
  );
}

export function useTrackingConsent() {
  const ctx = useContext(TrackingConsentContext);
  if (!ctx) throw new Error("useTrackingConsent must be used inside TrackingConsentProvider");
  return ctx;
}
