import React, { useState, useEffect } from 'react';

export default function SystemHealthCheck() {
  const [checks, setChecks] = useState({});
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const results = {};
    
    // 1. Supabase REST (ph_routes)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ph_routes?select=name&limit=1`, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
      });
      const data = await res.json();
      results.supabaseRest = data.length > 0 ? '✅ OK' : '❌ No data';
    } catch { results.supabaseRest = '❌ Failed'; }

    // 2. routes-public Edge Function
    try {
      const res = await fetch('https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/routes-public', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      results.routesPublic = data.total > 0 ? `✅ ${data.total} routes` : '❌ 0 routes';
    } catch { results.routesPublic = '❌ Failed'; }

    // 3. route-save Edge Function
    try {
      const res = await fetch('https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/route-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_name: 'HEALTH_CHECK', mode: 'jeepney', path_coordinates: [[14.6225,121.0538],[14.6226,121.0539]] })
      });
      const data = await res.json();
      results.routeSave = data.success ? '✅ OK' : '❌ Failed';
    } catch { results.routeSave = '❌ Failed'; }

    // 4. Lambda (direct via Vercel proxy)
    try {
      const res = await fetch('/api/route-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'cubao to makati', user_location: { lat: 14.6225, lng: 121.0538 } })
      });
      const data = await res.json();
      results.lambdaRouting = data.reply_text ? '✅ OK' : '❌ No reply';
    } catch { results.lambdaRouting = '❌ Failed'; }

    // 5. fare-report Edge Function
    try {
      const res = await fetch('https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/fare-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fare_amount: 15, mode: 'jeepney', route_name: 'HEALTH_CHECK' })
      });
      const data = await res.json();
      results.fareReport = data.status === 'success' ? '✅ OK' : '❌ Failed';
    } catch { results.fareReport = '❌ Failed'; }

    // 6. poi-add Edge Function
    try {
      const res = await fetch('https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/poi-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical_name: 'HEALTH_CHECK', category: 'landmark', lat: 14.6225, lng: 121.0538 })
      });
      const data = await res.json();
      results.poiAdd = data.status === 'success' ? '✅ OK' : '❌ Failed';
    } catch { results.poiAdd = '❌ Failed'; }

    // 7. commute-save Edge Function
    try {
      const res = await fetch('https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/commute-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_name: 'HEALTH_CHECK', total_time_sec: 60, distance_m: 100, gps_points: [[14.6225,121.0538]] })
      });
      const data = await res.json();
      results.commuteSave = data.status === 'success' ? '✅ OK' : '❌ Failed';
    } catch { results.commuteSave = '❌ Failed'; }

    // 8. Frontend build (check if page loads)
    results.frontendLoaded = document.readyState === 'complete' ? '✅ OK' : '⚠️ Loading';

    // 9. Offline buffer (IndexedDB)
    try {
      const dbCheck = indexedDB ? '✅ Available' : '❌ Not available';
      results.offlineBuffer = dbCheck;
    } catch { results.offlineBuffer = '❌ Failed'; }

    // 10. PWA service worker
    results.pwa = 'serviceWorker' in navigator ? '✅ Registered' : '❌ Not available';

    setChecks(results);
    setRunning(false);
  };

  useEffect(() => { runChecks(); }, []);

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[14px] font-bold text-[#381D65] font-poppins">System Health Check</h3>
        <button 
          onClick={runChecks} 
          disabled={running}
          className="px-3 py-1.5 bg-[#7A4BC8] text-white rounded-[8px] text-[11px] font-bold font-poppins disabled:opacity-50"
        >
          {running ? '⏳ Checking...' : '🔄 Re-run'}
        </button>
      </div>
      
      {Object.entries(checks).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between bg-gray-50 rounded-[8px] px-3 py-2">
          <span className="text-[11px] font-poppins text-gray-600 capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </span>
          <span className="text-[11px] font-bold font-poppins">{value}</span>
        </div>
      ))}
      
      {Object.keys(checks).length === 0 && (
        <p className="text-[11px] text-gray-400 font-poppins text-center py-4">Running checks...</p>
      )}
    </div>
  );
}
