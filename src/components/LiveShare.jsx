import { useState, useEffect, useRef } from "react";
import { useTrackingConsent } from "../context/TrackingConsentContext";
import { useAuth } from "../context/AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function LiveShare({ routeData, onClose }) {
  const { user } = useAuth();
  const { location, consent } = useTrackingConsent();
  const [sessionCode, setSessionCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewerLocations, setViewerLocations] = useState({});
  const [allPolylines, setAllPolylines] = useState([]);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const broadcastInterval = useRef(null);
  const viewInterval = useRef(null);

  // Create session
  const createSession = async () => {
    if (!user?.email) return;
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/live_sessions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          session_code: code,
          creator_email: user.email,
          route_data: routeData,
        }),
      });
      
      setSessionCode(code);
      setShareUrl(`${window.location.origin}/live/${code}`);
      setIsBroadcasting(true);
      startBroadcasting(code);
    } catch (e) {
      console.error("Session creation failed:", e);
    }
  };

  // Join session as viewer
  const joinSession = async (code) => {
    setSessionCode(code);
    startViewing(code);
  };

  // Broadcast my location every 5 seconds
  const startBroadcasting = (code) => {
    broadcastInterval.current = setInterval(async () => {
      if (!location || !consent) return;
      
      await fetch(`${SUPABASE_URL}/rest/v1/live_locations`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          session_id: sessionCodeToId(code),
          user_email: user.email,
          lat: location.lat,
          lng: location.lng,
          heading: location.heading || 0,
          speed: location.speed || 0,
        }),
      });
    }, 5000);
  };

  // View others' locations every 3 seconds
  const startViewing = (code) => {
    viewInterval.current = setInterval(async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/live_locations?session_id=eq.${sessionCodeToId(code)}&order=updated_at.desc&limit=50`,
        { headers: { apikey: SUPABASE_ANON_KEY } }
      );
      const locations = await res.json();
      
      const byUser = {};
      locations.forEach((loc) => {
        if (!byUser[loc.user_email]) {
          byUser[loc.user_email] = loc;
        }
      });
      setViewerLocations(byUser);
      
      // Build polylines for each user with different colors
      const colors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"];
      const lines = [];
      let colorIdx = 0;
      
      Object.entries(byUser).forEach(([email, loc]) => {
        // Get recent trail for this user
        const userTrail = locations
          .filter((l) => l.user_email === email)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .slice(0, 20)
          .map((l) => [l.lat, l.lng]);
        
        if (userTrail.length >= 2) {
          lines.push({
            coordinates: userTrail,
            color: colors[colorIdx % colors.length],
            weight: 4,
          });
        }
        colorIdx++;
      });
      
      setAllPolylines(lines);
    }, 3000);
  };

  // Helper
  const sessionCodeToId = (code) => {
    // In production, query by code. Simplified for demo.
    return code;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-white">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-bold text-sm">📡 Live Route Sharing</h3>
        <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
      </div>
      
      <div className="p-4 space-y-4">
        <div className="h-48 rounded-xl overflow-hidden relative">
          <MapComponent polylines={allPolylines} fitBounds={true} showLegend={false} />
        </div>
        {!sessionCode && (
          <div className="space-y-3">
            <button
              onClick={createSession}
              className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm"
            >
              🔴 Start Sharing My Location
            </button>
            
            <div className="flex gap-2">
              <input
                placeholder="Enter session code (e.g., ABC123)"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                onChange={(e) => setSessionCode(e.target.value)}
              />
              <button
                onClick={() => joinSession(sessionCode)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold"
              >
                Join
              </button>
            </div>
          </div>
        )}
        
        {sessionCode && (
          <div className="space-y-3">
            <div className="bg-green-50 p-3 rounded-xl text-center">
              <p className="text-sm font-bold text-green-700">
                {isBroadcasting ? "🔴 Broadcasting" : "👀 Viewing"}
              </p>
              <p className="text-xs text-green-600 mt-1">Session: {sessionCode}</p>
            </div>
            
            {shareUrl && (
              <div className="flex gap-2">
                <input
                  value={shareUrl}
                  readOnly
                  className="flex-1 text-xs px-3 py-2 border rounded-lg"
                />
                <button onClick={copyLink} className="px-3 py-2 bg-gray-100 rounded-lg text-xs">
                  Copy
                </button>
              </div>
            )}
            
            <div className="bg-gray-50 p-3 rounded-xl">
              <p className="text-xs font-bold mb-2">Participants</p>
              {Object.keys(viewerLocations).length === 0 ? (
                <p className="text-xs text-gray-400">Waiting for participants...</p>
              ) : (
                Object.entries(viewerLocations).map(([email, loc]) => (
                  <div key={email} className="flex items-center gap-2 py-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs">{email}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {loc.speed > 0 ? `${Math.round(loc.speed)} km/h` : "Stopped"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
