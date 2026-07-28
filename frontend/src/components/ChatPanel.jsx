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

const MODE_COLORS = {
  jeep: "#FBBC05", bus: "#34A853", lrt: "#FF6D00", mrt: "#FF6D00",
  train: "#FF6D00", uv_express: "#9C27B0", uv: "#9C27B0", walk: "#9CA3AF",
};
function getModeColor(type) { return MODE_COLORS[(type || "walk").toLowerCase()] || "#9CA3AF"; }

function StepByStep({ steps, title }) {
  const [open, setOpen] = useState(true);
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2 bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="font-bold text-xs uppercase text-pink-600">{title}</span>
        <span className="text-gray-400 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 max-h-52 overflow-y-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getModeColor(step.vehicle_type) }} />
              <div className="flex-1 flex justify-between items-center">
                <span>
                  <span className="capitalize font-semibold text-gray-800">{step.action || "move"}</span>
                  {step.route_name && step.action !== "walk" && <span className="text-pink-500 ml-1 text-[10px]">({step.route_name})</span>}
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

function RatingSystem({ routeData, origin, dest }) {
  const [voted, setVoted] = useState(null);
  const cast = (score) => {
    setVoted(score);
    fetch(`${API_BASE}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "beta_user", route_id: `r_${Date.now()}`, rating: score, origin_name: origin || "", destination_name: dest || "", route_nodes: routeData?.path_nodes || [], total_fare: routeData?.total_fare || 0, total_time: routeData?.total_duration_min || 0 }) }).catch(() => {});
  };
  if (voted) return <div className="text-center text-green-500 text-[10px] mt-2 font-semibold">✅ Salamat! ({voted}/7)</div>;
  return (
    <div className="mt-2 pt-2 border-t border-gray-100"><p className="text-[10px] text-gray-400 text-center mb-1.5">Accurate ba ang ruta?</p><div className="flex justify-center gap-4">{[{ s: 7, e: "👍" }, { s: 3, e: "😐" }, { s: 1, e: "👎" }].map(({ s, e }) => (<button key={s} onClick={() => cast(s)} className="hover:scale-110 transition-transform text-lg">{e}</button>))}</div></div>
  );
}

export default function ChatPanel() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef([]);
  const bgRoutesRef = useRef(null);
  const [messages, setMessages] = useState([{ sender: "bot", text: 'Kumusta! Saan tayo papunta? (e.g., "From Cubao to Ayala")' }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const skeletonTimer = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(METRO_MANILA, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstance.current = map;

    // Each route is a single polyline of [lng, lat] points (routes.geojson
    // LineString coordinates), not per-edge pairs -- simpler to draw directly.
    const drawBg = (routes) => {
      const bg = L.layerGroup().addTo(map);
      bgRoutesRef.current = bg;
      const allPoints = [];
      routes.forEach(r => {
        const pts = (r.coords || [])
          .filter(c => Array.isArray(c) && c.length >= 2)
          .map(([lng, lat]) => [lat, lng]);
        if (pts.length < 2) return;
        L.polyline(pts, { color: "#fbcfe8", weight: 1.5, opacity: 0.5 }).addTo(bg);
        allPoints.push(...pts);
      });
      if (allPoints.length) try { map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30] }); } catch {}
      setRoutesLoaded(true);
    };

    const cached = sessionStorage.getItem("para_bg_routes");
    if (cached) { try { const r = JSON.parse(cached); if (r.length) { drawBg(r); return; } } catch {} }

    fetch(`${API_BASE}/api/v1/jeepney-routes/manifest`).then(r => r.json()).then(async (manifest) => {
      const keys = (manifest.verified || []).map(v => v.key);
      const features = await Promise.all(
        keys.map(k => fetch(`${API_BASE}/api/v1/jeepney-routes/${k}/geometry`).then(r => r.json()).catch(() => null))
      );
      const routes = features
        .filter(Boolean)
        .map(f => ({ coords: f.geometry?.coordinates || [] }));
      try { sessionStorage.setItem("para_bg_routes", JSON.stringify(routes)); } catch {}
      drawBg(routes);
    }).catch(() => setRoutesLoaded(true));
  }, []);

  const drawRoutes = (primary, alts) => {
    if (bgRoutesRef.current) bgRoutesRef.current.eachLayer(l => { if (l.setStyle) l.setStyle({ opacity: 0.1 }); });
    layersRef.current.forEach(l => { try { mapInstance.current?.removeLayer(l); } catch {} });
    layersRef.current = [];
    const draw = (route, w = 6) => {
      if (!route?.steps) return null;
      const ll = route.steps.flatMap(s => (s.geometry || []).filter(c => Array.isArray(c) && c.length >= 2).map(c => [c[1], c[0]]));
      if (ll.length < 2) return null;
      const l = L.polyline(ll, { color: getModeColor(route.steps[0]?.vehicle_type), weight: w, opacity: 0.9 }).addTo(mapInstance.current);
      layersRef.current.push(l);
      return l;
    };
    if (Array.isArray(alts)) alts.forEach(a => draw(a, 3));
    const p = draw(primary, 6);
    if (p) try { mapInstance.current?.fitBounds(p.getBounds(), { padding: [50, 50] }); } catch {}
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
    skeletonTimer.current = setTimeout(() => setShowSkeleton(true), 3000);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${API_BASE}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "guest", message: q }), signal: ctrl.signal });
      clearTimeout(t); clearTimeout(skeletonTimer.current); setShowSkeleton(false);
      const data = await res.json();
      const primary = cleanRoute(data.route_data);
      const alts = (data.alternatives || []).map(cleanRoute).filter(Boolean);
      setMessages(p => [...p, { sender: "bot", text: data.reply_text, routeData: primary, alts, origin: data.origin, dest: data.destination }]);
      if (primary) drawRoutes(primary, alts);
    } catch (err) {
      clearTimeout(skeletonTimer.current); setShowSkeleton(false);
      setMessages(p => [...p, { sender: "bot", text: err.name === "AbortError" ? "⏰ Matagal masyado." : "❌ May error sa server." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      <div ref={mapRef} className="absolute inset-0 z-0" />
      <div className="absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-10 flex flex-col max-h-[75vh] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 font-bold text-sm flex items-center gap-2 shrink-0">🚐 Para PH <span className="text-[10px] font-normal opacity-80">v2.1</span></div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
          {!routesLoaded && (
            <div className="flex justify-start"><div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-none shadow-sm max-w-[85%]"><div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /><div><p className="text-sm font-semibold text-gray-800">Loading routes...</p><p className="text-[10px] text-gray-400">Drawing Metro Manila transit network</p></div></div><div className="mt-2 bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className="bg-gradient-to-r from-pink-500 to-rose-500 h-full rounded-full animate-pulse" style={{ width: "60%" }} /></div></div></div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] p-3 rounded-2xl text-sm ${msg.sender === "user" ? "bg-pink-500 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow-sm"}`}><div className="whitespace-pre-wrap mb-1">{msg.text}</div>
              {msg.routeData?.success && msg.routeData.steps?.length > 0 && (<div className="mt-2"><StepByStep steps={msg.routeData.steps} title={`✅ ${msg.routeData.message}`} />{msg.alts?.length > 0 && (<div className="mt-2"><p className="text-[10px] text-gray-400 uppercase font-bold mb-1 px-1">Alternatives</p>{msg.alts.map((alt, j) => alt?.steps ? <StepByStep key={j} steps={alt.steps} title={`🔄 ${alt.message}`} /> : null)}</div>)}<button className="w-full mt-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-2 rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-pink-500/25 transition-all">🚀 Start Navigation</button><RatingSystem routeData={msg.routeData} origin={msg.origin} dest={msg.dest} /></div>)}</div></div>
          ))}
          {showSkeleton && (<div className="space-y-2 animate-pulse p-3"><div className="h-3 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-200 rounded w-1/2" /><div className="h-8 bg-gray-200 rounded w-full mt-2" /></div>)}
          {loading && !showSkeleton && (<div className="flex justify-start"><div className="bg-white border border-gray-100 text-gray-400 p-3 rounded-2xl rounded-bl-none text-sm italic shadow-sm">Naghahanap ng ruta…</div></div>)}
        </div>
        <div className="p-3 border-t border-gray-100 bg-white flex gap-2 shrink-0"><input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Saan papunta?" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all" /><button onClick={send} disabled={loading} className="bg-pink-500 text-white px-4 py-2 rounded-xl hover:bg-pink-600 disabled:opacity-50 font-semibold text-sm transition-colors">Send</button></div>
      </div>
    </div>
  );
}