import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../utils/api";
import { useTrackingConsent } from "../context/TrackingConsentContext";

const OFFLINE_QUEUE_KEY = "para_offline_commutes_v1";

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function CommuteTracker({
  routeData,
  onComplete,
  onCancel,
  onMinimize,
  onProgress,
}) {
  const rawSegments = routeData?.segments || [];

  const segments = rawSegments.filter(
    (seg) =>
      seg.route !== "WALK_TO_ROUTE" &&
      seg.route !== "WALK_TO_DEST" &&
      seg.route !== "WALK_TRANSFER"
  );

  const {
    consent,
    status,
    error: consentError,
    location,
    requestConsentAndLocation,
    startTracking,
    stopTracking,
  } = useTrackingConsent();

  const [phase, setPhase] = useState("waiting");
  const [minimized, setMinimized] = useState(false);
  const [currentSegment, setCurrentSegment] = useState(0);

  const [waitStart] = useState(() => Date.now());
  const [segmentStart, setSegmentStart] = useState(null);
  const [waitTime, setWaitTime] = useState(0);
  const [segmentTimes, setSegmentTimes] = useState(() =>
    segments.map(() => 0)
  );

  const [gpsPoints, setGpsPoints] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    if (onProgress) onProgress(currentSegment);
  }, [currentSegment, onProgress]);

  useEffect(() => {
    if (!consent) return;

    if (typeof startTracking === "function") {
      startTracking();
    }

    return () => {
      if (typeof stopTracking === "function") {
        stopTracking();
      }
    };
  }, [consent, startTracking, stopTracking]);

  useEffect(() => {
    if (!location || phase === "done") return;

    setGpsPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.timestamp === location.timestamp) return prev;
      return [...prev, location];
    });
  }, [location, phase]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (phase === "waiting") {
        setWaitTime(Math.floor((Date.now() - waitStart) / 1000));
      }

      if (phase === "riding" && segmentStart) {
        setSegmentTimes((prev) => {
          const next = [...prev];
          next[currentSegment] = Math.floor((Date.now() - segmentStart) / 1000);
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, waitStart, segmentStart, currentSegment]);

  const uploadQueue = useCallback(async () => {
    const queue = readQueue();
    if (!queue.length) return;

    const remaining = [];

    for (const log of queue) {
      try {
        await apiPost("/api/v1/commute-logs", log);
      } catch {
        remaining.push(log);
      }
    }

    writeQueue(remaining);
  }, []);

  useEffect(() => {
    uploadQueue();

    const handleOnline = () => uploadQueue();
    window.addEventListener("online", handleOnline);

    return () => window.removeEventListener("online", handleOnline);
  }, [uploadQueue]);

  const hopOn = () => {
    if (!consent) {
      requestConsentAndLocation();
      return;
    }

    setSegmentStart(Date.now());
    setPhase("riding");
  };

  const hopOff = () => {
    setSegmentStart(null);

    const next = currentSegment + 1;

    if (next >= segments.length) {
      setPhase("done");
    } else {
      setCurrentSegment(next);
      setPhase("waiting");
    }
  };

  const finish = async () => {
    setSaving(true);
    setSaveMessage(null);

    const totalTimeSec =
      waitTime + segmentTimes.reduce((sum, value) => sum + value, 0);

    const log = {
      client_log_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      route_uuid: routeData?.route_uuid || null,
      route_name: routeData?.route_name || null,
      consent_granted: consent,
      wait_time_sec: waitTime,
      segment_times_sec: segmentTimes,
      total_time_sec: totalTimeSec,
      total_distance_m: routeData?.total_distance_m || 0,
      gps_points: gpsPoints,
      rating,
      comment,
      completed_at: new Date().toISOString(),
    };

    try {
      await apiPost("/api/v1/commute-logs", log);
    } catch {
      const queue = readQueue();
      queue.push(log);
      writeQueue(queue);
      setSaveMessage(
        "Saved offline. It will sync automatically when connection returns."
      );
    }

    setSaving(false);

    if (onComplete) onComplete(log);
  };

  if (!segments.length) {
    return (
      <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
        No route segments available to track.
      </div>
    );
  }

  const currentSeg = segments[currentSegment];
  const isLastSegment = currentSegment >= segments.length - 1;
  const totalTimeSec =
    waitTime + segmentTimes.reduce((sum, value) => sum + value, 0);

  if (minimized) {
    return (
      <div
        className="bg-[#7A4BC8] text-white px-4 py-2 flex items-center justify-between cursor-pointer rounded-xl"
        onClick={() => {
          setMinimized(false);
          if (onMinimize) onMinimize();
        }}
      >
        <span className="text-xs font-bold">
          🚀 Tracking — {formatTime(totalTimeSec)}
        </span>
        <span className="text-xs">▲</span>
      </div>
    );
  }

  if (!consent) {
    return (
      <div className="bg-white rounded-xl p-6 text-center space-y-4">
        <span className="text-4xl">📍</span>

        <h3 className="font-bold text-gray-900">Enable tracked commute</h3>

        <p className="text-sm text-gray-500">
          Tracking your commute helps improve route data and safety. Location
          collection starts only after you allow it.
        </p>

        {consentError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {consentError}
          </div>
        )}

        <button
          onClick={requestConsentAndLocation}
          className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm hover:bg-[#6a3cb8] transition-colors"
        >
          Enable tracking
        </button>

        <button
          onClick={onCancel}
          className="w-full py-2 border border-gray-300 text-gray-500 rounded-lg text-xs hover:bg-gray-50"
        >
          Cancel
        </button>

        <p className="text-[11px] text-gray-400">
          <Link to="/privacy-policy" className="underline">
            Read the privacy policy
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg flex flex-col h-full">
      <div
        className="bg-purple-800 text-white px-4 py-3 flex items-center justify-between shrink-0 rounded-t-3xl cursor-pointer"
        onClick={() => {
          setMinimized(true);
          if (onMinimize) onMinimize();
        }}
      >
        <div>
          <p className="font-bold text-sm">🚀 Tracked Commute</p>
          <p className="text-purple-200 text-xs">{routeData?.message}</p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="text-white/70 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              gpsPoints.length > 0 ? "bg-green-500 animate-pulse" : "bg-gray-300"
            }`}
          />

          <span className="text-gray-500">
            {consentError
              ? consentError
              : status === "watching"
              ? `GPS active (${gpsPoints.length} points)`
              : "GPS starting…"}
          </span>
        </div>

        <div className="px-4 py-2 flex gap-1">
          {segments.map((seg, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full ${
                i < currentSegment
                  ? "bg-green-500"
                  : i === currentSegment
                  ? "bg-purple-500 animate-pulse"
                  : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="p-4 space-y-3">
          {phase === "waiting" && (
            <div className="text-center">
              <p className="text-3xl font-black text-purple-800 tabular-nums">
                {formatTime(waitTime)}
              </p>

              <p className="text-sm text-gray-500 mt-1">
                Waiting for your ride
              </p>

              <p className="text-xs text-gray-400 mt-2 truncate">
                Next: {currentSeg?.route || "Transit"} —{" "}
                {currentSeg?.time_min} min est.
              </p>

              <button
                onClick={hopOn}
                className="mt-4 w-full py-3 bg-purple-800 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors"
              >
                🚌 Hop On — {currentSeg?.route || "Start Ride"}
              </button>
            </div>
          )}

          {phase === "riding" && (
            <div className="text-center">
              <p className="text-3xl font-black text-green-600 tabular-nums">
                {formatTime(segmentTimes[currentSegment] || 0)}
              </p>

              <p className="text-sm text-gray-500 mt-1">
                Riding — {currentSeg?.route || "Transit"}
              </p>

              <p className="text-xs text-gray-400 mt-2">
                {currentSeg?.time_min} min estimated · ₱{currentSeg?.fare}
              </p>

              <button
                onClick={hopOff}
                className="mt-4 w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors"
              >
                {isLastSegment
                  ? "🏁 Hop Off — Finish Ride"
                  : "🚏 Hop Off — Transfer"}
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-3xl mb-1">🎉</p>
                <p className="font-bold text-gray-800">Commute Complete!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {formatTime(totalTimeSec)} total ·{" "}
                  {segments.filter((s) => !s.is_transfer).length} rides
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Rate your commute
                </p>

                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-2xl transition-colors ${
                        star <= rating
                          ? "text-amber-400"
                          : "text-gray-300 hover:text-amber-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional commute feedback..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />

              <a
                href="https://tally.so/r/J9rzW4"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm text-center hover:bg-[#381D65] transition-colors"
              >
                📝 Help us improve — share your experience
              </a>

              <div className="text-xs space-y-1 bg-gray-50 rounded-lg p-2">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-gray-600"
                  >
                    <span>{seg.is_transfer ? "🚶" : "🚌"}</span>
                    <span className="truncate">
                      {seg.is_transfer ? "Walk" : seg.route || "Transit"}
                    </span>
                    <span className="ml-auto tabular-nums">
                      {formatTime(segmentTimes[i] || 0)}
                    </span>
                  </div>
                ))}

                <div className="flex items-center gap-2 text-gray-400 pt-1 border-t border-gray-200">
                  <span>⏳ Wait</span>
                  <span className="ml-auto tabular-nums">
                    {formatTime(waitTime)}
                  </span>
                </div>
              </div>

              {saveMessage && (
                <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-2">
                  {saveMessage}
                </div>
              )}

              <button
                onClick={finish}
                disabled={saving}
                className="w-full py-3 bg-purple-800 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "💾 Save & Finish"}
              </button>

              <button
                onClick={() => {
                  finish();
                  onCancel();
                }}
                disabled={saving}
                className="w-full py-3 border-2 border-purple-800 text-purple-800 rounded-xl font-bold text-sm hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                🚐 Commute Again
              </button>

              <button
                onClick={onCancel}
                className="w-full py-2 border border-gray-300 text-gray-500 rounded-lg text-xs hover:bg-gray-50"
              >
                Discard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
