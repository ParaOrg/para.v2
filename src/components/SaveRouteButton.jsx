import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function SaveRouteButton({ routeData }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const handleSave = async () => {
    if (!user?.email) return;
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/saved_routes`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_email: user.email,
          route_name: routeData?.start_point?.name + " to " + routeData?.end_point?.name || "Saved Route",
          origin_lat: routeData?.start_point?.lat,
          origin_lng: routeData?.start_point?.lng,
          dest_lat: routeData?.end_point?.lat,
          dest_lng: routeData?.end_point?.lng,
          segments: routeData?.segments || [],
          total_time_min: routeData?.total_time_min || 0,
          total_fare: routeData?.total_fare || 0,
          biyahe_score: routeData?.biyahe_score || 0,
        }),
      });
      
      if (res.ok) {
        setSaved(true);
      }
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const handleShare = async () => {
    if (!user?.email) return;
    
    try {
      // First save, then share
      await handleSave();
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/saved_routes?user_email=eq.${user.email}&order=created_at.desc&limit=1`, {
        headers: { 'apikey': SUPABASE_ANON_KEY },
      });
      const routes = await res.json();
      
      if (routes.length > 0) {
        const route = routes[0];
        const shareId = route.share_id;
        
        // Mark as shared
        await fetch(`${SUPABASE_URL}/rest/v1/saved_routes?id=eq.${route.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ is_shared: true }),
        });
        
        setShared(true);
        setShareUrl(`${window.location.origin}/routes/shared/${shareId}`);
        setShowShareLink(true);
      }
    } catch (e) {
      console.error("Share failed:", e);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleSave}
        disabled={saved}
        className={`flex-1 py-2 rounded-xl font-bold text-xs ${
          saved ? "bg-green-100 text-green-600" : "bg-[#7A4BC8] text-white"
        }`}
      >
        {saved ? "✓ Saved" : "💾 Save Route"}
      </button>
      
      <button
        onClick={handleShare}
        disabled={shared}
        className={`flex-1 py-2 rounded-xl font-bold text-xs ${
          shared ? "bg-green-100 text-green-600" : "bg-blue-500 text-white"
        }`}
      >
        {shared ? "✓ Shared" : "📤 Share"}
      </button>
      
      {showShareLink && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-500 mb-1">Share this route:</p>
          <input
            value={shareUrl}
            readOnly
            className="w-full text-[10px] px-2 py-1 border rounded"
            onClick={(e) => e.target.select()}
          />
        </div>
      )}
    </div>
  );
}
