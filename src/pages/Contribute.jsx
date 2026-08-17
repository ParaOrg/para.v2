import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../utils/api";
import { offlineBuffer } from "../utils/offlineBuffer";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const CENTER = [14.5995, 120.9842];

const VEHICLES = [
  { id: "jeepney", label: "Jeep", icon: "🚐" },
  { id: "bus", label: "Bus", icon: "🚌" },
  { id: "train", label: "Train", icon: "🚆" },
  { id: "tricycle", label: "Trike", icon: "🛺" },
  { id: "walk", label: "Walk", icon: "🚶" },
  { id: "uv_express", label: "UV", icon: "🚐" },
  { id: "grab", label: "Grab", icon: "🚗" },
  { id: "angkas", label: "Angkas", icon: "🏍️" },
];

const POI_TYPES = [
  { id: "sari_sari", label: "Sari-sari Store", icon: "🏪" },
  { id: "lugawan", label: "Lugawan", icon: "🍜" },
  { id: "resto", label: "Restaurant", icon: "🍽️" },
  { id: "cafe", label: "Cafe", icon: "☕" },
  { id: "landmark", label: "Landmark", icon: "📍" },
  { id: "terminal", label: "Terminal", icon: "🚏" },
  { id: "waiting_spot", label: "Waiting Spot", icon: "⏳" },
  { id: "other", label: "Other", icon: "📌" },
];

export default function Contribute() {
  // Tabs
  const [tab, setTab] = useState("my_routes"); // my_routes | stops | pois | shapes
  
  // GPS
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const auth = useAuth();
  
  // Map
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const drawLayerRef = useRef(null);
  const liveMarkerRef = useRef(null);
  
  // Route recording
  const [recording, setRecording] = useState(false);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [vehicle, setVehicle] = useState("jeepney");
  const [routeLabel, setRouteLabel] = useState("");
  const [savedRoutes, setSavedRoutes] = useState([]);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // POI dropping
  const [poiMode, setPoiMode] = useState(false);
  const [poiType, setPoiType] = useState("sari_sari");
  const [poiName, setPoiName] = useState("");
  const [savedPois, setSavedPois] = useState([]);

  // Stops
  const [stopMode, setStopMode] = useState(false);
  const [stopName, setStopName] = useState("");
  const [isFormalStop, setIsFormalStop] = useState(false);
  const [savedStops, setSavedStops] = useState([]);

  // Map init
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView(CENTER, 14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    drawLayerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;

    // Click to drop pin
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      if (poiMode) addPoiAt(lat, lng);
      if (stopMode) addStopAt(lat, lng);
    });
  }, [poiMode, stopMode, poiType, poiName, stopName, isFormalStop]);

  // Live GPS
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !consent || !location) return;
    if (!liveMarkerRef.current) {
      liveMarkerRef.current = L.circleMarker([location.lat, location.lng], {
        radius: 10, fillColor: "#4285F4", color: "#fff", weight: 3, fillOpacity: 1, zIndexOffset: 9999,
      }).addTo(map).bindTooltip("You are here", { permanent: true, direction: "top" });
    } else {
      liveMarkerRef.current.setLatLng([location.lat, location.lng]);
    }
    map.setView([location.lat, location.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [consent, location]);

  // Recording GPS trail
  useEffect(() => {
    if (!recording || !location) return;
    setGpsPoints(prev => {
      const last = prev[prev.length - 1];
      if (last && last.lat === location.lat && last.lng === location.lng) return prev;
      const newPoints = [...prev, { lat: location.lat, lng: location.lng, timestamp: Date.now() }];
      if (drawLayerRef.current && newPoints.length > 1) {
        drawLayerRef.current.clearLayers();
        const coords = newPoints.map(p => [p.lat, p.lng]);
        L.polyline(coords, { color: "#7A4BC8", weight: 5, opacity: 0.8 }).addTo(drawLayerRef.current);
      }
      return newPoints;
    });
  }, [location, recording]);

  // Timer
  useEffect(() => {
    if (!recording) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [recording]);

  // Load saved data
  useEffect(() => {
    try {
      setSavedRoutes(JSON.parse(localStorage.getItem("para_my_routes") || "[]"));
      setSavedPois(JSON.parse(localStorage.getItem("para_my_pois") || "[]"));
      setSavedStops(JSON.parse(localStorage.getItem("para_my_stops") || "[]"));
    } catch {}
  }, []);

  const addPoiAt = async (lat, lng) => {
    if (!poiName.trim()) return;
    const poi = {
      name: poiName,
      type: poiType,
      lat, lng,
      saved_at: new Date().toISOString(),
      user_email: auth?.user?.email,
    };
    setSavedPois(prev => [...prev, poi]);
    localStorage.setItem("para_my_pois", JSON.stringify([...savedPois, poi]));
    L.circleMarker([lat, lng], {
      radius: 8, fillColor: "#22c55e", color: "#fff", weight: 2, fillOpacity: 1,
    }).addTo(drawLayerRef.current).bindTooltip(`${poiType}: ${poiName}`, { permanent: true, direction: "top" });
    setPoiMode(false);
    setPoiName("");
  };

  const addStopAt = async (lat, lng) => {
    if (!stopName.trim()) return;
    const stop = {
      name: stopName,
      lat, lng,
      formal: isFormalStop,
      saved_at: new Date().toISOString(),
    };
    setSavedStops(prev => [...prev, stop]);
    localStorage.setItem("para_my_stops", JSON.stringify([...savedStops, stop]));
    L.circleMarker([lat, lng], {
      radius: 7, fillColor: "#f59e0b", color: "#fff", weight: 2, fillOpacity: 1,
    }).addTo(drawLayerRef.current).bindTooltip(`⏳ ${stopName}`, { permanent: true, direction: "top" });
    setStopMode(false);
    setStopName("");
  };

  const startRoute = () => {
    if (!consent) { requestConsentAndLocation(); return; }
    setRecording(true);
    setGpsPoints([]);
    setElapsed(0);
    startTracking();
  };

  const stopRoute = async () => {
    clearInterval(timerRef.current);
    stopTracking();
    setRecording(false);
    const route = {
      label: routeLabel || `${VEHICLES.find(v => v.id === vehicle)?.label} Route`,
      vehicle,
      gps_points: gpsPoints,
      total_time_sec: elapsed,
      completed_at: new Date().toISOString(),
    };
    setSavedRoutes(prev => [...prev, route]);
    localStorage.setItem("para_my_routes", JSON.stringify([...savedRoutes, route]));
    setRouteLabel("");
    setGpsPoints([]);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 lg:pb-0">
      <Navbar />

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-3 py-2 flex gap-1 overflow-x-auto z-10">
        {[
          { id: "my_routes", label: "My Routes", icon: "🗺️" },
          { id: "stops", label: "My Stops", icon: "⏳" },
          { id: "pois", label: "POI Pins", icon: "📍" },
          { id: "shapes", label: "Add Route Shape", icon: "✏️" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap flex items-center gap-1 ${tab === t.id ? "bg-[#7A4BC8] text-white" : "bg-gray-100 text-gray-500"}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-[35vh] z-0">
        <div ref={mapRef} className="absolute inset-0" />

        {recording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-500 text-white rounded-full px-5 py-2 flex items-center gap-2 shadow-2xl">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span className="font-black text-lg tabular-nums">{formatTime(elapsed)}</span>
            <span className="text-xs font-bold">{VEHICLES.find(v => v.id === vehicle)?.icon} {gpsPoints.length} pts</span>
          </div>
        )}

        <button onClick={() => window.dispatchEvent(new Event("para-show-weather"))}
          className="absolute top-4 right-16 z-30 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
          <span className="text-lg">🌤️</span>
        </button>
        <button onClick={() => requestConsentAndLocation()}
          className="absolute top-4 right-4 z-30 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
          <span className="text-lg">📍</span>
        </button>
      </div>

      {/* Bottom panel */}
      <div className="bg-white border-t border-gray-100 p-4 pb-28 z-10 max-h-[45vh] overflow-y-auto">
        {/* MY ROUTES */}
        {tab === "my_routes" && (
          <div className="space-y-3">
            {!recording ? (
              <>
                <input
                  value={routeLabel}
                  onChange={(e) => setRouteLabel(e.target.value)}
                  placeholder="Name this route (e.g. Bahay to Trabaho)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
                <div className="grid grid-cols-4 gap-1">
                  {VEHICLES.map(v => (
                    <button key={v.id} onClick={() => setVehicle(v.id)}
                      className={`p-2 rounded-lg text-center ${vehicle === v.id ? "bg-purple-100 border border-purple-300" : "bg-gray-50 border border-transparent"}`}>
                      <span className="text-lg">{v.icon}</span>
                      <span className={`block text-[9px] font-bold ${vehicle === v.id ? "text-purple-800" : "text-gray-500"}`}>{v.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={startRoute}
                  className="w-full py-4 bg-[#7A4BC8] text-white rounded-xl font-black text-lg shadow-lg">
                  {consent ? "📍 START MY ROUTE" : "📍 ENABLE GPS & START"}
                </button>
              </>
            ) : (
              <button onClick={stopRoute}
                className="w-full py-4 bg-red-500 text-white rounded-xl font-black text-lg shadow-lg">
                ⏹ STOP & SAVE
              </button>
            )}

            {savedRoutes.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500">My Saved Routes ({savedRoutes.length})</p>
                {savedRoutes.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg">
                    <span>{VEHICLES.find(v => v.id === r.vehicle)?.icon}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{r.label}</span>
                    <span className="text-[10px] text-gray-400">{Math.floor(r.total_time_sec / 60)} min</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MY STOPS */}
        {tab === "stops" && (
          <div className="space-y-3">
            <button onClick={() => { setStopMode(true); setTab("stops"); }}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold text-sm">
              ⏳ Tap Map to Add Waiting Spot
            </button>
            {stopMode && (
              <div className="space-y-2">
                <input value={stopName} onChange={(e) => setStopName(e.target.value)}
                  placeholder="Name (e.g. Sa may Jollibee, Bus Stop sa kanto)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isFormalStop} onChange={(e) => setIsFormalStop(e.target.checked)} />
                  Formal stop (bus stop / terminal)
                </label>
              </div>
            )}
            {savedStops.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500">My Stops ({savedStops.length})</p>
                {savedStops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg">
                    <span>⏳</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{s.name}</span>
                    <span className="text-[10px] text-gray-400">{s.formal ? "Formal" : "Informal"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* POI PINS */}
        {tab === "pois" && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1">
              {POI_TYPES.map(p => (
                <button key={p.id} onClick={() => setPoiType(p.id)}
                  className={`p-2 rounded-lg text-center ${poiType === p.id ? "bg-green-100 border border-green-300" : "bg-gray-50 border border-transparent"}`}>
                  <span className="text-lg">{p.icon}</span>
                  <span className={`block text-[8px] font-bold ${poiType === p.id ? "text-green-800" : "text-gray-500"}`}>{p.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPoiMode(true)}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm">
              📍 Tap Map to Drop Pin
            </button>
            {poiMode && (
              <input value={poiName} onChange={(e) => setPoiName(e.target.value)}
                placeholder="Name (e.g. Aling Nena's Lugawan)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            )}
            {savedPois.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500">My POIs ({savedPois.length})</p>
                {savedPois.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg">
                    <span>{POI_TYPES.find(t => t.id === p.type)?.icon}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{p.name}</span>
                    <span className="text-[9px] text-gray-400">{POI_TYPES.find(t => t.id === p.type)?.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD ROUTE SHAPE */}
        {tab === "shapes" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center">
              Draw or record a route shape for the reference database.
              This helps other commuters discover new routes.
            </p>
            <button onClick={startRoute}
              className="w-full py-4 bg-purple-800 text-white rounded-xl font-black text-lg">
              {consent ? "✏️ RECORD ROUTE SHAPE" : "📍 ENABLE GPS & RECORD"}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Ride/drive the route once and we'll save the shape.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
