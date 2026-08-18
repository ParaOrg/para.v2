import { useState } from "react";
import { edgePost } from "../utils/api";
import { offlineBuffer } from "../utils/offlineBuffer";
import { useAuth } from "../context/AuthContext";

const MODES = [
  { id: "jeepney", label: "Jeep", icon: "🚐" },
  { id: "bus", label: "Bus", icon: "🚌" },
  { id: "train", label: "Train", icon: "🚆" },
  { id: "uv_express", label: "UV", icon: "🚐" },
  { id: "tricycle", label: "Trike", icon: "🛺" },
  { id: "grab", label: "Grab", icon: "🚗" },
  { id: "angkas", label: "Angkas", icon: "🏍️" },
];

const CITIES = [
  "Metro Manila", "Cebu City", "Davao City", "Iloilo City",
  "Baguio City", "Cagayan de Oro", "Zamboanga City", "General Santos",
  "Bacolod City", "Iligan City", "Other",
];

export default function FareReporter({ onSaved }) {
  const auth = useAuth();
  const [mode, setMode] = useState("jeepney");
  const [fare, setFare] = useState("");
  const [routeName, setRouteName] = useState("");
  const [city, setCity] = useState("Metro Manila");
  const [isSurge, setIsSurge] = useState(false);
  const [surgeMultiplier, setSurgeMultiplier] = useState("1");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async () => {
    if (!fare || parseFloat(fare) <= 0) return;
    setSaving(true);
    const data = {
      user_email: auth?.user?.email || "anonymous",
      route_name: routeName,
      mode,
      fare_amount: parseFloat(fare),
      city,
      region: city === "Metro Manila" ? "NCR" : "Other",
      tnvs_provider: mode === "grab" ? "Grab" : mode === "angkas" ? "Angkas" : null,
      surge_multiplier: isSurge ? parseFloat(surgeMultiplier) : 1,
      is_surge: isSurge,
      reported_at: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      await offlineBuffer.addFareReport(data);
    } else {
      try {
        await edgePost("fare-report", data);
      } catch {
        await offlineBuffer.addFareReport(data);
      }
    }

    setSaved(true);
    setSaving(false);
    setFare("");
    setRouteName("");
    if (onSaved) setTimeout(onSaved, 1500);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">Mode of transport</label>
        <div className="grid grid-cols-4 gap-1">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`p-2 rounded-lg text-center transition-colors ${mode === m.id ? "bg-purple-100 border border-purple-300" : "bg-gray-50 border border-transparent hover:bg-gray-100"}`}>
              <span className="text-lg">{m.icon}</span>
              <span className={`block text-[9px] font-bold ${mode === m.id ? "text-purple-800" : "text-gray-500"}`}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">Fare paid (₱)</label>
        <input type="number" value={fare} onChange={(e) => setFare(e.target.value)}
          placeholder="e.g. 12" inputMode="decimal" min="0" step="0.25"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">Route (optional)</label>
        <input type="text" value={routeName} onChange={(e) => setRouteName(e.target.value)}
          placeholder="e.g. Cubao to Makati" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={isSurge} onChange={(e) => setIsSurge(e.target.checked)} className="w-4 h-4" />
        Surge pricing
      </label>

      {isSurge && (
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Surge multiplier</label>
          <input type="number" value={surgeMultiplier} onChange={(e) => setSurgeMultiplier(e.target.value)}
            min="1" max="5" step="0.1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      )}

      {saved ? (
        <div className="text-center py-2">
          <span className="text-xl">✅</span>
          <p className="text-xs font-bold text-green-600">Fare recorded!</p>
        </div>
      ) : (
        <button onClick={handleSubmit} disabled={saving || !fare}
          className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm disabled:opacity-50">
          {saving ? "Saving…" : "Report Fare"}
        </button>
      )}
    </div>
  );
}
