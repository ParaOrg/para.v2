/**
 * RouteSummaryReport.jsx — Strava-style post-route summary.
 * Shows: route shape, segments, time, distance, pace, timeline.
 */

import { useState, useEffect } from "react";
import { toPng } from "html-to-image";
import { useAuth } from "../context/AuthContext";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function RouteSummaryReport({ routeData, onClose }) {
  const [showMap, setShowMap] = useState(true);
  const mapRef = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!routeData) return;
    
    const segments = routeData.segments || [];
    const allGps = [];
    let totalDistanceKm = 0;
    let walkingKm = 0;
    let ridingKm = 0;
    
    // Collect all GPS points from all segments
    segments.forEach((seg, segIdx) => {
      const gps = seg.gps_points || [];
      gps.forEach((p, i) => {
        allGps.push(p);
        if (i > 0) {
          const prev = gps[i-1];
          const d = haversine(prev.lat, prev.lng, p.lat, p.lng);
          totalDistanceKm += d;
          if (seg.type === "walking") walkingKm += d;
          else ridingKm += d;
        }
      });
    });
    
    // Timeline
    const timeline = segments.map((seg, i) => {
      const startTime = new Date(seg.start_time || Date.now());
      const endTime = new Date(seg.end_time || Date.now());
      const durationSec = Math.floor((endTime - startTime) / 1000);
      return {
        type: seg.type,
        vehicle: seg.vehicle || "Walking",
        start: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        end: endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: durationSec,
      };
    });
    
    const totalTimeSec = routeData.total_time_sec || 0;
    const avgSpeedKmh = totalDistanceKm > 0 && totalTimeSec > 0 
      ? (totalDistanceKm / (totalTimeSec / 3600)).toFixed(1) 
      : "0.0";
    
    // Calculate total fare
    const totalFare = segments.reduce((sum, seg) => {
      return sum + (seg.fare || 0);
    }, routeData.total_fare || 0);
    
    setStats({
      totalDistanceKm: totalDistanceKm.toFixed(2),
      walkingKm: walkingKm.toFixed(2),
      ridingKm: ridingKm.toFixed(2),
      totalTimeMin: Math.floor(totalTimeSec / 60),
      avgSpeedKmh,
      totalFare: Math.round(totalFare),
      timeline,
      destination: routeData.destination_goal || "Personal Route",
      completedAt: new Date(routeData.completed_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      allGps,
    });
    
  }, [routeData]);

  if (!stats) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 overflow-y-auto p-4">
        <div className="bg-white rounded-3xl p-6 text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Building your summary…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 overflow-y-auto p-4">
      <div id="route-summary-card" className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 pb-0 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#381D65]">✅ Route Complete!</h2>
            <p className="text-sm text-gray-500 mt-1">{stats.destination}</p>
            <p className="text-xs text-gray-400 mt-0.5">Arrived at {stats.completedAt}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Share + Save */}
        <div className="px-6 mt-3 flex gap-2">
          <button onClick={() => {
            const text = `🚐 Para PH: ${stats?.destination || 'My Route'}\n📏 ${stats?.totalDistanceKm} km in ${stats?.totalTimeMin} min\n🚶 ${stats?.walkingKm} km walking • 🚐 ${stats?.ridingKm} km riding\n\nTracked with Para PH — community transit data`;
            if (navigator.share) {
              navigator.share({ title: 'Para PH Route', text });
            } else {
              navigator.clipboard.writeText(text);
              alert('Copied to clipboard!');
            }
          }}
            className="flex-1 py-2.5 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">
            📤 Share
          </button>
          <button onClick={() => {
            try {
              const saved = JSON.parse(localStorage.getItem('para_saved_routes') || '[]');
              saved.push({
                ...routeData,
                stats: {
                  total_km: stats?.totalDistanceKm,
                  walking_km: stats?.walkingKm,
                  riding_km: stats?.ridingKm,
                  avg_speed: stats?.avgSpeedKmh,
                  total_fare: stats?.totalFare,
                },
                saved_at: new Date().toISOString(),
              });
              localStorage.setItem('para_saved_routes', JSON.stringify(saved));
              alert('✅ Saved to Profile!');
            } catch {}
          }}
            className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm">
            💾 Save
          </button>
        </div>

        {/* Export as Image */}
        <div className="px-6 mt-2">
          <button onClick={() => {
            const card = document.getElementById("route-summary-card");
            if (!card) { alert("Card not found"); return; }
            toPng(card, { 
              pixelRatio: 2, 
              backgroundColor: "#ffffff", 
              cacheBust: true,
              width: card.scrollWidth,
              height: card.scrollHeight,
            })
              .then(dataUrl => {
                const link = document.createElement("a");
                link.download = `para-route-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
              })
              .catch(err => {
                console.error("Export error:", err);
                alert("Export failed. Try again.");
              });
          }}
            className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm">
            📸 Export as Image (PNG)
          </button>
        </div>

        {/* Map toggle */}
        <div className="px-6 mt-4">
          <button onClick={() => setShowMap(!showMap)}
            className="w-full py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-600">
            {showMap ? "Hide Map" : "Show Map"}
          </button>
        </div>

        {/* Map */}
        {showMap && stats.allGps.length > 0 && (
          <div className="mx-6 mt-3 h-48 rounded-2xl overflow-hidden relative">
            <div className="absolute inset-0" ref={(el) => {
              if (el && !el._map) {
                el._map = L.map(el, { zoomControl: false, attributionControl: false });
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(el._map);
                const coords = stats.allGps.map(p => [p.lat, p.lng]);
                if (coords.length > 1) {
                  L.polyline(coords, { color: "#7A4BC8", weight: 4, opacity: 0.7 }).addTo(el._map);
                  el._map.fitBounds(coords, { padding: [20, 20] });
                } else if (coords.length === 1) {
                  el._map.setView(coords[0], 15);
                }
                // Force resize after render
                setTimeout(() => el._map.invalidateSize(), 100);
              }
            }} />
          </div>
        )}

        {/* Key stats */}
        <div className="grid grid-cols-4 gap-2 px-6 mt-4">
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-purple-800">{stats.totalDistanceKm}</p>
            <p className="text-[9px] text-gray-400">km</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-blue-700">{stats.totalTimeMin}</p>
            <p className="text-[9px] text-gray-400">min</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-green-700">₱{stats.totalFare}</p>
            <p className="text-[9px] text-gray-400">fare</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-orange-600">{stats.avgSpeedKmh}</p>
            <p className="text-[9px] text-gray-400">km/h</p>
          </div>
        </div>

        {/* Per-vehicle fare breakdown */}
        <div className="px-6 mt-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-bold text-gray-600 mb-2">Fare Breakdown</p>
            {stats.timeline.filter(t => t.type === "riding").map((seg, i) => {
              const fare = routeData?.segments?.find(s => s.vehicle === seg.vehicle)?.fare || 0;
              return (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="text-lg">🚐</span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{seg.vehicle}</span>
                  <span className="text-xs font-bold text-gray-800">₱{fare}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 py-1 border-t border-gray-200 mt-1">
              <span className="text-sm">💰</span>
              <span className="text-xs font-bold text-gray-600 flex-1">TOTAL</span>
              <span className="text-sm font-black text-[#7A4BC8]">₱{stats.totalFare}</span>
            </div>
          </div>
        </div>

        {/* Walk vs Ride breakdown */}
        <div className="px-6 mt-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-bold text-gray-600 mb-2">Breakdown</p>
            <div className="flex items-center gap-2">
              <span className="text-lg">🚶</span>
              <span className="text-xs text-gray-600 flex-1">Walking</span>
              <span className="text-xs font-bold text-gray-800">{stats.walkingKm} km</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg">🚐</span>
              <span className="text-xs text-gray-600 flex-1">Riding</span>
              <span className="text-xs font-bold text-gray-800">{stats.ridingKm} km</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="px-6 mt-3 pb-6">
          <p className="text-xs font-bold text-gray-600 mb-2">Your Journey</p>
          <div className="space-y-1">
            {stats.timeline.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg">
                <span className="text-lg">{seg.type === "walking" ? "🚶" : "🚐"}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">
                  {seg.type === "walking" ? "Walked" : seg.vehicle}
                </span>
                <span className="text-[10px] text-gray-400">
                  {seg.start} → {seg.end}
                </span>
                <span className="text-[10px] font-bold text-gray-600">
                  {Math.floor(seg.duration / 60)} min
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
