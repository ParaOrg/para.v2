import { useState } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import POIForm from "../components/POIForm";
import RouteUploader from "../components/RouteUploader";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { apiPost } from "../utils/api";

export default function Contribute() {
  const [tab, setTab] = useState("journey");
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  
  // Guided journey state
  const [journeyStep, setJourneyStep] = useState("start"); // start | walking_to_stop | riding | transfer | walking_to_dest | done
  const [originPOI, setOriginPOI] = useState("");
  const [destinationPOI, setDestinationPOI] = useState("");
  const [currentMode, setCurrentMode] = useState(""); // walking | jeep | bus | train | uv
  const [jeepRoute, setJeepRoute] = useState("");
  const [gpsPoints, setGpsPoints] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [journeyLog, setJourneyLog] = useState([]);

  const TABS = [
    { id: "journey", label: "Record Journey", icon: "🚶", desc: "Multi-modal trip recording" },
    { id: "upload", label: "Upload Route", icon: "📤", desc: "Submit route info" },
    { id: "poi", label: "Add Place", icon: "📍", desc: "Drop a pin on map" },
  ];

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
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-[#381D65]">Contribute</h1>
        <p className="text-sm text-gray-500 mt-1">Help build the transit data for Metro Manila.</p>

        {/* Tabs */}
        <div className="flex gap-2 mt-6 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t.id ? "bg-[#7A4BC8] text-white" : "bg-white text-gray-500 border border-gray-200"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Guided Journey */}
        {tab === "journey" && (
          <div className="bg-white rounded-[15px] p-6 border border-gray-100 mt-6">
            {journeyStep === "start" && (
              <>
                <h2 className="font-bold text-[#381D65]">🚶 Record Your Journey</h2>
                <p className="text-sm text-gray-400 mt-1">Tell us where you're starting and where you're going. We'll guide you through each step.</p>
                <div className="mt-4 space-y-3">
                  <input value={originPOI} onChange={(e) => setOriginPOI(e.target.value)} placeholder="Starting point (e.g., Cubao Terminal)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
                  <input value={destinationPOI} onChange={(e) => setDestinationPOI(e.target.value)} placeholder="Destination (e.g., UP Diliman)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
                  <button onClick={() => { if (!consent) requestConsentAndLocation(); nextStep("walking_to_stop"); }} className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">
                    {consent ? "Start Journey" : "Enable GPS to Start"}
                  </button>
                </div>
              </>
            )}

            {journeyStep === "walking_to_stop" && (
              <>
                <h2 className="font-bold text-[#381D65]">🚶 Walking to your first stop?</h2>
                <p className="text-sm text-gray-400 mt-1">Walk to the jeepney/bus stop or terminal.</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { recordSegment("walk", "Walk to stop"); nextStep("riding"); }} className="flex-1 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">I'm at the stop</button>
                  <button onClick={() => { recordSegment("walk", "Walk to stop"); nextStep("walking_to_dest"); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm">Walking all the way</button>
                </div>
              </>
            )}

            {journeyStep === "riding" && (
              <>
                <h2 className="font-bold text-[#381D65]">🚌 What are you riding?</h2>
                <div className="mt-4 space-y-3">
                  <input value={jeepRoute} onChange={(e) => setJeepRoute(e.target.value)} placeholder="Route name (e.g., Baclaran - Roosevelt)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
                  <div className="flex flex-wrap gap-2">
                    {["jeep", "bus", "train", "uv_express"].map((mode) => (
                      <button key={mode} onClick={() => { recordSegment(mode, jeepRoute); nextStep("transfer"); }} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
                        {mode === "jeep" ? "Jeepney" : mode === "bus" ? "Bus" : mode === "train" ? "Train" : "UV Express"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {journeyStep === "transfer" && (
              <>
                <h2 className="font-bold text-[#381D65]">🔄 Transfer or walk to destination?</h2>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => nextStep("walking_to_stop")} className="flex-1 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">Transfer to another ride</button>
                  <button onClick={() => { recordSegment("walk", "Walk to destination"); nextStep("walking_to_dest"); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm">Walk to destination</button>
                </div>
              </>
            )}

            {journeyStep === "walking_to_dest" && (
              <>
                <h2 className="font-bold text-[#381D65]">🏁 Arrived?</h2>
                <p className="text-sm text-gray-400 mt-1">Walking to {destinationPOI || "destination"}...</p>
                <div className="mt-4">
                  <button onClick={async () => {
                    recordSegment("walk", "Walk to destination");
                    try {
                      await apiPost("/commute/save", {
                        client_log_id: `journey-${Date.now()}`,
                        route_name: `${originPOI} to ${destinationPOI}`,
                        consent_granted: consent,
                        gps_points: gpsPoints,
                        journey_log: journeyLog,
                        source: "guided_journey",
                      });
                      setJourneyStep("done");
                    } catch (e) { console.error(e); }
                  }} className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">Save Journey</button>
                </div>
              </>
            )}

            {journeyStep === "done" && (
              <div className="text-center py-8">
                <span className="text-4xl">✅</span>
                <h2 className="font-bold text-[#381D65] mt-2">Journey Saved!</h2>
                <p className="text-sm text-gray-400 mt-1">{journeyLog.length} segments recorded</p>
                <button onClick={() => { setJourneyStep("start"); setJourneyLog([]); setOriginPOI(""); setDestinationPOI(""); }} className="mt-4 px-6 py-2 bg-[#7A4BC8] text-white rounded-xl text-sm font-bold">Record Another</button>
              </div>
            )}

            {/* GPS status */}
            {journeyStep !== "start" && journeyStep !== "done" && (
              <div className="mt-4 text-xs text-gray-400 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${location ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                {location ? `GPS active — ${gpsPoints.length} points` : "GPS starting..."}
              </div>
            )}
          </div>
        )}

        {tab === "upload" && (
          <div className="bg-white rounded-[15px] p-6 border border-gray-100 mt-6">
            <h2 className="font-bold text-[#381D65]">📤 Upload Route Info</h2>
            <div className="mt-4">
              <RouteUploader onDone={() => {}} onCancel={() => {}} />
            </div>
          </div>
        )}

        {tab === "poi" && (
          <div className="bg-white rounded-[15px] p-6 border border-gray-100 mt-6">
            <h2 className="font-bold text-[#381D65]">📍 Add Place</h2>
            <div className="mt-4">
              <POIForm onSuccess={() => setTab("journey")} />
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
