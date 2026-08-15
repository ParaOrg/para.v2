import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
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
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [savedTracks, setSavedTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage
    try {
      const savedUser = JSON.parse(localStorage.getItem("para_auth_user_v1") || "{}");
      setUsername(savedUser.handle || "");
      setBio(savedUser.bio || "Metro Manila commuter. Helping build better routes for everyone.");
      setSavedTracks(JSON.parse(localStorage.getItem("para_saved_tracks") || "[]"));
    } catch {}
    setLoading(false);
  }, []);

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

  const saveProfile = async () => {
    try {
      const res = await fetch(`${API}/auth/username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email, handle: username }),
      });
      const data = await res.json();
      if (data.status === "error") {
        alert(data.message || "Username already taken");
        return;
      }
      const existing = JSON.parse(localStorage.getItem("para_auth_user_v1") || "{}");
      existing.handle = username;
      existing.bio = bio;
      localStorage.setItem("para_auth_user_v1", JSON.stringify(existing));
    } catch (e) {
      alert("Failed to save. Try again.");
      return;
    }
    setEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-6">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#D1B6FC] flex items-center justify-center text-2xl font-bold text-[#381D65] shrink-0">
              {(username || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              {editing ? (
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className="w-full px-3 py-2 text-lg font-bold text-[#381D65] border border-gray-200 rounded-lg outline-none"
                />
              ) : (
                <h2 className="text-xl font-bold text-[#381D65]">{username || "Commuter"}</h2>
              )}
              <p className="text-sm text-gray-400">@{username || "commuter"}</p>
            {user?.role === "founder" && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-gradient-to-r from-[#7A4BC8] to-[#381D65] text-white px-2 py-0.5 rounded-full">
                👑 Founder
              </span>
            )}
            {user?.role === "admin" && user?.role !== "founder" && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-[#7A4BC8] text-white px-2 py-0.5 rounded-full">
                🛠️ Admin
              </span>
            )}
            {!user?.role && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Commuter
              </span>
            )}
            </div>
            <button
              onClick={() => editing ? saveProfile() : setEditing(true)}
              className="text-[#7A4BC8] text-sm font-bold"
            >
              {editing ? "Save" : "Edit"}
            </button>
          </div>

          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              className="w-full mt-4 px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none resize-none"
            />
          ) : (
            <p className="mt-4 text-sm text-gray-600">{bio}</p>
          )}
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
                    <p className="text-xs text-gray-400">{Math.floor(track.total_time_sec / 60)} min • {new Date(track.saved_at).toLocaleDateString()}</p>
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
