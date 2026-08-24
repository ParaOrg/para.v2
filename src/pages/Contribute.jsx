import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import WeatherPage from "../components/WeatherPage";
import BottomNav from "../components/BottomNav";
import GpsIcon from "../components/GpsIcon";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import ContributeChatPanel from "../components/ContributeChatPanel";
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

const POI_TYPES = [
  { id: "business", label: "Business", icon: "🏪" },
  { id: "landmark", label: "Landmark", icon: "📍" },
  { id: "amenity", label: "Amenity", icon: "🏥" },
];

export default function Contribute() {
  const [showWeather, setShowWeather] = useState(false);
  // Main mode
  const [mode, setMode] = useState(null);
  const [viewMode, setViewMode] = useState("buttons");
  const [chatInput, setChatInput] = useState("");

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    
    const userMsg = { id: `user-${Date.now()}`, sender: "user", type: "text", content: text };
    setMessages(prev => [...prev, userMsg]);
    
    // Parse intent
    const lower = text.toLowerCase();
    
    if (/(rain|ulan|flood|baha|weather|panahon)/.test(lower)) {
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, sender: "bot", type: "text", content: "Check the weather button on the map for current conditions. Stay safe!" }]);
    } else if (lower.includes("help")) {
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, sender: "bot", type: "text", content: "🚐 Transport modes:\n• jeep | bus | train | uv | trike | angkas | grab\n\n📋 Actions:\n• hop on | hop off | end route | add pin | log fare | my stop | record route | upload" }]);
    } else if (lower.includes("privacy")) {
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, sender: "bot", type: "text", content: "🔒 Your location data is only collected with consent and anonymized for community insights. See full privacy policy: https://www.para-commute.org/privacy-policy" }]);
    } else if (lower.includes("record route") || lower.includes("track commute")) {
      setMode("personal_setup");
      setViewMode("buttons");
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, sender: "bot", type: "text", content: "📍 Starting route recording. Tap the GPS button to center the map, then choose your transport mode." }]);
    } else if (lower.includes("add pin") || lower.includes("poi")) {
      setMode("poi");
      setViewMode("buttons");
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, sender: "bot", type: "text", content: "📌 POI mode activated. Tap the map to drop a pin." }]);
    } else if (lower.includes("upload")) {
      setMode("upload");
      setViewMode("buttons");
    } else {
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, sender: "bot", type: "text", content: "Got it! Use the buttons above or type help for commands." }]);
    }
    
    setChatInput("");
  };

  const contextualButtons = (() => {
    if (!mode) {
      return [
        { id: "track-commute", label: "Track Commute", icon: "🚶", action: () => { setMode("personal_setup"); setViewMode("buttons"); } },
        { id: "record-route", label: "Record Route", icon: "🗺️", action: () => { setMode("personal_setup"); setViewMode("buttons"); } },
        { id: "add-pin", label: "Add Pin", icon: "📍", action: () => { setMode("poi"); setViewMode("buttons"); } },
        { id: "upload-file", label: "Upload File", icon: "📁", action: () => { setMode("upload"); setViewMode("buttons"); } },
      ];
    }
    return [];
  })();
  const [messages, setMessages] = useState([
    { id: "msg-1", sender: "bot", type: "text", content: "Welcome to Contribute! Here you can help improve Para PH by sharing your commute data.\n\nYou can either:\n📱 TAP the buttons above\n⌨️ TYPE the equivalent text\n\nTransport modes (type or tap):\n🚐 \"jeep\" | 🚌 \"bus\" | 🚆 \"train\" | 🚐 \"uv\" | 🛺 \"trike\" | 🏍️ \"angkas\" | 🚗 \"grab\"\n\nActions (type or tap):\n\"hop on\" | \"hop off\" | \"end route\" | \"add pin\" | \"log fare\" | \"my stop\" | \"record route\" | \"upload\"\n\nOr just type naturally — \"help\" for emergency.\n\n🔒 Your location data is only collected with consent and anonymized for community insights. Type \"privacy\" for more info.", options: undefined }
  ]); // null | personal | route | poi | upload
  
  // Personal commute state machine
  const [transitState, setTransitState] = useState("walking"); // walking | riding
  const [recording, setRecording] = useState(false);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [segments, setSegments] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [currentVehicle, setCurrentVehicle] = useState("");
  const [routeNameInput, setRouteNameInput] = useState("");
  const [destinationGoal, setDestinationGoal] = useState("");
  const [showVehiclePick, setShowVehiclePick] = useState(false);
  const [previousMode, setPreviousMode] = useState(null);
  const [showFareReport, setShowFareReport] = useState(false);
  const [fareAmount, setFareAmount] = useState("");
  const [routeSuggestions, setRouteSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // POI mode
  const [poiType, setPoiType] = useState("business");
  const [poiName, setPoiName] = useState("");
  const [poiBusinessType, setPoiBusinessType] = useState("");
  const [poiImageUrl, setPoiImageUrl] = useState("");
  const [savedPois, setSavedPois] = useState([]);
  
  // GPS
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const auth = useAuth();
  
  // Map
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const trailLayerRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Map init
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView(CENTER, 14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    trailLayerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;

    map.on("click", (e) => {
      if (mode === "poi" && poiName.trim()) {
        dropPoi(e.latlng);
      }
    });
  }, [mode, poiName, poiType, poiBusinessType]);

  // GPS live
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

  // Trail during recording
  useEffect(() => {
    if (!recording || !location) return;
    setGpsPoints(prev => {
      const last = prev[prev.length - 1];
      if (last && last.lat === location.lat && last.lng === location.lng) return prev;
      const newPoints = [...prev, { lat: location.lat, lng: location.lng, timestamp: Date.now() }];
      if (trailLayerRef.current && newPoints.length > 1) {
        trailLayerRef.current.clearLayers();
        L.polyline(newPoints.map(p => [p.lat, p.lng]), { color: "#7A4BC8", weight: 5, opacity: 0.8 }).addTo(trailLayerRef.current);
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

  // Load route suggestions from reference
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || "https://para-ph-api.onrender.com"}/routes/public/reference`)
      .then(r => r.json())
      .then(d => setRouteSuggestions(d.routes || []))
      .catch(() => {});
  }, []);

  // Load saved POIs
  useEffect(() => {
    try {
      setSavedPois(JSON.parse(localStorage.getItem("para_my_pois") || "[]"));
    } catch {}
  }, []);

  const dropPoi = (latlng) => {
    if (!poiName.trim()) return;
    const poi = {
      name: poiName,
      type: poiType,
      businessType: poiType === "business" ? poiBusinessType : null,
      imageUrl: poiType !== "business" ? poiImageUrl : null,
      lat: latlng.lat,
      lng: latlng.lng,
    };
    setSavedPois(prev => [...prev, poi]);
    localStorage.setItem("para_my_pois", JSON.stringify([...savedPois, poi]));
    const icon = POI_TYPES.find(t => t.id === poiType)?.icon || "📍";
    L.circleMarker([latlng.lat, latlng.lng], {
      radius: 8, fillColor: "#22c55e", color: "#fff", weight: 2, fillOpacity: 1,
    }).addTo(trailLayerRef.current).bindTooltip(`${icon} ${poiName}`, { permanent: true, direction: "top" });
    setPoiName("");
    setPoiBusinessType("");
    setPoiImageUrl("");
    setMode(null);
  };

  const startPersonalRoute = () => {
    if (!consent) { requestConsentAndLocation(); return; }
    setRecording(true);
    setTransitState("walking");
    setGpsPoints([]);
    setSegments([]);
    setElapsed(0);
    startTracking();
    setMode("personal");
  };

  const submitFare = async () => {
    if (!fareAmount || parseFloat(fareAmount) <= 0) return;
    const fareData = {
      user_email: auth?.user?.email || "anonymous",
      mode: "transit",
      fare_amount: parseFloat(fareAmount),
      route_name: currentVehicle || "Personal Route",
      city: "Metro Manila",
      reported_at: new Date().toISOString(),
    };
    if (!navigator.onLine) {
      await offlineBuffer.addFareReport(fareData);
    } else {
      try { await apiPost("/fare/report", fareData); } catch {
        await offlineBuffer.addFareReport(fareData);
      }
    }
    setFareAmount("");
    setShowFareReport(false);
  };

  const hopOn = () => {
    setTransitState("riding");
    setShowVehiclePick(true);
  };

  const confirmVehicle = () => {
    // Save walking segment
    const segment = {
      type: "walking",
      start_time: segments.length === 0 ? startTimeRef.current : segments[segments.length - 1]?.end_time,
      end_time: Date.now(),
      gps_points: gpsPoints,
    };
    setSegments(prev => [...prev, segment]);
    setGpsPoints([]);
    setCurrentVehicle(routeNameInput || "Transit");
    setShowVehiclePick(false);
  };

  const hopOff = () => {
    const segment = {
      type: "riding",
      vehicle: currentVehicle,
      start_time: segments.length === 0 ? startTimeRef.current : segments[segments.length - 1]?.end_time,
      end_time: Date.now(),
      gps_points: gpsPoints,
    };
    setSegments(prev => [...prev, segment]);
    setGpsPoints([]);
    setCurrentVehicle("");
    setTransitState("walking");
  };

  const endRoute = async () => {
    clearInterval(timerRef.current);
    stopTracking();
    setRecording(false);
    
    // Save final walking segment
    if (transitState === "walking" && gpsPoints.length > 0) {
      const segment = {
        type: "walking",
        start_time: segments.length === 0 ? startTimeRef.current : segments[segments.length - 1]?.end_time,
        end_time: Date.now(),
        gps_points: gpsPoints,
      };
      setSegments(prev => [...prev, segment]);
    }
    
    // Save to backend/local
    const routeData = {
      label: destinationGoal || "Personal Route",
      segments,
      destination_goal: destinationGoal,
      total_time_sec: elapsed,
      completed_at: new Date().toISOString(),
      user_email: auth?.user?.email,
      source: "personal_route",
    };
    
    if (!navigator.onLine) {
      await offlineBuffer.addCommute(routeData);
    } else {
      try { await apiPost("/commute/save", routeData); } catch {
        await offlineBuffer.addCommute(routeData);
      }
    }
    
    setMode(null);
    setDestinationGoal("");
    setGpsPoints([]);
    setSegments([]);
    setTransitState("walking");
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Map */}
      <div className="relative flex-1 min-h-[30vh] z-0">
        <div ref={mapRef} className="absolute inset-0" />
        
        {recording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-red-500 text-white rounded-full px-5 py-2 flex items-center gap-2 shadow-2xl">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span className="font-black text-lg tabular-nums">{formatTime(elapsed)}</span>
            <span className="text-xs font-bold">{transitState === "walking" ? "🚶 Walking" : `🚐 ${currentVehicle}`}</span>
          </div>
        )}

        {/* Toggle buttons - aligned with weather at top-4 */}
        <div className="absolute top-4 left-4 z-[999] flex gap-2">
          <button onClick={() => setViewMode("buttons")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${viewMode === "buttons" ? "bg-purple-800 text-white" : "bg-white text-gray-500"}`}>
            Buttons
          </button>
          <button onClick={() => setViewMode("chat")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${viewMode === "chat" ? "bg-purple-800 text-white" : "bg-white text-gray-500"}`}>
            Chat
          </button>
        </div>

        <button onClick={() => window.dispatchEvent(new Event("para-show-weather"))}
          className="absolute top-4 right-16 z-[999] bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
          <span className="text-lg">🌤️</span>
        </button>
        <button onClick={() => requestConsentAndLocation()}
          className="absolute top-4 right-4 z-[999] bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
          <GpsIcon size={20} />
        </button>
      </div>

      {/* Bottom panel */}
      <div className="bg-white border-t border-gray-100 p-4 pb-28 z-10 max-h-[50vh] overflow-y-auto">
        {/* HOME — mode selection */}
        {!mode && !recording && (
          <div className="space-y-3">
            <button onClick={() => setMode("personal_setup")}
              className="w-full py-5 bg-[#7A4BC8] text-white rounded-2xl font-black text-lg shadow-lg">
              📍 Add Personal Route
            </button>
            <button onClick={() => setMode("route_setup")}
              className="w-full py-4 bg-purple-800 text-white rounded-2xl font-bold text-lg">
              ✏️ Add Route (Transit Line)
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode("poi")}
                className="py-3 bg-green-500 text-white rounded-2xl font-bold text-sm">
                📌 Add POI
              </button>
              <button onClick={() => setMode("upload")}
                className="py-3 bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm">
                📤 Upload File
              </button>
            </div>
          </div>
        )}

        {/* PERSONAL ROUTE SETUP */}
        {mode === "personal_setup" && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900 text-center">Personal Route</p>
            <input
              value={destinationGoal}
              onChange={(e) => setDestinationGoal(e.target.value)}
              placeholder="Destination (optional)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
            />
            <button onClick={startPersonalRoute}
              className="w-full py-4 bg-[#7A4BC8] text-white rounded-xl font-black text-lg">
              {consent ? "START" : "ON GPS + START"}
            </button>
            <button onClick={() => setMode(null)} className="w-full py-2 text-gray-400 text-sm">Back</button>
          </div>
        )}

        {/* PERSONAL ROUTE ACTIVE — State machine */}
        {mode === "personal" && recording && (
          <div className="space-y-3">
            {/* State indicator */}
            <div className={`rounded-xl p-3 text-center ${transitState === "walking" ? "bg-blue-50" : "bg-orange-50"}`}>
              <span className="text-2xl">{transitState === "walking" ? "🚶" : "🚐"}</span>
              <p className="font-bold text-sm">{transitState === "walking" ? "Walking" : `Riding: ${currentVehicle}`}</p>
            </div>

            {/* Hop On / Hop Off */}
            {transitState === "walking" ? (
              <button onClick={hopOn}
                className="w-full py-4 bg-orange-500 text-white rounded-xl font-black text-lg">
                🚐 Hop On
              </button>
            ) : (
              <button onClick={hopOff}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-black text-lg">
                🚶 Hop Off
              </button>
            )}

            {/* Vehicle picker when hopping on */}
            {showVehiclePick && (
              <div className="space-y-2">
                <input
                  value={routeNameInput}
                  onChange={(e) => setRouteNameInput(e.target.value)}
                  placeholder="Route name (e.g. UP Ikot, or new route)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
                <button onClick={confirmVehicle}
                  className="w-full py-2 bg-purple-800 text-white rounded-xl font-bold text-sm">
                  Confirm
                </button>
              </div>
            )}

            {/* Drop POI anytime */}
            <button onClick={() => { setPreviousMode(mode); setMode("poi"); }}
              className="w-full py-2 border border-gray-200 text-gray-600 rounded-xl text-sm">
              📌 Drop POI
            </button>

            {/* Report Fare for this segment */}
            <button onClick={() => setShowFareReport(!showFareReport)}
              className="w-full py-2 border border-gray-200 text-gray-600 rounded-xl text-sm">
              ₱ Report Fare
            </button>

            {showFareReport && (
              <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                <input
                  type="number"
                  value={fareAmount}
                  onChange={(e) => setFareAmount(e.target.value)}
                  placeholder="Fare paid (₱)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button onClick={submitFare}
                  className="w-full py-2 bg-[#7A4BC8] text-white rounded-lg text-sm font-bold">
                  Save Fare
                </button>
              </div>
            )}

            {/* End Route */}
            <button onClick={endRoute}
              className="w-full py-4 bg-red-500 text-white rounded-xl font-black text-lg">
              ⏹ END ROUTE
            </button>

            {/* Segment list */}
            {segments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500">Segments ({segments.length})</p>
                {segments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 bg-gray-50 rounded-lg">
                    <span>{seg.type === "walking" ? "🚶" : "🚐"}</span>
                    <span className="text-xs text-gray-700">{seg.type === "walking" ? "Walking" : seg.vehicle}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {Math.floor((seg.end_time - seg.start_time) / 1000)}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ROUTE RECORDING SETUP */}
        {mode === "route_setup" && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900 text-center">Record Transit Route</p>
            <div className="relative">
              <input
                value={routeNameInput}
                onChange={(e) => {
                  setRouteNameInput(e.target.value);
                  setShowSuggestions(e.target.value.length > 1);
                }}
                onFocus={() => setShowSuggestions(routeNameInput.length > 1)}
                placeholder="Type route name or pick from list"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
              />
              {showSuggestions && routeNameInput.length > 1 && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {routeSuggestions
                    .filter(r => (r.route_name || "").toLowerCase().includes(routeNameInput.toLowerCase()))
                    .slice(0, 8)
                    .map((r, i) => (
                      <button key={i} onClick={() => {
                        setRouteNameInput(r.route_name);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50">
                        {r.route_name}
                      </button>
                    ))}
                  {routeSuggestions.filter(r => (r.route_name || "").toLowerCase().includes(routeNameInput.toLowerCase())).length === 0 && (
                    <button onClick={() => setShowSuggestions(false)}
                      className="w-full text-left px-4 py-2 text-sm text-green-600 font-bold hover:bg-green-50">
                      + Add new route: "{routeNameInput}"
                    </button>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => { setMode("personal"); startPersonalRoute(); }}
              className="w-full py-4 bg-purple-800 text-white rounded-xl font-black text-lg">
              START RECORDING
            </button>
            <button onClick={() => { setMode(previousMode || null); setPoiName(""); setPoiBusinessType(""); setPoiImageUrl(""); setPreviousMode(null); }}
              className="w-full py-2 text-gray-400 text-sm">Back</button>
          </div>
        )}

        {/* POI MODE */}
        {mode === "poi" && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900 text-center">Tap map to drop pin</p>
            <div className="grid grid-cols-3 gap-1">
              {POI_TYPES.map(p => (
                <button key={p.id} onClick={() => setPoiType(p.id)}
                  className={`p-2 rounded-lg text-center ${poiType === p.id ? "bg-green-100 border-2 border-green-300" : "bg-gray-50 border-2 border-transparent"}`}>
                  <span className="text-lg">{p.icon}</span>
                  <span className={`block text-[9px] font-bold ${poiType === p.id ? "text-green-800" : "text-gray-500"}`}>{p.label}</span>
                </button>
              ))}
            </div>
            <input
              value={poiName}
              onChange={(e) => setPoiName(e.target.value)}
              placeholder={poiType === "business" ? "Business name (e.g. Lugawan ni Aling Nena)" : "Name"}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
            />
            {poiType === "business" && (
              <input
                value={poiBusinessType}
                onChange={(e) => setPoiBusinessType(e.target.value)}
                placeholder="Business type (e.g. Restaurant, Sari-sari)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
              />
            )}
            {poiType !== "business" && (
              <input
                value={poiImageUrl}
                onChange={(e) => setPoiImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
              />
            )}
            <button onClick={() => { setMode(previousMode || null); setPoiName(""); setPoiBusinessType(""); setPoiImageUrl(""); setPreviousMode(null); }}
              className="w-full py-2 text-gray-400 text-sm">Back</button>
          </div>
        )}

        {/* UPLOAD */}
        {mode === "upload" && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900 text-center">Upload Route File</p>
            <input
              type="file"
              accept=".csv,.geojson"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
            />
            <p className="text-xs text-gray-400 text-center">Accepts .csv or .geojson only</p>
            <button onClick={() => setMode(null)} className="w-full py-2 text-gray-400 text-sm">Back</button>
          </div>
        )}

        {/* Saved POIs */}
        {savedPois.length > 0 && !mode && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-500">Saved POIs ({savedPois.length})</p>
            {savedPois.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span>{POI_TYPES.find(t => t.id === p.type)?.icon}</span>
                <span className="text-xs text-gray-700 truncate">{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewMode === "chat" && <ContributeChatPanel messages={messages} onSendMessage={handleSendMessage} contextualButtons={contextualButtons} onQuickReply={(btn) => btn.action && btn.action()} appMode={mode || "idle"} />}
      {showWeather && <WeatherPage onClose={() => setShowWeather(false)} />}
      <BottomNav />
    </div>
  );
}
