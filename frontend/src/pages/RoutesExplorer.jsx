import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getApiBaseUrl } from "../config/api";
import paralogo from "../assets/images/paralogo.png";

// Fix Leaflet default icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const METRO_MANILA_CENTER = [14.5995, 120.9842];
const API_BASE = getApiBaseUrl();

// ── Helpers ──────────────────────────────────────────────────
function parseRouteName(raw) {
  if (!raw) return { origin: "", destination: "", vias: [] };
  const name = raw.trim();
  const via = name.match(/^(.*?)\s*-\s*(.*?)\s+via\s+(.*)$/i);
  if (via) return { origin: via[1].trim(), destination: via[2].trim(), vias: via[3].split(/,\s*/).filter(Boolean) };
  const simple = name.match(/^(.*?)\s*-\s*(.*)$/);
  if (simple) return { origin: simple[1].trim(), destination: simple[2].trim(), vias: [] };
  return { origin: name, destination: "", vias: [] };
}

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── Main Component ───────────────────────────────────────────
export default function RoutesExplorer() {
  const isMobile = useIsMobile();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);

  const [allRoutes, setAllRoutes] = useState([]);
  const [verifiedRoutes, setVerifiedRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("verified");
  const [tabKey, setTabKey] = useState(0);

  // ── Init Map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
      .setView(METRO_MANILA_CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerGroup.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
  }, []);

  // ── Fetch Data ────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/admin/routes/verified`).then(r => r.json()).catch(() => ({ routes: [] })),
      fetch(`${API_BASE}/admin/routes/csv`).then(r => r.json()).catch(() => ({ routes: [] })),
    ]).then(([vData, aData]) => {
      setVerifiedRoutes(vData.routes || []);
      setAllRoutes(aData.routes || []);
      setFilteredRoutes(aData.routes || []);
    }).finally(() => setIsLoadingList(false));
  }, []);

  // ── Search ────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredRoutes(allRoutes); return; }
    const q = searchQuery.toLowerCase();
    setFilteredRoutes(allRoutes.filter(r =>
      (r.route_name || "").toLowerCase().includes(q) || (r.route_id || "").toLowerCase().includes(q)
    ));
  }, [searchQuery, allRoutes]);

  useEffect(() => { if (!isMobile && mobileOpen) setMobileOpen(false); }, [isMobile, mobileOpen]);

  // ── Clear Map ─────────────────────────────────────────────
  const clearMap = useCallback(() => {
    layerGroup.current?.clearLayers();
    setError(null);
  }, []);

  const resetMap = useCallback(() => {
    clearMap();
    setSelectedRoute(null);
    mapInstance.current?.setView(METRO_MANILA_CENTER, 12);
  }, [clearMap]);

  // ── Draw Route ────────────────────────────────────────────
  const drawRoute = useCallback(async (routeName) => {
    try {
      const res = await fetch(`${API_BASE}/admin/routes/geometry/${encodeURIComponent(routeName)}`);
      if (!res.ok) throw new Error("No geometry");
      const geo = await res.json();
      const coords = geo.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      layerGroup.current?.clearLayers();
      L.polyline(coords, { color: "#ec4899", weight: 4, opacity: 0.9 }).addTo(layerGroup.current);
      mapInstance.current?.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });
      return true;
    } catch {
      return false;
    }
  }, []);

  const geocodeAndMark = useCallback(async (route) => {
    const p = parseRouteName(route.route_name || route.name);
    const places = [p.origin, p.destination].filter(Boolean);
    layerGroup.current?.clearLayers();
    const bounds = L.latLngBounds([]);

    for (let i = 0; i < places.length; i++) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(places[i])},%20Metro%20Manila&limit=1`
        );
        const data = await res.json();
        if (data[0]) {
          const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          const color = i === 0 ? "#22c55e" : "#ec4899";
          L.circleMarker(latlng, { radius: 9, fillColor: color, color: "#fff", weight: 2, fillOpacity: 1 })
            .addTo(layerGroup.current)
            .bindTooltip(i === 0 ? `A: ${places[i]}` : `B: ${places[i]}`, { direction: "top" });
          bounds.extend(latlng);
        }
      } catch {}
    }
    if (bounds.isValid()) mapInstance.current?.fitBounds(bounds, { padding: [60, 60] });
  }, []);

  // ── Handle Selection ──────────────────────────────────────
  const selectVerified = useCallback(async (item) => {
    if (selectedRoute?.data?.key === item.key) return;
    setIsLoading(true);
    setSelectedRoute({ type: "verified", data: item });
    setMobileOpen(false);
    const ok = await drawRoute(item.key);
    if (!ok) {
      await geocodeAndMark(item);
      setError("Approximate location shown (no GPS path available)");
    }
    setIsLoading(false);
  }, [selectedRoute, drawRoute, geocodeAndMark]);

  const selectCSV = useCallback(async (route) => {
    if (selectedRoute?.data?.route_id === route.route_id && selectedRoute?.type === "csv") return;
    setIsLoading(true);
    setSelectedRoute({ type: "csv", data: route });
    setMobileOpen(false);
    // Try matching verified route first
    const match = verifiedRoutes.find(v => {
      const vp = parseRouteName(v.name);
      const rp = parseRouteName(route.route_name);
      return vp.origin && rp.origin && vp.origin.toLowerCase().includes(rp.origin.toLowerCase());
    });
    if (match) {
      const ok = await drawRoute(match.key);
      if (ok) { setIsLoading(false); return; }
    }
    await geocodeAndMark(route);
    setError("Approximate location (route geometry not yet mapped)");
    setIsLoading(false);
  }, [selectedRoute, verifiedRoutes, drawRoute, geocodeAndMark]);

  const switchTab = (t) => { setActiveTab(t); setTabKey(k => k + 1); };

  // ── Card Data ─────────────────────────────────────────────
  const card = selectedRoute ? (() => {
    if (selectedRoute.type === "verified") {
      const it = selectedRoute.data;
      const p = parseRouteName(it.name);
      return { title: it.name, subtitle: `${it.edge_count || "?"} segments · GPS Verified`, origin: p.origin || it.name, destination: p.destination, isGeo: true };
    }
    const r = selectedRoute.data;
    const p = parseRouteName(r.route_name);
    return { title: r.route_name, subtitle: `${r.agency || "Transit"} · Route ${r.route_id?.replace("ROUTE_","") || "?"}`, origin: p.origin || r.route_name, destination: p.destination, isGeo: false };
  })() : null;

  // ── Sidebar ───────────────────────────────────────────────
  const sidebar = (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <img src={paralogo} alt="PARAPH" className="h-8 w-8" />
          <span className="font-bold text-sm text-gray-900">PARAPH</span>
        </Link>
      </div>

      {/* Banner */}
      <div className="px-4 py-3.5 shrink-0 bg-gradient-to-r from-pink-500 to-rose-500">
        <p className="text-sm font-bold text-white mb-0.5">🚐 Transit Routes</p>
        <p className="text-[11px] text-pink-100">Metro Manila, Philippines</p>
        <div className="flex gap-2 mt-2">
          <div className="flex-1 bg-white/15 rounded-lg py-1.5 px-2.5 text-center">
            <div className="text-[15px] font-extrabold text-white">{allRoutes.length}</div>
            <div className="text-[10px] text-pink-100">Total Routes</div>
          </div>
          <div className="flex-1 bg-white/15 rounded-lg py-1.5 px-2.5 text-center">
            <div className="text-[15px] font-extrabold text-white">{verifiedRoutes.length}</div>
            <div className="text-[10px] text-pink-100">GPS Verified</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {[["verified", "✓ Verified"], ["all", "All Routes"]].map(([id, label]) => (
          <button key={id} onClick={() => switchTab(id)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === id ? "text-pink-500 border-pink-500" : "text-gray-400 border-transparent hover:text-gray-500"
            }`}>{label}</button>
        ))}
      </div>

      {/* Search */}
      {activeTab === "all" && (
        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search route name..."
              className="w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition-all" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-200 rounded-full w-4.5 h-4.5 flex items-center justify-center">
                <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div key={tabKey} className="animate-fadeIn min-h-full">
          {activeTab === "verified" ? (
            <div className="p-2">
              <p className="text-[11px] text-gray-400 px-1 py-1.5">{verifiedRoutes.length} GPS-traced paths</p>
              {verifiedRoutes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">No verified routes loaded.</div>
              ) : (
                verifiedRoutes.map((item, i) => {
                  const active = selectedRoute?.data?.key === item.key;
                  const p = parseRouteName(item.name);
                  return (
                    <button key={item.key} onClick={() => selectVerified(item)}
                      className={`w-full text-left p-2.5 rounded-lg flex items-start gap-2 transition-all duration-150 mb-0.5 animate-slideUp`}
                      style={{ animationDelay: `${i * 0.02}s`, background: active ? "#fdf2f8" : "transparent", outline: active ? "1px solid #f9a8d4" : "none" }}>
                      <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 mt-0.5 ${active ? "bg-pink-500 text-white" : "bg-green-100 text-green-700"}`}>✓</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${active ? "text-pink-800" : "text-gray-900"}`}>{p.origin || item.name}</p>
                        {p.destination && <p className={`text-[10px] truncate ${active ? "text-pink-400" : "text-gray-400"}`}>→ {p.destination}</p>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-2">
              {isLoadingList ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg">
                      <div className="shimmer w-8 h-5 rounded shrink-0" />
                      <div className="flex-1"><div className="shimmer h-2.5 rounded-full w-3/5 mb-1.5" /><div className="shimmer h-2 rounded-full w-2/5" /></div>
                    </div>
                  ))}
                </div>
              ) : filteredRoutes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">No routes found.</div>
              ) : (
                filteredRoutes.map((route, i) => {
                  const active = selectedRoute?.type === "csv" && selectedRoute?.data?.route_id === route.route_id;
                  const p = parseRouteName(route.route_name);
                  const hasGeo = verifiedRoutes.some(v => v.name.toLowerCase().includes(p.origin.toLowerCase()));
                  return (
                    <button key={route.route_id || i} onClick={() => selectCSV(route)}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2 transition-all duration-150 mb-0.5 animate-slideUp`}
                      style={{ animationDelay: `${i * 0.01}s`, background: active ? "#fdf2f8" : "transparent", outline: active ? "1px solid #f9a8d4" : "none" }}>
                      <span className={`shrink-0 min-w-[34px] text-center text-[10px] font-bold py-0.5 px-1 rounded ${active ? "bg-pink-500 text-white" : "bg-gray-100 text-gray-500"}`}>{route.route_id?.replace("ROUTE_", "") || "?"}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${active ? "text-pink-800" : "text-gray-900"}`}>{p.origin || route.route_name}</p>
                        {p.destination && <p className={`text-[10px] truncate ${active ? "text-pink-400" : "text-gray-400"}`}>→ {p.destination}</p>}
                      </div>
                      {hasGeo && <span className="shrink-0 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">MAP</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 shrink-0">
        <Link to="/map" className="flex items-center justify-center gap-2 py-2.5 bg-pink-500 text-white rounded-xl font-semibold text-[13px] no-underline hover:bg-pink-600 hover:-translate-y-px hover:shadow-lg hover:shadow-pink-500/25 transition-all active:translate-y-0">
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
          Plan a Trip
        </Link>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex z-50 bg-gray-100">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-80 shrink-0 h-full border-r border-gray-200 shadow-lg animate-slideInLeft">
          {sidebar}
        </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-60 animate-fadeIn" />}

      {/* Mobile drawer */}
      {isMobile && (
        <aside className={`fixed top-0 left-0 bottom-0 w-80 z-70 transition-transform duration-300 ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
          <div className="relative h-full">
            <button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 z-10 bg-gray-100 rounded-lg w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-200">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {sidebar}
          </div>
        </aside>
      )}

      {/* Map Area */}
      <div className="flex-1 relative min-w-0">
        {isMobile && (
          <button onClick={() => setMobileOpen(true)} className="absolute top-4 left-4 z-10 bg-white border border-gray-100 rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-md font-semibold text-[13px] hover:scale-105 transition-transform">
            <svg width="16" height="16" fill="none" stroke="#ec4899" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span className="text-pink-500">Routes</span>
          </button>
        )}

        <Link to="/" className="absolute top-4 right-4 z-10 bg-white border border-gray-100 rounded-2xl px-3.5 py-2 flex items-center gap-1.5 shadow-md text-gray-700 font-medium text-[13px] no-underline hover:scale-105 transition-transform">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Home
        </Link>

        <div ref={mapRef} className="absolute inset-0" />

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-floatUp">
            <div className="bg-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-3">
              <div className="spinner w-5 h-5" />
              <div><p className="text-[13px] font-bold text-gray-900 m-0">Loading route…</p><p className="text-[11px] text-gray-400 m-0">Drawing on map</p></div>
            </div>
          </div>
        )}

        {/* Route info card */}
        {selectedRoute && !isLoading && card && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[min(90vw,400px)] animate-floatUp">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 flex items-center gap-2.5">
                <div className="flex-1 flex gap-1.5 flex-wrap">
                  {card.subtitle && <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{card.subtitle}</span>}
                </div>
                <button onClick={resetMap} className="bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-white hover:bg-white/30">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4">
                {error && <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-2 mb-3">⚠ {error}</p>}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-200" />
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-green-300 to-pink-300 my-1 min-h-[20px]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-pink-200" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide m-0">From</p><p className="text-[13px] font-extrabold text-gray-900 m-0 truncate">{card.origin}</p></div>
                    {card.destination && <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide m-0">To</p><p className="text-[13px] font-extrabold text-gray-900 m-0 truncate">{card.destination}</p></div>}
                  </div>
                </div>
                <Link to="/map" className="flex items-center justify-center gap-2 py-2.5 mt-3 bg-pink-500 text-white rounded-xl font-bold text-[13px] no-underline hover:bg-pink-600 transition-colors">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  Plan a Trip
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Styles */}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes floatUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes slideInLeft{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{from{background-position:-300px 0}to{background-position:300px 0}}
        .animate-fadeIn{animation:fadeIn .25s ease-out}
        .animate-floatUp{animation:floatUp .35s cubic-bezier(0.16,1,0.3,1)}
        .animate-slideInLeft{animation:slideInLeft .3s cubic-bezier(0.16,1,0.3,1)}
        .animate-slideUp{opacity:0;animation:slideUp .25s ease-out forwards}
        .spinner{border:3px solid #fce7f3;border-top-color:#ec4899;border-radius:50%;animation:spin .7s linear infinite}
        .shimmer{background:linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%);background-size:600px 100%;animation:shimmer 1.4s ease-in-out infinite}
      `}</style>
    </div>
  );
}