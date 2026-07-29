import { useEffect, useRef, useState, useCallback } from "react";
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

const CENTER = [14.5995, 120.9842];
const API = getApiBaseUrl();

function parseRouteName(raw) {
  if (!raw) return { origin: "", destination: "" };
  const m = raw.trim().match(/^(.*?)\s*-\s*(.*)$/);
  return m ? { origin: m[1].trim(), destination: m[2].trim() } : { origin: raw.trim(), destination: "" };
}

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return m;
}

export default function RoutesExplorer() {
  const isMobile = useIsMobile();
  const mapRef = useRef(null), mapInst = useRef(null), layerRef = useRef(null);
  const [all, setAll] = useState([]), [verified, setVerified] = useState([]), [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState(""), [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tab, setTab] = useState("verified"), [tabKey, setTabKey] = useState(0);

  // Build mode: queue of selected verified routes
  const [buildQueue, setBuildQueue] = useState([]);
  const [buildResult, setBuildResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/admin/routes/verified`).then(r => r.json()).catch(() => ({ routes: [] })),
      fetch(`${API}/admin/routes/csv`).then(r => r.json()).catch(() => ({ routes: [] })),
    ]).then(([v, a]) => { setVerified(v.routes || []); setAll(a.routes || []); setFiltered(a.routes || []); }).finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(all); return; }
    setFiltered(all.filter(r => (r.route_name || "").toLowerCase().includes(search.toLowerCase())));
  }, [search, all]);

  useEffect(() => { if (!isMobile && mobileOpen) setMobileOpen(false); }, [isMobile, mobileOpen]);

  const clearMap = useCallback(() => { layerRef.current?.clearLayers(); setError(null); setBuildResult(null); }, []);
  const resetMap = useCallback(() => { clearMap(); setSelected(null); setBuildQueue([]); mapInst.current?.setView(CENTER, 12); }, [clearMap]);

  const drawRouteOnMap = useCallback(async (name) => {
    try {
      // Load the RAW geojson, not graph edges
      const res = await fetch(`${API}/admin/routes/geojson`);
      if (!res.ok) throw new Error("No geometry");
      const geo = await res.json();
      
      // Find the matching feature
      const feature = geo.features.find(f => 
        (f.properties?.route_long_name || f.properties?.name || '') === name
      );
      
      if (!feature) throw new Error("Route not found");
      
      layerRef.current?.clearLayers();
      
      // Let Leaflet render the MultiLineString directly — same as QGIS
      L.geoJSON(feature, {
        style: { color: "#310775", weight: 4, opacity: 0.9 }
      }).addTo(layerRef.current);
      
      // Fit bounds
      const bounds = L.geoJSON(feature).getBounds();
      if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60] });
      
      return true;
    } catch {
      return false;
    }
  }, []);

  // Click a verified route: draw it AND add to build queue if in build mode
   const selectVerified = useCallback(async (item) => {
    if (tab === "build") {
      const exists = buildQueue.find(q => q.key === item.key);
      let newQueue;
      if (exists) {
        newQueue = buildQueue.filter(q => q.key !== item.key);
      } else {
        newQueue = [...buildQueue, item];
      }
      setBuildQueue(newQueue);
      
      // Redraw ALL routes in the new queue together
      layerRef.current?.clearLayers();
      const allCoords = [];
      for (const q of newQueue) {
        const coords = await drawRouteOnMap(q.key);
        if (coords) {
          L.polyline(coords, { color: "#310775", weight: 3, opacity: 0.7 })
            .addTo(layerRef.current)
            .bindTooltip(q.name, { sticky: true });
          allCoords.push(...coords);
        }
      }
      if (allCoords.length > 0) {
        mapInst.current?.fitBounds(L.latLngBounds(allCoords), { padding: [60, 60] });
      }
      return;
    }
    // Normal mode: toggle single route view
    if (selected?.data?.key === item.key) { setSelected(null); layerRef.current?.clearLayers(); return; }
    setLoading(true); setSelected({ type: "verified", data: item }); setMobileOpen(false);
    layerRef.current?.clearLayers();
    const coords = await drawRouteOnMap(item.key);
    if (coords) {
      L.polyline(coords, { color: "#310775", weight: 4, opacity: 0.9 })
        .addTo(layerRef.current)
        .bindTooltip(item.name, { sticky: true });
        mapInst.current?.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });
    }
    setLoading(false);
  }, [tab, buildQueue, selected, drawRouteOnMap]);

  const selectCSV = useCallback(async (route) => {
    if (selected?.data?.route_id === route.route_id && selected?.type === "csv") return;
    setLoading(true); setSelected({ type: "csv", data: route }); setMobileOpen(false);
    const p = parseRouteName(route.route_name);
    const match = verified.find(v => { const vp = parseRouteName(v.name); return vp.origin && p.origin && vp.origin.toLowerCase().includes(p.origin.toLowerCase()); });
    if (match) {
      const coords = await drawRouteOnMap(match.key);
      if (coords) { layerRef.current?.clearLayers(); L.polyline(coords, { color: "#310775", weight: 4, opacity: 0.9 }).addTo(layerRef.current); mapInst.current?.fitBounds(L.latLngBounds(coords), { padding: [60, 60] }); setLoading(false); return; }
    }
    // Geocode fallback
    const places = [p.origin, p.destination].filter(Boolean);
    layerRef.current?.clearLayers(); const bounds = L.latLngBounds([]);
    for (let i = 0; i < places.length; i++) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(places[i])},%20Metro%20Manila&limit=1`);
        const data = await res.json();
        if (data[0]) { const ll = [parseFloat(data[0].lat), parseFloat(data[0].lon)]; L.circleMarker(ll, { radius: 9, fillColor: i === 0 ? "#22c55e" : "#310775", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(layerRef.current); bounds.extend(ll); }
      } catch {}
    }
    if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60] });
    setError("Approximate location (not yet GPS-mapped)");
    setLoading(false);
  }, [selected, verified, drawRouteOnMap]);

  // Calculate chained build route
  const calculateBuild = async () => {
    if (buildQueue.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/routes/chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes: buildQueue.map(r => r.name) })
      });
      const data = await res.json();
      setBuildResult(data);
      if (data.geometry) {
        layerRef.current?.clearLayers();
        const coords = data.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        L.polyline(coords, { color: "#22c55e", weight: 5, opacity: 0.9 }).addTo(layerRef.current);
        mapInst.current?.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });
      }
    } catch {}
    setLoading(false);
  };

  const saveBuild = async () => {
    if (!buildResult?.success) return;
    setSaving(true);
    try {
      await fetch(`${API}/admin/routes/custom`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Chain: ${buildQueue.map(r => r.name).join(" → ")}`,
          stops: buildQueue.map(r => r.name),
          path_nodes: [],
          total_fare: buildResult.total_fare,
          total_time: buildResult.total_time_min,
        })
      });
      alert("✅ Route saved!");
    } catch {}
    setSaving(false);
  };

  const card = selected ? (() => {
    if (selected.type === "verified") { const it = selected.data; const p = parseRouteName(it.name); return { title: it.name, sub: `${it.edge_count || "?"} segments · GPS Verified`, origin: p.origin || it.name, dest: p.destination }; }
    const r = selected.data; const p = parseRouteName(r.route_name);
    return { title: r.route_name, sub: `${r.agency || "Transit"}`, origin: p.origin || r.route_name, dest: p.destination };
  })() : null;

  const sidebar = (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        <Link to="/" className="flex items-center gap-2 no-underline"><img src={paralogo} alt="PARAPH" className="h-8 w-8" /><span className="font-bold text-sm text-gray-900">PARAPH</span></Link>
      </div>
      <div className="px-4 py-3.5 shrink-0 bg-gradient-to-r from-purple-800 to-purple-600">
        <p className="text-sm font-bold text-white mb-0.5">🚐 Transit Routes</p>
        <p className="text-[11px] text-purple-200">Metro Manila, Philippines</p>
        <div className="flex gap-2 mt-2">
          <div className="flex-1 bg-white/15 rounded-lg py-1.5 px-2.5 text-center"><div className="text-[15px] font-extrabold text-white">{all.length}</div><div className="text-[10px] text-purple-200">Total Routes</div></div>
          <div className="flex-1 bg-white/15 rounded-lg py-1.5 px-2.5 text-center"><div className="text-[15px] font-extrabold text-white">{verified.length}</div><div className="text-[10px] text-purple-200">GPS Verified</div></div>
        </div>
      </div>
      <div className="flex border-b border-gray-100 shrink-0">
        {[["verified", "✓ Verified"], ["all", "All Routes"], ["build", "🔧 Build"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setTabKey(k => k + 1); clearMap(); setSelected(null); setBuildQueue([]); }} className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${tab === id ? "text-purple-800 border-purple-800" : "text-gray-400 border-transparent hover:text-gray-500"}`}>{label}</button>
        ))}
      </div>

       {/* BUILD TAB */}
      {tab === "build" && (
        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          <div className="flex gap-2">
  <button 
    onClick={async () => {
      setLoading(true);
      setBuildQueue(verified);
      try {
        const res = await fetch(`${API}/admin/routes/geojson`);
        const geo = await res.json();
        layerRef.current?.clearLayers();
        
        const allNames = verified.map(v => v.name);
        const features = geo.features.filter(f => {
          const name = f.properties?.route_long_name || f.properties?.name || '';
          return allNames.includes(name);
        });
        
        const collection = { type: "FeatureCollection", features };
        L.geoJSON(collection, {
          style: { color: "#310775", weight: 3, opacity: 0.7 },
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.route_long_name || feature.properties?.name || '';
            layer.bindTooltip(name, { sticky: true });
          }
        }).addTo(layerRef.current);
        
        const bounds = L.geoJSON(collection).getBounds();
        if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60] });
      } catch {}
      setLoading(false);
    }}
    className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg bg-purple-100 text-purple-800 hover:bg-purple-200"
  >
    ✅ Select All ({verified.length})
  </button>
  <button 
    onClick={() => { setBuildQueue([]); layerRef.current?.clearLayers(); }}
    className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
  >
    Clear All
  </button>
</div>
          <p className="text-[11px] text-gray-400">Click verified routes below to toggle them into your trip</p>
          {buildQueue.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Trip Queue ({buildQueue.length})</p>
              {buildQueue.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-purple-50 rounded-lg p-2">
                  <span className="w-5 h-5 rounded-full bg-purple-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                  <span className="text-gray-700 truncate">{r.name}</span>
                  <button onClick={() => { setBuildQueue(prev => prev.filter((_, j) => j !== i)); }} className="ml-auto text-red-400 text-lg shrink-0">×</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400">↓ Toggle routes from the list below ↓</p>
          <div className="border-t border-gray-100 pt-2 max-h-60 overflow-y-auto">
            {verified.map((item) => (
              <button key={item.key} onClick={() => selectVerified(item)}
                className={`w-full text-left p-2 rounded-lg flex items-start gap-2 mb-0.5 text-xs ${buildQueue.find(q => q.key === item.key) ? "bg-purple-100" : "hover:bg-gray-50"}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 mt-0.5 ${buildQueue.find(q => q.key === item.key) ? "bg-purple-800 text-white" : "bg-gray-200 text-gray-500"}`}>{buildQueue.find(q => q.key === item.key) ? "✓" : "+"}</span>
                <span className="truncate text-gray-700">{item.name}</span>
              </button>
            ))}
          </div>
          <button onClick={calculateBuild} disabled={buildQueue.length < 2 || loading}
            className="w-full py-2.5 bg-purple-800 text-white rounded-xl font-bold text-sm disabled:opacity-50">
            {loading ? "Calculating..." : "🚀 Calculate Full Trip"}
          </button>
          {buildResult && buildResult.success && (
            <div className="bg-green-50 rounded-xl p-3 text-xs space-y-1">
              <p className="font-bold text-green-800">✅ Route Calculated</p>
              <p>💰 ₱{buildResult.total_fare?.toFixed(0)} · ⏱ {buildResult.total_time_min?.toFixed(0)} min · 📏 {buildResult.total_distance_km?.toFixed(1)} km</p>
              {buildResult.segments && (
                <div className="mt-1 space-y-0.5">
                  {buildResult.segments.map((seg, i) => (
                    <div key={i} className="text-gray-600">{i+1}. {seg.name} ({seg.time_min}min)</div>
                  ))}
                </div>
              )}
              <button onClick={saveBuild} disabled={saving} className="w-full mt-2 py-2 bg-green-600 text-white rounded-lg font-bold text-xs">
                {saving ? "Saving..." : "💾 Save as Custom Route"}
              </button>
            </div>
          )}
          {buildResult && buildResult.error && (
            <div className="bg-red-50 rounded-xl p-3 text-xs text-red-600">❌ {buildResult.error}</div>
          )}
          <button onClick={resetMap} className="w-full py-2 border border-gray-200 text-gray-500 rounded-lg text-xs">Clear All</button>
        </div>
      )}

      {/* VERIFIED / ALL TABS */}
      {tab !== "build" && (
        <>
          {tab === "all" && (
            <div className="px-3 py-2 border-b border-gray-100 shrink-0">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search route name..." className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400" />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <div key={tabKey} className="min-h-full">
              {tab === "verified" ? (
                <div className="p-2">
                  <p className="text-[11px] text-gray-400 px-1 py-1.5">{verified.length} GPS-traced paths — click to view</p>
                  {verified.map((item) => {
                    const active = selected?.data?.key === item.key;
                    const p = parseRouteName(item.name);
                    return (
                      <button key={item.key} onClick={() => selectVerified(item)} className={`w-full text-left p-2.5 rounded-lg flex items-start gap-2 mb-0.5`} style={{ background: active ? "#f3f0ff" : "transparent" }}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 mt-0.5 ${active ? "bg-purple-800 text-white" : "bg-green-100 text-green-700"}`}>✓</span>
                        <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate text-gray-900">{p.origin || item.name}</p>{p.destination && <p className="text-[10px] text-gray-400 truncate">→ {p.destination}</p>}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-2">
                  {listLoading ? <div className="text-center py-8 text-gray-400 text-xs">Loading...</div> :
                    filtered.map((route) => {
                      const active = selected?.type === "csv" && selected?.data?.route_id === route.route_id;
                      const p = parseRouteName(route.route_name);
                      const hasGeo = verified.some(v => v.name.toLowerCase().includes(p.origin.toLowerCase()));
                      return (
                        <button key={route.route_id} onClick={() => selectCSV(route)} className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2 mb-0.5`} style={{ background: active ? "#f3f0ff" : "transparent" }}>
                          <span className={`shrink-0 min-w-[34px] text-center text-[10px] font-bold py-0.5 px-1 rounded ${active ? "bg-purple-800 text-white" : "bg-gray-100 text-gray-500"}`}>{route.route_id?.replace("ROUTE_", "") || "?"}</span>
                          <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate text-gray-900">{p.origin || route.route_name}</p>{p.destination && <p className="text-[10px] text-gray-400 truncate">→ {p.destination}</p>}</div>
                          {hasGeo && <span className="shrink-0 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">MAP</span>}
                        </button>
                      );
                    })
                  }
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <div className="p-3 border-t border-gray-100 bg-gray-50 shrink-0">
        <Link to="/" className="flex items-center justify-center gap-2 py-2.5 bg-purple-800 text-white rounded-xl font-semibold text-[13px] no-underline">Commute</Link>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex z-50 bg-gray-100">
      {!isMobile && <aside className="w-80 shrink-0 h-full border-r border-gray-200 shadow-lg">{sidebar}</aside>}
      {isMobile && mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-60" />}
      {isMobile && (
        <aside className={`fixed top-0 left-0 bottom-0 w-80 z-70 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="relative h-full"><button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 bg-gray-100 rounded-lg w-7 h-7 flex items-center justify-center">✕</button>{sidebar}</div>
        </aside>
      )}
      <div className="flex-1 relative min-w-0">
        {isMobile && <button onClick={() => setMobileOpen(true)} className="absolute top-4 left-4 z-40 bg-white rounded-2xl px-3.5 py-2 shadow-md font-semibold text-[13px] text-purple-800">Routes</button>}
        <Link to="/" className="absolute top-4 right-4 z-40 bg-white rounded-2xl px-3.5 py-2 shadow-md text-gray-700 font-medium text-[13px] no-underline">Home</Link>
        <div ref={mapRef} className="absolute inset-0 z-0" />
        {loading && (
          <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 99999 }}>
            <div className="bg-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-3">
              <div className="spinner" style={{ width: 20, height: 20, border: "3px solid #f3f0ff", borderTopColor: "#310775", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
              <div><p className="text-[13px] font-bold text-gray-900">Loading…</p></div>
            </div>
          </div>
        )}
        {selected && !loading && card && tab !== "build" && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 99999, width: "min(90vw, 400px)" }}>
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-purple-800 to-purple-600 px-4 py-3 flex items-center gap-2.5">
                <div className="flex-1">{card.sub && <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{card.sub}</span>}</div>
                <button onClick={resetMap} className="bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-white">✕</button>
              </div>
              <div className="p-4">
                {error && <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-2 mb-3">⚠ {error}</p>}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 pt-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><div className="w-0.5 flex-1 bg-gray-300 my-1 min-h-[20px]" /><div className="w-2.5 h-2.5 rounded-full bg-purple-800" /></div>
                  <div className="flex-1 min-w-0 space-y-2"><div><p className="text-[10px] font-bold text-gray-400 uppercase">From</p><p className="text-[13px] font-extrabold text-gray-900 truncate">{card.origin}</p></div>{card.dest && <div><p className="text-[10px] font-bold text-gray-400 uppercase">To</p><p className="text-[13px] font-extrabold text-gray-900 truncate">{card.dest}</p></div>}</div>
                </div>
                <Link to="/" className="flex items-center justify-center gap-2 py-2.5 mt-3 bg-purple-800 text-white rounded-xl font-bold text-[13px] no-underline">Commute</Link>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}