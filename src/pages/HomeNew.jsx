import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MapComponent from "../components/map_component";
import { RouteCardList } from "../components/TripSummaryCard";
import CommuteTracker from "../components/CommuteTracker";
import { getApiBaseUrl } from "../utils/api";
import { normalizeQuery } from "../utils/queryNormalizer";
import paralogo from "../assets/images/Para1P.png";
import GpsPrompt from "../components/GpsPrompt";
import Navbar from "../components/Navbar";
import ChatPanel from "../components/ChatPanel";
import { useTrackingConsent } from "../context/TrackingConsentContext";

const API = getApiBaseUrl();
const FULL_TEXT = "Saan mo gustong pumunta?";
const EXAMPLE_TEXT = "Ex. UPD to UST";

const BOTTOM_NAV = [
  { id: "feed", label: "Feed", icon: "📰", to: "/" },
  { id: "explore", label: "Routes", icon: "🗺️", to: "/explore" },
  { id: "search", label: "Search", icon: "🔍", primary: true },
  { id: "community", label: "Community", icon: "🌟", to: "/community" },
  { id: "profile", label: "Profile", icon: "👤", to: "/profile" },
];

export default function HomeNew() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [routeMarkers, setRouteMarkers] = useState([]);
  const [polylines, setPolylines] = useState([]);
  const [activeRouteData, setActiveRouteData] = useState(null);
  const [showTracker, setShowTracker] = useState(false);
  const [trackerMinimized, setTrackerMinimized] = useState(false);
  const [currentTrackSegment, setCurrentTrackSegment] = useState(0);
  const [placeholder, setPlaceholder] = useState(FULL_TEXT);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const { location, requestConsentAndLocation } = useTrackingConsent();
  const gpsActive = Boolean(location);
  const [kbOffset, setKbOffset] = useState(0);

  useEffect(() => {
    // Check for route from Explore page
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get("route");
    if (routeParam) {
      setInput(routeParam);
      send();
    }
    const trackRoute = localStorage.getItem("para_track_route");
    if (trackRoute) {
      try {
        const parsed = JSON.parse(trackRoute);
        // Auto-start tracker with this route
        setActiveRouteData({ name: parsed.name, route_uuid: parsed.route_uuid });
        setShowTracker(true);
        localStorage.removeItem("para_track_route");
      } catch {}
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.__paraMap) window.__paraMap.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [kbOffset]);

  useEffect(() => {
    if (!chatOpen || messages.length > 0) return;
    let timeouts = [], intervals = [];
    const typeText = (text, speed, onDone) => {
      let j = 0;
      const id = setInterval(() => { j++; if (j <= text.length) setPlaceholder(text.slice(0, j)); else { clearInterval(id); if (onDone) onDone(); } }, speed);
      intervals.push(id);
    };
    const backspaceText = (text, speed, onDone) => {
      let i = text.length;
      const id = setInterval(() => { i--; if (i >= 0) setPlaceholder(text.slice(0, i)); else { clearInterval(id); if (onDone) onDone(); } }, speed);
      intervals.push(id);
    };
    const runCycle = () => {
      setPlaceholder("");
      typeText(FULL_TEXT, 60, () => {
        const t1 = setTimeout(() => backspaceText(FULL_TEXT, 40, () => typeText(EXAMPLE_TEXT, 80, () => {
          const t2 = setTimeout(() => backspaceText(EXAMPLE_TEXT, 40, () => { const t3 = setTimeout(() => runCycle(), 300); timeouts.push(t3); }), 4000);
          timeouts.push(t2);
        })), 5000);
        timeouts.push(t1);
      });
    };
    runCycle();
    return () => { timeouts.forEach(clearTimeout); intervals.forEach(clearInterval); };
  }, [chatOpen, messages.length]);

  // Mobile keyboard tracking
  useEffect(() => {
    if (!window.visualViewport) return;
    const update = () => {
      const vv = window.visualViewport;
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbOffset(offset > 120 ? Math.round(offset) : 0);
    };
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport.removeEventListener('resize', update);
      window.visualViewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const closeChatPanel = () => { setShowChat(false); setMessages([]); setRouteMarkers([]); setPolylines([]); };

  const locateMap = () => {
    const m = window.__paraMap;
    if (!m) return;
    if (location) m.setView([location.lat, location.lng], 17, { animate: true });
    else window.__showGpsPrompt = true; requestConsentAndLocation();
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput(""); setLoading(true); setShowChat(true);
    const gpsLoc = location ? [location.lat, location.lng] : null;
    const hasExplicitOrigin = /from|mula|galing|papunta/i.test(text);
    const isDestinationOnly = /^(to |papunta |punta )/i.test(text);
    const needsGPS = isDestinationOnly || (!hasExplicitOrigin && gpsLoc);
    const { normalized } = normalizeQuery(text, gpsLoc ? { lat: gpsLoc[0], lng: gpsLoc[1] } : null);
    const backendMessage = needsGPS ? `from here to ${normalized.replace(/^(to |papunta |punta )/i, "")}` : normalized;
    const body = { user_id: "guest", message: backendMessage };
    if (gpsLoc) body.user_location = { lat: gpsLoc[0], lng: gpsLoc[1] };
    try {
      const res = await fetch(`${API}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { sender: "bot", text: data.reply_text || "No route found", routeData: data.route_data, alternatives: data.alternatives }]);
      if (data.route_data) {
        setActiveRouteData(data.route_data);
        const segs = data.route_data.segments || [];
        const lns = [], mkrs = [];
        segs.forEach((seg) => {
          if (!seg.geometry || seg.geometry.length < 2) return;
          const coords = seg.geometry.map((c) => [c[1], c[0]]);
          const isWalk = seg.is_transfer || seg.type === "walk" || (seg.route && seg.route.indexOf("WALK") !== -1);
          lns.push({ coordinates: coords, color: isWalk ? "#9CA3AF" : "#310775", weight: isWalk ? 2 : 4, dashed: isWalk });
          mkrs.push({ lat: coords[0][0], lng: coords[0][1], type: "stop" });
        });
        setPolylines(lns); setRouteMarkers(mkrs);
      }
      try {
        const cached = JSON.parse(localStorage.getItem("para_recent_searches") || "[]");
        cached.unshift({ query: text, route: data.route_data || null, timestamp: Date.now() });
        localStorage.setItem("para_recent_searches", JSON.stringify(cached.slice(0, 10)));
      } catch {}
    } catch { setMessages((prev) => [...prev, { sender: "bot", text: "Sorry, something went wrong." }]); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-white">
      <GpsPrompt />
      <div className="hidden md:block"><Navbar /><ChatPanel /><button onClick={locateMap} className="fixed top-20 right-4 z-[9999] bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg hover:bg-gray-50 border border-gray-200">⊕</button></div>
      <div className="md:hidden">
        <div className="md:hidden absolute top-4 left-4 z-30 flex flex-col items-center"><img src={paralogo} alt="Para PH" className="w-10 h-10 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]" /><p className="text-[8px] text-gray-700 mt-0.5 font-medium leading-tight text-center drop-shadow-sm">Bawat Byahe,<br/>Tulong sa Komunidad</p></div>
        <div className="absolute inset-0 z-0"><MapComponent markers={routeMarkers} polylines={polylines} showLegend={false} fitBounds={true} /></div>
        {!gpsActive && <button onClick={requestConsentAndLocation} className="md:hidden absolute top-16 right-4 z-30 bg-white rounded-2xl shadow-lg px-3 py-2 flex items-center gap-2 text-xs font-bold text-[#7A4BC8] animate-pulse"><span>📍</span><span>Enable GPS</span></button>}
        <button onClick={locateMap} className="absolute top-4 right-4 z-[9999] bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg hover:bg-gray-50 border border-gray-200">⊕</button>
        {chatOpen && !showTracker && (
          <div className="absolute left-2 right-2 z-20 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden" style={{ bottom: `calc(84px + ${kbOffset}px)`, maxHeight: showChat ? "50vh" : "auto", transition: "bottom 120ms ease-out" }}>
            {showChat && <><div className="flex items-center justify-end px-2 py-1 bg-white shrink-0"><button onClick={closeChatPanel} className="text-gray-400 hover:text-gray-600 text-sm leading-none w-5 h-5 flex items-center justify-center">✕</button></div><div className="overflow-y-auto px-3 pb-2 space-y-2" style={{ maxHeight: "calc(50vh - 80px)" }}>{messages.map((m, i) => (<div key={i}>{m.routeData ? <div className="mb-2"><RouteCardList routeData={m.routeData} alternatives={m.alternatives || []} />{!showTracker && <button onClick={() => { setShowTracker(true); setChatOpen(false); }} className="w-full mt-1.5 py-1.5 bg-green-500 text-white rounded-lg text-[11px] font-bold">🚀 Start Tracked Commute</button>}</div> : <div className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] px-2.5 py-1.5 text-[12px] leading-snug ${m.sender === "user" ? "bg-[#7A4BC8] text-white rounded-2xl rounded-br-sm" : "bg-gray-100 text-[#381D65] rounded-2xl rounded-bl-sm"}`}><div className="whitespace-pre-wrap">{m.text}</div></div></div>}</div>))}{loading && <div className="text-gray-400 text-[11px] italic px-1">Naghahanap ng ruta…</div>}<div ref={messagesEndRef} /></div></>}
            <div className="flex items-center gap-2 px-3 py-2.5"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={placeholder}
                title="Type like: from Cubao to Makati, or just: Makati"
                enterKeyHint="search"
                autoComplete="off"
                autoCapitalize="sentences" className="flex-1 text-base outline-none text-[#381D65] placeholder-gray-400" /><button onClick={send} disabled={loading} className="bg-[#7A4BC8] text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0"><span className="text-xs">➤</span></button></div>
          </div>
        )}
        {showTracker && activeRouteData && trackerMinimized && <div className="absolute left-2 right-2 z-20 bg-[#7A4BC8] text-white rounded-2xl px-4 py-3 shadow-lg cursor-pointer" style={{ bottom: `calc(84px + ${kbOffset}px)`, transition: "bottom 120ms ease-out" }} onClick={() => setTrackerMinimized(false)}><div className="flex items-center gap-2"><span>🚀</span><div className="flex-1 flex gap-1">{(activeRouteData?.segments || []).map((seg, i) => (<div key={i} className="flex-1 h-1 rounded-full" style={{ background: i === currentTrackSegment ? "white" : i < currentTrackSegment ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)" }} />))}</div><span className="text-xs font-bold">{activeRouteData?.total_time_min || 0} min</span><button onClick={(e) => { e.stopPropagation(); setShowTracker(false); setActiveRouteData(null); setTrackerMinimized(false); }} className="text-white/70 hover:text-white text-sm">✕</button></div></div>}
        {showTracker && activeRouteData && !trackerMinimized && <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[45vh] overflow-y-auto"><CommuteTracker routeData={activeRouteData} onMinimize={() => setTrackerMinimized(true)} onProgress={(seg) => setCurrentTrackSegment(seg)} onComplete={() => { setShowTracker(false); setActiveRouteData(null); setTrackerMinimized(false); }} onCancel={() => { setShowTracker(false); setTrackerMinimized(false); }} /></div>}
        <div className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-[0_-4px_7px_rgba(0,0,0,0.05)] px-2 py-3" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))", transform: kbOffset > 0 ? `translateY(${kbOffset}px)` : "none", transition: "transform 120ms ease-out" }}><div className="flex items-end justify-center gap-7 px-4 py-2">{BOTTOM_NAV.map((item) => (<button key={item.id} onClick={() => { if (item.id === "search") { if (input.trim()) send(); } else if (item.to) navigate(item.to); }} className="flex flex-col items-center gap-0.5">{item.primary ? <div className={`px-4 py-2 rounded-full shadow-md text-xs font-semibold flex items-center gap-1.5 ${chatOpen ? "bg-[#381D65] text-white" : "bg-[#7A4BC8] text-white"}`}><span>{item.icon}</span><span>{item.label}</span></div> : <><span className="text-lg">{item.icon}</span><span className="text-[9px] font-medium text-gray-400">{item.label}</span></>}</button>))}</div></div>
      </div>
    </div>
  );
}
