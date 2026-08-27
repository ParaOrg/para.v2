/**
 * RoutesExplorer.jsx — Browse verified, unverified, and reference routes on a map.
 * Build tab draws mega map of all routes with clickable mode legend.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getApiBaseUrl } from "../utils/api";
import { getModeColor } from "../utils/modeColors";
import Navbar from "../components/Navbar";
import LandingPageFooter from "../components/landingpage-footer.component.jsx";
import LiveRouteRecorder from "../components/LiveRouteRecorder";
import RailNetworkOverlay from '../components/RailNetworkOverlay';
import BottomNav from "../components/BottomNav";
import WeatherPage from "../components/WeatherPage";
import GpsIcon from "../components/GpsIcon";
import { useAuth } from "../context/AuthContext";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const CENTER = [14.5995, 120.9842];
const API = getApiBaseUrl();
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

function AdminModePanel({ routes }) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modeMap, setModeMap] = useState({});
  
  const handleModeChange = async (routeUuid, newMode) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ph_routes?route_uuid=eq.${routeUuid}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        setModeMap(prev => ({ ...prev, [routeUuid]: newMode }));
      }
    } catch (err) {
      console.error('Failed to update mode:', err);
    }
  };
  
  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="w-full py-1.5 text-[10px] font-semibold rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100">
        🔧 Admin: Edit Route Modes ({routes.length} routes)
      </button>
    );
  }
  
  const filtered = routes.filter(r => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const matchesName = (r.name || "").toLowerCase().includes(q);
    const matchesMode = (r.mode || "unknown").toLowerCase() === q;
    return matchesName || matchesMode;
  });
  
  return (
    <div className="border border-orange-200 rounded-xl p-3 bg-orange-50/50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-orange-700">Edit Route Modes</p>
        <button onClick={() => setExpanded(false)} className="text-[10px] text-orange-500 font-bold">Close</button>
      </div>
      <input 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)} 
        placeholder="Search route name or mode..."
        className="w-full px-2 py-1.5 text-[10px] bg-white border border-gray-200 rounded-lg mb-2 outline-none focus:border-orange-400"
      />
      <select
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-2 py-1.5 text-[10px] bg-white border border-gray-200 rounded-lg mb-2 outline-none focus:border-orange-400"
      >
        <option value="">All modes</option>
        <option value="jeepney">jeepney</option>
        <option value="bus">bus</option>
        <option value="rail">rail</option>
        <option value="uv_express">uv_express</option>
        <option value="trike">trike</option>
        <option value="ferry">ferry</option>
        <option value="walking">walking</option>
        <option value="unknown">unknown</option>
      </select>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filtered.map((route) => {
          const currentMode = modeMap[route.route_uuid] || route.mode || "unknown";
          return (
            <div key={route.route_uuid} className="flex items-center gap-2 text-[10px] bg-white rounded-lg px-2 py-1.5 border border-gray-100">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getModeColor(currentMode) }} />
              <span className="text-gray-700 truncate flex-1">{route.name}</span>
              <select 
                value={currentMode}
                onChange={(e) => handleModeChange(route.route_uuid, e.target.value)}
                className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white shrink-0"
              >
                <option value="jeepney">jeepney</option>
                <option value="bus">bus</option>
                <option value="rail">rail</option>
                <option value="uv_express">uv_express</option>
                <option value="trike">trike</option>
                <option value="ferry">ferry</option>
                <option value="walking">walking</option>
              </select>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-orange-400 mt-2">Each dropdown updates that specific route in Supabase.</p>
    </div>
  );
}

export default function RoutesExplorer() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "founder";
  const isMobile = useIsMobile();
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const layerRef = useRef(null);

  const [allRoutes, setAllRoutes] = useState([]);
  const [referenceRoutes, setReferenceRoutes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("verified");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [buildQueue, setBuildQueue] = useState([]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [recordingRoute, setRecordingRoute] = useState(null);
  const [activeMode, setActiveMode] = useState(null);
  const [showWeather, setShowWeather] = useState(false);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(CENTER, 12);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;
  }, []);

  // Load routes
  useEffect(() => {
    (async () => {
      try {
        const [routesRes, refRes] = await Promise.all([
          fetch(`${API}/routes/public`),
          fetch(`${API}/routes/public/reference`),
        ]);
        const routesData = await routesRes.json();
        const refData = await refRes.json();
        const routes = (routesData.routes || []).filter(r => !r.is_test && !/test|demo|dummy|staging/i.test(r.name || ''));
        setAllRoutes(routes);
        setReferenceRoutes(refData.routes || []);
        setFiltered(routes.filter(r => r.is_approved));
      } catch (e) {
        console.error("Failed to load routes:", e);
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  // Filter by search + tab
  useEffect(() => {
    let source;
    if (tab === "verified") source = allRoutes.filter(r => r.is_approved);
    else if (tab === "unverified") source = allRoutes.filter(r => !r.is_approved);
    else if (tab === "build") source = allRoutes;
    else source = referenceRoutes;
    if (!search.trim()) { setFiltered(source); return; }
    const q = search.toLowerCase();
    setFiltered(source.filter((r) => (r.name || r.route_name || "").toLowerCase().includes(q)));
  }, [search, tab, allRoutes, referenceRoutes]);

  useEffect(() => { if (!isMobile && mobileOpen) setMobileOpen(false); }, [isMobile, mobileOpen]);

  // Draw mega map when Build tab active and queue has routes
  useEffect(() => {
    if (tab !== "build") return;
    if (buildQueue.length === 0) return;
    
    const drawMegaMap = async () => {
      setLoading(true);
      layerRef.current?.clearLayers();
      const bounds = L.latLngBounds([]);
      
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/ph_route_shapes?select=route_uuid,geom_geojson&limit=2000`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        });
        if (!res.ok) throw new Error("Failed to fetch shapes");
        const allShapes = await res.json();
        
        const shapeByUuid = {};
        allShapes.forEach(s => {
          if (s.route_uuid && s.geom_geojson) {
            shapeByUuid[s.route_uuid] = s.geom_geojson;
          }
        });
        
        // Sort: most frequent drawn first (bottom), least frequent last (top)
        const modeFrequency = {};
        buildQueue.forEach(r => {
          const m = r.mode || "default";
          modeFrequency[m] = (modeFrequency[m] || 0) + 1;
        });
        const sortedQueue = [...buildQueue].sort((a, b) => {
          const ma = a.mode || "default";
          const mb = b.mode || "default";
          return (modeFrequency[mb] || 0) - (modeFrequency[ma] || 0);
        });
        
        for (const route of sortedQueue) {
          if (activeMode && route.mode !== activeMode) continue;
          const routeId = route.route_uuid;
          if (!routeId || routeId === "undefined") continue;
          
          const geomData = shapeByUuid[routeId];
          if (!geomData) continue;
          
          const geo = {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              properties: {},
              geometry: geomData
            }]
          };
          
          const layer = L.geoJSON(geo, { 
            style: { color: getModeColor(route.mode || "default"), weight: 3, opacity: 0.7 } 
          }).addTo(layerRef.current);
          layer.bindTooltip(route.name || route.route_name, { sticky: true });
          const b = layer.getBounds();
          if (b.isValid()) bounds.extend(b);
        }
      } catch (err) {
        console.error("Mega map error:", err);
      }
      
      if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60] });
      setLoading(false);
    };
    
    drawMegaMap();
  }, [tab, buildQueue, activeMode]);

  const drawRoute = useCallback(async (routeId) => {
    try {
      const selectedRoute = allRoutes.find(r => r.route_uuid === routeId);
      if (selectedRoute?.has_shape === false) return;
      if (!routeId || routeId === "undefined") return;
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ph_route_shapes?route_uuid=eq.${routeId}&select=geom_geojson&limit=1`, { 
        headers: { apikey: SUPABASE_ANON_KEY } 
      });
      if (!res.ok) throw new Error("No geometry");
      
      const rawData = await res.json();
      const geomData = rawData?.[0]?.geom_geojson;
      if (!geomData) return;
      
      const geo = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: geomData
        }]
      };
      
      layerRef.current?.clearLayers();
      L.geoJSON(geo, { style: { color: getModeColor(selectedRoute?.mode || "default"), weight: 4, opacity: 0.9 } }).addTo(layerRef.current);
      const bounds = L.geoJSON(geo).getBounds();
      if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60] });
    } catch (e) {
      console.error("Failed to load route geometry:", e);
      layerRef.current?.clearLayers();
    }
  }, [allRoutes]);

  const selectRoute = useCallback(async (route) => {
    const id = route.route_uuid || route.id;
    const name = (route.name || route.route_name || "").trim();
    if (!id && !name) return;

    const currentId = selected?.route_uuid || selected?.id;
    const currentName = selected?.route_name || selected?.name || "";
    if (currentId === id || currentName === name) {
      setSelected(null);
      layerRef.current?.clearLayers();
      return;
    }
    setSelected(route);
    setMobileOpen(false);
    setLoading(true);

    if (!id) {
      layerRef.current?.clearLayers();
      const parts = name.split(" - ");
      const origin = (parts[0] || "").trim();
      const dest = (parts[1] || "").trim();
      if (origin && dest) {
        const bounds = L.latLngBounds([]);
        for (const [i, place] of [origin, dest].entries()) {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}, Metro Manila&limit=1`);
            const data = await res.json();
            if (data[0]) {
              const ll = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
              L.circleMarker(ll, { radius: 8, fillColor: i === 0 ? "#22c55e" : "#ef4444", color: "#fff", weight: 2, fillOpacity: 1 })
                .addTo(layerRef.current).bindTooltip(i === 0 ? `Origin: ${place}` : `Dest: ${place}`, { permanent: true, direction: "top" });
              bounds.extend(ll);
            }
          } catch {}
        }
        if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60] });
      }
      setRecordingRoute({ name, uuid: null });
      setShowRecorder(true);
    } else {
      await drawRoute(id);
    }
    setLoading(false);
  }, [selected, drawRoute]);

  const clearSelection = useCallback(() => {
    setSelected(null);
    layerRef.current?.clearLayers();
    mapInst.current?.setView(CENTER, 12);
  }, []);

  const verifiedCount = allRoutes.filter(r => r.is_approved).length;
  const unverifiedCount = allRoutes.filter(r => !r.is_approved).length;

  const sidebar = (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3.5 shrink-0 bg-gradient-to-r from-purple-800 to-purple-600">
        <p className="text-sm font-bold text-white mb-0.5">🚐 Transit Routes</p>
        <p className="text-[11px] text-purple-200">Metro Manila, Philippines</p>
        <div className="flex gap-2 mt-2">
          <div className="flex-1 bg-white/15 rounded-lg py-1.5 px-2.5 text-center">
            <div className="text-[15px] font-extrabold text-white">{verifiedCount}</div>
            <div className="text-[10px] text-purple-200">Verified</div>
          </div>
          <div className="flex-1 bg-white/15 rounded-lg py-1.5 px-2.5 text-center">
            <div className="text-[15px] font-extrabold text-white">{unverifiedCount}</div>
            <div className="text-[10px] text-purple-200">Unverified</div>
          </div>
          <div className="flex-1 bg-white/15 rounded-lg py-1.5 px-2.5 text-center">
            <div className="text-[15px] font-extrabold text-white">{allRoutes.length}</div>
            <div className="text-[10px] text-purple-200">Total</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0 overflow-x-auto">
        {[["verified", "✓ Verified"], ["unverified", "⚠️ Unverified"], ["reference", "📋 Reference"], ["build", "🔧 Build"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); clearSelection(); }}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === id ? "text-purple-800 border-purple-800" : "text-gray-400 border-transparent hover:text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search route name..."
          className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400" />
      </div>

      {/* Build Tab */}
      {tab === "build" && (
        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          <button onClick={() => setBuildQueue([...allRoutes])} className="w-full py-2.5 bg-purple-800 text-white rounded-xl font-bold text-sm">
            🚀 See All Routes ({allRoutes.length})
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setBuildQueue([]); layerRef.current?.clearLayers(); }} className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">Clear All</button>
          </div>
          <p className="text-[11px] text-gray-400">Click routes below to build a custom trip chain on the map.</p>
          {buildQueue.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Trip Queue ({buildQueue.length})</p>
              {buildQueue.slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-purple-50 rounded-lg p-2">
                  <span className="w-5 h-5 rounded-full bg-purple-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                  <span className="text-gray-700 truncate">{r.name}</span>
                  <button onClick={() => setBuildQueue(prev => prev.filter((_, j) => j !== i))} className="ml-auto text-red-400 text-lg shrink-0">×</button>
                </div>
              ))}
              {buildQueue.length > 10 && <p className="text-[10px] text-gray-400">...and {buildQueue.length - 10} more</p>}
            </div>
          )}
          {isAdmin && <AdminModePanel routes={allRoutes} />}
          <div className="border-t border-gray-100 pt-2 max-h-60 overflow-y-auto">
            {allRoutes.map((item) => {
              const itemId = item.route_uuid;
              const inQueue = buildQueue.find(q => q.route_uuid === itemId);
              return (
                <button key={itemId || item.name} onClick={() => {
                  if (inQueue) { setBuildQueue(prev => prev.filter(q => q.route_uuid !== itemId)); }
                  else { setBuildQueue(prev => [...prev, item]); }
                }} className={`w-full text-left p-2 rounded-lg flex items-start gap-2 mb-0.5 text-xs ${inQueue ? "bg-purple-100" : "hover:bg-gray-50"}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 mt-0.5 ${inQueue ? "bg-purple-800 text-white" : "bg-gray-200 text-gray-500"}`}>{inQueue ? "✓" : "+"}</span>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: getModeColor(item.mode || "default") }} />
                  <span className="truncate text-gray-700 flex-1">{item.name}</span>
                  {!item.is_approved && (
                    <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full shrink-0 font-bold">
                      UNVERIFIED
                    </span>
                  )}
                  {!isAdmin && (
                    <button onClick={(e) => {
                      e.stopPropagation();
                      // Flag route for admin review
                      console.log("Flagged route:", item.route_uuid);
                    }} className="text-[8px] text-orange-500 hover:text-orange-600 font-bold shrink-0 ml-1">
                      🚩 Flag
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Route list (verified + unverified + reference tabs) */}
      {tab !== "build" && (
        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="text-center py-8 text-gray-400 text-xs">Loading routes…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">No routes found</div>
          ) : (
            <div className="p-2">
              <p className="text-[11px] text-gray-400 px-1 py-1.5">{filtered.length} route{filtered.length !== 1 ? "s" : ""} — click to view on map</p>
              {filtered.map((route) => {
                const id = route.route_uuid || route.id;
                const name = route.name || route.route_name || "Unknown";
                const mode = route.mode || route.agency || "";
                const active = (selected?.route_uuid || selected?.id) === id;
                const lastUpdated = route.updated_at || route.created_at;
                const needsUpdate = !lastUpdated || new Date(lastUpdated) < new Date(Date.now() - 90 * 86400000);
                const isMatched = tab === "reference" || tab === "unverified" ? route.is_matched : route.is_approved;
                return (
                  <button key={id || name} onClick={() => selectRoute(route)}
                    className="w-full text-left p-2.5 rounded-lg flex items-start gap-2 mb-0.5"
                    style={{ background: active ? "#f3f0ff" : "transparent" }}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 mt-0.5 ${
                      tab === "reference" || tab === "unverified"
                        ? (isMatched ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")
                        : "bg-green-100 text-green-700"
                    }`}>
                      {tab === "reference" && !route.geometry && !route.geom_geojson ? "📝" : (tab === "reference" || tab === "unverified" ? (isMatched ? "✓" : "✗") : "✓")}
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: getModeColor(route.mode || "default") }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold truncate text-gray-900">{name}</p>
                      {needsUpdate && <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">NEEDS UPDATE</span>}
                      {lastUpdated && <span className="text-[8px] text-gray-400 shrink-0">Updated: {new Date(lastUpdated).toLocaleDateString()}</span>}
                    </div>
                      {mode && <p className="text-[10px] text-gray-400 truncate capitalize">{mode}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="p-3 border-t border-gray-100 bg-gray-50 shrink-0">
        <Link to="/" className="flex items-center justify-center gap-2 py-2.5 bg-purple-800 text-white rounded-xl font-semibold text-[13px] no-underline">🚐 Commute</Link>
      </div>
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="fixed inset-0 flex z-40 bg-gray-100" style={{ top: "4.5rem" }}>
        {!isMobile && <aside className="w-80 shrink-0 h-full border-r border-gray-200 shadow-lg z-10">{sidebar}</aside>}
        {isMobile && mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-50" />}
        {isMobile && (
          <aside className={`fixed top-16 left-0 bottom-20 w-80 z-50 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
            {sidebar}
          </aside>
        )}
        <div className="flex-1 relative min-w-0">
          {isMobile && (
            <button onClick={() => setMobileOpen(true)} className="absolute top-4 left-4 z-30 bg-white rounded-2xl px-3.5 py-2 shadow-md font-semibold text-[13px] text-purple-800">☰ Routes</button>
          )}
          <button onClick={() => setShowWeather(true)} className="absolute top-16 right-4 z-40 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg hover:bg-gray-50 border border-gray-200">🌤️</button>
          <div ref={mapRef} className="absolute inset-0 z-0" />
          
          {/* Map Legend - Clickable */}
          <div className="absolute top-4 right-4 z-40 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2.5 border border-gray-100 max-w-[160px]">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold text-gray-700">Transit Modes</p>
              {activeMode && (
                <button onClick={() => setActiveMode(null)} className="text-[9px] text-purple-600 font-bold hover:underline">Show All</button>
              )}
            </div>
            <div className="space-y-1">
              <button onClick={() => setActiveMode(activeMode === "rail" ? null : "rail")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "rail" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("rail") }} />
                <span className="text-[10px] text-gray-600">Rail</span>
              </button>
              <button onClick={() => setActiveMode(activeMode === "jeepney" ? null : "jeepney")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "jeepney" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("jeepney") }} />
                <span className="text-[10px] text-gray-600">Jeepney</span>
              </button>
              <button onClick={() => setActiveMode(activeMode === "bus" ? null : "bus")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "bus" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("bus") }} />
                <span className="text-[10px] text-gray-600">Bus</span>
              </button>
              <button onClick={() => setActiveMode(activeMode === "uv_express" ? null : "uv_express")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "uv_express" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("uv_express") }} />
                <span className="text-[10px] text-gray-600">UV Express</span>
              </button>
            </div>
          </div>
          
          {loading && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
              <div className="bg-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-purple-100 border-t-purple-800 rounded-full animate-spin" />
                <p className="text-[13px] font-bold text-gray-900">Loading route…</p>
              </div>
            </div>
          )}
          {selected && !loading && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(90vw,400px)]">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-purple-800 to-purple-600 px-4 py-3 flex items-center gap-2.5">
                  <div className="flex-1">
                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                      {selected.mode || selected.agency || "transit"}
                    </span>
                  </div>
                  <button onClick={clearSelection} className="bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-white text-sm">✕</button>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-gray-900 truncate">{selected.name || selected.route_name}</h3>
                  <Link to={`/?route=${encodeURIComponent(selected?.name || selected?.route_name || "")}`} className="flex items-center justify-center gap-2 py-2.5 mt-3 bg-purple-800 text-white rounded-xl font-bold text-[13px] no-underline">
                🚐 Commute this Route
              </Link>
              <button onClick={() => {
                const routeName = selected?.name || selected?.route_name || "";
                setRecordingRoute({
                  name: routeName,
                  uuid: selected?.route_uuid || selected?.id || null,
                });
                setShowRecorder(true);
              }} className="w-full py-2 mt-1 bg-green-500 text-white rounded-lg text-[11px] font-bold">
                📍 I'm on this route — Track it
              </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showWeather && <WeatherPage onClose={() => setShowWeather(false)} />}
      <BottomNav />
      {showRecorder && recordingRoute && (
        <LiveRouteRecorder
          routeName={recordingRoute.name}
          routeUuid={recordingRoute.uuid}
          onComplete={() => { setShowRecorder(false); setRecordingRoute(null); }}
          onCancel={() => { setShowRecorder(false); setRecordingRoute(null); }}
        />
      )}
      <LandingPageFooter />
    </>
  );
}
