import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTrackingConsent } from "../context/TrackingConsentContext";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_CENTER = [14.5995, 120.9842];
const GPS_ICON = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;background:#4285F4;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function MapComponent({ markers = [], polylines = [], showLegend = true, fitBounds = true, onMapReady }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polylineLayer = useRef(null);
  const markerLayer = useRef(null);
  const gpsMarker = useRef(null);
  const [ready, setReady] = useState(false);
  const { consent, location } = useTrackingConsent();

  // Update polylines when prop changes
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!polylineLayer.current) {
      polylineLayer.current = L.layerGroup().addTo(mapInstance.current);
    }
    polylineLayer.current.clearLayers();
    polylines.forEach((line) => {
      L.polyline(line.coordinates, {
        color: line.color || "#310775",
        weight: line.weight || 4,
        dashArray: line.dashed ? "5, 8" : null,
        opacity: 0.8,
      }).addTo(polylineLayer.current);
    });
    if (fitBounds && polylines.length > 0) {
      const bounds = L.latLngBounds(
        polylines.flatMap((p) => p.coordinates)
      );
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [polylines, fitBounds]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true }).setView(DEFAULT_CENTER, 13);
    const primaryTiles = L.tileLayer("https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; CartoDB &copy; OpenStreetMap",
    }).addTo(map);

    primaryTiles.on("tileerror", () => {
      if (!window.__osmFallback) {
        window.__osmFallback = true;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);
      }
    });

    const _unused = L.tileLayer("https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "&copy; CartoDB &copy; OpenStreetMap" }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    polylineLayer.current = L.layerGroup().addTo(map);
    markerLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    window.__paraMap = map;
    setReady(true);
    if (onMapReady) onMapReady(map);
    return () => { map.remove(); mapInstance.current = null; polylineLayer.current = null; markerLayer.current = null; gpsMarker.current = null; window.__paraMap = null; };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready || !polylineLayer.current) return;
    polylineLayer.current.clearLayers();
    const bounds = L.latLngBounds([]);
    polylines.forEach((line) => {
      const coords = Array.isArray(line) ? line : line?.coordinates;
      if (!coords || coords.length < 2) return;
      const polyline = L.polyline(coords, { 
        color: line?.color || "#7A4BC8", 
        weight: line?.weight || 4, 
        opacity: line?.opacity ?? 0.8, 
        dashArray: line?.dashed ? "10, 5" : null 
      }).addTo(polylineLayer.current);
      
      // Add hover tooltip with route name
      if (line?.routeName) {
        polyline.bindTooltip(line.routeName, { sticky: true });
      }
      
      // Add hop-on marker at start, hop-off at end of each segment
      if (line?.hopOn) {
        L.circleMarker(coords[0], {
          radius: 5,
          fillColor: "#22c55e",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
          zIndexOffset: 500,
        }).addTo(polylineLayer.current).bindTooltip("Hop on: " + (line.routeName || ""), { permanent: false, direction: "top" });
      }
      if (line?.hopOff) {
        L.circleMarker(coords[coords.length - 1], {
          radius: 5,
          fillColor: "#f59e0b",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
          zIndexOffset: 500,
        }).addTo(polylineLayer.current).bindTooltip("Hop off: " + (line.routeName || ""), { permanent: false, direction: "top" });
      }
      
      coords.forEach((coord) => bounds.extend(coord));
    });
    if (fitBounds && polylines.length > 0 && bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [polylines, fitBounds, ready]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready || !markerLayer.current) return;
    markerLayer.current.clearLayers();
    markers.forEach((marker) => {
      if (marker.type === "start") {
        L.circleMarker([marker.lat, marker.lng], {
          radius: 8,
          fillColor: "#22c55e",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
          zIndexOffset: 1000,
        }).addTo(markerLayer.current).bindTooltip("Start", { permanent: true, direction: "top" });
        return;
      }
      if (marker.type === "end") {
        L.circleMarker([marker.lat, marker.lng], {
          radius: 8,
          fillColor: "#ef4444",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
          zIndexOffset: 1000,
        }).addTo(markerLayer.current).bindTooltip("Destination", { permanent: true, direction: "top" });
        return;
      }
      const lat = marker.lat ?? marker.latitude ?? marker.position?.[0];
      const lng = marker.lng ?? marker.longitude ?? marker.position?.[1];
      if (lat == null || lng == null) return;
      const color = marker.type === "origin" ? "#22c55e" : marker.type === "destination" ? "#ef4444" : "#7A4BC8";
      L.circleMarker([lat, lng], { radius: 7, fillColor: color, color: "#fff", weight: 3, fillOpacity: 1 }).addTo(markerLayer.current);
    });
  }, [markers, ready]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready) return;
    const lat = location?.lat;
    const lng = location?.lng;
    if (consent && lat != null && lng != null) {
      if (!gpsMarker.current) gpsMarker.current = L.marker([lat, lng], { icon: GPS_ICON, zIndexOffset: 9999 }).addTo(map).bindTooltip("You are here");
      else gpsMarker.current.setLatLng([lat, lng]);
    } else if (gpsMarker.current) { map.removeLayer(gpsMarker.current); gpsMarker.current = null; }
  }, [consent, location, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full rounded-xl" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl"><div className="w-8 h-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" /></div>}
    </div>
  );
}
