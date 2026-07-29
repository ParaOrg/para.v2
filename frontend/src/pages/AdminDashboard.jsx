import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getApiBaseUrl } from "../config/api";
import paralogo from "../assets/images/paralogo.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const API = getApiBaseUrl();
const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "routes", label: "Route Inspector", icon: "🗺️" },
  { id: "traffic", label: "Traffic", icon: "🚦" },
  { id: "telemetry", label: "Telemetry", icon: "📡" },
  { id: "gis", label: "GIS Tools", icon: "🛠️" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const adminMapRef = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const [graphRes, verifiedRes, csvRes] = await Promise.all([
        fetch(`${API}/admin/graph/stats`).then(r => r.json()),
        fetch(`${API}/admin/routes/verified`).then(r => r.json()),
        fetch(`${API}/admin/routes/csv`).then(r => r.json()),
      ]);
      setStats({ ...graphRes, verified: verifiedRes.count, csv: csvRes.count });
    } catch {}
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/routes`);
      const data = await res.json();
      setRoutes(data.routes || []);
    } catch {}
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (activeTab === "routes") fetchRoutes(); }, [activeTab, fetchRoutes]);

  // Init admin route map
  useEffect(() => {
    if (activeTab !== "routes") return;
    setTimeout(() => {
      const el = document.getElementById("admin-route-map");
      if (!el || adminMapRef.current) return;
      const map = L.map(el, { zoomControl: true }).setView([14.5995, 120.9842], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      adminMapRef.current = map;
    }, 200);
  }, [activeTab]);

  const showRoute = (name) => {
    setSelectedRoute(name);
    fetch(`${API}/admin/routes/geometry/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => {
        const map = adminMapRef.current;
        if (!map) return;
        // Clear old layers
        map.eachLayer(l => { if (l instanceof L.Polyline || l instanceof L.Marker || l instanceof L.CircleMarker) map.removeLayer(l); });
        
        const coords = data.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        
        // Draw the route
        L.polyline(coords, { color: "#310775", weight: 4, opacity: 0.9 }).addTo(map);
        
        // Start marker
        L.circleMarker(coords[0], { radius: 6, fillColor: "#22c55e", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(map).bindTooltip("Start");
        // End marker
        L.circleMarker(coords[coords.length-1], { radius: 6, fillColor: "#ef4444", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(map).bindTooltip("End");
        
        // Directional arrows every N points
        const step = Math.max(1, Math.floor(coords.length / 10));
        for (let i = step; i < coords.length - step; i += step) {
          const prev = coords[i - step];
          const curr = coords[i];
          const angle = Math.atan2(curr[1] - prev[1], curr[0] - prev[0]) * 180 / Math.PI;
          L.marker(curr, {
            icon: L.divIcon({
              className: '',
              html: `<div style="transform:rotate(${angle}deg);color:#310775;font-size:18px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));">➤</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })
          }).addTo(map);
        }
        
        map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
      })
      .catch(() => setMessage({ type: "error", text: "Could not load route geometry" }));
  };
  
  const flipEdge = () => {
    const from = prompt("From node (e.g., '(14.599, 120.984)'):");
    const to = prompt("To node:");
    if (from && to) {
      setLoading(true);
      fetch(`${API}/admin/routes/flip`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_node: from, to_node: to })
      }).then(r => r.json()).then(d => {
        setMessage({ type: "success", text: `Flipped: ${d.route || "edge"}` });
        fetchRoutes();
      }).catch(() => setMessage({ type: "error", text: "Flip failed" })).finally(() => setLoading(false));
    }
  };

  const renameRoute = () => {
    const oldName = prompt("Old route name:");
    const newName = prompt("New route name:");
    if (oldName && newName) {
      setLoading(true);
      fetch(`${API}/admin/routes/rename`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_name: oldName, new_name: newName })
      }).then(r => r.json()).then(d => {
        setMessage({ type: "success", text: `Renamed ${d.edges_renamed} edges` });
        fetchRoutes();
      }).catch(() => setMessage({ type: "error", text: "Rename failed" })).finally(() => setLoading(false));
    }
  };

  const reloadCSV = () => {
    setLoading(true);
    fetch(`${API}/admin/routes/reload`, { method: "POST" })
      .then(() => { setMessage({ type: "success", text: "CSV cache cleared" }); fetchStats(); })
      .finally(() => setLoading(false));
  };

  const simulatePings = () => {
    setLoading(true);
    fetch(`${API}/telemetry/simulate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 30 })
    }).then(() => setMessage({ type: "success", text: "30 pings simulated" })).finally(() => setLoading(false));
  };

  const analyzeTraffic = () => {
    setLoading(true);
    fetch(`${API}/traffic/analyze`, { method: "POST" })
      .then(() => setMessage({ type: "success", text: "Traffic analysis complete" })).finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={paralogo} alt="PARAPH" className="h-8 w-8" />
            <div><h1 className="text-sm font-bold text-gray-900">Admin Dashboard</h1><p className="text-[10px] text-gray-400">Diagnostics & Management</p></div>
          </div>
          <Link to="/" className="text-xs text-gray-500 hover:text-purple-800 font-medium">← Back to App</Link>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === t.id ? "bg-purple-800 text-white shadow-lg" : "text-gray-500 hover:bg-gray-100"
              }`}>{t.icon} {t.label}</button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {message && (
          <div className={`mb-4 p-4 rounded-xl text-sm font-mono whitespace-pre-wrap ${
            message.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"
          }`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right text-xs opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[{ label: "Graph Nodes", value: stats?.nodes, color: "blue" }, { label: "Graph Edges", value: stats?.edges, color: "purple" }, { label: "GPS Verified", value: stats?.verified, color: "green" }, { label: "Total Registered", value: stats?.csv, color: "purple" }].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{s.label}</p>
                  <p className={`text-3xl font-extrabold text-${s.color}-600`}>{s.value ?? "—"}</p>
                </div>
              ))}
            </div>
            {stats?.vehicle_types && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Vehicle Types</h3>
                <div className="flex gap-4">
                  {Object.entries(stats.vehicle_types).map(([k, v]) => (
                    <div key={k} className="text-center"><div className="text-lg font-bold text-gray-800">{v}</div><div className="text-[10px] text-gray-400 capitalize">{k}</div></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROUTE INSPECTOR */}
        {activeTab === "routes" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <select onChange={(e) => { if (e.target.value) showRoute(e.target.value); }}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium">
                <option value="">Select a route to inspect...</option>
                {routes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={flipEdge} disabled={loading} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">🔀 Flip Edge</button>
              <button onClick={renameRoute} disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-50">✏️ Rename Route</button>
              <button onClick={fetchRoutes} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300">🔄 Refresh</button>
            </div>
            
            <div id="admin-route-map" style={{ height: "400px" }} className="rounded-2xl border border-gray-200 overflow-hidden" />
            
            {selectedRoute && <p className="text-xs text-gray-500">🔍 Inspecting: <strong>{selectedRoute}</strong> — green = start, red = end</p>}
            
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">All Routes ({routes.length})</h3></div>
              <div className="max-h-96 overflow-y-auto">
                {routes.map(r => (
                  <div key={r} onClick={() => showRoute(r)} className={`px-4 py-2.5 border-t border-gray-50 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${selectedRoute === r ? "bg-purple-50" : ""}`}>
                    <span className="text-sm font-medium text-gray-900 truncate">{r}</span>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(r); }} className="text-[10px] text-gray-400 hover:text-purple-800 shrink-0 ml-2">📋</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TRAFFIC */}
        {activeTab === "traffic" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={simulatePings} disabled={loading} className="px-4 py-2 bg-purple-800 text-white rounded-xl text-sm font-semibold hover:bg-purple-900 disabled:opacity-50">🎲 Simulate 30 Pings</button>
              <button onClick={analyzeTraffic} disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">📊 Analyze Traffic</button>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Traffic API</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto">
{`curl -X POST ${API}/telemetry/ping \\
  -H "Content-Type: application/json" \\
  -d '{"device_id":"phone_001","lat":14.5995,"lng":120.9842,"speed_kmh":25}'

curl ${API}/traffic/geojson`}
              </pre>
            </div>
          </div>
        )}

        {/* TELEMETRY */}
        {activeTab === "telemetry" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={simulatePings} disabled={loading} className="px-4 py-2 bg-purple-800 text-white rounded-xl text-sm font-semibold hover:bg-purple-900 disabled:opacity-50">🎲 Simulate Pings</button>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Manual Telemetry</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto">
{`POST ${API}/telemetry/ping
POST ${API}/telemetry/batch
GET  ${API}/admin/telemetry/recent`}
              </pre>
            </div>
          </div>
        )}

        {/* GIS TOOLS */}
        {activeTab === "gis" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={reloadCSV} disabled={loading} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left disabled:opacity-50">
                <span className="text-2xl">🔄</span><h3 className="text-sm font-bold text-gray-900 mt-2">Reload CSV Routes</h3><p className="text-xs text-gray-400 mt-1">Clear cache and re-read full_jeepney_routes.csv</p>
              </button>
              <button onClick={flipEdge} disabled={loading} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left disabled:opacity-50">
                <span className="text-2xl">🔀</span><h3 className="text-sm font-bold text-gray-900 mt-2">Flip Edge Direction</h3><p className="text-xs text-gray-400 mt-1">Reverse a one-way edge by node coordinates</p>
              </button>
              <button onClick={renameRoute} disabled={loading} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left disabled:opacity-50">
                <span className="text-2xl">✏️</span><h3 className="text-sm font-bold text-gray-900 mt-2">Rename Route</h3><p className="text-xs text-gray-400 mt-1">Fix misnamed routes across all edges</p>
              </button>
              <button onClick={analyzeTraffic} disabled={loading} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left disabled:opacity-50">
                <span className="text-2xl">📊</span><h3 className="text-sm font-bold text-gray-900 mt-2">Run Traffic Analysis</h3><p className="text-xs text-gray-400 mt-1">Process telemetry pings for congestion</p>
              </button>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Data Folder</h3>
              <pre className="bg-gray-50 p-4 rounded-xl text-xs text-gray-600">{`geojson_data/
├── routes.geojson       ← GPS-traced routes
├── 1routes.geojson      ← Additional routes  
├── full_jeepney_routes.csv ← Route registry
└── (drop new files anytime)`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}