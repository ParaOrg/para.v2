import { useState, useEffect, useRef } from "react";
import L from "leaflet";
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [pois, setPois] = useState([]);
  const [showPoiForm, setShowPoiForm] = useState(false);
  const [poiName, setPoiName] = useState("");
  const [poiType, setPoiType] = useState("landmark");
  const [poiComment, setPoiComment] = useState("");
  const [isLoop, setIsLoop] = useState(false);
  const liveLine = useRef(null);
  const liveMarker = useRef(null);
  const gpsCircle = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Track GPS
  useEffect(() => {
    if (!recording || !location) return;
    const newPoint = { lat: location.lat, lng: location.lng, timestamp: Date.now() };
    setGpsPoints(prev => {
      const last = prev[prev.length - 1];
      if (last && last.lat === newPoint.lat && last.lng === newPoint.lng) return prev;
      return [...prev, newPoint];
    });
  }, [location, recording]);

  // Draw GPS dot on main map
  useEffect(() => {
    const map = externalMap;
    const layer = externalLayer;
    if (!map || !layer || !consent) return;
    if (location?.lat && location?.lng) {
      if (!gpsCircle.current) {
        gpsCircle.current = L.circleMarker([location.lat, location.lng], {
          radius: 10, fillColor: "#4285F4", color: "#fff", weight: 3, fillOpacity: 1, zIndexOffset: 9999,
        }).addTo(layer).bindTooltip("You are here", { permanent: true, direction: "top" });
      } else {
        gpsCircle.current.setLatLng([location.lat, location.lng]);
      }
      map.setView([location.lat, location.lng], Math.max(map.getZoom(), 16), { animate: true });
    }
  }, [consent, location, externalMap, externalLayer]);

  // Draw live line
  useEffect(() => {
    const map = externalMap;
    const layer = externalLayer;
    if (!map || !layer) return;
    if (gpsPoints.length < 2) return;
    const coords = gpsPoints.map(p => [p.lat, p.lng]);
    if (!liveLine.current) {
      liveLine.current = L.polyline(coords, { color: "#ef4444", weight: 4 }).addTo(layer);
    } else {
      liveLine.current.setLatLngs(coords);
    }
    if (!liveMarker.current) {
      const last = gpsPoints[gpsPoints.length - 1];
      liveMarker.current = L.circleMarker([last.lat, last.lng], { radius: 6, fillColor: "#ef4444", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(layer);
    } else {
      const last = gpsPoints[gpsPoints.length - 1];
      liveMarker.current.setLatLng([last.lat, last.lng]);
    }
    map.fitBounds(coords, { padding: [60, 60], maxZoom: 16 });
  }, [gpsPoints, externalMap, externalLayer]);

  // Timer
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
    setPois([]);
    startTracking();
    setPanelOpen(false); // collapse so map is visible
  };

  const addPoi = () => {
    if (!poiName.trim()) return;
    const poi = {
      name: poiName.trim(),
      type: poiType,
      comment: poiComment.trim(),
      lat: location?.lat,
      lng: location?.lng,
      timestamp: Date.now(),
    };
    setPois(prev => [...prev, poi]);
    setPoiName("");
    setPoiComment("");
    setShowPoiForm(false);
    // Drop marker on map
    if (externalLayer && location) {
      L.circleMarker([location.lat, location.lng], {
        radius: 7, fillColor: poiType === "terminal" ? "#f59e0b" : "#22c55e", color: "#fff", weight: 2, fillOpacity: 1,
      }).addTo(externalLayer).bindTooltip(`${poiType}: ${poi.name}`, { permanent: true, direction: "top" });
    }
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
        pois,
        is_loop: isLoop,
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(95vw,450px)]">
      {/* Expanded panel */}
      {panelOpen && !saved && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Track Route</h3>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">{routeName}</p>
            </div>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>

          <div className="p-4 space-y-3">
            {/* Loop toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={isLoop} onChange={(e) => setIsLoop(e.target.checked)} className="w-4 h-4" />
              This is a loop route (no start/end)
            </label>

            {/* Start button */}
            {!recording && (
              <button onClick={start} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600">
                {consent ? "🔴 Start Recording" : "📍 Enable Location & Record"}
              </button>
            )}

            {/* POI form toggle */}
            {recording && (
              <button onClick={() => setShowPoiForm(!showPoiForm)} className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold">
                📍 Add POI ({pois.length})
              </button>
            )}

            {/* POI form */}
            {showPoiForm && recording && (
              <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                <input value={poiName} onChange={(e) => setPoiName(e.target.value)} placeholder="Name (e.g. Terminal, Landmark)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <select value={poiType} onChange={(e) => setPoiType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="landmark">Landmark</option>
                  <option value="terminal">Terminal</option>
                  <option value="stop">Stop</option>
                  <option value="other">Other</option>
                </select>
                <input value={poiComment} onChange={(e) => setPoiComment(e.target.value)} placeholder="Comment (for admin review)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <button onClick={addPoi} className="w-full py-2 bg-[#7A4BC8] text-white rounded-lg text-sm font-bold">Add POI</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed recording bar */}
      {recording && !panelOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-500 font-bold text-xs">LIVE</span>
          <span className="text-xl font-black text-red-500 tabular-nums">{formatTime(elapsed)}</span>
          <span className="text-[10px] text-gray-400">{gpsPoints.length} pts</span>
          <button onClick={() => setPanelOpen(true)} className="text-gray-400 ml-auto text-sm">☰</button>
        </div>
      )}

      {/* Stop button when recording + panel open */}
      {recording && panelOpen && (
        <div className="px-4 pb-4">
          <button onClick={stop} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm">
            ⏹ Stop & Save
          </button>
        </div>
      )}

      {/* Saving / saved */}
      {saving && (
        <div className="bg-white rounded-2xl shadow-2xl px-4 py-4 text-center">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500 mt-1">Saving...</p>
        </div>
      )}
      {saved && (
        <div className="bg-white rounded-2xl shadow-2xl px-4 py-4 text-center">
          <span className="text-2xl">✅</span>
          <p className="text-xs font-bold text-green-600 mt-1">Route recorded!</p>
        </div>
      )}
    </div>
  );
}
