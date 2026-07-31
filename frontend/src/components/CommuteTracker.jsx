import { useState, useRef, useEffect } from "react";

const API = "";

export default function CommuteTracker({ routeData, onComplete }) {
  const [status, setStatus] = useState("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [timer, setTimer] = useState(0);
  const [segments, setSegments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [gpsTrack, setGpsTrack] = useState([]);
  const [gpsActive, setGpsActive] = useState(false);
  const [distance, setDistance] = useState(0);
  const [gpsDenied, setGpsDenied] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const watchId = useRef(null);
  const lastPos = useRef(null);

  useEffect(() => {
    if (routeData?.segments) {
      const steps = [];
      routeData.segments.forEach((seg) => {
        if (seg.type === "walk" && seg.time_min > 0.5) {
          steps.push({ type: "walk", label: `Walk ${seg.time_min.toFixed(0)} min`, time: seg.time_min });
        } else if (seg.type !== "walk" && seg.time_min > 0.5) {
          steps.push({ type: "ride", label: `Ride ${seg.route}`, time: seg.time_min, fare: seg.fare, route: seg.route });
        }
      });
      setSegments(steps);
    }
    return () => { clearInterval(timerRef.current); stopGPS(); };
  }, [routeData]);

  const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const requestGPS = () => {
    if (!navigator.geolocation) {
      setGpsDenied(true);
      return false;
    }
    navigator.geolocation.getCurrentPosition(
      () => { setGpsActive(true); startGPSTracking(); },
      () => { setGpsDenied(true); },
      { timeout: 5000 }
    );
    return true;
  };

  const startGPSTracking = () => {
    setGpsActive(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt = {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, time: new Date().toISOString(),
          speed: pos.coords.speed || 0, step: currentStep, status: status,
        };
        setGpsTrack(prev => [...prev, pt]);
        if (lastPos.current) {
          setDistance(prev => prev + calcDistance(lastPos.current.lat, lastPos.current.lng, pt.lat, pt.lng));
        }
        lastPos.current = pt;
      },
      (err) => console.error("GPS:", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  };

  const stopGPS = () => {
    if (watchId.current) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    setGpsActive(false);
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);
  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  const formatDist = (m) => m < 1000 ? `${m.toFixed(0)}m` : `${(m/1000).toFixed(1)}km`;

  const saveToBackend = (data) => {
    fetch(`${API}/admin/commute/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).catch(e => console.error("Save error:", e));
  };

  const handleStart = () => {
    setStatus("idle"); setCurrentStep(0); setDistance(0); setGpsTrack([]);
    lastPos.current = null;
    setLogs([{ time: new Date().toISOString(), action: "started" }]);
    startTimer();
    requestGPS();
    advanceStep(0);
  };

  const advanceStep = (idx) => {
    const step = segments[idx];
    if (!step) {
      setStatus("completed"); stopTimer(); stopGPS();
      const data = { logs: [...logs, { time: new Date().toISOString(), action: "arrived" }], totalTime: timer, gpsTrack, distance, routeData };
      setLogs(data.logs);
      saveToBackend(data);
      if (onComplete) onComplete(data);
      return;
    }
    step.type === "ride" ? setStatus("waiting_ride") : setStatus("walking");
  };

  const handleHopOn = () => {
    const step = segments[currentStep];
    if (!step || step.type !== "ride") return;
    setLogs(prev => [...prev, { time: new Date().toISOString(), action: "hop_on", step: step.label }]);
    setStatus("riding");
  };

  const handleHopOff = () => {
    const step = segments[currentStep];
    if (!step) return;
    setLogs(prev => [...prev, { time: new Date().toISOString(), action: "hop_off", step: step.label }]);
    const next = currentStep + 1;
    setCurrentStep(next);
    advanceStep(next);
  };

  const handleWalkDone = () => {
    const step = segments[currentStep];
    if (!step) return;
    setLogs(prev => [...prev, { time: new Date().toISOString(), action: "walk_done", step: step.label }]);
    const next = currentStep + 1;
    setCurrentStep(next);
    advanceStep(next);
  };

  const handleArrive = () => {
    stopTimer(); stopGPS(); setStatus("completed");
    const data = { logs: [...logs, { time: new Date().toISOString(), action: "arrived" }], totalTime: timer, gpsTrack, distance, routeData };
    setLogs(data.logs);
    saveToBackend(data);
    if (onComplete) onComplete(data);
  };

  const cur = segments[currentStep];
  const nxt = segments[currentStep + 1];
  const prog = segments.length > 0 ? (currentStep / segments.length) * 100 : 0;

  return (
    <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
      <div className="flex justify-between items-center mb-2">
        <div><span className="text-sm font-bold text-purple-800">⏱ {formatTime(timer)}</span>{gpsActive && <span className="ml-2 text-xs text-green-600 font-bold">📍 LIVE</span>}</div>
        <div className="text-xs text-gray-500">Step {currentStep+1}/{segments.length}{distance>0 && ` • ${formatDist(distance)}`}</div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3"><div className="bg-purple-600 h-2 rounded-full transition-all" style={{width:`${prog}%`}}/></div>

      {status === "idle" && !timer && (
        <div className="text-center">
          <p className="text-sm font-semibold text-purple-800 mb-2">Ready to commute?</p>
          <p className="text-xs text-gray-500 mb-3">{segments.length} steps • {routeData?.total_time_min?.toFixed(0)} min • ₱{routeData?.total_fare?.toFixed(0)}</p>
          <button onClick={handleStart} className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700">🚀 Start Commute</button>
          <p className="text-[10px] text-gray-400 mt-1">GPS will be requested for accuracy</p>
        </div>
      )}

      {gpsDenied && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2 text-xs text-amber-700">
          ⚠️ GPS access denied. Continuing without location tracking.
        </div>
      )}

      {status === "waiting_ride" && cur && (
        <div>
          <div className="bg-white rounded-lg p-3 mb-3 border"><p className="text-xs text-gray-400 uppercase">Next:</p><p className="text-sm font-semibold">🚌 {cur.label}</p>{cur.fare>0&&<p className="text-xs text-gray-500">Fare: ₱{cur.fare.toFixed(0)}</p>}{nxt&&<p className="text-xs text-gray-400 mt-1">Then: {nxt.type==="walk"?"🚶":"🚌"} {nxt.label}</p>}</div>
          <button onClick={handleHopOn} className="w-full py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600">🚌 Hop On</button>
          <button onClick={handleArrive} className="w-full py-2 bg-red-100 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-200 mt-1">🏁 Arrived</button>
        </div>
      )}

      {status === "riding" && cur && (
        <div>
          <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-200 text-center"><p className="text-xs text-green-600 uppercase font-bold">📍 Riding</p><p className="text-sm font-semibold text-green-800">{cur.route||cur.label}</p></div>
          <button onClick={handleHopOff} className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600">⬇️ Hop Off</button>
          <button onClick={handleArrive} className="w-full py-2 bg-red-100 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-200 mt-1">🏁 Arrived</button>
        </div>
      )}

      {status === "walking" && cur && (
        <div>
          <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200 text-center"><p className="text-xs text-blue-600 uppercase font-bold">🚶 Walking</p><p className="text-sm font-semibold text-blue-800">{cur.label}</p></div>
          <button onClick={handleWalkDone} className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600">🚶 Arrived at Stop</button>
          <button onClick={handleArrive} className="w-full py-2 bg-red-100 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-200 mt-1">🏁 Arrived</button>
        </div>
      )}

      {status === "completed" && (
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-sm font-bold text-green-700">Commute Complete!</p>
          <p className="text-xs text-gray-500">{formatTime(timer)} • {formatDist(distance)} • Auto-saved ✓</p>
          <button onClick={()=>{setStatus("idle");setCurrentStep(0);setTimer(0);setLogs([]);setGpsTrack([]);setDistance(0);setGpsDenied(false);}} className="mt-3 px-4 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs hover:bg-purple-200">New Commute</button>
        </div>
      )}
    </div>
  );
}
