import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getApiBaseUrl } from "../config/api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const API_BASE = getApiBaseUrl();
const METRO_MANILA = [14.5995, 120.9842];

// ── Step by Step ───────────────────────────────────────────
function StepByStep({ steps, title, colorClass = "pink" }) {
  const [open, setOpen] = useState(true);
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const colors = { pink: "bg-pink-500", blue: "bg-blue-500", gray: "bg-gray-400" };
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2 bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className={`font-bold text-xs uppercase text-${colorClass}-600`}>{title}</span>
        <span className="text-gray-400 text-[10px]">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 max-h-52 overflow-y-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${step.action === "walk" ? "bg-gray-300" : colors[colorClass] || "bg-pink-500"}`} />
              <div className="flex-1 flex justify-between items-center">
                <span>
                  <span className="capitalize font-semibold text-gray-800">{step.action || "move"}</span>
                  {step.route_name && step.action !== "walk" && <span className="text-pink-500 ml-1">({step.route_name})</span>}
                </span>
                <span className="text-gray-400 whitespace-nowrap ml-2">{(step.duration_min || 0).toFixed(0)}m • ₱{(step.fare || 0).toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rating ─────────────────────────────────────────────────
function RatingSystem({ routeData, origin, dest }) {
  const [voted, setVoted] = useState(null);
  const cast = (score) => {
    setVoted(score);
    fetch(`${API_BASE}/feedback`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "beta_user", route_id: `r_${Date.now()}`, rating: score, origin_name: origin || "", destination_name: dest || "", route_nodes: routeData?.path_nodes || [], total_fare: routeData?.total_fare || 0, total_time: routeData?.total_duration_min || 0 })
    }).catch(() => {});
  };
  if (voted) return <div className="text-center text-green-500 text-xs mt-3 font-semibold">✅ Salamat sa feedback! ({voted}/7)</div>;
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[10px] text-gray-400 text-center mb-2">Accurate ba ang rutang ito?</p>
      <div className="flex justify-center gap-5">
        {[{ s: 7, e: "👍", l: "Perfect" }, { s: 3, e: "😐", l: "Okay" }, { s: 1, e: "👎", l: "Wrong" }].map(({ s, e, l }) => (
          <button key={s} onClick={() => cast(s)} className="flex flex-col items-center hover:scale-110 transition-transform"><span className="text-xl">{e}</span><span className="text-[10px] text-gray-400">{l}</span></button>
        ))}
      </div>
    </div>
  );
}

// ── Main Map Page ──────────────────────────────────────────
export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef([]);
  const [messages, setMessages] = useState([{ sender: "bot", text: 'Kumusta! Saan tayo papunta? (e.g., "From Cubao to Ayala")' }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(METRO_MANILA, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstance.current = map;
  }, []);

  const drawRoutes = (primary, alts) => {
    layersRef.current.forEach(l => { try { mapInstance.current?.removeLayer(l); } catch {} });
    layersRef.current = [];
    const draw = (route, color, weight) => {
      if (!route?.steps) return null;
      const latlngs = route.steps.flatMap(s => (s.geometry || []).filter(c => Array.isArray(c) && c.length >= 2).map(c => [c[1], c[0]]));
      if (latlngs.length < 2) return null;
      const layer = L.polyline(latlngs, { color, weight, opacity: 0.8 }).addTo(mapInstance.current);
      layersRef.current.push(layer);
      return layer;
    };
    if (Array.isArray(alts)) alts.forEach(a => draw(a, "#9ca3af", 4));
    const pLayer = draw(primary, "#ec4899", 6);
    if (pLayer) { try { mapInstance.current?.fitBounds(pLayer.getBounds(), { padding: [50, 50] }); } catch {} }
  };

  const cleanRoute = (r) => {
    if (!r?.steps) return null;
    const steps = r.steps.map(s => ({ ...s, geometry: (s.geometry || []).filter(c => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1])) })).filter(s => s.geometry.length >= 2);
    return { ...r, steps };
  };

  const send = async () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { sender: "user", text: input }]);
    const q = input; setInput(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "guest", message: q }) });
      const data = await res.json();
      const primary = cleanRoute(data.route_data);
      const alts = (data.alternatives || []).map(cleanRoute).filter(Boolean);
      setMessages(p => [...p, { sender: "bot", text: data.reply_text, routeData: primary, alts, origin: data.origin, dest: data.destination }]);
      if (primary) drawRoutes(primary, alts);
    } catch { setMessages(p => [...p, { sender: "bot", text: "May error sa server." }]); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* MAP */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* CHAT PANEL */}
      <div className="absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-10 flex flex-col max-h-[80vh] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 font-bold text-sm flex items-center gap-2 shrink-0">
          🚐 Para PH <span className="text-[10px] font-normal opacity-80">v2.1</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] p-3 rounded-2xl text-sm ${msg.sender === "user" ? "bg-pink-500 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow-sm"}`}>
                <div className="whitespace-pre-wrap mb-1">{msg.text}</div>
                {msg.routeData?.success && msg.routeData.steps?.length > 0 && (
                  <div className="mt-2">
                    <StepByStep steps={msg.routeData.steps} title={`✅ ${msg.routeData.message}`} colorClass="pink" />
                    {msg.alts?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 px-1">Alternatives</p>
                        {msg.alts.map((alt, j) => alt?.steps ? <StepByStep key={j} steps={alt.steps} title={`🔄 Alt ${j + 1}: ${alt.message}`} colorClass="gray" /> : null)}
                      </div>
                    )}
                    <button className="w-full mt-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-2 rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-pink-500/25 transition-all">🚀 Start Navigation</button>
                    <RatingSystem routeData={msg.routeData} origin={msg.origin} dest={msg.dest} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 text-gray-400 p-3 rounded-2xl rounded-bl-none text-sm italic shadow-sm">Naghahanap ng ruta…</div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 bg-white flex gap-2 shrink-0">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Saan papunta?" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all" />
          <button onClick={send} disabled={loading} className="bg-pink-500 text-white px-4 py-2 rounded-xl hover:bg-pink-600 disabled:opacity-50 font-semibold text-sm transition-colors">Send</button>
        </div>
      </div>
    </div>
  );
}