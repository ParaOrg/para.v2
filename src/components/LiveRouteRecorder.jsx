import { useState, useEffect, useRef } from "react";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../utils/api";

export default function LiveRouteRecorder({ routeName, routeUuid, onComplete, onCancel, externalMap, externalLayer }) {
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const auth = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const liveLine = useRef(null);
  const liveMarker = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Track GPS points
  useEffect(() => {
    if (!recording || !location) return;
    const newPoint = { lat: location.lat, lng: location.lng, timestamp: Date.now() };
    setGpsPoints(prev => {
      const last = prev[prev.length - 1];
      if (last && last.lat === newPoint.lat && last.lng === newPoint.lng) return prev;
      return [...prev, newPoint];
    });
  }, [location, recording]);

  // Draw on external map if provided
  useEffect(() => {
    const map = externalMap || null;
    const layer = externalLayer || null;
    if (!map || !layer) return;
    if (gpsPoints.length < 2) return;
    const coords = gpsPoints.map(p => [p.lat, p.lng]);
    if (!liveLine.current) {
      liveLine.current = L.polyline(coords, { color: "#ef4444", weight: 4, dashArray: "8 4" }).addTo(layer);
    } else {
      liveLine.current.setLatLngs(coords);
    }
    const last = gpsPoints[gpsPoints.length - 1];
    if (!liveMarker.current) {
      liveMarker.current = L.circleMarker([last.lat, last.lng], { radius: 8, fillColor: "#ef4444", color: "#fff", weight: 3, fillOpacity: 1 }).addTo(layer);
    } else {
      liveMarker.current.setLatLng([last.lat, last.lng]);
    }
    map.fitBounds(coords, { padding: [40, 40] });
  }, [gpsPoints, externalMap, externalLayer]);

  useEffect(() => {
    if (!recording) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [recording]);

  const start = () => {
    if (!consent) { requestConsentAndLocation(); return; }
    setRecording(true);
    setGpsPoints([]);
    startTracking();
  };

  const stop = async () => {
    clearInterval(timerRef.current);
    stopTracking();
    setRecording(false);
    setSaving(true);
    try {
      await apiPost("/commute/save", {
        client_log_id: `explore-${Date.now()}`,
        route_name: routeName,
        route_uuid: routeUuid,
        user_email: auth?.user?.email || "anonymous",
        consent_granted: consent,
        total_time_sec: elapsed,
        gps_points: gpsPoints,
        completed_at: new Date().toISOString(),
        source: "explore_tracker",
      });
      setSaved(true);
      if (onComplete) setTimeout(onComplete, 1500);
    } catch (e) { console.error("Save failed:", e); }
    setSaving(false);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,500px)]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">🎯 Live Recording</h3>
            <p className="text-xs text-gray-400 truncate">{routeName}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        
        {recording && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-500 font-bold text-sm">LIVE</span>
            <span className="text-2xl font-black text-red-500 tabular-nums ml-auto">{formatTime(elapsed)}</span>
            <span className="text-xs text-gray-400">{gpsPoints.length} pts</span>
          </div>
        )}

        <div className="px-4 pb-4">
          {!recording && !saved && (
            <button onClick={start} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600">
              {consent ? "🔴 Start Recording" : "📍 Enable Location & Record"}
            </button>
          )}
          {recording && (
            <button onClick={stop} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm">
              ⏹ Stop & Save
            </button>
          )}
          {saving && (
            <div className="text-center py-3">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 mt-1">Saving...</p>
            </div>
          )}
          {saved && (
            <div className="text-center py-3">
              <span className="text-2xl">✅</span>
              <p className="text-xs font-bold text-green-600 mt-1">Route recorded!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
