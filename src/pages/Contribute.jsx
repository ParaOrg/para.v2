import { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import POIForm from "../components/POIForm";
import RouteUploader from "../components/RouteUploader";
import LiveRouteRecorder from "../components/LiveRouteRecorder";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { apiPost } from "../utils/api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const CENTER = [14.5995, 120.9842];

export default function Contribute() {
  const [tab, setTab] = useState("journey");
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const gpsLayerRef = useRef(null);
  
  const [journeyStep, setJourneyStep] = useState("start");
  const [originPOI, setOriginPOI] = useState("");
  const [destinationPOI, setDestinationPOI] = useState("");
  const [currentMode, setCurrentMode] = useState("");
  const [jeepRoute, setJeepRoute] = useState("");
  const [gpsPoints, setGpsPoints] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [journeyLog, setJourneyLog] = useState([]);
  const [showRecorder, setShowRecorder] = useState(false);

  const TABS = [
    { id: "journey", label: "Record Journey", icon: "🚶", desc: "Multi-modal trip recording" },
    { id: "upload", label: "Upload Route", icon: "📤", desc: "Submit route info" },
    { id: "poi", label: "Add Place", icon: "📍", desc: "Drop a pin on map" },
  ];

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView(CENTER, 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    gpsLayerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;
  }, []);

  // Track GPS on map
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !gpsLayerRef.current) return;
    gpsLayerRef.current.clearLayers();
    if (consent && location?.lat && location?.lng) {
      L.circleMarker([location.lat, location.lng], { radius: 8, fillColor: "#4285F4", color: "#fff", weight: 2, fillOpacity: 1 })
        .addTo(gpsLayerRef.current).bindTooltip("You are here");
      map.setView([location.lat, location.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [consent, location]);

  // Draw recorded GPS track
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !gpsLayerRef.current) return;
    if (gpsPoints.length > 1) {
      const coords = gpsPoints.map(p => [p.lat, p.lng]);
      L.polyline(coords, { color: "#7A4BC8", weight: 4, opacity: 0.8 }).addTo(gpsLayerRef.current);
    }
  }, [gpsPoints]);

  const recordSegment = (mode, routeName) => {
    setJourneyLog(prev => [...prev, { mode, route_name: routeName, gps_points: gpsPoints, time_sec: elapsed }]);
    setGpsPoints([]);
    setElapsed(0);
  };

  const nextStep = (next) => {
    if (location) {
      setGpsPoints(prev => [...prev, { lat: location.lat, lng: location.lng, timestamp: Date.now() }]);
    }
    setJourneyStep(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex flex-col lg:flex-row pb-24 lg:pb-0">
        {/* Map — always visible */}
        <div className="relative flex-1 min-h-[300px] lg:min-h-0">
          <div ref={mapRef} className="absolute inset-0" />
          {!consent && (
            <button onClick={requestConsentAndLocation} className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white rounded-2xl shadow-lg px-4 py-2 text-sm font-bold text-[#7A4BC8] animate-pulse">
              📍 Enable GPS
            </button>
          )}
        </div>

        {/* Form panel */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-100 overflow-y-auto max-h-[60vh] lg:max-h-none">
          <div className="p-4">
            <h1 className="text-xl font-black text-[#381D65]">Contribute</h1>
            <p className="text-xs text-gray-500">Help build the transit data for Metro Manila.</p>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 mt-3">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`p-2 rounded-lg text-center transition-colors ${tab === t.id ? "bg-purple-100" : "hover:bg-gray-50"}`}>
                  <span className="text-lg">{t.icon}</span>
                  <span className={`block text-[10px] font-bold ${tab === t.id ? "text-purple-800" : "text-gray-500"}`}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="mt-4">
              {tab === "journey" && (
                <div className="space-y-3">
                  {journeyStep === "start" && (
                    <>
                      <button onClick={() => nextStep("walking_to_stop")} className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">🚶 Start Walking</button>
                      <button onClick={() => { setShowRecorder(true); }} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm">📍 Record Full Route</button>
                    </>
                  )}
                  {journeyStep === "walking_to_stop" && (
                    <>
                      <p className="text-sm font-bold text-gray-700">Where are you heading?</p>
                      <input value={originPOI} onChange={(e) => setOriginPOI(e.target.value)} placeholder="Origin (e.g. UP Diliman)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <button onClick={() => { recordSegment("walk", "Walk to stop"); nextStep("riding"); }} className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">I'm at the stop</button>
                    </>
                  )}
                  {journeyStep === "riding" && (
                    <>
                      <p className="text-sm font-bold text-gray-700">What are you riding?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {["jeep", "bus", "train", "uv_express"].map((mode) => (
                          <button key={mode} onClick={() => { setCurrentMode(mode); nextStep("transfer"); }}
                            className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
                            {mode.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                      <input value={jeepRoute} onChange={(e) => setJeepRoute(e.target.value)} placeholder="Route name (e.g. UP Ikot)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </>
                  )}
                </div>
              )}

              {tab === "upload" && (
                <div className="space-y-3">
                  <RouteUploader />
                  <button onClick={() => setShowRecorder(true)} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm">📍 Record & Upload Route</button>
                </div>
              )}

              {tab === "poi" && <POIForm />}
            </div>
          </div>
        </div>
      </div>

      {/* Recorder overlay */}
      {showRecorder && (
        <LiveRouteRecorder
          onComplete={() => setShowRecorder(false)}
          onCancel={() => setShowRecorder(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}
