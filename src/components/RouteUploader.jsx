import { useState, useEffect, useRef } from "react";
import { getApiBaseUrl } from "../utils/api";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { apiPost } from "../utils/api";

const API = getApiBaseUrl();

export default function RouteUploader({ onDone, onCancel }) {
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const [routeName, setRouteName] = useState("");
  const [referenceRoutes, setReferenceRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/routes/public/reference`)
      .then(r => r.json())
      .then(d => {
        const routes = d.routes || [];
        setReferenceRoutes(routes);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!routeName.trim()) {
      setFilteredRoutes(referenceRoutes.slice(0, 20));
      return;
    }
    const q = routeName.toLowerCase();
    setFilteredRoutes(referenceRoutes.filter(r => (r.route_name || "").toLowerCase().includes(q)).slice(0, 10));
  }, [routeName, referenceRoutes]);

  useEffect(() => {
    if (!recording || !location) return;
    setGpsPoints(prev => {
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
      await edgePost("commute-save", {
        client_log_id: `route-upload-${Date.now()}`,
        consent_granted: consent,
        route_name: routeName,
        total_time_sec: elapsed,
        gps_points: gpsPoints.slice(0, 500),
        completed_at: new Date().toISOString(),
        source: "route_uploader",
      });
      setSaved(true);
      if (onDone) setTimeout(onDone, 1500);
    } catch (e) {
      console.error("Save failed:", e);
    }
    setSaving(false);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="bg-white rounded-xl p-4 space-y-3">
      {!recording && !saved && (
        <>
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600">Route Name</label>
            <input
              value={routeName}
              onChange={(e) => { setRouteName(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Type to search or enter new route name..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none mt-1"
            />
            {showDropdown && filteredRoutes.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filteredRoutes.map((r, i) => (
                  <button
                    key={r.id || i}
                    type="button"
                    onMouseDown={() => { setRouteName(r.route_name); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50"
                  >
                    {r.route_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={start}
            disabled={!routeName.trim()}
            className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {consent ? "Start Recording" : "Enable Location to Record"}
          </button>
        </>
      )}

      {recording && (
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-gray-800">{routeName}</p>
          <div className="w-3 h-3 bg-red-500 rounded-full mx-auto animate-pulse" />
          <p className="text-2xl font-black text-red-500 tabular-nums">{formatTime(elapsed)}</p>
          <p className="text-xs text-gray-400">{gpsPoints.length} GPS points</p>
          <button onClick={stop} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm">
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
          <p className="text-sm font-bold text-green-600">Route saved!</p>
        </div>
      )}
    </div>
  );
}
