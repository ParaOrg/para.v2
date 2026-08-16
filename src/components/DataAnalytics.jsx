import { useState, useEffect, useCallback } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function DataAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [routesRes, refRes, faresRes, tracksRes, threadsRes, poisRes] = await Promise.all([
        fetch(`${API}/routes/public`),
        fetch(`${API}/routes/public/reference`),
        fetch(`${API}/fare/reports?limit=500`),
        fetch(`${API}/commute/logs`),
        fetch(`${API}/community/threads`),
        fetch(`${API}/poi/list`),
      ]);

      const routes = await routesRes.json();
      const refs = await refRes.json();
      const fares = await faresRes.json();
      const tracks = await tracksRes.json();
      const threads = await threadsRes.json();
      const pois = await poisRes.json();

      const verifiedRoutes = routes.routes || [];
      const referenceRoutes = refs.routes || [];
      const fareReports = fares.reports || [];
      const commuteLogs = tracks.logs || [];
      const communityThreads = threads.threads || [];
      const poiList = pois.pois || [];

      setStats({
        verifiedRoutes: verifiedRoutes.length,
        referenceRoutes: referenceRoutes.length,
        fareReports: fareReports.length,
        commuteLogs: commuteLogs.length,
        communityThreads: communityThreads.length,
        pois: poiList.length,
        totalContributions: fareReports.length + commuteLogs.length + communityThreads.length + poiList.length,
      });

      // Fuzzy match reference → verified
      const vNames = verifiedRoutes.map(r => (r.name || "").toLowerCase().trim());
      const matchedArr = [];
      const unmatchedArr = [];

      for (const ref of referenceRoutes) {
        const refName = (ref.route_name || "").toLowerCase().trim();
        const cleanRef = refName.replace(/^\([^)]+\)\s*/, '').trim();
        let found = false;
        for (const vName of vNames) {
          if (!vName) continue;
          if (refName === vName || cleanRef === vName || 
              refName.includes(vName) || vName.includes(refName) ||
              cleanRef.includes(vName) || vName.includes(cleanRef)) {
            matchedArr.push({ reference: ref.route_name, verified: vName });
            found = true;
            break;
          }
        }
        if (!found) unmatchedArr.push(ref.route_name);
      }

      setMatched(matchedArr);
      setUnmatched(unmatchedArr);
    } catch (e) {
      console.error("Analytics fetch failed:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="text-center py-8"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Data Analytics</h3>
        <button onClick={fetchData} className="text-xs text-[#7A4BC8] font-bold">↻</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-purple-800">{stats?.verifiedRoutes || 0}</p>
          <p className="text-[10px] text-gray-400">Verified Routes</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-orange-600">{stats?.referenceRoutes || 0}</p>
          <p className="text-[10px] text-gray-400">Reference Routes</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-green-700">{stats?.totalContributions || 0}</p>
          <p className="text-[10px] text-gray-400">Contributions</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {[
          ["Fares", stats?.fareReports, "₱"],
          ["Tracks", stats?.commuteLogs, "📍"],
          ["Threads", stats?.communityThreads, "💬"],
          ["POIs", stats?.pois, "📌"],
        ].map(([label, count, icon]) => (
          <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-gray-700">{icon} {count || 0}</p>
            <p className="text-[9px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Route matching */}
      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-900">Route Matching</h4>
          <span className="text-[10px] text-gray-400">{matched.length} matched • {unmatched.length} unmatched</span>
        </div>
        <div className="mt-2 flex gap-1">
          <div className="flex-1 bg-green-500 rounded-full" style={{ height: "6px", width: `${(matched.length / (matched.length + unmatched.length || 1)) * 100}%` }} />
          <div className="flex-1 bg-red-400 rounded-full" style={{ height: "6px", width: `${(unmatched.length / (matched.length + unmatched.length || 1)) * 100}%` }} />
        </div>

        <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-[#7A4BC8] font-bold">
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
            {unmatched.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-red-500 mb-1">Unmatched ({unmatched.length}):</p>
                {unmatched.slice(0, 30).map((name, i) => (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="text-[10px] text-gray-600 flex-1 truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
            {matched.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-green-600 mb-1 mt-2">Matched ({matched.length}):</p>
                {matched.slice(0, 30).map((m, i) => (
                  <div key={i} className="py-0.5">
                    <p className="text-[10px] text-gray-700 truncate">{m.reference}</p>
                    <p className="text-[9px] text-gray-400">→ {m.verified}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
