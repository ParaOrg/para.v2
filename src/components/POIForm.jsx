import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getApiBaseUrl } from "../utils/api";
import { useTrackingConsent } from "../context/TrackingConsentContext";

const API = getApiBaseUrl();
const CATEGORIES = ["terminal", "station", "landmark", "mall", "school", "church", "government"];

export default function POIForm({ onSuccess }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("terminal");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const { location, requestConsentAndLocation } = useTrackingConsent();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([14.5995, 120.9842], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("click", (e) => {
      const { lat: clickedLat, lng: clickedLng } = e.latlng;
      setLat(clickedLat.toFixed(6));
      setLng(clickedLng.toFixed(6));
      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker([clickedLat, clickedLng]).addTo(map)
        .bindPopup("POI Location").openPopup();
    });
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  const useCurrentLocation = () => {
    if (location) {
      setLat(location.lat.toFixed(6));
      setLng(location.lng.toFixed(6));
      if (mapInstance.current) {
        mapInstance.current.setView([location.lat, location.lng], 17, { animate: true });
        if (markerRef.current) mapInstance.current.removeLayer(markerRef.current);
        markerRef.current = L.marker([location.lat, location.lng]).addTo(mapInstance.current)
          .bindPopup("Your Location").openPopup();
      }
      setMsg({ ok: true, text: "Location set from GPS" });
    } else {
      requestConsentAndLocation();
      setMsg({ ok: false, text: "Enable location first" });
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !lat || !lng) {
      setMsg({ ok: false, text: "Name and location are required. Click the map to set location." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/poi/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical_name: name.trim(), category, lat: parseFloat(lat), lng: parseFloat(lng) }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "POI added!" });
        setName(""); setLat(""); setLng("");
        if (onSuccess) setTimeout(onSuccess, 1500);
      } else throw new Error("Failed");
    } catch {
      setMsg({ ok: false, text: "Failed to save POI" });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <h3 className="font-bold text-[#381D65] text-sm">Add a Place</h3>

      {msg && (
        <div className={`text-xs p-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      <input value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Place name (e.g., Cubao Terminal)"
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#7A4BC8]" />

      <select value={category} onChange={(e) => setCategory(e.target.value)}
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none">
        {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
      </select>

      <div className="relative">
        <div ref={mapRef} className="h-40 rounded-xl border border-gray-200" />
        <p className="absolute bottom-2 left-2 text-[10px] bg-white/80 px-2 py-0.5 rounded-lg text-gray-600">
          Tap map to set location
        </p>
      </div>

      <div className="flex gap-2 text-[10px] text-gray-400">
        <span>Lat: {lat || "—"}</span>
        <span>Lng: {lng || "—"}</span>
      </div>

      <button onClick={useCurrentLocation}
        className="w-full py-1.5 text-xs border border-[#7A4BC8] text-[#7A4BC8] rounded-lg font-medium">
        Use My Current Location
      </button>

      <button onClick={handleSubmit} disabled={saving}
        className="w-full py-2 bg-[#7A4BC8] text-white rounded-lg text-xs font-bold disabled:opacity-50">
        {saving ? "Saving..." : "Save Place"}
      </button>
    </div>
  );
}
