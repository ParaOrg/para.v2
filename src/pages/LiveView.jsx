import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MapComponent from "../components/map_component";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function LiveView() {
  const { code } = useParams();
  const [locations, setLocations] = useState([]);
  const [polylines, setPolylines] = useState([]);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/live_locations?session_id=eq.${code}&order=updated_at.desc&limit=50`,
        { headers: { apikey: SUPABASE_ANON_KEY } }
      );
      const data = await res.json();
      
      const coords = data.map((loc) => [loc.lat, loc.lng]);
      setPolylines([{ coordinates: coords, color: "#ef4444", weight: 4 }]);
      setLocations(data);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [code]);
  
  return (
    <div className="fixed inset-0">
      <MapComponent polylines={polylines} fitBounds={true} />
      <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs font-bold">📡 Live Session: {code}</p>
        <p className="text-[10px] text-gray-400">{locations.length} updates</p>
      </div>
    </div>
  );
}
