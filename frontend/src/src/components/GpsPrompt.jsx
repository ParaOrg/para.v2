import { useEffect, useState } from "react";
import { useTrackingConsent } from "../context/TrackingConsentContext";

export default function GpsPrompt() {
  const {
    consent,
    status,
    error,
    requestConsentAndLocation,
    deny,
  } = useTrackingConsent();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  if (
    consent ||
    status === "denied" ||
    status === "requesting" ||
    status === "watching"
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl">
        <span className="text-5xl">📍</span>

        <h2 className="text-xl font-black text-[#381D65] mt-4">
          Enable Location
        </h2>

        <p className="text-sm text-gray-500 mt-2">
          Para PH uses your location to find routes near you and improve
          commute data. Location tracking starts only after you allow it.
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={requestConsentAndLocation}
          className="w-full mt-6 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm hover:bg-[#6a3cb8] transition-colors"
        >
          Enable Location
        </button>

        <button
          onClick={deny}
          className="w-full mt-2 py-2 text-gray-400 text-xs hover:text-gray-600 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
