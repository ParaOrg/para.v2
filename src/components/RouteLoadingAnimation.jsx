import { useState, useEffect } from "react";

export default function RouteLoadingAnimation({ loading = true }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 400);
    return () => clearInterval(interval);
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-pulse">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-[#7A4BC8] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm">🚐</span>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-[#381D65]">
          Naghahanap ng ruta{dots}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Scanning Metro Manila transit network...
        </p>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[#7A4BC8] animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
