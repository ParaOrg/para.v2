import { useState } from "react";

export default function StravaRouteCard({ routeData, onClose }) {
  const [expanded, setExpanded] = useState(false);

  if (!routeData) return null;

  const {
    segments = [],
    total_fare = 0,
    total_time_min = 0,
    total_distance_m = 0,
    biyahe_score = 0,
  } = routeData;

  const score = typeof biyahe_score === "object" ? biyahe_score?.biyahe_score : biyahe_score;
  const scorePercent = Math.round((score || 0) * 100);

  // Build route shape from segments
  const allCoords = [];
  segments.forEach((seg) => {
    if (seg.geometry && seg.geometry.length > 1) {
      seg.geometry.forEach((c) => {
        if (Array.isArray(c) && c.length >= 2) {
          allCoords.push({ lng: c[0], lat: c[1] });
        }
      });
    }
  });

  const midpoint = allCoords.length > 0
    ? allCoords[Math.floor(allCoords.length / 2)]
    : null;

  const originName = segments[0]?.from || "Origin";
  const destName = segments[segments.length - 1]?.to || "Destination";

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto">
        {/* Close */}
        <button onClick={onClose} className="float-right text-gray-400 hover:text-gray-600">✕</button>

        {/* Route name */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚐</span>
          <h2 className="text-xl font-black text-[#381D65] truncate">
            {segments.map(s => s.route || "Transit").filter((v, i, a) => a.indexOf(v) === i).join(" + ")}
          </h2>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mt-3 text-sm">
          <span className="font-bold text-gray-900">{(total_distance_m / 1000).toFixed(1)} km</span>
          <span className="font-bold text-gray-900">{total_time_min} min</span>
          <span className="font-bold text-gray-900">₱{total_fare}</span>
          {scorePercent > 0 && (
            <span className="ml-auto bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
              ⚡ {scorePercent}%
            </span>
          )}
        </div>

        {/* Route shape mini-map overlay */}
        {allCoords.length > 10 && midpoint && (
          <div className="mt-4 bg-gray-50 rounded-2xl p-3">
            <p className="text-xs font-bold text-gray-500 mb-2">ROUTE SHAPE</p>
            <div className="relative h-40 bg-white rounded-xl border border-gray-100 overflow-hidden">
              <svg viewBox="0 0 300 160" className="w-full h-full">
                {/* Draw polyline from coordinates */}
                <polyline
                  points={allCoords.map((c) => {
                    const x = ((c.lng - midpoint.lng) * 100000) + 150;
                    const y = ((midpoint.lat - c.lat) * 100000) + 80;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#7A4BC8"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={segments.some(s => s.is_transfer) ? "8 4" : "none"}
                />
                {/* Origin dot */}
                <circle
                  cx={((allCoords[0].lng - midpoint.lng) * 100000) + 150}
                  cy={((midpoint.lat - allCoords[0].lat) * 100000) + 80}
                  r="6"
                  fill="#22c55e"
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Destination dot */}
                <circle
                  cx={((allCoords[allCoords.length-1].lng - midpoint.lng) * 100000) + 150}
                  cy={((midpoint.lat - allCoords[allCoords.length-1].lat) * 100000) + 80}
                  r="6"
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>

              {/* Labels */}
              <div className="absolute bottom-2 left-2 text-[10px] bg-white/80 px-2 py-0.5 rounded-lg">
                <span className="text-green-600 font-bold">●</span> {originName}
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] bg-white/80 px-2 py-0.5 rounded-lg">
                {destName} <span className="text-red-500 font-bold">●</span>
              </div>
            </div>
          </div>
        )}

        {/* Segments breakdown */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold text-gray-500">SEGMENTS</p>
          {segments.map((seg, i) => {
            const isWalk = seg.is_transfer || seg.type === "walk" || (seg.route && seg.route.includes("WALK"));
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{isWalk ? "🚶" : seg.type === "train" ? "🚆" : "🚌"}</span>
                <span className="font-medium text-gray-800">{isWalk ? "Walk" : seg.route || "Transit"}</span>
                {seg.time_min > 0 && (
                  <span className="ml-auto text-xs text-gray-400">{seg.time_min} min</span>
                )}
                {seg.fare > 0 && (
                  <span className="text-xs text-gray-400">₱{seg.fare}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Elevation-like profile (time per segment) */}
        <div className="mt-4 bg-gray-50 rounded-xl p-3">
          <p className="text-xs font-bold text-gray-500 mb-2">TIME PROFILE</p>
          <div className="flex items-end gap-1 h-16">
            {segments.map((seg, i) => {
              const height = Math.min(100, ((seg.time_min || 1) / Math.max(...segments.map(s => s.time_min || 1))) * 100);
              const isWalk = seg.is_transfer || seg.type === "walk";
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${height}%`,
                      background: isWalk ? "#9CA3AF" : "#7A4BC8",
                      minHeight: "8px",
                    }}
                  />
                  <span className="text-[8px] text-gray-400 mt-1 truncate max-w-full">
                    {isWalk ? "W" : "R"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Share buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              const text = `My commute: ${originName} → ${destName} (${total_time_min} min, ₱${total_fare}) via Para PH`;
              if (navigator.share) {
                navigator.share({ text });
              } else {
                navigator.clipboard.writeText(text);
                alert("Copied to clipboard!");
              }
            }}
            className="flex-1 py-2 bg-[#7A4BC8] text-white rounded-xl text-sm font-bold"
          >
            📤 Share
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold"
          >
            {expanded ? "Collapse" : "Details"}
          </button>
        </div>
      </div>
    </div>
  );
}
