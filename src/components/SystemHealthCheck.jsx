import React, { useState, useEffect } from 'react';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SB_HEADERS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

async function checkEdge(fn, body) {
  const start = Date.now();
  try {
    const res = await fetch(`${SB_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    const latency = Date.now() - start;
    return {
      ok: res.ok && data.status !== 'error',
      label: res.ok ? `✅ OK (${latency}ms)` : `❌ HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, label: `❌ ${e.message}` };
  }
}

export default function SystemHealthCheck() {
  const [checks, setChecks] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const results = {};

    try {
      const res = await fetch(`${SB_URL}/rest/v1/ph_routes?select=route_uuid&limit=1`, {
        headers: { apikey: SB_KEY },
      });
      const data = await res.json();
      results.supabaseRest = res.ok && Array.isArray(data)
        ? `✅ OK (${data.length} row)`
        : `❌ HTTP ${res.status}`;
    } catch { results.supabaseRest = '❌ Failed'; }

    {
      const r = await checkEdge('commute-save', {
        track_uuid: crypto.randomUUID(),
        client_log_id: `hc-${Date.now()}`,
        install_id: 'hc-test',
        user_id: null,
        route_name: 'HEALTH_CHECK',
        mode: 'jeepney',
        total_time_sec: 1,
        distance_m: 1,
        gps_track: [[14.6225, 121.0538]],
        gps_points: 1,
        raw_payload: { source: 'health_check' },
        source: 'health_check',
        city: 'Metro Manila',
        region: 'NCR',
        is_loop: false,
      });
      results.commuteSave = r.label;
    }

    {
      const r = await checkEdge('fare-report', {
        fare_amount: 1, mode: 'jeepney', route_name: 'HEALTH_CHECK',
      });
      results.fareReport = r.label;
    }

    {
      const r = await checkEdge('poi-add', {
        canonical_name: 'HEALTH_CHECK', category: 'landmark',
        lat: 14.6225, lng: 121.0538,
      });
      results.poiAdd = r.label;
    }

    try {
      results.offlineBuffer = indexedDB ? '✅ Available' : '❌ Not available';
    } catch { results.offlineBuffer = '❌ Failed'; }

    results.pwa = 'serviceWorker' in navigator ? '✅ Available' : '⚠️ Not available';

    setChecks(results);

    try {
      const res = await fetch(`${SB_URL}/rest/v1/rpc/admin_stats`, {
        method: 'POST',
        headers: SB_HEADERS,
        body: '{}',
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      } else {
        setMetrics({ error: `RPC ${res.status}` });
      }
    } catch (e) {
      setMetrics({ error: e.message });
    }

    setRunning(false);
  };

  useEffect(() => { runChecks(); }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#381D65] font-poppins">System Health</h3>
        <button
          onClick={runChecks}
          disabled={running}
          className="px-3 py-1.5 bg-[#7A4BC8] text-white rounded-[8px] text-[11px] font-bold font-poppins disabled:opacity-50"
        >
          {running ? '⏳ Checking...' : '🔄 Re-run'}
        </button>
      </div>

      <div className="space-y-2">
        {Object.entries(checks).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between bg-gray-50 rounded-[8px] px-3 py-2">
            <span className="text-[11px] font-poppins text-gray-600 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <span className="text-[11px] font-bold font-poppins">{value}</span>
          </div>
        ))}
      </div>

      {metrics && !metrics.error && (
        <div className="mt-4">
          <h4 className="text-[12px] font-bold text-[#381D65] font-poppins mb-2">Metrics</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(metrics).map(([k, v]) => (
              <div key={k} className="bg-purple-50 rounded-[8px] px-3 py-2">
                <div className="text-[10px] text-gray-500 capitalize">{k.replace(/_/g, ' ')}</div>
                <div className="text-[14px] font-bold text-[#381D65]">{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics?.error && (
        <p className="text-[11px] text-amber-600 font-poppins">
          ⚠️ Metrics RPC: {metrics.error} — run the SQL in Supabase to enable
        </p>
      )}

      {Object.keys(checks).length === 0 && (
        <p className="text-[11px] text-gray-400 font-poppins text-center py-4">Running checks...</p>
      )}
    </div>
  );
}
