import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import AdminApproval from "./AdminApproval";
import "leaflet/dist/leaflet.css";

const API = "";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MANILA_CENTER = [14.5995, 120.9842];

const ARROW_CFG = {
  jeep: { char: "\u279B", size: 18 },
  jeepney: { char: "\u279B", size: 18 },
  bus: { char: "\u279D", size: 20 },
  train: { char: "\u21D2", size: 22 },
  lrt: { char: "\u21D2", size: 22 },
  mrt: { char: "\u21D2", size: 22 },
  uv: { char: "\u279D", size: 18 },
  default: { char: "\u279B", size: 18 },
};

export default function AdminDashboard() {
  const [routes, setRoutes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const routeLayerGroup = useRef(null);
  const mapInitDone = useRef(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [routesRes, statsRes] = await Promise.all([
        fetch(`${API}/admin/routes/list`),
        fetch(`${API}/admin/routes/stats`),
      ]);
      const routesData = await routesRes.json();
      const statsData = statsRes.ok ? await statsRes.json() : {};
      setRoutes(routesData.routes || []);
      setStats(statsData || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Initialize map - wait for DOM to be ready
  useEffect(() => {
    if (mapInitDone.current) return;

    const initMap = () => {
      const el = document.getElementById("admin-osm-map");
      if (!el || el.offsetHeight === 0) {
        // DOM not ready yet, retry
        setTimeout(initMap, 200);
        return;
      }

      console.log("🗺️ Creating map, container size:", el.offsetWidth, "x", el.offsetHeight);

      const map = L.map(el, {
        zoomControl: true,
        attributionControl: true,
      }).setView(MANILA_CENTER, 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      mapInstance.current = map;
      mapInitDone.current = true;
      console.log("✅ Admin OSM map ready");

      // Fix tile loading issue
      setTimeout(() => map.invalidateSize(), 500);
    };

    const timer = setTimeout(initMap, 300);
    return () => {
      clearTimeout(timer);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        mapInitDone.current = false;
      }
    };
  }, []);

  const inspectRoute = async (route) => {
    setSelectedRoute(route);

    try {
      const res = await fetch(`${API}/admin/routes/geojson`);
      const data = await res.json();

      const feature = data.features?.find(
        (f) =>
          f.properties?.route_long_name === route.name ||
          f.properties?.name === route.name
      );

      const map = mapInstance.current;
      if (!map) {
        console.error("❌ Map not initialized");
        return;
      }

      // Clear previous
      if (routeLayerGroup.current) {
        map.removeLayer(routeLayerGroup.current);
      }
      routeLayerGroup.current = L.layerGroup().addTo(map);

      if (!feature) {
        L.marker(MANILA_CENTER)
          .addTo(routeLayerGroup.current)
          .bindPopup(`<b>${route.name}</b><br>No geometry found`)
          .openPopup();
        return;
      }

      const mode = (route.mode || "jeep").toLowerCase();
      const arrowCfg = ARROW_CFG[mode] || ARROW_CFG.default;

      const geom = feature.geometry;
      let allCoords = geom.type === "MultiLineString"
        ? geom.coordinates
        : [geom.coordinates];

      const bounds = L.latLngBounds([]);
      let totalArrows = 0;

      allCoords.forEach((lineCoords, lineIdx) => {
        const pts = lineCoords.map(([lng, lat]) => [lat, lng]);
        if (pts.length < 2) return;

        const color = lineIdx === 0 ? "#310775" : "#7c3aed";

        L.polyline(pts, {
          color,
          weight: 5,
          opacity: 0.85,
          dashArray: lineIdx > 0 ? "10, 5" : null,
        })
          .addTo(routeLayerGroup.current)
          .bindPopup(
            `<b>${route.name}</b><br>Mode: ${mode}<br>1-way: ${route.oneway ? "Yes" : "No"} | Loop: ${route.loop ? "Yes" : "No"}`
          );

        pts.forEach((c) => bounds.extend(c));

        // Hybrid arrows at every segment midpoint
        for (let i = 0; i < pts.length - 1; i++) {
          if (pts.length > 30 && i % 2 !== 0) continue;

          const from = pts[i];
          const to = pts[i + 1];
          const midLat = (from[0] + to[0]) / 2;
          const midLng = (from[1] + to[1]) / 2;
          const dx = to[1] - from[1];
          const dy = to[0] - from[0];
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

          L.marker([midLat, midLng], {
            icon: L.divIcon({
              className: "route-arrow",
              html: `<div style="transform:rotate(${angle}deg);color:${color};font-size:${arrowCfg.size}px;line-height:1;font-weight:bold;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));text-shadow:0 0 3px white;">${arrowCfg.char}</div>`,
              iconSize: [arrowCfg.size + 6, arrowCfg.size + 6],
              iconAnchor: [Math.floor(arrowCfg.size / 2) + 3, Math.floor(arrowCfg.size / 2) + 3],
            }),
            interactive: false,
          }).addTo(routeLayerGroup.current);
          totalArrows++;
        }

        L.circleMarker(pts[0], { radius: 7, fillColor: "#22c55e", color: "#fff", weight: 3, fillOpacity: 1 })
          .addTo(routeLayerGroup.current)
          .bindTooltip("START", { permanent: true, direction: "right", offset: [8, 0] });

        L.circleMarker(pts[pts.length - 1], { radius: 7, fillColor: "#ef4444", color: "#fff", weight: 3, fillOpacity: 1 })
          .addTo(routeLayerGroup.current)
          .bindTooltip("END", { permanent: true, direction: "right", offset: [8, 0] });
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }

      console.log(`✅ ${route.name}: ${totalArrows} arrows`);
    } catch (e) {
      console.error(e);
    }
  };

  const flipRoute = async (file, index) => {
    try {
      const res = await fetch(`${API}/admin/routes/flip?file=${encodeURIComponent(file)}&index=${index}`, { method: "POST" });
      const data = await res.json();
      alert(data.message || "Done!");
      fetchData();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const filtered = search
    ? routes.filter((r) => (r.name || "").toLowerCase().includes(search.toLowerCase()))
    : routes;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "4px solid #7c3aed", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6b7280" }}>Loading routes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444", marginBottom: 16 }}>Error: {error}</p>
          <button onClick={fetchData} style={{ padding: "8px 16px", background: "#7c3aed", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* LEFT PANEL */}
      <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb", background: "white", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", background: "#faf5ff" }}>
          <h1 style={{ fontSize: 18, fontWeight: "bold", color: "#4c1d95", margin: 0 }}>🛠️ Admin Routes</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {[
              ["Total", stats.total_routes || routes.length],
              ["1-way", stats.oneway_count || 0],
              ["Loops", stats.loop_count || 0],
            ].map(([label, val], i) => (
              <div key={i} style={{ flex: 1, background: "white", borderRadius: 8, padding: 8, textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 14, fontWeight: "bold", color: "#4c1d95" }}>{val}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 12 }}>
          <input
            type="text"
            placeholder="🔍 Search routes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map((r, i) => (
            <div
              key={`${r.file}-${r.index || i}`}
              onClick={() => inspectRoute(r)}
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #f3f4f6",
                cursor: "pointer",
                background: selectedRoute?.name === r.name ? "#f3e8ff" : "white",
                borderLeft: selectedRoute?.name === r.name ? "4px solid #7c3aed" : "4px solid transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (selectedRoute?.name !== r.name) e.currentTarget.style.background = "#faf5ff"; }}
              onMouseLeave={(e) => { if (selectedRoute?.name !== r.name) e.currentTarget.style.background = "white"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, textTransform: "capitalize" }}>{r.mode || "jeep"}</span>
                    {r.oneway && <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 4 }}>→ 1-way</span>}
                    {r.loop && <span style={{ fontSize: 10, background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 4 }}>↻ loop</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); flipRoute(r.file, r.index || 0); }}
                  style={{ fontSize: 10, padding: "2px 6px", background: "#ede9fe", color: "#5b21b6", border: "none", borderRadius: 4, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}
                  title="Flip direction"
                >🔄</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", gap: 8 }}>
          <button onClick={fetchData} style={{ flex: 1, padding: "8px 0", background: "#7c3aed", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🔄 Refresh</button>
          <span style={{ fontSize: 10, color: "#9ca3af", alignSelf: "center" }}>{filtered.length} routes</span>
        </div>
      </div>

      {/* RIGHT PANEL - Map */}
      <div style={{ flex: 1, position: "relative", minHeight: "100vh" }}>
        <div
          id="admin-osm-map"
          style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
        />

        {!selectedRoute && (
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(255,255,255,0.9)", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "#6b7280", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            👈 Click a route to inspect on the map
          </div>
        )}

        {selectedRoute && (
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1000, background: "rgba(255,255,255,0.95)", borderRadius: 8, padding: 12, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", maxWidth: 280 }}>
            <div style={{ fontWeight: "bold", color: "#4c1d95", fontSize: 14 }}>{selectedRoute.name}</div>
            <div style={{ color: "#6b7280", marginTop: 4 }}>{selectedRoute.mode} | {selectedRoute.oneway ? "→ One-way" : "↔ Bidirectional"}{selectedRoute.loop ? " | ↻ Loop" : ""}</div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 2 }}>{selectedRoute.file}</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .tooltip-start {
          background: #22c55e !important;
          color: white !important;
          border: none !important;
          font-size: 10px !important;
          font-weight: bold !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .tooltip-end {
          background: #ef4444 !important;
          color: white !important;
          border: none !important;
          font-size: 10px !important;
          font-weight: bold !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .leaflet-container {
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
}
