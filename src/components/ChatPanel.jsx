import { useState, useEffect, useRef, useCallback } from "react";
import { getApiBaseUrl } from "../utils/api";
import MapComponent from "./map_component";
import TripSummaryCard from "./TripSummaryCard";
import CommuteTracker from "./CommuteTracker";
import InlineRecorder from "./InlineRecorder";
import WeatherPage from "./WeatherPage";
import { useTrackingConsent } from "../context/TrackingConsentContext";

const API = getApiBaseUrl();

const WELCOME_MESSAGE = "🚐 Para PH — Commute smarter, together.\n🔍 Maghanap ng ruta: Type 'from UPD to UST'\n📡 Mag-record: Type 'record route'\nSaan gusto mong puntahan?";

function TypewriterText({ text, speed = 18 }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i++;
      if (i > text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  );
}

function WarningTriangleIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 37" fill="none">
      <path d="M20 4 37 32H3L20 4z" stroke="#F2BA0F" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M20 14v8" stroke="#F2BA0F" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="20" cy="27" r="1.5" fill="#F2BA0F" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 30 28" fill="none">
      <path d="M3 14L27 2L15 26L12 17L3 14Z" fill="#7A4BC8" />
      <path d="M12 17L27 2" stroke="#7A4BC8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState([{ sender: "bot", text: WELCOME_MESSAGE }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [routeMarkers, setRouteMarkers] = useState([]);
  const [polylines, setPolylines] = useState([]);
  const [showTracker, setShowTracker] = useState(false);
  const [activeRouteData, setActiveRouteData] = useState(null);
  const [showWeather, setShowWeather] = useState(false);
  const [weather, setWeather] = useState(null);
  const messagesEndRef = useRef(null);
  const { location, consent, requestConsentAndLocation } = useTrackingConsent();

  useEffect(() => {
    const lat = location?.lat || 14.5995;
    const lng = location?.lng || 120.9842;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=Asia/Manila`)
      .then(r => r.json())
      .then(d => setWeather(d.current || null))
      .catch(() => {});
  }, [location]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  const drawRoute = useCallback((routeData) => {
    if (!routeData) return;
    const segments = routeData.segments || [];
    const allMarkers = [];
    const allLines = [];
    const bounds = [];
    segments.forEach((seg, i) => {
      if (!seg.geometry || seg.geometry.length < 2) return;
      const coords = seg.geometry.map((c) => [c[0], c[1]]);
      coords.forEach(coord => bounds.push(coord));
      const isWalk = seg.is_transfer || seg.type === "walk" || (seg.route && seg.route.includes("WALK"));
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;
      allLines.push({
        coordinates: coords,
        color: isWalk ? "#9CA3AF" : "#3e00a6",
        weight: isWalk ? 2 : 4,
        dashed: isWalk,
        routeName: seg.route || "",
      });
      const startCoord = coords[0];
      allMarkers.push({ lat: startCoord[0], lng: startCoord[1], type: isFirst ? "origin" : "stop", label: isFirst ? "Start" : "Transfer" });
      const endCoord = coords[coords.length - 1];
      allMarkers.push({ lat: endCoord[0], lng: endCoord[1], type: isLast ? "destination" : "stop", label: isLast ? "Arrive" : "Transfer" });
    });
    setRouteMarkers(allMarkers);
    setPolylines(allLines);
    if (bounds.length > 0 && window.__paraMap) {
      const map = window.__paraMap;
      const latLngs = bounds.map(b => [b[0], b[1]]);
      map.fitBounds(latLngs, { padding: [60, 60], maxZoom: 15 });
      // After fit, pan up so route is in top 75% of map area
      setTimeout(() => {
        const mapSize = map.getSize();
        map.panBy([0, -mapSize.y * 0.5], { animate: true });
      }, 300);
    }
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");

    const lowerText = text.toLowerCase();
    if (lowerText.includes("record route") || lowerText.includes("record a route")) {
      if (!consent) requestConsentAndLocation();
      setCollapsed(false);
      setMessages((prev) => [...prev, { sender: "bot", text: "📡 Let's record your route!\n1. Press Start Recording below\n2. Ride your commute\n3. Press Stop when you arrive", recordPrompt: true }]);
      return;
    }

    setLoading(true);
    setCollapsed(false);
    setRouteMarkers([]);
    setPolylines([]);

    try {
      const gps = location ? [location.lat, location.lng] : null;
      const hasOrigin = /from|mula|galing|papunta/i.test(text);
      const hasTo = /\bto\b/i.test(text);
      const backendMessage = (!hasOrigin && !hasTo && gps) ? `from here to ${text}` : text;
      const payload = { user_id: "guest", message: backendMessage };
      if (gps) payload.user_location = { lat: gps[0], lng: gps[1] };

      const res = await fetch("/api/route-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages((prev) => [...prev, {
        sender: "bot",
        text: data.reply_text || "Here are your commute options:",
        routeData: data.route_data || null,
        alternatives: data.alternatives || [],
      }]);

      if (data.route_data) {
        setActiveRouteData(data.route_data);
        drawRoute(data.route_data);
      }
    } catch {
      setMessages((prev) => [...prev, { sender: "bot", text: "Sorry, something went wrong." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      {showWeather && <WeatherPage onClose={() => setShowWeather(false)} />}
      <div className="hidden md:block absolute inset-0 z-0">
        <MapComponent markers={routeMarkers} polylines={polylines} showLegend={false} fitBounds={true} />
      </div>

      <div
        className={`absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-10 flex flex-col bg-white/95 backdrop-blur-md rounded-[20px] shadow-[4px_4px_7px_8px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden transition-all duration-300 ${collapsed ? "max-h-12" : "h-[50vh] md:h-auto md:max-h-[80vh]"}`}
      >
        {/* Header */}
        <div
          className="text-white p-3 font-bold text-sm flex items-center gap-2 shrink-0 justify-between cursor-pointer"
          style={{ background: "linear-gradient(135deg, #310775, #5a1fa8)" }}
          onClick={() => setCollapsed(!collapsed)}
        >
          <span>🚐 Para PH</span>
          <span className="text-white/70 hover:text-white text-lg leading-none select-none">{collapsed ? "▲" : "▼"}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              {m.sender === "user" ? (
                <div
                  className="max-w-[85%] px-4 py-2.5 rounded-[15px] text-[16px] leading-[24px] text-[#FBFBFB]"
                  style={{ background: "#7A4BC8", boxShadow: "2px 2px 6px 4px rgba(0,0,0,0.05)" }}
                >
                  {m.text}
                </div>
              ) : (
                <div className="max-w-[95%]">
                  {/* Bot text — plain, no bubble */}
                  <div className="text-[16px] leading-[24px] text-[#381D65] whitespace-pre-wrap">
                    {m.sender === "bot" && i === messages.length - 1 && !loading ? (
                      <TypewriterText text={m.text} />
                    ) : (
                      m.text
                    )}
                  </div>

                  {/* Record prompt */}
                  {m.recordPrompt && (
                    <div className="mt-2">
                      <InlineRecorder onDone={() => {
                        setMessages((prev) => [...prev, { sender: "bot", text: "✅ Route recorded!" }]);
                      }} />
                    </div>
                  )}

                  {/* Route data */}
                  {m.routeData && (
                    <div className="mt-3">
                      <p className="text-[14px] font-medium text-[#7A4BC8] mb-2">Recommended</p>
                      <div onClick={() => { setActiveRouteData(m.routeData); drawRoute(m.routeData); }} className="cursor-pointer"><TripSummaryCard routeData={m.routeData} isRecommended /></div>
                      {m.alternatives && m.alternatives.length > 0 && (
                        <div className="mt-3 space-y-3">
                          {m.alternatives.map((alt, j) => (
                            <div key={j} onClick={() => { setActiveRouteData(alt); drawRoute(alt); }} className="cursor-pointer"><TripSummaryCard routeData={alt} rank={j + 1} /></div>
                          ))}
                        </div>
                      )}

                      {/* Weather alert — centered, left-aligned */}
                      <div className="mt-4 mx-auto max-w-[90%] rounded-[15px] border p-3 flex items-start gap-3" style={{ background: "rgba(255, 204, 0, 0.1)", borderColor: "#FFCC00" }}>
                        <WarningTriangleIcon />
                        <p className="text-left text-[12px] leading-[18px] text-[#381D65]">Weather Alert: {(() => { const w = weather?.weather_code || 3; const labels = {0:"Clear skies",1:"Partly cloudy",2:"Partly cloudy",3:"Overcast",45:"Foggy",48:"Foggy",51:"Light drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",80:"Light showers",95:"Thunderstorms"}; const now = new Date(); const nextHour = new Date(now.getTime() + 3600000).getHours(); const endHour = (nextHour + 3) % 24; const fmt = (h) => h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h-12}PM`; return `${labels[w] || "Cloudy"} from ${fmt(nextHour)} to ${fmt(endHour)}`; })()}</p>
                      </div>

                      {/* Start Commute CTA — sticky on mobile */}
                      {!showTracker && (
                        <div className="mt-3 sticky bottom-0 bg-white/95 backdrop-blur-sm p-2 rounded-[15px] border border-gray-100">
                          <button
                            onClick={() => { if (!consent) requestConsentAndLocation(); setActiveRouteData(m.routeData); setShowTracker(true); }}
                            className="w-full h-10 bg-[#7A4BC8] text-white text-[14px] font-medium rounded-[10px] hover:bg-[#5B339C] transition-colors"
                            style={{ boxShadow: "2px 2px 6px 4px rgba(0,0,0,0.05)" }}
                          >
                            Start Commute
                          </button>
                          <p className="text-[10px] text-gray-400 text-center mt-1">Your location will be tracked for safety and data training.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="text-[16px] leading-[24px] text-[#381D65] italic">Naghahanap ng ruta…</div>
            </div>
          )}

          <span ref={messagesEndRef} />
        </div>

        {/* Commute Tracker */}
        {showTracker && activeRouteData && (
          <>
            <div className="fixed top-[15%] bottom-0 left-0 right-0 z-40 bg-black/50 rounded-t-3xl" onClick={() => setShowTracker(false)} />
            <div className="fixed top-[15%] bottom-0 left-0 right-0 z-50 flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex-1 overflow-y-auto bg-white rounded-t-[20px] shadow-[4px_4px_7px_8px_rgba(0,0,0,0.06)]">
                <CommuteTracker
                  routeData={activeRouteData}
                  onComplete={() => { setShowTracker(false); setActiveRouteData(null); }}
                  onCancel={() => setShowTracker(false)}
                />
              </div>
            </div>
          </>
        )}

        {/* Input */}
        <div className="p-3 border-t border-gray-100 bg-white shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Reply..."
              className="flex-1 text-[16px] leading-[24px] text-[#381D65] placeholder-gray-400 outline-none"
            />
            <button onClick={send} disabled={loading} className="shrink-0">
              <SendIcon />
            </button>
          </div>
          <div className="text-center leading-none">
            <a href="https://www.para-commute.org/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#7A4BC8] underline">
              Data Privacy
            </a>
          </div>
        </div>
        </div>
      </div>
  );
}
