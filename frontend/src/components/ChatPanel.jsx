import { useState, useEffect, useRef } from "react";
import { getApiBaseUrl } from "../config/api";
import MapComponent from "./map_component";
import CommuteTracker from "./CommuteTracker";

const API = getApiBaseUrl();
const P = "#310775";


function TypewriterText({ text, speed = 18 }) {
  const [d, setD] = useState(""); const [done, setDone] = useState(false);
  useEffect(() => { setD(""); setDone(false); let i = 0; const t = setInterval(() => { setD(text.slice(0, i)); i++; if (i > text.length) { clearInterval(t); setDone(true); } }, speed); return () => clearInterval(t); }, [text]);
  return <span>{d}{!done && <span className="animate-pulse">|</span>}</span>;
}

export default function ChatPanel() {
  const [msgs, setMsgs] = useState([{ sender: "bot", text: "🚐 Kumusta! Ako si Para PH.\n\n🔍 Maghanap ng ruta: Type 'from UPD to UST'\n🚀 I-track: Start Commute after searching\n📤 Mag-upload: Punta sa Upload tab\n\nAno ang gusto mong gawin?" }]);
  const [inp, setInp] = useState("");
  const [load, setLoad] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [lines, setLines] = useState([]);
  const [routes] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [showTracker, setShowTracker] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, [msgs]);

  const clearRoute = () => {
    setLines([]);
    setMarkers([]);
  };

  const drawRoute = (routeData) => {
    console.log('🔴 drawRoute called');
    
    if (!routeData) {
      console.error('❌ routeData is null');
      return;
    }
    
    const segments = routeData.segments || routeData.steps || [];
    console.log('📏 Segments:', segments.length);
    
    if (segments.length === 0) {
      console.error('❌ No segments');
      return;
    }
    
    const newLines = [];
    const newMarkers = [];
    
    segments.forEach((seg, index) => {
      // Skip 0-min walk transfers
      if (seg.time_min === 0 && (seg.type === 'walk' || seg.is_transfer)) {
        console.log(`⏭️ Skip 0-min transfer`);
        return;
      }
      
      if (!seg.geometry || seg.geometry.length < 2) {
        console.warn(`⚠️ Bad geometry for segment ${index}`);
        return;
      }
      
      const isWalk = seg.is_transfer || seg.type === 'walk' || seg.mode === 'walk';
      
      // FLIP: [lng, lat] -> [lat, lng] for Leaflet
      const flippedGeometry = seg.geometry.map(coord => [coord[1], coord[0]]);
      
      console.log(`📏 Line ${index}: ${flippedGeometry.length} pts, walk:${isWalk}`);
      
      // Add polyline
      newLines.push({
        id: `seg-${index}`,
        coordinates: flippedGeometry,
        color: isWalk ? '#9CA3AF' : '#310775',
        weight: isWalk ? 2 : 4,
        opacity: 0.9,
        dashed: isWalk,
        routeName: seg.route || ''
      });
      
      // Start marker
      newMarkers.push({
        id: `start-${index}`,
        position: flippedGeometry[0],
        type: isWalk ? 'walk-start' : 'stop',
        label: seg.from?.split('::')[0] || seg.route || 'Board',
        routeName: seg.route || '',
        isTransfer: false
      });
      
      // End marker
      newMarkers.push({
        id: `end-${index}`,
        position: flippedGeometry[flippedGeometry.length - 1],
        type: isWalk ? 'walk-end' : 'stop',
        label: seg.to?.split('::')[0] || seg.route || 'Alight',
        routeName: seg.route || '',
        isTransfer: index < segments.length - 1
      });
    });
    
    console.log(`✅ Setting ${newLines.length} lines, ${newMarkers.length} markers`);
    setLines(newLines);
    setMarkers(newMarkers);
  };

  const send = async () => {
    if (!inp.trim()) return;
    
    const userMsg = inp;
    setMsgs(prev => [...prev, { sender: "user", text: userMsg }]);
    setInp("");
    setLoad(true);
    setCollapsed(false);
    clearRoute();
    
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "guest", message: userMsg })
      });
      
      const data = await res.json();
      console.log('📦 Response:', data);

      setMsgs(prev => [...prev, { sender: "bot", text: data.reply_text || data.reply || "No route found" }]);

      if (data.route_data) {
        setRouteData(data.route_data);
        setShowTracker(false);
        drawRoute(data.route_data);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setMsgs(prev => [...prev, { sender: "bot", text: "Sorry, something went wrong." }]);
    }
    
    setLoad(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      <div className="absolute inset-0 z-0">
        <MapComponent markers={markers} lines={lines} routes={routes} showLegend={false} fitBounds={true} />
      </div>
      
      <div className={`absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-10 flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 ${collapsed ? 'max-h-12' : 'max-h-[80vh]'}`}>
        <div className="text-white p-3 font-bold text-sm flex items-center gap-2 shrink-0 justify-between" style={{ background: `linear-gradient(135deg,${P},#5a1fa8)` }}>
          <span>🚐 Para PH</span>
          <button onClick={() => setCollapsed(!collapsed)} className="md:hidden text-white/70 hover:text-white text-lg leading-none">{collapsed ? "▲" : "▼"}</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[95%] p-3 rounded-2xl text-sm ${m.sender === "user" ? "text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow-sm"}`} style={m.sender === "user" ? { background: `linear-gradient(135deg,${P},#5a1fa8)` } : {}}>
                {m.sender === "bot" && i === msgs.length - 1 && !load ? <div className="whitespace-pre-wrap"><TypewriterText text={m.text} /></div> : <div className="whitespace-pre-wrap">{m.text}</div>}
              </div>
            </div>
          ))}
          {load && <div className="flex justify-start"><div className="bg-white border border-gray-100 text-gray-400 p-3 rounded-2xl rounded-bl-none text-sm italic">Naghahanap ng ruta…</div></div>}
          <span ref={messagesEndRef} />
        {routeData && !showTracker && <button onClick={() => setShowTracker(true)} className="w-full py-2.5 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 mt-2">🚀 Start Tracked Commute</button>}
        {showTracker && routeData && <CommuteTracker routeData={routeData} onComplete={(log) => console.log("Done:", log)} />}
        </div>
        
        <div className="p-3 border-t border-gray-100 bg-white flex gap-2 shrink-0">
          <input value={inp} onChange={(e) => setInp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Saan papunta?" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <button onClick={send} disabled={load} className="text-white px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 font-semibold text-sm" style={{ background: P }}>Send</button>
        </div>
      </div>
    </div>
  );
}