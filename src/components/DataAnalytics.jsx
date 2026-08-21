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
  const [timeline, setTimeline] = useState([]);
  const [pwaStats, setPwaStats] = useState(null);

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
      
      // PWA stats from localStorage
      try {
        const pwaEvents = JSON.parse(localStorage.getItem("para_pwa_events") || "[]");
        const installed = pwaEvents.filter(e => e.event === "pwa_installed").length;
        const openedHomescreen = pwaEvents.filter(e => e.event === "pwa_opened_from_homescreen").length;
        const iosHomescreen = pwaEvents.filter(e => e.event === "pwa_opened_ios_homescreen").length;
        setPwaStats({ installed, openedHomescreen, iosHomescreen, total: pwaEvents.length });
      } catch {}

      const routes = await routesRes.json();
      const refs = await refRes.json();
      const fares = await faresRes.json();
      const tracks = await tracksRes.json();
      const threads = await threadsRes.json();
      const pois = await poisRes.json();
      const waitlist = await waitlistRes.json();

      const allRoutes = routes.routes || [];
      const verifiedRoutes = allRoutes.filter(r => r.is_approved);
      const unverifiedRoutes = allRoutes.filter(r => !r.is_approved);
      const referenceRoutes = refs.routes || [];
      const fareReports = fares.reports || [];
      const commuteLogs = tracks.logs || [];
      const communityThreads = threads.threads || [];
      const poiList = pois.pois || [];

      // Build timeline from all data — group by day
      const allEvents = [];
      fareReports.forEach(f => {
        const date = (f.created_at || f.reported_at || "").slice(0, 10);
        if (date) allEvents.push({ date, type: "fare" });
      });
      commuteLogs.forEach(l => {
        const date = (l.created_at || l.raw_payload?.completed_at || "").slice(0, 10);
        if (date) allEvents.push({ date, type: "track" });
      });
      communityThreads.forEach(t => {
        const date = (t.created_at || "").slice(0, 10);
        if (date) allEvents.push({ date, type: "thread" });
      });
      poiList.forEach(p => {
        const date = (p.created_at || "").slice(0, 10);
        if (date) allEvents.push({ date, type: "poi" });
      });

      // Group by day
      const byDay = {};
      allEvents.forEach(e => {
        if (!byDay[e.date]) byDay[e.date] = { fare: 0, track: 0, thread: 0, poi: 0 };
        byDay[e.date][e.type]++;
      });

      const timelineArr = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14) // last 14 days
        .map(([date, counts]) => ({
          date: date.slice(5), // MM-DD
          total: counts.fare + counts.track + counts.thread + counts.poi,
          ...counts,
        }));
      setTimeline(timelineArr);

      const activeTrackers = new Set(commuteLogs.map(l => l.user_id || l.raw_payload?.user_email || l.user_email)).size;
      const activeFareReporters = new Set(fareReports.map(f => f.user_email)).size;
      const activeThreadPosters = new Set(communityThreads.map(t => t.user_email)).size;
      const activePoiAdders = new Set(poiList.map(p => p.submitted_by)).size;

      setFunnel({
        totalSignups: waitlist.count || 0,
        trackedRoute: activeTrackers,
        reportedFare: activeFareReporters,
        postedThread: activeThreadPosters,
        addedPoi: activePoiAdders,
      });

      setStats({
        verifiedRoutes: verifiedRoutes.length,
        unverifiedRoutes: unverifiedRoutes.length,
        referenceRoutes: referenceRoutes.length,
        fareReports: fareReports.length,
        commuteLogs: commuteLogs.length,
        communityThreads: communityThreads.length,
        pois: poiList.length,
        totalContributions: fareReports.length + commuteLogs.length + communityThreads.length + poiList.length,
      });

      // Exact match against VERIFIED routes only (48)
      const vNames = verifiedRoutes.map(r => (r.name || "").toLowerCase().trim());
      const matchedArr = [];
      const unmatchedArr = [];
      for (const ref of referenceRoutes) {
        const refName = (ref.route_name || "").toLowerCase().trim();
        if (vNames.includes(refName)) {
          matchedArr.push({ reference: ref.route_name, verified: refName });
        } else {
          unmatchedArr.push(ref.route_name);
        }
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

  const maxTimeline = Math.max(...timeline.map(d => d.total), 1);
  const chartHeight = 80;
  const chartWidth = 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Data Analytics</h3>
        <button onClick={fetchData} className="text-xs text-[#7A4BC8] font-bold">↻</button>
      </div>

      {/* Multi-Line Graph — 4 colored lines */}
      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <h4 className="text-xs font-bold text-gray-900 mb-1">Activity (14 days)</h4>
        <div className="flex gap-3 mb-2">
          {[
            ["Fares", "#F93F74"],
            ["Tracks", "#4F00CD"],
            ["Threads", "#FF8827"],
            ["POIs", "#22c55e"],
          ].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1 text-[8px] text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} /> {label}
            </span>
          ))}
        </div>
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth * 10} ${chartHeight}`} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map(frac => (
            <line key={frac} x1="0" y1={chartHeight * frac} x2={chartWidth * 10} y2={chartHeight * frac} stroke="#f0f0f0" strokeWidth="0.5" />
          ))}
          {[
            ["fare", "#F93F74"],
            ["track", "#4F00CD"],
            ["thread", "#FF8827"],
            ["poi", "#22c55e"],
          ].map(([type, color]) => {
            const points = timeline.map((d, i) => {
              const x = (i / Math.max(timeline.length - 1, 1)) * chartWidth * 10;
              const y = chartHeight - ((d[type] || 0) / maxTimeline) * (chartHeight - 10);
              return `${x},${y}`;
            });
            return (
              <polyline
                key={type}
                points={points.join(" ")}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
        <div className="flex justify-between mt-1">
          {timeline.length > 0 && (
            <>
              <span className="text-[8px] text-gray-400">{timeline[0]?.date}</span>
              <span className="text-[8px] text-gray-400">{timeline[Math.floor(timeline.length / 2)]?.date}</span>
              <span className="text-[8px] text-gray-400">{timeline[timeline.length - 1]?.date}</span>
            </>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-center">{stats?.totalContributions || 0} total contributions</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-green-700">{stats?.verifiedRoutes || 0}</p>
          <p className="text-[10px] text-gray-400">Verified</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-amber-600">{stats?.unverifiedRoutes || 0}</p>
          <p className="text-[10px] text-gray-400">Unverified</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-orange-600">{stats?.referenceRoutes || 0}</p>
          <p className="text-[10px] text-gray-400">Reference</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-purple-800">{stats?.totalContributions || 0}</p>
          <p className="text-[10px] text-gray-400">Contributions</p>
        </div>
      </div>

      {/* Route Matching — ONLY this is a progress bar */}
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
          <div className="mt-2 max-h-40 overflow-y-auto text-[10px]">
            {unmatched.slice(0, 20).map((name, i) => (
              <div key={i} className="py-0.5 text-gray-500 truncate">❌ {name}</div>
            ))}
          </div>
        )}
      </div>

      {/* PWA Stats */}
      {pwaStats && (
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <h4 className="text-xs font-bold text-gray-900 mb-2">PWA Installs</h4>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-sm font-bold text-blue-700">{pwaStats.installed}</p>
              <p className="text-[8px] text-gray-400">Android Installs</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-2">
              <p className="text-sm font-bold text-purple-700">{pwaStats.openedHomescreen}</p>
              <p className="text-[8px] text-gray-400">Home Screen Opens</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-sm font-bold text-gray-700">{pwaStats.iosHomescreen}</p>
              <p className="text-[8px] text-gray-400">iOS Opens</p>
            </div>
          </div>
        </div>
      )}

      {/* Funnel data */}
      <div className="grid grid-cols-5 gap-1 text-center">
        {[
          ["Signups", funnel?.totalSignups],
          ["Tracked", funnel?.trackedRoute],
          ["Fares", funnel?.reportedFare],
          ["Threads", funnel?.postedThread],
          ["POIs", funnel?.addedPoi],
        ].map(([label, count]) => (
          <div key={label} className="bg-gray-50 rounded-lg p-2">
            <p className="text-sm font-bold text-gray-700">{count || 0}</p>
            <p className="text-[8px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
