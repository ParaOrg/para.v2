import { useState, useEffect, useCallback } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function DataAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [funnel, setFunnel] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [routesRes, refRes, faresRes, tracksRes, threadsRes, poisRes, waitlistRes] = await Promise.all([
        fetch(`${API}/routes/public`),
        fetch(`${API}/routes/public/reference`),
        fetch(`${API}/fare/reports?limit=1000`),
        fetch(`${API}/commute/logs`),
        fetch(`${API}/community/threads`),
        fetch(`${API}/poi/list`),
        fetch(`${API}/auth/waitlist/count`),
      ]);

      const routes = await routesRes.json();
      const refs = await refRes.json();
      const fares = await faresRes.json();
      const tracks = await tracksRes.json();
      const threads = await threadsRes.json();
      const pois = await poisRes.json();
      const waitlist = await waitlistRes.json();

      const verifiedRoutes = routes.routes || [];
      const referenceRoutes = refs.routes || [];
      const fareReports = fares.reports || [];
      const commuteLogs = tracks.logs || [];
      const communityThreads = threads.threads || [];
      const poiList = pois.pois || [];
      const totalSignups = waitlist.count || 0;

      // Calculate funnel
      const activeTrackers = new Set(commuteLogs.map(l => l.user_id || l.raw_payload?.user_email || l.user_email)).size;
      const activeFareReporters = new Set(fareReports.map(f => f.user_email)).size;
      const activeThreadPosters = new Set(communityThreads.map(t => t.user_email)).size;
      const activePoiAdders = new Set(poiList.map(p => p.submitted_by)).size;

      setFunnel({
        totalSignups,
        trackedRoute: activeTrackers,
        reportedFare: activeFareReporters,
        postedThread: activeThreadPosters,
        addedPoi: activePoiAdders,
        fullyEngaged: Math.min(activeTrackers, activeFareReporters, activeThreadPosters, activePoiAdders),
      });

      setStats({
        verifiedRoutes: verifiedRoutes.length,
        referenceRoutes: referenceRoutes.length,
        fareReports: fareReports.length,
        commuteLogs: commuteLogs.length,
        communityThreads: communityThreads.length,
        pois: poiList.length,
        totalContributions: fareReports.length + commuteLogs.length + communityThreads.length + poiList.length,
      });

      // Fuzzy match
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

  const funnelSteps = [
    { label: "Sign Ups", count: funnel?.totalSignups || 0, color: "#7A4BC8" },
    { label: "Tracked Route", count: funnel?.trackedRoute || 0, color: "#4F00CD" },
    { label: "Reported Fare", count: funnel?.reportedFare || 0, color: "#F93F74" },
    { label: "Posted Thread", count: funnel?.postedThread || 0, color: "#FF8827" },
    { label: "Added POI", count: funnel?.addedPoi || 0, color: "#22c55e" },
  ];

  const maxFunnel = Math.max(...funnelSteps.map(f => f.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Data Analytics</h3>
        <button onClick={fetchData} className="text-xs text-[#7A4BC8] font-bold">↻</button>
      </div>

      {/* Two-column on desktop, scroll on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left column — Pipeline + Funnel */}
        <div className="space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-purple-800">{stats?.verifiedRoutes || 0}</p>
              <p className="text-[10px] text-gray-400">Verified</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-orange-600">{stats?.referenceRoutes || 0}</p>
              <p className="text-[10px] text-gray-400">Reference</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-green-700">{stats?.totalContributions || 0}</p>
              <p className="text-[10px] text-gray-400">Contributions</p>
            </div>
          </div>

          {/* Funnel */}
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <h4 className="text-xs font-bold text-gray-900 mb-3">User Funnel</h4>
            <div className="space-y-2">
              {funnelSteps.map((step) => (
                <div key={step.label}>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">{step.label}</span>
                    <span className="font-bold" style={{ color: step.color }}>{step.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full mt-0.5">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${(step.count / maxFunnel) * 100}%`, background: step.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Contributions + Route Matching */}
        <div className="space-y-3">
          {/* Contribution breakdown */}
          <div className="grid grid-cols-4 gap-1">
            {[
              ["Fares", stats?.fareReports, "₱", "#F93F74"],
              ["Tracks", stats?.commuteLogs, "📍", "#4F00CD"],
              ["Threads", stats?.communityThreads, "💬", "#FF8827"],
              ["POIs", stats?.pois, "📌", "#22c55e"],
            ].map(([label, count, icon, color]) => (
              <div key={label} className="rounded-lg p-2 text-center" style={{ background: `${color}10` }}>
                <p className="text-sm font-bold" style={{ color }}>{icon} {count || 0}</p>
                <p className="text-[9px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          {/* Route matching */}
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-900">Route Matching</h4>
              <span className="text-[10px] text-gray-400">{matched.length} ✅ / {unmatched.length} ❌</span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${(matched.length / (matched.length + unmatched.length || 1)) * 100}%` }} />
              <div className="bg-red-400 h-full" style={{ width: `${(unmatched.length / (matched.length + unmatched.length || 1)) * 100}%` }} />
            </div>
            <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-[#7A4BC8] font-bold">
              {expanded ? "Hide" : "Show details"}
            </button>
            {expanded && (
              <div className="mt-2 max-h-48 overflow-y-auto text-[10px]">
                {unmatched.slice(0, 20).map((name, i) => (
                  <div key={i} className="py-0.5 text-gray-500 truncate">❌ {name}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
