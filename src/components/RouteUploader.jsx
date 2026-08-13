import { useState, useEffect, useRef } from "react";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { apiPost } from "../utils/api";

export default function RouteUploader({ onDone, onCancel }) {
  const { consent, location, requestConsentAndLocation, startTracking, stopTracking } = useTrackingConsent();
  const [step, setStep] = useState("start");
  const [elapsed, setElapsed] = useState(0);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [error, setError] = useState(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (step !== "recording" || !location) return;
    setGpsPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.timestamp === location.timestamp) return prev;
      return [...prev, { lat: location.lat, lng: location.lng, accuracy: location.accuracy, timestamp: location.timestamp }];
    });
  }, [location, step]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTracking();
    };
  }, [stopTracking]);

  const start = () => {
    if (!consent) {
      requestConsentAndLocation();
      return;
    }
    setError(null);
    setStep("recording");
    setGpsPoints([]);
    startTimeRef.current = Date.now();
    startTracking();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopTracking();
    setStep("saving");
    try {
      await apiPost("/commute/save", {
        client_log_id: `route-upload-${Date.now()}`,
        consent_granted: consent,
        total_time_sec: elapsed,
        gps_points: gpsPoints.slice(0, 500),
        completed_at: new Date().toISOString(),
        source: "route_uploader",
      });
      setStep("done");
      if (onDone) onDone();
    } catch (e) {
      setError("Failed to save route");
      setStep("recording");
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!consent && step === "start") {
    return (
      <div className="bg-white rounded-xl p-4 text-center space-y-3">
        <span className="text-3xl">📍</span>
        <p className="text-sm font-semibold text-gray-800">Enable location to record</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={requestConsentAndLocation} className="w-full py-2 bg-[#7A4BC8] text-white rounded-xl text-sm font-bold">Enable Location</button>
        {onCancel && <button onClick={onCancel} className="w-full py-1.5 text-xs text-gray-400">Cancel</button>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 space-y-3">
      {step === "start" && (
        <div className="text-center space-y-3">
          <span className="text-3xl">🛤️</span>
          <p className="text-sm font-semibold text-gray-800">Record a new route</p>
          <p className="text-xs text-gray-400">Tap start, ride your route, then stop.</p>
          <button onClick={start} className="w-full py-2 bg-[#7A4BC8] text-white rounded-xl text-sm font-bold">Start Recording</button>
          {onCancel && <button onClick={onCancel} className="w-full py-1.5 text-xs text-gray-400">Cancel</button>}
        </div>
      )}
      {step === "recording" && (
        <div className="text-center space-y-3">
          <div className="w-3 h-3 bg-purple-500 rounded-full mx-auto animate-pulse" />
          <p className="text-2xl font-black text-purple-600 tabular-nums">{formatTime(elapsed)}</p>
          <p className="text-xs text-gray-400">{gpsPoints.length} GPS points</p>
          <button onClick={stop} className="w-full py-2 bg-gray-800 text-white rounded-xl text-sm font-bold">Stop Recording</button>
        </div>
      )}
      {step === "saving" && (
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Saving route...</p>
        </div>
      )}
      {step === "done" && (
        <div className="text-center space-y-2">
          <span className="text-3xl">✅</span>
          <p className="text-sm font-bold text-green-600">Route saved!</p>
        </div>
      )}
    </div>
  );
}
