import { useState, useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { apiPost } from "../utils/api";

export default function RouteUploader() {
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView([14.5995, 120.9842], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!recording || !location) return;
    setGpsPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.timestamp === location.timestamp) return prev;
      return [...prev, { lat: location.lat, lng: location.lng, accuracy: location.accuracy, timestamp: location.timestamp }];
    });
  }, [location, recording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTracking();
    };
  }, [stopTracking]);

  const start = () => {
    if (!consent) {
      requestConsentAndLocation();
      return;
    }
    setRecording(true);
    setGpsPoints([]);
    startTimeRef.current = Date.now();
    startTracking();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopTracking();
    setRecording(false);
    setSaving(true);
    try {
      await apiPost("/commute/save", {
        client_log_id: `route-upload-${Date.now()}`,
        consent_granted: consent,
        total_time_sec: elapsed,
        gps_points: gpsPoints.slice(0, 500),
        completed_at: new Date().toISOString(),
        source: "route_uploader_page",
      });
      setSaved(true);
    } catch (e) {
      console.error("Save failed:", e);
    }
    setSaving(false);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative h-[60vh]">
        <div ref={mapRef} className="h-full w-full" />
        {location && (
          <button
            onClick={() => mapInstance.current?.setView([location.lat, location.lng], 17, { animate: true })}
            className="absolute bottom-4 right-4 bg-white rounded-full p-3 shadow-lg z-10 text-lg"
          >
            ⊕
          </button>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {!recording && !saved && (
          <button
            onClick={start}
            className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm"
          >
            {consent ? "Start Recording Route" : "Enable Location to Record"}
          </button>
        )}

        {recording && (
          <div className="text-center space-y-3">
            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto animate-pulse" />
            <p className="text-2xl font-black text-red-500 tabular-nums">{formatTime(elapsed)}</p>
            <p className="text-xs text-gray-400">{gpsPoints.length} GPS points</p>
            <button
              onClick={stop}
              className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm"
            >
              Stop Recording
            </button>
          </div>
        )}

        {saving && (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Saving route...</p>
          </div>
        )}

        {saved && (
          <div className="text-center space-y-2">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-bold text-green-600">Route saved to community submissions!</p>
          </div>
        )}
      </div>
    </div>
  );
}
