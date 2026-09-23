import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";

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

  // __GEO_STREAM_PATCHED__
  // Opt-in high-frequency location stream. Consumers that need heading/speed
  // (e.g. LiveMapBackground for pin rotation + direction cone) call
  // startLocationStream(). Everyone else keeps using `location` unchanged.
  const [streamLocation, setStreamLocation] = useState(null);
  const streamWatchId = useRef(null);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setStatus((prev) => (prev === "watching" || prev === "requesting" ? "idle" : prev));
  }, []);

  const fetchOnce = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      setStatus("unsupported");
      return false;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setLocation(next);
        setStatus("watching");
        setError(null);
        try { window.__userLocation = [next.lat, next.lng]; } catch {}
      },
      (err) => {
        setError(err.message || "Location permission denied.");
        setStatus("error");
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
    );
    return true;
  }, []);

  const grant = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, "granted"); } catch {}
    setConsent(true);
  }, []);

  const deny = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, "denied"); } catch {}
    setConsent(false);
    setLocation(null);
    try { delete window.__userLocation; } catch {}
    stopTracking();
    setStatus("denied");
  }, [stopTracking]);

  const requestConsentAndLocation = useCallback(() => {
    grant();
    fetchOnce();
  }, [grant, fetchOnce]);

  const startTracking = useCallback(() => {
    if (!consent) { setStatus("consent_required"); return false; }
    return fetchOnce();
  }, [consent, fetchOnce]);

  // ── Opt-in stream ────────────────────────────────────────
  const startLocationStream = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return false;
    if (streamWatchId.current !== null) return true; // already streaming

    streamWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          headingAccuracy: Number.isFinite(pos.coords.headingAccuracy) ? pos.coords.headingAccuracy : null,
          altitude: Number.isFinite(pos.coords.altitude) ? pos.coords.altitude : null,
          timestamp: pos.timestamp,
        };
        setStreamLocation(next);
        try { window.__userLocation = [next.lat, next.lng]; } catch {}
      },
      (err) => {
        console.warn("[streamLocation] error:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return true;
  }, []);

  const stopLocationStream = useCallback(() => {
    if (streamWatchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(streamWatchId.current);
      streamWatchId.current = null;
    }
    setStreamLocation(null);
  }, []);

  // Cleanup stream on provider unmount
  useEffect(() => () => {
    if (streamWatchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(streamWatchId.current);
      streamWatchId.current = null;
    }
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  return (
    <TrackingConsentContext.Provider
      value={{
        consent,
        status,
        error,
        location,
        grant,
        deny,
        requestConsentAndLocation,
        startTracking,
        stopTracking,
        streamLocation,
        startLocationStream,
        stopLocationStream,
      }}
    >
      {children}
    </TrackingConsentContext.Provider>
  );
}

export function useTrackingConsent() {
  return useContext(TrackingConsentContext);
}
