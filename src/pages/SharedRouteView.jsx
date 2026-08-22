import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TripSummaryCard from "../components/TripSummaryCard";
import Navbar from "../components/Navbar";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function SharedRouteView() {
  const { shareId } = useParams();
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/saved_routes?share_id=eq.${shareId}&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRoute(data[0]);
        } else {
          setError("Route not found");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shareId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-xl font-black text-gray-900 mb-4 text-center">📤 Shared Route</h1>
        
        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
        
        {error && (
          <div className="text-center py-12">
            <p className="text-gray-400">{error}</p>
          </div>
        )}
        
        {route && (
          <div className="space-y-4">
            <TripSummaryCard routeData={{
              segments: route.segments || [],
              total_time_min: route.total_time_min,
              total_fare: route.total_fare,
              biyahe_score: route.biyahe_score,
              transfers: route.transfers || 0,
            }} isRecommended />
            <p className="text-center text-xs text-gray-400">
              Shared by {route.user_email} via Para PH
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
