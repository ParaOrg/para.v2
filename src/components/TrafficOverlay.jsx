import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function TrafficOverlay({ routeData }) {
  const [traffic, setTraffic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routeData?.segments) return;
    // Placeholder until traffic API integrated
    const mockTraffic = routeData.segments.map((seg, i) => ({
      segment: i,
      route: seg.route || "Transit",
      congestion: ["light", "moderate", "heavy"][i % 3],
      delay_min: [0, 5, 15][i % 3],
    }));
    setTraffic(mockTraffic);
    setLoading(false);
  }, [routeData]);

  if (loading) return null;

  return (
    <div className="mt-4 bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-bold text-gray-500 mb-2">TRAFFIC STATUS</p>
      {traffic.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-sm py-1">
          <span className={`w-2 h-2 rounded-full ${
            t.congestion === "heavy" ? "bg-red-500" :
            t.congestion === "moderate" ? "bg-amber-500" : "bg-green-500"
          }`} />
          <span className="text-gray-700 flex-1">{t.route}</span>
          <span className="text-xs text-gray-400">
            {t.congestion} {t.delay_min > 0 ? `+${t.delay_min} min` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
