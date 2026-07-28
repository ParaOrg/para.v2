import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getGoogleMapsApiKey } from "../config/googleMaps";
import { useGoogleMaps } from "../hooks/useGoogleMaps";
import { getApiBaseUrl } from "../config/api";
import paralogo from "../assets/images/paralogo.png";

const METRO_MANILA_CENTER = { lat: 14.5995, lng: 120.9842 };
const API_BASE = getApiBaseUrl();

const MAP_STYLES = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];

function parseRouteName(raw) {
  if (!raw) return { origin: "", destination: "", vias: [] };
  const name = raw.trim();
  const via = name.match(/^(.*?)\s*-\s*(.*?)\s+via\s+(.*)$/i);
  if (via) return { origin: via[1].trim(), destination: via[2].trim(), vias: via[3].split(/,\s*/).map((v) => v.trim()).filter(Boolean) };
  const simple = name.match(/^(.*?)\s*-\s*(.*)$/);
  if (simple) return { origin: simple[1].trim(), destination: simple[2].trim(), vias: [] };
  return { origin: name, destination: "", vias: [] };
}

function cleanPlace(raw) {
  return (raw || "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}

// Breakpoint matching the "md" breakpoint (768px)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function RoutesExplorer() {
  const apiKey = getGoogleMapsApiKey();
  const { loaded, error: mapError } = useGoogleMaps(apiKey);
  const isMobile = useIsMobile();

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const directionsRenderer = useRef(null);
  const polylineRef = useRef(null);
  const markersRef = useRef([]);
  const manifestRef = useRef(null);
  const [google, setGoogle] = useState(null);

  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasGeometry, setHasGeometry] = useState(false);
  const [activeTab, setActiveTab] = useState("verified");
  const [tabKey, setTabKey] = useState(0); // forces re-animation on tab switch

  // ── Map init ────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const g = window.google;
    setGoogle(g);
    if (!mapInstance.current) {
      mapInstance.current = new g.maps.Map(mapRef.current, {
        zoom: 12, center: METRO_MANILA_CENTER,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        styles: MAP_STYLES,
      });
    }
    directionsRenderer.current = new g.maps.DirectionsRenderer({
      polylineOptions: { strokeColor: "#ec4899", strokeWeight: 5, strokeOpacity: 0.9 },
    });
  }, [loaded]);

  // ── Fetch route list + manifest ────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/jeepney-routes`)
      .then((r) => r.json())
      .then((data) => { setRoutes(data); setFilteredRoutes(data); })
      .catch(console.error)
      .finally(() => setIsLoadingList(false));

    fetch(`${API_BASE}/api/v1/jeepney-routes/manifest`)
      .then((r) => r.json())
      .then((data) => { manifestRef.current = data; })
      .catch(() => {});
  }, []);

  // ── Search filter ───────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredRoutes(routes); return; }
    const q = searchQuery.toLowerCase();
    setFilteredRoutes(routes.filter((r) =>
      (r.Route_Name ?? "").toLowerCase().includes(q) || String(r.Route_No).includes(q)
    ));
  }, [searchQuery, routes]);

  // Close mobile drawer on desktop resize
  useEffect(() => {
    if (!isMobile && mobileOpen) setMobileOpen(false);
  }, [isMobile, mobileOpen]);

  // ── Clear helpers ───────────────────────────────────────────
  const clearPolyline = useCallback(() => {
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  const clearAll = useCallback(() => {
    clearPolyline();
    clearMarkers();
    if (directionsRenderer.current) directionsRenderer.current.setMap(null);
    setHasGeometry(false);
    setRouteError(null);
  }, [clearPolyline, clearMarkers]);

  const resetMap = useCallback(() => {
    clearAll();
    setSelectedRoute(null);
    if (mapInstance.current) { mapInstance.current.setCenter(METRO_MANILA_CENTER); mapInstance.current.setZoom(12); }
  }, [clearAll]);

  // ── Draw real geometry ──────────────────────────────────────
  const drawGeometry = useCallback((key) => {
    return fetch(`${API_BASE}/api/v1/jeepney-routes/${key}/geometry`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((feature) => {
        const rawCoords = feature.geometry.type === "MultiLineString"
          ? feature.geometry.coordinates.flat()
          : feature.geometry.coordinates;
        const path = rawCoords.map(([lng, lat]) => ({ lat, lng }));
        polylineRef.current = new google.maps.Polyline({
          path, map: mapInstance.current,
          strokeColor: "#ec4899", strokeWeight: 5, strokeOpacity: 0.95,
          zIndex: 10,
        });
        const bounds = new google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        mapInstance.current.fitBounds(bounds, { top: 60, bottom: 220, left: 40, right: 40 });
        setHasGeometry(true);
        setIsLoadingRoute(false);
        return true;
      });
  }, [google]);

  // ── Geocoder fallback ───────────────────────────────────────
  const fallbackGeocode = useCallback((route) => {
    const p = parseRouteName(route.Route_Name);
    const origin = p.origin || route.Route_Name;
    const dest = p.destination || route.Route_Name;

    new google.maps.DirectionsService().route(
      {
        origin: `${cleanPlace(origin)}, Metro Manila, Philippines`,
        destination: `${cleanPlace(dest)}, Metro Manila, Philippines`,
        waypoints: p.vias.slice(0, 8).map((v) => ({ location: `${cleanPlace(v)}, Metro Manila, Philippines`, stopover: false })),
        travelMode: google.maps.TravelMode.DRIVING,
        region: "PH",
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.current.setMap(mapInstance.current);
          directionsRenderer.current.setDirections(result);
          if (result.routes[0]?.bounds)
            mapInstance.current.fitBounds(result.routes[0].bounds, { top: 60, bottom: 220, left: 20, right: 20 });
          setHasGeometry(false);
          setIsLoadingRoute(false);
        } else {
          const geocoder = new google.maps.Geocoder();
          const places = [origin, dest].filter(Boolean);
          const bounds = new google.maps.LatLngBounds();
          let resolved = 0;
          places.forEach((place, i) => {
            geocoder.geocode({ address: `${cleanPlace(place)}, Metro Manila, Philippines`, region: "PH" }, (res, st) => {
              resolved++;
              if (st === "OK" && res[0]) {
                const loc = res[0].geometry.location;
                bounds.extend(loc);
                const marker = new google.maps.Marker({
                  position: loc, map: mapInstance.current,
                  icon: { path: google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: "#ec4899", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
                  label: { text: i === 0 ? "A" : "B", color: "#fff", fontWeight: "bold", fontSize: "11px" },
                  title: place,
                });
                markersRef.current.push(marker);
              }
              if (resolved === places.length) {
                if (!bounds.isEmpty()) mapInstance.current.fitBounds(bounds, { top: 60, bottom: 220, left: 80, right: 80 });
                setIsLoadingRoute(false);
              }
            });
          });
        }
      }
    );
  }, [google]);

  // ── Route selection ─────────────────────────────────────────
  const handleSelectVerified = useCallback((item) => {
    if (!google || !mapInstance.current) return;
    if (selectedRoute?.data?.key === item.key) return;
    clearAll();
    setSelectedRoute({ type: "verified", data: item });
    setIsLoadingRoute(true);
    setMobileOpen(false);
    drawGeometry(item.key).catch(() => {
      setIsLoadingRoute(false);
      setRouteError("Could not load path geometry.");
    });
  }, [google, selectedRoute, clearAll, drawGeometry]);

  const handleSelectMain = useCallback((route) => {
    if (!google || !mapInstance.current) return;
    if (selectedRoute?.data?.Route_No === route.Route_No && selectedRoute?.type === "main") return;
    clearAll();
    setSelectedRoute({ type: "main", data: route });
    setIsLoadingRoute(true);
    setMobileOpen(false);

    const byRouteNo = manifestRef.current?.byRouteNo || {};
    const geoKey = byRouteNo[route.Route_No];

    if (geoKey) {
      drawGeometry(geoKey).catch(() => fallbackGeocode(route));
    } else {
      fallbackGeocode(route);
    }
  }, [google, selectedRoute, clearAll, drawGeometry, fallbackGeocode]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setTabKey((k) => k + 1);
  };

  // ── Data ────────────────────────────────────────────────────
  const verifiedList = manifestRef.current?.verified || [];
  const byRouteNo = manifestRef.current?.byRouteNo || {};

  // ── Sidebar content ─────────────────────────────────────────
  const sidebarInner = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <img src={paralogo} alt="PARAPH" style={{ height: 32, width: 32 }} />
          <span style={{ fontWeight: 700, color: "#111", fontSize: 14 }}>PARAPH</span>
        </Link>
      </div>

      {/* Banner */}
      <div style={{ padding: "14px 16px", background: "linear-gradient(135deg,#ec4899,#f43f5e)", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>🚐 Jeepney Routes</div>
        <div style={{ fontSize: 11, color: "#fce7f3" }}>Metro Manila, Philippines</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "5px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{routes.length}</div>
            <div style={{ fontSize: 10, color: "#fce7f3" }}>Total Routes</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "5px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{verifiedList.length}</div>
            <div style={{ fontSize: 10, color: "#fce7f3" }}>Verified Paths</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
        {[["verified", "✓ Verified"], ["all", "All Routes"]].map(([id, label]) => (
          <button key={id} onClick={() => handleTabChange(id)}
            className={`route-tab${activeTab === id ? " route-tab--active" : ""}`}
            style={{ flex: 1, padding: "9px 4px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: "transparent", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Search (All tab only) */}
      {activeTab === "all" && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }}
              width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search route name or number…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: searchQuery ? 28 : 10, paddingTop: 8, paddingBottom: 8, fontSize: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, outline: "none", boxSizing: "border-box", color: "#111", fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s" }}
              onFocus={(e) => { e.target.style.borderColor = "#f9a8d4"; e.target.style.boxShadow = "0 0 0 3px rgba(236,72,153,0.12)"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "#e5e7eb", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", transition: "background 0.15s" }}>
                <svg width={9} height={9} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div key={tabKey} className="tab-content-enter" style={{ minHeight: "100%" }}>
          {activeTab === "verified" ? (
            <div style={{ padding: "6px 8px" }}>
              <p style={{ fontSize: 11, color: "#9ca3af", padding: "6px 4px 8px", margin: 0 }}>
                {verifiedList.length} GPS-traced paths from field mapping
              </p>
              {verifiedList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#9ca3af", fontSize: 12 }}>
                  Loading verified paths…
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {verifiedList.map((item, idx) => {
                    const active = selectedRoute?.data?.key === item.key;
                    return (
                      <li key={item.key}
                        className="route-list-item"
                        style={{ animationDelay: `${Math.min(idx * 0.035, 0.6)}s` }}>
                        <button onClick={() => handleSelectVerified(item)}
                          style={{
                            width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9, cursor: "pointer", border: "none",
                            display: "flex", alignItems: "flex-start", gap: 8,
                            background: active ? "#fdf2f8" : "transparent",
                            outline: active ? "1px solid #f9a8d4" : "none",
                            fontFamily: "inherit", transition: "background 0.15s, outline 0.15s, transform 0.12s",
                            transform: "scale(1)",
                          }}
                          onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#fafafa"; e.currentTarget.style.transform = "scale(1.01)"; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = active ? "#fdf2f8" : "transparent"; e.currentTarget.style.transform = "scale(1)"; }}>
                          <span className={active ? "check-active" : "check-idle"}
                            style={{
                              flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: active ? "#ec4899" : "#dcfce7",
                              color: active ? "#fff" : "#15803d",
                              fontSize: 9, fontWeight: 800,
                              transition: "background 0.2s",
                            }}>✓</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: active ? "#be185d" : "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>{item.name}</p>
                            {item.notes && <p style={{ margin: "1px 0 0", fontSize: 10, color: active ? "#f472b6" : "#9ca3af", transition: "color 0.15s" }}>{item.notes}</p>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div style={{ padding: "6px 8px" }}>
              {isLoadingList ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "4px 0" }}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9 }}>
                      <div className="shimmer" style={{ width: 32, height: 20, borderRadius: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="shimmer" style={{ height: 10, borderRadius: 99, width: `${55 + (i % 4) * 11}%`, marginBottom: 5 }} />
                        <div className="shimmer" style={{ height: 8, borderRadius: 99, width: `${35 + (i % 3) * 12}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRoutes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#9ca3af", fontSize: 12 }}>No routes match your search.</div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {filteredRoutes.map((route, idx) => {
                    const active = selectedRoute?.type === "main" && selectedRoute?.data?.Route_No === route.Route_No;
                    const hasGeo = byRouteNo[route.Route_No];
                    const p = parseRouteName(route.Route_Name);
                    return (
                      <li key={route.Route_No}
                        className="route-list-item"
                        style={{ animationDelay: `${Math.min(idx * 0.015, 0.4)}s` }}>
                        <button onClick={() => handleSelectMain(route)}
                          style={{
                            width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9, cursor: "pointer", border: "none",
                            display: "flex", alignItems: "center", gap: 8,
                            background: active ? "#fdf2f8" : "transparent",
                            outline: active ? "1px solid #f9a8d4" : "none",
                            fontFamily: "inherit", transition: "background 0.15s, outline 0.15s, transform 0.12s",
                            transform: "scale(1)",
                          }}
                          onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#fafafa"; e.currentTarget.style.transform = "scale(1.01)"; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = active ? "#fdf2f8" : "transparent"; e.currentTarget.style.transform = "scale(1)"; }}>
                          <span style={{
                            flexShrink: 0, minWidth: 34, textAlign: "center", fontSize: 10, fontWeight: 700, padding: "2px 4px", borderRadius: 5,
                            background: active ? "#ec4899" : "#f3f4f6",
                            color: active ? "#fff" : "#6b7280",
                            transition: "background 0.2s, color 0.2s",
                          }}>{route.Route_No}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: active ? "#be185d" : "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>
                              {p.origin || (route.Route_Name ?? "").trim() || `Route ${route.Route_No}`}
                            </p>
                            {p.destination && <p style={{ margin: "1px 0 0", fontSize: 10, color: active ? "#f472b6" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>→ {p.destination}</p>}
                          </div>
                          {hasGeo && <span className="map-badge">MAP</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #f3f4f6", background: "#fafafa", flexShrink: 0 }}>
        <Link to="/map"
          className="cta-button"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", background: "#ec4899", color: "#fff", borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: "none", transition: "transform 0.15s, box-shadow 0.15s" }}>
          <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Open Route Planner
        </Link>
      </div>
    </div>
  );

  // ── Route info card data ────────────────────────────────────
  const cardData = selectedRoute ? (() => {
    if (selectedRoute.type === "verified") {
      const item = selectedRoute.data;
      const p = parseRouteName(item.name);
      return { title: item.name, subtitle: item.notes || "Verified PARAPH path", origin: p.origin || item.name, destination: p.destination, vias: p.vias };
    }
    const r = selectedRoute.data;
    const p = parseRouteName(r.Route_Name);
    return { title: r.Route_Name, subtitle: `Route ${r.Route_No} · Jeepney`, origin: p.origin || r.Route_Name, destination: p.destination, vias: p.vias, badge: r.Route_No };
  })() : null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", zIndex: 50, background: "#f3f4f6" }}>

      {/* Desktop sidebar — only renders when not mobile */}
      {!isMobile && (
        <aside className="sidebar-enter" style={{ width: 320, flexShrink: 0, height: "100%", borderRight: "1px solid #e5e7eb", boxShadow: "1px 0 8px rgba(0,0,0,0.07)" }}>
          {sidebarInner}
        </aside>
      )}

      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 60, animation: "fadeIn 0.2s ease-out" }} />
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <aside style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: 320, zIndex: 70,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.32s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: mobileOpen ? "4px 0 32px rgba(0,0,0,0.18)" : "none",
        }}>
          <div style={{ position: "relative", height: "100%" }}>
            <button onClick={() => setMobileOpen(false)}
              style={{ position: "absolute", top: 12, right: 12, zIndex: 10, background: "#f3f4f6", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e7eb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}>
              <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {sidebarInner}
          </div>
        </aside>
      )}

      {/* Map area */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>

        {/* Mobile open button — only shown on mobile */}
        {isMobile && (
          <button onClick={() => setMobileOpen(true)}
            style={{ position: "absolute", top: 16, left: 16, zIndex: 10, background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", fontFamily: "inherit", fontWeight: 600, fontSize: 13, transition: "transform 0.12s, box-shadow 0.12s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}>
            <svg width={16} height={16} fill="none" stroke="#ec4899" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span style={{ color: "#ec4899" }}>Routes</span>
          </button>
        )}

        {/* Home button */}
        <Link to="/"
          style={{ position: "absolute", top: 16, right: 16, zIndex: 10, background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", color: "#374151", fontSize: 13, fontWeight: 500, transition: "transform 0.12s, box-shadow 0.12s" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"; }}>
          <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Home
        </Link>

        {/* Map canvas */}
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Map loading */}
        {!loaded && !mapError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ textAlign: "center" }}>
              <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Loading map…</p>
            </div>
          </div>
        )}

        {mapError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", padding: 24 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "#111", marginBottom: 4 }}>Map could not load</p>
              <p style={{ fontSize: 13, color: "#9ca3af" }}>Check your Google Maps API key.</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedRoute && !isLoadingRoute && loaded && !mapError && (
          <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none", width: 300, animation: "floatUp 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: "20px 24px", textAlign: "center", border: "1px solid rgba(255,255,255,0.6)" }}>
              <div style={{ width: 40, height: 40, background: "#fdf2f8", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", animation: "gentlePulse 3s ease-in-out infinite" }}>
                <svg width={20} height={20} fill="none" stroke="#ec4899" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Select a jeepney route</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>
                Use the <strong style={{ color: "#15803d" }}>Verified</strong> tab for GPS-traced paths,<br />or browse all routes
              </p>
            </div>
          </div>
        )}

        {/* Plotting loader */}
        {isLoadingRoute && (
          <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 10, animation: "floatUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,255,255,0.6)" }}>
              <div className="spinner" style={{ width: 20, height: 20, flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111" }}>Loading route…</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Drawing path on map</p>
              </div>
            </div>
          </div>
        )}

        {/* Route info card */}
        {selectedRoute && !isLoadingRoute && cardData && (
          <div key={selectedRoute.data?.key ?? selectedRoute.data?.Route_No}
            style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 10, width: "min(90vw, 420px)", animation: "floatUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.15)", overflow: "hidden", border: "1px solid #f3f4f6" }}>
              <div style={{ background: "linear-gradient(90deg,#ec4899,#f43f5e)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {cardData.badge != null && (
                    <span style={{ background: "#fff", color: "#ec4899", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>Route {cardData.badge}</span>
                  )}
                  {(hasGeometry || selectedRoute.type === "verified") ? (
                    <span style={{ background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>✓ GPS Verified</span>
                  ) : (
                    <span style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)", fontSize: 10, padding: "2px 8px", borderRadius: 99 }}>Approximate route</span>
                  )}
                </div>
                <button onClick={resetMap}
                  style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.35)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}>
                  <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ padding: 16 }}>
                {routeError && (
                  <p style={{ margin: "0 0 10px", fontSize: 11, color: "#f59e0b", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 10px", lineHeight: 1.4 }}>
                    ⚠ {routeError}
                  </p>
                )}
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", outline: "2px solid #bbf7d0" }} />
                    <div style={{ width: 2, flex: 1, background: "linear-gradient(to bottom,#86efac,#f9a8d4)", margin: "4px 0", minHeight: 24 }} />
                    {cardData.vias.length > 0 && (
                      <>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", outline: "2px solid #fde68a" }} />
                        <div style={{ width: 2, flex: 1, background: "linear-gradient(to bottom,#fcd34d,#f9a8d4)", margin: "4px 0", minHeight: 16 }} />
                      </>
                    )}
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ec4899", outline: "2px solid #fbcfe8" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <p style={{ margin: "0 0 1px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>From</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cardData.origin}</p>
                    </div>
                    {cardData.vias.length > 0 && (
                      <div>
                        <p style={{ margin: "0 0 1px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Via</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cardData.vias.join(" · ")}</p>
                      </div>
                    )}
                    {cardData.destination && (
                      <div>
                        <p style={{ margin: "0 0 1px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>To</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cardData.destination}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Link to="/map"
                  className="cta-button"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", background: "#ec4899", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none", transition: "transform 0.15s, box-shadow 0.15s" }}>
                  <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Plan a Trip on This Route
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* ── Keyframes ── */
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes floatUp  { from { opacity: 0; transform: translateX(-50%) translateY(18px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes routeItem { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmerMove { from { background-position: -300px 0; } to { background-position: 300px 0; } }
        @keyframes gentlePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes tabFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes badgePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(21,128,61,0.25); } 50% { box-shadow: 0 0 0 4px rgba(21,128,61,0); } }

        /* ── Components ── */
        .sidebar-enter   { animation: slideInLeft 0.38s cubic-bezier(0.16,1,0.3,1); }
        .tab-content-enter { animation: tabFade 0.22s ease-out; }

        .route-list-item {
          opacity: 0;
          animation: routeItem 0.28s ease-out forwards;
        }

        .shimmer {
          background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%);
          background-size: 600px 100%;
          animation: shimmerMove 1.4s ease-in-out infinite;
        }

        .spinner {
          border: 3px solid #fce7f3;
          border-top-color: #ec4899;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }

        .map-badge {
          flex-shrink: 0;
          font-size: 9px;
          background: #dcfce7;
          color: #15803d;
          padding: 2px 6px;
          border-radius: 99px;
          font-weight: 700;
          animation: badgePulse 2.5s ease-in-out infinite;
        }

        .route-tab {
          color: #9ca3af;
          border-bottom: 2px solid transparent;
          transition: color 0.18s, border-color 0.18s;
        }
        .route-tab--active {
          color: #ec4899;
          border-bottom: 2px solid #ec4899;
        }
        .route-tab:hover:not(.route-tab--active) {
          color: #6b7280;
        }

        .cta-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(236,72,153,0.35);
        }
        .cta-button:active {
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .sidebar-enter, .tab-content-enter, .route-list-item,
          .shimmer, .spinner, .map-badge, .gentlePulse { animation: none !important; }
          * { transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
