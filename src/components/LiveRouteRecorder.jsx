import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../utils/api";

export default function LiveRouteRecorder({ routeName, routeUuid, onComplete, onCancel }) {
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const auth = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const liveLine = useRef(null);
  const liveMarker = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([14.5995, 120.9842], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!recording || !location) return;
    const newPoint = { lat: location.lat, lng: location.lng, timestamp: Date.now() };
    setGpsPoints(prev => {
      const last = prev[prev.length - 1];
      if (last && last.lat === newPoint.lat && last.lng === newPoint.lng) return prev;
      return [...prev, newPoint];
    });
  }, [location, recording]);

  useEffect(() => {
    if (!mapInstance.current || gpsPoints.length < 2) return;
    const coords = gpsPoints.map(p => [p.lat, p.lng]);
    if (!liveLine.current) {
      liveLine.current = L.polyline(coords, { color: "#ef4444", weight: 4, dashArray: "8 4" }).addTo(mapInstance.current);
    } else {
      liveLine.current.setLatLngs(coords);
    }
    const last = gpsPoints[gpsPoints.length - 1];
    if (!liveMarker.current) {
      liveMarker.current = L.circleMarker([last.lat, last.lng], { radius: 8, fillColor: "#ef4444", color: "#fff", weight: 3, fillOpacity: 1 }).addTo(mapInstance.current);
    } else {
      liveMarker.current.setLatLng([last.lat, last.lng]);
    }
    mapInstance.current.fitBounds(coords, { padding: [40, 40] });
  }, [gpsPoints]);

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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Live Route Recording</h3>
            <p className="text-xs text-gray-400">{routeName}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400">✕</button>
        </div>
        <div className="relative">
          <div ref={mapRef} className="h-56" />
          {recording && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> LIVE
            </div>
          )}
        </div>
        <div className="p-4 space-y-3">
          {!recording && !saved && (
            <>
              <p className="text-sm text-gray-600 text-center">Ride the route and we'll record the path. GPS pings every 3 seconds.</p>
              <button onClick={start} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600">
                {consent ? "Start Recording" : "Enable Location to Record"}
              </button>
            </>
          )}
          {recording && (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <p className="text-2xl font-black text-red-500 tabular-nums">{formatTime(elapsed)}</p>
              </div>
              <p className="text-sm text-gray-500">{gpsPoints.length} GPS points recorded</p>
              <button onClick={stop} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm">Stop Recording</button>
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
              <p className="text-sm font-bold text-green-600">Route recorded!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
