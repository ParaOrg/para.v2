import { useState, useEffect } from "react";
import { apiGet } from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function AnalyticsDashboard() {
  const auth = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("week");

  useEffect(() => {
    const fetchStats = async () => {
      if (!auth?.user?.email) return;
      try {
        const logs = await apiGet(`/commute/logs?user_email=${encodeURIComponent(auth.user.email)}`);
        const reports = await apiGet("/fare/reports");
        
        const userLogs = (logs.logs || []).filter(l => {
          const date = new Date(l.created_at);
          const now = new Date();
          const diffDays = (now - date) / (86400000);
          if (timeRange === "week") return diffDays <= 7;
          if (timeRange === "month") return diffDays <= 30;
          return true;
        });
        
        const totalTimeSec = userLogs.reduce((sum, l) => sum + (l.total_time_sec || 0), 0);
        const totalTrips = userLogs.length;
        const avgTripMin = totalTrips > 0 ? Math.round(totalTimeSec / totalTrips / 60) : 0;
        const totalTimeMin = Math.round(totalTimeSec / 60);
        
        const userFares = (reports.reports || []).filter(r => r.user_email === auth.user.email);
        const totalSpent = userFares.reduce((sum, r) => sum + (r.fare_amount || 0), 0);
        
        setStats({
          totalTrips,
          totalTimeMin,
          avgTripMin,
          totalSpent,
          fareCount: userFares.length,
        });
      } catch (e) {
        console.error("Analytics fetch failed:", e);
      }
      setLoading(false);
    };
    fetchStats();
  }, [auth?.user?.email, timeRange]);

  if (!auth?.user?.email) {
    return <p className="text-sm text-gray-500 text-center">Log in to see your stats.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Time range selector */}
      <div className="flex gap-1">
        {["week", "month", "all"].map((t) => (
          <button key={t} onClick={() => setTimeRange(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${timeRange === t ? "bg-purple-800 text-white" : "bg-gray-100 text-gray-500"}`}>
            {t === "week" ? "This Week" : t === "month" ? "This Month" : "All Time"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-purple-50 rounded-xl p-3">
            <span className="text-xs text-gray-400">Total Trips</span>
            <p className="text-2xl font-black text-purple-800">{stats.totalTrips}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <span className="text-xs text-gray-400">Time in Transit</span>
            <p className="text-2xl font-black text-purple-800">{stats.totalTimeMin}<span className="text-sm font-bold"> min</span></p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <span className="text-xs text-gray-400">Avg Trip</span>
            <p className="text-2xl font-black text-green-700">{stats.avgTripMin}<span className="text-sm font-bold"> min</span></p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <span className="text-xs text-gray-400">Total Spent</span>
            <p className="text-2xl font-black text-green-700">₱{stats.totalSpent.toFixed(2)}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center">No data yet — start tracking!</p>
      )}
    </div>
  );
}
