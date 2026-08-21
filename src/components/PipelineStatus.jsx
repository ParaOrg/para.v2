import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

const CHECKS = [
  { id: "health", label: "Backend Health", endpoint: "/health" },
  { id: "routes", label: "Public Routes", endpoint: "/routes/public" },
  { id: "fares", label: "Fare Reports", endpoint: "/fare/reports?limit=1" },
  { id: "cities", label: "Cities", endpoint: "/cities" },
  { id: "threads", label: "Community Threads", endpoint: "/community/threads" },
  { id: "pois", label: "POI List", endpoint: "/poi/list" },
  { id: "write_test", label: "DB Write Capability", endpoint: "/health/write-test" },
];

export default function PipelineStatus() {
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  const runChecks = async () => {
    setChecking(true);
    const newResults = {};
    for (const check of CHECKS) {
      const start = Date.now();
      try {
        const res = await fetch(`${API}${check.endpoint}`);
        const contentType = res.headers.get("content-type") || "";
        newResults[check.id] = {
          ok: res.ok && !contentType.includes("text/html"),
          status: res.ok ? res.status : 0,
          latency: Date.now() - start,
        };
      } catch (e) {
        newResults[check.id] = { ok: false, status: 0, latency: Date.now() - start };
      }
    }
    setResults(newResults);
    setLastCheck(new Date());
    setChecking(false);
  };

  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const allOk = Object.values(results).length > 0 && Object.values(results).every(r => r.ok);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Pipeline Status</h3>
        <button onClick={runChecks} disabled={checking} className="text-xs text-[#7A4BC8] font-bold">
          {checking ? "…" : "↻ Refresh"}
        </button>
      </div>

      <div className="space-y-1">
        {CHECKS.map((check) => {
          const result = results[check.id];
          return (
            <div key={check.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: result?.ok ? "#f0fdf4" : result?.ok === false ? "#fef2f2" : "#f9fafb" }}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${result?.ok ? "bg-green-500" : result?.ok === false ? "bg-red-500" : "bg-gray-300 animate-pulse"}`} />
              <span className="text-xs text-gray-700 flex-1">{check.label}</span>
              {result?.latency != null && (
                <span className="text-[10px] text-gray-400">{result.latency}ms</span>
              )}
              {result?.status ? (
                <span className={`text-[10px] font-bold ${result.ok ? "text-green-600" : "text-red-500"}`}>{result.status}</span>
              ) : result?.ok ? (
                <span className="text-[10px] font-bold text-green-600">OK</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {lastCheck && (
        <p className="text-[10px] text-gray-400 text-center mt-2">
          {allOk ? "✅ All systems go" : "⚠️ Some services down"} • Last checked {lastCheck.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
