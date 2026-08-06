/**
 * AdminDashboard.jsx — Admin panel with three tabs:
 *   Route Doctor — list, inspect, rename, verify, delete routes
 *   Inspector — view route geometry on map
 *   Approvals — review pending community submissions
 */

import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getApiBaseUrl } from "../utils/api";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const API = getApiBaseUrl();

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MANILA_CENTER = [14.5995, 120.9842];

// ── Tab definitions ────────────────────────────────────
const TABS = [
  { id: "doctor", label: "🩺 Route Doctor" },
  { id: "inspector", label: "🔍 Inspector" },
  { id: "approvals", label: "📋 Approvals" },
];

export default function AdminDashboard() {
  let auth = { isAuthenticated: false, user: null };
  try { auth = useAuth(); } catch (_) {}

  if (!auth.isAuthenticated || auth.user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-black text-gray-900 mb-4">🛠️ Admin Dashboard</h1>
          <p className="text-gray-500 mb-8 text-lg">Admin access required. Sign up or log in with an admin account to manage routes.</p>
          <Link to="/signup" className="inline-block px-8 py-3 bg-purple-800 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors">Sign Up</Link>
          <p className="mt-4 text-sm text-gray-400">Already an admin? <Link to="/login" className="text-purple-700 underline">Log in</Link></p>
        </div>
      </div>
    );
  }


  const [tab, setTab] = useState("doctor");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-purple-100 text-purple-800"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {tab === "doctor" && <RouteDoctorTab />}
        {tab === "inspector" && <InspectorTab />}
        {tab === "approvals" && <ApprovalsTab />}
      </div>
    </div>
  );
}

// ── Route Doctor Tab ───────────────────────────────────

function RouteDoctorTab() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/routes/list`);
      const data = await res.json();
      setRoutes(data.routes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  const filtered = search
    ? routes.filter((r) => (r.name || "").toLowerCase().includes(search.toLowerCase()))
    : routes;

  const handleAction = async (routeId, action, extra = {}) => {
    setActionMsg(null);
    try {
      let res;
      if (action === "rename") {
        const newName = window.prompt("New route name:", extra.currentName);
        if (!newName) return;
        res = await fetch(`${API}/admin/routes/rename?route_id=${routeId}&new_name=${encodeURIComponent(newName)}`, { method: "POST" });
      } else if (action === "verify") {
        res = await fetch(`${API}/admin/routes/verify?route_id=${routeId}`, { method: "POST" });
      } else if (action === "delete") {
        if (!window.confirm("Delete this route permanently?")) return;
        res = await fetch(`${API}/admin/routes/${routeId}`, { method: "DELETE" });
      }

      if (res && res.ok) {
        const data = await res.json();
        setActionMsg({ ok: true, text: data.message || `${action} successful` });
        fetchRoutes();
        if (selected?.route_uuid === routeId) setSelected(null);
      } else if (res) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
    } catch (e) {
      setActionMsg({ ok: false, text: e.message });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading routes…</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500">Error: {error}</p>
        <button onClick={fetchRoutes} className="px-4 py-2 bg-purple-800 text-white rounded-lg text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Search + stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <input
          type="text"
          placeholder="🔍 Search routes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <span className="text-sm text-gray-500">{filtered.length} route{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          actionMsg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* Route list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {filtered.map((route) => (
          <div
            key={route.route_uuid}
            className={`p-4 flex items-center gap-3 transition-colors ${
              selected?.route_uuid === route.route_uuid ? "bg-purple-50" : "hover:bg-gray-50"
            }`}
          >
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{route.name}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full capitalize">{route.mode}</span>
                {route.is_approved && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ Verified</span>
                )}
                {!route.is_approved && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{route.status}</span>
                )}
                {route.length_m && (
                  <span className="text-[10px] text-gray-400">{(route.length_m / 1000).toFixed(1)}km</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setSelected(selected?.route_uuid === route.route_uuid ? null : route)}
                className="px-2 py-1 text-[10px] font-semibold rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                {selected?.route_uuid === route.route_uuid ? "Hide" : "Inspect"}
              </button>
              <button
                onClick={() => handleAction(route.route_uuid, "rename", { currentName: route.name })}
                className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                Rename
              </button>
              {!route.is_approved && (
                <button
                  onClick={() => handleAction(route.route_uuid, "verify")}
                  className="px-2 py-1 text-[10px] font-semibold rounded bg-green-50 text-green-700 hover:bg-green-100"
                >
                  Verify
                </button>
              )}
              <button
                onClick={() => handleAction(route.route_uuid, "delete")}
                className="px-2 py-1 text-[10px] font-semibold rounded bg-red-50 text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No routes found</div>
        )}
      </div>
    </div>
  );
}

// ── Inspector Tab ──────────────────────────────────────

function InspectorTab() {
  const [routes, setRoutes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [geoJson, setGeoJson] = useState(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const layerRef = useRef(null);

  // Load route list
  useEffect(() => {
    fetch(`${API}/admin/routes/list`)
      .then((r) => r.json())
      .then((d) => setRoutes(d.routes || []));
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(MANILA_CENTER, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;
    return () => map.remove();
  }, []);

  // Load geometry
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`${API}/admin/routes/geojson?route_id=${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        setGeoJson(data);
        const map = mapInst.current;
        if (!map) return;
        layerRef.current?.clearLayers();
        L.geoJSON(data, {
          style: { color: "#3e00a6", weight: 5, opacity: 0.9 },
        }).addTo(layerRef.current);
        const bounds = L.geoJSON(data).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-100">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Select a route…</option>
            {routes.map((r) => (
              <option key={r.route_uuid} value={r.route_uuid}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {selectedId && geoJson && (
          <div className="p-3 text-xs space-y-2 overflow-y-auto">
            <p className="font-bold text-gray-700">Route Details</p>
            <p>Features: {geoJson.features?.length || 0}</p>
            {geoJson.features?.[0]?.geometry && (
              <>
                <p>Type: {geoJson.features[0].geometry.type}</p>
                <p>
                  Coordinates:{" "}
                  {geoJson.features[0].geometry.type === "MultiLineString"
                    ? geoJson.features[0].geometry.coordinates.reduce((sum, c) => sum + c.length, 0)
                    : geoJson.features[0].geometry.coordinates?.length || 0}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <div className="w-6 h-6 border-3 border-purple-200 border-t-purple-800 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approvals Tab ──────────────────────────────────────

function ApprovalsTab() {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/admin/pending/list`)
      .then((r) => r.json())
      .then((d) => setPending(d.routes || []));
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(MANILA_CENTER, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapInst.current = map;
    setMapReady(true);
    return () => map.remove();
  }, []);

  const previewRoute = async (route) => {
    setSelected(route);
    try {
      const res = await fetch(`${API}/admin/pending/geojson/${route.route_uuid}`);
      const data = await res.json();
      const map = mapInst.current;
      if (!map) return;
      layerRef.current?.clearLayers();
      L.geoJSON(data, {
        style: { color: "#f59e0b", weight: 4, opacity: 0.8 },
      }).addTo(layerRef.current);
      const bounds = L.geoJSON(data).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    } catch (e) {
      console.error("Preview failed:", e);
    }
  };

  const approve = async (routeId) => {
    await fetch(`${API}/admin/pending/approve?route_id=${routeId}`, { method: "POST" });
    setPending((prev) => prev.filter((r) => r.route_uuid !== routeId));
    setSelected(null);
    layerRef.current?.clearLayers();
  };

  const reject = async (routeId) => {
    const reason = window.prompt("Rejection reason (optional):") || "";
    await fetch(`${API}/admin/pending/reject?route_id=${routeId}&reason=${encodeURIComponent(reason)}`, { method: "POST" });
    setPending((prev) => prev.filter((r) => r.route_uuid !== routeId));
    setSelected(null);
    layerRef.current?.clearLayers();
  };

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-amber-100 bg-amber-50">
          <h2 className="font-bold text-amber-800 text-sm">🕐 Pending Approval</h2>
          <p className="text-xs text-amber-600 mt-0.5">{pending.length} route{pending.length !== 1 ? "s" : ""} awaiting review</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {pending.map((route) => (
            <div
              key={route.route_uuid}
              onClick={() => previewRoute(route)}
              className={`p-3 border-b cursor-pointer transition-colors ${
                selected?.route_uuid === route.route_uuid ? "bg-amber-50 border-l-4 border-l-amber-500" : "hover:bg-gray-50"
              }`}
            >
              <p className="text-sm font-medium text-gray-900 truncate">{route.name}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{route.mode}</p>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">No pending routes</div>
          )}
        </div>

        {/* Actions */}
        {selected && (
          <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
            <button
              onClick={() => approve(selected.route_uuid)}
              className="flex-1 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600"
            >
              ✅ Approve
            </button>
            <button
              onClick={() => reject(selected.route_uuid)}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600"
            >
              ❌ Reject
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <div className="w-6 h-6 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
          </div>
        )}
        {selected && (
          <div className="absolute top-4 left-4 z-[1000] bg-white/95 rounded-lg shadow-lg p-3 max-w-xs text-xs">
            <p className="font-bold text-amber-800">{selected.name}</p>
            <p className="text-gray-500 mt-1 capitalize">{selected.mode}</p>
          </div>
        )}
      </div>
    </div>
  );
}
