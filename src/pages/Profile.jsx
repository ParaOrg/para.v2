import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";

const BADGES = [
  { id: 1, name: "First Ride", icon: "🚐", description: "Completed your first tracked commute", tier: "bronze", unlocked: true },
  { id: 2, name: "Route Builder", icon: "🗺️", description: "Uploaded 5 community routes", tier: "silver", locked: true },
  { id: 3, name: "Commute Champion", icon: "🏆", description: "100 tracked commutes", tier: "gold", locked: true },
  { id: 4, name: "Early Adopter", icon: "⭐", description: "Joined during beta", tier: "bronze", unlocked: true },
];

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const [savedTracks, setSavedTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      setSavedTracks(JSON.parse(localStorage.getItem("para_saved_tracks") || "[]"));
    } catch {
      setSavedTracks([]);
    }
    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <span className="text-5xl">👤</span>
          <h1 className="text-2xl font-black text-gray-900 mt-4">Sign in to view your profile</h1>
        </div>
      </div>
    );
  }

  const meta = user.user_metadata || {};
  const displayName = meta.full_name || user.email?.split("@")[0] || "Your Name";
  const handle = meta.handle || "";
  const bio = meta.bio || "Metro Manila commuter. Helping build better routes for everyone.";
  const role = meta.role || "commuter";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-6">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#D1B6FC] flex items-center justify-center text-2xl font-bold text-[#381D65] shrink-0">
              {(handle || displayName || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#381D65] truncate">{displayName}</h2>
              {handle && <p className="text-sm text-gray-400">@{handle}</p>}
              <div className="mt-1">
                {role === "founder" && (
                  <span className="inline-block text-[10px] font-bold bg-gradient-to-r from-[#7A4BC8] to-[#381D65] text-white px-2 py-0.5 rounded-full">
                    👑 Founder
                  </span>
                )}
                {role === "admin" && (
                  <span className="inline-block text-[10px] font-bold bg-[#7A4BC8] text-white px-2 py-0.5 rounded-full">
                    🛠️ Admin
                  </span>
                )}
                {role === "driver" && (
                  <span className="inline-block text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    🚐 Driver
                  </span>
                )}
                {role === "commuter" && (
                  <span className="inline-block text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    🧍 Commuter
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end shrink-0">
              <Link
                to="/profile/edit"
                className="text-[#7A4BC8] text-sm font-bold hover:underline"
              >
                Edit Profile
              </Link>
              <Link
                to="/change-password"
                className="text-gray-400 hover:text-[#7A4BC8] text-xs font-medium"
              >
                Change Password
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">{bio}</p>

          {/* Contact info */}
          {meta.contact && (
            <p className="mt-2 text-xs text-gray-400">
              📱 {meta.contact}
            </p>
          )}
          {meta.coop_name && (
            <p className="mt-1 text-xs text-gray-400">
              🚐 {meta.coop_name}{meta.affiliation ? ` · ${meta.affiliation}` : ""}
            </p>
          )}
        </div>

        {/* Analytics */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Your Commute Stats</h3>
          <AnalyticsDashboard />
        </div>

        {/* Saved Commutes */}
        <div>
          <h3 className="font-bold text-[#381D65] mb-3">Saved Commutes</h3>
          {savedTracks.length === 0 ? (
            <p className="text-sm text-gray-400">No saved commutes yet.</p>
          ) : (
            <div className="space-y-2">
              {savedTracks.map((track, i) => (
                <div key={i} className="bg-white rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xl">🚐</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{track.route_name}</p>
                    <p className="text-xs text-gray-400">
                      {Math.floor(track.total_time_sec / 60)} min • {new Date(track.saved_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Badges */}
        <div>
          <h3 className="font-bold text-[#381D65] mb-3">Badges</h3>
          <div className="grid grid-cols-2 gap-3">
            {BADGES.map((badge) => (
              <div
                key={badge.id}
                className={`bg-white rounded-2xl border p-4 text-center ${
                  badge.locked ? "opacity-50" : "border-[#D1B6FC]"
                }`}
              >
                <span className="text-3xl">{badge.locked ? "🔒" : badge.icon}</span>
                <p className="text-sm font-bold text-[#381D65] mt-2">{badge.name}</p>
                <p className="text-[10px] text-gray-400 mt-1">{badge.description}</p>
                <span
                  className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                    badge.tier === "gold"
                      ? "bg-yellow-100 text-yellow-700"
                      : badge.tier === "silver"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {badge.tier}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
