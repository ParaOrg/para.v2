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
];

const POI_TYPES = [
  { id: "sari_sari", label: "Sari-sari", icon: "🏪" },
  { id: "lugawan", label: "Lugawan", icon: "🍜" },
  { id: "resto", label: "Resto", icon: "🍽️" },
  { id: "cafe", label: "Cafe", icon: "☕" },
  { id: "landmark", label: "Landmark", icon: "📍" },
  { id: "terminal", label: "Terminal", icon: "🚏" },
];

export default function Contribute() {
  // Actions — not tabs
  const [action, setAction] = useState(null); // null | recording | waiting_spot | poi | route_shape
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showPoiPicker, setShowPoiPicker] = useState(false);
  const [nameInput, setNameInput] = useState("");
  
  // GPS
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const auth = useAuth();
  
  // Map
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const drawLayerRef = useRef(null);
  const liveMarkerRef = useRef(null);
  
  // Recording
  const [recording, setRecording] = useState(false);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [vehicle, setVehicle] = useState("jeepney");
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [savedStops, setSavedStops] = useState([]);
  const [savedPois, setSavedPois] = useState([]);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Map init
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView(CENTER, 14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    drawLayerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;

    map.on("click", (e) => {
      if (action === "waiting_spot") dropWaitingSpot(e.latlng);
      if (action === "poi") dropPoi(e.latlng);
    });
  }, [action, nameInput, vehicle]);

  // GPS live dot
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
        L.polyline(newPoints.map(p => [p.lat, p.lng]), { color: "#7A4BC8", weight: 5, opacity: 0.8 }).addTo(drawLayerRef.current);
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

  // Load saved
  useEffect(() => {
    try {
      setSavedRoutes(JSON.parse(localStorage.getItem("para_my_routes") || "[]"));
      setSavedStops(JSON.parse(localStorage.getItem("para_my_stops") || "[]"));
      setSavedPois(JSON.parse(localStorage.getItem("para_my_pois") || "[]"));
    } catch {}
  }, []);

  const dropWaitingSpot = (latlng) => {
    if (!nameInput.trim()) { setAction(null); return; }
    const stop = { name: nameInput, lat: latlng.lat, lng: latlng.lng };
    setSavedStops(prev => [...prev, stop]);
    localStorage.setItem("para_my_stops", JSON.stringify([...savedStops, stop]));
    L.circleMarker([latlng.lat, latlng.lng], { radius: 7, fillColor: "#f59e0b", color: "#fff", weight: 2, fillOpacity: 1 })
      .addTo(drawLayerRef.current).bindTooltip(`⏳ ${nameInput}`, { permanent: true, direction: "top" });
    setNameInput("");
    setAction(null);
  };

  const dropPoi = (latlng) => {
    if (!nameInput.trim()) { setAction(null); return; }
    const poi = { name: nameInput, type: vehicle, lat: latlng.lat, lng: latlng.lng };
    setSavedPois(prev => [...prev, poi]);
    localStorage.setItem("para_my_pois", JSON.stringify([...savedPois, poi]));
    const typeLabel = POI_TYPES.find(t => t.id === vehicle)?.label || "POI";
    const typeIcon = POI_TYPES.find(t => t.id === vehicle)?.icon || "📍";
    L.circleMarker([latlng.lat, latlng.lng], { radius: 8, fillColor: "#22c55e", color: "#fff", weight: 2, fillOpacity: 1 })
      .addTo(drawLayerRef.current).bindTooltip(`${typeIcon} ${nameInput}`, { permanent: true, direction: "top" });
    setNameInput("");
    setAction(null);
  };

  const startRoute = () => {
    if (!consent) { requestConsentAndLocation(); return; }
    setRecording(true);
    setGpsPoints([]);
    setElapsed(0);
    startTracking();
    setAction("recording");
  };

  const stopRoute = async () => {
    clearInterval(timerRef.current);
    stopTracking();
    setRecording(false);
    const route = {
      label: nameInput || `${VEHICLES.find(v => v.id === vehicle)?.label} Route`,
      vehicle,
      gps_points: gpsPoints,
      total_time_sec: elapsed,
      completed_at: new Date().toISOString(),
    };
    setSavedRoutes(prev => [...prev, route]);
    localStorage.setItem("para_my_routes", JSON.stringify([...savedRoutes, route]));
    setNameInput("");
    setGpsPoints([]);
    setAction(null);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // If recording, show minimal UI
  if (recording) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="relative flex-1 z-0">
          <div ref={mapRef} className="absolute inset-0" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-500 text-white rounded-full px-6 py-3 flex items-center gap-3 shadow-2xl">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="font-black text-xl tabular-nums">{formatTime(elapsed)}</span>
            <span className="text-xs font-bold">{VEHICLES.find(v => v.id === vehicle)?.icon} {gpsPoints.length} pts</span>
          </div>
        </div>
        <div className="bg-white border-t border-gray-100 p-4 pb-28 z-10">
          <p className="text-center text-sm text-gray-600 mb-3">
            <span className="font-black text-[#7A4BC8]">{gpsPoints.length}</span> points • Purple line = your path
          </p>
          <button onClick={stopRoute}
            className="w-full py-4 bg-red-500 text-white rounded-xl font-black text-lg shadow-lg hover:bg-red-600">
            ⏹ STOP & SAVE
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Map */}
      <div className="relative flex-1 min-h-[30vh] z-0">
        <div ref={mapRef} className="absolute inset-0" />
        <button onClick={() => window.dispatchEvent(new Event("para-show-weather"))}
          className="absolute top-4 right-16 z-30 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
          <span className="text-lg">🌤️</span>
        </button>
        <button onClick={() => requestConsentAndLocation()}
          className="absolute top-4 right-4 z-30 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
          <span className="text-lg">📍</span>
        </button>
      </div>

      {/* Action cards */}
      <div className="bg-white border-t border-gray-100 p-4 pb-28 z-10">
        {!action && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900 text-center mb-3">What do you want to do?</p>
            
            {/* Big record button */}
            <button onClick={() => { setAction("recording"); setShowVehiclePicker(true); }}
              className="w-full py-4 bg-[#7A4BC8] text-white rounded-xl font-black text-lg shadow-lg flex items-center justify-center gap-2">
              <span>📍</span> Record Ride
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setAction("waiting_spot"); setNameInput(""); }}
                className="py-3 bg-orange-500 text-white rounded-xl font-bold text-sm">
                ⏳ My Stop
              </button>
              <button onClick={() => { setAction("poi"); setNameInput(""); }}
                className="py-3 bg-green-500 text-white rounded-xl font-bold text-sm">
                📌 Add Place
              </button>
            </div>

            <button onClick={() => { setAction("route_shape"); setShowVehiclePicker(true); }}
              className="w-full py-3 bg-purple-800 text-white rounded-xl font-bold text-sm">
              ✏️ Add Route
            </button>
          </div>
        )}

        {/* Vehicle picker for recording */}
        {action === "recording" && showVehiclePicker && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900 text-center">What are you riding?</p>
            <div className="grid grid-cols-3 gap-1">
              {VEHICLES.map(v => (
                <button key={v.id} onClick={() => setVehicle(v.id)}
                  className={`p-3 rounded-xl text-center ${vehicle === v.id ? "bg-purple-100 border-2 border-purple-300" : "bg-gray-50 border-2 border-transparent"}`}>
                  <span className="text-2xl">{v.icon}</span>
                  <span className={`block text-[10px] font-bold ${vehicle === v.id ? "text-purple-800" : "text-gray-500"}`}>{v.label}</span>
                </button>
              ))}
            </div>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Route name (optional)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
            />
            <button onClick={startRoute}
              className="w-full py-4 bg-[#7A4BC8] text-white rounded-xl font-black text-lg">
              {consent ? "START" : "ON GPS + START"}
            </button>
          </div>
        )}

        {/* Waiting spot input */}
        {action === "waiting_spot" && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900 text-center">Tap the map where you wait</p>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Near Jollibee, at the corner"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
              autoFocus
            />
            <button onClick={() => setAction(null)}
              className="w-full py-2 text-gray-400 text-sm">Back</button>
          </div>
        )}

        {/* POI input */}
        {action === "poi" && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900 text-center">Tap the map to drop a pin</p>
            <div className="grid grid-cols-3 gap-1">
              {POI_TYPES.map(p => (
                <button key={p.id} onClick={() => setVehicle(p.id)}
                  className={`p-2 rounded-lg text-center ${vehicle === p.id ? "bg-green-100 border-2 border-green-300" : "bg-gray-50 border-2 border-transparent"}`}>
                  <span className="text-lg">{p.icon}</span>
                  <span className={`block text-[9px] font-bold ${vehicle === p.id ? "text-green-800" : "text-gray-500"}`}>{p.label}</span>
                </button>
              ))}
            </div>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Name (e.g. Lugawan)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
              autoFocus
            />
            <button onClick={() => setAction(null)}
              className="w-full py-2 text-gray-400 text-sm">Back</button>
          </div>
        )}

        {/* Route shape */}
        {action === "route_shape" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center">
              Ride it once, we save it for others.
            </p>
            <button onClick={startRoute}
              className="w-full py-4 bg-purple-800 text-white rounded-xl font-black text-lg">
              {consent ? "RECORD ROUTE" : "ENABLE GPS & RECORD"}
            </button>
          </div>
        )}

        {/* Saved data */}
        {(savedRoutes.length > 0 || savedStops.length > 0 || savedPois.length > 0) && !action && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-gray-500">Your Saved</p>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="bg-purple-50 rounded-lg p-2">
                <p className="text-lg font-black text-purple-800">{savedRoutes.length}</p>
                <p className="text-[9px] text-gray-400">Routes</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2">
                <p className="text-lg font-black text-orange-600">{savedStops.length}</p>
                <p className="text-[9px] text-gray-400">Stops</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-lg font-black text-green-700">{savedPois.length}</p>
                <p className="text-[9px] text-gray-400">Places</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
